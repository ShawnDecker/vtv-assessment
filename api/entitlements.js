const { neon } = require('@neondatabase/serverless');

// Product IDs that VIP (premium) members get automatically
const VIP_PRODUCTS = ['rfm-audiobook'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = new URL('http://x' + req.url).searchParams;
  const email = (params.get('email') || '').toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Look up membership tier from user_profiles via contacts join
    let tier = 'free';
    try {
      const profileRows = await sql`
        SELECT up.membership_tier
        FROM user_profiles up
        JOIN contacts c ON c.id = up.contact_id
        WHERE LOWER(c.email) = ${email}
        LIMIT 1
      `;
      if (profileRows.length > 0) {
        tier = profileRows[0].membership_tier || 'free';
      }
    } catch (lookupErr) {
      // user_profiles or contacts may not exist yet; treat as free
      console.warn('[entitlements] Profile lookup error:', lookupErr.message);
    }

    const isVip = tier === 'premium';

    // Build products map
    const products = {};

    if (isVip) {
      // Victory VIP members get all products automatically
      for (const productId of VIP_PRODUCTS) {
        products[productId] = { entitled: true, granted_by: 'vip_auto' };
      }
    } else {
      // Check digital_purchases for each known product
      let purchases = [];
      try {
        purchases = await sql`
          SELECT product_id, granted_by, granted_at
          FROM digital_purchases
          WHERE LOWER(email) = ${email}
        `;
      } catch (purchaseErr) {
        // digital_purchases table may not exist yet (pre-migration)
        console.warn('[entitlements] digital_purchases lookup error:', purchaseErr.message);
      }

      const purchaseMap = {};
      for (const row of purchases) {
        purchaseMap[row.product_id] = {
          entitled: true,
          granted_by: row.granted_by,
          granted_at: row.granted_at
        };
      }

      for (const productId of VIP_PRODUCTS) {
        if (purchaseMap[productId]) {
          products[productId] = purchaseMap[productId];
        } else {
          products[productId] = { entitled: false };
        }
      }
    }

    return res.json({
      email,
      tier,
      is_vip: isVip,
      products
    });
  } catch (err) {
    console.error('[entitlements] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
