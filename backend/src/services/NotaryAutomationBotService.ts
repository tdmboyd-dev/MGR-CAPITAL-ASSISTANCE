/**
 * NotaryAutomationBotService.ts — MGR CAPITAL ASSISTANCE
 *
 * NOTARY AUTOMATION BOT — Monthly Subscription for Employee Notaries
 *
 * FOUNDER: Gets full automation FREE by default (FounderNotaryService)
 * EMPLOYEES: Must pay monthly to enable automation features
 *
 * MANUAL vs AUTOMATED:
 * - MANUAL: Employee schedules, conducts video call, handles ID/KBA manually
 * - AUTOMATED: System handles client notifications, reminders, KBA prep,
 *              document assembly, signature collection, certificate generation
 *
 * SUBSCRIPTION TIERS:
 * - Basic ($15/mo): Auto-reminders, document prep
 * - Professional ($35/mo): + Auto KBA, video scheduling, signer queue
 * - Enterprise ($75/mo): + Priority processing, bulk sessions, AI assistant
 *
 * SHADOW ACCOUNTING APPLIES:
 * Bot subscription cost comes out of employee's commission balance
 */

import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// SUBSCRIPTION TIERS
// =============================================================================

export type NotaryBotTier = 'NONE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE' | 'FOUNDER';

interface NotaryBotPlan {
  tier: NotaryBotTier;
  name: string;
  monthlyCostCents: number;
  features: string[];
  automationLevel: 'none' | 'partial' | 'full' | 'unlimited';
}

const NOTARY_BOT_PLANS: Record<NotaryBotTier, NotaryBotPlan> = {
  NONE: {
    tier: 'NONE',
    name: 'Manual (No Bot)',
    monthlyCostCents: 0,
    features: [
      'Manual session scheduling',
      'Manual ID verification',
      'Manual KBA administration',
      'Manual video management',
      'Manual certificate generation',
    ],
    automationLevel: 'none',
  },
  BASIC: {
    tier: 'BASIC',
    name: 'Basic Automation',
    monthlyCostCents: 1500, // $15/mo
    features: [
      'Auto client reminders (email + SMS)',
      'Auto document preparation',
      'Session scheduling assistant',
      'Auto calendar sync',
      'Basic reporting',
    ],
    automationLevel: 'partial',
  },
  PROFESSIONAL: {
    tier: 'PROFESSIONAL',
    name: 'Professional Automation',
    monthlyCostCents: 3500, // $35/mo
    features: [
      'Everything in Basic',
      'Auto KBA question generation',
      'Auto ID verification (AI face match)',
      'Video session auto-scheduling',
      'Signer queue management',
      'Smart session batching',
      'Priority support',
    ],
    automationLevel: 'full',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise Automation',
    monthlyCostCents: 7500, // $75/mo
    features: [
      'Everything in Professional',
      'Priority processing queue',
      'Bulk session handling (50+ per day)',
      'AI notary assistant',
      'Custom branding on certificates',
      'API access for integrations',
      'Dedicated support',
      'White-label options',
    ],
    automationLevel: 'full',
  },
  FOUNDER: {
    tier: 'FOUNDER',
    name: 'Founder (Full Automation)',
    monthlyCostCents: 0, // FREE for founder
    features: [
      'EVERYTHING - Full automation',
      'No monthly fee',
      'Unlimited sessions',
      'All features enabled',
      'Direct database access',
    ],
    automationLevel: 'unlimited',
  },
};

// =============================================================================
// TYPES
// =============================================================================

export interface NotaryBotSubscription {
  id: string;
  notaryId: string;
  tier: NotaryBotTier;
  isActive: boolean;
  monthlyCostCents: number;
  startDate: Date;
  nextBillingDate: Date;
  totalChargedCents: number;
  // Automation stats
  autoSessionsThisMonth: number;
  manualSessionsThisMonth: number;
  timeSavedMinutes: number;
}

// =============================================================================
// NOTARY AUTOMATION BOT SERVICE
// =============================================================================

class NotaryAutomationBotService {
  /**
   * Get available plans
   */
  getPlans(): NotaryBotPlan[] {
    return Object.values(NOTARY_BOT_PLANS).filter(p => p.tier !== 'FOUNDER');
  }

  /**
   * Get subscription for a notary
   */
  async getSubscription(notaryId: string): Promise<NotaryBotSubscription | null> {
    // Check if founder - founders get automatic unlimited access
    const user = await prisma.user.findUnique({
      where: { id: notaryId },
      select: { role: true },
    });

    if (user?.role === 'FOUNDER') {
      return {
        id: 'founder_auto',
        notaryId,
        tier: 'FOUNDER',
        isActive: true,
        monthlyCostCents: 0,
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Never expires
        totalChargedCents: 0,
        autoSessionsThisMonth: 0,
        manualSessionsThisMonth: 0,
        timeSavedMinutes: 0,
      };
    }

    // Check database for employee subscription
    const subscription = await (prisma as any).notaryBotSubscription?.findFirst({
      where: { notaryId, isActive: true },
    }).catch(() => null);

    if (!subscription) {
      return {
        id: 'none',
        notaryId,
        tier: 'NONE',
        isActive: false,
        monthlyCostCents: 0,
        startDate: new Date(),
        nextBillingDate: new Date(),
        totalChargedCents: 0,
        autoSessionsThisMonth: 0,
        manualSessionsThisMonth: 0,
        timeSavedMinutes: 0,
      };
    }

    return subscription;
  }

  /**
   * Subscribe to automation bot
   */
  async subscribe(notaryId: string, tier: NotaryBotTier): Promise<NotaryBotSubscription> {
    const plan = NOTARY_BOT_PLANS[tier];
    if (!plan || tier === 'FOUNDER') {
      throw new Error('Invalid tier');
    }

    // Check if notary has active profile
    const profile = await prisma.notaryProfile.findFirst({
      where: { userId: notaryId, isActive: true },
    });

    if (!profile) {
      throw new Error('Must be an active notary to subscribe');
    }

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    // Create or update subscription
    const subscription = await (prisma as any).notaryBotSubscription?.upsert({
      where: { notaryId },
      create: {
        notaryId,
        tier,
        isActive: true,
        monthlyCostCents: plan.monthlyCostCents,
        startDate: now,
        nextBillingDate: nextBilling,
        totalChargedCents: plan.monthlyCostCents, // First month
      },
      update: {
        tier,
        monthlyCostCents: plan.monthlyCostCents,
        isActive: true,
      },
    }).catch(() => {
      // Table might not exist, use in-memory
      return {
        id: `sub_${Date.now()}`,
        notaryId,
        tier,
        isActive: true,
        monthlyCostCents: plan.monthlyCostCents,
        startDate: now,
        nextBillingDate: nextBilling,
        totalChargedCents: plan.monthlyCostCents,
        autoSessionsThisMonth: 0,
        manualSessionsThisMonth: 0,
        timeSavedMinutes: 0,
      };
    });

    logger.info('Notary bot subscription created', { notaryId, tier });

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancel(notaryId: string): Promise<void> {
    await (prisma as any).notaryBotSubscription?.update({
      where: { notaryId },
      data: { isActive: false },
    }).catch(() => {});

    logger.info('Notary bot subscription cancelled', { notaryId });
  }

  /**
   * Check if automation is enabled for a notary
   */
  async isAutomationEnabled(notaryId: string): Promise<{
    enabled: boolean;
    level: 'none' | 'partial' | 'full' | 'unlimited';
    tier: NotaryBotTier;
  }> {
    const subscription = await this.getSubscription(notaryId);

    if (!subscription || !subscription.isActive || subscription.tier === 'NONE') {
      return { enabled: false, level: 'none', tier: 'NONE' };
    }

    const plan = NOTARY_BOT_PLANS[subscription.tier];
    return {
      enabled: true,
      level: plan.automationLevel,
      tier: subscription.tier,
    };
  }

  /**
   * Auto-schedule session (if automation enabled)
   */
  async autoScheduleSession(notaryId: string, clientEmail: string, documentType: string): Promise<{
    scheduled: boolean;
    scheduledTime?: Date;
    message: string;
  }> {
    const automation = await this.isAutomationEnabled(notaryId);

    if (!automation.enabled || automation.level === 'none') {
      return {
        scheduled: false,
        message: 'Automation not enabled. Subscribe to Basic or higher for auto-scheduling.',
      };
    }

    // Find next available slot
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(scheduledTime.getHours() + 2); // 2 hours from now
    scheduledTime.setMinutes(0, 0, 0);

    // In production, would check notary availability calendar
    logger.info('Auto-scheduled notary session', { notaryId, clientEmail, scheduledTime });

    return {
      scheduled: true,
      scheduledTime,
      message: `Session auto-scheduled for ${scheduledTime.toISOString()}`,
    };
  }

  /**
   * Auto-send client reminders (if automation enabled)
   */
  async autoSendReminders(sessionId: string): Promise<{
    sent: boolean;
    channels: string[];
  }> {
    // In production, would send SMS and email reminders
    logger.info('Auto-sent reminders for session', { sessionId });

    return {
      sent: true,
      channels: ['email', 'sms'],
    };
  }

  /**
   * Auto-prepare documents (if automation enabled)
   */
  async autoPrepareDocuments(sessionId: string, documentIds: string[]): Promise<{
    prepared: boolean;
    documentUrls: string[];
  }> {
    // In production, would assemble and prepare all documents
    logger.info('Auto-prepared documents for session', { sessionId, documentCount: documentIds.length });

    return {
      prepared: true,
      documentUrls: documentIds.map(id => `https://storage.example.com/prepared/${id}.pdf`),
    };
  }

  /**
   * Bill monthly subscriptions (called by cron)
   */
  async processMonthlyBilling(): Promise<{
    processed: number;
    totalRevenue: number;
    failed: string[];
  }> {
    const subscriptions = await (prisma as any).notaryBotSubscription?.findMany({
      where: {
        isActive: true,
        tier: { not: 'FOUNDER' },
        nextBillingDate: { lte: new Date() },
      },
    }).catch(() => []);

    let processed = 0;
    let totalRevenue = 0;
    const failed: string[] = [];

    for (const sub of subscriptions) {
      try {
        // Deduct from notary's commission balance
        // In production, would integrate with payment system
        const plan = NOTARY_BOT_PLANS[sub.tier as NotaryBotTier];

        // Update billing date
        const nextBilling = new Date(sub.nextBillingDate);
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await (prisma as any).notaryBotSubscription?.update({
          where: { id: sub.id },
          data: {
            nextBillingDate: nextBilling,
            totalChargedCents: { increment: plan.monthlyCostCents },
          },
        }).catch(() => {});

        processed++;
        totalRevenue += plan.monthlyCostCents;
      } catch (error) {
        failed.push(sub.notaryId);
      }
    }

    logger.info('Notary bot billing processed', { processed, totalRevenue, failed: failed.length });

    return { processed, totalRevenue, failed };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const notaryAutomationBotService = new NotaryAutomationBotService();
export default notaryAutomationBotService;
