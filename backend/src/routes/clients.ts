// ============================================
// CLIENTS API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready client portal endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, DocumentStatus, DocumentType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { clientService } from "../services/clientService.js";
import { legalService } from "../services/legalService.js";
import {
  isValidDocumentTransition,
  validateDocumentTransition,
  getDocumentAutoUpdateFields,
  getValidNextDocumentStatuses
} from "../utils/documentLifecycle.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/clients - List all clients (FOUNDER ONLY)
 */
router.get("/", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.user.findMany({
      where: { role: "CLIENT" },
      select: {
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
router.get("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const client = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "CLIENT"
      },
      include: {
        clientCases: {
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

    res.json({
      success: true,
      data: {
        ...client,
        passwordHash: undefined
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
router.post("/", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, phone, address, city, state, zipCode, dateOfBirth, ssn4 } = req.body;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already in use" });
    }

    const client = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        address,
        city,
        state,
        zipCode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        ssn4,
        role: "CLIENT",
        passwordHash: "", // Clients don't login with password
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "CLIENT_CREATED",
        entityType: "USER",
        entityId: client.id,
        details: { email, name }
      }
    });

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
router.post("/documents/:documentId/status", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId } = req.params;
  const { status, notes, forceTransition } = req.body;

  const validStatuses: DocumentStatus[] = [
    "DRAFT", "PENDING_SIGNATURE", "SIGNED", "SUBMITTED", "APPROVED", "REJECTED"
  ];

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
router.patch("/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, address, city, state, zipCode, dateOfBirth, ssn4 } = req.body;

    const client = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        address,
        city,
        state,
        zipCode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        ssn4
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "CLIENT_UPDATED",
        entityType: "USER",
        entityId: id,
        details: { updatedFields: Object.keys(req.body) }
      }
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
router.post("/portal-link/:caseId", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { caseId } = req.params;
  const { action, email, phone } = req.body; // action: "copy" | "email" | "sms"

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      client: { select: { name: true, email: true, phone: true } }
    }
  });

  if (!caseData) {
    throw Errors.notFound("Case");
  }

  const portalUrl = `${process.env.API_BASE_URL?.replace(':4000', ':3011') || 'http://localhost:3011'}/client/portal?token=${caseData.publicAccessToken}`;
  const signPortalUrl = `${process.env.API_BASE_URL?.replace(':4000', ':3011') || 'http://localhost:3011'}/client/sign-portal?token=${caseData.publicAccessToken}`;

  // If portal is expired and not kept alive, re-activate it
  if (caseData.portalExpiresAt && new Date() > caseData.portalExpiresAt && !caseData.portalKeptAlive) {
    // Sending a new link resets the expiration
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + caseData.portalDissolveAfterDays);
    await prisma.case.update({
      where: { id: caseId },
      data: { portalExpiresAt: newExpiry }
    });
  }

  // Log the portal link action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "PORTAL_LINK_GENERATED",
      entityType: "CASE",
      entityId: caseId,
      details: { action, portalUrl, signPortalUrl }
    }
  });

  // Log communication if sending
  if (action === "email" || action === "sms") {
    await prisma.communication.create({
      data: {
        caseId: caseData.id,
        userId: req.user!.id,
        type: action === "email" ? "EMAIL" : "TEXT",
        direction: "OUTBOUND",
        content: `Portal link sent to client: ${portalUrl}`,
        toAddress: action === "email" ? (email || caseData.client.email) : (phone || caseData.client.phone || "")
      }
    });
  }

  res.json({
    success: true,
    data: {
      portalUrl,
      signPortalUrl,
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
router.patch("/portal-settings/:caseId", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { caseId } = req.params;
  const { portalKeptAlive, portalDissolveAfterDays, portalExpiresAt } = req.body;

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
router.post("/auto-expire-portals", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Find all PAID cases without expiration set and not kept alive
  const paidCases = await prisma.case.findMany({
    where: {
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
      portalExpiresAt: true,
      portalKeptAlive: true,
      status: true
    }
  });

  if (!caseData) {
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
            status: { in: ["PENDING_SIGNATURE", "SIGNED", "SUBMITTED"] }
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
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
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
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
  }
});

/**
 * POST /api/clients/portal/:token/id-upload - Upload ID document (CLIENT)
 */
router.post("/portal/:token/id-upload", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { fileName, fileUrl, fileSize, mimeType } = req.body;

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

    // Validate ID document
    const validation = legalService.validateIdDocument({ mimeType, fileSize });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(" ")
      });
    }

    // Create document record
    await prisma.document.create({
      data: {
        caseId: caseData.id,
        type: "CLIENT_ID",
        status: "SUBMITTED",
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        signatureRequired: false,
        uploadedById: caseData.clientId
      }
    });

    res.json({
      success: true,
      message: "Your ID has been uploaded successfully. Thank you!"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
  }
});

/**
 * POST /api/clients/portal/:token/sign/:documentId - Sign a document (CLIENT)
 */
router.post("/portal/:token/sign/:documentId", async (req: Request, res: Response) => {
  try {
    const { token, documentId } = req.params;
    const { signatureData } = req.body;

    if (!signatureData) {
      return res.status(400).json({
        success: false,
        error: "Signature data is required."
      });
    }

    // Check expiration
    const expirationCheck = await checkPortalExpiration(token, res);
    if (!expirationCheck) return;

    // Verify case and document
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        caseId: caseData.id,
        signatureRequired: true,
        signedAt: null
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "This document is not available for signing."
      });
    }

    // Validate the transition using lifecycle
    const currentStatus = document.status as DocumentStatus;
    const newStatus: DocumentStatus = "SIGNED";

    if (!isValidDocumentTransition(currentStatus, newStatus)) {
      return res.status(400).json({
        success: false,
        error: `This document cannot be signed in its current state.`
      });
    }

    // Record signature with auto-update fields
    const autoFields = getDocumentAutoUpdateFields(newStatus);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        signatureUrl: signatureData,
        ...autoFields
      }
    });

    // Log the signing action
    await prisma.auditLog.create({
      data: {
        userId: caseData.clientId,
        action: "DOCUMENT_SIGNED",
        entityType: "DOCUMENT",
        entityId: documentId,
        details: { documentType: document.type, caseId: caseData.id }
      }
    });

    // Check if all documents are signed
    const pendingDocs = await prisma.document.count({
      where: {
        caseId: caseData.id,
        signatureRequired: true,
        signedAt: null
      }
    });

    // Update case status if all docs signed
    if (pendingDocs === 0) {
      await prisma.case.update({
        where: { id: caseData.id },
        data: { status: "DOCS_SIGNED" }
      });

      await prisma.auditLog.create({
        data: {
          userId: caseData.clientId,
          action: "ALL_DOCUMENTS_SIGNED",
          entityType: "CASE",
          entityId: caseData.id,
          details: { autoTransitioned: true }
        }
      });
    }

    res.json({
      success: true,
      message: "Document signed successfully. Thank you!"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
  }
});

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
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
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
  const allDocsSigned = caseData.documents
    .filter((d: any) => d.signatureRequired)
    .every((d: any) => d.signedAt);

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
