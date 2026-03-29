const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS assessment_progress (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER REFERENCES contacts(id),
        answers JSONB DEFAULT '{}',
        current_question_index INTEGER DEFAULT 0,
        mode TEXT DEFAULT 'individual',
        depth TEXT DEFAULT 'extensive',
        total_questions INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_contact ON assessment_progress(contact_id)
    `;

    return res.json({ success: true, message: 'assessment_progress table created successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  }
};
