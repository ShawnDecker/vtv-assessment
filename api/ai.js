const { neon } = require('@neondatabase/serverless');

// ========== AI MODEL CONFIGURATION ==========
// Task-to-model routing: assigns the best local model per task type.
// Optimized for laptops with 8-16GB RAM.
//
// Model recommendations by hardware:
//   8GB RAM  → phi3:mini (3.8B) or mistral:7b
//   16GB RAM → llama3.1:8b (default) or mistral:7b
//   32GB+    → llama3.1:70b for coaching/summaries
//
// Override any model via env vars (e.g., LOCAL_MODEL_COACHING=mistral:7b)

const LOCAL_MODELS = {
  'coaching-insight':    process.env.LOCAL_MODEL_COACHING    || 'llama3.1:8b',
  'assessment-summary':  process.env.LOCAL_MODEL_SUMMARY     || 'mistral:7b',
  'email-draft':         process.env.LOCAL_MODEL_EMAIL       || 'mistral:7b',
  'content-generate':    process.env.LOCAL_MODEL_CONTENT     || 'llama3.1:8b',
  'devotional-generate': process.env.LOCAL_MODEL_DEVOTIONAL  || 'llama3.1:8b',
};

const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://localhost:11434';
const CLOUD_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

// ========== TIERED CLOUD MODEL ROUTER ==========
// Picks a model tier per action. CLOUD_AI_MODEL env var still wins if set
// (preserves existing behavior). Approximate per-million-token prices in
// cents, used only for ai_calls.cost_cents estimation — update as pricing
// changes. Set COST_* env vars to override.
const TIER_MODELS = {
  small:    process.env.AI_MODEL_SMALL    || 'anthropic/claude-haiku-4.5',
  mid:      process.env.AI_MODEL_MID      || 'anthropic/claude-sonnet-4.6',
  frontier: process.env.AI_MODEL_FRONTIER || 'anthropic/claude-opus-4.7',
};
const TIER_COST_CENTS_PER_MTOK = {
  small:    { in: Number(process.env.COST_SMALL_IN_CENTS    || 80),    out: Number(process.env.COST_SMALL_OUT_CENTS    || 400)    },
  mid:      { in: Number(process.env.COST_MID_IN_CENTS      || 300),   out: Number(process.env.COST_MID_OUT_CENTS      || 1500)   },
  frontier: { in: Number(process.env.COST_FRONTIER_IN_CENTS || 1500),  out: Number(process.env.COST_FRONTIER_OUT_CENTS || 7500)   },
};
const ACTION_TIER = {
  'coaching-insight':    'mid',       // personal + faith-sensitive → Sonnet
  'assessment-summary':  'small',     // structured narrative → Haiku
  'email-draft':         'mid',
  'content-generate':    'small',
  'devotional-generate': 'small',
};
function pickCloudModel(action) {
  // 1. Explicit CLOUD_AI_MODEL env var wins (back-compat).
  if (process.env.CLOUD_AI_MODEL) return { model: process.env.CLOUD_AI_MODEL, tier: 'override' };
  // 2. Per-action tier map.
  const tier = ACTION_TIER[action] || 'small';
  return { model: TIER_MODELS[tier], tier };
}
function estimateCostCents(tier, usage) {
  const t = TIER_COST_CENTS_PER_MTOK[tier];
  if (!t) return null;
  const tin  = Number(usage?.prompt_tokens     || usage?.input_tokens  || 0);
  const tout = Number(usage?.completion_tokens || usage?.output_tokens || 0);
  return (tin * t.in + tout * t.out) / 1_000_000;
}

// ========== TELEMETRY ==========
// Best-effort logger. Never throws — failure to log must not break the call.
async function logAiCall(sql, row) {
  try {
    await sql`INSERT INTO ai_calls
      (action, route_tier, provider, model, tokens_in, tokens_out, cost_cents, latency_ms, contact_id, status, error_message, metadata)
      VALUES
      (${row.action}, ${row.route_tier || null}, ${row.provider}, ${row.model},
       ${row.tokens_in || null}, ${row.tokens_out || null}, ${row.cost_cents || null},
       ${row.latency_ms || null}, ${row.contact_id || null}, ${row.status || 'ok'},
       ${row.error_message || null}, ${JSON.stringify(row.metadata || {})}::jsonb)`;
  } catch (e) {
    // Table may not exist yet (run migrations/007-ai-calls.sql). Log to stderr and move on.
    if (!logAiCall._warned) { console.warn('ai_calls logging disabled:', e.message); logAiCall._warned = true; }
  }
}

// ========== HEALTH CHECK: Is Ollama running? ==========
async function isOllamaAvailable() {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch { return false; }
}

// ========== CLOUD AI HELPER ==========
async function callCloudAI(apiKey, systemPrompt, userPrompt, action) {
  const picked = pickCloudModel(action);
  const aiResponse = await fetch(CLOUD_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: picked.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    const err = new Error('AI Gateway error: ' + errText);
    err.tier = picked.tier;
    err.model = picked.model;
    throw err;
  }
  const aiData = await aiResponse.json();
  return {
    content: aiData.choices?.[0]?.message?.content || '',
    model: aiData.model || picked.model,
    tier: picked.tier,
    usage: aiData.usage || {}
  };
}

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const sql = neon(process.env.DATABASE_URL);
  const { action, contactId, assessmentId, prompt, context } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action required' });

  const AI_KEY = process.env.AI_GATEWAY_API_KEY;

  // === ACTION: ai-metrics — rollup of ai_calls for the dashboard ===
  if (action === 'ai-metrics') {
    try {
      const since = context?.sinceHours ? Number(context.sinceHours) : 168;
      const rows = await sql`
        SELECT
          COALESCE(route_tier, 'unknown') AS tier,
          model,
          COUNT(*)::int                           AS calls,
          SUM(COALESCE(tokens_in, 0))::bigint     AS tokens_in,
          SUM(COALESCE(tokens_out, 0))::bigint    AS tokens_out,
          ROUND(SUM(COALESCE(cost_cents, 0))::numeric, 2) AS cost_cents,
          ROUND(AVG(COALESCE(latency_ms, 0))::numeric, 0) AS avg_latency_ms,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::int    AS errors,
          SUM(CASE WHEN status = 'fallback' THEN 1 ELSE 0 END)::int AS fallbacks
        FROM ai_calls
        WHERE created_at > NOW() - (${since} || ' hours')::interval
        GROUP BY route_tier, model
        ORDER BY calls DESC
      `;
      return res.json({ since_hours: since, rows });
    } catch (e) {
      // Table not yet created (migration 007 not run). Return empty rollup.
      return res.json({ since_hours: 0, rows: [], note: 'ai_calls table not present — run migrations/007-ai-calls.sql' });
    }
  }

  // === ACTION: similar-users — k-nearest-neighbor by pillar profile ===
  // Uses L2 distance on the 5 pillar totals + master_score. No pgvector
  // extension needed; scales fine to ~50k assessments on Neon.
  if (action === 'similar-users') {
    if (!contactId && !assessmentId) {
      return res.status(400).json({ error: 'contactId or assessmentId required' });
    }
    const k = Math.max(1, Math.min(Number(context?.k || 10), 100));
    let anchorRows;
    if (assessmentId) {
      anchorRows = await sql`SELECT * FROM assessments WHERE id = ${assessmentId} LIMIT 1`;
    } else {
      anchorRows = await sql`SELECT * FROM assessments WHERE contact_id = ${contactId} ORDER BY completed_at DESC LIMIT 1`;
    }
    if (!anchorRows.length) return res.json({ anchor: null, neighbors: [] });
    const a = anchorRows[0];
    const neighbors = await sql`
      SELECT
        a2.id           AS assessment_id,
        a2.contact_id,
        a2.master_score,
        a2.score_range,
        a2.weakest_pillar,
        a2.time_total, a2.people_total, a2.influence_total, a2.numbers_total, a2.knowledge_total,
        SQRT(
          POWER(a2.time_total      - ${a.time_total      || 0}, 2) +
          POWER(a2.people_total    - ${a.people_total    || 0}, 2) +
          POWER(a2.influence_total - ${a.influence_total || 0}, 2) +
          POWER(a2.numbers_total   - ${a.numbers_total   || 0}, 2) +
          POWER(a2.knowledge_total - ${a.knowledge_total || 0}, 2) +
          POWER((a2.master_score - ${a.master_score || 0}) / 5.0, 2)
        )::real AS distance
      FROM assessments a2
      WHERE a2.id <> ${a.id}
      ORDER BY distance ASC
      LIMIT ${k}
    `;
    return res.json({
      anchor: {
        assessment_id: a.id, contact_id: a.contact_id,
        master_score: a.master_score, weakest_pillar: a.weakest_pillar,
        pillars: {
          time: a.time_total, people: a.people_total, influence: a.influence_total,
          numbers: a.numbers_total, knowledge: a.knowledge_total,
        }
      },
      k, neighbors
    });
  }

  // === ACTION: health — Check AI provider status ===
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
      provider: process.env.AI_PROVIDER || 'cloud',
      ollama: { available: ollamaUp, host: OLLAMA_HOST, models: ollamaModels },
      cloud: { configured: !!AI_KEY, model: process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5' },
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

    // ========== DETERMINE PROVIDER ==========
    // Priority: per-request context.provider > env AI_PROVIDER > 'cloud'
    const requestProvider = context?.provider;
    const envProvider = process.env.AI_PROVIDER || 'cloud';
    const useLocal = requestProvider === 'ollama' || requestProvider === 'local'
      || (envProvider === 'local')
      || (envProvider === 'auto' && await isOllamaAvailable());

    let content = '';
    let modelUsed = '';
    let usage = {};
    let tierUsed = null;
    const callStartedAt = Date.now();

    if (useLocal) {
      // Call Ollama local AI
      const ollamaModel = context?.model || LOCAL_MODELS[action] || process.env.OLLAMA_MODEL || 'llama3.1:8b';
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
        tierUsed = 'local';
        usage = { prompt_tokens: ollamaData.prompt_eval_count, completion_tokens: ollamaData.eval_count };
        logAiCall(sql, {
          action, route_tier: 'local', provider: 'ollama', model: ollamaModel,
          tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens,
          cost_cents: 0, latency_ms: Date.now() - callStartedAt,
          contact_id: contactId, status: 'ok',
        });
      } catch (ollamaErr) {
        // Fallback to cloud if local fails
        console.warn('Ollama failed, falling back to cloud:', ollamaErr.message);
        logAiCall(sql, {
          action, route_tier: 'local', provider: 'ollama', model: ollamaModel,
          latency_ms: Date.now() - callStartedAt, contact_id: contactId,
          status: 'error', error_message: String(ollamaErr.message).slice(0, 500),
        });
        if (AI_KEY) {
          const fbStartedAt = Date.now();
          const fallback = await callCloudAI(AI_KEY, systemPrompt, userPrompt, action);
          content = fallback.content;
          modelUsed = fallback.model + ' (ollama-fallback)';
          tierUsed = fallback.tier;
          usage = fallback.usage;
          logAiCall(sql, {
            action, route_tier: fallback.tier, provider: 'cloud', model: fallback.model,
            tokens_in: usage.prompt_tokens || usage.input_tokens,
            tokens_out: usage.completion_tokens || usage.output_tokens,
            cost_cents: estimateCostCents(fallback.tier, usage),
            latency_ms: Date.now() - fbStartedAt, contact_id: contactId,
            status: 'fallback', metadata: { reason: 'ollama-fallback' },
          });
        } else {
          return res.status(502).json({ error: 'Local AI failed and no cloud API key configured', detail: ollamaErr.message });
        }
      }
    } else {
      // Call Vercel AI Gateway (Claude)
      if (!AI_KEY) return res.status(500).json({ error: 'AI Gateway not configured. Set AI_GATEWAY_API_KEY or use AI_PROVIDER=local.' });
      try {
        const result = await callCloudAI(AI_KEY, systemPrompt, userPrompt, action);
        content = result.content;
        modelUsed = result.model;
        tierUsed = result.tier;
        usage = result.usage;
        logAiCall(sql, {
          action, route_tier: result.tier, provider: 'cloud', model: result.model,
          tokens_in: usage.prompt_tokens || usage.input_tokens,
          tokens_out: usage.completion_tokens || usage.output_tokens,
          cost_cents: estimateCostCents(result.tier, usage),
          latency_ms: Date.now() - callStartedAt, contact_id: contactId, status: 'ok',
        });
      } catch (cloudErr) {
        logAiCall(sql, {
          action, route_tier: cloudErr.tier || null, provider: 'cloud',
          model: cloudErr.model || 'unknown',
          latency_ms: Date.now() - callStartedAt, contact_id: contactId,
          status: 'error', error_message: String(cloudErr.message).slice(0, 500),
        });
        throw cloudErr;
      }
    }

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

    return res.json({ action, content, model: modelUsed, tier: tierUsed, usage, provider: useLocal ? 'ollama' : 'cloud' });

  } catch (err) {
    return res.status(500).json({ error: 'AI service error' });
  }
};
