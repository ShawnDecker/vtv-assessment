# BNI Southwestern Virginia — Pro Chapter

Business-development research for Shawn's own outreach into the BNI SWVA Pro chapter (`bniswva.com/va-southwestern-pro`). Lives in the repo so it's versioned and searchable; private contact details stay out of git by convention.

## Scope

For each chapter member, produce a one-page market analysis covering:

1. **Business snapshot** — name, category, likely revenue band, service area, owner + role
2. **Public footprint** — website, LinkedIn, Google Business rating/reviews, socials
3. **VTV angle** — which of the three templates fits (see below) and the top 3 VTV data points that would matter to them
4. **Opening line** — one sentence Shawn could say in a 60-second intro that isn't generic

## The three VTV templates by business type

Most BNI members are B2B service providers — the "Chad's fishing kayak" consumer-cohort template from the kayak branch doesn't fit them directly. Use the right template per member:

| Template | When it fits | VTV pitch in one line |
|---|---|---|
| **Consumer cohort** (Chad template) | Consumer-facing brand owner (restaurant, gym, retailer, outfitter) | "Psychographic cohort data on buyers similar to your customers — 100+ data points you can't get from Meta or GA." |
| **Lead scoring** | B2B service provider (realtor, accountant, lawyer, CPA, financial advisor, contractor, insurance) | "5-pillar signal on every lead — know which prospects convert, which don't, before the first meeting." |
| **Team assessment** | Business owner with 5+ employees (franchise, agency, clinic, crew) | "Team-level 5-pillar scan — leadership, trust, and communication gaps made visible in an hour." |

A member may fit two templates. Note both.

## Folder layout

```
bd-research/bni-swva-pro/
├── README.md                       # this file
├── _template.md                    # per-member analysis template
├── _workflow.md                    # how to run the research, Phase 1 vs Phase 2
├── members/                        # one file per member (public-safe content)
│   └── <lastname-firstname>.md
└── CONTACTS_LOCAL.md               # phone / direct-email / private notes (gitignored)
```

## Workflow

1. Shawn delivers the chapter member list (paste, screenshot, or export).
2. I create one stub file per member under `members/` with name, company, category populated.
3. **Phase 1:** pick one member (Shawn's highest-priority close) and fill the full template so Shawn can review the shape before I scale.
4. **Phase 2:** batch the rest in 3–5 member groups so no single output is overwhelming.
5. Private contacts (phone, direct email, anything that shouldn't go to github) go in `CONTACTS_LOCAL.md` — which is gitignored. Public-facing files under `members/` reference it by key.

## Privacy convention

- `members/<name>.md` files may contain: business name, category, public website, public LinkedIn, publicly-listed office number, Google-Business-visible reviews, and anything visible without login.
- `CONTACTS_LOCAL.md` (gitignored) contains: personal cell, direct email, notes Shawn has shared privately, warm-intro context, preferred meeting style.
- Any `*.local.md` file is also gitignored as a safety net.

## Tear-down

```bash
rm -rf bd-research/bni-swva-pro/
```

Nothing in this folder touches the VTV platform code. Safe to delete at any time without affecting assessment, coaching, or any other production behavior.
