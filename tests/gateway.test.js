const { createHash, createHmac } = require("node:crypto");
const http = require("node:http");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { createHttpDeliveryAdapter } = require("../src/gateway/delivery");
const { createHttpSourceAdapter } = require("../src/gateway/source");
const { GatewayError } = require("../src/gateway/errors");

const clock = Date.parse("2026-09-29T12:00:00.000Z");
const tokenA = "synthetic-gateway-client-a";
const tokenA2 = "synthetic-gateway-client-a-2";
const tokenB = "synthetic-gateway-client-b";
const tokenLimited = "synthetic-gateway-client-limited";
const fullScopes = ["scores:read", "deliveries:write", "deliveries:read", "leads:delete"];
const hash = (token) => createHash("sha256").update(token).digest("hex");
const clients = [
  { id: "client-a", tenantId: "tenant-a", tokenHash: hash(tokenA), scopes: fullScopes },
  { id: "client-a-2", tenantId: "tenant-a", tokenHash: hash(tokenA2), scopes: fullScopes },
  { id: "client-b", tenantId: "tenant-b", tokenHash: hash(tokenB), scopes: fullScopes },
  { id: "client-limited", tenantId: "tenant-a", tokenHash: hash(tokenLimited), scopes: ["deliveries:read"] }
];

function lead(id, tenantId, accountId) {
  return {
    id, tenantId, accountId,
    name: "PRIVATE_NAME_CANARY",
    email: "private@example.test",
    engagementScore: 88,
    intentSignals: ["pricing-page", "webinar-attended", "case-study-download"],
    consent: {
      status: "granted",
      purpose: "sales-prioritization",
      recordedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    },
    deletedAt: null
  };
}

function createSource() {
  const leads = new Map([
    ["tenant-a:lead-001", lead("lead-001", "tenant-a", "acct-001")],
    ["tenant-a:lead-002", lead("lead-002", "tenant-a", "acct-001")],
    ["tenant-b:lead-003", lead("lead-003", "tenant-b", "acct-003")]
  ]);
  const accounts = new Map([
    ["tenant-a:acct-001", { id: "acct-001", tenantId: "tenant-a", employees: 620, annualRevenue: 94000000 }],
    ["tenant-b:acct-003", { id: "acct-003", tenantId: "tenant-b", employees: 620, annualRevenue: 94000000 }]
  ]);
  const calls = [];
  return {
    leads, accounts, calls,
    async getLead(tenantId, id) {
      calls.push(["getLead", tenantId, id]);
      return leads.get(`${tenantId}:${id}`) || null;
    },
    async getAccount(tenantId, id) {
      calls.push(["getAccount", tenantId, id]);
      return accounts.get(`${tenantId}:${id}`) || null;
    },
    async deleteLead(tenantId, id) {
      calls.push(["deleteLead", tenantId, id]);
      return leads.delete(`${tenantId}:${id}`);
    }
  };
}

function makeGateway({ sourceAdapter = createSource(), deliveryAdapter, ...options } = {}) {
  return {
    clients,
    sourceAdapter,
    deliveryAdapter: deliveryAdapter || { send: async () => ({ delivered: true, attempts: 1, statusCode: 202 }) },
    now: () => clock,
    logger: () => {},
    ...options
  };
}

async function withApp(gateway, run) {
  const app = createApp({ gateway, logger: gateway?.logger || (() => {}) });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const agent = new http.Agent({ keepAlive: true });
  const api = {
    get: (path) => request(server).get(path).agent(agent),
    post: (path) => request(server).post(path).agent(agent),
    delete: (path) => request(server).delete(path).agent(agent)
  };
  try {
    await run(api);
  } finally {
    agent.destroy();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function postDelivery(api, token, leadId, key = "synthetic-idempotency-001") {
  return api.post("/gateway/v1/deliveries")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ leadId });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("protected gateway is disabled without configuration", async () => {
  await withApp(null, async (api) => {
    const response = await api.get("/gateway/v1/leads/lead-001/score");
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, "gateway_disabled");
  });
});

test("delivery adapter rejects a weak signing secret before sending", () => {
  assert.throws(() => createHttpDeliveryAdapter({
    url: "https://delivery.example.test/events",
    secret: "short"
  }), /32/);
});

test("authentication, scopes, and tenant-bound source lookups fail closed", async () => {
  const sourceAdapter = createSource();
  await withApp(makeGateway({ sourceAdapter }), async (api) => {
    const missing = await api.get("/gateway/v1/leads/lead-001/score");
    const invalid = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", "Bearer wrong");
    const limited = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenLimited}`);
    const foreign = await api.get("/gateway/v1/leads/lead-001/score")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Tenant-Id", "tenant-a");
    const own = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
    assert.equal(limited.status, 403);
    assert.equal(foreign.status, 404);
    assert.equal(own.status, 200);
    assert.equal(own.body.leadId, "lead-001");
    assert.equal(own.body.accountId, "acct-001");
    assert.equal(own.body.result.score, 89);
    assert.equal(own.body.provenance.tenantId, "tenant-a");
    assert.equal(JSON.stringify(own.body).includes("PRIVATE_NAME_CANARY"), false);
    assert.equal(JSON.stringify(own.body).includes("private@example.test"), false);
    assert.ok(sourceAdapter.calls.some((call) => call[0] === "getLead" && call[1] === "tenant-b" && call[2] === "lead-001"));
  });
});

test("revoked, wrong-purpose, future, and expired consent prevent score and delivery", async () => {
  const changes = [
    (record) => { record.consent.status = "revoked"; },
    (record) => { record.consent.purpose = "newsletter"; },
    (record) => { record.consent.recordedAt = "2027-01-01T00:00:00.000Z"; },
    (record) => { record.consent.expiresAt = "2026-01-01T00:00:00.000Z"; }
  ];
  for (const change of changes) {
    const sourceAdapter = createSource();
    change(sourceAdapter.leads.get("tenant-a:lead-001"));
    let sends = 0;
    const deliveryAdapter = { send: async () => { sends += 1; return { delivered: true, attempts: 1, statusCode: 202 }; } };
    await withApp(makeGateway({ sourceAdapter, deliveryAdapter }), async (api) => {
      const score = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);
      const delivery = await postDelivery(api, tokenA, "lead-001");
      assert.equal(score.status, 403);
      assert.equal(score.body.error.code, "consent_required");
      assert.equal(delivery.status, 403);
      assert.equal(sends, 0);
    });
  }
});

test("deletion suppresses scoring and delivery and invokes tenant-bound upstream deletion", async () => {
  const sourceAdapter = createSource();
  let sends = 0;
  await withApp(makeGateway({ sourceAdapter, allowDelete: true,
    deliveryAdapter: { send: async () => { sends += 1; return { delivered: true, attempts: 1, statusCode: 202 }; } }
  }), async (api) => {
    const deletion = await api.delete("/gateway/v1/leads/lead-001").set("Authorization", `Bearer ${tokenA}`);
    const score = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);
    const delivery = await postDelivery(api, tokenA, "lead-001");
    assert.equal(deletion.status, 204);
    assert.equal(score.status, 410);
    assert.equal(delivery.status, 410);
    assert.equal(sends, 0);
    assert.ok(sourceAdapter.calls.some((call) => JSON.stringify(call) === JSON.stringify(["deleteLead", "tenant-a", "lead-001"])));
  });
});

test("DELETE refuses an in-flight delivery, then succeeds after delivery settles", { timeout: 10_000 }, async () => {
  const sourceAdapter = createSource();
  const sendStarted = deferred();
  const finishSend = deferred();
  const deliveryAdapter = { send: async () => {
    sendStarted.resolve();
    await finishSend.promise;
    return { delivered: true, attempts: 1, statusCode: 202 };
  } };
  await withApp(makeGateway({ sourceAdapter, deliveryAdapter, allowDelete: true }), async (api) => {
    const delivering = postDelivery(api, tokenA, "lead-001").then((response) => response);
    try {
      await sendStarted.promise;
      const during = await api.delete("/gateway/v1/leads/lead-001").set("Authorization", `Bearer ${tokenA}`);
      assert.equal(during.status, 409);
      assert.equal(during.body.error.code, "delivery_in_progress");
      assert.equal(sourceAdapter.calls.some((call) => call[0] === "deleteLead"), false);
    } finally {
      finishSend.resolve();
    }
    const delivered = await delivering;
    assert.equal(delivered.status, 201);
    const deletion = await api.delete("/gateway/v1/leads/lead-001").set("Authorization", `Bearer ${tokenA}`);
    assert.equal(deletion.status, 204);
    assert.ok(sourceAdapter.calls.some((call) => call[0] === "deleteLead" && call[1] === "tenant-a"));
  });
});

test("deletion suppression wins before a new delivery and prevents sending", { timeout: 10_000 }, async () => {
  const sourceAdapter = createSource();
  const deleteStarted = deferred();
  const finishDelete = deferred();
  const originalDelete = sourceAdapter.deleteLead.bind(sourceAdapter);
  sourceAdapter.deleteLead = async (tenantId, id) => {
    deleteStarted.resolve();
    await finishDelete.promise;
    return originalDelete(tenantId, id);
  };
  let sends = 0;
  const deliveryAdapter = { send: async () => {
    sends += 1;
    return { delivered: true, attempts: 1, statusCode: 202 };
  } };
  await withApp(makeGateway({ sourceAdapter, deliveryAdapter, allowDelete: true }), async (api) => {
    const deleting = api.delete("/gateway/v1/leads/lead-001")
      .set("Authorization", `Bearer ${tokenA}`).then((response) => response);
    try {
      await deleteStarted.promise;
      const score = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);
      const delivery = await postDelivery(api, tokenA, "lead-001");
      assert.equal(score.status, 410);
      assert.equal(delivery.status, 410);
      assert.equal(sends, 0);
    } finally {
      finishDelete.resolve();
    }
    const deleted = await deleting;
    assert.equal(deleted.status, 204);
  });
});

test("rate limit is per authenticated client and tenant, with a reset and Retry-After", async () => {
  let now = clock;
  await withApp(makeGateway({ now: () => now, rateLimit: { max: 2, windowMs: 10_000 } }), async (api) => {
    const get = (token, id) => api.get(`/gateway/v1/leads/${id}/score`).set("Authorization", `Bearer ${token}`);
    assert.equal((await get(tokenA, "lead-001")).status, 200);
    assert.equal((await get(tokenA, "lead-001")).status, 200);
    const blocked = await get(tokenA, "lead-001");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers["retry-after"], "10");
    assert.equal((await get(tokenB, "lead-003")).status, 200);
    now += 10_000;
    assert.equal((await get(tokenA, "lead-001")).status, 200);
  });
});

test("delivery is idempotent and status is private to the tenant and client", async () => {
  const sent = [];
  await withApp(makeGateway({ deliveryAdapter: { send: async (event, key) => {
    sent.push({ event, key });
    return { delivered: true, attempts: 1, statusCode: 202 };
  } } }), async (api) => {
    const first = await postDelivery(api, tokenA, "lead-001");
    const replay = await postDelivery(api, tokenA, "lead-001");
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(first.body.deliveryId, replay.body.deliveryId);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].event.tenantId, "tenant-a");
    assert.equal(sent[0].event.score, 89);
    assert.equal(JSON.stringify(sent).includes("PRIVATE_NAME_CANARY"), false);
    assert.equal(JSON.stringify(sent).includes("private@example.test"), false);
    const status = await api.get(`/gateway/v1/deliveries/${first.body.deliveryId}`).set("Authorization", `Bearer ${tokenA}`);
    assert.equal(status.status, 200);
    assert.equal(status.body.state, "delivered");
    const foreignTenant = await api.get(`/gateway/v1/deliveries/${first.body.deliveryId}`).set("Authorization", `Bearer ${tokenB}`);
    const foreignClient = await api.get(`/gateway/v1/deliveries/${first.body.deliveryId}`).set("Authorization", `Bearer ${tokenA2}`);
    assert.equal(foreignTenant.status, 404);
    assert.equal(foreignClient.status, 404);
    const conflict = await postDelivery(api, tokenA, "lead-002");
    assert.equal(conflict.status, 409);
    assert.equal(sent.length, 1);
  });
});

test("failed delivery is reported as failure and remains observable without a second send", async () => {
  let sends = 0;
  await withApp(makeGateway({ deliveryAdapter: { send: async () => {
    sends += 1;
    return { delivered: false, attempts: 3, statusCode: 503, code: "delivery_failed" };
  } } }), async (api) => {
    const first = await postDelivery(api, tokenA, "lead-001");
    assert.equal(first.status, 502);
    assert.equal(first.body.error.code, "delivery_failed");
    assert.ok(first.body.deliveryId);
    const status = await api.get(`/gateway/v1/deliveries/${first.body.deliveryId}`).set("Authorization", `Bearer ${tokenA}`);
    assert.equal(status.status, 200);
    assert.deepEqual({ state: status.body.state, attempts: status.body.attempts, upstreamStatus: status.body.upstreamStatus },
      { state: "failed", attempts: 3, upstreamStatus: 503 });
    const replay = await postDelivery(api, tokenA, "lead-001");
    assert.equal(replay.status, 200);
    assert.equal(replay.body.state, "failed");
    assert.equal(sends, 1);
  });
});

test("source timeout does not produce a score or delivery event", async () => {
  const sourceAdapter = createSource();
  sourceAdapter.getLead = async () => { throw new GatewayError(504, "upstream_timeout", "The configured source timed out."); };
  let sends = 0;
  await withApp(makeGateway({ sourceAdapter, deliveryAdapter: { send: async () => { sends += 1; } } }), async (api) => {
    const score = await api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);
    const delivery = await postDelivery(api, tokenA, "lead-001");
    assert.equal(score.status, 504);
    assert.equal(delivery.status, 504);
    assert.equal(sends, 0);
  });
});

test("real local delivery adapter retries 5xx and never forwards inbound credentials or contact data", async () => {
  const received = [];
  const upstream = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ headers: req.headers, body });
    res.writeHead(received.length < 3 ? 503 : 202).end();
  });
  upstream.listen(0, "127.0.0.1");
  await new Promise((resolve) => upstream.once("listening", resolve));
  try {
    const port = upstream.address().port;
    const deliveryAdapter = createHttpDeliveryAdapter({
      url: `http://127.0.0.1:${port}/deliver`,
      secret: "synthetic-signing-secret-for-tests",
      allowHttpLocal: true,
      timeoutMs: 500,
      maxAttempts: 3,
      now: () => clock
    });
    await withApp(makeGateway({ deliveryAdapter }), async (api) => {
      const response = await postDelivery(api, tokenA, "lead-001", "synthetic-retry-key-001");
      assert.equal(response.status, 201);
      assert.equal(response.body.attempts, 3);
      assert.equal(received.length, 3);
      for (const item of received) {
        assert.equal(item.headers.authorization, undefined);
        assert.equal(item.headers["idempotency-key"], response.body.deliveryId);
        const expectedSignature = createHmac("sha256", "synthetic-signing-secret-for-tests")
          .update(`${item.headers["x-kinetic-timestamp"]}.${item.body}`)
          .digest("hex");
        assert.equal(item.headers["x-kinetic-signature"], `sha256=${expectedSignature}`);
        assert.equal(item.body.includes(tokenA), false);
        assert.equal(item.body.includes("PRIVATE_NAME_CANARY"), false);
        assert.equal(item.body.includes("private@example.test"), false);
      }
      const replay = await postDelivery(api, tokenA, "lead-001", "synthetic-retry-key-001");
      assert.equal(replay.status, 200);
      assert.equal(received.length, 3);
    });
  } finally {
    await new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP source adapter uses fixed tenant paths and its own credential, then handles retry, malformed JSON, and timeout", async () => {
  const received = [];
  let mode = "retry";
  let leadAttempts = 0;
  const upstream = http.createServer((req, res) => {
    received.push({ url: req.url, authorization: req.headers.authorization });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/tenants/tenant-a/leads/lead-001") {
      leadAttempts += 1;
      if (mode === "retry" && leadAttempts === 1) return res.writeHead(503).end("{}");
      if (mode === "malformed") return res.end("{not-json");
      if (mode === "timeout") return setTimeout(() => res.end(JSON.stringify(lead("lead-001", "tenant-a", "acct-001"))), 200);
      return res.end(JSON.stringify(lead("lead-001", "tenant-a", "acct-001")));
    }
    if (req.url === "/v1/tenants/tenant-a/accounts/acct-001") {
      return res.end(JSON.stringify({ id: "acct-001", tenantId: "tenant-a", employees: 620, annualRevenue: 94000000 }));
    }
    return res.writeHead(404).end("{}");
  });
  upstream.listen(0, "127.0.0.1");
  await new Promise((resolve) => upstream.once("listening", resolve));
  try {
    const port = upstream.address().port;
    const sourceAdapter = createHttpSourceAdapter({
      baseUrl: `http://127.0.0.1:${port}/`,
      token: "synthetic-source-only-credential",
      timeoutMs: 100,
      allowHttpLocal: true
    });
    await withApp(makeGateway({ sourceAdapter }), async (api) => {
      const getScore = () => api.get("/gateway/v1/leads/lead-001/score").set("Authorization", `Bearer ${tokenA}`);
      const success = await getScore();
      assert.equal(success.status, 200);
      assert.equal(success.body.result.score, 89);
      assert.equal(leadAttempts, 2);
      assert.deepEqual(received.map((item) => item.url), [
        "/v1/tenants/tenant-a/leads/lead-001",
        "/v1/tenants/tenant-a/leads/lead-001",
        "/v1/tenants/tenant-a/accounts/acct-001"
      ]);
      assert.ok(received.every((item) => item.authorization === "Bearer synthetic-source-only-credential"));
      assert.equal(JSON.stringify(received).includes(tokenA), false);

      mode = "malformed";
      const malformed = await getScore();
      assert.equal(malformed.status, 502);
      assert.equal(malformed.body.error.code, "upstream_invalid_response");

      mode = "timeout";
      const timeout = await getScore();
      assert.equal(timeout.status, 504);
      assert.equal(timeout.body.error.code, "upstream_timeout");
    });
  } finally {
    await new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
});

test("gateway rejects JSON bodies beyond 16 KB before delivery", async () => {
  let sends = 0;
  await withApp(makeGateway({ deliveryAdapter: { send: async () => { sends += 1; } } }), async (api) => {
    const response = await api.post("/gateway/v1/deliveries")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", "synthetic-large-body-001")
      .send({ leadId: "lead-001", padding: "X".repeat(20_000) });
    assert.equal(response.status, 413);
    assert.equal(response.body.error.code, "payload_too_large");
    assert.equal(sends, 0);
  });
});

test("logs and 404 responses omit URL, query, body, bearer token, and contact canaries", async () => {
  const records = [];
  await withApp(makeGateway({ logger: (record) => records.push(record) }), async (api) => {
    const response = await api.post("/gateway/v1/unknown?token=SECRET_QUERY_CANARY&email=private@example.test")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "BODY_NAME_CANARY" });
    assert.equal(response.status, 404);
    const evidence = JSON.stringify({ response: response.body, logs: records });
    for (const secret of ["SECRET_QUERY_CANARY", "private@example.test", "BODY_NAME_CANARY", tokenA]) {
      assert.equal(evidence.includes(secret), false, secret);
    }
    assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });
});
