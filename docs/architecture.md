# Kinetic API Gateway architecture

## Service boundary

The Express service has two distinct surfaces:

- Public `/api` exposes fictional lead, account, and campaign fixtures, an unauthenticated calculator, and a read-only lead-to-account score. Do not send real records to these routes.
- Protected `/gateway/v1` is disabled by default. With complete server-side configuration, it reads a versioned HTTP source, checks tenant and scoring consent, computes a score in memory, and can send a minimal signed event to a configured destination. Only local HTTP mocks have been exercised; no live CRM integration is verified.

`src/app.js` creates the app. Incoming requests pass through `helmet`, a request-ID and safe route-template logger, and a 16 KB JSON parser. Swagger UI is served at `/docs`; `/health` reports process status. Open CORS is mounted only on the public `/api` demo routes. Unknown routes and application errors use one JSON error handler. The log omits raw URLs, query strings, bodies, and credentials.

## Public fixture flow

`src/data.js` holds three accounts, five leads, and four fictional campaigns. `GET /api/leads/:id/score` follows the lead's `accountId`, maps account employees and revenue plus lead engagement and intent signals into `src/utils/scoring.js`, and returns source IDs, inputs, component scores, `rules-v1`, and the result without a contact name or email. `lead-001` resolves `acct-analytics-002` and scores 89/high-intent. Missing leads or accounts return 404. `POST /api/score` scores caller-supplied inputs independently and stores nothing.

## Protected integration flow

1. `GATEWAY_ENABLED=1` plus complete configuration mounts `/gateway/v1`; otherwise the prefix returns `503 gateway_disabled`. The client bearer token is hashed and matched against server-configured client IDs, tenant IDs, and scopes. The caller cannot choose a tenant through a request header or body.
2. A per-client, per-tenant process-local limiter runs after authentication. Routes require `scores:read`, `deliveries:write`, `deliveries:read`, or `leads:delete` as appropriate.
3. The HTTP source adapter uses a gateway-owned credential and fixed versioned tenant paths to read a lead and linked account. It bounds response size and time and retries GET once for transport errors, `429`, or 5xx. It does not forward the client's token.
4. Before scoring, the router checks source IDs and tenant matches, `deletedAt: null`, current `sales-prioritization` consent, and supported numeric and intent inputs. The result contains no name or email.
5. `POST /gateway/v1/deliveries` reserves a process-local idempotency record, sends a minimal score event with HMAC-SHA256 headers, and records delivery acknowledgement or failure. `GET /gateway/v1/deliveries/:id` is visible only to the creating client and tenant. A 2xx from the configured destination proves only HTTP acceptance.
6. Optional `DELETE /gateway/v1/leads/:id` requires `GATEWAY_ALLOW_DELETE=1` and `leads:delete`. It returns 409 while a delivery for that lead is in flight in the same process. Otherwise it suppresses new local requests and calls source-owned DELETE once. Suppression, delivery state, rate limits, idempotency, and the delivery/deletion lock are in memory; they do not survive restart or coordinate replicas.

## Operational limits

This is a reference implementation for synthetic tests. Real-data use needs a named provider and destination, approved data purpose and retention, least-privilege credentials, deployed boundary verification, shared durable rate/idempotency/deletion state, cancellation or reconciliation of in-flight delivery, and tested downstream deletion and rollback. The [integration contract](./integration-contract.md) defines HTTP behavior; the [privacy lifecycle](./privacy-lifecycle.md) lists the real-data gates. The [OpenAPI file](./openapi.yaml) is the client-facing contract and [diagrams](../architecture-diagrams.md) show the request flow.
