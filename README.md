# Kinetic API Gateway

> **Node.js + Express portfolio project** demonstrating practical REST API design, B2B SaaS lead scoring, campaign visibility, and production-minded backend structure for revenue operations workflows.

**Recruiter takeaway:** *"This person can build backend services that connect technical implementation to pipeline, platform, and go-to-market outcomes."*

---

## Project Overview

| Attribute | Detail |
| --- | --- |
| **Runtime** | Node.js 20+ |
| **Framework** | Express |
| **API Style** | REST + OpenAPI / Swagger UI |
| **Domain** | B2B SaaS Revenue Operations |
| **Sample Data** | 3 accounts · 5 leads · 4 campaigns |
| **Scoring Inputs** | Company size · Revenue · Engagement · Intent signals |
| **Operational Focus** | Lead routing · Funnel prioritization · Campaign reporting |

---

## Service Architecture

```text
accounts ───────────────────────────────┐
                                        │
                                        │ account context
                                        ▼
leads ─────────────── campaigns ─────> score engine
  │                     │                  │
  │ contact + intent    │ source data      │ scoring model
  ▼                     ▼                  ▼
sales follow-up     pipeline context   next-best action
```

### Core Components

| Component | Purpose | Key Files |
| --- | --- | --- |
| `app` | Middleware, routing, docs, 404 handling, centralized errors | `src/app.js`, `src/server.js` |
| `routes` | Endpoint-level request handling | `src/routes/*.js` |
| `data` | Realistic B2B SaaS sample records | `src/data.js` |
| `scoring` | Transparent lead scoring and recommendation logic | `src/utils/scoring.js` |
| `docs` | OpenAPI contract and architecture notes | `docs/openapi.yaml`, `docs/architecture.md` |
| `tests` | API validation for core recruiter-visible paths | `tests/api.test.js` |

---

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Returns API status, uptime, timestamp, and service name |
| `GET` | `/api/leads` | Returns B2B SaaS lead records |
| `GET` | `/api/leads/:id` | Returns one lead or a clean 404 response |
| `GET` | `/api/accounts` | Returns company / account records |
| `GET` | `/api/campaigns` | Returns revenue campaign performance records |
| `POST` | `/api/score` | Scores a lead based on fit and buying intent |
| `GET` | `/docs` | Serves Swagger UI from the OpenAPI spec |

---

## Business Problem

Revenue teams often have engagement data in marketing systems, firmographic context in CRM records, and campaign performance in disconnected reporting layers. That fragmentation slows sales response, reduces prioritization quality, and makes it harder for platform or digital leaders to turn web activity into actionable revenue workflows.

## Solution

Kinetic API Gateway models a compact internal service that:

- exposes leads, accounts, and campaign data through a clean REST surface
- scores inbound opportunities with transparent, explainable rules
- translates buying signals into next-step sales recommendations
- documents the contract with OpenAPI for easier onboarding and integration
- includes the middleware, tests, and documentation expected in a production-minded backend project

---

## Scoring Model

### Inputs

| Input | Role in Score |
| --- | --- |
| `companySize` | Measures target-account fit for mid-market and enterprise segments |
| `annualRevenue` | Approximates budget maturity and commercial capacity |
| `engagementScore` | Reflects behavioral intensity across the buying journey |
| `intentSignals` | Captures explicit commercial actions such as pricing or demo interest |

### Intent Signal Weights

```text
high:   pricing-page, demo-request
medium: webinar-attended, case-study-download
low:    newsletter-click, homepage-return-visit, ad-click
```

### Tier Mapping

```text
0-39   = cold
40-69  = warm
70-84  = qualified
85-100 = high-intent
```

---

## Example Score Request

```json
{
  "companySize": 850,
  "annualRevenue": 128000000,
  "engagementScore": 91,
  "intentSignals": [
    "pricing-page",
    "webinar-attended",
    "case-study-download"
  ]
}
```

## Example Score Response

```json
{
  "score": 94,
  "tier": "high-intent",
  "explanation": [
    "High engagement score indicates strong buying interest.",
    "Pricing page visit is a strong commercial intent signal.",
    "Company size fits enterprise target profile."
  ],
  "recommendedNextAction": "Route to sales within 24 hours with enterprise web platform modernization message."
}
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/fknmiz/kinetic-api-gateway.git
cd kinetic-api-gateway

# 2. Install dependencies
npm install

# 3. Create local environment file
cp .env.example .env

# 4. Start the API
npm start
```

Swagger UI is available at `http://localhost:3000/docs`.

### Run Tests

```bash
npm test
```

---

## Request Flow

```text
client request
   ↓
helmet / cors / morgan / JSON parsing
   ↓
route handler
   ↓
sample data lookup or scoring utility
   ↓
JSON response
   ↓
centralized error handler for 4xx / 5xx cases
```

See [docs/architecture.md](./docs/architecture.md) for the deeper service walkthrough.

---

## Screenshots

Add project visuals in [`screenshots/`](./screenshots/) using the standard documented in [docs/portfolio-screenshot-standard.md](./docs/portfolio-screenshot-standard.md).

Recommended captures for this repo:

- Swagger UI for `/docs`
- lead scoring request/response example
- test run or architecture view

---

## Key Design Decisions

| Decision | Rationale |
| --- | --- |
| **In-memory sample data** | Keeps the portfolio project easy to run while still demonstrating realistic business modeling |
| **Explainable scoring rules** | Makes the lead qualification logic transparent to sales, RevOps, and hiring reviewers |
| **Centralized error handling** | Produces predictable JSON failures instead of route-specific error shapes |
| **OpenAPI-backed docs** | Shows contract discipline and makes the API easy to inspect in Swagger UI |
| **Environment-driven config** | Mirrors production deployment habits without overengineering configuration |
| **Focused endpoint scope** | Emphasizes business usefulness over tutorial-style generic CRUD |

---

## What This Demonstrates

| Capability | Evidence in Project |
| --- | --- |
| **Backend engineering** | Express app structure, middleware, routing, and error handling |
| **API design** | Clean REST endpoints with documented request/response behavior |
| **Business systems thinking** | Lead scoring tied to campaigns, account fit, and next-step revenue action |
| **Platform maturity** | OpenAPI docs, tests, environment config, and security middleware |
| **Revenue orientation** | SaaS sample data and scoring logic framed around pipeline prioritization |

---

## Security and Delivery Posture

- `helmet`, `cors`, and centralized error handling are enabled by default
- Swagger docs are generated from a versioned OpenAPI file
- Automated tests cover key endpoints and scoring behavior
- GitHub Actions CI, CodeQL, Dependabot, and a repository security policy are included in the repo

---

## Future Enhancements

- persist leads, accounts, and campaigns in PostgreSQL
- add request validation and rate limiting
- add authentication, authorization, and audit logging
- publish scoring events to CRM or marketing automation workflows
- introduce analytics ingestion webhooks and structured observability

---

## Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-REST_API-000000?logo=express&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-Swagger_UI-85EA2D?logo=swagger&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

### Portfolio Links

- [LinkedIn](https://www.linkedin.com/in/mirzacausevic)
- [Skills Page](https://mizcausevic.com/skills/)
- [Medium](https://medium.com/@mizcausevic)
- [GitHub](https://github.com/fknmiz)

---

*Part of [fknmiz's GitHub portfolio](https://github.com/fknmiz) — demonstrating backend architecture, SaaS revenue workflow thinking, and production-aware API delivery.*
