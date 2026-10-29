

// =============================================================================
// KBA QUESTION GENERATOR
// =============================================================================

interface KBAQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
}

// =============================================================================
// TYPES
// =============================================================================

export interface RONSessionConfig {
  notaryId: string;
  notaryName: string;
  notaryCommission: string;
  notaryState: string;
  notaryCounty?: string;
  notaryExpiration: Date;
  digitalSealBase64?: string;
  digitalSignatureBase64?: string;
}

export interface SignerInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  url?: string;
  base64?: string;
}

export interface IDVerificationData {
  idType: 'drivers_license' | 'passport' | 'state_id' | 'military_id';
  idNumber: string;
  idState?: string;
  idExpiration: Date;
  frontImageBase64: string;
  backImageBase64?: string;
  selfieImageBase64: string;
}

export interface RONSession {
  id: string;
  status: 'created' | 'id_verification' | 'kba_pending' | 'kba_passed' | 'kba_failed' |
          'video_started' | 'signing' | 'completed' | 'cancelled' | 'expired';

  // Notary info
  notaryId: string;
  notaryName: string;
  notaryCommission: string;
  notaryState: string;

  // Signer info
  signer: SignerInfo;

  // Documents
  documents: DocumentInfo[];

  // Verification status
  idVerified: boolean;
  idVerificationScore?: number;
  kbaPassed: boolean;
  kbaScore?: number;
  kbaAttemptsRemaining: number;

  // Video
  videoRecordingUrl?: string;
  videoStartedAt?: Date;
  videoDuration?: number;

  // Signing
  signerSignatureBase64?: string;
  notaryCertificateUrl?: string;

  // Timing
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

// =============================================================================
// SELF-HOSTED RON SERVICE
// =============================================================================

class SelfHostedRONService {
  private sessions: Map<string, RONSession> = new Map();

  /**
   * Create a new RON session
   */
  async createSession(
    config: RONSessionConfig,
    signer: SignerInfo,
    documents: DocumentInfo[],
    caseId?: string
  ): Promise<RONSession>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Verify signer's government ID
   * Uses AI face matching to compare selfie with ID photo
   */
  async verifyID(sessionId: string, idData: IDVerificationData): Promise<{
    verified: boolean;
    score: number;
    errors: string[];
  }>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Generate KBA questions for signer
   */
  async generateKBAQuestions(sessionId: string): Promise<KBAQuestion[]>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Verify KBA answers
   */
  async verifyKBAAnswers(
    sessionId: string,
    answers: { questionId: string; selectedIndex: number }[]
  ): Promise<{
    passed: boolean;
    score: number;
    attemptsRemaining: number;
  }>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Start video recording for the session
   * Returns WebRTC connection details for the video call
   */
  async startVideoSession(sessionId: string): Promise<{
    roomId: string;
    signerJoinUrl: string;
    notaryJoinUrl: string;
    recordingStarted: boolean;
  }>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Complete the notarization
   * Applies digital seal, signature, and generates certificate
   */
  async completeNotarization(
    sessionId: string,
    data: {
      signerSignatureBase64: string;
      videoRecordingUrl: string;
      videoDuration: number;
      notarySealBase64?: string;
      notarySignatureBase64?: string;
    }
  ): Promise<{
    success: boolean;
    notarizedDocumentUrls: string[];
    certificateUrl: string;
    journalEntryId: string;
    auditTrailUrl: string;
  }>{ throw new Error("Remote notarization unavailable pending real identity evidence, durable sessions, recording, document storage and journal verification. No notarization was performed."); }

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<RONSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get state RON requirements
   */
  getStateRequirements(state: string): {
    ronAllowed: boolean;
    statute: string;
    requiresKBA: boolean;
    requiresIdVerification: boolean;
    requiresVideoRecording: boolean;
    minimumVideoRetention: string;
    maxDocumentsPerSession: number;
  }{ throw new Error("Jurisdiction requirements unavailable until current official sources and the actual notarization workflow are qualified."); }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const selfHostedRONService = new SelfHostedRONService();
export default selfHostedRONService;
