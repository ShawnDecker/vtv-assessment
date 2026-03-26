const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Create table if it doesn't exist (may fail on FK if assessments table schema changed — non-fatal for existing tables)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS coaching_requests (
          id SERIAL PRIMARY KEY,
          assessment_id TEXT REFERENCES assessments(id),
          contact_id INTEGER REFERENCES contacts(id),
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          track TEXT NOT NULL CHECK (track IN ('real_estate', 'personal', 'company')),
          goals TEXT NOT NULL,
          questions TEXT NOT NULL,
          biggest_challenge TEXT NOT NULL,
          re_years TEXT,
          re_specialty TEXT,
          re_volume TEXT,
          company_name TEXT,
          company_role TEXT,
          company_size TEXT,
          company_department TEXT,
          verification_token TEXT UNIQUE,
          verified BOOLEAN DEFAULT FALSE,
          verified_at TIMESTAMPTZ,
          report_sent BOOLEAN DEFAULT FALSE,
          report_sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
    } catch (createErr) {
      // Table likely already exists — continue with ALTER statements
      console.log('CREATE TABLE skipped (table exists):', createErr.message);
    }

    // Add indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_coaching_requests_token ON coaching_requests(verification_token)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_coaching_requests_email ON coaching_requests(email)`;

    // Add company columns if they don't exist (for existing tables)
    await sql`ALTER TABLE coaching_requests ADD COLUMN IF NOT EXISTS company_name TEXT`;
    await sql`ALTER TABLE coaching_requests ADD COLUMN IF NOT EXISTS company_role TEXT`;
    await sql`ALTER TABLE coaching_requests ADD COLUMN IF NOT EXISTS company_size TEXT`;
    await sql`ALTER TABLE coaching_requests ADD COLUMN IF NOT EXISTS company_department TEXT`;

    // Update CHECK constraint to include 'company' track
    await sql`ALTER TABLE coaching_requests DROP CONSTRAINT IF EXISTS coaching_requests_track_check`;
    await sql`ALTER TABLE coaching_requests ADD CONSTRAINT coaching_requests_track_check CHECK (track IN ('real_estate', 'personal', 'company'))`;

    return res.json({ success: true, message: 'coaching_requests table migrated successfully (includes company track)' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  }
};
