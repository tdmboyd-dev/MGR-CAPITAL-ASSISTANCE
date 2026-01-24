// ============================================
// MGR CAPITAL ASSISTANCE — NOTIFICATION ROUTES
// Phase 16: Notification Center
// ============================================

import express, { Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { notificationCenterService } from "../services/NotificationCenterService.js";

const router = express.Router();

// ============================================
// SSE (Server-Sent Events) for Real-time Updates
// ============================================

/**
 * GET /api/notifications/events
 * Real-time notification stream via SSE
 * Query: token (for auth since SSE doesn't support headers easily)
 */
router.get("/events", async (req, res, next) => {
  try {
    // Get token from query param (SSE workaround)
    const token = req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: "Token required" });
    }

    // Verify token manually (since we can't use middleware with SSE easily)
    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || "dev-secret") as any;
    const userId = decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Send initial unread count
    const initialUnread = await notificationCenterService.getUnread(userId);
    res.write(`data: ${JSON.stringify({ type: "unread_count", count: initialUnread.length })}\n\n`);

    // Send initial notifications list
    res.write(`data: ${JSON.stringify({ type: "notifications_list", notifications: initialUnread.slice(0, 10) })}\n\n`);

    // Poll for updates (in production, use Redis pub/sub)
    const interval = setInterval(async () => {
      try {
        const unread = await notificationCenterService.getUnread(userId);
        res.write(`data: ${JSON.stringify({ type: "unread_count", count: unread.length })}\n\n`);
      } catch (err) {
        console.error("SSE poll error:", err);
      }
    }, 15000); // Every 15 seconds

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(":heartbeat\n\n");
    }, 30000);

    // Cleanup on close
    req.on("close", () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    });
  } catch (error: any) {
    console.error("SSE connection error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// All other notification routes require authentication
router.use(authenticate);

// ============================================
// USER NOTIFICATIONS
// ============================================

/**
 * GET /api/notifications
 * Get all notifications for current user
 * Query: page, limit, unreadOnly
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    const result = await notificationCenterService.getAll(userId, {
      page,
      limit,
      unreadOnly,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notifications for current user
 */
router.get("/unread", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const notifications = await notificationCenterService.getUnread(userId);
    res.json({ notifications, count: notifications.length });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/count
 * Get unread notification count
 */
router.get("/count", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const count = await notificationCenterService.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    await notificationCenterService.markAsRead(id, userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/mark-read
 * Mark multiple notifications as read
 * Body: { ids: string[] } or {} to mark all as read
 */
router.patch("/mark-read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { ids } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    let count: number;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      count = await notificationCenterService.markMultipleAsRead(ids, userId);
    } else {
      count = await notificationCenterService.markAllAsRead(userId);
    }

    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const deleted = await notificationCenterService.deleteNotification(id, userId);
    res.json({ success: deleted });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN NOTIFICATIONS (FOUNDER/ADMIN only)
// ============================================

/**
 * POST /api/notifications/send
 * Send a notification to specific users
 * Body: { userIds: string[], title, message, category, priority, link }
 */
router.post(
  "/send",
  authorize(["FOUNDER", "ADMIN"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds, title, message, category, priority, link, metadata } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds array required" });
      }

      if (!title || !message) {
        return res.status(400).json({ error: "title and message required" });
      }

      const count = await notificationCenterService.sendBulkNotification(userIds, {
        category: category || "message",
        priority: priority || "normal",
        title,
        message,
        link,
        metadata,
      });

      res.json({ success: true, sent: count });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/notifications/send-to-role
 * Send notification to all users with a specific role
 * Body: { role, title, message, category, priority, link }
 */
router.post(
  "/send-to-role",
  authorize(["FOUNDER", "ADMIN"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, title, message, category, priority, link, metadata } = req.body;

      if (!role) {
        return res.status(400).json({ error: "role required" });
      }

      if (!title || !message) {
        return res.status(400).json({ error: "title and message required" });
      }

      const count = await notificationCenterService.sendToRole(role, {
        category: category || "message",
        priority: priority || "normal",
        title,
        message,
        link,
        metadata,
      });

      res.json({ success: true, sent: count });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/notifications/system
 * Send system-wide notification
 * Body: { title, message, priority }
 */
router.post(
  "/system",
  authorize(["FOUNDER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, message, priority } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: "title and message required" });
      }

      const count = await notificationCenterService.createSystemNotification(
        title,
        message,
        priority || "high"
      );

      res.json({ success: true, sent: count });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
