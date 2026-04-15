# VTV Ecosystem — System Architecture & Team Onboarding Guide

**Version:** 1.0 | **Last Updated:** April 11, 2026  
**Owner:** Shawn E. Decker | **Contact:** valuetovictory@gmail.com

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Cloud Infrastructure](#cloud-infrastructure)
4. [Local Infrastructure](#local-infrastructure)
5. [AI Models (Ollama)](#ai-models-ollama)
6. [Docker Services](#docker-services)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Agent System](#agent-system)
10. [Video Processing Pipeline](#video-processing-pipeline)
11. [n8n Workflow Automation](#n8n-workflow-automation)
12. [MCP Toolkits](#mcp-toolkits)
13. [Team Installation Guide](#team-installation-guide)
14. [System Requirements](#system-requirements)
15. [Troubleshooting](#troubleshooting)

---

## 1. System Overview

The VTV (Value to Victory) ecosystem is a full-stack platform for personal development coaching, assessment delivery, automated email sequences, content generation, and multi-agent AI orchestration.

**Core Components:**
- **Assessment Portal** — React SPA + Vercel serverless API (assessment.valuetovictory.com)
- **Marketing Site** — Static HTML/CSS on Vercel (valuetovictory.com)
- **Author Site** — Static HTML on Vercel (shawnedecker.com)
- **Agent System** — 3 autonomous agents (Systems, Email, Website) + Coordinator
- **Local AI** — Ollama with 7 models for inference, code gen, and content
- **Video Engine** — BiaBox video processing (transcription, clipping, subtitles)
- **Workflow Automation** — n8n (local Docker + VPS)
- **CRM** — HubSpot with 6 custom properties synced from portal
- **Payments** — Stripe (3 subscription tiers + one-time purchases)

---

## 2. Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           CLOUD SERVICES                │
                    │                                         │
                    │  Vercel (3 projects)                    │
                    │    ├── valuetovictory.com               │
                    │    ├── assessment.valuetovictory.com    │
                    │    └── shawnedecker.com                 │
                    │                                         │
                    │  Neon PostgreSQL (39 tables)            │
                    │  Stripe (3 tiers + products)            │
                    │  HubSpot CRM (141+ contacts)            │
                    │  Gmail SMTP (coaching emails)           │
                    │  Calendly (30min + 60min)               │
                    └──────────────┬──────────────────────────┘
                                   │
                                   │ HTTPS API
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────┴──────┐   ┌────────┴────────┐   ┌──────┴──────────┐
    │  AGENT SYSTEM  │   │  ADMIN DASHBOARD│   │  LOCAL MACHINE  │
    │                │   │                 │   │                  │
    │  Systems Agent │   │  PIN Auth       │   │  Docker (37)     │
    │  Email Agent   │   │  Health Grid    │   │  Ollama (7)      │
    │  Website Agent │   │  Agent Status   │   │  ffmpeg 8.1      │
    │  Coordinator   │   │  Infra Systems  │   │  n8n (local)     │
    └────────────────┘   └─────────────────┘   │  Video Engine    │
                                                │  Writing Tools   │
                                                │  MCP Toolkits    │
                                                │  System Agent    │
                                                └──────────────────┘
                                                        │
                                                        │ SSH / API
                                                        │
                                              ┌─────────┴─────────┐
                                              │  HOSTINGER VPS    │
                                              │  147.93.97.228    │
                                              │                   │
                                              │  n8n (production) │
                                              │  Traefik (proxy)  │
                                              │  7 VTV workflows  │
                                              └───────────────────┘
```

---

## 3. Cloud Infrastructure

| Service | Purpose | URL/Access | Cost |
|---------|---------|------------|------|
| Vercel Pro | Hosting (3 sites) | vercel.com/danddappraisal-7740s-projects | $20/mo |
| Neon PostgreSQL | Database (39 tables) | console.neon.tech | Free tier |
| Stripe | Payments & subscriptions | dashboard.stripe.com | Transaction fees |
| HubSpot | CRM (141+ contacts) | app.hubspot.com (ID: 244534163) | Free tier |
| GoDaddy | 7 domains | dcc.godaddy.com | ~$23/mo (WP) |
| Hostinger VPS | n8n + Traefik | 147.93.97.228 | KVM2 tier |
| Gmail | SMTP for emails | valuetovictory@gmail.com | Free |
| Calendly | Scheduling | calendly.com/valuetovictory | Free tier |
| GitHub Pro | Source control | github.com/ShawnDecker | $4/mo |

**Total Monthly:** ~$538/mo (includes all services)

---

## 4. Local Infrastructure

### System Agent
A Node.js script that runs locally and reports all system status to the Neon database every 5 minutes.

**Location:** `vtv-assessment/scripts/system-agent.js`  
**Reports:** Docker containers, Ollama models, system resources, local services  
**API:** POST /api/agent/systems/report  

**Run manually:**
```bash
ADMIN_API_KEY="your-key" node scripts/system-agent.js
```

**Run continuously:**
```bash
ADMIN_API_KEY="your-key" node scripts/system-agent.js --loop --interval 300
```

---

## 5. AI Models (Ollama)

Local AI inference via Ollama (http://localhost:11434).

| Model | Size | Params | Quantization | Use Case |
|-------|------|--------|--------------|----------|
| gemma3:4b | 3.3GB | 4.3B | Q4_K_M | Fast lightweight tasks |
| phi4-mini | 2.5GB | 3.8B | Q4_K_M | Quick inference, edge tasks |
| phi4:14b | 9.1GB | 14.7B | Q4_K_M | General reasoning |
| qwen2.5-coder:7b | 4.7GB | 7.6B | Q4_K_M | Code generation & editing |
| qwen3:8b | 5.2GB | 8.2B | Q4_K_M | General purpose |
| mistral-small | 14.3GB | 23.6B | Q4_K_M | Heavy reasoning |
| llama3.3 | 42.5GB | 70B | Q4_K_M | Large context tasks |

**Total disk:** ~84GB for all models  
**Min RAM for inference:** 8GB (small models), 16GB (medium), 32GB+ (llama3.3)

### Auto-Update Models
The system agent checks model status and reports to the dashboard. To pull/update a model:
```bash
curl -X POST http://localhost:11434/api/pull -d '{"name":"qwen3:8b"}'
```

---

## 6. Docker Services

### 6a. BiaBox Content Engine (11 services)
```
Port  Service              Status    Purpose
8000  API Gateway           healthy   Central routing
8001  Book Engine           exited    Book generation (needs repair)
8002  Social Engine         healthy   Social content generation
8003  Video Engine          healthy   Video processing + transcription
8004  Graphics Engine       restart   Graphics generation (needs postgres)
8005  Automation Engine     restart   Orchestration (needs postgres)
8006  LLM Runtime           healthy   Local LLM inference
8007  Website Runtime       restart   Static site generation (needs postgres)
8008  Data Memory           healthy   ChromaDB vector storage
8009  Auth                  restart   JWT authentication (needs postgres)
8010  Agents                restart   Multi-agent system (needs postgres)
8080  Web App               healthy   Frontend UI
```

**Root cause of crash-looping:** `biax-postgres` container restarts, causing 6 dependent services to fail.

### 6b. Writing Tools (8 services)
```
Port  Service              Status    Purpose
9000  BookStack             healthy   WYSIWYG book/wiki editor
9001  Etherpad              healthy   Collaborative text editor
9002  Memos                 healthy   Self-hosted notes
9003  HedgeDoc              healthy   Collaborative markdown
9004  LanguageTool           healthy   Grammar/spell checking
7700  MeiliSearch           healthy   Fast search engine
```

### 6c. Automation & AI (3 services)
```
Port  Service              Purpose
5678  n8n                   Workflow automation
8188  ComfyUI               AI image generation (CPU-only)
8001  Zeno Brain            AI reasoning engine
```

### 6d. MCP Toolkits (7 services)
```
Service                Purpose
mcp-playwright         Browser automation
mcp-desktop-commander  Desktop/file operations
mcp-docker             Container management
mcp-dockerhub          Image management
mcp-code-sandbox       Safe code execution
mcp-sequentialthinking Step-by-step reasoning
mcp-memory             Context persistence
```

---

## 7. API Endpoints (88 total)

### Assessment & Core
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/assessment | Submit assessment |
| GET | /api/questions | Get question bank |
| GET | /api/report/{id} | Get assessment report |
| GET | /api/benchmarks | Get score benchmarks |
| GET | /api/recommendations | AI recommendations |
| POST | /api/track | Track analytics events |

### Member Portal
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/member/portal | Login/create member |
| POST | /api/member/set-pin | Set member PIN |
| POST | /api/member/verify-pin | Verify PIN |
| GET | /api/member/preferences | Get preferences |
| GET | /api/premium/check-membership | Check tier |

### Coaching & Email
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/coaching/submit | Submit coaching request |
| GET | /api/coaching/send | Send coaching emails (cron) |
| GET | /api/coaching/status | Check coaching status |
| GET | /api/accountability/send | Send evening emails (cron) |
| GET | /api/devotional/send | Send daily devotional (cron) |

### Admin
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/admin/pin-login | Admin PIN auth |
| GET | /api/admin/contacts | List all contacts |
| GET | /api/admin/analytics | Analytics dashboard |
| GET | /api/admin/export | Export contacts CSV |
| POST | /api/admin/hubspot-sync | Sync to HubSpot |
| GET | /api/ceo-briefing | Daily CEO briefing |

### Agent System
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/agent/migrate | Create/update agent tables |
| POST | /api/agent/systems/report | Local agent status push |
| GET | /api/agent/systems/registry | Get all systems |
| GET | /api/agent/dashboard | Unified dashboard data |
| GET | /api/agent/systems/run | Run systems agent |
| GET | /api/agent/email/run | Run email agent |
| GET | /api/agent/website/run | Run website agent |
| GET | /api/agent/coordination/run | Run coordinator |

### Teams
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/teams | Create team |
| GET | /api/teams | List teams |
| GET | /api/teams/{id}/results | Team results |
| GET | /api/teams/{id}/report | Team report |

---

## 8. Database Schema (39 tables)

### Core Tables
- **contacts** — Email, name, phone, created_at
- **user_profiles** — Membership tier, scores, preferences
- **assessments** — Score data, pillar breakdowns, timestamps
- **assessment_progress** — Partial assessment saves
- **answer_history** — Individual answer tracking

### Coaching & Email
- **coaching_requests** — Coaching tier, status, notes
- **coaching_sequences** — Email sequences, engagement, persona
- **email_log** — All emails sent with metadata
- **email_engagement** — Opens, clicks, actions

### Commerce
- **digital_purchases** — Stripe purchases
- **free_book_signups** — Book download leads

### Agent System
- **agent_state** — Agent run history, decisions, actions
- **agent_rules** — Adaptive rules with weights
- **system_registry** — Docker, Ollama, cloud service status
- **system_health_log** — Health check history
- **page_analytics** — Page views, conversions, bounce rates

### Relationships
- **relationship_matrix** — Couple assessment data
- **partner_invites** — Partner invitation tracking
- **couple_challenges** — Couple challenge enrollment

---

## 9. Agent System

Three autonomous agents + one coordinator:

### Systems Agent
- Monitors: Neon DB, n8n, Gmail SMTP, Vercel, VPS
- Rules: neon_slow, n8n_down_consecutive, vps_unreachable, gmail_auth_fail
- Actions: Flag degraded, restart via API, alert owner, pause email agent

### Email Agent
- Manages: Coaching email sequences, engagement tracking
- Rules: skip_if_no_open_2_days, nudge_on_no_click, accelerate_fast_mover
- Personas: fast_mover, standard, disengaged, high_performer

### Website Agent
- Monitors: Page analytics, conversion rates, bounce rates
- Rules: high_bounce_alert, conversion_drop, drop_off_spike

### Coordinator
- Runs all three agents in sequence
- Resolves cross-agent dependencies
- Updates rule weights based on success/failure

### Adaptive Rules
Each rule has a weight (0.0-2.0) that adjusts based on outcomes:
- Success: weight += 0.1
- Failure: weight -= 0.05
- Rules below 0.1 are auto-disabled

---

## 10. Video Processing Pipeline

### BiaBox Video Engine (Port 8003)
**Endpoints:**
- POST /video/transcribe — Whisper transcription
- POST /video/detect-scenes — Scene segmentation
- POST /video/generate-subtitles — SRT/VTT generation
- POST /video/clip — ffmpeg video clipping
- POST /video/process — Full pipeline (all of the above)

**Example — Process a video:**
```bash
curl -X POST "http://localhost:8003/video/process?video_path=/app/videos/my-video.mp4&generate_subtitles=true&detect_scenes=true&create_clips=true"
```

**Output:**
- JSON transcript with timestamps
- Scene-by-scene clips (MP4, no re-encoding)
- SRT + VTT subtitle files

### ffmpeg (Host)
```bash
# Clip a video
ffmpeg -i input.mp4 -ss 00:01:00 -to 00:02:30 -c copy clip.mp4

# Add subtitles
ffmpeg -i input.mp4 -vf subtitles=subs.srt output.mp4

# Extract audio
ffmpeg -i input.mp4 -vn -acodec mp3 audio.mp3

# Convert format
ffmpeg -i input.mov -c:v libx264 -c:a aac output.mp4
```

---

## 11. n8n Workflow Automation

### Production (VPS — n8n.srv1138119.hstgr.cloud)
| Workflow | Status | Webhook |
|----------|--------|---------|
| ShawnEDecker Forms | ACTIVE | /webhook/shawnedecker-forms |
| Stripe Payments | ACTIVE | /webhook/stripe-webhook |
| Lead-to-Booking Pipeline | ACTIVE | /webhook/lead-to-booking |
| Calendly Scheduling | ACTIVE | — |
| Zoom Meetings | ACTIVE | — |
| Systeme.io Marketing | ACTIVE | — |
| Daily Devotional | ACTIVE | — |

### Local (Docker — localhost:5678)
- Credentials: admin / changeme
- Used for development and testing
- Bridge API on port 8005

---

## 12. MCP Toolkits

7 MCP (Model Context Protocol) servers for AI agent capabilities:

| Server | Purpose | Container |
|--------|---------|-----------|
| Playwright | Browser automation, web scraping | mcp-playwright |
| Desktop Commander | File system, process management | mcp-desktop-commander |
| Docker | Container lifecycle management | mcp-docker |
| Docker Hub | Image search and pull | mcp-dockerhub |
| Code Sandbox | Safe code execution | mcp-code-sandbox |
| Sequential Thinking | Step-by-step reasoning chains | mcp-sequentialthinking |
| Memory | Context persistence across sessions | mcp-memory |

---

## 13. Team Installation Guide

### Prerequisites
- Windows 10/11 (64-bit)
- 16GB RAM minimum (32GB recommended)
- 100GB free disk space
- Docker Desktop installed
- Node.js 18+ installed
- Git installed

### Quick Install
```bash
# 1. Clone the installer
git clone https://github.com/ShawnDecker/vtv-team-installer.git
cd vtv-team-installer

# 2. Run the installer (checks requirements + installs everything)
node install.js

# 3. Start services
node install.js --start
```

### What Gets Installed
1. **Ollama** + 4 recommended models (gemma3:4b, phi4-mini, qwen3:8b, qwen2.5-coder:7b)
2. **ffmpeg** (via winget)
3. **Docker containers** (n8n, video engine)
4. **System agent** (auto-reports to VTV dashboard)
5. **Configuration files** (.env, docker-compose)

### Post-Install
- System agent starts reporting to the dashboard automatically
- Admin can see installation status at assessment.valuetovictory.com/agent-dashboard.html
- Models download in background (may take 10-30 min depending on internet)

---

## 14. System Requirements

### Minimum (Core Only)
| Resource | Requirement |
|----------|-------------|
| OS | Windows 10/11 64-bit |
| RAM | 8GB |
| Disk | 30GB free |
| CPU | 4 cores |
| Internet | 10 Mbps |
| Software | Node.js 18+, Docker Desktop |

### Recommended (Full Suite)
| Resource | Requirement |
|----------|-------------|
| OS | Windows 10/11 64-bit |
| RAM | 32GB |
| Disk | 200GB free |
| CPU | 8+ cores |
| GPU | Optional (NVIDIA for ComfyUI) |
| Internet | 50+ Mbps |
| Software | Node.js 18+, Docker Desktop, Git |

### Model Sizing Guide
| RAM Available | Recommended Models | Disk Needed |
|---------------|-------------------|-------------|
| 8GB | gemma3:4b, phi4-mini | ~6GB |
| 16GB | + qwen3:8b, qwen2.5-coder:7b | ~16GB |
| 32GB | + phi4:14b, mistral-small | ~50GB |
| 64GB+ | + llama3.3:70b | ~130GB |

---

## 15. Troubleshooting

### Common Issues

**"Ollama not responding"**
```bash
# Check if running
curl http://localhost:11434/api/tags
# If not, start it
ollama serve
```

**"Docker containers crash-looping"**
```bash
# Check which containers are failing
docker ps -a --filter "status=restarting"
# Check logs
docker logs <container-name> --tail 20
# Common fix: restart the postgres container first
docker restart biax-postgres
```

**"System agent can't reach API"**
```bash
# Test API connectivity
curl -s "https://assessment.valuetovictory.com/api/health"
# Verify API key
curl -s "https://assessment.valuetovictory.com/api/agent/systems/registry" -H "x-api-key: YOUR_KEY"
```

**"ffmpeg not found"**
```bash
# Install via winget
winget install --id Gyan.FFmpeg
# Restart terminal for PATH update
```

**"Video engine transcription fails"**
```bash
# Install whisper in container
docker exec biabox-video-engine pip install faster-whisper
docker restart biabox-video-engine
```

---

## File Structure

```
vtv-assessment/
├── api/
│   ├── index.js              # Main API (88 endpoints, 6400+ lines)
│   ├── relationships.js       # Couples/relationship API
│   ├── checkout.js            # Stripe checkout
│   ├── health.js              # Health check
│   └── ...                    # 11 total serverless functions
├── scripts/
│   ├── system-agent.js        # Local system monitor
│   ├── generate-devotionals.js # Devotional content generator
│   └── promote-to-production.sh
├── public/
│   ├── privacy.html           # Privacy policy
│   └── terms.html             # Terms of service
├── data/
│   └── devotionals.json       # 60-day devotional content
├── agent-dashboard.html       # Admin command center
├── vercel.json                # Routes + cron jobs
├── package.json               # Dependencies
└── *.html                     # 80+ portal pages
```

---

*This document is auto-generated and maintained by the VTV System Agent. For updates, contact valuetovictory@gmail.com.*
