// Seed enterprise data: overlay questions, training paths, default tiers
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // ==========================================
    // CHURCH OVERLAY QUESTIONS
    // ==========================================
    const churchQuestions = [
      {
        id: 'church-serving-1', pillar: 'influence', sub_category: 'Serving Behavior',
        field_name: 'servingFrequency', question: 'How often do you actively serve in a ministry, volunteer role, or church function?',
        description: 'Measures engagement in church service',
        options: [
          { value: 1, label: 'Rarely or never' },
          { value: 2, label: 'A few times a year' },
          { value: 3, label: 'Monthly' },
          { value: 4, label: 'Weekly' },
          { value: 5, label: 'Multiple times per week — serving is a lifestyle' }
        ]
      },
      {
        id: 'church-serving-2', pillar: 'influence', sub_category: 'Serving Behavior',
        field_name: 'servingAlignment', question: 'How well does your current serving role align with your natural gifts and strengths?',
        description: 'Measures gift alignment in service',
        options: [
          { value: 1, label: 'I don\'t serve anywhere currently' },
          { value: 2, label: 'I serve but it feels forced or draining' },
          { value: 3, label: 'It\'s okay but not my sweet spot' },
          { value: 4, label: 'It aligns well with who I am' },
          { value: 5, label: 'I\'m operating in my zone of genius when I serve' }
        ]
      },
      {
        id: 'church-giving-1', pillar: 'numbers', sub_category: 'Giving Behavior',
        field_name: 'givingConsistency', question: 'How consistent is your financial giving to your church or faith community?',
        description: 'Measures giving regularity',
        options: [
          { value: 1, label: 'I don\'t currently give financially' },
          { value: 2, label: 'Occasionally when I can' },
          { value: 3, label: 'I give but it\'s inconsistent' },
          { value: 4, label: 'I tithe regularly' },
          { value: 5, label: 'I tithe and give beyond — generosity is a priority' }
        ]
      },
      {
        id: 'church-giving-2', pillar: 'numbers', sub_category: 'Giving Behavior',
        field_name: 'givingIntentionality', question: 'How intentional are you about using your money as a tool for impact beyond yourself?',
        description: 'Measures generosity mindset',
        options: [
          { value: 1, label: 'I mostly think about covering my own needs' },
          { value: 2, label: 'I want to give more but finances are tight' },
          { value: 3, label: 'I give some but haven\'t built a giving strategy' },
          { value: 4, label: 'I have a plan for giving and follow it' },
          { value: 5, label: 'Giving is integrated into my financial architecture' }
        ]
      },
      {
        id: 'church-community-1', pillar: 'people', sub_category: 'Community Engagement',
        field_name: 'communityConnection', question: 'How connected are you to a small group, life group, or close faith community?',
        description: 'Measures depth of church community bonds',
        options: [
          { value: 1, label: 'I attend but don\'t really know anyone deeply' },
          { value: 2, label: 'I have a few surface-level connections' },
          { value: 3, label: 'I\'m in a group but not fully engaged' },
          { value: 4, label: 'I\'m actively connected and growing with others' },
          { value: 5, label: 'My community is a core part of my growth and accountability' }
        ]
      },
      {
        id: 'church-community-2', pillar: 'people', sub_category: 'Community Engagement',
        field_name: 'communityAccountability', question: 'Do you have people in your faith community who hold you accountable?',
        description: 'Measures accountability depth',
        options: [
          { value: 1, label: 'No — I keep my struggles to myself' },
          { value: 2, label: 'Maybe one person, but we don\'t go deep' },
          { value: 3, label: 'I have people but we rarely get vulnerable' },
          { value: 4, label: 'Yes — I have trusted people who challenge me' },
          { value: 5, label: 'I have a strong accountability circle that drives my growth' }
        ]
      },
      {
        id: 'church-leadership-1', pillar: 'influence', sub_category: 'Leadership Pipeline',
        field_name: 'leadershipReadiness', question: 'Are you being developed or positioned for leadership in your church?',
        description: 'Measures leadership pipeline readiness',
        options: [
          { value: 1, label: 'No — I\'m not involved in leadership at all' },
          { value: 2, label: 'I\'ve thought about it but haven\'t taken steps' },
          { value: 3, label: 'I\'m starting to serve in minor leadership roles' },
          { value: 4, label: 'I\'m actively being developed as a leader' },
          { value: 5, label: 'I lead and develop other leaders regularly' }
        ]
      },
      {
        id: 'church-purpose-1', pillar: 'knowledge', sub_category: 'Life Purpose Alignment',
        field_name: 'lifePurposeClarity', question: 'How clear are you on your God-given purpose and calling?',
        description: 'Measures life purpose alignment',
        options: [
          { value: 1, label: 'I have no idea what my purpose is' },
          { value: 2, label: 'I have a vague sense but nothing concrete' },
          { value: 3, label: 'I\'m exploring and getting clearer' },
          { value: 4, label: 'I have a clear sense of purpose and direction' },
          { value: 5, label: 'I live my purpose daily — it drives my decisions' }
        ]
      },
      {
        id: 'church-stewardship-1', pillar: 'numbers', sub_category: 'Stewardship',
        field_name: 'stewardshipMindset', question: 'Do you view your time, talents, and money as things you own or things you steward?',
        description: 'Measures stewardship vs ownership mindset',
        options: [
          { value: 1, label: 'I mostly think of everything as mine' },
          { value: 2, label: 'I believe in stewardship but don\'t live it consistently' },
          { value: 3, label: 'I\'m growing in seeing myself as a steward' },
          { value: 4, label: 'Stewardship shapes most of my decisions' },
          { value: 5, label: 'Everything I have is held with open hands — stewardship is my operating system' }
        ]
      },
      {
        id: 'church-purpose-2', pillar: 'time', sub_category: 'Life Purpose Alignment',
        field_name: 'purposeTimeAlignment', question: 'How much of your weekly time is spent on activities aligned with your calling?',
        description: 'Measures time-purpose alignment',
        options: [
          { value: 1, label: 'Almost none — I\'m just surviving' },
          { value: 2, label: 'Less than 10% — mostly obligations' },
          { value: 3, label: 'Some — I have moments of alignment' },
          { value: 4, label: 'Most of my time is purpose-directed' },
          { value: 5, label: 'My calendar and calling are deeply aligned' }
        ]
      }
    ];

    // ==========================================
    // CORPORATE OVERLAY QUESTIONS
    // ==========================================
    const corporateQuestions = [
      {
        id: 'corp-role-1', pillar: 'time', sub_category: 'Role Alignment',
        field_name: 'roleAlignment', question: 'How well does your current role align with your strengths and career goals?',
        description: 'Measures role-strength alignment',
        options: [
          { value: 1, label: 'It doesn\'t — I\'m just collecting a paycheck' },
          { value: 2, label: 'Somewhat — parts of the role fit, but most doesn\'t' },
          { value: 3, label: 'It\'s okay — a reasonable fit but not great' },
          { value: 4, label: 'Good fit — my strengths are used regularly' },
          { value: 5, label: 'Excellent — I\'m doing what I was built to do' }
        ]
      },
      {
        id: 'corp-role-2', pillar: 'influence', sub_category: 'Role Alignment',
        field_name: 'careerTrajectory', question: 'Do you see a clear path for advancement or growth in your current organization?',
        description: 'Measures career path clarity',
        options: [
          { value: 1, label: 'No — I feel stuck with no path forward' },
          { value: 2, label: 'Unclear — I don\'t know what advancement looks like here' },
          { value: 3, label: 'Somewhat — there are options but they\'re not well defined' },
          { value: 4, label: 'Yes — I can see the next step and I\'m working toward it' },
          { value: 5, label: 'Absolutely — I have a development plan and sponsors supporting me' }
        ]
      },
      {
        id: 'corp-performance-1', pillar: 'knowledge', sub_category: 'Performance',
        field_name: 'performanceClarity', question: 'How clearly do you understand what "excellent performance" looks like in your current role?',
        description: 'Measures performance expectation clarity',
        options: [
          { value: 1, label: 'I have no idea what success looks like here' },
          { value: 2, label: 'Vague — general expectations but nothing specific' },
          { value: 3, label: 'Somewhat clear — I know the basics' },
          { value: 4, label: 'Clear — I know exactly what metrics matter' },
          { value: 5, label: 'Crystal clear — I exceed expectations consistently and know why' }
        ]
      },
      {
        id: 'corp-performance-2', pillar: 'influence', sub_category: 'Performance',
        field_name: 'feedbackLoop', question: 'How often do you receive meaningful feedback on your work?',
        description: 'Measures feedback frequency and quality',
        options: [
          { value: 1, label: 'Never — I operate in the dark' },
          { value: 2, label: 'Rarely — annual review at best' },
          { value: 3, label: 'Occasionally — a few times a year' },
          { value: 4, label: 'Regularly — monthly or biweekly' },
          { value: 5, label: 'Continuously — I have real-time feedback loops' }
        ]
      },
      {
        id: 'corp-financial-1', pillar: 'numbers', sub_category: 'Financial Stress',
        field_name: 'financialStressLevel', question: 'How much does financial stress affect your work performance and focus?',
        description: 'Measures financial stress impact on work',
        options: [
          { value: 1, label: 'Severely — I can barely focus at work because of money worries' },
          { value: 2, label: 'Significantly — it\'s a constant background distraction' },
          { value: 3, label: 'Moderately — some weeks are harder than others' },
          { value: 4, label: 'Minimally — finances are manageable' },
          { value: 5, label: 'Not at all — my financial house is in order' }
        ]
      },
      {
        id: 'corp-financial-2', pillar: 'numbers', sub_category: 'Financial Stress',
        field_name: 'benefitsUtilization', question: 'How well do you understand and utilize your employer\'s financial benefits (401k match, HSA, stock options, etc.)?',
        description: 'Measures benefits knowledge and usage',
        options: [
          { value: 1, label: 'I don\'t use any of them' },
          { value: 2, label: 'I use some but don\'t really understand them' },
          { value: 3, label: 'I use the basics but leave value on the table' },
          { value: 4, label: 'I maximize most benefits available to me' },
          { value: 5, label: 'I fully optimize every benefit — I know exactly what I\'m leaving on the table (nothing)' }
        ]
      },
      {
        id: 'corp-career-1', pillar: 'knowledge', sub_category: 'Career Alignment',
        field_name: 'skillGrowth', question: 'How actively are you developing skills that increase your market value?',
        description: 'Measures intentional skill development',
        options: [
          { value: 1, label: 'Not at all — I\'m coasting on what I already know' },
          { value: 2, label: 'Minimally — I learn only when forced to' },
          { value: 3, label: 'Somewhat — I take occasional courses or training' },
          { value: 4, label: 'Actively — I have a learning plan I follow' },
          { value: 5, label: 'Aggressively — I invest weekly in skills that compound my value' }
        ]
      },
      {
        id: 'corp-career-2', pillar: 'people', sub_category: 'Career Alignment',
        field_name: 'professionalNetwork', question: 'How strong is your professional network outside your current employer?',
        description: 'Measures external career network',
        options: [
          { value: 1, label: 'Nonexistent — I have no network outside my company' },
          { value: 2, label: 'Weak — a few LinkedIn connections but no real relationships' },
          { value: 3, label: 'Moderate — I know people but don\'t actively nurture relationships' },
          { value: 4, label: 'Strong — I have relationships across my industry' },
          { value: 5, label: 'Exceptional — my network is a career asset that opens doors regularly' }
        ]
      },
      {
        id: 'corp-development-1', pillar: 'time', sub_category: 'Professional Development',
        field_name: 'developmentTime', question: 'How many hours per week do you invest in professional development outside of work?',
        description: 'Measures professional development investment',
        options: [
          { value: 1, label: 'Zero — I have no time or energy after work' },
          { value: 2, label: '1-2 hours — occasionally' },
          { value: 3, label: '3-5 hours — fairly consistent' },
          { value: 4, label: '5-8 hours — it\'s a priority' },
          { value: 5, label: '8+ hours — I treat my career like a business I\'m building' }
        ]
      },
      {
        id: 'corp-development-2', pillar: 'people', sub_category: 'Professional Development',
        field_name: 'mentorAccess', question: 'Do you have a mentor or sponsor who actively advocates for your career growth?',
        description: 'Measures mentorship and sponsorship',
        options: [
          { value: 1, label: 'No — I\'m figuring it out alone' },
          { value: 2, label: 'Not really — I have contacts but no real mentor' },
          { value: 3, label: 'Informal — someone I can ask questions occasionally' },
          { value: 4, label: 'Yes — I have a mentor who gives me regular guidance' },
          { value: 5, label: 'Yes — I have both a mentor and a sponsor who open doors for me' }
        ]
      }
    ];

    // Insert all overlay questions
    const allOverlayQuestions = [
      ...churchQuestions.map((q, i) => ({ ...q, is_overlay: true, overlay_type: 'church', sort_order: 100 + i })),
      ...corporateQuestions.map((q, i) => ({ ...q, is_overlay: true, overlay_type: 'corporate', sort_order: 200 + i })),
    ];

    let questionResults = { added: 0, failed: 0 };
    for (const q of allOverlayQuestions) {
      try {
        const opts = JSON.stringify(q.options);
        await sql`INSERT INTO question_bank (id, pillar, sub_category, field_name, question, description, options, is_overlay, overlay_type, sort_order)
          VALUES (${q.id}, ${q.pillar}, ${q.sub_category}, ${q.field_name}, ${q.question}, ${q.description}, ${opts}::jsonb, ${q.is_overlay}, ${q.overlay_type}, ${q.sort_order})
          ON CONFLICT (id) DO UPDATE SET
            question = EXCLUDED.question,
            description = EXCLUDED.description,
            options = EXCLUDED.options,
            is_overlay = EXCLUDED.is_overlay,
            overlay_type = EXCLUDED.overlay_type`;
        questionResults.added++;
      } catch (e) {
        questionResults.failed++;
      }
    }

    // ==========================================
    // DEFAULT TRAINING PATHS
    // ==========================================
    const trainingPaths = [
      // Corporate paths
      { name: 'Financial Literacy Fundamentals', description: 'Budgeting basics, benefits optimization, emergency fund building, and retirement planning fundamentals.', type: 'corporate', category: 'financial-literacy', pillar: 'numbers', score_min: 0, score_max: 25,
        content: [
          { title: 'Build Your Emergency Fund', type: 'module', duration: '2 weeks', description: 'Establish a 3-month emergency fund baseline' },
          { title: 'Benefits Optimization Workshop', type: 'workshop', duration: '1 hour', description: 'Maximize your employer benefits — 401k match, HSA, stock options' },
          { title: 'Budget Architecture', type: 'module', duration: '3 weeks', description: 'Build a zero-based budget that accounts for every dollar' },
          { title: 'Retirement Planning 101', type: 'module', duration: '2 weeks', description: 'Understand compound growth and retirement account types' }
        ]},
      { name: 'Debt Reduction Strategy', description: 'Debt snowball/avalanche methods, credit hygiene, predatory lending awareness, and debt-free planning.', type: 'corporate', category: 'debt-reduction', pillar: 'numbers', score_min: 0, score_max: 30,
        content: [
          { title: 'Debt Inventory & Truth Audit', type: 'module', duration: '1 week', description: 'Document all debts with interest rates, minimums, and total balances' },
          { title: 'Snowball vs Avalanche Calculator', type: 'tool', duration: 'Ongoing', description: 'Choose your debt payoff strategy based on math and motivation' },
          { title: 'Credit Score Rehabilitation', type: 'module', duration: '4 weeks', description: 'Practical steps to improve credit score by 50-100 points' },
          { title: 'Predatory Lending Awareness', type: 'workshop', duration: '1 hour', description: 'Identify and avoid debt traps that keep you stuck' }
        ]},
      { name: 'Business Acumen Development', description: 'Reading financial statements, understanding company economics, value creation metrics, and strategic thinking.', type: 'corporate', category: 'business-acumen', pillar: 'knowledge', score_min: 0, score_max: 30,
        content: [
          { title: 'Reading Financial Statements', type: 'module', duration: '2 weeks', description: 'Understand P&L, balance sheet, and cash flow — even if you\'re not in finance' },
          { title: 'How Your Company Makes Money', type: 'workshop', duration: '1 hour', description: 'Map the value chain from customer to profit' },
          { title: 'Strategic Thinking Framework', type: 'module', duration: '3 weeks', description: 'Think like a business owner, not just an employee' },
          { title: 'Value Creation Metrics', type: 'tool', duration: 'Ongoing', description: 'Identify and track the metrics that make you indispensable' }
        ]},
      // Church paths
      { name: 'Stewardship & Generosity', description: 'Biblical stewardship principles, practical giving strategies, time-talent-treasure alignment, and generosity as a lifestyle.', type: 'church', category: 'stewardship', pillar: 'numbers', score_min: 0, score_max: 30,
        content: [
          { title: 'The Stewardship Mindset', type: 'module', duration: '2 weeks', description: 'Shift from ownership to stewardship in how you view resources' },
          { title: 'Practical Tithing Workshop', type: 'workshop', duration: '1 hour', description: 'Build a giving plan that starts where you are' },
          { title: 'Beyond the Tithe', type: 'module', duration: '3 weeks', description: 'Strategic generosity that multiplies impact' },
          { title: 'Time-Talent-Treasure Audit', type: 'tool', duration: '1 week', description: 'Align all three resources with your calling' }
        ]},
      { name: 'Purpose & Calling Discovery', description: 'Gift identification, calling clarity, value placement in the body, and purpose-driven life design using PINK language.', type: 'church', category: 'purpose-calling', pillar: 'knowledge', score_min: 0, score_max: 30,
        content: [
          { title: 'Gift Identification Workshop', type: 'workshop', duration: '2 hours', description: 'Discover your top gifts and how they serve others' },
          { title: 'Calling Clarity Framework', type: 'module', duration: '3 weeks', description: 'Move from "I don\'t know my purpose" to a clear direction' },
          { title: 'Value Placement Mapping', type: 'tool', duration: '1 week', description: 'Find where your gifts create the most impact in your community' },
          { title: 'Purpose-Driven Life Design', type: 'module', duration: '4 weeks', description: 'Design your daily rhythms around your calling' }
        ]},
      { name: 'Life Purpose Alignment', description: 'Whole-life integration of faith, work, relationships, and purpose. Building a life that reflects your values in every dimension.', type: 'church', category: 'life-purpose', pillar: 'time', score_min: 0, score_max: 30,
        content: [
          { title: 'The Integrated Life Framework', type: 'module', duration: '2 weeks', description: 'Stop compartmentalizing faith, work, and life' },
          { title: 'Calendar-Calling Alignment', type: 'tool', duration: '1 week', description: 'Audit your calendar against your purpose' },
          { title: 'Relationship Stewardship', type: 'module', duration: '3 weeks', description: 'Invest in the relationships that multiply your calling' },
          { title: 'Legacy Planning', type: 'module', duration: '2 weeks', description: 'Build with the end in mind — what will outlast you?' }
        ]},
      // Universal paths
      { name: 'Time Mastery System', description: 'Value-per-hour calculation, Q2 priority scheduling, Five-Hour Leak elimination, and time reallocation planning.', type: 'universal', category: 'time-mastery', pillar: 'time', score_min: 0, score_max: 25,
        content: [
          { title: 'The Five-Hour Leak Audit', type: 'tool', duration: '3 days', description: 'Find and eliminate the 5+ hours you lose every week' },
          { title: 'Value Per Hour Calculator', type: 'tool', duration: '1 day', description: 'Calculate what your time is actually worth' },
          { title: 'Q2 Priority System', type: 'module', duration: '2 weeks', description: 'Schedule important-not-urgent activities first' },
          { title: 'Time Reallocation Planner', type: 'tool', duration: 'Ongoing', description: 'Continuously optimize your time portfolio' }
        ]},
      { name: 'Relationship Value Optimization', description: 'People audit, relationship ROI mapping, alliance building, boundary setting, and network deepening.', type: 'universal', category: 'people-optimization', pillar: 'people', score_min: 0, score_max: 25,
        content: [
          { title: 'The People Audit', type: 'tool', duration: '1 week', description: 'Map your top 20 relationships by type: Givers, Receivers, Exchangers, Takers' },
          { title: 'Relationship ROI Matrix', type: 'tool', duration: '1 day', description: 'Identify which relationships multiply your value' },
          { title: 'Alliance Building Framework', type: 'module', duration: '3 weeks', description: 'Build strategic alliances that create compound returns' },
          { title: 'Boundary Architecture', type: 'module', duration: '2 weeks', description: 'Set boundaries that protect your highest-value relationships' }
        ]},
    ];

    let pathResults = { added: 0, failed: 0 };
    for (const tp of trainingPaths) {
      try {
        await sql`INSERT INTO training_paths (name, description, type, category, pillar, score_min, score_max, content)
          VALUES (${tp.name}, ${tp.description}, ${tp.type}, ${tp.category}, ${tp.pillar}, ${tp.score_min}, ${tp.score_max}, ${JSON.stringify(tp.content)}::jsonb)
          ON CONFLICT DO NOTHING`;
        pathResults.added++;
      } catch (e) {
        pathResults.failed++;
      }
    }

    res.json({
      success: true,
      overlay_questions: questionResults,
      training_paths: pathResults,
    });
  } catch (err) {
    console.error('Seed enterprise error:', err);
    res.status(500).json({ error: err.message });
  }
};
