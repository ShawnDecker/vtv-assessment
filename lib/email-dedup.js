// Email deduplication & rate-limiting helpers
// Council of Seven + 5-voice panel verdict 2026-05-04: P0 fix.
//
// Two failure modes this protects against:
//   1. Backfill/retry cascades (Apr 27: 20 coaching emails fired same day)
//   2. Volume harassment (4-5 emails/day to same recipient across types)
//
// Used by /coaching/send, /accountability/send, /devotional/send, /ceo-briefing,
// and any other handler that writes to email_log.

const TYPES_EXEMPT_FROM_DAILY_CAP = ['sign_in', 'pin_reset', 'password_reset', 'receipt', 'payment_failed'];
const DAILY_CAP_PER_RECIPIENT = 2; // marketing/coaching/devotional/accountability/ceo_briefing combined

/**
 * Returns true if this recipient has already received an email of this type
 * (with this optional subject) today (America/New_York calendar day).
 */
async function alreadySentToday(sql, recipient, emailType, subject = null) {
  if (!recipient || !emailType) return false;
  try {
    const rows = subject
      ? await sql`
          SELECT 1 FROM email_log
          WHERE LOWER(recipient) = LOWER(${recipient})
            AND email_type = ${emailType}
            AND subject = ${subject}
            AND sent_at >= ((NOW() AT TIME ZONE 'America/New_York')::date AT TIME ZONE 'America/New_York')
            AND status = 'sent'
          LIMIT 1`
      : await sql`
          SELECT 1 FROM email_log
          WHERE LOWER(recipient) = LOWER(${recipient})
            AND email_type = ${emailType}
            AND sent_at >= ((NOW() AT TIME ZONE 'America/New_York')::date AT TIME ZONE 'America/New_York')
            AND status = 'sent'
          LIMIT 1`;
    return rows.length > 0;
  } catch (e) {
    console.error('[email-dedup] alreadySentToday error:', e.message);
    return false; // Fail-open so a DB hiccup doesn't black out emails
  }
}

/**
 * Returns count of marketing-class emails sent to recipient today.
 * Excludes transactional types (sign_in, receipts, etc.).
 */
async function dailyMarketingCount(sql, recipient) {
  if (!recipient) return 0;
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS cnt FROM email_log
      WHERE LOWER(recipient) = LOWER(${recipient})
        AND email_type NOT IN ('sign_in','pin_reset','password_reset','receipt','payment_failed')
        AND sent_at >= ((NOW() AT TIME ZONE 'America/New_York')::date AT TIME ZONE 'America/New_York')
        AND status = 'sent'`;
    return Number(rows[0]?.cnt || 0);
  } catch (e) {
    console.error('[email-dedup] dailyMarketingCount error:', e.message);
    return 0;
  }
}

/**
 * Master gate: should we send this email right now?
 * Returns { allowed: bool, reason: string }.
 *
 * Blocks if:
 *   - Same (recipient, type) already sent today → idempotency
 *   - Recipient already at daily marketing cap (2/day) for marketing types
 */
async function canSend(sql, recipient, emailType, subject = null) {
  if (!recipient || !emailType) {
    return { allowed: false, reason: 'missing recipient or emailType' };
  }
  // Idempotency check: same type + same day = block
  const dupe = await alreadySentToday(sql, recipient, emailType, subject);
  if (dupe) {
    return { allowed: false, reason: `duplicate: ${emailType} already sent today to ${recipient}` };
  }
  // Daily cap on marketing-class emails
  if (!TYPES_EXEMPT_FROM_DAILY_CAP.includes(emailType)) {
    const count = await dailyMarketingCount(sql, recipient);
    if (count >= DAILY_CAP_PER_RECIPIENT) {
      return { allowed: false, reason: `daily cap reached: ${count}/${DAILY_CAP_PER_RECIPIENT} marketing emails today` };
    }
  }
  return { allowed: true, reason: 'ok' };
}

/**
 * Idempotent insert into email_log. If a row with the same
 * (recipient, email_type, sent_date) already exists, this is a no-op.
 * Requires the unique partial index from migrations/2026-05-04-email-dedup.sql.
 */
async function logEmailIdempotent(sql, { recipient, emailType, subject, contactId = null, assessmentId = null, status = 'sent', metadata = {} }) {
  if (!recipient || !emailType) return null;
  try {
    const rows = await sql`
      INSERT INTO email_log (recipient, email_type, subject, contact_id, assessment_id, status, metadata)
      VALUES (${recipient}, ${emailType}, ${subject || null}, ${contactId}, ${assessmentId}, ${status}, ${JSON.stringify(metadata)}::jsonb)
      ON CONFLICT ON CONSTRAINT email_log_dedup_idx DO NOTHING
      RETURNING id`;
    return rows[0]?.id || null;
  } catch (e) {
    // If the unique index doesn't exist yet (pre-migration), fall back to plain insert
    try {
      const rows = await sql`
        INSERT INTO email_log (recipient, email_type, subject, contact_id, assessment_id, status, metadata)
        VALUES (${recipient}, ${emailType}, ${subject || null}, ${contactId}, ${assessmentId}, ${status}, ${JSON.stringify(metadata)}::jsonb)
        RETURNING id`;
      return rows[0]?.id || null;
    } catch (e2) {
      console.error('[email-dedup] logEmailIdempotent error:', e2.message);
      return null;
    }
  }
}

module.exports = {
  alreadySentToday,
  dailyMarketingCount,
  canSend,
  logEmailIdempotent,
  TYPES_EXEMPT_FROM_DAILY_CAP,
  DAILY_CAP_PER_RECIPIENT,
};
