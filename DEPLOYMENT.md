# Deployment Guide

This application is deployed on **Vercel** at [assessment.valuetovictory.com](https://assessment.valuetovictory.com). Vercel's deployment model is **atomic** — the old deployment continues serving traffic until the new one is fully built and verified, so users mid-assessment are never interrupted.

## Branches

| Branch    | Purpose                        | Auto-deploys to          |
|-----------|--------------------------------|--------------------------|
| `master`  | Production                     | assessment.valuetovictory.com |
| `staging` | Pre-production testing         | Vercel preview URL       |

## Safe Deployment Workflow

1. **Push changes to `staging`**
   ```bash
   git checkout staging
   # make changes, commit
   git push origin staging
   ```

2. **Test at the preview URL**
   Vercel automatically builds a preview deployment for every push to `staging`. The preview URL appears in the GitHub commit status or Vercel dashboard. Verify your changes work correctly at that URL.

3. **Promote to production**
   ```bash
   ./scripts/promote-to-production.sh
   ```
   This merges `staging` into `master` with a merge commit and pushes. Vercel then builds and deploys automatically.

   To see what would be deployed without actually deploying:
   ```bash
   ./scripts/promote-to-production.sh --dry-run
   ```

4. **Verify production**
   Check the health endpoint after deployment:
   ```
   https://assessment.valuetovictory.com/api/health
   ```
   It returns:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-03-26T12:00:00.000Z",
     "db": "connected",
     "version": "<git-sha>"
   }
   ```
   - HTTP 200 = healthy
   - HTTP 503 = unhealthy (database connectivity issue)

## How Zero-Downtime Works

Vercel's deployment model ensures no downtime:

- When a push to `master` triggers a new build, the **previous deployment keeps serving all traffic** until the new deployment is fully built and ready.
- Once the new deployment passes its build and is ready to serve, Vercel **atomically switches** all traffic to the new version.
- Users who are mid-assessment during a deploy will not experience any interruption — their in-flight API requests complete against the old deployment, and subsequent requests are handled by the new one.
- There is no maintenance window and no manual cutover step.

## Rules

- **NEVER** force-push to `master`.
- **NEVER** push directly to `master` for routine changes. Always go through `staging` first.
- All database migrations should be backwards-compatible so both old and new deployments work during the transition period.
- Test at the preview URL before promoting to production.
