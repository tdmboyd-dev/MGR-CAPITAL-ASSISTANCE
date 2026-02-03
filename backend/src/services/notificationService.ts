// ============================================
// NOTIFICATION SERVICE — MGR CAPITAL ASSISTANCE
// Sovereign email notification engine using SMTP
// No SaaS lock-in (no Twilio, SendGrid, etc.)
// Bot personas with real names instead of noreply@
// ============================================

import { PrismaClient, NotificationType, NotificationStatus } from "@prisma/client";
import * as nodemailer from "nodemailer";
import { BOT_PERSONAS, getBotPersona, getBotIdForEmailType, type BotPersona } from "../config/botPersonas.js";

const prisma = new PrismaClient();

// SMTP Configuration from environment
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Company email configuration — Purpose-specific mailboxes
// admin@capitalmgr.com    — Founder inbox, domain admin, platform management
// support@capitalmgr.com  — Client communications, case updates, support tickets
// noreply@capitalmgr.com  — Bot alerts, system notifications, automated emails

const MAILBOXES = {
  admin: {
    email: process.env.MODOBOA_ADMIN_EMAIL || "admin@capitalmgr.com",
    name: "MGR Capital Admin",
    password: process.env.MODOBOA_ADMIN_PASS,
  },
  support: {
    email: process.env.MODOBOA_SUPPORT_EMAIL || "support@capitalmgr.com",
    name: "MGR Capital Support",
    password: process.env.MODOBOA_SUPPORT_PASS,
  },
  noreply: {
    email: process.env.MODOBOA_NOREPLY_EMAIL || "noreply@capitalmgr.com",
    name: "MGR Capital",
    password: process.env.MODOBOA_NOREPLY_PASS,
  },
};

// Default FROM for different email types
const FROM_EMAIL = MAILBOXES.noreply.email;
const FROM_NAME = MAILBOXES.noreply.name;
const SUPPORT_EMAIL = MAILBOXES.support.email;
const ADMIN_EMAIL = MAILBOXES.admin.email;
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || MAILBOXES.admin.email;

// ============================================
// BOT PERSONA FORMATTING
// ============================================

/**
 * Format bot sender with real name and title
 * Example: "Marcus Reed, Outreach Coordinator <noreply@capitalmgr.com>"
 */
function formatBotSender(botId: string, mailboxKey: EmailSender = "noreply"): { name: string; email: string } {
  const bot = getBotPersona(botId);
  const mailbox = MAILBOXES[mailboxKey];
  return {
    name: `${bot.name}, ${bot.title}`,
    email: mailbox.email,
  };
}

// Create transporter
let transporter: nodemailer.Transporter | null = null;

// Email sender type for routing to correct mailbox
type EmailSender = "admin" | "support" | "noreply";

interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  html?: string;
  caseId?: string;
  userId?: string;
  sender?: EmailSender; // Which mailbox to send from
  botId?: string;       // Which bot persona to use (e.g., "outreach", "compliance")
  emailType?: string;   // Email type for auto-selecting bot (e.g., "welcome", "case_assigned")
}

interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

class NotificationService {
  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the SMTP transporter
   */
  async initialize(): Promise<boolean> {
    try {
      if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
        console.warn("[Notification] SMTP credentials not configured. Email notifications disabled.");
        return false;
      }

      transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: SMTP_CONFIG.auth,
      });

      // Verify connection
      await transporter.verify();
      console.log("[Notification] SMTP connection verified successfully");
      return true;
    } catch (error) {
      console.error("[Notification] SMTP initialization failed:", error);
      return false;
    }
  }

  /**
   * Check if SMTP is configured and available
   */
  isAvailable(): boolean {
    return transporter !== null;
  }

  // ============================================
  // CORE EMAIL SENDING
  // ============================================

  /**
   * Send an email and log it
   */
  private async sendEmail(params: EmailParams): Promise<NotificationResult> {
    // Create notification log entry first
    const log = await prisma.notificationLog.create({
      data: {
        type: "EMAIL" as NotificationType,
        status: "PENDING" as NotificationStatus,
        toAddress: params.to,
        toName: params.toName,
        subject: params.subject,
        bodyPreview: params.body.substring(0, 200),
        bodyFull: params.body,
        relatedCaseId: params.caseId,
        relatedUserId: params.userId,
      },
    });

    // If SMTP not available, mark as failed but don't throw
    if (!transporter) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED" as NotificationStatus,
          failedAt: new Date(),
          errorMessage: "SMTP not configured",
        },
      });

      return {
        success: false,
        notificationId: log.id,
        error: "SMTP not configured",
      };
    }

    try {
      // Determine sender mailbox based on type
      const senderKey = params.sender || "noreply";

      // Determine bot persona - priority: explicit botId > emailType > default
      let fromName: string;
      let fromEmail: string;

      if (params.botId || params.emailType) {
        // Use bot persona with real name
        const botId = params.botId || getBotIdForEmailType(params.emailType || "");
        const botSender = formatBotSender(botId, senderKey);
        fromName = botSender.name;
        fromEmail = botSender.email;
      } else {
        // Fallback to mailbox defaults
        const senderMailbox = MAILBOXES[senderKey];
        fromEmail = senderMailbox.email;
        fromName = senderMailbox.name;
      }

      // Send the email
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
        subject: params.subject,
        text: params.body,
        html: params.html || this.textToHtml(params.body),
      });

      // Update log with success
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "SENT" as NotificationStatus,
          sentAt: new Date(),
          externalId: info.messageId,
        },
      });

      return {
        success: true,
        notificationId: log.id,
      };
    } catch (error: any) {
      // Update log with failure
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED" as NotificationStatus,
          failedAt: new Date(),
          errorMessage: error.message,
        },
      });

      console.error("[Notification] Email send failed:", error);

      return {
        success: false,
        notificationId: log.id,
        error: error.message,
      };
    }
  }

  // ============================================
  // PUBLIC EMAIL METHODS
  // ============================================

  /**
   * Send email to a client
   * Uses: support@capitalmgr.com (client communications)
   */
  async sendClientEmail(params: {
    to: string;
    toName?: string;
    subject: string;
    body: string;
    caseId?: string;
  }): Promise<NotificationResult> {
    return this.sendEmail({
      ...params,
      subject: `[MGR Capital] ${params.subject}`,
      sender: "support", // Client emails come from support@
    });
  }

  /**
   * Send email to an employee
   * Uses: admin@capitalmgr.com (internal communications)
   */
  async sendEmployeeEmail(params: {
    to: string;
    toName?: string;
    subject: string;
    body: string;
    employeeId?: string;
  }): Promise<NotificationResult> {
    return this.sendEmail({
      to: params.to,
      toName: params.toName,
      subject: `[MGR Internal] ${params.subject}`,
      body: params.body,
      userId: params.employeeId,
      sender: "admin", // Internal emails come from admin@
    });
  }

  /**
   * Send email to the Founder
   * Uses: noreply@capitalmgr.com (system alerts)
   */
  async sendFounderEmail(params: {
    subject: string;
    body: string;
    priority?: "normal" | "high" | "urgent";
    caseId?: string;
    userId?: string;
  }): Promise<NotificationResult> {
    const priorityPrefix = {
      normal: "",
      high: "[HIGH] ",
      urgent: "[URGENT] ",
    }[params.priority || "normal"];

    return this.sendEmail({
      to: FOUNDER_EMAIL,
      subject: `${priorityPrefix}[MGR OPS] ${params.subject}`,
      body: params.body,
      caseId: params.caseId,
      userId: params.userId,
      sender: "noreply", // System alerts from noreply@
    });
  }

  // ============================================
  // TRIGGER-BASED NOTIFICATIONS
  // ============================================

  /**
   * Notify client: Documents ready to sign
   * Bot: Taylor Quinn, Document Specialist
   */
  async notifyDocumentsReady(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    documentCount: number;
  }): Promise<NotificationResult> {
    const bot = getBotPersona("documents");
    const body = `
Dear ${params.clientName},

Your documents are ready for review and signature.

Case Reference: ${params.caseCode}
Documents Pending: ${params.documentCount}

Please log in to your client portal to review and sign the required documents.

If you have any questions, please don't hesitate to contact us.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    return this.sendEmail({
      to: params.clientEmail,
      toName: params.clientName,
      subject: `[MGR Capital] Documents Ready for Signature`,
      body,
      caseId: params.caseId,
      sender: "support",
      botId: "documents",
    });
  }

  /**
   * Notify client: Case status update
   * Bot: Jordan Blake, Case Manager
   */
  async notifyCaseStatusChange(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    oldStatus: string;
    newStatus: string;
    message?: string;
  }): Promise<NotificationResult> {
    const bot = getBotPersona("caseManager");
    const body = `
Dear ${params.clientName},

Your case status has been updated.

Case Reference: ${params.caseCode}
New Status: ${this.formatStatus(params.newStatus)}

${params.message ? `\n${params.message}\n` : ""}

You can view your case details by logging into your client portal.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    return this.sendEmail({
      to: params.clientEmail,
      toName: params.clientName,
      subject: `[MGR Capital] Case Update: ${this.formatStatus(params.newStatus)}`,
      body,
      caseId: params.caseId,
      sender: "support",
      botId: "caseManager",
    });
  }

  /**
   * Notify client: Payout completed
   * Bot: Morgan Price, Payment Coordinator
   */
  async notifyPayoutCompleted(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    amountCents: number;
    paymentMethod: string;
  }): Promise<NotificationResult> {
    const amount = (params.amountCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    const bot = getBotPersona("payments");
    const body = `
Dear ${params.clientName},

Great news! Your payout has been processed.

Case Reference: ${params.caseCode}
Amount: ${amount}
Payment Method: ${params.paymentMethod}

Please allow 3-5 business days for the funds to appear in your account.

If you have any questions about your payment, please contact us.

Thank you for trusting MGR Capital Assistance with your surplus recovery.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    return this.sendEmail({
      to: params.clientEmail,
      toName: params.clientName,
      subject: `[MGR Capital] Payout Processed Successfully`,
      body,
      caseId: params.caseId,
      sender: "support",
      botId: "payments",
    });
  }

  /**
   * Notify Founder: High-value case flagged
   * Bot: Jordan Blake, Case Manager
   */
  async notifyHighValueCase(params: {
    caseId: string;
    caseCode: string;
    surplusAmountCents: number;
    state: string;
    county: string;
    clientName: string;
  }): Promise<NotificationResult> {
    const amount = (params.surplusAmountCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    const bot = getBotPersona("caseManager");
    const body = `
HIGH-VALUE CASE DETECTED

Case Code: ${params.caseCode}
Surplus Amount: ${amount}
Location: ${params.county}, ${params.state}
Client: ${params.clientName}

This case exceeds the high-value threshold and may require additional attention.

Recommended Actions:
1. Review case details for accuracy
2. Verify client documentation
3. Consider priority processing
4. Monitor jurisdiction requirements

View case in admin dashboard for full details.

—
${bot.name}
${bot.title}
    `.trim();

    return this.sendEmail({
      to: FOUNDER_EMAIL,
      subject: `[HIGH] [MGR OPS] High-Value Case: ${params.caseCode} (${amount})`,
      body,
      caseId: params.caseId,
      sender: "noreply",
      botId: "caseManager",
    });
  }

  /**
   * Notify Founder: Critical system error
   * Bot: Sam Mitchell, System Administrator
   */
  async notifyCriticalError(params: {
    errorId: string;
    message: string;
    source: string;
    stack?: string;
  }): Promise<NotificationResult> {
    const bot = getBotPersona("system");
    const body = `
CRITICAL SYSTEM ERROR

Error ID: ${params.errorId}
Source: ${params.source}
Message: ${params.message}

${params.stack ? `\nStack Trace:\n${params.stack}` : ""}

Immediate action may be required.

—
${bot.name}
${bot.title}
    `.trim();

    return this.sendEmail({
      to: FOUNDER_EMAIL,
      subject: `[URGENT] [MGR OPS] Critical Error in ${params.source}`,
      body,
      sender: "noreply",
      botId: "system",
    });
  }

  /**
   * Notify employee: Training module assigned
   * Bot: Alex Rivera, Training Manager
   */
  async notifyTrainingAssigned(params: {
    employeeEmail: string;
    employeeName: string;
    employeeId: string;
    moduleName: string;
    dueDate?: Date;
  }): Promise<NotificationResult> {
    const bot = getBotPersona("training");
    const body = `
Hi ${params.employeeName},

A new training module has been assigned to you.

Module: ${params.moduleName}
${params.dueDate ? `Due Date: ${params.dueDate.toLocaleDateString()}` : ""}

Please log in to complete this training at your earliest convenience.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    return this.sendEmail({
      to: params.employeeEmail,
      toName: params.employeeName,
      subject: `[MGR Internal] New Training Assigned: ${params.moduleName}`,
      body,
      userId: params.employeeId,
      sender: "admin",
      botId: "training",
    });
  }

  // ============================================
  // AUTHENTICATION EMAILS
  // ============================================

  /**
   * Send password reset email
   * Bot: Casey Sterling, Security Analyst
   */
  async sendPasswordResetEmail(params: {
    to: string;
    toName?: string;
    userId: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<NotificationResult> {
    const frontendUrl = process.env.FRONTEND_URL || 'https://capitalmgr.com';
    const resetLink = `${frontendUrl}/auth/reset-password?userId=${params.userId}&token=${params.resetToken}`;
    const expiresIn = Math.round((params.expiresAt.getTime() - Date.now()) / (1000 * 60)); // minutes
    const bot = getBotPersona("security");

    const body = `
Hello${params.toName ? ` ${params.toName}` : ''},

You requested a password reset for your MGR Capital Assistance account.

Click the link below to reset your password:
${resetLink}

This link will expire in ${expiresIn} minutes.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

For security reasons, do not share this link with anyone.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .warning { color: #d97706; font-size: 14px; margin-top: 20px; }
    .footer { font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MGR Capital Assistance</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello${params.toName ? ` ${params.toName}` : ''},</p>
      <p>You requested a password reset for your MGR Capital Assistance account.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${resetLink}" class="button">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 12px; color: #666;">${resetLink}</p>
      <p class="warning">This link will expire in ${expiresIn} minutes.</p>
      <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>For security reasons, do not share this link with anyone.</p>
      <p>MGR Capital Assistance Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: params.to,
      toName: params.toName,
      subject: '[MGR Capital] Password Reset Request',
      body,
      html,
      userId: params.userId,
      sender: "noreply",
      botId: "security",
    });
  }

  /**
   * Send welcome email after registration
   * Bot: Jamie Chen, Client Success Manager
   */
  async sendWelcomeEmail(params: {
    to: string;
    toName: string;
    userId: string;
    role: string;
  }): Promise<NotificationResult> {
    const frontendUrl = process.env.FRONTEND_URL || 'https://capitalmgr.com';
    const loginLink = `${frontendUrl}/auth/login`;
    const bot = getBotPersona("support");

    const body = `
Welcome to MGR Capital Assistance, ${params.toName}!

Your account has been created successfully.

Role: ${params.role}
Login: ${loginLink}

If you have any questions, please don't hesitate to contact our support team.

Best regards,
${bot.name}
${bot.title}
MGR Capital Assistance
    `.trim();

    return this.sendEmail({
      to: params.to,
      toName: params.toName,
      subject: '[MGR Capital] Welcome to MGR Capital Assistance',
      body,
      userId: params.userId,
      sender: "support",
      botId: "support",
    });
  }

  // ============================================
  // NOTIFICATION LOG QUERIES
  // ============================================

  /**
   * Get notification history
   */
  async getNotificationHistory(params: {
    type?: NotificationType;
    status?: NotificationStatus;
    caseId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    return prisma.notificationLog.findMany({
      where: {
        type: params.type,
        status: params.status,
        relatedCaseId: params.caseId,
        relatedUserId: params.userId,
      },
      orderBy: { createdAt: "desc" },
      take: params.limit || 50,
      skip: params.offset || 0,
    });
  }

  /**
   * Get notification stats
   */
  async getNotificationStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [total, byStatus, byType] = await Promise.all([
      prisma.notificationLog.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.notificationLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.notificationLog.groupBy({
        by: ["type"],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      period: `${days} days`,
    };
  }

  /**
   * Retry failed notifications
   */
  async retryFailed(notificationId: string): Promise<NotificationResult> {
    const log = await prisma.notificationLog.findUnique({
      where: { id: notificationId },
    });

    if (!log) {
      return { success: false, error: "Notification not found" };
    }

    if (log.status !== "FAILED") {
      return { success: false, error: "Notification is not in failed state" };
    }

    // Re-send the email
    return this.sendEmail({
      to: log.toAddress,
      toName: log.toName || undefined,
      subject: log.subject || "No Subject",
      body: log.bodyFull || log.bodyPreview || "",
      caseId: log.relatedCaseId || undefined,
      userId: log.relatedUserId || undefined,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Convert plain text to simple HTML
   */
  private textToHtml(text: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0f172a;
      color: #fff;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .content {
      background: #fff;
      padding: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">MGR Capital Assistance</h1>
  </div>
  <div class="content">
    ${text.replace(/\n/g, "<br>")}
  </div>
  <div class="footer">
    <p>This is an automated message from MGR Capital Assistance.</p>
    <p>Please do not reply directly to this email.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Format case status for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      NEW: "New Case",
      CONTACTED: "Contact Made",
      DOCS_PENDING: "Documents Pending",
      DOCS_SIGNED: "Documents Signed",
      FILED: "Claim Filed",
      AWAITING_FUNDS: "Awaiting Funds",
      PAID: "Paid",
      CLOSED: "Closed",
      REJECTED: "Rejected",
    };
    return statusMap[status] || status;
  }
}

export const notificationService = new NotificationService();
