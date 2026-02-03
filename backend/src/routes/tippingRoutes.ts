/**
 * tippingRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for client tipping with shadow cut.
 * Employees see full tip amount but only receive half.
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { clientTippingService } from "../services/ClientTippingService.js";

const router = Router();

/**
 * GET /api/tips/options — Get tip amount options (for client UI)
 */
router.get(
  "/options",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const options = clientTippingService.getTipOptions();
    res.json({ success: true, data: options });
  })
);

/**
 * POST /api/tips — Submit a tip (client)
 */
router.post(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId, employeeId, amountCents, message } = req.body;

    if (!caseId || !employeeId || !amountCents) {
      throw Errors.badRequest("caseId, employeeId, and amountCents required");
    }

    const tip = await clientTippingService.processTip({
      caseId,
      clientId: req.user!.id,
      employeeId,
      amountCents,
      message,
    });

    // Return sanitized response (hide shadow accounting)
    res.json({
      success: true,
      data: {
        id: tip.id,
        amount: tip.clientPaidCents,
        message: "Thank you for your tip! Your agent will be notified.",
      },
    });
  })
);

/**
 * GET /api/tips/my-stats — Get employee's tip stats (shadow: sees displayed amounts)
 */
router.get(
  "/my-stats",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const isFounder = req.user?.role === "FOUNDER";
    const stats = await clientTippingService.getEmployeeTipStats(req.user!.id, isFounder);

    // Remove founder-only data for non-founders
    if (!isFounder) {
      delete stats._founderOnly;
    }

    res.json({ success: true, data: stats });
  })
);

/**
 * GET /api/tips/case/:caseId — Get tips for a case
 */
router.get(
  "/case/:caseId",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { caseId } = req.params;
    const isFounder = req.user?.role === "FOUNDER";

    const tips = await clientTippingService.getCaseTips(caseId);

    // Sanitize for non-founders
    const sanitized = tips.map(tip => ({
      id: tip.id,
      // Employees see displayed amount, founders see everything
      amount: isFounder ? tip.clientPaidCents : tip.displayedTipCents,
      message: tip.clientMessage,
      createdAt: tip.createdAt,
      status: tip.status,
      ...(isFounder ? {
        _shadow: {
          clientPaid: tip.clientPaidCents,
          employeeGets: tip.employeeReceivesCents,
          platformProfit: tip.platformProfitCents,
        },
      } : {}),
    }));

    res.json({ success: true, data: sanitized });
  })
);

/**
 * GET /api/tips/revenue — Get total tip revenue (FOUNDER ONLY)
 */
router.get(
  "/revenue",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;

    const revenue = await clientTippingService.getTipRevenue(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: {
        ...revenue,
        // Human readable
        totalClientPaid: `$${(revenue.totalClientPaid / 100).toFixed(2)}`,
        totalEmployeePaid: `$${(revenue.totalEmployeePaid / 100).toFixed(2)}`,
        totalPlatformProfit: `$${(revenue.totalPlatformProfit / 100).toFixed(2)}`,
        shadowNote: "Employees see full tip amount. They receive 50%, platform keeps 50%.",
      },
    });
  })
);

export default router;
