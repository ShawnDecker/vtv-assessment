# Topology

Single hierarchical pass with parallel fan-out at the leaves. Borrowed from claude-flow's "queen + workers" but stripped to what's actually useful.

```
                   Orchestrator (main Claude)
                            │
        ┌───────────┬───────┼───────┬───────────┐
        ▼           ▼       ▼       ▼           ▼
   architect    db-auditor market  security    ux
   (Explore)   (Explore)  (Explore)(Explore) (Explore)
        │           │       │       │           │
        └───────────┴───────┼───────┴───────────┘
                            ▼
                  memory/findings.jsonl
                            │
                            ▼
                   Orchestrator synthesis
                            │
                            ▼
                  reanalysis/report.md
```

## Rules

1. **Fan out on reads, serialize on writes.** Five Explore agents can read the repo in parallel. Only the orchestrator writes to `memory/` and `reanalysis/`.
2. **Each agent returns ≤400 words** — keeps the synthesis step tractable.
3. **Each finding is a JSON line** in `memory/findings.jsonl` with `{agent, severity, area, claim, evidence_path}`. This is the ReasoningBank analog.
4. **No consensus protocol.** Upstream's Byzantine/weighted consensus is overkill for a single-repo review. Orchestrator resolves conflicts directly.
5. **No self-healing loop.** One pass, then stop. We can re-run by hand.
