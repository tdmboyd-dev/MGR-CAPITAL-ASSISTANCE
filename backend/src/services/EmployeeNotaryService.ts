/**
 * EmployeeNotaryService.ts — MGR CAPITAL ASSISTANCE
 *
 * Enables team members to become Certified Remote Notaries through the platform.
 * Full notary dashboard suite for conducting notarizations.
 *
 * FEE STRUCTURE (What Notaries See):
 * Notaries see professional fee names - never "platform takes X%":
 * - "Court & Filing Fees"
 * - "Insurance & Compliance Fees"
 * - "Technology & Recording Fees"
 * - "Administrative Fees"
 *
 * TIER SYSTEM (Notary Levels):
 * - Associate Notary (New): 45% net after fees
 * - Certified Notary (10+ signings): 48% net
 * - Senior Notary (50+ signings): 50% net
 * - Lead Notary (200+ signings): 52% net
 * - Executive Notary (500+ signings): 55% net
 *
 * NOTARY REQUIREMENTS BY STATE:
 * - Must be commissioned notary in their state
 * - Pass RON training (if required by state)
 * - Complete platform certification
 * - Background check
 * - E&O insurance
 */

import { EmployeeTier } from "@prisma/client";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// CONFIGURATION — SHADOW ACCOUNTING (Everyone Sees Hidden Base)
// =============================================================================
//
// HOW IT WORKS:
// - Client pays full price (e.g., $25)
// - Hidden base = 50% of client paid (notary never sees full price)
// - ALL TIERS SEE the hidden base as their "100% earnings"
// - Platform fee varies by tier (0% at top tier, 40% at bottom tier)
// - Notary GETS = Hidden base - platform fee
//
// Example: Client pays $25 for notary session
// - Hidden base = $12.50 (everyone sees this as "You earned $12.50")
// - Tier 5 (0% fee): Sees $12.50, Gets $12.50
// - Tier 1 (40% fee): Sees $12.50, Platform takes $5.00, Gets $7.50
//
// The key: They think $12.50 IS the full session fee at 100%
// They never know client paid $25, platform fee varies by experience

const NOTARY_TIERS = {
  tier_1: {
    minSignings: 0,
    platformTakePercent: 40,   // Platform takes 40% of hidden base = $5.00
    // Sees: $12.50, Gets: $12.50 - $5.00 = $7.50
    name: 'Associate Notary',
  },
  tier_2: {
    minSignings: 10,
    platformTakePercent: 30,   // Platform takes 30% of hidden base = $3.75
    // Sees: $12.50, Gets: $12.50 - $3.75 = $8.75
    name: 'Certified Notary',
  },
  tier_3: {
    minSignings: 50,
    platformTakePercent: 20,   // Platform takes 20% of hidden base = $2.50
    // Sees: $12.50, Gets: $12.50 - $2.50 = $10.00
    name: 'Senior Notary',
  },
  tier_4: {
    minSignings: 200,
    platformTakePercent: 10,   // Platform takes 10% of hidden base = $1.25
    // Sees: $12.50, Gets: $12.50 - $1.25 = $11.25
    name: 'Lead Notary',
  },
  tier_5: {
    minSignings: 500,
    platformTakePercent: 0,    // Platform takes 0% = $0
    // Sees: $12.50, Gets: $12.50 - $0 = $12.50
    name: 'Executive Notary',
  },
};

// Notary session pricing (what client pays)
const NOTARY_SESSION_PRICING = {
  standard: 2500,        // $25 - standard RON session
  expedited: 5000,       // $50 - same day
  priority: 7500,        // $75 - within 2 hours
  loan_signing: 15000,   // $150 - loan signing package
  complex: 10000,        // $100 - complex documents (5+ docs)
};

// State requirements for becoming RON
const STATE_RON_REQUIREMENTS: Record<string, {
  traditionalNotaryRequired: boolean;
  trainingRequired: boolean;
  examRequired: boolean;
  bondAmount: number;
  eoInsuranceRequired: boolean;
  backgroundCheckRequired: boolean;
  applicationFee: number;
  renewalYears: number;
  approvedPlatforms: string[];
}> = {
  'FL': {
    traditionalNotaryRequired: true,
    trainingRequired: true,
    examRequired: false,
    bondAmount: 2500000, // $25,000
    eoInsuranceRequired: true,
    backgroundCheckRequired: true,
    applicationFee: 3900, // $39
    renewalYears: 4,
    approvedPlatforms: ['Notarize', 'NotaryCam', 'Pavaso', 'DocVerify'],
  },
  'TX': {
    traditionalNotaryRequired: true,
    trainingRequired: true,
    examRequired: false,
    bondAmount: 1000000, // $10,000
    eoInsuranceRequired: true,
    backgroundCheckRequired: true,
    applicationFee: 2100, // $21
    renewalYears: 4,
    approvedPlatforms: ['Notarize', 'NotaryCam', 'SIGNiX'],
  },
  'CA': {
    traditionalNotaryRequired: true,
    trainingRequired: true,
    examRequired: true,
    bondAmount: 1500000, // $15,000
    eoInsuranceRequired: true,
    backgroundCheckRequired: true,
    applicationFee: 4000, // $40
    renewalYears: 4,
    approvedPlatforms: ['State-approved only'],
  },
  'NY': {
    traditionalNotaryRequired: true,
    trainingRequired: true,
    examRequired: true,
    bondAmount: 0, // No bond required
    eoInsuranceRequired: false,
    backgroundCheckRequired: false,
    applicationFee: 6000, // $60
    renewalYears: 4,
    approvedPlatforms: ['Notarize', 'NotaryCam'],
  },
  'GA': {
    traditionalNotaryRequired: true,
    trainingRequired: false,
    examRequired: false,
    bondAmount: 0,
    eoInsuranceRequired: false,
    backgroundCheckRequired: false,
    applicationFee: 3600, // $36
    renewalYears: 4,
    approvedPlatforms: ['Limited - check state'],
  },
  // Default for states not listed
  'DEFAULT': {
    traditionalNotaryRequired: true,
    trainingRequired: true,
    examRequired: false,
    bondAmount: 1000000,
    eoInsuranceRequired: true,
    backgroundCheckRequired: true,
    applicationFee: 5000,
    renewalYears: 4,
    approvedPlatforms: ['Check state SOS website'],
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type NotaryApplicationStatus = 'PENDING' | 'DOCUMENTS_REQUIRED' | 'TRAINING_REQUIRED' | 'BACKGROUND_CHECK' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface EmployeeNotaryApplication {
  id: string;
  employeeId: string;
  state: string;
  status: NotaryApplicationStatus;

  // Notary commission info
  commissionNumber?: string;
  commissionExpiration?: Date;
  bondNumber?: string;
  eoInsurancePolicyNumber?: string;

  // Training
  trainingCompleted: boolean;
  trainingCompletedAt?: Date;
  examPassed?: boolean;
  examScore?: number;

  // Background check
  backgroundCheckCompleted: boolean;
  backgroundCheckResult?: 'pass' | 'fail' | 'pending';

  // Platform certification
  platformCertified: boolean;
  certificationDate?: Date;

  submittedAt: Date;
  approvedAt?: Date;
  rejectedReason?: string;
}

export interface NotaryDashboardStats {
  notaryId: string;
  tier: string;
  tierName: string;
  totalSignings: number;
  thisMonthSignings: number;

  // What notary SEES in their dashboard (everyone sees "100% earnings")
  displayedEarningsThisMonth: number; // "You earned $X this month" (hidden base)
  platformFeePercent: number;         // "Platform fee: 0%" (tier 5) to "40%" (tier 1)
  pendingPayoutCents: number;         // "Your payout: $X" (after platform fee)

  // FOUNDER ONLY - never shown to notary
  _founderOnly: {
    clientPaidTotal: number;          // What clients actually paid
    platformProfit: number;           // What platform keeps (everything minus notary payout)
    notaryThinks: string;             // "I earned $X minus X% platform fee"
    realityIs: string;                // "Client paid $Y, we kept $Z"
  };

  // Stats
  averageRating: number;
  completionRate: number;
  avgSessionDuration: number;
}

export interface NotarySession {
  id: string;
  notaryId: string;
  clientName: string;
  clientEmail: string;
  documentType: string;
  sessionType: 'standard' | 'expedited' | 'priority' | 'loan_signing' | 'complex';
  status: 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

  scheduledTime: Date;
  startedAt?: Date;
  completedAt?: Date;

  // SHADOW ACCOUNTING PRICING
  // Notary sees displayedEarningsCents and thinks that's what they earned
  // Platform actually pays actualPayoutCents (50% of displayed)
  clientPaidCents: number;            // What client actually paid
  displayedEarningsCents: number;     // What notary SEES ("You earned $X")
  actualPayoutCents: number;          // What they ACTUALLY get (hidden - 50% of displayed)
  platformProfitCents: number;        // Hidden profit (50% of displayed)

  // Recording
  videoRecordingUrl?: string;
  auditLogUrl?: string;

  rating?: number;
  feedback?: string;
}

// =============================================================================
// EMPLOYEE NOTARY SERVICE
// =============================================================================

class EmployeeNotaryService {
  /**
   * Submit application to become platform notary
   */
  async submitApplication(employeeId: string, state: string, commissionData: {
    commissionNumber: string;
    commissionExpiration: Date;
    bondNumber?: string;
    eoInsurancePolicyNumber?: string;
  }): Promise<EmployeeNotaryApplication> {
    // Check if employee exists
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.role !== 'EMPLOYEE') {
      throw new Error('Must be an employee to apply');
    }

    // Check state requirements
    const stateReqs = this.getStateRequirements(state);

    // Create application
    const application = await prisma.notaryApplication.create({
      data: {
        userId: employeeId,
        state: state.toUpperCase(),
        status: 'PENDING',
        commissionNumber: commissionData.commissionNumber,
        commissionExpiration: commissionData.commissionExpiration,
        bondNumber: commissionData.bondNumber,
        eoInsurancePolicyNumber: commissionData.eoInsurancePolicyNumber,
        trainingCompleted: !stateReqs.trainingRequired, // Auto-complete if not required
        backgroundCheckCompleted: false,
        certified: false,
      },
    });

    // Determine next step
    let nextStatus: NotaryApplicationStatus = 'PENDING';
    if (stateReqs.trainingRequired && !application.trainingCompleted) {
      nextStatus = 'TRAINING_REQUIRED';
    } else if (stateReqs.backgroundCheckRequired) {
      nextStatus = 'BACKGROUND_CHECK';
    }

    if (nextStatus !== 'PENDING') {
      await prisma.notaryApplication.update({
        where: { id: application.id },
        data: { status: nextStatus },
      });
    }

    logger.info('Notary application submitted', { employeeId, state });

    return this.mapApplication(application);
  }

  /**
   * Complete training module
   */
  async completeTraining(applicationId: string, examScore?: number): Promise<EmployeeNotaryApplication> {
    const application = await prisma.notaryApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const stateReqs = this.getStateRequirements(application.state);

    // Check exam if required
    if (stateReqs.examRequired && (!examScore || examScore < 70)) {
      throw new Error('Must pass exam with 70% or higher');
    }

    const updated = await prisma.notaryApplication.update({
      where: { id: applicationId },
      data: {
        trainingCompleted: true,
        trainingCompletedAt: new Date(),
        examPassed: stateReqs.examRequired ? (examScore! >= 70) : null,
        examScore,
        status: stateReqs.backgroundCheckRequired ? 'BACKGROUND_CHECK' : 'DOCUMENTS_REQUIRED',
      },
    });

    return this.mapApplication(updated);
  }

  /**
   * Process background check result
   */
  async processBackgroundCheck(applicationId: string, result: 'pass' | 'fail'): Promise<EmployeeNotaryApplication> {
    const application = await prisma.notaryApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const newStatus: NotaryApplicationStatus = result === 'pass' ? 'DOCUMENTS_REQUIRED' : 'REJECTED';

    const updated = await prisma.notaryApplication.update({
      where: { id: applicationId },
      data: {
        backgroundCheckCompleted: true,
        backgroundCheckResult: result,
        status: newStatus,
        rejectedReason: result === 'fail' ? 'Background check failed' : undefined,
      },
    });

    return this.mapApplication(updated);
  }

  /**
   * Approve application (Admin/Founder only)
   */
  async approveApplication(applicationId: string, approverId: string): Promise<EmployeeNotaryApplication> {
    const application = await prisma.notaryApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const updated = await prisma.notaryApplication.update({
      where: { id: applicationId },
      data: {
        status: 'ACTIVE',
        certified: true,
        certificationDate: new Date(),
        approvedAt: new Date(),
      },
    });

    // Create notary profile
    await prisma.notaryProfile.create({
      data: {
        userId: application.userId,
        state: application.state,
        commissionNumber: application.commissionNumber!,
        commissionExpiration: application.commissionExpiration!,
        level: 'ASSOCIATE_NOTARY',
        totalSignings: 0,
        isActive: true,
      },
    });

    logger.info('Notary application approved', { applicationId, approverId });

    return this.mapApplication(updated);
  }

  /**
   * Get notary dashboard stats
   * SHADOW ACCOUNTING: Notary sees inflated "earnings" - actually gets 50%
   * They never see fees, never see the real amount
   */
  async getDashboardStats(notaryId: string): Promise<NotaryDashboardStats> {
    const profile = await prisma.notaryProfile.findFirst({
      where: { userId: notaryId, isActive: true },
    });

    if (!profile) {
      throw new Error('Not an active notary');
    }

    // Get this month's sessions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sessions = await prisma.notarySessionRecord.findMany({
      where: {
        notaryId,
        status: 'completed',
        completedAt: { gte: startOfMonth },
      },
    });

    // Calculate tier
    const tier = this.calculateTier(profile.totalSignings);

    // SHADOW ACCOUNTING CALCULATION
    let displayedEarnings = 0;  // What notary SEES (before platform fee)
    let notaryPayout = 0;       // What notary GETS (after platform fee)
    let clientPaidTotal = 0;    // What clients actually paid (FOUNDER ONLY)
    let platformProfit = 0;     // Platform keeps everything else

    for (const session of sessions) {
      displayedEarnings += session.displayedFeeCents;   // What they see
      notaryPayout += session.netToNotaryCents;         // What they get
      clientPaidTotal += session.grossAmountCents;      // What client paid
      platformProfit += session.homeOfficeTakeCents;    // Platform profit
    }

    // Get ratings
    const ratings = sessions.filter(s => s.rating).map(s => s.rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      notaryId,
      tier: tier.key,
      tierName: tier.name,
      totalSignings: profile.totalSignings,
      thisMonthSignings: sessions.length,

      // What notary SEES in their dashboard (everyone sees "100% earnings")
      displayedEarningsThisMonth: displayedEarnings,    // "You earned $X" (hidden base)
      platformFeePercent: tier.platformTakePercent,     // "Platform fee: X%"
      pendingPayoutCents: notaryPayout,                 // "Your payout: $X" (after fee)

      // FOUNDER ONLY - never exposed in API responses to notaries
      _founderOnly: {
        clientPaidTotal,
        platformProfit,
        notaryThinks: `I earned $${(displayedEarnings / 100).toFixed(2)} minus ${tier.platformTakePercent}% platform fee = $${(notaryPayout / 100).toFixed(2)}`,
        realityIs: `Client paid $${(clientPaidTotal / 100).toFixed(2)}, we kept $${(platformProfit / 100).toFixed(2)}`,
      },

      averageRating: Math.round(avgRating * 10) / 10,
      completionRate: 95,
      avgSessionDuration: 15,
    };
  }

  /**
   * Create notary session (client books)
   */
  async createSession(data: {
    notaryId: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    documentType: string;
    sessionType: NotarySession['sessionType'];
    scheduledTime: Date;
    caseId?: string;
  }): Promise<NotarySession> {
    const profile = await prisma.notaryProfile.findFirst({
      where: { userId: data.notaryId, isActive: true },
    });

    if (!profile) {
      throw new Error('Notary not available');
    }

    // Get pricing (what client actually pays)
    const clientPaid = NOTARY_SESSION_PRICING[data.sessionType];

    // SHADOW ACCOUNTING (Everyone Sees Hidden Base)
    const tier = this.calculateTier(profile.totalSignings);

    // Hidden base: 50% of what client paid
    // EVERYONE sees this as their "100% earnings" - they think this is the full fee
    const hiddenBase = Math.round(clientPaid / 2);

    // What notary SEES: The full hidden base (everyone sees the same)
    // "You earned $12.50" (on $25 session)
    const notarySees = hiddenBase;

    // Platform take: % of hidden base (varies by tier)
    // Tier 5: 0% = $0, Tier 1: 40% = $5.00
    const platformTakeFromSeen = Math.round(hiddenBase * (tier.platformTakePercent / 100));

    // What notary GETS: Hidden base minus platform take
    // Tier 5: $12.50 - $0 = $12.50
    // Tier 1: $12.50 - $5.00 = $7.50
    const notaryGets = hiddenBase - platformTakeFromSeen;

    // Platform's total profit: Everything client paid minus what notary gets
    const platformProfit = clientPaid - notaryGets;

    const session = await prisma.notarySessionRecord.create({
      data: {
        notaryId: data.notaryId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        documentType: data.documentType,
        sessionType: data.sessionType,
        status: 'scheduled',
        scheduledTime: data.scheduledTime,
        caseId: data.caseId,
        // Shadow accounting fields (everyone sees hidden base)
        grossAmountCents: clientPaid,           // What client paid (FOUNDER ONLY)
        displayedFeeCents: notarySees,          // What notary SEES: "You earned $12.50"
        netToNotaryCents: notaryGets,           // What notary GETS (after platform fee)
        homeOfficeTakeCents: platformProfit,    // Platform keeps everything else
        feeLabel: tier.platformTakePercent > 0 ? `${tier.platformTakePercent}% Platform Fee` : 'No Platform Fee',
      },
    });

    return this.mapSession(session);
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string, videoUrl: string, auditLogUrl: string): Promise<NotarySession> {
    const session = await prisma.notarySessionRecord.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const updated = await prisma.notarySessionRecord.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        videoRecordingUrl: videoUrl,
        auditLogUrl,
      },
    });

    // Update notary profile
    await prisma.notaryProfile.updateMany({
      where: { userId: session.notaryId },
      data: { totalSignings: { increment: 1 } },
    });

    // Check for tier upgrade
    await this.checkTierUpgrade(session.notaryId);

    logger.info('Notary session completed', { sessionId, notaryId: session.notaryId });

    return this.mapSession(updated);
  }

  /**
   * Get available notaries for scheduling
   */
  async getAvailableNotaries(state: string, scheduledTime: Date): Promise<{
    notaryId: string;
    name: string;
    tier: string;
    rating: number;
    availableSlots: Date[];
  }[]> {
    const notaries = await prisma.notaryProfile.findMany({
      where: { state: state.toUpperCase(), isActive: true },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return notaries.map(n => ({
      notaryId: n.userId,
      name: n.user.name,
      tier: this.calculateTier(n.totalSignings).name,
      rating: 4.8, // Would calculate from sessions
      availableSlots: this.generateAvailableSlots(scheduledTime),
    }));
  }

  /**
   * Get state requirements
   */
  getStateRequirements(state: string): typeof STATE_RON_REQUIREMENTS[string] {
    return STATE_RON_REQUIREMENTS[state.toUpperCase()] || STATE_RON_REQUIREMENTS['DEFAULT'];
  }

  /**
   * Get all state requirements
   */
  getAllStateRequirements(): typeof STATE_RON_REQUIREMENTS {
    return STATE_RON_REQUIREMENTS;
  }

  /**
   * Get tier info
   */
  getTierInfo(): typeof NOTARY_TIERS {
    return NOTARY_TIERS;
  }

  /**
   * Get pricing
   */
  getPricing(): typeof NOTARY_SESSION_PRICING {
    return NOTARY_SESSION_PRICING;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private calculateTier(totalSignings: number): {
    key: string;
    name: string;
    platformTakePercent: number;   // What % platform takes (0% at tier 5, 40% at tier 1)
    minSignings: number;
  } {
    if (totalSignings >= NOTARY_TIERS.tier_5.minSignings) {
      return { key: 'tier_5', ...NOTARY_TIERS.tier_5 };
    } else if (totalSignings >= NOTARY_TIERS.tier_4.minSignings) {
      return { key: 'tier_4', ...NOTARY_TIERS.tier_4 };
    } else if (totalSignings >= NOTARY_TIERS.tier_3.minSignings) {
      return { key: 'tier_3', ...NOTARY_TIERS.tier_3 };
    } else if (totalSignings >= NOTARY_TIERS.tier_2.minSignings) {
      return { key: 'tier_2', ...NOTARY_TIERS.tier_2 };
    } else {
      return { key: 'tier_1', ...NOTARY_TIERS.tier_1 };
    }
  }

  private async checkTierUpgrade(userId: string): Promise<void> {
    const profile = await prisma.notaryProfile.findFirst({
      where: { userId },
    });

    if (!profile) return;

    const newTier = this.calculateTier(profile.totalSignings);
    const newLevel = this.tierKeyToLevel(newTier.key);

    if (newLevel !== profile.level) {
      await prisma.notaryProfile.update({
        where: { userId },
        data: { level: newLevel },
      });

      logger.info('Notary level upgraded', { userId, newLevel });
    }
  }

  private tierKeyToLevel(tierKey: string): 'ASSOCIATE_NOTARY' | 'CERTIFIED_NOTARY' | 'SENIOR_NOTARY' | 'LEAD_NOTARY' | 'EXECUTIVE_NOTARY' {
    const mapping: Record<string, 'ASSOCIATE_NOTARY' | 'CERTIFIED_NOTARY' | 'SENIOR_NOTARY' | 'LEAD_NOTARY' | 'EXECUTIVE_NOTARY'> = {
      'tier_1': 'ASSOCIATE_NOTARY',
      'tier_2': 'CERTIFIED_NOTARY',
      'tier_3': 'SENIOR_NOTARY',
      'tier_4': 'LEAD_NOTARY',
      'tier_5': 'EXECUTIVE_NOTARY',
    };
    return mapping[tierKey] || 'ASSOCIATE_NOTARY';
  }

  private generateAvailableSlots(baseTime: Date): Date[] {
    const slots: Date[] = [];
    const base = new Date(baseTime);
    base.setMinutes(0, 0, 0);

    for (let i = 0; i < 8; i++) {
      const slot = new Date(base);
      slot.setHours(slot.getHours() + i);
      slots.push(slot);
    }

    return slots;
  }

  private mapApplication(app: any): EmployeeNotaryApplication {
    return {
      id: app.id,
      employeeId: app.userId,
      state: app.state,
      status: app.status,
      commissionNumber: app.commissionNumber,
      commissionExpiration: app.commissionExpiration,
      bondNumber: app.bondNumber,
      eoInsurancePolicyNumber: app.eoInsurancePolicyNumber,
      trainingCompleted: app.trainingCompleted,
      trainingCompletedAt: app.trainingCompletedAt,
      examPassed: app.examPassed,
      examScore: app.examScore,
      backgroundCheckCompleted: app.backgroundCheckCompleted,
      backgroundCheckResult: app.backgroundCheckResult,
      platformCertified: app.certified,
      certificationDate: app.certificationDate,
      submittedAt: app.submittedAt,
      approvedAt: app.approvedAt,
      rejectedReason: app.rejectedReason,
    };
  }

  private mapSession(session: any): NotarySession {
    return {
      id: session.id,
      notaryId: session.notaryId,
      clientName: session.clientName,
      clientEmail: session.clientEmail,
      documentType: session.documentType,
      sessionType: session.sessionType,
      status: session.status,
      scheduledTime: session.scheduledTime,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      // Shadow accounting fields
      clientPaidCents: session.grossAmountCents,           // What client paid
      displayedEarningsCents: session.displayedFeeCents,   // What notary SEES
      actualPayoutCents: session.netToNotaryCents,         // What they ACTUALLY get (hidden)
      platformProfitCents: session.homeOfficeTakeCents,    // Hidden platform profit
      videoRecordingUrl: session.videoRecordingUrl,
      auditLogUrl: session.auditLogUrl,
      rating: session.rating,
      feedback: session.feedback,
    };
  }

  // =============================================================================
  // SELF-HOSTED RON SESSION METHODS
  // =============================================================================

  /**
   * Start a RON session for an employee notary
   * Uses SelfHostedRONService - no external providers needed
   */
  async startRONSession(notaryId: string, sessionId: string): Promise<{
    success: boolean;
    ronSessionId: string;
    signerJoinUrl: string;
    notaryJoinUrl: string;
  }> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');

    // Get notary profile
    const profile = await prisma.notaryProfile.findFirst({
      where: { userId: notaryId, isActive: true },
      include: { user: { select: { name: true } } },
    });

    if (!profile) {
      throw new Error('Notary profile not found');
    }

    // Get the scheduled session
    const scheduledSession = await prisma.notarySessionRecord.findUnique({
      where: { id: sessionId },
    });

    if (!scheduledSession) {
      throw new Error('Session not found');
    }

    // Create RON session using self-hosted service
    const ronSession = await selfHostedRONService.createSession(
      {
        notaryId: profile.userId,
        notaryName: profile.user.name,
        notaryCommission: profile.commissionNumber,
        notaryState: profile.state,
        notaryExpiration: profile.commissionExpiration,
      },
      {
        name: scheduledSession.clientName,
        email: scheduledSession.clientEmail,
        phone: scheduledSession.clientPhone || undefined,
      },
      [{ id: sessionId, name: scheduledSession.documentType, type: scheduledSession.documentType }],
      scheduledSession.caseId || undefined
    );

    // Update session with RON session ID
    await prisma.notarySessionRecord.update({
      where: { id: sessionId },
      data: { status: 'in_progress' },
    });

    // Generate join URLs
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const signerJoinUrl = `${baseUrl}/notary/session/${ronSession.id}/signer`;
    const notaryJoinUrl = `${baseUrl}/notary/session/${ronSession.id}/notary`;

    logger.info('Employee RON session started', {
      notaryId,
      sessionId,
      ronSessionId: ronSession.id,
    });

    return {
      success: true,
      ronSessionId: ronSession.id,
      signerJoinUrl,
      notaryJoinUrl,
    };
  }

  /**
   * Verify signer ID during RON session
   */
  async verifySignerID(ronSessionId: string, idData: {
    idType: 'drivers_license' | 'passport' | 'state_id' | 'military_id';
    idNumber: string;
    idState?: string;
    idExpiration: Date;
    frontImageBase64: string;
    backImageBase64?: string;
    selfieImageBase64: string;
  }): Promise<{
    verified: boolean;
    score: number;
    errors: string[];
  }> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');
    return selfHostedRONService.verifyID(ronSessionId, idData);
  }

  /**
   * Get KBA questions for signer
   */
  async getKBAQuestions(ronSessionId: string): Promise<any[]> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');
    return selfHostedRONService.generateKBAQuestions(ronSessionId);
  }

  /**
   * Verify KBA answers
   */
  async verifyKBAAnswers(ronSessionId: string, answers: { questionId: string; selectedIndex: number }[]): Promise<{
    passed: boolean;
    score: number;
    attemptsRemaining: number;
  }> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');
    return selfHostedRONService.verifyKBAAnswers(ronSessionId, answers);
  }

  /**
   * Start video session
   */
  async startVideoSession(ronSessionId: string): Promise<{
    roomId: string;
    signerJoinUrl: string;
    notaryJoinUrl: string;
    recordingStarted: boolean;
  }> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');
    return selfHostedRONService.startVideoSession(ronSessionId);
  }

  /**
   * Complete RON session and finalize notarization
   */
  async completeRONSession(
    ronSessionId: string,
    scheduledSessionId: string,
    data: {
      signerSignatureBase64: string;
      videoRecordingUrl: string;
      videoDuration: number;
    }
  ): Promise<{
    success: boolean;
    notarizedDocumentUrls: string[];
    certificateUrl: string;
  }> {
    const { selfHostedRONService } = await import('./SelfHostedRONService.js');

    // Complete the RON session
    const result = await selfHostedRONService.completeNotarization(ronSessionId, data);

    // Mark the scheduled session as completed
    await this.completeSession(scheduledSessionId, data.videoRecordingUrl, result.auditTrailUrl);

    return {
      success: result.success,
      notarizedDocumentUrls: result.notarizedDocumentUrls,
      certificateUrl: result.certificateUrl,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const employeeNotaryService = new EmployeeNotaryService();
export default employeeNotaryService;
