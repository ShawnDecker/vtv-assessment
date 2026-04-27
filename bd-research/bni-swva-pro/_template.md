# {{Full Name}} — {{Company Name}}

<!--
  Fill this template from public sources only. Anything private (cell phone,
  direct email, warm-intro notes) belongs in CONTACTS_LOCAL.md, not here.
  Delete this comment when the file is done.
-->

**BNI category:** {{category — e.g. Real Estate, CPA, Insurance, HVAC}}
**Role:** {{Owner / Agent / Partner / Managing Director}}
**Primary location:** {{city, state}}
**Priority:** {{1-high, 2-medium, 3-later}}
**VTV template fit:** {{Consumer-cohort | Lead-scoring | Team-assessment | combo}}

---

## 1. Business snapshot

- **What they do:** 1-2 sentences in plain language.
- **Target customer:** who actually writes the check?
- **Revenue band (estimate):** <$500k | $500k–$2M | $2M–$10M | $10M+ (flag as estimate)
- **Team size (estimate):** solo | 2–5 | 6–20 | 21+
- **Service area:** city / metro / regional / national
- **Years in business:** {{N}}, or flag unknown
- **Notable differentiator:** what shows up in their marketing / reviews as their edge

## 2. Public footprint

- **Website:** {{url}}  — what the homepage promises; any signal of tech stack, CTA, lead form
- **LinkedIn:** {{url}} — follower count, posting cadence, content type
- **Google Business:** {{rating}}/5 from {{N}} reviews — top themes in reviews (positive + negative)
- **Facebook / Instagram:** {{url}} — follower count, post cadence; skip if absent
- **Other:** {{industry directory, YouTube, podcast appearances}}

## 3. Mathematics & locational impact

Quantitative, business-specific. Every number flagged as `estimate` unless sourced. No generic industry stats — grounded in *this specific* business in *this specific* geography. Show the arithmetic so a reader can verify.

### 3.1 TAM / revenue math
- **Service-area TAM:** {{# potential customers / transactions / spend in the footprint}}
  - Source: {{Census, BLS, state licensing DB, county business patterns, industry directory}}
  - Arithmetic shown: {{population × penetration × avg ticket, or transactions × commission rate, etc.}}
- **Their likely annual revenue (estimate):** {{$ band}}
  - Derivation: {{team size × revenue/employee}} OR {{transactions × avg ticket}} OR {{public disclosure if available}}
- **Growth math — what VTV conversion lift is worth to them:**
  - Current conversion (estimate): {{%}} on {{# leads/year}}
  - Lift from 5-pillar pre-meeting scoring (assume +3–5 pts conservative): {{$}} additional annual revenue
  - Show the multiplication explicitly; no hand-waving.

### 3.2 Locational impact
- **Primary service area:** specific counties / cities / radius. Name them.
- **Target-category density in that area:** {{# households, small businesses, or tickets/year for the category}}
- **Competitor density:** # of {{realtors / CPAs / HVAC firms / etc.}} licensed in same footprint. Cite the state/federal source.
- **Their likely market share (estimate):** {{their volume ÷ category volume in the footprint}}
- **Geographic concentration:** are they a 3-zip-code operator or a regional one? Flag any risk from over-concentration.

### 3.3 At least one graph

Pick the shape that fits the business. Mermaid renders natively on GitHub and in Claude Code previews — prefer it over images. Use real numbers; cite the source in a line below the chart. If a real number isn't available, the chart is marked `ILLUSTRATIVE — flag for Shawn to validate`.

```mermaid
xychart-beta
    title "{{what the chart measures — e.g. Service-area demand by ZIP}}"
    x-axis [{{label1}}, {{label2}}, {{label3}}, {{label4}}]
    y-axis "{{metric — e.g. Est. annual transactions}}" 0 --> {{max}}
    bar [{{val1}}, {{val2}}, {{val3}}, {{val4}}]
```

Guidance by business type:
- **Realtor / broker** → bar chart: transactions per ZIP in service area
- **CPA / accountant** → pie: client mix (individual / small-biz / corporate), or bar: revenue by service line
- **Contractor / HVAC / roofing** → line: seasonal job volume by month; flag storm-event spikes
- **Restaurant / retail** → bar: day-of-week covers or hour-of-day foot traffic
- **Financial advisor / insurance** → pie: AUM or book mix, or bar: client retention by tenure bucket
- **Franchise / multi-location** → bar: revenue or labor per location
- **Agency / consultancy** → bar: revenue by account, or line: backlog trend

Second graph is welcome if one chart doesn't tell the full story — but resist piling on for its own sake.

---

## 4. VTV angle

### Which template(s) fit
{{Consumer-cohort | Lead-scoring | Team-assessment}} — one sentence why, grounded in Section 1–3 facts.

### Top 3 VTV data points that would move the needle for them
1. **{{Data point}}** — why it matters to THIS business specifically (not generic). Tie to a number from Section 3 where possible.
2. **{{Data point}}** — …
3. **{{Data point}}** — …

For consumer-cohort businesses, draw from the 100-data-point inventory (assessment sub-scores, pillar totals, engagement signal, relationship data if applicable).
For lead-scoring, emphasize pre-meeting signal: weakest pillar of the prospect, persona classification, engagement score, assessment-completion rate.
For team-assessment, emphasize `leadership_level`, `trust_investment`, `communication_clarity`, `gravitational_center` across the team.

### Why they should care *right now*
What's happening in their business or their category that makes this the moment? (recent hiring, new location, rating drop, seasonality, regulatory change) Cite the source if public.

## 5. Opening line (Shawn uses this in 60-sec intro)

> "{{One sentence — specific to their business, references one concrete fact from Section 1–3, no VTV jargon, hook is clear.}}"

Backup / if first line doesn't land:
> "{{Alternative opening — different angle}}"

## 6. Meeting prep

- **What Shawn brings:** {{sample report, one-pager, assessment link, 10-minute pilot, referral in their category?}}
- **What Shawn asks:** 1–2 questions that surface whether VTV is a fit without pitching.
- **What Shawn does NOT bring up first:** pricing, tiers, the full framework. Those come after they're curious.

## 7. Referral reciprocity

What category in *Shawn's* network could refer business TO this member? (The BNI unwritten rule.) Name 1–2.

---

*Last updated: {{YYYY-MM-DD}} — research done by {{Shawn / Claude session}}*
