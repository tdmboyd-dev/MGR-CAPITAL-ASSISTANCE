// ============================================
// BOT SUBSCRIPTION SERVICE — MGR CAPITAL ASSISTANCE
// Per-employee bot subscriptions with tier management
// Usage tracking, billing, founder auto-enable
// ============================================

import { PrismaClient, BotTier } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// Tier-to-bot mapping
const TIER_BOTS: Record<BotTier, string[]> = {
  STARTER: ["outreach", "compliance"],
  PROFESSIONAL: ["outreach", "compliance", "docket", "docs", "skipTrace"],
  ENTERPRISE: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal"],
  UNLIMITED: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal", "autopilot", "research"],
  FOUNDER: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal", "autopilot", "research"],
};

// Tier monthly cost in cents
const TIER_COSTS: Record<BotTier, number> = {
  STARTER: 5000,       // $50/mo
  PROFESSIONAL: 15000,  // $150/mo
  ENTERPRISE: 30000,    // $300/mo
  UNLIMITED: 50000,     // $500/mo
  FOUNDER: 0,           // Free
};

// Per-action costs in cents
export const ACTION_COSTS = {
  skip_trace: 50,       // $0.50
  sms_sent: 2,          // $0.02
  call_made: 10,        // $0.10 per minute
  email_sent: 0,        // $0.001 (rounded to 0)
  doc_generated: 5,     // $0.05
  property_research: 25, // $0.25
  ai_legal_task: 10,    // $0.10
};

class BotSubscriptionService {
  /**
   * Get or create subscription for a user.
   * Auto-creates FOUNDER tier for founder users.
   */
  async getOrCreateSubscription(userId: string) {
    // Check existing
    const existing = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (existing) return existing;

    // Check if user is a founder
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) throw new Error("User not found");

    const isFounder = user.role === "FOUNDER";
    const tier = isFounder ? "FOUNDER" : "STARTER";
    const enabledBots = TIER_BOTS[tier];
    const monthlyCostCents = TIER_COSTS[tier];

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);
    nextBillingDate.setHours(0, 0, 0, 0);

    const subscription = await prisma.botSubscription.create({
      data: {
        userId,
        tier,
        isActive: true,
        enabledBots,
        monthlyCostCents,
        nextBillingDate,
      },
    });

    logger.info(`Created ${tier} bot subscription for user ${userId}`);
    return subscription;
  }

  /**
   * Check if a user can use a specific bot
   */
  async canUseBot(userId: string, botName: string): Promise<boolean> {
    // Founders always have access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "FOUNDER") return true;

    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (!subscription) return false;

    // FOUNDER and UNLIMITED tiers always have access
    if (subscription.tier === "FOUNDER" || subscription.tier === "UNLIMITED") {
      return true;
    }

    const enabledBots = subscription.enabledBots as string[];
    return enabledBots.includes(botName);
  }

  /**
   * Log a bot usage action with cost
   */
  async logUsage(
    userId: string,
    botName: string,
    action: string,
    costCents: number = 0,
    caseId?: string,
    details?: any
  ) {
    return prisma.botUsageLog.create({
      data: {
        userId,
        botName,
        action,
        costCents,
        caseId,
        details,
      },
    });
  }

  /**
   * Charge monthly subscription cost
   */
  async chargeMonthlyCost(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const subscription = await prisma.botSubscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { id: true, name: true, role: true, aiCreditBalanceCents: true } } },
    });

    if (!subscription || !subscription.isActive) {
      return { success: false, message: "Subscription not found or inactive" };
    }

    // Founders don't pay
    if (subscription.tier === "FOUNDER" || subscription.user.role === "FOUNDER") {
      // Just advance billing date
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      nextBillingDate.setDate(1);

      await prisma.botSubscription.update({
        where: { id: subscriptionId },
        data: { nextBillingDate },
      });
      return { success: true, message: "Founder — no charge" };
    }

    const cost = subscription.monthlyCostCents;

    // Check balance (using AI credit balance as proxy for commission balance)
    if (subscription.user.aiCreditBalanceCents < cost) {
      // 7-day grace period — don't suspend immediately
      const gracePeriodEnd = new Date(subscription.nextBillingDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      if (new Date() > gracePeriodEnd) {
        await prisma.botSubscription.update({
          where: { id: subscriptionId },
          data: { isActive: false },
        });
        return { success: false, message: `Subscription suspended — insufficient balance for $${(cost / 100).toFixed(2)}` };
      }

      return { success: false, message: `Insufficient balance. Grace period until ${gracePeriodEnd.toISOString().split("T")[0]}` };
    }

    // Deduct from balance
    await prisma.user.update({
      where: { id: subscription.userId },
      data: {
        aiCreditBalanceCents: { decrement: cost },
      },
    });

    // Update subscription
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);

    await prisma.botSubscription.update({
      where: { id: subscriptionId },
      data: {
        totalChargedCents: { increment: cost },
        nextBillingDate,
      },
    });

    // Log to OpsInsight
    await prisma.opsInsight.create({
      data: {
        type: "SYSTEM_HEALTH",
        priority: "LOW",
        title: `Bot subscription charged: ${subscription.user.name}`,
        summary: `$${(cost / 100).toFixed(2)} charged for ${subscription.tier} tier`,
        details: { subscriptionId, tier: subscription.tier, amountCents: cost },
        plainEnglish: `Charged ${subscription.user.name} $${(cost / 100).toFixed(2)} for ${subscription.tier} bot subscription.`,
        recommendations: [],
        relatedCaseIds: [],
        relatedUserIds: [subscription.userId],
        relatedAlertIds: [],
        sourceBot: "botBillingCron",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`Charged $${(cost / 100).toFixed(2)} for bot subscription`, {
      userId: subscription.userId,
      tier: subscription.tier,
    });

    return { success: true, message: `Charged $${(cost / 100).toFixed(2)}` };
  }

  /**
   * Get usage summary for a user
   */
  async getUsageSummary(userId: string, month?: Date) {
    const startOfMonth = month ? new Date(month.getFullYear(), month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);

    const usageLogs = await prisma.botUsageLog.findMany({
      where: {
        userId,
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by bot
    const byBot: Record<string, { count: number; costCents: number; actions: Record<string, number> }> = {};
    for (const log of usageLogs) {
      if (!byBot[log.botName]) {
        byBot[log.botName] = { count: 0, costCents: 0, actions: {} };
      }
      byBot[log.botName].count++;
      byBot[log.botName].costCents += log.costCents;
      byBot[log.botName].actions[log.action] = (byBot[log.botName].actions[log.action] || 0) + 1;
    }

    const totalCostCents = usageLogs.reduce((sum: number, l: any) => sum + l.costCents, 0);

    return {
      month: startOfMonth.toISOString().slice(0, 7),
      totalActions: usageLogs.length,
      totalCostCents,
      byBot,
      recentActivity: usageLogs.slice(0, 20),
    };
  }

  /**
   * Subscribe a user to a tier
   */
  async subscribe(userId: string, tier: BotTier) {
    // Deactivate existing
    await prisma.botSubscription.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const enabledBots = TIER_BOTS[tier];
    const monthlyCostCents = TIER_COSTS[tier];

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);
    nextBillingDate.setHours(0, 0, 0, 0);

    return prisma.botSubscription.create({
      data: {
        userId,
        tier,
        isActive: true,
        enabledBots,
        monthlyCostCents,
        nextBillingDate,
      },
    });
  }

  /**
   * Update tier for existing subscription
   */
  async updateTier(userId: string, newTier: BotTier) {
    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (!subscription) {
      return this.subscribe(userId, newTier);
    }

    return prisma.botSubscription.update({
      where: { id: subscription.id },
      data: {
        tier: newTier,
        enabledBots: TIER_BOTS[newTier],
        monthlyCostCents: TIER_COSTS[newTier],
      },
    });
  }

  /**
   * Cancel subscription
   */
  async cancel(userId: string) {
    return prisma.botSubscription.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Get all subscriptions (founder view)
   */
  async getAllSubscriptions() {
    return prisma.botSubscription.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Toggle a subscription active/inactive (founder override)
   */
  async toggleSubscription(subscriptionId: string) {
    const sub = await prisma.botSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new Error("Subscription not found");

    return prisma.botSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: !sub.isActive },
    });
  }

  /**
   * Get tier info for display
   */
  getTierInfo() {
    return Object.entries(TIER_COSTS).map(([tier, costCents]) => ({
      tier,
      monthlyCostCents: costCents,
      monthlyPrice: `$${(costCents / 100).toFixed(0)}`,
      bots: TIER_BOTS[tier as BotTier],
    }));
  }
}

export const botSubscriptionService = new BotSubscriptionService();
export default botSubscriptionService;
