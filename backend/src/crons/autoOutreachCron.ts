// ============================================
// AUTO OUTREACH CRON — MGR CAPITAL ASSISTANCE
// Runs every 2 hours during business hours (8am-6pm)
// Processes cases in outreach pipeline
// Respects TCPA timing and daily limits
// ============================================

import { autoOutreachService } from "../services/AutoOutreachService.js";
import logger from "../utils/logger.js";

/**
 * Process pending outreach cases
 * Called by scheduler every 2 hours during business hours
 */
export async function runAutoOutreachCron(): Promise<void> {
  const startTime = Date.now();

  try {
    // Check business hours (8am-6pm)
    const hour = new Date().getHours();
    if (hour < 8 || hour >= 18) {
      logger.info("[AutoOutreachCron] Outside business hours (8am-6pm) — skipping");
      return;
    }

    logger.info("[AutoOutreachCron] Starting auto-outreach processing...");

    const result = await autoOutreachService.processPendingOutreach();

    const durationMs = Date.now() - startTime;
    const successCount = result.results.filter(r => r.actions.some(a => a.success)).length;
    const escalatedCount = result.results.filter(r => r.escalated).length;
    const totalCost = result.results.reduce((sum, r) => sum + r.totalCostCents, 0);

    logger.info("[AutoOutreachCron] Complete", {
      processed: result.processed,
      successful: successCount,
      escalated: escalatedCount,
      totalCostCents: totalCost,
      durationMs,
    });
  } catch (error: any) {
    logger.error("[AutoOutreachCron] Failed", { error: error.message, stack: error.stack });
    throw error; // Re-throw so scheduler can log to BotRunLog
  }
}
