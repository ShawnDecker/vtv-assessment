const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Add company fields to teams table
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_email TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_domain TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS admin_contact_name TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS billing_email TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS integration_webhook TEXT DEFAULT ''`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS report_frequency TEXT DEFAULT 'monthly'`;
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS auto_report_enabled BOOLEAN DEFAULT false`;

    // Team members table — persistent numeric IDs per team
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL,
        member_number INTEGER NOT NULL,
        current_focus TEXT DEFAULT '',
        end_year_goals TEXT DEFAULT '',
        department TEXT DEFAULT '',
        role_title TEXT DEFAULT '',
        custom_code TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        joined_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, contact_id),
        UNIQUE(team_id, member_number)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_team_members_contact ON team_members(contact_id)`;

    // Backfill existing team members
    const teams = await sql`SELECT DISTINCT team_id FROM assessments WHERE team_id IS NOT NULL`;
    let backfilled = 0;
    for (const t of teams) {
      const members = await sql`SELECT DISTINCT contact_id FROM assessments WHERE team_id = ${t.team_id} ORDER BY contact_id`;
      for (let i = 0; i < members.length; i++) {
        await sql`INSERT INTO team_members (team_id, contact_id, member_number) VALUES (${t.team_id}, ${members[i].contact_id}, ${i + 1}) ON CONFLICT (team_id, contact_id) DO NOTHING`;
        backfilled++;
      }
    }

    return res.json({
      success: true,
      message: 'Team members table + company integration fields created',
      backfilledMembers: backfilled,
      companyFields: {
        company_email: 'CMA email — all team reports and notifications sent here',
        company_name: 'Organization display name',
        company_domain: 'Email domain for auto-matching (e.g., @acme.com)',
        admin_contact_name: 'Admin contact name (for our internal reference only)',
        billing_email: 'Separate billing contact if different from CMA',
        integration_webhook: 'Webhook URL for pushing reports to company systems',
        report_frequency: 'How often auto-reports are sent (weekly/monthly/quarterly)',
        auto_report_enabled: 'Whether scheduled reports are active',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
