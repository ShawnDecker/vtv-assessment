const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS free_book_signups (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_free_book_email ON free_book_signups (email)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_free_book_token ON free_book_signups (token)
  `;

  res.json({ success: true, message: 'Free book signups table created' });
};
