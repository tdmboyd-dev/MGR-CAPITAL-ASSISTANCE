/**
 * scheduler.ts
 *
 * Cron job scheduler for MGR Capital Assistance OPS Layer (Phase 7).
 * Schedules automated bot runs, backups, reports, and maintenance tasks.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 *
 * Schedule Format (node-cron):
 * ┌────────────── second (0-59) [optional]
 * │ ┌──────────── minute (0-59)
 * │ │ ┌────────── hour (0-23)
 * │ │ │ ┌──────── day of month (1-31)
 * │ │ │ │ ┌────── month (1-12)
 * │ │ │ │ │ ┌──── day of week (0-6, 0=Sunday)
 * │ │ │ │ │ │
 * * * * * * *
 */

// import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

// Bot imports
import { coordinatorBot } from "../bots/coordinatorBot.js";
import { ingestionBot } from "../bots/ingestionBot.js";
import { payoutBot } from "../bots/payoutBot.js";
import { complianceBot } from "../bots/complianceBot.js";
import { trainingBot } from "../bots/trainingBot.js";
import { outreachBot } from "../bots/outreachBot.js";
import { docketBot } from "../bots/docketBot.js";

// Service imports (Phase 7 - to be implemented)
// import { backupService } from "../services/BackupService.js";
// import { reportingService } from "../services/ReportingService.js";

const prisma = new PrismaClient();

// =============================================================================
// SCHEDULE CONFIGURATION
// =============================================================================

interface ScheduleConfig {
  name: string;
  cronExpression: string;
  description: string;
  enabled: boolean;
  handler: () => Promise<void>;
}

const schedules: ScheduleConfig[] = [
  // ===========================================
  // BOT SCHEDULES
  // ===========================================

  {
    name: "coordinator_daily_summary",
    cronExpression: "0 6 * * *", // 6:00 AM daily
    description: "Run full ops cycle and generate daily summary",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running coordinator daily summary...");
      await coordinatorBot.runFullCycle();
    },
  },

  {
    name: "ingestion_analysis",
    cronExpression: "0 */6 * * *", // Every 6 hours
    description: "Analyze ingestion batches for patterns and issues",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running ingestion analysis...");
      await ingestionBot.analyze(7);
    },
  },

  {
    name: "ingestion_auto_file",
    cronExpression: "0 8,14,20 * * *", // 8 AM, 2 PM, 8 PM
    description: "Process auto-file candidates",
    enabled: false, // FOUNDER must enable via FounderConfig
    handler: async () => {
      console.log("[Scheduler] Running auto-file batch...");
      await ingestionBot.runAutoFileBatch();
    },
  },

  {
    name: "payout_analysis",
    cronExpression: "0 7 * * *", // 7:00 AM daily
    description: "Analyze payouts for anomalies",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running payout analysis...");
      await payoutBot.analyze();
    },
  },

  {
    name: "compliance_scan",
    cronExpression: "0 5 * * *", // 5:00 AM daily
    description: "Run compliance checks on all active cases",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running compliance scan...");
      await complianceBot.analyze();
    },
  },

  {
    name: "training_analysis",
    cronExpression: "0 4 * * 1", // 4:00 AM every Monday
    description: "Analyze training needs and generate recommendations",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running training analysis...");
      await trainingBot.runFullAnalysis();
    },
  },

  {
    name: "outreach_prioritization",
    cronExpression: "0 9 * * 1-5", // 9:00 AM Monday-Friday
    description: "Prioritize cases for outreach",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running outreach prioritization...");
      await outreachBot.analyze();
    },
  },

  {
    name: "docket_deadline_check",
    cronExpression: "0 6 * * *", // 6:00 AM daily
    description: "Check upcoming deadlines and court dates",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Running docket deadline check...");
      await docketBot.analyze();
    },
  },

  // ===========================================
  // BACKUP SCHEDULES (Phase 7)
  // ===========================================

  {
    name: "backup_hourly",
    cronExpression: "0 * * * *", // Every hour
    description: "Hourly database backup",
    enabled: false, // Enable after BackupService is implemented
    handler: async () => {
      console.log("[Scheduler] Running hourly backup...");
      // await backupService.runHourlyBackup();
    },
  },

  {
    name: "backup_daily",
    cronExpression: "0 2 * * *", // 2:00 AM daily
    description: "Full daily backup (DB + documents)",
    enabled: false,
    handler: async () => {
      console.log("[Scheduler] Running daily backup...");
      // await backupService.runDailyBackup();
    },
  },

  {
    name: "backup_weekly",
    cronExpression: "0 3 * * 0", // 3:00 AM every Sunday
    description: "Weekly full backup with verification",
    enabled: false,
    handler: async () => {
      console.log("[Scheduler] Running weekly backup...");
      // await backupService.runWeeklyBackup();
    },
  },

  // ===========================================
  // REPORT SCHEDULES (Phase 7)
  // ===========================================

  {
    name: "report_daily_digest",
    cronExpression: "0 7 * * 1-5", // 7:00 AM Monday-Friday
    description: "Generate and send daily digest to FOUNDER",
    enabled: false,
    handler: async () => {
      console.log("[Scheduler] Generating daily digest...");
      // await reportingService.generateDailyDigest();
    },
  },

  {
    name: "report_weekly_summary",
    cronExpression: "0 8 * * 1", // 8:00 AM every Monday
    description: "Generate weekly summary report",
    enabled: false,
    handler: async () => {
      console.log("[Scheduler] Generating weekly summary...");
      // await reportingService.generateWeeklySummary();
    },
  },

  {
    name: "report_monthly_metrics",
    cronExpression: "0 9 1 * *", // 9:00 AM on 1st of each month
    description: "Generate monthly metrics report",
    enabled: false,
    handler: async () => {
      console.log("[Scheduler] Generating monthly metrics...");
      // await reportingService.generateMonthlyMetrics();
    },
  },

  // ===========================================
  // MAINTENANCE SCHEDULES
  // ===========================================

  {
    name: "cleanup_expired_insights",
    cronExpression: "0 3 * * *", // 3:00 AM daily
    description: "Clean up expired OpsInsights",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Cleaning up expired insights...");
      await prisma.opsInsight.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
    },
  },

  {
    name: "cleanup_old_bot_logs",
    cronExpression: "0 4 * * 0", // 4:00 AM every Sunday
    description: "Clean up bot run logs older than 30 days",
    enabled: true,
    handler: async () => {
      console.log("[Scheduler] Cleaning up old bot logs...");
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await prisma.botRunLog.deleteMany({
        where: {
          startedAt: { lt: thirtyDaysAgo },
        },
      });
    },
  },
];

// =============================================================================
// SCHEDULER CLASS
// =============================================================================

class Scheduler {
  private jobs: Map<string, unknown> = new Map();
  private isRunning = false;

  /**
   * Start all enabled scheduled jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[Scheduler] Already running");
      return;
    }

    console.log("[Scheduler] Starting scheduler...");

    // Load dynamic config from FounderConfig
    const dynamicConfig = await this.loadDynamicConfig();

    for (const schedule of schedules) {
      // Check if dynamically disabled
      const isEnabled = dynamicConfig[schedule.name] ?? schedule.enabled;

      if (!isEnabled) {
        console.log(`[Scheduler] Skipping disabled job: ${schedule.name}`);
        continue;
      }

      // TODO: Uncomment when node-cron is installed
      // const job = cron.schedule(schedule.cronExpression, async () => {
      //   try {
      //     await this.runJob(schedule);
      //   } catch (error) {
      //     console.error(`[Scheduler] Error in ${schedule.name}:`, error);
      //     await this.logJobError(schedule.name, error);
      //   }
      // });

      // this.jobs.set(schedule.name, job);
      console.log(`[Scheduler] Scheduled: ${schedule.name} (${schedule.cronExpression})`);
    }

    this.isRunning = true;
    console.log(`[Scheduler] Started with ${this.jobs.size} jobs`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log("[Scheduler] Stopping scheduler...");

    for (const [name, job] of this.jobs) {
      // (job as any).stop();
      console.log(`[Scheduler] Stopped: ${name}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log("[Scheduler] Stopped");
  }

  /**
   * Run a specific job manually
   */
  async runManually(jobName: string): Promise<{ success: boolean; message: string }> {
    const schedule = schedules.find((s) => s.name === jobName);

    if (!schedule) {
      return { success: false, message: `Job not found: ${jobName}` };
    }

    try {
      await this.runJob(schedule);
      return { success: true, message: `Job ${jobName} completed successfully` };
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
    cronExpression: string;
    description: string;
    enabled: boolean;
    isScheduled: boolean;
  }> {
    return schedules.map((s) => ({
      name: s.name,
      cronExpression: s.cronExpression,
      description: s.description,
      enabled: s.enabled,
      isScheduled: this.jobs.has(s.name),
    }));
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private async runJob(schedule: ScheduleConfig): Promise<void> {
    const startTime = Date.now();
    console.log(`[Scheduler] Running job: ${schedule.name}`);

    try {
      await schedule.handler();

      await prisma.botRunLog.create({
        data: {
          botName: "Scheduler",
          runType: schedule.name,
          status: "SUCCESS",
          resultSummary: `Scheduled job ${schedule.name} completed`,
          recordsProcessed: 0,
          insightsGenerated: 0,
          errorsEncountered: 0,
          durationMs: Date.now() - startTime,
        },
      });

      console.log(`[Scheduler] Job completed: ${schedule.name} (${Date.now() - startTime}ms)`);
    } catch (error) {
      await this.logJobError(schedule.name, error);
      throw error;
    }
  }

  private async logJobError(jobName: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.botRunLog.create({
      data: {
        botName: "Scheduler",
        runType: jobName,
        status: "ERROR",
        resultSummary: `Job failed: ${message}`,
        recordsProcessed: 0,
        insightsGenerated: 0,
        errorsEncountered: 1,
        durationMs: 0,
      },
    });

    // Create OpsInsight for critical job failures
    await prisma.opsInsight.create({
      data: {
        source: "Scheduler",
        category: "JOB_FAILURE",
        severity: "HIGH",
        title: `Scheduled job failed: ${jobName}`,
        description: message,
        data: { jobName, error: message },
        status: "OPEN",
      },
    });
  }

  private async loadDynamicConfig(): Promise<Record<string, boolean>> {
    try {
      const config = await prisma.founderConfig.findFirst({
        where: { key: "scheduler" },
      });

      if (config?.value) {
        return config.value as Record<string, boolean>;
      }
    } catch {
      // Config not found, use defaults
    }

    return {};
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const scheduler = new Scheduler();

export default scheduler;
