// Orphan-table audit — Tier 0.4 from system-upgrade plan.
//
// Read-only. Does NOT drop anything. Generates a recommendation per table
// based on row count + last-write timestamp. Run a follow-up DROP migration
// only after reviewing this output and confirming each candidate.
//
// Tables audited (flagged 2026-04-25 reanalysis as having no API writers):
//   assessment_progress, member_referral_rewards, rfm_chapters,
//   rfm_subscriber_progress, vault_content
//
// To run locally:
//   DATABASE_URL='postgres://...' node migrations/audit-orphan-tables.js
//
// To run via Vercel function (if wired into api/index.js as /api/audit-orphans):
//   curl -X GET https://assessment.valuetovictory.com/api/audit-orphans \
//        -H "x-api-key: $ADMIN_API_KEY"
//
// Recommendation logic:
//   - Table missing            → SKIP (already gone)
//   - 0 rows                   → DROP CANDIDATE
//   - All rows > 90 days old   → DROP CANDIDATE (verify no offline writer)
//   - Any row < 90 days old    → KEEP (active, find the writer)

const { neon } = require('@neondatabase/serverless');

const TABLES = [
  'assessment_progress',
  'member_referral_rewards',
  'rfm_chapters',
  'rfm_subscriber_progress',
  'vault_content',
];

const STALE_DAYS = 90;

async function auditTable(sql, table) {
  const exists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = ${table}
    ) AS present
  `;
  if (!exists[0].present) {
    return { table, exists: false, recommendation: 'SKIP — table does not exist' };
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table}
  `;
  const colNames = cols.map((c) => c.column_name);
  const hasCreated = colNames.includes('created_at');
  const hasUpdated = colNames.includes('updated_at');

  const countRow = await sql`SELECT COUNT(*)::int AS n FROM ${sql.unsafe(`"${table}"`)}`;
  const rowCount = countRow[0].n;

  let lastWrite = null;
  if (rowCount > 0 && (hasCreated || hasUpdated)) {
    const expr = hasUpdated && hasCreated
      ? 'GREATEST(MAX(created_at), MAX(updated_at))'
      : hasUpdated ? 'MAX(updated_at)' : 'MAX(created_at)';
    const lw = await sql.unsafe(`SELECT ${expr} AS lw FROM "${table}"`);
    lastWrite = lw[0].lw;
  }

  let recommendation;
  if (rowCount === 0) {
    recommendation = 'DROP CANDIDATE — empty table, no API writers detected';
  } else if (lastWrite) {
    const ageDays = (Date.now() - new Date(lastWrite).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > STALE_DAYS) {
      recommendation = `DROP CANDIDATE — ${rowCount} rows, last write ${Math.round(ageDays)}d ago (>${STALE_DAYS}d)`;
    } else {
      recommendation = `KEEP — ${rowCount} rows, last write ${Math.round(ageDays)}d ago. Find the offline writer (n8n? Obsidian sync? local script?) and document it.`;
    }
  } else {
    recommendation = `INVESTIGATE — ${rowCount} rows but no created_at/updated_at columns to date. Manual inspection needed.`;
  }

  return {
    table,
    exists: true,
    rowCount,
    columns: colNames,
    hasCreated,
    hasUpdated,
    lastWrite,
    recommendation,
  };
}

async function runAudit() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set. Pull from Vercel: vercel env pull .env.local');
  }
  const sql = neon(process.env.DATABASE_URL);
  const results = [];
  for (const t of TABLES) {
    try {
      results.push(await auditTable(sql, t));
    } catch (err) {
      results.push({ table: t, error: err.message });
    }
  }
  return results;
}

// HTTP wrapper — usable if file is moved to api/ or wired through api/index.js
module.exports = async (req, res) => {
  const apiKey = req.headers && req.headers['x-api-key'] || '';
  const validKey = process.env.ADMIN_API_KEY || '';
  if (!validKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Admin API key required' });
  }
  try {
    const results = await runAudit();
    return res.json({ success: true, audited_at: new Date().toISOString(), staleDays: STALE_DAYS, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.runAudit = runAudit;

// CLI entry point
if (require.main === module) {
  runAudit()
    .then((results) => {
      console.log(`\nOrphan-table audit @ ${new Date().toISOString()}`);
      console.log(`Stale threshold: ${STALE_DAYS} days\n`);
      for (const r of results) {
        console.log('─'.repeat(70));
        console.log(`Table: ${r.table}`);
        if (r.error) {
          console.log(`  ERROR: ${r.error}`);
          continue;
        }
        if (!r.exists) {
          console.log(`  ${r.recommendation}`);
          continue;
        }
        console.log(`  Rows:        ${r.rowCount}`);
        console.log(`  Last write:  ${r.lastWrite || 'n/a'}`);
        console.log(`  Recommend:   ${r.recommendation}`);
      }
      console.log('\n' + '─'.repeat(70));
      const drops = results.filter((r) => r.recommendation && r.recommendation.startsWith('DROP'));
      const keeps = results.filter((r) => r.recommendation && r.recommendation.startsWith('KEEP'));
      console.log(`Summary: ${drops.length} drop candidate(s), ${keeps.length} keep, ${results.length - drops.length - keeps.length} skip/investigate.`);
      console.log('\nNo tables were dropped. Review above, then write a follow-up DROP migration if appropriate.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Audit failed:', err.message);
      process.exit(1);
    });
}
