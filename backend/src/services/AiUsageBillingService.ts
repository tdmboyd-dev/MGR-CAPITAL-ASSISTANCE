/**
 * AiUsageBillingService.ts — MGR CAPITAL ASSISTANCE
 *
 * Tracks AI usage across the platform and bills users with markup.
 * Supports pass-through billing with platform fee.
 *
 * PRICING STRUCTURE:
 * - Track actual AI costs (tokens, API calls)
 * - Add platform markup (configurable, default 20%)
 * - Bill to user's account or case
 * - Support prepaid credits and pay-as-you-go
 *
 * SUPPORTED SERVICES:
 * - LLM (DeepSeek, Gemini, OpenAI, Ollama)
 * - STT (OpenAI Whisper)
 * - TTS (ElevenLabs)
 * - Document AI (OCR, extraction)
 * - Skip Trace (per lookup)
 * - Notary (per session)
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

// Platform markup percentage (20% default)
const PLATFORM_MARKUP_PERCENT = parseFloat(process.env.AI_MARKUP_PERCENT || '20');

// AI Provider Costs (per 1M tokens for LLMs, per minute/request for others)
const AI_COSTS = {
  // LLM Costs (per 1M tokens)
  llm: {
    deepseek: { input: 14, output: 28 },       // $0.014/$0.028 per 1M tokens (95% cheaper!)
    gemini: { input: 75, output: 300 },        // $0.075/$0.30 per 1M tokens
    openai_gpt4o_mini: { input: 150, output: 600 },  // $0.15/$0.60 per 1M tokens
    openai_gpt4o: { input: 2500, output: 10000 },    // $2.50/$10 per 1M tokens
    ollama: { input: 0, output: 0 },           // Free (local)
  },
  // Speech-to-Text (per minute)
  stt: {
    whisper: 600,  // $0.006 per minute ($6/1000 min)
    deepgram: 450, // $0.0045 per minute
  },
  // Text-to-Speech (per 1000 characters)
  tts: {
    elevenlabs: 30,  // $0.30 per 1000 chars
    openai: 15,      // $0.015 per 1000 chars
  },
  // Document Processing
  document: {
    ocr_per_page: 10,        // $0.10 per page
    extraction_per_doc: 50,  // $0.50 per document
  },
  // Skip Trace
  skipTrace: {
    basic: 100,      // $1.00 per lookup
    enhanced: 300,   // $3.00 per lookup
    batch: 50,       // $0.50 per lookup (batch rate)
  },
  // Notary
  notary: {
    standard: 2500,  // $25 per session
    expedited: 5000, // $50 per session
    '24hour': 7500,  // $75 per session
  },
  // Email
  email: {
    transactional: 1,      // $0.01 per email
    professional_monthly: 500, // $5/month per mailbox
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type UsageType = 'llm' | 'stt' | 'tts' | 'document' | 'skip_trace' | 'notary' | 'email';

export interface UsageRecord {
  id?: string;
  userId: string;
  caseId?: string;
  type: UsageType;
  provider: string;
  quantity: number;
  unit: string;
  baseCostCents: number;
  markupCents: number;
  totalCostCents: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface UserBalance {
  userId: string;
  creditBalanceCents: number;
  usageThisMonthCents: number;
  pendingChargesCents: number;
  lastTopupAt?: Date;
  autoRechargeEnabled: boolean;
  autoRechargeThresholdCents: number;
  autoRechargeAmountCents: number;
}

export interface UsageSummary {
  userId: string;
  period: 'day' | 'week' | 'month' | 'all';
  totalCostCents: number;
  byType: Record<UsageType, number>;
  byProvider: Record<string, number>;
  topCases: { caseId: string; costCents: number }[];
}

// =============================================================================
// AI USAGE BILLING SERVICE
// =============================================================================

class AiUsageBillingService {
  /**
   * Record AI usage and calculate cost
   */
  async recordUsage(usage: Omit<UsageRecord, 'baseCostCents' | 'markupCents' | 'totalCostCents'>): Promise<UsageRecord> {
    // Calculate base cost
    const baseCostCents = this.calculateBaseCost(usage.type, usage.provider, usage.quantity);

    // Apply markup
    const markupCents = Math.round(baseCostCents * (PLATFORM_MARKUP_PERCENT / 100));
    const totalCostCents = baseCostCents + markupCents;

    const record: UsageRecord = {
      ...usage,
      baseCostCents,
      markupCents,
      totalCostCents,
      createdAt: new Date(),
    };

    // Store in database
    try {
      const dbRecord = await prisma.aiUsageRecord.create({
        data: {
          userId: usage.userId,
          caseId: usage.caseId,
          type: usage.type,
          provider: usage.provider,
          quantity: usage.quantity,
          unit: usage.unit,
          baseCostCents,
          markupCents,
          totalCostCents,
          metadata: usage.metadata || {},
        },
      });
      record.id = dbRecord.id;
    } catch (error) {
      logger.error('Failed to record AI usage', { error, usage });
    }

    // Deduct from user balance
    await this.deductFromBalance(usage.userId, totalCostCents);

    logger.info('AI usage recorded', {
      userId: usage.userId,
      type: usage.type,
      provider: usage.provider,
      costCents: totalCostCents,
    });

    return record;
  }

  /**
   * Calculate base cost for usage
   */
  calculateBaseCost(type: UsageType, provider: string, quantity: number): number {
    switch (type) {
      case 'llm': {
        const rates = AI_COSTS.llm[provider as keyof typeof AI_COSTS.llm];
        if (!rates) return 0;
        // Assume 50/50 split input/output for simplicity
        const avgRate = (rates.input + rates.output) / 2;
        return Math.round((quantity / 1000000) * avgRate);
      }
      case 'stt': {
        const rate = AI_COSTS.stt[provider as keyof typeof AI_COSTS.stt] || AI_COSTS.stt.whisper;
        return Math.round(quantity * rate); // quantity in minutes
      }
      case 'tts': {
        const rate = AI_COSTS.tts[provider as keyof typeof AI_COSTS.tts] || AI_COSTS.tts.elevenlabs;
        return Math.round((quantity / 1000) * rate); // quantity in characters
      }
      case 'document': {
        return Math.round(quantity * AI_COSTS.document.extraction_per_doc);
      }
      case 'skip_trace': {
        const rate = AI_COSTS.skipTrace[provider as keyof typeof AI_COSTS.skipTrace] || AI_COSTS.skipTrace.basic;
        return Math.round(quantity * rate);
      }
      case 'notary': {
        const rate = AI_COSTS.notary[provider as keyof typeof AI_COSTS.notary] || AI_COSTS.notary.standard;
        return Math.round(quantity * rate);
      }
      case 'email': {
        const rate = AI_COSTS.email[provider as keyof typeof AI_COSTS.email] || AI_COSTS.email.transactional;
        return Math.round(quantity * rate);
      }
      default:
        return 0;
    }
  }

  /**
   * Record LLM usage specifically (convenience method)
   */
  async recordLlmUsage(
    userId: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    caseId?: string
  ): Promise<UsageRecord> {
    const rates = AI_COSTS.llm[provider as keyof typeof AI_COSTS.llm] || AI_COSTS.llm.openai_gpt4o_mini;
    const inputCost = Math.round((inputTokens / 1000000) * rates.input);
    const outputCost = Math.round((outputTokens / 1000000) * rates.output);
    const baseCostCents = inputCost + outputCost;
    const markupCents = Math.round(baseCostCents * (PLATFORM_MARKUP_PERCENT / 100));

    return this.recordUsage({
      userId,
      caseId,
      type: 'llm',
      provider,
      quantity: inputTokens + outputTokens,
      unit: 'tokens',
      metadata: { inputTokens, outputTokens, inputCost, outputCost },
    });
  }

  /**
   * Get user balance
   */
  async getUserBalance(userId: string): Promise<UserBalance> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          aiCreditBalanceCents: true,
          aiAutoRecharge: true,
          aiAutoRechargeThreshold: true,
          aiAutoRechargeAmount: true,
        },
      });

      // Get this month's usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyUsage = await prisma.aiUsageRecord.aggregate({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalCostCents: true },
      });

      return {
        userId,
        creditBalanceCents: user?.aiCreditBalanceCents || 0,
        usageThisMonthCents: monthlyUsage._sum.totalCostCents || 0,
        pendingChargesCents: 0,
        autoRechargeEnabled: user?.aiAutoRecharge || false,
        autoRechargeThresholdCents: user?.aiAutoRechargeThreshold || 500,
        autoRechargeAmountCents: user?.aiAutoRechargeAmount || 2000,
      };
    } catch (error) {
      return {
        userId,
        creditBalanceCents: 0,
        usageThisMonthCents: 0,
        pendingChargesCents: 0,
        autoRechargeEnabled: false,
        autoRechargeThresholdCents: 500,
        autoRechargeAmountCents: 2000,
      };
    }
  }

  /**
   * Add credits to user balance
   */
  async addCredits(userId: string, amountCents: number, paymentMethod: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          aiCreditBalanceCents: { increment: amountCents },
        },
      });

      // Log the top-up
      await prisma.ledgerEntry.create({
        data: {
          caseId: (await prisma.case.findFirst({ select: { id: true } }))?.id || '', // System entry
          type: 'ADJUSTMENT',
          status: 'COMPLETED',
          amountCents,
          displayedAmountCents: amountCents,
          description: `AI Credits top-up via ${paymentMethod}`,
          userId,
          metadata: { type: 'ai_credits_topup', paymentMethod },
        },
      });

      logger.info('AI credits added', { userId, amountCents });
      return true;
    } catch (error) {
      logger.error('Failed to add AI credits', { error, userId, amountCents });
      return false;
    }
  }

  /**
   * Deduct from user balance
   */
  private async deductFromBalance(userId: string, amountCents: number): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiCreditBalanceCents: true, aiAutoRecharge: true, aiAutoRechargeThreshold: true, aiAutoRechargeAmount: true },
      });

      if (!user) return;

      // Deduct
      await prisma.user.update({
        where: { id: userId },
        data: {
          aiCreditBalanceCents: { decrement: amountCents },
        },
      });

      // Check for auto-recharge
      const newBalance = (user.aiCreditBalanceCents || 0) - amountCents;
      if (user.aiAutoRecharge && newBalance < (user.aiAutoRechargeThreshold || 500)) {
        const rechargeAmount = user.aiAutoRechargeAmount || 2000; // Default $20
        try {
          await prisma.user.update({
            where: { id: userId },
            data: {
              aiCreditBalanceCents: { increment: rechargeAmount },
            },
          });

          // Log the recharge as a billing event
          await prisma.aiUsageRecord.create({
            data: {
              userId,
              type: 'credit_topup',
              provider: 'auto_recharge',
              quantity: 1,
              unit: 'recharge',
              baseCostCents: rechargeAmount,
              markupCents: 0,
              totalCostCents: rechargeAmount,
              metadata: { trigger: 'auto_recharge', previousBalance: newBalance, newBalance: newBalance + rechargeAmount },
            },
          });

          logger.info('Auto-recharge completed', { userId, rechargeAmount, previousBalance: newBalance });
        } catch (rechargeError) {
          logger.error('Auto-recharge failed', { error: rechargeError, userId, rechargeAmount });
        }
      }
    } catch (error) {
      logger.error('Failed to deduct from balance', { error, userId, amountCents });
    }
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(userId: string, period: 'day' | 'week' | 'month' | 'all' = 'month'): Promise<UsageSummary> {
    let startDate: Date | undefined;
    const now = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setDate(1));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'all':
        startDate = undefined;
        break;
    }

    const whereClause: any = { userId };
    if (startDate) {
      whereClause.createdAt = { gte: startDate };
    }

    const records = await prisma.aiUsageRecord.findMany({
      where: whereClause,
      select: {
        type: true,
        provider: true,
        totalCostCents: true,
        caseId: true,
      },
    });

    const byType: Record<UsageType, number> = {
      llm: 0, stt: 0, tts: 0, document: 0, skip_trace: 0, notary: 0, email: 0,
    };
    const byProvider: Record<string, number> = {};
    const byCaseMap = new Map<string, number>();

    let totalCostCents = 0;

    for (const record of records) {
      totalCostCents += record.totalCostCents;
      byType[record.type as UsageType] = (byType[record.type as UsageType] || 0) + record.totalCostCents;
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.totalCostCents;
      if (record.caseId) {
        byCaseMap.set(record.caseId, (byCaseMap.get(record.caseId) || 0) + record.totalCostCents);
      }
    }

    const topCases = Array.from(byCaseMap.entries())
      .map(([caseId, costCents]) => ({ caseId, costCents }))
      .sort((a, b) => b.costCents - a.costCents)
      .slice(0, 10);

    return {
      userId,
      period,
      totalCostCents,
      byType,
      byProvider,
      topCases,
    };
  }

  /**
   * Get pricing info for display
   */
  getPricing(): {
    markup: number;
    llm: typeof AI_COSTS.llm;
    stt: typeof AI_COSTS.stt;
    tts: typeof AI_COSTS.tts;
    skipTrace: typeof AI_COSTS.skipTrace;
    notary: typeof AI_COSTS.notary;
    email: typeof AI_COSTS.email;
  } {
    return {
      markup: PLATFORM_MARKUP_PERCENT,
      llm: AI_COSTS.llm,
      stt: AI_COSTS.stt,
      tts: AI_COSTS.tts,
      skipTrace: AI_COSTS.skipTrace,
      notary: AI_COSTS.notary,
      email: AI_COSTS.email,
    };
  }

  /**
   * Estimate cost before execution
   */
  estimateCost(type: UsageType, provider: string, quantity: number): {
    baseCostCents: number;
    markupCents: number;
    totalCostCents: number;
  } {
    const baseCostCents = this.calculateBaseCost(type, provider, quantity);
    const markupCents = Math.round(baseCostCents * (PLATFORM_MARKUP_PERCENT / 100));
    return {
      baseCostCents,
      markupCents,
      totalCostCents: baseCostCents + markupCents,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const aiUsageBillingService = new AiUsageBillingService();
export default aiUsageBillingService;
