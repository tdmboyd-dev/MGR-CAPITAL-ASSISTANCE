// ============================================
// DOCUMENT VAULT ROUTES — MGR CAPITAL ASSISTANCE
// Secure document upload/download endpoints
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { documentVaultService } from "../services/documentVaultService.js";
import { DocumentType } from "@prisma/client";
import multer from "multer";

import prisma from "../lib/prisma.js";

const router = Router();

// Configure multer for memory storage (we'll handle saving ourselves)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// All routes require authentication
router.use(authMiddleware);

// ============================================
// CLIENT PORTAL ENDPOINTS
// IMPORTANT: These must come BEFORE /:id routes
// ============================================

/**
 * GET /api/documents/my-documents
 * Get all documents for the authenticated client's cases
 * Used by client portal
 */
router.get("/my-documents", roleGuard(["CLIENT"]), async (req: AuthRequest, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        case: {
          clientId: req.user!.id
        }
      },
      select: {
        id: true,
        type: true,
        status: true,
        fileName: true,
        filePath: true,
        fileSize: true,
        mimeType: true,
        signedAt: true,
        signatureRequired: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            caseCode: true,
            propertyAddress: true,
            county: true,
            state: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Transform for client-friendly response
    const clientDocs = documents.map(d => ({
      ...d,
      needsSignature: d.signatureRequired && !d.signedAt,
      signed: !!d.signedAt,
      caseId: d.case?.id
    }));

    res.json({
      success: true,
      count: documents.length,
      data: clientDocs
    });
  } catch (error: any) {
    console.error("Client documents error:", error);
    res.status(500).json({ success: false, error: "Failed to load your documents" });
  }
});

// ============================================
// LIST ALL DOCUMENTS
// ============================================

/**
 * GET /api/documents
 * List all documents (FOUNDER/ADMIN see all, others see their own)
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const where: any = {};

    // Non-founders only see documents from their cases
    if (user.role !== "FOUNDER" && user.role !== "ADMIN") {
      where.OR = [
        { uploadedById: user.userId },
        { case: { assignedEmployeeId: user.userId } },
        { case: { clientId: user.userId } },
      ];
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
        case: { select: { id: true, caseCode: true, state: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ success: true, documents, total: documents.length });
  } catch (error: any) {
    console.error("List documents error:", error);
    res.status(500).json({ success: false, error: "Failed to list documents" });
  }
});

// ============================================
// UPLOAD ENDPOINTS
// ============================================

/**
 * POST /api/documents/:caseId/upload
 * Upload a document to a case
 * Auth: FOUNDER, ADMIN, EMPLOYEE (for assigned cases), CLIENT (for their cases)
 */
router.post(
  "/:caseId/upload",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { caseId } = req.params;
      const { type, signatureRequired } = req.body;
      const file = req.file;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: "No file provided",
        });
      }

      if (!type || !Object.values(DocumentType).includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid document type",
        });
      }

      if (!userId || !userRole) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Upload the document
      const result = await documentVaultService.uploadDocument({
        caseId,
        type: type as DocumentType,
        fileName: file.originalname,
        buffer: file.buffer,
        mimeType: file.mimetype,
        uploadedById: userId,
        signatureRequired: signatureRequired === "true",
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          documentId: result.documentId,
          fileName: result.fileName,
          fileSize: result.fileSize,
        },
      });
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to upload document",
      });
    }
  }
);

// ============================================
// DOWNLOAD ENDPOINTS
// ============================================

/**
 * GET /api/documents/:id/download
 * Download a document
 * Auth: Role + ownership checks
 */
router.get("/:id/download", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Verify access
    const hasAccess = await documentVaultService.verifyAccess(id, userId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Get the file
    const result = await documentVaultService.getDocumentFile(id);

    if (!result.success || !result.buffer) {
      return res.status(404).json({
        success: false,
        error: result.error || "Document not found",
      });
    }

    // Set headers for download
    res.setHeader("Content-Type", result.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(result.fileName || "document")}"`
    );
    res.setHeader("Content-Length", result.buffer.length);

    // Send the file
    res.send(result.buffer);
  } catch (error: any) {
    console.error("Document download error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to download document",
    });
  }
});

/**
 * GET /api/documents/:id/view
 * View a document inline (for PDFs, images)
 * Auth: Role + ownership checks
 */
router.get("/:id/view", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Verify access
    const hasAccess = await documentVaultService.verifyAccess(id, userId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Get the file
    const result = await documentVaultService.getDocumentFile(id);

    if (!result.success || !result.buffer) {
      return res.status(404).json({
        success: false,
        error: result.error || "Document not found",
      });
    }

    // Set headers for inline viewing
    res.setHeader("Content-Type", result.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(result.fileName || "document")}"`);
    res.setHeader("Content-Length", result.buffer.length);

    // Send the file
    res.send(result.buffer);
  } catch (error: any) {
    console.error("Document view error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to view document",
    });
  }
});

// ============================================
// METADATA ENDPOINTS
// ============================================

/**
 * GET /api/documents/:id
 * Get document metadata
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Verify access
    const hasAccess = await documentVaultService.verifyAccess(id, userId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const document = await documentVaultService.getDocumentMetadata(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error("Document metadata error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get document metadata",
    });
  }
});

/**
 * GET /api/documents/case/:caseId
 * Get all documents for a case
 */
router.get("/case/:caseId", async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    const documents = await documentVaultService.getCaseDocuments(caseId);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error: any) {
    console.error("Case documents error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get case documents",
    });
  }
});

// ============================================
// STATUS MANAGEMENT ENDPOINTS
// ============================================

/**
 * PATCH /api/documents/:id/sign
 * Mark document as signed
 */
router.patch("/:id/sign", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signatureUrl } = req.body;

    const document = await documentVaultService.markAsSigned(id, signatureUrl);

    res.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error("Document sign error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark document as signed",
    });
  }
});

/**
 * PATCH /api/documents/:id/submit
 * Mark document as submitted
 */
router.patch(
  "/:id/submit",
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await documentVaultService.markAsSubmitted(id);

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      console.error("Document submit error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark document as submitted",
      });
    }
  }
);

/**
 * PATCH /api/documents/:id/approve
 * Approve document (FOUNDER/ADMIN only)
 */
router.patch(
  "/:id/approve",
  roleGuard(["FOUNDER", "ADMIN"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await documentVaultService.approveDocument(id);

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      console.error("Document approve error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to approve document",
      });
    }
  }
);

/**
 * PATCH /api/documents/:id/reject
 * Reject document (FOUNDER/ADMIN only)
 */
router.patch(
  "/:id/reject",
  roleGuard(["FOUNDER", "ADMIN"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: "Rejection reason is required",
        });
      }

      const document = await documentVaultService.rejectDocument(id, reason);

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      console.error("Document reject error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reject document",
      });
    }
  }
);

// ============================================
// DELETE ENDPOINTS
// ============================================

/**
 * DELETE /api/documents/:id
 * Delete a document (FOUNDER/ADMIN only)
 */
router.delete(
  "/:id",
  roleGuard(["FOUNDER", "ADMIN"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await documentVaultService.deleteDocument(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error: any) {
      console.error("Document delete error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete document",
      });
    }
  }
);

// ============================================
// VAULT MANAGEMENT (FOUNDER ONLY)
// ============================================

/**
 * GET /api/documents/vault/stats
 * Get vault statistics
 */
router.get(
  "/vault/stats",
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const stats = await documentVaultService.getVaultStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Vault stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get vault statistics",
      });
    }
  }
);

/**
 * GET /api/documents/vault/storage-by-case
 * Get storage usage by case
 */
router.get(
  "/vault/storage-by-case",
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await documentVaultService.getStorageByCase(limit);

      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error("Storage by case error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get storage by case",
      });
    }
  }
);

/**
 * POST /api/documents/vault/cleanup
 * Clean up orphaned files (FOUNDER only)
 */
router.post(
  "/vault/cleanup",
  roleGuard(["FOUNDER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await documentVaultService.cleanupOrphanedFiles();

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Vault cleanup error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cleanup vault",
      });
    }
  }
);

export default router;
