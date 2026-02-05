// ============================================
// EMAIL HOSTING ROUTES — MGR CAPITAL ASSISTANCE
// User: create/manage email accounts
// Founder: manage domains, billing, free email pool
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { emailProvisioningBot } from "../services/EmailProvisioningBot.js";
import { modoboaService } from "../services/ModoboaService.js";

const router = Router();

// ============================================
// USER ROUTES
// ============================================

/**
 * GET /api/email-hosting/check — Check email availability
 */
router.get(
  "/check",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = req.query;
    if (!email) throw Errors.badRequest("Email address required");

    const result = await emailProvisioningBot.checkAvailability(email as string);
    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/email-hosting/accounts — Create email account
 */
router.post(
  "/accounts",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { emailAddress, displayName, domain } = req.body;

    if (!emailAddress || !displayName || !domain) {
      throw Errors.badRequest("emailAddress, displayName, and domain required");
    }

    const result = await emailProvisioningBot.provisionAccount({
      userId: req.user!.id,
      emailAddress,
      displayName,
      domainName: domain,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to create email account");
    }

    res.status(201).json({
      success: true,
      data: {
        accountId: result.emailAccountId,
        credentials: result.credentials,
        dnsRecords: result.dnsRecords,
      },
    });
  })
);

/**
 * GET /api/email-hosting/accounts — List my email accounts
 */
router.get(
  "/accounts",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accounts = await prisma.emailAccount.findMany({
      where: {
        userId: req.user!.id,
        status: { not: "DELETED" },
      },
      include: {
        domain: { select: { domain: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: accounts });
  })
);

/**
 * POST /api/email-hosting/accounts/:id/reset-password — Reset mailbox password
 */
router.post(
  "/accounts/:id/reset-password",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const account = await prisma.emailAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!account) throw Errors.notFound("Email account");

    const result = await emailProvisioningBot.resetPassword(req.params.id);
    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to reset password");
    }

    res.json({ success: true, data: { newPassword: result.newPassword } });
  })
);

/**
 * POST /api/email-hosting/accounts/:id/delete — Request deletion (10-day grace)
 */
router.post(
  "/accounts/:id/delete",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const account = await prisma.emailAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!account) throw Errors.notFound("Email account");

    const result = await emailProvisioningBot.requestDeletion(req.params.id);
    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to request deletion");
    }

    res.json({
      success: true,
      data: { deletionDate: result.deletionDate },
      message: "Account will be deleted in 10 days. You can cancel during this period.",
    });
  })
);

/**
 * POST /api/email-hosting/accounts/:id/cancel-delete — Cancel deletion
 */
router.post(
  "/accounts/:id/cancel-delete",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const account = await prisma.emailAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!account) throw Errors.notFound("Email account");

    const result = await emailProvisioningBot.cancelDeletion(req.params.id);
    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to cancel deletion");
    }

    res.json({ success: true, message: "Deletion cancelled. Account is active again." });
  })
);

// ============================================
// FOUNDER ROUTES
// ============================================

/**
 * GET /api/email-hosting/domains — List all domains (FOUNDER)
 */
router.get(
  "/domains",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const domains = await prisma.emailDomain.findMany({
      include: { accounts: { select: { id: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: domains });
  })
);

/**
 * POST /api/email-hosting/domains/:id/verify — Verify domain DNS (FOUNDER)
 */
router.post(
  "/domains/:id/verify",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const domain = await prisma.emailDomain.findUnique({
      where: { id: req.params.id },
    });
    if (!domain) throw Errors.notFound("Domain");

    const result = await modoboaService.verifyDomain(domain.domain);

    // Update DNS verification status
    if (result.success && result.data) {
      await prisma.emailDomain.update({
        where: { id: req.params.id },
        data: {
          mxVerified: result.data.mx || false,
          spfVerified: result.data.spf || false,
          dkimVerified: result.data.dkim || false,
          dmarcVerified: result.data.dmarc || false,
          lastDnsCheck: new Date(),
          status: result.data.mx && result.data.spf ? "DNS_VERIFIED" : "PENDING_DNS",
        },
      });
    }

    res.json({ success: true, data: result.data });
  })
);

/**
 * GET /api/email-hosting/all-accounts — List all accounts (FOUNDER)
 */
router.get(
  "/all-accounts",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = "1", pageSize = "50", status } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const pageSizeNum = Math.min(100, parseInt(pageSize as string, 10));

    const where: any = {};
    if (status) where.status = status;

    const [accounts, total] = await Promise.all([
      prisma.emailAccount.findMany({
        where,
        include: {
          domain: { select: { domain: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.emailAccount.count({ where }),
    ]);

    res.json({
      success: true,
      data: accounts,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSizeNum),
    });
  })
);

/**
 * GET /api/email-hosting/billing-summary — Billing summary (FOUNDER)
 */
router.get(
  "/billing-summary",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const [totalAccounts, activeAccounts, freeAccounts, totalMonthly, totalSetup] = await Promise.all([
      prisma.emailAccount.count({ where: { status: { not: "DELETED" } } }),
      prisma.emailAccount.count({ where: { status: "ACTIVE" } }),
      prisma.emailAccount.count({ where: { isFree: true, status: "ACTIVE" } }),
      prisma.emailAccount.aggregate({
        where: { billingActive: true },
        _sum: { monthlyFeeCents: true },
      }),
      prisma.emailAccount.aggregate({
        where: { status: { not: "DELETED" } },
        _sum: { setupFeeCents: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalAccounts,
        activeAccounts,
        freeAccounts,
        paidAccounts: activeAccounts - freeAccounts,
        monthlyRevenueCents: totalMonthly._sum.monthlyFeeCents || 0,
        totalSetupFeesCents: totalSetup._sum.setupFeeCents || 0,
      },
    });
  })
);

/**
 * POST /api/email-hosting/founder-pool — Create free founder email (FOUNDER)
 */
router.post(
  "/founder-pool",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { emailAddress, displayName, domain, assignToUserId } = req.body;

    if (!emailAddress || !displayName || !domain) {
      throw Errors.badRequest("emailAddress, displayName, and domain required");
    }

    const result = await emailProvisioningBot.provisionAccount({
      userId: assignToUserId || req.user!.id,
      emailAddress,
      displayName,
      domainName: domain,
      isFree: true,
      assignedByFounder: true,
      monthlyFeeCents: 0,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to create email");
    }

    res.status(201).json({
      success: true,
      data: {
        accountId: result.emailAccountId,
        credentials: result.credentials,
      },
    });
  })
);

export default router;
