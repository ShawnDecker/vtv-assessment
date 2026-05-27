# Working State — 2026-05-14

Snapshot of what's in flight in this repo, what's where, and what's still open across the recent multi-session run.

Read this on a new machine after a fresh clone to pick up the thread:

```bash
git fetch --all --prune
git checkout claude/session-state-2026-05-14
cat WORKING_STATE.md
```

Master tip when this file was written: `8ecf082` ("Add push-all-repos.ps1 — backup 11 unprotected repos to private GitHub"). Master has been moving fast — re-fetch and check `git log master` after pulling.

---

## Active pull requests

| # | Title | Branch | State | Notes |
|---|---|---|---|---|
| **#13** | feat: Victory Concierge + claude-flow-lite framework + CLAUDE.md (slim) | `claude/concierge-and-flowlite-slim` | **open — ready to merge** | All four CI checks green (Vercel + semgrep + gitleaks + osv-scanner). One Codex P1 review found a real contactId enumeration risk on the public `concierge-route` action; **fixed in `6c3f97c`** by gating `contactId` lookups behind JWT ownership or admin. No outstanding review threads. Preview deploy: `vtv-assessment-git-claude-8f71b1-danddappraisal-7740s-projects.vercel.app/concierge` |
| #12 | Add BNI SWVA Pro chapter research framework and templates | `claude/bni-swva-pro-research` | **merged** | Squashed into master at `c7595c80`. Documentation only, all CI green. |
| #11 | Add AI call telemetry, tiered model routing, and security hardening | `claude/fishing-kayak-market-analysis-bsxZH` | **closed (superseded)** | Master independently re-implemented ~60% of this PR (ZYRIX tier router `4652823`, JWT-on-/api/ai `dc439e6`, JWT_SECRET / has-pin hardening `24ba5b5`). The still-uniquely-valuable pieces moved to PR #13. Closed with explanatory comment pointing at #13. |

---

## Branches we own (only the ones from this session run)

| Branch | Purpose | Status |
|---|---|---|
| `claude/concierge-and-flowlite-slim` | PR #13 head | **active** — merge or keep open |
| `claude/bni-swva-pro-research` | PR #12 (merged) | safe to delete |
| `claude/fishing-kayak-market-analysis-bsxZH` | PR #11 (closed, superseded) | safe to delete |
| `claude/claude-flow-lite-portable` | Standalone skeleton — has no shared history with master by design (created via `git subtree split`). Meant to be cloned, not merged. | keep as cloneable reference, OR tag and archive |
| `claude/shoaf-ecosystem-analysis` | **abandoned** — empty branch, was for the Steven Shoaf market intel analysis save (content was in chat, never written to a file before scope pivoted) | safe to delete |
| `claude/session-state-2026-05-14` | this file's home | merge or keep as session marker |

Other branches in `origin/claude/*` are not from this session (e.g., `claude/dating-app-review-setup-FptyP`, `claude/setup-valley-word-church-Q7PwW`, `claude/valley-word-church-salem-ZEnyU`, `claude/vtv-assessment-file-map-llRmt`, `claude/growth-agents-build`) — left alone.

---

## What's in flight but NOT yet in code

### Steven Shoaf market intel analysis
- Full text was delivered in chat (KBF-style breakdown of agentsinstall.com × shoaf.dev × YouTube @stevenshoaf, including income distribution model + replication playbook for VTV).
- **Not saved to repo.** Was mid-flight when scope pivoted to PR creation; the empty `claude/shoaf-ecosystem-analysis` branch was created but no file ever written.
- Intended save path: `bd-research/market-intel/companies/2026-04-25-shoaf-ecosystem.md` (or wherever you prefer; folder doesn't exist yet).
- Several code blocks in the delivered text show as the literal word `Code` or `Yaml` — formatting was stripped in transit; refill before final save.
- Heads-up: the analysis mentions Stripe acct ID + Vercel team ID (not secrets — they're visible on every webhook header / preview URL) and VPS IP (already in `api/index.js`).

### BNI SWVA Pro chapter member research
- Folder + skill scaffolding shipped via PR #12.
- **Still waiting on the chapter member list.** `bniswva.com` blocks automated fetch (403s) and the Google Sheets URL provided was access-restricted.
- To unblock: open the Sheet → File → Download → CSV → paste; or change share to "Anyone with the link → Viewer"; or screenshot.
- Once list arrives, follow the four-phase workflow in `bd-research/bni-swva-pro/_workflow.md`:
  1. Stub every member as `members/<lastname-firstname>.md`
  2. One deep dive on the highest-priority member, you review the shape
  3. Batch the rest 3–5 per output
  4. Post-meeting reconcile per member
- Per-member files MUST include Section 3 (Mathematics & locational impact + Mermaid chart) — the depth expectation codified per your directive. See `bd-research/bni-swva-pro/_template.md` + `bni-research-skill.md`.

### Reanalysis findings still not addressed in code
The 35 findings from the multi-agent reanalysis are logged in `sandbox/claude-flow-lite/memory/findings.jsonl` (lands on master when PR #13 merges). Master has independently fixed several; these remain open last I checked:

- `[critical] schema-docs-drift` — 18 tables missing from `DB_SCHEMA.md` (incl. 7 dating tables)
- `[high] data-integrity` — missing FKs on `team_members.contact_id` and `partner_profiles.contact_id` (master has a FK migration; verify it covers these)
- `[high] dead-code` — 5 orphan tables: assessment_progress, member_referral_rewards, rfm_chapters, rfm_subscriber_progress, vault_content
- `[high] funnel` — index.html has no link to pricing/report; orphan pages (stuck, realestate, consult) undiscoverable
- `[high] duplication` — upsell.html ↔ premium.html, investor-pitch.html ↔ startup-warrior-pitch.html
- `[high] perf` — 7.3MB of hero imagery at repo root
- `[medium] anonymization` — `privacy_preferences` flags not enforced at query level
- `[medium] pii-concentration` — `dating_profiles` is a PII supernode
- `[medium] infra-coupling` — `checkout.js` silently fails if n8n unreachable
- `[low] reliability` — Stripe webhook forwarding to n8n has no retry/queue
- See `sandbox/claude-flow-lite/reanalysis/report.md` for the top-5 action items ordered by impact × reversibility.

---

## Jarvis (Claude Code skills) state

Install / verify on the new computer:

```bash
# vtv-team skill (existing)
test -f ~/.claude/skills/vtv-team/SKILL.md && echo "vtv-team OK" || echo "MISSING"

# bni-research skill (from PR #12 — landed on master)
mkdir -p ~/.claude/skills/bni-research
cp bd-research/bni-swva-pro/bni-research-skill.md ~/.claude/skills/bni-research/SKILL.md
```

Both skills are independent. Activate either with `/<skill-name>` in any Claude Code session, or just reference the work conversationally and the skill picks itself up.

---

## Operating rules (codified in CLAUDE.md, lands when PR #13 merges)

Before fixing anything from a stored findings file, reanalysis report, or security-scanner output:

```bash
git fetch origin master
git log --oneline HEAD..origin/master
git log --oneline origin/master -- <path/you/plan/to/edit>
```

Three possible outcomes:
1. Already fixed on master with a different approach → yield to master, merge it in
2. Already fixed on master with the same approach → finding is stale; skip
3. Not touched on master → proceed

Parallel Claude sessions push to master concurrently. Treat master as a moving target. Rebase / merge often, especially before opening a PR.

---

## Deploy preflight (env vars on Vercel)

Verify before merging anything that touches auth:
- `JWT_SECRET` is set **and differs from** `ADMIN_API_KEY`. Equal values would let an admin-key compromise forge all JWTs. Master's `24ba5b5` logs a CRITICAL warning if equal but still runs.
- `VERCEL_PREVIEW_ALLOWED_ORIGINS` is set as comma-separated allowlist if you want any Vercel preview deploys to pass CORS.

Migrations:
- `migrations/migrate-missing-fks.js` exists on master (`24ba5b5`) — run once if not already.
- The `ai_calls` migration from old PR #11 is not on master — master uses `model_invocations` instead.

---

## How to pick up the thread

On the new computer, after cloning:

```bash
git fetch --all --prune
git checkout master && git pull          # latest production
git log --oneline -10                    # see what moved since this snapshot

# install the skills
mkdir -p ~/.claude/skills/bni-research
cp bd-research/bni-swva-pro/bni-research-skill.md ~/.claude/skills/bni-research/SKILL.md

# review the open PR
gh pr view 13  # or open https://github.com/ShawnDecker/vtv-assessment/pull/13
```

Then start a Claude Code session in the repo root. The `/bni-research` skill (after PR #12 + reinstall) and the operating rules in `CLAUDE.md` (after PR #13 merges, or read it on the `claude/concierge-and-flowlite-slim` branch now) give the new session the full context.

---

*Generated on 2026-05-14. Refresh this file whenever the in-flight state shifts meaningfully.*
