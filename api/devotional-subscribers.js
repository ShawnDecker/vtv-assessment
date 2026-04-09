/**
 * GET /api/devotional-subscribers
 * Returns list of active devotional subscribers for n8n email workflow
 * Protected by ADMIN_API_KEY (x-api-key header)
 */

const { neon } = require('@neondatabase/serverless');

// CORS allowed origins
const ALLOWED_ORIGINS = [
  'https://valuetovictory.com',
  'https://www.valuetovictory.com',
  'https://assessment.valuetovictory.com',
  'https://n8n.srv1138119.hstgr.cloud',
  'http://localhost:3000',
  'http://localhost:5678',
];

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth — require admin API key (n8n workflow sends this)
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Get all contacts who have opted into devotional emails
    // A subscriber is anyone who:
    //   1. Has a record in devotional_progress, OR
    //   2. Signed up for the free book (opted in), OR
    //   3. Has an active membership (individual, couple, or premium)
    const subscribers = await sql`
      SELECT DISTINCT
        c.id as contact_id,
        c.email,
        c.first_name,
        COALESCE(dp.current_day, 1) as current_day,
        COALESCE(dp.last_sent_at, '1970-01-01'::timestamp) as last_sent_at,
        COALESCE(up.membership_tier, 'free') as tier
      FROM contacts c
      LEFT JOIN devotional_progress dp ON dp.contact_id = c.id
      LEFT JOIN user_profiles up ON up.contact_id = c.id
      WHERE c.email IS NOT NULL
        AND c.email != ''
        AND (
          dp.id IS NOT NULL
          OR up.membership_tier IN ('individual', 'couple', 'premium')
        )
        AND (dp.opted_out IS NULL OR dp.opted_out = false)
      ORDER BY c.id ASC
    `;

    return res.json({
      success: true,
      count: subscribers.length,
      subscribers: subscribers.map(s => ({
        contact_id: s.contact_id,
        email: s.email,
        first_name: s.first_name || 'Friend',
        current_day: s.current_day,
        last_sent_at: s.last_sent_at,
        tier: s.tier
      }))
    });
  } catch (err) {
    console.error('devotional-subscribers error:', err.message);

    // If tables don't exist yet, return empty gracefully
    if (err.message.includes('does not exist')) {
      return res.json({ success: true, count: 0, subscribers: [], note: 'Devotional tables not yet migrated' });
    }

    return res.status(500).json({ error: err.message });
  }
};
