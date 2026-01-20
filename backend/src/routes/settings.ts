// ============================================
// SETTINGS API ROUTES — MGR CAPITAL ASSISTANCE
// System settings and audit log access (FOUNDER ONLY)
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// AUDIT LOGS — FOUNDER ONLY
// ============================================

/**
 * GET /api/settings/audit-logs - Get audit logs
 */
router.get("/audit-logs", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const skip = (page - 1) * limit;

  // Filters
  const action = req.query.action as string;
  const entityType = req.query.entityType as string;
  const userId = req.query.userId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  const where: any = {};

  if (action) {
    where.action = action;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.auditLog.count({ where })
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

/**
 * GET /api/settings/audit-logs/summary - Get audit log summary stats
 */
router.get("/audit-logs/summary", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLogs,
    logsTodayCount,
    logsThisWeekCount,
    logsThisMonthCount,
    loginAttempts,
    failedLogins,
    topActions,
    topUsers
  ] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: thisWeek } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.auditLog.count({ where: { action: { startsWith: "LOGIN" } } }),
    prisma.auditLog.count({ where: { action: "LOGIN_FAILED" } }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 10
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5
    })
  ]);

  // Get user names for top users
  const userIds = topUsers.map(u => u.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true }
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  res.json({
    success: true,
    data: {
      totalLogs,
      logsToday: logsTodayCount,
      logsThisWeek: logsThisWeekCount,
      logsThisMonth: logsThisMonthCount,
      loginAttempts,
      failedLogins,
      topActions: topActions.map(a => ({
        action: a.action,
        count: a._count
      })),
      topUsers: topUsers.map(u => ({
        userId: u.userId,
        user: userMap.get(u.userId!),
        count: u._count
      }))
    }
  });
}));

/**
 * GET /api/settings/audit-logs/:id - Get single audit log
 */
router.get("/audit-logs/:id", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: Request, res: Response) => {
  const log = await prisma.auditLog.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });

  if (!log) {
    throw Errors.notFound("Audit log");
  }

  res.json({
    success: true,
    data: log
  });
}));

// ============================================
// SYSTEM CONFIGURATION — FOUNDER ONLY
// ============================================

/**
 * GET /api/settings/config - Get system configuration
 */
router.get("/config", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (_req: Request, res: Response) => {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: "asc" }
  });

  const configMap = configs.reduce((acc: any, c) => {
    acc[c.key] = c.value;
    return acc;
  }, {});

  res.json({
    success: true,
    data: configMap
  });
}));

/**
 * PATCH /api/settings/config - Update system configuration
 */
router.patch("/config", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const updates = req.body;

  if (!updates || typeof updates !== "object") {
    throw Errors.badRequest("Configuration updates required");
  }

  const results: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const result = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
        description: `Configuration for ${key}`
      }
    });
    results.push(result);
  }

  // Log configuration change
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "CONFIG_UPDATED",
      entityType: "SystemConfig",
      details: { updatedKeys: Object.keys(updates) }
    }
  });

  res.json({
    success: true,
    data: results
  });
}));

// ============================================
// SYSTEM HEALTH — FOUNDER ONLY
// ============================================

/**
 * GET /api/settings/health - System health check
 */
router.get("/health", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (_req: Request, res: Response) => {
  const [
    userCount,
    caseCount,
    employeeCount,
    pendingPayouts,
    recentErrors
  ] = await Promise.all([
    prisma.user.count(),
    prisma.case.count(),
    prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
    prisma.ledgerEntry.count({ where: { status: "PENDING" } }),
    prisma.auditLog.count({
      where: {
        action: { contains: "ERROR" },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      metrics: {
        totalUsers: userCount,
        totalCases: caseCount,
        activeEmployees: employeeCount,
        pendingPayouts,
        errorsLast24h: recentErrors
      },
      database: "connected",
      version: "1.0.0"
    }
  });
}));

export default router;
