const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const sql = neon(process.env.DATABASE_URL);
  const results = [];

  // 1. birthday_rewards — opt-in storage with partner consent JSONB
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS birthday_rewards (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL UNIQUE,
        birth_month INTEGER NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
        birth_day INTEGER NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
        birth_year INTEGER,
        reward_optin BOOLEAN DEFAULT true,
        partner_consent JSONB DEFAULT '{}',
        last_reward_sent_at TIMESTAMP,
        last_reward_year INTEGER,
        zip_code TEXT,
        consent_ip_hash TEXT,
        consent_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_birthday_month_day ON birthday_rewards(birth_month, birth_day)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_birthday_optin ON birthday_rewards(reward_optin) WHERE reward_optin = true`;
    results.push({ table: 'birthday_rewards', status: 'ok' });
  } catch (e) {
    results.push({ table: 'birthday_rewards', status: 'error', error: e.message });
  }

  // 2. partner_brands — scaffolded for future, inactive at launch
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS partner_brands (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        logo_url TEXT,
        website TEXT,
        category TEXT,
        values_alignment TEXT[],
        geo_zone TEXT,
        offer_template TEXT,
        contact_email TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'rejected')),
        contract_start DATE,
        contract_end DATE,
        revenue_model TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push({ table: 'partner_brands', status: 'ok' });
  } catch (e) {
    results.push({ table: 'partner_brands', status: 'error', error: e.message });
  }

  // 3. birthday_reward_log — audit trail of every coupon sent
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS birthday_reward_log (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        partner_brand_id INTEGER,
        coupon_code TEXT,
        coupon_value TEXT,
        sent_at TIMESTAMP DEFAULT NOW(),
        redeemed_at TIMESTAMP,
        email_status TEXT DEFAULT 'sent',
        metadata JSONB DEFAULT '{}'
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_birthday_log_contact ON birthday_reward_log(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_birthday_log_sent ON birthday_reward_log(sent_at)`;
    results.push({ table: 'birthday_reward_log', status: 'ok' });
  } catch (e) {
    results.push({ table: 'birthday_reward_log', status: 'error', error: e.message });
  }

  // 4. Seed sample partners (status='pending', not active until manually approved)
  try {
    const samplePartners = [
      { slug: 'carna', name: 'Carna Coaching', category: 'fitness', values: ['health','accountability','faith'], offer: '20% off first month' },
      { slug: 'rfm-bookstore', name: 'Running From Miracles', category: 'books', values: ['faith','testimony'], offer: 'Free signed copy on $20+' },
      { slug: 'kbf', name: 'KBF Tournaments', category: 'events', values: ['outdoors','community'], offer: '$25 off entry fee' },
      { slug: 'rc-ministry', name: 'Righteous Connections', category: 'ministry', values: ['faith','community','crisis-care'], offer: 'Free crisis resource pack' }
    ];
    for (const p of samplePartners) {
      await sql`INSERT INTO partner_brands (slug, name, category, values_alignment, offer_template, status)
        VALUES (${p.slug}, ${p.name}, ${p.category}, ${p.values}, ${p.offer}, 'pending')
        ON CONFLICT (slug) DO NOTHING`;
    }
    results.push({ seed: 'partner_brands', status: 'ok', count: samplePartners.length });
  } catch (e) {
    results.push({ seed: 'partner_brands', status: 'error', error: e.message });
  }

  return res.json({
    message: 'Birthday rewards + partner marketplace migration complete',
    results,
    architecture: {
      first_party_active: 'VTV-branded coupon to opt-in members on their birthday',
      partner_marketplace: 'Scaffolded but DEFERRED until 1,000+ opt-ins (per Council 2026-05-02)',
      consent_model: 'Per-partner explicit consent (named brands, not blanket toggles)',
      regulatory: 'COPPA-safe (no under-13 collection), CAN-SPAM compliant, revocable any time'
    }
  });
};
