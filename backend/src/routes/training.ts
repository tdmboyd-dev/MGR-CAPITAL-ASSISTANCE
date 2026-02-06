// ============================================
// TRAINING API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready training management endpoints
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { trainingService } from "../services/TrainingService.js";

const router = Router();

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/training/modules - List all training modules (ADMIN)
 */
router.get("/modules", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const modules = trainingService.getAllModules();

    res.json({
      success: true,
      count: modules.length,
      data: modules
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training/modules/:id - Get specific module (ADMIN)
 */
router.get("/modules/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const module = trainingService.getModule(req.params.id);

    if (!module) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    res.json({
      success: true,
      data: module
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training/stats - Training statistics (ADMIN)
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const stats = await trainingService.getTrainingStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEE ROUTES — Self-service training
// ============================================

/**
 * GET /api/training - Get available modules for employee
 */
router.get("/", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const modules = trainingService.getAllModules();

    // Map to employee-safe view
    const safeModules = modules.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      hasQuiz: m.hasQuiz
    }));

    res.json({
      success: true,
      data: safeModules
    });
  } catch (error: any) {
    console.error("Training modules error:", error);
    res.status(500).json({ success: false, error: "Failed to load training modules" });
  }
});

/**
 * GET /api/training/progress - Get employee's training progress
 */
router.get("/progress", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const progress = await trainingService.getEmployeeProgress(req.user!.id);

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    console.error("Training progress error:", error);
    res.status(500).json({ success: false, error: "Failed to load training progress" });
  }
});

/**
 * GET /api/training/:moduleId - Get module content for employee
 */
router.get("/:moduleId", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const module = trainingService.getModuleForEmployee(moduleId);

    if (!module) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    // Mark as started
    await trainingService.startModule(req.user!.id, moduleId);

    res.json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error("Training module error:", error);
    res.status(500).json({ success: false, error: "Failed to load training module" });
  }
});

/**
 * POST /api/training/:moduleId/quiz - Submit quiz answers
 */
router.post("/:moduleId/quiz", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, error: "Answers array required" });
    }

    const result = await trainingService.submitQuiz(req.user!.id, moduleId, answers);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Quiz submission error:", error);
    res.status(500).json({ success: false, error: "Failed to submit quiz" });
  }
});

/**
 * POST /api/training/reset - Reset employee's training progress (ADMIN)
 */
router.post("/reset/:employeeId", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    await trainingService.resetProgress(employeeId);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TRAINING_RESET",
        entityType: "USER",
        entityId: employeeId,
        details: { resetBy: req.user!.id }
      }
    });

    res.json({
      success: true,
      message: "Training progress reset successfully"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
