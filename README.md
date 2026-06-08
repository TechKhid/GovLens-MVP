# 🇬🇭 GovLens

> **Civic accountability infrastructure for Ghana — powered by AI, verified by citizens.**

GovLens is an open-source, AI-enabled civic accountability platform that connects Ghana's citizens directly with their Members of Parliament (MPs). Citizens report local infrastructure and governance issues; MPs receive structured, AI-classified intelligence on their constituency; citizens — not MPs — verify whether problems have actually been fixed.

Built for the **Beorchid Africa Developers Hackathon Stage 3**, GovLens is a truthful, production-ready MVP that uses real machine-learning pipelines (not mock data), enforces a verifiable accountability lifecycle, and is designed to scale across all 275 Ghana constituencies.

---

## 📌 Table of Contents

- [Demo Flow](#-demo-flow)
- [Core Design Principles](#-core-design-principles)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [AI & ML Features](#-ai--ml-features)
- [Geographic Scope System](#-geographic-scope-system)
- [Issue Lifecycle](#-issue-lifecycle)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Overview](#-api-overview)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎬 Demo Flow

A complete accountability story in one pass:

```
1. Citizen registers → selects constituency + auto-populated zone
2. Citizen submits issue → AI classifies sector, severity, flags duplicates
3. MP dashboard receives issue (geo-scoped to their constituency only)
4. MP acknowledges → adds internal notes → marks "In Progress"
5. MP claims fix → writes resolution note → moves to "Pending Verification"
6. Original reporter receives verification prompt
7. Citizen confirms fix → status → "Verified Resolved" → MP metrics update
   ─ OR ─
7. Citizen disputes → issue Reopened with reason → MP must respond again
8. MP profile updates approval rating from citizen-verified outcomes (not MP-claimed closures)
```

---

## 🧭 Core Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Citizens verify, MPs don't self-close** | MPs can only move to `Pending Verification`; the original reporter must confirm or dispute |
| **AI assists, humans decide** | All AI outputs (sector, severity, routing) are suggestions with confidence scores; the citizen always has override |
| **Truthful accountability** | Approval ratings separate *Resolution Claims* from *Citizen-Verified Resolutions* |
| **MP identity is gated** | MP onboarding requires admin approval or whitelist; self-registration does not grant MP powers |
| **Ghana-first data model** | Every issue carries `oversight_owner` (MP) and `likely_responsible_authority` (MMDA / agency) per Ghana's governance structure |
| **Cross-constituency abuse is blocked** | Backend enforces constituency-scoped access; geo-scope middleware rejects mismatched actions |

---

## 🏗️ System Architecture

![GovLens System Architecture](govlens_system_architecture.svg)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                   │
│          Citizens (Web App)        MPs (Dashboard)              │
└──────────────────────┬──────────────────────┬───────────────────┘
                       │                      │
                       ▼                      ▼
              ┌─────────────────────────────────────┐
              │      Nginx Reverse Proxy  :80        │
              │  /api/* → go-api  /ml/* → ml-sidecar │
              └───────────┬────────────┬────────────┘
                          │            │
          ┌───────────────┘            └────────────────┐
          ▼                                              ▼
┌──────────────────────┐                    ┌──────────────────────┐
│  Next.js 15 Frontend │                    │  Python ML Sidecar   │
│  React 19 / Tailwind │                    │  FastAPI  :8001       │
│  ─────────────────── │                    │  ──────────────────── │
│  Issue Reporting     │                    │  Sector Classifier    │
│  Heatmaps (deck.gl)  │                    │  Sentiment (VADER)    │
│  MP Dashboard        │                    │  Duplicate Detection  │
│  Analytics (Plotly)  │                    │  Hotspot Insights     │
│  Geo-scope UI        │                    │  Trend Forecast       │
└──────────────────────┘                    └──────────────────────┘
                          ▲            ▲
                          │            │
              ┌───────────┘            └────────────────┐
              │                                         │
              ▼                                         │
┌────────────────────────────┐                         │
│   Go REST API  :8000        │◄────────────────────────┘
│   (chi router)              │    HTTP calls for ML
│   ──────────────────────── │
│   Auth / JWT                │
│   Issues CRUD               │
│   Geo-scope middleware      │
│   Briefing engine           │
│   File uploads              │
│   NATS event publisher      │
└──────────┬─────────────────┘
           │
    ┌──────┴─────────────────────────┐
    ▼              ▼                 ▼
┌────────┐   ┌──────────┐   ┌──────────────┐
│Postgres│   │  Redis   │   │     NATS     │
│  :5432 │   │  :6379   │   │  JetStream   │
│Primary │   │ API cache│   │  Event bus   │
│  store │   │ (30s TTL)│   │  :4222/:8222 │
└────────┘   └──────────┘   └──────────────┘

━━━━━━━━━━━━━ PLANNED FUTURE LAYER ━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────┐  (dashed)
│         🤖 Agentic MP Assistant                   │
│  LLM Reasoning Engine (tool-use / function calls) │
│  ── Tools ──────────────────────────────────────  │
│  • query_issues(zone, sector, date_range)         │
│  • generate_briefing(cluster_id)                  │
│  • analyze_trends(constituency, period)           │
│  • suggest_escalation(issue_id)                   │
│  • draft_response(issue_id)                       │
└──────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19 |
| Styling | Tailwind CSS 3 |
| Maps | deck.gl 9 + MapLibre GL + Google Maps |
| Charts | Plotly.js |
| Data Fetching | SWR 2 |
| Analytics | Vercel Analytics |
| Language | TypeScript 5.7 |

### Backend (Go API)
| Layer | Technology |
|-------|-----------|
| Language | Go 1.22+ |
| Router | chi |
| Database Driver | pgx v5 (PostgreSQL 16) |
| Query Generation | sqlc |
| Cache | Redis 7 via go-redis |
| Messaging | NATS 2.10 JetStream |
| Auth | JWT (HS256) |
| Migrations | golang-migrate |

### ML Sidecar (Python)
| Capability | Library |
|-----------|---------|
| Web framework | FastAPI 0.115 + Uvicorn |
| NLP classification | scikit-learn 1.6 |
| Sentiment analysis | vaderSentiment 3.3 |
| Semantic similarity | sentence-transformers 3.3 (MiniLM) |
| Time-series forecast | Prophet 1.1 + pandas |
| Async database | asyncpg 0.30 |
| Event consumer | nats-py 2.9 |

### Infrastructure
| Service | Technology |
|---------|-----------|
| Container orchestration | Docker Compose |
| Reverse proxy | Nginx Alpine |
| Primary database | PostgreSQL 16 Alpine |
| Cache / pub-sub | Redis 7 Alpine |
| Event streaming | NATS 2.10 JetStream |

---

## 🤖 AI & ML Features

All AI features in GovLens are production-grade ML pipelines — not rule-based heuristics dressed up as AI.

### 1. Sector Classification
- **Endpoint**: `POST /ml/classify`
- **Model**: TF-IDF + Logistic Regression trained on Ghana civic issue descriptions
- **Output**: `{ sector, confidence, severity }` — presented to citizen before submit with override option
- **Used for**: Routing issues to the correct sector (Roads, Water, Education, Health, etc.)

### 2. Sentiment Analysis
- **Endpoint**: `GET /ml/sentiment?zone=<constituency>`
- **Model**: VADER compound scoring aggregated over all open issues in a zone
- **Output**: `{ average_compound, severity_distribution, overall_severity, sample_size }`
- **Used for**: MP Approval Rating computation alongside citizen-verified resolution counts

### 3. Duplicate Detection
- **Endpoint**: `POST /ml/similar`
- **Model**: sentence-transformers (`all-MiniLM-L6-v2`) cosine similarity
- **Output**: Similar existing issues with similarity score, shown as a hint during submission
- **Used for**: Reducing duplicate reports and surfacing existing threads

### 4. Hotspot Detection
- **Endpoint**: `GET /ml/insights?constituency=<name>`
- **Output**: `{ hotspots: [{zone, sector, count, trend}], cluster_summary }`
- **Used for**: MP Analytics dashboard — highlights recurring zone × sector patterns

### 5. Trend Forecasting
- **Runtime**: `prophet_runtime.py`
- **Model**: Facebook Prophet time-series model on issue creation timestamps by zone
- **Output**: 30-day forward projection of issue volume per sector
- **Used for**: MP briefing and analytics trend charts

### 6. AI Briefing Generation
- **Endpoint**: `POST /ml/briefing-draft`
- **Input**: Cluster of related issues (by zone / sector)
- **Output**: Structured briefing draft (title + body) for MP review
- **Used for**: Seeding the briefing editor — MP must review and publish; never auto-published

### Confidence & Transparency
Every AI output shown in the UI is labelled with:
- Source: `AI-suggested`
- Confidence score (percentage)
- A visible **Override** affordance so citizens and MPs always stay in control

---

## 🗺️ Geographic Scope System

GovLens implements a two-tier geo-scope system covering all 275 Ghana constituencies.

### Tier 1 — Structured Zone Mapping (Major Urban Areas)
Constituencies in Greater Accra, Ashanti, Cape Coast, Western, Northern, and Eastern regions have curated zone lists (e.g., `Ayawaso West Wuogon → ["Dzorwulu", "Abelemkpe", "Airport Residential", ...]`).

**Citizens in mapped constituencies see:**
- A dropdown of their constituency's known sub-areas
- An `Other / Not listed...` escape hatch with free-text fallback

### Tier 2 — Profile-Based Fallback (All Other Regions)
For constituencies without a pre-mapped zone list, the system falls back to the **reporter's registered constituency** on their user profile.

**Matching logic (frontend + backend, mirrored):**
```
zoneMatchesConstituency(constituency, zone):
  1. Normalise both to lowercase-trimmed strings
  2. If constituency has a pre-mapped zone list → check zone is in that list
  3. If no mapped list → check zone == constituency name (exact match)
  4. Backend also checks: reporter.constituency == MP.constituency (profile fallback)
```

This guarantees that **every citizen in Ghana can report an issue and have it reach their MP**, regardless of whether their sub-area is pre-mapped.

---

## 📋 Issue Lifecycle

```
Reported → Acknowledged → In Progress → Pending Verification → Verified Resolved
                                                 ↑                      │
                                             Reopened ←─────────────────┘
                                          (citizen disputes)
```

| State | Who sets it | Notes |
|-------|-------------|-------|
| `Reported` | System (on create) | Default state |
| `Acknowledged` | MP | Requires MP auth + matching constituency |
| `In Progress` | MP | Optional status update |
| `Pending Verification` | MP | Requires a resolution note |
| `Verified Resolved` | Citizen (original reporter) | Only the reporter can confirm |
| `Reopened` | Citizen (original reporter) | Must include a dispute reason |

> ⚠️ MPs **cannot** set `Verified Resolved` themselves. This separation is the core trust guarantee of GovLens.

---

## 📁 Project Structure

```
GovLens_MVP/
├── frontend/                   # Next.js 15 App
│   └── src/
│       ├── app/
│       │   ├── (citizen)/      # Citizen-facing pages
│       │   ├── mp/             # MP dashboard, analytics, briefings, heatmap
│       │   └── mp-profile/     # Public MP profile (constituency-derived)
│       ├── components/         # ReportModal, IssueCard, BriefingEditor, etc.
│       ├── context/            # DataStoreContext (SWR-backed global state)
│       └── lib/
│           ├── api.ts          # Typed fetch wrapper
│           ├── auth.ts         # JWT decode + current user helpers
│           ├── geo-scope.ts    # Zone lookup + constituency matching
│           └── mockData.ts     # Sector/color constants
│
├── backend/                    # Go REST API
│   ├── internal/
│   │   ├── api/               # Route handlers + middleware
│   │   │   ├── issues.go      # Full issue CRUD + lifecycle transitions
│   │   │   ├── auth.go        # JWT issue + validation
│   │   │   ├── geo_scope.go   # Zone ↔ constituency matching
│   │   │   └── mp.go          # MP-specific endpoints
│   │   └── db/               # sqlc-generated types + query funcs
│   └── migrations/            # golang-migrate SQL files
│
├── ml_sidecar/                 # Python ML microservice
│   ├── main.py                # FastAPI app + route definitions
│   ├── classifier.py          # Sector + severity classification
│   ├── sentiment.py           # VADER sentiment aggregation
│   ├── insights.py            # Hotspot detection + briefing drafts
│   ├── prophet_runtime.py     # Time-series trend forecasting
│   ├── geo_scope.py           # Python mirror of geo-scope logic
│   └── worker.py              # NATS JetStream event consumer
│
├── nginx/
│   └── nginx.conf             # Reverse proxy routing rules
│
├── docker-compose.yml         # Full stack orchestration
└── .env.example               # Environment variable template
```

---

## 🚀 Getting Started

### Prerequisites
- Docker Desktop 4.x+ (with Compose V2)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/<your-org>/govlens.git
cd govlens
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)
```

### 3. Start All Services
```bash
docker compose up --build
```

This will:
1. Start PostgreSQL, Redis, and NATS
2. Run database migrations automatically
3. Seed initial data (regions, districts, constituencies, demo users)
4. Build and start the Go API on `:8000`
5. Build and start the Python ML Sidecar on `:8001`
6. Start Nginx on `:80` (proxies to both)

The frontend runs separately for development:
```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

### 4. Access the App
| URL | Description |
|-----|-------------|
| `http://localhost` | Nginx proxy (production-like) |
| `http://localhost:3000` | Frontend dev server |
| `http://localhost:8000` | Go API direct |
| `http://localhost:8001` | ML Sidecar direct |
| `http://localhost:8222` | NATS monitoring |

### 5. Demo Accounts (from seed data)
| Role | Email | Password |
|------|-------|----------|
| Citizen | `citizen@govlens.gh` | `password123` |
| MP (Ayawaso West Wuogon) | `mp@govlens.gh` | `password123` |
| Admin | `admin@govlens.gh` | `password123` |

---

## ⚙️ Environment Variables

```env
# Backend (Go API)
DATABASE_URL=postgres://govlens:password@postgres:5432/govlens?sslmode=disable
REDIS_URL=redis://redis:6379
NATS_URL=nats://nats:4222
JWT_SECRET=<change-in-production>
ML_SIDECAR_URL=http://ml-sidecar:8001
PORT=8000
UPLOADS_DIR=/var/lib/govlens/uploads

# ML Sidecar
POSTGRES_URL=postgresql://govlens:password@postgres:5432/govlens
NATS_URL=nats://nats:4222

# Frontend (Next.js)
NEXT_PUBLIC_API_BASE_URL=http://localhost/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-key>
```

---

## 🔌 API Overview

All endpoints are prefixed with `/api/v1`. Authentication uses `Authorization: Bearer <jwt>` headers.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register a new citizen or MP account |
| `POST` | `/auth/login` | Login, returns JWT |
| `GET` | `/auth/me` | Get current user profile |

### Issues
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/issues` | List all issues (filterable by zone, sector, status) |
| `POST` | `/issues` | Create new issue (citizen) |
| `GET` | `/issues/:id` | Get issue + comments + timeline |
| `PATCH` | `/issues/:id/status` | Update issue status (MP only, constituency-scoped) |
| `POST` | `/issues/:id/verify` | Citizen confirms or disputes a resolution |
| `POST` | `/issues/:id/comments` | Add comment (authenticated) |
| `POST` | `/issues/:id/upvote` | Upvote an issue |

### MP
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mp/dashboard` | Constituency-scoped issue queue |
| `GET` | `/mp/public-profile` | Public MP profile by constituency |
| `POST` | `/mp/briefings` | Publish a briefing |
| `GET` | `/mp/briefings` | List published briefings |

### Locations
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/locations/regions` | All Ghana regions |
| `GET` | `/locations/districts` | Districts (filterable by region) |
| `GET` | `/locations/constituencies` | Constituencies (filterable by district) |

### ML (via proxy)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ml/classify` | Classify issue text → sector + severity |
| `POST` | `/ml/similar` | Find semantically similar existing issues |
| `GET` | `/ml/sentiment` | Aggregate zone sentiment score |
| `GET` | `/ml/insights` | Hotspot detection for a constituency |
| `POST` | `/ml/briefing-draft` | Generate AI briefing draft from issue cluster |

---

## 🔭 Future Roadmap

### Phase 2 — Agentic MP Assistant 🤖

The most significant planned addition is a **fully agentic AI assistant for MPs**, built on a tool-use LLM architecture. Unlike the current sidecar (which runs discrete ML tasks), this agent will support multi-step reasoning to help MPs understand their constituency's needs.

**Architecture:**
```
MP Types Query
     │
     ▼
┌─────────────────────────────────────────────────────┐
│            Agentic MP Assistant                      │
│  Model: Gemini / GPT-4 with function-calling         │
│                                                      │
│  Available Tools:                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ query_issues(zone, sector, status, days)     │    │
│  │ analyze_trends(constituency, window)         │    │
│  │ identify_hotspots(constituency)              │    │
│  │ generate_briefing(issue_ids, tone)           │    │
│  │ suggest_escalation(issue_id, authority)      │    │
│  │ draft_official_response(issue_id, style)     │    │
│  │ compare_constituencies(constituency_list)    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
     │
     ▼
Natural language answer + sourced evidence to MP
```

**Example MP queries the agent can handle:**
- *"Which sectors in Dzorwulu have had the most unresolved issues in the past 30 days?"*
- *"Draft a briefing for the road network complaints in East Legon that I can review and publish."*
- *"Are there any issues I haven't responded to in over 2 weeks?"*
- *"Which issue in my queue is most urgent based on citizen sentiment and upvotes?"*

### Phase 3 — Voice-to-Text Submission
- Ghana-accent-aware speech recognition for issue submission
- Supports citizens with limited literacy or on feature phones
- Language expansion: Twi, Ga, Hausa, Ewe

### Phase 4 — Image Evidence Tagging
- Computer vision pipeline for uploaded issue photos
- Auto-detects civic scene types: potholes, flooding, refuse, broken streetlights
- Provides structured metadata tags to enrich issue classification

### Phase 5 — Parliament Directory Integration
- Verified MP identity via Ghana's Parliament data
- Automated MP account provisioning with zero manual admin overhead
- Committee membership tagging for routing (e.g., Roads → Infrastructure Committee)

### Phase 6 — Agency Escalation Pipeline
- Real API connections to GHA (Ghana Highway Authority), GWCL, ECG, and MMDAs
- Traceable digital paper trail for escalated issues
- Two-way status sync: agencies can update issue state from their own systems

### Phase 7 — Spam & Manipulation Detection
- Bot detection on repeated reports from the same IP/device fingerprint
- Coordinated manipulation detection (sudden spikes in upvotes)
- Confidence scoring for civic integrity

---

## 🤝 Contributing

GovLens is open to contributions from developers, civic technologists, and GovTech advocates across Africa.

### Development Setup
```bash
# Backend (requires Go 1.22+)
cd backend
go run ./cmd/api

# Frontend (requires Node 20+)
cd frontend
npm install && npm run dev

# ML Sidecar (requires Python 3.11+)
cd ml_sidecar
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Before Submitting a PR
- [ ] `go test ./...` passes (backend)
- [ ] `tsc --noEmit` passes (frontend)
- [ ] New API routes are constituency-scoped where appropriate
- [ ] AI outputs are labelled with source and confidence
- [ ] No bypass of the citizen verification flow

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Samuel Mensah Kofi**
Solo Developer — Beorchid Africa Developers Hackathon, Stage 3
Built: May – June 2026

---

> *GovLens is not just a reporting tool. It is accountability infrastructure — designed to make Ghana's governance legible, measurable, and answerable to the people it serves.*
