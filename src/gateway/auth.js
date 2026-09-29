const { createHash, timingSafeEqual } = require("node:crypto");

function httpError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

function createAuthMiddleware(clients) {
  if (!Array.isArray(clients)) {
    throw new TypeError("clients must be an array");
  }

  const seenHashes = new Set();
  const configuredClients = clients.map((client) => {
    if (
      !client ||
      typeof client.id !== "string" || !client.id ||
      typeof client.tenantId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(client.tenantId) ||
      typeof client.tokenHash !== "string" || !/^[0-9a-f]{64}$/i.test(client.tokenHash) ||
      !Array.isArray(client.scopes) ||
      client.scopes.some((scope) => typeof scope !== "string" || !scope)
    ) {
      throw new TypeError("Each client requires an id, tenantId, SHA-256 tokenHash, and scopes");
    }

    const tokenHash = client.tokenHash.toLowerCase();
    if (seenHashes.has(tokenHash)) {
      throw new TypeError("Client token hashes must be unique");
    }
    seenHashes.add(tokenHash);

    return {
      id: client.id,
      tenantId: client.tenantId,
      tokenHash: Buffer.from(tokenHash, "hex"),
      scopes: Object.freeze([...client.scopes])
    };
  });

  return function authenticate(req, res, next) {
    const authorization = req.headers.authorization;
    const bearer = typeof authorization === "string" && /^Bearer ([^\s]{1,2048})$/i.exec(authorization);
    if (!bearer) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return next(httpError(401, "unauthorized", "Authentication is required."));
    }

    const suppliedHash = createHash("sha256").update(bearer[1], "utf8").digest();
    let matchedClient;

    // Compare every configured digest, without a prefix or early-return match.
    for (const client of configuredClients) {
      if (timingSafeEqual(suppliedHash, client.tokenHash)) {
        matchedClient = client;
      }
    }

    if (!matchedClient) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return next(httpError(401, "unauthorized", "Authentication is required."));
    }

    req.gatewayClient = Object.freeze({
      id: matchedClient.id,
      tenantId: matchedClient.tenantId,
      scopes: matchedClient.scopes
    });
    return next();
  };
}

function requireScope(scope) {
  if (typeof scope !== "string" || !scope) {
    throw new TypeError("scope must be a non-empty string");
  }

  return function authorizeScope(req, res, next) {
    if (!req.gatewayClient) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return next(httpError(401, "unauthorized", "Authentication is required."));
    }
    if (!req.gatewayClient.scopes.includes(scope)) {
      return next(httpError(403, "forbidden", "Insufficient scope."));
    }
    return next();
  };
}

module.exports = { createAuthMiddleware, requireScope };
