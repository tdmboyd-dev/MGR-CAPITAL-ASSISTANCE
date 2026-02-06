/**
 * Alerts Chamber Routes — MGR CAPITAL ASSISTANCE
 *
 * Two chat interfaces:
 * 1. BotBuddy (FOUNDER) — Platform-wide alert dispatch
 * 2. KidBuddy (Child Company Owner) — Tenant-scoped alert dispatch
 *
 * KidBuddy is auto-provisioned by bots upon child company activation/payment.
 */

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { alertsChamberService } from "../services/AlertsChamberService.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =============================================================================
// FOUNDER — BotBuddy (Platform-wide)
// =============================================================================

/**
 * POST /api/alerts-chamber/message
 * Send a message to BotBuddy (FOUNDER ONLY)
 */
router.post("/message", roleGuard(["FOUNDER"]), async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ success: false, error: "Message content is required" });
    }

    const response = await alertsChamberService.processMessage(
      req.user!.id,
      content.trim()
    );

    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error("Alerts chamber error:", error);
    res.status(500).json({ success: false, error: "BotBuddy had a moment. Try again." });
  }
});

/**
 * GET /api/alerts-chamber/history
 * Get BotBuddy conversation history (FOUNDER ONLY)
 */
router.get("/history", roleGuard(["FOUNDER"]), async (req: AuthRequest, res: Response) => {
  try {
    const history = alertsChamberService.getHistory(req.user!.id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to load history" });
  }
});

/**
 * DELETE /api/alerts-chamber/history
 * Clear BotBuddy conversation history (FOUNDER ONLY)
 */
router.delete("/history", roleGuard(["FOUNDER"]), async (req: AuthRequest, res: Response) => {
  alertsChamberService.clearHistory(req.user!.id);
  res.json({ success: true, message: "History cleared" });
});

// =============================================================================
// CHILD COMPANY OWNER — KidBuddy (Tenant-scoped)
// =============================================================================

/**
 * GET /api/alerts-chamber/kidbuddy/status
 * Check if KidBuddy is provisioned for current user's child company
 */
router.get("/kidbuddy/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if user owns an active child company
    const childCompany = await prisma.childCompany.findFirst({
      where: { ownerId: userId, status: "ACTIVE" },
      select: {
        id: true,
        companyName: true,
        tenantId: true,
        // Check if KidBuddy is enabled (stored in FounderConfig)
      },
    });

    if (!childCompany) {
      return res.json({
        success: true,
        provisioned: false,
        reason: "No active child company found",
      });
    }

    // Check if KidBuddy feature is enabled for this company
    const kidBuddyConfig = await prisma.founderConfig.findUnique({
      where: { key: `kidbuddy_enabled_${childCompany.id}` },
    });

    const isEnabled = kidBuddyConfig?.value === true || (kidBuddyConfig?.value as any)?.enabled === true;

    res.json({
      success: true,
      provisioned: isEnabled,
      childCompanyId: childCompany.id,
      companyName: childCompany.companyName,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to check KidBuddy status" });
  }
});

/**
 * POST /api/alerts-chamber/kidbuddy/message
 * Send a message to KidBuddy (Child Company Owner)
 * Scoped to their own tenant only
 */
router.post("/kidbuddy/message", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ success: false, error: "Message content is required" });
    }

    // Verify user owns an active child company with KidBuddy enabled
    const childCompany = await prisma.childCompany.findFirst({
      where: { ownerId: userId, status: "ACTIVE" },
      select: { id: true, companyName: true, tenantId: true },
    });

    if (!childCompany || !childCompany.tenantId) {
      return res.status(403).json({
        success: false,
        error: "You don't have an active child company with KidBuddy",
      });
    }

    const kidBuddyConfig = await prisma.founderConfig.findUnique({
      where: { key: `kidbuddy_enabled_${childCompany.id}` },
    });
    const isEnabled = kidBuddyConfig?.value === true || (kidBuddyConfig?.value as any)?.enabled === true;

    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "KidBuddy is not enabled for your company. Contact the platform founder.",
      });
    }

    const response = await alertsChamberService.processMessageScoped(
      userId,
      childCompany.tenantId,
      childCompany.companyName,
      content.trim()
    );

    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error("KidBuddy error:", error);
    res.status(500).json({ success: false, error: "KidBuddy had a moment. Try again." });
  }
});

/**
 * GET /api/alerts-chamber/kidbuddy/history
 * Get KidBuddy conversation history
 */
router.get("/kidbuddy/history", async (req: AuthRequest, res: Response) => {
  try {
    const history = alertsChamberService.getHistory(req.user!.id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to load history" });
  }
});

/**
 * DELETE /api/alerts-chamber/kidbuddy/history
 * Clear KidBuddy conversation history
 */
router.delete("/kidbuddy/history", async (req: AuthRequest, res: Response) => {
  alertsChamberService.clearHistory(req.user!.id);
  res.json({ success: true, message: "History cleared" });
});

// =============================================================================
// BOT PROVISIONING — Auto-create KidBuddy upon payment
// =============================================================================

/**
 * POST /api/alerts-chamber/provision
 * Provision KidBuddy for a child company (called by bots or FOUNDER)
 * This is the endpoint bots call after payment is received
 */
router.post("/provision", roleGuard(["FOUNDER"]), async (req: AuthRequest, res: Response) => {
  try {
    const { childCompanyId } = req.body;

    if (!childCompanyId) {
      return res.status(400).json({ success: false, error: "childCompanyId is required" });
    }

    // Verify child company exists and is active
    const childCompany = await prisma.childCompany.findUnique({
      where: { id: childCompanyId },
      select: { id: true, companyName: true, status: true, ownerId: true },
    });

    if (!childCompany) {
      return res.status(404).json({ success: false, error: "Child company not found" });
    }

    // Enable KidBuddy via FounderConfig
    await prisma.founderConfig.upsert({
      where: { key: `kidbuddy_enabled_${childCompanyId}` },
      create: {
        key: `kidbuddy_enabled_${childCompanyId}`,
        value: { enabled: true, provisionedAt: new Date().toISOString(), provisionedBy: req.user!.id },
      },
      update: {
        value: { enabled: true, provisionedAt: new Date().toISOString(), provisionedBy: req.user!.id },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "KIDBUDDY_PROVISIONED",
        entityType: "CHILD_COMPANY",
        entityId: childCompanyId,
        details: { companyName: childCompany.companyName, ownerId: childCompany.ownerId },
      },
    });

    // Notify the child company owner
    await prisma.opsInsight.create({
      data: {
        source: "kidbuddy_provisioned",
        title: "KidBuddy Activated!",
        description: `KidBuddy has been activated for ${childCompany.companyName}. You can now use the Alerts Chamber to communicate with your team.`,
        severity: "INFO",
        relatedUserIds: [childCompany.ownerId],
        details: { isNotification: true, childCompanyId },
      },
    });

    res.json({
      success: true,
      message: `KidBuddy provisioned for ${childCompany.companyName}`,
    });
  } catch (error: any) {
    console.error("KidBuddy provision error:", error);
    res.status(500).json({ success: false, error: "Failed to provision KidBuddy" });
  }
});

/**
 * POST /api/alerts-chamber/deprovision
 * Disable KidBuddy for a child company (FOUNDER ONLY)
 */
router.post("/deprovision", roleGuard(["FOUNDER"]), async (req: AuthRequest, res: Response) => {
  try {
    const { childCompanyId } = req.body;

    if (!childCompanyId) {
      return res.status(400).json({ success: false, error: "childCompanyId is required" });
    }

    await prisma.founderConfig.upsert({
      where: { key: `kidbuddy_enabled_${childCompanyId}` },
      create: {
        key: `kidbuddy_enabled_${childCompanyId}`,
        value: { enabled: false, deprovisionedAt: new Date().toISOString() },
      },
      update: {
        value: { enabled: false, deprovisionedAt: new Date().toISOString() },
      },
    });

    res.json({ success: true, message: "KidBuddy deprovisioned" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to deprovision KidBuddy" });
  }
});

export default router;
