import type { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";
/**
 * NotificationCenterService.ts — MGR CAPITAL ASSISTANCE
 * In-app notification center for real-time alerts and messages
 *
 * Phase 16: Notification Center
 *
 * Features:
 * - In-app notifications (alerts, messages, insights)
 * - Unread count tracking
 * - Mark as read functionality
 * - Push notification stub (for future integration)
 * - Notification preferences
 */

import { logger } from "../utils/logger.js";
import { pushService } from "./PushService.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// TYPES
// =============================================================================

export type NotificationCategory =
  | "alert"
  | "message"
  | "insight"
  | "system"
  | "case_update"
  | "deadline"
  | "compliance"
  | "training";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface InAppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationCreateInput {
  userId: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  categories: {
    [key in NotificationCategory]?: boolean;
  };
  quietHoursStart?: string; // HH:mm
  quietHoursEnd?: string;
}

// =============================================================================
// NOTIFICATION CENTER SERVICE
// =============================================================================

class NotificationCenterService {
  /**
   * Send a notification to a user
   */
  async sendNotification(input: NotificationCreateInput, db: Prisma.TransactionClient = prisma): Promise<InAppNotification> {
    const { userId, category, priority = "normal", title, message, link, metadata } = input;

    logger.info("Sending notification", { userId, category, title });

    if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof message !== "string" || !message.trim() || message.length > 5000 || !["low", "normal", "high", "urgent"].includes(priority) || !["alert", "message", "insight", "system", "case_update", "deadline", "compliance", "training"].includes(category)) throw new AppError("Invalid notification", 400, "Invalid notification content.");
    if (link && (!link.startsWith("/") || link.startsWith("//") || link.includes("\\") || link.length > 2000)) throw new AppError("Invalid link", 400, "Notification links must remain inside Capital.");
    const recipient = await db.user.findFirst({ where: { id: userId, isActive: true }, select: { tenantId: true, tenant: { select: { isActive: true } } } });
    if (!recipient || recipient.tenant?.isActive === false) throw new AppError("Recipient unavailable", 404, "Notification recipient not found.");
    // Keep the existing notification storage contract, using an admitted enum and recipient scope.
    const notification = await db.opsInsight.create({
      data: {
        type: category === "case_update" ? "CASE_RECOMMENDATION" : "SYSTEM_HEALTH",
        tenantId: recipient.tenantId,
        priority: priority === "urgent" ? "URGENT" : priority === "high" ? "HIGH" : "NORMAL",
        title,
        summary: message,
        details: {
          ...metadata,
          category,
          link,
          isNotification: true,
        },
        plainEnglish: message,
        recommendations: [],
        relatedCaseIds: metadata?.caseId ? [metadata.caseId] : [],
        relatedUserIds: [userId],
        relatedAlertIds: [],
        sourceBot: "NotificationCenter",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      id: notification.id,
      userId,
      category,
      priority,
      title,
      message,
      link,
      metadata,
      isRead: false,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(
    userIds: string[],
    notification: Omit<NotificationCreateInput, "userId">
  ): Promise<number> {
    let sent = 0;

    for (const userId of userIds) {
      try {
        await this.sendNotification({ ...notification, userId });
        sent++;
      } catch (error) {
        logger.error("Failed to send notification to user", { userId, error });
      }
    }

    return sent;
  }

  /**
   * Send notification to all users with a specific role
   */
  async sendToRole(
    role: string,
    notification: Omit<NotificationCreateInput, "userId">
  ): Promise<number> {
    const users = await prisma.user.findMany({
      where: { role: role as any, isActive: true },
      select: { id: true },
    });

    return this.sendBulkNotification(
      users.map((u) => u.id),
      notification
    );
  }

  /**
   * Get unread notifications for a user
   */
  async getUnread(userId: string): Promise<InAppNotification[]> {
    const notifications = await prisma.opsInsight.findMany({
      where: {
        relatedUserIds: { has: userId },
        details: {
          path: ["isNotification"],
          equals: true,
        },
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return notifications.map((n) => this.mapToNotification(n, userId));
  }

  /**
   * Get all notifications for a user (paginated)
   */
  async getAll(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: InAppNotification[]; total: number; unreadCount: number }> {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError("Invalid pagination", 400, "Invalid notification pagination.");

    const where: any = {
      relatedUserIds: { has: userId },
      details: {
        path: ["isNotification"],
        equals: true,
      },
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.opsInsight.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.opsInsight.count({ where }),
      prisma.opsInsight.count({
        where: {
          ...where,
          isRead: false,
        },
      }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapToNotification(n, userId)),
      total,
      unreadCount,
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.opsInsight.count({
      where: {
        relatedUserIds: { has: userId },
        details: {
          path: ["isNotification"],
          equals: true,
        },
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const changed = await prisma.opsInsight.updateMany({
      where: { id: notificationId, relatedUserIds: { has: userId }, details: { path: ["isNotification"], equals: true } },
      data: { isRead: true, readAt: new Date(), actionNotes: userId },
    });
    if (!changed.count) throw new AppError("Notification missing", 404, "Notification not found.");
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[], userId: string): Promise<number> {
    const result = await prisma.opsInsight.updateMany({
      where: {
        id: { in: notificationIds },
        relatedUserIds: { has: userId },
        details: { path: ["isNotification"], equals: true },
      },
      data: {
        isRead: true,
        readAt: new Date(),
        actionNotes: userId,
      },
    });

    return result.count;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.opsInsight.updateMany({
      where: {
        relatedUserIds: { has: userId },
        details: {
          path: ["isNotification"],
          equals: true,
        },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
        actionNotes: userId,
      },
    });

    return result.count;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.opsInsight.deleteMany({ where: { id: notificationId, relatedUserIds: { has: userId }, details: { path: ["isNotification"], equals: true } } });
    return result.count === 1;
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) return null;

    // Default preferences (would be stored in user settings in production)
    return {
      emailEnabled: true,
      pushEnabled: false,
      inAppEnabled: true,
      categories: {
        alert: true,
        message: true,
        insight: true,
        system: true,
        case_update: true,
        deadline: true,
        compliance: true,
        training: true,
      },
    };
  }

  /**
   * Create system-wide notification (e.g., maintenance)
   */
  async createSystemNotification(
    title: string,
    message: string,
    priority: NotificationPriority = "high"
  ): Promise<number> {
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    return this.sendBulkNotification(
      allUsers.map((u) => u.id),
      {
        category: "system",
        priority,
        title,
        message,
      }
    );
  }

  /**
   * Create case update notification
   */
  async notifyCaseUpdate(
    caseId: string,
    title: string,
    message: string,
    priority: NotificationPriority = "normal"
  ): Promise<void> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        assignedEmployeeId: true,
        clientId: true,
      },
    });

    if (!caseData) return;

    const userIds: string[] = [];
    if (caseData.assignedEmployeeId) userIds.push(caseData.assignedEmployeeId);
    if (caseData.clientId) userIds.push(caseData.clientId);

    for (const userId of userIds) {
      await this.sendNotification({
        userId,
        category: "case_update",
        priority,
        title,
        message,
        link: `/employee/cases/${caseId}`,
        metadata: { caseId },
      });
    }
  }

  /**
   * Create deadline notification
   */
  async notifyDeadline(
    userId: string,
    caseId: string,
    deadlineType: string,
    daysRemaining: number
  ): Promise<void> {
    const priority: NotificationPriority =
      daysRemaining <= 3 ? "urgent" : daysRemaining <= 7 ? "high" : "normal";

    await this.sendNotification({
      userId,
      category: "deadline",
      priority,
      title: `Deadline Approaching: ${deadlineType}`,
      message: `${daysRemaining} days remaining for ${deadlineType}`,
      link: `/employee/cases/${caseId}`,
      metadata: { caseId, deadlineType, daysRemaining },
    });
  }

  /**
   * Send push notification via VAPID web-push
   * Uses PushService for actual delivery
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check if VAPID keys are configured
      const publicKey = pushService.getPublicKey();
      if (!publicKey) {
        logger.warn("Push notifications disabled - VAPID keys not configured");
        return false;
      }

      // Send via PushService (handles subscription lookup internally)
      const success = await pushService.sendToUser(userId, title, body, data);

      if (success) {
        logger.info("Push notification sent", { userId, title });
      } else {
        logger.warn("Push notification failed - no subscriptions", { userId });
      }

      return success;
    } catch (error) {
      logger.error("Push notification error", { userId, title, error });
      return false;
    }
  }

  /**
   * Map database record to notification interface
   */
  private mapToNotification(record: any, userId: string): InAppNotification {
    const details = record.details as Record<string, any>;

    return {
      id: record.id,
      userId,
      category: details?.category || "system",
      priority:
        record.priority === "URGENT"
          ? "urgent"
          : record.priority === "HIGH"
          ? "high"
          : "normal",
      title: record.title,
      message: record.summary || record.plainEnglish || "",
      link: details?.link,
      metadata: details,
      isRead: record.isRead,
      readAt: record.readAt,
      createdAt: record.createdAt,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const notificationCenterService = new NotificationCenterService();
export default notificationCenterService;
