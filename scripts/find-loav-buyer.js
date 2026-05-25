#!/usr/bin/env node
// Finds buyers of the $17.77 LOAV pre-sale (price_1TI7KoCaTyuNk1McT6wNz2dp)
// Defaults to TODAY (local timezone). Bumps to last 7 days if today is empty.
// Prints email, name, payment_intent, charge_id, session_id, created_at.

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
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

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY missing from .env.local');
  process.exit(1);
}

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const LOAV_PRICE_ID = 'price_1TI7KoCaTyuNk1McT6wNz2dp';
const LOAV_AMOUNT_CENTS = 1777;

function startOfTodayUnix() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function listLoavCharges(sinceUnix) {
  // Pull recent charges, filter to $17.77
  const out = [];
  let starting_after;
  for (let page = 0; page < 5; page++) {
    const res = await stripe.charges.list({
      created: { gte: sinceUnix },
      limit: 100,
      ...(starting_after ? { starting_after } : {})
    });
    for (const c of res.data) {
      if (c.amount === LOAV_AMOUNT_CENTS && c.status === 'succeeded') {
        out.push(c);
      }
    }
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1].id;
  }
  return out;
}

async function enrich(charge) {
  const email = charge.billing_details?.email
    || charge.receipt_email
    || (charge.customer && (await stripe.customers.retrieve(charge.customer))?.email)
    || null;
  const name = charge.billing_details?.name || null;
  let session_id = null;
  let line_item_price_id = null;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
    if (sessions.data[0]) {
      session_id = sessions.data[0].id;
      const li = await stripe.checkout.sessions.listLineItems(session_id, { limit: 5 });
      line_item_price_id = li.data[0]?.price?.id || null;
    }
  } catch (e) { /* non-fatal */ }
  return {
    email,
    name,
    amount: `$${(charge.amount / 100).toFixed(2)}`,
    payment_intent: charge.payment_intent,
    charge_id: charge.id,
    session_id,
    line_item_price_id,
    matches_loav_price: line_item_price_id === LOAV_PRICE_ID,
    created: new Date(charge.created * 1000).toISOString(),
    refunded: charge.refunded,
    refund_status: charge.amount_refunded ? `partial: $${(charge.amount_refunded / 100).toFixed(2)}` : 'none',
    receipt_url: charge.receipt_url
  };
}

(async () => {
  const today = startOfTodayUnix();
  let charges = await listLoavCharges(today);
  let scope = 'today';
  if (charges.length === 0) {
    const sevenDays = today - 7 * 24 * 60 * 60;
    charges = await listLoavCharges(sevenDays);
    scope = 'last 7 days';
  }
  console.log(`\n=== $17.77 LOAV charges · scope=${scope} · count=${charges.length} ===\n`);
  if (charges.length === 0) {
    console.log('No $17.77 charges found. Either nothing was bought, the price differs, or the Stripe key is test-mode while the buy-link is live-mode.');
    console.log('Stripe key prefix:', (process.env.STRIPE_SECRET_KEY || '').slice(0, 8));
    return;
  }
  for (const c of charges) {
    const e = await enrich(c);
    console.log(JSON.stringify(e, null, 2));
    console.log('---');
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
