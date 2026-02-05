// ============================================
// WORKER BOT FLEET ROUTES — MGR CAPITAL ASSISTANCE
// Autonomous worker bot deployment, case assignment,
// spawning, evolution, and fleet management
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { workerBotEngine } from "../services/WorkerBotEngine.js";
import { workerBotSpawner } from "../services/WorkerBotSpawner.js";

const router = Router();
const founderOnly = [authMiddleware, roleGuard(["FOUNDER"])];

// ============================================
// FLEET MANAGEMENT
// ============================================

/** GET /fleet — Get all worker bot statuses */
router.get(
  "/fleet",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const fleet = await workerBotEngine.getFleetStatus();
    res.json({ success: true, data: fleet });
  })
);

/** POST /deploy — Deploy the full fleet */
router.post(
  "/deploy",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotEngine.deployFleet(req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /recall — Emergency recall all bots */
router.post(
  "/recall",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotEngine.recallFleet(req.user!.id);
    res.json({ success: true, data: result });
  })
);

// ============================================
// INDIVIDUAL BOT MANAGEMENT
// ============================================

/** GET /:codename — Get specific bot details */
router.get(
  "/:codename",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bot = await workerBotEngine.getBotDetails(req.params.codename);
    if (!bot) throw Errors.notFound("Worker bot");
    res.json({ success: true, data: bot });
  })
);

/** POST /:codename/deploy — Deploy specific bot */
router.post(
  "/:codename/deploy",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotEngine.deployBot(req.params.codename, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /:codename/recall — Recall specific bot */
router.post(
  "/:codename/recall",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotEngine.recallBot(req.params.codename, req.user!.id);
    res.json({ success: true, data: result });
  })
);

// ============================================
// CASE ASSIGNMENT & AUTO-WORK
// ============================================

/** POST /assign-cases — Assign cases to bots */
router.post(
  "/assign-cases",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseIds } = req.body;
    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      throw Errors.badRequest("caseIds must be a non-empty array");
    }
    const result = await workerBotEngine.assignCases(caseIds, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /auto-work — Let bots auto-pick cases and work */
router.post(
  "/auto-work",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotEngine.autoWork(req.user!.id);
    res.json({ success: true, data: result });
  })
);

// ============================================
// REPORTING & INSIGHTS
// ============================================

/** GET /revenue — Revenue attribution per bot */
router.get(
  "/revenue",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const revenue = await workerBotEngine.getRevenueAttribution();
    res.json({ success: true, data: revenue });
  })
);

/** GET /learnings — Learning insights across all bots */
router.get(
  "/learnings",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const learnings = await workerBotEngine.getLearningInsights();
    res.json({ success: true, data: learnings });
  })
);

/** GET /growth-report — Company growth report */
router.get(
  "/growth-report",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const report = await workerBotEngine.getGrowthReport();
    res.json({ success: true, data: report });
  })
);

// ============================================
// INDIVIDUAL BOT ACTIONS
// ============================================

/** POST /work-case — Work a full case */
router.post(
  "/work-case",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.workCase(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /hunt-leads — Hunt for new leads */
router.post(
  "/hunt-leads",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, county } = req.body;
    if (!state) throw Errors.badRequest("state is required");
    const result = await workerBotEngine.huntLeads(state, county, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /trace — Skip trace a case */
router.post(
  "/trace",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.skipTrace(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /outreach — Send outreach for a case */
router.post(
  "/outreach",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.sendOutreach(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /assemble-docs — Generate documents for a case */
router.post(
  "/assemble-docs",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.assembleDocs(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /track-payment — Track payment for a case */
router.post(
  "/track-payment",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.trackPayment(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /research — Research property for a case */
router.post(
  "/research",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.researchProperty(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

/** POST /analyze — Analyze strategy for a case */
router.post(
  "/analyze",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.body;
    if (!caseId) throw Errors.badRequest("caseId is required");
    const result = await workerBotEngine.analyzeStrategy(caseId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

// ============================================
// SPAWNING & EVOLUTION
// ============================================

/** POST /spawn — Spawn new sub-bot */
router.post(
  "/spawn",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { parentCodename, specialization } = req.body;
    if (!parentCodename || !specialization) {
      throw Errors.badRequest("parentCodename and specialization are required");
    }
    const result = await workerBotSpawner.spawn(parentCodename, specialization);
    res.json({ success: true, data: result });
  })
);

/** POST /evolve — Evolve a bot */
router.post(
  "/evolve",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { codename } = req.body;
    if (!codename) throw Errors.badRequest("codename is required");
    const result = await workerBotSpawner.evolve(codename);
    res.json({ success: true, data: result });
  })
);

/** POST /crossbreed — Merge two bots */
router.post(
  "/crossbreed",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { botId1, botId2 } = req.body;
    if (!botId1 || !botId2) {
      throw Errors.badRequest("botId1 and botId2 are required");
    }
    const result = await workerBotSpawner.crossBreed(botId1, botId2);
    res.json({ success: true, data: result });
  })
);

/** POST /natural-selection — Run natural selection */
router.post(
  "/natural-selection",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await workerBotSpawner.naturalSelection();
    res.json({ success: true, data: result });
  })
);

/** GET /spawn/recommendations — Get spawn recommendations */
router.get(
  "/spawn/recommendations",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const recommendations = await workerBotSpawner.getSpawnRecommendations();
    res.json({ success: true, data: recommendations });
  })
);

/** GET /population — Population stats */
router.get(
  "/population",
  ...founderOnly,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const population = await workerBotSpawner.getPopulationStats();
    res.json({ success: true, data: population });
  })
);

/** GET /:codename/lineage — Get bot lineage tree */
router.get(
  "/:codename/lineage",
  ...founderOnly,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const lineage = await workerBotSpawner.getLineage(req.params.codename);
    if (!lineage) throw Errors.notFound("Bot lineage");
    res.json({ success: true, data: lineage });
  })
);

export default router;
