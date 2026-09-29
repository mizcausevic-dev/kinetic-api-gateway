function createRateLimiter({ windowMs = 60_000, max = 60, now = Date.now } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || !Number.isSafeInteger(max) || max <= 0) {
    throw new TypeError("windowMs and max must be positive safe integers");
  }
  if (typeof now !== "function") {
    throw new TypeError("now must be a function");
  }

  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const client = req.gatewayClient;
    if (!client || typeof client.id !== "string" || typeof client.tenantId !== "string") {
      return next(Object.assign(new Error("Authentication is required."), {
        statusCode: 401,
        code: "unauthorized"
      }));
    }

    const timestamp = now();
    if (!Number.isFinite(timestamp)) {
      return next(new Error("Rate limiter clock is unavailable."));
    }

    const key = JSON.stringify([client.tenantId, client.id]);
    let bucket = buckets.get(key);
    if (!bucket || timestamp >= bucket.resetAt) {
      bucket = { count: 0, resetAt: timestamp + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000))));
      return next(Object.assign(new Error("Rate limit exceeded."), {
        statusCode: 429,
        code: "rate_limited"
      }));
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
