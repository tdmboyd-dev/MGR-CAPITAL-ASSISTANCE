// ============================================
// EMAIL PRICING — MGR CAPITAL ASSISTANCE
// Pricing structure for professional email accounts
// ============================================

/**
 * Email Domain Types
 *
 * MAIN_COMPANY: @capitalmgr.com (regular employees, Tier 1-2)
 * CHILD_SUBDOMAIN: @sarahsrecovery.capitalmgr.com (child company, subdomain option)
 * CHILD_CUSTOM: @sarahsrecovery.com (child company, custom domain option)
 */

export enum EmailDomainType {
  MAIN_COMPANY = "MAIN_COMPANY",          // @capitalmgr.com
  CHILD_SUBDOMAIN = "CHILD_SUBDOMAIN",    // @childcompany.capitalmgr.com
  CHILD_CUSTOM = "CHILD_CUSTOM",          // @childcompany.com
}

// ============================================
// MGR CAPITAL BASE FEES (in cents)
// These are the minimum fees - child companies cannot go below these
// ============================================

export const MGR_CAPITAL_BASE_FEES = {
  emailSetupCents: 800,         // $8 minimum setup (child company keeps 50% of anything over)
  emailMonthlyCents: 600,       // $6 minimum monthly (child company keeps 50% of anything over)
};

// ============================================
// PRICING STRUCTURE (in cents)
// ============================================

export const EMAIL_PRICING = {
  // Regular employee email @capitalmgr.com (Tier 1-2)
  mainCompany: {
    setupFeeCents: 1200,        // $12 setup
    monthlyFeeCents: 600,       // $6/month
    description: "Professional email @capitalmgr.com",
  },

  // Child company OWNER email (subdomain) @childcompany.capitalmgr.com
  // Note: $300/year build fee is separate (in ChildCompany.annualFeeCents)
  childSubdomain: {
    setupFeeCents: 1200,        // $12 setup
    monthlyFeeCents: 800,       // $8/month
    annualBuildFeeCents: 30000, // $300/year (stored in ChildCompany model)
    description: "Branded email @yourcompany.capitalmgr.com",
    minTier: 3,
  },

  // Child company OWNER email (custom domain) @childcompany.com
  // Note: $600/year build fee is separate (in ChildCompany.annualFeeCents)
  childCustom: {
    setupFeeCents: 3000,        // $30 setup
    monthlyFeeCents: 1500,      // $15/month
    annualBuildFeeCents: 60000, // $600/year (stored in ChildCompany model)
    description: "Custom domain email @yourcompany.com",
    minTier: 3,
  },

  // Employee UNDER child company (inherits parent's domain type)
  // Setup: Custom to brand's liking, minimum $8, child company gets 50% of anything over MGR fee
  // Monthly: $6/mo base, can be customized, child company gets 50% of anything over $6
  childEmployee: {
    minSetupFeeCents: 800,      // Minimum $8 setup (MGR Capital base)
    defaultSetupFeeCents: 1200, // Default $12 setup (child company customizable)
    minMonthlyFeeCents: 600,    // Minimum $6/month (MGR Capital base)
    defaultMonthlyFeeCents: 600,// Default $6/month (child company customizable)
    childCompanyRevenueShare: 50, // Child company gets 50% of anything over MGR base
    description: "Email under child company domain",
  },
};

// ============================================
// CHILD COMPANY EMAIL CUSTOMIZATION
// Child companies can set their own employee email pricing
// ============================================

export interface ChildCompanyEmailConfig {
  setupFeeCents: number;        // What child company charges employees for setup
  monthlyFeeCents: number;      // What child company charges employees monthly
}

/**
 * Calculate revenue split for child company employee email fees
 * Child company gets 50% of anything over MGR Capital's base fee
 */
export function calculateEmailRevenueSplit(
  chargedSetupCents: number,
  chargedMonthlyCents: number
): {
  mgrCapitalSetupCents: number;
  childCompanySetupCents: number;
  mgrCapitalMonthlyCents: number;
  childCompanyMonthlyCents: number;
} {
  const baseSetup = MGR_CAPITAL_BASE_FEES.emailSetupCents;
  const baseMonthly = MGR_CAPITAL_BASE_FEES.emailMonthlyCents;

  // Setup fee split
  const setupOverBase = Math.max(0, chargedSetupCents - baseSetup);
  const childSetupShare = Math.floor(setupOverBase * 0.5);
  const mgrSetupShare = chargedSetupCents - childSetupShare;

  // Monthly fee split
  const monthlyOverBase = Math.max(0, chargedMonthlyCents - baseMonthly);
  const childMonthlyShare = Math.floor(monthlyOverBase * 0.5);
  const mgrMonthlyShare = chargedMonthlyCents - childMonthlyShare;

  return {
    mgrCapitalSetupCents: mgrSetupShare,
    childCompanySetupCents: childSetupShare,
    mgrCapitalMonthlyCents: mgrMonthlyShare,
    childCompanyMonthlyCents: childMonthlyShare,
  };
}

/**
 * Validate child company's custom email pricing
 * Must be at least MGR Capital's base fees
 */
export function validateChildCompanyEmailPricing(
  setupFeeCents: number,
  monthlyFeeCents: number
): { valid: boolean; error?: string } {
  if (setupFeeCents < MGR_CAPITAL_BASE_FEES.emailSetupCents) {
    return {
      valid: false,
      error: `Setup fee must be at least $${(MGR_CAPITAL_BASE_FEES.emailSetupCents / 100).toFixed(2)}`,
    };
  }

  if (monthlyFeeCents < MGR_CAPITAL_BASE_FEES.emailMonthlyCents) {
    return {
      valid: false,
      error: `Monthly fee must be at least $${(MGR_CAPITAL_BASE_FEES.emailMonthlyCents / 100).toFixed(2)}`,
    };
  }

  return { valid: true };
}

// ============================================
// DOMAIN CONFIGURATION
// ============================================

export const DOMAIN_CONFIG = {
  // Main company domain
  mainDomain: "capitalmgr.com",

  // Mail server (Modoboa on Contabo VPS)
  mailServer: {
    hostname: process.env.MAIL_SERVER_HOSTNAME || "mail.capitalmgr.com",
    ip: process.env.MAIL_SERVER_IP || "217.77.14.51",
    smtpPort: 587,
    imapPort: 993,
    pop3Port: 995,
  },

  // Subdomain pattern for child companies
  // office.sarahsrecovery.capitalmgr.com -> portal access
  // @sarahsrecovery.capitalmgr.com -> email domain
  childSubdomainPattern: (companySlug: string) => `${companySlug}.capitalmgr.com`,

  // Portal subdomain pattern
  portalSubdomainPattern: (companySlug: string) => `office.${companySlug}.capitalmgr.com`,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get email domain for a child company based on their chosen type
 */
export function getChildCompanyEmailDomain(
  companySlug: string,
  domainType: EmailDomainType,
  customDomain?: string
): string {
  switch (domainType) {
    case EmailDomainType.CHILD_SUBDOMAIN:
      return `${companySlug}.${DOMAIN_CONFIG.mainDomain}`;
    case EmailDomainType.CHILD_CUSTOM:
      return customDomain || `${companySlug}.com`;
    default:
      return DOMAIN_CONFIG.mainDomain;
  }
}

/**
 * Get portal URL for a child company
 */
export function getChildCompanyPortalUrl(
  companySlug: string,
  domainType: EmailDomainType,
  customDomain?: string
): string {
  switch (domainType) {
    case EmailDomainType.CHILD_SUBDOMAIN:
      return `https://office.${companySlug}.${DOMAIN_CONFIG.mainDomain}`;
    case EmailDomainType.CHILD_CUSTOM:
      return `https://office.${customDomain || companySlug + '.com'}`;
    default:
      return `https://${DOMAIN_CONFIG.mainDomain}`;
  }
}

/**
 * Calculate setup and monthly fees for an email account
 */
export function calculateEmailFees(
  domainType: EmailDomainType,
  isChildEmployee: boolean = false
): { setupFeeCents: number; monthlyFeeCents: number } {
  if (isChildEmployee) {
    // Child company employees pay standard rate from parent's customized pricing
    return {
      setupFeeCents: EMAIL_PRICING.childEmployee.defaultSetupFeeCents,
      monthlyFeeCents: EMAIL_PRICING.childEmployee.defaultMonthlyFeeCents,
    };
  }

  switch (domainType) {
    case EmailDomainType.MAIN_COMPANY:
      return {
        setupFeeCents: EMAIL_PRICING.mainCompany.setupFeeCents,
        monthlyFeeCents: EMAIL_PRICING.mainCompany.monthlyFeeCents,
      };
    case EmailDomainType.CHILD_SUBDOMAIN:
      return {
        setupFeeCents: EMAIL_PRICING.childSubdomain.setupFeeCents,
        monthlyFeeCents: EMAIL_PRICING.childSubdomain.monthlyFeeCents,
      };
    case EmailDomainType.CHILD_CUSTOM:
      return {
        setupFeeCents: EMAIL_PRICING.childCustom.setupFeeCents,
        monthlyFeeCents: EMAIL_PRICING.childCustom.monthlyFeeCents,
      };
    default:
      return {
        setupFeeCents: EMAIL_PRICING.mainCompany.setupFeeCents,
        monthlyFeeCents: EMAIL_PRICING.mainCompany.monthlyFeeCents,
      };
  }
}

/**
 * Format email address for a user based on their company context
 */
export function formatEmailAddress(
  username: string,
  domainType: EmailDomainType,
  companySlug?: string,
  customDomain?: string
): string {
  const sanitizedUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[.-]|[.-]$/g, '')
    .substring(0, 64);

  switch (domainType) {
    case EmailDomainType.CHILD_SUBDOMAIN:
      if (!companySlug) throw new Error("Company slug required for subdomain email");
      return `${sanitizedUsername}@${companySlug}.${DOMAIN_CONFIG.mainDomain}`;
    case EmailDomainType.CHILD_CUSTOM:
      if (!customDomain) throw new Error("Custom domain required for custom email");
      return `${sanitizedUsername}@${customDomain}`;
    default:
      return `${sanitizedUsername}@${DOMAIN_CONFIG.mainDomain}`;
  }
}

/**
 * Pricing summary for display
 */
export const PRICING_SUMMARY = {
  mainCompany: {
    title: "MGR Capital Email",
    example: "john@capitalmgr.com",
    setup: "$12",
    monthly: "$6/mo",
    requirement: "Tier 1-2",
  },
  childSubdomain: {
    title: "Child Company Subdomain",
    example: "sarah@sarahsrecovery.capitalmgr.com",
    setup: "$12",
    monthly: "$8/mo",
    annualFee: "$300/year (brand build fee)",
    requirement: "Tier 3+",
  },
  childCustom: {
    title: "Child Company Custom Domain",
    example: "sarah@sarahsrecovery.com",
    setup: "$30",
    monthly: "$15/mo",
    annualFee: "$600/year (brand build fee)",
    requirement: "Tier 3+",
  },
  childEmployee: {
    title: "Employee Under Child Company",
    example: "john@sarahsrecovery.capitalmgr.com (or .com)",
    setup: "Custom (min $8, child co. gets 50% over)",
    monthly: "$6/mo (custom, child co. gets 50% over $6)",
    note: "Inherits parent company's domain choice. Cannot change after first case.",
  },
};

// ============================================
// DOMAIN LOCK RULES
// ============================================

/**
 * Domain Change Policy (Year-by-Year Basis):
 *
 * Domain type CAN be changed ONLY if:
 * 1. All cases are COMPLETED (none in progress)
 * 2. 0 active/started cases
 * 3. At the end of billing year
 *
 * Before change, auto-bot will:
 * 1. Archive all emails to data vault
 * 2. Export case records with old email references
 * 3. Set up forwarding from old domain to new domain
 * 4. Notify all contacts of email change
 *
 * If change is not possible (cases in progress):
 * - Must create NEW child company with new domain
 * - Manually migrate employees/cases
 * - Old emails remain accessible on old domain
 */

export interface DomainChangeEligibility {
  allowed: boolean;
  reason?: string;
  activeCasesCount: number;
  pendingCasesCount: number;
  billingYearEndsAt?: Date;
  requiresDataMigration: boolean;
}

/**
 * Check if a user can use a specific domain type based on their tier
 */
export function canUseDomainType(userTier: number, domainType: EmailDomainType): boolean {
  switch (domainType) {
    case EmailDomainType.MAIN_COMPANY:
      return true; // All tiers can use main company domain
    case EmailDomainType.CHILD_SUBDOMAIN:
    case EmailDomainType.CHILD_CUSTOM:
      return userTier >= 3; // Must be Tier 3+ for child company domains
    default:
      return false;
  }
}

/**
 * Check if a domain type change is allowed
 * Requires: 0 active cases, all cases completed, end of billing year
 */
export function canChangeDomainType(
  activeCasesCount: number,
  pendingCasesCount: number,
  billingYearEndsAt?: Date
): DomainChangeEligibility {
  const now = new Date();
  const isEndOfBillingYear = billingYearEndsAt
    ? now >= new Date(billingYearEndsAt.getTime() - 30 * 24 * 60 * 60 * 1000) // Within 30 days of end
    : false;

  // Check for active cases
  if (activeCasesCount > 0) {
    return {
      allowed: false,
      reason: `Cannot change domain with ${activeCasesCount} active case(s). All cases must be completed first.`,
      activeCasesCount,
      pendingCasesCount,
      billingYearEndsAt,
      requiresDataMigration: true,
    };
  }

  // Check for pending cases
  if (pendingCasesCount > 0) {
    return {
      allowed: false,
      reason: `Cannot change domain with ${pendingCasesCount} pending case(s). All cases must be completed or cancelled.`,
      activeCasesCount,
      pendingCasesCount,
      billingYearEndsAt,
      requiresDataMigration: true,
    };
  }

  // Check billing year timing
  if (!isEndOfBillingYear && billingYearEndsAt) {
    return {
      allowed: false,
      reason: `Domain changes can only be made at the end of your billing year. Your billing year ends ${billingYearEndsAt.toLocaleDateString()}.`,
      activeCasesCount,
      pendingCasesCount,
      billingYearEndsAt,
      requiresDataMigration: true,
    };
  }

  return {
    allowed: true,
    activeCasesCount: 0,
    pendingCasesCount: 0,
    billingYearEndsAt,
    requiresDataMigration: true, // Always requires migration even if allowed
  };
}

/**
 * Data retention requirements for domain change
 * Auto-bot must perform these before domain switch
 */
export const DOMAIN_CHANGE_DATA_RETENTION = {
  // Archive all emails to secure vault
  archiveEmails: true,
  // Export case records with email references
  exportCaseRecords: true,
  // Set up email forwarding from old to new domain (6 months)
  setupForwardingMonths: 6,
  // Notify all contacts of email change
  notifyContacts: true,
  // Retain old domain DNS for forwarding period
  retainOldDomainMonths: 12,
};
