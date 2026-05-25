# CLAUDE.md — VTV Assessment Platform Context

## Owner
Shawn E. Decker | valuetovictory@gmail.com | PIN: ${SHAWN_PIN}  # see .env.local — do not commit

## Credentials (from .env.local)
- DATABASE_URL: in .env.local
- ADMIN_API_KEY: ${ADMIN_API_KEY}  # see .env.local
- GMAIL_USER: valuetovictory@gmail.com

## Architecture
- Runtime: Node.js on Vercel Serverless
- Database: Neon PostgreSQL (26+ tables)
- Email: Gmail SMTP via Nodemailer
- Payments: Stripe
- AI: Claude API via api/ai.js
- Auth: PIN + JWT (HS256, 7-day expiry)
- Frontend: Vanilla HTML/JS/CSS
- Memory: claude-mem (local SQLite), agent_state + agent_rules (Neon)

## Key Files
- api/index.js — Main API (~9,000+ lines, 60+ endpoints)
- api/relationships.js — Relationship assessments
- api/checkout.js — Stripe checkout
- api/ai.js — Claude AI gateway
- admin-contacts.html — Admin Command Center (8 tabs)
- remote.html — Remote Command Center (/remote)
- agent-dashboard.html — AI Agent Dashboard

## Daily Email Schedule (EST, Vercel cron)
- 6:00 AM — Devotional (Running From Miracles, 60-day cycle)
- 6:30 AM — CEO Briefing (metrics, top 3 signups, recommendations, TODO, devotional preview)
- 7:00 AM — Coaching emails (adaptive 5-day+ sequences)
- 6:00 PM — Accountability ("What did you accomplish today?" + feedback buttons)
- Every 15m — Systems Agent health checks

## Three-Agent System
1. Systems Agent — monitors Neon, n8n, VPS, Stripe, Gmail health
2. Email Agent — adaptive coaching with personas (fast_mover, standard, disengaged, high_performer)
3. Website Agent — analytics, bounce rates, conversion monitoring
- All use weighted rules in agent_rules table (success: +0.1, failure: -0.02)

## The 5 Pillars (50 sub-categories, scored 1-5, max 250)
Time, People, Influence, Numbers, Knowledge
Score ranges: Crisis (<20%), Survival (20-40%), Growth (40-60%), Momentum (60-80%), Mastery (80%+)

## Revenue Model (locked 2026-05-21)
- VictoryPath: $29/mo — members get 10% off coaching & select products
- Value Builder: $47/mo — members get 15% off coaching & select products
- Victory VIP: $497/mo — members get 20% off coaching & select products
- Personal Coaching: $300/hr regular · $240 first session (20% off first for everyone)
- RE Coaching/Consulting 30-min: $300 regular · $240 first session
- RE Coaching/Consulting 60-min: $500 regular · $400 first session
- Skill Pack Bundle: $197 one-time (with optional 30-day VTV trial → $29/mo opt-in)
- LOAV E-Book Presale: $17.77 — Lost Art of Value (digital-only first 5,000, then print)
- Running From Miracles audiobook: $9.97 (push) · paperback: $11.97 OUT OF STOCK
- Reports: Action Plan / Counselor / Team Analysis — $1.99 each
- Whitelabel AI Starter: $197 one-time + $47/mo opt-in (was $79, changed 2026-05-21)
- RETIRED: Mastering Listings Course ($197) — removed from offer
- Valuation: $1.5M, seeking 25% equity angel investment

## Known Issues & Lessons Learned
1. set-pin endpoint was unauthenticated — anyone could overwrite PINs. FIXED: now requires old PIN or JWT.
2. Vercel cron auth was blocking emails — the isCronAuthorized() function was too restrictive. FIXED: removed auth gates from cron endpoints.
3. Hardcoded secrets were in source code (admin PIN, Hostinger API key). FIXED: removed fallbacks.
4. Error messages leaked internal details (err.message, stack traces). FIXED: generic errors returned.
5. XSS via unsanitized user names in email HTML. FIXED: added escHtml().
6. Assessment questions lack validity testing — no reliability metrics, no outcome correlation.
7. Cross-pillar impact matrix is theoretical, not empirically validated.
8. Coaching content is static per pillar — doesn't adapt based on engagement or improvement.
9. The repo was PUBLIC on GitHub — needs to be made PRIVATE.

## Important: Repo Visibility
The GitHub repo (ShawnDecker/vtv-assessment) needs to be set to PRIVATE.
Go to: GitHub > Settings > Danger Zone > Change visibility

## Remote Access
- Admin Command Center: /admin/contacts (requires API key)
- Remote Command Center: /remote (requires API key)
- Agent Dashboard: /agent-dashboard

## Contacts
- Sandy (developer): sba777@proton.me
- Shanda Gordon: shandagordon5@gmail.com (PIN: ${SHANDA_PIN}  # see .env.local — do not commit)
