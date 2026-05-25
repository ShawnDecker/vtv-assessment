#!/usr/bin/env node
// Morning/ad-hoc status check.
//   1. Assessment activity (last 24h / 7d / 30d + recent rows w/ email)
//   2. Stripe last 7d — charges (in) + refunds (out)
//   3. Subscription/billing audit for the 3 owner emails that should be exempt
//
// Run:  node scripts/status-check.js
//
// Reads .env.local for DATABASE_URL + STRIPE_SECRET_KEY.

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  // strip UTF-16/BOM if present (Windows PowerShell sometimes writes UTF-16LE)
  let txt = fs.readFileSync(file);
  if (txt[0] === 0xFF && txt[1] === 0xFE) txt = Buffer.from(txt.slice(2).toString('utf16le'), 'utf8');
  else if (txt[0] === 0xEF && txt[1] === 0xBB && txt[2] === 0xBF) txt = txt.slice(3);
  txt = txt.toString('utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL missing'); process.exit(1); }
if (!process.env.STRIPE_SECRET_KEY) { console.error('STRIPE_SECRET_KEY missing'); process.exit(1); }

const { neon } = require('@neondatabase/serverless');
const Stripe = require('stripe');
const sql = neon(process.env.DATABASE_URL);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const EXEMPT_EMAILS = ['powerofvalue@gmail.com', 'dndappraisal@gmail.com', 'valuetovictory@gmail.com'];

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;
const iso = (unix) => new Date(unix * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z';

const now = new Date();
const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
const last7d_iso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
const last7d_unix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

(async () => {
  console.log('\n========== VTV STATUS CHECK ==========');
  console.log(`Run: ${now.toISOString()}`);
  console.log(`Stripe key mode: ${process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);

  // ============ 1. ASSESSMENTS ============
  console.log('\n--- 1. ASSESSMENTS ---');
  const totalA = await sql`SELECT COUNT(*) as cnt FROM assessments`;
  const a24 = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${last24h}`;
  const a7 = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${last7d_iso}`;
  const a30 = await sql`SELECT COUNT(*) as cnt FROM assessments WHERE completed_at >= ${last30d}`;
  console.log(`Total assessments: ${totalA[0].cnt}`);
  console.log(`Completed in last 24h: ${a24[0].cnt}`);
  console.log(`Completed in last 7d:  ${a7[0].cnt}`);
  console.log(`Completed in last 30d: ${a30[0].cnt}`);

  const recent = await sql`SELECT a.master_score, a.weakest_pillar, a.completed_at, c.first_name, c.last_name, c.email
                           FROM assessments a JOIN contacts c ON a.contact_id = c.id
                           WHERE a.completed_at >= ${last7d_iso}
                           ORDER BY a.completed_at DESC LIMIT 15`;
  console.log(`\nMost recent assessments (last 7d, up to 15):`);
  if (recent.length === 0) console.log('  (none)');
  for (const r of recent) {
    console.log(`  ${r.completed_at}  ${r.email.padEnd(35)}  score=${r.master_score}  weakest=${r.weakest_pillar}`);
  }

  // recent contacts even without a completed assessment (BNI may have signed up but not completed)
  const recentContacts = await sql`SELECT first_name, last_name, email, created_at FROM contacts
                                   WHERE created_at >= ${last7d_iso}
                                   ORDER BY created_at DESC LIMIT 15`;
  console.log(`\nMost recent contacts/signups (last 7d, up to 15):`);
  if (recentContacts.length === 0) console.log('  (none)');
  for (const r of recentContacts) {
    console.log(`  ${new Date(r.created_at).toISOString().slice(0,16)}  ${r.email}`);
  }

  // ============ 2. STRIPE LAST 7 DAYS ============
  console.log('\n--- 2. STRIPE LAST 7 DAYS ---');
  const charges = [];
  let starting_after;
  for (let p = 0; p < 5; p++) {
    const r = await stripe.charges.list({ created: { gte: last7d_unix }, limit: 100, ...(starting_after ? { starting_after } : {}) });
    charges.push(...r.data);
    if (!r.has_more) break;
    starting_after = r.data[r.data.length - 1].id;
  }
  const succeeded = charges.filter(c => c.status === 'succeeded');
  const failed = charges.filter(c => c.status === 'failed');
  const totalSucceeded = succeeded.reduce((s, c) => s + c.amount, 0);
  const totalRefundedFromCharges = succeeded.reduce((s, c) => s + (c.amount_refunded || 0), 0);
  console.log(`Charges: ${succeeded.length} succeeded · ${failed.length} failed · gross ${dollars(totalSucceeded)}`);
  console.log(`Refunds embedded in charges: ${dollars(totalRefundedFromCharges)}`);

  console.log(`\nSucceeded charges (newest first):`);
  for (const c of succeeded.slice(0, 20)) {
    const email = c.billing_details?.email || c.receipt_email || '(no email)';
    const refunded = c.amount_refunded ? ` REFUNDED ${dollars(c.amount_refunded)}` : '';
    console.log(`  ${iso(c.created)}  ${dollars(c.amount).padStart(10)}  ${email.padEnd(35)}  ${c.description || ''}${refunded}`);
  }
  if (failed.length) {
    console.log(`\nFailed charges:`);
    for (const c of failed.slice(0, 10)) {
      console.log(`  ${iso(c.created)}  ${dollars(c.amount)}  ${c.billing_details?.email || ''}  ${c.failure_message || ''}`);
    }
  }

  // standalone refunds (in case some came from dashboard not tied to a fresh charge)
  const refunds = await stripe.refunds.list({ created: { gte: last7d_unix }, limit: 100 });
  console.log(`\nStandalone refunds list: ${refunds.data.length}`);
  for (const r of refunds.data.slice(0, 10)) {
    console.log(`  ${iso(r.created)}  ${dollars(r.amount)}  charge=${r.charge}  reason=${r.reason || 'n/a'}`);
  }

  // subscription activity
  const subs = await stripe.subscriptions.list({ created: { gte: last7d_unix }, limit: 100, status: 'all' });
  console.log(`\nNew subscriptions in last 7d: ${subs.data.length}`);
  for (const s of subs.data.slice(0, 15)) {
    const cust = s.customer ? await stripe.customers.retrieve(s.customer).catch(() => null) : null;
    const email = cust?.email || '(no email)';
    const priceNick = s.items.data[0]?.price?.nickname || s.items.data[0]?.price?.id || '?';
    console.log(`  ${iso(s.created)}  ${email.padEnd(35)}  status=${s.status}  price=${priceNick}`);
  }

  // ============ 3. EXEMPT EMAILS BILLING AUDIT ============
  console.log('\n--- 3. EXEMPT EMAILS BILLING AUDIT ---');
  for (const email of EXEMPT_EMAILS) {
    console.log(`\n[${email}]`);
    // Stripe side
    const custs = await stripe.customers.list({ email, limit: 5 });
    if (custs.data.length === 0) {
      console.log('  Stripe: no customer record');
    } else {
      for (const cust of custs.data) {
        const cs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 10 });
        const active = cs.data.filter(s => ['active', 'trialing', 'past_due'].includes(s.status));
        console.log(`  Stripe customer ${cust.id} · ${cs.data.length} subs (${active.length} active)`);
        for (const s of cs.data) {
          const priceId = s.items.data[0]?.price?.id || '?';
          const nick = s.items.data[0]?.price?.nickname || '';
          console.log(`    sub ${s.id}  status=${s.status}  price=${priceId} ${nick}`);
        }
      }
    }
    // App-side coaching sequence
    try {
      const cs = await sql`SELECT email, current_day, unsubscribed FROM coaching_sequences WHERE LOWER(email) = ${email.toLowerCase()}`;
      if (cs.length === 0) console.log('  coaching_sequences: not enrolled');
      else for (const r of cs) console.log(`  coaching_sequences: day=${r.current_day} unsubscribed=${r.unsubscribed}`);
    } catch (e) { console.log(`  coaching_sequences: ERROR ${e.message}`); }
    // user_profiles tier
    try {
      const up = await sql`SELECT email, tier, stripe_subscription_id, created_at FROM user_profiles WHERE LOWER(email) = ${email.toLowerCase()}`;
      if (up.length === 0) console.log('  user_profiles: no record');
      else for (const r of up) console.log(`  user_profiles: tier=${r.tier} sub=${r.stripe_subscription_id || 'none'}`);
    } catch (e) { console.log(`  user_profiles: ERROR ${e.message}`); }
  }

  console.log('\n========== END ==========\n');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
