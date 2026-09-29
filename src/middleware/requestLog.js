const { randomUUID } = require("node:crypto");

function safeRouteTemplate(route) {
  return typeof route === "string" && /^\/[a-zA-Z0-9_/:*.-]{0,119}$/.test(route)
    ? route
    : undefined;
}

function requestLog({ logger = console } = {}) {
  const log = typeof logger === "function" ? logger : logger?.info?.bind(logger);
  if (typeof log !== "function") {
    throw new TypeError("logger must be a function or have an info method");
  }

  return function logRequest(req, res, next) {
    const start = process.hrtime.bigint();
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    res.once("finish", () => {
      const record = {
        requestId,
        method: /^[A-Z]{1,12}$/.test(req.method) ? req.method : "OTHER",
        status: res.statusCode,
        durationMs: Number((Number(process.hrtime.bigint() - start) / 1_000_000).toFixed(2))
      };
      const route = safeRouteTemplate(req.route?.path);
      if (route) record.route = route;
      try {
        log(record);
      } catch {
        // Logging failures must not terminate a request worker or expose request data.
        try { process.stderr.write("Safe request log sink failed.\n"); } catch {}
      }
    });

    return next();
  };
}

module.exports = { requestLog };
