// ============================================
// CONTRACTOR FEES — MGR CAPITAL ASSISTANCE
// Platform-wide fee structure for child company employees/contractors
// Child companies can customize but MGR Capital always takes 50%
// ============================================

/**
 * MGR CAPITAL REVENUE SHARE
 *
 * For ALL fees charged by child companies to their employees/contractors:
 * - Child company sets the rate (must meet minimums)
 * - MGR Capital takes 50% of the total
 * - Child company keeps 50%
 *
 * Example: Child company charges contractor $20/service
 * - MGR Capital: $10 (50%)
 * - Child Company: $10 (50%)
 */
export const MGR_CAPITAL_SHARE_PERCENTAGE = 50;

// ============================================
// FEE CATEGORIES
// ============================================

export enum FeeCategory {
  EMAIL = "EMAIL",               // Professional email services
  LEADS = "LEADS",               // Lead generation/assignment
  PLATFORM = "PLATFORM",         // Platform access/usage
  TRAINING = "TRAINING",         // Training materials/certifications
  MARKETING = "MARKETING",       // Marketing support/materials
  TOOLS = "TOOLS",               // Tools & software access
  SUPPORT = "SUPPORT",           // Support services
  OTHER = "OTHER",               // Custom fees
}

// ============================================
// MINIMUM FEES (in cents)
// Child companies cannot go below these
// ============================================

export const MINIMUM_FEES: Record<FeeCategory, { setupCents: number; monthlyCents: number; perUseCents: number }> = {
  [FeeCategory.EMAIL]: {
    setupCents: 800,        // $8 minimum setup
    monthlyCents: 600,      // $6 minimum monthly
    perUseCents: 0,
  },
  [FeeCategory.LEADS]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 1000,      // $10 minimum per lead
  },
  [FeeCategory.PLATFORM]: {
    setupCents: 0,
    monthlyCents: 2500,     // $25 minimum monthly
    perUseCents: 0,
  },
  [FeeCategory.TRAINING]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 500,       // $5 minimum per course/module
  },
  [FeeCategory.MARKETING]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 200,       // $2 minimum per material
  },
  [FeeCategory.TOOLS]: {
    setupCents: 0,
    monthlyCents: 1000,     // $10 minimum monthly
    perUseCents: 0,
  },
  [FeeCategory.SUPPORT]: {
    setupCents: 0,
    monthlyCents: 500,      // $5 minimum monthly
    perUseCents: 0,
  },
  [FeeCategory.OTHER]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 100,       // $1 minimum for custom fees
  },
};

// ============================================
// DEFAULT FEES (what child companies start with)
// ============================================

export const DEFAULT_FEES: Record<FeeCategory, { setupCents: number; monthlyCents: number; perUseCents: number }> = {
  [FeeCategory.EMAIL]: {
    setupCents: 1200,       // $12 default setup
    monthlyCents: 600,      // $6 default monthly
    perUseCents: 0,
  },
  [FeeCategory.LEADS]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 2500,      // $25 default per lead
  },
  [FeeCategory.PLATFORM]: {
    setupCents: 0,
    monthlyCents: 5000,     // $50 default monthly
    perUseCents: 0,
  },
  [FeeCategory.TRAINING]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 1500,      // $15 default per course
  },
  [FeeCategory.MARKETING]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 500,       // $5 default per material
  },
  [FeeCategory.TOOLS]: {
    setupCents: 0,
    monthlyCents: 2000,     // $20 default monthly
    perUseCents: 0,
  },
  [FeeCategory.SUPPORT]: {
    setupCents: 0,
    monthlyCents: 1000,     // $10 default monthly
    perUseCents: 0,
  },
  [FeeCategory.OTHER]: {
    setupCents: 0,
    monthlyCents: 0,
    perUseCents: 500,       // $5 default for custom
  },
};

// ============================================
// INTERFACES
// ============================================

export interface ContractorFeeConfig {
  category: FeeCategory;
  setupCents: number;
  monthlyCents: number;
  perUseCents: number;
  description?: string;
}

export interface FeeSplitResult {
  totalCharged: number;
  mgrCapitalShare: number;
  childCompanyShare: number;
  category: FeeCategory;
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate the 50/50 split for any contractor fee
 * Child company keeps 50%, MGR Capital takes 50%
 */
export function calculateFeeSplit(
  chargedAmountCents: number,
  category: FeeCategory
): FeeSplitResult {
  const mgrCapitalShare = Math.floor(chargedAmountCents * MGR_CAPITAL_SHARE_PERCENTAGE / 100);
  const childCompanyShare = chargedAmountCents - mgrCapitalShare;

  return {
    totalCharged: chargedAmountCents,
    mgrCapitalShare,
    childCompanyShare,
    category,
  };
}

/**
 * Validate that proposed fees meet minimums
 */
export function validateContractorFees(
  category: FeeCategory,
  setupCents?: number,
  monthlyCents?: number,
  perUseCents?: number
): { valid: boolean; errors: string[] } {
  const minimums = MINIMUM_FEES[category];
  const errors: string[] = [];

  if (setupCents !== undefined && setupCents < minimums.setupCents) {
    errors.push(`Setup fee must be at least $${(minimums.setupCents / 100).toFixed(2)}`);
  }

  if (monthlyCents !== undefined && monthlyCents < minimums.monthlyCents) {
    errors.push(`Monthly fee must be at least $${(minimums.monthlyCents / 100).toFixed(2)}`);
  }

  if (perUseCents !== undefined && perUseCents < minimums.perUseCents) {
    errors.push(`Per-use fee must be at least $${(minimums.perUseCents / 100).toFixed(2)}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get default fee config for a category
 */
export function getDefaultFeeConfig(category: FeeCategory): ContractorFeeConfig {
  return {
    category,
    ...DEFAULT_FEES[category],
  };
}

/**
 * Calculate monthly revenue projection for child company
 * Based on estimated contractor count and activity
 */
export function projectMonthlyRevenue(
  contractorCount: number,
  feeConfig: ContractorFeeConfig,
  estimatedMonthlyUsage: number = 1 // For per-use fees
): {
  totalRevenue: number;
  childCompanyRevenue: number;
  mgrCapitalRevenue: number;
} {
  // Monthly fees
  const monthlyRevenue = feeConfig.monthlyCents * contractorCount;

  // Per-use fees (estimated)
  const perUseRevenue = feeConfig.perUseCents * contractorCount * estimatedMonthlyUsage;

  const totalRevenue = monthlyRevenue + perUseRevenue;
  const mgrCapitalRevenue = Math.floor(totalRevenue * MGR_CAPITAL_SHARE_PERCENTAGE / 100);
  const childCompanyRevenue = totalRevenue - mgrCapitalRevenue;

  return {
    totalRevenue,
    childCompanyRevenue,
    mgrCapitalRevenue,
  };
}

// ============================================
// PRICING SUMMARY FOR DISPLAY
// ============================================

export const CONTRACTOR_FEE_SUMMARY = {
  revenue_share: {
    description: "50/50 split on all contractor fees",
    mgrCapital: "50%",
    childCompany: "50%",
  },
  categories: {
    email: {
      name: "Professional Email",
      minimums: { setup: "$8", monthly: "$6" },
      defaults: { setup: "$12", monthly: "$6" },
      note: "Every contractor needs their own @company.com email",
    },
    leads: {
      name: "Lead Assignment",
      minimums: { perLead: "$10" },
      defaults: { perLead: "$25" },
      note: "Charged when assigning cases/leads to contractors",
    },
    platform: {
      name: "Platform Access",
      minimums: { monthly: "$25" },
      defaults: { monthly: "$50" },
      note: "Monthly fee for platform access and tools",
    },
    training: {
      name: "Training & Certification",
      minimums: { perCourse: "$5" },
      defaults: { perCourse: "$15" },
      note: "Required certifications and ongoing training",
    },
    marketing: {
      name: "Marketing Materials",
      minimums: { perItem: "$2" },
      defaults: { perItem: "$5" },
      note: "Branded materials, templates, collateral",
    },
    tools: {
      name: "Tools & Software",
      minimums: { monthly: "$10" },
      defaults: { monthly: "$20" },
      note: "CRM access, document tools, communication",
    },
    support: {
      name: "Support Services",
      minimums: { monthly: "$5" },
      defaults: { monthly: "$10" },
      note: "Technical and business support access",
    },
  },
  examples: [
    {
      scenario: "Child company charges contractor $50/month platform fee",
      breakdown: {
        total: "$50",
        childCompanyKeeps: "$25 (50%)",
        mgrCapitalReceives: "$25 (50%)",
      },
    },
    {
      scenario: "Child company charges $30 per lead assignment",
      breakdown: {
        total: "$30",
        childCompanyKeeps: "$15 (50%)",
        mgrCapitalReceives: "$15 (50%)",
      },
    },
  ],
};

// ============================================
// BILLING HELPERS
// ============================================

export interface ContractorBillingEntry {
  contractorId: string;
  childCompanyId: string;
  category: FeeCategory;
  description: string;
  amountCents: number;
  mgrCapitalShareCents: number;
  childCompanyShareCents: number;
  billingDate: Date;
}

/**
 * Create a billing entry for a contractor fee
 */
export function createBillingEntry(
  contractorId: string,
  childCompanyId: string,
  category: FeeCategory,
  amountCents: number,
  description: string
): ContractorBillingEntry {
  const split = calculateFeeSplit(amountCents, category);

  return {
    contractorId,
    childCompanyId,
    category,
    description,
    amountCents,
    mgrCapitalShareCents: split.mgrCapitalShare,
    childCompanyShareCents: split.childCompanyShare,
    billingDate: new Date(),
  };
}
