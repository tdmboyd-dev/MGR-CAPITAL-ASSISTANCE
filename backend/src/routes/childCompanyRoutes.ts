// ============================================
// CHILD COMPANY ROUTES — MGR CAPITAL ASSISTANCE
// Employee: eligibility, offer, accept, setup
// Founder: management, shadow revenue view
// ============================================

import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { childCompanyService } from "../services/ChildCompanyService.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// EMPLOYEE ROUTES
// ============================================

/**
 * GET /api/child-companies/eligibility — Check if employee qualifies
 */
router.get(
  "/eligibility",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await childCompanyService.checkEligibility(req.user!.id);
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/child-companies/offer — Get current offer for employee
 */
router.get(
  "/offer",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const offer = await prisma.childCompanyOffer.findFirst({
      where: {
        employeeId: req.user!.id,
        isAccepted: false,
        isDeclined: false,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: offer });
  })
);

/**
 * POST /api/child-companies/accept — Accept offer and set up company
 */
router.post(
  "/accept",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { offerId, companyName, slug, plan, logoUrl, primaryColor, secondaryColor, accentColor } = req.body;

    if (!offerId || !companyName || !slug || !plan) {
      throw Errors.badRequest("offerId, companyName, slug, and plan are required");
    }

    if (!["BRANDED", "WHITE_LABEL"].includes(plan)) {
      throw Errors.badRequest("Plan must be BRANDED or WHITE_LABEL");
    }

    // Verify offer belongs to this employee
    const offer = await prisma.childCompanyOffer.findFirst({
      where: { id: offerId, employeeId: req.user!.id },
    });
    if (!offer) throw Errors.notFound("Offer");

    const result = await childCompanyService.acceptOffer(offerId, {
      companyName,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      plan,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to accept offer");
    }

    res.json({ success: true, data: { childCompanyId: result.childCompanyId } });
  })
);

/**
 * GET /api/child-companies/my — Get employee's child company
 */
router.get(
  "/my",
  authMiddleware,
  roleGuard(["EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const company = await prisma.childCompany.findFirst({
      where: { ownerId: req.user!.id },
      include: {
        offers: { orderBy: { createdAt: "desc" }, take: 1 },
        transfers: {
          where: { status: { in: ["PENDING", "COOLING_PERIOD"] } },
        },
      },
    });

    res.json({ success: true, data: company });
  })
);

// ============================================
// FOUNDER ROUTES
// ============================================

/**
 * GET /api/child-companies — List all child companies (FOUNDER)
 */
router.get(
  "/",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const companies = await childCompanyService.getAllChildCompanies();
    res.json({ success: true, data: companies });
  })
);

/**
 * GET /api/child-companies/:id — Get child company details (FOUNDER)
 */
router.get(
  "/:id",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const company = await prisma.childCompany.findUnique({
      where: { id: req.params.id },
      include: {
        offers: true,
        transfers: true,
      },
    });

    if (!company) throw Errors.notFound("Child Company");

    res.json({ success: true, data: company });
  })
);

/**
 * GET /api/child-companies/:id/revenue — Shadow revenue view (FOUNDER ONLY)
 */
router.get(
  "/:id/revenue",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const revenue = await childCompanyService.getFounderChildCompanyRevenue(req.params.id);
    if (!revenue) throw Errors.notFound("Child Company");

    // Calculate example breakdown for a $10,000 case at each tier
    const exampleBreakdowns = [
      "TIER_1_ASSOCIATE",
      "TIER_2_SPECIALIST",
      "TIER_3_SENIOR_SPECIALIST",
      "TIER_4_TEAM_LEADER",
      "TIER_5_EXECUTIVE_PARTNER",
    ].map((tier) => ({
      tier,
      ...childCompanyService.calculateShadowBreakdown(1000000, tier, true), // $10,000
    }));

    res.json({
      success: true,
      data: {
        company: revenue,
        exampleBreakdowns,
      },
    });
  })
);

/**
 * PATCH /api/child-companies/:id — Update child company (FOUNDER)
 */
router.patch(
  "/:id",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, plan, annualFeeCents, parentCutTier1, parentCutTier2, parentCutTier3Plus } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (plan) updateData.plan = plan;
    if (annualFeeCents !== undefined) updateData.annualFeeCents = annualFeeCents;
    if (parentCutTier1 !== undefined) updateData.parentCutTier1 = parentCutTier1;
    if (parentCutTier2 !== undefined) updateData.parentCutTier2 = parentCutTier2;
    if (parentCutTier3Plus !== undefined) updateData.parentCutTier3Plus = parentCutTier3Plus;

    const updated = await prisma.childCompany.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * POST /api/child-companies/transfer — Initiate employee transfer
 */
router.post(
  "/transfer",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId, toChildCompanyId } = req.body;

    if (!employeeId || !toChildCompanyId) {
      throw Errors.badRequest("employeeId and toChildCompanyId required");
    }

    const result = await childCompanyService.initiateTransfer({ employeeId, toChildCompanyId });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to initiate transfer");
    }

    res.json({ success: true, data: { transferId: result.transferId } });
  })
);

/**
 * POST /api/child-companies/transfer/:id/cancel — Cancel transfer during cooling
 */
router.post(
  "/transfer/:id/cancel",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await childCompanyService.cancelTransfer(req.params.id, req.body.reason);

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to cancel transfer");
    }

    res.json({ success: true, message: "Transfer cancelled" });
  })
);

export default router;
