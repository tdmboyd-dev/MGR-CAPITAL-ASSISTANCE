// ============================================
// CHILD COMPANY SERVICE — MGR CAPITAL ASSISTANCE
// Automatic offer system, shadow accounting, transfer rules
// Email domain pricing integrated
// ============================================

import { EmployeeTier } from "@prisma/client";

// Email domain type (matches schema enum)
type EmailDomainType = "MAIN_COMPANY" | "SUBDOMAIN" | "CUSTOM";
import { notificationService } from "./notificationService.js";
import { logger } from "../utils/logger.js";
import {
  EMAIL_PRICING,
  MGR_CAPITAL_BASE_FEES,
  calculateEmailRevenueSplit,
  validateChildCompanyEmailPricing,
} from "../config/emailPricing.js";
import prisma from "../lib/prisma.js";

// Shadow accounting constants
const HIDDEN_CASE_PERCENTAGE = 50; // 50% hidden off top of every case
const MIN_EMPLOYEES_FOR_ACTIVATION = 3;
const ACTIVATION_WINDOW_DAYS = 30;
const TRANSFER_COOLING_DAYS = 5;

// Tier-based commission rates (what employee gets of VISIBLE case value)
const TIER_RATES: Record<string, number> = {
  TIER_1_ASSOCIATE: 20,
  TIER_2_SPECIALIST: 40,
  TIER_3_SENIOR_SPECIALIST: 60,
  TIER_4_TEAM_LEADER: 80,
  TIER_5_EXECUTIVE_PARTNER: 100,
};

// Founder's cut of company profit at child companies (by employee tier)
const FOUNDER_PROFIT_SHARE: Record<string, number> = {
  TIER_1_ASSOCIATE: 40,
  TIER_2_SPECIALIST: 30,
  TIER_3_SENIOR_SPECIALIST: 0,
  TIER_4_TEAM_LEADER: 0,
  TIER_5_EXECUTIVE_PARTNER: 0,
};

interface ShadowBreakdown {
  realCaseValueCents: number;
  hiddenAmountCents: number;        // 50% off top -> Founder
  visibleCaseValueCents: number;    // What company/employees see
  employeeTier: string;
  employeeEarningsCents: number;    // What employee gets
  companyProfitCents: number;       // Visible case - employee earnings
  ownerShareCents: number;          // Owner's cut of company profit
  founderShareFromProfitCents: number; // Founder's cut of company profit
  founderTotalCents: number;        // Hidden + founder share from profit
  nextTierEarningsCents?: number;   // What next tier would pay (for employee display)
}

class ChildCompanyService {
  // ============================================
  // ELIGIBILITY CHECK
  // ============================================

  async checkEligibility(employeeId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    tier: string | null;
    teamSize: number;
    existingOffer: any | null;
  }> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeTier: true,
        teamMembers: { select: { id: true } },
      },
    });

    if (!employee) {
      return { eligible: false, reasons: ["Employee not found"], tier: null, teamSize: 0, existingOffer: null };
    }

    const reasons: string[] = [];
    const tier = employee.employeeTier;
    const teamSize = employee.teamMembers.length;

    // Check tier requirement (Tier 3+)
    const eligibleTiers: EmployeeTier[] = [
      "TIER_3_SENIOR_SPECIALIST",
      "TIER_4_TEAM_LEADER",
      "TIER_5_EXECUTIVE_PARTNER",
    ];

    if (!tier || !eligibleTiers.includes(tier)) {
      reasons.push("Must be Tier 3 (Senior Specialist) or above");
    }

    // Check team size requirement (3+ employees)
    if (teamSize < 3) {
      reasons.push(`Must have recruited/led at least 3 employees (current: ${teamSize})`);
    }

    // Check for existing active child company
    const existingCompany = await prisma.childCompany.findFirst({
      where: {
        ownerId: employeeId,
        status: { in: ["ACTIVE", "ACTIVATING", "OFFER_ACCEPTED"] },
      },
    });

    if (existingCompany) {
      reasons.push("Already has an active or pending child company");
    }

    // Check for existing offer
    const existingOffer = await prisma.childCompanyOffer.findFirst({
      where: {
        employeeId,
        isAccepted: false,
        isDeclined: false,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      eligible: reasons.length === 0,
      reasons,
      tier,
      teamSize,
      existingOffer,
    };
  }

  // ============================================
  // AUTOMATIC OFFER GENERATION
  // ============================================

  async generateOfferIfEligible(employeeId: string): Promise<{ offered: boolean; offerId?: string }> {
    const eligibility = await this.checkEligibility(employeeId);

    if (!eligibility.eligible) {
      return { offered: false };
    }

    // Check if there's already a pending offer
    if (eligibility.existingOffer) {
      // Re-send the existing offer
      await prisma.childCompanyOffer.update({
        where: { id: eligibility.existingOffer.id },
        data: {
          timesSent: { increment: 1 },
          lastSentAt: new Date(),
        },
      });

      return { offered: true, offerId: eligibility.existingOffer.id };
    }

    // Create new offer
    const offer = await prisma.childCompanyOffer.create({
      data: {
        employeeId,
        employeeTierAtOffer: eligibility.tier!,
        teamSizeAtOffer: eligibility.teamSize,
      },
    });

    // Send notification
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { email: true, name: true },
    });

    if (employee?.email) {
      await notificationService.sendEmployeeEmail({
        to: employee.email,
        toName: employee.name,
        subject: "You Qualify to Start Your Own Company Under MGR Capital!",
        body: `
Hi ${employee.name},

Based on your performance at ${eligibility.tier} and your team of ${eligibility.teamSize} employees, you now qualify to start your own recovery company under the MGR Capital umbrella.

Two plans are available:
- BRANDED ($300/year): Your company with MGR Capital co-branding, custom subdomain
- WHITE LABEL ($600/year): Full custom branding with your own domain

Log in to your dashboard to review the full details and accept the offer.

This offer does not expire. Take your time to make the best decision.

Best regards,
MGR Capital Assistance Team
        `.trim(),
        employeeId,
      });
    }

    return { offered: true, offerId: offer.id };
  }

  // ============================================
  // ACCEPT OFFER & CREATE COMPANY
  // ============================================

  async acceptOffer(
    offerId: string,
    params: {
      companyName: string;
      slug: string;
      plan: "BRANDED" | "WHITE_LABEL";
      emailDomainType: "SUBDOMAIN" | "CUSTOM";  // Email domain choice
      customDomain?: string;                     // Required if CUSTOM
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
    }
  ): Promise<{ success: boolean; childCompanyId?: string; error?: string }> {
    const offer = await prisma.childCompanyOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) return { success: false, error: "Offer not found" };
    if (offer.isAccepted) return { success: false, error: "Offer already accepted" };
    if (offer.isDeclined) return { success: false, error: "Offer was declined" };

    // Verify slug is unique
    const existingSlug = await prisma.childCompany.findUnique({
      where: { slug: params.slug },
    });
    if (existingSlug) return { success: false, error: "Company slug already taken" };

    // Get founder ID (first FOUNDER user)
    const founder = await prisma.user.findFirst({
      where: { role: "FOUNDER" },
      select: { id: true },
    });

    if (!founder) return { success: false, error: "System error: No founder found" };

    // Calculate fees based on email domain type
    const isCustomDomain = params.emailDomainType === "CUSTOM";
    const annualFee = isCustomDomain ? 60000 : 30000; // $600 custom, $300 subdomain
    const emailSetupFee = isCustomDomain
      ? EMAIL_PRICING.childCustom.setupFeeCents       // $30
      : EMAIL_PRICING.childSubdomain.setupFeeCents;   // $12
    const emailMonthlyFee = isCustomDomain
      ? EMAIL_PRICING.childCustom.monthlyFeeCents     // $15
      : EMAIL_PRICING.childSubdomain.monthlyFeeCents; // $8

    const activationDeadline = new Date();
    activationDeadline.setDate(activationDeadline.getDate() + ACTIVATION_WINDOW_DAYS);

    // Validate custom domain if provided
    if (isCustomDomain && !params.customDomain) {
      return { success: false, error: "Custom domain required for CUSTOM email domain type" };
    }

    // Create child company with email domain settings
    // Note: emailDomain* fields are new - run `npx prisma db push` to add them
    const childCompany = await prisma.childCompany.create({
      data: {
        founderId: founder.id,
        ownerId: offer.employeeId,
        companyName: params.companyName,
        slug: params.slug,
        status: "OFFER_ACCEPTED",
        plan: params.plan,
        subdomain: `${params.slug}.capitalmgr.com`,  // Portal subdomain always set
        customDomain: isCustomDomain ? params.customDomain : null,
        logoUrl: params.logoUrl,
        primaryColor: params.primaryColor || "#1a365d",
        secondaryColor: params.secondaryColor || "#2d3748",
        accentColor: params.accentColor || "#3182ce",
        annualFeeCents: annualFee,
        activationDeadline,
        // Email domain settings (new fields - run prisma db push)
        emailDomainType: isCustomDomain ? "CUSTOM" : "SUBDOMAIN",
        emailDomainLocked: false,
        emailSetupFeeCents: emailSetupFee,
        emailMonthlyFeeCents: emailMonthlyFee,
        employeeEmailSetupCents: 1200,
        employeeEmailMonthlyCents: 600,
      } as any, // Type cast needed until prisma client regenerated
    });

    // Update offer
    await prisma.childCompanyOffer.update({
      where: { id: offerId },
      data: {
        isAccepted: true,
        acceptedAt: new Date(),
        childCompanyId: childCompany.id,
        selectedPlan: params.plan,
      },
    });

    return { success: true, childCompanyId: childCompany.id };
  }

  // ============================================
  // SHADOW ACCOUNTING — Calculate case splits
  // ============================================

  calculateShadowBreakdown(
    realCaseValueCents: number,
    employeeTier: string,
    isChildCompany: boolean = false
  ): ShadowBreakdown {
    // Step 1: Hidden 50% off top -> Founder (ALWAYS)
    const hiddenAmountCents = Math.floor(realCaseValueCents * HIDDEN_CASE_PERCENTAGE / 100);
    const visibleCaseValueCents = realCaseValueCents - hiddenAmountCents;

    // Step 2: Employee earnings based on tier rate of VISIBLE value
    const tierRate = TIER_RATES[employeeTier] || 20;
    const employeeEarningsCents = Math.floor(visibleCaseValueCents * tierRate / 100);

    // Step 3: Company profit = visible - employee
    const companyProfitCents = visibleCaseValueCents - employeeEarningsCents;

    // Step 4: Split company profit between owner and founder
    let ownerShareCents: number;
    let founderShareFromProfitCents: number;

    if (isChildCompany) {
      const founderProfitShare = FOUNDER_PROFIT_SHARE[employeeTier] || 0;
      founderShareFromProfitCents = Math.floor(companyProfitCents * founderProfitShare / 100);
      ownerShareCents = companyProfitCents - founderShareFromProfitCents;
    } else {
      // MGR direct: Founder keeps 100% of company profit
      ownerShareCents = 0;
      founderShareFromProfitCents = companyProfitCents;
    }

    // Step 5: Founder's total = hidden + share from profit
    const founderTotalCents = hiddenAmountCents + founderShareFromProfitCents;

    // Step 6: Next tier potential (for employee display)
    const tierOrder = Object.keys(TIER_RATES);
    const currentIdx = tierOrder.indexOf(employeeTier);
    let nextTierEarningsCents: number | undefined;
    if (currentIdx >= 0 && currentIdx < tierOrder.length - 1) {
      const nextTier = tierOrder[currentIdx + 1];
      const nextRate = TIER_RATES[nextTier];
      nextTierEarningsCents = Math.floor(visibleCaseValueCents * nextRate / 100);
    }

    return {
      realCaseValueCents,
      hiddenAmountCents,
      visibleCaseValueCents,
      employeeTier,
      employeeEarningsCents,
      companyProfitCents,
      ownerShareCents,
      founderShareFromProfitCents,
      founderTotalCents,
      nextTierEarningsCents,
    };
  }

  // ============================================
  // EMPLOYEE TRANSFER — 5-day cooling period
  // ============================================

  async initiateTransfer(params: {
    employeeId: string;
    toChildCompanyId: string;
  }): Promise<{ success: boolean; transferId?: string; error?: string }> {
    const employee = await prisma.user.findUnique({
      where: { id: params.employeeId },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        ssn4: true,
        employeeTier: true,
      },
    });

    if (!employee) return { success: false, error: "Employee not found" };

    // Identity block: check if already employed elsewhere
    if (employee.ssn4 && employee.dateOfBirth) {
      const activeTransfer = await prisma.employeeTransfer.findFirst({
        where: {
          employeeSsn4: employee.ssn4,
          status: { in: ["PENDING", "COOLING_PERIOD"] },
        },
      });
      if (activeTransfer) {
        return { success: false, error: "Employee already has a pending transfer" };
      }
    }

    const coolingStartDate = new Date();
    const coolingEndDate = new Date();
    coolingEndDate.setDate(coolingEndDate.getDate() + TRANSFER_COOLING_DAYS);

    // Estimate monthly loss
    const recentEarnings = await prisma.ledgerEntry.aggregate({
      where: {
        userId: params.employeeId,
        type: "EMPLOYEE_COMMISSION",
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amountCents: true },
    });
    const estimatedMonthlyLoss = Math.floor((recentEarnings._sum.amountCents || 0) / 3);

    const transfer = await prisma.employeeTransfer.create({
      data: {
        employeeId: params.employeeId,
        toChildCompanyId: params.toChildCompanyId,
        status: "COOLING_PERIOD",
        coolingStartDate,
        coolingEndDate,
        currentCoolingDay: 1,
        employeeName: employee.name,
        employeeDob: employee.dateOfBirth,
        employeeSsn4: employee.ssn4,
        tierBeforeTransfer: employee.employeeTier,
        tierAfterTransfer: "TIER_1_ASSOCIATE",
        estimatedMonthlyLossCents: estimatedMonthlyLoss,
      },
    });

    return { success: true, transferId: transfer.id };
  }

  async cancelTransfer(transferId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const transfer = await prisma.employeeTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) return { success: false, error: "Transfer not found" };
    if (transfer.status !== "COOLING_PERIOD") {
      return { success: false, error: "Transfer can only be cancelled during cooling period" };
    }

    await prisma.employeeTransfer.update({
      where: { id: transferId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    return { success: true };
  }

  async completeTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    const transfer = await prisma.employeeTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) return { success: false, error: "Transfer not found" };
    if (transfer.status !== "COOLING_PERIOD") {
      return { success: false, error: "Transfer must be in cooling period" };
    }

    // Check cooling period has elapsed
    if (transfer.coolingEndDate && new Date() < transfer.coolingEndDate) {
      return { success: false, error: "Cooling period has not elapsed yet" };
    }

    // Reset tier to TIER_1
    await prisma.user.update({
      where: { id: transfer.employeeId },
      data: { employeeTier: "TIER_1_ASSOCIATE" },
    });

    // Complete transfer
    await prisma.employeeTransfer.update({
      where: { id: transferId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Increment child company employee count
    await prisma.childCompany.update({
      where: { id: transfer.toChildCompanyId },
      data: { employeeCount: { increment: 1 } },
    });

    return { success: true };
  }

  // ============================================
  // FOUNDER DASHBOARD — Revenue with shadow view
  // ============================================

  async getFounderChildCompanyRevenue(childCompanyId: string) {
    const company = await prisma.childCompany.findUnique({
      where: { id: childCompanyId },
      select: {
        id: true,
        companyName: true,
        ownerId: true,
        status: true,
        plan: true,
        employeeCount: true,
        lifetimeRevenueCents: true,
        lifetimeFounderCutCents: true,
        lifetimeOwnerCutCents: true,
      },
    });

    return company;
  }

  async getAllChildCompanies() {
    return prisma.childCompany.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        slug: true,
        ownerId: true,
        status: true,
        plan: true,
        employeeCount: true,
        lifetimeRevenueCents: true,
        lifetimeFounderCutCents: true,
        lifetimeOwnerCutCents: true,
        activatedAt: true,
        createdAt: true,
      },
    });
  }

  // ============================================
  // EMAIL DOMAIN & PRICING MANAGEMENT
  // ============================================

  /**
   * Update employee email pricing for child company
   * Owner can customize fees but cannot go below MGR Capital base
   * Child company gets 50% of anything over base
   */
  async updateEmployeeEmailPricing(
    childCompanyId: string,
    setupFeeCents: number,
    monthlyFeeCents: number
  ): Promise<{ success: boolean; error?: string }> {
    const validation = validateChildCompanyEmailPricing(setupFeeCents, monthlyFeeCents);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await prisma.childCompany.update({
      where: { id: childCompanyId },
      data: {
        employeeEmailSetupCents: setupFeeCents,
        employeeEmailMonthlyCents: monthlyFeeCents,
      },
    });

    logger.info("Employee email pricing updated", {
      childCompanyId,
      setupFeeCents,
      monthlyFeeCents,
    });

    return { success: true };
  }

  /**
   * Get email revenue breakdown for child company employee
   */
  getEmployeeEmailRevenueSplit(childCompany: {
    employeeEmailSetupCents: number;
    employeeEmailMonthlyCents: number;
  }): {
    mgrCapitalSetupCents: number;
    childCompanySetupCents: number;
    mgrCapitalMonthlyCents: number;
    childCompanyMonthlyCents: number;
  } {
    return calculateEmailRevenueSplit(
      childCompany.employeeEmailSetupCents,
      childCompany.employeeEmailMonthlyCents
    );
  }

  /**
   * Lock email domain after first case is started
   * CRITICAL: Cannot change domain type after this
   */
  async lockEmailDomain(childCompanyId: string): Promise<void> {
    await prisma.childCompany.update({
      where: { id: childCompanyId },
      data: {
        emailDomainLocked: true,
        emailDomainLockedAt: new Date(),
      },
    });

    logger.info("Email domain locked for child company", { childCompanyId });
  }

  /**
   * Check if domain change is allowed
   * Year-by-year basis, requires 0 active cases
   */
  async canChangeDomain(childCompanyId: string): Promise<{
    allowed: boolean;
    reason?: string;
    activeCases: number;
    pendingCases: number;
  }> {
    const childCompany = await prisma.childCompany.findUnique({
      where: { id: childCompanyId },
      select: {
        emailDomainLocked: true,
        nextBillingDate: true,
      },
    });

    if (!childCompany) {
      return { allowed: false, reason: "Child company not found", activeCases: 0, pendingCases: 0 };
    }

    // Count active and pending cases
    // TODO: Implement actual case counting logic based on schema
    const activeCases = 0; // Placeholder
    const pendingCases = 0; // Placeholder

    if (activeCases > 0) {
      return {
        allowed: false,
        reason: `Cannot change domain with ${activeCases} active case(s). All cases must be completed first.`,
        activeCases,
        pendingCases,
      };
    }

    if (pendingCases > 0) {
      return {
        allowed: false,
        reason: `Cannot change domain with ${pendingCases} pending case(s).`,
        activeCases,
        pendingCases,
      };
    }

    // Check if within 30 days of billing year end
    if (childCompany.nextBillingDate) {
      const now = new Date();
      const thirtyDaysBeforeBilling = new Date(childCompany.nextBillingDate);
      thirtyDaysBeforeBilling.setDate(thirtyDaysBeforeBilling.getDate() - 30);

      if (now < thirtyDaysBeforeBilling) {
        return {
          allowed: false,
          reason: `Domain changes can only be made within 30 days of billing year end (${childCompany.nextBillingDate.toLocaleDateString()}).`,
          activeCases,
          pendingCases,
        };
      }
    }

    return { allowed: true, activeCases, pendingCases };
  }

  /**
   * Get email pricing info for display
   */
  getEmailPricingInfo() {
    return {
      mainCompany: {
        setup: EMAIL_PRICING.mainCompany.setupFeeCents / 100,
        monthly: EMAIL_PRICING.mainCompany.monthlyFeeCents / 100,
      },
      childSubdomain: {
        setup: EMAIL_PRICING.childSubdomain.setupFeeCents / 100,
        monthly: EMAIL_PRICING.childSubdomain.monthlyFeeCents / 100,
        annualBuildFee: 300,
      },
      childCustom: {
        setup: EMAIL_PRICING.childCustom.setupFeeCents / 100,
        monthly: EMAIL_PRICING.childCustom.monthlyFeeCents / 100,
        annualBuildFee: 600,
      },
      childEmployee: {
        minSetup: MGR_CAPITAL_BASE_FEES.emailSetupCents / 100,
        minMonthly: MGR_CAPITAL_BASE_FEES.emailMonthlyCents / 100,
        revenueShare: 50, // Child company gets 50% over base
      },
    };
  }

  // ============================================
  // CONTRACTOR FEE MANAGEMENT
  // Child company sets fees, but MGR Capital always takes 50%
  // ============================================

  /**
   * Get contractor fee configuration for child company
   */
  async getContractorFees(childCompanyId: string): Promise<{
    fees: Record<string, number | string | null>;
    minimums: Record<string, number>;
    mgrCapitalSharePercent: number;
  } | null> {
    // Fetch company - new fields require prisma generate after schema update
    const company = await prisma.childCompany.findUnique({
      where: { id: childCompanyId },
    }) as any; // Type cast until prisma client regenerated

    if (!company) return null;

    return {
      fees: {
        platform: company.contractorPlatformFeeCents || 5000,
        leads: company.contractorLeadFeeCents || 2500,
        training: company.contractorTrainingFeeCents || 1500,
        marketing: company.contractorMarketingFeeCents || 500,
        tools: company.contractorToolsFeeCents || 2000,
        support: company.contractorSupportFeeCents || 1000,
        custom: company.contractorCustomFeeCents || 500,
        customLabel: company.contractorCustomFeeLabel || null,
      },
      minimums: {
        platform: 2500,    // $25 minimum
        leads: 1000,       // $10 minimum
        training: 500,     // $5 minimum
        marketing: 200,    // $2 minimum
        tools: 1000,       // $10 minimum
        support: 500,      // $5 minimum
        custom: 100,       // $1 minimum
      },
      mgrCapitalSharePercent: 50, // MGR Capital always takes 50%
    };
  }

  /**
   * Update contractor fees for child company
   * Validates minimums and calculates revenue split
   */
  async updateContractorFees(
    childCompanyId: string,
    fees: {
      platformFeeCents?: number;
      leadFeeCents?: number;
      trainingFeeCents?: number;
      marketingFeeCents?: number;
      toolsFeeCents?: number;
      supportFeeCents?: number;
      customFeeCents?: number;
      customFeeLabel?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    // Validate minimums
    const minimums = {
      platformFeeCents: 2500,
      leadFeeCents: 1000,
      trainingFeeCents: 500,
      marketingFeeCents: 200,
      toolsFeeCents: 1000,
      supportFeeCents: 500,
      customFeeCents: 100,
    };

    const errors: string[] = [];

    if (fees.platformFeeCents !== undefined && fees.platformFeeCents < minimums.platformFeeCents) {
      errors.push(`Platform fee must be at least $${(minimums.platformFeeCents / 100).toFixed(2)}`);
    }
    if (fees.leadFeeCents !== undefined && fees.leadFeeCents < minimums.leadFeeCents) {
      errors.push(`Lead fee must be at least $${(minimums.leadFeeCents / 100).toFixed(2)}`);
    }
    if (fees.trainingFeeCents !== undefined && fees.trainingFeeCents < minimums.trainingFeeCents) {
      errors.push(`Training fee must be at least $${(minimums.trainingFeeCents / 100).toFixed(2)}`);
    }
    if (fees.marketingFeeCents !== undefined && fees.marketingFeeCents < minimums.marketingFeeCents) {
      errors.push(`Marketing fee must be at least $${(minimums.marketingFeeCents / 100).toFixed(2)}`);
    }
    if (fees.toolsFeeCents !== undefined && fees.toolsFeeCents < minimums.toolsFeeCents) {
      errors.push(`Tools fee must be at least $${(minimums.toolsFeeCents / 100).toFixed(2)}`);
    }
    if (fees.supportFeeCents !== undefined && fees.supportFeeCents < minimums.supportFeeCents) {
      errors.push(`Support fee must be at least $${(minimums.supportFeeCents / 100).toFixed(2)}`);
    }
    if (fees.customFeeCents !== undefined && fees.customFeeCents < minimums.customFeeCents) {
      errors.push(`Custom fee must be at least $${(minimums.customFeeCents / 100).toFixed(2)}`);
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join("; ") };
    }

    const updateData: any = {};
    if (fees.platformFeeCents !== undefined) updateData.contractorPlatformFeeCents = fees.platformFeeCents;
    if (fees.leadFeeCents !== undefined) updateData.contractorLeadFeeCents = fees.leadFeeCents;
    if (fees.trainingFeeCents !== undefined) updateData.contractorTrainingFeeCents = fees.trainingFeeCents;
    if (fees.marketingFeeCents !== undefined) updateData.contractorMarketingFeeCents = fees.marketingFeeCents;
    if (fees.toolsFeeCents !== undefined) updateData.contractorToolsFeeCents = fees.toolsFeeCents;
    if (fees.supportFeeCents !== undefined) updateData.contractorSupportFeeCents = fees.supportFeeCents;
    if (fees.customFeeCents !== undefined) updateData.contractorCustomFeeCents = fees.customFeeCents;
    if (fees.customFeeLabel !== undefined) updateData.contractorCustomFeeLabel = fees.customFeeLabel;

    await prisma.childCompany.update({
      where: { id: childCompanyId },
      data: updateData,
    });

    logger.info("Contractor fees updated", { childCompanyId, fees });

    return { success: true };
  }

  /**
   * Calculate 50/50 split for any contractor fee
   */
  calculateContractorFeeSplit(amountCents: number): {
    total: number;
    mgrCapitalShare: number;
    childCompanyShare: number;
  } {
    const mgrCapitalShare = Math.floor(amountCents * 0.5);
    return {
      total: amountCents,
      mgrCapitalShare,
      childCompanyShare: amountCents - mgrCapitalShare,
    };
  }

  /**
   * Get all fee info for display (combined email + contractor)
   */
  getAllFeeInfo() {
    return {
      revenueShare: {
        description: "50/50 split on ALL contractor fees",
        mgrCapitalShare: 50,
        childCompanyShare: 50,
      },
      email: this.getEmailPricingInfo(),
      contractor: {
        platform: { default: 50, min: 25, unit: "monthly" },
        leads: { default: 25, min: 10, unit: "per lead" },
        training: { default: 15, min: 5, unit: "per course" },
        marketing: { default: 5, min: 2, unit: "per item" },
        tools: { default: 20, min: 10, unit: "monthly" },
        support: { default: 10, min: 5, unit: "monthly" },
        custom: { default: 5, min: 1, unit: "per use" },
      },
    };
  }
}

export const childCompanyService = new ChildCompanyService();
