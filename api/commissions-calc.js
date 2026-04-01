const { neon } = require('@neondatabase/serverless');

const COMMISSION_RATES = {
  victorypath: 500,
  individual: 500,
  builder: 500,
  couple: 500,
  vip: 1750,
  premium: 1750
};

const ROYALTY_TIERS = [
  { name: 'platinum', min: 250, bonus_cents: 500 },
  { name: 'gold', min: 100, bonus_cents: 300 },
  { name: 'silver', min: 50, bonus_cents: 200 },
  { name: 'bronze', min: 25, bonus_cents: 100 },
  { name: 'none', min: 0, bonus_cents: 0 }
];

function getRoyaltyTier(activeCount) {
  for (const tier of ROYALTY_TIERS) {
    if (activeCount >= tier.min) return tier;
  }
  return ROYALTY_TIERS[ROYALTY_TIERS.length - 1];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://assessment.valuetovictory.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Admin auth
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Calculate period dates for current month
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const periodStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

    let commissionsCreated = 0;
    let totalAmountCents = 0;
    const royaltyUpgrades = [];

    // Get all active partners
    const partners = await sql`
      SELECT id, referral_code, royalty_tier FROM partner_profiles WHERE status = 'active'
    `;

    for (const partner of partners) {
      // Get all active referrals for this partner
      const referrals = await sql`
        SELECT id, membership_tier FROM referrals
        WHERE partner_id = ${partner.id} AND status IN ('active', 'upgraded')
      `;

      for (const ref of referrals) {
        // Check if commission already exists for this referral+month
        const existing = await sql`
          SELECT id FROM commissions
          WHERE referral_id = ${ref.id} AND type = 'signup_recurring'
            AND period_start = ${periodStart} AND period_end = ${periodEnd}
          LIMIT 1
        `;
        if (existing.length > 0) continue;

        const amount = COMMISSION_RATES[ref.membership_tier] || 500;
        const description = `Monthly recurring for ${ref.membership_tier || 'unknown'} member (${monthLabel})`;

        await sql`
          INSERT INTO commissions (partner_id, referral_id, type, amount_cents, description, period_start, period_end, status)
          VALUES (${partner.id}, ${ref.id}, 'signup_recurring', ${amount}, ${description}, ${periodStart}, ${periodEnd}, 'pending')
        `;

        commissionsCreated++;
        totalAmountCents += amount;
      }

      // Royalty tier bonus
      const activeCount = referrals.length;
      const newTier = getRoyaltyTier(activeCount);
      const oldTierName = partner.royalty_tier || 'none';

      if (newTier.name !== 'none' && activeCount > 0) {
        // Check if royalty bonus already exists for this partner+month
        const existingRoyalty = await sql`
          SELECT id FROM commissions
          WHERE partner_id = ${partner.id} AND type = 'royalty_bonus'
            AND period_start = ${periodStart} AND period_end = ${periodEnd}
          LIMIT 1
        `;

        if (existingRoyalty.length === 0) {
          const royaltyTotal = newTier.bonus_cents * activeCount;
          const royaltyDesc = `${newTier.name} royalty: ${newTier.bonus_cents}¢ × ${activeCount} active members (${monthLabel})`;

          await sql`
            INSERT INTO commissions (partner_id, type, amount_cents, description, period_start, period_end, status)
            VALUES (${partner.id}, 'royalty_bonus', ${royaltyTotal}, ${royaltyDesc}, ${periodStart}, ${periodEnd}, 'pending')
          `;

          commissionsCreated++;
          totalAmountCents += royaltyTotal;
        }
      }

      // Update royalty tier if changed
      if (newTier.name !== oldTierName) {
        await sql`
          UPDATE partner_profiles SET royalty_tier = ${newTier.name}, updated_at = NOW()
          WHERE id = ${partner.id}
        `;
        royaltyUpgrades.push(`${partner.referral_code}: ${oldTierName} → ${newTier.name}`);
      }

      // Update partner total earnings
      const earningsRows = await sql`
        SELECT COALESCE(SUM(amount_cents), 0) AS total FROM commissions WHERE partner_id = ${partner.id}
      `;
      await sql`
        UPDATE partner_profiles SET total_earnings_cents = ${earningsRows[0].total}, updated_at = NOW()
        WHERE id = ${partner.id}
      `;
    }

    return res.json({
      success: true,
      month: monthLabel,
      partners_processed: partners.length,
      commissions_created: commissionsCreated,
      total_amount_cents: totalAmountCents,
      royalty_upgrades: royaltyUpgrades
    });
  } catch (err) {
    console.error('Commission calc error:', err);
    return res.status(500).json({ error: err.message });
  }
};
