const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const yaml = require("js-yaml");
const healthRouter = require("./routes/health");
const leadsRouter = require("./routes/leads");
const accountsRouter = require("./routes/accounts");
const campaignsRouter = require("./routes/campaigns");
const scoreRouter = require("./routes/score");
const { errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const docsPath = path.join(__dirname, "..", "docs", "openapi.yaml");
const openApiDocument = yaml.load(fs.readFileSync(docsPath, "utf8"));

app.locals.serviceName = process.env.SERVICE_NAME || "Kinetic API Gateway";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/health", healthRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/score", scoreRouter);

app.use((req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} was not found.`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

module.exports = app;
