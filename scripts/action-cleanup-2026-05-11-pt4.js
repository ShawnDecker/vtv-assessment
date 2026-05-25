#!/usr/bin/env node
// Pt 4 — discover ALL CHECK constraints on user_profiles first, then comp-grant with valid values.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));
loadEnv(path.join(__dirname,'..','.env'));

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const OWNER_EMAILS = ['powerofvalue@gmail.com', 'danddappraisal@gmail.com', 'valuetovictory@gmail.com'];

function parseEnum(def) { return [...(def||'').matchAll(/'([^']+)'/g)].map(m => m[1]); }

(async () => {
  console.log('--- All CHECK constraints on user_profiles ---');
  const cons = await sql`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.user_profiles'::regclass AND contype = 'c'`;
  const enums = {};
  for (const c of cons) {
    console.log(`  ${c.conname}: ${c.def}`);
    // Try to extract a column name from the def: "((column_name = ANY (...)))" pattern
    const colMatch = c.def.match(/\(?\(?(\w+)\s*=\s*ANY/);
    if (colMatch) enums[colMatch[1]] = parseEnum(c.def);
  }
  console.log('Parsed enums:', enums);

  const TIER = (enums.membership_tier || ['premium']).includes('premium') ? 'premium' : (enums.membership_tier?.[enums.membership_tier.length-1] || 'premium');
  const rolePref = ['owner','admin','founder','superuser','parent','user','individual','member'];
  const ROLE = rolePref.find(p => (enums.role || []).includes(p)) || (enums.role?.[0] || 'individual');
  console.log(`Using tier='${TIER}' role='${ROLE}'`);

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
      await sql`INSERT INTO user_profiles (contact_id, membership_tier, role, created_at) VALUES (${cid}, ${TIER}, ${ROLE}, NOW())`;
      console.log(`  ✔ profile created tier=${TIER} role=${ROLE}`);
    } else {
      console.log(`  before: tier=${profile[0].membership_tier} role=${profile[0].role}`);
      await sql`UPDATE user_profiles SET membership_tier = ${TIER}, role = ${ROLE}, stripe_subscription_id = NULL, updated_at = NOW() WHERE contact_id = ${cid}`;
      console.log(`  ✔ updated tier=${TIER} role=${ROLE} sub=cleared`);
    }

    // Also seed a note in preferences JSONB marking as owner-comp
    try {
      await sql`UPDATE user_profiles SET preferences = COALESCE(preferences, '{}'::jsonb) || ${JSON.stringify({owner_comp: true, comped_at: new Date().toISOString(), comped_reason: 'owner email — Shawn 2026-05-11'})}::jsonb WHERE contact_id = ${cid}`;
      console.log(`  ✔ preferences.owner_comp=true`);
    } catch (e) { console.log(`  preferences update note skipped: ${e.message}`); }
  }

  console.log('\n--- VERIFY ---');
  for (const email of [...OWNER_EMAILS, 'kyleforwork1@gmail.com']) {
    const r = await sql`SELECT c.id as cid, c.email, up.membership_tier, up.role, up.stripe_subscription_id, up.preferences, cs.current_day, cs.unsubscribed
                        FROM contacts c
                        LEFT JOIN user_profiles up ON up.contact_id = c.id
                        LEFT JOIN coaching_sequences cs ON LOWER(cs.email) = LOWER(c.email)
                        WHERE LOWER(c.email) = ${email.toLowerCase()} LIMIT 1`;
    if (r.length === 0) { console.log(`  ${email}: NO RECORD`); continue; }
    const x = r[0];
    const oc = x.preferences?.owner_comp ? ' [OWNER-COMP]' : '';
    console.log(`  ${email.padEnd(33)} tier=${x.membership_tier||'-'} role=${x.role||'-'} coach_day=${x.current_day??'-'} unsub=${x.unsubscribed??'-'}${oc}`);
  }
  console.log('\n========== DONE ==========');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
