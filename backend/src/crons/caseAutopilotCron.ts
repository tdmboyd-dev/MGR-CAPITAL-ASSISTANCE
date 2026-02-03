// ============================================
// CASE AUTOPILOT CRON — MGR CAPITAL ASSISTANCE
// Runs every hour
// Advances autopilot-enabled cases through pipeline
// Logs all transitions to BotRunLog
// ============================================

import { caseAutopilotService } from "../services/CaseAutopilotService.js";
import logger from "../utils/logger.js";

/**
 * Process all autopilot-enabled cases
 * Called by scheduler every hour
 */
export async function runCaseAutopilotCron(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("[CaseAutopilotCron] Starting autopilot processing...");

    const result = await caseAutopilotService.processAllCases();

    const durationMs = Date.now() - startTime;

    logger.info("[CaseAutopilotCron] Complete", {
      processed: result.processed,
      advanced: result.advanced,
      durationMs,
    });

    if (result.advanced > 0) {
      logger.info(`[CaseAutopilotCron] Advanced ${result.advanced} cases:`, {
        transitions: result.results
          .filter(r => r.newStatus)
          .map(r => `${r.caseCode}: ${r.previousStatus} → ${r.newStatus}`),
      });
    }
  } catch (error: any) {
    logger.error("[CaseAutopilotCron] Failed", { error: error.message, stack: error.stack });
    throw error;
  }
}
