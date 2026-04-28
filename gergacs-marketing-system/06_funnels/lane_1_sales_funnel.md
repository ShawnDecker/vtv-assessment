# Lane 1 · Sales Funnel

```
                            META AD AUDIENCE
                       ┌─────────────────────────┐
                       │  Carolyn (homeowner) /  │
                       │  Eleanor (relocator)    │
                       └────────────┬────────────┘
                                    ↓
                            META AD CREATIVE
                  ┌──────────────────────────────────┐
                  │  Hook (USPAP-safe) + image of    │
                  │  Savannah/coastal/multi-demo     │
                  │  → Coffee & Contracts overlay    │
                  └────────────┬─────────────────────┘
                               ↓
                       Click → ManyChat
                               ↓
                ┌──────────────────────────────┐
                │       MANYCHAT KEYWORD       │
                │  SELL (Carolyn) / MOVE (E.)  │
                │  Captures: name, email,      │
                │  phone, signal, IG handle    │
                └────────────┬─────────────────┘
                             ↓
                        Make Webhook
                             ↓
        ┌────────────────────┴────────────────────┐
        ↓                                         ↓
  BoldTrail Contact                          Notion Pearl
  + tag (`ig-sell` or                        Pipeline row
  `ig-move`) + auto-                         (mirror)
  enroll in matching
  drip campaign
        │                                         │
        ↓                                         ↓
   18 BoldTrail                            Outlook welcome
   drip emails fire                        + Microsoft
   on schedule                             Bookings link
                             │
                             ↓
                ┌──────────────────────────────┐
                │     MICROSOFT BOOKINGS       │
                │  Pre-List Comparable (30m)   │
                │  Buyer Discovery (30m)       │
                │  → Calendar invite to Nikki  │
                └────────────┬─────────────────┘
                             ↓
                       Lead → Active stage
                             ↓
                      Make Scenario 02 fires
                             ↓
                Outlook: "Looking forward + prep"
                             ↓
                    Day-of: Reminder + map
                             ↓
                    Post-call: Recap + decision
                             ↓
                ┌────────────┬─────────────┐
                ↓            ↓             ↓
           Decision Yes  Decision   Decision No
                         Maybe       (dropped)
                ↓            ↓             ↓
        BoldTrail →    BoldTrail →   BoldTrail →
        "Active"       Stay in       "Lost"
        engagement     Active 30d
        signed
                ↓            ↓
        SkySlope      Re-engage
        opens deal    flow (+30d
                      data point)
                ↓
         Under Contract
                ↓
            Closed
                ↓
        Lane 3 enters
        (Post-close
        cadence + review
        + referral
        activation)
```

## Conversion math (target by day 30)

| Stage | Conversion rate | Volume target |
|-------|-----------------|---------------|
| Ad impression → click | 0.8-1.5% | 30,000-60,000 impressions |
| Click → ManyChat capture | 30-50% | 200-400 clicks |
| ManyChat → BoldTrail | 95%+ (automated) | 30-50 captures |
| BoldTrail → Microsoft Bookings booked | 25-40% | 30-50 contacts |
| Bookings booked → Active engagement | 25-35% | 8-15 booked consults |
| Active → Closed (3-6 month tail) | 30-50% | 1-3 closed in 30 days, 3-5 cumulative by 90 days |

## Funnel hygiene rules

- Every Make scenario must log success/failure to Automation Log (Notion)
- Every BoldTrail contact must have `Source` AND `UTM Campaign` populated — no exceptions
- ManyChat must mark `pipeline_synced = true` to prevent double-import on follow-up keywords
- Microsoft Bookings page must always show ≥ 4 available slots in next 7 days (otherwise prospects bounce)
- Outlook welcome must fire within 30 seconds of ManyChat capture (otherwise lead cools)

## When the funnel stalls

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Ad clicks but no captures | ManyChat sequence broken or wrong keyword | Test all 8 keywords end-to-end |
| Captures but no bookings | Welcome email not landing OR Bookings link broken | Check spam folder + verify Bookings page live |
| Bookings but no engagements | Discovery call mismatch (ad promised X, conversation delivered Y) | Review the ManyChat reply, the welcome email, and the prep email — one is mis-calibrated |
| Engagements but no closes | Pricing strategy mismatch OR market timing | Pricing strategy reviewed with comparable bracket; market timing requires patience |
