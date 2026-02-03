// ============================================
// DOCKET BOT / COURT WATCH BOT — MGR CAPITAL ASSISTANCE
// Monitors court dockets, tracks filing deadlines
// Detects court proceedings, alerts on changes
// Ensures no deadline is missed
// ============================================

import { PrismaClient, CaseStatus, OpsInsightType, OpsInsightPriority } from "@prisma/client";
import { notificationService } from "../services/notificationService.js";
import { SMSService } from "../services/SMSService.js";
import { documentAssemblyService } from "../services/DocumentAssemblyService.js";
import { botSubscriptionService } from "../services/BotSubscriptionService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();
const smsService = new SMSService();

const BOT_NAME = "docketBot";

interface DocketAnalysis {
  analysisDate: Date;
  casesMonitored: number;
  upcomingDeadlines: DeadlineAlert[];
  courtProceedings: CourtProceeding[];
  filingStatus: FilingStatus[];
  jurisdictionUpdates: JurisdictionUpdate[];
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

interface DeadlineAlert {
  caseId: string;
  caseCode: string;
  deadlineType: "FILING" | "REDEMPTION" | "RESPONSE" | "HEARING" | "APPEAL" | "CUSTOM";
  title: string;
  dueDate: Date;
  daysRemaining: number;
  severity: "overdue" | "critical" | "urgent" | "warning" | "normal";
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  requiredAction: string;
  state: string;
  county: string;
}

interface CourtProceeding {
  caseId: string;
  caseCode: string;
  courtCaseNumber?: string;
  proceedingType: string;
  scheduledDate?: Date;
  status: "SCHEDULED" | "PENDING" | "COMPLETED" | "CONTINUED" | "DISMISSED";
  notes?: string;
  jurisdiction: string;
}

interface FilingStatus {
  caseId: string;
  caseCode: string;
  filingType: string;
  filedAt?: Date;
  status: "NOT_FILED" | "FILED" | "ACCEPTED" | "REJECTED" | "PENDING_REVIEW";
  rejectionReason?: string;
  nextStep?: string;
}

interface JurisdictionUpdate {
  state: string;
  county?: string;
  updateType: "RULE_CHANGE" | "DEADLINE_CHANGE" | "FEE_CHANGE" | "PROCESS_CHANGE" | "COURT_CLOSURE";
  description: string;
  effectiveDate?: Date;
  affectedCases: number;
  severity: "info" | "warning" | "critical";
}

interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  overdueDeadlines: number;
  criticalDeadlines: number;
  pendingFilings: number;
  jurisdictionAlerts: number;
  riskFactors: string[];
}

// Deadline thresholds by type (in days)
const DEADLINE_THRESHOLDS = {
  FILING: { critical: 3, urgent: 7, warning: 14 },
  REDEMPTION: { critical: 7, urgent: 14, warning: 30 },
  RESPONSE: { critical: 2, urgent: 5, warning: 10 },
  HEARING: { critical: 3, urgent: 7, warning: 14 },
  APPEAL: { critical: 5, urgent: 10, warning: 20 },
  CUSTOM: { critical: 3, urgent: 7, warning: 14 },
};

class DocketBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  async analyze(): Promise<DocketAnalysis> {
    // Get all cases with active legal tracking
    const cases = await prisma.case.findMany({
      where: {
        status: {
          notIn: ["PAID", "CLOSED", "REJECTED"],
        },
      },
      include: {
        assignedEmployee: {
          select: {
            id: true,
            name: true,
          },
        },
        deadlines: {
          where: { completedAt: null },
          orderBy: { dueDate: "asc" },
        },
        documents: {
          where: {
            type: { in: ["FILING_PACKET", "MOTION", "AFFIDAVIT"] },
          },
          select: {
            type: true,
            status: true,
            submittedAt: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
          },
        },
        stateRule: {
          select: {
            stateCode: true,
            stateName: true,
            claimPeriodDays: true,
            redemptionPeriodDays: true,
            filingMethod: true,
          },
        },
      },
    });

    const upcomingDeadlines = this.analyzeDeadlines(cases);
    const courtProceedings = this.analyzeCourtProceedings(cases);
    const filingStatus = this.analyzeFilingStatus(cases);
    const jurisdictionUpdates = await this.checkJurisdictionUpdates(cases);
    const riskAssessment = this.assessRisk(upcomingDeadlines, filingStatus, jurisdictionUpdates);
    const recommendations = this.generateRecommendations(
      upcomingDeadlines,
      filingStatus,
      jurisdictionUpdates,
      riskAssessment
    );

    const analysis: DocketAnalysis = {
      analysisDate: new Date(),
      casesMonitored: cases.length,
      upcomingDeadlines,
      courtProceedings,
      filingStatus,
      jurisdictionUpdates,
      riskAssessment,
      recommendations,
    };

    await this.saveInsight(analysis);

    return analysis;
  }

  // ============================================
  // DEADLINE ANALYSIS
  // ============================================

  private analyzeDeadlines(cases: any[]): DeadlineAlert[] {
    const alerts: DeadlineAlert[] = [];
    const now = new Date();

    for (const caseRecord of cases) {
      // Check explicit deadlines from Deadline table
      for (const deadline of caseRecord.deadlines) {
        const daysRemaining = Math.ceil(
          (new Date(deadline.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const deadlineType = this.categorizeDeadline(deadline.title);
        const severity = this.calculateDeadlineSeverity(daysRemaining, deadlineType);

        if (severity !== "normal" || daysRemaining <= 30) {
          alerts.push({
            caseId: caseRecord.id,
            caseCode: caseRecord.internalCode,
            deadlineType,
            title: deadline.title,
            dueDate: deadline.dueDate,
            daysRemaining,
            severity,
            assignedEmployeeId: caseRecord.assignedEmployee?.id,
            assignedEmployeeName: caseRecord.assignedEmployee?.name,
            requiredAction: this.getRequiredAction(deadlineType, caseRecord.status),
            state: caseRecord.state,
            county: caseRecord.county,
          });
        }
      }

      // Check filing deadline if present
      if (caseRecord.filingDeadline) {
        const daysRemaining = Math.ceil(
          (new Date(caseRecord.filingDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const severity = this.calculateDeadlineSeverity(daysRemaining, "FILING");

        if (severity !== "normal" || daysRemaining <= 30) {
          alerts.push({
            caseId: caseRecord.id,
            caseCode: caseRecord.internalCode,
            deadlineType: "FILING",
            title: "Filing Deadline",
            dueDate: caseRecord.filingDeadline,
            daysRemaining,
            severity,
            assignedEmployeeId: caseRecord.assignedEmployee?.id,
            assignedEmployeeName: caseRecord.assignedEmployee?.name,
            requiredAction: "File claim with county before deadline",
            state: caseRecord.state,
            county: caseRecord.county,
          });
        }
      }

      // Check redemption deadline if present
      if (caseRecord.redemptionDeadline) {
        const daysRemaining = Math.ceil(
          (new Date(caseRecord.redemptionDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const severity = this.calculateDeadlineSeverity(daysRemaining, "REDEMPTION");

        if (severity !== "normal" || daysRemaining <= 60) {
          alerts.push({
            caseId: caseRecord.id,
            caseCode: caseRecord.internalCode,
            deadlineType: "REDEMPTION",
            title: "Redemption Period Expires",
            dueDate: caseRecord.redemptionDeadline,
            daysRemaining,
            severity,
            assignedEmployeeId: caseRecord.assignedEmployee?.id,
            assignedEmployeeName: caseRecord.assignedEmployee?.name,
            requiredAction: "Ensure claim filed before redemption period expires",
            state: caseRecord.state,
            county: caseRecord.county,
          });
        }
      }

      // Calculate implicit deadlines based on state rules
      if (caseRecord.stateRule && caseRecord.saleDate) {
        const saleDate = new Date(caseRecord.saleDate);

        // Filing deadline based on claim period
        if (caseRecord.stateRule.claimPeriodDays && !caseRecord.filingDeadline) {
          const implicitFilingDeadline = new Date(saleDate);
          implicitFilingDeadline.setDate(
            implicitFilingDeadline.getDate() + caseRecord.stateRule.claimPeriodDays
          );

          const daysRemaining = Math.ceil(
            (implicitFilingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          const severity = this.calculateDeadlineSeverity(daysRemaining, "FILING");

          if (daysRemaining > 0 && daysRemaining <= 90) {
            alerts.push({
              caseId: caseRecord.id,
              caseCode: caseRecord.internalCode,
              deadlineType: "FILING",
              title: `${caseRecord.stateRule.stateCode} Claim Period Deadline`,
              dueDate: implicitFilingDeadline,
              daysRemaining,
              severity,
              assignedEmployeeId: caseRecord.assignedEmployee?.id,
              assignedEmployeeName: caseRecord.assignedEmployee?.name,
              requiredAction: `File claim within ${caseRecord.stateRule.claimPeriodDays} days of sale`,
              state: caseRecord.state,
              county: caseRecord.county,
            });
          }
        }
      }
    }

    // Sort by severity and days remaining
    const severityOrder = { overdue: 0, critical: 1, urgent: 2, warning: 3, normal: 4 };
    return alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.daysRemaining - b.daysRemaining;
    });
  }

  private categorizeDeadline(title: string): DeadlineAlert["deadlineType"] {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("filing") || titleLower.includes("file") || titleLower.includes("claim")) {
      return "FILING";
    }
    if (titleLower.includes("redemption") || titleLower.includes("redeem")) {
      return "REDEMPTION";
    }
    if (titleLower.includes("response") || titleLower.includes("respond") || titleLower.includes("answer")) {
      return "RESPONSE";
    }
    if (titleLower.includes("hearing") || titleLower.includes("court date")) {
      return "HEARING";
    }
    if (titleLower.includes("appeal")) {
      return "APPEAL";
    }
    return "CUSTOM";
  }

  private calculateDeadlineSeverity(
    daysRemaining: number,
    type: DeadlineAlert["deadlineType"]
  ): DeadlineAlert["severity"] {
    const thresholds = DEADLINE_THRESHOLDS[type];

    if (daysRemaining < 0) return "overdue";
    if (daysRemaining <= thresholds.critical) return "critical";
    if (daysRemaining <= thresholds.urgent) return "urgent";
    if (daysRemaining <= thresholds.warning) return "warning";
    return "normal";
  }

  private getRequiredAction(type: DeadlineAlert["deadlineType"], status: CaseStatus): string {
    const actions: Record<string, Record<string, string>> = {
      FILING: {
        NEW: "Complete client documents and prepare filing",
        CONTACTED: "Obtain signed documents for filing",
        DOCS_PENDING: "Follow up on pending documents",
        DOCS_SIGNED: "Prepare and submit filing packet",
        FILED: "Monitor for acceptance",
        AWAITING_FUNDS: "Filing complete - await funds",
      },
      REDEMPTION: {
        default: "Ensure claim filed before redemption expires",
      },
      RESPONSE: {
        default: "Prepare and submit response",
      },
      HEARING: {
        default: "Prepare for court hearing",
      },
      APPEAL: {
        default: "Review case for appeal options",
      },
      CUSTOM: {
        default: "Review and complete required action",
      },
    };

    return actions[type]?.[status] || actions[type]?.default || "Complete required action";
  }

  // ============================================
  // COURT PROCEEDINGS
  // ============================================

  private analyzeCourtProceedings(cases: any[]): CourtProceeding[] {
    const proceedings: CourtProceeding[] = [];

    for (const caseRecord of cases) {
      // Cases with court case numbers are in active court proceedings
      if (caseRecord.courtCaseNumber) {
        let status: CourtProceeding["status"] = "PENDING";
        let proceedingType = "Surplus Fund Claim";

        if (caseRecord.status === "FILED") {
          status = "PENDING";
          proceedingType = "Claim Filed - Awaiting Review";
        } else if (caseRecord.status === "AWAITING_FUNDS") {
          status = "COMPLETED";
          proceedingType = "Claim Approved - Awaiting Disbursement";
        }

        proceedings.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          courtCaseNumber: caseRecord.courtCaseNumber,
          proceedingType,
          status,
          jurisdiction: `${caseRecord.county}, ${caseRecord.state}`,
        });
      }

      // Check for hearing deadlines
      const hearingDeadlines = caseRecord.deadlines.filter((d: any) =>
        d.title.toLowerCase().includes("hearing")
      );

      for (const hearing of hearingDeadlines) {
        proceedings.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          courtCaseNumber: caseRecord.courtCaseNumber,
          proceedingType: hearing.title,
          scheduledDate: hearing.dueDate,
          status: "SCHEDULED",
          notes: hearing.description,
          jurisdiction: `${caseRecord.county}, ${caseRecord.state}`,
        });
      }
    }

    return proceedings;
  }

  // ============================================
  // FILING STATUS
  // ============================================

  private analyzeFilingStatus(cases: any[]): FilingStatus[] {
    const filings: FilingStatus[] = [];

    for (const caseRecord of cases) {
      // Check for filing packet
      const filingPacket = caseRecord.documents.find(
        (d: any) => d.type === "FILING_PACKET"
      );

      let status: FilingStatus["status"] = "NOT_FILED";
      let filedAt: Date | undefined;
      let rejectionReason: string | undefined;
      let nextStep: string | undefined;

      if (filingPacket) {
        if (filingPacket.rejectedAt) {
          status = "REJECTED";
          rejectionReason = filingPacket.rejectionReason;
          nextStep = "Review rejection reason and resubmit";
        } else if (filingPacket.approvedAt) {
          status = "ACCEPTED";
          nextStep = "Monitor for fund disbursement";
        } else if (filingPacket.submittedAt) {
          status = "FILED";
          filedAt = filingPacket.submittedAt;
          nextStep = "Wait for county review";
        } else if (filingPacket.status === "SIGNED") {
          status = "PENDING_REVIEW";
          nextStep = "Submit filing packet to county";
        }
      } else {
        // No filing packet yet
        if (caseRecord.status === "DOCS_SIGNED") {
          nextStep = "Prepare filing packet";
        } else if (caseRecord.status === "DOCS_PENDING") {
          nextStep = "Obtain client signatures first";
        } else {
          nextStep = "Complete client onboarding";
        }
      }

      // Only include if there's something notable
      if (status !== "ACCEPTED" || caseRecord.status !== "AWAITING_FUNDS") {
        filings.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          filingType: "Surplus Fund Claim",
          filedAt,
          status,
          rejectionReason,
          nextStep,
        });
      }
    }

    return filings.filter((f) => f.status !== "ACCEPTED"); // Focus on incomplete filings
  }

  // ============================================
  // JURISDICTION UPDATES
  // ============================================

  private async checkJurisdictionUpdates(cases: any[]): Promise<JurisdictionUpdate[]> {
    const updates: JurisdictionUpdate[] = [];

    // Get recent scraped items that might affect cases
    const recentChanges = await prisma.scrapedItem.findMany({
      where: {
        reviewStatus: "ACTIONABLE",
        fetchedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        sourceType: { in: ["SURPLUS_RULES", "STATE_STATUTE", "COURT_NOTICE"] },
      },
      select: {
        state: true,
        county: true,
        sourceType: true,
        parsedData: true,
      },
    });

    // Group cases by state/county
    const casesByJurisdiction = new Map<string, number>();
    for (const c of cases) {
      const key = `${c.state}|${c.county}`;
      casesByJurisdiction.set(key, (casesByJurisdiction.get(key) || 0) + 1);
    }

    // Check for rule changes affecting our cases
    for (const change of recentChanges) {
      if (!change.state) continue;

      const key = `${change.state}|${change.county || ""}`;
      const affectedCount = casesByJurisdiction.get(key) || 0;

      if (affectedCount === 0) continue; // No cases in this jurisdiction

      let updateType: JurisdictionUpdate["updateType"] = "RULE_CHANGE";
      let severity: JurisdictionUpdate["severity"] = "info";
      let description = "Jurisdiction update detected";

      const parsedData = change.parsedData as any;

      if (parsedData?.type === "deadline_change") {
        updateType = "DEADLINE_CHANGE";
        severity = "critical";
        description = parsedData.description || "Filing deadline rules may have changed";
      } else if (parsedData?.type === "fee_change") {
        updateType = "FEE_CHANGE";
        severity = "warning";
        description = parsedData.description || "Filing fees may have changed";
      } else if (change.sourceType === "COURT_NOTICE") {
        updateType = "PROCESS_CHANGE";
        severity = "warning";
        description = "Court process notice - review for impact";
      }

      updates.push({
        state: change.state,
        county: change.county || undefined,
        updateType,
        description,
        affectedCases: affectedCount,
        severity,
      });
    }

    // Check for high-volatility jurisdictions
    const volatileJurisdictions = await prisma.jurisdictionMetrics.findMany({
      where: { volatilityScore: { gte: 70 } },
    });

    for (const jurisdiction of volatileJurisdictions) {
      const key = `${jurisdiction.state}|${jurisdiction.county || ""}`;
      const affectedCount = casesByJurisdiction.get(key) || 0;

      if (affectedCount > 0) {
        updates.push({
          state: jurisdiction.state,
          county: jurisdiction.county || undefined,
          updateType: "RULE_CHANGE",
          description: `High volatility jurisdiction (score: ${jurisdiction.volatilityScore}) - monitor closely`,
          affectedCases: affectedCount,
          severity: "warning",
        });
      }
    }

    return updates;
  }

  // ============================================
  // RISK ASSESSMENT
  // ============================================

  private assessRisk(
    deadlines: DeadlineAlert[],
    filings: FilingStatus[],
    jurisdictionUpdates: JurisdictionUpdate[]
  ): RiskAssessment {
    const overdueDeadlines = deadlines.filter((d) => d.severity === "overdue").length;
    const criticalDeadlines = deadlines.filter((d) => d.severity === "critical").length;
    const pendingFilings = filings.filter(
      (f) => f.status === "NOT_FILED" || f.status === "REJECTED"
    ).length;
    const jurisdictionAlerts = jurisdictionUpdates.filter(
      (j) => j.severity === "critical" || j.severity === "warning"
    ).length;

    const riskFactors: string[] = [];

    if (overdueDeadlines > 0) {
      riskFactors.push(`${overdueDeadlines} OVERDUE deadlines require immediate attention`);
    }
    if (criticalDeadlines > 0) {
      riskFactors.push(`${criticalDeadlines} deadlines critical within 3 days`);
    }
    if (pendingFilings > 10) {
      riskFactors.push(`${pendingFilings} cases need filing`);
    }
    if (jurisdictionAlerts > 0) {
      riskFactors.push(`${jurisdictionAlerts} jurisdiction alerts active`);
    }

    // Calculate overall risk
    let overallRisk: RiskAssessment["overallRisk"] = "low";
    if (overdueDeadlines > 0 || criticalDeadlines >= 5) {
      overallRisk = "critical";
    } else if (criticalDeadlines > 0 || jurisdictionAlerts >= 3) {
      overallRisk = "high";
    } else if (pendingFilings > 10 || deadlines.filter((d) => d.severity === "urgent").length > 5) {
      overallRisk = "medium";
    }

    return {
      overallRisk,
      overdueDeadlines,
      criticalDeadlines,
      pendingFilings,
      jurisdictionAlerts,
      riskFactors,
    };
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    deadlines: DeadlineAlert[],
    filings: FilingStatus[],
    jurisdictionUpdates: JurisdictionUpdate[],
    risk: RiskAssessment
  ): string[] {
    const recommendations: string[] = [];

    // Critical deadline actions
    if (risk.overdueDeadlines > 0) {
      recommendations.push(
        `URGENT: ${risk.overdueDeadlines} deadlines are overdue - take immediate action`
      );
    }

    if (risk.criticalDeadlines > 0) {
      const criticalCases = deadlines
        .filter((d) => d.severity === "critical")
        .slice(0, 3)
        .map((d) => d.caseCode);
      recommendations.push(
        `Critical deadlines in 3 days: ${criticalCases.join(", ")}`
      );
    }

    // Filing recommendations
    const rejectedFilings = filings.filter((f) => f.status === "REJECTED");
    if (rejectedFilings.length > 0) {
      recommendations.push(
        `Review and resubmit ${rejectedFilings.length} rejected filings`
      );
    }

    const needsFiling = filings.filter((f) => f.status === "NOT_FILED" && f.nextStep);
    if (needsFiling.length > 5) {
      recommendations.push(
        `${needsFiling.length} cases ready for filing - batch process recommended`
      );
    }

    // Jurisdiction alerts
    const criticalJurisdictions = jurisdictionUpdates.filter((j) => j.severity === "critical");
    if (criticalJurisdictions.length > 0) {
      for (const j of criticalJurisdictions) {
        recommendations.push(
          `Review ${j.state}${j.county ? ` ${j.county}` : ""}: ${j.description}`
        );
      }
    }

    // Workload distribution
    const unassignedCritical = deadlines.filter(
      (d) => !d.assignedEmployeeId && (d.severity === "critical" || d.severity === "urgent")
    );
    if (unassignedCritical.length > 0) {
      recommendations.push(
        `Assign ${unassignedCritical.length} critical/urgent unassigned cases immediately`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Docket monitoring shows no immediate concerns - continue monitoring");
    }

    return recommendations;
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: DocketAnalysis): Promise<void> {
    const priority =
      analysis.riskAssessment.overallRisk === "critical"
        ? "URGENT"
        : analysis.riskAssessment.overallRisk === "high"
        ? "HIGH"
        : analysis.riskAssessment.overallRisk === "medium"
        ? "NORMAL"
        : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "COMPLIANCE_CHECK" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: "Court Docket & Deadline Analysis",
        summary: `${analysis.casesMonitored} cases monitored. ${analysis.riskAssessment.overdueDeadlines} overdue, ${analysis.riskAssessment.criticalDeadlines} critical deadlines.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: analysis.upcomingDeadlines.slice(0, 10).map((d) => d.caseId),
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    });
  }

  // ============================================
  // ACTION MODE — Respond to docket changes
  // ============================================

  /**
   * Auto-respond to docket changes:
   * - New hearing date: SMS reminder to employee
   * - Filing deadline: Generate required docs, queue for review
   * - Case status change: Update case, notify parties via email
   * - Adverse ruling: Escalate to founder
   */
  async respondToDocketChange(
    caseId: string,
    changeType: "hearing_date" | "filing_deadline" | "status_change" | "adverse_ruling" | "new_requirement",
    details: string
  ): Promise<{ actions: string[]; escalated: boolean }> {
    const actions: string[] = [];
    let escalated = false;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!caseData) return { actions: ["Case not found"], escalated: false };

    try {
      switch (changeType) {
        case "hearing_date": {
          // Send SMS reminder to employee
          if (caseData.assignedEmployee?.phone) {
            await smsService.send(
              caseData.assignedEmployee.phone,
              `HEARING ALERT: Case ${caseData.internalCode} — ${details}. Check your calendar.`
            );
            actions.push(`SMS hearing reminder sent to ${caseData.assignedEmployee.name}`);
          }

          // Send email with details
          if (caseData.assignedEmployee?.email) {
            await notificationService.sendEmployeeEmail({
              to: caseData.assignedEmployee.email,
              subject: `Hearing Scheduled: ${caseData.internalCode}`,
              body: `A hearing has been scheduled for case ${caseData.internalCode} (${caseData.county}, ${caseData.state}).\n\n${details}\n\nPlease prepare accordingly and update the case file.`,
            });
            actions.push("Hearing notification email sent");
          }

          // Create a deadline entry
          await prisma.deadline.create({
            data: {
              caseId,
              title: `Court Hearing: ${details}`,
              description: `Auto-created by docket bot: ${details}`,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days if no specific date
            },
          });
          actions.push("Hearing deadline created");
          break;
        }

        case "filing_deadline": {
          // Generate required document from template
          if (caseData.assignedEmployeeId) {
            try {
              await documentAssemblyService.assembleDocPackage(caseId, caseData.assignedEmployeeId);
              actions.push("Filing documents auto-generated");
            } catch (e: any) {
              actions.push(`Doc generation failed: ${e.message}`);
            }
          }

          // Notify employee
          if (caseData.assignedEmployee?.email) {
            await notificationService.sendEmployeeEmail({
              to: caseData.assignedEmployee.email,
              subject: `Filing Deadline Update: ${caseData.internalCode}`,
              body: `Filing deadline update for case ${caseData.internalCode}:\n\n${details}\n\nDocuments have been auto-generated and queued for your review.`,
            });
            actions.push("Filing deadline notification sent");
          }
          break;
        }

        case "status_change": {
          // Update case status note
          const notes = caseData.notes || "";
          await prisma.case.update({
            where: { id: caseId },
            data: { notes: notes + `\n[DOCKET BOT ${new Date().toISOString().split("T")[0]}] Status change: ${details}` },
          });
          actions.push("Case notes updated with status change");

          // Notify all parties
          if (caseData.assignedEmployee?.email) {
            await notificationService.sendEmployeeEmail({
              to: caseData.assignedEmployee.email,
              subject: `Case Status Update: ${caseData.internalCode}`,
              body: `Docket status change for case ${caseData.internalCode}:\n\n${details}`,
            });
            actions.push("Employee notified of status change");
          }

          if (caseData.client?.email) {
            await notificationService.sendClientEmail({
              to: caseData.client.email,
              subject: `Update on Your Case`,
              body: `We have an update regarding your case in ${caseData.county}, ${caseData.state}. Our team is reviewing the latest developments and will be in touch with any actions needed from you.`,
            });
            actions.push("Client notified of status change");
          }
          break;
        }

        case "adverse_ruling": {
          escalated = true;

          // Get all founders
          const founders = await prisma.user.findMany({
            where: { role: "FOUNDER", isActive: true },
            select: { id: true, email: true, name: true },
          });

          // Build case brief
          const brief = `ADVERSE RULING ESCALATION\n\nCase: ${caseData.internalCode}\nProperty: ${caseData.propertyAddress || "N/A"}\nCounty: ${caseData.county}, ${caseData.state}\nSurplus: $${((caseData.surplusAmountCents || 0) / 100).toLocaleString()}\nAssigned: ${caseData.assignedEmployee?.name || "Unassigned"}\n\nRuling Details:\n${details}\n\nImmediate founder review required.`;

          for (const founder of founders) {
            if (founder.email) {
              await notificationService.sendFounderEmail({
                subject: `ESCALATION: Adverse Ruling — ${caseData.internalCode}`,
                body: brief,
                priority: "urgent",
                caseId,
              });
            }
          }
          actions.push(`Escalated to ${founders.length} founder(s) with full case brief`);

          // Create urgent WatchAlert
          await prisma.watchAlert.create({
            data: {
              type: "SYSTEM_HEALTH",
              severity: "CRITICAL",
              message: `Adverse ruling on case ${caseData.internalCode}: ${details}`,
              details: { caseId, ruling: details },
              status: "OPEN",
            },
          });
          actions.push("Critical WatchAlert created");
          break;
        }

        case "new_requirement": {
          // Update case notes
          const currentNotes = caseData.notes || "";
          await prisma.case.update({
            where: { id: caseId },
            data: { notes: currentNotes + `\n[DOCKET BOT ${new Date().toISOString().split("T")[0]}] New requirement: ${details}` },
          });

          // Notify employee
          if (caseData.assignedEmployee?.email) {
            await notificationService.sendEmployeeEmail({
              to: caseData.assignedEmployee.email,
              subject: `New Requirement: ${caseData.internalCode}`,
              body: `A new requirement has been identified for case ${caseData.internalCode}:\n\n${details}\n\nPlease review and take necessary action.`,
            });
          }
          actions.push("Employee notified of new requirement");
          break;
        }
      }

      // Log to BotRunLog
      await prisma.botRunLog.create({
        data: {
          botName: "docketBot:respondToChange",
          success: true,
          summary: `Responded to ${changeType} for case ${caseData.internalCode}: ${actions.length} actions taken`,
          details: { caseId, changeType, details, actions, escalated },
        },
      });
    } catch (error: any) {
      logger.error(`Docket response failed for case ${caseId}`, { error: error.message });
      actions.push(`Error: ${error.message}`);
    }

    return { actions, escalated };
  }

  /**
   * Analyze AND auto-respond to detected changes
   */
  async analyzeAndRespond(): Promise<{
    analysis: DocketAnalysis;
    responses: { caseId: string; changeType: string; actions: string[] }[];
  }> {
    const analysis = await this.analyze();
    const responses: { caseId: string; changeType: string; actions: string[] }[] = [];

    // Auto-respond to overdue/critical deadlines
    for (const deadline of analysis.upcomingDeadlines) {
      if (deadline.severity === "overdue" || deadline.severity === "critical") {
        const changeType = deadline.deadlineType === "HEARING" ? "hearing_date" : "filing_deadline";
        const result = await this.respondToDocketChange(
          deadline.caseId,
          changeType as any,
          `${deadline.title}: ${deadline.daysRemaining < 0 ? Math.abs(deadline.daysRemaining) + " days overdue" : deadline.daysRemaining + " days remaining"}`
        );
        responses.push({ caseId: deadline.caseId, changeType, actions: result.actions });
      }
    }

    // Auto-respond to jurisdiction updates
    for (const update of analysis.jurisdictionUpdates) {
      if (update.severity === "critical") {
        // Would need to map this to specific cases
        logger.info(`Critical jurisdiction update: ${update.state} — ${update.description}`);
      }
    }

    return { analysis, responses };
  }

  private generatePlainEnglish(analysis: DocketAnalysis): string {
    const parts: string[] = [];

    parts.push(
      `I'm monitoring ${analysis.casesMonitored} cases for court deadlines and proceedings.`
    );

    // Risk level
    parts.push(`\nOverall docket risk: ${analysis.riskAssessment.overallRisk.toUpperCase()}`);

    // Deadline summary
    if (analysis.riskAssessment.overdueDeadlines > 0) {
      parts.push(
        `\n⚠️ ALERT: ${analysis.riskAssessment.overdueDeadlines} deadlines are OVERDUE!`
      );
    }

    if (analysis.riskAssessment.criticalDeadlines > 0) {
      parts.push(`${analysis.riskAssessment.criticalDeadlines} deadlines critical (within 3 days)`);
    }

    // Top deadlines
    const urgentDeadlines = analysis.upcomingDeadlines.filter(
      (d) => d.severity === "overdue" || d.severity === "critical" || d.severity === "urgent"
    );
    if (urgentDeadlines.length > 0) {
      parts.push(`\nUrgent deadlines:`);
      for (const d of urgentDeadlines.slice(0, 5)) {
        const daysText = d.daysRemaining < 0
          ? `${Math.abs(d.daysRemaining)} days OVERDUE`
          : `${d.daysRemaining} days remaining`;
        parts.push(
          `- ${d.caseCode}: ${d.title} (${daysText}) - ${d.requiredAction}`
        );
      }
    }

    // Jurisdiction updates
    if (analysis.jurisdictionUpdates.length > 0) {
      parts.push(`\n${analysis.jurisdictionUpdates.length} jurisdiction updates to review.`);
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      parts.push(`\nAction items:`);
      for (const rec of analysis.recommendations) {
        parts.push(`- ${rec}`);
      }
    }

    return parts.join("\n");
  }

  // ============================================
  // QUICK METHODS
  // ============================================

  /**
   * Get deadlines for a specific case
   */
  async getCaseDeadlines(caseId: string): Promise<DeadlineAlert[]> {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        assignedEmployee: {
          select: { id: true, name: true },
        },
        deadlines: {
          where: { completedAt: null },
          orderBy: { dueDate: "asc" },
        },
        stateRule: true,
      },
    });

    if (!caseRecord) return [];

    return this.analyzeDeadlines([caseRecord]);
  }

  /**
   * Get today's critical deadlines across all cases
   */
  async getTodayCriticalDeadlines(): Promise<DeadlineAlert[]> {
    const analysis = await this.analyze();
    return analysis.upcomingDeadlines.filter(
      (d) => d.severity === "overdue" || d.severity === "critical"
    );
  }

  /**
   * Check if any deadlines are at risk for a jurisdiction
   */
  async checkJurisdictionDeadlines(state: string, county?: string): Promise<{
    totalCases: number;
    atRisk: number;
    deadlines: DeadlineAlert[];
  }> {
    const cases = await prisma.case.findMany({
      where: {
        state,
        county: county || undefined,
        status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
      },
      include: {
        assignedEmployee: { select: { id: true, name: true } },
        deadlines: { where: { completedAt: null } },
        stateRule: true,
      },
    });

    const deadlines = this.analyzeDeadlines(cases);
    const atRisk = deadlines.filter(
      (d) => d.severity === "overdue" || d.severity === "critical" || d.severity === "urgent"
    ).length;

    return {
      totalCases: cases.length,
      atRisk,
      deadlines,
    };
  }
}

export const docketBot = new DocketBot();
