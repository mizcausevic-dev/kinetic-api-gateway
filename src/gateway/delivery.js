const { createHmac } = require("node:crypto");
const { GatewayError } = require("./errors");
const { validateEndpoint, fetchWithTimeout } = require("./http");

function createHttpDeliveryAdapter({ url, secret, timeoutMs = 2000, maxAttempts = 3, allowHttpLocal = false, now = Date.now }) {
  const endpoint = validateEndpoint(url, { allowHttpLocal });
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Gateway delivery signing secret must be at least 32 bytes.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("Gateway delivery attempts must be between 1 and 3.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    throw new Error("Gateway delivery timeout must be between 100 and 10000 ms.");
  }

  async function send(event, idempotencyKey) {
    const body = JSON.stringify(event);
    const timestamp = new Date(now()).toISOString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    let lastStatus = null;
    let lastCode = "delivery_failed";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "X-Kinetic-Timestamp": timestamp,
            "X-Kinetic-Signature": `sha256=${signature}`
          },
          body
        }, timeoutMs);
        lastStatus = response.status;
        await response.body?.cancel();

        if (response.ok) return { delivered: true, attempts: attempt, statusCode: response.status };
        if (response.status !== 429 && response.status < 500) {
          return { delivered: false, attempts: attempt, statusCode: response.status, code: "delivery_rejected" };
        }
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        lastCode = error.publicCode;
      }
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }

    return { delivered: false, attempts: maxAttempts, statusCode: lastStatus, code: lastCode };
  }

  return { send };
}

module.exports = { createHttpDeliveryAdapter };
