# VTV Reanalysis — Multi-Agent Pass

**Date:** 2026-04-18
**Method:** Five specialized subagents (architect, db-auditor, market-analyst, security-auditor, ux-reviewer) dispatched in parallel via the claude-flow-lite orchestrator. Findings in `memory/findings.jsonl` (35 items); cross-cutting patterns in `memory/patterns.md`.

## Executive summary

The reanalysis surfaced one **critical** issue, one **deliverable gap** directly relevant to this branch's purpose, and three system-wide patterns that a single-agent review would likely have missed.

1. **Critical auth bypass** on `/api/member` (email-param fallback with no JWT) means any known email returns full PII, assessment scores, and Stripe IDs. This blocks any B2B data-licensing thesis until fixed — you cannot sell cohort data from a platform that leaks individual data.
2. **The fishing-kayak / "Chad" deliverable this branch was named for does not yet exist.** Branch is empty of new artifacts. The scaffolding from this pass gives us the data-point count (~100 per user median) needed to build it properly.
3. **The three cross-cutting patterns worth escalating** (full list in `memory/patterns.md`): doc ↔ code drift, privacy-as-decoration, and admin/public boundary leaks.

## Top 5 action items (impact × reversibility)

| # | Action | Impact | Effort | Why now |
|---|---|---|---|---|
| 1 | Remove email-param fallback on `/api/member`; require JWT | Critical | ~1 hr | Blocks data-licensing revenue model; single-change fix |
| 2 | Separate `JWT_SECRET` from `ADMIN_API_KEY`; rotate both | High | ~30 min | Coupling means admin-key breach forges all JWTs |
| 3 | Build the Chad / fishing-kayak cohort case study (100-user mock, cross-pillar segmentation, GA/Meta-gap insights) | High | 1 day | The branch's stated deliverable; validates the niche-brand pitch |
| 4 | Add query-layer enforcement of `privacy_preferences` before any export or HubSpot sync | High | ~2 hr | Converts a compliance risk into a differentiated selling point |
| 5 | Consolidate duplicates: pick one pitch deck, one upsell page, one portfolio page; archive the rest | Medium | ~1 hr | Narrative discipline before investor conversations |

## Per-agent findings

### Architecture (vtv-architect)
- [high] Cron drift: doc says EST, vercel.json runs UTC → 1-2hr off for every coaching send
- [high] 60+ endpoints in code vs. ~25 documented
- [med] Stripe webhooks → n8n with no fallback queue (SPoF)
- [med] docker-compose orphaned from Vercel prod
- [med] Tier enforcement inconsistent across endpoints

### Data model (vtv-db-auditor)
- [critical] 18 undocumented tables incl. full dating ecosystem (7 dating_* tables)
- [high] Missing FKs on `team_members.contact_id`, `partner_profiles.contact_id`
- [high] 5 orphan tables (no writers): assessment_progress, member_referral_rewards, rfm_chapters, rfm_subscriber_progress, vault_content
- [med] `dating_profiles` is a PII supernode (DOB, body, faith, lat/lng, photos, free-text bio)
- [med] `privacy_preferences` not enforced at query level
- **Data-point capacity per user:** 67 assessment + up to 41 relationship + 5-30 engagement + 10 demo = **80-120 median, ~100 sellable** to a niche-brand cohort

### Market materials (vtv-market-analyst)
- [critical] Privacy defaults block the data-licensing model that the pitch decks depend on
- [high] The Chad/fishing-kayak deliverable this branch is named for is not built yet
- [high] "Cross-pillar insights" moat overlaps with HubSpot+Klaviyo behavioral layering
- [med] "14 verticals" and "RE appraisal API" require tables that don't exist
- [med] Projections assume consent opt-in rates that have never been measured
- **10 differentiated data points** a fishing-kayak brand could buy from VTV but not from Meta/GA are enumerated in the agent's output (cross-pillar combinations, couple/group dynamic, 90-day challenge cohort, peer-rating × trust, etc.)

### Security (vtv-security-auditor)
- **[CRITICAL] `/api/member` email-param auth bypass** — api/index.js:1779-1787
- [high] `/api/member/has-pin` enables email enumeration (api/index.js:1766-1774)
- [high] `JWT_SECRET` falls back to `ADMIN_API_KEY` (api/index.js:65)
- [high] CORS regex allows any `vtv-assessment*.vercel.app` preview deploy (api/index.js:176)
- [med] HubSpot sync ignores `privacy_preferences`
- [med] Rate limit on auth-adjacent endpoints too loose (60/min default vs. 10/min auth tier)

### UX / page inventory (vtv-ux-reviewer)
- [high] `index.html` has no internal link to pricing/report; broken `/checkout?tier=X` routes
- [high] `upsell.html` and `premium.html` duplicate each other
- [high] Two competing investor pitches with no clear canonical
- [high] 7.3MB of hero imagery at repo root; mobile penalty
- [med] 3 admin pages publicly deployable without page-level gating
- **Page classification:** 6 funnel-critical, 18 supporting, 9 stale, 5 duplicate, 4 dead-weight out of 62 top-level HTMLs

## Cross-cutting patterns
See `memory/patterns.md`. Short version:
1. Docs ↔ code drift (architect + db-auditor)
2. Consent/privacy claimed but not enforced (market + db + security)
3. Admin/public surface inconsistently gated (ux + security)
4. External deps without fallback (architect + security)
5. Duplicate competing artifacts (ux + market)

## What changed in our understanding

Before this pass: VTV's pitch — 5 pillars, unique cross-domain data, sellable to niche brands — read like a coherent thesis.

After this pass: the thesis is *schema-supportable* (the 80-120 data points per user are real), but it's blocked on three things, in order:
1. An auth hole that leaks individual PII (kills the B2B trust story)
2. Privacy flags that exist only in the schema, not in the query path (kills the compliance story)
3. The actual niche-brand case study (Chad / fishing-kayak) has not been built, so the thesis has no worked example

Fixing (1) and (2) takes under a day. Building (3) takes a day. That's the honest path from "pitch deck claims" to "pitch deck claims + a reviewer can verify them."

## Teardown
```bash
rm -rf sandbox/
```
Zero residue. Nothing was installed globally. No MCP server was registered. No external code was executed.
