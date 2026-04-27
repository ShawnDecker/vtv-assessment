// ============================================================================
// GROWTH AGENTS — single Vercel function fanning out to 5 sub-routes.
// Vercel Pro 12-function limit forces consolidation. Routing by req.url path.
//
// Routes:
//   POST /api/growth-agents/intake           PUBLIC (no JWT)
//   POST /api/growth-agents/outreach         JWT
//   POST /api/growth-agents/repurpose        JWT
//   POST /api/growth-agents/calendar-prep    JWT
//   GET  /api/growth-agents/digest?days=1    JWT
// ============================================================================
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { runGrowthAgent } = require('./ai');

// ---- JWT (HMAC-SHA256, mirrors api/index.js verifyJWT) -------------------
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_API_KEY;

function verifyJWT(token) {
  try {
    if (!JWT_SECRET) return null;
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function extractUser(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return verifyJWT(auth.slice(7));
  return null;
}

function isAdminKey(req) {
  const k = req.headers['x-api-key'] || '';
  return !!(process.env.ADMIN_API_KEY && k === process.env.ADMIN_API_KEY);
}

// ---- CORS / shared headers ------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://valuetovictory.com', 'https://www.valuetovictory.com',
  'https://assessment.valuetovictory.com', 'https://shawnedecker.com',
  'http://localhost:3000', 'http://localhost:5173',
];
function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ---- Tone brief loader (optional, from _claude/working/) ------------------
let _toneBriefCache = null;
function loadToneBrief() {
  if (_toneBriefCache !== null) return _toneBriefCache;
  try {
    const p = path.join(process.cwd(), '_claude', 'working', 'agent-connection-brief.md');
    if (fs.existsSync(p)) {
      _toneBriefCache = fs.readFileSync(p, 'utf8').slice(0, 4000);
      return _toneBriefCache;
    }
  } catch {}
  _toneBriefCache = '';
  return '';
}

// ---- Telemetry: persist one growth_agent_runs row -------------------------
async function logRun(sql, row) {
  try {
    await sql`
      INSERT INTO growth_agent_runs
        (intake_id, agent_type, input_json, output_json, engine, latency_ms, error)
      VALUES
        (${row.intake_id || null},
         ${row.agent_type},
         ${row.input_json ? JSON.stringify(row.input_json) : null}::jsonb,
         ${row.output_json ? JSON.stringify(row.output_json) : null}::jsonb,
         ${row.engine || null},
         ${row.latency_ms || null},
         ${row.error || null})
    `;
  } catch (e) {
    console.warn('[growth-agents] logRun failed (non-fatal):', e.message);
  }
}

// ---- Lead Qualifier output validation -------------------------------------
const VALID_TIERS = new Set(['VictoryPath', 'Value Builder', 'Victory VIP']);
function sanitizeQualifierOutput(out, fallbackInput) {
  // Defensive — if model goes off-spec, derive sane defaults so the public
  // /intake endpoint never returns a 500 to a real form submission.
  let score = Number.isFinite(+out?.score) ? Math.max(0, Math.min(100, Math.round(+out.score))) : null;
  let tier  = VALID_TIERS.has(out?.recommended_tier) ? out.recommended_tier : null;
  let actions = Array.isArray(out?.actions) ? out.actions.filter(a => typeof a === 'string').slice(0, 3) : [];

  if (score === null) {
    // Heuristic fallback mirroring the prompt rules.
    const u = +fallbackInput.urgency || 3;
    const budgetCap = { 'none': 35, '<$500': 60, '$500-2000': 80, '>$2000': 100 }[fallbackInput.budget_tier] || 50;
    let s = 50 + (u - 3) * 10;
    if ((fallbackInput.bottleneck || '').length < 30) s -= 10;
    score = Math.max(0, Math.min(budgetCap, s));
  }
  if (!tier) tier = score >= 70 ? 'Victory VIP' : (score >= 40 ? 'Value Builder' : 'VictoryPath');
  while (actions.length < 3) {
    actions.push([
      'Take the free Value Engine assessment at /assessment to surface your weakest pillar.',
      'Book a discovery call with Shawn at https://calendly.com/valuetovictory/',
      `Review the ${tier} tier on /pricing and reply with any questions.`,
    ][actions.length]);
  }
  return { score, recommended_tier: tier, actions };
}

// ============================================================================
// HANDLERS — one per route. All return via res; never throw upward.
// ============================================================================

async function handleIntake(req, res, sql) {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 320);
  const bottleneck = String(body.bottleneck || '').trim().slice(0, 4000);
  const budget_tier = String(body.budget_tier || '').trim();
  const urgency = parseInt(body.urgency, 10);

  // Validation
  if (!name || !email || !bottleneck) {
    return res.status(400).json({ error: 'name, email, and bottleneck are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email format' });
  }
  if (!['none', '<$500', '$500-2000', '>$2000'].includes(budget_tier)) {
    return res.status(400).json({ error: 'budget_tier must be one of: none, <$500, $500-2000, >$2000' });
  }
  if (!Number.isFinite(urgency) || urgency < 1 || urgency > 5) {
    return res.status(400).json({ error: 'urgency must be an integer 1-5' });
  }

  // Insert intake first so we always have a record even if AI fails.
  let intakeId = null;
  try {
    const inserted = await sql`
      INSERT INTO growth_intake (name, email, bottleneck, budget_tier, urgency, status)
      VALUES (${name}, ${email}, ${bottleneck}, ${budget_tier}, ${urgency}, 'new')
      RETURNING id
    `;
    intakeId = inserted[0]?.id;
  } catch (e) {
    return res.status(500).json({ error: 'failed to record intake', detail: e.message });
  }

  // Run Lead Qualifier inline. Failure → return intake with null score; never 5xx the form.
  let qualResult = null;
  let engine = null;
  let latency_ms = null;
  let runError = null;
  try {
    const r = await runGrowthAgent('lead_qualifier', { name, email, bottleneck, budget_tier, urgency });
    qualResult = sanitizeQualifierOutput(r.output, { name, email, bottleneck, budget_tier, urgency });
    engine = r.engine;
    latency_ms = r.latency_ms;
  } catch (e) {
    console.error('[growth-agents/intake] qualifier failed:', e.message);
    runError = e.message;
    qualResult = sanitizeQualifierOutput({}, { name, email, bottleneck, budget_tier, urgency });
  }

  // Persist score + telemetry.
  try {
    await sql`
      UPDATE growth_intake
      SET score = ${qualResult.score},
          recommended_tier = ${qualResult.recommended_tier},
          actions_json = ${JSON.stringify(qualResult.actions)}::jsonb,
          status = ${qualResult.score >= 40 ? 'qualified' : 'new'}
      WHERE id = ${intakeId}
    `;
  } catch (e) {
    console.warn('[growth-agents/intake] score update failed:', e.message);
  }

  await logRun(sql, {
    intake_id: intakeId,
    agent_type: 'lead_qualifier',
    input_json: { name, email, bottleneck, budget_tier, urgency },
    output_json: qualResult,
    engine, latency_ms, error: runError,
  });

  return res.status(200).json({
    intake_id: intakeId,
    score: qualResult.score,
    recommended_tier: qualResult.recommended_tier,
    actions: qualResult.actions,
    engine: engine || 'none',
  });
}

async function handleOutreach(req, res, sql) {
  const body = req.body || {};
  const intakeId = parseInt(body.intake_id, 10);
  if (!Number.isFinite(intakeId)) return res.status(400).json({ error: 'intake_id required (integer)' });

  const rows = await sql`SELECT * FROM growth_intake WHERE id = ${intakeId} LIMIT 1`;
  if (rows.length === 0) return res.status(404).json({ error: 'intake not found' });
  const intake = rows[0];

  const tone_brief = loadToneBrief();
  const input = {
    name: intake.name, email: intake.email, bottleneck: intake.bottleneck,
    budget_tier: intake.budget_tier, urgency: intake.urgency,
    score: intake.score, recommended_tier: intake.recommended_tier,
    tone_brief,
  };

  let r, runError = null;
  try {
    r = await runGrowthAgent('outreach_drafter', input);
  } catch (e) {
    runError = e.message;
    await logRun(sql, { intake_id: intakeId, agent_type: 'outreach_drafter', input_json: input, error: runError });
    return res.status(502).json({ error: 'outreach draft failed', detail: e.message });
  }

  await logRun(sql, {
    intake_id: intakeId,
    agent_type: 'outreach_drafter',
    input_json: input,
    output_json: r.output,
    engine: r.engine, latency_ms: r.latency_ms,
  });

  return res.status(200).json({ intake_id: intakeId, ...r.output, engine: r.engine });
}

async function handleRepurpose(req, res, sql) {
  const body = req.body || {};
  const source = String(body.source || '').trim();
  if (!source) return res.status(400).json({ error: 'source required (markdown or URL)' });
  if (source.length > 20000) return res.status(400).json({ error: 'source too long (max 20000 chars)' });

  let r, runError = null;
  try {
    r = await runGrowthAgent('content_repurposer', { source });
  } catch (e) {
    runError = e.message;
    await logRun(sql, { agent_type: 'content_repurposer', input_json: { source_len: source.length }, error: runError });
    return res.status(502).json({ error: 'repurpose failed', detail: e.message });
  }

  await logRun(sql, {
    agent_type: 'content_repurposer',
    input_json: { source_len: source.length, source_preview: source.slice(0, 200) },
    output_json: r.output,
    engine: r.engine, latency_ms: r.latency_ms,
  });

  return res.status(200).json({ ...r.output, engine: r.engine });
}

async function handleCalendarPrep(req, res, sql) {
  const payload = req.body || {};
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    return res.status(400).json({ error: 'Calendly payload required in body' });
  }

  // Try to find a matching intake by email so the brief is data-rich.
  const email = (payload.payload?.email || payload.email || payload.invitee?.email || '').toLowerCase();
  let intakeId = null;
  if (email) {
    try {
      const rows = await sql`SELECT id FROM growth_intake WHERE email = ${email} ORDER BY created_at DESC LIMIT 1`;
      if (rows.length) intakeId = rows[0].id;
    } catch {}
  }

  let r, runError = null;
  try {
    r = await runGrowthAgent('calendar_concierge', payload);
  } catch (e) {
    runError = e.message;
    await logRun(sql, { intake_id: intakeId, agent_type: 'calendar_concierge', input_json: payload, error: runError });
    return res.status(502).json({ error: 'calendar prep failed', detail: e.message });
  }

  // Bump intake to booked if matched.
  if (intakeId) {
    try {
      await sql`UPDATE growth_intake SET status = 'booked', last_contact_at = NOW() WHERE id = ${intakeId}`;
    } catch {}
  }

  await logRun(sql, {
    intake_id: intakeId,
    agent_type: 'calendar_concierge',
    input_json: payload,
    output_json: r.output,
    engine: r.engine, latency_ms: r.latency_ms,
  });

  return res.status(200).json({ intake_id: intakeId, ...r.output, engine: r.engine });
}

async function handleDigest(req, res, sql) {
  const url = new URL(req.url, `http://${req.headers.host || 'x'}`);
  const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') || '1', 10) || 1));
  const startedAt = Date.now();

  // Single round-trip, multiple aggregates.
  const [intakeStats, qualifiedRow, bookedRow, stalledRows, recentLeads] = await Promise.all([
    sql`SELECT COUNT(*)::int AS cnt FROM growth_intake WHERE created_at > NOW() - (${days} || ' days')::interval`,
    sql`SELECT COUNT(*)::int AS cnt FROM growth_intake WHERE created_at > NOW() - (${days} || ' days')::interval AND status IN ('qualified','contacted','booked','closed')`,
    sql`SELECT COUNT(*)::int AS cnt FROM growth_intake WHERE created_at > NOW() - (${days} || ' days')::interval AND status = 'booked'`,
    sql`SELECT id, name, email, recommended_tier, score, created_at, last_contact_at
        FROM growth_intake
        WHERE status NOT IN ('closed', 'booked')
          AND COALESCE(last_contact_at, created_at) < NOW() - INTERVAL '7 days'
        ORDER BY COALESCE(last_contact_at, created_at) ASC
        LIMIT 50`,
    sql`SELECT id, name, email, score, recommended_tier, status, created_at
        FROM growth_intake
        WHERE created_at > NOW() - (${days} || ' days')::interval
        ORDER BY created_at DESC
        LIMIT 25`,
  ]);

  const result = {
    window_days: days,
    leads_in: intakeStats[0]?.cnt || 0,
    qualified: qualifiedRow[0]?.cnt || 0,
    booked: bookedRow[0]?.cnt || 0,
    stalled_count: stalledRows.length,
    stalled: stalledRows,
    recent: recentLeads,
    generated_at: new Date().toISOString(),
  };

  await logRun(sql, {
    agent_type: 'pipeline_reporter',
    input_json: { days },
    output_json: { leads_in: result.leads_in, qualified: result.qualified, booked: result.booked, stalled_count: result.stalled_count },
    engine: 'sql',
    latency_ms: Date.now() - startedAt,
  });

  return res.status(200).json(result);
}

// ============================================================================
// MAIN HANDLER — sub-route dispatch by req.url path.
// ============================================================================
module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'x'}`);
  const sub = url.pathname.replace(/^\/api\/growth-agents/, '').replace(/^\//, '').replace(/\/+$/, '');

  const sql = neon(process.env.DATABASE_URL);

  try {
    // PUBLIC route
    if (sub === 'intake') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      return await handleIntake(req, res, sql);
    }

    // JWT-protected routes (admin key OR member JWT)
    const isAdmin = isAdminKey(req);
    const user = isAdmin ? null : extractUser(req);
    if (!isAdmin && !user) return res.status(401).json({ error: 'Unauthorized' });

    if (sub === 'outreach') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      return await handleOutreach(req, res, sql);
    }
    if (sub === 'repurpose') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      return await handleRepurpose(req, res, sql);
    }
    if (sub === 'calendar-prep') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      return await handleCalendarPrep(req, res, sql);
    }
    if (sub === 'digest') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
      return await handleDigest(req, res, sql);
    }

    return res.status(404).json({
      error: `unknown sub-route: ${sub || '(empty)'}`,
      valid: ['intake (POST, public)', 'outreach (POST)', 'repurpose (POST)', 'calendar-prep (POST)', 'digest (GET)'],
    });

  } catch (err) {
    console.error('[growth-agents] unhandled error:', err);
    return res.status(500).json({ error: 'growth-agents service error', detail: err.message });
  }
};

// Exports for tests (so dry-run can assert handler functions exist).
module.exports.handleIntake = handleIntake;
module.exports.handleOutreach = handleOutreach;
module.exports.handleRepurpose = handleRepurpose;
module.exports.handleCalendarPrep = handleCalendarPrep;
module.exports.handleDigest = handleDigest;
module.exports.sanitizeQualifierOutput = sanitizeQualifierOutput;
module.exports.verifyJWT = verifyJWT;
