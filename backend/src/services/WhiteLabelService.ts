/**
 * WhiteLabelService.ts — MGR CAPITAL ASSISTANCE
 *
 * 4-TIER PARTNER HIERARCHY MODEL
 * =====================================
 * Executive partner structure for probate surplus recovery:
 *
 * LEVEL 0: MGR Capital (Home Office)
 *   │
 * LEVEL 1: MANAGING PARTNER ($999/mo)
 *   │      - Regional leaders who run their own branded operation
 *   │      - Can bring on Executive Partners and Recovery Directors
 *   │      - Sees 85% after "Legal & Compliance Fees"
 *   │
 * LEVEL 2: EXECUTIVE PARTNER ($499/mo)
 *   │      - Works under a Managing Partner
 *   │      - Can bring on Recovery Directors
 *   │      - Sees 75% after "Filing & Processing Fees"
 *   │
 * LEVEL 3: RECOVERY DIRECTOR ($199/mo)
 *   │      - Runs an office/territory
 *   │      - Can bring on Recovery Specialists
 *   │      - Sees 65% after "Administrative Fees"
 *   │
 * LEVEL 4: RECOVERY SPECIALIST ($49/mo)
 *          - Individual agent serving clients
 *          - Sees 55% after "Processing & Document Fees"
 *
 * FEE STRUCTURE (What Partners See):
 * Each level sees professional fee names - never "platform":
 * - "Legal & Compliance Fee" (15%)
 * - "Filing & Processing Fee" (10%)
 * - "Administrative Fee" (10%)
 * - "Processing & Document Fee" (10%)
 *
 * BILLING:
 * - Monthly: Bill every month
 * - Yearly: Bill at 11 months (1 month early) for renewal
 * - Non-payment = immediate suspension, data retained 30 days
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION — 4-TIER PARTNER HIERARCHY & FEE STRUCTURE
// =============================================================================

// Partner hierarchy levels
export type PartnerLevel = 'MANAGING_PARTNER' | 'EXECUTIVE_PARTNER' | 'RECOVERY_DIRECTOR' | 'RECOVERY_SPECIALIST';

// Fee labels that hide the revenue split (partners never see "platform" mentioned)
const FEE_LABELS: Record<PartnerLevel, {
  primary: string;      // Main fee name shown
  breakdown: string[];  // Detailed breakdown if they ask
}> = {
  MANAGING_PARTNER: {
    primary: 'Legal & Compliance Fees',
    breakdown: ['Court filing support', 'Compliance monitoring', 'Legal document review'],
  },
  EXECUTIVE_PARTNER: {
    primary: 'Filing & Processing Fees',
    breakdown: ['Document processing', 'Court filing coordination', 'Records management'],
  },
  RECOVERY_DIRECTOR: {
    primary: 'Administrative & Filing Fees',
    breakdown: ['Administrative support', 'Filing assistance', 'Case coordination'],
  },
  RECOVERY_SPECIALIST: {
    primary: 'Processing & Document Fees',
    breakdown: ['Document preparation', 'Processing services', 'System access'],
  },
};

// Partner hierarchy configuration
const HIERARCHY_CONFIG: Record<PartnerLevel, {
  level: number;
  displayName: string;
  shortName: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  displayedFeePercent: number;  // What partner SEES as fees
  actualTakeHomePercent: number; // What partner ACTUALLY keeps
  hiddenParentCut: number;       // What parent takes (hidden)
  feeLabel: string;              // What the fee is called (not "platform")
  canHaveChildren: PartnerLevel[];
  maxChildren: number;
  features: string[];
}> = {
  MANAGING_PARTNER: {
    level: 1,
    displayName: 'Managing Partner',
    shortName: 'MP',
    monthlyPriceCents: 99900,    // $999/month
    yearlyPriceCents: 999900,    // $9,999/year
    displayedFeePercent: 15,     // Sees 15% "Legal & Compliance Fees"
    actualTakeHomePercent: 75,   // Actually gets 75%
    hiddenParentCut: 0,          // No parent
    feeLabel: FEE_LABELS.MANAGING_PARTNER.primary,
    canHaveChildren: ['EXECUTIVE_PARTNER', 'RECOVERY_DIRECTOR'],
    maxChildren: -1,
    features: [
      'Full company branding',
      'Custom domain & SSL',
      'Unlimited Executive Partners',
      'Unlimited Recovery Directors',
      'API access',
      'Custom integrations',
      'Dedicated success manager',
      'Priority support',
      'Executive onboarding',
    ],
  },
  EXECUTIVE_PARTNER: {
    level: 2,
    displayName: 'Executive Partner',
    shortName: 'EP',
    monthlyPriceCents: 49900,    // $499/month
    yearlyPriceCents: 499900,    // $4,999/year
    displayedFeePercent: 25,     // Sees 25% "Filing & Processing Fees"
    actualTakeHomePercent: 65,   // Actually gets 65%
    hiddenParentCut: 10,         // Parent MP takes 10% (hidden)
    feeLabel: FEE_LABELS.EXECUTIVE_PARTNER.primary,
    canHaveChildren: ['RECOVERY_DIRECTOR'],
    maxChildren: 50,
    features: [
      'Company branding',
      'Custom domain & SSL',
      'Up to 50 Recovery Directors',
      'Branded client portal',
      'Custom email templates',
      'Priority support',
    ],
  },
  RECOVERY_DIRECTOR: {
    level: 3,
    displayName: 'Recovery Director',
    shortName: 'RD',
    monthlyPriceCents: 19900,    // $199/month
    yearlyPriceCents: 199900,    // $1,999/year
    displayedFeePercent: 35,     // Sees 35% "Administrative & Filing Fees"
    actualTakeHomePercent: 55,   // Actually gets 55%
    hiddenParentCut: 10,         // Parent EP takes 10% (hidden)
    feeLabel: FEE_LABELS.RECOVERY_DIRECTOR.primary,
    canHaveChildren: ['RECOVERY_SPECIALIST'],
    maxChildren: 25,
    features: [
      'Office branding',
      'Custom logo & colors',
      'Up to 25 Recovery Specialists',
      'Client management',
      'Document templates',
    ],
  },
  RECOVERY_SPECIALIST: {
    level: 4,
    displayName: 'Recovery Specialist',
    shortName: 'RS',
    monthlyPriceCents: 4900,     // $49/month
    yearlyPriceCents: 49900,     // $499/year
    displayedFeePercent: 45,     // Sees 45% "Processing & Document Fees"
    actualTakeHomePercent: 45,   // Actually gets 45%
    hiddenParentCut: 10,         // Parent RD takes 10% (hidden)
    feeLabel: FEE_LABELS.RECOVERY_SPECIALIST.primary,
    canHaveChildren: [],
    maxChildren: 0,
    features: [
      'Personal profile',
      'Basic branding',
      'Client portal access',
      'Standard support',
    ],
  },
};

// Legacy pricing for backwards compatibility
const WHITE_LABEL_PRICING = {
  starter: {
    monthly: 4900,
    yearly: 49900,
    maxSubAgents: 0,
    level: 'RECOVERY_SPECIALIST' as PartnerLevel,
    features: HIERARCHY_CONFIG.RECOVERY_SPECIALIST.features,
  },
  professional: {
    monthly: 19900,
    yearly: 199900,
    maxSubAgents: 25,
    level: 'RECOVERY_DIRECTOR' as PartnerLevel,
    features: HIERARCHY_CONFIG.RECOVERY_DIRECTOR.features,
  },
  enterprise: {
    monthly: 99900,
    yearly: 999900,
    maxSubAgents: -1,
    level: 'MANAGING_PARTNER' as PartnerLevel,
    features: HIERARCHY_CONFIG.MANAGING_PARTNER.features,
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type WhiteLabelTier = 'starter' | 'professional' | 'enterprise';
export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'active' | 'suspended';

export interface WhiteLabelApplication {
  id: string;
  userId: string;
  companyName: string;
  companyWebsite?: string;
  businessLicense?: string;
  einNumber?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  tier: WhiteLabelTier;
  billingCycle: 'monthly' | 'yearly';
  status: ApplicationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  approvedAt?: Date;
  activatedAt?: Date;
}

export interface WhiteLabelConfig {
  id: string;
  userId: string;
  companyName: string;
  tier: WhiteLabelTier;

  // Branding
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Domain
  customDomain?: string;
  sslCertificateId?: string;

  // Email
  emailDomain?: string;
  supportEmail?: string;

  // Billing
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
  priceCents: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationSubmission {
  companyName: string;
  companyWebsite?: string;
  businessLicense?: string;
  einNumber?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  tier: WhiteLabelTier;
  billingCycle: 'monthly' | 'yearly';
  agreedToTerms: boolean;
}

// =============================================================================
// WHITE LABEL SERVICE
// =============================================================================

class WhiteLabelService {
  /**
   * Submit white-label application
   */
  async submitApplication(userId: string, submission: ApplicationSubmission): Promise<WhiteLabelApplication> {
    if (!submission.agreedToTerms) {
      throw new Error('Must agree to terms and conditions');
    }

    // Validate required fields
    if (!submission.companyName || !submission.contactName || !submission.contactEmail) {
      throw new Error('Missing required fields');
    }

    // Check for existing application
    const existing = await prisma.whiteLabelApplication.findFirst({
      where: { userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'] } },
    });

    if (existing) {
      throw new Error('You already have an active or pending application');
    }

    // Map tier string to enum
    const tierMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
      'starter': 'STARTER',
      'professional': 'PROFESSIONAL',
      'enterprise': 'ENTERPRISE',
      'STARTER': 'STARTER',
      'PROFESSIONAL': 'PROFESSIONAL',
      'ENTERPRISE': 'ENTERPRISE',
    };

    // Create application
    const application = await prisma.whiteLabelApplication.create({
      data: {
        userId,
        companyName: submission.companyName,
        companyWebsite: submission.companyWebsite,
        businessLicense: submission.businessLicense,
        einNumber: submission.einNumber,
        contactName: submission.contactName,
        contactEmail: submission.contactEmail,
        contactPhone: submission.contactPhone,
        tier: tierMap[submission.tier] || 'STARTER',
        billingCycle: submission.billingCycle,
        status: 'PENDING',
        submittedAt: new Date(),
      },
    });

    // Notify founder
    await this.notifyFounderOfApplication(application.id);

    logger.info('White-label application submitted', { userId, companyName: submission.companyName });

    return this.mapApplication(application);
  }

  /**
   * Review application (Founder/Admin only)
   */
  async reviewApplication(
    applicationId: string,
    reviewerId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<WhiteLabelApplication> {
    const application = await prisma.whiteLabelApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== 'PENDING' && application.status !== 'UNDER_REVIEW') {
      throw new Error('Application already processed');
    }

    const updateData: any = {
      status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    };

    if (decision === 'reject') {
      updateData.rejectionReason = reason || 'Application did not meet requirements';
    } else {
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.whiteLabelApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Send notification to applicant
    await this.notifyApplicantOfDecision(updated);

    logger.info('White-label application reviewed', {
      applicationId,
      decision,
      reviewerId,
    });

    return this.mapApplication(updated);
  }

  /**
   * Activate white-label account (after payment)
   */
  async activateWhiteLabel(applicationId: string): Promise<WhiteLabelConfig> {
    const application = await prisma.whiteLabelApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'APPROVED') {
      throw new Error('Application not approved');
    }

    const pricing = WHITE_LABEL_PRICING[application.tier as WhiteLabelTier];
    const priceCents = application.billingCycle === 'yearly' ? pricing.yearly : pricing.monthly;

    // Calculate next billing date (11 months for yearly to bill 1 month early)
    const nextBillingDate = new Date();
    if (application.billingCycle === 'yearly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 11); // Bill 1 month before renewal
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Create white-label config
    const config = await prisma.whiteLabelConfig.create({
      data: {
        userId: application.userId,
        companyName: application.companyName,
        tier: application.tier,
        primaryColor: '#1a365d',
        secondaryColor: '#2d3748',
        accentColor: '#3182ce',
        billingCycle: application.billingCycle,
        nextBillingDate,
        priceCents,
        isActive: true,
      },
    });

    // Update application status
    await prisma.whiteLabelApplication.update({
      where: { id: applicationId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    logger.info('White-label activated', { userId: application.userId, tier: application.tier });

    return this.mapConfig(config);
  }

  /**
   * Update branding settings
   */
  async updateBranding(
    configId: string,
    branding: {
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
    }
  ): Promise<WhiteLabelConfig> {
    const config = await prisma.whiteLabelConfig.update({
      where: { id: configId },
      data: {
        ...branding,
        updatedAt: new Date(),
      },
    });

    return this.mapConfig(config);
  }

  /**
   * Setup custom domain (Professional+ only)
   */
  async setupCustomDomain(configId: string, domain: string): Promise<{
    success: boolean;
    dnsRecords: { type: string; name: string; value: string }[];
    instructions: string;
  }> {
    const config = await prisma.whiteLabelConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new Error('Config not found');
    }

    if (config.tier === 'STARTER') {
      throw new Error('Custom domain requires Professional or Enterprise tier');
    }

    // DNS records needed
    const dnsRecords = [
      { type: 'CNAME', name: domain, value: 'custom.mgrcapital.com' },
      { type: 'TXT', name: `_verification.${domain}`, value: `mgr-verify=${configId}` },
    ];

    // Update config with pending domain
    await prisma.whiteLabelConfig.update({
      where: { id: configId },
      data: {
        customDomain: domain,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      dnsRecords,
      instructions: `
Add these DNS records to your domain registrar:

1. CNAME Record:
   - Name: ${domain}
   - Value: custom.mgrcapital.com

2. TXT Record (for verification):
   - Name: _verification.${domain}
   - Value: mgr-verify=${configId}

After adding these records, click "Verify Domain" in your dashboard.
DNS propagation may take up to 48 hours.
      `.trim(),
    };
  }

  /**
   * Check renewal and suspend if not paid
   */
  async checkRenewals(): Promise<{ renewed: number; suspended: number }> {
    const now = new Date();

    // Find configs due for renewal (billing date passed)
    const dueForRenewal = await prisma.whiteLabelConfig.findMany({
      where: {
        isActive: true,
        nextBillingDate: { lte: now },
      },
    });

    let renewed = 0;
    let suspended = 0;

    for (const config of dueForRenewal) {
      // Check if payment was made (would check LedgerEntry)
      const recentPayment = await prisma.ledgerEntry.findFirst({
        where: {
          userId: config.userId,
          type: 'FEE',
          amountCents: config.priceCents,
          createdAt: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });

      if (recentPayment) {
        // Extend subscription
        const nextDate = new Date(config.nextBillingDate);
        if (config.billingCycle === 'yearly') {
          nextDate.setMonth(nextDate.getMonth() + 11);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        await prisma.whiteLabelConfig.update({
          where: { id: config.id },
          data: { nextBillingDate: nextDate },
        });
        renewed++;
      } else {
        // Suspend account
        await prisma.whiteLabelConfig.update({
          where: { id: config.id },
          data: { isActive: false },
        });

        // Update application status
        await prisma.whiteLabelApplication.updateMany({
          where: { userId: config.userId, status: 'ACTIVE' },
          data: { status: 'SUSPENDED' },
        });

        suspended++;

        logger.warn('White-label suspended for non-payment', { configId: config.id });
      }
    }

    return { renewed, suspended };
  }

  /**
   * Get pricing info
   */
  getPricing(): typeof WHITE_LABEL_PRICING {
    return WHITE_LABEL_PRICING;
  }

  /**
   * Get user's white-label config
   */
  async getUserConfig(userId: string): Promise<WhiteLabelConfig | null> {
    const config = await prisma.whiteLabelConfig.findFirst({
      where: { userId, isActive: true },
    });

    return config ? this.mapConfig(config) : null;
  }

  /**
   * Get all pending applications (Founder only)
   */
  async getPendingApplications(): Promise<WhiteLabelApplication[]> {
    const applications = await prisma.whiteLabelApplication.findMany({
      where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      orderBy: { submittedAt: 'asc' },
    });

    return applications.map(this.mapApplication);
  }

  // =============================================================================
  // DOWNLINE MANAGEMENT (Partner Hierarchy)
  // =============================================================================

  /**
   * Add partner to downline
   * Managing Partner can add Executive Partners or Recovery Directors
   * Executive Partner can add Recovery Directors
   * Recovery Director can add Recovery Specialists
   */
  async addToDownline(parentConfigId: string, newPartnerUserId: string, partnerLevel: PartnerLevel): Promise<WhiteLabelConfig> {
    const parentConfig = await prisma.whiteLabelConfig.findUnique({
      where: { id: parentConfigId },
      include: { downline: true },
    });

    if (!parentConfig) {
      throw new Error('Partner config not found');
    }

    // Check parent can have this type of downline
    const parentLevel = (parentConfig.partnerLevel || 'RECOVERY_SPECIALIST') as PartnerLevel;
    const parentLevelConfig = HIERARCHY_CONFIG[parentLevel];

    if (!parentLevelConfig.canHaveChildren.includes(partnerLevel)) {
      throw new Error(`${parentLevelConfig.displayName} cannot add ${HIERARCHY_CONFIG[partnerLevel].displayName} to their downline`);
    }

    // Check downline limit
    if (parentLevelConfig.maxChildren > 0 && (parentConfig.downline?.length || 0) >= parentLevelConfig.maxChildren) {
      throw new Error(`Maximum downline (${parentLevelConfig.maxChildren}) reached`);
    }

    // Get new partner level config
    const newLevelConfig = HIERARCHY_CONFIG[partnerLevel];

    // Create downline partner config
    const newPartnerConfig = await prisma.whiteLabelConfig.create({
      data: {
        userId: newPartnerUserId,
        companyName: `Partner under ${parentConfig.companyName}`,
        tier: 'STARTER',
        partnerLevel: partnerLevel,
        primaryColor: parentConfig.primaryColor,
        secondaryColor: parentConfig.secondaryColor,
        accentColor: parentConfig.accentColor,
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        priceCents: newLevelConfig.monthlyPriceCents,
        parentPartnerId: parentConfigId,
        hierarchyDepth: newLevelConfig.level,
        maxDownline: newLevelConfig.maxChildren,
        displayedFeePercent: newLevelConfig.displayedFeePercent,
        displayedFeeLabel: newLevelConfig.feeLabel,
        actualTakeHomePercent: newLevelConfig.actualTakeHomePercent,
        hiddenUplineCut: newLevelConfig.hiddenParentCut,
        isActive: true,
      },
    });

    logger.info('Partner added to downline', { parentConfigId, newPartnerUserId, partnerLevel });

    return this.mapConfig(newPartnerConfig);
  }

  /**
   * Remove partner from downline
   */
  async removeFromDownline(parentConfigId: string, partnerConfigId: string): Promise<void> {
    const partner = await prisma.whiteLabelConfig.findUnique({
      where: { id: partnerConfigId },
    });

    if (!partner || partner.parentPartnerId !== parentConfigId) {
      throw new Error('Partner not found or not in your downline');
    }

    await prisma.whiteLabelConfig.update({
      where: { id: partnerConfigId },
      data: { isActive: false },
    });

    logger.info('Partner removed from downline', { parentConfigId, partnerConfigId });
  }

  /**
   * Get all partners in downline
   */
  async getDownline(parentConfigId: string): Promise<WhiteLabelConfig[]> {
    const downline = await prisma.whiteLabelConfig.findMany({
      where: { parentPartnerId: parentConfigId, isActive: true },
    });

    return downline.map(this.mapConfig);
  }

  // =============================================================================
  // REVENUE CALCULATION (4-Tier Partner Structure)
  // =============================================================================

  /**
   * Calculate revenue split for a transaction
   * Partners see professional fee names, never "platform"
   *
   * @param transactionAmountCents - Total transaction amount
   * @param partnerLevel - The partner level processing this transaction
   * @returns Split details for display and actual accounting
   */
  calculateRevenueSplit(transactionAmountCents: number, partnerLevel: PartnerLevel): {
    // What the partner SEES in their dashboard
    displayed: {
      grossAmount: number;
      fees: number;              // Labeled as professional fees
      netToPartner: number;
      feeLabel: string;          // "Processing & Document Fees" etc.
      feeBreakdown: string[];    // Detailed breakdown if they ask
    };
    // What ACTUALLY happens (FOUNDER ONLY - never shown to partners)
    actual: {
      toPartner: number;
      toRecoveryDirector: number;
      toExecutivePartner: number;
      toManagingPartner: number;
      toHomeOffice: number;      // MGR Capital
    };
    // Breakdown explanation (FOUNDER ONLY)
    founderView: string;
  } {
    const config = HIERARCHY_CONFIG[partnerLevel];
    const displayedFee = Math.round(transactionAmountCents * (config.displayedFeePercent / 100));
    const displayedNet = transactionAmountCents - displayedFee;
    const actualToPartner = Math.round(transactionAmountCents * (config.actualTakeHomePercent / 100));

    // Calculate cascade based on level
    let toRD = 0, toEP = 0, toMP = 0, toHomeOffice = 0;

    switch (partnerLevel) {
      case 'RECOVERY_SPECIALIST':
        // RS gets 45%, RD gets 10%, EP gets 10%, MP gets 10%, Home Office gets 25%
        toRD = Math.round(transactionAmountCents * 0.10);
        toEP = Math.round(transactionAmountCents * 0.10);
        toMP = Math.round(transactionAmountCents * 0.10);
        toHomeOffice = transactionAmountCents - actualToPartner - toRD - toEP - toMP;
        break;

      case 'RECOVERY_DIRECTOR':
        // RD gets 55%, EP gets 10%, MP gets 10%, Home Office gets 25%
        toEP = Math.round(transactionAmountCents * 0.10);
        toMP = Math.round(transactionAmountCents * 0.10);
        toHomeOffice = transactionAmountCents - actualToPartner - toEP - toMP;
        break;

      case 'EXECUTIVE_PARTNER':
        // EP gets 65%, MP gets 10%, Home Office gets 25%
        toMP = Math.round(transactionAmountCents * 0.10);
        toHomeOffice = transactionAmountCents - actualToPartner - toMP;
        break;

      case 'MANAGING_PARTNER':
        // MP gets 75%, Home Office gets 25%
        toHomeOffice = transactionAmountCents - actualToPartner;
        break;
    }

    // Generate founder-only explanation
    const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
    let founderView = `=== FOUNDER VIEW (CONFIDENTIAL) ===\n`;
    founderView += `Transaction: ${formatCents(transactionAmountCents)}\n`;
    founderView += `${config.displayName} sees: ${formatCents(displayedNet)} net after "${config.feeLabel}"\n`;
    founderView += `${config.displayName} actually receives: ${formatCents(actualToPartner)} (${config.actualTakeHomePercent}%)\n`;
    founderView += `---\n`;
    if (toRD > 0) founderView += `Recovery Director cut: ${formatCents(toRD)} (hidden)\n`;
    if (toEP > 0) founderView += `Executive Partner cut: ${formatCents(toEP)} (hidden)\n`;
    if (toMP > 0) founderView += `Managing Partner cut: ${formatCents(toMP)} (hidden)\n`;
    founderView += `Home Office (MGR Capital): ${formatCents(toHomeOffice)}\n`;
    founderView += `===================================`;

    return {
      displayed: {
        grossAmount: transactionAmountCents,
        fees: displayedFee,
        netToPartner: displayedNet,
        feeLabel: config.feeLabel,
        feeBreakdown: FEE_LABELS[partnerLevel].breakdown,
      },
      actual: {
        toPartner: actualToPartner,
        toRecoveryDirector: toRD,
        toExecutivePartner: toEP,
        toManagingPartner: toMP,
        toHomeOffice,
      },
      founderView,
    };
  }

  /**
   * Get what a partner sees for their earnings (no mention of platform)
   */
  getPartnerEarningsView(transactionAmountCents: number, partnerLevel: PartnerLevel): {
    gross: string;
    feeLabel: string;
    feeAmount: string;
    feeBreakdown: string[];
    net: string;
  } {
    const split = this.calculateRevenueSplit(transactionAmountCents, partnerLevel);
    const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

    return {
      gross: formatCents(split.displayed.grossAmount),
      feeLabel: split.displayed.feeLabel,
      feeAmount: formatCents(split.displayed.fees),
      feeBreakdown: split.displayed.feeBreakdown,
      net: formatCents(split.displayed.netToPartner),
    };
  }

  /**
   * Get hierarchy configuration
   */
  getHierarchyConfig(): typeof HIERARCHY_CONFIG {
    return HIERARCHY_CONFIG;
  }

  /**
   * Get partner level info
   */
  getPartnerLevelInfo(level: PartnerLevel): typeof HIERARCHY_CONFIG[PartnerLevel] {
    return HIERARCHY_CONFIG[level];
  }

  /**
   * Get fee labels
   */
  getFeeLabels(): typeof FEE_LABELS {
    return FEE_LABELS;
  }

  /**
   * Get dashboard stats for partner
   * Shows what they THINK they're earning (professional fee names)
   */
  async getPartnerDashboardStats(configId: string): Promise<{
    // What partner SEES (professional fee labels)
    thisMonthGross: number;
    thisMonthFees: number;
    thisMonthFeeLabel: string;
    thisMonthNet: number;
    lifetimeGross: number;
    lifetimeFees: number;
    lifetimeNet: number;
    downlineCount: number;
    // FOUNDER ONLY - never exposed to partner
    _founderOnly: {
      actualThisMonthHomeOfficeTake: number;
      actualLifetimeHomeOfficeTake: number;
    };
  }> {
    const config = await prisma.whiteLabelConfig.findUnique({
      where: { id: configId },
      include: { downline: { where: { isActive: true } } },
    });

    if (!config) {
      throw new Error('Config not found');
    }

    // Get partner level from config
    const partnerLevel = (config.partnerLevel || 'RECOVERY_SPECIALIST') as PartnerLevel;
    const levelConfig = HIERARCHY_CONFIG[partnerLevel];

    // In production, calculate from ledger entries
    // For now, use stored values from config
    const monthlyGross = config.lifetimeGrossCents || 0;
    const monthlyFees = config.lifetimeDisplayedFeesCents || 0;
    const monthlyNet = config.lifetimeNetCents || 0;
    const monthlyHomeOffice = config.lifetimeHomeOfficeCents || 0;

    return {
      thisMonthGross: monthlyGross,
      thisMonthFees: monthlyFees,
      thisMonthFeeLabel: levelConfig.feeLabel,
      thisMonthNet: monthlyNet,
      lifetimeGross: config.lifetimeGrossCents || 0,
      lifetimeFees: config.lifetimeDisplayedFeesCents || 0,
      lifetimeNet: config.lifetimeNetCents || 0,
      downlineCount: config.downline?.length || 0,
      // FOUNDER ONLY
      _founderOnly: {
        actualThisMonthHomeOfficeTake: monthlyHomeOffice,
        actualLifetimeHomeOfficeTake: config.lifetimeHomeOfficeCents || 0,
      },
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private async notifyFounderOfApplication(applicationId: string): Promise<void> {
    // Create founder focus item
    try {
      await prisma.founderFocusItem.create({
        data: {
          category: 'OPERATIONAL',
          priority: 7,
          title: 'New White-Label Application',
          description: `A new white-label application requires review. Application ID: ${applicationId}`,
          suggestedAction: 'Review application in Admin panel',
        },
      });
    } catch (error) {
      logger.error('Failed to notify founder', { error });
    }
  }

  private async notifyApplicantOfDecision(application: any): Promise<void> {
    // Would send email notification
    logger.info('Applicant notified of decision', {
      userId: application.userId,
      status: application.status,
    });
  }

  private mapApplication(app: any): WhiteLabelApplication {
    return {
      id: app.id,
      userId: app.userId,
      companyName: app.companyName,
      companyWebsite: app.companyWebsite,
      businessLicense: app.businessLicense,
      einNumber: app.einNumber,
      contactName: app.contactName,
      contactEmail: app.contactEmail,
      contactPhone: app.contactPhone,
      tier: app.tier,
      billingCycle: app.billingCycle,
      status: app.status,
      submittedAt: app.submittedAt,
      reviewedAt: app.reviewedAt,
      reviewedBy: app.reviewedBy,
      rejectionReason: app.rejectionReason,
      approvedAt: app.approvedAt,
      activatedAt: app.activatedAt,
    };
  }

  private mapConfig(config: any): WhiteLabelConfig {
    return {
      id: config.id,
      userId: config.userId,
      companyName: config.companyName,
      tier: config.tier,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
      customDomain: config.customDomain,
      sslCertificateId: config.sslCertificateId,
      emailDomain: config.emailDomain,
      supportEmail: config.supportEmail,
      billingCycle: config.billingCycle,
      nextBillingDate: config.nextBillingDate,
      priceCents: config.priceCents,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const whiteLabelService = new WhiteLabelService();
export default whiteLabelService;
