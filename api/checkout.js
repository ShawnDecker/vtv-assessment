const Stripe = require('stripe');
const { neon } = require('@neondatabase/serverless');

// Disable Vercel body parsing for webhook signature verification
module.exports.config = { api: { bodyParser: false } };

// Helper: read raw body from request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Hardcoded active price IDs — fallback if env vars are stale/inactive
const ACTIVE_PRICES = {
  individual: 'price_1THTlxCaTyuNk1McUWDRZOzz',  // VictoryPath $29/mo (new active product+price, Apr 1 2026)
  couple:     'price_1THT4tCaTyuNk1Mc1xzlrxu9',  // Value Builder $47/mo (created Apr 1 2026)
  premium:    'price_1TEhZ8CaTyuNk1McPoAJBpYW'   // Victory VIP $497/mo
};

// Map all URL slugs to DB-safe tier values
const TIER_CONFIG = {
  victorypath: { amount: 2900, name: 'VictoryPath Membership', dbTier: 'individual', priceKey: 'individual', mode: 'subscription' },
  individual:  { amount: 2900, name: 'VictoryPath Membership', dbTier: 'individual', priceKey: 'individual', mode: 'subscription' },
  builder:     { amount: 4700, name: 'Value Builder',          dbTier: 'couple',     priceKey: 'couple',     mode: 'subscription' },
  couple:      { amount: 4700, name: 'Value Builder',          dbTier: 'couple',     priceKey: 'couple',     mode: 'subscription' },
  vip:         { amount: 49700, name: 'Victory VIP',           dbTier: 'premium',    priceKey: 'premium',    mode: 'subscription' },
  premium:     { amount: 49700, name: 'Victory VIP',           dbTier: 'premium',    priceKey: 'premium',    mode: 'subscription' },
  // Dating-specific tiers
  'dating-gate':  { amount: 97,    name: 'Aligned Hearts Assessment Fee', dbTier: 'individual', mode: 'payment', isDating: true },
  'dating-monthly': { amount: 2900, name: 'Aligned Hearts Monthly',       dbTier: 'individual', priceKey: 'individual', mode: 'subscription', isDating: true },
  // One-time downloadable products — no membership tier, just a payment
  'skill-pack-bundle': {
    amount: 19700, // $197.00 charged as one-time line item
    name: 'VTV Top-10 Professionals Skill Pack Bundle',
    dbTier: 'individual',                // bundle includes 1mo VictoryPath membership free, then auto-renews
    priceKey: 'individual',              // recurring $29/mo VictoryPath price
    mode: 'subscription',                // hybrid: $197 once + $29/mo (30-day trial)
    bundleWithMembership: true,          // marker: combine one-time $197 + recurring $29/mo + 30-day trial
    trialDays: 30,
    isDownload: true,
    successPath: '/checkout/success?product=skill-pack-bundle&download=/downloads/vtv-skill-packs-bundle.zip',
    description: '10 profession-specific skill packs (real estate, coaches, authors, pastors, consultants, small business, event producers, service pros, content creators, sales). Voice rules + 5 templates + 3 AI prompts + weekly metrics dashboard per pack. Includes 1 month free VTV Membership ($29 value), auto-renews at $29/mo after the trial. Cancel anytime.',
  }
};

const BASE_URL = process.env.BASE_URL || 'https://assessment.valuetovictory.com';

module.exports = async (req, res) => {
  // CORS — allow specific origins only
  const ALLOWED = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','http://localhost:3000','http://localhost:5173'];
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED.includes(origin) ? origin : (origin.endsWith('.vercel.app') ? origin : ALLOWED[0]);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const url = req.url.split('?')[0].replace(/^\/api\/checkout/, '').replace(/^\/checkout/, '');

  try {
    // ============================================================
    // POST /api/checkout/webhook — Stripe webhook handler
    // ============================================================
    if (req.method === 'POST' && url === '/webhook') {
      const sig = req.headers['stripe-signature'];
      let event;

      try {
        const rawBody = await getRawBody(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      const sql = neon(process.env.DATABASE_URL);

      // Handle checkout.session.completed
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // SECURITY: Verify payment actually succeeded
        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
          console.log('[checkout] Ignoring incomplete session:', session.id, 'status:', session.payment_status);
          return res.json({ received: true, skipped: 'payment_not_completed' });
        }

        const email = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const paymentIntentId = session.payment_intent;
        const rawTier = session.metadata?.tier;
        // Map to DB-safe tier value
        const tierMap = { victorypath: 'individual', individual: 'individual', builder: 'couple', couple: 'couple', vip: 'premium', premium: 'premium' };
        const tier = tierMap[rawTier] || rawTier;

        // ── Check if this is an audiobook purchase (one-time product)
        const AUDIOBOOK_PRODUCT_ID = 'prod_UGkRRCOAvVYkSC';
        const AUDIOBOOK_PRICE_ID   = 'price_1TICwNCaTyuNk1McXI7thCPo';
        let isAudiobookPurchase = false;

        // Detect via line items if available, or via metadata, or price/product match
        if (session.metadata?.product_id === 'rfm-audiobook') {
          isAudiobookPurchase = true;
        } else {
          // Check line items for the audiobook price
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
            for (const item of (lineItems.data || [])) {
              if (
                item.price?.id === AUDIOBOOK_PRICE_ID ||
                item.price?.product === AUDIOBOOK_PRODUCT_ID
              ) {
                isAudiobookPurchase = true;
                break;
              }
            }
          } catch (liErr) {
            console.warn('[checkout] Could not fetch line items:', liErr.message);
          }
        }

        if (isAudiobookPurchase && email) {
          // Record audiobook entitlement
          try {
            await sql`
              INSERT INTO digital_purchases (email, product_id, stripe_product_id, stripe_payment_intent, granted_by)
              VALUES (${email.toLowerCase()}, 'rfm-audiobook', ${AUDIOBOOK_PRODUCT_ID}, ${paymentIntentId || null}, 'purchase')
              ON CONFLICT (email, product_id) DO NOTHING
            `;
            console.log('[checkout] Audiobook purchase recorded for:', email);
          } catch (dpErr) {
            console.error('[checkout] Failed to record audiobook purchase:', dpErr.message);
          }
        } else if (email && tier) {
          // Membership subscription purchase — upsert user_profiles
          // Find contact by email
          // Case-insensitive contact lookup
          let contacts = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;

          // If no contact found, create one so the payment is never lost
          if (contacts.length === 0) {
            console.warn('[checkout] No contact found for', email, '— creating new contact');
            const nameParts = (session.customer_details?.name || '').split(' ');
            const firstName = nameParts[0] || 'New';
            const lastName = nameParts.slice(1).join(' ') || 'Member';
            contacts = await sql`
              INSERT INTO contacts (email, first_name, last_name, created_at)
              VALUES (${email}, ${firstName}, ${lastName}, NOW())
              ON CONFLICT (email) DO UPDATE SET email = ${email}
              RETURNING id
            `;
          }

          if (contacts.length > 0) {
            const contactId = contacts[0].id;
            // Upsert user_profiles
            const existing = await sql`SELECT id FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
            if (existing.length > 0) {
              await sql`
                UPDATE user_profiles SET
                  membership_tier = ${tier},
                  stripe_customer_id = ${customerId},
                  stripe_subscription_id = ${subscriptionId},
                  updated_at = NOW()
                WHERE contact_id = ${contactId}
              `;
            } else {
              await sql`
                INSERT INTO user_profiles (contact_id, membership_tier, stripe_customer_id, stripe_subscription_id)
                VALUES (${contactId}, ${tier}, ${customerId}, ${subscriptionId})
              `;
            }
            console.log('[checkout] Tier updated:', email, '→', tier, 'contact:', contactId);

            // Audit log
            try {
              await sql`INSERT INTO audit_log (action, actor, target_table, target_id, new_values, ip_address)
                VALUES ('stripe_checkout_completed', 'stripe_webhook', 'user_profiles', ${contactId},
                        ${JSON.stringify({ email, tier, subscriptionId, customerId })}::jsonb,
                        ${req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'stripe'})`;
            } catch(e) {}

            // Sync dating profile payment status
            try {
              await sql`UPDATE dating_profiles SET is_paid = true, stripe_subscription_id = ${subscriptionId || null} WHERE contact_id = ${contactId}`;
            } catch(e) { /* dating_profiles may not exist yet — that's OK */ }

            // If this was a dating one-time gate payment ($0.97), restore trial
            if (session.metadata?.payment_type === 'one_time' && session.metadata?.dating === 'true') {
              try {
                await sql`UPDATE dating_profiles SET trial_start = now(), trial_ends = now() + interval '30 days', is_paid = false WHERE contact_id = ${contactId}`;
                console.log('[checkout] Dating trial restored for:', email);
              } catch(e) { /* non-fatal */ }
            }
          }
        }
      }

      // Handle subscription deleted (downgrade to free)
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        await sql`
          UPDATE user_profiles SET
            membership_tier = 'free',
            stripe_subscription_id = NULL,
            updated_at = NOW()
          WHERE stripe_subscription_id = ${subscriptionId}
        `;

        // Sync dating profile payment status on cancellation
        try {
          await sql`UPDATE dating_profiles SET is_paid = false, stripe_subscription_id = NULL WHERE stripe_subscription_id = ${subscriptionId}`;
        } catch(e) {}

        // Audit log
        try {
          await sql`INSERT INTO audit_log (action, actor, target_table, target_id, new_values, ip_address)
            VALUES ('stripe_subscription_deleted', 'stripe_webhook', 'user_profiles', ${subscriptionId},
                    ${JSON.stringify({ subscriptionId, action: 'downgrade_to_free' })}::jsonb,
                    ${req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'stripe'})`;
        } catch(e) {}
      }

      // Handle subscription updated (tier change)
      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const priceId = subscription.items?.data?.[0]?.price?.id;

        if (priceId) {
          // Determine tier from price ID
          let newTier = null;
          const envPrices = {
            [process.env.STRIPE_PRICE_INDIVIDUAL]: 'individual',
            [process.env.STRIPE_PRICE_COUPLE]: 'couple',
            [process.env.STRIPE_PRICE_PREMIUM]: 'premium'
          };

          if (envPrices[priceId]) {
            newTier = envPrices[priceId];
          } else {
            // Look up the price amount to determine tier
            try {
              const price = await stripe.prices.retrieve(priceId);
              const amount = price.unit_amount;
              if (amount === 2900) newTier = 'individual';
              else if (amount === 4700) newTier = 'couple';
              else if (amount === 49700) newTier = 'premium';
            } catch (e) { /* ignore lookup error */ }
          }

          if (newTier) {
            await sql`
              UPDATE user_profiles SET
                membership_tier = ${newTier},
                updated_at = NOW()
              WHERE stripe_subscription_id = ${subscriptionId}
            `;
          }
        }
      }

      // Handle trial_will_end (fires 3 days before trial converts) — required for ROSCA + CA/IL compliance
      // This is the renewal-reminder email for the Skill Pack Bundle's 30-day free membership trial.
      if (event.type === 'customer.subscription.trial_will_end') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const trialEnd = subscription.trial_end; // unix timestamp
        const isBundle = subscription.metadata?.bundle === 'skill-pack-bundle';

        try {
          // Get customer email
          const customer = await stripe.customers.retrieve(customerId);
          const email = customer?.email;
          if (email) {
            const trialEndDate = new Date(trialEnd * 1000);
            const dateStr = trialEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            // Send reminder via internal email API (api/email.js handles SMTP)
            const emailRes = await fetch(`${BASE_URL}/api/email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: email,
                subject: isBundle
                  ? 'Heads up — your free month of VTV Membership ends in 3 days'
                  : 'Your VTV trial ends in 3 days',
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a">
                    <h2 style="color:#D4A847;margin-bottom:8px">3-day notice</h2>
                    <p>Hi,</p>
                    <p>Your <strong>30-day free VTV Membership</strong>${isBundle ? ' (included with your Skill Pack Bundle purchase)' : ''} ends on <strong>${dateStr}</strong>.</p>
                    <p>After that, your subscription will auto-renew at <strong>$29/month</strong> on the same card on file. You can cancel anytime — no questions, no friction.</p>
                    <p style="margin:24px 0">
                      <a href="https://assessment.valuetovictory.com/member"
                         style="display:inline-block;background:#0a0a0a;color:#D4A847;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
                        Manage My Membership
                      </a>
                    </p>
                    <p style="font-size:13px;color:#666">To cancel before you're charged, visit your member portal and click "Cancel Subscription." Cancellation is immediate and takes 30 seconds — we won't ask you why.</p>
                    <p style="font-size:13px;color:#666">Questions? Just reply to this email — Shawn reads every message.</p>
                    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
                    <p style="font-size:12px;color:#999">Value to Victory · Shawn E. Decker · valuetovictory@gmail.com</p>
                  </div>
                `,
              }),
            }).catch(e => { console.warn('[trial_will_end] email send failed:', e.message); });

            console.log(`[trial_will_end] Sent reminder to ${email} (bundle=${isBundle}) for sub ${subscription.id}`);
          }
        } catch (e) {
          console.error('[trial_will_end] Handler error (non-fatal):', e.message);
        }
      }

      // Track subscription events in analytics
      try {
        const eventType = event.type === 'checkout.session.completed' ? 'subscription_created'
          : event.type === 'customer.subscription.deleted' ? 'subscription_cancelled'
          : event.type === 'customer.subscription.updated' ? 'subscription_updated'
          : event.type === 'customer.subscription.trial_will_end' ? 'subscription_trial_ending'
          : null;
        if (eventType) {
          await sql`INSERT INTO analytics_events (event_type, metadata) VALUES (${eventType}, ${JSON.stringify({ stripe_event: event.type, stripe_event_id: event.id })}::jsonb)`;
        }
      } catch (e) { /* analytics table may not exist yet — non-fatal */ }

      // Forward Stripe events to n8n webhook (fire-and-forget, non-blocking)
      try {
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n.srv1138119.hstgr.cloud/webhook/stripe-webhook';
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: event.type, data: event.data.object }),
          signal: AbortSignal.timeout(5000)
        }).catch(() => {}); // Silent fail — n8n may be unreachable
      } catch (e) { /* n8n forward is best-effort */ }

      return res.json({ received: true });
    }

    // ============================================================
    // GET /api/checkout?tier=xxx&email=xxx — Create Stripe Checkout session
    // ============================================================
    if (req.method === 'GET') {
      const params = new URL('http://x' + req.url).searchParams;
      const tier = params.get('tier');
      const email = params.get('email');

      if (!tier || !TIER_CONFIG[tier]) {
        return res.status(400).json({ error: 'Invalid tier. Must be: victorypath, builder, or vip' });
      }

      const config = TIER_CONFIG[tier];

      // Subscription downgrade protection: check if user already has a higher tier
      if (email) {
        try {
          const sql = neon(process.env.DATABASE_URL);
          const TIER_RANK = { free: 0, individual: 1, couple: 2, premium: 3 };
          const requestedRank = TIER_RANK[config.dbTier] || 0;
          const contacts = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
          if (contacts.length > 0) {
            const profiles = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contacts[0].id} LIMIT 1`;
            if (profiles.length > 0 && profiles[0].membership_tier) {
              const currentRank = TIER_RANK[profiles[0].membership_tier] || 0;
              if (currentRank >= requestedRank && currentRank > 0) {
                return res.status(400).json({
                  error: `You already have an active ${profiles[0].membership_tier} subscription. To change your plan, please use the billing portal in your Member Dashboard.`,
                  currentTier: profiles[0].membership_tier,
                  requestedTier: config.dbTier,
                  billingPortalUrl: `${BASE_URL}/member`
                });
              }
            }
          }
        } catch (tierCheckErr) {
          // Non-blocking: if check fails, allow checkout to proceed
          console.warn('[Checkout] Tier check failed (non-blocking):', tierCheckErr.message);
        }
      }

      const isOneTime = config.mode === 'payment';
      const isDating = config.isDating || false;
      const isDownload = config.isDownload || false;
      const isBundle = config.bundleWithMembership === true;
      const successUrl = isDownload
        ? `${BASE_URL}${config.successPath || '/checkout/success'}`
        : isDating
        ? `${BASE_URL}/faith-match?payment=success&tier=${config.dbTier}`
        : `${BASE_URL}/member?welcome=true&tier=${config.dbTier}`;
      const cancelUrl = isDownload ? `${BASE_URL}/professionals` : isDating ? `${BASE_URL}/faith-match` : `${BASE_URL}/pricing`;

      let sessionParams;

      if (isOneTime) {
        // One-time payment (e.g., $0.97 dating assessment gate)
        console.log(`[Checkout] Creating one-time payment: ${config.name} ($${(config.amount / 100).toFixed(2)})`);
        sessionParams = {
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: config.name },
              unit_amount: config.amount
            },
            quantity: 1
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            tier: config.dbTier || 'none',
            dating: isDating ? 'true' : 'false',
            download: isDownload ? 'true' : 'false',
            product: tier,
            payment_type: 'one_time',
          },
          allow_promotion_codes: true
        };
      } else if (isBundle) {
        // Hybrid: $197 one-time setup fee + $29/mo subscription with 30-day trial.
        // Customer is charged $197 immediately for the bundle, gets membership free for 30 days,
        // then auto-renews at $29/mo. Cancel anytime via member portal.
        const priceId = ACTIVE_PRICES[config.priceKey];
        console.log(`[Checkout] BUNDLE: $${(config.amount/100).toFixed(2)} setup + ${priceId} (${config.trialDays}-day trial)`);
        sessionParams = {
          mode: 'subscription',
          line_items: [
            // Recurring subscription line — $29/mo
            { price: priceId, quantity: 1 },
            // One-time setup fee for the Skill Pack Bundle
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: config.name,
                  description: 'One-time purchase: 10 profession-specific skill packs (downloadable). Includes 1 month of VTV Membership free.'
                },
                unit_amount: config.amount,
                tax_behavior: 'unspecified',
              },
              quantity: 1,
            },
          ],
          subscription_data: {
            trial_period_days: config.trialDays || 30,
            metadata: {
              bundle: 'skill-pack-bundle',
              trial_source: 'skill_pack_bundle_bonus',
            },
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            tier: config.dbTier,
            product: tier,
            bundle: 'skill-pack-bundle',
            download: 'true',
            payment_type: 'bundle_subscription',
          },
          allow_promotion_codes: true,
        };
      } else {
        // Subscription (recurring)
        const priceId = ACTIVE_PRICES[config.priceKey];
        console.log(`[Checkout] Using price ${priceId} for ${config.name} (${config.dbTier})`);
        sessionParams = {
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { tier: config.dbTier, dating: isDating ? 'true' : 'false' },
          allow_promotion_codes: true
        };
      }

      if (email) {
        // Find existing Stripe customer to prevent duplicates
        try {
          const existingCustomers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
          if (existingCustomers.data.length > 0) {
            sessionParams.customer = existingCustomers.data[0].id;
            console.log(`[Checkout] Found existing customer ${existingCustomers.data[0].id} for ${email}`);
          } else {
            sessionParams.customer_email = email;
          }
        } catch (lookupErr) {
          console.warn('[Checkout] Customer lookup failed, using email:', lookupErr.message);
          sessionParams.customer_email = email;
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      // Redirect to Stripe Checkout
      res.writeHead(303, { Location: session.url });
      return res.end();
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Checkout API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
