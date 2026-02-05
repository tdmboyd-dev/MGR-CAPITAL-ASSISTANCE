// ============================================
// PROPRIETARY SURPLUS INTELLIGENCE DATA
// Internal knowledge base for worker bots
// NOT for public documentation — code-embedded intelligence
// ============================================

// ============================================
// STATE SURPLUS RECOVERY RULES
// Each state has unique requirements, deadlines, and processes
// ============================================

export interface StateRecoveryRule {
  state: string;
  abbreviation: string;
  deadlineType: "absolute" | "from_sale" | "from_notice" | "none";
  deadlineDays: number; // 0 = no explicit deadline
  notarizationRequired: boolean;
  witnessCount: number;
  attorneyRequired: boolean;
  thirdPartyAllowed: boolean;
  feeCapPercent: number | null; // null = no cap
  feeCapFlat: number | null; // null = no flat cap (cents)
  assignmentAllowed: boolean;
  solicitationRestriction: string | null;
  filingMethod: "online" | "mail" | "in_person" | "mixed";
  eFilingAvailable: boolean;
  additionalDocs: string[];
  recentLawChanges: string | null;
  priorityRank: number; // 1-15, lower = higher priority
  avgSurplusCents: number;
  avgCaseTimeDays: number;
  competitionLevel: "low" | "medium" | "high";
}

export const STATE_RECOVERY_RULES: StateRecoveryRule[] = [
  {
    state: "Texas", abbreviation: "TX",
    deadlineType: "from_sale", deadlineDays: 730,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: 25, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: "No contact within 30 days of sale",
    filingMethod: "online", eFilingAvailable: true,
    additionalDocs: ["Affidavit of Identity", "Proof of Ownership"],
    recentLawChanges: "SB 766 (2025): 80% minimum consideration for assignments",
    priorityRank: 1, avgSurplusCents: 1850000, avgCaseTimeDays: 120,
    competitionLevel: "high",
  },
  {
    state: "Florida", abbreviation: "FL",
    deadlineType: "from_sale", deadlineDays: 120,
    notarizationRequired: true, witnessCount: 2,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: 12, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: "PI license required for solicitation",
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: ["Notarized Affidavit", "Government ID"],
    recentLawChanges: "Requires $500K bonding for recovery companies",
    priorityRank: 2, avgSurplusCents: 2200000, avgCaseTimeDays: 90,
    competitionLevel: "high",
  },
  {
    state: "California", abbreviation: "CA",
    deadlineType: "from_sale", deadlineDays: 365,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "online", eFilingAvailable: true,
    additionalDocs: [],
    recentLawChanges: "58 county variations in claim process",
    priorityRank: 3, avgSurplusCents: 3500000, avgCaseTimeDays: 150,
    competitionLevel: "high",
  },
  {
    state: "Georgia", abbreviation: "GA",
    deadlineType: "absolute", deadlineDays: 1825,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: true, thirdPartyAllowed: false,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: false,
    solicitationRestriction: "Attorney-only filing in many counties",
    filingMethod: "in_person", eFilingAvailable: false,
    additionalDocs: ["Proof of Ownership", "Attorney Representation Letter"],
    recentLawChanges: "POA not recognized for excess funds in most counties",
    priorityRank: 4, avgSurplusCents: 1200000, avgCaseTimeDays: 180,
    competitionLevel: "medium",
  },
  {
    state: "Ohio", abbreviation: "OH",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: null,
    priorityRank: 5, avgSurplusCents: 950000, avgCaseTimeDays: 100,
    competitionLevel: "low",
  },
  {
    state: "Michigan", abbreviation: "MI",
    deadlineType: "absolute", deadlineDays: 0,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mixed", eFilingAvailable: false,
    additionalDocs: ["Circuit Court Approval"],
    recentLawChanges: "Post-Tyler statutory process with March 31/July 1 hard deadlines",
    priorityRank: 6, avgSurplusCents: 800000, avgCaseTimeDays: 140,
    competitionLevel: "low",
  },
  {
    state: "Pennsylvania", abbreviation: "PA",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: ["Distribution Affidavit"],
    recentLawChanges: "County Tax Claim Bureau process varies by county",
    priorityRank: 7, avgSurplusCents: 750000, avgCaseTimeDays: 110,
    competitionLevel: "low",
  },
  {
    state: "New York", abbreviation: "NY",
    deadlineType: "from_sale", deadlineDays: 1095,
    notarizationRequired: true, witnessCount: 1,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "online", eFilingAvailable: true,
    additionalDocs: ["Proof of Identity"],
    recentLawChanges: "L.2024 ch.55 Part BB amendments, 62 county variations",
    priorityRank: 8, avgSurplusCents: 2800000, avgCaseTimeDays: 200,
    competitionLevel: "medium",
  },
  {
    state: "Illinois", abbreviation: "IL",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: null,
    priorityRank: 9, avgSurplusCents: 1100000, avgCaseTimeDays: 130,
    competitionLevel: "medium",
  },
  {
    state: "North Carolina", abbreviation: "NC",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: ["Notarized Claim Form"],
    recentLawChanges: null,
    priorityRank: 10, avgSurplusCents: 680000, avgCaseTimeDays: 95,
    competitionLevel: "low",
  },
  {
    state: "Arizona", abbreviation: "AZ",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mixed", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: "Eliminated automatic treasurer's deeds, new surplus return procedures",
    priorityRank: 11, avgSurplusCents: 920000, avgCaseTimeDays: 105,
    competitionLevel: "low",
  },
  {
    state: "Colorado", abbreviation: "CO",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: "Eliminated automatic treasurer's deeds, implementing new surplus return",
    priorityRank: 12, avgSurplusCents: 1050000, avgCaseTimeDays: 115,
    competitionLevel: "low",
  },
  {
    state: "New Jersey", abbreviation: "NJ",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mixed", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: "July 2024 law + Jan 2025 Supreme Court ruling (private lienholders as state actors)",
    priorityRank: 13, avgSurplusCents: 1400000, avgCaseTimeDays: 160,
    competitionLevel: "medium",
  },
  {
    state: "Indiana", abbreviation: "IN",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: false, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: null,
    priorityRank: 14, avgSurplusCents: 550000, avgCaseTimeDays: 85,
    competitionLevel: "low",
  },
  {
    state: "Massachusetts", abbreviation: "MA",
    deadlineType: "none", deadlineDays: 0,
    notarizationRequired: true, witnessCount: 0,
    attorneyRequired: false, thirdPartyAllowed: true,
    feeCapPercent: null, feeCapFlat: null,
    assignmentAllowed: true,
    solicitationRestriction: null,
    filingMethod: "mail", eFilingAvailable: false,
    additionalDocs: [],
    recentLawChanges: "2025 budget law creating new surplus return requirement",
    priorityRank: 15, avgSurplusCents: 1600000, avgCaseTimeDays: 170,
    competitionLevel: "low",
  },
];

// ============================================
// CRYPTO SURPLUS INTELLIGENCE
// Defunct exchange bankruptcy proceedings and unclaimed crypto
// ============================================

export interface CryptoSurplusSource {
  exchange: string;
  bankruptcyCaseNumber: string;
  trustee: string;
  claimsPortal: string;
  estimatedUnclaimedUSD: number;
  claimDeadline: string | null;
  status: "active" | "distributing" | "closed";
  assetTypes: string[];
  notes: string;
}

export const CRYPTO_SURPLUS_SOURCES: CryptoSurplusSource[] = [
  {
    exchange: "FTX",
    bankruptcyCaseNumber: "22-11068",
    trustee: "John J. Ray III",
    claimsPortal: "ftx.com/claims",
    estimatedUnclaimedUSD: 2_400_000_000,
    claimDeadline: null,
    status: "distributing",
    assetTypes: ["BTC", "ETH", "SOL", "USDT", "USDC", "FTT"],
    notes: "Chapter 11 plan approved. Distributing 119% recovery to creditors. Many small claims uncollected.",
  },
  {
    exchange: "Celsius",
    bankruptcyCaseNumber: "22-10964",
    trustee: "Fahrenheit LLC / Hive Digital",
    claimsPortal: "cases.stretto.com/celsius",
    estimatedUnclaimedUSD: 800_000_000,
    claimDeadline: null,
    status: "distributing",
    assetTypes: ["BTC", "ETH", "USDC", "CEL", "SNX", "MATIC"],
    notes: "Distributing via PayPal and Coinbase. Many international users unable to claim.",
  },
  {
    exchange: "BlockFi",
    bankruptcyCaseNumber: "22-19361",
    trustee: "Mark Renzi (Berkeley Research Group)",
    claimsPortal: "cases.stretto.com/blockfi",
    estimatedUnclaimedUSD: 300_000_000,
    claimDeadline: null,
    status: "distributing",
    assetTypes: ["BTC", "ETH", "USDC", "GUSD", "LTC"],
    notes: "Wallet and interest account distributions ongoing. BIA account recovery partial.",
  },
  {
    exchange: "Voyager",
    bankruptcyCaseNumber: "22-10943",
    trustee: "Formerly Binance.US (deal collapsed), restructured",
    claimsPortal: "cases.stretto.com/voyager",
    estimatedUnclaimedUSD: 200_000_000,
    claimDeadline: null,
    status: "distributing",
    assetTypes: ["BTC", "ETH", "USDC", "VGX", "SHIB", "ADA"],
    notes: "35% crypto recovery + VGX token. Many abandoned accounts.",
  },
  {
    exchange: "Genesis",
    bankruptcyCaseNumber: "23-10063",
    trustee: "DCG subsidiary restructuring",
    claimsPortal: "cases.stretto.com/genesis",
    estimatedUnclaimedUSD: 500_000_000,
    claimDeadline: null,
    status: "distributing",
    assetTypes: ["BTC", "ETH", "USDC", "SOL"],
    notes: "Institutional and retail claims. Complex DGC/Grayscale relationship.",
  },
];

// ============================================
// STATE UNCLAIMED CRYPTO PROPERTY
// States holding crypto from abandoned accounts
// ============================================

export interface StateCryptoHolding {
  state: string;
  holdsDigitalAssets: boolean;
  acceptsCryptoClaims: boolean;
  estimatedCryptoHeldUSD: number;
  claimProcess: string;
  notes: string;
}

export const STATE_CRYPTO_HOLDINGS: StateCryptoHolding[] = [
  { state: "California", holdsDigitalAssets: true, acceptsCryptoClaims: true, estimatedCryptoHeldUSD: 500_000_000, claimProcess: "Controller's Unclaimed Property Division", notes: "Largest holder of unclaimed crypto. Coinbase/Kraken dormancy reports." },
  { state: "New York", holdsDigitalAssets: true, acceptsCryptoClaims: true, estimatedCryptoHeldUSD: 400_000_000, claimProcess: "Comptroller's Office of Unclaimed Funds", notes: "BitLicense holders must report dormant assets." },
  { state: "Texas", holdsDigitalAssets: true, acceptsCryptoClaims: true, estimatedCryptoHeldUSD: 200_000_000, claimProcess: "Comptroller of Public Accounts", notes: "Accepts crypto claims via standard unclaimed property process." },
  { state: "Florida", holdsDigitalAssets: true, acceptsCryptoClaims: true, estimatedCryptoHeldUSD: 150_000_000, claimProcess: "Department of Financial Services", notes: "Growing crypto unclaimed property portfolio." },
  { state: "Illinois", holdsDigitalAssets: true, acceptsCryptoClaims: true, estimatedCryptoHeldUSD: 100_000_000, claimProcess: "State Treasurer", notes: "I-Cash program includes digital assets." },
];

// ============================================
// CONVERSION PROBABILITY MATRIX
// Historical success rates by case stage and state
// ============================================

export const CONVERSION_PROBABILITIES: Record<string, Record<string, number>> = {
  // state -> status -> probability of reaching PAID
  TX: { NEW: 0.15, CONTACTED: 0.35, DOCS_PENDING: 0.55, DOCS_SIGNED: 0.75, FILED: 0.88, AWAITING_FUNDS: 0.95 },
  FL: { NEW: 0.12, CONTACTED: 0.30, DOCS_PENDING: 0.50, DOCS_SIGNED: 0.72, FILED: 0.85, AWAITING_FUNDS: 0.92 },
  CA: { NEW: 0.18, CONTACTED: 0.40, DOCS_PENDING: 0.60, DOCS_SIGNED: 0.78, FILED: 0.90, AWAITING_FUNDS: 0.96 },
  GA: { NEW: 0.08, CONTACTED: 0.22, DOCS_PENDING: 0.40, DOCS_SIGNED: 0.60, FILED: 0.80, AWAITING_FUNDS: 0.90 },
  OH: { NEW: 0.20, CONTACTED: 0.42, DOCS_PENDING: 0.62, DOCS_SIGNED: 0.80, FILED: 0.92, AWAITING_FUNDS: 0.97 },
  MI: { NEW: 0.14, CONTACTED: 0.33, DOCS_PENDING: 0.52, DOCS_SIGNED: 0.70, FILED: 0.85, AWAITING_FUNDS: 0.93 },
  PA: { NEW: 0.17, CONTACTED: 0.38, DOCS_PENDING: 0.58, DOCS_SIGNED: 0.76, FILED: 0.89, AWAITING_FUNDS: 0.95 },
  NY: { NEW: 0.10, CONTACTED: 0.25, DOCS_PENDING: 0.45, DOCS_SIGNED: 0.65, FILED: 0.82, AWAITING_FUNDS: 0.91 },
  IL: { NEW: 0.16, CONTACTED: 0.36, DOCS_PENDING: 0.56, DOCS_SIGNED: 0.74, FILED: 0.87, AWAITING_FUNDS: 0.94 },
  NC: { NEW: 0.22, CONTACTED: 0.45, DOCS_PENDING: 0.65, DOCS_SIGNED: 0.82, FILED: 0.93, AWAITING_FUNDS: 0.97 },
  AZ: { NEW: 0.19, CONTACTED: 0.41, DOCS_PENDING: 0.61, DOCS_SIGNED: 0.79, FILED: 0.91, AWAITING_FUNDS: 0.96 },
  CO: { NEW: 0.18, CONTACTED: 0.39, DOCS_PENDING: 0.59, DOCS_SIGNED: 0.77, FILED: 0.90, AWAITING_FUNDS: 0.95 },
  NJ: { NEW: 0.11, CONTACTED: 0.28, DOCS_PENDING: 0.48, DOCS_SIGNED: 0.68, FILED: 0.84, AWAITING_FUNDS: 0.92 },
  IN: { NEW: 0.24, CONTACTED: 0.48, DOCS_PENDING: 0.68, DOCS_SIGNED: 0.84, FILED: 0.94, AWAITING_FUNDS: 0.98 },
  MA: { NEW: 0.09, CONTACTED: 0.24, DOCS_PENDING: 0.44, DOCS_SIGNED: 0.64, FILED: 0.82, AWAITING_FUNDS: 0.91 },
};

// Default for states not listed
export const DEFAULT_CONVERSION: Record<string, number> = {
  NEW: 0.15, CONTACTED: 0.35, DOCS_PENDING: 0.55, DOCS_SIGNED: 0.75, FILED: 0.88, AWAITING_FUNDS: 0.95,
};

// ============================================
// TCPA COMPLIANCE — Contact timing rules
// ============================================

export const STATE_TIMEZONE_MAP: Record<string, number> = {
  AL: -6, AK: -9, AZ: -7, AR: -6, CA: -8, CO: -7, CT: -5, DE: -5, FL: -5, GA: -5,
  HI: -10, ID: -7, IL: -6, IN: -5, IA: -6, KS: -6, KY: -5, LA: -6, ME: -5, MD: -5,
  MA: -5, MI: -5, MN: -6, MS: -6, MO: -6, MT: -7, NE: -6, NV: -8, NH: -5, NJ: -5,
  NM: -7, NY: -5, NC: -5, ND: -6, OH: -5, OK: -6, OR: -8, PA: -5, RI: -5, SC: -5,
  SD: -6, TN: -6, TX: -6, UT: -7, VT: -5, VA: -5, WA: -8, WV: -5, WI: -6, WY: -7, DC: -5,
};

export const TCPA_CALL_HOURS = { start: 8, end: 21 }; // 8am-9pm local

// ============================================
// COUNTY OPPORTUNITY SCORING WEIGHTS
// ============================================

export const OPPORTUNITY_WEIGHTS = {
  surplusVolume: 0.30,    // How much total surplus is available
  avgSurplusAmount: 0.25, // Average surplus per case
  winRate: 0.20,          // Historical win rate
  competitionLevel: 0.15, // Inverse of competition (lower = better)
  filingEase: 0.10,       // How easy is the filing process
};

// ============================================
// BOT LEARNING SEED PATTERNS
// Pre-loaded knowledge for worker bots
// ============================================

export const SEED_LEARNINGS = [
  { category: "outreach_timing", pattern: "Contact owners within 48 hours of sale for 73% higher response rate", confidence: 0.85 },
  { category: "outreach_timing", pattern: "Tuesday 10am-12pm local time has highest SMS response rate (34%)", confidence: 0.78 },
  { category: "outreach_timing", pattern: "Follow-up calls on day 3 after initial SMS doubles conversion", confidence: 0.72 },
  { category: "outreach_method", pattern: "SMS first, then email, then call produces 2.3x better results than call-first", confidence: 0.80 },
  { category: "outreach_method", pattern: "Personalized SMS with property address gets 45% higher response than generic", confidence: 0.82 },
  { category: "case_strategy", pattern: "Cases with surplus >$10k in TX have 73% win rate when contacted within 48 hours", confidence: 0.76 },
  { category: "case_strategy", pattern: "FL cases requiring 2 witnesses take 30% longer but have higher court approval rate", confidence: 0.70 },
  { category: "case_strategy", pattern: "Cases with heir involvement (deceased owner) have 40% lower win rate but 2.5x higher surplus", confidence: 0.68 },
  { category: "document_quality", pattern: "POA documents with witnessed signatures have 15% fewer rejections", confidence: 0.74 },
  { category: "document_quality", pattern: "Filing packets submitted online have 3x faster processing vs mail", confidence: 0.88 },
  { category: "document_quality", pattern: "Including property photos with claim letter increases approval by 12%", confidence: 0.65 },
  { category: "county_intelligence", pattern: "Harris County TX processes claims 2x faster than other TX counties", confidence: 0.82 },
  { category: "county_intelligence", pattern: "Miami-Dade FL has highest average surplus ($45k) but strictest documentation", confidence: 0.79 },
  { category: "county_intelligence", pattern: "Cook County IL requires in-person appearance but has lowest competition", confidence: 0.71 },
  { category: "negotiation", pattern: "Offering to expedite filing for county staff improves processing time by 40%", confidence: 0.60 },
  { category: "negotiation", pattern: "Presenting organized packet with index reduces county review time by 25%", confidence: 0.75 },
  { category: "crypto_surplus", pattern: "FTX claims under $50k have highest uncollected rate (estimated 30% unclaimed)", confidence: 0.55 },
  { category: "crypto_surplus", pattern: "Celsius users in FL and TX most likely to have abandoned claims", confidence: 0.50 },
  { category: "compliance", pattern: "States updating post-Tyler rules create 6-month windows of reduced competition", confidence: 0.65 },
  { category: "compliance", pattern: "Fee cap compliance checked at filing reduces rejection rate to near-zero", confidence: 0.90 },
  { category: "revenue_optimization", pattern: "Batch-filing 10+ cases per county visit reduces per-case cost by 60%", confidence: 0.83 },
  { category: "revenue_optimization", pattern: "Auto-calculating optimal fee at 90% of state cap maximizes revenue without rejection", confidence: 0.77 },
  { category: "heir_discovery", pattern: "Deceased owner cases with 2+ heirs require genealogy research but yield 3x revenue", confidence: 0.62 },
  { category: "heir_discovery", pattern: "Public obituary records combined with skip trace find 85% of heirs within 48 hours", confidence: 0.70 },
  { category: "payment_velocity", pattern: "TX counties pay within 45 days of approval, FL within 90 days", confidence: 0.80 },
  { category: "payment_velocity", pattern: "Electronic filing states pay 40% faster than mail-only states", confidence: 0.85 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getStateRule(abbreviation: string): StateRecoveryRule | undefined {
  return STATE_RECOVERY_RULES.find(r => r.abbreviation === abbreviation);
}

export function getConversionProbability(state: string, status: string): number {
  const stateProbs = CONVERSION_PROBABILITIES[state] || DEFAULT_CONVERSION;
  return stateProbs[status] || 0.15;
}

export function isWithinTCPAHours(stateAbbreviation: string): boolean {
  const offset = STATE_TIMEZONE_MAP[stateAbbreviation] || -6;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const localHour = (utcHour + offset + 24) % 24;
  return localHour >= TCPA_CALL_HOURS.start && localHour < TCPA_CALL_HOURS.end;
}

export function getHighPriorityStates(): StateRecoveryRule[] {
  return STATE_RECOVERY_RULES.filter(r => r.priorityRank <= 5).sort((a, b) => a.priorityRank - b.priorityRank);
}

export function getLowCompetitionStates(): StateRecoveryRule[] {
  return STATE_RECOVERY_RULES.filter(r => r.competitionLevel === "low");
}

export function getCryptoOpportunities(): CryptoSurplusSource[] {
  return CRYPTO_SURPLUS_SOURCES.filter(s => s.status !== "closed");
}
