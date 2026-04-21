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

// ========== HEALTH CHECK: Is Ollama running? ==========
async function isOllamaAvailable() {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch { return false; }
}

// ========== CLOUD AI HELPER ==========
async function callCloudAI(apiKey, systemPrompt, userPrompt) {
  const cloudModel = process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5';
  const aiResponse = await fetch(CLOUD_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cloudModel,
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
    throw new Error('AI Gateway error: ' + errText);
  }
  const aiData = await aiResponse.json();
  return {
    content: aiData.choices?.[0]?.message?.content || '',
    model: aiData.model || cloudModel,
    usage: aiData.usage || {}
  };
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
// Anything that generates content from a free prompt, or acts as a persona, stays admin-only
// to prevent abuse / cost blow-up by authenticated users.
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

  // Member JWT scope enforcement — admin bypasses all of this
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

  const AI_KEY = process.env.AI_GATEWAY_API_KEY;

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
        usage = { prompt_tokens: ollamaData.prompt_eval_count, completion_tokens: ollamaData.eval_count };
      } catch (ollamaErr) {
        // Fallback to cloud if local fails
        console.warn('Ollama failed, falling back to cloud:', ollamaErr.message);
        if (AI_KEY) {
          const fallback = await callCloudAI(AI_KEY, systemPrompt, userPrompt);
          content = fallback.content;
          modelUsed = fallback.model + ' (ollama-fallback)';
          usage = fallback.usage;
        } else {
          return res.status(502).json({ error: 'Local AI failed and no cloud API key configured', detail: ollamaErr.message });
        }
      }
    } else {
      // Call Vercel AI Gateway (Claude)
      if (!AI_KEY) return res.status(500).json({ error: 'AI Gateway not configured. Set AI_GATEWAY_API_KEY or use AI_PROVIDER=local.' });
      const result = await callCloudAI(AI_KEY, systemPrompt, userPrompt);
      content = result.content;
      modelUsed = result.model;
      usage = result.usage;
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

    return res.json({ action, content, model: modelUsed, usage, provider: useLocal ? 'ollama' : 'cloud' });

  } catch (err) {
    return res.status(500).json({ error: 'AI service error' });
  }
};
