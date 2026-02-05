// ============================================
// WORKER BOT FLEET CRON — MGR CAPITAL ASSISTANCE
// Runs every 30 minutes: auto-assigns cases, checks
// idle bots, manages spawning/evolution/natural selection,
// and generates fleet status reports
// ============================================

import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { workerBotEngine } from "../services/WorkerBotEngine.js";
import { workerBotSpawner } from "../services/WorkerBotSpawner.js";

/**
 * Main worker bot fleet cron — runs every 30 minutes
 *
 * 1. Check for idle worker bots that should be working
 * 2. Auto-assign unworked cases to available bots
 * 3. Check if spawning is needed (workload analysis)
 * 4. Process evolution candidates
 * 5. Run natural selection on underperformers
 * 6. Generate fleet status report
 * 7. Log everything to BotRunLog
 */
export async function runWorkerBotCron(): Promise<void> {
  const startTime = Date.now();
  let idleBotsActivated = 0;
  let casesAssigned = 0;
  let botsSpawned = 0;
  let botsEvolved = 0;
  let botsRetired = 0;
  let errorsEncountered = 0;

  try {
    // Check if worker bot fleet is enabled
    const fleetToggle = await prisma.founderConfig.findUnique({
      where: { key: "worker_bot_fleet_enabled" },
    });
    if (fleetToggle && (fleetToggle.value as any) === false) {
      logger.info("[WorkerBotCron] Fleet disabled by founder config — skipping");
      return;
    }

    // --- 1. CHECK FOR IDLE BOTS ---
    try {
      const fleetStatus = await workerBotEngine.getFleetStatus();
      const idleBots = Array.isArray(fleetStatus)
        ? fleetStatus.filter((bot: any) => bot.status === "IDLE" || bot.status === "STANDBY")
        : [];

      if (idleBots.length > 0) {
        logger.info(`[WorkerBotCron] ${idleBots.length} idle bot(s) detected — activating`);
        for (const bot of idleBots) {
          try {
            await workerBotEngine.deployBot(bot.codename, "SYSTEM_CRON");
            idleBotsActivated++;
          } catch (botErr: any) {
            logger.warn(`[WorkerBotCron] Failed to activate idle bot ${bot.codename}: ${botErr.message}`);
            errorsEncountered++;
          }
        }
      }
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Idle bot check error: ${err.message}`);
      errorsEncountered++;
    }

    // --- 2. AUTO-ASSIGN UNWORKED CASES ---
    try {
      const unworkedCases = await prisma.case.findMany({
        where: {
          status: { in: ["NEW", "CONTACTED"] },
          assignedEmployeeId: null,
        },
        select: { id: true },
        take: 50, // Process in batches of 50
        orderBy: { createdAt: "asc" },
      });

      if (unworkedCases.length > 0) {
        const caseIds = unworkedCases.map((c) => c.id);
        logger.info(`[WorkerBotCron] ${caseIds.length} unworked case(s) found — auto-assigning`);
        try {
          const assignResult = await workerBotEngine.assignCases(caseIds, "SYSTEM_CRON");
          casesAssigned = assignResult?.assignedCount ?? caseIds.length;
          logger.info(`[WorkerBotCron] Successfully assigned ${casesAssigned} case(s) to bots`);
        } catch (assignErr: any) {
          logger.error(`[WorkerBotCron] Case assignment error: ${assignErr.message}`);
          errorsEncountered++;
        }
      }
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Unworked case query error: ${err.message}`);
      errorsEncountered++;
    }

    // --- 3. CHECK IF SPAWNING IS NEEDED ---
    try {
      const recommendations = await workerBotSpawner.getSpawnRecommendations();
      const urgent = Array.isArray(recommendations)
        ? recommendations.filter((r: any) => r.priority === "HIGH" || r.priority === "CRITICAL")
        : [];

      if (urgent.length > 0) {
        logger.info(`[WorkerBotCron] ${urgent.length} urgent spawn recommendation(s) — processing`);
        for (const rec of urgent) {
          try {
            await workerBotSpawner.spawn(rec.parentCodename, rec.suggestedSpecialization);
            botsSpawned++;
            logger.info(`[WorkerBotCron] Spawned new bot: ${rec.suggestedSpecialization} from ${rec.parentCodename}`);
          } catch (spawnErr: any) {
            logger.warn(`[WorkerBotCron] Spawn failed for ${rec.suggestedSpecialization}: ${spawnErr.message}`);
            errorsEncountered++;
          }
        }
      }
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Spawn check error: ${err.message}`);
      errorsEncountered++;
    }

    // --- 4. PROCESS EVOLUTION CANDIDATES ---
    try {
      const populationStats = await workerBotSpawner.getPopulationStats();
      const evolutionCandidates = populationStats?.topPerformers ?? [];

      if (Array.isArray(evolutionCandidates) && evolutionCandidates.length > 0) {
        logger.info(`[WorkerBotCron] ${evolutionCandidates.length} evolution candidate(s) found`);
        for (const candidate of evolutionCandidates) {
          try {
            // Look up bot ID by codename since evolve() takes a bot ID
            const bot = await prisma.workerBot.findUnique({
              where: { codename: candidate.codename },
              select: { id: true },
            });
            if (!bot) continue;
            await workerBotSpawner.evolve(bot.id);
            botsEvolved++;
            logger.info(`[WorkerBotCron] Evolved bot: ${candidate.codename}`);
          } catch (evolveErr: any) {
            logger.warn(`[WorkerBotCron] Evolution failed for ${candidate.codename}: ${evolveErr.message}`);
            errorsEncountered++;
          }
        }
      }
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Evolution check error: ${err.message}`);
      errorsEncountered++;
    }

    // --- 5. RUN NATURAL SELECTION ---
    try {
      const selectionResult = await workerBotSpawner.naturalSelection();
      botsRetired = selectionResult?.terminated ?? 0;
      if (botsRetired > 0) {
        logger.info(`[WorkerBotCron] Natural selection retired ${botsRetired} underperforming bot(s)`);
      }
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Natural selection error: ${err.message}`);
      errorsEncountered++;
    }

    // --- 6. GENERATE FLEET STATUS REPORT ---
    let reportSummary = "";
    try {
      const [fleetStatus, revenueData, populationStats] = await Promise.all([
        workerBotEngine.getFleetStatus(),
        workerBotEngine.getRevenueAttribution(),
        workerBotSpawner.getPopulationStats(),
      ]);

      const totalBots = Array.isArray(fleetStatus) ? fleetStatus.length : 0;
      const activeBots = Array.isArray(fleetStatus)
        ? fleetStatus.filter((b: any) => b.status === "ACTIVE" || b.status === "WORKING").length
        : 0;
      const totalRevenue = revenueData?.totalRevenue ?? 0;
      const totalPopulation = populationStats?.totalBots ?? totalBots;

      reportSummary = `Fleet: ${activeBots}/${totalBots} active | Population: ${totalPopulation} | Revenue: $${totalRevenue} | Spawned: ${botsSpawned} | Evolved: ${botsEvolved} | Retired: ${botsRetired}`;
      logger.info(`[WorkerBotCron] Fleet Report — ${reportSummary}`);
    } catch (err: any) {
      logger.error(`[WorkerBotCron] Fleet report generation error: ${err.message}`);
      reportSummary = "Report generation failed";
      errorsEncountered++;
    }

    // --- 7. LOG TO BotRunLog ---
    const durationMs = Date.now() - startTime;

    await prisma.botRunLog.create({
      data: {
        botName: "workerBotFleetCron",
        runType: "scheduled",
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        success: errorsEncountered === 0,
        status: errorsEncountered === 0 ? "SUCCESS" : "PARTIAL",
        resultSummary: reportSummary,
        recordsProcessed: idleBotsActivated + casesAssigned + botsSpawned + botsEvolved + botsRetired,
        insightsGenerated: botsSpawned + botsEvolved,
        alertsCreated: botsRetired,
        errorsEncountered,
        summary: `Worker bot fleet cron completed in ${durationMs}ms`,
        details: {
          idleBotsActivated,
          casesAssigned,
          botsSpawned,
          botsEvolved,
          botsRetired,
          errorsEncountered,
          reportSummary,
        },
      },
    });

    logger.info(
      `[WorkerBotCron] Complete in ${durationMs}ms — idle activated: ${idleBotsActivated}, cases assigned: ${casesAssigned}, spawned: ${botsSpawned}, evolved: ${botsEvolved}, retired: ${botsRetired}, errors: ${errorsEncountered}`
    );
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error(`[WorkerBotCron] Fatal error: ${err.message}`);

    await prisma.botRunLog.create({
      data: {
        botName: "workerBotFleetCron",
        runType: "scheduled",
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        success: false,
        status: "FAILED",
        error: err.message,
        recordsProcessed: 0,
        insightsGenerated: 0,
        alertsCreated: 0,
        errorsEncountered: 1,
        summary: `Worker bot fleet cron failed after ${durationMs}ms: ${err.message}`,
        details: {
          idleBotsActivated,
          casesAssigned,
          botsSpawned,
          botsEvolved,
          botsRetired,
          fatalError: err.message,
        },
      },
    });
  }
}
