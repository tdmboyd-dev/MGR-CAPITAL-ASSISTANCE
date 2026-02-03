// ============================================
// EMAIL INBOX ROUTES — MGR CAPITAL ASSISTANCE
// Full mailbox access: list, read, send, reply, forward
// Role-based access control:
//   - FOUNDER: access all mailboxes (admin@, support@, noreply@, etc.)
//   - EMPLOYEE: access only their own professional email mailbox
//   - CLIENT: read-only access to their case-related notifications
// ============================================

import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard, ROLE_GROUPS } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { emailInboxService } from "../services/EmailInboxService.js";

const router = Router();
const prisma = new PrismaClient();

// System mailbox IDs mapped to actual email addresses
const SYSTEM_MAILBOXES = {
  admin: process.env.MODOBOA_ADMIN_EMAIL || "admin@capitalmgr.com",
  support: process.env.MODOBOA_SUPPORT_EMAIL || "support@capitalmgr.com",
  noreply: process.env.MODOBOA_NOREPLY_EMAIL || "noreply@capitalmgr.com",
};

// Default mailbox ID for founder (primary mailbox = admin@)
const DEFAULT_MAILBOX_ID = "admin";

/**
 * Get the mailbox ID for the current user based on their role
 * - FOUNDER: uses admin@ mailbox by default, can access any
 * - EMPLOYEE: uses their own professional email mailbox
 * - CLIENT: uses a filtered view of support@ emails related to their cases
 */
async function getUserMailboxId(user: AuthRequest["user"]): Promise<string> {
  if (!user) return DEFAULT_MAILBOX_ID;

  const role = user.role;

  // Founder gets the admin mailbox
  if (role === "FOUNDER" || role === "ADMIN") {
    return "admin";
  }

  // Employees get their professional email mailbox
  if (role === "EMPLOYEE" || role === "HR" || role === "COMPLIANCE" || role === "TEAM_LEAD") {
    // Look up their professional email
    const professionalEmail = await prisma.professionalEmail.findFirst({
      where: {
        userId: user.userId,
        status: "active",
      },
    });
    if (professionalEmail) {
      return professionalEmail.id;
    }
    // No professional email yet - return a placeholder
    return `user:${user.userId}`;
  }

  // Clients get a filtered view
  if (role === "CLIENT") {
    return `client:${user.userId}`;
  }

  return DEFAULT_MAILBOX_ID;
}

/**
 * Check if user can access a specific mailbox
 */
async function canAccessMailbox(user: AuthRequest["user"], mailboxId: string): Promise<boolean> {
  if (!user) return false;

  const role = user.role;

  // Founder can access everything
  if (role === "FOUNDER" || role === "ADMIN") {
    return true;
  }

  // Employee can only access their own mailbox
  if (role === "EMPLOYEE" || role === "HR" || role === "COMPLIANCE" || role === "TEAM_LEAD") {
    // Check if this is their professional email
    const professionalEmail = await prisma.professionalEmail.findFirst({
      where: {
        userId: user.userId,
        status: "active",
      },
    });
    return professionalEmail?.id === mailboxId;
  }

  // Clients can only access their client inbox
  if (role === "CLIENT") {
    return mailboxId === `client:${user.userId}`;
  }

  return false;
}

// ============================================
// SIMPLIFIED ROUTES (for /api/inbox frontend compatibility)
// Auto-detects user's mailbox based on role
// ============================================

/**
 * GET /api/inbox/folders/counts — Get folder unread counts
 * Returns counts for the current user's mailbox
 */
router.get(
  "/folders/counts",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const folders = await emailInboxService.listFolders(mailboxId);
    const counts = folders.map(f => ({
      folder: f.name.toLowerCase(),
      total: f.totalCount,
      unread: f.unreadCount,
    }));
    res.json({ success: true, data: counts });
  })
);

/**
 * GET /api/inbox/emails — List emails in folder
 * Query: folder, page, pageSize, search
 * Returns emails for the current user's mailbox
 */
router.get(
  "/emails",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const { folder = "inbox", page = "1", pageSize = "20", search } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string, 10)));

    let result;
    if (search && (search as string).trim()) {
      result = await emailInboxService.searchEmails(mailboxId, {
        query: search as string,
        folder: folder as string,
      });
    } else {
      result = await emailInboxService.listEmails(mailboxId, folder as string, pageNum, limit);
    }

    // Transform to frontend expected format
    const emails = result.items.map(e => ({
      id: e.id,
      from: e.from.address,
      fromName: e.from.name,
      to: e.to[0]?.address || "",
      toName: e.to[0]?.name,
      subject: e.subject,
      body: e.body?.text || e.preview,
      bodyHtml: e.body?.html,
      folder: folder,
      isRead: e.isRead,
      isStarred: e.isFlagged,
      hasAttachments: e.attachments.length > 0,
      attachments: e.attachments.map(a => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        mimeType: a.contentType,
      })),
      createdAt: e.date,
    }));

    res.json({
      success: true,
      data: emails,
      pagination: {
        page: result.page,
        pageSize: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  })
);

/**
 * GET /api/inbox/emails/:id — Get single email
 */
router.get(
  "/emails/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const { id } = req.params;
    const email = await emailInboxService.getEmail(mailboxId, id);

    if (!email) {
      throw Errors.notFound("Email");
    }

    res.json({
      success: true,
      data: {
        id: email.id,
        from: email.from.address,
        fromName: email.from.name,
        to: email.to[0]?.address || "",
        toName: email.to[0]?.name,
        cc: email.cc?.map(c => c.address).join(", "),
        subject: email.subject,
        body: email.body?.text || email.preview,
        bodyHtml: email.body?.html,
        folder: email.folderId,
        isRead: email.isRead,
        isStarred: email.isFlagged,
        hasAttachments: email.attachments.length > 0,
        attachments: email.attachments.map(a => ({
          id: a.id,
          filename: a.filename,
          size: a.size,
          mimeType: a.contentType,
        })),
        createdAt: email.date,
      },
    });
  })
);

/**
 * PATCH /api/inbox/emails/:id — Update email (isRead, isStarred, folder)
 */
router.patch(
  "/emails/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const { id } = req.params;
    const { isRead, isStarred, folder } = req.body;

    if (isRead !== undefined) {
      if (isRead) {
        await emailInboxService.markAsRead(mailboxId, id);
      } else {
        await emailInboxService.markAsUnread(mailboxId, id);
      }
    }

    if (folder !== undefined) {
      await emailInboxService.moveToFolder(mailboxId, id, folder);
    }

    // Note: isStarred/flagged would need to be added to the service
    // For now, we just acknowledge the request

    res.json({ success: true, message: "Email updated" });
  })
);

/**
 * DELETE /api/inbox/emails/:id — Delete email permanently
 */
router.delete(
  "/emails/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const { id } = req.params;
    await emailInboxService.deleteEmail(mailboxId, id);
    res.json({ success: true, message: "Email deleted" });
  })
);

/**
 * POST /api/inbox/emails/send — Send email
 * Supports multipart/form-data with attachments
 * From address is determined by user's role:
 *   - FOUNDER: uses admin@capitalmgr.com
 *   - EMPLOYEE: uses their professional email or child company email
 */
router.post(
  "/emails/send",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { to, cc, bcc, subject, body, bodyHtml, from: requestedFrom } = req.body;
    const user = req.user!;

    if (!to || !subject || !body) {
      throw Errors.badRequest("to, subject, and body are required");
    }

    // Determine the from address based on user's role and mailbox
    let fromAddress: string;

    if (user.role === "FOUNDER" || user.role === "ADMIN") {
      // Founder can use any system mailbox or a requested from address
      fromAddress = requestedFrom || SYSTEM_MAILBOXES.admin;
    } else {
      // Employees use their professional email
      const professionalEmail = await prisma.professionalEmail.findFirst({
        where: {
          userId: user.userId,
          status: "active",
        },
      });
      if (professionalEmail) {
        fromAddress = professionalEmail.emailAddress;
      } else {
        throw Errors.badRequest("No professional email account found. Please set up your email first.");
      }
    }

    const result = await emailInboxService.sendEmail({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      subject,
      body,
      html: bodyHtml,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to send email");
    }

    res.status(201).json({
      success: true,
      data: { messageId: result.messageId },
      message: "Email sent successfully",
    });
  })
);

/**
 * POST /api/inbox/emails/draft — Save draft
 */
router.post(
  "/emails/draft",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // For now, just acknowledge - draft saving would need DB storage
    res.status(201).json({
      success: true,
      data: { draftId: `draft_${Date.now()}` },
      message: "Draft saved",
    });
  })
);

/**
 * GET /api/inbox/attachments/:id — Download attachment
 */
router.get(
  "/attachments/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxId = await getUserMailboxId(req.user);
    const { id } = req.params;
    const { emailId } = req.query;

    if (!emailId) {
      throw Errors.badRequest("emailId query parameter required");
    }

    const result = await emailInboxService.getAttachment(mailboxId, emailId as string, id);

    if (!result.success || !result.data) {
      throw Errors.notFound("Attachment");
    }

    res.setHeader("Content-Type", result.data.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.data.filename}"`);
    res.send(result.data.content);
  })
);

// ============================================
// MAILBOX LISTING (FOUNDER ONLY)
// ============================================

/**
 * GET /api/email/mailboxes — List all mailboxes
 * FOUNDER: can see all mailboxes
 */
router.get(
  "/mailboxes",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mailboxes = await emailInboxService.listMailboxes();
    res.json({ success: true, data: mailboxes });
  })
);

// ============================================
// FOLDER LISTING
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/folders — List folders in a mailbox
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.get(
  "/mailboxes/:mailboxId/folders",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const folders = await emailInboxService.listFolders(mailboxId);
    res.json({ success: true, data: folders });
  })
);

// ============================================
// EMAIL LISTING (PAGINATED)
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/folders/:folder/emails — List emails in a folder
 * Query params: ?page=1&limit=20
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.get(
  "/mailboxes/:mailboxId/folders/:folder/emails",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, folder } = req.params;
    const { page = "1", limit = "20" } = req.query;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

    const result = await emailInboxService.listEmails(mailboxId, folder, pageNum, limitNum);
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
        hasMore: result.hasMore,
      },
    });
  })
);

// ============================================
// SINGLE EMAIL
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/emails/:emailId — Get single email
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.get(
  "/mailboxes/:mailboxId/emails/:emailId",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const email = await emailInboxService.getEmail(mailboxId, emailId);
    if (!email) {
      throw Errors.notFound("Email");
    }

    res.json({ success: true, data: email });
  })
);

// ============================================
// MARK AS READ/UNREAD
// ============================================

/**
 * PATCH /api/email/mailboxes/:mailboxId/emails/:emailId/read — Mark as read
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.patch(
  "/mailboxes/:mailboxId/emails/:emailId/read",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    await emailInboxService.markAsRead(mailboxId, emailId);
    res.json({ success: true, message: "Email marked as read" });
  })
);

/**
 * PATCH /api/email/mailboxes/:mailboxId/emails/:emailId/unread — Mark as unread
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.patch(
  "/mailboxes/:mailboxId/emails/:emailId/unread",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    await emailInboxService.markAsUnread(mailboxId, emailId);
    res.json({ success: true, message: "Email marked as unread" });
  })
);

// ============================================
// MOVE EMAIL TO FOLDER
// ============================================

/**
 * PATCH /api/email/mailboxes/:mailboxId/emails/:emailId/move — Move to folder
 * Body: { folder: string }
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.patch(
  "/mailboxes/:mailboxId/emails/:emailId/move",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const { folder } = req.body;
    const user = req.user!;

    if (!folder) {
      throw Errors.badRequest("Target folder is required");
    }

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    await emailInboxService.moveToFolder(mailboxId, emailId, folder);
    res.json({ success: true, message: `Email moved to ${folder}` });
  })
);

// ============================================
// DELETE EMAIL (MOVE TO TRASH)
// ============================================

/**
 * DELETE /api/email/mailboxes/:mailboxId/emails/:emailId — Delete email (move to trash)
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.delete(
  "/mailboxes/:mailboxId/emails/:emailId",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    await emailInboxService.deleteEmail(mailboxId, emailId);
    res.json({ success: true, message: "Email moved to trash" });
  })
);

// ============================================
// SEARCH EMAILS
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/search — Search emails
 * Query params: ?q=query&page=1&limit=20
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.get(
  "/mailboxes/:mailboxId/search",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId } = req.params;
    const { q, page = "1", limit = "20" } = req.query;
    const user = req.user!;

    if (!q || (q as string).trim().length === 0) {
      throw Errors.badRequest("Search query is required");
    }

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

    const result = await emailInboxService.searchEmails(mailboxId, {
      query: q as string,
    });
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
        hasMore: result.hasMore,
      },
    });
  })
);

// ============================================
// UNREAD COUNT
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/unread-count — Get unread count
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.get(
  "/mailboxes/:mailboxId/unread-count",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId } = req.params;
    const user = req.user!;

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const unreadCount = await emailInboxService.getUnreadCount(mailboxId);
    res.json({ success: true, data: { unreadCount } });
  })
);

// ============================================
// SEND EMAIL
// ============================================

/**
 * POST /api/email/send — Send a new email
 * Body: { from, to, subject, body, attachments? }
 * Access: User must have access to the "from" mailbox
 */
router.post(
  "/send",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { from, to, subject, body, attachments } = req.body;
    const user = req.user!;

    if (!from || !to || !subject || !body) {
      throw Errors.badRequest("from, to, subject, and body are required");
    }

    // Validate "to" field - can be string or array
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0) {
      throw Errors.badRequest("At least one recipient is required");
    }

    // FOUNDER can send from any address, others need to be verified
    if (user.role !== "ADMIN") {
      throw Errors.forbidden();
    }

    const result = await emailInboxService.sendEmail({
      from,
      to: recipients,
      subject,
      body,
      attachments: attachments || [],
    });

    res.status(201).json({
      success: true,
      data: { messageId: result.messageId },
      message: "Email sent successfully",
    });
  })
);

// ============================================
// REPLY TO EMAIL
// ============================================

/**
 * POST /api/email/mailboxes/:mailboxId/emails/:emailId/reply — Reply to email
 * Body: { body, attachments? }
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.post(
  "/mailboxes/:mailboxId/emails/:emailId/reply",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const { body, attachments } = req.body;
    const user = req.user!;

    if (!body) {
      throw Errors.badRequest("Reply body is required");
    }

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const result = await emailInboxService.replyToEmail(
      mailboxId,
      emailId,
      body,
      undefined, // html
      attachments || []
    );

    res.status(201).json({
      success: true,
      data: { messageId: result.messageId },
      message: "Reply sent successfully",
    });
  })
);

// ============================================
// FORWARD EMAIL
// ============================================

/**
 * POST /api/email/mailboxes/:mailboxId/emails/:emailId/forward — Forward email
 * Body: { to, body?, attachments? }
 * Access: FOUNDER (all), ADMIN (assigned), EMPLOYEE (own)
 */
router.post(
  "/mailboxes/:mailboxId/emails/:emailId/forward",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, emailId } = req.params;
    const { to, body, attachments } = req.body;
    const user = req.user!;

    if (!to) {
      throw Errors.badRequest("Forward recipient (to) is required");
    }

    // Validate "to" field - can be string or array
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0) {
      throw Errors.badRequest("At least one recipient is required");
    }

    // Check access
    const hasAccess = await emailInboxService.checkMailboxAccess(mailboxId, user.id, user.role);
    if (!hasAccess) {
      throw Errors.forbidden();
    }

    const result = await emailInboxService.forwardEmail(
      mailboxId,
      emailId,
      recipients,
      body || undefined
    );

    res.status(201).json({
      success: true,
      data: { messageId: result.messageId },
      message: "Email forwarded successfully",
    });
  })
);

// ============================================
// AUTO-FORWARDING RULES (FOUNDER ONLY)
// ============================================

/**
 * GET /api/email/mailboxes/:mailboxId/forwarding — List forwarding rules
 * Access: FOUNDER only (can approve/assign forwarding)
 */
router.get(
  "/mailboxes/:mailboxId/forwarding",
  authMiddleware,
  roleGuard(["ADMIN"]), // ADMIN = FOUNDER role
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId } = req.params;
    const result = await emailInboxService.listForwardingRules(mailboxId);
    res.json({ success: true, data: result.rules });
  })
);

/**
 * POST /api/email/mailboxes/:mailboxId/forwarding — Create forwarding rule
 * Body: { forwardTo, keepCopy?, filterSubject?, filterFrom?, enabled? }
 * Access: FOUNDER only
 */
router.post(
  "/mailboxes/:mailboxId/forwarding",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId } = req.params;
    const { forwardTo, keepCopy, filterSubject, filterFrom, enabled } = req.body;

    if (!forwardTo) {
      throw Errors.badRequest("forwardTo email address is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forwardTo)) {
      throw Errors.badRequest("Invalid forwardTo email address format");
    }

    const result = await emailInboxService.setForwardingRule(mailboxId, forwardTo, {
      keepCopy,
      filterSubject,
      filterFrom,
      enabled,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to create forwarding rule");
    }

    res.status(201).json({
      success: true,
      data: { ruleId: result.ruleId },
      message: "Forwarding rule created successfully",
    });
  })
);

/**
 * PATCH /api/email/mailboxes/:mailboxId/forwarding/:ruleId — Update forwarding rule
 * Body: { forwardTo?, keepCopy?, filterSubject?, filterFrom?, enabled? }
 * Access: FOUNDER only
 */
router.patch(
  "/mailboxes/:mailboxId/forwarding/:ruleId",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, ruleId } = req.params;
    const { forwardTo, keepCopy, filterSubject, filterFrom, enabled } = req.body;

    // Validate email format if provided
    if (forwardTo) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(forwardTo)) {
        throw Errors.badRequest("Invalid forwardTo email address format");
      }
    }

    const result = await emailInboxService.updateForwardingRule(mailboxId, ruleId, {
      forwardTo,
      keepCopy,
      filterSubject,
      filterFrom,
      enabled,
    });

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to update forwarding rule");
    }

    res.json({
      success: true,
      message: "Forwarding rule updated successfully",
    });
  })
);

/**
 * DELETE /api/email/mailboxes/:mailboxId/forwarding/:ruleId — Delete forwarding rule
 * Access: FOUNDER only
 */
router.delete(
  "/mailboxes/:mailboxId/forwarding/:ruleId",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mailboxId, ruleId } = req.params;

    const result = await emailInboxService.deleteForwardingRule(mailboxId, ruleId);

    if (!result.success) {
      throw Errors.badRequest(result.error || "Failed to delete forwarding rule");
    }

    res.json({
      success: true,
      message: "Forwarding rule deleted successfully",
    });
  })
);

// ============================================
// SERVICE STATUS
// ============================================

/**
 * GET /api/email/status — Get email service status (connection health)
 * Access: FOUNDER, ADMIN
 */
router.get(
  "/status",
  authMiddleware,
  roleGuard(ROLE_GROUPS.ADMINS),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = await emailInboxService.getStatus();
    res.json({ success: true, data: status });
  })
);

export default router;
