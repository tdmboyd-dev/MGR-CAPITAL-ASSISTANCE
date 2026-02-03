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
    const {
      offerId,
      companyName,
      slug,
      plan,
      emailDomainType,  // "SUBDOMAIN" or "CUSTOM"
      customDomain,      // Required if emailDomainType is "CUSTOM"
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor
    } = req.body;

    if (!offerId || !companyName || !slug || !plan) {
      throw Errors.badRequest("offerId, companyName, slug, and plan are required");
    }

    if (!["BRANDED", "WHITE_LABEL"].includes(plan)) {
      throw Errors.badRequest("Plan must be BRANDED or WHITE_LABEL");
    }

    // Email domain type is required and must be valid
    if (!emailDomainType || !["SUBDOMAIN", "CUSTOM"].includes(emailDomainType)) {
      throw Errors.badRequest("emailDomainType must be SUBDOMAIN or CUSTOM");
    }

    // Custom domain required if using CUSTOM email domain type
    if (emailDomainType === "CUSTOM" && !customDomain) {
      throw Errors.badRequest("customDomain is required when emailDomainType is CUSTOM");
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
      emailDomainType,
      customDomain,
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

/**
 * GET /api/child-companies/fee-info — Get all fee information (public pricing reference)
 * Must be before /:id routes
 */
router.get(
  "/fee-info",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const feeInfo = childCompanyService.getAllFeeInfo();

    res.json({ success: true, data: feeInfo });
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
 * GET /api/child-companies/:id/email-pricing — Get email pricing info for child company
 */
router.get(
  "/:id/email-pricing",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const company = await prisma.childCompany.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        ownerId: true,
        emailDomainType: true,
        emailDomainLocked: true,
        emailDomainLockedAt: true,
        emailSetupFeeCents: true,
        emailMonthlyFeeCents: true,
        employeeEmailSetupCents: true,
        employeeEmailMonthlyCents: true,
        customDomain: true,
        subdomain: true,
      },
    });

    if (!company) throw Errors.notFound("Child Company");

    // Employees can only view their own company's pricing
    if (req.user!.role === "EMPLOYEE" && company.ownerId !== req.user!.id) {
      throw Errors.forbidden("You can only view your own company's pricing");
    }

    // Calculate revenue split for employee emails
    const revenueSplit = childCompanyService.getEmployeeEmailRevenueSplit({
      employeeEmailSetupCents: (company as any).employeeEmailSetupCents || 1200,
      employeeEmailMonthlyCents: (company as any).employeeEmailMonthlyCents || 600,
    });

    // Get general pricing info
    const pricingInfo = childCompanyService.getEmailPricingInfo();

    res.json({
      success: true,
      data: {
        company,
        revenueSplit,
        pricingInfo,
      },
    });
  })
);

/**
 * PATCH /api/child-companies/:id/email-pricing — Update employee email pricing
 * Owner can customize but cannot go below MGR Capital base
 */
router.patch(
  "/:id/email-pricing",
  authMiddleware,
  roleGuard(["EMPLOYEE", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { employeeSetupFeeCents, employeeMonthlyFeeCents } = req.body;

    // Verify ownership (employee must own this company)
    const company = await prisma.childCompany.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!company) throw Errors.notFound("Child Company");

    if (req.user!.role === "EMPLOYEE" && company.ownerId !== req.user!.id) {
      throw Errors.forbidden("You can only update your own company's pricing");
    }

    const result = await childCompanyService.updateEmployeeEmailPricing(
      id,
      employeeSetupFeeCents,
      employeeMonthlyFeeCents
    );

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to update pricing");
    }

    res.json({ success: true, message: "Employee email pricing updated" });
  })
);

/**
 * GET /api/child-companies/:id/domain-change-eligibility — Check if domain can be changed
 */
router.get(
  "/:id/domain-change-eligibility",
  authMiddleware,
  roleGuard(["FOUNDER", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const company = await prisma.childCompany.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true },
    });

    if (!company) throw Errors.notFound("Child Company");

    // Employees can only check their own company
    if (req.user!.role === "EMPLOYEE" && company.ownerId !== req.user!.id) {
      throw Errors.forbidden("You can only check your own company");
    }

    const eligibility = await childCompanyService.canChangeDomain(req.params.id);

    res.json({ success: true, data: eligibility });
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

// ============================================
// CONTRACTOR FEE ROUTES
// Child companies can customize fees, MGR Capital takes 50%
// ============================================

/**
 * GET /api/child-companies/:id/contractor-fees — Get contractor fee configuration
 */
router.get(
  "/:id/contractor-fees",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN", "EMPLOYEE"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const company = await prisma.childCompany.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true },
    });

    if (!company) throw Errors.notFound("Child Company");

    // Employees can only view their own company's fees
    if (req.user!.role === "EMPLOYEE" && company.ownerId !== req.user!.id) {
      throw Errors.forbidden("You can only view your own company's fees");
    }

    const fees = await childCompanyService.getContractorFees(req.params.id);
    if (!fees) throw Errors.notFound("Child Company");

    // Include revenue split example
    const platformFee = typeof fees.fees.platform === "number" ? fees.fees.platform : 5000;
    const exampleSplit = childCompanyService.calculateContractorFeeSplit(platformFee);

    res.json({
      success: true,
      data: {
        ...fees,
        exampleSplit: {
          description: "Example: $50 platform fee",
          ...exampleSplit,
          formatted: {
            total: `$${(exampleSplit.total / 100).toFixed(2)}`,
            mgrCapital: `$${(exampleSplit.mgrCapitalShare / 100).toFixed(2)} (50%)`,
            childCompany: `$${(exampleSplit.childCompanyShare / 100).toFixed(2)} (50%)`,
          },
        },
      },
    });
  })
);

/**
 * PATCH /api/child-companies/:id/contractor-fees — Update contractor fees
 * Owner can customize but cannot go below minimums
 * MGR Capital always takes 50%
 */
router.patch(
  "/:id/contractor-fees",
  authMiddleware,
  roleGuard(["EMPLOYEE", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const {
      platformFeeCents,
      leadFeeCents,
      trainingFeeCents,
      marketingFeeCents,
      toolsFeeCents,
      supportFeeCents,
      customFeeCents,
      customFeeLabel,
    } = req.body;

    // Verify ownership
    const company = await prisma.childCompany.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!company) throw Errors.notFound("Child Company");

    if (req.user!.role === "EMPLOYEE" && company.ownerId !== req.user!.id) {
      throw Errors.forbidden("You can only update your own company's fees");
    }

    const result = await childCompanyService.updateContractorFees(id, {
      platformFeeCents,
      leadFeeCents,
      trainingFeeCents,
      marketingFeeCents,
      toolsFeeCents,
      supportFeeCents,
      customFeeCents,
      customFeeLabel,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to update fees");
    }

    res.json({ success: true, message: "Contractor fees updated" });
  })
);

export default router;
