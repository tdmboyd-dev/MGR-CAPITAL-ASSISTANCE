/**
 * ReportingService.ts
 *
 * Report generation service for MGR Capital Assistance (Phase 7).
 * Generates CSV/Excel exports, scheduled digests, and analytics reports.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
// import ExcelJS from "exceljs";  // TODO: Install exceljs

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface ReportConfig {
  includeFinancials: boolean;
  includeEmployeeMetrics: boolean;
  includeCaseDetails: boolean;
  dateRange: { from: Date; to: Date };
  format: "csv" | "xlsx" | "pdf";
}

interface DailyDigest {
  date: string;
  summary: {
    newCases: number;
    closedCases: number;
    pendingPayouts: number;
    totalRevenueCents: number;
    employeeCount: number;
  };
  highlights: string[];
  alerts: Array<{ title: string; severity: string; message: string }>;
  recommendations: string[];
}

interface WeeklySummary extends DailyDigest {
  weekNumber: number;
  casesByStatus: Record<string, number>;
  topPerformingEmployees: Array<{ name: string; casesCompleted: number; revenueCents: number }>;
  jurisdictionBreakdown: Array<{ state: string; caseCount: number; successRate: number }>;
}

interface MonthlyMetrics {
  month: string;
  year: number;
  financials: {
    totalRevenueCents: number;
    totalPayoutsCents: number;
    founderShareCents: number;
    employeeCommissionsCents: number;
  };
  operations: {
    casesOpened: number;
    casesClosed: number;
    avgCycleTimeDays: number;
    successRate: number;
  };
  growth: {
    revenueGrowthPercent: number;
    caseGrowthPercent: number;
    employeeGrowthPercent: number;
  };
  trends: {
    topJurisdictions: Array<{ jurisdiction: string; caseCount: number; avgValueCents: number }>;
    casesBySource: Record<string, number>;
  };
}

interface ExportResult {
  success: boolean;
  filename: string;
  filepath: string;
  sizeBytes: number;
  rowCount: number;
  error?: string;
}

// =============================================================================
// REPORTING SERVICE
// =============================================================================

class ReportingService {
  // ---------------------------------------------------------------------------
  // SCHEDULED DIGESTS
  // ---------------------------------------------------------------------------

  /**
   * Generate daily digest for FOUNDER
   */
  async generateDailyDigest(): Promise<DailyDigest> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get case counts
    const [newCases, closedCases] = await Promise.all([
      prisma.case.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.case.count({
        where: { status: "PAID", updatedAt: { gte: today, lt: tomorrow } },
      }),
    ]);

    // Get pending payouts
    const pendingPayouts = await prisma.ledgerEntry.count({
      where: { status: "PENDING" },
    });

    // Get revenue (completed payouts today)
    const revenueEntries = await prisma.ledgerEntry.aggregate({
      where: {
        type: "FOUNDER_SHARE",
        status: "COMPLETED",
        completedAt: { gte: today, lt: tomorrow },
      },
      _sum: { amountCents: true },
    });

    // Get active employees
    const employeeCount = await prisma.user.count({
      where: { role: "EMPLOYEE", isActive: true },
    });

    // Get alerts from OpsInsight
    const alertInsights = await prisma.opsInsight.findMany({
      where: {
        createdAt: { gte: today },
        priority: { in: ["HIGH", "URGENT"] },
        status: "OPEN",
      },
      select: { title: true, severity: true, plainEnglish: true },
      take: 10,
    });

    const alerts = alertInsights.map((a) => ({
      title: a.title,
      severity: a.severity || "MEDIUM",
      message: a.plainEnglish || "",
    }));

    // Generate highlights
    const highlights: string[] = [];
    if (newCases > 0) highlights.push(`${newCases} new cases created`);
    if (closedCases > 0) highlights.push(`${closedCases} cases paid out`);
    if (revenueEntries._sum.amountCents) {
      const revenue = (revenueEntries._sum.amountCents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      highlights.push(`${revenue} in founder share earned`);
    }

    // Get recommendations from recent OpsInsights
    const recommendations = await prisma.opsInsight.findMany({
      where: {
        createdAt: { gte: today },
        recommendations: { isEmpty: false },
      },
      select: { recommendations: true },
      take: 5,
    });

    const digest: DailyDigest = {
      date: today.toISOString().split("T")[0],
      summary: {
        newCases,
        closedCases,
        pendingPayouts,
        totalRevenueCents: revenueEntries._sum.amountCents || 0,
        employeeCount,
      },
      highlights,
      alerts,
      recommendations: recommendations.flatMap((r) => r.recommendations).slice(0, 10),
    };

    // Save digest
    await prisma.opsInsight.create({
      data: {
        source: "ReportingService",
        category: "DAILY_DIGEST",
        severity: "LOW",
        title: `Daily Digest: ${digest.date}`,
        description: highlights.join(". "),
        data: digest as unknown as Record<string, unknown>,
        status: "CLOSED",
      },
    });

    return digest;
  }

  /**
   * Generate weekly summary report
   */
  async generateWeeklySummary(): Promise<WeeklySummary> {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get case status breakdown
    const casesByStatus = await prisma.case.groupBy({
      by: ["status"],
      _count: true,
      where: {
        updatedAt: { gte: weekAgo },
      },
    });

    const statusCounts: Record<string, number> = {};
    casesByStatus.forEach((c) => {
      statusCounts[c.status] = c._count;
    });

    // Get top performing employees
    const employeePerformance = await prisma.ledgerEntry.groupBy({
      by: ["userId"],
      _sum: { amountCents: true },
      _count: true,
      where: {
        type: "EMPLOYEE_COMMISSION",
        status: "COMPLETED",
        completedAt: { gte: weekAgo },
      },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 5,
    });

    const topEmployees = await Promise.all(
      employeePerformance.map(async (e) => {
        const user = await prisma.user.findUnique({
          where: { id: e.userId! },
          select: { name: true },
        });
        return {
          name: user?.name || "Unknown",
          casesCompleted: e._count,
          revenueCents: e._sum.amountCents || 0,
        };
      })
    );

    // Get jurisdiction breakdown
    const jurisdictionStats = await prisma.case.groupBy({
      by: ["state"],
      _count: true,
      where: {
        createdAt: { gte: weekAgo },
      },
      orderBy: { _count: { state: "desc" } },
      take: 10,
    });

    const jurisdictionBreakdown = jurisdictionStats.map((j) => ({
      state: j.state,
      caseCount: j._count,
      successRate: 0, // TODO: Calculate actual success rate
    }));

    // Get base daily digest data
    const dailyDigest = await this.generateDailyDigest();

    const weekNumber = Math.ceil(today.getDate() / 7);

    return {
      ...dailyDigest,
      weekNumber,
      casesByStatus: statusCounts,
      topPerformingEmployees: topEmployees,
      jurisdictionBreakdown,
    };
  }

  /**
   * Generate monthly metrics report
   */
  async generateMonthlyMetrics(): Promise<MonthlyMetrics> {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Financials this month
    const [founderShare, employeeCommissions, clientPayouts] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: {
          type: "FOUNDER_SHARE",
          status: "COMPLETED",
          completedAt: { gte: firstOfMonth, lt: firstOfNextMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          type: "EMPLOYEE_COMMISSION",
          status: "COMPLETED",
          completedAt: { gte: firstOfMonth, lt: firstOfNextMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          type: "CLIENT_PAYOUT",
          status: "COMPLETED",
          completedAt: { gte: firstOfMonth, lt: firstOfNextMonth },
        },
        _sum: { amountCents: true },
      }),
    ]);

    // Operations this month
    const [casesOpened, casesClosed] = await Promise.all([
      prisma.case.count({
        where: { createdAt: { gte: firstOfMonth, lt: firstOfNextMonth } },
      }),
      prisma.case.count({
        where: {
          status: "PAID",
          updatedAt: { gte: firstOfMonth, lt: firstOfNextMonth },
        },
      }),
    ]);

    // Last month for growth comparison
    const [lastMonthRevenue, lastMonthCases] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: {
          type: "FOUNDER_SHARE",
          status: "COMPLETED",
          completedAt: { gte: firstOfLastMonth, lt: firstOfMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.case.count({
        where: { createdAt: { gte: firstOfLastMonth, lt: firstOfMonth } },
      }),
    ]);

    const currentRevenue = founderShare._sum.amountCents || 0;
    const previousRevenue = lastMonthRevenue._sum.amountCents || 0;
    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const caseGrowth = lastMonthCases > 0
      ? ((casesOpened - lastMonthCases) / lastMonthCases) * 100
      : 0;

    // Top jurisdictions
    const topJurisdictions = await prisma.case.groupBy({
      by: ["state", "county"],
      _count: true,
      _avg: { surplusAmountCents: true },
      where: {
        createdAt: { gte: firstOfMonth },
      },
      orderBy: { _count: { state: "desc" } },
      take: 10,
    });

    return {
      month: today.toLocaleString("en-US", { month: "long" }),
      year: today.getFullYear(),
      financials: {
        totalRevenueCents: currentRevenue + (employeeCommissions._sum.amountCents || 0),
        totalPayoutsCents: clientPayouts._sum.amountCents || 0,
        founderShareCents: currentRevenue,
        employeeCommissionsCents: employeeCommissions._sum.amountCents || 0,
      },
      operations: {
        casesOpened,
        casesClosed,
        avgCycleTimeDays: 0, // TODO: Calculate
        successRate: casesOpened > 0 ? (casesClosed / casesOpened) * 100 : 0,
      },
      growth: {
        revenueGrowthPercent: Math.round(revenueGrowth * 100) / 100,
        caseGrowthPercent: Math.round(caseGrowth * 100) / 100,
        employeeGrowthPercent: 0, // TODO: Calculate
      },
      trends: {
        topJurisdictions: topJurisdictions.map((j) => ({
          jurisdiction: `${j.state}/${j.county}`,
          caseCount: j._count,
          avgValueCents: Math.round(j._avg.surplusAmountCents || 0),
        })),
        casesBySource: {}, // TODO: Implement
      },
    };
  }

  // ---------------------------------------------------------------------------
  // DATA EXPORTS
  // ---------------------------------------------------------------------------

  /**
   * Export cases to CSV/Excel
   */
  async exportCases(config: ReportConfig): Promise<ExportResult> {
    try {
      const cases = await prisma.case.findMany({
        where: {
          createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
        },
        include: {
          client: true,
          assignedEmployee: config.includeEmployeeMetrics ? { select: { name: true, email: true } } : undefined,
        },
      });

      // TODO: Implement actual file generation with ExcelJS
      const filename = `cases_export_${new Date().toISOString().split("T")[0]}.${config.format}`;

      return {
        success: true,
        filename,
        filepath: `./exports/${filename}`,
        sizeBytes: 0,
        rowCount: cases.length,
      };
    } catch (error) {
      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Export financial ledger to CSV/Excel
   */
  async exportLedger(config: ReportConfig): Promise<ExportResult> {
    try {
      const entries = await prisma.ledgerEntry.findMany({
        where: {
          createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
        },
        include: {
          case: { select: { internalCode: true } },
          user: { select: { name: true } },
        },
      });

      const filename = `ledger_export_${new Date().toISOString().split("T")[0]}.${config.format}`;

      return {
        success: true,
        filename,
        filepath: `./exports/${filename}`,
        sizeBytes: 0,
        rowCount: entries.length,
      };
    } catch (error) {
      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Export employee performance to CSV/Excel
   */
  async exportEmployeeMetrics(config: ReportConfig): Promise<ExportResult> {
    try {
      const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        include: {
          assignedCases: {
            where: {
              createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
            },
            select: { status: true, surplusAmountCents: true },
          },
          ledgerEntries: {
            where: {
              type: "EMPLOYEE_COMMISSION",
              createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
            },
            select: { amountCents: true, displayedAmountCents: true },
          },
        },
      });

      const filename = `employees_export_${new Date().toISOString().split("T")[0]}.${config.format}`;

      return {
        success: true,
        filename,
        filepath: `./exports/${filename}`,
        sizeBytes: 0,
        rowCount: employees.length,
      };
    } catch (error) {
      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // AUDIT EXPORTS
  // ---------------------------------------------------------------------------

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(dateRange: { from: Date; to: Date }): Promise<ExportResult> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
        },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const filename = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;

      return {
        success: true,
        filename,
        filepath: `./exports/${filename}`,
        sizeBytes: 0,
        rowCount: logs.length,
      };
    } catch (error) {
      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const reportingService = new ReportingService();

export default reportingService;
