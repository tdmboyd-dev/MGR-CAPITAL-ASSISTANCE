/**
 * founderNotaryRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for founder's self-hosted notary system.
 * Allows founder to configure credentials and manage RON sessions.
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { founderNotaryService } from "../services/FounderNotaryService.js";

const router = Router();

// ============================================
// FOUNDER NOTARY CONFIGURATION
// ============================================

/**
 * GET /api/founder-notary/config — Get notary configuration
 */
router.get(
  "/config",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const credentials = await founderNotaryService.getCredentials();
    const isActive = await founderNotaryService.isActive();

    res.json({
      success: true,
      data: {
        configured: !!credentials,
        isActive,
        credentials: credentials ? {
          notaryName: credentials.notaryName,
          commissionState: credentials.commissionState,
          commissionExpiration: credentials.commissionExpiration,
          hasSeal: !!credentials.digitalSealBase64,
          hasSignature: !!credentials.digitalSignatureBase64,
        } : null,
      },
    });
  })
);

/**
 * POST /api/founder-notary/config — Configure notary credentials
 */
router.post(
  "/config",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      notaryName,
      commissionNumber,
      commissionState,
      commissionCounty,
      commissionExpiration,
      bondAmount,
      bondNumber,
      eoInsuranceProvider,
      eoInsurancePolicyNumber,
      digitalSealBase64,
      digitalSignatureBase64,
    } = req.body;

    if (!notaryName || !commissionNumber || !commissionState || !commissionExpiration) {
      throw Errors.badRequest("notaryName, commissionNumber, commissionState, and commissionExpiration required");
    }

    const credentials = await founderNotaryService.configureCredentials({
      notaryName,
      commissionNumber,
      commissionState,
      commissionCounty,
      commissionExpiration: new Date(commissionExpiration),
      bondAmount,
      bondNumber,
      eoInsuranceProvider,
      eoInsurancePolicyNumber,
      digitalSealBase64,
      digitalSignatureBase64,
      isActive: true,
    });

    res.json({ success: true, data: credentials });
  })
);

// ============================================
// RON SESSIONS
// ============================================

/**
 * POST /api/founder-notary/sessions — Create RON session
 */
router.post(
  "/sessions",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      signerName,
      signerEmail,
      signerPhone,
      signerAddress,
      signerDOB,
      documentIds,
      documentType,
      scheduledTime,
      caseId,
      trustId,
    } = req.body;

    if (!signerName || !signerEmail || !documentIds?.length || !documentType) {
      throw Errors.badRequest("signerName, signerEmail, documentIds, and documentType required");
    }

    const session = await founderNotaryService.createRONSession({
      signerName,
      signerEmail,
      signerPhone,
      signerAddress,
      signerDOB: signerDOB ? new Date(signerDOB) : undefined,
      documentIds,
      documentType,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
      caseId,
      trustId,
    });

    res.json({ success: true, data: session });
  })
);

/**
 * POST /api/founder-notary/sessions/:sessionId/verify-id — Verify signer ID
 */
router.post(
  "/sessions/:sessionId/verify-id",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const {
      idType,
      idNumber,
      idState,
      idExpiration,
      frontImageBase64,
      backImageBase64,
      selfieImageBase64,
    } = req.body;

    if (!idType || !idNumber || !idState || !idExpiration || !frontImageBase64 || !selfieImageBase64) {
      throw Errors.badRequest("ID details and images required");
    }

    const result = await founderNotaryService.verifySignerID(sessionId, {
      idType,
      idNumber,
      idState,
      idExpiration: new Date(idExpiration),
      frontImageBase64,
      backImageBase64,
      selfieImageBase64,
    });

    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/founder-notary/sessions/:sessionId/kba — Get KBA questions
 */
router.get(
  "/sessions/:sessionId/kba",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const questions = await founderNotaryService.getKBAQuestions(sessionId);
    res.json({ success: true, data: questions });
  })
);

/**
 * POST /api/founder-notary/sessions/:sessionId/kba — Submit KBA answers
 */
router.post(
  "/sessions/:sessionId/kba",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const { answers } = req.body;

    if (!answers?.length) {
      throw Errors.badRequest("answers required");
    }

    const result = await founderNotaryService.verifyKBAAnswers(sessionId, answers);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/founder-notary/sessions/:sessionId/start-video — Start video recording
 */
router.post(
  "/sessions/:sessionId/start-video",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const result = await founderNotaryService.startVideoRecording(sessionId);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/founder-notary/sessions/:sessionId/complete — Complete notarization
 */
router.post(
  "/sessions/:sessionId/complete",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const { signatureImageBase64, videoRecordingUrl, videoRecordingDuration } = req.body;

    if (!signatureImageBase64 || !videoRecordingUrl) {
      throw Errors.badRequest("signatureImageBase64 and videoRecordingUrl required");
    }

    const result = await founderNotaryService.completeNotarization(sessionId, {
      signatureImageBase64,
      videoRecordingUrl,
      videoRecordingDuration: videoRecordingDuration || 0,
    });

    res.json({ success: true, data: result });
  })
);

// ============================================
// NOTARY JOURNAL
// ============================================

/**
 * GET /api/founder-notary/journal — Get journal entries
 */
router.get(
  "/journal",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, signerName } = req.query;

    const entries = await founderNotaryService.getJournalEntries({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      signerName: signerName as string,
    });

    res.json({ success: true, data: entries });
  })
);

/**
 * GET /api/founder-notary/journal/export — Export journal
 */
router.get(
  "/journal/export",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const format = (req.query.format as 'pdf' | 'csv' | 'json') || 'pdf';
    const exportUrl = await founderNotaryService.exportJournal(format);
    res.json({ success: true, data: { url: exportUrl } });
  })
);

// ============================================
// STATE RULES
// ============================================

/**
 * GET /api/founder-notary/states — Get all state RON rules
 */
router.get(
  "/states",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rules = founderNotaryService.getAllStateRules();
    res.json({ success: true, data: rules });
  })
);

/**
 * GET /api/founder-notary/states/:state — Get state RON rules
 */
router.get(
  "/states/:state",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state } = req.params;
    const rules = founderNotaryService.getStateRules(state);
    res.json({ success: true, data: rules });
  })
);

export default router;
