// ============================================
// MGR CAPITAL ASSISTANCE — MOBILE API ROUTES
// Optimized endpoints for mobile applications
// ============================================

import { Router, Response } from "express";
import { CaseStatus } from "@prisma/client";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { activityTrackingService, ActivityType } from "../services/ActivityTrackingService.js";
import { notificationCenterService } from "../services/NotificationCenterService.js";

import prisma from "../lib/prisma.js";

const router = Router();

// ============================================
// RESPONSE HELPERS
// ============================================

interface MobileResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta?: {
    serverTime: string;
    cacheControl: string;
  };
}

function mobileResponse<T>(res: Response, data: T, pagination?: MobileResponse<T>["pagination"], cacheSeconds = 60): void {
  // Set cache headers for mobile optimization
  res.set("Cache-Control", `private, max-age=${cacheSeconds}`);
  res.set("X-Content-Type-Options", "nosniff");

  const response: MobileResponse<T> = {
    success: true,
    data,
    meta: {
      serverTime: new Date().toISOString(),
      cacheControl: `max-age=${cacheSeconds}`,
    },
  };

  if (pagination) {
    response.pagination = pagination;
  }

  res.json(response);
}

function mobileError(res: Response, status: number, message: string, code?: string): void {
  res.status(status).json({
    success: false,
    error: message,
    code: code || "ERROR",
  });
}

// ============================================
// AUTHENTICATION - All routes require auth
// ============================================

router.use(authMiddleware);

// ============================================
// GET /api/mobile/dashboard
// Condensed dashboard for mobile home screen
// ============================================

router.get(
  "/dashboard",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Employee dashboard
    if (userRole === "EMPLOYEE") {
      const [
        caseCounts,
        urgentCases,
        recentActivity,
        unreadNotifications,
        activityStats,
      ] = await Promise.all([
        // Case counts by status
        prisma.case.groupBy({
          by: ["status"],
          where: { assignedEmployeeId: userId },
          _count: true,
        }),
        // Urgent cases (high priority or approaching deadline)
        prisma.case.findMany({
          where: {
            assignedEmployeeId: userId,
            status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
            OR: [
              { priority: { gte: 80 } },
              { filingDeadline: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
            ],
          },
          select: {
            id: true,
            internalCode: true,
            status: true,
            propertyAddress: true,
            county: true,
            state: true,
            filingDeadline: true,
          },
          orderBy: { filingDeadline: "asc" },
          take: 5,
        }),
        // Recent activity (last 7 days)
        prisma.auditLog.findMany({
          where: {
            userId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            entityType: "CASE",
          },
          select: {
            id: true,
            action: true,
            entityId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        // Unread notifications count
        notificationCenterService.getUnreadCount(userId),
        // Activity compliance stats
        activityTrackingService.getEmployeeStats(userId),
      ]);

      // Summarize case counts
      const counts = {
        total: 0,
        new: 0,
        contacted: 0,
        docsPending: 0,
        docsSigned: 0,
        filed: 0,
        awaitingFunds: 0,
        paid: 0,
      };

      caseCounts.forEach((c) => {
        counts.total += c._count;
        const statusKey = c.status.toLowerCase().replace(/_/g, "") as keyof typeof counts;
        if (statusKey === "new") counts.new = c._count;
        else if (c.status === "CONTACTED") counts.contacted = c._count;
        else if (c.status === "DOCS_PENDING") counts.docsPending = c._count;
        else if (c.status === "DOCS_SIGNED") counts.docsSigned = c._count;
        else if (c.status === "FILED") counts.filed = c._count;
        else if (c.status === "AWAITING_FUNDS") counts.awaitingFunds = c._count;
        else if (c.status === "PAID") counts.paid = c._count;
      });

      mobileResponse(res, {
        caseCounts: counts,
        urgentItems: urgentCases.map((c) => ({
          id: c.id,
          code: c.internalCode,
          status: c.status,
          address: c.propertyAddress,
          location: `${c.county}, ${c.state}`,
          deadline: c.filingDeadline,
        })),
        recentActivity: recentActivity.map((a) => ({
          id: a.id,
          action: a.action,
          caseId: a.entityId,
          timestamp: a.createdAt,
        })),
        notifications: {
          unread: unreadNotifications,
        },
        compliance: {
          activeDaysThisWeek: activityStats.activeDaysThisWeek,
          activeDaysRequired: activityStats.activeDaysRequired,
          isCompliant: activityStats.isCompliant,
          weeklyStatus: activityStats.isCompliant
            ? "On track"
            : `Need ${activityStats.activeDaysRequired - activityStats.activeDaysThisWeek} more active days`,
        },
      }, undefined, 30); // 30 second cache for dashboard
    } else if (userRole === "CLIENT") {
      // Client dashboard - their cases
      const cases = await prisma.case.findMany({
        where: { clientId: userId },
        select: {
          id: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
        },
      });

      mobileResponse(res, {
        caseCounts: {
          total: cases.length,
          active: cases.filter((c) => !["PAID", "CLOSED", "REJECTED"].includes(c.status)).length,
          completed: cases.filter((c) => c.status === "PAID").length,
        },
        cases: cases.map((c) => ({
          id: c.id,
          status: getClientFriendlyStatus(c.status as CaseStatus),
          address: c.propertyAddress,
          location: `${c.county}, ${c.state}`,
        })),
      }, undefined, 60);
    } else {
      // Admin/Founder dashboard - summary stats
      const [totalCases, activeCases, activeEmployees, casesThisWeek] = await Promise.all([
        prisma.case.count(),
        prisma.case.count({
          where: { status: { notIn: ["PAID", "CLOSED", "REJECTED"] } },
        }),
        prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
        prisma.case.count({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        }),
      ]);

      mobileResponse(res, {
        stats: {
          totalCases,
          activeCases,
          activeEmployees,
          casesThisWeek,
        },
      }, undefined, 60);
    }
  })
);

// ============================================
// GET /api/mobile/cases
// Paginated case list with minimal fields
// ============================================

router.get(
  "/cases",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const status = req.query.status as CaseStatus | undefined;
    const search = req.query.search as string | undefined;

    // Build where clause based on role
    const where: any = {};

    if (userRole === "EMPLOYEE") {
      where.assignedEmployeeId = userId;
    } else if (userRole === "CLIENT") {
      where.clientId = userId;
    }
    // ADMIN/FOUNDER see all cases

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { internalCode: { contains: search, mode: "insensitive" } },
        { propertyAddress: { contains: search, mode: "insensitive" } },
        { county: { contains: search, mode: "insensitive" } },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        select: {
          id: true,
          internalCode: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
          filingDeadline: true,
          updatedAt: true,
          client: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.case.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    mobileResponse(
      res,
      cases.map((c) => ({
        id: c.id,
        code: c.internalCode,
        status: userRole === "CLIENT" ? getClientFriendlyStatus(c.status as CaseStatus) : c.status,
        address: c.propertyAddress,
        location: `${c.county}, ${c.state}`,
        clientName: c.client?.name || null,
        deadline: c.filingDeadline,
        updatedAt: c.updatedAt,
      })),
      {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      120 // 2 minute cache for case list
    );
  })
);

// ============================================
// GET /api/mobile/cases/:id
// Single case with essential data
// ============================================

router.get(
  "/cases/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Build where clause for access control
    const where: any = { id };

    if (userRole === "EMPLOYEE") {
      where.assignedEmployeeId = userId;
    } else if (userRole === "CLIENT") {
      where.clientId = userId;
    }

    const caseData = await prisma.case.findFirst({
      where,
      select: {
        id: true,
        internalCode: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        parcelNumber: true,
        saleDate: true,
        redemptionDeadline: true,
        filingDeadline: true,
        contactedAt: true,
        docsSignedAt: true,
        filedAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        assignedEmployee: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            communications: true,
            documents: true,
          },
        },
      },
    });

    if (!caseData) {
      throw Errors.notFound("Case");
    }

    // Format response based on role
    const responseData: any = {
      id: caseData.id,
      code: caseData.internalCode,
      status: userRole === "CLIENT" ? getClientFriendlyStatus(caseData.status as CaseStatus) : caseData.status,
      property: {
        address: caseData.propertyAddress,
        county: caseData.county,
        state: caseData.state,
        parcel: caseData.parcelNumber,
      },
      dates: {
        saleDate: caseData.saleDate,
        redemptionDeadline: caseData.redemptionDeadline,
        filingDeadline: caseData.filingDeadline,
        contacted: caseData.contactedAt,
        docsSigned: caseData.docsSignedAt,
        filed: caseData.filedAt,
      },
      counts: {
        communications: caseData._count.communications,
        documents: caseData._count.documents,
      },
      updatedAt: caseData.updatedAt,
    };

    // Add client info for employees/admin
    if (userRole !== "CLIENT" && caseData.client) {
      responseData.client = {
        id: caseData.client.id,
        name: caseData.client.name,
        phone: caseData.client.phone,
        email: caseData.client.email,
      };
    }

    // Add employee info for admin/founder
    if (["ADMIN", "FOUNDER"].includes(userRole) && caseData.assignedEmployee) {
      responseData.assignedEmployee = {
        id: caseData.assignedEmployee.id,
        name: caseData.assignedEmployee.name,
      };
    }

    // Add documents with minimal info
    responseData.documents = caseData.documents.map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      signed: !!d.signedAt,
    }));

    mobileResponse(res, responseData, undefined, 60);
  })
);

// ============================================
// POST /api/mobile/activity/log
// Quick activity logging (check-ins)
// ============================================

router.post(
  "/activity/log",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { activityType, caseId, details } = req.body;

    // Validate activity type
    const validTypes: ActivityType[] = [
      "login",
      "case_view",
      "case_note",
      "case_document",
      "case_call",
      "client_message",
      "training",
      "notary_session",
    ];

    if (!activityType) {
      throw Errors.badRequest("activityType is required");
    }

    if (!validTypes.includes(activityType)) {
      throw Errors.badRequest(`Invalid activityType. Must be one of: ${validTypes.join(", ")}`);
    }

    const activity = await activityTrackingService.logActivity({
      employeeId: userId,
      activityType,
      caseId,
      details: details ? JSON.stringify(details) : undefined,
    });

    // No cache for POST responses
    res.set("Cache-Control", "no-store");

    res.json({
      success: true,
      data: {
        id: activity.id,
        type: activity.activityType,
        timestamp: activity.timestamp,
      },
    });
  })
);

// ============================================
// GET /api/mobile/notifications
// Unread count + recent notifications
// ============================================

router.get(
  "/notifications",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    const [unreadCount, notifications] = await Promise.all([
      notificationCenterService.getUnreadCount(userId),
      notificationCenterService.getAll(userId, { page: 1, limit, unreadOnly: false }),
    ]);

    mobileResponse(
      res,
      {
        unreadCount,
        notifications: notifications.notifications.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          category: n.category,
          priority: n.priority,
          read: n.read,
          link: n.link,
          createdAt: n.createdAt,
        })),
      },
      undefined,
      15 // 15 second cache for notifications
    );
  })
);

// ============================================
// POST /api/mobile/cases/:id/note
// Quick note add to a case
// ============================================

router.post(
  "/cases/:id/note",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { content, type = "PORTAL_MESSAGE" } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw Errors.badRequest("Note content is required");
    }

    if (content.length > 5000) {
      throw Errors.badRequest("Note content must be less than 5000 characters");
    }

    // Verify access to case
    const where: any = { id };
    if (userRole === "EMPLOYEE") {
      where.assignedEmployeeId = userId;
    } else if (userRole === "CLIENT") {
      where.clientId = userId;
    }

    const caseData = await prisma.case.findFirst({
      where,
      select: { id: true, internalCode: true },
    });

    if (!caseData) {
      throw Errors.notFound("Case");
    }

    // Create communication record
    const communication = await prisma.communication.create({
      data: {
        caseId: id,
        userId,
        type: type as any,
        direction: "OUTBOUND",
        content: content.trim(),
        subject: `Mobile note - ${new Date().toLocaleDateString()}`,
      },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
      },
    });

    // Log activity
    await activityTrackingService.logActivity({
      employeeId: userId,
      activityType: "case_note",
      caseId: id,
      details: JSON.stringify({ noteId: communication.id }),
    });

    // No cache for POST
    res.set("Cache-Control", "no-store");

    res.json({
      success: true,
      data: {
        id: communication.id,
        type: communication.type,
        content: communication.content,
        createdAt: communication.createdAt,
      },
    });
  })
);

// ============================================
// GET /api/mobile/priority-list
// Today's priority cases for employee
// ============================================

router.get(
  "/priority-list",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== "EMPLOYEE") {
      throw Errors.forbidden("Priority list is only available for employees");
    }

    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Get priority cases with different criteria
    const [urgentDeadlines, highPriority, staleCases, newCases] = await Promise.all([
      // Cases with deadline in next 7 days
      prisma.case.findMany({
        where: {
          assignedEmployeeId: userId,
          status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
          filingDeadline: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
        select: {
          id: true,
          internalCode: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
          filingDeadline: true,
          client: { select: { name: true } },
        },
        orderBy: { filingDeadline: "asc" },
        take: 5,
      }),
      // High priority cases
      prisma.case.findMany({
        where: {
          assignedEmployeeId: userId,
          status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
          priority: { gte: 80 },
        },
        select: {
          id: true,
          internalCode: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
          priority: true,
          client: { select: { name: true } },
        },
        orderBy: { priority: "desc" },
        take: 5,
      }),
      // Stale cases (no activity in 2+ days)
      prisma.case.findMany({
        where: {
          assignedEmployeeId: userId,
          status: { notIn: ["PAID", "CLOSED", "REJECTED", "AWAITING_FUNDS"] },
          updatedAt: { lte: twoDaysAgo },
        },
        select: {
          id: true,
          internalCode: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
          updatedAt: true,
          client: { select: { name: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
      // New cases (need initial contact)
      prisma.case.findMany({
        where: {
          assignedEmployeeId: userId,
          status: "NEW",
        },
        select: {
          id: true,
          internalCode: true,
          status: true,
          propertyAddress: true,
          county: true,
          state: true,
          createdAt: true,
          client: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
    ]);

    // Format and deduplicate
    const formatCase = (c: any, reason: string) => ({
      id: c.id,
      code: c.internalCode,
      status: c.status,
      address: c.propertyAddress,
      location: `${c.county}, ${c.state}`,
      clientName: c.client?.name || null,
      clientPhone: c.client?.phone || null,
      deadline: c.filingDeadline || null,
      priority: c.priority || null,
      lastUpdated: c.updatedAt || null,
      reason,
    });

    // Build priority list with reasons
    const priorityList: any[] = [];
    const seenIds = new Set<string>();

    // Add urgent deadlines first
    urgentDeadlines.forEach((c) => {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        priorityList.push(formatCase(c, "Deadline approaching"));
      }
    });

    // Add high priority
    highPriority.forEach((c) => {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        priorityList.push(formatCase(c, "High priority"));
      }
    });

    // Add new cases
    newCases.forEach((c) => {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        priorityList.push(formatCase(c, "Needs initial contact"));
      }
    });

    // Add stale cases
    staleCases.forEach((c) => {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        priorityList.push(formatCase(c, "No recent activity"));
      }
    });

    mobileResponse(
      res,
      {
        date: today.toISOString().split("T")[0],
        totalPriority: priorityList.length,
        cases: priorityList.slice(0, 15), // Max 15 priority items
        summary: {
          urgentDeadlines: urgentDeadlines.length,
          highPriority: highPriority.length,
          newCases: newCases.length,
          staleCases: staleCases.length,
        },
      },
      undefined,
      60 // 1 minute cache
    );
  })
);

// ============================================
// HELPER FUNCTIONS
// ============================================

function getClientFriendlyStatus(status: CaseStatus): string {
  const statusMap: Record<CaseStatus, string> = {
    NEW: "Getting Started",
    CONTACTED: "In Progress",
    DOCS_PENDING: "Documents Needed",
    DOCS_SIGNED: "Processing",
    FILED: "Filed",
    AWAITING_FUNDS: "Almost There",
    PAID: "Complete",
    CLOSED: "Closed",
    REJECTED: "Under Review",
  };

  return statusMap[status] || "In Progress";
}

export default router;
