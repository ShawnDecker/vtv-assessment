#!/usr/bin/env node
// Pt 3 — discover allowed membership_tier values, then comp-grant.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));
loadEnv(path.join(__dirname,'..','.env'));

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const OWNER_EMAILS = ['powerofvalue@gmail.com', 'danddappraisal@gmail.com', 'valuetovictory@gmail.com'];

(async () => {
  // 1. Discover allowed membership_tier values via check constraint definition
  const con = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'user_profiles_membership_tier_check'`;
  console.log('Constraint def:', con[0]?.def);

  // 2. Look at what tiers are actually in use
  const inUse = await sql`SELECT membership_tier, COUNT(*) AS cnt FROM user_profiles WHERE membership_tier IS NOT NULL GROUP BY membership_tier`;
  console.log('In-use tiers:', inUse);

  // 3. Parse allowed tiers from constraint def — pattern usually: CHECK (membership_tier = ANY (ARRAY['a', 'b', ...]))
  const defStr = con[0]?.def || '';
  const matches = [...defStr.matchAll(/'([^']+)'/g)].map(m => m[1]);
  console.log('Parsed allowed tiers:', matches);

  // 4. Pick the best tier for owner-comp. Prefer 'vip' / 'victory_vip' / 'victoryvip' / highest tier in list. Fallback to last array element.
  const preference = ['victory_vip','victoryvip','vip','victory-vip','founder','owner','admin','enterprise','premium','victory'];
  let chosen = preference.find(p => matches.includes(p));
  if (!chosen && matches.length) chosen = matches[matches.length - 1];
  if (!chosen) chosen = 'premium';
  console.log(`Using membership_tier='${chosen}'`);

  // 5. Comp-grant
  for (const email of OWNER_EMAILS) {
    console.log(`\n[${email}]`);
    let contact = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
    if (contact.length === 0) {
      const ins = await sql`INSERT INTO contacts (email, first_name, last_name, created_at) VALUES (${email.toLowerCase()}, 'Owner', 'Decker', ${new Date().toISOString()}) RETURNING id`;
      contact = ins;
      console.log(`  contact created id=${ins[0].id}`);
    } else console.log(`  contact_id=${contact[0].id}`);
    const cid = contact[0].id;

    const profile = await sql`SELECT id, membership_tier, role FROM user_profiles WHERE contact_id = ${cid} LIMIT 1`;
    if (profile.length === 0) {
      await sql`INSERT INTO user_profiles (contact_id, membership_tier, role, created_at) VALUES (${cid}, ${chosen}, 'owner', NOW())`;
      console.log(`  ✔ profile created membership_tier=${chosen} role=owner`);
    } else {
      console.log(`  before: tier=${profile[0].membership_tier} role=${profile[0].role}`);
      await sql`UPDATE user_profiles SET membership_tier = ${chosen}, role = 'owner', stripe_subscription_id = NULL, updated_at = NOW() WHERE contact_id = ${cid}`;
      console.log(`  ✔ updated tier=${chosen} role=owner sub=cleared`);
    }
  }

  console.log('\n--- VERIFY ---');
  for (const email of [...OWNER_EMAILS, 'kyleforwork1@gmail.com']) {
    const r = await sql`SELECT c.id as cid, c.email, up.membership_tier, up.role, up.stripe_subscription_id, cs.current_day, cs.unsubscribed
                        FROM contacts c
                        LEFT JOIN user_profiles up ON up.contact_id = c.id
                        LEFT JOIN coaching_sequences cs ON LOWER(cs.email) = LOWER(c.email)
                        WHERE LOWER(c.email) = ${email.toLowerCase()} LIMIT 1`;
    if (r.length === 0) { console.log(`  ${email}: NO RECORD`); continue; }
    const x = r[0];
    console.log(`  ${email.padEnd(33)} tier=${x.membership_tier||'-'} role=${x.role||'-'} coach_day=${x.current_day??'-'} unsub=${x.unsubscribed??'-'}`);
  }
  console.log('\n========== DONE ==========');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
