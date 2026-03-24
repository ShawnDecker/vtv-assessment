// Database setup - creates tables if they don't exist
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);
  
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

  res.json({ success: true, message: "Database tables created" });
};
