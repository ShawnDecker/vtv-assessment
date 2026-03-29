const Stripe = require('stripe');
const { neon } = require('@neondatabase/serverless');

const TIER_CONFIG = {
  victorypath: { amount: 2900, name: 'VictoryPath Membership', tier: 'victorypath', envKey: 'STRIPE_PRICE_INDIVIDUAL' },
  individual: { amount: 2900, name: 'VictoryPath Membership', tier: 'victorypath', envKey: 'STRIPE_PRICE_INDIVIDUAL' },
  builder: { amount: 4700, name: 'Value Builder', tier: 'builder', envKey: 'STRIPE_PRICE_COUPLE' },
  couple: { amount: 4700, name: 'Value Builder', tier: 'builder', envKey: 'STRIPE_PRICE_COUPLE' },
  vip: { amount: 49700, name: 'Victory VIP', tier: 'vip', envKey: 'STRIPE_PRICE_PREMIUM' },
  premium: { amount: 49700, name: 'Victory VIP', tier: 'vip', envKey: 'STRIPE_PRICE_PREMIUM' }
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
        // For Vercel, the raw body is available as a buffer
        const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
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
        const tier = session.metadata?.tier;
        const sessionType = session.metadata?.type;

        // Handle one-time report purchase
        if (sessionType === 'report') {
          const assessmentId = session.metadata?.assessmentId;
          if (assessmentId) {
            try {
              // Ensure column exists
              await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_unlocked BOOLEAN DEFAULT FALSE`;
            } catch (e) { /* already exists */ }
            // Mark report as unlocked
            try {
              await sql`UPDATE assessments SET report_unlocked = TRUE WHERE id = ${parseInt(assessmentId)}`;
              console.log(`Report unlocked for assessment ${assessmentId}`);
            } catch (e) {
              console.error('Failed to unlock report:', e.message);
            }
            // Send full report email if we have an email
            if (email) {
              try {
                const aRows = await sql`SELECT a.*, c.first_name, c.last_name, c.email FROM assessments a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ${parseInt(assessmentId)} LIMIT 1`;
                if (aRows.length > 0) {
                  const a = aRows[0];
                  const nodemailer = require('nodemailer');
                  const firstName = a.first_name || 'there';
                  const masterScore = a.master_score;
                  const scoreRange = a.score_range;
                  const reportUrl = `https://assessment.valuetovictory.com/report/${assessmentId}?unlocked=true`;

                  const fullReportSubject = `Your Full Value Engine Report is Ready \u2014 ${masterScore} (${scoreRange})`;
                  const fullReportBody = `${firstName},\n\nYour payment was received and your full Value Engine report is now unlocked.\n\nView your complete diagnostic report here:\n${reportUrl}\n\nYour report includes sub-category breakdowns, cross-pillar impact analysis, personalized prescription, and benchmark percentiles.\n\n\u2014 The Value Engine\n   ValueToVictory.com`;

                  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
                    const transporter = nodemailer.createTransport({
                      service: 'gmail',
                      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
                    });
                    await transporter.sendMail({
                      from: `"The Value Engine" <${process.env.GMAIL_USER}>`,
                      to: email,
                      subject: fullReportSubject,
                      text: fullReportBody,
                    });
                    console.log(`Full report unlock email sent to ${email} for assessment ${assessmentId}`);
                  }
                }
              } catch (e) {
                console.error('Failed to send report unlock email:', e.message);
              }
            }
          }
        } else if (email && tier) {
          // Handle subscription purchase (existing logic)
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
      const aid = params.get('aid');

      // Handle one-time $1.99 report purchase
      if (tier === 'report') {
        if (!aid) return res.status(400).json({ error: 'aid (assessmentId) required for report purchase' });
        const sql = neon(process.env.DATABASE_URL);

        // Look up contact ID from the assessment
        let contactId = null;
        try {
          const aRows = await sql`SELECT contact_id FROM assessments WHERE id = ${parseInt(aid)} LIMIT 1`;
          if (aRows.length > 0) contactId = aRows[0].contact_id;
        } catch (e) { /* assessment may not exist */ }

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'P.I.N.K. Assessment Report',
                description: 'Full diagnostic report with Individual, Relationship, and Company impact analysis',
              },
              unit_amount: 199, // $1.99
            },
            quantity: 1,
          }],
          customer_email: email || undefined,
          metadata: { assessmentId: aid, contactId: String(contactId || ''), type: 'report' },
          success_url: `https://assessment.valuetovictory.com/report/${aid}?unlocked=true`,
          cancel_url: `https://assessment.valuetovictory.com/report/${aid}?payment=cancelled`,
        });
        res.writeHead(303, { Location: session.url });
        return res.end();
      }

      if (!tier || !TIER_CONFIG[tier]) {
        return res.status(400).json({ error: 'Invalid tier. Must be: victorypath, builder, vip, or report' });
      }

      const config = TIER_CONFIG[tier];

      // Resolve price ID: use env var if set, otherwise create price dynamically
      let priceId;
      const envPriceKey = config.envKey || `STRIPE_PRICE_${tier.toUpperCase()}`;
      const envPriceId = process.env[envPriceKey];

      if (envPriceId) {
        priceId = envPriceId;
      } else {
        // Create a price dynamically
        const price = await stripe.prices.create({
          unit_amount: config.amount,
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: { name: `Value Engine — ${config.name}` }
        });
        priceId = price.id;
      }

      const sessionParams = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${BASE_URL}/onboarding?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/pricing`,
        metadata: { tier },
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
