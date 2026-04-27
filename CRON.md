# VTV Assessment — Cron Schedule

Vercel cron expressions only accept UTC. The schedule below is **anchored on EST winter time** (UTC-5). During DST (EDT, UTC-4), each cron fires **1 hour later in local time** — this drift is unavoidable on Vercel cron without an external scheduler.

Confirmed 2026-04-27 in response to deferred-issue #3 from `vtv-deferred-issues-2026-04-25.md`.

## Active schedule

| Endpoint | UTC | EST (winter, anchor) | EDT (summer, +1 hr drift) |
|---|---|---|---|
| `/api/agent/systems/run` | every 15 min | every 15 min | every 15 min |
| `/api/devotional/send` | 11:00 daily | 6:00 AM | 7:00 AM |
| `/api/ceo-briefing` | 11:30 daily | 6:30 AM | 7:30 AM |
| `/api/coaching/send` | 12:00 daily | 7:00 AM | 8:00 AM |
| `/api/accountability/send` | 23:00 daily | 6:00 PM | 7:00 PM |

## How to change a time

1. Decide the target EST hour (winter anchor).
2. Add 5 to get UTC hour. Example: 7 AM EST → 12:00 UTC → `0 12 * * *`.
3. Edit `vercel.json` `crons[].schedule`.
4. Update the table above.
5. Push to master — Vercel redeploys and re-registers crons automatically.

## Why not run in true local time?

Vercel cron is UTC-only — there's no timezone field. Options for true local-time firing:

- **n8n on the VPS** (`n8n.srv1138119.hstgr.cloud`) — supports timezone-aware schedules. Migrate any cron that must hit exact local time year-round to n8n triggering the same `/api/...` endpoint.
- **Pre-emptive DST shift** — manually update `vercel.json` twice a year (March 2nd Sunday → subtract 1, November 1st Sunday → add 1). Reliable but adds ops load.

The current EST-anchored choice was made because none of the active crons are time-critical to the minute — a 1-hour summer drift is acceptable for morning-cadence emails.
