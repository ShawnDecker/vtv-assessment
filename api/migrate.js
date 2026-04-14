const { neon } = require('@neondatabase/serverless');

// Consolidated migration endpoint — handles both analytics and digital-purchases migrations
// Route determination: request URL path decides which migration to run

module.exports = async (req, res) => {
  const ALLOWED = ['https://assessment.valuetovictory.com','http://localhost:3000'];
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : (origin.endsWith('.vercel.app') ? origin : ALLOWED[0]));
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Require admin API key for migration endpoints
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Admin API key required' });
  }

  // Determine which migration to run based on the request URL
  const url = req.url || '';
  if (url.includes('migrate-digital-purchases')) {
    return handleDigitalPurchases(req, res);
  } else if (url.includes('migrate-analytics')) {
    return handleAnalytics(req, res);
  } else {
    return res.status(400).json({ error: 'Unknown migration route. Use /api/migrate-analytics or /api/migrate-digital-purchases' });
  }
};

// ── Analytics & Privacy Migration ──────────────────────────────────────────────
async function handleAnalytics(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const results = [];

  // 1. Analytics Events table — tracks all platform events for funnel analysis
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        contact_id INTEGER,
        session_id TEXT,
        metadata JSONB DEFAULT '{}',
        ip_hash TEXT,
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_contact ON analytics_events(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)`;
    results.push({ table: 'analytics_events', status: 'ok' });
  } catch (e) {
    results.push({ table: 'analytics_events', status: 'error', error: e.message });
  }

  // 2. Privacy Preferences table — per-member, per-team visibility controls
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS privacy_preferences (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        team_id INTEGER,
        share_time BOOLEAN DEFAULT true,
        share_people BOOLEAN DEFAULT false,
        share_influence BOOLEAN DEFAULT true,
        share_numbers BOOLEAN DEFAULT false,
        share_knowledge BOOLEAN DEFAULT true,
        share_sub_categories BOOLEAN DEFAULT false,
        share_prescriptions BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(contact_id, team_id)
      )
    `;
    results.push({ table: 'privacy_preferences', status: 'ok' });
  } catch (e) {
    results.push({ table: 'privacy_preferences', status: 'error', error: e.message });
  }

  // 3. Add visibility_consent to team_members if missing
  try {
    await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS visibility_consent BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMP`;
    results.push({ table: 'team_members (consent columns)', status: 'ok' });
  } catch (e) {
    results.push({ table: 'team_members (consent columns)', status: 'error', error: e.message });
  }

  // 4. Add privacy_level to assessments if missing
  try {
    await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'self_only'`;
    results.push({ table: 'assessments (privacy_level)', status: 'ok' });
  } catch (e) {
    results.push({ table: 'assessments (privacy_level)', status: 'error', error: e.message });
  }

  // 5. Funnel tracking views for quick analytics
  try {
    await sql`
      CREATE OR REPLACE VIEW funnel_summary AS
      SELECT
        event_type,
        COUNT(*) as total_events,
        COUNT(DISTINCT contact_id) as unique_contacts,
        COUNT(DISTINCT session_id) as unique_sessions,
        DATE_TRUNC('day', created_at) as event_date
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '90 days'
      GROUP BY event_type, DATE_TRUNC('day', created_at)
      ORDER BY event_date DESC, event_type
    `;
    results.push({ view: 'funnel_summary', status: 'ok' });
  } catch (e) {
    results.push({ view: 'funnel_summary', status: 'error', error: e.message });
  }

  return res.json({
    message: 'Analytics & privacy migration complete',
    results,
    eventTypes: [
      'page_view', 'assessment_started', 'assessment_completed', 'assessment_abandoned',
      'report_viewed', 'report_emailed', 'coaching_requested', 'coaching_enrolled',
      'subscription_created', 'subscription_cancelled', 'team_created', 'team_joined',
      'partner_invited', 'partner_linked', 'challenge_started', 'challenge_completed',
      'hubspot_sync', 'login', 'signup', 'free_book_signup', 'audiobook_purchased'
    ]
  });
}

// ── Digital Purchases Migration ────────────────────────────────────────────────
async function handleDigitalPurchases(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Create digital_purchases table
    await sql`
      CREATE TABLE IF NOT EXISTS digital_purchases (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        stripe_product_id VARCHAR(100),
        stripe_payment_intent VARCHAR(100),
        granted_by VARCHAR(50) DEFAULT 'purchase',
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(email, product_id)
      )
    `;

    // Add indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_dp_email ON digital_purchases(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dp_product ON digital_purchases(product_id)`;

    console.log('[migrate-digital-purchases] Migration completed successfully');

    return res.json({
      success: true,
      message: 'digital_purchases table created successfully with indexes on email and product_id'
    });
  } catch (err) {
    console.error('[migrate-digital-purchases] Migration error:', err);
    return res.status(500).json({ error: err.message });
  }
}
