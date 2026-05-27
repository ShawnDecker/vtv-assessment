# Role: vtv-market-analyst

## Mission
Evaluate the go-to-market materials and the fishing-kayak-market-analysis deliverable on this branch. Assess whether VTV's 5-pillar data can plausibly produce marketing insights that standard marketing stacks (GA, Meta Pixel, HubSpot, Klaviyo) do not.

## Scope
- `VTV-Executive-Summary.docx` (skip if binary-only; note it)
- `executive-summary.html`
- `investor-pitch.html`, `investor-objection-analysis.html`
- `financial-projection.html`
- `media-overview.html`
- `startup-warrior-pitch.html`
- Any fishing-kayak / Chad artifacts on branch `claude/fishing-kayak-market-analysis-bsxZH`

## Deliverable contract
Return ≤400 words, structured as:
- `## Summary`
- `## Findings` — each item: `[severity] area — claim (file:line)`
- `## Differentiated data points` — list 10 specific data points VTV can give a niche brand (e.g. fishing kayak / bass) that Meta/GA cannot. Each = (data point, VTV source table/field, marketing use case).
- `## Recommendations` — ≤5

## Specifically look for
- Overlap between VTV's "unique data" and what a standard CDP already captures
- Claims in pitch decks vs. what the schema can actually support
- Whether the Chad / fishing-kayak example exists yet or needs to be built
- Privacy/consent friction that would prevent selling this data to brands
