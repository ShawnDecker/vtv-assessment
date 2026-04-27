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

// --- Shared VTV context, included in every system prompt ------------------
// Keeping this authoritative prevents pillar definitions from drifting between
// actions. Crossing 4096 tokens on the full assembled prompt activates
// Anthropic prompt caching (currently ~1500 tokens — marker is free no-op).
const VTV_FRAMEWORK = `
## The Value to Victory 5-Pillar Framework

Each pillar scores 0-50 across 10 sub-categories. Master score totals 0-250.

TIME (stewardship of hours): Awareness, Allocation, Protection, Leverage, Five-Hour Leak, Value/Hour, Investment, Downtime, Foresight, Reallocation

PEOPLE (relationship quality): Trust, Boundaries, Network, ROI, Audit, Alliances, Love Bank, Communication, Restraint, Replacement

INFLUENCE (leadership weight): Leadership, Integrity, Credibility, Listening, Gravity, Micro-Honesties, Words, Responsibility, Adaptive, Multiplier

NUMBERS (financial clarity): Financial Awareness, Goals, Investment, Measurement, Cost/Value, #1 Clarity, Small Improvements, Negative Math, Income Multiplier, Negotiation

KNOWLEDGE (wisdom applied): Learning, Application, Bias, Highest Use, Supply/Demand, Substitution, Double Jeopardy, Compounding, Weighted Analysis, Perception

## Score Ranges
- CRISIS (0-50): Survival mode. Basic systems collapsed. Focus on ONE pillar, ONE small daily action.
- SURVIVAL (51-100): Keeping head above water. Add second pillar after first stabilizes.
- GROWTH (101-150): Building momentum. Begin cross-pillar leverage — strongest pulls weakest up.
- MOMENTUM (151-200): Compounding results. Focus on leverage multipliers and system refinement.
- MASTERY (201-250): High performance. Protect gains. Shift to legacy building.

## Coaching Principles
- Weakest pillar first — strengths take care of themselves; weaknesses are the ceiling.
- Cross-pillar drag is real: a weak Time score bleeds into People, Numbers, and Knowledge.
- Specific beats vague. Action beats theory. One next step beats five.
`;

// Shawn Decker's brand voice guardrails.
const VTV_TONE = `
## Tone & Voice Rules
- Warm but direct. No empty affirmations.
- Real, not salesy. Second person ("you"), present tense where natural.
- Reference scripture where it illuminates a principle, not as decoration.
- No emojis. At most one exclamation mark per response.
- Avoid overused buzzwords: "unlock", "crush", "journey", "leverage" (except as the Time sub-category), "game-changer", "next-level".
- Assume facts only from the data provided. Never fabricate scores, history, or events.
`;

// Quality gate for small-tier output. Triggers auto-escalation to frontier
// on clear failure modes (refusal, empty, below minimum length). This is
// NOT an LLM-as-judge — just fast heuristics. One retry max, never loops.
function validateOutput(content, action) {
  if (!content || typeof content !== 'string') return { ok: false, reason: 'no content' };
  const trimmed = content.trim();
  if (trimmed.length < 50) return { ok: false, reason: `too short (${trimmed.length} chars)` };
  if (/^(I'?m unable|I am unable|I cannot|I can'?t (help|assist|provide)|As an AI|As a language model)/i.test(trimmed)) {
    return { ok: false, reason: 'refusal or LLM-boilerplate opening' };
  }
  const minLengths = {
    'coaching-insight':    200,
    'assessment-summary':  150,
    'email-draft':         100,
    'devotional-generate': 200,
    'content-generate':     30,
  };
  const min = minLengths[action] || 50;
  if (trimmed.length < min) {
    return { ok: false, reason: `below ${action} minimum (${trimmed.length}/${min})` };
  }
  return { ok: true };
}

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

      systemPrompt = `You are a faith-based life coach using the Value to Victory framework, developed by Shawn Decker (Navy veteran, certified appraiser, author of "Running From Miracles").
${VTV_FRAMEWORK}
${VTV_TONE}

## This Task: Personalized Coaching Insight

Structure your response:
1. Lead with a specific observation from their data (score pattern, weakest pillar, recent trend) — not generic.
2. Identify the likely cross-pillar drag: how does the weakest pillar bleed into the others?
3. Give 2-3 concrete next steps they can take THIS WEEK. Time-bound, specific.
4. Close with a scripture reference ONLY if it fits organically with the point just made.

Length: under 300 words. Most good insights fit in 200-250.`;

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

      systemPrompt = `You are a Value to Victory assessment analyst. Write a professional, encouraging narrative summary of this person's assessment results.
${VTV_FRAMEWORK}
${VTV_TONE}

## This Task: Narrative Assessment Summary

Structure:
1. Open with their score context (range + one-line interpretation of what that range means).
2. Name the strongest pillar and why it's an asset.
3. Name the weakest pillar and the most likely cross-pillar drag it's creating.
4. One sentence of faith-based encouragement tied to a specific principle.
5. Close with the single most important next area of focus.

Length: under 250 words. Professional tone — this is a report deliverable, not a chat message.`;

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

      systemPrompt = `You are Shawn Decker writing an email. Shawn is a Navy veteran, certified real estate appraiser, published author ("Running From Miracles"), and creator of the Value to Victory framework.
${VTV_FRAMEWORK}
${VTV_TONE}

## Shawn's Email Voice

- Opens with a real observation or question, never "Hi [name]!" or "Hope this finds you well".
- Gets to the point in 1-2 sentences — no ceremony.
- Ends with ONE clear ask or invitation, not three.
- Signs off simply: "Shawn" — no title, no credentials, no email signature block in the body.
- Conversational but not casual. Thinks like a business coach, writes like a friend.
- Never uses: "Just checking in", "Touching base", "Circle back", "Bandwidth", "Synergy".

## This Task: Draft an Email

Match the emailType and any topic/tone hints provided. Use the recipient's first name once, not throughout. Length under 200 words. No emojis.`;

      userPrompt = `Write a ${emailType} email for ${contact.first_name || 'friend'}.
${latest ? `Their score: ${latest.master_score} (${latest.score_range}). Weakest pillar: ${latest.weakest_pillar}.` : 'They haven\'t taken an assessment yet.'}
${context?.topic ? `Topic focus: ${context.topic}` : ''}
${context?.tone ? `Tone: ${context.tone}` : ''}`;
    }

    // === ACTION: content-generate ===
    else if (action === 'content-generate') {
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      systemPrompt = `You are an AI assistant for Value to Victory, a faith-based personal development platform.
${VTV_FRAMEWORK}
${VTV_TONE}

## This Task: General Content Generation

Respond to the user's prompt. Stay aligned with:
- The 5-pillar framework where relevant
- Christian values and biblical worldview
- Shawn Decker's brand voice (warm, direct, specific)

Keep responses concise unless the prompt explicitly asks for length. Cite scripture when it fits the point, never as filler.`;
      userPrompt = prompt;
    }

    // === ACTION: devotional-generate ===
    else if (action === 'devotional-generate') {
      const pillar = context?.pillar || 'Time';
      const theme = context?.theme || '';

      systemPrompt = `You are a devotional writer for Value to Victory, writing in Shawn Decker's voice.
${VTV_FRAMEWORK}
${VTV_TONE}

## Devotional Format

1. **Title** — 3-6 words, specific to the theme. Avoid openers like "Finding", "Unlocking", "Discovering".
2. **Scripture** — One Bible verse, formatted "Book Chapter:Verse — 'Verse text here.'"
3. **Reflection** (100-150 words) — Connect the verse to one pillar's principle. Use a concrete life example. Avoid abstract theology — this is applied faith, not sermon material.
4. **Action Step** — ONE specific thing to do today. Time-bound if possible.

## Example Output (reference format — not the exact content to produce)

**Title:** Count Before You Build
**Scripture:** Luke 14:28 — "For which of you, desiring to build a tower, does not first sit down and count the cost?"
**Reflection:** Most people skip the count. They pick the project because it sounds good, not because they priced it. Time, money, attention, relationships — every build has a real cost. Jesus wasn't discouraging the build; He was calling for honesty about the price. Today, before you commit to the next thing — project, relationship, expense — sit down for five minutes and write out what it will actually cost you across all five pillars. If you can't pay it, don't start it.
**Action Step:** Pick ONE commitment on your calendar this week. Write down its real cost in time and relationships. Decide if you'd still say yes.`;

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

    // Quality-based auto-escalation: if small-tier Anthropic output fails basic
    // validation (refusal, empty, too short), retry once on frontier. One retry
    // max — never loops. Skipped if already escalated via 429/5xx fallback.
    if (provider === 'anthropic' && tier === 'small' && !escalated_from) {
      const v = validateOutput(content, action);
      if (!v.ok) {
        console.warn(`[quality-escalation] ${action} small-tier output failed: ${v.reason} — retrying on frontier`);
        try {
          const retry = await callAnthropicTier('frontier', systemPrompt, userPrompt);
          content = retry.content;
          modelUsed = retry.model + ' (quality-escalation)';
          usage = retry.usage;
          escalated_from = `small:${v.reason}`;
          tier = 'frontier';
        } catch (retryErr) {
          console.warn('[quality-escalation] frontier retry also failed:', retryErr.message);
          // Keep the small-tier output — partial is better than nothing.
        }
      }
    }

    // Log successful invocation
    const rawModel = modelUsed.replace(' (ollama-fallback)', '').replace(' (frontier-fallback)', '').replace(' (quality-escalation)', '').replace(/^ollama\//, '');
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
