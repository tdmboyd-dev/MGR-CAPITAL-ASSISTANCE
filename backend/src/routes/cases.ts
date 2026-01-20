// ============================================
// CASES API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready case management endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, CaseStatus, DocumentType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { legalService } from "../services/legalService.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/cases - List all cases (FOUNDER ONLY)
 */
router.get("/", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true
          }
        },
        assignedEmployee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true
          }
        }
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ]
    });

    res.json({
      success: true,
      count: cases.length,
      data: cases
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cases/stats - Dashboard statistics (FOUNDER ONLY)
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCases,
      activeCases,
      casesAwaitingFunds,
      casesThisMonth,
      activeEmployees,
      totalRecovered,
      totalFees,
      founderShare,
      pendingPayouts,
      byState
    ] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { status: { in: ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED"] } } }),
      prisma.case.count({ where: { status: "AWAITING_FUNDS" } }),
      prisma.case.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.case.aggregate({
        where: { status: "PAID" },
        _sum: { surplusAmountCents: true }
      }),
      prisma.case.aggregate({
        where: { status: "PAID" },
        _sum: { actualFeeCents: true }
      }),
      prisma.ledgerEntry.aggregate({
        where: { type: "FOUNDER_SHARE" },
        _sum: { amountCents: true }
      }),
      prisma.ledgerEntry.aggregate({
        where: { status: "PENDING" },
        _sum: { amountCents: true }
      }),
      prisma.case.groupBy({
        by: ["state"],
        _count: true,
        _sum: { surplusAmountCents: true },
        orderBy: { _sum: { surplusAmountCents: "desc" } },
        take: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        totalRecoveredCents: totalRecovered._sum.surplusAmountCents || 0,
        totalFeesCents: totalFees._sum.actualFeeCents || 0,
        founderShareCents: founderShare._sum.amountCents || 0,
        pendingPayoutsCents: pendingPayouts._sum.amountCents || 0,
        activeCases,
        casesThisMonth,
        activeEmployees,
        casesAwaitingFunds
      },
      byState: byState.map(item => ({
        state: item.state,
        count: item._count,
        totalSurplusCents: item._sum.surplusAmountCents || 0
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cases/deadlines - Upcoming deadlines (FOUNDER ONLY)
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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cases/:id - Get single case details (FOUNDER ONLY)
 */
router.get("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        assignedEmployee: {
          select: { id: true, name: true, email: true }
        },
        documents: true,
        deadlines: true,
        communications: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        stateRule: true,
        countyRule: true
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    // Get legal recommendations
    const recommendations = await legalService.getLegalRecommendations(req.params.id);
    const compliance = await legalService.checkCompliance(req.params.id);

    res.json({
      success: true,
      data: {
        ...caseData,
        recommendations,
        compliance
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cases - Create new case (FOUNDER ONLY)
 */
router.post("/", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const {
      clientId,
      state,
      county,
      propertyAddress,
      parcelNumber,
      saleDate,
      surplusAmountCents,
      feePercent,
      assignedEmployeeId
    } = req.body;

    // Generate internal code
    const caseCount = await prisma.case.count();
    const internalCode = `C-${String(caseCount + 1001).padStart(6, "0")}`;

    // Get state rule for deadline calculation
    const stateRule = legalService.getStateRules(state);

    const newCase = await prisma.case.create({
      data: {
        internalCode,
        clientId,
        state,
        county,
        propertyAddress,
        parcelNumber,
        saleDate: saleDate ? new Date(saleDate) : null,
        surplusAmountCents: surplusAmountCents || 0,
        feePercent: feePercent || 30,
        assignedEmployeeId,
        status: "NEW",
        priority: surplusAmountCents >= 1000000 ? 100 : 50,
        source: "manual"
      },
      include: {
        client: {
          select: { name: true, email: true }
        }
      }
    });

    // Create deadlines if sale date provided
    if (saleDate && stateRule) {
      await legalService.createCaseDeadlines(newCase.id, state, new Date(saleDate));
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "CASE_CREATED",
        entityType: "CASE",
        entityId: newCase.id,
        details: { internalCode, state, county }
      }
    });

    res.status(201).json({
      success: true,
      data: newCase
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/cases/:id - Update case (FOUNDER ONLY)
 */
router.patch("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow changing internal code
    delete updateData.internalCode;

    const updatedCase = await prisma.case.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { name: true, email: true }
        }
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "CASE_UPDATED",
        entityType: "CASE",
        entityId: id,
        details: { updatedFields: Object.keys(updateData) }
      }
    });

    res.json({
      success: true,
      data: updatedCase
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cases/:id/status - Update case status (FOUNDER ONLY)
 */
router.post("/:id/status", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses: CaseStatus[] = [
      "NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED",
      "FILED", "AWAITING_FUNDS", "PAID", "CLOSED", "REJECTED"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        status,
        filedAt: status === "FILED" ? new Date() : undefined,
        fundsDisbursedAt: status === "PAID" ? new Date() : undefined
      }
    });

    // Log status change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "STATUS_CHANGED",
        entityType: "CASE",
        entityId: id,
        details: { newStatus: status, notes }
      }
    });

    res.json({
      success: true,
      data: updatedCase
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cases/:id/documents - Generate documents (FOUNDER ONLY)
 */
router.post("/:id/documents", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { documentType, generateAll } = req.body;

    if (generateAll) {
      const result = await legalService.generateAllRequiredDocuments(id);
      return res.json({ success: result.success, data: result });
    }

    if (!documentType) {
      return res.status(400).json({ success: false, error: "Document type required" });
    }

    const result = await legalService.generateCaseDocument(id, documentType as DocumentType);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cases/:id/rejection - Analyze rejection (FOUNDER ONLY)
 */
router.post("/:id/rejection", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ success: false, error: "Rejection reason required" });
    }

    const analysis = await legalService.analyzeRejection(id, rejectionReason);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMPLOYEE ROUTES — Limited Access
// ============================================

/**
 * GET /api/cases/my - Employee's assigned cases
 */
router.get("/my", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      where: {
        assignedEmployeeId: req.user!.id
      },
      select: {
        id: true,
        internalCode: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        createdAt: true,
        client: {
          select: {
            name: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ]
    });

    // Add next action for each case (safe for employees)
    const casesWithActions = cases.map(c => ({
      ...c,
      nextAction: legalService.getNextAction(c.status as CaseStatus)
    }));

    res.json({
      success: true,
      count: cases.length,
      data: casesWithActions
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cases/my/:id - Employee view of single case
 */
router.get("/my/:id", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const caseData = await prisma.case.findFirst({
      where: {
        id: req.params.id,
        assignedEmployeeId: req.user!.id
      },
      select: {
        id: true,
        internalCode: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        createdAt: true,
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            zipCode: true
          }
        },
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true
          }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found or not assigned to you" });
    }

    res.json({
      success: true,
      data: {
        ...caseData,
        nextAction: legalService.getNextAction(caseData.status as CaseStatus)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT ROUTES — Public/Token Access
// ============================================

/**
 * GET /api/cases/client/:token - Client view of their case
 */
router.get("/client/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find case by public token
    const caseData = await prisma.case.findFirst({
      where: {
        publicAccessToken: token
      },
      select: {
        id: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        documents: {
          where: {
            status: { in: ["SENT_FOR_SIGNATURE", "SIGNED"] }
          },
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true
          }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    // Return client-safe status
    const clientStatus = getClientFriendlyStatus(caseData.status as CaseStatus);

    res.json({
      success: true,
      data: {
        propertyAddress: caseData.propertyAddress,
        county: caseData.county,
        state: caseData.state,
        status: clientStatus.status,
        statusMessage: clientStatus.message,
        documents: caseData.documents.map(d => ({
          id: d.id,
          type: d.type,
          needsSignature: d.status === "SENT_FOR_SIGNATURE",
          signed: !!d.signedAt
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getClientFriendlyStatus(status: CaseStatus): { status: string; message: string } {
  const statusMap: Record<CaseStatus, { status: string; message: string }> = {
    NEW: { status: "Getting Started", message: "We're preparing your case. A representative will contact you soon." },
    CONTACTED: { status: "In Progress", message: "We've connected with you and are beginning the process." },
    DOCS_PENDING: { status: "Documents Needed", message: "Please review and sign the documents we've sent you." },
    DOCS_SIGNED: { status: "Processing", message: "Thank you! Your documents are being processed." },
    FILED: { status: "Filed", message: "Your claim has been filed. We're waiting for the official response." },
    AWAITING_FUNDS: { status: "Almost There", message: "Great news! Your claim was approved. Funds are being processed." },
    PAID: { status: "Complete", message: "Your case is complete and funds have been disbursed." },
    CLOSED: { status: "Closed", message: "This case has been closed." },
    REJECTED: { status: "Under Review", message: "We're reviewing options for your case. A representative will contact you." }
  };

  return statusMap[status] || { status: "In Progress", message: "Your case is being processed." };
}

export default router;
