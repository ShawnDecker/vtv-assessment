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

Wired in `GET /api/member` (inline email-shape check). Migrate other endpoints opportunistically as they're touched.

## Known false positives

Kept here so future Claude sessions don't re-investigate them:

| Tool | Location | Why it's a false positive |
|---|---|---|
| Semgrep `raw-html-format` | [api/free-book-signup.js:108](api/free-book-signup.js) | User name is escaped via `escHtml()` on line 9 before template interpolation. Semgrep doesn't trace the escape function. |
| gitleaks `curl-auth-header` × 2 | [scripts/SOCIAL-SETUP.md:67,80](scripts/SOCIAL-SETUP.md) | Documentation placeholders (`YOUR_ADMIN_KEY` literal string). Fingerprinted in `.gitleaksignore`. |
| gitleaks `generic-api-key` | [api/index.js:5103](api/index.js) | Matched a closing-bracket pattern inside a coaching-advice array, not a real key. Fingerprinted. |
| gitleaks `gcp-api-key` | [index.html:225](index.html) | Matched `hash.indexOf('#/capture')` route check, not a GCP key. Fingerprinted. |

Real leaks (`.env.stripe` at commit 8e1981ba) are **not** allowlisted — they require credential rotation + history purge.

## Tightening later (tier 2)

Once these have run a few times and the baseline is clean:
1. Remove `continue-on-error: true` so the workflows block merges on new findings.
2. Add Semgrep config to the root as `.semgrep.yml` with project-specific rules (e.g. "no `extractUser` followed by `emailParam` fallback").
3. Add a pre-commit hook mirroring gitleaks locally.

## Out of scope

- `@upstash/ratelimit` — requires Upstash Redis account setup, deferred.
- `Uptime Kuma` / `GlitchTip` — live on Hostinger VPS, tracked separately.
