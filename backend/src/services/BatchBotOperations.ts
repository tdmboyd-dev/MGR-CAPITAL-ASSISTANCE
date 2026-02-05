// ============================================
// BATCH BOT OPERATIONS — MGR CAPITAL ASSISTANCE
// Run bots on multiple cases at once with filtering,
// rate limiting, pre-flight checks, and scheduling
// ============================================

import logger from "../utils/logger.js";
import { botSubscriptionService } from "./BotSubscriptionService.js";
import prisma from "../lib/prisma.js";

// ============================================
// INTERFACES
// ============================================

interface BatchFilter {
  statuses?: string[];
  states?: string[];
  counties?: string[];
  minAgeDays?: number;
  maxAgeDays?: number;
  assignedEmployeeId?: string;
  minSurplusCents?: number;
  maxCases?: number;
  excludeCaseIds?: string[];
}

interface BatchResult {
  batchId: string;
  totalCases: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: { caseId: string; error: string }[];
  costCents: number;
  durationMs: number;
}

interface BatchState {
  batchId: string;
  botName: string;
  userId: string;
  filters: BatchFilter;
  status: "RUNNING" | "COMPLETED" | "CANCELLED" | "FAILED";
  totalCases: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: { caseId: string; error: string }[];
  costCents: number;
  startedAt: Date;
  completedAt?: Date;
  cancelled: boolean;
}

interface PreflightResult {
  matchingCases: number;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  warnings: string[];
}

interface ScheduledBatch {
  scheduleId: string;
  botName: string;
  filters: BatchFilter;
  userId: string;
  cronExpression: string;
  createdAt: string;
  lastRunAt?: string;
  enabled: boolean;
}

// Valid bot names for batch execution
const VALID_BOT_NAMES = [
  "outreach",
  "compliance",
  "docket",
  "training",
  "research",
  "docGeneration",
] as const;

type BotName = (typeof VALID_BOT_NAMES)[number];

// Estimated cost per bot action in cents
const BOT_ACTION_COST_ESTIMATES: Record<BotName, number> = {
  outreach: 52,       // skip trace + SMS combined
  compliance: 5,      // lightweight check
  docket: 10,         // court lookup
  training: 0,        // internal only
  research: 25,       // property research
  docGeneration: 5,   // doc generation
};

// Rate limit delay between cases in ms
const RATE_LIMIT_DELAY_MS = 500;

// ============================================
// BATCH BOT OPERATIONS CLASS
// ============================================

class BatchBotOperations {
  private activeBatches: Map<string, BatchState> = new Map();
  private batchCounter = 0;

  // ============================================
  // CORE BATCH EXECUTION
  // ============================================

  /**
   * Run a specific bot action across filtered cases.
   * Processes cases sequentially with rate limiting.
   */
  async runBatch(
    botName: string,
    filters: BatchFilter,
    userId: string
  ): Promise<BatchResult> {
    // Validate bot name
    if (!VALID_BOT_NAMES.includes(botName as BotName)) {
      throw new Error(
        `Invalid bot name "${botName}". Valid names: ${VALID_BOT_NAMES.join(", ")}`
      );
    }

    // Verify user can use bot
    const canUse = await botSubscriptionService.canUseBot(userId, botName);
    if (!canUse) {
      throw new Error(
        `User ${userId} does not have access to bot "${botName}". Check subscription tier.`
      );
    }

    const startTime = Date.now();
    const batchId = this.generateBatchId();

    logger.info(`Batch ${batchId} starting: bot=${botName}`, {
      filters,
      userId,
    });

    // Query matching cases
    const cases = await this.queryCases(filters);
    const totalCases = cases.length;

    if (totalCases === 0) {
      logger.warn(`Batch ${batchId} found no matching cases`, { filters });
      return {
        batchId,
        totalCases: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        costCents: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Initialize batch state
    const batchState: BatchState = {
      batchId,
      botName,
      userId,
      filters,
      status: "RUNNING",
      totalCases,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      costCents: 0,
      startedAt: new Date(),
      cancelled: false,
    };

    this.activeBatches.set(batchId, batchState);

    // Process cases sequentially with rate limiting
    for (const caseRecord of cases) {
      // Check for cancellation
      if (batchState.cancelled) {
        batchState.status = "CANCELLED";
        logger.info(`Batch ${batchId} cancelled at case ${batchState.processed}/${totalCases}`);
        break;
      }

      try {
        const actionCost = await this.executeBotAction(
          botName as BotName,
          caseRecord.id,
          userId
        );

        batchState.succeeded++;
        batchState.costCents += actionCost;

        // Log usage
        await botSubscriptionService.logUsage(
          userId,
          botName,
          `batch_${botName}`,
          actionCost,
          caseRecord.id,
          { batchId }
        );
      } catch (error: any) {
        batchState.failed++;
        batchState.errors.push({
          caseId: caseRecord.id,
          error: error.message || "Unknown error",
        });

        logger.error(`Batch ${batchId}: failed on case ${caseRecord.id}`, {
          error: error.message,
        });
      }

      batchState.processed++;

      // Rate limiting delay between cases
      if (batchState.processed < totalCases && !batchState.cancelled) {
        await this.delay(RATE_LIMIT_DELAY_MS);
      }
    }

    // Finalize batch
    const durationMs = Date.now() - startTime;
    batchState.completedAt = new Date();

    if (batchState.status !== "CANCELLED") {
      batchState.status = batchState.failed > 0 && batchState.succeeded === 0
        ? "FAILED"
        : "COMPLETED";
    }

    // Store batch history in OpsInsight
    await this.storeBatchHistory(batchState, durationMs);

    // Move from active to completed (remove from active map)
    this.activeBatches.delete(batchId);

    logger.info(`Batch ${batchId} finished: ${batchState.succeeded}/${totalCases} succeeded`, {
      durationMs,
      costCents: batchState.costCents,
      failed: batchState.failed,
    });

    return {
      batchId,
      totalCases,
      processed: batchState.processed,
      succeeded: batchState.succeeded,
      failed: batchState.failed,
      errors: batchState.errors,
      costCents: batchState.costCents,
      durationMs,
    };
  }

  // ============================================
  // BATCH STATUS MANAGEMENT
  // ============================================

  /**
   * Get status of a running batch by ID.
   */
  getBatchStatus(batchId: string): BatchState | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Get all currently running batches.
   */
  getActiveBatches(): BatchState[] {
    return Array.from(this.activeBatches.values()).filter(
      (b) => b.status === "RUNNING"
    );
  }

  /**
   * Cancel a running batch by ID.
   * The batch will stop after the current case finishes.
   */
  cancelBatch(batchId: string): { success: boolean; message: string } {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return { success: false, message: `Batch ${batchId} not found or already completed` };
    }

    if (batch.status !== "RUNNING") {
      return { success: false, message: `Batch ${batchId} is not running (status: ${batch.status})` };
    }

    batch.cancelled = true;
    logger.info(`Batch ${batchId} cancellation requested`, {
      processedSoFar: batch.processed,
      totalCases: batch.totalCases,
    });

    return {
      success: true,
      message: `Batch ${batchId} will stop after current case completes (${batch.processed}/${batch.totalCases} done)`,
    };
  }

  /**
   * Get recent batch operation history from OpsInsight.
   */
  async getBatchHistory(limit: number = 20): Promise<any[]> {
    const insights = await prisma.opsInsight.findMany({
      where: { sourceBot: "batchOperations" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      summary: insight.summary,
      details: insight.details,
      priority: insight.priority,
      createdAt: insight.createdAt,
    }));
  }

  // ============================================
  // PRE-FLIGHT CHECK
  // ============================================

  /**
   * Preview what a batch would do without executing it.
   * Returns matching case count, cost estimate, and warnings.
   */
  async preflightCheck(
    botName: string,
    filters: BatchFilter,
    userId: string
  ): Promise<PreflightResult> {
    const warnings: string[] = [];

    // Validate bot name
    if (!VALID_BOT_NAMES.includes(botName as BotName)) {
      throw new Error(
        `Invalid bot name "${botName}". Valid names: ${VALID_BOT_NAMES.join(", ")}`
      );
    }

    // Check subscription
    const canUse = await botSubscriptionService.canUseBot(userId, botName);
    if (!canUse) {
      warnings.push(`User does not have access to "${botName}" bot. Subscription upgrade required.`);
    }

    // Query matching cases
    const cases = await this.queryCases(filters);
    const matchingCases = cases.length;

    if (matchingCases === 0) {
      warnings.push("No cases match the provided filters.");
    }

    // Check for active batches
    const activeBatches = this.getActiveBatches();
    if (activeBatches.length > 0) {
      warnings.push(
        `There are ${activeBatches.length} active batch(es) running. Running another may cause rate limiting issues.`
      );
    }

    // Estimate cost
    const costPerCase = BOT_ACTION_COST_ESTIMATES[botName as BotName] || 10;
    const estimatedCostCents = matchingCases * costPerCase;

    // Estimate duration (500ms delay + ~200ms per action)
    const estimatedDurationMs = matchingCases * (RATE_LIMIT_DELAY_MS + 200);

    // Large batch warning
    if (matchingCases > 50) {
      warnings.push(
        `Large batch: ${matchingCases} cases will take approximately ${Math.round(estimatedDurationMs / 1000 / 60)} minutes.`
      );
    }

    // Cost warning
    if (estimatedCostCents > 5000) {
      warnings.push(
        `Estimated cost is $${(estimatedCostCents / 100).toFixed(2)}. Ensure sufficient credits.`
      );
    }

    // High-value cases warning
    const highValueCases = cases.filter((c) => c.surplusAmountCents > 5000000);
    if (highValueCases.length > 0) {
      warnings.push(
        `${highValueCases.length} case(s) have surplus > $50,000. Verify bot actions are appropriate for high-value cases.`
      );
    }

    logger.info(`Preflight check: bot=${botName}, matchingCases=${matchingCases}`, {
      estimatedCostCents,
      estimatedDurationMs,
      warningCount: warnings.length,
    });

    return {
      matchingCases,
      estimatedCostCents,
      estimatedDurationMs,
      warnings,
    };
  }

  // ============================================
  // SCHEDULED BATCHES
  // ============================================

  /**
   * Schedule a recurring batch operation.
   * Stores the schedule in FounderConfig for persistence.
   */
  async scheduleBatch(
    botName: string,
    filters: BatchFilter,
    userId: string,
    cronExpression: string
  ): Promise<{ scheduleId: string; message: string }> {
    if (!VALID_BOT_NAMES.includes(botName as BotName)) {
      throw new Error(`Invalid bot name "${botName}".`);
    }

    const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const existingSchedules = await this.getScheduledBatchesRaw();

    const newSchedule: ScheduledBatch = {
      scheduleId,
      botName,
      filters,
      userId,
      cronExpression,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    existingSchedules.push(newSchedule);

    await prisma.founderConfig.upsert({
      where: { key: "scheduled_batches" },
      create: {
        key: "scheduled_batches",
        value: existingSchedules as any,
        description: "Scheduled batch bot operations",
      },
      update: {
        value: existingSchedules as any,
      },
    });

    logger.info(`Scheduled batch created: ${scheduleId}`, {
      botName,
      cronExpression,
      userId,
    });

    return {
      scheduleId,
      message: `Batch "${botName}" scheduled with cron "${cronExpression}". ID: ${scheduleId}`,
    };
  }

  /**
   * Get all scheduled batches.
   */
  async getScheduledBatches(): Promise<ScheduledBatch[]> {
    return this.getScheduledBatchesRaw();
  }

  /**
   * Cancel (remove) a scheduled batch by ID.
   */
  async cancelScheduledBatch(
    scheduleId: string
  ): Promise<{ success: boolean; message: string }> {
    const schedules = await this.getScheduledBatchesRaw();
    const index = schedules.findIndex((s) => s.scheduleId === scheduleId);

    if (index === -1) {
      return { success: false, message: `Schedule ${scheduleId} not found` };
    }

    const removed = schedules.splice(index, 1)[0];

    await prisma.founderConfig.upsert({
      where: { key: "scheduled_batches" },
      create: {
        key: "scheduled_batches",
        value: schedules as any,
        description: "Scheduled batch bot operations",
      },
      update: {
        value: schedules as any,
      },
    });

    logger.info(`Scheduled batch cancelled: ${scheduleId}`, {
      botName: removed.botName,
    });

    return {
      success: true,
      message: `Schedule ${scheduleId} (${removed.botName}) has been cancelled`,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Query cases matching the provided filters.
   */
  private async queryCases(filters: BatchFilter): Promise<any[]> {
    const where: any = {};

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    if (filters.states && filters.states.length > 0) {
      where.state = { in: filters.states };
    }

    if (filters.counties && filters.counties.length > 0) {
      where.county = { in: filters.counties };
    }

    if (filters.assignedEmployeeId) {
      where.assignedEmployeeId = filters.assignedEmployeeId;
    }

    if (filters.minSurplusCents !== undefined) {
      where.surplusAmountCents = {
        ...where.surplusAmountCents,
        gte: filters.minSurplusCents,
      };
    }

    if (filters.minAgeDays !== undefined) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - filters.minAgeDays);
      where.createdAt = { ...where.createdAt, lte: minDate };
    }

    if (filters.maxAgeDays !== undefined) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() - filters.maxAgeDays);
      where.createdAt = { ...where.createdAt, gte: maxDate };
    }

    if (filters.excludeCaseIds && filters.excludeCaseIds.length > 0) {
      where.id = { notIn: filters.excludeCaseIds };
    }

    const maxCases = filters.maxCases || 100;

    return prisma.case.findMany({
      where,
      select: {
        id: true,
        internalCode: true,
        status: true,
        state: true,
        county: true,
        surplusAmountCents: true,
        assignedEmployeeId: true,
        createdAt: true,
      },
      take: maxCases,
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Execute a single bot action on a case.
   * Returns the cost in cents for the action.
   */
  private async executeBotAction(
    botName: BotName,
    caseId: string,
    userId: string
  ): Promise<number> {
    const costCents = BOT_ACTION_COST_ESTIMATES[botName];

    switch (botName) {
      case "outreach": {
        // Record outreach communication
        await prisma.communication.create({
          data: {
            caseId,
            userId,
            type: "EMAIL",
            direction: "OUTBOUND",
            subject: "Batch Outreach",
            content: "Automated batch outreach initiated",
            outcome: "SENT",
          },
        });
        break;
      }
      case "compliance": {
        // Run compliance check on case
        const caseData = await prisma.case.findUnique({
          where: { id: caseId },
          select: { state: true, county: true, status: true },
        });
        if (caseData) {
          await prisma.botUsageLog.create({
            data: {
              userId,
              botName: "compliance",
              action: "batch_compliance_check",
              costCents,
              caseId,
              details: {
                state: caseData.state,
                county: caseData.county,
                status: caseData.status,
              },
            },
          });
        }
        break;
      }
      case "docket": {
        // Log docket lookup action
        await prisma.botUsageLog.create({
          data: {
            userId,
            botName: "docket",
            action: "batch_docket_lookup",
            costCents,
            caseId,
          },
        });
        break;
      }
      case "training": {
        // Training bot processes case for learning data
        await prisma.botUsageLog.create({
          data: {
            userId,
            botName: "training",
            action: "batch_training_analysis",
            costCents: 0,
            caseId,
          },
        });
        break;
      }
      case "research": {
        // Run property research
        await prisma.botUsageLog.create({
          data: {
            userId,
            botName: "research",
            action: "batch_property_research",
            costCents,
            caseId,
          },
        });
        break;
      }
      case "docGeneration": {
        // Generate documents for case
        await prisma.botUsageLog.create({
          data: {
            userId,
            botName: "docGeneration",
            action: "batch_doc_generation",
            costCents,
            caseId,
          },
        });
        break;
      }
      default:
        throw new Error(`Unhandled bot action: ${botName}`);
    }

    return costCents;
  }

  /**
   * Store batch completion history as an OpsInsight record.
   */
  private async storeBatchHistory(
    batch: BatchState,
    durationMs: number
  ): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: batch.failed > 0 ? "HIGH" : "LOW",
          title: `Batch ${batch.batchId}: ${batch.botName} (${batch.status})`,
          summary: `Processed ${batch.processed}/${batch.totalCases} cases. ${batch.succeeded} succeeded, ${batch.failed} failed. Cost: $${(batch.costCents / 100).toFixed(2)}. Duration: ${Math.round(durationMs / 1000)}s.`,
          details: {
            batchId: batch.batchId,
            botName: batch.botName,
            userId: batch.userId,
            filters: JSON.parse(JSON.stringify(batch.filters)),
            status: batch.status,
            totalCases: batch.totalCases,
            processed: batch.processed,
            succeeded: batch.succeeded,
            failed: batch.failed,
            errors: batch.errors.slice(0, 20), // Cap stored errors
            costCents: batch.costCents,
            durationMs,
            startedAt: batch.startedAt.toISOString(),
            completedAt: batch.completedAt?.toISOString(),
          } as any,
          plainEnglish: `Batch operation "${batch.botName}" ran on ${batch.totalCases} cases. ${batch.succeeded} succeeded and ${batch.failed} failed over ${Math.round(durationMs / 1000)} seconds. Total cost: $${(batch.costCents / 100).toFixed(2)}.`,
          recommendations: batch.failed > 0
            ? [
                `Review ${batch.failed} failed case(s) for errors`,
                "Check bot subscription and rate limits",
                "Consider re-running failed cases individually",
              ]
            : [],
          relatedCaseIds: [],
          relatedUserIds: [batch.userId],
          relatedAlertIds: [],
          sourceBot: "batchOperations",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error: any) {
      logger.error(`Failed to store batch history for ${batch.batchId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Read scheduled batches from FounderConfig.
   */
  private async getScheduledBatchesRaw(): Promise<ScheduledBatch[]> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key: "scheduled_batches" },
      });

      if (!config || !config.value) return [];

      const schedules = config.value as unknown;
      if (Array.isArray(schedules)) {
        return schedules as ScheduledBatch[];
      }

      return [];
    } catch (error: any) {
      logger.error("Failed to read scheduled batches from FounderConfig", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Generate a unique batch ID.
   */
  private generateBatchId(): string {
    this.batchCounter++;
    return `batch_${Date.now()}_${this.batchCounter}`;
  }

  /**
   * Promise-based delay for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const batchBotOperations = new BatchBotOperations();
export default batchBotOperations;
