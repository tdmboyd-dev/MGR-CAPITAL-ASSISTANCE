// ============================================
// PAYOUT BOT — MGR CAPITAL ASSISTANCE
// Aggressive automation: auto-process, optimize,
// reconcile, forecast, invoice, crypto surplus,
// revenue leak detection, smart disbursement
// ============================================

import {
  OpsInsightType,
  OpsInsightPriority,
  LedgerEntryType,
  LedgerEntryStatus,
  CaseStatus,
  EmployeeTier,
} from "@prisma/client";
import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

const BOT_NAME = "payoutBot";

// ============================================
// INTERFACES
// ============================================

interface PayoutAnalysis {
  period: string;
  totalPayouts: number;
  totalClientPayoutCents: number;
  totalEmployeeCommissionCents: number;
  totalFounderShareCents: number;
  anomalies: PayoutAnomaly[];
  consistencyChecks: ConsistencyCheck[];
  recommendations: string[];
}

interface PayoutAnomaly {
  type: "large_payout" | "unusual_timing" | "commission_variance" | "multiple_same_day";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  caseId?: string;
  userId?: string;
  data: any;
}

interface ConsistencyCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface PayoutSplit {
  clientPayoutCents: number;
  companyFeeCents: number;
  employeeCommissionCents: number;
  founderShareCents: number;
  employeeTier: string;
  feePercent: number;
}

interface FeeOptimizationResult {
  caseId: string;
  currentFeePercent: number;
  optimalFeePercent: number;
  stateFeeCap: number;
  currentRevenueCents: number;
  optimalRevenueCents: number;
  additionalRevenueCents: number;
  reasoning: string;
}

interface RevenueLeak {
  caseId: string;
  internalCode: string;
  leakType: "undercharged_fee" | "missed_surplus" | "stale_awaiting_funds" | "uncollected_interest" | "abandoned_case";
  estimatedLossCents: number;
  description: string;
  recommendation: string;
}

interface ReconciliationResult {
  totalMatched: number;
  totalUnmatched: number;
  totalDiscrepancies: number;
  matches: ReconciliationMatch[];
  discrepancies: ReconciliationDiscrepancy[];
  unmatchedPayments: UnmatchedPayment[];
}

interface ReconciliationMatch {
  caseId: string;
  expectedCents: number;
  receivedCents: number;
  status: "exact" | "within_tolerance";
}

interface ReconciliationDiscrepancy {
  caseId: string;
  internalCode: string;
  expectedCents: number;
  receivedCents: number;
  differenceCents: number;
  percentVariance: number;
}

interface UnmatchedPayment {
  ledgerEntryId: string;
  amountCents: number;
  createdAt: Date;
  description: string;
}

interface PaymentForecast {
  forecastDays: number;
  expectedPayments: ForecastedPayment[];
  totalExpectedCents: number;
  confidenceScore: number;
  byState: Record<string, { count: number; totalCents: number; avgDaysToPayment: number }>;
  byWeek: Record<string, { count: number; totalCents: number }>;
}

interface ForecastedPayment {
  caseId: string;
  internalCode: string;
  state: string;
  county: string;
  expectedAmountCents: number;
  expectedDate: Date;
  confidence: "high" | "medium" | "low";
  daysUntilExpected: number;
}

interface CryptoSurplusResult {
  caseId: string;
  exchangeSource: string;
  assetType: string;
  estimatedValueCents: number;
  claimStatus: "identified" | "filed" | "approved" | "disbursed" | "rejected";
  bankruptcyProceeding: string;
  notes: string;
}

interface InvoiceData {
  invoiceNumber: string;
  caseId: string;
  clientName: string;
  clientAddress: string;
  surplusAmountCents: number;
  feePercent: number;
  feeCents: number;
  clientPayoutCents: number;
  lineItems: InvoiceLineItem[];
  generatedAt: Date;
  dueDate: Date;
  status: "draft" | "sent" | "paid";
}

interface InvoiceLineItem {
  description: string;
  amountCents: number;
}

interface DisbursementDecision {
  caseId: string;
  method: "ACH" | "WIRE" | "CHECK";
  amountCents: number;
  reasoning: string;
  estimatedDeliveryDays: number;
  feeCents: number;
}

interface PaymentVelocity {
  caseId: string;
  internalCode: string;
  filedAt: Date | null;
  fundsReceivedAt: Date | null;
  fundsDisbursedAt: Date | null;
  filingToReceiptDays: number | null;
  receiptToDisbursementDays: number | null;
  totalVelocityDays: number | null;
}

interface AutoProcessResult {
  caseId: string;
  success: boolean;
  split: PayoutSplit | null;
  disbursement: DisbursementDecision | null;
  invoice: InvoiceData | null;
  ledgerEntries: string[];
  errors: string[];
}

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

// Thresholds
const LARGE_PAYOUT_THRESHOLD_CENTS = 10000000; // $100,000
const COMMISSION_VARIANCE_THRESHOLD = 20; // 20% variance from expected
const RECONCILIATION_TOLERANCE_CENTS = 100; // $1 tolerance for rounding
const STALE_AWAITING_FUNDS_DAYS = 90; // Flag cases waiting >90 days

// Commission rates by tier (actual rates from shadow accounting)
const COMMISSION_RATES: Record<string, number> = {
  TIER_1_ASSOCIATE: 10,
  TIER_2_SPECIALIST: 20,
  TIER_3_SENIOR_SPECIALIST: 30,
  TIER_4_TEAM_LEADER: 40,
  TIER_5_EXECUTIVE_PARTNER: 50,
};

// Displayed commission rates (what employees see)
const DISPLAYED_COMMISSION_RATES: Record<string, number> = {
  TIER_1_ASSOCIATE: 20,
  TIER_2_SPECIALIST: 40,
  TIER_3_SENIOR_SPECIALIST: 60,
  TIER_4_TEAM_LEADER: 80,
  TIER_5_EXECUTIVE_PARTNER: 100,
};

// State fee caps — maximum fee percentage allowed by law
const STATE_FEE_CAPS: Record<string, number> = {
  TN: 35, GA: 25, TX: 33, FL: 25, AL: 30,
  SC: 30, NC: 33, MS: 33, OH: 33, PA: 33,
  IL: 30, NY: 33, CA: 25, VA: 33, NJ: 33,
  MD: 30, MI: 33, IN: 33, KY: 33, LA: 33,
  AR: 33, MO: 33, WI: 33, MN: 33, IA: 33,
  AZ: 33, NV: 30, CO: 33, OR: 33, WA: 33,
};

// Default fee cap if state not listed
const DEFAULT_FEE_CAP = 33;

// Crypto exchange bankruptcy sources
const CRYPTO_EXCHANGES: Record<string, { bankruptcyCase: string; trustee: string; claimPortal: string }> = {
  FTX: {
    bankruptcyCase: "In re FTX Trading Ltd., Case No. 22-11068 (JTD)",
    trustee: "John J. Ray III",
    claimPortal: "https://cases.ra.kroll.com/FTX/",
  },
  CELSIUS: {
    bankruptcyCase: "In re Celsius Network LLC, Case No. 22-10964 (MG)",
    trustee: "Fahrenheit LLC",
    claimPortal: "https://cases.stretto.com/celsius/",
  },
  BLOCKFI: {
    bankruptcyCase: "In re BlockFi Inc., Case No. 22-19361 (MBK)",
    trustee: "BlockFi Distribution Committee",
    claimPortal: "https://cases.ra.kroll.com/blockfi/",
  },
  VOYAGER: {
    bankruptcyCase: "In re Voyager Digital Holdings, Case No. 22-10943 (MEW)",
    trustee: "Voyager Unsecured Creditors Committee",
    claimPortal: "https://cases.stretto.com/voyager/",
  },
};

// Disbursement thresholds
const WIRE_THRESHOLD_CENTS = 5000000; // $50k+ use wire
const CHECK_THRESHOLD_CENTS = 50000; // Under $500 use check
const ACH_FEE_CENTS = 0; // ACH is free
const WIRE_FEE_CENTS = 2500; // $25 wire fee
const CHECK_FEE_CENTS = 150; // $1.50 check + postage

// Average days from filing to payment by state (historical)
const STATE_AVG_PAYMENT_DAYS: Record<string, number> = {
  TN: 45, GA: 60, TX: 75, FL: 90, AL: 55,
  SC: 50, NC: 65, MS: 70, OH: 60, PA: 80,
  IL: 75, NY: 120, CA: 90, VA: 55, NJ: 85,
};

const DEFAULT_AVG_PAYMENT_DAYS = 70;

// ============================================
// PAYOUT BOT CLASS
// ============================================

class PayoutBot {
  // ============================================
  // MAIN ANALYSIS (EXISTING)
  // ============================================

  /**
   * Run full payout analysis
   */
  async analyze(days: number = 30): Promise<PayoutAnalysis> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all ledger entries in period
    const entries = await prisma.ledgerEntry.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        case: {
          select: {
            id: true,
            internalCode: true,
            surplusAmountCents: true,
            feePercent: true,
            clientId: true,
            assignedEmployeeId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            employeeTier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals
    let totalClientPayoutCents = 0;
    let totalEmployeeCommissionCents = 0;
    let totalFounderShareCents = 0;

    for (const entry of entries) {
      switch (entry.type) {
        case "CLIENT_PAYOUT":
          totalClientPayoutCents += entry.amountCents;
          break;
        case "EMPLOYEE_COMMISSION":
          totalEmployeeCommissionCents += entry.amountCents;
          break;
        case "FOUNDER_SHARE":
          totalFounderShareCents += entry.amountCents;
          break;
      }
    }

    // Detect anomalies
    const anomalies = await this.detectAnomalies(entries);

    // Run consistency checks
    const consistencyChecks = await this.runConsistencyChecks(entries);

    // Generate recommendations
    const recommendations = this.generateRecommendations(anomalies, consistencyChecks);

    const analysis: PayoutAnalysis = {
      period: `${days} days`,
      totalPayouts: entries.filter((e) => e.type === "CLIENT_PAYOUT").length,
      totalClientPayoutCents,
      totalEmployeeCommissionCents,
      totalFounderShareCents,
      anomalies,
      consistencyChecks,
      recommendations,
    };

    // Save insight
    await this.saveInsight(analysis);

    return analysis;
  }

  // ============================================
  // ANOMALY DETECTION (EXISTING)
  // ============================================

  private async detectAnomalies(entries: any[]): Promise<PayoutAnomaly[]> {
    const anomalies: PayoutAnomaly[] = [];

    // Detect large payouts
    const clientPayouts = entries.filter((e) => e.type === "CLIENT_PAYOUT");
    for (const payout of clientPayouts) {
      if (payout.amountCents >= LARGE_PAYOUT_THRESHOLD_CENTS) {
        anomalies.push({
          type: "large_payout",
          description: `Large payout of $${(payout.amountCents / 100).toLocaleString()} detected`,
          severity: payout.amountCents >= 50000000 ? "critical" : "high",
          caseId: payout.caseId,
          data: {
            amountCents: payout.amountCents,
            caseCode: payout.case?.internalCode,
          },
        });
      }
    }

    // Detect multiple payouts to same employee in 24h
    const employeeCommissions = entries.filter((e) => e.type === "EMPLOYEE_COMMISSION" && e.userId);
    const byEmployeeByDay = new Map<string, any[]>();

    for (const entry of employeeCommissions) {
      const day = entry.createdAt.toISOString().split("T")[0];
      const key = `${entry.userId}:${day}`;
      const existing = byEmployeeByDay.get(key) || [];
      existing.push(entry);
      byEmployeeByDay.set(key, existing);
    }

    for (const [key, entries] of byEmployeeByDay.entries()) {
      if (entries.length >= 3) {
        const [userId] = key.split(":");
        const totalCents = entries.reduce((sum: number, e: any) => sum + e.amountCents, 0);

        anomalies.push({
          type: "multiple_same_day",
          description: `${entries.length} commission entries for same employee on same day`,
          severity: "medium",
          userId,
          data: {
            count: entries.length,
            totalCents,
            employeeName: entries[0].user?.name,
          },
        });
      }
    }

    // Detect commission variance (actual vs expected)
    for (const entry of employeeCommissions) {
      if (!entry.case || !entry.user?.employeeTier) continue;

      const expectedCommission = this.calculateExpectedCommission(
        entry.case.surplusAmountCents,
        entry.case.feePercent,
        entry.user.employeeTier
      );

      if (expectedCommission > 0) {
        const variance = Math.abs(entry.amountCents - expectedCommission) / expectedCommission * 100;

        if (variance > COMMISSION_VARIANCE_THRESHOLD) {
          anomalies.push({
            type: "commission_variance",
            description: `Commission ${variance.toFixed(1)}% different from expected`,
            severity: variance > 50 ? "high" : "medium",
            caseId: entry.caseId,
            userId: entry.userId,
            data: {
              actualCents: entry.amountCents,
              expectedCents: expectedCommission,
              variancePercent: variance,
              employeeTier: entry.user.employeeTier,
            },
          });
        }
      }
    }

    return anomalies;
  }

  // ============================================
  // CONSISTENCY CHECKS (EXISTING)
  // ============================================

  private async runConsistencyChecks(entries: any[]): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = [];

    // Check 1: Client payout + company fee = surplus amount
    const casePayouts = new Map<string, { clientCents: number; companyCents: number; surplusCents: number }>();

    for (const entry of entries) {
      if (!entry.caseId) continue;
      const existing = casePayouts.get(entry.caseId) || {
        clientCents: 0,
        companyCents: 0,
        surplusCents: entry.case?.surplusAmountCents || 0,
      };

      if (entry.type === "CLIENT_PAYOUT") {
        existing.clientCents += entry.amountCents;
      } else if (entry.type === "COMPANY_FEE") {
        existing.companyCents += entry.amountCents;
      }

      casePayouts.set(entry.caseId, existing);
    }

    let splitConsistent = true;
    const splitIssues: string[] = [];

    for (const [caseId, data] of casePayouts.entries()) {
      if (data.surplusCents > 0 && data.clientCents > 0) {
        const expectedClientPayout = Math.round(data.surplusCents * 0.7); // 70% to client
        const variance = Math.abs(data.clientCents - expectedClientPayout);

        if (variance > 100) {
          // Allow $1 variance for rounding
          splitConsistent = false;
          splitIssues.push(`Case ${caseId}: Expected $${(expectedClientPayout / 100).toFixed(2)}, got $${(data.clientCents / 100).toFixed(2)}`);
        }
      }
    }

    checks.push({
      name: "70/30 Split Consistency",
      passed: splitConsistent,
      message: splitConsistent
        ? "All client payouts match expected 70% split"
        : `${splitIssues.length} cases have split discrepancies`,
      details: splitConsistent ? undefined : { issues: splitIssues.slice(0, 5) },
    });

    // Check 2: Founder share + employee commission = company fee
    let shadowAccountingConsistent = true;
    const shadowIssues: string[] = [];

    for (const [caseId, data] of casePayouts.entries()) {
      if (data.companyCents > 0) {
        // Get founder share and employee commission for this case
        const founderShare = entries
          .filter((e) => e.caseId === caseId && e.type === "FOUNDER_SHARE")
          .reduce((sum: number, e: any) => sum + e.amountCents, 0);
        const employeeComm = entries
          .filter((e) => e.caseId === caseId && e.type === "EMPLOYEE_COMMISSION")
          .reduce((sum: number, e: any) => sum + e.amountCents, 0);

        const total = founderShare + employeeComm;
        if (Math.abs(total - data.companyCents) > 100) {
          shadowAccountingConsistent = false;
          shadowIssues.push(`Case ${caseId}: Fee=$${(data.companyCents / 100).toFixed(2)}, Splits=$${(total / 100).toFixed(2)}`);
        }
      }
    }

    checks.push({
      name: "Shadow Accounting Balance",
      passed: shadowAccountingConsistent,
      message: shadowAccountingConsistent
        ? "All company fees properly split between founder and employee"
        : `${shadowIssues.length} cases have shadow accounting discrepancies`,
      details: shadowAccountingConsistent ? undefined : { issues: shadowIssues.slice(0, 5) },
    });

    // Check 3: No pending payouts older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldPending = await prisma.ledgerEntry.count({
      where: {
        status: "PENDING",
        createdAt: { lt: sevenDaysAgo },
      },
    });

    checks.push({
      name: "Pending Payout Age",
      passed: oldPending === 0,
      message:
        oldPending === 0
          ? "No pending payouts older than 7 days"
          : `${oldPending} pending payouts are older than 7 days`,
    });

    return checks;
  }

  // ============================================
  // 1. AUTO-PROCESS PAYOUT
  // Full automated payout pipeline
  // ============================================

  /**
   * Automatically process a payout end-to-end:
   * - Validate the case is ready for payout
   * - Calculate the split (client, company fee, commission, founder)
   * - Create all ledger entries
   * - Choose optimal disbursement method
   * - Generate the client invoice
   * - Update case status
   */
  async autoProcessPayout(caseId: string): Promise<AutoProcessResult> {
    logger.info(`[${BOT_NAME}] Auto-processing payout for case ${caseId}`);

    const result: AutoProcessResult = {
      caseId,
      success: false,
      split: null,
      disbursement: null,
      invoice: null,
      ledgerEntries: [],
      errors: [],
    };

    try {
      // Step 1: Load and validate the case
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          client: { select: { id: true, name: true, address: true, city: true, state: true, zipCode: true } },
          assignedEmployee: { select: { id: true, name: true, employeeTier: true } },
          stateRule: true,
          ledgerEntries: true,
        },
      });

      if (!caseData) {
        result.errors.push(`Case ${caseId} not found`);
        return result;
      }

      if (caseData.status !== "AWAITING_FUNDS" && caseData.status !== "PAID") {
        result.errors.push(`Case ${caseId} is in status ${caseData.status} — must be AWAITING_FUNDS or PAID to process payout`);
        return result;
      }

      if (caseData.surplusAmountCents <= 0) {
        result.errors.push(`Case ${caseId} has no surplus amount recorded`);
        return result;
      }

      // Check if already processed (has CLIENT_PAYOUT entry that is COMPLETED)
      const existingPayout = caseData.ledgerEntries.find(
        (e) => e.type === "CLIENT_PAYOUT" && e.status === "COMPLETED"
      );
      if (existingPayout) {
        result.errors.push(`Case ${caseId} already has a completed client payout (ledger entry ${existingPayout.id})`);
        return result;
      }

      // Step 2: Calculate the split
      const employeeTier = caseData.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE";
      const split = this.calculatePayoutSplit(
        caseData.surplusAmountCents,
        caseData.feePercent,
        employeeTier
      );
      result.split = split;

      logger.info(`[${BOT_NAME}] Split calculated for case ${caseId}`, {
        surplus: caseData.surplusAmountCents,
        clientPayout: split.clientPayoutCents,
        companyFee: split.companyFeeCents,
        commission: split.employeeCommissionCents,
        founderShare: split.founderShareCents,
      });

      // Step 3: Create all ledger entries in a transaction
      const ledgerIds = await prisma.$transaction(async (tx) => {
        const ids: string[] = [];

        // Company fee entry
        const feeEntry = await tx.ledgerEntry.create({
          data: {
            caseId,
            type: "COMPANY_FEE",
            amountCents: split.companyFeeCents,
            description: `Company fee (${split.feePercent}%) on surplus of $${(caseData.surplusAmountCents / 100).toFixed(2)}`,
            status: "COMPLETED",
            completedAt: new Date(),
            tenantId: caseData.tenantId,
          },
        });
        ids.push(feeEntry.id);

        // Client payout entry
        const clientEntry = await tx.ledgerEntry.create({
          data: {
            caseId,
            userId: caseData.clientId,
            type: "CLIENT_PAYOUT",
            amountCents: split.clientPayoutCents,
            description: `Client payout — surplus recovery for ${caseData.internalCode}`,
            status: "PROCESSING",
            tenantId: caseData.tenantId,
          },
        });
        ids.push(clientEntry.id);

        // Employee commission entry
        if (caseData.assignedEmployeeId) {
          const displayedRate = DISPLAYED_COMMISSION_RATES[employeeTier] || 20;
          const actualRate = COMMISSION_RATES[employeeTier] || 10;

          const commissionEntry = await tx.ledgerEntry.create({
            data: {
              caseId,
              userId: caseData.assignedEmployeeId,
              type: "EMPLOYEE_COMMISSION",
              amountCents: split.employeeCommissionCents,
              displayedAmountCents: Math.round((split.companyFeeCents * displayedRate) / 100),
              description: `Commission on case ${caseData.internalCode}`,
              status: "PENDING",
              tierAtTime: employeeTier as EmployeeTier,
              displayedRate: displayedRate,
              actualRate: actualRate,
              tenantId: caseData.tenantId,
            },
          });
          ids.push(commissionEntry.id);
        }

        // Founder share entry
        const founderEntry = await tx.ledgerEntry.create({
          data: {
            caseId,
            type: "FOUNDER_SHARE",
            amountCents: split.founderShareCents,
            description: `Founder share on case ${caseData.internalCode}`,
            status: "COMPLETED",
            completedAt: new Date(),
            tenantId: caseData.tenantId,
          },
        });
        ids.push(founderEntry.id);

        // Update case financials
        await tx.case.update({
          where: { id: caseId },
          data: {
            actualFeeCents: split.companyFeeCents,
            clientPayoutCents: split.clientPayoutCents,
            fundsReceivedAt: caseData.fundsReceivedAt || new Date(),
            status: "PAID",
            paidAt: new Date(),
          },
        });

        return ids;
      });

      result.ledgerEntries = ledgerIds;

      // Step 4: Choose optimal disbursement method
      const disbursement = this.chooseDisbursementMethod(caseId, split.clientPayoutCents);
      result.disbursement = disbursement;

      // Step 5: Generate invoice
      const invoice = await this.generateInvoice(caseId);
      result.invoice = invoice;

      result.success = true;

      logger.info(`[${BOT_NAME}] Payout auto-processed successfully for case ${caseId}`, {
        ledgerEntries: ledgerIds.length,
        disbursementMethod: disbursement.method,
        invoiceNumber: invoice.invoiceNumber,
      });

      // Save an ops insight about this auto-processing
      await prisma.opsInsight.create({
        data: {
          type: "PAYOUT_ANALYSIS" as OpsInsightType,
          priority: "NORMAL" as OpsInsightPriority,
          title: `Auto-Processed Payout: ${caseData.internalCode}`,
          summary: `Payout of $${(split.clientPayoutCents / 100).toFixed(2)} auto-processed. Fee: $${(split.companyFeeCents / 100).toFixed(2)} (${split.feePercent}%). Method: ${disbursement.method}.`,
          details: result as any,
          plainEnglish: `I auto-processed the payout for case ${caseData.internalCode}. The client gets $${(split.clientPayoutCents / 100).toLocaleString()}, company keeps $${(split.companyFeeCents / 100).toLocaleString()} (${split.feePercent}% fee). Payment will be sent via ${disbursement.method} (estimated ${disbursement.estimatedDeliveryDays} business days).`,
          recommendations: [],
          relatedCaseIds: [caseId],
          relatedUserIds: [caseData.clientId, caseData.assignedEmployeeId].filter(Boolean) as string[],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error: any) {
      logger.error(`[${BOT_NAME}] Auto-process payout failed for case ${caseId}`, { error: error.message });
      result.errors.push(`Processing error: ${error.message}`);
    }

    return result;
  }

  /**
   * Calculate the full payout split for a surplus amount
   */
  private calculatePayoutSplit(surplusCents: number, feePercent: number, employeeTier: string): PayoutSplit {
    const companyFeeCents = Math.round((surplusCents * feePercent) / 100);
    const clientPayoutCents = surplusCents - companyFeeCents;

    const commissionRate = COMMISSION_RATES[employeeTier] || 10;
    const employeeCommissionCents = Math.round((companyFeeCents * commissionRate) / 100);
    const founderShareCents = companyFeeCents - employeeCommissionCents;

    return {
      clientPayoutCents,
      companyFeeCents,
      employeeCommissionCents,
      founderShareCents,
      employeeTier,
      feePercent,
    };
  }

  // ============================================
  // 2. SMART FEE OPTIMIZATION
  // Maximize recovery within state fee caps
  // ============================================

  /**
   * Analyze a case and determine the optimal fee percentage
   * that maximizes revenue while staying within legal limits
   */
  async calculateOptimalFee(caseId: string): Promise<FeeOptimizationResult> {
    logger.info(`[${BOT_NAME}] Calculating optimal fee for case ${caseId}`);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        stateRule: true,
        countyRule: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    const stateCode = caseData.state;
    const stateFeeCap = STATE_FEE_CAPS[stateCode] || DEFAULT_FEE_CAP;
    const currentFeePercent = caseData.feePercent;
    const surplusCents = caseData.surplusAmountCents;

    // Factor in case complexity for fee justification
    const complexityScore = await this.assessCaseComplexity(caseId);

    // Look at comparable cases in the same state/county to find the sweet spot
    const comparableCases = await prisma.case.findMany({
      where: {
        state: stateCode,
        county: caseData.county,
        status: { in: ["PAID", "CLOSED"] },
        surplusAmountCents: {
          gte: Math.round(surplusCents * 0.5),
          lte: Math.round(surplusCents * 2.0),
        },
      },
      select: {
        feePercent: true,
        surplusAmountCents: true,
        actualFeeCents: true,
        status: true,
      },
      take: 50,
    });

    // Calculate the average fee for comparable cases
    let avgComparableFee = currentFeePercent;
    if (comparableCases.length > 0) {
      avgComparableFee = Math.round(
        comparableCases.reduce((sum, c) => sum + c.feePercent, 0) / comparableCases.length
      );
    }

    // Optimal fee: the highest we can charge without exceeding state cap,
    // weighted by complexity and comparable market rate
    let optimalFeePercent: number;
    let reasoning: string;

    if (surplusCents >= 50000000) {
      // Large surpluses ($500k+): lower fee more competitive, volume matters
      optimalFeePercent = Math.min(stateFeeCap, Math.max(20, avgComparableFee - 5));
      reasoning = `Large surplus ($${(surplusCents / 100).toLocaleString()}) — competitive rate to secure high-value case. State cap: ${stateFeeCap}%.`;
    } else if (surplusCents >= 10000000) {
      // Mid surpluses ($100k-$500k): standard competitive rate
      optimalFeePercent = Math.min(stateFeeCap, Math.max(25, avgComparableFee));
      reasoning = `Mid-range surplus — standard market rate. Comparable cases average ${avgComparableFee}%. State cap: ${stateFeeCap}%.`;
    } else if (surplusCents >= 1000000) {
      // Smaller surpluses ($10k-$100k): can charge closer to cap
      optimalFeePercent = Math.min(stateFeeCap, Math.max(28, stateFeeCap - 2));
      reasoning = `Smaller surplus — maximize fee near state cap. Complexity score: ${complexityScore}/10. State cap: ${stateFeeCap}%.`;
    } else {
      // Very small surpluses (under $10k): charge maximum to cover costs
      optimalFeePercent = stateFeeCap;
      reasoning = `Small surplus ($${(surplusCents / 100).toLocaleString()}) — maximum fee to cover operational costs. State cap: ${stateFeeCap}%.`;
    }

    // If complexity is high, justify higher fee
    if (complexityScore >= 7) {
      optimalFeePercent = Math.min(stateFeeCap, optimalFeePercent + 3);
      reasoning += ` High complexity (${complexityScore}/10) justifies additional fee margin.`;
    }

    const currentRevenueCents = Math.round((surplusCents * currentFeePercent) / 100);
    const optimalRevenueCents = Math.round((surplusCents * optimalFeePercent) / 100);
    const additionalRevenueCents = optimalRevenueCents - currentRevenueCents;

    const result: FeeOptimizationResult = {
      caseId,
      currentFeePercent,
      optimalFeePercent,
      stateFeeCap,
      currentRevenueCents,
      optimalRevenueCents,
      additionalRevenueCents,
      reasoning,
    };

    if (additionalRevenueCents > 0) {
      logger.info(`[${BOT_NAME}] Fee optimization found +$${(additionalRevenueCents / 100).toFixed(2)} for case ${caseId}`, {
        current: currentFeePercent,
        optimal: optimalFeePercent,
      });
    }

    return result;
  }

  /**
   * Assess case complexity on a 1-10 scale
   */
  private async assessCaseComplexity(caseId: string): Promise<number> {
    let score = 3; // Base complexity

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: { select: { type: true } },
        communications: { select: { type: true } },
        deadlines: { select: { id: true } },
      },
    });

    if (!caseData) return score;

    // More documents = more complex
    if (caseData.documents.length > 10) score += 2;
    else if (caseData.documents.length > 5) score += 1;

    // More communications = harder case
    if (caseData.communications.length > 20) score += 2;
    else if (caseData.communications.length > 10) score += 1;

    // Multiple deadlines = higher complexity
    if (caseData.deadlines.length > 3) score += 1;

    // Redemption deadline present = additional complexity
    if (caseData.redemptionDeadline) score += 1;

    // Court case number means litigation involvement
    if (caseData.courtCaseNumber) score += 2;

    return Math.min(10, score);
  }

  // ============================================
  // 3. COMMISSION AUTO-CALCULATE
  // Real-time commission by employee tier
  // ============================================

  /**
   * Calculate real-time commission for an employee on a specific case
   */
  async calculateCommission(
    caseId: string,
    employeeId: string
  ): Promise<{
    actualCommissionCents: number;
    displayedCommissionCents: number;
    tier: string;
    actualRate: number;
    displayedRate: number;
    companyFeeCents: number;
  }> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { surplusAmountCents: true, feePercent: true },
    });

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { employeeTier: true, name: true },
    });

    if (!caseData || !employee) {
      throw new Error("Case or employee not found");
    }

    const tier = employee.employeeTier || "TIER_1_ASSOCIATE";
    const companyFeeCents = Math.round((caseData.surplusAmountCents * caseData.feePercent) / 100);
    const actualRate = COMMISSION_RATES[tier] || 10;
    const displayedRate = DISPLAYED_COMMISSION_RATES[tier] || 20;

    const actualCommissionCents = Math.round((companyFeeCents * actualRate) / 100);
    const displayedCommissionCents = Math.round((companyFeeCents * displayedRate) / 100);

    return {
      actualCommissionCents,
      displayedCommissionCents,
      tier,
      actualRate,
      displayedRate,
      companyFeeCents,
    };
  }

  /**
   * Batch calculate commissions for all pending cases assigned to an employee
   */
  async calculateEmployeePendingCommissions(
    employeeId: string
  ): Promise<{
    employeeId: string;
    totalPendingActualCents: number;
    totalPendingDisplayedCents: number;
    cases: Array<{ caseId: string; internalCode: string; actualCents: number; displayedCents: number }>;
  }> {
    const pendingCases = await prisma.case.findMany({
      where: {
        assignedEmployeeId: employeeId,
        status: { in: ["FILED", "AWAITING_FUNDS"] },
      },
      select: {
        id: true,
        internalCode: true,
        surplusAmountCents: true,
        feePercent: true,
      },
    });

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { employeeTier: true },
    });

    const tier = employee?.employeeTier || "TIER_1_ASSOCIATE";
    const actualRate = COMMISSION_RATES[tier] || 10;
    const displayedRate = DISPLAYED_COMMISSION_RATES[tier] || 20;

    let totalPendingActualCents = 0;
    let totalPendingDisplayedCents = 0;
    const cases: Array<{ caseId: string; internalCode: string; actualCents: number; displayedCents: number }> = [];

    for (const c of pendingCases) {
      const companyFee = Math.round((c.surplusAmountCents * c.feePercent) / 100);
      const actualCents = Math.round((companyFee * actualRate) / 100);
      const displayedCents = Math.round((companyFee * displayedRate) / 100);

      totalPendingActualCents += actualCents;
      totalPendingDisplayedCents += displayedCents;

      cases.push({
        caseId: c.id,
        internalCode: c.internalCode,
        actualCents,
        displayedCents,
      });
    }

    return {
      employeeId,
      totalPendingActualCents,
      totalPendingDisplayedCents,
      cases,
    };
  }

  // ============================================
  // 4. REVENUE LEAK DETECTION
  // Find money left on the table
  // ============================================

  /**
   * Scan all cases to find revenue leaks:
   * - Undercharged fees (below state cap without justification)
   * - Missed surplus (cases where surplus was not pursued)
   * - Stale awaiting funds (waiting too long for payment)
   * - Uncollected interest (states that accrue interest on surplus)
   * - Abandoned cases (filed but never followed up)
   */
  async detectRevenueLeaks(): Promise<{
    totalLeaks: number;
    totalEstimatedLossCents: number;
    leaks: RevenueLeak[];
  }> {
    logger.info(`[${BOT_NAME}] Scanning for revenue leaks...`);

    const leaks: RevenueLeak[] = [];

    // Leak Type 1: Undercharged fees
    const paidCases = await prisma.case.findMany({
      where: {
        status: { in: ["PAID", "CLOSED"] },
        surplusAmountCents: { gt: 0 },
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        feePercent: true,
        surplusAmountCents: true,
        actualFeeCents: true,
      },
    });

    for (const c of paidCases) {
      const stateFeeCap = STATE_FEE_CAPS[c.state] || DEFAULT_FEE_CAP;
      if (c.feePercent < stateFeeCap - 5) {
        // More than 5% below cap
        const maxFeeCents = Math.round((c.surplusAmountCents * stateFeeCap) / 100);
        const actualFeeCents = c.actualFeeCents || Math.round((c.surplusAmountCents * c.feePercent) / 100);
        const lossCents = maxFeeCents - actualFeeCents;

        if (lossCents > 10000) {
          // Only flag if >$100 loss
          leaks.push({
            caseId: c.id,
            internalCode: c.internalCode,
            leakType: "undercharged_fee",
            estimatedLossCents: lossCents,
            description: `Fee of ${c.feePercent}% is ${stateFeeCap - c.feePercent}% below the state cap of ${stateFeeCap}% in ${c.state}. Potential additional revenue: $${(lossCents / 100).toFixed(2)}.`,
            recommendation: `For future ${c.state} cases, negotiate fee closer to ${stateFeeCap}% cap.`,
          });
        }
      }
    }

    // Leak Type 2: Stale AWAITING_FUNDS cases
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - STALE_AWAITING_FUNDS_DAYS);

    const staleCases = await prisma.case.findMany({
      where: {
        status: "AWAITING_FUNDS",
        filedAt: { lt: staleCutoff },
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        surplusAmountCents: true,
        feePercent: true,
        filedAt: true,
      },
    });

    for (const c of staleCases) {
      const daysSinceFiled = c.filedAt
        ? Math.floor((Date.now() - c.filedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const potentialFeeCents = Math.round((c.surplusAmountCents * c.feePercent) / 100);

      leaks.push({
        caseId: c.id,
        internalCode: c.internalCode,
        leakType: "stale_awaiting_funds",
        estimatedLossCents: potentialFeeCents,
        description: `Case filed ${daysSinceFiled} days ago, still awaiting funds. Potential fee at risk: $${(potentialFeeCents / 100).toFixed(2)}.`,
        recommendation: `Follow up with ${c.state} clerk/comptroller office. Consider escalation if over 120 days.`,
      });
    }

    // Leak Type 3: Uncollected interest
    const interestStates = await prisma.stateRule.findMany({
      where: {
        interestRate: { not: null, gt: 0 },
      },
      select: {
        stateCode: true,
        interestRate: true,
      },
    });

    const interestStateMap = new Map(interestStates.map((s) => [s.stateCode, s.interestRate!]));

    for (const c of paidCases) {
      const interestRate = interestStateMap.get(c.state);
      if (interestRate && interestRate > 0) {
        // Rough estimate: interest accrued on surplus from sale date
        const estimatedInterestCents = Math.round(c.surplusAmountCents * (interestRate / 100));
        if (estimatedInterestCents > 5000) {
          // Only flag if >$50
          leaks.push({
            caseId: c.id,
            internalCode: c.internalCode,
            leakType: "uncollected_interest",
            estimatedLossCents: estimatedInterestCents,
            description: `${c.state} accrues ${interestRate}% interest on surplus. Estimated uncollected interest: $${(estimatedInterestCents / 100).toFixed(2)}.`,
            recommendation: `Verify if interest was included in the surplus disbursement. If not, file a supplemental claim for interest.`,
          });
        }
      }
    }

    // Leak Type 4: Abandoned cases (FILED but no activity for 60+ days)
    const abandonedCutoff = new Date();
    abandonedCutoff.setDate(abandonedCutoff.getDate() - 60);

    const abandonedCases = await prisma.case.findMany({
      where: {
        status: "FILED",
        updatedAt: { lt: abandonedCutoff },
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        surplusAmountCents: true,
        feePercent: true,
        updatedAt: true,
      },
    });

    for (const c of abandonedCases) {
      const daysSinceUpdate = Math.floor((Date.now() - c.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      const potentialFeeCents = Math.round((c.surplusAmountCents * c.feePercent) / 100);

      leaks.push({
        caseId: c.id,
        internalCode: c.internalCode,
        leakType: "abandoned_case",
        estimatedLossCents: potentialFeeCents,
        description: `Case filed but no activity for ${daysSinceUpdate} days. Potential fee at risk: $${(potentialFeeCents / 100).toFixed(2)}.`,
        recommendation: `Reassign to active employee or escalate. Ensure filing was acknowledged by the jurisdiction.`,
      });
    }

    // Leak Type 5: Missed surplus — CONTACTED cases that went cold
    const missedCutoff = new Date();
    missedCutoff.setDate(missedCutoff.getDate() - 45);

    const missedCases = await prisma.case.findMany({
      where: {
        status: "CONTACTED",
        updatedAt: { lt: missedCutoff },
        surplusAmountCents: { gt: 500000 }, // Only flag $5k+ surplus
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        surplusAmountCents: true,
        feePercent: true,
      },
    });

    for (const c of missedCases) {
      const potentialFeeCents = Math.round((c.surplusAmountCents * c.feePercent) / 100);

      leaks.push({
        caseId: c.id,
        internalCode: c.internalCode,
        leakType: "missed_surplus",
        estimatedLossCents: potentialFeeCents,
        description: `Client contacted but case went cold. Surplus of $${(c.surplusAmountCents / 100).toLocaleString()} with potential fee of $${(potentialFeeCents / 100).toFixed(2)}.`,
        recommendation: `Re-engage client with updated outreach. Consider assigning to a higher-tier specialist.`,
      });
    }

    const totalEstimatedLossCents = leaks.reduce((sum, l) => sum + l.estimatedLossCents, 0);

    logger.info(`[${BOT_NAME}] Revenue leak scan complete`, {
      totalLeaks: leaks.length,
      totalEstimatedLoss: `$${(totalEstimatedLossCents / 100).toLocaleString()}`,
    });

    // Save insight if significant leaks found
    if (leaks.length > 0) {
      await prisma.opsInsight.create({
        data: {
          type: "PAYOUT_ANALYSIS" as OpsInsightType,
          priority: totalEstimatedLossCents > 10000000 ? ("URGENT" as OpsInsightPriority) : ("HIGH" as OpsInsightPriority),
          title: `Revenue Leak Detection: ${leaks.length} leaks found`,
          summary: `Estimated $${(totalEstimatedLossCents / 100).toLocaleString()} in potential revenue leaks across ${leaks.length} cases.`,
          details: { leaks: leaks.slice(0, 20) } as any,
          plainEnglish: this.generateLeakPlainEnglish(leaks, totalEstimatedLossCents),
          recommendations: leaks.slice(0, 10).map((l) => l.recommendation),
          relatedCaseIds: leaks.map((l) => l.caseId).slice(0, 20),
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return {
      totalLeaks: leaks.length,
      totalEstimatedLossCents,
      leaks,
    };
  }

  private generateLeakPlainEnglish(leaks: RevenueLeak[], totalCents: number): string {
    const parts: string[] = [];
    parts.push(`Revenue Leak Report: I found ${leaks.length} areas where money is being left on the table, totaling an estimated $${(totalCents / 100).toLocaleString()}.`);

    const byType = new Map<string, RevenueLeak[]>();
    for (const leak of leaks) {
      const existing = byType.get(leak.leakType) || [];
      existing.push(leak);
      byType.set(leak.leakType, existing);
    }

    for (const [type, typeLeaks] of byType.entries()) {
      const typeTotalCents = typeLeaks.reduce((sum, l) => sum + l.estimatedLossCents, 0);
      const typeLabel = {
        undercharged_fee: "Undercharged Fees",
        missed_surplus: "Missed Surplus Opportunities",
        stale_awaiting_funds: "Stale Awaiting-Funds Cases",
        uncollected_interest: "Uncollected Interest",
        abandoned_case: "Abandoned Cases",
      }[type] || type;

      parts.push(`\n${typeLabel}: ${typeLeaks.length} cases, ~$${(typeTotalCents / 100).toLocaleString()}`);
    }

    parts.push("\nAction required: Review the top cases and implement the recommendations to recover lost revenue.");
    return parts.join("\n");
  }

  // ============================================
  // 5. AUTO-RECONCILIATION
  // Match incoming payments to expected amounts
  // ============================================

  /**
   * Match all PROCESSING/PENDING ledger entries against expected amounts,
   * flag discrepancies, and identify unmatched payments
   */
  async autoReconcile(): Promise<ReconciliationResult> {
    logger.info(`[${BOT_NAME}] Running auto-reconciliation...`);

    const matches: ReconciliationMatch[] = [];
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const unmatchedPayments: UnmatchedPayment[] = [];

    // Get all cases that have received funds but payout is still processing
    const casesWithFunds = await prisma.case.findMany({
      where: {
        status: { in: ["AWAITING_FUNDS", "PAID"] },
        fundsReceivedAt: { not: null },
      },
      include: {
        ledgerEntries: {
          where: { type: { in: ["CLIENT_PAYOUT", "COMPANY_FEE"] } },
        },
      },
    });

    for (const c of casesWithFunds) {
      const clientPayoutEntries = c.ledgerEntries.filter((e) => e.type === "CLIENT_PAYOUT");
      const companyFeeEntries = c.ledgerEntries.filter((e) => e.type === "COMPANY_FEE");

      if (clientPayoutEntries.length === 0 && companyFeeEntries.length === 0) {
        // Funds received but no ledger entries — unmatched
        unmatchedPayments.push({
          ledgerEntryId: "N/A",
          amountCents: c.surplusAmountCents,
          createdAt: c.fundsReceivedAt!,
          description: `Case ${c.internalCode}: funds received ($${(c.surplusAmountCents / 100).toFixed(2)}) but no payout entries created`,
        });
        continue;
      }

      // Check that the total ledger entries match the surplus amount
      const totalLedgerCents = c.ledgerEntries.reduce((sum, e) => sum + e.amountCents, 0);
      const expectedTotalCents = c.surplusAmountCents;

      const difference = Math.abs(totalLedgerCents - expectedTotalCents);

      if (difference <= RECONCILIATION_TOLERANCE_CENTS) {
        matches.push({
          caseId: c.id,
          expectedCents: expectedTotalCents,
          receivedCents: totalLedgerCents,
          status: difference === 0 ? "exact" : "within_tolerance",
        });
      } else {
        const percentVariance = expectedTotalCents > 0
          ? (difference / expectedTotalCents) * 100
          : 0;

        discrepancies.push({
          caseId: c.id,
          internalCode: c.internalCode,
          expectedCents: expectedTotalCents,
          receivedCents: totalLedgerCents,
          differenceCents: difference,
          percentVariance: Math.round(percentVariance * 100) / 100,
        });
      }
    }

    // Find ledger entries with no matching case (orphaned entries)
    const orphanedEntries = await prisma.ledgerEntry.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, // >14 days old
      },
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        description: true,
        caseId: true,
      },
      take: 50,
    });

    for (const entry of orphanedEntries) {
      unmatchedPayments.push({
        ledgerEntryId: entry.id,
        amountCents: entry.amountCents,
        createdAt: entry.createdAt,
        description: `Orphaned pending entry: ${entry.description} (case: ${entry.caseId})`,
      });
    }

    const result: ReconciliationResult = {
      totalMatched: matches.length,
      totalUnmatched: unmatchedPayments.length,
      totalDiscrepancies: discrepancies.length,
      matches,
      discrepancies,
      unmatchedPayments,
    };

    logger.info(`[${BOT_NAME}] Reconciliation complete`, {
      matched: matches.length,
      discrepancies: discrepancies.length,
      unmatched: unmatchedPayments.length,
    });

    // Save insight if discrepancies found
    if (discrepancies.length > 0 || unmatchedPayments.length > 0) {
      const totalDiscrepancyCents = discrepancies.reduce((sum, d) => sum + d.differenceCents, 0);

      await prisma.opsInsight.create({
        data: {
          type: "PAYOUT_ANALYSIS" as OpsInsightType,
          priority: discrepancies.length > 5 ? ("URGENT" as OpsInsightPriority) : ("HIGH" as OpsInsightPriority),
          title: `Reconciliation Alert: ${discrepancies.length} discrepancies, ${unmatchedPayments.length} unmatched`,
          summary: `Auto-reconciliation found ${discrepancies.length} discrepancies totaling $${(totalDiscrepancyCents / 100).toFixed(2)} and ${unmatchedPayments.length} unmatched payments.`,
          details: result as any,
          plainEnglish: `I reconciled ${matches.length + discrepancies.length} cases. ${matches.length} matched perfectly. ${discrepancies.length} have amount mismatches totaling $${(totalDiscrepancyCents / 100).toLocaleString()}. ${unmatchedPayments.length} payments could not be matched to expected amounts. Immediate review recommended.`,
          recommendations: [
            ...discrepancies.slice(0, 5).map((d) => `Review case ${d.internalCode}: expected $${(d.expectedCents / 100).toFixed(2)}, found $${(d.receivedCents / 100).toFixed(2)} (${d.percentVariance}% variance)`),
            ...unmatchedPayments.slice(0, 5).map((u) => `Investigate unmatched: ${u.description}`),
          ],
          relatedCaseIds: [...discrepancies.map((d) => d.caseId), ...unmatchedPayments.filter((u) => u.ledgerEntryId !== "N/A").map(() => "")].filter(Boolean).slice(0, 20),
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return result;
  }

  // ============================================
  // 6. PREDICTIVE REVENUE FORECAST
  // Forecast when payments will arrive
  // ============================================

  /**
   * Predict incoming payments over the next N days based on
   * historical patterns per state/county
   */
  async forecastPayments(days: number = 30): Promise<PaymentForecast> {
    logger.info(`[${BOT_NAME}] Forecasting payments for next ${days} days...`);

    // Get all cases in FILED or AWAITING_FUNDS status
    const activeCases = await prisma.case.findMany({
      where: {
        status: { in: ["FILED", "AWAITING_FUNDS"] },
        surplusAmountCents: { gt: 0 },
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        county: true,
        surplusAmountCents: true,
        feePercent: true,
        filedAt: true,
        status: true,
      },
    });

    // Get historical data: how long did paid cases take from filing to payment
    const historicalCases = await prisma.case.findMany({
      where: {
        status: { in: ["PAID", "CLOSED"] },
        filedAt: { not: null },
        fundsReceivedAt: { not: null },
      },
      select: {
        state: true,
        county: true,
        filedAt: true,
        fundsReceivedAt: true,
      },
    });

    // Build state/county average payment times from historical data
    const stateCountyAvg = new Map<string, { totalDays: number; count: number }>();
    const stateAvg = new Map<string, { totalDays: number; count: number }>();

    for (const h of historicalCases) {
      if (!h.filedAt || !h.fundsReceivedAt) continue;
      const daysToPay = Math.floor((h.fundsReceivedAt.getTime() - h.filedAt.getTime()) / (1000 * 60 * 60 * 24));

      const stateKey = h.state;
      const countyKey = `${h.state}:${h.county}`;

      const sExisting = stateAvg.get(stateKey) || { totalDays: 0, count: 0 };
      sExisting.totalDays += daysToPay;
      sExisting.count += 1;
      stateAvg.set(stateKey, sExisting);

      const cExisting = stateCountyAvg.get(countyKey) || { totalDays: 0, count: 0 };
      cExisting.totalDays += daysToPay;
      cExisting.count += 1;
      stateCountyAvg.set(countyKey, cExisting);
    }

    const now = new Date();
    const forecastEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const expectedPayments: ForecastedPayment[] = [];
    const byState: Record<string, { count: number; totalCents: number; avgDaysToPayment: number }> = {};
    const byWeek: Record<string, { count: number; totalCents: number }> = {};

    for (const c of activeCases) {
      // Determine expected days to payment
      const countyKey = `${c.state}:${c.county}`;
      let avgDays: number;

      if (stateCountyAvg.has(countyKey) && stateCountyAvg.get(countyKey)!.count >= 3) {
        const data = stateCountyAvg.get(countyKey)!;
        avgDays = Math.round(data.totalDays / data.count);
      } else if (stateAvg.has(c.state) && stateAvg.get(c.state)!.count >= 3) {
        const data = stateAvg.get(c.state)!;
        avgDays = Math.round(data.totalDays / data.count);
      } else {
        avgDays = STATE_AVG_PAYMENT_DAYS[c.state] || DEFAULT_AVG_PAYMENT_DAYS;
      }

      // Calculate expected payment date
      const filedDate = c.filedAt || now;
      const expectedDate = new Date(filedDate.getTime() + avgDays * 24 * 60 * 60 * 1000);
      const daysUntilExpected = Math.floor((expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Only include if within forecast window
      if (expectedDate <= forecastEnd && daysUntilExpected >= -30) {
        // Confidence based on how much historical data we have
        let confidence: "high" | "medium" | "low" = "low";
        const countyData = stateCountyAvg.get(countyKey);
        if (countyData && countyData.count >= 10) confidence = "high";
        else if ((countyData && countyData.count >= 3) || (stateAvg.get(c.state)?.count || 0) >= 10) confidence = "medium";

        const expectedAmountCents = Math.round((c.surplusAmountCents * c.feePercent) / 100);

        expectedPayments.push({
          caseId: c.id,
          internalCode: c.internalCode,
          state: c.state,
          county: c.county,
          expectedAmountCents,
          expectedDate,
          confidence,
          daysUntilExpected: Math.max(0, daysUntilExpected),
        });

        // Aggregate by state
        if (!byState[c.state]) {
          byState[c.state] = { count: 0, totalCents: 0, avgDaysToPayment: 0 };
        }
        byState[c.state].count += 1;
        byState[c.state].totalCents += expectedAmountCents;
        byState[c.state].avgDaysToPayment = avgDays;

        // Aggregate by week
        const weekStart = new Date(expectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];
        if (!byWeek[weekKey]) {
          byWeek[weekKey] = { count: 0, totalCents: 0 };
        }
        byWeek[weekKey].count += 1;
        byWeek[weekKey].totalCents += expectedAmountCents;
      }
    }

    // Sort by expected date
    expectedPayments.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());

    const totalExpectedCents = expectedPayments.reduce((sum, p) => sum + p.expectedAmountCents, 0);

    // Overall confidence score (0-100) based on data quality
    const highConfCount = expectedPayments.filter((p) => p.confidence === "high").length;
    const medConfCount = expectedPayments.filter((p) => p.confidence === "medium").length;
    const totalForecasted = expectedPayments.length || 1;
    const confidenceScore = Math.round(((highConfCount * 100 + medConfCount * 60) / totalForecasted));

    const forecast: PaymentForecast = {
      forecastDays: days,
      expectedPayments,
      totalExpectedCents,
      confidenceScore: Math.min(100, confidenceScore),
      byState,
      byWeek,
    };

    logger.info(`[${BOT_NAME}] Forecast complete`, {
      forecastedPayments: expectedPayments.length,
      totalExpectedRevenue: `$${(totalExpectedCents / 100).toLocaleString()}`,
      confidenceScore,
    });

    return forecast;
  }

  // ============================================
  // 7. CRYPTO SURPLUS RECOVERY
  // Track and process cryptocurrency surplus claims
  // ============================================

  /**
   * Process cryptocurrency surplus claims from defunct exchanges
   * (FTX, Celsius, BlockFi, Voyager bankruptcy proceeds)
   */
  async processCryptoSurplus(caseId: string): Promise<CryptoSurplusResult> {
    logger.info(`[${BOT_NAME}] Processing crypto surplus for case ${caseId}`);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { id: true, name: true, state: true } },
        stateRule: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    // Determine exchange source from case metadata or notes
    const metadata = (caseData.metadata as any) || {};
    const exchangeSource = metadata.cryptoExchange || this.detectCryptoExchange(caseData.notes || "");

    if (!exchangeSource) {
      return {
        caseId,
        exchangeSource: "UNKNOWN",
        assetType: "UNKNOWN",
        estimatedValueCents: 0,
        claimStatus: "identified",
        bankruptcyProceeding: "N/A",
        notes: "Could not determine crypto exchange source. Manual review required.",
      };
    }

    const exchangeInfo = CRYPTO_EXCHANGES[exchangeSource.toUpperCase()];
    const assetType = metadata.cryptoAsset || "BTC";

    // Calculate estimated value based on surplus amount (already in cents)
    const estimatedValueCents = caseData.surplusAmountCents;

    // Determine claim status based on case status
    let claimStatus: CryptoSurplusResult["claimStatus"] = "identified";
    if (caseData.status === "FILED") claimStatus = "filed";
    if (caseData.status === "AWAITING_FUNDS") claimStatus = "approved";
    if (caseData.status === "PAID") claimStatus = "disbursed";
    if (caseData.status === "REJECTED") claimStatus = "rejected";

    // Check if the state has specific crypto unclaimed property laws
    const stateHasCryptoLaw = await this.checkStateCryptoLaw(caseData.state);

    const result: CryptoSurplusResult = {
      caseId,
      exchangeSource: exchangeSource.toUpperCase(),
      assetType,
      estimatedValueCents,
      claimStatus,
      bankruptcyProceeding: exchangeInfo?.bankruptcyCase || "Unknown bankruptcy proceeding",
      notes: this.generateCryptoNotes(exchangeSource, assetType, estimatedValueCents, stateHasCryptoLaw, claimStatus),
    };

    // Update case metadata with crypto tracking info
    await prisma.case.update({
      where: { id: caseId },
      data: {
        metadata: {
          ...(caseData.metadata as any || {}),
          cryptoExchange: exchangeSource.toUpperCase(),
          cryptoAsset: assetType,
          cryptoClaimStatus: claimStatus,
          cryptoBankruptcyCase: exchangeInfo?.bankruptcyCase,
          cryptoClaimPortal: exchangeInfo?.claimPortal,
          cryptoLastChecked: new Date().toISOString(),
          stateCryptoLaw: stateHasCryptoLaw,
        },
      },
    });

    logger.info(`[${BOT_NAME}] Crypto surplus processed for case ${caseId}`, {
      exchange: exchangeSource,
      asset: assetType,
      valueCents: estimatedValueCents,
      claimStatus,
    });

    return result;
  }

  /**
   * Detect which crypto exchange is referenced in case notes
   */
  private detectCryptoExchange(notes: string): string | null {
    const lowerNotes = notes.toLowerCase();
    if (lowerNotes.includes("ftx") || lowerNotes.includes("sam bankman")) return "FTX";
    if (lowerNotes.includes("celsius")) return "CELSIUS";
    if (lowerNotes.includes("blockfi") || lowerNotes.includes("block fi")) return "BLOCKFI";
    if (lowerNotes.includes("voyager")) return "VOYAGER";
    if (lowerNotes.includes("crypto") || lowerNotes.includes("bitcoin") || lowerNotes.includes("ethereum")) return "UNKNOWN_CRYPTO";
    return null;
  }

  /**
   * Check if a state has specific crypto unclaimed property laws
   */
  private async checkStateCryptoLaw(stateCode: string): Promise<boolean> {
    // States known to have crypto-specific unclaimed property provisions
    const cryptoFriendlyStates = ["WY", "TX", "CO", "TN", "FL", "NV", "AZ", "UT", "KY", "IL"];
    return cryptoFriendlyStates.includes(stateCode);
  }

  /**
   * Generate notes for a crypto surplus claim
   */
  private generateCryptoNotes(
    exchange: string,
    asset: string,
    valueCents: number,
    stateHasCryptoLaw: boolean,
    status: string
  ): string {
    const parts: string[] = [];

    parts.push(`Crypto surplus claim from ${exchange} bankruptcy proceedings.`);
    parts.push(`Asset type: ${asset}. Estimated value: $${(valueCents / 100).toLocaleString()}.`);
    parts.push(`Current claim status: ${status}.`);

    if (stateHasCryptoLaw) {
      parts.push("State has crypto-specific unclaimed property provisions — may expedite recovery.");
    } else {
      parts.push("State does not have specific crypto unclaimed property law — standard unclaimed property process applies.");
    }

    const exchangeInfo = CRYPTO_EXCHANGES[exchange];
    if (exchangeInfo) {
      parts.push(`Bankruptcy case: ${exchangeInfo.bankruptcyCase}`);
      parts.push(`Claims portal: ${exchangeInfo.claimPortal}`);
    }

    parts.push("NOTE: Crypto claims may involve additional KYC/AML verification requirements.");

    return parts.join(" ");
  }

  // ============================================
  // 8. AUTO-INVOICE GENERATION
  // Generate client invoices when surplus received
  // ============================================

  /**
   * Generate a client invoice for a case showing the surplus recovery,
   * company fee, and net payout to the client
   */
  async generateInvoice(caseId: string): Promise<InvoiceData> {
    logger.info(`[${BOT_NAME}] Generating invoice for case ${caseId}`);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        stateRule: { select: { filingFee: true } },
        countyRule: { select: { localFilingFee: true } },
      },
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    const surplusCents = caseData.surplusAmountCents;
    const feePercent = caseData.feePercent;
    const feeCents = Math.round((surplusCents * feePercent) / 100);
    const clientPayoutCents = surplusCents - feeCents;

    // Build line items
    const lineItems: InvoiceLineItem[] = [];

    lineItems.push({
      description: `Surplus recovery services — ${caseData.state}, ${caseData.county} County (Case: ${caseData.internalCode})`,
      amountCents: feeCents,
    });

    // Add filing fees if applicable
    const filingFee = caseData.countyRule?.localFilingFee || caseData.stateRule?.filingFee || 0;
    if (filingFee > 0) {
      lineItems.push({
        description: `Filing fee (${caseData.state} ${caseData.county} County)`,
        amountCents: filingFee,
      });
    }

    // Generate invoice number: INV-YYYY-MMDD-XXXXX
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    // Due date: 30 days from now (net-30)
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const clientAddress = [
      caseData.client.address,
      caseData.client.city,
      caseData.client.state,
      caseData.client.zipCode,
    ]
      .filter(Boolean)
      .join(", ");

    const invoice: InvoiceData = {
      invoiceNumber,
      caseId,
      clientName: caseData.client.name,
      clientAddress: clientAddress || "Address on file",
      surplusAmountCents: surplusCents,
      feePercent,
      feeCents,
      clientPayoutCents,
      lineItems,
      generatedAt: now,
      dueDate,
      status: "draft",
    };

    // Store invoice data in case metadata
    await prisma.case.update({
      where: { id: caseId },
      data: {
        metadata: {
          ...(caseData.metadata as any || {}),
          latestInvoice: {
            invoiceNumber,
            generatedAt: now.toISOString(),
            feeCents,
            clientPayoutCents,
            status: "draft",
          },
        },
      },
    });

    logger.info(`[${BOT_NAME}] Invoice generated: ${invoiceNumber}`, {
      caseId,
      feeCents,
      clientPayoutCents,
    });

    return invoice;
  }

  // ============================================
  // 9. PAYMENT VELOCITY TRACKING
  // How fast is money moving from filing to payout
  // ============================================

  /**
   * Analyze payment velocity across all cases — how fast
   * money moves from filing to receipt to disbursement
   */
  async trackPaymentVelocity(days: number = 90): Promise<{
    averageFilingToReceiptDays: number;
    averageReceiptToDisbursementDays: number;
    averageTotalVelocityDays: number;
    fastestCaseId: string | null;
    slowestCaseId: string | null;
    byState: Record<string, { avgDays: number; count: number }>;
    cases: PaymentVelocity[];
  }> {
    logger.info(`[${BOT_NAME}] Tracking payment velocity (last ${days} days)...`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const cases = await prisma.case.findMany({
      where: {
        status: { in: ["PAID", "CLOSED"] },
        paidAt: { gte: cutoff },
        filedAt: { not: null },
      },
      select: {
        id: true,
        internalCode: true,
        state: true,
        filedAt: true,
        fundsReceivedAt: true,
        fundsDisbursedAt: true,
        paidAt: true,
      },
    });

    const velocities: PaymentVelocity[] = [];
    const byState: Record<string, { totalDays: number; count: number }> = {};

    let totalFilingToReceipt = 0;
    let totalReceiptToDisbursement = 0;
    let totalVelocity = 0;
    let velocityCount = 0;
    let fastestDays = Infinity;
    let slowestDays = 0;
    let fastestCaseId: string | null = null;
    let slowestCaseId: string | null = null;

    for (const c of cases) {
      const filingToReceipt = c.filedAt && c.fundsReceivedAt
        ? Math.floor((c.fundsReceivedAt.getTime() - c.filedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const receiptToDisbursement = c.fundsReceivedAt && (c.fundsDisbursedAt || c.paidAt)
        ? Math.floor(((c.fundsDisbursedAt || c.paidAt)!.getTime() - c.fundsReceivedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const totalDays = c.filedAt && (c.fundsDisbursedAt || c.paidAt)
        ? Math.floor(((c.fundsDisbursedAt || c.paidAt)!.getTime() - c.filedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      velocities.push({
        caseId: c.id,
        internalCode: c.internalCode,
        filedAt: c.filedAt,
        fundsReceivedAt: c.fundsReceivedAt,
        fundsDisbursedAt: c.fundsDisbursedAt || c.paidAt,
        filingToReceiptDays: filingToReceipt,
        receiptToDisbursementDays: receiptToDisbursement,
        totalVelocityDays: totalDays,
      });

      if (totalDays !== null) {
        totalVelocity += totalDays;
        velocityCount++;

        if (filingToReceipt !== null) totalFilingToReceipt += filingToReceipt;
        if (receiptToDisbursement !== null) totalReceiptToDisbursement += receiptToDisbursement;

        if (totalDays < fastestDays) {
          fastestDays = totalDays;
          fastestCaseId = c.id;
        }
        if (totalDays > slowestDays) {
          slowestDays = totalDays;
          slowestCaseId = c.id;
        }

        // Aggregate by state
        if (!byState[c.state]) {
          byState[c.state] = { totalDays: 0, count: 0 };
        }
        byState[c.state].totalDays += totalDays;
        byState[c.state].count += 1;
      }
    }

    const safeCount = velocityCount || 1;
    const stateAverages: Record<string, { avgDays: number; count: number }> = {};
    for (const [state, data] of Object.entries(byState)) {
      stateAverages[state] = {
        avgDays: Math.round(data.totalDays / data.count),
        count: data.count,
      };
    }

    return {
      averageFilingToReceiptDays: Math.round(totalFilingToReceipt / safeCount),
      averageReceiptToDisbursementDays: Math.round(totalReceiptToDisbursement / safeCount),
      averageTotalVelocityDays: Math.round(totalVelocity / safeCount),
      fastestCaseId,
      slowestCaseId,
      byState: stateAverages,
      cases: velocities,
    };
  }

  // ============================================
  // 10. SMART DISBURSEMENT
  // Choose optimal payment method
  // ============================================

  /**
   * Determine the optimal payment method for a given case/amount:
   * - ACH: Standard, free, 2-3 business days
   * - Wire: For large amounts ($50k+), $25 fee, same/next day
   * - Check: For small amounts or when ACH not available, $1.50, 5-7 days
   */
  chooseDisbursementMethod(caseId: string, amountCents: number): DisbursementDecision {
    let method: DisbursementDecision["method"];
    let reasoning: string;
    let estimatedDeliveryDays: number;
    let feeCents: number;

    if (amountCents >= WIRE_THRESHOLD_CENTS) {
      // Large payouts: use wire for speed and security
      method = "WIRE";
      reasoning = `Amount ($${(amountCents / 100).toLocaleString()}) exceeds $50,000 wire threshold. Wire transfer recommended for speed and security on high-value disbursements.`;
      estimatedDeliveryDays = 1;
      feeCents = WIRE_FEE_CENTS;
    } else if (amountCents < CHECK_THRESHOLD_CENTS) {
      // Very small payouts: check may be more cost-effective
      method = "CHECK";
      reasoning = `Amount ($${(amountCents / 100).toFixed(2)}) is below $500. Physical check is appropriate for small disbursements where ACH setup cost is not justified.`;
      estimatedDeliveryDays = 7;
      feeCents = CHECK_FEE_CENTS;
    } else {
      // Standard: ACH
      method = "ACH";
      reasoning = `Standard ACH transfer for $${(amountCents / 100).toLocaleString()}. No fee, 2-3 business day delivery. Best balance of cost and speed.`;
      estimatedDeliveryDays = 3;
      feeCents = ACH_FEE_CENTS;
    }

    return {
      caseId,
      method,
      amountCents,
      reasoning,
      estimatedDeliveryDays,
      feeCents,
    };
  }

  /**
   * Batch process disbursement decisions for all pending payouts
   */
  async batchDisbursementDecisions(): Promise<DisbursementDecision[]> {
    const pendingPayouts = await prisma.ledgerEntry.findMany({
      where: {
        type: "CLIENT_PAYOUT",
        status: "PROCESSING",
      },
      select: {
        id: true,
        caseId: true,
        amountCents: true,
      },
    });

    const decisions: DisbursementDecision[] = [];
    for (const payout of pendingPayouts) {
      const decision = this.chooseDisbursementMethod(payout.caseId, payout.amountCents);
      decisions.push(decision);
    }

    logger.info(`[${BOT_NAME}] Batch disbursement decisions made for ${decisions.length} payouts`, {
      ach: decisions.filter((d) => d.method === "ACH").length,
      wire: decisions.filter((d) => d.method === "WIRE").length,
      check: decisions.filter((d) => d.method === "CHECK").length,
    });

    return decisions;
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Auto-process all cases that are ready for payout
   * (status = AWAITING_FUNDS with funds received)
   */
  async autoProcessAllReady(): Promise<{
    processed: number;
    failed: number;
    results: AutoProcessResult[];
  }> {
    logger.info(`[${BOT_NAME}] Auto-processing all ready cases...`);

    const readyCases = await prisma.case.findMany({
      where: {
        status: "AWAITING_FUNDS",
        fundsReceivedAt: { not: null },
        clientPayoutCents: null, // Not yet paid out
      },
      select: { id: true, internalCode: true },
    });

    logger.info(`[${BOT_NAME}] Found ${readyCases.length} cases ready for auto-processing`);

    const results: AutoProcessResult[] = [];
    let processed = 0;
    let failed = 0;

    for (const c of readyCases) {
      try {
        const result = await this.autoProcessPayout(c.id);
        results.push(result);
        if (result.success) processed++;
        else failed++;
      } catch (error: any) {
        logger.error(`[${BOT_NAME}] Failed to auto-process case ${c.internalCode}`, { error: error.message });
        results.push({
          caseId: c.id,
          success: false,
          split: null,
          disbursement: null,
          invoice: null,
          ledgerEntries: [],
          errors: [error.message],
        });
        failed++;
      }
    }

    logger.info(`[${BOT_NAME}] Bulk auto-process complete: ${processed} processed, ${failed} failed`);

    return { processed, failed, results };
  }

  /**
   * Run fee optimization across all active cases and generate a report
   */
  async optimizeAllFees(): Promise<{
    totalCasesAnalyzed: number;
    totalAdditionalRevenueCents: number;
    optimizations: FeeOptimizationResult[];
  }> {
    logger.info(`[${BOT_NAME}] Running fee optimization across all active cases...`);

    const activeCases = await prisma.case.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED", "AWAITING_FUNDS"] },
        surplusAmountCents: { gt: 0 },
      },
      select: { id: true },
    });

    const optimizations: FeeOptimizationResult[] = [];
    let totalAdditionalRevenueCents = 0;

    for (const c of activeCases) {
      try {
        const result = await this.calculateOptimalFee(c.id);
        if (result.additionalRevenueCents > 0) {
          optimizations.push(result);
          totalAdditionalRevenueCents += result.additionalRevenueCents;
        }
      } catch (error: any) {
        logger.warn(`[${BOT_NAME}] Fee optimization failed for case ${c.id}`, { error: error.message });
      }
    }

    // Sort by potential additional revenue (highest first)
    optimizations.sort((a, b) => b.additionalRevenueCents - a.additionalRevenueCents);

    logger.info(`[${BOT_NAME}] Fee optimization complete`, {
      casesAnalyzed: activeCases.length,
      casesWithUpside: optimizations.length,
      totalAdditionalRevenue: `$${(totalAdditionalRevenueCents / 100).toLocaleString()}`,
    });

    return {
      totalCasesAnalyzed: activeCases.length,
      totalAdditionalRevenueCents,
      optimizations,
    };
  }

  // ============================================
  // COMPREHENSIVE DASHBOARD
  // ============================================

  /**
   * Generate a comprehensive payout dashboard with all metrics
   */
  async generateDashboard(): Promise<{
    analysis: PayoutAnalysis;
    reconciliation: ReconciliationResult;
    forecast: PaymentForecast;
    velocity: any;
    revenueLeaks: { totalLeaks: number; totalEstimatedLossCents: number; leaks: RevenueLeak[] };
    disbursementQueue: DisbursementDecision[];
    timestamp: Date;
  }> {
    logger.info(`[${BOT_NAME}] Generating comprehensive payout dashboard...`);

    const [analysis, reconciliation, forecast, velocity, revenueLeaks, disbursementQueue] = await Promise.all([
      this.analyze(30),
      this.autoReconcile(),
      this.forecastPayments(30),
      this.trackPaymentVelocity(90),
      this.detectRevenueLeaks(),
      this.batchDisbursementDecisions(),
    ]);

    return {
      analysis,
      reconciliation,
      forecast,
      velocity,
      revenueLeaks,
      disbursementQueue,
      timestamp: new Date(),
    };
  }

  // ============================================
  // HELPER METHODS (EXISTING + NEW)
  // ============================================

  private calculateExpectedCommission(surplusCents: number, feePercent: number, tier: string): number {
    const feeAmount = Math.round((surplusCents * feePercent) / 100);
    const rate = COMMISSION_RATES[tier] || 10;
    return Math.round((feeAmount * rate) / 100);
  }

  private generateRecommendations(
    anomalies: PayoutAnomaly[],
    checks: ConsistencyCheck[]
  ): string[] {
    const recommendations: string[] = [];

    // Critical anomalies
    const criticalAnomalies = anomalies.filter((a) => a.severity === "critical");
    if (criticalAnomalies.length > 0) {
      recommendations.push(
        `URGENT: Review ${criticalAnomalies.length} critical payout anomalies immediately`
      );
    }

    // Large payouts
    const largePayouts = anomalies.filter((a) => a.type === "large_payout");
    if (largePayouts.length > 0) {
      recommendations.push(
        `Verify ${largePayouts.length} large payouts ($100k+) before processing`
      );
    }

    // Commission variance
    const commissionIssues = anomalies.filter((a) => a.type === "commission_variance");
    if (commissionIssues.length > 0) {
      recommendations.push(
        `Investigate ${commissionIssues.length} commission entries with unexpected amounts`
      );
    }

    // Failed consistency checks
    const failedChecks = checks.filter((c) => !c.passed);
    for (const check of failedChecks) {
      recommendations.push(`Fix: ${check.name} - ${check.message}`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Payout operations look healthy - no immediate action needed");
    }

    return recommendations;
  }

  // ============================================
  // SAVE INSIGHT (EXISTING)
  // ============================================

  private async saveInsight(analysis: PayoutAnalysis): Promise<void> {
    const hasIssues =
      analysis.anomalies.length > 0 ||
      analysis.consistencyChecks.some((c) => !c.passed);

    const priority = analysis.anomalies.some((a) => a.severity === "critical")
      ? "URGENT"
      : analysis.anomalies.some((a) => a.severity === "high")
      ? "HIGH"
      : hasIssues
      ? "NORMAL"
      : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "PAYOUT_ANALYSIS" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: `Payout Analysis (${analysis.period})`,
        summary: `${analysis.totalPayouts} payouts analyzed. ${analysis.anomalies.length} anomalies found.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: analysis.anomalies.filter((a) => a.caseId).map((a) => a.caseId!),
        relatedUserIds: analysis.anomalies.filter((a) => a.userId).map((a) => a.userId!),
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  private generatePlainEnglish(analysis: PayoutAnalysis): string {
    const parts: string[] = [];

    const totalPaidOut = (analysis.totalClientPayoutCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    parts.push(
      `Over the last ${analysis.period}, we processed ${analysis.totalPayouts} client payouts totaling ${totalPaidOut}.`
    );

    if (analysis.anomalies.length === 0) {
      parts.push("Good news: No anomalies detected. All payouts look normal.");
    } else {
      parts.push(`\nI found ${analysis.anomalies.length} things to look at:`);
      for (const anomaly of analysis.anomalies.slice(0, 5)) {
        parts.push(`- ${anomaly.description} (${anomaly.severity})`);
      }
    }

    const failedChecks = analysis.consistencyChecks.filter((c) => !c.passed);
    if (failedChecks.length > 0) {
      parts.push(`\nConsistency issues found:`);
      for (const check of failedChecks) {
        parts.push(`- ${check.name}: ${check.message}`);
      }
    } else {
      parts.push("\nAll consistency checks passed.");
    }

    if (analysis.recommendations.length > 0) {
      parts.push(`\nMy recommendations:`);
      for (const rec of analysis.recommendations) {
        parts.push(`- ${rec}`);
      }
    }

    return parts.join("\n");
  }
}

export const payoutBot = new PayoutBot();
