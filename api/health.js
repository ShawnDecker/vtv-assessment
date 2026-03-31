const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  const timestamp = new Date().toISOString();
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'unknown';

  let dbStatus = 'error';
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp,
    db: dbStatus,
    version,
    adminKeySet: !!process.env.ADMIN_API_KEY,
    adminKeyLength: (process.env.ADMIN_API_KEY || '').length,
  });
};
