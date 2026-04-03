const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Map of product slugs to Stripe price IDs
const PRICE_MAP = {
  // Subscriptions (recurring)
  'victorypath':        { priceId: 'price_1THTlxCaTyuNk1McUWDRZOzz', type: 'subscription' },
  'value-builder':      { priceId: 'price_1THT4tCaTyuNk1Mc1xzlrxu9', type: 'subscription' },
  'victory-vip':        { priceId: 'price_1TEhZ8CaTyuNk1McPoAJBpYW', type: 'subscription' },
  // One-time products
  'loav-presale':       { priceId: 'price_1TI7KoCaTyuNk1McT6wNz2dp', type: 'one_time' },
  'rfm-audiobook':      { priceId: 'price_1TI7qBCaTyuNk1McdWQWrir8', type: 'one_time' },
  'rfm-paperback':      { priceId: 'price_1TI7qBCaTyuNk1Mcl4ZZmuQR', type: 'one_time' },
  'mastering-listings': { priceId: 'price_1TCOG2CaTyuNk1Mc1NhmQM8h', type: 'one_time' },
  // Add-on reports ($1.99)
  'action-plan':        { priceId: 'price_1TFGSQCaTyuNk1McAAxcJv87', type: 'one_time' },
  'counselor-report':   { priceId: 'price_1TFGSXCaTyuNk1McoVIPrXFK', type: 'one_time' },
  'team-report':        { priceId: 'price_1TFGSeCaTyuNk1Mcq99Zlknn', type: 'one_time' },
};

module.exports = async (req, res) => {
  // CORS
  const allowedOrigins = [
    'https://valuetovictory.com',
    'https://www.valuetovictory.com',
    'https://assessment.valuetovictory.com',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, email } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate and build line items
    const lineItems = [];
    let hasSubscription = false;
    let hasOneTime = false;

    for (const item of items) {
      const mapped = PRICE_MAP[item.slug];
      if (!mapped) {
        return res.status(400).json({ error: `Unknown product: ${item.slug}` });
      }
      lineItems.push({
        price: mapped.priceId,
        quantity: item.quantity || 1,
      });
      if (mapped.type === 'subscription') hasSubscription = true;
      if (mapped.type === 'one_time') hasOneTime = true;
    }

    // Stripe allows mixing subscription + one-time in the same session
    // using mode: 'subscription' — one-time items become immediate charges
    const mode = hasSubscription ? 'subscription' : 'payment';

    const sessionParams = {
      mode,
      line_items: lineItems,
      success_url: 'https://assessment.valuetovictory.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://valuetovictory.com/#products',
      allow_promotion_codes: true,
    };

    // Add trial for subscriptions
    if (hasSubscription) {
      sessionParams.subscription_data = { trial_period_days: 3 };
    }

    // Pre-fill email if provided
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Cart checkout error:', err);
    return res.status(500).json({ error: err.message || 'Checkout failed' });
  }
};
