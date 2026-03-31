// Database setup - creates tables if they don't exist
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  try {
  
  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL,
      hubspot_synced INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      mode TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'individual',
      team_id INTEGER,
      is_team_creator INTEGER DEFAULT 0,
      time_awareness INTEGER NOT NULL, time_allocation INTEGER NOT NULL, time_protection INTEGER NOT NULL, time_leverage INTEGER NOT NULL, five_hour_leak INTEGER NOT NULL, value_per_hour INTEGER NOT NULL, time_investment INTEGER NOT NULL, downtime_quality INTEGER NOT NULL, foresight INTEGER NOT NULL, time_reallocation INTEGER NOT NULL, time_total INTEGER NOT NULL,
      trust_investment INTEGER NOT NULL, boundary_quality INTEGER NOT NULL, network_depth INTEGER NOT NULL, relational_roi INTEGER NOT NULL, people_audit INTEGER NOT NULL, alliance_building INTEGER NOT NULL, love_bank_deposits INTEGER NOT NULL, communication_clarity INTEGER NOT NULL, restraint_practice INTEGER NOT NULL, value_replacement INTEGER NOT NULL, people_total INTEGER NOT NULL,
      leadership_level INTEGER NOT NULL, integrity_alignment INTEGER NOT NULL, professional_credibility INTEGER NOT NULL, empathetic_listening INTEGER NOT NULL, gravitational_center INTEGER NOT NULL, micro_honesties INTEGER NOT NULL, word_management INTEGER NOT NULL, personal_responsibility INTEGER NOT NULL, adaptive_influence INTEGER NOT NULL, influence_multiplier INTEGER NOT NULL, influence_total INTEGER NOT NULL,
      financial_awareness INTEGER NOT NULL, goal_specificity INTEGER NOT NULL, investment_logic INTEGER NOT NULL, measurement_habit INTEGER NOT NULL, cost_vs_value INTEGER NOT NULL, number_one_clarity INTEGER NOT NULL, small_improvements INTEGER NOT NULL, negative_math INTEGER NOT NULL, income_multiplier INTEGER NOT NULL, negotiation_skill INTEGER NOT NULL, numbers_total INTEGER NOT NULL,
      learning_hours INTEGER NOT NULL, application_rate INTEGER NOT NULL, bias_awareness INTEGER NOT NULL, highest_best_use INTEGER NOT NULL, supply_and_demand INTEGER NOT NULL, substitution_risk INTEGER NOT NULL, double_jeopardy INTEGER NOT NULL, knowledge_compounding INTEGER NOT NULL, weighted_analysis INTEGER NOT NULL, perception_vs_perspective INTEGER NOT NULL, knowledge_total INTEGER NOT NULL,
      time_multiplier REAL NOT NULL,
      raw_score INTEGER NOT NULL,
      master_score REAL NOT NULL,
      score_range TEXT NOT NULL,
      weakest_pillar TEXT NOT NULL,
      prescription TEXT NOT NULL,
      overlay_answers TEXT,
      overlay_total INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS peer_ratings (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      rater_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      ratings TEXT NOT NULL,
      ratings_total INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  // Company CMA fields on teams table
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_email TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_domain TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS admin_contact_name TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS billing_email TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS integration_webhook TEXT DEFAULT ''`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS report_frequency TEXT DEFAULT 'monthly'`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS auto_report_enabled BOOLEAN DEFAULT false`;

  // Team members table — persistent numeric IDs per team
  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      member_number INTEGER NOT NULL,
      current_focus TEXT DEFAULT '',
      end_year_goals TEXT DEFAULT '',
      department TEXT DEFAULT '',
      role_title TEXT DEFAULT '',
      custom_code TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      joined_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(team_id, contact_id),
      UNIQUE(team_id, member_number)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_members_contact ON team_members(contact_id)`;

  // Backfill existing team members
  const teams = await sql`SELECT DISTINCT team_id FROM assessments WHERE team_id IS NOT NULL`;
  let backfilled = 0;
  for (const t of teams) {
    const members = await sql`SELECT DISTINCT contact_id FROM assessments WHERE team_id = ${t.team_id} ORDER BY contact_id`;
    for (let i = 0; i < members.length; i++) {
      await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${t.team_id}, ${members[i].contact_id}, ${i + 1}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
      backfilled++;
    }
  }

  res.json({ success: true, message: "Database tables created + team members migration complete", backfilledMembers: backfilled });
  } catch (err) {
    console.error('Setup DB error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
