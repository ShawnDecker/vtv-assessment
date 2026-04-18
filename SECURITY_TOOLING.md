# Security tooling

Tier 1 security tooling added 2026-04-18. All workflows are non-blocking (`continue-on-error: true`) so they never fail a push to master — they surface findings in the Actions tab for review.

## What runs automatically

| Tool | Trigger | What it catches |
|---|---|---|
| [Semgrep](.github/workflows/semgrep.yml) | push master, PR, manual | SAST — auth bypasses, injection, JWT misuse, OWASP Top 10 |
| [gitleaks](.github/workflows/gitleaks.yml) | push master, PR, manual | Committed secrets (API keys, tokens, private keys) |
| [osv-scanner](.github/workflows/osv-scanner.yml) | push master, PR, weekly, manual | Known CVEs in npm dependencies |

## Zod validation

`zod` added as a dependency. Shared schemas live in [api/_validators/index.js](api/_validators/index.js). Use in handlers like:

```js
const { memberQuery, safeParse } = require('./_validators');
const parsed = safeParse(memberQuery, Object.fromEntries(params));
if (!parsed.ok) return res.status(400).json({ error: parsed.error });
```

Not yet wired to existing endpoints — migrate opportunistically as endpoints are touched.

## Tightening later (tier 2)

Once these have run a few times and the baseline is clean:
1. Remove `continue-on-error: true` so the workflows block merges on new findings.
2. Add Semgrep config to the root as `.semgrep.yml` with project-specific rules (e.g. "no `extractUser` followed by `emailParam` fallback").
3. Add a pre-commit hook mirroring gitleaks locally.

## Out of scope

- `@upstash/ratelimit` — requires Upstash Redis account setup, deferred.
- `Uptime Kuma` / `GlitchTip` — live on Hostinger VPS, tracked separately.
