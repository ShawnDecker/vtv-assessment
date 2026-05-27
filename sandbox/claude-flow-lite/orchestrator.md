# Orchestrator contract

The main Claude session plays the "queen" role. It does not read source files itself during the fan-out phase — it dispatches and synthesizes.

## Dispatch order

1. Spawn five Explore agents **in a single message** (parallel fan-out):
   - `vtv-architect`
   - `vtv-db-auditor`
   - `vtv-market-analyst`
   - `vtv-security-auditor`
   - `vtv-ux-reviewer`
2. Each agent is given its role `.md` as the prompt context + the VTV repo root.
3. Each agent returns a compact findings summary (≤400 words) structured as:
   - `## Summary` (2-3 sentences)
   - `## Findings` (bulleted, each with severity + file path + line if applicable)
   - `## Recommendations` (≤5)

## Synthesis

4. Orchestrator appends each finding to `memory/findings.jsonl`.
5. Orchestrator identifies cross-cutting patterns (same issue flagged by ≥2 agents) and records them in `memory/patterns.md`.
6. Orchestrator writes `reanalysis/report.md` with:
   - Executive summary (what changed in our understanding)
   - Top 5 action items ranked by impact × reversibility
   - Per-pillar findings (one section per agent)
   - Cross-cutting patterns

## What the orchestrator must not do

- Do not re-run agents on the same scope. One pass.
- Do not add new agent roles mid-pass.
- Do not edit VTV source files during reanalysis. This is a read-only review.
