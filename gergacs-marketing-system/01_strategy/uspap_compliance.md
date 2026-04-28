# USPAP Compliance for Marketing Copy

**Read before any marketing piece ships.** Every agent in `04_agents/` references this file. Every wording matrix, pitch deck, and email template is checked against these rules.

---

## The core rule

**Appraisers cannot guarantee value.** Period. Marketing copy must never imply that Nikki — in either her Realtor or Certified Residential Appraiser role — can promise a number, predict a sale price, or guarantee what a home is "worth."

USPAP (Uniform Standards of Professional Appraisal Practice) governs appraisal practice. The Ethics Rule prohibits "targeting" a value, accepting assignments tied to a predetermined number, or implying a value outcome before analysis is complete. Marketing copy that uses guarantee language can be cited in a state board complaint regardless of whether the spoken work was compliant.

A separate concern: when a Realtor is also an appraiser, marketing must keep the two roles distinguishable. A CMA is not an appraisal. A pre-list pricing conversation is not an appraisal. An appraisal performed for a lender (her actual appraisal work) is governed by USPAP and its assignment rules.

---

## Phrases that are NOT compliant — never use

| Banned | Why | Replacement |
|--------|-----|-------------|
| "I'll tell you what your home is worth" | Implies guarantee | "I'll show you what the comparables show" |
| "Get your home's true value" | "True value" implies a guaranteed answer | "Get a comparable-driven analysis" |
| "What it's actually worth" | Same | "What the local market is supporting" |
| "Real pre-list valuation" | "Real" implies USPAP appraisal | "Pre-list comparable analysis" |
| "Get the real number" | Same | "Walk through the comparables" |
| "Guaranteed pricing" | Direct violation | (delete) |
| "Defensible price intelligence" | Sounds like guarantee | "Comparable-supported analysis" |
| "I'll get you the highest price" | Implies guarantee + targeting | "I'll position your home in the comparable bracket the market supports" |
| "Your home is worth $X" (in any non-USPAP context) | Direct value statement without appraisal scope | "The current comparable bracket suggests $X-Y" |

---

## Phrases that ARE compliant — use freely

| Phrase | Why it works |
|--------|--------------|
| "21 years of appraising" | Experience, not a value claim |
| "What an appraiser sees" | Observation/skill, not a guarantee |
| "Comparable-driven analysis" | Methodology, not outcome |
| "What the comparables show" | Data-anchored language |
| "Appraiser-trained perspective" | Skill description |
| "An indicated value bracket" | USPAP-correct language |
| "Sales comparison approach" | Methodology |
| "Reconciled value indication" | USPAP-correct |
| "Pre-list comparable analysis" | Methodology, not appraisal claim |
| "What the local market is currently supporting" | Market-anchored |
| "I'll walk you through what affects value here" | Educational, not guarantee |
| "Honest numbers" | OK because it implies honesty, not guarantee |
| "I'll tell you what most agents won't" | OK if the *what* is a methodology insight, not a price promise |
| "21 years of appraising informs how I price" | Skill informing strategy — fine |
| "Comparable bracket" | USPAP-correct |
| "Indicated by recent comparable sales" | USPAP-correct |

---

## Required disclaimers (when appropriate)

When marketing copy explicitly mentions a Pre-List service or a comparable analysis, include a soft disclaimer in body copy or fine print:

> *Pre-list comparable analysis is a strategic pricing review based on recent local sales — it is not a USPAP-compliant appraisal. For lending, estate, divorce, or legal use, an appraisal report is required.*

Variants for shorter formats:
- IG caption: "(not an appraisal — strategic pricing analysis)"
- Email footer: "Pre-list analysis is a pricing review, not a USPAP appraisal"
- Pitch deck: full disclaimer on the relevant slide

Marketing copy promoting her actual appraisal practice (Gergacs Appraisals, LLC) should reference USPAP-compliant scope: "VA / FHA / conventional / estate / divorce — performed under USPAP Standards Rules 1 and 2."

---

## Channel-by-channel applicability

| Channel | Risk level | Rule |
|---------|------------|------|
| IG Reel caption | Medium | No "what it's worth" language. "What the comparables show" is fine. |
| IG carousel | Medium | Soft disclaimer on slide 2 if pricing is the subject |
| Blog post | Low (long form allows nuance) | Full disclaimer in any pre-list pricing post |
| YouTube long-form | Low | Verbal disclaimer at the start of any pricing-themed video |
| YouTube Short | High (out-of-context risk) | Avoid value claims entirely. Process language only. |
| TikTok | High | Same as YT Short. |
| Email to lead | Medium | Soft disclaimer in footer of any pricing-themed email |
| Email to past client | Low | Personal touches typically don't trigger this; check if a value reference comes up |
| LinkedIn | Low | Long-form allows nuance |
| Ad creative | High | Most likely to be screenshot/quoted — strictest application |
| Pitch deck | Low (controlled audience) | Full disclaimer on the relevant slide |
| Listing description (MLS, IG, blog) | Low | Listing copy describes the home, not its value — generally safe |

---

## Special case: Pre-List Valuation service

This service is a known offering across her stack. The risk is in how it's marketed.

### Compliant framing

> "When you're thinking about selling, the right starting point is understanding the comparable sales bracket your home falls into. With 21 years of appraising the Lowcountry, I bring an appraiser-trained perspective to a strategic pricing conversation — not a USPAP appraisal, but the same kind of comparable analysis lenders rely on, applied to your listing strategy."

### NOT compliant framing

> "Get a real appraisal before you list — I'll tell you what your home is worth and how to price it for top dollar."

Both convey the same business value. One is compliant. One is a complaint waiting to happen.

---

## What an agent does when in doubt

Each agent in `04_agents/` (especially `gergacs-voice-keeper` and `gergacs-post-writer`) has been updated to:

1. **Auto-detect** banned phrases and replace before output
2. **Refuse** to ship copy that implies a value guarantee
3. **Suggest** a disclaimer where the channel risk warrants one
4. **Flag** edge cases to Nikki for review

If an agent surfaces an edge case, default to the conservative phrasing. Her brand will not lose sales to "I'll show you the comparables." It could lose her license to "what your home is worth."

---

## Source

- `ValueToVictory/11-Appraiser-Department/uspap/common-violations.md` — full violation patterns
- `ValueToVictory/11-Appraiser-Department/methodology/reconciliation.md` — proper value-language framing
- `ValueToVictory/11-Appraiser-Department/skills/paired-sales-analysis.md` — methodology references

The full USPAP knowledge base is internal to Value to Victory's appraiser department resources and represents Shawn's own VA appraiser practice. It is referenced here as a sanity check on Nikki's GA appraiser practice — language patterns are similar across states; the legal exposure is identical.
