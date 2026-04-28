# SEO Audit — Gergacs Realty / Lifestyle / Appraisals

Three sites audited. One is a parking page. The other two have specific, fixable issues.

---

## Site 1 · gergacsrealty.com

### Title + meta (current vs recommended)

**Current home title:** `Gergacs Realty`
**Current meta:** `Rincon GA Real Estate & Homes for Sale | Next Move Real Estate` *(template default — wrong primary city)*

**Recommended home title:** `Savannah Luxury Homes & Coastal Real Estate | Gergacs Realty — Nikki Gergacs`
**Recommended meta:** `Nikki Gergacs, Realtor & GA Certified Appraiser. Luxury without the pretense in Savannah, Tybee, Pooler & Richmond Hill. Your next pearl awaits.` *(157 chars)*

### Critical structural issues

- **Six H1 tags on the home page.** Should be one. Demote five to H2.
- Generic H2s ("Featured Areas", "Discover Luxury Listings"). Replace with neighborhood-specific.
- Only `LocalBusiness` schema — no `RealEstateAgent`, no `Person` for Nikki, no `aggregateRating`.
- Most images have empty or generic alt text (`alt=""`, `"Company Logo"`, `"picture of person on laptop"`).
- 532 KB home HTML. Render-blocking AOS + multiple animation libs. Estimated LCP 3.5–4.5s on 4G.

### 5 quick wins

1. Fix multi-H1 problem (demote 5 of 6 to H2)
2. Replace title + meta (above)
3. Add `RealEstateAgent` + `Person` schema with `areaServed`, `knowsAbout`, `sameAs`
4. Alt text every image (`Ardsley Park luxury home — Gergacs Realty`)
5. Build 5 neighborhood landing pages: `/savannah-neighborhoods/ardsley-park`, `/skidaway-island`, `/the-landings`, `/tybee-island`, `/pooler`

---

## Site 2 · savannahhomesandlifestylewithnik.com

### Title + meta (current vs recommended)

**Current home title:** `Savannah Homes and Lifestyle with Nik - Southern charm, coastal elegance—let's find your pearl.`
**Current meta:** `Southern charm, coastal elegance—let's find your pearl.`

**Recommended home title:** `Savannah Homes & Lifestyle with Nik | Luxury Without the Pretense — Nikki Gergacs`
**Recommended meta:** `Savannah luxury, Tybee coastal, Pooler & Richmond Hill homes — plus lifestyle, neighborhoods, and appraisal insights from Realtor & GA Certified Appraiser Nikki Gergacs.`

### Critical structural issues

- **`/about/` page returns 404. `/contact/` page returns 404.** No human attached to the site.
- Every blog post is filed under `Uncategorized` — taxonomic SEO disaster.
- WordPress 6.9.4, GoDaddy "Go" theme, Site Kit by Google active (good).
- Schema is solid: `WebSite`, `CollectionPage`, `BreadcrumbList`, `Person` for Nikki with `sameAs` linking socials.
- Featured image alt text essentially absent.
- **No blog post title mentions Savannah by name.** Posts are generic real-estate-news content.

### 5 quick wins

1. Build `/about/` and `/contact/` pages — emergency
2. Replace `Uncategorized` with: `Buying`, `Selling`, `Neighborhoods`, `Appraisal`, `Market Updates`, `Lifestyle`
3. Add featured-image alt text to all 10+ existing posts
4. Add `RealEstateAgent` schema layer (currently only Person + WebSite)
5. Cross-link every blog post to a CTA on gergacsrealty.com — currently a content silo

---

## Site 3 · gergacsappraisals.com

**Status:** GoDaddy parking page serving competitor PPC ads.

The domain redirects to `/lander` which loads `caf.js` (AdSense parking). Zero content. Zero schema. Negative SEO value.

**This is the most urgent fix in the entire audit.** Every appraisal-related lead going to this URL right now sees a parking page with competitor ads.

### Recommended action

Ship a 5-page MVP appraisal site this quarter:

1. `/` — services overview ("The same eye that values homes for lenders, valuing yours")
2. `/about` — Stephanie N. Gergacs (license #CR287636), 21+ years
3. `/services/pre-listing-appraisal`
4. `/services/divorce-estate-appraisal`
5. `/services/fha-va-appraisal`

Plus `/contact`. WordPress, static HTML, or even a single-page anchor-linked layout — all fine. Brand match with gergacsrealty.com is non-negotiable.

---

## Local SEO · NAP / GBP / Citations

| Signal | Status |
|--------|--------|
| Gergacs Realty Google Business Profile | **Not found in search.** Likely unclaimed or empty. Highest-priority fix. |
| Gergacs Appraisals LLC GBP | Not found. License confirmed: Stephanie N. Gergacs, GACR287636, PO Box 18396 Savannah GA 31418. |
| Phone consistency | **Fragmented.** 912-378-3427 (her primary), 912-660-1060 (appraisal listings), 912-295-5807 (brokerage), 912-335-7480 (appraisal direct). |
| Address consistency | Only PO Box on file. No street address surfaces on any site. |
| Zillow / Realtor.com agent profile | Not located. Either missing or low signal. |
| Brokerage affiliation | Next Move Real Estate (confirmed). |

### Local-SEO action plan

1. Claim/build 2 GBPs (Realty + Appraisal)
2. Unify on one phone (recommend 912-378-3427 per her own master doc as primary)
3. Publish single canonical address (or PO Box if street not desired) in footer of all 3 sites
4. Build Zillow + Realtor.com agent profiles
5. Seed each GBP with 10+ reviews from past clients (Lane 3 of the campaign)

---

## Top 15 content gaps (publish in next 90 days)

Ranked by **Effort (E) vs Lead-conversion potential (L)**, both 1–5. Priority = L − E. Higher is better.

| # | Title | Target persona | E | L | Pri | Site |
|---|-------|----------------|---|---|-----|------|
| 1 | "The Landings on Skidaway Island: A Realtor + Appraiser's Honest Guide" | Marcus / Eleanor | 2 | 5 | +3 | Realty + Lifestyle |
| 2 | "Pre-Listing Appraisal in Savannah: Why I Recommend One Before You Price" | Carolyn | 1 | 5 | +4 | Lifestyle + Appraisal |
| 3 | "Ardsley Park Historic Homes: What Buyers Should Know About Valuation" | Marcus | 2 | 5 | +3 | Lifestyle |
| 4 | "Tybee Island Beachfront: Flood Zones, Insurance, and What Affects Resale" | Eleanor / Marcus | 3 | 5 | +2 | Lifestyle |
| 5 | "Hunter Army Airfield PCS Guide: Best Neighborhoods for Military Families" | Eleanor (military) | 2 | 4 | +2 | Lifestyle |
| 6 | "VA Appraisal in Chatham County: A Certified Appraiser Walks You Through It" | Eleanor (military) | 2 | 4 | +2 | Appraisal |
| 7 | "Downsizing in Savannah: From Big Home to Habersham/Pooler Patio Home" | Bill & Sandra | 2 | 4 | +2 | Lifestyle |
| 8 | "Richmond Hill vs. Pooler: Which Suburb Fits Your Lifestyle?" | Eleanor / Bill & Sandra | 2 | 4 | +2 | Lifestyle |
| 9 | "Divorce Appraisal in Georgia: Equitable Distribution & What Attorneys Need" | Carolyn (subset) | 2 | 4 | +2 | Appraisal |
| 10 | "Estate & Date-of-Death Appraisals in Chatham County" | Carolyn (subset) | 2 | 4 | +2 | Appraisal |
| 11 | "Skidaway Island Lifestyle: Marshfront, Marina, and Market Snapshot" | Marcus | 3 | 4 | +1 | Lifestyle |
| 12 | "First-Time Buyer in Savannah: From Pre-Approval to Pearl" | (new persona) | 2 | 3 | +1 | Lifestyle |
| 13 | "Luxury Without the Pretense: 5 Savannah Homes Under $1.5M Worth Your Time" | Marcus | 3 | 4 | +1 | Realty |
| 14 | "Pooler New Construction: What an Appraiser Looks for in a Brand-New Home" | Eleanor / Bill & Sandra | 2 | 4 | +2 | Lifestyle + Appraisal |
| 15 | "Habersham (Beaufort SC overflow): Why Savannah Buyers Are Looking North" | Marcus / Bill & Sandra | 3 | 3 | 0 | Lifestyle |

---

## Top 10 quick wins (combined, priority-ordered)

1. **Build gergacsappraisals.com** — currently a parking page serving rival ads
2. **Claim/optimize two Google Business Profiles** (Realty + Appraisal)
3. **Rewrite gergacsrealty.com home title + meta** — current meta says "Rincon GA" (wrong primary city)
4. **Fix multi-H1 problem on gergacsrealty.com** — demote 5 of 6 H1s to H2
5. **Build /about/ and /contact/ pages on lifestyle site** — both currently 404
6. **Replace `Uncategorized` taxonomy** with: Buying, Selling, Neighborhoods, Appraisal, Market Updates, Lifestyle
7. **Publish 5 neighborhood landing pages** on gergacsrealty.com (Ardsley Park, Skidaway, Landings, Tybee, Pooler)
8. **Unify NAP** — single phone, single address, identical footer block on all 3 sites
9. **Add `RealEstateAgent` + `Person` schema with `aggregateRating`** to gergacsrealty.com
10. **Fix image alt text site-wide** — currently `alt=""` or generic logos. Use neighborhood + property-type keywords

---

*Source: SEO audit run 2026-04-28 via curl + browser UA, view-source, structured-data parse, and Perplexity research.*
