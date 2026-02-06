// ============================================
// EMAIL HOSTING CRON — MGR CAPITAL ASSISTANCE
// Daily: billing, renewal alerts, deletions, DNS checks, storage
// ============================================

import { emailProvisioningBot } from "../services/EmailProvisioningBot.js";
import { modoboaService } from "../services/ModoboaService.js";
import { notificationService } from "../services/NotificationService.js";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";
const CRON_NAME = "emailHostingCron";

interface CronResult {
  renewalAlertsSent: number;
  deletionsExecuted: number;
  dnsChecked: number;
  billingProcessed: number;
  errors: string[];
}

export async function runEmailHostingCron(): Promise<CronResult> {
  const result: CronResult = {
    renewalAlertsSent: 0,
    deletionsExecuted: 0,
    dnsChecked: 0,
    billingProcessed: 0,
    errors: [],
  };

  const startedAt = new Date();
  logger.info(`[${CRON_NAME}] Starting daily email hosting cron...`);

  try {
    // 1. Send renewal alerts (7 days before billing)
    await sendRenewalAlerts(result);

    // 2. Execute deletions past 10-day grace
    await executeScheduledDeletions(result);

    // 3. Check DNS for pending domains
    await checkDnsRecords(result);

    // 4. Process suspended accounts (past billing date)
    await processBilling(result);

    // Log cron run
    await prisma.botRunLog.create({
      data: {
        botName: CRON_NAME,
        runType: "daily",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        success: result.errors.length === 0,
        recordsProcessed:
          result.renewalAlertsSent +
          result.deletionsExecuted +
          result.dnsChecked +
          result.billingProcessed,
        summary: `Alerts: ${result.renewalAlertsSent}, Deletions: ${result.deletionsExecuted}, DNS: ${result.dnsChecked}, Billing: ${result.billingProcessed}`,
        details: result as any,
      },
    });
  } catch (error: any) {
    logger.error(`[${CRON_NAME}] Cron error:`, error);
    result.errors.push(error.message);
  }

  logger.info(`[${CRON_NAME}] Cron completed`, result as any);
  return result;
}

// ============================================
// 1. RENEWAL ALERTS
// ============================================

async function sendRenewalAlerts(result: CronResult) {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const accountsDueForRenewal = await prisma.emailAccount.findMany({
    where: {
      status: "ACTIVE",
      billingActive: true,
      isFree: false,
      nextBillingDate: {
        lte: sevenDaysFromNow,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      emailAddress: true,
      userId: true,
      monthlyFeeCents: true,
      nextBillingDate: true,
    },
  });

  for (const account of accountsDueForRenewal) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: account.userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        const daysLeft = Math.ceil(
          (account.nextBillingDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        await notificationService.sendClientEmail({
          to: user.email,
          toName: user.name,
          subject: `Email Renewal: ${account.emailAddress} — ${daysLeft} days`,
          body: `Your email account ${account.emailAddress} renews in ${daysLeft} days. Monthly cost: $${(account.monthlyFeeCents / 100).toFixed(2)}. Ensure your payment is up to date.`,
        });

        result.renewalAlertsSent++;
      }
    } catch (error: any) {
      result.errors.push(`Renewal alert for ${account.emailAddress}: ${error.message}`);
    }
  }
}

// ============================================
// 2. EXECUTE SCHEDULED DELETIONS
// ============================================

async function executeScheduledDeletions(result: CronResult) {
  const now = new Date();

  const accountsToDelete = await prisma.emailAccount.findMany({
    where: {
      status: "GRACE_PERIOD",
      deletionScheduledAt: { lte: now },
    },
  });

  for (const account of accountsToDelete) {
    try {
      const deleteResult = await emailProvisioningBot.permanentDelete(account.id);
      if (deleteResult.success) {
        result.deletionsExecuted++;
        logger.info(`[${CRON_NAME}] Deleted email account: ${account.emailAddress}`);
      } else {
        result.errors.push(`Delete ${account.emailAddress}: ${deleteResult.error}`);
      }
    } catch (error: any) {
      result.errors.push(`Delete ${account.emailAddress}: ${error.message}`);
    }
  }
}

// ============================================
// 3. DNS CHECKS
// ============================================

async function checkDnsRecords(result: CronResult) {
  const pendingDomains = await prisma.emailDomain.findMany({
    where: { status: "PENDING_DNS" },
    take: 10,
  });

  for (const domain of pendingDomains) {
    try {
      const verifyResult = await modoboaService.verifyDomain(domain.domain);

      if (verifyResult.success && verifyResult.data) {
        const allVerified = verifyResult.data.mx && verifyResult.data.spf;

        await prisma.emailDomain.update({
          where: { id: domain.id },
          data: {
            mxVerified: verifyResult.data.mx || false,
            spfVerified: verifyResult.data.spf || false,
            dkimVerified: verifyResult.data.dkim || false,
            dmarcVerified: verifyResult.data.dmarc || false,
            lastDnsCheck: new Date(),
            status: allVerified ? "DNS_VERIFIED" : "PENDING_DNS",
          },
        });
      }

      result.dnsChecked++;
    } catch (error: any) {
      result.errors.push(`DNS check ${domain.domain}: ${error.message}`);
    }
  }
}

// ============================================
// 4. BILLING PROCESSING
// ============================================

async function processBilling(result: CronResult) {
  const now = new Date();

  // Find accounts past their billing date
  const overdueBilling = await prisma.emailAccount.findMany({
    where: {
      status: "ACTIVE",
      billingActive: true,
      isFree: false,
      nextBillingDate: { lt: now },
    },
    take: 50,
  });

  for (const account of overdueBilling) {
    try {
      // For now, just advance the billing date (Stripe integration would go here)
      const nextBilling = new Date(account.nextBillingDate!);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { nextBillingDate: nextBilling },
      });

      result.billingProcessed++;
    } catch (error: any) {
      result.errors.push(`Billing ${account.emailAddress}: ${error.message}`);
    }
  }
}
