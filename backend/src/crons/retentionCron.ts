// ============================================
// RETENTION CRON — Document Auto-Deletion Bot
// Runs daily: update retention dates, mark expired, purge approved
// ============================================

import { documentRetentionService } from "../services/DocumentRetentionService.js";
import logger from "../utils/logger.js";

export async function runRetentionCron(): Promise<void> {
  logger.info("[RetentionCron] Starting document retention cycle...");

  try {
    const result = await documentRetentionService.runFullCycle();

    logger.info("[RetentionCron] Cycle complete", {
      retentionUpdated: result.retentionUpdated,
      marked: result.marked,
      purged: result.purged,
      errors: result.errors,
    });
  } catch (error) {
    logger.error("[RetentionCron] Fatal error", { error: String(error) });
    throw error;
  }
}
