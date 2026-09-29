const express = require("express");
const { SIGNAL_WEIGHTS, scoreLeadPayload } = require("../utils/scoring");

const router = express.Router();

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

router.post("/", (req, res, next) => {
  const { companySize, annualRevenue, engagementScore, intentSignals } = req.body ?? {};

  if (
    !isNonNegativeInteger(companySize) ||
    !isNonNegativeInteger(annualRevenue) ||
    !Number.isInteger(engagementScore) ||
    engagementScore < 0 ||
    engagementScore > 100 ||
    !Array.isArray(intentSignals) ||
    intentSignals.length > 20 ||
    intentSignals.some(
      (signal) => typeof signal !== "string" || !Object.hasOwn(SIGNAL_WEIGHTS, signal)
    )
  ) {
    const error = new Error(
      "Request body must include non-negative integer companySize and annualRevenue, an integer engagementScore from 0 to 100, and up to 20 recognized intentSignals."
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
