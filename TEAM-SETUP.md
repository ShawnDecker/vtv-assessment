# VTV Assessment Platform — Team Setup Guide

**For:** New team members setting up Claude Code  
**Time:** 10 minutes  
**Requires:** Windows laptop with internet  

---

## Step 1: Install Claude Code

Go to **https://claude.ai/code** and sign in with your Anthropic account.  
If you don't have one, create a free account at **https://claude.ai**

---

## Step 2: Install Node.js (if not already installed)

Open **PowerShell** (search for it in your Start menu) and type:
```
node --version
```
If you see a version number like `v20.x.x`, skip to Step 3.

If it says "not recognized," install Node.js:
1. Go to **https://nodejs.org**
2. Click the big green **LTS** button
3. Run the installer, click Next through everything
4. Close and reopen PowerShell
5. Type `node --version` again to confirm

---

## Step 3: Install Git (if not already installed)

In PowerShell, type:
```
git --version
```
If it says "not recognized":
1. Go to **https://git-scm.com/download/win**
2. Download and install (keep all defaults)
3. Close and reopen PowerShell

---

## Step 4: Clone the Project

In PowerShell, choose where you want the project. Then run:
```powershell
cd C:\Users\YourName\Desktop
git clone https://github.com/ShawnDecker/vtv-assessment.git
cd vtv-assessment
npm install
```

Replace `YourName` with your actual Windows username.

---

## Step 5: Set Up Local AI (Optional — saves on API costs)

```powershell
npm run setup:ollama
```

This will:
- Check if Ollama is installed (download from **https://ollama.ai** if not)
- Detect your laptop's RAM
- Pull the right AI models for your hardware
- Create your `.env` file automatically

---

## Step 6: Configure Environment Variables

Open the `.env` file that was just created:
```powershell
notepad .env
```

Fill in these values (ask Shawn for them):
```
DATABASE_URL=  (the Neon database connection string)
JWT_SECRET=    (authentication secret)
ADMIN_API_KEY= (admin access key)
GMAIL_USER=    (email for sending)
GMAIL_APP_PASSWORD= (Gmail app password)
STRIPE_SECRET_KEY=  (Stripe key — use sk_test_ for testing)
STRIPE_WEBHOOK_SECRET= (Stripe webhook secret)
AI_GATEWAY_API_KEY= (Vercel AI Gateway key — for cloud AI)
```

Save and close notepad.

---

## Step 7: Start the Local Server

```powershell
npm run dev
```

You should see:
```
  +----------------------------------------------+
  |     VTV Assessment Platform — Local Dev      |
  +----------------------------------------------+
  |  Server:    http://localhost:3000             |
  |  AI Mode:   cloud                            |
  |  Database:  Connected (Neon)                 |
  +----------------------------------------------+
```

Open **http://localhost:3000** in your browser. You're in.

---

## Step 8: Open Claude Code and Start Working

Open Claude Code and navigate to the project:
```
cd C:\Users\YourName\Desktop\vtv-assessment
```

You now have full access to:
- **http://localhost:3000** — Main assessment
- **http://localhost:3000/admin/contacts** — Admin dashboard
- **http://localhost:3000/member** — Member portal
- **http://localhost:3000/agent-dashboard** — AI agent dashboard

---

## Quick Reference Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start server (cloud AI) |
| `npm run dev:local-ai` | Start server (free local AI via Ollama) |
| `npm run dev:auto` | Start server (local AI first, cloud backup) |
| `npm run setup:ollama` | Set up local AI models |
| `git pull` | Get latest code updates |
| `npm install` | Install/update dependencies after pulling |

---

## Accessing the Live Production Site

These work from any browser, no setup needed:

- **Production site:** https://assessment.valuetovictory.com
- **Admin dashboard:** https://assessment.valuetovictory.com/admin/contacts
- **Member portal:** https://assessment.valuetovictory.com/member
- **Agent dashboard:** https://assessment.valuetovictory.com/agent-dashboard
- **Health check:** https://assessment.valuetovictory.com/api/health

---

## Troubleshooting

**"npm is not recognized"**  
→ Close PowerShell, reopen it, try again. If still broken, reinstall Node.js from https://nodejs.org

**"git is not recognized"**  
→ Close PowerShell, reopen it, try again. If still broken, reinstall Git from https://git-scm.com

**Server starts but "Database: NOT CONFIGURED"**  
→ Your `.env` file is missing the `DATABASE_URL`. Ask Shawn for the connection string.

**"STRIPE_SECRET_KEY" error on startup**  
→ This is OK for testing non-payment features. Add the key to `.env` when you need to test checkout.

**Ollama setup fails**  
→ Download Ollama manually from https://ollama.ai/download, install it, then re-run `npm run setup:ollama`

**Port 3000 already in use**  
→ Run with a different port: `set PORT=3001 && npm run dev`

---

## Project Structure (Key Files)

```
vtv-assessment/
  api/              — Backend API (60+ endpoints)
    index.js        — Main API handler (6,500+ lines)
    ai.js           — AI gateway (Claude + Ollama)
    checkout.js     — Stripe payments
    relationships.js — Relationship assessments
  *.html            — Frontend pages (45+ pages)
  scripts/
    dev-server.js   — Local development server
    setup-ollama.js — Ollama AI setup
  .env.example      — Environment variable template
  package.json      — Dependencies and scripts
  vercel.json       — Deployment config and routes
```

---

Built by Shawn E. Decker | Value to Victory | valuetovictory.com
