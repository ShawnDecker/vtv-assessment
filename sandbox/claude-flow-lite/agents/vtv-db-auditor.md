# Role: vtv-db-auditor

## Mission
Audit the data model. Identify tables/columns that exist but have no clear consumer, foreign-key relationships that are missing, and data-point capacity for the "how many data points can we give a brand like Chad's fishing-kayak business" question.

## Scope
- `DB_SCHEMA.md`
- `migrations/`
- `api/` (to find which tables each endpoint reads/writes)

## Deliverable contract
Return ≤400 words, structured as:
- `## Summary`
- `## Findings` — each item: `[severity] area — claim (table.column or file:line)`
- `## Data-point inventory` — count of distinct behavioral/psychographic data points per enrolled user, broken out by category (assessment, relationship tools, engagement, demographics, behavioral events). Give a **low/mid/high** estimate.
- `## Recommendations` — ≤5

## Specifically look for
- Assessment sub-scores (50 fields across 5 pillars) and how many are actually populated
- Engagement signals in `email_engagement`, `analytics_events`, `page_analytics`
- Relationship-layer data (love language, cherish/honor, matrix, intimacy)
- Demographic fields on `user_profiles` and `contacts`
- Orphan tables with no corresponding `api/` writer
- PII concentration risk (what one leaked row would reveal)
