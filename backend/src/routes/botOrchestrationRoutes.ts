// ============================================
// BOT ORCHESTRATION ROUTES — MGR CAPITAL ASSISTANCE
// Pipeline execution, batch ops, contact intelligence,
// revenue forecasting, and auto-response management
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { botOrchestratorService } from "../services/BotOrchestratorService.js";
import { smartContactIntelligence } from "../services/SmartContactIntelligence.js";
import { revenueForecasterService } from "../services/RevenueForecasterService.js";
import { batchBotOperations } from "../services/BatchBotOperations.js";
import { autoResponseProcessor } from "../services/AutoResponseProcessor.js";

const router = Router();
const founderOnly = [authMiddleware, roleGuard(["FOUNDER"])];

// ============================================
// PIPELINE ROUTES
// ============================================

/** GET /pipelines — List all available pipeline definitions */
router.get(
  "/pipelines",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const pipelines = botOrchestratorService.getPipelineDefinitions();
    res.json({ success: true, data: pipelines });
  })
);

/** POST /pipelines/:pipelineId/execute — Execute a pipeline */
router.post(
  "/pipelines/:pipelineId/execute",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { pipelineId } = req.params;
    const { caseId, skipSteps, dryRun, maxCases } = req.body;
    const result = await botOrchestratorService.executePipeline(pipelineId, {
      caseId,
      employeeId: req.user!.id,
      skipSteps,
      dryRun,
      maxCases,
    });
    res.json({ success: true, data: result });
  })
);

/** GET /pipelines/active — Get all running pipelines */
router.get(
  "/pipelines/active",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const active = await botOrchestratorService.getActivePipelines();
    res.json({ success: true, data: active });
  })
);

/** GET /pipelines/history — Recent pipeline runs */
router.get(
  "/pipelines/history",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await botOrchestratorService.getPipelineHistory(limit);
    res.json({ success: true, data: history });
  })
);

/** GET /pipelines/:runId/status — Status of a specific run */
router.get(
  "/pipelines/:runId/status",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const status = await botOrchestratorService.getPipelineStatus(req.params.runId);
    if (!status) throw Errors.notFound("Pipeline run");
    res.json({ success: true, data: status });
  })
);

/** DELETE /pipelines/:runId — Cancel a running pipeline */
router.delete(
  "/pipelines/:runId",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await botOrchestratorService.cancelPipeline(req.params.runId);
    res.json({ success: true, data: result });
  })
);

// ============================================
// BATCH OPERATIONS
// ============================================

/** POST /batch/preflight — Preview batch operation */
router.post(
  "/batch/preflight",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { botName, filters } = req.body;
    if (!botName) throw Errors.badRequest("botName is required");
    const preview = await batchBotOperations.preflightCheck(botName, filters || {}, req.user!.id);
    res.json({ success: true, data: preview });
  })
);

/** POST /batch/execute — Run batch operation */
router.post(
  "/batch/execute",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { botName, filters } = req.body;
    if (!botName) throw Errors.badRequest("botName is required");
    const result = await batchBotOperations.runBatch(botName, filters || {}, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** GET /batch/active — Active batches */
router.get(
  "/batch/active",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const active = batchBotOperations.getActiveBatches();
    res.json({ success: true, data: active });
  })
);

/** GET /batch/history — Batch history */
router.get(
  "/batch/history",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const history = await batchBotOperations.getBatchHistory();
    res.json({ success: true, data: history });
  })
);

/** DELETE /batch/:batchId — Cancel batch */
router.delete(
  "/batch/:batchId",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = batchBotOperations.cancelBatch(req.params.batchId);
    res.json({ success: true, data: result });
  })
);

/** POST /batch/schedule — Schedule recurring batch */
router.post(
  "/batch/schedule",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { botName, filters, cronExpression } = req.body;
    if (!botName || !cronExpression) throw Errors.badRequest("botName and cronExpression are required");
    const result = await batchBotOperations.scheduleBatch(botName, filters || {}, req.user!.id, cronExpression);
    res.json({ success: true, data: result });
  })
);

/** GET /batch/scheduled — List scheduled batches */
router.get(
  "/batch/scheduled",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const scheduled = await batchBotOperations.getScheduledBatches();
    res.json({ success: true, data: scheduled });
  })
);

/** DELETE /batch/scheduled/:scheduleId — Cancel scheduled batch */
router.delete(
  "/batch/scheduled/:scheduleId",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await batchBotOperations.cancelScheduledBatch(req.params.scheduleId);
    res.json({ success: true, data: result });
  })
);

// ============================================
// CONTACT INTELLIGENCE
// ============================================

/** GET /intelligence/contact-patterns — Contact pattern analysis */
router.get(
  "/intelligence/contact-patterns",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const patterns = await smartContactIntelligence.analyzeContactPatterns();
    res.json({ success: true, data: patterns });
  })
);

/** GET /intelligence/optimal-time/:state — Optimal contact time for state */
router.get(
  "/intelligence/optimal-time/:state",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const timing = await smartContactIntelligence.getOptimalContactTime(req.params.state);
    res.json({ success: true, data: timing });
  })
);

/** GET /intelligence/strategy/:caseId — Recommended strategy for case */
router.get(
  "/intelligence/strategy/:caseId",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const strategy = await smartContactIntelligence.recommendStrategy(req.params.caseId);
    if (!strategy) throw Errors.notFound("Case");
    res.json({ success: true, data: strategy });
  })
);

/** GET /intelligence/metrics — Contact performance metrics */
router.get(
  "/intelligence/metrics",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const metrics = await smartContactIntelligence.getContactMetrics();
    res.json({ success: true, data: metrics });
  })
);

/** GET /intelligence/heatmap — Hour x Day contact heatmap */
router.get(
  "/intelligence/heatmap",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const heatmap = await smartContactIntelligence.getHeatmap();
    res.json({ success: true, data: heatmap });
  })
);

/** GET /intelligence/method-comparison — SMS vs Call vs Email comparison */
router.get(
  "/intelligence/method-comparison",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const comparison = await smartContactIntelligence.getMethodComparison();
    res.json({ success: true, data: comparison });
  })
);

// ============================================
// REVENUE FORECAST
// ============================================

/** GET /forecast/revenue/:days — Revenue forecast (30/60/90) */
router.get(
  "/forecast/revenue/:days",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt(req.params.days);
    if (isNaN(days) || days < 1) throw Errors.badRequest("days must be a positive integer");
    const forecast = await revenueForecasterService.forecastRevenue(days as 30 | 60 | 90);
    res.json({ success: true, data: forecast });
  })
);

/** GET /forecast/conversion-rates — Status conversion rates */
router.get(
  "/forecast/conversion-rates",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const rates = await revenueForecasterService.calculateConversionRates();
    res.json({ success: true, data: rates });
  })
);

/** GET /forecast/bot-roi — Bot ROI analysis */
router.get(
  "/forecast/bot-roi",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const roi = await revenueForecasterService.calculateBotROI();
    res.json({ success: true, data: roi });
  })
);

/** GET /forecast/trends/:months — Revenue trends */
router.get(
  "/forecast/trends/:months",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const months = parseInt(req.params.months);
    if (isNaN(months) || months < 1) throw Errors.badRequest("months must be a positive integer");
    const trends = await revenueForecasterService.getRevenueTrends(months);
    res.json({ success: true, data: trends });
  })
);

/** GET /forecast/cash-flow — Cash flow projection */
router.get(
  "/forecast/cash-flow",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const cashFlow = await revenueForecasterService.projectCashFlow();
    res.json({ success: true, data: cashFlow });
  })
);

/** GET /forecast/goals — Goal tracking */
router.get(
  "/forecast/goals",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const goals = await revenueForecasterService.trackGoals();
    res.json({ success: true, data: goals });
  })
);

// ============================================
// AUTO-RESPONSE
// ============================================

/** POST /auto-response/process — Manually process a message */
router.post(
  "/auto-response/process",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from, subject, body, method } = req.body;
    if (!from || !body || !method) {
      throw Errors.badRequest("from, body, and method are required");
    }
    const result = await autoResponseProcessor.processIncomingMessage(from, subject, body, method);
    res.json({ success: true, data: result });
  })
);

/** GET /auto-response/analytics — Response analytics */
router.get(
  "/auto-response/analytics",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const analytics = await autoResponseProcessor.getResponseAnalytics();
    res.json({ success: true, data: analytics });
  })
);

/** GET /auto-response/by-state — Responses by state */
router.get(
  "/auto-response/by-state",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const byState = await autoResponseProcessor.getResponsesByState();
    res.json({ success: true, data: byState });
  })
);

/** GET /auto-response/dnc — DNC list */
router.get(
  "/auto-response/dnc",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const dncList = await autoResponseProcessor.getDNCList();
    res.json({ success: true, data: dncList });
  })
);

/** POST /auto-response/dnc — Add to DNC list */
router.post(
  "/auto-response/dnc",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { phone, email, reason } = req.body;
    await autoResponseProcessor.addToDNC(phone, email, reason);
    res.json({ success: true, data: { phone, email, reason, added: true } });
  })
);

// NOTE: removeFromDNC is not implemented on AutoResponseProcessor.
// DNC removal would require a new service method. Route omitted to prevent TS errors.

// ============================================
// FEATURE TOGGLES
// ============================================

/** GET /toggles — Get ALL feature toggles from all services */
router.get(
  "/toggles",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const [orchestrator, intelligence, autoResponse] = await Promise.all([
      botOrchestratorService.getToggles(),
      smartContactIntelligence.getFeatureToggles(),
      autoResponseProcessor.getAllToggles(),
    ]);
    res.json({
      success: true,
      data: { orchestrator, intelligence, autoResponse },
    });
  })
);

/** PUT /toggles/:key — Set a toggle value */
router.put(
  "/toggles/:key",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) throw Errors.badRequest("value is required");
    const result = await botOrchestratorService.setToggle(key, value);
    res.json({ success: true, data: result });
  })
);

export default router;
