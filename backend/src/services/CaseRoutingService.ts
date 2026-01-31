/**
 * CaseRoutingService.ts
 *
 * Smart auto-assignment of cases to employees.
 * Scores employees based on state match, workload, tier, and performance.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient, EmployeeTier } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface RoutingScore {
  employeeId: string;
  employeeName: string;
  tier: EmployeeTier;
  state: string | null;
  score: number;
  breakdown: {
    stateMatch: number;
    workloadPenalty: number;
    tierBonus: number;
    performanceBonus: number;
  };
  activeCases: number;
  maxCapacity: number;
}

interface RoutingConfig {
  enabled: boolean;
  autoAssignOnIngestion: boolean;
  maxCasesPerTier: Record<string, number>;
}

const DEFAULT_CONFIG: RoutingConfig = {
  enabled: false,
  autoAssignOnIngestion: false,
  maxCasesPerTier: {
    TIER_1_ASSOCIATE: 20,
    TIER_2_SPECIALIST: 35,
    TIER_3_SENIOR_SPECIALIST: 50,
    TIER_4_TEAM_LEADER: 30,
    TIER_5_EXECUTIVE_PARTNER: 15,
  },
};

// =============================================================================
// TIER LEVEL MAP
// =============================================================================

const TIER_LEVEL: Record<string, number> = {
  TIER_1_ASSOCIATE: 1,
  TIER_2_SPECIALIST: 2,
  TIER_3_SENIOR_SPECIALIST: 3,
  TIER_4_TEAM_LEADER: 4,
  TIER_5_EXECUTIVE_PARTNER: 5,
};

// =============================================================================
// SERVICE
// =============================================================================

class CaseRoutingService {
  /**
   * Load routing config from FounderConfig
   */
  async getConfig(): Promise<RoutingConfig> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key: "case_routing" },
      });
      if (config?.value) {
        return { ...DEFAULT_CONFIG, ...(config.value as Partial<RoutingConfig>) };
      }
    } catch (e) {
      logger.warn("Failed to load case_routing config, using defaults");
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Score all eligible employees for a given case
   */
  async scoreEmployees(caseState: string): Promise<RoutingScore[]> {
    const config = await this.getConfig();

    // Get active employees with their case counts
    const employees = await prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        isActive: true,
        employeeTier: { not: null },
      },
      select: {
        id: true,
        name: true,
        state: true,
        employeeTier: true,
        _count: {
          select: {
            assignedCases: {
              where: {
                status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
              },
            },
          },
        },
      },
    });

    // Get historical success rates per employee per state
    const successRates = await this.getSuccessRates(
      employees.map((e) => e.id),
      caseState
    );

    const scores: RoutingScore[] = [];

    for (const emp of employees) {
      const tier = emp.employeeTier as EmployeeTier;
      const tierKey = tier as string;
      const maxCapacity = config.maxCasesPerTier[tierKey] || 20;
      const activeCases = emp._count.assignedCases;

      // Skip employees at capacity
      if (activeCases >= maxCapacity) continue;

      // State match: +40 points
      const stateMatch = emp.state?.toUpperCase() === caseState?.toUpperCase() ? 40 : 0;

      // Workload penalty: -(activeCases / maxCapacity) * 30
      const workloadPenalty = -Math.round((activeCases / maxCapacity) * 30);

      // Tier bonus: +5 per tier level
      const tierLevel = TIER_LEVEL[tierKey] || 1;
      const tierBonus = tierLevel * 5;

      // Performance bonus: historical success rate for this state (0-25)
      const successRate = successRates.get(emp.id) || 0;
      const performanceBonus = Math.round(successRate * 0.25);

      const totalScore = stateMatch + workloadPenalty + tierBonus + performanceBonus;

      scores.push({
        employeeId: emp.id,
        employeeName: emp.name,
        tier,
        state: emp.state,
        score: totalScore,
        breakdown: {
          stateMatch,
          workloadPenalty,
          tierBonus,
          performanceBonus,
        },
        activeCases,
        maxCapacity,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  /**
   * Auto-assign a case to the best available employee
   */
  async autoAssign(caseId: string): Promise<{ success: boolean; employeeId?: string; employeeName?: string; score?: number }> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { success: false };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { state: true, assignedEmployeeId: true },
    });

    if (!caseData) {
      return { success: false };
    }

    // Don't re-assign if already assigned
    if (caseData.assignedEmployeeId) {
      return { success: false };
    }

    const scores = await this.scoreEmployees(caseData.state);
    if (scores.length === 0) {
      logger.warn(`No eligible employees found for case ${caseId} in state ${caseData.state}`);
      return { success: false };
    }

    const bestMatch = scores[0];

    await prisma.case.update({
      where: { id: caseId },
      data: { assignedEmployeeId: bestMatch.employeeId },
    });

    logger.info(`Auto-assigned case ${caseId} to ${bestMatch.employeeName} (score: ${bestMatch.score})`);

    return {
      success: true,
      employeeId: bestMatch.employeeId,
      employeeName: bestMatch.employeeName,
      score: bestMatch.score,
    };
  }

  /**
   * Auto-assign multiple cases (batch)
   */
  async autoAssignBatch(caseIds: string[]): Promise<{ assigned: number; failed: number }> {
    let assigned = 0;
    let failed = 0;

    for (const caseId of caseIds) {
      const result = await this.autoAssign(caseId);
      if (result.success) {
        assigned++;
      } else {
        failed++;
      }
    }

    return { assigned, failed };
  }

  /**
   * Get historical success rates for employees in a given state
   */
  private async getSuccessRates(employeeIds: string[], state: string): Promise<Map<string, number>> {
    const rates = new Map<string, number>();

    try {
      for (const empId of employeeIds) {
        const [total, paid] = await Promise.all([
          prisma.case.count({
            where: {
              assignedEmployeeId: empId,
              state: { equals: state, mode: "insensitive" },
              status: { in: ["PAID", "CLOSED", "REJECTED"] },
            },
          }),
          prisma.case.count({
            where: {
              assignedEmployeeId: empId,
              state: { equals: state, mode: "insensitive" },
              status: "PAID",
            },
          }),
        ]);

        rates.set(empId, total > 0 ? (paid / total) * 100 : 50);
      }
    } catch (e) {
      // Default to 50% if query fails
    }

    return rates;
  }
}

export const caseRoutingService = new CaseRoutingService();
export default caseRoutingService;
