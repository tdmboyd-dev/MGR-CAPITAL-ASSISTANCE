// ============================================
// LEGAL API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready legal management endpoints
// FOUNDER ONLY — Legal strategy never exposed
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { legalService } from "../services/legalService.js";
import { getStateRule, STATE_RULES, getStatesWithFeeCaps, enforceStateFeeCap } from "../data/stateRules.js";

const router = Router();

// ============================================
// ALL ROUTES ARE FOUNDER ONLY
// Legal strategy must never be exposed
// ============================================

/**
 * GET /api/legal/states - Get all state rules
 */
router.get("/states", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const states = await legalService.getAllStateRules();

    res.json({
      success: true,
      count: states.length,
      data: states
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/states/:code - Get specific state rules
 */
router.get("/states/:code", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const stateRule = legalService.getStateRules(code.toUpperCase());

    if (!stateRule) {
      return res.status(404).json({ success: false, error: "State not found" });
    }

    res.json({
      success: true,
      data: stateRule
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/legal/deadlines/calculate - Calculate deadlines for a case
 */
router.post("/deadlines/calculate", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { stateCode, saleDate } = req.body;

    if (!stateCode || !saleDate) {
      return res.status(400).json({ success: false, error: "stateCode and saleDate required" });
    }

    const deadlines = legalService.calculateDeadlines(stateCode, new Date(saleDate));

    res.json({
      success: true,
      data: deadlines
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/deadlines - Get all upcoming deadlines
 */
router.get("/deadlines", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;
    const deadlines = await legalService.getUpcomingDeadlines(daysAhead);

    res.json({
      success: true,
      count: deadlines.length,
      data: deadlines
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/deadlines/urgent - Get urgent deadlines (within 30 days)
 */
router.get("/deadlines/urgent", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const urgentDeadlines = await legalService.getUpcomingDeadlines(30);

    res.json({
      success: true,
      count: urgentDeadlines.length,
      data: urgentDeadlines
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/compliance/:caseId - Check case compliance
 */
router.get("/compliance/:caseId", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const compliance = await legalService.checkCompliance(caseId);

    res.json({
      success: true,
      data: compliance
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/recommendations/:caseId - Get legal recommendations
 */
router.get("/recommendations/:caseId", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const recommendations = await legalService.getLegalRecommendations(caseId);

    res.json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/legal/documents/generate - Generate document for a case
 */
router.post("/documents/generate", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId, documentType, additionalVariables } = req.body;

    if (!caseId || !documentType) {
      return res.status(400).json({ success: false, error: "caseId and documentType required" });
    }

    const result = await legalService.generateCaseDocument(
      caseId,
      documentType,
      additionalVariables || {}
    );

    if (result.success) {
      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "DOCUMENT_GENERATED",
          entityType: "DOCUMENT",
          entityId: result.documentId || "",
          details: { caseId, documentType }
        }
      });
    }

    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/legal/documents/generate-all - Generate all required documents for a case
 */
router.post("/documents/generate-all", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ success: false, error: "caseId required" });
    }

    const result = await legalService.generateAllRequiredDocuments(caseId);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "ALL_DOCUMENTS_GENERATED",
        entityType: "CASE",
        entityId: caseId,
        details: {
          generated: result.generated,
          failed: result.failed
        }
      }
    });

    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/legal/rejection/analyze - Analyze rejection and suggest corrections
 */
router.post("/rejection/analyze", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { caseId, rejectionReason } = req.body;

    if (!caseId || !rejectionReason) {
      return res.status(400).json({ success: false, error: "caseId and rejectionReason required" });
    }

    const analysis = await legalService.analyzeRejection(caseId, rejectionReason);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/templates - Get available document templates
 */
router.get("/templates", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.documentTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        requiredFields: true,
        description: true
      }
    });

    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/legal/stats - Get legal statistics
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const [
      totalCases,
      casesWithDeadlines,
      urgentCases,
      expiredCases,
      documentsByType
    ] = await Promise.all([
      prisma.case.count(),
      prisma.deadline.count({ where: { completedAt: null } }),
      prisma.deadline.count({
        where: {
          completedAt: null,
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.deadline.count({
        where: {
          completedAt: null,
          dueDate: { lt: new Date() }
        }
      }),
      prisma.document.groupBy({
        by: ["type"],
        _count: true
      })
    ]);

    // Get cases by state
    const byState = await prisma.case.groupBy({
      by: ["state"],
      _count: true,
      orderBy: { _count: { state: "desc" } },
      take: 10
    });

    res.json({
      success: true,
      data: {
        totalCases,
        casesWithDeadlines,
        urgentDeadlines: urgentCases,
        expiredDeadlines: expiredCases,
        documentsByType: documentsByType.map(d => ({
          type: d.type,
          count: d._count
        })),
        topStates: byState.map(s => ({
          state: s.state,
          count: s._count
        }))
      }
    });
  } catch (error: any) {
    console.error("Legal error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

// ============================================
// FEE CAP ENFORCEMENT ENDPOINTS
// ============================================

/**
 * GET /api/legal/fee-caps - Get all states with fee caps
 */
router.get("/fee-caps", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const caps = getStatesWithFeeCaps();
    res.json({
      success: true,
      count: caps.length,
      data: caps
    });
  } catch (error: any) {
    console.error("Fee caps error:", error);
    res.status(500).json({ success: false, error: "An error occurred." });
  }
});

/**
 * POST /api/legal/fee-caps/check - Check fee cap for a specific state + amount
 * Body: { state, feePercent, surplusAmountCents }
 */
router.post("/fee-caps/check", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { state, feePercent, surplusAmountCents } = req.body;
    if (!state || feePercent === undefined || !surplusAmountCents) {
      return res.status(400).json({ success: false, error: "state, feePercent, and surplusAmountCents required" });
    }

    const result = enforceStateFeeCap(state, feePercent, surplusAmountCents);
    res.json({
      success: true,
      data: {
        state,
        requestedFeePercent: feePercent,
        ...result,
        surplusAmountCents,
        originalFeeCents: Math.round((surplusAmountCents * feePercent) / 100),
        cappedFeeCents: Math.round((surplusAmountCents * result.effectiveFeePercent) / 100),
      }
    });
  } catch (error: any) {
    console.error("Fee cap check error:", error);
    res.status(500).json({ success: false, error: "An error occurred." });
  }
});

export default router;
