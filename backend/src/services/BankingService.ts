// ============================================
// BANKING AI SERVICE — MGR CAPITAL ASSISTANCE
// Pending allocation and accounting views; external settlement remains unqualified
// Shadow accounting for employee commission display
// ============================================

import { EmployeeTier, LedgerEntryType } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { getOwnEmployeeEarnings } from "./EmployeeEarningsView.js";

// ============================================
// COMMISSION TIERS — Shadow Accounting
// Actual rates determine payable money; legacy display rates are separate tier metadata.
// ============================================

interface CommissionTierData {
  tier: EmployeeTier;
  displayName: string;
  displayedRatePercent: number;  // What employee sees
  actualRatePercent: number;     // What they actually get
  overridePercent: number | null; // Override on team members
  casesRequired: number | null;   // Cases needed for promotion
  revenueRequired: number | null; // Revenue needed for promotion
}

const COMMISSION_TIERS: CommissionTierData[] = [
  {
    tier: "TIER_1_ASSOCIATE",
    displayName: "Tier 1 — Associate",
    displayedRatePercent: 20,
    actualRatePercent: 10,
    overridePercent: null,
    casesRequired: null,
    revenueRequired: null
  },
  {
    tier: "TIER_2_SPECIALIST",
    displayName: "Tier 2 — Specialist",
    displayedRatePercent: 40,
    actualRatePercent: 20,
    overridePercent: null,
    casesRequired: 10,
    revenueRequired: 500000  // $5,000 in cents
  },
  {
    tier: "TIER_3_SENIOR_SPECIALIST",
    displayName: "Tier 3 — Senior Specialist",
    displayedRatePercent: 60,
    actualRatePercent: 30,
    overridePercent: null,
    casesRequired: 25,
    revenueRequired: 2000000  // $20,000 in cents
  },
  {
    tier: "TIER_4_TEAM_LEADER",
    displayName: "Tier 4 — Team Leader",
    displayedRatePercent: 80,
    actualRatePercent: 40,
    overridePercent: 10,
    casesRequired: 50,
    revenueRequired: 5000000  // $50,000 in cents
  },
  {
    tier: "TIER_5_EXECUTIVE_PARTNER",
    displayName: "Tier 5 — Executive Partner",
    displayedRatePercent: 100,
    actualRatePercent: 50,
    overridePercent: 20,
    casesRequired: 100,
    revenueRequired: 15000000  // $150,000 in cents
  }
];

// ============================================
// PAYOUT CALCULATION RESULT
// ============================================

export interface PayoutBreakdown {
  // Input
  surplusAmountCents: number;
  feePercent: number;

  // Company fee
  companyFeeCents: number;

  // Client payout
  clientPayoutCents: number;

  // Employee commission (actual)
  employeeCommissionCents: number;
  employeeDisplayedCommissionCents: number; // Employee-facing payable cents

  // Override (if team leader)
  overrideCommissionCents: number;
  overrideRecipientId: string | null;

  // Founder share (everything left)
  founderShareCents: number;

  // Validation
  isValid: boolean;
  totalDistributed: number;
}

// ============================================
// BANKING SERVICE CLASS
// ============================================

export class BankingService {
  // ----------------------------------------
  // COMMISSION TIERS
  // ----------------------------------------

  /**
   * Get commission tier data
   */
  getTier(tier: EmployeeTier): CommissionTierData | null {
    return COMMISSION_TIERS.find(t => t.tier === tier) || null;
  }

  /**
   * Get all tiers (FOUNDER ONLY)
   */
  getAllTiers(): CommissionTierData[] {
    return COMMISSION_TIERS.map(tier=>({...tier}));
  }

  /**
   * Get displayed tier info (EMPLOYEE SAFE)
   */
  getDisplayedTierInfo(tier: EmployeeTier): {
    name: string;
    commissionRate: string;
    nextTier: string | null;
    requirementsForNext: string | null;
  } {
    const tierData = this.getTier(tier);
    if (!tierData) {
      return {
        name: "Associate",
        commissionRate: "10% of company fee",
        nextTier: "Tier 2 — Specialist",
        requirementsForNext: "Complete 10 cases"
      };
    }

    const tierIndex = COMMISSION_TIERS.findIndex(t => t.tier === tier);
    const nextTier = tierIndex < COMMISSION_TIERS.length - 1
      ? COMMISSION_TIERS[tierIndex + 1]
      : null;

    let requirementsForNext: string | null = null;
    if (nextTier) {
      const parts = [];
      if (nextTier.casesRequired) {
        parts.push(`Complete ${nextTier.casesRequired} cases`);
      }
      if (nextTier.revenueRequired) {
        parts.push(`Generate $${(nextTier.revenueRequired / 100).toLocaleString()} in revenue`);
      }
      requirementsForNext = parts.join(" and ");
    }

    return {
      name: tierData.displayName,
      commissionRate: `${tierData.actualRatePercent}% of company fee`,
      nextTier: nextTier?.displayName || null,
      requirementsForNext
    };
  }

  // ----------------------------------------
  // PAYOUT CALCULATION
  // ----------------------------------------

  /**
   * Calculate full payout breakdown (FOUNDER ONLY)
   * This contains actual amounts - NEVER expose to employees or clients
   */
  calculatePayout(params: {
    surplusAmountCents: number;
    feePercent: number;
    employeeTier: EmployeeTier;
    teamLeaderId?: string;
    teamLeaderTier?: EmployeeTier;
  }): PayoutBreakdown {
    const { surplusAmountCents, feePercent, employeeTier, teamLeaderId, teamLeaderTier } = params;

    if (!Number.isSafeInteger(surplusAmountCents) || surplusAmountCents <= 0 || surplusAmountCents > 2147483647 || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) throw new Error("Invalid cents or fee percentage");
    // Get tier data
    const tierData = this.getTier(employeeTier);
    if (!tierData) {
      throw new Error("Invalid employee tier");
    }

    // Calculate company fee (what we charge client)
    const companyFeeCents = Math.round((surplusAmountCents * feePercent) / 100);

    // Calculate client payout
    const clientPayoutCents = surplusAmountCents - companyFeeCents;

    // Calculate employee commission (ACTUAL rate, not displayed)
    const employeeCommissionCents = Math.round(
      (companyFeeCents * tierData.actualRatePercent) / 100
    );

    // Employee-facing money is the actual payable allocation. Tier display scores remain separate.
    const employeeDisplayedCommissionCents = employeeCommissionCents;

    // Calculate override for team leader (if applicable)
    let overrideCommissionCents = 0;
    let overrideRecipientId: string | null = null;

    if (teamLeaderId && teamLeaderTier) {
      const leaderTierData = this.getTier(teamLeaderTier);
      if (leaderTierData?.overridePercent) {
        overrideCommissionCents = Math.round(
          (companyFeeCents * leaderTierData.overridePercent) / 100
        );
        overrideRecipientId = teamLeaderId;
      }
    }

    // Calculate founder share (everything left after commissions)
    const founderShareCents = companyFeeCents - employeeCommissionCents - overrideCommissionCents;

    // Validate total
    const totalDistributed = clientPayoutCents + employeeCommissionCents +
      overrideCommissionCents + founderShareCents;

    const isValid = totalDistributed === surplusAmountCents;

    return {
      surplusAmountCents,
      feePercent,
      companyFeeCents,
      clientPayoutCents,
      employeeCommissionCents,
      employeeDisplayedCommissionCents,
      overrideCommissionCents,
      overrideRecipientId,
      founderShareCents,
      isValid,
      totalDistributed
    };
  }

  /**
   * Calculate displayed earnings for employee (EMPLOYEE SAFE)
   * Shows actual payable dollars; legacy tier display points never multiply money.
   */
  calculateDisplayedEarnings(params: {
    companyFeeCents: number;
    employeeTier: EmployeeTier;
  }): number {
    if(!Number.isSafeInteger(params.companyFeeCents)||params.companyFeeCents<0||params.companyFeeCents>2147483647)throw new Error('Invalid fee cents');
    const tierData=this.getTier(params.employeeTier);if(!tierData)throw new Error('Invalid employee tier');
    return Math.round(params.companyFeeCents*tierData.actualRatePercent/100);
  }

  // ----------------------------------------
  // LEDGER MANAGEMENT
  // ----------------------------------------

  /**
   * Legacy entrypoint delegates to the audited pending planner (FOUNDER ONLY)
   */
  async createPayoutLedgerEntries(params: {
    caseId: string;
    employeeId: string;
    teamLeaderId?: string;
    founderId: string;
    clientId: string;
    payout: PayoutBreakdown;
  }): Promise<void> {
    const {caseId,employeeId,teamLeaderId,founderId,clientId,payout}=params;
    const record=await prisma.case.findUnique({where:{id:caseId},include:{assignedEmployee:{select:{teamLeaderId:true}}}});
    if(!record||record.clientId!==clientId||record.assignedEmployeeId!==employeeId||(teamLeaderId&&record.assignedEmployee?.teamLeaderId!==teamLeaderId))throw new Error('Allocation identities do not match the current case');
    const {planCasePayout}=await import('./PayoutPlanningService.js');
    await planCasePayout(founderId,caseId,payout.surplusAmountCents);
  }

  // ----------------------------------------
  // EARNINGS QUERIES
  // ----------------------------------------

  /**
   * Get employee actual payable allocations; legacy property names retained
   */
  async getEmployeeEarnings(employeeId: string): Promise<{
    displayedLifetimeCents: number;
    displayedMonthCents: number;
    displayedPendingCents: number;
    actualLifetimeCents: number;  // FOUNDER ONLY
    actualMonthCents: number;     // FOUNDER ONLY
  }> {
    const view=await getOwnEmployeeEarnings(employeeId);
    // Legacy property names retained for callers; all dollar fields use actual allocations.
    return {displayedLifetimeCents:view.lifetimeEarningsCents,displayedMonthCents:view.thisMonthCents,displayedPendingCents:view.pendingCents,actualLifetimeCents:view.lifetimeEarningsCents,actualMonthCents:view.thisMonthCents};
  }

  /**
   * Get founder financial summary (FOUNDER ONLY)
   */
  async getFounderSummary(): Promise<{
    totalRecoveredCents: number;
    totalFeesCents: number;
    founderShareCents: number;
    employeePayoutsCents: number;
    overridePayoutsCents: number;
    clientPayoutsCents: number;
    pendingPayoutsCents: number;
    casesCompleted: number;
    averageFeePercent: number;
  }> {
    // Get all completed cases
    const cases = await prisma.case.findMany({
      where: { status: "PAID" },
      select: {
        surplusAmountCents: true,
        feePercent: true,
        actualFeeCents: true
      }
    });

    // Get ledger totals
    const ledgerTotals = await prisma.ledgerEntry.groupBy({
      by: ["type"],
      _sum: { amountCents: true }
    });

    const getTotal = (type: LedgerEntryType) =>
      ledgerTotals.find(t => t.type === type)?._sum.amountCents || 0;

    const totalRecovered = cases.reduce((sum, c) => sum + c.surplusAmountCents, 0);
    const totalFees = cases.reduce((sum, c) => sum + (c.actualFeeCents || 0), 0);
    const avgFee = cases.length > 0
      ? cases.reduce((sum, c) => sum + c.feePercent, 0) / cases.length
      : 0;

    // Get pending payouts
    const pendingEntries = await prisma.ledgerEntry.aggregate({
      where: { isPaid: false, type: "COMMISSION" },
      _sum: { amountCents: true }
    });

    return {
      totalRecoveredCents: totalRecovered,
      totalFeesCents: totalFees,
      founderShareCents: getTotal("FOUNDER_SHARE"),
      employeePayoutsCents: getTotal("COMMISSION"),
      overridePayoutsCents: getTotal("OVERRIDE"),
      clientPayoutsCents: getTotal("CLIENT_PAYOUT"),
      pendingPayoutsCents: pendingEntries._sum.amountCents || 0,
      casesCompleted: cases.length,
      averageFeePercent: Math.round(avgFee * 10) / 10
    };
  }

  // ----------------------------------------
  // ANOMALY DETECTION
  // ----------------------------------------

  /**
   * Detect payout anomalies (FOUNDER ONLY)
   */
  async detectAnomalies(): Promise<Array<{
    type: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    description: string;
    caseId?: string;
    userId?: string;
  }>> {
    const anomalies: Array<{
      type: string;
      severity: "HIGH" | "MEDIUM" | "LOW";
      description: string;
      caseId?: string;
      userId?: string;
    }> = [];

    // Check for cases with unusual fee percentages
    const unusualFees = await prisma.case.findMany({
      where: {
        OR: [
          { feePercent: { lt: 20 } },
          { feePercent: { gt: 50 } }
        ]
      }
    });

    for (const c of unusualFees) {
      anomalies.push({
        type: "UNUSUAL_FEE",
        severity: "MEDIUM",
        description: `Case ${c.internalCode} has unusual fee: ${c.feePercent}%`,
        caseId: c.id
      });
    }

    // Check for ledger entries that don't add up
    const cases = await prisma.case.findMany({
      where: { status: "PAID" },
      include: {
        ledgerEntries: true
      }
    });

    for (const c of cases) {
      const totalLedger = c.ledgerEntries.reduce((sum, e) => sum + e.amountCents, 0);
      if (Math.abs(totalLedger - c.surplusAmountCents) > 100) { // Allow $1 rounding
        anomalies.push({
          type: "LEDGER_MISMATCH",
          severity: "HIGH",
          description: `Case ${c.internalCode}: Ledger total (${totalLedger}) doesn't match surplus (${c.surplusAmountCents})`,
          caseId: c.id
        });
      }
    }

    // Check for employees with unusually high commissions
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: {
        ledgerEntries: {
          where: { type: "COMMISSION" }
        }
      }
    });

    const avgCommission = employees.length > 0
      ? employees.reduce((sum, e) =>
          sum + e.ledgerEntries.reduce((s, l) => s + l.amountCents, 0), 0
        ) / employees.length
      : 0;

    for (const emp of employees) {
      const totalCommission = emp.ledgerEntries.reduce((sum, e) => sum + e.amountCents, 0);
      if (totalCommission > avgCommission * 3 && avgCommission > 0) {
        anomalies.push({
          type: "HIGH_COMMISSION",
          severity: "LOW",
          description: `Employee ${emp.name} has commission 3x above average`,
          userId: emp.id
        });
      }
    }

    return anomalies;
  }

  // ----------------------------------------
  // PAYOUT TIMING
  // ----------------------------------------

  /**
   * Suggest payout timing
   */
  suggestPayoutTiming(): {
    recommendation: string;
    nextPayoutDate: Date;
    unpaidCount: number;
  } {
    const now = new Date();

    // Suggest bi-weekly payouts on 1st and 15th
    let nextPayoutDate: Date;
    if (now.getDate() < 15) {
      nextPayoutDate = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
      nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return {
      recommendation: "Process payouts on the 1st and 15th of each month for predictable cash flow",
      nextPayoutDate,
      unpaidCount: 0 // Will be filled by caller
    };
  }

  /**
   * Mark entries as paid
   */
  async markEntriesAsPaid(
    entryIds: string[],
    paymentMethod: string,
    paymentRef: string
  ): Promise<void> {
    void entryIds;void paymentMethod;void paymentRef;
    throw new Error('Settlement cannot be recorded from a free-text reference. Qualified provider reconciliation is required.');
  }
}

export const bankingService = new BankingService();
