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

import { PrismaClient, EmployeeTier } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

// Fee labels that hide the revenue split (notaries never see "platform" mentioned)
const FEE_LABELS = {
  primary: 'Processing & Compliance Fees',
  breakdown: [
    'Court & Filing Fees',
    'Insurance & Bonding',
    'Technology & Recording',
    'Administrative Processing',
  ],
};

// Notary tier system - what notary actually receives
const NOTARY_TIERS = {
  tier_1: {
    minSignings: 0,
    takeHomePercent: 45,
    displayedFeePercent: 55,
    name: 'Associate Notary',
    feeLabel: FEE_LABELS.primary,
  },
  tier_2: {
    minSignings: 10,
    takeHomePercent: 48,
    displayedFeePercent: 52,
    name: 'Certified Notary',
    feeLabel: FEE_LABELS.primary,
  },
  tier_3: {
    minSignings: 50,
    takeHomePercent: 50,
    displayedFeePercent: 50,
    name: 'Senior Notary',
    feeLabel: FEE_LABELS.primary,
  },
  tier_4: {
    minSignings: 200,
    takeHomePercent: 52,
    displayedFeePercent: 48,
    name: 'Lead Notary',
    feeLabel: FEE_LABELS.primary,
  },
  tier_5: {
    minSignings: 500,
    takeHomePercent: 55,
    displayedFeePercent: 45,
    name: 'Executive Notary',
    feeLabel: FEE_LABELS.primary,
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

export type NotaryApplicationStatus = 'pending' | 'documents_required' | 'training_required' | 'background_check' | 'approved' | 'active' | 'suspended' | 'rejected';

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

  // Earnings (what notary SEES - labeled as professional fees)
  grossEarningsThisMonth: number;
  feesThisMonth: number;           // Labeled as "Processing & Compliance Fees"
  feeLabel: string;                // "Processing & Compliance Fees"
  feeBreakdown: string[];          // ["Court & Filing", "Insurance", etc.]
  netEarningsThisMonth: number;
  pendingPayoutCents: number;

  // FOUNDER ONLY - never shown to notary
  _founderOnly: {
    actualHomeOfficeTake: number;  // What MGR Capital actually keeps
    notaryThinksFeesAre: string;   // What notary thinks fees cover
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

  // Pricing
  grossAmountCents: number;
  displayedFeeCents: number;
  netToNotaryCents: number;
  actualPlatformTakeCents: number;

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
    const application = await prisma.employeeNotaryApplication.create({
      data: {
        employeeId,
        state: state.toUpperCase(),
        status: 'pending',
        commissionNumber: commissionData.commissionNumber,
        commissionExpiration: commissionData.commissionExpiration,
        bondNumber: commissionData.bondNumber,
        eoInsurancePolicyNumber: commissionData.eoInsurancePolicyNumber,
        trainingCompleted: !stateReqs.trainingRequired, // Auto-complete if not required
        backgroundCheckCompleted: false,
        platformCertified: false,
        submittedAt: new Date(),
      },
    });

    // Determine next step
    let nextStatus: NotaryApplicationStatus = 'pending';
    if (stateReqs.trainingRequired && !application.trainingCompleted) {
      nextStatus = 'training_required';
    } else if (stateReqs.backgroundCheckRequired) {
      nextStatus = 'background_check';
    }

    if (nextStatus !== 'pending') {
      await prisma.employeeNotaryApplication.update({
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
    const application = await prisma.employeeNotaryApplication.findUnique({
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

    const updated = await prisma.employeeNotaryApplication.update({
      where: { id: applicationId },
      data: {
        trainingCompleted: true,
        trainingCompletedAt: new Date(),
        examPassed: stateReqs.examRequired ? (examScore! >= 70) : null,
        examScore,
        status: stateReqs.backgroundCheckRequired ? 'background_check' : 'documents_required',
      },
    });

    return this.mapApplication(updated);
  }

  /**
   * Process background check result
   */
  async processBackgroundCheck(applicationId: string, result: 'pass' | 'fail'): Promise<EmployeeNotaryApplication> {
    const application = await prisma.employeeNotaryApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const newStatus: NotaryApplicationStatus = result === 'pass' ? 'documents_required' : 'rejected';

    const updated = await prisma.employeeNotaryApplication.update({
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
    const application = await prisma.employeeNotaryApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const updated = await prisma.employeeNotaryApplication.update({
      where: { id: applicationId },
      data: {
        status: 'active',
        platformCertified: true,
        certificationDate: new Date(),
        approvedAt: new Date(),
      },
    });

    // Create notary profile
    await prisma.employeeNotaryProfile.create({
      data: {
        employeeId: application.employeeId,
        state: application.state,
        commissionNumber: application.commissionNumber!,
        commissionExpiration: application.commissionExpiration!,
        tier: 'tier_1',
        totalSignings: 0,
        isActive: true,
      },
    });

    logger.info('Notary application approved', { applicationId, approverId });

    return this.mapApplication(updated);
  }

  /**
   * Get notary dashboard stats
   * Notary sees professional fee names, never "platform takes X%"
   */
  async getDashboardStats(notaryId: string): Promise<NotaryDashboardStats> {
    const profile = await prisma.employeeNotaryProfile.findFirst({
      where: { employeeId: notaryId, isActive: true },
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

    // Calculate earnings (what notary sees)
    let grossEarnings = 0;
    let displayedFees = 0;
    let actualHomeOfficeTake = 0;

    for (const session of sessions) {
      grossEarnings += session.grossAmountCents;
      displayedFees += session.displayedFeeCents;
      actualHomeOfficeTake += session.actualPlatformTakeCents;
    }

    const netEarnings = grossEarnings - displayedFees;

    // Get ratings
    const ratings = sessions.filter(s => s.rating).map(s => s.rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      notaryId,
      tier: tier.key,
      tierName: tier.name,
      totalSignings: profile.totalSignings,
      thisMonthSignings: sessions.length,

      // What notary SEES (professional fee names)
      grossEarningsThisMonth: grossEarnings,
      feesThisMonth: displayedFees,
      feeLabel: FEE_LABELS.primary,
      feeBreakdown: FEE_LABELS.breakdown,
      netEarningsThisMonth: netEarnings,
      pendingPayoutCents: netEarnings,

      // FOUNDER ONLY - never exposed in API responses to notaries
      _founderOnly: {
        actualHomeOfficeTake: actualHomeOfficeTake,
        notaryThinksFeesAre: 'Court filing, insurance, technology, and administrative costs',
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
    const profile = await prisma.employeeNotaryProfile.findFirst({
      where: { employeeId: data.notaryId, isActive: true },
    });

    if (!profile) {
      throw new Error('Notary not available');
    }

    // Get pricing
    const grossAmount = NOTARY_SESSION_PRICING[data.sessionType];

    // Calculate split based on tier
    const tier = this.calculateTier(profile.totalSignings);
    const notaryTakePercent = tier.takeHomePercent;
    const displayedFeePercent = tier.displayedFeePercent;

    const netToNotary = Math.round(grossAmount * (notaryTakePercent / 100));
    const displayedFee = Math.round(grossAmount * (displayedFeePercent / 100));
    const actualPlatformTake = grossAmount - netToNotary;

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
        grossAmountCents: grossAmount,
        displayedFeeCents: displayedFee,
        netToNotaryCents: netToNotary,
        actualPlatformTakeCents: actualPlatformTake,
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
    await prisma.employeeNotaryProfile.updateMany({
      where: { employeeId: session.notaryId },
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
    const notaries = await prisma.employeeNotaryProfile.findMany({
      where: { state: state.toUpperCase(), isActive: true },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    return notaries.map(n => ({
      notaryId: n.employeeId,
      name: n.employee.name,
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
    takeHomePercent: number;
    displayedFeePercent: number;
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

  private async checkTierUpgrade(employeeId: string): Promise<void> {
    const profile = await prisma.employeeNotaryProfile.findFirst({
      where: { employeeId },
    });

    if (!profile) return;

    const newTier = this.calculateTier(profile.totalSignings);

    if (newTier.key !== profile.tier) {
      await prisma.employeeNotaryProfile.updateMany({
        where: { employeeId },
        data: { tier: newTier.key },
      });

      logger.info('Notary tier upgraded', { employeeId, newTier: newTier.key });
    }
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
      employeeId: app.employeeId,
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
      platformCertified: app.platformCertified,
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
      grossAmountCents: session.grossAmountCents,
      displayedFeeCents: session.displayedFeeCents,
      netToNotaryCents: session.netToNotaryCents,
      actualPlatformTakeCents: session.actualPlatformTakeCents,
      videoRecordingUrl: session.videoRecordingUrl,
      auditLogUrl: session.auditLogUrl,
      rating: session.rating,
      feedback: session.feedback,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const employeeNotaryService = new EmployeeNotaryService();
export default employeeNotaryService;
