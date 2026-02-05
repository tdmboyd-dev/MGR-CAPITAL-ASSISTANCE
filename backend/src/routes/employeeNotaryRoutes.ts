/**
 * employeeNotaryRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for employee notary program.
 * Employees can become certified notaries and earn money notarizing
 * surplus recovery documents in-house.
 *
 * This is SEPARATE from:
 * - FounderNotaryService (founder's own notary credentials for trust automation)
 * - NotaryService (external RON providers like Notarize.com)
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { employeeNotaryService } from "../services/EmployeeNotaryService.js";

const router = Router();

// ============================================
// PUBLIC INFO
// ============================================

/**
 * GET /api/employee-notary/requirements/:state — Get state requirements
 */
router.get(
  "/requirements/:state",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state } = req.params;
    const requirements = employeeNotaryService.getStateRequirements(state);
    res.json({ success: true, data: requirements });
  })
);

/**
 * GET /api/employee-notary/requirements — Get all state requirements
 */
router.get(
  "/requirements",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requirements = employeeNotaryService.getAllStateRequirements();
    res.json({ success: true, data: requirements });
  })
);

/**
 * GET /api/employee-notary/tiers — Get tier information
 */
router.get(
  "/tiers",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tiers = employeeNotaryService.getTierInfo();
    res.json({ success: true, data: tiers });
  })
);

/**
 * GET /api/employee-notary/pricing — Get session pricing
 */
router.get(
  "/pricing",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pricing = employeeNotaryService.getPricing();
    res.json({ success: true, data: pricing });
  })
);

// ============================================
// NOTARY APPLICATION (Employees becoming notaries)
// ============================================

/**
 * POST /api/employee-notary/apply — Submit application to become notary
 */
router.post(
  "/apply",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      state,
      commissionNumber,
      commissionExpiration,
      bondNumber,
      eoInsurancePolicyNumber,
    } = req.body;

    if (!state || !commissionNumber || !commissionExpiration) {
      throw Errors.badRequest("state, commissionNumber, and commissionExpiration required");
    }

    const application = await employeeNotaryService.submitApplication(
      req.user!.id,
      state,
      {
        commissionNumber,
        commissionExpiration: new Date(commissionExpiration),
        bondNumber,
        eoInsurancePolicyNumber,
      }
    );

    res.json({ success: true, data: application });
  })
);

/**
 * POST /api/employee-notary/applications/:applicationId/training — Complete training
 */
router.post(
  "/applications/:applicationId/training",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.params;
    const { examScore } = req.body;

    const application = await employeeNotaryService.completeTraining(
      applicationId,
      examScore
    );

    res.json({ success: true, data: application });
  })
);

/**
 * POST /api/employee-notary/applications/:applicationId/background-check — Process background check
 * ADMIN/FOUNDER only
 */
router.post(
  "/applications/:applicationId/background-check",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.params;
    const { result } = req.body;

    if (!result || !["pass", "fail"].includes(result)) {
      throw Errors.badRequest("result must be 'pass' or 'fail'");
    }

    const application = await employeeNotaryService.processBackgroundCheck(
      applicationId,
      result
    );

    res.json({ success: true, data: application });
  })
);

/**
 * POST /api/employee-notary/applications/:applicationId/approve — Approve application
 * ADMIN/FOUNDER only
 */
router.post(
  "/applications/:applicationId/approve",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.params;

    const application = await employeeNotaryService.approveApplication(
      applicationId,
      req.user!.id
    );

    res.json({ success: true, data: application });
  })
);

// ============================================
// NOTARY DASHBOARD (Active notaries)
// ============================================

/**
 * GET /api/employee-notary/dashboard — Get notary's dashboard stats
 * Shadow accounting: shows "displayed earnings" - notary never sees real client payment
 */
router.get(
  "/dashboard",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await employeeNotaryService.getDashboardStats(req.user!.id);

    // Remove founder-only data unless user is founder
    if (req.user?.role !== "FOUNDER") {
      delete (stats as any)._founderOnly;
    }

    res.json({ success: true, data: stats });
  })
);

/**
 * GET /api/employee-notary/available — Get available notaries for booking
 */
router.get(
  "/available",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, scheduledTime } = req.query;

    if (!state) {
      throw Errors.badRequest("state required");
    }

    const notaries = await employeeNotaryService.getAvailableNotaries(
      state as string,
      scheduledTime ? new Date(scheduledTime as string) : new Date()
    );

    res.json({ success: true, data: notaries });
  })
);

// ============================================
// NOTARY SESSIONS (Booking & completing notarizations)
// ============================================

/**
 * POST /api/employee-notary/sessions — Create a notary session (book a notary)
 */
router.post(
  "/sessions",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      notaryId,
      clientName,
      clientEmail,
      clientPhone,
      documentType,
      sessionType,
      scheduledTime,
      caseId,
    } = req.body;

    if (!notaryId || !clientName || !clientEmail || !documentType || !sessionType || !scheduledTime) {
      throw Errors.badRequest("notaryId, clientName, clientEmail, documentType, sessionType, scheduledTime required");
    }

    const session = await employeeNotaryService.createSession({
      notaryId,
      clientName,
      clientEmail,
      clientPhone,
      documentType,
      sessionType,
      scheduledTime: new Date(scheduledTime),
      caseId,
    });

    // Only return safe fields to non-founders
    const safeSession = req.user?.role === "FOUNDER" ? session : {
      id: session.id,
      notaryId: session.notaryId,
      clientName: session.clientName,
      clientEmail: session.clientEmail,
      documentType: session.documentType,
      sessionType: session.sessionType,
      status: session.status,
      scheduledTime: session.scheduledTime,
      // Show displayed earnings, not real client payment
      earningsCents: session.displayedEarningsCents,
    };

    res.json({ success: true, data: safeSession });
  })
);

/**
 * POST /api/employee-notary/sessions/:sessionId/complete — Complete a session
 */
router.post(
  "/sessions/:sessionId/complete",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;
    const { videoUrl, auditLogUrl } = req.body;

    if (!videoUrl || !auditLogUrl) {
      throw Errors.badRequest("videoUrl and auditLogUrl required for RON compliance");
    }

    const session = await employeeNotaryService.completeSession(
      sessionId,
      videoUrl,
      auditLogUrl
    );

    // Only return safe fields to non-founders
    const safeSession = req.user?.role === "FOUNDER" ? session : {
      id: session.id,
      status: session.status,
      completedAt: session.completedAt,
      // Show displayed earnings, not real
      earningsCents: session.displayedEarningsCents,
    };

    res.json({ success: true, data: safeSession });
  })
);

// ============================================
// SELF-HOSTED RON SESSION (No external providers)
// ============================================

/**
 * POST /api/employee-notary/ron/:sessionId/start — Start RON session for a scheduled notary session
 * This initiates the self-hosted video call, ID verification, and KBA process
 */
router.post(
  "/ron/:sessionId/start",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId } = req.params;

    const result = await employeeNotaryService.startRONSession(
      req.user!.id,
      sessionId
    );

    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/employee-notary/ron/:ronSessionId/verify-id — Verify signer's government ID
 * AI face matching compares selfie with ID photo
 */
router.post(
  "/ron/:ronSessionId/verify-id",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ronSessionId } = req.params;
    const {
      idType,
      idNumber,
      idState,
      idExpiration,
      frontImageBase64,
      backImageBase64,
      selfieImageBase64,
    } = req.body;

    if (!idType || !idNumber || !idExpiration || !frontImageBase64 || !selfieImageBase64) {
      throw Errors.badRequest("idType, idNumber, idExpiration, frontImageBase64, selfieImageBase64 required");
    }

    const result = await employeeNotaryService.verifySignerID(ronSessionId, {
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
 * GET /api/employee-notary/ron/:ronSessionId/kba — Get KBA questions
 */
router.get(
  "/ron/:ronSessionId/kba",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ronSessionId } = req.params;
    const questions = await employeeNotaryService.getKBAQuestions(ronSessionId);

    // Don't expose correct answers to frontend!
    const safeQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      category: q.category,
    }));

    res.json({ success: true, data: safeQuestions });
  })
);

/**
 * POST /api/employee-notary/ron/:ronSessionId/kba — Submit KBA answers
 */
router.post(
  "/ron/:ronSessionId/kba",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ronSessionId } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      throw Errors.badRequest("answers array required");
    }

    const result = await employeeNotaryService.verifyKBAAnswers(ronSessionId, answers);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/employee-notary/ron/:ronSessionId/video/start — Start video session
 * Returns WebRTC room info for the video call
 */
router.post(
  "/ron/:ronSessionId/video/start",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ronSessionId } = req.params;
    const result = await employeeNotaryService.startVideoSession(ronSessionId);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/employee-notary/ron/:ronSessionId/complete — Complete notarization
 * Applies seal, generates certificate, creates journal entry
 */
router.post(
  "/ron/:ronSessionId/complete",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ronSessionId } = req.params;
    const {
      scheduledSessionId,
      signerSignatureBase64,
      videoRecordingUrl,
      videoDuration,
    } = req.body;

    if (!scheduledSessionId || !signerSignatureBase64 || !videoRecordingUrl) {
      throw Errors.badRequest("scheduledSessionId, signerSignatureBase64, videoRecordingUrl required");
    }

    const result = await employeeNotaryService.completeRONSession(
      ronSessionId,
      scheduledSessionId,
      {
        signerSignatureBase64,
        videoRecordingUrl,
        videoDuration: videoDuration || 0,
      }
    );

    res.json({ success: true, data: result });
  })
);

// ============================================
// FOUNDER ADMIN (Full visibility)
// ============================================

/**
 * GET /api/employee-notary/admin/stats — Get all notary stats (FOUNDER ONLY)
 * Shows real revenue breakdown including shadow accounting
 */
router.get(
  "/admin/stats",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { default: prisma } = await import("../lib/prisma.js");

    // Get all notary profiles with full stats
    const profiles = await prisma.notaryProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Get all sessions for revenue calculation
    const sessions = await prisma.notarySessionRecord.findMany({
      where: { status: "completed" },
    });

    // Calculate totals
    let totalClientPaid = 0;
    let totalNotaryPaid = 0;
    let totalPlatformProfit = 0;

    for (const session of sessions) {
      totalClientPaid += session.grossAmountCents;
      totalNotaryPaid += session.netToNotaryCents;
      totalPlatformProfit += session.homeOfficeTakeCents;
    }

    res.json({
      success: true,
      data: {
        totalNotaries: profiles.length,
        activeNotaries: profiles.filter(p => p.isActive).length,
        totalSessions: sessions.length,
        revenue: {
          clientPaidCents: totalClientPaid,
          notaryPaidCents: totalNotaryPaid,
          platformProfitCents: totalPlatformProfit,
          // Human readable
          clientPaid: `$${(totalClientPaid / 100).toFixed(2)}`,
          notaryPaid: `$${(totalNotaryPaid / 100).toFixed(2)}`,
          platformProfit: `$${(totalPlatformProfit / 100).toFixed(2)}`,
        },
        shadowAccountingNote: "Notaries see 'displayed earnings' as their 100% base. They think platform fees range 0-40%. Reality: They never see full client payment (hidden base = 50% of client paid).",
        notaries: profiles.map(p => ({
          userId: p.userId,
          name: p.user.name,
          state: p.state,
          level: p.level,
          totalSignings: p.totalSignings,
          lifetimeGross: p.lifetimeGrossCents,
          lifetimeNet: p.lifetimeNetCents,
          lifetimePlatformProfit: p.lifetimeHomeOfficeCents,
          isActive: p.isActive,
        })),
      },
    });
  })
);

/**
 * GET /api/employee-notary/admin/applications — Get all applications (FOUNDER/ADMIN)
 */
router.get(
  "/admin/applications",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { default: prisma } = await import("../lib/prisma.js");

    const applications = await prisma.notaryApplication.findMany({
      orderBy: { submittedAt: "desc" },
    });

    res.json({ success: true, data: applications });
  })
);

// ============================================
// AUTOMATION BOT SUBSCRIPTIONS
// ============================================

/**
 * GET /api/employee-notary/automation/plans — Get available automation plans
 */
router.get(
  "/automation/plans",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notaryAutomationBotService } = await import("../services/NotaryAutomationBotService.js");
    const plans = notaryAutomationBotService.getPlans();
    res.json({ success: true, data: plans });
  })
);

/**
 * GET /api/employee-notary/automation/subscription — Get current subscription
 */
router.get(
  "/automation/subscription",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notaryAutomationBotService } = await import("../services/NotaryAutomationBotService.js");
    const subscription = await notaryAutomationBotService.getSubscription(req.user!.id);
    res.json({ success: true, data: subscription });
  })
);

/**
 * POST /api/employee-notary/automation/subscribe — Subscribe to automation
 */
router.post(
  "/automation/subscribe",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tier } = req.body;

    if (!tier || !["BASIC", "PROFESSIONAL", "ENTERPRISE"].includes(tier)) {
      throw Errors.badRequest("tier must be BASIC, PROFESSIONAL, or ENTERPRISE");
    }

    const { notaryAutomationBotService } = await import("../services/NotaryAutomationBotService.js");
    const subscription = await notaryAutomationBotService.subscribe(req.user!.id, tier);
    res.json({ success: true, data: subscription });
  })
);

/**
 * DELETE /api/employee-notary/automation/cancel — Cancel automation subscription
 */
router.delete(
  "/automation/cancel",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notaryAutomationBotService } = await import("../services/NotaryAutomationBotService.js");
    await notaryAutomationBotService.cancel(req.user!.id);
    res.json({ success: true, message: "Subscription cancelled" });
  })
);

/**
 * GET /api/employee-notary/automation/status — Check if automation is enabled
 */
router.get(
  "/automation/status",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notaryAutomationBotService } = await import("../services/NotaryAutomationBotService.js");
    const status = await notaryAutomationBotService.isAutomationEnabled(req.user!.id);
    res.json({ success: true, data: status });
  })
);

export default router;
