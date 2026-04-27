// Migration: Growth Agents tables (intake + agent-run telemetry).
// Idempotent — safe to run repeatedly. Works two ways:
//   1) HTTP — POST /api/migrate-growth-agents (Vercel function pattern)
//   2) CLI  — `node migrations/migrate-growth-agents.js` (uses DATABASE_URL env)
const { neon } = require('@neondatabase/serverless');

async function runMigration(sql) {
  // ---- growth_intake -------------------------------------------------------
  // PUBLIC-facing capture from /growth-intake.html. score / recommended_tier /
  // actions_json are populated synchronously by Lead Qualifier before response.
  await sql`
    CREATE TABLE IF NOT EXISTS growth_intake (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      bottleneck TEXT NOT NULL,
      budget_tier TEXT NOT NULL CHECK (budget_tier IN ('none', '<$500', '$500-2000', '>$2000')),
      urgency INTEGER NOT NULL CHECK (urgency BETWEEN 1 AND 5),
      score INTEGER,
      recommended_tier TEXT,
      actions_json JSONB DEFAULT '[]'::jsonb,
      status TEXT DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'contacted', 'booked', 'closed', 'stalled')),
      last_contact_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_growth_intake_email ON growth_intake(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_growth_intake_status_created ON growth_intake(status, created_at DESC)`;

  // ---- growth_agent_runs ---------------------------------------------------
  // One row per agent invocation. `engine` is "ollama:<model>" or
  // "anthropic:<model>" so cost analysis can group by provider.
  await sql`
    CREATE TABLE IF NOT EXISTS growth_agent_runs (
      id SERIAL PRIMARY KEY,
      intake_id INTEGER REFERENCES growth_intake(id) ON DELETE SET NULL,
      agent_type TEXT NOT NULL CHECK (agent_type IN (
        'lead_qualifier', 'outreach_drafter', 'content_repurposer',
        'calendar_concierge', 'pipeline_reporter'
      )),
      input_json JSONB,
      output_json JSONB,
      engine TEXT,
      latency_ms INTEGER,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_growth_agent_runs_intake_created ON growth_agent_runs(intake_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_growth_agent_runs_type_created ON growth_agent_runs(agent_type, created_at DESC)`;

  return {
    tables: ['growth_intake', 'growth_agent_runs'],
    indexes: [
      'idx_growth_intake_email',
      'idx_growth_intake_status_created',
      'idx_growth_agent_runs_intake_created',
      'idx_growth_agent_runs_type_created',
    ],
  };
}

// HTTP handler (Vercel)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const sql = neon(process.env.DATABASE_URL);
  try {
    const result = await runMigration(sql);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[migrate-growth-agents] failed:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.runMigration = runMigration;

// CLI entry — `node migrations/migrate-growth-agents.js`
if (require.main === module) {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set — cannot run migration');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  runMigration(sql)
    .then((r) => { console.log('Migration OK:', JSON.stringify(r, null, 2)); process.exit(0); })
    .catch((e) => { console.error('Migration FAILED:', e); process.exit(1); });
}
