const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ========== JWT (shared logic) ==========
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_API_KEY;
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

const ALLOWED_ORIGINS = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','http://localhost:3000','http://localhost:5173'];

// Rate limiting
const rateLimitStore = new Map();
function checkRateLimit(ip, max = 60, windowMs = 60000) {
  const now = Date.now();
  let record = rateLimitStore.get(ip);
  if (!record || (now - record.start) > windowMs) record = { count: 0, start: now };
  record.count++;
  rateLimitStore.set(ip, record);
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore) { if (now - v.start > windowMs * 2) rateLimitStore.delete(k); }
  }
  return record.count <= max;
}

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

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

      // Force-set Amanda's PIN (one-time fix)
      try {
        const amandaPin = crypto.createHash('sha256').update('5602' + (process.env.PIN_SALT || '_vtv_salt_2026')).digest('hex');
        await sql`UPDATE contacts SET pin_hash = ${amandaPin}, pin_set_at = NOW() WHERE LOWER(email) = 'blessedforbargains@gmail.com' AND (pin_hash IS NULL OR pin_hash != ${amandaPin})`;
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
      // Assessment not required for email verification — 3-day grace period

      // Generate verification token
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await sql`
        INSERT INTO dating_email_verify (contact_id, email, token)
        VALUES (${contactId}, ${email.toLowerCase().trim()}, ${verifyToken})
        ON CONFLICT (contact_id) DO UPDATE SET token = ${verifyToken}, verified = false, created_at = now()
      `;

      // Send verification email
      const verifyUrl = `https://assessment.valuetovictory.com/api/dating/verify-email?token=${verifyToken}`;
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      });

      await transporter.sendMail({
        from: '"Aligned Hearts by VTV" <' + process.env.GMAIL_USER + '>',
        to: email,
        subject: 'Verify Your Email — Aligned Hearts',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;">
            <h1 style="color:#D4A847;font-size:1.5rem;">Aligned Hearts Email Verification</h1>
            <p>Click the button below to verify your email and activate your <strong>free 30-day trial</strong> of Aligned Hearts.</p>
            <a href="${verifyUrl}" style="display:inline-block;padding:0.75rem 2rem;background:#D4A847;color:#000;text-decoration:none;font-weight:700;border-radius:0.5rem;margin:1rem 0;">Verify My Email</a>
            <p style="color:#666;font-size:0.85rem;">This link expires in 24 hours.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0;" />
            <p style="color:#999;font-size:0.75rem;">Aligned Hearts by Value To Victory — Values-Based Dating powered by the P.I.N.K. Value Engine</p>
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
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:4rem;"><h1>Link Expired or Already Used</h1><p>This verification link is no longer valid.</p><a href="/faith-match">Go to Aligned Hearts</a></body></html>');
      }

      // Check if link is less than 24 hours old
      const created = new Date(row[0].created_at);
      if (Date.now() - created.getTime() > 24 * 60 * 60 * 1000) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:4rem;"><h1>Link Expired</h1><p>This link has expired. Please request a new one.</p><a href="/faith-match">Go to Aligned Hearts</a></body></html>');
      }

      // Mark as verified
      await sql`UPDATE dating_email_verify SET verified = true, verified_at = now() WHERE id = ${row[0].id}`;

      // Update or create dating profile trial
      const existing = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${row[0].contact_id}`;
      if (existing.length) {
        await sql`UPDATE dating_profiles SET email_verified = true, trial_start = now(), trial_ends = now() + interval '30 days' WHERE contact_id = ${row[0].contact_id}`;
      }

      // Get their email for the assessment redirect
      const userEmail = row[0].email;

      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <html><body style="font-family:'Satoshi',sans-serif;text-align:center;padding:4rem;background:#0a0a0a;color:#fff;">
        <h1 style="color:#D4A847;font-size:2rem;">Email Verified!</h1>
        <p style="color:#a1a1aa;margin:1rem 0;">Your 30-day free trial of Aligned Hearts is now active.</p>
        <p style="color:#fff;font-size:1.1rem;font-weight:600;margin:1.5rem 0 0.5rem;">Next: Take Your Relationship Assessment</p>
        <p style="color:#a1a1aa;font-size:0.85rem;margin-bottom:1.5rem;">This quick assessment powers your Aligned Hearts profile and compatibility scores.</p>
        <a href="/?email=${encodeURIComponent(userEmail)}&mode=relationship&depth=quick&from=faith-match#/mode-select" style="display:inline-block;padding:0.85rem 2.5rem;background:linear-gradient(135deg,#D4A847,#b8942e);color:#000;text-decoration:none;font-weight:800;border-radius:0.5rem;font-size:1.1rem;">Start My Assessment &rarr;</a>
        <p style="color:#71717a;font-size:0.75rem;margin-top:1.5rem;">You have 3 days to complete it. After that, a $0.97 charge applies.</p>
        </body></html>
      `);
    }

    // ===== CHECK ELIGIBILITY (no auth needed) =====
    if (path === 'check-eligible' && req.method === 'POST') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase().trim()} LIMIT 1`;
      if (!contact.length) return res.json({ eligible: false, reason: 'no_account', message: 'Create an account first' });

      // Assessment not required upfront — they have 3 days
      const assessment = await sql`SELECT id FROM assessments WHERE contact_id = ${contact[0].id} LIMIT 1`;

      // Wrap table queries in try-catch — tables may not exist yet for new users
      let isVerified = false;
      try {
        const verified = await sql`SELECT verified FROM dating_email_verify WHERE contact_id = ${contact[0].id} LIMIT 1`;
        isVerified = verified.length && verified[0].verified;
      } catch { /* table may not exist yet */ }

      let profile = [];
      try {
        profile = await sql`SELECT trial_start, trial_ends, is_paid, email_verified FROM dating_profiles WHERE contact_id = ${contact[0].id} LIMIT 1`;
      } catch { /* table may not exist yet */ }

      // Also check VTV membership — paid members get full access even without dating profile
      const membership = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contact[0].id} LIMIT 1`;
      const hasPaidMembership = membership.length > 0 && membership[0].membership_tier !== 'free';

      let trialActive = false;
      let trialDaysLeft = 0;
      if (profile.length && profile[0].trial_ends) {
        const endsAt = new Date(profile[0].trial_ends);
        trialActive = endsAt > new Date();
        trialDaysLeft = Math.max(0, Math.ceil((endsAt - new Date()) / (1000 * 60 * 60 * 24)));
      }

      const hasAssessmentDone = assessment.length > 0;
      const isPaid = hasPaidMembership || (profile.length > 0 && profile[0].is_paid);
      const trialExpired = profile.length > 0 && !trialActive && !isPaid;

      // Check 3-day assessment gate
      let lockedNoAssessment = false;
      let daysSinceStart = 0;
      if (profile.length && profile[0].trial_start && !isPaid) {
        daysSinceStart = (Date.now() - new Date(profile[0].trial_start).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceStart > 3 && !hasAssessmentDone) {
          lockedNoAssessment = true;
        }
      }

      return res.json({
        eligible: true,
        hasAssessment: hasAssessmentDone,
        emailVerified: isVerified,
        hasProfile: profile.length > 0,
        trialActive: (trialActive || isPaid) && !lockedNoAssessment,
        trialDaysLeft: isPaid ? 999 : trialDaysLeft,
        trialExpired,
        lockedNoAssessment,
        isPaid,
        membershipTier: membership.length > 0 ? membership[0].membership_tier : 'free',
        plan: lockedNoAssessment ? 'charge_097' : trialExpired ? 'monthly_29' : isPaid ? 'paid' : 'trial'
      });
    }

    // ===== AUTH REQUIRED from here =====
    if (!user) return res.status(401).json({ error: 'Login required' });

    // Assessment is NOT required upfront — users have 3 days to complete it
    // The trial/lockout check below handles the enforcement

    // ===== CHECK: Access gating =====
    // Allow profile ops + account deletion without trial gate
    if (!['profile', 'toggle-active', 'location', 'upload-photo', 'remove-photo', 'unread', 'delete-account'].includes(path) && !path.startsWith('admin')) {
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
      await sql`UPDATE dating_profiles SET last_active = now() WHERE contact_id = ${user.contactId}`;
      return res.json({ profile: rows[0], hasProfile: true });
    }

    // ===== CREATE/UPDATE PROFILE =====
    if (path === 'profile' && (req.method === 'POST' || req.method === 'PUT')) {
      const b = req.body;

      // Age validation: must be 18+
      if (b.date_of_birth) {
        const dob = new Date(b.date_of_birth);
        const today = new Date();
        const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
        if (dob > today) return res.status(400).json({ error: 'Birth date cannot be in the future' });
        if (age < 18) return res.status(403).json({ error: 'You must be 18 or older to use Aligned Hearts' });
        if (age > 120) return res.status(400).json({ error: 'Invalid birth date' });
        b.age = age;
      }

      // Gender validation
      if (b.gender && !['male', 'female'].includes(b.gender)) {
        return res.status(400).json({ error: 'Gender must be male or female' });
      }
      if (b.seeking && !['male', 'female'].includes(b.seeking)) {
        return res.status(400).json({ error: 'Seeking must be male or female' });
      }

      const existing = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;

      if (existing.length) {
        // Update
        const photoJson = b.photo_urls ? JSON.stringify(b.photo_urls) : null;
        const recJson = b.recreation_interests ? JSON.stringify(b.recreation_interests) : null;
        const intJson = b.general_interests ? JSON.stringify(b.general_interests) : null;

        // Validate total photo payload size
        const totalPhotoSize = photoJson ? photoJson.length : 0;
        if (totalPhotoSize > 3000000) { // ~3MB of base64
          return res.status(413).json({ error: 'Photos too large. Try uploading fewer or smaller photos.' });
        }

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

        // Validate total photo payload size
        const totalPhotoSize = photoJson.length;
        if (totalPhotoSize > 3000000) { // ~3MB of base64
          return res.status(413).json({ error: 'Photos too large. Try uploading fewer or smaller photos.' });
        }

        // Check if user already has a paid subscription (auto-set is_paid)
        const userProfile = await sql`SELECT membership_tier, stripe_subscription_id FROM user_profiles WHERE contact_id = ${user.contactId} LIMIT 1`;
        const isPaid = userProfile.length > 0 && userProfile[0].membership_tier !== 'free';
        const stripeSub = userProfile.length > 0 ? userProfile[0].stripe_subscription_id : null;

        await sql`
          INSERT INTO dating_profiles (contact_id, display_name, gender, seeking, date_of_birth, age,
            height_inches, weight_lbs, body_type, faith, denomination, faith_importance, bio,
            photo_urls, recreation_interests, general_interests,
            location_lat, location_lng, location_city, location_state,
            search_radius_miles, show_on_map, show_distance, age_min, age_max,
            trial_start, trial_ends, is_paid, stripe_subscription_id)
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
            now(), now() + interval '30 days', ${isPaid}, ${stripeSub})
        `;
        return res.json({ ok: true, message: 'Profile created', isPaid });
      }
    }

    // ===== GET DISCOVER FEED (profiles to swipe) =====
    if (path === 'discover' && req.method === 'GET') {
      const myProfile = await sql`SELECT * FROM dating_profiles WHERE contact_id = ${user.contactId} AND is_active = true`;
      if (!myProfile.length) return res.status(404).json({ error: 'Create a profile first' });
      const me = myProfile[0];

      // Fetch my latest assessment scores for compatibility
      const myAssessment = await sql`SELECT time_total, people_total, influence_total, numbers_total, knowledge_total FROM assessments WHERE contact_id = ${user.contactId} ORDER BY id DESC LIMIT 1`;
      const myScores = myAssessment.length ? myAssessment[0] : null;

      const profiles = await sql`
        SELECT dp.id, dp.display_name, dp.age, dp.gender, dp.faith, dp.denomination,
               dp.faith_importance, dp.bio, dp.photo_urls, dp.body_type,
               dp.height_inches, dp.recreation_interests, dp.general_interests,
               dp.location_city, dp.location_state, dp.location_lat, dp.location_lng,
               dp.show_on_map, dp.show_distance, dp.last_active,
               dp.age_min, dp.age_max, dp.search_radius_miles,
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
          AND (dp.age IS NULL OR dp.age >= COALESCE(${me.age_min}, 18))
          AND (dp.age IS NULL OR dp.age <= COALESCE(${me.age_max}, 99))
          AND dp.id NOT IN (SELECT swiped_id FROM dating_swipes WHERE swiper_id = ${me.id})
          AND dp.id NOT IN (SELECT blocked_id FROM dating_blocks WHERE blocker_id = ${me.id})
          AND dp.id NOT IN (SELECT blocker_id FROM dating_blocks WHERE blocked_id = ${me.id})
        LIMIT 50
      `;

      // Calculate shared interests, distance, and compatibility
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

        // === COMPATIBILITY SCORING ===
        let pillarScore = 0;
        let interestScore = 0;
        let preferenceScore = 0;

        // 1. Pillar Alignment (0-100): how close are the 5 P.I.N.K. pillar scores
        if (myScores && p.time_total != null) {
          const pillars = ['time_total', 'people_total', 'influence_total', 'numbers_total', 'knowledge_total'];
          let pillarSum = 0;
          for (const pillar of pillars) {
            const diff = Math.abs((myScores[pillar] || 0) - (p[pillar] || 0));
            pillarSum += Math.max(0, 100 - diff * 2);
          }
          pillarScore = Math.round(pillarSum / 5);
        } else {
          pillarScore = 50; // neutral if no assessment data
        }

        // 2. Interest Overlap (0-100): shared interests / total unique interests
        const allMyInterests = [...myRec, ...myGen];
        const allTheirInterests = [...theirRec, ...theirGen];
        const allShared = [...sharedRec, ...sharedGen];
        const uniqueSet = new Set([...allMyInterests, ...allTheirInterests]);
        if (uniqueSet.size > 0) {
          interestScore = Math.round((allShared.length / uniqueSet.size) * 100);
        } else {
          interestScore = 0;
        }

        // 3. Preference Match (0-100): faith + age range + distance
        // +40 if same faith
        if (me.faith && p.faith && me.faith.toLowerCase() === p.faith.toLowerCase()) {
          preferenceScore += 40;
        }
        // +30 if age within their preference range
        if (me.age && p.age_min != null && p.age_max != null) {
          if (me.age >= p.age_min && me.age <= p.age_max) {
            preferenceScore += 30;
          }
        } else {
          preferenceScore += 15; // partial credit if no age prefs set
        }
        // +30 if within search radius
        if (distance !== null && me.search_radius_miles) {
          if (distance <= me.search_radius_miles) {
            preferenceScore += 30;
          }
        } else {
          preferenceScore += 15; // partial credit if no location data
        }

        const compatibility = Math.round(pillarScore * 0.4 + interestScore * 0.3 + preferenceScore * 0.3);

        return {
          ...p,
          shared_recreation: sharedRec,
          shared_interests: sharedGen,
          has_interest_match: hasInterestMatch,
          photos_blurred: !hasInterestMatch, // blur until interest match
          distance_miles: distance,
          show_distance: p.show_distance,
          compatibility,
          compatibilityBreakdown: {
            pillarAlignment: pillarScore,
            interestOverlap: interestScore,
            preferenceMatch: preferenceScore
          }
        };
      }).filter(p => {
        // Filter by search radius if location set
        if (me.search_radius_miles && p.distance_miles !== null) {
          return p.distance_miles <= me.search_radius_miles;
        }
        return true;
      });

      // Sort by compatibility DESC (best matches first)
      enriched.sort((a, b) => b.compatibility - a.compatibility);

      // Return top 20
      const results = enriched.slice(0, 20);

      return res.json({ profiles: results, count: results.length });
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

      // Get both profiles + emails for notifications
      const myFullProfile = await sql`SELECT dp.display_name, c.email, c.first_name FROM dating_profiles dp JOIN contacts c ON c.id = dp.contact_id WHERE dp.id = ${myId}`;
      const theirFullProfile = await sql`SELECT dp.display_name, c.email, c.first_name, dp.contact_id FROM dating_profiles dp JOIN contacts c ON c.id = dp.contact_id WHERE dp.id = ${profile_id}`;

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

          // ===== MATCH NOTIFICATION — Email BOTH people immediately =====
          if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && myFullProfile.length && theirFullProfile.length) {
            try {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
              });

              const matchHtml = (recipientName, matchName) => `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#f0f0f0;border-radius:12px;">
                  <div style="text-align:center;margin-bottom:1.5rem;">
                    <span style="font-size:3rem;">💘</span>
                    <h1 style="color:#D4A847;font-size:1.8rem;margin:0.5rem 0;">It's a Match!</h1>
                  </div>
                  <p style="color:#a0a0a0;text-align:center;font-size:1rem;line-height:1.6;">
                    ${recipientName}, you and <strong style="color:#fff;">${matchName}</strong> both liked each other on Aligned Hearts!
                  </p>
                  <div style="text-align:center;margin:2rem 0;">
                    <a href="https://assessment.valuetovictory.com/faith-match" style="display:inline-block;padding:14px 36px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:8px;font-size:1rem;">Send a Message →</a>
                  </div>
                  <p style="color:#606060;font-size:0.75rem;text-align:center;">Aligned Hearts by Value to Victory — Values-Based Dating</p>
                </div>`;

              // Email to the person who just swiped (me)
              transporter.sendMail({
                from: '"Aligned Hearts" <' + process.env.GMAIL_USER + '>',
                to: myFullProfile[0].email,
                subject: "It's a Match! 💘 You and " + theirFullProfile[0].display_name + " connected",
                html: matchHtml(myFullProfile[0].first_name || myFullProfile[0].display_name, theirFullProfile[0].display_name)
              }).catch(() => {});

              // Email to the other person
              transporter.sendMail({
                from: '"Aligned Hearts" <' + process.env.GMAIL_USER + '>',
                to: theirFullProfile[0].email,
                subject: "It's a Match! 💘 " + myFullProfile[0].display_name + " likes you too",
                html: matchHtml(theirFullProfile[0].first_name || theirFullProfile[0].display_name, myFullProfile[0].display_name)
              }).catch(() => {});
            } catch(e) { console.error('Match notification error:', e.message); }
          }
        } else {
          // ===== LIKE NOTIFICATION — Email the person who was liked =====
          if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && theirFullProfile.length) {
            try {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
              });

              await transporter.sendMail({
                from: '"Aligned Hearts" <' + process.env.GMAIL_USER + '>',
                to: theirFullProfile[0].email,
                subject: "Someone likes you on Aligned Hearts! 💛",
                html: `
                  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#f0f0f0;border-radius:12px;">
                    <div style="text-align:center;margin-bottom:1.5rem;">
                      <span style="font-size:3rem;">💛</span>
                      <h1 style="color:#D4A847;font-size:1.6rem;margin:0.5rem 0;">You've Got an Admirer!</h1>
                    </div>
                    <p style="color:#a0a0a0;text-align:center;font-size:1rem;line-height:1.6;">
                      ${theirFullProfile[0].first_name || theirFullProfile[0].display_name}, someone on Aligned Hearts just liked your profile!
                    </p>
                    <p style="color:#707070;text-align:center;font-size:0.85rem;">Log in to see who it is. If you like them back — it's a match!</p>
                    <div style="text-align:center;margin:2rem 0;">
                      <a href="https://assessment.valuetovictory.com/faith-match" style="display:inline-block;padding:14px 36px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:8px;font-size:1rem;">See Who Likes You →</a>
                    </div>
                    <p style="color:#606060;font-size:0.75rem;text-align:center;">Aligned Hearts by Value to Victory — Values-Based Dating</p>
                  </div>`
              }).catch(() => {});
            } catch(e) { console.error('Like notification error:', e.message); }
          }
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
      if (!match_id) return res.status(400).json({ error: 'match_id required' });
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
      if (!profile_id) return res.status(400).json({ error: 'profile_id required' });
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });
      if (profile_id === myProfile[0].id) return res.status(400).json({ error: 'Cannot block yourself' });

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
      if (!profile_id || !reason) return res.status(400).json({ error: 'profile_id and reason required' });
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

      // ===== MESSAGE NOTIFICATION — Email the recipient =====
      try {
        // Find the other person in the match
        const fullMatch = await sql`SELECT profile_a_id, profile_b_id FROM dating_matches WHERE id = ${match_id}`;
        if (fullMatch.length) {
          const otherProfileId = fullMatch[0].profile_a_id === myProfile[0].id ? fullMatch[0].profile_b_id : fullMatch[0].profile_a_id;
          const otherPerson = await sql`SELECT dp.display_name, c.email, c.first_name FROM dating_profiles dp JOIN contacts c ON c.id = dp.contact_id WHERE dp.id = ${otherProfileId}`;
          const sender = await sql`SELECT display_name FROM dating_profiles WHERE id = ${myProfile[0].id}`;

          // Only send if they have unread messages (don't spam on every message in a conversation)
          const recentNotif = await sql`SELECT id FROM dating_messages WHERE match_id = ${match_id} AND sender_id = ${myProfile[0].id} AND read_at IS NULL AND sent_at > NOW() - INTERVAL '30 minutes'`;

          if (otherPerson.length && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && recentNotif.length <= 1) {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
            });

            transporter.sendMail({
              from: '"Aligned Hearts" <' + process.env.GMAIL_USER + '>',
              to: otherPerson[0].email,
              subject: (sender[0]?.display_name || 'Someone') + " sent you a message 💬",
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#f0f0f0;border-radius:12px;">
                  <div style="text-align:center;margin-bottom:1.5rem;">
                    <span style="font-size:2.5rem;">💬</span>
                    <h1 style="color:#D4A847;font-size:1.4rem;margin:0.5rem 0;">New Message</h1>
                  </div>
                  <p style="color:#a0a0a0;text-align:center;font-size:1rem;line-height:1.6;">
                    ${otherPerson[0].first_name || otherPerson[0].display_name}, <strong style="color:#fff;">${sender[0]?.display_name || 'Your match'}</strong> just sent you a message on Aligned Hearts.
                  </p>
                  <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:1rem;margin:1.5rem 0;text-align:center;">
                    <p style="color:#ccc;font-style:italic;font-size:0.9rem;">"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"</p>
                  </div>
                  <div style="text-align:center;margin:1.5rem 0;">
                    <a href="https://assessment.valuetovictory.com/faith-match" style="display:inline-block;padding:12px 32px;background:#D4A847;color:#000;text-decoration:none;font-weight:bold;border-radius:8px;">Reply Now →</a>
                  </div>
                  <p style="color:#606060;font-size:0.75rem;text-align:center;">Aligned Hearts by Value to Victory</p>
                </div>`
            }).catch(() => {});
          }
        }
      } catch(e) { console.error('Message notification error:', e.message); }

      return res.json({ ok: true });
    }

    // ===== GET MESSAGES =====
    if (path === 'messages' && req.method === 'GET') {
      const matchId = url.searchParams.get('match_id');
      if (!matchId) return res.status(400).json({ error: 'match_id required' });

      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.status(404).json({ error: 'No profile' });

      // Verify the user is a party to this match
      const matchCheck = await sql`
        SELECT id FROM dating_matches
        WHERE id = ${matchId}
          AND (profile_a_id = ${myProfile[0].id} OR profile_b_id = ${myProfile[0].id})
          AND unmatched = false
      `;
      if (!matchCheck.length) return res.status(403).json({ error: 'Not a valid match' });

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

    // ===== UNREAD COUNTS (for notification badges) =====
    if (path === 'unread' && req.method === 'GET') {
      const myProfile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!myProfile.length) return res.json({ unreadMessages: 0, newMatches: 0 });
      const myId = myProfile[0].id;

      // Unread messages: messages in my matches that I haven't read and I didn't send
      const [unreadMsg] = await sql`
        SELECT COUNT(*) as cnt FROM dating_messages m
        JOIN dating_matches dm ON dm.id = m.match_id
        WHERE (dm.profile_a_id = ${myId} OR dm.profile_b_id = ${myId})
          AND dm.unmatched = false
          AND m.sender_id != ${myId}
          AND m.read_at IS NULL
      `;

      // New matches in last 24h
      const [newMatches] = await sql`
        SELECT COUNT(*) as cnt FROM dating_matches
        WHERE (profile_a_id = ${myId} OR profile_b_id = ${myId})
          AND unmatched = false
          AND matched_at > now() - interval '24 hours'
      `;

      return res.json({ unreadMessages: +unreadMsg.cnt, newMatches: +newMatches.cnt });
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

    // ===== UPLOAD PHOTO (Cloudinary CDN or base64 fallback) =====
    if (path === 'upload-photo' && req.method === 'POST') {
      const { photoBase64, photoIndex } = req.body;
      if (photoBase64 === undefined || photoIndex === undefined) {
        return res.status(400).json({ error: 'photoBase64 and photoIndex required' });
      }
      if (typeof photoIndex !== 'number' || photoIndex < 0 || photoIndex > 5) {
        return res.status(400).json({ error: 'photoIndex must be 0-5' });
      }

      // Validate base64 image — must start with data:image/
      if (!photoBase64.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image format. Must be a base64 data URL (data:image/...)' });
      }

      // Check size — base64 is ~33% larger than binary, so 2MB binary ~ 2.67MB base64
      const sizeBytes = Math.ceil((photoBase64.length - photoBase64.indexOf(',') - 1) * 0.75);
      if (sizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Photo must be under 5MB' });
      }

      // Upload to Cloudinary CDN if configured, otherwise store base64
      let photoUrl = photoBase64;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

      if (cloudName && uploadPreset) {
        try {
          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: photoBase64,
              upload_preset: uploadPreset,
              folder: `vtv-dating/${user.contactId}`,
              transformation: 'c_limit,w_800,h_1000,q_auto,f_auto'
            })
          });
          const uploadData = await uploadRes.json();
          if (uploadData.secure_url) {
            photoUrl = uploadData.secure_url;
          } else {
            console.warn('Cloudinary upload failed, falling back to base64:', uploadData.error?.message);
          }
        } catch (cloudErr) {
          console.warn('Cloudinary upload error, falling back to base64:', cloudErr.message);
        }
      }

      // Get current profile
      const profile = await sql`SELECT id, photo_urls FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!profile.length) return res.status(404).json({ error: 'No dating profile found' });

      // Build photos array (up to 6 slots)
      let photos = profile[0].photo_urls || [];
      if (!Array.isArray(photos)) photos = [];
      while (photos.length <= photoIndex) photos.push('');
      photos = photos.slice(0, 6);
      photos[photoIndex] = photoUrl;

      const photosJson = JSON.stringify(photos);
      await sql`
        UPDATE dating_profiles SET photo_urls = ${photosJson}::jsonb, updated_at = now()
        WHERE contact_id = ${user.contactId}
      `;

      return res.json({ ok: true, photos, photoUrl, cdn: photoUrl !== photoBase64, message: 'Photo uploaded' });
    }

    // ===== REMOVE PHOTO =====
    if (path === 'remove-photo' && req.method === 'POST') {
      const { photoIndex } = req.body;
      if (typeof photoIndex !== 'number' || photoIndex < 0 || photoIndex > 5) {
        return res.status(400).json({ error: 'photoIndex must be 0-5' });
      }

      const profile = await sql`SELECT id, photo_urls FROM dating_profiles WHERE contact_id = ${user.contactId}`;
      if (!profile.length) return res.status(404).json({ error: 'No dating profile found' });

      let photos = profile[0].photo_urls || [];
      if (!Array.isArray(photos)) photos = [];
      if (photoIndex < photos.length) {
        photos[photoIndex] = '';
      }

      const photosJson = JSON.stringify(photos);
      await sql`
        UPDATE dating_profiles SET photo_urls = ${photosJson}::jsonb, updated_at = now()
        WHERE contact_id = ${user.contactId}
      `;

      return res.json({ ok: true, photos, message: 'Photo removed' });
    }

    // =========================================================
    // ADMIN MODERATION ENDPOINTS (require x-api-key header)
    // =========================================================
    const apiKey = req.headers['x-api-key'] || '';
    const validKey = process.env.ADMIN_API_KEY || '';
    const isAdmin = validKey && apiKey === validKey;

    // ===== GET REPORTS (admin) =====
    if (path === 'admin/reports' && req.method === 'GET' && isAdmin) {
      const status = url.searchParams.get('status') || 'pending';
      const reports = await sql`
        SELECT dr.*,
               rp.display_name as reporter_name, rp.photo_urls as reporter_photos,
               dp.display_name as reported_name, dp.photo_urls as reported_photos,
               dp.bio as reported_bio, dp.contact_id as reported_contact_id
        FROM dating_reports dr
        JOIN dating_profiles rp ON rp.id = dr.reporter_id
        JOIN dating_profiles dp ON dp.id = dr.reported_id
        WHERE dr.status = ${status}
        ORDER BY dr.created_at DESC
        LIMIT 50
      `;
      return res.json({ reports, count: reports.length });
    }

    // ===== UPDATE REPORT STATUS (admin) =====
    if (path === 'admin/report-action' && req.method === 'POST' && isAdmin) {
      const { report_id, action, reason } = req.body;
      if (!report_id || !action) return res.status(400).json({ error: 'report_id and action required' });

      if (action === 'dismiss') {
        await sql`UPDATE dating_reports SET status = 'dismissed' WHERE id = ${report_id}`;
        return res.json({ ok: true, action: 'dismissed' });
      }

      if (action === 'warn') {
        await sql`UPDATE dating_reports SET status = 'warned' WHERE id = ${report_id}`;
        return res.json({ ok: true, action: 'warned' });
      }

      if (action === 'suspend') {
        const report = await sql`SELECT reported_id FROM dating_reports WHERE id = ${report_id}`;
        if (report.length) {
          await sql`UPDATE dating_profiles SET is_active = false WHERE id = ${report[0].reported_id}`;
          await sql`UPDATE dating_reports SET status = 'suspended' WHERE id = ${report_id}`;
        }
        return res.json({ ok: true, action: 'suspended' });
      }

      if (action === 'ban') {
        const report = await sql`SELECT reported_id FROM dating_reports WHERE id = ${report_id}`;
        if (report.length) {
          await sql`UPDATE dating_profiles SET is_active = false WHERE id = ${report[0].reported_id}`;
          await sql`UPDATE dating_reports SET status = 'banned' WHERE id = ${report_id}`;
          // Also add to blocks from all users who reported
          const allReports = await sql`SELECT DISTINCT reporter_id FROM dating_reports WHERE reported_id = ${report[0].reported_id}`;
          for (const r of allReports) {
            await sql`INSERT INTO dating_blocks (blocker_id, blocked_id, reason) VALUES (${r.reporter_id}, ${report[0].reported_id}, ${reason || 'admin_ban'}) ON CONFLICT DO NOTHING`;
          }
        }
        return res.json({ ok: true, action: 'banned' });
      }

      return res.status(400).json({ error: 'Invalid action. Use: dismiss, warn, suspend, ban' });
    }

    // ===== GET ALL DATING PROFILES (admin) =====
    if (path === 'admin/profiles' && req.method === 'GET' && isAdmin) {
      const profiles = await sql`
        SELECT dp.*, c.email, c.first_name, c.last_name,
               (SELECT COUNT(*) FROM dating_reports WHERE reported_id = dp.id AND status = 'pending') as pending_reports,
               (SELECT COUNT(*) FROM dating_matches WHERE (profile_a_id = dp.id OR profile_b_id = dp.id) AND unmatched = false) as match_count,
               (SELECT COUNT(*) FROM dating_swipes WHERE swiper_id = dp.id AND direction = 'right') as likes_given,
               (SELECT COUNT(*) FROM dating_swipes WHERE swiped_id = dp.id AND direction = 'right') as likes_received
        FROM dating_profiles dp
        JOIN contacts c ON c.id = dp.contact_id
        ORDER BY dp.created_at DESC
        LIMIT 100
      `;
      return res.json({ profiles, count: profiles.length });
    }

    // ===== DATING STATS (admin) =====
    if (path === 'admin/stats' && req.method === 'GET' && isAdmin) {
      const [totalProfiles] = await sql`SELECT COUNT(*) as cnt FROM dating_profiles`;
      const [activeProfiles] = await sql`SELECT COUNT(*) as cnt FROM dating_profiles WHERE is_active = true`;
      const [totalMatches] = await sql`SELECT COUNT(*) as cnt FROM dating_matches WHERE unmatched = false`;
      const [totalMessages] = await sql`SELECT COUNT(*) as cnt FROM dating_messages`;
      const [pendingReports] = await sql`SELECT COUNT(*) as cnt FROM dating_reports WHERE status = 'pending'`;
      const [paidUsers] = await sql`SELECT COUNT(*) as cnt FROM dating_profiles WHERE is_paid = true`;
      const [trialUsers] = await sql`SELECT COUNT(*) as cnt FROM dating_profiles WHERE is_paid = false AND trial_ends > now()`;
      const recentSignups = await sql`SELECT id, display_name, gender, created_at FROM dating_profiles ORDER BY created_at DESC LIMIT 10`;

      return res.json({
        totalProfiles: +totalProfiles.cnt,
        activeProfiles: +activeProfiles.cnt,
        totalMatches: +totalMatches.cnt,
        totalMessages: +totalMessages.cnt,
        pendingReports: +pendingReports.cnt,
        paidUsers: +paidUsers.cnt,
        trialUsers: +trialUsers.cnt,
        recentSignups
      });
    }

    // ===== DELETE ACCOUNT (GDPR + Play Store requirement) =====
    if (path === 'delete-account' && req.method === 'DELETE') {
      const contactId = user.contactId;

      // Get profile ID for cascading deletes
      const profile = await sql`SELECT id FROM dating_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (profile.length) {
        const profileId = profile[0].id;
        // Delete in order (child records first)
        await sql`DELETE FROM dating_messages WHERE sender_id = ${profileId}`;
        await sql`DELETE FROM dating_messages WHERE match_id IN (SELECT id FROM dating_matches WHERE profile_a_id = ${profileId} OR profile_b_id = ${profileId})`;
        await sql`DELETE FROM dating_matches WHERE profile_a_id = ${profileId} OR profile_b_id = ${profileId}`;
        await sql`DELETE FROM dating_swipes WHERE swiper_id = ${profileId} OR swiped_id = ${profileId}`;
        await sql`DELETE FROM dating_blocks WHERE blocker_id = ${profileId} OR blocked_id = ${profileId}`;
        await sql`DELETE FROM dating_reports WHERE reporter_id = ${profileId} OR reported_id = ${profileId}`;
        await sql`DELETE FROM dating_profiles WHERE id = ${profileId}`;
      }

      // Delete email verification
      try { await sql`DELETE FROM dating_email_verify WHERE contact_id = ${contactId}`; } catch {}

      console.log(`[dating] Account deleted: contact ${contactId}`);
      return res.json({ success: true, message: 'Your dating profile and all associated data have been permanently deleted.' });
    }

    // ===== PHOTO MODERATION: Flag photo for review =====
    if (path === 'admin/flag-photo' && req.method === 'POST' && isAdmin) {
      const { profileId, photoIndex, reason } = req.body;
      if (!profileId) return res.status(400).json({ error: 'profileId required' });

      // Get profile photos
      const rows = await sql`SELECT photo_urls FROM dating_profiles WHERE id = ${profileId}`;
      if (!rows.length) return res.status(404).json({ error: 'Profile not found' });

      const photos = rows[0].photo_urls || [];
      if (photoIndex !== undefined && photoIndex < photos.length) {
        photos[photoIndex] = null; // Remove flagged photo
        const photoJson = JSON.stringify(photos);
        await sql`UPDATE dating_profiles SET photo_urls = ${photoJson}::jsonb WHERE id = ${profileId}`;
      }

      // Log the moderation action
      try {
        await sql`INSERT INTO dating_reports (reporter_id, reported_id, reason, details, status)
          VALUES (0, ${profileId}, 'photo_moderation', ${reason || 'Photo flagged by admin'}, 'resolved')`;
      } catch {}

      return res.json({ success: true, message: 'Photo removed and logged' });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    console.error('Dating API error:', path, err.message || err);
    return res.status(500).json({ error: 'Server error', detail: err.message, path });
  }
};
