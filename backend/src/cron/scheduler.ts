/**
 * scheduler.ts
 *
 * Production-ready cron job scheduler for MGR Capital Assistance (Phase 7).
 * Schedules automated bot runs, backups, reports, and maintenance tasks.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 *
 * Features:
 * - Timezone support via FounderConfig
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Structured logging with duration tracking
 * - WatchAlert creation on failures
 * - Dynamic enable/disable via FounderConfig
 * - BotRunLog integration for audit trail
 */

import cron, { ScheduledTask } from "node-cron";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

// Bot imports
import { coordinatorBot } from "../bots/coordinatorBot.js";
import { ingestionBot } from "../bots/ingestionBot.js";
import { payoutBot } from "../bots/payoutBot.js";
import { complianceBot } from "../bots/complianceBot.js";
import { trainingBot } from "../bots/trainingBot.js";
import { outreachBot } from "../bots/outreachBot.js";
import { docketBot } from "../bots/docketBot.js";
import { monitoringBot } from "../bots/monitoringBot.js";
import { metaBot } from "../bots/metaBot.js";

// Service imports
import { backupService } from "../services/BackupService.js";
import { reportingService } from "../services/ReportingService.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface CronJob {
  name: string;
  key: string; // FounderConfig key for enable/disable
  cronExpression: string;
  description: string;
  enabledByDefault: boolean;
  task: () => Promise<void>;
  category: "bot" | "backup" | "report" | "maintenance";
}

interface SchedulerConfig {
  timezone: string;
  jobs: Record<string, { enabled: boolean; cronExpression?: string }>;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_TIMEZONE = "America/Chicago";

const DEFAULT_CONFIG: SchedulerConfig = {
  timezone: DEFAULT_TIMEZONE,
  jobs: {},
};

// =============================================================================
// JOB DEFINITIONS
// =============================================================================

const jobs: CronJob[] = [
  // ===========================================
  // BOT SCHEDULES
  // ===========================================
  {
    name: "Coordinator Daily Summary",
    key: "coordinator_daily_summary",
    cronExpression: "0 6 * * *", // 6:00 AM daily
    description: "Run full ops cycle and generate daily summary",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await coordinatorBot.runFullCycle();
    },
  },
  {
    name: "Ingestion Intelligence Analysis",
    key: "ingestion_intelligence",
    cronExpression: "0 */6 * * *", // Every 6 hours
    description: "Analyze ingestion batches with intelligence layer",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await ingestionBot.analyze(7);
    },
  },
  {
    name: "Ingestion Auto-File Batch",
    key: "ingestion_auto_file",
    cronExpression: "0 8,14,20 * * *", // 8 AM, 2 PM, 8 PM
    description: "Process auto-file candidates (FOUNDER MUST ENABLE)",
    enabledByDefault: false,
    category: "bot",
    task: async () => {
      await ingestionBot.runAutoFileBatch();
    },
  },
  {
    name: "Payout Analysis",
    key: "payout_analysis",
    cronExpression: "0 7 * * *", // 7:00 AM daily
    description: "Analyze payouts for anomalies",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await payoutBot.analyze();
    },
  },
  {
    name: "Compliance Scan",
    key: "compliance_scan",
    cronExpression: "0 5 * * *", // 5:00 AM daily
    description: "Run compliance checks on all active cases",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await complianceBot.analyze();
    },
  },
  {
    name: "Training Analysis",
    key: "training_analysis",
    cronExpression: "0 4 * * 1", // 4:00 AM every Monday
    description: "Analyze training needs and generate recommendations",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await trainingBot.runFullAnalysis();
    },
  },
  {
    name: "Outreach Prioritization",
    key: "outreach_prioritization",
    cronExpression: "0 9 * * 1-5", // 9:00 AM Monday-Friday
    description: "Prioritize cases for outreach",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await outreachBot.analyze();
    },
  },
  {
    name: "Docket Deadline Check",
    key: "docket_deadline_check",
    cronExpression: "0 6 * * *", // 6:00 AM daily
    description: "Check upcoming deadlines and court dates",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await docketBot.analyze();
    },
  },
  {
    name: "System Health Monitoring",
    key: "monitoring_health_check",
    cronExpression: "0 * * * *", // Every hour
    description: "Check DB/Redis/API health, create alerts on failure",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await monitoringBot.runHealthChecks();
    },
  },
  {
    name: "Bot Performance Analysis",
    key: "meta_bot_analysis",
    cronExpression: "0 7 * * 0", // 7:00 AM every Sunday
    description: "Analyze bot performance, generate optimization recommendations",
    enabledByDefault: true,
    category: "bot",
    task: async () => {
      await metaBot.analyzeBotPerformance(7);
    },
  },

  // ===========================================
  // BACKUP SCHEDULES
  // ===========================================
  {
    name: "Hourly Backup",
    key: "backup_hourly",
    cronExpression: "0 * * * *", // Every hour
    description: "Hourly incremental database backup",
    enabledByDefault: true,
    category: "backup",
    task: async () => {
      await backupService.runHourlyBackup();
    },
  },
  {
    name: "Daily Backup",
    key: "backup_daily",
    cronExpression: "0 2 * * *", // 2:00 AM daily
    description: "Full daily backup (DB + documents)",
    enabledByDefault: true,
    category: "backup",
    task: async () => {
      await backupService.runDailyBackup();
    },
  },
  {
    name: "Weekly Backup",
    key: "backup_weekly",
    cronExpression: "0 3 * * 0", // 3:00 AM every Sunday
    description: "Weekly full backup with verification",
    enabledByDefault: true,
    category: "backup",
    task: async () => {
      await backupService.runWeeklyBackup();
    },
  },
  {
    name: "Monthly Backup",
    key: "backup_monthly",
    cronExpression: "0 4 1 * *", // 4:00 AM on 1st of each month
    description: "Monthly archive backup for air-gapped storage",
    enabledByDefault: true,
    category: "backup",
    task: async () => {
      await backupService.runMonthlyBackup();
    },
  },

  // ===========================================
  // REPORT SCHEDULES
  // ===========================================
  {
    name: "Daily Digest Report",
    key: "report_daily_digest",
    cronExpression: "30 6 * * 1-5", // 6:30 AM Monday-Friday
    description: "Generate and send daily digest to FOUNDER",
    enabledByDefault: false, // FOUNDER enables via config
    category: "report",
    task: async () => {
      await reportingService.generateDailyDigest();
    },
  },
  {
    name: "Weekly Summary Report",
    key: "report_weekly_summary",
    cronExpression: "0 8 * * 1", // 8:00 AM every Monday
    description: "Generate weekly summary report",
    enabledByDefault: false,
    category: "report",
    task: async () => {
      await reportingService.generateWeeklySummary();
    },
  },
  {
    name: "Monthly Metrics Report",
    key: "report_monthly_metrics",
    cronExpression: "0 9 1 * *", // 9:00 AM on 1st of each month
    description: "Generate monthly metrics report",
    enabledByDefault: false,
    category: "report",
    task: async () => {
      await reportingService.generateMonthlyMetrics();
    },
  },

  // ===========================================
  // MAINTENANCE SCHEDULES
  // ===========================================
  {
    name: "Cleanup Expired Insights",
    key: "cleanup_expired_insights",
    cronExpression: "0 3 * * *", // 3:00 AM daily
    description: "Clean up expired OpsInsights",
    enabledByDefault: true,
    category: "maintenance",
    task: async () => {
      const result = await prisma.opsInsight.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      logger.info(`Cleaned up ${result.count} expired OpsInsights`);
    },
  },
  {
    name: "Cleanup Old Bot Logs",
    key: "cleanup_old_bot_logs",
    cronExpression: "0 4 * * 0", // 4:00 AM every Sunday
    description: "Clean up bot run logs older than 30 days",
    enabledByDefault: true,
    category: "maintenance",
    task: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.botRunLog.deleteMany({
        where: { startedAt: { lt: thirtyDaysAgo } },
      });
      logger.info(`Cleaned up ${result.count} old BotRunLogs`);
    },
  },
  {
    name: "Backup Retention Cleanup",
    key: "cleanup_old_backups",
    cronExpression: "0 5 * * 0", // 5:00 AM every Sunday
    description: "Clean up old backups based on retention policy",
    enabledByDefault: true,
    category: "maintenance",
    task: async () => {
      const result = await backupService.cleanupOldBackups();
      logger.info(`Cleaned up ${result.deleted} old backups`);
    },
  },
];

// =============================================================================
// SCHEDULER CLASS
// =============================================================================

class Scheduler {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private config: SchedulerConfig = DEFAULT_CONFIG;
  private isRunning = false;

  /**
   * Load configuration from FounderConfig
   */
  private async loadConfig(): Promise<void> {
    try {
      const founderConfig = await prisma.founderConfig.findFirst({
        where: { key: "scheduler" },
      });

      if (founderConfig?.value) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...(founderConfig.value as Partial<SchedulerConfig>),
        };
      }

      logger.info("Scheduler config loaded", { timezone: this.config.timezone });
    } catch (error) {
      logger.warn("Failed to load scheduler config, using defaults");
    }
  }

  /**
   * Check if a job is enabled
   */
  private isJobEnabled(job: CronJob): boolean {
    const configJob = this.config.jobs[job.key];
    return configJob?.enabled ?? job.enabledByDefault;
  }

  /**
   * Get cron expression for a job (allows override via config)
   */
  private getCronExpression(job: CronJob): string {
    const configJob = this.config.jobs[job.key];
    return configJob?.cronExpression ?? job.cronExpression;
  }

  /**
   * Run a job with logging and error handling
   */
  private async runJob(job: CronJob): Promise<void> {
    const startTime = Date.now();
    const runId = `${job.key}_${Date.now()}`;

    logger.info(`Starting cron job: ${job.name}`, {
      key: job.key,
      category: job.category,
      runId,
    });

    try {
      await job.task();

      const durationMs = Date.now() - startTime;
      logger.info(`Completed cron job: ${job.name}`, {
        key: job.key,
        durationMs,
        runId,
      });

      // Log to BotRunLog
      await prisma.botRunLog.create({
        data: {
          botName: "Scheduler",
          runType: job.key,
          status: "SUCCESS",
          resultSummary: `Scheduled job ${job.name} completed successfully`,
          recordsProcessed: 0,
          insightsGenerated: 0,
          errorsEncountered: 0,
          durationMs,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Cron job failed: ${job.name}`, {
        key: job.key,
        durationMs,
        error: errorMessage,
        stack: errorStack,
        runId,
      });

      // Log to BotRunLog
      await prisma.botRunLog.create({
        data: {
          botName: "Scheduler",
          runType: job.key,
          status: "ERROR",
          resultSummary: `Job failed: ${errorMessage}`,
          recordsProcessed: 0,
          insightsGenerated: 0,
          errorsEncountered: 1,
          durationMs,
        },
      });

      // Create WatchAlert for critical failures
      await prisma.watchAlert.create({
        data: {
          type: "SYSTEM_HEALTH",
          severity: job.category === "bot" ? "CRITICAL" : "HIGH",
          message: `Scheduled job failure: ${job.name}`,
          details: {
            jobKey: job.key,
            category: job.category,
            error: errorMessage,
            stack: errorStack,
            durationMs,
          },
          status: "OPEN",
        },
      });

      // Create OpsInsight
      await prisma.opsInsight.create({
        data: {
          source: "Scheduler",
          category: "JOB_FAILURE",
          severity: "HIGH",
          priority: "URGENT",
          title: `Scheduled job failed: ${job.name}`,
          description: errorMessage,
          plainEnglish: `The ${job.name} scheduled task failed at ${new Date().toISOString()}. Error: ${errorMessage}. Please check system logs and resolve.`,
          data: { jobKey: job.key, error: errorMessage },
          status: "OPEN",
        },
      });
    }
  }

  /**
   * Start all enabled scheduled jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scheduler already running");
      return;
    }

    logger.info("Starting scheduler...");

    // Load config
    await this.loadConfig();

    // Schedule all enabled jobs
    for (const job of jobs) {
      if (!this.isJobEnabled(job)) {
        logger.info(`Skipping disabled job: ${job.name}`, { key: job.key });
        continue;
      }

      const cronExpression = this.getCronExpression(job);

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        logger.error(`Invalid cron expression for ${job.name}: ${cronExpression}`);
        continue;
      }

      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.runJob(job);
        },
        {
          timezone: this.config.timezone,
          scheduled: true,
        }
      );

      this.scheduledTasks.set(job.key, task);
      logger.info(`Scheduled: ${job.name}`, {
        key: job.key,
        cron: cronExpression,
        category: job.category,
      });
    }

    this.isRunning = true;
    logger.info(`Scheduler active: ${this.scheduledTasks.size} jobs running`, {
      timezone: this.config.timezone,
    });

    // Log startup to BotRunLog
    await prisma.botRunLog.create({
      data: {
        botName: "Scheduler",
        runType: "startup",
        status: "SUCCESS",
        resultSummary: `Scheduler started with ${this.scheduledTasks.size} jobs`,
        recordsProcessed: this.scheduledTasks.size,
        insightsGenerated: 0,
        errorsEncountered: 0,
        durationMs: 0,
      },
    });
  }

  /**
   * Stop all scheduled jobs (graceful shutdown)
   */
  async stop(): Promise<void> {
    logger.info("Stopping scheduler...");

    for (const [name, task] of this.scheduledTasks) {
      task.stop();
      logger.debug(`Stopped job: ${name}`);
    }

    this.scheduledTasks.clear();
    this.isRunning = false;

    // Log shutdown to BotRunLog
    await prisma.botRunLog.create({
      data: {
        botName: "Scheduler",
        runType: "shutdown",
        status: "SUCCESS",
        resultSummary: "Scheduler stopped gracefully",
        recordsProcessed: 0,
        insightsGenerated: 0,
        errorsEncountered: 0,
        durationMs: 0,
      },
    });

    logger.info("Scheduler stopped");
  }

  /**
   * Run a specific job manually
   */
  async runManually(jobKey: string): Promise<{ success: boolean; message: string }> {
    const job = jobs.find((j) => j.key === jobKey);

    if (!job) {
      return { success: false, message: `Job not found: ${jobKey}` };
    }

    try {
      await this.runJob(job);
      return { success: true, message: `Job ${job.name} completed successfully` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message };
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus(): Array<{
    name: string;
    key: string;
    cronExpression: string;
    description: string;
    category: string;
    enabled: boolean;
    isScheduled: boolean;
  }> {
    return jobs.map((job) => ({
      name: job.name,
      key: job.key,
      cronExpression: this.getCronExpression(job),
      description: job.description,
      category: job.category,
      enabled: this.isJobEnabled(job),
      isScheduled: this.scheduledTasks.has(job.key),
    }));
  }

  /**
   * Reload configuration and restart jobs
   */
  async reload(): Promise<void> {
    logger.info("Reloading scheduler configuration...");
    await this.stop();
    await this.start();
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const scheduler = new Scheduler();

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  await scheduler.stop();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// =============================================================================
// EXPORTS
// =============================================================================

export { scheduler, jobs };
export default scheduler;
