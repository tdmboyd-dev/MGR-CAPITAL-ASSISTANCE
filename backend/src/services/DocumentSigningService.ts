/**
 * DocumentSigningService.ts — MGR CAPITAL ASSISTANCE
 *
 * E-signature capability boundary.
 *
 * The repository's historical OpenSign adapter used an obsolete API contract
 * and could fabricate "sent" requests/signing URLs when no provider was
 * configured. Money/legal workflow truth is more important than a demo path:
 * request creation therefore fails closed until the current OpenSign API
 * contract is re-integrated and verified end to end.
 */

import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

const OPENSIGN_API_TOKEN =
  process.env.OPENSIGN_API_TOKEN ||
  process.env.OPENSIGN_API_KEY ||
  "";

export interface SignatureWidget {
  type: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
}

export interface SignatureRequest {
  documentId: string;
  documentName: string;
  documentUrl?: string;
  documentBase64?: string;
  signers: {
    email: string;
    name: string;
    role?: string;
    widgets?: SignatureWidget[];
  }[];
  caseId?: string;
  message?: string;
  expiresAt?: Date;
}

export interface SignatureResult {
  success: boolean;
  requestId: string;
  status: "pending" | "sent" | "completed" | "declined" | "expired";
  signingUrl?: string;
  error?: string;
}

export class DocumentSigningService {
  /**
   * This intentionally remains false until the current provider contract has
   * passed request + webhook + signed-document verification.
   */
  private readonly adapterVerified = false;

  getServiceStatus(): {
    provider: string;
    configured: boolean;
    mode: string;
    adapterVerified: boolean;
  } {
    return {
      provider: "opensign",
      configured: !!OPENSIGN_API_TOKEN,
      mode: this.adapterVerified ? "live" : "blocked_reintegration",
      adapterVerified: this.adapterVerified,
    };
  }

  /**
   * Create a signature request.
   *
   * Fail closed until the current OpenSign API is implemented from its current
   * contract. Do not fabricate provider IDs, "sent" state, or signing URLs.
   */
  async createSignatureRequest(request: SignatureRequest): Promise<SignatureResult> {
    const requestId = `sig_${randomUUID()}`;

    if (!OPENSIGN_API_TOKEN) {
      return {
        success: false,
        requestId,
        status: "pending",
        error: "OpenSign API token is not configured; no signature request was sent",
      };
    }

    if (!request.documentBase64) {
      return {
        success: false,
        requestId,
        status: "pending",
        error: "OpenSign reintegration requires the source PDF bytes/base64; no request was sent",
      };
    }

    if (!request.signers.length || request.signers.some((s) => !s.email || !s.name)) {
      return {
        success: false,
        requestId,
        status: "pending",
        error: "At least one fully identified signer is required",
      };
    }

    logger.warn("OpenSign request blocked pending current API reintegration", {
      requestId,
      documentId: request.documentId,
      signerCount: request.signers.length,
    });

    return {
      success: false,
      requestId,
      status: "pending",
      error:
        "OpenSign adapter is blocked pending current API reintegration and end-to-end verification; no request was sent",
    };
  }

  async getStatus(requestId: string): Promise<SignatureResult | null> {
    try {
      const record = await prisma.signatureRequest.findUnique({
        where: { id: requestId },
      });

      if (!record) return null;

      return {
        success: true,
        requestId,
        status: record.status.toLowerCase() as SignatureResult["status"],
      };
    } catch (error: any) {
      logger.error("Failed to get signature status", { error: error.message });
      return null;
    }
  }

  /**
   * Handle an already-authenticated OpenSign webhook.
   *
   * The route layer verifies the HMAC over the raw request body before this
   * method is called. Support both current-style top-level document IDs and
   * legacy payloads so existing provider records can be reconciled safely.
   */
  async handleWebhook(provider: string, payload: any): Promise<void> {
    if (provider !== "opensign") {
      throw new Error(`Unsupported signature webhook provider: ${provider}`);
    }

    const providerRequestId =
      payload?.documentId ||
      payload?.objectId ||
      payload?.data?.objectId ||
      payload?.data?.documentId;

    if (!providerRequestId) {
      throw new Error("OpenSign webhook is missing a document/provider request ID");
    }

    const event = String(payload?.event || payload?.status || "").toLowerCase();
    let newStatus: SignatureResult["status"] | undefined;

    if (
      event.includes("completed") ||
      event.includes("complete") ||
      event.includes("signed")
    ) {
      newStatus = "completed";
    } else if (event.includes("declined") || event.includes("rejected")) {
      newStatus = "declined";
    } else if (event.includes("expired")) {
      newStatus = "expired";
    } else if (
      event.includes("sent") ||
      event.includes("created") ||
      event.includes("viewed") ||
      event.includes("pending")
    ) {
      newStatus = "pending";
    }

    if (!newStatus) {
      logger.info("Ignoring non-state-changing OpenSign webhook", {
        providerRequestId,
        event,
      });
      return;
    }

    const record = await prisma.signatureRequest.findFirst({
      where: {
        provider: "opensign",
        providerRequestId: String(providerRequestId),
      },
      select: { id: true },
    });

    if (!record) {
      logger.warn("OpenSign webhook did not match a local signature request", {
        providerRequestId,
        event,
      });
      return;
    }

    await prisma.signatureRequest.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        signedAt: newStatus === "completed" ? new Date() : undefined,
      },
    });

    logger.info("OpenSign signature request status reconciled", {
      requestId: record.id,
      providerRequestId,
      status: newStatus,
    });
  }

  async listByCaseId(caseId: string): Promise<any[]> {
    const requests = await prisma.signatureRequest.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((record) => ({
      id: record.id,
      documentId: record.documentId,
      documentName: (record.metadata as any)?.documentName,
      status: record.status,
      signers:
        (record.metadata as any)?.signers ||
        [{ email: record.signerEmail, name: record.signerName }],
      createdAt: record.createdAt,
      signedAt: record.signedAt,
      expiresAt: record.expiresAt,
      providerRequestId: record.providerRequestId,
    }));
  }
}

export const documentSigningService = new DocumentSigningService();
