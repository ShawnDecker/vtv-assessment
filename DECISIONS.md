# DECISIONS.md

> Append-only log of substantive decisions made on this project. Captures **rejected alternatives** and **why** — the things git history loses. One entry per decision. Newest at the bottom (chronological).

Format:

```
## YYYY-MM-DD · D-NNN · {short title}

**Context:** one paragraph — what triggered the decision.
**Decision:** one paragraph — what we chose.
**Rejected alternatives:** bulleted list — what we considered and why we said no.
**Consequences:** one paragraph — what this commits us to / locks out.
**Reviewed by:** Council / Five-Voice / Yale Lawyer / Stripe Ops / etc. (if any)
**Linked features:** F-T?-? (which feature_list.json items this constrains)
```

Rules:

- **Never delete an entry.** If a decision is reversed, add a NEW entry that supersedes; reference the original by D-NNN.
- **D-NNN is stable forever.** Increments by 1; never re-used.
- **Rejected alternatives are mandatory.** A decision without rejected alternatives is just a statement.
- **Why beats what.** Future you will read this when the original "what" no longer makes sense.

---

## Decisions

<!-- Append entries below this line. Example:

## 2026-05-03 · D-001 · Use feature_list.json over Notion as scope source-of-truth

**Context:** Sandi has a markdown master at _knowledge/PROJECT_STATUS_MASTER.md and we needed a machine-readable source. Notion was on the table because Sandi already uses it.
**Decision:** Adopt feature_list.json (JSON in repo) as canonical; markdown as derived view.
**Rejected alternatives:**
- Notion API as canonical — adds runtime dependency for offline agents; no schema enforcement; sync is async.
- Markdown table as canonical — agents can't reliably parse tables under edits; no enum validation.
- Linear / Jira — overkill for a multi-track creator who isn't a software team.
**Consequences:** Every status change must update the JSON; markdown becomes a generated artifact (not yet automated). Two-source-of-truth risk until generator ships.
**Reviewed by:** Council of Seven (Strategist + Operator + Skeptic concurred).
**Linked features:** F-T1-A through F-T2-F (all of Sandi's seed).
-->
