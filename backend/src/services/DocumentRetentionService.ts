// ============================================
// DOCUMENT RETENTION SERVICE
// State-by-state surplus file retention policies
// Auto-marks expired documents for deletion
// Only FOUNDER and RETENTION_BOT can delete
// ============================================

import prisma from "../lib/prisma.js";
import { storageRouter } from "./storage/StorageRouter.js";
import logger from "../utils/logger.js";

// ============================================
// STATE RETENTION RULES (years after case closure)
// Researched from state surplus recovery statutes
// ============================================

const STATE_RETENTION_YEARS: Record<string, number> = {
  // States with explicit surplus/tax sale retention rules
  TX: 2,    // Texas — 2 years after sale (Tax Code §34.21)
  FL: 1,    // Florida — 120 days to claim, 1 year safe retention
  CA: 1,    // California — 1 year after excess proceeds distribution
  GA: 5,    // Georgia — 5 years (OCGA §48-4-5)
  NY: 3,    // New York — 3 years surplus claim window
  PA: 5,    // Pennsylvania — 5 years
  OH: 3,    // Ohio — 3 years
  IL: 3,    // Illinois — 3 years
  NC: 2,    // North Carolina — 2 years
  SC: 5,    // South Carolina — 5 years
  VA: 3,    // Virginia — 3 years
  NJ: 3,    // New Jersey — 3 years
  MD: 3,    // Maryland — 3 years
  MI: 3,    // Michigan — 3 years
  TN: 2,    // Tennessee — 2 years
  AL: 3,    // Alabama — 3 years
  MS: 2,    // Mississippi — 2 years
  LA: 3,    // Louisiana — 3 years
  AZ: 3,    // Arizona — 3 years
  CO: 3,    // Colorado — 3 years
  IN: 3,    // Indiana — 3 years
  MO: 3,    // Missouri — 3 years
  WI: 3,    // Wisconsin — 3 years
  MN: 3,    // Minnesota — 3 years
  OR: 3,    // Oregon — 3 years
  WA: 3,    // Washington — 3 years
  MA: 3,    // Massachusetts — 3 years
  CT: 3,    // Connecticut — 3 years
  KY: 5,    // Kentucky — 5 years
  OK: 2,    // Oklahoma — 2 years
  AR: 2,    // Arkansas — 2 years
  NV: 3,    // Nevada — 3 years
  UT: 3,    // Utah — 3 years
  NM: 3,    // New Mexico — 3 years
  KS: 2,    // Kansas — 2 years
  NE: 3,    // Nebraska — 3 years
  WV: 5,    // West Virginia — 5 years
  IA: 3,    // Iowa — 3 years
  HI: 3,    // Hawaii — 3 years
  NH: 3,    // New Hampshire — 3 years
  ME: 3,    // Maine — 3 years
  MT: 3,    // Montana — 3 years
  ND: 3,    // North Dakota — 3 years
  SD: 3,    // South Dakota — 3 years
  ID: 3,    // Idaho — 3 years
  DE: 3,    // Delaware — 3 years
  RI: 3,    // Rhode Island — 3 years
  VT: 3,    // Vermont — 3 years
  AK: 3,    // Alaska — 3 years
  WY: 3,    // Wyoming — 3 years
  DC: 3,    // D.C. — 3 years
};

// Default for any state not listed
const DEFAULT_RETENTION_YEARS = 7;

// Grace period after retention expires before auto-deletion (days)
const DELETION_GRACE_DAYS = 30;

// ============================================
// SERVICE CLASS
// ============================================

class DocumentRetentionService {
  /**
   * Get retention period for a state (in years)
   */
  getRetentionYears(state: string): number {
    const normalized = state.toUpperCase().trim();
    return STATE_RETENTION_YEARS[normalized] ?? DEFAULT_RETENTION_YEARS;
  }

  /**
   * Get all state retention rules (for admin display)
   */
  getAllRetentionRules(): { state: string; years: number }[] {
    return Object.entries(STATE_RETENTION_YEARS)
      .map(([state, years]) => ({ state, years }))
      .sort((a, b) => a.state.localeCompare(b.state));
  }

  /**
   * Calculate retention expiration date for a case
   */
  calculateRetentionExpiry(state: string, closedAt: Date): Date {
    const years = this.getRetentionYears(state);
    const expiry = new Date(closedAt);
    expiry.setFullYear(expiry.getFullYear() + years);
    return expiry;
  }

  /**
   * SCAN & UPDATE — Run on all documents from closed cases
   * Sets retentionExpiresAt if not already set
   * Moves ACTIVE → RETENTION_HOLD when case closes
   */
  async updateRetentionDates(): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    try {
      // Find all documents from closed/paid cases that are still ACTIVE
      const documents = await prisma.document.findMany({
        where: {
          deletionStatus: "ACTIVE",
          retentionExpiresAt: null,
          case: {
            status: { in: ["CLOSED", "PAID", "REJECTED"] },
            closedAt: { not: null },
          },
        },
        include: {
          case: { select: { id: true, state: true, closedAt: true, status: true } },
        },
      });

      for (const doc of documents) {
        try {
          if (!doc.case.closedAt) continue;

          const expiresAt = this.calculateRetentionExpiry(
            doc.case.state,
            doc.case.closedAt
          );

          await prisma.document.update({
            where: { id: doc.id },
            data: {
              deletionStatus: "RETENTION_HOLD",
              retentionExpiresAt: expiresAt,
            },
          });
          updated++;
        } catch (err) {
          errors++;
          logger.error(`Failed to update retention for doc ${doc.id}`, { error: String(err) });
        }
      }

      logger.info(`[RetentionBot] Updated retention dates: ${updated} docs, ${errors} errors`);
    } catch (err) {
      logger.error("[RetentionBot] Failed to scan documents", { error: String(err) });
    }

    return { updated, errors };
  }

  /**
   * MARK EXPIRED — Find docs past retention, mark for deletion
   * Only the bot (this service) and FOUNDER can do this
   */
  async markExpiredForDeletion(): Promise<{ marked: number; errors: number }> {
    let marked = 0;
    let errors = 0;

    try {
      const now = new Date();

      // Find documents past retention that are still in RETENTION_HOLD
      const expired = await prisma.document.findMany({
        where: {
          deletionStatus: "RETENTION_HOLD",
          retentionExpiresAt: { lte: now },
        },
        include: {
          case: { select: { id: true, state: true, internalCode: true } },
        },
      });

      for (const doc of expired) {
        try {
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              deletionStatus: "MARKED_FOR_DELETION",
              markedForDeletionAt: now,
              markedForDeletionBy: "RETENTION_BOT",
            },
          });
          marked++;
        } catch (err) {
          errors++;
          logger.error(`Failed to mark doc ${doc.id} for deletion`, { error: String(err) });
        }
      }

      logger.info(`[RetentionBot] Marked ${marked} expired docs for deletion, ${errors} errors`);
    } catch (err) {
      logger.error("[RetentionBot] Failed to mark expired docs", { error: String(err) });
    }

    return { marked, errors };
  }

  /**
   * AUTO-PURGE — Delete files that FOUNDER has approved
   * Only runs on APPROVED_DELETION status
   */
  async purgeApprovedDeletions(): Promise<{ purged: number; errors: number }> {
    let purged = 0;
    let errors = 0;

    try {
      const approved = await prisma.document.findMany({
        where: { deletionStatus: "APPROVED_DELETION" },
        include: {
          fileRegistries: { include: { provider: true } },
        },
      });

      for (const doc of approved) {
        try {
          // Delete from all storage providers
          for (const reg of doc.fileRegistries) {
            try {
              await storageRouter.deleteFile(reg.id);
            } catch (storageErr) {
              logger.warn(`Failed to delete file ${reg.id} from storage`, { error: String(storageErr) });
            }
          }

          // Also delete local file if it exists
          if (doc.filePath) {
            const fs = await import("fs/promises");
            const path = await import("path");
            const fullPath = path.resolve(doc.filePath);
            try {
              await fs.unlink(fullPath);
            } catch {
              // File may already be gone
            }
          }

          // Mark as fully deleted
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              deletionStatus: "DELETED",
              deletedAt: new Date(),
              deletedBy: "RETENTION_BOT",
              filePath: null,
              fileUrl: "",
            },
          });

          purged++;

          // Check if ALL documents for this case are now DELETED
          // If so, cascade-cleanup all case-related data to free storage
          await this.cascadeCleanupIfAllDeleted(doc.caseId);
        } catch (err) {
          errors++;
          logger.error(`Failed to purge doc ${doc.id}`, { error: String(err) });
        }
      }

      logger.info(`[RetentionBot] Purged ${purged} approved deletions, ${errors} errors`);
    } catch (err) {
      logger.error("[RetentionBot] Failed to purge approved deletions", { error: String(err) });
    }

    return { purged, errors };
  }

  /**
   * FOUNDER ACTION — Approve deletion of marked documents
   */
  async approveMarkedDeletions(
    documentIds: string[],
    founderId: string
  ): Promise<{ approved: number; errors: number }> {
    let approved = 0;
    let errors = 0;

    for (const docId of documentIds) {
      try {
        await prisma.document.update({
          where: { id: docId, deletionStatus: "MARKED_FOR_DELETION" },
          data: {
            deletionStatus: "APPROVED_DELETION",
            markedForDeletionBy: founderId,
          },
        });
        approved++;
      } catch (err) {
        errors++;
        logger.error(`Failed to approve deletion for doc ${docId}`, { error: String(err) });
      }
    }

    return { approved, errors };
  }

  /**
   * FOUNDER ACTION — Reject deletion (back to RETENTION_HOLD with extended retention)
   */
  async rejectDeletions(
    documentIds: string[],
    founderId: string,
    extendYears: number = 1
  ): Promise<{ rejected: number; errors: number }> {
    let rejected = 0;
    let errors = 0;

    for (const docId of documentIds) {
      try {
        const doc = await prisma.document.findUnique({ where: { id: docId } });
        if (!doc || doc.deletionStatus !== "MARKED_FOR_DELETION") {
          errors++;
          continue;
        }

        const newExpiry = new Date();
        newExpiry.setFullYear(newExpiry.getFullYear() + extendYears);

        await prisma.document.update({
          where: { id: docId },
          data: {
            deletionStatus: "RETENTION_HOLD",
            retentionExpiresAt: newExpiry,
            markedForDeletionAt: null,
            markedForDeletionBy: null,
          },
        });
        rejected++;
      } catch (err) {
        errors++;
        logger.error(`Failed to reject deletion for doc ${docId}`, { error: String(err) });
      }
    }

    return { rejected, errors };
  }

  /**
   * FOUNDER ACTION — Manually mark specific documents for deletion
   */
  async manualMarkForDeletion(
    documentIds: string[],
    founderId: string
  ): Promise<{ marked: number; errors: number }> {
    let marked = 0;
    let errors = 0;

    for (const docId of documentIds) {
      try {
        await prisma.document.update({
          where: { id: docId },
          data: {
            deletionStatus: "MARKED_FOR_DELETION",
            markedForDeletionAt: new Date(),
            markedForDeletionBy: founderId,
          },
        });
        marked++;
      } catch (err) {
        errors++;
      }
    }

    return { marked, errors };
  }

  /**
   * CASCADE CLEANUP — When ALL docs for a case are DELETED,
   * also remove emails, portal messages, communications, activity logs,
   * notary records, and other case data to free storage space.
   * Keeps: LedgerEntry (accounting), Case record (audit trail)
   */
  private async cascadeCleanupIfAllDeleted(caseId: string): Promise<void> {
    try {
      // Check if any non-deleted documents remain for this case
      const remainingDocs = await prisma.document.count({
        where: {
          caseId,
          deletionStatus: { not: "DELETED" },
        },
      });

      if (remainingDocs > 0) return; // Not all docs deleted yet

      logger.info(`[RetentionBot] All docs deleted for case ${caseId} — cascading cleanup`);

      // Delete communications (emails, SMS, calls, portal messages)
      const commsDeleted = await prisma.communication.deleteMany({
        where: { caseId },
      });

      // Delete case heatmap entries
      await prisma.caseHeatmapEntry.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete activity logs for this case
      await prisma.activityLog.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete AI usage records for this case
      await prisma.aiUsageRecord.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete bot usage logs for this case
      await prisma.botUsageLog.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete worker bot tasks for this case
      await prisma.workerBotTask.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete notary session records for this case
      await prisma.notarySessionRecord.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete notary sessions for this case
      await prisma.notarySession.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete RON sessions for this case
      await prisma.rONSession.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete client tips for this case
      await prisma.clientTip.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete signature requests for this case
      await prisma.signatureRequest.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete employee violations for this case
      await prisma.employeeViolation.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete deadlines for this case
      await prisma.deadline.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // Delete token rewards for this case
      await prisma.tokenReward.deleteMany({
        where: { caseId },
      }).catch(() => {});

      // NOTE: LedgerEntry is kept for accounting/audit trail
      // NOTE: Case record itself is kept (just marked as CLOSED)
      // NOTE: Payment records are kept for financial compliance

      logger.info(
        `[RetentionBot] Cascade cleanup complete for case ${caseId}: ${commsDeleted.count} communications deleted`
      );
    } catch (err) {
      logger.error(`[RetentionBot] Cascade cleanup failed for case ${caseId}`, { error: String(err) });
    }
  }

  /**
   * GET RETENTION DASHBOARD — Summary stats for founder
   */
  async getRetentionDashboard() {
    const [active, hold, marked, approved, deleted] = await Promise.all([
      prisma.document.count({ where: { deletionStatus: "ACTIVE" } }),
      prisma.document.count({ where: { deletionStatus: "RETENTION_HOLD" } }),
      prisma.document.count({ where: { deletionStatus: "MARKED_FOR_DELETION" } }),
      prisma.document.count({ where: { deletionStatus: "APPROVED_DELETION" } }),
      prisma.document.count({ where: { deletionStatus: "DELETED" } }),
    ]);

    // Find docs expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await prisma.document.count({
      where: {
        deletionStatus: "RETENTION_HOLD",
        retentionExpiresAt: { lte: thirtyDaysFromNow },
      },
    });

    return {
      active,
      retentionHold: hold,
      markedForDeletion: marked,
      approvedDeletion: approved,
      deleted,
      expiringSoon,
      total: active + hold + marked + approved + deleted,
      retentionRules: this.getAllRetentionRules(),
      defaultRetentionYears: DEFAULT_RETENTION_YEARS,
      deletionGraceDays: DELETION_GRACE_DAYS,
    };
  }

  /**
   * GET MARKED DOCUMENTS — Documents pending FOUNDER review
   */
  async getMarkedDocuments(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { deletionStatus: "MARKED_FOR_DELETION" },
        include: {
          case: {
            select: {
              id: true,
              internalCode: true,
              state: true,
              county: true,
              status: true,
              closedAt: true,
              propertyAddress: true,
            },
          },
        },
        orderBy: { markedForDeletionAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.document.count({ where: { deletionStatus: "MARKED_FOR_DELETION" } }),
    ]);

    return {
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        type: d.type,
        caseCode: d.case.internalCode,
        caseState: d.case.state,
        caseCounty: d.case.county,
        propertyAddress: d.case.propertyAddress,
        caseStatus: d.case.status,
        closedAt: d.case.closedAt,
        markedAt: d.markedForDeletionAt,
        markedBy: d.markedForDeletionBy,
        retentionExpiresAt: d.retentionExpiresAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * GET RETENTION HOLD DOCUMENTS — With expiry info
   */
  async getRetentionHoldDocuments(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { deletionStatus: "RETENTION_HOLD" },
        include: {
          case: {
            select: {
              id: true,
              internalCode: true,
              state: true,
              county: true,
              status: true,
              closedAt: true,
            },
          },
        },
        orderBy: { retentionExpiresAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.document.count({ where: { deletionStatus: "RETENTION_HOLD" } }),
    ]);

    return {
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileSize: d.fileSize,
        type: d.type,
        caseCode: d.case.internalCode,
        caseState: d.case.state,
        caseCounty: d.case.county,
        closedAt: d.case.closedAt,
        retentionExpiresAt: d.retentionExpiresAt,
        retentionYears: this.getRetentionYears(d.case.state),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * FULL BOT CYCLE — Called by cron
   * 1. Update retention dates for newly closed cases
   * 2. Mark expired documents for deletion
   * 3. Purge founder-approved deletions
   */
  async runFullCycle(): Promise<{
    retentionUpdated: number;
    marked: number;
    purged: number;
    errors: number;
  }> {
    logger.info("[RetentionBot] Starting full retention cycle...");

    const step1 = await this.updateRetentionDates();
    const step2 = await this.markExpiredForDeletion();
    const step3 = await this.purgeApprovedDeletions();

    const totalErrors = step1.errors + step2.errors + step3.errors;

    logger.info(
      `[RetentionBot] Cycle complete: ${step1.updated} retention dates set, ${step2.marked} marked for deletion, ${step3.purged} purged, ${totalErrors} errors`
    );

    return {
      retentionUpdated: step1.updated,
      marked: step2.marked,
      purged: step3.purged,
      errors: totalErrors,
    };
  }
}

export const documentRetentionService = new DocumentRetentionService();
