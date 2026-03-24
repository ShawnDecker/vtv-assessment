// Vercel serverless function - handles all /api/* routes
// Uses in-memory storage (resets on cold start, but good for testing)

const assessments = [];
const contacts = [];
const teams = [];
const peerRatings = [];
let nextId = 1;

function getScoreRange(score) {
  if (score <= 50) return "Crisis";
  if (score <= 100) return "Survival";
  if (score <= 150) return "Growth";
  if (score <= 200) return "Momentum";
  return "Mastery";
}

function generatePrescription(a) {
  const pillars = [
    { name: "Time", score: a.timeTotal },
    { name: "People", score: a.peopleTotal },
    { name: "Influence", score: a.influenceTotal },
    { name: "Numbers", score: a.numbersTotal },
    { name: "Knowledge", score: a.knowledgeTotal },
  ];
  const sorted = [...pillars].sort((x, y) => x.score - y.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const prescriptions = {
    Time: { diagnosis: "Your Time pillar is your biggest constraint. You're likely losing 5+ hours per week to low-value activities.", immediate: "Run the Time Audit. Track every hour for 3 days. Find your Five-Hour Leak.", tool: "Time Reallocation Planner — Sort activities by Covey Quadrant.", thirtyDay: "Eliminate 3 Q3/Q4 activities. Protect peak hours. Calculate Value Per Hour." },
    People: { diagnosis: "Your People pillar needs work. You may be over-investing in Takers or under-investing in Exchangers.", immediate: "Run the People Audit. Map your top 15-20 relationships against the four types.", tool: "Relationship Matrix — Classify your network by alliance type.", thirtyDay: "Use the Value Replacement Map to redirect relational energy." },
    Influence: { diagnosis: "Your Influence pillar needs work. There may be a gap between stated and lived values.", immediate: "Run the Influence Ladder. Identify which of Maxwell's five levels you operate at.", tool: "Gravitational Center Alignment — Audit calendar and bank statement against core values.", thirtyDay: "Score the gap between stated and lived values. One alignment action per week." },
    Numbers: { diagnosis: "Your Numbers pillar is weakest. You may not be tracking what matters.", immediate: "Run the Financial Snapshot. Document income, expenses, surplus/deficit.", tool: "Value Per Hour Calculator — Calculate actual vs potential hourly worth.", thirtyDay: "Use the Income Multiplier Model to map compound improvements over 90 days." },
    Knowledge: { diagnosis: "Your Knowledge pillar is the biggest gap. You may be consuming without applying.", immediate: "Run the Knowledge ROI Calculator. Calculate hours invested vs return.", tool: "Map knowledge gaps against the 1,800-hour framework.", thirtyDay: "Commit to one high-ROI learning track. Apply the Rule of Double Jeopardy." },
  };
  return { weakestPillar: weakest.name, weakestScore: weakest.score, strongestPillar: strongest.name, strongestScore: strongest.score, ...prescriptions[weakest.name], pillars };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.replace(/^\/api/, '');

  // POST /api/assessment
  if (req.method === 'POST' && url === '/assessment') {
    const body = req.body || {};
    const fields = ['timeAwareness','timeAllocation','timeProtection','timeLeverage','fiveHourLeak','valuePerHour','timeInvestment','downtimeQuality','foresight','timeReallocation','trustInvestment','boundaryQuality','networkDepth','relationalRoi','peopleAudit','allianceBuilding','loveBankDeposits','communicationClarity','restraintPractice','valueReplacement','leadershipLevel','integrityAlignment','professionalCredibility','empatheticListening','gravitationalCenter','microHonesties','wordManagement','personalResponsibility','adaptiveInfluence','influenceMultiplier','financialAwareness','goalSpecificity','investmentLogic','measurementHabit','costVsValue','numberOneClarity','smallImprovements','negativeMath','incomeMultiplier','negotiationSkill','learningHours','applicationRate','biasAwareness','highestBestUse','supplyAndDemand','substitutionRisk','doubleJeopardy','knowledgeCompounding','weightedAnalysis','perceptionVsPerspective'];
    
    const timeTotal = (body.timeAwareness||0)+(body.timeAllocation||0)+(body.timeProtection||0)+(body.timeLeverage||0)+(body.fiveHourLeak||0)+(body.valuePerHour||0)+(body.timeInvestment||0)+(body.downtimeQuality||0)+(body.foresight||0)+(body.timeReallocation||0);
    const peopleTotal = (body.trustInvestment||0)+(body.boundaryQuality||0)+(body.networkDepth||0)+(body.relationalRoi||0)+(body.peopleAudit||0)+(body.allianceBuilding||0)+(body.loveBankDeposits||0)+(body.communicationClarity||0)+(body.restraintPractice||0)+(body.valueReplacement||0);
    const influenceTotal = (body.leadershipLevel||0)+(body.integrityAlignment||0)+(body.professionalCredibility||0)+(body.empatheticListening||0)+(body.gravitationalCenter||0)+(body.microHonesties||0)+(body.wordManagement||0)+(body.personalResponsibility||0)+(body.adaptiveInfluence||0)+(body.influenceMultiplier||0);
    const numbersTotal = (body.financialAwareness||0)+(body.goalSpecificity||0)+(body.investmentLogic||0)+(body.measurementHabit||0)+(body.costVsValue||0)+(body.numberOneClarity||0)+(body.smallImprovements||0)+(body.negativeMath||0)+(body.incomeMultiplier||0)+(body.negotiationSkill||0);
    const knowledgeTotal = (body.learningHours||0)+(body.applicationRate||0)+(body.biasAwareness||0)+(body.highestBestUse||0)+(body.supplyAndDemand||0)+(body.substitutionRisk||0)+(body.doubleJeopardy||0)+(body.knowledgeCompounding||0)+(body.weightedAnalysis||0)+(body.perceptionVsPerspective||0);
    
    const rawScore = timeTotal + peopleTotal + influenceTotal + numbersTotal + knowledgeTotal;
    const timeMultiplier = Math.max(0.1, Math.min(2.0, body.timeMultiplier || 1.0));
    const masterScore = Math.round(rawScore * timeMultiplier * 10) / 10;
    
    const contact = { id: nextId++, firstName: body.firstName || '', lastName: body.lastName || '', email: body.email || '', phone: body.phone || '', createdAt: new Date().toISOString() };
    contacts.push(contact);
    
    const assessmentData = { ...body, id: nextId++, contactId: contact.id, completedAt: new Date().toISOString(), timeTotal, peopleTotal, influenceTotal, numbersTotal, knowledgeTotal, rawScore, masterScore, timeMultiplier, scoreRange: getScoreRange(masterScore), mode: body.mode || 'individual' };
    
    const prescription = generatePrescription(assessmentData);
    assessmentData.weakestPillar = prescription.weakestPillar;
    assessmentData.prescription = JSON.stringify(prescription);
    assessments.push(assessmentData);
    
    return res.json({ assessment: assessmentData, prescription, contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } });
  }

  // POST /api/teams
  if (req.method === 'POST' && url === '/teams') {
    const body = req.body || {};
    const code = Math.random().toString(36).substring(2, 10);
    const team = { id: nextId++, name: body.name, mode: body.mode, createdBy: body.contactId, inviteCode: code, createdAt: new Date().toISOString() };
    teams.push(team);
    return res.json(team);
  }

  // GET /api/teams/invite/:code
  if (req.method === 'GET' && url.startsWith('/teams/invite/')) {
    const code = url.split('/teams/invite/')[1];
    const team = teams.find(t => t.inviteCode === code);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const creator = contacts.find(c => c.id === team.createdBy);
    return res.json({ ...team, creatorName: creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown' });
  }

  // GET /api/admin/contacts
  if (req.method === 'GET' && url === '/admin/contacts') {
    const enriched = contacts.map(c => {
      const ca = assessments.filter(a => a.contactId === c.id);
      return { ...c, latestAssessment: ca[0] || null, assessmentCount: ca.length };
    });
    return res.json(enriched);
  }

  // GET /api/admin/contacts/:id
  if (req.method === 'GET' && url.match(/^\/admin\/contacts\/\d+$/)) {
    const id = parseInt(url.split('/').pop());
    const contact = contacts.find(c => c.id === id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    const ca = assessments.filter(a => a.contactId === id);
    return res.json({ contact, assessments: ca });
  }

  // GET /api/admin/analytics
  if (req.method === 'GET' && url === '/admin/analytics') {
    const dist = {};
    assessments.forEach(a => { dist[a.scoreRange] = (dist[a.scoreRange] || 0) + 1; });
    const distribution = Object.entries(dist).map(([range, count]) => ({ range, count }));
    const n = assessments.length || 1;
    const averages = [
      { pillar: 'Time', avg: Math.round(assessments.reduce((s,a) => s + a.timeTotal, 0) / n * 10) / 10 },
      { pillar: 'People', avg: Math.round(assessments.reduce((s,a) => s + a.peopleTotal, 0) / n * 10) / 10 },
      { pillar: 'Influence', avg: Math.round(assessments.reduce((s,a) => s + a.influenceTotal, 0) / n * 10) / 10 },
      { pillar: 'Numbers', avg: Math.round(assessments.reduce((s,a) => s + a.numbersTotal, 0) / n * 10) / 10 },
      { pillar: 'Knowledge', avg: Math.round(assessments.reduce((s,a) => s + a.knowledgeTotal, 0) / n * 10) / 10 },
    ];
    return res.json({ distribution, averages, recent: assessments.slice(0, 10), totalContacts: contacts.length, totalAssessments: assessments.length });
  }

  // POST /api/peer-rating
  if (req.method === 'POST' && url === '/peer-rating') {
    const body = req.body || {};
    const rating = { id: nextId++, ...body, ratingsTotal: Object.values(body.ratings || {}).reduce((s,v) => s + v, 0), createdAt: new Date().toISOString() };
    peerRatings.push(rating);
    return res.json(rating);
  }

  return res.status(404).json({ error: 'Not found' });
};
