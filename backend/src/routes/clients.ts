// ============================================
// CLIENTS API ROUTES — MGR CAPITAL ASSISTANCE
// Client portal endpoints; actual qualification and remaining work are in HANDOFF.md
// ============================================

import { Router, Request, Response } from "express";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { clientService } from "../services/ClientService.js";
import { legalService } from "../services/LegalService.js";
import { notificationService } from "../services/NotificationService.js";
import {
  isValidDocumentTransition,
  validateDocumentTransition,
  getDocumentAutoUpdateFields,
  getValidNextDocumentStatuses
} from "../utils/documentLifecycle.js";

import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { currentActor, caseScope, requireCase } from "../services/CaseDocumentAccess.js";
import { z } from "zod";
const clientInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(1).max(200),
  phone: z.string().max(50).optional(), address: z.string().max(2000).optional(), city: z.string().max(200).optional(), state: z.string().max(100).optional(), zipCode: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(), ssn4: z.string().regex(/^\d{4}$/).optional(),
}).strict();

const router = Router();
const clientAuthentication = (req: AuthRequest, res: Response, next: import("express").NextFunction) => authMiddleware(req, res, () => {
  void (async () => {
    const { currentActor, requireCase, requireDocument } = await import("../services/CaseDocumentAccess.js");
    const actor = await currentActor(prisma, req.user!.id);
    (req as any).capitalActor = actor;
    if (req.params.id && !await prisma.user.findFirst({ where: { id: req.params.id, role: "CLIENT", ...(actor.role === "FOUNDER" && actor.tenantId === null ? {} : { tenantId: actor.tenantId }) }, select: { id: true } })) return res.status(404).json({ error: "Client not found" });
    if (req.params.caseId) await requireCase(prisma, actor.id, req.params.caseId, "manage");
    if (req.params.documentId) await requireDocument(prisma, actor.id, req.params.documentId, "verify");
    next();
  })().catch(async error => { const { accessFailure } = await import("../services/CaseDocumentAccess.js"); accessFailure(res, error); });
});
// URL assertions and pasted images cannot stand in for saved bytes or signed evidence.
router.post('/portal/:token/id-upload', (_req, res) => res.status(409).json({ success: false, error: 'Sign in and upload the actual file through the document vault. A file URL alone is not an upload.' }));
router.post('/portal/:token/sign/:documentId', (_req, res) => res.status(503).json({ success: false, error: 'Signature evidence integration is unavailable. No document was signed.' }));

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/clients - List all clients (FOUNDER ONLY)
 */
router.get("/", clientAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const clients = await prisma.user.findMany({
      where: { role: "CLIENT", ...((req as any).capitalActor.role === "FOUNDER" && (req as any).capitalActor.tenantId === null ? {} : { tenantId: (req as any).capitalActor.tenantId }) },
      select: {
        isActive: true,
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        _count: {
          select: { clientCases: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error: any) {
    console.error("Client error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/clients/:id - Get client details (FOUNDER ONLY)
 */
router.get("/:id", clientAuthentication, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const client = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "CLIENT"
      },
      select: {
        id: true, name: true, email: true, phone: true, address: true, city: true, state: true, zipCode: true, isActive: true, createdAt: true, dateOfBirth: true, ssn4: true,
        clientCases: {
          where: caseScope((req as any).capitalActor),
          select: {
            id: true,
            internalCode: true,
            status: true,
            propertyAddress: true,
            county: true,
            state: true,
            surplusAmountCents: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    // Redact sensitive data — only FOUNDER sees full financial + PII
    const { passwordHash, ssn4, dateOfBirth, ...safeClient } = client as any;
    const isFounder = (req as any).user?.role === "FOUNDER";

    // Redact surplusAmountCents from associated cases for non-founders
    const redactedCases = isFounder
      ? safeClient.clientCases
      : safeClient.clientCases?.map((c: any) => {
          const { surplusAmountCents, ...safeCase } = c;
          return safeCase;
        });

    res.json({
      success: true,
      data: {
        ...safeClient,
        clientCases: redactedCases,
        // Only FOUNDER sees SSN4 and DOB
        ...(isFounder ? { ssn4, dateOfBirth } : {}),
      }
    });
  } catch (error: any) {
    console.error("Client error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/clients - Create new client (FOUNDER ONLY)
 */
router.post("/", clientAuthentication, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = clientInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid client fields" });
    const { email, name, phone, address, city, state, zipCode, dateOfBirth, ssn4 } = parsed.data;
    let dob: Date | null = null;
    if (dateOfBirth) {
      try { const { recordDate } = await import("../parsers/RecordValues.js"); dob = recordDate(dateOfBirth); }
      catch { return res.status(400).json({ error: "Invalid birth date" }); }
      if (dob && dob > new Date()) return res.status(400).json({ error: "Invalid birth date" });
    }
    const client = await prisma.$transaction(async tx => {
      const actor = await currentActor(tx, req.user!.id);
      if (!["FOUNDER", "ADMIN"].includes(actor.role)) throw new AppError("Forbidden", 403, "Client management access required.");
      const created = await tx.user.create({ data: { email, name, phone, address, city, state, zipCode, dateOfBirth: dob, ssn4, role: "CLIENT", tenantId: actor.tenantId, passwordHash: "", isActive: true }, select: { id: true, email: true, name: true, phone: true, address: true, city: true, state: true, zipCode: true, createdAt: true } });
      await tx.auditLog.create({ data: { userId: actor.id, tenantId: actor.tenantId, action: "CLIENT_CREATED", entityType: "USER", entityId: created.id, details: { updatedFields: Object.keys(parsed.data) } } });
      return created;
    });

    // Send welcome email to client
    if (email) {
      try {
        await notificationService.sendWelcomeEmail({
          to: email,
          toName: name || "Valued Client",
          userId: client.id,
          role: "CLIENT",
        });
      } catch (emailError) {
        console.error("Failed to send client welcome email:", emailError);
      }
    }

    res.status(201).json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error("Client error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/clients/documents/:documentId/status - Update document status (FOUNDER ONLY)
 * Uses document lifecycle state machine
 */
router.post("/documents/:documentId/status", clientAuthentication, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId } = req.params;
  const { status, notes, forceTransition } = req.body;

  const validStatuses: DocumentStatus[] = [
    "DRAFT", "PENDING_SIGNATURE", "SIGNED", "SUBMITTED", "APPROVED", "REJECTED"
  ];

  if (status === "SIGNED") throw new AppError("Signature evidence unavailable", 409, "A status edit cannot certify a document signature.");
  if (!validStatuses.includes(status)) {
    throw Errors.badRequest(`Invalid status: ${status}`);
  }

  // Get current document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      case: { select: { id: true, internalCode: true } }
    }
  });

  if (!document) {
    throw Errors.notFound("Document");
  }

  const currentStatus = document.status as DocumentStatus;
  const newStatus = status as DocumentStatus;

  // Validate the transition
  const validation = validateDocumentTransition(currentStatus, newStatus, document);

  // If invalid transition and not forcing (FOUNDER only can force)
  if (!validation.valid) {
    if (!forceTransition || req.user!.role !== "FOUNDER") {
      throw Errors.badRequest(
        `Invalid status transition: ${validation.errors.join(". ")}. ` +
        `Valid next statuses: ${getValidNextDocumentStatuses(currentStatus).join(", ")}`
      );
    }
    console.warn(`[FORCED TRANSITION] User ${req.user!.id} forcing document ${documentId} from ${currentStatus} to ${newStatus}`);
  }

  // Get auto-update fields
  const autoFields = getDocumentAutoUpdateFields(newStatus);

  const updatedDocument = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: newStatus,
      ...autoFields
    }
  });

  // Log the change
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "DOCUMENT_STATUS_CHANGED",
      entityType: "DOCUMENT",
      entityId: documentId,
      details: {
        previousStatus: currentStatus,
        newStatus: newStatus,
        caseId: document.caseId,
        notes,
        warnings: validation.warnings,
        forced: !validation.valid && forceTransition
      }
    }
  });

  res.json({
    success: true,
    data: updatedDocument,
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined
  });
}));

/**
 * PATCH /api/clients/:id - Update client (FOUNDER ONLY)
 */
router.patch("/:id", clientAuthentication, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = clientInput.omit({ email: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid client fields" });
    const { dateOfBirth, ...fields } = parsed.data;
    let dob: Date | undefined;
    if (dateOfBirth) {
      try { const { recordDate } = await import("../parsers/RecordValues.js"); dob = recordDate(dateOfBirth) ?? undefined; }
      catch { return res.status(400).json({ error: "Invalid birth date" }); }
      if (dob && dob > new Date()) return res.status(400).json({ error: "Invalid birth date" });
    }
    const client = await prisma.$transaction(async tx => {
      const actor = await currentActor(tx, req.user!.id);
      if (!["FOUNDER", "ADMIN"].includes(actor.role)) throw new AppError("Forbidden", 403, "Client management access required.");
      const target = await tx.user.findFirst({ where: { id, role: "CLIENT", ...(actor.role === "FOUNDER" && actor.tenantId === null ? {} : { tenantId: actor.tenantId }) }, select: { tenantId: true } });
      if (!target) throw new AppError("Client missing", 404, "Client not found.");
      const updated = await tx.user.update({ where: { id }, data: { ...fields, dateOfBirth: dob }, select: { id: true, email: true, name: true, phone: true, address: true, city: true, state: true, zipCode: true } });
      await tx.auditLog.create({ data: { userId: actor.id, tenantId: target.tenantId, action: "CLIENT_UPDATED", entityType: "USER", entityId: id, details: { updatedFields: Object.keys(parsed.data) } } });
      return updated;
    });

    res.json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error("Client error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

// ============================================
// PORTAL LINK MANAGEMENT — Send/Copy Portal Link
// ============================================

/**
 * POST /api/clients/portal-link/:caseId - Generate and optionally send portal link (ADMIN/FOUNDER)
 */
router.post("/portal-link/:caseId", clientAuthentication, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { caseId } = req.params;
  const { action } = req.body; // action: "copy" | "email" | "sms"
  if (action === "email" || action === "sms") return res.status(503).json({ success: false, error: "Portal delivery integration unavailable. No message was sent." });
  if (action !== "copy") throw new AppError("Invalid action", 400, "Choose copy to obtain a portal link.");

  const frontend = new URL(process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://capitalmgr.com' : 'http://localhost:3011'));
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password) throw new AppError('Invalid frontend', 503, 'Portal frontend URL is unavailable.');
  const caseData = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Case" WHERE id = ${caseId} FOR UPDATE`;
    await requireCase(tx, req.user!.id, caseId, 'manage');
    let record = await tx.case.findUniqueOrThrow({ where: { id: caseId }, include: { client: { select: { name: true, email: true, phone: true } } } });
    if (record.portalExpiresAt && new Date() > record.portalExpiresAt && !record.portalKeptAlive) {
      const days = record.portalDissolveAfterDays;
      if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new AppError('Invalid expiration', 409, 'Portal expiration requires review.');
      record = await tx.case.update({ where: { id: caseId }, data: { portalExpiresAt: new Date(Date.now() + days * 86400000) }, include: { client: { select: { name: true, email: true, phone: true } } } });
    }
    await tx.auditLog.create({ data: { userId: req.user!.id, tenantId: record.tenantId, action: 'PORTAL_LINK_GENERATED', entityType: 'CASE', entityId: caseId, details: { action, caseId } } });
    return record;
  });
  const portalUrl = new URL('/client/portal', frontend); portalUrl.searchParams.set('token', caseData.publicAccessToken);
  const signPortalUrl = new URL('/sign-portal', frontend); signPortalUrl.searchParams.set('token', caseData.publicAccessToken);

  res.json({
    success: true,
    data: {
      portalUrl: portalUrl.toString(),
      signPortalUrl: signPortalUrl.toString(),
      token: caseData.publicAccessToken,
      clientName: caseData.client.name,
      clientEmail: caseData.client.email,
      expiresAt: caseData.portalExpiresAt,
      keptAlive: caseData.portalKeptAlive
    }
  });
}));

/**
 * PATCH /api/clients/portal-settings/:caseId - Update portal expiration settings (ADMIN/FOUNDER)
 */
router.patch("/portal-settings/:caseId", clientAuthentication, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { caseId } = req.params;
  const { portalKeptAlive, portalDissolveAfterDays, portalExpiresAt } = req.body;

  if ((portalDissolveAfterDays !== undefined && (!Number.isInteger(portalDissolveAfterDays) || portalDissolveAfterDays < 1 || portalDissolveAfterDays > 3650)) || (portalExpiresAt !== undefined && (typeof portalExpiresAt !== "string" || !Number.isFinite(Date.parse(portalExpiresAt))))) throw new AppError("Invalid expiration", 400, "Invalid portal expiration settings.");
  const updateData: any = {};
  if (typeof portalKeptAlive === "boolean") updateData.portalKeptAlive = portalKeptAlive;
  if (typeof portalDissolveAfterDays === "number") updateData.portalDissolveAfterDays = portalDissolveAfterDays;
  if (portalExpiresAt) updateData.portalExpiresAt = new Date(portalExpiresAt);

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: updateData,
    select: {
      id: true,
      portalExpiresAt: true,
      portalDissolveAfterDays: true,
      portalKeptAlive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "PORTAL_SETTINGS_UPDATED",
      entityType: "CASE",
      entityId: caseId,
      details: updateData
    }
  });

  res.json({ success: true, data: updated });
}));

/**
 * POST /api/clients/auto-expire-portals - Auto-expire portals 12 days after PAID (SYSTEM/FOUNDER)
 * Can be called by cron or manually by founder
 */
router.post("/auto-expire-portals", clientAuthentication, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  // Find all PAID cases without expiration set and not kept alive
  const paidCases = await prisma.case.findMany({
    where: {
      ...((req as any).capitalActor.role === "FOUNDER" && (req as any).capitalActor.tenantId === null ? {} : { tenantId: (req as any).capitalActor.tenantId }),
      status: "PAID",
      portalExpiresAt: null,
      portalKeptAlive: false,
      paidAt: { not: null }
    }
  });

  let updatedCount = 0;
  for (const c of paidCases) {
    const paidDate = c.paidAt || new Date();
    const expiresAt = new Date(paidDate);
    expiresAt.setDate(expiresAt.getDate() + c.portalDissolveAfterDays);

    await prisma.case.update({
      where: { id: c.id },
      data: { portalExpiresAt: expiresAt }
    });
    updatedCount++;
  }

  res.json({
    success: true,
    message: `Set expiration for ${updatedCount} paid cases`,
    updatedCount
  });
}));

// ============================================
// CLIENT PORTAL ROUTES — Public (Token-based)
// Human-friendly, no backend exposure
// ============================================

/**
 * Helper: Check portal expiration. Returns error response if expired.
 */
async function checkPortalExpiration(token: string, res: Response): Promise<any | null> {
  const caseData = await prisma.case.findFirst({
    where: { publicAccessToken: token },
    select: {
      id: true,
      client: { select: { isActive: true } },
      tenant: { select: { isActive: true } },
      portalExpiresAt: true,
      portalKeptAlive: true,
      status: true
    }
  });

  if (!caseData || !caseData.client.isActive || caseData.tenant?.isActive === false) {
    res.status(404).json({
      success: false,
      error: "We couldn't find your case. Please check your link or contact us for help."
    });
    return null;
  }

  // Check if portal has expired
  if (caseData.portalExpiresAt && new Date() > caseData.portalExpiresAt && !caseData.portalKeptAlive) {
    res.status(410).json({
      success: false,
      error: "This portal link has expired. Your case has been completed and paid out. If you need assistance, please contact us.",
      expired: true,
      expiredAt: caseData.portalExpiresAt
    });
    return null;
  }

  return caseData;
}

/**
 * GET /api/clients/portal/:token - Get portal view (CLIENT)
 */
router.get("/portal/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Check expiration first
    const expirationCheck = await checkPortalExpiration(token, res);
    if (!expirationCheck) return;

    // Find case by public token
    const caseData = await prisma.case.findFirst({
      where: { publicAccessToken: token },
      include: {
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        documents: {
          where: {
            status: { in: ["PENDING_SIGNATURE", "SIGNED", "SUBMITTED"] },
            type: { in: ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "CLIENT_ID"] },
            deletionStatus: { not: "DELETED" },
          },
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true,
            signatureRequired: true
          }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "We couldn't find your case. Please check your link or contact us for help."
      });
    }

    // Get client-safe portal data
    const portalData = await clientService.getPortalData(token);

    // Determine current step
    const steps = getOnboardingSteps(caseData);

    res.json({
      success: true,
      data: {
        clientName: caseData.client.name,
        propertyAddress: caseData.propertyAddress,
        county: caseData.county,
        state: caseData.state,
        status: portalData.data?.status || { title: "In Progress", description: "Your case is being processed." },
        steps,
        currentStep: steps.findIndex(s => !s.completed),
        documents: caseData.documents.map((d: any) => ({
          id: d.id,
          type: getDocumentFriendlyName(d.type),
          needsSignature: d.signatureRequired && !d.signedAt,
          signed: !!d.signedAt
        }))
      }
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  }
});

/**
 * PATCH /api/clients/portal/:token/info - Update client info (CLIENT)
 */
router.patch("/portal/:token/info", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { name, phone, email, address, city, state, zipCode } = req.body;

    // Check expiration
    const expirationCheck = await checkPortalExpiration(token, res);
    if (!expirationCheck) return;

    // Find case
    const caseData = await prisma.case.findFirst({
      where: { publicAccessToken: token },
      select: { clientId: true }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "We couldn't find your case."
      });
    }

    if (email !== undefined) return res.status(400).json({ success: false, error: "Change login email through your authenticated account settings." });
    if (Object.entries({ name, phone, address, city, state, zipCode }).some(([, value]) => value !== undefined && (typeof value !== "string" || value.length > 2000))) return res.status(400).json({ success: false, error: "Invalid contact fields" });
    // Update client
    await prisma.user.update({
      where: { id: caseData.clientId },
      data: {
        name,
        phone,
        email,
        address,
        city,
        state,
        zipCode
      }
    });

    res.json({
      success: true,
      message: "Your information has been updated. Thank you!"
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  }
});

/**
 * POST /api/clients/portal/:token/id-upload - Upload ID document (CLIENT)
 */


/**
 * POST /api/clients/portal/:token/sign/:documentId - Sign a document (CLIENT)
 */


/**
 * GET /api/clients/portal/:token/faq - Get FAQ answers (CLIENT)
 */
router.get("/portal/:token/faq", async (req: Request, res: Response) => {
  try {
    const faqs = clientService.getAllFAQ();

    res.json({
      success: true,
      data: faqs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Something went wrong." });
  }
});

/**
 * POST /api/clients/portal/:token/faq - Ask a question (CLIENT)
 */
router.post("/portal/:token/faq", async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ success: false, error: "Please enter your question." });
    }

    const answer = clientService.answerQuestion(question);

    res.json({
      success: true,
      data: {
        question,
        answer
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Something went wrong." });
  }
});

/**
 * POST /api/clients/portal/:token/contact - Send message to team (CLIENT)
 */
router.post("/portal/:token/contact", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { message } = req.body;
    if (typeof message !== "string" || !message.trim() || message.length > 4000) return res.status(400).json({ success: false, error: "A message of 1–4000 characters is required." });

    // Check expiration
    const expirationCheck = await checkPortalExpiration(token, res);
    if (!expirationCheck) return;

    // Find case
    const caseData = await prisma.case.findFirst({
      where: { publicAccessToken: token },
      select: { id: true, clientId: true }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: "We couldn't find your case."
      });
    }

    // Log communication
    await prisma.communication.create({
      data: {
        caseId: caseData.id,
        userId: caseData.clientId,
        type: "PORTAL_MESSAGE",
        direction: "INBOUND",
        content: message
      }
    });

    res.json({
      success: true,
      message: "Your message has been sent. We'll get back to you soon!"
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

function getOnboardingSteps(caseData: any): OnboardingStep[] {
  const hasInfo = caseData.client.name && caseData.client.phone;
  const hasId = caseData.documents.some((d: any) => d.type === "CLIENT_ID");
  const hasSignedDocs = caseData.documents.some((d: any) => d.signedAt);
  const required = caseData.documents.filter((d: any) => d.signatureRequired);
  const allDocsSigned = required.length > 0 && required.every((d: any) => d.status === "SIGNED" && d.signedAt);

  return [
    {
      id: "info",
      title: "Confirm Your Information",
      description: "Make sure your contact details are correct so we can reach you.",
      completed: hasInfo
    },
    {
      id: "id",
      title: "Upload Your ID",
      description: "We need a copy of your government-issued ID for verification.",
      completed: hasId
    },
    {
      id: "documents",
      title: "Review & Sign Documents",
      description: "Review and sign the documents to authorize us to act on your behalf.",
      completed: allDocsSigned
    },
    {
      id: "complete",
      title: "All Done!",
      description: "We'll handle everything from here. You can check back anytime for updates.",
      completed: allDocsSigned && hasId && hasInfo
    }
  ];
}

function getDocumentFriendlyName(type: string): string {
  const names: Record<string, string> = {
    CLIENT_SERVICE_AGREEMENT: "Service Agreement",
    LIMITED_POA: "Authorization Form",
    AFFIDAVIT: "Sworn Statement",
    CLIENT_ID: "ID Document",
    MOTION: "Court Filing",
    COVER_LETTER: "Cover Letter",
    FILING_PACKET: "Filing Documents",
    EVIDENCE_PACKET: "Supporting Documents",
    FOLLOW_UP_LETTER: "Follow-up Letter",
    VERIFICATION_LETTER: "Verification Letter",
    PAYMENT_INSTRUCTIONS: "Payment Information"
  };
  return names[type] || "Document";
}

export default router;
