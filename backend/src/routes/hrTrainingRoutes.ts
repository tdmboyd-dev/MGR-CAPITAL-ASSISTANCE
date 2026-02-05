// ============================================
// HR TRAINING ROUTES — MGR CAPITAL ASSISTANCE
// Training Intelligence API endpoints for HR Panel
// Protected: HR_ACCESS (FOUNDER, ADMIN, HR)
// ============================================

import { Router, Response } from "express";
import { AuthenticatedRequest, authMiddleware } from "../middleware/authMiddleware.js";
import { roleGuard, ROLE_GROUPS } from "../middleware/roleGuard.js";
import { trainingBot } from "../bots/trainingBot.js";
import { trainingIntelligenceService } from "../services/TrainingIntelligenceService.js";
import prisma from "../lib/prisma.js";
const router = Router();

// All HR training routes require authentication and HR_ACCESS role
router.use(authMiddleware);
router.use(roleGuard(ROLE_GROUPS.HR_ACCESS));

// ============================================
// TRAINING DASHBOARD
// ============================================

/**
 * GET /api/hr/training/dashboard
 * Get complete training intelligence dashboard data
 */
router.get("/dashboard", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const dashboardData = await trainingBot.getDashboard();

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error: any) {
    console.error("[HR Training] Dashboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUN BOT ANALYSIS
// ============================================

/**
 * POST /api/hr/training/analyze
 * Run full training intelligence analysis
 */
router.post("/analyze", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analysis = await trainingBot.analyze();

    res.json({
      success: true,
      data: {
        analysisDate: analysis.analysisDate,
        totalEmployees: analysis.totalEmployees,
        overallCompletionRate: analysis.overallCompletionRate,
        avgQuizScore: analysis.avgQuizScore,
        needsCoachingCount: analysis.needsCoaching.length,
        eligibleForPromotionCount: analysis.eligibleForPromotion.length,
        newModulesGenerated: analysis.newModulesGenerated.length,
        trainingCorrelation: analysis.trainingCorrelation,
        recommendations: analysis.recommendations,
        plainEnglish: analysis.plainEnglish,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Analysis error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEE TRAINING NEEDS
// ============================================

/**
 * GET /api/hr/training/employees
 * Get all employees with training status
 */
router.get("/employees", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const dashboardData = await trainingBot.getDashboard();

    res.json({
      success: true,
      data: {
        employees: dashboardData.employeeStatuses,
        totalCount: dashboardData.totalEmployees,
        overdueCount: dashboardData.overdueCount,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Employees list error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/training/employees/:id/needs
 * Get detailed training needs for specific employee
 */
router.get("/employees/:id/needs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const needs = await trainingIntelligenceService.analyzeContractorNeeds(id);

    if (!needs) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    res.json({
      success: true,
      data: needs,
    });
  } catch (error: any) {
    console.error("[HR Training] Employee needs error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/training/employees/:id/metrics
 * Get full contractor metrics for specific employee
 */
router.get("/employees/:id/metrics", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const metrics = await trainingIntelligenceService.getContractorMetrics(id);

    if (!metrics) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    // Filter out shadow accounting fields for non-founder
    const safeMetrics = {
      ...metrics,
      totalRevenueCents: undefined, // Hide actual revenue
      avgCaseValueCents: undefined, // Hide actual values
    };

    res.json({
      success: true,
      data: safeMetrics,
    });
  } catch (error: any) {
    console.error("[HR Training] Employee metrics error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/training/employees/:id/check
 * Quick training status check for employee
 */
router.get("/employees/:id/check", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const status = await trainingBot.checkEmployee(id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error("[HR Training] Employee check error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TIER PROGRESSION
// ============================================

/**
 * GET /api/hr/training/tier-progressions
 * Get all employees eligible for tier progression
 */
router.get("/tier-progressions", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const progressions = await trainingIntelligenceService.evaluateAllTierProgressions();

    res.json({
      success: true,
      data: {
        progressions,
        pendingReviewCount: progressions.filter((p) => p.status === "PENDING_REVIEW").length,
        eligibleCount: progressions.filter((p) => p.status === "REQUIREMENTS_MET").length,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Tier progressions error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/training/employees/:id/tier-eligibility
 * Check tier progression eligibility for specific employee
 */
router.get("/employees/:id/tier-eligibility", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const evaluation = await trainingBot.checkTierEligibility(id);

    if (!evaluation) {
      res.json({
        success: true,
        data: {
          eligible: false,
          message: "Employee is not eligible for tier progression or already at max tier",
        },
      });
      return;
    }

    // Hide actual revenue values (shadow accounting)
    const safeEvaluation = {
      ...evaluation,
      actualRevenueCents: undefined,
      displayedRevenueCents: evaluation.displayedRevenueCents, // Show displayed value only
    };

    res.json({
      success: true,
      data: safeEvaluation,
    });
  } catch (error: any) {
    console.error("[HR Training] Tier eligibility error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/training/tier-progressions/:logId/approve
 * Approve a tier progression (FOUNDER/ADMIN only)
 */
router.post("/tier-progressions/:logId/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const { notes } = req.body;

    // Check if user is FOUNDER or ADMIN
    if (!["FOUNDER", "ADMIN"].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: "Only FOUNDER or ADMIN can approve tier progressions" });
      return;
    }

    const progressionLog = await prisma.tierProgressionLog.findUnique({
      where: { id: logId },
    });

    if (!progressionLog) {
      res.status(404).json({ success: false, error: "Progression log not found" });
      return;
    }

    // Update progression log
    await prisma.tierProgressionLog.update({
      where: { id: logId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
        reviewNotes: notes,
        approvedAt: new Date(),
      },
    });

    // Update employee tier
    await prisma.user.update({
      where: { id: progressionLog.employeeId },
      data: {
        employeeTier: progressionLog.toTier,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TIER_PROMOTION_APPROVED",
        entityType: "USER",
        entityId: progressionLog.employeeId,
        details: {
          fromTier: progressionLog.fromTier,
          toTier: progressionLog.toTier,
          progressionLogId: logId,
        },
      },
    });

    res.json({
      success: true,
      message: `Employee promoted to ${progressionLog.toTier}`,
    });
  } catch (error: any) {
    console.error("[HR Training] Approve progression error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/training/tier-progressions/:logId/deny
 * Deny a tier progression (FOUNDER/ADMIN only)
 */
router.post("/tier-progressions/:logId/deny", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logId } = req.params;
    const { reason } = req.body;

    if (!["FOUNDER", "ADMIN"].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: "Only FOUNDER or ADMIN can deny tier progressions" });
      return;
    }

    if (!reason) {
      res.status(400).json({ success: false, error: "Denial reason is required" });
      return;
    }

    await prisma.tierProgressionLog.update({
      where: { id: logId },
      data: {
        status: "DENIED",
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
        deniedAt: new Date(),
        deniedReason: reason,
      },
    });

    res.json({
      success: true,
      message: "Tier progression denied",
    });
  } catch (error: any) {
    console.error("[HR Training] Deny progression error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TRAINING RECOMMENDATIONS
// ============================================

/**
 * GET /api/hr/training/recommendations
 * Get all pending training recommendations
 */
router.get("/recommendations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { priority, employeeId } = req.query;

    const where: any = {
      isCompleted: false,
      isDismissed: false,
    };

    if (priority) {
      where.priority = priority;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const recommendations = await prisma.trainingRecommendation.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    res.json({
      success: true,
      data: {
        recommendations,
        totalCount: recommendations.length,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Recommendations error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/training/recommendations/:id/assign
 * Assign a training recommendation to employee
 */
router.post("/recommendations/:id/assign", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { deadline } = req.body;

    const recommendation = await prisma.trainingRecommendation.findUnique({
      where: { id },
    });

    if (!recommendation) {
      res.status(404).json({ success: false, error: "Recommendation not found" });
      return;
    }

    // Update recommendation as accepted
    await prisma.trainingRecommendation.update({
      where: { id },
      data: {
        isAccepted: true,
        acceptedAt: new Date(),
        dueDate: deadline ? new Date(deadline) : null,
      },
    });

    // If there's a module ID, create/update training progress
    if (recommendation.moduleId) {
      await prisma.employeeTrainingProgress.upsert({
        where: {
          employeeId_moduleId: {
            employeeId: recommendation.employeeId,
            moduleId: recommendation.moduleId,
          },
        },
        create: {
          employeeId: recommendation.employeeId,
          moduleId: recommendation.moduleId,
          status: "AVAILABLE",
          deadline: deadline ? new Date(deadline) : null,
          assignedBy: req.user!.id,
          priority: recommendation.priority,
          isMandatory: recommendation.mandatory,
        },
        update: {
          status: "AVAILABLE",
          deadline: deadline ? new Date(deadline) : null,
          assignedBy: req.user!.id,
          priority: recommendation.priority,
          isMandatory: recommendation.mandatory,
        },
      });
    }

    res.json({
      success: true,
      message: "Training assigned successfully",
    });
  } catch (error: any) {
    console.error("[HR Training] Assign recommendation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/training/recommendations/:id/dismiss
 * Dismiss a training recommendation
 */
router.post("/recommendations/:id/dismiss", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await prisma.trainingRecommendation.update({
      where: { id },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
        dismissedReason: reason,
      },
    });

    res.json({
      success: true,
      message: "Recommendation dismissed",
    });
  } catch (error: any) {
    console.error("[HR Training] Dismiss recommendation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DYNAMIC MODULES
// ============================================

/**
 * GET /api/hr/training/dynamic-modules
 * Get all auto-generated training modules
 */
router.get("/dynamic-modules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive } = req.query;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const modules = await prisma.dynamicTrainingModule.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        modules,
        totalCount: modules.length,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Dynamic modules error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/training/dynamic-modules/:id
 * Get specific dynamic module details
 */
router.get("/dynamic-modules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const module = await prisma.dynamicTrainingModule.findUnique({
      where: { id },
    });

    if (!module) {
      res.status(404).json({ success: false, error: "Module not found" });
      return;
    }

    res.json({
      success: true,
      data: module,
    });
  } catch (error: any) {
    console.error("[HR Training] Get dynamic module error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/hr/training/dynamic-modules/:id
 * Update dynamic module (activate/deactivate)
 */
router.patch("/dynamic-modules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, title, description } = req.body;

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (title) updateData.title = title;
    if (description) updateData.description = description;

    await prisma.dynamicTrainingModule.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Module updated successfully",
    });
  } catch (error: any) {
    console.error("[HR Training] Update dynamic module error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MODULE STATISTICS
// ============================================

/**
 * GET /api/hr/training/modules/stats
 * Get statistics for all training modules
 */
router.get("/modules/stats", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const dashboardData = await trainingBot.getDashboard();

    res.json({
      success: true,
      data: {
        moduleStats: dashboardData.moduleStats,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Module stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TRAINING CONFIG (FOUNDER ONLY)
// ============================================

/**
 * GET /api/hr/training/config
 * Get training intelligence configuration
 */
router.get("/config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!["FOUNDER", "ADMIN"].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: "Only FOUNDER or ADMIN can view config" });
      return;
    }

    await trainingIntelligenceService.loadConfig();
    const config = trainingIntelligenceService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error("[HR Training] Get config error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/hr/training/config
 * Update training intelligence configuration
 */
router.patch("/config", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== "FOUNDER") {
      res.status(403).json({ success: false, error: "Only FOUNDER can update config" });
      return;
    }

    await trainingIntelligenceService.saveConfig(req.body);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TRAINING_CONFIG_UPDATED",
        entityType: "SYSTEM_CONFIG",
        entityId: "training.settings",
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({
      success: true,
      message: "Training configuration updated",
    });
  } catch (error: any) {
    console.error("[HR Training] Update config error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ALERTS
// ============================================

/**
 * GET /api/hr/training/alerts
 * Get training-related alerts
 */
router.get("/alerts", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const dashboardData = await trainingBot.getDashboard();

    res.json({
      success: true,
      data: {
        alerts: dashboardData.alerts,
        totalCount: dashboardData.alerts.length,
      },
    });
  } catch (error: any) {
    console.error("[HR Training] Alerts error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SEND TRAINING REMINDER
// ============================================

/**
 * POST /api/hr/training/employees/:id/remind
 * Send training reminder to employee
 */
router.post("/employees/:id/remind", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    // Get overdue/incomplete modules
    const incompleteModules = await prisma.employeeTrainingProgress.findMany({
      where: {
        employeeId: id,
        completedAt: null,
      },
      include: { module: { select: { title: true } } },
      take: 5,
    });

    const moduleNames = incompleteModules.map((p) => p.module.title).join(", ");

    // Log notification
    await prisma.notificationLog.create({
      data: {
        type: "EMAIL",
        status: "PENDING",
        toAddress: employee.email,
        toName: employee.name,
        subject: "Training Reminder - Action Required",
        bodyPreview: `You have incomplete training modules: ${moduleNames}`,
        bodyFull: `Hi ${employee.name},\n\nThis is a reminder that you have incomplete training modules that require your attention:\n\n${moduleNames}\n\nPlease complete these modules as soon as possible.\n\nThank you,\nMGR Capital Training Team`,
        relatedUserId: id,
      },
    });

    res.json({
      success: true,
      message: `Reminder sent to ${employee.name}`,
    });
  } catch (error: any) {
    console.error("[HR Training] Send reminder error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
