// ============================================
// DOCUMENT LIFECYCLE — MGR CAPITAL ASSISTANCE
// State machine for document status transitions
// ============================================

import { DocumentStatus, DocumentType } from "@prisma/client";

/**
 * Valid status transitions for documents
 * Each status maps to an array of statuses it can transition TO
 */
const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["PENDING_SIGNATURE", "SUBMITTED", "REJECTED"],
  PENDING_SIGNATURE: ["SIGNED", "DRAFT", "REJECTED"],
  SIGNED: ["SUBMITTED", "PENDING_SIGNATURE"], // Can revert if signature issue
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: [], // Terminal success state
  REJECTED: ["DRAFT", "PENDING_SIGNATURE"] // Can be reopened for revision
};

/**
 * Documents that require client signature
 */
const SIGNATURE_REQUIRED_TYPES: DocumentType[] = [
  "CLIENT_SERVICE_AGREEMENT",
  "LIMITED_POA",
  "AFFIDAVIT"
];

/**
 * Documents that are uploaded by client (not generated)
 */
const CLIENT_UPLOAD_TYPES: DocumentType[] = [
  "CLIENT_ID",
  "PROPERTY_DEED",
  "TAX_RECORD"
];

/**
 * Validate if a document status transition is allowed
 */
export function isValidDocumentTransition(
  currentStatus: DocumentStatus,
  newStatus: DocumentStatus
): boolean {
  if (currentStatus === newStatus) return true; // No-op is always valid
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get list of valid next statuses from current status
 */
export function getValidNextDocumentStatuses(currentStatus: DocumentStatus): DocumentStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Validate transition with full document data
 */
export function validateDocumentTransition(
  currentStatus: DocumentStatus,
  newStatus: DocumentStatus,
  documentData: any
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if transition is valid
  if (!isValidDocumentTransition(currentStatus, newStatus)) {
    errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`);
    return { valid: false, errors, warnings };
  }

  // Specific validation for certain transitions
  if (newStatus === "SIGNED") {
    // Verify signature data exists
    if (SIGNATURE_REQUIRED_TYPES.includes(documentData.type)) {
      if (!documentData.signatureData && !documentData.signedAt) {
        warnings.push("Document marked as signed but no signature data recorded");
      }
    }
  }

  if (newStatus === "SUBMITTED") {
    // For signature-required docs, must be signed first
    if (SIGNATURE_REQUIRED_TYPES.includes(documentData.type)) {
      if (currentStatus !== "SIGNED") {
        errors.push("Document must be signed before submission");
      }
    }

    // Check file exists for uploaded documents
    if (CLIENT_UPLOAD_TYPES.includes(documentData.type)) {
      if (!documentData.filePath && !documentData.fileUrl) {
        warnings.push("No file attached to document");
      }
    }
  }

  if (newStatus === "REJECTED") {
    warnings.push("Document is being rejected. Ensure rejection reason is documented.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if document type requires client signature
 */
export function requiresSignature(type: DocumentType): boolean {
  return SIGNATURE_REQUIRED_TYPES.includes(type);
}

/**
 * Check if document is a client upload type
 */
export function isClientUploadType(type: DocumentType): boolean {
  return CLIENT_UPLOAD_TYPES.includes(type);
}

/**
 * Get human-readable document status label
 */
export function getDocumentStatusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    DRAFT: "Draft",
    PENDING_SIGNATURE: "Awaiting Signature",
    SIGNED: "Signed",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected"
  };
  return labels[status] || status;
}

/**
 * Get client-friendly document status message
 */
export function getClientDocumentStatus(status: DocumentStatus, type: DocumentType): {
  status: string;
  message: string;
  actionRequired: boolean;
} {
  if (status === "PENDING_SIGNATURE" && requiresSignature(type)) {
    return {
      status: "Action Required",
      message: "Please review and sign this document",
      actionRequired: true
    };
  }

  if (status === "DRAFT" && isClientUploadType(type)) {
    return {
      status: "Upload Required",
      message: "Please upload this document",
      actionRequired: true
    };
  }

  const statusMessages: Record<DocumentStatus, { status: string; message: string; actionRequired: boolean }> = {
    DRAFT: { status: "Preparing", message: "Document is being prepared", actionRequired: false },
    PENDING_SIGNATURE: { status: "Awaiting Signature", message: "Waiting for signature", actionRequired: false },
    SIGNED: { status: "Signed", message: "Thank you for signing", actionRequired: false },
    SUBMITTED: { status: "Processing", message: "Document has been submitted", actionRequired: false },
    APPROVED: { status: "Complete", message: "Document approved", actionRequired: false },
    REJECTED: { status: "Needs Attention", message: "Please contact us about this document", actionRequired: true }
  };

  return statusMessages[status];
}

/**
 * Get auto-update fields when transitioning to a status
 */
export function getDocumentAutoUpdateFields(
  newStatus: DocumentStatus
): Record<string, any> {
  const updates: Record<DocumentStatus, Record<string, any>> = {
    DRAFT: {},
    PENDING_SIGNATURE: { sentForSignatureAt: new Date() },
    SIGNED: { signedAt: new Date() },
    SUBMITTED: { submittedAt: new Date() },
    APPROVED: { approvedAt: new Date() },
    REJECTED: { rejectedAt: new Date() }
  };
  return updates[newStatus] || {};
}

/**
 * Validate all required documents are signed for a case
 */
export function validateRequiredDocuments(
  documents: Array<{ type: DocumentType; status: DocumentStatus }>
): { complete: boolean; missing: DocumentType[]; unsigned: DocumentType[] } {
  const required: DocumentType[] = ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA"];
  const missing: DocumentType[] = [];
  const unsigned: DocumentType[] = [];

  for (const type of required) {
    const doc = documents.find(d => d.type === type);
    if (!doc) {
      missing.push(type);
    } else if (doc.status !== "SIGNED" && doc.status !== "SUBMITTED" && doc.status !== "APPROVED") {
      unsigned.push(type);
    }
  }

  return {
    complete: missing.length === 0 && unsigned.length === 0,
    missing,
    unsigned
  };
}
