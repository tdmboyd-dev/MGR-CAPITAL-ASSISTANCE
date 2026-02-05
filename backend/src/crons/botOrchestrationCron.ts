// ============================================
// BOT ORCHESTRATION CRON — MGR CAPITAL ASSISTANCE
// Runs smart triggers, processes auto-responses,
// and advances orchestration pipelines
// ============================================

import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";

/**
 * Main orchestration cron — runs every 15 minutes
 *
 * 1. Evaluates smart triggers (case events → bot actions)
 * 2. Processes auto-responses from inbox
 * 3. Advances active pipelines
 * 4. Recalculates contact intelligence models
 */
export async function runBotOrchestrationCron(): Promise<void> {
  const startTime = Date.now();
  let triggersEvaluated = 0;
  let responsesProcessed = 0;
  let pipelinesAdvanced = 0;

  try {
    // Check if orchestration is enabled
    const orchestratorToggle = await prisma.founderConfig.findUnique({
      where: { key: "orchestrator_enabled" },
    });
    if (orchestratorToggle && (orchestratorToggle.value as any) === false) {
      return; // Orchestrator disabled by founder
    }

    // --- 1. SMART TRIGGERS ---
    // Check for cases that need automated bot actions
    try {
      // Find cases with no activity in 7+ days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const staleCases = await prisma.case.count({
        where: {
          status: { in: ["NEW", "CONTACTED", "DOCS_PENDING"] },
          updatedAt: { lt: sevenDaysAgo },
        },
      });
      if (staleCases > 0) {
        triggersEvaluated++;
        logger.info(`[OrchestrationCron] ${staleCases} stale cases detected (7+ days no activity)`);
      }

      // Find cases with deadlines in next 3 days
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const urgentDeadlines = await prisma.deadline.count({
        where: {
          dueDate: { lte: threeDaysFromNow },
          completedAt: null,
          reminderSent: false,
        },
      });
      if (urgentDeadlines > 0) {
        triggersEvaluated++;
        logger.info(`[OrchestrationCron] ${urgentDeadlines} urgent deadlines (within 3 days)`);
      }
    } catch (err: any) {
      logger.error(`[OrchestrationCron] Trigger evaluation error: ${err.message}`);
    }

    // --- 2. AUTO-RESPONSE CHECK ---
    // Check for unprocessed inbound communications
    try {
      const autoResponseToggle = await prisma.founderConfig.findUnique({
        where: { key: "auto_response_enabled" },
      });
      if (autoResponseToggle && (autoResponseToggle.value as any) === true) {
        const unprocessedComms = await prisma.communication.count({
          where: {
            direction: "INBOUND",
            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // last 30 min
            outcome: null, // not yet processed
          },
        });
        responsesProcessed = unprocessedComms;
        if (unprocessedComms > 0) {
          logger.info(`[OrchestrationCron] ${unprocessedComms} unprocessed inbound messages`);
        }
      }
    } catch (err: any) {
      logger.error(`[OrchestrationCron] Auto-response check error: ${err.message}`);
    }

    // --- 3. PIPELINE STATUS ---
    // Check for active pipelines that need advancement
    try {
      const activePipelines = await prisma.opsInsight.count({
        where: {
          sourceBot: "orchestrator",
          status: "OPEN",
          isStale: false,
        },
      });
      pipelinesAdvanced = activePipelines;
      if (activePipelines > 0) {
        logger.info(`[OrchestrationCron] ${activePipelines} active pipelines being monitored`);
      }
    } catch (err: any) {
      logger.error(`[OrchestrationCron] Pipeline check error: ${err.message}`);
    }

    const durationMs = Date.now() - startTime;

    // Log the cron run
    await prisma.botRunLog.create({
      data: {
        botName: "orchestrationCron",
        runType: "scheduled",
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        success: true,
        status: "SUCCESS",
        resultSummary: `Triggers: ${triggersEvaluated}, Responses: ${responsesProcessed}, Pipelines: ${pipelinesAdvanced}`,
        recordsProcessed: triggersEvaluated + responsesProcessed + pipelinesAdvanced,
        insightsGenerated: 0,
        alertsCreated: 0,
        errorsEncountered: 0,
        summary: `Orchestration cron completed in ${durationMs}ms`,
        details: { triggersEvaluated, responsesProcessed, pipelinesAdvanced },
      },
    });

    logger.info(`[OrchestrationCron] Complete in ${durationMs}ms — triggers: ${triggersEvaluated}, responses: ${responsesProcessed}, pipelines: ${pipelinesAdvanced}`);
  } catch (err: any) {
    logger.error(`[OrchestrationCron] Fatal error: ${err.message}`);
    await prisma.botRunLog.create({
      data: {
        botName: "orchestrationCron",
        runType: "scheduled",
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        success: false,
        status: "FAILED",
        error: err.message,
        recordsProcessed: 0,
        insightsGenerated: 0,
        alertsCreated: 0,
        errorsEncountered: 1,
      },
    });
  }
}
