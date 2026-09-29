# Gateway documentation

Kinetic API Gateway is a synthetic lead-scoring reference implementation. Public resource routes use fictional fixtures; the unauthenticated `POST /api/score` calculator should receive synthetic inputs only. The protected `/gateway/v1` contract is exercised by local HTTP mock integration tests and remains disabled unless complete gateway configuration is supplied. No live CRM or production delivery has been verified.

| Document | Use |
| --- | --- |
| [OpenAPI](./openapi.yaml) | HTTP paths, request and response schemas, and error codes. |
| [Integration contract](./integration-contract.md) | Versioned source reads, protected scopes, delivery signature, retry and idempotency semantics. |
| [Privacy lifecycle](./privacy-lifecycle.md) | Purpose, consent, data minimization, withdrawal, deletion, and real-data launch gates. |
| [Architecture](./architecture.md) | Current service components and request flow. |
| [Review and pickup](./review-2026-09-29.md) | Earlier branch evidence and outstanding release requirements. |

The executable source and tests take precedence when a document is stale. A local mock pass proves the reference contract only. A real-data launch additionally needs a provider-specific mapping, authorized test records, deployed controls, durable delivery state, and deletion propagation evidence.
