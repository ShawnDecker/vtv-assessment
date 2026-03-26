const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS coaching_requests (
        id SERIAL PRIMARY KEY,
        assessment_id TEXT REFERENCES assessments(id),
        contact_id INTEGER REFERENCES contacts(id),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        track TEXT NOT NULL CHECK (track IN ('real_estate', 'personal')),
        goals TEXT NOT NULL,
        questions TEXT NOT NULL,
        biggest_challenge TEXT NOT NULL,
        re_years TEXT,
        re_specialty TEXT,
        re_volume TEXT,
        verification_token TEXT UNIQUE,
        verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMPTZ,
        report_sent BOOLEAN DEFAULT FALSE,
        report_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Add indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_coaching_requests_token ON coaching_requests(verification_token)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_coaching_requests_email ON coaching_requests(email)`;

    return res.json({ success: true, message: 'coaching_requests table created successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  }
};
