// ============================================
// EMPLOYEES API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready employee management endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, EmployeeTier } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { employeeService } from "../services/employeeService.js";
import { trainingService } from "../services/trainingService.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/employees - List all employees (FOUNDER ONLY)
 */
router.get("/", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeTier: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            assignedCases: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/stats - Employee performance stats (FOUNDER ONLY)
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        employeeTier: true,
        assignedCases: {
          select: {
            status: true,
            surplusAmountCents: true
          }
        }
      }
    });

    const stats = employees.map(emp => {
      const totalCases = emp.assignedCases.length;
      const paidCases = emp.assignedCases.filter(c => c.status === "PAID").length;
      const totalSurplus = emp.assignedCases
        .filter(c => c.status === "PAID")
        .reduce((sum, c) => sum + (c.surplusAmountCents || 0), 0);

      return {
        id: emp.id,
        name: emp.name,
        tier: emp.tier,
        totalCases,
        paidCases,
        conversionRate: totalCases > 0 ? ((paidCases / totalCases) * 100).toFixed(1) : "0",
        totalSurplusRecoveredCents: totalSurplus
      };
    });

    res.json({
      success: true,
      data: stats.sort((a, b) => b.paidCases - a.paidCases)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/leaderboard - Employee leaderboard (FOUNDER ONLY)
 */
router.get("/leaderboard", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: {
        id: true,
        name: true,
        employeeTier: true,
        assignedCases: {
          where: { status: "PAID" },
          select: {
            surplusAmountCents: true,
            actualFeeCents: true
          }
        },
        ledgerEntries: {
          where: { type: "COMMISSION" },
          select: { amountCents: true }
        }
      }
    });

    const leaderboard = employees.map(emp => {
      const casesCompleted = emp.assignedCases.length;
      const revenueCents = emp.assignedCases.reduce(
        (sum, c) => sum + (c.actualFeeCents || 0),
        0
      );

      return {
        id: emp.id,
        name: emp.name,
        tier: getTierDisplayName(emp.employeeTier || "TIER_1_ASSOCIATE"),
        casesCompleted,
        revenueCents
      };
    });

    // Sort by revenue
    leaderboard.sort((a, b) => b.revenueCents - a.revenueCents);

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/:id - Get employee details (FOUNDER ONLY)
 */
router.get("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const employee = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "EMPLOYEE"
      },
      include: {
        assignedCases: {
          select: {
            id: true,
            internalCode: true,
            status: true,
            surplusAmountCents: true,
            createdAt: true,
            client: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        },
        trainingProgress: {
          include: {
            module: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    // Get actual commission info (FOUNDER ONLY)
    const commissionInfo = employeeService.getCommissionInfo(employee.tier);

    res.json({
      success: true,
      data: {
        ...employee,
        passwordHash: undefined, // Don't expose
        commissionInfo: {
          displayedRate: commissionInfo.displayedRatePercent,
          actualRate: commissionInfo.actualRatePercent,
          overrideRate: commissionInfo.overridePercent
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/employees - Create new employee (FOUNDER ONLY)
 */
router.post("/", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, phone, tier, password } = req.body;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already in use" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password || "TempPassword123!", 12);

    const employee = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        role: "EMPLOYEE",
        tier: tier || "TIER_1_ASSOCIATE",
        passwordHash,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeTier: true,
        createdAt: true
      }
    });

    // Auto-enroll in required training
    const modules = await trainingService.getAvailableModules();
    const requiredModules = modules.filter(m => m.isRequired);

    for (const module of requiredModules) {
      await trainingService.enrollEmployee(employee.id, module.id);
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "EMPLOYEE_CREATED",
        entityType: "USER",
        entityId: employee.id,
        details: { email, tier }
      }
    });

    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/employees/:id - Update employee (FOUNDER ONLY)
 */
router.patch("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive } = req.body;

    const employee = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        isActive
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeTier: true,
        isActive: true
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "EMPLOYEE_UPDATED",
        entityType: "USER",
        entityId: id,
        details: { name, phone, isActive }
      }
    });

    res.json({
      success: true,
      data: employee
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/employees/:id/tier - Update employee tier (FOUNDER ONLY)
 */
router.patch("/:id/tier", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;

    const validTiers: EmployeeTier[] = [
      "TIER_1_ASSOCIATE",
      "TIER_2_SPECIALIST",
      "TIER_3_SENIOR_SPECIALIST",
      "TIER_4_TEAM_LEADER",
      "TIER_5_EXECUTIVE_PARTNER"
    ];

    if (!validTiers.includes(tier)) {
      return res.status(400).json({ success: false, error: "Invalid tier" });
    }

    const employee = await prisma.user.update({
      where: { id },
      data: { tier },
      select: {
        id: true,
        name: true,
        tier: true
      }
    });

    // Log tier change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "TIER_CHANGED",
        entityType: "USER",
        entityId: id,
        details: { newTier: tier }
      }
    });

    res.json({
      success: true,
      data: employee
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEE SELF-SERVICE ROUTES
// ============================================

/**
 * GET /api/employees/me - Get own profile (EMPLOYEE)
 */
router.get("/me", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeTier: true,
        createdAt: true,
        _count: {
          select: { assignedCases: true }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    // Get DISPLAYED commission rate (shadow accounting)
    const commissionInfo = employeeService.getCommissionInfo(employee.tier);

    res.json({
      success: true,
      data: {
        ...employee,
        tier: getTierDisplayName(employee.tier),
        commissionRate: `${commissionInfo.displayedRatePercent}%` // DISPLAYED, not actual
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/me/earnings - Get own earnings (EMPLOYEE)
 * Shows DISPLAYED earnings, not actual
 */
router.get("/me/earnings", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const earnings = await employeeService.getEmployeeEarnings(req.user!.id);

    res.json({
      success: true,
      data: earnings // Already filtered for shadow accounting
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/me/scripts/:caseId - Get call script for a case (EMPLOYEE)
 */
router.get("/me/scripts/:caseId", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    // Verify case is assigned to this employee
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        assignedEmployeeId: req.user!.id
      },
      include: {
        client: {
          select: { name: true }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found or not assigned to you" });
    }

    const script = employeeService.getCallScript(caseData.status, caseData.client.name);

    res.json({
      success: true,
      data: {
        status: caseData.status,
        script
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/employees/me/scripts/check - Check text for compliance (EMPLOYEE)
 */
router.post("/me/scripts/check", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: "Text required" });
    }

    const result = employeeService.checkCompliance(text);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/employees/me/calls/:caseId/log - Log a call (EMPLOYEE)
 */
router.post("/me/calls/:caseId/log", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { outcome, duration, notes } = req.body;

    // Verify case is assigned to this employee
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        assignedEmployeeId: req.user!.id
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found or not assigned to you" });
    }

    // Create communication record
    const communication = await prisma.communication.create({
      data: {
        caseId,
        userId: req.user!.id,
        type: "CALL",
        direction: "OUTBOUND",
        content: notes || "",
        outcome,
        duration
      }
    });

    // Get coaching feedback
    const feedback = employeeService.getCoachingFeedback(outcome, notes || "");

    res.json({
      success: true,
      data: {
        logged: true,
        communicationId: communication.id,
        coaching: feedback
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TRAINING ROUTES (EMPLOYEE)
// ============================================

/**
 * GET /api/employees/me/training - Get training modules (EMPLOYEE)
 */
router.get("/me/training", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const progress = await trainingService.getEmployeeProgress(req.user!.id);

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employees/me/training/:moduleId - Get module content (EMPLOYEE)
 */
router.get("/me/training/:moduleId", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const content = await trainingService.getModuleContent(moduleId);

    if (!content) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    // Mark as started if not already
    await trainingService.startModule(req.user!.id, moduleId);

    res.json({
      success: true,
      data: content
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/employees/me/training/:moduleId/quiz - Submit quiz answers (EMPLOYEE)
 */
router.post("/me/training/:moduleId/quiz", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTierDisplayName(tier: EmployeeTier): string {
  const names: Record<EmployeeTier, string> = {
    TIER_1_ASSOCIATE: "Associate",
    TIER_2_SPECIALIST: "Specialist",
    TIER_3_SENIOR_SPECIALIST: "Senior Specialist",
    TIER_4_TEAM_LEADER: "Team Leader",
    TIER_5_EXECUTIVE_PARTNER: "Executive Partner"
  };
  return names[tier] || "Unknown";
}

export default router;
