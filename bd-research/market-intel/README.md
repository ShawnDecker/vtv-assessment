# Market Intel — VTV strategic research

Single-company deep-dive analyses. Format borrowed from the KBF-style breakdown:
exec summary → property/asset breakdown → income distribution → enterprise mechanics →
replication playbook → status flags → key quotes → tags.

Files live in `companies/` named `YYYY-MM-DD-<company-slug>.md` so they sort chronologically.

This is research output, not platform code. Safe to delete the folder without affecting any
production behavior:

```bash
rm -rf bd-research/market-intel/
```

## Convention

- One file per company per analysis pass. If you re-analyze a company, create a new dated file rather than overwriting.
- Public-only content. Operational identifiers (Stripe acct IDs, Vercel team IDs, VPS IPs) that already appear elsewhere in the repo are OK; anything that's a real secret stays in env vars.
- Diagrams in Mermaid where possible (renders in GitHub + Claude Code previews).
- Status flags use the four-bucket scheme: **Go** / **Pending** / **Needs Attention** / **Stop**.
