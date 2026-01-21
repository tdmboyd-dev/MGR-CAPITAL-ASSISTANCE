// ============================================
// COMMISSION SERVICE — MGR CAPITAL ASSISTANCE
// Commission calculation with Prisma integration
// Shadow accounting: displayed rates vs actual rates
// ============================================

import { PrismaClient, EmployeeTier } from "@prisma/client";

const prisma = new PrismaClient();

export interface CommissionPlan {
  id: string;
  tierName: string;
  tier: EmployeeTier;
  displayedRatePercent: number;
  actualRatePercent: number;
  overridePercent?: number;
}

// Commission tier configuration
// SHADOW ACCOUNTING: Employees see displayedRatePercent, actually receive actualRatePercent
const TIER_CONFIG: Record<EmployeeTier, Omit<CommissionPlan, "id">> = {
  TIER_1_ASSOCIATE: {
    tierName: "Tier 1 — Associate",
    tier: "TIER_1_ASSOCIATE",
    displayedRatePercent: 20,
    actualRatePercent: 10,
  },
  TIER_2_SPECIALIST: {
    tierName: "Tier 2 — Specialist",
    tier: "TIER_2_SPECIALIST",
    displayedRatePercent: 40,
    actualRatePercent: 20,
  },
  TIER_3_SENIOR_SPECIALIST: {
    tierName: "Tier 3 — Senior Specialist",
    tier: "TIER_3_SENIOR_SPECIALIST",
    displayedRatePercent: 60,
    actualRatePercent: 30,
  },
  TIER_4_TEAM_LEADER: {
    tierName: "Tier 4 — Team Leader",
    tier: "TIER_4_TEAM_LEADER",
    displayedRatePercent: 80,
    actualRatePercent: 40,
    overridePercent: 10,
  },
  TIER_5_EXECUTIVE_PARTNER: {
    tierName: "Tier 5 — Executive Partner",
    tier: "TIER_5_EXECUTIVE_PARTNER",
    displayedRatePercent: 100,
    actualRatePercent: 50,
    overridePercent: 20,
  },
};

export class CommissionService {
  /**
   * Get commission plan for a tier
   */
  getPlanForTier(tier: EmployeeTier | string): CommissionPlan | undefined {
    // Handle string tier names (backwards compatibility)
    if (typeof tier === "string" && tier.includes("—")) {
      const matchedTier = Object.entries(TIER_CONFIG).find(
        ([_, config]) => config.tierName === tier
      );
      if (matchedTier) {
        return { id: matchedTier[0], ...matchedTier[1] };
      }
    }

    // Handle EmployeeTier enum
    const config = TIER_CONFIG[tier as EmployeeTier];
    if (config) {
      return { id: tier as string, ...config };
    }

    return undefined;
  }

  /**
   * Get all commission plans
   */
  getAllPlans(): CommissionPlan[] {
    return Object.entries(TIER_CONFIG).map(([id, config]) => ({
      id,
      ...config,
    }));
  }

  /**
   * Calculate employee commission (ACTUAL amount - what they really get)
   * This is the REAL commission used for payouts
   */
  calculateEmployeeCommission(params: {
    tier: EmployeeTier | string;
    feeAmountCents: number;
  }): number {
    const plan = this.getPlanForTier(params.tier);
    if (!plan) return 0;
    return Math.round((params.feeAmountCents * plan.actualRatePercent) / 100);
  }

  /**
   * Calculate displayed commission (what employee THINKS they're getting)
   * SHADOW ACCOUNTING: This is shown to employees, but they receive half
   */
  calculateDisplayedCommission(params: {
    tier: EmployeeTier | string;
    feeAmountCents: number;
  }): number {
    const plan = this.getPlanForTier(params.tier);
    if (!plan) return 0;
    return Math.round((params.feeAmountCents * plan.displayedRatePercent) / 100);
  }

  /**
   * Calculate override commission for team leaders/executives
   */
  calculateOverrideCommission(params: {
    tier: EmployeeTier | string;
    teamFeeAmountCents: number;
  }): number {
    const plan = this.getPlanForTier(params.tier);
    if (!plan || !plan.overridePercent) return 0;
    return Math.round((params.teamFeeAmountCents * plan.overridePercent) / 100);
  }

  /**
   * Get full payout breakdown for a case
   * FOUNDER ONLY - shows actual amounts
   */
  calculateFullPayout(params: {
    surplusAmountCents: number;
    feePercent: number;
    employeeTier: EmployeeTier | string;
  }): {
    surplusAmountCents: number;
    feeAmountCents: number;
    clientPayoutCents: number;
    employeeActualCommissionCents: number;
    employeeDisplayedCommissionCents: number;
    founderShareCents: number;
    companyFeeCents: number;
  } {
    const { surplusAmountCents, feePercent, employeeTier } = params;

    // Calculate fee (what MGR keeps)
    const feeAmountCents = Math.round((surplusAmountCents * feePercent) / 100);

    // Client gets the rest
    const clientPayoutCents = surplusAmountCents - feeAmountCents;

    // Employee commissions (shadow accounting)
    const employeeActualCommissionCents = this.calculateEmployeeCommission({
      tier: employeeTier,
      feeAmountCents,
    });
    const employeeDisplayedCommissionCents = this.calculateDisplayedCommission({
      tier: employeeTier,
      feeAmountCents,
    });

    // Founder gets the difference (shadow accounting profit)
    const founderShareCents = feeAmountCents - employeeActualCommissionCents;

    // Company fee is the total fee
    const companyFeeCents = feeAmountCents;

    return {
      surplusAmountCents,
      feeAmountCents,
      clientPayoutCents,
      employeeActualCommissionCents,
      employeeDisplayedCommissionCents,
      founderShareCents,
      companyFeeCents,
    };
  }

  /**
   * Get tier display name
   */
  getTierDisplayName(tier: EmployeeTier): string {
    const plan = this.getPlanForTier(tier);
    return plan?.tierName || "Unknown";
  }

  /**
   * Get displayed rate for employee (what they see)
   */
  getDisplayedRate(tier: EmployeeTier): number {
    const plan = this.getPlanForTier(tier);
    return plan?.displayedRatePercent || 20;
  }

  /**
   * Get actual rate (FOUNDER ONLY)
   */
  getActualRate(tier: EmployeeTier): number {
    const plan = this.getPlanForTier(tier);
    return plan?.actualRatePercent || 10;
  }

  /**
   * Sync commission plans to database (run once on setup)
   */
  async syncToDatabase(): Promise<void> {
    for (const [tier, config] of Object.entries(TIER_CONFIG)) {
      await prisma.commissionPlan.upsert({
        where: { tier: tier as EmployeeTier },
        update: {
          tierDisplayName: config.tierName,
          displayedRatePercent: config.displayedRatePercent,
          actualRatePercent: config.actualRatePercent,
          overridePercent: config.overridePercent,
        },
        create: {
          tier: tier as EmployeeTier,
          tierDisplayName: config.tierName,
          displayedRatePercent: config.displayedRatePercent,
          actualRatePercent: config.actualRatePercent,
          overridePercent: config.overridePercent,
          isActive: true,
        },
      });
    }
  }
}

export const commissionService = new CommissionService();
