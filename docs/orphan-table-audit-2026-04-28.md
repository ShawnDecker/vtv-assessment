# Orphan-Table Audit — 2026-04-28

Run via `node -r dotenv/config migrations/audit-orphan-tables.js dotenv_config_path=.env.local` against production Neon.

Five tables flagged by the 2026-04-25 reanalysis as having no API writers. Audit results:

| Table | Rows | Last write | Decision | Why |
|---|---:|---|---|---|
| `assessment_progress` | 3 | 2026-03-30 | **KEEP** | Active writer (29d ago). Likely n8n workflow or admin panel insert. Find and document the writer before any future cleanup pass. |
| `vault_content` | 101 | 2026-04-15 | **KEEP** | Obsidian vault sync — memory `project_apr5_integration.md` confirms this is the sync target. Writer lives outside `api/` (probably the local watcher or a separate service). Active. |
| `member_referral_rewards` | 0 | — | **DROP** | Empty table, referral system never wired. Genuine debt. |
| `rfm_chapters` | 0 | — | **KEEP for Tier 4.2** | Empty, but RFM book-ingestion pipeline is on the roadmap (Tier 4.2 of the system upgrade plan). Don't drop — drop+recreate cycles are pointless when the build is queued. |
| `rfm_subscriber_progress` | 0 | — | **KEEP for Tier 4.2** | Same as `rfm_chapters` — paired RFM table. |

## Action

Net: only ONE table is a true drop candidate (`member_referral_rewards`). Two are active, two are reserved for an upcoming feature.

To execute the drop:

```sql
DROP TABLE IF EXISTS member_referral_rewards;
```

Run via Neon SQL editor or a one-shot migration wrapped in a confirmation flag. Not auto-executed.

## Follow-ups

1. **Find the `assessment_progress` writer.** Three rows over 29 days — small but real. Could be:
   - n8n workflow (check `n8n.srv1138119.hstgr.cloud` for any HTTP node hitting Neon directly)
   - Admin panel direct insert (unlikely — admin pages route through `/api/admin/*`)
   - Stale data from a prior endpoint that's since been removed

   If the writer is dead, the 3 rows are leftovers and the table can move to DROP next quarter.

2. **Document the `vault_content` writer.** Per memory, Obsidian sync writes here. Confirm where (filesystem watcher path, sync service URL) and add to [RUNBOOK.md](./RUNBOOK.md) so this isn't a mystery in 6 months.

3. **Re-run this audit quarterly.** It's read-only and takes ~5 seconds. Add to a recurring calendar event or a cron-triggered admin endpoint.
