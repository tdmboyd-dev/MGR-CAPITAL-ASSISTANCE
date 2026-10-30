// ============================================
// PAYOUTS API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready payout and ledger endpoints
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { bankingService } from "../services/BankingService.js";
import { employeeService } from "../services/EmployeeService.js";

import { getOwnEmployeeEarnings,employeeEarningsSummary } from "../services/EmployeeEarningsView.js";
const router = Router();
// Global finance queries are not tenant scoped. Own employee views retain their existing boundary.
router.use(authMiddleware, async (req: AuthRequest, res, next) => {
  res.setHeader('Cache-Control','private, no-store');
  if (req.path === "/my" || req.path === "/my/summary") {
    try { const {currentActor}=await import('../services/CaseDocumentAccess.js');const actor=await currentActor(prisma,req.user!.id);if(!['EMPLOYEE','TEAM_LEAD','FOUNDER'].includes(actor.role))return res.status(403).json({success:false,error:'Own earnings access required'});req.user={...req.user!,role:actor.role};return next(); }catch {return res.status(403).json({success:false,error:'Account unavailable'});}
  }
  try {
    const { currentActor } = await import("../services/CaseDocumentAccess.js");
    const actor = await currentActor(prisma, req.user!.id);
    if (actor.role !== "FOUNDER" || actor.tenantId !== null) return res.status(403).json({ error: "Global founder financial access required" });
    next();
  } catch { res.status(503).json({ error: "Financial authority unavailable" }); }
});

// ============================================
// VALIDATION HELPERS
// ============================================

function validateAmountCents(amount: any, fieldName: string): number {
  if (amount === undefined || amount === null) {
    throw Errors.badRequest(`${fieldName} is required`);
  }

  const numAmount = Number(amount);

  if (!Number.isInteger(numAmount) || numAmount < 0) {
    throw Errors.badRequest(`${fieldName} must be a non-negative integer (cents)`);
  }

  // Sanity check: no payout should exceed $10 million
  const MAX_PAYOUT_CENTS = 1000000000; // $10,000,000
  if (numAmount > MAX_PAYOUT_CENTS) {
    throw Errors.badRequest(`${fieldName} exceeds maximum allowed amount`);
  }

  return numAmount;
}

// ============================================
// FOUNDER/ADMIN ROUTES — Full Access
// ============================================

/**
 * GET /api/payouts - List all payouts (FOUNDER ONLY)
 */
router.get("/", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { status, from, to, limit } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const payouts = await prisma.ledgerEntry.findMany({
      where: {
        ...where,
        type: { in: ["CLIENT_PAYOUT", "EMPLOYEE_COMMISSION", "COMPANY_FEE"] }
      },
      include: {
        case: {
          select: {
            internalCode: true,
            propertyAddress: true,
            client: { select: { name: true } }
          }
        },
        user: {
          select: { name: true, email: true, employeeTier: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string) || 100
    });

    // Calculate totals
    const totals = await prisma.ledgerEntry.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amountCents: true }
    });

    res.json({
      success: true,
      count: payouts.length,
      totalPaidCents: totals._sum.amountCents || 0,
      data: payouts
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/payouts/nickel - Get payouts formatted for Nickel (FOUNDER ONLY)
 * Returns FULL payout breakdown: Client, Employee, and Founder shares
 * Ready to copy/paste into Nickel dashboard for ACH transfers
 */
router.get("/nickel", authMiddleware, roleGuard(["ADMIN", "FOUNDER"]), async (_req: Request, res: Response) => {
  try {
    // Get cases ready for payout with employee info
    const cases = await prisma.case.findMany({
      where: {
        status: {
          in: ["PAID", "AWAITING_FUNDS", "DOCS_SIGNED"]
        }
      },
      include: {
        client: true,
        assignedEmployee: true
      },
      orderBy: { updatedAt: "desc" }
    });

    // Get founder info for founder payouts
    const founder = await prisma.user.findFirst({
      where: { email: process.env.FOUNDER_EMAIL || "admin@capitalmgr.com" }
    });

    const nickelPayouts = cases.map((c: any) => {
      const surplusAmount = c.surplusAmountCents || 0;
      const feePercent = c.feePercent;

      // Use bankingService for accurate calculation
      const calculation = bankingService.calculatePayout({
        surplusAmountCents: surplusAmount,
        feePercent: feePercent,
        employeeTier: c.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE"
      });

      // Determine status
      let status: 'READY' | 'PENDING_INFO' | 'PROCESSING' | 'COMPLETED' = 'PENDING_INFO';
      if (c.status === 'PAID' && c.client?.email) {
        status = 'PENDING_INFO';
      } else if (c.status === 'AWAITING_FUNDS' && c.client?.email) {
        status = 'PENDING_INFO';
      }

      // Get banking info from metadata
      const metadata = c.metadata as any || {};

      return {
        id: c.id,
        caseCode: c.internalCode || c.id.substring(0, 8).toUpperCase(),
        caseStatus: c.status,
        county: c.county || '',
        state: c.state || '',
        createdAt: c.createdAt.toISOString(),
        status,

        // Financial summary
        surplusAmountCents: surplusAmount,
        feePercent,
        companyFeeCents: calculation.companyFeeCents,

        // CLIENT PAYOUT (70% of surplus to client)
        client: {
          name: c.client?.name || 'Unknown',
          email: c.client?.email || '',
          phone: c.client?.phone || '',
          bankName: metadata.clientBankName || metadata.bankName,
          routingNumber: metadata.clientRoutingNumber || metadata.routingNumber,
          accountNumber: metadata.clientAccountNumber || metadata.accountNumber,
          payoutCents: calculation.clientPayoutCents,
        },

        // EMPLOYEE COMMISSION (actual %, not displayed)
        employee: c.assignedEmployee ? {
          id: c.assignedEmployee.id,
          name: c.assignedEmployee.name || 'Employee',
          email: c.assignedEmployee.email || '',
          phone: c.assignedEmployee.phone || '',
          tier: c.assignedEmployee.employeeTier,
          bankName: metadata.employeeBankName,
          routingNumber: metadata.employeeRoutingNumber,
          accountNumber: metadata.employeeAccountNumber,
          commissionCents: calculation.employeeCommissionCents,
          commissionRate: (calculation as any).employeeActualRate,
        } : null,

        // FOUNDER SHARE (remainder after employee commission)
        founder: {
          name: founder?.name || 'Founder',
          email: founder?.email || process.env.FOUNDER_EMAIL || 'admin@capitalmgr.com',
          phone: founder?.phone || '',
          bankName: metadata.founderBankName,
          routingNumber: metadata.founderRoutingNumber,
          accountNumber: metadata.founderAccountNumber,
          shareCents: calculation.founderShareCents,
        },

        // Team leader override (if applicable)
        override: calculation.overrideCommissionCents > 0 ? {
          recipientId: calculation.overrideRecipientId,
          commissionCents: calculation.overrideCommissionCents,
        } : null,
      };
    });

    res.json(nickelPayouts);
  } catch (error: any) {
    console.error("Nickel payouts error:", error);
    res.status(500).json({ error: "Failed to get payouts" });
  }
});

/**
 * GET /api/payouts/pending - Get pending payouts (FOUNDER ONLY)
 */
router.get("/pending", authMiddleware, roleGuard(["ADMIN", "FOUNDER"]), async (_req: Request, res: Response) => {
  try {
    // Get cases ready for payout
    const casesReadyForPayout = await prisma.case.findMany({
      where: {
        status: "AWAITING_FUNDS",
        fundsReceivedAt: { not: null }
      },
      include: {
        client: { select: { name: true, email: true } },
        assignedEmployee: { select: { id: true, name: true, employeeTier: true } }
      }
    });

    const pendingPayouts = casesReadyForPayout.map(caseData => {
      const calculation = bankingService.calculatePayout({
        surplusAmountCents: caseData.surplusAmountCents,
        feePercent: caseData.feePercent,
        employeeTier: caseData.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE"
      });

      return {
        caseId: caseData.id,
        internalCode: caseData.internalCode,
        client: caseData.client,
        employee: caseData.assignedEmployee,
        surplusAmountCents: caseData.surplusAmountCents,
        calculation
      };
    });

    res.json({
      success: true,
      count: pendingPayouts.length,
      data: pendingPayouts
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/payouts/calculate - Calculate payout preview (FOUNDER ONLY)
 */
router.post("/calculate", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { surplusAmountCents, feePercent, employeeTier } = req.body;

    if (!surplusAmountCents || surplusAmountCents <= 0) {
      return res.status(400).json({ success: false, error: "Valid surplus amount required" });
    }

    const calculation = bankingService.calculatePayout({
      surplusAmountCents,
      feePercent: feePercent || 33,
      employeeTier: employeeTier || "TIER_1_ASSOCIATE"
    });

    res.json({
      success: true,
      data: calculation
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/payouts/process/:caseId - Process payout for a case (FOUNDER ONLY)
 * Includes idempotency checks to prevent double-processing
 */
router.post("/process/:caseId", authMiddleware, roleGuard(["FOUNDER"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { planCasePayout } = await import("../services/PayoutPlanningService.js");
  const plan = await planCasePayout(req.user!.id, req.params.caseId, req.body.confirmAmount);
  res.json({ success: true, message: "Pending allocation saved. No funds submitted; case remains awaiting funds.", data: plan });
}));

/**
 * POST /api/payouts/:entryId/complete - Mark payout as completed (FOUNDER ONLY)
 * Requires payment reference for audit trail
 */
router.post("/:entryId/complete", authMiddleware, roleGuard(["FOUNDER"]), (_req, res) => {
  res.status(503).json({ success: false, error: "Settlement reconciliation is unavailable. A typed reference alone cannot certify a payout." });
});

/**
 * GET /api/payouts/ledger - Full ledger view (FOUNDER ONLY)
 */
router.get("/ledger", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { from, to, type, limit, offset } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: {
          case: { select: { internalCode: true } },
          user: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string) || 100,
        skip: parseInt(offset as string) || 0
      }),
      prisma.ledgerEntry.count({ where })
    ]);

    // Get summary by type
    const summary = await prisma.ledgerEntry.groupBy({
      by: ["type", "status"],
      _sum: { amountCents: true },
      _count: true
    });

    res.json({
      success: true,
      total,
      count: entries.length,
      summary: summary.map(s => ({
        type: s.type,
        status: s.status,
        totalCents: s._sum.amountCents,
        count: s._count
      })),
      data: entries
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/payouts/anomalies - Check for anomalies (FOUNDER ONLY)
 */
router.get("/anomalies", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const anomalies = await bankingService.detectAnomalies();

    res.json({
      success: true,
      count: anomalies.length,
      data: anomalies
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

// ============================================
// EMPLOYEE ROUTES — Shadow Accounting
// ============================================

/**
 * GET /api/payouts/my - Get own payouts (EMPLOYEE)
 * Shows the current account's actual payable allocation; no bank settlement is inferred.
 */
router.get("/my", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const view=await getOwnEmployeeEarnings(req.user!.id);
    res.json({success:true,data:{...employeeEarningsSummary(view),totalEarnedCents:view.recordedCompletedCents,payouts:view.rows.map(row=>({id:row.id,caseCode:row.case.internalCode,property:row.case.propertyAddress,location:`${row.case.county}, ${row.case.state}`,amountCents:row.payableAmountCents,status:row.reconciliationRequired?'RECONCILIATION_REQUIRED':row.status,date:row.createdAt,reconciliationRequired:row.reconciliationRequired,legacyDisplayAdjusted:row.legacyDisplayAdjusted}))}});
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/payouts/my/summary - Get earnings summary (EMPLOYEE)
 * Actual payable amounts; internal company margins are excluded.
 */
router.get("/my/summary", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const view=await getOwnEmployeeEarnings(req.user!.id);
    res.json({success:true,data:employeeEarningsSummary(view)});
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to load earnings" });
  }
});

export default router;
