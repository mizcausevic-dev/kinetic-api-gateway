# Lead data lifecycle and privacy boundary

## Current status

The public resource routes expose fictional records from `src/data.js`; their email domains end in `.example`. Public `POST /api/score` accepts caller-provided inputs without authentication and must receive synthetic values only. The linked fixture score is computed from a fixture lead and its account and returns IDs, inputs, score components, and a recommendation, without contact name or email. These fixtures are for demonstration and must not be replaced with real leads.

The protected `/gateway/v1` path is a **reference integration**. Local HTTP mocks can exercise its behavior without real identities or external systems. There is no verified live CRM, downstream sales workflow, production data store, or deployed privacy boundary.

## Purpose and authority

The allowed purpose is lead prioritization using an authorized lead's existing engagement and intent signals plus its linked account's firmographics. The source system remains the record owner. The gateway client identity, tenant, and scopes come from server configuration after bearer-token validation. The gateway must reject a request when the lead lacks valid scoring consent, is deleted, belongs to another tenant, or points to an inaccessible account. A client cannot assert consent, tenant identity, or account data through the request body.

The reference source contract uses `consent: { status: "granted", purpose: "sales-prioritization", recordedAt, expiresAt }` and `deletedAt: null`. The gateway should require current, unexpired consent and reject a withdrawn or deleted record. These fields do not independently establish a legal basis or prove that consent was validly collected. Before real use, the data owner must confirm the collection notice, permitted purpose, signal provenance, withdrawal handling, and downstream recipient permissions for each integration.

## Data flow and minimization

| Step | Data needed | Handling |
| --- | --- | --- |
| Client request | Opaque lead or delivery ID; bearer credential | Authenticate and authorize; never log or forward the inbound token. |
| Source read | Lead ID, tenant ID, account ID, consent, engagement, intent; account size and revenue | Read through with a gateway-owned credential. Do not use the public fixture routers for protected records. |
| Score | Firmographic and signal inputs | Compute in memory with versioned scoring rules; return only the documented minimum. |
| Delivery | Tenant/source IDs and score event | Send only the fields required by the destination; sign the exact body and use an idempotency key. |
| Request log | Request ID, method, route template, status, duration | Exclude raw URL/query, names, email addresses, credentials, and request/response bodies. |

The reference design does not retain lead or account payloads in an application database. Short-lived in-memory delivery metadata is not a durable audit record, deletion ledger, or production outbox. Process restarts erase it. A production retention schedule must specify the source, destination, logs, delivery metadata, backups, and processor copies separately.

## Withdrawal and deletion

When consent is absent, expired, or withdrawn, new scoring and delivery requests must stop. `404` or `410` from the source means the gateway cannot score or deliver the subject. The optional `DELETE /gateway/v1/leads/{id}` route delegates deletion to the configured source only when `GATEWAY_ALLOW_DELETE=1` and the client has `leads:delete`. While a delivery for the lead is sending in the same process, DELETE returns `409 delivery_in_progress` without calling the source. Once it settles, a retry can suppress new local requests and ask the source to delete. The lock and suppression are process-local; they do not coordinate replicas or prove durable deletion across restarts. Consent may also change between the source read and send. The gateway cannot promise deletion from an external destination or backup it does not control. A successful source DELETE is evidence of the source endpoint's response only; the data owner must verify downstream and backup propagation against the actual providers.

Real-data launch requires a tested request workflow for access, correction, withdrawal, and deletion; a named owner for each system; and evidence that deleted or withdrawn records no longer score, deliver, appear in caches, or remain in operational logs beyond the approved schedule. Do not claim end-to-end erasure from this reference implementation alone.

## Real-data launch gates

1. Name the controller/data owner, processors, upstream provider, destination, jurisdictions, and documented purpose. Approve the record and signal provenance, notice/consent or other applicable authority, and retention schedule.
2. Verify authentication, tenant separation, least-privilege scopes, secret storage and rotation, safe logging, rate limiting, bounded requests, and deployed transport controls at the actual boundary.
3. Complete a live provider read, consent rejection, withdrawal/deletion, destination delivery and failure replay, and tenant isolation test with authorized test records. Confirm that an inbound client credential never reaches upstream.
4. Replace process-local delivery status, idempotency, suppression, and delivery/deletion locking with durable shared controls; define cancellation or reconciliation for in-flight delivery and consent changes, plus recovery after restart or failover.
5. Test removal from source, destination, caches, logs, and backups according to the approved deletion process; document remaining legal retention exceptions and their owner.

Until those gates are met, run only fictional or specifically approved non-personal test records and describe the service as a synthetic reference implementation.
