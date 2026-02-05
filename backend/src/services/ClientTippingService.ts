/**
 * ClientTippingService.ts — MGR CAPITAL ASSISTANCE
 *
 * CLIENT TIPPING SYSTEM WITH SHADOW CUT
 *
 * When clients tip employees:
 * - Employee sees: "Client tipped you $50!"
 * - Employee gets: $25 (50% shadow cut)
 * - Platform keeps: $25
 *
 * The employee NEVER knows the platform takes half.
 * They think they got the full tip.
 */

import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Shadow cut percentage - platform takes this before employee sees anything
const SHADOW_CUT_PERCENT = 50;

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
  displayedTipCents: number;    // What employee SEES ("You received a $50 tip!")
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
  totalTipsReceived: number;      // What employee sees
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
    const { caseId, clientId, employeeId, amountCents, message } = data;

    if (amountCents < 100) {
      throw new Error('Minimum tip is $1');
    }

    // SHADOW ACCOUNTING
    // What employee SEES: The full tip amount
    // "Congratulations! You received a $50 tip from your client!"
    const displayedTip = amountCents;

    // What employee GETS: After 50% shadow cut
    const shadowCut = Math.round(amountCents * (SHADOW_CUT_PERCENT / 100));
    const employeeReceives = amountCents - shadowCut;

    // Platform profit = shadow cut
    const platformProfit = shadowCut;

    // Create tip record
    const tipId = `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tip: ClientTip = {
      id: tipId,
      caseId,
      clientId,
      employeeId,
      clientPaidCents: amountCents,
      displayedTipCents: displayedTip,
      employeeReceivesCents: employeeReceives,
      platformProfitCents: platformProfit,
      status: 'pending',
      clientMessage: message,
      createdAt: new Date(),
    };

    // Store in database
    await (prisma as any).clientTip?.create({
      data: {
        id: tipId,
        caseId,
        clientId,
        employeeId,
        clientPaidCents: amountCents,
        displayedTipCents: displayedTip,
        employeeReceivesCents: employeeReceives,
        platformProfitCents: platformProfit,
        status: 'pending',
        clientMessage: message,
      },
    }).catch(() => {
      logger.info('ClientTip table not found, tip stored in memory', { tipId });
    });

    logger.info('Client tip processed', {
      tipId,
      caseId,
      clientPaid: amountCents,
      employeeSees: displayedTip,
      employeeGets: employeeReceives,
      platformProfit,
    });

    return tip;
  }

  /**
   * Get tip stats for an employee
   * SHADOW: Employee only sees displayed amounts
   */
  async getEmployeeTipStats(employeeId: string, isFounder: boolean = false): Promise<TipStats> {
    const tips = await (prisma as any).clientTip?.findMany({
      where: { employeeId, status: { in: ['processed', 'paid_out'] } },
    }).catch(() => []) || [];

    let totalDisplayed = 0;
    let totalPaidOut = 0;
    let totalClientPaid = 0;
    let totalPlatformProfit = 0;

    for (const tip of tips) {
      totalDisplayed += tip.displayedTipCents;
      totalPaidOut += tip.employeeReceivesCents;
      totalClientPaid += tip.clientPaidCents;
      totalPlatformProfit += tip.platformProfitCents;
    }

    const stats: TipStats = {
      totalTipsReceived: totalDisplayed,  // What employee SEES
      totalTipsPaidOut: totalPaidOut,      // What employee GOT
      tipCount: tips.length,
      averageTip: tips.length > 0 ? Math.round(totalDisplayed / tips.length) : 0,
    };

    // Only founder sees the reality
    if (isFounder) {
      stats._founderOnly = {
        actualClientPaid: totalClientPaid,
        platformProfit: totalPlatformProfit,
        employeeThinks: `I received $${(totalDisplayed / 100).toFixed(2)} in tips`,
        realityIs: `Clients paid $${(totalClientPaid / 100).toFixed(2)}, we kept $${(totalPlatformProfit / 100).toFixed(2)}`,
      };
    }

    return stats;
  }

  /**
   * Get tips for a case
   */
  async getCaseTips(caseId: string): Promise<ClientTip[]> {
    const tips = await (prisma as any).clientTip?.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []) || [];

    return tips;
  }

  /**
   * Mark tip as paid out to employee
   */
  async markPaidOut(tipId: string): Promise<void> {
    await (prisma as any).clientTip?.update({
      where: { id: tipId },
      data: { status: 'paid_out', paidOutAt: new Date() },
    }).catch(() => {});

    logger.info('Tip marked as paid out', { tipId });
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
    const where: any = { status: { in: ['processed', 'paid_out'] } };

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: startDate };
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: endDate };
    }

    const tips = await (prisma as any).clientTip?.findMany({ where }).catch(() => []) || [];

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
