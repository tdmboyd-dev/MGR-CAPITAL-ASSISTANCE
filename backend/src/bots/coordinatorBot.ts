// ============================================
// COORDINATOR BOT — MGR CAPITAL ASSISTANCE
// The Plain-English Ops Brain
// Reads all metrics, alerts, and insights
// Produces human-readable summaries for the Founder
// ============================================

import { PrismaClient, OpsInsightType, OpsInsightPriority, WatchAlertSeverity } from "@prisma/client";
import { ingestionBot } from "./ingestionBot.js";
import { payoutBot } from "./payoutBot.js";
import { complianceBot } from "./complianceBot.js";
import { trainingBot } from "./trainingBot.js";
import { outreachBot } from "./outreachBot.js";
import { docketBot } from "./docketBot.js";

const prisma = new PrismaClient();

const BOT_NAME = "coordinatorBot";

interface ExecutiveSummary {
  generatedAt: Date;
  period: string;
  overallHealth: "excellent" | "good" | "attention" | "critical";
  headline: string;
  keyMetrics: KeyMetric[];
  topPriorities: Priority[];
  alerts: AlertSummary;
  recentInsights: InsightSummary[];
  plainEnglishReport: string;
  recommendations: string[];
}

interface KeyMetric {
  name: string;
  value: string;
  trend: "up" | "down" | "stable";
  status: "good" | "warning" | "critical";
}

interface Priority {
  rank: number;
  title: string;
  description: string;
  category: string;
  urgency: "now" | "today" | "this_week";
  actionUrl?: string;
}

interface AlertSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  unresolvedOldest?: Date;
}

interface InsightSummary {
  type: string;
  title: string;
  summary: string;
  priority: string;
  generatedAt: Date;
}

class CoordinatorBot {
  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================

  /**
   * Generate a comprehensive executive summary
   */
  async generateExecutiveSummary(period: "daily" | "weekly" = "daily"): Promise<ExecutiveSummary> {
    const days = period === "daily" ? 1 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Gather all data in parallel
    const [
      caseMetrics,
      alertSummary,
      recentInsights,
      systemErrors,
      employeeStats,
      ingestionStats,
    ] = await Promise.all([
      this.getCaseMetrics(startDate),
      this.getAlertSummary(),
      this.getRecentInsights(startDate),
      this.getSystemErrors(startDate),
      this.getEmployeeStats(),
      this.getIngestionStats(startDate),
    ]);

    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(
      alertSummary,
      systemErrors.count,
      caseMetrics.staleCases
    );

    // Generate key metrics
    const keyMetrics = this.generateKeyMetrics(
      caseMetrics,
      ingestionStats,
      employeeStats
    );

    // Identify top priorities
    const topPriorities = await this.identifyTopPriorities(
      alertSummary,
      caseMetrics,
      recentInsights
    );

    // Generate plain English report
    const plainEnglishReport = this.generatePlainEnglishReport(
      overallHealth,
      keyMetrics,
      topPriorities,
      alertSummary,
      period
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      overallHealth,
      topPriorities,
      alertSummary
    );

    // Generate headline
    const headline = this.generateHeadline(overallHealth, topPriorities, period);

    const summary: ExecutiveSummary = {
      generatedAt: new Date(),
      period: period === "daily" ? "Last 24 hours" : "Last 7 days",
      overallHealth,
      headline,
      keyMetrics,
      topPriorities,
      alerts: alertSummary,
      recentInsights: recentInsights.map((i) => ({
        type: i.type ?? "",
        title: i.title ?? "",
        summary: i.summary ?? "",
        priority: i.priority,
        generatedAt: i.generatedAt,
      })),
      plainEnglishReport,
      recommendations,
    };

    // Save as insight
    await this.saveInsight(summary);

    return summary;
  }

  // ============================================
  // DATA GATHERING
  // ============================================

  private async getCaseMetrics(startDate: Date) {
    const [
      totalCases,
      activeCases,
      newCases,
      closedCases,
      paidCases,
      staleCases,
    ] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({
        where: { status: { notIn: ["PAID", "CLOSED", "REJECTED"] } },
      }),
      prisma.case.count({ where: { createdAt: { gte: startDate } } }),
      prisma.case.count({
        where: { closedAt: { gte: startDate } },
      }),
      prisma.case.count({
        where: { paidAt: { gte: startDate } },
      }),
      prisma.case.count({
        where: {
          status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
          updatedAt: {
            lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days stale
          },
        },
      }),
    ]);

    // Get total value
    const valueData = await prisma.case.aggregate({
      where: { status: { notIn: ["REJECTED"] } },
      _sum: { surplusAmountCents: true },
    });

    return {
      totalCases,
      activeCases,
      newCases,
      closedCases,
      paidCases,
      staleCases,
      totalValueCents: valueData._sum.surplusAmountCents || 0,
    };
  }

  private async getAlertSummary(): Promise<AlertSummary> {
    const [bySeverity, oldest] = await Promise.all([
      prisma.watchAlert.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: true,
      }),
      prisma.watchAlert.findFirst({
        where: { isResolved: false },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const item of bySeverity) {
      const severity = item.severity.toLowerCase() as keyof typeof counts;
      if (severity in counts) {
        counts[severity] = item._count;
      }
    }

    return {
      ...counts,
      total: counts.critical + counts.high + counts.medium + counts.low,
      unresolvedOldest: oldest?.createdAt,
    };
  }

  private async getRecentInsights(startDate: Date) {
    return prisma.opsInsight.findMany({
      where: {
        createdAt: { gte: startDate },
        isStale: false,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
    });
  }

  private async getSystemErrors(startDate: Date) {
    const [count, criticalCount] = await Promise.all([
      prisma.systemError.count({
        where: { createdAt: { gte: startDate }, isResolved: false },
      }),
      prisma.systemError.count({
        where: {
          createdAt: { gte: startDate },
          severity: "CRITICAL",
          isResolved: false,
        },
      }),
    ]);

    return { count, criticalCount };
  }

  private async getEmployeeStats() {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      include: {
        assignedCases: {
          where: { status: { notIn: ["PAID", "CLOSED", "REJECTED"] } },
        },
      },
    });

    const activeEmployees = employees.filter(
      (e) => e.assignedCases.length > 0
    ).length;
    const avgCasesPerEmployee =
      employees.length > 0
        ? Math.round(
            employees.reduce((sum, e) => sum + e.assignedCases.length, 0) /
              employees.length
          )
        : 0;

    return {
      totalEmployees: employees.length,
      activeEmployees,
      avgCasesPerEmployee,
    };
  }

  private async getIngestionStats(startDate: Date) {
    const batches = await prisma.ingestionBatch.findMany({
      where: { createdAt: { gte: startDate } },
    });

    const totalRecords = batches.reduce((sum, b) => sum + b.totalRecords, 0);
    const createdCases = batches.reduce((sum, b) => sum + b.createdCases, 0);
    const errorRate =
      totalRecords > 0
        ? ((totalRecords - createdCases) / totalRecords) * 100
        : 0;

    return {
      batchCount: batches.length,
      totalRecords,
      createdCases,
      errorRate: Math.round(errorRate),
    };
  }

  // ============================================
  // ANALYSIS
  // ============================================

  private calculateOverallHealth(
    alerts: AlertSummary,
    systemErrors: number,
    staleCases: number
  ): ExecutiveSummary["overallHealth"] {
    if (alerts.critical > 0 || systemErrors > 5) {
      return "critical";
    }

    if (alerts.high > 2 || staleCases > 10 || systemErrors > 2) {
      return "attention";
    }

    if (alerts.high > 0 || alerts.medium > 5 || staleCases > 5) {
      return "good";
    }

    return "excellent";
  }

  private generateKeyMetrics(
    caseMetrics: any,
    ingestionStats: any,
    employeeStats: any
  ): KeyMetric[] {
    const metrics: KeyMetric[] = [];

    // Active cases
    metrics.push({
      name: "Active Cases",
      value: caseMetrics.activeCases.toString(),
      trend: caseMetrics.newCases > caseMetrics.closedCases ? "up" : "stable",
      status: "good",
    });

    // New cases
    metrics.push({
      name: "New Cases (Period)",
      value: caseMetrics.newCases.toString(),
      trend: "stable",
      status: caseMetrics.newCases > 0 ? "good" : "warning",
    });

    // Paid cases
    metrics.push({
      name: "Paid Cases (Period)",
      value: caseMetrics.paidCases.toString(),
      trend: "stable",
      status: caseMetrics.paidCases > 0 ? "good" : "warning",
    });

    // Stale cases
    metrics.push({
      name: "Stale Cases",
      value: caseMetrics.staleCases.toString(),
      trend: "stable",
      status:
        caseMetrics.staleCases === 0
          ? "good"
          : caseMetrics.staleCases > 10
          ? "critical"
          : "warning",
    });

    // Ingestion error rate
    metrics.push({
      name: "Ingestion Error Rate",
      value: `${ingestionStats.errorRate}%`,
      trend: "stable",
      status:
        ingestionStats.errorRate < 10
          ? "good"
          : ingestionStats.errorRate < 30
          ? "warning"
          : "critical",
    });

    // Active employees
    metrics.push({
      name: "Active Employees",
      value: employeeStats.activeEmployees.toString(),
      trend: "stable",
      status: "good",
    });

    return metrics;
  }

  private async identifyTopPriorities(
    alerts: AlertSummary,
    caseMetrics: any,
    insights: any[]
  ): Promise<Priority[]> {
    const priorities: Priority[] = [];
    let rank = 1;

    // Critical alerts
    if (alerts.critical > 0) {
      priorities.push({
        rank: rank++,
        title: `${alerts.critical} Critical Alert${alerts.critical > 1 ? "s" : ""}`,
        description: "Immediate attention required for critical system alerts",
        category: "alerts",
        urgency: "now",
        actionUrl: "/admin/ops?tab=alerts",
      });
    }

    // High priority alerts
    if (alerts.high > 0) {
      priorities.push({
        rank: rank++,
        title: `${alerts.high} High-Priority Alert${alerts.high > 1 ? "s" : ""}`,
        description: "High-priority issues requiring review today",
        category: "alerts",
        urgency: "today",
        actionUrl: "/admin/ops?tab=alerts",
      });
    }

    // Stale cases
    if (caseMetrics.staleCases > 0) {
      priorities.push({
        rank: rank++,
        title: `${caseMetrics.staleCases} Stale Case${caseMetrics.staleCases > 1 ? "s" : ""}`,
        description: "Cases stuck without progress for over 14 days",
        category: "cases",
        urgency: "today",
        actionUrl: "/admin/cases?filter=stale",
      });
    }

    // Urgent insights
    const urgentInsights = insights.filter((i) => i.priority === "URGENT");
    for (const insight of urgentInsights.slice(0, 2)) {
      priorities.push({
        rank: rank++,
        title: insight.title,
        description: insight.summary,
        category: insight.type.toLowerCase(),
        urgency: "today",
      });
    }

    // Old unresolved alerts
    if (alerts.unresolvedOldest) {
      const daysOld = Math.ceil(
        (Date.now() - alerts.unresolvedOldest.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOld > 7) {
        priorities.push({
          rank: rank++,
          title: "Aging Unresolved Alerts",
          description: `Oldest unresolved alert is ${daysOld} days old`,
          category: "alerts",
          urgency: "this_week",
        });
      }
    }

    return priorities.slice(0, 5); // Top 5 priorities
  }

  // ============================================
  // PLAIN ENGLISH GENERATION
  // ============================================

  private generatePlainEnglishReport(
    health: ExecutiveSummary["overallHealth"],
    metrics: KeyMetric[],
    priorities: Priority[],
    alerts: AlertSummary,
    period: string
  ): string {
    const sections: string[] = [];

    // Opening
    const healthDescriptions = {
      excellent: "Everything is running smoothly.",
      good: "Operations are healthy with a few items to watch.",
      attention: "There are some issues that need your attention.",
      critical: "Immediate attention required on critical issues.",
    };
    sections.push(`**${period === "daily" ? "Daily" : "Weekly"} Operations Summary**\n`);
    sections.push(`Overall Status: **${health.toUpperCase()}**\n${healthDescriptions[health]}\n`);

    // Key numbers
    sections.push("\n**Key Numbers:**");
    for (const metric of metrics) {
      const statusIcon =
        metric.status === "good" ? "✓" : metric.status === "warning" ? "!" : "✗";
      sections.push(`- ${metric.name}: ${metric.value} ${statusIcon}`);
    }

    // Priorities
    if (priorities.length > 0) {
      sections.push("\n**Your Top Priorities:**");
      for (const priority of priorities) {
        const urgencyLabel =
          priority.urgency === "now"
            ? "[NOW]"
            : priority.urgency === "today"
            ? "[TODAY]"
            : "[THIS WEEK]";
        sections.push(`${priority.rank}. ${urgencyLabel} ${priority.title}`);
        sections.push(`   → ${priority.description}`);
      }
    } else {
      sections.push("\n**No immediate priorities.** Great job keeping things running smoothly!");
    }

    // Alerts summary
    if (alerts.total > 0) {
      sections.push(`\n**Alerts:** ${alerts.total} unresolved`);
      if (alerts.critical > 0) sections.push(`- ${alerts.critical} CRITICAL`);
      if (alerts.high > 0) sections.push(`- ${alerts.high} High`);
      if (alerts.medium > 0) sections.push(`- ${alerts.medium} Medium`);
      if (alerts.low > 0) sections.push(`- ${alerts.low} Low`);
    } else {
      sections.push("\n**Alerts:** All clear - no unresolved alerts.");
    }

    return sections.join("\n");
  }

  private generateHeadline(
    health: ExecutiveSummary["overallHealth"],
    priorities: Priority[],
    period: string
  ): string {
    if (health === "critical") {
      return "Critical: Immediate action required on system issues";
    }

    if (health === "attention" && priorities.length > 0) {
      return `${priorities.length} items need your attention`;
    }

    if (health === "good") {
      return "Operations healthy, minor items to review";
    }

    return "All systems running smoothly";
  }

  private generateRecommendations(
    health: ExecutiveSummary["overallHealth"],
    priorities: Priority[],
    alerts: AlertSummary
  ): string[] {
    const recommendations: string[] = [];

    if (health === "critical") {
      recommendations.push("URGENT: Address critical alerts immediately");
    }

    for (const priority of priorities.slice(0, 3)) {
      if (priority.urgency === "now") {
        recommendations.push(`Handle now: ${priority.title}`);
      } else if (priority.urgency === "today") {
        recommendations.push(`Review today: ${priority.title}`);
      }
    }

    if (alerts.total > 10) {
      recommendations.push("Consider bulk-resolving older low-priority alerts");
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring - no immediate actions needed");
    }

    return recommendations;
  }

  // ============================================
  // BOT ORCHESTRATION
  // ============================================

  /**
   * Run all bots and generate comprehensive report
   */
  async runFullOpsCycle(): Promise<{
    executiveSummary: ExecutiveSummary;
    botResults: {
      ingestion: any;
      payout: any;
      compliance: any;
      training: any;
      outreach: any;
      docket: any;
    };
  }> {
    console.log("[CoordinatorBot] Starting full ops cycle...");

    // Run all bots in parallel
    const [ingestion, payout, compliance, training, outreach, docket] = await Promise.all([
      ingestionBot.analyze().catch((e) => ({ error: e.message })),
      payoutBot.analyze().catch((e) => ({ error: e.message })),
      complianceBot.scan().catch((e) => ({ error: e.message })),
      trainingBot.analyze().catch((e) => ({ error: e.message })),
      outreachBot.analyze().catch((e) => ({ error: e.message })),
      docketBot.analyze().catch((e) => ({ error: e.message })),
    ]);

    console.log("[CoordinatorBot] All bots completed. Generating summary...");

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary("daily");

    console.log("[CoordinatorBot] Ops cycle complete.");

    return {
      executiveSummary,
      botResults: {
        ingestion,
        payout,
        compliance,
        training,
        outreach,
        docket,
      },
    };
  }

  /**
   * Get the latest insights in plain English
   */
  async getLatestBriefing(): Promise<string> {
    const latestSummary = await prisma.opsInsight.findFirst({
      where: {
        type: "COORDINATOR_SUMMARY",
        isStale: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestSummary?.plainEnglish) {
      return latestSummary.plainEnglish;
    }

    // Generate fresh if none exists
    const summary = await this.generateExecutiveSummary("daily");
    return summary.plainEnglishReport;
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(summary: ExecutiveSummary): Promise<void> {
    const priority =
      summary.overallHealth === "critical"
        ? "URGENT"
        : summary.overallHealth === "attention"
        ? "HIGH"
        : summary.overallHealth === "good"
        ? "NORMAL"
        : "LOW";

    // Mark old summaries as stale
    await prisma.opsInsight.updateMany({
      where: {
        type: "COORDINATOR_SUMMARY",
        isStale: false,
      },
      data: { isStale: true },
    });

    await prisma.opsInsight.create({
      data: {
        type: "COORDINATOR_SUMMARY" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: `${summary.period} Executive Summary`,
        summary: summary.headline,
        details: summary as any,
        plainEnglish: summary.plainEnglishReport,
        recommendations: summary.recommendations,
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    });
  }
}

export const coordinatorBot = new CoordinatorBot();
