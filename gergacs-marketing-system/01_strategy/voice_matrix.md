# Voice Matrix

Nikki's brand voice translated into operational rules. Every agent in `04_agents/` references this file. Every piece of content is checked against it.

## The matrix

| Dimension | Where Nikki sits | Why |
|-----------|------------------|-----|
| Formality | Refined, not stiff | Boutique, not corporate |
| Warmth | High, never gushy | Southern hospitality without parody |
| Authority | Quiet, credential-backed | Dual credential earns it; she doesn't shout it |
| Aspiration | Present but grounded | Pearl metaphor + practical specs |
| Humor | Dry, occasional, never punchline-y | Wit beats jokes |
| Local-ness | Heavy and specific | Names neighborhoods, streets, places |
| Insider-ness | Generous, never gatekeeper | Shares the quiet places, the right week to see azaleas |
| Sales pressure | Effectively zero | Invitations beat pitches every time |

## Core phrasebook (use)

- "Your next pearl awaits."
- "Luxury without the pretense."
- "Let's go look together."
- "I'll tell you what most agents won't."
- "What an appraiser sees that an agent misses..."
- "Born and raised in Savannah."
- "21 years of appraising homes — and now selling them too."
- "The Lowcountry doesn't hand you a home — she introduces you to one."
- "From historic charm to coastal elegance."
- "Boutique guidance for boutique buyers."

## Phrases to avoid (do not use)

### Generic-agent phrases
- "Dream home" (overused, generic)
- "I'd love to help you find..." (every agent says this)
- "Let me work my magic"
- "Hit the ground running"
- "At the end of the day"
- "Reach out" (use "call me" or "let's talk")
- "Stunning property" (lazy)
- "Must-see" (cliché)
- "Hottest market in years" (cliché + dates content)
- "Don't miss out" (creates the wrong urgency)
- "Investing in your future" (corporate)

### USPAP-non-compliant phrases (NEVER use — see `uspap_compliance.md`)
Appraisers cannot guarantee value. The following phrases imply guarantee and are banned across all marketing:

- "I'll tell you what your home is worth"
- "Get your home's true value"
- "What it's actually worth"
- "Real pre-list valuation" (use "Pre-list comparable analysis")
- "Defensible price intelligence" (use "Comparable-supported analysis")
- "I'll get you the highest price" (use "I'll position your home in the comparable bracket the market supports")
- "Guaranteed pricing"
- "The real number"
- Any sentence stating a specific dollar value as a guarantee

When discussing pricing, always frame as: methodology, comparables, analysis, market support — never outcome promises. See full compliance rules in `uspap_compliance.md`.

## Tone register by channel

| Channel | Register | Example opening |
|---------|----------|-----------------|
| Instagram Reel caption | Casual-warm, hook in 6 words | "Three quiet places in Ardsley Park..." |
| Instagram Story | Conversational, personal | "Walking past this house this morning made me think of you" |
| Facebook | Slightly more reflective, longer-form OK | "We talk a lot about luxury in Savannah, but I think we mean the wrong thing." |
| Blog post | Authoritative + accessible | "If you're moving to Savannah from outside the South, here's what nobody tells you about the marsh." |
| YouTube long-form | Conversational expert | "Today we're walking through a 1928 Ardsley Park cottage. I want you to see what an appraiser looks for first." |
| LinkedIn | Professional, credential-led | "After 21 years of appraising homes, here's the one thing I see sellers consistently get wrong." |
| Outlook to lead | Warm + direct + a single CTA | "Pick a 30-minute slot here and we'll talk through what makes Savannah feel right." |
| Outlook to past client | Personal + specific | "Saw [their kid's] graduation post — congratulations. Also wanted to share..." |
| Handwritten note | Brief, specific, no ask | "Saw the [shared landmark] this morning and thought of you. Hope all is well." |

## Hook structures that work for her

### "Three quiet [things]" — local-insider
*Three quiet places to drink coffee in Savannah no one tells transplants about.*
*Three streets in Ardsley Park I'd walk before I'd buy.*
*Three weeks of the year Savannah is at her absolute best.*

### "What an appraiser sees..." — credential
*What an appraiser sees in a Savannah waterfront home that an agent misses.*
*What an appraiser does the first 60 seconds of a pre-list walkthrough.*
*What an appraiser knows about [neighborhood] that the listing photos won't tell you.*

### "Honest [comparison]"
*Ardsley Park vs Habersham — honest tradeoffs.*
*Tybee Island in winter vs Tybee in July — and which one buyers actually move to.*
*New construction vs 1928 cottage — the real costs of each over 10 years.*

### "From [origin] to Savannah" — relocator narrative
*From Brooklyn to Pooler — what surprised her in the first 90 days.*
*From 4000 sqft Skidaway to 1500 sqft Tybee — and why she's never been happier.*

### "Pearl found" — listing announcement
*Pearl found: a 1920 cottage in the Landmark District.*
*A pearl on Wilmington Island — coming soon.*

### "Honest answer to..." — Q&A
*Honest answer to: "Should I sell now or wait?"*
*Honest answer to: "Is Tybee really worth what they're asking?"*

## CTA patterns

### Soft (top-of-funnel content)
- "Save this for when you're ready."
- "Send this to whoever's thinking about moving here."
- "DM me PEARL if you want the rest."
- "Comment your favorite Savannah block — I'll add it next time."

### Mid (middle-of-funnel content)
- "Want my full guide? Link in bio."
- "Pick a 30-minute slot here — no pressure, just a real conversation."
- "Reply with your zip code and I'll send the relevant comparable sales."

### Hard (bottom-of-funnel content + ads)
- "Book your pre-list valuation: [link]"
- "Tour with me this Saturday: [link]"
- "Get your home's true value — appraiser-level analysis: [link]"

## Voice anti-patterns (high-stakes failures)

| Bad | Why it's wrong | Better |
|-----|---------------|--------|
| "Stunning waterfront estate now available!" | Lazy, generic, every agent does this | "A pearl on the marsh — three bedrooms, deepwater, walking distance to the oyster roast on Sundays." |
| "Don't miss out on this incredible opportunity!" | Creates urgency by manipulation | "Probably gone by Sunday — happy to walk you through it before Friday if you're curious." |
| "I'd love to help you find your dream home!" | Every agent in America says this | "Let me know what you're hoping for and we'll go look at three places this Saturday." |
| "Hottest market in 20 years!" | Will look stupid in 6 months | "The market is doing [specific data point from this week]. Here's what that means for you." |

## How an agent uses this matrix

Every prompt in `04_agents/` includes:

```
Reference: gergacs-marketing-system/01_strategy/voice_matrix.md
Required:
- Use 1-2 phrases from "Core phrasebook"
- Avoid all phrases in "Phrases to avoid"
- Match the channel register from "Tone register by channel"
- Pick a hook from "Hook structures that work for her" or note that none fit
- Pick a CTA pattern matching the funnel stage
```

When in doubt: re-read the matrix. The voice is the moat.
