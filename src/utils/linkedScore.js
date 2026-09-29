const { accounts, leads } = require("../data");
const {
  getCompanySizeScore,
  getRevenueScore,
  getEngagementScore,
  getIntentSignalScore,
  scoreLeadPayload
} = require("./scoring");

const MODEL_VERSION = "rules-v1";

function getLinkedScore(leadId, fixtures = { leads, accounts }) {
  const lead = fixtures.leads.find((item) => item.id === leadId);
  if (!lead) {
    return { error: "lead_not_found" };
  }

  const account = fixtures.accounts.find((item) => item.id === lead.accountId);
  if (!account) {
    return { error: "account_not_found" };
  }

  const inputs = {
    companySize: account.employees,
    annualRevenue: account.annualRevenue,
    engagementScore: lead.engagementScore,
    intentSignals: [...lead.intentSignals]
  };

  return {
    leadId: lead.id,
    accountId: account.id,
    modelVersion: MODEL_VERSION,
    provenance: {
      dataSource: "synthetic-fixture",
      leadId: lead.id,
      accountId: account.id
    },
    inputs,
    breakdown: {
      companySize: getCompanySizeScore(inputs.companySize),
      annualRevenue: getRevenueScore(inputs.annualRevenue),
      engagement: getEngagementScore(inputs.engagementScore),
      intentSignals: getIntentSignalScore(inputs.intentSignals)
    },
    result: scoreLeadPayload(inputs)
  };
}

module.exports = { getLinkedScore };
