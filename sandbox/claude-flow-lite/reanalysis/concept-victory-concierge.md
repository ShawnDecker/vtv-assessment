# Victory Concierge — design

Applied from the "Talent Capital Agentic Experience" pattern (Concierge + specialized squad + unified front door + intelligent routing + context awareness).

## The problem on VTV today

Users land on `index.html` and are dropped straight into the 50-question extensive assessment. There is no qualifier, no routing, no memory of why they came. A coach, a couple, a business-team admin, and a stuck individual all hit the same door and the same funnel. Conversion friction is high and the other surfaces (`relationship-hub`, `teams`, `coaching`, `challenge`, `stuck`, `consult`, `audiobook`) are orphans — real pages, zero navigation paths from the front door.

## The pattern

```
                         /start (Victory Concierge)
                                    │
                    3-question qualifier + optional contact_id
                                    │
                          POST /api/ai  action:concierge-route
                                    │
           ┌──────┬──────┬──────┬───┴──┬──────┬──────┬──────┐
           ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
      Assessment Pillar Relationship Teams Challenge Coaching Growth Faith
         (/)   /framework /relationship /teams /challenge /coaching /consult /audiobook
                  /{pillar} -hub
```

The Concierge is the orchestrator. The "squad" below it is every existing VTV surface, each now addressable as a named agent with a clear routing reason.

## Agent mapping (what's new ↔ what's reused)

| Agent | Role | Existing VTV surface | Signals that pick it |
|---|---|---|---|
| **Assessment** | Cold-start qualifier | `index.html` (extensive) | no prior assessment |
| **Pillar Coach** | Depth on weakest pillar | `framework-*.html` + `coaching-insight` action | `primary_need = growth` OR fallback |
| **Relationship** | Couples, love-language, intimacy | `relationship-hub.html` + `/api/r/*` | `role = couple` |
| **Teams** | Org assessments, leadership | `teams.html`, `team-admin.html` | `role = business` |
| **Challenge** | 30/90-day structured program | `challenge.html`, `couple-challenge.html` | `primary_need = challenge` or `events` |
| **Coaching** | Calendly + coaching intake | `coaching.html`, `consult.html`, `coaching_requests` table | `primary_need = career` |
| **Growth** | Entrepreneur / real-estate Phase 2 / investor | `consult.html`, `realestate.html`, `investor-pitch.html` | `primary_need = entrepreneur` |
| **Stuck** | Unstuck diagnostic | `stuck.html` | `primary_need = feeling_stuck` |
| **Faith** | Devotional, audiobook, daily word | `audiobook.html`, `daily-word.html`, `rfm_devotionals` | `primary_need = faith` |

Nine agents. Every one is an existing page or flow — the Concierge just routes into them with an explicit reason the user sees.

## Capabilities (from the source slide, mapped)

- **Unified Front Door.** New route `/concierge` → `concierge.html`. Does not replace `/start` (which still points to `funnel.html` for back-compat); promotion to the primary entry is a follow-up decision after the Concierge proves its routing in the wild. `index.html` stays as the Assessment Agent's landing so direct links still work.
- **Intelligent Routing.** Deterministic rules first — `api/ai.js action:'concierge-route'` picks an agent from `(role, primary_need, has_assessment, weakest_pillar)`. Upgradable to LLM-classifier later without breaking the contract.
- **Context Awareness.** If the caller passes `contactId`, server looks up prior `assessments` (for `weakest_pillar`) and `user_profiles` (for `membership_tier`). Logged-out first-time users get the cold-start path.

## Telemetry

Every routing decision writes a row to `ai_calls` with `action='concierge-route'`, `provider='rule'`, `model='rule-based'`, and `metadata.{role,need,weakest,agent,route}`. The existing AI Cost dashboard panel on `/agent-dashboard` rolls these up alongside the LLM calls, so we can see which agent lane is getting picked for which signal combinations. After 2–4 weeks of real traffic, the data tells us which rules to promote to an LLM-scored router and which doors aren't pulling their weight.

## What's out of scope for phase 1

- Conversational agents. Each agent is still a page link, not a chat session. Phase 2 can deepen the Pillar Coach / Coaching agents into actual `coaching-insight` chats.
- Rewriting the orphan pages. They stay as-is; the Concierge just gives them a discovery path.
- LLM-based classification of `primary_need`. Rules are deterministic and auditable. Promote to LLM once `ai_calls` shows which rules are misfiring.
- Authenticated context. Works for logged-out users too; `contactId` is optional. Logged-in members get richer routing.

## Tear-down

Remove `concierge.html`, the `/start` route in `vercel.json`, and the `concierge-route` action block in `api/ai.js`. Nothing else touched. Existing `/` assessment entry is unchanged.
