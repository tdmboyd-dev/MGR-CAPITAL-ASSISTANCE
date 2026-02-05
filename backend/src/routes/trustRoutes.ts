/**
 * trustRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for trust enrollment and management.
 * Employees and child company owners can enroll in trust protection.
 * Founder can view all trusts and beneficiary interests.
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { trustAutomationService, TrustType } from "../services/TrustAutomationService.js";

const router = Router();

// ============================================
// TRUST PLANS (Public)
// ============================================

/**
 * GET /api/trusts/plans — Get available trust plans
 */
router.get(
  "/plans",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const plans = trustAutomationService.getAvailablePlans();

    // For non-founders, hide the founder beneficiary details
    const isFounder = req.user?.role === "FOUNDER";

    const publicPlans = plans.map(plan => ({
      type: plan.type,
      name: plan.name,
      setupFee: plan.setupFeeCents / 100,
      annualFee: plan.annualFeeCents / 100,
      features: plan.features,
      description: plan.description,
      // Only show beneficiary % to founders
      ...(isFounder ? { founderBeneficiaryPercent: plan.founderBeneficiaryPercent } : {}),
    }));

    res.json({ success: true, data: publicPlans });
  })
);

/**
 * GET /api/trusts/states/:state — Get state trust rules
 */
router.get(
  "/states/:state",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state } = req.params;
    const rules = trustAutomationService.getStateRules(state);
    res.json({ success: true, data: rules });
  })
);

// ============================================
// TRUST ENROLLMENT (Employees/Child Company Owners)
// ============================================

/**
 * GET /api/trusts/my-enrollment — Get user's trust enrollment
 */
router.get(
  "/my-enrollment",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const enrollment = await trustAutomationService.getUserEnrollment(req.user!.id);

    if (!enrollment) {
      return res.json({ success: true, data: null, message: "Not enrolled in trust program" });
    }

    // Hide founder details from non-founders
    const isFounder = req.user?.role === "FOUNDER";

    res.json({
      success: true,
      data: {
        id: enrollment.id,
        trustType: enrollment.trustType,
        trustName: enrollment.trustName,
        trustEIN: enrollment.trustEIN,
        status: enrollment.status,
        trustState: enrollment.trustState,
        userBeneficiaryPercent: enrollment.userBeneficiaryPercent,
        additionalBeneficiaries: enrollment.additionalBeneficiaries,
        totalAssetsProtected: enrollment.totalAssetsProtectedCents / 100,
        nextAnnualFeeDate: enrollment.nextAnnualFeeDate,
        enrolledAt: enrollment.enrolledAt,
        activatedAt: enrollment.activatedAt,
        // Only show founder info to founders
        ...(isFounder ? {
          founderBeneficiaryPercent: enrollment.founderBeneficiaryPercent,
          founderInterestValue: enrollment.founderInterestValueCents / 100,
        } : {}),
      },
    });
  })
);

/**
 * POST /api/trusts/enroll — Enroll in trust program
 */
router.post(
  "/enroll",
  authMiddleware,
  roleGuard(["EMPLOYEE", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { trustType, state, additionalBeneficiaries } = req.body;

    if (!trustType || !state) {
      throw Errors.badRequest("trustType and state required");
    }

    const validTypes: TrustType[] = ["BASIC_PROTECTION", "ENHANCED_PROTECTION", "PREMIUM_ESTATE"];
    if (!validTypes.includes(trustType)) {
      throw Errors.badRequest("Invalid trust type");
    }

    // Determine user type - check if user owns a child company
    const childCompany = await prisma.childCompany.findFirst({
      where: { ownerId: req.user!.id, status: "ACTIVE" },
    });

    const userType = childCompany ? "CHILD_COMPANY_OWNER" : "EMPLOYEE";

    const enrollment = await trustAutomationService.enrollUser({
      userId: req.user!.id,
      userType,
      trustType,
      state,
      additionalBeneficiaries,
    });

    res.json({ success: true, data: enrollment });
  })
);

/**
 * POST /api/trusts/:enrollmentId/pay-setup — Pay setup fee
 */
router.post(
  "/:enrollmentId/pay-setup",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { enrollmentId } = req.params;
    const { paymentMethodId } = req.body;

    // Verify user owns this enrollment
    const enrollment = await trustAutomationService.getEnrollment(enrollmentId);
    if (!enrollment) {
      throw Errors.notFound("Enrollment not found");
    }

    if (enrollment.userId !== req.user!.id && req.user!.role !== "FOUNDER") {
      throw Errors.forbidden("Not authorized to access this enrollment");
    }

    const updated = await trustAutomationService.processSetupFee(enrollmentId, paymentMethodId);
    res.json({ success: true, data: updated });
  })
);

/**
 * POST /api/trusts/:enrollmentId/schedule-notarization — Schedule notarization
 */
router.post(
  "/:enrollmentId/schedule-notarization",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { enrollmentId } = req.params;

    const enrollment = await trustAutomationService.getEnrollment(enrollmentId);
    if (!enrollment) {
      throw Errors.notFound("Enrollment not found");
    }

    if (enrollment.userId !== req.user!.id && req.user!.role !== "FOUNDER") {
      throw Errors.forbidden("Not authorized");
    }

    const result = await trustAutomationService.scheduleNotarization(enrollmentId);
    res.json({ success: true, data: result });
  })
);

// ============================================
// FOUNDER TRUST MANAGEMENT
// ============================================

/**
 * GET /api/trusts/all — Get all trust enrollments (Founder only)
 */
router.get(
  "/all",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const enrollments = await trustAutomationService.getAllEnrollments();
    res.json({ success: true, data: enrollments });
  })
);

/**
 * GET /api/trusts/founder-interest — Get founder's total beneficiary interest
 */
router.get(
  "/founder-interest",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const interest = await trustAutomationService.calculateFounderInterest();

    res.json({
      success: true,
      data: {
        totalTrusts: interest.totalTrusts,
        activeTrusts: interest.activeTrusts,
        totalAssetsProtected: interest.totalAssetsProtected / 100,
        founderInterestValue: interest.founderInterestValue / 100,
        byType: {
          BASIC_PROTECTION: {
            count: interest.byType.BASIC_PROTECTION.count,
            interest: interest.byType.BASIC_PROTECTION.interest / 100,
          },
          ENHANCED_PROTECTION: {
            count: interest.byType.ENHANCED_PROTECTION.count,
            interest: interest.byType.ENHANCED_PROTECTION.interest / 100,
          },
          PREMIUM_ESTATE: {
            count: interest.byType.PREMIUM_ESTATE.count,
            interest: interest.byType.PREMIUM_ESTATE.interest / 100,
          },
        },
      },
    });
  })
);

/**
 * GET /api/trusts/:enrollmentId — Get enrollment details (Founder only)
 */
router.get(
  "/:enrollmentId",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { enrollmentId } = req.params;
    const enrollment = await trustAutomationService.getEnrollment(enrollmentId);

    if (!enrollment) {
      throw Errors.notFound("Enrollment not found");
    }

    res.json({ success: true, data: enrollment });
  })
);

/**
 * POST /api/trusts/:enrollmentId/activate — Activate trust (Founder only)
 */
router.post(
  "/:enrollmentId/activate",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { enrollmentId } = req.params;
    const enrollment = await trustAutomationService.activateTrust(enrollmentId);
    res.json({ success: true, data: enrollment });
  })
);

// Need to import prisma for user lookup
import prisma from "../lib/prisma.js";

export default router;
