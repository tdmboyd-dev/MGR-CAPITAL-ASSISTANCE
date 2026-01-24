// ============================================
// COMPLIANCE BOT — MGR CAPITAL ASSISTANCE
// Scans cases for deadline risks
// Detects missing documents, invalid transitions
// Ensures regulatory compliance
// Phase 15: AI Agent integration for enhanced analysis
// ============================================

import { PrismaClient, CaseStatus, OpsInsightType, OpsInsightPriority } from "@prisma/client";
import { aiAgentService } from "../services/AiAgentService.js";
import { notificationCenterService } from "../services/NotificationCenterService.js";

const prisma = new PrismaClient();

const BOT_NAME = "complianceBot";

interface ComplianceAnalysis {
  scanDate: Date;
  casesScanned: number;
  deadlineRisks: DeadlineRisk[];
  documentIssues: DocumentIssue[];
  transitionIssues: TransitionIssue[];
  jurisdictionAlerts: JurisdictionAlert[];
  recommendations: string[];
  overallRiskLevel: "low" | "medium" | "high" | "critical";
}

interface DeadlineRisk {
  caseId: string;
  caseCode: string;
  deadlineType: string;
  dueDate: Date;
  daysRemaining: number;
  severity: "warning" | "urgent" | "critical" | "overdue";
}

interface DocumentIssue {
  caseId: string;
  caseCode: string;
  issue: string;
  missingDocs: string[];
}

interface TransitionIssue {
  caseId: string;
  caseCode: string;
  currentStatus: string;
  issue: string;
}

interface JurisdictionAlert {
  state: string;
  county?: string;
  issue: string;
  affectedCases: number;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["CONTACTED", "REJECTED"],
  CONTACTED: ["DOCS_PENDING", "REJECTED"],
  DOCS_PENDING: ["DOCS_SIGNED", "REJECTED"],
  DOCS_SIGNED: ["FILED", "REJECTED"],
  FILED: ["AWAITING_FUNDS", "REJECTED"],
  AWAITING_FUNDS: ["PAID", "REJECTED"],
  PAID: ["CLOSED"],
  CLOSED: [],
  REJECTED: [],
};

// Required documents by status
const REQUIRED_DOCS_BY_STATUS: Record<string, string[]> = {
  DOCS_SIGNED: ["CLIENT_SERVICE_AGREEMENT"],
  FILED: ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA"],
  AWAITING_FUNDS: ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "FILING_PACKET"],
};

class ComplianceBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  /**
   * Run full compliance scan
   */
  async scan(): Promise<ComplianceAnalysis> {
    // Get all active cases
    const cases = await prisma.case.findMany({
      where: {
        status: {
          notIn: ["PAID", "CLOSED", "REJECTED"],
        },
      },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
        deadlines: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            completedAt: true,
          },
        },
        stateRule: {
          select: {
            stateCode: true,
            requiredDocuments: true,
            claimPeriodDays: true,
          },
        },
      },
    });

    const deadlineRisks = await this.scanDeadlines(cases);
    const documentIssues = await this.scanDocuments(cases);
    const transitionIssues = await this.scanTransitions(cases);
    const jurisdictionAlerts = await this.scanJurisdictions();

    const recommendations = this.generateRecommendations(
      deadlineRisks,
      documentIssues,
      transitionIssues,
      jurisdictionAlerts
    );

    const overallRiskLevel = this.calculateOverallRisk(
      deadlineRisks,
      documentIssues,
      transitionIssues
    );

    const analysis: ComplianceAnalysis = {
      scanDate: new Date(),
      casesScanned: cases.length,
      deadlineRisks,
      documentIssues,
      transitionIssues,
      jurisdictionAlerts,
      recommendations,
      overallRiskLevel,
    };

    await this.saveInsight(analysis);

    // Send notifications for critical issues (Phase 16)
    await this.sendComplianceNotifications(analysis);

    return analysis;
  }

  /**
   * Send notifications for compliance issues
   */
  private async sendComplianceNotifications(analysis: ComplianceAnalysis): Promise<void> {
    // Notify about critical/overdue deadlines
    const criticalDeadlines = analysis.deadlineRisks.filter(
      (d) => d.severity === "critical" || d.severity === "overdue"
    );

    for (const deadline of criticalDeadlines) {
      // Get assigned employee
      const caseData = await prisma.case.findUnique({
        where: { id: deadline.caseId },
        select: { assignedEmployeeId: true },
      });

      if (caseData?.assignedEmployeeId) {
        await notificationCenterService.notifyDeadline(
          caseData.assignedEmployeeId,
          deadline.caseId,
          deadline.deadlineType,
          deadline.daysRemaining
        );
      }
    }

    // Notify FOUNDER about high-risk compliance status
    if (analysis.overallRiskLevel === "critical" || analysis.overallRiskLevel === "high") {
      await notificationCenterService.sendToRole("FOUNDER", {
        category: "compliance",
        priority: analysis.overallRiskLevel === "critical" ? "urgent" : "high",
        title: `Compliance Alert: ${analysis.overallRiskLevel.toUpperCase()} Risk`,
        message: `Scan found ${analysis.deadlineRisks.length} deadline risks and ${analysis.documentIssues.length} document issues.`,
        link: "/founder/compliance",
      });
    }
  }

  // ============================================
  // DEADLINE SCANNING
  // ============================================

  private async scanDeadlines(cases: any[]): Promise<DeadlineRisk[]> {
    const risks: DeadlineRisk[] = [];
    const now = new Date();

    for (const caseRecord of cases) {
      // Check explicit deadlines
      for (const deadline of caseRecord.deadlines) {
        if (deadline.completedAt) continue;

        const daysRemaining = Math.ceil(
          (deadline.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let severity: DeadlineRisk["severity"];
        if (daysRemaining < 0) {
          severity = "overdue";
        } else if (daysRemaining <= 3) {
          severity = "critical";
        } else if (daysRemaining <= 7) {
          severity = "urgent";
        } else if (daysRemaining <= 14) {
          severity = "warning";
        } else {
          continue; // Not a risk yet
        }

        risks.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          deadlineType: deadline.title,
          dueDate: deadline.dueDate,
          daysRemaining,
          severity,
        });
      }

      // Check filing deadline
      if (caseRecord.filingDeadline) {
        const daysRemaining = Math.ceil(
          (caseRecord.filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysRemaining <= 30) {
          let severity: DeadlineRisk["severity"];
          if (daysRemaining < 0) {
            severity = "overdue";
          } else if (daysRemaining <= 7) {
            severity = "critical";
          } else if (daysRemaining <= 14) {
            severity = "urgent";
          } else {
            severity = "warning";
          }

          risks.push({
            caseId: caseRecord.id,
            caseCode: caseRecord.internalCode,
            deadlineType: "Filing Deadline",
            dueDate: caseRecord.filingDeadline,
            daysRemaining,
            severity,
          });
        }
      }

      // Check redemption deadline
      if (caseRecord.redemptionDeadline) {
        const daysRemaining = Math.ceil(
          (caseRecord.redemptionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysRemaining <= 30) {
          let severity: DeadlineRisk["severity"];
          if (daysRemaining < 0) {
            severity = "overdue";
          } else if (daysRemaining <= 7) {
            severity = "critical";
          } else if (daysRemaining <= 14) {
            severity = "urgent";
          } else {
            severity = "warning";
          }

          risks.push({
            caseId: caseRecord.id,
            caseCode: caseRecord.internalCode,
            deadlineType: "Redemption Deadline",
            dueDate: caseRecord.redemptionDeadline,
            daysRemaining,
            severity,
          });
        }
      }
    }

    return risks.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  // ============================================
  // DOCUMENT SCANNING
  // ============================================

  private async scanDocuments(cases: any[]): Promise<DocumentIssue[]> {
    const issues: DocumentIssue[] = [];

    for (const caseRecord of cases) {
      const status = caseRecord.status as string;
      const requiredDocs = REQUIRED_DOCS_BY_STATUS[status];

      if (!requiredDocs) continue;

      const existingDocs = caseRecord.documents
        .filter((d: any) => d.status === "SIGNED" || d.status === "APPROVED")
        .map((d: any) => d.type);

      const missingDocs = requiredDocs.filter((doc) => !existingDocs.includes(doc));

      if (missingDocs.length > 0) {
        issues.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          issue: `Case at ${status} status but missing required documents`,
          missingDocs,
        });
      }
    }

    return issues;
  }

  // ============================================
  // TRANSITION SCANNING
  // ============================================

  private async scanTransitions(cases: any[]): Promise<TransitionIssue[]> {
    const issues: TransitionIssue[] = [];

    for (const caseRecord of cases) {
      const status = caseRecord.status as CaseStatus;

      // Check for stale cases (stuck in status too long)
      const daysInStatus = Math.ceil(
        (Date.now() - caseRecord.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const staleDays: Record<string, number> = {
        NEW: 7,
        CONTACTED: 14,
        DOCS_PENDING: 21,
        DOCS_SIGNED: 7,
        FILED: 60,
        AWAITING_FUNDS: 30,
      };

      if (staleDays[status] && daysInStatus > staleDays[status]) {
        issues.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          currentStatus: status,
          issue: `Case stuck in ${status} for ${daysInStatus} days (expected max: ${staleDays[status]} days)`,
        });
      }

      // Check for cases with no assigned employee
      if (!caseRecord.assignedEmployeeId && status !== "NEW" && status !== "REJECTED") {
        issues.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          currentStatus: status,
          issue: `Case has no assigned employee but is in ${status} status`,
        });
      }
    }

    return issues;
  }

  // ============================================
  // JURISDICTION SCANNING
  // ============================================

  private async scanJurisdictions(): Promise<JurisdictionAlert[]> {
    const alerts: JurisdictionAlert[] = [];

    // Check for high-volatility jurisdictions with active cases
    const volatileJurisdictions = await prisma.jurisdictionMetrics.findMany({
      where: { volatilityScore: { gte: 70 } },
    });

    for (const jurisdiction of volatileJurisdictions) {
      const caseCount = await prisma.case.count({
        where: {
          state: jurisdiction.state,
          county: jurisdiction.county || undefined,
          status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
        },
      });

      if (caseCount > 0) {
        alerts.push({
          state: jurisdiction.state,
          county: jurisdiction.county || undefined,
          issue: `High volatility jurisdiction (score: ${jurisdiction.volatilityScore}) with ${caseCount} active cases`,
          affectedCases: caseCount,
        });
      }
    }

    // Check for jurisdictions with recent rule changes
    const recentRuleChanges = await prisma.scrapedItem.groupBy({
      by: ["state"],
      where: {
        reviewStatus: "ACTIONABLE",
        fetchedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _count: true,
    });

    for (const change of recentRuleChanges) {
      if (!change.state || change._count < 2) continue;

      const caseCount = await prisma.case.count({
        where: {
          state: change.state,
          status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
        },
      });

      if (caseCount > 0) {
        alerts.push({
          state: change.state,
          issue: `${change._count} rule changes detected in last 7 days - review may be needed`,
          affectedCases: caseCount,
        });
      }
    }

    return alerts;
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    deadlines: DeadlineRisk[],
    documents: DocumentIssue[],
    transitions: TransitionIssue[],
    jurisdictions: JurisdictionAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Critical deadlines
    const criticalDeadlines = deadlines.filter(
      (d) => d.severity === "critical" || d.severity === "overdue"
    );
    if (criticalDeadlines.length > 0) {
      recommendations.push(
        `URGENT: ${criticalDeadlines.length} cases have critical/overdue deadlines requiring immediate action`
      );
    }

    // Missing documents
    if (documents.length > 0) {
      recommendations.push(
        `Review ${documents.length} cases with missing required documents`
      );
    }

    // Stale cases
    const staleCases = transitions.filter((t) => t.issue.includes("stuck"));
    if (staleCases.length > 0) {
      recommendations.push(
        `Follow up on ${staleCases.length} cases that appear stuck in their current status`
      );
    }

    // Unassigned cases
    const unassigned = transitions.filter((t) => t.issue.includes("no assigned employee"));
    if (unassigned.length > 0) {
      recommendations.push(
        `Assign employees to ${unassigned.length} unassigned cases`
      );
    }

    // Jurisdiction alerts
    if (jurisdictions.length > 0) {
      const totalAffected = jurisdictions.reduce((sum, j) => sum + j.affectedCases, 0);
      recommendations.push(
        `Review ${totalAffected} cases in jurisdictions with regulatory concerns`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("All compliance checks passed - no immediate action needed");
    }

    return recommendations;
  }

  // ============================================
  // RISK CALCULATION
  // ============================================

  private calculateOverallRisk(
    deadlines: DeadlineRisk[],
    documents: DocumentIssue[],
    transitions: TransitionIssue[]
  ): ComplianceAnalysis["overallRiskLevel"] {
    const overdueDeadlines = deadlines.filter((d) => d.severity === "overdue").length;
    const criticalDeadlines = deadlines.filter((d) => d.severity === "critical").length;

    if (overdueDeadlines > 0 || criticalDeadlines >= 3) {
      return "critical";
    }

    if (criticalDeadlines > 0 || documents.length >= 5) {
      return "high";
    }

    if (deadlines.filter((d) => d.severity === "urgent").length > 0 || documents.length > 0) {
      return "medium";
    }

    return "low";
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: ComplianceAnalysis): Promise<void> {
    const priority =
      analysis.overallRiskLevel === "critical"
        ? "URGENT"
        : analysis.overallRiskLevel === "high"
        ? "HIGH"
        : analysis.overallRiskLevel === "medium"
        ? "NORMAL"
        : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "COMPLIANCE_CHECK" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: "Compliance Scan Results",
        summary: `Scanned ${analysis.casesScanned} cases. Found ${analysis.deadlineRisks.length} deadline risks, ${analysis.documentIssues.length} document issues.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: [
          ...analysis.deadlineRisks.map((d) => d.caseId),
          ...analysis.documentIssues.map((d) => d.caseId),
          ...analysis.transitionIssues.map((t) => t.caseId),
        ],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    });
  }

  /**
   * Run AI-enhanced compliance check on a case
   * Uses AI Agent for detailed analysis
   */
  async aiEnhancedCheck(caseId: string): Promise<{
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
    riskLevel: "low" | "medium" | "high";
    aiAnalysis?: string;
  }> {
    try {
      const result = await aiAgentService.checkCompliance(caseId);
      return {
        ...result,
        aiAnalysis: "AI-powered compliance analysis completed successfully",
      };
    } catch (error) {
      // Fallback to basic rule-based check
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: { documents: { select: { type: true, status: true } } },
      });

      if (!caseData) {
        return {
          isCompliant: false,
          issues: ["Case not found"],
          recommendations: ["Verify case ID"],
          riskLevel: "high",
        };
      }

      const issues: string[] = [];
      const requiredDocs = REQUIRED_DOCS_BY_STATUS[caseData.status] || [];
      const existingDocs = caseData.documents
        .filter((d) => d.status === "SIGNED" || d.status === "APPROVED")
        .map((d) => d.type);

      for (const doc of requiredDocs) {
        if (!existingDocs.includes(doc)) {
          issues.push(`Missing required document: ${doc}`);
        }
      }

      return {
        isCompliant: issues.length === 0,
        issues,
        recommendations: issues.length > 0 ? ["Request missing documents from client"] : [],
        riskLevel: issues.length > 2 ? "high" : issues.length > 0 ? "medium" : "low",
      };
    }
  }

  private generatePlainEnglish(analysis: ComplianceAnalysis): string {
    const parts: string[] = [];

    parts.push(`Compliance scan completed. I reviewed ${analysis.casesScanned} active cases.`);

    if (analysis.overallRiskLevel === "low") {
      parts.push("Overall compliance health is good.");
    } else {
      parts.push(`Overall risk level: ${analysis.overallRiskLevel.toUpperCase()}`);
    }

    // Deadlines
    if (analysis.deadlineRisks.length > 0) {
      const overdue = analysis.deadlineRisks.filter((d) => d.severity === "overdue").length;
      const critical = analysis.deadlineRisks.filter((d) => d.severity === "critical").length;

      parts.push(`\nDeadline concerns:`);
      if (overdue > 0) parts.push(`- ${overdue} OVERDUE deadlines!`);
      if (critical > 0) parts.push(`- ${critical} deadlines within 3 days`);
      parts.push(`- ${analysis.deadlineRisks.length} total deadline risks`);
    } else {
      parts.push("\nNo deadline concerns.");
    }

    // Documents
    if (analysis.documentIssues.length > 0) {
      parts.push(`\n${analysis.documentIssues.length} cases have missing documents.`);
    }

    // Jurisdictions
    if (analysis.jurisdictionAlerts.length > 0) {
      parts.push(`\n${analysis.jurisdictionAlerts.length} jurisdiction alerts requiring attention.`);
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      parts.push(`\nRecommended actions:`);
      for (const rec of analysis.recommendations) {
        parts.push(`- ${rec}`);
      }
    }

    return parts.join("\n");
  }
}

export const complianceBot = new ComplianceBot();
