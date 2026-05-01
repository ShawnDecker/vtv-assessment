/**
 * One-shot: ensure the production Stripe webhook subscribes to `customer.subscription.trial_will_end`.
 * Required for the Skill Pack Bundle 30-day free membership trial-reminder email (ROSCA + CA/IL compliance).
 *
 * Usage: node scripts/enable-trial-will-end-webhook.js
 * Reads STRIPE_SECRET_KEY from .env.local.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const Stripe = require('stripe');

const TARGET_URL = 'https://assessment.valuetovictory.com/api/checkout/webhook';
const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end', // ← the one we need
  'invoice.paid',
  'invoice.payment_failed',
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY in .env.local');
    process.exit(1);
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  console.log('Listing webhook endpoints...');
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

  const target = endpoints.data.find(e => e.url === TARGET_URL);
  if (!target) {
    console.error(`No webhook endpoint found for ${TARGET_URL}`);
    console.error('Existing endpoints:');
    endpoints.data.forEach(e => console.error(`  ${e.id}  ${e.url}  events: ${e.enabled_events.join(',')}`));
    process.exit(2);
  }

  console.log(`Found endpoint: ${target.id}`);
  console.log(`Currently subscribed to ${target.enabled_events.length} event(s):`);
  target.enabled_events.forEach(e => console.log('  -', e));

  const has = target.enabled_events.includes('customer.subscription.trial_will_end') ||
              target.enabled_events.includes('*');
  if (has) {
    console.log('\n✅ Already subscribed to customer.subscription.trial_will_end. No change needed.');
    return;
  }

  // Build the merged event list, preserving everything that was already enabled
  // plus the events we know we need.
  const merged = Array.from(new Set([...target.enabled_events, ...REQUIRED_EVENTS]));

  console.log('\nUpdating webhook to add missing events...');
  const updated = await stripe.webhookEndpoints.update(target.id, {
    enabled_events: merged,
  });

  console.log(`\n✅ Updated. Now subscribed to ${updated.enabled_events.length} event(s):`);
  updated.enabled_events.forEach(e => console.log('  -', e));
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.raw) console.error(err.raw);
  process.exit(3);
});
