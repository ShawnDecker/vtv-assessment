#!/usr/bin/env node
// Cleanup pt 2 — fix the column-name bugs from pt 1.
// Schema-correct names:
//   coaching_sequences has `unsubscribed` (bool) — no `unsubscribed_at`
//   contacts has NO `source` column — drop it from insert
//   user_profiles uses `membership_tier` not `tier`, and has `role` (text) for owner flag
//
// Re-runs only the steps that failed in pt1; Stripe cancels are already done.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));
loadEnv(path.join(__dirname,'..','.env'));

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const OWNER_EMAILS = ['powerofvalue@gmail.com', 'danddappraisal@gmail.com', 'valuetovictory@gmail.com'];

(async () => {
  console.log('========== CLEANUP PT 2 ==========\n');

  // ----- B (retry). Unsubscribe Kyle -----
  console.log('--- B. Unsubscribe Kyle ---');
  const k = await sql`SELECT email, current_day, unsubscribed FROM coaching_sequences WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
  console.log(`  before: day=${k[0]?.current_day} unsubscribed=${k[0]?.unsubscribed}`);
  await sql`UPDATE coaching_sequences SET unsubscribed = TRUE WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
  const k2 = await sql`SELECT unsubscribed FROM coaching_sequences WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
  console.log(`  ✔ after: unsubscribed=${k2[0].unsubscribed}`);

  // ----- D (retry). Comp-grant 3 owner emails -----
  console.log('\n--- D. Comp-grant 3 owner emails ---');
  for (const email of OWNER_EMAILS) {
    console.log(`\n  [${email}]`);
    let contact = await sql`SELECT id, email FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
    if (contact.length === 0) {
      const ins = await sql`INSERT INTO contacts (email, first_name, last_name, created_at) VALUES (${email.toLowerCase()}, 'Owner', 'Decker', ${new Date().toISOString()}) RETURNING id`;
      contact = ins;
      console.log(`    ✔ contact created id=${ins[0].id}`);
    } else {
      console.log(`    contact_id=${contact[0].id}`);
    }
    const contactId = contact[0].id;

    const profile = await sql`SELECT id, membership_tier, role, stripe_subscription_id FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
    if (profile.length === 0) {
      await sql`INSERT INTO user_profiles (contact_id, membership_tier, role, created_at) VALUES (${contactId}, 'victory-vip', 'owner', NOW())`;
      console.log(`    ✔ profile created: membership_tier=victory-vip role=owner`);
    } else {
      console.log(`    before: tier=${profile[0].membership_tier} role=${profile[0].role} sub=${profile[0].stripe_subscription_id || 'none'}`);
      await sql`UPDATE user_profiles SET membership_tier = 'victory-vip', role = 'owner', stripe_subscription_id = NULL, updated_at = NOW() WHERE contact_id = ${contactId}`;
      console.log(`    ✔ updated: membership_tier=victory-vip role=owner sub=cleared`);
    }
  }

  // ----- Verification block: summarize end state -----
  console.log('\n--- VERIFY ---');
  for (const email of [...OWNER_EMAILS, 'kyleforwork1@gmail.com']) {
    const r = await sql`SELECT c.id as cid, c.email, c.disabled, up.membership_tier, up.role, up.stripe_subscription_id,
                               cs.current_day, cs.unsubscribed
                        FROM contacts c
                        LEFT JOIN user_profiles up ON up.contact_id = c.id
                        LEFT JOIN coaching_sequences cs ON LOWER(cs.email) = LOWER(c.email)
                        WHERE LOWER(c.email) = ${email.toLowerCase()}
                        LIMIT 1`;
    if (r.length === 0) { console.log(`  ${email}: NO RECORD`); continue; }
    const x = r[0];
    console.log(`  ${email.padEnd(33)} cid=${x.cid} tier=${x.membership_tier || '-'} role=${x.role || '-'} coaching_day=${x.current_day ?? '-'} unsubscribed=${x.unsubscribed ?? '-'}`);
  }

  console.log('\n========== DONE ==========\n');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
