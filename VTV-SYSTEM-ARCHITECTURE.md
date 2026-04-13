# Value to Victory — System Architecture

## Overview

The Value to Victory (VTV) platform is a comprehensive personal development and coaching ecosystem built around the proprietary 5-pillar assessment framework: **Time, People, Influence, Numbers, Knowledge**.

---

## Platform Components

### 1. Assessment Engine
- **URL:** https://assessment.valuetovictory.com
- **Stack:** Vanilla HTML/JS + Vercel Serverless (Node.js)
- **Database:** Neon PostgreSQL
- **Modes:** Individual, Relationship, Leadership, Dating
- **Depths:** Quick (25 questions), Extensive (50 questions), Pillar Deep-Dive (10 questions)

### 2. Member Portal
- **URL:** https://assessment.valuetovictory.com/member
- **Auth:** Email + 4-6 digit PIN, JWT sessions (7-day expiry)
- **Tiers:** Free, Individual ($29/mo), Couple ($47/mo), Premium ($497/mo)
- **Features by tier:**
  - Free: Assessment, coaching requests, audiobook, referrals
  - Individual (VictoryPath): Challenges, team reports, action plans
  - Couple (Value Builder): Relationship hub, love language, couple tools, 21+ intimacy
  - Premium (Victory VIP): All features, priority coaching

### 3. Relationship Hub
- **URL:** https://assessment.valuetovictory.com/relationship-hub
- **Tools:**
  - Relationship Contribution Matrix (give/receive across 5 domains)
  - Cherish & Honor Matrix (love vs respect dimensions)
  - P.I.N.K.'s Love Language Assessment
  - 30/90-Day Couple Challenge
  - 21+ Intimacy Assessment (age-gated, partner required)
  - Couple Report (side-by-side comparison)

### 4. Coaching System
- **Automated Emails:** 8-day personalized coaching sequence
- **Cron Schedule:** Daily at 5:47 AM EST (coaching), 7:47 PM EST (accountability)
- **Adaptive:** Persona classification (fast_mover, standard, disengaged, high_performer)
- **Tracking:** Open/click tracking pixels, engagement scoring

### 5. Agent System
- **Systems Agent:** Health monitoring across Neon, n8n, VPS, Stripe, Gmail
- **Email Agent:** Adaptive coaching with weighted rules
- **Website Agent:** Page analytics and conversion tracking
- **Coordinator:** Cross-agent rule adjustment
- **Dashboard:** https://assessment.valuetovictory.com/agent-dashboard

---

## Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Hosting | Vercel Pro | Serverless functions, static pages |
| Database | Neon PostgreSQL | All application data |
| Automation | n8n (Hostinger VPS) | Workflow orchestration |
| Payments | Stripe | Subscriptions, one-time purchases |
| Email | Gmail SMTP | Coaching, notifications |
| CRM | HubSpot | Contact sync |
| Scheduling | Calendly | Coaching sessions |
| Domains | GoDaddy | DNS management |
| Analytics | Google Analytics | G-TT6PYLPP31 |

---

## Database Tables (39+)

### Core
- `contacts` — All users (email, name, PIN hash)
- `assessments` — Assessment results (50 question scores, 5 pillar totals, master score)
- `answer_history` — Individual question responses
- `question_bank` — Dynamic question pool with overlay support

### Membership
- `user_profiles` — Tier, Stripe IDs, DOB, gender, partner link, preferences
- `coaching_sequences` — Email sequence state per user
- `coaching_requests` — Detailed coaching intake forms

### Relationships
- `couples` — Partner pairings
- `partner_invites` — Pending partner invitations
- `relationship_matrix` — Give/receive domain scores
- `cherish_honor_matrix` — Love vs respect dimensions
- `love_language_results` — 5 love languages (give/receive)
- `intimacy_results` — 5 intimacy dimensions (21+)
- `couple_challenge_responses` — Daily challenge responses
- `challenges` — Active couple challenges

### Teams
- `teams` — Team definitions with join codes
- `team_members` — Member-team associations
- `team_assessments` — Team aggregate data

### Agents
- `agent_state` — Decision log per agent run
- `agent_rules` — 13 weighted rules with learning
- `email_engagement` — Per-email tracking (open/click/action)
- `page_analytics` — Aggregated page performance
- `system_health_log` — Infrastructure health snapshots

### Other
- `email_log` — All sent emails
- `analytics_events` — User behavior events
- `digital_purchases` — Audiobook and product entitlements
- `feedback` — User feedback records
- `privacy_preferences` — GDPR consent tracking
- `referrals` — Affiliate referral tracking

---

## API Structure

### Public Endpoints (no auth)
- `GET /api/health` — System health check
- `GET /api/questions` — Fetch assessment questions
- `POST /api/assessment` — Submit assessment
- `POST /api/member/verify-pin` — Login
- `GET /api/member/check-email` — Pre-login check

### Member Endpoints (JWT recommended)
- `GET /api/member` — Full member data
- `POST /api/member/preferences` — Save preferences
- `POST /api/member/delete-request` — Request account deletion
- `POST /api/member/portal` — Billing portal access

### Relationship Endpoints (`/api/r/*`)
- `POST /api/r/profile` — Create/update profile
- `POST /api/r/link-partner` — Link partners
- `POST /api/r/matrix` — Relationship matrix
- `POST /api/r/cherish-honor` — Cherish/honor assessment
- `POST /api/r/love-language` — Love language assessment
- `POST /api/r/intimacy` — Intimacy assessment (21+)
- `POST /api/r/couple-challenge/start` — Start challenge
- `GET /api/r/couples/results` — Couple comparison report

### Admin Endpoints (API key required)
- `GET /api/admin/contacts` — List all contacts
- `POST /api/admin/reset-pin` — Reset user PIN
- `POST /api/admin/update-profile` — Update tier/Stripe IDs
- `POST /api/agent/migrate` — Create agent tables

### Agent Endpoints (API key required)
- `GET /api/agent/systems/run` — Health check loop
- `GET /api/agent/email/run` — Adaptive coaching
- `GET /api/agent/website/run` — Analytics aggregation
- `GET /api/agent/dashboard` — Unified dashboard data

---

## Payment Flow

1. User clicks upgrade on `/pricing` or `/member`
2. `GET /checkout?tier=victorypath` creates Stripe Checkout session
3. User completes payment on Stripe
4. Stripe fires `checkout.session.completed` webhook
5. Webhook updates `user_profiles` with tier + Stripe IDs
6. User redirected to `/member?welcome=true&tier=individual`
7. Member portal shows welcome banner, features unlocked

### Downgrade Protection
- Checkout checks current tier before creating session
- Users with equal or higher tier are blocked with billing portal suggestion

---

## Security

- **PIN Auth:** SHA-256 hashed with salt, rate-limited (10 req/min)
- **JWT:** 7-day expiry, HMAC-SHA256 signed
- **CORS:** Whitelisted origins only
- **Admin:** API key required for all admin/agent endpoints
- **Tier Protection:** Client cannot set own tier (server-side only)
- **Rate Limiting:** Category-based (auth: 10/min, assessment: 5/min, admin: 30/min, default: 60/min)

---

## Deployment

```bash
# Deploy to Vercel (from project root)
npx vercel --prod --yes

# Or push to master for auto-deploy
git push origin master
```

---

## Support

- **Coaching:** https://calendly.com/valuetovictory/30min
- **Email:** valuetovictory@gmail.com
- **Portal:** https://assessment.valuetovictory.com/member
