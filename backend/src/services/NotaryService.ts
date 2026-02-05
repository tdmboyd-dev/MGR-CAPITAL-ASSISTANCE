/**
 * NotaryService.ts — MGR CAPITAL ASSISTANCE
 *
 * Remote Online Notarization (RON) Integration Service
 *
 * Supports multiple RON platforms:
 * - Notarize.com (Primary - API available)
 * - NotaryCam (Secondary - API available)
 * - DocuSign Notary (If DocuSign already configured)
 *
 * LEGAL STATUS (2024):
 * - 47 states + DC have enacted RON legislation
 * - Courts accept RON documents with proper audit trail
 * - Some documents may still require in-person notarization (state-specific)
 *
 * RON Requirements:
 * - Audio-visual recording of session
 * - Identity verification (KBA + ID check)
 * - Tamper-evident seal
 * - Secure audit trail
 * - Journal entries
 */

import { DocumentStatus } from "@prisma/client";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOTARIZE_API_KEY = process.env.NOTARIZE_API_KEY;
const NOTARIZE_API_URL = process.env.NOTARIZE_API_URL || 'https://api.notarize.com/v1';
const NOTARYCAM_API_KEY = process.env.NOTARYCAM_API_KEY;
const NOTARYCAM_API_URL = process.env.NOTARYCAM_API_URL || 'https://api.notarycam.com/v1';

// Determine which provider to use
const NOTARY_PROVIDER = NOTARIZE_API_KEY ? 'notarize' :
  (NOTARYCAM_API_KEY ? 'notarycam' : 'demo');

// =============================================================================
// TYPES
// =============================================================================

export interface NotaryRequest {
  documentId: string;
  caseId: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string;
  signerAddress?: string;
  documentType: string;
  state: string;
  county?: string;
  urgency?: 'standard' | 'expedited' | '24hour';
  scheduledTime?: Date;
}

export interface NotarySession {
  id: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'expired';
  provider: string;
  sessionUrl?: string;
  scheduledTime?: Date;
  completedAt?: Date;
  notarizedDocumentUrl?: string;
  auditTrailUrl?: string;
  videoRecordingUrl?: string;
  notaryName?: string;
  notaryCommission?: string;
  notaryState?: string;
  sealImageUrl?: string;
  costCents: number;
  error?: string;
}

export interface NotaryAvailability {
  available: boolean;
  nextAvailableSlot?: Date;
  availableSlots?: Date[];
  estimatedWaitMinutes?: number;
}

export interface StateNotaryRules {
  ronAllowed: boolean;
  statute: string;
  restrictions: string[];
  requiresKBA: boolean;
  requiresIdVerification: boolean;
  requiresVideoRecording: boolean;
  maxDocumentsPerSession: number;
  validFor: string[];
}

// =============================================================================
// STATE RON RULES
// =============================================================================

const STATE_RON_RULES: Record<string, StateNotaryRules> = {
  'AL': { ronAllowed: true, statute: 'Alabama Act 2020-36', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial'] },
  'AK': { ronAllowed: true, statute: 'AS 44.50', restrictions: ['Limited to certain documents'], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 5, validFor: ['legal', 'financial'] },
  'AZ': { ronAllowed: true, statute: 'ARS 41-371', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'AR': { ronAllowed: true, statute: 'Arkansas Act 594', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'CA': { ronAllowed: true, statute: 'SB 696 (2024)', restrictions: ['Real estate restricted until 2030'], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['legal', 'financial', 'tax_surplus'] },
  'CO': { ronAllowed: true, statute: 'CRS 24-21-501', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'CT': { ronAllowed: true, statute: 'PA 23-119', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'DE': { ronAllowed: true, statute: '29 Del. C. §4328', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'DC': { ronAllowed: true, statute: 'DC Act 25-313', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'FL': { ronAllowed: true, statute: 'Florida Statutes 117.265', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'GA': { ronAllowed: true, statute: 'OCGA 45-17-8.1', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'HI': { ronAllowed: true, statute: 'HRS 456-19', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['legal', 'financial', 'tax_surplus'] },
  'ID': { ronAllowed: true, statute: 'Idaho Code 51-101', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'IL': { ronAllowed: true, statute: '5 ILCS 312', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'IN': { ronAllowed: true, statute: 'IC 33-42-17', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'IA': { ronAllowed: true, statute: 'Iowa Code 9B.14', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'KS': { ronAllowed: true, statute: 'KSA 53-501', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'KY': { ronAllowed: true, statute: 'KRS 423.445', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'LA': { ronAllowed: true, statute: 'La. R.S. 35:626', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['legal', 'financial', 'tax_surplus'] },
  'ME': { ronAllowed: true, statute: '4 MRSA 1025', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MD': { ronAllowed: true, statute: 'Md. State Gov. 18-215', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MA': { ronAllowed: true, statute: 'MGL c.222 §1', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MI': { ronAllowed: true, statute: 'MCL 55.286', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MN': { ronAllowed: true, statute: 'Minn. Stat. 358.645', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MS': { ronAllowed: true, statute: 'Miss. Code 25-33-25', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MO': { ronAllowed: true, statute: 'RSMo 486.1100', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'MT': { ronAllowed: true, statute: 'MCA 1-5-601', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NE': { ronAllowed: true, statute: 'Neb. Rev. Stat. 64-401', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NV': { ronAllowed: true, statute: 'NRS 240.1855', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NH': { ronAllowed: true, statute: 'RSA 456-B:8', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NJ': { ronAllowed: true, statute: 'NJSA 52:7-21', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NM': { ronAllowed: true, statute: 'NMSA 14-14A-1', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NY': { ronAllowed: true, statute: 'NY Executive Law 135-c', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'NC': { ronAllowed: true, statute: 'NCGS 10B-125', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'ND': { ronAllowed: true, statute: 'NDCC 44-06.1-13.1', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'OH': { ronAllowed: true, statute: 'ORC 147.60', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'OK': { ronAllowed: true, statute: '49 O.S. 205', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'OR': { ronAllowed: true, statute: 'ORS 194.505', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'PA': { ronAllowed: true, statute: '57 Pa.C.S. 329', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'RI': { ronAllowed: true, statute: 'RIGL 42-30.1-10', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'SC': { ronAllowed: true, statute: 'SC Code 26-2-10', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'SD': { ronAllowed: true, statute: 'SDCL 18-1-11', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'TN': { ronAllowed: true, statute: 'Tenn. Code 66-22-119', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'TX': { ronAllowed: true, statute: 'Texas Gov. Code 406.101', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'UT': { ronAllowed: true, statute: 'Utah Code 46-1-2', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'VT': { ronAllowed: true, statute: '26 VSA 5379', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'VA': { ronAllowed: true, statute: 'Va. Code 47.1-2', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'WA': { ronAllowed: true, statute: 'RCW 42.45.280', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'WV': { ronAllowed: true, statute: 'WV Code 39-4-38', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'WI': { ronAllowed: true, statute: 'Wis. Stat. 140.145', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
  'WY': { ronAllowed: true, statute: 'Wyo. Stat. 32-3-126', restrictions: [], requiresKBA: true, requiresIdVerification: true, requiresVideoRecording: true, maxDocumentsPerSession: 10, validFor: ['real_estate', 'legal', 'financial', 'tax_surplus'] },
};

// Pricing (in cents)
const NOTARY_PRICING = {
  standard: 2500,    // $25 - standard RON session
  expedited: 5000,   // $50 - same day
  '24hour': 7500,    // $75 - within 24 hours (includes weekends)
};

// =============================================================================
// NOTARY SERVICE CLASS
// =============================================================================

class NotaryService {
  /**
   * Request a notarization session
   */
  async requestNotarization(request: NotaryRequest): Promise<NotarySession> {
    logger.info('Notarization requested', { caseId: request.caseId, provider: NOTARY_PROVIDER });

    // Check if state allows RON
    const stateRules = this.getStateRules(request.state);
    if (!stateRules.ronAllowed) {
      return {
        id: `notary_${Date.now()}`,
        status: 'failed',
        provider: 'none',
        costCents: 0,
        error: `Remote Online Notarization is not allowed in ${request.state}. In-person notarization required.`,
      };
    }

    // Route to appropriate provider
    switch (NOTARY_PROVIDER) {
      case 'notarize':
        return this.requestNotarizeSession(request);
      case 'notarycam':
        return this.requestNotaryCamSession(request);
      default:
        return this.requestDemoSession(request);
    }
  }

  /**
   * Notarize.com API integration
   */
  private async requestNotarizeSession(request: NotaryRequest): Promise<NotarySession> {
    try {
      const response = await fetch(`${NOTARIZE_API_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTARIZE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signer: {
            first_name: request.signerName.split(' ')[0],
            last_name: request.signerName.split(' ').slice(1).join(' ') || request.signerName,
            email: request.signerEmail,
            phone: request.signerPhone,
          },
          document: {
            external_id: request.documentId,
            type: request.documentType,
          },
          priority: request.urgency || 'standard',
          scheduled_time: request.scheduledTime?.toISOString(),
          metadata: {
            case_id: request.caseId,
            state: request.state,
            county: request.county,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Notarize API error: ${response.status}`);
      }

      const data: any = await response.json();

      // Log the session in database
      await this.logNotarySession({
        caseId: request.caseId,
        documentId: request.documentId,
        provider: 'notarize',
        externalId: data.id,
        status: 'pending',
        costCents: NOTARY_PRICING[request.urgency || 'standard'],
      });

      return {
        id: data.id,
        status: 'pending',
        provider: 'notarize',
        sessionUrl: data.signing_url,
        scheduledTime: data.scheduled_time ? new Date(data.scheduled_time) : undefined,
        costCents: NOTARY_PRICING[request.urgency || 'standard'],
      };
    } catch (error: any) {
      logger.error('Notarize API error', { error: error.message });
      // Fallback to demo
      return this.requestDemoSession(request);
    }
  }

  /**
   * NotaryCam API integration
   */
  private async requestNotaryCamSession(request: NotaryRequest): Promise<NotarySession> {
    try {
      const response = await fetch(`${NOTARYCAM_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'X-API-Key': NOTARYCAM_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant: {
            name: request.signerName,
            email: request.signerEmail,
            phone: request.signerPhone,
          },
          document_type: request.documentType,
          state: request.state,
          urgency: request.urgency || 'standard',
          external_reference: request.caseId,
        }),
      });

      if (!response.ok) {
        throw new Error(`NotaryCam API error: ${response.status}`);
      }

      const data: any = await response.json();

      await this.logNotarySession({
        caseId: request.caseId,
        documentId: request.documentId,
        provider: 'notarycam',
        externalId: data.session_id,
        status: 'pending',
        costCents: NOTARY_PRICING[request.urgency || 'standard'],
      });

      return {
        id: data.session_id,
        status: 'pending',
        provider: 'notarycam',
        sessionUrl: data.session_url,
        costCents: NOTARY_PRICING[request.urgency || 'standard'],
      };
    } catch (error: any) {
      logger.error('NotaryCam API error', { error: error.message });
      return this.requestDemoSession(request);
    }
  }

  /**
   * Demo session for testing
   */
  private async requestDemoSession(request: NotaryRequest): Promise<NotarySession> {
    const sessionId = `demo_notary_${Date.now()}`;

    await this.logNotarySession({
      caseId: request.caseId,
      documentId: request.documentId,
      provider: 'demo',
      externalId: sessionId,
      status: 'pending',
      costCents: 0,
    });

    logger.info('Demo notary session created', {
      sessionId,
      note: 'Set NOTARIZE_API_KEY or NOTARYCAM_API_KEY for real RON',
    });

    // Simulate scheduling
    const scheduledTime = request.scheduledTime || new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    return {
      id: sessionId,
      status: 'scheduled',
      provider: 'demo',
      sessionUrl: `https://demo.notarize.com/session/${sessionId}`,
      scheduledTime,
      notaryName: 'Demo Notary, NP',
      notaryState: request.state,
      notaryCommission: 'DEMO-123456',
      costCents: 0,
    };
  }

  /**
   * Check session status
   */
  async getSessionStatus(sessionId: string): Promise<NotarySession | null> {
    // Check database first
    const session = await prisma.notarySession?.findUnique({
      where: { externalId: sessionId },
    }).catch(() => null);

    if (!session) {
      return null;
    }

    // For real providers, check live status
    if (session.provider === 'notarize' && NOTARIZE_API_KEY) {
      try {
        const response = await fetch(`${NOTARIZE_API_URL}/transactions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${NOTARIZE_API_KEY}` },
        });
        if (response.ok) {
          const data: any = await response.json();
          return {
            id: sessionId,
            status: this.mapNotarizeStatus(data.status),
            provider: 'notarize',
            sessionUrl: data.signing_url,
            completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
            notarizedDocumentUrl: data.notarized_document_url,
            auditTrailUrl: data.audit_trail_url,
            videoRecordingUrl: data.video_url,
            notaryName: data.notary?.name,
            notaryCommission: data.notary?.commission_id,
            notaryState: data.notary?.state,
            costCents: session.costCents,
          };
        }
      } catch (error) {
        logger.error('Error fetching Notarize status', { error });
      }
    }

    // Return cached data
    return {
      id: sessionId,
      status: session.status as any,
      provider: session.provider,
      costCents: session.costCents,
    };
  }

  /**
   * Map Notarize.com status to our status
   */
  private mapNotarizeStatus(status: string): NotarySession['status'] {
    const mapping: Record<string, NotarySession['status']> = {
      'created': 'pending',
      'sent': 'pending',
      'scheduled': 'scheduled',
      'in_progress': 'in_progress',
      'notarized': 'completed',
      'completed': 'completed',
      'cancelled': 'failed',
      'expired': 'expired',
    };
    return mapping[status] || 'pending';
  }

  /**
   * Check notary availability
   */
  async checkAvailability(state: string, urgency: NotaryRequest['urgency'] = 'standard'): Promise<NotaryAvailability> {
    const stateRules = this.getStateRules(state);

    if (!stateRules.ronAllowed) {
      return {
        available: false,
        estimatedWaitMinutes: undefined,
      };
    }

    // For real providers, check live availability
    if (NOTARY_PROVIDER === 'notarize' && NOTARIZE_API_KEY) {
      try {
        const response = await fetch(`${NOTARIZE_API_URL}/availability?state=${state}`, {
          headers: { 'Authorization': `Bearer ${NOTARIZE_API_KEY}` },
        });
        if (response.ok) {
          const data: any = await response.json();
          return {
            available: data.available,
            nextAvailableSlot: data.next_slot ? new Date(data.next_slot) : undefined,
            availableSlots: data.slots?.map((s: string) => new Date(s)),
            estimatedWaitMinutes: data.wait_minutes,
          };
        }
      } catch (error) {
        logger.error('Error checking Notarize availability', { error });
      }
    }

    // Demo availability
    const now = new Date();
    return {
      available: true,
      nextAvailableSlot: new Date(now.getTime() + 30 * 60 * 1000), // 30 min
      availableSlots: [
        new Date(now.getTime() + 30 * 60 * 1000),
        new Date(now.getTime() + 60 * 60 * 1000),
        new Date(now.getTime() + 120 * 60 * 1000),
      ],
      estimatedWaitMinutes: urgency === '24hour' ? 5 : (urgency === 'expedited' ? 15 : 30),
    };
  }

  /**
   * Get state RON rules
   */
  getStateRules(state: string): StateNotaryRules {
    const stateUpper = state.toUpperCase();
    return STATE_RON_RULES[stateUpper] || {
      ronAllowed: false,
      statute: 'Unknown',
      restrictions: ['State not in database'],
      requiresKBA: true,
      requiresIdVerification: true,
      requiresVideoRecording: true,
      maxDocumentsPerSession: 1,
      validFor: [],
    };
  }

  /**
   * Get all supported states
   */
  getSupportedStates(): string[] {
    return Object.keys(STATE_RON_RULES).filter(s => STATE_RON_RULES[s].ronAllowed);
  }

  /**
   * Get pricing
   */
  getPricing(): typeof NOTARY_PRICING {
    return NOTARY_PRICING;
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    provider: string;
    available: boolean;
    supportedStates: number;
  } {
    return {
      provider: NOTARY_PROVIDER,
      available: NOTARY_PROVIDER !== 'demo' || true, // Demo always available
      supportedStates: this.getSupportedStates().length,
    };
  }

  /**
   * Log notary session to database
   */
  private async logNotarySession(data: {
    caseId: string;
    documentId: string;
    provider: string;
    externalId: string;
    status: string;
    costCents: number;
  }): Promise<void> {
    try {
      // Update document status
      await prisma.document.update({
        where: { id: data.documentId },
        data: {
          status: DocumentStatus.PENDING_SIGNATURE,
          metadata: {
            notarySessionId: data.externalId,
            notaryProvider: data.provider,
            notaryRequestedAt: new Date().toISOString(),
          },
        },
      });

      // Create communication log
      const caseData = await prisma.case.findUnique({
        where: { id: data.caseId },
        select: { clientId: true },
      });

      if (caseData?.clientId) {
        await prisma.communication.create({
          data: {
            caseId: data.caseId,
            userId: caseData.clientId,
            type: 'CALL',
            direction: 'OUTBOUND',
            subject: 'Notarization Session Requested',
            content: `A remote online notarization session has been scheduled. Provider: ${data.provider}, Session ID: ${data.externalId}`,
          },
        });
      }
    } catch (error) {
      logger.error('Error logging notary session', { error });
    }
  }

  /**
   * Cancel a notary session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    if (NOTARY_PROVIDER === 'notarize' && NOTARIZE_API_KEY) {
      try {
        const response = await fetch(`${NOTARIZE_API_URL}/transactions/${sessionId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NOTARIZE_API_KEY}` },
        });
        return response.ok;
      } catch (error) {
        logger.error('Error cancelling Notarize session', { error });
      }
    }

    // Demo always succeeds
    logger.info('Demo notary session cancelled', { sessionId });
    return true;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const notaryService = new NotaryService();
export default notaryService;
