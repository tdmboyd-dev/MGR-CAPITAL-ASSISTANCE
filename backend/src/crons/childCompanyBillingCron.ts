// ============================================
// CHILD COMPANY BILLING CRON — MGR CAPITAL ASSISTANT
// Monthly: Process child company subscription billing
// ============================================

import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";
const CRON_NAME = "childCompanyBillingCron";

interface CronResult {
  companiesBilled: number;
  totalRevenueCents: number;
  suspendedCompanies: number;
  errors: string[];
}

export async function runChildCompanyBillingCron(): Promise<CronResult> {
  const result: CronResult = {
    companiesBilled: 0,
    totalRevenueCents: 0,
    suspendedCompanies: 0,
    errors: [],
  };

  const startedAt = new Date();
  logger.info(`[${CRON_NAME}] Starting child company billing cron...`);

  try {
    // 1. Process due billing
    await processDueBilling(result);

    // 2. Check overdue companies (billing 30+ days past due)
    await checkOverdueCompanies(result);

    // Log cron run
    await prisma.botRunLog.create({
      data: {
        botName: CRON_NAME,
        runType: "monthly",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        success: result.errors.length === 0,
        recordsProcessed: result.companiesBilled + result.suspendedCompanies,
        summary: `Billed: ${result.companiesBilled} ($${(result.totalRevenueCents / 100).toFixed(2)}), Suspended: ${result.suspendedCompanies}`,
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
// 1. PROCESS DUE BILLING
// ============================================

async function processDueBilling(result: CronResult) {
  const now = new Date();

  const companiesDue = await prisma.childCompany.findMany({
    where: {
      status: "ACTIVE",
      nextBillingDate: { lte: now },
    },
  });

  for (const company of companiesDue) {
    try {
      // Use floor to avoid charging more than annual fee over 12 months
      // (e.g., $100/year = 833 cents/month * 12 = $99.96, but never more than $100)
      const monthlyFeeCents = Math.floor(company.annualFeeCents / 12);

      // Create OpsInsight as billing record (no caseId required)
      await prisma.opsInsight.create({
        data: {
          source: "ChildCompanyBilling",
          category: "BILLING",
          severity: "LOW",
          priority: "NORMAL",
          title: `Child company billing: ${company.companyName}`,
          description: `Monthly subscription: $${(monthlyFeeCents / 100).toFixed(2)} (${company.plan} plan)`,
          plainEnglish: `Billed ${company.companyName} $${(monthlyFeeCents / 100).toFixed(2)} for ${company.plan} plan.`,
          data: {
            childCompanyId: company.id,
            plan: company.plan,
            amountCents: monthlyFeeCents,
            billingPeriod: now.toISOString().slice(0, 7),
          },
          status: "RESOLVED",
        },
      });

      // Advance billing date by 1 month
      const nextBilling = new Date(company.nextBillingDate!);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      await prisma.childCompany.update({
        where: { id: company.id },
        data: { nextBillingDate: nextBilling },
      });

      result.companiesBilled++;
      result.totalRevenueCents += monthlyFeeCents;

      logger.info(`[${CRON_NAME}] Billed ${company.companyName}: $${(monthlyFeeCents / 100).toFixed(2)}`);
    } catch (error: any) {
      result.errors.push(`Billing ${company.companyName}: ${error.message}`);
    }
  }
}

// ============================================
// 2. CHECK OVERDUE COMPANIES
// ============================================

async function checkOverdueCompanies(result: CronResult) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const overdueCompanies = await prisma.childCompany.findMany({
    where: {
      status: "ACTIVE",
      nextBillingDate: { lt: thirtyDaysAgo },
    },
  });

  for (const company of overdueCompanies) {
    try {
      await prisma.childCompany.update({
        where: { id: company.id },
        data: { status: "SUSPENDED" },
      });

      // Create alert
      await prisma.watchAlert.create({
        data: {
          type: "EMPLOYEE_ANOMALY",
          severity: "HIGH",
          message: `Child company ${company.companyName} suspended — billing 30+ days overdue`,
          details: { childCompanyId: company.id, plan: company.plan },
          status: "OPEN",
        },
      });

      result.suspendedCompanies++;
      logger.info(`[${CRON_NAME}] Suspended overdue company: ${company.companyName}`);
    } catch (error: any) {
      result.errors.push(`Suspend ${company.companyName}: ${error.message}`);
    }
  }
}
