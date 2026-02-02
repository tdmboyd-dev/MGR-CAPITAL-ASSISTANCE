// ============================================
// TRANSFER COOLING CRON — MGR CAPITAL ASSISTANT
// Daily: Send cooling period alerts, complete expired transfers
// ============================================

import { PrismaClient } from "@prisma/client";
import { transactionalEmailBot } from "../bots/TransactionalEmailBot.js";
import { childCompanyService } from "../services/ChildCompanyService.js";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();
const CRON_NAME = "transferCoolingCron";

interface CronResult {
  alertsSent: number;
  transfersCompleted: number;
  errors: string[];
}

export async function runTransferCoolingCron(): Promise<CronResult> {
  const result: CronResult = {
    alertsSent: 0,
    transfersCompleted: 0,
    errors: [],
  };

  const startedAt = new Date();
  logger.info(`[${CRON_NAME}] Starting transfer cooling cron...`);

  try {
    // 1. Send daily cooling alerts to employees in cooling period
    await sendCoolingAlerts(result);

    // 2. Complete transfers where cooling period has elapsed
    await completeExpiredTransfers(result);

    // Log cron run
    await prisma.botRunLog.create({
      data: {
        botName: CRON_NAME,
        runType: "daily",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        success: result.errors.length === 0,
        recordsProcessed: result.alertsSent + result.transfersCompleted,
        summary: `Alerts: ${result.alertsSent}, Completed: ${result.transfersCompleted}`,
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
// 1. SEND COOLING PERIOD DAILY ALERTS
// ============================================

async function sendCoolingAlerts(result: CronResult) {
  const activeTransfers = await prisma.employeeTransfer.findMany({
    where: { status: "COOLING_PERIOD" },
    include: {
      toChildCompany: { select: { companyName: true } },
    },
  });

  for (const transfer of activeTransfers) {
    try {
      // Look up the employee separately
      const employee = await prisma.user.findUnique({
        where: { id: transfer.employeeId },
        select: { id: true, name: true, email: true },
      });

      if (!employee?.email) continue;

      // Calculate current day
      const daysSinceStart = Math.ceil(
        (Date.now() - transfer.coolingStartDate!.getTime()) / (24 * 60 * 60 * 1000)
      );
      const totalDays = Math.ceil(
        (transfer.coolingEndDate!.getTime() - transfer.coolingStartDate!.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Update current cooling day in DB
      await prisma.employeeTransfer.update({
        where: { id: transfer.id },
        data: { currentCoolingDay: daysSinceStart },
      });

      // Send daily alert
      await transactionalEmailBot.sendTransferAlert({
        to: employee.email,
        toName: employee.name,
        userId: employee.id,
        day: daysSinceStart,
        totalDays,
        estimatedLoss: transfer.estimatedMonthlyLossCents > 0
          ? `$${(transfer.estimatedMonthlyLossCents / 100).toFixed(2)}`
          : "unknown",
        newCompanyName: transfer.toChildCompany?.companyName || "new company",
      });

      result.alertsSent++;
      logger.info(`[${CRON_NAME}] Sent cooling alert day ${daysSinceStart}/${totalDays} to ${employee.email}`);
    } catch (error: any) {
      result.errors.push(`Alert for transfer ${transfer.id}: ${error.message}`);
    }
  }
}

// ============================================
// 2. COMPLETE EXPIRED TRANSFERS
// ============================================

async function completeExpiredTransfers(result: CronResult) {
  const now = new Date();

  const expiredTransfers = await prisma.employeeTransfer.findMany({
    where: {
      status: "COOLING_PERIOD",
      coolingEndDate: { lte: now },
    },
  });

  for (const transfer of expiredTransfers) {
    try {
      const completeResult = await childCompanyService.completeTransfer(transfer.id);
      if (completeResult.success) {
        result.transfersCompleted++;
        logger.info(`[${CRON_NAME}] Transfer ${transfer.id} completed automatically`);
      } else {
        result.errors.push(`Complete transfer ${transfer.id}: ${completeResult.error}`);
      }
    } catch (error: any) {
      result.errors.push(`Complete transfer ${transfer.id}: ${error.message}`);
    }
  }
}
