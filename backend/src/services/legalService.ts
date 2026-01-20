// ============================================
// LEGAL AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready legal automation engine
// ============================================

import { PrismaClient, DocumentType, CaseStatus, DocumentStatus } from "@prisma/client";
import { getStateRule, calculateDeadline, calculateRedemptionDeadline, StateRuleData } from "../data/stateRules.js";
import { generateDocument, validateTemplateVariables, getTemplate } from "../data/documentTemplates.js";

const prisma = new PrismaClient();

// ============================================
// TYPES
// ============================================

interface CaseData {
  id: string;
  state: string;
  county: string;
  propertyAddress: string;
  parcelNumber?: string;
  saleDate?: Date;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientPhone: string;
  clientEmail: string;
  clientDob?: string;
  clientSsn4?: string;
  feePercent: number;
  internalCode: string;
}

interface DeadlineInfo {
  claimDeadline: Date | null;
  redemptionDeadline: Date | null;
  daysUntilClaimDeadline: number | null;
  daysUntilRedemptionDeadline: number | null;
  isUrgent: boolean;
  isExpired: boolean;
}

interface ComplianceCheck {
  isCompliant: boolean;
  issues: string[];
  warnings: string[];
  requiredDocuments: DocumentType[];
  missingDocuments: DocumentType[];
}

interface DocumentGenerationResult {
  success: boolean;
  documentId?: string;
  content?: string;
  error?: string;
  missingFields?: string[];
}

interface LegalRecommendation {
  action: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  deadline?: Date;
}

// ============================================
// LEGAL AI SERVICE CLASS
// ============================================

export class LegalService {
  // ----------------------------------------
  // STATE RULES
  // ----------------------------------------

  /**
   * Get legal rules for a specific state
   * FOUNDER ONLY - Contains sensitive legal strategy
   */
  getStateRules(stateCode: string): StateRuleData | null {
    const rule = getStateRule(stateCode);
    return rule || null;
  }

  /**
   * Get all states with their claim periods
   * FOUNDER ONLY
   */
  async getAllStateRules(): Promise<StateRuleData[]> {
    const { STATE_RULES } = await import("../data/stateRules.js");
    return STATE_RULES;
  }

  // ----------------------------------------
  // DEADLINE TRACKING
  // ----------------------------------------

  /**
   * Calculate all deadlines for a case
   */
  calculateDeadlines(stateCode: string, saleDate: Date): DeadlineInfo {
    const claimDeadline = calculateDeadline(stateCode, saleDate);
    const redemptionDeadline = calculateRedemptionDeadline(stateCode, saleDate);
    const now = new Date();

    let daysUntilClaimDeadline: number | null = null;
    let daysUntilRedemptionDeadline: number | null = null;
    let isUrgent = false;
    let isExpired = false;

    if (claimDeadline) {
      const diffTime = claimDeadline.getTime() - now.getTime();
      daysUntilClaimDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilClaimDeadline < 0) {
        isExpired = true;
      } else if (daysUntilClaimDeadline <= 90) {
        isUrgent = true;
      }
    }

    if (redemptionDeadline) {
      const diffTime = redemptionDeadline.getTime() - now.getTime();
      daysUntilRedemptionDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      claimDeadline,
      redemptionDeadline,
      daysUntilClaimDeadline,
      daysUntilRedemptionDeadline,
      isUrgent,
      isExpired
    };
  }

  /**
   * Create deadline records for a case
   */
  async createCaseDeadlines(caseId: string, stateCode: string, saleDate: Date): Promise<void> {
    const deadlines = this.calculateDeadlines(stateCode, saleDate);

    const deadlineRecords = [];

    if (deadlines.claimDeadline) {
      deadlineRecords.push({
        caseId,
        title: "Surplus Fund Claim Deadline",
        description: "Final deadline to file claim for surplus funds",
        dueDate: deadlines.claimDeadline
      });

      // Add 30-day warning
      const warningDate = new Date(deadlines.claimDeadline);
      warningDate.setDate(warningDate.getDate() - 30);
      if (warningDate > new Date()) {
        deadlineRecords.push({
          caseId,
          title: "30-Day Warning: Claim Deadline Approaching",
          description: "Surplus fund claim deadline is 30 days away",
          dueDate: warningDate
        });
      }
    }

    if (deadlines.redemptionDeadline) {
      deadlineRecords.push({
        caseId,
        title: "Redemption Period Deadline",
        description: "Deadline for property redemption",
        dueDate: deadlines.redemptionDeadline
      });
    }

    await prisma.deadline.createMany({
      data: deadlineRecords
    });
  }

  /**
   * Get all upcoming deadlines across cases
   */
  async getUpcomingDeadlines(daysAhead: number = 30): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return prisma.deadline.findMany({
      where: {
        dueDate: {
          gte: new Date(),
          lte: futureDate
        },
        completedAt: null
      },
      include: {
        case: {
          select: {
            id: true,
            internalCode: true,
            clientId: true,
            state: true,
            county: true,
            propertyAddress: true
          }
        }
      },
      orderBy: {
        dueDate: "asc"
      }
    });
  }

  // ----------------------------------------
  // COMPLIANCE VALIDATION
  // ----------------------------------------

  /**
   * Check compliance for a case
   */
  async checkCompliance(caseId: string): Promise<ComplianceCheck> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: true,
        client: true
      }
    });

    if (!caseData) {
      return {
        isCompliant: false,
        issues: ["Case not found"],
        warnings: [],
        requiredDocuments: [],
        missingDocuments: []
      };
    }

    const stateRule = getStateRule(caseData.state);
    const issues: string[] = [];
    const warnings: string[] = [];

    // Get required documents for state
    const requiredDocuments = stateRule?.requiredDocuments || [
      "AFFIDAVIT",
      "LIMITED_POA",
      "CLIENT_ID",
      "COVER_LETTER"
    ];

    // Check which documents are missing
    const existingDocTypes = caseData.documents
      .filter(d => d.status !== "REJECTED")
      .map(d => d.type);

    const missingDocuments = requiredDocuments.filter(
      docType => !existingDocTypes.includes(docType as DocumentType)
    );

    if (missingDocuments.length > 0) {
      issues.push(`Missing required documents: ${missingDocuments.join(", ")}`);
    }

    // Check document signatures
    const unsignedDocs = caseData.documents.filter(
      d => d.signatureRequired && !d.signedAt
    );
    if (unsignedDocs.length > 0) {
      issues.push(`${unsignedDocs.length} document(s) awaiting signature`);
    }

    // Check client information
    if (!caseData.client.phone) {
      warnings.push("Client phone number missing");
    }
    if (!caseData.client.email) {
      warnings.push("Client email missing");
    }

    // Check deadlines
    if (caseData.saleDate) {
      const deadlines = this.calculateDeadlines(caseData.state, caseData.saleDate);
      if (deadlines.isExpired) {
        issues.push("CRITICAL: Claim deadline has passed");
      } else if (deadlines.isUrgent) {
        warnings.push(`Urgent: Only ${deadlines.daysUntilClaimDeadline} days until claim deadline`);
      }
    } else {
      warnings.push("Sale date not recorded - cannot calculate deadlines");
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      warnings,
      requiredDocuments: requiredDocuments as DocumentType[],
      missingDocuments: missingDocuments as DocumentType[]
    };
  }

  /**
   * Validate ID document
   */
  validateIdDocument(document: { mimeType: string; fileSize: number }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(document.mimeType)) {
      errors.push("Invalid file type. Please upload JPG, PNG, or PDF.");
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (document.fileSize > maxSize) {
      errors.push("File too large. Maximum size is 10MB.");
    }

    // Check minimum size (at least 50KB for quality)
    const minSize = 50 * 1024;
    if (document.fileSize < minSize) {
      errors.push("File too small. Please upload a higher quality image.");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ----------------------------------------
  // DOCUMENT GENERATION
  // ----------------------------------------

  /**
   * Generate a document for a case
   */
  async generateCaseDocument(
    caseId: string,
    documentType: DocumentType,
    additionalVariables: Record<string, string> = {}
  ): Promise<DocumentGenerationResult> {
    // Fetch case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        stateRule: true,
        countyRule: true
      }
    });

    if (!caseData) {
      return { success: false, error: "Case not found" };
    }

    // Build template variables
    const variables: Record<string, string> = {
      CLIENT_NAME: caseData.client.name,
      CLIENT_ADDRESS: caseData.client.address || "",
      CLIENT_CITY: caseData.client.city || "",
      CLIENT_STATE: caseData.client.state || "",
      CLIENT_ZIP: caseData.client.zipCode || "",
      CLIENT_PHONE: caseData.client.phone || "",
      CLIENT_EMAIL: caseData.client.email,
      CLIENT_DOB: caseData.client.dateOfBirth?.toLocaleDateString() || "",
      CLIENT_SSN_LAST_4: caseData.client.ssn4 || "",
      PROPERTY_ADDRESS: caseData.propertyAddress,
      PROPERTY_COUNTY: caseData.county,
      PROPERTY_STATE: caseData.state,
      PARCEL_NUMBER: caseData.parcelNumber || "",
      SALE_DATE: caseData.saleDate?.toLocaleDateString() || "",
      TODAY_DATE: new Date().toLocaleDateString(),
      CASE_NUMBER: caseData.internalCode,
      FEE_PERCENT: caseData.feePercent.toString(),
      COURT_CASE_NUMBER: caseData.courtCaseNumber || "",
      CLERK_NAME: caseData.countyRule?.clerkName || `${caseData.county} County Clerk`,
      CLERK_ADDRESS: caseData.countyRule?.clerkAddress || "",
      ...additionalVariables
    };

    // Validate required fields
    const validation = validateTemplateVariables(documentType, variables);
    if (!validation.valid) {
      return {
        success: false,
        error: "Missing required fields",
        missingFields: validation.missing
      };
    }

    // Generate document content
    const content = generateDocument(documentType, variables);
    if (!content) {
      return { success: false, error: "Template not found" };
    }

    // Get template info
    const template = getTemplate(documentType);

    // Create document record
    const document = await prisma.document.create({
      data: {
        caseId,
        type: documentType,
        status: "DRAFT",
        fileName: `${documentType}_${caseData.internalCode}_${Date.now()}.txt`,
        fileUrl: "", // Will be set after file storage
        fileSize: content.length,
        mimeType: "text/plain",
        generatedContent: content,
        signatureRequired: this.requiresSignature(documentType),
        uploadedById: caseData.clientId // System-generated, attributed to client
      }
    });

    return {
      success: true,
      documentId: document.id,
      content
    };
  }

  /**
   * Generate all required documents for a case
   */
  async generateAllRequiredDocuments(caseId: string): Promise<{
    success: boolean;
    generated: string[];
    failed: { type: string; error: string }[];
  }> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { state: true }
    });

    if (!caseData) {
      return { success: false, generated: [], failed: [{ type: "ALL", error: "Case not found" }] };
    }

    const stateRule = getStateRule(caseData.state);
    const requiredDocTypes = stateRule?.requiredDocuments || [
      "CLIENT_SERVICE_AGREEMENT",
      "LIMITED_POA",
      "AFFIDAVIT",
      "COVER_LETTER"
    ];

    const generated: string[] = [];
    const failed: { type: string; error: string }[] = [];

    for (const docType of requiredDocTypes) {
      const result = await this.generateCaseDocument(caseId, docType as DocumentType);
      if (result.success) {
        generated.push(docType);
      } else {
        failed.push({ type: docType, error: result.error || "Unknown error" });
      }
    }

    return {
      success: failed.length === 0,
      generated,
      failed
    };
  }

  /**
   * Check if document type requires signature
   */
  private requiresSignature(documentType: DocumentType): boolean {
    const signatureRequired = [
      "CLIENT_SERVICE_AGREEMENT",
      "LIMITED_POA",
      "AFFIDAVIT"
    ];
    return signatureRequired.includes(documentType);
  }

  // ----------------------------------------
  // LEGAL RECOMMENDATIONS
  // ----------------------------------------

  /**
   * Get legal recommendations for a case
   * FOUNDER ONLY - Contains strategic legal advice
   */
  async getLegalRecommendations(caseId: string): Promise<LegalRecommendation[]> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: true,
        deadlines: true,
        client: true
      }
    });

    if (!caseData) {
      return [];
    }

    const recommendations: LegalRecommendation[] = [];
    const stateRule = getStateRule(caseData.state);

    // Check deadlines
    if (caseData.saleDate) {
      const deadlines = this.calculateDeadlines(caseData.state, caseData.saleDate);

      if (deadlines.isExpired) {
        recommendations.push({
          action: "CASE_REVIEW_REQUIRED",
          priority: "HIGH",
          reason: "Claim deadline has passed. Review if any exceptions or extensions apply."
        });
      } else if (deadlines.isUrgent && deadlines.daysUntilClaimDeadline) {
        recommendations.push({
          action: "EXPEDITE_FILING",
          priority: "HIGH",
          reason: `Only ${deadlines.daysUntilClaimDeadline} days until claim deadline. Expedite document preparation and filing.`,
          deadline: deadlines.claimDeadline || undefined
        });
      }
    }

    // Check case status and recommend next steps
    switch (caseData.status) {
      case "NEW":
        recommendations.push({
          action: "INITIATE_CONTACT",
          priority: "HIGH",
          reason: "New case requires initial client contact."
        });
        break;

      case "CONTACTED":
        recommendations.push({
          action: "SEND_DOCUMENTS",
          priority: "MEDIUM",
          reason: "Client contacted. Prepare and send service agreement and required documents."
        });
        break;

      case "DOCS_PENDING":
        const unsignedDocs = caseData.documents.filter(d => d.signatureRequired && !d.signedAt);
        if (unsignedDocs.length > 0) {
          recommendations.push({
            action: "FOLLOW_UP_SIGNATURES",
            priority: "MEDIUM",
            reason: `${unsignedDocs.length} document(s) awaiting client signature.`
          });
        }
        break;

      case "DOCS_SIGNED":
        recommendations.push({
          action: "FILE_CLAIM",
          priority: "HIGH",
          reason: "All documents signed. Ready to file claim with county."
        });

        if (stateRule?.filingMethod === "in-person") {
          recommendations.push({
            action: "SCHEDULE_COURT_APPEARANCE",
            priority: "MEDIUM",
            reason: `${caseData.state} requires in-person filing or court appearance.`
          });
        }
        break;

      case "FILED":
        recommendations.push({
          action: "MONITOR_STATUS",
          priority: "LOW",
          reason: "Claim filed. Monitor for county response."
        });
        break;

      case "AWAITING_FUNDS":
        recommendations.push({
          action: "PREPARE_DISBURSEMENT",
          priority: "MEDIUM",
          reason: "Funds approved. Prepare disbursement instructions."
        });
        break;
    }

    // Check for filing fee
    if (stateRule?.filingFee && stateRule.filingFee > 0 &&
        caseData.status === "DOCS_SIGNED") {
      recommendations.push({
        action: "PREPARE_FILING_FEE",
        priority: "MEDIUM",
        reason: `${caseData.state} requires $${(stateRule.filingFee / 100).toFixed(2)} filing fee.`
      });
    }

    // Check for court filing requirement
    if (stateRule?.filingMethod === "in-person" &&
        !["FILED", "AWAITING_FUNDS", "PAID"].includes(caseData.status)) {
      recommendations.push({
        action: "PREPARE_COURT_MOTION",
        priority: "MEDIUM",
        reason: `${caseData.state} requires court filing. Prepare motion for disbursement.`
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get next legal action for a case (simplified for employees)
   * SAFE FOR EMPLOYEES - No sensitive info
   */
  getNextAction(status: CaseStatus): string {
    const actions: Record<CaseStatus, string> = {
      NEW: "Contact client and explain the process",
      CONTACTED: "Send documents for review and signature",
      DOCS_PENDING: "Follow up on pending document signatures",
      DOCS_SIGNED: "Documents ready - internal processing in progress",
      FILED: "Claim filed - awaiting county response",
      AWAITING_FUNDS: "Funds approved - processing disbursement",
      PAID: "Case complete",
      CLOSED: "Case closed",
      REJECTED: "Case rejected - review for appeal options"
    };
    return actions[status] || "Contact supervisor for guidance";
  }

  // ----------------------------------------
  // AUTO-CORRECTION FOR REJECTED FILINGS
  // ----------------------------------------

  /**
   * Analyze rejection and suggest corrections
   * FOUNDER ONLY
   */
  async analyzeRejection(
    caseId: string,
    rejectionReason: string
  ): Promise<{
    analysis: string;
    suggestedActions: string[];
    canAutoCorrect: boolean;
  }> {
    const suggestedActions: string[] = [];
    let canAutoCorrect = false;

    // Common rejection patterns and solutions
    const patterns = [
      {
        keywords: ["signature", "not signed", "unsigned"],
        analysis: "Document signature issue detected.",
        actions: ["Verify all required documents are signed", "Re-send documents for signature", "Check signature validity"],
        autoCorrect: false
      },
      {
        keywords: ["notary", "notarization", "not notarized"],
        analysis: "Notarization issue detected.",
        actions: ["Ensure all required documents are properly notarized", "Re-schedule notarization appointment"],
        autoCorrect: false
      },
      {
        keywords: ["id", "identification", "identity"],
        analysis: "Identity verification issue detected.",
        actions: ["Request clearer copy of ID", "Verify ID is current and not expired", "Ensure name matches exactly"],
        autoCorrect: true
      },
      {
        keywords: ["deadline", "expired", "late", "untimely"],
        analysis: "Deadline-related rejection.",
        actions: ["Review applicable deadlines", "Check for possible extensions or exceptions", "Consult legal counsel if necessary"],
        autoCorrect: false
      },
      {
        keywords: ["proof", "evidence", "documentation"],
        analysis: "Additional documentation required.",
        actions: ["Review rejection notice for specific requirements", "Gather and submit additional evidence", "Regenerate evidence packet"],
        autoCorrect: true
      },
      {
        keywords: ["ownership", "title", "chain"],
        analysis: "Ownership verification issue.",
        actions: ["Obtain title search results", "Provide chain of title documentation", "Submit additional proof of ownership"],
        autoCorrect: true
      },
      {
        keywords: ["fee", "payment", "filing fee"],
        analysis: "Filing fee issue detected.",
        actions: ["Verify correct fee amount", "Resubmit with proper payment", "Request fee waiver if applicable"],
        autoCorrect: true
      }
    ];

    const lowerReason = rejectionReason.toLowerCase();
    let matched = false;

    for (const pattern of patterns) {
      if (pattern.keywords.some(kw => lowerReason.includes(kw))) {
        suggestedActions.push(...pattern.actions);
        if (pattern.autoCorrect) canAutoCorrect = true;
        matched = true;
      }
    }

    if (!matched) {
      suggestedActions.push(
        "Review rejection notice carefully",
        "Contact county clerk for clarification",
        "Consult legal counsel if needed"
      );
    }

    // Update case with rejection info
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: "REJECTED",
        rejectionReason
      }
    });

    return {
      analysis: matched ? "Automated analysis complete. See suggested actions." : "Manual review required.",
      suggestedActions: [...new Set(suggestedActions)], // Remove duplicates
      canAutoCorrect
    };
  }
}

export const legalService = new LegalService();
