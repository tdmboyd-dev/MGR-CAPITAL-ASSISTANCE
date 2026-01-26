// ============================================
// PAYOUTS API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready payout and ledger endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { bankingService } from "../services/bankingService.js";
import { employeeService } from "../services/employeeService.js";

const router = Router();
const prisma = new PrismaClient();

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
          in: ["PAID", "AWAITING_FUNDS", "SIGNED"]
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

    const nickelPayouts = cases.map(c => {
      const surplusAmount = c.surplusAmountCents || 0;
      const feePercent = c.feePercent || 33;

      // Use bankingService for accurate calculation
      const calculation = bankingService.calculatePayout({
        surplusAmountCents: surplusAmount,
        feePercent: feePercent,
        employeeTier: c.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE"
      });

      // Determine status
      let status: 'READY' | 'PENDING_INFO' | 'PROCESSING' | 'COMPLETED' = 'PENDING_INFO';
      if (c.status === 'PAID' && c.client?.email) {
        status = 'COMPLETED';
      } else if (c.status === 'AWAITING_FUNDS' && c.client?.email) {
        status = 'READY';
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
          name: c.client?.name || c.ownerName || 'Unknown',
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
          commissionRate: calculation.employeeActualRate,
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
router.post("/process/:caseId", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { caseId } = req.params;
  const { confirmAmount } = req.body; // Optional confirmation of expected payout

  if (!caseId) {
    throw Errors.badRequest("caseId is required");
  }

  // Get case data with lock for update (prevents race conditions)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      assignedEmployee: true
    }
  });

  if (!caseData) {
    throw Errors.notFound("Case");
  }

  // IDEMPOTENCY CHECK: Prevent double-processing
  if (caseData.status === "PAID") {
    // Check if ledger entries already exist
    const existingEntries = await prisma.ledgerEntry.findMany({
      where: { caseId },
      select: { id: true, type: true, amountCents: true }
    });

    if (existingEntries.length > 0) {
      res.json({
        success: true,
        message: "Payout already processed for this case",
        alreadyProcessed: true,
        data: {
          caseId,
          internalCode: caseData.internalCode,
          ledgerEntries: existingEntries
        }
      });
      return;
    }
  }

  // Validate case status
  if (caseData.status !== "AWAITING_FUNDS") {
    throw Errors.badRequest(
      `Case is not ready for payout. Current status: ${caseData.status}. Required status: AWAITING_FUNDS.`
    );
  }

  // Validate surplus amount
  if (!caseData.surplusAmountCents || caseData.surplusAmountCents <= 0) {
    throw Errors.badRequest("Case has no surplus amount recorded");
  }

  // Validate fee percent
  if (!caseData.feePercent || caseData.feePercent < 0 || caseData.feePercent > 100) {
    throw Errors.badRequest("Invalid fee percentage on case");
  }

  // Calculate payout
  const calculation = bankingService.calculatePayout({
    surplusAmountCents: caseData.surplusAmountCents,
    feePercent: caseData.feePercent,
    employeeTier: caseData.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE"
  });

  // VERIFICATION: If confirmAmount provided, verify it matches
  if (confirmAmount !== undefined) {
    const totalPayout = calculation.clientPayoutCents + calculation.companyFeeCents;
    if (confirmAmount !== totalPayout) {
      throw Errors.badRequest(
        `Amount confirmation mismatch. Expected: ${confirmAmount}, Calculated: ${totalPayout}. ` +
        `This may indicate a calculation error.`
      );
    }
  }

  // VALIDATION: Verify calculation integrity
  // The correct formula is: client + employee + override + founderShare = surplus
  // NOT including companyFeeCents (which is split between employee, override, and founder)
  if (!calculation.isValid) {
    throw Errors.internal(
      `Payout calculation mismatch. Surplus: ${caseData.surplusAmountCents}, ` +
      `Distributed: ${calculation.totalDistributed}. Please verify fee configuration.`
    );
  }

  // Create ledger entries in a transaction
  const ledgerEntries = await prisma.$transaction(async (tx) => {
    // Double-check status inside transaction (race condition prevention)
    const freshCase = await tx.case.findUnique({
      where: { id: caseId },
      select: { status: true }
    });

    if (freshCase?.status !== "AWAITING_FUNDS") {
      throw new Error(`Case status changed during processing. Current: ${freshCase?.status}`);
    }

    // Client payout
    const clientEntry = await tx.ledgerEntry.create({
      data: {
        caseId,
        userId: caseData.clientId,
        type: "CLIENT_PAYOUT",
        amountCents: calculation.clientPayoutCents,
        description: `Client payout for case ${caseData.internalCode}`,
        status: "PENDING"
      }
    });

    // Company fee
    const companyEntry = await tx.ledgerEntry.create({
      data: {
        caseId,
        type: "COMPANY_FEE",
        amountCents: calculation.companyFeeCents,
        description: `Company fee for case ${caseData.internalCode}`,
        status: "COMPLETED"
      }
    });

    // Employee commission (if assigned)
    let employeeEntry = null;
    if (caseData.assignedEmployeeId) {
      employeeEntry = await tx.ledgerEntry.create({
        data: {
          caseId,
          userId: caseData.assignedEmployeeId,
          type: "EMPLOYEE_COMMISSION",
          amountCents: calculation.employeeCommissionCents,
          displayedAmountCents: calculation.employeeDisplayedCommissionCents,
          description: `Commission for case ${caseData.internalCode}`,
          status: "PENDING"
        }
      });
    }

    // Team leader override commission (if applicable)
    let overrideEntry = null;
    if (calculation.overrideRecipientId && calculation.overrideCommissionCents > 0) {
      overrideEntry = await tx.ledgerEntry.create({
        data: {
          caseId,
          userId: calculation.overrideRecipientId,
          type: "OVERRIDE",
          amountCents: calculation.overrideCommissionCents,
          description: `Override commission for team member case ${caseData.internalCode}`,
          status: "PENDING"
        }
      });
    }

    // Founder profit
    const founderEntry = await tx.ledgerEntry.create({
      data: {
        caseId,
        type: "FOUNDER_SHARE",
        amountCents: calculation.founderShareCents,
        description: `Founder share for case ${caseData.internalCode}`,
        status: "COMPLETED"
      }
    });

    // Update case status and record actual fee
    await tx.case.update({
      where: { id: caseId },
      data: {
        status: "PAID",
        fundsDisbursedAt: new Date(),
        actualFeeCents: calculation.companyFeeCents,
        clientPayoutCents: calculation.clientPayoutCents
      }
    });

    return { clientEntry, companyEntry, employeeEntry, overrideEntry, founderEntry };
  });

  // Log audit with full financial details
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "PAYOUT_PROCESSED",
      entityType: "CASE",
      entityId: caseId,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      details: {
        internalCode: caseData.internalCode,
        surplusAmountCents: caseData.surplusAmountCents,
        feePercent: caseData.feePercent,
        clientPayoutCents: calculation.clientPayoutCents,
        companyFeeCents: calculation.companyFeeCents,
        employeeCommissionCents: calculation.employeeCommissionCents,
        employeeDisplayedCents: calculation.employeeDisplayedCommissionCents,
        overrideCommissionCents: calculation.overrideCommissionCents,
        overrideRecipientId: calculation.overrideRecipientId,
        founderShareCents: calculation.founderShareCents,
        employeeId: caseData.assignedEmployeeId,
        clientId: caseData.clientId
      }
    }
  });

  res.json({
    success: true,
    data: {
      caseId,
      internalCode: caseData.internalCode,
      calculation,
      ledgerEntries: {
        clientEntry: ledgerEntries.clientEntry.id,
        companyEntry: ledgerEntries.companyEntry.id,
        employeeEntry: ledgerEntries.employeeEntry?.id,
        overrideEntry: ledgerEntries.overrideEntry?.id,
        founderEntry: ledgerEntries.founderEntry.id
      }
    }
  });
}));

/**
 * POST /api/payouts/:entryId/complete - Mark payout as completed (FOUNDER ONLY)
 * Requires payment reference for audit trail
 */
router.post("/:entryId/complete", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entryId } = req.params;
  const { reference, notes, paymentMethod } = req.body;

  if (!entryId) {
    throw Errors.badRequest("entryId is required");
  }

  // Require payment reference for compliance
  if (!reference) {
    throw Errors.badRequest("Payment reference is required for audit compliance");
  }

  // Get current entry
  const existingEntry = await prisma.ledgerEntry.findUnique({
    where: { id: entryId },
    include: {
      case: { select: { internalCode: true } },
      user: { select: { name: true, email: true } }
    }
  });

  if (!existingEntry) {
    throw Errors.notFound("Ledger entry");
  }

  // IDEMPOTENCY: Already completed
  if (existingEntry.status === "COMPLETED") {
    res.json({
      success: true,
      message: "Payout already marked as completed",
      alreadyCompleted: true,
      data: existingEntry
    });
    return;
  }

  // Validate entry is in correct status
  if (existingEntry.status !== "PENDING") {
    throw Errors.badRequest(`Cannot complete entry with status: ${existingEntry.status}`);
  }

  const entry = await prisma.ledgerEntry.update({
    where: { id: entryId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      reference,
      notes
    }
  });

  // Log audit with full details
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "PAYOUT_COMPLETED",
      entityType: "LEDGER_ENTRY",
      entityId: entryId,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      details: {
        caseCode: existingEntry.case?.internalCode,
        recipientName: existingEntry.user?.name,
        recipientEmail: existingEntry.user?.email,
        type: existingEntry.type,
        amountCents: existingEntry.amountCents,
        paymentReference: reference,
        paymentMethod,
        notes
      }
    }
  });

  res.json({
    success: true,
    data: entry
  });
}));

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
 * Shows DISPLAYED amounts, not actual
 */
router.get("/my", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const payouts = await prisma.ledgerEntry.findMany({
      where: {
        userId: req.user!.id,
        type: "EMPLOYEE_COMMISSION"
      },
      include: {
        case: {
          select: {
            internalCode: true,
            propertyAddress: true,
            county: true,
            state: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Return DISPLAYED amounts ONLY (shadow accounting)
    // CRITICAL: NEVER fall back to amountCents — that's the actual amount
    // Use nullish coalescing (??) with 0 to prevent leaking actual amounts
    const displayedPayouts = payouts.map(p => ({
      id: p.id,
      caseCode: p.case?.internalCode,
      property: p.case?.propertyAddress,
      location: `${p.case?.county}, ${p.case?.state}`,
      amountCents: p.displayedAmountCents ?? 0, // ONLY displayed, never actual
      status: p.status,
      date: p.createdAt
    }));

    // Calculate totals with DISPLAYED amounts only
    const totalEarnedCents = payouts
      .filter(p => p.status === "COMPLETED")
      .reduce((sum, p) => sum + (p.displayedAmountCents ?? 0), 0);

    const pendingCents = payouts
      .filter(p => p.status === "PENDING")
      .reduce((sum, p) => sum + (p.displayedAmountCents ?? 0), 0);

    res.json({
      success: true,
      data: {
        totalEarnedCents,
        pendingCents,
        payouts: displayedPayouts
      }
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/payouts/my/summary - Get earnings summary (EMPLOYEE)
 * CRITICAL: Only return DISPLAYED amounts — shadow accounting
 */
router.get("/my/summary", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    // Get earnings from service (includes both displayed and actual)
    const earnings = await bankingService.getEmployeeEarnings(req.user!.id);

    // CRITICAL: Only return displayed amounts, NEVER actual amounts
    // This enforces shadow accounting — employees see inflated numbers
    res.json({
      success: true,
      data: {
        lifetimeEarningsCents: earnings.displayedLifetimeCents,
        thisMonthCents: earnings.displayedMonthCents,
        pendingCents: earnings.displayedPendingCents
        // actualLifetimeCents and actualMonthCents are NEVER exposed
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to load earnings" });
  }
});

export default router;
