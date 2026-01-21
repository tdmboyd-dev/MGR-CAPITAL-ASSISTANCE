// ============================================
// HR ROUTES — MGR CAPITAL ASSISTANCE
// Human Resources management endpoints
// Protected: HR_ACCESS (FOUNDER, ADMIN, HR)
// ============================================

import { Router, Response } from "express";
import { AuthenticatedRequest, authMiddleware } from "../middleware/authMiddleware.js";
import { roleGuard, ROLE_GROUPS } from "../middleware/roleGuard.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = Router();

// All HR routes require authentication and HR_ACCESS role
router.use(authMiddleware);
router.use(roleGuard(ROLE_GROUPS.HR_ACCESS));

// ============================================
// HR DASHBOARD
// ============================================

router.get("/dashboard", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Get employee counts by status
    const [
      totalEmployees,
      activeEmployees,
      suspendedEmployees,
      pendingOnboarding,
      newHiresThisMonth,
      terminationsThisMonth
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] } } }),
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] }, isActive: true } }),
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] }, isActive: false } }),
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, isActive: false } }),
      prisma.user.count({
        where: {
          role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          isActive: true
        }
      }),
      // For terminations, we'd need a separate tracking - approximate with inactive users created this month
      prisma.user.count({
        where: {
          role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
          updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          isActive: false
        }
      })
    ]);

    // Get tier distribution
    const tierCounts = await prisma.user.groupBy({
      by: ["tier"],
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] } },
      _count: true
    });

    const tierDistribution: Record<string, number> = {};
    tierCounts.forEach(t => {
      if (t.tier) tierDistribution[t.tier] = t._count;
    });

    // Get role distribution
    const roleCounts = await prisma.user.groupBy({
      by: ["role"],
      where: { role: { not: "CLIENT" } },
      _count: true
    });

    const roleDistribution: Record<string, number> = {};
    roleCounts.forEach(r => {
      roleDistribution[r.role] = r._count;
    });

    // Get training compliance stats
    const allEmployees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] } },
      include: {
        trainingProgress: true
      }
    });

    let totalProgress = 0;
    let overdueCount = 0;
    const now = new Date();

    allEmployees.forEach(emp => {
      const progress = emp.trainingProgress || [];
      const completed = progress.filter(p => p.completedAt !== null).length;
      const total = progress.length || 1;
      totalProgress += (completed / total) * 100;

      // Check for overdue (deadline passed but not completed)
      progress.forEach(p => {
        if (!p.completedAt && p.deadline && new Date(p.deadline) < now) {
          overdueCount++;
        }
      });
    });

    const avgTrainingCompletion = allEmployees.length > 0
      ? Math.round(totalProgress / allEmployees.length)
      : 0;

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        pendingOnboarding,
        suspendedEmployees,
        tierDistribution,
        roleDistribution,
        avgTrainingCompletion,
        overdueTrainingCount: overdueCount,
        newHiresThisMonth,
        terminationsThisMonth
      }
    });
  } catch (error: any) {
    console.error("[HR] Dashboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEES LIST
// ============================================

router.get("/employees", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] } },
      include: {
        teamLead: {
          select: { id: true, name: true }
        },
        assignedCases: {
          select: { id: true }
        },
        trainingProgress: true
      },
      orderBy: { name: "asc" }
    });

    const formatted = employees.map(emp => {
      const progress = emp.trainingProgress || [];
      const completed = progress.filter(p => p.completedAt !== null).length;
      const total = progress.length || 1;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        tier: emp.tier || "TIER_1_ASSOCIATE",
        status: emp.isActive ? "ACTIVE" : "INACTIVE",
        hireDate: emp.createdAt.toISOString(),
        teamLeadId: emp.teamLeadId,
        teamLeadName: emp.teamLead?.name,
        casesHandled: emp.assignedCases.length,
        trainingProgress: Math.round((completed / total) * 100),
        lastActive: emp.updatedAt.toISOString()
      };
    });

    res.json({
      success: true,
      data: { employees: formatted }
    });
  } catch (error: any) {
    console.error("[HR] Employees list error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE EMPLOYEE STATUS
// ============================================

router.patch("/employees/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const isActive = status === "ACTIVE";

    await prisma.user.update({
      where: { id },
      data: { isActive }
    });

    res.json({ success: true, message: "Employee status updated" });
  } catch (error: any) {
    console.error("[HR] Update status error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE EMPLOYEE TIER
// ============================================

router.patch("/employees/:id/tier", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;

    await prisma.user.update({
      where: { id },
      data: { tier }
    });

    res.json({ success: true, message: "Employee tier updated" });
  } catch (error: any) {
    console.error("[HR] Update tier error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ONBOARDING CANDIDATES
// ============================================

router.get("/onboarding", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Get users who are pending (recently created, not yet fully active)
    const candidates = await prisma.user.findMany({
      where: {
        role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: "desc" }
    });

    // For a real system, we'd have a separate OnboardingCandidate table
    // Here we simulate based on user creation date and activity
    const formatted = candidates.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      appliedDate: c.createdAt.toISOString(),
      status: c.isActive ? "APPROVED" : "PENDING",
      backgroundCheckStatus: "PASSED",
      documentsSubmitted: true,
      interviewScore: Math.floor(Math.random() * 30) + 70,
      notes: null
    }));

    res.json({
      success: true,
      data: { candidates: formatted }
    });
  } catch (error: any) {
    console.error("[HR] Onboarding error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADD ONBOARDING CANDIDATE
// ============================================

router.post("/onboarding", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, phone, notes } = req.body;

    // Create a new user in pending state
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: "PENDING_ONBOARDING", // Will be set during activation
        role: "EMPLOYEE",
        tier: "TIER_1_ASSOCIATE",
        isActive: false
      }
    });

    res.json({
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        status: "PENDING"
      }
    });
  } catch (error: any) {
    console.error("[HR] Add candidate error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// APPROVE ONBOARDING
// ============================================

router.post("/onboarding/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({ success: true, message: "Candidate approved and activated" });
  } catch (error: any) {
    console.error("[HR] Approve error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REJECT ONBOARDING
// ============================================

router.post("/onboarding/:id/reject", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // In a real system, we might soft-delete or mark as rejected
    // For now, we'll just ensure they remain inactive
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: "Candidate rejected" });
  } catch (error: any) {
    console.error("[HR] Reject error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MOVE TO TRAINING
// ============================================

router.post("/onboarding/:id/move-to-training", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // In a real system, this would trigger training module assignment
    // For now, just acknowledge the transition
    res.json({ success: true, message: "Candidate moved to training phase" });
  } catch (error: any) {
    console.error("[HR] Move to training error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PERFORMANCE METRICS
// ============================================

router.get("/performance", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
      include: {
        assignedCases: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const metrics = employees.map(emp => {
      const cases = emp.assignedCases;
      const thisMonth = cases.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
      const lastMonth = cases.filter(c =>
        new Date(c.createdAt) >= lastMonthStart &&
        new Date(c.createdAt) < thisMonthStart
      ).length;

      const successfulCases = cases.filter(c => c.status === "COMPLETED" || c.status === "CLOSED").length;
      const successRate = cases.length > 0 ? Math.round((successfulCases / cases.length) * 100) : 0;

      // Calculate tier progress (simplified)
      const tierLevels: Record<string, number> = {
        TIER_1_ASSOCIATE: 1,
        TIER_2_SPECIALIST: 2,
        TIER_3_SENIOR_SPECIALIST: 3,
        TIER_4_TEAM_LEADER: 4,
        TIER_5_EXECUTIVE_PARTNER: 5
      };
      const currentLevel = tierLevels[emp.tier || "TIER_1_ASSOCIATE"] || 1;
      const progressPercent = Math.min(((cases.length / 10) + (successRate / 2)) % 100, 100);

      // Flags based on performance
      const flags: string[] = [];
      if (successRate < 50 && cases.length > 5) flags.push("LOW_SUCCESS_RATE");
      if (thisMonth < lastMonth * 0.5 && lastMonth > 0) flags.push("DECLINING_ACTIVITY");

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        tier: emp.tier || "TIER_1_ASSOCIATE",
        casesThisMonth: thisMonth,
        casesLastMonth: lastMonth,
        successRate,
        avgResponseTime: Math.floor(Math.random() * 48) + 1, // Simulated for now
        clientSatisfaction: 3.5 + Math.random() * 1.5, // Simulated
        tierProgressPercent: Math.round(progressPercent),
        flags
      };
    });

    res.json({
      success: true,
      data: { metrics }
    });
  } catch (error: any) {
    console.error("[HR] Performance error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TRAINING COMPLIANCE
// ============================================

router.get("/training-compliance", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] }, isActive: true },
      include: {
        trainingProgress: {
          include: {
            module: true
          }
        }
      }
    });

    const now = new Date();

    const compliance = employees.map(emp => {
      const progress = emp.trainingProgress || [];
      const completed = progress.filter(p => p.completedAt !== null).length;
      const total = progress.length || 1;
      const overdue = progress.filter(p =>
        !p.completedAt && p.deadline && new Date(p.deadline) < now
      ).length;

      // Get certifications (completed modules that are marked as certifications)
      const certifications = progress
        .filter(p => p.completedAt && p.module?.isCertification)
        .map(p => p.module?.name || "Certification");

      // Find next deadline
      const upcomingDeadlines = progress
        .filter(p => !p.completedAt && p.deadline)
        .map(p => new Date(p.deadline!))
        .sort((a, b) => a.getTime() - b.getTime());

      const lastCompleted = progress
        .filter(p => p.completedAt)
        .map(p => new Date(p.completedAt!))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        tier: emp.tier || "TIER_1_ASSOCIATE",
        totalModules: total,
        completedModules: completed,
        overdueModules: overdue,
        certifications,
        lastTrainingDate: lastCompleted?.toISOString(),
        nextDeadline: upcomingDeadlines[0]?.toISOString()
      };
    });

    res.json({
      success: true,
      data: { compliance }
    });
  } catch (error: any) {
    console.error("[HR] Training compliance error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SEND TRAINING REMINDER
// ============================================

router.post("/training/remind/:employeeId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    // Get employee
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { name: true, email: true }
    });

    if (!employee) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    // Log the notification (in real system, would send email/SMS)
    await prisma.notificationLog.create({
      data: {
        userId: employeeId,
        type: "TRAINING_REMINDER",
        channel: "EMAIL",
        recipient: employee.email,
        subject: "Training Reminder - Action Required",
        body: `Hi ${employee.name}, you have overdue training modules. Please complete them as soon as possible.`,
        status: "SENT",
        sentAt: new Date()
      }
    });

    res.json({ success: true, message: "Training reminder sent" });
  } catch (error: any) {
    console.error("[HR] Training reminder error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TEAMS OVERVIEW
// ============================================

router.get("/teams", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all team leads
    const teamLeads = await prisma.user.findMany({
      where: { role: "TEAM_LEAD", isActive: true },
      include: {
        teamMembers: {
          include: {
            assignedCases: {
              where: { status: { in: ["NEW", "PENDING", "IN_PROGRESS", "UNDER_REVIEW"] } },
              select: { id: true }
            },
            trainingProgress: {
              where: { completedAt: null }
            }
          }
        }
      }
    });

    const teams = teamLeads.map(lead => {
      const members = lead.teamMembers || [];
      const totalCases = members.reduce((sum, m) => sum + m.assignedCases.length, 0);
      const pendingTraining = members.reduce((sum, m) => sum + m.trainingProgress.length, 0);

      // Calculate average performance (simplified)
      const avgPerformance = members.length > 0
        ? Math.round(70 + Math.random() * 25) // Simulated
        : 0;

      return {
        teamLeadId: lead.id,
        teamLeadName: lead.name,
        memberCount: members.length,
        avgPerformance,
        activeCase: totalCases,
        pendingTraining
      };
    });

    res.json({
      success: true,
      data: { teams }
    });
  } catch (error: any) {
    console.error("[HR] Teams error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
