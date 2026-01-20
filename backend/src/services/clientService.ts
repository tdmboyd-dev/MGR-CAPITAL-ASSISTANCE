// ============================================
// CLIENT AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready client portal intelligence
// Human-friendly, simple, no backend exposure
// ============================================

import { PrismaClient, CaseStatus, DocumentStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// CLIENT-SAFE MESSAGES
// No surplus amounts, no legal strategy, no backend logic
// ============================================

interface ClientStatusInfo {
  title: string;
  description: string;
  nextStep: string;
  canUploadId: boolean;
  canSignDocuments: boolean;
  showProgress: boolean;
  progressPercent: number;
}

const CLIENT_STATUS_INFO: Record<CaseStatus, ClientStatusInfo> = {
  NEW: {
    title: "Getting Started",
    description: "We're setting up your case. You'll hear from us soon.",
    nextStep: "A representative will contact you shortly to explain the process.",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 10
  },
  CONTACTED: {
    title: "Let's Get Started",
    description: "Thank you for speaking with us! We're here to help you through this process.",
    nextStep: "Review your information and upload a photo of your ID when ready.",
    canUploadId: true,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 20
  },
  DOCS_PENDING: {
    title: "Documents Ready for Review",
    description: "Your documents are ready. Please review and sign them at your convenience.",
    nextStep: "Review each document carefully and sign electronically.",
    canUploadId: true,
    canSignDocuments: true,
    showProgress: true,
    progressPercent: 40
  },
  DOCS_SIGNED: {
    title: "Documents Received",
    description: "Thank you! We've received your signed documents and are processing your case.",
    nextStep: "Our team is handling everything now. We'll update you on progress.",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 60
  },
  FILED: {
    title: "Case Submitted",
    description: "Your case has been submitted to the county. Now we wait for their review.",
    nextStep: "The county is processing your case. This can take some time, but we're monitoring it.",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 75
  },
  AWAITING_FUNDS: {
    title: "Approved - Awaiting Funds",
    description: "Great news! Your case has been approved. We're waiting for the funds to be released.",
    nextStep: "Once funds are received, we'll process everything and send you your portion.",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 90
  },
  PAID: {
    title: "Complete",
    description: "Your case is complete and payment has been processed.",
    nextStep: "Thank you for trusting us with your case!",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: true,
    progressPercent: 100
  },
  CLOSED: {
    title: "Case Closed",
    description: "This case has been closed.",
    nextStep: "Contact us if you have any questions.",
    canUploadId: false,
    canSignDocuments: false,
    showProgress: false,
    progressPercent: 0
  },
  REJECTED: {
    title: "Additional Information Needed",
    description: "We need some additional information to continue with your case.",
    nextStep: "A representative will contact you to explain what's needed.",
    canUploadId: true,
    canSignDocuments: false,
    showProgress: false,
    progressPercent: 0
  }
};

// ============================================
// FAQ RESPONSES - Plain English, No Jargon
// ============================================

interface FAQItem {
  question: string;
  answer: string;
  keywords: string[];
}

const CLIENT_FAQ: FAQItem[] = [
  {
    question: "What is this about?",
    answer: "When a property is sold by the county (like in a tax sale), sometimes there's money left over after the taxes are paid. That money may belong to the previous owner. We help people find out if they have money available and handle the paperwork to claim it.",
    keywords: ["what", "about", "explain", "understand", "how does this work"]
  },
  {
    question: "Is this a scam?",
    answer: "This is not a scam. We're a legitimate company that helps people claim money they may be entitled to. We don't charge anything upfront - we only receive a fee if we successfully help you get your money. You can verify our company and look up your property records with the county yourself.",
    keywords: ["scam", "legitimate", "real", "trust", "fake", "fraud"]
  },
  {
    question: "How much will I get?",
    answer: "The exact amount depends on your specific case and what the county has on record. We can't give you an exact number until the claim is processed, but we'll keep you updated every step of the way.",
    keywords: ["how much", "amount", "money", "get", "receive", "pay"]
  },
  {
    question: "Do I have to pay anything upfront?",
    answer: "No, you don't pay anything upfront. We only receive a fee if we're successful in helping you claim your money. If we don't succeed, you owe us nothing.",
    keywords: ["pay", "upfront", "cost", "fee", "charge", "free"]
  },
  {
    question: "How long does this take?",
    answer: "Every case is different because each county has its own process and timeline. Some cases are resolved in a few months, others can take longer. We'll keep you updated on your status and let you know if there are any delays.",
    keywords: ["how long", "time", "when", "timeline", "wait"]
  },
  {
    question: "What documents do I need to sign?",
    answer: "You'll need to sign a few simple documents: an agreement that lets us help you, a form that authorizes us to file paperwork on your behalf, and a statement confirming your identity. Everything can be signed electronically - no printer needed.",
    keywords: ["documents", "sign", "paperwork", "forms"]
  },
  {
    question: "Why do you need my ID?",
    answer: "We need a copy of your ID to verify that we're working with the right person and that you're the rightful owner. This protects you and ensures the money goes to the correct person. Your information is kept secure and confidential.",
    keywords: ["id", "identification", "why", "need", "verify"]
  },
  {
    question: "Is my information safe?",
    answer: "Yes, your information is kept secure and confidential. We use encrypted systems to protect your data and only use your information for processing your case. We never sell or share your personal information.",
    keywords: ["safe", "secure", "privacy", "information", "data", "protect"]
  },
  {
    question: "What happens after I sign the documents?",
    answer: "After you sign, our team takes over. We prepare and file everything with the county, monitor the status, respond to any requests from the county, and keep you updated. You don't have to do anything else unless we need additional information.",
    keywords: ["after", "sign", "next", "happens", "then"]
  },
  {
    question: "Can I do this myself?",
    answer: "You can try to file a claim yourself. The process involves researching county requirements, preparing legal documents, filing with the correct office, and following up. Many people prefer to have help with this process, but it's your choice.",
    keywords: ["myself", "own", "self", "without", "alone"]
  },
  {
    question: "What if my case is rejected?",
    answer: "If there's an issue with your case, we'll let you know what happened and what options you have. Sometimes cases need additional documentation or corrections. We'll guide you through any next steps.",
    keywords: ["rejected", "denied", "problem", "issue", "not approved"]
  },
  {
    question: "How do I get paid?",
    answer: "Once the county releases the funds and we receive them, we deduct our fee and send you the rest. We can send payment by check or electronic transfer, whichever you prefer. We'll send you a full breakdown of everything.",
    keywords: ["paid", "payment", "receive", "check", "money"]
  }
];

// ============================================
// CLIENT SERVICE CLASS
// ============================================

export class ClientService {
  // ----------------------------------------
  // PORTAL ACCESS
  // ----------------------------------------

  /**
   * Get client portal data by access token
   * Returns only client-safe information
   */
  async getPortalData(accessToken: string): Promise<{
    found: boolean;
    data?: {
      caseId: string;
      caseCode: string;
      propertyAddress: string;
      county: string;
      state: string;
      status: ClientStatusInfo;
      documents: Array<{
        id: string;
        name: string;
        status: string;
        requiresSignature: boolean;
        signed: boolean;
      }>;
      timeline: Array<{
        date: string;
        event: string;
        completed: boolean;
      }>;
    };
  }> {
    const caseData = await prisma.case.findUnique({
      where: { publicAccessToken: accessToken },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            signatureRequired: true,
            signedAt: true,
            fileName: true
          }
        }
      }
    });

    if (!caseData) {
      return { found: false };
    }

    // Build timeline (client-safe)
    const timeline = this.buildTimeline(caseData);

    // Get status info
    const statusInfo = CLIENT_STATUS_INFO[caseData.status];

    // Map documents (client-safe names)
    const documents = caseData.documents.map(doc => ({
      id: doc.id,
      name: this.getClientFriendlyDocName(doc.type),
      status: this.getClientFriendlyDocStatus(doc.status),
      requiresSignature: doc.signatureRequired,
      signed: !!doc.signedAt
    }));

    return {
      found: true,
      data: {
        caseId: caseData.id,
        caseCode: caseData.internalCode,
        propertyAddress: caseData.propertyAddress,
        county: caseData.county,
        state: caseData.state,
        status: statusInfo,
        documents,
        timeline
      }
    };
  }

  /**
   * Build client-friendly timeline
   */
  private buildTimeline(caseData: any): Array<{
    date: string;
    event: string;
    completed: boolean;
  }> {
    const timeline = [];

    // Case created
    timeline.push({
      date: caseData.createdAt.toLocaleDateString(),
      event: "Case started",
      completed: true
    });

    // Contacted
    if (caseData.contactedAt) {
      timeline.push({
        date: caseData.contactedAt.toLocaleDateString(),
        event: "Initial contact made",
        completed: true
      });
    }

    // Documents requested
    if (caseData.docsRequestedAt) {
      timeline.push({
        date: caseData.docsRequestedAt.toLocaleDateString(),
        event: "Documents sent for review",
        completed: true
      });
    }

    // Documents signed
    if (caseData.docsSignedAt) {
      timeline.push({
        date: caseData.docsSignedAt.toLocaleDateString(),
        event: "Documents signed",
        completed: true
      });
    }

    // Filed
    if (caseData.filedAt) {
      timeline.push({
        date: caseData.filedAt.toLocaleDateString(),
        event: "Claim submitted to county",
        completed: true
      });
    }

    // Funds received
    if (caseData.fundsReceivedAt) {
      timeline.push({
        date: caseData.fundsReceivedAt.toLocaleDateString(),
        event: "Funds approved",
        completed: true
      });
    }

    // Paid
    if (caseData.paidAt) {
      timeline.push({
        date: caseData.paidAt.toLocaleDateString(),
        event: "Payment processed",
        completed: true
      });
    }

    return timeline;
  }

  /**
   * Get client-friendly document name
   */
  private getClientFriendlyDocName(type: string): string {
    const names: Record<string, string> = {
      CLIENT_SERVICE_AGREEMENT: "Service Agreement",
      LIMITED_POA: "Authorization Form",
      AFFIDAVIT: "Verification Statement",
      MOTION: "Claim Document",
      COVER_LETTER: "Cover Letter",
      FILING_PACKET: "Filing Package",
      EVIDENCE_PACKET: "Supporting Documents",
      FOLLOW_UP_LETTER: "Follow-up Letter",
      VERIFICATION_LETTER: "Verification Request",
      PAYMENT_INSTRUCTIONS: "Payment Information",
      CLIENT_ID: "Your ID",
      PROPERTY_DEED: "Property Document",
      TAX_RECORD: "Tax Record",
      OTHER: "Document"
    };
    return names[type] || "Document";
  }

  /**
   * Get client-friendly document status
   */
  private getClientFriendlyDocStatus(status: DocumentStatus): string {
    const statuses: Record<DocumentStatus, string> = {
      DRAFT: "Being prepared",
      PENDING_SIGNATURE: "Ready for your signature",
      SIGNED: "Signed",
      SUBMITTED: "Submitted",
      APPROVED: "Approved",
      REJECTED: "Needs attention"
    };
    return statuses[status] || "Processing";
  }

  // ----------------------------------------
  // FAQ / HELP
  // ----------------------------------------

  /**
   * Answer a client question using FAQ
   */
  answerQuestion(question: string): {
    found: boolean;
    answer?: string;
    relatedQuestions?: string[];
  } {
    const lowerQuestion = question.toLowerCase();

    // Find best matching FAQ
    let bestMatch: FAQItem | null = null;
    let bestScore = 0;

    for (const faq of CLIENT_FAQ) {
      let score = 0;
      for (const keyword of faq.keywords) {
        if (lowerQuestion.includes(keyword)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch && bestScore > 0) {
      // Find related questions
      const relatedQuestions = CLIENT_FAQ
        .filter(f => f !== bestMatch)
        .slice(0, 3)
        .map(f => f.question);

      return {
        found: true,
        answer: bestMatch.answer,
        relatedQuestions
      };
    }

    // Default response
    return {
      found: false,
      answer: "I don't have a specific answer for that question. Please contact us directly and a representative will be happy to help you.",
      relatedQuestions: CLIENT_FAQ.slice(0, 3).map(f => f.question)
    };
  }

  /**
   * Get all FAQ items
   */
  getAllFAQ(): Array<{ question: string; answer: string }> {
    return CLIENT_FAQ.map(f => ({
      question: f.question,
      answer: f.answer
    }));
  }

  // ----------------------------------------
  // CLIENT ACTIONS
  // ----------------------------------------

  /**
   * Update client information
   */
  async updateClientInfo(
    caseId: string,
    accessToken: string,
    updates: {
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    // Verify access token matches case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { publicAccessToken: true, clientId: true }
    });

    if (!caseData || caseData.publicAccessToken !== accessToken) {
      return { success: false, error: "Access denied" };
    }

    // Update client
    await prisma.user.update({
      where: { id: caseData.clientId },
      data: updates
    });

    return { success: true };
  }

  /**
   * Record document signature
   */
  async signDocument(
    documentId: string,
    accessToken: string,
    signatureData: string
  ): Promise<{ success: boolean; error?: string }> {
    // Get document and verify access
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: {
          select: { publicAccessToken: true }
        }
      }
    });

    if (!document || document.case.publicAccessToken !== accessToken) {
      return { success: false, error: "Access denied" };
    }

    if (!document.signatureRequired) {
      return { success: false, error: "Document does not require signature" };
    }

    if (document.signedAt) {
      return { success: false, error: "Document already signed" };
    }

    // Update document with signature
    await prisma.document.update({
      where: { id: documentId },
      data: {
        signedAt: new Date(),
        signatureUrl: signatureData, // In production, store actual signature file
        status: "SIGNED"
      }
    });

    // Check if all required documents are signed
    const caseDocuments = await prisma.document.findMany({
      where: { caseId: document.caseId, signatureRequired: true }
    });

    const allSigned = caseDocuments.every(d => d.signedAt);

    if (allSigned) {
      // Update case status
      await prisma.case.update({
        where: { id: document.caseId },
        data: {
          status: "DOCS_SIGNED",
          docsSignedAt: new Date()
        }
      });
    }

    return { success: true };
  }

  /**
   * Upload client ID
   */
  async uploadClientId(
    caseId: string,
    accessToken: string,
    fileData: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    // Verify access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { publicAccessToken: true, clientId: true }
    });

    if (!caseData || caseData.publicAccessToken !== accessToken) {
      return { success: false, error: "Access denied" };
    }

    // Validate file
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(fileData.mimeType)) {
      return { success: false, error: "Please upload a JPG, PNG, or PDF file" };
    }

    if (fileData.fileSize > 10 * 1024 * 1024) {
      return { success: false, error: "File too large. Maximum size is 10MB" };
    }

    // Create document record
    await prisma.document.create({
      data: {
        caseId,
        type: "CLIENT_ID",
        status: "SUBMITTED",
        fileName: fileData.fileName,
        fileUrl: fileData.fileUrl,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        signatureRequired: false,
        uploadedById: caseData.clientId
      }
    });

    return { success: true };
  }

  // ----------------------------------------
  // NOTIFICATIONS (Client-safe)
  // ----------------------------------------

  /**
   * Get notification message for status change
   */
  getStatusNotification(newStatus: CaseStatus): {
    title: string;
    message: string;
    type: "info" | "success" | "warning";
  } {
    const notifications: Record<CaseStatus, { title: string; message: string; type: "info" | "success" | "warning" }> = {
      NEW: {
        title: "Case Started",
        message: "Your case has been created. A representative will contact you soon.",
        type: "info"
      },
      CONTACTED: {
        title: "Getting Started",
        message: "Thanks for speaking with us! Check your portal to continue.",
        type: "info"
      },
      DOCS_PENDING: {
        title: "Documents Ready",
        message: "Your documents are ready for review and signature.",
        type: "info"
      },
      DOCS_SIGNED: {
        title: "Thank You!",
        message: "We've received your signed documents. Our team is now processing your case.",
        type: "success"
      },
      FILED: {
        title: "Claim Submitted",
        message: "Your claim has been submitted to the county. We'll keep you updated.",
        type: "success"
      },
      AWAITING_FUNDS: {
        title: "Great News!",
        message: "Your claim has been approved! We're waiting for the funds to be released.",
        type: "success"
      },
      PAID: {
        title: "Complete!",
        message: "Your payment has been processed. Thank you for trusting us!",
        type: "success"
      },
      CLOSED: {
        title: "Case Closed",
        message: "This case has been closed. Contact us if you have questions.",
        type: "info"
      },
      REJECTED: {
        title: "Action Needed",
        message: "We need some additional information. A representative will contact you.",
        type: "warning"
      }
    };

    return notifications[newStatus] || {
      title: "Update",
      message: "Your case status has been updated.",
      type: "info"
    };
  }
}

export const clientService = new ClientService();
