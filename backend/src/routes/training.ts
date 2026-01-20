// ============================================
// TRAINING API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready training management endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { trainingService } from "../services/trainingService.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/training/modules - List all training modules (ADMIN)
 */
router.get("/modules", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const modules = await trainingService.getAvailableModules();

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
 * POST /api/training/modules - Create new training module (ADMIN)
 */
router.post("/modules", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, content, quizQuestions, passingScore, isRequired, orderIndex } = req.body;

    const module = await prisma.trainingModule.create({
      data: {
        name,
        description,
        content,
        quizQuestions,
        passingScore: passingScore || 80,
        isRequired: isRequired || false,
        orderIndex: orderIndex || 0,
        isActive: true
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TRAINING_MODULE_CREATED",
        entityType: "TRAINING_MODULE",
        entityId: module.id,
        details: { name, isRequired }
      }
    });

    res.status(201).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/training/modules/:id - Update training module (ADMIN)
 */
router.patch("/modules/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const module = await prisma.trainingModule.update({
      where: { id },
      data: updateData
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TRAINING_MODULE_UPDATED",
        entityType: "TRAINING_MODULE",
        entityId: id,
        details: { updatedFields: Object.keys(updateData) }
      }
    });

    res.json({
      success: true,
      data: module
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training/progress - Get all employee progress (ADMIN)
 */
router.get("/progress", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const progress = await prisma.trainingProgress.findMany({
      include: {
        employee: {
          select: { id: true, name: true, email: true, tier: true }
        },
        module: {
          select: { id: true, name: true, isRequired: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    // Group by employee
    const byEmployee: Record<string, any> = {};
    for (const p of progress) {
      if (!byEmployee[p.employeeId]) {
        byEmployee[p.employeeId] = {
          employee: p.employee,
          modules: []
        };
      }
      byEmployee[p.employeeId].modules.push({
        module: p.module,
        status: p.status,
        score: p.quizScore,
        startedAt: p.startedAt,
        completedAt: p.completedAt
      });
    }

    res.json({
      success: true,
      data: Object.values(byEmployee)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training/progress/:employeeId - Get specific employee progress (ADMIN)
 */
router.get("/progress/:employeeId", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const progress = await trainingService.getEmployeeProgress(employeeId);

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/enroll/:employeeId/:moduleId - Enroll employee in module (ADMIN)
 */
router.post("/enroll/:employeeId/:moduleId", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, moduleId } = req.params;

    await trainingService.enrollEmployee(employeeId, moduleId);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "EMPLOYEE_ENROLLED",
        entityType: "TRAINING_PROGRESS",
        entityId: `${employeeId}-${moduleId}`,
        details: { employeeId, moduleId }
      }
    });

    res.json({
      success: true,
      message: "Employee enrolled successfully"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/enroll-all/:employeeId - Enroll employee in all required modules (ADMIN)
 */
router.post("/enroll-all/:employeeId", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const modules = await trainingService.getAvailableModules();
    const requiredModules = modules.filter(m => m.isRequired);

    for (const module of requiredModules) {
      await trainingService.enrollEmployee(employeeId, module.id);
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "EMPLOYEE_ENROLLED_ALL",
        entityType: "USER",
        entityId: employeeId,
        details: { moduleCount: requiredModules.length }
      }
    });

    res.json({
      success: true,
      message: `Employee enrolled in ${requiredModules.length} required modules`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training/stats - Get training statistics (ADMIN)
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const [
      totalModules,
      totalEnrollments,
      completedEnrollments,
      avgScore
    ] = await Promise.all([
      prisma.trainingModule.count({ where: { isActive: true } }),
      prisma.trainingProgress.count(),
      prisma.trainingProgress.count({ where: { status: "COMPLETED" } }),
      prisma.trainingProgress.aggregate({
        where: { quizScore: { not: null } },
        _avg: { quizScore: true }
      })
    ]);

    // Get completion by module
    const byModule = await prisma.trainingProgress.groupBy({
      by: ["moduleId", "status"],
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalModules,
        totalEnrollments,
        completedEnrollments,
        completionRate: totalEnrollments > 0
          ? ((completedEnrollments / totalEnrollments) * 100).toFixed(1)
          : "0",
        averageScore: avgScore._avg.quizScore?.toFixed(1) || "N/A",
        byModule
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/seed - Seed default training modules (ADMIN)
 */
router.post("/seed", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    await trainingService.seedTrainingModules();

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TRAINING_MODULES_SEEDED",
        entityType: "TRAINING_MODULE",
        entityId: "all",
        details: { seeded: true }
      }
    });

    res.json({
      success: true,
      message: "Training modules seeded successfully"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
