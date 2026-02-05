/**
 * ActivityTrackingService.ts — MGR CAPITAL ASSISTANCE
 *
 * EMPLOYEE ACTIVITY TRACKING & VIOLATION SYSTEM
 *
 * Requirements:
 * - Employees must be active 3 days per week minimum
 * - Cases cannot be inactive for more than 2 days
 * - Violations result in tier demotion
 * - Recovery paths available after violations
 *
 * Activity Types:
 * - Case work (notes, documents, calls)
 * - Client communication
 * - Training completion
 * - System logins
 */

import { EmployeeTier } from "@prisma/client";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Activity requirements
const REQUIRED_ACTIVE_DAYS_PER_WEEK = 3;
const MAX_CASE_INACTIVITY_DAYS = 2;
const MAX_EMPLOYEE_INACTIVITY_DAYS = 7;

// Violation penalties
const TIER_DEMOTION_PER_VIOLATION = 1; // Drop 1 tier per violation
const VIOLATIONS_BEFORE_SUSPENSION = 3;

// Recovery requirements
const RECOVERY_ACTIVE_DAYS_REQUIRED = 5; // Must be active 5 consecutive days to recover
const RECOVERY_CASES_REQUIRED = 3; // Must complete 3 cases to recover tier

// Tier mapping
const TIER_ORDER: EmployeeTier[] = [
  'TIER_1_ASSOCIATE',
  'TIER_2_SPECIALIST',
  'TIER_3_SENIOR_SPECIALIST',
  'TIER_4_TEAM_LEADER',
  'TIER_5_EXECUTIVE_PARTNER',
];

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType =
  | 'login'
  | 'case_view'
  | 'case_note'
  | 'case_document'
  | 'case_call'
  | 'client_message'
  | 'training'
  | 'notary_session';

export type ViolationType =
  | 'weekly_inactivity'      // Less than 3 active days in a week
  | 'case_inactivity'        // Case untouched for 2+ days
  | 'extended_absence'       // No activity for 7+ days
  | 'missed_deadline'        // Case deadline missed
  | 'compliance_failure';    // Compliance issue

export interface ActivityLog {
  id: string;
  employeeId: string;
  activityType: ActivityType;
  caseId?: string;
  details?: string;
  timestamp: Date;
}

export interface Violation {
  id: string;
  employeeId: string;
  violationType: ViolationType;
  caseId?: string;
  description: string;
  tierBefore: number;
  tierAfter: number;
  isRecovered: boolean;
  recoveredAt?: Date;
  createdAt: Date;
}

export interface EmployeeActivityStats {
  employeeId: string;
  currentTier: number;
  currentTierName: string;
  activeDaysThisWeek: number;
  activeDaysRequired: number;
  isCompliant: boolean;

  // Violations
  totalViolations: number;
  unresolvedViolations: number;
  isSuspended: boolean;

  // Recovery status
  isInRecovery: boolean;
  recoveryProgress?: {
    activeDaysCompleted: number;
    activeDaysRequired: number;
    casesCompleted: number;
    casesRequired: number;
  };

  // Case activity
  casesWithActivity: number;
  casesNeedingAttention: number; // Cases approaching inactivity limit
  casesInViolation: number;      // Cases past inactivity limit
}

// =============================================================================
// ACTIVITY TRACKING SERVICE
// =============================================================================

class ActivityTrackingService {
  /**
   * Log employee activity
   */
  async logActivity(data: {
    employeeId: string;
    activityType: ActivityType;
    caseId?: string;
    details?: string;
  }): Promise<ActivityLog> {
    const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const activity: ActivityLog = {
      id: activityId,
      employeeId: data.employeeId,
      activityType: data.activityType,
      caseId: data.caseId,
      details: data.details,
      timestamp: new Date(),
    };

    // Store in database
    await (prisma as any).activityLog?.create({
      data: {
        id: activityId,
        employeeId: data.employeeId,
        activityType: data.activityType,
        caseId: data.caseId,
        details: data.details,
      },
    }).catch(() => {});

    // Update case last activity if case-related
    if (data.caseId) {
      await prisma.case.update({
        where: { id: data.caseId },
        data: { updatedAt: new Date() },
      }).catch(() => {});
    }

    return activity;
  }

  /**
   * Get employee activity stats
   */
  async getEmployeeStats(employeeId: string): Promise<EmployeeActivityStats> {
    // Get employee
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { employeeTier: true },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get this week's activity
    const weekStart = this.getWeekStart();
    const activities = await (prisma as any).activityLog?.findMany({
      where: {
        employeeId,
        timestamp: { gte: weekStart },
      },
    }).catch(() => []) || [];

    // Count unique active days
    const activeDays = new Set(
      activities.map((a: any) => new Date(a.timestamp).toDateString())
    ).size;

    // Get violations
    const violations = await (prisma as any).employeeViolation?.findMany({
      where: { employeeId },
    }).catch(() => []) || [];

    const unresolvedViolations = violations.filter((v: any) => !v.isRecovered).length;
    const isSuspended = unresolvedViolations >= VIOLATIONS_BEFORE_SUSPENSION;

    // Get cases needing attention
    const casesNeedingAttention = await this.getCasesNeedingAttention(employeeId);

    // Check if in recovery
    const isInRecovery = unresolvedViolations > 0 && !isSuspended;
    let recoveryProgress;

    if (isInRecovery) {
      recoveryProgress = await this.getRecoveryProgress(employeeId);
    }

    // Get tier index
    const tierIndex = employee.employeeTier
      ? TIER_ORDER.indexOf(employee.employeeTier) + 1
      : 1;

    return {
      employeeId,
      currentTier: tierIndex,
      currentTierName: employee.employeeTier || 'TIER_1_ASSOCIATE',
      activeDaysThisWeek: activeDays,
      activeDaysRequired: REQUIRED_ACTIVE_DAYS_PER_WEEK,
      isCompliant: activeDays >= REQUIRED_ACTIVE_DAYS_PER_WEEK,
      totalViolations: violations.length,
      unresolvedViolations,
      isSuspended,
      isInRecovery,
      recoveryProgress,
      casesWithActivity: await this.getCasesWithRecentActivity(employeeId),
      casesNeedingAttention: casesNeedingAttention.approaching.length,
      casesInViolation: casesNeedingAttention.violated.length,
    };
  }

  /**
   * Check for weekly inactivity violations (run weekly)
   */
  async checkWeeklyViolations(): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: { id: true, employeeTier: true },
    });

    const weekStart = this.getWeekStart();
    weekStart.setDate(weekStart.getDate() - 7); // Previous week

    for (const employee of employees) {
      // Count active days last week
      const activities = await (prisma as any).activityLog?.findMany({
        where: {
          employeeId: employee.id,
          timestamp: {
            gte: weekStart,
            lt: this.getWeekStart(), // Before this week started
          },
        },
      }).catch(() => []) || [];

      const activeDays = new Set(
        activities.map((a: any) => new Date(a.timestamp).toDateString())
      ).size;

      if (activeDays < REQUIRED_ACTIVE_DAYS_PER_WEEK) {
        const violation = await this.createViolation({
          employeeId: employee.id,
          violationType: 'weekly_inactivity',
          description: `Only ${activeDays} active days last week (${REQUIRED_ACTIVE_DAYS_PER_WEEK} required)`,
          currentTier: employee.employeeTier || 'TIER_1_ASSOCIATE',
        });

        if (violation) {
          violations.push(violation);
        }
      }
    }

    logger.info('Weekly violation check completed', { violationsCreated: violations.length });

    return violations;
  }

  /**
   * Check for case inactivity violations (run daily)
   */
  async checkCaseInactivityViolations(): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Get all active cases
    const cases = await prisma.case.findMany({
      where: {
        status: { notIn: ['CLOSED', 'REJECTED'] },
        assignedEmployeeId: { not: null },
      },
      select: {
        id: true,
        assignedEmployeeId: true,
        updatedAt: true,
        assignedEmployee: { select: { employeeTier: true } },
      },
    });

    const now = new Date();

    for (const caseItem of cases) {
      if (!caseItem.assignedEmployeeId) continue;

      const daysSinceActivity = Math.floor(
        (now.getTime() - new Date(caseItem.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceActivity > MAX_CASE_INACTIVITY_DAYS) {
        // Check if violation already exists for this case
        const existingViolation = await (prisma as any).employeeViolation?.findFirst({
          where: {
            employeeId: caseItem.assignedEmployeeId,
            caseId: caseItem.id,
            violationType: 'case_inactivity',
            isRecovered: false,
          },
        }).catch(() => null);

        if (!existingViolation) {
          const violation = await this.createViolation({
            employeeId: caseItem.assignedEmployeeId,
            violationType: 'case_inactivity',
            caseId: caseItem.id,
            description: `Case inactive for ${daysSinceActivity} days (max ${MAX_CASE_INACTIVITY_DAYS})`,
            currentTier: caseItem.assignedEmployee?.employeeTier || 'TIER_1_ASSOCIATE',
          });

          if (violation) {
            violations.push(violation);
          }
        }
      }
    }

    logger.info('Case inactivity check completed', { violationsCreated: violations.length });

    return violations;
  }

  /**
   * Create a violation and demote tier
   */
  async createViolation(data: {
    employeeId: string;
    violationType: ViolationType;
    caseId?: string;
    description: string;
    currentTier: EmployeeTier | string;
  }): Promise<Violation | null> {
    const currentTierIndex = TIER_ORDER.indexOf(data.currentTier as EmployeeTier);
    const currentTierNum = currentTierIndex >= 0 ? currentTierIndex + 1 : 1;
    const newTierNum = Math.max(1, currentTierNum - TIER_DEMOTION_PER_VIOLATION);
    const newTier = TIER_ORDER[newTierNum - 1] || 'TIER_1_ASSOCIATE';

    const violationId = `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const violation: Violation = {
      id: violationId,
      employeeId: data.employeeId,
      violationType: data.violationType,
      caseId: data.caseId,
      description: data.description,
      tierBefore: currentTierNum,
      tierAfter: newTierNum,
      isRecovered: false,
      createdAt: new Date(),
    };

    // Store violation
    await (prisma as any).employeeViolation?.create({
      data: {
        id: violationId,
        employeeId: data.employeeId,
        violationType: data.violationType,
        caseId: data.caseId,
        description: data.description,
        tierBefore: currentTierNum,
        tierAfter: newTierNum,
        isRecovered: false,
      },
    }).catch(() => {});

    // Demote tier
    if (newTierNum < currentTierNum) {
      await prisma.user.update({
        where: { id: data.employeeId },
        data: { employeeTier: newTier as EmployeeTier },
      }).catch(() => {});

      logger.info('Employee tier demoted due to violation', {
        employeeId: data.employeeId,
        violationType: data.violationType,
        tierBefore: currentTierNum,
        tierAfter: newTierNum,
      });
    }

    return violation;
  }

  /**
   * Get recovery progress for an employee
   */
  async getRecoveryProgress(employeeId: string): Promise<{
    activeDaysCompleted: number;
    activeDaysRequired: number;
    casesCompleted: number;
    casesRequired: number;
  }> {
    // Get last violation date
    const lastViolation = await (prisma as any).employeeViolation?.findFirst({
      where: { employeeId, isRecovered: false },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);

    if (!lastViolation) {
      return {
        activeDaysCompleted: 0,
        activeDaysRequired: RECOVERY_ACTIVE_DAYS_REQUIRED,
        casesCompleted: 0,
        casesRequired: RECOVERY_CASES_REQUIRED,
      };
    }

    // Count active days since violation
    const activities = await (prisma as any).activityLog?.findMany({
      where: {
        employeeId,
        timestamp: { gte: lastViolation.createdAt },
      },
    }).catch(() => []) || [];

    const activeDays = new Set(
      activities.map((a: any) => new Date(a.timestamp).toDateString())
    ).size;

    // Count cases completed since violation
    const casesCompleted = await prisma.case.count({
      where: {
        assignedEmployeeId: employeeId,
        status: 'CLOSED',
        closedAt: { gte: lastViolation.createdAt },
      },
    });

    return {
      activeDaysCompleted: activeDays,
      activeDaysRequired: RECOVERY_ACTIVE_DAYS_REQUIRED,
      casesCompleted,
      casesRequired: RECOVERY_CASES_REQUIRED,
    };
  }

  /**
   * Check and process tier recovery
   */
  async processRecovery(employeeId: string): Promise<{
    recovered: boolean;
    newTier?: number;
    message: string;
  }> {
    const progress = await this.getRecoveryProgress(employeeId);

    if (
      progress.activeDaysCompleted >= progress.activeDaysRequired &&
      progress.casesCompleted >= progress.casesRequired
    ) {
      // Get employee's original tier before violations
      const violations = await (prisma as any).employeeViolation?.findMany({
        where: { employeeId, isRecovered: false },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []) || [];

      if (violations.length === 0) {
        return { recovered: false, message: 'No violations to recover from' };
      }

      // Restore to tier before first unrecovered violation
      const originalTier = violations[0].tierBefore;
      const newTierEnum = TIER_ORDER[originalTier - 1] || 'TIER_1_ASSOCIATE';

      // Update employee tier
      await prisma.user.update({
        where: { id: employeeId },
        data: { employeeTier: newTierEnum as EmployeeTier },
      }).catch(() => {});

      // Mark violations as recovered
      for (const v of violations) {
        await (prisma as any).employeeViolation?.update({
          where: { id: v.id },
          data: { isRecovered: true, recoveredAt: new Date() },
        }).catch(() => {});
      }

      logger.info('Employee tier recovered', {
        employeeId,
        newTier: originalTier,
        violationsRecovered: violations.length,
      });

      return {
        recovered: true,
        newTier: originalTier,
        message: `Congratulations! Your tier has been restored to Tier ${originalTier}`,
      };
    }

    return {
      recovered: false,
      message: `Keep going! ${progress.activeDaysRequired - progress.activeDaysCompleted} more active days and ${progress.casesRequired - progress.casesCompleted} more cases needed.`,
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(now.setDate(diff));
  }

  private async getCasesWithRecentActivity(employeeId: string): Promise<number> {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    return prisma.case.count({
      where: {
        assignedEmployeeId: employeeId,
        status: { notIn: ['CLOSED', 'REJECTED'] },
        updatedAt: { gte: twoDaysAgo },
      },
    });
  }

  private async getCasesNeedingAttention(employeeId: string): Promise<{
    approaching: string[];
    violated: string[];
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const cases = await prisma.case.findMany({
      where: {
        assignedEmployeeId: employeeId,
        status: { notIn: ['CLOSED', 'REJECTED'] },
      },
      select: { id: true, updatedAt: true },
    });

    const approaching: string[] = [];
    const violated: string[] = [];

    for (const c of cases) {
      if (c.updatedAt < twoDaysAgo) {
        violated.push(c.id);
      } else if (c.updatedAt < oneDayAgo) {
        approaching.push(c.id);
      }
    }

    return { approaching, violated };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const activityTrackingService = new ActivityTrackingService();
export default activityTrackingService;
