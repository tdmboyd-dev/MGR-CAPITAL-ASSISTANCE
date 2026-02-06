// ============================================
// EMAIL PROVISIONING BOT — MGR CAPITAL ASSISTANCE
// Automated email account setup via Modoboa
// Handles: provisioning, billing, renewal, deletion grace
// ============================================

import { modoboaService } from "./ModoboaService.js";
import { notificationService } from "./NotificationService.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
const BOT_NAME = "emailProvisioningBot";

interface ProvisionResult {
  success: boolean;
  emailAccountId?: string;
  credentials?: {
    email: string;
    password: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
  };
  dnsRecords?: any;
  error?: string;
}

class EmailProvisioningBot {
  // ============================================
  // CHECK AVAILABILITY
  // ============================================

  async checkAvailability(emailAddress: string): Promise<{ available: boolean; reason?: string }> {
    const existing = await prisma.emailAccount.findUnique({
      where: { emailAddress },
    });

    if (existing) {
      if (existing.status === "DELETED") {
        return { available: true };
      }
      return { available: false, reason: "Email address already in use" };
    }

    return { available: true };
  }

  // ============================================
  // PROVISION EMAIL ACCOUNT
  // ============================================

  async provisionAccount(params: {
    userId: string;
    emailAddress: string;
    displayName: string;
    domainName: string;
    isFree?: boolean;
    assignedByFounder?: boolean;
    monthlyFeeCents?: number;
  }): Promise<ProvisionResult> {
    try {
      // Check availability
      const available = await this.checkAvailability(params.emailAddress);
      if (!available.available) {
        return { success: false, error: available.reason };
      }

      // Ensure domain exists
      let domain = await prisma.emailDomain.findUnique({
        where: { domain: params.domainName },
      });

      if (!domain) {
        // Create domain
        const modoboaResult = await modoboaService.addDomain(params.domainName);
        const dnsRecords = modoboaService.generateDnsRecords(params.domainName);

        domain = await prisma.emailDomain.create({
          data: {
            domain: params.domainName,
            status: "PENDING_DNS",
            ownerId: params.userId,
            mxRecord: dnsRecords.mx,
            spfRecord: dnsRecords.spf,
            dkimRecord: dnsRecords.dkim,
            dmarcRecord: dnsRecords.dmarc,
            modoboaDomainId: modoboaResult.data?.pk?.toString(),
          },
        });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(12).toString("base64url");

      // Create mailbox in Modoboa
      const mailboxResult = await modoboaService.createMailbox({
        email: params.emailAddress,
        password: tempPassword,
        displayName: params.displayName,
        domain: params.domainName,
      });

      const mailServerHostname = process.env.MAIL_SERVER_HOSTNAME || "mail.capitalmgr.com";

      // Determine monthly fee
      const monthlyFeeCents = params.isFree ? 0 : (params.monthlyFeeCents || 600);
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // Create email account record
      const account = await prisma.emailAccount.create({
        data: {
          emailAddress: params.emailAddress,
          displayName: params.displayName,
          userId: params.userId,
          domainId: domain.id,
          status: mailboxResult.success ? "ACTIVE" : "PROVISIONING",
          modoboaMailboxId: mailboxResult.data?.pk?.toString(),
          monthlyFeeCents,
          setupFeeCents: params.isFree ? 0 : 1200,
          nextBillingDate: params.isFree ? null : nextBillingDate,
          billingActive: !params.isFree,
          isFree: params.isFree || false,
          assignedByFounder: params.assignedByFounder || false,
        },
      });

      const dnsRecords = modoboaService.generateDnsRecords(params.domainName);

      return {
        success: true,
        emailAccountId: account.id,
        credentials: {
          email: params.emailAddress,
          password: tempPassword,
          imapHost: mailServerHostname,
          imapPort: 993,
          smtpHost: mailServerHostname,
          smtpPort: 587,
        },
        dnsRecords,
      };
    } catch (error: any) {
      logger.error(`[${BOT_NAME}] Provisioning failed`, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // REQUEST DELETION (10-day grace)
  // ============================================

  async requestDeletion(accountId: string): Promise<{ success: boolean; error?: string; deletionDate?: Date }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return { success: false, error: "Account not found" };
    if (account.status === "DELETED") return { success: false, error: "Account already deleted" };
    if (account.status === "GRACE_PERIOD") return { success: false, error: "Already in deletion grace period" };

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 10);

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        status: "GRACE_PERIOD",
        deletionRequestedAt: new Date(),
        deletionScheduledAt: deletionDate,
      },
    });

    return { success: true, deletionDate };
  }

  // ============================================
  // CANCEL DELETION
  // ============================================

  async cancelDeletion(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return { success: false, error: "Account not found" };
    if (account.status !== "GRACE_PERIOD") return { success: false, error: "Account not in grace period" };

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        status: "ACTIVE",
        deletionRequestedAt: null,
        deletionScheduledAt: null,
        deletionCancelledAt: new Date(),
      },
    });

    return { success: true };
  }

  // ============================================
  // PERMANENT DELETE (after grace period)
  // ============================================

  async permanentDelete(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return { success: false, error: "Account not found" };

    // Delete from Modoboa
    if (account.modoboaMailboxId) {
      await modoboaService.deleteMailbox(account.emailAddress);
    }

    // Mark as deleted
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { status: "DELETED", billingActive: false },
    });

    return { success: true };
  }

  // ============================================
  // RESET PASSWORD
  // ============================================

  async resetPassword(accountId: string): Promise<{ success: boolean; newPassword?: string; error?: string }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return { success: false, error: "Account not found" };

    const newPassword = crypto.randomBytes(12).toString("base64url");

    const result = await modoboaService.resetMailboxPassword(account.emailAddress, newPassword);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, newPassword };
  }
}

export const emailProvisioningBot = new EmailProvisioningBot();
