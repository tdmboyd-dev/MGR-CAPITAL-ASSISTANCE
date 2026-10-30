// ============================================
// COMMISSION SERVICE — MGR CAPITAL ASSISTANCE
// Commission calculation with Prisma integration
// Shadow accounting: displayed rates vs actual rates
// ============================================

import { EmployeeTier } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { bankingService } from "./BankingService.js";
import { enforceStateFeeCap } from "../data/stateRules.js";

export interface CommissionPlan {
  id: string;
  tierName: string;
  tier: EmployeeTier;
  displayedRatePercent: number;
  actualRatePercent: number;
  overridePercent?: number;
}

// Commission tier configuration
// SHADOW ACCOUNTING: Actual rates determine payable dollars; legacy display rates are tier metadata only.
const TIER_CONFIG=Object.fromEntries(bankingService.getAllTiers().map(tier=>[tier.tier,{tierName:tier.displayName,tier:tier.tier,displayedRatePercent:tier.displayedRatePercent,actualRatePercent:tier.actualRatePercent,overridePercent:tier.overridePercent??undefined}])) as Record<EmployeeTier,Omit<CommissionPlan,'id'>>;

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
    if (!plan) throw new Error('Invalid employee tier');
    if(!Number.isSafeInteger(params.feeAmountCents)||params.feeAmountCents<0||params.feeAmountCents>2147483647)throw new Error('Invalid fee cents');
    return Math.round((params.feeAmountCents * plan.actualRatePercent) / 100);
  }

  /**
   * Calculate employee-facing payable commission
   * Owner decision: display and allocation must use the same payable dollars.
   */
  calculateDisplayedCommission(params: {
    tier: EmployeeTier | string;
    feeAmountCents: number;
  }): number {
    return this.calculateEmployeeCommission(params);
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
   * Get full payout breakdown for a case with STATE FEE CAP ENFORCEMENT
   * FOUNDER ONLY - shows actual amounts
   */
  calculateFullPayout(params: {
    surplusAmountCents: number;
    feePercent: number;
    employeeTier: EmployeeTier | string;
    state?: string;
  }): {
    surplusAmountCents: number;
    feeAmountCents: number;
    clientPayoutCents: number;
    employeeActualCommissionCents: number;
    employeeDisplayedCommissionCents: number;
    founderShareCents: number;
    companyFeeCents: number;
    feeCapApplied: boolean;
    feeCapReason: string | null;
    originalFeePercent: number;
    effectiveFeePercent: number;
  } {
    const { surplusAmountCents, feePercent, employeeTier, state } = params;

    // STATE FEE CAP ENFORCEMENT — auto-limit fee per state law
    let effectiveFeePercent = feePercent;
    let feeCapApplied = false;
    let feeCapReason: string | null = null;

    if (state) {
      const capResult = enforceStateFeeCap(state, feePercent, surplusAmountCents);
      effectiveFeePercent = capResult.effectiveFeePercent;
      feeCapApplied = capResult.wasCapped;
      feeCapReason = capResult.capReason;
    }

    // Calculate fee (what MGR keeps) — USING CAPPED RATE
    const feeAmountCents = Math.round((surplusAmountCents * effectiveFeePercent) / 100);

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
      feeCapApplied,
      feeCapReason,
      originalFeePercent: feePercent,
      effectiveFeePercent,
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
    return plan?.actualRatePercent || 10;
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
