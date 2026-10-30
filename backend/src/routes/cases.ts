// ============================================
// CASES API ROUTES — MGR CAPITAL ASSISTANCE
// Case management endpoints; qualification scope is recorded in docs/full-build.
// ============================================

import { Router, Request, Response } from "express";
import { CaseStatus, DocumentType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, AppError, Errors } from "../middleware/errorHandler.js";
import { legalService } from "../services/LegalService.js";
import { recordDate } from "../parsers/RecordValues.js";
import { notificationCenterService } from "../services/NotificationCenterService.js";
import { notificationService } from "../services/NotificationService.js";
import { demoDataService } from "../services/DemoDataService.js";
import {
  isValidTransition,
  validateTransition,
  getAutoUpdateFields,
  getValidNextStatuses
} from "../utils/caseLifecycle.js";

import prisma from "../lib/prisma.js";
import {currentActor,caseScope,documentScope,requireCase,CLIENT_DOCUMENT_TYPES,accessFailure} from "../services/CaseDocumentAccess.js";

const router = Router();
// Current principal/tenant authority shared with the document domain.
const caseAuthentication = (req: AuthRequest,res: Response,next: import("express").NextFunction) => authMiddleware(req,res,()=>{
  void (async()=>{
    const actor=await currentActor(prisma,req.user!.id);(req as any).capitalActor=actor;
    const route=req.route?.path;
    if(["/stats","/deadlines"].includes(route) && (actor.role!=="FOUNDER" || actor.tenantId!==null))throw new AppError("Forbidden",403,"Global founder access required.");
    if(req.params.id)await requireCase(prisma,actor.id,req.params.id,req.method==="GET" || route==="/my/:id/status"?"read":"manage");
    if(req.method==="POST" && route==="/"){
      if(typeof req.body.clientId!=="string" || !req.body.clientId || req.body.clientId.length>100)throw new AppError("Invalid client",400,"Client is required.");
      const client=await prisma.user.findFirst({where:{id:req.body.clientId,role:"CLIENT",isActive:true,...(actor.role==="FOUNDER"&&actor.tenantId===null?{}:{tenantId:actor.tenantId})},select:{tenantId:true}});
      if(!client)throw new AppError("Client unavailable",404,"Client not found.");
      (req as any).capitalTenantId=client.tenantId;
      if(req.body.assignedEmployeeId && !await prisma.user.findFirst({where:{id:req.body.assignedEmployeeId,role:"EMPLOYEE",isActive:true,tenantId:client.tenantId},select:{id:true}}))throw new AppError("Employee unavailable",400,"Employee must belong to the case company.");
    }
    if(route==="/:id/assign"){
      const owned=await requireCase(prisma,actor.id,req.params.id,"manage");
      if(!await prisma.user.findFirst({where:{id:req.body.assignedEmployeeId,role:"EMPLOYEE",isActive:true,tenantId:owned.record.tenantId},select:{id:true}}))throw new AppError("Employee unavailable",400,"Employee must belong to the case company.");
    }
    next();
  })().catch(e=>accessFailure(res,e,"Case operation could not be confirmed"));
});
function safeCase(record:any,role:string):any {
  const out={...record};delete out.passwordHash;
  if(role!=="FOUNDER")for(const key of ["surplusAmountCents","feePercent","estimatedFeeCents","actualFeeCents","clientPayoutCents","recoveryAmountCents","notes","metadata","publicAccessToken","rejectionReason"])delete out[key];
  if(role==="CLIENT")for(const key of ["internalCode","assignedEmployeeId","assignedEmployee","priority","source","tenantId","portalExpiresAt","portalDissolveAfterDays","portalKeptAlive"])delete out[key];
  if(Array.isArray(out.documents))out.documents=out.documents.filter((doc:any)=>(role!=="CLIENT" || CLIENT_DOCUMENT_TYPES.includes(doc.type)) && (role!=="TEAM_LEAD" || doc.type!=="CLIENT_ID")).map((doc:any)=>{const d={...doc};delete d.filePath;delete d.fileUrl;delete d.generatedContent;delete d.metadata;delete d.signatureUrl;return d;});
  return out;
}


// ============================================
// EMPLOYEE ROUTES — Limited Access
// IMPORTANT: These must come BEFORE /:id routes
// ============================================

/**
 * GET /api/cases/my - Employee's assigned cases
 */
router.get("/my", caseAuthentication, roleGuard(["EMPLOYEE", "ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      where: {
        assignedEmployeeId: req.user!.id,
        AND:[caseScope((req as any).capitalActor)]
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
router.post("/my/:id/status", caseAuthentication, roleGuard(["EMPLOYEE", "ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const { transitionCase } = await import("../services/CaseWorkflowService.js");
  const transition = await transitionCase(req.user!.id, id, status, { employeeOnly: true, notes });
  const updatedCase = transition.record;
  const caseData = transition.previous;
  const currentStatus = caseData.status;
  const newStatus = updatedCase.status;

  // Email notifications on status change
  if (transition.changed) try {
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
    data: safeCase(updatedCase,req.user!.role),
    message: `Case ${caseData.internalCode} moved to ${newStatus}`
  });
}));

// ============================================
// CLIENT ROUTES — Authenticated Client Portal
// IMPORTANT: These must come BEFORE /:id routes
// ============================================

/**
 * GET /api/cases/my-cases - Authenticated client view of their cases
 * Used by the client portal dashboard
 */
router.get("/my-cases", caseAuthentication, roleGuard(["CLIENT"]), async (req: AuthRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      where: {
        clientId: req.user!.id,
        AND:[caseScope((req as any).capitalActor)]
      },
      select: {
        id: true,
        caseCode: true,
        internalCode: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        estimatedFeeCents: true,
        actualFeeCents: true,
        recoveryAmountCents: true,
        createdAt: true,
        updatedAt: true,
        saleDate: true,
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true,
            signatureRequired: true,
            fileName: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Add client-friendly case code if not exists
    const casesWithCode = cases.map(c => ({
      ...c,
      caseCode: c.caseCode || c.internalCode || c.id.slice(0, 8).toUpperCase()
    }));

    res.json({
      success: true,
      count: cases.length,
      data: casesWithCode.map(c=>safeCase(c,req.user!.role))
    });
  } catch (error: any) {
    console.error("Client cases error:", error);
    res.status(500).json({ success: false, error: "Failed to load your cases" });
  }
});

/**
 * GET /api/cases/my/:id - Authenticated client view of a single case
 * Used by the client portal case detail page
 */
router.get("/my/:id", caseAuthentication, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    // Build where clause based on role
    const where: any = { id: req.params.id, AND:[caseScope((req as any).capitalActor)] };

    if (user.role === "CLIENT") {
      where.clientId = user.id;
    } else if (user.role === "EMPLOYEE") {
      where.assignedEmployeeId = user.id;
    } else if (!["ADMIN","FOUNDER","TEAM_LEAD","COMPLIANCE"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const caseData = await prisma.case.findFirst({
      where,
      select: {
        id: true,
        caseCode: true,
        internalCode: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        estimatedFeeCents: true,
        actualFeeCents: true,
        recoveryAmountCents: true,
        saleDate: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
          }
        },
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            fileName: true,
            filePath: true,
            signedAt: true,
            signatureRequired: true,
            createdAt: true
          }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    // Transform for role-appropriate response
    const responseData: any = {
      ...caseData,
      caseCode: caseData.caseCode || caseData.internalCode || caseData.id.slice(0, 8).toUpperCase(),
      documents: caseData.documents.map((d: any) => ({
        ...d,
        needsSignature: d.signatureRequired && !d.signedAt,
        signed: !!d.signedAt
      }))
    };

    // Redact for non-FOUNDER roles
    if (user.role !== "FOUNDER") {
      delete responseData.estimatedFeeCents;
      delete responseData.actualFeeCents;
      delete responseData.recoveryAmountCents;
    }

    // Hide internal code and employee info for clients
    if (user.role === "CLIENT") {
      delete responseData.internalCode;
    }

    res.json({
      success: true,
      data: safeCase(responseData,user.role)
    });
  } catch (error: any) {
    console.error("Case detail error:", error);
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
        publicAccessToken: token,
        client: { isActive: true, OR: [{ tenantId: null }, { tenant: { isActive: true } }] },
        OR:[{portalKeptAlive:true},{portalExpiresAt:null},{portalExpiresAt:{gt:new Date()}}]
      },
      select: {
        id: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        documents: {
          where: {
            status: { in: ["PENDING_SIGNATURE", "SIGNED"] }, deletionStatus: { not: "DELETED" }, type:{in:CLIENT_DOCUMENT_TYPES}
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
router.get("/", caseAuthentication, async (req: AuthRequest, res: Response) => {
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
    if(!Number.isSafeInteger(pageNum)||!Number.isSafeInteger(pageSizeNum)||pageNum>1000000)return res.status(400).json({success:false,error:"Invalid pagination"});
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause based on role
    const where: any = {AND:[caseScope((req as any).capitalActor)]};

    if (user.role === "EMPLOYEE") {
      where.assignedEmployeeId = user.id;
    } else if (user.role === "CLIENT") {
      where.clientId = user.id;
    } else if (["ADMIN","FOUNDER","TEAM_LEAD","COMPLIANCE"].includes(user.role)) {
      // Authorized staff can narrow their existing scope by employee
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

    // Redact sensitive financial data for non-FOUNDER roles
    const isFounder = user.role === "FOUNDER";
    const redactedCases = cases.map((c: any) => {
      if (isFounder) return c;
      // Employees and clients should NOT see surplus amounts or fee details
      const { surplusAmountCents, estimatedFeeCents, actualFeeCents, clientPayoutCents, feePercent, notes, ...safe } = c;
      // Clients also shouldn't see employee details or internal notes
      if (user.role === "CLIENT") {
        const { assignedEmployee, ...clientSafe } = safe;
        return clientSafe;
      }
      return safe;
    });

    res.json({
      success: true,
      data: redactedCases.map(c=>safeCase(c,user.role)),
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
router.get("/stats", caseAuthentication, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
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
router.get("/deadlines", caseAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
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
router.get('/:id/assignees', caseAuthentication, roleGuard(['ADMIN']), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { record } = await requireCase(prisma, req.user!.id, req.params.id, 'manage');
  const employees = await prisma.user.findMany({ where: { role: 'EMPLOYEE', isActive: true, tenantId: record.tenantId }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: employees });
}));

router.get("/:id", caseAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: {
        client: {select:{id:true,name:true,email:true,phone:true}},
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
        ...safeCase(caseData,(req as AuthRequest).user!.role),
        recommendations: (req as AuthRequest).user!.role==="FOUNDER"?recommendations:undefined,
        compliance: (req as AuthRequest).user!.role==="FOUNDER"?compliance:undefined
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
router.post("/", caseAuthentication, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { createCapitalCase } = await import("../services/CaseCreationService.js");
    const newCase = await createCapitalCase(req.body, req.user!.id, req.get('Idempotency-Key'));

    res.status(201).json({
      success: true,
      data: safeCase(newCase,req.user!.role)
    });
  } catch (error: any) {
    return accessFailure(res, error, "Case creation could not be confirmed");
  }
});

/**
 * PATCH /api/cases/:id - Update case (FOUNDER ONLY)
 */
router.patch("/:id", caseAuthentication, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const editable=["propertyAddress","parcelNumber","county","state","saleDate","priority","notes","source"];
    const financial=["surplusAmountCents","feePercent","estimatedFeeCents","actualFeeCents","clientPayoutCents"];
    const allowed=req.user!.role==="FOUNDER"?[...editable,...financial]:editable;
    if(!updateData || typeof updateData!=="object" || Array.isArray(updateData) || Object.keys(updateData).some(k=>!allowed.includes(k)))return res.status(400).json({success:false,error:"Unsupported or server-owned case fields"});
    for(const key of Object.keys(updateData)){
      const value=updateData[key];
      if(financial.includes(key)||key==="priority"){if(!Number.isSafeInteger(value)||value<0||value>(key==="feePercent"?100:2147483647))return res.status(400).json({success:false,error:"Invalid case amount or priority"});}
      else if(key==="saleDate"){try { if(value!==null && (typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(value)))throw Error("Invalid date"); updateData[key]=value===null?null:recordDate(value.slice(0,10)); } catch {return res.status(400).json({success:false,error:"Invalid sale date"});}}
      else if(typeof value!=="string"||value.length>2000)return res.status(400).json({success:false,error:"Invalid case text"});
    }

    const { updateCaseFields } = await import("../services/CaseWorkflowService.js");
    const updatedCase = await updateCaseFields(req.user!.id, id, updateData);

    res.json({
      success: true,
      data: safeCase(updatedCase,req.user!.role)
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
router.post("/:id/status", caseAuthentication, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes, forceTransition } = req.body;
  const { transitionCase } = await import("../services/CaseWorkflowService.js");
  const transition = await transitionCase(req.user!.id, id, status, { forceTransition, notes });
  const updatedCase = transition.record;
  const currentStatus = transition.previous.status;
  const newStatus = updatedCase.status;
  const validation = transition.validation;

  // Email notifications on founder status change
  if (transition.changed) try {
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
    data: safeCase(updatedCase,req.user!.role),
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined
  });
}));

/**
 * POST /api/cases/:id/documents - Generate documents (FOUNDER ONLY)
 */
router.post("/:id/documents", caseAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
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
router.patch("/:id/assign", caseAuthentication, roleGuard(["FOUNDER", "ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedEmployeeId } = req.body;

    if (!assignedEmployeeId) {
      return res.status(400).json({ success: false, error: "assignedEmployeeId required" });
    }

    const { assignCaseEmployee } = await import("../services/CaseWorkflowService.js");
    const updatedCase = await assignCaseEmployee(req.user!.id, id, assignedEmployeeId);

    res.json({
      success: true,
      data: safeCase(updatedCase,req.user!.role),
      message: "Case assignment saved",
    });
  } catch (error: any) {
    console.error("Case assignment error:", error);
    res.status(500).json({ success: false, error: "Failed to assign case" });
  }
});

/**
 * POST /api/cases/:id/rejection - Analyze rejection (FOUNDER ONLY)
 */
router.post("/:id/rejection", caseAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
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
