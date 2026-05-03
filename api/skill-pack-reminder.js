// /api/skill-pack-reminder — Vercel cron, runs daily at 13:00 UTC (~9am ET).
// Sends the day-24 trial reminder email to skill-pack-bundle subscribers whose trial
// ends in ~7 days. Idempotent via audit_log lookup — never double-sends.
//
// ─── STATE-LEVEL ROSCA MATRIX ─────────────────────────────────────────────────
// Subscription auto-renewal is regulated state-by-state. The matrix below was
// compiled in the 2026-05-03 vault audit (Yale Lawyer voice). Update any time a
// new state's law changes, OR a new VTV product type (annual billing, free-to-paid
// trial of a different length, etc.) gets added.
//
// CURRENT VTV COVERAGE: Only the skill-pack-bundle has a trial-to-paid mechanic.
// All other VTV subscriptions (VictoryPath $29, Value Builder $47, Victory VIP
// $497, dating-monthly $29) are no-trial month-to-month, which means CA AB-390 +
// NY § 527-a are SATISFIED by Stripe's standard receipt + cancel-anytime portal.
// Other states' renewal-reminder requirements DO NOT trigger month-to-month
// because there is no "renewal" — each month is a fresh charge with the same
// disclosure already on the original checkout. ANNUAL billing would change this.
//
// IF VTV LATER ADDS:
//   - Annual billing on any tier → trigger CA AB-390 (15-45 day pre-renewal
//     notice for all annual subs > $200), NY GBL § 527-a (30-60 day notice for
//     auto-renewing annual), IL 815 ILCS 601/15 (clear annual notice).
//   - Free-to-paid trial on a NEW product → must include this product in the
//     `BUNDLES_REQUIRING_DAY24_NOTICE` set below.
//   - Sales to minors or COPPA scenarios → out of scope; do not enable.
//
// STATE MATRIX (ROSCA-style auto-renewal + trial-conversion notice rules):
//
//   STATE | Statute                  | Trigger                          | Notice rule
//   ------|--------------------------|----------------------------------|----------------------------------
//   CA    | AB-390 / Bus & Prof §17602| Free trial → paid; annual >$200  | Pre-renewal 3-21 days; cancel link
//   NY    | GBL § 527-a              | Free-to-paid; annual auto-renew  | 15-45 days pre-renewal
//   IL    | 815 ILCS 601/15          | Auto-renewing contracts          | Annual notice required
//   VT    | 9 V.S.A. § 2454a         | Auto-renewing contracts >$50/yr  | Pre-renewal notice + opt-out
//   CT    | § 42-126b                | Auto-renewing contracts >$100/yr | Pre-renewal notice + cancel
//   FED   | ROSCA / 15 U.S.C. § 8403 | Online negative-option marketing | Clear consent + simple cancel
//
// Today this cron handles ONLY the federal ROSCA + state trial-conversion case
// (free trial → paid) for the skill-pack-bundle. The 7-day-prior reminder
// satisfies the strictest state requirement (CA's 3-21 day window) for the
// trial-to-paid transition. The Stripe Customer Portal (one-click cancel) plus
// the order-confirmation email together satisfy the federal "simple cancel"
// requirement.
//
// Set of bundle-tags that require the day-24 reminder. Add new product tags
// here when launching new free-trial products. Anything not in this set is
// SKIPPED by this cron with no side effects.
const BUNDLES_REQUIRING_DAY24_NOTICE = new Set([
  'skill-pack-bundle',
  // Future products with free trials get added here. Examples (NOT live):
  // 'value-builder-trial-30', 'victory-vip-trial-7'
]);
// ──────────────────────────────────────────────────────────────────────────────

const Stripe = require('stripe');
const { neon } = require('@neondatabase/serverless');

const BASE_URL = process.env.BASE_URL || 'https://assessment.valuetovictory.com';

module.exports = async (req, res) => {
  // Only GET (Vercel cron always issues GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional cron-secret check. If CRON_SECRET env is set, require Bearer auth.
  // This prevents accidental external triggering of the cron endpoint.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization || '';
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sql = neon(process.env.DATABASE_URL);
  const results = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    // Iterate all trialing subscriptions (paginate)
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const params = { status: 'trialing', limit: 100, expand: ['data.customer'] };
      if (startingAfter) params.starting_after = startingAfter;

      const subs = await stripe.subscriptions.list(params);
      hasMore = subs.has_more;
      if (subs.data.length > 0) {
        startingAfter = subs.data[subs.data.length - 1].id;
      }

      for (const sub of subs.data) {
        results.processed++;

        // Only bundles in the ROSCA matrix above need the day-24 reminder.
        // Other tiers don't have a 30-day trial structure that justifies a 7-day notice.
        // To add a new product to this list, append its bundle tag to
        // BUNDLES_REQUIRING_DAY24_NOTICE at the top of this file.
        const bundleTag = sub.metadata?.bundle;
        if (!bundleTag || !BUNDLES_REQUIRING_DAY24_NOTICE.has(bundleTag)) {
          results.skipped++;
          continue;
        }

        // Window: trial ends in 6–8 days (target = 7, ±1 day for cron flake tolerance)
        if (!sub.trial_end) { results.skipped++; continue; }
        const trialEndMs = sub.trial_end * 1000;
        const daysUntilEnd = (trialEndMs - Date.now()) / (1000 * 86400);
        if (daysUntilEnd < 6 || daysUntilEnd > 8) {
          results.skipped++;
          continue;
        }

        // Idempotency: don't double-send. audit_log is the source of truth.
        const auditCheck = await sql`
          SELECT id FROM audit_log
          WHERE action = 'skill_pack_day24_reminder_sent'
            AND target_id = ${sub.id}
          LIMIT 1
        `;
        if (auditCheck.length > 0) {
          results.skipped++;
          continue;
        }

        // Resolve customer + email + card last 4
        const customer = typeof sub.customer === 'object' ? sub.customer : null;
        const email = customer?.email;
        if (!email) { results.skipped++; continue; }

        let cardLast4 = '••••';
        try {
          const pmId = customer?.invoice_settings?.default_payment_method;
          if (pmId) {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            cardLast4 = pm.card?.last4 || '••••';
          }
        } catch (_) { /* non-fatal */ }

        const trialEndDate = new Date(trialEndMs);
        const dateStr = trialEndDate.toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        });
        const cancelUrl = `${BASE_URL}/member`;

        // Send the day-24 email via internal /api/email handler
        const emailRes = await fetch(`${BASE_URL}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: 'Your VTV trial ends in 7 days',
            html: renderDay24Email({ dateStr, cardLast4, cancelUrl }),
          }),
        }).catch((e) => ({ ok: false, _err: e.message }));

        if (emailRes && emailRes.ok) {
          // Mark sent in audit_log
          try {
            await sql`
              INSERT INTO audit_log (action, actor, target_table, target_id, new_values, ip_address)
              VALUES ('skill_pack_day24_reminder_sent', 'cron_skill_pack_reminder',
                      'stripe_subscriptions', ${sub.id},
                      ${JSON.stringify({
                        email,
                        trial_end: dateStr,
                        days_remaining: Math.round(daysUntilEnd),
                        card_last4: cardLast4,
                      })}::jsonb,
                      'cron')
            `;
          } catch (auditErr) {
            console.warn('[skill-pack-reminder] audit_log insert failed:', auditErr.message);
          }
          results.sent++;
          console.log(`[skill-pack-reminder] Sent to ${email} (sub ${sub.id}, ${Math.round(daysUntilEnd)}d remaining)`);
        } else {
          results.errors.push({
            sub_id: sub.id,
            email,
            error: emailRes?._err || `Email send failed: ${emailRes?.status}`,
          });
        }
      }
    }

    return res.json(results);
  } catch (err) {
    console.error('[skill-pack-reminder] Cron failed:', err);
    return res.status(500).json({ error: err.message, results });
  }
};

function renderDay24Email({ dateStr, cardLast4, cancelUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a;background:#f5efe1">
      <h2 style="color:#D4A847;margin-bottom:8px">7-day notice — your VTV trial ends ${dateStr}</h2>
      <p>Hi,</p>
      <p>Quick heads-up: your <strong>30-day free trial</strong> of VTV Membership ends in <strong>7 days</strong>.</p>
      <p>On <strong>${dateStr}</strong>, the card on file (••${cardLast4}) will be charged <strong>$29.00</strong> for your first month of membership. After that, $29 every month until you cancel.</p>
      <p style="margin:20px 0;padding:16px;background:#fff;border-left:4px solid #D4A847">
        <strong>Three things you can do right now:</strong><br>
        1 · <strong>Keep going</strong> — do nothing. Membership renews automatically. Skill Pack stays installed.<br>
        2 · <strong>Cancel any time</strong> at <a href="${cancelUrl}" style="color:#D4A847;font-weight:bold">${cancelUrl}</a> — two clicks, no phone call.<br>
        3 · <strong>Reply to this email</strong> — Shawn reads these.
      </p>
      <p style="margin:24px 0">
        <a href="${cancelUrl}" style="display:inline-block;background:#0a0a0a;color:#D4A847;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
          Manage My Membership
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
      <p style="font-size:12px;color:#999">
        Card ending ••${cardLast4} will be charged $29.00 USD on ${dateStr}, then $29.00 USD recurring monthly until you cancel.
        <br><br>
        <em>California, New York, Illinois, Vermont, Connecticut residents</em>: This is an automatic renewal reminder per state law. Cancel any time online — no phone call required.
        <br><br>
        Value to Victory · Shawn E. Decker · valuetovictory@gmail.com
      </p>
    </div>
  `;
}
