# claude-flow-lite

A dependency-free, portable skeleton of the patterns worth stealing from `ruvnet/claude-flow`. Drop this into any repo, point the agent contracts at your codebase, dispatch the five (or however many) specialist agents in parallel, and collect findings.

## Why not install upstream claude-flow

- Its installer fetches from `cdn.jsdelivr.net` (blocked in some sandboxes).
- Upstream depends on `agentic-flow@alpha` — yellow flag for production.
- MCP tools only register for new Claude Code sessions, so installing doesn't help the session you're in.
- The ideas that matter — specialized agent roles, persisted findings, a hierarchical dispatch topology — are portable without their 313-tool MCP surface.

## What's kept from upstream

| Upstream concept | Local equivalent |
|---|---|
| Hive-mind queen + workers | `orchestrator.md` (main Claude) dispatches `agents/*.md` roles |
| Swarm topology (mesh/hierarchical) | `topology.md` — one hierarchical pass, parallel fan-out at leaves |
| ReasoningBank (persisted learnings) | `memory/findings.jsonl` + `memory/patterns.md` |
| SPARC spec-first | Each agent role has an explicit contract in its `.md` |
| MCP tool proliferation | Native Claude Code tools only (Read / Grep / Glob / `Agent` with `Explore` subagent) |

## Layout

```
.
├── README.md           # This file
├── orchestrator.md     # Dispatch rules for the main agent (the "queen")
├── topology.md         # When to fan out, when to serialize
├── agents/             # Specialized role definitions (contracts)
│   ├── vtv-architect.md        ← rename or replace per project
│   ├── vtv-db-auditor.md
│   ├── vtv-market-analyst.md
│   ├── vtv-security-auditor.md
│   └── vtv-ux-reviewer.md
├── memory/
│   ├── findings.jsonl  # One JSON object per finding, append-only
│   └── patterns.md     # Cross-cutting patterns that re-appear
└── reanalysis/
    └── report.md       # Example output from a real run against VTV
```

## How to use it in a new project

1. **Drop it in.** Copy this directory into a `sandbox/` folder at the root of your new repo (or keep it at root if you're starting fresh).
2. **Rewrite the agents.** The five `agents/vtv-*.md` files are an example set for a full-stack web app. Rename and edit the scope + "specifically look for" sections to match what matters in your codebase. Keep the deliverable contract (summary / findings / recommendations) — it's what makes synthesis tractable.
3. **Clear the memory.** `memory/findings.jsonl` and `memory/patterns.md` contain findings from the VTV run. Truncate them before your first pass:
   ```bash
   : > memory/findings.jsonl
   : > memory/patterns.md
   ```
4. **Run the orchestrator.** In a Claude Code session, paste `orchestrator.md` as instructions and have the session dispatch the agents in a single message (parallel fan-out). Each returns a findings block; the orchestrator appends to `findings.jsonl`, distills cross-cutting patterns into `patterns.md`, and writes the synthesis to `reanalysis/report.md`.
5. **Teardown.** `rm -rf sandbox/`. No global installs, no MCP registrations, no npm cache entries.

## Swapping agent roles

The five included agents are:
- `architect` — docs ↔ code drift, infra coupling
- `db-auditor` — schema completeness, FKs, orphans, PII concentration, data-point inventory
- `market-analyst` — GTM claims vs. product reality
- `security-auditor` — auth, rate limits, secrets, CORS, PII exposure
- `ux-reviewer` — page inventory, funnel completeness, mobile risk

For a different codebase you probably want a different cast. Common replacements:
- `perf-analyst` for performance-critical services
- `api-contract-auditor` for anything with public APIs
- `test-coverage-auditor` for anything claiming test coverage
- `dependency-auditor` for anything with a large lockfile
- `release-engineer` for CI/CD / deploy-path review

Each role file should be ≤40 lines. The discipline is: name the scope, name the deliverable shape, name the things to look for, name what's out of scope. Anything longer is pretending to be a spec.

## Reference run

`reanalysis/report.md` is a real synthesis from running this against the VTV (Value to Victory) assessment platform. Read it as an example of the output shape, not as a template — the action items are specific to that repo.
