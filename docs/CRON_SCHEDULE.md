# Cron Schedule — Local Time Reference

Vercel cron only accepts UTC. Source of truth is `vercel.json`. This file is the
human-readable mapping so future edits don't drift again.

**Convention:** all customer-facing crons fire at fixed **Eastern Standard Time
(UTC-5)**. During Daylight Saving Time (EDT, UTC-4, mid-March → early November),
the actual local time will be **one hour later** than listed below — this is
acceptable per the owner's call (better than the cron firing at unpredictable
times year-round, and most customers don't notice a 1-hour shift in DST season).

## Daily customer-facing schedule (EST)

| Time (EST) | UTC | Cron expr | Endpoint | What it does |
|---|---|---|---|---|
| 6:00 AM | 11:00 | `0 11 * * *` | `/api/devotional/send` | Morning devotional to subscribers |
| 6:30 AM | 11:30 | `30 11 * * *` | `/api/ceo-briefing` | Daily exec brief to Shawn |
| 7:00 AM | 12:00 | `0 12 * * *` | `/api/coaching/send` | Morning coaching to enrolled members |
| 6:00 PM | 23:00 | `0 23 * * *` | `/api/accountability/send` | Evening accountability check-in |

## Continuous

| Schedule | Cron expr | Endpoint | What it does |
|---|---|---|---|
| Every 15 min | `*/15 * * * *` | `/api/agent/systems/run` | Health-check agent (Neon, n8n, VPS, Stripe, Gmail) — auto-heals VPS on failure |

## How to add a new daily cron in EST

1. Pick the local time in EST (e.g., 9:30 AM EST)
2. Add 5 hours for UTC (9:30 + 5 = 14:30 UTC)
3. Cron expression: `30 14 * * *` (minute hour day month weekday)
4. Add a new entry in `vercel.json` under `crons` AND in the table above

## DST behavior (FYI)

| Date range | Effective offset | Example: a `0 12 * * *` cron fires at... |
|---|---|---|
| Nov → mid-March (EST) | UTC-5 | 7:00 AM EST ✓ |
| Mid-March → early Nov (EDT) | UTC-4 | 8:00 AM EDT |

If a cron MUST fire at the same local time year-round (e.g., regulatory or
contract requirement), the only options are: (a) accept the DST drift, (b) move
the cron to n8n on the VPS where the OS handles timezone, or (c) wait for Vercel
to add timezone support to crons (not on their roadmap as of 2026-04).

## Audit query

To see when each cron last ran successfully:

```sql
SELECT
  service,
  MAX(checked_at) AS last_run,
  status
FROM system_health_log
WHERE service IN ('cron:devotional', 'cron:ceo-briefing', 'cron:coaching', 'cron:accountability')
GROUP BY service, status
ORDER BY service;
```

(Each cron handler should write a row to `system_health_log` on success/failure
— if your handler doesn't yet, add it before relying on this query.)
