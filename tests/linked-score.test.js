const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { Agent } = require("node:http");
const supertest = require("supertest");
const app = require("../src/app");
const { leads } = require("../src/data");

const agent = new Agent({ keepAlive: true });
const request = (server) => ({ get: (url) => supertest(server).get(url).agent(agent) });
let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

after(async () => {
  agent.destroy();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /api/leads/lead-001/score traces fixture inputs and score without contact details", async () => {
  const response = await request(server).get("/api/leads/lead-001/score");

  assert.equal(response.status, 200);
  assert.equal(response.body.leadId, "lead-001");
  assert.equal(response.body.accountId, "acct-analytics-002");
  assert.equal(response.body.modelVersion, "rules-v1");
  assert.deepEqual(response.body.provenance, {
    dataSource: "synthetic-fixture",
    leadId: "lead-001",
    accountId: "acct-analytics-002"
  });
  assert.deepEqual(response.body.inputs, {
    companySize: 620,
    annualRevenue: 94000000,
    engagementScore: 88,
    intentSignals: ["pricing-page", "webinar-attended", "case-study-download"]
  });
  assert.deepEqual(response.body.breakdown, {
    companySize: 23,
    annualRevenue: 16,
    engagement: 32,
    intentSignals: 18
  });
  assert.equal(response.body.result.score, 89);
  assert.equal(response.body.result.tier, "high-intent");
  assert.equal(Object.values(response.body.breakdown).reduce((sum, value) => sum + value, 0), response.body.result.score);
  assert.equal(JSON.stringify(response.body).includes("maya.patel@"), false);
  assert.equal(Object.hasOwn(response.body, "name"), false);
  assert.equal(Object.hasOwn(response.body, "email"), false);
});

test("linked score returns 404 for unknown lead", async () => {
  const response = await request(server).get("/api/leads/no-such-lead/score");
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "not_found");
});

test("linked score returns 404 for an orphaned lead rather than scoring partial inputs", async () => {
  leads.push({ id: "orphaned-lead", accountId: "missing", engagementScore: 88, intentSignals: [] });
  try {
    const response = await request(server).get("/api/leads/orphaned-lead/score");
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "not_found");
    assert.equal(Object.hasOwn(response.body, "score"), false);
  } finally {
    leads.pop();
  }
});
