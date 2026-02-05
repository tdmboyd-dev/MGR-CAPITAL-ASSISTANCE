/**
 * DocumentSigningService.ts — MGR CAPITAL ASSISTANCE
 * E-Signature Integration with OpenSign (FREE unlimited signatures)
 *
 * OpenSign: FREE unlimited signatures - no paid alternatives needed
 */

import { logger } from '../utils/logger.js';
import prisma from "../lib/prisma.js";

// API configuration - OpenSign only
const OPENSIGN_API_KEY = process.env.OPENSIGN_API_KEY;
const OPENSIGN_JWT = process.env.OPENSIGN_JWT;

// Determine provider
const PROVIDER = OPENSIGN_API_KEY ? 'opensign' : 'demo';

interface SignatureRequest {
  documentId: string;
  documentName: string;
  documentUrl?: string;
  documentBase64?: string;
  signers: {
    email: string;
    name: string;
    role?: string;
  }[];
  caseId?: string;
  message?: string;
  expiresAt?: Date;
}

interface SignatureResult {
  success: boolean;
  requestId: string;
  status: 'pending' | 'sent' | 'completed' | 'declined' | 'expired';
  signingUrl?: string;
  error?: string;
}

export class DocumentSigningService {
  private provider: string;
  private demoMode: boolean;

  constructor() {
    this.provider = PROVIDER;
    this.demoMode = this.provider === 'demo';

    if (this.demoMode) {
      logger.info('[DocumentSigning] Running in DEMO MODE - signatures are simulated');
      logger.info('[DocumentSigning] To enable real signatures, add OPENSIGN_API_KEY (FREE unlimited)');
    } else {
      logger.info('[DocumentSigning] Using OpenSign for e-signatures (FREE unlimited)');
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(): { provider: string; configured: boolean; mode: string } {
    return {
      provider: this.provider,
      configured: !this.demoMode,
      mode: this.demoMode ? 'demo' : 'live',
    };
  }

  /**
   * Create a signature request
   */
  async createSignatureRequest(request: SignatureRequest): Promise<SignatureResult> {
    const requestId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (this.provider === 'opensign') {
        return await this.createOpenSignRequest(requestId, request);
      } else {
        // Demo mode
        return await this.createDemoRequest(requestId, request);
      }
    } catch (error: any) {
      logger.error('Signature request failed', { error: error.message });
      return {
        success: false,
        requestId,
        status: 'pending',
        error: error.message,
      };
    }
  }

  /**
   * Create signature request via OpenSign (FREE unlimited)
   */
  private async createOpenSignRequest(requestId: string, request: SignatureRequest): Promise<SignatureResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Use JWT if available, otherwise API key
      if (OPENSIGN_JWT) {
        headers['Authorization'] = `Bearer ${OPENSIGN_JWT}`;
      } else if (OPENSIGN_API_KEY) {
        headers['x-api-key'] = OPENSIGN_API_KEY;
      }

      const response = await fetch('https://app.opensignlabs.com/api/v1/createDocument', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: request.documentName,
          note: request.message || 'Please sign this document from MGR Capital',
          signers: request.signers.map(s => ({
            email: s.email,
            name: s.name,
            role: s.role || 'signer',
          })),
          file: request.documentBase64 ? {
            name: request.documentName,
            base64: request.documentBase64,
          } : {
            name: request.documentName,
            url: request.documentUrl,
          },
          sendEmail: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenSign API error: ${error}`);
      }

      const data: any = await response.json();

      // Record in database
      await this.recordSignatureRequest(requestId, {
        provider: 'opensign',
        externalId: data.objectId || data.id,
        documentName: request.documentName,
        signers: request.signers,
        status: 'sent',
        caseId: request.caseId,
      });

      return {
        success: true,
        requestId,
        status: 'sent',
        signingUrl: data.signingUrl || data.url,
      };
    } catch (error: any) {
      logger.error('OpenSign request failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create demo signature request (simulated)
   */
  private async createDemoRequest(requestId: string, request: SignatureRequest): Promise<SignatureResult> {
    logger.info('[DEMO] Signature request created', {
      requestId,
      document: request.documentName,
      signers: request.signers.map(s => s.email),
    });

    try {
      await this.recordSignatureRequest(requestId, {
        provider: 'demo',
        documentName: request.documentName,
        signers: request.signers,
        status: 'sent',
        caseId: request.caseId,
      });
    } catch (e) {
      // Database might not be available
      logger.warn('Could not record demo signature request');
    }

    // In demo mode, return a fake signing URL
    return {
      success: true,
      requestId,
      status: 'sent',
      signingUrl: `https://demo.capitalmgr.com/sign/${requestId}`,
    };
  }

  /**
   * Get signature request status
   */
  async getStatus(requestId: string): Promise<SignatureResult | null> {
    try {
      const record = await prisma.signatureRequest.findUnique({
        where: { id: requestId },
      });

      if (!record) return null;

      return {
        success: true,
        requestId,
        status: record.status as any,
      };
    } catch (error: any) {
      logger.error('Failed to get signature status', { error: error.message });
      return null;
    }
  }

  /**
   * Handle webhook from OpenSign
   */
  async handleWebhook(provider: string, payload: any): Promise<void> {
    logger.info('Signature webhook received', { provider, type: payload.event });

    if (provider === 'opensign') {
      const requestId = payload.data?.metadata?.internal_id;
      if (requestId) {
        const newStatus = payload.event === 'signature_request.completed' ? 'completed' :
                         payload.event === 'signature_request.declined' ? 'declined' : 'pending';

        await prisma.signatureRequest.update({
          where: { id: requestId },
          data: { status: newStatus },
        });
      }
    }
  }

  /**
   * Record signature request in database
   */
  private async recordSignatureRequest(requestId: string, data: {
    provider: string;
    externalId?: string;
    documentName: string;
    signers: { email: string; name: string }[];
    status: string;
    caseId?: string;
  }): Promise<void> {
    await prisma.signatureRequest.create({
      data: {
        id: requestId,
        provider: data.provider,
        providerRequestId: data.externalId,
        documentId: requestId,
        signerEmail: data.signers[0]?.email,
        signerName: data.signers[0]?.name,
        status: data.status,
        caseId: data.caseId,
        metadata: {
          documentName: data.documentName,
          signers: data.signers,
        },
      },
    });
  }

  /**
   * List signature requests for a case
   */
  async listByCaseId(caseId: string): Promise<any[]> {
    try {
      const requests = await prisma.signatureRequest.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      });

      return requests.map(r => ({
        id: r.id,
        documentId: r.documentId,
        documentName: (r.metadata as any)?.documentName,
        status: r.status,
        signers: (r.metadata as any)?.signers || [{ email: r.signerEmail, name: r.signerName }],
        createdAt: r.createdAt,
      }));
    } catch (error: any) {
      logger.error('Failed to list signature requests', { error: error.message });
      return [];
    }
  }
}

export const documentSigningService = new DocumentSigningService();
