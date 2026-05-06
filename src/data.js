const accounts = [
  {
    id: "acct-cyber-001",
    name: "SentinelForge",
    industry: "Cybersecurity",
    employees: 1450,
    annualRevenue: 214000000,
    region: "North America",
    platformPriority: "Security analytics consolidation"
  },
  {
    id: "acct-analytics-002",
    name: "Northstar Metrics",
    industry: "Analytics",
    employees: 620,
    annualRevenue: 94000000,
    region: "EMEA",
    platformPriority: "Global self-service reporting scale"
  },
  {
    id: "acct-cloud-003",
    name: "AstraLayer Cloud",
    industry: "Cloud Infrastructure",
    employees: 2300,
    annualRevenue: 486000000,
    region: "North America",
    platformPriority: "Cloud migration and developer portal modernization"
  }
];

const leads = [
  {
    id: "lead-001",
    name: "Maya Patel",
    title: "VP Digital Experience",
    accountId: "acct-analytics-002",
    company: "Northstar Metrics",
    email: "maya.patel@northstarmetrics.example",
    source: "AI Platform Modernization Webinar",
    region: "London",
    engagementScore: 88,
    intentSignals: ["pricing-page", "webinar-attended", "case-study-download"],
    status: "MQL"
  },
  {
    id: "lead-002",
    name: "Jordan Kim",
    title: "Director of Web Strategy",
    accountId: "acct-cyber-001",
    company: "SentinelForge",
    email: "jordan.kim@sentinelforge.example",
    source: "Enterprise SEO Governance Playbook",
    region: "New York",
    engagementScore: 74,
    intentSignals: ["case-study-download", "newsletter-click", "homepage-return-visit"],
    status: "SAL"
  },
  {
    id: "lead-003",
    name: "Luis Romero",
    title: "Cloud Platform Lead",
    accountId: "acct-cloud-003",
    company: "AstraLayer Cloud",
    email: "luis.romero@astralayer.example",
    source: "Cloud Migration Assessment Offer",
    region: "Austin",
    engagementScore: 93,
    intentSignals: ["demo-request", "pricing-page", "homepage-return-visit"],
    status: "SQL"
  },
  {
    id: "lead-004",
    name: "Erin Collins",
    title: "Demand Generation Director",
    accountId: "acct-analytics-002",
    company: "Northstar Metrics",
    email: "erin.collins@northstarmetrics.example",
    source: "AI Platform Modernization Webinar",
    region: "Chicago",
    engagementScore: 69,
    intentSignals: ["webinar-attended", "ad-click", "newsletter-click"],
    status: "MQL"
  },
  {
    id: "lead-005",
    name: "Devon Hayes",
    title: "Security Operations Manager",
    accountId: "acct-cyber-001",
    company: "SentinelForge",
    email: "devon.hayes@sentinelforge.example",
    source: "Security Architecture Retargeting",
    region: "Toronto",
    engagementScore: 58,
    intentSignals: ["ad-click", "homepage-return-visit"],
    status: "Nurture"
  }
];

const campaigns = [
  {
    id: "camp-001",
    name: "AI Platform Modernization Webinar",
    channel: "Webinar",
    budget: 42000,
    leads: 138,
    pipelineGenerated: 610000,
    status: "active"
  },
  {
    id: "camp-002",
    name: "Enterprise SEO Governance Playbook",
    channel: "Organic + Content Syndication",
    budget: 18000,
    leads: 84,
    pipelineGenerated: 255000,
    status: "active"
  },
  {
    id: "camp-003",
    name: "Security Architecture Retargeting",
    channel: "Paid Media",
    budget: 26000,
    leads: 63,
    pipelineGenerated: 174000,
    status: "optimizing"
  },
  {
    id: "camp-004",
    name: "Cloud Migration Assessment Offer",
    channel: "Outbound + Landing Page",
    budget: 35000,
    leads: 97,
    pipelineGenerated: 520000,
    status: "active"
  }
];

module.exports = {
  accounts,
  leads,
  campaigns
};
