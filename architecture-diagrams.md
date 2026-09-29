# Kinetic API Gateway: architecture diagrams

These diagrams describe the source in `src/`. `request-flow.png` and `scoring.png` are generated from the Mermaid blocks below with `npm run render:diagrams` using the pinned Mermaid CLI and a local Chrome or Edge browser.

The public API uses fictional fixtures. The protected gateway is disabled by default and has only a versioned HTTP reference contract. Neither diagram represents a verified CRM integration or production data lifecycle.

## Request flow and trust boundaries

```mermaid
flowchart TD
  client([HTTP client]) --> app["src/app.js<br/>helmet, safe request ID and route log,<br/>16 KB JSON limit"]
  app --> docs["GET /docs and /health"]
  app --> api["Public /api<br/>synthetic fixtures only"]
  app --> configured{"GATEWAY_ENABLED=1<br/>with complete configuration?"}
  configured -- no --> disabled["/gateway/v1 returns 503<br/>gateway_disabled"]
  configured -- yes --> gateway["Protected /gateway/v1<br/>src/gateway/router.js"]
  api --> lists["GET leads, accounts, campaigns<br/>src/data.js"]
  api --> calculator["POST /api/score<br/>validated caller inputs"]
  api --> linked["GET /api/leads/:id/score<br/>lead.accountId joins fixture account"]
  lists --> fixture[("Synthetic records<br/>src/data.js")]
  linked --> fixture
  linked --> rules["rules-v1 scoring and breakdown<br/>src/utils/linkedScore.js"]
  calculator --> rulesCore["src/utils/scoring.js<br/>pure scoring rules"]
  rules --> rulesCore
  gateway --> auth["Server-configured client token hash<br/>tenant and scopes from config"]
  auth --> limit["Per client and tenant<br/>in-memory rate limit"]
  limit --> protected["Score, delivery, status,<br/>and optional deletion routes"]
  protected --> source["Configured source adapter<br/>gateway-owned credential"]
  protected --> delivery["Configured delivery adapter<br/>signed minimal event"]
  protected --> store[("Process-local status,<br/>idempotency, suppression")]
```

## Linked scoring and protected delivery

```mermaid
flowchart TD
  demo["Public synthetic example<br/>GET /api/leads/lead-001/score"] --> join["lead-001.accountId<br/>acct-analytics-002"]
  join --> fixtureInputs["Account: 620 employees, 94M revenue<br/>Lead: engagement 88, three signals"]
  fixtureInputs --> formula["rules-v1: 23 + 16 + 32 + 18"]
  formula --> demoResult["89 / high-intent<br/>IDs, inputs, breakdown, no contact details"]
  protected["Protected /gateway/v1<br/>valid client token and route scope"] --> tenant["Tenant from server configuration<br/>never from request header"]
  tenant --> read["Source adapter reads lead by tenant and ID<br/>bounded response, timeout, limited GET retry"]
  read --> gate{"Matching tenant,<br/>current scoring consent,<br/>not deleted?"}
  gate -- no --> deny["403, 404, or 410<br/>no score or delivery"]
  gate -- yes --> account["Source adapter reads linked account<br/>and checks tenant"]
  account --> score["Derive inputs and rules-v1 score<br/>no contact name or email"]
  score --> scoreResponse["GET /leads/:id/score<br/>returns traceable score"]
  score --> reserve["POST /deliveries<br/>reserve idempotency key"]
  reserve --> send["Sign minimal event and send<br/>at most three attempts"]
  send --> ack{"Destination accepts<br/>HTTP 2xx?"}
  ack -- yes --> delivered["201 delivered<br/>GET /deliveries/:id: delivered"]
  ack -- no --> failed["502 delivery_failed<br/>GET /deliveries/:id: failed"]
  tenant --> deletion["DELETE /leads/:id<br/>requires scope and delete enabled"]
  deletion --> suppress["Suppress local reads and deliveries<br/>remove process-local status"]
  suppress --> upstreamDelete["Request source-owned deletion<br/>no automatic destination erasure"]
```
