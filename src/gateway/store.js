const { createHash, randomUUID } = require("node:crypto");
const { GatewayError } = require("./errors");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createGatewayStore({ now = Date.now, maxEntries = 1000, ttlMs = 86_400_000 } = {}) {
  const deliveries = new Map();
  const idempotency = new Map();
  const tombstones = new Set();
  const inFlightByLead = new Map();
  const activeDeliveries = new Map();

  function purgeExpired() {
    for (const [id, record] of deliveries) {
      if (!activeDeliveries.has(id) && now() - record.createdAt >= ttlMs) {
        deliveries.delete(id);
        idempotency.delete(record.keyHash);
      }
    }
  }

  function leadKey(tenantId, leadId) {
    return digest(JSON.stringify([tenantId, leadId]));
  }

  function isDeleted(tenantId, leadId) {
    return tombstones.has(leadKey(tenantId, leadId));
  }

  function suppress(tenantId, leadId) {
    const key = leadKey(tenantId, leadId);
    if (inFlightByLead.has(key)) {
      throw new GatewayError(409, "delivery_in_progress", "A delivery is in progress for this lead.");
    }
    if (!tombstones.has(key) && tombstones.size >= maxEntries) {
      throw new GatewayError(503, "store_full", "The gateway cannot safely accept more deletions.");
    }
    tombstones.add(key);
    for (const [id, record] of deliveries) {
      if (record.leadHash === key) {
        deliveries.delete(id);
        idempotency.delete(record.keyHash);
      }
    }
  }

  function reserve({ tenantId, clientId, leadId, idempotencyKey }) {
    purgeExpired();
    if (isDeleted(tenantId, leadId)) {
      throw new GatewayError(410, "lead_deleted", "The lead has been deleted.");
    }
    const keyHash = digest(JSON.stringify([tenantId, clientId, idempotencyKey]));
    const existingId = idempotency.get(keyHash);
    if (existingId) {
      const existing = deliveries.get(existingId);
      if (existing.leadHash !== leadKey(tenantId, leadId)) {
        throw new GatewayError(409, "idempotency_conflict", "This idempotency key was used for another lead.");
      }
      return { record: existing, created: false };
    }
    if (deliveries.size >= maxEntries) {
      throw new GatewayError(503, "store_full", "The gateway cannot safely accept more deliveries.");
    }
    const record = {
      id: randomUUID(), tenantId, clientId, leadHash: leadKey(tenantId, leadId), keyHash,
      state: "pending", attempts: 0, code: null, upstreamStatus: null, createdAt: now()
    };
    deliveries.set(record.id, record);
    idempotency.set(keyHash, record.id);
    activeDeliveries.set(record.id, record.leadHash);
    inFlightByLead.set(record.leadHash, (inFlightByLead.get(record.leadHash) || 0) + 1);
    return { record, created: true };
  }

  function release(id) {
    const key = activeDeliveries.get(id);
    if (!key) return;
    activeDeliveries.delete(id);
    const remaining = inFlightByLead.get(key) - 1;
    if (remaining > 0) inFlightByLead.set(key, remaining);
    else inFlightByLead.delete(key);
  }

  function update(id, result) {
    const record = deliveries.get(id);
    if (!record) return null;
    record.state = result.delivered ? "delivered" : "failed";
    record.attempts = result.attempts;
    record.code = result.delivered ? null : result.code;
    record.upstreamStatus = result.statusCode;
    return record;
  }

  function get(id, tenantId, clientId) {
    purgeExpired();
    const record = deliveries.get(id);
    return record?.tenantId === tenantId && record?.clientId === clientId ? record : null;
  }

  return { reserve, update, get, suppress, isDeleted, release };
}

module.exports = { createGatewayStore };
