// ============================================
// COMPLIANCE ROUTES — MGR CAPITAL ASSISTANCE
// Compliance monitoring and audit endpoints
// Protected: COMPLIANCE_ACCESS (FOUNDER, ADMIN, COMPLIANCE)
// ============================================

import { Router, Response } from "express";
import { AuthenticatedRequest, authMiddleware } from "../middleware/authMiddleware.js";
import { roleGuard, ROLE_GROUPS } from "../middleware/roleGuard.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = Router();

// All compliance routes require authentication and COMPLIANCE_ACCESS role
router.use(authMiddleware);
router.use(roleGuard(ROLE_GROUPS.COMPLIANCE_ACCESS));

// ============================================
// COMPLIANCE DASHBOARD
// ============================================

router.get("/dashboard", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get audit log stats
    const [
      totalAuditLogs,
      recentAuditLogs,
      failedLoginAttempts,
      sensitiveAccessCount,
      documentAccessCount,
      flaggedActivities
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.auditLog.count({
        where: {
          action: "LOGIN_FAILED",
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: { in: ["VIEW_FINANCIAL", "EXPORT_DATA", "VIEW_CLIENT_DATA"] },
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: { startsWith: "DOCUMENT_" },
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          metadata: { path: ["flagged"], equals: true }
        }
      })
    ]);

    // Get case compliance stats
    const [
      totalCases,
      pendingReviewCases,
      overdueDocumentsCases,
      completedCases
    ] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.case.count({
        where: {
          status: { in: ["NEW", "PENDING", "IN_PROGRESS"] },
          updatedAt: { lt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.case.count({ where: { status: { in: ["COMPLETED", "CLOSED"] } } })
    ]);

    // Get payout compliance
    const [
      totalPayouts,
      pendingPayouts,
      reviewRequiredPayouts
    ] = await Promise.all([
      prisma.payout.count(),
      prisma.payout.count({ where: { status: "PENDING" } }),
      prisma.payout.count({
        where: {
          status: "PENDING",
          amountCents: { gte: 100000 } // $1000+ requires review
        }
      })
    ]);

    // Training compliance
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] }, isActive: true },
      include: { trainingProgress: true }
    });

    let compliantEmployees = 0;
    let overdueTrainingEmployees = 0;

    employees.forEach(emp => {
      const progress = emp.trainingProgress || [];
      const overdue = progress.filter(p =>
        !p.completedAt && p.deadline && new Date(p.deadline) < now
      ).length;

      if (overdue > 0) {
        overdueTrainingEmployees++;
      } else {
        compliantEmployees++;
      }
    });

    const trainingComplianceRate = employees.length > 0
      ? Math.round((compliantEmployees / employees.length) * 100)
      : 100;

    res.json({
      success: true,
      data: {
        auditStats: {
          totalLogs: totalAuditLogs,
          recentLogs: recentAuditLogs,
          failedLogins: failedLoginAttempts,
          sensitiveAccess: sensitiveAccessCount,
          documentAccess: documentAccessCount,
          flaggedActivities
        },
        caseCompliance: {
          total: totalCases,
          pendingReview: pendingReviewCases,
          overdueDocuments: overdueDocumentsCases,
          completed: completedCases,
          complianceRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
        },
        payoutCompliance: {
          total: totalPayouts,
          pending: pendingPayouts,
          reviewRequired: reviewRequiredPayouts
        },
        trainingCompliance: {
          totalEmployees: employees.length,
          compliant: compliantEmployees,
          overdue: overdueTrainingEmployees,
          complianceRate: trainingComplianceRate
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Dashboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AUDIT LOGS
// ============================================

router.get("/audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = "1", limit = "50", action, userId, startDate, endDate } = req.query;

    const where: any = {};

    if (action) {
      where.action = action as string;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string)
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          id: log.id,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          userId: log.userId,
          userName: log.user?.name,
          userEmail: log.user?.email,
          userRole: log.user?.role,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          metadata: log.metadata,
          createdAt: log.createdAt.toISOString()
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Audit logs error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CASE COMPLIANCE REPORT
// ============================================

router.get("/cases", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        documents: { select: { id: true, type: true, uploadedAt: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const now = new Date();

    const complianceReport = cases.map(c => {
      const daysSinceUpdate = Math.floor((now.getTime() - c.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
      const hasRequiredDocs = c.documents.length >= 2; // Simplified check
      const isOverdue = daysSinceUpdate > 14 && c.status !== "COMPLETED" && c.status !== "CLOSED";

      const complianceFlags: string[] = [];
      if (!hasRequiredDocs) complianceFlags.push("MISSING_DOCUMENTS");
      if (isOverdue) complianceFlags.push("OVERDUE");
      if (!c.assignedToId) complianceFlags.push("UNASSIGNED");
      if (daysSinceUpdate > 7) complianceFlags.push("STALE");

      return {
        id: c.id,
        internalId: c.internalId,
        clientName: c.client.name,
        status: c.status,
        assigneeName: c.assignedTo?.name || "Unassigned",
        documentsCount: c.documents.length,
        daysSinceUpdate,
        complianceFlags,
        isCompliant: complianceFlags.length === 0,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      };
    });

    res.json({
      success: true,
      data: {
        cases: complianceReport,
        summary: {
          total: cases.length,
          compliant: complianceReport.filter(c => c.isCompliant).length,
          nonCompliant: complianceReport.filter(c => !c.isCompliant).length,
          flagCounts: {
            missingDocuments: complianceReport.filter(c => c.complianceFlags.includes("MISSING_DOCUMENTS")).length,
            overdue: complianceReport.filter(c => c.complianceFlags.includes("OVERDUE")).length,
            unassigned: complianceReport.filter(c => c.complianceFlags.includes("UNASSIGNED")).length,
            stale: complianceReport.filter(c => c.complianceFlags.includes("STALE")).length
          }
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Cases error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEE COMPLIANCE REPORT
// ============================================

router.get("/employees", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD", "HR", "COMPLIANCE"] } },
      include: {
        assignedCases: { select: { id: true, status: true } },
        trainingProgress: {
          include: { module: true }
        }
      }
    });

    const now = new Date();

    const complianceReport = employees.map(emp => {
      const progress = emp.trainingProgress || [];
      const overdueTraining = progress.filter(p =>
        !p.completedAt && p.deadline && new Date(p.deadline) < now
      );
      const completedTraining = progress.filter(p => p.completedAt !== null).length;
      const totalTraining = progress.length;

      const complianceFlags: string[] = [];
      if (overdueTraining.length > 0) complianceFlags.push("OVERDUE_TRAINING");
      if (totalTraining > 0 && completedTraining / totalTraining < 0.5) complianceFlags.push("LOW_TRAINING_COMPLETION");
      if (!emp.isActive) complianceFlags.push("INACTIVE");

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        tier: emp.tier || "TIER_1_ASSOCIATE",
        isActive: emp.isActive,
        casesAssigned: emp.assignedCases.length,
        activeCases: emp.assignedCases.filter(c => !["COMPLETED", "CLOSED"].includes(c.status)).length,
        trainingCompleted: completedTraining,
        trainingTotal: totalTraining,
        overdueTrainingCount: overdueTraining.length,
        overdueModules: overdueTraining.map(t => t.module?.name || "Unknown"),
        complianceFlags,
        isCompliant: complianceFlags.length === 0
      };
    });

    res.json({
      success: true,
      data: {
        employees: complianceReport,
        summary: {
          total: employees.length,
          compliant: complianceReport.filter(e => e.isCompliant).length,
          nonCompliant: complianceReport.filter(e => !e.isCompliant).length,
          flagCounts: {
            overdueTraining: complianceReport.filter(e => e.complianceFlags.includes("OVERDUE_TRAINING")).length,
            lowTraining: complianceReport.filter(e => e.complianceFlags.includes("LOW_TRAINING_COMPLETION")).length,
            inactive: complianceReport.filter(e => e.complianceFlags.includes("INACTIVE")).length
          }
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Employees error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAYOUT COMPLIANCE REPORT
// ============================================

router.get("/payouts", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const payouts = await prisma.payout.findMany({
      include: {
        case: { select: { id: true, internalId: true } },
        employee: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const complianceReport = payouts.map(p => {
      const complianceFlags: string[] = [];

      // Flag high-value payouts
      if (p.amountCents >= 500000) complianceFlags.push("HIGH_VALUE");
      if (p.amountCents >= 100000 && p.status === "PENDING") complianceFlags.push("REQUIRES_REVIEW");

      // Flag old pending payouts
      const daysPending = Math.floor((Date.now() - p.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (p.status === "PENDING" && daysPending > 7) complianceFlags.push("STALE_PENDING");

      return {
        id: p.id,
        caseId: p.caseId,
        caseInternalId: p.case?.internalId,
        employeeId: p.employeeId,
        employeeName: p.employee.name,
        amountCents: p.amountCents,
        status: p.status,
        type: p.type,
        daysPending: p.status === "PENDING" ? daysPending : 0,
        complianceFlags,
        requiresReview: complianceFlags.includes("REQUIRES_REVIEW"),
        createdAt: p.createdAt.toISOString()
      };
    });

    res.json({
      success: true,
      data: {
        payouts: complianceReport,
        summary: {
          total: payouts.length,
          totalValueCents: payouts.reduce((sum, p) => sum + p.amountCents, 0),
          pendingCount: payouts.filter(p => p.status === "PENDING").length,
          requiresReviewCount: complianceReport.filter(p => p.requiresReview).length,
          highValueCount: complianceReport.filter(p => p.complianceFlags.includes("HIGH_VALUE")).length
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Payouts error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOCUMENT COMPLIANCE
// ============================================

router.get("/documents", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      include: {
        case: { select: { id: true, internalId: true, status: true } },
        uploadedBy: { select: { id: true, name: true } }
      },
      orderBy: { uploadedAt: "desc" },
      take: 100
    });

    const complianceReport = documents.map(doc => {
      const complianceFlags: string[] = [];

      // Check document type requirements
      if (!doc.type) complianceFlags.push("MISSING_TYPE");
      if (!doc.isVerified) complianceFlags.push("UNVERIFIED");

      return {
        id: doc.id,
        fileName: doc.fileName,
        type: doc.type,
        caseId: doc.caseId,
        caseInternalId: doc.case?.internalId,
        caseStatus: doc.case?.status,
        uploadedBy: doc.uploadedBy?.name || "System",
        isVerified: doc.isVerified,
        complianceFlags,
        uploadedAt: doc.uploadedAt.toISOString()
      };
    });

    res.json({
      success: true,
      data: {
        documents: complianceReport,
        summary: {
          total: documents.length,
          verified: documents.filter(d => d.isVerified).length,
          unverified: documents.filter(d => !d.isVerified).length,
          missingType: complianceReport.filter(d => d.complianceFlags.includes("MISSING_TYPE")).length
        }
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Documents error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FLAG ACTIVITY
// ============================================

router.post("/flag", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resourceType, resourceId, reason, severity } = req.body;

    // Log the flagging action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "COMPLIANCE_FLAG",
        resource: resourceType,
        resourceId,
        metadata: {
          reason,
          severity,
          flagged: true,
          flaggedBy: req.user!.name,
          flaggedAt: new Date().toISOString()
        }
      }
    });

    res.json({
      success: true,
      message: `${resourceType} flagged for compliance review`
    });
  } catch (error: any) {
    console.error("[Compliance] Flag error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GENERATE COMPLIANCE REPORT
// ============================================

router.post("/generate-report", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    // Generate a comprehensive compliance report
    const [auditLogs, cases, employees, payouts] = await Promise.all([
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            lte: endDate ? new Date(endDate) : new Date()
          }
        }
      }),
      prisma.case.count(),
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] } } }),
      prisma.payout.aggregate({
        _sum: { amountCents: true },
        _count: true
      })
    ]);

    const report = {
      id: `COMP-${Date.now()}`,
      type: reportType || "FULL",
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.name,
      period: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      },
      summary: {
        auditLogsReviewed: auditLogs,
        casesReviewed: cases,
        employeesReviewed: employees,
        payoutsReviewed: payouts._count,
        totalPayoutValue: payouts._sum.amountCents || 0
      },
      status: "GENERATED"
    };

    res.json({
      success: true,
      data: { report }
    });
  } catch (error: any) {
    console.error("[Compliance] Generate report error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RISK ASSESSMENT
// ============================================

router.get("/risk-assessment", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate various risk factors
    const [
      failedLogins,
      highValuePayouts,
      staleCases,
      overdueTraining,
      unverifiedDocs
    ] = await Promise.all([
      prisma.auditLog.count({
        where: { action: "LOGIN_FAILED", createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.payout.count({
        where: { amountCents: { gte: 500000 }, status: "PENDING" }
      }),
      prisma.case.count({
        where: {
          status: { in: ["NEW", "PENDING", "IN_PROGRESS"] },
          updatedAt: { lt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.trainingProgress.count({
        where: {
          completedAt: null,
          deadline: { lt: now }
        }
      }),
      prisma.document.count({ where: { isVerified: false } })
    ]);

    // Calculate risk scores (0-100)
    const securityRisk = Math.min(failedLogins * 5, 100);
    const financialRisk = Math.min(highValuePayouts * 20, 100);
    const operationalRisk = Math.min(staleCases * 3, 100);
    const trainingRisk = Math.min(overdueTraining * 5, 100);
    const documentRisk = Math.min(unverifiedDocs * 2, 100);

    const overallRisk = Math.round(
      (securityRisk + financialRisk + operationalRisk + trainingRisk + documentRisk) / 5
    );

    const riskLevel = overallRisk >= 70 ? "HIGH" :
                      overallRisk >= 40 ? "MEDIUM" : "LOW";

    res.json({
      success: true,
      data: {
        overallRisk,
        riskLevel,
        categories: {
          security: { score: securityRisk, factors: { failedLogins } },
          financial: { score: financialRisk, factors: { highValuePayouts } },
          operational: { score: operationalRisk, factors: { staleCases } },
          training: { score: trainingRisk, factors: { overdueTraining } },
          documentation: { score: documentRisk, factors: { unverifiedDocs } }
        },
        recommendations: [
          ...(securityRisk > 30 ? ["Review failed login attempts and consider additional security measures"] : []),
          ...(financialRisk > 30 ? ["Review high-value pending payouts for approval"] : []),
          ...(operationalRisk > 30 ? ["Address stale cases that haven't been updated"] : []),
          ...(trainingRisk > 30 ? ["Send training reminders to employees with overdue modules"] : []),
          ...(documentRisk > 30 ? ["Verify pending documents to ensure compliance"] : [])
        ],
        assessedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("[Compliance] Risk assessment error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
