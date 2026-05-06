const SIGNAL_WEIGHTS = {
  "pricing-page": 8,
  "demo-request": 8,
  "webinar-attended": 5,
  "case-study-download": 5,
  "newsletter-click": 2,
  "homepage-return-visit": 2,
  "ad-click": 2
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeIntentSignals(intentSignals = []) {
  return [...new Set(intentSignals.map((signal) => String(signal).trim().toLowerCase()))];
}

function getCompanySizeScore(companySize) {
  if (companySize >= 500) {
    return 23;
  }

  if (companySize >= 200) {
    return 18;
  }

  if (companySize >= 50) {
    return 12;
  }

  if (companySize > 0) {
    return 6;
  }

  return 0;
}

function getRevenueScore(annualRevenue) {
  if (annualRevenue >= 100000000) {
    return 20;
  }

  if (annualRevenue >= 50000000) {
    return 16;
  }

  if (annualRevenue >= 10000000) {
    return 12;
  }

  if (annualRevenue >= 1000000) {
    return 6;
  }

  if (annualRevenue > 0) {
    return 2;
  }

  return 0;
}

function getEngagementScore(engagementScore) {
  return clamp(Math.round((engagementScore / 100) * 36), 0, 36);
}

function getIntentSignalScore(intentSignals) {
  const rawScore = normalizeIntentSignals(intentSignals).reduce((total, signal) => {
    return total + (SIGNAL_WEIGHTS[signal] || 0);
  }, 0);

  return clamp(rawScore, 0, 21);
}

function getTier(score) {
  if (score >= 85) {
    return "high-intent";
  }

  if (score >= 70) {
    return "qualified";
  }

  if (score >= 40) {
    return "warm";
  }

  return "cold";
}

function buildExplanation({ companySize, annualRevenue, engagementScore, intentSignals }) {
  const normalizedSignals = normalizeIntentSignals(intentSignals);
  const explanation = [];

  if (engagementScore >= 80) {
    explanation.push("High engagement score indicates strong buying interest.");
  } else if (engagementScore >= 60) {
    explanation.push("Engagement is above baseline, suggesting active consideration.");
  } else if (engagementScore >= 40) {
    explanation.push("Moderate engagement suggests a nurture-ready opportunity.");
  }

  if (normalizedSignals.includes("pricing-page")) {
    explanation.push("Pricing page visit is a strong commercial intent signal.");
  } else if (normalizedSignals.includes("demo-request")) {
    explanation.push("Demo request indicates readiness for direct sales engagement.");
  }

  if (companySize >= 500) {
    explanation.push("Company size fits enterprise target profile.");
  } else if (companySize >= 200) {
    explanation.push("Mid-market company size aligns with strategic growth accounts.");
  }

  if (annualRevenue >= 100000000) {
    explanation.push("Revenue profile suggests budget capacity for platform investment.");
  }

  if (normalizedSignals.includes("webinar-attended")) {
    explanation.push("Webinar attendance shows sustained interest beyond a single visit.");
  }

  if (explanation.length === 0) {
    explanation.push("Current firmographic and engagement signals suggest longer-term nurturing.");
  }

  return explanation.slice(0, 4);
}

function getRecommendedNextAction(tier) {
  if (tier === "high-intent") {
    return "Route to sales within 24 hours with enterprise web platform modernization message.";
  }

  if (tier === "qualified") {
    return "Assign to a BDR within 48 hours with tailored outreach tied to the most relevant campaign theme.";
  }

  if (tier === "warm") {
    return "Place in a multi-touch nurture flow and schedule SDR review after the next engagement spike.";
  }

  return "Keep in marketing automation, enrich the account profile, and wait for additional buying signals.";
}

function scoreLeadPayload({ companySize, annualRevenue, engagementScore, intentSignals }) {
  const score = clamp(
    getCompanySizeScore(companySize) +
      getRevenueScore(annualRevenue) +
      getEngagementScore(engagementScore) +
      getIntentSignalScore(intentSignals),
    0,
    100
  );

  const tier = getTier(score);

  return {
    score,
    tier,
    explanation: buildExplanation({
      companySize,
      annualRevenue,
      engagementScore,
      intentSignals
    }),
    recommendedNextAction: getRecommendedNextAction(tier)
  };
}

module.exports = {
  SIGNAL_WEIGHTS,
  getTier,
  scoreLeadPayload
};
