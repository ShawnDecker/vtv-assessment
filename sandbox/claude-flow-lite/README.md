# claude-flow-lite

Local, dependency-free equivalent of the patterns worth stealing from `ruvnet/claude-flow`. Lives entirely in `sandbox/` so it can be deleted with `rm -rf sandbox/` and leave no residue.

## Why not install upstream

- The one-line installer fetches from `cdn.jsdelivr.net`, which is blocked in this environment.
- Upstream pulls `agentic-flow@alpha` as a foundational dep (yellow flag for production use).
- MCP tools only register for new Claude Code sessions, so installing wouldn't help the current run anyway.
- The ideas that matter — specialized agent roles, memory that persists findings, a topology for dispatching them — are portable without their 313-tool MCP surface.

## What we kept

| Upstream concept | Local equivalent |
|---|---|
| Hive-mind queen + workers | `orchestrator.md` (main Claude) dispatches `agents/*.md` roles |
| Swarm topology (mesh/hierarchical) | `topology.md` — one hierarchical pass, parallel fan-out at leaves |
| ReasoningBank (persisted learnings) | `memory/findings.jsonl` + `memory/patterns.md` |
| SPARC spec-first | Each agent role has an explicit contract in its `.md` |
| MCP tool proliferation | Native Claude Code tools only (Read/Grep/Glob/Explore subagent) |

## Layout

```
sandbox/claude-flow-lite/
├── README.md           # This file
├── orchestrator.md     # Dispatch rules for the main agent
├── topology.md         # When to fan out, when to serialize
├── agents/             # Specialized role definitions
│   ├── vtv-architect.md
│   ├── vtv-db-auditor.md
│   ├── vtv-market-analyst.md
│   ├── vtv-security-auditor.md
│   └── vtv-ux-reviewer.md
├── memory/
│   ├── findings.jsonl  # One JSON object per finding, append-only
│   └── patterns.md     # Cross-cutting patterns that re-appear
└── reanalysis/
    └── report.md       # Output of the reanalysis pass
```

## Tear-down

```bash
rm -rf sandbox/
```

No global installs, no MCP registrations, no npm cache entries.
