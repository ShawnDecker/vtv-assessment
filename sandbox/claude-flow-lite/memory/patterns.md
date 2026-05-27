# Cross-cutting patterns

Findings that were independently flagged by ≥2 agents. These are the ones to take most seriously — they're visible from more than one angle.

## 1. Documentation ↔ code drift (architect + db-auditor)
- Architecture doc lists ~25 endpoints; codebase has 60+.
- DB_SCHEMA.md documents 39 tables; codebase writes to 57 (18 undocumented, including the entire dating ecosystem).
- **Pattern:** docs are frozen at a point in time and were never regenerated. The same person writes features and docs; doc step is skipped under pressure.

## 2. Consent & privacy are claimed but not enforced (market-analyst + db-auditor + security-auditor)
- `privacy_preferences` flags exist but no query-layer enforcement.
- HubSpot sync pushes assessment scores without consent checks.
- Data-licensing revenue model (pitch decks, financial projection) assumes share rates that have never been measured.
- **Pattern:** privacy is a schema decoration, not a runtime invariant. This is the single biggest blocker to the "sell niche-brand cohort data" thesis.

## 3. Admin / internal surface leaks to public (ux-reviewer + security-auditor)
- `admin-contacts.html`, `team-admin.html`, `dating-admin.html` are deployable pages with no auth gate at the page level.
- `/api/member` can be queried by email with no JWT.
- `/api/admin/hubspot-sync` lacks consent gating.
- **Pattern:** the boundary between "admin" and "public" is enforced inconsistently — sometimes at the page, sometimes at the endpoint, sometimes not at all.

## 4. External dependencies without fallback (architect + security-auditor)
- n8n VPS: checkout.js silently no-ops if unreachable; no Stripe-webhook queue.
- Gmail SMTP: no documented retry/queue.
- ADMIN_API_KEY doubles as JWT_SECRET fallback — coupling that fails unsafely.
- **Pattern:** the system trusts external services to be up and distinct. Two are neither.

## 5. Duplicate / competing artifacts (ux-reviewer + market-analyst)
- Two pitch decks (investor-pitch.html + startup-warrior-pitch.html).
- Two upsell pages (upsell.html + premium.html).
- Three portfolio pages (joy-sutton-showcase + media-overview + portfolio-links).
- Pitch-deck claims ("14 verticals", "RE appraisal API") don't match what the schema supports.
- **Pattern:** narrative sprawl. The product has more stories than it has features. Pick the canonical one.
