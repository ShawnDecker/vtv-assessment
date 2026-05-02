const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const ALLOWED_ORIGINS = ['https://valuetovictory.com','https://www.valuetovictory.com','https://assessment.valuetovictory.com','https://shawnedecker.com','http://localhost:3000','http://localhost:5173'];

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Vary', 'Origin');
}

function requireAdmin(req) {
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  return !!(validKey && apiKey === validKey);
}

// Industries VTV will not serve — values-based filter
const DECLINED_INDUSTRIES = [
  'adult entertainment', 'pornography', 'gambling', 'casino',
  'tobacco', 'vaping', 'cannabis', 'marijuana', 'weapons',
  'firearms', 'payday lending', 'escort', 'strip club',
  'kratom', 'psychedelics', 'betting', 'sportsbook'
];

function checkValuesAlignment(industry, description) {
  const combined = `${industry} ${description}`.toLowerCase();
  for (const declined of DECLINED_INDUSTRIES) {
    if (combined.includes(declined)) return false;
  }
  return true;
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/growth', '').replace(/^\//, '');

  try {

    // ================================================================
    // POST /api/growth/migrate — Create all growth agent tables + seed rules
    // ================================================================
    if (req.method === 'POST' && path === 'migrate') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      // Growth intake submissions
      await sql`CREATE TABLE IF NOT EXISTS growth_intake (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        website TEXT,
        industry TEXT NOT NULL,
        business_model TEXT NOT NULL,
        monthly_revenue TEXT,
        monthly_ad_spend TEXT,
        target_audience TEXT NOT NULL,
        primary_goal TEXT NOT NULL,
        biggest_challenge TEXT NOT NULL,
        current_platforms TEXT,
        timeline TEXT,
        values_aligned BOOLEAN DEFAULT true,
        declined_reason TEXT,
        feasibility_score FLOAT,
        market_score FLOAT,
        readiness_score FLOAT,
        overall_score FLOAT,
        ai_report TEXT,
        ai_report_generated_at TIMESTAMP,
        status TEXT DEFAULT 'pending',
        calendly_unlocked BOOLEAN DEFAULT false,
        call_booked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_growth_intake_email ON growth_intake(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_growth_intake_status ON growth_intake(status)`;

      // Growth campaigns — tracks active client campaigns
      await sql`CREATE TABLE IF NOT EXISTS growth_campaigns (
        id SERIAL PRIMARY KEY,
        intake_id INTEGER REFERENCES growth_intake(id),
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        platform TEXT NOT NULL,
        campaign_name TEXT NOT NULL,
        campaign_type TEXT DEFAULT 'acquisition',
        status TEXT DEFAULT 'planning',
        daily_budget NUMERIC(10,2),
        total_spend NUMERIC(10,2) DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue_generated NUMERIC(10,2) DEFAULT 0,
        cac NUMERIC(10,2),
        roas NUMERIC(10,4),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_growth_campaigns_client ON growth_campaigns(client_email)`;

      // Growth creatives — AI-generated ad copy, hooks, CTAs
      await sql`CREATE TABLE IF NOT EXISTS growth_creatives (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES growth_campaigns(id),
        creative_type TEXT NOT NULL,
        headline TEXT,
        body_copy TEXT,
        hook TEXT,
        cta TEXT,
        platform TEXT,
        target_audience TEXT,
        performance_score FLOAT,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        ctr FLOAT,
        status TEXT DEFAULT 'draft',
        ai_generated BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

      // Growth funnel pages — tracks landing page performance
      await sql`CREATE TABLE IF NOT EXISTS growth_funnels (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES growth_campaigns(id),
        page_name TEXT NOT NULL,
        page_url TEXT,
        page_type TEXT DEFAULT 'landing',
        headline TEXT,
        subheadline TEXT,
        cta_text TEXT,
        visitors INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        conversion_rate FLOAT DEFAULT 0,
        bounce_rate FLOAT DEFAULT 0,
        avg_time_on_page INTEGER DEFAULT 0,
        ab_variant TEXT DEFAULT 'control',
        status TEXT DEFAULT 'active',
        ai_recommendations TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

      // Growth metrics snapshots — periodic ROAS/CAC/LTV calculations
      await sql`CREATE TABLE IF NOT EXISTS growth_metrics (
        id SERIAL PRIMARY KEY,
        client_email TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_spend NUMERIC(10,2) DEFAULT 0,
        total_revenue NUMERIC(10,2) DEFAULT 0,
        total_conversions INTEGER DEFAULT 0,
        cac NUMERIC(10,2),
        roas NUMERIC(10,4),
        ltv NUMERIC(10,2),
        payback_days INTEGER,
        best_platform TEXT,
        best_campaign TEXT,
        ai_insights TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_email, period_start)
      )`;

      // Seed growth agent rules
      const seedRules = [
        // Ad Strategist Agent
        ['growth-ads', 'high_cac_alert', JSON.stringify({threshold_multiplier: 2.0, action: 'recommend_pause_or_retarget'}), 1.5],
        ['growth-ads', 'low_roas_campaign', JSON.stringify({threshold: 1.0, action: 'flag_underperforming'}), 1.3],
        ['growth-ads', 'budget_reallocation', JSON.stringify({condition: 'roas_variance_gt_50pct', action: 'shift_budget_to_winner'}), 1.8],
        ['growth-ads', 'platform_fatigue', JSON.stringify({condition: 'ctr_declining_3_days', action: 'suggest_creative_refresh'}), 1.2],
        ['growth-ads', 'scale_winner', JSON.stringify({condition: 'roas_gt_3x_for_7_days', action: 'recommend_budget_increase'}), 2.0],
        // Creative Agent
        ['growth-creative', 'hook_rotation', JSON.stringify({condition: 'creative_over_7_days', action: 'generate_new_hooks'}), 1.0],
        ['growth-creative', 'low_ctr_refresh', JSON.stringify({threshold: 0.5, action: 'generate_new_creative'}), 1.4],
        ['growth-creative', 'winning_angle_amplify', JSON.stringify({condition: 'ctr_gt_2pct', action: 'create_variations'}), 1.6],
        ['growth-creative', 'audience_mismatch', JSON.stringify({condition: 'high_impressions_low_clicks', action: 'adjust_copy_angle'}), 1.3],
        // Funnel Agent
        ['growth-funnel', 'high_bounce_page', JSON.stringify({threshold: 0.7, action: 'recommend_copy_change'}), 1.5],
        ['growth-funnel', 'low_conversion_page', JSON.stringify({threshold: 0.02, action: 'suggest_ab_test'}), 1.7],
        ['growth-funnel', 'drop_off_detected', JSON.stringify({threshold: 0.5, action: 'simplify_form_or_cta'}), 1.4],
        ['growth-funnel', 'time_on_page_low', JSON.stringify({threshold_seconds: 15, action: 'strengthen_headline'}), 1.1],
        // Analytics Agent
        ['growth-analytics', 'weekly_report_due', JSON.stringify({schedule: 'weekly', action: 'generate_report'}), 1.0],
        ['growth-analytics', 'anomaly_detection', JSON.stringify({condition: 'metric_change_gt_30pct', action: 'flag_and_investigate'}), 2.0],
        ['growth-analytics', 'ltv_declining', JSON.stringify({condition: 'ltv_down_2_periods', action: 'alert_retention_issue'}), 1.8],
        ['growth-analytics', 'payback_extending', JSON.stringify({condition: 'payback_days_increasing', action: 'review_pricing_or_cac'}), 1.5],
        // Growth Coordinator
        ['growth-coordinator', 'creative_aligns_targeting', JSON.stringify({action: 'sync_creative_with_ad_targeting'}), 1.3],
        ['growth-coordinator', 'funnel_matches_traffic', JSON.stringify({action: 'ensure_landing_page_matches_ad'}), 1.5],
        ['growth-coordinator', 'budget_exhausted_pause_creative', JSON.stringify({action: 'pause_creative_production'}), 2.0],
        ['growth-coordinator', 'analytics_feeds_all', JSON.stringify({action: 'distribute_insights_to_agents'}), 1.0],
      ];

      for (const [agent, key, config, weight] of seedRules) {
        await sql`INSERT INTO agent_rules (agent_name, rule_key, rule_config, weight)
          VALUES (${agent}, ${key}, ${config}::jsonb, ${weight})
          ON CONFLICT (agent_name, rule_key) DO NOTHING`;
      }

      return res.json({ success: true, message: 'Growth agent tables created and rules seeded' });
    }

    // ================================================================
    // POST /api/growth/intake — Client submits intake questionnaire
    // ================================================================
    if (req.method === 'POST' && path === 'intake') {
      const {
        companyName, contactName, email, phone, website,
        industry, businessModel, monthlyRevenue, monthlyAdSpend,
        targetAudience, primaryGoal, biggestChallenge,
        currentPlatforms, timeline
      } = req.body || {};

      // Validate required fields
      if (!companyName || !contactName || !email || !industry || !businessModel ||
          !targetAudience || !primaryGoal || !biggestChallenge) {
        return res.status(400).json({ error: 'All required fields must be completed' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Valid email address required' });
      }

      // Values alignment check
      const aligned = checkValuesAlignment(industry, `${companyName} ${businessModel} ${primaryGoal}`);

      if (!aligned) {
        // Politely decline — store record but mark declined
        await sql`INSERT INTO growth_intake
          (company_name, contact_name, email, phone, website, industry, business_model,
           monthly_revenue, monthly_ad_spend, target_audience, primary_goal, biggest_challenge,
           current_platforms, timeline, values_aligned, declined_reason, status)
          VALUES (${companyName}, ${contactName}, ${email.toLowerCase()}, ${phone || null}, ${website || null},
           ${industry}, ${businessModel}, ${monthlyRevenue || null}, ${monthlyAdSpend || null},
           ${targetAudience}, ${primaryGoal}, ${biggestChallenge},
           ${currentPlatforms || null}, ${timeline || null}, false,
           'Industry does not align with VTV values and mission',
           'declined')`;

        return res.json({
          success: false,
          declined: true,
          message: 'Thank you for your interest in Value to Victory Growth Services. After reviewing your submission, we\'ve determined that your industry falls outside the scope of brands we partner with. VTV is committed to serving businesses that align with our faith-driven mission and values. We wish you the best in your growth journey and encourage you to explore other marketing partners who may be a better fit for your specific industry.'
        });
      }

      // Score the intake for feasibility, market readiness, and client readiness
      const feasibility = scoreIntake({ monthlyRevenue, monthlyAdSpend, businessModel, website });
      const market = scoreMarket({ industry, targetAudience, currentPlatforms });
      const readiness = scoreReadiness({ timeline, primaryGoal, biggestChallenge, monthlyAdSpend });
      const overall = ((feasibility + market + readiness) / 3).toFixed(1);

      // Insert the intake
      const rows = await sql`INSERT INTO growth_intake
        (company_name, contact_name, email, phone, website, industry, business_model,
         monthly_revenue, monthly_ad_spend, target_audience, primary_goal, biggest_challenge,
         current_platforms, timeline, values_aligned,
         feasibility_score, market_score, readiness_score, overall_score, status)
        VALUES (${companyName}, ${contactName}, ${email.toLowerCase()}, ${phone || null}, ${website || null},
         ${industry}, ${businessModel}, ${monthlyRevenue || null}, ${monthlyAdSpend || null},
         ${targetAudience}, ${primaryGoal}, ${biggestChallenge},
         ${currentPlatforms || null}, ${timeline || null}, true,
         ${feasibility}, ${market}, ${readiness}, ${parseFloat(overall)},
         'submitted')
        RETURNING id`;

      const intakeId = rows[0].id;

      // Generate AI design report (async — fire and forget, result stored in DB)
      generateDesignReport(sql, intakeId, {
        companyName, contactName, industry, businessModel, monthlyRevenue,
        monthlyAdSpend, targetAudience, primaryGoal, biggestChallenge,
        currentPlatforms, timeline, feasibility, market, readiness, overall
      }).catch(err => console.error('[growth/intake] AI report generation failed:', err.message));

      // Notify Shawn via email
      notifyOwner(sql, {
        companyName, contactName, email, industry, businessModel,
        monthlyRevenue, monthlyAdSpend, overall, intakeId
      }).catch(err => console.error('[growth/intake] Owner notification failed:', err.message));

      return res.json({
        success: true,
        intakeId,
        scores: { feasibility, market, readiness, overall: parseFloat(overall) },
        calendlyUnlocked: parseFloat(overall) >= 4.0,
        message: parseFloat(overall) >= 4.0
          ? 'Your Growth Profile looks strong. Book your discovery call below — we\'ll have your custom design report ready before the meeting.'
          : 'Thank you for submitting your Growth Profile. Our team will review your information and reach out within 24 hours to discuss next steps.'
      });
    }

    // ================================================================
    // GET /api/growth/intake/:id — Retrieve intake + AI report
    // ================================================================
    if (req.method === 'GET' && path.match(/^intake\/\d+$/)) {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const id = path.split('/')[1];
      const rows = await sql`SELECT * FROM growth_intake WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Intake not found' });
      return res.json(rows[0]);
    }

    // ================================================================
    // GET /api/growth/intakes — List all intakes (admin)
    // ================================================================
    if (req.method === 'GET' && path === 'intakes') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const rows = await sql`SELECT id, company_name, contact_name, email, industry,
        overall_score, status, values_aligned, calendly_unlocked, created_at
        FROM growth_intake ORDER BY created_at DESC LIMIT 50`;
      return res.json({ intakes: rows });
    }

    // ================================================================
    // GET /api/growth/report/:id — Get the AI design report for an intake
    // ================================================================
    if (req.method === 'GET' && path.match(/^report\/\d+$/)) {
      const id = path.split('/')[1];
      const rows = await sql`SELECT id, company_name, contact_name, email, industry,
        business_model, feasibility_score, market_score, readiness_score, overall_score,
        ai_report, ai_report_generated_at, status
        FROM growth_intake WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Report not found' });
      if (!rows[0].ai_report) return res.json({ ready: false, message: 'Report is still being generated. Check back in 30 seconds.' });
      return res.json({ ready: true, report: rows[0] });
    }

    // ================================================================
    // GET /api/growth/ads/run — Ad Strategist Agent OODA loop
    // ================================================================
    if (req.method === 'GET' && path === 'ads/run') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      // OBSERVE — get all active campaigns
      const campaigns = await sql`SELECT * FROM growth_campaigns WHERE status = 'active'`;
      const observations = { campaign_count: campaigns.length, campaigns: [] };

      const decisions = [];
      const actions = [];

      // Get rules sorted by weight
      const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'growth-ads' ORDER BY weight DESC`;

      for (const camp of campaigns) {
        const cac = camp.conversions > 0 ? (parseFloat(camp.total_spend) / camp.conversions) : null;
        const roas = parseFloat(camp.total_spend) > 0 ? (parseFloat(camp.revenue_generated) / parseFloat(camp.total_spend)) : 0;
        const ctr = camp.impressions > 0 ? (camp.clicks / camp.impressions) : 0;

        const campObs = {
          id: camp.id, name: camp.campaign_name, platform: camp.platform,
          spend: parseFloat(camp.total_spend), revenue: parseFloat(camp.revenue_generated),
          cac, roas, ctr, impressions: camp.impressions, clicks: camp.clicks, conversions: camp.conversions
        };
        observations.campaigns.push(campObs);

        // ORIENT + DECIDE — evaluate rules
        for (const rule of rules) {
          const config = rule.rule_config || {};
          let fired = false;

          if (rule.rule_key === 'high_cac_alert' && cac && camp.daily_budget && cac > parseFloat(camp.daily_budget) * (config.threshold_multiplier || 2)) {
            decisions.push({ rule: rule.rule_key, campaign: camp.campaign_name, cac, action: 'Recommend pause or retarget — CAC exceeds threshold' });
            fired = true;
          }
          if (rule.rule_key === 'low_roas_campaign' && roas < (config.threshold || 1.0) && parseFloat(camp.total_spend) > 100) {
            decisions.push({ rule: rule.rule_key, campaign: camp.campaign_name, roas, action: 'Flag underperforming — ROAS below 1.0x' });
            fired = true;
          }
          if (rule.rule_key === 'scale_winner' && roas > 3.0 && parseFloat(camp.total_spend) > 200) {
            decisions.push({ rule: rule.rule_key, campaign: camp.campaign_name, roas, action: 'Recommend 20% budget increase — strong ROAS sustained' });
            fired = true;
          }
          if (rule.rule_key === 'platform_fatigue' && ctr < 0.005 && camp.impressions > 5000) {
            decisions.push({ rule: rule.rule_key, campaign: camp.campaign_name, ctr, action: 'Suggest creative refresh — CTR declining' });
            fired = true;
          }

          if (fired) {
            await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW() WHERE id = ${rule.id}`;
          }
        }
      }

      // ACT — log state
      await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
        VALUES ('growth-ads', ${JSON.stringify(observations)}::jsonb, ${JSON.stringify(decisions)}::jsonb,
        ${JSON.stringify({ evaluated: campaigns.length, alerts: decisions.length })}::jsonb)`;

      return res.json({ success: true, agent: 'growth-ads', observations, decisions, actions: { evaluated: campaigns.length, alerts: decisions.length } });
    }

    // ================================================================
    // GET /api/growth/creative/run — Creative Agent OODA loop
    // ================================================================
    if (req.method === 'GET' && path === 'creative/run') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      const creatives = await sql`SELECT gc.*, gca.campaign_name, gca.platform as camp_platform
        FROM growth_creatives gc
        LEFT JOIN growth_campaigns gca ON gc.campaign_id = gca.id
        WHERE gc.status = 'active'`;

      const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'growth-creative' ORDER BY weight DESC`;
      const observations = { creative_count: creatives.length, creatives: [] };
      const decisions = [];

      for (const cr of creatives) {
        const ctr = cr.impressions > 0 ? (cr.clicks / cr.impressions) : 0;
        const age_days = Math.floor((Date.now() - new Date(cr.created_at).getTime()) / 86400000);
        const crObs = { id: cr.id, type: cr.creative_type, headline: cr.headline, ctr, impressions: cr.impressions, clicks: cr.clicks, age_days };
        observations.creatives.push(crObs);

        for (const rule of rules) {
          const config = rule.rule_config || {};
          let fired = false;

          if (rule.rule_key === 'hook_rotation' && age_days > 7) {
            decisions.push({ rule: rule.rule_key, creative_id: cr.id, action: 'Generate new hooks — creative over 7 days old' });
            fired = true;
          }
          if (rule.rule_key === 'low_ctr_refresh' && ctr < (config.threshold || 0.5) / 100 && cr.impressions > 1000) {
            decisions.push({ rule: rule.rule_key, creative_id: cr.id, ctr, action: 'Generate new creative — CTR below threshold' });
            fired = true;
          }
          if (rule.rule_key === 'winning_angle_amplify' && ctr > 0.02) {
            decisions.push({ rule: rule.rule_key, creative_id: cr.id, ctr, action: 'Create variations of winning creative' });
            fired = true;
          }

          if (fired) {
            await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW() WHERE id = ${rule.id}`;
          }
        }
      }

      await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
        VALUES ('growth-creative', ${JSON.stringify(observations)}::jsonb, ${JSON.stringify(decisions)}::jsonb,
        ${JSON.stringify({ evaluated: creatives.length, actions: decisions.length })}::jsonb)`;

      return res.json({ success: true, agent: 'growth-creative', observations, decisions });
    }

    // ================================================================
    // POST /api/growth/creative/generate — AI generates ad copy for a campaign
    // ================================================================
    if (req.method === 'POST' && path === 'creative/generate') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { campaignId, platform, targetAudience, productDescription, tone } = req.body || {};
      if (!campaignId || !platform || !targetAudience) {
        return res.status(400).json({ error: 'campaignId, platform, and targetAudience required' });
      }

      const campaign = await sql`SELECT * FROM growth_campaigns WHERE id = ${campaignId}`;
      if (campaign.length === 0) return res.status(404).json({ error: 'Campaign not found' });

      // Call AI to generate creatives
      const aiResult = await callGrowthAI(sql, 'creative-generate', {
        platform, targetAudience, productDescription, tone,
        campaignName: campaign[0].campaign_name, clientName: campaign[0].client_name
      });

      if (aiResult.error) return res.status(502).json({ error: aiResult.error });

      // Parse AI output and store creatives
      const creativeData = parseCreativeOutput(aiResult.content);
      const stored = [];
      for (const c of creativeData) {
        const row = await sql`INSERT INTO growth_creatives
          (campaign_id, creative_type, headline, body_copy, hook, cta, platform, target_audience, ai_generated)
          VALUES (${campaignId}, ${c.type || 'ad'}, ${c.headline}, ${c.body}, ${c.hook}, ${c.cta}, ${platform}, ${targetAudience}, true)
          RETURNING id`;
        stored.push({ id: row[0].id, ...c });
      }

      return res.json({ success: true, creatives: stored, raw: aiResult.content });
    }

    // ================================================================
    // GET /api/growth/funnel/run — Funnel Agent OODA loop
    // ================================================================
    if (req.method === 'GET' && path === 'funnel/run') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      const funnels = await sql`SELECT * FROM growth_funnels WHERE status = 'active'`;
      const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'growth-funnel' ORDER BY weight DESC`;
      const observations = { funnel_count: funnels.length, pages: [] };
      const decisions = [];

      for (const pg of funnels) {
        const convRate = pg.visitors > 0 ? (pg.conversions / pg.visitors) : 0;
        const pgObs = {
          id: pg.id, name: pg.page_name, type: pg.page_type,
          visitors: pg.visitors, conversions: pg.conversions,
          conversion_rate: convRate, bounce_rate: pg.bounce_rate,
          avg_time: pg.avg_time_on_page, variant: pg.ab_variant
        };
        observations.pages.push(pgObs);

        for (const rule of rules) {
          const config = rule.rule_config || {};
          let fired = false;

          if (rule.rule_key === 'high_bounce_page' && pg.bounce_rate > (config.threshold || 0.7) && pg.visitors > 50) {
            decisions.push({ rule: rule.rule_key, page: pg.page_name, bounce_rate: pg.bounce_rate, action: 'Recommend headline/copy change — bounce rate too high' });
            fired = true;
          }
          if (rule.rule_key === 'low_conversion_page' && convRate < (config.threshold || 0.02) && pg.visitors > 100) {
            decisions.push({ rule: rule.rule_key, page: pg.page_name, conversion_rate: convRate, action: 'Suggest A/B test — conversion below 2%' });
            fired = true;
          }
          if (rule.rule_key === 'drop_off_detected' && pg.bounce_rate > 0.5 && convRate < 0.01) {
            decisions.push({ rule: rule.rule_key, page: pg.page_name, action: 'Simplify form or CTA — high drop-off detected' });
            fired = true;
          }
          if (rule.rule_key === 'time_on_page_low' && pg.avg_time_on_page < (config.threshold_seconds || 15) && pg.visitors > 50) {
            decisions.push({ rule: rule.rule_key, page: pg.page_name, avg_time: pg.avg_time_on_page, action: 'Strengthen headline — visitors leaving too quickly' });
            fired = true;
          }

          if (fired) {
            await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW() WHERE id = ${rule.id}`;
          }
        }
      }

      await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
        VALUES ('growth-funnel', ${JSON.stringify(observations)}::jsonb, ${JSON.stringify(decisions)}::jsonb,
        ${JSON.stringify({ evaluated: funnels.length, actions: decisions.length })}::jsonb)`;

      return res.json({ success: true, agent: 'growth-funnel', observations, decisions });
    }

    // ================================================================
    // GET /api/growth/analytics/run — Analytics Agent OODA loop
    // ================================================================
    if (req.method === 'GET' && path === 'analytics/run') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      // Aggregate metrics per client for the last 7 days
      const clients = await sql`SELECT DISTINCT client_email FROM growth_campaigns WHERE status = 'active'`;
      const rules = await sql`SELECT * FROM agent_rules WHERE agent_name = 'growth-analytics' ORDER BY weight DESC`;
      const observations = { client_count: clients.length, metrics: [] };
      const decisions = [];

      for (const client of clients) {
        const camps = await sql`SELECT * FROM growth_campaigns WHERE client_email = ${client.client_email} AND status = 'active'`;

        let totalSpend = 0, totalRevenue = 0, totalConversions = 0;
        for (const c of camps) {
          totalSpend += parseFloat(c.total_spend || 0);
          totalRevenue += parseFloat(c.revenue_generated || 0);
          totalConversions += (c.conversions || 0);
        }

        const cac = totalConversions > 0 ? (totalSpend / totalConversions) : null;
        const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
        const bestCamp = camps.reduce((best, c) => {
          const r = parseFloat(c.total_spend) > 0 ? parseFloat(c.revenue_generated) / parseFloat(c.total_spend) : 0;
          return r > (best.roas || 0) ? { name: c.campaign_name, platform: c.platform, roas: r } : best;
        }, {});

        const clientMetrics = {
          email: client.client_email, campaigns: camps.length,
          totalSpend, totalRevenue, totalConversions, cac, roas,
          bestCampaign: bestCamp.name || 'N/A', bestPlatform: bestCamp.platform || 'N/A'
        };
        observations.metrics.push(clientMetrics);

        // Upsert metrics snapshot
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        await sql`INSERT INTO growth_metrics
          (client_email, period_start, period_end, total_spend, total_revenue, total_conversions,
           cac, roas, best_platform, best_campaign)
          VALUES (${client.client_email}, ${weekAgo}, ${today}, ${totalSpend}, ${totalRevenue},
           ${totalConversions}, ${cac}, ${roas}, ${bestCamp.platform || null}, ${bestCamp.name || null})
          ON CONFLICT (client_email, period_start)
          DO UPDATE SET total_spend = ${totalSpend}, total_revenue = ${totalRevenue},
           total_conversions = ${totalConversions}, cac = ${cac}, roas = ${roas}`;

        // Check rules
        for (const rule of rules) {
          let fired = false;
          if (rule.rule_key === 'anomaly_detection') {
            const prev = await sql`SELECT * FROM growth_metrics
              WHERE client_email = ${client.client_email} ORDER BY period_start DESC LIMIT 2`;
            if (prev.length === 2) {
              const prevRoas = parseFloat(prev[1].roas || 0);
              if (prevRoas > 0 && Math.abs(roas - prevRoas) / prevRoas > 0.3) {
                decisions.push({ rule: rule.rule_key, client: client.client_email, roas, prevRoas, action: 'ROAS changed >30% — investigate' });
                fired = true;
              }
            }
          }
          if (rule.rule_key === 'ltv_declining') {
            const prev = await sql`SELECT ltv FROM growth_metrics
              WHERE client_email = ${client.client_email} AND ltv IS NOT NULL ORDER BY period_start DESC LIMIT 2`;
            if (prev.length === 2 && parseFloat(prev[0].ltv) < parseFloat(prev[1].ltv)) {
              decisions.push({ rule: rule.rule_key, client: client.client_email, action: 'LTV declining — check retention' });
              fired = true;
            }
          }
          if (fired) {
            await sql`UPDATE agent_rules SET times_fired = times_fired + 1, last_fired_at = NOW() WHERE id = ${rule.id}`;
          }
        }
      }

      await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
        VALUES ('growth-analytics', ${JSON.stringify(observations)}::jsonb, ${JSON.stringify(decisions)}::jsonb,
        ${JSON.stringify({ clients: clients.length, alerts: decisions.length })}::jsonb)`;

      return res.json({ success: true, agent: 'growth-analytics', observations, decisions });
    }

    // ================================================================
    // GET /api/growth/coordinator/run — Growth Coordinator cross-agent sync
    // ================================================================
    if (req.method === 'GET' && path === 'coordinator/run') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      const coordActions = [];

      // Get latest state from each growth agent
      const adsState = await sql`SELECT * FROM agent_state WHERE agent_name = 'growth-ads' ORDER BY run_at DESC LIMIT 1`;
      const creativeState = await sql`SELECT * FROM agent_state WHERE agent_name = 'growth-creative' ORDER BY run_at DESC LIMIT 1`;
      const funnelState = await sql`SELECT * FROM agent_state WHERE agent_name = 'growth-funnel' ORDER BY run_at DESC LIMIT 1`;
      const analyticsState = await sql`SELECT * FROM agent_state WHERE agent_name = 'growth-analytics' ORDER BY run_at DESC LIMIT 1`;

      // Rule 1: If ads flagged low CTR → tell creative agent to refresh
      if (adsState.length > 0) {
        const adDecisions = adsState[0].decisions || [];
        const fatigued = (Array.isArray(adDecisions) ? adDecisions : []).filter(d => d.rule === 'platform_fatigue');
        if (fatigued.length > 0) {
          coordActions.push({
            rule: 'creative_aligns_targeting',
            action: `Creative Agent should prioritize refreshing creatives for: ${fatigued.map(f => f.campaign).join(', ')}`,
            campaigns: fatigued.map(f => f.campaign)
          });
        }
      }

      // Rule 2: If funnel flagged high bounce → tell ads to check landing page alignment
      if (funnelState.length > 0) {
        const funnelDecisions = funnelState[0].decisions || [];
        const highBounce = (Array.isArray(funnelDecisions) ? funnelDecisions : []).filter(d => d.rule === 'high_bounce_page');
        if (highBounce.length > 0) {
          coordActions.push({
            rule: 'funnel_matches_traffic',
            action: `Ads Agent should verify traffic targeting matches landing page content for: ${highBounce.map(h => h.page).join(', ')}`,
            pages: highBounce.map(h => h.page)
          });
        }
      }

      // Rule 3: If analytics flagged anomaly → all agents should investigate
      if (analyticsState.length > 0) {
        const analDecisions = analyticsState[0].decisions || [];
        const anomalies = (Array.isArray(analDecisions) ? analDecisions : []).filter(d => d.rule === 'anomaly_detection');
        if (anomalies.length > 0) {
          coordActions.push({
            rule: 'analytics_feeds_all',
            action: `ANOMALY DETECTED: ${anomalies.map(a => `${a.client}: ROAS ${a.roas?.toFixed(2)} vs prev ${a.prevRoas?.toFixed(2)}`).join('; ')}. All agents should investigate.`
          });
        }
      }

      // Rule 4: If no active campaigns → pause creative production
      if (adsState.length > 0) {
        const obs = adsState[0].observations || {};
        if ((obs.campaign_count || 0) === 0) {
          coordActions.push({
            rule: 'budget_exhausted_pause_creative',
            action: 'No active campaigns — Creative Agent should pause production until new campaigns launch'
          });
        }
      }

      await sql`INSERT INTO agent_state (agent_name, observations, decisions, actions_taken)
        VALUES ('growth-coordinator',
        ${JSON.stringify({
          ads_last_run: adsState[0]?.run_at || null,
          creative_last_run: creativeState[0]?.run_at || null,
          funnel_last_run: funnelState[0]?.run_at || null,
          analytics_last_run: analyticsState[0]?.run_at || null
        })}::jsonb,
        ${JSON.stringify(coordActions)}::jsonb,
        ${JSON.stringify({ rules_evaluated: 4, actions_generated: coordActions.length })}::jsonb)`;

      return res.json({ success: true, agent: 'growth-coordinator', actions: coordActions });
    }

    // ================================================================
    // GET /api/growth/dashboard — Unified growth agent dashboard data
    // ================================================================
    if (req.method === 'GET' && path === 'dashboard') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      const agentRuns = await sql`SELECT DISTINCT ON (agent_name) agent_name, run_at, observations, decisions, actions_taken
        FROM agent_state WHERE agent_name LIKE 'growth-%' ORDER BY agent_name, run_at DESC`;

      const rules = await sql`SELECT agent_name, rule_key, weight, times_fired, times_succeeded
        FROM agent_rules WHERE agent_name LIKE 'growth-%' ORDER BY agent_name, weight DESC`;

      const recentIntakes = await sql`SELECT id, company_name, industry, overall_score, status, created_at
        FROM growth_intake ORDER BY created_at DESC LIMIT 10`;

      let activeCampaigns = [];
      try { activeCampaigns = await sql`SELECT id, client_name, platform, campaign_name, status,
        total_spend, revenue_generated, conversions, cac, roas FROM growth_campaigns ORDER BY updated_at DESC LIMIT 10`; } catch(e) {}

      let latestMetrics = [];
      try { latestMetrics = await sql`SELECT client_email, total_spend, total_revenue, cac, roas, period_end
        FROM growth_metrics ORDER BY period_end DESC LIMIT 10`; } catch(e) {}

      return res.json({
        agents: agentRuns,
        rules,
        intakes: recentIntakes,
        campaigns: activeCampaigns,
        metrics: latestMetrics
      });
    }

    // ================================================================
    // POST /api/growth/campaigns — Create or update a campaign (admin)
    // ================================================================
    if (req.method === 'POST' && path === 'campaigns') {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { intakeId, clientName, clientEmail, platform, campaignName, campaignType, dailyBudget } = req.body || {};
      if (!clientName || !clientEmail || !platform || !campaignName) {
        return res.status(400).json({ error: 'clientName, clientEmail, platform, campaignName required' });
      }
      const row = await sql`INSERT INTO growth_campaigns
        (intake_id, client_name, client_email, platform, campaign_name, campaign_type, daily_budget, status)
        VALUES (${intakeId || null}, ${clientName}, ${clientEmail.toLowerCase()}, ${platform}, ${campaignName},
         ${campaignType || 'acquisition'}, ${dailyBudget || null}, 'active')
        RETURNING id`;
      return res.json({ success: true, campaignId: row[0].id });
    }

    // ================================================================
    // PUT /api/growth/campaigns/:id — Update campaign metrics
    // ================================================================
    if (req.method === 'PUT' && path.match(/^campaigns\/\d+$/)) {
      if (!requireAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const id = path.split('/')[1];
      const { impressions, clicks, conversions, totalSpend, revenueGenerated, status } = req.body || {};
      const camp = await sql`SELECT * FROM growth_campaigns WHERE id = ${id}`;
      if (camp.length === 0) return res.status(404).json({ error: 'Campaign not found' });

      const spend = totalSpend != null ? totalSpend : camp[0].total_spend;
      const rev = revenueGenerated != null ? revenueGenerated : camp[0].revenue_generated;
      const conv = conversions != null ? conversions : camp[0].conversions;
      const cac = conv > 0 ? (parseFloat(spend) / conv) : null;
      const roas = parseFloat(spend) > 0 ? (parseFloat(rev) / parseFloat(spend)) : null;

      await sql`UPDATE growth_campaigns SET
        impressions = COALESCE(${impressions}, impressions),
        clicks = COALESCE(${clicks}, clicks),
        conversions = ${conv},
        total_spend = ${spend},
        revenue_generated = ${rev},
        cac = ${cac}, roas = ${roas},
        status = COALESCE(${status}, status),
        updated_at = NOW()
        WHERE id = ${id}`;

      return res.json({ success: true, cac, roas });
    }

    return res.status(404).json({ error: `Unknown growth endpoint: ${path}` });

  } catch (err) {
    console.error('[growth-agents] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};


// ================================================================
// SCORING FUNCTIONS — Used for intake feasibility/market/readiness
// ================================================================

function scoreIntake({ monthlyRevenue, monthlyAdSpend, businessModel, website }) {
  let score = 5;
  const rev = parseRevenue(monthlyRevenue);
  if (rev >= 100000) score += 2;
  else if (rev >= 25000) score += 1;
  else if (rev < 5000) score -= 2;

  const spend = parseRevenue(monthlyAdSpend);
  if (spend >= 10000) score += 1.5;
  else if (spend >= 3000) score += 0.5;
  else if (spend === 0) score -= 1;

  if (website && website.includes('.')) score += 0.5;
  if (['saas', 'ecommerce', 'subscription', 'membership', 'digital products'].some(m => (businessModel || '').toLowerCase().includes(m))) score += 1;

  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function scoreMarket({ industry, targetAudience, currentPlatforms }) {
  let score = 5;
  if (targetAudience && targetAudience.length > 30) score += 1;
  if (currentPlatforms && currentPlatforms.length > 5) score += 1;
  if (['health', 'fitness', 'education', 'faith', 'coaching', 'consulting', 'saas', 'ecommerce'].some(i => (industry || '').toLowerCase().includes(i))) score += 1.5;
  if (targetAudience && /\d+/.test(targetAudience)) score += 0.5;
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function scoreReadiness({ timeline, primaryGoal, biggestChallenge, monthlyAdSpend }) {
  let score = 5;
  const spend = parseRevenue(monthlyAdSpend);
  if (spend > 0) score += 1.5;
  if (timeline && /immediate|asap|now|this month|1-2 weeks/i.test(timeline)) score += 1.5;
  else if (timeline && /1-3 months|next quarter/i.test(timeline)) score += 0.5;
  if (primaryGoal && primaryGoal.length > 20) score += 0.5;
  if (biggestChallenge && biggestChallenge.length > 20) score += 0.5;
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function parseRevenue(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}


// ================================================================
// AI DESIGN REPORT GENERATOR
// ================================================================

async function generateDesignReport(sql, intakeId, data) {
  const prompt = `Generate a Growth Design Report for a potential client. This is an internal pre-call briefing document.

## Client Information
- Company: ${data.companyName}
- Contact: ${data.contactName}
- Industry: ${data.industry}
- Business Model: ${data.businessModel}
- Monthly Revenue: ${data.monthlyRevenue || 'Not provided'}
- Monthly Ad Spend: ${data.monthlyAdSpend || 'Not provided'}
- Target Audience: ${data.targetAudience}
- Primary Goal: ${data.primaryGoal}
- Biggest Challenge: ${data.biggestChallenge}
- Current Platforms: ${data.currentPlatforms || 'None specified'}
- Timeline: ${data.timeline || 'Not specified'}

## Intake Scores
- Feasibility: ${data.feasibility}/10
- Market Opportunity: ${data.market}/10
- Client Readiness: ${data.readiness}/10
- Overall: ${data.overall}/10

## Report Sections Required

1. **Executive Summary** (3-4 sentences): Who they are, what they need, and our initial read on fit.

2. **Feasibility Assessment**: Can we realistically help them? What are the risks? What's the expected difficulty level?

3. **Market Analysis**: How competitive is their industry for paid media? What platforms make sense? What's the estimated CAC range for their vertical?

4. **Recommended Strategy**: Specific channel mix, campaign types, creative angles, and funnel structure we'd propose. Be specific — not generic advice.

5. **Projected Timeline**: What results they can expect in 30/60/90 days. Be realistic, not salesy.

6. **Investment Recommendation**: Suggested monthly ad spend range and management fee structure based on their goals and current revenue.

7. **Red Flags or Concerns**: Anything from the intake that needs clarification or could be a challenge.

Write in a professional, analytical tone. This report is for our team to review before the discovery call. Be honest about fit — if the scores are low, say so.`;

  try {
    const aiRes = await fetch(`https://${process.env.VERCEL_URL || 'assessment.valuetovictory.com'}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        action: 'content-generate',
        prompt,
        context: { tier: 'frontier' }
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!aiRes.ok) throw new Error(`AI API returned ${aiRes.status}`);
    const aiData = await aiRes.json();

    await sql`UPDATE growth_intake SET
      ai_report = ${aiData.content},
      ai_report_generated_at = NOW(),
      calendly_unlocked = true,
      status = 'report_ready'
      WHERE id = ${intakeId}`;

    return aiData.content;
  } catch (err) {
    console.error('[growth] AI report generation failed:', err.message);
    await sql`UPDATE growth_intake SET status = 'report_failed' WHERE id = ${intakeId}`;
    throw err;
  }
}


// ================================================================
// CREATIVE OUTPUT PARSER — extracts structured creatives from AI text
// ================================================================

function parseCreativeOutput(text) {
  const creatives = [];
  const sections = text.split(/(?:Creative|Variation|Option|Ad)\s*#?\d/i).filter(s => s.trim());

  if (sections.length === 0) {
    creatives.push({ type: 'ad', headline: extractField(text, 'headline'), body: extractField(text, 'body|copy|description'), hook: extractField(text, 'hook'), cta: extractField(text, 'cta|call to action') });
  } else {
    for (const section of sections) {
      creatives.push({ type: 'ad', headline: extractField(section, 'headline'), body: extractField(section, 'body|copy|description'), hook: extractField(section, 'hook'), cta: extractField(section, 'cta|call to action') });
    }
  }
  return creatives.filter(c => c.headline || c.body || c.hook);
}

function extractField(text, fieldPattern) {
  const regex = new RegExp(`(?:${fieldPattern})\\s*[:—-]\\s*(.+?)(?:\\n|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}


// ================================================================
// AI HELPER — routes through existing /api/ai endpoint
// ================================================================

async function callGrowthAI(sql, action, data) {
  try {
    const prompt = buildGrowthPrompt(action, data);
    const aiRes = await fetch(`https://${process.env.VERCEL_URL || 'assessment.valuetovictory.com'}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ADMIN_API_KEY
      },
      body: JSON.stringify({
        action: 'content-generate',
        prompt,
        context: { tier: action === 'creative-generate' ? 'small' : 'frontier' }
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!aiRes.ok) return { error: `AI returned ${aiRes.status}` };
    return await aiRes.json();
  } catch (err) {
    return { error: err.message };
  }
}

function buildGrowthPrompt(action, data) {
  if (action === 'creative-generate') {
    return `Generate 3 ad creative variations for a ${data.platform} campaign.

Client: ${data.clientName}
Campaign: ${data.campaignName}
Target Audience: ${data.targetAudience}
Product/Service: ${data.productDescription || 'Not specified'}
Tone: ${data.tone || 'Professional but approachable'}

For each variation provide:
- Headline (under 40 chars)
- Hook (opening line that stops the scroll — under 15 words)
- Body Copy (2-3 sentences, benefit-focused)
- CTA (clear call to action)

Make each variation a distinctly different angle. One emotional, one logical, one urgency-based.`;
  }
  return data.prompt || 'Generate growth marketing content.';
}


// ================================================================
// OWNER NOTIFICATION — emails Shawn when new intake arrives
// ================================================================

async function notifyOwner(sql, data) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });
  await transporter.sendMail({
    from: `"VTV Growth" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: `New Growth Intake: ${data.companyName} (Score: ${data.overall}/10)`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2 style="color:#D4A847;">New Growth Services Inquiry</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.companyName}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Contact</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.contactName}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.email}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Industry</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.industry}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Model</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.businessModel}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Revenue</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.monthlyRevenue || 'N/A'}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Ad Spend</td><td style="padding:8px;border-bottom:1px solid #eee;">${data.monthlyAdSpend || 'N/A'}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Score</td><td style="padding:8px;border-bottom:1px solid #eee;color:#D4A847;font-weight:bold;">${data.overall}/10</td></tr>
      </table>
      <p style="margin-top:16px;"><a href="https://assessment.valuetovictory.com/api/growth/intake/${data.intakeId}" style="color:#D4A847;">View Full Intake</a></p>
    </div>`
  });
}
