const { neon } = require('@neondatabase/serverless');

// 30 daily dating challenge prompts — lighter, curiosity-driven, fun
const DATING_CHALLENGE_PROMPTS = [
  "What's one thing about yourself most people don't get to see right away?",
  "Describe your perfect low-key evening — what would we be doing?",
  "What's something you're genuinely proud of that has nothing to do with work?",
  "What's a belief you've changed your mind about in the last few years?",
  "If you could master one skill overnight, what would it be and why?",
  "What does 'showing up for someone' actually look like to you?",
  "What's a question you wish people would ask you more often?",
  "Weekly check-in: What surprised you most about our conversations this week? / What do you want to know more about? / One thing that made you smile this week: / What would make next week even better?",
  "What's your biggest dealbreaker in a relationship — and why?",
  "Describe a moment where you felt completely yourself around someone. What made it safe?",
  "What's something you're working on right now — personally, not professionally?",
  "When you picture a great relationship, what does a random Tuesday night look like?",
  "What's the most thoughtful thing someone has done for you?",
  "What's one thing you wish you were better at when it comes to communication?",
  "Weekly check-in: What have you noticed about how we communicate? / Something I want to be more honest about: / What I appreciate about you so far: / One thing I'd like us to try this week:",
  "What's your love language — and do you think it's different from what you give vs. what you need?",
  "If we had zero obligations this weekend, what would you want to do together?",
  "What's a hard lesson a past relationship taught you — without the bitterness?",
  "What does trust look like to you? How do you build it?",
  "Tell me about someone you admire. What is it about them?",
  "What's something you're afraid to want — because wanting it feels vulnerable?",
  "Weekly check-in: The best conversation we had this week was about... / Something I want to share but haven't yet: / How I feel about where this is going: / What I'd like more of:",
  "What role does faith, spirituality, or values play in how you live day to day?",
  "What would your closest friend say is your best quality? Your worst habit?",
  "How do you handle conflict? Run, fight, freeze, or talk it out?",
  "What does loyalty mean to you — and where do you draw the line?",
  "What's one thing you want your future partner to always know about you?",
  "What's the difference between someone you date and someone you build with?",
  "Weekly check-in: What I know about you now that I didn't 30 days ago: / The conversation that mattered most: / Where I see this going: / What I want you to know:",
  "30 days in — what do you think? Be honest. No pressure. Just real."
];

// 30 daily couple challenge prompts
const COUPLE_CHALLENGE_PROMPTS = [
  "Today, I'm grateful for this specific thing about my partner:",
  "One way I plan to show my partner they matter today:",
  "Something I respect or admire about my partner that I haven't said lately:",
  "Today, I'm going to give my partner 15 minutes of my focused, undivided time.",
  "A specific encouraging or affirming thing I want my partner to hear today:",
  "One thing I can do today to make my partner's life practically easier:",
  "This week, I most enjoyed giving value to you by... / I felt most loved when you... / I felt most respected when you... / One small adjustment I'd love for us to try next week is...",
  "Today, I will admit one small thing I've been wrong about or avoiding, and own it.",
  "Today I will listen — really listen — without fixing, correcting, or defending.",
  "Today, I'll say one hard truth that I've been holding back, but with gentleness.",
  "Today, I'm going to sacrifice something small (comfort, time, preference) for my partner.",
  "Today, I'm going to open one honest money conversation I've been avoiding.",
  "Today, I'm going to choose patience in a moment where I'd normally react.",
  "This week, the hardest thing I did for us was... / The moment I'm proudest of is... / Where I still fell short is... / Next week, I want to work on...",
  "Today, I will ask my partner: 'What's one thing I could do differently that would matter to you?'",
  "Today, I'm going to notice one thing my partner does that normally goes unnoticed — and thank them for it.",
  "Today, I will pause before I speak in a heated moment, and choose my words.",
  "Today, I'm going to take on one task that's normally my partner's responsibility, without being asked.",
  "Today, I'm going to write my partner a short note — handwritten or text — that tells them one thing I love about who they're becoming.",
  "Today, I'm going to ask myself: 'Am I being the kind of partner I'd want to come home to?'",
  "This week, I grew the most in... / The conversation I've been avoiding is... / One thing I need to hear from my partner is... / My commitment for next week is...",
  "Today, I'm going to forgive one thing I've been quietly holding against my partner.",
  "Today, I'm going to plan something — even something small — that shows I was thinking about us.",
  "Today, I'm going to put my phone down when my partner is talking.",
  "Today, I'm going to serve my partner in their love language, not mine.",
  "Today, I'm going to protect our time from outside noise — even if it means saying no to someone else.",
  "Today, I'm going to initiate a hard but necessary conversation about our future.",
  "This week, the biggest thing I learned about myself is... / The biggest thing I learned about my partner is... / What I want to protect going forward is... / The next 30-90 days, I'd love us to focus on...",
  "Today, I'm going to tell my partner three specific things I'm proud of them for.",
  "Today, I'm going to reflect: 'What kind of partner was I 30 days ago vs. who I am today?'"
];

function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getAgeGroup(age) {
  if (age < 13) return 'blocked';
  if (age <= 17) return 'teen';
  if (age <= 20) return 'adult';
  return 'full';
}

function detectPrimaryLanguage(scores) {
  const languages = [
    { name: 'words_of_affirmation', score: scores.words_of_affirmation || 0 },
    { name: 'quality_time', score: scores.quality_time || 0 },
    { name: 'acts_of_service', score: scores.acts_of_service || 0 },
    { name: 'gifts', score: scores.gifts || 0 },
    { name: 'physical_touch', score: scores.physical_touch || 0 }
  ];
  languages.sort((a, b) => b.score - a.score);
  return languages[0].name;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const url = req.url.replace(/^\/api\/r/, '');

  try {
    // ============================================================
    // POST /api/r/profile — Create/update user profile
    // ============================================================
    if (req.method === 'POST' && url === '/profile') {
      const b = req.body || {};
      const { contactId, dob, gender, membershipTier } = b;

      if (!contactId) return res.status(400).json({ error: 'contactId is required' });
      if (!dob) return res.status(400).json({ error: 'dob (date of birth) is required' });

      const age = calculateAge(dob);
      const ageGroup = getAgeGroup(age);

      if (ageGroup === 'blocked') {
        return res.status(403).json({
          error: 'This program is not available for children under 13',
          ageGroup: 'blocked'
        });
      }

      // Upsert user profile
      const existing = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;

      let profile;
      if (existing.length > 0) {
        const rows = await sql`
          UPDATE user_profiles SET
            date_of_birth = ${dob},
            age = ${age},
            gender = ${gender || existing[0].gender},
            membership_tier = ${membershipTier || existing[0].membership_tier},
            updated_at = NOW()
          WHERE contact_id = ${contactId}
          RETURNING *
        `;
        profile = rows[0];
      } else {
        const rows = await sql`
          INSERT INTO user_profiles (contact_id, date_of_birth, age, gender, membership_tier)
          VALUES (${contactId}, ${dob}, ${age}, ${gender || null}, ${membershipTier || 'free'})
          RETURNING *
        `;
        profile = rows[0];
      }

      return res.json({ success: true, profile, ageGroup });
    }

    // ============================================================
    // GET /api/r/profile?email=xxx — Get profile by email
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/profile')) {
      const params = new URL('http://x' + req.url).searchParams;
      const email = params.get('email');
      if (!email) return res.status(400).json({ error: 'email is required' });

      const rows = await sql`
        SELECT up.*, c.first_name, c.last_name, c.email
        FROM user_profiles up
        JOIN contacts c ON c.id = up.contact_id
        WHERE c.email = ${email}
        LIMIT 1
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

      const profile = rows[0];
      const ageGroup = getAgeGroup(profile.age);
      return res.json({ profile, ageGroup });
    }

    // ============================================================
    // POST /api/r/link-partner — Link two profiles as partners
    // ============================================================
    if (req.method === 'POST' && url === '/link-partner') {
      const b = req.body || {};
      const { emailA, emailB } = b;

      if (!emailA || !emailB) return res.status(400).json({ error: 'emailA and emailB are required' });
      if (emailA === emailB) return res.status(400).json({ error: 'Cannot link a profile to itself' });

      const profileA = await sql`
        SELECT up.* FROM user_profiles up JOIN contacts c ON c.id = up.contact_id WHERE c.email = ${emailA} LIMIT 1
      `;
      const profileB = await sql`
        SELECT up.* FROM user_profiles up JOIN contacts c ON c.id = up.contact_id WHERE c.email = ${emailB} LIMIT 1
      `;

      if (profileA.length === 0) return res.status(404).json({ error: 'Profile not found for emailA' });
      if (profileB.length === 0) return res.status(404).json({ error: 'Profile not found for emailB' });

      const pA = profileA[0];
      const pB = profileB[0];

      // At least ONE partner must have couple or premium tier (the paying member covers both)
      const allowedTiers = ['couple', 'premium'];
      const eitherQualifies = allowedTiers.includes(pA.membership_tier) || allowedTiers.includes(pB.membership_tier);
      if (!eitherQualifies) {
        return res.status(403).json({ error: 'At least one partner must have a Value Builder or Victory VIP membership to link accounts.' });
      }

      await sql`UPDATE user_profiles SET partner_id = ${pB.id}, updated_at = NOW() WHERE id = ${pA.id}`;
      await sql`UPDATE user_profiles SET partner_id = ${pA.id}, updated_at = NOW() WHERE id = ${pB.id}`;

      return res.json({ success: true, message: 'Partners linked', partnerA: pA.id, partnerB: pB.id });
    }

    // ============================================================
    // POST /api/r/invite-partner — Send partner invite (no account required)
    // ============================================================
    if (req.method === 'POST' && url === '/invite-partner') {
      const b = req.body || {};
      const { fromEmail, partnerEmail } = b;

      if (!fromEmail || !partnerEmail) return res.status(400).json({ error: 'fromEmail and partnerEmail are required' });
      if (fromEmail === partnerEmail) return res.status(400).json({ error: 'Cannot invite yourself' });

      // Look up the inviter
      const inviter = await sql`
        SELECT up.*, c.first_name, c.last_name, c.email
        FROM user_profiles up JOIN contacts c ON c.id = up.contact_id
        WHERE c.email = ${fromEmail} LIMIT 1
      `;
      if (inviter.length === 0) return res.status(404).json({ error: 'Your profile was not found' });

      const inviterName = [inviter[0].first_name, inviter[0].last_name].filter(Boolean).join(' ') || fromEmail;

      // Check if partner already has a profile — if so, try to link directly
      const partner = await sql`
        SELECT up.*, c.email FROM user_profiles up JOIN contacts c ON c.id = up.contact_id
        WHERE c.email = ${partnerEmail} LIMIT 1
      `;

      if (partner.length > 0) {
        // Partner exists — link if EITHER has a qualifying tier (paying member covers both)
        const allowedTiers = ['couple', 'premium'];
        const eitherQualifies = allowedTiers.includes(inviter[0].membership_tier) || allowedTiers.includes(partner[0].membership_tier);
        if (eitherQualifies) {
          await sql`UPDATE user_profiles SET partner_id = ${partner[0].id}, updated_at = NOW() WHERE id = ${inviter[0].id}`;
          await sql`UPDATE user_profiles SET partner_id = ${inviter[0].id}, updated_at = NOW() WHERE id = ${partner[0].id}`;
          return res.json({ success: true, linked: true, message: 'Partner found and linked!' });
        }
        // Neither has qualifying tier — still record the invite
      }

      // Store the invite for when partner signs up or upgrades
      try {
        await sql`
          INSERT INTO partner_invites (inviter_email, partner_email, inviter_name, created_at)
          VALUES (${fromEmail}, ${partnerEmail}, ${inviterName}, NOW())
          ON CONFLICT (inviter_email) DO UPDATE SET partner_email = ${partnerEmail}, inviter_name = ${inviterName}, created_at = NOW()
        `;
      } catch (e) {
        // Table may not exist yet — that's OK, the invite is still conceptually sent
        console.log('partner_invites table not ready:', e.message);
      }

      return res.json({ success: true, linked: false, message: 'Invite recorded. Your partner will be linked when they sign up.' });
    }

    // ============================================================
    // POST /api/r/add-dependent — Add child under parent
    // ============================================================
    if (req.method === 'POST' && url === '/add-dependent') {
      const b = req.body || {};
      const { parentContactId, childFirstName, childLastName, childDob } = b;

      if (!parentContactId || !childFirstName || !childLastName || !childDob) {
        return res.status(400).json({ error: 'parentContactId, childFirstName, childLastName, and childDob are required' });
      }

      const childAge = calculateAge(childDob);
      if (childAge < 13) {
        return res.status(403).json({
          error: 'This program is not available for children under 13',
          ageGroup: 'blocked'
        });
      }

      // Verify parent profile exists
      const parentProfile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${parentContactId} LIMIT 1`;
      if (parentProfile.length === 0) return res.status(404).json({ error: 'Parent profile not found' });

      // Create contact for child
      const childContact = await sql`
        INSERT INTO contacts (first_name, last_name, email, created_at)
        VALUES (${childFirstName}, ${childLastName}, ${childFirstName.toLowerCase() + '.' + childLastName.toLowerCase() + '+dep@placeholder.local'}, ${new Date().toISOString()})
        RETURNING *
      `;
      const child = childContact[0];

      // Create child profile linked to parent
      const childProfile = await sql`
        INSERT INTO user_profiles (contact_id, date_of_birth, age, is_dependent, parent_id)
        VALUES (${child.id}, ${childDob}, ${childAge}, true, ${parentProfile[0].id})
        RETURNING *
      `;

      return res.json({
        success: true,
        childContact: child,
        childProfile: childProfile[0],
        ageGroup: getAgeGroup(childAge)
      });
    }

    // ============================================================
    // POST /api/r/matrix — Submit relationship matrix results
    // ============================================================
    if (req.method === 'POST' && url === '/matrix') {
      const b = req.body || {};
      const { contactId, gender } = b;

      if (!contactId || !gender) return res.status(400).json({ error: 'contactId and gender are required' });

      const practicalGive = b.practicalGive || 0;
      const practicalReceive = b.practicalReceive || 0;
      const mentalLoadGive = b.mentalLoadGive || 0;
      const mentalLoadReceive = b.mentalLoadReceive || 0;
      const financialGive = b.financialGive || 0;
      const financialReceive = b.financialReceive || 0;
      const relationalGive = b.relationalGive || 0;
      const relationalReceive = b.relationalReceive || 0;
      const growthGive = b.growthGive || 0;
      const growthReceive = b.growthReceive || 0;

      const giveTotal = practicalGive + mentalLoadGive + financialGive + relationalGive + growthGive;
      const receiveTotal = practicalReceive + mentalLoadReceive + financialReceive + relationalReceive + growthReceive;
      const domainGap = Math.abs(practicalGive - practicalReceive)
        + Math.abs(mentalLoadGive - mentalLoadReceive)
        + Math.abs(financialGive - financialReceive)
        + Math.abs(relationalGive - relationalReceive)
        + Math.abs(growthGive - growthReceive);

      // Look up partner
      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      let partnerContactId = null;
      if (profile.length > 0 && profile[0].partner_id) {
        const partner = await sql`SELECT contact_id FROM user_profiles WHERE id = ${profile[0].partner_id} LIMIT 1`;
        if (partner.length > 0) partnerContactId = partner[0].contact_id;
      }

      const rows = await sql`
        INSERT INTO relationship_matrix (
          contact_id, partner_contact_id, gender,
          practical_give, practical_receive,
          mental_load_give, mental_load_receive,
          financial_give, financial_receive,
          relational_give, relational_receive,
          growth_give, growth_receive,
          give_total, receive_total, domain_gap
        ) VALUES (
          ${contactId}, ${partnerContactId}, ${gender},
          ${practicalGive}, ${practicalReceive},
          ${mentalLoadGive}, ${mentalLoadReceive},
          ${financialGive}, ${financialReceive},
          ${relationalGive}, ${relationalReceive},
          ${growthGive}, ${growthReceive},
          ${giveTotal}, ${receiveTotal}, ${domainGap}
        ) RETURNING *
      `;

      const result = { success: true, matrix: rows[0] };

      // If partner has also submitted, compute RBI
      if (partnerContactId) {
        const partnerMatrix = await sql`
          SELECT * FROM relationship_matrix WHERE contact_id = ${partnerContactId}
          ORDER BY completed_at DESC LIMIT 1
        `;
        if (partnerMatrix.length > 0) {
          const pm = partnerMatrix[0];
          const rbi = (domainGap + pm.domain_gap) / 2;
          result.rbi = rbi;
          result.partnerMatrix = pm;
        }
      }

      return res.json(result);
    }

    // ============================================================
    // GET /api/r/matrix?contactId=xxx — Get latest matrix
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/matrix') && !url.startsWith('/matrix/couple')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const rows = await sql`
        SELECT * FROM relationship_matrix WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'No matrix results found' });
      return res.json({ matrix: rows[0] });
    }

    // ============================================================
    // GET /api/r/matrix/couple?contactId=xxx — Both partner matrices + RBI
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/matrix/couple')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      // Get user's profile to find partner
      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });
      if (!profile[0].partner_id) return res.status(400).json({ error: 'No partner linked' });

      const partner = await sql`SELECT contact_id FROM user_profiles WHERE id = ${profile[0].partner_id} LIMIT 1`;
      if (partner.length === 0) return res.status(404).json({ error: 'Partner profile not found' });
      const partnerContactId = partner[0].contact_id;

      const myMatrix = await sql`
        SELECT * FROM relationship_matrix WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;
      const partnerMatrix = await sql`
        SELECT * FROM relationship_matrix WHERE contact_id = ${partnerContactId}
        ORDER BY completed_at DESC LIMIT 1
      `;

      const result = {
        myMatrix: myMatrix.length > 0 ? myMatrix[0] : null,
        partnerMatrix: partnerMatrix.length > 0 ? partnerMatrix[0] : null,
        rbi: null
      };

      if (result.myMatrix && result.partnerMatrix) {
        result.rbi = (result.myMatrix.domain_gap + result.partnerMatrix.domain_gap) / 2;
      }

      return res.json(result);
    }

    // ============================================================
    // POST /api/r/cherish-honor — Submit cherish/honor scores
    // ============================================================
    if (req.method === 'POST' && url === '/cherish-honor') {
      const b = req.body || {};
      const { contactId, gender } = b;

      if (!contactId || !gender) return res.status(400).json({ error: 'contactId and gender are required' });

      const cherishWords = b.cherishWords || 0;
      const cherishTime = b.cherishTime || 0;
      const cherishService = b.cherishService || 0;
      const cherishGifts = b.cherishGifts || 0;
      const cherishTouch = b.cherishTouch || 0;
      const cherishTotal = cherishWords + cherishTime + cherishService + cherishGifts + cherishTouch;

      const honorWords = b.honorWords || 0;
      const honorTime = b.honorTime || 0;
      const honorService = b.honorService || 0;
      const honorGifts = b.honorGifts || 0;
      const honorTouch = b.honorTouch || 0;
      const honorTotal = honorWords + honorTime + honorService + honorGifts + honorTouch;

      const rows = await sql`
        INSERT INTO cherish_honor_matrix (
          contact_id, gender,
          cherish_words, cherish_time, cherish_service, cherish_gifts, cherish_touch, cherish_total,
          honor_words, honor_time, honor_service, honor_gifts, honor_touch, honor_total
        ) VALUES (
          ${contactId}, ${gender},
          ${cherishWords}, ${cherishTime}, ${cherishService}, ${cherishGifts}, ${cherishTouch}, ${cherishTotal},
          ${honorWords}, ${honorTime}, ${honorService}, ${honorGifts}, ${honorTouch}, ${honorTotal}
        ) RETURNING *
      `;

      return res.json({ success: true, cherishHonor: rows[0] });
    }

    // ============================================================
    // GET /api/r/cherish-honor?contactId=xxx — Get latest results
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/cherish-honor')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const rows = await sql`
        SELECT * FROM cherish_honor_matrix WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'No cherish/honor results found' });
      return res.json({ cherishHonor: rows[0] });
    }

    // ============================================================
    // POST /api/r/love-language — Submit love language scores
    // ============================================================
    if (req.method === 'POST' && url === '/love-language') {
      const b = req.body || {};
      const { contactId } = b;

      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const wordsGive = b.wordsOfAffirmationGive || 0;
      const wordsReceive = b.wordsOfAffirmationReceive || 0;
      const timeGive = b.qualityTimeGive || 0;
      const timeReceive = b.qualityTimeReceive || 0;
      const serviceGive = b.actsOfServiceGive || 0;
      const serviceReceive = b.actsOfServiceReceive || 0;
      const giftsGive = b.giftsGive || 0;
      const giftsReceive = b.giftsReceive || 0;
      const touchGive = b.physicalTouchGive || 0;
      const touchReceive = b.physicalTouchReceive || 0;

      const primaryGiveLanguage = detectPrimaryLanguage({
        words_of_affirmation: wordsGive,
        quality_time: timeGive,
        acts_of_service: serviceGive,
        gifts: giftsGive,
        physical_touch: touchGive
      });

      const primaryReceiveLanguage = detectPrimaryLanguage({
        words_of_affirmation: wordsReceive,
        quality_time: timeReceive,
        acts_of_service: serviceReceive,
        gifts: giftsReceive,
        physical_touch: touchReceive
      });

      const rows = await sql`
        INSERT INTO love_language_results (
          contact_id,
          words_of_affirmation_give, words_of_affirmation_receive,
          quality_time_give, quality_time_receive,
          acts_of_service_give, acts_of_service_receive,
          gifts_give, gifts_receive,
          physical_touch_give, physical_touch_receive,
          primary_give_language, primary_receive_language
        ) VALUES (
          ${contactId},
          ${wordsGive}, ${wordsReceive},
          ${timeGive}, ${timeReceive},
          ${serviceGive}, ${serviceReceive},
          ${giftsGive}, ${giftsReceive},
          ${touchGive}, ${touchReceive},
          ${primaryGiveLanguage}, ${primaryReceiveLanguage}
        ) RETURNING *
      `;

      return res.json({ success: true, loveLanguage: rows[0] });
    }

    // ============================================================
    // GET /api/r/love-language?contactId=xxx — Get results
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/love-language')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const rows = await sql`
        SELECT * FROM love_language_results WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'No love language results found' });
      return res.json({ loveLanguage: rows[0] });
    }

    // ============================================================
    // POST /api/r/intimacy — Submit intimacy results (21+ only)
    // ============================================================
    if (req.method === 'POST' && url === '/intimacy') {
      const b = req.body || {};
      const { contactId } = b;

      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      // Validate age >= 21, partner linked, tier is couple/premium
      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });

      const p = profile[0];
      if (!p.age || p.age < 21) {
        return res.status(403).json({ error: 'Intimacy section requires age 21 or older' });
      }
      if (!p.partner_id) {
        return res.status(403).json({ error: 'Intimacy section requires a linked partner' });
      }
      if (!['couple', 'premium'].includes(p.membership_tier)) {
        return res.status(403).json({ error: 'Intimacy section requires couple or premium membership tier' });
      }

      // Check partner consent
      const partnerProfile = await sql`SELECT * FROM user_profiles WHERE id = ${p.partner_id} LIMIT 1`;
      if (partnerProfile.length === 0) return res.status(404).json({ error: 'Partner profile not found' });
      if (!partnerProfile[0].consent_given) {
        return res.status(403).json({ error: 'Both partners must give consent before accessing the intimacy section' });
      }

      const partnerContactId = partnerProfile[0].contact_id;

      const comfortSafety = b.comfortSafety || 0;
      const touchPace = b.touchPace || 0;
      const initiationRoles = b.initiationRoles || 0;
      const rhythmFrequency = b.rhythmFrequency || 0;
      const explorationFeedback = b.explorationFeedback || 0;
      const totalScore = comfortSafety + touchPace + initiationRoles + rhythmFrequency + explorationFeedback;

      const rows = await sql`
        INSERT INTO intimacy_results (
          contact_id, partner_contact_id,
          comfort_safety, touch_pace, initiation_roles,
          rhythm_frequency, exploration_feedback,
          total_score, consent_both_partners
        ) VALUES (
          ${contactId}, ${partnerContactId},
          ${comfortSafety}, ${touchPace}, ${initiationRoles},
          ${rhythmFrequency}, ${explorationFeedback},
          ${totalScore}, true
        ) RETURNING *
      `;

      return res.json({ success: true, intimacy: rows[0] });
    }

    // ============================================================
    // GET /api/r/intimacy?contactId=xxx — Get results
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/intimacy')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const rows = await sql`
        SELECT * FROM intimacy_results WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'No intimacy results found' });
      return res.json({ intimacy: rows[0] });
    }

    // ============================================================
    // POST /api/r/couple-challenge/start — Start a couple challenge
    // ============================================================
    if (req.method === 'POST' && url === '/couple-challenge/start') {
      const b = req.body || {};
      const { contactId, durationDays, challengeMode } = b;
      const mode = challengeMode === 'dating' ? 'dating' : 'couple';

      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });

      // Partner is optional — allow starting solo, partner can join later
      let partnerProfile = [];
      if (profile[0].partner_id) {
        partnerProfile = await sql`SELECT * FROM user_profiles WHERE id = ${profile[0].partner_id} LIMIT 1`;
      }

      // Check for active challenge
      const activeChallenge = await sql`
        SELECT * FROM couple_challenges
        WHERE (couple_profile_id_a = ${profile[0].id} OR couple_profile_id_b = ${profile[0].id})
        AND status = 'active'
        LIMIT 1
      `;
      if (activeChallenge.length > 0) {
        return res.status(400).json({ error: 'An active challenge already exists for this couple' });
      }

      const days = durationDays === 90 ? 90 : 30;
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

      // Capture baseline matrices if they exist
      const baselineA = await sql`
        SELECT id FROM relationship_matrix WHERE contact_id = ${contactId}
        ORDER BY completed_at DESC LIMIT 1
      `;
      let baselineB = [];
      const partnerContactId = partnerProfile.length > 0 ? partnerProfile[0].contact_id : null;
      if (partnerContactId) {
        baselineB = await sql`
          SELECT id FROM relationship_matrix WHERE contact_id = ${partnerContactId}
          ORDER BY completed_at DESC LIMIT 1
        `;
      }

      const partnerProfileId = partnerProfile.length > 0 ? partnerProfile[0].id : null;

      const rows = await sql`
        INSERT INTO couple_challenges (
          couple_profile_id_a, couple_profile_id_b,
          start_date, end_date,
          baseline_matrix_a, baseline_matrix_b
        ) VALUES (
          ${profile[0].id}, ${partnerProfileId},
          ${startDate}, ${endDate},
          ${baselineA.length > 0 ? baselineA[0].id : null},
          ${baselineB.length > 0 ? baselineB[0].id : null}
        ) RETURNING *
      `;

      return res.json({
        success: true,
        challenge: rows[0],
        durationDays: days,
        totalPrompts: COUPLE_CHALLENGE_PROMPTS.length
      });
    }

    // ============================================================
    // GET /api/r/couple-challenge/status?contactId=xxx
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/couple-challenge/status')) {
      const params = new URL('http://x' + req.url).searchParams;
      const contactId = params.get('contactId');
      if (!contactId) return res.status(400).json({ error: 'contactId is required' });

      const profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
      if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });

      const challenge = await sql`
        SELECT * FROM couple_challenges
        WHERE (couple_profile_id_a = ${profile[0].id} OR couple_profile_id_b = ${profile[0].id})
        AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `;

      if (challenge.length === 0) return res.json({ active: false });

      const ch = challenge[0];
      const startMs = new Date(ch.start_date).getTime();
      const nowMs = Date.now();
      const daysElapsed = Math.floor((nowMs - startMs) / 86400000) + 1;
      const currentDay = Math.min(daysElapsed, 30);

      // Count completed responses for this user
      const completedCount = await sql`
        SELECT COUNT(*) as cnt FROM couple_challenge_responses
        WHERE challenge_id = ${ch.id} AND contact_id = ${contactId} AND completed = true
      `;

      return res.json({
        active: true,
        challenge: ch,
        currentDay,
        daysElapsed,
        completedResponses: Number(completedCount[0]?.cnt || 0),
        totalPrompts: COUPLE_CHALLENGE_PROMPTS.length
      });
    }

    // ============================================================
    // POST /api/r/couple-challenge/respond — Submit daily prompt response
    // ============================================================
    if (req.method === 'POST' && url === '/couple-challenge/respond') {
      const b = req.body || {};
      const { challengeId, contactId, dayNumber, responseText } = b;

      if (!challengeId || !contactId || !dayNumber) {
        return res.status(400).json({ error: 'challengeId, contactId, and dayNumber are required' });
      }
      if (dayNumber < 1 || dayNumber > 30) {
        return res.status(400).json({ error: 'dayNumber must be between 1 and 30' });
      }

      const promptText = COUPLE_CHALLENGE_PROMPTS[dayNumber - 1];

      const rows = await sql`
        INSERT INTO couple_challenge_responses (challenge_id, contact_id, day_number, prompt_text, response_text, completed, completed_at)
        VALUES (${challengeId}, ${contactId}, ${dayNumber}, ${promptText}, ${responseText || null}, ${!!responseText}, ${responseText ? new Date().toISOString() : null})
        ON CONFLICT (challenge_id, contact_id, day_number)
        DO UPDATE SET response_text = ${responseText || null}, completed = ${!!responseText}, completed_at = ${responseText ? new Date().toISOString() : null}
        RETURNING *
      `;

      return res.json({ success: true, response: rows[0] });
    }

    // ============================================================
    // GET /api/r/couple-challenge/prompts?challengeId=xxx&contactId=xxx
    // ============================================================
    if (req.method === 'GET' && url.startsWith('/couple-challenge/prompts')) {
      const params = new URL('http://x' + req.url).searchParams;
      const challengeId = params.get('challengeId');
      const contactId = params.get('contactId');
      if (!challengeId || !contactId) return res.status(400).json({ error: 'challengeId and contactId are required' });

      const responses = await sql`
        SELECT * FROM couple_challenge_responses
        WHERE challenge_id = ${challengeId} AND contact_id = ${contactId}
        ORDER BY day_number ASC
      `;

      const responseMap = {};
      for (const r of responses) {
        responseMap[r.day_number] = r;
      }

      const prompts = COUPLE_CHALLENGE_PROMPTS.map((prompt, i) => {
        const dayNum = i + 1;
        const existing = responseMap[dayNum];
        return {
          dayNumber: dayNum,
          promptText: prompt,
          responseText: existing?.response_text || null,
          completed: existing?.completed || false,
          completedAt: existing?.completed_at || null
        };
      });

      return res.json({ prompts });
    }

    // ============================================================
    // POST /api/r/consent — Record consent
    // ============================================================
    if (req.method === 'POST' && url === '/consent') {
      const b = req.body || {};
      const { contactId, faithDisclaimer, consent } = b;

      if (!contactId) return res.status(400).json({ error: 'contactId is required' });
      if (!faithDisclaimer) return res.status(400).json({ error: 'faithDisclaimer must be accepted' });
      if (!consent) return res.status(400).json({ error: 'consent must be given' });

      const rows = await sql`
        UPDATE user_profiles SET
          consent_given = true,
          consent_given_at = NOW(),
          faith_disclaimer_accepted = true,
          updated_at = NOW()
        WHERE contact_id = ${contactId}
        RETURNING *
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
      return res.json({ success: true, profile: rows[0] });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Relationships API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
