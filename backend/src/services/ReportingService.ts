/**
 * ReportingService.ts
 *
 * Production-ready report generation service for MGR Capital Assistance (Phase 7).
 * Generates CSV/Excel exports, scheduled digests, and analytics reports.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 *
 * Features:
 * - Excel workbook generation with exceljs
 * - Daily/weekly/monthly digest reports
 * - Case/ledger/employee export functionality
 * - Audit log exports for compliance
 * - Document Vault storage for generated reports
 */

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface ReportConfig {
  includeFinancials: boolean;
  includeEmployeeMetrics: boolean;
  includeCaseDetails: boolean;
  dateRange: { from: Date; to: Date };
  format: "csv" | "xlsx";
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
// CONFIGURATION
// =============================================================================

const DEFAULT_REPORT_DIR = process.env.REPORT_DIR || "./reports";

// =============================================================================
// REPORTING SERVICE
// =============================================================================

class ReportingService {
  private reportDir: string;

  constructor() {
    this.reportDir = DEFAULT_REPORT_DIR;
  }

  /**
   * Ensure report directory exists
   */
  private async ensureReportDir(): Promise<void> {
    await fs.promises.mkdir(this.reportDir, { recursive: true });
  }

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

    logger.info("Generating daily digest", { date: today.toISOString() });

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
      title: a.title || "",
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
        recommendations: { not: { equals: null as any } },
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
      recommendations: recommendations.flatMap((r) => (r.recommendations as string[]) || []).slice(0, 10),
    };

    // Save digest as Excel file
    await this.saveDailyDigestExcel(digest);

    // Save digest to OpsInsight
    await prisma.opsInsight.create({
      data: {
        source: "ReportingService",
        category: "DAILY_DIGEST",
        severity: "LOW",
        title: `Daily Digest: ${digest.date}`,
        description: highlights.join(". "),
        plainEnglish: `Daily summary for ${digest.date}: ${newCases} new cases, ${closedCases} closed, ${(revenueEntries._sum.amountCents || 0) / 100} revenue.`,
        data: digest as any,
        status: "CLOSED",
      },
    });

    logger.info("Daily digest generated", { date: digest.date, newCases, closedCases });
    return digest;
  }

  /**
   * Save daily digest as Excel file
   */
  private async saveDailyDigestExcel(digest: DailyDigest): Promise<void> {
    await this.ensureReportDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MGR Capital Assistance";
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
    ];

    summarySheet.addRows([
      { metric: "Date", value: digest.date },
      { metric: "New Cases", value: digest.summary.newCases },
      { metric: "Closed Cases", value: digest.summary.closedCases },
      { metric: "Pending Payouts", value: digest.summary.pendingPayouts },
      { metric: "Total Revenue", value: `$${(digest.summary.totalRevenueCents / 100).toFixed(2)}` },
      { metric: "Active Employees", value: digest.summary.employeeCount },
    ]);

    // Style header
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Highlights sheet
    const highlightsSheet = workbook.addWorksheet("Highlights");
    highlightsSheet.columns = [{ header: "Highlight", key: "highlight", width: 60 }];
    highlightsSheet.addRows(digest.highlights.map((h) => ({ highlight: h })));
    highlightsSheet.getRow(1).font = { bold: true };

    // Alerts sheet
    const alertsSheet = workbook.addWorksheet("Alerts");
    alertsSheet.columns = [
      { header: "Title", key: "title", width: 30 },
      { header: "Severity", key: "severity", width: 15 },
      { header: "Message", key: "message", width: 50 },
    ];
    alertsSheet.addRows(digest.alerts);
    alertsSheet.getRow(1).font = { bold: true };

    // Save file
    const filename = `daily_digest_${digest.date}.xlsx`;
    const filepath = path.join(this.reportDir, filename);
    await workbook.xlsx.writeFile(filepath);

    logger.debug("Daily digest Excel saved", { filepath });
  }

  /**
   * Generate weekly summary report
   */
  async generateWeeklySummary(): Promise<WeeklySummary> {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    logger.info("Generating weekly summary", { from: weekAgo.toISOString(), to: today.toISOString() });

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

    // Calculate success rates per jurisdiction
    const jurisdictionBreakdown = await Promise.all(
      jurisdictionStats.map(async (j) => {
        const successCount = await prisma.case.count({
          where: {
            state: j.state,
            status: "PAID",
            updatedAt: { gte: weekAgo },
          },
        });
        return {
          state: j.state,
          caseCount: j._count,
          successRate: j._count > 0 ? Math.round((successCount / j._count) * 100) : 0,
        };
      })
    );

    // Get base daily digest data
    const dailyDigest = await this.generateDailyDigest();

    const weekNumber = Math.ceil(today.getDate() / 7);

    const summary: WeeklySummary = {
      ...dailyDigest,
      weekNumber,
      casesByStatus: statusCounts,
      topPerformingEmployees: topEmployees,
      jurisdictionBreakdown,
    };

    // Save weekly summary Excel
    await this.saveWeeklySummaryExcel(summary);

    logger.info("Weekly summary generated", { weekNumber });
    return summary;
  }

  /**
   * Save weekly summary as Excel file
   */
  private async saveWeeklySummaryExcel(summary: WeeklySummary): Promise<void> {
    await this.ensureReportDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MGR Capital Assistance";
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
    ];

    summarySheet.addRows([
      { metric: "Week Number", value: summary.weekNumber },
      { metric: "Date", value: summary.date },
      { metric: "New Cases", value: summary.summary.newCases },
      { metric: "Closed Cases", value: summary.summary.closedCases },
      { metric: "Pending Payouts", value: summary.summary.pendingPayouts },
      { metric: "Total Revenue", value: `$${(summary.summary.totalRevenueCents / 100).toFixed(2)}` },
    ]);

    summarySheet.getRow(1).font = { bold: true };

    // Cases by Status sheet
    const statusSheet = workbook.addWorksheet("Cases by Status");
    statusSheet.columns = [
      { header: "Status", key: "status", width: 20 },
      { header: "Count", key: "count", width: 15 },
    ];
    statusSheet.addRows(
      Object.entries(summary.casesByStatus).map(([status, count]) => ({ status, count }))
    );
    statusSheet.getRow(1).font = { bold: true };

    // Top Employees sheet
    const employeesSheet = workbook.addWorksheet("Top Employees");
    employeesSheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Cases Completed", key: "casesCompleted", width: 18 },
      { header: "Revenue", key: "revenue", width: 15 },
    ];
    employeesSheet.addRows(
      summary.topPerformingEmployees.map((e) => ({
        name: e.name,
        casesCompleted: e.casesCompleted,
        revenue: `$${(e.revenueCents / 100).toFixed(2)}`,
      }))
    );
    employeesSheet.getRow(1).font = { bold: true };

    // Jurisdiction Breakdown sheet
    const jurisdictionSheet = workbook.addWorksheet("Jurisdictions");
    jurisdictionSheet.columns = [
      { header: "State", key: "state", width: 15 },
      { header: "Case Count", key: "caseCount", width: 15 },
      { header: "Success Rate", key: "successRate", width: 15 },
    ];
    jurisdictionSheet.addRows(
      summary.jurisdictionBreakdown.map((j) => ({
        state: j.state,
        caseCount: j.caseCount,
        successRate: `${j.successRate}%`,
      }))
    );
    jurisdictionSheet.getRow(1).font = { bold: true };

    // Save file
    const filename = `weekly_summary_${summary.date}.xlsx`;
    const filepath = path.join(this.reportDir, filename);
    await workbook.xlsx.writeFile(filepath);

    logger.debug("Weekly summary Excel saved", { filepath });
  }

  /**
   * Generate monthly metrics report
   */
  async generateMonthlyMetrics(): Promise<MonthlyMetrics> {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    logger.info("Generating monthly metrics", { month: today.getMonth() + 1, year: today.getFullYear() });

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
    const [lastMonthRevenue, lastMonthCases, lastMonthEmployees] = await Promise.all([
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
      prisma.user.count({
        where: {
          role: "EMPLOYEE",
          createdAt: { lt: firstOfMonth },
        },
      }),
    ]);

    const currentEmployees = await prisma.user.count({
      where: { role: "EMPLOYEE", isActive: true },
    });

    const currentRevenue = founderShare._sum.amountCents || 0;
    const previousRevenue = lastMonthRevenue._sum.amountCents || 0;
    const revenueGrowth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const caseGrowth = lastMonthCases > 0 ? ((casesOpened - lastMonthCases) / lastMonthCases) * 100 : 0;

    const employeeGrowth =
      lastMonthEmployees > 0
        ? ((currentEmployees - lastMonthEmployees) / lastMonthEmployees) * 100
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

    // Cases by source
    const casesBySource = await prisma.case.groupBy({
      by: ["source"],
      _count: true,
      where: {
        createdAt: { gte: firstOfMonth },
      },
    });

    const sourceMap: Record<string, number> = {};
    casesBySource.forEach((c) => {
      sourceMap[c.source || "UNKNOWN"] = c._count;
    });

    // Calculate average case cycle time (days from creation to closure)
    const closedCases = await prisma.case.findMany({
      where: {
        status: { in: ['PAID', 'CLOSED'] },
        updatedAt: { gte: firstOfMonth },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let avgCycleTimeDays = 0;
    if (closedCases.length > 0) {
      const totalDays = closedCases.reduce((sum, c) => {
        const days = Math.ceil((c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avgCycleTimeDays = Math.round(totalDays / closedCases.length);
    }

    const metrics: MonthlyMetrics = {
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
        avgCycleTimeDays,
        successRate: casesOpened > 0 ? Math.round((casesClosed / casesOpened) * 100) : 0,
      },
      growth: {
        revenueGrowthPercent: Math.round(revenueGrowth * 100) / 100,
        caseGrowthPercent: Math.round(caseGrowth * 100) / 100,
        employeeGrowthPercent: Math.round(employeeGrowth * 100) / 100,
      },
      trends: {
        topJurisdictions: topJurisdictions.map((j) => ({
          jurisdiction: `${j.state}/${j.county}`,
          caseCount: j._count,
          avgValueCents: Math.round(j._avg.surplusAmountCents || 0),
        })),
        casesBySource: sourceMap,
      },
    };

    // Save monthly metrics Excel
    await this.saveMonthlyMetricsExcel(metrics);

    // Create OpsInsight for monthly report
    await prisma.opsInsight.create({
      data: {
        source: "ReportingService",
        category: "MONTHLY_METRICS",
        severity: "LOW",
        title: `Monthly Metrics Report: ${metrics.month} ${metrics.year}`,
        description: `Revenue: $${(metrics.financials.totalRevenueCents / 100).toFixed(2)}, Cases: ${casesOpened} opened / ${casesClosed} closed`,
        plainEnglish: `Monthly report for ${metrics.month} ${metrics.year}. Total revenue: $${(metrics.financials.totalRevenueCents / 100).toFixed(2)}. Cases opened: ${casesOpened}, closed: ${casesClosed}. Revenue growth: ${metrics.growth.revenueGrowthPercent}%.`,
        data: metrics as any,
        status: "CLOSED",
      },
    });

    logger.info("Monthly metrics generated", { month: metrics.month, year: metrics.year });
    return metrics;
  }

  /**
   * Save monthly metrics as Excel file
   */
  private async saveMonthlyMetricsExcel(metrics: MonthlyMetrics): Promise<void> {
    await this.ensureReportDir();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MGR Capital Assistance";
    workbook.created = new Date();

    // Financials sheet
    const financialsSheet = workbook.addWorksheet("Financials");
    financialsSheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Amount", key: "amount", width: 20 },
    ];

    financialsSheet.addRows([
      { metric: "Total Revenue", amount: `$${(metrics.financials.totalRevenueCents / 100).toFixed(2)}` },
      { metric: "Total Payouts", amount: `$${(metrics.financials.totalPayoutsCents / 100).toFixed(2)}` },
      { metric: "Founder Share", amount: `$${(metrics.financials.founderShareCents / 100).toFixed(2)}` },
      { metric: "Employee Commissions", amount: `$${(metrics.financials.employeeCommissionsCents / 100).toFixed(2)}` },
    ]);

    financialsSheet.getRow(1).font = { bold: true };

    // Operations sheet
    const operationsSheet = workbook.addWorksheet("Operations");
    operationsSheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
    ];

    operationsSheet.addRows([
      { metric: "Cases Opened", value: metrics.operations.casesOpened },
      { metric: "Cases Closed", value: metrics.operations.casesClosed },
      { metric: "Success Rate", value: `${metrics.operations.successRate}%` },
    ]);

    operationsSheet.getRow(1).font = { bold: true };

    // Growth sheet
    const growthSheet = workbook.addWorksheet("Growth");
    growthSheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Change", key: "change", width: 20 },
    ];

    growthSheet.addRows([
      { metric: "Revenue Growth", change: `${metrics.growth.revenueGrowthPercent}%` },
      { metric: "Case Growth", change: `${metrics.growth.caseGrowthPercent}%` },
      { metric: "Employee Growth", change: `${metrics.growth.employeeGrowthPercent}%` },
    ]);

    growthSheet.getRow(1).font = { bold: true };

    // Top Jurisdictions sheet
    const jurisdictionsSheet = workbook.addWorksheet("Top Jurisdictions");
    jurisdictionsSheet.columns = [
      { header: "Jurisdiction", key: "jurisdiction", width: 25 },
      { header: "Case Count", key: "caseCount", width: 15 },
      { header: "Avg Value", key: "avgValue", width: 15 },
    ];

    jurisdictionsSheet.addRows(
      metrics.trends.topJurisdictions.map((j) => ({
        jurisdiction: j.jurisdiction,
        caseCount: j.caseCount,
        avgValue: `$${(j.avgValueCents / 100).toFixed(2)}`,
      }))
    );

    jurisdictionsSheet.getRow(1).font = { bold: true };

    // Save file
    const filename = `monthly_metrics_${metrics.year}_${metrics.month.toLowerCase()}.xlsx`;
    const filepath = path.join(this.reportDir, filename);
    await workbook.xlsx.writeFile(filepath);

    logger.debug("Monthly metrics Excel saved", { filepath });
  }

  // ---------------------------------------------------------------------------
  // DATA EXPORTS
  // ---------------------------------------------------------------------------

  /**
   * Export cases to CSV/Excel
   */
  async exportCases(config: ReportConfig): Promise<ExportResult> {
    try {
      await this.ensureReportDir();

      const cases = await prisma.case.findMany({
        where: {
          createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
        },
        include: {
          client: true,
          assignedEmployee: config.includeEmployeeMetrics
            ? { select: { name: true, email: true } }
            : undefined,
        },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Cases");

      // Define columns
      const columns: Partial<ExcelJS.Column>[] = [
        { header: "Internal Code", key: "internalCode", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "State", key: "state", width: 10 },
        { header: "County", key: "county", width: 15 },
        { header: "Property Address", key: "propertyAddress", width: 30 },
        { header: "Client Name", key: "clientName", width: 20 },
        { header: "Created At", key: "createdAt", width: 20 },
      ];

      if (config.includeFinancials) {
        columns.push(
          { header: "Surplus Amount", key: "surplusAmount", width: 15 },
          { header: "Recovery Amount", key: "recoveryAmount", width: 15 }
        );
      }

      if (config.includeEmployeeMetrics) {
        columns.push({ header: "Assigned Employee", key: "assignedEmployee", width: 20 });
      }

      sheet.columns = columns as ExcelJS.Column[];

      // Add rows
      for (const c of cases) {
        const row: Record<string, unknown> = {
          internalCode: c.internalCode,
          status: c.status,
          state: c.state,
          county: c.county,
          propertyAddress: c.propertyAddress,
          clientName: c.client?.name || "N/A",
          createdAt: c.createdAt.toISOString(),
        };

        if (config.includeFinancials) {
          row.surplusAmount = c.surplusAmountCents ? `$${(c.surplusAmountCents / 100).toFixed(2)}` : "N/A";
          row.recoveryAmount = c.recoveryAmountCents ? `$${(c.recoveryAmountCents / 100).toFixed(2)}` : "N/A";
        }

        if (config.includeEmployeeMetrics) {
          row.assignedEmployee = c.assignedEmployee?.name || "Unassigned";
        }

        sheet.addRow(row);
      }

      // Style header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Save file
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `cases_export_${dateStr}.${config.format}`;
      const filepath = path.join(this.reportDir, filename);

      if (config.format === "csv") {
        await workbook.csv.writeFile(filepath);
      } else {
        await workbook.xlsx.writeFile(filepath);
      }

      const stats = await fs.promises.stat(filepath);

      logger.info("Cases exported", { filename, rowCount: cases.length });

      return {
        success: true,
        filename,
        filepath,
        sizeBytes: stats.size,
        rowCount: cases.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Case export failed", { error: errorMessage });

      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Export financial ledger to CSV/Excel
   */
  async exportLedger(config: ReportConfig): Promise<ExportResult> {
    try {
      await this.ensureReportDir();

      const entries = await prisma.ledgerEntry.findMany({
        where: {
          createdAt: { gte: config.dateRange.from, lte: config.dateRange.to },
        },
        include: {
          case: { select: { internalCode: true } },
          user: { select: { name: true } },
        },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Ledger");

      sheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Type", key: "type", width: 20 },
        { header: "Status", key: "status", width: 12 },
        { header: "Case Code", key: "caseCode", width: 15 },
        { header: "User", key: "user", width: 20 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Created At", key: "createdAt", width: 20 },
        { header: "Completed At", key: "completedAt", width: 20 },
      ];

      for (const entry of entries) {
        sheet.addRow({
          id: entry.id,
          type: entry.type,
          status: entry.status,
          caseCode: entry.case?.internalCode || "N/A",
          user: entry.user?.name || "N/A",
          amount: `$${(entry.amountCents / 100).toFixed(2)}`,
          createdAt: entry.createdAt.toISOString(),
          completedAt: entry.completedAt?.toISOString() || "N/A",
        });
      }

      sheet.getRow(1).font = { bold: true };

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `ledger_export_${dateStr}.${config.format}`;
      const filepath = path.join(this.reportDir, filename);

      if (config.format === "csv") {
        await workbook.csv.writeFile(filepath);
      } else {
        await workbook.xlsx.writeFile(filepath);
      }

      const stats = await fs.promises.stat(filepath);

      logger.info("Ledger exported", { filename, rowCount: entries.length });

      return {
        success: true,
        filename,
        filepath,
        sizeBytes: stats.size,
        rowCount: entries.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Ledger export failed", { error: errorMessage });

      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Export employee performance to CSV/Excel
   */
  async exportEmployeeMetrics(config: ReportConfig): Promise<ExportResult> {
    try {
      await this.ensureReportDir();

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

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Employee Metrics");

      sheet.columns = [
        { header: "Name", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Tier", key: "tier", width: 15 },
        { header: "Total Cases", key: "totalCases", width: 12 },
        { header: "Paid Cases", key: "paidCases", width: 12 },
        { header: "Total Commissions", key: "commissions", width: 18 },
      ];

      for (const emp of employees) {
        const paidCases = emp.assignedCases.filter((c) => c.status === "PAID").length;
        const totalCommissions = emp.ledgerEntries.reduce((sum, e) => sum + e.amountCents, 0);

        sheet.addRow({
          name: emp.name,
          email: emp.email,
          tier: emp.employeeTier || "N/A",
          totalCases: emp.assignedCases.length,
          paidCases,
          commissions: `$${(totalCommissions / 100).toFixed(2)}`,
        });
      }

      sheet.getRow(1).font = { bold: true };

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `employee_metrics_${dateStr}.${config.format}`;
      const filepath = path.join(this.reportDir, filename);

      if (config.format === "csv") {
        await workbook.csv.writeFile(filepath);
      } else {
        await workbook.xlsx.writeFile(filepath);
      }

      const stats = await fs.promises.stat(filepath);

      logger.info("Employee metrics exported", { filename, rowCount: employees.length });

      return {
        success: true,
        filename,
        filepath,
        sizeBytes: stats.size,
        rowCount: employees.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Employee metrics export failed", { error: errorMessage });

      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(dateRange: { from: Date; to: Date }): Promise<ExportResult> {
    try {
      await this.ensureReportDir();

      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
        },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Audit Logs");

      sheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Action", key: "action", width: 25 },
        { header: "Entity Type", key: "entityType", width: 15 },
        { header: "Entity ID", key: "entityId", width: 15 },
        { header: "User", key: "user", width: 25 },
        { header: "IP Address", key: "ipAddress", width: 15 },
        { header: "Created At", key: "createdAt", width: 25 },
      ];

      for (const log of logs) {
        sheet.addRow({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          user: log.user ? `${log.user.name} (${log.user.email})` : "System",
          ipAddress: log.ipAddress || "N/A",
          createdAt: log.createdAt.toISOString(),
        });
      }

      sheet.getRow(1).font = { bold: true };

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `audit_logs_${dateStr}.xlsx`;
      const filepath = path.join(this.reportDir, filename);

      await workbook.xlsx.writeFile(filepath);

      const stats = await fs.promises.stat(filepath);

      logger.info("Audit logs exported", { filename, rowCount: logs.length });

      return {
        success: true,
        filename,
        filepath,
        sizeBytes: stats.size,
        rowCount: logs.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Audit log export failed", { error: errorMessage });

      return {
        success: false,
        filename: "",
        filepath: "",
        sizeBytes: 0,
        rowCount: 0,
        error: errorMessage,
      };
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const reportingService = new ReportingService();

export default reportingService;
