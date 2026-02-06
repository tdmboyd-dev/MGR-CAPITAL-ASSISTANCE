// ============================================
// OPS METRICS ROUTES — MGR CAPITAL ASSISTANCE
// FOUNDER ONLY — All routes require FOUNDER role
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { opsMetricsService } from "../services/OpsMetricsService.js";
import { metaBot } from "../bots/metaBot.js";

const router = Router();

// All routes require authentication + FOUNDER role
router.use(authMiddleware);
router.use(roleGuard(["FOUNDER"]));

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/ops/metrics/dashboard
 * Comprehensive ops dashboard data
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const dashboard = await opsMetricsService.getOpsDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard data"
    });
  }
});

// ============================================
// INGESTION STATS
// ============================================

/**
 * GET /api/ops/metrics/ingestion
 * Get ingestion statistics
 * Query params: range (24h, 7d, 30d, 90d, all)
 */
router.get("/ingestion", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as "24h" | "7d" | "30d" | "90d" | "all") || "30d";
    const stats = await opsMetricsService.getIngestionStats(range);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Ingestion stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch ingestion statistics"
    });
  }
});

// ============================================
// PAYOUT STATS
// ============================================

/**
 * GET /api/ops/metrics/payouts
 * Get payout statistics
 * Query params: range (24h, 7d, 30d, 90d, all)
 */
router.get("/payouts", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as "24h" | "7d" | "30d" | "90d" | "all") || "30d";
    const stats = await opsMetricsService.getPayoutStats(range);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Payout stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payout statistics"
    });
  }
});

// ============================================
// CASE FUNNEL
// ============================================

/**
 * GET /api/ops/metrics/funnel
 * Get case funnel statistics
 */
router.get("/funnel", async (req: Request, res: Response) => {
  try {
    const stats = await opsMetricsService.getCaseFunnelStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Case funnel stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch case funnel statistics"
    });
  }
});

// ============================================
// TRAINING STATS
// ============================================

/**
 * GET /api/ops/metrics/training
 * Get training operations statistics
 */
router.get("/training", async (req: Request, res: Response) => {
  try {
    const stats = await opsMetricsService.getTrainingOpsStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Training stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch training statistics"
    });
  }
});

// ============================================
// JURISDICTION METRICS
// ============================================

/**
 * GET /api/ops/metrics/jurisdictions
 * Get jurisdiction volatility metrics
 * Query params: state (optional filter)
 */
router.get("/jurisdictions", async (req: Request, res: Response) => {
  try {
    const state = req.query.state as string | undefined;
    const metrics = await opsMetricsService.getJurisdictionMetrics(state);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error("Jurisdiction metrics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch jurisdiction metrics"
    });
  }
});

/**
 * POST /api/ops/metrics/jurisdictions/recalculate
 * Recalculate metrics for a jurisdiction
 * Body: { state, county? }
 */
router.post("/jurisdictions/recalculate", async (req: Request, res: Response) => {
  try {
    const { state, county } = req.body;

    if (!state) {
      return res.status(400).json({
        success: false,
        error: "State is required"
      });
    }

    const metrics = await opsMetricsService.recalculateJurisdictionMetrics(state, county);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error("Jurisdiction recalculation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to recalculate jurisdiction metrics"
    });
  }
});

// ============================================
// EMPLOYEE INTEGRITY
// ============================================

/**
 * GET /api/ops/metrics/employees/integrity
 * Get employee integrity scores
 */
router.get("/employees/integrity", async (req: Request, res: Response) => {
  try {
    const scores = await opsMetricsService.getEmployeeIntegrityScores();
    res.json({ success: true, data: scores });
  } catch (error: any) {
    console.error("Employee integrity error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employee integrity scores"
    });
  }
});

/**
 * POST /api/ops/metrics/employees/:id/recalculate
 * Recalculate integrity score for an employee
 */
router.post("/employees/:id/recalculate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await opsMetricsService.recalculateEmployeeIntegrity(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Employee integrity recalculation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to recalculate employee integrity"
    });
  }
});

// ============================================
// CASE HEATMAP
// ============================================

/**
 * GET /api/ops/metrics/heatmap
 * Get case heatmap data
 */
router.get("/heatmap", async (req: Request, res: Response) => {
  try {
    const heatmap = await opsMetricsService.getCaseHeatmap();
    res.json({ success: true, data: heatmap });
  } catch (error: any) {
    console.error("Heatmap fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch case heatmap"
    });
  }
});

/**
 * POST /api/ops/metrics/heatmap/update
 * Update heatmap for a jurisdiction
 * Body: { state, county? }
 */
router.post("/heatmap/update", async (req: Request, res: Response) => {
  try {
    const { state, county } = req.body;

    if (!state) {
      return res.status(400).json({
        success: false,
        error: "State is required"
      });
    }

    await opsMetricsService.updateCaseHeatmap(state, county);
    res.json({ success: true, message: "Heatmap updated" });
  } catch (error: any) {
    console.error("Heatmap update error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update heatmap"
    });
  }
});

// ============================================
// FOUNDER FOCUS FEED
// ============================================

/**
 * GET /api/ops/metrics/focus-feed
 * Get Founder Focus Feed
 * Query params: limit (default 20)
 */
router.get("/focus-feed", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const feed = await opsMetricsService.getFounderFocusFeed(limit);
    res.json({ success: true, data: feed });
  } catch (error: any) {
    console.error("Focus feed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch focus feed"
    });
  }
});

/**
 * POST /api/ops/metrics/focus-feed
 * Create a Focus Feed item
 * Body: { type, priority, title, summary, actionRequired?, relatedCaseId?, relatedUserId? }
 */
router.post("/focus-feed", async (req: Request, res: Response) => {
  try {
    const { type, priority, title, summary, actionRequired, relatedCaseId, relatedUserId } = req.body;

    if (!type || !priority || !title || !summary) {
      return res.status(400).json({
        success: false,
        error: "type, priority, title, and summary are required"
      });
    }

    const id = await opsMetricsService.createFocusItem({
      type,
      priority,
      title,
      summary,
      actionRequired,
      relatedCaseId,
      relatedUserId
    });

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error("Focus feed create error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create focus item"
    });
  }
});

/**
 * POST /api/ops/metrics/focus-feed/:id/dismiss
 * Dismiss a Focus Feed item
 */
router.post("/focus-feed/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await opsMetricsService.dismissFocusItem(id);
    res.json({ success: true, message: "Item dismissed" });
  } catch (error: any) {
    console.error("Focus feed dismiss error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to dismiss focus item"
    });
  }
});

// ============================================
// BOT PERFORMANCE
// ============================================

/**
 * GET /api/ops/metrics/bots
 * Get bot performance metrics from MetaBot
 */
router.get("/bots", async (req: Request, res: Response) => {
  try {
    const metrics = await metaBot.getBotMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error("Bot metrics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bot metrics"
    });
  }
});

/**
 * POST /api/ops/metrics/bots/analyze
 * Trigger a fresh bot performance analysis
 */
router.post("/bots/analyze", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const report = await metaBot.analyzeBotPerformance(days);
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Bot analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze bot performance"
    });
  }
});

export default router;
