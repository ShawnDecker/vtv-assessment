# Function-Call Escalation Tier — Local Smoke Test

Validates the new tool-call escalation tier (added 2026-05-12 to `api/ai.js`) by invoking the handler directly with mocked req/res so we exercise the full **Ollama → Haiku → Opus** chain with real local Ollama + real `.env.local` credentials.

## Why this exists

Vercel serverless can't reach local Ollama (no tunnel yet — see `TASKS.md` Cloudflare Tunnel item). So the only way to test the LOCAL tier before that tunnel ships is to run the handler in a local Node process where Ollama is reachable at `http://localhost:11434`.

## Prerequisites

- Ollama daemon running locally with `qwen3:8b` pulled
- `.env.local` populated with `DATABASE_URL` and `ADMIN_API_KEY`
- Optional: `ANTHROPIC_API_KEY` for cloud-fallback testing (not required when local tier passes)

## Run

```bash
cd vtv-assessment
set -a && source .env.local && set +a
node scripts/test-function-call-tier.js
```

## What it tests

| # | Prompt | Expected | Why |
|---|---|---|---|
| 1 | "What is the weather in Roanoke VA?" | `tool=get_weather` | Happy path |
| 2 | "Find the Stripe charge ch_3PvLm1ChDdL2pNXyZQ for refund." | `tool=get_stripe_charge` | Multi-tool disambiguation |
| 3 | "Tell me a joke." | `tool=null` | Refusal pattern (Hermes 3 failed this in original bench — qwen3:8b passed) |

## Expected output (last validated 2026-05-12)

```
=== Summary: 3/3 passed ===
```

All three resolve on local tier in 16–25s, no escalation needed, no Anthropic cost.

## How to deliberately force an escalation (to populate `tool_call_corrections`)

Edit `LOCAL_MODELS['function-call']` in `api/ai.js` to `'hermes3:8b'` temporarily, re-run, and Test 3 should fail validation locally → escalate to Haiku → capture the (failed_local, corrected) pair in `tool_call_corrections`. **Revert before deploy.**

## Related files

- `api/ai.js` — the handler under test (function-call action handler + escalation orchestrator + validator)
- `_claude/scripts/hermes-bench/hermes_native_bench.py` — original bench that drove the qwen3:8b-as-default decision
- `ValueToVictory/10-Reports/hermes-vs-qwen-bench-2026-05-12.md` — bench report
- `memory/reference_ollama_lineup.md` — role-by-role model map
