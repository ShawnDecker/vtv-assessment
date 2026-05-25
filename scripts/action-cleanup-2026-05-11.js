#!/usr/bin/env node
// One-shot cleanup per Shawn 2026-05-11:
//   A. Cancel 2 duplicate $47/mo subs on danddappraisal@gmail.com (no refund — they're his)
//   B. Unsubscribe Kyle (kyleforwork1@gmail.com) from coaching_sequences (bouncing since 4/22)
//   C. Probe user_profiles + contacts schema so we can mark the 3 owner emails comp/internal
//   D. If the schema supports it, comp-grant the 3 owner emails to top tier
//
// Idempotent: re-running is safe. Skips already-canceled subs + already-unsubscribed users.

const fs = require('fs'); const path = require('path');
function loadEnv(file){if(!fs.existsSync(file))return;let t=fs.readFileSync(file);if(t[0]===0xFF&&t[1]===0xFE)t=Buffer.from(t.slice(2).toString('utf16le'),'utf8');else if(t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)t=t.slice(3);t=t.toString('utf8');for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
loadEnv(path.join(__dirname,'..','.env.local'));
loadEnv(path.join(__dirname,'..','.env'));

const { neon } = require('@neondatabase/serverless');
const Stripe = require('stripe');
const sql = neon(process.env.DATABASE_URL);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const OWNER_EMAILS = ['powerofvalue@gmail.com', 'danddappraisal@gmail.com', 'valuetovictory@gmail.com'];

(async () => {
  console.log('========== CLEANUP 2026-05-11 ==========\n');

  // ----- A. Cancel duplicate danddappraisal subs -----
  console.log('--- A. Cancel danddappraisal@gmail.com subscriptions ---');
  const custs = await stripe.customers.list({ email: 'danddappraisal@gmail.com', limit: 10 });
  console.log(`Found ${custs.data.length} Stripe customer(s) for danddappraisal@gmail.com`);
  for (const cust of custs.data) {
    const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 20 });
    for (const s of subs.data) {
      if (['canceled', 'incomplete_expired'].includes(s.status)) {
        console.log(`  sub ${s.id} already ${s.status} — skip`);
        continue;
      }
      const priceId = s.items.data[0]?.price?.id || '?';
      try {
        const result = await stripe.subscriptions.cancel(s.id, {
          invoice_now: false,
          prorate: false
        });
        console.log(`  ✔ canceled sub ${s.id} (was ${s.status}, price=${priceId}) → now ${result.status}`);
      } catch (e) {
        console.log(`  ✖ FAILED to cancel ${s.id}: ${e.message}`);
      }
    }
  }

  // ----- B. Unsubscribe Kyle -----
  console.log('\n--- B. Unsubscribe Kyle (kyleforwork1@gmail.com) ---');
  try {
    const before = await sql`SELECT email, current_day, unsubscribed FROM coaching_sequences WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
    if (before.length === 0) {
      console.log('  not enrolled in coaching_sequences — nothing to do');
    } else {
      console.log(`  before: day=${before[0].current_day} unsubscribed=${before[0].unsubscribed}`);
      await sql`UPDATE coaching_sequences SET unsubscribed = TRUE, unsubscribed_at = NOW() WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
      const after = await sql`SELECT unsubscribed FROM coaching_sequences WHERE LOWER(email) = 'kyleforwork1@gmail.com'`;
      console.log(`  ✔ unsubscribed=${after[0].unsubscribed}`);
    }
  } catch (e) { console.log(`  ✖ ${e.message}`); }

  // ----- C. Probe schemas -----
  console.log('\n--- C. Schema probe (user_profiles + contacts) ---');
  const upCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles' ORDER BY ordinal_position`;
  console.log('user_profiles columns:');
  for (const c of upCols) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);
  const cCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contacts' ORDER BY ordinal_position`;
  console.log('contacts columns:');
  for (const c of cCols) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);

  // ----- D. Comp-grant owner emails (best-effort given schema) -----
  console.log('\n--- D. Comp-grant 3 owner emails ---');
  // Figure out how user_profiles links to email
  const upHasEmail = upCols.some(c => c.column_name === 'email');
  const upHasContactId = upCols.some(c => c.column_name === 'contact_id');
  const upHasTier = upCols.some(c => c.column_name === 'tier');
  const upHasIsInternal = upCols.some(c => c.column_name === 'is_internal');
  console.log(`user_profiles.email=${upHasEmail} contact_id=${upHasContactId} tier=${upHasTier} is_internal=${upHasIsInternal}`);

  for (const email of OWNER_EMAILS) {
    console.log(`\n  [${email}]`);
    // Look up contact_id from contacts
    const contact = await sql`SELECT id, email FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
    if (contact.length === 0) {
      console.log('    no contact row — creating one');
      try {
        const ins = await sql`INSERT INTO contacts (email, first_name, source, created_at) VALUES (${email.toLowerCase()}, 'Owner', 'owner_comp', NOW()) RETURNING id`;
        contact.push(ins[0]);
        console.log(`    ✔ contact created id=${ins[0].id}`);
      } catch (e) { console.log(`    ✖ create contact failed: ${e.message}`); continue; }
    }
    const contactId = contact[0].id;
    console.log(`    contact_id=${contactId}`);

    // Find existing user_profile
    let profile = [];
    if (upHasContactId) {
      profile = await sql`SELECT * FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
    } else if (upHasEmail) {
      profile = await sql`SELECT * FROM user_profiles WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
    }
    if (profile.length === 0) {
      console.log('    no user_profile — creating with tier=victory-vip');
      try {
        if (upHasContactId && upHasTier) {
          await sql`INSERT INTO user_profiles (contact_id, tier, created_at) VALUES (${contactId}, 'victory-vip', NOW())`;
          console.log('    ✔ user_profile created tier=victory-vip');
        } else {
          console.log('    ⚠ schema mismatch — skipping insert; manual review needed');
        }
      } catch (e) { console.log(`    ✖ insert failed: ${e.message}`); }
    } else {
      console.log(`    existing profile tier=${profile[0].tier || 'n/a'} sub=${profile[0].stripe_subscription_id || 'none'}`);
      try {
        await sql`UPDATE user_profiles SET tier = 'victory-vip', stripe_subscription_id = NULL, updated_at = NOW() WHERE contact_id = ${contactId}`;
        console.log('    ✔ tier upgraded to victory-vip, stripe_subscription_id cleared');
      } catch (e) { console.log(`    ✖ update failed: ${e.message}`); }
    }
  }

  console.log('\n========== DONE ==========\n');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
