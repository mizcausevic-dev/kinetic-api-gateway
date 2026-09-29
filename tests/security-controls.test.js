const { createHash } = require("node:crypto");
const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { Agent } = require("node:http");
const express = require("express");
const supertest = require("supertest");
const { createAuthMiddleware, requireScope } = require("../src/gateway/auth");
const { createRateLimiter } = require("../src/gateway/rateLimit");
const { requestLog } = require("../src/middleware/requestLog");

const agent = new Agent({ keepAlive: true });
const request = (app) => ({ get: (url) => supertest(app).get(url).agent(agent) });
after(() => agent.destroy());

const tokenA = "synthetic-test-token-a";
const tokenB = "synthetic-test-token-b";
const digest = (token) => createHash("sha256").update(token).digest("hex");
const clients = [
  { id: "client-a", tenantId: "tenant-a", tokenHash: digest(tokenA), scopes: ["leads:read"] },
  { id: "client-b", tenantId: "tenant-b", tokenHash: digest(tokenB), scopes: ["score:write"] }
];

function makeApp({ now, max = 2, logger = () => {} } = {}) {
  const app = express();
  app.use(requestLog({ logger }));
  app.use(createAuthMiddleware(clients));
  app.use(createRateLimiter({ windowMs: 10_000, max, now: now || Date.now }));
  app.get("/api/leads/:id", requireScope("leads:read"), (req, res) => {
    res.json({ clientId: req.gatewayClient.id, tenantId: req.gatewayClient.tenantId });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.statusCode || 500).json({ error: { code: error.code || "internal_error", message: error.message } });
  });
  return app;
}

test("authentication fails closed for missing and invalid bearer tokens", async () => {
  const app = makeApp();
  for (const authorization of [undefined, "Basic abc", "Bearer wrong", "Bearer a b"]) {
    const operation = request(app).get("/api/leads/lead-1");
    if (authorization) operation.set("Authorization", authorization);
    const response = await operation;
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "unauthorized");
    assert.equal(response.headers["www-authenticate"], "Bearer");
  }
});

test("client identity and tenant come from configured token, not a request header", async () => {
  const response = await request(makeApp())
    .get("/api/leads/lead-1")
    .set("Authorization", `Bearer ${tokenA}`)
    .set("X-Tenant-Id", "tenant-b");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { clientId: "client-a", tenantId: "tenant-a" });
});

test("scope enforcement denies a valid token lacking the required scope", async () => {
  const response = await request(makeApp())
    .get("/api/leads/lead-1")
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "forbidden");
});

test("invalid auth configuration fails before accepting traffic", () => {
  assert.throws(() => createAuthMiddleware([{ ...clients[0], tokenHash: "bad" }]), /SHA-256/);
  assert.throws(() => createAuthMiddleware([clients[0], { ...clients[0], id: "duplicate" }]), /unique/);
  assert.throws(() => requireScope(""), /non-empty/);
});

test("rate limit is isolated by configured client and tenant and returns Retry-After", async () => {
  let clock = 1_000;
  const app = makeApp({ now: () => clock, max: 1 });
  const first = await request(app).get("/api/leads/lead-1").set("Authorization", `Bearer ${tokenA}`);
  const blocked = await request(app).get("/api/leads/lead-1").set("Authorization", `Bearer ${tokenA}`);
  const otherClient = await request(app).get("/api/leads/lead-1").set("Authorization", `Bearer ${tokenB}`);

  assert.equal(first.status, 200);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers["retry-after"], "10");
  assert.equal(blocked.body.error.code, "rate_limited");
  assert.equal(otherClient.status, 403);

  clock += 10_000;
  const afterReset = await request(app).get("/api/leads/lead-1").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(afterReset.status, 200);
});

test("request logs and request IDs never include query, body, token, or spoofed ID", async () => {
  const records = [];
  const app = makeApp({ logger: (record) => records.push(record) });
  const response = await request(app)
    .get("/api/leads/lead-1?token=SECRET_CANARY&email=person@example.test")
    .set("Authorization", `Bearer ${tokenA}`)
    .set("X-Request-Id", "spoofed-id")
    .send({ privateField: "BODY_CANARY" });

  assert.equal(response.status, 200);
  assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  assert.notEqual(response.headers["x-request-id"], "spoofed-id");
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), ["durationMs", "method", "requestId", "route", "status"]);
  assert.equal(records[0].route, "/api/leads/:id");
  const serialized = JSON.stringify(records[0]);
  for (const sensitive of ["SECRET_CANARY", "person@example.test", tokenA, "BODY_CANARY", "spoofed-id", "lead-1"]) {
    assert.equal(serialized.includes(sensitive), false, sensitive);
  }
});

test("throwing log sink leaves the response intact and writes only a generic fallback", async () => {
  const captured = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = (chunk) => { captured.push(String(chunk)); return true; };
  try {
    const app = makeApp({ logger: () => { throw new Error("PRIVATE_LOG_SINK_CANARY"); } });
    const response = await request(app)
      .get("/api/leads/lead-1?email=private%40example.test")
      .set("Authorization", `Bearer ${tokenA}`);

    assert.equal(response.status, 200);
    assert.deepEqual(captured, ["Safe request log sink failed.\n"]);
    assert.equal(captured.join("").includes("PRIVATE_LOG_SINK_CANARY"), false);
    assert.equal(captured.join("").includes("private@example.test"), false);
  } finally {
    process.stderr.write = originalWrite;
  }
});
