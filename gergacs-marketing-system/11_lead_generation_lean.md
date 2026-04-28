# Lead Generation Without an Ad Budget

You explicitly told me: no $20K-a-month Google Ads play, no Vulcan7 lists that flopped, no paying for leads at scale. Strategy has to be SEO-based, ranking-based, organic-led, leveraging what you already pay for.

This document is the lean lead-generation playbook built around your actual constraints.

---

## What you already have (and aren't fully using)

| Asset | Status | What it can produce |
|-------|--------|---------------------|
| **PropStream** (paid monthly) | Active | Targeted seller lists, absentee owners, distressed properties, equity targets, probate, divorce |
| **Yoast SEO Premium** (paid) | Active | On-page optimization, schema, internal linking suggestions, redirects |
| **BoldTrail / KVCore** (paid) | Active, 18 drips built | Lead nurture, drip automation, behavior tracking on contacts |
| **WordPress + Yoast + iHomefinder** | Active | Long-form SEO, IDX search, blog → ranking |
| **Google Search Console** | Should be active (verify with Site Kit) | What's already searching for you, what almost-ranks |
| **Google Business Profile** (need to claim) | NOT YET CLAIMED — emergency fix from audit | Local search, reviews, posts as backlinks |
| **Hotjar / Microsoft Clarity** (FREE) | Not installed | Heatmaps, recordings, behavior monitoring on site visitors |
| **YouTube channel** | Active | YouTube SEO, embedded video on blog |
| **Notion + Trello** | Active | Track leads, follow-ups, sources |
| **Make.com** | Partially built | Wire all of this together without paid integrations |
| **ManyChat** | Partially built (broken IG handle) | IG keyword capture once handle restored |

You're already paying for the engine. The lean strategy is making it work harder, not buying a different one.

---

## Tier 1 · Lead sources you can run THIS WEEK (free or already paid)

### A. PropStream filtered lists (paid · already yours)

Specific filter combinations that produce real-name lead lists:

#### Filter 1: Absentee Owners with Equity (potential tired landlords)
- Property type: SFR
- Owner-occupied: NO (out-of-state)
- Tenure: 5+ years
- Equity: 50%+
- Geography: Chatham, Bryan, Effingham counties
**Output:** ~200-500 names per pass. These are owners who don't live in their property and have meaningful equity. Some are tired landlords. Some are inherited owners. Some are ready to sell.
**Cadence:** Run weekly. Filter for additions only.
**Touch:** Direct mail or skip-trace email/phone.

#### Filter 2: Long-tenured High-Equity Owners (potential downsizers)
- Property type: SFR, larger square footage (3,000+ sqft)
- Owner-occupied: YES
- Tenure: 15+ years
- Equity: 70%+
- Owner age (where available): 60+
- Geography: Ardsley Park, Skidaway, Habersham, Pooler, Richmond Hill
**Output:** Right-sizer prospects. They have equity, length-of-stay (likely emotional readiness), and demographic fit.
**Cadence:** Quarterly refresh (changes slowly).
**Touch:** Personal letter + phone. Reference Bill & Sandra persona content.

#### Filter 3: Pre-Foreclosure / NOD
- Status: Notice of Default
- Geography: Chatham primary
**Output:** Distressed sellers. Sensitive territory — not all become listings, and approach matters.
**Cadence:** Weekly.
**Touch:** Discrete, helpful, no pressure. Often these need a buyer, not a listing.

#### Filter 4: Probate
- Status: Probate filed
- Property: SFR
**Output:** Inheritance / estate transition leads. Particularly relevant given your appraiser credential — you can offer estate appraisal AND listing service.
**Cadence:** Weekly (aligns with court filings).
**Touch:** Sensitive personal letter. Lead with appraisal, not listing.

#### Filter 5: Recent Divorce Filings
- Status: Divorce-related transfer pending
**Output:** Court-ordered or divorce-driven sales. Your dual credential matters here — you can do the divorce appraisal AND list.
**Cadence:** Monthly.
**Touch:** Coordinate with divorce attorneys you build relationships with.

### B. Public records mining (FREE)

Chatham County (and Bryan, Effingham) public records are searchable online for free:

- **Probate filings** — `chathamcounty.org` court records → potential estate sales
- **Tax delinquencies** — county tax commissioner sites → distressed owners
- **Code violations** — city of Savannah → tired or absentee owners
- **Building permits** — recent permits often signal pre-list prep

Tool: a simple weekly scrape (or n8n workflow) that pulls new filings, drops names into a Trello board for Muhammed to research.

### C. LinkedIn job-change signals (FREE for basic, paid for Sales Nav)

People relocating to Savannah for jobs are a high-quality buyer pool:

- **Gulfstream Aerospace** — major employer, frequent senior-level hires
- **Memorial Health / St. Joseph's-Candler** — physician relocations
- **Hunter Army Airfield / Fort Stewart** — military PCSes
- **JCB North America** (in Pooler) — corporate relocations
- **Mitsubishi Power Americas** — engineering relocations
- **The Home Depot / Lowe's distribution** — corporate roles
- **City of Savannah leadership** — public sector relocations

Tactic: LinkedIn Sales Navigator (~$80/mo) lets you save searches like "moved to Savannah, GA in last 90 days, level: director or above." For free LinkedIn, search manually and use connection requests with personal notes. Comment on relocation announcements within 24 hours — be the first warm voice.

### D. Google Alerts (FREE)

Set up alerts for:
- "moving to Savannah"
- "relocating to Savannah"
- "Savannah real estate" (filtered)
- Specific competitor agent names (know what they're getting press for)
- "Tybee Island short-term rental" (regulatory news = reactive content)

Most alerts produce weak signal. The ones that work give you a content reaction window.

### E. Reddit / community presence (FREE)

- **r/Savannah** — active subreddit. Helpful answers to relocation questions earn long-term goodwill.
- **r/realestate** + **r/firsttimehomebuyer** — answer one Savannah-specific question per week with substance.
- **r/MilitaryFamilies** — for Hunter AAF / Fort Stewart relocator outreach.

Rule: never sell. Be helpful. Username appears next to a great answer = long-term local-expert positioning.

### F. Local Facebook Groups (FREE)

- "Savannah Buy / Sell" type groups
- Neighborhood-specific groups (Ardsley Park residents, Skidaway, Tybee, Pooler)
- Coastal Empire moms / parents groups
- Military spouse groups
- Local business networking groups

Rule of thumb: 80% helpful contribution, 20% (or less) self-reference. Groups ban heavy promoters fast. The agents who win on Facebook are the ones who show up consistently and don't sell.

### G. Nextdoor (FREE)

Hyper-local. Position yourself as the local appraiser-realtor who answers neighborhood market questions. Verified-business profile. Comment helpfully on neighborhood threads about home values, listings, neighborhood character.

---

## Tier 2 · Inbound signal capture (FREE setup)

### Microsoft Clarity (FREE — fully featured, no payment tier)

Install on `savannahhomesandlifestylewithnik.com`. Captures:

- Session recordings (watch real visitors browse)
- Heatmaps (where they click, scroll, hover)
- Frustration signals (rage clicks, dead clicks)
- Insights (which pages convert visitors into bookings)

Within 2 weeks of installation, you'll know:
- Which blog posts visitors actually read vs bounce
- Where on the page they stop scrolling
- Whether the Microsoft Bookings CTA is being seen
- What they're trying to click that doesn't work

Free forever. Zero performance impact. Cookie-compliant. Install via Site Kit or Yoast integration.

### Hotjar (FREE tier)

Similar product, free tier. Most agents use Clarity OR Hotjar — pick one.

### Google Search Console (FREE — should already be installed)

Once a week, check:
- Top 10 search terms bringing people to your site
- Which terms you rank in positions 11-20 (one effort push moves them to first page)
- Which pages get clicks but low ranking (optimization candidates)
- Which terms generate impressions but no clicks (meta description rewrite candidates)

This single 30-minute weekly habit is the difference between SEO-as-prayer and SEO-as-strategy.

### Google Analytics 4 (FREE — should already be installed via Site Kit)

Goal: track which content drives Microsoft Bookings clicks and form submissions. Set up Conversions for:
- Microsoft Bookings link clicks
- Contact form submissions
- Newsletter signups
- Phone number clicks (event tracking)

---

## Tier 3 · Outbound that actually works (low cost, high effort)

### A. The "5 a Week" personal email cadence (FREE)

This is in Lane 3 of the original campaign. Five personal emails per week to past clients or warm contacts. Not a drip — a real email that references something specific. Over a year, 260 personal touches build a referral engine no paid lead source can match.

### B. The hand-written note (LOW COST)

Send 2-3 handwritten notes per week to past clients, ICBT (in-the-clouds-but-targeted) prospects, and people you want to know better. Cost: stamps + cards. Return: meaningful in a digital-everything world.

### C. The phone-call campaign (FREE)

For the PropStream lists above, the conversion isn't email. It's the call.

- 20 calls a week from a clean PropStream list
- 5 contact rate (typical)
- 2 actual conversations
- 1 productive (asks for follow-up, says "interesting timing")
- ~ 1 listing conversation per quarter from this rhythm

20 calls × 50 weeks = 1,000 calls a year. At a 1-in-100 listing-conversion rate that's 10 listings purely from cold-list calling. Multiply by your average commission and that's a six-figure floor without a single ad dollar.

### D. The "I'd love your honest take" referral ask (FREE)

To past clients, twice a year, send: "I'm hoping to focus this year on helping people who'd actually appreciate the way I work. If anyone in your circle is thinking about Savannah real estate — buying, selling, even just curious — I'd love an introduction."

Most people want to refer the right realtor. Most realtors never ask. The ask is what unlocks the referral.

### E. Vendor and adjacent-professional partnerships (FREE)

Build coffee relationships with:
- Mortgage lenders (especially VA / FHA specialists for military)
- Estate planning attorneys (for probate / estate appraisal cross-referrals)
- Divorce attorneys (for divorce appraisal cross-referrals)
- Home stagers
- Home inspectors
- Insurance agents (especially flood specialists)
- Builders (Pooler new construction)
- Interior designers and architects

One coffee per week. Over a year, you've built 50 reciprocal-referral relationships. Many of these will produce more leads than any paid source.

---

## Tier 4 · Paid-but-cheap (when budget allows)

When you have $200-500 a month available:

### A. Yoast SEO Premium (you have this) - keep
The internal-linking suggestions alone justify the subscription.

### B. LinkedIn Sales Navigator (~$80/mo)
Job-change tracking + saved searches. Higher signal than ads.

### C. Targeted LinkedIn Sponsored Content ($100-300/mo)
NOT to compete with Google Ads at scale. Use to amplify ONE high-performing piece of content (a blog post about military relocation, for example) to a tightly defined audience. Boost performance, not awareness.

### D. Facebook Boosted Post (one specific high-engagement organic post, $30-100)
Boosting a post that's already pulling beats running a new ad from scratch.

---

## What kills lean lead-gen

- ❌ Spreading 1 hour across 20 sources daily — pick 3, do them well
- ❌ Buying lists from "expired listing" services like Vulcan7 — generally low-yield, especially in tight markets
- ❌ Cold-calling without a context (PropStream filter or referral basis gives you context)
- ❌ DM blasting on Instagram (looks spammy, likely ban)
- ❌ Replying to FB Marketplace home sellers as a Realtor (rules-of-the-platform issue)
- ❌ Spending an afternoon on Canva graphics that nobody saves
- ❌ Buying Zillow Premier Agent without first dominating organic Zillow (free profile, reviews, badges)

---

## The 90-day lean lead-gen sequence

| Week | Action |
|------|--------|
| 1 | Install Microsoft Clarity. Claim both GBPs. Resolve broken IG handle. Set up Google Alerts. |
| 2 | Run 5 PropStream filtered queries. Clean leads, drop in BoldTrail. |
| 3 | Personal touches: 5 past clients, 2 handwritten notes. Start LinkedIn job-change monitoring (free). |
| 4 | First blog publish (#04 Pre-Listing Comparable Analysis). Submit for indexing. |
| 5-12 | Publish one blog per week. Continue 5 personal touches per week. Make 20 calls per week from PropStream lists. |
| 13 | First 90-day review. Which sources produced actual conversations? Double down. |

By month 4, expect: 5-10 new contacts per week from inbound (blogs + Search Console traffic), 3-8 from direct PropStream + calls, 1-3 from Lane 3 referrals, 0-2 from social organic. Total: 9-23 new contacts per week, all without paid ads.

That's the lean strategy. It compounds.

---

## What I'd do first this week

1. Install Microsoft Clarity (10 minutes)
2. Claim Google Business Profiles (1 hour each, both Realty + Appraisals)
3. Run PropStream Filter 2 (long-tenured high-equity owners) for Ardsley Park + Skidaway. Pull names. Drop into BoldTrail. Plan to call 5/day for the next 4 weeks.
4. Publish the first blog (#04 Pre-Listing Comparable Analysis) using `10_blog_posts/04_pre_listing_comparable_analysis.md`. Submit for indexing in Search Console.
5. Send 5 personal-touch emails to past clients before Friday.

That's the lean lead-gen playbook in one week of work. No ad spend. No subscriptions added. Compound from there.
