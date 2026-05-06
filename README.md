# Kinetic API Gateway

## Executive Summary
Kinetic API Gateway is a production-minded Node.js and Express REST API that models how a growth-oriented platform team could expose operational data for leads, accounts, campaigns, and sales-prioritization workflows. The project is intentionally framed around practical SaaS revenue operations rather than tutorial-style CRUD.

## Business Problem
Modern SaaS teams often have firmographic data, campaign performance signals, and lead engagement events spread across marketing automation, analytics, and CRM systems. That fragmentation slows sales response, weakens prioritization, and makes it harder for technical leadership to turn web engagement into reliable pipeline decisions.

## Solution
This service packages a focused backend surface for:

- exposing account, lead, and campaign datasets through clean REST endpoints
- scoring inbound demand using transparent firmographic and intent rules
- documenting the contract with OpenAPI and Swagger UI
- structuring the service with security middleware, centralized error handling, and test coverage that feels deployment-ready

## Tech Stack

- Node.js
- Express
- REST API design
- Swagger / OpenAPI
- Helmet
- CORS
- Morgan
- dotenv
- Node test runner + Supertest

## Architecture
The application uses a compact layered structure:

- `src/app.js` configures middleware, routing, OpenAPI docs, 404 handling, and centralized error responses
- `src/routes/*` keeps endpoint behavior small and explicit
- `src/data.js` provides realistic SaaS sample datasets for recruiter demos and local testing
- `src/utils/scoring.js` contains the lead scoring model and recommendation logic
- `docs/openapi.yaml` defines the API contract used by Swagger UI at `/docs`

Additional implementation notes are available in [docs/architecture.md](./docs/architecture.md).

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health, uptime, timestamp, and service metadata |
| GET | `/api/leads` | Returns B2B SaaS lead records |
| GET | `/api/leads/:id` | Returns a single lead or a clean 404 |
| GET | `/api/accounts` | Returns account / company records |
| GET | `/api/campaigns` | Returns campaign performance records |
| POST | `/api/score` | Scores a lead using size, revenue, engagement, and intent signals |
| GET | `/docs` | Swagger UI generated from the OpenAPI spec |

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

## How To Run Locally

```bash
npm install
cp .env.example .env
npm start
```

The service defaults to `http://localhost:3000` and exposes Swagger UI at `http://localhost:3000/docs`.

## How To Run Tests

```bash
npm test
```

## What This Demonstrates To Hiring Managers

- backend API design with clean route organization and predictable JSON contracts
- platform thinking across revenue workflows, lead routing, and campaign visibility
- business-aware scoring logic that translates engagement and firmographics into operational action
- production basics including environment configuration, security middleware, observability, documentation, and automated tests
- communication maturity through concise architecture notes and recruiter-readable positioning

## Future Enhancements

- persist data in PostgreSQL or a document store with repository abstractions
- add authentication, role-based access, and audit logging for internal tooling use cases
- stream scoring events to a queue for downstream CRM and lifecycle automation
- add rate limiting, request validation, and structured application telemetry
- support webhook ingestion from marketing automation or product analytics platforms
