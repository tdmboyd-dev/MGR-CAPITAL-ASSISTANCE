// ============================================
// PAYOUTS API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready payout and ledger endpoints
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { bankingService } from "../services/bankingService.js";
import { employeeService } from "../services/employeeService.js";

const router = Router();
const prisma = new PrismaClient();

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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payouts/pending - Get pending payouts (FOUNDER ONLY)
 */
router.get("/pending", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
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
    res.status(500).json({ success: false, error: error.message });
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
      feePercent: feePercent || 30,
      employeeTier: employeeTier || "TIER_1_ASSOCIATE"
    });

    res.json({
      success: true,
      data: calculation
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payouts/process/:caseId - Process payout for a case (FOUNDER ONLY)
 */
router.post("/process/:caseId", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    // Get case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: true
      }
    });

    if (!caseData) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    if (caseData.status !== "AWAITING_FUNDS") {
      return res.status(400).json({
        success: false,
        error: "Case is not ready for payout. Status must be AWAITING_FUNDS."
      });
    }

    // Calculate payout
    const calculation = bankingService.calculatePayout({
      surplusAmountCents: caseData.surplusAmountCents,
      feePercent: caseData.feePercent,
      employeeTier: caseData.assignedEmployee?.employeeTier || "TIER_1_ASSOCIATE"
    });

    // Create ledger entries
    const ledgerEntries = await prisma.$transaction(async (tx) => {
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

      // Update case status
      await tx.case.update({
        where: { id: caseId },
        data: {
          status: "PAID",
          fundsDisbursedAt: new Date()
        }
      });

      return { clientEntry, companyEntry, employeeEntry, founderEntry };
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "PAYOUT_PROCESSED",
        entityType: "CASE",
        entityId: caseId,
        details: {
          clientPayout: calculation.clientPayoutCents,
          companyFee: calculation.companyFeeCents,
          employeeCommission: calculation.employeeCommissionCents,
          founderShare: calculation.founderShareCents
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
          founderEntry: ledgerEntries.founderEntry.id
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payouts/:entryId/complete - Mark payout as completed (FOUNDER ONLY)
 */
router.post("/:entryId/complete", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const { reference, notes } = req.body;

    const entry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        reference,
        notes
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "PAYOUT_COMPLETED",
        entityType: "LEDGER_ENTRY",
        entityId: entryId,
        details: { reference, notes }
      }
    });

    res.json({
      success: true,
      data: entry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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

    // Return DISPLAYED amounts (shadow accounting)
    const displayedPayouts = payouts.map(p => ({
      id: p.id,
      caseCode: p.case?.internalCode,
      property: p.case?.propertyAddress,
      location: `${p.case?.county}, ${p.case?.state}`,
      amountCents: p.displayedAmountCents || p.amountCents, // Show displayed, not actual
      status: p.status,
      date: p.createdAt
    }));

    // Calculate totals with displayed amounts
    const totalEarnedCents = payouts
      .filter(p => p.status === "COMPLETED")
      .reduce((sum, p) => sum + (p.displayedAmountCents || p.amountCents), 0);

    const pendingCents = payouts
      .filter(p => p.status === "PENDING")
      .reduce((sum, p) => sum + (p.displayedAmountCents || p.amountCents), 0);

    res.json({
      success: true,
      data: {
        totalEarnedCents,
        pendingCents,
        payouts: displayedPayouts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payouts/my/summary - Get earnings summary (EMPLOYEE)
 */
router.get("/my/summary", authMiddleware, roleGuard(["EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    // Get displayed earnings from employee service
    const earnings = await bankingService.getEmployeeEarnings(req.user!.id);

    res.json({
      success: true,
      data: earnings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
