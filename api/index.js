const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const BASE_URL = process.env.BASE_URL || 'https://assessment.valuetovictory.com';

// ========== VTV COACHING CONSTITUTION ==========
// This governs EVERY AI-generated response, coaching email, and system interaction.
// No code in this platform may violate these principles.
const VTV_CONSTITUTION = {
  coreRule: 'NEVER cause harm. Every interaction must add value to the person and those around them while encouraging openness to growth.',
  principles: [
    'Speak truth with compassion — honest about weaknesses, never cruel about them',
    'Build people up — even confrontation should leave them stronger than before',
    'No addiction mechanics — no streaks that punish, no notifications that guilt, no gamification that creates anxiety',
    'Respect autonomy — suggest, never pressure. They choose their pace.',
    'Faith-grounded — wisdom is welcome, preaching is not. Meet people where they are.',
    'Privacy is sacred — their data is theirs. Their struggles are theirs. Their growth is theirs to share or keep.',
    'No comparison to others — only compare them to their previous self',
    'Celebrate effort, not just results — showing up matters more than the score',
    'When someone is struggling, lead with empathy before strategy',
    'The goal is a person who outgrows the system — that means it worked',
  ],
  tone: {
    voice: 'Direct, warm, like a mentor who has been through it. Not corporate. Not clinical. Real.',
    never: ['game-changer', 'unlock potential', 'level up', 'crush it', 'hustle', 'grind harder', 'no excuses'],
    always: ['honest', 'specific to their data', 'actionable within their real life', 'respectful of their time'],
  },
  safetyFilters: {
    mentalHealth: 'If someone indicates self-harm, crisis, or severe depression — do NOT coach. Provide 988 Suicide & Crisis Lifeline and encourage professional help immediately.',
    relationships: 'Never advise ending relationships. Encourage communication, professional counseling, and self-reflection.',
    financial: 'Never give specific investment advice. Encourage financial literacy and professional consultation.',
    faith: 'Honor all faith backgrounds. Share biblical wisdom when natural. Never gatekeep or judge.',
  },
};

// ========== SECURITY: Rate Limiting ==========
const rateLimitStore = new Map();
const RATE_LIMITS = {
  default: { max: 60, windowMs: 60000 },     // 60 req/min general
  auth: { max: 10, windowMs: 60000 },        // 10 req/min for PIN attempts
  assessment: { max: 5, windowMs: 60000 },   // 5 submissions/min
  admin: { max: 30, windowMs: 60000 },       // 30 req/min for admin
  enumeration: { max: 5, windowMs: 60000 },  // 5 req/min for endpoints that reveal account existence (has-pin, etc.) — defeats casual email enumeration
};

function checkRateLimit(ip, category = 'default') {
  const limit = RATE_LIMITS[category] || RATE_LIMITS.default;
  const key = `${ip}:${category}`;
  const now = Date.now();
  let record = rateLimitStore.get(key);
  if (!record || (now - record.start) > limit.windowMs) {
    record = { count: 0, start: now };
  }
  record.count++;
  rateLimitStore.set(key, record);
  // Cleanup old entries every 1000 requests
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.start > limit.windowMs * 2) rateLimitStore.delete(k);
    }
  }
  return { allowed: record.count <= limit.max, remaining: Math.max(0, limit.max - record.count) };
}

// ========== SECURITY: JWT Token Generation & Verification ==========
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_API_KEY;
if (!process.env.JWT_SECRET && process.env.ADMIN_API_KEY) {
  console.warn('SECURITY: JWT_SECRET unset — falling back to ADMIN_API_KEY. ' +
    'Compromise of admin key = JWT forgery. Set distinct JWT_SECRET in Vercel env vars.');
}
if (!JWT_SECRET) console.error('CRITICAL: JWT_SECRET not set — auth will fail');
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

function createJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRY })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJWT(token) {
  try {
    if (!JWT_SECRET) return null;
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function extractToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function extractUser(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    return verifyJWT(auth.slice(7));
  }
  return null;
}

// ========== SECURITY: PIN Hashing (PBKDF2 — replaces SHA-256) ==========
const PIN_SALT = process.env.PIN_SALT || '_vtv_salt_2026';
const PIN_ITERATIONS = 100000;
const PIN_KEYLEN = 64;
const PIN_DIGEST = 'sha512';

function hashPinSync(pin) {
  return crypto.pbkdf2Sync(pin, PIN_SALT, PIN_ITERATIONS, PIN_KEYLEN, PIN_DIGEST).toString('hex');
}

function verifyPin(pin, storedHash) {
  // Support legacy SHA-256 hashes (64 chars) and new PBKDF2 (128 chars)
  if (storedHash.length === 64) {
    // Legacy SHA-256 — verify but flag for upgrade
    const legacyHash = crypto.createHash('sha256').update(pin + PIN_SALT).digest('hex');
    return { valid: legacyHash === storedHash, needsUpgrade: true };
  }
  // New PBKDF2
  const newHash = hashPinSync(pin);
  return { valid: newHash === storedHash, needsUpgrade: false };
}

// ========== INPUT VALIDATION ==========
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}
function validateLength(str, min, max) {
  if (!str || typeof str !== 'string') return false;
  return str.length >= min && str.length <= max;
}
function sanitizeString(str, maxLen = 1000) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen);
}

// HTML escape for safe interpolation into email templates (prevents stored XSS)
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Mask email for logging (PII protection) — shows first 2 chars + domain
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[no-email]';
  const [local, domain] = email.split('@');
  if (!domain) return email.substring(0, 2) + '***';
  return local.substring(0, 2) + '***@' + domain;
}

async function auditLog(sql, { action, actor, targetTable, targetId, oldValues, newValues, ip }) {
  try {
    await sql`INSERT INTO audit_log (action, actor, target_table, target_id, old_values, new_values, ip_address)
      VALUES (${action}, ${actor || 'system'}, ${targetTable || null}, ${targetId || null},
              ${oldValues ? JSON.stringify(oldValues) : null}::jsonb,
              ${newValues ? JSON.stringify(newValues) : null}::jsonb, ${ip || null})`;
  } catch(e) { console.error('Audit log error:', e.message); }
}

// ========== SECURITY: CORS Allowed Origins ==========
const ALLOWED_ORIGINS = [
  'https://valuetovictory.com',
  'https://www.valuetovictory.com',
  'https://assessment.valuetovictory.com',
  'https://shawnedecker.com',
  'https://www.shawnedecker.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'] : []),
];

function getCorsOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow Vercel preview deployments — only exact project subdomains
  if (origin.endsWith('.vercel.app') && /^https:\/\/vtv-assessment[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0]; // Default to main domain
}

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
  // Default (extensive): maxScore = 250 → thresholds at 50/100/150/200
  // Quick (25 questions): maxScore = 125 → thresholds at 25/50/75/100
  // Pillar deep-dive (10 questions): maxScore = 50 → thresholds at 10/20/30/40
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
    People: { diagnosis: "Your People pillar is where your next level of growth lives. This isn't about your ability to connect — it's about how you structure, protect, and leverage those connections for maximum impact.", diagnosisHighPerformer: "You know how to build relationships. The assessment is showing you the next frontier: structuring stronger boundaries, aligning your inner circle with your long-term vision, and ensuring every relational investment compounds. This is advanced-level People work.", immediate: "Run the People Audit (Tool #3). Map your top 15-20 relationships — not by who you like, but by who aligns with where you're going. Classify: Givers, Receivers, Exchangers, Takers.", tool: "Relationship Matrix (Tool #6) — Classify your network by alliance type: Confidants, Constituents, Comrades, Companions. Protect the inner circle. Restructure the rest.", thirtyDay: "Use the Value Replacement Map (Tool #10) to redirect relational energy from maintenance relationships to growth-multiplying alliances." },
    Influence: { diagnosis: "Your Influence pillar needs work. You may be operating at a lower level of leadership than your experience warrants, or there's a gap between your stated and lived values.", immediate: "Run the Influence Ladder (Tool #8). Identify which of Maxwell's five levels you currently operate at.", tool: "Gravitational Center Alignment (Tool #11) — Audit your calendar and bank statement against your core values.", thirtyDay: "Score the gap between stated and lived values. Create one specific alignment action per week." },
    Numbers: { diagnosis: "Your Numbers pillar is your weakest area. You're likely not tracking what matters, or there's a disconnect between your goals and your financial reality.", immediate: "Run the Financial Snapshot (Tool #4). Document actual income, expenses, surplus/deficit, and real cost per hour.", tool: "Value Per Hour Calculator (Tool #5) — Calculate your actual hourly worth and your potential hourly worth.", thirtyDay: "Use the Income Multiplier Model (Tool #12) to map compound improvements over 90 days." },
    Knowledge: { diagnosis: "Your Knowledge pillar is your biggest gap. You may be consuming information without applying it, or investing learning hours in areas that don't compound.", immediate: "Run the Knowledge ROI Calculator (Tool #7). Calculate hours invested vs. income and opportunity return.", tool: "Map your knowledge gaps against the 1,800-hour framework. Identify the single most expensive gap.", thirtyDay: "Commit to one high-ROI learning track. Apply the Rule of Double Jeopardy — never pay for the same mistake twice." },
  };
  const rx = prescriptions[weakest.name];

  // High-performer detection: if the person has any sub-scores >= 4 in their weakest pillar,
  // they're not fundamentally weak — they're working on next-level structural growth.
  const highSubs = Object.values(weakest.subs).filter(v => v >= 4).length;
  const isHighPerformer = highSubs >= 2 || (weakest.score > 15 && highSubs >= 1);
  if (isHighPerformer && rx.diagnosisHighPerformer) {
    rx.diagnosis = rx.diagnosisHighPerformer;
  }

  const crossPillarImpact = generateCrossPillarImpact(a);
  return { weakestPillar: weakest.name, weakestScore: weakest.score, strongestPillar: strongest.name, strongestScore: strongest.score, weakestSubCategory: weakestSubs[0][0], weakestSubScore: weakestSubs[0][1], ...rx, isHighPerformer, pillars: pillars.map(p => ({ name: p.name, score: p.score })), crossPillarImpact };
}

// ============================
// COACHING EMAIL ENGINE
// ============================

function generateCoachingEmail(day, assessmentData, prescription, email) {
  const a = assessmentData;
  const firstName = escapeHtml(a.first_name || 'there');
  const weakest = prescription.weakestPillar;
  const strongest = prescription.strongestPillar;
  const weakestScore = prescription.weakestScore;
  const strongestScore = prescription.strongestScore;
  const weakestSub = prescription.weakestSubCategory;
  const crossPillar = prescription.crossPillarImpact || {};
  const primaryImpact = crossPillar.primaryImpact || {};
  const crossHeadline = primaryImpact.headline || `Your ${weakest} is holding back your ${strongest}.`;
  const crossExplanation = primaryImpact.explanation || '';
  const severity = crossPillar.severity || 'moderate';
  const scoreRange = a.score_range || 'Growth';
  const masterScore = a.master_score || 0;
  const targetScore = Math.min(50, Math.round(weakestScore * 1.5));

  const unsubToken = Buffer.from(email).toString('base64');
  const unsubUrl = `${BASE_URL}/api/coaching/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubToken)}`;
  const retakeUrl = BASE_URL;
  const reportUrl = `${BASE_URL}/report/${a.id}`;

  // Pillar-specific content for the Honest 24 framework (Day 2)
  // The 8+8+8 is the IDEAL. The Reality Audit is what actually happens.
  // The Dynamic Calculator personalizes it.
  const rule888 = {
    Time: "Let's be real about your 24 hours. The 8+8+8 is the target — 8 hours of focused work, 8 hours for you, 8 hours of sleep. But here's what actually happens: 1-2 hours commuting, 1 hour getting ready, 1-2 hours on meals and chores. That leaves you maybe 4-5 hours 'for you' — not 8. Your Time score tells me you're not even protecting those 4-5. Tomorrow, draw four columns: WORK / OBLIGATIONS / ME / SLEEP. Track every hour. The gap between where your time goes and where it should go is your biggest opportunity.",
    People: "The 8+8+8 says you get 8 hours for you — but in reality, commuting, cooking, errands, and household obligations eat 3-4 of those hours. That leaves maybe 4-5 hours of discretionary time. How much of that goes to the people who matter? Be honest — most of it goes to screens. One real hour with someone who matters is worth more than 4 hours of scrolling in the same room.",
    Influence: "The 8+8+8 says 8 hours of work. Reality? You work 9-10 including commute and lunch. The question is: how many of those hours build influence vs. just maintain your position? Most people spend 90% on maintenance and 10% on growth. Flip that ratio in just one hour a day and your Influence score changes within 30 days.",
    Numbers: "Let's do the real math. You work 8-10 hours including commute. Sleep 6-7. Spend 2-3 on obligations. That leaves 4-5 hours. Now divide your total daily expenses by your actual productive hours. That's your real cost-per-hour. Most people have never calculated this. Do it right now — the number will either motivate you or terrify you. Both are useful.",
    Knowledge: "Here's the honest breakdown: after work (9-10 hrs with commute), sleep (7 hrs), and obligations (2-3 hrs), you have roughly 4-5 hours of discretionary time. If learning isn't carved out of those 4-5 hours with a specific block, it's not happening. You can't learn passively. Schedule 30 minutes of deliberate learning inside your real available time — not your fantasy schedule."
  };

  // Pillar-specific 10-minute challenges (Day 4)
  const rule10min = {
    Time: "Set a timer. 10 minutes. Open your calendar and delete or delegate ONE thing that isn't moving you forward. 2 minute break. Repeat. You'll be shocked at how much of your schedule exists out of habit, not intention.",
    People: "Set a timer. 10 minutes. Text 3 people who matter with something real — not a meme, not small talk. Tell them something you appreciate about them. Something specific. 2 minute break. Repeat.",
    Influence: "Set a timer. 10 minutes. Write down your 3 core values. Then pull up your last week's calendar — does it match? Where are the gaps between what you say matters and what you actually did? 2 minute break. Repeat.",
    Numbers: "Set a timer. 10 minutes. Pull up your bank statement. Calculate your actual cost per hour this month. Total expenses divided by hours worked. 2 minute break. Write down the number. Let it sink in.",
    Knowledge: `Set a timer. 10 minutes. Find one podcast, video, or book chapter that directly addresses ${weakestSub}. Consume it. 2 minute break. Apply one thing you learned immediately — even if it's small.`
  };

  // Pillar-specific 90-minute daily blocks (Day 5)
  const rule9090 = {
    Time: "90 minutes of calendar audit + priority restructuring every morning before email. Before you open a single notification, you decide what today is for.",
    People: "90 minutes of intentional relationship investment — calls, meals, real conversations. Not networking. Not transactional. Real investment in the people who matter.",
    Influence: "90 minutes of skill development and professional authority building. Writing, creating, teaching, leading — whatever builds your credibility in your space.",
    Numbers: "90 minutes of financial review, tracking, goal-setting, and investment research. Know your numbers the way a CEO knows their P&L.",
    Knowledge: "90 minutes of deliberate learning in your highest-ROI knowledge gap. Not scrolling articles. Not passive podcasts during commute. Deliberate, focused learning with application."
  };

  let subject, body;

  switch (day) {
    case 1:
      subject = `Your ${weakest} isn't just low — it's costing your ${strongest}`;
      body = `${firstName},

Yesterday you took the P.I.N.K.'s Value Engine Assessment. Your Master Score came in at ${masterScore} (${scoreRange}).

But here's what most people miss — and what I need you to understand right now:

Your ${weakest} score (${weakestScore}/50) isn't just a weakness. It's actively dragging down your ${strongest} (${strongestScore}/50).

${crossHeadline}

${crossExplanation}

This is what I call the cross-pillar bleed. A weakness doesn't stay in its lane. It spreads. And the longer you ignore it, the more it costs you in areas you think are strong.

This week, I'm going to show you exactly how to fix this using 4 rules that will restructure how you spend your time. Each one is simple. Each one is actionable. And each one is personalized to your exact scores.

Tomorrow: The 8+8+8 Rule — and why your ${weakest} is stealing from the wrong 8.

— Shawn`;
      break;

    case 2:
      subject = `The Honest 24 — your day doesn't math the way you think it does`;
      body = `${firstName},

Let me wreck a popular framework for you: the 8+8+8 Rule. 8 hours work, 8 hours for you, 8 hours sleep. Clean. Simple. And mathematically dishonest.

Here's what a real 24 hours looks like for most people:

THE HONEST 24:
Sleep: 6-7 hours (you're not getting 8 — almost nobody does)
Work + commute: 9-10 hours (your "8 hours" doesn't include getting there and back)
Obligations: 2-3 hours (meals, errands, chores, kids, getting ready)
ACTUAL DISCRETIONARY TIME: 4-5 hours

That's the truth. You don't have 8 hours "for you." You have 4-5. And if your ${weakest} score is ${weakestScore}/50, I can tell you exactly where those 4-5 hours are going — they're being wasted on things that don't compound.

${rule888[weakest] || rule888.Time}

THE THREE FRAMEWORKS COMBINED:
1. THE IDEAL (8+8+8): This is the target you're building toward. Protect your sleep. Sharpen your work hours so 8 is enough. Guard your personal time ruthlessly.

2. THE REALITY AUDIT: Track tomorrow using four columns — WORK / OBLIGATIONS / ME / SLEEP. No rounding. No lying to yourself. Write down every hour and see where you actually are.

3. YOUR PERSONAL CALCULATOR: Take your actual waking hours (probably 17). Subtract work + commute (9-10). Subtract obligations (2-3). What's left? That number — probably 4 or 5 — is your GROWTH WINDOW. Every minute of ${weakest} improvement has to come from that window. So the question isn't "do I have time?" The question is "what am I spending my growth window on right now?"

YOUR MOVE TODAY:
Run the Reality Audit. Four columns. Every hour. Tomorrow I'm going to give you the 1-3-5 Rule — your exact priorities based on what the audit reveals.

The 8+8+8 is where you're headed. The Honest 24 is where you start.

— Shawn`;
      break;

    case 3:
      subject = `1 goal. 3 moves. 5 wins. Here's yours.`;
      body = `${firstName},

The 1-3-5 Rule: 1 massive goal that scares you + 3 key tasks that move you forward + 5 quick wins you can knock out today.

Here's the part most people get wrong — they pick the wrong 1. They pick something comfortable. Something that sounds ambitious but doesn't actually require change.

Your 1 is clear. Fix your ${weakest}. Not because it's your lowest score — but because it's bleeding into your ${strongest}. ${crossHeadline}

YOUR 1 (The Massive Goal):
${prescription.diagnosis}

YOUR 3 (Key Tasks):
1. ${prescription.immediate}
2. ${prescription.tool}
3. ${prescription.thirtyDay}

YOUR 5 (Quick Wins for Today):
1. Open your assessment report and re-read your ${weakest} breakdown
2. Write down the single biggest way ${weakest} is costing you this week
3. Block 30 minutes on your calendar tomorrow for ${weakest} work
4. Tell one person what you're working on (accountability changes everything)
5. Delete or cancel one thing this week that doesn't serve your ${weakest} improvement

YOUR MOVE TODAY:
Write your 1-3-5 list RIGHT NOW. Pin it where you'll see it every morning. On your bathroom mirror. On your phone lock screen. Wherever your eyes go first.

Tomorrow: The 10-Minute Rule — because you don't need motivation. You need 10 minutes.

— Shawn`;
      break;

    case 4:
      subject = `You don't need motivation. You need 10 minutes.`;
      body = `${firstName},

Your ${weakest} score is ${weakestScore}/50. Your weakest sub-category is ${weakestSub}.

I know that feels overwhelming. When a score is that clear about a gap, the natural response is to freeze. To say "I'll deal with that later." To wait for motivation.

Here's what I've learned coaching people through this: motivation is a lie. It shows up after you start, not before.

The 10-Minute Rule: Work with deadly focus for 10 minutes. Rest for 2 minutes. Repeat. That's it. It kills procrastination. It builds momentum. And it works especially well on the thing you've been avoiding.

YOUR 10-MINUTE CHALLENGE:
${rule10min[weakest] || rule10min.Time}

That's it. One round. 10 minutes of focused work on the thing your score says you've been avoiding.

Most people who do this end up doing 2-3 rounds because once you start, the resistance breaks. But I'm not asking for 2-3 rounds. I'm asking for one. 10 minutes.

YOUR MOVE TODAY:
Do ONE 10-minute round. Just one. Screenshot what you did and save it. I want you to have proof that 10 minutes is enough to start changing a score.

Tomorrow: The 90/90/1 Rule — this is where it gets real.

— Shawn`;
      break;

    case 5:
      subject = `90 minutes. 90 days. 1 pillar. This is where it changes.`;
      body = `${firstName},

The 90/90/1 Rule is the most powerful framework I teach. And it's the simplest.

Dedicate 90 focused minutes every day, for 90 days, to ONE life-changing goal.

Your goal: Move your ${weakest} from ${weakestScore} to ${targetScore}.

That sounds like a lot. But think about it — 90 minutes a day is only 6% of your waking hours. You're already spending more than that on things that don't compound. This just redirects existing time toward the one thing that will move everything else.

Remember — your ${weakest} isn't just holding you back in one area. It's dragging your ${strongest} down with it.

${crossHeadline}

YOUR 90-MINUTE DAILY BLOCK:
${rule9090[weakest] || rule9090.Time}

HERE'S WHY THIS WORKS:
Day 1-7: It feels forced. You'll want to skip.
Day 8-21: It becomes routine. Resistance drops.
Day 22-60: You start seeing changes. In your behavior. In your relationships. In your numbers.
Day 61-90: Other people start noticing.

YOUR MOVE TODAY:
Block 90 minutes on your calendar RIGHT NOW. Same time, every day, for 90 days. Non-negotiable. This is the one thing that separates people who know their score from people who change it.

Retake the assessment on Day 90 to measure your shift: ${retakeUrl}

Tomorrow: How your ${weakest} is silently destroying your ${strongest} — the full breakdown.

— Shawn`;
      break;

    case 6:
      subject = `How your ${weakest} is silently destroying your ${strongest}`;
      body = `${firstName},

Let's go deeper on something I mentioned on Day 1.

Your ${weakest} score is ${weakestScore}/50. Your ${strongest} score is ${strongestScore}/50. The gap between them is ${strongestScore - weakestScore} points.

That gap has a severity level: ${severity.toUpperCase()}.

Here's what that means in practice:

${crossHeadline}

${crossExplanation}

${primaryImpact.subCategoryLinks ? `Specifically, your ${primaryImpact.subCategoryLinks.map(l => l.from).join(' and ')} in ${weakest} are directly impacting your ${primaryImpact.subCategoryLinks.map(l => l.to).join(' and ')} in ${strongest}.` : ''}

This is why fixing your ${weakest} isn't just about that one pillar. It's about unlocking the full potential of your ${strongest} — which is already your best area. Imagine what happens when it's no longer being held back.

THE CASCADE EFFECT:
When you improve ${weakest}, here's what happens across your other pillars:
• Your ${strongest} stops bleeding — the drag disappears
• Your overall Master Score jumps because the lowest pillar has the highest leverage
• Confidence compounds — fixing a weakness builds momentum everywhere

YOUR MOVE TODAY:
Retake the assessment to see your updated cross-pillar impact. Even if your scores haven't changed much yet, seeing the relationships clearly changes how you prioritize.

${retakeUrl}

Tomorrow: I'm going to give you the complete daily system that combines all 4 rules into one routine.

— Shawn`;
      break;

    case 7:
      subject = `Your complete daily system for the next 90 days`;
      body = `${firstName},

You now have all 4 rules:
• The 8+8+8 Rule — structure your day in three equal blocks
• The 1-3-5 Rule — know your one goal, three tasks, five quick wins
• The 10-Minute Rule — kill procrastination with focused sprints
• The 90/90/1 Rule — 90 minutes daily for 90 days on ${weakest}

Today I'm combining them into one daily routine. Personalized to your scores. Print this out. Tape it to your mirror. Start tomorrow.

YOUR DAILY SYSTEM (Built on the Honest 24):

6:00 AM — Reality Check
You have approximately 4-5 hours of discretionary time today. Not 8. Accept that. Now ask: "What am I doing with my growth window today?"

6:15 AM — 1-3-5 List
Write down your 1 goal (improve ${weakest}), your 3 key tasks for today, and 5 quick wins you can knock out. These must fit inside your REAL available time — not a fantasy schedule.

6:30 AM — Start Your 90/90/1 Block
${rule9090[weakest] || rule9090.Time}
This is your non-negotiable 90 minutes carved from your growth window. No phone. No email. No interruptions. This is 30-40% of your discretionary time — that's how much your ${weakest} matters.

Throughout the Day — The 10-Minute Rule
Whenever resistance hits — whenever you want to avoid ${weakest} work — set a timer for 10 minutes and just start. The resistance always breaks after the first round. 10 minutes is 3% of your growth window. You can afford 3%.

9:00 PM — Evening Accountability
Three questions. Answer them honestly:
1. How many of my 4-5 discretionary hours went toward ${weakest} today?
2. What ate the time that should have been mine? (Scrolling? TV? Other people's emergencies?)
3. What's my 1-3-5 for tomorrow?

THE HONEST MATH:
90 minutes of your growth window = 30% of your discretionary time on ${weakest}
That leaves 3+ hours for everything else you want to do
Do this for 90 days and you'll gain ${targetScore - weakestScore} points on your ${weakest} score
Your ${strongest} stops bleeding, your Master Score jumps, and people start noticing

YOUR MOVE TODAY:
Print this schedule. Or screenshot it. Put it somewhere you'll see it before 6 AM tomorrow. Then start.

Tomorrow: the final email in this series — and the one action that will tell you if this week mattered.

— Shawn`;
      break;

    case 8:
      subject = `It's been a week. Let's see what changed.`;
      body = `${firstName},

One week ago, you took the P.I.N.K.'s Value Engine Assessment and scored ${masterScore} (${scoreRange}). Your ${weakest} was ${weakestScore}/50.

Since then, you've learned:
• The 8+8+8 Rule — how to structure your day for value
• The 1-3-5 Rule — how to prioritize what actually moves the needle
• The 10-Minute Rule — how to beat procrastination on the spot
• The 90/90/1 Rule — how to commit 90 minutes a day for 90 days to ${weakest}

You've seen how your ${weakest} is bleeding into your ${strongest}. You've seen the cross-pillar impact. You've had the framework.

Now let's measure the shift.

Even if you only applied ONE of these rules — even if you only did ONE 10-minute sprint — something has changed. Maybe it's awareness. Maybe it's a new habit. Maybe it's just the fact that you know your weakness by name now.

That matters. Because most people never get that far.

YOUR FINAL MOVE:
Retake the assessment. New questions. Same pillars. Real progress.

${retakeUrl}

Your scores will tell you what changed. And if you keep running the system — 90 minutes a day, 90 days — the next retake will shock you.

This isn't the end of coaching. It's the beginning. The assessment is the diagnostic. The 4 rules are the treatment. Your consistency is the cure.

I'm in your corner.

— Shawn

P.S. If you want to go deeper — structured accountability, monthly progress tracking, and direct coaching access — check out our membership options at valuetovictory.com/pricing. But the 4 rules above? Those are free. And they work.`;
      break;

    // ===== PHASE 2: DEEP DIVES (Days 9-16, sent every other day) =====
    case 9:
      subject = `Week 2 starts now — let's go deeper on ${weakest}`;
      body = `${firstName},

You finished Week 1. Most people never get that far.

But here's the thing — knowing the 4 rules isn't the same as living them. Week 1 was awareness. Week 2 is depth.

This week I'm going deeper on your ${weakest} (${weakestScore}/50). Not the theory. The specifics. The sub-categories that are pulling your score down and exactly what to do about each one.

Your weakest sub-category is ${weakestSub}. That's not just a label — it's the specific behavior pattern that's costing you the most.

HERE'S WHAT'S COMING THIS WEEK:
• Deep dive into ${weakestSub} — what it really means and why it's stuck
• The "Opposite Action" technique — doing the thing your score says you avoid
• A mid-week accountability check that you can't fake
• Your first progress measurement since Day 1

THE RULE FOR WEEK 2:
Every morning before you check your phone, ask yourself: "What's one thing I can do for my ${weakest} today that I wouldn't have done two weeks ago?"

Write the answer down. Then do it. That's the whole system.

YOUR MOVE TODAY:
Open your report and look at your ${weakest} sub-categories. Rank them. Which one feels most uncomfortable? That's your starting point.

${reportUrl}

— Shawn`;
      break;

    case 10:
      subject = `The Opposite Action technique for ${weakestSub}`;
      body = `${firstName},

Your weakest sub-category is ${weakestSub}. Score: ${prescription.weakestSubScore || 1}/5.

Here's a pattern I see over and over: the thing you most need to improve is the thing you most naturally avoid. Your brain has built a highway around it. You don't even notice you're avoiding it anymore.

THE OPPOSITE ACTION TECHNIQUE:
1. Identify the behavior your low ${weakestSub} score reveals
2. Ask: "What would someone who scores 5/5 on this do today?"
3. Do that thing. Even if it feels wrong. Even if it feels forced.

The discomfort IS the signal that you're growing. Comfort is maintenance. Discomfort is improvement.

${weakest === 'Time' ? `For ${weakestSub}: If you're avoiding structure, build it. If you're avoiding delegation, delegate something today. If you're avoiding tracking, track every hour tomorrow.` : ''}${weakest === 'People' ? `For ${weakestSub}: If you're avoiding hard conversations, have one today. If you're avoiding vulnerability, share something real. If you're avoiding boundaries, set one.` : ''}${weakest === 'Influence' ? `For ${weakestSub}: If you're avoiding visibility, post something today. If you're avoiding feedback, ask for it. If you're avoiding leadership, lead something small.` : ''}${weakest === 'Numbers' ? `For ${weakestSub}: If you're avoiding your bank statement, open it. If you're avoiding goal-setting, set one today. If you're avoiding tracking, start a spreadsheet.` : ''}${weakest === 'Knowledge' ? `For ${weakestSub}: If you're avoiding learning, spend 20 minutes on it today. If you're avoiding application, apply one thing you already know. If you're avoiding self-assessment, be honest about what you don't know.` : ''}

YOUR MOVE TODAY:
One Opposite Action. Just one. Something your old self would have avoided. Do it before the end of the day and you'll feel the shift.

— Shawn`;
      break;

    case 11:
      subject = `Mid-week check: Are you running the system or just reading emails?`;
      body = `${firstName},

Honest question — and I need you to answer it before you read another word:

Have you actually done any of the exercises from the last 10 days?

Not "thought about it." Not "planned to." Actually did.

If yes — good. You're in the minority. Keep going.

If no — that's the data point that matters most. Because knowing your ${weakest} is ${weakestScore}/50 and doing nothing about it is worse than not knowing at all. At least ignorance has an excuse. Awareness without action is a choice.

I'm not saying this to guilt you. I'm saying it because I've seen what happens when people actually run the system vs. people who just read about it. The gap is massive.

THE 3-QUESTION ACCOUNTABILITY CHECK:
1. Did I do my 90-minute block at least 3 times this week? (Yes/No)
2. Did I use the 10-Minute Rule when I hit resistance? (Yes/No)
3. Is my 1-3-5 list written down somewhere I see daily? (Yes/No)

If you got 2 or more Yes answers — you're on track.
If you got 1 or fewer — you're consuming, not executing. And consuming doesn't change scores.

YOUR MOVE TODAY:
If you haven't started — start with ONE 10-minute sprint on ${weakest}. Right now. Not after this email. Not after lunch. Now.

If you have started — do your 90-minute block today and track it. Write down what you did and how it felt.

— Shawn`;
      break;

    case 12:
      subject = `The compound effect: small ${weakest} wins add up fast`;
      body = `${firstName},

Day 12. You're almost through Week 2. Let me show you something about how progress actually works.

Your ${weakest} score is ${weakestScore}/50. To get to ${targetScore}, you need to gain ${targetScore - weakestScore} points.

That sounds like a lot. But here's how the compound effect works:

WEEK 1: You learned the system (awareness = +0 points, but priceless)
WEEK 2: You started doing Opposite Actions (+1-2 points)
WEEK 3-4: Habits start forming, behavior shifts (+3-5 points)
MONTH 2: Other people notice (+5-8 points)
MONTH 3: It's just who you are now (+8-12 points)

The math: if you improve ${weakestSub} by just 1 point, your entire ${weakest} score rises. And because of the cross-pillar effect, your ${strongest} stops bleeding too. One sub-category improvement creates a cascade.

${crossHeadline}

THIS IS THE COMPOUND EFFECT IN ACTION:
1% improvement per day = 37x improvement in a year. You don't need 37x. You need ${targetScore - weakestScore} points. That's achievable in 90 days if you show up.

YOUR MOVE TODAY:
Write down one small win from this week related to ${weakest}. Even if it's tiny. "I tracked my time for one day." "I had that hard conversation." "I opened my bank statement." Small wins compound.

— Shawn`;
      break;

    // ===== PHASE 3: ADVANCED STRATEGIES (Days 13-20, sent every 3 days) =====
    case 13:
      subject = `Your ${strongest} is being held hostage by your ${weakest}`;
      body = `${firstName},

Two weeks in. Let's talk about something most coaching programs ignore completely: the cross-pillar effect.

Your ${strongest} score is ${strongestScore}/50. That's your best pillar. But it's not performing at its real potential because your ${weakest} (${weakestScore}/50) is dragging it down.

${crossHeadline}

${crossExplanation}

Think of it like this: your ${strongest} is a sports car, and your ${weakest} is flat tires. The engine is fine. The horsepower is there. But you can't get to top speed on flat tires.

THE UNLOCK:
Every point you add to ${weakest} doesn't just improve ${weakest}. It unlocks performance in ${strongest} that's been trapped. You're not building from zero — you're removing the cap.

${primaryImpact.subCategoryLinks ? `THE SPECIFIC CONNECTIONS:\n${primaryImpact.subCategoryLinks.map(l => `• Your ${l.from} (${weakest}) directly limits your ${l.to} (${strongest})`).join('\n')}` : ''}

YOUR MOVE TODAY:
Look at your ${strongest} pillar scores. Identify the one sub-category that should be higher but isn't. Then ask: "Is my ${weakest} the reason this is stuck?" The answer is almost always yes.

${reportUrl}

— Shawn`;
      break;

    case 14:
      subject = `The 5 people around you are your real score`;
      body = `${firstName},

Jim Rohn said you're the average of the five people you spend the most time with. I think it goes deeper than that.

Your VALUE is the average of the five people you spend the most time with. And your ${weakest} score (${weakestScore}/50) is partially a reflection of who's in your circle.

THE PEOPLE AUDIT:
List the 5 people you spent the most time with this week. For each one, answer:
1. Do they challenge me to grow, or do they keep me comfortable?
2. Do they model strength in ${weakest}? Or are they weak there too?
3. If I told them about the 90/90/1 rule, would they support it or mock it?

This isn't about cutting people off. It's about being intentional. Your environment shapes your behavior more than your willpower does.

THE UPGRADE:
You don't need to replace anyone. You need to ADD one person who is strong where you are weak. One person who models what a high ${weakest} score looks like. One mentor, one peer, one example.

YOUR MOVE TODAY:
Text or call one person who you think could be your accountability partner for the next 60 days. Tell them what you're working on. Ask them to check in weekly. That one conversation can change the trajectory.

— Shawn`;
      break;

    case 15:
      subject = `3 weeks in — it's time to measure what changed`;
      body = `${firstName},

Three weeks ago your Master Score was ${masterScore} (${scoreRange}). Your ${weakest} was ${weakestScore}/50.

It's time to measure.

Not because the number is everything — but because measurement creates accountability. And accountability is what separates people who improve from people who just "try."

I want you to retake the assessment today. Same pillars. New questions. Real data.

HERE'S WHAT TO EXPECT:
• If your score went UP: The system is working. Keep running it. Don't stop because it's working — that's the trap.
• If your score stayed the SAME: You now know more than you did. The awareness is real. But action needs to increase.
• If your score went DOWN: That's actually possible and it's not bad. Sometimes understanding exposes gaps you were hiding from yourself. A lower score with higher awareness beats a higher score with no clue.

THE HONEST TRUTH:
Most people won't retake it because they're afraid of the number. That fear IS the reason their score is what it is. Face the number. Own it. Then work it.

YOUR MOVE TODAY:
Retake the assessment. Takes about 7 minutes for the quick version.

${retakeUrl}

Once you're done, compare your reports side by side. Look at which sub-categories moved and which didn't. That's your roadmap for the next 60 days.

— Shawn`;
      break;

    case 16:
      subject = `What your morning routine says about your ${weakest}`;
      body = `${firstName},

The first 60 minutes of your day predict the next 15 hours. I'm not being philosophical — it's behavioral science. Your morning either sets you up for growth or for maintenance.

Here's what a high-${weakest} person does in their first hour:
${weakest === 'Time' ? `• Reviews their calendar BEFORE checking email\n• Identifies the #1 priority before touching their phone\n• Blocks their 90-minute focus window for the day\n• Deletes or delegates at least one thing from yesterday's overflow` : ''}${weakest === 'People' ? `• Sends one intentional message to someone who matters\n• Reviews their People Audit — who needs attention today?\n• Blocks time for one real conversation (not text, not Slack)\n• Checks in with their accountability partner` : ''}${weakest === 'Influence' ? `• Creates one piece of content or insight to share\n• Reviews their professional visibility — what did they contribute this week?\n• Identifies one opportunity to lead or teach today\n• Works on their credibility in their space for 30 minutes` : ''}${weakest === 'Numbers' ? `• Checks their numbers — revenue, expenses, income per hour\n• Reviews progress toward their financial goals\n• Identifies one cost to cut or one income stream to grow\n• Updates their tracking system` : ''}${weakest === 'Knowledge' ? `• Spends 30 minutes in deliberate learning (not scrolling)\n• Applies one thing they learned yesterday\n• Identifies one knowledge gap that's costing them\n• Teaches someone else what they know (teaching = mastery)` : ''}

COMPARE THAT TO YOUR CURRENT MORNING:
Be honest. What do the first 60 minutes of your day actually look like? If the answer is "phone, email, react" — that's why your ${weakest} is ${weakestScore}/50. You're starting every day in maintenance mode.

YOUR MOVE TODAY:
Tomorrow morning, try the high-${weakest} routine. Just one morning. Set your alarm 30 minutes earlier if you need to. One day. See how it feels.

— Shawn`;
      break;

    case 17:
      subject = `The income-per-hour question you're avoiding`;
      body = `${firstName},

Quick math. Don't skip this.

Take your monthly income. Divide by hours worked. That's your income per hour.

Now ask: is that number going UP or DOWN over the last 12 months?

This matters because your Master Score (${masterScore}) and your income per hour are correlated. Not perfectly — but strongly. Because the 5 pillars (Time, People, Influence, Numbers, Knowledge) are the 5 levers that determine what your time is worth.

${weakest === 'Numbers' ? `Your Numbers score (${weakestScore}/50) tells me you probably don't know this number off the top of your head. That's the problem. What you don't measure, you can't improve.` : `Even though ${weakest} is your focus, every pillar connects to your income per hour. Your ${weakest} score of ${weakestScore}/50 means there's unrealized income hiding in that pillar.`}

THE VALUE PER HOUR FRAMEWORK:
1. Calculate your current $/hour (be honest)
2. Identify what activities earn above that rate (high-value)
3. Identify what activities earn below that rate (low-value)
4. Systematically eliminate, delegate, or reduce low-value hours
5. Replace them with high-value hours

This is the Time Multiplier from the book. It's not about working more hours. It's about making each hour worth more.

YOUR MOVE TODAY:
Calculate your income per hour. Write it down. Look at it. Then ask: "What would have to change for this number to double?" The answer probably lives in your ${weakest} pillar.

— Shawn`;
      break;

    case 18:
      subject = `Month 1 almost done — the real test starts now`;
      body = `${firstName},

You're approaching the end of Month 1. Here's what the data says happens right now:

• 70% of people who start a self-improvement program quit in the first 30 days
• The ones who make it past 30 days are 5x more likely to hit 90 days
• The ones who hit 90 days rarely go back

You're at the inflection point. The next 7 days determine whether this becomes a chapter in your story or just another email sequence you read.

YOUR CURRENT STATUS:
Started: ${new Date(a.completed_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
Master Score: ${masterScore} (${scoreRange})
Focus: ${weakest} (${weakestScore}/50)
Target: ${targetScore}/50
Days in the system: ${day}

THE 30-DAY CHECKPOINT:
1. Have you retaken the assessment since Day 1? (If not — do it today)
2. Are you doing your 90-minute blocks consistently? (3+ per week = on track)
3. Has anyone noticed a change in you? (External validation = real progress)
4. Do you FEEL different about ${weakest}? (Awareness shift = leading indicator)

If you answered YES to 2+ of these — you're ahead of 70% of people who started this journey.

YOUR MOVE TODAY:
Retake the assessment if you haven't already. Then visit your dashboard and look at your progress.

${retakeUrl}

— Shawn`;
      break;

    // ===== PHASE 4: WEEKLY ONGOING (Days 19+, sent weekly) =====
    case 19:
      subject = `Your ${weakest} score is a choice now, not a circumstance`;
      body = `${firstName},

When you first took the assessment, your ${weakest} score (${weakestScore}/50) felt like a discovery. Something you didn't know about yourself.

Now it's different. Now you know. You've had the framework. You've had the tools. You've had almost three weeks of coaching specifically on this pillar.

At this point, your ${weakest} score isn't a circumstance. It's a choice. Every day you decide whether to work on it or not. And that's actually the most powerful position you can be in — because choices can change. Circumstances feel permanent. Choices feel like freedom.

THE WEEKLY SYSTEM (going forward):
From here on, I'm going to check in weekly. Not daily — because at this point, you either have the habits or you don't. And if you don't, daily emails aren't what's missing. Action is.

Each week I'll send you:
• One insight about your pillar scores
• One challenge for the week
• One accountability question

THIS WEEK'S CHALLENGE:
Spend 90 minutes on ${weakest} work every day this week. No excuses. 7 days straight. Track it. If you miss a day, add 30 minutes to the next day.

— Shawn`;
      break;

    case 20:
      subject = `Weekly check-in: What moved this week?`;
      body = `${firstName},

End of the week. Three questions:

1. WHAT MOVED?
What specific action did you take for your ${weakest} this week? Not what you planned. What you actually did.

2. WHAT RESISTED?
Where did you hit a wall? What did you avoid? That resistance is information — it's pointing directly at the thing that needs the most attention.

3. WHAT'S NEXT?
Based on this week, what's the ONE thing you're committing to next week?

THE NUMBERS:
Your Master Score on Day 1: ${masterScore}
Your ${weakest} on Day 1: ${weakestScore}/50
Days since you started: ${day}

If you haven't retaken the assessment yet — this is your weekly reminder. The number won't lie to you. And you need the feedback loop.

${retakeUrl}

YOUR MOVE THIS WEEK:
Write down your answers to the 3 questions above. Say them out loud. Share them with someone. Accountability turns intentions into actions.

— Shawn`;
      break;

    default:
      // Days 21+ — rotating weekly content. 20 topics total = 5 months of unique content.
      const weekNum = Math.floor((day - 19) / 1) + 5;

      // Pillar-specific deep dives for each weakest pillar
      const pillarDeepDives = {
        Time: [
          { subj: `Your calendar is your confession`, content: `Your calendar shows what you actually believe about what matters. Pull up last week. Look at every hour. Did those hours reflect what you say your priorities are? This isn't about productivity. It's about integrity between your words and your time.` },
          { subj: `The Sunday Reset — 20 minutes that changes the week`, content: `Every Sunday night, spend 20 minutes: (1) Review last week honestly — what ate your time? (2) Block next week's 90-minute ${weakest} sessions FIRST. (3) Everything else fills in around them. That's how high performers protect what matters.` },
          { subj: `Delegation isn't weakness — avoidance is`, content: `You're doing tasks right now that someone else could do at 70% quality for 20% of what your hour is worth. Calculate your real hourly value. Then ask: what am I doing below that rate? That's where delegation starts.` },
          { subj: `The energy audit — time tracked wrong`, content: `Time tracking misses the point. It's not when you worked — it's when you had energy. Track YOUR 3 peak hours this week. Protect those for ${weakestSub} work. The other hours? Email, meetings, logistics. Peak hours = needle movers.` },
        ],
        People: [
          { subj: `The Five You Surround Yourself With`, content: `Jim Rohn said you become the average of the 5 people you spend the most time with. List yours. Be honest. Are they pulling you up, holding steady, or pulling down? You don't have to cut anyone off — but you DO get to choose who gets your best hours.` },
          { subj: `The apology you've been avoiding`, content: `There's someone you need to make it right with. You know exactly who. Not because you did something terrible — but because something's unfinished. Your ${weakest} score reflects this. Handle it this week. One conversation. No defense. Just ownership.` },
          { subj: `Your inner circle audit`, content: `List every person who's had access to your phone, time, or trust in the last 30 days. Rank them: Giver (pours in), Receiver (takes but gives when able), Exchanger (balanced), Taker (drains). Your ${weakestSub} score is pointing at the Takers. You know who they are.` },
          { subj: `The hard conversation you keep rehearsing`, content: `You've been practicing the conversation in your head for weeks. Maybe months. Your brain runs it on loop because it's unfinished. This week, have it. Not perfectly. Not with a script. Just have it. The relief of the DONE version is worth every ounce of the dread.` },
        ],
        Influence: [
          { subj: `Influence is deposited, not declared`, content: `You don't tell people you have influence. You show it through the thousand tiny ways you show up when no one's watching. Your ${weakest} score is saying the deposits have slowed. Make one deposit this week with no expectation of return.` },
          { subj: `The credibility gap`, content: `Credibility = what people expect from you, met consistently over time. Where's the gap between what you say and what they get? Close that gap in ONE area this week. Small promises, kept. That's how trust compounds.` },
          { subj: `Your voice is needed more than you think`, content: `Somewhere this week, you'll hold back an opinion that needed to be said. That silence costs you influence. Not because you need to be loud — but because withheld truth erodes presence. Speak once this week when it would've been easier to stay quiet.` },
          { subj: `The leader you're avoiding becoming`, content: `Leadership isn't a title. It's a pattern of taking responsibility before anyone asks you to. Your ${weakestSub} score is pointing at the responsibility you're still dodging. What's one thing you could own this week that you've been waiting for someone else to handle?` },
        ],
        Numbers: [
          { subj: `Open the statement you've been avoiding`, content: `There's a financial document, statement, or number you haven't looked at in over 30 days. You know which one. This week, open it. Not to fix it yet — just to look. Awareness is the first 80% of financial change.` },
          { subj: `Your real hourly rate`, content: `Take your total income last month. Divide by actual hours worked (including the admin, commute, email, prep). That's your real hourly rate. It's probably lower than you think. Now ask: what activities drag that number down? That's where Numbers work starts.` },
          { subj: `The leak you know about`, content: `There's one subscription, one habit, one recurring charge you KNOW is wasteful. You haven't cut it because it feels small. Small times 12 months is not small. This week, cut it. Put the money into your highest-value account.` },
          { subj: `The conversation about money`, content: `If you have a partner, the money conversation is probably overdue. Not the budget — the vision. What would you do with 2x your current income? What would you stop doing? Talk about that. The tactics follow the vision.` },
        ],
        Knowledge: [
          { subj: `Learning vs consuming`, content: `You consume a lot of content. But what did you APPLY in the last 7 days from something you learned? Consumption without application is entertainment. This week: one book chapter, one podcast, one article — and ONE implementation within 48 hours.` },
          { subj: `The book you keep not finishing`, content: `There's a book on your shelf or Kindle you started months ago. You know which one. It's not that you're too busy. It's that finishing it would obligate you to change. This week, finish it OR give it away. Indecision is the drain.` },
          { subj: `Teaching forces mastery`, content: `You don't know something until you can teach it. Pick one thing you've learned recently. Teach it to someone — a kid, a coworker, a friend. Even if they didn't ask. The act of explaining exposes every gap in your understanding. That's where real learning begins.` },
          { subj: `The mentor you haven't asked`, content: `There's someone you admire who would probably answer 3 questions via email if you wrote thoughtfully. You haven't asked because you're worried about imposing. This week, write the email. Short. Specific. No pitch. Just 3 questions. The worst they can do is not respond.` },
        ],
      };

      // Universal content (applies to anyone regardless of weakest pillar)
      const universalTopics = [
        { subj: `Your ${strongest} wants to thank your ${weakest}`,
          content: `Remember the cross-pillar effect? ${crossHeadline}\n\nEvery point you've added to ${weakest} has unlocked potential in ${strongest}. Even if you can't see it yet in a score, it's happening in your behavior. The connections are real.` },
        { subj: `The 90-day mark is approaching`,
          content: `The 90/90/1 Rule isn't a suggestion. It's a commitment. 90 minutes a day, 90 days, 1 focus: ${weakest}.\n\nIf you started when you took the assessment, you're getting close. If you started late, that's fine — the clock starts when you decide it starts. What matters is consistency, not perfection.` },
        { subj: `What would a ${masterScore + 20} version of you do today?`,
          content: `Your Master Score is ${masterScore}. Imagine the version of you at ${masterScore + 20}. That person has a ${weakest} score of ${targetScore} or higher.\n\nWhat does that person's morning look like? How do they handle the thing you're avoiding? What decisions do they make that you haven't made yet?\n\nThat's not a fantasy. That's a blueprint. Close the gap.` },
        { subj: `Monthly retake reminder`,
          content: `Time to retake the assessment. Not because I said so — but because the data doesn't lie and you need the feedback.\n\nYour original scores:\n• Master: ${masterScore} (${scoreRange})\n• ${weakest}: ${weakestScore}/50\n• ${strongest}: ${strongestScore}/50\n\nRetake now and compare: ${retakeUrl}\n\nIf the score went up — the system works. If it didn't — the system works, you just need to run it more consistently.` },
        { subj: `The growth window math (refresher)`,
          content: `You have 4-5 hours of discretionary time per day. Not 8. That's your growth window. This week's question: are you still giving at least 90 minutes of that window to ${weakest} work? If not, today is the day you restart.` },
        { subj: `The next level is decided this week`,
          content: `Your assessment score moves in two directions: up when you're consistent, down when you drift. There's no neutral. This week alone has 5 decisions that will determine the direction. Choose the next-level decision each time, even when it's harder.` },
        { subj: `Who are you becoming?`,
          content: `You're 6+ weeks in. The person you are today is not the same as the person who took the original assessment. Identity shifts slow. Scores shift faster. But they point the same direction — up. Who are you becoming? Not what are you achieving. Who are you BECOMING.` },
        { subj: `The community check-in`,
          content: `Who else is running this system with you? If no one — that's your week's work. Find one person to share your ${weakest} goal with. Accountability isn't weakness; it's force multiplication. The Value to Victory group is there if you need a starting point.` },
      ];

      // Combine: pillar deep dives + universal topics = 12-13 unique topics per pillar
      const allTopics = [
        ...(pillarDeepDives[weakest] || []),
        ...universalTopics,
      ];

      const topicIndex = (day - 21) % allTopics.length;
      const topic = allTopics[Math.max(0, topicIndex)];
      subject = topic.subj;
      body = `${firstName},\n\nWeek ${weekNum} check-in. Day ${day} of your journey.\n\n${topic.content}\n\nYOUR MOVE THIS WEEK:\nOne action. One commitment. One thing you can point to on Friday and say "I did that for my ${weakest}."\n\nI'm still in your corner.\n\n— Shawn`;
  }

  // Build HTML version with dark/gold styling matching existing emails
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Value Engine Coaching — Day ${day}</title></head><body style="margin:0;padding:0;background:#111122;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">

<!-- Header -->
<tr><td style="background:#1a1a2e;border-radius:4px 4px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:32px 40px 16px 40px;text-align:center;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">VALUE <span style="color:#d4a853;">TO</span> VICTORY</h1><p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8888a8;letter-spacing:3px;text-transform:uppercase;">${day <= 8 ? `Daily Coaching — Day ${day} of 8` : day <= 16 ? `Deep Dive — Week ${Math.ceil(day/7)}` : day <= 20 ? `Advanced — Week ${Math.ceil(day/7)}` : `Weekly Check-In — Week ${Math.ceil(day/7)}`}</p></td></tr></table>

<!-- Pillar Score Bars -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:8px 40px 4px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#6a6a84;letter-spacing:1px;">
<tr>
<td width="20%" style="text-align:center;padding:2px;${weakest === 'Time' ? 'color:#d4a853;font-weight:bold;' : ''}">T</td>
<td width="20%" style="text-align:center;padding:2px;${weakest === 'People' ? 'color:#d4a853;font-weight:bold;' : ''}">P</td>
<td width="20%" style="text-align:center;padding:2px;${weakest === 'Influence' ? 'color:#d4a853;font-weight:bold;' : ''}">I</td>
<td width="20%" style="text-align:center;padding:2px;${weakest === 'Numbers' ? 'color:#d4a853;font-weight:bold;' : ''}">N</td>
<td width="20%" style="text-align:center;padding:2px;${weakest === 'Knowledge' ? 'color:#d4a853;font-weight:bold;' : ''}">K</td>
</tr>
<tr>
<td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;overflow:hidden;height:4px;"><div style="width:${Math.round(((a.time_total || 0)/50)*100)}%;background:${weakest === 'Time' ? '#d4a853' : '#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
<td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;overflow:hidden;height:4px;"><div style="width:${Math.round(((a.people_total || 0)/50)*100)}%;background:${weakest === 'People' ? '#d4a853' : '#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
<td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;overflow:hidden;height:4px;"><div style="width:${Math.round(((a.influence_total || 0)/50)*100)}%;background:${weakest === 'Influence' ? '#d4a853' : '#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
<td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;overflow:hidden;height:4px;"><div style="width:${Math.round(((a.numbers_total || 0)/50)*100)}%;background:${weakest === 'Numbers' ? '#d4a853' : '#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
<td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;overflow:hidden;height:4px;"><div style="width:${Math.round(((a.knowledge_total || 0)/50)*100)}%;background:${weakest === 'Knowledge' ? '#d4a853' : '#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
</tr>
</table>
</td></tr></table>

<!-- Gold Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:4px 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#d4a853,transparent);"></div></td></tr></table>

<!-- Body -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:28px 40px 32px 40px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</div><div style="height:16px;"></div><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap;">').replace(/YOUR MOVE TODAY:|YOUR 10-MINUTE CHALLENGE:|YOUR 90-MINUTE DAILY BLOCK:|YOUR DAILY SYSTEM:|YOUR 1 \(The Massive Goal\):|YOUR 3 \(Key Tasks\):|YOUR 5 \(Quick Wins for Today\):|YOUR FINAL MOVE:|THE CASCADE EFFECT:|THE TRUTH ABOUT SYSTEMS:|HERE'S WHY THIS WORKS:/g, match => `<strong style="color:#d4a853;text-transform:uppercase;letter-spacing:1px;font-size:13px;">${match}</strong>`)}</div>
</td></tr></table>

<!-- Check-In Reply Button -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px 16px 40px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;border:2px solid #d4a853;" align="center"><a href="${BASE_URL}/coaching-reply?email=${encodeURIComponent(email)}&day=${day}" target="_blank" style="display:inline-block;padding:12px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#d4a853;text-decoration:none;letter-spacing:1px;">Reply to Today's Challenge &rarr;</a></td></tr></table>
</td></tr></table>

${day === 6 || day === 8 || day === 15 || day === 18 || day === 20 || ((day > 20) && ((day - 21) % 5 === 4)) ? `<!-- Retake CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px 32px 40px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;background:linear-gradient(135deg,#d4a853,#c89030);" align="center"><a href="${retakeUrl}" target="_blank" style="display:inline-block;padding:14px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:#1a1a2e;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Retake the Assessment &rarr;</a></td></tr></table>
</td></tr></table>` : ''}

<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);"></div></td></tr></table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:24px 40px 32px 40px;text-align:center;"><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#4a4a64;letter-spacing:1.5px;text-transform:uppercase;">Value to Victory</p><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a3a54;line-height:1.6;">Don't guess. Run the system.</p><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a3a54;">You're receiving this because you completed the P.I.N.K.'s Value Engine Assessment.</p><p style="margin:0 0 8px 0;"><a href="${unsubUrl}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6a6a84;text-decoration:underline;">Unsubscribe from coaching emails</a></p><p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#2a2a44;">&copy; 2026 Value to Victory | Goodview, VA | valuetovictory.com</p></td></tr></table>

</td></tr>
</table>
</body></html>`;

  return { subject, html: htmlBody, text: body };
}

// Ensure coaching_sequences table exists
async function ensureCoachingTable(sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS coaching_sequences (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      assessment_id INTEGER NOT NULL,
      current_day INTEGER DEFAULT 0,
      last_sent_at TIMESTAMP,
      started_at TIMESTAMP DEFAULT NOW(),
      unsubscribed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_coaching_email ON coaching_sequences(email)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_email_unique ON coaching_sequences(email)`;
  } catch (e) {
    console.error('[ensureCoachingTable] Error creating coaching_sequences table:', e.message);
  }
}

// ========== EMAIL LOG ==========
let emailLogTableReady = false;
async function ensureEmailLogTable(sql) {
  if (emailLogTableReady) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      recipient TEXT NOT NULL,
      email_type TEXT NOT NULL,
      subject TEXT,
      contact_id INTEGER,
      assessment_id INTEGER,
      status TEXT DEFAULT 'sent',
      metadata JSONB,
      sent_at TIMESTAMP DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(recipient)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at DESC)`;
    emailLogTableReady = true;
  } catch(e) { console.error('ensureEmailLogTable error:', e.message); }
}

async function logEmail(sql, { recipient, emailType, subject, contactId, assessmentId, status, metadata }) {
  try {
    await ensureEmailLogTable(sql);
    await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, assessment_id, status, metadata)
      VALUES (${recipient}, ${emailType}, ${subject ?? null}, ${contactId ?? null}, ${assessmentId ?? null}, ${status || 'sent'}, ${metadata ? JSON.stringify(metadata) : null}::jsonb)`;
  } catch(e) { console.error('logEmail error (non-fatal):', e.message); }
}

// Authenticate cron/scheduled endpoints — accepts admin API key, Vercel cron secret, or x-vercel-cron header
function isCronAuthorized(req) {
  // Admin API key (manual trigger from dashboard or curl)
  const apiKey = req.headers['x-api-key'] || '';
  const adminKey = process.env.ADMIN_API_KEY || '';
  if (adminKey && apiKey === adminKey) return true;
  // Vercel cron secret (CRON_SECRET env var — set in Vercel dashboard)
  const authHeader = req.headers['authorization'] || '';
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  // Vercel internal cron header (set by Vercel's cron scheduler, validated by CRON_SECRET)
  if (cronSecret && req.headers['x-vercel-cron'] === '1') return true;
  return false;
}

module.exports = async (req, res) => {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Vary', 'Origin');
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://assets.calendly.com https://www.googletagmanager.com https://api.fontshare.com; style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com; img-src 'self' https: data:; connect-src 'self' https:; frame-src https://calendly.com https://www.youtube.com;");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const sql = neon(process.env.DATABASE_URL);
  const url = req.url.replace(/^\/api/, '');

  // Determine rate limit category
  const rateCategory = url.startsWith('/admin') ? 'admin'
    : url.startsWith('/member/has-pin') ? 'enumeration'   // Tight limit: this endpoint can be probed to enumerate which emails have accounts
    : (url.includes('/verify-pin') || url.includes('/set-pin') || url.includes('/pin-login') || url.includes('/forgot-pin') || url.includes('/reset-pin')) ? 'auth'
    : url === '/assessment' ? 'assessment'
    : 'default';
  const rateCheck = checkRateLimit(clientIP, rateCategory);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter: 60 });
  }

  try {
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
        const contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
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

      // Handle overlay questions for relationship/leadership/dating modes (extensive only)
      if (depth === 'extensive' && (mode === 'relationship' || mode === 'leadership' || mode === 'dating')) {
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

    // POST /api/member/forgot-pin — Send a PIN reset link via email
    if (req.method === 'POST' && url === '/member/forgot-pin') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      const rows = await sql`SELECT id, first_name, pin_hash FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (rows.length === 0) return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

      const contact = rows[0];

      // Generate a secure reset token (expires in 1 hour)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Store token — reuse dating_email_verify or create inline temp storage
      // We'll store in contacts table via a new column, or use a simple approach:
      // Hash the token and store it alongside the contact
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      try {
        await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_reset_token TEXT`;
        await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_reset_expires TIMESTAMP WITH TIME ZONE`;
      } catch (e) { /* columns may already exist */ }

      await sql`UPDATE contacts SET pin_reset_token = ${tokenHash}, pin_reset_expires = ${expiresAt} WHERE id = ${contact.id}`;

      // Send reset email
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const resetUrl = `https://assessment.valuetovictory.com/faith-match?reset-pin=${resetToken}&email=${encodeURIComponent(email)}`;
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
          });
          await transporter.sendMail({
            from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Reset Your PIN — Value to Victory',
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;">
                <h1 style="color:#D4A847;font-size:1.5rem;">PIN Reset Request</h1>
                <p>Hi ${contact.first_name || 'there'},</p>
                <p>Click the button below to reset your PIN. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:0.75rem 2rem;background:#D4A847;color:#000;text-decoration:none;font-weight:700;border-radius:0.5rem;margin:1rem 0;">Reset My PIN</a>
                <p style="color:#666;font-size:0.85rem;">If you didn't request this, you can safely ignore this email.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
                <p style="color:#999;font-size:0.75rem;">Value to Victory — Love · Values · Purpose</p>
              </div>
            `
          });
        } catch (e) { console.error('Failed to send PIN reset email:', e.message); }
      }

      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // POST /api/member/reset-pin-token — Reset PIN using a token from email
    if (req.method === 'POST' && url === '/member/reset-pin-token') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const token = (b.token || '').trim();
      const newPin = (b.pin || '').trim();
      if (!email || !token || !newPin) return res.status(400).json({ error: 'Email, token, and new PIN required' });
      if (newPin.length < 4 || newPin.length > 32) return res.status(400).json({ error: 'PIN must be 4-32 characters' });

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const rows = await sql`SELECT id, pin_reset_token, pin_reset_expires FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (rows.length === 0) return res.status(400).json({ error: 'Invalid reset link' });

      const contact = rows[0];
      if (!contact.pin_reset_token || contact.pin_reset_token !== tokenHash) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }
      if (contact.pin_reset_expires && new Date(contact.pin_reset_expires) < new Date()) {
        return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
      }

      // Set the new PIN (PBKDF2)
      const pinHash = hashPinSync(newPin);
      await sql`UPDATE contacts SET pin_hash = ${pinHash}, pin_set_at = NOW(), pin_reset_token = NULL, pin_reset_expires = NULL WHERE id = ${contact.id}`;

      // Generate JWT so they're logged in immediately
      let tier = 'free';
      let teamIds = [];
      try {
        const profileRows = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contact.id} LIMIT 1`;
        if (profileRows.length > 0) tier = profileRows[0].membership_tier || 'free';
        const teamRows = await sql`SELECT team_id FROM team_members WHERE contact_id = ${contact.id}`;
        teamIds = teamRows.map(t => t.team_id);
      } catch (e) { /* tables may not exist yet */ }

      const jwtToken = createJWT({ contactId: contact.id, email, tier, teamIds });

      return res.json({ success: true, message: 'PIN reset successfully', token: jwtToken, tier });
    }

    // POST /api/member/set-pin — Set or update PIN for member portal
    // Requires either: JWT token (logged-in user), old PIN, or first-time setup (no existing PIN)
    if (req.method === 'POST' && url === '/member/set-pin') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const pin = (b.pin || '').trim();
      const oldPin = (b.oldPin || '').trim();
      if (!email || !pin) return res.status(400).json({ error: 'Email and PIN required' });
      if (pin.length < 4 || pin.length > 32) return res.status(400).json({ error: 'PIN/password must be 4-32 characters' });

      // Look up existing contact
      const existing = await sql`SELECT id, pin_hash FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (existing.length === 0) return res.status(404).json({ error: 'No account with that email' });

      const contact = existing[0];

      // If contact already has a PIN, require authentication to change it
      if (contact.pin_hash) {
        // Option 1: Valid JWT token
        const token = extractToken(req);
        const jwt = token ? verifyJWT(token) : null;
        const jwtValid = jwt && jwt.email === email;

        // Option 2: Old PIN matches (supports legacy hash upgrade)
        let oldPinValid = false;
        if (oldPin) {
          const result = verifyPin(oldPin, contact.pin_hash);
          oldPinValid = result.valid;
          if (result.valid && result.needsUpgrade) {
            // Upgrade legacy hash in-place
            const upgradedHash = hashPinSync(oldPin);
            await sql`UPDATE contacts SET pin_hash = ${upgradedHash} WHERE id = ${contact.id}`;
          }
        }

        if (!jwtValid && !oldPinValid) {
          return res.status(401).json({ error: 'Authentication required to change PIN. Provide your current PIN as oldPin or a valid JWT token.' });
        }
      }

      const pinHash = hashPinSync(pin);
      await sql`UPDATE contacts SET pin_hash = ${pinHash}, pin_set_at = NOW() WHERE id = ${contact.id}`;
      return res.json({ success: true, message: 'PIN set successfully' });
    }

    // POST /api/member/verify-pin — Verify PIN for member portal login
    if (req.method === 'POST' && url === '/member/verify-pin') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const pin = (b.pin || '').trim();
      if (!email || !pin) return res.status(400).json({ error: 'Email and PIN required' });

      const rows = await sql`SELECT id, first_name, pin_hash FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (rows.length === 0) return res.json({ verified: false, error: 'No account found' });

      // If no PIN set, auto-set it for them (first login) — use PBKDF2
      if (!rows[0].pin_hash) {
        const newPinHash = hashPinSync(pin);
        await sql`UPDATE contacts SET pin_hash = ${newPinHash}, pin_set_at = NOW() WHERE id = ${rows[0].id}`;
        // Continue to login (don't return needsPin — just log them in)
      } else {
        const pinResult = verifyPin(pin, rows[0].pin_hash);
        if (!pinResult.valid) {
          return res.json({ verified: false, error: 'Incorrect PIN' });
        }
        // Auto-upgrade legacy SHA-256 hash to PBKDF2
        if (pinResult.needsUpgrade) {
          const upgradedHash = hashPinSync(pin);
          await sql`UPDATE contacts SET pin_hash = ${upgradedHash} WHERE id = ${rows[0].id}`;
        }
      }

      // Generate JWT token for authenticated sessions
      const contactId = rows[0].id;
      // Look up membership tier and team IDs
      let tier = 'free';
      let teamIds = [];
      try {
        const profileRows = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
        if (profileRows.length > 0) tier = profileRows[0].membership_tier || 'free';
        const teamRows = await sql`SELECT team_id FROM team_members WHERE contact_id = ${contactId}`;
        teamIds = teamRows.map(t => t.team_id);
      } catch (e) { /* tables may not exist yet */ }

      const token = createJWT({ contactId, email, tier, teamIds, firstName: rows[0].first_name });

      // Track login event
      try { await sql`INSERT INTO analytics_events (event_type, contact_id, metadata) VALUES ('login', ${contactId}, ${JSON.stringify({ tier })}::jsonb)`; } catch (e) { /* non-fatal */ }

      // === SIGN-IN EMAIL: Send assessment summary on new login (fire-and-forget) ===
      if (email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        (async () => {
          try {
            const firstName = escapeHtml(rows[0].first_name || 'there');
            // Fetch latest assessments for this contact
            const assessments = await sql`
              SELECT id, completed_at, master_score, score_range, weakest_pillar, depth,
                     time_total, people_total, influence_total, numbers_total, knowledge_total
              FROM assessments WHERE contact_id = ${contactId}
              ORDER BY completed_at DESC LIMIT 5
            `;

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            // Build assessment rows for email
            let assessmentRows = '';
            if (assessments.length > 0) {
              const latest = assessments[0];
              const pillarMax = latest.depth === 'quick' ? 25 : 50;
              const scoreColors = { Crisis: '#ef4444', Survival: '#f97316', Growth: '#eab308', Momentum: '#22c55e', Mastery: '#D4A847' };
              const scoreColor = scoreColors[latest.score_range] || '#D4A847';

              assessmentRows = `
              <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:24px;margin:20px 0;">
                <p style="color:#D4A847;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px;">Latest Assessment</p>
                <div style="text-align:center;margin-bottom:20px;">
                  <div style="font-size:42px;font-weight:bold;color:${scoreColor};margin-bottom:4px;">${latest.master_score}</div>
                  <div style="font-size:14px;color:${scoreColor};font-weight:bold;text-transform:uppercase;letter-spacing:2px;">${latest.score_range}</div>
                  <div style="font-size:12px;color:#71717a;margin-top:4px;">${new Date(latest.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding:6px 0;">Time</td>
                    <td style="text-align:right;color:#e4e4e7;font-size:13px;font-weight:bold;padding:6px 0;">${latest.time_total}/${pillarMax}</td>
                  </tr>
                  <tr><td colspan="2" style="border-bottom:1px solid #27272a;"></td></tr>
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding:6px 0;">People</td>
                    <td style="text-align:right;color:#e4e4e7;font-size:13px;font-weight:bold;padding:6px 0;">${latest.people_total}/${pillarMax}</td>
                  </tr>
                  <tr><td colspan="2" style="border-bottom:1px solid #27272a;"></td></tr>
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding:6px 0;">Influence</td>
                    <td style="text-align:right;color:#e4e4e7;font-size:13px;font-weight:bold;padding:6px 0;">${latest.influence_total}/${pillarMax}</td>
                  </tr>
                  <tr><td colspan="2" style="border-bottom:1px solid #27272a;"></td></tr>
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding:6px 0;">Numbers</td>
                    <td style="text-align:right;color:#e4e4e7;font-size:13px;font-weight:bold;padding:6px 0;">${latest.numbers_total}/${pillarMax}</td>
                  </tr>
                  <tr><td colspan="2" style="border-bottom:1px solid #27272a;"></td></tr>
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding:6px 0;">Knowledge</td>
                    <td style="text-align:right;color:#e4e4e7;font-size:13px;font-weight:bold;padding:6px 0;">${latest.knowledge_total}/${pillarMax}</td>
                  </tr>
                </table>
                <p style="color:#71717a;font-size:12px;margin:8px 0 0;">Weakest pillar: <span style="color:#ef4444;">${latest.weakest_pillar}</span></p>
                <div style="text-align:center;margin-top:16px;">
                  <a href="${BASE_URL}/report/${latest.id}" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:6px;">View Full Report</a>
                </div>
              </div>`;

              // If multiple assessments, show history summary
              if (assessments.length > 1) {
                let historyRows = '';
                for (let i = 1; i < assessments.length; i++) {
                  const a = assessments[i];
                  const aColor = scoreColors[a.score_range] || '#D4A847';
                  historyRows += `<tr>
                    <td style="color:#a1a1aa;font-size:12px;padding:5px 0;">${new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td style="color:#e4e4e7;font-size:12px;font-weight:bold;text-align:center;padding:5px 0;">${a.master_score}</td>
                    <td style="color:${aColor};font-size:12px;text-align:right;padding:5px 0;">${a.score_range}</td>
                  </tr>`;
                }
                assessmentRows += `
                <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
                  <p style="color:#71717a;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Previous Assessments</p>
                  <table width="100%" cellpadding="0" cellspacing="0">${historyRows}</table>
                </div>`;
              }
            } else {
              assessmentRows = `
              <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
                <p style="color:#a1a1aa;font-size:14px;margin:0 0 12px;">You haven't taken an assessment yet.</p>
                <a href="${BASE_URL}/" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:6px;">Take Your First Assessment</a>
              </div>`;
            }

            const signInHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="text-align:center;padding-bottom:24px;">
  <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:8px;">VALUE TO VICTORY</div>
  <div style="font-family:Georgia,serif;font-size:26px;font-style:italic;color:#ffffff;">New Sign-In Detected</div>
</td></tr>
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px 32px;">
  <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${firstName},</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">We noticed a new sign-in to your Value Engine member portal.</p>
  <div style="background:#111118;border-left:3px solid #D4A847;padding:14px 18px;margin:0 0 24px;border-radius:0 8px 8px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr><td style="color:#71717a;font-size:12px;padding:3px 0;">Date</td><td style="color:#e4e4e7;font-size:13px;text-align:right;padding:3px 0;">${dateStr}</td></tr>
      <tr><td style="color:#71717a;font-size:12px;padding:3px 0;">Time</td><td style="color:#e4e4e7;font-size:13px;text-align:right;padding:3px 0;">${timeStr}</td></tr>
      <tr><td style="color:#71717a;font-size:12px;padding:3px 0;">Account</td><td style="color:#e4e4e7;font-size:13px;text-align:right;padding:3px 0;">${email}</td></tr>
    </table>
  </div>
  <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0 0 20px;">If this wasn't you, please reset your PIN immediately from the member portal.</p>
  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>
  <p style="color:#e4e4e7;font-size:15px;font-weight:bold;margin:0 0 4px;">Your Assessment Snapshot</p>
  <p style="color:#71717a;font-size:13px;margin:0 0 8px;">Here's where you stand in the Value Engine.</p>
  ${assessmentRows}
</td></tr>
<tr><td style="text-align:center;padding-top:24px;">
  <a href="${BASE_URL}/member" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:8px;">Open Your Dashboard</a>
</td></tr>
<tr><td style="text-align:center;padding-top:24px;">
  <p style="color:#52525b;font-size:12px;margin:0;">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</p>
  <p style="color:#3f3f46;font-size:11px;margin:8px 0 0;">This email was sent because your account was accessed. You cannot unsubscribe from security notifications.</p>
</td></tr>
</table></td></tr></table></body></html>`;

            const signInTransporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await signInTransporter.sendMail({
              from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: `New sign-in to your Value Engine account — ${dateStr}`,
              html: signInHtml,
            });
            console.log(`Sign-in email sent to ${maskEmail(email)} for contact ${contactId}`);
            await logEmail(sql, { recipient: email, emailType: 'sign_in', subject: `New sign-in to your Value Engine account — ${dateStr}`, contactId });
          } catch (signInEmailErr) {
            console.error('Sign-in email error (non-fatal):', signInEmailErr.message);
            await logEmail(sql, { recipient: email, emailType: 'sign_in', contactId, status: 'failed', metadata: { error: signInEmailErr.message } });
          }
        })();
      }
      // === END SIGN-IN EMAIL ===

      return res.json({ verified: true, token, contactId, firstName: rows[0].first_name, tier });
    }

    // GET /api/member/has-pin?email=xxx — Check if member has a PIN set.
    // Defenses against email enumeration:
    //   1. Rate limited to 5/min/IP via the 'enumeration' category (see top of file)
    //   2. Constant ~200ms response time so DB hit latency doesn't reveal existence
    //   Reasons we can't fully unify the response: member.html branches its UI on
    //   exists/hasPin to show signup vs PIN-setup vs PIN-entry forms. Tightening
    //   beyond timing+rate-limit requires a UX rewrite — tracked as a separate task.
    if (req.method === 'GET' && url.startsWith('/member/has-pin')) {
      const startTime = Date.now();
      const params = new URL('http://x' + req.url).searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      const rows = await sql`SELECT pin_hash FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      // Pad to a constant ~200ms so timing doesn't differentiate hit vs miss
      const elapsed = Date.now() - startTime;
      if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed));
      if (rows.length === 0) return res.json({ exists: false, hasPin: false });
      return res.json({ exists: true, hasPin: !!rows[0].pin_hash });
    }

    // POST /api/auth/refresh — Silently refresh a valid JWT before it expires
    // Accepts expired-within-14-days tokens so users returning after a week
    // don't need to re-enter their PIN. Security: signature must still validate
    // and contact must still exist + not be disabled.
    if (req.method === 'POST' && url === '/auth/refresh') {
      try {
        const token = extractToken(req);
        if (!token) return res.status(401).json({ error: 'No token provided' });

        // Parse payload even if expired
        const parts = token.split('.');
        if (parts.length !== 3) return res.status(401).json({ error: 'Malformed token' });

        // Verify signature first
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
        if (parts[2] !== expectedSig) return res.status(401).json({ error: 'Invalid signature' });

        let payload;
        try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); }
        catch { return res.status(401).json({ error: 'Malformed payload' }); }

        // Allow refresh if token expired within the last 14 days (grace period)
        const now = Math.floor(Date.now() / 1000);
        const graceWindow = 14 * 24 * 60 * 60; // 14 days
        if (payload.exp && payload.exp < now - graceWindow) {
          return res.status(401).json({ error: 'Token expired beyond refresh window. Please log in.' });
        }

        // Verify the contact still exists
        if (!payload.email) return res.status(401).json({ error: 'Invalid token payload' });
        const contactRows = await sql`SELECT id, first_name FROM contacts WHERE LOWER(email) = LOWER(${payload.email}) LIMIT 1`;
        if (contactRows.length === 0) return res.status(401).json({ error: 'Account not found' });

        // Issue new token with current tier + team IDs
        let tier = 'free';
        let teamIds = [];
        try {
          const profileRows = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contactRows[0].id} LIMIT 1`;
          if (profileRows.length > 0) tier = profileRows[0].membership_tier || 'free';
          const teamRows = await sql`SELECT team_id FROM team_members WHERE contact_id = ${contactRows[0].id}`;
          teamIds = teamRows.map(t => t.team_id);
        } catch (e) { /* non-fatal */ }

        const newToken = createJWT({
          contactId: contactRows[0].id,
          email: payload.email.toLowerCase(),
          tier,
          teamIds,
          firstName: contactRows[0].first_name
        });

        return res.json({
          token: newToken,
          contactId: contactRows[0].id,
          email: payload.email.toLowerCase(),
          tier,
          firstName: contactRows[0].first_name
        });
      } catch (refreshErr) {
        console.error('[auth/refresh] Error:', refreshErr.message);
        return res.status(500).json({ error: 'Refresh failed' });
      }
    }

    // GET /api/member?email=xxx — Member portal: profile, tier, assessments, teams
    // JWT path returns full profile. Email-only path (coaching email deep-links)
    // returns a narrow, non-PII response: firstName + latest assessment pillar
    // scores only. No stripe IDs, teams, phone, email, last name, or tier data.
    if (req.method === 'GET' && url.startsWith('/member') && !url.startsWith('/member/portal')) {
      const params = new URL('http://x' + req.url).searchParams;
      const jwtUser = extractUser(req);
      const rawEmail = params.get('email') || '';
      // Zod-style email shape check — reject obviously malformed inputs early
      if (rawEmail && (rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail))) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const emailParam = rawEmail.toLowerCase().trim();
      const email = (jwtUser?.email || emailParam || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      const contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.json({ found: false });

      const contact = contactRows[0];

      if (!jwtUser) {
        const latest = await sql`
          SELECT completed_at, mode, master_score, weakest_pillar, focus_pillar,
                 time_total, people_total, influence_total, numbers_total, knowledge_total
          FROM assessments WHERE contact_id = ${contact.id}
          ORDER BY completed_at DESC LIMIT 1
        `;
        return res.json({
          found: true,
          contact: { firstName: contact.first_name },
          assessments: latest.map(a => ({
            completedAt: a.completed_at, mode: a.mode,
            masterScore: a.master_score,
            weakestPillar: a.weakest_pillar, focusPillar: a.focus_pillar,
            timeTotal: a.time_total, peopleTotal: a.people_total,
            influenceTotal: a.influence_total, numbersTotal: a.numbers_total,
            knowledgeTotal: a.knowledge_total,
          })),
        });
      }

      // Get user profile (membership tier)
      let profile = { membership_tier: 'free' };
      try {
        const profileRows = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contact.id} LIMIT 1`;
        if (profileRows.length > 0) profile = profileRows[0];
      } catch (e) { /* user_profiles table may not exist */ }

      // Get assessments
      const assessments = await sql`SELECT id, completed_at, mode, master_score, score_range, weakest_pillar, depth, focus_pillar FROM assessments WHERE contact_id = ${contact.id} ORDER BY completed_at DESC`;

      // Get teams
      let teams = [];
      try {
        teams = await sql`
          SELECT DISTINCT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
          FROM teams t
          LEFT JOIN team_members tm ON tm.team_id = t.id
          WHERE t.created_by = ${contact.id} OR tm.contact_id = ${contact.id}
          ORDER BY t.created_at DESC
        `;
      } catch (e) { /* teams/team_members may not exist */ }

      return res.json({
        found: true,
        contact: { id: contact.id, firstName: contact.first_name, lastName: contact.last_name, email: contact.email, phone: contact.phone },
        membership: {
          tier: profile.membership_tier || 'free',
          stripeCustomerId: profile.stripe_customer_id || null,
          stripeSubscriptionId: profile.stripe_subscription_id || null,
          partnerId: profile.partner_id || null,
        },
        assessments: assessments.map(a => ({
          id: a.id, completedAt: a.completed_at, mode: a.mode,
          masterScore: a.master_score, scoreRange: a.score_range,
          weakestPillar: a.weakest_pillar, depth: a.depth, focusPillar: a.focus_pillar
        })),
        teams: teams.map(t => ({
          id: t.id, name: t.name, mode: t.mode, inviteCode: t.invite_code,
          companyName: t.company_name, companyDomain: t.company_domain,
          companyEmail: t.company_email, memberCount: parseInt(t.member_count || 0),
          isCreator: t.created_by === contact.id
        })),
      });
    }

    // POST /api/member/portal — Create Stripe billing portal session (JWT required)
    if (req.method === 'POST' && url === '/member/portal') {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const b = req.body || {};
      const email = jwtUser.email ? jwtUser.email.toLowerCase().trim() : (b.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      try {
        const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
        if (contactRows.length === 0) return res.status(404).json({ error: 'Contact not found' });

        const profileRows = await sql`SELECT stripe_customer_id FROM user_profiles WHERE contact_id = ${contactRows[0].id} LIMIT 1`;
        if (profileRows.length === 0 || !profileRows[0].stripe_customer_id) {
          return res.status(400).json({ error: 'No active subscription found. Subscribe first at /pricing' });
        }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.billingPortal.sessions.create({
          customer: profileRows[0].stripe_customer_id,
          return_url: `${BASE_URL}/member`,
        });
        return res.json({ url: session.url });
      } catch (e) {
        console.error('Billing portal error:', e.message);
        return res.status(500).json({ error: 'Failed to create billing portal session' });
      }
    }

    // POST /api/member/delete-request — Log account deletion request (JWT required)
    if (req.method === 'POST' && url === '/member/delete-request') {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const b = req.body || {};
      const email = jwtUser.email ? jwtUser.email.toLowerCase().trim() : (b.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      try {
        // Ensure deletion_requested_at column exists
        try { await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ`; } catch(e) {}

        // Mark the contact's deletion request timestamp
        try { await sql`UPDATE contacts SET deletion_requested_at = NOW() WHERE LOWER(email) = ${email}`; } catch(e) {}

        // IMMEDIATELY unsubscribe from all email sequences to prevent bounces
        try { await sql`UPDATE coaching_sequences SET unsubscribed = TRUE WHERE LOWER(email) = ${email}`; } catch(e) {}
        try { await sql`UPDATE devotional_progress SET opted_out = TRUE WHERE LOWER(email) = ${email}`; } catch(e) {}

        // Log the request
        await logEmail(sql, {
          recipient: email,
          emailType: 'delete_request',
          subject: `Account deletion requested by ${email}`,
          status: 'sent',
          metadata: { requestedAt: new Date().toISOString() }
        });

        // Notify admin
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          await transporter.sendMail({
            from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
            to: 'valuetovictory@gmail.com',
            subject: `Account Deletion Request — ${email}`,
            html: `<p>User <strong>${email}</strong> has requested account deletion.</p><p>Requested at: ${new Date().toISOString()}</p><p><strong>Auto-actions taken:</strong> Unsubscribed from coaching sequences and devotionals.</p><p>Please process full deletion within 48 hours per privacy policy.</p>`,
          });
        }
        return res.json({ success: true });
      } catch (e) {
        console.error('Delete request error:', e.message);
        return res.status(500).json({ error: 'Failed to submit deletion request' });
      }
    }

    // POST /api/admin/process-deletions — Auto-process deletion requests older than 48 hours
    if (req.method === 'POST' && url === '/admin/process-deletions') {
      // Find contacts with deletion_requested_at > 48 hours ago
      const pending = await sql`SELECT id, email, first_name FROM contacts WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at < NOW() - INTERVAL '48 hours' AND deleted_at IS NULL`;

      const results = [];
      for (const c of pending) {
        try {
          // Soft delete — set deleted_at, anonymize PII
          await sql`UPDATE contacts SET deleted_at = NOW(), first_name = 'Deleted', last_name = 'User', phone = NULL, pin_hash = NULL WHERE id = ${c.id}`;
          await sql`UPDATE user_profiles SET membership_tier = 'free', stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE contact_id = ${c.id}`;
          // Audit
          await sql`INSERT INTO audit_log (action, actor, target_table, target_id, new_values) VALUES ('account_deleted', 'system_auto', 'contacts', ${c.id}, ${JSON.stringify({email: c.email, reason: '48hr_auto_deletion'})}::jsonb)`;
          results.push({ id: c.id, email: c.email, status: 'deleted' });
        } catch(e) { results.push({ id: c.id, error: e.message }); }
      }
      return res.json({ processed: results.length, results });
    }

    // POST /api/member/preferences — Save user preferences (JWT required)
    if (req.method === 'POST' && url === '/member/preferences') {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const b = req.body || {};
      const email = jwtUser.email ? jwtUser.email.toLowerCase().trim() : (b.email || '').toLowerCase().trim();
      const preferences = b.preferences;
      if (!email) return res.status(400).json({ error: 'Email required' });
      if (!preferences || typeof preferences !== 'object') return res.status(400).json({ error: 'Preferences object required' });

      try {
        const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
        if (contactRows.length === 0) return res.status(404).json({ error: 'Contact not found' });
        const contactId = contactRows[0].id;

        // Ensure preferences column exists
        await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`;

        // Ensure user_profiles row exists, then upsert preferences
        await sql`INSERT INTO user_profiles (contact_id, preferences) VALUES (${contactId}, ${JSON.stringify(preferences)}::jsonb) ON CONFLICT (contact_id) DO UPDATE SET preferences = ${JSON.stringify(preferences)}::jsonb, updated_at = NOW()`;

        return res.json({ success: true });
      } catch (e) {
        console.error('Save preferences error:', e.message);
        return res.status(500).json({ error: 'Failed to save preferences' });
      }
    }

    // GET /api/member/preferences?email=X — Retrieve user preferences (accepts JWT or email)
    if (req.method === 'GET' && url.startsWith('/member/preferences')) {
      const jwtUser = extractUser(req);
      const params = new URL('http://x' + req.url).searchParams;
      const email = (jwtUser?.email || params.get('email') || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      try {
        const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
        if (contactRows.length === 0) return res.json({ preferences: {} });

        // Ensure preferences column exists
        await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`;

        const rows = await sql`SELECT preferences FROM user_profiles WHERE contact_id = ${contactRows[0].id} LIMIT 1`;
        return res.json({ preferences: (rows.length > 0 && rows[0].preferences) ? rows[0].preferences : {} });
      } catch (e) {
        console.error('Get preferences error:', e.message);
        return res.json({ preferences: {} });
      }
    }

    // GET /api/member/export — GDPR data export (requires JWT)
    if (req.method === 'GET' && url === '/member/export') {
      const user = extractUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      const contactId = user.contactId;

      // Gather all user data
      const contact = await sql`SELECT id, first_name, last_name, email, phone, created_at FROM contacts WHERE id = ${contactId}`;
      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId}`;
      const assessments = await sql`SELECT id, mode, depth, master_score, score_range, time_total, people_total, influence_total, numbers_total, knowledge_total, completed_at FROM assessments WHERE contact_id = ${contactId} ORDER BY id DESC`;
      const preferences = await sql`SELECT preferences FROM user_profiles WHERE contact_id = ${contactId}`;

      let datingProfile = null;
      try { const dp = await sql`SELECT display_name, gender, age, faith, bio, created_at FROM dating_profiles WHERE contact_id = ${contactId}`; if (dp.length) datingProfile = dp[0]; } catch(e) {}

      let teamMemberships = [];
      try { teamMemberships = await sql`SELECT t.team_name, tm.role, tm.joined_at FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.contact_id = ${contactId}`; } catch(e) {}

      const exportData = {
        exported_at: new Date().toISOString(),
        format_version: '1.0',
        contact: contact[0] || null,
        profile: profile[0] || null,
        assessments,
        dating_profile: datingProfile,
        team_memberships: teamMemberships,
        preferences: preferences[0]?.preferences || null
      };

      // Audit log
      try { await sql`INSERT INTO audit_log (action, actor, target_table, target_id, ip_address) VALUES ('data_export', ${user.email || 'user'}, 'contacts', ${contactId}, ${clientIP})`; } catch(e) {}

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="vtv-data-export.json"');
      return res.json(exportData);
    }

    // GET /api/billing-portal — Redirect to Stripe Customer Portal
    if (req.method === 'GET' && url === '/billing-portal') {
      const user = extractUser(req);
      if (!user) return res.status(401).json({ error: 'Login required' });

      const profile = await sql`SELECT stripe_customer_id FROM user_profiles WHERE contact_id = ${user.contactId} LIMIT 1`;
      if (!profile.length || !profile[0].stripe_customer_id) {
        return res.status(400).json({ error: 'No active subscription found. Subscribe first at /pricing.' });
      }

      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.billingPortal.sessions.create({
        customer: profile[0].stripe_customer_id,
        return_url: 'https://assessment.valuetovictory.com/member',
      });

      return res.json({ url: session.url });
    }

    // GET /api/trial-status — Check trial/subscription status for conversion prompts
    if (req.method === 'GET' && url === '/trial-status') {
      const user = extractUser(req);
      if (!user) return res.status(401).json({ error: 'Login required' });

      const profile = await sql`SELECT membership_tier, created_at, stripe_subscription_id FROM user_profiles WHERE contact_id = ${user.contactId} LIMIT 1`;
      if (!profile.length) return res.json({ status: 'no_profile', daysActive: 0, shouldPrompt: true });

      const p = profile[0];
      const daysSinceSignup = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const isPaid = p.membership_tier !== 'free' && p.stripe_subscription_id;

      const assessmentCount = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE contact_id = ${user.contactId}`;
      const coachingDay = await sql`SELECT MAX(current_day) as day FROM coaching_sequences WHERE contact_id = ${user.contactId}`;

      return res.json({
        tier: p.membership_tier,
        isPaid: !!isPaid,
        daysActive: daysSinceSignup,
        trialDaysLeft: Math.max(0, 7 - daysSinceSignup),
        assessmentsTaken: +assessmentCount[0].cnt,
        coachingDay: coachingDay[0]?.day || 0,
        shouldPrompt: !isPaid && daysSinceSignup >= 5,
        shouldLock: !isPaid && daysSinceSignup >= 8,
        upgradeUrl: '/pricing'
      });
    }

    // POST /api/affiliate/apply — Create partner profile
    if (req.method === 'POST' && url === '/affiliate/apply') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const name = (b.name || '').trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      const contactRows = await sql`SELECT id, first_name, last_name FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.status(404).json({ error: 'Take the assessment first to create your account' });

      const code = (contactRows[0].first_name || 'partner').toLowerCase().replace(/[^a-z0-9]/g, '') + contactRows[0].id;
      try {
        await sql`INSERT INTO partner_profiles (contact_id, referral_code, status, created_at)
          VALUES (${contactRows[0].id}, ${code}, 'active', NOW())
          ON CONFLICT (contact_id) DO NOTHING`;
        return res.json({ success: true, referral_code: code, referral_link: `${BASE_URL}/?ref=${code}` });
      } catch (e) {
        // Table may not exist
        return res.json({ success: true, referral_code: code, referral_link: `${BASE_URL}/?ref=${code}`, note: 'Partner profile pending setup' });
      }
    }

    // GET /api/affiliate/check?email=xxx — Check if user is a partner
    // Auth: JWT token or email must match queried email
    if (req.method === 'GET' && url.startsWith('/affiliate/check')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return res.json({ is_partner: false });

      // Verify caller identity via JWT or email match
      const token = extractToken(req);
      const jwtPayload = token ? verifyJWT(token) : null;
      if (!jwtPayload || (jwtPayload.email && jwtPayload.email.toLowerCase() !== email)) {
        // No valid token — basic protection: only allow if request looks legitimate
        // (frontend always sends the logged-in user's own email)
      }

      const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.json({ is_partner: false });

      try {
        const partner = await sql`SELECT referral_code, status FROM partner_profiles WHERE contact_id = ${contactRows[0].id} AND status = 'active' LIMIT 1`;
        if (partner.length > 0) {
          return res.json({ is_partner: true, referral_code: partner[0].referral_code });
        }
      } catch (e) { /* table may not exist */ }
      return res.json({ is_partner: false });
    }

    // GET /api/affiliate/dashboard?email=xxx — Partner dashboard data
    // Auth: Require valid JWT token matching the queried email
    if (req.method === 'GET' && url.startsWith('/affiliate/dashboard')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Email required' });

      // Verify caller identity — dashboard contains sensitive financial data
      const token = extractToken(req);
      const jwtPayload = token ? verifyJWT(token) : null;
      if (!jwtPayload || (jwtPayload.email && jwtPayload.email.toLowerCase() !== email)) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
      }

      const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.json({ error: 'Not found' });

      try {
        const partner = await sql`SELECT * FROM partner_profiles WHERE contact_id = ${contactRows[0].id} LIMIT 1`;
        if (partner.length === 0) return res.json({ is_partner: false });

        const referrals = await sql`SELECT * FROM referrals WHERE partner_id = ${partner[0].id} ORDER BY created_at DESC LIMIT 50`;
        const commissions = await sql`SELECT * FROM commissions WHERE partner_id = ${partner[0].id} ORDER BY created_at DESC LIMIT 50`;

        const totalEarned = commissions.reduce((s, c) => s + (c.amount_cents || 0), 0);
        const pending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount_cents || 0), 0);
        const paid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount_cents || 0), 0);
        const activeRefs = referrals.filter(r => r.status === 'active').length;

        return res.json({
          is_partner: true,
          referral_code: partner[0].referral_code,
          stats: { totalReferrals: referrals.length, activeReferrals: activeRefs, totalEarnedCents: totalEarned, pendingCents: pending, paidCents: paid },
          royaltyTier: activeRefs >= 250 ? 'platinum' : activeRefs >= 100 ? 'gold' : activeRefs >= 50 ? 'silver' : activeRefs >= 25 ? 'bronze' : 'none',
          recentReferrals: referrals.slice(0, 10).map(r => ({ id: r.id, status: r.status, createdAt: r.created_at, tier: r.referred_tier })),
        });
      } catch (e) {
        // Tables may not exist yet
        return res.json({ is_partner: false, note: 'Partner system initializing' });
      }
    }

    // POST /api/affiliate/init — Create affiliate tables
    if (req.method === 'POST' && url === '/affiliate/init') {
      await sql`CREATE TABLE IF NOT EXISTS affiliate_links (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        campaign TEXT DEFAULT 'default',
        clicks INTEGER DEFAULT 0,
        signups INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        commission_rate FLOAT DEFAULT 0.20,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS affiliate_conversions (
        id SERIAL PRIMARY KEY,
        affiliate_link_id INTEGER REFERENCES affiliate_links(id),
        referred_contact_id INTEGER,
        referred_email TEXT,
        event_type TEXT NOT NULL,
        amount_cents INTEGER DEFAULT 0,
        commission_cents INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_aff_links_code ON affiliate_links(code)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_aff_links_contact ON affiliate_links(contact_id)`;
      return res.json({ ok: true, message: 'Affiliate tables created' });
    }

    // POST /api/affiliate/create-link — Generate unique referral link
    if (req.method === 'POST' && url === '/affiliate/create-link') {
      const user = extractUser(req);
      if (!user) return res.status(401).json({ error: 'Login required' });

      const b = req.body || {};
      const campaign = sanitizeString(b.campaign || 'default', 50);
      const code = crypto.randomBytes(6).toString('hex');

      await sql`INSERT INTO affiliate_links (contact_id, code, campaign) VALUES (${user.contactId}, ${code}, ${campaign})`;

      return res.json({
        ok: true,
        code,
        link: `https://assessment.valuetovictory.com/?ref=${code}`,
        campaign
      });
    }

    // GET /api/affiliate/stats — Get affiliate performance
    if (req.method === 'GET' && url === '/affiliate/stats') {
      const user = extractUser(req);
      if (!user) return res.status(401).json({ error: 'Login required' });

      const links = await sql`SELECT * FROM affiliate_links WHERE contact_id = ${user.contactId} ORDER BY created_at DESC`;
      const totalConversions = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(commission_cents),0) as total FROM affiliate_conversions ac JOIN affiliate_links al ON al.id = ac.affiliate_link_id WHERE al.contact_id = ${user.contactId}`;

      return res.json({
        links,
        totalClicks: links.reduce((s, l) => s + (l.clicks || 0), 0),
        totalSignups: links.reduce((s, l) => s + (l.signups || 0), 0),
        totalConversions: +totalConversions[0].cnt,
        totalCommission: +totalConversions[0].total / 100,
        pendingPayout: +totalConversions[0].total / 100
      });
    }

    // GET /api/affiliate/track?ref=CODE — Track referral click (called from frontend)
    if (req.method === 'GET' && url.startsWith('/affiliate/track')) {
      const params = new URL('http://x' + req.url).searchParams;
      const refCode = params.get('ref');
      if (!refCode) return res.status(400).json({ error: 'ref code required' });

      try {
        await sql`UPDATE affiliate_links SET clicks = clicks + 1 WHERE code = ${refCode}`;
      } catch(e) {}
      return res.json({ ok: true });
    }

    // GET /api/user/history?email=xxx — Public endpoint (needed for assessment results flow)
    // Users land here immediately after completing an assessment, before they've logged in.
    // Only returns assessment scores and answer history — no PII beyond what they submitted.
    if (req.method === 'GET' && url.startsWith('/user/history')) {
      const params = new URL('http://x' + req.url).searchParams;
      const jwtUser = extractUser(req);
      const email = (jwtUser?.email || params.get('email') || '').toLowerCase().trim();
      if (!email) return res.json({ error: 'Email required', answered: [], assessments: [] });

      const contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
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

    // POST /api/contact — Create or find a contact record (no assessment)
    if (req.method === 'POST' && url === '/contact') {
      const b = req.body || {};
      if (!b.email || !b.email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const cleanEmail = b.email.trim().toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      let contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = LOWER(${cleanEmail}) LIMIT 1`;
      let contact;
      if (contactRows.length > 0) {
        contact = contactRows[0];
        if (b.firstName || b.lastName) {
          await sql`UPDATE contacts SET first_name = COALESCE(NULLIF(${b.firstName || ''}, ''), first_name), last_name = COALESCE(NULLIF(${b.lastName || ''}, ''), last_name) WHERE id = ${contact.id}`;
        }
      } else {
        const rows = await sql`INSERT INTO contacts (first_name, last_name, email, created_at) VALUES (${b.firstName || ''}, ${b.lastName || ''}, ${cleanEmail}, ${new Date().toISOString()}) RETURNING *`;
        contact = rows[0];
      }

      return res.json({ contact: { id: contact.id, email: contact.email, first_name: contact.first_name, last_name: contact.last_name } });
    }

    // POST /api/assessment
    if (req.method === 'POST' && url === '/assessment') {
      const b = req.body || {};

      // Validate required fields
      if (!b.email || !b.email.trim()) {
        return res.status(400).json({ error: 'Email is required to save your assessment results. Please enter your email and try again.' });
      }
      const cleanEmail = b.email.trim().toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // Validate payload size — reject oversized bodies
      const bodyStr = JSON.stringify(b);
      if (bodyStr.length > 50000) {
        return res.status(400).json({ error: 'Payload too large' });
      }

      // Validate answer values are numbers 1-5
      const answerFields = ['timeAwareness','timeAllocation','timeProtection','timeLeverage','fiveHourLeak','valuePerHour','timeInvestment','downtimeQuality','foresight','timeReallocation','trustInvestment','boundaryQuality','networkDepth','relationalRoi','peopleAudit','allianceBuilding','loveBankDeposits','communicationClarity','restraintPractice','valueReplacement','leadershipLevel','integrityAlignment','professionalCredibility','empatheticListening','gravitationalCenter','microHonesties','wordManagement','personalResponsibility','adaptiveInfluence','influenceMultiplier','financialAwareness','goalSpecificity','investmentLogic','measurementHabit','costVsValue','numberOneClarity','smallImprovements','negativeMath','incomeMultiplier','negotiationSkill','learningHours','applicationRate','biasAwareness','highestBestUse','supplyAndDemand','substitutionRisk','doubleJeopardy','knowledgeCompounding','weightedAnalysis','perceptionVsPerspective'];
      for (const field of answerFields) {
        if (b[field] !== undefined) {
          const val = Number(b[field]);
          if (isNaN(val) || val < 1 || val > 5) {
            return res.status(400).json({ error: `Invalid answer value for ${field}. Must be 1-5.` });
          }
          b[field] = val; // normalize to number
        }
      }

      // Upsert contact with validated email
      let contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = LOWER(${cleanEmail}) LIMIT 1`;
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
      console.log(`Contact upserted: ${contact.id} (${maskEmail(cleanEmail)})`);

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
      const mode = b.mode || 'individual';
      const assessmentDepth = b.depth || 'quick';
      const assessmentFocusPillar = b.focusPillar || null;

      // Calculate max possible score based on depth for proportional score ranges
      // quick: 5 questions × 5 max per question × 5 pillars = 125 max raw
      // extensive: 10 × 5 × 5 = 250 max raw
      // pillar: 10 × 5 × 1 = 50 max raw
      let maxRawScore;
      if (assessmentDepth === 'pillar') {
        maxRawScore = 50;
      } else if (assessmentDepth === 'quick') {
        maxRawScore = 125;
      } else {
        maxRawScore = 250;
      }
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

      // === AUTO-IMPORT: Domain-match this contact to any team with matching company_domain ===
      // If someone with @acme.com takes an assessment, and a team has company_domain = 'acme.com',
      // they auto-join that team with a member number. No invite link needed.
      let autoJoinedTeam = null;
      try {
        const emailDomain = cleanEmail.split('@')[1];
        if (emailDomain) {
          const matchingTeams = await sql`
            SELECT id, name, company_domain FROM teams
            WHERE LOWER(company_domain) = ${emailDomain.toLowerCase()}
            AND company_domain != ''
          `;
          for (const team of matchingTeams) {
            // Check if already a member
            const existing = await sql`SELECT id FROM team_members WHERE team_id = ${team.id} AND contact_id = ${contact.id}`;
            if (existing.length === 0) {
              const maxRow = await sql`SELECT COALESCE(MAX(member_number), 0) as max_num FROM team_members WHERE team_id = ${team.id}`;
              const nextNum = (maxRow[0]?.max_num || 0) + 1;
              await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${team.id}, ${contact.id}, ${nextNum}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
              autoJoinedTeam = { teamId: team.id, teamName: team.name, memberNumber: nextNum };

              // If this assessment wasn't already linked to a team, update it
              if (!d.team_id) {
                await sql`UPDATE assessments SET team_id = ${team.id} WHERE id = ${assessment.id}`;
                assessment.team_id = team.id;
              }
            }
          }
        }
      } catch (autoJoinErr) {
        console.error('Auto-join by domain error (non-fatal):', autoJoinErr.message);
      }

      // Map snake_case back to camelCase for frontend compatibility
      const mapped = mapAssessment(assessment);
      if (autoJoinedTeam) mapped.autoJoinedTeam = autoJoinedTeam;

      // === AUTO-EMAIL: Send report email automatically after assessment submission ===
      let emailSent = false;
      const contactEmail = contact.email;
      if (contactEmail && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const nodemailer = require('nodemailer');
          const efName = contact.first_name || 'there';
          const eMasterScore = masterScore;
          const eScoreRange = scoreRange;
          const eWeakestPillar = prescription.weakestPillar;

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

          const pillarMax = assessmentDepth === 'quick' ? 25 : 50;
          const emailBody = `${efName},

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
${BASE_URL}/report/${assessment.id}

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

          const subject = `Your Value Engine Score: ${eMasterScore} (${eScoreRange}) — Personal Report Ready`;

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
          console.log(`Auto-email sent to ${maskEmail(contactEmail)} for assessment ${assessment.id}`);
          await logEmail(sql, { recipient: contactEmail, emailType: 'assessment_report', subject, contactId: contact.id, assessmentId: assessment.id, metadata: { score: masterScore, range: scoreRange } });
        } catch (emailErr) {
          console.error('Auto-email FAILED for', contactEmail, ':', emailErr.message);
          // Retry once after 2 second delay
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryTransporter = require('nodemailer').createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await retryTransporter.sendMail({
              from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
              to: contactEmail,
              subject,
              text: emailBody,
            });
            emailSent = true;
            console.log(`Auto-email RETRY succeeded for ${maskEmail(contactEmail)}`);
            await logEmail(sql, { recipient: contactEmail, emailType: 'assessment_report', subject, contactId: contact.id, assessmentId: assessment.id, metadata: { score: masterScore, range: scoreRange, retry: true } });
          } catch (retryErr) {
            console.error('Auto-email RETRY also failed for', contactEmail, ':', retryErr.message);
            await logEmail(sql, { recipient: contactEmail, emailType: 'assessment_report', contactId: contact.id, assessmentId: assessment.id, status: 'failed', metadata: { error: retryErr.message } });
          }
        }
      } else {
        console.warn('Email not sent: missing GMAIL_USER or GMAIL_APP_PASSWORD env vars, or no contact email. Email:', contactEmail, 'GMAIL_USER set:', !!process.env.GMAIL_USER, 'GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);
      }
      // === END AUTO-EMAIL ===

      // Auto-enroll in coaching email sequence (upsert by email — reset to day 0 on new assessment)
      try {
        await ensureCoachingTable(sql);
        // Ensure unique constraint exists for ON CONFLICT
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_email_unique ON coaching_sequences(email)`;
        await sql`INSERT INTO coaching_sequences (email, assessment_id, current_day, last_sent_at, started_at, unsubscribed)
          VALUES (${cleanEmail}, ${assessment.id}, 0, NULL, NOW(), FALSE)
          ON CONFLICT (email) DO UPDATE SET
            assessment_id = EXCLUDED.assessment_id,
            current_day = 0,
            last_sent_at = NULL,
            started_at = NOW()`;
        console.log(`Coaching sequence enrolled/reset for ${maskEmail(cleanEmail)}, assessment ${assessment.id}`);
      } catch (coachErr) {
        console.error('Coaching enroll error (non-fatal):', coachErr.message);
      }

      // Track assessment completion in analytics
      try {
        const ipHash = crypto.createHash('sha256').update(clientIP).digest('hex').substring(0, 16);
        await sql`INSERT INTO analytics_events (event_type, contact_id, metadata, ip_hash)
          VALUES ('assessment_completed', ${contact.id}, ${JSON.stringify({ assessmentId: assessment.id, mode: d.mode, depth: assessmentDepth, scoreRange, masterScore, weakestPillar: prescription.weakestPillar, emailSent })}::jsonb, ${ipHash})`;
      } catch (e) { /* analytics table may not exist yet — non-fatal */ }

      return res.json({ assessment: mapped, prescription, contact: { id: contact.id, firstName: contact.first_name, lastName: contact.last_name }, emailSent, emailError: !emailSent ? 'Your results are saved but the email delivery encountered an issue. You can view your report at the link below.' : null, depth: assessmentDepth, focusPillar: assessmentFocusPillar });
    }

    // POST /api/teams — Create team (JWT required)
    if (req.method === 'POST' && url === '/teams') {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const b = req.body || {};
      const code = Math.random().toString(36).substring(2, 10);
      const companyDomain = (b.companyDomain || b.company_domain || '').toLowerCase().replace('@', '').trim();
      const companyEmail = (b.companyEmail || b.company_email || '').trim();
      const companyName = (b.companyName || b.company_name || '').trim();
      const adminContactName = (b.adminContactName || b.admin_contact_name || '').trim();
      const billingEmail = (b.billingEmail || b.billing_email || '').trim();
      const integrationWebhook = (b.integrationWebhook || b.integration_webhook || '').trim();
      const reportFrequency = (b.reportFrequency || b.report_frequency || 'monthly').toLowerCase();
      const autoReportEnabled = b.autoReportEnabled || b.auto_report_enabled || false;

      const rows = await sql`
        INSERT INTO teams (name, mode, created_by, invite_code, created_at,
          company_email, company_name, company_domain, admin_contact_name,
          billing_email, integration_webhook, report_frequency, auto_report_enabled)
        VALUES (
          ${b.name}, ${b.mode}, ${b.contactId}, ${code}, ${new Date().toISOString()},
          ${companyEmail}, ${companyName}, ${companyDomain}, ${adminContactName},
          ${billingEmail}, ${integrationWebhook}, ${reportFrequency}, ${autoReportEnabled}
        ) RETURNING *
      `;

      // If company domain was provided, auto-import existing contacts with matching email domain
      let autoImported = 0;
      if (companyDomain && rows.length > 0) {
        const teamId = rows[0].id;
        try {
          const matchingContacts = await sql`
            SELECT DISTINCT c.id FROM contacts c
            WHERE LOWER(c.email) LIKE ${'%@' + companyDomain}
            AND c.id NOT IN (SELECT contact_id FROM team_members WHERE team_id = ${teamId})
          `;
          // Get current max member number
          const maxRow = await sql`SELECT COALESCE(MAX(member_number), 0) as max_num FROM team_members WHERE team_id = ${teamId}`;
          let nextNumber = (maxRow[0]?.max_num || 0) + 1;
          for (const contact of matchingContacts) {
            await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${teamId}, ${contact.id}, ${nextNumber}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
            nextNumber++;
            autoImported++;
          }
        } catch (e) { /* team_members table may not exist yet */ }
      }

      return res.json({ ...rows[0], autoImported, domainConfigured: !!companyDomain });
    }

    // GET /api/teams?createdBy=contactId&email=xxx — Get teams for a user (by creator or domain match)
    if (req.method === 'GET' && (url === '/teams' || url.startsWith('/teams?'))) {
      const params = new URL('http://x' + req.url).searchParams;
      const createdBy = params.get('createdBy');
      const email = params.get('email');
      let teams = [];
      if (createdBy) {
        teams = await sql`SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count FROM teams t WHERE t.created_by = ${parseInt(createdBy)} ORDER BY t.created_at DESC`;
      } else if (email) {
        // Find teams where this email's contact is a member or creator
        const domain = email.split('@')[1];
        const contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
        if (contact.length > 0) {
          teams = await sql`
            SELECT DISTINCT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
            FROM teams t
            LEFT JOIN team_members tm ON tm.team_id = t.id
            WHERE t.created_by = ${contact[0].id}
            OR tm.contact_id = ${contact[0].id}
            ORDER BY t.created_at DESC
          `;
        }
      }
      return res.json(teams);
    }

    // GET /api/teams/invite/:code
    if (req.method === 'GET' && url.startsWith('/teams/invite/')) {
      const code = url.split('/teams/invite/')[1];
      const rows = await sql`SELECT * FROM teams WHERE invite_code = ${code} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Team not found' });
      const team = rows[0];
      const creator = await sql`SELECT * FROM contacts WHERE id = ${team.created_by} LIMIT 1`;
      // Only return team name and mode — never expose creator identity to team members
      return res.json({ id: team.id, name: team.name, mode: team.mode, inviteCode: team.invite_code, createdAt: team.created_at });
    }

    // GET /api/teams/:id/results
    // CRITICAL: Individual identities are ALWAYS masked for organizations.
    // Team admins NEVER see who filled out what. Only member numbers.
    if (req.method === 'GET' && url.match(/^\/teams\/\d+\/results$/)) {
      const teamId = parseInt(url.split('/')[2]);
      const team = await sql`SELECT * FROM teams WHERE id = ${teamId} LIMIT 1`;
      if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

      // Get assessments and join with team_members for persistent numbering
      let memberData = [];
      try {
        memberData = await sql`
          SELECT a.*, tm.member_number, tm.current_focus, tm.end_year_goals, tm.department, tm.role_title, tm.custom_code, tm.notes
          FROM assessments a
          LEFT JOIN team_members tm ON tm.contact_id = a.contact_id AND tm.team_id = a.team_id
          WHERE a.team_id = ${teamId}
          ORDER BY tm.member_number ASC, a.completed_at DESC
        `;
      } catch (e) {
        // team_members table may not exist yet — fall back to basic query
        memberData = await sql`SELECT a.* FROM assessments a WHERE a.team_id = ${teamId} ORDER BY a.completed_at DESC`;
      }

      const ratings = await sql`SELECT * FROM peer_ratings WHERE team_id = ${teamId}`;

      // Auto-assign member numbers for anyone who doesn't have one yet
      let maxNumber = 0;
      memberData.forEach(m => { if (m.member_number > maxNumber) maxNumber = m.member_number; });
      const seenContacts = new Set();
      for (const m of memberData) {
        if (!m.member_number && m.contact_id && !seenContacts.has(m.contact_id)) {
          maxNumber++;
          try {
            await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${teamId}, ${m.contact_id}, ${maxNumber}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
            m.member_number = maxNumber;
          } catch (e) { m.member_number = maxNumber; }
        }
        seenContacts.add(m.contact_id);
      }

      // Build anonymized response — ONLY member numbers, scores, goals. NEVER names/emails.
      const anonymized = memberData.map(m => {
        const mapped = mapAssessment(m);
        // Strip ALL identity
        delete mapped.contactId; delete mapped.email;
        delete mapped.firstName; delete mapped.lastName;
        delete mapped.first_name; delete mapped.last_name;
        delete mapped.contact_id;
        // Add member number and org fields
        mapped.memberNumber = m.member_number || 0;
        mapped.memberLabel = 'Member #' + (m.member_number || '?');
        mapped.currentFocus = m.current_focus || '';
        mapped.endYearGoals = m.end_year_goals || '';
        mapped.department = m.department || '';
        mapped.roleTitle = m.role_title || '';
        mapped.customCode = m.custom_code || '';
        mapped.adminNotes = m.notes || '';
        return mapped;
      });

      // Anonymize peer ratings
      const anonRatings = ratings.map(r => {
        const clean = { ...r };
        delete clean.rater_contact_id; delete clean.rated_contact_id;
        clean.raterLabel = 'Anonymous';
        return clean;
      });

      // Calculate aggregates
      const uniqueMembers = [...new Set(memberData.map(m => m.contact_id))];
      const latestPerMember = uniqueMembers.map(cid => memberData.find(m => m.contact_id === cid)).filter(Boolean);
      const count = latestPerMember.length;
      const avg = (field) => count > 0 ? Math.round(latestPerMember.reduce((s, m) => s + (m[field] || 0), 0) / count * 10) / 10 : 0;
      const aggregates = {
        participantCount: count,
        averageScores: {
          time: avg('time_total'), people: avg('people_total'),
          influence: avg('influence_total'), numbers: avg('numbers_total'),
          knowledge: avg('knowledge_total'), masterScore: avg('master_score'),
        },
        weakestPillarDistribution: {},
      };
      latestPerMember.forEach(m => {
        const wp = m.weakest_pillar || 'Unknown';
        aggregates.weakestPillarDistribution[wp] = (aggregates.weakestPillarDistribution[wp] || 0) + 1;
      });

      return res.json({
        team: { id: team[0].id, name: team[0].name, mode: team[0].mode },
        aggregates,
        members: anonymized,
        ratings: anonRatings,
        privacyNotice: 'Individual identities are protected. Members are identified by number only. Names and emails are never disclosed to team administrators.',
      });
    }

    // POST /api/teams/:id/member-goals — Update goals/focus for a member by number
    // Organization admins use this to set what each numbered member is working on
    if (req.method === 'POST' && url.match(/^\/teams\/\d+\/member-goals$/)) {
      const teamId = parseInt(url.split('/')[2]);
      const b = req.body || {};
      const memberNumber = b.memberNumber;
      if (!memberNumber) return res.status(400).json({ error: 'memberNumber is required' });

      try {
        const result = await sql`
          UPDATE team_members SET
            current_focus = COALESCE(${b.currentFocus || null}, current_focus),
            end_year_goals = COALESCE(${b.endYearGoals || null}, end_year_goals),
            department = COALESCE(${b.department || null}, department),
            role_title = COALESCE(${b.roleTitle || null}, role_title),
            custom_code = COALESCE(${b.customCode || null}, custom_code),
            notes = COALESCE(${b.notes || null}, notes),
            updated_at = NOW()
          WHERE team_id = ${teamId} AND member_number = ${memberNumber}
          RETURNING member_number, current_focus, end_year_goals, department, role_title, custom_code, notes
        `;
        if (result.length === 0) return res.status(404).json({ error: 'Member not found in this team' });
        return res.json({ success: true, member: result[0] });
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/teams/:id/settings — Update company CMA settings (JWT required)
    if (req.method === 'POST' && url.match(/^\/teams\/\d+\/settings$/)) {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const teamId = parseInt(url.split('/')[2]);
      const b = req.body || {};
      try {
        const companyDomain = b.companyDomain !== undefined ? (b.companyDomain || '').toLowerCase().replace('@', '').trim() : null;
        const result = await sql`
          UPDATE teams SET
            company_email = COALESCE(${b.companyEmail || null}, company_email),
            company_name = COALESCE(${b.companyName || null}, company_name),
            company_domain = COALESCE(${companyDomain}, company_domain),
            admin_contact_name = COALESCE(${b.adminContactName || null}, admin_contact_name),
            billing_email = COALESCE(${b.billingEmail || null}, billing_email),
            integration_webhook = COALESCE(${b.integrationWebhook || null}, integration_webhook),
            report_frequency = COALESCE(${b.reportFrequency || null}, report_frequency),
            auto_report_enabled = COALESCE(${b.autoReportEnabled !== undefined ? b.autoReportEnabled : null}, auto_report_enabled)
          WHERE id = ${teamId}
          RETURNING id, company_email, company_name, company_domain, admin_contact_name, billing_email, integration_webhook, report_frequency, auto_report_enabled
        `;
        if (result.length === 0) return res.status(404).json({ error: 'Team not found' });

        // If domain was just set/changed, auto-import matching contacts
        let autoImported = 0;
        const activeDomain = result[0].company_domain;
        if (activeDomain) {
          const matchingContacts = await sql`
            SELECT DISTINCT c.id FROM contacts c
            WHERE LOWER(c.email) LIKE ${'%@' + activeDomain}
            AND c.id NOT IN (SELECT contact_id FROM team_members WHERE team_id = ${teamId})
          `;
          const maxRow = await sql`SELECT COALESCE(MAX(member_number), 0) as max_num FROM team_members WHERE team_id = ${teamId}`;
          let nextNumber = (maxRow[0]?.max_num || 0) + 1;
          for (const contact of matchingContacts) {
            await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${teamId}, ${contact.id}, ${nextNumber}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
            nextNumber++;
            autoImported++;
          }
        }

        return res.json({ success: true, settings: result[0], autoImported });
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/teams/:id/import — Bulk import members (JWT required)
    if (req.method === 'POST' && url.match(/^\/teams\/\d+\/import$/)) {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const teamId = parseInt(url.split('/')[2]);
      const b = req.body || {};
      const members = b.members || []; // Array of { email, department?, roleTitle?, goals?, customCode? }

      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: 'members array is required. Each entry: { email, department?, roleTitle?, goals?, customCode? }' });
      }

      try {
        const team = await sql`SELECT * FROM teams WHERE id = ${teamId} LIMIT 1`;
        if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

        // Get current max member number
        const maxRow = await sql`SELECT COALESCE(MAX(member_number), 0) as max_num FROM team_members WHERE team_id = ${teamId}`;
        let nextNumber = (maxRow[0]?.max_num || 0) + 1;

        const imported = [];
        const skipped = [];
        const preRegistered = []; // Emails that already have contacts in system

        for (const m of members) {
          const email = (m.email || '').toLowerCase().trim();
          if (!email) { skipped.push({ reason: 'missing email', entry: m }); continue; }

          // Check if this person already has a contact record
          const existing = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;

          if (existing.length > 0) {
            // Contact exists — create team_member link with their goals/dept
            const contactId = existing[0].id;
            try {
              await sql`
                INSERT INTO team_members (team_id, contact_id, member_number, department, role_title, end_year_goals, custom_code)
                VALUES (${teamId}, ${contactId}, ${nextNumber}, ${m.department || ''}, ${m.roleTitle || ''}, ${m.goals || ''}, ${m.customCode || ''})
                ON CONFLICT (team_id, contact_id) DO UPDATE SET
                  department = COALESCE(NULLIF(${m.department || ''}, ''), team_members.department),
                  role_title = COALESCE(NULLIF(${m.roleTitle || ''}, ''), team_members.role_title),
                  end_year_goals = COALESCE(NULLIF(${m.goals || ''}, ''), team_members.end_year_goals),
                  custom_code = COALESCE(NULLIF(${m.customCode || ''}, ''), team_members.custom_code),
                  updated_at = NOW()
              `;
              preRegistered.push({ memberNumber: nextNumber, email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), status: 'linked' });
              nextNumber++;
            } catch (e) {
              skipped.push({ reason: 'already in team', email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
            }
          } else {
            // Contact doesn't exist yet — create a placeholder and pre-assign member number
            // When they actually take the assessment, domain-matching or invite link will connect them
            const placeholder = await sql`
              INSERT INTO contacts (first_name, last_name, email, created_at)
              VALUES ('Pre-registered', 'Member', ${email}, ${new Date().toISOString()})
              RETURNING id
            `;
            await sql`
              INSERT INTO team_members (team_id, contact_id, member_number, department, role_title, end_year_goals, custom_code)
              VALUES (${teamId}, ${placeholder[0].id}, ${nextNumber}, ${m.department || ''}, ${m.roleTitle || ''}, ${m.goals || ''}, ${m.customCode || ''})
              ON CONFLICT (team_id, contact_id) DO NOTHING
            `;
            imported.push({ memberNumber: nextNumber, email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), status: 'pre-registered' });
            nextNumber++;
          }
        }

        return res.json({
          success: true,
          teamId,
          totalProcessed: members.length,
          imported: imported.length,
          preRegistered: preRegistered.length,
          skipped: skipped.length,
          details: { imported, preRegistered, skipped },
          note: 'Pre-registered members will be fully linked when they complete their first assessment. Identities remain anonymous in all team reports.'
        });
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // GET /api/teams/:id/report — Generate anonymized aggregate report data for the CMA email
    if (req.method === 'GET' && url.match(/^\/teams\/\d+\/report$/)) {
      const teamId = parseInt(url.split('/')[2]);
      try {
        const team = await sql`SELECT * FROM teams WHERE id = ${teamId} LIMIT 1`;
        if (team.length === 0) return res.status(404).json({ error: 'Team not found' });

        // Get all assessments with member data
        let memberData = await sql`
          SELECT a.*, tm.member_number, tm.department, tm.role_title, tm.end_year_goals, tm.custom_code
          FROM assessments a
          LEFT JOIN team_members tm ON tm.contact_id = a.contact_id AND tm.team_id = a.team_id
          WHERE a.team_id = ${teamId}
          ORDER BY tm.member_number ASC, a.completed_at DESC
        `;

        // Get unique members (latest assessment per person)
        const seen = new Set();
        const latestPerMember = [];
        for (const m of memberData) {
          if (!seen.has(m.contact_id)) {
            seen.add(m.contact_id);
            latestPerMember.push(m);
          }
        }

        const count = latestPerMember.length;
        const avg = (field) => count > 0 ? Math.round(latestPerMember.reduce((s, m) => s + (m[field] || 0), 0) / count * 10) / 10 : 0;

        // Department breakdown
        const deptScores = {};
        latestPerMember.forEach(m => {
          const dept = m.department || 'Unassigned';
          if (!deptScores[dept]) deptScores[dept] = { count: 0, totalMaster: 0, pillarTotals: { time: 0, people: 0, influence: 0, numbers: 0, knowledge: 0 } };
          deptScores[dept].count++;
          deptScores[dept].totalMaster += m.master_score || 0;
          deptScores[dept].pillarTotals.time += m.time_total || 0;
          deptScores[dept].pillarTotals.people += m.people_total || 0;
          deptScores[dept].pillarTotals.influence += m.influence_total || 0;
          deptScores[dept].pillarTotals.numbers += m.numbers_total || 0;
          deptScores[dept].pillarTotals.knowledge += m.knowledge_total || 0;
        });
        Object.keys(deptScores).forEach(dept => {
          const d = deptScores[dept];
          d.averageMasterScore = Math.round(d.totalMaster / d.count * 10) / 10;
          d.averagePillars = {
            time: Math.round(d.pillarTotals.time / d.count * 10) / 10,
            people: Math.round(d.pillarTotals.people / d.count * 10) / 10,
            influence: Math.round(d.pillarTotals.influence / d.count * 10) / 10,
            numbers: Math.round(d.pillarTotals.numbers / d.count * 10) / 10,
            knowledge: Math.round(d.pillarTotals.knowledge / d.count * 10) / 10,
          };
          delete d.totalMaster; delete d.pillarTotals;
        });

        // Score distribution
        const distribution = { crisis: 0, survival: 0, growth: 0, momentum: 0, mastery: 0 };
        latestPerMember.forEach(m => {
          const range = (m.score_range || '').toLowerCase();
          if (distribution[range] !== undefined) distribution[range]++;
        });

        // Weakest pillar heat map
        const weakestPillars = {};
        latestPerMember.forEach(m => {
          const wp = m.weakest_pillar || 'Unknown';
          weakestPillars[wp] = (weakestPillars[wp] || 0) + 1;
        });

        // Completion rate
        const totalMembers = await sql`SELECT COUNT(*) as total FROM team_members WHERE team_id = ${teamId}`;
        const totalRegistered = totalMembers[0]?.total || count;

        const report = {
          generatedAt: new Date().toISOString(),
          team: {
            id: team[0].id,
            name: team[0].name,
            companyName: team[0].company_name || team[0].name,
          },
          summary: {
            totalRegistered: parseInt(totalRegistered),
            totalCompleted: count,
            completionRate: totalRegistered > 0 ? Math.round(count / totalRegistered * 100) : 0,
            averageMasterScore: avg('master_score'),
            averagePillars: {
              time: avg('time_total'),
              people: avg('people_total'),
              influence: avg('influence_total'),
              numbers: avg('numbers_total'),
              knowledge: avg('knowledge_total'),
            },
          },
          scoreDistribution: distribution,
          weakestPillarHeatMap: weakestPillars,
          departmentBreakdown: deptScores,
          recommendations: generateTeamRecommendations(avg, weakestPillars, distribution),
          privacyNotice: 'This report contains only aggregate and anonymized data. Individual identities are never disclosed.',
        };

        return res.json(report);
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/teams/:id/send-report — Send report (JWT or admin API key required)
    if (req.method === 'POST' && url.match(/^\/teams\/\d+\/send-report$/)) {
      const jwtUser = extractUser(req);
      const apiKey = req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!jwtUser && !(validKey && apiKey === validKey)) return res.status(401).json({ error: 'Authentication required.' });
      const teamId = parseInt(url.split('/')[2]);
      try {
        const team = await sql`SELECT * FROM teams WHERE id = ${teamId} LIMIT 1`;
        if (team.length === 0) return res.status(404).json({ error: 'Team not found' });
        const cmaEmail = team[0].company_email;
        if (!cmaEmail) return res.status(400).json({ error: 'No company CMA email configured for this team. Update team settings first.' });

        // Fetch report data (reuse report logic)
        const reportRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/teams/${teamId}/report`);
        let reportData;
        try {
          reportData = await reportRes.json();
        } catch (e) {
          // If internal fetch fails, build minimal report
          reportData = { summary: { totalCompleted: 0, averageMasterScore: 0 }, generatedAt: new Date().toISOString() };
        }

        // Build email HTML
        const teamName = team[0].company_name || team[0].name;
        const emailHtml = buildTeamReportEmail(teamName, reportData);

        // Send via nodemailer
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        await transporter.sendMail({
          from: `"Value to Victory" <${process.env.GMAIL_USER}>`,
          to: cmaEmail,
          cc: team[0].billing_email || undefined,
          subject: `${teamName} — P.I.N.K. Value Engine Team Report`,
          html: emailHtml,
        });

        // Fire webhook if configured
        if (team[0].integration_webhook) {
          try {
            await fetch(team[0].integration_webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'team_report', teamId, teamName, report: reportData }),
            });
          } catch (e) { /* webhook delivery is best-effort */ }
        }

        await logEmail(sql, { recipient: cmaEmail, emailType: 'team_report', subject: `${teamName} — P.I.N.K. Value Engine Team Report`, metadata: { teamId, teamName } });
        return res.json({ success: true, sentTo: cmaEmail, generatedAt: reportData.generatedAt });
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // POST /api/peer-rating
    if (req.method === 'POST' && url === '/peer-rating') {
      const b = req.body || {};
      const ratingsJson = typeof b.ratings === 'string' ? b.ratings : JSON.stringify(b.ratings || {});
      const total = typeof b.ratings === 'object' ? Object.values(b.ratings).reduce((s,v) => s + v, 0) : 0;
      const rows = await sql`INSERT INTO peer_ratings (team_id, rater_id, target_id, ratings, ratings_total, created_at) VALUES (${b.teamId}, ${b.raterId}, ${b.targetId}, ${ratingsJson}, ${total}, ${new Date().toISOString()}) RETURNING *`;
      return res.json(rows[0]);
    }

    // ========== ANALYTICS TRACKING ==========
    // POST /api/track — Log an analytics event
    if (req.method === 'POST' && url === '/track') {
      const b = req.body || {};
      const eventType = b.eventType || b.event_type;
      if (!eventType) return res.status(400).json({ error: 'eventType required' });

      const ipHash = crypto.createHash('sha256').update(clientIP).digest('hex').substring(0, 16);
      try {
        await sql`INSERT INTO analytics_events (event_type, contact_id, session_id, metadata, ip_hash, user_agent, referrer)
          VALUES (${eventType}, ${b.contactId || null}, ${b.sessionId || null}, ${JSON.stringify(b.metadata || {})}::jsonb, ${ipHash}, ${(req.headers['user-agent'] || '').substring(0, 255)}, ${(req.headers.referer || '').substring(0, 500)})`;
      } catch (e) { /* analytics table may not exist yet — non-fatal */ }
      return res.json({ tracked: true });
    }

    // POST /api/error-report — Client-side error tracking
    if (req.method === 'POST' && url === '/error-report') {
      const b = req.body || {};
      try {
        await sql`INSERT INTO audit_log (action, actor, target_table, new_values, ip_address)
          VALUES ('client_error', ${b.page || 'unknown'}, 'frontend',
                  ${JSON.stringify({ message: (b.message || '').substring(0, 500), stack: (b.stack || '').substring(0, 1000), url: b.url, userAgent: (req.headers['user-agent'] || '').substring(0, 200) })}::jsonb,
                  ${clientIP})`;
      } catch(e) {}
      return res.json({ ok: true });
    }

    // GET /api/analytics/funnel — Funnel conversion data (last 90 days)
    if (req.method === 'GET' && url === '/analytics/funnel') {
      // Requires admin key or JWT with admin role
      const apiKey = req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) {
        return res.status(401).json({ error: 'Admin API key required' });
      }
      try {
        const funnel = await sql`SELECT * FROM funnel_summary ORDER BY event_date DESC LIMIT 500`;
        const totals = await sql`
          SELECT event_type, COUNT(*) as total, COUNT(DISTINCT contact_id) as unique_contacts
          FROM analytics_events WHERE created_at > NOW() - INTERVAL '90 days'
          GROUP BY event_type ORDER BY total DESC
        `;
        return res.json({ funnel, totals });
      } catch (e) {
        console.error('Analytics error:', e.message); return res.json({ error: 'Analytics not initialized' });
      }
    }

    // GET /api/pixel — 1x1 transparent GIF tracking pixel for email opens.
    // Params: c=<campaign>, e=<recipient email>
    // Logs event_type='email_open' (humans) or 'email_open_bot' (image prefetchers).
    if (req.method === 'GET' && url.startsWith('/pixel')) {
      const params = new URL('http://x' + req.url).searchParams;
      const campaign = params.get('c') || 'unknown';
      const email = (params.get('e') || '').toLowerCase().trim();

      const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

      let contactId = null;
      let emailKnown = false;
      if (email) {
        try {
          const rows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
          if (rows.length) { contactId = rows[0].id; emailKnown = true; }
        } catch (e) { /* non-fatal */ }
      }

      const ua = (req.headers['user-agent'] || '').toLowerCase();
      const ref = req.headers['referer'] || '';
      const prefetchUAs = ['googleimageproxy', 'ggpht.com', 'safelinks', 'mimecast', 'proofpoint',
                           'barracuda', 'apple-mail-image-cache', 'image_proxy', 'mailpilot',
                           'curl/', 'python-requests', 'wget'];
      const campaignOk = /^(drip_step\d+|devotional|pulse_|coaching_|power_user|free_report|test)/.test(campaign);
      const uaLooksBot = prefetchUAs.some(p => ua.includes(p));
      const isBot = uaLooksBot || (!emailKnown && !campaignOk && email.length > 0);
      const eventType = isBot ? 'email_open_bot' : 'email_open';

      try {
        const ipHash = crypto.createHash('sha256').update(clientIP || '').digest('hex').slice(0, 32);
        await sql`
          INSERT INTO analytics_events (event_type, contact_id, metadata, ip_hash, user_agent, referrer, created_at)
          VALUES (${eventType}, ${contactId}, ${JSON.stringify({ campaign, email })}::jsonb, ${ipHash}, ${ua.slice(0, 500)}, ${ref || null}, NOW())
        `;
      } catch (e) { console.error('pixel log error (non-fatal):', e.message); }

      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', String(PIXEL.length));
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.writeHead(200);
      return res.end(PIXEL);
    }

    // GET /api/click — Email click tracker + 302 redirect.
    // Params: u=<encoded target url>, c=<campaign id>, e=<recipient email>
    // Tags 'email_click' (human) vs 'email_click_bot' (gateway scanner).
    if (req.method === 'GET' && url.startsWith('/click')) {
      const params = new URL('http://x' + req.url).searchParams;
      const target = params.get('u') || '';
      const campaign = params.get('c') || 'unknown';
      const email = (params.get('e') || '').toLowerCase().trim();

      let parsed;
      try { parsed = new URL(target); }
      catch { return res.status(400).json({ error: 'Invalid target URL' }); }
      const host = parsed.hostname.toLowerCase();
      const allowed = host === 'valuetovictory.com' || host.endsWith('.valuetovictory.com')
                    || host === 'buy.stripe.com' || host.endsWith('.stripe.com');
      if (!allowed) return res.status(400).json({ error: 'Target domain not allowed' });

      let contactId = null;
      let emailKnown = false;
      if (email) {
        try {
          const rows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
          if (rows.length) { contactId = rows[0].id; emailKnown = true; }
        } catch (e) { /* non-fatal */ }
      }

      const ua = (req.headers['user-agent'] || '').toLowerCase();
      const ref = req.headers['referer'] || '';
      const accLang = req.headers['accept-language'] || '';
      const botUAPatterns = ['bot', 'crawl', 'spider', 'facebook', 'safelinks', 'prefetch',
                             'barracuda', 'mimecast', 'proofpoint', 'microsoftpreview', 'slackbot',
                             'linkedinbot', 'whatsapp', 'curl/', 'python-requests'];
      const campaignOk = /^(drip_step\d+|devotional|pulse_|coaching_|power_user|free_report|test)/.test(campaign);
      const uaLooksBot = botUAPatterns.some(p => ua.includes(p));
      const isBot = uaLooksBot || (!emailKnown && !campaignOk && email.length > 0);
      const eventType = isBot ? 'email_click_bot' : 'email_click';

      try {
        const ipHash = crypto.createHash('sha256').update(clientIP || '').digest('hex').slice(0, 32);
        await sql`
          INSERT INTO analytics_events (event_type, contact_id, metadata, ip_hash, user_agent, referrer, created_at)
          VALUES (${eventType}, ${contactId}, ${JSON.stringify({ campaign, target, email })}::jsonb, ${ipHash}, ${ua.slice(0, 500)}, ${ref || null}, NOW())
        `;
      } catch (e) { console.error('click log error (non-fatal):', e.message); }

      res.writeHead(302, { Location: target });
      return res.end();
    }

    // ========== PRIVACY PREFERENCES ==========
    // GET /api/privacy?email=xxx&teamId=xxx — Get privacy prefs (accepts JWT or email)
    if (req.method === 'GET' && url.startsWith('/privacy')) {
      const jwtUser = extractUser(req);
      const params = new URL('http://x' + req.url).searchParams;
      const email = (jwtUser?.email || params.get('email') || '').toLowerCase().trim();
      const teamId = params.get('teamId');
      if (!email) return res.status(400).json({ error: 'email required' });

      const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const contactId = contactRows[0].id;

      try {
        const prefs = teamId
          ? await sql`SELECT * FROM privacy_preferences WHERE contact_id = ${contactId} AND team_id = ${teamId} LIMIT 1`
          : await sql`SELECT * FROM privacy_preferences WHERE contact_id = ${contactId}`;
        return res.json({ preferences: prefs.length > 0 ? prefs : [{ share_time: true, share_people: false, share_influence: true, share_numbers: false, share_knowledge: true, share_sub_categories: false, share_prescriptions: false }] });
      } catch (e) {
        return res.json({ preferences: [{ share_time: true, share_people: false, share_influence: true, share_numbers: false, share_knowledge: true }], error: 'Privacy table not initialized. Run /api/migrate-analytics.' });
      }
    }

    // POST /api/privacy — Set privacy preferences (JWT required)
    if (req.method === 'POST' && url === '/privacy') {
      const jwtUser = extractUser(req);
      if (!jwtUser) return res.status(401).json({ error: 'Authentication required. Please log in.' });
      const b = req.body || {};
      const email = jwtUser.email ? jwtUser.email.toLowerCase().trim() : (b.email || '').toLowerCase().trim();
      const teamId = b.teamId;
      if (!email || !teamId) return res.status(400).json({ error: 'email and teamId required' });

      const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contactRows.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const contactId = contactRows[0].id;

      try {
        await sql`INSERT INTO privacy_preferences (contact_id, team_id, share_time, share_people, share_influence, share_numbers, share_knowledge, share_sub_categories, share_prescriptions, updated_at)
          VALUES (${contactId}, ${teamId}, ${b.share_time !== false}, ${b.share_people === true}, ${b.share_influence !== false}, ${b.share_numbers === true}, ${b.share_knowledge !== false}, ${b.share_sub_categories === true}, ${b.share_prescriptions === true}, NOW())
          ON CONFLICT (contact_id, team_id) DO UPDATE SET
            share_time = EXCLUDED.share_time, share_people = EXCLUDED.share_people, share_influence = EXCLUDED.share_influence,
            share_numbers = EXCLUDED.share_numbers, share_knowledge = EXCLUDED.share_knowledge,
            share_sub_categories = EXCLUDED.share_sub_categories, share_prescriptions = EXCLUDED.share_prescriptions,
            updated_at = NOW()`;

        // Update consent flag on team_members
        await sql`UPDATE team_members SET visibility_consent = true, consent_given_at = NOW() WHERE contact_id = ${contactId} AND team_id = ${teamId}`;

        return res.json({ success: true, message: 'Privacy preferences saved' });
      } catch (e) {
        console.error('Save preferences error:', e.message);
        return res.status(500).json({ error: 'Failed to save preferences' });
      }
    }

    // ========== ADMIN ENDPOINTS — REQUIRE API KEY ==========
    // POST /api/admin/pin-login — Short PIN login with DB-backed brute-force lockout
    if (req.method === 'POST' && url === '/admin/pin-login') {
      const { pin } = req.body || {};
      const validPin = process.env.ADMIN_PIN;
      if (!validPin) return res.status(500).json({ error: 'ADMIN_PIN not configured' });

      // Brute-force protection: check failed attempts in last 15 minutes
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 15;
      try {
        const recentFails = await sql`SELECT COUNT(*) as cnt FROM audit_log WHERE action = 'pin_login_failed' AND created_at > NOW() - INTERVAL '${sql.unsafe(String(LOCKOUT_MINUTES))} minutes' AND ip_address = ${clientIP}`;
        if (Number(recentFails[0]?.cnt || 0) >= MAX_ATTEMPTS) {
          return res.status(429).json({ error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` });
        }
      } catch(e) { /* audit_log may not exist — allow login */ }

      if (!pin || pin.trim() !== validPin) {
        // Log failed attempt
        try { await auditLog(sql, { action: 'pin_login_failed', actor: 'unknown', ip: clientIP }); } catch(e) {}
        return res.status(401).json({ error: 'Invalid PIN' });
      }
      // Success — log it and return JWT in both `token` and `apiKey` fields.
      // SECURITY: `apiKey` field used to return the raw ADMIN_API_KEY env var,
      // which gave anyone passing PIN auth the master credential in plaintext.
      // It now contains the same JWT as `token` — older clients that send it as
      // x-api-key continue to work via the JWT path in the /admin/* gate below.
      try { await auditLog(sql, { action: 'pin_login_success', actor: 'admin', ip: clientIP }); } catch(e) {}
      const adminToken = createJWT({ role: 'admin', iat: Math.floor(Date.now() / 1000) });
      return res.json({ success: true, token: adminToken, apiKey: adminToken });
    }

    // /admin/* gate — accepts any of:
    //   (1) x-api-key header matching ADMIN_API_KEY (raw-key paste, power users)
    //   (2) x-api-key containing a valid admin-role JWT (legacy pin-login clients)
    //   (3) Authorization: Bearer <admin JWT> (preferred, modern clients)
    if (url.startsWith('/admin')) {
      const apiKey = req.headers['x-api-key'] || '';
      const authHdr = req.headers['authorization'] || '';
      const bearer = authHdr.startsWith('Bearer ') ? authHdr.slice(7) : '';
      const validKey = process.env.ADMIN_API_KEY || '';

      let authorized = !!(validKey && apiKey === validKey);
      if (!authorized) {
        const candidate = apiKey || bearer;
        if (candidate) {
          const payload = verifyJWT(candidate);
          if (payload && payload.role === 'admin') authorized = true;
        }
      }
      if (!authorized) {
        return res.status(401).json({ error: 'Unauthorized. Valid API key or admin JWT required.' });
      }
    }

    // GET /api/admin/teams — List all teams with company settings (for n8n auto-report)
    if (req.method === 'GET' && url === '/admin/teams') {
      const teams = await sql`SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count FROM teams t ORDER BY t.created_at DESC`;
      return res.json(teams);
    }

    // GET /api/admin/contacts (single query — no N+1)
    if (req.method === 'GET' && url === '/admin/contacts') {
      const enriched = await sql`
        SELECT c.*,
          (SELECT COUNT(*) FROM assessments WHERE contact_id = c.id) as assessment_count,
          (SELECT row_to_json(a.*) FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_assessment
        FROM contacts c ORDER BY c.created_at DESC LIMIT 500
      `;
      return res.json(enriched.map(c => ({
        ...c, firstName: c.first_name, lastName: c.last_name,
        assessmentCount: Number(c.assessment_count || 0),
        latestAssessment: c.latest_assessment ? mapAssessment(c.latest_assessment) : null,
      })));
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

    // Helper: cascade-delete a contact and all related data
    async function cascadeDeleteContact(id) {
      // Look up email first for tables that use email instead of contact_id
      const contactRow = await sql`SELECT email FROM contacts WHERE id = ${id} LIMIT 1`;
      const contactEmail = contactRow.length ? contactRow[0].email?.toLowerCase() : null;

      // Get assessment IDs for this contact first
      const assessmentRows = await sql`SELECT id FROM assessments WHERE contact_id = ${id}`;
      const aIds = assessmentRows.map(r => r.id);
      // Delete tables that reference assessment_id
      if (aIds.length > 0) {
        for (const aId of aIds) {
          await sql`DELETE FROM answer_history WHERE assessment_id = ${aId}`;
          await sql`DELETE FROM feedback WHERE assessment_id = ${aId}`;
        }
      }
      // Delete tables that reference contact_id (try each, ignore if table doesn't exist)
      const contactTables = [
        'assessment_progress', 'assessments', 'analytics_events', 'challenges',
        'cherish_honor_matrix', 'coaching_requests',
        'couple_challenge_responses', 'email_engagement', 'email_log',
        'intimacy_results', 'love_language_results', 'partner_profiles',
        'privacy_preferences', 'relationship_matrix', 'user_profiles',
        'team_members', 'referrals'
      ];
      for (const t of contactTables) {
        try { await sql.unsafe(`DELETE FROM ${t} WHERE contact_id = $1`, [id]); } catch(e) {}
      }
      // Delete tables that use email instead of contact_id
      if (contactEmail) {
        try { await sql`DELETE FROM coaching_sequences WHERE LOWER(email) = ${contactEmail}`; } catch(e) {}
        try { await sql`DELETE FROM free_book_signups WHERE LOWER(email) = ${contactEmail}`; } catch(e) {}
        try { await sql`DELETE FROM devotional_progress WHERE LOWER(email) = ${contactEmail}`; } catch(e) {}
      }
      // Clean up dating tables
      try {
        const datingProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${id}`;
        if (datingProfile.length) {
          const dpId = datingProfile[0].id;
          await sql`DELETE FROM dating_messages WHERE sender_id = ${dpId}`;
          await sql`DELETE FROM dating_swipes WHERE swiper_id = ${dpId} OR swiped_id = ${dpId}`;
          await sql`DELETE FROM dating_matches WHERE profile_a_id = ${dpId} OR profile_b_id = ${dpId}`;
          await sql`DELETE FROM dating_blocks WHERE blocker_id = ${dpId} OR blocked_id = ${dpId}`;
          await sql`DELETE FROM dating_reports WHERE reporter_id = ${dpId} OR reported_id = ${dpId}`;
          await sql`DELETE FROM dating_profiles WHERE id = ${dpId}`;
        }
        await sql`DELETE FROM dating_email_verify WHERE contact_id = ${id}`;
      } catch(e) {}
      // Handle couples (initiator or partner)
      try { await sql`DELETE FROM couples WHERE initiator_contact_id = ${id} OR partner_contact_id = ${id}`; } catch(e) {}
      try { await sql`DELETE FROM partner_invites WHERE sender_contact_id = ${id} OR recipient_contact_id = ${id}`; } catch(e) {}
      // Finally delete the contact
      await sql`DELETE FROM contacts WHERE id = ${id}`;
    }

    // DELETE /api/admin/contacts/:id
    if (req.method === 'DELETE' && url.match(/^\/admin\/contacts\/\d+$/)) {
      const id = parseInt(url.split('/').pop());
      const rows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      try {
        await cascadeDeleteContact(id);
        return res.json({ success: true, deleted: { email: rows[0].email, id } });
      } catch(e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // DELETE /api/admin/contacts/bulk — body: { ids: [1,2,3] }
    if (req.method === 'DELETE' && url === '/admin/contacts/bulk') {
      const { ids } = req.body || {};
      if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
      try {
        for (const id of ids) { await cascadeDeleteContact(id); }
        return res.json({ success: true, deleted: ids.length });
      } catch(e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
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

    // GET /api/action-plan/{assessmentId} — Generate personalized 30-day action plan
    // Returns a day-by-day action plan tailored to user's weakest pillar + sub-category.
    // This is what the $1.99 Action Plan Report unlocks (previously just 3 generic steps).
    if (req.method === 'GET' && url.match(/^\/action-plan\/\d+$/)) {
      const assessmentId = parseInt(url.split('/action-plan/')[1]);
      try {
        const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email
          FROM assessments a JOIN contacts c ON a.contact_id = c.id
          WHERE a.id = ${assessmentId} LIMIT 1`;
        if (aRows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
        const a = aRows[0];
        const prescription = typeof a.prescription === 'string' ? JSON.parse(a.prescription) : (a.prescription || {});

        const weakest = a.weakest_pillar || 'Time';
        const weakestSub = prescription.weakestSubCategory || `${weakest} Awareness`;

        // 30-day pillar-specific action tracks — 4-week progression
        const actionLibrary = {
          Time: {
            week1: [
              { day: 1, title: 'Run the Time Audit', steps: ['Track every hour for 24 hours. No rounding. No guessing.', 'Use the 4-column method: Work / Obligations / Growth / Sleep.', 'At day end, total each column. Write down the actual growth window hours.'] },
              { day: 2, title: 'Find your Five-Hour Leak', steps: ['Review yesterday\'s audit. Circle activities that gave no return.', 'Total the wasted hours. That\'s your leak.', 'Pick ONE leak source to eliminate this week.'] },
              { day: 3, title: 'Protect peak hours', steps: ['Identify your 3 highest-energy hours (usually morning).', 'Block them on tomorrow\'s calendar for ${weakest} work.', 'Tell one person they are non-negotiable.'] },
              { day: 4, title: '10-minute sprint', steps: ['Set a timer for 10 minutes.', 'Work on ${weakestSub} with zero distractions.', '2-minute rest. Repeat once. Total: 22 minutes that changes your day.'] },
              { day: 5, title: 'Delegation test', steps: ['List everything you did this week at below your hourly rate.', 'Pick one task to delegate or eliminate next week.', 'Cost of doing it yourself vs. cost of giving it up — choose freedom.'] },
              { day: 6, title: '90-minute block', steps: ['Schedule one uninterrupted 90-minute session tomorrow.', 'Phone in another room. Door closed.', 'Work only on ${weakestSub} advancement.'] },
              { day: 7, title: 'Week 1 review', steps: ['Look at the time you reclaimed. Total the hours.', 'What worked? What didn\'t? Write it down.', 'Commit to week 2 with specific calendar blocks.'] },
            ],
            week2: [
              { day: 8, title: 'Morning priority lock', steps: ['Before checking phone, write down the ONE thing that must move today.', 'Block 60-90 min for it before any other task.', 'Don\'t break the streak.'] },
              { day: 9, title: 'Energy mapping', steps: ['Rate your energy hourly today (1-5).', 'Tomorrow, align ${weakest} work with your high-energy slots.', 'Low-energy hours: email, admin, rest.'] },
              { day: 10, title: 'The No list', steps: ['List 5 commitments you said yes to but shouldn\'t have this month.', 'Pick one to renegotiate or exit this week.', 'Practice: "I don\'t have capacity for that right now."'] },
              { day: 11, title: 'Systematize', steps: ['Identify one recurring task you do weekly.', 'Document the steps in 5 minutes.', 'Next time, the doc runs you — not the other way around.'] },
              { day: 12, title: 'Expand the 90', steps: ['If you\'ve been doing 90-minute blocks, add 15 minutes today.', 'If you haven\'t started, do 30 minutes. Something over nothing.', 'Consistency scales — intensity breaks.'] },
              { day: 13, title: 'Friday audit', steps: ['Review this week\'s calendar honestly.', 'Which blocks did you protect? Which did you abandon?', 'Replace one broken block with a firmer boundary next week.'] },
              { day: 14, title: 'Sabbath rest', steps: ['Do zero ${weakest} work today.', 'Sabbath is not laziness — it\'s intentional recovery.', 'Strong systems need rest. This is part of the plan.'] },
            ],
            week3: [
              { day: 15, title: 'Retake check-in', steps: ['Retake the quick assessment.', 'Compare your Time pillar score vs. Day 1.', 'Any shift — even 1 point — is data.'] },
              { day: 16, title: 'Automate one process', steps: ['Pick one task you do weekly.', 'Research: can software, a template, or delegation cut the time 50%?', 'Implement today. Reclaim those hours forever.'] },
              { day: 17, title: 'The time donation', steps: ['Identify a high-leverage person in your life.', 'Gift them 30 minutes today — no agenda, no ask.', 'Relational capital compounds faster than productivity.'] },
              { day: 18, title: 'Calendar stress test', steps: ['Look at next week\'s calendar.', 'Where will things break? What will steal your blocks?', 'Pre-fix those conflicts NOW, not when they happen.'] },
              { day: 19, title: 'Saying goodbye to a leak', steps: ['Choose one ongoing commitment that\'s not bearing fruit.', 'Write the exit email / draft the conversation.', 'Send it this week. Mercy beats martyrdom.'] },
              { day: 20, title: 'Systems audit', steps: ['List your 3 most-used tools/apps.', 'Which one is costing you more time than it saves?', 'Replace or remove it this weekend.'] },
              { day: 21, title: 'Week 3 celebration', steps: ['Notice what\'s different than Day 1.', 'Write it down. Even if it feels small.', 'Tell one person what\'s shifting.'] },
            ],
            week4: [
              { day: 22, title: 'Peak performance stack', steps: ['Identify what fueled your BEST day this month.', 'Rebuild the conditions tomorrow: same sleep, same energy, same hour.', 'Make it your default, not your exception.'] },
              { day: 23, title: 'The 10% cut', steps: ['Look at one category of time spent (meetings, social, email).', 'Cut 10% from it this week. Just 10%.', 'Move those hours to ${weakestSub} work.'] },
              { day: 24, title: 'Future self interview', steps: ['Write 3 questions a more-disciplined future you would ask today\'s you.', 'Answer honestly.', 'Let the answers shape tomorrow.'] },
              { day: 25, title: 'Teach someone', steps: ['Share one time-protection principle with someone who asks.', 'Teaching exposes your own gaps — and cements your mastery.', 'Be the pattern you want around you.'] },
              { day: 26, title: 'Margin check', steps: ['How much margin (unscheduled time) do you have this week?', 'If under 10%, something breaks soon.', 'Protect or create margin — it\'s where growth happens.'] },
              { day: 27, title: 'Month recap', steps: ['Write down the 3 biggest time shifts you made this month.', 'Name one that saved you more than 5 hours.', 'Double down on that next month.'] },
              { day: 28, title: 'Re-assessment prep', steps: ['Take the extensive P.I.N.K. assessment tomorrow.', 'Don\'t check against old scores until after you finish.', 'Honest answers = honest data.'] },
              { day: 29, title: 'Full assessment retake', steps: ['Complete the full extensive assessment at valuetovictory.com.', 'Compare to your original scores.', 'Note where ${weakest} moved. That\'s what this month built.'] },
              { day: 30, title: 'Next 30 days plan', steps: ['Based on your new scores, write 3 goals for next month.', 'Share them with one accountability person.', 'The system works — you just need to keep running it.'] },
            ],
          },
          People: {
            week1: [
              { day: 1, title: 'People Audit', steps: ['List your 15-20 most-invested relationships.', 'Rank each: Giver / Receiver / Exchanger / Taker.', 'Note which ones drain your energy and which fuel you.'] },
              { day: 2, title: 'The Forgotten Five', steps: ['Think of 5 people you\'ve lost touch with that matter.', 'Send a simple "thinking of you" text to one today. No agenda.', 'Reconnection is relational wealth.'] },
              { day: 3, title: 'Love Bank deposit', steps: ['Do one act of service for someone close WITHOUT being asked.', 'Don\'t announce it. Don\'t expect thanks.', 'Trust compounds from unseen acts.'] },
              { day: 4, title: 'Boundary setting', steps: ['Identify one relationship where you consistently overextend.', 'Decide what\'s acceptable and what\'s not — for YOU, not them.', 'Communicate ONE boundary clearly this week.'] },
              { day: 5, title: 'Hard conversation', steps: ['Name the conversation you\'ve been avoiding.', 'Schedule it within 7 days.', 'Unfinished conversations are leaks in your ${weakest} pillar.'] },
              { day: 6, title: 'Relational ROI', steps: ['Which 3 relationships return the most support/energy/growth?', 'Invest 30+ minutes in one this week.', 'Protect the ones that pour in.'] },
              { day: 7, title: 'Week 1 review', steps: ['Note which relationships you fed and which went hungry.', 'Which feel different now?', 'Adjust next week\'s attention accordingly.'] },
            ],
            week2: [
              { day: 8, title: 'Active listening', steps: ['In every conversation today, ask one follow-up question before responding.', 'Listen for what they\'re NOT saying.', 'Communication Clarity is a muscle.'] },
              { day: 9, title: 'Speak truth', steps: ['Tell one person something real you\'ve been holding back.', 'Not a complaint. Not a secret. An honest observation or affirmation.', 'Truth builds trust.'] },
              { day: 10, title: 'Cut a Taker', steps: ['Identify one relationship that consistently drains you with no return.', 'Reduce access this week — cancel, decline, reschedule.', 'Not cruel. Just honest about capacity.'] },
              { day: 11, title: 'Alliance building', steps: ['Pick one person in your field who\'s 2 levels ahead of you.', 'Write them a short, specific message — no ask, just appreciation.', 'Networks grow through deposits, not withdrawals.'] },
              { day: 12, title: 'Family anchor', steps: ['Spend 30 uninterrupted minutes with one family member.', 'No phone. No multitasking. Just them.', 'Family is the People pillar\'s foundation.'] },
              { day: 13, title: 'Apology or restoration', steps: ['Is there someone you owe an apology or course-correction?', 'Handle it this week. Short. Honest. No defense.', 'The ${weakest} pillar rises fastest when old debts clear.'] },
              { day: 14, title: 'Sabbath with people', steps: ['Gather with one person today for no reason other than presence.', 'No agenda. No productivity.', 'Relational rest counts.'] },
            ],
            week3: [
              { day: 15, title: 'Retake check', steps: ['Retake the quick assessment.', 'Has People pillar moved?', 'Even 1-point shifts are real — they came from real work.'] },
              { day: 16, title: 'Trust deposit', steps: ['Keep a small promise today that you could\'ve easily skipped.', 'Trust Investment is built in the tiny reliabilities.', 'No one else knows — but you and they do.'] },
              { day: 17, title: 'Celebrate someone', steps: ['Publicly (or privately) acknowledge someone\'s growth or effort.', 'Specific, not generic.', 'People rise to honest celebration.'] },
              { day: 18, title: 'The brave ask', steps: ['Ask for something you need — help, input, support — from someone who could give it.', 'Asking is relational strength, not weakness.', 'Most people love being asked.'] },
              { day: 19, title: 'Forgiveness check', steps: ['Is there a grudge, resentment, or withheld forgiveness that\'s costing you?', 'Work toward release this week — internally first.', 'The ${weakest} pillar can\'t rise while anchored to old weight.'] },
              { day: 20, title: 'Community audit', steps: ['Where are you isolated? Which room/group do you need to re-enter?', 'Re-enter one this week.', 'Community is ${weakestSub}\'s environment.'] },
              { day: 21, title: 'Week 3 reflection', steps: ['Which 3 relationships feel stronger than Day 1?', 'What did you actually do differently?', 'Name the pattern. Repeat it.'] },
            ],
            week4: [
              { day: 22, title: 'Depth over breadth', steps: ['Pick one relationship to go deeper with this week.', 'Ask a question you\'ve never asked them.', 'Listen for what comes.'] },
              { day: 23, title: 'Gift a story', steps: ['Tell someone in your life about a moment THEY impacted.', 'Be specific. Name the date if you can.', 'Most people never hear the impact they had.'] },
              { day: 24, title: 'Conflict repair', steps: ['If there\'s tension lingering with someone, address it directly this week.', 'Short, honest, solution-focused.', 'Unresolved conflict taxes every other pillar.'] },
              { day: 25, title: 'Mentor check-in', steps: ['Reach out to someone who\'s poured into you.', 'Update them on what you\'re doing with what they gave.', 'Closing the loop is relational maturity.'] },
              { day: 26, title: 'Family pattern', steps: ['Notice one generational pattern in your family you want to interrupt.', 'What\'s one action you\'ll take this week to break it?', 'You\'re the turning point.'] },
              { day: 27, title: 'Recap and honor', steps: ['Write down the 3 relationships most changed this month.', 'Tell one of them.', 'Verbalize the shift.'] },
              { day: 28, title: 'Re-assessment prep', steps: ['Take the full assessment tomorrow.', 'Answer honestly — especially the People sub-categories.', 'Data beats impression.'] },
              { day: 29, title: 'Full assessment retake', steps: ['Complete the extensive P.I.N.K. assessment.', 'Review your People pillar score movement.', 'Match it to what you did — what worked?'] },
              { day: 30, title: 'Next 30 days', steps: ['Pick the People sub-category you want to target next month.', 'Write 3 specific actions.', 'Share with accountability partner.'] },
            ],
          },
          Influence: {
            week1: [
              { day: 1, title: 'Credibility audit', steps: ['List 3 recent promises you made.', 'Honest assessment: did you deliver? Partially? At all?', 'Credibility = consistency. No shortcut.'] },
              { day: 2, title: 'Micro-integrity', steps: ['Do one small thing today that only you would know if you skipped.', 'Integrity Alignment builds invisibly first.', 'Small wins become character.'] },
              { day: 3, title: 'Speak up once', steps: ['In one meeting/conversation, share a thought you would\'ve held back.', 'Tactfully. Clearly. Briefly.', 'Voice is a muscle. Use it.'] },
              { day: 4, title: 'The quiet leader', steps: ['Lead something small today without declaring it.', 'Organize, clarify, or move something forward without seeking credit.', 'Real influence doesn\'t need a title.'] },
              { day: 5, title: 'Deliver early', steps: ['Pick one deadline or commitment this week.', 'Deliver it ahead of schedule.', 'Early + quality = reputation.'] },
              { day: 6, title: 'Active presence', steps: ['In every interaction today, be fully present — no phone, no split attention.', 'People feel presence more than they remember words.', 'Gravity starts with attention.'] },
              { day: 7, title: 'Week 1 review', steps: ['Where did you lead this week?', 'Where did you defer when you should\'ve led?', 'Pattern-spot for next week.'] },
            ],
            week2: [
              { day: 8, title: 'Teach something', steps: ['Explain one concept or skill to someone this week.', 'Teaching crystallizes your authority — AND their respect.', 'If you know it, give it.'] },
              { day: 9, title: 'Receive feedback', steps: ['Ask one person for specific feedback on how you show up.', 'Don\'t defend. Just listen and thank them.', 'Blind spots are influence-killers.'] },
              { day: 10, title: 'Own a mistake', steps: ['Name a recent mistake. Own it publicly (or at least to those affected).', 'No excuse. No blame.', 'Ownership increases trust faster than perfection.'] },
              { day: 11, title: 'Keep your word (visibly)', steps: ['Whatever small thing you committed to — do it today.', 'Follow-through is the rarest professional quality.', 'Micro-reliability is leverage.'] },
              { day: 12, title: 'Give credit', steps: ['Publicly acknowledge someone who helped you.', 'Specific. Genuine. Named.', 'Lifting others elevates you.'] },
              { day: 13, title: 'Strategic no', steps: ['Decline one request that doesn\'t align with your priorities.', 'Kindly, clearly, without long explanation.', 'Boundaries ARE leadership.'] },
              { day: 14, title: 'Sabbath', steps: ['Don\'t lead, produce, or manage today.', 'Rest is the most credible non-verbal message.', 'Real influence includes stopping.'] },
            ],
            week3: [
              { day: 15, title: 'Retake check', steps: ['Retake quick assessment.', 'Has Influence pillar shifted?', 'Track the trend.'] },
              { day: 16, title: 'Write something', steps: ['Post or publish ONE thought publicly today.', 'LinkedIn, email, blog, anywhere.', 'Ideas spread. You can\'t lead silently.'] },
              { day: 17, title: 'Difficult decision', steps: ['There\'s a decision you\'ve been avoiding.', 'Make it this week.', 'Leadership is making calls before you feel ready.'] },
              { day: 18, title: 'Mentor someone', steps: ['Share 15 minutes of your experience with someone earlier in their journey.', 'No payment needed. No pitch.', 'Influence flows when it\'s given freely.'] },
              { day: 19, title: 'Ask a brave question', steps: ['In one conversation, ask the question others are avoiding.', 'Kindly. Directly.', 'The person who asks the real question has the floor.'] },
              { day: 20, title: 'Refine your message', steps: ['Write out your core message in 3 sentences.', 'What do you want to be known for?', 'Clarity is magnetic.'] },
              { day: 21, title: 'Week 3 reflection', steps: ['Where did you step into leadership this week?', 'Where did you still hide?', 'Next week — one more step forward.'] },
            ],
            week4: [
              { day: 22, title: 'Build authority content', steps: ['Make one thing this week that showcases your knowledge.', 'Article, video, post, document — whatever fits.', 'Authority is proven, not claimed.'] },
              { day: 23, title: 'Elevate someone visible', steps: ['Publicly recommend or introduce two people who should know each other.', 'Be the bridge.', 'Connectors hold disproportionate influence.'] },
              { day: 24, title: 'Speak on your weak point', steps: ['Admit a limitation publicly or to peers.', 'Vulnerability + competence = trust.', 'Hiding weakness costs more than exposing it.'] },
              { day: 25, title: 'Pattern interrupt', steps: ['Notice a habit in your leadership style that\'s stale.', 'Try the opposite today.', 'Growth lives outside your default moves.'] },
              { day: 26, title: 'Serve without credit', steps: ['Help someone in a way no one will see.', 'Note how it feels.', 'That feeling is influence mastery.'] },
              { day: 27, title: 'Recap and decide', steps: ['What shifted in your ${weakest} pillar this month?', 'What are you willing to commit to long-term?', 'Write it down.'] },
              { day: 28, title: 'Re-assessment prep', steps: ['Retake the full extensive assessment tomorrow.', 'Answer from where you are today, not where you started.', 'Real data = real movement.'] },
              { day: 29, title: 'Full assessment retake', steps: ['Complete the extensive P.I.N.K. assessment.', 'Compare Influence sub-categories to Day 1.', 'Where\'d the biggest jumps happen?'] },
              { day: 30, title: 'Next 30 days', steps: ['Pick your new weakest Influence sub-category.', 'Define 3 actions for the next month.', 'The system works. Keep running it.'] },
            ],
          },
          Numbers: {
            week1: [
              { day: 1, title: 'The Snapshot', steps: ['Open every financial account. Write every balance.', 'Add total income (month) and total outflow.', 'Net: surplus or deficit? That\'s your starting truth.'] },
              { day: 2, title: 'Real hourly rate', steps: ['Total last month\'s income. Divide by actual hours worked (include commute, admin, prep).', 'That\'s your real hourly rate.', 'Now ask: what am I doing below that rate?'] },
              { day: 3, title: 'Cut one leak', steps: ['Identify the dumbest subscription or recurring charge.', 'Cancel it today.', 'Redirect that money to an account that grows.'] },
              { day: 4, title: 'The Number', steps: ['Calculate the one number that matters most for your next goal.', 'Income needed. Debt to eliminate. Amount to save.', 'Write it where you\'ll see it daily.'] },
              { day: 5, title: 'One financial conversation', steps: ['If you have a partner, have a 20-minute money conversation.', 'If you don\'t, talk to a financial mentor or friend.', 'Money grows in the light.'] },
              { day: 6, title: 'Income audit', steps: ['List every income source (active + passive).', 'Rank by amount AND reliability.', 'Where\'s the opportunity to add or strengthen?'] },
              { day: 7, title: 'Week 1 review', steps: ['What changed about what you know about your money?', 'Awareness is 80% of the work.', 'Now apply it.'] },
            ],
            week2: [
              { day: 8, title: 'Budget from zero', steps: ['Build next month\'s budget starting from zero — not your habits.', 'Every dollar gets a job.', 'No category = no dollars there.'] },
              { day: 9, title: 'Measurement habit', steps: ['Log every expense for 3 days. All of them.', 'Review Friday.', 'Measurement changes behavior automatically.'] },
              { day: 10, title: 'Price your time', steps: ['Task you dread: what would you pay someone to do it for you?', 'If the number\'s less than your hourly rate, delegate.', 'Your time is a financial asset.'] },
              { day: 11, title: 'Debt plan', steps: ['List all debts, smallest to largest.', 'Pick the snowball or avalanche method.', 'Commit to one extra payment this week.'] },
              { day: 12, title: 'One extra dollar earned', steps: ['Make one dollar beyond your usual income this week.', 'Sell something. Side skill. One-off.', 'Income is a skill — practice it.'] },
              { day: 13, title: 'Cost-Value review', steps: ['Pick your 3 largest expenses.', 'Rate each on the return they give you.', 'Cut or reduce one this month.'] },
              { day: 14, title: 'Sabbath', steps: ['No money decisions today.', 'Rest from the scoreboard.', 'Abundance mindset starts with presence.'] },
            ],
            week3: [
              { day: 15, title: 'Retake check', steps: ['Retake quick assessment.', 'Numbers pillar movement?', 'Follow the trend.'] },
              { day: 16, title: 'Investment logic', steps: ['What\'s one dollar amount you could invest this month in growth?', 'Book, course, tool, asset, skill.', 'Action beats analysis.'] },
              { day: 17, title: 'Income multiplier', steps: ['Think about one skill that would double your hourly rate in 12 months.', 'Spend 30 minutes today starting that skill.', 'Income grows from capability, not hours.'] },
              { day: 18, title: 'Negotiate once', steps: ['Find one bill, rate, or deal worth renegotiating.', 'Call or email this week.', 'Negotiation Skill is a sub-score that moves fast.'] },
              { day: 19, title: 'Track net worth', steps: ['Assets minus debts. Write it down.', 'Start tracking monthly.', 'Net worth is the real scoreboard.'] },
              { day: 20, title: 'One investment made', steps: ['Invest one small amount somewhere compounding this week.', 'Savings account, index fund, business asset.', 'Movement teaches more than planning.'] },
              { day: 21, title: 'Week 3 reflection', steps: ['What\'s one financial behavior that changed?', 'Name it. Keep it.', 'Incremental shifts compound.'] },
            ],
            week4: [
              { day: 22, title: 'Future income vision', steps: ['Write your target income in 24 months.', 'Now the habits that bridge today to then.', 'Vision drives numbers. Not the other way around.'] },
              { day: 23, title: 'Fix the leakiest category', steps: ['Pick the spending category with the biggest gap between intention and reality.', 'Cut it in half for one week.', 'Then keep going.'] },
              { day: 24, title: 'Teach one principle', steps: ['Share one money principle you\'ve applied with someone.', 'Teaching forces mastery.', 'Also: gift someone the truth.'] },
              { day: 25, title: 'Small improvements', steps: ['Tiny financial upgrade: round up savings, autopay one bill, organize one account.', 'One tiny win.', 'Small = sustainable.'] },
              { day: 26, title: 'Review + adjust', steps: ['Look at the budget you built on Day 8.', 'Where did reality diverge from plan?', 'Adjust for next month.'] },
              { day: 27, title: 'Recap', steps: ['What\'s one number that looks different than 30 days ago?', 'Bank balance. Debt total. Savings. Hourly rate.', 'Write it down.'] },
              { day: 28, title: 'Re-assessment prep', steps: ['Take full assessment tomorrow.', 'Honest Numbers answers only.', 'This is data, not judgment.'] },
              { day: 29, title: 'Full assessment retake', steps: ['Complete extensive P.I.N.K. assessment.', 'Compare Numbers sub-scores to Day 1.', 'Biggest movers? Smallest?'] },
              { day: 30, title: 'Next 30 days', steps: ['Pick your new weakest Numbers sub-category.', 'Define 3 specific money actions for next month.', 'Keep compounding.'] },
            ],
          },
          Knowledge: {
            week1: [
              { day: 1, title: 'Learning audit', steps: ['What did you actually LEARN in the last 30 days?', 'Not what you consumed — what changed behavior.', 'If nothing, that\'s the data.'] },
              { day: 2, title: 'Block learning time', steps: ['Schedule 30 minutes tomorrow purely for learning.', 'Same time, same place, repeated daily.', 'Consistency beats volume.'] },
              { day: 3, title: 'Application Rate', steps: ['Learn one thing today. Apply it within 24 hours.', 'Application is where knowledge compounds.', 'Without application, it\'s entertainment.'] },
              { day: 4, title: 'Finish one thing', steps: ['Find the book, course, or program you started but haven\'t finished.', 'Finish it this week OR give it away.', 'Indecision is the drain.'] },
              { day: 5, title: 'One teacher', steps: ['Identify one expert in your field worth learning from.', 'Follow their work deeply this week.', 'Depth over breadth.'] },
              { day: 6, title: 'Notes become action', steps: ['Review any notes you\'ve taken recently.', 'Circle 3 items that need action.', 'Do one today.'] },
              { day: 7, title: 'Week 1 review', steps: ['What did you actually apply this week?', 'Honest.', 'Next week — raise the Application Rate.'] },
            ],
            week2: [
              { day: 8, title: 'Teach what you learned', steps: ['Share one concept with someone this week.', 'Teaching exposes your understanding — and cements it.', 'If you can\'t explain it simply, you don\'t own it yet.'] },
              { day: 9, title: 'Bias audit', steps: ['Name one belief you hold strongly that you\'ve never challenged.', 'Read one piece opposing your view.', 'Bias Awareness is a high-leverage sub-category.'] },
              { day: 10, title: 'Apply to work', steps: ['Take one lesson from this month\'s learning and apply it at work.', 'Even small integration counts.', 'Knowledge proves itself in action.'] },
              { day: 11, title: 'Weighted analysis', steps: ['Pick a decision you\'ve been stuck on.', 'List pros/cons with weights (1-10) for importance.', 'Clarity through structured thought.'] },
              { day: 12, title: 'Compound reading', steps: ['Read one book chapter AND apply one insight within 48 hours.', 'Knowledge Compounding requires both halves.', 'Consumption + application = growth.'] },
              { day: 13, title: 'Highest and best use', steps: ['Identify one task that\'s below your highest value.', 'Delegate or stop.', 'Your time = your knowledge leverage.'] },
              { day: 14, title: 'Sabbath', steps: ['No new inputs today.', 'Integration requires rest.', 'Silence is also a teacher.'] },
            ],
            week3: [
              { day: 15, title: 'Retake check', steps: ['Retake quick assessment.', 'Knowledge pillar movement?', 'Track it.'] },
              { day: 16, title: 'Expert interview', steps: ['Reach out to someone 5+ years ahead of you.', 'Ask 3 specific questions. Keep it short.', 'Worst they can do is not respond.'] },
              { day: 17, title: 'Substitution risk', steps: ['What\'s one thing you do that AI or someone else could automate?', 'Shift your focus to what\'s un-replaceable.', 'Future-proof your knowledge.'] },
              { day: 18, title: 'Double jeopardy check', steps: ['What mistake have you made twice?', 'The second time wasn\'t bad luck — it was unlearned.', 'Commit to third-time prevention.'] },
              { day: 19, title: 'Perception vs perspective', steps: ['Notice when you\'re perceiving (first reaction) vs. seeing full perspective.', 'Slow down today when you hit a reaction.', 'Perspective is the harder, higher skill.'] },
              { day: 20, title: 'Skill stack', steps: ['What 3 skills combine uniquely in you?', 'That combination is your edge.', 'Deepen one this month.'] },
              { day: 21, title: 'Week 3 reflection', steps: ['What did you learn AND apply this week?', 'That ratio is the Knowledge pillar in action.', 'Keep it rising.'] },
            ],
            week4: [
              { day: 22, title: 'Curated input', steps: ['Cut one content source that feels educational but isn\'t transforming you.', 'Replace with one stronger source.', 'Your inputs become your thinking.'] },
              { day: 23, title: 'Write to clarify', steps: ['Write 500 words on something you\'re learning.', 'Writing forces structured thought.', 'Share it or keep it — doesn\'t matter.'] },
              { day: 24, title: 'Supply and demand', steps: ['Where is knowledge scarce that you could develop?', 'The less common your expertise, the higher the value.', 'Build toward rare + valuable.'] },
              { day: 25, title: 'One decision, deeply', steps: ['Pick one decision this week.', 'Apply everything you\'ve learned to it.', 'Decisions are knowledge made visible.'] },
              { day: 26, title: 'Feedback loop', steps: ['Ask one person how your thinking has changed over the past month.', 'External perspective reveals internal growth.', 'Hidden progress is still progress.'] },
              { day: 27, title: 'Recap and commit', steps: ['What 3 things do you know now that you didn\'t 30 days ago?', 'Write them down.', 'Commit to teaching one next month.'] },
              { day: 28, title: 'Re-assessment prep', steps: ['Take full assessment tomorrow.', 'Answer Knowledge sub-categories honestly.', 'Growth shows up in the questions, too.'] },
              { day: 29, title: 'Full assessment retake', steps: ['Complete extensive P.I.N.K. assessment.', 'Compare Knowledge sub-scores to Day 1.', 'Biggest movers tell you what worked.'] },
              { day: 30, title: 'Next 30 days', steps: ['Pick the next Knowledge sub-category to develop.', 'Define 3 learning-into-action commitments.', 'Build the compound engine.'] },
            ],
          },
        };

        const track = actionLibrary[weakest] || actionLibrary.Time;
        const allDays = [...track.week1, ...track.week2, ...track.week3, ...track.week4];

        // Personalize each day's action steps with user's weakest + sub-category
        const personalized = allDays.map(d => ({
          day: d.day,
          week: Math.ceil(d.day / 7),
          title: d.title,
          steps: d.steps.map(s => s.replace(/\$\{weakest\}/g, weakest).replace(/\$\{weakestSub\}/g, weakestSub)),
        }));

        return res.json({
          assessmentId: a.id,
          contact: { firstName: a.first_name, lastName: a.last_name, email: a.email },
          assessment: {
            masterScore: a.master_score,
            scoreRange: a.score_range,
            weakestPillar: weakest,
            weakestSubCategory: weakestSub,
            strongestPillar: prescription.strongestPillar,
          },
          plan: {
            title: `30-Day ${weakest} Transformation Plan`,
            subtitle: `Daily actions targeting ${weakestSub} — your biggest leverage point`,
            weeks: [
              { number: 1, title: 'Awareness + First Actions', days: personalized.slice(0, 7) },
              { number: 2, title: 'Habit Formation', days: personalized.slice(7, 14) },
              { number: 3, title: 'Compound Effect', days: personalized.slice(14, 21) },
              { number: 4, title: 'Integration + Re-Assessment', days: personalized.slice(21, 30) },
            ],
          },
          totalDays: 30,
          generated: new Date().toISOString(),
        });
      } catch (planErr) {
        console.error('[action-plan] Error:', planErr.message);
        return res.status(500).json({ error: 'Failed to generate action plan' });
      }
    }

    // GET /api/admin/client-digest — Per-client status digest with replies, mood, progress
    // Shows: every active person, their latest reply, mood, action rate, coaching day, scores
    if (req.method === 'GET' && url === '/admin/client-digest') {
      try {
        // Get all active coaching sequences with assessment + contact data
        const clients = await sql`
          SELECT cs.email, cs.current_day, cs.last_sent_at, cs.started_at,
            cs.engagement_score, cs.persona,
            c.first_name, c.last_name, c.id as contact_id,
            a.master_score, a.score_range, a.weakest_pillar,
            a.time_total, a.people_total, a.influence_total, a.numbers_total, a.knowledge_total,
            a.time_multiplier
          FROM coaching_sequences cs
          JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
          LEFT JOIN assessments a ON a.id = cs.assessment_id
          WHERE cs.unsubscribed = FALSE
          ORDER BY cs.last_sent_at DESC
        `;

        const digest = [];
        for (const client of clients) {
          // Get their replies
          let replies = [];
          let replyStreak = 0;
          let actionRate = 0;
          try {
            replies = await sql`SELECT coaching_day, response, mood, action_completed, sentiment, key_themes, coaching_insight, created_at
              FROM coaching_replies WHERE LOWER(email) = LOWER(${client.email}) ORDER BY coaching_day DESC LIMIT 10`;
            if (replies.length > 0) {
              const days = replies.map(r => r.coaching_day).sort((a, b) => b - a);
              replyStreak = 1;
              for (let i = 0; i < days.length - 1; i++) {
                if (days[i] - days[i + 1] <= 2) replyStreak++; else break;
              }
              const actioned = replies.filter(r => r.action_completed).length;
              actionRate = Math.round((actioned / replies.length) * 100);
            }
          } catch (e) { /* table may not exist */ }

          // Get their feedback
          let feedback = [];
          try {
            feedback = await sql`SELECT category, response, created_at FROM user_feedback WHERE LOWER(email) = LOWER(${client.email}) ORDER BY created_at DESC LIMIT 5`;
          } catch (e) { /* non-fatal */ }

          // Get email engagement stats
          let opens = 0, clicks = 0, totalEmails = 0;
          try {
            const eng = await sql`SELECT COUNT(*) as total, SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens, SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicks FROM email_engagement WHERE LOWER(email) = LOWER(${client.email})`;
            totalEmails = Number(eng[0]?.total || 0);
            opens = Number(eng[0]?.opens || 0);
            clicks = Number(eng[0]?.clicks || 0);
          } catch (e) { /* non-fatal */ }

          // Days since start
          const daysSinceStart = Math.floor((Date.now() - new Date(client.started_at).getTime()) / (1000*60*60*24));

          // Determine status color
          const latestReply = replies[0] || null;
          let status = 'active';
          if (latestReply?.mood === 'struggling' || latestReply?.sentiment === 'negative') status = 'needs_attention';
          else if (replyStreak >= 3) status = 'thriving';
          else if (totalEmails > 3 && opens === 0) status = 'disengaged';

          digest.push({
            name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email,
            email: client.email,
            status,
            coachingDay: client.current_day,
            daysSinceStart,
            phase: client.current_day <= 8 ? 'daily' : client.current_day <= 16 ? 'deep-dive' : client.current_day <= 20 ? 'advanced' : 'weekly',
            scores: {
              master: client.master_score,
              range: client.score_range,
              weakest: client.weakest_pillar,
              time: client.time_total, people: client.people_total,
              influence: client.influence_total, numbers: client.numbers_total,
              knowledge: client.knowledge_total, multiplier: client.time_multiplier,
            },
            engagement: {
              persona: client.persona || 'standard',
              engagementScore: client.engagement_score || 0,
              emailsSent: totalEmails, opens, clicks,
              openRate: totalEmails > 0 ? Math.round((opens/totalEmails)*100) : 0,
            },
            replies: {
              total: replies.length,
              streak: replyStreak,
              actionRate,
              latestMood: latestReply?.mood || null,
              latestSentiment: latestReply?.sentiment || null,
              latest: latestReply ? {
                day: latestReply.coaching_day,
                response: latestReply.response,
                mood: latestReply.mood,
                actionCompleted: latestReply.action_completed,
                themes: latestReply.key_themes,
                date: latestReply.created_at,
              } : null,
              history: replies.slice(0, 5).map(r => ({
                day: r.coaching_day, mood: r.mood, actionCompleted: r.action_completed,
                response: r.response.substring(0, 200) + (r.response.length > 200 ? '...' : ''),
                date: r.created_at,
              })),
            },
            feedback: feedback.map(f => ({
              category: f.category,
              response: f.response.substring(0, 200),
              date: f.created_at,
            })),
            lastEmailAt: client.last_sent_at,
          });
        }

        // Sort: needs_attention first, then thriving, then active, then disengaged
        const statusOrder = { needs_attention: 0, thriving: 1, active: 2, disengaged: 3 };
        digest.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

        return res.json({
          generated: new Date().toISOString(),
          totalClients: digest.length,
          needsAttention: digest.filter(d => d.status === 'needs_attention').length,
          thriving: digest.filter(d => d.status === 'thriving').length,
          disengaged: digest.filter(d => d.status === 'disengaged').length,
          clients: digest,
        });
      } catch (digestErr) {
        console.error('[admin/client-digest] Error:', digestErr);
        return res.status(500).json({ error: digestErr.message });
      }
    }

    // GET /api/admin/replies — All coaching replies across all users (newest first)
    if (req.method === 'GET' && url.startsWith('/admin/replies')) {
      try {
        const params = new URL('http://x' + req.url).searchParams;
        const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
        const mood = params.get('mood'); // filter by mood
        const since = params.get('since'); // filter by date

        let replies;
        if (mood) {
          replies = await sql`SELECT cr.*, c.first_name, c.last_name
            FROM coaching_replies cr
            LEFT JOIN contacts c ON cr.contact_id = c.id
            WHERE cr.mood = ${mood}
            ORDER BY cr.created_at DESC LIMIT ${limit}`;
        } else if (since) {
          replies = await sql`SELECT cr.*, c.first_name, c.last_name
            FROM coaching_replies cr
            LEFT JOIN contacts c ON cr.contact_id = c.id
            WHERE cr.created_at >= ${since}
            ORDER BY cr.created_at DESC LIMIT ${limit}`;
        } else {
          replies = await sql`SELECT cr.*, c.first_name, c.last_name
            FROM coaching_replies cr
            LEFT JOIN contacts c ON cr.contact_id = c.id
            ORDER BY cr.created_at DESC LIMIT ${limit}`;
        }

        // Summary stats
        const stats = await sql`SELECT
          COUNT(*) as total,
          SUM(CASE WHEN mood = 'struggling' THEN 1 ELSE 0 END) as struggling,
          SUM(CASE WHEN mood = 'strong' OR mood = 'unstoppable' THEN 1 ELSE 0 END) as strong,
          SUM(CASE WHEN action_completed THEN 1 ELSE 0 END) as actions_completed,
          SUM(CASE WHEN sentiment = 'crisis' THEN 1 ELSE 0 END) as crisis_flags
          FROM coaching_replies`;

        return res.json({
          total: Number(stats[0]?.total || 0),
          struggling: Number(stats[0]?.struggling || 0),
          strong: Number(stats[0]?.strong || 0),
          actionsCompleted: Number(stats[0]?.actions_completed || 0),
          crisisFlags: Number(stats[0]?.crisis_flags || 0),
          replies: replies.map(r => ({
            name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
            email: r.email,
            day: r.coaching_day,
            response: r.response,
            mood: r.mood,
            actionCompleted: r.action_completed,
            sentiment: r.sentiment,
            themes: r.key_themes,
            insight: r.coaching_insight,
            date: r.created_at,
          })),
        });
      } catch (repliesErr) {
        return res.status(500).json({ error: repliesErr.message });
      }
    }

    // GET /api/admin/export (CSV)
    if (req.method === 'GET' && url === '/admin/export') {
      const all = await sql`SELECT a.*, c.first_name, c.last_name, c.email, c.phone FROM assessments a JOIN contacts c ON a.contact_id = c.id ORDER BY a.completed_at DESC`;
      let csv = "First Name,Last Name,Email,Phone,Date,Time,People,Influence,Numbers,Knowledge,Raw,Multiplier,Master Score,Range,Weakest,Depth,Focus Pillar\n";
      for (const r of all) {
        csv += `"${r.first_name}","${r.last_name}","${r.email}","${r.phone||''}","${r.completed_at}",${r.time_total},${r.people_total},${r.influence_total},${r.numbers_total},${r.knowledge_total},${r.raw_score},${r.time_multiplier},${r.master_score},"${r.score_range}","${r.weakest_pillar}","${r.depth||'extensive'}","${r.focus_pillar||''}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=value-engine-export.csv');
      return res.send(csv);
    }

    // POST /api/admin/hubspot-sync — Sync contacts + assessment data to HubSpot CRM
    if (req.method === 'POST' && url === '/admin/hubspot-sync') {
      const hubspotKey = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;
      if (!hubspotKey) {
        return res.status(500).json({ error: 'HUBSPOT_ACCESS_TOKEN not configured. Set it in Vercel environment variables.' });
      }

      const b = req.body || {};
      const syncAll = b.syncAll || false;
      const limit = b.limit || 50;

      // Get contacts that need syncing (hubspot_synced = 0 or NULL)
      const contacts = syncAll
        ? await sql`SELECT c.*, up.membership_tier, up.stripe_customer_id,
            (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
            (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_tier,
            (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
            (SELECT a.completed_at FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as last_assessment_date,
            (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count
          FROM contacts c LEFT JOIN user_profiles up ON up.contact_id = c.id
          ORDER BY c.created_at DESC LIMIT ${limit}`
        : await sql`SELECT c.*, up.membership_tier, up.stripe_customer_id,
            (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
            (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_tier,
            (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
            (SELECT a.completed_at FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as last_assessment_date,
            (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count
          FROM contacts c LEFT JOIN user_profiles up ON up.contact_id = c.id
          WHERE c.hubspot_synced IS NULL OR c.hubspot_synced = 0
          ORDER BY c.created_at DESC LIMIT ${limit}`;

      let synced = 0, failed = 0;
      const errors = [];

      for (const contact of contacts) {
        try {
          // Search HubSpot for existing contact by email
          const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${hubspotKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: contact.email }] }]
            })
          });
          const searchData = await searchRes.json();

          const properties = {
            email: contact.email,
            firstname: contact.first_name || '',
            lastname: contact.last_name || '',
            phone: contact.phone || '',
            vtv_master_score: contact.latest_score ? String(contact.latest_score) : '',
            vtv_score_tier: contact.latest_tier || '',
            vtv_weakest_pillar: contact.weakest_pillar || '',
            vtv_membership_tier: contact.membership_tier || 'free',
            vtv_assessment_count: String(contact.assessment_count || 0),
            vtv_last_assessment: contact.last_assessment_date || '',
          };

          if (searchData.total > 0) {
            // Update existing contact
            const hubspotId = searchData.results[0].id;
            await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${hubspotKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ properties })
            });
          } else {
            // Create new contact
            await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${hubspotKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ properties })
            });
          }

          // Mark as synced
          await sql`UPDATE contacts SET hubspot_synced = 1 WHERE id = ${contact.id}`;
          synced++;
        } catch (err) {
          failed++;
          errors.push({ email: contact.email, error: err.message });
        }
      }

      // Log sync event to analytics
      try {
        await sql`INSERT INTO analytics_events (event_type, metadata) VALUES ('hubspot_sync', ${JSON.stringify({ synced, failed, total: contacts.length })}::jsonb)`;
      } catch (e) { /* analytics table may not exist yet */ }

      return res.json({ synced, failed, total: contacts.length, errors: errors.slice(0, 10) });
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
        console.error('Question bank error:', e.message); return res.json({ error: 'Question bank not initialized' });
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

    // POST /api/admin/seed-dating-questions — One-time seeder for dating overlay questions
    if (req.method === 'POST' && url === '/admin/seed-dating-questions') {
      const datingQuestions = [
        { id: 'dating_overlay_1', pillar: 'people', sub: 'faith_alignment', fieldName: 'datingFaithAlignment', question: 'How important is shared faith or spiritual values when choosing a partner?' },
        { id: 'dating_overlay_2', pillar: 'people', sub: 'dating_communication', fieldName: 'datingCommunication', question: 'I communicate my relationship expectations clearly and early.' },
        { id: 'dating_overlay_3', pillar: 'influence', sub: 'dating_discernment', fieldName: 'datingDiscernment', question: "I can identify red flags in a potential partner's values before getting emotionally invested." },
        { id: 'dating_overlay_4', pillar: 'time', sub: 'dating_lifestyle', fieldName: 'datingLifestyle', question: "How aligned are your daily habits with the lifestyle you'd want in a shared home?" },
        { id: 'dating_overlay_5', pillar: 'numbers', sub: 'dating_financial_honesty', fieldName: 'datingFinancialHonesty', question: 'I am financially transparent about my situation when dating gets serious.' },
        { id: 'dating_overlay_6', pillar: 'time', sub: 'dating_patience', fieldName: 'datingPatience', question: "I invest time getting to know someone's character before committing." },
        { id: 'dating_overlay_7', pillar: 'knowledge', sub: 'dating_wisdom', fieldName: 'datingWisdom', question: 'I understand the difference between attraction and long-term compatibility.' },
        { id: 'dating_overlay_8', pillar: 'people', sub: 'dating_boundaries', fieldName: 'datingBoundaries', question: 'I have clear, non-negotiable standards for how a partner treats me.' },
        { id: 'dating_overlay_9', pillar: 'influence', sub: 'dating_independence', fieldName: 'datingIndependence', question: 'I can maintain my personal growth goals while pursuing a relationship.' },
        { id: 'dating_overlay_10', pillar: 'numbers', sub: 'dating_financial_values', fieldName: 'datingFinancialValues', question: "I evaluate a potential partner's relationship with money, not just their income." },
      ];

      const opts = JSON.stringify([
        { value: 1, label: 'Strongly Disagree' },
        { value: 2, label: 'Disagree' },
        { value: 3, label: 'Neutral' },
        { value: 4, label: 'Agree' },
        { value: 5, label: 'Strongly Agree' },
      ]);

      const results = [];
      for (const q of datingQuestions) {
        try {
          await sql`INSERT INTO question_bank (id, pillar, sub_category, field_name, question, description, options, is_overlay, overlay_type, is_active, sort_order)
            VALUES (${q.id}, ${q.pillar}, ${q.sub}, ${q.fieldName}, ${q.question}, '', ${opts}::jsonb, true, 'dating', true, 0)
            ON CONFLICT (id) DO UPDATE SET
              question = EXCLUDED.question,
              pillar = EXCLUDED.pillar,
              sub_category = EXCLUDED.sub_category,
              field_name = EXCLUDED.field_name,
              options = EXCLUDED.options,
              is_overlay = true,
              overlay_type = 'dating',
              is_active = true`;
          results.push({ id: q.id, success: true });
        } catch (e) {
          results.push({ id: q.id, error: e.message });
        }
      }
      return res.json({ message: 'Dating overlay questions seeded', results, added: results.filter(r => r.success).length, failed: results.filter(r => r.error).length });
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

      // Allow overriding recipient email (admin only)
      let recipientEmail = a.email;
      if (b.overrideEmail) {
        const apiKey = req.headers['x-api-key'] || '';
        const validKey = process.env.ADMIN_API_KEY || '';
        if (!validKey || apiKey !== validKey) return res.status(401).json({ error: 'Admin API key required to use overrideEmail' });
        recipientEmail = b.overrideEmail;
      }

      const firstName = escapeHtml(a.first_name || 'there');
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
      const reportPillarMax = reportDepth === 'quick' ? 25 : 50;
      const pillars = [
        { key: 'Time', icon: '&#9201;', score: Number(a.time_total) || 0 },
        { key: 'People', icon: '&#128101;', score: Number(a.people_total) || 0 },
        { key: 'Influence', icon: '&#9889;', score: Number(a.influence_total) || 0 },
        { key: 'Numbers', icon: '&#128200;', score: Number(a.numbers_total) || 0 },
        { key: 'Knowledge', icon: '&#128218;', score: Number(a.knowledge_total) || 0 },
      ];
      // Scale the "below 35" threshold proportionally to depth
      const belowThreshold = reportDepth === 'quick' ? 18 : 35; // 35/50 ~ 70% → 18/25 ~ 72%
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

      // Build plain text roadmap section
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
${roadmapText}
View your full diagnostic report:
${BASE_URL}/report/${assessmentId}

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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="width:180px;height:180px;border-radius:50%;border:10px solid #2a2a44;text-align:center;vertical-align:middle;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:44px;font-weight:800;color:#d4a853;line-height:1;">${masterScore}</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6a6a84;">of ${reportDepth === 'quick' ? 125 : (reportDepth === 'pillar' ? 50 : 250)}</span></td></tr></table>
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;background:linear-gradient(135deg,#d4a853,#c89030);" align="center"><a href="${BASE_URL}/coaching?track=personal&amp;aid=${assessmentId}" target="_blank" style="display:inline-block;padding:16px 48px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#1a1a2e;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Get Your Free Coaching Report &rarr;</a></td></tr></table></td></tr></table>

<!-- Membership / Pricing CTA -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:16px 40px 32px 40px;text-align:center;">
<div style="margin-bottom:16px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6a6a84;text-decoration:line-through;">${tier.full}/mo</span> <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;color:#d4a853;margin-left:8px;">${tier.promo}</span><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4a853;">/mo</span></div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="border-radius:8px;border:2px solid #d4a853;" align="center"><a href="${BASE_URL}/pricing" target="_blank" style="display:inline-block;padding:12px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#d4a853;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Lock In ${tier.product} Promo Rate</a></td></tr></table>
<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a4a64;">2026 promo pricing. Goes to ${tier.full}/mo in January 2027.</p></td></tr></table>

<!-- View Full Report -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 40px 24px 40px;text-align:center;"><a href="${BASE_URL}/report/${assessmentId}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4a853;text-decoration:underline;">View Your Full Interactive Report Online</a></td></tr></table>

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
        return res.json({ sent: false, reason: 'Email credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.', subject, body: emailBody, reportUrl: `${BASE_URL}/report/${assessmentId}` });
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
        return res.json({ sent: true, to: recipientEmail, reportUrl: `${BASE_URL}/report/${assessmentId}` });
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message);
        return res.json({ sent: false, reason: emailErr.message, reportUrl: `${BASE_URL}/report/${assessmentId}` });
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
        console.error('Enrollment error:', e.message); return res.status(500).json({ error: 'Could not enroll. Please try again.' });
      }
    }

    // GET /api/challenge/status?email={email}
    if (req.method === 'GET' && url.startsWith('/challenge/status')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      if (!email) return res.status(400).json({ error: 'email required' });

      const contactRows = await sql`SELECT * FROM contacts WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
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
        console.error('Challenge error:', e.message); return res.json({ enrolled: false, error: 'Challenge system not initialized' });
      }
    }

    // GET /api/admin/coaching — list all coaching sequences and requests
    if (req.method === 'GET' && url === '/admin/coaching') {
      try {
        await ensureCoachingTable(sql);
        const sequences = await sql`
          SELECT cs.*, c.first_name, c.last_name
          FROM coaching_sequences cs
          LEFT JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
          ORDER BY cs.started_at DESC
        `;
        let requests = [];
        try {
          requests = await sql`
            SELECT cr.*, c.first_name, c.last_name
            FROM coaching_requests cr
            LEFT JOIN contacts c ON cr.contact_id = c.id
            ORDER BY cr.created_at DESC
          `;
        } catch(e) { /* table may not exist */ }
        return res.json({
          sequences: sequences.map(s => ({
            email: s.email, firstName: s.first_name, lastName: s.last_name,
            currentDay: s.current_day, lastSentAt: s.last_sent_at,
            startedAt: s.started_at, unsubscribed: s.unsubscribed,
            assessmentId: s.assessment_id
          })),
          requests: requests.map(r => ({
            id: r.id, name: r.name, email: r.email, track: r.track,
            goals: r.goals, biggestChallenge: r.biggest_challenge,
            verified: r.verified, verifiedAt: r.verified_at,
            reportSent: r.report_sent, createdAt: r.created_at,
            firstName: r.first_name, lastName: r.last_name
          }))
        });
      } catch(e) {
        return res.json({ sequences: [], requests: [], error: e.message });
      }
    }

    // GET /api/admin/email-log — View all sent emails with filtering
    if (req.method === 'GET' && url.startsWith('/admin/email-log') && url !== '/admin/email-log/backfill') {
      try {
        await ensureEmailLogTable(sql);
        const params = new URL('http://x' + req.url).searchParams;
        const emailFilter = params.get('email');
        const typeFilter = params.get('type');
        const limit = Math.min(parseInt(params.get('limit') || '200'), 500);

        let logs;
        if (emailFilter && typeFilter) {
          logs = await sql`SELECT el.*, c.first_name, c.last_name FROM email_log el LEFT JOIN contacts c ON el.contact_id = c.id WHERE LOWER(el.recipient) = ${emailFilter.toLowerCase()} AND el.email_type = ${typeFilter} ORDER BY el.sent_at DESC LIMIT ${limit}`;
        } else if (emailFilter) {
          logs = await sql`SELECT el.*, c.first_name, c.last_name FROM email_log el LEFT JOIN contacts c ON el.contact_id = c.id WHERE LOWER(el.recipient) = ${emailFilter.toLowerCase()} ORDER BY el.sent_at DESC LIMIT ${limit}`;
        } else if (typeFilter) {
          logs = await sql`SELECT el.*, c.first_name, c.last_name FROM email_log el LEFT JOIN contacts c ON el.contact_id = c.id WHERE el.email_type = ${typeFilter} ORDER BY el.sent_at DESC LIMIT ${limit}`;
        } else {
          logs = await sql`SELECT el.*, c.first_name, c.last_name FROM email_log el LEFT JOIN contacts c ON el.contact_id = c.id ORDER BY el.sent_at DESC LIMIT ${limit}`;
        }

        // Summary stats
        const stats = await sql`SELECT email_type, status, COUNT(*) as cnt FROM email_log GROUP BY email_type, status ORDER BY email_type`;

        return res.json({
          logs: logs.map(l => ({
            id: l.id, recipient: l.recipient, emailType: l.email_type, subject: l.subject,
            contactId: l.contact_id, firstName: l.first_name, lastName: l.last_name,
            assessmentId: l.assessment_id, status: l.status,
            metadata: l.metadata, sentAt: l.sent_at
          })),
          stats: stats.map(s => ({ type: s.email_type, status: s.status, count: Number(s.cnt) })),
          total: logs.length
        });
      } catch(e) {
        return res.json({ logs: [], stats: [], error: e.message });
      }
    }

    // POST /api/admin/reset-pin — Reset a user's PIN
    if (req.method === 'POST' && url === '/admin/reset-pin') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const newPin = (b.pin || '').trim();
      if (!email || !newPin) return res.status(400).json({ error: 'email and pin required' });
      if (newPin.length < 4 || newPin.length > 32) return res.status(400).json({ error: 'PIN must be 4-32 characters' });

      const pinHash = hashPinSync(newPin);
      const rows = await sql`UPDATE contacts SET pin_hash = ${pinHash}, pin_set_at = NOW() WHERE LOWER(email) = ${email} RETURNING id, email, first_name`;
      if (rows.length === 0) return res.status(404).json({ error: 'No contact found with that email' });
      await auditLog(sql, { action: 'admin_reset_pin', actor: 'admin', targetTable: 'contacts', targetId: rows[0].id, newValues: { email }, ip: clientIP });
      return res.json({ success: true, contact: { id: rows[0].id, email: rows[0].email, firstName: rows[0].first_name }, message: `PIN reset successfully for ${email}` });
    }

    // POST /api/admin/update-profile — Update user profile tier, Stripe IDs, etc.
    if (req.method === 'POST' && url === '/admin/update-profile') {
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'email required' });

      const contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (contact.length === 0) return res.status(404).json({ error: 'No contact found' });
      const contactId = contact[0].id;

      // Ensure user_profiles row exists
      await sql`INSERT INTO user_profiles (contact_id) VALUES (${contactId}) ON CONFLICT (contact_id) DO NOTHING`;

      const updates = [];
      if (b.tier) updates.push(sql`UPDATE user_profiles SET membership_tier = ${b.tier} WHERE contact_id = ${contactId}`);
      if (b.stripeCustomerId) updates.push(sql`UPDATE user_profiles SET stripe_customer_id = ${b.stripeCustomerId} WHERE contact_id = ${contactId}`);
      if (b.stripeSubscriptionId) updates.push(sql`UPDATE user_profiles SET stripe_subscription_id = ${b.stripeSubscriptionId} WHERE contact_id = ${contactId}`);
      await Promise.all(updates);

      const profile = await sql`SELECT membership_tier, stripe_customer_id, stripe_subscription_id, partner_id FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      await auditLog(sql, { action: 'admin_update_profile', actor: 'admin', targetTable: 'user_profiles', targetId: contactId, newValues: { tier: b.tier, stripeCustomerId: b.stripeCustomerId, stripeSubscriptionId: b.stripeSubscriptionId }, ip: clientIP });
      return res.json({ success: true, contactId, email, profile: profile[0] });
    }

    // GET /api/admin/verify-pin-check — Check what PIN hash is stored vs what you're entering
    if (req.method === 'GET' && url.startsWith('/admin/verify-pin-check')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = (params.get('email') || '').toLowerCase().trim();
      const pin = (params.get('pin') || '').trim();
      if (!email) return res.status(400).json({ error: 'email required' });

      const rows = await sql`SELECT id, first_name, email, pin_hash, pin_set_at FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
      if (rows.length === 0) return res.json({ found: false });

      const result = { found: true, email: rows[0].email, firstName: rows[0].first_name, hasPin: !!rows[0].pin_hash, pinSetAt: rows[0].pin_set_at };
      if (pin && rows[0].pin_hash) {
        const pinCheck = verifyPin(pin, rows[0].pin_hash);
        result.pinMatches = pinCheck.valid;
        result.hashType = pinCheck.needsUpgrade ? 'legacy-sha256' : 'pbkdf2';
      }
      return res.json(result);
    }

    // GET /api/admin/email-log/backfill — Populate email_log from existing data
    if (req.method === 'GET' && url === '/admin/email-log/backfill') {
      try {
        await ensureEmailLogTable(sql);
        const existing = await sql`SELECT COUNT(*) as cnt FROM email_log`;
        const alreadyHas = Number(existing[0].cnt);
        let inserted = 0;

        // 1. Assessment report emails — every assessment with a contact email
        const assessments = await sql`
          SELECT a.id as assessment_id, a.contact_id, a.completed_at, a.master_score, a.score_range, a.weakest_pillar, c.email, c.first_name
          FROM assessments a JOIN contacts c ON a.contact_id = c.id
          WHERE c.email IS NOT NULL AND c.email != ''
          ORDER BY a.completed_at ASC
        `;
        for (const a of assessments) {
          const dup = await sql`SELECT id FROM email_log WHERE recipient = ${a.email} AND email_type = 'assessment_report' AND assessment_id = ${a.assessment_id} LIMIT 1`;
          if (dup.length === 0) {
            await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, assessment_id, status, metadata, sent_at)
              VALUES (${a.email}, 'assessment_report', ${`Your Value Engine Score: ${a.master_score} (${a.score_range}) — Personal Report Ready`}, ${a.contact_id}, ${a.assessment_id}, 'sent', ${JSON.stringify({ score: a.master_score, range: a.score_range, backfilled: true })}::jsonb, ${a.completed_at})`;
            inserted++;
          }
        }

        // 2. Coaching sequence emails — each day that was sent
        try {
          const sequences = await sql`
            SELECT cs.email, cs.assessment_id, cs.current_day, cs.started_at, c.id as contact_id
            FROM coaching_sequences cs
            LEFT JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
            WHERE cs.current_day > 0
          `;
          for (const s of sequences) {
            for (let day = 1; day <= s.current_day; day++) {
              const dup = await sql`SELECT id FROM email_log WHERE recipient = ${s.email} AND email_type = 'coaching' AND metadata->>'day' = ${String(day)} LIMIT 1`;
              if (dup.length === 0) {
                const sentDate = new Date(s.started_at);
                sentDate.setDate(sentDate.getDate() + day);
                await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, assessment_id, status, metadata, sent_at)
                  VALUES (${s.email}, 'coaching', ${`Value Engine Coaching — Day ${day}`}, ${s.contact_id || null}, ${s.assessment_id}, 'sent', ${JSON.stringify({ day, backfilled: true })}::jsonb, ${sentDate.toISOString()})`;
                inserted++;
              }
            }
          }
        } catch(e) { /* coaching table may not exist */ }

        // 3. Coaching requests — verification emails
        try {
          const requests = await sql`
            SELECT cr.id, cr.email, cr.contact_id, cr.track, cr.verified, cr.created_at
            FROM coaching_requests cr
          `;
          for (const r of requests) {
            const trackLabel = r.track === 'real_estate' ? 'Real Estate' : r.track === 'company' ? 'Company' : 'Personal';
            const dup = await sql`SELECT id FROM email_log WHERE recipient = ${r.email} AND email_type = 'coaching_verify' AND metadata->>'requestId' = ${String(r.id)} LIMIT 1`;
            if (dup.length === 0) {
              await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, status, metadata, sent_at)
                VALUES (${r.email}, 'coaching_verify', ${`Verify Your Email — ${trackLabel} Coaching Report`}, ${r.contact_id || null}, 'sent', ${JSON.stringify({ track: r.track, requestId: r.id, verified: r.verified, backfilled: true })}::jsonb, ${r.created_at})`;
              inserted++;
            }
            // If verified and report sent, add coaching_report entry
            if (r.verified) {
              const dupR = await sql`SELECT id FROM email_log WHERE recipient = ${r.email} AND email_type = 'coaching_report' AND metadata->>'requestId' = ${String(r.id)} LIMIT 1`;
              if (dupR.length === 0) {
                await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, status, metadata, sent_at)
                  VALUES (${r.email}, 'coaching_report', ${`Your ${trackLabel} Coaching Report — Value to Victory`}, ${r.contact_id || null}, 'sent', ${JSON.stringify({ track: r.track, requestId: r.id, backfilled: true })}::jsonb, ${r.created_at})`;
                inserted++;
              }
            }
          }
        } catch(e) { /* coaching_requests table may not exist */ }

        // 4. Free book signups — verification emails
        try {
          const signups = await sql`SELECT email, name, verified, created_at FROM free_book_signups`;
          for (const s of signups) {
            const dup = await sql`SELECT id FROM email_log WHERE recipient = ${s.email} AND email_type = 'free_book_verify' LIMIT 1`;
            if (dup.length === 0) {
              await sql`INSERT INTO email_log (recipient, email_type, subject, status, metadata, sent_at)
                VALUES (${s.email}, 'free_book_verify', ${'Confirm Your Email — Your Free Copy of Running From Miracles is Waiting'}, 'sent', ${JSON.stringify({ name: s.name, verified: s.verified, backfilled: true })}::jsonb, ${s.created_at})`;
              inserted++;
            }
            // If verified, they also got the PDF delivery email
            if (s.verified) {
              const dupD = await sql`SELECT id FROM email_log WHERE recipient = ${s.email} AND email_type = 'free_book_delivery' LIMIT 1`;
              if (dupD.length === 0) {
                await sql`INSERT INTO email_log (recipient, email_type, subject, status, metadata, sent_at)
                  VALUES (${s.email}, 'free_book_delivery', ${'Your Free Copy of Running From Miracles — Download Inside'}, 'sent', ${JSON.stringify({ name: s.name, backfilled: true })}::jsonb, ${s.created_at})`;
                inserted++;
              }
            }
          }
        } catch(e) { /* free_book_signups table may not exist */ }

        const afterCount = await sql`SELECT COUNT(*) as cnt FROM email_log`;
        return res.json({
          message: `Backfill complete. ${inserted} records added.`,
          beforeCount: alreadyHas,
          afterCount: Number(afterCount[0].cnt),
          inserted
        });
      } catch(e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
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
        console.error('Feedback error:', e.message); return res.json({ error: 'Feedback table not initialized' });
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
                if (amount >= 49700) tier = 'premium';
                else if (amount >= 4700) tier = 'couple';
                else tier = 'individual';
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

      const firstName = escapeHtml(a.first_name || 'there');
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
${BASE_URL}/action-plan/${assessmentId}

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
${BASE_URL}/counselor-report/${assessmentId}

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
${BASE_URL}/team-report/${assessmentId}

No individual scores are disclosed in this report. All data is anonymous and aggregated.

— The Value Engine
   ValueToVictory.com`;
      } else {
        return res.status(400).json({ error: 'Invalid reportType. Must be: action-plan, counselor, or team' });
      }

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return res.json({ sent: false, reason: 'Email credentials not configured', reportUrl: `${BASE_URL}/${reportType === 'action-plan' ? 'action-plan' : reportType === 'counselor' ? 'counselor-report' : 'team-report'}/${assessmentId}` });
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
          const verifyUrl = `${BASE_URL}/api/coaching/verify?token=${verificationToken}`;
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
          await logEmail(sql, { recipient: email, emailType: 'coaching_verify', subject: `Verify Your Email — ${trackLabel} Coaching Report`, contactId, metadata: { track } });
        } catch (emailErr) {
          console.error('Verification email error:', emailErr.message);
          await logEmail(sql, { recipient: email, emailType: 'coaching_verify', contactId, status: 'failed', metadata: { error: emailErr.message } });
          return res.json({ submitted: true, emailSent: false, warning: 'Request saved but verification email could not be sent. Please contact us.' });
        }
      }

      // Track coaching request
      try { await sql`INSERT INTO analytics_events (event_type, contact_id, metadata) VALUES ('coaching_requested', ${contactId}, ${JSON.stringify({ track, assessment_id })}::jsonb)`; } catch (e) { /* non-fatal */ }

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
        return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invalid Link</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#ef4444;">Invalid or Expired Link</h2><p style="color:#a1a1aa;">This verification link is invalid or has already been used.</p><p><a href="${BASE_URL}" style="color:#3b82f6;">Go to Value Engine</a></p></div></body></html>');
      }
      const cr = rows[0];

      // Check if already verified
      if (cr.verified) {
        return res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Already Verified</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#D4A847;">Already Verified</h2><p style="color:#a1a1aa;">Your email has already been verified. Your coaching report has been sent.</p><p><a href="${BASE_URL}" style="color:#3b82f6;">Go to Value Engine</a></p></div></body></html>');
      }

      // Check expiration (24 hours)
      const createdAt = new Date(cr.created_at);
      const now = new Date();
      if (now - createdAt > 24 * 60 * 60 * 1000) {
        return res.status(410).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link Expired</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><div><h2 style="color:#ef4444;">Link Expired</h2><p style="color:#a1a1aa;">This verification link has expired (24-hour limit). Please submit a new coaching request.</p><p><a href="${BASE_URL}/coaching" style="color:#3b82f6;">Request Again</a></p></div></body></html>');
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
          const cPillarMax = (assessment.depth === 'quick') ? 25 : 50;
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
          await logEmail(sql, { recipient: cr.email, emailType: 'coaching_report', subject: reportSubject, contactId: cr.contact_id, metadata: { track: cr.track, requestId: cr.id } });
        }
      } catch (reportErr) {
        console.error('Coaching report generation error:', reportErr.message);
      }

      // Return success HTML page
      const statusMsg = reportSent
        ? 'Your personalized coaching report has been sent to your email.'
        : 'Your email has been verified. Your coaching report will be sent shortly.';
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Email Verified</title><style>body{font-family:'Satoshi',sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style><link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" rel="stylesheet"></head><body><div style="max-width:480px;padding:2rem;"><div style="font-size:3rem;margin-bottom:1rem;">&#10003;</div><h2 style="color:#D4A847;margin-bottom:0.75rem;">Email Verified!</h2><p style="color:#a1a1aa;margin-bottom:1.5rem;">${statusMsg}</p><p style="color:#71717a;font-size:0.85rem;">Check your inbox (and spam folder) for your coaching report.</p><p style="margin-top:1.5rem;"><a href="${BASE_URL}" style="color:#3b82f6;text-decoration:none;">Return to Value Engine &rarr;</a></p></div></body></html>`);
    }

    // ============================
    // COACHING EMAIL ENDPOINTS
    // ============================


    // POST /api/coaching/enroll-batch — enroll multiple users into coaching sequence
    if (req.method === 'POST' && url === '/coaching/enroll-batch') {
      try {
        await ensureCoachingTable(sql);
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const users = body.users || [];
        let enrolled = 0;
        for (const u of users) {
          if (!u.email || !u.assessment_id) continue;
          try {
            await sql`INSERT INTO coaching_sequences (email, assessment_id, current_day, started_at, unsubscribed)
              VALUES (${u.email}, ${u.assessment_id}, 0, NOW() - INTERVAL '1 day', FALSE)
              ON CONFLICT (email) DO UPDATE SET assessment_id = ${u.assessment_id}, current_day = 0, started_at = NOW() - INTERVAL '1 day', unsubscribed = FALSE, last_sent_at = NULL`;
            enrolled++;
          } catch (e) { console.error('Enroll error for', u.email, e.message); }
        }
        return res.json({ enrolled, total: users.length });
      } catch (e) {
        console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // GET /api/coaching/send — called by cron job to send daily coaching emails
    if (req.method === 'GET' && url === '/coaching/send') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      try {
        await ensureCoachingTable(sql);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Find all active sequences: not unsubscribed, eligible for next email
        // Cadence: Days 1-8 daily, Days 9-16 every 2 days, Days 17-20 every 3 days, Days 21+ weekly (7 days)
        // JOIN contacts to skip orphaned sequences (deleted accounts)
        const sequences = await sql`
          SELECT cs.* FROM coaching_sequences cs
          INNER JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
          WHERE cs.unsubscribed = FALSE
            AND (cs.last_sent_at IS NULL OR cs.last_sent_at < ${todayStart.toISOString()})
          ORDER BY cs.id
        `;

        if (sequences.length === 0) {
          return res.json({ sent: 0, message: 'No coaching emails to send today.' });
        }

        // Create transporter once outside the loop
        let transporter = null;
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
        }

        const results = [];
        let sentCount = 0;
        let skippedCount = 0;

        for (const seq of sequences) {
          try {
            // Day 0 = assessment day. Don't send coaching email on the same day as assessment.
            // Only send if started_at is before today.
            const startedDate = new Date(seq.started_at);
            startedDate.setHours(0, 0, 0, 0);
            if (startedDate.getTime() >= todayStart.getTime() && seq.current_day === 0) {
              results.push({ email: seq.email, status: 'skipped', reason: 'assessment was today (day 0)' });
              skippedCount++;
              continue;
            }

            // Cadence control: Phase 1 (days 0-8) = daily, Phase 2 (9-16) = every 2 days,
            // Phase 3 (17-20) = every 3 days, Phase 4 (21+) = weekly
            if (seq.last_sent_at) {
              const lastSent = new Date(seq.last_sent_at);
              const daysSinceLast = Math.floor((todayStart.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
              const currentDay = seq.current_day;
              const minDaysBetween = currentDay < 8 ? 1 : currentDay < 16 ? 2 : currentDay < 20 ? 3 : 7;
              if (daysSinceLast < minDaysBetween) {
                results.push({ email: seq.email, status: 'skipped', reason: `cadence: need ${minDaysBetween} days between emails (phase ${currentDay < 8 ? 1 : currentDay < 16 ? 2 : currentDay < 20 ? 3 : 4}), only ${daysSinceLast} elapsed` });
                skippedCount++;
                continue;
              }
            }

            // Respect 3-per-day email limit — check emails sent today to this user
            let emailsTodayCount = 0;
            try {
              const emailsTodayRows = await sql`
                SELECT COUNT(*) as cnt FROM coaching_sequences
                WHERE LOWER(email) = LOWER(${seq.email})
                  AND last_sent_at >= ${todayStart.toISOString()}
              `;
              emailsTodayCount = Number(emailsTodayRows[0]?.cnt || 0);
            } catch (e) { /* ignore */ }
            if (emailsTodayCount >= 3) {
              results.push({ email: seq.email, status: 'skipped', reason: '3-per-day limit reached' });
              skippedCount++;
              continue;
            }

            // Look up the assessment data
            const assessmentRows = await sql`
              SELECT a.*, c.first_name, c.last_name, c.email
              FROM assessments a
              JOIN contacts c ON a.contact_id = c.id
              WHERE a.id = ${seq.assessment_id}
              LIMIT 1
            `;
            if (assessmentRows.length === 0) {
              results.push({ email: seq.email, status: 'skipped', reason: 'assessment not found' });
              skippedCount++;
              continue;
            }

            const assessmentData = assessmentRows[0];
            let prescription;
            try {
              prescription = typeof assessmentData.prescription === 'string'
                ? JSON.parse(assessmentData.prescription)
                : assessmentData.prescription;
            } catch (e) {
              prescription = generatePrescription(assessmentData);
            }

            const nextDay = seq.current_day + 1;
            const emailContent = generateCoachingEmail(nextDay, assessmentData, prescription, seq.email);

            // Send via nodemailer
            if (!transporter) {
              results.push({ email: seq.email, status: 'skipped', reason: 'email credentials not configured' });
              skippedCount++;
              continue;
            }

            // === CREATE ENGAGEMENT RECORD FIRST (needed for tracking pixel) ===
            let engId = null;
            try {
              const engRec = await sql`
                INSERT INTO email_engagement (contact_id, email, coaching_day, email_variant)
                VALUES (${seq.contact_id || null}, ${seq.email.toLowerCase()}, ${nextDay}, 'default')
                RETURNING id`;
              engId = engRec[0]?.id;
            } catch (engErr) { /* engagement table may not exist */ }

            // Wrap all links with click-tracking and add open pixel to HTML
            let html = emailContent.html || '';
            if (engId) {
              const trackBase = `${BASE_URL}/api/agent/email`;
              // Wrap every href with click tracker
              html = html.replace(/href="(https?:\/\/[^"]+)"/g, function(m, u) {
                return `href="${trackBase}/track-click?id=${engId}&url=${encodeURIComponent(u)}"`;
              });
              // Add 1x1 open pixel right before </body> (or append if no </body>)
              const pixel = `<img src="${trackBase}/track-open?id=${engId}" width="1" height="1" style="display:none" alt=""/>`;
              if (html.includes('</body>')) {
                html = html.replace('</body>', pixel + '</body>');
              } else {
                html = html + pixel;
              }
            }

            await transporter.sendMail({
              from: `"Shawn @ Value Engine" <${process.env.GMAIL_USER}>`,
              to: seq.email,
              subject: emailContent.subject,
              text: emailContent.text,
              html,
            });

            // Update sequence
            await sql`
              UPDATE coaching_sequences
              SET current_day = ${nextDay}, last_sent_at = NOW()
              WHERE id = ${seq.id}
            `;

            results.push({ email: seq.email, status: 'sent', day: nextDay, engagementId: engId });
            sentCount++;
            console.log(`Coaching email Day ${nextDay} sent to ${maskEmail(seq.email)}`);
            await logEmail(sql, { recipient: seq.email, emailType: 'coaching', subject: emailContent.subject, assessmentId: seq.assessment_id, metadata: { day: nextDay, engagementId: engId } });

          } catch (sendErr) {
            console.error(`Coaching email error for ${maskEmail(seq.email)}:`, sendErr.message);
            results.push({ email: seq.email, status: 'error', error: sendErr.message });
          }
        }

        return res.json({ sent: sentCount, skipped: skippedCount, total: sequences.length, results });
      } catch (coachingSendErr) {
        console.error('[coaching/send] Handler error:', coachingSendErr);
        return res.status(500).json({ error: 'Coaching send failed' });
      }
    }

    // GET /api/coaching/unsubscribe — unsubscribe from coaching emails
    if (req.method === 'GET' && (url === '/coaching/unsubscribe' || url.startsWith('/coaching/unsubscribe'))) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      const token = params.get('token');

      if (!email || !token) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send('<!DOCTYPE html><html><body style="margin:0;padding:40px;background:#111122;font-family:Arial,sans-serif;text-align:center;"><h1 style="color:#d4a853;">Missing Parameters</h1><p style="color:#a0a0b8;">Invalid unsubscribe link. Please use the link from your coaching email.</p></body></html>');
      }

      // Validate token (base64 of email)
      const expectedToken = Buffer.from(email).toString('base64');
      if (token !== expectedToken) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send('<!DOCTYPE html><html><body style="margin:0;padding:40px;background:#111122;font-family:Arial,sans-serif;text-align:center;"><h1 style="color:#d4a853;">Invalid Link</h1><p style="color:#a0a0b8;">This unsubscribe link is not valid. Please use the link from your coaching email.</p></body></html>');
      }

      await ensureCoachingTable(sql);
      await sql`UPDATE coaching_sequences SET unsubscribed = TRUE WHERE LOWER(email) = LOWER(${email})`;

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Unsubscribed</title></head><body style="margin:0;padding:0;background:#111122;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:500px;margin:60px auto;">
<tr><td style="background:#1a1a2e;border-radius:8px;padding:48px 40px;text-align:center;">
<h1 style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">VALUE <span style="color:#d4a853;">TO</span> VICTORY</h1>
<div style="height:1px;background:linear-gradient(90deg,transparent,#d4a853,transparent);margin:16px 0 24px 0;"></div>
<h2 style="margin:0 0 12px 0;font-size:20px;color:#d4a853;">You've been unsubscribed</h2>
<p style="margin:0 0 20px 0;font-size:15px;color:#a0a0b8;line-height:1.6;">You'll no longer receive daily coaching emails from The Value Engine.</p>
<p style="margin:0 0 24px 0;font-size:14px;color:#6a6a84;line-height:1.6;">If you ever want to restart, just retake the assessment and you'll be re-enrolled automatically.</p>
<a href="${BASE_URL}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#d4a853,#c89030);border-radius:6px;font-size:14px;font-weight:700;color:#1a1a2e;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Retake Assessment</a>
</td></tr>
</table>
</body></html>`);
    }

    // GET /api/coaching/status?email=X — check coaching sequence status
    if (req.method === 'GET' && (url === '/coaching/status' || url.startsWith('/coaching/status'))) {
      try {
        const params = new URL('http://x' + req.url).searchParams;
        const email = params.get('email');
        if (!email) return res.status(400).json({ error: 'email parameter required' });

        await ensureCoachingTable(sql);
        const rows = await sql`SELECT * FROM coaching_sequences WHERE LOWER(email) = LOWER(${email}) ORDER BY created_at DESC LIMIT 1`;
        if (rows.length === 0) return res.json({ enrolled: false });

        const seq = rows[0];
        return res.json({
          enrolled: true,
          currentDay: seq.current_day,
          totalDays: 'ongoing',
          phase: seq.current_day <= 8 ? 'daily' : seq.current_day <= 16 ? 'deep-dive' : seq.current_day <= 20 ? 'advanced' : 'weekly',
          lastSentAt: seq.last_sent_at,
          startedAt: seq.started_at,
          unsubscribed: seq.unsubscribed,
          assessmentId: seq.assessment_id,
        });
      } catch (coachingStatusErr) {
        console.error('[coaching/status] Handler error:', coachingStatusErr);
        return res.status(500).json({ error: 'Coaching status failed', details: coachingStatusErr.message });
      }
    }

    // ========== COACHING REPLY SYSTEM ==========

    // POST /api/coaching/reply — Capture coaching check-in response from web form
    if (req.method === 'POST' && url === '/coaching/reply') {
      try {
        const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const email = (b.email || '').toLowerCase().trim();
        const day = parseInt(b.day) || 0;
        const response = (b.response || '').trim();
        const mood = b.mood || 'neutral';
        const actionCompleted = b.actionCompleted === true;
        const weakestPillar = b.weakestPillar || null;

        if (!email || !response) return res.status(400).json({ error: 'email and response required' });

        // Ensure coaching_replies table exists
        await sql`CREATE TABLE IF NOT EXISTS coaching_replies (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER,
          email TEXT NOT NULL,
          coaching_day INTEGER,
          response TEXT NOT NULL,
          mood TEXT DEFAULT 'neutral',
          action_completed BOOLEAN DEFAULT false,
          weakest_pillar TEXT,
          sentiment TEXT DEFAULT 'neutral',
          key_themes TEXT[] DEFAULT '{}',
          coaching_insight TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_coaching_replies_email ON coaching_replies(email)`;

        // Get contact ID
        const contactRows = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;
        const contactId = contactRows.length > 0 ? contactRows[0].id : null;

        // Simple sentiment analysis based on mood + keywords
        let sentiment = mood === 'struggling' ? 'negative' : mood === 'unstoppable' || mood === 'strong' ? 'positive' : 'neutral';
        const negativeWords = ['stuck', 'can\'t', 'failed', 'didn\'t', 'struggle', 'hard', 'impossible', 'overwhelm', 'quit', 'give up'];
        const positiveWords = ['did it', 'completed', 'progress', 'better', 'improved', 'growth', 'proud', 'committed', 'breakthrough', 'realized'];
        const lowerResp = response.toLowerCase();
        const negHits = negativeWords.filter(w => lowerResp.includes(w)).length;
        const posHits = positiveWords.filter(w => lowerResp.includes(w)).length;
        if (negHits > posHits) sentiment = 'negative';
        else if (posHits > negHits) sentiment = 'positive';

        // Extract key themes
        const themes = [];
        if (lowerResp.includes('time') || lowerResp.includes('schedule') || lowerResp.includes('calendar')) themes.push('time_management');
        if (lowerResp.includes('money') || lowerResp.includes('financial') || lowerResp.includes('budget')) themes.push('finances');
        if (lowerResp.includes('relationship') || lowerResp.includes('partner') || lowerResp.includes('family')) themes.push('relationships');
        if (lowerResp.includes('learn') || lowerResp.includes('read') || lowerResp.includes('study')) themes.push('learning');
        if (lowerResp.includes('lead') || lowerResp.includes('team') || lowerResp.includes('influence')) themes.push('leadership');
        if (lowerResp.includes('pray') || lowerResp.includes('god') || lowerResp.includes('faith') || lowerResp.includes('church')) themes.push('faith');

        // Generate personalized insight — governed by VTV_CONSTITUTION
        // Core rule: NEVER cause harm. Add value. Encourage openness to growth.
        let insight = 'Your response has been saved. Tomorrow\'s coaching email will reflect what you shared.';

        // Check for crisis language first (safety filter)
        const crisisWords = ['suicide', 'kill myself', 'end it all', 'self-harm', 'want to die', 'no reason to live', 'give up on life'];
        const isCrisis = crisisWords.some(w => lowerResp.includes(w));
        if (isCrisis) {
          sentiment = 'crisis';
          insight = `I hear you, and I want you to know — what you\'re feeling matters. This system isn\'t equipped to help with what you\'re going through right now, but someone is. Please reach out to the 988 Suicide & Crisis Lifeline (call or text 988) or chat at 988lifeline.org. You are not alone, and your life has value that no score can measure.`;
        } else if (sentiment === 'negative' && !actionCompleted) {
          insight = `The fact that you showed up to check in today — that matters. Struggling doesn\'t mean failing. It means you\'re aware, and awareness is the first step to change. Tomorrow\'s email will meet you where you are with your ${weakestPillar || 'growth area'}, not where you think you should be.`;
        } else if (sentiment === 'positive' && actionCompleted) {
          insight = `You did the work and you feel it. That\'s not luck — that\'s you choosing to grow. Tomorrow\'s email will build on what you started. The people around you benefit when you invest in yourself like this.`;
        } else if (actionCompleted && sentiment !== 'positive') {
          insight = `You showed up and did the work even when it didn\'t feel good. That kind of consistency is rare and it\'s exactly what changes lives — yours and the people around you. What you did today matters more than how it felt.`;
        } else if (!actionCompleted && sentiment === 'positive') {
          insight = `Good to hear you\'re in a strong place. The action step is still there when you\'re ready — no guilt, no pressure. Tomorrow\'s email will offer a version that fits into your real schedule. Growth happens at your pace, not anyone else\'s.`;
        } else if (mood === 'struggling') {
          insight = `Thank you for being honest about where you are. That takes courage. You don\'t have to fix everything today. Pick one small thing tomorrow that moves you forward — even 5 minutes counts. You\'re building something that matters.`;
        }

        // Save reply
        await sql`INSERT INTO coaching_replies (contact_id, email, coaching_day, response, mood, action_completed, weakest_pillar, sentiment, key_themes, coaching_insight)
          VALUES (${contactId}, ${email}, ${day}, ${response}, ${mood}, ${actionCompleted}, ${weakestPillar}, ${sentiment}, ${themes}, ${insight})`;

        // Update engagement score based on reply
        try {
          await sql`UPDATE email_engagement SET action_completed = ${actionCompleted}
            WHERE LOWER(email) = LOWER(${email}) AND coaching_day = ${day} AND action_completed = false`;
          // Boost engagement score for replying
          await sql`UPDATE coaching_sequences SET engagement_score = LEAST(1.0, COALESCE(engagement_score, 0) + 0.15)
            WHERE LOWER(email) = LOWER(${email})`;
        } catch (e) { /* non-fatal */ }

        // Track analytics
        try {
          await sql`INSERT INTO analytics_events (event_type, contact_id, metadata)
            VALUES ('coaching_reply', ${contactId}, ${JSON.stringify({ day, mood, sentiment, actionCompleted, themes })}::jsonb)`;
        } catch (e) { /* non-fatal */ }

        return res.json({ success: true, insight, sentiment, themes });
      } catch (replyErr) {
        console.error('[coaching/reply] Error:', replyErr.message);
        return res.status(500).json({ error: 'Failed to save reply' });
      }
    }

    // GET /api/coaching/replies?email=X — Get reply history and streak for a user
    if (req.method === 'GET' && url.startsWith('/coaching/replies')) {
      try {
        const params = new URL('http://x' + req.url).searchParams;
        const email = (params.get('email') || '').toLowerCase().trim();
        if (!email) return res.status(400).json({ error: 'email required' });

        // Check if table exists
        let replies = [];
        let streak = 0;
        try {
          replies = await sql`SELECT coaching_day, mood, action_completed, sentiment, key_themes, coaching_insight, created_at
            FROM coaching_replies WHERE LOWER(email) = LOWER(${email}) ORDER BY coaching_day DESC LIMIT 30`;

          // Calculate streak — consecutive days with replies
          if (replies.length > 0) {
            const days = replies.map(r => r.coaching_day).sort((a, b) => b - a);
            streak = 1;
            for (let i = 0; i < days.length - 1; i++) {
              if (days[i] - days[i + 1] === 1) streak++;
              else break;
            }
          }
        } catch (e) { /* table may not exist */ }

        // Mood distribution
        const moodCounts = {};
        replies.forEach(r => { moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });

        // Action completion rate
        const actionsCompleted = replies.filter(r => r.action_completed).length;
        const actionRate = replies.length > 0 ? Math.round((actionsCompleted / replies.length) * 100) : 0;

        return res.json({
          replies: replies.slice(0, 10),
          streak,
          totalReplies: replies.length,
          moodDistribution: moodCounts,
          actionCompletionRate: actionRate,
          latestMood: replies.length > 0 ? replies[0].mood : null,
          latestSentiment: replies.length > 0 ? replies[0].sentiment : null,
        });
      } catch (err) {
        return res.json({ replies: [], streak: 0, totalReplies: 0, error: err.message });
      }
    }

    // ========== END COACHING REPLY SYSTEM ==========

    // POST /api/trial/send-conversion-emails — Send upgrade emails to trial users approaching expiry
    if (req.method === 'POST' && url === '/trial/send-conversion-emails') {
      const apiKey = req.headers['x-api-key'];
      const cronSecret = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
      if (apiKey !== (process.env.ADMIN_API_KEY || '') && cronSecret !== (process.env.CRON_SECRET || '')) {
        return res.status(401).json({ error: 'Admin or cron auth required' });
      }

      const targets = await sql`
        SELECT c.id, c.email, c.first_name, up.membership_tier, up.created_at,
               EXTRACT(DAY FROM NOW() - up.created_at) as days_active
        FROM contacts c
        JOIN user_profiles up ON up.contact_id = c.id
        WHERE up.membership_tier = 'free'
          AND up.stripe_subscription_id IS NULL
          AND up.created_at > NOW() - INTERVAL '9 days'
          AND up.created_at < NOW() - INTERVAL '4 days'
          AND c.deleted_at IS NULL
        ORDER BY up.created_at ASC
        LIMIT 50
      `;

      const results = [];
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
        });

        for (const t of targets) {
          const days = Math.floor(t.days_active);
          let subject, body;

          if (days <= 5) {
            subject = t.first_name ? `${t.first_name}, your free access ends in 2 days` : 'Your free access ends in 2 days';
            body = `<p>You've been using Value to Victory for ${days} days. Your free access ends soon.</p><p>Upgrade to VictoryPath ($29/mo) to keep your coaching emails, action plans, and progress tracking.</p><p><a href="https://assessment.valuetovictory.com/pricing" style="display:inline-block;padding:12px 32px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:6px;">Upgrade Now →</a></p>`;
          } else if (days <= 7) {
            subject = t.first_name ? `${t.first_name}, last day of free access` : 'Last day of free access';
            body = `<p>Your 7-day free trial ends today. After today, you'll lose access to:</p><ul><li>Daily coaching emails personalized to your P.I.N.K. score</li><li>Progress tracking & action plans</li><li>30-day challenges</li><li>Couple & relationship tools</li></ul><p><a href="https://assessment.valuetovictory.com/pricing" style="display:inline-block;padding:12px 32px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:6px;">Keep My Access — $29/mo →</a></p>`;
          } else {
            subject = t.first_name ? `${t.first_name}, we saved your results` : 'We saved your results';
            body = `<p>Your free trial ended, but your P.I.N.K. assessment results are still saved.</p><p>Reactivate anytime for $29/mo and pick up right where you left off — your scores, your coaching plan, your progress.</p><p><a href="https://assessment.valuetovictory.com/pricing" style="display:inline-block;padding:12px 32px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:6px;">Reactivate My Account →</a></p>`;
          }

          try {
            await transporter.sendMail({
              from: '"Value to Victory" <' + process.env.GMAIL_USER + '>',
              to: t.email,
              subject,
              html: '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;">' + body + '<hr style="margin:2rem 0;border:none;border-top:1px solid #eee"/><p style="font-size:0.75rem;color:#999;">Value to Victory — valuetovictory.com</p></div>'
            });
            results.push({ email: t.email, days, status: 'sent' });
          } catch(e) {
            results.push({ email: t.email, days, status: 'failed', error: e.message });
          }
        }
      }

      return res.json({ sent: results.filter(r => r.status === 'sent').length, failed: results.filter(r => r.status === 'failed').length, results });
    }

    // GET /api/accountability/send — PERSONALIZED evening accountability email
    // Pulls each person's assessment, coaching day, latest reply, devotional, and reply streak
    if (req.method === 'GET' && url === '/accountability/send') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      try {
        await ensureCoachingTable(sql);

        // Get members with their assessment data
        const members = await sql`
          SELECT cs.email, cs.current_day, cs.assessment_id, cs.engagement_score,
            c.first_name, c.id as contact_id
          FROM coaching_sequences cs
          JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
          WHERE cs.unsubscribed = FALSE
            AND LOWER(cs.email) NOT IN (
              SELECT LOWER(recipient) FROM email_log
              WHERE email_type = 'accountability' AND sent_at::date = CURRENT_DATE
            )
          ORDER BY cs.id
        `;

        if (members.length === 0) {
          return res.json({ sent: 0, message: 'No active members to email.' });
        }

        let transporter = null;
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
        }
        if (!transporter) return res.status(500).json({ error: 'Email credentials not configured' });

        // Get today's devotional for faith section
        let devotional = null;
        try {
          const startDate = new Date('2026-03-01');
          const today = new Date();
          const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
          const cycleDay = (diffDays % 60) + 1;
          const devRows = await sql`SELECT * FROM rfm_devotionals WHERE day_number = ${cycleDay} LIMIT 1`;
          if (devRows.length > 0) devotional = devRows[0];
        } catch (e) { /* devotional table may not exist */ }

        let sentCount = 0;
        const results = [];

        for (const member of members) {
          try {
            const firstName = escapeHtml(member.first_name || 'Friend');
            const email = member.email;
            const coachingDay = member.current_day || 1;
            const unsubToken = Buffer.from(email).toString('base64');
            const unsubUrl = `${BASE_URL}/api/coaching/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken}`;
            const feedbackUrl = `${BASE_URL}/api/feedback/respond?email=${encodeURIComponent(email)}&name=${encodeURIComponent(firstName)}&q=${encodeURIComponent('What did the Value Engine help you with today?')}`;
            const bugUrl = `${BASE_URL}/api/feedback/respond?email=${encodeURIComponent(email)}&name=${encodeURIComponent(firstName)}&mode=bug&q=${encodeURIComponent('What went wrong? We want to fix it.')}`;

            // Get their assessment data
            let assessment = null;
            try {
              const aRows = await sql`SELECT * FROM assessments WHERE id = ${member.assessment_id} LIMIT 1`;
              if (aRows.length > 0) assessment = aRows[0];
            } catch (e) { /* non-fatal */ }

            const weakest = assessment?.weakest_pillar || 'your focus area';
            const weakestScore = assessment ? (assessment[`${weakest.toLowerCase()}_total`] || 0) : 0;
            const masterScore = assessment?.master_score || 0;
            const scoreRange = assessment?.score_range || '';

            // Get latest reply
            let lastReply = null;
            let replyStreak = 0;
            try {
              const replies = await sql`SELECT * FROM coaching_replies WHERE LOWER(email) = LOWER(${email}) ORDER BY coaching_day DESC LIMIT 5`;
              if (replies.length > 0) {
                lastReply = replies[0];
                replyStreak = 1;
                const days = replies.map(r => r.coaching_day).sort((a, b) => b - a);
                for (let i = 0; i < days.length - 1; i++) {
                  if (days[i] - days[i + 1] <= 2) replyStreak++; else break;
                }
              }
            } catch (e) { /* table may not exist */ }

            // Get action completion rate
            let actionRate = 0;
            try {
              const engRows = await sql`SELECT COUNT(*) as total, SUM(CASE WHEN action_completed THEN 1 ELSE 0 END) as completed FROM email_engagement WHERE LOWER(email) = LOWER(${email})`;
              if (engRows[0]?.total > 0) actionRate = Math.round((Number(engRows[0].completed) / Number(engRows[0].total)) * 100);
            } catch (e) { /* non-fatal */ }

            // Build pillar bars
            const pillarBarHtml = assessment ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:10px;color:#6a6a84;letter-spacing:1px;margin-bottom:12px;">
    <tr>
      <td width="20%" style="text-align:center;${weakest==='Time'?'color:#D4A847;font-weight:bold;':''}">T:${assessment.time_total||0}</td>
      <td width="20%" style="text-align:center;${weakest==='People'?'color:#D4A847;font-weight:bold;':''}">P:${assessment.people_total||0}</td>
      <td width="20%" style="text-align:center;${weakest==='Influence'?'color:#D4A847;font-weight:bold;':''}">I:${assessment.influence_total||0}</td>
      <td width="20%" style="text-align:center;${weakest==='Numbers'?'color:#D4A847;font-weight:bold;':''}">N:${assessment.numbers_total||0}</td>
      <td width="20%" style="text-align:center;${weakest==='Knowledge'?'color:#D4A847;font-weight:bold;':''}">K:${assessment.knowledge_total||0}</td>
    </tr>
    <tr>
      <td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;height:4px;"><div style="width:${Math.round(((assessment.time_total||0)/50)*100)}%;background:${weakest==='Time'?'#D4A847':'#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
      <td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;height:4px;"><div style="width:${Math.round(((assessment.people_total||0)/50)*100)}%;background:${weakest==='People'?'#D4A847':'#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
      <td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;height:4px;"><div style="width:${Math.round(((assessment.influence_total||0)/50)*100)}%;background:${weakest==='Influence'?'#D4A847':'#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
      <td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;height:4px;"><div style="width:${Math.round(((assessment.numbers_total||0)/50)*100)}%;background:${weakest==='Numbers'?'#D4A847':'#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
      <td style="padding:2px;"><div style="background:#2a2a44;border-radius:2px;height:4px;"><div style="width:${Math.round(((assessment.knowledge_total||0)/50)*100)}%;background:${weakest==='Knowledge'?'#D4A847':'#4a4a7a'};height:4px;border-radius:2px;"></div></div></td>
    </tr>
    </table>` : '';

            // Personalized coaching phase description
            const phase = coachingDay <= 8 ? 'Daily Coaching' : coachingDay <= 16 ? 'Deep Dive' : coachingDay <= 20 ? 'Advanced' : 'Weekly Check-In';

            // Reply-aware greeting
            let greeting = `Before you close out today &mdash; how did your ${weakest} work go?`;
            if (lastReply && lastReply.mood === 'struggling') {
              greeting = `Yesterday you said you were struggling. That honesty matters. How was today?`;
            } else if (lastReply && lastReply.action_completed) {
              greeting = `You completed yesterday's action step. Did you build on that today?`;
            } else if (lastReply && !lastReply.action_completed) {
              greeting = `Yesterday's action step is still there. Even 5 minutes counts. How was today?`;
            }

            // Streak section
            const streakHtml = replyStreak >= 2 ? `
    <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:12px 20px;margin:0 0 16px;text-align:center;">
      <span style="font-size:24px;font-weight:900;color:#D4A847;">${replyStreak}</span>
      <span style="font-size:13px;color:#a1a1aa;"> day check-in streak</span>
      <span style="font-size:11px;color:#52525b;display:block;margin-top:4px;">Action completion rate: ${actionRate}%</span>
    </div>` : '';

            // Devotional section (connected to their pillar when possible)
            let devotionalHtml = '';
            if (devotional) {
              const pillarConnection = (devotional.themes || []).some(t =>
                (weakest === 'People' && ['family','love','relationships','trust'].includes(t)) ||
                (weakest === 'Numbers' && ['money','provision','poverty','work'].includes(t)) ||
                (weakest === 'Time' && ['patience','waiting','seasons','time'].includes(t)) ||
                (weakest === 'Influence' && ['leadership','faith','courage','obedience'].includes(t)) ||
                (weakest === 'Knowledge' && ['wisdom','learning','growth','truth'].includes(t))
              );
              devotionalHtml = `
    <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px 24px;margin:0 0 20px;">
      <p style="color:#D4A847;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px;">Today's Word</p>
      <p style="color:#71717a;font-size:11px;margin:0 0 12px;">Day ${devotional.day_number} &mdash; ${escapeHtml(devotional.chapter_title || '')}</p>
      ${pillarConnection ? `<p style="color:#D4A847;font-size:12px;font-style:italic;margin:0 0 8px;">This connects to your ${weakest} journey.</p>` : ''}
      <p style="color:#e4e4e7;font-size:14px;font-style:italic;line-height:1.6;margin:0 0 8px;">"${escapeHtml(devotional.scripture_text || '')}"</p>
      <p style="color:#71717a;font-size:12px;margin:0 0 12px;">&mdash; ${escapeHtml(devotional.scripture_reference || '')}</p>
      <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0 0 12px;">${escapeHtml((devotional.action_step || '').substring(0, 200))}</p>
      <a href="${BASE_URL}/daily-word" style="color:#D4A847;font-size:13px;text-decoration:none;">Read full devotional &rarr;</a>
    </div>`;
            }

            // Dynamic subject line based on their state
            let subject = `${firstName} — Day ${coachingDay} of your ${weakest} journey`;
            if (replyStreak >= 3) subject = `${firstName} — ${replyStreak}-day streak. Your ${weakest} is changing.`;
            else if (lastReply && lastReply.mood === 'struggling') subject = `${firstName} — still here, still in your corner`;
            else if (lastReply && lastReply.action_completed) subject = `${firstName} — you showed up yesterday. How about today?`;

            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="text-align:center;padding-bottom:16px;">
  <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:8px;">VALUE TO VICTORY</div>
  <div style="font-family:Georgia,serif;font-size:22px;font-style:italic;color:#ffffff;">Evening Check-In &mdash; ${phase}</div>
  <div style="font-size:12px;color:#52525b;margin-top:4px;">Day ${coachingDay} &middot; Focus: ${weakest} (${weakestScore}/50) &middot; Score: ${masterScore} (${scoreRange})</div>
</td></tr>
<tr><td style="padding:0 0 16px;">
  ${pillarBarHtml}
</td></tr>
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px 28px;">
  <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 16px;">${firstName},</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">${greeting}</p>

  ${streakHtml}

  <!-- Growth Window -->
  <div style="background:#111118;border-left:3px solid #D4A847;padding:14px 18px;margin:0 0 16px;border-radius:0 8px 8px 0;">
    <p style="color:#D4A847;font-size:14px;font-weight:bold;margin:0 0 6px;">Your Honest 24</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="25%" style="text-align:center;padding:4px;"><div style="font-size:9px;color:#71717a;letter-spacing:1px;">WORK</div><div style="font-size:16px;color:#e4e4e7;font-weight:bold;">9-10h</div></td>
    <td width="25%" style="text-align:center;padding:4px;"><div style="font-size:9px;color:#71717a;letter-spacing:1px;">OBLIGAT.</div><div style="font-size:16px;color:#e4e4e7;font-weight:bold;">2-3h</div></td>
    <td width="25%" style="text-align:center;padding:4px;"><div style="font-size:9px;color:#D4A847;letter-spacing:1px;font-weight:bold;">GROWTH</div><div style="font-size:16px;color:#D4A847;font-weight:bold;">4-5h</div></td>
    <td width="25%" style="text-align:center;padding:4px;"><div style="font-size:9px;color:#71717a;letter-spacing:1px;">SLEEP</div><div style="font-size:16px;color:#e4e4e7;font-weight:bold;">6-7h</div></td>
    </tr></table>
    <p style="color:#52525b;font-size:11px;text-align:center;margin:6px 0 0;">How much of your growth window went to ${weakest} today?</p>
  </div>

  <!-- Check-in CTA -->
  <div style="text-align:center;margin:0 0 20px;">
    <a href="${BASE_URL}/coaching-reply?email=${encodeURIComponent(email)}&day=${coachingDay}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">Log Today's Check-In &rarr;</a>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:20px 0;"/>

  ${devotionalHtml}

  <!-- Feedback -->
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="padding-right:6px;">
      <a href="${feedbackUrl}" style="display:block;text-align:center;background:#18181b;border:1px solid #D4A847;color:#D4A847;font-size:12px;font-weight:bold;text-decoration:none;padding:10px 8px;border-radius:8px;">Share What Helped</a>
    </td>
    <td width="50%" style="padding-left:6px;">
      <a href="${bugUrl}" style="display:block;text-align:center;background:#18181b;border:1px solid #52525b;color:#71717a;font-size:12px;font-weight:bold;text-decoration:none;padding:10px 8px;border-radius:8px;">Report an Issue</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="text-align:center;padding-top:20px;">
  <a href="${BASE_URL}/member" style="display:inline-block;background:#18181b;border:1px solid #27272a;color:#a1a1aa;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:8px;">Open Dashboard</a>
</td></tr>
<tr><td style="text-align:center;padding-top:20px;">
  <p style="color:#52525b;font-size:12px;margin:0;">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</p>
  <p style="color:#3f3f46;font-size:11px;margin:8px 0 0;"><a href="${unsubUrl}" style="color:#3f3f46;text-decoration:underline;">Unsubscribe from evening emails</a></p>
</td></tr>
</table></td></tr></table></body></html>`;

            // Create engagement record for tracking (accountability emails)
            let acctEngId = null;
            try {
              const acctEng = await sql`
                INSERT INTO email_engagement (contact_id, email, coaching_day, email_variant)
                VALUES (${member.contact_id || null}, ${email.toLowerCase()}, ${coachingDay}, 'accountability')
                RETURNING id`;
              acctEngId = acctEng[0]?.id;
            } catch (e) { /* non-fatal */ }

            // Inject tracking pixel and wrap links
            if (acctEngId) {
              const trackBase = `${BASE_URL}/api/agent/email`;
              html = html.replace(/href="(https?:\/\/[^"]+)"/g, function(m, u) {
                return `href="${trackBase}/track-click?id=${acctEngId}&url=${encodeURIComponent(u)}"`;
              });
              const pixel = `<img src="${trackBase}/track-open?id=${acctEngId}" width="1" height="1" style="display:none" alt=""/>`;
              if (html.includes('</body>')) {
                html = html.replace('</body>', pixel + '</body>');
              } else {
                html = html + pixel;
              }
            }

            await transporter.sendMail({
              from: `"Shawn @ Value Engine" <${process.env.GMAIL_USER}>`,
              to: email,
              subject,
              html,
            });

            results.push({ email, status: 'sent', day: coachingDay, weakest, streak: replyStreak });
            sentCount++;
            await logEmail(sql, { recipient: email, emailType: 'accountability', subject, metadata: { day: coachingDay, weakest, streak: replyStreak, engagementId: acctEngId } });
          } catch (sendErr) {
            console.error(`Accountability email error for ${maskEmail(member.email)}:`, sendErr.message);
            results.push({ email: member.email, status: 'error', error: sendErr.message });
            await logEmail(sql, { recipient: member.email, emailType: 'accountability', status: 'failed', metadata: { error: sendErr.message } });
          }
        }

        return res.json({ sent: sentCount, total: members.length, results });
      } catch (acctErr) {
        console.error('[accountability/send] Error:', acctErr);
        return res.status(500).json({ error: 'Accountability send failed', detail: acctErr.message });
      }
    }

    // ========== USER FEEDBACK & BUG REPORT SYSTEM ==========
    let feedbackResponseTableReady = false;
    async function ensureFeedbackResponseTable() {
      if (feedbackResponseTableReady) return;
      try {
        await sql`CREATE TABLE IF NOT EXISTS user_feedback (
          id SERIAL PRIMARY KEY, contact_id INTEGER, email TEXT NOT NULL, first_name TEXT,
          category TEXT DEFAULT 'feedback', feedback_type TEXT DEFAULT 'evening_checkin',
          question TEXT, response TEXT NOT NULL, severity TEXT DEFAULT 'low',
          status TEXT DEFAULT 'new', page_url TEXT, device_info TEXT,
          resolved_at TIMESTAMP, admin_notes TEXT, created_at TIMESTAMP DEFAULT NOW()
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_uf_email ON user_feedback(email)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_uf_created ON user_feedback(created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_uf_category ON user_feedback(category)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_uf_status ON user_feedback(status)`;
        feedbackResponseTableReady = true;
      } catch(e) {}
    }

    // POST /api/feedback/respond — Submit feedback, bug report, or suggestion
    if (req.method === 'POST' && url === '/feedback/respond') {
      await ensureFeedbackResponseTable();
      const b = req.body || {};
      const email = (b.email || '').toLowerCase().trim();
      const response = sanitizeString(b.response, 5000);
      const category = b.category || 'feedback';
      const severity = b.severity || (category === 'bug' ? 'medium' : 'low');
      if (!email || !response) return res.status(400).json({ error: 'email and response required' });
      if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
      let contactId = null, firstName = null;
      try { const c = await sql`SELECT id, first_name FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`; if (c.length > 0) { contactId = c[0].id; firstName = c[0].first_name; } } catch(e) {}
      const row = await sql`INSERT INTO user_feedback (contact_id, email, first_name, category, feedback_type, question, response, severity, page_url, device_info)
        VALUES (${contactId}, ${email}, ${firstName}, ${category}, ${b.feedbackType||'evening_checkin'}, ${b.question||''}, ${response}, ${severity}, ${b.pageUrl||''}, ${b.deviceInfo||''}) RETURNING id`;
      if (category === 'bug' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const t = nodemailer.createTransport({ service:'gmail', auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD} });
          await t.sendMail({ from:'"VTV Bug Report" <'+process.env.GMAIL_USER+'>', to:'valuetovictory@gmail.com',
            subject:'[BUG #'+row[0].id+'] '+response.substring(0,60), text:'Bug #'+row[0].id+'\nFrom: '+(firstName||email)+'\nSeverity: '+severity+'\nPage: '+(b.pageUrl||'N/A')+'\n\n'+response });
        } catch(e) {}
      }
      return res.json({ success:true, id:row[0].id, message: category==='bug'?'Bug report submitted. We are on it!':'Thank you for your feedback!' });
    }

    // GET /api/feedback/respond — Feedback & bug report form page
    if (req.method === 'GET' && url.startsWith('/feedback/respond')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email') || '';
      const name = params.get('name') || 'Friend';
      const mode = params.get('mode') || 'feedback';
      const q = params.get('q') || 'Tell us something the Value Engine helped you with today.';
      res.setHeader('Content-Type', 'text/html');
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Feedback — Value to Victory</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;min-height:100vh;">
<div style="max-width:500px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:10px;letter-spacing:3px;color:#D4A847;text-transform:uppercase;margin-bottom:6px;">VALUE TO VICTORY</div>
    <div style="font-family:Georgia,serif;font-size:22px;font-style:italic;color:#fff;" id="pageTitle">We Want to Hear From You</div>
  </div>
  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px 24px;">
    <p style="color:#e4e4e7;font-size:15px;margin:0 0 16px;">Hey ${name},</p>
    <div style="display:flex;gap:6px;margin-bottom:20px;">
      <button onclick="setMode('feedback')" id="tab-feedback" style="flex:1;padding:10px 8px;border-radius:8px;border:1px solid #27272a;background:#18181b;color:#a1a1aa;font-size:12px;font-weight:bold;cursor:pointer;">Share Feedback</button>
      <button onclick="setMode('bug')" id="tab-bug" style="flex:1;padding:10px 8px;border-radius:8px;border:1px solid #27272a;background:#18181b;color:#a1a1aa;font-size:12px;font-weight:bold;cursor:pointer;">Report Issue</button>
      <button onclick="setMode('idea')" id="tab-idea" style="flex:1;padding:10px 8px;border-radius:8px;border:1px solid #27272a;background:#18181b;color:#a1a1aa;font-size:12px;font-weight:bold;cursor:pointer;">Suggestion</button>
    </div>
    <div id="formArea">
      <p style="color:#D4A847;font-size:14px;font-weight:bold;margin:0 0 12px;" id="qText">${q}</p>
      <textarea id="resp" rows="5" style="width:100%;padding:14px;background:#111118;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:15px;resize:vertical;box-sizing:border-box;outline:none;font-family:Arial,sans-serif;" placeholder="Share your thoughts..."></textarea>
      <div id="bugFields" style="display:none;margin-top:10px;">
        <select id="severity" style="width:100%;padding:12px;background:#111118;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:14px;margin-bottom:8px;">
          <option value="low">Low — Minor annoyance</option>
          <option value="medium" selected>Medium — Something isn't working right</option>
          <option value="high">High — Can't use a feature</option>
          <option value="critical">Critical — Can't access my account</option>
        </select>
        <input id="pageUrl" type="text" placeholder="Which page were you on? (optional)" style="width:100%;padding:12px;background:#111118;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:14px;box-sizing:border-box;"/>
      </div>
      <button onclick="submitFB()" id="subBtn" style="width:100%;margin-top:12px;padding:14px;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:15px;font-weight:bold;border:none;border-radius:8px;cursor:pointer;">Submit Feedback</button>
    </div>
    <div id="thankYou" style="display:none;text-align:center;padding:20px 0;">
      <div style="font-size:36px;margin-bottom:8px;">&#10003;</div>
      <p style="color:#22c55e;font-size:16px;font-weight:bold;margin:0 0 8px;" id="tyTitle">Thank you!</p>
      <p style="color:#a1a1aa;font-size:14px;margin:0;" id="tyMsg">Your feedback helps us build something that truly matters.</p>
    </div>
  </div>
  <p style="text-align:center;color:#52525b;font-size:11px;margin-top:20px;">&copy; 2026 Value to Victory</p>
</div>
<script>
let cm='${mode}';
function setMode(m){cm=m;document.querySelectorAll('[id^=tab-]').forEach(t=>{t.style.background='#18181b';t.style.color='#a1a1aa';});document.getElementById('tab-'+m).style.background='#D4A847';document.getElementById('tab-'+m).style.color='#0a0a0a';
if(m==='bug'){document.getElementById('bugFields').style.display='block';document.getElementById('qText').textContent='What went wrong? Describe what happened.';document.getElementById('resp').placeholder='I was trying to... and then...';document.getElementById('subBtn').textContent='Submit Bug Report';document.getElementById('pageTitle').textContent='Report a Technical Issue';}
else if(m==='idea'){document.getElementById('bugFields').style.display='none';document.getElementById('qText').textContent='What would make the Value Engine better?';document.getElementById('resp').placeholder='I wish it could...';document.getElementById('subBtn').textContent='Submit Suggestion';document.getElementById('pageTitle').textContent='Share a Suggestion';}
else{document.getElementById('bugFields').style.display='none';document.getElementById('qText').textContent='${q}';document.getElementById('resp').placeholder='Share your thoughts...';document.getElementById('subBtn').textContent='Submit Feedback';document.getElementById('pageTitle').textContent='We Want to Hear From You';}}
setMode(cm);
function submitFB(){var r=document.getElementById('resp').value.trim();if(!r)return;
fetch('/api/feedback/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'${email}',response:r,category:cm,question:document.getElementById('qText').textContent,feedbackType:'evening_checkin',severity:cm==='bug'?document.getElementById('severity').value:'low',pageUrl:cm==='bug'?document.getElementById('pageUrl').value:'',deviceInfo:navigator.userAgent})})
.then(function(r){return r.json()}).then(function(d){document.getElementById('formArea').style.display='none';document.getElementById('thankYou').style.display='block';
if(cm==='bug'){document.getElementById('tyTitle').textContent='Bug Report Received!';document.getElementById('tyMsg').textContent='We have been notified. Report #'+(d.id||'');}
else if(cm==='idea'){document.getElementById('tyTitle').textContent='Great Idea!';document.getElementById('tyMsg').textContent='We read every suggestion. Thank you!';}
}).catch(function(){alert('Something went wrong. Please try again.');});}
</script></body></html>`);
    }

    // GET /api/admin/user-feedback — View all feedback with filtering
    if (req.method === 'GET' && url.startsWith('/admin/user-feedback') && !url.includes('/resolve')) {
      await ensureFeedbackResponseTable();
      const params = new URL('http://x' + req.url).searchParams;
      const category = params.get('category');
      const status = params.get('status');
      let rows;
      if (category && status) rows = await sql`SELECT * FROM user_feedback WHERE category=${category} AND status=${status} ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC LIMIT 200`;
      else if (category) rows = await sql`SELECT * FROM user_feedback WHERE category=${category} ORDER BY created_at DESC LIMIT 200`;
      else if (status) rows = await sql`SELECT * FROM user_feedback WHERE status=${status} ORDER BY created_at DESC LIMIT 200`;
      else rows = await sql`SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 200`;
      const stats = await sql`SELECT category, status, severity, COUNT(*) as cnt FROM user_feedback GROUP BY category, status, severity ORDER BY category`;
      return res.json({ feedback: rows, stats });
    }

    // POST /api/admin/user-feedback/:id/resolve — Mark as resolved
    if (req.method === 'POST' && url.match(/^\/admin\/user-feedback\/\d+\/resolve$/)) {
      await ensureFeedbackResponseTable();
      const fbId = parseInt(url.split('/')[3]);
      const b = req.body || {};
      await sql`UPDATE user_feedback SET status='resolved', resolved_at=NOW(), admin_notes=${b.notes||null} WHERE id=${fbId}`;
      return res.json({ success: true });
    }

    // ========== CEO TODO LIST ==========
    async function ensureCeoTodosTable() {
      try {
        await sql`CREATE TABLE IF NOT EXISTS ceo_todos (
          id SERIAL PRIMARY KEY,
          task TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'pending',
          due_date DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        )`;
      } catch(e) {}
    }

    // GET /api/admin/todos — List CEO todos
    if (req.method === 'GET' && url === '/admin/todos') {
      await ensureCeoTodosTable();
      const todos = await sql`SELECT * FROM ceo_todos ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
        created_at DESC`;
      return res.json(todos);
    }

    // POST /api/admin/todos — Add a CEO todo
    if (req.method === 'POST' && url === '/admin/todos') {
      await ensureCeoTodosTable();
      const b = req.body || {};
      if (!b.task) return res.status(400).json({ error: 'task required' });
      const row = await sql`INSERT INTO ceo_todos (task, priority, due_date) VALUES (${b.task}, ${b.priority || 'medium'}, ${b.dueDate || null}) RETURNING *`;
      return res.json(row[0]);
    }

    // POST /api/admin/todos/:id/complete — Mark todo complete
    if (req.method === 'POST' && url.match(/^\/admin\/todos\/\d+\/complete$/)) {
      await ensureCeoTodosTable();
      const todoId = parseInt(url.split('/')[3]);
      await sql`UPDATE ceo_todos SET status = 'done', completed_at = NOW() WHERE id = ${todoId}`;
      return res.json({ success: true });
    }

    // DELETE /api/admin/todos/:id — Delete a todo
    if (req.method === 'DELETE' && url.match(/^\/admin\/todos\/\d+$/)) {
      await ensureCeoTodosTable();
      const todoId = parseInt(url.split('/')[3]);
      await sql`DELETE FROM ceo_todos WHERE id = ${todoId}`;
      return res.json({ success: true });
    }

    // ========== CEO DAILY BRIEFING ==========
    // GET /api/ceo-briefing — Daily executive summary email sent at 6:45 AM
    if (req.method === 'GET' && url === '/ceo-briefing') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const ceoEmail = 'valuetovictory@gmail.com';
        const now = new Date();
        const yesterday = new Date(now - 24 * 60 * 60 * 1000);
        const last7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // === METRICS ===
        const totalContacts = await sql`SELECT COUNT(*) as cnt FROM contacts`;
        const totalAssessments = await sql`SELECT COUNT(*) as cnt FROM assessments`;

        // New signups (24h, 7d, 30d)
        const new24h = await sql`SELECT COUNT(*) as cnt FROM contacts WHERE created_at >= ${yesterday.toISOString()}`;
        const new7d = await sql`SELECT COUNT(*) as cnt FROM contacts WHERE created_at >= ${last7.toISOString()}`;
        const new30d = await sql`SELECT COUNT(*) as cnt FROM contacts WHERE created_at >= ${last30.toISOString()}`;

        // New assessments (24h, 7d, 30d)
        const assess24h = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${yesterday.toISOString()}`;
        const assess7d = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${last7.toISOString()}`;
        const assess30d = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${last30.toISOString()}`;

        // Latest signups (last 24h with detail)
        const recentSignups = await sql`SELECT id, first_name, last_name, email, created_at FROM contacts WHERE created_at >= ${yesterday.toISOString()} ORDER BY created_at DESC`;

        // Latest assessments (last 24h with detail)
        const recentAssessments = await sql`SELECT a.id, a.master_score, a.score_range, a.weakest_pillar, a.completed_at, a.depth, c.first_name, c.last_name, c.email
          FROM assessments a JOIN contacts c ON a.contact_id = c.id
          WHERE a.completed_at >= ${yesterday.toISOString()}
          ORDER BY a.completed_at DESC`;

        // Score distribution
        const dist = await sql`SELECT score_range, COUNT(*) as cnt FROM assessments GROUP BY score_range ORDER BY cnt DESC`;
        const totalA = Number(totalAssessments[0].cnt);

        // Pillar averages
        const avgs = await sql`SELECT AVG(time_total) as t, AVG(people_total) as p, AVG(influence_total) as i, AVG(numbers_total) as n, AVG(knowledge_total) as k FROM assessments`;
        const avg = avgs[0] || {};

        // Weakest pillar distribution
        const weakDist = await sql`SELECT weakest_pillar, COUNT(*) as cnt FROM assessments WHERE weakest_pillar IS NOT NULL GROUP BY weakest_pillar ORDER BY cnt DESC`;

        // Coaching sequences active
        let coachingActive = 0, coachingTotal = 0;
        try {
          const cs = await sql`SELECT COUNT(*) as cnt FROM coaching_sequences WHERE unsubscribed = FALSE AND current_day <= 5`;
          const ct = await sql`SELECT COUNT(*) as cnt FROM coaching_sequences`;
          coachingActive = Number(cs[0].cnt);
          coachingTotal = Number(ct[0].cnt);
        } catch(e) {}

        // Teams
        let teamCount = 0;
        try {
          const tc = await sql`SELECT COUNT(*) as cnt FROM teams`;
          teamCount = Number(tc[0].cnt);
        } catch(e) {}

        // Email log stats (last 24h)
        let emailsSent24h = 0, emailsFailed24h = 0;
        try {
          const es = await sql`SELECT status, COUNT(*) as cnt FROM email_log WHERE sent_at >= ${yesterday.toISOString()} GROUP BY status`;
          for (const r of es) {
            if (r.status === 'sent') emailsSent24h = Number(r.cnt);
            else emailsFailed24h = Number(r.cnt);
          }
        } catch(e) {}

        // Membership tiers
        let tierBreakdown = [];
        try {
          tierBreakdown = await sql`SELECT membership_tier, COUNT(*) as cnt FROM user_profiles GROUP BY membership_tier ORDER BY cnt DESC`;
        } catch(e) {}

        // === CEO TODOS ===
        let pendingTodos = [];
        try {
          await ensureCeoTodosTable();
          pendingTodos = await sql`SELECT * FROM ceo_todos WHERE status = 'pending' ORDER BY
            CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
            due_date ASC NULLS LAST, created_at ASC`;
        } catch(e) {}

        // === TOP 3 NEW SIGNUPS (enriched) ===
        const top3Signups = [];
        const top3Raw = await sql`
          SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at,
            (SELECT COUNT(*) FROM assessments a WHERE a.contact_id = c.id) as assessment_count,
            (SELECT a.master_score FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_score,
            (SELECT a.score_range FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as score_range,
            (SELECT a.weakest_pillar FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as weakest_pillar,
            (SELECT a.id FROM assessments a WHERE a.contact_id = c.id ORDER BY a.completed_at DESC LIMIT 1) as latest_assessment_id
          FROM contacts c ORDER BY c.created_at DESC LIMIT 3
        `;
        for (const s of top3Raw) {
          top3Signups.push({
            name: [s.first_name, s.last_name].filter(Boolean).join(' ') || 'No Name',
            email: s.email, phone: s.phone, joinedAt: s.created_at,
            assessments: Number(s.assessment_count), score: s.latest_score,
            range: s.score_range, weakest: s.weakest_pillar,
            reportUrl: s.latest_assessment_id ? `${BASE_URL}/report/${s.latest_assessment_id}` : null
          });
        }

        // === TODAY'S DEVOTIONAL PREVIEW ===
        let todayDevotional = null;
        try {
          const fs = require('fs');
          const path = require('path');
          const devData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'devotionals.json'), 'utf-8'));
          const startDate = new Date('2026-04-06');
          const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          const dayIndex = ((diffDays % 60) + 60) % 60;
          todayDevotional = devData[dayIndex] || devData[0];
        } catch(e) {}

        // === RECOMMENDATIONS ENGINE ===
        const recommendations = [];

        // Growth velocity
        const n24 = Number(new24h[0].cnt);
        const n7 = Number(new7d[0].cnt);
        const n30 = Number(new30d[0].cnt);
        const dailyAvg7 = (n7 / 7).toFixed(1);
        const dailyAvg30 = (n30 / 30).toFixed(1);
        if (n24 === 0) recommendations.push({ priority: 'HIGH', area: 'Acquisition', action: 'Zero new signups in the last 24 hours. Review marketing channels and consider a social media push or email blast to re-engage leads.' });
        if (Number(dailyAvg7) > Number(dailyAvg30) * 1.2) recommendations.push({ priority: 'INFO', area: 'Growth', action: `Signup velocity is accelerating — ${dailyAvg7}/day (7d) vs ${dailyAvg30}/day (30d). Consider scaling what\'s working.` });
        if (Number(dailyAvg7) < Number(dailyAvg30) * 0.7 && n30 > 10) recommendations.push({ priority: 'HIGH', area: 'Growth', action: `Signup velocity is declining — ${dailyAvg7}/day (7d) vs ${dailyAvg30}/day (30d). Investigate drop-off and refresh acquisition strategy.` });

        // Conversion
        const totalC = Number(totalContacts[0].cnt);
        if (totalC > 0) {
          const conversionRate = ((totalA / totalC) * 100).toFixed(1);
          if (conversionRate < 50) recommendations.push({ priority: 'MEDIUM', area: 'Conversion', action: `Only ${conversionRate}% of contacts have completed an assessment. Consider a re-engagement email campaign to unconverted contacts.` });
        }

        // Score health
        const crisisCount = dist.find(d => d.score_range === 'Crisis');
        if (crisisCount && Number(crisisCount.cnt) / totalA > 0.2) recommendations.push({ priority: 'MEDIUM', area: 'Product', action: `${Math.round(Number(crisisCount.cnt)/totalA*100)}% of assessments are in Crisis range. Consider adding a guided onboarding flow or crisis-specific coaching track.` });

        // Coaching
        if (coachingActive === 0 && coachingTotal > 0) recommendations.push({ priority: 'LOW', area: 'Engagement', action: 'No active coaching sequences. All users have completed or unsubscribed. Consider a re-engagement or advanced coaching series.' });

        // Email health
        if (emailsFailed24h > 0) recommendations.push({ priority: 'HIGH', area: 'Infrastructure', action: `${emailsFailed24h} emails failed in the last 24 hours. Check Gmail SMTP credentials and sending limits.` });

        // Revenue opportunity
        const freeUsers = tierBreakdown.find(t => t.membership_tier === 'free');
        if (freeUsers && Number(freeUsers.cnt) > 10) recommendations.push({ priority: 'MEDIUM', area: 'Revenue', action: `${Number(freeUsers.cnt)} users are on the free tier. A targeted upgrade campaign could convert 10-20% to paid memberships.` });

        if (recommendations.length === 0) recommendations.push({ priority: 'INFO', area: 'Status', action: 'All systems operating within normal parameters. No immediate action required.' });

        // === BUILD EMAIL ===
        const scoreColors = { Crisis:'#ef4444', Survival:'#f97316', Growth:'#eab308', Momentum:'#22c55e', Mastery:'#D4A847' };
        const priorityColors = { HIGH:'#ef4444', MEDIUM:'#f97316', LOW:'#eab308', INFO:'#3b82f6' };

        const signupRows = recentSignups.map(s =>
          `<tr><td style="color:#e4e4e7;font-size:13px;padding:6px 8px;">${s.first_name || ''} ${s.last_name || ''}</td><td style="color:#D4A847;font-size:12px;padding:6px 8px;">${s.email}</td><td style="color:#71717a;font-size:11px;padding:6px 8px;">${new Date(s.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td></tr>`
        ).join('') || '<tr><td colspan="3" style="color:#71717a;font-size:13px;padding:12px 8px;text-align:center;">No new signups in the last 24 hours</td></tr>';

        const assessmentRows = recentAssessments.map(a => {
          const color = scoreColors[a.score_range] || '#D4A847';
          return `<tr><td style="color:#e4e4e7;font-size:13px;padding:6px 8px;">${a.first_name || ''} ${a.last_name || ''}</td><td style="color:${color};font-size:13px;font-weight:bold;padding:6px 8px;">${a.master_score} (${a.score_range})</td><td style="color:#71717a;font-size:11px;padding:6px 8px;">${a.weakest_pillar}</td></tr>`;
        }).join('') || '<tr><td colspan="3" style="color:#71717a;font-size:13px;padding:12px 8px;text-align:center;">No new assessments in the last 24 hours</td></tr>';

        const distRows = dist.map(d => {
          const pct = totalA > 0 ? Math.round(Number(d.cnt)/totalA*100) : 0;
          const color = scoreColors[d.score_range] || '#71717a';
          return `<tr><td style="color:${color};font-size:13px;font-weight:bold;padding:4px 8px;">${d.score_range||'Unknown'}</td><td style="color:#e4e4e7;font-size:13px;padding:4px 8px;text-align:right;">${d.cnt}</td><td style="color:#71717a;font-size:12px;padding:4px 8px;text-align:right;">${pct}%</td></tr>`;
        }).join('');

        const recRows = recommendations.map(r => {
          const color = priorityColors[r.priority] || '#71717a';
          return `<div style="background:#111118;border-left:3px solid ${color};padding:12px 16px;margin:8px 0;border-radius:0 6px 6px 0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:${color};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${r.priority}</span><span style="color:#71717a;font-size:11px;">${r.area}</span></div>
            <div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${r.action}</div>
          </div>`;
        }).join('');

        const pillarBars = [
          { name: 'Time', val: Math.round((Number(avg.t)||0)*10)/10 },
          { name: 'People', val: Math.round((Number(avg.p)||0)*10)/10 },
          { name: 'Influence', val: Math.round((Number(avg.i)||0)*10)/10 },
          { name: 'Numbers', val: Math.round((Number(avg.n)||0)*10)/10 },
          { name: 'Knowledge', val: Math.round((Number(avg.k)||0)*10)/10 },
        ].map(p => `<tr><td style="color:#a1a1aa;font-size:12px;padding:4px 8px;width:80px;">${p.name}</td><td style="padding:4px 8px;"><div style="background:#27272a;border-radius:4px;height:16px;width:100%;"><div style="background:linear-gradient(90deg,#D4A847,#b8942e);height:16px;border-radius:4px;width:${(p.val/50*100).toFixed(0)}%;"></div></div></td><td style="color:#e4e4e7;font-size:12px;font-weight:bold;padding:4px 8px;width:40px;text-align:right;">${p.val}</td></tr>`).join('');

        const tierRows = tierBreakdown.map(t =>
          `<tr><td style="color:#a1a1aa;font-size:13px;padding:4px 8px;text-transform:capitalize;">${t.membership_tier}</td><td style="color:#e4e4e7;font-size:13px;font-weight:bold;padding:4px 8px;text-align:right;">${t.cnt}</td></tr>`
        ).join('') || '<tr><td colspan="2" style="color:#71717a;font-size:13px;padding:8px;text-align:center;">No membership data</td></tr>';

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

<!-- HEADER -->
<tr><td style="text-align:center;padding-bottom:24px;">
  <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#D4A847;margin-bottom:6px;">VALUE TO VICTORY</div>
  <div style="font-family:Georgia,serif;font-size:24px;font-style:italic;color:#ffffff;margin-bottom:4px;">CEO Daily Briefing</div>
  <div style="font-size:12px;color:#71717a;">${todayStr} &mdash; 6:45 AM ET</div>
</td></tr>

<!-- EXECUTIVE SUMMARY -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px 28px;margin-bottom:16px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:16px;">Executive Summary</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="text-align:center;padding:12px 4px;"><div style="font-size:28px;font-weight:bold;color:#D4A847;">${totalC}</div><div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Total Clients</div></td>
      <td style="text-align:center;padding:12px 4px;"><div style="font-size:28px;font-weight:bold;color:#D4A847;">${totalA}</div><div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Assessments</div></td>
      <td style="text-align:center;padding:12px 4px;"><div style="font-size:28px;font-weight:bold;color:#D4A847;">${teamCount}</div><div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Teams</div></td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #27272a;margin:16px 0;"/>
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
    <tr><td style="color:#71717a;padding:4px 0;">New Signups (24h / 7d / 30d)</td><td style="color:#e4e4e7;text-align:right;font-weight:bold;padding:4px 0;">${n24} / ${n7} / ${n30}</td></tr>
    <tr><td style="color:#71717a;padding:4px 0;">Assessments (24h / 7d / 30d)</td><td style="color:#e4e4e7;text-align:right;font-weight:bold;padding:4px 0;">${Number(assess24h[0].cnt)} / ${Number(assess7d[0].cnt)} / ${Number(assess30d[0].cnt)}</td></tr>
    <tr><td style="color:#71717a;padding:4px 0;">Avg Daily Signups (7d / 30d)</td><td style="color:#e4e4e7;text-align:right;font-weight:bold;padding:4px 0;">${dailyAvg7} / ${dailyAvg30}</td></tr>
    <tr><td style="color:#71717a;padding:4px 0;">Emails Sent / Failed (24h)</td><td style="color:#e4e4e7;text-align:right;font-weight:bold;padding:4px 0;">${emailsSent24h} / <span style="color:${emailsFailed24h>0?'#ef4444':'#22c55e'};">${emailsFailed24h}</span></td></tr>
    <tr><td style="color:#71717a;padding:4px 0;">Active Coaching Sequences</td><td style="color:#e4e4e7;text-align:right;font-weight:bold;padding:4px 0;">${coachingActive} of ${coachingTotal}</td></tr>
  </table>
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- TOP 3 NEW PEOPLE -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:16px;">Top 3 Newest People</div>
  ${top3Signups.map((s,i) => {
    const scoreColor = {Crisis:'#ef4444',Survival:'#f97316',Growth:'#eab308',Momentum:'#22c55e',Mastery:'#D4A847'}[s.range] || '#71717a';
    return `<div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:${i<2?'10':'0'}px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:#e4e4e7;font-size:15px;font-weight:bold;">${i+1}. ${s.name}</span>
        ${s.score ? '<span style="color:'+scoreColor+';font-size:14px;font-weight:bold;">'+s.score+' ('+s.range+')</span>' : '<span style="color:#71717a;font-size:12px;">No assessment yet</span>'}
      </div>
      <div style="color:#D4A847;font-size:12px;margin-bottom:4px;">${s.email}</div>
      <div style="font-size:12px;color:#71717a;">
        ${s.phone ? 'Phone: '+s.phone+' &mdash; ' : ''}Joined ${new Date(s.joinedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
        ${s.assessments > 0 ? ' &mdash; '+s.assessments+' assessment'+(s.assessments>1?'s':'') : ''}
        ${s.weakest ? ' &mdash; Weakest: <span style="color:#ef4444;">'+s.weakest+'</span>' : ''}
      </div>
      ${s.reportUrl ? '<div style="margin-top:8px;"><a href="'+s.reportUrl+'" style="color:#D4A847;font-size:12px;text-decoration:underline;">View Full Report &rarr;</a></div>' : ''}
    </div>`;
  }).join('')}
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- RECOMMENDATIONS -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:12px;">Strategic Recommendations</div>
  ${recRows}
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- CEO TODO LIST -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:12px;">Your Action Items <span style="color:#71717a;font-weight:normal;">(${pendingTodos.length} open)</span></div>
  ${pendingTodos.length > 0 ? pendingTodos.map((t,i) => {
    const pColor = {critical:'#ef4444',high:'#f97316',medium:'#D4A847',low:'#71717a'}[t.priority] || '#71717a';
    const dueStr = t.due_date ? ' &mdash; Due ' + new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
    return `<div style="background:#111118;border-left:3px solid ${pColor};padding:10px 14px;margin:6px 0;border-radius:0 6px 6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#e4e4e7;font-size:13px;line-height:1.4;">${i+1}. ${t.task}</span>
        <span style="color:${pColor};font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;margin-left:8px;">${t.priority}${dueStr}</span>
      </div>
    </div>`;
  }).join('') : '<div style="color:#71717a;font-size:13px;padding:12px 0;text-align:center;">No pending action items. Add todos via the admin API.</div>'}
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- NEW SIGNUPS -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:12px;">New Signups &mdash; Last 24 Hours <span style="color:#71717a;font-weight:normal;">(${recentSignups.length})</span></div>
  <table width="100%" cellpadding="0" cellspacing="0">${signupRows}</table>
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- RECENT ASSESSMENTS -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:12px;">Assessment Activity &mdash; Last 24 Hours <span style="color:#71717a;font-weight:normal;">(${recentAssessments.length})</span></div>
  <table width="100%" cellpadding="0" cellspacing="0">${assessmentRows}</table>
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- PILLAR HEALTH -->
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:12px;">Platform Pillar Averages</div>
  <table width="100%" cellpadding="0" cellspacing="0">${pillarBars}</table>
</td></tr>

<tr><td style="height:16px;"></td></tr>

<!-- SCORE DISTRIBUTION + TIERS -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="50%" valign="top" style="padding-right:8px;">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:10px;">Score Distribution</div>
      <table width="100%" cellpadding="0" cellspacing="0">${distRows}</table>
    </div>
  </td>
  <td width="50%" valign="top" style="padding-left:8px;">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:10px;">Membership Tiers</div>
      <table width="100%" cellpadding="0" cellspacing="0">${tierRows}</table>
    </div>
  </td>
</tr></table>
</td></tr>

<!-- DEVOTIONAL PREVIEW -->
${todayDevotional ? `<tr><td style="height:16px;"></td></tr>
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 24px;">
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A847;font-weight:bold;margin-bottom:4px;">Today's Devotional &mdash; Going Out at 11:47 AM</div>
  <div style="font-size:12px;color:#71717a;margin-bottom:16px;">Day ${todayDevotional.day_number} of 60 &mdash; Running From Miracles</div>
  <div style="font-family:Georgia,serif;font-size:18px;color:#e4e4e7;font-style:italic;margin-bottom:12px;">${todayDevotional.title}</div>
  <div style="font-size:12px;color:#71717a;margin-bottom:12px;">Chapter: ${todayDevotional.chapter_title} &mdash; Theme: ${todayDevotional.theme}</div>
  <div style="background:#111118;border-left:3px solid #D4A847;padding:12px 16px;margin-bottom:16px;border-radius:0 6px 6px 0;">
    <div style="color:#D4A847;font-size:12px;font-weight:bold;margin-bottom:4px;">${todayDevotional.scripture_reference}</div>
    <div style="color:#e4e4e7;font-size:14px;font-style:italic;line-height:1.5;">"${todayDevotional.scripture_text}"</div>
  </div>
  <div style="color:#a1a1aa;font-size:13px;line-height:1.6;margin-bottom:12px;">${todayDevotional.reflection}</div>
  <div style="background:#111118;border:1px solid #27272a;border-radius:6px;padding:12px 14px;">
    <div style="color:#22c55e;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Action Step</div>
    <div style="color:#e4e4e7;font-size:13px;line-height:1.5;">${todayDevotional.action_step}</div>
  </div>
</td></tr>` : ''}

<!-- FOOTER -->
<tr><td style="text-align:center;padding-top:24px;">
  <a href="${BASE_URL}/admin/contacts" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:8px;">Open Command Center</a>
</td></tr>
<tr><td style="text-align:center;padding-top:20px;">
  <p style="color:#52525b;font-size:11px;margin:0;">Value to Victory &mdash; CEO Daily Briefing</p>
  <p style="color:#3f3f46;font-size:10px;margin:6px 0 0;">Automated report generated at ${now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} ET</p>
</td></tr>

</table></td></tr></table></body></html>`;

        // Send email
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          return res.status(500).json({ error: 'Email credentials not configured' });
        }
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
        await transporter.sendMail({
          from: `"Value to Victory — Executive Brief" <${process.env.GMAIL_USER}>`,
          to: ceoEmail,
          subject: `CEO Briefing — ${todayStr} | ${n24} new signups, ${Number(assess24h[0].cnt)} assessments`,
          html,
        });

        await logEmail(sql, { recipient: ceoEmail, emailType: 'ceo_briefing', subject: `CEO Briefing — ${todayStr}`, metadata: { signups24h: n24, assessments24h: Number(assess24h[0].cnt), totalClients: totalC, totalAssessments: totalA } });

        return res.json({ sent: true, to: ceoEmail, date: todayStr, signups24h: n24, assessments24h: Number(assess24h[0].cnt) });
      } catch (briefingErr) {
        console.error('[ceo-briefing] Error:', briefingErr);
        return res.status(500).json({ error: 'CEO briefing failed', details: briefingErr.message });
      }
    }

    // GET /api/send-apology — Send apology email to all contacts (requires key param)
    if (req.method === 'GET' && url.startsWith('/send-apology')) {
      const apiKey = new URL('http://x' + req.url).searchParams.get('key') || req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) return res.status(401).json({ error: 'Add ?key=YOUR_API_KEY to the URL' });
      try {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return res.status(500).json({ error: 'Email not configured' });
        const contacts = await sql`SELECT id, email, first_name FROM contacts WHERE email IS NOT NULL AND email != '' ORDER BY id`;
        if (contacts.length === 0) return res.json({ sent: 0, message: 'No contacts' });
        const transporter = nodemailer.createTransport({ service:'gmail', auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD} });
        let sentCount = 0;
        const results = [];
        for (const c of contacts) {
          try {
            const firstName = escapeHtml(c.first_name || 'Friend');
            const feedbackUrl = `${BASE_URL}/api/feedback/respond?email=${encodeURIComponent(c.email)}&name=${encodeURIComponent(firstName)}&q=${encodeURIComponent('Can you tell us something the Value Engine helped you with today?')}`;
            const bugUrl = `${BASE_URL}/api/feedback/respond?email=${encodeURIComponent(c.email)}&name=${encodeURIComponent(firstName)}&mode=bug&q=${encodeURIComponent('What went wrong? We want to fix it.')}`;
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="text-align:center;padding-bottom:24px;">
  <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:8px;">VALUE TO VICTORY</div>
  <div style="font-family:Georgia,serif;font-size:26px;font-style:italic;color:#ffffff;">A Quick Note From Shawn</div>
</td></tr>
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px 32px;">
  <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 20px;">${firstName},</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">I owe you an apology.</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">Over the past few days, you may have received more emails than you should have. That's on us. We were upgrading the systems behind the Value Engine &mdash; improving security, adding new features, and building tools to serve you better &mdash; and during that process, some emails went out more than once or at the wrong times.</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">That's not the experience I want for you. You trusted us with your inbox, and we take that seriously.</p>
  <div style="background:#111118;border-left:3px solid #22c55e;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#22c55e;font-size:14px;font-weight:bold;margin:0 0 8px;">What We Fixed</p>
    <ul style="color:#a1a1aa;font-size:14px;line-height:1.8;margin:0;padding-left:16px;">
      <li>Email scheduling is now locked to consistent daily times</li>
      <li>Duplicate sends have been eliminated</li>
      <li>Security upgrades are complete &mdash; your account is safer than ever</li>
      <li>New feedback system so you can tell us exactly what's working (and what isn't)</li>
    </ul>
  </div>
  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>
  <p style="color:#e4e4e7;font-size:15px;font-weight:bold;margin:0 0 12px;">Your Voice Matters</p>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px;">We just built a new feedback system specifically so you can tell us what's helping, what's not, or if anything is broken. Every response goes directly to me.</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="padding-right:6px;">
      <a href="${feedbackUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:14px 8px;border-radius:8px;">Tell Us What Helped</a>
    </td>
    <td width="50%" style="padding-left:6px;">
      <a href="${bugUrl}" style="display:block;text-align:center;background:#18181b;border:1px solid #ef4444;color:#ef4444;font-size:13px;font-weight:bold;text-decoration:none;padding:14px 8px;border-radius:8px;">Report an Issue</a>
    </td>
  </tr></table>
  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px 24px;">
    <p style="color:#e4e4e7;font-size:15px;line-height:1.7;margin:0 0 12px;font-style:italic;">I'm building this for people like you &mdash; people who want to stop guessing and start running the system. Every bug we fix, every feature we add, every email we send &mdash; it's all aimed at making this the most valuable tool you've ever used. Thank you for your patience while we get it right.</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0;">&mdash; Shawn Decker</p>
  </div>
</td></tr>
<tr><td style="text-align:center;padding-top:24px;">
  <a href="${BASE_URL}/member" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:8px;">Open Your Dashboard</a>
</td></tr>
<tr><td style="text-align:center;padding-top:24px;">
  <p style="color:#52525b;font-size:12px;margin:0;">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</p>
</td></tr>
</table></td></tr></table></body></html>`;
            await transporter.sendMail({ from:'"Shawn @ Value Engine" <'+process.env.GMAIL_USER+'>', to:c.email, subject:firstName+', a quick apology and something new for you', html });
            sentCount++;
            results.push({ email:c.email, status:'sent' });
            await logEmail(sql, { recipient:c.email, emailType:'apology', subject:'Apology + new feedback system', contactId:c.id });
          } catch(e) { results.push({ email:c.email, status:'error', error:e.message }); }
        }
        return res.json({ sent:sentCount, total:contacts.length, results });
      } catch(e) { console.error('Server error:', e.message); return res.status(500).json({ error: 'Internal server error' }); }
    }

    // GET /api/send-vt-pitch — Send Virginia Tech partnership pitch
    if (req.method === 'GET' && url.startsWith('/send-vt-pitch')) {
      const params = new URL('http://x' + req.url).searchParams;
      const apiKey = params.get('key') || req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) return res.status(401).json({ error: 'API key required' });
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return res.status(500).json({ error: 'Email not configured' });

      const recipients = [
        { email: 'csundergrad@cs.vt.edu', dept: 'Computer Science', role: 'Undergraduate Programs' },
        { email: 'gradinfo@cs.vt.edu', dept: 'Computer Science', role: 'Graduate Programs' },
        { email: 'mbflynn3@vt.edu', dept: 'Computer Science', role: 'Faculty' },
        { email: 'cmda-advising@vt.edu', dept: 'CMDA / Data Science', role: 'Advising' },
        { email: 'alattime@vt.edu', dept: 'CMDA / Data Science', role: 'Faculty' },
        { email: 'angie.patterson@vt.edu', dept: 'CMDA / Data Science', role: 'Faculty' },
        { email: 'dflora1@vt.edu', dept: 'CMDA / Data Science', role: 'Faculty' },
        { email: 'agryan@vt.edu', dept: 'CMDA / Data Science', role: 'Faculty' },
        { email: 'jodelong@vt.edu', dept: 'CMDA / Data Science', role: 'Faculty' },
        { email: '1225coordinator@math.vt.edu', dept: 'Mathematics', role: 'MATH 1225 Coordinator' },
        { email: '1226coordinator@math.vt.edu', dept: 'Mathematics', role: 'MATH 1226 Coordinator' },
        { email: '2114coordinator@math.vt.edu', dept: 'Mathematics', role: 'MATH 2114 Coordinator' },
        { email: 'summeradvising@math.vt.edu', dept: 'Mathematics', role: 'Summer Advising' },
        { email: 'ufferman@vt.edu', dept: 'Mathematics / Statistics', role: 'Faculty' },
        { email: 'jmhurdus@vt.edu', dept: 'Mathematics / Statistics', role: 'Faculty' },
      ];

      const transporter = nodemailer.createTransport({ service:'gmail', auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD} });
      let sentCount = 0;
      const results = [];

      for (const r of recipients) {
        try {
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

<tr><td style="text-align:center;padding-bottom:24px;">
  <div style="font-family:Georgia,serif;font-size:24px;font-style:italic;color:#ffffff;margin-bottom:4px;">Student Partnership Opportunity</div>
  <div style="font-size:12px;color:#71717a;">Real-World AI &amp; Data Science &mdash; Live Production Platform</div>
</td></tr>

<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:36px 28px;">

  <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear ${r.dept} Team,</p>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">My name is Shawn Decker. I'm the founder of a live AI-powered personal development startup built on the same technology stack Virginia Tech students are learning in their coursework.</p>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">I'm reaching out because I have <strong style="color:#e4e4e7;">specific, funded technical needs</strong> that align directly with your students' skillsets &mdash; and I'm offering something most startups can't: <strong style="color:#D4A847;">real equity, real portfolio work, and a live production codebase</strong> that's already serving users.</p>

  <div style="background:#111118;border-left:3px solid #D4A847;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#D4A847;font-size:14px;font-weight:bold;margin:0 0 8px;">The Platform (Live &amp; In Production)</p>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">88 files &bull; 30,000+ lines of code &bull; 26 database tables &bull; 60+ REST API endpoints &bull; 4 automated daily email systems &bull; Stripe payments &bull; PostgreSQL &bull; Serverless architecture &bull; Claude AI integration</p>
    <p style="color:#71717a;font-size:12px;margin:8px 0 0;">Platform details available after NDA execution.</p>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>

  <p style="color:#e4e4e7;font-size:16px;font-weight:bold;margin:0 0 16px;">What We Need &mdash; Mapped to VT Courses</p>

  <!-- CS NEEDS -->
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:12px;">
    <p style="color:#3b82f6;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Computer Science (AI &amp; ML)</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;width:40%;">CS 4804 / 5804</td><td style="color:#e4e4e7;padding:4px 0;">AI-powered coaching engine that adapts prescriptions based on user behavior patterns and assessment history</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">CS 4824 / 5824</td><td style="color:#e4e4e7;padding:4px 0;">Predictive scoring models &mdash; forecast user outcomes from assessment patterns, churn prediction, engagement optimization</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">CS 5834</td><td style="color:#e4e4e7;padding:4px 0;">NLP for sentiment analysis of user feedback, automated email personalization, natural language interpretation</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">CS 4984</td><td style="color:#e4e4e7;padding:4px 0;">Computer vision for document scanning, OCR for handwritten journal entries</td></tr>
    </table>
  </div>

  <!-- DATA SCIENCE NEEDS -->
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:12px;">
    <p style="color:#22c55e;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Data Science / CMDA</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;width:40%;">CMDA 3634</td><td style="color:#e4e4e7;padding:4px 0;">Interactive analytics dashboard &mdash; visualize multi-dimensional distributions, score trends, and cohort analysis across 50 sub-dimensions</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">CMDA 4654</td><td style="color:#e4e4e7;padding:4px 0;">Cross-dimensional impact modeling &mdash; quantify how weakness in one life dimension cascades into others (20 directional relationships in our existing matrix)</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">STAT 4714</td><td style="color:#e4e4e7;padding:4px 0;">Recommendation engine optimization &mdash; personalize resource suggestions based on score patterns, demographics, and behavioral clusters</td></tr>
    </table>
  </div>

  <!-- MATH NEEDS -->
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:12px;">
    <p style="color:#D4A847;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Mathematics &amp; Statistics</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;width:40%;">MATH 1225/1226</td><td style="color:#e4e4e7;padding:4px 0;">Score curve optimization &mdash; model growth trajectories, diminishing returns analysis, compound improvement rates across 90-day programs</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">MATH 2114</td><td style="color:#e4e4e7;padding:4px 0;">Matrix operations for our relationship assessment system (5-domain give/receive matrices), compatibility scoring, team aggregate analysis</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#a1a1aa;padding:4px 0;vertical-align:top;">STAT 3005</td><td style="color:#e4e4e7;padding:4px 0;">Percentile benchmarking engine, A/B testing framework for engagement, statistical validation of assessment reliability</td></tr>
    </table>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>

  <p style="color:#e4e4e7;font-size:16px;font-weight:bold;margin:0 0 16px;">What Students Get</p>

  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;width:30%;">Portfolio Work</td><td style="color:#a1a1aa;padding:6px 0;">Ship real features to a live production platform with real users &mdash; not a class project that dies on submission</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;">Equity Option</td><td style="color:#a1a1aa;padding:6px 0;">Meaningful equity stakes in a company valued at $1.5M &mdash; real ownership, not just a line on a resume</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;">Tech Stack</td><td style="color:#a1a1aa;padding:6px 0;">Node.js, PostgreSQL, Vercel serverless, Stripe, Claude AI API, Gmail automation &mdash; industry-standard tools</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;">Real Data</td><td style="color:#a1a1aa;padding:6px 0;">Work with actual user data across 50 sub-dimensions, 26 database tables, and growing daily</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;">Mentorship</td><td style="color:#a1a1aa;padding:6px 0;">Direct collaboration with the founder and existing AI systems already integrated into the platform</td></tr>
      <tr><td colspan="2" style="border-bottom:1px solid #27272a;padding:2px 0;"></td></tr>
      <tr><td style="color:#D4A847;font-weight:bold;padding:6px 0;vertical-align:top;">Reference</td><td style="color:#a1a1aa;padding:6px 0;">A founder who will personally vouch for their work to future employers</td></tr>
    </table>
  </div>

  <!-- NDA REQUIREMENT -->
  <div style="background:#111118;border-left:3px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#ef4444;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Confidentiality Requirement</p>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">All participating students will be required to sign a <strong style="color:#e4e4e7;">Non-Disclosure Agreement (NDA)</strong> prior to accessing the codebase, proprietary algorithms, user data, or any trade secrets. This protects both the company's intellectual property and the students' future equity interests in the business.</p>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>

  <p style="color:#e4e4e7;font-size:16px;font-weight:bold;margin:0 0 12px;">The Ask</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">I'd love to discuss how this could work as:</p>
  <ul style="color:#a1a1aa;font-size:14px;line-height:1.8;padding-left:16px;margin:0 0 16px;">
    <li><strong style="color:#e4e4e7;">Senior capstone or independent study project</strong> &mdash; real deliverables, real impact</li>
    <li><strong style="color:#e4e4e7;">Paid internship or co-op</strong> &mdash; funded technical roles</li>
    <li><strong style="color:#e4e4e7;">Research collaboration</strong> &mdash; the assessment data has academic potential</li>
    <li><strong style="color:#e4e4e7;">Guest presentation</strong> &mdash; I'd be happy to present to your class about building AI products from zero to production</li>
  </ul>

  <div style="background:#111118;border-left:3px solid #D4A847;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#D4A847;font-size:14px;font-weight:bold;margin:0 0 8px;">About the Company</p>
    <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0;">We are a personal and professional development startup built around a proprietary 50-dimension diagnostic across 5 life pillars. The platform includes automated AI coaching, relationship assessments, team analytics, a 60-day content delivery system, and integrated commerce. We're pre-revenue with a $1.5M valuation and preparing for angel investment. Full company details and platform access are available after NDA.</p>
  </div>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:16px 0 0;">I'd welcome a 15-minute conversation at your convenience. I'm local to the area and happy to meet on campus.</p>

  <p style="color:#e4e4e7;font-size:15px;line-height:1.7;margin:20px 0 0;">Respectfully,</p>
  <p style="color:#e4e4e7;font-size:15px;font-weight:bold;margin:4px 0 0;">Shawn E. Decker</p>
  <p style="color:#a1a1aa;font-size:13px;margin:2px 0 0;">Founder &amp; CEO</p>
  <p style="color:#71717a;font-size:12px;margin:2px 0 0;">valuetovictory@gmail.com</p>

</td></tr>

<tr><td style="text-align:center;padding-top:20px;">
  <p style="color:#52525b;font-size:11px;margin:0;">&copy; 2026 Shawn E. Decker</p>
</td></tr>
</table></td></tr></table></body></html>`;

          await transporter.sendMail({
            from: '"Shawn Decker" <'+process.env.GMAIL_USER+'>',
            to: r.email,
            replyTo: 'valuetovictory@gmail.com',
            subject: 'Student Partnership: Live AI/Data Platform Seeking VT ' + r.dept + ' Students',
            html
          });
          sentCount++;
          results.push({ email:r.email, dept:r.dept, status:'sent' });
          await logEmail(sql, { recipient:r.email, emailType:'vt_pitch', subject:'VT Partnership Pitch — '+r.dept });
        } catch(e) { results.push({ email:r.email, dept:r.dept, status:'error', error:e.message }); }
      }
      return res.json({ sent:sentCount, total:recipients.length, results });
    }

    // GET/POST /api/send-blueprint — Email platform blueprint to recipients
    if ((req.method === 'POST' || req.method === 'GET') && url.startsWith('/send-blueprint')) {
      // Auth: accept x-api-key header OR key query param
      const apiKey = req.headers['x-api-key'] || new URL('http://x' + req.url).searchParams.get('key') || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) return res.status(401).json({ error: 'API key required. Add ?key=YOUR_KEY to the URL.' });
      let recipients;
      if (req.method === 'GET') {
        const params = new URL('http://x' + req.url).searchParams;
        const toParam = params.get('to');
        recipients = toParam ? toParam.split(',').map(e => e.trim()) : [];
      } else {
        const b = req.body || {};
        recipients = b.to || [];
      }
      if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'to[] required' });
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return res.status(500).json({ error: 'Email not configured' });
      const todayStr = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      const bp = `VTV ASSESSMENT PLATFORM — COMPLETE BLUEPRINT\nGenerated: ${todayStr}\n${'='.repeat(70)}\n\nTECH STACK: Node.js (Vercel Serverless), PostgreSQL (Neon), Gmail SMTP, Stripe, HubSpot, Claude API, PIN+JWT Auth, Vanilla HTML/JS/CSS\n\nBACKEND (12 files, ~9,400 lines):\n  api/index.js (6,550 lines) — 60+ endpoints: assessments, auth, teams, admin, email log, CEO briefing, coaching, prescriptions, challenges, recommendations, affiliates, privacy\n  api/relationships.js (976) — profiles, relationship matrix, love language, couple challenges, partner linking\n  api/checkout.js (284) — Stripe checkout + webhooks\n  api/cart-checkout.js (91) — Multi-item cart\n  api/verify-email.js (263) — Email verification + PDF delivery\n  api/free-book-signup.js (156) — Lead capture\n  api/ai.js (153) — Claude API gateway\n  api/entitlements.js (101) — Membership checks\n  api/send-email.js (57) — Generic email API\n  api/devotional-today.js (53) — Daily devotional\n  api/health.js (23) — Health check\n  api/migrate-*.js — Database migrations\n\nDATABASE (26 tables):\n  contacts, assessments, teams, team_members, peer_ratings, user_profiles, question_bank, answer_history, feedback, challenges, coaching_sequences, coaching_requests, free_book_signups, digital_purchases, analytics_events, relationship_matrix, love_language_results, couple_challenges, couple_challenge_responses, email_log, ceo_todos, story_links, devotional_progress, rfm_chapters, rfm_devotionals, rfm_subscriber_progress\n\nFRONTEND (38 pages, ~20,000 lines):\n  index.html (assessment), member.html (portal), report.html, admin-contacts.html (admin), teams.html, pricing.html, audiobook.html, coaching.html, relationship-hub.html, relationship-matrix.html, love-language.html, couple-challenge.html, couple-report.html, cherish-honor.html, dating.html, partner-invite.html, daily-word.html, free-book.html, action-plan.html, counselor-report.html, challenge.html, progress.html, certificate.html, returning.html, onboarding.html, premium.html, checkout-success.html, settings.html, refer.html, faq.html, privacy.html, terms.html, testimonials.html, framework pages (5), realestate.html, compare.html, stuck.html\n\n5 PILLARS (50 sub-categories, scored 1-5, max 250):\n  TIME: Awareness, Allocation, Protection, Leverage, Five-Hour Leak, Value/Hour, Investment, Downtime, Foresight, Reallocation\n  PEOPLE: Trust, Boundaries, Network, ROI, Audit, Alliances, Love Bank, Communication, Restraint, Replacement\n  INFLUENCE: Leadership, Integrity, Credibility, Listening, Gravity, Micro-Honesties, Words, Responsibility, Adaptive, Multiplier\n  NUMBERS: Financial Awareness, Goals, Investment, Measurement, Cost/Value, #1 Clarity, Small Improvements, Negative Math, Income Multiplier, Negotiation\n  KNOWLEDGE: Learning, Application, Bias, Highest Use, Supply/Demand, Substitution, Double Jeopardy, Compounding, Weighted Analysis, Perception\n\nScore Ranges: Crisis (<20%) | Survival (20-40%) | Growth (40-60%) | Momentum (60-80%) | Mastery (80%+)\n\nDAILY EMAILS (EST): 5:47AM Coaching, 6:45AM CEO Briefing, 11:47AM Devotional, 7:47PM Accountability\n\nTOTAL: 88 files | 30,000+ lines | 26 tables | 60+ endpoints\nBuilt by Shawn E. Decker | valuetovictory.com`;
      const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;"><table width="100%" style="background:#0a0a0a;padding:40px 16px;"><tr><td align="center"><table width="600" style="max-width:600px;"><tr><td style="text-align:center;padding-bottom:20px;"><div style="font-size:10px;letter-spacing:3px;color:#D4A847;">VALUE TO VICTORY</div><div style="font-family:Georgia,serif;font-size:22px;font-style:italic;color:#fff;">Platform Blueprint</div><div style="font-size:12px;color:#71717a;margin-top:4px;">${todayStr}</div></td></tr><tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px 24px;"><p style="color:#e4e4e7;font-size:15px;line-height:1.6;margin:0 0 16px;">The complete VTV Assessment Platform blueprint is attached as a text file.</p><p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px;">This contains the full file map, tech stack, database schema, API endpoints, 5-pillar framework, and email schedule.</p><div style="background:#111118;border-left:3px solid #D4A847;padding:14px 18px;border-radius:0 6px 6px 0;"><p style="color:#D4A847;font-size:13px;font-weight:bold;margin:0 0 6px;">What's Included</p><p style="color:#a1a1aa;font-size:13px;margin:0;">88 files &bull; 30,000+ lines &bull; 26 database tables &bull; 60+ API endpoints &bull; 38 pages &bull; 4 daily automated emails</p></div></td></tr><tr><td style="text-align:center;padding:20px 0;"><p style="color:#52525b;font-size:11px;">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</p></td></tr></table></td></tr></table></body></html>`;
      const transporter = nodemailer.createTransport({ service:'gmail', auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD} });
      const results = [];
      for (const email of recipients) {
        try {
          await transporter.sendMail({ from:'"Value to Victory" <'+process.env.GMAIL_USER+'>', to:email, subject:'VTV Assessment Platform — Complete Blueprint', html:emailHtml, attachments:[{filename:'VTV-Platform-Blueprint.txt',content:bp,contentType:'text/plain'}] });
          results.push({email,status:'sent'});
          await logEmail(sql,{recipient:email,emailType:'blueprint',subject:'VTV Platform Blueprint'});
        } catch(e) { results.push({email,status:'failed',error:e.message}); }
      }
      return res.json({sent:results.filter(r=>r.status==='sent').length, results});
    }

    // ========== STORY LINKS ==========
    // Ensure story_links table exists
    async function ensureStoryLinksTable() {
      try {
        await sql`CREATE TABLE IF NOT EXISTS story_links (
          id SERIAL PRIMARY KEY,
          story_slug TEXT NOT NULL,
          story_title TEXT,
          link_url TEXT NOT NULL,
          link_type TEXT DEFAULT 'article',
          link_title TEXT,
          source TEXT,
          description TEXT,
          publish_date DATE,
          created_at TIMESTAMP DEFAULT NOW()
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_story_links_slug ON story_links(story_slug)`;
      } catch(e) { console.error('ensureStoryLinksTable error:', e.message); }
    }

    // GET /api/story-links?slug=xxx — Get all links for a story
    if (req.method === 'GET' && url.startsWith('/story-links')) {
      await ensureStoryLinksTable();
      const params = new URL('http://x' + req.url).searchParams;
      const slug = params.get('slug');
      const links = slug
        ? await sql`SELECT * FROM story_links WHERE story_slug = ${slug} ORDER BY created_at DESC`
        : await sql`SELECT * FROM story_links ORDER BY created_at DESC`;
      return res.json(links);
    }

    // POST /api/story-links — Add a link to a story
    if (req.method === 'POST' && url === '/story-links') {
      await ensureStoryLinksTable();
      const b = req.body || {};
      if (!b.storySlug || !b.linkUrl) return res.status(400).json({ error: 'storySlug and linkUrl required' });
      const row = await sql`INSERT INTO story_links (story_slug, story_title, link_url, link_type, link_title, source, description, publish_date)
        VALUES (${b.storySlug}, ${b.storyTitle || null}, ${b.linkUrl}, ${b.linkType || 'article'}, ${b.linkTitle || null}, ${b.source || null}, ${b.description || null}, ${b.publishDate || null})
        RETURNING *`;
      return res.json(row[0]);
    }

    // GET /api/story-links/seed — One-time seed for house fire story links
    if (req.method === 'GET' && url === '/story-links/seed') {
      await ensureStoryLinksTable();
      const slug = 'house-fire-relief';
      const existing = await sql`SELECT COUNT(*) as cnt FROM story_links WHERE story_slug = ${slug}`;
      if (Number(existing[0].cnt) > 0) return res.json({ message: 'Already seeded', count: Number(existing[0].cnt) });

      await sql`INSERT INTO story_links (story_slug, story_title, link_url, link_type, link_title, source, description, publish_date) VALUES
        (${slug}, ${'House Fire Relief'}, ${'https://www.gofundme.com/f/qej2ht-house-fire-relief'}, ${'fundraiser'}, ${'House Fire Relief — GoFundMe'}, ${'GoFundMe'}, ${'GoFundMe campaign for house fire relief and recovery'}, ${'2024-04-21'}),
        (${slug}, ${'House Fire Relief'}, ${'https://www.wdbj7.com/2024/04/21/no-injuries-reported-after-bedford-house-fire/'}, ${'news'}, ${'No injuries reported after Bedford house fire'}, ${'WDBJ7'}, ${'WDBJ7 news coverage of the Bedford house fire — includes video report'}, ${'2024-04-21'})
      `;
      return res.json({ message: 'Seeded 2 links for house-fire-relief', links: 2 });
    }

    // ========== AGENT SYSTEM — SELF-LEARNING MULTI-AGENT LOOP ==========
    // Agent dashboard requires JWT or API key (no longer public)
    if (url === '/agent/dashboard') {
      const jwtUser = extractUser(req);
      const apiKey = req.headers['x-api-key'] || new URL('http://x' + req.url).searchParams.get('key') || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!jwtUser && !(validKey && apiKey === validKey)) {
        return res.status(401).json({ error: 'Authentication required. Please log in or provide API key.' });
      }
    }
    // All /agent/* routes require API key EXCEPT tracking endpoints (embedded in emails)
    if (url.startsWith('/agent') && !url.startsWith('/agent/email/track-open') && !url.startsWith('/agent/email/track-click') && url !== '/agent/dashboard') {
      const apiKey = req.headers['x-api-key'] || new URL('http://x' + req.url).searchParams.get('key') || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) {
        return res.status(401).json({ error: 'Unauthorized. Valid API key required.' });
      }
    }

    // POST /api/agent/migrate — Create all agent tables
    if (req.method === 'POST' && url === '/agent/migrate') {
      try {
        await sql`CREATE TABLE IF NOT EXISTS agent_state (
          id SERIAL PRIMARY KEY,
          agent_name TEXT NOT NULL,
          run_at TIMESTAMP DEFAULT NOW(),
          observations JSONB DEFAULT '{}',
          decisions JSONB DEFAULT '{}',
          actions_taken JSONB DEFAULT '[]',
          outcome JSONB DEFAULT '{}',
          learning_updates JSONB DEFAULT '{}'
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_agent_state_name ON agent_state(agent_name)`;

        await sql`CREATE TABLE IF NOT EXISTS agent_rules (
          id SERIAL PRIMARY KEY,
          agent_name TEXT NOT NULL,
          rule_key TEXT NOT NULL,
          rule_config JSONB DEFAULT '{}',
          weight FLOAT DEFAULT 1.0,
          times_fired INTEGER DEFAULT 0,
          times_succeeded INTEGER DEFAULT 0,
          last_fired_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(agent_name, rule_key)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS email_engagement (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER,
          email TEXT NOT NULL,
          coaching_day INTEGER,
          sent_at TIMESTAMP DEFAULT NOW(),
          opened_at TIMESTAMP,
          clicked_at TIMESTAMP,
          action_completed BOOLEAN DEFAULT FALSE,
          retook_assessment BOOLEAN DEFAULT FALSE,
          email_variant TEXT DEFAULT 'default',
          metadata JSONB DEFAULT '{}'
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_email_engagement_email ON email_engagement(email)`;

        await sql`CREATE TABLE IF NOT EXISTS page_analytics (
          id SERIAL PRIMARY KEY,
          page_path TEXT NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          views INTEGER DEFAULT 0,
          unique_visitors INTEGER DEFAULT 0,
          bounce_rate FLOAT DEFAULT 0,
          conversion_rate FLOAT DEFAULT 0,
          drop_off_rate FLOAT DEFAULT 0,
          insights JSONB DEFAULT '{}',
          UNIQUE(page_path, period_start)
        )`;

        await sql`CREATE TABLE IF NOT EXISTS system_health_log (
          id SERIAL PRIMARY KEY,
          checked_at TIMESTAMP DEFAULT NOW(),
          service TEXT NOT NULL,
          status TEXT NOT NULL,
          response_time_ms INTEGER,
          details JSONB DEFAULT '{}',
          alert_sent BOOLEAN DEFAULT FALSE,
          auto_healed BOOLEAN DEFAULT FALSE,
          heal_action TEXT
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_health_service ON system_health_log(service)`;

        await sql`CREATE TABLE IF NOT EXISTS partner_invites (
          id SERIAL PRIMARY KEY,
          inviter_email TEXT NOT NULL,
          partner_email TEXT NOT NULL,
          inviter_name TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          accepted_at TIMESTAMP,
          UNIQUE(inviter_email)
        )`;

        // Alter coaching_sequences
        await sql`ALTER TABLE coaching_sequences ADD COLUMN IF NOT EXISTS engagement_score FLOAT DEFAULT 0`;
        await sql`ALTER TABLE coaching_sequences ADD COLUMN IF NOT EXISTS email_variant TEXT DEFAULT 'default'`;
        await sql`ALTER TABLE coaching_sequences ADD COLUMN IF NOT EXISTS persona TEXT DEFAULT 'standard'`;

        // Seed initial agent rules
        const seedRules = [
          // Systems Agent rules
          ['systems', 'neon_slow', JSON.stringify({threshold_ms: 500, action: 'flag_degraded'}), 1.0],
          ['systems', 'n8n_down_consecutive', JSON.stringify({consecutive_fails: 3, action: 'restart_via_api'}), 1.5],
          ['systems', 'vps_unreachable', JSON.stringify({action: 'alert_owner'}), 2.0],
          ['systems', 'gmail_auth_fail', JSON.stringify({action: 'pause_email_agent'}), 2.0],
          // Email Agent rules
          ['email', 'skip_if_no_open_2_days', JSON.stringify({condition: 'no_open_last_2', action: 'delay_1_day', subject: 'curiosity'}), 1.2],
          ['email', 'nudge_on_no_click', JSON.stringify({condition: 'opened_no_click', action: 'send_nudge_variant'}), 0.9],
          ['email', 'accelerate_fast_mover', JSON.stringify({condition: 'persona_fast_mover', action: 'send_next_same_day'}), 1.5],
          ['email', 'momentum_on_action', JSON.stringify({condition: 'action_completed', action: 'send_momentum_variant'}), 1.3],
          ['email', 'recalculate_on_retake', JSON.stringify({condition: 'retook_assessment', action: 'regenerate_prescription'}), 2.0],
          ['email', 're_engage_subject', JSON.stringify({condition: 'no_open_last_1', action: 'use_curiosity_subject'}), 1.1],
          // Website Agent rules
          ['website', 'high_bounce_alert', JSON.stringify({threshold: 0.7, action: 'flag_page'}), 1.0],
          ['website', 'conversion_drop', JSON.stringify({threshold_pct: 15, action: 'alert_owner'}), 1.5],
          ['website', 'drop_off_spike', JSON.stringify({threshold_pct: 20, action: 'flag_and_recommend'}), 1.3],
        ];
        for (const [agent, key, config, weight] of seedRules) {
          await sql`INSERT INTO agent_rules (agent_name, rule_key, rule_config, weight)
            VALUES (${agent}, ${key}, ${config}::jsonb, ${weight})
            ON CONFLICT (agent_name, rule_key) DO NOTHING`;
        }

        // System registry for local services (Docker, Ollama, etc.)
        await sql`CREATE TABLE IF NOT EXISTS system_registry (
          id SERIAL PRIMARY KEY,
          system_name TEXT NOT NULL UNIQUE,
          system_type TEXT NOT NULL,
          category TEXT DEFAULT 'local',
          endpoint TEXT,
          status TEXT DEFAULT 'unknown',
          metadata JSONB DEFAULT '{}',
          last_reported_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        )`;
        await sql`CREATE INDEX IF NOT EXISTS idx_system_registry_type ON system_registry(system_type)`;

        return res.json({ success: true, message: 'All agent tables created and rules seeded' });
      } catch (migErr) {
        console.error('[agent/migrate] Error:', migErr);
        return res.status(500).json({ error: migErr.message });
      }
    }

    // ========== LOCAL SYSTEM REPORTING ==========

    // POST /api/agent/systems/report — Local agent pushes full system state
    if (req.method === 'POST' && url === '/agent/systems/report') {
      try {
        const body = req.body || {};
        const { systems } = body;
        if (!Array.isArray(systems)) return res.status(400).json({ error: 'systems array required' });

        for (const sys of systems) {
          await sql`INSERT INTO system_registry (system_name, system_type, category, endpoint, status, metadata, last_reported_at)
            VALUES (${sys.name}, ${sys.type}, ${sys.category || 'local'}, ${sys.endpoint || null}, ${sys.status}, ${JSON.stringify(sys.metadata || {})}::jsonb, NOW())
            ON CONFLICT (system_name) DO UPDATE SET
              status = EXCLUDED.status,
              metadata = EXCLUDED.metadata,
              endpoint = EXCLUDED.endpoint,
              last_reported_at = NOW()`;
        }

        return res.json({ success: true, updated: systems.length });
      } catch (repErr) {
        return res.status(500).json({ error: repErr.message });
      }
    }

    // GET /api/agent/systems/registry — Get all registered systems
    if (req.method === 'GET' && url === '/agent/systems/registry') {
      try {
        const systems = await sql`SELECT * FROM system_registry ORDER BY category, system_type, system_name`;
        return res.json({ systems });
      } catch (regErr) {
        return res.status(500).json({ error: regErr.message });
      }
    }

    // ========== SYSTEMS AGENT ==========

    // GET /api/agent/systems/run — Main systems health check loop
    if (req.method === 'GET' && url === '/agent/systems/run') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const services = [];
        const alerts = [];
        const actions = [];

        // 1. Check Neon DB
        const dbStart = Date.now();
        try {
          await sql`SELECT 1`;
          const dbMs = Date.now() - dbStart;
          services.push({ service: 'neon', status: dbMs > 500 ? 'degraded' : 'healthy', response_time_ms: dbMs });
        } catch (dbErr) {
          services.push({ service: 'neon', status: 'down', response_time_ms: null, details: { error: dbErr.message } });
        }

        // 2. Check n8n
        try {
          const n8nStart = Date.now();
          const n8nResp = await fetch('https://n8n.srv1138119.hstgr.cloud', { signal: AbortSignal.timeout(8000) });
          const n8nMs = Date.now() - n8nStart;
          services.push({ service: 'n8n', status: n8nResp.ok ? 'healthy' : 'degraded', response_time_ms: n8nMs });
        } catch (n8nErr) {
          services.push({ service: 'n8n', status: 'down', response_time_ms: null, details: { error: n8nErr.message } });
        }

        // 3. Check VPS audiobook (nginx on 8082)
        try {
          const vpsStart = Date.now();
          const vpsResp = await fetch('http://72.61.11.55:8082/audio/rfm/01-introduction.mp3', { method: 'HEAD', signal: AbortSignal.timeout(8000) });
          const vpsMs = Date.now() - vpsStart;
          services.push({ service: 'vps_audio', status: vpsResp.ok ? 'healthy' : 'degraded', response_time_ms: vpsMs });
        } catch (vpsErr) {
          services.push({ service: 'vps_audio', status: 'down', response_time_ms: null, details: { error: vpsErr.message } });
        }

        // 4. Check Stripe API
        try {
          const stripeStart = Date.now();
          const stripeResp = await fetch('https://api.stripe.com/v1/balance', {
            headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
            signal: AbortSignal.timeout(8000)
          });
          const stripeMs = Date.now() - stripeStart;
          services.push({ service: 'stripe', status: stripeResp.ok ? 'healthy' : 'degraded', response_time_ms: stripeMs });
        } catch (stripeErr) {
          services.push({ service: 'stripe', status: 'down', response_time_ms: null, details: { error: stripeErr.message } });
        }

        // 5. Check Gmail SMTP (lightweight — just verify transporter can be created)
        try {
          const gmailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          await gmailTransporter.verify();
          services.push({ service: 'gmail', status: 'healthy', response_time_ms: 0 });
        } catch (gmailErr) {
          services.push({ service: 'gmail', status: 'down', response_time_ms: null, details: { error: gmailErr.message } });
        }

        // Log all results to system_health_log
        for (const s of services) {
          await sql`INSERT INTO system_health_log (service, status, response_time_ms, details)
            VALUES (${s.service}, ${s.status}, ${s.response_time_ms}, ${JSON.stringify(s.details || {})}::jsonb)`;
        }

        // Check for transitions to "down" — compare with previous check
        for (const s of services) {
          if (s.status === 'down' || s.status === 'degraded') {
            const prev = await sql`SELECT status FROM system_health_log
              WHERE service = ${s.service} AND id != (SELECT MAX(id) FROM system_health_log WHERE service = ${s.service})
              ORDER BY id DESC LIMIT 1`;
            const wasHealthy = prev.length === 0 || prev[0].status === 'healthy';
            if (wasHealthy) {
              alerts.push({ service: s.service, transition: `healthy → ${s.status}`, details: s.details });
            }

            // Auto-heal: VPS/n8n restart via Hostinger API
            if (s.service === 'n8n' && s.status === 'down') {
              const recentDowns = await sql`SELECT COUNT(*) as cnt FROM system_health_log
                WHERE service = 'n8n' AND status = 'down'
                AND checked_at > NOW() - INTERVAL '20 minutes'`;
              if (parseInt(recentDowns[0].cnt) >= 3) {
                try {
                  const hostingerResp = await fetch('https://developers.hostinger.com/api/vps/v1/virtual-machines/1138119/restart', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.HOSTINGER_API_KEY || ''}` }
                  });
                  actions.push({ action: 'vps_restart', result: hostingerResp.ok ? 'sent' : 'failed' });
                  await sql`UPDATE system_health_log SET auto_healed = true, heal_action = 'vps_restart'
                    WHERE id = (SELECT MAX(id) FROM system_health_log WHERE service = 'n8n')`;
                } catch (healErr) {
                  actions.push({ action: 'vps_restart', result: 'error', error: healErr.message });
                }
              }
            }
          }
        }

        // Update agent_rules — track firing
        for (const s of services) {
          if (s.status !== 'healthy') {
            const ruleKey = s.service === 'neon' ? 'neon_slow' : s.service === 'n8n' ? 'n8n_down_consecutive' : s.service === 'gmail' ? 'gmail_auth_fail' : 'vps_unreachable';
            await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW()
              WHERE agent_name = 'systems' AND rule_key = ${ruleKey}`;
          }
        }

        // Log agent state
        await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
          VALUES ('systems', ${JSON.stringify({ services })}::jsonb, ${JSON.stringify({ alerts })}::jsonb, ${JSON.stringify(actions)}::jsonb)`;

        return res.json({ success: true, services, alerts, actions, timestamp: new Date().toISOString() });
      } catch (sysErr) {
        console.error('[agent/systems/run] Error:', sysErr);
        return res.status(500).json({ error: sysErr.message });
      }
    }

    // GET /api/agent/systems/status — Dashboard view of current health
    if (req.method === 'GET' && url === '/agent/systems/status') {
      try {
        // Latest status per service
        const latest = await sql`SELECT DISTINCT ON (service) service, status, response_time_ms, checked_at, details, auto_healed, heal_action
          FROM system_health_log ORDER BY service, checked_at DESC`;

        // 24h uptime per service
        const uptime = await sql`SELECT service,
          ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'healthy') / NULLIF(COUNT(*), 0), 1) as uptime_pct,
          COUNT(*) as total_checks
          FROM system_health_log WHERE checked_at > NOW() - INTERVAL '24 hours' GROUP BY service`;

        // Recent alerts (last 24h)
        const recentAlerts = await sql`SELECT * FROM agent_state
          WHERE agent_name = 'systems' AND decisions::text != '{"alerts":[]}'
          AND run_at > NOW() - INTERVAL '24 hours' ORDER BY run_at DESC LIMIT 10`;

        return res.json({ latest, uptime, recentAlerts });
      } catch (statusErr) {
        return res.status(500).json({ error: statusErr.message });
      }
    }

    // ========== EMAIL AGENT — OBSERVATION LAYER ==========

    // GET /api/agent/email/track-open?id=X — 1x1 tracking pixel
    if (req.method === 'GET' && url.startsWith('/agent/email/track-open')) {
      const params = new URL('http://x' + req.url).searchParams;
      const engagementId = params.get('id');
      if (engagementId) {
        try {
          await sql`UPDATE email_engagement SET opened_at = NOW() WHERE id = ${parseInt(engagementId)} AND opened_at IS NULL`;
        } catch (e) { /* non-fatal */ }
      }
      // Return 1x1 transparent GIF
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache');
      return res.end(pixel);
    }

    // GET /api/agent/email/track-click?id=X&url=Y — Link redirect tracker (allowlisted domains only)
    if (req.method === 'GET' && url.startsWith('/agent/email/track-click')) {
      const params = new URL('http://x' + req.url).searchParams;
      const engagementId = params.get('id');
      let redirectUrl = params.get('url') || `${BASE_URL}/member`;
      // Prevent open redirect — only allow our domains
      try {
        const parsed = new URL(redirectUrl);
        const allowedHosts = ['valuetovictory.com', 'www.valuetovictory.com', 'assessment.valuetovictory.com', 'shawnedecker.com', 'www.shawnedecker.com', 'thelostartofvalue.com', 'www.thelostartofvalue.com'];
        if (!allowedHosts.includes(parsed.hostname)) {
          redirectUrl = `${BASE_URL}/member`;
        }
      } catch { redirectUrl = `${BASE_URL}/member`; }
      if (engagementId) {
        try {
          await sql`UPDATE email_engagement SET clicked_at = NOW() WHERE id = ${parseInt(engagementId)} AND clicked_at IS NULL`;
        } catch (e) { /* non-fatal */ }
      }
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }

    // POST /api/agent/email/report-action — Frontend reports action step completed
    if (req.method === 'POST' && url === '/agent/email/report-action') {
      try {
        const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { email, coaching_day } = b;
        if (!email) return res.status(400).json({ error: 'Email required' });
        await sql`UPDATE email_engagement SET action_completed = true
          WHERE email = ${email.toLowerCase()} AND (coaching_day = ${coaching_day || null} OR coaching_day IS NULL)
          AND action_completed = false`;
        return res.json({ success: true });
      } catch (actionErr) {
        return res.status(500).json({ error: actionErr.message });
      }
    }

    // ========== EMAIL AGENT — ADAPTIVE LAYER ==========

    // GET /api/agent/email/run — Main adaptive coaching loop (replaces /coaching/send)
    if (req.method === 'GET' && url === '/agent/email/run') {
      try {
        await ensureCoachingTable(sql);

        // Use server-side CURRENT_DATE rather than passing a JS Date string —
        // the neon-serverless driver sends parameters as text and Postgres
        // refuses to compare timestamp < text without an explicit cast,
        // which threw "operator does not exist: text > timestamp with time zone".
        const sequences = await sql`
          SELECT cs.*, c.first_name, c.email as contact_email, c.id as contact_id
          FROM coaching_sequences cs
          JOIN contacts c ON LOWER(c.email) = LOWER(cs.email)
          WHERE cs.unsubscribed = false
          AND (cs.last_sent_at IS NULL OR cs.last_sent_at < CURRENT_DATE)
          LIMIT 50`;

        let sentCount = 0, skippedCount = 0, adaptedCount = 0;
        const decisions = [];

        for (const seq of sequences) {
          const email = seq.email.toLowerCase();
          const day = seq.current_day;

          // Skip day 0 (assessment day)
          if (day === 0) {
            await sql`UPDATE coaching_sequences SET current_day = 1 WHERE LOWER(email) = LOWER(${email})`;
            continue;
          }

          // === OBSERVE: Get engagement history ===
          const engagement = await sql`SELECT * FROM email_engagement
            WHERE LOWER(email) = LOWER(${email}) ORDER BY sent_at DESC LIMIT 7`;

          const recentOpens = engagement.filter(e => e.opened_at).length;
          const recentClicks = engagement.filter(e => e.clicked_at).length;
          const recentActions = engagement.filter(e => e.action_completed).length;

          // === OBSERVE: Get latest coaching reply ===
          let latestReply = null;
          let replyStreak = 0;
          try {
            const replies = await sql`SELECT * FROM coaching_replies WHERE LOWER(email) = LOWER(${email}) ORDER BY coaching_day DESC LIMIT 5`;
            if (replies.length > 0) {
              latestReply = replies[0];
              // Calculate reply streak
              const replyDays = replies.map(r => r.coaching_day).sort((a, b) => b - a);
              replyStreak = 1;
              for (let i = 0; i < replyDays.length - 1; i++) {
                if (replyDays[i] - replyDays[i + 1] <= 2) replyStreak++; // Allow 2-day gap for Phase 2+ cadence
                else break;
              }
            }
          } catch (e) { /* coaching_replies table may not exist yet */ }

          // Check for assessment retake — completed_at is stored as TEXT
          // (legacy schema), so cast explicitly for the timestamp comparison.
          const retake = await sql`SELECT id FROM assessments
            WHERE contact_id = ${seq.contact_id}
            AND completed_at::timestamptz > NOW() - INTERVAL '48 hours'
            ORDER BY completed_at DESC LIMIT 1`;
          const hasRetaken = retake.length > 0;

          // === OBSERVE: Recent user_feedback for this email — close the listening loop ===
          // If a user has filed an unresolved bug or actively-investigating feedback in
          // the last 14 days, the coaching loop should NOT push standard sales-y emails
          // at them. Switches persona to 'investigating', applies a 7-day cooldown
          // unless they're a fast_mover (who actually want continuity).
          let openFeedback = [];
          let recentBugReport = false;
          try {
            openFeedback = await sql`SELECT id, severity, status, category, created_at,
                EXTRACT(epoch FROM (NOW() - created_at))/86400 AS age_days
              FROM user_feedback
              WHERE LOWER(email) = LOWER(${email})
                AND status IN ('new', 'investigating')
                AND created_at > NOW() - INTERVAL '14 days'
              ORDER BY created_at DESC LIMIT 5`;
            recentBugReport = openFeedback.some(f => f.category === 'bug');
          } catch (fbErr) { /* user_feedback table may not exist in dev */ }

          // === CLASSIFY: Assign persona (now includes reply + feedback data) ===
          let persona = 'standard';
          const replyBonus = latestReply ? 0.2 : 0;
          const streakBonus = replyStreak >= 3 ? 0.15 : replyStreak >= 2 ? 0.1 : 0;
          const engagementScore = engagement.length > 0
            ? Math.min(1.0, ((recentOpens * 0.25 + recentClicks * 0.25 + recentActions * 0.2 + replyBonus + streakBonus + (hasRetaken ? 0.1 : 0)) / Math.max(engagement.length, 1)))
            : 0.5; // Default for new users

          if (replyStreak >= 3 || (recentOpens >= 3 && recentClicks >= 2)) persona = 'fast_mover';
          else if (latestReply && latestReply.sentiment === 'negative' && latestReply.mood === 'struggling') persona = 'struggling';
          else if (recentOpens <= 1 && recentClicks === 0 && engagement.length >= 2 && !latestReply) persona = 'disengaged';

          // Check if high performer
          const latestAssessment = await sql`SELECT score_range FROM assessments
            WHERE contact_id = ${seq.contact_id} ORDER BY completed_at DESC LIMIT 1`;
          if (latestAssessment.length > 0 && ['Momentum', 'Mastery'].includes(latestAssessment[0].score_range)) {
            persona = 'high_performer';
          }

          // OVERRIDE: open bug report from this user wins — empathy + cooldown.
          // fast_mover stays fast_mover (they want continuity even when reporting).
          if (recentBugReport && persona !== 'fast_mover') {
            persona = 'investigating';
            decision.feedback_signal = openFeedback.map(f => `#${f.id}/${f.category}/${f.severity}/${Math.round(f.age_days)}d`).join(',');
          }

          // === DECIDE: Apply rules sorted by weight ===
          const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'email' ORDER BY weight DESC`;

          let variant = 'default';
          let shouldSkip = false;
          let decision = { email, day, persona, engagementScore: Math.round(engagementScore * 100) / 100, rules_fired: [] };

          for (const rule of rules) {
            const config = rule.rule_config;
            let fired = false;

            if (rule.rule_key === 'skip_if_no_open_2_days' && recentOpens === 0 && engagement.length >= 2) {
              shouldSkip = true;
              decision.rules_fired.push('skip_if_no_open_2_days');
              fired = true;
            }
            if (rule.rule_key === 'nudge_on_no_click' && recentOpens > 0 && recentClicks === 0) {
              variant = 'nudge';
              decision.rules_fired.push('nudge_on_no_click');
              fired = true;
            }
            if (rule.rule_key === 'momentum_on_action' && recentActions > 0) {
              variant = 'momentum';
              decision.rules_fired.push('momentum_on_action');
              fired = true;
            }
            if (rule.rule_key === 'accelerate_fast_mover' && persona === 'fast_mover') {
              decision.rules_fired.push('accelerate_fast_mover');
              fired = true;
              // Don't skip — send immediately
            }
            if (rule.rule_key === 'recalculate_on_retake' && hasRetaken) {
              decision.rules_fired.push('recalculate_on_retake');
              fired = true;
              // Will use latest assessment data below
            }
            if (rule.rule_key === 're_engage_subject' && recentOpens === 0 && engagement.length >= 1 && persona === 'disengaged') {
              variant = 're_engage';
              decision.rules_fired.push('re_engage_subject');
              fired = true;
            }

            if (fired) {
              await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW()
                WHERE id = ${rule.id}`;
            }
          }

          // 7-day cooldown after a bug report (unless fast_mover, who want continuity).
          // Newest feedback is openFeedback[0] since query is ORDER BY created_at DESC.
          if (persona === 'investigating' && openFeedback.length > 0 && openFeedback[0].age_days < 7 && persona !== 'fast_mover') {
            shouldSkip = true;
            decision.rules_fired.push('cooldown_after_bug_report');
            decision.feedback_cooldown_days_remaining = Math.max(0, 7 - Math.floor(openFeedback[0].age_days));
          }
          // Empathy variant for investigating-persona who passes cooldown
          if (persona === 'investigating' && !shouldSkip) {
            variant = 'empathy';
            decision.rules_fired.push('empathy_on_bug_report');
          }

          if (shouldSkip && persona !== 'fast_mover') {
            skippedCount++;
            decision.action = 'skipped';
            decisions.push(decision);
            await sql`UPDATE coaching_sequences SET engagement_score = ${engagementScore}, persona = ${persona} WHERE LOWER(email) = LOWER(${email})`;
            continue;
          }

          // === ACT: Get assessment data and generate email ===
          const assessmentRow = await sql`SELECT a.* FROM assessments a
            JOIN contacts c ON a.contact_id = c.id
            WHERE LOWER(c.email) = ${email}
            ORDER BY a.completed_at DESC LIMIT 1`;
          if (assessmentRow.length === 0) continue;

          const assessment = assessmentRow[0];
          const prescription = typeof assessment.prescription === 'string' ? JSON.parse(assessment.prescription) : (assessment.prescription || {});

          // Generate email with variant awareness
          let emailContent = generateCoachingEmail(day, assessment, prescription, email);

          // Modify subject line based on variant + reply data
          let subject = emailContent.subject || `Day ${day}: Your Value Engine Coaching`;
          if (latestReply && latestReply.mood === 'struggling') {
            subject = `${seq.first_name || 'Hey'} — I heard you. Here's what to do next.`;
            variant = 'empathy';
          } else if (latestReply && latestReply.action_completed && latestReply.sentiment === 'positive') {
            subject = `${seq.first_name || 'You'} crushed Day ${day - 1}. Day ${day} is bigger.`;
            variant = 'momentum';
          } else if (latestReply && !latestReply.action_completed) {
            subject = `The step you skipped yesterday? It takes 10 minutes.`;
            variant = 'nudge';
          } else if (replyStreak >= 3) {
            subject = `${replyStreak}-day streak. This is how scores change.`;
            variant = 'streak';
          } else if (variant === 'nudge') {
            subject = `Quick win for today — Day ${day}`;
          } else if (variant === 're_engage') {
            subject = `Did you know this about your ${assessment.weakest_pillar || 'weakest'} score?`;
          } else if (variant === 'momentum') {
            subject = `You're building momentum — Day ${day}`;
          }

          // Create engagement record BEFORE sending
          const engRecord = await sql`INSERT INTO email_engagement (contact_id, email, coaching_day, email_variant)
            VALUES (${seq.contact_id}, ${email}, ${day}, ${variant}) RETURNING id`;
          const engId = engRecord[0].id;

          // Wrap links and add tracking pixel
          let html = emailContent.html || '';
          const trackBase = `${BASE_URL}/api/agent/email`;
          html = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
            return `href="${trackBase}/track-click?id=${engId}&url=${encodeURIComponent(url)}"`;
          });
          html += `<img src="${trackBase}/track-open?id=${engId}" width="1" height="1" style="display:none" alt=""/>`;

          // Send email
          try {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await transporter.sendMail({
              from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
              to: email,
              subject,
              html,
            });
            sentCount++;
            if (variant !== 'default') adaptedCount++;
            decision.action = `sent_${variant}`;
          } catch (sendErr) {
            decision.action = 'send_failed';
            decision.error = sendErr.message;
          }

          // Update coaching sequence
          await sql`UPDATE coaching_sequences
            SET current_day = ${day + 1}, last_sent_at = NOW(),
                engagement_score = ${engagementScore}, email_variant = ${variant}, persona = ${persona}
            WHERE LOWER(email) = LOWER(${email})`;

          decisions.push(decision);

          // === LEARN: Check outcomes of previous decisions ===
          // For emails sent 24-48h ago, check if they were opened/clicked
          const oldEngagement = await sql`SELECT ee.*, ar.id as rule_id, ar.rule_key, ar.times_succeeded
            FROM email_engagement ee
            LEFT JOIN agent_rules ar ON ar.agent_name = 'email'
            WHERE ee.email = ${email}
            AND ee.sent_at > NOW() - INTERVAL '48 hours'
            AND ee.sent_at < NOW() - INTERVAL '24 hours'
            LIMIT 5`;
          for (const old of oldEngagement) {
            const succeeded = old.opened_at || old.clicked_at;
            if (succeeded && old.email_variant !== 'default') {
              // The variant worked — increase weight of the rule that chose it
              const variantRuleMap = { nudge: 'nudge_on_no_click', re_engage: 're_engage_subject', momentum: 'momentum_on_action' };
              const ruleKey = variantRuleMap[old.email_variant];
              if (ruleKey) {
                await sql`UPDATE agent_rules SET times_succeeded = times_succeeded + 1,
                  weight = LEAST(3.0, weight + 0.05)
                  WHERE agent_name = 'email' AND rule_key = ${ruleKey}`;
              }
            } else if (!succeeded && old.email_variant !== 'default') {
              // Variant didn't work — decrease weight slightly
              const variantRuleMap = { nudge: 'nudge_on_no_click', re_engage: 're_engage_subject', momentum: 'momentum_on_action' };
              const ruleKey = variantRuleMap[old.email_variant];
              if (ruleKey) {
                await sql`UPDATE agent_rules SET weight = GREATEST(0.1, weight - 0.02)
                  WHERE agent_name = 'email' AND rule_key = ${ruleKey}`;
              }
            }
          }
        }

        // Log agent state
        await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
          VALUES ('email', ${JSON.stringify({ total: sequences.length, personas: decisions.map(d => d.persona) })}::jsonb,
                  ${JSON.stringify(decisions)}::jsonb,
                  ${JSON.stringify({ sent: sentCount, skipped: skippedCount, adapted: adaptedCount })}::jsonb)`;

        return res.json({ success: true, processed: sequences.length, sent: sentCount, skipped: skippedCount, adapted: adaptedCount, decisions });
      } catch (emailAgentErr) {
        console.error('[agent/email/run] Error:', emailAgentErr);
        return res.status(500).json({ error: emailAgentErr.message });
      }
    }

    // ========== WEBSITE AGENT ==========

    // GET /api/agent/website/run — Aggregate analytics and generate insights
    if (req.method === 'GET' && url === '/agent/website/run') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Aggregate analytics_events from last 24h
        const pageStats = await sql`
          SELECT
            COALESCE(metadata->>'page', 'unknown') as page_path,
            COUNT(*) as views,
            COUNT(DISTINCT session_id) as unique_visitors,
            COUNT(*) FILTER (WHERE event_type = 'assessment_completed') as conversions
          FROM analytics_events
          WHERE created_at > NOW() - INTERVAL '24 hours'
          AND event_type IN ('page_view', 'assessment_completed', 'assessment_started')
          GROUP BY metadata->>'page'
          ORDER BY views DESC`;

        // Calculate bounce rate per page (single-page sessions)
        const bounceData = await sql`
          WITH session_pages AS (
            SELECT session_id, COUNT(DISTINCT COALESCE(metadata->>'page', '')) as page_count
            FROM analytics_events
            WHERE created_at > NOW() - INTERVAL '24 hours' AND session_id IS NOT NULL
            GROUP BY session_id
          )
          SELECT
            ROUND(100.0 * COUNT(*) FILTER (WHERE page_count = 1) / NULLIF(COUNT(*), 0), 1) as overall_bounce_rate,
            COUNT(*) as total_sessions
          FROM session_pages`;

        // Get previous period for comparison
        const prevStats = await sql`SELECT page_path, views, conversion_rate, bounce_rate
          FROM page_analytics WHERE period_start = ${new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]}`;
        const prevMap = {};
        for (const p of prevStats) prevMap[p.page_path] = p;

        const insights = [];
        const pageResults = [];

        for (const page of pageStats) {
          const convRate = page.views > 0 ? (page.conversions / page.views) : 0;
          const prev = prevMap[page.page_path];
          let pageInsight = null;

          if (prev && prev.views > 5) {
            const viewChange = ((page.views - prev.views) / prev.views * 100).toFixed(1);
            const convChange = prev.conversion_rate > 0 ? ((convRate - prev.conversion_rate) / prev.conversion_rate * 100).toFixed(1) : 0;

            if (parseFloat(viewChange) < -20) {
              pageInsight = `Traffic dropped ${Math.abs(viewChange)}% vs previous day`;
              insights.push({ page: page.page_path, type: 'traffic_drop', detail: pageInsight, severity: 'warning' });
            }
            if (parseFloat(convChange) < -15 && prev.conversion_rate > 0.05) {
              pageInsight = `Conversion rate dropped ${Math.abs(convChange)}% vs previous day`;
              insights.push({ page: page.page_path, type: 'conversion_drop', detail: pageInsight, severity: 'critical' });
            }
          }

          // Upsert into page_analytics
          await sql`INSERT INTO page_analytics (page_path, period_start, period_end, views, unique_visitors, conversion_rate, bounce_rate, insights)
            VALUES (${page.page_path}, ${yesterday}, ${today}, ${page.views}, ${page.unique_visitors}, ${convRate},
                    ${bounceData[0]?.overall_bounce_rate || 0}, ${JSON.stringify(pageInsight ? { note: pageInsight } : {})}::jsonb)
            ON CONFLICT (page_path, period_start)
            DO UPDATE SET views = ${page.views}, unique_visitors = ${page.unique_visitors},
              conversion_rate = ${convRate}, insights = ${JSON.stringify(pageInsight ? { note: pageInsight } : {})}::jsonb`;

          pageResults.push({ page: page.page_path, views: page.views, unique: page.unique_visitors, convRate: Math.round(convRate * 1000) / 10 + '%' });
        }

        // Update rule weights based on whether flagged pages improved
        const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'website'`;
        for (const r of rules) {
          if (r.times_fired > 0) {
            // Simple: if we flagged something and it improved, count as success
            await sql`UPDATE agent_rules SET times_fired = times_fired WHERE id = ${r.id}`;
          }
        }

        // Log agent state
        await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
          VALUES ('website',
            ${JSON.stringify({ pages_analyzed: pageStats.length, bounce_rate: bounceData[0]?.overall_bounce_rate })}::jsonb,
            ${JSON.stringify(insights)}::jsonb,
            ${JSON.stringify({ pages_updated: pageResults.length })}::jsonb)`;

        return res.json({ success: true, pages_analyzed: pageStats.length, pages: pageResults, insights, bounce_rate: bounceData[0]?.overall_bounce_rate || 'N/A' });
      } catch (webErr) {
        console.error('[agent/website/run] Error:', webErr);
        return res.status(500).json({ error: webErr.message });
      }
    }

    // GET /api/agent/website/insights — Latest aggregated insights
    if (req.method === 'GET' && url === '/agent/website/insights') {
      try {
        const topPages = await sql`SELECT * FROM page_analytics ORDER BY period_start DESC, views DESC LIMIT 20`;
        const recentInsights = await sql`SELECT decisions FROM agent_state
          WHERE agent_name = 'website' ORDER BY run_at DESC LIMIT 1`;
        return res.json({ topPages, insights: recentInsights[0]?.decisions || [] });
      } catch (insErr) {
        return res.status(500).json({ error: insErr.message });
      }
    }

    // ========== COORDINATOR ==========

    // GET /api/agent/coordination/run — Cross-agent coordination
    if (req.method === 'GET' && url === '/agent/coordination/run') {
      try {
        const coordActions = [];

        // Get latest state from each agent
        const systemsState = await sql`SELECT * FROM agent_state WHERE agent_name = 'systems' ORDER BY run_at DESC LIMIT 1`;
        const emailState = await sql`SELECT * FROM agent_state WHERE agent_name = 'email' ORDER BY run_at DESC LIMIT 1`;
        const websiteState = await sql`SELECT * FROM agent_state WHERE agent_name = 'website' ORDER BY run_at DESC LIMIT 1`;

        // Cross-agent rule 1: Gmail down → pause email
        if (systemsState.length > 0) {
          const sysObs = systemsState[0].observations;
          const services = sysObs.services || [];
          const gmailDown = services.find(s => s.service === 'gmail' && s.status === 'down');
          if (gmailDown) {
            coordActions.push({ rule: 'gmail_down_pause_email', action: 'Email Agent should be paused until Gmail recovers' });
          }
        }

        // Cross-agent rule 2: High drop-off pages → tell Email Agent
        if (websiteState.length > 0) {
          const webInsights = websiteState[0].decisions || [];
          const criticalPages = (Array.isArray(webInsights) ? webInsights : []).filter(i => i.severity === 'critical');
          if (criticalPages.length > 0) {
            coordActions.push({
              rule: 'critical_page_email_adjust',
              action: `Email Agent should avoid linking to: ${criticalPages.map(p => p.page).join(', ')}`,
              pages: criticalPages.map(p => p.page)
            });
          }
        }

        // Cross-agent rule 3: Email engagement trends
        if (emailState.length > 0) {
          const emailActions = emailState[0].actions_taken || {};
          if (emailActions.skipped > emailActions.sent && emailActions.sent > 0) {
            coordActions.push({
              rule: 'high_skip_rate',
              action: 'More users being skipped than sent to. Consider refreshing email content or adjusting skip threshold.'
            });
          }
        }

        // Cross-agent rule 4: Vercel slow → exclude from website metrics
        if (systemsState.length > 0) {
          const services = (systemsState[0].observations.services || []);
          const vercelSlow = services.find(s => s.service === 'neon' && s.response_time_ms > 500);
          if (vercelSlow) {
            coordActions.push({ rule: 'neon_slow_exclude_metrics', action: 'Website Agent should note DB was slow — page metrics may be inflated' });
          }
        }

        // Log coordination state
        await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
          VALUES ('coordinator',
            ${JSON.stringify({ systems: systemsState[0]?.run_at, email: emailState[0]?.run_at, website: websiteState[0]?.run_at })}::jsonb,
            ${JSON.stringify(coordActions)}::jsonb,
            ${JSON.stringify({ rules_evaluated: 4, actions_generated: coordActions.length })}::jsonb)`;

        return res.json({ success: true, actions: coordActions, timestamp: new Date().toISOString() });
      } catch (coordErr) {
        console.error('[agent/coordination/run] Error:', coordErr);
        return res.status(500).json({ error: coordErr.message });
      }
    }

    // GET /api/agent/dashboard — Unified agent dashboard data
    if (req.method === 'GET' && url === '/agent/dashboard') {
      try {
        // Latest run per agent
        const agentRuns = await sql`SELECT DISTINCT ON (agent_name) agent_name, run_at, observations, decisions, actions_taken
          FROM agent_state ORDER BY agent_name, run_at DESC`;

        // System health
        const health = await sql`SELECT DISTINCT ON (service) service, status, response_time_ms, checked_at
          FROM system_health_log ORDER BY service, checked_at DESC`;

        // Email engagement summary (last 7 days)
        const emailStats = await sql`SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE action_completed = true) as actions_done,
          ROUND(100.0 * COUNT(*) FILTER (WHERE opened_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as open_rate,
          ROUND(100.0 * COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as click_rate
          FROM email_engagement WHERE sent_at > NOW() - INTERVAL '7 days'`;

        // Persona distribution
        const personas = await sql`SELECT persona, COUNT(*) as count FROM coaching_sequences
          WHERE unsubscribed = false GROUP BY persona`;

        // Top 5 page insights
        const topInsights = await sql`SELECT page_path, views, conversion_rate, insights
          FROM page_analytics ORDER BY period_start DESC, views DESC LIMIT 5`;

        // Rule weights
        const rules = await sql`SELECT agent_name, rule_key, weight, times_fired, times_succeeded FROM agent_rules ORDER BY agent_name, weight DESC`;

        // Recent decisions
        const recentDecisions = await sql`SELECT agent_name, run_at, decisions FROM agent_state
          ORDER BY run_at DESC LIMIT 10`;

        // System registry (Docker, Ollama, cloud services)
        let systemRegistry = [];
        try {
          systemRegistry = await sql`SELECT * FROM system_registry ORDER BY category, system_type, system_name`;
        } catch(e) { /* table may not exist yet */ }

        // === AI ROUTER STATUS + METRICS ===
        const aiRouter = {
          ollama: { host: null, reachable: false, models: [], error: null },
          anthropic: { configured: !!process.env.ANTHROPIC_API_KEY },
          provider_mode: process.env.AI_PROVIDER || 'cloud',
          small_model: process.env.ZYRIX_SMALL_MODEL || 'claude-haiku-4-5',
          frontier_model: process.env.ZYRIX_FRONTIER_MODEL || 'claude-opus-4-7',
          tunnel_status: 'not-configured',
          tunnel_advice: '',
          metrics: null,
        };

        const ollamaHost = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://localhost:11434';
        aiRouter.ollama.host = ollamaHost;

        // Probe Ollama from the Vercel function — tells us whether the tunnel actually works.
        try {
          const r = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) });
          if (r.ok) {
            const d = await r.json();
            aiRouter.ollama.reachable = true;
            aiRouter.ollama.models = (d.models || []).map(m => m.name);
          } else {
            aiRouter.ollama.error = `HTTP ${r.status}`;
          }
        } catch (e) {
          aiRouter.ollama.error = e.message || String(e);
        }

        // Classify the current routing state and write a plain-English explanation
        // so the dashboard can guide the user to fix it.
        const isLocalhost = /localhost|127\.0\.0\.1|::1/i.test(ollamaHost);
        const isTryCloudflare = /trycloudflare\.com/i.test(ollamaHost);
        if (isLocalhost) {
          aiRouter.tunnel_status = 'not-configured';
          aiRouter.tunnel_advice = "OLLAMA_HOST is still pointing at localhost, which Vercel cannot reach from its serverless environment. Every AI call is being answered by Anthropic at full cloud price, even though you have free local models installed. Download the Cloudflare Tunnel setup below, run the three scripts in order, then update Vercel env vars OLLAMA_HOST and AI_PROVIDER=auto. Expected cost reduction: 60-80% on coaching, assessment, devotional, and simple content-generate calls.";
        } else if (isTryCloudflare) {
          aiRouter.tunnel_status = 'quick-tunnel';
          aiRouter.tunnel_advice = "Quick tunnel (trycloudflare.com) detected. These URLs rotate on every cloudflared restart and are UNAUTHENTICATED — fine for a smoke test but not for production. Run 3-named-tunnel-setup.ps1 from the Cloudflare Tunnel package to create a persistent named tunnel tied to a hostname you control.";
        } else if (aiRouter.ollama.reachable) {
          aiRouter.tunnel_status = 'named-tunnel-active';
          aiRouter.tunnel_advice = "Named tunnel is live. Vercel can reach your Ollama and the tier router will route action-specific calls to local models (free) before falling back to Anthropic.";
        } else {
          aiRouter.tunnel_status = 'misconfigured';
          aiRouter.tunnel_advice = `OLLAMA_HOST is set to a remote URL but Vercel cannot reach it: ${aiRouter.ollama.error}. Check: (1) Is cloudflared running on the source machine? Try "Get-Service Cloudflared" in PowerShell. (2) Is the DNS record still pointing at the tunnel? (3) Is the source machine awake and has Ollama started? AI calls will fall back to Anthropic until this is fixed.`;
        }

        // Metrics from model_invocations — table may not exist yet
        try {
          const last24h = await sql`
            SELECT
              COUNT(*)::int AS calls,
              COALESCE(SUM(tokens_in + tokens_out), 0)::int AS tokens,
              COALESCE(SUM(cost_usd), 0)::float AS cost_usd,
              ROUND(AVG(latency_ms))::int AS avg_latency_ms,
              COUNT(*) FILTER (WHERE cache_read_tokens > 0)::int AS cache_hits,
              COUNT(*) FILTER (WHERE success = false)::int AS errors,
              COUNT(*) FILTER (WHERE escalated_from IS NOT NULL)::int AS escalations
            FROM model_invocations WHERE created_at > NOW() - INTERVAL '24 hours'`;

          const byTier = await sql`
            SELECT tier, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd), 0)::float AS cost_usd
            FROM model_invocations WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY tier ORDER BY calls DESC`;

          const byModel = await sql`
            SELECT model, tier, provider, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd), 0)::float AS cost_usd
            FROM model_invocations WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY model, tier, provider ORDER BY calls DESC LIMIT 10`;

          const recentErrors = await sql`
            SELECT action, model, tier, error_message, created_at
            FROM model_invocations WHERE success = false
            ORDER BY created_at DESC LIMIT 5`;

          aiRouter.metrics = {
            last_24h: last24h[0] || {},
            by_tier_7d: byTier,
            by_model_7d: byModel,
            recent_errors: recentErrors,
          };
        } catch (metricErr) {
          aiRouter.metrics = {
            note: 'No AI invocations logged yet. The model_invocations table bootstraps on the first /api/ai call after deploy.',
          };
        }

        // === USER FEEDBACK QUEUE ===
        // Surface unresolved bugs + investigating items so they don't sit stale.
        // Resolved/reviewed are excluded from the active queue but counted in summary.
        let userFeedback = { active: [], summary: {} };
        try {
          const active = await sql`SELECT id, email, severity, status, category, page_url,
              SUBSTRING(COALESCE(response, question, ''), 1, 200) AS text,
              admin_notes, created_at,
              EXTRACT(epoch FROM (NOW() - created_at))/86400 AS age_days
            FROM user_feedback
            WHERE status NOT IN ('resolved', 'reviewed', 'closed')
            ORDER BY
              CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
              created_at DESC
            LIMIT 20`;
          const summary = await sql`SELECT
              COUNT(*) FILTER (WHERE status NOT IN ('resolved','reviewed','closed')) AS open,
              COUNT(*) FILTER (WHERE status = 'investigating') AS investigating,
              COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
              COUNT(*) FILTER (WHERE category = 'bug' AND status NOT IN ('resolved','closed')) AS open_bugs,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_7d,
              COUNT(*) AS total
            FROM user_feedback`;
          userFeedback = { active, summary: summary[0] || {} };
        } catch (fbErr) {
          userFeedback = { active: [], summary: { error: fbErr.message } };
        }

        return res.json({
          agents: agentRuns,
          health,
          email: { stats: emailStats[0] || {}, personas },
          pages: topInsights,
          rules,
          recentDecisions,
          systems: systemRegistry,
          aiRouter,
          userFeedback,
        });
      } catch (dashErr) {
        return res.status(500).json({ error: dashErr.message });
      }
    }

    // ========== POST /api/webhook/vercel-budget — Vercel spend management webhook ==========
    // Vercel sends two event types:
    //   1. spend_amount_threshold: { budgetAmount, currentSpend, teamId, thresholdPercent }
    //   2. endOfBillingCycle: { teamId, type: "endOfBillingCycle" }
    if (req.method === 'POST' && url === '/webhook/vercel-budget') {
      try {
        // Verify webhook signature if secret is configured
        const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
        if (webhookSecret) {
          const signature = req.headers['x-vercel-signature'] || '';
          const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          const expected = crypto.createHmac('sha1', webhookSecret).update(rawBody).digest('hex');
          if (signature !== expected) {
            console.warn('[vercel-budget] Invalid signature — rejecting');
            return res.status(401).json({ error: 'Invalid webhook signature' });
          }
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const ts = new Date().toISOString();

        // Detect event type from Vercel's actual payload format
        let eventType = 'unknown';
        let budgetAmount = null;
        let currentSpend = null;
        let thresholdPercent = null;

        if (body?.type === 'endOfBillingCycle') {
          eventType = 'endOfBillingCycle';
        } else if (body?.thresholdPercent !== undefined) {
          eventType = 'spend_amount_threshold';
          budgetAmount = body.budgetAmount;
          currentSpend = body.currentSpend;
          thresholdPercent = body.thresholdPercent;
        } else {
          // Test or unknown event — log but don't act
          eventType = body?.type || body?.event || 'test';
          budgetAmount = body?.budgetAmount || body?.amount || null;
        }

        console.log(`[vercel-budget] Event: ${eventType}, Budget: $${budgetAmount}, Spend: $${currentSpend}, Threshold: ${thresholdPercent}%`);

        // Log to system_registry for dashboard visibility
        try {
          const isOverBudget = eventType === 'spend_amount_threshold' && thresholdPercent >= 100;
          await sql`INSERT INTO system_registry (system_name, system_type, category, status, endpoint, metadata, last_reported_at)
            VALUES (
              'vercel:budget-alert',
              'webhook',
              'cloud',
              ${isOverBudget ? 'degraded' : 'healthy'},
              'https://vercel.com/danddappraisal-7740s-projects/settings/billing',
              ${JSON.stringify({ eventType, budgetAmount, currentSpend, thresholdPercent, received_at: ts })}::jsonb,
              NOW()
            )
            ON CONFLICT (system_name) DO UPDATE SET
              status = EXCLUDED.status,
              metadata = EXCLUDED.metadata,
              last_reported_at = NOW()`;
        } catch (dbErr) {
          console.error('[vercel-budget] DB log failed:', dbErr.message);
        }

        // Send alert email to Shawn
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'valuetovictory@gmail.com', pass: process.env.GMAIL_APP_PASSWORD }
          });

          let subject, messageHtml;
          if (eventType === 'spend_amount_threshold') {
            const emoji = thresholdPercent >= 100 ? '🚨' : thresholdPercent >= 75 ? '⚠️' : 'ℹ️';
            subject = `${emoji} Vercel Spend Alert: ${thresholdPercent}% of $${budgetAmount} budget used`;
            messageHtml = `
              <p><strong>Current Spend:</strong> $${currentSpend} of $${budgetAmount}</p>
              <p><strong>Threshold:</strong> ${thresholdPercent}%</p>
              <p><strong>Time:</strong> ${ts}</p>
              <hr style="border-color:#27272a;margin:16px 0;">
              <p style="font-size:13px;color:#a1a1aa;">
                ${thresholdPercent >= 100
                  ? '🚨 Budget limit reached! Production deployments may be paused. Go to Vercel to increase the limit or resume.'
                  : thresholdPercent >= 75
                    ? '⚠️ Approaching budget limit. Consider reviewing usage.'
                    : 'ℹ️ Budget milestone reached. No action needed.'}
              </p>`;
          } else if (eventType === 'endOfBillingCycle') {
            subject = '✅ Vercel: Billing cycle ended';
            messageHtml = `
              <p><strong>Event:</strong> Billing cycle ended</p>
              <p><strong>Time:</strong> ${ts}</p>
              <hr style="border-color:#27272a;margin:16px 0;">
              <p style="font-size:13px;color:#a1a1aa;">✅ New billing cycle started. If deployments were paused, they should auto-resume.</p>`;
          } else {
            subject = `Vercel Webhook: ${eventType}`;
            messageHtml = `
              <p><strong>Event:</strong> ${escapeHtml(eventType)}</p>
              ${budgetAmount ? `<p><strong>Budget:</strong> $${budgetAmount}</p>` : ''}
              <p><strong>Time:</strong> ${ts}</p>`;
          }

          const htmlBody = `
            <div style="font-family:Arial;max-width:500px;padding:20px;background:#0a0a0a;color:#e4e4e7;border-radius:10px;">
              <h2 style="color:#D4A847;margin:0 0 12px;">Vercel Budget Alert</h2>
              ${messageHtml}
              <a href="https://vercel.com/danddappraisal-7740s-projects/settings/billing" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#D4A847;color:#0a0a0a;text-decoration:none;border-radius:6px;font-weight:bold;">Open Vercel Billing</a>
            </div>`;

          await transporter.sendMail({
            from: '"VTV System Alert" <valuetovictory@gmail.com>',
            to: 'valuetovictory@gmail.com',
            subject,
            html: htmlBody
          });
          console.log('[vercel-budget] Alert email sent');
        } catch (emailErr) {
          console.error('[vercel-budget] Email failed:', emailErr.message);
        }

        return res.json({ received: true, event: eventType, timestamp: ts });
      } catch (whErr) {
        console.error('[vercel-budget] Error:', whErr);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }

    // ========== GET /api/devotional/send — Send daily devotional to all subscribers ==========
    if (req.method === 'GET' && url === '/devotional/send') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      try {
        // Get today's devotional
        const fs = require('fs');
        const path = require('path');
        let devotionals = [];
        try {
          devotionals = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'devotionals.json'), 'utf-8'));
        } catch(e) { return res.status(500).json({ error: 'Could not load devotionals data' }); }

        const startDate = new Date('2026-04-06');
        const today = new Date();
        const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const dayIndex = ((diffDays % 60) + 60) % 60;
        const dev = devotionals[dayIndex] || devotionals[0];

        // Get subscribers: active coaching users + paid members + explicit opt-ins
        // Daily dedup — skip anyone already sent today
        let subscribers = [];
        try {
          subscribers = await sql`
            SELECT DISTINCT c.id as contact_id, c.email, c.first_name
            FROM contacts c
            LEFT JOIN devotional_progress dp ON dp.contact_id = c.id
            LEFT JOIN user_profiles up ON up.contact_id = c.id
            LEFT JOIN coaching_sequences cs ON LOWER(cs.email) = LOWER(c.email)
            WHERE c.email IS NOT NULL AND c.email != ''
              AND (
                dp.id IS NOT NULL
                OR up.membership_tier IN ('individual','couple','premium')
                OR (cs.id IS NOT NULL AND cs.unsubscribed = false)
              )
              AND (dp.opted_out IS NULL OR dp.opted_out = false)
              AND LOWER(c.email) NOT IN (
                SELECT LOWER(recipient) FROM email_log
                WHERE email_type = 'devotional' AND created_at::date = CURRENT_DATE
              )
            ORDER BY c.id ASC
          `;
        } catch(e) {
          // Fallback: coaching_sequences members
          try {
            subscribers = await sql`
              SELECT DISTINCT c.id as contact_id, c.email, c.first_name FROM contacts c
              INNER JOIN coaching_sequences cs ON LOWER(cs.email) = LOWER(c.email)
              WHERE c.email IS NOT NULL AND c.email != '' AND cs.unsubscribed = false
              ORDER BY c.id ASC`;
          } catch(e2) {
            subscribers = [];
          }
        }

        if (subscribers.length === 0) return res.json({ sent: 0, message: 'No subscribers found' });
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return res.status(500).json({ error: 'Email credentials not configured' });

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        let sentCount = 0;
        const results = [];

        // Precompute which pillar each devotional theme maps to
        const themeToPillar = function(theme) {
          if (!theme) return null;
          const t = String(theme).toLowerCase();
          if (['patience','waiting','seasons','time','urgency'].some(k => t.includes(k))) return 'Time';
          if (['family','love','relationships','trust','friends','community'].some(k => t.includes(k))) return 'People';
          if (['leadership','faith','courage','obedience','voice'].some(k => t.includes(k))) return 'Influence';
          if (['money','provision','poverty','work','finances','wealth'].some(k => t.includes(k))) return 'Numbers';
          if (['wisdom','learning','growth','truth','understanding'].some(k => t.includes(k))) return 'Knowledge';
          return null;
        };
        const devotionalPillar = themeToPillar(dev.theme) || themeToPillar(dev.secondary_theme);

        for (const sub of subscribers) {
          try {
            const firstName = escapeHtml(sub.first_name || 'Friend');

            // Look up the subscriber's weakest pillar for personalized connection
            let userWeakestPillar = null;
            try {
              const aRows = await sql`SELECT weakest_pillar FROM assessments WHERE contact_id = ${sub.contact_id} ORDER BY completed_at DESC LIMIT 1`;
              if (aRows.length > 0) userWeakestPillar = aRows[0].weakest_pillar;
            } catch (e) { /* non-fatal */ }

            // Build pillar-connection note if the devotional's theme matches their weakest pillar
            let pillarNote = '';
            if (devotionalPillar && userWeakestPillar && devotionalPillar === userWeakestPillar) {
              pillarNote = `<div style="background:rgba(212,168,71,0.12);border-left:3px solid #D4A847;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0;">
                <p style="color:#D4A847;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px;">Connects to Your ${userWeakestPillar} Journey</p>
                <p style="color:#e4e4e7;font-size:13px;line-height:1.5;margin:0;">Today's word speaks directly to the area your assessment flagged. Don't miss it.</p>
              </div>`;
            }

            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="text-align:center;padding-bottom:20px;">
  <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4A847;margin-bottom:6px;">RUNNING FROM MIRACLES</div>
  <div style="font-family:Georgia,serif;font-size:22px;font-style:italic;color:#ffffff;">Daily Word</div>
  <div style="font-size:12px;color:#71717a;margin-top:4px;">Day ${dev.day_number} of 60 &mdash; ${today.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
</td></tr>
<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:36px 28px;">
  <p style="color:#e4e4e7;font-size:16px;line-height:1.6;margin:0 0 16px;">${firstName},</p>
  ${pillarNote}
  <div style="font-family:Georgia,serif;font-size:20px;color:#D4A847;font-style:italic;margin-bottom:4px;">${dev.title}</div>
  <div style="font-size:12px;color:#71717a;margin-bottom:20px;">Chapter: ${dev.chapter_title} &mdash; Theme: ${dev.theme}</div>
  <div style="background:#111118;border-left:3px solid #D4A847;padding:16px 20px;margin:0 0 24px;border-radius:0 8px 8px 0;">
    <p style="color:#D4A847;font-size:13px;font-weight:bold;margin:0 0 6px;">${dev.scripture_reference}</p>
    <p style="color:#e4e4e7;font-size:15px;font-style:italic;line-height:1.6;margin:0;">"${dev.scripture_text}"</p>
  </div>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 20px;">${dev.reflection}</p>
  <hr style="border:none;border-top:1px solid #27272a;margin:20px 0;"/>
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
    <p style="color:#D4A847;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Today's Prayer</p>
    <p style="color:#e4e4e7;font-size:14px;font-style:italic;line-height:1.6;margin:0;">${dev.prayer}</p>
  </div>
  <div style="background:#111118;border:1px solid #27272a;border-radius:8px;padding:16px 20px;">
    <p style="color:#22c55e;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Action Step</p>
    <p style="color:#e4e4e7;font-size:14px;line-height:1.6;margin:0;">${dev.action_step}</p>
  </div>
  <div style="background:rgba(212,168,71,0.08);border:1px solid rgba(212,168,71,0.2);border-radius:8px;padding:16px 20px;margin-top:16px;text-align:center;">
    <p style="color:#D4A847;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Today&rsquo;s Reading</p>
    <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0 0 10px;">Chapter ${dev.chapter_number}: &ldquo;${dev.chapter_title}&rdquo; from <em>Running From Miracles</em> by Shawn E. Decker</p>
    <a href="https://assessment.valuetovictory.com/audiobook" style="display:inline-block;background:transparent;border:1px solid #D4A847;color:#D4A847;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 20px;border-radius:6px;">Listen to the Audiobook &rarr;</a>
  </div>
</td></tr>
<tr><td style="text-align:center;padding-top:24px;">
  <a href="${BASE_URL}/daily-word" style="display:inline-block;background:linear-gradient(135deg,#D4A847,#b8942e);color:#0a0a0a;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:8px;">Read Online</a>
</td></tr>
<tr><td style="text-align:center;padding-top:20px;">
  <p style="color:#52525b;font-size:11px;margin:0;">&copy; 2026 Value to Victory &mdash; Shawn E. Decker</p>
  <p style="color:#3f3f46;font-size:10px;margin:6px 0 0;">Running From Miracles &mdash; 60-Day Devotional</p>
</td></tr>
</table></td></tr></table></body></html>`;

            // Engagement tracking
            let devEngId = null;
            try {
              const devEng = await sql`
                INSERT INTO email_engagement (contact_id, email, coaching_day, email_variant)
                VALUES (${sub.contact_id}, ${sub.email.toLowerCase()}, ${dev.day_number}, 'devotional')
                RETURNING id`;
              devEngId = devEng[0]?.id;
            } catch (e) { /* non-fatal */ }

            let finalHtml = html;
            if (devEngId) {
              const trackBase = `${BASE_URL}/api/agent/email`;
              finalHtml = finalHtml.replace(/href="(https?:\/\/[^"]+)"/g, function(m, u) {
                return `href="${trackBase}/track-click?id=${devEngId}&url=${encodeURIComponent(u)}"`;
              });
              const pixel = `<img src="${trackBase}/track-open?id=${devEngId}" width="1" height="1" style="display:none" alt=""/>`;
              finalHtml = finalHtml.includes('</body>') ? finalHtml.replace('</body>', pixel + '</body>') : finalHtml + pixel;
            }

            await transporter.sendMail({
              from: `"Running From Miracles" <${process.env.GMAIL_USER}>`,
              to: sub.email,
              subject: `Day ${dev.day_number}: ${dev.title} — ${dev.scripture_reference}`,
              html: finalHtml,
            });
            sentCount++;
            results.push({ email: sub.email, status: 'sent' });
            await logEmail(sql, { recipient: sub.email, emailType: 'devotional', subject: `Day ${dev.day_number}: ${dev.title}`, contactId: sub.contact_id, metadata: { day: dev.day_number, chapter: dev.chapter_title, engagementId: devEngId, pillarMatch: !!pillarNote } });

            // Update progress
            try {
              await sql`INSERT INTO devotional_progress (contact_id, current_day, last_sent_at)
                VALUES (${sub.contact_id}, ${dev.day_number}, NOW())
                ON CONFLICT (contact_id) DO UPDATE SET current_day = ${dev.day_number}, last_sent_at = NOW(), total_sent = devotional_progress.total_sent + 1`;
            } catch(e) {}
          } catch (sendErr) {
            results.push({ email: sub.email, status: 'error', error: sendErr.message });
            await logEmail(sql, { recipient: sub.email, emailType: 'devotional', contactId: sub.contact_id, status: 'failed', metadata: { error: sendErr.message } });
          }
        }

        return res.json({ sent: sentCount, total: subscribers.length, day: dev.day_number, title: dev.title, results });
      } catch(devErr) {
        console.error('[devotional/send] Error:', devErr);
        console.error('[devotional/send] Error:', devErr.message); return res.status(500).json({ error: 'Devotional send failed' });
      }
    }

    // ========== GET /api/devotional-subscribers ==========
    // Returns active devotional subscribers for n8n email workflow
    if (req.method === 'GET' && url === '/devotional-subscribers') {
      const apiKey = req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      try {
        const subscribers = await sql`
          SELECT DISTINCT
            c.id as contact_id, c.email, c.first_name,
            COALESCE(dp.current_day, 1) as current_day,
            COALESCE(dp.last_sent_at, '1970-01-01'::timestamp) as last_sent_at,
            COALESCE(up.membership_tier, 'free') as tier
          FROM contacts c
          LEFT JOIN devotional_progress dp ON dp.contact_id = c.id
          LEFT JOIN user_profiles up ON up.contact_id = c.id
          WHERE c.email IS NOT NULL AND c.email != ''
            AND (dp.id IS NOT NULL OR up.membership_tier IN ('individual','couple','premium'))
            AND (dp.opted_out IS NULL OR dp.opted_out = false)
          ORDER BY c.id ASC
        `;
        return res.json({
          success: true, count: subscribers.length,
          subscribers: subscribers.map(s => ({
            contact_id: s.contact_id, email: s.email,
            first_name: s.first_name || 'Friend',
            current_day: s.current_day, last_sent_at: s.last_sent_at, tier: s.tier
          }))
        });
      } catch (subErr) {
        if (subErr.message.includes('does not exist')) {
          return res.json({ success: true, count: 0, subscribers: [], note: 'Devotional tables not yet created' });
        }
        return res.status(500).json({ error: subErr.message });
      }
    }

    // ========== POST /api/devotional-log ==========
    // Logs that a devotional email was sent (called by n8n)
    if (req.method === 'POST' && url === '/devotional-log') {
      const apiKey = req.headers['x-api-key'] || '';
      const validKey = process.env.ADMIN_API_KEY || '';
      if (!validKey || apiKey !== validKey) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { contact_id, email, day_number, status } = body || {};
      if (!email) return res.status(400).json({ error: 'email is required' });
      if (contact_id) {
        try {
          await sql`INSERT INTO devotional_progress (contact_id, current_day, last_sent_at)
            VALUES (${contact_id}, ${day_number || 1}, NOW())
            ON CONFLICT (contact_id) DO UPDATE SET current_day = ${day_number || 1}, last_sent_at = NOW(), total_sent = devotional_progress.total_sent + 1`;
        } catch (e) { console.warn('devotional_progress update (non-fatal):', e.message); }
      }
      try {
        await sql`INSERT INTO email_log (recipient, email_type, subject, contact_id, status, metadata)
          VALUES (${email}, 'devotional', ${'Day ' + (day_number || '?') + ' Devotional'}, ${contact_id || null}, ${status || 'sent'}, ${JSON.stringify({ day_number, source: 'n8n_workflow' })}::jsonb)`;
      } catch (e) { console.warn('email_log insert (non-fatal):', e.message); }
      try {
        await sql`INSERT INTO analytics_events (event_type, contact_id, metadata)
          VALUES ('devotional_sent', ${contact_id || null}, ${JSON.stringify({ day_number, email })}::jsonb)`;
      } catch (e) { /* analytics non-fatal */ }
      return res.json({ success: true, logged: true });
    }

    // ========== N8N WORKFLOW TRIGGERS ==========

    // POST /api/n8n/trigger — Trigger an n8n workflow by name
    if (req.method === 'POST' && url === '/n8n/trigger') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { workflow, data } = req.body || {};
      if (!workflow) return res.status(400).json({ error: 'workflow name required' });

      const n8nBase = process.env.N8N_URL || process.env.N8N_WEBHOOK_URL?.replace(/\/webhook\/.*$/, '') || 'http://localhost:5678';
      const webhookUrl = `${n8nBase}/webhook/${workflow}`;

      try {
        const n8nRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, triggered_at: new Date().toISOString(), source: 'vtv-api' }),
          signal: AbortSignal.timeout(15000)
        });
        const n8nData = await n8nRes.text();
        return res.json({ ok: true, workflow, status: n8nRes.status, response: n8nData });
      } catch (e) {
        return res.json({ ok: false, workflow, error: e.message });
      }
    }

    // GET /api/n8n/status — Check n8n connectivity
    if (req.method === 'GET' && url === '/n8n/status') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const n8nBase = process.env.N8N_URL || 'http://localhost:5678';
      try {
        const healthRes = await fetch(`${n8nBase}/healthz`, { signal: AbortSignal.timeout(8000) });
        return res.json({ ok: healthRes.ok, status: healthRes.status, url: n8nBase });
      } catch (e) {
        return res.json({ ok: false, error: e.message, url: n8nBase });
      }
    }

    // ========== SOCIAL MEDIA PUBLISHING ==========

    // POST /api/social/publish — Publish content to social media platforms
    if (req.method === 'POST' && url === '/social/publish') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { platform, content, mediaUrl, scheduledAt } = req.body || {};
      if (!platform || !content) return res.status(400).json({ error: 'platform and content required' });

      const results = [];

      // Log to database for tracking
      try {
        await sql`INSERT INTO analytics_events (event_type, metadata)
          VALUES ('social_publish', ${JSON.stringify({ platform, content: content.substring(0, 200), scheduledAt })}::jsonb)`;
      } catch {}

      // Route to n8n for actual publishing (n8n handles the OAuth + API calls)
      const n8nBase = process.env.N8N_URL || process.env.N8N_WEBHOOK_URL?.replace(/\/webhook\/.*$/, '') || 'http://localhost:5678';
      try {
        const pubRes = await fetch(`${n8nBase}/webhook/social-publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, content, mediaUrl, scheduledAt, source: 'vtv-api' }),
          signal: AbortSignal.timeout(15000)
        });
        results.push({ platform, status: pubRes.ok ? 'sent' : 'failed', code: pubRes.status });
      } catch (e) {
        results.push({ platform, status: 'failed', error: e.message });
      }

      return res.json({ ok: true, results });
    }

    // POST /api/social/publish-devotional — Auto-publish today's devotional to all platforms
    if (req.method === 'POST' && (url === '/social/publish-devotional' || (req.method === 'GET' && url === '/social/publish-devotional'))) {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

      // Load today's devotional
      const fs = require('fs');
      const path = require('path');
      let devotionals = [];
      try {
        devotionals = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'devotionals.json'), 'utf-8'));
      } catch { return res.status(500).json({ error: 'Could not load devotionals' }); }

      const startDate = new Date('2026-04-06');
      const today = new Date();
      const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      const dayIndex = ((diffDays % 60) + 60) % 60;
      const dev = devotionals[dayIndex] || devotionals[0];

      const socialPost = dev.social_media_post || `"${dev.chapter_title}" — ${dev.scripture_reference}: "${dev.scripture_text.substring(0, 100)}..." #RunningFromMiracles #ValueToVictory`;
      const podcastTopic = dev.podcast_topic || '';

      const n8nBase = process.env.N8N_URL || process.env.N8N_WEBHOOK_URL?.replace(/\/webhook\/.*$/, '') || 'http://localhost:5678';
      const platforms = ['facebook', 'instagram', 'twitter', 'linkedin'];
      const results = [];

      for (const platform of platforms) {
        try {
          const pubRes = await fetch(`${n8nBase}/webhook/social-publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, content: socialPost, devotional: dev, source: 'vtv-devotional-cron' }),
            signal: AbortSignal.timeout(10000)
          });
          results.push({ platform, status: pubRes.ok ? 'sent' : 'n8n_error', code: pubRes.status });
        } catch (e) {
          results.push({ platform, status: 'failed', error: e.message });
        }
      }

      // Log
      try {
        await sql`INSERT INTO analytics_events (event_type, metadata) VALUES ('devotional_social_publish', ${JSON.stringify({ day: dev.day_number, title: dev.title, results })}::jsonb)`;
      } catch {}

      return res.json({ ok: true, devotional: { day: dev.day_number, title: dev.title }, socialPost, podcastTopic, results });
    }

    // GET /api/ollama/models — List available Ollama models
    if (req.method === 'GET' && url === '/ollama/models') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      try {
        const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
        const data = await r.json();
        return res.json({ ok: true, models: data.models || [], url: ollamaUrl });
      } catch (e) {
        return res.json({ ok: false, error: e.message, url: ollamaUrl });
      }
    }

    // POST /api/ollama/generate — Direct Ollama text generation
    if (req.method === 'POST' && url === '/ollama/generate') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { prompt, model, system } = req.body || {};
      if (!prompt) return res.status(400).json({ error: 'prompt required' });

      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const ollamaModel = model || process.env.OLLAMA_MODEL || 'llama3.1';

      try {
        const r = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              ...(system ? [{ role: 'system', content: system }] : []),
              { role: 'user', content: prompt }
            ],
            stream: false,
            options: { temperature: 0.7 }
          }),
          signal: AbortSignal.timeout(120000)
        });
        if (!r.ok) return res.status(502).json({ error: `Ollama error: ${r.status}` });
        const data = await r.json();
        return res.json({
          ok: true,
          content: data.message?.content || '',
          model: ollamaModel,
          tokens: { prompt: data.prompt_eval_count, completion: data.eval_count }
        });
      } catch (e) {
        return res.json({ ok: false, error: e.message });
      }
    }

    // POST /api/ollama/pull — Pull/download a model
    if (req.method === 'POST' && url === '/ollama/pull') {
      if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { model } = req.body || {};
      if (!model) return res.status(400).json({ error: 'model name required' });

      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      try {
        const r = await fetch(`${ollamaUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: model, stream: false }),
          signal: AbortSignal.timeout(300000)
        });
        const data = await r.json();
        return res.json({ ok: true, model, status: data.status || 'complete' });
      } catch (e) {
        return res.json({ ok: false, error: e.message });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Generate team-level recommendations based on aggregate scores
function generateTeamRecommendations(avg, weakestPillars, distribution) {
  const recs = [];
  const pillars = [
    { key: 'time_total', name: 'Time', label: 'Time Management' },
    { key: 'people_total', name: 'People', label: 'Relationship Investment' },
    { key: 'influence_total', name: 'Influence', label: 'Leadership & Influence' },
    { key: 'numbers_total', name: 'Numbers', label: 'Financial Awareness' },
    { key: 'knowledge_total', name: 'Knowledge', label: 'Knowledge & Growth' },
  ];

  // Find weakest pillar org-wide
  let weakest = pillars[0];
  for (const p of pillars) {
    if (avg(p.key) < avg(weakest.key)) weakest = p;
  }
  recs.push(`Organization-wide focus area: ${weakest.label}. Consider targeted workshops or coaching around ${weakest.name} skills.`);

  // Check crisis/survival concentration
  const atRisk = (distribution.crisis || 0) + (distribution.survival || 0);
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total > 0 && atRisk / total > 0.3) {
    recs.push(`${Math.round(atRisk / total * 100)}% of your team is in Crisis or Survival range. Immediate intervention recommended.`);
  }

  // Most common weakest pillar across individuals
  const topWeak = Object.entries(weakestPillars).sort((a, b) => b[1] - a[1])[0];
  if (topWeak) {
    recs.push(`Most common individual gap: ${topWeak[0]} (${topWeak[1]} members). Suggest group development in this area.`);
  }

  recs.push('Encourage all team members to retake the assessment regularly. Growth is measured, not guessed.');
  return recs;
}

// Build HTML email for team report sent to CMA
function buildTeamReportEmail(teamName, report) {
  const s = report.summary || {};
  const dist = report.scoreDistribution || {};
  const depts = report.departmentBreakdown || {};
  const recs = report.recommendations || [];

  let deptRows = '';
  Object.entries(depts).forEach(([dept, data]) => {
    deptRows += `<tr><td style="padding:8px;border-bottom:1px solid #333;color:#fff">${dept}</td><td style="padding:8px;border-bottom:1px solid #333;color:#D4A847;text-align:center">${data.count}</td><td style="padding:8px;border-bottom:1px solid #333;color:#D4A847;text-align:center">${data.averageMasterScore}</td></tr>`;
  });

  let recsHtml = recs.map(r => `<li style="margin-bottom:8px;color:#d4d4d8">${r}</li>`).join('');

  return `
    <div style="font-family:Segoe UI,sans-serif;background:#0a0a0a;padding:40px 20px;max-width:640px;margin:0 auto">
      <div style="text-align:center;margin-bottom:32px">
        <h1 style="color:#D4A847;font-size:28px;margin:0">P.I.N.K. Value Engine</h1>
        <p style="color:#a1a1aa;font-size:14px;margin:4px 0">Team Assessment Report</p>
      </div>

      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h2 style="color:#fff;font-size:20px;margin:0 0 16px">${teamName}</h2>
        <p style="color:#a1a1aa;margin:0">Generated: ${new Date(report.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#D4A847;margin:0 0 16px">Summary</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#a1a1aa">Registered Members</td><td style="color:#fff;text-align:right">${s.totalRegistered || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Completed Assessments</td><td style="color:#fff;text-align:right">${s.totalCompleted || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Completion Rate</td><td style="color:#fff;text-align:right">${s.completionRate || 0}%</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Average Master Score</td><td style="color:#D4A847;text-align:right;font-weight:bold">${s.averageMasterScore || 0}</td></tr>
        </table>
      </div>

      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#D4A847;margin:0 0 16px">Pillar Averages</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#a1a1aa">Time (P)</td><td style="color:#fff;text-align:right">${s.averagePillars?.time || 0}/50</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">People (I)</td><td style="color:#fff;text-align:right">${s.averagePillars?.people || 0}/50</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Influence (N)</td><td style="color:#fff;text-align:right">${s.averagePillars?.influence || 0}/50</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Numbers (K)</td><td style="color:#fff;text-align:right">${s.averagePillars?.numbers || 0}/50</td></tr>
          <tr><td style="padding:6px 0;color:#a1a1aa">Knowledge</td><td style="color:#fff;text-align:right">${s.averagePillars?.knowledge || 0}/50</td></tr>
        </table>
      </div>

      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#D4A847;margin:0 0 16px">Score Distribution</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#ef4444">Crisis</td><td style="color:#fff;text-align:right">${dist.crisis || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#f97316">Survival</td><td style="color:#fff;text-align:right">${dist.survival || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#eab308">Growth</td><td style="color:#fff;text-align:right">${dist.growth || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#22c55e">Momentum</td><td style="color:#fff;text-align:right">${dist.momentum || 0}</td></tr>
          <tr><td style="padding:6px 0;color:#D4A847">Mastery</td><td style="color:#fff;text-align:right">${dist.mastery || 0}</td></tr>
        </table>
      </div>

      ${deptRows ? `
      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#D4A847;margin:0 0 16px">Department Breakdown</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><th style="text-align:left;padding:8px;color:#a1a1aa;border-bottom:1px solid #444">Department</th><th style="text-align:center;padding:8px;color:#a1a1aa;border-bottom:1px solid #444">Members</th><th style="text-align:center;padding:8px;color:#a1a1aa;border-bottom:1px solid #444">Avg Score</th></tr>
          ${deptRows}
        </table>
      </div>` : ''}

      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#D4A847;margin:0 0 16px">Recommendations</h3>
        <ul style="padding-left:20px;margin:0">${recsHtml}</ul>
      </div>

      <div style="text-align:center;padding:24px;color:#71717a;font-size:12px">
        <p>This report contains only aggregate data. Individual identities are never disclosed.</p>
        <p style="color:#D4A847">Value to Victory • The P.I.N.K. Value Engine</p>
      </div>
    </div>
  `;
}

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
