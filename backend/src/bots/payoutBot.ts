// ============================================
// PAYOUT BOT — MGR CAPITAL ASSISTANCE
// Scans payouts for anomalies
// Checks founder/employee commission consistency
// Suggests cases to review
// ============================================

import { PrismaClient, OpsInsightType, OpsInsightPriority } from "@prisma/client";

const prisma = new PrismaClient();

const BOT_NAME = "payoutBot";

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

// Thresholds
const LARGE_PAYOUT_THRESHOLD_CENTS = 10000000; // $100,000
const COMMISSION_VARIANCE_THRESHOLD = 20; // 20% variance from expected

class PayoutBot {
  // ============================================
  // MAIN ANALYSIS
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
  // ANOMALY DETECTION
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
  // CONSISTENCY CHECKS
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
  // HELPER METHODS
  // ============================================

  private calculateExpectedCommission(surplusCents: number, feePercent: number, tier: string): number {
    const feeAmount = Math.round((surplusCents * feePercent) / 100);

    // Commission rates by tier (actual rates from shadow accounting)
    const commissionRates: Record<string, number> = {
      TIER_1_ASSOCIATE: 10,
      TIER_2_SPECIALIST: 20,
      TIER_3_SENIOR_SPECIALIST: 30,
      TIER_4_TEAM_LEADER: 40,
      TIER_5_EXECUTIVE_PARTNER: 50,
    };

    const rate = commissionRates[tier] || 10;
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
  // SAVE INSIGHT
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
