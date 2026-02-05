// ============================================
// DOCUMENT VAULT SERVICE — MGR CAPITAL ASSISTANCE
// Sovereign, premium local document storage
// No external SaaS dependencies
// ============================================

import { DocumentType, DocumentStatus } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import prisma from "../lib/prisma.js";

// Base storage path - configurable via environment
const STORAGE_BASE_PATH = process.env.DOCUMENT_STORAGE_PATH ||
  path.join(process.cwd(), "storage", "documents");

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

interface UploadResult {
  success: boolean;
  documentId?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

interface VaultStats {
  totalDocuments: number;
  totalSizeBytes: number;
  documentsByType: { type: DocumentType; count: number }[];
  documentsByStatus: { status: DocumentStatus; count: number }[];
}

class DocumentVaultService {
  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the document vault storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(STORAGE_BASE_PATH, { recursive: true });
      console.log(`[DocumentVault] Initialized storage at: ${STORAGE_BASE_PATH}`);
    } catch (error) {
      console.error("[DocumentVault] Failed to initialize storage:", error);
      throw error;
    }
  }

  /**
   * Ensure case directory exists
   */
  private async ensureCaseDirectory(caseId: string): Promise<string> {
    const casePath = path.join(STORAGE_BASE_PATH, caseId);
    await fs.mkdir(casePath, { recursive: true });
    return casePath;
  }

  // ============================================
  // UPLOAD OPERATIONS
  // ============================================

  /**
   * Upload a document to the vault
   * Stores file locally with proper security measures
   */
  async uploadDocument(params: {
    caseId: string;
    type: DocumentType;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    uploadedById: string;
    signatureRequired?: boolean;
    generatedContent?: string;
  }): Promise<UploadResult> {
    try {
      // Validate file size
      if (params.buffer.length > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(params.mimeType)) {
        return {
          success: false,
          error: `File type not allowed: ${params.mimeType}`,
        };
      }

      // Verify case exists
      const caseRecord = await prisma.case.findUnique({
        where: { id: params.caseId },
      });

      if (!caseRecord) {
        return {
          success: false,
          error: "Case not found",
        };
      }

      // Ensure case directory exists
      const casePath = await this.ensureCaseDirectory(params.caseId);

      // Generate secure filename
      const timestamp = Date.now();
      const hash = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(params.fileName) || this.getExtensionFromMime(params.mimeType);
      const secureFileName = `${params.type}_${timestamp}_${hash}${ext}`;

      // Full file path
      const fullPath = path.join(casePath, secureFileName);

      // Relative path (for database storage)
      const relativePath = path.join(params.caseId, secureFileName);

      // Write file to disk
      await fs.writeFile(fullPath, params.buffer);

      // Create document record
      const document = await prisma.document.create({
        data: {
          caseId: params.caseId,
          type: params.type,
          status: "DRAFT",
          fileName: params.fileName,
          filePath: relativePath,
          fileUrl: `/api/documents/${params.caseId}/${secureFileName}`,
          fileSize: params.buffer.length,
          mimeType: params.mimeType,
          uploadedById: params.uploadedById,
          signatureRequired: params.signatureRequired || false,
          generatedContent: params.generatedContent,
        },
      });

      return {
        success: true,
        documentId: document.id,
        fileName: secureFileName,
        filePath: relativePath,
        fileSize: params.buffer.length,
      };
    } catch (error: any) {
      console.error("[DocumentVault] Upload failed:", error);
      return {
        success: false,
        error: error.message || "Upload failed",
      };
    }
  }

  /**
   * Upload from generated PDF/document
   */
  async uploadGeneratedDocument(params: {
    caseId: string;
    type: DocumentType;
    buffer: Buffer;
    uploadedById: string;
    generatedContent?: string;
  }): Promise<UploadResult> {
    const fileName = `${params.type.toLowerCase()}_${Date.now()}.pdf`;
    return this.uploadDocument({
      ...params,
      fileName,
      mimeType: "application/pdf",
    });
  }

  // ============================================
  // RETRIEVAL OPERATIONS
  // ============================================

  /**
   * Get document file stream for download
   * Returns the file buffer and metadata
   */
  async getDocumentFile(documentId: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    fileName?: string;
    mimeType?: string;
    error?: string;
  }> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return { success: false, error: "Document not found" };
      }

      if (!document.filePath) {
        return { success: false, error: "Document file path not set" };
      }

      const fullPath = path.join(STORAGE_BASE_PATH, document.filePath);

      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        return { success: false, error: "Document file not found on disk" };
      }

      const buffer = await fs.readFile(fullPath);

      return {
        success: true,
        buffer,
        fileName: document.fileName,
        mimeType: document.mimeType,
      };
    } catch (error: any) {
      console.error("[DocumentVault] Get file failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: {
          select: {
            id: true,
            internalCode: true,
            clientId: true,
            assignedEmployeeId: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get all documents for a case
   */
  async getCaseDocuments(caseId: string) {
    return prisma.document.findMany({
      where: { caseId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  /**
   * Update document status
   */
  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    metadata?: {
      signedAt?: Date;
      signatureUrl?: string;
      submittedAt?: Date;
      approvedAt?: Date;
      rejectedAt?: Date;
      rejectionReason?: string;
    }
  ) {
    return prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        ...metadata,
      },
    });
  }

  /**
   * Mark document as signed
   */
  async markAsSigned(documentId: string, signatureUrl?: string) {
    return this.updateStatus(documentId, "SIGNED", {
      signedAt: new Date(),
      signatureUrl,
    });
  }

  /**
   * Mark document as submitted
   */
  async markAsSubmitted(documentId: string) {
    return this.updateStatus(documentId, "SUBMITTED", {
      submittedAt: new Date(),
    });
  }

  /**
   * Approve document
   */
  async approveDocument(documentId: string) {
    return this.updateStatus(documentId, "APPROVED", {
      approvedAt: new Date(),
    });
  }

  /**
   * Reject document
   */
  async rejectDocument(documentId: string, reason: string) {
    return this.updateStatus(documentId, "REJECTED", {
      rejectedAt: new Date(),
      rejectionReason: reason,
    });
  }

  // ============================================
  // DELETE OPERATIONS
  // ============================================

  /**
   * Delete a document (file and record)
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return { success: false, error: "Document not found" };
      }

      // Delete file from disk if it exists
      if (document.filePath) {
        const fullPath = path.join(STORAGE_BASE_PATH, document.filePath);
        try {
          await fs.unlink(fullPath);
        } catch (err) {
          // File may not exist, continue with record deletion
          console.warn(`[DocumentVault] File not found for deletion: ${fullPath}`);
        }
      }

      // Delete database record
      await prisma.document.delete({
        where: { id: documentId },
      });

      return { success: true };
    } catch (error: any) {
      console.error("[DocumentVault] Delete failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // VAULT STATISTICS (FOUNDER ONLY)
  // ============================================

  /**
   * Get vault statistics
   */
  async getVaultStats(): Promise<VaultStats> {
    const [documents, byType, byStatus] = await Promise.all([
      prisma.document.aggregate({
        _count: true,
        _sum: { fileSize: true },
      }),
      prisma.document.groupBy({
        by: ["type"],
        _count: true,
      }),
      prisma.document.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    return {
      totalDocuments: documents._count,
      totalSizeBytes: documents._sum.fileSize || 0,
      documentsByType: byType.map((t) => ({
        type: t.type,
        count: t._count,
      })),
      documentsByStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    };
  }

  /**
   * Get storage usage by case
   */
  async getStorageByCase(limit: number = 20) {
    const results = await prisma.document.groupBy({
      by: ["caseId"],
      _count: true,
      _sum: { fileSize: true },
      orderBy: {
        _sum: {
          fileSize: "desc",
        },
      },
      take: limit,
    });

    return results.map((r) => ({
      caseId: r.caseId,
      documentCount: r._count,
      totalSizeBytes: r._sum.fileSize || 0,
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "text/plain": ".txt",
    };
    return mimeToExt[mimeType] || ".bin";
  }

  /**
   * Verify document access permissions
   */
  async verifyAccess(documentId: string, userId: string, userRole: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: {
          select: {
            clientId: true,
            assignedEmployeeId: true,
          },
        },
      },
    });

    if (!document) return false;

    // FOUNDER/ADMIN can access everything
    if (userRole === "FOUNDER" || userRole === "ADMIN") {
      return true;
    }

    // Employee can access documents for their assigned cases
    if (userRole === "EMPLOYEE" && document.case.assignedEmployeeId === userId) {
      return true;
    }

    // Client can access documents for their cases
    if (userRole === "CLIENT" && document.case.clientId === userId) {
      return true;
    }

    return false;
  }

  /**
   * Clean up orphaned files (files on disk without DB records)
   * FOUNDER ONLY - Use with caution
   */
  async cleanupOrphanedFiles(): Promise<{ removed: number; errors: string[] }> {
    let removed = 0;
    const errors: string[] = [];

    try {
      // Get all case directories
      const caseDirs = await fs.readdir(STORAGE_BASE_PATH);

      for (const caseDir of caseDirs) {
        const casePath = path.join(STORAGE_BASE_PATH, caseDir);
        const stat = await fs.stat(casePath);

        if (!stat.isDirectory()) continue;

        const files = await fs.readdir(casePath);

        for (const file of files) {
          const relativePath = path.join(caseDir, file);

          // Check if file has a corresponding DB record
          const document = await prisma.document.findFirst({
            where: { filePath: relativePath },
          });

          if (!document) {
            // Orphaned file - delete it
            try {
              await fs.unlink(path.join(casePath, file));
              removed++;
            } catch (err: any) {
              errors.push(`Failed to delete ${relativePath}: ${err.message}`);
            }
          }
        }
      }

      return { removed, errors };
    } catch (error: any) {
      errors.push(`Cleanup failed: ${error.message}`);
      return { removed, errors };
    }
  }
}

export const documentVaultService = new DocumentVaultService();
