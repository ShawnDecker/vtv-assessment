# Working State — last refreshed 2026-05-27

Snapshot of what's in flight in this repo, what's where, and what's still open across the recent multi-session run.

Read this on a new machine after a fresh clone to pick up the thread:

```bash
git fetch --all --prune
git checkout claude/session-state-2026-05-14
cat WORKING_STATE.md
```

Master tip when this file was first written: `8ecf082`. Refresh and check `git log master` after pulling — master moves fast.

---

## Active pull requests

| # | Title | Branch | State | Notes |
|---|---|---|---|---|
| **#13** | feat: Victory Concierge + claude-flow-lite framework + CLAUDE.md (slim) | `claude/concierge-and-flowlite-slim` | **open — ready to merge** | All four CI checks green (Vercel + semgrep + gitleaks + osv-scanner). The Codex P1 review about contactId enumeration was **fixed in `6c3f97c`** by gating `contactId` lookups behind JWT ownership or admin; the review thread is now `is_outdated=true` (auto-resolved by the fix commit). No outstanding threads. |
| #14 | docs(market-intel): file Steven Shoaf ecosystem analysis | `claude/shoaf-market-intel` | **closed — not needed** | Closed 2026-05-27 per user direction. Was a loose end from earlier in the session that turned out not to be on the actual to-do list. One orphan commit `564c5c7` on origin if ever wanted. |
| #12 | Add BNI SWVA Pro chapter research framework and templates | `claude/bni-swva-pro-research` | **merged** | Squashed into master at `c7595c80`. Documentation only, all CI green. |
| #11 | Add AI call telemetry, tiered model routing, and security hardening | `claude/fishing-kayak-market-analysis-bsxZH` | **closed (superseded)** | Master independently re-implemented ~60% (ZYRIX tier router `4652823`, JWT-on-/api/ai `dc439e6`, JWT_SECRET / has-pin hardening `24ba5b5`). Still-uniquely-valuable pieces moved to PR #13. Closed with explanatory comment. |

---

## Branches we own (only the ones from this session run)

| Branch | Purpose | Status |
|---|---|---|
| `claude/concierge-and-flowlite-slim` | PR #13 head | **active** — merge or keep open |
| `claude/session-state-2026-05-14` | this file's home | active — refresh as state shifts |
| `claude/shoaf-market-intel` | PR #14 (closed, not needed) | orphan commit on origin; safe to delete via GitHub UI |
| `claude/bni-swva-pro-research` | PR #12 (merged) | safe to delete |
| `claude/fishing-kayak-market-analysis-bsxZH` | PR #11 (closed, superseded) | safe to delete |
| `claude/claude-flow-lite-portable` | Standalone skeleton — no shared history with master by design (created via `git subtree split`). Meant to be cloned, not merged. | keep as cloneable reference, OR tag and archive |

Other branches in `origin/claude/*` are not from this session — left alone.

---

## What's in flight but NOT yet in code

### BNI SWVA Pro chapter member research
- Folder + skill scaffolding shipped via PR #12.
- **Still waiting on the chapter member list.** `bniswva.com` blocks automated fetch (403s) and the Google Sheets URL provided was access-restricted.
- To unblock: open the Sheet → File → Download → CSV → paste; or change share to "Anyone with the link → Viewer"; or screenshot.
- Once list arrives, follow the four-phase workflow in `bd-research/bni-swva-pro/_workflow.md`:
  1. Stub every member as `members/<lastname-firstname>.md`
  2. One deep dive on the highest-priority member, you review the shape
  3. Batch the rest 3–5 per output
  4. Post-meeting reconcile per member
- Per-member files MUST include Section 3 (Mathematics & locational impact + Mermaid chart) per the codified depth expectation. See `bd-research/bni-swva-pro/_template.md` + `bni-research-skill.md`.

### ~~Steven Shoaf market intel analysis~~
- Saved to disk on `claude/shoaf-market-intel`, opened as PR #14, then **closed** — not needed.
- The file exists at `bd-research/market-intel/companies/2026-04-25-shoaf-ecosystem.md` on that orphan branch if ever referenced.

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

See `sandbox/claude-flow-lite/reanalysis/report.md` (lands with PR #13) for the top-5 action items ordered by impact × reversibility.

---

## Jarvis (Claude Code skills) state

```bash
# vtv-team skill (existing on master)
test -f ~/.claude/skills/vtv-team/SKILL.md && echo "vtv-team OK" || echo "MISSING"

# bni-research skill (from PR #12 — landed on master)
mkdir -p ~/.claude/skills/bni-research
cp bd-research/bni-swva-pro/bni-research-skill.md ~/.claude/skills/bni-research/SKILL.md
```

Both skills are independent. Activate either with `/<skill-name>` or just reference the work conversationally.

---

## Operating rules (codified in CLAUDE.md, lands when PR #13 merges)

### Rule 1 — Check master before fixing anything from a stored findings file

Before writing a fix for anything that came from a stored findings file, reanalysis report, or security-scanner output:

```bash
git fetch origin master
git log --oneline HEAD..origin/master
git log --oneline origin/master -- <path/you/plan/to/edit>
```

Three possible outcomes:

1. Already fixed on master with a different approach → yield to master, merge it in
2. Already fixed on master with the same approach → finding is stale; skip
3. Not touched on master → proceed

Parallel Claude sessions push to master concurrently. Treat master as a moving target.

### Rule 2 — Don't auto-ship chat-only deliverables

If something was discussed in chat but never explicitly told to be saved/built, **ask** before shipping it as a PR. The "looks like a loose end → save it as a goodnight gift" instinct cost a round-trip PR on 2026-05-27 when the Shoaf market intel analysis was filed → reviewed → closed because it wasn't actually on the to-do list. Better default: at the end of a session, name the open loose ends and ask which to ship vs. drop.

Concrete heuristic: if the user did NOT explicitly say "save this" or "ship this" or "open a PR for this," it's not yours to ship — even when the conversation history makes it look halfway done.

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

*Last refreshed 2026-05-27 — PR #14 closed (not needed), Rule 2 (don't auto-ship chat-only deliverables) added to operating rules. Refresh this file whenever the in-flight state shifts meaningfully.*
