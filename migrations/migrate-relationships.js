// Migration: Create relationship system tables (user_profiles, matrices, love language, intimacy, couple challenges)
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // User profiles with age, gender, membership tier, partner/parent linking
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) UNIQUE,
        date_of_birth DATE,
        age INTEGER,
        gender TEXT CHECK (gender IN ('male', 'female')),
        membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN ('free', 'individual', 'couple', 'premium')),
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        partner_id INTEGER REFERENCES user_profiles(id),
        parent_id INTEGER REFERENCES user_profiles(id),
        is_dependent BOOLEAN DEFAULT false,
        consent_given BOOLEAN DEFAULT false,
        consent_given_at TIMESTAMPTZ,
        faith_disclaimer_accepted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_contact ON user_profiles(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_partner ON user_profiles(partner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_parent ON user_profiles(parent_id)`;

    // Relationship Contribution Matrix results
    await sql`
      CREATE TABLE IF NOT EXISTS relationship_matrix (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        partner_contact_id INTEGER REFERENCES contacts(id),
        gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        practical_give INTEGER DEFAULT 0,
        practical_receive INTEGER DEFAULT 0,
        mental_load_give INTEGER DEFAULT 0,
        mental_load_receive INTEGER DEFAULT 0,
        financial_give INTEGER DEFAULT 0,
        financial_receive INTEGER DEFAULT 0,
        relational_give INTEGER DEFAULT 0,
        relational_receive INTEGER DEFAULT 0,
        growth_give INTEGER DEFAULT 0,
        growth_receive INTEGER DEFAULT 0,
        give_total INTEGER DEFAULT 0,
        receive_total INTEGER DEFAULT 0,
        domain_gap INTEGER DEFAULT 0,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_relationship_matrix_contact ON relationship_matrix(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_relationship_matrix_partner ON relationship_matrix(partner_contact_id)`;

    // Cherish & Honor Matrix
    await sql`
      CREATE TABLE IF NOT EXISTS cherish_honor_matrix (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        cherish_words INTEGER DEFAULT 0,
        cherish_time INTEGER DEFAULT 0,
        cherish_service INTEGER DEFAULT 0,
        cherish_gifts INTEGER DEFAULT 0,
        cherish_touch INTEGER DEFAULT 0,
        cherish_total INTEGER DEFAULT 0,
        honor_words INTEGER DEFAULT 0,
        honor_time INTEGER DEFAULT 0,
        honor_service INTEGER DEFAULT 0,
        honor_gifts INTEGER DEFAULT 0,
        honor_touch INTEGER DEFAULT 0,
        honor_total INTEGER DEFAULT 0,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_cherish_honor_contact ON cherish_honor_matrix(contact_id)`;

    // Love Language assessment results
    await sql`
      CREATE TABLE IF NOT EXISTS love_language_results (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        words_of_affirmation_give INTEGER DEFAULT 0,
        words_of_affirmation_receive INTEGER DEFAULT 0,
        quality_time_give INTEGER DEFAULT 0,
        quality_time_receive INTEGER DEFAULT 0,
        acts_of_service_give INTEGER DEFAULT 0,
        acts_of_service_receive INTEGER DEFAULT 0,
        gifts_give INTEGER DEFAULT 0,
        gifts_receive INTEGER DEFAULT 0,
        physical_touch_give INTEGER DEFAULT 0,
        physical_touch_receive INTEGER DEFAULT 0,
        primary_give_language TEXT,
        primary_receive_language TEXT,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_love_language_contact ON love_language_results(contact_id)`;

    // 21+ Intimacy section results
    await sql`
      CREATE TABLE IF NOT EXISTS intimacy_results (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        partner_contact_id INTEGER REFERENCES contacts(id),
        comfort_safety INTEGER DEFAULT 0,
        touch_pace INTEGER DEFAULT 0,
        initiation_roles INTEGER DEFAULT 0,
        rhythm_frequency INTEGER DEFAULT 0,
        exploration_feedback INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        consent_both_partners BOOLEAN DEFAULT false,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_intimacy_contact ON intimacy_results(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_intimacy_partner ON intimacy_results(partner_contact_id)`;

    // Couple Challenge (30-90 day)
    await sql`
      CREATE TABLE IF NOT EXISTS couple_challenges (
        id SERIAL PRIMARY KEY,
        couple_profile_id_a INTEGER NOT NULL REFERENCES user_profiles(id),
        couple_profile_id_b INTEGER NOT NULL REFERENCES user_profiles(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        current_day INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
        baseline_matrix_a INTEGER REFERENCES relationship_matrix(id),
        baseline_matrix_b INTEGER REFERENCES relationship_matrix(id),
        challenge_mode TEXT DEFAULT 'couple' CHECK (challenge_mode IN ('couple', 'dating')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Add challenge_mode column if table already exists without it
    await sql`ALTER TABLE couple_challenges ADD COLUMN IF NOT EXISTS challenge_mode TEXT DEFAULT 'couple' CHECK (challenge_mode IN ('couple', 'dating'))`;

    await sql`CREATE INDEX IF NOT EXISTS idx_couple_challenges_profile_a ON couple_challenges(couple_profile_id_a)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_couple_challenges_profile_b ON couple_challenges(couple_profile_id_b)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_couple_challenges_status ON couple_challenges(status)`;

    // Daily prompt responses for couple challenge
    await sql`
      CREATE TABLE IF NOT EXISTS couple_challenge_responses (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER NOT NULL REFERENCES couple_challenges(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        day_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        response_text TEXT,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMPTZ,
        UNIQUE(challenge_id, contact_id, day_number)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_challenge_responses_challenge ON couple_challenge_responses(challenge_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_challenge_responses_contact ON couple_challenge_responses(contact_id)`;

    res.json({
      success: true,
      message: 'Relationship system migration complete',
      tables_created: [
        'user_profiles',
        'relationship_matrix',
        'cherish_honor_matrix',
        'love_language_results',
        'intimacy_results',
        'couple_challenges',
        'couple_challenge_responses'
      ]
    });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
};
