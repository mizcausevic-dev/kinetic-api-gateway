const { GatewayError } = require("./errors");
const { validateEndpoint, fetchWithTimeout, readJsonLimited } = require("./http");

function createHttpSourceAdapter({ baseUrl, token, timeoutMs = 2000, allowHttpLocal = false }) {
  const endpoint = validateEndpoint(baseUrl, { allowHttpLocal });
  if (!token || typeof token !== "string") throw new Error("Gateway source credential is required.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    throw new Error("Gateway source timeout must be between 100 and 10000 ms.");
  }
  endpoint.pathname = endpoint.pathname.replace(/\/?$/, "/");

  async function requestResource(method, tenantId, resource, id) {
    if (![tenantId, id].every((value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value))) {
      throw new GatewayError(400, "bad_request", "Invalid resource identifier.");
    }
    const path = `v1/tenants/${encodeURIComponent(tenantId)}/${resource}/${encodeURIComponent(id)}`;
    const url = new URL(path, endpoint);
    const attempts = method === "GET" ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let response;
      try {
        response = await fetchWithTimeout(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
        }, timeoutMs);
      } catch (error) {
        if (attempt < attempts && error instanceof GatewayError) continue;
        throw error;
      }

      if (response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        return null;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new GatewayError(502, "upstream_unavailable", "The configured source could not complete the request.");
      }
      if (method === "DELETE") {
        await response.body?.cancel();
        return true;
      }
      return readJsonLimited(response);
    }

    throw new GatewayError(502, "upstream_unavailable", "The configured source could not complete the request.");
  }

  return {
    getLead: (tenantId, id) => requestResource("GET", tenantId, "leads", id),
    getAccount: (tenantId, id) => requestResource("GET", tenantId, "accounts", id),
    deleteLead: (tenantId, id) => requestResource("DELETE", tenantId, "leads", id)
  };
}

module.exports = { createHttpSourceAdapter };
