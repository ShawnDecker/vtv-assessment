const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const ALLOWED = ['https://assessment.valuetovictory.com','http://localhost:3000'];
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Require admin API key for migration endpoints
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Admin API key required' });
  }

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
};
