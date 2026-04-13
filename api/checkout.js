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
  // CORS — allow specific origins only
  const ALLOWED = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','http://localhost:3000','http://localhost:5173'];
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED.includes(origin) ? origin : (origin.endsWith('.vercel.app') ? origin : ALLOWED[0]);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const url = req.url.split('?')[0].replace(/^\/api\/checkout/, '').replace(/^\/checkout/, '');

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
        const email = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const paymentIntentId = session.payment_intent;
        const rawTier = session.metadata?.tier;
        // Map to DB-safe tier value
        const tierMap = { victorypath: 'individual', individual: 'individual', builder: 'couple', couple: 'couple', vip: 'premium', premium: 'premium' };
        const tier = tierMap[rawTier] || rawTier;

        // ── Check if this is an audiobook purchase (one-time product)
        const AUDIOBOOK_PRODUCT_ID = 'prod_UGkRRCOAvVYkSC';
        const AUDIOBOOK_PRICE_ID   = 'price_1TICwNCaTyuNk1McXI7thCPo';
        let isAudiobookPurchase = false;

        // Detect via line items if available, or via metadata, or price/product match
        if (session.metadata?.product_id === 'rfm-audiobook') {
          isAudiobookPurchase = true;
        } else {
          // Check line items for the audiobook price
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
            for (const item of (lineItems.data || [])) {
              if (
                item.price?.id === AUDIOBOOK_PRICE_ID ||
                item.price?.product === AUDIOBOOK_PRODUCT_ID
              ) {
                isAudiobookPurchase = true;
                break;
              }
            }
          } catch (liErr) {
            console.warn('[checkout] Could not fetch line items:', liErr.message);
          }
        }

        if (isAudiobookPurchase && email) {
          // Record audiobook entitlement
          try {
            await sql`
              INSERT INTO digital_purchases (email, product_id, stripe_product_id, stripe_payment_intent, granted_by)
              VALUES (${email.toLowerCase()}, 'rfm-audiobook', ${AUDIOBOOK_PRODUCT_ID}, ${paymentIntentId || null}, 'purchase')
              ON CONFLICT (email, product_id) DO NOTHING
            `;
            console.log('[checkout] Audiobook purchase recorded for:', email);
          } catch (dpErr) {
            console.error('[checkout] Failed to record audiobook purchase:', dpErr.message);
          }
        } else if (email && tier) {
          // Membership subscription purchase — upsert user_profiles
          // Find contact by email
          // Case-insensitive contact lookup
          let contacts = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email} LIMIT 1`;

          // If no contact found, create one so the payment is never lost
          if (contacts.length === 0) {
            console.warn('[checkout] No contact found for', email, '— creating new contact');
            const nameParts = (session.customer_details?.name || '').split(' ');
            const firstName = nameParts[0] || 'New';
            const lastName = nameParts.slice(1).join(' ') || 'Member';
            contacts = await sql`
              INSERT INTO contacts (email, first_name, last_name, created_at)
              VALUES (${email}, ${firstName}, ${lastName}, NOW())
              ON CONFLICT (email) DO UPDATE SET email = ${email}
              RETURNING id
            `;
          }

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
            console.log('[checkout] Tier updated:', email, '→', tier, 'contact:', contactId);

            // Sync dating profile payment status
            try {
              await sql`UPDATE dating_profiles SET is_paid = true, stripe_subscription_id = ${subscriptionId} WHERE contact_id = ${contactId}`;
            } catch(e) { /* dating_profiles may not exist yet — that's OK */ }
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

        // Sync dating profile payment status on cancellation
        try {
          await sql`UPDATE dating_profiles SET is_paid = false, stripe_subscription_id = NULL WHERE stripe_subscription_id = ${subscriptionId}`;
        } catch(e) {}
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

      // Track subscription events in analytics
      try {
        const eventType = event.type === 'checkout.session.completed' ? 'subscription_created'
          : event.type === 'customer.subscription.deleted' ? 'subscription_cancelled'
          : event.type === 'customer.subscription.updated' ? 'subscription_updated'
          : null;
        if (eventType) {
          await sql`INSERT INTO analytics_events (event_type, metadata) VALUES (${eventType}, ${JSON.stringify({ stripe_event: event.type, stripe_event_id: event.id })}::jsonb)`;
        }
      } catch (e) { /* analytics table may not exist yet — non-fatal */ }

      // Forward Stripe events to n8n webhook (fire-and-forget, non-blocking)
      try {
        const n8nWebhookUrl = 'https://n8n.srv1138119.hstgr.cloud/webhook/stripe-webhook';
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: event.type, data: event.data.object }),
          signal: AbortSignal.timeout(5000)
        }).catch(() => {}); // Silent fail — n8n may be unreachable
      } catch (e) { /* n8n forward is best-effort */ }

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

      // Subscription downgrade protection: check if user already has a higher tier
      if (email) {
        try {
          const sql = neon(process.env.DATABASE_URL);
          const TIER_RANK = { free: 0, individual: 1, couple: 2, premium: 3 };
          const requestedRank = TIER_RANK[config.dbTier] || 0;
          const contacts = await sql`SELECT id FROM contacts WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
          if (contacts.length > 0) {
            const profiles = await sql`SELECT membership_tier FROM user_profiles WHERE contact_id = ${contacts[0].id} LIMIT 1`;
            if (profiles.length > 0 && profiles[0].membership_tier) {
              const currentRank = TIER_RANK[profiles[0].membership_tier] || 0;
              if (currentRank >= requestedRank && currentRank > 0) {
                return res.status(400).json({
                  error: `You already have an active ${profiles[0].membership_tier} subscription. To change your plan, please use the billing portal in your Member Dashboard.`,
                  currentTier: profiles[0].membership_tier,
                  requestedTier: config.dbTier,
                  billingPortalUrl: `${BASE_URL}/member`
                });
              }
            }
          }
        } catch (tierCheckErr) {
          // Non-blocking: if check fails, allow checkout to proceed
          console.warn('[Checkout] Tier check failed (non-blocking):', tierCheckErr.message);
        }
      }

      // Use hardcoded active prices directly -- env vars were stale/inactive
      const priceId = ACTIVE_PRICES[config.priceKey];
      console.log(`[Checkout] Using price ${priceId} for ${config.name} (${config.dbTier})`);

      const sessionParams = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${BASE_URL}/member?welcome=true&tier=${config.dbTier}`,
        cancel_url: `${BASE_URL}/pricing`,
        metadata: { tier: config.dbTier },
        allow_promotion_codes: true
      };

      if (email) {
        // Find existing Stripe customer to prevent duplicates
        try {
          const existingCustomers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
          if (existingCustomers.data.length > 0) {
            sessionParams.customer = existingCustomers.data[0].id;
            console.log(`[Checkout] Found existing customer ${existingCustomers.data[0].id} for ${email}`);
          } else {
            sessionParams.customer_email = email;
          }
        } catch (lookupErr) {
          console.warn('[Checkout] Customer lookup failed, using email:', lookupErr.message);
          sessionParams.customer_email = email;
        }
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
