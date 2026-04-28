# KPI Framework

What to measure, where to look for it, what threshold counts as "winning."

## The scoreboard (week-1 → week-30)

```
LANE 1 — SALES
  Booked consults (week)            → 2-4 in week 1, 5-8 by week 4
  Booked consults (cumulative)      → 8-15 over 30 days
  Cost per booked consult           → ≤ $40 (ad spend / consults)
  Consult → engagement rate         → 25%+ (signed listing or buyer agency)
  Closed deals attributable         → 1+ in 30 days, 3-5 by day 90

LANE 2 — MARKETING
  IG followers                      → +25-40% over 30 days
  IG average Reel reach             → top 3 Reels of month each above 10k
  YouTube subscribers               → +50-150 over 30 days
  YouTube watch hours               → +50% vs prior 30 days
  Newsletter subscribers            → +100 over 30 days
  Blog organic traffic              → +30% by day 60 (lagging metric)
  Blog posts ranking top 20         → 3-5 by day 90 for target keywords

LANE 3 — RELATIONAL
  Personal touches sent (week)      → 5/week minimum from Nikki to past clients
  Reviews collected (cumulative)    → 10+ over 30 days
  Referrals received                → 2-4 over 30 days
  Client event attendance           → 8-12 attendees at month-end event
  Past-client pipeline reactivation → 3-5 past clients in active conversation
```

## Where to pull each metric

| Metric | Source | Cadence |
|--------|--------|---------|
| Booked consults | Microsoft Bookings + BoldTrail | Daily (Notion sync) |
| Cost per booked | Meta Ads Manager / consults | Weekly |
| Consult → engagement | BoldTrail (stage move Active → Under Contract) | Weekly |
| Closed deals | SkySlope | Per-deal (event-driven) |
| IG followers + reach | Metricool / Instagram native | Weekly |
| YouTube subs + watch hours | YouTube Studio | Weekly |
| Newsletter subs | BoldTrail (audience size) | Weekly |
| Blog traffic | Google Analytics on WordPress | Weekly |
| Blog rankings | Google Search Console + manual SERP checks | Bi-weekly |
| Personal touches | Trello completed cards | Weekly |
| Reviews collected | Google Business Profile + Zillow + Facebook | Weekly |
| Referrals received | BoldTrail (`referral` tag count) | Weekly |
| Event attendance | Headcount at event | Once |
| Past-client reactivation | BoldTrail (past-client contacts moved to Active) | Weekly |

## The Monday Brief KPI block

Every Monday's brief (built into the ops package SOP-07) surfaces these specific numbers from last week:

```
WEEK ENDING [date]

LANE 1 — SALES
  Booked consults:     X (vs target 2-4)
  Cost per booked:     $X (vs target ≤ $40)
  Top-performing ad:   [creative name + key metric]
  Decision needed:     [scale/kill/iterate]

LANE 2 — MARKETING
  IG followers gained: X (vs target +20-30/wk)
  Top Reel:            [URL + reach]
  YouTube uploads:     [count + cumulative subs]
  Blog publishes:      [count]
  Newsletter subs:     X
  Decision needed:     [more of X / less of Y]

LANE 3 — RELATIONAL
  Touches sent:        X / 5
  Reviews collected:   X (vs target 2-3/wk)
  Referrals:           X (cumulative this campaign: Y)
  Past clients reactivated: X
```

If three weeks in a row a target is missed by more than 50%, escalate to a tactic review — don't just keep running the same play.

## Lagging vs leading indicators

| Leading (move first, predict outcomes) | Lagging (move later, confirm outcomes) |
|---------------------------------------|----------------------------------------|
| ManyChat keyword captures | Closed deals |
| Microsoft Bookings page views | Commission earned |
| IG saves on Reels | Audience reactivation |
| Newsletter open rates | Blog rankings |
| Past-client touches sent | Referrals received |

Optimize for leading indicators in week 1-2. Trust the lagging indicators by week 4.

## Anti-metrics — explicitly DO NOT optimize

- IG total likes (vanity)
- Generic impression counts
- Newsletter open rate above 50% (almost always bots/forwarders, not real engagement)
- "Followers gained" without engagement check
- Blog traffic from non-target geo (Savannah-relevant content should attract Savannah-relevant traffic; if Indian or Russian traffic spikes, ignore it)
- "Time on site" without context
- Engagement rate as a single number — it lies

## Threshold rules for kill / scale / iterate

### Kill a Meta ad if:
- Cost per ManyChat capture > $25 after $50 spent
- Click-through rate < 0.8% after $50 spent
- ManyChat → BoldTrail conversion rate < 30%

### Scale a Meta ad if:
- Cost per booked consult < $30
- Consult → engagement rate > 35%
- Cost per closed deal projected to be < $300 (rough math: $30 × 10 consults × 30% close rate)

### Iterate (don't kill, don't scale) if:
- Performance is medium across all metrics — change one variable at a time and re-measure for one week

### Kill a content series if:
- Three weeks in a row no leads attributed AND no follower lift
- Comments / DMs are negative or off-brand

### Scale a content series if:
- One piece breaks 3x average reach AND drives ManyChat keyword captures

## Reporting rhythm

| When | What | To whom |
|------|------|---------|
| Daily | Microsoft Bookings calendar review | Nikki |
| Weekly Monday | Monday Brief (Lane 1+2+3 numbers + decisions) | Nikki + Muhammed |
| Weekly Friday | Lane 3 personal-touch progress check | Nikki |
| Day 14 | Mid-month deep dive — performance by ad creative + content series | Nikki + Shawn (VTV) |
| Day 30 | Full month report — conversions, ROI, lessons, month-2 brief | Nikki + Shawn (VTV) |

The 30-day report defines the next 30 days. The next 30 days never start without it.
