# Production Runbook — VTV Assessment

First place to look when something is broken. Aimed at <5-minute triage, not deep RCA.

## Quick triage — "production is down"

1. **Open the agent dashboard** → [/agent-dashboard](https://assessment.valuetovictory.com/agent-dashboard).
   - System Health panel shows the last status of Neon, n8n, VPS, Stripe, Gmail (refreshed every 15 min by `*/15 * * * * /agent/systems/run`).
   - AI Router panel shows tunnel status, last-24h call/cost/error count.
   - Down dot or red error count → that's likely the failing dependency.
2. **Check Vercel deploys** → [vercel.com/danddappraisal-7740s-projects](https://vercel.com/danddappraisal-7740s-projects). Did the last deploy fail? Promote the previous successful deploy if recent push broke prod.
3. **Check Neon** → [console.neon.tech](https://console.neon.tech) → project `withered-butterfly-27595333`. Connection issues, branch off, slow queries all surface here.
4. **Check n8n** → [n8n.srv1138119.hstgr.cloud](https://n8n.srv1138119.hstgr.cloud). Stale workflow runs or red executions in the last hour suggest the VPS or a downstream API is the issue.
5. **If still unclear → tail Vercel logs** for the broken endpoint: `vercel logs <deployment-url> --since 15m`.

## Failure mode → first response

| Symptom | Likely cause | First check | First fix |
|---|---|---|---|
| 502s on `/api/*` | Vercel function timeout or cold-start error | Vercel function logs for the path | Redeploy. If it's `/api/index.js`, check for a slow Neon query just added. |
| Stripe webhooks rejected | `STRIPE_WEBHOOK_SECRET` unset or rotated | `vercel env ls` | Re-paste the active webhook signing secret from [Stripe → Developers → Webhooks](https://dashboard.stripe.com/webhooks). |
| All emails failing | Gmail app password rotated/revoked | Try `/api/send-email` test | Generate new app password at [google.com/security](https://myaccount.google.com/security), update `GMAIL_APP_PASSWORD` in Vercel, redeploy. |
| Cron not firing | Cron paused on free Vercel plan, or expression invalid | Vercel → Project → Settings → Cron Jobs | Reactivate; verify against [docs/CRON_SCHEDULE.md](./CRON_SCHEDULE.md). |
| AI Router showing tunnel "misconfigured" | Cloudflare tunnel down on local box | `Get-Service Cloudflared` on the source machine | Restart cloudflared, or set `AI_PROVIDER=cloud` in Vercel env to skip Ollama until the tunnel returns. |
| Dashboard shows "Could not load live data" | `/agent/dashboard` 500ed | Vercel logs for that path | Common: a new SQL query against a table that doesn't exist yet — run `/agent/migrate` once. |
| HubSpot contacts not appearing | API key rotated, or workflow paused | n8n → HubSpot workflow last execution | Update HubSpot key in n8n credentials, retry from the failed run. |
| `JWT_SECRET` warning in cold-start logs | Distinct `JWT_SECRET` env var not set | `vercel env ls` | `openssl rand -hex 32` → set `JWT_SECRET` in Vercel → redeploy. |
| Members can't log in | JWT secret rotated mid-session — old tokens invalid | Auth logs | Acceptable on rotation; users log in again. If unexpected, check no one rotated `ADMIN_API_KEY` (the JWT fallback). |

## Rollback procedures

### Vercel — code rollback (≈30 sec)

1. [Vercel project → Deployments](https://vercel.com/danddappraisal-7740s-projects).
2. Find the last green deployment.
3. ⋯ menu → "Promote to Production".
4. Production now serves the older bundle while you fix master locally.

### Git — fix-forward instead of revert

Master is prod. To reverse a bad commit, prefer:

```bash
git revert <bad-sha>
git push origin master
```

over `git reset --hard` + force-push (destructive, breaks anyone else's clone).

### Neon — point-in-time recovery (PITR)

Neon Pro retains 7 days of WAL by default.
1. Neon console → project `withered-butterfly-27595333` → branch `main`.
2. "Restore" → choose timestamp before the data damage.
3. Restore creates a new branch (does NOT overwrite). Switch `DATABASE_URL` in Vercel to the new branch's connection string, redeploy.
4. Once verified, optionally promote the new branch to be `main`.

### n8n workflow — disable + retry

1. n8n UI → Workflows → toggle the broken one OFF.
2. Fix in the editor (don't deploy from your machine; n8n is the source of truth for workflows).
3. Toggle ON. "Execute Workflow" once manually to confirm.

## Where the data lives

| Need | Source |
|---|---|
| Live health, agent runs, AI spend | [/agent-dashboard](https://assessment.valuetovictory.com/agent-dashboard) |
| API request logs | Vercel project → Deployments → pick deploy → Function Logs |
| Webhook delivery history (Stripe) | [Stripe webhooks dashboard](https://dashboard.stripe.com/webhooks) |
| n8n run history | [n8n.srv1138119.hstgr.cloud](https://n8n.srv1138119.hstgr.cloud) → Executions |
| DB schema + queries | Neon SQL Editor → project `withered-butterfly-27595333` |
| AI call telemetry | Neon → `model_invocations` table (also surfaced on dashboard) |
| Cron last-fire times | Neon → `system_health_log` filtered by service prefix `cron:` |
| Audit log of agent decisions | Neon → `agent_state` table (append-only) |

## Recurring known issues

- **Cron drift in DST.** Documented in [docs/CRON_SCHEDULE.md](./CRON_SCHEDULE.md). Crons fire 1 hour later in EDT (mid-March → early November). Acceptable per owner direction.
- **Vercel function slot count.** 13 files in `api/`, Pro limit is 12 functions. New endpoints should land inside `api/index.js` (URL-routed dispatch) rather than as new files. If a deploy fails on slot count, consolidate before pushing again.
- **Public repo.** No secrets in commits, ever. CI runs gitleaks/Semgrep/osv-scanner non-blocking — review the GitHub Actions tab after each push.
- **Master = prod.** No staging branch. If a change is risky, push to a `claude/*` branch first and use the Vercel preview URL (auto-generated) before merging.

## Owner contacts

- **Owner / on-call:** Shawn Decker — `valuetovictory@gmail.com`. Voice-first, expects autonomous execution.
- **Hostinger / VPS issues:** [hpanel.hostinger.com](https://hpanel.hostinger.com) → support chat.
- **Neon issues:** [console.neon.tech](https://console.neon.tech) → support, or status at [neonstatus.com](https://neonstatus.com).
- **Vercel issues:** [vercel.com/help](https://vercel.com/help), or status at [vercel-status.com](https://www.vercel-status.com).
- **Stripe issues:** [status.stripe.com](https://status.stripe.com), urgent → dashboard chat.

## Post-incident

If an outage lasted >15 min or caused customer-visible impact:

1. Add a row to a monthly incidents log (currently informal — see commit history with `fix:` or `incident:` prefix).
2. Update this runbook's "Failure mode → first response" table if a new mode appeared.
3. If the cause was a missing env var or unrotated secret, add it to [vtv-deferred-issues-*.md](../) and Tier 0 of the next system upgrade plan.
