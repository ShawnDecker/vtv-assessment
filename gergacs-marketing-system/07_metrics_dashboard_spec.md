# Metrics Dashboard Spec

What to build · what to measure · where to surface it.

---

## The dashboard structure

A single Notion page titled `Gergacs Realty · Campaign Dashboard` that lives in the same workspace as the Pearl Pipeline and Lighthouse databases.

```
GERGACS REALTY · CAMPAIGN DASHBOARD
═══════════════════════════════════════════

THIS WEEK
  ┌─ Lane 1 (Sales)
  ├─ Lane 2 (Marketing)
  └─ Lane 3 (Relational)

THIS MONTH (running)

CAMPAIGN-TO-DATE (cumulative)

DECISIONS NEEDED THIS WEEK

UPCOMING ACTIONS
```

---

## What goes on it (block by block)

### Block 1 · This Week (top of page)

Three side-by-side stat-cards, one per lane. Each card shows:

**Lane 1 (Sales)**
```
Booked consults:      X / week (target 2-4)
Cost per booked:      $X (target ≤ $40)
Hottest hook:         [creative name]
Decision:             [scale / kill / iterate]
```

**Lane 2 (Marketing)**
```
IG followers gained:  +X
Top Reel reach:       X (target 10k+)
YT subs gained:       +X
Newsletter subs:      +X
Top performer:        [URL + key metric]
```

**Lane 3 (Relational)**
```
Touches sent:         X / 5
Reviews collected:    +X
Referrals:            +X
Past-clients reactivated: +X
Event status:         [planned / executed / followed up]
```

Build via Notion linked-database views from Pearl Pipeline + Lighthouse + Automation Log + a new "Lane 3 Touches" database (simple list).

### Block 2 · This Month (running totals)

Same metrics as Block 1, but cumulative over 30 days. Auto-updates from underlying databases.

### Block 3 · Campaign-to-Date

Cumulative since campaign start (pinned date). Tracks the same 12-15 KPIs in `01_strategy/kpi_framework.md`.

### Block 4 · Decisions Needed This Week

A sortable table (Notion database):
- Decision (e.g., "Scale ad creative variant B?")
- Owner (Nikki / Muhammed)
- Trigger (metric or signal)
- Due (date)
- Status (open / decided)
- Outcome (once decided)

### Block 5 · Upcoming Actions (calendar embed)

Notion calendar view of scheduled actions — Tuesday shoot, Wednesday personal touches, Thursday YT publish, etc.

---

## Data sources and sync cadence

| Metric | Source | Sync method | Cadence |
|--------|--------|-------------|---------|
| Booked consults | Microsoft Bookings + BoldTrail | Manual or Make → Notion | Daily |
| Cost per booked | Meta Ads / consults | Manual entry | Weekly |
| Consult → engagement | BoldTrail stage moves | Make scenario | Real-time |
| IG followers | Metricool | Manual screenshot or API | Weekly |
| YT subs / watch hours | YouTube Studio | Manual | Weekly |
| Newsletter subs | BoldTrail audience size | Manual | Weekly |
| Blog sessions | Google Analytics | Site Kit displays in WP admin | Weekly |
| Personal touches sent | Trello completed cards | Make → Notion | Real-time |
| Reviews collected | GBP + Zillow + FB | Manual count | Weekly |
| Referrals received | BoldTrail `referral` tag count | Make scenario | Real-time |
| Closed deals | SkySlope | Manual entry | Per-deal |

---

## Monday Brief automation (the heart of the dashboard)

**File:** `04_agents/metrics-reviewer.md` (skill: `gergacs-metrics-reviewer`)

Every Monday 8 AM, a Make scenario fires:

1. Pulls last week's data from each source (the ones that have APIs; manual ones flagged "missing data")
2. Compiles into the structured "paste-in" format the agent expects
3. Invokes the metrics-reviewer skill (or, if running manually, Muhammed pastes data into Claude / ChatGPT with the skill prompt)
4. Output: the Monday Brief in Markdown
5. Posts to Notion · Campaign Dashboard · "This Week's Brief"
6. Emails to nikki@gergacsrealty.com via Outlook

**Output format:** see the `gergacs-metrics-reviewer` skill spec for full Brief template.

---

## Mid-month deep dive (Day 14)

A longer brief that adds:

- Performance by ad creative variant (not just by ad set)
- Performance by content series (not just by individual post)
- Persona × hook structure heat map (which combinations are pulling)
- Forecast for end-of-month metrics based on first half trend
- Decisions to bring forward into the second half

Manual: ~ 90 minutes for Muhammed + Nikki together.

---

## Day 30 final report

Full campaign report. Includes:

- Final cumulative metrics across all 3 lanes
- ROI calculation (revenue from closed deals + expected pipeline value / cost of campaign)
- Top-3 wins of the month
- Top-3 things that didn't work and why
- Month 2 brief: what to keep, what to kill, what to test next
- Skill-building note: what Nikki and Muhammed got better at

Format: 4-6 page PDF + Notion page. Stored in `06_metrics/2026-04-month-1-report.pdf` (folder created when first report ships).

---

## Anti-metrics — explicitly do NOT track on the dashboard

- IG total likes (vanity)
- Generic impression counts (vanity unless paired with conversion)
- Newsletter open rate above 50% (almost always inflated by bots/forwarders)
- "Followers gained" without engagement check
- Blog traffic from non-target geo (filter Google Analytics by Savannah-relevant region)
- "Time on site" without conversion context
- Engagement rate as a single number — break it down by save/share/comment

If a stakeholder asks for one of these, add it as a footnote, not a top-line metric.

---

## Dashboard hygiene

- Every metric has a definition (single source of truth, calculated how)
- Every metric has a target (or "track only — not optimized for")
- Every metric has an owner (who pulls it, when)
- Every metric has a threshold (what's good, what's bad, what triggers action)

If a metric is on the dashboard for more than 30 days without anyone using it to make a decision, kill it. Dashboards rot when they're cluttered with metrics nobody references.
