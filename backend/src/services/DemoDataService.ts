/**
 * DemoDataService - MGR CAPITAL ASSISTANCE
 *
 * Manages demo/seed data cleanup when real data arrives.
 * Auto-detects demo data using ID prefixes and cleans up appropriately.
 *
 * DEMO DATA IDENTIFIERS (ID prefix approach):
 * - Demo user IDs start with: "user_founder_", "user_admin_", "user_employee_", "user_client_"
 * - Demo case IDs start with: "case_"
 * - Demo tenant ID: "tenant_mgr_capital"
 * - Demo source IDs start with: "source_"
 * - Demo state rule IDs start with: "staterule_"
 * - Demo county rule IDs start with: "countyrule_"
 * - Demo training module IDs start with: "training_"
 * - Demo commission plan IDs start with: "commission_"
 * - Demo bot subscription IDs start with: "botsub_"
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// DEMO DATA PREFIXES
// =============================================================================

export const DEMO_PREFIXES = {
  user: ["user_founder_", "user_admin_", "user_employee_", "user_client_"],
  case: ["case_"],
  tenant: ["tenant_mgr_capital"],
  source: ["source_"],
  stateRule: ["staterule_"],
  countyRule: ["countyrule_"],
  training: ["training_"],
  commission: ["commission_"],
  botSubscription: ["botsub_"],
  deadline: ["deadline_"],
  communication: ["comm_"],
  ledgerEntry: ["ledger_"],
  question: ["question_"],
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an ID matches any of the given demo prefixes
 */
function isDemoId(id: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => id.startsWith(prefix));
}

/**
 * Check if a user ID is a demo user
 */
export function isDemoUserId(userId: string): boolean {
  return isDemoId(userId, DEMO_PREFIXES.user);
}

/**
 * Check if a case ID is a demo case
 */
export function isDemoCaseId(caseId: string): boolean {
  return isDemoId(caseId, DEMO_PREFIXES.case);
}

/**
 * Check if a tenant ID is a demo tenant
 */
export function isDemoTenantId(tenantId: string): boolean {
  return isDemoId(tenantId, DEMO_PREFIXES.tenant);
}

/**
 * Check if a source ID is a demo source
 */
export function isDemoSourceId(sourceId: string): boolean {
  return isDemoId(sourceId, DEMO_PREFIXES.source);
}

// =============================================================================
// DEMO DATA SERVICE CLASS
// =============================================================================

export class DemoDataService {
  // ---------------------------------------------------------------------------
  // DETECTION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Check if the system is in demo mode (only demo data exists)
   */
  async isDemoMode(): Promise<boolean> {
    // Check for any real users (users without demo prefix)
    const realUsersExist = await this.hasRealUsers();
    if (realUsersExist) {
      return false;
    }

    // Check for any real cases (cases without demo prefix)
    const realCasesExist = await this.hasRealCases();
    if (realCasesExist) {
      return false;
    }

    // Check for any real ingestion data
    const realIngestionExists = await this.hasRealIngestionData();
    if (realIngestionExists) {
      return false;
    }

    return true;
  }

  /**
   * Check if there are any real (non-demo) users
   */
  async hasRealUsers(): Promise<boolean> {
    const users = await prisma.user.findMany({
      select: { id: true },
      take: 100,
    });

    for (const user of users) {
      if (!isDemoUserId(user.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if there are any real (non-demo) cases
   */
  async hasRealCases(): Promise<boolean> {
    const cases = await prisma.case.findMany({
      select: { id: true },
      take: 100,
    });

    for (const caseItem of cases) {
      if (!isDemoCaseId(caseItem.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if there are any real ingestion data
   * Real ingestion data = ingestion batches/records not created by seeding
   */
  async hasRealIngestionData(): Promise<boolean> {
    // Check for any ingestion batches that created real cases
    const batches = await prisma.ingestionBatch.findMany({
      where: {
        createdCases: { gt: 0 },
      },
      select: {
        id: true,
        sourceId: true,
      },
      take: 10,
    });

    for (const batch of batches) {
      // Check if the source is not a demo source
      if (!isDemoSourceId(batch.sourceId)) {
        return true;
      }

      // Check if any created cases are real cases
      const records = await prisma.ingestionRecord.findMany({
        where: { batchId: batch.id, caseId: { not: null } },
        select: { caseId: true },
        take: 10,
      });

      for (const record of records) {
        if (record.caseId && !isDemoCaseId(record.caseId)) {
          return true;
        }
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // CLEANUP METHODS
  // ---------------------------------------------------------------------------

  /**
   * Main cleanup method - checks if real data exists and cleans up demo data
   * Returns true if cleanup was performed
   */
  async cleanupDemoDataIfNeeded(): Promise<{
    cleaned: boolean;
    reason: string;
    details?: {
      casesDeleted: number;
      usersDeleted: number;
      sourcesDeleted: number;
    };
  }> {
    logger.info("[DemoDataService] Checking if demo data cleanup is needed...");

    // Check if we should clean up
    const hasRealUsers = await this.hasRealUsers();
    const hasRealCases = await this.hasRealCases();
    const hasRealIngestion = await this.hasRealIngestionData();

    if (!hasRealUsers && !hasRealCases && !hasRealIngestion) {
      logger.info("[DemoDataService] No real data found, skipping cleanup");
      return {
        cleaned: false,
        reason: "No real data exists yet - keeping demo data",
      };
    }

    logger.info("[DemoDataService] Real data detected, initiating demo cleanup", {
      hasRealUsers,
      hasRealCases,
      hasRealIngestion,
    });

    // Perform cleanup
    const result = await this.performDemoCleanup();

    logger.info("[DemoDataService] Demo data cleanup completed", result);

    return {
      cleaned: true,
      reason: `Real data detected (users: ${hasRealUsers}, cases: ${hasRealCases}, ingestion: ${hasRealIngestion})`,
      details: result,
    };
  }

  /**
   * Actually perform the demo data cleanup
   */
  private async performDemoCleanup(): Promise<{
    casesDeleted: number;
    usersDeleted: number;
    sourcesDeleted: number;
  }> {
    let casesDeleted = 0;
    let usersDeleted = 0;
    let sourcesDeleted = 0;

    // Use a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Get all demo cases
      const demoCases = await tx.case.findMany({
        where: {
          OR: DEMO_PREFIXES.case.map((prefix) => ({
            id: { startsWith: prefix },
          })),
        },
        select: { id: true },
      });

      const demoCaseIds = demoCases.map((c) => c.id);

      if (demoCaseIds.length > 0) {
        // Delete related data first (respecting foreign keys)

        // Delete communications for demo cases
        await tx.communication.deleteMany({
          where: { caseId: { in: demoCaseIds } },
        });

        // Delete deadlines for demo cases
        await tx.deadline.deleteMany({
          where: { caseId: { in: demoCaseIds } },
        });

        // Delete documents for demo cases
        await tx.document.deleteMany({
          where: { caseId: { in: demoCaseIds } },
        });

        // Delete ledger entries for demo cases
        await tx.ledgerEntry.deleteMany({
          where: { caseId: { in: demoCaseIds } },
        });

        // Delete ingestion records pointing to demo cases
        await tx.ingestionRecord.updateMany({
          where: { caseId: { in: demoCaseIds } },
          data: { caseId: null },
        });

        // Delete the demo cases
        const deletedCases = await tx.case.deleteMany({
          where: { id: { in: demoCaseIds } },
        });
        casesDeleted = deletedCases.count;
      }

      // 2. Get demo users (but check if we should keep the founder)
      const demoUsers = await tx.user.findMany({
        where: {
          OR: DEMO_PREFIXES.user.map((prefix) => ({
            id: { startsWith: prefix },
          })),
        },
        select: { id: true, role: true },
      });

      // Check if there's a real founder
      const realFounderExists = await tx.user.findFirst({
        where: {
          role: "FOUNDER",
          NOT: {
            OR: DEMO_PREFIXES.user.map((prefix) => ({
              id: { startsWith: prefix },
            })),
          },
        },
      });

      const demoUserIdsToDelete: string[] = [];

      for (const user of demoUsers) {
        // Keep the demo founder if no real founder exists
        if (user.role === "FOUNDER" && !realFounderExists) {
          logger.info("[DemoDataService] Keeping demo founder as no real founder exists", {
            userId: user.id,
          });
          continue;
        }
        demoUserIdsToDelete.push(user.id);
      }

      if (demoUserIdsToDelete.length > 0) {
        // Delete related data for users

        // Delete sessions
        await tx.userSession.deleteMany({
          where: { userId: { in: demoUserIdsToDelete } },
        });

        // Delete refresh tokens
        await tx.refreshToken.deleteMany({
          where: { userId: { in: demoUserIdsToDelete } },
        });

        // Delete bot subscriptions for demo users
        await tx.botSubscription.deleteMany({
          where: { userId: { in: demoUserIdsToDelete } },
        });

        // Delete bot usage logs for demo users
        await tx.botUsageLog.deleteMany({
          where: { userId: { in: demoUserIdsToDelete } },
        });

        // Delete training progress for demo users
        await tx.employeeTrainingProgress.deleteMany({
          where: { employeeId: { in: demoUserIdsToDelete } },
        });

        // Delete the demo users
        const deletedUsers = await tx.user.deleteMany({
          where: { id: { in: demoUserIdsToDelete } },
        });
        usersDeleted = deletedUsers.count;
      }

      // 3. Handle demo ingestion sources
      // Only delete sources that haven't fetched real data
      const demoSources = await tx.ingestionSource.findMany({
        where: {
          OR: DEMO_PREFIXES.source.map((prefix) => ({
            id: { startsWith: prefix },
          })),
        },
        select: { id: true, totalCasesCreated: true },
      });

      const demoSourceIdsToDelete: string[] = [];

      for (const source of demoSources) {
        // Check if this source has created any real cases
        const realCasesFromSource = await tx.ingestionBatch.findFirst({
          where: {
            sourceId: source.id,
            createdCases: { gt: 0 },
          },
          include: {
            records: {
              where: {
                caseId: { not: null },
              },
              select: { caseId: true },
              take: 1,
            },
          },
        });

        // If the source has created cases, check if any are real
        if (realCasesFromSource?.records) {
          let hasRealCases = false;
          for (const record of realCasesFromSource.records) {
            if (record.caseId && !isDemoCaseId(record.caseId)) {
              hasRealCases = true;
              break;
            }
          }
          if (hasRealCases) {
            // This source has fetched real data - keep it
            continue;
          }
        }

        demoSourceIdsToDelete.push(source.id);
      }

      if (demoSourceIdsToDelete.length > 0) {
        // Delete autopilot runs for demo sources
        await tx.autopilotRun.deleteMany({
          where: { sourceId: { in: demoSourceIdsToDelete } },
        });

        // Delete ingestion batches for demo sources
        const demoBatches = await tx.ingestionBatch.findMany({
          where: { sourceId: { in: demoSourceIdsToDelete } },
          select: { id: true },
        });

        if (demoBatches.length > 0) {
          const demoBatchIds = demoBatches.map((b) => b.id);

          // Delete ingestion records
          await tx.ingestionRecord.deleteMany({
            where: { batchId: { in: demoBatchIds } },
          });

          // Delete ingestion batches
          await tx.ingestionBatch.deleteMany({
            where: { id: { in: demoBatchIds } },
          });
        }

        // Delete demo ingestion sources
        const deletedSources = await tx.ingestionSource.deleteMany({
          where: { id: { in: demoSourceIdsToDelete } },
        });
        sourcesDeleted = deletedSources.count;
      }

      // 4. Update demo tenant to remove demo flag (but keep the tenant)
      // The tenant structure can remain as it's needed for the organization
      // We could add an isDemo flag to tenant if needed in future

      // 5. Log the cleanup in audit log
      await tx.auditLog.create({
        data: {
          action: "DEMO_DATA_CLEANUP",
          entityType: "SYSTEM",
          entityId: "demo-cleanup",
          details: {
            casesDeleted,
            usersDeleted,
            sourcesDeleted,
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return { casesDeleted, usersDeleted, sourcesDeleted };
  }

  // ---------------------------------------------------------------------------
  // TRIGGER HOOKS
  // ---------------------------------------------------------------------------

  /**
   * Hook to call after user registration
   * Triggers demo cleanup if the new user is a real user
   */
  async onUserCreated(userId: string): Promise<void> {
    if (isDemoUserId(userId)) {
      // Demo user created, no cleanup needed
      return;
    }

    logger.info("[DemoDataService] Real user created, checking for demo cleanup", { userId });
    await this.cleanupDemoDataIfNeeded();
  }

  /**
   * Hook to call after case creation
   * Triggers demo cleanup if the new case is a real case
   */
  async onCaseCreated(caseId: string): Promise<void> {
    if (isDemoCaseId(caseId)) {
      // Demo case created, no cleanup needed
      return;
    }

    logger.info("[DemoDataService] Real case created, checking for demo cleanup", { caseId });
    await this.cleanupDemoDataIfNeeded();
  }

  /**
   * Hook to call after successful ingestion with real data
   * Triggers demo cleanup if real cases were created
   */
  async onIngestionCompleted(casesCreated: number, sourceId: string): Promise<void> {
    if (casesCreated === 0) {
      // No cases created, no cleanup needed
      return;
    }

    if (isDemoSourceId(sourceId)) {
      // Demo source, but check if any real cases were created
      // This shouldn't happen normally but check anyway
    }

    logger.info("[DemoDataService] Ingestion completed with cases, checking for demo cleanup", {
      casesCreated,
      sourceId,
    });
    await this.cleanupDemoDataIfNeeded();
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get demo data statistics
   */
  async getDemoDataStats(): Promise<{
    isInDemoMode: boolean;
    demoCases: number;
    demoUsers: number;
    demoSources: number;
    realCases: number;
    realUsers: number;
  }> {
    const [allCases, allUsers, allSources] = await Promise.all([
      prisma.case.findMany({ select: { id: true } }),
      prisma.user.findMany({ select: { id: true } }),
      prisma.ingestionSource.findMany({ select: { id: true } }),
    ]);

    let demoCases = 0;
    let realCases = 0;
    for (const c of allCases) {
      if (isDemoCaseId(c.id)) {
        demoCases++;
      } else {
        realCases++;
      }
    }

    let demoUsers = 0;
    let realUsers = 0;
    for (const u of allUsers) {
      if (isDemoUserId(u.id)) {
        demoUsers++;
      } else {
        realUsers++;
      }
    }

    let demoSources = 0;
    for (const s of allSources) {
      if (isDemoSourceId(s.id)) {
        demoSources++;
      }
    }

    const isInDemoMode = realCases === 0 && realUsers === 0;

    return {
      isInDemoMode,
      demoCases,
      demoUsers,
      demoSources,
      realCases,
      realUsers,
    };
  }

  /**
   * Force cleanup of all demo data (for admin use)
   * WARNING: This will delete all demo data regardless of whether real data exists
   */
  async forceCleanupDemoData(): Promise<{
    casesDeleted: number;
    usersDeleted: number;
    sourcesDeleted: number;
  }> {
    logger.warn("[DemoDataService] Force cleanup of demo data initiated");
    return this.performDemoCleanup();
  }
}

// Export singleton instance
export const demoDataService = new DemoDataService();
