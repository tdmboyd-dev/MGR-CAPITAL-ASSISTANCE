// ============================================
// CASE AUTOPILOT SERVICE — MGR CAPITAL ASSISTANCE
// Automated case pipeline management
// NEW → RESEARCH → OUTREACH → DOCS → FILE → PAID
// ============================================

import { PrismaClient, CaseStatus } from "@prisma/client";
import { autoOutreachService } from "./AutoOutreachService.js";
import { documentAssemblyService } from "./DocumentAssemblyService.js";
import { propertyResearchService } from "./PropertyResearchService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// Autopilot pipeline stages and their triggers
const AUTOPILOT_TRANSITIONS: Record<string, {
  nextStatus: CaseStatus;
  condition: string;
  action: string;
}> = {
  NEW: {
    nextStatus: "CONTACTED",
    condition: "Auto-research complete, outreach initiated",
    action: "research_and_outreach",
  },
  CONTACTED: {
    nextStatus: "DOCS_PENDING",
    condition: "Client responded positively",
    action: "prepare_docs",
  },
  DOCS_PENDING: {
    nextStatus: "DOCS_SIGNED",
    condition: "All required documents signed",
    action: "verify_docs",
  },
  DOCS_SIGNED: {
    nextStatus: "FILED",
    condition: "Filing packet submitted",
    action: "auto_file",
  },
  FILED: {
    nextStatus: "AWAITING_FUNDS",
    condition: "Filing accepted by county",
    action: "monitor_filing",
  },
  AWAITING_FUNDS: {
    nextStatus: "PAID",
    condition: "Funds disbursed",
    action: "process_payout",
  },
};

interface AutopilotResult {
  caseId: string;
  caseCode: string;
  previousStatus: string;
  newStatus: string | null;
  action: string;
  success: boolean;
  details: string;
}

class CaseAutopilotService {
  /**
   * Check if autopilot is enabled for a case
   */
  async isAutopilotEnabled(caseId: string): Promise<boolean> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { notes: true },
    });

    if (!caseData) return false;

    // Check case notes for autopilot flag (stored as JSON in notes or a tag)
    // Also check global setting
    const globalConfig = await prisma.founderConfig.findFirst({
      where: { key: "autopilot_enabled" },
    });

    const globalEnabled = globalConfig?.value === true || (globalConfig?.value as any)?.enabled === true;

    // Check per-case flag in notes
    const notes = caseData.notes || "";
    const perCaseEnabled = notes.includes("[AUTOPILOT:ON]");

    return globalEnabled || perCaseEnabled;
  }

  /**
   * Enable autopilot for a specific case
   */
  async enableAutopilot(caseId: string): Promise<void> {
    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) throw new Error("Case not found");

    const notes = caseData.notes || "";
    if (!notes.includes("[AUTOPILOT:ON]")) {
      await prisma.case.update({
        where: { id: caseId },
        data: { notes: notes + "\n[AUTOPILOT:ON]" },
      });
    }
  }

  /**
   * Disable autopilot for a specific case
   */
  async disableAutopilot(caseId: string): Promise<void> {
    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) throw new Error("Case not found");

    const notes = (caseData.notes || "").replace("[AUTOPILOT:ON]", "[AUTOPILOT:OFF]");
    await prisma.case.update({
      where: { id: caseId },
      data: { notes },
    });
  }

  /**
   * Process a single case through the autopilot pipeline
   */
  async processCase(caseId: string): Promise<AutopilotResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: { select: { id: true, name: true } },
        documents: { select: { type: true, status: true, submittedAt: true, approvedAt: true } },
        communications: { orderBy: { createdAt: "desc" }, take: 5 },
        ledgerEntries: { select: { type: true, status: true, amountCents: true, isPaid: true, paidAt: true } },
      },
    });

    if (!caseData) {
      return { caseId, caseCode: "UNKNOWN", previousStatus: "UNKNOWN", newStatus: null, action: "none", success: false, details: "Case not found" };
    }

    const transition = AUTOPILOT_TRANSITIONS[caseData.status];
    if (!transition) {
      return {
        caseId,
        caseCode: caseData.internalCode,
        previousStatus: caseData.status,
        newStatus: null,
        action: "none",
        success: true,
        details: `No autopilot action for status ${caseData.status}`,
      };
    }

    try {
      let advanced = false;
      let actionDetails = "";

      switch (transition.action) {
        case "research_and_outreach": {
          // Run property research
          try {
            await propertyResearchService.researchProperty(caseId);
            actionDetails += "Property research complete. ";
          } catch (e: any) {
            actionDetails += `Research: ${e.message}. `;
          }

          // Initiate outreach
          if (caseData.assignedEmployeeId) {
            try {
              const outreachResult = await autoOutreachService.initiateOutreach(caseId, caseData.assignedEmployeeId);
              const successCount = outreachResult.actions.filter(a => a.success).length;
              actionDetails += `Outreach: ${successCount}/${outreachResult.actions.length} actions succeeded.`;
              advanced = successCount > 0;
            } catch (e: any) {
              actionDetails += `Outreach: ${e.message}`;
            }
          } else {
            actionDetails += "No employee assigned — skipping outreach.";
          }
          break;
        }

        case "prepare_docs": {
          // Check if client responded positively
          const hasPositiveResponse = caseData.communications.some(
            (c: any) => c.outcome === "POSITIVE" || c.outcome === "RESPONDED" || c.outcome === "INTERESTED"
          );

          if (hasPositiveResponse) {
            try {
              await documentAssemblyService.assembleDocPackage(caseId);
              actionDetails = "Document package generated and ready for signing.";
              advanced = true;
            } catch (e: any) {
              actionDetails = `Doc generation: ${e.message}`;
            }
          } else {
            actionDetails = "Awaiting positive client response before generating docs.";
          }
          break;
        }

        case "verify_docs": {
          // Check if all required docs are signed
          const requiredTypes = ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA"];
          const signedDocs = caseData.documents.filter(
            (d: any) => requiredTypes.includes(d.type) && (d.status === "SIGNED" || d.status === "APPROVED")
          );

          if (signedDocs.length >= requiredTypes.length) {
            actionDetails = "All required documents signed.";
            advanced = true;
          } else {
            const missing = requiredTypes.filter(
              t => !signedDocs.find((d: any) => d.type === t)
            );
            actionDetails = `Waiting for signatures on: ${missing.join(", ")}`;
          }
          break;
        }

        case "auto_file": {
          // Auto-filing would integrate with county e-filing systems
          // For now, create a filing task and advance if filing packet exists
          const hasFiling = caseData.documents.some(
            (d: any) => d.type === "FILING_PACKET" && (d.status === "SIGNED" || d.status === "APPROVED")
          );

          if (hasFiling) {
            actionDetails = "Filing packet ready — submitted for processing.";
            advanced = true;
          } else {
            // Generate filing packet
            try {
              await documentAssemblyService.assembleDocPackage(caseId);
              actionDetails = "Filing packet generated. Needs review before submission.";
            } catch (e: any) {
              actionDetails = `Filing prep: ${e.message}`;
            }
          }
          break;
        }

        case "monitor_filing": {
          // Find the FILING_PACKET document for this case
          const filingDoc = caseData.documents.find(
            (d: any) => d.type === "FILING_PACKET" && (d.status === "SUBMITTED" || d.status === "APPROVED")
          );

          if (!filingDoc) {
            actionDetails = "No submitted or approved FILING_PACKET found — still waiting for filing submission.";
            break;
          }

          if (filingDoc.status === "APPROVED") {
            // Filing approved by county — advance to AWAITING_FUNDS
            actionDetails = `Filing approved${filingDoc.approvedAt ? " on " + new Date(filingDoc.approvedAt).toLocaleDateString() : ""}. Advancing to AWAITING_FUNDS.`;
            advanced = true;
          } else if (filingDoc.status === "SUBMITTED") {
            // Check if submitted more than 30 days ago
            const submittedDate = filingDoc.submittedAt ? new Date(filingDoc.submittedAt) : null;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (submittedDate && submittedDate < thirtyDaysAgo) {
              // Create a WatchAlert for follow-up on stale filing
              const daysSinceSubmission = Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));

              // Check if we already created an alert for this case to avoid duplicates
              const existingAlert = await prisma.watchAlert.findFirst({
                where: {
                  relatedCaseId: caseId,
                  type: "DEADLINE_PATTERN_CHANGE",
                  isResolved: false,
                },
              });

              if (!existingAlert) {
                await prisma.watchAlert.create({
                  data: {
                    type: "DEADLINE_PATTERN_CHANGE",
                    severity: "HIGH",
                    title: `Filing stale for ${caseData.internalCode}`,
                    message: `FILING_PACKET was submitted ${daysSinceSubmission} days ago with no county response. Follow up required.`,
                    relatedCaseId: caseId,
                    details: {
                      caseCode: caseData.internalCode,
                      submittedAt: submittedDate.toISOString(),
                      daysSinceSubmission,
                    },
                  },
                });
                actionDetails = `Filing submitted ${daysSinceSubmission} days ago — WatchAlert created for follow-up.`;
              } else {
                actionDetails = `Filing submitted ${daysSinceSubmission} days ago — follow-up alert already exists.`;
              }
            } else {
              const daysWaiting = submittedDate
                ? Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              actionDetails = `Filing submitted ${daysWaiting} days ago — within 30-day window, still monitoring.`;
            }
          }
          break;
        }

        case "process_payout": {
          // Look for a CLIENT_PAYOUT ledger entry that is completed/paid
          const payoutEntry = caseData.ledgerEntries.find(
            (e: any) => e.type === "CLIENT_PAYOUT" && (e.status === "COMPLETED" || e.isPaid === true)
          );

          if (payoutEntry) {
            const amountDollars = (payoutEntry.amountCents / 100).toFixed(2);
            actionDetails = `Payout of $${amountDollars} confirmed${payoutEntry.paidAt ? " on " + new Date(payoutEntry.paidAt).toLocaleDateString() : ""}. Advancing to PAID.`;
            advanced = true;
          } else {
            // Check if there's any pending payout entry
            const pendingPayout = caseData.ledgerEntries.find(
              (e: any) => e.type === "CLIENT_PAYOUT" && (e.status === "PENDING" || e.status === "PROCESSING")
            );

            if (pendingPayout) {
              const amountDollars = (pendingPayout.amountCents / 100).toFixed(2);
              actionDetails = `Payout of $${amountDollars} is ${pendingPayout.status} — waiting for funds to clear.`;
            } else {
              actionDetails = "No payout ledger entry found — awaiting fund disbursement.";
            }
          }
          break;
        }

        default:
          actionDetails = `Unknown action: ${transition.action}`;
      }

      // Advance status if conditions met
      if (advanced) {
        await prisma.case.update({
          where: { id: caseId },
          data: { status: transition.nextStatus },
        });

        // Log the transition
        await prisma.botRunLog.create({
          data: {
            botName: "caseAutopilot",
            success: true,
            summary: `Advanced ${caseData.internalCode}: ${caseData.status} → ${transition.nextStatus}`,
            details: { caseId, from: caseData.status, to: transition.nextStatus, action: actionDetails },
          },
        });
      }

      return {
        caseId,
        caseCode: caseData.internalCode,
        previousStatus: caseData.status,
        newStatus: advanced ? transition.nextStatus : null,
        action: transition.action,
        success: true,
        details: actionDetails,
      };
    } catch (error: any) {
      logger.error(`Autopilot failed for case ${caseId}`, { error: error.message });
      return {
        caseId,
        caseCode: caseData.internalCode,
        previousStatus: caseData.status,
        newStatus: null,
        action: transition.action,
        success: false,
        details: error.message,
      };
    }
  }

  /**
   * Process all autopilot-enabled cases
   */
  async processAllCases(): Promise<{ processed: number; advanced: number; results: AutopilotResult[] }> {
    // Get cases that could be on autopilot
    const cases = await prisma.case.findMany({
      where: {
        status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
      },
      select: { id: true, status: true, notes: true },
      take: 50,
    });

    // Check global config
    const globalConfig = await prisma.founderConfig.findFirst({
      where: { key: "autopilot_enabled" },
    });
    const globalEnabled = globalConfig?.value === true || (globalConfig?.value as any)?.enabled === true;

    const results: AutopilotResult[] = [];

    for (const caseData of cases) {
      const notes = caseData.notes || "";
      const perCaseEnabled = notes.includes("[AUTOPILOT:ON]");

      if (!globalEnabled && !perCaseEnabled) continue;

      try {
        const result = await this.processCase(caseData.id);
        results.push(result);
      } catch (error: any) {
        logger.error(`Autopilot processing error for case ${caseData.id}`, { error: error.message });
      }
    }

    const advanced = results.filter(r => r.newStatus !== null).length;

    return { processed: results.length, advanced, results };
  }

  /**
   * Get autopilot status for a case
   */
  async getAutopilotStatus(caseId: string) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: { select: { type: true, status: true } },
        communications: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });

    if (!caseData) return null;

    const isEnabled = await this.isAutopilotEnabled(caseId);
    const transition = AUTOPILOT_TRANSITIONS[caseData.status];

    // Get bot action history
    const botLogs = await prisma.botRunLog.findMany({
      where: {
        botName: "caseAutopilot",
        details: { path: ["caseId"], equals: caseId },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return {
      caseId,
      currentStatus: caseData.status,
      autopilotEnabled: isEnabled,
      nextTransition: transition ? { to: transition.nextStatus, condition: transition.condition } : null,
      pipeline: Object.entries(AUTOPILOT_TRANSITIONS).map(([status, t]) => ({
        status,
        nextStatus: t.nextStatus,
        isCurrent: status === caseData.status,
        isComplete: this.isStatusAfter(caseData.status, status as CaseStatus),
      })),
      recentActions: botLogs.map(l => ({
        date: l.startedAt,
        summary: l.summary,
        success: l.success,
      })),
    };
  }

  private isStatusAfter(current: string, check: string): boolean {
    const order = ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED", "AWAITING_FUNDS", "PAID"];
    return order.indexOf(current) > order.indexOf(check);
  }
}

export const caseAutopilotService = new CaseAutopilotService();
export default caseAutopilotService;
