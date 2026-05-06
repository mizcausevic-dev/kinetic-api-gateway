const express = require("express");
const { scoreLeadPayload } = require("../utils/scoring");

const router = express.Router();

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

router.post("/", (req, res, next) => {
  const { companySize, annualRevenue, engagementScore, intentSignals } = req.body;

  if (
    !isValidNumber(companySize) ||
    !isValidNumber(annualRevenue) ||
    !isValidNumber(engagementScore) ||
    !Array.isArray(intentSignals) ||
    intentSignals.some((signal) => typeof signal !== "string")
  ) {
    const error = new Error(
      "Request body must include numeric companySize, annualRevenue, engagementScore, and an array of string intentSignals."
    );
    error.statusCode = 400;
    return next(error);
  }

  const result = scoreLeadPayload({
    companySize,
    annualRevenue,
    engagementScore,
    intentSignals
  });

  return res.json(result);
});

module.exports = router;
