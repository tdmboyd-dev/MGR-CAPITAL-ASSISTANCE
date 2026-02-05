// ============================================
// DOCUMENT RETENTION ROUTES — FOUNDER ONLY
// Auto-deletion lifecycle, state retention rules
// Only FOUNDER and RETENTION_BOT can delete
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { documentRetentionService } from "../services/DocumentRetentionService.js";

const router = Router();

// All routes require FOUNDER role
router.use(authMiddleware);
router.use(roleGuard(["FOUNDER"]));

// ============================================
// DASHBOARD
// ============================================

router.get(
  "/dashboard",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const dashboard = await documentRetentionService.getRetentionDashboard();
    res.json(dashboard);
  })
);

// ============================================
// STATE RETENTION RULES
// ============================================

router.get(
  "/rules",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const rules = documentRetentionService.getAllRetentionRules();
    res.json({ rules, defaultYears: 7 });
  })
);

// ============================================
// DOCUMENTS PENDING DELETION REVIEW
// ============================================

router.get(
  "/marked",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await documentRetentionService.getMarkedDocuments(page, limit);
    res.json(result);
  })
);

// ============================================
// DOCUMENTS IN RETENTION HOLD
// ============================================

router.get(
  "/hold",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await documentRetentionService.getRetentionHoldDocuments(page, limit);
    res.json(result);
  })
);

// ============================================
// APPROVE DELETIONS (bulk)
// ============================================

router.post(
  "/approve",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "documentIds array required" });
      return;
    }

    const result = await documentRetentionService.approveMarkedDeletions(
      documentIds,
      req.user!.userId
    );

    res.json({
      ...result,
      message: `${result.approved} documents approved for deletion`,
    });
  })
);

// ============================================
// REJECT DELETIONS (keep files, extend retention)
// ============================================

router.post(
  "/reject",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { documentIds, extendYears } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "documentIds array required" });
      return;
    }

    const result = await documentRetentionService.rejectDeletions(
      documentIds,
      req.user!.userId,
      extendYears || 1
    );

    res.json({
      ...result,
      message: `${result.rejected} documents returned to retention hold (extended ${extendYears || 1} year(s))`,
    });
  })
);

// ============================================
// MANUAL MARK FOR DELETION (FOUNDER only)
// ============================================

router.post(
  "/mark",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "documentIds array required" });
      return;
    }

    const result = await documentRetentionService.manualMarkForDeletion(
      documentIds,
      req.user!.userId
    );

    res.json({
      ...result,
      message: `${result.marked} documents marked for deletion`,
    });
  })
);

// ============================================
// RUN RETENTION CYCLE MANUALLY
// ============================================

router.post(
  "/run-cycle",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const result = await documentRetentionService.runFullCycle();
    res.json({
      ...result,
      message: `Retention cycle complete: ${result.retentionUpdated} updated, ${result.marked} marked, ${result.purged} purged`,
    });
  })
);

// ============================================
// APPROVE ALL MARKED (convenience)
// ============================================

router.post(
  "/approve-all",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const marked = await documentRetentionService.getMarkedDocuments(1, 1000);
    const allIds = marked.documents.map((d) => d.id);

    if (allIds.length === 0) {
      res.json({ approved: 0, message: "No documents pending deletion approval" });
      return;
    }

    const result = await documentRetentionService.approveMarkedDeletions(
      allIds,
      req.user!.userId
    );

    res.json({
      ...result,
      message: `${result.approved} documents approved for deletion (all marked)`,
    });
  })
);

export default router;
