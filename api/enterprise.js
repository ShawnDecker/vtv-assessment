// Enterprise API endpoints for multi-tenant, dashboards, training routing, CSV import
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Simple password hashing (no bcrypt in serverless)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + (process.env.HASH_SALT || 'vtv-enterprise-salt')).digest('hex');
}

function generateCode(length = 8) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// Simple JWT-like token (base64 encoded JSON with signature)
function createToken(payload) {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'vtv-enterprise-secret').update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const [dataB64, sig] = token.split('.');
  if (!dataB64 || !sig) return null;
  const data = Buffer.from(dataB64, 'base64').toString();
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'vtv-enterprise-secret').update(data).digest('hex');
  if (sig !== expectedSig) return null;
  const payload = JSON.parse(data);
  if (payload.exp < Date.now()) return null;
  return payload;
}

// Training routing engine
function computeTrainingRecommendations(assessment, tenantType) {
  const pillarScores = {
    time: assessment.time_total,
    people: assessment.people_total,
    influence: assessment.influence_total,
    numbers: assessment.numbers_total,
    knowledge: assessment.knowledge_total,
  };
  const recommendations = [];

  // Universal recommendations based on weakest pillars
  const sorted = Object.entries(pillarScores).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0];
  const secondWeakest = sorted[1];

  recommendations.push({
    priority: 'primary',
    pillar: weakest[0],
    score: weakest[1],
    reason: `Your ${weakest[0]} score (${weakest[1]}/50) is your biggest constraint.`,
  });

  if (secondWeakest[1] < 25) {
    recommendations.push({
      priority: 'secondary',
      pillar: secondWeakest[0],
      score: secondWeakest[1],
      reason: `Your ${secondWeakest[0]} score (${secondWeakest[1]}/50) is also below the growth threshold.`,
    });
  }

  // Tenant-type specific recommendations
  if (tenantType === 'corporate') {
    if (pillarScores.numbers < 25) {
      recommendations.push({ priority: 'corporate', category: 'financial-literacy', reason: 'Financial literacy fundamentals needed based on Numbers score.' });
    }
    if (pillarScores.numbers < 30) {
      recommendations.push({ priority: 'corporate', category: 'debt-reduction', reason: 'Debt reduction strategy recommended based on Numbers score.' });
    }
    if (pillarScores.knowledge < 30) {
      recommendations.push({ priority: 'corporate', category: 'business-acumen', reason: 'Business acumen development recommended based on Knowledge score.' });
    }
  }

  if (tenantType === 'church') {
    if (pillarScores.numbers < 30) {
      recommendations.push({ priority: 'church', category: 'stewardship', reason: 'Stewardship and generosity training recommended based on Numbers score.' });
    }
    if (pillarScores.knowledge < 30) {
      recommendations.push({ priority: 'church', category: 'purpose-calling', reason: 'Purpose and calling discovery recommended based on Knowledge score.' });
    }
    if (pillarScores.time < 30) {
      recommendations.push({ priority: 'church', category: 'life-purpose', reason: 'Life purpose alignment recommended based on Time score.' });
    }
  }

  return recommendations;
}

// Wealth architecture triggers
function computeWealthTriggers(assessment, overlayScores) {
  const triggers = [];
  const numbers = assessment.numbers_total;
  const masterScore = assessment.master_score;
  const financialAwareness = assessment.financial_awareness || 0;
  const investmentLogic = assessment.investment_logic || 0;

  // High income indicators + low financial literacy → priority coaching
  if (masterScore >= 100 && numbers < 25) {
    triggers.push({
      trigger_type: 'priority_coaching',
      trigger_reason: 'High overall value score but low financial literacy indicates income potential is being wasted.',
      pathway: 'financial_coaching',
      details: { masterScore, numbersScore: numbers, recommendation: 'Priority financial coaching — you have the capacity to earn but need systems to keep and grow it.' }
    });
  }

  // Low financial protection + assets → trust education
  if (investmentLogic >= 3 && financialAwareness < 3) {
    triggers.push({
      trigger_type: 'asset_protection',
      trigger_reason: 'Investment activity without proportional financial awareness suggests asset protection gaps.',
      pathway: 'trust_education',
      details: { recommendation: 'Land trust and irrevocable trust education — protect what you\'ve built before building more.' }
    });
  }

  // Stable enough for advanced strategies
  if (numbers >= 35 && masterScore >= 150) {
    triggers.push({
      trigger_type: 'advanced_wealth',
      trigger_reason: 'Strong financial foundation and high overall score indicate readiness for advanced wealth strategies.',
      pathway: 'insurance_as_asset',
      details: { recommendation: 'Insurance-as-asset strategies and policy loan education — your stable foundation is ready for advanced wealth architecture.' }
    });
  }

  // Corporate financial stress overlay
  if (overlayScores && overlayScores.financialStressLevel && overlayScores.financialStressLevel <= 2) {
    triggers.push({
      trigger_type: 'financial_stress_intervention',
      trigger_reason: 'Self-reported severe financial stress affecting work performance.',
      pathway: 'emergency_financial_coaching',
      details: { recommendation: 'Immediate financial coaching intervention — financial stress is actively degrading your performance and potential.' }
    });
  }

  return triggers;
}

// First Three Moves generator
function generateFirstThreeMoves(assessment, prescription) {
  const weakest = prescription.weakestPillar;
  const masterScore = assessment.master_score;
  const scoreRange = assessment.score_range;

  const moves = {
    Time: [
      { move: 'Run the 3-Day Time Audit', description: 'Track every hour for 72 hours. Find your Five-Hour Leak — the hidden hours you lose to low-value activities each week.', urgency: 'This Week', tool: 'Time Audit (Tool #2)' },
      { move: 'Calculate Your Value Per Hour', description: 'Divide your annual income by total hours worked. Then compare it to your potential rate. The gap is your opportunity.', urgency: 'Day 3', tool: 'Value Per Hour Calculator (Tool #5)' },
      { move: 'Eliminate 3 Q3/Q4 Activities', description: 'Using the Covey Matrix, identify 3 activities that are urgent-but-not-important or neither urgent nor important. Remove or delegate them.', urgency: 'Week 2', tool: 'Time Reallocation Planner (Tool #9)' },
    ],
    People: [
      { move: 'Run the People Audit', description: 'Map your top 15-20 relationships. Categorize each as Giver, Receiver, Exchanger, or Taker. Be honest.', urgency: 'This Week', tool: 'People Audit (Tool #3)' },
      { move: 'Identify Your Top 3 Exchangers', description: 'Find the three people in your life who both give and receive value. These are your highest-ROI relationships.', urgency: 'Week 1', tool: 'Relationship Matrix (Tool #6)' },
      { move: 'Set One Critical Boundary', description: 'Identify the single relationship that drains the most energy. Create a clear boundary this week.', urgency: 'Week 2', tool: 'Value Replacement Map (Tool #10)' },
    ],
    Influence: [
      { move: 'Score Your Leadership Level', description: 'Use Maxwell\'s 5 Levels to honestly assess where you operate. Most people overestimate by 1-2 levels.', urgency: 'Today', tool: 'Influence Ladder (Tool #8)' },
      { move: 'Run the Integrity Alignment Check', description: 'Compare your stated values with your calendar and bank statement. The gap between them is your credibility leak.', urgency: 'This Week', tool: 'Gravitational Center Alignment (Tool #11)' },
      { move: 'Create One Weekly Alignment Action', description: 'Choose one area where your stated values and lived behavior are most misaligned. Create a weekly ritual to close the gap.', urgency: 'Week 2', tool: 'Micro-Honesty Tracker' },
    ],
    Numbers: [
      { move: 'Take the Financial Snapshot', description: 'Document your actual income, expenses, surplus/deficit, and real cost per hour. No guessing — real numbers only.', urgency: 'Today', tool: 'Financial Snapshot (Tool #4)' },
      { move: 'Calculate Your Compound Gap', description: 'Use the Income Multiplier Model to see what small improvements compound to over 90 days, 1 year, and 5 years.', urgency: 'This Week', tool: 'Income Multiplier Model (Tool #12)' },
      { move: 'Identify Your Biggest Financial Leak', description: 'Using the Negative Math framework, find the single expense or habit that costs you the most per year. Eliminate or reduce it.', urgency: 'Week 2', tool: 'Value Per Hour Calculator (Tool #5)' },
    ],
    Knowledge: [
      { move: 'Run the Knowledge ROI Calculator', description: 'Calculate hours invested in learning vs. income and opportunity return. Are you learning things that pay?', urgency: 'This Week', tool: 'Knowledge ROI Calculator (Tool #7)' },
      { move: 'Identify Your Most Expensive Knowledge Gap', description: 'Using the 1,800-hour framework, find the single knowledge gap that costs you the most money or opportunity.', urgency: 'Week 1', tool: 'Knowledge Compounding Tracker' },
      { move: 'Commit to One High-ROI Learning Track', description: 'Choose one skill or knowledge area that will have the highest compound return. Block 5 hours/week for it.', urgency: 'Week 2', tool: 'Double Jeopardy Rule Application' },
    ],
  };

  return moves[weakest] || moves.Time;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const url = req.url.replace(/^\/api\/enterprise/, '');
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const adminPayload = verifyToken(auth);

  try {
    // =============================================
    // AUTH ENDPOINTS
    // =============================================

    // POST /api/enterprise/auth/register - Register a new tenant + admin
    if (req.method === 'POST' && url === '/auth/register') {
      const b = req.body || {};
      if (!b.tenantName || !b.tenantType || !b.email || !b.password || !b.name) {
        return res.status(400).json({ error: 'tenantName, tenantType, email, password, and name are required' });
      }
      if (!['church', 'corporate'].includes(b.tenantType)) {
        return res.status(400).json({ error: 'tenantType must be "church" or "corporate"' });
      }

      const slug = b.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existingSlugs = await sql`SELECT id FROM tenants WHERE slug = ${slug}`;
      if (existingSlugs.length > 0) {
        return res.status(409).json({ error: 'A tenant with this name already exists' });
      }

      const inviteCode = generateCode(8);
      const tenantRows = await sql`INSERT INTO tenants (name, type, slug, invite_code, tier)
        VALUES (${b.tenantName}, ${b.tenantType}, ${slug}, ${inviteCode}, ${b.tier || 'starter'})
        RETURNING *`;
      const tenant = tenantRows[0];

      const passHash = hashPassword(b.password);
      const adminRows = await sql`INSERT INTO tenant_admins (tenant_id, email, name, password_hash, role)
        VALUES (${tenant.id}, ${b.email}, ${b.name}, ${passHash}, 'owner')
        RETURNING id, tenant_id, email, name, role`;
      const admin = adminRows[0];

      const token = createToken({ adminId: admin.id, tenantId: tenant.id, role: admin.role });
      return res.json({ token, admin, tenant: { id: tenant.id, name: tenant.name, type: tenant.type, slug: tenant.slug, inviteCode: tenant.invite_code, tier: tenant.tier } });
    }

    // POST /api/enterprise/auth/login
    if (req.method === 'POST' && url === '/auth/login') {
      const b = req.body || {};
      if (!b.email || !b.password) return res.status(400).json({ error: 'email and password required' });

      const passHash = hashPassword(b.password);
      const rows = await sql`SELECT ta.*, t.name as tenant_name, t.type as tenant_type, t.slug, t.tier, t.invite_code
        FROM tenant_admins ta JOIN tenants t ON ta.tenant_id = t.id
        WHERE ta.email = ${b.email} AND ta.password_hash = ${passHash} AND ta.is_active = true LIMIT 1`;
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const admin = rows[0];
      await sql`UPDATE tenant_admins SET last_login = NOW() WHERE id = ${admin.id}`;

      const token = createToken({ adminId: admin.id, tenantId: admin.tenant_id, role: admin.role });
      return res.json({
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        tenant: { id: admin.tenant_id, name: admin.tenant_name, type: admin.tenant_type, slug: admin.slug, tier: admin.tier, inviteCode: admin.invite_code }
      });
    }

    // =============================================
    // PUBLIC ENDPOINTS (no auth required)
    // =============================================

    // GET /api/enterprise/invite/:code - Get tenant info from invite code
    if (req.method === 'GET' && url.match(/^\/invite\/[a-zA-Z0-9]+$/)) {
      const code = url.split('/invite/')[1];
      // Check tenant invite codes first
      let rows = await sql`SELECT t.* FROM tenants t WHERE t.invite_code = ${code} AND t.is_active = true LIMIT 1`;
      if (rows.length === 0) {
        // Check custom invite codes
        const inviteRows = await sql`SELECT ti.*, t.name as tenant_name, t.type as tenant_type, t.slug
          FROM tenant_invites ti JOIN tenants t ON ti.tenant_id = t.id
          WHERE ti.code = ${code} AND ti.is_active = true AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
          AND (ti.max_uses IS NULL OR ti.use_count < ti.max_uses) LIMIT 1`;
        if (inviteRows.length === 0) return res.status(404).json({ error: 'Invalid or expired invite code' });
        const invite = inviteRows[0];
        return res.json({
          tenantId: invite.tenant_id, tenantName: invite.tenant_name, tenantType: invite.tenant_type,
          slug: invite.slug, department: invite.department, campus: invite.campus,
        });
      }
      const tenant = rows[0];
      return res.json({
        tenantId: tenant.id, tenantName: tenant.name, tenantType: tenant.type,
        slug: tenant.slug, logoUrl: tenant.logo_url, primaryColor: tenant.primary_color,
      });
    }

    // POST /api/enterprise/join - Join a tenant as a member
    if (req.method === 'POST' && url === '/join') {
      const b = req.body || {};
      if (!b.inviteCode || !b.email) return res.status(400).json({ error: 'inviteCode and email required' });

      // Resolve invite to tenant
      let tenantId = null, department = null, campus = null;
      const tenantRows = await sql`SELECT * FROM tenants WHERE invite_code = ${b.inviteCode} AND is_active = true LIMIT 1`;
      if (tenantRows.length > 0) {
        tenantId = tenantRows[0].id;
      } else {
        const inviteRows = await sql`SELECT * FROM tenant_invites WHERE code = ${b.inviteCode} AND is_active = true LIMIT 1`;
        if (inviteRows.length === 0) return res.status(404).json({ error: 'Invalid invite code' });
        tenantId = inviteRows[0].tenant_id;
        department = inviteRows[0].department;
        campus = inviteRows[0].campus;
        await sql`UPDATE tenant_invites SET use_count = use_count + 1 WHERE id = ${inviteRows[0].id}`;
      }

      // Find or create contact
      let contactRows = await sql`SELECT * FROM contacts WHERE email = ${b.email} LIMIT 1`;
      let contact;
      if (contactRows.length > 0) {
        contact = contactRows[0];
      } else {
        const rows = await sql`INSERT INTO contacts (first_name, last_name, email, phone, created_at, tenant_id)
          VALUES (${b.firstName || ''}, ${b.lastName || ''}, ${b.email}, ${b.phone || null}, ${new Date().toISOString()}, ${tenantId})
          RETURNING *`;
        contact = rows[0];
      }

      // Add as tenant member
      try {
        await sql`INSERT INTO tenant_members (tenant_id, contact_id, department, campus, small_group, ministry, employee_id, role_title)
          VALUES (${tenantId}, ${contact.id}, ${b.department || department}, ${b.campus || campus}, ${b.smallGroup || null}, ${b.ministry || null}, ${b.employeeId || null}, ${b.roleTitle || null})
          ON CONFLICT (tenant_id, contact_id) DO UPDATE SET
            department = COALESCE(EXCLUDED.department, tenant_members.department),
            campus = COALESCE(EXCLUDED.campus, tenant_members.campus),
            is_active = true`;
      } catch (e) { /* ignore duplicate key */ }

      // Update contact's tenant_id
      await sql`UPDATE contacts SET tenant_id = ${tenantId} WHERE id = ${contact.id}`;

      return res.json({ joined: true, tenantId, contactId: contact.id });
    }

    // GET /api/enterprise/training-recommendations/:assessmentId
    if (req.method === 'GET' && url.match(/^\/training-recommendations\/\d+$/)) {
      const assessmentId = parseInt(url.split('/').pop());
      const aRows = await sql`SELECT a.*, c.email, tm.tenant_id FROM assessments a
        JOIN contacts c ON a.contact_id = c.id
        LEFT JOIN tenant_members tm ON tm.contact_id = c.id
        WHERE a.id = ${assessmentId} LIMIT 1`;
      if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
      const a = aRows[0];

      let tenantType = null;
      if (a.tenant_id) {
        const tRows = await sql`SELECT type FROM tenants WHERE id = ${a.tenant_id}`;
        if (tRows.length > 0) tenantType = tRows[0].type;
      }

      const recommendations = computeTrainingRecommendations(a, tenantType);

      // Fetch matching training paths
      const paths = await sql`SELECT * FROM training_paths WHERE is_active = true ORDER BY sort_order ASC`;
      const matchedPaths = [];
      for (const rec of recommendations) {
        if (rec.category) {
          const matching = paths.filter(p => p.category === rec.category &&
            (p.tenant_id === null || p.tenant_id === a.tenant_id) &&
            a[rec.pillar + '_total'] >= (p.score_min || 0) &&
            a[rec.pillar + '_total'] <= (p.score_max || 50));
          matchedPaths.push(...matching.map(p => ({
            id: p.id, name: p.name, description: p.description, type: p.type,
            category: p.category, content: typeof p.content === 'string' ? JSON.parse(p.content) : p.content,
            matchReason: rec.reason,
          })));
        }
      }

      // Wealth triggers
      const overlayScores = a.corporate_overlay_scores ?
        (typeof a.corporate_overlay_scores === 'string' ? JSON.parse(a.corporate_overlay_scores) : a.corporate_overlay_scores) : {};
      const wealthTriggers = computeWealthTriggers(a, overlayScores);

      // First three moves
      const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});
      const firstThreeMoves = generateFirstThreeMoves(a, prescription);

      return res.json({
        assessmentId,
        recommendations,
        trainingPaths: matchedPaths,
        wealthTriggers,
        firstThreeMoves,
        tenantType,
      });
    }

    // =============================================
    // ADMIN ENDPOINTS (auth required)
    // =============================================

    if (!adminPayload) {
      // Check if this is an admin-required route
      const adminRoutes = ['/dashboard', '/members', '/invites', '/csv', '/alerts', '/settings', '/heatmap', '/cohort', '/training'];
      const needsAuth = adminRoutes.some(r => url.startsWith(r));
      if (needsAuth) return res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
    }

    const tenantId = adminPayload?.tenantId;

    // GET /api/enterprise/dashboard - Main dashboard data
    if (req.method === 'GET' && url === '/dashboard') {
      // Total members
      const memberCount = await sql`SELECT COUNT(*) as cnt FROM tenant_members WHERE tenant_id = ${tenantId} AND is_active = true`;

      // Total assessments for this tenant
      const assessmentCount = await sql`SELECT COUNT(*) as cnt FROM assessments a
        JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}`;

      // Score distribution
      const dist = await sql`SELECT a.score_range as range, COUNT(*) as count
        FROM assessments a JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}
        GROUP BY a.score_range`;

      // Pillar averages
      const avgs = await sql`SELECT
        AVG(a.time_total) as t, AVG(a.people_total) as p,
        AVG(a.influence_total) as i, AVG(a.numbers_total) as n, AVG(a.knowledge_total) as k,
        AVG(a.master_score) as master
        FROM assessments a JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}`;
      const a = avgs[0] || {};

      // Recent assessments
      const recent = await sql`SELECT a.id, a.master_score, a.score_range, a.weakest_pillar, a.completed_at,
        c.first_name, c.last_name, tm.department, tm.campus
        FROM assessments a
        JOIN contacts c ON a.contact_id = c.id
        JOIN tenant_members tm ON tm.contact_id = c.id AND tm.tenant_id = ${tenantId}
        ORDER BY a.completed_at DESC LIMIT 20`;

      // Alerts
      const alerts = await sql`SELECT * FROM dashboard_alerts WHERE tenant_id = ${tenantId} AND is_read = false ORDER BY created_at DESC LIMIT 10`;

      // Training completion
      const trainingStats = await sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
        FROM training_assignments WHERE tenant_id = ${tenantId}`;

      // Tenant info
      const tenantRows = await sql`SELECT * FROM tenants WHERE id = ${tenantId}`;
      const tenant = tenantRows[0];

      // 90-day score deltas (compare assessments from last 90 days with prior)
      const now = new Date();
      const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      const currentAvg = await sql`SELECT AVG(a.master_score) as avg_score
        FROM assessments a JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}
        WHERE a.completed_at > ${d90}`;
      const priorAvg = await sql`SELECT AVG(a.master_score) as avg_score
        FROM assessments a JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}
        WHERE a.completed_at <= ${d90}`;

      return res.json({
        tenant: {
          id: tenant.id, name: tenant.name, type: tenant.type, tier: tenant.tier,
          inviteCode: tenant.invite_code, slug: tenant.slug,
        },
        stats: {
          totalMembers: Number(memberCount[0]?.cnt || 0),
          totalAssessments: Number(assessmentCount[0]?.cnt || 0),
          avgMasterScore: Math.round((Number(a.master) || 0) * 10) / 10,
        },
        distribution: dist.map(r => ({ range: r.range, count: Number(r.count) })),
        averages: [
          { pillar: 'Time', avg: Math.round((Number(a.t) || 0) * 10) / 10 },
          { pillar: 'People', avg: Math.round((Number(a.p) || 0) * 10) / 10 },
          { pillar: 'Influence', avg: Math.round((Number(a.i) || 0) * 10) / 10 },
          { pillar: 'Numbers', avg: Math.round((Number(a.n) || 0) * 10) / 10 },
          { pillar: 'Knowledge', avg: Math.round((Number(a.k) || 0) * 10) / 10 },
        ],
        recent: recent.map(r => ({
          id: r.id, masterScore: r.master_score, scoreRange: r.score_range,
          weakestPillar: r.weakest_pillar, completedAt: r.completed_at,
          name: `${r.first_name} ${r.last_name}`, department: r.department, campus: r.campus,
        })),
        alerts: alerts.map(a => ({
          id: a.id, type: a.alert_type, severity: a.severity,
          title: a.title, message: a.message, createdAt: a.created_at,
        })),
        training: {
          total: Number(trainingStats[0]?.total || 0),
          completed: Number(trainingStats[0]?.completed || 0),
          inProgress: Number(trainingStats[0]?.in_progress || 0),
        },
        scoreDelta: {
          current90DayAvg: Math.round((Number(currentAvg[0]?.avg_score) || 0) * 10) / 10,
          prior90DayAvg: Math.round((Number(priorAvg[0]?.avg_score) || 0) * 10) / 10,
          delta: Math.round(((Number(currentAvg[0]?.avg_score) || 0) - (Number(priorAvg[0]?.avg_score) || 0)) * 10) / 10,
        },
      });
    }

    // GET /api/enterprise/members - List all tenant members
    if (req.method === 'GET' && url.startsWith('/members')) {
      const params = new URL('http://x' + req.url).searchParams;
      const department = params.get('department');
      const campus = params.get('campus');

      let members;
      if (department) {
        members = await sql`SELECT tm.*, c.first_name, c.last_name, c.email,
          (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
          (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_range,
          (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
          (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count
          FROM tenant_members tm JOIN contacts c ON tm.contact_id = c.id
          WHERE tm.tenant_id = ${tenantId} AND tm.is_active = true AND tm.department = ${department}
          ORDER BY c.last_name ASC`;
      } else if (campus) {
        members = await sql`SELECT tm.*, c.first_name, c.last_name, c.email,
          (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
          (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_range,
          (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
          (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count
          FROM tenant_members tm JOIN contacts c ON tm.contact_id = c.id
          WHERE tm.tenant_id = ${tenantId} AND tm.is_active = true AND tm.campus = ${campus}
          ORDER BY c.last_name ASC`;
      } else {
        members = await sql`SELECT tm.*, c.first_name, c.last_name, c.email,
          (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
          (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_range,
          (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
          (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count
          FROM tenant_members tm JOIN contacts c ON tm.contact_id = c.id
          WHERE tm.tenant_id = ${tenantId} AND tm.is_active = true
          ORDER BY c.last_name ASC`;
      }

      return res.json(members.map(m => ({
        id: m.id, contactId: m.contact_id, firstName: m.first_name, lastName: m.last_name, email: m.email,
        department: m.department, campus: m.campus, smallGroup: m.small_group, ministry: m.ministry,
        employeeId: m.employee_id, roleTitle: m.role_title,
        latestScore: m.latest_score, latestRange: m.latest_range, weakestPillar: m.weakest_pillar,
        assessmentCount: Number(m.assessment_count), joinedAt: m.joined_at,
      })));
    }

    // GET /api/enterprise/heatmap - Department/ministry heatmap data
    if (req.method === 'GET' && url === '/heatmap') {
      const tenantRows = await sql`SELECT type FROM tenants WHERE id = ${tenantId}`;
      const tenantType = tenantRows[0]?.type;
      const groupField = tenantType === 'church' ? 'campus' : 'department';

      const heatmapData = await sql`
        SELECT tm.${sql(groupField)} as group_name,
          COUNT(DISTINCT tm.contact_id) as member_count,
          AVG(a.time_total) as avg_time,
          AVG(a.people_total) as avg_people,
          AVG(a.influence_total) as avg_influence,
          AVG(a.numbers_total) as avg_numbers,
          AVG(a.knowledge_total) as avg_knowledge,
          AVG(a.master_score) as avg_master
        FROM tenant_members tm
        JOIN (
          SELECT DISTINCT ON (contact_id) * FROM assessments ORDER BY contact_id, completed_at DESC
        ) a ON a.contact_id = tm.contact_id
        WHERE tm.tenant_id = ${tenantId} AND tm.is_active = true AND tm.${sql(groupField)} IS NOT NULL
        GROUP BY tm.${sql(groupField)}
        HAVING COUNT(DISTINCT tm.contact_id) >= (SELECT anonymity_threshold FROM tenants WHERE id = ${tenantId})
      `;

      return res.json({
        groupBy: groupField,
        groups: heatmapData.map(g => ({
          name: g.group_name,
          memberCount: Number(g.member_count),
          averages: {
            time: Math.round(Number(g.avg_time) * 10) / 10,
            people: Math.round(Number(g.avg_people) * 10) / 10,
            influence: Math.round(Number(g.avg_influence) * 10) / 10,
            numbers: Math.round(Number(g.avg_numbers) * 10) / 10,
            knowledge: Math.round(Number(g.avg_knowledge) * 10) / 10,
            master: Math.round(Number(g.avg_master) * 10) / 10,
          },
        })),
      });
    }

    // GET /api/enterprise/cohort - Cohort-level analytics
    if (req.method === 'GET' && url.startsWith('/cohort')) {
      const params = new URL('http://x' + req.url).searchParams;
      const period = params.get('period') || '90'; // days
      const periodDays = parseInt(period);
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

      const cohortData = await sql`
        SELECT a.score_range,
          COUNT(*) as count,
          AVG(a.master_score) as avg_master,
          AVG(a.time_total) as avg_time,
          AVG(a.people_total) as avg_people,
          AVG(a.influence_total) as avg_influence,
          AVG(a.numbers_total) as avg_numbers,
          AVG(a.knowledge_total) as avg_knowledge
        FROM assessments a
        JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}
        WHERE a.completed_at > ${since}
        GROUP BY a.score_range
      `;

      // Financial stress indicator (anonymized) - only for corporate
      const tenantRows = await sql`SELECT type, anonymity_threshold FROM tenants WHERE id = ${tenantId}`;
      const tenant = tenantRows[0];
      let financialStressData = null;

      if (tenant?.type === 'corporate') {
        const stressRows = await sql`
          SELECT
            COUNT(*) FILTER (WHERE a.numbers_total <= 15) as high_stress,
            COUNT(*) FILTER (WHERE a.numbers_total > 15 AND a.numbers_total <= 25) as moderate_stress,
            COUNT(*) FILTER (WHERE a.numbers_total > 25 AND a.numbers_total <= 35) as mild_stress,
            COUNT(*) FILTER (WHERE a.numbers_total > 35) as low_stress,
            COUNT(*) as total
          FROM assessments a
          JOIN tenant_members tm ON a.contact_id = tm.contact_id AND tm.tenant_id = ${tenantId}
          WHERE a.completed_at > ${since}
        `;
        const s = stressRows[0] || {};
        const total = Number(s.total) || 1;
        if (total >= (tenant.anonymity_threshold || 5)) {
          financialStressData = {
            highStressPct: Math.round((Number(s.high_stress) / total) * 100),
            moderateStressPct: Math.round((Number(s.moderate_stress) / total) * 100),
            mildStressPct: Math.round((Number(s.mild_stress) / total) * 100),
            lowStressPct: Math.round((Number(s.low_stress) / total) * 100),
            total,
          };
        }
      }

      return res.json({
        period: periodDays,
        cohorts: cohortData.map(c => ({
          range: c.score_range,
          count: Number(c.count),
          avgMaster: Math.round(Number(c.avg_master) * 10) / 10,
          avgTime: Math.round(Number(c.avg_time) * 10) / 10,
          avgPeople: Math.round(Number(c.avg_people) * 10) / 10,
          avgInfluence: Math.round(Number(c.avg_influence) * 10) / 10,
          avgNumbers: Math.round(Number(c.avg_numbers) * 10) / 10,
          avgKnowledge: Math.round(Number(c.avg_knowledge) * 10) / 10,
        })),
        financialStress: financialStressData,
      });
    }

    // POST /api/enterprise/invites - Create invite link
    if (req.method === 'POST' && url === '/invites') {
      const b = req.body || {};
      const code = generateCode(10);
      const rows = await sql`INSERT INTO tenant_invites (tenant_id, code, created_by, max_uses, department, campus, expires_at)
        VALUES (${tenantId}, ${code}, ${adminPayload.adminId}, ${b.maxUses || null}, ${b.department || null}, ${b.campus || null}, ${b.expiresAt || null})
        RETURNING *`;
      return res.json({
        id: rows[0].id, code: rows[0].code,
        inviteUrl: `https://assessment.valuetovictory.com/join/${rows[0].code}`,
        department: rows[0].department, campus: rows[0].campus,
        maxUses: rows[0].max_uses, expiresAt: rows[0].expires_at,
      });
    }

    // GET /api/enterprise/invites - List invites
    if (req.method === 'GET' && url === '/invites') {
      const invites = await sql`SELECT * FROM tenant_invites WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return res.json(invites.map(i => ({
        id: i.id, code: i.code, department: i.department, campus: i.campus,
        maxUses: i.max_uses, useCount: i.use_count, isActive: i.is_active,
        expiresAt: i.expires_at, createdAt: i.created_at,
        inviteUrl: `https://assessment.valuetovictory.com/join/${i.code}`,
      })));
    }

    // POST /api/enterprise/csv/upload - Upload CSV data
    if (req.method === 'POST' && url === '/csv/upload') {
      const b = req.body || {};
      if (!b.data || !b.columnMapping) return res.status(400).json({ error: 'data (array of rows) and columnMapping required' });

      const mapping = b.columnMapping; // { email: 'Email', firstName: 'First Name', ... }
      const rows = b.data;
      const importId = await sql`INSERT INTO csv_imports (tenant_id, admin_id, filename, row_count, column_mapping, status)
        VALUES (${tenantId}, ${adminPayload.adminId}, ${b.filename || 'upload.csv'}, ${rows.length}, ${JSON.stringify(mapping)}::jsonb, 'processing')
        RETURNING id`;
      const csvImportId = importId[0].id;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const email = row[mapping.email];
          if (!email) {
            errors.push({ row: i + 1, error: 'Missing email' });
            errorCount++;
            continue;
          }

          // Upsert contact
          let contactRows = await sql`SELECT * FROM contacts WHERE email = ${email} LIMIT 1`;
          let contact;
          if (contactRows.length > 0) {
            contact = contactRows[0];
          } else {
            const cRows = await sql`INSERT INTO contacts (first_name, last_name, email, phone, created_at, tenant_id)
              VALUES (${row[mapping.firstName] || ''}, ${row[mapping.lastName] || ''}, ${email}, ${row[mapping.phone] || null}, ${new Date().toISOString()}, ${tenantId})
              RETURNING *`;
            contact = cRows[0];
          }

          // Upsert tenant member
          await sql`INSERT INTO tenant_members (tenant_id, contact_id, department, campus, small_group, ministry, employee_id, role_title)
            VALUES (${tenantId}, ${contact.id}, ${row[mapping.department] || null}, ${row[mapping.campus] || null}, ${row[mapping.smallGroup] || null}, ${row[mapping.ministry] || null}, ${row[mapping.employeeId] || null}, ${row[mapping.roleTitle] || null})
            ON CONFLICT (tenant_id, contact_id) DO UPDATE SET
              department = COALESCE(EXCLUDED.department, tenant_members.department),
              campus = COALESCE(EXCLUDED.campus, tenant_members.campus),
              small_group = COALESCE(EXCLUDED.small_group, tenant_members.small_group),
              ministry = COALESCE(EXCLUDED.ministry, tenant_members.ministry),
              employee_id = COALESCE(EXCLUDED.employee_id, tenant_members.employee_id),
              role_title = COALESCE(EXCLUDED.role_title, tenant_members.role_title),
              is_active = true`;

          successCount++;
        } catch (e) {
          errors.push({ row: i + 1, error: e.message });
          errorCount++;
        }
      }

      await sql`UPDATE csv_imports SET success_count = ${successCount}, error_count = ${errorCount}, errors = ${JSON.stringify(errors)}::jsonb, status = 'completed', completed_at = NOW() WHERE id = ${csvImportId}`;

      return res.json({
        importId: csvImportId, totalRows: rows.length,
        successCount, errorCount, errors: errors.slice(0, 20),
      });
    }

    // GET /api/enterprise/csv/imports - List CSV imports
    if (req.method === 'GET' && url === '/csv/imports') {
      const imports = await sql`SELECT * FROM csv_imports WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 50`;
      return res.json(imports.map(i => ({
        id: i.id, filename: i.filename, rowCount: i.row_count,
        successCount: i.success_count, errorCount: i.error_count,
        status: i.status, createdAt: i.created_at, completedAt: i.completed_at,
      })));
    }

    // GET /api/enterprise/alerts - Get alerts
    if (req.method === 'GET' && url === '/alerts') {
      const alerts = await sql`SELECT * FROM dashboard_alerts WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 50`;
      return res.json(alerts.map(a => ({
        id: a.id, type: a.alert_type, severity: a.severity,
        title: a.title, message: a.message, metadata: a.metadata,
        isRead: a.is_read, createdAt: a.created_at,
      })));
    }

    // POST /api/enterprise/alerts/:id/read - Mark alert as read
    if (req.method === 'POST' && url.match(/^\/alerts\/\d+\/read$/)) {
      const alertId = parseInt(url.split('/')[2]);
      await sql`UPDATE dashboard_alerts SET is_read = true WHERE id = ${alertId} AND tenant_id = ${tenantId}`;
      return res.json({ success: true });
    }

    // PUT /api/enterprise/settings - Update tenant settings
    if (req.method === 'PUT' && url === '/settings') {
      const b = req.body || {};
      if (b.name) await sql`UPDATE tenants SET name = ${b.name} WHERE id = ${tenantId}`;
      if (b.logoUrl !== undefined) await sql`UPDATE tenants SET logo_url = ${b.logoUrl} WHERE id = ${tenantId}`;
      if (b.primaryColor) await sql`UPDATE tenants SET primary_color = ${b.primaryColor} WHERE id = ${tenantId}`;
      if (b.secondaryColor) await sql`UPDATE tenants SET secondary_color = ${b.secondaryColor} WHERE id = ${tenantId}`;
      if (b.anonymityThreshold) await sql`UPDATE tenants SET anonymity_threshold = ${b.anonymityThreshold} WHERE id = ${tenantId}`;
      if (b.settings) await sql`UPDATE tenants SET settings = ${JSON.stringify(b.settings)}::jsonb WHERE id = ${tenantId}`;

      const updated = await sql`SELECT * FROM tenants WHERE id = ${tenantId}`;
      return res.json(updated[0]);
    }

    // GET /api/enterprise/training/stats - Training completion stats
    if (req.method === 'GET' && url === '/training/stats') {
      const stats = await sql`
        SELECT tp.name, tp.category, tp.type,
          COUNT(*) as assigned,
          COUNT(*) FILTER (WHERE ta.status = 'completed') as completed,
          COUNT(*) FILTER (WHERE ta.status = 'in_progress') as in_progress,
          AVG(ta.progress) as avg_progress
        FROM training_assignments ta
        JOIN training_paths tp ON ta.training_path_id = tp.id
        WHERE ta.tenant_id = ${tenantId}
        GROUP BY tp.id, tp.name, tp.category, tp.type
        ORDER BY tp.name
      `;
      return res.json(stats.map(s => ({
        name: s.name, category: s.category, type: s.type,
        assigned: Number(s.assigned), completed: Number(s.completed),
        inProgress: Number(s.in_progress),
        avgProgress: Math.round(Number(s.avg_progress) || 0),
        completionRate: Number(s.assigned) > 0 ? Math.round((Number(s.completed) / Number(s.assigned)) * 100) : 0,
      })));
    }

    // GET /api/enterprise/export - Export tenant data as CSV
    if (req.method === 'GET' && url === '/export') {
      const all = await sql`
        SELECT c.first_name, c.last_name, c.email, tm.department, tm.campus,
          a.master_score, a.score_range, a.time_total, a.people_total,
          a.influence_total, a.numbers_total, a.knowledge_total,
          a.weakest_pillar, a.completed_at
        FROM assessments a
        JOIN contacts c ON a.contact_id = c.id
        JOIN tenant_members tm ON tm.contact_id = c.id AND tm.tenant_id = ${tenantId}
        ORDER BY a.completed_at DESC`;

      let csv = 'First Name,Last Name,Email,Department,Campus,Master Score,Range,Time,People,Influence,Numbers,Knowledge,Weakest Pillar,Date\n';
      for (const r of all) {
        csv += `"${r.first_name}","${r.last_name}","${r.email}","${r.department || ''}","${r.campus || ''}",${r.master_score},"${r.score_range}",${r.time_total},${r.people_total},${r.influence_total},${r.numbers_total},${r.knowledge_total},"${r.weakest_pillar}","${r.completed_at}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${tenantId}-export.csv`);
      return res.send(csv);
    }

    return res.status(404).json({ error: 'Enterprise endpoint not found' });
  } catch (err) {
    console.error('Enterprise API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
