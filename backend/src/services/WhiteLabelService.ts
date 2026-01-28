/**
 * WhiteLabelService.ts — MGR CAPITAL ASSISTANCE
 *
 * 4-TIER SERVICE BUREAU HIERARCHY MODEL
 * =====================================
 * Modeled after IRS tax preparation industry structure:
 *
 * LEVEL 0: Platform (MGR Capital) - TOP
 *   │
 * LEVEL 1: SERVICE BUREAU ($999/mo)
 *   │      - Large partners who brand their own company
 *   │      - Can have Sub-Service Bureaus and EROs under them
 *   │      - Gets 75% of downstream revenue (sees 85%, platform takes hidden 10%)
 *   │
 * LEVEL 2: SUB-SERVICE BUREAU ($499/mo)
 *   │      - Works under a Service Bureau
 *   │      - Can have EROs under them
 *   │      - Gets 65% of downstream revenue (sees 75%, parent takes hidden 10%)
 *   │
 * LEVEL 3: ERO - Electronic Return Originator ($199/mo)
 *   │      - Individual office/location
 *   │      - Can have Tax Preparers under them
 *   │      - Gets 55% of downstream revenue (sees 65%, parent takes hidden 10%)
 *   │
 * LEVEL 4: TAX PREPARER ($49/mo or revenue share only)
 *          - Individual agent/preparer
 *          - Lowest level, serves end clients directly
 *          - Gets 45% of revenue (sees 55%, ERO takes hidden 10%)
 *
 * REVENUE CASCADE (Shadow Accounting):
 * Client pays $100 for service:
 * - Tax Preparer sees: $100 gross - $45 "platform fees" = $55 net (actually gets $45)
 * - ERO takes: $10 hidden (Tax Preparer thinks fees go to "platform")
 * - Sub-SB takes: $10 hidden (ERO thinks it goes to "compliance")
 * - SB takes: $10 hidden (Sub-SB thinks it goes to "technology")
 * - Platform takes: $25 (the remaining true platform fee)
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
// CONFIGURATION — 4-TIER HIERARCHY & SHADOW ACCOUNTING
// =============================================================================

// Bureau hierarchy levels (Level 0 = Platform)
export type BureauLevel = 'SERVICE_BUREAU' | 'SUB_SERVICE_BUREAU' | 'ERO' | 'TAX_PREPARER';

// Revenue split by level - what each level SEES vs what they ACTUALLY get
// The magic: each level thinks the "fee" goes to platform, but parent levels take cuts
const HIERARCHY_CONFIG: Record<BureauLevel, {
  level: number;
  displayName: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  displayedFeePercent: number;  // What agent SEES as "platform fee"
  actualTakeHomePercent: number; // What agent ACTUALLY keeps
  hiddenParentCut: number;       // What parent takes (hidden from agent)
  canHaveChildren: BureauLevel[];
  maxChildren: number;           // -1 = unlimited
  features: string[];
}> = {
  SERVICE_BUREAU: {
    level: 1,
    displayName: 'Service Bureau',
    monthlyPriceCents: 99900,    // $999/month
    yearlyPriceCents: 999900,    // $9,999/year
    displayedFeePercent: 15,     // SB sees 15% "platform fee"
    actualTakeHomePercent: 75,   // SB actually gets 75%
    hiddenParentCut: 0,          // No parent (platform is parent)
    canHaveChildren: ['SUB_SERVICE_BUREAU', 'ERO'],
    maxChildren: -1,             // Unlimited
    features: [
      'Full company branding',
      'Custom domain & SSL',
      'Unlimited Sub-Service Bureaus',
      'Unlimited EROs',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'Priority support',
      'White-glove onboarding',
    ],
  },
  SUB_SERVICE_BUREAU: {
    level: 2,
    displayName: 'Sub-Service Bureau',
    monthlyPriceCents: 49900,    // $499/month
    yearlyPriceCents: 499900,    // $4,999/year
    displayedFeePercent: 25,     // Sub-SB sees 25% "platform fee"
    actualTakeHomePercent: 65,   // Sub-SB actually gets 65%
    hiddenParentCut: 10,         // Parent SB takes 10% (hidden)
    canHaveChildren: ['ERO'],
    maxChildren: 50,
    features: [
      'Company branding',
      'Custom domain & SSL',
      'Up to 50 EROs',
      'Branded client portal',
      'Custom email templates',
      'Priority support',
    ],
  },
  ERO: {
    level: 3,
    displayName: 'ERO (Electronic Return Originator)',
    monthlyPriceCents: 19900,    // $199/month
    yearlyPriceCents: 199900,    // $1,999/year
    displayedFeePercent: 35,     // ERO sees 35% "platform fee"
    actualTakeHomePercent: 55,   // ERO actually gets 55%
    hiddenParentCut: 10,         // Parent Sub-SB takes 10% (hidden)
    canHaveChildren: ['TAX_PREPARER'],
    maxChildren: 25,
    features: [
      'Office branding',
      'Custom logo & colors',
      'Up to 25 Tax Preparers',
      'Client management',
      'Document templates',
    ],
  },
  TAX_PREPARER: {
    level: 4,
    displayName: 'Tax Preparer',
    monthlyPriceCents: 4900,     // $49/month (or revenue share only: $0)
    yearlyPriceCents: 49900,     // $499/year
    displayedFeePercent: 45,     // TP sees 45% "platform fee"
    actualTakeHomePercent: 45,   // TP actually gets 45%
    hiddenParentCut: 10,         // Parent ERO takes 10% (hidden)
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

// Platform's actual cut from each level (what's left after cascade)
const PLATFORM_CUTS = {
  SERVICE_BUREAU: 25,       // Platform gets 25% from SB deals
  SUB_SERVICE_BUREAU: 25,   // Platform gets 25% (10% already taken by SB)
  ERO: 25,                  // Platform gets 25% (10% to SB, 10% to Sub-SB already taken)
  TAX_PREPARER: 25,         // Platform gets 25% (cascade: 10% ERO, 10% Sub-SB, 10% SB)
};

// Legacy pricing for backwards compatibility (maps to new hierarchy)
const WHITE_LABEL_PRICING = {
  starter: {
    monthly: 4900,       // Tax Preparer level
    yearly: 49900,
    maxSubAgents: 0,
    level: 'TAX_PREPARER' as BureauLevel,
    features: HIERARCHY_CONFIG.TAX_PREPARER.features,
  },
  professional: {
    monthly: 19900,      // ERO level
    yearly: 199900,
    maxSubAgents: 25,
    level: 'ERO' as BureauLevel,
    features: HIERARCHY_CONFIG.ERO.features,
  },
  enterprise: {
    monthly: 99900,      // Service Bureau level
    yearly: 999900,
    maxSubAgents: -1,
    level: 'SERVICE_BUREAU' as BureauLevel,
    features: HIERARCHY_CONFIG.SERVICE_BUREAU.features,
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
      where: { userId, status: { in: ['pending', 'under_review', 'approved', 'active'] } },
    });

    if (existing) {
      throw new Error('You already have an active or pending application');
    }

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
        tier: submission.tier,
        billingCycle: submission.billingCycle,
        status: 'pending',
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

    if (application.status !== 'pending' && application.status !== 'under_review') {
      throw new Error('Application already processed');
    }

    const updateData: any = {
      status: decision === 'approve' ? 'approved' : 'rejected',
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

    if (!application || application.status !== 'approved') {
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
        status: 'active',
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

    if (config.tier === 'starter') {
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
          createdById: config.userId,
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
          where: { userId: config.userId, status: 'active' },
          data: { status: 'suspended' },
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
      where: { status: { in: ['pending', 'under_review'] } },
      orderBy: { submittedAt: 'asc' },
    });

    return applications.map(this.mapApplication);
  }

  // =============================================================================
  // SUB-AGENT MANAGEMENT (Service Bureau/ERO Hierarchy)
  // =============================================================================

  /**
   * Add sub-agent under a white-label owner
   * Similar to how tax prep EROs add tax preparers under their umbrella
   */
  async addSubAgent(parentConfigId: string, subAgentUserId: string): Promise<WhiteLabelConfig> {
    const parentConfig = await prisma.whiteLabelConfig.findUnique({
      where: { id: parentConfigId },
      include: { subAgents: true },
    });

    if (!parentConfig) {
      throw new Error('Parent white-label config not found');
    }

    // Check tier allows sub-agents
    const tierPricing = WHITE_LABEL_PRICING[parentConfig.tier as WhiteLabelTier];
    if (tierPricing.maxSubAgents === 0) {
      throw new Error('Your tier does not allow sub-agents. Upgrade to Professional or Enterprise.');
    }

    // Check sub-agent limit
    if (tierPricing.maxSubAgents > 0 && parentConfig.subAgents.length >= tierPricing.maxSubAgents) {
      throw new Error(`Maximum sub-agents (${tierPricing.maxSubAgents}) reached. Upgrade to Enterprise for unlimited.`);
    }

    // Create sub-agent config (minimal branding, inherits from parent)
    const subAgentConfig = await prisma.whiteLabelConfig.create({
      data: {
        userId: subAgentUserId,
        companyName: `Sub-Agent of ${parentConfig.companyName}`,
        tier: 'STARTER', // Sub-agents are always starter tier
        primaryColor: parentConfig.primaryColor,
        secondaryColor: parentConfig.secondaryColor,
        accentColor: parentConfig.accentColor,
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        priceCents: 0, // Sub-agents don't pay subscription, they pay revenue cut
        parentWhiteLabelId: parentConfigId,
        maxSubAgents: 0, // Sub-agents can't have their own sub-agents
        platformFeePercent: REVENUE_SPLIT.subAgentPlatformCutPercent,
        displayedFeePercent: REVENUE_SPLIT.subAgentPlatformCutPercent + REVENUE_SPLIT.subAgentParentCutPercent,
        isActive: true,
      },
    });

    logger.info('Sub-agent added', { parentConfigId, subAgentUserId });

    return this.mapConfig(subAgentConfig);
  }

  /**
   * Remove sub-agent
   */
  async removeSubAgent(parentConfigId: string, subAgentConfigId: string): Promise<void> {
    const subAgent = await prisma.whiteLabelConfig.findUnique({
      where: { id: subAgentConfigId },
    });

    if (!subAgent || subAgent.parentWhiteLabelId !== parentConfigId) {
      throw new Error('Sub-agent not found or not under this white-label');
    }

    await prisma.whiteLabelConfig.update({
      where: { id: subAgentConfigId },
      data: { isActive: false },
    });

    logger.info('Sub-agent removed', { parentConfigId, subAgentConfigId });
  }

  /**
   * Get all sub-agents for a white-label owner
   */
  async getSubAgents(parentConfigId: string): Promise<WhiteLabelConfig[]> {
    const subAgents = await prisma.whiteLabelConfig.findMany({
      where: { parentWhiteLabelId: parentConfigId, isActive: true },
    });

    return subAgents.map(this.mapConfig);
  }

  // =============================================================================
  // REVENUE CALCULATION (4-Tier Shadow Accounting)
  // =============================================================================

  /**
   * Calculate revenue split for a transaction in the 4-tier hierarchy
   * Cascades up through: Tax Preparer → ERO → Sub-SB → SB → Platform
   *
   * @param transactionAmountCents - Total transaction amount
   * @param agentLevel - The bureau level of the agent processing this transaction
   * @returns Split details for display and actual accounting
   */
  calculateRevenueSplit(transactionAmountCents: number, agentLevel: BureauLevel): {
    // What the agent SEES in their dashboard
    displayed: {
      grossAmount: number;
      platformFee: number;       // What they THINK goes to platform
      netToAgent: number;        // What they THINK they keep
      feeLabel: string;
    };
    // What ACTUALLY happens (HIDDEN from agent, FOUNDER ONLY)
    actual: {
      toAgent: number;           // What agent actually gets
      toERO: number;             // ERO's hidden cut (if agent is Tax Preparer)
      toSubServiceBureau: number; // Sub-SB's hidden cut
      toServiceBureau: number;   // SB's hidden cut
      toPlatform: number;        // Platform's actual take
    };
    // Breakdown explanation (FOUNDER ONLY)
    explanation: string;
  } {
    const config = HIERARCHY_CONFIG[agentLevel];
    const displayedFee = Math.round(transactionAmountCents * (config.displayedFeePercent / 100));
    const displayedNet = transactionAmountCents - displayedFee;
    const actualToAgent = Math.round(transactionAmountCents * (config.actualTakeHomePercent / 100));

    // Calculate cascade based on level
    let toERO = 0, toSubSB = 0, toSB = 0, toPlatform = 0;

    switch (agentLevel) {
      case 'TAX_PREPARER':
        // Tax Preparer gets 45%, ERO gets 10%, Sub-SB gets 10%, SB gets 10%, Platform gets 25%
        toERO = Math.round(transactionAmountCents * 0.10);
        toSubSB = Math.round(transactionAmountCents * 0.10);
        toSB = Math.round(transactionAmountCents * 0.10);
        toPlatform = transactionAmountCents - actualToAgent - toERO - toSubSB - toSB;
        break;

      case 'ERO':
        // ERO gets 55%, Sub-SB gets 10%, SB gets 10%, Platform gets 25%
        toSubSB = Math.round(transactionAmountCents * 0.10);
        toSB = Math.round(transactionAmountCents * 0.10);
        toPlatform = transactionAmountCents - actualToAgent - toSubSB - toSB;
        break;

      case 'SUB_SERVICE_BUREAU':
        // Sub-SB gets 65%, SB gets 10%, Platform gets 25%
        toSB = Math.round(transactionAmountCents * 0.10);
        toPlatform = transactionAmountCents - actualToAgent - toSB;
        break;

      case 'SERVICE_BUREAU':
        // SB gets 75%, Platform gets 25%
        toPlatform = transactionAmountCents - actualToAgent;
        break;
    }

    // Generate explanation for founder
    const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
    let explanation = `Transaction: ${formatCents(transactionAmountCents)}\n`;
    explanation += `Agent (${config.displayName}) sees: ${formatCents(displayedNet)} net (${formatCents(displayedFee)} "fees")\n`;
    explanation += `Agent actually gets: ${formatCents(actualToAgent)} (${config.actualTakeHomePercent}%)\n`;
    if (toERO > 0) explanation += `ERO hidden cut: ${formatCents(toERO)}\n`;
    if (toSubSB > 0) explanation += `Sub-Service Bureau hidden cut: ${formatCents(toSubSB)}\n`;
    if (toSB > 0) explanation += `Service Bureau hidden cut: ${formatCents(toSB)}\n`;
    explanation += `Platform actual take: ${formatCents(toPlatform)}`;

    return {
      displayed: {
        grossAmount: transactionAmountCents,
        platformFee: displayedFee,
        netToAgent: displayedNet,
        feeLabel: this.getFeeLabel(agentLevel),
      },
      actual: {
        toAgent: actualToAgent,
        toERO,
        toSubServiceBureau: toSubSB,
        toServiceBureau: toSB,
        toPlatform,
      },
      explanation,
    };
  }

  /**
   * Get the fee label shown to agents (they think it's all platform fee)
   */
  private getFeeLabel(level: BureauLevel): string {
    switch (level) {
      case 'TAX_PREPARER': return 'Platform & Processing Fees';
      case 'ERO': return 'Platform & Compliance Fees';
      case 'SUB_SERVICE_BUREAU': return 'Platform & Technology Fees';
      case 'SERVICE_BUREAU': return 'Platform Fee';
      default: return 'Fees';
    }
  }

  /**
   * Get hierarchy configuration
   */
  getHierarchyConfig(): typeof HIERARCHY_CONFIG {
    return HIERARCHY_CONFIG;
  }

  /**
   * Get bureau level info
   */
  getBureauLevelInfo(level: BureauLevel): typeof HIERARCHY_CONFIG[BureauLevel] {
    return HIERARCHY_CONFIG[level];
  }

  /**
   * Get dashboard stats for white-label owner
   * Shows what they THINK they're earning (shadow accounting)
   */
  async getOwnerDashboardStats(configId: string): Promise<{
    // What owner SEES
    thisMonthGross: number;
    thisMonthFees: number;
    thisMonthNet: number;
    lifetimeGross: number;
    lifetimeFees: number;
    lifetimeNet: number;
    subAgentCount: number;
    // HIDDEN from owner (FOUNDER ONLY)
    actualThisMonthPlatformTake: number;
    actualLifetimePlatformTake: number;
  }> {
    const config = await prisma.whiteLabelConfig.findUnique({
      where: { id: configId },
      include: { subAgents: { where: { isActive: true } } },
    });

    if (!config) {
      throw new Error('Config not found');
    }

    // In production, these would be calculated from actual transaction records
    // For now, return placeholder structure
    const monthlyTransactions = 0; // Would query ledger
    const lifetimeTransactions = 0;

    const monthSplit = this.calculateRevenueSplit(monthlyTransactions);
    const lifetimeSplit = this.calculateRevenueSplit(lifetimeTransactions);

    return {
      thisMonthGross: monthSplit.displayed.grossAmount,
      thisMonthFees: monthSplit.displayed.platformFee,
      thisMonthNet: monthSplit.displayed.netToOwner,
      lifetimeGross: lifetimeSplit.displayed.grossAmount,
      lifetimeFees: lifetimeSplit.displayed.platformFee,
      lifetimeNet: lifetimeSplit.displayed.netToOwner,
      subAgentCount: config.subAgents.length,
      // HIDDEN
      actualThisMonthPlatformTake: monthSplit.actual.toPlatform,
      actualLifetimePlatformTake: lifetimeSplit.actual.toPlatform,
    };
  }

  /**
   * Get revenue split configuration
   */
  getRevenueSplitConfig(): typeof REVENUE_SPLIT {
    return REVENUE_SPLIT;
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
