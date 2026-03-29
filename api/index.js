const { neon } = require('@neondatabase/serverless');

// Cross-Pillar Impact Matrix — 20 directional relationships (5 pillars × 4 targets each)
const CROSS_PILLAR_IMPACT_MATRIX = {
  "Time→People": {
    from: "Time", to: "People",
    headline: "You don't have time for the people who matter.",
    explanation: "Low Time Awareness + Low Time Protection = you're so consumed by urgent tasks that your strongest relationships get leftovers. Your People score may look decent, but your Love Bank is running on deposits you made months ago. Eventually, it catches up.",
    subCategoryLinks: [{ from: "Time Allocation", to: "Love Bank Deposits" }, { from: "Time Protection", to: "Boundary Quality" }]
  },
  "Time→Influence": {
    from: "Time", to: "Influence",
    headline: "No one follows someone who can't manage their own schedule.",
    explanation: "If you can't protect your own time, people notice. Your Influence score says you have credibility, but your calendar tells people you're reactive, not strategic. Leaders lead their time first.",
    subCategoryLinks: [{ from: "Time Leverage", to: "Leadership Level" }, { from: "Foresight", to: "Professional Credibility" }]
  },
  "Time→Numbers": {
    from: "Time", to: "Numbers",
    headline: "You can't build wealth in hours you don't control.",
    explanation: "Every hour you waste is money you didn't earn, invest, or compound. Your Financial Awareness means nothing if your Five-Hour Leak is draining the time you'd need to act on what you know.",
    subCategoryLinks: [{ from: "Five-Hour Leak", to: "Income Multiplier" }, { from: "Value Per Hour", to: "Financial Awareness" }]
  },
  "Time→Knowledge": {
    from: "Time", to: "Knowledge",
    headline: "You're too busy to learn what would change everything.",
    explanation: "Knowledge compounds, but only if you have hours to invest. Low Time scores mean your Learning Hours stay low, your Application Rate drops, and your Knowledge Compounding stalls.",
    subCategoryLinks: [{ from: "Time Investment", to: "Learning Hours" }, { from: "Downtime Quality", to: "Application Rate" }]
  },
  "People→Time": {
    from: "People", to: "Time",
    headline: "The wrong people are eating your clock.",
    explanation: "Low People Audit scores mean Takers are consuming your peak hours. Your Time pillar looks managed, but 30% of your schedule is dedicated to people who drain more than they give.",
    subCategoryLinks: [{ from: "People Audit", to: "Time Allocation" }, { from: "Relational ROI", to: "Five-Hour Leak" }]
  },
  "People→Influence": {
    from: "People", to: "Influence",
    headline: "You can't lead people you don't understand.",
    explanation: "Influence requires trust, and trust requires relational skill. If your Communication Clarity is low, your Empathetic Listening is performative. People follow you for now — but not for long.",
    subCategoryLinks: [{ from: "Communication Clarity", to: "Empathetic Listening" }, { from: "Trust Investment", to: "Integrity Alignment" }]
  },
  "People→Numbers": {
    from: "People", to: "Numbers",
    headline: "Bad relationships are expensive.",
    explanation: "Every unresolved conflict, misaligned partnership, or toxic relationship has a financial cost — legal fees, lost opportunities, stress-driven spending, bad joint decisions. Your Numbers pillar is quietly bleeding from People.",
    subCategoryLinks: [{ from: "Boundary Quality", to: "Negative Math" }, { from: "Alliance Building", to: "Negotiation Skill" }]
  },
  "People→Knowledge": {
    from: "People", to: "Knowledge",
    headline: "Your circle determines your ceiling.",
    explanation: "If your Network Depth is shallow and your Mentorship Access is low, you're learning from the internet instead of from people who've done it. Knowledge without relationship is just information.",
    subCategoryLinks: [{ from: "Network Depth", to: "Knowledge Compounding" }, { from: "Alliance Building", to: "Highest & Best Use" }]
  },
  "Influence→Time": {
    from: "Influence", to: "Time",
    headline: "Without influence, you spend time convincing instead of executing.",
    explanation: "Low Adaptive Influence means every decision takes longer because you can't move people efficiently. You spend hours in meetings that a respected leader would close in minutes.",
    subCategoryLinks: [{ from: "Adaptive Influence", to: "Time Leverage" }, { from: "Word Management", to: "Time Protection" }]
  },
  "Influence→People": {
    from: "Influence", to: "People",
    headline: "People don't stay around someone they can't respect.",
    explanation: "If your Integrity Alignment is off — your actions don't match your words — people distance themselves. Your People score erodes slowly because trust isn't built on intentions, it's built on consistency.",
    subCategoryLinks: [{ from: "Integrity Alignment", to: "Trust Investment" }, { from: "Micro-Honesties", to: "Love Bank Deposits" }]
  },
  "Influence→Numbers": {
    from: "Influence", to: "Numbers",
    headline: "You can't negotiate from a position of low credibility.",
    explanation: "Negotiation Skill depends on perceived authority. If your Professional Credibility is low, your financial deals are weaker, your salary conversations are shorter, and your investment partnerships don't materialize.",
    subCategoryLinks: [{ from: "Professional Credibility", to: "Negotiation Skill" }, { from: "Leadership Level", to: "Income Multiplier" }]
  },
  "Influence→Knowledge": {
    from: "Influence", to: "Knowledge",
    headline: "People won't teach you what you haven't earned the right to learn.",
    explanation: "Access to high-level knowledge often requires relational credibility. Mentors, advisors, and industry leaders share their real playbook with people they respect, not just people who ask.",
    subCategoryLinks: [{ from: "Gravitational Center", to: "Highest & Best Use" }, { from: "Influence Multiplier", to: "Knowledge Compounding" }]
  },
  "Numbers→Time": {
    from: "Numbers", to: "Time",
    headline: "Financial stress steals your time.",
    explanation: "When Financial Awareness is low and Negative Math is running, you spend hours worrying, scrambling for cash, and working overtime instead of strategically. Money problems become time problems.",
    subCategoryLinks: [{ from: "Financial Awareness", to: "Five-Hour Leak" }, { from: "Negative Math", to: "Time Investment" }]
  },
  "Numbers→People": {
    from: "Numbers", to: "People",
    headline: "Money problems destroy relationships.",
    explanation: "The #1 cause of relational stress is financial misalignment. If you can't manage your Numbers, your partner doesn't trust your judgment, your friends distance themselves, and your family relationships strain.",
    subCategoryLinks: [{ from: "Cost vs Value", to: "Love Bank Deposits" }, { from: "Goal Specificity", to: "Communication Clarity" }]
  },
  "Numbers→Influence": {
    from: "Numbers", to: "Influence",
    headline: "No one trusts financial advice from someone who's broke.",
    explanation: "Your Influence score says people listen to you — but if your Numbers tell a different story, your credibility has an expiration date. People can feel financial instability even when you don't say it.",
    subCategoryLinks: [{ from: "Financial Awareness", to: "Professional Credibility" }, { from: "Investment Logic", to: "Integrity Alignment" }]
  },
  "Numbers→Knowledge": {
    from: "Numbers", to: "Knowledge",
    headline: "You can't invest in learning without margin.",
    explanation: "Books cost money. Courses cost money. Conferences cost money. Time off to learn costs money. When Numbers are low, Knowledge becomes a luxury instead of an investment.",
    subCategoryLinks: [{ from: "Investment Logic", to: "Learning Hours" }, { from: "Small Improvements", to: "Application Rate" }]
  },
  "Knowledge→Time": {
    from: "Knowledge", to: "Time",
    headline: "You repeat mistakes that cost you years.",
    explanation: "Low Double Jeopardy scores mean you're paying for the same lessons twice. Low Bias Awareness means you keep making the same time allocation errors because you can't see your own patterns.",
    subCategoryLinks: [{ from: "Double Jeopardy", to: "Time Reallocation" }, { from: "Bias Awareness", to: "Foresight" }]
  },
  "Knowledge→People": {
    from: "Knowledge", to: "People",
    headline: "You can't help people you don't understand.",
    explanation: "Relationships require understanding — understanding communication styles, conflict resolution, love languages. If your Knowledge application is low, your relational skills plateau even if your intentions are good.",
    subCategoryLinks: [{ from: "Application Rate", to: "Communication Clarity" }, { from: "Perception vs Perspective", to: "Empathetic Listening" }]
  },
  "Knowledge→Influence": {
    from: "Knowledge", to: "Influence",
    headline: "You can't lead beyond what you know.",
    explanation: "Influence has a ceiling, and that ceiling is Knowledge. You can only lead people to the level of your own understanding. Low Substitution Risk awareness means you're replaceable — and replaceable people don't have lasting influence.",
    subCategoryLinks: [{ from: "Substitution Risk", to: "Leadership Level" }, { from: "Weighted Analysis", to: "Adaptive Influence" }]
  },
  "Knowledge→Numbers": {
    from: "Knowledge", to: "Numbers",
    headline: "What you don't know is the most expensive thing in your life.",
    explanation: "The true cost of ignorance is always financial. Low Supply & Demand awareness means you're underpricing yourself. Low Highest & Best Use means you're investing time and money in areas that will never compound.",
    subCategoryLinks: [{ from: "Supply & Demand", to: "Negotiation Skill" }, { from: "Highest & Best Use", to: "Cost vs Value" }]
  }
};

function generateCrossPillarImpact(assessmentData) {
  const a = assessmentData;
  const pillars = [
    { name: "Time", score: Number(a.time_total) || 0 },
    { name: "People", score: Number(a.people_total) || 0 },
    { name: "Influence", score: Number(a.influence_total) || 0 },
    { name: "Numbers", score: Number(a.numbers_total) || 0 },
    { name: "Knowledge", score: Number(a.knowledge_total) || 0 },
  ];

  // For pillar deep-dive assessments, skip cross-pillar analysis
  if (a.depth === 'pillar') {
    return null;
  }

  // Filter out pillars with 0 score (unscored)
  const scoredPillars = pillars.filter(p => p.score > 0);
  if (scoredPillars.length < 2) return null;

  const sorted = [...scoredPillars].sort((x, y) => x.score - y.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  // Handle tied pillars — if weakest and strongest are the same score, balanced
  if (weakest.score === strongest.score) {
    return { primaryImpact: null, secondaryImpacts: [], overallMessage: "Your pillars are well-aligned. No single weakness is dragging down your strengths.", severity: "balanced" };
  }

  // Calculate gap severity as percentage of strongest
  const gapPct = ((strongest.score - weakest.score) / strongest.score) * 100;

  let severity;
  if (gapPct > 50) severity = "critical";
  else if (gapPct >= 30) severity = "significant";
  else if (gapPct >= 15) severity = "moderate";
  else severity = "balanced";

  if (severity === "balanced") {
    return { primaryImpact: null, secondaryImpacts: [], overallMessage: "Your pillars are well-aligned. No single weakness is dragging down your strengths.", severity: "balanced" };
  }

  // Look up primary impact: weakest → strongest
  const primaryKey = weakest.name + "→" + strongest.name;
  const primaryMatrix = CROSS_PILLAR_IMPACT_MATRIX[primaryKey];

  const primaryImpact = primaryMatrix ? {
    from: weakest.name,
    to: strongest.name,
    fromScore: weakest.score,
    toScore: strongest.score,
    severity,
    headline: primaryMatrix.headline,
    explanation: primaryMatrix.explanation,
    subCategoryLinks: primaryMatrix.subCategoryLinks
  } : null;

  // Secondary impacts: weakest → other above-average pillars (excluding strongest)
  const avgScore = scoredPillars.reduce((sum, p) => sum + p.score, 0) / scoredPillars.length;
  const aboveAvgPillars = scoredPillars.filter(p => p.name !== weakest.name && p.name !== strongest.name && p.score > avgScore);
  const secondaryImpacts = [];
  for (const target of aboveAvgPillars) {
    const secKey = weakest.name + "→" + target.name;
    const secMatrix = CROSS_PILLAR_IMPACT_MATRIX[secKey];
    if (secMatrix) {
      secondaryImpacts.push({
        from: weakest.name,
        to: target.name,
        fromScore: weakest.score,
        toScore: target.score,
        headline: secMatrix.headline,
        subCategoryLinks: secMatrix.subCategoryLinks
      });
    }
  }

  const overallMessage = `Your ${weakest.name} isn't just low — it's actively dragging down your ${strongest.name}. Here's exactly how.`;

  return { primaryImpact, secondaryImpacts, overallMessage, severity };
}

function getScoreRange(score, maxScore) {
  // Scale thresholds proportionally to the max possible score.
  // All depths now normalize pillar scores to 50-point scale, so maxScore = 250 for all.
  // Pillar deep-dive (single pillar) still uses maxScore = 50.
  const max = maxScore || 250;
  const t1 = max * 0.2;  // Crisis ceiling  (20%)
  const t2 = max * 0.4;  // Survival ceiling (40%)
  const t3 = max * 0.6;  // Growth ceiling   (60%)
  const t4 = max * 0.8;  // Momentum ceiling (80%)
  if (score <= t1) return "Crisis";
  if (score <= t2) return "Survival";
  if (score <= t3) return "Growth";
  if (score <= t4) return "Momentum";
  return "Mastery";
}

function generatePrescription(a) {
  const pillars = [
    { name: "Time", score: a.time_total, subs: { "Time Awareness": a.time_awareness, "Time Allocation": a.time_allocation, "Time Protection": a.time_protection, "Time Leverage": a.time_leverage, "Five-Hour Leak": a.five_hour_leak, "Value Per Hour": a.value_per_hour, "Time Investment": a.time_investment, "Downtime Quality": a.downtime_quality, "Foresight": a.foresight, "Time Reallocation": a.time_reallocation } },
    { name: "People", score: a.people_total, subs: { "Trust Investment": a.trust_investment, "Boundary Quality": a.boundary_quality, "Network Depth": a.network_depth, "Relational ROI": a.relational_roi, "People Audit": a.people_audit, "Alliance Building": a.alliance_building, "Love Bank Deposits": a.love_bank_deposits, "Communication Clarity": a.communication_clarity, "Restraint Practice": a.restraint_practice, "Value Replacement": a.value_replacement } },
    { name: "Influence", score: a.influence_total, subs: { "Leadership Level": a.leadership_level, "Integrity Alignment": a.integrity_alignment, "Professional Credibility": a.professional_credibility, "Empathetic Listening": a.empathetic_listening, "Gravitational Center": a.gravitational_center, "Micro-Honesties": a.micro_honesties, "Word Management": a.word_management, "Personal Responsibility": a.personal_responsibility, "Adaptive Influence": a.adaptive_influence, "Influence Multiplier": a.influence_multiplier } },
    { name: "Numbers", score: a.numbers_total, subs: { "Financial Awareness": a.financial_awareness, "Goal Specificity": a.goal_specificity, "Investment Logic": a.investment_logic, "Measurement Habit": a.measurement_habit, "Cost vs Value": a.cost_vs_value, "Number One Clarity": a.number_one_clarity, "Small Improvements": a.small_improvements, "Negative Math": a.negative_math, "Income Multiplier": a.income_multiplier, "Negotiation Skill": a.negotiation_skill } },
    { name: "Knowledge", score: a.knowledge_total, subs: { "Learning Hours": a.learning_hours, "Application Rate": a.application_rate, "Bias Awareness": a.bias_awareness, "Highest & Best Use": a.highest_best_use, "Supply & Demand": a.supply_and_demand, "Substitution Risk": a.substitution_risk, "Double Jeopardy": a.double_jeopardy, "Knowledge Compounding": a.knowledge_compounding, "Weighted Analysis": a.weighted_analysis, "Perception vs Perspective": a.perception_vs_perspective } },
  ];
  const sorted = [...pillars].sort((x, y) => x.score - y.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const weakestSubs = Object.entries(weakest.subs).sort(([,a],[,b]) => a - b);
  const prescriptions = {
    Time: { diagnosis: "Your Time pillar is your biggest constraint. You're likely losing 5+ hours per week to low-value activities without realizing it.", immediate: "Run the Time Audit (Tool #2). Track every hour for 3 days. Find your Five-Hour Leak.", tool: "Time Reallocation Planner (Tool #9) — Sort your activities by Covey Quadrant. Schedule Q2 priorities first.", thirtyDay: "Eliminate or reduce 3 specific Q3/Q4 activities. Protect your peak hours. Calculate your Value Per Hour." },
    People: { diagnosis: "Your People pillar is dragging your score. You may be over-investing in Takers or under-investing in Exchangers who could multiply your results.", immediate: "Run the People Audit (Tool #3). Map your top 15-20 relationships against the four types: Givers, Receivers, Exchangers, Takers.", tool: "Relationship Matrix (Tool #6) — Classify your network by alliance type: Confidants, Constituents, Comrades, Companions.", thirtyDay: "Use the Value Replacement Map (Tool #10) to redirect relational energy from low-ROI to high-ROI relationships." },
    Influence: { diagnosis: "Your Influence pillar needs work. You may be operating at a lower level of leadership than your experience warrants, or there's a gap between your stated and lived values.", immediate: "Run the Influence Ladder (Tool #8). Identify which of Maxwell's five levels you currently operate at.", tool: "Gravitational Center Alignment (Tool #11) — Audit your calendar and bank statement against your core values.", thirtyDay: "Score the gap between stated and lived values. Create one specific alignment action per week." },
    Numbers: { diagnosis: "Your Numbers pillar is your weakest area. You're likely not tracking what matters, or there's a disconnect between your goals and your financial reality.", immediate: "Run the Financial Snapshot (Tool #4). Document actual income, expenses, surplus/deficit, and real cost per hour.", tool: "Value Per Hour Calculator (Tool #5) — Calculate your actual hourly worth and your potential hourly worth.", thirtyDay: "Use the Income Multiplier Model (Tool #12) to map compound improvements over 90 days." },
    Knowledge: { diagnosis: "Your Knowledge pillar is your biggest gap. You may be consuming information without applying it, or investing learning hours in areas that don't compound.", immediate: "Run the Knowledge ROI Calculator (Tool #7). Calculate hours invested vs. income and opportunity return.", tool: "Map your knowledge gaps against the 1,800-hour framework. Identify the single most expensive gap.", thirtyDay: "Commit to one high-ROI learning track. Apply the Rule of Double Jeopardy — never pay for the same mistake twice." },
  };
  const rx = prescriptions[weakest.name];
  const crossPillarImpact = generateCrossPillarImpact(a);
  return { weakestPillar: weakest.name, weakestScore: weakest.score, strongestPillar: strongest.name, strongestScore: strongest.score, weakestSubCategory: weakestSubs[0][0], weakestSubScore: weakestSubs[0][1], ...rx, pillars: pillars.map(p => ({ name: p.name, score: p.score })), crossPillarImpact };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const rawUrl = req.url;
  const url = rawUrl.replace(/^\/api/, '').split('?')[0].replace(/\/$/, '');
  console.log('[VE-API] rawUrl:', rawUrl, '| parsed url:', url, '| method:', req.method);

  try {
    // POST /api/start-assessment — early lead capture: create/find contact before assessment begins
    if (req.method === 'POST' && url === '/start-assessment') {
      // Auto-create progress table if not exists
      try { await sql`CREATE TABLE IF NOT EXISTS assessment_progress (id SERIAL PRIMARY KEY, contact_id INTEGER REFERENCES contacts(id), answers JSONB DEFAULT '{}', current_question_index INTEGER DEFAULT 0, mode TEXT DEFAULT 'individual', depth TEXT DEFAULT 'extensive', total_questions INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())`; await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_contact ON assessment_progress(contact_id)`; } catch(e) { /* already exists */ }
      const b = req.body || {};
      if (!b.email || !b.email.trim()) {
        return res.status(400).json({ error: 'Email is required.' });
      }
      const cleanEmail = b.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!b.firstName || !b.firstName.trim()) {
        return res.status(400).json({ error: 'First name is required.' });
      }

      let contact;
      let isReturning = false;
      let previousAssessments = 0;

      const existing = await sql`SELECT * FROM contacts WHERE email = ${cleanEmail} LIMIT 1`;
      if (existing.length > 0) {
        contact = existing[0];
        isReturning = true;
        // Update name/phone if provided
        if (b.firstName || b.phone) {
          await sql`UPDATE contacts SET first_name = COALESCE(NULLIF(${b.firstName.trim()}, ''), first_name), phone = COALESCE(NULLIF(${b.phone || ''}, ''), phone) WHERE id = ${contact.id}`;
          contact.first_name = b.firstName.trim() || contact.first_name;
        }
        const countRows = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE contact_id = ${contact.id}`;
        previousAssessments = Number(countRows[0]?.cnt || 0);
      } else {
        const rows = await sql`INSERT INTO contacts (first_name, last_name, email, phone, created_at) VALUES (${b.firstName.trim()}, ${b.lastName || ''}, ${cleanEmail}, ${b.phone || null}, ${new Date().toISOString()}) RETURNING *`;
        contact = rows[0];
      }

      // Store email in case questions endpoint needs it
      try { await sql`SELECT 1 FROM assessment_progress LIMIT 0`; } catch(e) { /* table may not exist yet */ }

      console.log(`start-assessment: contact ${contact.id} (${cleanEmail}), returning=${isReturning}, prev=${previousAssessments}`);
      return res.json({ contactId: contact.id, firstName: contact.first_name, isReturning, previousAssessments });
    }

    // POST /api/save-progress — periodic auto-save of partial answers
    if (req.method === 'POST' && url === '/save-progress') {
      const b = req.body || {};
      if (!b.contactId) return res.status(400).json({ error: 'contactId required' });

      const answers = typeof b.answers === 'string' ? b.answers : JSON.stringify(b.answers || {});
      const currentIndex = b.currentQuestionIndex || 0;
      const mode = b.mode || 'individual';
      const depth = b.depth || 'quick';
      const totalQuestions = b.totalQuestions || 0;

      try {
        await sql`INSERT INTO assessment_progress (contact_id, answers, current_question_index, mode, depth, total_questions, updated_at)
          VALUES (${b.contactId}, ${answers}::jsonb, ${currentIndex}, ${mode}, ${depth}, ${totalQuestions}, NOW())
          ON CONFLICT (contact_id) DO UPDATE SET
            answers = ${answers}::jsonb,
            current_question_index = ${currentIndex},
            mode = ${mode},
            depth = ${depth},
            total_questions = ${totalQuestions},
            updated_at = NOW()`;
        return res.json({ success: true, savedAt: new Date().toISOString() });
      } catch (e) {
        console.error('save-progress error:', e.message);
        return res.status(500).json({ error: 'Failed to save progress', details: e.message });
      }
    }

    // GET /api/get-progress?contactId=X — retrieve saved progress for a contact
    if (req.method === 'GET' && (url === '/get-progress' || url.startsWith('/get-progress'))) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId required' });

      try {
        const rows = await sql`SELECT * FROM assessment_progress WHERE contact_id = ${contactId} LIMIT 1`;
        if (rows.length === 0) return res.json({ progress: null });
        const p = rows[0];
        return res.json({
          progress: {
            contactId: p.contact_id,
            answers: typeof p.answers === 'string' ? JSON.parse(p.answers) : p.answers,
            currentQuestionIndex: p.current_question_index,
            mode: p.mode,
            depth: p.depth,
            totalQuestions: p.total_questions,
            updatedAt: p.updated_at,
          }
        });
      } catch (e) {
        // Table may not exist yet
        return res.json({ progress: null });
      }
    }

    // DELETE /api/save-progress?contactId=X — cleanup after full submission
    if (req.method === 'DELETE' && url.startsWith('/save-progress')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId required' });

      try {
        await sql`DELETE FROM assessment_progress WHERE contact_id = ${contactId}`;
        return res.json({ success: true });
      } catch (e) {
        // Table may not exist — that's fine
        return res.json({ success: true });
      }
    }

    // GET /api/questions?email=xxx&mode=individual|relationship|leadership&depth=quick|extensive|pillar&pillar=time|people|influence|numbers|knowledge
    if (req.method === 'GET' && url.startsWith('/questions')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      const mode = params.get('mode') || 'individual';
      const depth = params.get('depth') || 'quick';
      const focusPillar = params.get('pillar') || null;
      const allCorePillars = ['time', 'people', 'influence', 'numbers', 'knowledge'];
      // For pillar deep-dive, only assess the single requested pillar
      const corePillars = (depth === 'pillar' && focusPillar && allCorePillars.includes(focusPillar))
        ? [focusPillar]
        : allCorePillars;

      // Check if question_bank table exists (migration may not have run yet)
      let hasQuestionBank = false;
      try {
        await sql`SELECT 1 FROM question_bank LIMIT 1`;
        hasQuestionBank = true;
      } catch (e) { /* table doesn't exist yet */ }

      if (!hasQuestionBank) {
        return res.json({ questions: [], previouslyAnswered: [], isReturningUser: false, totalAvailableByPillar: {}, fallback: true });
      }

      let contact = null;
      let answeredIds = [];
      let isReturningUser = false;

      if (email) {
        const contactRows = await sql`SELECT * FROM contacts WHERE email = ${email} LIMIT 1`;
        if (contactRows.length > 0) {
          contact = contactRows[0];
          const history = await sql`SELECT question_id, answered_at FROM answer_history WHERE contact_id = ${contact.id} ORDER BY answered_at ASC`;
          answeredIds = history.map(h => h.question_id);
          isReturningUser = answeredIds.length > 0;
        }
      }

      // Get all active questions from the bank
      const allQuestions = await sql`SELECT * FROM question_bank WHERE is_active = true ORDER BY sort_order ASC`;

      // Separate core vs overlay
      const coreQuestions = allQuestions.filter(q => !q.is_overlay);
      const overlayQuestions = allQuestions.filter(q => q.is_overlay);

      // Select questions per pillar based on depth:
      //   quick: 5 per pillar (25 total), extensive/pillar: 10 per pillar
      // Strategy: prioritize unanswered questions, then randomly reincorporate
      // some previously answered ones (oldest-answered first, with shuffle).
      // This ensures returning users mostly see new content but also get a
      // few familiar questions cycled back in for re-assessment.
      const QUESTIONS_PER_PILLAR = (depth === 'quick') ? 5 : 10;
      const RECYCLE_RATIO = 0.3; // up to 30% of slots can be recycled old questions
      const selectedQuestions = [];
      const totalAvailableByPillar = {};

      // Simple Fisher-Yates shuffle
      function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      for (const pillar of corePillars) {
        const pillarQs = coreQuestions.filter(q => q.pillar === pillar);
        totalAvailableByPillar[pillar] = pillarQs.length;

        const unanswered = shuffle(pillarQs.filter(q => !answeredIds.includes(q.id)));
        const answered = pillarQs.filter(q => answeredIds.includes(q.id));

        // Sort answered by oldest-answered-first, then shuffle to add variety
        answered.sort((a, b) => {
          const aIdx = answeredIds.indexOf(a.id);
          const bIdx = answeredIds.indexOf(b.id);
          return aIdx - bIdx;
        });

        let picked = [];

        if (unanswered.length >= QUESTIONS_PER_PILLAR) {
          // Plenty of new questions — reserve some slots for recycled old ones
          const recycleSlots = Math.min(
            Math.floor(QUESTIONS_PER_PILLAR * RECYCLE_RATIO),
            answered.length
          );
          const newSlots = QUESTIONS_PER_PILLAR - recycleSlots;
          picked = [
            ...unanswered.slice(0, newSlots),
            ...shuffle(answered).slice(0, recycleSlots),
          ];
        } else if (unanswered.length > 0) {
          // Some new, backfill rest with oldest answered (shuffled)
          picked = [...unanswered];
          const remaining = QUESTIONS_PER_PILLAR - picked.length;
          picked.push(...shuffle(answered).slice(0, remaining));
        } else {
          // All questions answered — full recycle, shuffled for fresh feel
          picked = shuffle(answered).slice(0, QUESTIONS_PER_PILLAR);
        }

        // Final shuffle so recycled questions aren't always at the end
        selectedQuestions.push(...shuffle(picked));
      }

      // Handle overlay questions for relationship/leadership modes (extensive only)
      if (depth === 'extensive' && (mode === 'relationship' || mode === 'leadership')) {
        const modeOverlays = overlayQuestions.filter(q => q.overlay_type === mode);
        const unansweredOverlays = shuffle(modeOverlays.filter(q => !answeredIds.includes(q.id)));
        const answeredOverlays = shuffle(modeOverlays.filter(q => answeredIds.includes(q.id)));

        // Same logic: prioritize unanswered, recycle some old ones
        let overlayPicked = [];
        const overlayTarget = modeOverlays.length; // serve all overlay questions
        if (unansweredOverlays.length >= overlayTarget) {
          const recycleSlots = Math.min(Math.floor(overlayTarget * RECYCLE_RATIO), answeredOverlays.length);
          overlayPicked = [...unansweredOverlays.slice(0, overlayTarget - recycleSlots), ...answeredOverlays.slice(0, recycleSlots)];
        } else {
          overlayPicked = [...unansweredOverlays, ...answeredOverlays.slice(0, overlayTarget - unansweredOverlays.length)];
        }
        selectedQuestions.push(...shuffle(overlayPicked));
        totalAvailableByPillar[mode] = modeOverlays.length;
      }

      // Map DB rows to frontend format
      const questions = selectedQuestions.map(q => ({
        id: q.id,
        pillar: q.pillar,
        subCategory: q.sub_category,
        fieldName: q.field_name,
        question: q.question,
        description: q.description,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        ...(q.is_overlay ? { mode: q.overlay_type } : {}),
      }));

      // Identify which selected questions are recycled vs new
      const selectedIds = questions.map(q => q.id);
      const recycledIds = selectedIds.filter(id => answeredIds.includes(id));
      const newIds = selectedIds.filter(id => !answeredIds.includes(id));

      return res.json({
        questions,
        previouslyAnswered: answeredIds,
        recycledQuestionIds: recycledIds,
        newQuestionIds: newIds,
        isReturningUser,
        totalAvailableByPillar,
        recycleRatio: RECYCLE_RATIO,
        depth,
        focusPillar: (depth === 'pillar') ? focusPillar : null,
        questionsPerPillar: QUESTIONS_PER_PILLAR,
      });
    }

    // GET /api/user/history?email=xxx
    if (req.method === 'GET' && url.startsWith('/user/history')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      if (!email) return res.json({ error: 'Email required', answered: [], assessments: [] });

      const contactRows = await sql`SELECT * FROM contacts WHERE email = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.json({ answered: [], assessments: [], isNewUser: true });

      const contact = contactRows[0];

      // Check if answer_history table exists
      let history = [];
      try {
        history = await sql`SELECT ah.question_id, ah.answer_value, ah.answered_at, qb.pillar, qb.sub_category FROM answer_history ah JOIN question_bank qb ON ah.question_id = qb.id WHERE ah.contact_id = ${contact.id} ORDER BY ah.answered_at DESC`;
      } catch (e) { /* tables may not exist yet */ }

      let totalAvailable = 0;
      try {
        const countResult = await sql`SELECT COUNT(*) as cnt FROM question_bank WHERE is_active = true`;
        totalAvailable = Number(countResult[0]?.cnt || 0);
      } catch (e) { /* table may not exist */ }

      const assessments = await sql`SELECT id, completed_at, mode, master_score, score_range, weakest_pillar, depth, focus_pillar FROM assessments WHERE contact_id = ${contact.id} ORDER BY completed_at DESC`;

      return res.json({
        answered: history.map(h => ({
          questionId: h.question_id,
          answerValue: h.answer_value,
          answeredAt: h.answered_at,
          pillar: h.pillar,
          subCategory: h.sub_category,
        })),
        totalAnswered: history.length,
        totalAvailable,
        assessments: assessments.map(a => ({
          id: a.id,
          completedAt: a.completed_at,
          mode: a.mode,
          masterScore: a.master_score,
          scoreRange: a.score_range,
          weakestPillar: a.weakest_pillar,
          depth: a.depth || 'extensive',
          focusPillar: a.focus_pillar || null,
        })),
        isNewUser: false,
      });
    }

    // POST /api/assessment
    if (req.method === 'POST' && url === '/assessment') {
      const b = req.body || {};

      // Validate required fields
      if (!b.email || !b.email.trim()) {
        return res.status(400).json({ error: 'Email is required to save your assessment results. Please enter your email and try again.' });
      }
      const cleanEmail = b.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // Upsert contact with validated email
      let contactRows = await sql`SELECT * FROM contacts WHERE email = ${cleanEmail} LIMIT 1`;
      let contact;
      if (contactRows.length > 0) {
        contact = contactRows[0];
        // Update name/phone if provided and contact existed
        if (b.firstName || b.lastName || b.phone) {
          await sql`UPDATE contacts SET first_name = COALESCE(NULLIF(${b.firstName || ''}, ''), first_name), last_name = COALESCE(NULLIF(${b.lastName || ''}, ''), last_name), phone = COALESCE(${b.phone || null}, phone) WHERE id = ${contact.id}`;
          contact.first_name = b.firstName || contact.first_name;
          contact.last_name = b.lastName || contact.last_name;
        }
      } else {
        const rows = await sql`INSERT INTO contacts (first_name, last_name, email, phone, created_at) VALUES (${b.firstName || ''}, ${b.lastName || ''}, ${cleanEmail}, ${b.phone || null}, ${new Date().toISOString()}) RETURNING *`;
        contact = rows[0];
      }
      console.log(`Contact upserted: ${contact.id} (${cleanEmail}) - ${contact.first_name} ${contact.last_name}`);

      // Dynamic scoring: if questionIds provided, compute pillar totals from question_bank
      let tt, pt, it, nt, kt;
      const questionIds = b.questionIds || [];
      const assessmentDepth = b.depth || 'quick';

      if (questionIds.length > 0) {
        // Dynamic scoring: look up pillar for each question and sum by pillar
        let questionMeta = [];
        try {
          questionMeta = await sql`SELECT id, pillar, field_name FROM question_bank WHERE id = ANY(${questionIds})`;
        } catch (e) {
          console.warn('question_bank query failed, falling through to legacy scoring:', e.message);
        }

        if (questionMeta.length > 0) {
          const pillarSums = { time: 0, people: 0, influence: 0, numbers: 0, knowledge: 0 };
          const pillarCounts = { time: 0, people: 0, influence: 0, numbers: 0, knowledge: 0 };
          for (const qm of questionMeta) {
            const rawVal = b[qm.field_name];
            const val = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : 0;
            if (isNaN(val)) {
              console.warn(`Non-numeric answer for field ${qm.field_name}: ${rawVal}`);
              continue;
            }
            if (pillarSums.hasOwnProperty(qm.pillar)) {
              pillarSums[qm.pillar] += val;
              if (val > 0) pillarCounts[qm.pillar]++;
            }
          }

          // Normalize pillar scores to 50-point scale (10 questions × 5 max).
          // Quick mode only asks ~5 questions per pillar so we extrapolate:
          //   normalized = (sum / questionsAnswered) * 10
          // This makes quick and extensive scores directly comparable.
          const FULL_QUESTIONS_PER_PILLAR = 10;
          for (const pillar of Object.keys(pillarSums)) {
            const answered = pillarCounts[pillar];
            if (answered > 0 && answered < FULL_QUESTIONS_PER_PILLAR) {
              const avg = pillarSums[pillar] / answered;
              pillarSums[pillar] = Math.round(avg * FULL_QUESTIONS_PER_PILLAR);
            }
          }

          tt = pillarSums.time;
          pt = pillarSums.people;
          it = pillarSums.influence;
          nt = pillarSums.numbers;
          kt = pillarSums.knowledge;

          console.log(`Dynamic scoring (${assessmentDepth}): time=${tt} people=${pt} influence=${it} numbers=${nt} knowledge=${kt} (counts: ${JSON.stringify(pillarCounts)})`);

          // If dynamic scoring produced all zeros but body has legacy fields, fall through
          if (tt === 0 && pt === 0 && it === 0 && nt === 0 && kt === 0) {
            const hasLegacyFields = b.timeAwareness !== undefined || b.trustInvestment !== undefined || b.leadershipLevel !== undefined;
            if (hasLegacyFields) {
              console.warn('Dynamic scoring produced all zeros but legacy fields present — falling through to legacy scoring');
              tt = undefined; // trigger legacy fallback
            }
          }
        }
      }

      // Legacy fallback: hardcoded field sums (backward compatible)
      if (tt === undefined) {
        const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
        tt = num(b.timeAwareness)+num(b.timeAllocation)+num(b.timeProtection)+num(b.timeLeverage)+num(b.fiveHourLeak)+num(b.valuePerHour)+num(b.timeInvestment)+num(b.downtimeQuality)+num(b.foresight)+num(b.timeReallocation);
        pt = num(b.trustInvestment)+num(b.boundaryQuality)+num(b.networkDepth)+num(b.relationalRoi)+num(b.peopleAudit)+num(b.allianceBuilding)+num(b.loveBankDeposits)+num(b.communicationClarity)+num(b.restraintPractice)+num(b.valueReplacement);
        it = num(b.leadershipLevel)+num(b.integrityAlignment)+num(b.professionalCredibility)+num(b.empatheticListening)+num(b.gravitationalCenter)+num(b.microHonesties)+num(b.wordManagement)+num(b.personalResponsibility)+num(b.adaptiveInfluence)+num(b.influenceMultiplier);
        nt = num(b.financialAwareness)+num(b.goalSpecificity)+num(b.investmentLogic)+num(b.measurementHabit)+num(b.costVsValue)+num(b.numberOneClarity)+num(b.smallImprovements)+num(b.negativeMath)+num(b.incomeMultiplier)+num(b.negotiationSkill);
        kt = num(b.learningHours)+num(b.applicationRate)+num(b.biasAwareness)+num(b.highestBestUse)+num(b.supplyAndDemand)+num(b.substitutionRisk)+num(b.doubleJeopardy)+num(b.knowledgeCompounding)+num(b.weightedAnalysis)+num(b.perceptionVsPerspective);

        // For quick mode using legacy fallback, count how many questions were actually
        // answered per pillar and normalize to 50-point scale
        if (assessmentDepth === 'quick') {
          const FULL_Q = 10;
          const countNonZero = (...vals) => vals.filter(v => v > 0).length;
          const normalize = (sum, count) => count > 0 && count < FULL_Q ? Math.round((sum / count) * FULL_Q) : sum;

          const tc = countNonZero(num(b.timeAwareness),num(b.timeAllocation),num(b.timeProtection),num(b.timeLeverage),num(b.fiveHourLeak),num(b.valuePerHour),num(b.timeInvestment),num(b.downtimeQuality),num(b.foresight),num(b.timeReallocation));
          const pc = countNonZero(num(b.trustInvestment),num(b.boundaryQuality),num(b.networkDepth),num(b.relationalRoi),num(b.peopleAudit),num(b.allianceBuilding),num(b.loveBankDeposits),num(b.communicationClarity),num(b.restraintPractice),num(b.valueReplacement));
          const ic = countNonZero(num(b.leadershipLevel),num(b.integrityAlignment),num(b.professionalCredibility),num(b.empatheticListening),num(b.gravitationalCenter),num(b.microHonesties),num(b.wordManagement),num(b.personalResponsibility),num(b.adaptiveInfluence),num(b.influenceMultiplier));
          const nc = countNonZero(num(b.financialAwareness),num(b.goalSpecificity),num(b.investmentLogic),num(b.measurementHabit),num(b.costVsValue),num(b.numberOneClarity),num(b.smallImprovements),num(b.negativeMath),num(b.incomeMultiplier),num(b.negotiationSkill));
          const kc = countNonZero(num(b.learningHours),num(b.applicationRate),num(b.biasAwareness),num(b.highestBestUse),num(b.supplyAndDemand),num(b.substitutionRisk),num(b.doubleJeopardy),num(b.knowledgeCompounding),num(b.weightedAnalysis),num(b.perceptionVsPerspective));

          tt = normalize(tt, tc);
          pt = normalize(pt, pc);
          it = normalize(it, ic);
          nt = normalize(nt, nc);
          kt = normalize(kt, kc);
        }

        console.log(`Legacy scoring (${assessmentDepth}): time=${tt} people=${pt} influence=${it} numbers=${nt} knowledge=${kt}`);
      }

      const rawScore = tt + pt + it + nt + kt;
      const tm = Math.max(0.1, Math.min(2.0, b.timeMultiplier || 1.0));
      const masterScore = Math.round(rawScore * tm * 10) / 10;
      const mode = b.mode || 'individual';
      const assessmentFocusPillar = b.focusPillar || null;

      // Quick and extensive both normalize to 50-point-per-pillar scale (250 max raw).
      // Pillar deep-dive only scores one pillar (max 50 raw).
      const maxRawScore = (assessmentDepth === 'pillar') ? 50 : 250;
      // Apply same multiplier range to max for consistent tier mapping
      const maxMasterScore = maxRawScore * tm;
      const scoreRange = getScoreRange(masterScore, maxMasterScore);

      const aData = {
        contact_id: contact.id, completed_at: new Date().toISOString(), mode,
        team_id: b.teamId || null, is_team_creator: b.isTeamCreator ? 1 : 0,
        time_awareness: b.timeAwareness||1, time_allocation: b.timeAllocation||1, time_protection: b.timeProtection||1, time_leverage: b.timeLeverage||1, five_hour_leak: b.fiveHourLeak||1, value_per_hour: b.valuePerHour||1, time_investment: b.timeInvestment||1, downtime_quality: b.downtimeQuality||1, foresight: b.foresight||1, time_reallocation: b.timeReallocation||1, time_total: tt,
        trust_investment: b.trustInvestment||1, boundary_quality: b.boundaryQuality||1, network_depth: b.networkDepth||1, relational_roi: b.relationalRoi||1, people_audit: b.peopleAudit||1, alliance_building: b.allianceBuilding||1, love_bank_deposits: b.loveBankDeposits||1, communication_clarity: b.communicationClarity||1, restraint_practice: b.restraintPractice||1, value_replacement: b.valueReplacement||1, people_total: pt,
        leadership_level: b.leadershipLevel||1, integrity_alignment: b.integrityAlignment||1, professional_credibility: b.professionalCredibility||1, empathetic_listening: b.empatheticListening||1, gravitational_center: b.gravitationalCenter||1, micro_honesties: b.microHonesties||1, word_management: b.wordManagement||1, personal_responsibility: b.personalResponsibility||1, adaptive_influence: b.adaptiveInfluence||1, influence_multiplier: b.influenceMultiplier||1, influence_total: it,
        financial_awareness: b.financialAwareness||1, goal_specificity: b.goalSpecificity||1, investment_logic: b.investmentLogic||1, measurement_habit: b.measurementHabit||1, cost_vs_value: b.costVsValue||1, number_one_clarity: b.numberOneClarity||1, small_improvements: b.smallImprovements||1, negative_math: b.negativeMath||1, income_multiplier: b.incomeMultiplier||1, negotiation_skill: b.negotiationSkill||1, numbers_total: nt,
        learning_hours: b.learningHours||1, application_rate: b.applicationRate||1, bias_awareness: b.biasAwareness||1, highest_best_use: b.highestBestUse||1, supply_and_demand: b.supplyAndDemand||1, substitution_risk: b.substitutionRisk||1, double_jeopardy: b.doubleJeopardy||1, knowledge_compounding: b.knowledgeCompounding||1, weighted_analysis: b.weightedAnalysis||1, perception_vs_perspective: b.perceptionVsPerspective||1, knowledge_total: kt,
        time_multiplier: tm, raw_score: rawScore, master_score: masterScore, score_range: scoreRange,
        overlay_answers: b.overlayAnswers ? (typeof b.overlayAnswers === 'string' ? b.overlayAnswers : JSON.stringify(b.overlayAnswers)) : null,
        overlay_total: b.overlayTotal || null,
      };

      const prescription = generatePrescription(aData);
      aData.weakest_pillar = prescription.weakestPillar;
      aData.prescription = JSON.stringify(prescription);

      aData.depth = assessmentDepth;
      aData.focus_pillar = assessmentFocusPillar;

      const d = aData;
      const rows = await sql`INSERT INTO assessments (contact_id, completed_at, mode, team_id, is_team_creator, depth, focus_pillar, time_awareness, time_allocation, time_protection, time_leverage, five_hour_leak, value_per_hour, time_investment, downtime_quality, foresight, time_reallocation, time_total, trust_investment, boundary_quality, network_depth, relational_roi, people_audit, alliance_building, love_bank_deposits, communication_clarity, restraint_practice, value_replacement, people_total, leadership_level, integrity_alignment, professional_credibility, empathetic_listening, gravitational_center, micro_honesties, word_management, personal_responsibility, adaptive_influence, influence_multiplier, influence_total, financial_awareness, goal_specificity, investment_logic, measurement_habit, cost_vs_value, number_one_clarity, small_improvements, negative_math, income_multiplier, negotiation_skill, numbers_total, learning_hours, application_rate, bias_awareness, highest_best_use, supply_and_demand, substitution_risk, double_jeopardy, knowledge_compounding, weighted_analysis, perception_vs_perspective, knowledge_total, time_multiplier, raw_score, master_score, score_range, weakest_pillar, prescription, overlay_answers, overlay_total) VALUES (${d.contact_id}, ${d.completed_at}, ${d.mode}, ${d.team_id}, ${d.is_team_creator}, ${d.depth}, ${d.focus_pillar}, ${d.time_awareness}, ${d.time_allocation}, ${d.time_protection}, ${d.time_leverage}, ${d.five_hour_leak}, ${d.value_per_hour}, ${d.time_investment}, ${d.downtime_quality}, ${d.foresight}, ${d.time_reallocation}, ${d.time_total}, ${d.trust_investment}, ${d.boundary_quality}, ${d.network_depth}, ${d.relational_roi}, ${d.people_audit}, ${d.alliance_building}, ${d.love_bank_deposits}, ${d.communication_clarity}, ${d.restraint_practice}, ${d.value_replacement}, ${d.people_total}, ${d.leadership_level}, ${d.integrity_alignment}, ${d.professional_credibility}, ${d.empathetic_listening}, ${d.gravitational_center}, ${d.micro_honesties}, ${d.word_management}, ${d.personal_responsibility}, ${d.adaptive_influence}, ${d.influence_multiplier}, ${d.influence_total}, ${d.financial_awareness}, ${d.goal_specificity}, ${d.investment_logic}, ${d.measurement_habit}, ${d.cost_vs_value}, ${d.number_one_clarity}, ${d.small_improvements}, ${d.negative_math}, ${d.income_multiplier}, ${d.negotiation_skill}, ${d.numbers_total}, ${d.learning_hours}, ${d.application_rate}, ${d.bias_awareness}, ${d.highest_best_use}, ${d.supply_and_demand}, ${d.substitution_risk}, ${d.double_jeopardy}, ${d.knowledge_compounding}, ${d.weighted_analysis}, ${d.perception_vs_perspective}, ${d.knowledge_total}, ${d.time_multiplier}, ${d.raw_score}, ${d.master_score}, ${d.score_range}, ${d.weakest_pillar}, ${d.prescription}, ${d.overlay_answers}, ${d.overlay_total}) RETURNING *`;

      const assessment = rows[0];

      // Auto-insert feedback row for weakness tracking (Feature 4)
      try {
        const allSubs = [
          ...Object.entries(prescription.pillars ? {} : {})  // unused, just for structure
        ];
        // Collect all sub-category scores to find weakest 5
        const subScores = [];
        const pillarSubs = {
          Time: { "Time Awareness": d.time_awareness, "Time Allocation": d.time_allocation, "Time Protection": d.time_protection, "Time Leverage": d.time_leverage, "Five-Hour Leak": d.five_hour_leak, "Value Per Hour": d.value_per_hour, "Time Investment": d.time_investment, "Downtime Quality": d.downtime_quality, "Foresight": d.foresight, "Time Reallocation": d.time_reallocation },
          People: { "Trust Investment": d.trust_investment, "Boundary Quality": d.boundary_quality, "Network Depth": d.network_depth, "Relational ROI": d.relational_roi, "People Audit": d.people_audit, "Alliance Building": d.alliance_building, "Love Bank Deposits": d.love_bank_deposits, "Communication Clarity": d.communication_clarity, "Restraint Practice": d.restraint_practice, "Value Replacement": d.value_replacement },
          Influence: { "Leadership Level": d.leadership_level, "Integrity Alignment": d.integrity_alignment, "Professional Credibility": d.professional_credibility, "Empathetic Listening": d.empathetic_listening, "Gravitational Center": d.gravitational_center, "Micro-Honesties": d.micro_honesties, "Word Management": d.word_management, "Personal Responsibility": d.personal_responsibility, "Adaptive Influence": d.adaptive_influence, "Influence Multiplier": d.influence_multiplier },
          Numbers: { "Financial Awareness": d.financial_awareness, "Goal Specificity": d.goal_specificity, "Investment Logic": d.investment_logic, "Measurement Habit": d.measurement_habit, "Cost vs Value": d.cost_vs_value, "Number One Clarity": d.number_one_clarity, "Small Improvements": d.small_improvements, "Negative Math": d.negative_math, "Income Multiplier": d.income_multiplier, "Negotiation Skill": d.negotiation_skill },
          Knowledge: { "Learning Hours": d.learning_hours, "Application Rate": d.application_rate, "Bias Awareness": d.bias_awareness, "Highest & Best Use": d.highest_best_use, "Supply & Demand": d.supply_and_demand, "Substitution Risk": d.substitution_risk, "Double Jeopardy": d.double_jeopardy, "Knowledge Compounding": d.knowledge_compounding, "Weighted Analysis": d.weighted_analysis, "Perception vs Perspective": d.perception_vs_perspective }
        };
        for (const [pillar, subs] of Object.entries(pillarSubs)) {
          for (const [name, score] of Object.entries(subs)) {
            subScores.push({ pillar, name, score });
          }
        }
        const weakest5 = subScores.filter(s => s.score <= 2).sort((a, b) => a.score - b.score).slice(0, 5);
        await sql`INSERT INTO feedback (contact_id, assessment_id, weakest_pillar, weakest_sub_categories, score_range)
          VALUES (${contact.id}, ${assessment.id}, ${prescription.weakestPillar}, ${JSON.stringify(weakest5)}, ${scoreRange})`;
      } catch (feedbackErr) {
        console.error('Feedback insert error (non-fatal):', feedbackErr.message);
      }

      // Upsert answer_history for each question answered in this session
      if (questionIds.length > 0) {
        try {
          const questionMeta = await sql`SELECT id, field_name FROM question_bank WHERE id = ANY(${questionIds})`;
          let savedCount = 0;
          for (const qm of questionMeta) {
            const rawVal = b[qm.field_name];
            const val = Number(rawVal);
            if (val > 0 && !isNaN(val)) {
              await sql`INSERT INTO answer_history (contact_id, question_id, answer_value, assessment_id, answered_at)
                VALUES (${contact.id}, ${qm.id}, ${val}, ${assessment.id}, NOW())
                ON CONFLICT (contact_id, question_id)
                DO UPDATE SET answer_value = EXCLUDED.answer_value, assessment_id = EXCLUDED.assessment_id, answered_at = NOW()`;
              savedCount++;
            }
          }
          console.log(`answer_history: saved ${savedCount}/${questionMeta.length} answers for contact ${contact.id}, assessment ${assessment.id}`);
        } catch (e) {
          console.error('answer_history upsert error (non-fatal):', e.message);
        }
      }

      // Map snake_case back to camelCase for frontend compatibility
      const mapped = mapAssessment(assessment);

      // === AUTO-EMAIL: Send report email automatically after assessment submission ===
      let emailSent = false;
      const contactEmail = contact.email;

      // --- PAYWALL GATING LOGIC ---
      // Check how many completed assessments this contact has
      let assessmentCount = 1;
      try {
        const countRows = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE contact_id = ${contact.id}`;
        assessmentCount = Number(countRows[0].cnt);
      } catch (e) { /* fallback to 1 */ }

      // Check if user has an active membership
      let hasMembership = false;
      try {
        const memberRows = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contact.id} AND membership_tier IS NOT NULL AND membership_tier != 'free' LIMIT 1`;
        hasMembership = memberRows.length > 0;
      } catch (e) { /* table may not exist */ }

      const isFirstReport = assessmentCount <= 1;
      const sendFullReport = isFirstReport || hasMembership;

      // Ensure report_unlocked column exists (safe ALTER — no-op if already exists)
      try {
        await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_unlocked BOOLEAN DEFAULT FALSE`;
      } catch (e) { /* column may already exist */ }

      if (contactEmail && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const nodemailer = require('nodemailer');
          const efName = contact.first_name || 'there';
          const eMasterScore = masterScore;
          const eScoreRange = scoreRange;
          const eWeakestPillar = prescription.weakestPillar;
          const pillarMax = 50; // all depths now normalized to 50-point scale

          const recTexts = {
            Crisis: "YOUR NEXT STEP: You need the full system. Start with The Value Engine book — the diagnostic that shows you exactly where your life is undervalued. $29 at valuetovictory.com",
            Survival: "YOUR NEXT STEP: You have the awareness. Now build the foundation. The Value Engine book ($29) plus VictoryPath membership ($29/mo) gives you the tools and community to move from Survival to Growth. valuetovictory.com",
            Growth: "YOUR NEXT STEP: You're past the foundation. Accelerate with VictoryPath membership ($29/mo) — structured tools, community accountability, and monthly progress tracking. valuetovictory.com",
            Momentum: "YOUR NEXT STEP: Your score says you're ready for direct coaching. Value Builder membership ($47/mo) or 1:1 coaching ($300/hr, 20% off your first session) will break through the ceiling. valuetovictory.com",
            Mastery: "YOUR NEXT STEP: You're operating at the highest level. Victory VIP ($497/mo) gives you 50% off coaching, a complimentary monthly session, and direct author access. valuetovictory.com",
          };
          const productRec = recTexts[eScoreRange] || recTexts.Growth;

          // FitCarna check
          const fitnessQuestionIds = ['time-21','time-22','people-21','people-22','influence-21','influence-22','numbers-21','numbers-22','knowledge-21','knowledge-22'];
          let fitcarnaSection = '';
          try {
            const fitnessAnswers = await sql`SELECT question_id, answer_value FROM answer_history WHERE contact_id = ${contact.id} AND question_id = ANY(${fitnessQuestionIds})`;
            if (fitnessAnswers.some(fa => fa.answer_value <= 2)) {
              fitcarnaSection = "\nYOUR BODY IS CAPPING YOUR SCORE: Your fitness answers reveal a gap that's limiting every other pillar. We partner with one coach who builds programs for people in your exact position — no gimmicks, just structured accountability and results. See what Cameron builds: valuetovictory.com/fitcarna/\n";
            }
          } catch (e) { /* table may not exist */ }

          let subject, emailBody;

          if (sendFullReport) {
            // FULL REPORT EMAIL (first assessment or member)
            emailBody = `${efName},

Your Value Engine Assessment is complete.

MASTER VALUE SCORE: ${eMasterScore} (${eScoreRange})

Pillar Breakdown:
  Time:      ${tt}/${pillarMax}
  People:    ${pt}/${pillarMax}
  Influence: ${it}/${pillarMax}
  Numbers:   ${nt}/${pillarMax}
  Knowledge: ${kt}/${pillarMax}

Your weakest pillar is ${eWeakestPillar}. ${prescription.diagnosis || ''}

View your full diagnostic report:
https://assessment.valuetovictory.com/report/${assessment.id}

${productRec}
${fitcarnaSection}
Your report includes:
- Detailed sub-category breakdown across all dimensions
- Where you rank against other Value Engine users
- Personalized prescription with specific tools to run
- Your recommended next step

Don't guess. Run the system.

— The Value Engine
   ValueToVictory.com`;
            subject = `Your Value Engine Score: ${eMasterScore} (${eScoreRange}) — Personal Report Ready`;
          } else {
            // TEASER EMAIL (non-first, non-member — report is gated)
            emailBody = `${efName},

Your Value Engine Assessment is complete.

MASTER VALUE SCORE: ${eMasterScore} (${eScoreRange})

Pillar Snapshot:
  Time:      ${tt}/${pillarMax}
  People:    ${pt}/${pillarMax}
  Influence: ${it}/${pillarMax}
  Numbers:   ${nt}/${pillarMax}
  Knowledge: ${kt}/${pillarMax}

Your full diagnostic report is ready — including sub-category breakdowns, cross-pillar impact analysis, personalized prescription, and where you rank against other users.

UNLOCK YOUR FULL REPORT:

Option 1 — Pay $1.99 for this report:
https://assessment.valuetovictory.com/api/checkout?tier=report&aid=${assessment.id}&email=${encodeURIComponent(contactEmail)}

Option 2 — Join VictoryPath ($29/mo) for unlimited reports:
https://buy.stripe.com/9B6dR81WcdusfVL0RK6oo0c

Already a member? Your report is included — check your email or contact support.

View your report page:
https://assessment.valuetovictory.com/report/${assessment.id}

— The Value Engine
   ValueToVictory.com`;
            subject = `Your Value Engine Score: ${eMasterScore} (${eScoreRange}) — Unlock Your Full Report`;
          }

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          await transporter.sendMail({
            from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
            to: contactEmail,
            subject,
            text: emailBody,
          });
          emailSent = true;
          console.log(`Auto-email sent to ${contactEmail} for assessment ${assessment.id} (${sendFullReport ? 'full' : 'teaser'})`);
        } catch (emailErr) {
          console.error('Auto-email FAILED for', contactEmail, ':', emailErr.message);
          // Retry once after 2 second delay
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryTransporter = require('nodemailer').createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            // subject and emailBody already defined above
            await retryTransporter.sendMail({
              from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
              to: contactEmail,
              subject,
              text: emailBody,
            });
            emailSent = true;
            console.log(`Auto-email RETRY succeeded for ${contactEmail}`);
          } catch (retryErr) {
            console.error('Auto-email RETRY also failed for', contactEmail, ':', retryErr.message);
          }
        }
      } else {
        console.warn('Email not sent: missing GMAIL_USER or GMAIL_APP_PASSWORD env vars, or no contact email. Email:', contactEmail, 'GMAIL_USER set:', !!process.env.GMAIL_USER, 'GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);
      }
      // === END AUTO-EMAIL ===

      // Cleanup: delete saved progress now that assessment is fully submitted
      try {
        await sql`DELETE FROM assessment_progress WHERE contact_id = ${contact.id}`;
      } catch (e) { /* table may not exist — that's fine */ }

      return res.json({ assessment: mapped, prescription, contact: { id: contact.id, firstName: contact.first_name, lastName: contact.last_name }, emailSent, emailError: !emailSent ? 'Your results are saved but the email delivery encountered an issue. You can view your report at the link below.' : null, depth: assessmentDepth, focusPillar: assessmentFocusPillar });
    }

    // POST /api/teams
    if (req.method === 'POST' && url === '/teams') {
      const b = req.body || {};
      const code = Math.random().toString(36).substring(2, 10);
      const rows = await sql`INSERT INTO teams (name, mode, created_by, invite_code, created_at) VALUES (${b.name}, ${b.mode}, ${b.contactId}, ${code}, ${new Date().toISOString()}) RETURNING *`;
      return res.json(rows[0]);
    }

    // GET /api/teams/invite/:code
    if (req.method === 'GET' && url.startsWith('/teams/invite/')) {
      const code = url.split('/teams/invite/')[1];
      const rows = await sql`SELECT * FROM teams WHERE invite_code = ${code} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
      const team = rows[0];
      const creator = await sql`SELECT * FROM contacts WHERE id = ${team.created_by} LIMIT 1`;
      return res.json({ ...team, creatorName: creator.length > 0 ? `${creator[0].first_name} ${creator[0].last_name}` : 'Unknown' });
    }

    // GET /api/teams/:id/results
    if (req.method === 'GET' && url.match(/^\/teams\/\d+\/results$/)) {
      const teamId = parseInt(url.split('/')[2]);
      const members = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.team_id = ${teamId} ORDER BY a.completed_at DESC`;
      const ratings = await sql`SELECT * FROM peer_ratings WHERE team_id = ${teamId}`;
      return res.json({ members: members.map(mapAssessment), ratings });
    }

    // POST /api/peer-rating
    if (req.method === 'POST' && url === '/peer-rating') {
      const b = req.body || {};
      const ratingsJson = typeof b.ratings === 'string' ? b.ratings : JSON.stringify(b.ratings || {});
      const total = typeof b.ratings === 'object' ? Object.values(b.ratings).reduce((s,v) => s + v, 0) : 0;
      const rows = await sql`INSERT INTO peer_ratings (team_id, rater_id, target_id, ratings, ratings_total, created_at) VALUES (${b.teamId}, ${b.raterId}, ${b.targetId}, ${ratingsJson}, ${total}, ${new Date().toISOString()}) RETURNING *`;
      return res.json(rows[0]);
    }

    // GET /api/admin/contacts
    if (req.method === 'GET' && url === '/admin/contacts') {
      const allContacts = await sql`SELECT * FROM contacts ORDER BY created_at DESC`;
      const enriched = [];
      for (const c of allContacts) {
        const ca = await sql`SELECT * FROM assessments WHERE contact_id = ${c.id} ORDER BY completed_at DESC`;
        enriched.push({ ...c, firstName: c.first_name, lastName: c.last_name, latestAssessment: ca.length > 0 ? mapAssessment(ca[0]) : null, assessmentCount: ca.length });
      }
      return res.json(enriched);
    }

    // GET /api/admin/contacts/:id
    if (req.method === 'GET' && url.match(/^\/admin\/contacts\/\d+$/)) {
      const id = parseInt(url.split('/').pop());
      const rows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const contact = { ...rows[0], firstName: rows[0].first_name, lastName: rows[0].last_name };
      const ca = await sql`SELECT * FROM assessments WHERE contact_id = ${id} ORDER BY completed_at DESC`;
      return res.json({ contact, assessments: ca.map(mapAssessment) });
    }

    // GET /api/admin/analytics
    if (req.method === 'GET' && url === '/admin/analytics') {
      const dist = await sql`SELECT score_range as range, COUNT(*) as count FROM assessments GROUP BY score_range`;
      const avgs = await sql`SELECT AVG(time_total) as t, AVG(people_total) as p, AVG(influence_total) as i, AVG(numbers_total) as n, AVG(knowledge_total) as k FROM assessments`;
      const recent = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 10`;
      const totalC = await sql`SELECT COUNT(*) as count FROM contacts`;
      const totalA = await sql`SELECT COUNT(*) as count FROM assessments`;
      const a = avgs[0] || {};
      return res.json({
        distribution: dist.map(r => ({ range: r.range, count: Number(r.count) })),
        averages: [
          { pillar: "Time", avg: Math.round((Number(a.t)||0)*10)/10 },
          { pillar: "People", avg: Math.round((Number(a.p)||0)*10)/10 },
          { pillar: "Influence", avg: Math.round((Number(a.i)||0)*10)/10 },
          { pillar: "Numbers", avg: Math.round((Number(a.n)||0)*10)/10 },
          { pillar: "Knowledge", avg: Math.round((Number(a.k)||0)*10)/10 },
        ],
        recent: recent.map(r => ({ ...mapAssessment(r), contact: { firstName: r.first_name, lastName: r.last_name, email: r.email } })),
        totalContacts: Number(totalC[0]?.count || 0),
        totalAssessments: Number(totalA[0]?.count || 0),
      });
    }

    // GET /api/admin/export (CSV)
    if (req.method === 'GET' && url === '/admin/export') {
      const all = await sql`SELECT a.*, c.first_name, c.last_name, c.email, c.phone FROM assessments a JOIN contacts c ON a.contact_id = c.id ORDER BY a.completed_at DESC`;
      let csv = "First Name,Last Name,Email,Phone,Date,Time,People,Influence,Numbers,Knowledge,Raw,Multiplier,Master Score,Range,Weakest,Depth,Focus Pillar,Impact From,Impact To,Impact Severity\n";
      for (const r of all) {
        // Extract cross-pillar impact from stored prescription
        let impactFrom = '', impactTo = '', impactSeverity = '';
        try {
          const rx = typeof r.prescription === 'string' ? JSON.parse(r.prescription) : (r.prescription || {});
          if (rx.crossPillarImpact && rx.crossPillarImpact.primaryImpact) {
            impactFrom = rx.crossPillarImpact.primaryImpact.from || '';
            impactTo = rx.crossPillarImpact.primaryImpact.to || '';
            impactSeverity = rx.crossPillarImpact.severity || '';
          }
        } catch (e) { /* prescription parse error — skip */ }
        csv += `"${r.first_name}","${r.last_name}","${r.email}","${r.phone||''}","${r.completed_at}",${r.time_total},${r.people_total},${r.influence_total},${r.numbers_total},${r.knowledge_total},${r.raw_score},${r.time_multiplier},${r.master_score},"${r.score_range}","${r.weakest_pillar}","${r.depth||'extensive'}","${r.focus_pillar||''}","${impactFrom}","${impactTo}","${impactSeverity}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=value-engine-export.csv');
      return res.send(csv);
    }

    // POST /api/admin/hubspot-sync (placeholder)
    if (req.method === 'POST' && url === '/admin/hubspot-sync') {
      return res.json({ synced: 0, failed: 0, total: 0, message: "HubSpot sync coming soon" });
    }

    // GET /api/admin/question-bank
    if (req.method === 'GET' && url === '/admin/question-bank') {
      try {
        const questions = await sql`
          SELECT qb.*,
            COALESCE(stats.answer_count, 0) as answer_count,
            COALESCE(stats.avg_score, 0) as avg_score
          FROM question_bank qb
          LEFT JOIN (
            SELECT question_id, COUNT(*) as answer_count, AVG(answer_value) as avg_score
            FROM answer_history GROUP BY question_id
          ) stats ON qb.id = stats.question_id
          ORDER BY qb.sort_order ASC
        `;
        return res.json(questions.map(q => ({
          id: q.id,
          pillar: q.pillar,
          subCategory: q.sub_category,
          fieldName: q.field_name,
          question: q.question,
          description: q.description,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          isActive: q.is_active,
          isOverlay: q.is_overlay,
          overlayType: q.overlay_type,
          sortOrder: q.sort_order,
          createdAt: q.created_at,
          answerCount: Number(q.answer_count),
          avgScore: Math.round(Number(q.avg_score) * 10) / 10,
        })));
      } catch (e) {
        return res.json({ error: 'Question bank not initialized. Run /api/migrate-question-system first.', details: e.message });
      }
    }

    // POST /api/admin/questions — add new questions to the bank
    if (req.method === 'POST' && url === '/admin/questions') {
      const b = req.body || {};
      const questions = b.questions || [];
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Provide a questions array' });
      }

      const results = [];
      for (const q of questions) {
        if (!q.id || !q.pillar || !q.fieldName || !q.question || !q.options) {
          results.push({ id: q.id, error: 'Missing required fields (id, pillar, fieldName, question, options)' });
          continue;
        }
        try {
          const opts = typeof q.options === 'string' ? q.options : JSON.stringify(q.options);
          await sql`INSERT INTO question_bank (id, pillar, sub_category, field_name, question, description, options, is_overlay, overlay_type, sort_order)
            VALUES (${q.id}, ${q.pillar}, ${q.subCategory || q.fieldName}, ${q.fieldName}, ${q.question}, ${q.description || ''}, ${opts}::jsonb, ${q.isOverlay || false}, ${q.overlayType || null}, ${q.sortOrder || 0})
            ON CONFLICT (id) DO UPDATE SET
              question = EXCLUDED.question,
              description = EXCLUDED.description,
              options = EXCLUDED.options,
              is_active = true`;
          results.push({ id: q.id, success: true });
        } catch (e) {
          results.push({ id: q.id, error: e.message });
        }
      }
      return res.json({ results, added: results.filter(r => r.success).length, failed: results.filter(r => r.error).length });
    }

    // GET /api/benchmarks?assessmentId={id}
    if (req.method === 'GET' && url.startsWith('/benchmarks')) {
      const params = new URL('http://x' + req.url).searchParams;
      const assessmentId = params.get('assessmentId');
      if (!assessmentId) return res.status(400).json({ error: 'assessmentId required' });

      const aRows = await sql`SELECT * FROM assessments WHERE id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];

      const totalRows = await sql`SELECT COUNT(*) as cnt FROM assessments`;
      const total = Number(totalRows[0].cnt);

      const belowMaster = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE master_score < ${a.master_score}`;
      const belowTime = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE time_total < ${a.time_total}`;
      const belowPeople = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE people_total < ${a.people_total}`;
      const belowInfluence = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE influence_total < ${a.influence_total}`;
      const belowNumbers = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE numbers_total < ${a.numbers_total}`;
      const belowKnowledge = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE knowledge_total < ${a.knowledge_total}`;

      const pct = (below) => total > 0 ? Math.round((Number(below[0].cnt) / total) * 100) : 0;

      return res.json({
        assessmentId: Number(assessmentId),
        totalAssessments: total,
        percentiles: {
          masterScore: pct(belowMaster),
          time: pct(belowTime),
          people: pct(belowPeople),
          influence: pct(belowInfluence),
          numbers: pct(belowNumbers),
          knowledge: pct(belowKnowledge),
        }
      });
    }

    // GET /api/report/{assessmentId}
    if (req.method === 'GET' && url.match(/^\/report\/\d+$/)) {
      const assessmentId = parseInt(url.split('/report/')[1]);

      const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];
      const assessment = mapAssessment(a);
      const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : a.prescription;

      // Benchmarks
      const totalRows = await sql`SELECT COUNT(*) as cnt FROM assessments`;
      const total = Number(totalRows[0].cnt);
      const belowMaster = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE master_score < ${a.master_score}`;
      const belowTime = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE time_total < ${a.time_total}`;
      const belowPeople = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE people_total < ${a.people_total}`;
      const belowInfluence = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE influence_total < ${a.influence_total}`;
      const belowNumbers = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE numbers_total < ${a.numbers_total}`;
      const belowKnowledge = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE knowledge_total < ${a.knowledge_total}`;
      const pct = (below) => total > 0 ? Math.round((Number(below[0].cnt) / total) * 100) : 0;
      const percentiles = {
        masterScore: pct(belowMaster),
        time: pct(belowTime),
        people: pct(belowPeople),
        influence: pct(belowInfluence),
        numbers: pct(belowNumbers),
        knowledge: pct(belowKnowledge),
      };

      // Fitness question answers
      const fitnessQuestionIds = ['time-21','time-22','people-21','people-22','influence-21','influence-22','numbers-21','numbers-22','knowledge-21','knowledge-22'];
      let fitnessAnswers = [];
      let hasFitnessFlag = false;
      try {
        fitnessAnswers = await sql`SELECT question_id, answer_value FROM answer_history WHERE contact_id = ${a.contact_id} AND question_id = ANY(${fitnessQuestionIds})`;
        hasFitnessFlag = fitnessAnswers.some(fa => fa.answer_value <= 2);
      } catch (e) { /* table may not exist */ }

      // Profiling question answers for cognitive insights
      const profilingIds = [
        'numbers-12','numbers-13','numbers-14','numbers-15','numbers-18','numbers-19','time-13',
        'time-15','influence-11','influence-14','influence-20','knowledge-13','knowledge-20',
        'time-18','time-12','numbers-17',
        'people-14','people-17','people-18','knowledge-11','knowledge-12',
        'people-15','people-16','influence-12','influence-15'
      ];
      let profilingAnswers = [];
      try {
        profilingAnswers = await sql`SELECT question_id, answer_value FROM answer_history WHERE contact_id = ${a.contact_id} AND question_id = ANY(${profilingIds})`;
      } catch (e) { /* table may not exist */ }

      // Generate cognitive insights
      const answerMap = {};
      profilingAnswers.forEach(pa => { answerMap[pa.question_id] = pa.answer_value; });
      const insights = [];
      if (answerMap['time-15'] && answerMap['time-15'] <= 2) insights.push("You're in survival mode. The prescription isn't more hustle — it's better systems.");
      if (answerMap['numbers-12'] && answerMap['numbers-12'] <= 2) insights.push("Your financial runway is dangerously short. This limits every decision you make.");
      if (answerMap['people-15'] && answerMap['people-15'] <= 2) insights.push("You're trying to do this alone. The data says that cuts your success rate by 95%.");
      if (answerMap['people-16'] && answerMap['people-16'] <= 2) insights.push("Your inner circle isn't pushing you forward. That's a ceiling on every pillar.");
      if (answerMap['influence-12'] && answerMap['influence-12'] <= 2) insights.push("Your ideas don't have a platform. That caps your influence at arm's length.");
      if (answerMap['influence-11'] && answerMap['influence-11'] <= 2) insights.push("Your income depends on someone else's brand. That's a vulnerability.");
      if (answerMap['knowledge-20'] && answerMap['knowledge-20'] <= 2) insights.push("You're getting paid for labor, not expertise. That's the wrong side of the value equation.");

      // Product recommendation based on score range
      const scoreRange = a.score_range;
      const productRecommendations = {
        Crisis: { title: 'Start Here', product: 'The Value Engine Book', price: '$29', description: 'The diagnostic that shows you exactly where your life is undervalued.' },
        Survival: { title: 'Build Your Foundation', product: 'Book + VictoryPath Membership', price: '$29 + $29/mo', description: 'The tools and community to move from Survival to Growth.' },
        Growth: { title: 'Accelerate Your Growth', product: 'VictoryPath Membership', price: '$29/mo', description: 'Structured tools, community accountability, and monthly progress tracking.' },
        Momentum: { title: 'Break Through', product: 'Value Builder or 1:1 Coaching', price: '$47/mo or $300/hr (20% off first session)', description: 'Direct coaching to break through the ceiling.' },
        Mastery: { title: 'Go Elite', product: 'Victory VIP', price: '$497/mo', description: '50% off coaching, complimentary monthly session, and direct author access.' },
      };
      const recommendation = productRecommendations[scoreRange] || productRecommendations.Growth;

      // Challenge status
      let challenge = null;
      try {
        const challengeRows = await sql`SELECT * FROM challenges WHERE contact_id = ${a.contact_id} ORDER BY enrolled_at DESC LIMIT 1`;
        if (challengeRows.length > 0) {
          const c = challengeRows[0];
          const now = new Date();
          const day90 = new Date(c.day_90_date);
          const daysRemaining = Math.max(0, Math.ceil((day90 - now) / (1000 * 60 * 60 * 24)));
          challenge = { id: c.id, status: c.status, enrolledAt: c.enrolled_at, day90Date: c.day_90_date, daysRemaining, baselineAssessmentId: c.baseline_assessment_id, reassessmentId: c.reassessment_id };
        }
      } catch (e) { /* table may not exist */ }

      // Total questions info
      let totalAvailable = 0;
      let totalAnswered = 0;
      try {
        const countResult = await sql`SELECT COUNT(*) as cnt FROM question_bank WHERE is_active = true`;
        totalAvailable = Number(countResult[0]?.cnt || 0);
        const answeredResult = await sql`SELECT COUNT(*) as cnt FROM answer_history WHERE contact_id = ${a.contact_id}`;
        totalAnswered = Number(answeredResult[0]?.cnt || 0);
      } catch (e) { /* tables may not exist */ }

      // --- GATING LOGIC for report endpoint ---
      // Ensure column exists
      try {
        await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_unlocked BOOLEAN DEFAULT FALSE`;
      } catch (e) { /* column may already exist */ }

      // Check if this is the contact's first assessment
      let reportContactAssessmentCount = 0;
      try {
        const rcRows = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE contact_id = ${a.contact_id}`;
        reportContactAssessmentCount = Number(rcRows[0].cnt);
      } catch (e) { /* fallback */ }
      const reportIsFirst = reportContactAssessmentCount <= 1;

      // Check membership
      let reportHasMembership = false;
      try {
        const mRows = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${a.contact_id} AND membership_tier IS NOT NULL AND membership_tier != 'free' LIMIT 1`;
        reportHasMembership = mRows.length > 0;
      } catch (e) { /* table may not exist */ }

      // Check if payment unlocked this report
      const reportPaymentUnlocked = !!(a.report_unlocked);

      const reportGated = !reportIsFirst && !reportHasMembership && !reportPaymentUnlocked;

      return res.json({
        assessment,
        contact: { firstName: a.first_name, lastName: a.last_name, email: a.email },
        prescription,
        percentiles,
        totalAssessments: total,
        fitnessAnswers: fitnessAnswers.map(fa => ({ questionId: fa.question_id, value: fa.answer_value })),
        hasFitnessFlag,
        insights,
        recommendation,
        challenge,
        questionsAnswered: totalAnswered,
        questionsAvailable: totalAvailable,
        depth: a.depth || 'extensive',
        focusPillar: a.focus_pillar || null,
        isFirstReport: reportIsFirst,
        isMember: reportHasMembership,
        gated: reportGated,
      });
    }

    // POST /api/send-report
    if (req.method === 'POST' && url === '/send-report') {
      const b = req.body || {};
      const assessmentId = b.assessmentId;
      if (!assessmentId) return res.status(400).json({ error: 'assessmentId required' });

      const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];

      if (!a.email) return res.status(400).json({ error: 'No email on file for this contact' });

      // Allow overriding recipient email (for admin preview)
      const recipientEmail = b.overrideEmail || a.email;

      const firstName = a.first_name || 'there';
      const masterScore = a.master_score;
      const scoreRange = a.score_range;
      const weakestPillar = a.weakest_pillar;
      const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});

      // Product recommendation text by range — HARD RULE PRICING
      const recTexts = {
        Crisis: "YOUR NEXT STEP: You need the full system. Start with The Value Engine book \u2014 the diagnostic that shows you exactly where your life is undervalued. $29 at valuetovictory.com",
        Survival: "YOUR NEXT STEP: You have the awareness. Now build the foundation. The Value Engine book ($29) plus VictoryPath membership ($29/mo) gives you the tools and community to move from Survival to Growth. valuetovictory.com",
        Growth: "YOUR NEXT STEP: You're past the foundation. Accelerate with VictoryPath membership ($29/mo) \u2014 structured tools, community accountability, and monthly progress tracking. valuetovictory.com",
        Momentum: "YOUR NEXT STEP: Your score says you're ready for direct coaching. Value Builder membership ($47/mo) or 1:1 coaching ($300/hr, 20% off your first session) will break through the ceiling. valuetovictory.com",
        Mastery: "YOUR NEXT STEP: You're operating at the highest level. Victory VIP ($497/mo) gives you 50% off coaching, a complimentary monthly session, and direct author access. valuetovictory.com",
      };
      const productRec = recTexts[scoreRange] || recTexts.Growth;

      // FitCarna section
      const fitnessQuestionIds = ['time-21','time-22','people-21','people-22','influence-21','influence-22','numbers-21','numbers-22','knowledge-21','knowledge-22'];
      let fitcarnaSection = '';
      try {
        const fitnessAnswers = await sql`SELECT question_id, answer_value FROM answer_history WHERE contact_id = ${a.contact_id} AND question_id = ANY(${fitnessQuestionIds})`;
        if (fitnessAnswers.some(fa => fa.answer_value <= 2)) {
          fitcarnaSection = "\nYOUR BODY IS CAPPING YOUR SCORE: Your fitness answers reveal a gap that's limiting every other pillar. We partner with one coach who builds programs for people in your exact position \u2014 no gimmicks, just structured accountability and results. See what Cameron builds: valuetovictory.com/fitcarna/\n";
        }
      } catch (e) { /* table may not exist */ }

      // --- Pillar data ---
      const reportDepth = a.depth || 'extensive';
      const reportPillarMax = 50; // all depths normalized to 50-point scale
      const pillars = [
        { key: 'Time', icon: '&#9201;', score: Number(a.time_total) || 0 },
        { key: 'People', icon: '&#128101;', score: Number(a.people_total) || 0 },
        { key: 'Influence', icon: '&#9889;', score: Number(a.influence_total) || 0 },
        { key: 'Numbers', icon: '&#128200;', score: Number(a.numbers_total) || 0 },
        { key: 'Knowledge', icon: '&#128218;', score: Number(a.knowledge_total) || 0 },
      ];
      const belowThreshold = 35; // 35/50 ~ 70%
      const pillarsBelow35 = pillars.filter(p => p.score < belowThreshold);

      // Per-pillar action items (from spec)
      const pillarActionItems = {
        Time: [
          "Run the Time Audit (Tool #2) \u2014 Track every hour for 3 days. Find your Five-Hour Leak. Most people discover 5-10 hours of wasted time they never knew about.",
          "Identify your peak productive hours and protect them. Block them on your calendar. Tell people they\u2019re non-negotiable.",
          "Use the Time Reallocation Planner (Tool #9) \u2014 Sort your week by Covey Quadrant. Move 3 hours from Q3/Q4 to Q2 activities.",
          "Calculate your Value Per Hour (Tool #5) \u2014 Know what one hour of your time is actually worth. Then refuse to spend it on anything below that number.",
        ],
        People: [
          "Run the People Audit (Tool #3) \u2014 Map your top 15 relationships as Givers, Receivers, Exchangers, or Takers. The truth will surprise you.",
          "Identify your 4 Alliances (Tool #6) \u2014 Who are your Confidants, Constituents, Comrades, and Companions? Each serves a different purpose.",
          "Make 3 intentional Love Bank deposits this week \u2014 a genuine compliment, an act of service, quality time with someone who matters.",
          "Use the Communicate-Clarify-Question framework in one difficult conversation this week. State it clearly, verify understanding, then ask the real question.",
        ],
        Influence: [
          "Identify your Gravitational Center (Tool #11) \u2014 Audit your calendar and bank statement against your stated values. Where does your time and money actually go?",
          "Eliminate one micro-dishonesty this week. The small exaggerations and omissions cost more trust than you think.",
          "Practice the Four Questions Before You Speak \u2014 Is it true? Is it kind? Is it necessary? Is it the right time?",
          "Under-promise and over-deliver in one key relationship this week. Precision in language builds influence faster than anything.",
        ],
        Numbers: [
          "Run the Financial Snapshot (Tool #4) \u2014 Document actual income, expenses, surplus/deficit, and real cost per hour. No rounding. No guessing. 30 minutes that change everything.",
          "Calculate your Value Per Hour (Tool #5) \u2014 What is one hour of your time actually worth in the marketplace? Not your salary divided by 40 \u2014 your real output value.",
          "Identify your Number One (Tool #7) \u2014 The single metric that matters most to your progress right now. Track it daily.",
          "Use the Income Multiplier Model (Tool #12) \u2014 Map how small improvements compound over 90 days. A 1% daily improvement = 37x in a year.",
        ],
        Knowledge: [
          "Audit your learning hours \u2014 How much time do you spend consuming information versus implementing what you\u2019ve learned? The goal is a 1:1 ratio.",
          "Identify your Highest and Best Use (Tool #13) \u2014 What are you uniquely qualified to do? Stop learning things outside your zone.",
          "Apply one thing you learned this week before learning anything new. Knowledge without application is just trivia.",
          "Assess your Substitution Risk \u2014 How easily could someone replace what you know? If the answer is \u2018easily,\u2019 you need deeper expertise.",
        ],
      };

      // Build plain text cross-pillar and roadmap sections
      let crossPillarPlainText = '';
      try {
        const rxData = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});
        const cpi = rxData.crossPillarImpact || {};
        const pi = cpi.primaryImpact;
        if (pi && pi.headline) {
          crossPillarPlainText = `\nCROSS-PILLAR IMPACT: ${pi.from} \u2192 ${pi.to}\n"${pi.headline}"\n${pi.explanation || ''}\n`;
        }
      } catch (e) { /* no cross-pillar data */ }
      let roadmapText = '';
      if (pillarsBelow35.length > 0) {
        roadmapText = '\n--- YOUR IMPROVEMENT ROADMAP ---\n';
        for (const p of pillarsBelow35) {
          roadmapText += `\n${p.key.toUpperCase()} (${p.score}/${reportPillarMax}) \u2014 Action Items:\n`;
          const items = pillarActionItems[p.key] || [];
          items.forEach((item, i) => { roadmapText += `  ${i + 1}. ${item}\n`; });
        }
      } else {
        roadmapText = '\n--- MAINTAIN YOUR EDGE ---\nAll your pillars are at 35 or above. You are operating at a high level. Here are tips to stay sharp:\n  1. Schedule a quarterly reassessment to track your trajectory and catch any drift before it becomes a slide.\n  2. Identify one pillar to push from good to exceptional this quarter. Mastery is not about fixing weaknesses \u2014 it is about compounding strengths.\n  3. Mentor or teach what you know. The fastest way to deepen expertise is to help someone else build theirs.\n';
      }

      const emailBody = `${firstName},

Your Value Engine Assessment is complete.

MASTER VALUE SCORE: ${masterScore} (${scoreRange})

Pillar Breakdown:
  Time:      ${a.time_total}/${reportPillarMax}
  People:    ${a.people_total}/${reportPillarMax}
  Influence: ${a.influence_total}/${reportPillarMax}
  Numbers:   ${a.numbers_total}/${reportPillarMax}
  Knowledge: ${a.knowledge_total}/${reportPillarMax}

Your biggest opportunity for growth is ${weakestPillar}. ${prescription.diagnosis || ''}
${crossPillarPlainText}${roadmapText}
View your full diagnostic report:
https://assessment.valuetovictory.com/report/${assessmentId}

${productRec}
${fitcarnaSection}
Your report includes:
- Detailed sub-category breakdown across all dimensions
- Where you rank against other Value Engine users
- Personalized prescription with specific tools to run
- Your recommended next step

Don't guess. Run the system.

\u2014 The Value Engine
   ValueToVictory.com`;

      // --- Rich HTML email generation ---
      const maxPillar = pillars.reduce((best, p) => p.score > best.score ? p : best, pillars[0]);
      const minPillar = pillars.reduce((best, p) => p.score < best.score ? p : best, pillars[0]);

      // Encouraging pillar diagnosis (opportunity framing)
      const pillarDiagnosis = {
        Time: 'You have the most room to grow here \u2014 and that is exciting. The hours you reclaim will compound into everything else you are building.',
        People: 'This is where your next breakthrough lives. The right relationships do not just add value \u2014 they multiply it.',
        Influence: 'You have more impact potential than your score reflects. Small shifts in how you lead and communicate will unlock outsized results.',
        Numbers: 'The gap between your goals and your numbers is not a failure \u2014 it is a map. Once you see it clearly, you can close it fast.',
        Knowledge: 'You are closer than you think. The difference between knowing and earning is application \u2014 and that is a skill you can build.',
      };

      // Encouraging tier descriptions
      const tierDescriptions = {
        Crisis: 'Every victory starts with knowing where you stand \u2014 and you just took that step. That takes courage. Most people never even look in the mirror. You did \u2014 and now you know exactly where to focus.',
        Survival: 'You showed up. That takes courage. Most people never even look in the mirror. You did \u2014 and now you know exactly where to focus.',
        Growth: 'You have a real foundation. That is not nothing \u2014 that is everything. The people who reach Momentum are the ones who build on what they already have.',
        Momentum: 'You are moving. Most people never get here. You have built something real \u2014 now it is time to refine it.',
        Excellence: 'You are operating at a high level. The system is working. Fine-tuning and leverage are your edge now.',
        Mastery: 'You are operating at the highest level. The system is working. The question now is: who are you bringing with you?',
      };

      // Tier configuration \u2014 HARD RULE PRICING: VictoryPath $29/mo, Value Builder $47/mo, Victory VIP $497/mo
      const tierConfig = {
        Crisis:     { color: '#e74c3c', bg: '#2a1a1a', border: '#c0392b', arrow: '&#9660;', cta: 'Ready to Build Your Foundation?', product: 'VictoryPath', promo: '$29', full: '$49', promoNum: '29' },
        Survival:   { color: '#e74c3c', bg: '#2a1a1a', border: '#c0392b', arrow: '&#9660;', cta: 'Ready to Build Your Foundation?', product: 'VictoryPath', promo: '$29', full: '$49', promoNum: '29' },
        Growth:     { color: '#2ecc71', bg: '#1a2a1a', border: '#27ae60', arrow: '&#9650;', cta: 'Ready to Move Into Momentum?', product: 'VictoryPath', promo: '$29', full: '$49', promoNum: '29' },
        Momentum:   { color: '#d4a853', bg: '#2a2518', border: '#c89030', arrow: '&#9650;', cta: 'Ready to Break Through?', product: 'Value Builder', promo: '$47', full: '$79', promoNum: '47' },
        Excellence: { color: '#9b59b6', bg: '#1f1a2a', border: '#8e44ad', arrow: '&#9733;', cta: 'Ready to Go Elite?', product: 'Victory VIP', promo: '$497', full: '$697', promoNum: '497' },
        Mastery:    { color: '#9b59b6', bg: '#1f1a2a', border: '#8e44ad', arrow: '&#9733;', cta: 'Ready to Go Elite?', product: 'Victory VIP', promo: '$497', full: '$697', promoNum: '497' },
      };
      const tier = tierConfig[scoreRange] || tierConfig.Growth;

      function buildPillarRowHtml(p) {
        const isStrongest = p.key === maxPillar.key;
        const isWeakest = p.key === minPillar.key;
        const pct = Math.round((p.score / reportPillarMax) * 100);
        let barColor, barGradStart, scoreColor, badge;
        if (isWeakest) {
          barColor = '#e74c3c'; barGradStart = '#c0392b'; scoreColor = '#e74c3c';
          badge = '<span style="display:inline-block;background:#2a1a1a;border:1px solid #c0392b;border-radius:3px;padding:1px 7px;font-size:10px;color:#e74c3c;margin-left:8px;vertical-align:middle;text-transform:uppercase;letter-spacing:0.5px;">Biggest Opportunity</span>';
        } else if (isStrongest) {
          barColor = '#2ecc71'; barGradStart = '#1e8449'; scoreColor = '#2ecc71';
          badge = '<span style="display:inline-block;background:#1a3320;border:1px solid #27ae60;border-radius:3px;padding:1px 7px;font-size:10px;color:#2ecc71;margin-left:8px;vertical-align:middle;text-transform:uppercase;letter-spacing:0.5px;">Strongest</span>';
        } else {
          barColor = '#d4a853'; barGradStart = '#c89030'; scoreColor = '#d4a853';
          badge = '';
        }
        const isLast = p.key === 'Knowledge';
        const bottomPad = isLast ? '24px' : '14px';
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px ${bottomPad} 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;padding-bottom:6px;">${p.icon} ${p.key} ${badge}</td><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${scoreColor};text-align:right;padding-bottom:6px;">${p.score} / ${reportPillarMax}</td></tr><tr><td colspan="2"><div style="background:#2a2a44;border-radius:6px;height:10px;width:100%;overflow:hidden;"><div style="background:linear-gradient(90deg,${barGradStart},${barColor});height:10px;width:${pct}%;border-radius:6px;"></div></div></td></tr></table></td></tr></table>`;
      }

      function buildActionCardHtml(stepText, num, isLast) {
        const bottomPad = isLast ? '24px' : '12px';
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px ${bottomPad} 40px;"><div style="background:#22223a;border-radius:8px;padding:20px 24px;border:1px solid #2a2a4a;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="width:44px;vertical-align:top;"><div style="width:36px;height:36px;background:linear-gradient(135deg,#d4a853,#e8c775);border-radius:50%;text-align:center;line-height:36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#1a1a2e;">${num}</div></td><td style="vertical-align:top;padding-left:12px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8888a8;line-height:1.5;">${stepText}</p></td></tr></table></div></td></tr></table>`;
      }

      // Build per-pillar roadmap sections for pillars below 35
      function buildPillarRoadmapSection(pillarKey, pillarScore, pillarIcon) {
        const items = pillarActionItems[pillarKey] || [];
        let html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:8px 40px 4px 40px;"><h3 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;">${pillarIcon} ${pillarKey} <span style="color:#d4a853;">(${pillarScore}/${reportPillarMax})</span></h3><p style="margin:4px 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6a6a84;">Where you have the most room to grow</p></td></tr></table>`;
        items.forEach((item, i) => {
          html += buildActionCardHtml(item, i + 1, i === items.length - 1);
        });
        return html;
      }

      let roadmapHtml = '';
      if (pillarsBelow35.length > 0) {
        roadmapHtml = `
<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Improvement Roadmap Header -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:24px 40px 16px 40px;"><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#d4a853;text-transform:uppercase;letter-spacing:1px;">&#127942; Your Improvement Roadmap</h2><p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a0a0b8;line-height:1.5;">Every pillar below 35 gets a focused action plan. These are your highest-leverage moves.</p></td></tr></table>

${pillarsBelow35.map(p => buildPillarRoadmapSection(p.key, p.score, p.icon)).join('\n')}`;
      } else {
        roadmapHtml = `
<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Maintain Your Edge -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:24px 40px 16px 40px;"><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#d4a853;text-transform:uppercase;letter-spacing:1px;">&#128170; Maintain Your Edge</h2><p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a0a0b8;line-height:1.5;">All your pillars are at 35 or above. You are operating at a high level. Here is how to stay sharp.</p></td></tr></table>
${buildActionCardHtml('Schedule a quarterly reassessment to track your trajectory and catch any drift before it becomes a slide.', 1, false)}
${buildActionCardHtml('Identify one pillar to push from good to exceptional this quarter. Mastery is not about fixing weaknesses \u2014 it is about compounding strengths.', 2, false)}
${buildActionCardHtml('Mentor or teach what you know. The fastest way to deepen expertise is to help someone else build theirs.', 3, true)}`;
      }

      const weakDiag = pillarDiagnosis[minPillar.key] || pillarDiagnosis.Time;

      // Cross-Pillar Impact section for email
      const cpi = prescription.crossPillarImpact;
      let crossPillarEmailHtml = '';
      // crossPillarPlainText already declared above — reassign with full detail here
      if (cpi && cpi.primaryImpact && cpi.severity !== 'balanced') {
        const pi = cpi.primaryImpact;
        const sevColors = { critical: '#ef4444', significant: '#f97316', moderate: '#eab308' };
        const sevColor = sevColors[cpi.severity] || '#eab308';
        const sevLabel = cpi.severity.charAt(0).toUpperCase() + cpi.severity.slice(1);
        const subLinks = (pi.subCategoryLinks || []).map(l => `Your ${l.from} is limiting your ${l.to}`).join(' · ');

        crossPillarPlainText = `\n--- WHERE YOUR WEAKNESS IS COSTING YOU MOST ---\n${sevLabel} Impact: ${pi.from} → ${pi.to}\n"${pi.headline}"\n${pi.explanation}\n${subLinks ? subLinks + '\n' : ''}See your full impact analysis: https://assessment.valuetovictory.com/report/${assessmentId}\n`;

        crossPillarEmailHtml = `
<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Cross-Pillar Impact -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:24px 40px 16px 40px;">
<h2 style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#d4a853;text-transform:uppercase;letter-spacing:1px;">&#9888; Where Your Weakness Is Costing You Most</h2>
<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6a6a84;">Your ${pi.from} isn't just low — it's actively dragging down your ${pi.to}.</p>
<div style="text-align:center;margin-bottom:16px;">
<span style="display:inline-block;padding:4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${sevColor};letter-spacing:1px;text-transform:uppercase;">${sevLabel} Impact</span>
</div>
<div style="background:#22223a;border-radius:8px;padding:20px 24px;border:1px solid #2a2a4a;border-left:4px solid ${sevColor};margin-bottom:16px;">
<p style="margin:0 0 10px 0;font-family:Georgia,serif;font-style:italic;font-size:18px;color:#d4a853;line-height:1.4;">"${pi.headline}"</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a0a0b8;line-height:1.6;">${pi.explanation}</p>
</div>
${subLinks ? `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6a6a84;">${subLinks}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:6px;border:1px solid #d4a853;" align="center"><a href="https://assessment.valuetovictory.com/report/${assessmentId}" target="_blank" style="display:inline-block;padding:10px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#d4a853;text-decoration:none;letter-spacing:0.5px;">See Your Full Impact Analysis &rarr;</a></td></tr></table>
</td></tr></table>`;
      }

      // Action plan cards from prescription data (weakest pillar focus)
      const actionSteps = [];
      if (prescription.immediate) actionSteps.push(prescription.immediate);
      if (prescription.tool) actionSteps.push(prescription.tool);
      if (prescription.thirtyDay) actionSteps.push(prescription.thirtyDay);
      while (actionSteps.length < 3) actionSteps.push('Review your full report for personalized next steps.');

      const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Value Engine Report</title></head><body style="margin:0;padding:0;background:#111122;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">

<!-- Promo Banner -->
<tr><td style="background:linear-gradient(90deg,#d4a853,#e8c775);padding:10px 24px;text-align:center;border-radius:4px 4px 0 0;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:0.5px;text-transform:uppercase;">&#9733; This report is normally $1.99 \u2014 FREE through April 25, 2026 &#9733;</p></td></tr>

<!-- Main Body -->
<tr><td style="background:#1a1a2e;">

<!-- Header -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:36px 40px 20px 40px;text-align:center;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">VALUE <span style="color:#d4a853;">TO</span> VICTORY</h1><p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8888a8;letter-spacing:3px;text-transform:uppercase;">The Value Engine Report</p></td></tr></table>

<!-- Gold Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#d4a853,transparent);"></div></td></tr></table>

<!-- Greeting -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:28px 40px 8px 40px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#a0a0b8;line-height:1.6;">Hello <strong style="color:#ffffff;">${firstName}</strong>,</p><p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#a0a0b8;line-height:1.6;">Your Value Engine assessment is complete. Below is a detailed breakdown of where you stand across the <strong style="color:#d4a853;">five pillars of value</strong>.</p></td></tr></table>

<!-- Master Score -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:32px 40px 12px 40px;text-align:center;"><p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8888a8;letter-spacing:3px;text-transform:uppercase;">Master Value Score</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="width:180px;height:180px;border-radius:50%;border:10px solid #2a2a44;text-align:center;vertical-align:middle;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:44px;font-weight:800;color:#d4a853;line-height:1;">${masterScore}</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6a6a84;">of ${reportDepth === 'pillar' ? 50 : 250}</span></td></tr></table>
<!-- Tier Badge -->
<div style="margin-top:20px;"><span style="display:inline-block;background:${tier.bg};border:1px solid ${tier.border};border-radius:20px;padding:6px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${tier.color};letter-spacing:1.5px;text-transform:uppercase;">${tier.arrow} ${scoreRange} Tier</span></div>
<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a0a0b8;line-height:1.6;max-width:480px;display:inline-block;">${tierDescriptions[scoreRange] || tierDescriptions.Growth}</p></td></tr></table>

<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:20px 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Pillar Breakdown Header -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:4px 40px 20px 40px;"><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">Your Five Pillars</h2><p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6a6a84;">Each pillar is scored out of ${reportPillarMax}. Here is where you stand.</p></td></tr></table>

<!-- Pillar Bars -->
${pillars.map(p => buildPillarRowHtml(p)).join('\n')}

<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Weakest Pillar Callout \u2014 Encouraging Tone -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:24px 40px;"><div style="background:linear-gradient(135deg,#1a2035,#1f1525);border:1px solid #d4a853;border-left:4px solid #d4a853;border-radius:8px;padding:24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td><p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#d4a853;letter-spacing:2px;text-transform:uppercase;font-weight:700;">&#127775; Your Biggest Opportunity for Growth</p><h3 style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;">${minPillar.key} \u2014 ${minPillar.score} out of ${reportPillarMax}</h3><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#a0a0b8;line-height:1.6;">${weakDiag}</p></td></tr></table></div></td></tr></table>

${crossPillarEmailHtml}

<!-- Action Plan Header -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:8px 40px 16px 40px;"><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">Your 3-Step Action Plan</h2><p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6a6a84;">Based on your results, here is where to focus first.</p></td></tr></table>

<!-- Action Cards -->
${buildActionCardHtml(actionSteps[0], 1, false)}
${buildActionCardHtml(actionSteps[1], 2, false)}
${buildActionCardHtml(actionSteps[2], 3, true)}

<!-- YOUR IMPROVEMENT ROADMAP or MAINTAIN YOUR EDGE -->
${roadmapHtml}

<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:12px 40px 0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Coaching CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:32px 40px 16px 40px;text-align:center;"><h2 style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;">${tier.cta}</h2><p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#8888a8;line-height:1.6;">Get a free coaching preparation report \u2014 personalized to your exact scores.<br>Choose your track: Personal, Real Estate, or Company.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;background:linear-gradient(135deg,#d4a853,#c89030);" align="center"><a href="https://assessment.valuetovictory.com/coaching?track=personal&amp;aid=${assessmentId}" target="_blank" style="display:inline-block;padding:16px 48px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#1a1a2e;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Get Your Free Coaching Report &rarr;</a></td></tr></table></td></tr></table>

<!-- Membership / Pricing CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:16px 40px 32px 40px;text-align:center;">
<div style="margin-bottom:16px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6a6a84;text-decoration:line-through;">${tier.full}/mo</span> <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;color:#d4a853;margin-left:8px;">${tier.promo}</span><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4a853;">/mo</span></div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;border:2px solid #d4a853;" align="center"><a href="https://assessment.valuetovictory.com/pricing" target="_blank" style="display:inline-block;padding:12px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#d4a853;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Lock In ${tier.product} Promo Rate</a></td></tr></table>
<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a4a64;">2026 promo pricing. Goes to ${tier.full}/mo in January 2027.</p></td></tr></table>

<!-- View Full Report -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px 24px 40px;text-align:center;"><a href="https://assessment.valuetovictory.com/report/${assessmentId}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4a853;text-decoration:underline;">View Your Full Interactive Report Online</a></td></tr></table>

<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:28px 40px 36px 40px;text-align:center;"><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#4a4a64;letter-spacing:1.5px;text-transform:uppercase;">Value to Victory</p><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a3a54;line-height:1.6;">Don't guess. Run the system.</p><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a3a54;">You're receiving this because you completed the Value Engine Assessment.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6a6a84;">To unsubscribe, reply with UNSUBSCRIBE in the subject line.</p><p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#2a2a44;">&copy; 2026 Value to Victory | Goodview, VA | valuetovictory.com</p></td></tr></table>

</td></tr>
</table>
</body></html>`;

      const subject = `Your Value Engine Score: ${masterScore} (${scoreRange}) \u2014 Personal Report Ready`;

      // Check if email credentials are configured
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return res.json({ sent: false, reason: 'Email credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.', subject, body: emailBody, reportUrl: `https://assessment.valuetovictory.com/report/${assessmentId}` });
      }

      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
        await transporter.sendMail({
          from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
          to: recipientEmail,
          subject,
          text: emailBody,
          html: htmlBody,
        });
        return res.json({ sent: true, to: recipientEmail, reportUrl: `https://assessment.valuetovictory.com/report/${assessmentId}` });
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message);
        return res.json({ sent: false, reason: emailErr.message, reportUrl: `https://assessment.valuetovictory.com/report/${assessmentId}` });
      }
    }

    // POST /api/challenge/enroll
    if (req.method === 'POST' && url === '/challenge/enroll') {
      const b = req.body || {};
      const assessmentId = b.assessmentId;
      if (!assessmentId) return res.status(400).json({ error: 'assessmentId required' });

      const aRows = await sql`SELECT a.*, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];

      const day90 = new Date();
      day90.setDate(day90.getDate() + 90);

      try {
        const rows = await sql`INSERT INTO challenges (contact_id, baseline_assessment_id, day_90_date)
          VALUES (${a.contact_id}, ${assessmentId}, ${day90.toISOString()})
          ON CONFLICT (contact_id, baseline_assessment_id) DO UPDATE SET status = 'active', day_90_date = EXCLUDED.day_90_date, enrolled_at = NOW()
          RETURNING *`;
        const c = rows[0];
        return res.json({ enrolled: true, challengeId: c.id, day90Date: c.day_90_date, enrolledAt: c.enrolled_at });
      } catch (e) {
        return res.status(500).json({ error: 'Could not enroll. Ensure migration has been run.', details: e.message });
      }
    }

    // GET /api/challenge/status?email={email}
    if (req.method === 'GET' && url.startsWith('/challenge/status')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      if (!email) return res.status(400).json({ error: 'email required' });

      const contactRows = await sql`SELECT * FROM contacts WHERE email = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const contact = contactRows[0];

      try {
        const challengeRows = await sql`SELECT ch.*, a_base.master_score as baseline_score, a_base.score_range as baseline_range, a_base.time_total as baseline_time, a_base.people_total as baseline_people, a_base.influence_total as baseline_influence, a_base.numbers_total as baseline_numbers, a_base.knowledge_total as baseline_knowledge FROM challenges ch JOIN assessments a_base ON ch.baseline_assessment_id = a_base.id WHERE ch.contact_id = ${contact.id} ORDER BY ch.enrolled_at DESC LIMIT 1`;

        if (challengeRows.length === 0) return res.json({ enrolled: false });

        const ch = challengeRows[0];
        const now = new Date();
        const day90 = new Date(ch.day_90_date);
        const daysRemaining = Math.max(0, Math.ceil((day90 - now) / (1000 * 60 * 60 * 24)));
        const daysElapsed = 90 - daysRemaining;
        const isWithin7Days = daysRemaining <= 7;
        const isExpired = daysRemaining === 0;

        // Check if status should be updated
        if (isExpired && ch.status === 'active') {
          await sql`UPDATE challenges SET status = 'expired' WHERE id = ${ch.id}`;
          ch.status = 'expired';
        }

        // Get latest assessment for comparison
        let currentScore = null;
        const latestRows = await sql`SELECT master_score, score_range, time_total, people_total, influence_total, numbers_total, knowledge_total FROM assessments WHERE contact_id = ${contact.id} ORDER BY completed_at DESC LIMIT 1`;
        if (latestRows.length > 0) {
          const l = latestRows[0];
          currentScore = {
            masterScore: l.master_score,
            scoreRange: l.score_range,
            time: l.time_total,
            people: l.people_total,
            influence: l.influence_total,
            numbers: l.numbers_total,
            knowledge: l.knowledge_total,
          };
        }

        return res.json({
          enrolled: true,
          challengeId: ch.id,
          status: ch.status,
          enrolledAt: ch.enrolled_at,
          day90Date: ch.day_90_date,
          daysRemaining,
          daysElapsed,
          isWithin7Days,
          isExpired,
          baseline: {
            assessmentId: ch.baseline_assessment_id,
            masterScore: ch.baseline_score,
            scoreRange: ch.baseline_range,
            time: ch.baseline_time,
            people: ch.baseline_people,
            influence: ch.baseline_influence,
            numbers: ch.baseline_numbers,
            knowledge: ch.baseline_knowledge,
          },
          current: currentScore,
        });
      } catch (e) {
        return res.json({ enrolled: false, error: 'Challenge system not initialized. Run migration first.', details: e.message });
      }
    }

    // GET /api/admin/feedback-summary — aggregated feedback data (Feature 4)
    if (req.method === 'GET' && url === '/admin/feedback-summary') {
      try {
        const totalFeedback = await sql`SELECT COUNT(*) as cnt FROM feedback`;
        const total = Number(totalFeedback[0].cnt);
        const pillarDist = await sql`SELECT weakest_pillar, COUNT(*) as cnt FROM feedback GROUP BY weakest_pillar ORDER BY cnt DESC`;
        const rangeDist = await sql`SELECT score_range, COUNT(*) as cnt FROM feedback GROUP BY score_range ORDER BY cnt DESC`;
        // Aggregate weakest sub-categories across all feedback
        const allFeedback = await sql`SELECT weakest_sub_categories FROM feedback WHERE weakest_sub_categories IS NOT NULL`;
        const subCounts = {};
        for (const row of allFeedback) {
          const subs = typeof row.weakest_sub_categories === 'string' ? JSON.parse(row.weakest_sub_categories) : row.weakest_sub_categories;
          if (Array.isArray(subs)) {
            for (const s of subs) {
              const key = s.name || s.pillar;
              subCounts[key] = (subCounts[key] || 0) + 1;
            }
          }
        }
        const topWeakSubs = Object.entries(subCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }));
        return res.json({
          totalFeedbackRows: total,
          weakestPillarDistribution: pillarDist.map(r => ({ pillar: r.weakest_pillar, count: Number(r.cnt), percent: total > 0 ? Math.round((Number(r.cnt) / total) * 100) : 0 })),
          scoreRangeDistribution: rangeDist.map(r => ({ range: r.score_range, count: Number(r.cnt) })),
          topWeakestSubCategories: topWeakSubs,
        });
      } catch (e) {
        return res.json({ error: 'Feedback table not initialized. Run migration first.', details: e.message });
      }
    }

    // GET /api/recommendations?pillar={pillar}&subCategory={subCategory} (Feature 5)
    if (req.method === 'GET' && url.startsWith('/recommendations')) {
      const params = new URL('http://x' + req.url).searchParams;
      const pillar = params.get('pillar') || 'Time';
      const subCategory = params.get('subCategory') || '';

      // Get aggregate weakness data from feedback table
      let percentWeak = 0;
      try {
        const totalRows = await sql`SELECT COUNT(*) as cnt FROM feedback`;
        const total = Number(totalRows[0].cnt);
        if (total > 0) {
          const weakRows = await sql`SELECT COUNT(*) as cnt FROM feedback WHERE weakest_pillar = ${pillar}`;
          percentWeak = Math.round((Number(weakRows[0].cnt) / total) * 100);
        }
      } catch (e) { /* table may not exist */ }

      // Comprehensive recommendations database — Value Engine tools ALWAYS first
      const recommendationsDB = {
        Time: {
          "Time Awareness": [
            {rank:1,source:"Value Engine",action:"Run the Time Audit (Tool #2) — track every hour for 3 days to find where your time actually goes",reference:"Chapter 1, p.24"},
            {rank:2,source:"Value Engine",action:"Calculate your Value Per Hour using Tool #5 — know what each hour is actually worth",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Use the Time Reallocation Planner (Tool #9) to redesign your week based on audit results",reference:"Chapter 1, p.78"},
            {rank:4,source:"Practical",action:"Start a daily time log — write what you did every hour before bed for 7 straight days"},
            {rank:5,source:"Practical",action:"Set 3 daily priorities each morning before checking email or phone"},
            {rank:6,source:"Practical",action:"Use the Pomodoro technique — 25 min focused work, 5 min break"},
            {rank:7,source:"Practical",action:"Block your peak energy hours for your most important work every day"},
            {rank:8,source:"General",action:"Covey's 4 Quadrants framework — categorize all tasks by urgency vs importance"},
            {rank:9,source:"General",action:"David Allen's 2-minute rule — if it takes less than 2 minutes, do it now"},
            {rank:10,source:"General",action:"Weekly review habit — 30 minutes every Sunday to plan the week ahead"}
          ],
          "Time Allocation": [
            {rank:1,source:"Value Engine",action:"Run the Time Reallocation Planner (Tool #9) — sort activities by Covey Quadrant",reference:"Chapter 1, p.78"},
            {rank:2,source:"Value Engine",action:"Apply the 1,800-Hour Framework to identify how you spend your working hours",reference:"Chapter 1, p.30"},
            {rank:3,source:"Value Engine",action:"Use the Time Audit (Tool #2) to compare planned vs actual time allocation",reference:"Chapter 1, p.24"},
            {rank:4,source:"Practical",action:"Write your 3 most important tasks BEFORE checking email or phone tomorrow morning"},
            {rank:5,source:"Practical",action:"Schedule your highest-value work during your peak energy window"},
            {rank:6,source:"Practical",action:"Use time-blocking: assign every hour a purpose before the day starts"},
            {rank:7,source:"Practical",action:"Batch similar tasks together — email, calls, admin — to reduce context switching"},
            {rank:8,source:"General",action:"Apply the 80/20 rule — identify which 20% of tasks drive 80% of results"},
            {rank:9,source:"General",action:"Eat the Frog — do your hardest, most important task first thing each day"},
            {rank:10,source:"General",action:"Use a 'not-to-do' list to eliminate low-value activities"}
          ],
          "Time Protection": [
            {rank:1,source:"Value Engine",action:"Apply the Time Protection principles from Chapter 1 — guard your Q2 hours",reference:"Chapter 1, p.34"},
            {rank:2,source:"Value Engine",action:"Run the Time Audit (Tool #2) to identify who and what steals your time",reference:"Chapter 1, p.24"},
            {rank:3,source:"Value Engine",action:"Read Chapter 1 on creating non-negotiable time blocks aligned with your Value Per Hour",reference:"Chapter 1"},
            {rank:4,source:"Practical",action:"Block 2 hours tomorrow as 'Do Not Disturb' time. Tell one person. Protect it."},
            {rank:5,source:"Practical",action:"Turn off notifications during focus blocks — phone on airplane mode"},
            {rank:6,source:"Practical",action:"Practice saying 'Let me check my schedule' instead of automatically saying yes"},
            {rank:7,source:"Practical",action:"Set office hours for interruptions — train people when you're available"},
            {rank:8,source:"General",action:"Cal Newport's Deep Work — schedule uninterrupted focus time daily"},
            {rank:9,source:"General",action:"Establish a shutdown ritual — hard stop to protect personal time"},
            {rank:10,source:"General",action:"Use physical signals (closed door, headphones) to communicate focus time"}
          ],
          "Time Leverage": [
            {rank:1,source:"Value Engine",action:"Calculate your Value Per Hour (Tool #5) — know which tasks are below your rate",reference:"Chapter 1, p.42"},
            {rank:2,source:"Value Engine",action:"Use the Time Reallocation Planner (Tool #9) to identify delegatable tasks",reference:"Chapter 1, p.78"},
            {rank:3,source:"Value Engine",action:"Apply the Income Multiplier Model (Tool #12) — compound small time gains into big results",reference:"Chapter 4, p.156"},
            {rank:4,source:"Practical",action:"Identify one task you do every week that someone else could do. Delegate it this week."},
            {rank:5,source:"Practical",action:"Automate one recurring task using technology (auto-pay, email templates, scheduling tools)"},
            {rank:6,source:"Practical",action:"Create standard operating procedures for tasks you repeat more than 3 times"},
            {rank:7,source:"Practical",action:"Hire help for $20/hr tasks if your Value Per Hour is higher than that"},
            {rank:8,source:"General",action:"Apply the 4 D's to every task: Do, Delegate, Defer, or Delete"},
            {rank:9,source:"General",action:"Build systems, not just habits — create processes that run without you"},
            {rank:10,source:"General",action:"Use templates and checklists to eliminate repeated decision-making"}
          ],
          "Five-Hour Leak": [
            {rank:1,source:"Value Engine",action:"Run the Time Audit (Tool #2) specifically to find your Five-Hour Leak",reference:"Chapter 1, p.24"},
            {rank:2,source:"Value Engine",action:"Calculate the dollar cost of your leak using Value Per Hour (Tool #5)",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Read Chapter 1 on the Five-Hour Leak concept and how to eliminate it",reference:"Chapter 1, p.38"},
            {rank:4,source:"Practical",action:"Set a screen time limit on your phone today. Track social media and TV hours for 3 days."},
            {rank:5,source:"Practical",action:"Delete or move time-wasting apps off your home screen"},
            {rank:6,source:"Practical",action:"Replace one hour of scrolling with one hour of skill-building this week"},
            {rank:7,source:"Practical",action:"Use an app blocker during work hours to eliminate digital distractions"},
            {rank:8,source:"General",action:"Track all screen time for one week — the data will shock you into action"},
            {rank:9,source:"General",action:"Replace passive consumption (scrolling, watching) with active creation"},
            {rank:10,source:"General",action:"Set a 'digital sunset' — no screens after a specific time each night"}
          ],
          "Value Per Hour": [
            {rank:1,source:"Value Engine",action:"Run the Value Per Hour Calculator (Tool #5) — calculate your actual hourly worth",reference:"Chapter 1, p.42"},
            {rank:2,source:"Value Engine",action:"Use the Income Multiplier Model (Tool #12) to map how to increase your rate",reference:"Chapter 4, p.156"},
            {rank:3,source:"Value Engine",action:"Apply the 1,800-Hour Framework to understand your true earning capacity",reference:"Chapter 1, p.30"},
            {rank:4,source:"Practical",action:"Calculate your actual hourly rate right now: monthly income ÷ hours worked. Write it on a sticky note."},
            {rank:5,source:"Practical",action:"Stop doing tasks that pay below your hourly rate — delegate or eliminate them"},
            {rank:6,source:"Practical",action:"Identify one skill that would increase your hourly rate by 20% and start learning it"},
            {rank:7,source:"Practical",action:"Track how many 'high-value hours' vs 'low-value hours' you work each day"},
            {rank:8,source:"General",action:"Price your time — before every commitment, calculate the real cost in dollars"},
            {rank:9,source:"General",action:"Focus on income-producing activities during your best hours"},
            {rank:10,source:"General",action:"Raise your rates or negotiate your salary — most people undercharge"}
          ],
          "Time Investment": [
            {rank:1,source:"Value Engine",action:"Apply the Time Investment principle from Chapter 1 — every hour is a seed",reference:"Chapter 1, p.46"},
            {rank:2,source:"Value Engine",action:"Use the Time Reallocation Planner (Tool #9) to shift time toward compounding activities",reference:"Chapter 1, p.78"},
            {rank:3,source:"Value Engine",action:"Read Chapter 1 on treating time as your most valuable investment",reference:"Chapter 1"},
            {rank:4,source:"Practical",action:"Before saying yes to anything this week, ask: 'What is the expected return on this time?'"},
            {rank:5,source:"Practical",action:"Invest 1 hour daily in a skill or relationship that compounds over time"},
            {rank:6,source:"Practical",action:"Review your calendar weekly — is your time invested or just spent?"},
            {rank:7,source:"Practical",action:"Create a 'time budget' like a financial budget — allocate hours to ROI categories"},
            {rank:8,source:"General",action:"Warren Buffett's 5/25 rule — focus on your top 5 priorities, ignore the rest"},
            {rank:9,source:"General",action:"Apply compound interest thinking to your time — small daily investments yield massive returns"},
            {rank:10,source:"General",action:"Track your time ROI — measure what you got back from the time you invested"}
          ],
          "Downtime Quality": [
            {rank:1,source:"Value Engine",action:"Audit your downtime using the Time Audit (Tool #2) — what's rest vs what's waste?",reference:"Chapter 1, p.24"},
            {rank:2,source:"Value Engine",action:"Apply the Downtime Quality framework from Chapter 1 — strategic rest beats passive consumption",reference:"Chapter 1, p.52"},
            {rank:3,source:"Value Engine",action:"Read Chapter 1 on the difference between recovery and avoidance",reference:"Chapter 1"},
            {rank:4,source:"Practical",action:"Replace one hour of scrolling or TV this week with something that builds toward a goal"},
            {rank:5,source:"Practical",action:"Schedule active recovery: exercise, nature walks, reading, creative hobbies"},
            {rank:6,source:"Practical",action:"Create a 'rest menu' — a list of activities that actually recharge you"},
            {rank:7,source:"Practical",action:"Set boundaries on passive entertainment — limit Netflix/social media to specific hours"},
            {rank:8,source:"General",action:"Distinguish between rest and avoidance — real rest prepares you for performance"},
            {rank:9,source:"General",action:"Practice the Sabbath principle — one day per week fully disconnected from work"},
            {rank:10,source:"General",action:"Use downtime for reflection — journal, meditate, or plan"}
          ],
          "Foresight": [
            {rank:1,source:"Value Engine",action:"Apply the Foresight framework from Chapter 1 — anticipate before you react",reference:"Chapter 1, p.56"},
            {rank:2,source:"Value Engine",action:"Use the Time Reallocation Planner (Tool #9) with a forward-looking lens",reference:"Chapter 1, p.78"},
            {rank:3,source:"Value Engine",action:"Read Chapter 1 on building foresight habits that prevent crises",reference:"Chapter 1"},
            {rank:4,source:"Practical",action:"Spend 15 minutes every Sunday night planning your week. Write down what's coming."},
            {rank:5,source:"Practical",action:"For every project, identify the top 3 risks before they happen"},
            {rank:6,source:"Practical",action:"Keep a 90-day rolling plan — always know what's coming 3 months out"},
            {rank:7,source:"Practical",action:"Before every meeting, prepare: what's the goal, what do I need, what could go wrong?"},
            {rank:8,source:"General",action:"Pre-mortem technique — imagine the project failed, then work backward to prevent it"},
            {rank:9,source:"General",action:"Scenario planning — for major decisions, map out best/worst/likely outcomes"},
            {rank:10,source:"General",action:"Build buffer time into your schedule for the unexpected"}
          ],
          "Time Reallocation": [
            {rank:1,source:"Value Engine",action:"Run the Time Reallocation Planner (Tool #9) to redesign your weekly schedule",reference:"Chapter 1, p.78"},
            {rank:2,source:"Value Engine",action:"Use the Time Audit (Tool #2) results to identify what to cut, keep, or expand",reference:"Chapter 1, p.24"},
            {rank:3,source:"Value Engine",action:"Apply Value Per Hour (Tool #5) as the filter for reallocation decisions",reference:"Chapter 1, p.42"},
            {rank:4,source:"Practical",action:"Look at last week's calendar. Circle 3 activities that produced nothing. Replace them."},
            {rank:5,source:"Practical",action:"Identify your top 3 time-wasters and eliminate or reduce one this week"},
            {rank:6,source:"Practical",action:"Redirect freed-up time to your #1 priority — don't let it get absorbed"},
            {rank:7,source:"Practical",action:"Review and adjust your schedule every week — treat your calendar like a budget"},
            {rank:8,source:"General",action:"Apply the sunk cost fallacy awareness — don't continue bad time investments just because you started them"},
            {rank:9,source:"General",action:"Create an 'ideal week' template and work toward it incrementally"},
            {rank:10,source:"General",action:"Audit your commitments quarterly — resign from what no longer serves your goals"}
          ]
        },
        People: {
          "Trust Investment": [
            {rank:1,source:"Value Engine",action:"Run the People Audit (Tool #3) — map your relationships by type: Givers, Receivers, Exchangers, Takers",reference:"Chapter 2, p.84"},
            {rank:2,source:"Value Engine",action:"Apply the Relationship Matrix (Tool #6) — classify by alliance type",reference:"Chapter 2, p.98"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on trust as an investment with measurable returns",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Pick one person you trust. Verify that trust with evidence — are they reliable? Do they follow through?"},
            {rank:5,source:"Practical",action:"Track your trust deposits and withdrawals with key people for 2 weeks"},
            {rank:6,source:"Practical",action:"Have one honest conversation this week where you share something real"},
            {rank:7,source:"Practical",action:"Follow through on one promise perfectly this week — build your own trustworthiness"},
            {rank:8,source:"General",action:"Trust but verify — combine good faith with evidence-based evaluation"},
            {rank:9,source:"General",action:"Extend trust incrementally — small tests before big commitments"},
            {rank:10,source:"General",action:"Repair broken trust quickly — the longer you wait, the harder it gets"}
          ],
          "Boundary Quality": [
            {rank:1,source:"Value Engine",action:"Use the People Audit (Tool #3) to identify where boundaries are weak",reference:"Chapter 2, p.84"},
            {rank:2,source:"Value Engine",action:"Apply the Value Replacement Map (Tool #10) to redirect energy from boundary violators",reference:"Chapter 2, p.112"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on boundary quality as a measure of self-respect",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Identify one boundary you need to set. Write it down. Communicate it to one person this week."},
            {rank:5,source:"Practical",action:"Practice saying 'no' to one request that doesn't align with your priorities"},
            {rank:6,source:"Practical",action:"Set clear expectations at the start of every new relationship or project"},
            {rank:7,source:"Practical",action:"When someone crosses a boundary, address it within 24 hours — don't let it fester"},
            {rank:8,source:"General",action:"Boundaries are not walls — they're bridges with toll booths. Know the price of entry."},
            {rank:9,source:"General",action:"Write your non-negotiables down and review them monthly"},
            {rank:10,source:"General",action:"Remember: you teach people how to treat you by what you tolerate"}
          ],
          "Network Depth": [
            {rank:1,source:"Value Engine",action:"Run the Relationship Matrix (Tool #6) — map Confidants, Constituents, Comrades, Companions",reference:"Chapter 2, p.98"},
            {rank:2,source:"Value Engine",action:"Use the People Audit (Tool #3) to assess your network quality",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on building depth over breadth in relationships",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Reach out to one person you respect but haven't talked to in 30+ days. Have a real conversation."},
            {rank:5,source:"Practical",action:"Schedule one meaningful conversation per week with someone who challenges you"},
            {rank:6,source:"Practical",action:"Replace surface-level networking with deep, value-creating relationships"},
            {rank:7,source:"Practical",action:"Ask better questions in conversations — go beyond 'how are you' to 'what are you building'"},
            {rank:8,source:"General",action:"Your network is your net worth — invest in relationships that compound"},
            {rank:9,source:"General",action:"Be a connector — introduce people in your network who should know each other"},
            {rank:10,source:"General",action:"Quality over quantity — 5 deep relationships beat 500 superficial ones"}
          ],
          "Relational ROI": [
            {rank:1,source:"Value Engine",action:"Use the Value Replacement Map (Tool #10) to assess ROI on every key relationship",reference:"Chapter 2, p.112"},
            {rank:2,source:"Value Engine",action:"Run the People Audit (Tool #3) — categorize relationships by actual returns",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on measuring relational return on investment",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"List your top 5 relationships. Next to each, write + (gives energy) or - (drains energy). Act on it."},
            {rank:5,source:"Practical",action:"Redirect 2 hours per week from low-ROI to high-ROI relationships"},
            {rank:6,source:"Practical",action:"Ask: 'Is this relationship making me better?' If not, reduce investment."},
            {rank:7,source:"Practical",action:"Invest more in relationships where both parties grow — those are Exchangers"},
            {rank:8,source:"General",action:"Track your emotional energy after interactions — patterns reveal ROI"},
            {rank:9,source:"General",action:"Set relationship goals just like financial goals — be intentional"},
            {rank:10,source:"General",action:"Remember: some relationships are meant for a season, not a lifetime"}
          ],
          "People Audit": [
            {rank:1,source:"Value Engine",action:"Run the People Audit (Tool #3) — map 10 people as Givers, Receivers, Exchangers, or Takers",reference:"Chapter 2, p.84"},
            {rank:2,source:"Value Engine",action:"Cross-reference with the Relationship Matrix (Tool #6) for deeper classification",reference:"Chapter 2, p.98"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on the four relationship types and how to manage each",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Write down 10 names. Categorize each as Giver, Receiver, Exchanger, or Taker."},
            {rank:5,source:"Practical",action:"Increase time with Exchangers — they're your growth engine"},
            {rank:6,source:"Practical",action:"Set boundaries with Takers — protect your time and energy"},
            {rank:7,source:"Practical",action:"Thank one Giver in your life this week — reinforce that relationship"},
            {rank:8,source:"General",action:"Review your people audit quarterly — relationships change over time"},
            {rank:9,source:"General",action:"Be the type of person you want in your network — lead by example"},
            {rank:10,source:"General",action:"Proximity is power — spend more time with people who are where you want to be"}
          ],
          "Alliance Building": [
            {rank:1,source:"Value Engine",action:"Use the Relationship Matrix (Tool #6) — identify your Confidant, Constituent, Comrade, and Companion",reference:"Chapter 2, p.98"},
            {rank:2,source:"Value Engine",action:"Run the People Audit (Tool #3) to find alliance gaps",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on the four alliance types and why you need all four",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Identify who's missing: Confidant, Constituent, Comrade, or Companion. Find one this month."},
            {rank:5,source:"Practical",action:"Deepen one alliance this week with intentional quality time"},
            {rank:6,source:"Practical",action:"Be specific about what you need from each alliance type — clarity builds stronger bonds"},
            {rank:7,source:"Practical",action:"Create mutual value in every alliance — don't just take, contribute"},
            {rank:8,source:"General",action:"Strategic alliances outperform solo effort — find complementary strengths"},
            {rank:9,source:"General",action:"Invest in alliances before you need them — don't network in desperation"},
            {rank:10,source:"General",action:"Maintain alliances with consistent, small touchpoints — not just when you need something"}
          ],
          "Love Bank Deposits": [
            {rank:1,source:"Value Engine",action:"Apply the Love Bank framework from Chapter 2 — every interaction is a deposit or withdrawal",reference:"Chapter 2, p.104"},
            {rank:2,source:"Value Engine",action:"Use the People Audit (Tool #3) to identify your most important Love Bank accounts",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on making intentional deposits in your key relationships",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Make one intentional deposit in your most important relationship today. Choose to, don't wait to feel like it."},
            {rank:5,source:"Practical",action:"Learn your partner's or key person's love language — speak it daily"},
            {rank:6,source:"Practical",action:"Do something unexpected and kind for someone important to you this week"},
            {rank:7,source:"Practical",action:"Show up when it's inconvenient — that's when deposits count the most"},
            {rank:8,source:"General",action:"Deposits should outnumber withdrawals 5:1 for healthy relationships"},
            {rank:9,source:"General",action:"Listen more than you speak — attention is the most valuable deposit"},
            {rank:10,source:"General",action:"Consistency beats grand gestures — small daily deposits build massive trust"}
          ],
          "Communication Clarity": [
            {rank:1,source:"Value Engine",action:"Apply the Communication Clarity framework from Chapter 2 — say what you mean, confirm what's heard",reference:"Chapter 2, p.108"},
            {rank:2,source:"Value Engine",action:"Use the 4 Questions filter (Tool in Chapter 2) before difficult conversations",reference:"Chapter 2"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on closing the gap between intention and reception",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"After your next important statement, ask: 'What did you hear me say?' See if it matches."},
            {rank:5,source:"Practical",action:"Write important messages before sending — edit for clarity, not length"},
            {rank:6,source:"Practical",action:"Summarize key points at the end of every meeting — confirm alignment"},
            {rank:7,source:"Practical",action:"Replace vague language with specific language: dates, numbers, names"},
            {rank:8,source:"General",action:"The biggest communication problem is the illusion that it happened"},
            {rank:9,source:"General",action:"Listen to understand, not to respond — most miscommunication starts with poor listening"},
            {rank:10,source:"General",action:"Over-communicate during transitions and crises — silence creates anxiety"}
          ],
          "Restraint Practice": [
            {rank:1,source:"Value Engine",action:"Apply the 4 Questions from Chapter 2: Is it true? Is it kind? Is it necessary? Is it the right time?",reference:"Chapter 2, p.110"},
            {rank:2,source:"Value Engine",action:"Use the People Audit (Tool #3) to identify where restraint failures damage relationships",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on the power of strategic restraint in communication",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Before your next difficult conversation, pause and run the 4 questions"},
            {rank:5,source:"Practical",action:"Wait 24 hours before responding to any message that makes you angry"},
            {rank:6,source:"Practical",action:"In your next heated moment, take 3 deep breaths before speaking"},
            {rank:7,source:"Practical",action:"Practice: 'I need to think about that' as your default response to pressure"},
            {rank:8,source:"General",action:"Restraint is not weakness — it's strategic patience that protects relationships"},
            {rank:9,source:"General",action:"The things you don't say are often more powerful than the things you do"},
            {rank:10,source:"General",action:"Build a habit of pausing — between stimulus and response lies your power"}
          ],
          "Value Replacement": [
            {rank:1,source:"Value Engine",action:"Use the Value Replacement Map (Tool #10) to redirect relational energy",reference:"Chapter 2, p.112"},
            {rank:2,source:"Value Engine",action:"Run the People Audit (Tool #3) to identify who to replace and who to invest in",reference:"Chapter 2, p.84"},
            {rank:3,source:"Value Engine",action:"Read Chapter 2 on strategic value replacement in relationships",reference:"Chapter 2"},
            {rank:4,source:"Practical",action:"Reduce time with one draining relationship this week. Invest that time in one that grows you."},
            {rank:5,source:"Practical",action:"Don't burn bridges — just redirect your energy quietly and intentionally"},
            {rank:6,source:"Practical",action:"Replace negative relationship time with personal development time"},
            {rank:7,source:"Practical",action:"When you exit a draining relationship, fill the space with something better immediately"},
            {rank:8,source:"General",action:"You become the average of the 5 people you spend the most time with"},
            {rank:9,source:"General",action:"Letting go of the wrong relationships creates space for the right ones"},
            {rank:10,source:"General",action:"Replacement is not rejection — it's growth. Honor what was, choose what's next."}
          ]
        },
        Influence: {
          "Leadership Level": [
            {rank:1,source:"Value Engine",action:"Run the Influence Ladder (Tool #8) — identify which of the five leadership levels you're at",reference:"Chapter 3, p.120"},
            {rank:2,source:"Value Engine",action:"Apply the Gravitational Center Alignment (Tool #11) to strengthen your leadership foundation",reference:"Chapter 3, p.136"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on the five levels of leadership and how to advance",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Ask one person who follows your lead: 'Why?' Their answer reveals your level."},
            {rank:5,source:"Practical",action:"Lead by example this week — do what you ask others to do, first"},
            {rank:6,source:"Practical",action:"Invest in one person's development this week — leadership is measured by who you grow"},
            {rank:7,source:"Practical",action:"Ask for honest feedback from someone who reports to you or follows your lead"},
            {rank:8,source:"General",action:"Leadership is influence, nothing more, nothing less — John Maxwell"},
            {rank:9,source:"General",action:"Move from position-based to permission-based leadership through genuine care"},
            {rank:10,source:"General",action:"The highest level of leadership is when people follow you because of who you are"}
          ],
          "Integrity Alignment": [
            {rank:1,source:"Value Engine",action:"Run the Gravitational Center Alignment (Tool #11) — audit your calendar and bank statement against values",reference:"Chapter 3, p.136"},
            {rank:2,source:"Value Engine",action:"Apply the Integrity Alignment framework from Chapter 3",reference:"Chapter 3, p.124"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on closing the gap between stated and lived values",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Audit your calendar and bank statement this week. Do they reflect what you say you value?"},
            {rank:5,source:"Practical",action:"Write your top 5 values. Check: did your actions today serve any of them?"},
            {rank:6,source:"Practical",action:"Make one decision this week purely based on your values, even if it's harder"},
            {rank:7,source:"Practical",action:"When you catch a gap between words and actions, close it immediately"},
            {rank:8,source:"General",action:"Integrity is doing the right thing when nobody is watching"},
            {rank:9,source:"General",action:"Your reputation is built on the consistency between your words and your actions"},
            {rank:10,source:"General",action:"Start small — keep every small promise you make this week, no matter what"}
          ],
          "Professional Credibility": [
            {rank:1,source:"Value Engine",action:"Apply the Professional Credibility framework from Chapter 3 — credibility is compound interest",reference:"Chapter 3, p.128"},
            {rank:2,source:"Value Engine",action:"Use the Influence Ladder (Tool #8) to identify your credibility level",reference:"Chapter 3, p.120"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on building credibility that outlasts any single role",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Ask a colleague or client: 'What's one thing I could do better?' Listen without defending."},
            {rank:5,source:"Practical",action:"Deliver on one promise ahead of schedule this week"},
            {rank:6,source:"Practical",action:"Share your expertise publicly — write, speak, or teach what you know"},
            {rank:7,source:"Practical",action:"Under-promise and over-deliver in your next 3 commitments"},
            {rank:8,source:"General",action:"Credibility is built in drops and lost in buckets — protect it fiercely"},
            {rank:9,source:"General",action:"Seek testimonials and endorsements — let others validate your credibility"},
            {rank:10,source:"General",action:"Be the most prepared person in every room you enter"}
          ],
          "Empathetic Listening": [
            {rank:1,source:"Value Engine",action:"Apply the Empathetic Listening framework from Chapter 3 — listen to understand, not to respond",reference:"Chapter 3, p.130"},
            {rank:2,source:"Value Engine",action:"Use the Communication Clarity tools alongside empathetic listening",reference:"Chapter 2, p.108"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on how empathetic listening multiplies influence",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"In your next conversation, don't respond until you can repeat back what they said."},
            {rank:5,source:"Practical",action:"Ask 'Tell me more about that' three times in your next deep conversation"},
            {rank:6,source:"Practical",action:"Put your phone away during every important conversation this week"},
            {rank:7,source:"Practical",action:"Practice the 80/20 listening rule: listen 80%, speak 20%"},
            {rank:8,source:"General",action:"Most people listen to reply, not to understand — be different"},
            {rank:9,source:"General",action:"Validate emotions before offering solutions — people need to feel heard first"},
            {rank:10,source:"General",action:"Ask open-ended questions that start with 'What' or 'How' instead of 'Why'"}
          ],
          "Gravitational Center": [
            {rank:1,source:"Value Engine",action:"Run the Gravitational Center Alignment (Tool #11) — define and audit your core values",reference:"Chapter 3, p.136"},
            {rank:2,source:"Value Engine",action:"Apply the Influence Ladder (Tool #8) to align your center with your leadership",reference:"Chapter 3, p.120"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on becoming a person of gravitational influence",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Write down your top 5 values. Check: did your actions today serve any of them?"},
            {rank:5,source:"Practical",action:"Make one values-driven decision this week that others can observe"},
            {rank:6,source:"Practical",action:"When faced with a tough choice, ask: 'Which option aligns with who I want to be?'"},
            {rank:7,source:"Practical",action:"Live your values publicly — let people see what drives you"},
            {rank:8,source:"General",action:"People with a clear center attract followers naturally — be that person"},
            {rank:9,source:"General",action:"Your values should be non-negotiable, not aspirational"},
            {rank:10,source:"General",action:"Review your gravitational center quarterly — make sure it hasn't drifted"}
          ],
          "Micro-Honesties": [
            {rank:1,source:"Value Engine",action:"Apply the Micro-Honesties framework from Chapter 3 — small truths build massive credibility",reference:"Chapter 3, p.132"},
            {rank:2,source:"Value Engine",action:"Use the Gravitational Center Alignment (Tool #11) to align honesty with values",reference:"Chapter 3, p.136"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on how micro-honesties compound into trust",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Catch yourself in one exaggeration or omission this week. Correct it immediately."},
            {rank:5,source:"Practical",action:"When you don't know something, say 'I don't know' instead of guessing"},
            {rank:6,source:"Practical",action:"Give honest feedback to one person this week — kind but true"},
            {rank:7,source:"Practical",action:"Admit one mistake openly this week — vulnerability builds trust faster than perfection"},
            {rank:8,source:"General",action:"Radical honesty in small things creates trust in big things"},
            {rank:9,source:"General",action:"The cost of a small lie is always greater than the discomfort of the truth"},
            {rank:10,source:"General",action:"Make honesty your default — it simplifies everything"}
          ],
          "Word Management": [
            {rank:1,source:"Value Engine",action:"Apply the Word Management framework from Chapter 3 — your words are contracts",reference:"Chapter 3, p.134"},
            {rank:2,source:"Value Engine",action:"Use the Integrity Alignment tools to ensure your words match your actions",reference:"Chapter 3, p.124"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on managing your words as your most powerful influence tool",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"This week, replace 'I'll try' with 'I will' or 'I won't.' No ambiguous language."},
            {rank:5,source:"Practical",action:"Before making a commitment, pause and ask: 'Can I actually deliver on this?'"},
            {rank:6,source:"Practical",action:"Keep a commitment log — track every promise you make and whether you kept it"},
            {rank:7,source:"Practical",action:"If you can't keep a commitment, communicate early — don't wait until it's due"},
            {rank:8,source:"General",action:"Your word is your bond — people with impeccable word management get disproportionate opportunities"},
            {rank:9,source:"General",action:"Speak less, mean more — quality of words beats quantity"},
            {rank:10,source:"General",action:"Under-commit publicly, over-deliver privately"}
          ],
          "Personal Responsibility": [
            {rank:1,source:"Value Engine",action:"Apply the Personal Responsibility principle from Chapter 3 — own your outcomes",reference:"Chapter 3, p.138"},
            {rank:2,source:"Value Engine",action:"Use the Gravitational Center Alignment (Tool #11) to anchor responsibility in values",reference:"Chapter 3, p.136"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on how personal responsibility is the foundation of all influence",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Next time something goes wrong, before blaming anyone, ask: 'What could I have done differently?'"},
            {rank:5,source:"Practical",action:"Take ownership of one problem this week that isn't technically 'your fault'"},
            {rank:6,source:"Practical",action:"Replace 'they made me' with 'I chose to' in your vocabulary"},
            {rank:7,source:"Practical",action:"At the end of each day, write down one thing you're responsible for improving tomorrow"},
            {rank:8,source:"General",action:"Extreme ownership — leaders take responsibility for everything in their world"},
            {rank:9,source:"General",action:"The moment you blame someone else, you give them power over your life"},
            {rank:10,source:"General",action:"Focus on your locus of control — act on what you can change, accept what you can't"}
          ],
          "Adaptive Influence": [
            {rank:1,source:"Value Engine",action:"Apply the Adaptive Influence framework from Chapter 3 — lead with what others value",reference:"Chapter 3, p.140"},
            {rank:2,source:"Value Engine",action:"Use the Relationship Matrix (Tool #6) to understand different communication styles",reference:"Chapter 2, p.98"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on adapting your influence style to your audience",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Before your next important conversation, think: 'What does this person value?' Lead with that."},
            {rank:5,source:"Practical",action:"Observe one person's communication style this week and mirror it"},
            {rank:6,source:"Practical",action:"Ask: 'How would you like me to communicate this?' — let people tell you their preference"},
            {rank:7,source:"Practical",action:"Practice translating your message into different styles for different audiences"},
            {rank:8,source:"General",action:"The golden rule of influence: treat people the way THEY want to be treated"},
            {rank:9,source:"General",action:"Study DISC or similar personality frameworks to understand different types"},
            {rank:10,source:"General",action:"Flexibility is strength — rigid communicators have limited influence"}
          ],
          "Influence Multiplier": [
            {rank:1,source:"Value Engine",action:"Apply the Influence Multiplier principle from Chapter 3 — better influence improves every pillar",reference:"Chapter 3, p.142"},
            {rank:2,source:"Value Engine",action:"Use the Influence Ladder (Tool #8) to identify your highest-leverage influence opportunity",reference:"Chapter 3, p.120"},
            {rank:3,source:"Value Engine",action:"Read Chapter 3 on how influence compounds across all five pillars",reference:"Chapter 3"},
            {rank:4,source:"Practical",action:"Identify one area where better influence would improve your time, people, numbers, or knowledge. Focus there."},
            {rank:5,source:"Practical",action:"Mentor one person this week — teaching multiplies your influence"},
            {rank:6,source:"Practical",action:"Create content that showcases your expertise — extend influence beyond your physical reach"},
            {rank:7,source:"Practical",action:"Build a personal brand that works when you're not in the room"},
            {rank:8,source:"General",action:"Influence multiplies when you develop other leaders, not just followers"},
            {rank:9,source:"General",action:"Your influence ceiling determines every other ceiling in your life"},
            {rank:10,source:"General",action:"Focus on being influential, not famous — depth beats breadth"}
          ]
        },
        Numbers: {
          "Financial Awareness": [
            {rank:1,source:"Value Engine",action:"Run the Financial Snapshot (Tool #4) — document actual income, expenses, surplus/deficit",reference:"Chapter 4, p.148"},
            {rank:2,source:"Value Engine",action:"Calculate your Value Per Hour (Tool #5) to understand your real hourly worth",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on the Numbers pillar and financial awareness as the foundation",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Write down your exact monthly income and your top 10 expenses. Right now. No guessing."},
            {rank:5,source:"Practical",action:"Track every dollar you spend for 7 days — awareness is the first step"},
            {rank:6,source:"Practical",action:"Set up a simple dashboard: income, expenses, savings rate. Review weekly."},
            {rank:7,source:"Practical",action:"Know your monthly break-even number — what does it cost just to exist?"},
            {rank:8,source:"General",action:"You can't manage what you don't measure — financial awareness is step one"},
            {rank:9,source:"General",action:"Automate tracking with a budgeting app — remove the friction"},
            {rank:10,source:"General",action:"Review your bank statements monthly — know where every dollar goes"}
          ],
          "Goal Specificity": [
            {rank:1,source:"Value Engine",action:"Apply Number One Clarity from Chapter 4 — make your #1 priority crystal clear",reference:"Chapter 4, p.162"},
            {rank:2,source:"Value Engine",action:"Use the Income Multiplier Model (Tool #12) to set specific, measurable financial goals",reference:"Chapter 4, p.156"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on goal specificity as the foundation of all achievement",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Turn one vague goal into a specific, measurable, time-bound goal. 'I will [what] by [when].'"},
            {rank:5,source:"Practical",action:"Write your #1 goal on a card and carry it with you everywhere"},
            {rank:6,source:"Practical",action:"Break your biggest goal into weekly milestones — make progress visible"},
            {rank:7,source:"Practical",action:"Share your goal with one accountability partner this week"},
            {rank:8,source:"General",action:"SMART goals work: Specific, Measurable, Achievable, Relevant, Time-bound"},
            {rank:9,source:"General",action:"Write goals down — people who write goals are 42% more likely to achieve them"},
            {rank:10,source:"General",action:"Review and revise goals quarterly — specificity requires ongoing refinement"}
          ],
          "Investment Logic": [
            {rank:1,source:"Value Engine",action:"Apply the Cost vs Value framework from Chapter 4 — think in returns, not expenses",reference:"Chapter 4, p.158"},
            {rank:2,source:"Value Engine",action:"Use the Income Multiplier Model (Tool #12) to evaluate investment returns",reference:"Chapter 4, p.156"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on investment logic and thinking like an investor in every area",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Before your next purchase over $50, write down the expected return. If there is none, reconsider."},
            {rank:5,source:"Practical",action:"Categorize every expense as 'cost' or 'investment' for one month"},
            {rank:6,source:"Practical",action:"Invest in yourself first — education, skills, and tools have the highest ROI"},
            {rank:7,source:"Practical",action:"Calculate the opportunity cost of your next big decision — what else could that money do?"},
            {rank:8,source:"General",action:"Think in terms of expected value — probability of return × magnitude of return"},
            {rank:9,source:"General",action:"Diversify your investments — time, money, relationships, and skills"},
            {rank:10,source:"General",action:"The best investment is always in your ability to earn more"}
          ],
          "Measurement Habit": [
            {rank:1,source:"Value Engine",action:"Apply the Measurement Habit framework from Chapter 4 — what gets measured gets managed",reference:"Chapter 4, p.154"},
            {rank:2,source:"Value Engine",action:"Use the Financial Snapshot (Tool #4) as your measurement baseline",reference:"Chapter 4, p.148"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on building daily measurement habits that drive results",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Pick one metric that matters and track it daily for 7 days. Weight, income, hours — anything."},
            {rank:5,source:"Practical",action:"Create a personal dashboard with your top 3-5 life metrics"},
            {rank:6,source:"Practical",action:"Review your metrics weekly — look for trends, not just numbers"},
            {rank:7,source:"Practical",action:"Make tracking automatic wherever possible — use apps, spreadsheets, or simple tally marks"},
            {rank:8,source:"General",action:"What gets measured gets managed — Peter Drucker"},
            {rank:9,source:"General",action:"Lead indicators beat lag indicators — track inputs, not just outputs"},
            {rank:10,source:"General",action:"Celebrate measurement improvements, not just outcomes"}
          ],
          "Cost vs Value": [
            {rank:1,source:"Value Engine",action:"Apply the Cost vs Value framework from Chapter 4 — every dollar is either spent or invested",reference:"Chapter 4, p.158"},
            {rank:2,source:"Value Engine",action:"Run the Financial Snapshot (Tool #4) to categorize all expenses",reference:"Chapter 4, p.148"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on the critical distinction between cost and value",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Look at your last 5 purchases. For each, write 'cost' or 'investment.' Be honest."},
            {rank:5,source:"Practical",action:"Before every purchase this week, ask: 'Is this a cost or an investment?'"},
            {rank:6,source:"Practical",action:"Reduce one recurring cost this week that provides no value"},
            {rank:7,source:"Practical",action:"Redirect the saved money toward something that creates a return"},
            {rank:8,source:"General",action:"Price is what you pay, value is what you get — Warren Buffett"},
            {rank:9,source:"General",action:"The cheapest option is often the most expensive in the long run"},
            {rank:10,source:"General",action:"Invest in quality where it matters — tools, education, health, relationships"}
          ],
          "Number One Clarity": [
            {rank:1,source:"Value Engine",action:"Apply Number One Clarity from Chapter 4 — know your single most important priority",reference:"Chapter 4, p.162"},
            {rank:2,source:"Value Engine",action:"Use the Time Reallocation Planner (Tool #9) to align time with your #1 priority",reference:"Chapter 1, p.78"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on why clarity of priority is the ultimate competitive advantage",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Write down your #1 priority on a card. Carry it. Check it before every commitment."},
            {rank:5,source:"Practical",action:"Say no to one thing this week that doesn't serve your #1 priority"},
            {rank:6,source:"Practical",action:"Start every day by asking: 'What one thing, if I accomplished it today, makes everything else easier?'"},
            {rank:7,source:"Practical",action:"Review your #1 priority weekly — make sure it's still right"},
            {rank:8,source:"General",action:"The ONE Thing — what's the one thing you can do that makes everything else easier or unnecessary?"},
            {rank:9,source:"General",action:"Clarity of purpose is rare — it gives you an unfair advantage over everyone who's confused"},
            {rank:10,source:"General",action:"If everything is important, nothing is. Choose one."}
          ],
          "Small Improvements": [
            {rank:1,source:"Value Engine",action:"Apply the Small Improvements principle from Chapter 4 — 1% daily compounds into 37x annually",reference:"Chapter 4, p.164"},
            {rank:2,source:"Value Engine",action:"Use the Income Multiplier Model (Tool #12) to map compound improvements",reference:"Chapter 4, p.156"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on marginal gains and the mathematics of daily improvement",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Pick one thing and improve it by 1% today. Just one thing. Do it again tomorrow."},
            {rank:5,source:"Practical",action:"Track your daily improvement — write down what you improved each day before bed"},
            {rank:6,source:"Practical",action:"Focus on process improvements, not just outcome improvements"},
            {rank:7,source:"Practical",action:"Apply the kaizen mindset: continuous, incremental improvement in everything you do"},
            {rank:8,source:"General",action:"James Clear's Atomic Habits: get 1% better every day, and you'll be 37x better in a year"},
            {rank:9,source:"General",action:"Small improvements are sustainable — big changes often aren't"},
            {rank:10,source:"General",action:"Focus on systems, not goals — systems produce consistent improvement"}
          ],
          "Negative Math": [
            {rank:1,source:"Value Engine",action:"Apply Negative Math from Chapter 4 — sometimes the fastest way to grow is to cut",reference:"Chapter 4, p.166"},
            {rank:2,source:"Value Engine",action:"Use the Financial Snapshot (Tool #4) to identify what's costing more than it returns",reference:"Chapter 4, p.148"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on the power of subtraction and eliminating waste",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Identify one expense, habit, or commitment costing more than it returns. Cut it this week."},
            {rank:5,source:"Practical",action:"Audit all subscriptions — cancel anything you haven't used in 30 days"},
            {rank:6,source:"Practical",action:"Stop one activity that drains time without producing results"},
            {rank:7,source:"Practical",action:"Apply negative math to relationships too — reduce time with people who cost you energy"},
            {rank:8,source:"General",action:"Addition by subtraction — sometimes removing the wrong things matters more than adding right things"},
            {rank:9,source:"General",action:"Warren Buffett's 'avoid list' — things NOT to do are more important than your to-do list"},
            {rank:10,source:"General",action:"Regularly prune — your life, like a garden, grows better with strategic cutting"}
          ],
          "Income Multiplier": [
            {rank:1,source:"Value Engine",action:"Run the Income Multiplier Model (Tool #12) — map compound improvements over 90 days",reference:"Chapter 4, p.156"},
            {rank:2,source:"Value Engine",action:"Calculate your Value Per Hour (Tool #5) as the baseline for multiplication",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on the Income Multiplier principle and how small gains compound",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Map 3 specific ways your income could grow 10% in 90 days. Not theories — specific actions."},
            {rank:5,source:"Practical",action:"Add one income stream or revenue source this quarter"},
            {rank:6,source:"Practical",action:"Raise your prices or negotiate your compensation — most people undercharge"},
            {rank:7,source:"Practical",action:"Invest one hour daily in the skill that most directly increases your earning power"},
            {rank:8,source:"General",action:"Multiple income streams reduce risk and increase total earnings"},
            {rank:9,source:"General",action:"Focus on scalable income — decouple your earnings from your hours"},
            {rank:10,source:"General",action:"Your income is a direct reflection of the value you provide — increase the value"}
          ],
          "Negotiation Skill": [
            {rank:1,source:"Value Engine",action:"Apply negotiation principles from Chapter 4 — every interaction is a negotiation",reference:"Chapter 4, p.168"},
            {rank:2,source:"Value Engine",action:"Use the Value Per Hour Calculator (Tool #5) to know your walk-away number",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Read Chapter 4 on negotiation as a core Numbers skill",reference:"Chapter 4"},
            {rank:4,source:"Practical",action:"Next time someone gives you a price, ask: 'Is that the best you can do?' Just ask."},
            {rank:5,source:"Practical",action:"Practice negotiating one small thing this week — a bill, a deadline, a price"},
            {rank:6,source:"Practical",action:"Always know your BATNA (Best Alternative To Negotiated Agreement) before entering a negotiation"},
            {rank:7,source:"Practical",action:"Let silence work for you — after making an offer, stop talking"},
            {rank:8,source:"General",action:"You don't get what you deserve, you get what you negotiate"},
            {rank:9,source:"General",action:"Negotiation is a skill, not a talent — practice it like any other skill"},
            {rank:10,source:"General",action:"Win-win negotiations build long-term relationships — don't negotiate to defeat"}
          ]
        },
        Knowledge: {
          "Learning Hours": [
            {rank:1,source:"Value Engine",action:"Apply the Knowledge ROI Calculator (Tool #7) to measure returns on your learning time",reference:"Chapter 5, p.172"},
            {rank:2,source:"Value Engine",action:"Use the 1,800-Hour Framework to carve out dedicated learning time",reference:"Chapter 1, p.30"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on the Knowledge pillar and learning as an investment",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Schedule 30 minutes of intentional learning today. Not scrolling — reading, studying, or practicing."},
            {rank:5,source:"Practical",action:"Block a recurring 'learning hour' in your calendar 5 days a week"},
            {rank:6,source:"Practical",action:"Replace one entertainment hour with one learning hour this week"},
            {rank:7,source:"Practical",action:"Use commute or downtime for audiobooks or podcasts in your field"},
            {rank:8,source:"General",action:"The average CEO reads 52 books a year — schedule reading time like a meeting"},
            {rank:9,source:"General",action:"Focused learning beats passive consumption — study with intention"},
            {rank:10,source:"General",action:"1 hour of learning per day = 365 hours per year = the equivalent of 9 work weeks"}
          ],
          "Application Rate": [
            {rank:1,source:"Value Engine",action:"Apply the Knowledge ROI Calculator (Tool #7) — knowledge without application is trivia",reference:"Chapter 5, p.172"},
            {rank:2,source:"Value Engine",action:"Use the Double Jeopardy principle to ensure lessons are applied immediately",reference:"Chapter 5, p.182"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on closing the gap between knowing and doing",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Think of the last thing you learned. Apply it to something real today."},
            {rank:5,source:"Practical",action:"After every book, course, or article, write down 3 specific actions to take"},
            {rank:6,source:"Practical",action:"Teach someone what you just learned — teaching forces application"},
            {rank:7,source:"Practical",action:"Create a 'learning → action' log: what you learned, what you did with it"},
            {rank:8,source:"General",action:"Knowledge is potential power — application is actual power"},
            {rank:9,source:"General",action:"Apply within 48 hours or it's wasted — knowledge has a shelf life"},
            {rank:10,source:"General",action:"Focus on 'just-in-time' learning — learn what you need for your current challenge"}
          ],
          "Bias Awareness": [
            {rank:1,source:"Value Engine",action:"Apply the Weighted Analysis framework from Chapter 5 to overcome cognitive biases",reference:"Chapter 5, p.186"},
            {rank:2,source:"Value Engine",action:"Use the Perception vs Perspective tool to challenge your own blind spots",reference:"Chapter 5, p.188"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on bias awareness as a knowledge multiplier",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Before your next big decision, ask: 'What am I not seeing? What would a disagreer say?'"},
            {rank:5,source:"Practical",action:"Seek out one perspective this week that directly contradicts your own"},
            {rank:6,source:"Practical",action:"Ask a trusted advisor to challenge your reasoning on an important decision"},
            {rank:7,source:"Practical",action:"Keep a decision journal — review past decisions to spot recurring biases"},
            {rank:8,source:"General",action:"Confirmation bias is the most dangerous — we only see what confirms what we already believe"},
            {rank:9,source:"General",action:"Red team your own ideas — argue against yourself before others do"},
            {rank:10,source:"General",action:"Surround yourself with diverse thinkers — homogeneous groups amplify biases"}
          ],
          "Highest & Best Use": [
            {rank:1,source:"Value Engine",action:"Apply the Highest & Best Use framework from Chapter 5 — focus on what only you can do",reference:"Chapter 5, p.176"},
            {rank:2,source:"Value Engine",action:"Calculate your Value Per Hour (Tool #5) to identify your highest-value activities",reference:"Chapter 1, p.42"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on identifying and maximizing your unique abilities",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Identify your #1 skill. This week, spend more time using it and less on things others could do."},
            {rank:5,source:"Practical",action:"Delegate or automate everything that's not in your top 20% of value creation"},
            {rank:6,source:"Practical",action:"Ask: 'What can only I do?' Focus there, delegate the rest."},
            {rank:7,source:"Practical",action:"Track how much time you spend on highest-value vs low-value work each day"},
            {rank:8,source:"General",action:"Your time is most valuable when applied to your unique strengths"},
            {rank:9,source:"General",action:"Pareto's principle in action — 20% of your skills produce 80% of your results"},
            {rank:10,source:"General",action:"The opportunity cost of doing low-value work is the high-value work you're NOT doing"}
          ],
          "Supply & Demand": [
            {rank:1,source:"Value Engine",action:"Apply the Supply & Demand framework from Chapter 5 — increase your scarcity value",reference:"Chapter 5, p.178"},
            {rank:2,source:"Value Engine",action:"Use the Knowledge ROI Calculator (Tool #7) to invest in high-demand skills",reference:"Chapter 5, p.172"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on positioning yourself where demand exceeds supply",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Google your job title + 'average salary.' Then ask: what makes me worth more than average?"},
            {rank:5,source:"Practical",action:"Identify the top 3 skills in highest demand in your industry — learn one"},
            {rank:6,source:"Practical",action:"Create a unique skill combination that's hard to replicate — stack complementary skills"},
            {rank:7,source:"Practical",action:"Position yourself as a specialist, not a generalist — specialists earn more"},
            {rank:8,source:"General",action:"Your value goes up when your supply goes down — be irreplaceable"},
            {rank:9,source:"General",action:"Study market trends — invest learning time in skills with rising demand"},
            {rank:10,source:"General",action:"The best negotiating position is being able to walk away — have multiple options"}
          ],
          "Substitution Risk": [
            {rank:1,source:"Value Engine",action:"Apply the Substitution Risk framework from Chapter 5 — build what AI can't replace",reference:"Chapter 5, p.180"},
            {rank:2,source:"Value Engine",action:"Use the Knowledge ROI Calculator (Tool #7) to invest in future-proof skills",reference:"Chapter 5, p.172"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on reducing your substitution risk in the age of AI",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Write down 3 things you do that AI or a cheaper worker could replace. Start building what they can't."},
            {rank:5,source:"Practical",action:"Invest in uniquely human skills: leadership, creativity, emotional intelligence, judgment"},
            {rank:6,source:"Practical",action:"Learn to USE AI as a multiplier, not compete against it"},
            {rank:7,source:"Practical",action:"Develop proprietary knowledge — systems, relationships, and insights that can't be copied"},
            {rank:8,source:"General",action:"The safest career move is making yourself irreplaceable through unique value"},
            {rank:9,source:"General",action:"Focus on the intersection of multiple skills — unique combinations are harder to substitute"},
            {rank:10,source:"General",action:"Stay adaptable — the ability to learn new skills quickly is itself irreplaceable"}
          ],
          "Double Jeopardy": [
            {rank:1,source:"Value Engine",action:"Apply the Rule of Double Jeopardy from Chapter 5 — never pay for the same mistake twice",reference:"Chapter 5, p.182"},
            {rank:2,source:"Value Engine",action:"Use a structured learning system to capture and apply lessons from failures",reference:"Chapter 5"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on turning mistakes into compounding knowledge",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Think of your last big mistake. Write the lesson in one sentence. Put it where you'll see it."},
            {rank:5,source:"Practical",action:"Keep a 'lessons learned' journal — review it before making similar decisions"},
            {rank:6,source:"Practical",action:"After every failure, do a quick post-mortem: what happened, why, what's the lesson?"},
            {rank:7,source:"Practical",action:"Share your lessons with others — accountability makes learning stick"},
            {rank:8,source:"General",action:"Failure is tuition — but only if you learn the lesson. Otherwise, it's just a loss."},
            {rank:9,source:"General",action:"Smart people learn from their mistakes. Wise people learn from others' mistakes."},
            {rank:10,source:"General",action:"Create checklists from past mistakes — systems prevent repeat errors"}
          ],
          "Knowledge Compounding": [
            {rank:1,source:"Value Engine",action:"Apply the Knowledge Compounding framework from Chapter 5 — connect ideas across domains",reference:"Chapter 5, p.184"},
            {rank:2,source:"Value Engine",action:"Use the Knowledge ROI Calculator (Tool #7) to identify your highest-compounding knowledge areas",reference:"Chapter 5, p.172"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on how cross-domain thinking is the ultimate multiplier",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Connect something you learned in one area to a problem in a different area. Cross-domain thinking multiplies."},
            {rank:5,source:"Practical",action:"Read outside your field — the best ideas come from unexpected connections"},
            {rank:6,source:"Practical",action:"Keep an 'idea connection' journal — when you see a link between two concepts, write it down"},
            {rank:7,source:"Practical",action:"Teach concepts from one field using analogies from another — it deepens understanding"},
            {rank:8,source:"General",action:"Charlie Munger's mental models — the more frameworks you know, the better your decisions"},
            {rank:9,source:"General",action:"T-shaped knowledge: go deep in one area, go wide across many — the intersection is gold"},
            {rank:10,source:"General",action:"Review and reorganize what you know regularly — spaced repetition compounds knowledge"}
          ],
          "Weighted Analysis": [
            {rank:1,source:"Value Engine",action:"Apply the Weighted Analysis framework from Chapter 5 — not all factors are equal",reference:"Chapter 5, p.186"},
            {rank:2,source:"Value Engine",action:"Use weighted scoring for all major decisions as taught in Chapter 5",reference:"Chapter 5"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on making better decisions through weighted analysis",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"For your next decision, list 3 factors. Weight them 1-10 by importance. Rate each. Highest total wins."},
            {rank:5,source:"Practical",action:"Create a decision matrix template and use it for every major choice"},
            {rank:6,source:"Practical",action:"Separate emotions from analysis — use numbers to cut through feelings"},
            {rank:7,source:"Practical",action:"Include opportunity cost as a weighted factor in every analysis"},
            {rank:8,source:"General",action:"Decision quality > decision speed in most cases — take time to analyze"},
            {rank:9,source:"General",action:"Expected value thinking — probability × magnitude = the true value of each option"},
            {rank:10,source:"General",action:"Revisit major decisions after 90 days — learn from your decision-making process"}
          ],
          "Perception vs Perspective": [
            {rank:1,source:"Value Engine",action:"Apply the Perception vs Perspective framework from Chapter 5 — challenge your default lens",reference:"Chapter 5, p.188"},
            {rank:2,source:"Value Engine",action:"Use the Bias Awareness tools alongside perspective-taking",reference:"Chapter 5"},
            {rank:3,source:"Value Engine",action:"Read Chapter 5 on the difference between perception and perspective",reference:"Chapter 5"},
            {rank:4,source:"Practical",action:"Ask someone you respect how they see a situation you're dealing with. Compare their view to yours."},
            {rank:5,source:"Practical",action:"Before reacting to any situation, ask: 'What else could this mean?'"},
            {rank:6,source:"Practical",action:"Seek feedback from 3 different people on one decision — look for patterns"},
            {rank:7,source:"Practical",action:"Practice seeing situations from the other person's point of view before responding"},
            {rank:8,source:"General",action:"Your perception is your reality — but it's not THE reality"},
            {rank:9,source:"General",action:"Travel, read widely, and talk to diverse people — it broadens perspective permanently"},
            {rank:10,source:"General",action:"The map is not the territory — be willing to redraw your mental maps"}
          ]
        }
      };

      // Get recommendations for the requested pillar/sub-category
      const pillarRecs = recommendationsDB[pillar] || {};
      let recs = pillarRecs[subCategory] || [];

      // If no exact sub-category match, return recommendations for the first sub-category in the pillar
      if (recs.length === 0 && Object.keys(pillarRecs).length > 0) {
        recs = Object.values(pillarRecs)[0];
      }

      return res.json({
        pillar,
        subCategory,
        percentOfUsersWeak: percentWeak,
        recommendations: recs
      });
    }

    // GET /api/premium/check-membership?email={email} (Feature 6)
    if (req.method === 'GET' && url.startsWith('/premium/check-membership')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      if (!email) return res.status(400).json({ error: 'email required' });

      // Check Stripe for active subscription
      let isMember = false;
      let tier = null;
      try {
        if (process.env.STRIPE_SECRET_KEY) {
          const stripeResp = await fetch('https://api.stripe.com/v1/customers/search?query=email:"' + encodeURIComponent(email) + '"', {
            headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
          });
          const stripeData = await stripeResp.json();
          if (stripeData.data && stripeData.data.length > 0) {
            for (const customer of stripeData.data) {
              const subsResp = await fetch('https://api.stripe.com/v1/subscriptions?customer=' + customer.id + '&status=active', {
                headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
              });
              const subsData = await subsResp.json();
              if (subsData.data && subsData.data.length > 0) {
                isMember = true;
                // Determine tier from subscription amount
                const amount = subsData.data[0].items?.data?.[0]?.price?.unit_amount;
                if (amount >= 49700) tier = 'Victory VIP';
                else if (amount >= 4700) tier = 'Value Builder';
                else tier = 'VictoryPath';
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error('Stripe check error:', e.message);
      }

      return res.json({ email, isMember, tier });
    }

    // POST /api/premium/send-report — Email a premium report to the user
    if (req.method === 'POST' && url === '/premium/send-report') {
      const b = req.body || {};
      const { assessmentId, reportType, email: recipientEmail } = b;
      if (!assessmentId || !reportType) return res.status(400).json({ error: 'assessmentId and reportType required' });
      if (!recipientEmail) return res.status(400).json({ error: 'email required' });

      // Fetch assessment data
      const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];

      const firstName = a.first_name || 'there';
      const name = (a.first_name || '') + ' ' + (a.last_name || '');
      const masterScore = a.master_score;
      const scoreRange = a.score_range;
      const weakestPillar = a.weakest_pillar;
      const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});

      let subject = '';
      let emailBody = '';

      if (reportType === 'action-plan') {
        subject = `Your Personal Action Plan — Master Score: ${masterScore} (${scoreRange})`;
        const pillars = ['Time', 'People', 'Influence', 'Numbers', 'Knowledge'];
        const pillarFields = { Time: 'time_total', People: 'people_total', Influence: 'influence_total', Numbers: 'numbers_total', Knowledge: 'knowledge_total' };
        let pillarSummary = pillars.map(p => `  ${p}: ${a[pillarFields[p]]}/50`).join('\n');

        emailBody = `${firstName},

Your Personal Action Plan is ready.

MASTER VALUE SCORE: ${masterScore} (${scoreRange})

Pillar Breakdown:
${pillarSummary}

Your weakest pillar is ${weakestPillar}. ${prescription.diagnosis || ''}

KEY RECOMMENDATIONS:
- Focus on your weakest pillar (${weakestPillar}) first
- Address all sub-categories where you scored 1-2 out of 5
- Use the specific action items in your full report

View your full interactive Action Plan:
https://assessment.valuetovictory.com/action-plan/${assessmentId}

This report includes personalized actions for every weakness, Value Engine tool references, a chapter-by-chapter reading plan, and a weekly accountability structure.

Don't guess. Run the system.

— The Value Engine
   ValueToVictory.com`;
      } else if (reportType === 'counselor') {
        subject = `Counselor/Coach Handoff Report — ${name} — Score: ${masterScore} (${scoreRange})`;
        emailBody = `Client Assessment Summary for ${name}

MASTER VALUE SCORE: ${masterScore}/250 (${scoreRange})

Pillar Breakdown:
  Time:      ${a.time_total}/50
  People:    ${a.people_total}/50
  Influence: ${a.influence_total}/50
  Numbers:   ${a.numbers_total}/50
  Knowledge: ${a.knowledge_total}/50

Weakest Pillar: ${weakestPillar}
${prescription.diagnosis || ''}

This report is designed for use by counselors, therapists, coaches, and mentors. It includes:
- Areas requiring clinical attention (scores 1-2)
- Client strengths inventory
- Recommended focus areas with clinical interpretations
- Suggested interventions (Value Engine + general)

View the full interactive Counselor Report:
https://assessment.valuetovictory.com/counselor-report/${assessmentId}

DISCLAIMER: This is a self-assessment tool and should not be used as a clinical diagnosis.

— The Value Engine
   ValueToVictory.com`;
      } else if (reportType === 'team') {
        subject = `Team Analysis Report — Value Engine Assessment`;
        emailBody = `Your Team Analysis Report is ready.

This report includes anonymous, aggregated team data showing:
- Team averages across all 5 pillars
- Score distribution breakdown
- Sub-category heatmap
- Top 5 team blind spots with interpretations
- Team-specific improvement recommendations

View the full interactive Team Report:
https://assessment.valuetovictory.com/team-report/${assessmentId}

No individual scores are disclosed in this report. All data is anonymous and aggregated.

— The Value Engine
   ValueToVictory.com`;
      } else {
        return res.status(400).json({ error: 'Invalid reportType. Must be: action-plan, counselor, or team' });
      }

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return res.json({ sent: false, reason: 'Email credentials not configured', reportUrl: `https://assessment.valuetovictory.com/${reportType === 'action-plan' ? 'action-plan' : reportType === 'counselor' ? 'counselor-report' : 'team-report'}/${assessmentId}` });
      }

      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
        await transporter.sendMail({
          from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
          to: recipientEmail,
          subject,
          text: emailBody,
        });
        return res.json({ sent: true, to: recipientEmail });
      } catch (emailErr) {
        console.error('Premium report email error:', emailErr.message);
        return res.json({ sent: false, reason: emailErr.message });
      }
    }

    // GET /api/team-report/{teamId} (Feature 3 - data endpoint)
    if (req.method === 'GET' && url.match(/^\/team-report\/\d+$/)) {
      const teamId = parseInt(url.split('/team-report/')[1]);

      // Get team info
      const teamRows = await sql`SELECT * FROM teams WHERE id = ${teamId} LIMIT 1`;
      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found' });
      const team = teamRows[0];

      // Get all assessments for this team
      const members = await sql`SELECT a.* FROM assessments a WHERE a.team_id = ${teamId} ORDER BY a.completed_at DESC`;
      if (members.length === 0) return res.json({ error: 'No assessments found for this team', team });

      const n = members.length;

      // Calculate averages
      const avg = (arr) => Math.round((arr.reduce((s, v) => s + Number(v), 0) / arr.length) * 10) / 10;
      const avgMaster = avg(members.map(m => m.master_score));
      const pillarAvgs = {
        Time: avg(members.map(m => m.time_total)),
        People: avg(members.map(m => m.people_total)),
        Influence: avg(members.map(m => m.influence_total)),
        Numbers: avg(members.map(m => m.numbers_total)),
        Knowledge: avg(members.map(m => m.knowledge_total)),
      };

      // Score distribution
      const distrib = { Crisis: 0, Survival: 0, Growth: 0, Momentum: 0, Mastery: 0 };
      members.forEach(m => { distrib[m.score_range] = (distrib[m.score_range] || 0) + 1; });

      // Sub-category averages
      const subFields = {
        Time: [['Time Awareness','time_awareness'],['Time Allocation','time_allocation'],['Time Protection','time_protection'],['Time Leverage','time_leverage'],['Five-Hour Leak','five_hour_leak'],['Value Per Hour','value_per_hour'],['Time Investment','time_investment'],['Downtime Quality','downtime_quality'],['Foresight','foresight'],['Time Reallocation','time_reallocation']],
        People: [['Trust Investment','trust_investment'],['Boundary Quality','boundary_quality'],['Network Depth','network_depth'],['Relational ROI','relational_roi'],['People Audit','people_audit'],['Alliance Building','alliance_building'],['Love Bank Deposits','love_bank_deposits'],['Communication Clarity','communication_clarity'],['Restraint Practice','restraint_practice'],['Value Replacement','value_replacement']],
        Influence: [['Leadership Level','leadership_level'],['Integrity Alignment','integrity_alignment'],['Professional Credibility','professional_credibility'],['Empathetic Listening','empathetic_listening'],['Gravitational Center','gravitational_center'],['Micro-Honesties','micro_honesties'],['Word Management','word_management'],['Personal Responsibility','personal_responsibility'],['Adaptive Influence','adaptive_influence'],['Influence Multiplier','influence_multiplier']],
        Numbers: [['Financial Awareness','financial_awareness'],['Goal Specificity','goal_specificity'],['Investment Logic','investment_logic'],['Measurement Habit','measurement_habit'],['Cost vs Value','cost_vs_value'],['Number One Clarity','number_one_clarity'],['Small Improvements','small_improvements'],['Negative Math','negative_math'],['Income Multiplier','income_multiplier'],['Negotiation Skill','negotiation_skill']],
        Knowledge: [['Learning Hours','learning_hours'],['Application Rate','application_rate'],['Bias Awareness','bias_awareness'],['Highest & Best Use','highest_best_use'],['Supply & Demand','supply_and_demand'],['Substitution Risk','substitution_risk'],['Double Jeopardy','double_jeopardy'],['Knowledge Compounding','knowledge_compounding'],['Weighted Analysis','weighted_analysis'],['Perception vs Perspective','perception_vs_perspective']]
      };

      const subCategoryData = {};
      const allSubAvgs = [];
      for (const [pillar, subs] of Object.entries(subFields)) {
        subCategoryData[pillar] = [];
        for (const [name, field] of subs) {
          const values = members.map(m => Number(m[field]) || 0);
          const subAvg = avg(values);
          const lowCount = values.filter(v => v <= 2).length;
          const lowPct = Math.round((lowCount / n) * 100);
          subCategoryData[pillar].push({ name, avg: subAvg, lowPercent: lowPct });
          allSubAvgs.push({ pillar, name, avg: subAvg, lowPercent: lowPct });
        }
      }

      // Top 5 blind spots (lowest avg sub-categories)
      const blindSpots = [...allSubAvgs].sort((a, b) => a.avg - b.avg).slice(0, 5);

      // Blind spot interpretations
      const interpretations = {
        "Time Protection": "Your team feels their schedule is controlled by others",
        "Boundary Quality": "Your team struggles to enforce boundaries — possible culture issue",
        "Financial Awareness": "Your team doesn't understand the financial picture",
        "Communication Clarity": "Your team has communication breakdowns",
        "Time Awareness": "Your team can't account for where their time goes — productivity leak",
        "Time Allocation": "Your team spends too much time on low-priority work",
        "Trust Investment": "Trust levels in your team are low — impacting collaboration",
        "Network Depth": "Your team lacks deep professional relationships",
        "Leadership Level": "Your team's leadership capacity needs development",
        "Integrity Alignment": "There's a gap between your team's stated and lived values",
        "Goal Specificity": "Your team lacks clear, measurable goals",
        "Learning Hours": "Your team isn't investing enough time in professional development",
        "People Audit": "Your team hasn't assessed their professional relationships",
        "Restraint Practice": "Your team may have communication discipline issues",
        "Value Per Hour": "Your team doesn't understand their true hourly value"
      };

      const sortedPillars = Object.entries(pillarAvgs).sort((a, b) => b[1] - a[1]);
      const strongestPillar = sortedPillars[0][0];
      const weakestPillar = sortedPillars[sortedPillars.length - 1][0];

      // Date range
      const dates = members.map(m => new Date(m.completed_at));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      return res.json({
        team: { id: team.id, name: team.name, mode: team.mode },
        participantCount: n,
        dateRange: { from: minDate.toISOString(), to: maxDate.toISOString() },
        averageMasterScore: avgMaster,
        scoreDistribution: distrib,
        pillarAverages: pillarAvgs,
        strongestPillar,
        weakestPillar,
        subCategoryData,
        blindSpots: blindSpots.map(bs => ({
          ...bs,
          interpretation: interpretations[bs.name] || `Your team scored low in ${bs.name}`
        })),
      });
    }

    // POST /api/coaching/submit — Coaching call intake form submission
    if (req.method === 'POST' && url === '/coaching/submit') {
      const b = req.body || {};
      const { name, email, track, goals, questions, biggest_challenge, assessment_id, re_years, re_specialty, re_volume, company_name, company_role, company_size, company_department } = b;

      if (!name || !email || !track || !goals || !questions || !biggest_challenge) {
        return res.status(400).json({ error: 'All required fields must be filled out.' });
      }
      if (!['real_estate', 'personal', 'company'].includes(track)) {
        return res.status(400).json({ error: 'Track must be real_estate, personal, or company.' });
      }

      // Generate verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomUUID();

      // Look up contact_id if we have an assessment_id
      let contactId = null;
      if (assessment_id) {
        try {
          const aRows = await sql`SELECT contact_id FROM assessments WHERE id = ${assessment_id} LIMIT 1`;
          if (aRows.length > 0) contactId = aRows[0].contact_id;
        } catch (e) { /* non-fatal */ }
      }

      // Insert coaching request
      try {
        await sql`INSERT INTO coaching_requests (assessment_id, contact_id, name, email, track, goals, questions, biggest_challenge, re_years, re_specialty, re_volume, company_name, company_role, company_size, company_department, verification_token)
          VALUES (${assessment_id || null}, ${contactId}, ${name}, ${email}, ${track}, ${goals}, ${questions}, ${biggest_challenge}, ${re_years || null}, ${re_specialty || null}, ${re_volume || null}, ${company_name || null}, ${company_role || null}, ${company_size || null}, ${company_department || null}, ${verificationToken})`;
      } catch (dbErr) {
        console.error('Coaching request DB error:', dbErr.message);
        return res.status(500).json({ error: 'Could not save your request. Please try again.' });
      }

      // Send verification email
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          const verifyUrl = `https://assessment.valuetovictory.com/api/coaching/verify?token=${verificationToken}`;
          const trackLabel = track === 'real_estate' ? 'Real Estate' : track === 'company' ? 'Company' : 'Personal';
          await transporter.sendMail({
            from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `Verify Your Email — ${trackLabel} Coaching Report`,
            text: `${name},

Thank you for requesting a ${trackLabel} coaching report from Value to Victory.

Please verify your email by clicking the link below:
${verifyUrl}

Once verified, we'll generate your personalized coaching report and email it to you within 5 minutes.

This link expires in 24 hours.

— The Value Engine
   ValueToVictory.com`,
          });
        } catch (emailErr) {
          console.error('Verification email error:', emailErr.message);
          return res.json({ submitted: true, emailSent: false, warning: 'Request saved but verification email could not be sent. Please contact us.' });
        }
      }

      return res.json({ submitted: true, emailSent: true });
    }

    // GET /api/coaching/verify?token=XXX — Verify email and trigger coaching report
    if (req.method === 'GET' && url.startsWith('/coaching/verify')) {
      const params = new URL('http://x' + req.url).searchParams;
      const token = params.get('token');
      if (!token) return res.status(400).json({ error: 'Verification token required.' });

      // Look up the coaching request
      const rows = await sql`SELECT * FROM coaching_requests WHERE verification_token = ${token} LIMIT 1`;
      if (rows.length === 0) {
        return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invalid Link</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#ef4444;">Invalid or Expired Link</h2><p style="color:#a1a1aa;">This verification link is invalid or has already been used.</p><p><a href="https://assessment.valuetovictory.com" style="color:#3b82f6;">Go to Value Engine</a></p></div></body></html>');
      }
      const cr = rows[0];

      // Check if already verified
      if (cr.verified) {
        return res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Already Verified</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#D4A847;">Already Verified</h2><p style="color:#a1a1aa;">Your email has already been verified. Your coaching report has been sent.</p><p><a href="https://assessment.valuetovictory.com" style="color:#3b82f6;">Go to Value Engine</a></p></div></body></html>');
      }

      // Check expiration (24 hours)
      const createdAt = new Date(cr.created_at);
      const now = new Date();
      if (now - createdAt > 24 * 60 * 60 * 1000) {
        return res.status(410).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link Expired</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#ef4444;">Link Expired</h2><p style="color:#a1a1aa;">This verification link has expired (24-hour limit). Please submit a new coaching request.</p><p><a href="https://assessment.valuetovictory.com/coaching" style="color:#3b82f6;">Request Again</a></p></div></body></html>');
      }

      // Mark as verified
      await sql`UPDATE coaching_requests SET verified = true, verified_at = NOW() WHERE id = ${cr.id}`;

      // Generate and send coaching report
      let reportSent = false;
      try {
        // Get assessment data if available
        let assessment = null;
        let prescription = null;
        let contact = null;
        if (cr.assessment_id) {
          const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${cr.assessment_id} LIMIT 1`;
          if (aRows.length > 0) {
            assessment = aRows[0];
            prescription = typeof assessment.prescription === 'string' ? JSON.parse(assessment.prescription) : assessment.prescription;
            contact = { firstName: assessment.first_name, lastName: assessment.last_name };
          }
        }

        const trackLabel = cr.track === 'real_estate' ? 'Real Estate' : cr.track === 'company' ? 'Company' : 'Personal';

        // Build the coaching report email
        let report = `${cr.name},\n\nYour ${trackLabel} Coaching Preparation Report is ready.\n\n`;
        report += `${'='.repeat(50)}\n`;
        report += `YOUR ${trackLabel.toUpperCase()} COACHING PREPARATION REPORT\n`;
        report += `${'='.repeat(50)}\n\n`;

        // Assessment summary (if available)
        if (assessment) {
          const cPillarMax = 50; // all depths normalized to 50-point scale
          report += `ASSESSMENT SUMMARY\n${'-'.repeat(30)}\n`;
          report += `Master Value Score: ${assessment.master_score} (${assessment.score_range})\n`;
          report += `Assessment Depth: ${assessment.depth || 'extensive'}\n`;
          report += `Pillar Breakdown:\n`;
          report += `  Time:      ${assessment.time_total}/${cPillarMax}\n`;
          report += `  People:    ${assessment.people_total}/${cPillarMax}\n`;
          report += `  Influence: ${assessment.influence_total}/${cPillarMax}\n`;
          report += `  Numbers:   ${assessment.numbers_total}/${cPillarMax}\n`;
          report += `  Knowledge: ${assessment.knowledge_total}/${cPillarMax}\n\n`;

          // Weakest pillar deep-dive
          if (prescription) {
            report += `WEAKEST PILLAR DEEP-DIVE: ${prescription.weakestPillar}\n${'-'.repeat(30)}\n`;
            report += `Score: ${prescription.weakestScore}/${cPillarMax}\n`;
            report += `Weakest Sub-Category: ${prescription.weakestSubCategory} (${prescription.weakestSubScore}/5)\n`;
            report += `${prescription.diagnosis || ''}\n\n`;
            report += `Recommended Action: ${prescription.immediate || ''}\n`;
            report += `Tool to Use: ${prescription.tool || ''}\n\n`;
          }
        } else {
          report += `(No assessment data linked — your coaching call will include an initial assessment review.)\n\n`;
        }

        // Their stated goals
        report += `YOUR GOALS\n${'-'.repeat(30)}\n`;
        report += `${cr.goals}\n\n`;

        // Their questions as agenda items
        report += `YOUR QUESTIONS (Coaching Call Agenda Items)\n${'-'.repeat(30)}\n`;
        report += `${cr.questions}\n\n`;

        // Their biggest challenge
        report += `YOUR BIGGEST CHALLENGE\n${'-'.repeat(30)}\n`;
        report += `${cr.biggest_challenge}\n\n`;

        // RE-specific insights
        if (cr.track === 'real_estate') {
          report += `REAL ESTATE INSIGHTS\n${'-'.repeat(30)}\n`;
          if (cr.re_years) report += `Experience: ${cr.re_years}\n`;
          if (cr.re_specialty) report += `Specialty: ${cr.re_specialty}\n`;
          if (cr.re_volume) report += `Current Volume: ${cr.re_volume}\n`;
          report += `\n`;

          if (assessment && prescription) {
            if (prescription.weakestPillar === 'Numbers') {
              report += `Your Numbers pillar is your weakest area. For real estate professionals, this often means inconsistent deal analysis, unclear cost-per-lead tracking, or missing your true cost per transaction. Your coaching call should focus on building a systematic financial dashboard for your business.\n\n`;
            } else if (prescription.weakestPillar === 'People') {
              report += `Your People pillar needs attention. In real estate, this directly impacts client relationships, referral generation, and sphere of influence management. Your coaching call should focus on building a systematic approach to relationship ROI and client retention.\n\n`;
            } else if (prescription.weakestPillar === 'Time') {
              report += `Your Time pillar is holding you back. Real estate professionals often lose hours to unqualified leads, poor scheduling, and reactive work patterns. Your coaching call should focus on time-blocking, lead qualification systems, and protecting your high-value hours.\n\n`;
            } else if (prescription.weakestPillar === 'Influence') {
              report += `Your Influence pillar needs work. In real estate, influence directly drives listings, referrals, and market positioning. Your coaching call should focus on building your personal brand, market authority, and professional credibility systems.\n\n`;
            } else if (prescription.weakestPillar === 'Knowledge') {
              report += `Your Knowledge pillar is your gap. For real estate professionals, this means you may be under-investing in market knowledge, negotiation skills, or industry trends. Your coaching call should focus on building a deliberate learning system that compounds your expertise.\n\n`;
            }
          }
        }

        // Company-specific insights
        if (cr.track === 'company') {
          report += `COMPANY INSIGHTS\n${'-'.repeat(30)}\n`;
          if (cr.company_name) report += `Company: ${cr.company_name}\n`;
          if (cr.company_role) report += `Role: ${cr.company_role}\n`;
          if (cr.company_size) report += `Employees: ${cr.company_size}\n`;
          if (cr.company_department) report += `Department/Team: ${cr.company_department}\n`;
          report += `\n`;

          if (assessment && prescription) {
            if (prescription.weakestPillar === 'People') {
              report += `Your People pillar is your weakest area. For organizations, this signals gaps in team dynamics, culture alignment, and interpersonal trust across the company. Your coaching call should focus on building stronger team cohesion, communication frameworks, and a culture that retains top talent.\n\n`;
            } else if (prescription.weakestPillar === 'Numbers') {
              report += `Your Numbers pillar needs attention. At the company level, this often means financial literacy gaps across the organization — inconsistent budgeting, unclear KPIs, or teams that don't understand how their work ties to revenue. Your coaching call should focus on building financial awareness and accountability at every level.\n\n`;
            } else if (prescription.weakestPillar === 'Influence') {
              report += `Your Influence pillar needs work. For companies, weak influence scores point to leadership development gaps — managers who struggle to inspire, misaligned messaging, or lack of executive presence across the org. Your coaching call should focus on leadership development programs and influence-building frameworks for your team.\n\n`;
            } else if (prescription.weakestPillar === 'Knowledge') {
              report += `Your Knowledge pillar is your gap. At the organizational level, this means training and upskilling are falling behind — teams may lack current industry knowledge, learning budgets are underutilized, or knowledge isn't being shared effectively. Your coaching call should focus on building a learning culture and systematic upskilling programs.\n\n`;
            } else if (prescription.weakestPillar === 'Time') {
              report += `Your Time pillar is holding you back. For companies, this reflects operational efficiency problems — meetings that drain productivity, unclear priorities, bottlenecked workflows, or teams stuck in reactive mode. Your coaching call should focus on operational efficiency systems, priority frameworks, and time-protection strategies across your organization.\n\n`;
            }
          }
        }

        // Pre-call action items
        report += `PRE-CALL ACTION ITEMS\n${'-'.repeat(30)}\n`;
        report += `1. Review your assessment results and note any scores that surprised you\n`;
        if (assessment && prescription) {
          report += `2. Spend 10 minutes thinking about your ${prescription.weakestPillar} pillar — what specific situations trigger your lowest scores?\n`;
          report += `3. Write down 1-2 specific wins from the past 90 days that relate to your strongest area (${prescription.strongestPillar})\n\n`;
        } else {
          report += `2. Spend 10 minutes reflecting on where you feel most stuck right now\n`;
          report += `3. Write down 1-2 recent wins — we'll build on what's already working\n\n`;
        }

        // Value Engine tools recommendation (ALWAYS first)
        report += `RECOMMENDED TOOLS (Value Engine)\n${'-'.repeat(30)}\n`;
        report += `1. The Value Engine Assessment — your diagnostic baseline (valuetovictory.com)\n`;
        report += `2. VictoryPath Membership ($29/mo) — structured tools, community, and accountability\n`;
        report += `3. Value Builder ($47/mo) — full course access, advanced tools, and monthly Q&A\n`;
        if (cr.track === 'real_estate') {
          report += `4. Real Estate Consulting — $300 (30 min) or $500 (60 min) with Shawn Decker\n`;
        }
        if (cr.track === 'company') {
          report += `4. Company Consulting — custom engagement with Shawn Decker for team and organizational development\n`;
        }
        report += `\n`;

        // Next step
        report += `NEXT STEP\n${'-'.repeat(30)}\n`;
        report += `Your coaching call details will be sent separately. Reply to this email with any additional questions.\n\n`;
        report += `Don't guess. Run the system.\n\n`;
        report += `— The Value Engine\n`;
        report += `   Value to Victory | valuetovictory.com\n`;

        // Send the report email
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          const reportSubject = cr.track === 'company'
            ? 'Your Company Coaching Report — Value to Victory'
            : `Your ${trackLabel} Coaching Report — Value to Victory`;
          await transporter.sendMail({
            from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
            to: cr.email,
            subject: reportSubject,
            text: report,
          });
          reportSent = true;
          await sql`UPDATE coaching_requests SET report_sent = true, report_sent_at = NOW() WHERE id = ${cr.id}`;
        }
      } catch (reportErr) {
        console.error('Coaching report generation error:', reportErr.message);
      }

      // Return success HTML page
      const statusMsg = reportSent
        ? 'Your personalized coaching report has been sent to your email.'
        : 'Your email has been verified. Your coaching report will be sent shortly.';
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Email Verified</title><style>body{font-family:'Satoshi',sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style><link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" rel="stylesheet"></head><body><div style="max-width:480px;padding:2rem;"><div style="font-size:3rem;margin-bottom:1rem;">&#10003;</div><h2 style="color:#D4A847;margin-bottom:0.75rem;">Email Verified!</h2><p style="color:#a1a1aa;margin-bottom:1.5rem;">${statusMsg}</p><p style="color:#71717a;font-size:0.85rem;">Check your inbox (and spam folder) for your coaching report.</p><p style="margin-top:1.5rem;"><a href="https://assessment.valuetovictory.com" style="color:#3b82f6;text-decoration:none;">Return to Value Engine &rarr;</a></p></div></body></html>`);
    }

    // GET /api/admin/abandoned — contacts who started but never completed
    if (req.method === 'GET' && url === '/admin/abandoned') {
      const abandoned = await sql`
        SELECT c.id, c.first_name, c.last_name, c.email, c.created_at,
               (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id AND a.master_score > 0) as completed_count,
               p.current_question_index, p.total_questions, p.updated_at as progress_updated
        FROM contacts c
        LEFT JOIN assessment_progress p ON p.contact_id = c.id
        WHERE c.email IS NOT NULL AND c.email != ''
          AND c.email NOT IN ('test@valuetovictory.com','valuetovictory@gmail.com','test@example.com')
          AND NOT EXISTS (SELECT 1 FROM assessments a WHERE a.contact_id = c.id AND a.master_score > 0)
        ORDER BY c.created_at DESC
      `;
      return res.json({ abandoned: abandoned.map(r => ({
        contactId: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email,
        createdAt: r.created_at, hasProgress: !!r.current_question_index,
        questionsAnswered: r.current_question_index || 0, totalQuestions: r.total_questions || 0,
        progressUpdated: r.progress_updated
      }))});
    }


    // GET /api/book-count — track free book giveaway count
    if (req.method === 'GET' && url === '/book-count') {
      try {
        const countResult = await sql`
          SELECT 
            COUNT(*) as total_signups,
            COUNT(*) FILTER (WHERE verified = true) as verified_copies
          FROM free_book_signups
        `;
        return res.status(200).json({
          total_signups: parseInt(countResult[0].total_signups) || 0,
          verified_copies: parseInt(countResult[0].verified_copies) || 0,
          goal: 1000000
        });
      } catch (err) {
        return res.status(200).json({ total_signups: 0, verified_copies: 0, goal: 1000000 });
      }
    }


    // POST /api/couples — Create a couple pairing and invite partner
    if (req.method === 'POST' && url === '/couples') {
      const b = req.body || {};
      if (!b.initiatorContactId || !b.partnerEmail || !b.partnerName) {
        return res.status(400).json({ error: 'initiatorContactId, partnerEmail, and partnerName are required' });
      }
      
      // Create couples table if not exists
      await sql`CREATE TABLE IF NOT EXISTS couples (
        id SERIAL PRIMARY KEY,
        initiator_contact_id INTEGER NOT NULL,
        partner_email TEXT NOT NULL,
        partner_contact_id INTEGER,
        partner_name TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`;
      
      const inviteCode = require('crypto').randomBytes(16).toString('hex');
      
      const rows = await sql`INSERT INTO couples (initiator_contact_id, partner_email, partner_name, invite_code) 
        VALUES (${b.initiatorContactId}, ${b.partnerEmail.toLowerCase()}, ${b.partnerName}, ${inviteCode}) RETURNING *`;
      
      // Get initiator's name
      const initiator = await sql`SELECT first_name, last_name FROM contacts WHERE id = ${b.initiatorContactId} LIMIT 1`;
      const initiatorName = initiator.length > 0 ? `${initiator[0].first_name} ${initiator[0].last_name}` : 'Your partner';
      
      // Send invite email
      const inviteUrl = `https://assessment.valuetovictory.com/partner-invite?code=${inviteCode}`;
      
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
        });
        
        await transporter.sendMail({
          from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
          to: b.partnerEmail,
          subject: `${initiatorName} invited you to take the P.I.N.K. Relationship Assessment`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
            <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr><td style="text-align:center;padding-bottom:24px;">
              <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:8px;">VALUE TO VICTORY</div>
              <div style="font-family:Georgia,serif;font-size:24px;font-style:italic;color:#fff;">Relationship Assessment Invite</div>
            </td></tr>
            <tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;">
              <p style="color:#e4e4e7;font-size:16px;margin:0 0 16px;">Hey ${b.partnerName},</p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px;">
                <strong style="color:#D4A847;">${initiatorName}</strong> wants to take the P.I.N.K. Relationship Assessment together with you.
              </p>
              <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                This assessment measures five pillars of value — People, Influence, Numbers, Knowledge, and Time — and creates a combined report showing where you align, where you differ, and specific actions to strengthen your relationship.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
                <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 40px;border-radius:8px;">
                  Take the Assessment Together
                </a>
              </td></tr></table>
              <p style="color:#71717a;font-size:13px;margin:24px 0 0;text-align:center;">
                This link is unique to your invitation. It takes about 10 minutes.
              </p>
            </td></tr>
            <tr><td style="text-align:center;padding-top:24px;">
              <p style="color:#52525b;font-size:12px;">&copy; 2026 Value to Victory — Shawn E. Decker</p>
            </td></tr>
            </table></td></tr></table></body></html>`
        });
      }
      
      return res.json({ success: true, couple: rows[0], inviteUrl: `https://assessment.valuetovictory.com/partner-invite?code=${inviteCode}` });
    }

    // GET /api/couples/invite/:code — Get couple invite details
    if (req.method === 'GET' && url.startsWith('/couples/invite/')) {
      const code = url.split('/couples/invite/')[1];
      await sql`CREATE TABLE IF NOT EXISTS couples (id SERIAL PRIMARY KEY, initiator_contact_id INTEGER NOT NULL, partner_email TEXT NOT NULL, partner_contact_id INTEGER, partner_name TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ)`;
      const rows = await sql`SELECT * FROM couples WHERE invite_code = ${code} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Invite not found or expired' });
      const couple = rows[0];
      const initiator = await sql`SELECT first_name, last_name FROM contacts WHERE id = ${couple.initiator_contact_id} LIMIT 1`;
      return res.json({
        partnerName: couple.partner_name,
        initiatorName: initiator.length > 0 ? `${initiator[0].first_name} ${initiator[0].last_name}` : 'Your partner',
        status: couple.status
      });
    }

    // POST /api/couples/complete — Mark partner assessment complete, link to couple
    if (req.method === 'POST' && url === '/couples/complete') {
      const b = req.body || {};
      if (!b.inviteCode || !b.contactId) {
        return res.status(400).json({ error: 'inviteCode and contactId required' });
      }
      await sql`UPDATE couples SET partner_contact_id = ${b.contactId}, status = 'completed', completed_at = NOW() WHERE invite_code = ${b.inviteCode}`;
      return res.json({ success: true });
    }

    // GET /api/couples/results — Get combined couple results
    if (req.method === 'GET' && url.startsWith('/couples/results')) {
      const params = new URL('http://x' + req.url).searchParams;
      const code = params.get('code');
      if (!code) return res.status(400).json({ error: 'code parameter required' });
      
      const coupleRows = await sql`SELECT * FROM couples WHERE invite_code = ${code} LIMIT 1`;
      if (coupleRows.length === 0) return res.status(404).json({ error: 'Couple not found' });
      const couple = coupleRows[0];
      
      if (couple.status !== 'completed' || !couple.partner_contact_id) {
        return res.json({ status: 'waiting', message: 'Partner has not completed the assessment yet' });
      }
      
      // Get both assessments (most recent for each)
      const initiatorAssessment = await sql`SELECT * FROM assessments WHERE contact_id = ${couple.initiator_contact_id} ORDER BY completed_at DESC LIMIT 1`;
      const partnerAssessment = await sql`SELECT * FROM assessments WHERE contact_id = ${couple.partner_contact_id} ORDER BY completed_at DESC LIMIT 1`;
      
      const initiatorContact = await sql`SELECT first_name, last_name FROM contacts WHERE id = ${couple.initiator_contact_id} LIMIT 1`;
      const partnerContact = await sql`SELECT first_name, last_name FROM contacts WHERE id = ${couple.partner_contact_id} LIMIT 1`;
      
      // Helper to parse scores
      function getScores(a) {
        if (!a) return { time: 0, people: 0, influence: 0, numbers: 0, knowledge: 0, total: 0 };
        return {
          time: Number(a.time_total) || 0,
          people: Number(a.people_total) || 0,
          influence: Number(a.influence_total) || 0,
          numbers: Number(a.numbers_total) || 0,
          knowledge: Number(a.knowledge_total) || 0,
          total: Number(a.master_score) || 0
        };
      }
      
      const iScores = getScores(initiatorAssessment[0]);
      const pScores = getScores(partnerAssessment[0]);
      
      return res.json({
        status: 'complete',
        initiator: {
          name: initiatorContact.length > 0 ? `${initiatorContact[0].first_name} ${initiatorContact[0].last_name}` : 'Partner 1',
          scores: iScores
        },
        partner: {
          name: partnerContact.length > 0 ? `${partnerContact[0].first_name} ${partnerContact[0].last_name}` : 'Partner 2',
          scores: pScores
        },
        gaps: {
          time: Math.abs(iScores.time - pScores.time),
          people: Math.abs(iScores.people - pScores.people),
          influence: Math.abs(iScores.influence - pScores.influence),
          numbers: Math.abs(iScores.numbers - pScores.numbers),
          knowledge: Math.abs(iScores.knowledge - pScores.knowledge)
        }
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Map snake_case DB columns to camelCase for frontend
function mapAssessment(a) {
  if (!a) return a;
  return {
    id: a.id, contactId: a.contact_id, completedAt: a.completed_at, mode: a.mode, teamId: a.team_id, isTeamCreator: a.is_team_creator,
    timeAwareness: a.time_awareness, timeAllocation: a.time_allocation, timeProtection: a.time_protection, timeLeverage: a.time_leverage, fiveHourLeak: a.five_hour_leak, valuePerHour: a.value_per_hour, timeInvestment: a.time_investment, downtimeQuality: a.downtime_quality, foresight: a.foresight, timeReallocation: a.time_reallocation, timeTotal: a.time_total,
    trustInvestment: a.trust_investment, boundaryQuality: a.boundary_quality, networkDepth: a.network_depth, relationalRoi: a.relational_roi, peopleAudit: a.people_audit, allianceBuilding: a.alliance_building, loveBankDeposits: a.love_bank_deposits, communicationClarity: a.communication_clarity, restraintPractice: a.restraint_practice, valueReplacement: a.value_replacement, peopleTotal: a.people_total,
    leadershipLevel: a.leadership_level, integrityAlignment: a.integrity_alignment, professionalCredibility: a.professional_credibility, empatheticListening: a.empathetic_listening, gravitationalCenter: a.gravitational_center, microHonesties: a.micro_honesties, wordManagement: a.word_management, personalResponsibility: a.personal_responsibility, adaptiveInfluence: a.adaptive_influence, influenceMultiplier: a.influence_multiplier, influenceTotal: a.influence_total,
    financialAwareness: a.financial_awareness, goalSpecificity: a.goal_specificity, investmentLogic: a.investment_logic, measurementHabit: a.measurement_habit, costVsValue: a.cost_vs_value, numberOneClarity: a.number_one_clarity, smallImprovements: a.small_improvements, negativeMath: a.negative_math, incomeMultiplier: a.income_multiplier, negotiationSkill: a.negotiation_skill, numbersTotal: a.numbers_total,
    learningHours: a.learning_hours, applicationRate: a.application_rate, biasAwareness: a.bias_awareness, highestBestUse: a.highest_best_use, supplyAndDemand: a.supply_and_demand, substitutionRisk: a.substitution_risk, doubleJeopardy: a.double_jeopardy, knowledgeCompounding: a.knowledge_compounding, weightedAnalysis: a.weighted_analysis, perceptionVsPerspective: a.perception_vs_perspective, knowledgeTotal: a.knowledge_total,
    timeMultiplier: a.time_multiplier, rawScore: a.raw_score, masterScore: a.master_score, scoreRange: a.score_range, weakestPillar: a.weakest_pillar, prescription: a.prescription,
    overlayAnswers: a.overlay_answers, overlayTotal: a.overlay_total,
    depth: a.depth || 'extensive', focusPillar: a.focus_pillar || null,
    // Extract cross-pillar impact summary for admin visibility
    crossPillarImpact: (() => { try { const rx = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {}); return rx.crossPillarImpact || null; } catch (e) { return null; } })(),
    // Pass through any join fields
    ...(a.first_name ? { firstName: a.first_name, lastName: a.last_name, email: a.email } : {}),
  };
}
