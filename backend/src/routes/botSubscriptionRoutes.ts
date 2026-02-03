// ============================================
// BOT SUBSCRIPTION ROUTES — MGR CAPITAL ASSISTANCE
// Employee bot subscription management
// ============================================

import { Router, Request, Response } from "express";
import { authenticate, founderOnly } from "../middleware/auth.js";
import { botSubscriptionService } from "../services/BotSubscriptionService.js";
import { logger } from "../utils/logger.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/bot-subscriptions/tiers
 * Get available tiers and pricing
 */
router.get("/tiers", async (_req: Request, res: Response) => {
  try {
    const tiers = botSubscriptionService.getTierInfo();
    res.json({ success: true, tiers });
  } catch (error: any) {
    logger.error("Failed to get tier info", { error: error.message });
    res.status(500).json({ error: "Failed to get tier info" });
  }
});

/**
 * GET /api/bot-subscriptions/mine
 * Get current user's subscription + usage
 */
router.get("/mine", async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const subscription = await botSubscriptionService.getOrCreateSubscription(userId);
    const usage = await botSubscriptionService.getUsageSummary(userId);

    res.json({
      success: true,
      subscription,
      usage,
    });
  } catch (error: any) {
    logger.error("Failed to get subscription", { error: error.message });
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

/**
 * POST /api/bot-subscriptions/subscribe
 * Subscribe to a tier
 */
router.post("/subscribe", async (req: any, res: Response) => {
  try {
    const { tier } = req.body;
    if (!tier) {
      return res.status(400).json({ error: "Tier is required" });
    }

    const validTiers = ["STARTER", "PROFESSIONAL", "ENTERPRISE", "UNLIMITED"];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` });
    }

    const subscription = await botSubscriptionService.subscribe(req.user.id, tier);
    res.json({ success: true, subscription });
  } catch (error: any) {
    logger.error("Failed to subscribe", { error: error.message });
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

/**
 * PUT /api/bot-subscriptions/update-tier
 * Upgrade or downgrade tier
 */
router.put("/update-tier", async (req: any, res: Response) => {
  try {
    const { tier } = req.body;
    if (!tier) {
      return res.status(400).json({ error: "Tier is required" });
    }

    const subscription = await botSubscriptionService.updateTier(req.user.id, tier);
    res.json({ success: true, subscription });
  } catch (error: any) {
    logger.error("Failed to update tier", { error: error.message });
    res.status(500).json({ error: "Failed to update tier" });
  }
});

/**
 * DELETE /api/bot-subscriptions/cancel
 * Cancel subscription
 */
router.delete("/cancel", async (req: any, res: Response) => {
  try {
    await botSubscriptionService.cancel(req.user.id);
    res.json({ success: true, message: "Subscription cancelled" });
  } catch (error: any) {
    logger.error("Failed to cancel subscription", { error: error.message });
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

/**
 * GET /api/bot-subscriptions/usage
 * Get usage breakdown for current month
 */
router.get("/usage", async (req: any, res: Response) => {
  try {
    const month = req.query.month ? new Date(req.query.month as string) : undefined;
    const usage = await botSubscriptionService.getUsageSummary(req.user.id, month);
    res.json({ success: true, usage });
  } catch (error: any) {
    logger.error("Failed to get usage", { error: error.message });
    res.status(500).json({ error: "Failed to get usage" });
  }
});

/**
 * GET /api/bot-subscriptions/all
 * FOUNDER: Get all subscriptions overview
 */
router.get("/all", founderOnly, async (_req: Request, res: Response) => {
  try {
    const subscriptions = await botSubscriptionService.getAllSubscriptions();
    res.json({ success: true, subscriptions });
  } catch (error: any) {
    logger.error("Failed to get all subscriptions", { error: error.message });
    res.status(500).json({ error: "Failed to get all subscriptions" });
  }
});

/**
 * PUT /api/bot-subscriptions/:id/toggle
 * FOUNDER: Enable/disable a subscription
 */
router.put("/:id/toggle", founderOnly, async (req: Request, res: Response) => {
  try {
    const subscription = await botSubscriptionService.toggleSubscription(req.params.id);
    res.json({ success: true, subscription });
  } catch (error: any) {
    logger.error("Failed to toggle subscription", { error: error.message });
    res.status(500).json({ error: "Failed to toggle subscription" });
  }
});

export default router;
