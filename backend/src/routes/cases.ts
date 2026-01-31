// ============================================
// CASES API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready case management endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, CaseStatus, DocumentType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, AppError, Errors } from "../middleware/errorHandler.js";
import { legalService } from "../services/legalService.js";
import { enforceStateFeeCap } from "../data/stateRules.js";
import { notificationCenterService } from "../services/NotificationCenterService.js";
import { notificationService } from "../services/notificationService.js";
import {
  isValidTransition,
  validateTransition,
  getAutoUpdateFields,
  getValidNextStatuses
} from "../utils/caseLifecycle.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// EMPLOYEE ROUTES — Limited Access
// IMPORTANT: These must come BEFORE /:id routes
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
    console.error("Employee cases error:", error);
    res.status(500).json({ success: false, error: "Failed to load cases" });
  }
});

/**
 * POST /api/cases/my/:id/status - Employee updates case status (limited transitions)
 * Employees can only: NEW → CONTACTED → DOCS_PENDING
 * FILED, AWAITING_FUNDS, PAID transitions require FOUNDER
 */
router.post("/my/:id/status", authMiddleware, roleGuard(["EMPLOYEE"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  // Employee-allowed transitions
  const EMPLOYEE_ALLOWED_STATUSES: CaseStatus[] = ["CONTACTED", "DOCS_PENDING"];

  if (!EMPLOYEE_ALLOWED_STATUSES.includes(status)) {
    throw Errors.forbidden();
  }

  // Verify case is assigned to this employee
  const caseData = await prisma.case.findFirst({
    where: {
      id,
      assignedEmployeeId: req.user!.id
    },
    select: {
      id: true,
      internalCode: true,
      status: true
    }
  });

  if (!caseData) {
    throw Errors.notFound("Case");
  }

  const currentStatus = caseData.status as CaseStatus;
  const newStatus = status as CaseStatus;

  // Validate the transition
  if (!isValidTransition(currentStatus, newStatus)) {
    throw Errors.badRequest(
      `Cannot transition from ${currentStatus} to ${newStatus}. ` +
      `Valid next statuses: ${getValidNextStatuses(currentStatus).join(", ")}`
    );
  }

  // Get auto-update fields
  const autoFields = getAutoUpdateFields(newStatus);

  const updatedCase = await prisma.case.update({
    where: { id },
    data: {
      status: newStatus,
      ...autoFields
    },
    select: {
      id: true,
      internalCode: true,
      status: true
    }
  });

  // Log the change
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "EMPLOYEE_STATUS_UPDATE",
      entityType: "CASE",
      entityId: id,
      details: {
        previousStatus: currentStatus,
        newStatus: newStatus,
        notes,
        employeeId: req.user!.id
      }
    }
  });

  // Email notifications on status change
  try {
    const fullCase = await prisma.case.findUnique({
      where: { id },
      include: {
        client: { select: { email: true, name: true } },
        documents: { where: { status: "PENDING_SIGNATURE" } },
      },
    });

    if (fullCase?.client?.email) {
      // Notify client of status change
      await notificationService.notifyCaseStatusChange({
        clientEmail: fullCase.client.email,
        clientName: fullCase.client.name || "Valued Client",
        caseId: id,
        caseCode: caseData.internalCode,
        oldStatus: currentStatus,
        newStatus: newStatus,
      });

      // If DOCS_PENDING, also notify documents ready
      if (newStatus === "DOCS_PENDING" && fullCase.documents.length > 0) {
        await notificationService.notifyDocumentsReady({
          clientEmail: fullCase.client.email,
          clientName: fullCase.client.name || "Valued Client",
          caseId: id,
          caseCode: caseData.internalCode,
          documentCount: fullCase.documents.length,
        });
      }
    }
  } catch (notifError) {
    console.error("Failed to send case status notification:", notifError);
  }

  res.json({
    success: true,
    data: updatedCase,
    message: `Case ${caseData.internalCode} moved to ${newStatus}`
  });
}));

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
    console.error("Employee case detail error:", error);
    res.status(500).json({ success: false, error: "Failed to load case" });
  }
});

// ============================================
// CLIENT ROUTES — Public/Token Access
// IMPORTANT: These must come BEFORE /:id routes
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
            status: { in: ["PENDING_SIGNATURE", "SIGNED"] }
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
          needsSignature: d.status === "PENDING_SIGNATURE",
          signed: !!d.signedAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Client case error:", error);
    res.status(500).json({ success: false, error: "Unable to load case information" });
  }
});

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/cases - List cases with pagination and filtering
 * - FOUNDER: all cases
 * - ADMIN: all cases
 * - EMPLOYEE: only assigned cases
 * - CLIENT: only their cases
 */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      page = "1",
      pageSize = "20",
      status,
      state,
      search,
      assignedEmployeeId
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize as string, 10)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause based on role
    const where: any = {};

    if (user.role === "EMPLOYEE") {
      where.assignedEmployeeId = user.id;
    } else if (user.role === "CLIENT") {
      where.clientId = user.id;
    } else if (user.role === "ADMIN" || user.role === "FOUNDER") {
      // Admin/Founder can filter by employee
      if (assignedEmployeeId) {
        where.assignedEmployeeId = assignedEmployeeId;
      }
    } else {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (state) {
      where.state = state;
    }
    if (search) {
      where.OR = [
        { internalCode: { contains: search as string, mode: "insensitive" } },
        { propertyAddress: { contains: search as string, mode: "insensitive" } },
        { county: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          assignedEmployee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        skip,
        take: pageSizeNum,
      }),
      prisma.case.count({ where }),
    ]);

    res.json({
      success: true,
      data: cases,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    });
  } catch (error: any) {
    console.error("List cases error:", error);
    res.status(500).json({ success: false, error: "Failed to load cases" });
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
    console.error("Case stats error:", error);
    res.status(500).json({ success: false, error: "Failed to load statistics" });
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
    console.error("Deadlines error:", error);
    res.status(500).json({ success: false, error: "Failed to load deadlines" });
  }
});

/**
 * GET /api/cases/:id - Get single case details (FOUNDER ONLY)
 * NOTE: This route must come AFTER /my, /my/:id, /client/:token, /stats, /deadlines
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
    console.error("Cases error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
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

    // STATE FEE CAP ENFORCEMENT — auto-limit fee per state law
    const requestedFee = feePercent || 33;
    const feeCap = state ? enforceStateFeeCap(state, requestedFee, surplusAmountCents || 0) : null;
    const effectiveFee = feeCap ? feeCap.effectiveFeePercent : requestedFee;

    if (feeCap?.wasCapped) {
      console.log(`[FEE CAP] ${state}: Requested ${requestedFee}% → Capped to ${effectiveFee}% (${feeCap.capReason})`);
    }

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
        feePercent: effectiveFee,
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
    console.error("Cases error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
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
    console.error("Cases error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/cases/:id/status - Update case status (FOUNDER ONLY)
 * Validates transitions using state machine
 */
router.post("/:id/status", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes, forceTransition } = req.body;

  const validStatuses: CaseStatus[] = [
    "NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED",
    "FILED", "AWAITING_FUNDS", "PAID", "CLOSED", "REJECTED"
  ];

  if (!validStatuses.includes(status)) {
    throw Errors.badRequest(`Invalid status: ${status}`);
  }

  // Get current case with documents for validation
  const currentCase = await prisma.case.findUnique({
    where: { id },
    include: {
      documents: {
        select: { id: true, type: true, status: true }
      }
    }
  });

  if (!currentCase) {
    throw Errors.notFound("Case");
  }

  const currentStatus = currentCase.status as CaseStatus;
  const newStatus = status as CaseStatus;

  // Validate the transition
  const validation = validateTransition(currentStatus, newStatus, currentCase);

  // If invalid transition and not forcing (FOUNDER only can force)
  if (!validation.valid) {
    if (!forceTransition || req.user!.role !== "FOUNDER") {
      throw Errors.badRequest(
        `Invalid status transition: ${validation.errors.join(". ")}. ` +
        `Valid next statuses: ${getValidNextStatuses(currentStatus).join(", ")}`
      );
    }
    // FOUNDER is forcing - log warning but allow
    console.warn(`[FORCED TRANSITION] User ${req.user!.id} forcing ${currentStatus} -> ${newStatus} for case ${id}`);
  }

  // Get auto-update fields for this transition
  const autoFields = getAutoUpdateFields(newStatus);

  // Auto-set portal expiration when case moves to PAID
  const portalData: any = {};
  if (newStatus === "PAID") {
    const caseForPortal = await prisma.case.findUnique({
      where: { id },
      select: { portalDissolveAfterDays: true, portalKeptAlive: true }
    });
    if (caseForPortal && !caseForPortal.portalKeptAlive) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (caseForPortal.portalDissolveAfterDays || 12));
      portalData.portalExpiresAt = expiresAt;
    }
  }

  const updatedCase = await prisma.case.update({
    where: { id },
    data: {
      status: newStatus,
      ...autoFields,
      ...portalData
    }
  });

  // Log status change with validation warnings
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "STATUS_CHANGED",
      entityType: "CASE",
      entityId: id,
      details: {
        previousStatus: currentStatus,
        newStatus: newStatus,
        notes,
        warnings: validation.warnings,
        forced: !validation.valid && forceTransition,
        portalExpiresAt: portalData.portalExpiresAt || null
      }
    }
  });

  // Email notifications on founder status change
  try {
    const fullCase = await prisma.case.findUnique({
      where: { id },
      include: {
        client: { select: { email: true, name: true } },
        documents: { where: { status: "PENDING_SIGNATURE" } },
      },
    });

    if (fullCase?.client?.email) {
      // Notify client of status change
      await notificationService.notifyCaseStatusChange({
        clientEmail: fullCase.client.email,
        clientName: fullCase.client.name || "Valued Client",
        caseId: id,
        caseCode: fullCase.internalCode,
        oldStatus: currentStatus,
        newStatus: newStatus,
      });

      // If DOCS_PENDING, notify documents ready
      if (newStatus === "DOCS_PENDING" && fullCase.documents.length > 0) {
        await notificationService.notifyDocumentsReady({
          clientEmail: fullCase.client.email,
          clientName: fullCase.client.name || "Valued Client",
          caseId: id,
          caseCode: fullCase.internalCode,
          documentCount: fullCase.documents.length,
        });
      }

      // If PAID, notify payout completed
      if (newStatus === "PAID" && fullCase.clientPayoutCents) {
        await notificationService.notifyPayoutCompleted({
          clientEmail: fullCase.client.email,
          clientName: fullCase.client.name || "Valued Client",
          caseId: id,
          caseCode: fullCase.internalCode,
          amountCents: fullCase.clientPayoutCents,
          paymentMethod: "Direct Deposit",
        });
      }
    }
  } catch (notifError) {
    console.error("Failed to send founder case status notification:", notifError);
  }

  res.json({
    success: true,
    data: updatedCase,
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined
  });
}));

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
    console.error("Cases error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * PATCH /api/cases/:id/assign - Assign case to employee (FOUNDER/ADMIN ONLY)
 */
router.patch("/:id/assign", authMiddleware, roleGuard(["FOUNDER", "ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedEmployeeId } = req.body;

    if (!assignedEmployeeId) {
      return res.status(400).json({ success: false, error: "assignedEmployeeId required" });
    }

    // Verify employee exists and is active
    const employee = await prisma.user.findFirst({
      where: {
        id: assignedEmployeeId,
        role: "EMPLOYEE",
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    });

    if (!employee) {
      return res.status(400).json({ success: false, error: "Employee not found or inactive" });
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: { assignedEmployeeId },
      include: {
        client: { select: { name: true } },
        assignedEmployee: { select: { id: true, name: true, email: true } },
      },
    });

    // Create notification for assigned employee
    try {
      await notificationCenterService.sendNotification({
        userId: assignedEmployeeId,
        category: "case_update",
        priority: "high",
        title: "New Case Assignment",
        message: `You have been assigned to case ${updatedCase.internalCode} - ${updatedCase.client?.name || "Unknown Client"}`,
        link: `/employee/cases/${id}`,
      });
    } catch (notifError) {
      console.error("Failed to send assignment notification:", notifError);
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "CASE_ASSIGNED",
        entityType: "CASE",
        entityId: id,
        details: {
          assignedToId: assignedEmployeeId,
          assignedToName: employee.name,
          assignedBy: req.user!.id,
        },
      },
    });

    res.json({
      success: true,
      data: updatedCase,
      message: `Case assigned to ${employee.name}`,
    });
  } catch (error: any) {
    console.error("Case assignment error:", error);
    res.status(500).json({ success: false, error: "Failed to assign case" });
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
    console.error("Cases error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
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
