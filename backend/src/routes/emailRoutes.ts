// ============================================
// EMAIL ROUTES — MGR CAPITAL ASSISTANCE
// Founder Email Dashboard: delivery logs, stats, retry
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { notificationService } from "../services/NotificationService.js";
import { emailService } from "../services/EmailService.js";

const router = Router();

// ============================================
// GET /api/emails/status — Email system status
// ============================================

router.get(
  "/status",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const smtpAvailable = notificationService.isAvailable();
    const emailStatus = emailService.getStatus();

    const recentFailed = await prisma.notificationLog.count({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const recentSent = await prisma.notificationLog.count({
      where: {
        status: "SENT",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    res.json({
      success: true,
      data: {
        smtp: {
          available: smtpAvailable,
          ...emailStatus,
        },
        last24Hours: {
          sent: recentSent,
          failed: recentFailed,
        },
      },
    });
  })
);

// ============================================
// GET /api/emails/history — Notification history
// ============================================

router.get(
  "/history",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = "1",
      pageSize = "50",
      status,
      type,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize as string, 10)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { toAddress: { contains: search as string, mode: "insensitive" } },
        { subject: { contains: search as string, mode: "insensitive" } },
        { toName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSizeNum,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    });
  })
);

// ============================================
// GET /api/emails/stats — Email statistics
// ============================================

router.get(
  "/stats",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await notificationService.getNotificationStats(days);

    res.json({
      success: true,
      data: stats,
    });
  })
);

// ============================================
// POST /api/emails/:id/retry — Retry failed email
// ============================================

router.post(
  "/:id/retry",
  authMiddleware,
  roleGuard(["FOUNDER", "ADMIN"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = await notificationService.retryFailed(id);

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to retry notification");
    }

    res.json({
      success: true,
      data: { notificationId: result.notificationId },
      message: "Email retried successfully",
    });
  })
);

// ============================================
// POST /api/emails/retry-all-failed — Retry all failed emails (last 24h)
// ============================================

router.post(
  "/retry-all-failed",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const failedLogs = await prisma.notificationLog.findMany({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
      take: 100,
    });

    let retried = 0;
    let succeeded = 0;

    for (const log of failedLogs) {
      retried++;
      const result = await notificationService.retryFailed(log.id);
      if (result.success) succeeded++;
    }

    res.json({
      success: true,
      data: { retried, succeeded, failed: retried - succeeded },
      message: `Retried ${retried} emails, ${succeeded} succeeded`,
    });
  })
);

export default router;
