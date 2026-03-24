const { neon } = require('@neondatabase/serverless');

function getScoreRange(score) {
  if (score <= 50) return "Crisis";
  if (score <= 100) return "Survival";
  if (score <= 150) return "Growth";
  if (score <= 200) return "Momentum";
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
  return { weakestPillar: weakest.name, weakestScore: weakest.score, strongestPillar: strongest.name, strongestScore: strongest.score, weakestSubCategory: weakestSubs[0][0], weakestSubScore: weakestSubs[0][1], ...rx, pillars: pillars.map(p => ({ name: p.name, score: p.score })) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const url = req.url.replace(/^\/api/, '');

  try {
    // GET /api/questions?email=xxx&mode=individual|relationship|leadership
    if (req.method === 'GET' && url.startsWith('/questions')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      const mode = params.get('mode') || 'individual';
      const corePillars = ['time', 'people', 'influence', 'numbers', 'knowledge'];

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

      // Select 10 questions per pillar
      // Strategy: prioritize unanswered questions, then randomly reincorporate
      // some previously answered ones (oldest-answered first, with shuffle).
      // This ensures returning users mostly see new content but also get a
      // few familiar questions cycled back in for re-assessment.
      const QUESTIONS_PER_PILLAR = 10;
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

      // Handle overlay questions for relationship/leadership modes
      if (mode === 'relationship' || mode === 'leadership') {
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

      const assessments = await sql`SELECT id, completed_at, mode, master_score, score_range, weakest_pillar FROM assessments WHERE contact_id = ${contact.id} ORDER BY completed_at DESC`;

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
        })),
        isNewUser: false,
      });
    }

    // POST /api/assessment
    if (req.method === 'POST' && url === '/assessment') {
      const b = req.body || {};

      // Upsert contact
      let contactRows = await sql`SELECT * FROM contacts WHERE email = ${b.email || ''} LIMIT 1`;
      let contact;
      if (contactRows.length > 0) {
        contact = contactRows[0];
      } else {
        const rows = await sql`INSERT INTO contacts (first_name, last_name, email, phone, created_at) VALUES (${b.firstName || ''}, ${b.lastName || ''}, ${b.email || ''}, ${b.phone || null}, ${new Date().toISOString()}) RETURNING *`;
        contact = rows[0];
      }

      // Dynamic scoring: if questionIds provided, compute pillar totals from question_bank
      let tt, pt, it, nt, kt;
      const questionIds = b.questionIds || [];

      if (questionIds.length > 0) {
        // Dynamic scoring: look up pillar for each question and sum by pillar
        let questionMeta = [];
        try {
          questionMeta = await sql`SELECT id, pillar, field_name FROM question_bank WHERE id = ANY(${questionIds})`;
        } catch (e) { /* table may not exist, fall through to legacy */ }

        if (questionMeta.length > 0) {
          const pillarSums = { time: 0, people: 0, influence: 0, numbers: 0, knowledge: 0 };
          for (const qm of questionMeta) {
            const val = b[qm.field_name] || 0;
            if (pillarSums.hasOwnProperty(qm.pillar)) {
              pillarSums[qm.pillar] += val;
            }
          }
          tt = pillarSums.time;
          pt = pillarSums.people;
          it = pillarSums.influence;
          nt = pillarSums.numbers;
          kt = pillarSums.knowledge;
        }
      }

      // Legacy fallback: hardcoded field sums (backward compatible)
      if (tt === undefined) {
        tt = (b.timeAwareness||0)+(b.timeAllocation||0)+(b.timeProtection||0)+(b.timeLeverage||0)+(b.fiveHourLeak||0)+(b.valuePerHour||0)+(b.timeInvestment||0)+(b.downtimeQuality||0)+(b.foresight||0)+(b.timeReallocation||0);
        pt = (b.trustInvestment||0)+(b.boundaryQuality||0)+(b.networkDepth||0)+(b.relationalRoi||0)+(b.peopleAudit||0)+(b.allianceBuilding||0)+(b.loveBankDeposits||0)+(b.communicationClarity||0)+(b.restraintPractice||0)+(b.valueReplacement||0);
        it = (b.leadershipLevel||0)+(b.integrityAlignment||0)+(b.professionalCredibility||0)+(b.empatheticListening||0)+(b.gravitationalCenter||0)+(b.microHonesties||0)+(b.wordManagement||0)+(b.personalResponsibility||0)+(b.adaptiveInfluence||0)+(b.influenceMultiplier||0);
        nt = (b.financialAwareness||0)+(b.goalSpecificity||0)+(b.investmentLogic||0)+(b.measurementHabit||0)+(b.costVsValue||0)+(b.numberOneClarity||0)+(b.smallImprovements||0)+(b.negativeMath||0)+(b.incomeMultiplier||0)+(b.negotiationSkill||0);
        kt = (b.learningHours||0)+(b.applicationRate||0)+(b.biasAwareness||0)+(b.highestBestUse||0)+(b.supplyAndDemand||0)+(b.substitutionRisk||0)+(b.doubleJeopardy||0)+(b.knowledgeCompounding||0)+(b.weightedAnalysis||0)+(b.perceptionVsPerspective||0);
      }

      const rawScore = tt + pt + it + nt + kt;
      const tm = Math.max(0.1, Math.min(2.0, b.timeMultiplier || 1.0));
      const masterScore = Math.round(rawScore * tm * 10) / 10;
      const scoreRange = getScoreRange(masterScore);
      const mode = b.mode || 'individual';

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

      const d = aData;
      const rows = await sql`INSERT INTO assessments (contact_id, completed_at, mode, team_id, is_team_creator, time_awareness, time_allocation, time_protection, time_leverage, five_hour_leak, value_per_hour, time_investment, downtime_quality, foresight, time_reallocation, time_total, trust_investment, boundary_quality, network_depth, relational_roi, people_audit, alliance_building, love_bank_deposits, communication_clarity, restraint_practice, value_replacement, people_total, leadership_level, integrity_alignment, professional_credibility, empathetic_listening, gravitational_center, micro_honesties, word_management, personal_responsibility, adaptive_influence, influence_multiplier, influence_total, financial_awareness, goal_specificity, investment_logic, measurement_habit, cost_vs_value, number_one_clarity, small_improvements, negative_math, income_multiplier, negotiation_skill, numbers_total, learning_hours, application_rate, bias_awareness, highest_best_use, supply_and_demand, substitution_risk, double_jeopardy, knowledge_compounding, weighted_analysis, perception_vs_perspective, knowledge_total, time_multiplier, raw_score, master_score, score_range, weakest_pillar, prescription, overlay_answers, overlay_total) VALUES (${d.contact_id}, ${d.completed_at}, ${d.mode}, ${d.team_id}, ${d.is_team_creator}, ${d.time_awareness}, ${d.time_allocation}, ${d.time_protection}, ${d.time_leverage}, ${d.five_hour_leak}, ${d.value_per_hour}, ${d.time_investment}, ${d.downtime_quality}, ${d.foresight}, ${d.time_reallocation}, ${d.time_total}, ${d.trust_investment}, ${d.boundary_quality}, ${d.network_depth}, ${d.relational_roi}, ${d.people_audit}, ${d.alliance_building}, ${d.love_bank_deposits}, ${d.communication_clarity}, ${d.restraint_practice}, ${d.value_replacement}, ${d.people_total}, ${d.leadership_level}, ${d.integrity_alignment}, ${d.professional_credibility}, ${d.empathetic_listening}, ${d.gravitational_center}, ${d.micro_honesties}, ${d.word_management}, ${d.personal_responsibility}, ${d.adaptive_influence}, ${d.influence_multiplier}, ${d.influence_total}, ${d.financial_awareness}, ${d.goal_specificity}, ${d.investment_logic}, ${d.measurement_habit}, ${d.cost_vs_value}, ${d.number_one_clarity}, ${d.small_improvements}, ${d.negative_math}, ${d.income_multiplier}, ${d.negotiation_skill}, ${d.numbers_total}, ${d.learning_hours}, ${d.application_rate}, ${d.bias_awareness}, ${d.highest_best_use}, ${d.supply_and_demand}, ${d.substitution_risk}, ${d.double_jeopardy}, ${d.knowledge_compounding}, ${d.weighted_analysis}, ${d.perception_vs_perspective}, ${d.knowledge_total}, ${d.time_multiplier}, ${d.raw_score}, ${d.master_score}, ${d.score_range}, ${d.weakest_pillar}, ${d.prescription}, ${d.overlay_answers}, ${d.overlay_total}) RETURNING *`;

      const assessment = rows[0];

      // Upsert answer_history for each question answered in this session
      if (questionIds.length > 0) {
        try {
          const questionMeta = await sql`SELECT id, field_name FROM question_bank WHERE id = ANY(${questionIds})`;
          for (const qm of questionMeta) {
            const val = b[qm.field_name];
            if (val && typeof val === 'number') {
              await sql`INSERT INTO answer_history (contact_id, question_id, answer_value, assessment_id, answered_at)
                VALUES (${contact.id}, ${qm.id}, ${val}, ${assessment.id}, NOW())
                ON CONFLICT (contact_id, question_id)
                DO UPDATE SET answer_value = EXCLUDED.answer_value, assessment_id = EXCLUDED.assessment_id, answered_at = NOW()`;
            }
          }
        } catch (e) {
          console.error('answer_history upsert error (non-fatal):', e.message);
        }
      }

      // Map snake_case back to camelCase for frontend compatibility
      const mapped = mapAssessment(assessment);
      return res.json({ assessment: mapped, prescription, contact: { id: contact.id, firstName: contact.first_name, lastName: contact.last_name } });
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
      let csv = "First Name,Last Name,Email,Phone,Date,Time,People,Influence,Numbers,Knowledge,Raw,Multiplier,Master Score,Range,Weakest\n";
      for (const r of all) {
        csv += `"${r.first_name}","${r.last_name}","${r.email}","${r.phone||''}","${r.completed_at}",${r.time_total},${r.people_total},${r.influence_total},${r.numbers_total},${r.knowledge_total},${r.raw_score},${r.time_multiplier},${r.master_score},"${r.score_range}","${r.weakest_pillar}"\n`;
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
        Survival: { title: 'Build Your Foundation', product: 'Book + VictoryPath Membership', price: '$29 + $47/mo', description: 'The tools and community to move from Survival to Growth.' },
        Growth: { title: 'Accelerate Your Growth', product: 'VictoryPath Membership', price: '$47/mo', description: 'Structured tools, community accountability, and monthly progress tracking.' },
        Momentum: { title: 'Break Through', product: 'Value Builder or 1:1 Coaching', price: '$79/mo or $300/hr (20% off first session)', description: 'Direct coaching to break through the ceiling.' },
        Mastery: { title: 'Go Elite', product: 'Victory VIP', price: '$397/mo', description: '50% off coaching, complimentary monthly session, and direct author access.' },
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

      const firstName = a.first_name || 'there';
      const masterScore = a.master_score;
      const scoreRange = a.score_range;
      const weakestPillar = a.weakest_pillar;
      const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});

      // Product recommendation text by range
      const recTexts = {
        Crisis: "YOUR NEXT STEP: You need the full system. Start with The Value Engine book — the diagnostic that shows you exactly where your life is undervalued. $29 at valuetovictory.com",
        Survival: "YOUR NEXT STEP: You have the awareness. Now build the foundation. The Value Engine book ($29) plus VictoryPath membership ($47/mo) gives you the tools and community to move from Survival to Growth. valuetovictory.com",
        Growth: "YOUR NEXT STEP: You're past the foundation. Accelerate with VictoryPath membership ($47/mo) — structured tools, community accountability, and monthly progress tracking. valuetovictory.com",
        Momentum: "YOUR NEXT STEP: Your score says you're ready for direct coaching. Value Builder membership ($79/mo) or 1:1 coaching ($300/hr, 20% off your first session) will break through the ceiling. valuetovictory.com",
        Mastery: "YOUR NEXT STEP: You're operating at the highest level. Victory VIP ($397/mo) gives you 50% off coaching, a complimentary monthly session, and direct author access. valuetovictory.com",
      };
      const productRec = recTexts[scoreRange] || recTexts.Growth;

      // FitCarna section
      const fitnessQuestionIds = ['time-21','time-22','people-21','people-22','influence-21','influence-22','numbers-21','numbers-22','knowledge-21','knowledge-22'];
      let fitcarnaSection = '';
      try {
        const fitnessAnswers = await sql`SELECT question_id, answer_value FROM answer_history WHERE contact_id = ${a.contact_id} AND question_id = ANY(${fitnessQuestionIds})`;
        if (fitnessAnswers.some(fa => fa.answer_value <= 2)) {
          fitcarnaSection = "\nYOUR BODY IS CAPPING YOUR SCORE: Your fitness answers reveal a gap that's limiting every other pillar. We partner with one coach who builds programs for people in your exact position — no gimmicks, just structured accountability and results. See what Cameron builds: valuetovictory.com/fitcarna/\n";
        }
      } catch (e) { /* table may not exist */ }

      const emailBody = `${firstName},

Your Value Engine Assessment is complete.

MASTER VALUE SCORE: ${masterScore} (${scoreRange})

Pillar Breakdown:
  Time:      ${a.time_total}/50
  People:    ${a.people_total}/50
  Influence: ${a.influence_total}/50
  Numbers:   ${a.numbers_total}/50
  Knowledge: ${a.knowledge_total}/50

Your weakest pillar is ${weakestPillar}. ${prescription.diagnosis || ''}

View your full diagnostic report:
https://assessment.valuetovictory.com/report/${assessmentId}

${productRec}
${fitcarnaSection}
Your report includes:
- Detailed sub-category breakdown across all 50 dimensions
- Where you rank against other Value Engine users
- Personalized prescription with specific tools to run
- Your recommended next step

Don't guess. Run the system.

— The Value Engine
   ValueToVictory.com`;

      const subject = `Your Value Engine Score: ${masterScore} (${scoreRange}) — Personal Report Ready`;

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
          to: a.email,
          subject,
          text: emailBody,
        });
        return res.json({ sent: true, to: a.email, reportUrl: `https://assessment.valuetovictory.com/report/${assessmentId}` });
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
    // Pass through any join fields
    ...(a.first_name ? { firstName: a.first_name, lastName: a.last_name, email: a.email } : {}),
  };
}
