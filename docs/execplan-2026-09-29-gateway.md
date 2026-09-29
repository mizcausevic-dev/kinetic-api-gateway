# ExecPlan: linked scoring and secure gateway reference

## Goal

Show a traceable synthetic lead-to-account score, provide current reproducible screenshots and diagrams, and establish a protected integration path that can be tested end to end without processing real leads.

## Current state

Observed at `fe47c89` on `codex/gateway-review-fixes`: the public Express API serves fixed accounts, leads, campaigns, and a stateless score calculator. The source has no client identity, tenant boundary, upstream adapter, delivery record, consent gate, or deletion workflow. The prior review found stale PNG evidence and a public request log that includes URLs. Live `origin/main` remains `454ba2f` as of this plan.

## Scope

- Add a deterministic, read-only linked score for synthetic fixture leads with source IDs, inputs, model version, and component contributions.
- Define a versioned CRM read contract and protected gateway routes with test-only local HTTP upstream and delivery mocks. Runtime integration remains disabled until complete configuration is supplied.
- Bind authenticated clients to tenants and scopes; enforce consent/deletion, rate limits, safe logs, explicit request bounds, idempotency, timeouts, bounded retries, and observable delivery failures.
- Refresh OpenAPI, README, architecture diagrams, three portfolio screenshots, tests, and review evidence.

Non-goals: live CRM credentials, real lead ingestion, production deployment, paid infrastructure, or a claim that an external provider round trip occurred.

## Acceptance criteria

1. `lead-001` resolves `acct-analytics-002`, scores 89/high-intent, and exposes source IDs, derived inputs, component scores, and model version without name or email. Unknown or broken associations fail predictably.
2. Protected gateway routes reject absent/invalid credentials, missing scope, wrong tenant, missing consent, deleted subjects, excessive requests, and oversized JSON. Incoming credentials never reach upstream or logs.
3. The local HTTP source and delivery mocks prove success, timeout, retryable failure, idempotency, and final failure status. No response calls a failed delivery successful.
4. No raw URL, query, body, name, email, or Authorization value appears in application logs or 404 payloads.
5. PNG diagrams and screenshots reflect the current source and observed command/API output; README and OpenAPI match it.

## Risks and release class

R3 because authentication, tenant authorization, outbound integration, and privacy semantics are being introduced. The reference is synthetic-only. A live provider, credential scope, shared rate store, durable idempotency/outbox, deletion propagation, deployed logging, and rollback check remain separate production release gates. Test secrets are synthetic fixtures and must never be reused in deployment.

## Design

Keep the existing `/api` surface public and strictly fixture-backed. Add `/api/leads/:id/score` as a read-only demo join. Add `/gateway/v1` as a separate, disabled-by-default surface. Its client identity derives from a configured token hash; tenant and scopes come only from server configuration. A source adapter reads a lead and account from a fixed configured origin using a gateway-owned upstream credential, validates tenant and consent metadata, then scores in memory. A delivery adapter sends a minimal score event to a fixed configured destination with an idempotency key. No inbound credential is forwarded. Store only bounded, short-lived delivery metadata in memory for local observability. Document that production requires a durable shared store and provider-specific rights review.

The versioned CRM contract and local mock are the first defined integration. A provider-specific adapter is deferred until its owner, schema, scopes, deletion semantics, and test environment are identified. This avoids inventing a HubSpot or other provider mapping.

## Execution sequence

1. Add linked fixture score utility, route, tests, and OpenAPI schema.
2. Add safe request logging, bounded JSON, credential/tenant/scope middleware, and rate limiting.
3. Add source and delivery adapters, consent/deletion gates, idempotent delivery status, and local HTTP mock tests.
4. Refresh docs and render diagrams and screenshots from observed behavior.
5. Run local verification and diff/security review; commit a reviewable branch.

## Verification

Executed locally on Node 24.11.0: `npm.cmd ci` (exit 0, 295 packages, 0 vulnerabilities), `npm.cmd test` (exit 0, 36 passed, 0 failed), full and production `npm.cmd audit --audit-level=high` (exit 0, 0 vulnerabilities), JavaScript syntax checks (exit 0), OpenAPI YAML parse with 71 internal references resolved, and `git diff --check` (exit 0). The source and delivery contract tests used loopback HTTP mocks and synthetic credentials. `npm.cmd run render:diagrams` and `npm.cmd run capture:evidence` exited 0. The two diagram PNGs and three 1600×900 screenshots were visually inspected; the proof screenshot shows the actual 36/0 local test run. GitHub Node 20/22/24 CI, CodeQL on this branch, provider checks, and deployed boundary checks remain required before publication or real-data use.

## Deployment and rollback

No deployment target is configured or authorized. Local smoke uses `npm.cmd start` and `http://localhost:3000/health`. The protected integration is disabled unless complete runtime configuration is provided. Before publication, push this branch, open a PR, wait for CI/security checks, and verify the live boundary. Rollback locally by switching to the prior commit or reverting the new commit; no user data migration is planned.

## Progress

- [x] 2026-09-29: Confirmed checkout, latest remote main, baseline code, and reviewer findings.
- [x] Linked demo flow and contract: `lead-001` -> `acct-analytics-002` -> 89/high-intent.
- [x] Protected integration path and failure tests, including an in-process delivery/deletion race guard.
- [x] Current screenshots and diagrams rendered from source and observed local output.
- [x] Local verification and diff/security review.
- [x] Commit the local review branch.
- [ ] Public CI review.

## Decisions

- Preserve the existing public fixture API; place protected integration routes under `/gateway/v1` so real data cannot accidentally flow through the demo routers.
- Keep real provider activation fail closed and use a local HTTP contract mock for reproducible acceptance tests.

## Outcome

The synthetic demonstration and protected reference path are implemented locally. Product, engineering, AppSec/privacy, and QA/release reviews were incorporated. Client/tenant authorization, consent, scoped deletion, safe logs, rate limits, source/delivery contracts, bounded retries, and observable delivery failures have local test evidence. The gateway stays disabled by default; no real source or destination, live records, public branch CI, or deployment was verified. Before real data, replace process-local status/idempotency/suppression/rate controls with durable shared services, establish a provider-specific consent and deletion protocol, address cross-instance delivery/deletion and consent races, protect unauthenticated traffic at the edge, and verify egress controls and the deployed boundary.
