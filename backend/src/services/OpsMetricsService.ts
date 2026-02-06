// ============================================
// OPS METRICS SERVICE — MGR CAPITAL ASSISTANCE
// OPS LAYER: Live operational intelligence
// FOUNDER ONLY — Never expose to employees/clients
// ============================================

import { CaseStatus, LedgerEntryStatus, LedgerEntryType } from "@prisma/client";
import prisma from "../lib/prisma.js";

// ============================================
// DATE RANGE HELPERS
// ============================================

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";

function getDateFromRange(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

// ============================================
// OPS METRICS SERVICE CLASS
// ============================================

class OpsMetricsService {
  // ============================================
  // INGESTION STATISTICS
  // ============================================

  /**
   * Get comprehensive ingestion statistics
   * Tracks batch performance, error rates, and data quality
   */
  async getIngestionStats(range: DateRange = "30d"): Promise<{
    totalBatches: number;
    totalRecords: number;
    highValueCount: number;
    errorRate: number;
    successRate: number;
    bySource: { source: string; count: number; errorCount: number }[];
    byState: { state: string; count: number }[];
    recentBatches: {
      id: string;
      source: string;
      recordCount: number;
      errorCount: number;
      createdAt: Date;
    }[];
  }> {
    const startDate = getDateFromRange(range);
    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

    // Get all ingestion batches in range
    const batches = await prisma.ingestionBatch.findMany({
      where: dateFilter,
      include: {
        source: { select: { name: true, type: true, state: true } },
        records: {
          select: {
            id: true,
            surplusAmount: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Calculate totals
    const totalBatches = batches.length;
    let totalRecords = 0;
    let highValueCount = 0;
    let totalErrors = 0;
    const sourceMap = new Map<string, { count: number; errorCount: number }>();
    const stateMap = new Map<string, number>();

    for (const batch of batches) {
      totalRecords += batch.totalRecords;
      // Calculate errors as difference between total and successfully created
      const batchErrors = batch.totalRecords - batch.createdCases;
      totalErrors += batchErrors;

      // Track by source
      const sourceKey = batch.source?.type || "UNKNOWN";
      const sourceEntry = sourceMap.get(sourceKey) || { count: 0, errorCount: 0 };
      sourceEntry.count += batch.totalRecords;
      sourceEntry.errorCount += batchErrors;
      sourceMap.set(sourceKey, sourceEntry);

      // Track by state from source
      if (batch.source?.state) {
        stateMap.set(batch.source.state, (stateMap.get(batch.source.state) || 0) + batch.totalRecords);
      }

      // Count high-value records
      for (const record of batch.records) {
        if (record.surplusAmount && record.surplusAmount >= 1000000) {
          highValueCount++; // $10,000+ is high value (in cents)
        }
      }
    }

    const errorRate = totalRecords > 0 ? (totalErrors / totalRecords) * 100 : 0;
    const successRate = 100 - errorRate;

    return {
      totalBatches,
      totalRecords,
      highValueCount,
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      bySource: Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        count: data.count,
        errorCount: data.errorCount
      })),
      byState: Array.from(stateMap.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count),
      recentBatches: batches.slice(0, 10).map(b => ({
        id: b.id,
        source: b.source?.name || "UNKNOWN",
        recordCount: b.totalRecords,
        errorCount: b.totalRecords - b.createdCases,
        createdAt: b.createdAt
      }))
    };
  }

  // ============================================
  // PAYOUT STATISTICS
  // ============================================

  /**
   * Get comprehensive payout statistics
   * Uses LedgerEntry to track money flow
   */
  async getPayoutStats(range: DateRange = "30d"): Promise<{
    totalPayouts: number;
    totalClientPayoutCents: number;
    totalEmployeeCommissionCents: number;
    totalFounderShareCents: number;
    totalCompanyRevenueCents: number;
    anomaliesCount: number;
    byStatus: { status: LedgerEntryStatus; count: number; totalCents: number }[];
    byEmployee: { employeeId: string; employeeName: string; count: number; totalCommissionCents: number }[];
    largePayouts: {
      id: string;
      caseId: string;
      amountCents: number;
      employeeId: string;
      createdAt: Date;
    }[];
    averagePayoutCents: number;
    medianPayoutCents: number;
  }> {
    const startDate = getDateFromRange(range);
    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

    // Get all ledger entries in range
    const entries = await prisma.ledgerEntry.findMany({
      where: dateFilter,
      include: {
        case: {
          select: {
            id: true,
            assignedEmployeeId: true,
            assignedEmployee: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Calculate totals by type
    let totalClientPayoutCents = 0;
    let totalEmployeeCommissionCents = 0;
    let totalFounderShareCents = 0;
    let totalCompanyRevenueCents = 0;
    let anomaliesCount = 0;
    const statusMap = new Map<LedgerEntryStatus, { count: number; totalCents: number }>();
    const employeeMap = new Map<string, { name: string; count: number; totalCommissionCents: number }>();
    const clientPayoutAmounts: number[] = [];

    const ANOMALY_THRESHOLD_CENTS = 10000000; // $100,000

    for (const entry of entries) {
      // Track by type
      switch (entry.type) {
        case "CLIENT_PAYOUT":
          totalClientPayoutCents += entry.amountCents;
          clientPayoutAmounts.push(entry.amountCents);
          if (entry.amountCents >= ANOMALY_THRESHOLD_CENTS) anomaliesCount++;
          break;
        case "EMPLOYEE_COMMISSION":
          totalEmployeeCommissionCents += entry.amountCents;
          // Track by employee
          if (entry.user) {
            const empEntry = employeeMap.get(entry.user.id) || { name: entry.user.name, count: 0, totalCommissionCents: 0 };
            empEntry.count++;
            empEntry.totalCommissionCents += entry.amountCents;
            employeeMap.set(entry.user.id, empEntry);
          }
          break;
        case "FOUNDER_SHARE":
          totalFounderShareCents += entry.amountCents;
          break;
        case "COMPANY_FEE":
          totalCompanyRevenueCents += entry.amountCents;
          break;
      }

      // Track by status
      const statusEntry = statusMap.get(entry.status) || { count: 0, totalCents: 0 };
      statusEntry.count++;
      statusEntry.totalCents += entry.amountCents;
      statusMap.set(entry.status, statusEntry);
    }

    // Calculate average and median
    const clientPayouts = entries.filter(e => e.type === "CLIENT_PAYOUT");
    const averagePayoutCents = clientPayouts.length > 0
      ? Math.round(totalClientPayoutCents / clientPayouts.length)
      : 0;

    clientPayoutAmounts.sort((a, b) => a - b);
    const medianPayoutCents = clientPayoutAmounts.length > 0
      ? clientPayoutAmounts[Math.floor(clientPayoutAmounts.length / 2)]
      : 0;

    // Get large payouts
    const largePayouts = clientPayouts
      .filter(e => e.amountCents >= ANOMALY_THRESHOLD_CENTS)
      .slice(0, 10)
      .map(e => ({
        id: e.id,
        caseId: e.caseId,
        amountCents: e.amountCents,
        employeeId: e.case?.assignedEmployeeId || "unknown",
        createdAt: e.createdAt
      }));

    return {
      totalPayouts: clientPayouts.length,
      totalClientPayoutCents,
      totalEmployeeCommissionCents,
      totalFounderShareCents,
      totalCompanyRevenueCents,
      anomaliesCount,
      byStatus: Array.from(statusMap.entries()).map(([status, data]) => ({
        status,
        count: data.count,
        totalCents: data.totalCents
      })),
      byEmployee: Array.from(employeeMap.entries())
        .map(([employeeId, data]) => ({
          employeeId,
          employeeName: data.name,
          count: data.count,
          totalCommissionCents: data.totalCommissionCents
        }))
        .sort((a, b) => b.totalCommissionCents - a.totalCommissionCents),
      largePayouts,
      averagePayoutCents,
      medianPayoutCents
    };
  }

  // ============================================
  // CASE FUNNEL STATISTICS
  // ============================================

  /**
   * Get case funnel statistics
   * Tracks cases through each stage
   */
  async getCaseFunnelStats(): Promise<{
    countsByStatus: { status: CaseStatus; count: number; percentage: number }[];
    totalCases: number;
    activeCases: number;
    completedCases: number;
    paidCases: number;
    averageDaysToClose: number;
  }> {
    // Get all cases
    const cases = await prisma.case.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        paidAt: true,
        closedAt: true
      }
    });

    // Count by status
    const statusCounts = new Map<CaseStatus, number>();
    for (const c of cases) {
      statusCounts.set(c.status, (statusCounts.get(c.status) || 0) + 1);
    }

    const totalCases = cases.length;

    // Define the funnel stages in order (matching actual schema)
    const funnelOrder: CaseStatus[] = [
      "NEW",
      "CONTACTED",
      "DOCS_PENDING",
      "DOCS_SIGNED",
      "FILED",
      "AWAITING_FUNDS",
      "PAID",
      "CLOSED",
      "REJECTED"
    ];

    // Calculate special counts
    const activeCases = cases.filter(c =>
      !["PAID", "CLOSED", "REJECTED"].includes(c.status)
    ).length;

    const completedCases = cases.filter(c =>
      ["AWAITING_FUNDS", "PAID", "CLOSED"].includes(c.status)
    ).length;

    const paidCases = cases.filter(c => c.status === "PAID").length;

    // Calculate average days to close for completed cases
    let totalDays = 0;
    let closedCount = 0;
    for (const c of cases) {
      if ((c.paidAt || c.closedAt) && c.createdAt) {
        const endDate = c.paidAt || c.closedAt;
        if (endDate) {
          const days = (endDate.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          totalDays += days;
          closedCount++;
        }
      }
    }
    const averageDaysToClose = closedCount > 0 ? Math.round(totalDays / closedCount) : 0;

    return {
      countsByStatus: Array.from(statusCounts.entries())
        .map(([status, count]) => ({
          status,
          count,
          percentage: totalCases > 0 ? Math.round((count / totalCases) * 1000) / 10 : 0
        }))
        .sort((a, b) => funnelOrder.indexOf(a.status) - funnelOrder.indexOf(b.status)),
      totalCases,
      activeCases,
      completedCases,
      paidCases,
      averageDaysToClose
    };
  }

  // ============================================
  // TRAINING & OPERATIONS STATS
  // ============================================

  /**
   * Get training operations statistics
   * Correlates training completion with performance
   */
  async getTrainingOpsStats(): Promise<{
    totalModules: number;
    totalAssignments: number;
    completionRate: number;
    byModule: {
      moduleId: string;
      moduleName: string;
      assignedCount: number;
      completedCount: number;
      completionRate: number;
    }[];
    byEmployee: {
      employeeId: string;
      employeeName: string;
      assignedCount: number;
      completedCount: number;
      completionRate: number;
      casesHandled: number;
      conversionRate: number;
    }[];
    correlationInsights: {
      highPerformers: { employeeId: string; name: string; trainingScore: number; caseConversion: number }[];
      needsAttention: { employeeId: string; name: string; trainingScore: number; caseConversion: number }[];
    };
  }> {
    // Get all training modules
    const modules = await prisma.trainingModule.findMany({
      include: {
        progress: {
          include: {
            employee: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Get employee case performance
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: {
        assignedCases: {
          select: {
            id: true,
            status: true
          }
        },
        trainingProgress: {
          include: {
            module: true
          }
        }
      }
    });

    // Calculate module stats
    const moduleStats = modules.map(m => {
      const assignedCount = m.progress.length;
      const completedCount = m.progress.filter(a => a.completedAt !== null).length;
      return {
        moduleId: m.id,
        moduleName: m.title,
        assignedCount,
        completedCount,
        completionRate: assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0
      };
    });

    // Calculate employee stats with correlation
    const employeeStats = employees.map(emp => {
      const assignedCount = emp.trainingProgress.length;
      const completedCount = emp.trainingProgress.filter(t => t.completedAt !== null).length;
      const completionRate = assignedCount > 0 ? (completedCount / assignedCount) * 100 : 0;

      const casesHandled = emp.assignedCases.length;
      const successfulCases = emp.assignedCases.filter(c =>
        ["AWAITING_FUNDS", "PAID", "CLOSED"].includes(c.status)
      ).length;
      const conversionRate = casesHandled > 0 ? (successfulCases / casesHandled) * 100 : 0;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        assignedCount,
        completedCount,
        completionRate: Math.round(completionRate),
        casesHandled,
        conversionRate: Math.round(conversionRate * 10) / 10
      };
    });

    // Calculate total stats
    const totalModules = modules.length;
    const totalAssignments = employees.reduce((sum, e) => sum + e.trainingProgress.length, 0);
    const totalCompleted = employees.reduce((sum, e) =>
      sum + e.trainingProgress.filter(t => t.completedAt !== null).length, 0
    );
    const overallCompletionRate = totalAssignments > 0
      ? Math.round((totalCompleted / totalAssignments) * 100)
      : 0;

    // Identify high performers and those needing attention
    const withScores = employeeStats
      .filter(e => e.casesHandled >= 3) // Only include those with meaningful data
      .map(e => ({
        employeeId: e.employeeId,
        name: e.employeeName,
        trainingScore: e.completionRate,
        caseConversion: e.conversionRate
      }));

    const highPerformers = withScores
      .filter(e => e.trainingScore >= 80 && e.caseConversion >= 50)
      .sort((a, b) => (b.trainingScore + b.caseConversion) - (a.trainingScore + a.caseConversion))
      .slice(0, 5);

    const needsAttention = withScores
      .filter(e => e.trainingScore < 50 || e.caseConversion < 30)
      .sort((a, b) => (a.trainingScore + a.caseConversion) - (b.trainingScore + b.caseConversion))
      .slice(0, 5);

    return {
      totalModules,
      totalAssignments,
      completionRate: overallCompletionRate,
      byModule: moduleStats,
      byEmployee: employeeStats,
      correlationInsights: {
        highPerformers,
        needsAttention
      }
    };
  }

  // ============================================
  // JURISDICTION METRICS
  // ============================================

  /**
   * Get or update jurisdiction volatility metrics
   * Calculates volatility index based on rule changes, deadlines, and case outcomes
   */
  async getJurisdictionMetrics(state?: string): Promise<{
    metrics: {
      state: string;
      county: string | null;
      volatilityScore: number;
      ruleChangesLast30Days: number;
      avgDaysToClose: number | null;
      totalCases: number;
      paidCases: number;
      lastUpdated: Date;
    }[];
    highVolatilityAlerts: { state: string; county: string | null; volatilityScore: number }[];
  }> {
    const whereClause = state ? { state } : {};

    const metrics = await prisma.jurisdictionMetrics.findMany({
      where: whereClause,
      orderBy: { volatilityScore: "desc" }
    });

    const highVolatilityAlerts = metrics
      .filter(m => m.volatilityScore >= 70)
      .map(m => ({
        state: m.state,
        county: m.county,
        volatilityScore: m.volatilityScore
      }));

    return {
      metrics: metrics.map(m => ({
        state: m.state,
        county: m.county,
        volatilityScore: m.volatilityScore,
        ruleChangesLast30Days: m.ruleChangesLast30Days,
        avgDaysToClose: m.avgDaysToClose,
        totalCases: m.totalCases,
        paidCases: m.paidCases,
        lastUpdated: m.updatedAt
      })),
      highVolatilityAlerts
    };
  }

  /**
   * Recalculate jurisdiction metrics based on recent data
   */
  async recalculateJurisdictionMetrics(state: string, county?: string): Promise<{
    volatilityScore: number;
    ruleChangesLast30Days: number;
    avgDaysToClose: number;
    totalCases: number;
    paidCases: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count rule changes from scraped items
    const ruleChanges = await prisma.scrapedItem.count({
      where: {
        state,
        county: county || undefined,
        reviewStatus: "ACTIONABLE",
        fetchedAt: { gte: thirtyDaysAgo }
      }
    });

    // Get cases for this jurisdiction
    const cases = await prisma.case.findMany({
      where: {
        state,
        county: county || undefined
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        paidAt: true,
        closedAt: true
      }
    });

    // Calculate success rate
    const completedCases = cases.filter(c =>
      ["AWAITING_FUNDS", "PAID", "CLOSED"].includes(c.status)
    );
    const paidCases = cases.filter(c => c.status === "PAID").length;
    const rejectedCases = cases.filter(c => c.status === "REJECTED").length;
    const totalCases = cases.length;

    // Calculate average processing days
    let totalDays = 0;
    let caseCount = 0;
    for (const c of completedCases) {
      const endDate = c.paidAt || c.closedAt;
      if (endDate && c.createdAt) {
        totalDays += (endDate.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        caseCount++;
      }
    }
    const avgDaysToClose = caseCount > 0 ? Math.round(totalDays / caseCount) : 45; // Default 45 days

    // Calculate volatility score (0-100)
    const ruleChangeScore = Math.min(ruleChanges * 10, 40);
    const successRate = totalCases > 0 ? (completedCases.length / (completedCases.length + rejectedCases)) * 100 : 50;
    const successScore = Math.max(0, (100 - successRate) * 0.3);
    const processingScore = Math.min(avgDaysToClose / 2, 30);
    const volatilityScore = Math.min(100, Math.round(ruleChangeScore + successScore + processingScore));

    // Upsert the metrics
    await prisma.jurisdictionMetrics.upsert({
      where: {
        state_county: {
          state,
          county: county || ""
        }
      },
      create: {
        state,
        county: county || null,
        volatilityScore,
        ruleChangesLast30Days: ruleChanges,
        avgDaysToClose,
        totalCases,
        paidCases
      },
      update: {
        volatilityScore,
        ruleChangesLast30Days: ruleChanges,
        avgDaysToClose,
        totalCases,
        paidCases
      }
    });

    return {
      volatilityScore,
      ruleChangesLast30Days: ruleChanges,
      avgDaysToClose,
      totalCases,
      paidCases
    };
  }

  // ============================================
  // EMPLOYEE INTEGRITY SCORES
  // ============================================

  /**
   * Get employee integrity scores
   * Founder-only view of employee performance and trust metrics
   */
  async getEmployeeIntegrityScores(): Promise<{
    scores: {
      employeeId: string;
      employeeName: string;
      integrityScore: number;
      casesHandled: number;
      successRate: number;
      trainingCompletion: number;
      flags: string[];
    }[];
    flaggedEmployees: { employeeId: string; name: string; flags: string[] }[];
  }> {
    // Get all employees with their metrics
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: {
        assignedCases: {
          select: { status: true }
        },
        trainingProgress: {
          select: { completedAt: true }
        }
      }
    });

    // Get existing integrity scores
    const existingScores = await prisma.employeeIntegrityScore.findMany();
    const scoreMap = new Map(existingScores.map(s => [s.employeeId, s]));

    const scores = employees.map(emp => {
      const existing = scoreMap.get(emp.id);
      const casesHandled = emp.assignedCases.length;
      const paidCases = emp.assignedCases.filter(c => c.status === "PAID").length;
      const successRate = casesHandled > 0 ? Math.round((paidCases / casesHandled) * 100) : 0;

      const assignedTrainings = emp.trainingProgress.length;
      const completedTrainings = emp.trainingProgress.filter(t => t.completedAt !== null).length;
      const trainingCompletion = assignedTrainings > 0
        ? Math.round((completedTrainings / assignedTrainings) * 100)
        : 0;

      // Calculate integrity score
      const integrityScore = existing?.integrityScore || Math.round(
        successRate * 0.5 + trainingCompletion * 0.5
      );

      // Determine flags
      const flags: string[] = [];
      if (successRate < 30 && casesHandled >= 5) flags.push("LOW_SUCCESS_RATE");
      if (trainingCompletion < 50 && assignedTrainings >= 3) flags.push("TRAINING_INCOMPLETE");

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        integrityScore,
        casesHandled,
        successRate,
        trainingCompletion,
        flags
      };
    });

    const flaggedEmployees = scores
      .filter(s => s.flags.length > 0)
      .map(s => ({
        employeeId: s.employeeId,
        name: s.employeeName,
        flags: s.flags
      }));

    return {
      scores: scores.sort((a, b) => b.integrityScore - a.integrityScore),
      flaggedEmployees
    };
  }

  /**
   * Recalculate employee integrity score
   */
  async recalculateEmployeeIntegrity(employeeId: string): Promise<{
    integrityScore: number;
    flags: string[];
  }> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        assignedCases: {
          select: {
            status: true,
            createdAt: true,
            paidAt: true,
            closedAt: true
          }
        },
        trainingProgress: {
          select: { completedAt: true }
        }
      }
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    const cases = employee.assignedCases;
    const casesHandled = cases.length;

    // Calculate success rate
    const successfulCases = cases.filter(c =>
      ["AWAITING_FUNDS", "PAID", "CLOSED"].includes(c.status)
    );
    const paidCases = cases.filter(c => c.status === "PAID").length;
    const rejectedCases = cases.filter(c => c.status === "REJECTED").length;
    const successRate = casesHandled > 0 ? (successfulCases.length / casesHandled) * 100 : 0;
    const conversionRate = (casesHandled - rejectedCases) > 0
      ? (paidCases / (casesHandled - rejectedCases)) * 100
      : 0;

    // Calculate training completion
    const trainingsAssigned = employee.trainingProgress.length;
    const trainingsCompleted = employee.trainingProgress.filter(t => t.completedAt !== null).length;
    const trainingCompletion = trainingsAssigned > 0 ? (trainingsCompleted / trainingsAssigned) * 100 : 0;

    // Calculate integrity score (weighted average)
    const integrityScore = Math.round(
      successRate * 0.5 +
      trainingCompletion * 0.5
    );

    // Identify flags
    const flags: string[] = [];
    if (successRate < 30 && casesHandled >= 5) flags.push("LOW_SUCCESS_RATE");
    if (trainingCompletion < 50 && trainingsAssigned >= 3) flags.push("TRAINING_INCOMPLETE");

    // Upsert the score
    await prisma.employeeIntegrityScore.upsert({
      where: { employeeId },
      create: {
        employeeId,
        integrityScore,
        totalCases: casesHandled,
        paidCases,
        rejectedCases,
        conversionRate: Math.round(conversionRate),
        trainingCompletionPct: Math.round(trainingCompletion),
        riskFlags: flags
      },
      update: {
        integrityScore,
        totalCases: casesHandled,
        paidCases,
        rejectedCases,
        conversionRate: Math.round(conversionRate),
        trainingCompletionPct: Math.round(trainingCompletion),
        riskFlags: flags
      }
    });

    return { integrityScore, flags };
  }

  // ============================================
  // CASE HEATMAP
  // ============================================

  /**
   * Get case heatmap data by jurisdiction
   * Geographic visualization of case activity and risk
   */
  async getCaseHeatmap(): Promise<{
    entries: {
      state: string;
      county: string | null;
      caseCount: number;
      totalValueCents: number;
      riskScore: number;
      trend: "UP" | "DOWN" | "STABLE";
    }[];
    hotspots: { state: string; county: string | null; caseCount: number; totalValueCents: number }[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get all cases grouped by state/county
    const cases = await prisma.case.findMany({
      select: {
        state: true,
        county: true,
        surplusAmountCents: true,
        createdAt: true
      }
    });

    // Group by jurisdiction
    const jurisdictionMap = new Map<string, {
      state: string;
      county: string | null;
      caseCount: number;
      totalValueCents: number;
      recentCount: number;
      previousCount: number;
    }>();

    for (const c of cases) {
      const key = `${c.state}-${c.county || ""}`;
      const existing = jurisdictionMap.get(key) || {
        state: c.state,
        county: c.county,
        caseCount: 0,
        totalValueCents: 0,
        recentCount: 0,
        previousCount: 0
      };

      existing.caseCount++;
      existing.totalValueCents += c.surplusAmountCents || 0;

      if (c.createdAt >= thirtyDaysAgo) {
        existing.recentCount++;
      } else if (c.createdAt >= sixtyDaysAgo) {
        existing.previousCount++;
      }

      jurisdictionMap.set(key, existing);
    }

    // Calculate risk scores and trends
    const entries = Array.from(jurisdictionMap.values()).map(j => {
      let trend: "UP" | "DOWN" | "STABLE" = "STABLE";
      if (j.recentCount > j.previousCount * 1.2) trend = "UP";
      else if (j.recentCount < j.previousCount * 0.8) trend = "DOWN";

      const volumeScore = Math.min(j.caseCount * 5, 50);
      const valueScore = Math.min(j.totalValueCents / 1000000, 30);
      const trendScore = trend === "UP" ? 20 : trend === "DOWN" ? 5 : 10;
      const riskScore = Math.min(100, Math.round(volumeScore + valueScore + trendScore));

      return {
        state: j.state,
        county: j.county,
        caseCount: j.caseCount,
        totalValueCents: j.totalValueCents,
        riskScore,
        trend
      };
    }).sort((a, b) => b.caseCount - a.caseCount);

    const hotspots = entries
      .filter(e => e.caseCount >= 5 || e.totalValueCents >= 10000000)
      .slice(0, 10)
      .map(e => ({
        state: e.state,
        county: e.county,
        caseCount: e.caseCount,
        totalValueCents: e.totalValueCents
      }));

    return { entries, hotspots };
  }

  /**
   * Update case heatmap entries for a specific state/county
   */
  async updateCaseHeatmap(state: string, county?: string): Promise<void> {
    // For individual case heatmap entries, update the CaseHeatmapEntry model
    const cases = await prisma.case.findMany({
      where: { state, county: county || undefined },
      select: {
        id: true,
        internalCode: true,
        status: true,
        surplusAmountCents: true,
        createdAt: true
      }
    });

    for (const c of cases) {
      const daysOld = Math.floor((Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const valueScore = Math.min(100, Math.round((c.surplusAmountCents || 0) / 100000)); // $1000 = 1 point
      const ageScore = Math.min(100, daysOld);

      await prisma.caseHeatmapEntry.upsert({
        where: { caseId: c.id },
        create: {
          caseId: c.id,
          internalCode: c.internalCode,
          currentStatus: c.status,
          valueScore,
          ageScore,
          daysInStatus: daysOld,
          overallHeatScore: Math.round((valueScore + ageScore) / 2)
        },
        update: {
          currentStatus: c.status,
          valueScore,
          ageScore,
          daysInStatus: daysOld,
          overallHeatScore: Math.round((valueScore + ageScore) / 2)
        }
      });
    }
  }

  // ============================================
  // FOUNDER FOCUS FEED
  // ============================================

  /**
   * Get Founder Focus Feed items
   * Prioritized list of items requiring Founder attention
   */
  async getFounderFocusFeed(limit: number = 20): Promise<{
    items: {
      id: string;
      type: string;
      priority: number;
      title: string;
      summary: string;
      actionRequired: boolean;
      relatedCaseId: string | null;
      relatedUserId: string | null;
      createdAt: Date;
    }[];
    unreadCount: number;
    highPriorityCount: number;
  }> {
    const items = await prisma.founderFocusItem.findMany({
      where: { isDismissed: false },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ],
      take: limit
    });

    const [unreadCount, highPriorityCount] = await Promise.all([
      prisma.founderFocusItem.count({
        where: { isDismissed: false }
      }),
      prisma.founderFocusItem.count({
        where: {
          isDismissed: false,
          priority: { gte: 8 }
        }
      })
    ]);

    return {
      items: items.map(i => ({
        id: i.id,
        type: i.category,
        priority: i.priority,
        title: i.title,
        summary: i.description,
        actionRequired: i.suggestedAction !== null,
        relatedCaseId: i.relatedCaseId,
        relatedUserId: i.relatedUserId,
        createdAt: i.createdAt
      })),
      unreadCount,
      highPriorityCount
    };
  }

  /**
   * Create a Founder Focus item
   */
  async createFocusItem(data: {
    type: string;
    priority: number;
    title: string;
    summary: string;
    actionRequired?: boolean;
    relatedCaseId?: string;
    relatedUserId?: string;
  }): Promise<string> {
    const item = await prisma.founderFocusItem.create({
      data: {
        category: data.type,
        priority: Math.min(100, Math.max(1, data.priority)),
        title: data.title,
        description: data.summary,
        suggestedAction: data.actionRequired ? "Review required" : null,
        relatedCaseId: data.relatedCaseId,
        relatedUserId: data.relatedUserId
      }
    });
    return item.id;
  }

  /**
   * Dismiss a Founder Focus item
   */
  async dismissFocusItem(id: string): Promise<void> {
    await prisma.founderFocusItem.update({
      where: { id },
      data: {
        isDismissed: true,
        dismissedAt: new Date()
      }
    });
  }

  // ============================================
  // COMPREHENSIVE DASHBOARD
  // ============================================

  /**
   * Get comprehensive ops dashboard data
   * Single call for Founder Console overview
   */
  async getOpsDashboard(): Promise<{
    summary: {
      totalCases: number;
      activeCases: number;
      totalPayoutsCents: number;
      pendingAlerts: number;
      employeeCount: number;
    };
    recentActivity: {
      newCases24h: number;
      payoutsProcessed24h: number;
      alertsCreated24h: number;
      documentsUploaded24h: number;
    };
    topMetrics: {
      conversionRate: number;
      avgCaseValueCents: number;
      avgProcessingDays: number;
    };
    alerts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Run queries in parallel for performance
    const [
      caseStats,
      payoutStats,
      alertStats,
      employeeCount,
      newCases24h,
      payoutsProcessed24h,
      alertsCreated24h,
      documentsUploaded24h
    ] = await Promise.all([
      prisma.case.groupBy({
        by: ["status"],
        _count: true
      }),
      // Use LedgerEntry for payout stats (no Payout model exists)
      prisma.ledgerEntry.aggregate({
        where: { type: "CLIENT_PAYOUT" },
        _sum: { amountCents: true },
        _avg: { amountCents: true }
      }),
      prisma.watchAlert.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: true
      }),
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.case.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      // Use LedgerEntry for payout count
      prisma.ledgerEntry.count({
        where: {
          type: "CLIENT_PAYOUT",
          createdAt: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.watchAlert.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      // Document uses createdAt, not uploadedAt
      prisma.document.count({ where: { createdAt: { gte: twentyFourHoursAgo } } })
    ]);

    const totalCases = caseStats.reduce((sum, s) => sum + s._count, 0);
    // Use correct CaseStatus values: PAID instead of PAID_OUT
    const activeCases = caseStats
      .filter(s => !["PAID", "CLOSED", "REJECTED"].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0);
    // Use correct CaseStatus values: AWAITING_FUNDS and PAID
    const completedCases = caseStats
      .filter(s => ["AWAITING_FUNDS", "PAID", "CLOSED"].includes(s.status))
      .reduce((sum, s) => sum + s._count, 0);

    const alertCounts = {
      critical: alertStats.find(a => a.severity === "CRITICAL")?._count || 0,
      high: alertStats.find(a => a.severity === "HIGH")?._count || 0,
      medium: alertStats.find(a => a.severity === "MEDIUM")?._count || 0,
      low: alertStats.find(a => a.severity === "LOW")?._count || 0
    };

    return {
      summary: {
        totalCases,
        activeCases,
        totalPayoutsCents: payoutStats._sum.amountCents || 0,
        pendingAlerts: alertCounts.critical + alertCounts.high + alertCounts.medium + alertCounts.low,
        employeeCount
      },
      recentActivity: {
        newCases24h,
        payoutsProcessed24h,
        alertsCreated24h,
        documentsUploaded24h
      },
      topMetrics: {
        conversionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        avgCaseValueCents: Math.round(payoutStats._avg.amountCents || 0),
        avgProcessingDays: 0 // Would need more complex calculation
      },
      alerts: alertCounts
    };
  }
}

export const opsMetricsService = new OpsMetricsService();
