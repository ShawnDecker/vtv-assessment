// Migration: Add missing FOREIGN KEY constraints flagged by 2026-04-18 reanalysis.
//
// Tables affected:
//   - team_members.contact_id  → contacts(id)
//   - partner_profiles.contact_id → contacts(id)  (only if table exists)
//
// Defensive: each ALTER is wrapped in a DO block that checks for the column
// and constraint first. Safe to re-run; safe to run on prod with existing data
// IF the column already only contains valid contact ids (it should — see audit
// step below).
//
// To run: hit POST /api/migrate-missing-fks once after deploy, OR exec from psql:
//   psql $DATABASE_URL -f migrations/missing-fks.sql  (extract the SQL block)
//
// AUDIT FIRST. Before adding FKs, confirm there are no orphan rows:
//   SELECT id, contact_id FROM team_members
//     WHERE contact_id IS NOT NULL
//       AND contact_id NOT IN (SELECT id FROM contacts);
//   -- if rows returned: clean them (NULL the contact_id or DELETE) before running this migration

const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // Admin-only: requires x-api-key matching ADMIN_API_KEY
  const apiKey = req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized — admin only' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const sql = neon(process.env.DATABASE_URL);
  const results = [];

  try {
    // ---- team_members.contact_id → contacts(id) ----
    // Audit first: any orphan contact_ids?
    const teamOrphans = await sql`
      SELECT COUNT(*)::int AS n FROM team_members
      WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
    `;
    if (teamOrphans[0].n > 0) {
      results.push({ table: 'team_members', skipped: true, reason: `${teamOrphans[0].n} orphan rows — clean those first, then re-run` });
    } else {
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'team_members'
              AND constraint_name = 'team_members_contact_id_fkey'
          ) THEN
            ALTER TABLE team_members
              ADD CONSTRAINT team_members_contact_id_fkey
              FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `;
      results.push({ table: 'team_members', added: 'team_members_contact_id_fkey' });
    }

    // ---- partner_profiles.contact_id → contacts(id) (only if table exists) ----
    const ppExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'partner_profiles'
      ) AS present
    `;
    if (!ppExists[0].present) {
      results.push({ table: 'partner_profiles', skipped: true, reason: 'table does not exist' });
    } else {
      const ppOrphans = await sql`
        SELECT COUNT(*)::int AS n FROM partner_profiles
        WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
      `;
      if (ppOrphans[0].n > 0) {
        results.push({ table: 'partner_profiles', skipped: true, reason: `${ppOrphans[0].n} orphan rows — clean those first, then re-run` });
      } else {
        await sql`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_name = 'partner_profiles'
                AND constraint_name = 'partner_profiles_contact_id_fkey'
            ) THEN
              ALTER TABLE partner_profiles
                ADD CONSTRAINT partner_profiles_contact_id_fkey
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
            END IF;
          END $$;
        `;
        results.push({ table: 'partner_profiles', added: 'partner_profiles_contact_id_fkey' });
      }
    }

    return res.json({ success: true, results });
  } catch (err) {
    console.error('[migrate-missing-fks] error:', err);
    return res.status(500).json({ error: err.message, results });
  }
};
