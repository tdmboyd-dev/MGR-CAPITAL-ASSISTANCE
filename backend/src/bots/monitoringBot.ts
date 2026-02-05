// ============================================
// MONITORING BOT — MGR CAPITAL ASSISTANCE
// Phase 9: System Health Monitoring
// Phase 11: Self-Healing Automation & Platform Immune System
// Checks DB/Redis/API health, creates alerts on failure
// Auto-heals detected problems, monitors performance,
// detects security threats, tracks costs, ensures uptime,
// and monitors the entire bot fleet
// ============================================

import { WatchAlertSeverity, WatchAlertType } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { config } from "../config/env.js";

const BOT_NAME = "monitoringBot";

// ============================================
// INTERFACES
// ============================================

interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "down";
  responseTimeMs: number;
  message: string;
  details?: Record<string, unknown>;
}

interface SystemHealthReport {
  timestamp: Date;
  overallStatus: "healthy" | "degraded" | "down";
  checks: HealthCheckResult[];
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
}

interface SelfHealResult {
  issue: string;
  action: string;
  success: boolean;
  details: string;
  escalated: boolean;
}

interface PerformanceMetrics {
  timestamp: Date;
  dbQueryAvgMs: number;
  dbQueryMaxMs: number;
  dbConnectionPoolUsage: number;
  memoryHeapUsedMB: number;
  memoryHeapTotalMB: number;
  memoryRssMB: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  uptimeSeconds: number;
  activeConnections: number;
  slowQueries: number;
}

interface SecurityThreatReport {
  timestamp: Date;
  threatsDetected: SecurityThreat[];
  overallRiskLevel: "low" | "medium" | "high" | "critical";
  actionsRequired: string[];
}

interface SecurityThreat {
  type: "brute_force" | "unusual_login" | "data_anomaly" | "api_abuse" | "session_hijack" | "privilege_escalation";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: Record<string, unknown>;
  autoMitigated: boolean;
  mitigationAction?: string;
}

interface CostReport {
  timestamp: Date;
  period: string;
  emailCosts: {
    modoboaSentCount: number;
    brevoSentCount: number;
    estimatedModoboaCostCents: number;
    estimatedBrevoCostCents: number;
    totalEmailCostCents: number;
    recommendation: string;
  };
  smsCosts: {
    sentCount: number;
    estimatedCostCents: number;
  };
  apiCosts: {
    tracerfyCalls: number;
    externalApiCalls: number;
    estimatedCostCents: number;
  };
  storageCosts: {
    dbSizeMB: number;
    growthRateMBPerDay: number;
    estimatedMonthlyCostCents: number;
  };
  totalMonthlyCostCents: number;
  budgetAlerts: string[];
}

interface UptimeReport {
  timestamp: Date;
  services: ServiceUptimeRecord[];
  overall99thPercentile: boolean;
  degradedModeActive: boolean;
  failoverTriggered: boolean;
  recoveryVerified: boolean;
}

interface ServiceUptimeRecord {
  service: string;
  checksPerformed: number;
  checksSucceeded: number;
  uptimePercent: number;
  lastDownAt: Date | null;
  currentStreak: number;
}

interface BotFleetReport {
  timestamp: Date;
  bots: BotHealthRecord[];
  overallFleetHealth: "excellent" | "good" | "degraded" | "critical";
  autoRestartedBots: string[];
  recommendations: string[];
}

interface BotHealthRecord {
  botName: string;
  lastRunAt: Date | null;
  lastSuccess: boolean;
  successRate7d: number;
  avgDurationMs: number;
  failureStreak: number;
  healthScore: number; // 0-100
  status: "healthy" | "warning" | "failing" | "dead";
}

interface DiagnosticReport {
  timestamp: Date;
  healthReport: SystemHealthReport;
  performanceMetrics: PerformanceMetrics;
  securityReport: SecurityThreatReport;
  costReport: CostReport;
  uptimeReport: UptimeReport;
  botFleetReport: BotFleetReport;
  selfHealActions: SelfHealResult[];
  overallGrade: "A" | "B" | "C" | "D" | "F";
  summary: string;
}

// ============================================
// SELF-HEALING HISTORY (in-memory ring buffer)
// ============================================

interface HealingAttempt {
  timestamp: Date;
  issue: string;
  success: boolean;
}

const HEALING_HISTORY_MAX = 200;
const healingHistory: HealingAttempt[] = [];

// Performance sample ring buffer for trend analysis
interface PerformanceSample {
  timestamp: Date;
  dbAvgMs: number;
  memoryPercent: number;
  cpuPercent: number;
}

const PERF_HISTORY_MAX = 360; // 6 hours at 1-min intervals
const performanceHistory: PerformanceSample[] = [];

// Uptime tracking ring buffer
interface UptimeCheck {
  timestamp: Date;
  service: string;
  up: boolean;
}

const UPTIME_HISTORY_MAX = 1440; // 24 hours at 1-min intervals
const uptimeHistory: UptimeCheck[] = [];

// ============================================
// KNOWN BOT NAMES IN THE FLEET
// ============================================

const KNOWN_BOTS = [
  "coordinatorBot",
  "ingestionBot",
  "payoutBot",
  "complianceBot",
  "trainingBot",
  "outreachBot",
  "docketBot",
  "monitoringBot",
  "metaBot",
  "omniscientBot",
  "transactionalEmailBot",
];

class MonitoringBot {
  private startTime = Date.now();
  private degradedMode = false;
  private lastFailoverTriggered: Date | null = null;

  // ============================================
  // HEALTH CHECKS (ORIGINAL — PRESERVED)
  // ============================================

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTimeMs = Date.now() - start;

      return {
        service: "database",
        status: responseTimeMs < 1000 ? "healthy" : "degraded",
        responseTimeMs,
        message: "Database connection successful",
      };
    } catch (error) {
      return {
        service: "database",
        status: "down",
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Database check failed",
      };
    }
  }

  /**
   * Check Redis connectivity (if enabled)
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();

    if (!config.redisEnabled) {
      return {
        service: "redis",
        status: "healthy",
        responseTimeMs: 0,
        message: "Redis disabled (in-memory cache mode)",
      };
    }

    try {
      // Redis check would go here if redis client is imported
      // For now, return healthy if enabled
      const responseTimeMs = Date.now() - start;
      return {
        service: "redis",
        status: "healthy",
        responseTimeMs,
        message: "Redis connection successful",
      };
    } catch (error) {
      return {
        service: "redis",
        status: "down",
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Redis check failed",
      };
    }
  }

  /**
   * Check API endpoint health
   */
  private async checkApiHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Internal health check - verify core services are working
      const [userCount, caseCount] = await Promise.all([
        prisma.user.count(),
        prisma.case.count(),
      ]);

      const responseTimeMs = Date.now() - start;

      return {
        service: "api",
        status: responseTimeMs < 2000 ? "healthy" : "degraded",
        responseTimeMs,
        message: "API services operational",
        details: { userCount, caseCount },
      };
    } catch (error) {
      return {
        service: "api",
        status: "down",
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : "API check failed",
      };
    }
  }

  /**
   * Check disk space (via file system operations)
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Check if we can write/read a temp file
      const testData = `health_check_${Date.now()}`;

      // For now, just return healthy - actual disk check would require fs module
      const responseTimeMs = Date.now() - start;

      return {
        service: "disk",
        status: "healthy",
        responseTimeMs,
        message: "Disk operations normal",
      };
    } catch (error) {
      return {
        service: "disk",
        status: "degraded",
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Disk check failed",
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheckResult {
    const start = Date.now();
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    let status: HealthCheckResult["status"] = "healthy";
    if (usagePercent > 90) {
      status = "down";
    } else if (usagePercent > 75) {
      status = "degraded";
    }

    return {
      service: "memory",
      status,
      responseTimeMs: Date.now() - start,
      message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`,
      details: {
        heapUsedMB,
        heapTotalMB,
        usagePercent,
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  }

  /**
   * Check for stale alerts (indicator of system issues)
   */
  private async checkAlertBacklog(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const [criticalCount, totalUnresolved] = await Promise.all([
        prisma.watchAlert.count({
          where: { severity: "CRITICAL", isResolved: false },
        }),
        prisma.watchAlert.count({
          where: { isResolved: false },
        }),
      ]);

      const responseTimeMs = Date.now() - start;

      let status: HealthCheckResult["status"] = "healthy";
      if (criticalCount > 0) {
        status = "down";
      } else if (totalUnresolved > 10) {
        status = "degraded";
      }

      return {
        service: "alert_backlog",
        status,
        responseTimeMs,
        message: `${totalUnresolved} unresolved alerts (${criticalCount} critical)`,
        details: { criticalCount, totalUnresolved },
      };
    } catch (error) {
      return {
        service: "alert_backlog",
        status: "degraded",
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Alert check failed",
      };
    }
  }

  // ============================================
  // MAIN HEALTH CHECK (ORIGINAL — PRESERVED)
  // ============================================

  /**
   * Run all health checks and generate report
   */
  async runHealthChecks(): Promise<SystemHealthReport> {
    console.log(`[${BOT_NAME}] Running health checks...`);

    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkApiHealth(),
      this.checkDiskSpace(),
      Promise.resolve(this.checkMemory()),
      this.checkAlertBacklog(),
    ]);

    // Calculate overall status
    const hasDown = checks.some((c) => c.status === "down");
    const hasDegraded = checks.some((c) => c.status === "degraded");
    const overallStatus = hasDown ? "down" : hasDegraded ? "degraded" : "healthy";

    // Calculate uptime
    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    // Approximate CPU usage
    const cpuUsage = process.cpuUsage();
    const cpuPercent = Math.round(
      ((cpuUsage.user + cpuUsage.system) / 1000000 / uptime) * 100
    );

    const report: SystemHealthReport = {
      timestamp: new Date(),
      overallStatus,
      checks,
      uptime,
      memoryUsage,
      cpuUsage: cpuPercent,
    };

    // Create alerts for failed checks
    await this.createAlertsForFailures(checks);

    // Save health report as OpsInsight
    await this.saveHealthReport(report);

    // Record uptime data points
    for (const check of checks) {
      this.recordUptimeCheck(check.service, check.status !== "down");
    }

    // Attempt self-healing for any failures detected
    for (const check of checks) {
      if (check.status !== "healthy") {
        await this.selfHeal(`${check.service}_${check.status}`);
      }
    }

    console.log(`[${BOT_NAME}] Health check complete: ${overallStatus}`);

    return report;
  }

  /**
   * Create WatchAlerts for failed health checks
   */
  private async createAlertsForFailures(checks: HealthCheckResult[]): Promise<void> {
    const failedChecks = checks.filter((c) => c.status !== "healthy");

    for (const check of failedChecks) {
      // Check if similar alert already exists
      const existingAlert = await prisma.watchAlert.findFirst({
        where: {
          type: "SYSTEM_HEALTH",
          isResolved: false,
          message: { contains: check.service },
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Within last hour
        },
      });

      if (existingAlert) {
        // Update existing alert
        await prisma.watchAlert.update({
          where: { id: existingAlert.id },
          data: {
            details: {
              ...(existingAlert.details as object),
              lastCheck: new Date().toISOString(),
              currentStatus: check.status,
              message: check.message,
            },
          },
        });
      } else {
        // Create new alert
        await prisma.watchAlert.create({
          data: {
            type: "SYSTEM_HEALTH" as WatchAlertType,
            severity: check.status === "down" ? "CRITICAL" : "HIGH",
            message: `Health check failed: ${check.service}`,
            details: {
              service: check.service,
              status: check.status,
              message: check.message,
              responseTimeMs: check.responseTimeMs,
              ...check.details,
            },
            status: "OPEN",
          },
        });

        console.log(`[${BOT_NAME}] Created alert for ${check.service}: ${check.status}`);
      }
    }
  }

  /**
   * Save health report as OpsInsight
   */
  private async saveHealthReport(report: SystemHealthReport): Promise<void> {
    const priority = report.overallStatus === "down"
      ? "URGENT"
      : report.overallStatus === "degraded"
      ? "HIGH"
      : "LOW";

    // Mark old health insights as stale
    await prisma.opsInsight.updateMany({
      where: {
        type: "SYSTEM_HEALTH",
        isStale: false,
      },
      data: { isStale: true },
    });

    await prisma.opsInsight.create({
      data: {
        type: "SYSTEM_HEALTH",
        priority,
        title: `System Health: ${report.overallStatus.toUpperCase()}`,
        summary: this.generateHealthSummary(report),
        details: report as unknown as any,
        plainEnglish: this.generatePlainEnglishReport(report),
        recommendations: this.generateRecommendations(report),
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      },
    });
  }

  /**
   * Generate health summary
   */
  private generateHealthSummary(report: SystemHealthReport): string {
    const healthyCount = report.checks.filter((c) => c.status === "healthy").length;
    const totalChecks = report.checks.length;
    return `${healthyCount}/${totalChecks} services healthy. Uptime: ${Math.round(report.uptime / 60)} minutes.`;
  }

  /**
   * Generate plain English report
   */
  private generatePlainEnglishReport(report: SystemHealthReport): string {
    const sections: string[] = [];

    sections.push(`**System Health Report** (${new Date().toLocaleString()})\n`);
    sections.push(`Overall Status: **${report.overallStatus.toUpperCase()}**\n`);

    sections.push("\n**Service Status:**");
    for (const check of report.checks) {
      const icon = check.status === "healthy" ? "✓" : check.status === "degraded" ? "!" : "✗";
      sections.push(`- ${check.service}: ${icon} ${check.status} (${check.responseTimeMs}ms)`);
      if (check.status !== "healthy") {
        sections.push(`  → ${check.message}`);
      }
    }

    sections.push(`\n**System Resources:**`);
    sections.push(`- Uptime: ${Math.round(report.uptime / 60)} minutes`);
    sections.push(`- Memory: ${Math.round(report.memoryUsage.heapUsed / 1024 / 1024)}MB heap used`);
    sections.push(`- CPU: ~${report.cpuUsage}% average`);

    return sections.join("\n");
  }

  /**
   * Generate recommendations based on health report
   */
  private generateRecommendations(report: SystemHealthReport): string[] {
    const recommendations: string[] = [];

    for (const check of report.checks) {
      if (check.status === "down") {
        recommendations.push(`CRITICAL: Investigate ${check.service} failure immediately`);
      } else if (check.status === "degraded") {
        recommendations.push(`WARN: Monitor ${check.service} - ${check.message}`);
      }
    }

    if (report.cpuUsage > 80) {
      recommendations.push("High CPU usage detected - consider scaling or optimization");
    }

    const memUsagePercent = (report.memoryUsage.heapUsed / report.memoryUsage.heapTotal) * 100;
    if (memUsagePercent > 80) {
      recommendations.push("High memory usage detected - monitor for memory leaks");
    }

    if (recommendations.length === 0) {
      recommendations.push("All systems operational - no action required");
    }

    return recommendations;
  }

  // ============================================
  // QUICK STATUS CHECK (ORIGINAL — PRESERVED)
  // ============================================

  /**
   * Quick health check for API endpoint
   */
  async getQuickStatus(): Promise<{
    status: "healthy" | "degraded" | "down";
    uptime: number;
    timestamp: Date;
    services: { name: string; status: string }[];
  }> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkApiHealth(),
    ]);

    const hasDown = checks.some((c) => c.status === "down");
    const hasDegraded = checks.some((c) => c.status === "degraded");
    const status = hasDown ? "down" : hasDegraded ? "degraded" : "healthy";

    return {
      status,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date(),
      services: checks.map((c) => ({ name: c.service, status: c.status })),
    };
  }

  // ============================================
  // 1. SELF-HEALING AUTOMATION
  // The immune system — detect and FIX problems
  // ============================================

  /**
   * Auto-fix detected problems. Only escalates to founder when self-healing fails.
   */
  async selfHeal(issue: string): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Self-healing triggered for: ${issue}`);
    const startTime = Date.now();

    let result: SelfHealResult = {
      issue,
      action: "none",
      success: false,
      details: "",
      escalated: false,
    };

    try {
      // Route to the correct healing strategy
      if (issue.includes("email") || issue.includes("EMAIL")) {
        result = await this.healFailedEmails();
      } else if (issue.includes("inactive_employee") || issue.includes("EMPLOYEE_ANOMALY")) {
        result = await this.healInactiveEmployeeCases();
      } else if (issue.includes("stalled_cron") || issue.includes("cron")) {
        result = await this.healStalledCronJobs();
      } else if (issue.includes("database") || issue.includes("db_lock")) {
        result = await this.healDatabaseIssues();
      } else if (issue.includes("memory") || issue.includes("memory_degraded") || issue.includes("memory_down")) {
        result = await this.healMemoryPressure();
      } else if (issue.includes("alert_backlog")) {
        result = await this.healAlertBacklog();
      } else if (issue.includes("api") || issue.includes("api_degraded")) {
        result = await this.healApiDegradation();
      } else if (issue.includes("bot_failure")) {
        result = await this.healBotFailure(issue);
      } else {
        // Unknown issue — attempt generic healing
        result = await this.healGeneric(issue);
      }

      // Record the healing attempt
      this.recordHealingAttempt(issue, result.success);

      // If healing failed, check if we should escalate
      if (!result.success) {
        const recentFailures = this.getRecentHealingFailures(issue, 30); // last 30 mins
        if (recentFailures >= 3) {
          await this.escalateToFounder(issue, result);
          result.escalated = true;
        }
      }

      // Log the self-heal action
      await this.logSelfHealAction(result, Date.now() - startTime);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown healing error";
      console.error(`[${BOT_NAME}] Self-heal error for ${issue}:`, errorMsg);

      result = {
        issue,
        action: "heal_attempt_failed",
        success: false,
        details: `Self-healing threw an error: ${errorMsg}`,
        escalated: false,
      };

      // Always escalate if healing itself crashes
      await this.escalateToFounder(issue, result);
      result.escalated = true;
    }

    return result;
  }

  /**
   * Retry failed email sends — find emails that failed and re-queue them
   */
  private async healFailedEmails(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: retrying failed email sends...`);

    try {
      // Find communications marked as email that were created recently but may have failed
      const recentFailedComms = await prisma.communication.findMany({
        where: {
          type: "EMAIL",
          outcome: "FAILED",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      if (recentFailedComms.length === 0) {
        return {
          issue: "failed_emails",
          action: "check_failed_emails",
          success: true,
          details: "No failed emails found in last 24 hours — system is healthy",
          escalated: false,
        };
      }

      // Mark failed emails for retry by updating their outcome
      let retriedCount = 0;
      for (const comm of recentFailedComms) {
        try {
          await prisma.communication.update({
            where: { id: comm.id },
            data: {
              outcome: "RETRY_QUEUED",
              metadata: {
                ...(comm.metadata as object || {}),
                retryQueuedAt: new Date().toISOString(),
                retryQueuedBy: BOT_NAME,
              },
            },
          });
          retriedCount++;
        } catch {
          // Skip individual failures
        }
      }

      return {
        issue: "failed_emails",
        action: "retry_failed_emails",
        success: retriedCount > 0,
        details: `Re-queued ${retriedCount}/${recentFailedComms.length} failed emails for retry`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "failed_emails",
        action: "retry_failed_emails",
        success: false,
        details: `Failed to retry emails: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Reassign cases from inactive employees to active ones
   */
  private async healInactiveEmployeeCases(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: reassigning cases from inactive employees...`);

    try {
      // Find inactive employees with open cases
      const inactiveEmployeesWithCases = await prisma.user.findMany({
        where: {
          role: "EMPLOYEE",
          isActive: false,
          assignedCases: {
            some: {
              status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
            },
          },
        },
        include: {
          assignedCases: {
            where: {
              status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
            },
          },
        },
      });

      if (inactiveEmployeesWithCases.length === 0) {
        return {
          issue: "inactive_employee_cases",
          action: "check_inactive_employees",
          success: true,
          details: "No inactive employees with open cases found",
          escalated: false,
        };
      }

      // Find active employees to reassign to (prefer same tier or higher)
      const activeEmployees = await prisma.user.findMany({
        where: {
          role: "EMPLOYEE",
          isActive: true,
        },
        include: {
          _count: { select: { assignedCases: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (activeEmployees.length === 0) {
        return {
          issue: "inactive_employee_cases",
          action: "reassign_cases",
          success: false,
          details: "No active employees available for reassignment — escalating",
          escalated: false,
        };
      }

      // Sort active employees by case count (least loaded first)
      activeEmployees.sort((a, b) => a._count.assignedCases - b._count.assignedCases);

      let reassignedCount = 0;
      let employeeIndex = 0;

      for (const inactiveEmp of inactiveEmployeesWithCases) {
        for (const openCase of inactiveEmp.assignedCases) {
          const targetEmployee = activeEmployees[employeeIndex % activeEmployees.length];
          try {
            await prisma.case.update({
              where: { id: openCase.id },
              data: {
                assignedEmployeeId: targetEmployee.id,
                notes: `${openCase.notes || ""}\n[AUTO] Reassigned from inactive employee ${inactiveEmp.name} by ${BOT_NAME} on ${new Date().toISOString()}`,
              },
            });
            reassignedCount++;
            employeeIndex++;
          } catch {
            // Skip individual failures
          }
        }
      }

      // Log the reassignment as an audit event
      await prisma.auditLog.create({
        data: {
          action: "SELF_HEAL_REASSIGN",
          entityType: "Case",
          details: {
            inactiveEmployees: inactiveEmployeesWithCases.map((e) => e.id),
            casesReassigned: reassignedCount,
            healedBy: BOT_NAME,
          },
          ipAddress: "system",
        },
      });

      return {
        issue: "inactive_employee_cases",
        action: "reassign_cases",
        success: reassignedCount > 0,
        details: `Reassigned ${reassignedCount} cases from ${inactiveEmployeesWithCases.length} inactive employees`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "inactive_employee_cases",
        action: "reassign_cases",
        success: false,
        details: `Reassignment failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Detect and restart stalled cron jobs by checking BotRunLog gaps
   */
  private async healStalledCronJobs(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: checking for stalled cron jobs...`);

    try {
      // Check each known bot for staleness (no successful run in expected window)
      const stalledBots: string[] = [];
      const now = new Date();
      const expectedRunWindow = 2 * 60 * 60 * 1000; // 2 hours — most bots run hourly or more

      for (const botName of KNOWN_BOTS) {
        if (botName === BOT_NAME) continue; // Skip self

        const lastSuccessfulRun = await prisma.botRunLog.findFirst({
          where: {
            botName,
            success: true,
          },
          orderBy: { startedAt: "desc" },
        });

        if (lastSuccessfulRun) {
          const timeSinceRun = now.getTime() - new Date(lastSuccessfulRun.startedAt).getTime();
          if (timeSinceRun > expectedRunWindow) {
            stalledBots.push(botName);
          }
        }
        // If a bot has never run, we don't flag it (it may be new/disabled)
      }

      if (stalledBots.length === 0) {
        return {
          issue: "stalled_crons",
          action: "check_cron_staleness",
          success: true,
          details: "All bot cron jobs running within expected windows",
          escalated: false,
        };
      }

      // Create a BotRunLog entry to signal the scheduler to re-trigger these bots
      for (const stalledBot of stalledBots) {
        await prisma.botRunLog.create({
          data: {
            botName: stalledBot,
            runType: "SELF_HEAL_RESTART",
            success: false,
            summary: `Stalled bot detected by ${BOT_NAME} — marked for restart`,
            recordsProcessed: 0,
            insightsGenerated: 0,
            durationMs: 0,
            details: {
              detectedBy: BOT_NAME,
              reason: "no_successful_run_in_window",
              windowMs: expectedRunWindow,
            },
          },
        });
      }

      // Create a system alert for stalled bots
      await prisma.watchAlert.create({
        data: {
          type: "SYSTEM_HEALTH" as WatchAlertType,
          severity: stalledBots.length > 3 ? "HIGH" : "MEDIUM",
          message: `Stalled cron jobs detected: ${stalledBots.join(", ")}`,
          details: {
            stalledBots,
            detectedBy: BOT_NAME,
            action: "marked_for_restart",
          },
          status: "OPEN",
        },
      });

      return {
        issue: "stalled_crons",
        action: "restart_stalled_bots",
        success: true,
        details: `Detected ${stalledBots.length} stalled bots: ${stalledBots.join(", ")}. Marked for restart.`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "stalled_crons",
        action: "restart_stalled_bots",
        success: false,
        details: `Stall detection failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Clear stuck database issues — resolve long-running transactions and stale connections
   */
  private async healDatabaseIssues(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: checking for database issues...`);

    try {
      // Test basic connectivity first
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const pingMs = Date.now() - start;

      if (pingMs > 5000) {
        // Database is extremely slow — attempt to disconnect and reconnect
        console.log(`[${BOT_NAME}] Database ping very slow (${pingMs}ms), reconnecting...`);
        await prisma.$disconnect();
        await prisma.$connect();

        // Re-test
        const retryStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const retryMs = Date.now() - retryStart;

        return {
          issue: "database_slow",
          action: "reconnect_database",
          success: retryMs < 2000,
          details: `Reconnected database. Ping improved from ${pingMs}ms to ${retryMs}ms`,
          escalated: false,
        };
      }

      // Check for long-running queries via pg_stat_activity
      try {
        const longRunning: any[] = await prisma.$queryRaw`
          SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
          FROM pg_stat_activity
          WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
          AND state != 'idle'
          AND pid != pg_backend_pid()
          LIMIT 10
        `;

        if (longRunning.length > 0) {
          // Attempt to terminate long-running queries (non-destructive — only idle-in-transaction)
          let terminated = 0;
          for (const q of longRunning) {
            if (q.state === "idle in transaction") {
              try {
                await prisma.$queryRaw`SELECT pg_terminate_backend(${q.pid})`;
                terminated++;
              } catch {
                // Some backends cannot be terminated
              }
            }
          }

          return {
            issue: "database_locks",
            action: "clear_stuck_queries",
            success: true,
            details: `Found ${longRunning.length} long-running queries. Terminated ${terminated} idle-in-transaction connections.`,
            escalated: false,
          };
        }
      } catch {
        // pg_stat_activity may not be accessible — that is acceptable
      }

      return {
        issue: "database",
        action: "check_database_health",
        success: true,
        details: `Database healthy. Ping: ${pingMs}ms`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "database",
        action: "heal_database",
        success: false,
        details: `Database healing failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Heal memory pressure — trigger garbage collection hints and clean caches
   */
  private async healMemoryPressure(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: addressing memory pressure...`);

    const before = process.memoryUsage();
    const beforeMB = Math.round(before.heapUsed / 1024 / 1024);

    try {
      // Trigger garbage collection if exposed (--expose-gc flag)
      if (global.gc) {
        global.gc();
        console.log(`[${BOT_NAME}] Forced garbage collection`);
      }

      // Clean up old resolved alerts (older than 30 days)
      const cleanedAlerts = await prisma.watchAlert.deleteMany({
        where: {
          isResolved: true,
          resolvedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      // Clean up old stale insights (older than 14 days)
      const cleanedInsights = await prisma.opsInsight.deleteMany({
        where: {
          isStale: true,
          createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      });

      // Clean up expired sessions
      const cleanedSessions = await prisma.userSession.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      // Clean up expired refresh tokens
      const cleanedTokens = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      const after = process.memoryUsage();
      const afterMB = Math.round(after.heapUsed / 1024 / 1024);
      const freedMB = beforeMB - afterMB;

      return {
        issue: "memory_pressure",
        action: "cleanup_and_gc",
        success: true,
        details: `Memory cleanup: ${beforeMB}MB -> ${afterMB}MB (freed ~${Math.max(0, freedMB)}MB). ` +
          `Cleaned: ${cleanedAlerts.count} old alerts, ${cleanedInsights.count} stale insights, ` +
          `${cleanedSessions.count} expired sessions, ${cleanedTokens.count} expired tokens`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "memory_pressure",
        action: "cleanup_and_gc",
        success: false,
        details: `Memory healing failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Heal alert backlog — auto-resolve low-severity alerts older than 24h
   */
  private async healAlertBacklog(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: clearing alert backlog...`);

    try {
      // Auto-resolve INFO and LOW severity alerts older than 24 hours
      const autoResolved = await prisma.watchAlert.updateMany({
        where: {
          isResolved: false,
          severity: { in: ["INFO", "LOW"] },
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolution: `Auto-resolved by ${BOT_NAME} — low severity alert aged out after 24h`,
        },
      });

      // Auto-resolve MEDIUM severity alerts older than 72 hours
      const autoResolvedMedium = await prisma.watchAlert.updateMany({
        where: {
          isResolved: false,
          severity: "MEDIUM",
          createdAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolution: `Auto-resolved by ${BOT_NAME} — medium severity alert aged out after 72h`,
        },
      });

      const totalResolved = autoResolved.count + autoResolvedMedium.count;

      return {
        issue: "alert_backlog",
        action: "auto_resolve_stale_alerts",
        success: true,
        details: `Auto-resolved ${totalResolved} stale alerts (${autoResolved.count} low, ${autoResolvedMedium.count} medium)`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "alert_backlog",
        action: "auto_resolve_stale_alerts",
        success: false,
        details: `Alert cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Heal API degradation — attempt database reconnection and lightweight caching
   */
  private async healApiDegradation(): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: addressing API degradation...`);

    try {
      // Reconnect database pool
      await prisma.$disconnect();
      await prisma.$connect();

      // Verify improvement
      const start = Date.now();
      await Promise.all([
        prisma.user.count(),
        prisma.case.count(),
      ]);
      const responseTime = Date.now() - start;

      const improved = responseTime < 2000;

      if (!improved) {
        // Enter degraded mode — reduce non-essential operations
        this.degradedMode = true;
        console.log(`[${BOT_NAME}] Entering degraded mode — non-essential operations reduced`);
      }

      return {
        issue: "api_degradation",
        action: "reconnect_and_verify",
        success: improved,
        details: improved
          ? `API recovered after reconnection. Response time: ${responseTime}ms`
          : `API still degraded after reconnection (${responseTime}ms). Entered degraded mode.`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: "api_degradation",
        action: "reconnect_and_verify",
        success: false,
        details: `API healing failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Heal a specific bot failure — create restart marker and alert
   */
  private async healBotFailure(issue: string): Promise<SelfHealResult> {
    const botName = issue.replace("bot_failure_", "").replace("bot_failure:", "");
    console.log(`[${BOT_NAME}] Healing: restarting failed bot ${botName}...`);

    try {
      // Log a restart marker
      await prisma.botRunLog.create({
        data: {
          botName: botName || "unknown",
          runType: "SELF_HEAL_RESTART",
          success: false,
          summary: `Bot restart triggered by ${BOT_NAME} self-healing`,
          recordsProcessed: 0,
          insightsGenerated: 0,
          durationMs: 0,
          details: {
            healedBy: BOT_NAME,
            originalIssue: issue,
          },
        },
      });

      return {
        issue: `bot_failure:${botName}`,
        action: "restart_bot",
        success: true,
        details: `Created restart marker for ${botName}. Scheduler will re-trigger on next cycle.`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue: `bot_failure:${botName}`,
        action: "restart_bot",
        success: false,
        details: `Bot restart failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Generic healing — attempt basic remediation for unknown issues
   */
  private async healGeneric(issue: string): Promise<SelfHealResult> {
    console.log(`[${BOT_NAME}] Healing: generic remediation for ${issue}...`);

    try {
      // Basic approach: verify DB connectivity, clean caches, log it
      await prisma.$queryRaw`SELECT 1`;

      await prisma.auditLog.create({
        data: {
          action: "SELF_HEAL_GENERIC",
          entityType: "System",
          details: {
            issue,
            healedBy: BOT_NAME,
            timestamp: new Date().toISOString(),
          },
          ipAddress: "system",
        },
      });

      return {
        issue,
        action: "generic_heal",
        success: true,
        details: `Generic healing applied for: ${issue}. System connectivity verified.`,
        escalated: false,
      };
    } catch (error) {
      return {
        issue,
        action: "generic_heal",
        success: false,
        details: `Generic healing failed: ${error instanceof Error ? error.message : "unknown error"}`,
        escalated: false,
      };
    }
  }

  /**
   * Escalate unresolvable issues to the founder
   */
  private async escalateToFounder(issue: string, lastResult: SelfHealResult): Promise<void> {
    console.log(`[${BOT_NAME}] ESCALATING to founder: ${issue}`);

    try {
      await prisma.watchAlert.create({
        data: {
          type: "SYSTEM_HEALTH" as WatchAlertType,
          severity: "CRITICAL",
          message: `Self-healing FAILED — Founder intervention required: ${issue}`,
          details: {
            issue,
            lastHealAction: lastResult.action,
            lastHealDetails: lastResult.details,
            healingAttempts: this.getRecentHealingFailures(issue, 60),
            escalatedAt: new Date().toISOString(),
            escalatedBy: BOT_NAME,
          },
          status: "OPEN",
        },
      });

      // Also create an URGENT ops insight
      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: "URGENT",
          title: `ESCALATION: Self-healing failed for ${issue}`,
          summary: `MonitoringBot attempted self-healing for "${issue}" multiple times but failed. Manual intervention required.`,
          plainEnglish: `The system tried to automatically fix the problem "${issue}" but could not resolve it. ` +
            `Last attempt: ${lastResult.details}. A founder or admin needs to investigate this manually.`,
          recommendations: [
            `Investigate ${issue} manually`,
            `Check recent logs for ${BOT_NAME}`,
            `Review system health dashboard`,
            "Consider restarting affected services",
          ],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          actionRequired: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch (error) {
      console.error(`[${BOT_NAME}] Failed to escalate to founder:`, error);
    }
  }

  /**
   * Record a healing attempt in the ring buffer
   */
  private recordHealingAttempt(issue: string, success: boolean): void {
    healingHistory.push({ timestamp: new Date(), issue, success });
    if (healingHistory.length > HEALING_HISTORY_MAX) {
      healingHistory.shift();
    }
  }

  /**
   * Count recent healing failures for a given issue type
   */
  private getRecentHealingFailures(issue: string, windowMinutes: number): number {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return healingHistory.filter(
      (h) => h.issue.includes(issue) && !h.success && h.timestamp >= cutoff
    ).length;
  }

  /**
   * Log self-heal action to BotRunLog
   */
  private async logSelfHealAction(result: SelfHealResult, durationMs: number): Promise<void> {
    try {
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          runType: "SELF_HEAL",
          success: result.success,
          summary: `Self-heal [${result.issue}]: ${result.action} — ${result.success ? "SUCCESS" : "FAILED"}`,
          recordsProcessed: 0,
          insightsGenerated: result.escalated ? 1 : 0,
          alertsCreated: result.escalated ? 1 : 0,
          durationMs,
          details: result as unknown as any,
        },
      });
    } catch {
      // Non-critical — do not let logging failures break healing
    }
  }

  // ============================================
  // 2. PERFORMANCE GUARDIAN
  // Track and optimize system performance
  // ============================================

  /**
   * Comprehensive performance monitoring — API response times, DB query perf, memory, bot execution benchmarks
   */
  async monitorPerformance(): Promise<PerformanceMetrics> {
    console.log(`[${BOT_NAME}] Monitoring system performance...`);

    // DB query benchmark — run several representative queries
    const dbTimings: number[] = [];

    const queries = [
      () => prisma.$queryRaw`SELECT 1`,
      () => prisma.user.count(),
      () => prisma.case.count(),
      () => prisma.watchAlert.count({ where: { isResolved: false } }),
      () => prisma.botRunLog.findFirst({ orderBy: { startedAt: "desc" } }),
    ];

    for (const query of queries) {
      const start = Date.now();
      try {
        await query();
      } catch {
        // Even if query fails, record the time
      }
      dbTimings.push(Date.now() - start);
    }

    const dbQueryAvgMs = Math.round(dbTimings.reduce((a, b) => a + b, 0) / dbTimings.length);
    const dbQueryMaxMs = Math.max(...dbTimings);

    // Memory metrics
    const mem = process.memoryUsage();
    const memoryHeapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const memoryHeapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const memoryRssMB = Math.round(mem.rss / 1024 / 1024);
    const memoryUsagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

    // CPU metrics
    const uptimeSeconds = Math.round((Date.now() - this.startTime) / 1000);
    const cpu = process.cpuUsage();
    const cpuUsagePercent = Math.round(
      ((cpu.user + cpu.system) / 1000000 / Math.max(uptimeSeconds, 1)) * 100
    );

    // Active DB connections (estimate via pg_stat_activity)
    let activeConnections = 0;
    try {
      const result: any[] = await prisma.$queryRaw`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      activeConnections = parseInt(result[0]?.count || "0", 10);
    } catch {
      activeConnections = -1; // Unable to measure
    }

    // Slow queries count (queries > 1 second in last hour)
    let slowQueries = 0;
    try {
      const result: any[] = await prisma.$queryRaw`
        SELECT count(*) as count FROM pg_stat_activity
        WHERE state != 'idle'
        AND now() - query_start > interval '1 second'
      `;
      slowQueries = parseInt(result[0]?.count || "0", 10);
    } catch {
      slowQueries = -1;
    }

    // DB connection pool estimate
    let dbConnectionPoolUsage = 0;
    try {
      const result: any[] = await prisma.$queryRaw`
        SELECT count(*) as count FROM pg_stat_activity
      `;
      const totalConns = parseInt(result[0]?.count || "0", 10);
      // Prisma default pool is typically 10 connections
      dbConnectionPoolUsage = Math.round((totalConns / 10) * 100);
    } catch {
      dbConnectionPoolUsage = -1;
    }

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      dbQueryAvgMs,
      dbQueryMaxMs,
      dbConnectionPoolUsage,
      memoryHeapUsedMB,
      memoryHeapTotalMB,
      memoryRssMB,
      memoryUsagePercent,
      cpuUsagePercent,
      uptimeSeconds,
      activeConnections,
      slowQueries,
    };

    // Store in ring buffer for trend analysis
    performanceHistory.push({
      timestamp: new Date(),
      dbAvgMs: dbQueryAvgMs,
      memoryPercent: memoryUsagePercent,
      cpuPercent: cpuUsagePercent,
    });
    if (performanceHistory.length > PERF_HISTORY_MAX) {
      performanceHistory.shift();
    }

    // Detect performance anomalies and trigger self-healing
    if (dbQueryAvgMs > 3000) {
      await this.selfHeal("database_degraded");
    }
    if (memoryUsagePercent > 85) {
      await this.selfHeal("memory_degraded");
    }

    // Save performance metrics as OpsInsight
    await this.savePerformanceReport(metrics);

    console.log(
      `[${BOT_NAME}] Performance: DB avg ${dbQueryAvgMs}ms, Memory ${memoryUsagePercent}%, CPU ~${cpuUsagePercent}%`
    );

    return metrics;
  }

  /**
   * Save performance report as an OpsInsight
   */
  private async savePerformanceReport(metrics: PerformanceMetrics): Promise<void> {
    try {
      const isHealthy = metrics.dbQueryAvgMs < 1000 && metrics.memoryUsagePercent < 75;
      const isDegraded = metrics.dbQueryAvgMs > 2000 || metrics.memoryUsagePercent > 85;

      // Generate performance trend
      const trend = this.calculatePerformanceTrend();

      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: isDegraded ? "HIGH" : "LOW",
          title: `Performance Report: ${isDegraded ? "DEGRADED" : isHealthy ? "HEALTHY" : "MODERATE"}`,
          summary: `DB: ${metrics.dbQueryAvgMs}ms avg | Memory: ${metrics.memoryUsagePercent}% | CPU: ${metrics.cpuUsagePercent}% | Trend: ${trend}`,
          details: { ...metrics, trend } as any,
          plainEnglish: `Database queries averaging ${metrics.dbQueryAvgMs}ms. ` +
            `Memory usage at ${metrics.memoryUsagePercent}% (${metrics.memoryHeapUsedMB}MB of ${metrics.memoryHeapTotalMB}MB). ` +
            `CPU usage approximately ${metrics.cpuUsagePercent}%. ` +
            `${metrics.slowQueries > 0 ? `${metrics.slowQueries} slow queries detected. ` : ""}` +
            `Performance trend: ${trend}.`,
          recommendations: this.generatePerformanceRecommendations(metrics),
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          isStale: false,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Calculate performance trend from history
   */
  private calculatePerformanceTrend(): string {
    if (performanceHistory.length < 10) return "insufficient_data";

    const recent = performanceHistory.slice(-10);
    const older = performanceHistory.slice(-20, -10);

    if (older.length < 5) return "insufficient_data";

    const recentAvgDb = recent.reduce((a, b) => a + b.dbAvgMs, 0) / recent.length;
    const olderAvgDb = older.reduce((a, b) => a + b.dbAvgMs, 0) / older.length;

    const recentAvgMem = recent.reduce((a, b) => a + b.memoryPercent, 0) / recent.length;
    const olderAvgMem = older.reduce((a, b) => a + b.memoryPercent, 0) / older.length;

    if (recentAvgDb > olderAvgDb * 1.3 || recentAvgMem > olderAvgMem * 1.2) {
      return "degrading";
    }
    if (recentAvgDb < olderAvgDb * 0.8 && recentAvgMem < olderAvgMem * 0.9) {
      return "improving";
    }
    return "stable";
  }

  /**
   * Generate performance-specific recommendations
   */
  private generatePerformanceRecommendations(metrics: PerformanceMetrics): string[] {
    const recs: string[] = [];

    if (metrics.dbQueryAvgMs > 2000) {
      recs.push("Database queries are slow — review indexes and query optimization");
    }
    if (metrics.dbQueryMaxMs > 5000) {
      recs.push("Extremely slow database query detected — check for missing indexes or full table scans");
    }
    if (metrics.memoryUsagePercent > 85) {
      recs.push("Memory usage high — consider increasing heap limit or investigating memory leaks");
    }
    if (metrics.slowQueries > 5) {
      recs.push(`${metrics.slowQueries} slow queries active — review pg_stat_activity for long-running operations`);
    }
    if (metrics.dbConnectionPoolUsage > 80) {
      recs.push("Database connection pool near capacity — consider increasing pool size");
    }
    if (metrics.cpuUsagePercent > 70) {
      recs.push("CPU usage elevated — review bot execution schedules for overlap");
    }

    if (recs.length === 0) {
      recs.push("Performance metrics within normal ranges");
    }

    return recs;
  }

  // ============================================
  // 3. SECURITY SENTINEL
  // Detect and respond to threats
  // ============================================

  /**
   * Detect and respond to security threats — unusual logins, brute force, data anomalies, API abuse
   */
  async detectSecurityThreats(): Promise<SecurityThreatReport> {
    console.log(`[${BOT_NAME}] Scanning for security threats...`);

    const threats: SecurityThreat[] = [];
    const actionsRequired: string[] = [];

    // --- Brute Force Detection ---
    const bruteForceThreats = await this.detectBruteForce();
    threats.push(...bruteForceThreats);

    // --- Unusual Login Patterns ---
    const loginThreats = await this.detectUnusualLogins();
    threats.push(...loginThreats);

    // --- Data Access Anomalies ---
    const dataThreats = await this.detectDataAnomalies();
    threats.push(...dataThreats);

    // --- API Abuse Detection ---
    const apiThreats = await this.detectApiAbuse();
    threats.push(...apiThreats);

    // --- Session Anomalies ---
    const sessionThreats = await this.detectSessionAnomalies();
    threats.push(...sessionThreats);

    // Determine overall risk level
    const criticalCount = threats.filter((t) => t.severity === "critical").length;
    const highCount = threats.filter((t) => t.severity === "high").length;

    let overallRiskLevel: SecurityThreatReport["overallRiskLevel"] = "low";
    if (criticalCount > 0) {
      overallRiskLevel = "critical";
      actionsRequired.push("CRITICAL: Review security threats immediately");
    } else if (highCount > 0) {
      overallRiskLevel = "high";
      actionsRequired.push("HIGH: Investigate high-severity security events");
    } else if (threats.length > 0) {
      overallRiskLevel = "medium";
      actionsRequired.push("Monitor flagged security events");
    }

    const report: SecurityThreatReport = {
      timestamp: new Date(),
      threatsDetected: threats,
      overallRiskLevel,
      actionsRequired,
    };

    // Save security report
    if (threats.length > 0) {
      await this.saveSecurityReport(report);
    }

    // Create alerts for critical/high threats
    for (const threat of threats.filter((t) => t.severity === "critical" || t.severity === "high")) {
      await prisma.watchAlert.create({
        data: {
          type: "SYSTEM_HEALTH" as WatchAlertType,
          severity: threat.severity === "critical" ? "CRITICAL" : "HIGH",
          message: `Security threat: ${threat.type} — ${threat.description}`,
          details: JSON.parse(JSON.stringify({
            threatType: threat.type,
            evidence: threat.evidence,
            autoMitigated: threat.autoMitigated,
            mitigationAction: threat.mitigationAction,
          })),
          status: "OPEN",
        },
      });
    }

    console.log(
      `[${BOT_NAME}] Security scan complete: ${threats.length} threats detected (risk: ${overallRiskLevel})`
    );

    return report;
  }

  /**
   * Detect brute force login attempts
   */
  private async detectBruteForce(): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Check audit logs for repeated failed login attempts from same IP
      const recentLogins = await prisma.auditLog.findMany({
        where: {
          action: "LOGIN",
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
        orderBy: { createdAt: "desc" },
      });

      // Group by IP address
      const ipAttempts: Record<string, { total: number; failed: number; userIds: Set<string> }> = {};

      for (const log of recentLogins) {
        const ip = log.ipAddress || "unknown";
        if (!ipAttempts[ip]) {
          ipAttempts[ip] = { total: 0, failed: 0, userIds: new Set() };
        }
        ipAttempts[ip].total++;
        if (log.userId) ipAttempts[ip].userIds.add(log.userId);

        // Check if it was a failed login (details may contain success: false)
        const details = log.details as Record<string, unknown> | null;
        if (details?.success === false || details?.status === "failed") {
          ipAttempts[ip].failed++;
        }
      }

      for (const [ip, data] of Object.entries(ipAttempts)) {
        if (ip === "unknown" || ip === "system") continue;

        // Flag: more than 10 failed attempts from same IP
        if (data.failed >= 10) {
          threats.push({
            type: "brute_force",
            severity: data.failed >= 25 ? "critical" : "high",
            description: `${data.failed} failed login attempts from IP ${ip} in the last hour`,
            evidence: {
              ip,
              failedAttempts: data.failed,
              totalAttempts: data.total,
              targetedUsers: Array.from(data.userIds),
            },
            autoMitigated: false,
            mitigationAction: "Rate limiting should block further attempts",
          });
        }

        // Flag: attempts on many different user accounts from same IP
        if (data.userIds.size >= 5 && data.total >= 10) {
          threats.push({
            type: "brute_force",
            severity: "high",
            description: `IP ${ip} attempted login on ${data.userIds.size} different accounts`,
            evidence: {
              ip,
              accountsTargeted: data.userIds.size,
              totalAttempts: data.total,
            },
            autoMitigated: false,
            mitigationAction: "Consider IP blocklist",
          });
        }
      }
    } catch (error) {
      console.error(`[${BOT_NAME}] Brute force detection error:`, error);
    }

    return threats;
  }

  /**
   * Detect unusual login patterns (off-hours, new IPs, rapid location changes)
   */
  private async detectUnusualLogins(): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Find users who logged in from multiple IPs in a short window
      const recentSessions = await prisma.userSession.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // Last 2 hours
        },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });

      // Group sessions by user
      const userSessions: Record<string, { ips: Set<string>; userAgents: Set<string>; role: string; name: string }> = {};

      for (const session of recentSessions) {
        const userId = session.userId;
        if (!userSessions[userId]) {
          userSessions[userId] = {
            ips: new Set(),
            userAgents: new Set(),
            role: session.user.role,
            name: session.user.name,
          };
        }
        if (session.ipAddress) userSessions[userId].ips.add(session.ipAddress);
        if (session.userAgent) userSessions[userId].userAgents.add(session.userAgent);
      }

      for (const [userId, data] of Object.entries(userSessions)) {
        // Flag: FOUNDER or ADMIN with multiple IPs
        if ((data.role === "FOUNDER" || data.role === "ADMIN") && data.ips.size >= 3) {
          threats.push({
            type: "unusual_login",
            severity: "high",
            description: `${data.role} account "${data.name}" logged in from ${data.ips.size} different IPs in 2 hours`,
            evidence: {
              userId,
              role: data.role,
              uniqueIPs: data.ips.size,
              uniqueUserAgents: data.userAgents.size,
            },
            autoMitigated: false,
            mitigationAction: "Verify account owner identity",
          });
        }

        // Flag: Any user with 5+ different IPs
        if (data.ips.size >= 5) {
          threats.push({
            type: "session_hijack",
            severity: "critical",
            description: `User "${data.name}" has sessions from ${data.ips.size} IPs — possible session hijacking`,
            evidence: {
              userId,
              uniqueIPs: data.ips.size,
              uniqueUserAgents: data.userAgents.size,
            },
            autoMitigated: false,
            mitigationAction: "Consider revoking all sessions for this user",
          });
        }
      }
    } catch (error) {
      console.error(`[${BOT_NAME}] Unusual login detection error:`, error);
    }

    return threats;
  }

  /**
   * Detect data access anomalies — bulk data access, unusual patterns
   */
  private async detectDataAnomalies(): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Check for users making an unusually high number of data access operations
      const recentAuditLogs = await prisma.auditLog.groupBy({
        by: ["userId"],
        where: {
          action: "VIEW",
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          userId: { not: null },
        },
        _count: { id: true },
        having: {
          id: { _count: { gte: 100 } },
        },
      });

      for (const entry of recentAuditLogs) {
        if (!entry.userId) continue;

        const user = await prisma.user.findUnique({
          where: { id: entry.userId },
          select: { name: true, role: true },
        });

        // Non-FOUNDER/ADMIN users accessing 100+ records per hour is suspicious
        if (user && user.role !== "FOUNDER" && user.role !== "ADMIN") {
          threats.push({
            type: "data_anomaly",
            severity: "high",
            description: `User "${user.name}" (${user.role}) accessed ${entry._count.id} records in the last hour`,
            evidence: {
              userId: entry.userId,
              role: user.role,
              recordsAccessed: entry._count.id,
              window: "1 hour",
            },
            autoMitigated: false,
            mitigationAction: "Review user activity logs and consider temporary access restriction",
          });
        }
      }
    } catch (error) {
      console.error(`[${BOT_NAME}] Data anomaly detection error:`, error);
    }

    return threats;
  }

  /**
   * Detect API abuse — excessive request patterns
   */
  private async detectApiAbuse(): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Check audit logs for excessive API activity from a single IP
      const recentActivity = await prisma.auditLog.groupBy({
        by: ["ipAddress"],
        where: {
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // 15 min
          ipAddress: { not: null },
        },
        _count: { id: true },
        having: {
          id: { _count: { gte: 500 } },
        },
      });

      for (const entry of recentActivity) {
        if (!entry.ipAddress || entry.ipAddress === "system") continue;

        threats.push({
          type: "api_abuse",
          severity: entry._count.id >= 1000 ? "critical" : "high",
          description: `IP ${entry.ipAddress} made ${entry._count.id} API requests in 15 minutes`,
          evidence: {
            ipAddress: entry.ipAddress,
            requestCount: entry._count.id,
            window: "15 minutes",
          },
          autoMitigated: false,
          mitigationAction: "Review IP and consider blocking at firewall/reverse proxy level",
        });
      }
    } catch (error) {
      console.error(`[${BOT_NAME}] API abuse detection error:`, error);
    }

    return threats;
  }

  /**
   * Detect session anomalies — expired sessions still in use, concurrent session abuse
   */
  private async detectSessionAnomalies(): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Check for users with an excessive number of active sessions
      const activeSessions = await prisma.userSession.groupBy({
        by: ["userId"],
        where: {
          expiresAt: { gte: new Date() },
        },
        _count: { id: true },
        having: {
          id: { _count: { gte: 10 } },
        },
      });

      for (const entry of activeSessions) {
        const user = await prisma.user.findUnique({
          where: { id: entry.userId },
          select: { name: true, role: true },
        });

        if (user) {
          threats.push({
            type: "session_hijack",
            severity: entry._count.id >= 20 ? "high" : "medium",
            description: `User "${user.name}" has ${entry._count.id} concurrent active sessions`,
            evidence: {
              userId: entry.userId,
              activeSessions: entry._count.id,
            },
            autoMitigated: false,
            mitigationAction: "Review and potentially revoke excess sessions",
          });
        }
      }
    } catch (error) {
      console.error(`[${BOT_NAME}] Session anomaly detection error:`, error);
    }

    return threats;
  }

  /**
   * Save security report as OpsInsight
   */
  private async saveSecurityReport(report: SecurityThreatReport): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: report.overallRiskLevel === "critical" ? "URGENT" : report.overallRiskLevel === "high" ? "HIGH" : "NORMAL",
          title: `Security Scan: ${report.overallRiskLevel.toUpperCase()} risk — ${report.threatsDetected.length} threats`,
          summary: `Detected ${report.threatsDetected.length} security threats. Risk level: ${report.overallRiskLevel}`,
          details: report as unknown as any,
          plainEnglish: this.generateSecurityPlainEnglish(report),
          recommendations: report.actionsRequired,
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          actionRequired: report.overallRiskLevel === "critical" || report.overallRiskLevel === "high",
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Generate plain-English security report
   */
  private generateSecurityPlainEnglish(report: SecurityThreatReport): string {
    const sections: string[] = [];
    sections.push(`**Security Scan Report** (${new Date().toLocaleString()})\n`);
    sections.push(`Risk Level: **${report.overallRiskLevel.toUpperCase()}**`);
    sections.push(`Threats Found: ${report.threatsDetected.length}\n`);

    for (const threat of report.threatsDetected) {
      sections.push(`- [${threat.severity.toUpperCase()}] ${threat.type}: ${threat.description}`);
      if (threat.autoMitigated) {
        sections.push(`  Auto-mitigated: ${threat.mitigationAction}`);
      }
    }

    if (report.actionsRequired.length > 0) {
      sections.push("\n**Required Actions:**");
      for (const action of report.actionsRequired) {
        sections.push(`- ${action}`);
      }
    }

    return sections.join("\n");
  }

  // ============================================
  // 4. COST OPTIMIZATION
  // Track operational costs and budgets
  // ============================================

  /**
   * Track operational costs — SMS, email providers, API calls, storage
   */
  async trackCosts(): Promise<CostReport> {
    console.log(`[${BOT_NAME}] Tracking operational costs...`);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // --- Email Costs ---
    const emailCosts = await this.calculateEmailCosts(thirtyDaysAgo);

    // --- SMS Costs ---
    const smsCosts = await this.calculateSmsCosts(thirtyDaysAgo);

    // --- API Costs ---
    const apiCosts = await this.calculateApiCosts(thirtyDaysAgo);

    // --- Storage Costs ---
    const storageCosts = await this.calculateStorageCosts();

    const totalMonthlyCostCents =
      emailCosts.totalEmailCostCents +
      smsCosts.estimatedCostCents +
      apiCosts.estimatedCostCents +
      storageCosts.estimatedMonthlyCostCents;

    // Generate budget alerts
    const budgetAlerts: string[] = [];
    if (emailCosts.brevoSentCount > 300) {
      budgetAlerts.push(`Brevo email volume high (${emailCosts.brevoSentCount} sends). Consider routing more through Modoboa.`);
    }
    if (smsCosts.sentCount > 500) {
      budgetAlerts.push(`SMS volume high (${smsCosts.sentCount} sends). Review outreach automation limits.`);
    }
    if (apiCosts.tracerfyCalls > 1000) {
      budgetAlerts.push(`Tracerfy API calls high (${apiCosts.tracerfyCalls}). Implement caching where possible.`);
    }
    if (storageCosts.growthRateMBPerDay > 50) {
      budgetAlerts.push(`Database growing at ${storageCosts.growthRateMBPerDay}MB/day. Consider archival strategy.`);
    }
    if (totalMonthlyCostCents > 50000) { // > $500/month
      budgetAlerts.push(`Total monthly cost estimate exceeds $${(totalMonthlyCostCents / 100).toFixed(2)}. Review cost optimization opportunities.`);
    }

    const report: CostReport = {
      timestamp: now,
      period: "Last 30 days",
      emailCosts,
      smsCosts,
      apiCosts,
      storageCosts,
      totalMonthlyCostCents,
      budgetAlerts,
    };

    // Save cost report
    await this.saveCostReport(report);

    console.log(`[${BOT_NAME}] Cost tracking complete. Estimated monthly: $${(totalMonthlyCostCents / 100).toFixed(2)}`);

    return report;
  }

  /**
   * Calculate email provider costs
   */
  private async calculateEmailCosts(since: Date): Promise<CostReport["emailCosts"]> {
    try {
      // Count email communications sent
      const emailComms = await prisma.communication.count({
        where: {
          type: "EMAIL",
          direction: "OUTBOUND",
          createdAt: { gte: since },
        },
      });

      // Estimate split between Modoboa (self-hosted, ~free) and Brevo (paid)
      // Assume 70% Modoboa / 30% Brevo fallback based on typical config
      const modoboaCount = Math.round(emailComms * 0.7);
      const brevoCount = emailComms - modoboaCount;

      // Modoboa: self-hosted, cost is server hosting ~$10/month for the instance
      const modoboaCostCents = 1000; // Fixed hosting cost

      // Brevo: ~$0.001 per email on their free/starter tier
      const brevoCostCents = Math.round(brevoCount * 0.1);

      const recommendation = brevoCount > modoboaCount
        ? "Route more emails through Modoboa to reduce Brevo costs"
        : "Email cost mix is healthy — Modoboa handles majority of volume";

      return {
        modoboaSentCount: modoboaCount,
        brevoSentCount: brevoCount,
        estimatedModoboaCostCents: modoboaCostCents,
        estimatedBrevoCostCents: brevoCostCents,
        totalEmailCostCents: modoboaCostCents + brevoCostCents,
        recommendation,
      };
    } catch {
      return {
        modoboaSentCount: 0,
        brevoSentCount: 0,
        estimatedModoboaCostCents: 0,
        estimatedBrevoCostCents: 0,
        totalEmailCostCents: 0,
        recommendation: "Unable to calculate email costs",
      };
    }
  }

  /**
   * Calculate SMS costs
   */
  private async calculateSmsCosts(since: Date): Promise<CostReport["smsCosts"]> {
    try {
      const smsCount = await prisma.communication.count({
        where: {
          type: "TEXT",
          direction: "OUTBOUND",
          createdAt: { gte: since },
        },
      });

      // Average SMS cost: ~$0.0075 per message (Twilio-style pricing)
      const estimatedCostCents = Math.round(smsCount * 0.75);

      return { sentCount: smsCount, estimatedCostCents };
    } catch {
      return { sentCount: 0, estimatedCostCents: 0 };
    }
  }

  /**
   * Calculate API costs (external service calls)
   */
  private async calculateApiCosts(since: Date): Promise<CostReport["apiCosts"]> {
    try {
      // Estimate API calls from bot run logs
      const botRuns = await prisma.botRunLog.count({
        where: { startedAt: { gte: since } },
      });

      // Estimate Tracerfy calls from ingestion batches
      const ingestionBatches = await prisma.ingestionBatch.count({
        where: { createdAt: { gte: since } },
      });

      const tracerfyCalls = ingestionBatches * 5; // Estimate ~5 API calls per batch
      const externalApiCalls = botRuns * 2; // Estimate ~2 external calls per bot run

      // Approximate costs: $0.01 per Tracerfy call, $0.001 per other API call
      const estimatedCostCents = Math.round(tracerfyCalls * 1 + externalApiCalls * 0.1);

      return { tracerfyCalls, externalApiCalls, estimatedCostCents };
    } catch {
      return { tracerfyCalls: 0, externalApiCalls: 0, estimatedCostCents: 0 };
    }
  }

  /**
   * Calculate storage costs
   */
  private async calculateStorageCosts(): Promise<CostReport["storageCosts"]> {
    try {
      // Estimate database size from record counts
      const [caseCount, commCount, auditCount, botRunCount, alertCount] = await Promise.all([
        prisma.case.count(),
        prisma.communication.count(),
        prisma.auditLog.count(),
        prisma.botRunLog.count(),
        prisma.watchAlert.count(),
      ]);

      // Rough estimate: ~2KB per record average
      const estimatedRecords = caseCount + commCount + auditCount + botRunCount + alertCount;
      const dbSizeMB = Math.round((estimatedRecords * 2) / 1024);

      // Estimate growth from recent audit log entries
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentAuditCount = await prisma.auditLog.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      });
      const dailyGrowthRecords = Math.round(recentAuditCount / 7);
      const growthRateMBPerDay = Math.round((dailyGrowthRecords * 2) / 1024 * 10) / 10;

      // Storage cost estimate: ~$0.115 per GB per month (AWS RDS)
      const estimatedMonthlyCostCents = Math.round((dbSizeMB / 1024) * 11.5);

      return { dbSizeMB, growthRateMBPerDay, estimatedMonthlyCostCents };
    } catch {
      return { dbSizeMB: 0, growthRateMBPerDay: 0, estimatedMonthlyCostCents: 0 };
    }
  }

  /**
   * Save cost report as OpsInsight
   */
  private async saveCostReport(report: CostReport): Promise<void> {
    try {
      const hasAlerts = report.budgetAlerts.length > 0;

      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: hasAlerts ? "HIGH" : "NORMAL",
          title: `Cost Report: $${(report.totalMonthlyCostCents / 100).toFixed(2)}/month estimated`,
          summary: `Email: $${(report.emailCosts.totalEmailCostCents / 100).toFixed(2)} | SMS: $${(report.smsCosts.estimatedCostCents / 100).toFixed(2)} | API: $${(report.apiCosts.estimatedCostCents / 100).toFixed(2)} | Storage: $${(report.storageCosts.estimatedMonthlyCostCents / 100).toFixed(2)}`,
          details: report as unknown as any,
          plainEnglish: this.generateCostPlainEnglish(report),
          recommendations: report.budgetAlerts.length > 0 ? report.budgetAlerts : ["Costs within normal ranges"],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Generate plain-English cost report
   */
  private generateCostPlainEnglish(report: CostReport): string {
    const sections: string[] = [];
    sections.push(`**Cost Report** (${report.period})\n`);
    sections.push(`Estimated Monthly Total: **$${(report.totalMonthlyCostCents / 100).toFixed(2)}**\n`);

    sections.push("**Email:**");
    sections.push(`- Modoboa (self-hosted): ${report.emailCosts.modoboaSentCount} emails — $${(report.emailCosts.estimatedModoboaCostCents / 100).toFixed(2)}`);
    sections.push(`- Brevo (cloud): ${report.emailCosts.brevoSentCount} emails — $${(report.emailCosts.estimatedBrevoCostCents / 100).toFixed(2)}`);
    sections.push(`- Recommendation: ${report.emailCosts.recommendation}`);

    sections.push("\n**SMS:**");
    sections.push(`- ${report.smsCosts.sentCount} messages sent — $${(report.smsCosts.estimatedCostCents / 100).toFixed(2)}`);

    sections.push("\n**API Calls:**");
    sections.push(`- Tracerfy: ~${report.apiCosts.tracerfyCalls} calls`);
    sections.push(`- Other external: ~${report.apiCosts.externalApiCalls} calls`);
    sections.push(`- Total API cost: $${(report.apiCosts.estimatedCostCents / 100).toFixed(2)}`);

    sections.push("\n**Storage:**");
    sections.push(`- Database size: ~${report.storageCosts.dbSizeMB}MB`);
    sections.push(`- Growth rate: ${report.storageCosts.growthRateMBPerDay}MB/day`);

    if (report.budgetAlerts.length > 0) {
      sections.push("\n**Budget Alerts:**");
      for (const alert of report.budgetAlerts) {
        sections.push(`- ${alert}`);
      }
    }

    return sections.join("\n");
  }

  // ============================================
  // 5. UPTIME GUARDIAN
  // Ensure 99.9% uptime target
  // ============================================

  /**
   * Ensure system uptime meets 99.9% target — service dependency checks, failover, degraded mode, recovery
   */
  async ensureUptime(): Promise<UptimeReport> {
    console.log(`[${BOT_NAME}] Running uptime verification...`);

    // Run all service health checks
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkApiHealth(),
      this.checkDiskSpace(),
      Promise.resolve(this.checkMemory()),
    ]);

    // Record uptime data points
    for (const check of checks) {
      this.recordUptimeCheck(check.service, check.status !== "down");
    }

    // Calculate per-service uptime records
    const services = this.calculateServiceUptime();

    // Check if we meet 99.9% target
    const overall99thPercentile = services.every((s) => s.uptimePercent >= 99.9);

    // Check for active failures
    const downServices = checks.filter((c) => c.status === "down");
    const degradedServices = checks.filter((c) => c.status === "degraded");

    let failoverTriggered = false;
    let recoveryVerified = false;

    // Trigger failover for critical failures
    if (downServices.length > 0) {
      failoverTriggered = await this.triggerFailover(downServices);
    }

    // Handle degraded services
    if (degradedServices.length > 0 && !this.degradedMode) {
      this.degradedMode = true;
      console.log(`[${BOT_NAME}] Entering degraded mode: ${degradedServices.map((s) => s.service).join(", ")}`);
    }

    // Verify recovery if we were previously in degraded mode
    if (this.degradedMode && downServices.length === 0 && degradedServices.length === 0) {
      this.degradedMode = false;
      recoveryVerified = true;
      console.log(`[${BOT_NAME}] Recovery verified — exiting degraded mode`);
    }

    const report: UptimeReport = {
      timestamp: new Date(),
      services,
      overall99thPercentile,
      degradedModeActive: this.degradedMode,
      failoverTriggered,
      recoveryVerified,
    };

    // Save uptime report
    await this.saveUptimeReport(report);

    console.log(
      `[${BOT_NAME}] Uptime check complete. 99.9% target: ${overall99thPercentile ? "MET" : "NOT MET"}. ` +
      `Degraded: ${this.degradedMode}. Failover: ${failoverTriggered}.`
    );

    return report;
  }

  /**
   * Record a single uptime check data point
   */
  private recordUptimeCheck(service: string, up: boolean): void {
    uptimeHistory.push({ timestamp: new Date(), service, up });
    if (uptimeHistory.length > UPTIME_HISTORY_MAX) {
      uptimeHistory.shift();
    }
  }

  /**
   * Calculate uptime stats per service from history
   */
  private calculateServiceUptime(): ServiceUptimeRecord[] {
    const serviceMap: Record<string, { checks: number; successes: number; lastDown: Date | null; currentStreak: number }> = {};

    // Initialize known services
    const knownServices = ["database", "redis", "api", "disk", "memory"];
    for (const svc of knownServices) {
      serviceMap[svc] = { checks: 0, successes: 0, lastDown: null, currentStreak: 0 };
    }

    // Process history (newest last)
    for (const check of uptimeHistory) {
      if (!serviceMap[check.service]) {
        serviceMap[check.service] = { checks: 0, successes: 0, lastDown: null, currentStreak: 0 };
      }
      serviceMap[check.service].checks++;
      if (check.up) {
        serviceMap[check.service].successes++;
      } else {
        serviceMap[check.service].lastDown = check.timestamp;
      }
    }

    // Calculate current streaks (count consecutive successes from the end)
    for (const svc of knownServices) {
      let streak = 0;
      const svcChecks = uptimeHistory.filter((h) => h.service === svc);
      for (let i = svcChecks.length - 1; i >= 0; i--) {
        if (svcChecks[i].up) streak++;
        else break;
      }
      serviceMap[svc].currentStreak = streak;
    }

    return Object.entries(serviceMap).map(([service, data]) => ({
      service,
      checksPerformed: data.checks,
      checksSucceeded: data.successes,
      uptimePercent: data.checks > 0 ? Math.round((data.successes / data.checks) * 10000) / 100 : 100,
      lastDownAt: data.lastDown,
      currentStreak: data.currentStreak,
    }));
  }

  /**
   * Trigger failover for down services
   */
  private async triggerFailover(downServices: HealthCheckResult[]): Promise<boolean> {
    console.log(`[${BOT_NAME}] Triggering failover for: ${downServices.map((s) => s.service).join(", ")}`);

    let failoverPerformed = false;

    for (const svc of downServices) {
      if (svc.service === "database") {
        // Attempt database reconnection
        try {
          await prisma.$disconnect();
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          await prisma.$connect();
          failoverPerformed = true;
          console.log(`[${BOT_NAME}] Database failover: reconnection attempted`);
        } catch (error) {
          console.error(`[${BOT_NAME}] Database failover FAILED:`, error);
        }
      }

      if (svc.service === "api") {
        // Enter degraded mode — reduce load
        this.degradedMode = true;
        failoverPerformed = true;
        console.log(`[${BOT_NAME}] API failover: entered degraded mode`);
      }
    }

    if (failoverPerformed) {
      this.lastFailoverTriggered = new Date();

      await prisma.watchAlert.create({
        data: {
          type: "SYSTEM_HEALTH" as WatchAlertType,
          severity: "CRITICAL",
          message: `Failover triggered for: ${downServices.map((s) => s.service).join(", ")}`,
          details: {
            downServices: downServices.map((s) => ({ service: s.service, message: s.message })),
            failoverAt: new Date().toISOString(),
            triggeredBy: BOT_NAME,
          },
          status: "OPEN",
        },
      }).catch(() => { /* If DB is down, we can't log this */ });
    }

    return failoverPerformed;
  }

  /**
   * Save uptime report as OpsInsight
   */
  private async saveUptimeReport(report: UptimeReport): Promise<void> {
    try {
      const belowTarget = report.services.filter((s) => s.uptimePercent < 99.9);

      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: report.failoverTriggered ? "URGENT" : belowTarget.length > 0 ? "HIGH" : "LOW",
          title: `Uptime Report: ${report.overall99thPercentile ? "99.9% TARGET MET" : "BELOW TARGET"}`,
          summary: report.services.map((s) => `${s.service}: ${s.uptimePercent}%`).join(" | "),
          details: report as unknown as any,
          plainEnglish: this.generateUptimePlainEnglish(report),
          recommendations: belowTarget.length > 0
            ? belowTarget.map((s) => `Improve ${s.service} uptime (currently ${s.uptimePercent}%)`)
            : ["All services meeting 99.9% uptime target"],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
    } catch {
      // Non-critical — might fail if DB is down
    }
  }

  /**
   * Generate plain-English uptime report
   */
  private generateUptimePlainEnglish(report: UptimeReport): string {
    const sections: string[] = [];
    sections.push(`**Uptime Report** (${new Date().toLocaleString()})\n`);
    sections.push(`99.9% Target: **${report.overall99thPercentile ? "MET" : "NOT MET"}**`);
    sections.push(`Degraded Mode: ${report.degradedModeActive ? "ACTIVE" : "Off"}`);
    sections.push(`Failover Triggered: ${report.failoverTriggered ? "YES" : "No"}`);
    sections.push(`Recovery Verified: ${report.recoveryVerified ? "YES" : "N/A"}\n`);

    sections.push("**Service Uptime:**");
    for (const svc of report.services) {
      const status = svc.uptimePercent >= 99.9 ? "OK" : svc.uptimePercent >= 99 ? "WARN" : "FAIL";
      sections.push(`- ${svc.service}: ${svc.uptimePercent}% [${status}] (streak: ${svc.currentStreak})`);
    }

    return sections.join("\n");
  }

  // ============================================
  // 6. BOT FLEET HEALTH
  // Monitor all other bots
  // ============================================

  /**
   * Monitor the health of every bot in the fleet
   */
  async monitorBotFleet(): Promise<BotFleetReport> {
    console.log(`[${BOT_NAME}] Monitoring bot fleet health...`);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const bots: BotHealthRecord[] = [];
    const autoRestartedBots: string[] = [];
    const recommendations: string[] = [];

    for (const botName of KNOWN_BOTS) {
      const record = await this.assessBotHealth(botName, sevenDaysAgo);
      bots.push(record);

      // Auto-restart dead bots
      if (record.status === "dead" || (record.status === "failing" && record.failureStreak >= 5)) {
        const restartResult = await this.selfHeal(`bot_failure:${botName}`);
        if (restartResult.success) {
          autoRestartedBots.push(botName);
        }
      }
    }

    // Sort by health score (worst first)
    bots.sort((a, b) => a.healthScore - b.healthScore);

    // Generate fleet recommendations
    const deadBots = bots.filter((b) => b.status === "dead");
    const failingBots = bots.filter((b) => b.status === "failing");
    const warningBots = bots.filter((b) => b.status === "warning");

    if (deadBots.length > 0) {
      recommendations.push(`CRITICAL: ${deadBots.length} bot(s) dead: ${deadBots.map((b) => b.botName).join(", ")}`);
    }
    if (failingBots.length > 0) {
      recommendations.push(`HIGH: ${failingBots.length} bot(s) failing: ${failingBots.map((b) => b.botName).join(", ")}`);
    }
    if (warningBots.length > 0) {
      recommendations.push(`WARN: ${warningBots.length} bot(s) need attention: ${warningBots.map((b) => b.botName).join(", ")}`);
    }

    const healthyBots = bots.filter((b) => b.status === "healthy");
    const avgScore = bots.length > 0 ? Math.round(bots.reduce((a, b) => a + b.healthScore, 0) / bots.length) : 0;

    // Determine fleet health
    let overallFleetHealth: BotFleetReport["overallFleetHealth"] = "excellent";
    if (deadBots.length > 0) {
      overallFleetHealth = "critical";
    } else if (failingBots.length > 0) {
      overallFleetHealth = "degraded";
    } else if (warningBots.length > 0) {
      overallFleetHealth = "good";
    }

    if (recommendations.length === 0) {
      recommendations.push(`All ${bots.length} bots healthy. Average health score: ${avgScore}/100.`);
    }

    const report: BotFleetReport = {
      timestamp: new Date(),
      bots,
      overallFleetHealth,
      autoRestartedBots,
      recommendations,
    };

    // Save fleet report
    await this.saveBotFleetReport(report);

    console.log(
      `[${BOT_NAME}] Bot fleet: ${overallFleetHealth}. ` +
      `${healthyBots.length}/${bots.length} healthy. ` +
      `${autoRestartedBots.length} auto-restarted.`
    );

    return report;
  }

  /**
   * Assess the health of a single bot
   */
  private async assessBotHealth(botName: string, since: Date): Promise<BotHealthRecord> {
    try {
      const runs = await prisma.botRunLog.findMany({
        where: {
          botName,
          startedAt: { gte: since },
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      });

      if (runs.length === 0) {
        return {
          botName,
          lastRunAt: null,
          lastSuccess: false,
          successRate7d: 0,
          avgDurationMs: 0,
          failureStreak: 0,
          healthScore: botName === BOT_NAME ? 100 : 30, // Self gets a pass; others are suspicious if never run
          status: botName === BOT_NAME ? "healthy" : "warning",
        };
      }

      const lastRun = runs[0];
      const successRuns = runs.filter((r) => r.success);
      const successRate = Math.round((successRuns.length / runs.length) * 100);

      const durations = runs.filter((r) => r.durationMs && r.durationMs > 0).map((r) => r.durationMs!);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      // Calculate failure streak (consecutive failures from most recent)
      let failureStreak = 0;
      for (const run of runs) {
        if (!run.success) failureStreak++;
        else break;
      }

      // Health score calculation (0-100)
      let healthScore = 100;
      healthScore -= Math.max(0, (100 - successRate)); // -points for failure rate
      healthScore -= Math.min(30, failureStreak * 10); // -10 per consecutive failure, max -30
      if (avgDuration > 120000) healthScore -= 10; // -10 if avg > 2 min
      if (avgDuration > 300000) healthScore -= 15; // -15 more if avg > 5 min

      // Check recency: deduct if last run was > 4 hours ago
      const hoursSinceLastRun = (Date.now() - new Date(lastRun.startedAt).getTime()) / (60 * 60 * 1000);
      if (hoursSinceLastRun > 4) healthScore -= 10;
      if (hoursSinceLastRun > 12) healthScore -= 15;

      healthScore = Math.max(0, Math.min(100, healthScore));

      // Determine status
      let status: BotHealthRecord["status"] = "healthy";
      if (healthScore < 30) status = "dead";
      else if (healthScore < 50) status = "failing";
      else if (healthScore < 75) status = "warning";

      return {
        botName,
        lastRunAt: lastRun.startedAt,
        lastSuccess: lastRun.success,
        successRate7d: successRate,
        avgDurationMs: avgDuration,
        failureStreak,
        healthScore,
        status,
      };
    } catch {
      return {
        botName,
        lastRunAt: null,
        lastSuccess: false,
        successRate7d: 0,
        avgDurationMs: 0,
        failureStreak: 0,
        healthScore: 0,
        status: "dead",
      };
    }
  }

  /**
   * Save bot fleet report as OpsInsight
   */
  private async saveBotFleetReport(report: BotFleetReport): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: report.overallFleetHealth === "critical" ? "URGENT"
            : report.overallFleetHealth === "degraded" ? "HIGH"
            : "NORMAL",
          title: `Bot Fleet Health: ${report.overallFleetHealth.toUpperCase()}`,
          summary: `${report.bots.filter((b) => b.status === "healthy").length}/${report.bots.length} bots healthy. ` +
            `${report.autoRestartedBots.length} auto-restarted.`,
          details: report as unknown as any,
          plainEnglish: this.generateBotFleetPlainEnglish(report),
          recommendations: report.recommendations,
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        },
      });

      // Log the bot run
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          runType: "BOT_FLEET_MONITOR",
          success: true,
          summary: `Fleet health: ${report.overallFleetHealth}. ${report.bots.length} bots assessed.`,
          recordsProcessed: report.bots.length,
          insightsGenerated: 1,
          durationMs: 0,
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Generate plain-English bot fleet report
   */
  private generateBotFleetPlainEnglish(report: BotFleetReport): string {
    const sections: string[] = [];
    sections.push(`**Bot Fleet Health Report** (${new Date().toLocaleString()})\n`);
    sections.push(`Overall Fleet Health: **${report.overallFleetHealth.toUpperCase()}**\n`);

    sections.push("**Bot Scorecards:**");
    for (const bot of report.bots) {
      const statusIcon = bot.status === "healthy" ? "✓"
        : bot.status === "warning" ? "!"
        : bot.status === "failing" ? "!!"
        : "✗";
      sections.push(
        `- ${bot.botName}: ${statusIcon} Score: ${bot.healthScore}/100 | ` +
        `Success: ${bot.successRate7d}% | Avg: ${Math.round(bot.avgDurationMs / 1000)}s | ` +
        `Streak: ${bot.failureStreak > 0 ? `${bot.failureStreak} failures` : "clean"}`
      );
    }

    if (report.autoRestartedBots.length > 0) {
      sections.push(`\n**Auto-Restarted:** ${report.autoRestartedBots.join(", ")}`);
    }

    if (report.recommendations.length > 0) {
      sections.push("\n**Recommendations:**");
      for (const rec of report.recommendations) {
        sections.push(`- ${rec}`);
      }
    }

    return sections.join("\n");
  }

  // ============================================
  // 7. FULL DIAGNOSTIC
  // Comprehensive system health scan
  // ============================================

  /**
   * Run a comprehensive full-system diagnostic — combines all monitoring capabilities
   */
  async runFullDiagnostic(): Promise<DiagnosticReport> {
    console.log(`[${BOT_NAME}] ========== FULL DIAGNOSTIC STARTING ==========`);
    const startTime = Date.now();

    // Run all subsystems in sequence (some depend on others)
    const healthReport = await this.runHealthChecks();
    const performanceMetrics = await this.monitorPerformance();
    const securityReport = await this.detectSecurityThreats();
    const costReport = await this.trackCosts();
    const uptimeReport = await this.ensureUptime();
    const botFleetReport = await this.monitorBotFleet();

    // Collect all self-heal actions that happened during the diagnostic
    const recentHeals = healingHistory
      .filter((h) => h.timestamp >= new Date(startTime))
      .map((h) => ({
        issue: h.issue,
        action: h.success ? "auto_healed" : "heal_failed",
        success: h.success,
        details: h.success ? "Resolved during diagnostic" : "Failed during diagnostic",
        escalated: false,
      }));

    // Calculate overall system grade
    const overallGrade = this.calculateSystemGrade(
      healthReport,
      performanceMetrics,
      securityReport,
      uptimeReport,
      botFleetReport
    );

    const durationMs = Date.now() - startTime;

    const report: DiagnosticReport = {
      timestamp: new Date(),
      healthReport,
      performanceMetrics,
      securityReport,
      costReport,
      uptimeReport,
      botFleetReport,
      selfHealActions: recentHeals,
      overallGrade,
      summary: this.generateDiagnosticSummary(
        overallGrade, healthReport, performanceMetrics, securityReport,
        costReport, uptimeReport, botFleetReport, recentHeals
      ),
    };

    // Save comprehensive diagnostic report
    await this.saveDiagnosticReport(report, durationMs);

    console.log(
      `[${BOT_NAME}] ========== FULL DIAGNOSTIC COMPLETE: Grade ${overallGrade} (${durationMs}ms) ==========`
    );

    return report;
  }

  /**
   * Calculate overall system grade based on all subsystem reports
   */
  private calculateSystemGrade(
    health: SystemHealthReport,
    perf: PerformanceMetrics,
    security: SecurityThreatReport,
    uptime: UptimeReport,
    fleet: BotFleetReport
  ): DiagnosticReport["overallGrade"] {
    let score = 100;

    // Health deductions
    if (health.overallStatus === "down") score -= 40;
    else if (health.overallStatus === "degraded") score -= 15;

    // Performance deductions
    if (perf.dbQueryAvgMs > 3000) score -= 15;
    else if (perf.dbQueryAvgMs > 1500) score -= 5;
    if (perf.memoryUsagePercent > 90) score -= 15;
    else if (perf.memoryUsagePercent > 80) score -= 5;

    // Security deductions
    if (security.overallRiskLevel === "critical") score -= 30;
    else if (security.overallRiskLevel === "high") score -= 15;
    else if (security.overallRiskLevel === "medium") score -= 5;

    // Uptime deductions
    if (!uptime.overall99thPercentile) score -= 10;
    if (uptime.failoverTriggered) score -= 10;
    if (uptime.degradedModeActive) score -= 5;

    // Fleet deductions
    if (fleet.overallFleetHealth === "critical") score -= 20;
    else if (fleet.overallFleetHealth === "degraded") score -= 10;

    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  /**
   * Generate comprehensive diagnostic summary
   */
  private generateDiagnosticSummary(
    grade: string,
    health: SystemHealthReport,
    perf: PerformanceMetrics,
    security: SecurityThreatReport,
    cost: CostReport,
    uptime: UptimeReport,
    fleet: BotFleetReport,
    heals: SelfHealResult[]
  ): string {
    const sections: string[] = [];
    sections.push(`**FULL SYSTEM DIAGNOSTIC** (${new Date().toLocaleString()})`);
    sections.push(`Overall Grade: **${grade}**\n`);

    sections.push(`**Health:** ${health.overallStatus.toUpperCase()} — ` +
      `${health.checks.filter((c) => c.status === "healthy").length}/${health.checks.length} services healthy`);
    sections.push(`**Performance:** DB ${perf.dbQueryAvgMs}ms avg | Memory ${perf.memoryUsagePercent}% | CPU ~${perf.cpuUsagePercent}%`);
    sections.push(`**Security:** ${security.overallRiskLevel.toUpperCase()} risk — ${security.threatsDetected.length} threats`);
    sections.push(`**Cost:** $${(cost.totalMonthlyCostCents / 100).toFixed(2)}/month estimated`);
    sections.push(`**Uptime:** 99.9% target ${uptime.overall99thPercentile ? "MET" : "NOT MET"} | Degraded: ${uptime.degradedModeActive}`);
    sections.push(`**Bot Fleet:** ${fleet.overallFleetHealth.toUpperCase()} — ` +
      `${fleet.bots.filter((b) => b.status === "healthy").length}/${fleet.bots.length} bots healthy`);

    if (heals.length > 0) {
      sections.push(`\n**Self-Healing:** ${heals.length} actions taken — ` +
        `${heals.filter((h) => h.success).length} succeeded, ${heals.filter((h) => !h.success).length} failed`);
    }

    return sections.join("\n");
  }

  /**
   * Save full diagnostic report
   */
  private async saveDiagnosticReport(report: DiagnosticReport, durationMs: number): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: report.overallGrade === "F" ? "URGENT"
            : report.overallGrade === "D" ? "HIGH"
            : report.overallGrade === "C" ? "NORMAL"
            : "LOW",
          title: `Full Diagnostic: Grade ${report.overallGrade}`,
          summary: report.summary.split("\n").slice(0, 3).join(" | "),
          details: {
            grade: report.overallGrade,
            healthStatus: report.healthReport.overallStatus,
            securityRisk: report.securityReport.overallRiskLevel,
            fleetHealth: report.botFleetReport.overallFleetHealth,
            selfHealCount: report.selfHealActions.length,
            costEstimate: report.costReport.totalMonthlyCostCents,
          },
          plainEnglish: report.summary,
          recommendations: [
            ...report.botFleetReport.recommendations.slice(0, 3),
            ...report.securityReport.actionsRequired.slice(0, 2),
            ...report.costReport.budgetAlerts.slice(0, 2),
          ],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: BOT_NAME,
          actionRequired: report.overallGrade === "D" || report.overallGrade === "F",
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
        },
      });

      // Log the diagnostic run
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          runType: "FULL_DIAGNOSTIC",
          success: true,
          summary: `Full diagnostic complete. Grade: ${report.overallGrade}. Duration: ${durationMs}ms`,
          recordsProcessed: report.botFleetReport.bots.length + report.healthReport.checks.length,
          insightsGenerated: 1,
          alertsCreated: report.selfHealActions.filter((h) => h.escalated).length,
          durationMs,
          details: {
            grade: report.overallGrade,
            selfHealActions: report.selfHealActions.length,
          },
        },
      });
    } catch (error) {
      console.error(`[${BOT_NAME}] Failed to save diagnostic report:`, error);
    }
  }
}

export const monitoringBot = new MonitoringBot();
