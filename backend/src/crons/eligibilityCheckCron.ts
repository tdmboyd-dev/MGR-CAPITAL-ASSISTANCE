// ============================================
// ELIGIBILITY CHECK CRON — MGR CAPITAL ASSISTANT
// Weekly: Auto-generate child company offers for eligible employees
// ============================================

import { PrismaClient } from "@prisma/client";
import { childCompanyService } from "../services/ChildCompanyService.js";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();
const CRON_NAME = "eligibilityCheckCron";

interface CronResult {
  employeesChecked: number;
  offersGenerated: number;
  alreadyEligible: number;
  errors: string[];
}

export async function runEligibilityCheckCron(): Promise<CronResult> {
  const result: CronResult = {
    employeesChecked: 0,
    offersGenerated: 0,
    alreadyEligible: 0,
    errors: [],
  };

  const startedAt = new Date();
  logger.info(`[${CRON_NAME}] Starting eligibility check cron...`);

  try {
    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    });

    for (const employee of employees) {
      result.employeesChecked++;

      try {
        // Check if they already have a pending offer or active company
        const existingOffer = await prisma.childCompanyOffer.findFirst({
          where: {
            employeeId: employee.id,
            isAccepted: false,
            isDeclined: false,
          },
        });

        const existingCompany = await prisma.childCompany.findFirst({
          where: {
            ownerId: employee.id,
            status: "ACTIVE",
          },
        });

        if (existingOffer || existingCompany) {
          result.alreadyEligible++;
          continue;
        }

        // Check eligibility and auto-generate offer
        const offerResult = await childCompanyService.generateOfferIfEligible(employee.id);
        if (offerResult.offered && offerResult.offerId) {
          result.offersGenerated++;
          logger.info(`[${CRON_NAME}] Generated offer for ${employee.name} (${employee.email})`);
        }
      } catch (error: any) {
        // Not eligible — that's fine, skip silently
        if (error.message?.includes("not eligible") || error.message?.includes("Not eligible")) continue;
        result.errors.push(`Check ${employee.name}: ${error.message}`);
      }
    }

    // Log cron run
    await prisma.botRunLog.create({
      data: {
        botName: CRON_NAME,
        runType: "weekly",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        success: result.errors.length === 0,
        recordsProcessed: result.employeesChecked,
        summary: `Checked: ${result.employeesChecked}, Offers: ${result.offersGenerated}, Already eligible: ${result.alreadyEligible}`,
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
