/**
 * Seed demo profiles for Aligned Hearts presentation
 * Creates 8 fake but realistic profiles in a Roanoke/Virginia area
 * Each has a P.I.N.K. assessment so compatibility scoring works
 *
 * Run: node scripts/seed-demo-profiles.js
 */
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DEMO_PROFILES = [
  // Females
  { first: 'Sarah', last: 'Mitchell', email: 'demo-sarah@alignedhearts.test', gender: 'female', seeking: 'male', age: 28, height: 65, body: 'athletic', faith: 'Non-denominational', city: 'Roanoke', state: 'Virginia', lat: 37.2710, lng: -79.9414, bio: 'Hiker, runner, worship leader. Looking for someone who makes me laugh and prays with me.', rec: ['hiking','running','yoga','swimming'], int: ['worship','bible_study','volunteering','cooking'], pink: { time:42, people:38, influence:35, numbers:30, knowledge:40 } },
  { first: 'Rachel', last: 'Thompson', email: 'demo-rachel@alignedhearts.test', gender: 'female', seeking: 'male', age: 32, height: 67, body: 'average', faith: 'Baptist', city: 'Salem', state: 'Virginia', lat: 37.2935, lng: -80.0548, bio: 'Teacher, dog mom, coffee enthusiast. Faith first, family always.', rec: ['hiking','dancing','gardening'], int: ['reading','cooking','small_groups','pets'], pink: { time:36, people:45, influence:32, numbers:28, knowledge:38 } },
  { first: 'Emma', last: 'Brooks', email: 'demo-emma@alignedhearts.test', gender: 'female', seeking: 'male', age: 26, height: 64, body: 'slim', faith: 'Catholic', city: 'Lynchburg', state: 'Virginia', lat: 37.4138, lng: -79.1422, bio: 'Nurse, mission trip veteran, amateur photographer. Want to build something real.', rec: ['running','yoga','swimming','dancing'], int: ['photography','mission_trips','travel','art'], pink: { time:40, people:42, influence:30, numbers:32, knowledge:35 } },
  { first: 'Hannah', last: 'Rivera', email: 'demo-hannah@alignedhearts.test', gender: 'female', seeking: 'male', age: 30, height: 66, body: 'curvy', faith: 'Pentecostal', city: 'Blacksburg', state: 'Virginia', lat: 37.2296, lng: -80.4139, bio: 'CPA by day, worship team Sunday. Looking for a man of integrity.', rec: ['hiking','cycling','gym','horseback'], int: ['bible_study','worship','reading','music'], pink: { time:35, people:36, influence:38, numbers:48, knowledge:40 } },
  // Males
  { first: 'Michael', last: 'Carter', email: 'demo-michael@alignedhearts.test', gender: 'male', seeking: 'female', age: 31, height: 72, body: 'athletic', faith: 'Non-denominational', city: 'Roanoke', state: 'Virginia', lat: 37.2710, lng: -79.9414, bio: 'Engineer, fly fisherman, small group leader. Pursuing Christ first, woman second.', rec: ['hiking','fishing','running','camping'], int: ['bible_study','worship','reading','podcasts'], pink: { time:44, people:40, influence:38, numbers:36, knowledge:42 } },
  { first: 'David', last: 'Park', email: 'demo-david@alignedhearts.test', gender: 'male', seeking: 'female', age: 34, height: 70, body: 'average', faith: 'Presbyterian', city: 'Salem', state: 'Virginia', lat: 37.2935, lng: -80.0548, bio: 'Veteran, mortgage broker, dog dad. Want a teammate, not a project.', rec: ['hunting','fishing','golf','gym'], int: ['reading','cooking','volunteering','podcasts'], pink: { time:38, people:35, influence:42, numbers:46, knowledge:36 } },
  { first: 'Jonathan', last: 'Reed', email: 'demo-jonathan@alignedhearts.test', gender: 'male', seeking: 'female', age: 29, height: 73, body: 'athletic', faith: 'Baptist', city: 'Lynchburg', state: 'Virginia', lat: 37.4138, lng: -79.1422, bio: 'Youth pastor, marathoner, coffee snob. Looking for my partner in ministry.', rec: ['running','hiking','cycling','sports'], int: ['bible_study','worship','mission_trips','small_groups'], pink: { time:46, people:48, influence:44, numbers:28, knowledge:38 } },
  { first: 'James', last: 'Walker', email: 'demo-james@alignedhearts.test', gender: 'male', seeking: 'female', age: 36, height: 71, body: 'average', faith: 'Methodist', city: 'Blacksburg', state: 'Virginia', lat: 37.2296, lng: -80.4139, bio: 'Small business owner, single dad to a 6yo, BBQ aficionado. Slow and steady.', rec: ['fishing','camping','gardening','golf'], int: ['cooking','pets','small_groups','reading'], pink: { time:32, people:42, influence:40, numbers:44, knowledge:34 } }
];

async function seed() {
  console.log('Seeding', DEMO_PROFILES.length, 'demo profiles...\n');

  for (const p of DEMO_PROFILES) {
    try {
      // 1. Create or get contact
      let contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${p.email.toLowerCase()} LIMIT 1`;
      let contactId;
      if (contact.length) {
        contactId = contact[0].id;
        console.log(`  [exists] ${p.first} ${p.last} (id=${contactId})`);
      } else {
        const created = await sql`
          INSERT INTO contacts (first_name, last_name, email, created_at)
          VALUES (${p.first}, ${p.last}, ${p.email}, ${new Date().toISOString()})
          RETURNING id
        `;
        contactId = created[0].id;
        console.log(`  [created] ${p.first} ${p.last} (id=${contactId})`);
      }

      // 2. Create assessment with P.I.N.K. scores (so compatibility works)
      const existingAssess = await sql`SELECT id FROM assessments WHERE contact_id = ${contactId} LIMIT 1`;
      if (!existingAssess.length) {
        // Split each pillar total across 10 sub-categories (avg ~3-5 each)
        const split = (total) => {
          const avg = total / 10;
          return Array.from({length: 10}, (_, i) => Math.max(1, Math.min(5, Math.round(avg + (Math.random() - 0.5)))));
        };
        const t = split(p.pink.time);
        const pp = split(p.pink.people);
        const i = split(p.pink.influence);
        const n = split(p.pink.numbers);
        const k = split(p.pink.knowledge);
        const raw = p.pink.time + p.pink.people + p.pink.influence + p.pink.numbers + p.pink.knowledge;
        const tm = 1.0 + (p.pink.time - 25) / 50;
        const master = Math.round(raw * tm * 10) / 10;
        const pillars = [['time',p.pink.time],['people',p.pink.people],['influence',p.pink.influence],['numbers',p.pink.numbers],['knowledge',p.pink.knowledge]];
        const weakest = pillars.sort((a,b)=>a[1]-b[1])[0][0];

        await sql`
          INSERT INTO assessments (contact_id, mode, completed_at, weakest_pillar, prescription,
            time_awareness, time_allocation, time_protection, time_leverage, five_hour_leak,
            value_per_hour, time_investment, downtime_quality, foresight, time_reallocation, time_total,
            trust_investment, boundary_quality, network_depth, relational_roi, people_audit,
            alliance_building, love_bank_deposits, communication_clarity, restraint_practice, value_replacement, people_total,
            leadership_level, integrity_alignment, professional_credibility, empathetic_listening, gravitational_center,
            micro_honesties, word_management, personal_responsibility, adaptive_influence, influence_multiplier, influence_total,
            financial_awareness, goal_specificity, investment_logic, measurement_habit, cost_vs_value,
            number_one_clarity, small_improvements, negative_math, income_multiplier, negotiation_skill, numbers_total,
            learning_hours, application_rate, bias_awareness, highest_best_use, supply_and_demand,
            substitution_risk, double_jeopardy, knowledge_compounding, weighted_analysis, perception_vs_perspective, knowledge_total,
            time_multiplier, raw_score, master_score, score_range)
          VALUES (${contactId}, 'relationship', ${new Date().toISOString()}, ${weakest}, ${JSON.stringify({demo:true})}::jsonb,
            ${t[0]}, ${t[1]}, ${t[2]}, ${t[3]}, ${t[4]}, ${t[5]}, ${t[6]}, ${t[7]}, ${t[8]}, ${t[9]}, ${p.pink.time},
            ${pp[0]}, ${pp[1]}, ${pp[2]}, ${pp[3]}, ${pp[4]}, ${pp[5]}, ${pp[6]}, ${pp[7]}, ${pp[8]}, ${pp[9]}, ${p.pink.people},
            ${i[0]}, ${i[1]}, ${i[2]}, ${i[3]}, ${i[4]}, ${i[5]}, ${i[6]}, ${i[7]}, ${i[8]}, ${i[9]}, ${p.pink.influence},
            ${n[0]}, ${n[1]}, ${n[2]}, ${n[3]}, ${n[4]}, ${n[5]}, ${n[6]}, ${n[7]}, ${n[8]}, ${n[9]}, ${p.pink.numbers},
            ${k[0]}, ${k[1]}, ${k[2]}, ${k[3]}, ${k[4]}, ${k[5]}, ${k[6]}, ${k[7]}, ${k[8]}, ${k[9]}, ${p.pink.knowledge},
            ${tm}, ${raw}, ${master}, 'Strong')
        `;
        console.log(`    + assessment (master=${master})`);
      }

      // 3. Create dating profile
      const existingProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (!existingProfile.length) {
        const recJson = JSON.stringify(p.rec);
        const intJson = JSON.stringify(p.int);
        const photoJson = JSON.stringify([]);  // No photos — kept blurred (intentional for demo)

        await sql`
          INSERT INTO dating_profiles (
            contact_id, display_name, gender, seeking, age,
            height_inches, body_type, faith, faith_importance, bio,
            photo_urls, recreation_interests, general_interests,
            location_lat, location_lng, location_city, location_state,
            search_radius_miles, show_on_map, show_distance,
            age_min, age_max, is_active, email_verified,
            trial_start, trial_ends
          ) VALUES (
            ${contactId}, ${p.first}, ${p.gender}, ${p.seeking}, ${p.age},
            ${p.height}, ${p.body}, ${p.faith}, 'very_important', ${p.bio},
            ${photoJson}::jsonb, ${recJson}::jsonb, ${intJson}::jsonb,
            ${p.lat}, ${p.lng}, ${p.city}, ${p.state},
            100, true, true,
            22, 45, true, true,
            now(), now() + interval '30 days'
          )
        `;
        console.log(`    + dating profile`);
      } else {
        console.log(`    [exists] dating profile`);
      }
    } catch (e) {
      console.error(`  FAIL ${p.first}: ${e.message}`);
    }
  }

  console.log('\n✓ Seeding complete. Demo profiles ready for /aligned-hearts presentation.');
}

seed().catch(e => { console.error(e); process.exit(1); });
