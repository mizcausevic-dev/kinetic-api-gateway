const { createHttpSourceAdapter } = require("./source");
const { createHttpDeliveryAdapter } = require("./delivery");

function loadGatewayFromEnv(env = process.env) {
  if (env.GATEWAY_ENABLED !== "1") return null;
  const required = ["GATEWAY_CLIENTS_JSON", "GATEWAY_SOURCE_URL", "GATEWAY_SOURCE_TOKEN", "GATEWAY_DELIVERY_URL", "GATEWAY_DELIVERY_SECRET"];
  if (required.some((key) => !env[key])) {
    throw new Error("Gateway configuration is incomplete.");
  }
  let clients;
  try {
    clients = JSON.parse(env.GATEWAY_CLIENTS_JSON);
  } catch {
    throw new Error("Gateway client configuration is invalid.");
  }
  if (!Array.isArray(clients) || clients.length === 0) {
    throw new Error("Gateway requires at least one configured client.");
  }
  return {
    clients,
    sourceAdapter: createHttpSourceAdapter({ baseUrl: env.GATEWAY_SOURCE_URL, token: env.GATEWAY_SOURCE_TOKEN }),
    deliveryAdapter: createHttpDeliveryAdapter({ url: env.GATEWAY_DELIVERY_URL, secret: env.GATEWAY_DELIVERY_SECRET }),
    allowDelete: env.GATEWAY_ALLOW_DELETE === "1"
  };
}

module.exports = { loadGatewayFromEnv };
