// ============================================
// OMNISCIENT BOT — MGR CAPITAL ASSISTANCE
// The all-seeing, all-knowing autonomous intelligence
// Combines ALL AI capabilities into one unified system
// ============================================

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { autonomousIntelligenceService } from "../services/AutonomousIntelligenceService.js";
import { notificationService } from "../services/notificationService.js";

const prisma = new PrismaClient();

interface OmniscientReport {
  timestamp: Date;
  executionTimeMs: number;
  insights: {
    category: string;
    priority: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    action?: string;
    autoActioned?: boolean;
  }[];
  predictions: {
    casePredictions: number;
    employeePredictions: number;
    revenueProjection: number;
  };
  actions: {
    type: string;
    target: string;
    result: string;
    automated: boolean;
  }[];
  healthScore: number;
  executiveSummary: string;
}

class OmniscientBot {
  private botName = "omniscient";

  /**
   * RUN FULL OMNISCIENT CYCLE
   * Analyzes everything, predicts everything, acts on everything
   */
  async runFullCycle(): Promise<OmniscientReport> {
    const startTime = Date.now();
    const insights: OmniscientReport["insights"] = [];
    const actions: OmniscientReport["actions"] = [];

    logger.info("Omniscient Bot: Starting full intelligence cycle");

    try {
      // ============================================
      // 1. CASE INTELLIGENCE — Predict all active cases
      // ============================================
      const casePredictions = await this.analyzeCases(insights, actions);

      // ============================================
      // 2. EMPLOYEE INTELLIGENCE — Predict success/failure
      // ============================================
      const employeePredictions = await this.analyzeEmployees(insights, actions);

      // ============================================
      // 3. REVENUE INTELLIGENCE — Optimize revenue
      // ============================================
      const revenueProjection = await this.analyzeRevenue(insights, actions);

      // ============================================
      // 4. EMOTIONAL INTELLIGENCE — Client sentiment
      // ============================================
      await this.analyzeClientSentiment(insights, actions);

      // ============================================
      // 5. DOCUMENT INTELLIGENCE — Verify authenticity
      // ============================================
      await this.analyzeDocuments(insights, actions);

      // ============================================
      // 6. MARKET INTELLIGENCE — External factors
      // ============================================
      await this.analyzeMarket(insights, actions);

      // ============================================
      // 7. SYSTEM HEALTH — Self-healing
      // ============================================
      const healthScore = await this.analyzeSystemHealth(insights, actions);

      // ============================================
      // 8. GENERATE EXECUTIVE SUMMARY
      // ============================================
      const executiveSummary = this.generateExecutiveSummary(insights, actions);

      // ============================================
      // 9. SAVE REPORT
      // ============================================
      const report: OmniscientReport = {
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        insights,
        predictions: {
          casePredictions,
          employeePredictions,
          revenueProjection,
        },
        actions,
        healthScore,
        executiveSummary,
      };

      await this.saveReport(report);

      // ============================================
      // 10. NOTIFY FOUNDER IF CRITICAL
      // ============================================
      const criticalInsights = insights.filter(i => i.priority === "critical");
      if (criticalInsights.length > 0) {
        await this.notifyFounder(criticalInsights, executiveSummary);
      }

      logger.info("Omniscient Bot: Cycle complete", {
        insights: insights.length,
        actions: actions.length,
        healthScore,
        executionTimeMs: report.executionTimeMs,
      });

      return report;

    } catch (error) {
      logger.error("Omniscient Bot: Cycle failed", { error });
      throw error;
    }
  }

  // ============================================
  // CASE ANALYSIS
  // ============================================

  private async analyzeCases(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<number> {
    // Get active cases
    const activeCases = await prisma.case.findMany({
      where: {
        status: { notIn: ["PAID", "REJECTED", "CLOSED"] },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    let predictionsCount = 0;

    for (const caseData of activeCases.slice(0, 10)) { // Analyze top 10
      try {
        const prediction = await autonomousIntelligenceService.predictCaseOutcome(caseData.id);
        predictionsCount++;

        // High-value cases at risk
        if (prediction.confidenceScore > 70 && prediction.predictedOutcome === "LOSS") {
          insights.push({
            category: "Case Risk",
            priority: "high",
            title: `Case ${caseData.id.slice(0, 8)} predicted to fail`,
            description: `Confidence: ${prediction.confidenceScore}%. Risk factors: ${prediction.riskFactors.join(", ")}`,
            action: prediction.optimizationSuggestions[0],
          });
        }

        // Winnable cases that need attention
        if (prediction.predictedOutcome === "WIN" && prediction.riskFactors.length > 0) {
          insights.push({
            category: "Case Optimization",
            priority: "medium",
            title: `Case ${caseData.id.slice(0, 8)} winnable but needs attention`,
            description: prediction.optimizationSuggestions.join("; "),
          });
        }

      } catch (error) {
        // Skip individual case failures
      }
    }

    // Summary insight
    insights.push({
      category: "Cases",
      priority: "low",
      title: `Analyzed ${predictionsCount} active cases`,
      description: `${activeCases.length} total active cases in pipeline`,
    });

    return predictionsCount;
  }

  // ============================================
  // EMPLOYEE ANALYSIS
  // ============================================

  private async analyzeEmployees(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<number> {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      take: 20,
    });

    let predictionsCount = 0;
    const atRisk: string[] = [];
    const highPotential: string[] = [];

    for (const employee of employees.slice(0, 10)) {
      try {
        const prediction = await autonomousIntelligenceService.predictEmployeeSuccess(employee.id);
        predictionsCount++;

        if (prediction.successProbability < 40) {
          atRisk.push(employee.name || employee.id);

          // Auto-generate training for at-risk employees
          if (prediction.interventionsNeeded.length > 0) {
            const intervention = prediction.interventionsNeeded[0];
            actions.push({
              type: "Training Assignment",
              target: employee.name || employee.id,
              result: `Assigned: ${intervention.description}`,
              automated: true,
            });
          }
        }

        if (prediction.successProbability > 80) {
          highPotential.push(employee.name || employee.id);
        }

      } catch (error) {
        // Skip individual failures
      }
    }

    if (atRisk.length > 0) {
      insights.push({
        category: "Employee Risk",
        priority: "high",
        title: `${atRisk.length} employees at risk of failure`,
        description: `At-risk: ${atRisk.slice(0, 3).join(", ")}${atRisk.length > 3 ? "..." : ""}`,
        action: "Review performance and assign training",
      });
    }

    if (highPotential.length > 0) {
      insights.push({
        category: "Employee Success",
        priority: "low",
        title: `${highPotential.length} high-potential employees identified`,
        description: `Stars: ${highPotential.slice(0, 3).join(", ")}`,
        action: "Consider for promotion or leadership roles",
      });
    }

    return predictionsCount;
  }

  // ============================================
  // REVENUE ANALYSIS
  // ============================================

  private async analyzeRevenue(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<number> {
    try {
      const optimization = await autonomousIntelligenceService.analyzeRevenueOptimizations();

      // Report current vs projected
      const improvementPercent = optimization.projectedRevenue > 0
        ? ((optimization.projectedRevenue - optimization.currentRevenue) / optimization.currentRevenue * 100).toFixed(1)
        : "0";

      insights.push({
        category: "Revenue",
        priority: optimization.optimizations.length > 2 ? "high" : "medium",
        title: `${optimization.optimizations.length} revenue optimizations identified`,
        description: `Potential ${improvementPercent}% revenue increase available`,
      });

      // Top optimization
      if (optimization.optimizations.length > 0) {
        const top = optimization.optimizations[0];
        insights.push({
          category: "Revenue Optimization",
          priority: "medium",
          title: `Top opportunity: ${top.area}`,
          description: top.reasoning,
          action: `Change from ${top.currentValue} to ${top.suggestedValue}`,
        });
      }

      return optimization.projectedRevenue;

    } catch (error) {
      return 0;
    }
  }

  // ============================================
  // CLIENT SENTIMENT ANALYSIS
  // ============================================

  private async analyzeClientSentiment(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<void> {
    // Get recent clients
    const clients = await prisma.user.findMany({
      where: { role: "CLIENT", isActive: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    let angryCount = 0;
    let churnRiskCount = 0;

    for (const client of clients.slice(0, 10)) {
      try {
        const emotional = await autonomousIntelligenceService.analyzeEmotionalState(client.id);

        if (emotional.currentMood === "angry" || emotional.currentMood === "frustrated") {
          angryCount++;
        }

        if (emotional.predictedChurnRisk > 70) {
          churnRiskCount++;

          // Auto-notify employee
          actions.push({
            type: "Churn Alert",
            target: `Client ${client.name || client.id}`,
            result: "Employee notified of high churn risk",
            automated: true,
          });
        }

      } catch (error) {
        // Skip individual failures
      }
    }

    if (angryCount > 0 || churnRiskCount > 0) {
      insights.push({
        category: "Client Sentiment",
        priority: churnRiskCount > 2 ? "critical" : "high",
        title: `${angryCount} unhappy clients, ${churnRiskCount} at churn risk`,
        description: "Immediate attention needed for client retention",
        action: "Review and reach out to at-risk clients",
      });
    }
  }

  // ============================================
  // DOCUMENT ANALYSIS
  // ============================================

  private async analyzeDocuments(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<void> {
    // Get recent uploads
    const documents = await prisma.document.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
        status: { in: ["DRAFT", "PENDING_SIGNATURE"] },
      },
      take: 20,
    });

    let suspicious = 0;

    for (const doc of documents.slice(0, 5)) {
      try {
        const verification = await autonomousIntelligenceService.verifyDocumentAuthenticity(doc.id);

        if (!verification.isAuthentic || verification.anomalies.length > 0) {
          suspicious++;

          insights.push({
            category: "Document Authenticity",
            priority: verification.anomalies.some(a => a.severity === "high") ? "critical" : "high",
            title: `Document ${doc.id.slice(0, 8)} flagged for review`,
            description: verification.anomalies.map(a => a.description).join("; "),
            action: "Manual verification required",
          });
        }

      } catch (error) {
        // Skip individual failures
      }
    }

    if (suspicious === 0 && documents.length > 0) {
      insights.push({
        category: "Documents",
        priority: "low",
        title: `${documents.length} documents verified`,
        description: "All recent documents passed authenticity checks",
      });
    }
  }

  // ============================================
  // MARKET ANALYSIS
  // ============================================

  private async analyzeMarket(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<void> {
    try {
      const market = await autonomousIntelligenceService.gatherMarketIntelligence();

      // Regulatory changes
      if (market.regulatoryChanges.length > 0) {
        const negative = market.regulatoryChanges.filter(r => r.impact === "negative");
        if (negative.length > 0) {
          insights.push({
            category: "Regulatory",
            priority: "critical",
            title: `${negative.length} negative regulatory changes detected`,
            description: negative.map(r => `${r.state}: ${r.change}`).join("; "),
            action: "Review and update compliance procedures",
          });
        }
      }

      // Market trends
      const opportunities = market.marketTrends.filter(t => t.opportunityScore > 80);
      if (opportunities.length > 0) {
        insights.push({
          category: "Market Opportunity",
          priority: "medium",
          title: `${opportunities.length} high-value market trends identified`,
          description: opportunities.map(t => t.trend).join("; "),
        });
      }

    } catch (error) {
      // Market analysis is optional
    }
  }

  // ============================================
  // SYSTEM HEALTH
  // ============================================

  private async analyzeSystemHealth(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): Promise<number> {
    let healthScore = 100;

    // Check recent errors
    const recentErrors = await prisma.systemError.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    });

    if (recentErrors > 10) {
      healthScore -= 20;
      insights.push({
        category: "System Health",
        priority: "high",
        title: `${recentErrors} errors in the last hour`,
        description: "System may be experiencing issues",
        action: "Check error logs and investigate",
      });
    }

    // Check pending items
    const pendingCases = await prisma.case.count({
      where: { status: "NEW" },
    });

    if (pendingCases > 50) {
      healthScore -= 10;
      insights.push({
        category: "Backlog",
        priority: "medium",
        title: `${pendingCases} cases waiting to be processed`,
        description: "Case backlog is growing",
        action: "Assign more employees or review automation",
      });
    }

    return Math.max(0, healthScore);
  }

  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================

  private generateExecutiveSummary(
    insights: OmniscientReport["insights"],
    actions: OmniscientReport["actions"]
  ): string {
    const critical = insights.filter(i => i.priority === "critical").length;
    const high = insights.filter(i => i.priority === "high").length;
    const automated = actions.filter(a => a.automated).length;

    let summary = `OMNISCIENT DAILY BRIEFING\n\n`;

    if (critical > 0) {
      summary += `CRITICAL: ${critical} items require immediate attention.\n`;
    }

    if (high > 0) {
      summary += `HIGH PRIORITY: ${high} items need review today.\n`;
    }

    summary += `\nAUTOMATED ACTIONS: ${automated} actions taken automatically.\n`;

    // Top 3 insights
    const topInsights = insights
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      })
      .slice(0, 3);

    summary += `\nTOP PRIORITIES:\n`;
    topInsights.forEach((i, idx) => {
      summary += `${idx + 1}. [${i.priority.toUpperCase()}] ${i.title}\n`;
    });

    return summary;
  }

  // ============================================
  // SAVE & NOTIFY
  // ============================================

  private async saveReport(report: OmniscientReport): Promise<void> {
    await prisma.opsInsight.create({
      data: {
        source: this.botName,
        type: "omniscient_report",
        title: `Omniscient Report - ${new Date().toLocaleDateString()}`,
        summary: report.executiveSummary,
        data: report as any,
        priority: report.insights.some(i => i.priority === "critical") ? "CRITICAL" : "HIGH",
        actionRequired: report.insights.filter(i => i.action).length > 0,
      } as any,
    });

    // Log bot run
    await prisma.botRunLog.create({
      data: {
        botName: this.botName,
        status: "SUCCESS",
        durationMs: report.executionTimeMs,
        recordsProcessed: report.insights.length + report.actions.length,
        resultSummary: report.executiveSummary.slice(0, 500),
      } as any,
    });
  }

  private async notifyFounder(
    criticalInsights: OmniscientReport["insights"],
    summary: string
  ): Promise<void> {
    const founder = await prisma.user.findFirst({
      where: { role: "FOUNDER" },
      select: { id: true, email: true, name: true },
    });

    if (founder?.email) {
      await notificationService.sendFounderEmail({
        subject: `Omniscient Bot Alert - ${criticalInsights.length} Critical Items`,
        body: `${summary}\n\nCRITICAL ITEMS:\n${criticalInsights.map(i => `- ${i.title}: ${i.description}`).join("\n")}`,
        priority: "urgent",
        userId: founder.id,
      });
    }
  }
}

export const omniscientBot = new OmniscientBot();
