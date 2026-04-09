/**
 * POST /api/devotional-log
 * Logs that a devotional email was sent (called by n8n after each send)
 * Protected by ADMIN_API_KEY (x-api-key header)
 *
 * Body: { contact_id, email, day_number, status }
 */

const { neon } = require('@neondatabase/serverless');

const ALLOWED_ORIGINS = [
  'https://n8n.srv1138119.hstgr.cloud',
  'https://assessment.valuetovictory.com',
  'http://localhost:5678',
];

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { contact_id, email, day_number, status } = body || {};

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    // Update devotional_progress for this contact
    if (contact_id) {
      try {
        await sql`
          INSERT INTO devotional_progress (contact_id, current_day, last_sent_at)
          VALUES (${contact_id}, ${day_number || 1}, NOW())
          ON CONFLICT (contact_id)
          DO UPDATE SET
            current_day = ${day_number || 1},
            last_sent_at = NOW(),
            total_sent = devotional_progress.total_sent + 1
        `;
      } catch (e) {
        // Table might not exist yet — non-fatal
        console.warn('devotional_progress update failed (non-fatal):', e.message);
      }
    }

    // Log to email_log table
    try {
      await sql`
        INSERT INTO email_log (recipient, email_type, subject, contact_id, status, metadata)
        VALUES (
          ${email},
          'devotional',
          ${'Day ' + (day_number || '?') + ' Devotional'},
          ${contact_id || null},
          ${status || 'sent'},
          ${JSON.stringify({ day_number, source: 'n8n_workflow' })}::jsonb
        )
      `;
    } catch (e) {
      console.warn('email_log insert failed (non-fatal):', e.message);
    }

    // Log analytics event
    try {
      await sql`
        INSERT INTO analytics_events (event_type, contact_id, metadata)
        VALUES ('devotional_sent', ${contact_id || null}, ${JSON.stringify({ day_number, email })}::jsonb)
      `;
    } catch (e) { /* analytics table may not exist — non-fatal */ }

    return res.json({ success: true, logged: true });
  } catch (err) {
    console.error('devotional-log error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
