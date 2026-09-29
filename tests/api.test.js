const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
const { errorHandler } = require("../src/middleware/errorHandler");

let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /health returns 200 and service metadata", async () => {
  const response = await request(server).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.service, "Kinetic API Gateway");
  assert.equal(response.body.status, "ok");
});

test("GET /api/leads returns 200 and an array", async () => {
  const response = await request(server).get("/api/leads");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 1);
});

test("GET /api/accounts returns 200 and an array", async () => {
  const response = await request(server).get("/api/accounts");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 1);
});

test("POST /api/score returns score and tier", async () => {
  const payload = {
    companySize: 850,
    annualRevenue: 128000000,
    engagementScore: 91,
    intentSignals: ["pricing-page", "webinar-attended", "case-study-download"]
  };

  const response = await request(server).post("/api/score").send(payload);

  assert.equal(response.status, 200);
  assert.equal(response.body.score, 94);
  assert.equal(response.body.tier, "high-intent");
  assert.equal(
    response.body.recommendedNextAction,
    "Route to sales within 24 hours with an account-specific outreach plan."
  );
});

test("GET /api/leads/:id returns a clear 404 for an unknown lead", async () => {
  const response = await request(server).get("/api/leads/does-not-exist");

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "not_found");
});

test("GET /api/campaigns returns the synthetic campaign list", async () => {
  const response = await request(server).get("/api/campaigns");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 1);
});

test("POST /api/score rejects missing and malformed JSON without exposing parser details", async () => {
  const missing = await request(server).post("/api/score");
  const nonJson = await request(server).post("/api/score").set("Content-Type", "text/plain").send("hello");
  const malformed = await request(server)
    .post("/api/score")
    .set("Content-Type", "application/json")
    .send('{"companySize":');

  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, "bad_request");
  assert.equal(nonJson.status, 400);
  assert.equal(nonJson.body.error.code, "bad_request");
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, {
    error: { code: "bad_request", message: "Request body must contain valid JSON." }
  });
});

test("POST /api/score rejects invalid ranges and inherited signal names", async () => {
  const valid = { companySize: 850, annualRevenue: 128000000, engagementScore: 91, intentSignals: [] };
  const invalidPayloads = [
    { ...valid, companySize: -1 },
    { ...valid, annualRevenue: -1 },
    { ...valid, companySize: 1.5 },
    { ...valid, annualRevenue: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, engagementScore: 101 },
    { ...valid, intentSignals: ["__proto__"] },
    { ...valid, intentSignals: Array(21).fill("pricing-page") }
  ];

  for (const payload of invalidPayloads) {
    const response = await request(server).post("/api/score").send(payload);
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(response.body.error.code, "bad_request");
  }
});

test("POST /api/score accepts documented boundary values", async () => {
  const low = await request(server).post("/api/score").send({
    companySize: 0,
    annualRevenue: 0,
    engagementScore: 0,
    intentSignals: []
  });
  const high = await request(server).post("/api/score").send({
    companySize: 500,
    annualRevenue: 100000000,
    engagementScore: 100,
    intentSignals: ["pricing-page", "demo-request", "webinar-attended", "case-study-download"]
  });

  assert.equal(low.status, 200);
  assert.equal(low.body.score, 0);
  assert.equal(low.body.tier, "cold");
  assert.equal(high.status, 200);
  assert.equal(high.body.score, 100);
  assert.equal(high.body.tier, "high-intent");
});

test("unexpected server errors do not expose internal messages or codes", () => {
  let status;
  let body;
  const response = {
    headersSent: false,
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    }
  };

  errorHandler(Object.assign(new Error("sensitive internal detail"), { code: "INTERNAL_DETAIL" }), {}, response, () => {});

  assert.equal(status, 500);
  assert.deepEqual(body, {
    error: { code: "internal_error", message: "An unexpected error occurred." }
  });
});
