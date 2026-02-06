// ============================================
// TRANSACTIONAL EMAIL BOT — MGR CAPITAL ASSISTANCE
// Handles ALL automated system emails
// Phase 1: Uses Brevo/SMTP
// Phase 3: Switches to Modoboa SMTP as primary
// ============================================

import { notificationService } from "../services/NotificationService.js";
import { emailService } from "../services/EmailService.js";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";
const BOT_NAME = "transactionalEmailBot";

// Email provider mode
type EmailProvider = "brevo" | "modoboa" | "smtp";

interface TransactionalEmailResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

interface EmailQueueItem {
  id: string;
  type: string;
  to: string;
  toName?: string;
  subject: string;
  body: string;
  html?: string;
  caseId?: string;
  userId?: string;
  priority: "low" | "normal" | "high" | "urgent";
  retryCount: number;
  maxRetries: number;
}

class TransactionalEmailBot {
  private provider: EmailProvider;
  private modoboaConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  } | null = null;

  constructor() {
    // Determine provider based on environment
    if (process.env.MODOBOA_SMTP_HOST) {
      this.provider = "modoboa";
      this.modoboaConfig = {
        host: process.env.MODOBOA_SMTP_HOST,
        port: parseInt(process.env.MODOBOA_SMTP_PORT || "587"),
        secure: process.env.MODOBOA_SMTP_SECURE === "true",
        user: process.env.MODOBOA_SMTP_USER || "",
        pass: process.env.MODOBOA_SMTP_PASS || "",
      };
      logger.info(`[${BOT_NAME}] Using Modoboa SMTP as primary provider`);
    } else if (process.env.BREVO_API_KEY) {
      this.provider = "brevo";
      logger.info(`[${BOT_NAME}] Using Brevo as primary provider`);
    } else {
      this.provider = "smtp";
      logger.info(`[${BOT_NAME}] Using generic SMTP as primary provider`);
    }
  }

  // ============================================
  // PASSWORD RESET EMAIL
  // ============================================

  async sendPasswordReset(params: {
    to: string;
    toName?: string;
    userId: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("password_reset", async () => {
      const result = await notificationService.sendPasswordResetEmail(params);
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // WELCOME EMAIL
  // ============================================

  async sendWelcomeEmail(params: {
    to: string;
    toName: string;
    userId: string;
    role: string;
    temporaryPassword?: string;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("welcome", async () => {
      const result = await notificationService.sendWelcomeEmail({
        to: params.to,
        toName: params.toName,
        userId: params.userId,
        role: params.role,
      });
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // CASE STATUS UPDATE EMAIL
  // ============================================

  async sendCaseStatusUpdate(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    oldStatus: string;
    newStatus: string;
    message?: string;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("case_status_update", async () => {
      const result = await notificationService.notifyCaseStatusChange(params);
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // DOCUMENTS READY EMAIL
  // ============================================

  async sendDocumentsReady(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    documentCount: number;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("documents_ready", async () => {
      const result = await notificationService.notifyDocumentsReady(params);
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // PAYOUT COMPLETED EMAIL
  // ============================================

  async sendPayoutCompleted(params: {
    clientEmail: string;
    clientName: string;
    caseId: string;
    caseCode: string;
    amountCents: number;
    paymentMethod: string;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("payout_completed", async () => {
      const result = await notificationService.notifyPayoutCompleted(params);
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // CHILD COMPANY OFFER EMAIL
  // ============================================

  async sendChildCompanyOffer(params: {
    to: string;
    toName: string;
    userId: string;
    offerDetails: string;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("child_company_offer", async () => {
      const result = await notificationService.sendEmployeeEmail({
        to: params.to,
        toName: params.toName,
        subject: "You Qualify to Start Your Own Company Under MGR Capital!",
        body: `
Hi ${params.toName},

Congratulations! Based on your performance and leadership, you now qualify to start your own company under the MGR Capital umbrella.

${params.offerDetails}

Log in to your dashboard to review the offer and get started.

Best regards,
MGR Capital Assistance Team
        `.trim(),
        employeeId: params.userId,
      });
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // EMPLOYEE TRANSFER ALERT EMAIL
  // ============================================

  async sendTransferAlert(params: {
    to: string;
    toName: string;
    userId: string;
    day: number;
    totalDays: number;
    estimatedLoss: string;
    newCompanyName: string;
  }): Promise<TransactionalEmailResult> {
    const isLastDay = params.day >= params.totalDays;
    const subject = isLastDay
      ? "FINAL WARNING — Transfer completes tomorrow"
      : `Day ${params.day}: Transfer cooling period — ${params.totalDays - params.day} days left`;

    return this.logAndSend("transfer_alert", async () => {
      const result = await notificationService.sendEmployeeEmail({
        to: params.to,
        toName: params.toName,
        subject,
        body: `
Hi ${params.toName},

${isLastDay
  ? `FINAL WARNING: Your transfer to ${params.newCompanyName} completes tomorrow.`
  : `Day ${params.day} of your ${params.totalDays}-day cooling period before transferring to ${params.newCompanyName}.`
}

You would lose approximately ${params.estimatedLoss}/month in current tier earnings if you transfer.

${isLastDay
  ? "After tomorrow, the transfer is final and your tier resets to Tier 1."
  : "You can cancel this transfer at any time during the cooling period."
}

Log in to your dashboard to review or cancel.

Best regards,
MGR Capital Assistance Team
        `.trim(),
        employeeId: params.userId,
      });
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // EMAIL HOSTING ALERTS
  // ============================================

  async sendEmailRenewalAlert(params: {
    to: string;
    toName: string;
    userId: string;
    emailAddress: string;
    daysUntilExpiry: number;
    monthlyCost: string;
  }): Promise<TransactionalEmailResult> {
    return this.logAndSend("email_renewal_alert", async () => {
      const result = await notificationService.sendClientEmail({
        to: params.to,
        toName: params.toName,
        subject: `Email Renewal: ${params.emailAddress} expires in ${params.daysUntilExpiry} days`,
        body: `
Hi ${params.toName},

Your professional email account ${params.emailAddress} will expire in ${params.daysUntilExpiry} days.

Monthly cost: ${params.monthlyCost}

Please ensure your payment method is up to date to avoid service interruption.

If your account expires, you have a 10-day grace period to reactivate before permanent deletion.

Best regards,
MGR Capital Assistance Team
        `.trim(),
      });
      return {
        success: result.success,
        provider: this.provider,
        messageId: result.notificationId,
        error: result.error,
      };
    });
  }

  // ============================================
  // BOT RUN — Process queued emails
  // ============================================

  async run(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    retried: number;
  }> {
    const startedAt = new Date();
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let retried = 0;

    try {
      // Find failed notifications that should be retried
      const failedNotifications = await prisma.notificationLog.findMany({
        where: {
          status: "FAILED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        take: 50,
        orderBy: { createdAt: "asc" },
      });

      for (const notification of failedNotifications) {
        processed++;
        const result = await notificationService.retryFailed(notification.id);
        if (result.success) {
          sent++;
          retried++;
        } else {
          failed++;
        }
      }

      // Log bot run
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          runType: "retry_failed",
          startedAt,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          success: true,
          recordsProcessed: processed,
          summary: `Processed ${processed} failed emails. Retried: ${retried}, Sent: ${sent}, Failed: ${failed}`,
          details: { processed, sent, failed, retried },
        },
      });
    } catch (error: any) {
      logger.error(`[${BOT_NAME}] Run error:`, error);
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          runType: "retry_failed",
          startedAt,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          success: false,
          error: error.message,
        },
      });
    }

    return { processed, sent, failed, retried };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async logAndSend(
    emailType: string,
    sendFn: () => Promise<TransactionalEmailResult>
  ): Promise<TransactionalEmailResult> {
    try {
      const result = await sendFn();
      if (!result.success) {
        logger.warn(`[${BOT_NAME}] Failed to send ${emailType}: ${result.error}`);
      }
      return result;
    } catch (error: any) {
      logger.error(`[${BOT_NAME}] Error sending ${emailType}:`, error);
      return {
        success: false,
        provider: this.provider,
        error: error.message,
      };
    }
  }
}

export const transactionalEmailBot = new TransactionalEmailBot();
