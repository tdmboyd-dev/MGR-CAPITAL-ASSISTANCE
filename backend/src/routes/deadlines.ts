/**
 * Deadline Routes — MGR CAPITAL ASSISTANCE
 * State deadline tracking and compliance
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { stateDeadlineService } from "../services/StateDeadlineService.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /api/deadlines/states
 * Get all state rules
 */
router.get("/states", authenticate, async (_req, res) => {
  const states = stateDeadlineService.getAllStateRules();
  res.json({ states });
});

/**
 * GET /api/deadlines/states/:stateCode
 * Get rules for a specific state
 */
router.get("/states/:stateCode", authenticate, async (req, res) => {
  const { stateCode } = req.params;

  const rules = stateDeadlineService.getStateRules(stateCode);

  if (!rules) {
    return res.status(404).json({
      error: "State not found or no data available",
    });
  }

  res.json({ rules });
});

/**
 * GET /api/deadlines/no-surplus-states
 * Get list of states without surplus opportunities
 */
router.get("/no-surplus-states", authenticate, async (_req, res) => {
  const states = stateDeadlineService.getNoSurplusStates();
  res.json({ states });
});

/**
 * POST /api/deadlines/calculate
 * Calculate deadline for a case
 */
router.post("/calculate", authenticate, async (req, res) => {
  try {
    const { stateCode, referenceDate, caseId } = req.body;

    if (!stateCode || !referenceDate || !caseId) {
      return res.status(400).json({
        error: "Missing required fields: stateCode, referenceDate, caseId",
      });
    }

    // Check if state has surplus
    if (!stateDeadlineService.hasSurplusOpportunities(stateCode)) {
      return res.json({
        warning: `${stateCode} does not have tax sale surplus opportunities`,
        deadline: null,
      });
    }

    const deadline = stateDeadlineService.calculateDeadline(
      stateCode,
      new Date(referenceDate),
      caseId
    );

    if (!deadline) {
      return res.json({
        message: `${stateCode} has no specific deadline (may vary by county)`,
        deadline: null,
      });
    }

    res.json({
      deadline,
      daysRemaining: stateDeadlineService.getDaysRemaining(deadline),
      reminderSchedule: stateDeadlineService.getReminderSchedule(deadline),
    });
  } catch (error: any) {
    logger.error("Deadline calculation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deadlines/michigan-preauction
 * Calculate Michigan pre-auction deadline (special case)
 */
router.post("/michigan-preauction", authenticate, async (req, res) => {
  try {
    const { auctionYear, caseId } = req.body;

    if (!auctionYear || !caseId) {
      return res.status(400).json({
        error: "Missing required fields: auctionYear, caseId",
      });
    }

    const deadline = stateDeadlineService.calculateMichiganPreAuction(
      auctionYear,
      caseId
    );

    res.json({
      deadline,
      daysRemaining: stateDeadlineService.getDaysRemaining(deadline),
      reminderSchedule: stateDeadlineService.getReminderSchedule(deadline),
      warning: "CRITICAL: Missing this deadline forfeits ALL rights to surplus",
    });
  } catch (error: any) {
    logger.error("Michigan deadline calculation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deadlines/case/:caseId
 * Get all deadlines for a case
 */
router.get("/case/:caseId", authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;

    const deadlines = stateDeadlineService.getCaseDeadlines(caseId);

    res.json({
      deadlines,
      totalCount: deadlines.length,
      overdueCount: deadlines.filter((d) => d.status === "overdue").length,
      upcomingCount: deadlines.filter((d) => d.status === "upcoming" || d.status === "due_soon").length,
    });
  } catch (error: any) {
    logger.error("Case deadlines fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deadlines/upcoming
 * Get all upcoming deadlines
 */
router.get("/upcoming", authenticate, async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;

    const deadlines = stateDeadlineService.getUpcomingDeadlines(daysAhead);

    res.json({
      deadlines,
      totalCount: deadlines.length,
      criticalCount: deadlines.filter((d) => d.priority === "critical").length,
    });
  } catch (error: any) {
    logger.error("Upcoming deadlines fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deadlines/critical
 * Get critical deadlines (due within 7 days)
 */
router.get("/critical", authenticate, async (_req, res) => {
  try {
    const deadlines = stateDeadlineService.getCriticalDeadlines();

    res.json({
      deadlines,
      totalCount: deadlines.length,
    });
  } catch (error: any) {
    logger.error("Critical deadlines fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deadlines/overdue
 * Get overdue deadlines
 */
router.get("/overdue", authenticate, async (_req, res) => {
  try {
    const deadlines = stateDeadlineService.getOverdueDeadlines();

    res.json({
      deadlines,
      totalCount: deadlines.length,
    });
  } catch (error: any) {
    logger.error("Overdue deadlines fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deadlines/custom
 * Add a custom deadline
 */
router.post("/custom", authenticate, async (req, res) => {
  try {
    const { caseId, description, dueDate, state, type } = req.body;

    if (!caseId || !description || !dueDate || !state) {
      return res.status(400).json({
        error: "Missing required fields: caseId, description, dueDate, state",
      });
    }

    const deadline = stateDeadlineService.addCustomDeadline(
      caseId,
      description,
      new Date(dueDate),
      state,
      type || "custom"
    );

    res.status(201).json({
      success: true,
      deadline,
    });
  } catch (error: any) {
    logger.error("Custom deadline creation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/deadlines/:deadlineId/complete
 * Mark a deadline as completed
 */
router.patch("/:deadlineId/complete", authenticate, async (req, res) => {
  try {
    const { deadlineId } = req.params;

    const success = stateDeadlineService.completeDeadline(deadlineId);

    if (!success) {
      return res.status(404).json({ error: "Deadline not found" });
    }

    res.json({
      success: true,
      message: "Deadline marked as completed",
    });
  } catch (error: any) {
    logger.error("Deadline completion failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/deadlines/compliance/:stateCode
 * Get compliance checklist for a state
 */
router.get("/compliance/:stateCode", async (req, res) => {
  const { stateCode } = req.params;

  const checklist = stateDeadlineService.getComplianceChecklist(stateCode);

  if (checklist.length === 0) {
    return res.status(404).json({
      error: "State not found or no compliance requirements",
    });
  }

  res.json({ checklist });
});

/**
 * POST /api/deadlines/refresh
 * Refresh all deadline statuses
 */
router.post("/refresh", authenticate, async (_req, res) => {
  stateDeadlineService.refreshStatuses();
  res.json({ success: true, message: "Deadline statuses refreshed" });
});

export default router;
