/**
 * WhiteLabelService.ts — MGR CAPITAL ASSISTANCE
 *
 * SERVICE BUREAU / ERO HIERARCHY MODEL
 * =====================================
 * Similar to tax preparation software (TaxAct → ERO → Tax Preparer → Client)
 *
 * Hierarchy:
 * - Platform (MGR Capital) - TOP LEVEL
 *   └── White-Label Owner (ERO equivalent) - Pays subscription, gets branded portal
 *       └── Sub-Agents (Tax Preparer equivalent) - Optional, pays cut to parent
 *           └── End Clients
 *
 * REVENUE FLOW (Shadow Accounting):
 * - Client pays for service: $100
 * - Platform takes 15% ($15) but shows as 10% "technology fee" to WL owner
 * - WL owner thinks they're getting $90, actually gets $85
 * - If sub-agent involved: Sub-agent gets 80%, WL owner gets 10%, Platform gets 10%
 *
 * WHITE-LABEL TIERS:
 * - Starter: Custom logo + colors ($99/month or $999/year)
 * - Professional: + Custom domain + email + 5 sub-agents ($299/month or $2,999/year)
 * - Enterprise: + API + unlimited sub-agents ($999/month or $9,999/year)
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
// CONFIGURATION — SHADOW ACCOUNTING
// =============================================================================

// What white-label owners SEE vs what platform ACTUALLY takes
const REVENUE_SPLIT = {
  // What the WL owner sees in their dashboard
  displayedPlatformFeePercent: 10,
  // What platform actually takes (HIDDEN)
  actualPlatformFeePercent: 15,
  // Sub-agent cut (if WL has sub-agents)
  subAgentCutPercent: 80,       // Sub-agent gets this
  subAgentParentCutPercent: 10, // WL owner gets this from sub-agent deals
  subAgentPlatformCutPercent: 10, // Platform gets this from sub-agent deals
};

// White-label pricing (in cents)
const WHITE_LABEL_PRICING = {
  starter: {
    monthly: 9900,      // $99/month
    yearly: 99900,      // $999/year (save 2 months)
    maxSubAgents: 0,    // No sub-agents
    features: [
      'Custom logo',
      'Custom color scheme',
      'Branded login page',
      'Branded client portal',
      'Custom email templates',
    ],
  },
  professional: {
    monthly: 29900,     // $299/month
    yearly: 299900,     // $2,999/year (save 2 months)
    maxSubAgents: 5,    // Up to 5 sub-agents
    features: [
      'Everything in Starter',
      'Custom domain (yourcompany.com)',
      'Professional email (@yourcompany.com)',
      'Custom SSL certificate',
      'Up to 5 sub-agents',
      'Priority support',
    ],
  },
  enterprise: {
    monthly: 99900,     // $999/month
    yearly: 999900,     // $9,999/year (save 2 months)
    maxSubAgents: -1,   // Unlimited sub-agents
    features: [
      'Everything in Professional',
      'API access',
      'Unlimited sub-agents',
      'Custom integrations',
      'Dedicated account manager',
      'Custom feature development',
      'White-glove onboarding',
      'SLA guarantee',
    ],
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
  // REVENUE CALCULATION (Shadow Accounting)
  // =============================================================================

  /**
   * Calculate revenue split for a transaction
   * Returns what each party SEES vs what they ACTUALLY get
   *
   * @param transactionAmountCents - Total transaction amount
   * @param whiteLabelConfigId - The white-label config processing this transaction
   * @returns Split details for display and actual accounting
   */
  calculateRevenueSplit(transactionAmountCents: number, isSubAgent: boolean = false): {
    // What the white-label owner/sub-agent SEES in their dashboard
    displayed: {
      grossAmount: number;
      platformFee: number;
      netToOwner: number;
      feeLabel: string;
    };
    // What ACTUALLY happens (HIDDEN from WL owner, FOUNDER ONLY)
    actual: {
      toWhiteLabelOwner: number;
      toParentWhiteLabel: number; // Only if sub-agent
      toPlatform: number;
    };
  } {
    if (isSubAgent) {
      // Sub-agent transaction
      // Sub-agent sees: 80% to them, 20% "platform/ERO fees"
      // Reality: 80% to sub-agent, 10% to parent WL, 10% to platform
      const subAgentCut = Math.round(transactionAmountCents * (REVENUE_SPLIT.subAgentCutPercent / 100));
      const parentCut = Math.round(transactionAmountCents * (REVENUE_SPLIT.subAgentParentCutPercent / 100));
      const platformCut = transactionAmountCents - subAgentCut - parentCut;

      return {
        displayed: {
          grossAmount: transactionAmountCents,
          platformFee: transactionAmountCents - subAgentCut, // They see 20% as "fees"
          netToOwner: subAgentCut,
          feeLabel: 'Platform & ERO Fees',
        },
        actual: {
          toWhiteLabelOwner: subAgentCut,
          toParentWhiteLabel: parentCut,
          toPlatform: platformCut,
        },
      };
    } else {
      // Direct white-label transaction (no sub-agent)
      // WL owner sees: 90% to them, 10% "technology fee"
      // Reality: 85% to WL owner, 15% to platform
      const displayedFee = Math.round(transactionAmountCents * (REVENUE_SPLIT.displayedPlatformFeePercent / 100));
      const displayedNet = transactionAmountCents - displayedFee;

      const actualPlatformCut = Math.round(transactionAmountCents * (REVENUE_SPLIT.actualPlatformFeePercent / 100));
      const actualToOwner = transactionAmountCents - actualPlatformCut;

      return {
        displayed: {
          grossAmount: transactionAmountCents,
          platformFee: displayedFee, // They see 10%
          netToOwner: displayedNet,   // They think they get 90%
          feeLabel: 'Technology Fee',
        },
        actual: {
          toWhiteLabelOwner: actualToOwner, // They actually get 85%
          toParentWhiteLabel: 0,
          toPlatform: actualPlatformCut, // Platform keeps 15%
        },
      };
    }
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
