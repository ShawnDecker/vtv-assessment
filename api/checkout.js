const Stripe = require('stripe');
const { neon } = require('@neondatabase/serverless');

// Disable Vercel body parsing for webhook signature verification
module.exports.config = { api: { bodyParser: false } };

// Helper: read raw body from request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Hardcoded active price IDs — fallback if env vars are stale/inactive
const ACTIVE_PRICES = {
  individual: 'price_1THTlxCaTyuNk1McUWDRZOzz',  // VictoryPath $29/mo (new active product+price, Apr 1 2026)
  couple:     'price_1THT4tCaTyuNk1Mc1xzlrxu9',  // Value Builder $47/mo (created Apr 1 2026)
  premium:    'price_1TEhZ8CaTyuNk1McPoAJBpYW'   // Victory VIP $497/mo
};

// Map all URL slugs to DB-safe tier values
const TIER_CONFIG = {
  victorypath: { amount: 2900, name: 'VictoryPath Membership', dbTier: 'individual', priceKey: 'individual' },
  individual:  { amount: 2900, name: 'VictoryPath Membership', dbTier: 'individual', priceKey: 'individual' },
  builder:     { amount: 4700, name: 'Value Builder',          dbTier: 'couple',     priceKey: 'couple' },
  couple:      { amount: 4700, name: 'Value Builder',          dbTier: 'couple',     priceKey: 'couple' },
  vip:         { amount: 49700, name: 'Victory VIP',           dbTier: 'premium',    priceKey: 'premium' },
  premium:     { amount: 49700, name: 'Victory VIP',           dbTier: 'premium',    priceKey: 'premium' }
};

const BASE_URL = 'https://assessment.valuetovictory.com';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const url = req.url.split('?')[0].replace(/^\/api\/checkout/, '');

  try {
    // ============================================================
    // POST /api/checkout/webhook — Stripe webhook handler
    // ============================================================
    if (req.method === 'POST' && url === '/webhook') {
      const sig = req.headers['stripe-signature'];
      let event;

      try {
        const rawBody = await getRawBody(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      const sql = neon(process.env.DATABASE_URL);

      // Handle checkout.session.completed
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const rawTier = session.metadata?.tier;
        // Map to DB-safe tier value
        const tierMap = { victorypath: 'individual', individual: 'individual', builder: 'couple', couple: 'couple', vip: 'premium', premium: 'premium' };
        const tier = tierMap[rawTier] || rawTier;

        if (email && tier) {
          // Find contact by email
          const contacts = await sql`SELECT id FROM contacts WHERE email = ${email} LIMIT 1`;
          if (contacts.length > 0) {
            const contactId = contacts[0].id;
            // Upsert user_profiles
            const existing = await sql`SELECT id FROM user_profiles WHERE contact_id = ${contactId} LIMIT 1`;
            if (existing.length > 0) {
              await sql`
                UPDATE user_profiles SET
                  membership_tier = ${tier},
                  stripe_customer_id = ${customerId},
                  stripe_subscription_id = ${subscriptionId},
                  updated_at = NOW()
                WHERE contact_id = ${contactId}
              `;
            } else {
              await sql`
                INSERT INTO user_profiles (contact_id, membership_tier, stripe_customer_id, stripe_subscription_id)
                VALUES (${contactId}, ${tier}, ${customerId}, ${subscriptionId})
              `;
            }
          }
        }
      }

      // Handle subscription deleted (downgrade to free)
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        await sql`
          UPDATE user_profiles SET
            membership_tier = 'free',
            stripe_subscription_id = NULL,
            updated_at = NOW()
          WHERE stripe_subscription_id = ${subscriptionId}
        `;
      }

      // Handle subscription updated (tier change)
      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const priceId = subscription.items?.data?.[0]?.price?.id;

        if (priceId) {
          // Determine tier from price ID
          let newTier = null;
          const envPrices = {
            [process.env.STRIPE_PRICE_INDIVIDUAL]: 'individual',
            [process.env.STRIPE_PRICE_COUPLE]: 'couple',
            [process.env.STRIPE_PRICE_PREMIUM]: 'premium'
          };

          if (envPrices[priceId]) {
            newTier = envPrices[priceId];
          } else {
            // Look up the price amount to determine tier
            try {
              const price = await stripe.prices.retrieve(priceId);
              const amount = price.unit_amount;
              if (amount === 2900) newTier = 'individual';
              else if (amount === 4700) newTier = 'couple';
              else if (amount === 49700) newTier = 'premium';
            } catch (e) { /* ignore lookup error */ }
          }

          if (newTier) {
            await sql`
              UPDATE user_profiles SET
                membership_tier = ${newTier},
                updated_at = NOW()
              WHERE stripe_subscription_id = ${subscriptionId}
            `;
          }
        }
      }

      return res.json({ received: true });
    }

    // ============================================================
    // GET /api/checkout?tier=xxx&email=xxx — Create Stripe Checkout session
    // ============================================================
    if (req.method === 'GET') {
      const params = new URL('http://x' + req.url).searchParams;
      const tier = params.get('tier');
      const email = params.get('email');

      if (!tier || !TIER_CONFIG[tier]) {
        return res.status(400).json({ error: 'Invalid tier. Must be: victorypath, builder, or vip' });
      }

      const config = TIER_CONFIG[tier];

      // Use hardcoded active prices directly -- env vars were stale/inactive
      const priceId = ACTIVE_PRICES[config.priceKey];
      console.log(`[Checkout] Using price ${priceId} for ${config.name} (${config.dbTier})`);

      const sessionParams = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${BASE_URL}/onboarding?tier=${config.dbTier}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/pricing`,
        metadata: { tier: config.dbTier },
        allow_promotion_codes: true
      };

      if (email) {
        sessionParams.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      // Redirect to Stripe Checkout
      res.writeHead(303, { Location: session.url });
      return res.end();
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Checkout API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
