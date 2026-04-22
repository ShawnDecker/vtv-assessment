# Research workflow

## Phase 1 — get the list

Shawn delivers the chapter member list by any of:
- Paste (Name + Company + Category, 3-column rough is fine)
- Screenshot of the BNI portal member page
- PDF/CSV export if available

`bniswva.com` blocks automated fetch, so I can't pull it myself.

Once received, I create one stub file per member in `members/` populated with:
- Full name
- Company name
- BNI category
- City (if listed)
- Priority tag (defaults to `2-medium` — Shawn overrides)

Stub is a valid markdown file with section headings present but body blank. Lets Shawn see the full list at a glance and reorder priorities before I go deep.

## Phase 2 — one deep dive to align shape

Shawn picks the highest-priority member (or the one most like Chad from the fishing-kayak branch, whichever he wants first). I fill `_template.md` completely for that one person. Shawn reviews for:
- Right tone (direct, no VTV jargon)
- Right data-point emphasis (consumer-cohort vs lead-scoring vs team-assessment)
- Opening line actually sounds like something he'd say
- Depth of public-footprint research (too much / too little)

Shawn's feedback gets baked into `_template.md` before we scale.

## Phase 3 — batch the rest

3–5 members per output. Each gets their own file in `members/`. Order by priority tag.

For each batch:
1. Pull public sources: company site, LinkedIn, Google Business, relevant directories (Realtor.com, AVVO, BBB, state licensing boards).
2. Draft the file.
3. Flag anything that needs Shawn's private context (warm-intro, backstory) to go into `CONTACTS_LOCAL.md` rather than the public file.
4. At the end of each batch, I update the index (below) in the main `README.md`.

## Phase 4 — reconcile after meetings

After Shawn meets with a member, he can append a `## 7. Post-meeting notes` section to their file (or a separate `meetings/<date>-<name>.md` file if preferred). That section captures: what the member actually said, what they cared about, what to follow up on, and whether VTV is a fit.

Post-meeting updates may reveal that a template mismatch happened (e.g. we had them as lead-scoring but they really want team-assessment). Adjust and note in their file.

## Source hierarchy (most reliable → least)

1. **The member's own website** — how they position themselves is what we should reflect back.
2. **LinkedIn company page + owner profile** — tenure, team size, recent posts.
3. **Google Business** — rating, review themes, operating-hours sanity check.
4. **State licensing / industry directory** — verifies category, years licensed (realtors, CPAs, contractors).
5. **Local news / chamber of commerce** — recent expansions, awards, community involvement.
6. **Social media** — only for consumer-cohort businesses where follower count reflects real reach.

Never invent a fact. If a source isn't available, the file says "unknown — needs Shawn to confirm" and flags it for Phase 4.
