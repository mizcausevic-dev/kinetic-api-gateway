const express = require("express");
const { SIGNAL_WEIGHTS, getCompanySizeScore, getRevenueScore, getEngagementScore, getIntentSignalScore, scoreLeadPayload } = require("../utils/scoring");
const { createAuthMiddleware, requireScope } = require("./auth");
const { createRateLimiter } = require("./rateLimit");
const { createGatewayStore } = require("./store");
const { GatewayError } = require("./errors");

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PURPOSE = "sales-prioritization";

function validId(id) {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    throw new GatewayError(400, "bad_request", "Invalid resource identifier.");
  }
  return id;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function publicStatus(record) {
  return {
    deliveryId: record.id,
    state: record.state,
    attempts: record.attempts,
    code: record.code,
    upstreamStatus: record.upstreamStatus
  };
}

function createGatewayRouter({ clients, sourceAdapter, deliveryAdapter, allowDelete = false, rateLimit = {}, now = Date.now } = {}) {
  if (!sourceAdapter || typeof sourceAdapter.getLead !== "function" || typeof sourceAdapter.getAccount !== "function" || typeof sourceAdapter.deleteLead !== "function") {
    throw new TypeError("A complete source adapter is required.");
  }
  if (!deliveryAdapter || typeof deliveryAdapter.send !== "function") {
    throw new TypeError("A delivery adapter is required.");
  }
  const router = express.Router();
  const store = createGatewayStore({ now });
  router.use(createAuthMiddleware(clients));
  router.use(createRateLimiter({ ...rateLimit, now }));

  async function linkedScore(req, leadId) {
    const tenantId = req.gatewayClient.tenantId;
    validId(leadId);
    if (store.isDeleted(tenantId, leadId)) {
      throw new GatewayError(410, "lead_deleted", "The lead has been deleted.");
    }
    const lead = await sourceAdapter.getLead(tenantId, leadId);
    if (!lead || lead.id !== leadId || lead.tenantId !== tenantId) {
      throw new GatewayError(404, "not_found", "Lead was not found.");
    }
    if (lead.deletedAt !== null) {
      store.suppress(tenantId, leadId);
      throw new GatewayError(410, "lead_deleted", "The lead has been deleted.");
    }
    const consent = lead.consent;
    const timestamp = now();
    if (!Number.isFinite(timestamp)) {
      throw new GatewayError(503, "clock_unavailable", "The gateway cannot validate consent time.");
    }
    if (!consent || consent.status !== "granted" || consent.purpose !== PURPOSE ||
      !isIsoDate(consent.recordedAt) || !isIsoDate(consent.expiresAt) ||
      Date.parse(consent.recordedAt) > timestamp || Date.parse(consent.expiresAt) <= timestamp) {
      throw new GatewayError(403, "consent_required", "Valid consent for scoring is required.");
    }
    validId(lead.accountId);
    const account = await sourceAdapter.getAccount(tenantId, lead.accountId);
    if (!account || account.id !== lead.accountId || account.tenantId !== tenantId) {
      throw new GatewayError(404, "not_found", "Linked account was not found.");
    }
    const inputs = {
      companySize: account.employees,
      annualRevenue: account.annualRevenue,
      engagementScore: lead.engagementScore,
      intentSignals: lead.intentSignals
    };
    if (!Number.isSafeInteger(inputs.companySize) || inputs.companySize < 0 ||
      !Number.isSafeInteger(inputs.annualRevenue) || inputs.annualRevenue < 0 ||
      !Number.isInteger(inputs.engagementScore) || inputs.engagementScore < 0 || inputs.engagementScore > 100 ||
      !Array.isArray(inputs.intentSignals) || inputs.intentSignals.length > 20 ||
      inputs.intentSignals.some((signal) => typeof signal !== "string" || !Object.hasOwn(SIGNAL_WEIGHTS, signal))) {
      throw new GatewayError(502, "upstream_invalid_response", "The configured source returned an invalid response.");
    }
    if (store.isDeleted(tenantId, leadId)) {
      throw new GatewayError(410, "lead_deleted", "The lead has been deleted.");
    }
    return {
      leadId, accountId: account.id, modelVersion: "rules-v1",
      provenance: { dataSource: "configured-http-source", tenantId, consentRecordedAt: consent.recordedAt },
      inputs,
      breakdown: {
        companySize: getCompanySizeScore(inputs.companySize),
        annualRevenue: getRevenueScore(inputs.annualRevenue),
        engagement: getEngagementScore(inputs.engagementScore),
        intentSignals: getIntentSignalScore(inputs.intentSignals)
      },
      result: scoreLeadPayload(inputs)
    };
  }

  router.get("/leads/:id/score", requireScope("scores:read"), async (req, res) => {
    res.json(await linkedScore(req, req.params.id));
  });

  router.post("/deliveries", requireScope("deliveries:write"), async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 || typeof req.body.leadId !== "string") {
      throw new GatewayError(400, "bad_request", "Body must contain only leadId.");
    }
    const leadId = validId(req.body.leadId);
    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey || !/^[A-Za-z0-9._-]{8,128}$/.test(idempotencyKey)) {
      throw new GatewayError(400, "bad_request", "A valid Idempotency-Key header is required.");
    }
    const score = await linkedScore(req, leadId);
    const { record, created } = store.reserve({
      tenantId: req.gatewayClient.tenantId,
      clientId: req.gatewayClient.id,
      leadId,
      idempotencyKey
    });
    if (!created) {
      return res.status(record.state === "pending" ? 202 : 200).json(publicStatus(record));
    }
    try {
      const event = {
        schemaVersion: "1", deliveryId: record.id, tenantId: req.gatewayClient.tenantId,
        leadId, accountId: score.accountId, score: score.result.score,
        tier: score.result.tier, modelVersion: score.modelVersion,
        occurredAt: new Date(now()).toISOString()
      };
      let result;
      try {
        result = await deliveryAdapter.send(event, record.id);
      } catch {
        result = { delivered: false, attempts: 1, statusCode: null, code: "delivery_unavailable" };
      }
      store.update(record.id, result);
      if (!result.delivered) {
        return res.status(502).json({
          error: { code: "delivery_failed", message: "Delivery was not acknowledged." },
          deliveryId: record.id
        });
      }
      return res.status(201).json({ deliveryId: record.id, state: "delivered", attempts: result.attempts });
    } finally {
      store.release(record.id);
    }
  });

  router.get("/deliveries/:id", requireScope("deliveries:read"), (req, res) => {
    const record = store.get(validId(req.params.id), req.gatewayClient.tenantId, req.gatewayClient.id);
    if (!record) throw new GatewayError(404, "not_found", "Delivery was not found.");
    res.json(publicStatus(record));
  });

  router.delete("/leads/:id", requireScope("leads:delete"), async (req, res) => {
    if (!allowDelete) throw new GatewayError(403, "deletion_disabled", "Deletion is not enabled.");
    const leadId = validId(req.params.id);
    const tenantId = req.gatewayClient.tenantId;
    store.suppress(tenantId, leadId);
    const deleted = await sourceAdapter.deleteLead(tenantId, leadId);
    if (!deleted) throw new GatewayError(404, "not_found", "Lead was not found.");
    res.status(204).end();
  });

  return router;
}

module.exports = { createGatewayRouter };
