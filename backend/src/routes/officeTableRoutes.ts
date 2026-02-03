// ============================================
// THE OFFICE TABLE ROUTES — MGR CAPITAL ASSISTANCE
// Contracts, Violations, Bans Management
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { officeTableService } from "../services/OfficeTableService.js";
import { ContractType, ViolationType, BanSeverity } from "../config/contracts.js";

const router = Router();

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/office-table/summary — Get Office Table dashboard summary
 */
router.get(
  "/summary",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await officeTableService.getOfficeTableSummary();
    res.json({ success: true, data: summary });
  })
);

/**
 * GET /api/office-table/config — Get violation types and contract types
 */
router.get(
  "/config",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const violationTypes = officeTableService.getViolationTypes();
    const contractTypes = officeTableService.getContractTypes();

    res.json({
      success: true,
      data: {
        violationTypes,
        contractTypes,
        banSeverities: ["WARNING", "MINOR", "MODERATE", "SEVERE", "TERMINATION"],
        payReductions: {
          WARNING: 0,
          MINOR: 10,
          MODERATE: 25,
          SEVERE: 50,
          TERMINATION: 100,
        },
      },
    });
  })
);

// ============================================
// CONTRACTS
// ============================================

/**
 * POST /api/office-table/contracts — Create a contract for a user
 */
router.post(
  "/contracts",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, contractType } = req.body;

    if (!userId || !contractType) {
      throw Errors.badRequest("userId and contractType are required");
    }

    if (!Object.values(ContractType).includes(contractType)) {
      throw Errors.badRequest("Invalid contract type");
    }

    const result = await officeTableService.createContract(
      userId,
      contractType as ContractType,
      req.user!.id
    );

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({ success: true, data: { contractId: result.contractId } });
  })
);

/**
 * POST /api/office-table/contracts/onboarding — Create all onboarding contracts for new employee
 */
router.post(
  "/contracts/onboarding",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, isContractor } = req.body;

    if (!userId) throw Errors.badRequest("userId is required");

    const contractIds = await officeTableService.createOnboardingContracts(
      userId,
      req.user!.id,
      isContractor || false
    );

    res.json({ success: true, data: { contractIds } });
  })
);

/**
 * GET /api/office-table/contracts/user/:userId — Get user's contracts
 */
router.get(
  "/contracts/user/:userId",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contracts = await officeTableService.getUserContracts(req.params.userId);
    res.json({ success: true, data: contracts });
  })
);

/**
 * GET /api/office-table/contracts/pending — Get user's pending contracts (self)
 */
router.get(
  "/contracts/pending",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contracts = await officeTableService.getPendingContracts(req.user!.id);
    res.json({ success: true, data: contracts });
  })
);

/**
 * POST /api/office-table/contracts/:id/sign — Sign a contract
 */
router.post(
  "/contracts/:id/sign",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { signatureData } = req.body;

    if (!signatureData) throw Errors.badRequest("signatureData is required");

    const ip = req.ip || req.socket.remoteAddress || "unknown";

    const result = await officeTableService.signContract(
      req.params.id,
      signatureData,
      ip
    );

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({ success: true, message: "Contract signed" });
  })
);

// ============================================
// VIOLATIONS
// ============================================

/**
 * POST /api/office-table/violations — Report a violation
 */
router.post(
  "/violations",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE", "TEAM_LEAD"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, violationType, description, evidence, relatedCaseId } = req.body;

    if (!userId || !violationType || !description) {
      throw Errors.badRequest("userId, violationType, and description are required");
    }

    if (!Object.values(ViolationType).includes(violationType)) {
      throw Errors.badRequest("Invalid violation type");
    }

    const result = await officeTableService.reportViolation({
      userId,
      violationType: violationType as ViolationType,
      description,
      evidence,
      relatedCaseId,
      reportedBy: req.user!.id,
    });

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({ success: true, data: { violationId: result.violationId } });
  })
);

/**
 * GET /api/office-table/violations/pending — Get pending violations
 */
router.get(
  "/violations/pending",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const violations = await officeTableService.getPendingViolations();
    res.json({ success: true, data: violations });
  })
);

/**
 * GET /api/office-table/violations/user/:userId — Get user's violations
 */
router.get(
  "/violations/user/:userId",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const violations = await officeTableService.getUserViolations(req.params.userId);
    res.json({ success: true, data: violations });
  })
);

/**
 * POST /api/office-table/violations/:id/review — Review a violation
 */
router.post(
  "/violations/:id/review",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { confirmed, notes, adjustedSeverity } = req.body;

    if (confirmed === undefined) {
      throw Errors.badRequest("confirmed (true/false) is required");
    }

    const result = await officeTableService.reviewViolation(
      req.params.id,
      req.user!.id,
      confirmed,
      notes,
      adjustedSeverity as BanSeverity | undefined
    );

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({
      success: true,
      message: confirmed ? "Violation confirmed and ban issued" : "Violation dismissed",
      data: result.banId ? { banId: result.banId } : undefined,
    });
  })
);

// ============================================
// BANS
// ============================================

/**
 * POST /api/office-table/bans — Issue a direct ban (without violation report)
 */
router.post(
  "/bans",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, severity, reason, durationDays } = req.body;

    if (!userId || !severity || !reason) {
      throw Errors.badRequest("userId, severity, and reason are required");
    }

    if (!Object.values(BanSeverity).includes(severity)) {
      throw Errors.badRequest("Invalid severity");
    }

    const result = await officeTableService.issueBan({
      userId,
      severity: severity as BanSeverity,
      reason,
      durationDays,
      issuedBy: req.user!.id,
    });

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({ success: true, data: { banId: result.banId } });
  })
);

/**
 * GET /api/office-table/bans/active — Get active bans
 */
router.get(
  "/bans/active",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bans = await officeTableService.getActiveBans();
    res.json({ success: true, data: bans });
  })
);

/**
 * GET /api/office-table/bans/appeals — Get bans under appeal
 */
router.get(
  "/bans/appeals",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bans = await officeTableService.getAppealedBans();
    res.json({ success: true, data: bans });
  })
);

/**
 * GET /api/office-table/bans/user/:userId — Get user's bans
 */
router.get(
  "/bans/user/:userId",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bans = await officeTableService.getUserBans(req.params.userId);
    res.json({ success: true, data: bans });
  })
);

/**
 * POST /api/office-table/bans/:id/appeal — Appeal a ban (self)
 */
router.post(
  "/bans/:id/appeal",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appealReason } = req.body;

    if (!appealReason) throw Errors.badRequest("appealReason is required");

    const result = await officeTableService.appealBan(req.params.id, appealReason);

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({ success: true, message: "Appeal submitted" });
  })
);

/**
 * POST /api/office-table/bans/:id/review-appeal — Review an appeal
 */
router.post(
  "/bans/:id/review-appeal",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { approved } = req.body;

    if (approved === undefined) {
      throw Errors.badRequest("approved (true/false) is required");
    }

    const result = await officeTableService.reviewAppeal(
      req.params.id,
      req.user!.id,
      approved
    );

    if (!result.success) throw Errors.badRequest(result.error!);

    res.json({
      success: true,
      message: approved ? "Appeal approved, ban lifted" : "Appeal denied",
    });
  })
);

// ============================================
// USER COMPLIANCE PROFILE
// ============================================

/**
 * GET /api/office-table/profile/:userId — Get user's full compliance profile
 */
router.get(
  "/profile/:userId",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "HR", "COMPLIANCE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await officeTableService.getUserComplianceProfile(req.params.userId);
    res.json({ success: true, data: profile });
  })
);

/**
 * GET /api/office-table/my-profile — Get own compliance profile
 */
router.get(
  "/my-profile",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await officeTableService.getUserComplianceProfile(req.user!.id);
    res.json({ success: true, data: profile });
  })
);

export default router;
