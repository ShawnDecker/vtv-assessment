# CLAUDE.md

Operating notes for Claude Code sessions working in this repo. Read on session start.

## Before fixing anything from a reanalysis / findings file — check master first

**What happened on 2026-04-20:** A parallel Claude session ran the multi-agent reanalysis (see `sandbox/claude-flow-lite/reanalysis/report.md`) and produced a `findings.jsonl` in memory. A later session — this one — was asked to "fix all" the findings and began patching `api/index.js` without checking whether master had already moved. Master had *already* landed four commits addressing several of the same findings, including `b81d549` which patched the exact same critical `/api/member` auth-bypass finding with a *better* approach (narrow response for the email-only path, preserving coaching-email deep-link UX) than what the feature branch produced (hard 401, which would have broken those deep-links). The duplicate work surfaced as a merge conflict the moment a PR was opened.

**The rule, going forward:** before writing a fix for anything that came from a stored findings file, reanalysis report, or security-scanner output, run:

```bash
git fetch origin master
git log --oneline HEAD..origin/master
git log --oneline origin/master -- <path/you/plan/to/edit>
```

If master has commits in the region you're about to edit — especially commits with subjects like "fix(security)", "fix: auth", "fix: ...critical finding" — **read them first**. The likely cases:

1. **Already fixed on master with a different approach** → yield to master, merge it in, skip the finding on your branch.
2. **Already fixed on master with the same approach** → the finding is stale; don't re-fix.
3. **Not touched on master** → proceed with the fix on the branch.

## Parallel sessions work on this repo

Multiple Claude Code sessions may be pushing to master concurrently (the recent history shows both `Claude Opus 4.7 (1M context)` co-authored commits on master and feature-branch commits). Treat master as a moving target, not a stable baseline. Rebase / merge master into feature branches often — especially before opening a PR.

## Findings-file hygiene

`sandbox/claude-flow-lite/memory/findings.jsonl` is append-only log output from agent runs. Every line is a claim made at a point in time. A line is **not** a live bug — check the evidence path and current file state before acting. If a file has been rewritten since the finding was logged, the finding may be obsolete.

## Before commit, for any change that touches `api/index.js`

1. `node -e "new Function(require('fs').readFileSync('api/index.js','utf8'))"` — must print no error.
2. If the change touches auth, CORS, rate limits, PII fields, or third-party syncs, run (or at minimum mentally walk through) the Tier 1 security tooling added in `5355248` — `semgrep`, `gitleaks`, `osv-scanner`. CI will run these anyway on PR.
3. If the change is in the 1770–1850 range (`/member` endpoint), read `b81d549` first. That commit defines the current contract for the no-JWT path and any regression is a PII leak.

## Deployment

- Vercel deploys master automatically. Branch previews exist but don't affect prod.
- Before merging to master, confirm in Vercel env vars:
  - `JWT_SECRET` is set AND differs from `ADMIN_API_KEY` (commit `297d335` closed the fallback; equal values now logs a CRITICAL warning at startup but will still run).
  - `VERCEL_PREVIEW_ALLOWED_ORIGINS` is set as a comma-separated allowlist if you want any Vercel preview deploys to pass CORS.
  - Run `migrations/007-ai-calls.sql` against Neon once before any code that calls `logAiCall` runs in prod — otherwise the logger no-ops with a one-time warning (which is fine, just nothing in telemetry).

## Scope discipline

When given a loose task like "build X and reanalyze Y and fix Z" in one turn, work in small commits on the feature branch with clear messages. Don't batch unrelated changes. Each commit should stand alone so it can be cherry-picked or reverted cleanly.
