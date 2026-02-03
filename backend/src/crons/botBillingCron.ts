// ============================================
// BOT BILLING CRON — MGR CAPITAL ASSISTANCE
// Runs 1st of each month
// Charges monthly subscription fee for active BotSubscriptions
// Suspends subscriptions if balance insufficient (7-day grace)
// ============================================

import { PrismaClient } from "@prisma/client";
import { botSubscriptionService } from "../services/BotSubscriptionService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

/**
 * Process monthly bot subscription billing
 * Called by scheduler on 1st of each month
 */
export async function runBotBillingCron(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("[BotBillingCron] Starting monthly bot subscription billing...");

    // Get all active subscriptions due for billing
    const now = new Date();
    const subscriptions = await prisma.botSubscription.findMany({
      where: {
        isActive: true,
        nextBillingDate: { lte: now },
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    let charged = 0;
    let failed = 0;
    let founderSkipped = 0;
    let suspended = 0;
    let totalRevenueCents = 0;

    for (const subscription of subscriptions) {
      try {
        // Skip founders — they don't pay
        if (subscription.tier === "FOUNDER" || subscription.user.role === "FOUNDER") {
          founderSkipped++;
          // Still advance billing date
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          nextBillingDate.setDate(1);
          await prisma.botSubscription.update({
            where: { id: subscription.id },
            data: { nextBillingDate },
          });
          continue;
        }

        const result = await botSubscriptionService.chargeMonthlyCost(subscription.id);

        if (result.success) {
          charged++;
          totalRevenueCents += subscription.monthlyCostCents;
          logger.info(`[BotBillingCron] Charged ${subscription.user.name}: ${result.message}`);
        } else {
          failed++;
          if (result.message.includes("suspended")) {
            suspended++;
          }
          logger.warn(`[BotBillingCron] Failed for ${subscription.user.name}: ${result.message}`);
        }
      } catch (error: any) {
        failed++;
        logger.error(`[BotBillingCron] Error processing ${subscription.user.name}`, { error: error.message });
      }
    }

    const durationMs = Date.now() - startTime;

    // Create summary OpsInsight
    await prisma.opsInsight.create({
      data: {
        type: "SYSTEM_HEALTH",
        priority: suspended > 0 ? "HIGH" : "LOW",
        title: "Monthly Bot Subscription Billing Complete",
        summary: `Processed ${subscriptions.length} subscriptions. Charged: ${charged}. Failed: ${failed}. Suspended: ${suspended}. Revenue: $${(totalRevenueCents / 100).toFixed(2)}.`,
        details: {
          totalSubscriptions: subscriptions.length,
          charged,
          failed,
          founderSkipped,
          suspended,
          totalRevenueCents,
          durationMs,
        },
        plainEnglish: `Monthly bot billing processed. ${charged} employees charged, totaling $${(totalRevenueCents / 100).toFixed(2)}. ${suspended > 0 ? `${suspended} subscriptions suspended for non-payment.` : "No suspensions."} ${founderSkipped} founder subscriptions (free).`,
        recommendations: suspended > 0 ? ["Review suspended subscriptions and contact affected employees"] : [],
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: "botBillingCron",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info("[BotBillingCron] Complete", {
      total: subscriptions.length,
      charged,
      failed,
      founderSkipped,
      suspended,
      totalRevenueCents,
      durationMs,
    });
  } catch (error: any) {
    logger.error("[BotBillingCron] Failed", { error: error.message, stack: error.stack });
    throw error;
  }
}
