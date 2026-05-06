# Kinetic API Gateway Architecture

## Service Overview
Kinetic API Gateway is a compact Express service designed to model a realistic internal-facing backend for SaaS revenue operations. It exposes read-only resource endpoints for accounts, leads, and campaigns, then adds a scoring endpoint that turns firmographic and engagement signals into a sales-prioritization decision.

The goal is not to simulate a full CRM. The goal is to demonstrate how a backend engineer or platform leader can package business context, API clarity, and production discipline into a service that feels deployable and decision-oriented.

## Request Flow
1. Incoming requests pass through `helmet`, `cors`, `morgan`, and JSON body parsing.
2. Route handlers map requests to lightweight resource controllers under `src/routes`.
3. Data-backed endpoints read from in-memory sample datasets in `src/data.js`.
4. `POST /api/score` calls `src/utils/scoring.js`, which translates company size, revenue, engagement, and intent into a normalized score and operating recommendation.
5. Unknown routes and application errors are sent through a centralized JSON error handler for consistent responses.
6. Swagger UI is served at `/docs` using the OpenAPI definition stored in `docs/openapi.yaml`.

## Endpoint Map

| Endpoint | Responsibility |
| --- | --- |
| `GET /health` | Runtime status and service metadata |
| `GET /api/leads` | B2B lead listing for funnel review and demo use |
| `GET /api/leads/:id` | Single lead retrieval with explicit 404 behavior |
| `GET /api/accounts` | Account context for firmographic and segmentation views |
| `GET /api/campaigns` | Campaign performance and pipeline contribution snapshot |
| `POST /api/score` | Revenue lead scoring and next-action recommendation |
| `GET /docs` | Interactive Swagger UI |

## Scoring Model Explanation
The scoring model is intentionally simple and explainable:

- `companySize` rewards enterprise and upper mid-market fit
- `annualRevenue` acts as a proxy for likely budget maturity
- `engagementScore` converts behavioral intensity into a weighted signal
- `intentSignals` apply direct weights to commercial actions such as pricing-page visits and demo requests

The final score is capped at 100 and mapped to four operating tiers:

- `0-39`: cold
- `40-69`: warm
- `70-84`: qualified
- `85-100`: high-intent

This approach is useful when teams need a transparent routing model they can explain to sales, marketing, RevOps, and leadership without requiring a machine learning pipeline.

## Security Notes

- `helmet` sets baseline HTTP security headers
- `cors` keeps cross-origin behavior explicit and easy to harden later
- `express.json()` ensures the API can safely accept structured payloads
- centralized error handling avoids leaking stack traces in response bodies
- Swagger UI is generated from a static spec, which keeps API documentation deterministic

## Future Production Upgrades

- add request schema validation with a library such as `zod` or `joi`
- move in-memory data to PostgreSQL and introduce repository or service abstractions
- add rate limiting, authn/authz, and audit trails for internal or partner integrations
- emit structured logs and metrics to an observability platform
- add async event publishing for CRM sync, nurture orchestration, and analytics enrichment
