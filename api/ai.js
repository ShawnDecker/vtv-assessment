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

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const CLOUD_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

// ========== HEALTH CHECK: Is Ollama running? ==========
async function isOllamaAvailable() {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch { return false; }
}

// ========== PROVIDER SELECTION ==========
// 'local'  → Ollama only
// 'cloud'  → Vercel AI Gateway only
// 'auto'   → Try local first, fall back to cloud if Ollama is down
async function getProvider(action) {
  const setting = process.env.AI_PROVIDER || 'cloud';

  if (setting === 'local') {
    return {
      url: `${OLLAMA_HOST}/v1/chat/completions`,
      headers: { 'Content-Type': 'application/json' },
      model: LOCAL_MODELS[action] || 'llama3.1:8b',
      name: 'local',
    };
  }

  if (setting === 'auto') {
    const ollamaUp = await isOllamaAvailable();
    if (ollamaUp) {
      return {
        url: `${OLLAMA_HOST}/v1/chat/completions`,
        headers: { 'Content-Type': 'application/json' },
        model: LOCAL_MODELS[action] || 'llama3.1:8b',
        name: 'local',
      };
    }
    // Fall through to cloud
  }

  // Cloud provider
  const AI_KEY = process.env.AI_GATEWAY_API_KEY;
  if (!AI_KEY) return null;
  return {
    url: CLOUD_URL,
    headers: { 'Authorization': `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
    model: process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5',
    name: 'cloud',
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

  // === NEW ACTION: health — Check AI provider status ===
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
      cloud: { configured: !!process.env.AI_GATEWAY_API_KEY, model: process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5' },
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

    // ========== CALL AI PROVIDER ==========
    const provider = await getProvider(action);
    if (!provider) {
      return res.status(500).json({ error: 'No AI provider available. Set AI_GATEWAY_API_KEY for cloud or install Ollama for local.' });
    }

    const aiResponse = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    // If local fails, try cloud as fallback (when in auto mode)
    if (!aiResponse.ok && provider.name === 'local' && (process.env.AI_PROVIDER === 'auto')) {
      const cloudKey = process.env.AI_GATEWAY_API_KEY;
      if (cloudKey) {
        const cloudModel = process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5';
        const fallbackResponse = await fetch(CLOUD_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cloudKey}`, 'Content-Type': 'application/json' },
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
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          return res.json({
            action,
            content: data.choices?.[0]?.message?.content || '',
            provider: 'cloud (fallback)',
            model: data.model || cloudModel,
            usage: data.usage || {},
          });
        }
      }
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return res.status(502).json({
        error: `AI ${provider.name} error`,
        detail: errText,
        provider: provider.name,
        model: provider.model,
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    return res.json({
      action,
      content,
      provider: provider.name,
      model: aiData.model || provider.model,
      usage: aiData.usage || {},
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
