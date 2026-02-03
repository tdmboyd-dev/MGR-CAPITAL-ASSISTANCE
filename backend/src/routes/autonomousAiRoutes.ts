// ============================================
// AUTONOMOUS AI ROUTES — MGR CAPITAL ASSISTANCE
// Next-generation AI capabilities
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { autonomousIntelligenceService } from "../services/AutonomousIntelligenceService.js";

const router = Router();

// ============================================
// PREDICTIVE ORACLE
// ============================================

/**
 * GET /api/ai-oracle/case/:caseId/prediction — Predict case outcome
 */
router.get(
  "/case/:caseId/prediction",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = await autonomousIntelligenceService.predictCaseOutcome(req.params.caseId);
    res.json({ success: true, data: prediction });
  })
);

// ============================================
// NEGOTIATION ENGINE
// ============================================

/**
 * POST /api/ai-oracle/negotiation/strategy — Generate negotiation strategy
 */
router.post(
  "/negotiation/strategy",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, caseId, targetAmount } = req.body;

    if (!targetType || !caseId || !targetAmount) {
      throw Errors.badRequest("targetType, caseId, and targetAmount required");
    }

    const strategy = await autonomousIntelligenceService.createNegotiationStrategy(
      targetType,
      caseId,
      targetAmount
    );

    res.json({ success: true, data: strategy });
  })
);

// ============================================
// EMOTIONAL INTELLIGENCE
// ============================================

/**
 * GET /api/ai-oracle/emotional/:userId — Analyze emotional state
 */
router.get(
  "/emotional/:userId",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await autonomousIntelligenceService.analyzeEmotionalState(req.params.userId);
    res.json({ success: true, data: profile });
  })
);

// ============================================
// DOCUMENT VERIFICATION
// ============================================

/**
 * GET /api/ai-oracle/document/:documentId/verify — Verify document authenticity
 */
router.get(
  "/document/:documentId/verify",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await autonomousIntelligenceService.verifyDocumentAuthenticity(req.params.documentId);
    res.json({ success: true, data: report });
  })
);

// ============================================
// REVENUE OPTIMIZATION
// ============================================

/**
 * GET /api/ai-oracle/revenue/optimize — Get revenue optimization suggestions
 */
router.get(
  "/revenue/optimize",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const optimizations = await autonomousIntelligenceService.analyzeRevenueOptimizations();
    res.json({ success: true, data: optimizations });
  })
);

// ============================================
// EMPLOYEE SUCCESS PREDICTION
// ============================================

/**
 * GET /api/ai-oracle/employee/:employeeId/predict — Predict employee success
 */
router.get(
  "/employee/:employeeId/predict",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = await autonomousIntelligenceService.predictEmployeeSuccess(req.params.employeeId);
    res.json({ success: true, data: prediction });
  })
);

// ============================================
// LEGAL STRATEGY
// ============================================

/**
 * GET /api/ai-oracle/case/:caseId/strategy — Get AI legal strategy
 */
router.get(
  "/case/:caseId/strategy",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const strategy = await autonomousIntelligenceService.synthesizeLegalStrategy(req.params.caseId);
    res.json({ success: true, data: strategy });
  })
);

// ============================================
// MARKET INTELLIGENCE
// ============================================

/**
 * GET /api/ai-oracle/market/intelligence — Get market intelligence
 */
router.get(
  "/market/intelligence",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const intelligence = await autonomousIntelligenceService.gatherMarketIntelligence();
    res.json({ success: true, data: intelligence });
  })
);

// ============================================
// ADAPTIVE TRAINING
// ============================================

/**
 * GET /api/ai-oracle/training/:employeeId/adaptive — Generate adaptive training
 */
router.get(
  "/training/:employeeId/adaptive",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const training = await autonomousIntelligenceService.generateAdaptiveTraining(req.params.employeeId);
    res.json({ success: true, data: training });
  })
);

// ============================================
// SELF-HEALING
// ============================================

/**
 * POST /api/ai-oracle/heal — Analyze and suggest fix for error
 */
router.post(
  "/heal",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { errorLog, stackTrace } = req.body;

    if (!errorLog) throw Errors.badRequest("errorLog required");

    const healing = await autonomousIntelligenceService.analyzeAndHealError(errorLog, stackTrace || "");
    res.json({ success: true, data: healing });
  })
);

export default router;
