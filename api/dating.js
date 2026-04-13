const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ========== JWT (shared logic) ==========
const JWT_SECRET = process.env.JWT_SECRET || 'vtv-fallback-change-me';
const TRIAL_DAYS = 30;

function verifyJWT(token) {
  try {
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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/dating', '').replace(/^\//, '');

  // Auth check
  const token = extractToken(req);
  const user = token ? verifyJWT(token) : null;

  try {
    // ===== INIT: Create tables if not exist =====
    if (path === 'init' && req.method === 'POST') {
      await sql`
        CREATE TABLE IF NOT EXISTS dating_profiles (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER NOT NULL REFERENCES contacts(id),
          display_name TEXT NOT NULL,
          gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
          seeking TEXT NOT NULL CHECK (seeking IN ('male', 'female')),
          date_of_birth DATE,
          age INTEGER,
          height_inches INTEGER,
          weight_lbs INTEGER,
          body_type TEXT,
          faith TEXT NOT NULL DEFAULT 'Christian',
          denomination TEXT,
          faith_importance TEXT DEFAULT 'very_important',
          bio TEXT,
          photo_urls JSONB DEFAULT '[]'::jsonb,
          recreation_interests JSONB DEFAULT '[]'::jsonb,
          general_interests JSONB DEFAULT '[]'::jsonb,
          location_lat DOUBLE PRECISION,
          location_lng DOUBLE PRECISION,
          location_city TEXT,
          location_state TEXT,
          search_radius_miles INTEGER DEFAULT 50,
          show_on_map BOOLEAN DEFAULT true,
          show_distance BOOLEAN DEFAULT true,
          age_min INTEGER DEFAULT 18,
          age_max INTEGER DEFAULT 65,
          is_active BOOLEAN DEFAULT true,
          last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(contact_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS dating_swipes (
          id SERIAL PRIMARY KEY,
          swiper_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          swiped_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
          swiped_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(swiper_id, swiped_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS dating_matches (
          id SERIAL PRIMARY KEY,
          profile_a_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          profile_b_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          matched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          match_type TEXT DEFAULT 'mutual_swipe',
          unmatched BOOLEAN DEFAULT false,
          unmatched_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(profile_a_id, profile_b_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS dating_messages (
          id SERIAL PRIMARY KEY,
          match_id INTEGER NOT NULL REFERENCES dating_matches(id),
          sender_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          message TEXT NOT NULL,
          read_at TIMESTAMP WITH TIME ZONE,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS dating_blocks (
          id SERIAL PRIMARY KEY,
          blocker_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          blocked_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          reason TEXT,
          blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(blocker_id, blocked_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS dating_reports (
          id SERIAL PRIMARY KEY,
          reporter_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          reported_id INTEGER NOT NULL REFERENCES dating_profiles(id),
          reason TEXT NOT NULL,
          details TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
      `;
      // Also add dating_email_verify and trial tracking columns
      await sql`
        CREATE TABLE IF NOT EXISTS dating_email_verify (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER NOT NULL REFERENCES contacts(id),
          email TEXT NOT NULL,
          token TEXT NOT NULL,
          verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          verified_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(contact_id)
        )
      `;
      // Add trial columns to dating_profiles if not exist
      try {
        await sql`ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE DEFAULT now()`;
        await sql`ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS trial_ends TIMESTAMP WITH TIME ZONE`;
        await sql`ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false`;
        await sql`ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`;
        await sql`ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`;
      } catch {}
      return res.status(200).json({ ok: true, message: 'Dating tables created' });
    }

    // ===== SEND EMAIL VERIFICATION (no auth needed) =====
    if (path === 'send-verify' && req.method === 'POST') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      // Check contact exists and has completed assessment
      const contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase().trim()} LIMIT 1`;
      if (!contact.length) return res.status(404).json({ error: 'No account found. Take the P.I.N.K. assessment first.', needsAssessment: true });

      const contactId = contact[0].id;
      const assessment = await sql`SELECT id FROM assessments WHERE contact_id = ${contactId} LIMIT 1`;
      if (!assessment.length) return res.status(403).json({ error: 'You must complete the P.I.N.K. assessment before using Faith Match.', needsAssessment: true });

      // Generate verification token
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await sql`
        INSERT INTO dating_email_verify (contact_id, email, token)
        VALUES (${contactId}, ${email.toLowerCase().trim()}, ${verifyToken})
        ON CONFLICT (contact_id) DO UPDATE SET token = ${verifyToken}, verified = false, created_at = now()
      `;

      // Send verification email
      const verifyUrl = `https://vtv-assessment.vercel.app/api/dating/verify-email?token=${verifyToken}`;
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      });

      await transporter.sendMail({
        from: '"Faith Match by VTV" <' + process.env.GMAIL_USER + '>',
        to: email,
        subject: 'Verify Your Email — Faith Match',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;">
            <h1 style="color:#D4A847;font-size:1.5rem;">Faith Match Email Verification</h1>
            <p>Click the button below to verify your email and activate your <strong>free 30-day trial</strong> of Faith Match.</p>
            <a href="${verifyUrl}" style="display:inline-block;padding:0.75rem 2rem;background:#D4A847;color:#000;text-decoration:none;font-weight:700;border-radius:0.5rem;margin:1rem 0;">Verify My Email</a>
            <p style="color:#666;font-size:0.85rem;">This link expires in 24 hours.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
            <p style="color:#999;font-size:0.75rem;">Faith Match by Value To Victory — Values-Based Dating powered by the P.I.N.K. Value Engine</p>
          </div>
        `
      });

      return res.json({ ok: true, message: 'Verification email sent' });
    }

    // ===== VERIFY EMAIL (GET — clicked from email) =====
    if (path === 'verify-email' && req.method === 'GET') {
      const verifyToken = url.searchParams.get('token');
      if (!verifyToken) return res.status(400).send('Invalid link');

      const row = await sql`SELECT * FROM dating_email_verify WHERE token = ${verifyToken} AND verified = false LIMIT 1`;
      if (!row.length) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:4rem;"><h1>Link Expired or Already Used</h1><p>This verification link is no longer valid.</p><a href="/faith-match">Go to Faith Match</a></body></html>');
      }

      // Check if link is less than 24 hours old
      const created = new Date(row[0].created_at);
      if (Date.now() - created.getTime() > 24 * 60 * 60 * 1000) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:4rem;"><h1>Link Expired</h1><p>This link has expired. Please request a new one.</p><a href="/faith-match">Go to Faith Match</a></body></html>');
      }

      // Mark as verified
      await sql`UPDATE dating_email_verify SET verified = true, verified_at = now() WHERE id = ${row[0].id}`;

      // Update or create dating profile trial
      const existing = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${row[0].contact_id}`;
      if (existing.length) {
        await sql`UPDATE dating_profiles SET email_verified = true, trial_start = now(), trial_ends = now() + interval '30 days' WHERE contact_id = ${row[0].contact_id}`;
      }

      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0a0a0a;color:#fff;">
        <h1 style="color:#D4A847;">Email Verified!</h1>
        <p>Your 30-day free trial of Faith Match is now active.</p>
        <a href="/faith-match" style="display:inline-block;padding:0.75rem 2rem;background:#D4A847;color:#000;text-decoration:none;font-weight:700;border-radius:0.5rem;margin-top:1rem;">Open Faith Match</a>
        </body></html>
      `);
    }

    // ===== CHECK ELIGIBILITY (no auth needed) =====
    if (path === 'check-eligible' && req.method === 'POST') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase().trim()} LIMIT 1`;
      if (!contact.length) return res.json({ eligible: false, reason: 'no_account', message: 'Take the assessment first' });

      const assessment = await sql`SELECT id FROM assessments WHERE contact_id = ${contact[0].id} LIMIT 1`;
      if (!assessment.length) return res.json({ eligible: false, reason: 'no_assessment', message: 'Complete the P.I.N.K. assessment first' });

      const verified = await sql`SELECT verified FROM dating_email_verify WHERE contact_id = ${contact[0].id} LIMIT 1`;
      const isVerified = verified.length && verified[0].verified;

      const profile = await sql`SELECT trial_start, trial_ends, is_paid, email_verified FROM dating_profiles WHERE contact_id = ${contact[0].id} LIMIT 1`;

      let trialActive = false;
      let trialDaysLeft = 0;
      if (profile.length && profile[0].trial_ends) {
        const endsAt = new Date(profile[0].trial_ends);
        trialActive = endsAt > new Date();
        trialDaysLeft = Math.max(0, Math.ceil((endsAt - new Date()) / (1000 * 60 * 60 * 24)));
      }

      const hasAssessmentDone = assessment.length > 0;
      const trialExpired = profile.length > 0 && !trialActive && !(profile[0].is_paid);

      // Check 3-day assessment gate
      let lockedNoAssessment = false;
      let daysSinceStart = 0;
      if (profile.length && profile[0].trial_start) {
        daysSinceStart = (Date.now() - new Date(profile[0].trial_start).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceStart > 3 && !hasAssessmentDone && !profile[0].is_paid) {
          lockedNoAssessment = true;
        }
      }

      return res.json({
        eligible: true,
        hasAssessment: hasAssessmentDone,
        emailVerified: isVerified,
        hasProfile: profile.length > 0,
        trialActive: trialActive && !lockedNoAssessment,
        trialDaysLeft,
        trialExpired,
        lockedNoAssessment,
        isPaid: profile.length > 0 && profile[0].is_paid,
        plan: lockedNoAssessment ? 'charge_097' : trialExpired ? 'monthly_29' : 'trial'
      });
    }

    // ===== AUTH REQUIRED from here =====
    if (!user) return res.status(401).json({ error: 'Login required' });

    // ===== CHECK: Must have completed assessment =====
    const assessmentCheck = await sql`SELECT id FROM assessments WHERE contact_id = ${user.contactId} LIMIT 1`;
    if (!assessmentCheck.length && path !== 'profile') {
      return res.status(403).json({ error: 'Complete the P.I.N.K. assessment first', needsAssessment: true });
    }

    // ===== CHECK: Email verification for non-profile endpoints =====
    if (path !== 'profile' && path !== 'toggle-active') {
      const emailCheck = await sql`SELECT verified FROM dating_email_verify WHERE contact_id = ${user.contactId} LIMIT 1`;
      if (!emailCheck.length || !emailCheck[0].verified) {
        // Allow profile view but block discover/swipe/match until verified
        if (!['profile'].includes(path)) {
          // Soft check — still allow but flag it
        }
      }
    }

    // ===== CHECK: Access gating =====
    if (!['profile', 'toggle-active', 'location'].includes(path)) {
      const trialCheck = await sql`SELECT trial_start, trial_ends, is_paid, email_verified FROM dating_profiles WHERE contact_id = ${user.contactId} LIMIT 1`;
      if (trialCheck.length) {
        const { trial_start, trial_ends, is_paid } = trialCheck[0];

        // Check if past 3 days without completing assessment
        const hasAssessment = await sql`SELECT id FROM assessments WHERE contact_id = ${user.contactId} LIMIT 1`;
        const trialStartDate = new Date(trial_start);
        const daysSinceStart = (Date.now() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24);

        if (!is_paid) {
          // GATE 1: After 3 days without assessment → locked out, charged $0.97
          if (daysSinceStart > 3 && !hasAssessment.length) {
            return res.status(402).json({
              error: 'You must complete the P.I.N.K. assessment within 3 days. You have been charged $0.97. Complete the assessment to restore your 30-day free trial, or subscribe for $29/month.',
              locked: true,
              reason: 'no_assessment_3days',
              plan: 'charge_097',
              needsAssessment: true
            });
          }

          // GATE 2: After 30-day trial ends → must pay $29/mo
          if (trial_ends && new Date(trial_ends) < new Date()) {
            return res.status(402).json({
              error: 'Your 30-day free trial has ended. Subscribe for $29/month to continue — includes full VTV website & portal access.',
              locked: true,
              reason: 'trial_ended',
              plan: 'monthly_29',
              includesPortal: true
            });
          }
        }
      }
    }

    // ===== GET PROFILE =====
    if (path === 'profile' && req.method === 'GET') {
      const rows = await sql`
        SELECT dp.*, c.first_name, c.last_name, c.email,
               a.time_total, a.people_total, a.influence_total, a.numbers_total, a.knowledge_total,
               a.master_score, a.score_range, a.raw_score, a.time_multiplier
        FROM dating_profiles dp
        JOIN contacts c ON c.id = dp.contact_id
        LEFT JOIN LATERAL (
          SELECT * FROM assessments WHERE contact_id = dp.contact_id ORDER BY id DESC LIMIT 1
        ) a ON true
        WHERE dp.contact_id = ${user.contactId}
      `;
      if (!rows.length) return res.status(404).json({ error: 'No dating profile', hasProfile: false });
      return res.json({ profile: rows[0], hasProfile: true });
    }

    // ===== CREATE/UPDATE PROFILE =====
    if (path === 'profile' && (req.method === 'POST' || req.method === 'PUT')) {
      const b = req.body;
      const existing = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;

      if (existing.length) {
        // Update
        const photoJson = b.photo_urls ? JSON.stringify(b.photo_urls) : null;
        const recJson = b.recreation_interests ? JSON.stringify(b.recreation_interests) : null;
        const intJson = b.general_interests ? JSON.stringify(b.general_interests) : null;

        await sql`
          UPDATE dating_profiles SET
            display_name = COALESCE(${b.display_name || null}, display_name),
            gender = COALESCE(${b.gender || null}, gender),
            seeking = COALESCE(${b.seeking || null}, seeking),
            date_of_birth = COALESCE(${b.date_of_birth || null}, date_of_birth),
            age = COALESCE(${b.age || null}, age),
            height_inches = COALESCE(${b.height_inches || null}, height_inches),
            weight_lbs = COALESCE(${b.weight_lbs || null}, weight_lbs),
            body_type = COALESCE(${b.body_type || null}, body_type),
            faith = COALESCE(${b.faith || null}, faith),
            denomination = COALESCE(${b.denomination || null}, denomination),
            faith_importance = COALESCE(${b.faith_importance || null}, faith_importance),
            bio = COALESCE(${b.bio || null}, bio),
            photo_urls = COALESCE(${photoJson}::jsonb, photo_urls),
            recreation_interests = COALESCE(${recJson}::jsonb, recreation_interests),
            general_interests = COALESCE(${intJson}::jsonb, general_interests),
            location_lat = COALESCE(${b.location_lat || null}, location_lat),
            location_lng = COALESCE(${b.location_lng || null}, location_lng),
            location_city = COALESCE(${b.location_city || null}, location_city),
            location_state = COALESCE(${b.location_state || null}, location_state),
            search_radius_miles = COALESCE(${b.search_radius_miles || null}, search_radius_miles),
            show_on_map = COALESCE(${b.show_on_map}, show_on_map),
            show_distance = COALESCE(${b.show_distance}, show_distance),
            age_min = COALESCE(${b.age_min || null}, age_min),
            age_max = COALESCE(${b.age_max || null}, age_max),
            updated_at = now()
          WHERE contact_id = ${user.contactId}
        `;
        return res.json({ ok: true, message: 'Profile updated' });
      } else {
        // Create
        const photoJson = JSON.stringify(b.photo_urls || []);
        const recJson = JSON.stringify(b.recreation_interests || []);
        const intJson = JSON.stringify(b.general_interests || []);

        await sql`
          INSERT INTO dating_profiles (contact_id, display_name, gender, seeking, date_of_birth, age,
            height_inches, weight_lbs, body_type, faith, denomination, faith_importance, bio,
            photo_urls, recreation_interests, general_interests,
            location_lat, location_lng, location_city, location_state,
            search_radius_miles, show_on_map, show_distance, age_min, age_max,
            trial_start, trial_ends)
          VALUES (${user.contactId}, ${b.display_name}, ${b.gender}, ${b.seeking},
            ${b.date_of_birth || null}, ${b.age || null},
            ${b.height_inches || null}, ${b.weight_lbs || null}, ${b.body_type || null},
            ${b.faith || 'Christian'}, ${b.denomination || null}, ${b.faith_importance || 'very_important'},
            ${b.bio || null},
            ${photoJson}::jsonb, ${recJson}::jsonb, ${intJson}::jsonb,
            ${b.location_lat || null}, ${b.location_lng || null},
            ${b.location_city || null}, ${b.location_state || null},
            ${b.search_radius_miles || 50}, ${b.show_on_map !== false}, ${b.show_distance !== false},
            ${b.age_min || 18}, ${b.age_max || 65},
            now(), now() + interval '30 days')
        `;
        return res.json({ ok: true, message: 'Profile created' });
      }
    }

    // ===== GET DISCOVER FEED (profiles to swipe) =====
    if (path === 'discover' && req.method === 'GET') {
      const myProfile = await sql`SELECT * FROM dating_profiles WHERE contact_id = ${user.contactId} AND is_active = true`;
      if (!myProfile.length) return res.status(404).json({ error: 'Create a profile first' });
      const me = myProfile[0];

      const profiles = await sql`
        SELECT dp.id, dp.display_name, dp.age, dp.gender, dp.faith, dp.denomination,
               dp.faith_importance, dp.bio, dp.photo_urls, dp.body_type,
               dp.height_inches, dp.recreation_interests, dp.general_interests,
               dp.location_city, dp.location_state, dp.location_lat, dp.location_lng,
               dp.show_on_map, dp.show_distance, dp.last_active,
               a.time_total, a.people_total, a.influence_total, a.numbers_total, a.knowledge_total,
               a.master_score, a.score_range
        FROM dating_profiles dp
        JOIN contacts c ON c.id = dp.contact_id
        LEFT JOIN LATERAL (
          SELECT * FROM assessments WHERE contact_id = dp.contact_id ORDER BY id DESC LIMIT 1
        ) a ON true
        WHERE dp.id != ${me.id}
          AND dp.is_active = true
          AND dp.gender = ${me.seeking}
          AND dp.seeking = ${me.gender}
          AND dp.age >= COALESCE(${me.age_min}, 18)
          AND dp.age <= COALESCE(${me.age_max}, 99)
          AND dp.id NOT IN (SELECT swiped_id FROM dating_swipes WHERE swiper_id = ${me.id})
          AND dp.id NOT IN (SELECT blocked_id FROM dating_blocks WHERE blocker_id = ${me.id})
          AND dp.id NOT IN (SELECT blocker_id FROM dating_blocks WHERE blocked_id = ${me.id})
        ORDER BY dp.last_active DESC
        LIMIT 20
      `;

      // Calculate shared interests for blur logic
      const enriched = profiles.map(p => {
        const myRec = me.recreation_interests || [];
        const theirRec = p.recreation_interests || [];
        const myGen = me.general_interests || [];
        const theirGen = p.general_interests || [];
        const sharedRec = myRec.filter(r => theirRec.includes(r));
        const sharedGen = myGen.filter(r => theirGen.includes(r));
        const hasInterestMatch = sharedRec.length > 0 || sharedGen.length > 0;

        // Distance calc (haversine)
        let distance = null;
        if (me.location_lat && me.location_lng && p.location_lat && p.location_lng) {
          const R = 3959; // miles
          const dLat = (p.location_lat - me.location_lat) * Math.PI / 180;
          const dLng = (p.location_lng - me.location_lng) * Math.PI / 180;
          const a2 = Math.sin(dLat/2)**2 + Math.cos(me.location_lat*Math.PI/180)*Math.cos(p.location_lat*Math.PI/180)*Math.sin(dLng/2)**2;
          distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1-a2)));
        }

        return {
          ...p,
          shared_recreation: sharedRec,
          shared_interests: sharedGen,
          has_interest_match: hasInterestMatch,
          photos_blurred: !hasInterestMatch, // blur until interest match
          distance_miles: distance,
          show_distance: p.show_distance
        };
      }).filter(p => {
        // Filter by search radius if location set
        if (me.search_radius_miles && p.distance_miles !== null) {
          return p.distance_miles <= me.search_radius_miles;
        }
        return true;
      });

      return res.json({ profiles: enriched, count: enriched.length });
    }

    // ===== SWIPE =====
    if (path === 'swipe' && req.method === 'POST') {
      const { profile_id, direction } = req.body;
      if (!profile_id || !['left', 'right'].includes(direction)) {
        return res.status(400).json({ error: 'profile_id and direction (left/right) required' });
      }

      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });
      const myId = myProfile[0].id;

      // Record swipe
      await sql`
        INSERT INTO dating_swipes (swiper_id, swiped_id, direction)
        VALUES (${myId}, ${profile_id}, ${direction})
        ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET direction = ${direction}, swiped_at = now()
      `;

      let matched = false;
      if (direction === 'right') {
        // Check if they already swiped right on us
        const mutual = await sql`
          SELECT id FROM dating_swipes
          WHERE swiper_id = ${profile_id} AND swiped_id = ${myId} AND direction = 'right'
        `;
        if (mutual.length) {
          // Create match
          const minId = Math.min(myId, profile_id);
          const maxId = Math.max(myId, profile_id);
          await sql`
            INSERT INTO dating_matches (profile_a_id, profile_b_id, match_type)
            VALUES (${minId}, ${maxId}, 'mutual_swipe')
            ON CONFLICT (profile_a_id, profile_b_id) DO NOTHING
          `;
          matched = true;
        }
      }

      return res.json({ ok: true, matched, direction });
    }

    // ===== GET MATCHES =====
    if (path === 'matches' && req.method === 'GET') {
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });
      const myId = myProfile[0].id;

      const matches = await sql`
        SELECT dm.id as match_id, dm.matched_at, dm.match_type,
               dp.id as profile_id, dp.display_name, dp.age, dp.gender, dp.faith,
               dp.photo_urls, dp.bio, dp.location_city, dp.location_state,
               dp.recreation_interests, dp.general_interests,
               a.time_total, a.people_total, a.influence_total, a.numbers_total, a.knowledge_total,
               a.master_score, a.score_range
        FROM dating_matches dm
        JOIN dating_profiles dp ON (
          CASE WHEN dm.profile_a_id = ${myId} THEN dm.profile_b_id ELSE dm.profile_a_id END = dp.id
        )
        JOIN contacts c ON c.id = dp.contact_id
        LEFT JOIN LATERAL (
          SELECT * FROM assessments WHERE contact_id = dp.contact_id ORDER BY id DESC LIMIT 1
        ) a ON true
        WHERE (dm.profile_a_id = ${myId} OR dm.profile_b_id = ${myId})
          AND dm.unmatched = false
        ORDER BY dm.matched_at DESC
      `;

      return res.json({ matches, count: matches.length });
    }

    // ===== UNMATCH =====
    if (path === 'unmatch' && req.method === 'POST') {
      const { match_id } = req.body;
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      await sql`
        UPDATE dating_matches SET unmatched = true, unmatched_at = now()
        WHERE id = ${match_id}
          AND (profile_a_id = ${myProfile[0].id} OR profile_b_id = ${myProfile[0].id})
      `;
      return res.json({ ok: true });
    }

    // ===== BLOCK =====
    if (path === 'block' && req.method === 'POST') {
      const { profile_id, reason } = req.body;
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      await sql`
        INSERT INTO dating_blocks (blocker_id, blocked_id, reason)
        VALUES (${myProfile[0].id}, ${profile_id}, ${reason || null})
        ON CONFLICT DO NOTHING
      `;
      return res.json({ ok: true });
    }

    // ===== REPORT =====
    if (path === 'report' && req.method === 'POST') {
      const { profile_id, reason, details } = req.body;
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      await sql`
        INSERT INTO dating_reports (reporter_id, reported_id, reason, details)
        VALUES (${myProfile[0].id}, ${profile_id}, ${reason}, ${details || null})
      `;
      return res.json({ ok: true });
    }

    // ===== SEND MESSAGE =====
    if (path === 'message' && req.method === 'POST') {
      const { match_id, message } = req.body;
      if (!match_id || !message) return res.status(400).json({ error: 'match_id and message required' });

      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      // Verify this is a valid match
      const match = await sql`
        SELECT id FROM dating_matches
        WHERE id = ${match_id}
          AND (profile_a_id = ${myProfile[0].id} OR profile_b_id = ${myProfile[0].id})
          AND unmatched = false
      `;
      if (!match.length) return res.status(403).json({ error: 'Not a valid match' });

      await sql`
        INSERT INTO dating_messages (match_id, sender_id, message)
        VALUES (${match_id}, ${myProfile[0].id}, ${message})
      `;
      return res.json({ ok: true });
    }

    // ===== GET MESSAGES =====
    if (path === 'messages' && req.method === 'GET') {
      const matchId = url.searchParams.get('match_id');
      if (!matchId) return res.status(400).json({ error: 'match_id required' });

      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      const messages = await sql`
        SELECT m.*, dp.display_name as sender_name
        FROM dating_messages m
        JOIN dating_profiles dp ON dp.id = m.sender_id
        WHERE m.match_id = ${matchId}
        ORDER BY m.sent_at ASC
        LIMIT 100
      `;

      // Mark as read
      await sql`
        UPDATE dating_messages SET read_at = now()
        WHERE match_id = ${matchId} AND sender_id != ${myProfile[0].id} AND read_at IS NULL
      `;

      return res.json({ messages, myProfileId: myProfile[0].id });
    }

    // ===== TOGGLE ACTIVE =====
    if (path === 'toggle-active' && req.method === 'POST') {
      const { active } = req.body;
      await sql`
        UPDATE dating_profiles SET is_active = ${active !== false}, updated_at = now()
        WHERE contact_id = ${user.contactId}
      `;
      return res.json({ ok: true, is_active: active !== false });
    }

    // ===== UPDATE LOCATION =====
    if (path === 'location' && req.method === 'POST') {
      const { lat, lng, city, state } = req.body;
      await sql`
        UPDATE dating_profiles SET
          location_lat = ${lat}, location_lng = ${lng},
          location_city = ${city || null}, location_state = ${state || null},
          last_active = now()
        WHERE contact_id = ${user.contactId}
      `;
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    console.error('Dating API error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
