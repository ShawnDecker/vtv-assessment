const { neon } = require('@neondatabase/serverless');

// ============================================================================
// ZYRIX AI ROUTING — api/ai.js
// Tier router: routes between Haiku 4.5 (small/cheap) and Opus 4.7 (frontier)
// based on action + complexity signals. Falls back Opus → Haiku on 429/5xx.
// Ollama local path preserved for dev/non-customer tasks.
// Logs every call to model_invocations for cost/latency visibility.
// ============================================================================

// --- Local Ollama models ---------------------------------------------------
// Updated 2026-04-20 to match models actually installed on the dev machine.
// Override any via env vars (e.g., LOCAL_MODEL_COACHING=mistral-small).
const LOCAL_MODELS = {
  'coaching-insight':    process.env.LOCAL_MODEL_COACHING    || 'qwen3:8b',
  'assessment-summary':  process.env.LOCAL_MODEL_SUMMARY     || 'mistral-small',
  'email-draft':         process.env.LOCAL_MODEL_EMAIL       || 'qwen3:8b',
  'content-generate':    process.env.LOCAL_MODEL_CONTENT     || 'qwen3:8b',
  'devotional-generate': process.env.LOCAL_MODEL_DEVOTIONAL  || 'mistral-small',
};
const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://localhost:11434';

// --- Anthropic tier router -------------------------------------------------
const SMALL_MODEL    = process.env.ZYRIX_SMALL_MODEL    || 'claude-haiku-4-5';
const FRONTIER_MODEL = process.env.ZYRIX_FRONTIER_MODEL || 'claude-opus-4-7';

// USD per 1M tokens (April 2026 list prices).
const PRICES = {
  'claude-haiku-4-5':  { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7':   { input: 5.0, output: 25.0 },
};

let _anthropic = null;
function getAnthropic() {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// Per-action tier defaults. context.tier override wins. Complexity signals
// escalate content-generate to frontier when the prompt looks hard.
function pickTier(action, prompt, context) {
  if (context?.tier === 'small' || context?.tier === 'frontier') return context.tier;
  const defaults = {
    'coaching-insight':    'small',
    'assessment-summary':  'small',
    'devotional-generate': 'small',
    'content-generate':    'small',
    'email-draft':         'frontier',   // writes as Shawn's persona — accuracy matters
  };
  let tier = defaults[action] || 'small';
  if (action === 'content-generate' && prompt) {
    if (prompt.length > 2500) tier = 'frontier';
    if (/analyze|strategy|comprehensive|deep dive|step[- ]by[- ]step/i.test(prompt)) tier = 'frontier';
  }
  return tier;
}

async function callAnthropicTier(tier, systemPrompt, userPrompt, opts = {}) {
  const client = getAnthropic();
  if (!client) {
    const e = new Error('ANTHROPIC_API_KEY not set');
    e.status = 500;
    throw e;
  }
  const model = tier === 'frontier' ? FRONTIER_MODEL : SMALL_MODEL;
  const start = Date.now();

  // cache_control is a no-op below each model's minimum cacheable prefix
  // (4096 tokens for Haiku/Opus, 2048 for Sonnet). Current system prompts
  // are ~500 tokens — caching activates automatically once prompts grow
  // past 4K. The marker is cheap to leave in now.
  const params = {
    model,
    max_tokens: opts.max_tokens || 1024,
    system: [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userPrompt }],
  };

  const response = await client.messages.create(params);
  const latency_ms = Date.now() - start;
  const textBlock = (response.content || []).find(b => b.type === 'text');
  const content = textBlock?.text || '';
  const u = response.usage || {};
  const usage = {
    input_tokens:       u.input_tokens || 0,
    output_tokens:      u.output_tokens || 0,
    cache_read_tokens:  u.cache_read_input_tokens || 0,
    cache_write_tokens: u.cache_creation_input_tokens || 0,
  };
  return { content, model, tier, latency_ms, usage };
}

// Cache reads ~0.1x base input price, cache writes ~1.25x (5-min TTL).
function estimateCostUsd(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return null;
  const inputCost =
      (usage.input_tokens       * p.input
     + usage.cache_write_tokens * p.input * 1.25
     + usage.cache_read_tokens  * p.input * 0.1) / 1_000_000;
  const outputCost = (usage.output_tokens * p.output) / 1_000_000;
  return +(inputCost + outputCost).toFixed(6);
}

// --- Telemetry: model_invocations table ------------------------------------
// Self-migrates on first call per function cold-start. Failure non-fatal.
let _telemetryReady = false;
async function ensureModelInvocationsTable(sql) {
  if (_telemetryReady) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS model_invocations (
      id SERIAL PRIMARY KEY,
      caller TEXT,
      action TEXT,
      model TEXT NOT NULL,
      tier TEXT,
      provider TEXT DEFAULT 'anthropic',
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(10, 6),
      latency_ms INTEGER,
      success BOOLEAN DEFAULT TRUE,
      escalated_from TEXT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_model_invocations_created ON model_invocations(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_model_invocations_model ON model_invocations(model)`;
    _telemetryReady = true;
  } catch (e) {
    console.error('[model_invocations] migration failed (non-fatal):', e.message);
  }
}

async function logInvocation(sql, f) {
  try {
    await sql`INSERT INTO model_invocations
      (caller, action, model, tier, provider, tokens_in, tokens_out,
       cache_read_tokens, cache_write_tokens, cost_usd, latency_ms,
       success, escalated_from, error_message)
      VALUES
      (${f.caller || null}, ${f.action}, ${f.model}, ${f.tier || null},
       ${f.provider || 'anthropic'}, ${f.tokens_in || 0}, ${f.tokens_out || 0},
       ${f.cache_read_tokens || 0}, ${f.cache_write_tokens || 0},
       ${f.cost_usd}, ${f.latency_ms || 0},
       ${f.success !== false}, ${f.escalated_from || null}, ${f.error_message || null})`;
  } catch (e) {
    console.warn('[model_invocations] log failed (non-fatal):', e.message);
  }
}

// --- Ollama availability check --------------------------------------------
async function isOllamaAvailable() {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch { return false; }
}

// ========== AUTH HELPERS ==========
// Inline JWT verify — matches createJWT / verifyJWT in api/index.js.
// Kept local so api/ai.js stays independent (Vercel bundles each function separately).
const crypto = require('crypto');
function verifyJwtLocal(token) {
  try {
    const secret = process.env.JWT_SECRET || process.env.ADMIN_API_KEY;
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    if (expected.length !== s.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ s.charCodeAt(i);
    if (diff !== 0) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
function extractJwtUser(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyJwtLocal(m[1]);
}

// Actions a member JWT is allowed to invoke. Admin x-api-key can invoke any action.
const JWT_ALLOWED_ACTIONS = new Set(['health', 'coaching-insight', 'assessment-summary']);

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth: x-api-key (admin, all actions) OR JWT Bearer (member, allowlisted actions + own data only)
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  const isAdmin = !!(validKey && apiKey === validKey);
  const jwtUser = isAdmin ? null : extractJwtUser(req);
  if (!isAdmin && !jwtUser) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const sql = neon(process.env.DATABASE_URL);
  const { action, contactId, assessmentId, prompt, context } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action required' });

  // Member JWT scope enforcement — admin bypasses
  if (jwtUser) {
    if (!JWT_ALLOWED_ACTIONS.has(action)) {
      return res.status(403).json({ error: 'This action requires admin auth', allowed: [...JWT_ALLOWED_ACTIONS] });
    }
    if (action === 'coaching-insight' && contactId && String(contactId) !== String(jwtUser.contactId)) {
      return res.status(403).json({ error: 'Can only request coaching insight for your own profile' });
    }
    if (action === 'assessment-summary' && assessmentId) {
      const own = await sql`SELECT 1 FROM assessments WHERE id = ${assessmentId} AND contact_id = ${jwtUser.contactId} LIMIT 1`;
      if (own.length === 0) return res.status(403).json({ error: 'Assessment does not belong to you' });
    }
  }

  const caller = isAdmin ? 'admin' : `member:${jwtUser?.contactId || '?'}`;

  // === ACTION: health — AI provider status (no LLM call) ===
  if (action === 'health') {
    const ollamaUp = await isOllamaAvailable();
    let ollamaModels = [];
    if (ollamaUp) {
      try {
        const resp = await fetch(`${OLLAMA_HOST}/api/tags`);
        const data = await resp.json();
        ollamaModels = (data.models || []).map(m => m.name);
      } catch {}
    }
    return res.json({
      ollama: { available: ollamaUp, host: OLLAMA_HOST, models: ollamaModels },
      anthropic: { configured: !!process.env.ANTHROPIC_API_KEY, small: SMALL_MODEL, frontier: FRONTIER_MODEL },
      taskModels: LOCAL_MODELS,
    });
  }

  try {
    let systemPrompt = '';
    let userPrompt = '';

    // === ACTION: coaching-insight ===
    if (action === 'coaching-insight') {
      if (!contactId) return res.status(400).json({ error: 'contactId required' });
      const contacts = await sql`SELECT * FROM contacts WHERE id = ${contactId} LIMIT 1`;
      if (contacts.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const contact = contacts[0];
      const assessments = await sql`SELECT * FROM assessments WHERE contact_id = ${contactId} ORDER BY completed_at DESC LIMIT 3`;
      const coaching = await sql`SELECT * FROM coaching_sequences WHERE contact_id = ${contactId} ORDER BY created_at DESC LIMIT 5`;

      systemPrompt = `You are a faith-based life coach using the Value to Victory 5-pillar framework (Time, People, Influence, Numbers, Knowledge). Each pillar scores 0-50. Total master score ranges 0-250. Score ranges: CRISIS (0-50), SURVIVAL (51-100), GROWTH (101-150), MOMENTUM (151-200), MASTERY (201-250). Provide specific, actionable coaching. Be encouraging but direct. Reference scripture when relevant. Keep response under 300 words.`;

      const latest = assessments[0];
      userPrompt = `Generate a personalized coaching insight for ${contact.first_name || 'this person'}.

${latest ? `Latest Assessment (${latest.completed_at}):
- Master Score: ${latest.master_score} (${latest.score_range})
- Time: ${latest.time_total}/50
- People: ${latest.people_total}/50
- Influence: ${latest.influence_total}/50
- Numbers: ${latest.numbers_total}/50
- Knowledge: ${latest.knowledge_total}/50
- Weakest Pillar: ${latest.weakest_pillar}
- Assessment Depth: ${latest.depth || 'extensive'}` : 'No assessment completed yet.'}

${assessments.length > 1 ? `Previous score: ${assessments[1].master_score} (${assessments[1].score_range})` : ''}
${coaching.length > 0 ? `Active coaching: ${coaching.length} sequences` : 'No coaching sequences yet.'}

Focus on their weakest pillar and give 2-3 specific next steps.`;
    }

    // === ACTION: assessment-summary ===
    else if (action === 'assessment-summary') {
      if (!assessmentId) return res.status(400).json({ error: 'assessmentId required' });
      const rows = await sql`SELECT a.*, c.first_name, c.last_name FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${assessmentId} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = rows[0];
      const answers = await sql`SELECT * FROM answer_history WHERE assessment_id = ${assessmentId} ORDER BY question_number`;

      systemPrompt = `You are a Value to Victory assessment analyst. Write a professional, encouraging narrative summary of this person's assessment results. Be specific about strengths and growth areas. Include faith-based encouragement. Keep it under 250 words.`;

      userPrompt = `Write a narrative summary for ${a.first_name || 'this person'}:
- Master Score: ${a.master_score}/250 (${a.score_range})
- Time: ${a.time_total}/50 | People: ${a.people_total}/50 | Influence: ${a.influence_total}/50
- Numbers: ${a.numbers_total}/50 | Knowledge: ${a.knowledge_total}/50
- Weakest: ${a.weakest_pillar} | Strongest: ${a.strongest_pillar || 'N/A'}
- Mode: ${a.mode || 'individual'} | Depth: ${a.depth || 'extensive'}
- ${answers.length} questions answered`;
    }

    // === ACTION: email-draft ===
    else if (action === 'email-draft') {
      if (!contactId) return res.status(400).json({ error: 'contactId required' });
      const contacts = await sql`SELECT * FROM contacts WHERE id = ${contactId} LIMIT 1`;
      if (contacts.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const contact = contacts[0];
      const assessments = await sql`SELECT * FROM assessments WHERE contact_id = ${contactId} ORDER BY completed_at DESC LIMIT 1`;
      const latest = assessments[0];

      const emailType = context?.emailType || 'coaching';

      systemPrompt = `You are Shawn Decker, a Navy veteran, certified appraiser, author, and faith-based life coach. You created the Value to Victory framework. Write in a warm but direct tone. You're real, not salesy. Use "you" language. Sign off as "Shawn". Keep emails under 200 words. Do not use emojis.`;

      userPrompt = `Write a ${emailType} email for ${contact.first_name || 'friend'}.
${latest ? `Their score: ${latest.master_score} (${latest.score_range}). Weakest pillar: ${latest.weakest_pillar}.` : 'They haven\'t taken an assessment yet.'}
${context?.topic ? `Topic focus: ${context.topic}` : ''}
${context?.tone ? `Tone: ${context.tone}` : ''}`;
    }

    // === ACTION: content-generate ===
    else if (action === 'content-generate') {
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      systemPrompt = `You are an AI assistant for Value to Victory, a faith-based personal development platform. The 5 pillars are Time, People, Influence, Numbers, and Knowledge. Be helpful, professional, and aligned with Christian values. Keep responses concise.`;
      userPrompt = prompt;
    }

    // === ACTION: devotional-generate ===
    else if (action === 'devotional-generate') {
      const pillar = context?.pillar || 'Time';
      const theme = context?.theme || '';

      systemPrompt = `You are a devotional writer for Value to Victory. Write faith-based daily devotionals tied to one of the 5 pillars (Time, People, Influence, Numbers, Knowledge). Include a Bible verse, a reflection (100-150 words), and a practical action step. Tone: warm, encouraging, real.`;

      userPrompt = `Write a daily devotional for the "${pillar}" pillar.${theme ? ` Theme: ${theme}` : ''} Include: title, scripture reference, reflection, and one action step.`;
    }

    else {
      return res.status(400).json({ error: `Unknown action: ${action}. Valid: health, coaching-insight, assessment-summary, email-draft, content-generate, devotional-generate` });
    }

    // ========== ROUTE TO PROVIDER ==========
    // Priority: context.provider > AI_PROVIDER env > 'cloud'
    const requestProvider = context?.provider;
    const envProvider = process.env.AI_PROVIDER || 'cloud';
    const useLocal = requestProvider === 'ollama' || requestProvider === 'local'
      || (envProvider === 'local')
      || (envProvider === 'auto' && await isOllamaAvailable());

    await ensureModelInvocationsTable(sql);

    let content = '';
    let modelUsed = '';
    let usage = {};
    let tier = null;
    let provider = null;
    let escalated_from = null;
    const reqStart = Date.now();

    if (useLocal) {
      // Ollama local path
      const ollamaModel = context?.model || LOCAL_MODELS[action] || process.env.OLLAMA_MODEL || 'qwen3:8b';
      try {
        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: false,
            options: { temperature: 0.7 }
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);
        const ollamaData = await ollamaRes.json();
        content = ollamaData.message?.content || '';
        modelUsed = `ollama/${ollamaModel}`;
        usage = {
          input_tokens:  ollamaData.prompt_eval_count || 0,
          output_tokens: ollamaData.eval_count || 0,
        };
        tier = 'local';
        provider = 'ollama';
      } catch (ollamaErr) {
        // Fallback: Anthropic tier router
        console.warn('Ollama failed, falling back to Anthropic:', ollamaErr.message);
        tier = pickTier(action, prompt, context);
        try {
          const r = await callAnthropicTier(tier, systemPrompt, userPrompt);
          content = r.content;
          modelUsed = r.model + ' (ollama-fallback)';
          usage = r.usage;
          provider = 'anthropic';
          escalated_from = 'ollama';
        } catch (err) {
          await logInvocation(sql, {
            caller, action, model: 'unknown', tier, provider: 'anthropic',
            latency_ms: Date.now() - reqStart, success: false,
            error_message: `ollama+anthropic both failed: ${ollamaErr.message} | ${err.message}`,
          });
          return res.status(502).json({ error: 'Local and cloud AI both failed', detail: err.message });
        }
      }
    } else {
      // Anthropic direct with tier router
      tier = pickTier(action, prompt, context);
      provider = 'anthropic';
      try {
        const r = await callAnthropicTier(tier, systemPrompt, userPrompt);
        content = r.content;
        modelUsed = r.model;
        usage = r.usage;
      } catch (err) {
        // Auto-fallback: frontier 429/529/5xx → small
        const status = err?.status || err?.response?.status;
        if (tier === 'frontier' && (status === 429 || status === 529 || (status >= 500 && status < 600))) {
          console.warn(`Frontier tier failed (${status}), falling back to small`);
          try {
            const r = await callAnthropicTier('small', systemPrompt, userPrompt);
            content = r.content;
            modelUsed = r.model + ' (frontier-fallback)';
            usage = r.usage;
            escalated_from = 'frontier';
            tier = 'small';
          } catch (err2) {
            await logInvocation(sql, {
              caller, action, model: SMALL_MODEL, tier: 'small', provider,
              latency_ms: Date.now() - reqStart, success: false,
              error_message: `frontier+small both failed: ${err.message} | ${err2.message}`,
            });
            return res.status(502).json({ error: 'AI call failed (both tiers)', detail: err2.message });
          }
        } else {
          await logInvocation(sql, {
            caller, action, model: tier === 'frontier' ? FRONTIER_MODEL : SMALL_MODEL,
            tier, provider, latency_ms: Date.now() - reqStart, success: false,
            error_message: err.message,
          });
          return res.status(502).json({ error: 'AI call failed', detail: err.message });
        }
      }
    }

    // Log successful invocation
    const rawModel = modelUsed.replace(' (ollama-fallback)', '').replace(' (frontier-fallback)', '').replace(/^ollama\//, '');
    const cost_usd = provider === 'anthropic' ? estimateCostUsd(rawModel, usage) : null;
    await logInvocation(sql, {
      caller, action, model: modelUsed, tier, provider,
      tokens_in:          usage.input_tokens || 0,
      tokens_out:         usage.output_tokens || 0,
      cache_read_tokens:  usage.cache_read_tokens || 0,
      cache_write_tokens: usage.cache_write_tokens || 0,
      cost_usd,
      latency_ms: Date.now() - reqStart,
      success: true,
      escalated_from,
    });

    // Trigger n8n webhook if configured (fire-and-forget)
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl && context?.triggerN8n !== false) {
      try {
        fetch(n8nUrl.replace('/stripe-webhook', '/ai-content'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, content, contactId, model: modelUsed, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(5000)
        }).catch(() => {});
      } catch {}
    }

    return res.json({
      action, content,
      model: modelUsed,
      tier,
      provider,
      usage,
      cost_usd,
      escalated_from,
    });

  } catch (err) {
    console.error('[api/ai] unhandled error:', err);
    return res.status(500).json({ error: 'AI service error', detail: err.message });
  }
};
