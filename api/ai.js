const { neon } = require('@neondatabase/serverless');

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
  if (!AI_KEY) return res.status(500).json({ error: 'AI Gateway not configured' });

  try {
    let systemPrompt = '';
    let userPrompt = '';

    // === ACTION: coaching-insight — Generate personalized coaching for a contact ===
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

    // === ACTION: assessment-summary — AI-powered assessment narrative ===
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

    // === ACTION: email-draft — Generate coaching email content ===
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

    // === ACTION: content-generate — General AI content generation ===
    else if (action === 'content-generate') {
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      systemPrompt = `You are an AI assistant for Value to Victory, a faith-based personal development platform. The 5 pillars are Time, People, Influence, Numbers, and Knowledge. Be helpful, professional, and aligned with Christian values. Keep responses concise.`;
      userPrompt = prompt;
    }

    // === ACTION: devotional-generate — Generate a daily devotional ===
    else if (action === 'devotional-generate') {
      const pillar = context?.pillar || 'Time';
      const theme = context?.theme || '';

      systemPrompt = `You are a devotional writer for Value to Victory. Write faith-based daily devotionals tied to one of the 5 pillars (Time, People, Influence, Numbers, Knowledge). Include a Bible verse, a reflection (100-150 words), and a practical action step. Tone: warm, encouraging, real.`;

      userPrompt = `Write a daily devotional for the "${pillar}" pillar.${theme ? ` Theme: ${theme}` : ''} Include: title, scripture reference, reflection, and one action step.`;
    }

    else {
      return res.status(400).json({ error: `Unknown action: ${action}. Valid: coaching-insight, assessment-summary, email-draft, content-generate, devotional-generate` });
    }

    // Determine AI provider: 'local' (Ollama) or 'cloud' (Vercel AI Gateway)
    const provider = process.env.AI_PROVIDER || 'cloud';
    let aiUrl, aiHeaders, aiModel;

    if (provider === 'local') {
      // Local AI via Ollama (OpenAI-compatible API)
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      aiUrl = `${ollamaHost}/v1/chat/completions`;
      aiHeaders = { 'Content-Type': 'application/json' };
      // Use smaller models for faster local inference
      const localModels = {
        'coaching-insight':    process.env.LOCAL_MODEL_COACHING    || 'llama3.1:8b',
        'assessment-summary':  process.env.LOCAL_MODEL_SUMMARY     || 'llama3.1:8b',
        'email-draft':         process.env.LOCAL_MODEL_EMAIL       || 'llama3.1:8b',
        'content-generate':    process.env.LOCAL_MODEL_CONTENT     || 'llama3.1:8b',
        'devotional-generate': process.env.LOCAL_MODEL_DEVOTIONAL  || 'llama3.1:8b',
      };
      aiModel = localModels[action] || 'llama3.1:8b';
    } else {
      // Cloud AI via Vercel AI Gateway
      aiUrl = 'https://ai-gateway.vercel.sh/v1/chat/completions';
      aiHeaders = {
        'Authorization': `Bearer ${AI_KEY}`,
        'Content-Type': 'application/json',
      };
      aiModel = process.env.CLOUD_AI_MODEL || 'anthropic/claude-sonnet-4.5';
    }

    const aiResponse = await fetch(aiUrl, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify({
        model: aiModel,
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
      return res.status(502).json({
        error: `AI ${provider} error`,
        detail: errText,
        provider,
        model: aiModel,
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    return res.json({
      action,
      content,
      provider,
      model: aiData.model || aiModel,
      usage: aiData.usage || {},
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
