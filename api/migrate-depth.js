// Migration: Add depth and focus_pillar columns to assessments table
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Add depth column (nullable, default 'extensive' so existing data keeps working)
    await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS depth TEXT DEFAULT 'extensive'`;

    // Add focus_pillar column (nullable, for single-pillar deep-dive assessments)
    await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS focus_pillar TEXT`;

    res.json({
      success: true,
      message: 'Migration complete: added depth and focus_pillar columns to assessments table',
    });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
};
