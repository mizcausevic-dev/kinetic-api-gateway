const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const yaml = require("js-yaml");
const healthRouter = require("./routes/health");
const leadsRouter = require("./routes/leads");
const accountsRouter = require("./routes/accounts");
const campaignsRouter = require("./routes/campaigns");
const scoreRouter = require("./routes/score");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLog } = require("./middleware/requestLog");
const { createGatewayRouter } = require("./gateway/router");
const { loadGatewayFromEnv } = require("./gateway/config");

dotenv.config();

const docsPath = path.join(__dirname, "..", "docs", "openapi.yaml");
const openApiDocument = yaml.load(fs.readFileSync(docsPath, "utf8"));

function createApp({ gateway = loadGatewayFromEnv(), logger = gateway?.logger || console } = {}) {
  const app = express();
  app.locals.serviceName = process.env.SERVICE_NAME || "Kinetic API Gateway";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestLog({ logger }));
  app.use(express.json({ limit: "16kb" }));

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/health", healthRouter);
  app.use("/api", cors());
  app.use("/api/leads", leadsRouter);
  app.use("/api/accounts", accountsRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/score", scoreRouter);
  if (gateway) {
    app.use("/gateway/v1", createGatewayRouter(gateway));
  } else {
    app.use("/gateway/v1", (req, res) => res.status(503).json({
      error: { code: "gateway_disabled", message: "The protected gateway is not configured." }
    }));
  }

  app.use((req, res, next) => {
    const error = new Error("Route was not found.");
    error.statusCode = 404;
    next(error);
  });

  app.use(errorHandler);
  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
