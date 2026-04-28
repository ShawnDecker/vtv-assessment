---
title: "Buyer Tour Packet"
audience: "buyers attending a Saturday/Sunday tour"
purpose: "Auto-populates for each tour. Hand or email to client morning of tour. One-stop reference for the day."
---

# Tour Packet · {{TOUR_DATE}}

> *Luxury without the pretense.*

**For:** {{CLIENT_NAME}}
**Today's tour:** {{TOUR_DATE_AND_TIME}}
**Your guide:** Nikki Gergacs · Realtor & GA Certified Residential Appraiser
**Direct line:** (912) 378-3427 (call/text anytime today)

---

## Tour overview

We'll see {{N_PROPERTIES}} properties today. Total drive time: ~{{TOTAL_DRIVE_MIN}} minutes. Total tour time including walkthroughs: ~{{TOTAL_TIME_HRS}} hours.

**Lunch break (optional):** [Restaurant suggestion + drive time]

**My ask:** Take notes on each property in the space provided. The honest reactions you write *during* the tour outperform any reflection we'd do afterward.

---

## Today's route + properties

### Stop 1 · {{PROPERTY_1_ADDRESS}}

- **Time:** {{TIME_1}}
- **List:** ${{PRICE_1}}
- **Style:** {{STYLE_1}} · {{BEDS_1}} bed · {{BATHS_1}} bath · {{SQFT_1}} sqft
- **Year built:** {{YEAR_1}}
- **Neighborhood notes:** {{NEIGHBORHOOD_NOTE_1}}

**What an appraiser-trained eye notices first:**
{{APPRAISER_OBSERVATION_1}}

**What I want you to notice:**
{{BUYER_PROMPT_1}}
*(e.g., "How does the morning light hit the kitchen? Could you imagine your Tuesday afternoon here?")*

**Your notes:**
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

**Quick rate (1-10):** _______
**One-word reaction:** _______________

---

### Stop 2 · {{PROPERTY_2_ADDRESS}}

- **Time:** {{TIME_2}}
- **List:** ${{PRICE_2}}
- **Style:** {{STYLE_2}} · {{BEDS_2}} bed · {{BATHS_2}} bath · {{SQFT_2}} sqft
- **Year built:** {{YEAR_2}}
- **Neighborhood notes:** {{NEIGHBORHOOD_NOTE_2}}

**What an appraiser-trained eye notices first:**
{{APPRAISER_OBSERVATION_2}}

**What I want you to notice:**
{{BUYER_PROMPT_2}}

**Your notes:**
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

**Quick rate (1-10):** _______
**One-word reaction:** _______________

---

### Stop 3 · {{PROPERTY_3_ADDRESS}}

- **Time:** {{TIME_3}}
- **List:** ${{PRICE_3}}
- **Style:** {{STYLE_3}} · {{BEDS_3}} bed · {{BATHS_3}} bath · {{SQFT_3}} sqft
- **Year built:** {{YEAR_3}}
- **Neighborhood notes:** {{NEIGHBORHOOD_NOTE_3}}

**What an appraiser-trained eye notices first:**
{{APPRAISER_OBSERVATION_3}}

**What I want you to notice:**
{{BUYER_PROMPT_3}}

**Your notes:**
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

**Quick rate (1-10):** _______
**One-word reaction:** _______________

---

*[Repeat for each remaining property. Default 5 properties per tour day.]*

---

## End-of-tour reflection (do before leaving the last property)

**Pick the top 2:** Which two homes are you most likely to actually live in? Don't pick on price — pick on Tuesday-afternoon fit.

1. ________________________________
2. ________________________________

**Pick the bottom 1:** Which one is definitely off the list?

1. ________________________________

**One thing you didn't expect:** _______________________________________

**One thing you'd want to verify before making an offer:** _____________________________________

---

## What happens after today

I'll follow up via email within 24 hours with:

1. Recent comparable sales for your top 2 (so you can see what the bracket looks like)
2. Listing photos and any details you missed
3. Any property-specific concerns I observed during the walkthrough
4. Suggested next step (second showing, conversation with lender, offer prep, or "let's keep looking")

**No pressure on any timing.** The right home will come around. Patient buyers consistently outperform rushed ones.

---

## Today's quick reference

**Lender:** {{LENDER_NAME_PHONE}}
**Inspector you've used / preferred:** {{INSPECTOR}}
**Insurance broker:** {{INSURANCE_CONTACT}}
**Areas covered today:** {{NEIGHBORHOODS_LIST}}
**Hospital nearest each property:** {{HOSPITAL_NOTES}}

---

## Disclaimer

Information shared during this tour is deemed reliable but not guaranteed. Buyer should verify all material facts including square footage, lot dimensions, school districts, flood zones, HOA terms, and condition through professional inspection.

Nikki Gergacs is licensed as a Realtor and Certified Residential Appraiser in Georgia. Comments about value during the tour are personal observations — not USPAP-compliant appraisal opinions. For lending purposes, a separate USPAP appraisal will be required.

---

*Nikki Gergacs · Realtor & GA Certified Residential Appraiser · License CR287636*
*Gergacs Realty under Next Move Real Estate*
*nikki@gergacsrealty.com · (912) 378-3427*

— Your Next Pearl Awaits —

---

## TEMPLATE POPULATION GUIDE

**To prepare a tour packet for a specific tour day:**

1. Fill in `{{TOUR_DATE}}`, `{{CLIENT_NAME}}`, `{{N_PROPERTIES}}`, `{{TOTAL_DRIVE_MIN}}`, `{{TOTAL_TIME_HRS}}`
2. For each property, populate Stop 1-N with: address, time, price, specs, neighborhood, appraiser observation, buyer prompt
3. Use `gergacs-listing-describer` skill to draft the appraiser observations and buyer prompts in Nikki's voice
4. Print 1 copy for client + 1 copy for Nikki's clipboard
5. Email PDF to client morning of tour
6. Bring extra blank notes pages — clients often need more space than expected

**Time to populate per tour:** ~25-30 minutes (Muhammed can prepare the day before).

**Save populated packets:** `client-tours/YYYY-MM-DD-clientname-tour.pdf` for archival.
