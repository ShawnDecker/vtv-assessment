const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Daily 7am UTC cron — sends birthday reward emails to today's opt-ins
// Configure in vercel.json: { "path": "/api/cron-birthday", "schedule": "0 7 * * *" }
// Auth: requires Authorization: Bearer <CRON_SECRET>

module.exports = async (req, res) => {
  // CRON_SECRET auth — Bearer only
  const auth = req.headers['authorization'] || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();
  const BASE_URL = 'https://assessment.valuetovictory.com';

  // Find today's birthdays where opt-in active AND not already sent this year
  let birthdays;
  try {
    birthdays = await sql`
      SELECT br.contact_id, br.birth_month, br.birth_day, c.email, c.first_name
      FROM birthday_rewards br
      JOIN contacts c ON c.id = br.contact_id
      WHERE br.birth_month = ${month}
        AND br.birth_day = ${day}
        AND br.reward_optin = true
        AND (br.last_reward_year IS NULL OR br.last_reward_year < ${year})
        AND c.email IS NOT NULL
      LIMIT 500
    `;
  } catch (e) {
    return res.status(500).json({ error: 'DB query failed', details: e.message });
  }

  if (birthdays.length === 0) {
    return res.json({ date: `${month}/${day}/${year}`, sent: 0, message: 'No birthdays today.' });
  }

  // Email setup
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });

  let sent = 0, failed = 0;
  const errors = [];

  for (const b of birthdays) {
    try {
      // Generate unique coupon code
      const couponCode = `BDAY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const subject = `Happy Birthday, ${b.first_name || 'friend'} — your gift from Value to Victory`;

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Happy Birthday</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#fff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0a;padding:40px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background:#18181b;border:1px solid #2a2a44;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:48px 40px 24px 40px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:11px;color:#d4a853;letter-spacing:3px;text-transform:uppercase;font-weight:700;">A Gift From Shawn</p>
        <h1 style="margin:0 0 16px 0;font-size:36px;font-weight:800;color:#ffffff;line-height:1.2;">Happy Birthday, ${b.first_name || 'friend'}</h1>
        <p style="margin:0 0 24px 0;font-size:16px;color:#a1a1aa;line-height:1.6;">You showed up. You took the assessment. You did the work. Today's about you.</p>
      </td></tr>

      <tr><td style="padding:0 40px 24px 40px;">
        <div style="background:#0a0a0a;border:2px solid #d4a853;border-radius:12px;padding:32px 24px;text-align:center;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#d4a853;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Your Birthday Gift</p>
          <h2 style="margin:0 0 8px 0;font-size:28px;font-weight:800;color:#ffffff;">50% Off One Coaching Session</h2>
          <p style="margin:0 0 20px 0;font-size:13px;color:#8888a8;">30 minutes with Shawn — pick any pillar to dig into.</p>
          <div style="background:#18181b;border:1px dashed #d4a853;border-radius:8px;padding:14px;margin:0 0 16px 0;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:18px;font-weight:800;color:#d4a853;letter-spacing:2px;">${couponCode}</p>
          </div>
          <a href="https://calendly.com/valuetovictory/30min" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#d4a853,#c89030);color:#1a1a2e;font-size:15px;font-weight:800;text-decoration:none;border-radius:8px;">Book Your Birthday Session →</a>
          <p style="margin:16px 0 0 0;font-size:11px;color:#4a4a64;">Code valid 30 days. Use at checkout or mention on the call.</p>
        </div>
      </td></tr>

      <tr><td style="padding:24px 40px 32px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#8888a8;line-height:1.6;font-style:italic;">"Teach us to number our days, that we may gain a heart of wisdom." — Psalm 90:12</p>
      </td></tr>

      <tr><td style="padding:24px 40px;background:#111118;border-top:1px solid #2a2a44;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:11px;color:#4a4a64;">You opted into birthday rewards. <a href="${BASE_URL}/settings" style="color:#d4a853;">Manage preferences</a> · <a href="${BASE_URL}/api/birthday/optout?email=${encodeURIComponent(b.email)}" style="color:#d4a853;">Unsubscribe from birthday emails</a></p>
        <p style="margin:0;font-size:11px;color:#4a4a64;">Value to Victory · ${BASE_URL}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

      await transporter.sendMail({
        from: `"Shawn at Value to Victory" <${process.env.GMAIL_USER}>`,
        to: b.email,
        subject,
        html
      });

      // Log + mark as sent for this year
      await sql`INSERT INTO birthday_reward_log (contact_id, coupon_code, coupon_value, email_status, metadata)
        VALUES (${b.contact_id}, ${couponCode}, '50% off coaching', 'sent', ${JSON.stringify({ email: b.email, year, month, day })}::jsonb)`;
      await sql`UPDATE birthday_rewards SET last_reward_sent_at = NOW(), last_reward_year = ${year}, updated_at = NOW() WHERE contact_id = ${b.contact_id}`;

      // Track to analytics
      try {
        await sql`INSERT INTO analytics_events (event_type, contact_id, metadata) VALUES ('birthday_reward_sent', ${b.contact_id}, ${JSON.stringify({ couponCode, year })}::jsonb)`;
      } catch (e) { /* non-fatal */ }

      sent++;
    } catch (err) {
      failed++;
      errors.push({ contact_id: b.contact_id, error: err.message });
    }
  }

  return res.json({
    date: `${month}/${day}/${year}`,
    candidates: birthdays.length,
    sent,
    failed,
    errors: errors.slice(0, 5)
  });
};
