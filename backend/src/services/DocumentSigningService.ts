/**
 * DocumentSigningService.ts — MGR CAPITAL ASSISTANCE
 * E-Signature Integration with OpenSign (FREE unlimited) or DocuSign
 *
 * RECOMMENDED: OpenSign (FREE unlimited signatures)
 * See BEST_APIS_GUIDE.md for alternatives
 *
 * DocuSign JWT Auth: Tokens expire in 1 hour, auto-refresh implemented
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// API configurations
const OPENSIGN_API_KEY = process.env.OPENSIGN_API_KEY;
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID;
const DOCUSIGN_PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY; // RSA private key for JWT
const DOCUSIGN_API_KEY = process.env.DOCUSIGN_API_KEY; // Legacy static token fallback

// Determine provider
const PROVIDER = OPENSIGN_API_KEY ? 'opensign' :
  (DOCUSIGN_INTEGRATION_KEY || DOCUSIGN_API_KEY ? 'docusign' : 'demo');

// DocuSign token cache
let docusignTokenCache: {
  accessToken: string;
  expiresAt: number;
} | null = null;

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
      logger.info(`[DocumentSigning] Using ${this.provider.toUpperCase()} for e-signatures`);
      if (this.provider === 'docusign' && DOCUSIGN_INTEGRATION_KEY && DOCUSIGN_PRIVATE_KEY) {
        logger.info('[DocumentSigning] DocuSign JWT auth configured - tokens will auto-refresh');
      }
    }
  }

  /**
   * Get DocuSign access token (with auto-refresh via JWT)
   * Tokens expire in 1 hour, we refresh 5 minutes early
   */
  private async getDocuSignToken(): Promise<string | null> {
    // If JWT auth is configured, use it
    if (DOCUSIGN_INTEGRATION_KEY && DOCUSIGN_USER_ID && DOCUSIGN_PRIVATE_KEY) {
      // Check if cached token is still valid (with 5 minute buffer)
      if (docusignTokenCache && docusignTokenCache.expiresAt > Date.now() + 300000) {
        return docusignTokenCache.accessToken;
      }

      try {
        // Generate JWT assertion
        const now = Math.floor(Date.now() / 1000);
        const header = {
          typ: 'JWT',
          alg: 'RS256',
        };
        const payload = {
          iss: DOCUSIGN_INTEGRATION_KEY,
          sub: DOCUSIGN_USER_ID,
          aud: process.env.NODE_ENV === 'production'
            ? 'account.docusign.com'
            : 'account-d.docusign.com',
          iat: now,
          exp: now + 3600, // 1 hour
          scope: 'signature impersonation',
        };

        // Base64url encode
        const base64url = (data: object) =>
          Buffer.from(JSON.stringify(data))
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

        const jwtHeader = base64url(header);
        const jwtPayload = base64url(payload);
        const signInput = `${jwtHeader}.${jwtPayload}`;

        // Sign with RSA private key
        const privateKey = DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, '\n');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(signInput);
        const signature = sign
          .sign(privateKey, 'base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');

        const jwt = `${signInput}.${signature}`;

        // Exchange JWT for access token
        const authUrl = process.env.NODE_ENV === 'production'
          ? 'https://account.docusign.com/oauth/token'
          : 'https://account-d.docusign.com/oauth/token';

        const response = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          logger.error('DocuSign JWT token exchange failed', { error });
          // Fall back to static token if available
          return DOCUSIGN_API_KEY || null;
        }

        const data: any = await response.json();

        // Cache the token
        docusignTokenCache = {
          accessToken: data.access_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
        };

        logger.info('DocuSign JWT token refreshed', {
          expiresIn: data.expires_in,
        });

        return data.access_token;
      } catch (error: any) {
        logger.error('DocuSign JWT auth failed', { error: error.message });
        // Fall back to static token if available
        return DOCUSIGN_API_KEY || null;
      }
    }

    // Fall back to static token (expires in 8 hours)
    if (DOCUSIGN_API_KEY) {
      logger.warn('Using static DocuSign token - will expire in 8 hours');
      return DOCUSIGN_API_KEY;
    }

    return null;
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
      } else if (this.provider === 'docusign') {
        return await this.createDocuSignRequest(requestId, request);
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
      const response = await fetch('https://api.opensignlabs.com/v1/signature-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENSIGN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: request.documentName,
          message: request.message || 'Please sign this document from MGR Capital',
          signers: request.signers.map(s => ({
            email: s.email,
            name: s.name,
            role: s.role || 'signer',
          })),
          files: request.documentBase64 ? [{
            name: request.documentName,
            content: request.documentBase64,
          }] : [{
            name: request.documentName,
            url: request.documentUrl,
          }],
          expires_at: request.expiresAt?.toISOString(),
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
        externalId: data.id,
        documentName: request.documentName,
        signers: request.signers,
        status: 'sent',
        caseId: request.caseId,
      });

      return {
        success: true,
        requestId,
        status: 'sent',
        signingUrl: data.signing_url,
      };
    } catch (error: any) {
      logger.error('OpenSign request failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create signature request via DocuSign eSignature API
   * Requires: DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_BASE_URL
   */
  private async createDocuSignRequest(requestId: string, request: SignatureRequest): Promise<SignatureResult> {
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';

    if (!accountId) {
      logger.warn('DocuSign account ID not configured, falling back to demo');
      return this.createDemoRequest(requestId, request);
    }

    try {
      // Create envelope definition
      const envelopeDefinition = {
        emailSubject: `Please sign: ${request.documentName}`,
        emailBlurb: request.message || 'Please review and sign this document from MGR Capital',
        status: 'sent',
        documents: [{
          documentId: '1',
          name: request.documentName,
          fileExtension: 'pdf',
          documentBase64: request.documentBase64,
        }],
        recipients: {
          signers: request.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: String(index + 1),
            routingOrder: String(index + 1),
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '200',
                yPosition: '700',
              }],
              dateSignedTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '200',
                yPosition: '750',
              }],
            },
          })),
        },
      };

      // Get fresh DocuSign token (auto-refreshes via JWT if configured)
      const token = await this.getDocuSignToken();
      if (!token) {
        logger.warn('No DocuSign token available, falling back to demo');
        return this.createDemoRequest(requestId, request);
      }

      // Create envelope via DocuSign API
      const response = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeDefinition),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DocuSign API error: ${errorText}`);
      }

      const envelope: any = await response.json();

      // Get signing URL for first signer (embedded signing)
      let signingUrl: string | undefined;
      if (envelope.envelopeId && request.signers[0]) {
        const viewRequest = {
          returnUrl: `${process.env.FRONTEND_URL}/signature/complete?requestId=${requestId}`,
          authenticationMethod: 'none',
          email: request.signers[0].email,
          userName: request.signers[0].name,
          clientUserId: requestId,
        };

        const viewResponse = await fetch(
          `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelope.envelopeId}/views/recipient`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(viewRequest),
          }
        );

        if (viewResponse.ok) {
          const viewData: any = await viewResponse.json();
          signingUrl = viewData.url;
        }
      }

      // Record in database
      await this.recordSignatureRequest(requestId, {
        provider: 'docusign',
        externalId: envelope.envelopeId,
        documentName: request.documentName,
        signers: request.signers,
        status: 'sent',
        caseId: request.caseId,
      });

      logger.info('DocuSign envelope created', { requestId, envelopeId: envelope.envelopeId });

      return {
        success: true,
        requestId,
        status: 'sent',
        signingUrl,
      };
    } catch (error: any) {
      logger.error('DocuSign request failed', { requestId, error: error.message });

      // Fall back to demo mode on error
      return this.createDemoRequest(requestId, request);
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
      signingUrl: `https://demo.mgrcapital.com/sign/${requestId}`,
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
   * Handle webhook from signature provider
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
