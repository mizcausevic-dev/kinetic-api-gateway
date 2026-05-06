const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");

test("GET /health returns 200 and service metadata", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.service, "Kinetic API Gateway");
  assert.equal(response.body.status, "ok");
});

test("GET /api/leads returns 200 and an array", async () => {
  const response = await request(app).get("/api/leads");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 1);
});

test("GET /api/accounts returns 200 and an array", async () => {
  const response = await request(app).get("/api/accounts");

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

  const response = await request(app).post("/api/score").send(payload);

  assert.equal(response.status, 200);
  assert.equal(response.body.score, 94);
  assert.equal(response.body.tier, "high-intent");
  assert.equal(
    response.body.recommendedNextAction,
    "Route to sales within 24 hours with enterprise web platform modernization message."
  );
});
