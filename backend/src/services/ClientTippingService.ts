/** Client tip projections. Existing 50% allocation policy is preserved.
 * Employee displays use their actual allocation. Collection and settlement require qualified integration.
 */
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { currentActor,requireCase } from "./CaseDocumentAccess.js";
import type { Prisma } from "@prisma/client";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Existing platform allocation policy; no collection or payout is executed here.
export const SHADOW_CUT_PERCENT = 50;

// Tip amounts offered to clients (in cents)
const TIP_OPTIONS = [
  { amountCents: 1000, label: '$10' },
  { amountCents: 2500, label: '$25' },
  { amountCents: 5000, label: '$50' },
  { amountCents: 10000, label: '$100' },
  { amountCents: 0, label: 'Custom' },
];

// =============================================================================
// TYPES
// =============================================================================

export interface ClientTip {
  id: string;
  caseId: string;
  clientId: string;
  employeeId: string;

  // What client paid
  clientPaidCents: number;

  // Shadow accounting
  displayedTipCents: number;    // Legacy display field; employee projections use employeeReceivesCents
  employeeReceivesCents: number; // What employee GETS (after shadow cut)
  platformProfitCents: number;   // What platform keeps (hidden)

  // Status
  status: 'pending' | 'processed' | 'paid_out' | 'refunded';

  // Metadata
  clientMessage?: string;
  createdAt: Date;
  paidOutAt?: Date;
}

export interface TipStats {
  totalTipsReceived: number;      // Actual employee allocation; not proof of external payment
  totalTipsPaidOut: number;       // What employee got
  tipCount: number;
  averageTip: number;

  // FOUNDER ONLY
  _founderOnly?: {
    actualClientPaid: number;
    platformProfit: number;
    employeeThinks: string;
    realityIs: string;
  };
}

// =============================================================================
// CLIENT TIPPING SERVICE
// =============================================================================

class ClientTippingService {
  /**
   * Get tip options to show client
   */
  getTipOptions(): { amountCents: number; label: string }[] {
    return TIP_OPTIONS;
  }

  /**
   * Process a tip from client
   * Shadow cut is applied - employee only sees/gets portion
   */
  async processTip(data: {
    caseId: string;
    clientId: string;
    employeeId: string;
    amountCents: number;
    message?: string;
  }): Promise<ClientTip> {
    if(!Number.isSafeInteger(data.amountCents)||data.amountCents<100||data.amountCents>2147483647)throw new AppError('Invalid tip',400,'Enter a tip of at least one dollar in integer cents.');
    const {actor,record}=await requireCase(prisma,data.clientId,data.caseId);
    if(actor.role!=='CLIENT'||record.clientId!==data.clientId||record.assignedEmployeeId!==data.employeeId)throw new AppError('Forbidden',403,'Tip recipient must be the assigned employee on your own case.');
    // No qualified collection/settlement integration exists. Never create a record saying money was paid.
    throw new AppError('Tip collection unavailable',503,'Tip collection is not connected. Nothing was charged or paid.');
  }

  /**
   * Get tip stats for an employee
   * Employee sees actual allocated cents, not gross client amounts.
   */
  async getEmployeeTipStats(employeeId: string, isFounder: boolean = false): Promise<TipStats> {
    const actor=await currentActor(prisma,employeeId);
    isFounder=isFounder&&actor.role==='FOUNDER'&&actor.tenantId===null;
    const tips = await prisma.clientTip.findMany({
      where: { employeeId, case:{tenantId:actor.tenantId}, status: { in: ['processed', 'paid_out'] } },
    });

    let totalDisplayed = 0;
    let totalPaidOut = 0;
    let totalClientPaid = 0;
    let totalPlatformProfit = 0;

    for (const tip of tips) {
      totalDisplayed += tip.employeeReceivesCents;
      if(tip.status==='paid_out'&&tip.paidOutAt)totalPaidOut += tip.employeeReceivesCents;
      totalClientPaid += tip.clientPaidCents;
      totalPlatformProfit += tip.platformProfitCents;
    }

    const stats: TipStats = {
      totalTipsReceived: totalDisplayed,  // What employee SEES
      totalTipsPaidOut: totalPaidOut,      // What employee GOT
      tipCount: tips.length,
      averageTip: tips.length > 0 ? Math.round(totalDisplayed / tips.length) : 0,
    };

    // Internal company totals remain founder-only.
    if (isFounder) {
      stats._founderOnly = {
        actualClientPaid: totalClientPaid,
        platformProfit: totalPlatformProfit,
        employeeThinks: `Recorded employee allocation: $${(totalDisplayed / 100).toFixed(2)}`,
        realityIs: `Clients paid $${(totalClientPaid / 100).toFixed(2)}, we kept $${(totalPlatformProfit / 100).toFixed(2)}`,
      };
    }

    return stats;
  }

  /**
   * Get tips for a case
   */
  async getCaseTips(caseId: string, actorId:string) {
    await requireCase(prisma,actorId,caseId);
    const tips = await prisma.clientTip.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    return tips;
  }

  /**
   * Mark tip as paid out to employee
   */
  async markPaidOut(tipId: string): Promise<void> {
    void tipId;
    throw new AppError('Tip settlement unavailable',503,'Tip payout cannot be confirmed without a qualified settlement receipt.');
  }

  /**
   * Get all tip revenue (FOUNDER ONLY)
   */
  async getTipRevenue(startDate?: Date, endDate?: Date): Promise<{
    totalClientPaid: number;
    totalEmployeePaid: number;
    totalPlatformProfit: number;
    tipCount: number;
  }> {
    const where: Prisma.ClientTipWhereInput = { status: { in: ['processed', 'paid_out'] } };

    if (startDate) {
      where.createdAt = { gte: startDate, ...(endDate?{lte:endDate}:{}) };
    }
    if (endDate) {
      where.createdAt = { ...(startDate?{gte:startDate}:{}), lte: endDate };
    }

    const tips = await prisma.clientTip.findMany({ where });

    let totalClientPaid = 0;
    let totalEmployeePaid = 0;
    let totalPlatformProfit = 0;

    for (const tip of tips) {
      totalClientPaid += tip.clientPaidCents;
      totalEmployeePaid += tip.employeeReceivesCents;
      totalPlatformProfit += tip.platformProfitCents;
    }

    return {
      totalClientPaid,
      totalEmployeePaid,
      totalPlatformProfit,
      tipCount: tips.length,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const clientTippingService = new ClientTippingService();
export default clientTippingService;
