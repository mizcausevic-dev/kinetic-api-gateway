const { GatewayError } = require("./errors");

function validateEndpoint(raw, { allowHttpLocal = false } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Gateway endpoint URL is invalid.");
  }
  const isLocalHttp = allowHttpLocal && url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password || url.search || url.hash) {
    throw new Error("Gateway endpoint must be an HTTPS URL without credentials, query, or fragment.");
  }

  return url;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    return await fetch(url, { ...options, redirect: "error", signal });
  } catch (error) {
    if (signal.aborted) {
      throw new GatewayError(504, "upstream_timeout", "The configured service timed out.");
    }
    throw new GatewayError(502, "upstream_unavailable", "The configured service is unavailable.");
  }
}

async function readJsonLimited(response, maxBytes = 65536) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get("content-type") || "")) {
    await response.body?.cancel();
    throw new GatewayError(502, "upstream_invalid_response", "The configured service returned an invalid response.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new GatewayError(502, "upstream_invalid_response", "The configured service returned an invalid response.");
  }
  const chunks = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        throw new GatewayError(502, "upstream_invalid_response", "The configured service returned an invalid response.");
      }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof GatewayError) throw error;
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new GatewayError(504, "upstream_timeout", "The configured service timed out.");
    }
    throw new GatewayError(502, "upstream_invalid_response", "The configured service returned an invalid response.");
  } finally {
    reader.releaseLock();
  }
}

module.exports = { validateEndpoint, fetchWithTimeout, readJsonLimited };
