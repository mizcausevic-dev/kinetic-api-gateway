# Gateway integration contract

This is a **synthetic reference contract** for the protected `/gateway/v1` surface. The repository has no named CRM provider, live CRM credential, or verified external round trip. The local HTTP mock is the contract test target. A provider-specific adapter needs its own mapping, permissions, and acceptance test before real leads are used.

## Boundaries

```text
authenticated client -> /gateway/v1 -> configured HTTP source -> in-memory score
                                   \-> configured HTTP delivery destination
```

- The public `/api` routes serve fictional fixtures and a stateless calculator. They are separate from `/gateway/v1` and must never become a shortcut for real records.
- A client bearer token identifies a server-configured client, tenant, and scopes. A tenant ID supplied in a request is not an authority source.
- The gateway uses its own source credential for upstream requests. It does not forward the inbound client token. The source and delivery origins are configured server-side, never supplied in a request.
- Production endpoints require HTTPS. HTTP loopback is reserved for local contract tests. The endpoint URL must have no embedded credentials, query, or fragment; redirects are rejected.

## Versioned source HTTP API

The configured HTTP source owns the lead and account records. The gateway reads them by tenant and source ID. Protected score responses identify this provenance as `configured-http-source`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/tenants/{tenantId}/leads/{id}` | Read one lead, including its account reference and scoring consent metadata. |
| `GET` | `/v1/tenants/{tenantId}/accounts/{id}` | Read firmographics for the lead's linked account. |
| `DELETE` | `/v1/tenants/{tenantId}/leads/{id}` | Optional source-owned deletion path, enabled only when explicitly configured. |

Requests use `Authorization: Bearer <gateway-owned source credential>` and `Accept: application/json`. The tenant comes from the authenticated client configuration. The gateway expects source records to carry the same tenant ID and a valid lead-to-account relationship; inconsistent records must fail closed. `404` and `410` mean the record is unavailable. The adapter bounds response size and time, retries GET at most once on transport failure or `429`/5xx, and does not retry DELETE. A read timeout or invalid response is an upstream failure, not an empty record.

The source contract is deliberately narrow. A lead needs a stable `id`, `tenantId`, `accountId`, integer `engagementScore` from 0 to 100, recognized `intentSignals`, `deletedAt: null`, and `consent: { status: "granted", purpose: "sales-prioritization", recordedAt: <ISO timestamp>, expiresAt: <ISO timestamp> }`. An account needs a stable `id`, matching `tenantId`, non-negative integer `employees`, and non-negative integer `annualRevenue`. Consent must be current at request time. The repository must not claim compatibility with a real CRM schema until a provider mapping is built and tested.

The local mock uses records equivalent to these fictional examples:

```json
{
  "id": "lead-001",
  "tenantId": "tenant-a",
  "accountId": "acct-001",
  "engagementScore": 88,
  "intentSignals": ["pricing-page", "webinar-attended", "case-study-download"],
  "consent": {
    "status": "granted",
    "purpose": "sales-prioritization",
    "recordedAt": "2026-01-01T00:00:00.000Z",
    "expiresAt": "2027-01-01T00:00:00.000Z"
  },
  "deletedAt": null
}
```

```json
{
  "id": "acct-001",
  "tenantId": "tenant-a",
  "employees": 620,
  "annualRevenue": 94000000
}
```

At the test clock of `2026-09-29T12:00:00.000Z`, those records score **89, high-intent** under `rules-v1`. The mock may carry contact fields to prove they do not appear in score responses or delivery events; they are not part of the scoring contract.

## Protected gateway API

| Method | Path | Operation |
| --- | --- | --- |
| `GET` | `/gateway/v1/leads/{id}/score` | `scores:read`. Read authorized lead and account, enforce tenant/consent/deletion checks, compute an explainable score in memory. |
| `POST` | `/gateway/v1/deliveries` | `deliveries:write`. Send `{ "leadId": "..." }` with an `Idempotency-Key` header to request a minimal score event. |
| `GET` | `/gateway/v1/deliveries/{id}` | `deliveries:read`. Inspect a delivery's local `state`, `attempts`, safe `code`, and `upstreamStatus` by opaque ID. |
| `DELETE` | `/gateway/v1/leads/{id}` | `leads:delete`. Request upstream deletion only when `GATEWAY_ALLOW_DELETE=1`; return `409 delivery_in_progress` while a delivery for that lead is sending in this process. |

Protected requests require the appropriate scope in addition to a valid client credential. Error responses use the public `{ "error": { "code", "message" } }` shape. `X-Request-Id` lets an operator correlate a response with safe request metadata. A successful new delivery returns HTTP 201 with `deliveryId`, `state: "delivered"`, and `attempts`; an exhausted delivery returns HTTP 502 with its `deliveryId`, which can be inspected through the status route. A replay with the same key returns HTTP 200 for a completed `delivered` or `failed` record, or 202 while still `pending`, without sending another event. Delivery status is visible only to the client and tenant that created it. A score is a recommendation; returning or delivering one does not mean a lead was assigned to sales or written to a CRM.

## Delivery event and signature

The delivery event contains `schemaVersion: "1"`, `deliveryId`, `tenantId`, `leadId`, `accountId`, `score`, `tier`, `modelVersion`, and `occurredAt`. It contains no contact name or email. The delivery adapter sends this JSON to one configured destination with `Content-Type: application/json`, `Idempotency-Key`, `X-Kinetic-Timestamp`, and `X-Kinetic-Signature`. The signature is `sha256=` followed by lowercase hex HMAC-SHA256 over the exact UTF-8 bytes of `timestamp + "." + raw JSON body`, using a gateway-owned signing secret. A receiver must compare signatures in constant time, reject stale timestamps, and deduplicate the idempotency key within its own durable retention window. A successful HTTP 2xx is delivery acceptance by the configured destination, not proof of downstream CRM mutation.

Gateway startup requires the signing secret to be at least 32 UTF-8 bytes. Length alone does not prove entropy. A real integration needs a generated high-entropy secret, protected storage and rotation, and receiver-side verification evidence.

The adapter retries `429`, 5xx, and transport/timeout failures up to three attempts; other 4xx responses are terminal. Each attempt uses the same body, timestamp, signature, and idempotency key. The client-supplied idempotency key reserves one process-local record; the gateway sends that record's opaque delivery ID as the destination idempotency key. A failed delivery remains a failed result with its attempt count and safe error code; it must not be reported as delivered. Local delivery status is operational evidence only. Records older than the default 24-hour TTL are purged lazily on a later reservation or lookup, so this is not a hard retention deadline. Restart erases the store; idempotency cannot survive a restart or coordinate multiple instances.

## Local acceptance and real-data gate

Contract tests should run both source and delivery mocks on loopback and cover a valid score, invalid client or scope, wrong tenant, missing consent, deleted lead, upstream timeout/5xx, destination rejection, retries, and idempotent replay. No fixture bearer token or HMAC secret belongs in a deployed environment.

Before enabling real data, identify the actual upstream and destination owners, map their schemas and deletion semantics, verify least-privilege credentials and tenant isolation against the live systems, replace in-memory idempotency with a durable shared store/outbox, approve retention and deletion propagation, validate outbound host allowlisting and DNS behavior, and test deployed observability and rollback. See [privacy lifecycle](./privacy-lifecycle.md).

The local delivery/deletion lock prevents deletion while the same process has an in-flight send for that lead. It does not coordinate replicas or prove atomicity with a consent change at the source. A live system needs a shared lock or outbox protocol and reconciliation with the destination.
