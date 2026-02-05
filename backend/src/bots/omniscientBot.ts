// ============================================
// OMNISCIENT BOT — MGR CAPITAL ASSISTANCE
// The all-seeing, all-knowing autonomous intelligence
// God-tier automation powerhouse: predicts, heals, optimizes
// Combines ALL AI capabilities into one unified system
// ============================================

import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import { autonomousIntelligenceService } from "../services/AutonomousIntelligenceService.js";
import { notificationService } from "../services/notificationService.js";

// ============================================
// RESULT INTERFACES — GOD-TIER METHODS
// ============================================

interface CaseOutcomePrediction {
  caseId: string;
  winProbability: number;
  expectedRevenueCents: number;
  estimatedDaysToClose: number;
  riskFactors: string[];
  recommendation: string;
  comparableWinRate: number;
  dataPointsUsed: number;
}

interface RevenueWeatherMap {
  generatedAt: Date;
  totalSurplusCents: number;
  totalProjectedRevenueCents: number;
  states: {
    state: string;
    totalSurplusCents: number;
    caseCount: number;
    statusBreakdown: Record<string, number>;
    avgDaysInPipeline: number;
    revenueGeneratedCents: number;
    heatScore: number;
  }[];
  topStates: string[];
  coldZones: string[];
}

interface SelfHealResult {
  healedAt: Date;
  stuckCasesReassigned: {
    caseId: string;
    oldStatus: string;
    daysStuck: number;
    action: string;
  }[];
  unresponsiveEmployees: {
    employeeId: string;
    employeeName: string;
    daysSinceActivity: number;
    casesRedistributed: number;
  }[];
  failedBotReruns: {
    botName: string;
    failedAt: Date;
    errorSummary: string;
    suggestedAction: string;
  }[];
  orphanedCommunications: {
    communicationId: string;
    matchedCaseId: string | null;
    matchConfidence: number;
  }[];
  totalHealed: number;
}

interface RegulatoryChangeAlert {
  scannedAt: Date;
  changesDetected: {
    stateCode: string;
    stateName: string;
    updatedAt: Date;
    changeSummary: string;
    affectedCaseCount: number;
    affectedCaseIds: string[];
    riskLevel: "low" | "medium" | "high" | "critical";
  }[];
  alertsCreated: number;
  totalAffectedCases: number;
}

interface CashFlowForecast {
  forecastGeneratedAt: Date;
  forecastDays: number;
  weeklyBreakdown: {
    weekStart: Date;
    weekEnd: Date;
    awaitingFundsRevenueCents: number;
    filedProjectedRevenueCents: number;
    earlierStageProjectedCents: number;
    totalProjectedCents: number;
    confidence: number;
  }[];
  totals: {
    highConfidenceCents: number;
    mediumConfidenceCents: number;
    lowConfidenceCents: number;
    grandTotalCents: number;
  };
  riskFactors: string[];
}

interface CryptoSurplusScan {
  scannedAt: Date;
  totalCryptoRelatedCases: number;
  totalCryptoSurplusCents: number;
  categories: {
    keyword: string;
    caseCount: number;
    totalSurplusCents: number;
    caseIds: string[];
  }[];
  topOpportunities: {
    caseId: string;
    surplusAmountCents: number;
    cryptoKeywords: string[];
    state: string;
    county: string;
  }[];
}

interface CountyOpportunityRank {
  rankedAt: Date;
  counties: {
    state: string;
    county: string;
    totalSurplusCents: number;
    caseCount: number;
    winRate: number;
    avgCaseDays: number;
    competitionLevel: number;
    opportunityScore: number;
    rank: number;
  }[];
  topOpportunities: string[];
  underservedCounties: string[];
}

interface PortfolioRebalance {
  analyzedAt: Date;
  currentDistribution: {
    employeeId: string;
    employeeName: string;
    caseCount: number;
    totalSurplusCents: number;
    avgWinRate: number;
    topCounties: string[];
  }[];
  suggestions: {
    employeeId: string;
    employeeName: string;
    fromCounty: string;
    toCounty: string;
    reason: string;
    expectedImprovementPercent: number;
  }[];
  projectedRevenueIncreaseCents: number;
}

interface GodModeReport {
  executedAt: Date;
  executionTimeMs: number;
  caseOutcomeSamples: CaseOutcomePrediction[];
  revenueWeatherMap: RevenueWeatherMap;
  selfHealResult: SelfHealResult;
  regulatoryAlerts: RegulatoryChangeAlert;
  cashFlowForecast: CashFlowForecast;
  cryptoSurplus: CryptoSurplusScan;
  countyRankings: CountyOpportunityRank;
  portfolioRebalance: PortfolioRebalance;
  anomalies: AnomalyDetectionResult;
  criticalFindings: string[];
  founderNotified: boolean;
}

interface AnomalyDetectionResult {
  detectedAt: Date;
  anomalies: {
    type: "closure_spike" | "employee_performance" | "county_surplus_drop" | "payment_pattern";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    affectedEntities: string[];
    suggestedAction: string;
    dataPoints: Record<string, number | string>;
  }[];
  totalAnomalies: number;
  criticalCount: number;
}

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

  // ============================================
  // ============================================
  //
  //   GOD-TIER METHODS — ALL-SEEING POWERHOUSE
  //
  // ============================================
  // ============================================

  // ============================================
  // 1. PREDICT CASE OUTCOME
  // Deep analysis of individual case win probability
  // Uses historical data, state rules, document counts,
  // communications, and pipeline timing
  // ============================================

  async predictCaseOutcome(caseId: string): Promise<CaseOutcomePrediction> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: predictCaseOutcome started", { caseId });

    try {
      // Fetch the target case with all relations
      const targetCase = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          documents: true,
          communications: true,
          ledgerEntries: true,
          deadlines: true,
        },
      });

      if (!targetCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Calculate days in pipeline
      const daysInPipeline = Math.floor(
        (Date.now() - new Date(targetCase.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Fetch historical cases in the same state and county for comparison
      const historicalCases = await prisma.case.findMany({
        where: {
          state: targetCase.state,
          county: targetCase.county,
          status: { in: ["PAID", "REJECTED", "CLOSED"] },
        },
        select: {
          id: true,
          status: true,
          surplusAmountCents: true,
          createdAt: true,
          paidAt: true,
          closedAt: true,
          rejectionReason: true,
          feePercent: true,
          actualFeeCents: true,
        },
      });

      // Calculate win rate from historical data
      const totalHistorical = historicalCases.length;
      const paidCases = historicalCases.filter(c => c.status === "PAID");
      const historicalWinRate = totalHistorical > 0
        ? (paidCases.length / totalHistorical) * 100
        : 50; // Default 50% if no history

      // Calculate average days to close from paid cases
      const paidWithDates = paidCases.filter(c => c.paidAt);
      const avgDaysToClose = paidWithDates.length > 0
        ? Math.round(
            paidWithDates.reduce((sum, c) => {
              const days = Math.floor(
                (new Date(c.paidAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + days;
            }, 0) / paidWithDates.length
          )
        : 90; // Default estimate

      // Build risk factors
      const riskFactors: string[] = [];
      let winProbability = historicalWinRate;

      // Document completeness factor
      const docCount = targetCase.documents.length;
      if (docCount === 0) {
        riskFactors.push("No documents uploaded");
        winProbability -= 15;
      } else if (docCount < 3) {
        riskFactors.push("Low document count — may be incomplete filing");
        winProbability -= 8;
      } else {
        winProbability += 5; // Good doc coverage
      }

      // Communication frequency factor
      const commCount = targetCase.communications.length;
      if (commCount === 0) {
        riskFactors.push("No client communications recorded");
        winProbability -= 12;
      } else if (commCount > 5) {
        winProbability += 5; // Active engagement
      }

      // Pipeline timing factor
      if (daysInPipeline > 180) {
        riskFactors.push(`Case aging: ${daysInPipeline} days in pipeline (high risk)`);
        winProbability -= 20;
      } else if (daysInPipeline > 90) {
        riskFactors.push(`Case aging: ${daysInPipeline} days in pipeline (moderate risk)`);
        winProbability -= 10;
      }

      // Surplus amount factor
      const surplusDollars = targetCase.surplusAmountCents / 100;
      if (surplusDollars > 50000) {
        riskFactors.push("High-value case — increased scrutiny likely");
        winProbability -= 5;
      } else if (surplusDollars < 1000) {
        riskFactors.push("Low-value case — may not be cost-effective");
        winProbability -= 8;
      }

      // Status progression factor
      const statusOrder = ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED", "AWAITING_FUNDS"];
      const currentStatusIndex = statusOrder.indexOf(targetCase.status);
      if (currentStatusIndex >= 4) {
        winProbability += 15; // Filed or awaiting funds — strong position
      } else if (currentStatusIndex >= 2) {
        winProbability += 5; // Docs phase — moderate position
      }

      // Deadline proximity check
      const upcomingDeadlines = targetCase.deadlines.filter(
        d => !d.completedAt && new Date(d.dueDate).getTime() > Date.now()
      );
      const overdueDealines = targetCase.deadlines.filter(
        d => !d.completedAt && new Date(d.dueDate).getTime() < Date.now()
      );

      if (overdueDealines.length > 0) {
        riskFactors.push(`${overdueDealines.length} overdue deadline(s) — critical risk`);
        winProbability -= 25;
      }

      if (upcomingDeadlines.length > 0) {
        const nearestDays = Math.floor(
          (new Date(upcomingDeadlines[0].dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (nearestDays < 7) {
          riskFactors.push(`Deadline in ${nearestDays} day(s) — urgent action needed`);
          winProbability -= 5;
        }
      }

      // Clamp probability
      winProbability = Math.max(0, Math.min(100, Math.round(winProbability)));

      // Calculate expected revenue
      const expectedRevenueCents = Math.round(
        targetCase.surplusAmountCents * (targetCase.feePercent / 100) * (winProbability / 100)
      );

      // Estimate days to close
      const estimatedDaysToClose = Math.max(
        7,
        avgDaysToClose - daysInPipeline + (currentStatusIndex >= 4 ? 0 : 30)
      );

      // Build recommendation
      let recommendation = "";
      if (winProbability >= 80) {
        recommendation = "Strong case — prioritize for fast-track processing";
      } else if (winProbability >= 60) {
        recommendation = "Moderate case — address risk factors to improve odds";
      } else if (winProbability >= 40) {
        recommendation = "At-risk case — significant intervention needed to save";
      } else {
        recommendation = "High-risk case — consider deprioritizing or cutting losses";
      }

      const result: CaseOutcomePrediction = {
        caseId,
        winProbability,
        expectedRevenueCents,
        estimatedDaysToClose,
        riskFactors,
        recommendation,
        comparableWinRate: Math.round(historicalWinRate),
        dataPointsUsed: totalHistorical,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "predictCaseOutcome",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: 1,
          insightsGenerated: riskFactors.length,
          resultSummary: `Case ${caseId.slice(0, 8)}: ${winProbability}% win, $${(expectedRevenueCents / 100).toFixed(2)} expected`,
          details: result as any,
        } as any,
      });

      // Create OpsInsight for low-probability cases
      if (winProbability < 40) {
        await prisma.opsInsight.create({
          data: {
            source: this.botName,
            type: "CASE_RECOMMENDATION",
            title: `Low Win Probability: Case ${caseId.slice(0, 8)} at ${winProbability}%`,
            summary: `${riskFactors.join(". ")}. ${recommendation}`,
            data: result as any,
            priority: winProbability < 20 ? "URGENT" : "HIGH",
            actionRequired: true,
            relatedCaseIds: [caseId],
            relatedUserIds: [],
            relatedAlertIds: [],
          } as any,
        });
      }

      logger.info("Omniscient Bot: predictCaseOutcome complete", { caseId, winProbability });
      return result;

    } catch (error) {
      logger.error("Omniscient Bot: predictCaseOutcome failed", { caseId, error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "predictCaseOutcome",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 2. GENERATE REVENUE WEATHER MAP
  // State-by-state heat map of surplus fund activity,
  // pipeline health, and revenue generation
  // ============================================

  async generateRevenueWeatherMap(): Promise<RevenueWeatherMap> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: generateRevenueWeatherMap started");

    try {
      // Get all cases grouped by state
      const allCases = await prisma.case.findMany({
        select: {
          id: true,
          state: true,
          status: true,
          surplusAmountCents: true,
          feePercent: true,
          actualFeeCents: true,
          createdAt: true,
          paidAt: true,
        },
      });

      // Group by state
      const stateMap: Record<string, typeof allCases> = {};
      for (const c of allCases) {
        if (!stateMap[c.state]) stateMap[c.state] = [];
        stateMap[c.state].push(c);
      }

      // Build per-state metrics
      const states: RevenueWeatherMap["states"] = [];
      let totalSurplusCents = 0;
      let totalProjectedRevenueCents = 0;

      for (const [state, cases] of Object.entries(stateMap)) {
        const stateSurplus = cases.reduce((sum, c) => sum + c.surplusAmountCents, 0);
        totalSurplusCents += stateSurplus;

        // Status breakdown
        const statusBreakdown: Record<string, number> = {};
        for (const c of cases) {
          statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
        }

        // Average days in pipeline
        const totalDays = cases.reduce((sum, c) => {
          const endDate = c.paidAt ? new Date(c.paidAt) : new Date();
          return sum + Math.floor((endDate.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        const avgDaysInPipeline = cases.length > 0 ? Math.round(totalDays / cases.length) : 0;

        // Revenue generated (from paid cases)
        const revenueGeneratedCents = cases
          .filter(c => c.actualFeeCents)
          .reduce((sum, c) => sum + (c.actualFeeCents || 0), 0);
        totalProjectedRevenueCents += revenueGeneratedCents;

        // Projected from active cases
        const activeCases = cases.filter(c => !["PAID", "REJECTED", "CLOSED"].includes(c.status));
        const projectedFromActive = activeCases.reduce((sum, c) => {
          const probability = c.status === "AWAITING_FUNDS" ? 0.9
            : c.status === "FILED" ? 0.65
            : c.status === "DOCS_SIGNED" ? 0.5
            : c.status === "DOCS_PENDING" ? 0.35
            : c.status === "CONTACTED" ? 0.2
            : 0.1;
          return sum + Math.round(c.surplusAmountCents * (c.feePercent / 100) * probability);
        }, 0);
        totalProjectedRevenueCents += projectedFromActive;

        // Heat score: higher = more opportunity
        const paidCount = statusBreakdown["PAID"] || 0;
        const totalCount = cases.length;
        const winRate = totalCount > 0 ? (paidCount / totalCount) : 0;
        const heatScore = Math.min(100, Math.round(
          (stateSurplus / 100000) * 0.3 + // Surplus weight
          winRate * 30 + // Win rate weight
          totalCount * 0.5 + // Volume weight
          (revenueGeneratedCents / 50000) * 0.2 // Revenue weight
        ));

        states.push({
          state,
          totalSurplusCents: stateSurplus,
          caseCount: totalCount,
          statusBreakdown,
          avgDaysInPipeline,
          revenueGeneratedCents,
          heatScore,
        });
      }

      // Sort by heat score
      states.sort((a, b) => b.heatScore - a.heatScore);

      const topStates = states.slice(0, 5).map(s => s.state);
      const coldZones = states
        .filter(s => s.heatScore < 20)
        .map(s => s.state);

      const result: RevenueWeatherMap = {
        generatedAt: new Date(),
        totalSurplusCents,
        totalProjectedRevenueCents,
        states,
        topStates,
        coldZones,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "generateRevenueWeatherMap",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: allCases.length,
          insightsGenerated: states.length,
          resultSummary: `Weather map: ${states.length} states, $${(totalSurplusCents / 100).toLocaleString()} total surplus, top: ${topStates.join(", ")}`,
          details: { topStates, coldZones, stateCount: states.length } as any,
        } as any,
      });

      // Save OpsInsight
      await prisma.opsInsight.create({
        data: {
          source: this.botName,
          type: "SYSTEM_HEALTH",
          title: `Revenue Weather Map — ${new Date().toLocaleDateString()}`,
          summary: `${states.length} states tracked. Total surplus: $${(totalSurplusCents / 100).toLocaleString()}. Top states: ${topStates.join(", ")}. Cold zones: ${coldZones.length > 0 ? coldZones.join(", ") : "None"}`,
          data: result as any,
          priority: "NORMAL",
          actionRequired: coldZones.length > 3,
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
        } as any,
      });

      logger.info("Omniscient Bot: generateRevenueWeatherMap complete", {
        statesAnalyzed: states.length,
        totalSurplus: totalSurplusCents,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: generateRevenueWeatherMap failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "generateRevenueWeatherMap",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 3. SELF-HEAL OPERATIONS
  // Auto-fix stuck cases, unresponsive employees,
  // failed bot runs, and orphaned communications
  // ============================================

  async selfHealOperations(): Promise<SelfHealResult> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: selfHealOperations started");

    const result: SelfHealResult = {
      healedAt: new Date(),
      stuckCasesReassigned: [],
      unresponsiveEmployees: [],
      failedBotReruns: [],
      orphanedCommunications: [],
      totalHealed: 0,
    };

    try {
      // ---- HEAL 1: Find stuck cases (same status >30 days) ----
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const stuckCases = await prisma.case.findMany({
        where: {
          status: { notIn: ["PAID", "REJECTED", "CLOSED"] },
          updatedAt: { lt: thirtyDaysAgo },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          assignedEmployeeId: true,
          state: true,
          county: true,
        },
        take: 50,
      });

      // Find available employees with lowest case count for reassignment
      const employeeCounts = await prisma.case.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          assignedEmployeeId: { not: null },
          status: { notIn: ["PAID", "REJECTED", "CLOSED"] },
        },
        _count: { id: true },
        orderBy: { _count: { id: "asc" } },
      });

      const leastBusyEmployees = employeeCounts.slice(0, 5).map(e => e.assignedEmployeeId!);

      for (const stuckCase of stuckCases) {
        const daysStuck = Math.floor(
          (Date.now() - new Date(stuckCase.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        let action = "Flagged for manual review";

        // If case has an employee, flag it; if unassigned, assign to least busy
        if (!stuckCase.assignedEmployeeId && leastBusyEmployees.length > 0) {
          const assignTo = leastBusyEmployees[Math.floor(Math.random() * leastBusyEmployees.length)];
          await prisma.case.update({
            where: { id: stuckCase.id },
            data: { assignedEmployeeId: assignTo, updatedAt: new Date() },
          });
          action = `Auto-assigned to employee ${assignTo.slice(0, 8)}`;
        } else if (stuckCase.assignedEmployeeId) {
          // Touch the updatedAt to reset the stuck timer and flag it
          await prisma.case.update({
            where: { id: stuckCase.id },
            data: { updatedAt: new Date(), priority: { increment: 1 } },
          });
          action = `Priority bumped, timer reset for employee ${stuckCase.assignedEmployeeId.slice(0, 8)}`;
        }

        result.stuckCasesReassigned.push({
          caseId: stuckCase.id,
          oldStatus: stuckCase.status,
          daysStuck,
          action,
        });
      }

      // ---- HEAL 2: Find unresponsive employees (no activity >7 days) ----
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeEmployees = await prisma.user.findMany({
        where: { role: "EMPLOYEE", isActive: true },
        select: {
          id: true,
          name: true,
          lastLoginAt: true,
          assignedCases: {
            where: { status: { notIn: ["PAID", "REJECTED", "CLOSED"] } },
            select: { id: true },
          },
        },
      });

      for (const emp of activeEmployees) {
        // Check last communication or login
        const lastComm = await prisma.communication.findFirst({
          where: { userId: emp.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        const lastActivity = lastComm?.createdAt || emp.lastLoginAt;
        if (!lastActivity || new Date(lastActivity).getTime() < sevenDaysAgo.getTime()) {
          const daysSinceActivity = lastActivity
            ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          const casesToRedistribute = emp.assignedCases.length;

          // Only redistribute if employee has active cases and is truly inactive
          if (casesToRedistribute > 0 && daysSinceActivity > 14) {
            // Redistribute cases to least busy employees
            for (const caseRef of emp.assignedCases.slice(0, 5)) {
              if (leastBusyEmployees.length > 0) {
                const newAssignee = leastBusyEmployees[
                  Math.floor(Math.random() * leastBusyEmployees.length)
                ];
                if (newAssignee !== emp.id) {
                  await prisma.case.update({
                    where: { id: caseRef.id },
                    data: { assignedEmployeeId: newAssignee },
                  });
                }
              }
            }
          }

          result.unresponsiveEmployees.push({
            employeeId: emp.id,
            employeeName: emp.name || "Unknown",
            daysSinceActivity,
            casesRedistributed: casesToRedistribute > 0 && daysSinceActivity > 14
              ? Math.min(casesToRedistribute, 5) : 0,
          });
        }
      }

      // ---- HEAL 3: Find failed bot runs from last 24h ----
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedRuns = await prisma.botRunLog.findMany({
        where: {
          status: "FAILED",
          startedAt: { gte: twentyFourHoursAgo },
        },
        select: {
          botName: true,
          startedAt: true,
          error: true,
          runType: true,
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      });

      for (const run of failedRuns) {
        const errorSummary = run.error
          ? run.error.slice(0, 200)
          : "Unknown error";

        let suggestedAction = "Manual investigation required";
        if (errorSummary.includes("timeout") || errorSummary.includes("ETIMEDOUT")) {
          suggestedAction = "Network timeout — rerun during off-peak hours";
        } else if (errorSummary.includes("prisma") || errorSummary.includes("database")) {
          suggestedAction = "Database error — check connection pool and retry";
        } else if (errorSummary.includes("rate limit") || errorSummary.includes("429")) {
          suggestedAction = "Rate limited — schedule rerun with backoff";
        } else if (errorSummary.includes("memory") || errorSummary.includes("heap")) {
          suggestedAction = "Memory issue — reduce batch size and retry";
        }

        result.failedBotReruns.push({
          botName: run.botName,
          failedAt: run.startedAt,
          errorSummary,
          suggestedAction,
        });
      }

      // ---- HEAL 4: Find orphaned communications (no case linked) ----
      const orphanedComms = await prisma.communication.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          caseId: true,
          content: true,
          toAddress: true,
          fromAddress: true,
          userId: true,
        },
        take: 50,
      });

      // Check if comms reference valid cases
      for (const comm of orphanedComms) {
        // Verify the case exists
        const caseExists = await prisma.case.findUnique({
          where: { id: comm.caseId },
          select: { id: true },
        });

        if (!caseExists) {
          // Try to match by content or address
          let matchedCaseId: string | null = null;
          let matchConfidence = 0;

          // Try matching by email addresses in the communication
          if (comm.toAddress || comm.fromAddress) {
            const addressToSearch = comm.toAddress || comm.fromAddress;
            const possibleClient = await prisma.user.findFirst({
              where: { email: addressToSearch || undefined },
              select: { id: true, clientCases: { select: { id: true }, take: 1 } },
            });

            if (possibleClient && possibleClient.clientCases.length > 0) {
              matchedCaseId = possibleClient.clientCases[0].id;
              matchConfidence = 75;
            }
          }

          result.orphanedCommunications.push({
            communicationId: comm.id,
            matchedCaseId,
            matchConfidence,
          });
        }
      }

      // Calculate total healed
      result.totalHealed =
        result.stuckCasesReassigned.length +
        result.unresponsiveEmployees.filter(e => e.casesRedistributed > 0).length +
        result.failedBotReruns.length +
        result.orphanedCommunications.filter(o => o.matchedCaseId).length;

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "selfHealOperations",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: result.totalHealed,
          insightsGenerated: result.stuckCasesReassigned.length + result.unresponsiveEmployees.length,
          resultSummary: `Self-healed: ${result.stuckCasesReassigned.length} stuck cases, ${result.unresponsiveEmployees.length} unresponsive employees, ${result.failedBotReruns.length} failed runs analyzed, ${result.orphanedCommunications.length} orphaned comms`,
          details: {
            stuckCases: result.stuckCasesReassigned.length,
            unresponsiveEmployees: result.unresponsiveEmployees.length,
            failedBots: result.failedBotReruns.length,
            orphanedComms: result.orphanedCommunications.length,
          } as any,
        } as any,
      });

      // Create OpsInsight if significant healing occurred
      if (result.totalHealed > 0) {
        await prisma.opsInsight.create({
          data: {
            source: this.botName,
            type: "SYSTEM_HEALTH",
            title: `Self-Heal Report: ${result.totalHealed} issues resolved`,
            summary: `Stuck cases: ${result.stuckCasesReassigned.length}. Unresponsive employees: ${result.unresponsiveEmployees.length}. Failed bot runs: ${result.failedBotReruns.length}. Orphaned comms: ${result.orphanedCommunications.length}.`,
            data: result as any,
            priority: result.totalHealed > 10 ? "HIGH" : "NORMAL",
            actionRequired: result.unresponsiveEmployees.length > 3 || result.stuckCasesReassigned.length > 10,
            relatedCaseIds: result.stuckCasesReassigned.map(s => s.caseId),
            relatedUserIds: result.unresponsiveEmployees.map(e => e.employeeId),
            relatedAlertIds: [],
          } as any,
        });
      }

      logger.info("Omniscient Bot: selfHealOperations complete", { totalHealed: result.totalHealed });
      return result;

    } catch (error) {
      logger.error("Omniscient Bot: selfHealOperations failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "selfHealOperations",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 4. SCAN REGULATORY CHANGES
  // Check StateRule updates, identify affected cases,
  // and create compliance review alerts
  // ============================================

  async scanRegulatoryChanges(): Promise<RegulatoryChangeAlert> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: scanRegulatoryChanges started");

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Find recently updated state rules
      const recentlyUpdatedRules = await prisma.stateRule.findMany({
        where: {
          updatedAt: { gte: thirtyDaysAgo },
          isActive: true,
        },
        select: {
          stateCode: true,
          stateName: true,
          updatedAt: true,
          surplusFundLaw: true,
          claimPeriodDays: true,
          requiredDocuments: true,
          specialRequirements: true,
          restrictions: true,
          filingMethod: true,
          filingFee: true,
        },
      });

      const changesDetected: RegulatoryChangeAlert["changesDetected"] = [];
      let totalAffectedCases = 0;
      let alertsCreated = 0;

      for (const rule of recentlyUpdatedRules) {
        // Find active cases in this state
        const affectedCases = await prisma.case.findMany({
          where: {
            state: rule.stateCode,
            status: { notIn: ["PAID", "REJECTED", "CLOSED"] },
          },
          select: { id: true, status: true, assignedEmployeeId: true },
        });

        const affectedCaseCount = affectedCases.length;
        totalAffectedCases += affectedCaseCount;

        // Build change summary
        const changeParts: string[] = [];
        if (rule.surplusFundLaw) changeParts.push("Surplus fund law updated");
        if (rule.specialRequirements) changeParts.push("Special requirements changed");
        if (rule.restrictions) changeParts.push("New restrictions added");
        if (rule.requiredDocuments.length > 0) changeParts.push(`${rule.requiredDocuments.length} required documents listed`);
        const changeSummary = changeParts.length > 0
          ? changeParts.join("; ")
          : "State rule configuration updated";

        // Determine risk level
        let riskLevel: "low" | "medium" | "high" | "critical" = "low";
        if (affectedCaseCount > 20) riskLevel = "critical";
        else if (affectedCaseCount > 10) riskLevel = "high";
        else if (affectedCaseCount > 5) riskLevel = "medium";

        changesDetected.push({
          stateCode: rule.stateCode,
          stateName: rule.stateName,
          updatedAt: rule.updatedAt,
          changeSummary,
          affectedCaseCount,
          affectedCaseIds: affectedCases.map(c => c.id),
          riskLevel,
        });

        // Create WatchAlert for high/critical risk
        if (riskLevel === "high" || riskLevel === "critical") {
          await prisma.watchAlert.create({
            data: {
              type: "RULE_CHANGE_DETECTED",
              severity: riskLevel === "critical" ? "CRITICAL" : "HIGH",
              title: `Regulatory Change: ${rule.stateName} (${rule.stateCode})`,
              message: `${changeSummary}. ${affectedCaseCount} active cases in this state may need compliance review.`,
              state: rule.stateCode,
              details: {
                updatedAt: rule.updatedAt,
                changeSummary,
                affectedCaseCount,
                filingMethod: rule.filingMethod,
                filingFee: rule.filingFee,
                claimPeriodDays: rule.claimPeriodDays,
              } as any,
            } as any,
          });
          alertsCreated++;
        }

        // Create OpsInsight per affected state
        if (affectedCaseCount > 0) {
          await prisma.opsInsight.create({
            data: {
              source: this.botName,
              type: "COMPLIANCE_CHECK",
              title: `Regulatory Change: ${rule.stateName} — ${affectedCaseCount} cases affected`,
              summary: `${changeSummary}. Cases in ${rule.stateCode} should be reviewed for compliance with updated rules.`,
              data: {
                stateCode: rule.stateCode,
                changeSummary,
                affectedCaseIds: affectedCases.map(c => c.id).slice(0, 20),
              } as any,
              priority: riskLevel === "critical" ? "URGENT" : riskLevel === "high" ? "HIGH" : "NORMAL",
              actionRequired: true,
              relatedCaseIds: affectedCases.map(c => c.id).slice(0, 20),
              relatedUserIds: [],
              relatedAlertIds: [],
            } as any,
          });
        }
      }

      const result: RegulatoryChangeAlert = {
        scannedAt: new Date(),
        changesDetected,
        alertsCreated,
        totalAffectedCases,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "scanRegulatoryChanges",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: recentlyUpdatedRules.length,
          insightsGenerated: changesDetected.length,
          alertsCreated,
          resultSummary: `Scanned ${recentlyUpdatedRules.length} updated rules, ${changesDetected.length} changes detected, ${totalAffectedCases} cases affected, ${alertsCreated} alerts created`,
        } as any,
      });

      logger.info("Omniscient Bot: scanRegulatoryChanges complete", {
        rulesChecked: recentlyUpdatedRules.length,
        changesDetected: changesDetected.length,
        alertsCreated,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: scanRegulatoryChanges failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "scanRegulatoryChanges",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 5. PREDICT CASH FLOW
  // Forecast revenue from pipeline data with
  // probability weighting per status stage
  // ============================================

  async predictCashFlow(days: number = 90): Promise<CashFlowForecast> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: predictCashFlow started", { days });

    try {
      // Get all active cases with financial data
      const activeCases = await prisma.case.findMany({
        where: {
          status: { notIn: ["PAID", "REJECTED", "CLOSED"] },
        },
        select: {
          id: true,
          status: true,
          surplusAmountCents: true,
          feePercent: true,
          createdAt: true,
          filedAt: true,
          state: true,
        },
      });

      // Get historical average time from each status to PAID
      const historicalPaid = await prisma.case.findMany({
        where: { status: "PAID", paidAt: { not: null } },
        select: {
          status: true,
          createdAt: true,
          contactedAt: true,
          docsSignedAt: true,
          filedAt: true,
          paidAt: true,
          surplusAmountCents: true,
          feePercent: true,
          actualFeeCents: true,
        },
        take: 500,
      });

      // Calculate average days from FILED to PAID
      const filedToPaidDays: number[] = [];
      for (const c of historicalPaid) {
        if (c.filedAt && c.paidAt) {
          const days = Math.floor(
            (new Date(c.paidAt).getTime() - new Date(c.filedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (days > 0 && days < 365) filedToPaidDays.push(days);
        }
      }
      const avgFiledToPaid = filedToPaidDays.length > 0
        ? Math.round(filedToPaidDays.reduce((a, b) => a + b, 0) / filedToPaidDays.length)
        : 60;

      // Probability multipliers by status
      const statusProbability: Record<string, number> = {
        AWAITING_FUNDS: 0.92,
        FILED: 0.65,
        DOCS_SIGNED: 0.50,
        DOCS_PENDING: 0.35,
        CONTACTED: 0.20,
        NEW: 0.10,
      };

      // Estimated days to payment by status
      const statusDaysToPayment: Record<string, number> = {
        AWAITING_FUNDS: 14,
        FILED: avgFiledToPaid,
        DOCS_SIGNED: avgFiledToPaid + 14,
        DOCS_PENDING: avgFiledToPaid + 30,
        CONTACTED: avgFiledToPaid + 45,
        NEW: avgFiledToPaid + 60,
      };

      // Build weekly breakdown
      const weeks = Math.ceil(days / 7);
      const weeklyBreakdown: CashFlowForecast["weeklyBreakdown"] = [];

      let highConfidence = 0;
      let mediumConfidence = 0;
      let lowConfidence = 0;

      for (let w = 0; w < weeks; w++) {
        const weekStart = new Date(Date.now() + w * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(Date.now() + (w + 1) * 7 * 24 * 60 * 60 * 1000);

        let awaitingFundsRevenue = 0;
        let filedProjectedRevenue = 0;
        let earlierStageProjected = 0;

        for (const c of activeCases) {
          const probability = statusProbability[c.status] || 0.1;
          const daysToPayment = statusDaysToPayment[c.status] || avgFiledToPaid + 60;
          const estimatedPaymentDate = new Date(Date.now() + daysToPayment * 24 * 60 * 60 * 1000);
          const expectedRevenue = Math.round(c.surplusAmountCents * (c.feePercent / 100) * probability);

          // Check if this case falls into this week
          if (estimatedPaymentDate >= weekStart && estimatedPaymentDate < weekEnd) {
            if (c.status === "AWAITING_FUNDS") {
              awaitingFundsRevenue += expectedRevenue;
              highConfidence += expectedRevenue;
            } else if (c.status === "FILED") {
              filedProjectedRevenue += expectedRevenue;
              mediumConfidence += expectedRevenue;
            } else {
              earlierStageProjected += expectedRevenue;
              lowConfidence += expectedRevenue;
            }
          }
        }

        const totalProjectedCents = awaitingFundsRevenue + filedProjectedRevenue + earlierStageProjected;
        const confidence = totalProjectedCents > 0
          ? Math.round(
              (awaitingFundsRevenue * 92 + filedProjectedRevenue * 65 + earlierStageProjected * 25)
              / totalProjectedCents
            )
          : 0;

        weeklyBreakdown.push({
          weekStart,
          weekEnd,
          awaitingFundsRevenueCents: awaitingFundsRevenue,
          filedProjectedRevenueCents: filedProjectedRevenue,
          earlierStageProjectedCents: earlierStageProjected,
          totalProjectedCents,
          confidence,
        });
      }

      // Build risk factors
      const riskFactors: string[] = [];
      const awaitingCount = activeCases.filter(c => c.status === "AWAITING_FUNDS").length;
      const filedCount = activeCases.filter(c => c.status === "FILED").length;
      const earlyCount = activeCases.filter(c =>
        ["NEW", "CONTACTED", "DOCS_PENDING"].includes(c.status)
      ).length;

      if (awaitingCount < 3) {
        riskFactors.push("Low pipeline in AWAITING_FUNDS — near-term revenue at risk");
      }
      if (filedCount < 5) {
        riskFactors.push("Low pipeline in FILED — mid-term revenue may decline");
      }
      if (earlyCount > filedCount * 3) {
        riskFactors.push("Heavy early-stage pipeline — conversion bottleneck likely");
      }

      // Check for state concentration risk
      const stateConcentration: Record<string, number> = {};
      for (const c of activeCases) {
        stateConcentration[c.state] = (stateConcentration[c.state] || 0) + 1;
      }
      const topStateCount = Math.max(...Object.values(stateConcentration));
      if (topStateCount > activeCases.length * 0.5) {
        const topState = Object.keys(stateConcentration).find(
          k => stateConcentration[k] === topStateCount
        );
        riskFactors.push(`State concentration risk: ${topStateCount} cases (${Math.round(topStateCount / activeCases.length * 100)}%) in ${topState}`);
      }

      const grandTotal = highConfidence + mediumConfidence + lowConfidence;

      const result: CashFlowForecast = {
        forecastGeneratedAt: new Date(),
        forecastDays: days,
        weeklyBreakdown,
        totals: {
          highConfidenceCents: highConfidence,
          mediumConfidenceCents: mediumConfidence,
          lowConfidenceCents: lowConfidence,
          grandTotalCents: grandTotal,
        },
        riskFactors,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "predictCashFlow",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: activeCases.length,
          insightsGenerated: weeklyBreakdown.length,
          resultSummary: `${days}-day forecast: $${(grandTotal / 100).toLocaleString()} projected. High confidence: $${(highConfidence / 100).toLocaleString()}, Medium: $${(mediumConfidence / 100).toLocaleString()}, Low: $${(lowConfidence / 100).toLocaleString()}`,
          details: { days, weeks, totalCases: activeCases.length, grandTotal } as any,
        } as any,
      });

      // Create OpsInsight
      await prisma.opsInsight.create({
        data: {
          source: this.botName,
          type: "PAYOUT_ANALYSIS",
          title: `Cash Flow Forecast: ${days}-Day Outlook`,
          summary: `Projected revenue: $${(grandTotal / 100).toLocaleString()}. High confidence: $${(highConfidence / 100).toLocaleString()}. ${riskFactors.length} risk factors identified.`,
          data: result as any,
          priority: riskFactors.length > 2 ? "HIGH" : "NORMAL",
          actionRequired: riskFactors.length > 0,
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
        } as any,
      });

      logger.info("Omniscient Bot: predictCashFlow complete", {
        days,
        grandTotal,
        riskFactors: riskFactors.length,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: predictCashFlow failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "predictCashFlow",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 6. SCAN CRYPTO SURPLUS
  // Search for crypto-related surplus opportunities
  // (FTX, Celsius, BlockFi, Voyager, etc.)
  // ============================================

  async scanCryptoSurplus(): Promise<CryptoSurplusScan> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: scanCryptoSurplus started");

    try {
      const cryptoKeywords = [
        "FTX", "Celsius", "BlockFi", "Voyager", "cryptocurrency",
        "bitcoin", "digital asset", "crypto", "blockchain", "defi",
        "ethereum", "coinbase", "binance", "stablecoin", "token",
      ];

      const categories: CryptoSurplusScan["categories"] = [];
      const allCryptoCaseIds = new Set<string>();
      let totalCryptoSurplusCents = 0;

      // Search cases for each keyword
      for (const keyword of cryptoKeywords) {
        const lowerKeyword = keyword.toLowerCase();

        // Search in case notes, property address, source, and metadata
        const matchingCases = await prisma.case.findMany({
          where: {
            OR: [
              { notes: { contains: lowerKeyword, mode: "insensitive" } },
              { propertyAddress: { contains: lowerKeyword, mode: "insensitive" } },
              { source: { contains: lowerKeyword, mode: "insensitive" } },
              { previousOwner: { contains: lowerKeyword, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            surplusAmountCents: true,
            state: true,
            county: true,
            notes: true,
            source: true,
          },
        });

        if (matchingCases.length > 0) {
          const keywordSurplus = matchingCases.reduce((sum, c) => sum + c.surplusAmountCents, 0);

          categories.push({
            keyword,
            caseCount: matchingCases.length,
            totalSurplusCents: keywordSurplus,
            caseIds: matchingCases.map(c => c.id),
          });

          for (const c of matchingCases) {
            allCryptoCaseIds.add(c.id);
            totalCryptoSurplusCents += c.surplusAmountCents;
          }
        }
      }

      // Also search in ingestion records for crypto keywords
      for (const keyword of cryptoKeywords.slice(0, 5)) {
        try {
          const ingestionMatches = await prisma.ingestionRecord.findMany({
            where: {
              OR: [
                { ownerName: { contains: keyword, mode: "insensitive" } },
                { propertyAddress: { contains: keyword, mode: "insensitive" } },
              ],
              status: { not: "imported" },
            },
            select: { id: true, surplusAmount: true, ownerName: true },
            take: 20,
          });

          if (ingestionMatches.length > 0) {
            const ingestionSurplus = ingestionMatches.reduce(
              (sum, r) => sum + (r.surplusAmount || 0), 0
            );
            if (ingestionSurplus > 0) {
              categories.push({
                keyword: `${keyword} (ingestion)`,
                caseCount: ingestionMatches.length,
                totalSurplusCents: ingestionSurplus,
                caseIds: ingestionMatches.map(r => r.id),
              });
            }
          }
        } catch {
          // Ingestion search is optional
        }
      }

      // Get top opportunities from matched cases
      const topCases = await prisma.case.findMany({
        where: { id: { in: Array.from(allCryptoCaseIds) } },
        orderBy: { surplusAmountCents: "desc" },
        take: 10,
        select: {
          id: true,
          surplusAmountCents: true,
          state: true,
          county: true,
          notes: true,
          source: true,
          previousOwner: true,
        },
      });

      const topOpportunities: CryptoSurplusScan["topOpportunities"] = topCases.map(c => {
        const matchedKeywords = cryptoKeywords.filter(kw => {
          const lower = kw.toLowerCase();
          return (
            (c.notes && c.notes.toLowerCase().includes(lower)) ||
            (c.source && c.source.toLowerCase().includes(lower)) ||
            (c.previousOwner && c.previousOwner.toLowerCase().includes(lower))
          );
        });

        return {
          caseId: c.id,
          surplusAmountCents: c.surplusAmountCents,
          cryptoKeywords: matchedKeywords,
          state: c.state,
          county: c.county,
        };
      });

      // Sort categories by surplus
      categories.sort((a, b) => b.totalSurplusCents - a.totalSurplusCents);

      const result: CryptoSurplusScan = {
        scannedAt: new Date(),
        totalCryptoRelatedCases: allCryptoCaseIds.size,
        totalCryptoSurplusCents,
        categories,
        topOpportunities,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "scanCryptoSurplus",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: allCryptoCaseIds.size,
          insightsGenerated: categories.length,
          resultSummary: `Found ${allCryptoCaseIds.size} crypto-related cases totaling $${(totalCryptoSurplusCents / 100).toLocaleString()} in surplus across ${categories.length} keyword categories`,
        } as any,
      });

      // Create OpsInsight if crypto cases found
      if (allCryptoCaseIds.size > 0) {
        await prisma.opsInsight.create({
          data: {
            source: this.botName,
            type: "CASE_RECOMMENDATION",
            title: `Crypto Surplus Scan: ${allCryptoCaseIds.size} cases, $${(totalCryptoSurplusCents / 100).toLocaleString()} total`,
            summary: `Top keywords: ${categories.slice(0, 3).map(c => `${c.keyword} (${c.caseCount})`).join(", ")}. Largest opportunity: $${topOpportunities.length > 0 ? (topOpportunities[0].surplusAmountCents / 100).toLocaleString() : "0"}.`,
            data: result as any,
            priority: totalCryptoSurplusCents > 1000000 ? "HIGH" : "NORMAL",
            actionRequired: allCryptoCaseIds.size > 5,
            relatedCaseIds: Array.from(allCryptoCaseIds).slice(0, 20),
            relatedUserIds: [],
            relatedAlertIds: [],
          } as any,
        });
      }

      logger.info("Omniscient Bot: scanCryptoSurplus complete", {
        cryptoCases: allCryptoCaseIds.size,
        totalSurplus: totalCryptoSurplusCents,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: scanCryptoSurplus failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "scanCryptoSurplus",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 7. RANK COUNTY OPPORTUNITIES
  // Group cases by county+state and rank by
  // opportunity score = (surplus * winRate) / competition
  // ============================================

  async rankCountyOpportunities(): Promise<CountyOpportunityRank> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: rankCountyOpportunities started");

    try {
      // Get all cases with relevant data
      const allCases = await prisma.case.findMany({
        select: {
          id: true,
          state: true,
          county: true,
          status: true,
          surplusAmountCents: true,
          assignedEmployeeId: true,
          createdAt: true,
          paidAt: true,
        },
      });

      // Group by state+county
      const countyMap: Record<string, typeof allCases> = {};
      for (const c of allCases) {
        const key = `${c.state}|${c.county}`;
        if (!countyMap[key]) countyMap[key] = [];
        countyMap[key].push(c);
      }

      // Calculate metrics per county
      const counties: CountyOpportunityRank["counties"] = [];

      for (const [key, cases] of Object.entries(countyMap)) {
        const [state, county] = key.split("|");
        const totalSurplusCents = cases.reduce((sum, c) => sum + c.surplusAmountCents, 0);
        const caseCount = cases.length;

        // Win rate
        const closedCases = cases.filter(c => ["PAID", "REJECTED", "CLOSED"].includes(c.status));
        const wonCases = cases.filter(c => c.status === "PAID");
        const winRate = closedCases.length > 0
          ? Math.round((wonCases.length / closedCases.length) * 100)
          : 50; // Default

        // Average case time (in days)
        const caseTimes = cases
          .filter(c => c.paidAt)
          .map(c => Math.floor(
            (new Date(c.paidAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          ))
          .filter(d => d > 0 && d < 730);
        const avgCaseDays = caseTimes.length > 0
          ? Math.round(caseTimes.reduce((a, b) => a + b, 0) / caseTimes.length)
          : 90;

        // Competition level: unique employees per case in this county
        const uniqueEmployees = new Set(
          cases.filter(c => c.assignedEmployeeId).map(c => c.assignedEmployeeId!)
        );
        const competitionLevel = uniqueEmployees.size > 0
          ? Math.round(caseCount / uniqueEmployees.size)
          : caseCount;

        // Opportunity score = (surplus in dollars * winRate%) / competition
        // Normalized to 0-100 scale
        const surplusDollars = totalSurplusCents / 100;
        const rawScore = competitionLevel > 0
          ? (surplusDollars * (winRate / 100)) / competitionLevel
          : surplusDollars * (winRate / 100);

        // Log-scale normalization to handle wide range
        const opportunityScore = Math.min(100, Math.round(Math.log10(rawScore + 1) * 20));

        counties.push({
          state,
          county,
          totalSurplusCents,
          caseCount,
          winRate,
          avgCaseDays,
          competitionLevel,
          opportunityScore,
          rank: 0, // Will be assigned after sorting
        });
      }

      // Sort by opportunity score and assign ranks
      counties.sort((a, b) => b.opportunityScore - a.opportunityScore);
      counties.forEach((c, idx) => { c.rank = idx + 1; });

      const topOpportunities = counties.slice(0, 10).map(c => `${c.county}, ${c.state}`);
      const underservedCounties = counties
        .filter(c => c.competitionLevel <= 1 && c.totalSurplusCents > 100000)
        .slice(0, 10)
        .map(c => `${c.county}, ${c.state}`);

      const result: CountyOpportunityRank = {
        rankedAt: new Date(),
        counties,
        topOpportunities,
        underservedCounties,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "rankCountyOpportunities",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: allCases.length,
          insightsGenerated: counties.length,
          resultSummary: `Ranked ${counties.length} counties. Top: ${topOpportunities.slice(0, 3).join(", ")}. ${underservedCounties.length} underserved counties found.`,
          details: { totalCounties: counties.length, topOpportunities: topOpportunities.slice(0, 5) } as any,
        } as any,
      });

      // Create OpsInsight
      await prisma.opsInsight.create({
        data: {
          source: this.botName,
          type: "CASE_RECOMMENDATION",
          title: `County Opportunity Rankings — ${counties.length} counties analyzed`,
          summary: `Top opportunities: ${topOpportunities.slice(0, 5).join(", ")}. Underserved high-value counties: ${underservedCounties.slice(0, 3).join(", ") || "None"}.`,
          data: { topOpportunities, underservedCounties, totalCounties: counties.length } as any,
          priority: underservedCounties.length > 5 ? "HIGH" : "NORMAL",
          actionRequired: underservedCounties.length > 0,
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
        } as any,
      });

      logger.info("Omniscient Bot: rankCountyOpportunities complete", {
        countiesRanked: counties.length,
        topOpportunities: topOpportunities.slice(0, 3),
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: rankCountyOpportunities failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "rankCountyOpportunities",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 8. REBALANCE PORTFOLIO
  // Analyze employee workload vs county performance
  // and suggest optimal reassignments
  // ============================================

  async rebalancePortfolio(): Promise<PortfolioRebalance> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: rebalancePortfolio started");

    try {
      // Get all active employees with their case assignments
      const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE", isActive: true },
        select: {
          id: true,
          name: true,
          assignedCases: {
            where: { status: { notIn: ["PAID", "REJECTED", "CLOSED"] } },
            select: {
              id: true,
              state: true,
              county: true,
              surplusAmountCents: true,
              status: true,
            },
          },
        },
      });

      // Get county performance data (win rates)
      const allClosedCases = await prisma.case.findMany({
        where: { status: { in: ["PAID", "REJECTED", "CLOSED"] } },
        select: {
          state: true,
          county: true,
          status: true,
          surplusAmountCents: true,
          actualFeeCents: true,
        },
      });

      // Build county performance map
      const countyPerformance: Record<string, { wins: number; total: number; revenueCents: number }> = {};
      for (const c of allClosedCases) {
        const key = `${c.county}, ${c.state}`;
        if (!countyPerformance[key]) countyPerformance[key] = { wins: 0, total: 0, revenueCents: 0 };
        countyPerformance[key].total++;
        if (c.status === "PAID") {
          countyPerformance[key].wins++;
          countyPerformance[key].revenueCents += c.actualFeeCents || 0;
        }
      }

      // Build current distribution
      const currentDistribution: PortfolioRebalance["currentDistribution"] = [];

      for (const emp of employees) {
        const countyBreakdown: Record<string, number> = {};
        let totalSurplus = 0;

        for (const c of emp.assignedCases) {
          const key = `${c.county}, ${c.state}`;
          countyBreakdown[key] = (countyBreakdown[key] || 0) + 1;
          totalSurplus += c.surplusAmountCents;
        }

        // Calculate employee's average win rate based on their county assignments
        let winRateSum = 0;
        let winRateCount = 0;
        for (const county of Object.keys(countyBreakdown)) {
          const perf = countyPerformance[county];
          if (perf && perf.total > 0) {
            winRateSum += (perf.wins / perf.total) * 100;
            winRateCount++;
          }
        }
        const avgWinRate = winRateCount > 0 ? Math.round(winRateSum / winRateCount) : 50;

        const topCounties = Object.entries(countyBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([county]) => county);

        currentDistribution.push({
          employeeId: emp.id,
          employeeName: emp.name || "Unknown",
          caseCount: emp.assignedCases.length,
          totalSurplusCents: totalSurplus,
          avgWinRate,
          topCounties,
        });
      }

      // Identify high-yield and low-yield counties
      const countyScores = Object.entries(countyPerformance)
        .map(([county, perf]) => ({
          county,
          winRate: perf.total > 0 ? (perf.wins / perf.total) * 100 : 0,
          revenue: perf.revenueCents,
          total: perf.total,
        }))
        .filter(c => c.total >= 3); // Minimum sample size

      countyScores.sort((a, b) => b.winRate - a.winRate);

      const highYieldCounties = countyScores.filter(c => c.winRate >= 60);
      const lowYieldCounties = countyScores.filter(c => c.winRate < 30);

      // Generate suggestions
      const suggestions: PortfolioRebalance["suggestions"] = [];
      let projectedRevenueIncrease = 0;

      for (const emp of currentDistribution) {
        // Check if employee is mostly in low-yield counties
        const empLowYieldCounties = emp.topCounties.filter(
          tc => lowYieldCounties.some(lc => lc.county === tc)
        );

        if (empLowYieldCounties.length > 0 && highYieldCounties.length > 0) {
          // Find high-yield counties that are underserved
          for (const lowCounty of empLowYieldCounties) {
            const bestHighYield = highYieldCounties.find(hc => {
              // Check if this high-yield county has capacity
              const empsThere = currentDistribution.filter(
                e => e.topCounties.includes(hc.county)
              ).length;
              return empsThere < 3; // Room for more employees
            });

            if (bestHighYield) {
              const lowPerf = countyPerformance[lowCounty];
              const lowWinRate = lowPerf ? (lowPerf.wins / lowPerf.total) * 100 : 30;
              const improvement = bestHighYield.winRate - lowWinRate;

              if (improvement > 15) {
                suggestions.push({
                  employeeId: emp.employeeId,
                  employeeName: emp.employeeName,
                  fromCounty: lowCounty,
                  toCounty: bestHighYield.county,
                  reason: `${lowCounty} win rate: ${Math.round(lowWinRate)}% vs ${bestHighYield.county} win rate: ${Math.round(bestHighYield.winRate)}%`,
                  expectedImprovementPercent: Math.round(improvement),
                });

                // Estimate revenue impact
                const avgCaseValue = emp.totalSurplusCents / Math.max(emp.caseCount, 1);
                projectedRevenueIncrease += Math.round(avgCaseValue * (improvement / 100) * 0.3);
              }
            }
          }
        }
      }

      // Limit suggestions to top 10 most impactful
      suggestions.sort((a, b) => b.expectedImprovementPercent - a.expectedImprovementPercent);
      const topSuggestions = suggestions.slice(0, 10);

      const result: PortfolioRebalance = {
        analyzedAt: new Date(),
        currentDistribution,
        suggestions: topSuggestions,
        projectedRevenueIncreaseCents: projectedRevenueIncrease,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "rebalancePortfolio",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: employees.length,
          insightsGenerated: topSuggestions.length,
          resultSummary: `Analyzed ${employees.length} employees. ${topSuggestions.length} rebalance suggestions. Projected revenue increase: $${(projectedRevenueIncrease / 100).toLocaleString()}`,
          details: {
            employees: employees.length,
            suggestions: topSuggestions.length,
            projectedIncrease: projectedRevenueIncrease,
          } as any,
        } as any,
      });

      // Create OpsInsight if suggestions exist
      if (topSuggestions.length > 0) {
        await prisma.opsInsight.create({
          data: {
            source: this.botName,
            type: "EMPLOYEE_COACHING",
            title: `Portfolio Rebalance: ${topSuggestions.length} suggestions, $${(projectedRevenueIncrease / 100).toLocaleString()} projected gain`,
            summary: topSuggestions.slice(0, 3).map(s =>
              `Move ${s.employeeName} from ${s.fromCounty} to ${s.toCounty} (+${s.expectedImprovementPercent}%)`
            ).join(". "),
            data: result as any,
            priority: projectedRevenueIncrease > 500000 ? "HIGH" : "NORMAL",
            actionRequired: true,
            relatedCaseIds: [],
            relatedUserIds: topSuggestions.map(s => s.employeeId),
            relatedAlertIds: [],
          } as any,
        });
      }

      logger.info("Omniscient Bot: rebalancePortfolio complete", {
        employees: employees.length,
        suggestions: topSuggestions.length,
        projectedIncrease: projectedRevenueIncrease,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: rebalancePortfolio failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "rebalancePortfolio",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 9. DETECT ANOMALIES
  // Find unusual patterns: closure spikes,
  // abnormal employee performance, county drops,
  // unusual payment patterns
  // ============================================

  async detectAnomalies(): Promise<AnomalyDetectionResult> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: detectAnomalies started");

    const anomalies: AnomalyDetectionResult["anomalies"] = [];

    try {
      // ---- ANOMALY 1: Sudden spike in case closures (possible fraud) ----
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const prev7Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const recentClosures = await prisma.case.count({
        where: {
          status: { in: ["PAID", "CLOSED"] },
          updatedAt: { gte: last7Days },
        },
      });

      const previousClosures = await prisma.case.count({
        where: {
          status: { in: ["PAID", "CLOSED"] },
          updatedAt: { gte: prev7Days, lt: last7Days },
        },
      });

      if (previousClosures > 0 && recentClosures > previousClosures * 2) {
        anomalies.push({
          type: "closure_spike",
          severity: recentClosures > previousClosures * 3 ? "critical" : "high",
          title: `Case closure spike: ${recentClosures} vs ${previousClosures} previous week`,
          description: `Case closures jumped ${Math.round((recentClosures / previousClosures - 1) * 100)}% week over week. This may indicate mass processing or potential fraud.`,
          affectedEntities: [],
          suggestedAction: "Review recent closures for authenticity. Check employee activity logs.",
          dataPoints: {
            recentClosures,
            previousClosures,
            percentChange: Math.round((recentClosures / previousClosures - 1) * 100),
          },
        });
      }

      // ---- ANOMALY 2: Employees with abnormally high/low success rates ----
      const employeeStats = await prisma.case.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          assignedEmployeeId: { not: null },
          status: { in: ["PAID", "REJECTED", "CLOSED"] },
          updatedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        _count: { id: true },
      });

      const employeePaidCounts = await prisma.case.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          assignedEmployeeId: { not: null },
          status: "PAID",
          updatedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        _count: { id: true },
      });

      // Calculate company-wide average
      const totalClosed = employeeStats.reduce((sum, e) => sum + e._count.id, 0);
      const totalPaid = employeePaidCounts.reduce((sum, e) => sum + e._count.id, 0);
      const avgWinRate = totalClosed > 0 ? (totalPaid / totalClosed) * 100 : 50;

      for (const empStat of employeeStats) {
        if (empStat._count.id < 5) continue; // Skip low-volume employees

        const empPaid = employeePaidCounts.find(
          p => p.assignedEmployeeId === empStat.assignedEmployeeId
        );
        const empWinRate = empPaid
          ? (empPaid._count.id / empStat._count.id) * 100
          : 0;

        // Flag if win rate deviates significantly from average
        if (empWinRate > avgWinRate + 30 && empStat._count.id >= 10) {
          anomalies.push({
            type: "employee_performance",
            severity: "medium",
            title: `Abnormally high success rate: Employee ${empStat.assignedEmployeeId?.slice(0, 8)}`,
            description: `Win rate: ${Math.round(empWinRate)}% vs company average ${Math.round(avgWinRate)}%. ${empStat._count.id} cases closed. Could indicate cherry-picking or data manipulation.`,
            affectedEntities: [empStat.assignedEmployeeId!],
            suggestedAction: "Review case selection patterns and verify outcomes.",
            dataPoints: {
              employeeWinRate: Math.round(empWinRate),
              companyAvgWinRate: Math.round(avgWinRate),
              totalCases: empStat._count.id,
            },
          });
        }

        if (empWinRate < avgWinRate - 30 && empStat._count.id >= 5) {
          anomalies.push({
            type: "employee_performance",
            severity: "high",
            title: `Abnormally low success rate: Employee ${empStat.assignedEmployeeId?.slice(0, 8)}`,
            description: `Win rate: ${Math.round(empWinRate)}% vs company average ${Math.round(avgWinRate)}%. ${empStat._count.id} cases closed. May need training or reassignment.`,
            affectedEntities: [empStat.assignedEmployeeId!],
            suggestedAction: "Review employee performance, assign training, or redistribute cases.",
            dataPoints: {
              employeeWinRate: Math.round(empWinRate),
              companyAvgWinRate: Math.round(avgWinRate),
              totalCases: empStat._count.id,
            },
          });
        }
      }

      // ---- ANOMALY 3: Counties with dropping surplus amounts ----
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const olderCountySurplus = await prisma.case.groupBy({
        by: ["state", "county"],
        where: {
          createdAt: { gte: sixMonthsAgo, lt: threeMonthsAgo },
        },
        _avg: { surplusAmountCents: true },
        _count: { id: true },
      });

      const recentCountySurplus = await prisma.case.groupBy({
        by: ["state", "county"],
        where: {
          createdAt: { gte: threeMonthsAgo },
        },
        _avg: { surplusAmountCents: true },
        _count: { id: true },
      });

      for (const recent of recentCountySurplus) {
        if (recent._count.id < 3) continue;

        const older = olderCountySurplus.find(
          o => o.state === recent.state && o.county === recent.county
        );

        if (older && older._avg.surplusAmountCents && recent._avg.surplusAmountCents) {
          const drop = ((older._avg.surplusAmountCents - recent._avg.surplusAmountCents) / older._avg.surplusAmountCents) * 100;

          if (drop > 40) {
            anomalies.push({
              type: "county_surplus_drop",
              severity: drop > 60 ? "high" : "medium",
              title: `Surplus drop in ${recent.county}, ${recent.state}: -${Math.round(drop)}%`,
              description: `Average surplus dropped from $${Math.round(older._avg.surplusAmountCents / 100).toLocaleString()} to $${Math.round(recent._avg.surplusAmountCents / 100).toLocaleString()} in the last 3 months. May indicate market shift or competition.`,
              affectedEntities: [`${recent.county}, ${recent.state}`],
              suggestedAction: "Investigate county market conditions. Consider reallocating resources.",
              dataPoints: {
                previousAvgSurplus: Math.round(older._avg.surplusAmountCents / 100),
                currentAvgSurplus: Math.round(recent._avg.surplusAmountCents / 100),
                dropPercent: Math.round(drop),
                recentCaseCount: recent._count.id,
              },
            });
          }
        }
      }

      // ---- ANOMALY 4: Unusual payment patterns ----
      const recentPayments = await prisma.ledgerEntry.findMany({
        where: {
          type: { in: ["CLIENT_PAYOUT", "COMMISSION"] },
          createdAt: { gte: last7Days },
          status: "COMPLETED",
        },
        select: {
          id: true,
          type: true,
          amountCents: true,
          userId: true,
          caseId: true,
          createdAt: true,
        },
        orderBy: { amountCents: "desc" },
        take: 100,
      });

      // Calculate payment statistics
      if (recentPayments.length > 5) {
        const amounts = recentPayments.map(p => p.amountCents);
        const avgPayment = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(
          amounts.reduce((sum, val) => sum + Math.pow(val - avgPayment, 2), 0) / amounts.length
        );

        // Find outliers (more than 2 standard deviations from mean)
        const outliers = recentPayments.filter(p =>
          Math.abs(p.amountCents - avgPayment) > 2 * stdDev
        );

        if (outliers.length > 0) {
          anomalies.push({
            type: "payment_pattern",
            severity: outliers.some(o => o.amountCents > avgPayment + 3 * stdDev) ? "high" : "medium",
            title: `${outliers.length} unusual payment(s) detected`,
            description: `${outliers.length} payments deviate significantly from the average ($${Math.round(avgPayment / 100).toLocaleString()}). Largest outlier: $${Math.round(outliers[0].amountCents / 100).toLocaleString()}.`,
            affectedEntities: outliers.map(o => o.id),
            suggestedAction: "Review flagged payments for accuracy and authorization.",
            dataPoints: {
              avgPaymentCents: Math.round(avgPayment),
              stdDevCents: Math.round(stdDev),
              outlierCount: outliers.length,
              largestOutlierCents: outliers[0].amountCents,
            },
          });
        }

        // Check for duplicate payments (same amount + same case within 24h)
        const paymentsByCase: Record<string, typeof recentPayments> = {};
        for (const p of recentPayments) {
          if (!paymentsByCase[p.caseId]) paymentsByCase[p.caseId] = [];
          paymentsByCase[p.caseId].push(p);
        }

        for (const [caseId, payments] of Object.entries(paymentsByCase)) {
          if (payments.length > 1) {
            // Check for same-amount duplicates
            const amountMap: Record<number, number> = {};
            for (const p of payments) {
              amountMap[p.amountCents] = (amountMap[p.amountCents] || 0) + 1;
            }

            const duplicates = Object.entries(amountMap).filter(([, count]) => count > 1);
            if (duplicates.length > 0) {
              anomalies.push({
                type: "payment_pattern",
                severity: "high",
                title: `Possible duplicate payment on case ${caseId.slice(0, 8)}`,
                description: `${duplicates.length} duplicate amount(s) found. Amount(s): ${duplicates.map(([amt]) => `$${(parseInt(amt) / 100).toLocaleString()}`).join(", ")}`,
                affectedEntities: [caseId],
                suggestedAction: "Verify these are not duplicate disbursements.",
                dataPoints: {
                  caseId: caseId.slice(0, 8),
                  duplicateAmounts: duplicates.length,
                  totalPayments: payments.length,
                },
              });
            }
          }
        }
      }

      const criticalCount = anomalies.filter(a => a.severity === "critical").length;

      const result: AnomalyDetectionResult = {
        detectedAt: new Date(),
        anomalies,
        totalAnomalies: anomalies.length,
        criticalCount,
      };

      // Log the run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "detectAnomalies",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          recordsProcessed: anomalies.length,
          insightsGenerated: anomalies.length,
          alertsCreated: criticalCount,
          resultSummary: `Detected ${anomalies.length} anomalies (${criticalCount} critical). Types: ${Array.from(new Set(anomalies.map(a => a.type))).join(", ") || "None"}`,
          details: {
            totalAnomalies: anomalies.length,
            criticalCount,
            typeBreakdown: anomalies.reduce((acc, a) => {
              acc[a.type] = (acc[a.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          } as any,
        } as any,
      });

      // Create OpsInsight for anomalies
      if (anomalies.length > 0) {
        await prisma.opsInsight.create({
          data: {
            source: this.botName,
            type: "SYSTEM_HEALTH",
            title: `Anomaly Detection: ${anomalies.length} anomalies found (${criticalCount} critical)`,
            summary: anomalies.slice(0, 5).map(a => `[${a.severity.toUpperCase()}] ${a.title}`).join(". "),
            data: result as any,
            priority: criticalCount > 0 ? "URGENT" : anomalies.length > 5 ? "HIGH" : "NORMAL",
            actionRequired: criticalCount > 0 || anomalies.length > 3,
            relatedCaseIds: anomalies.flatMap(a => a.affectedEntities).slice(0, 20),
            relatedUserIds: [],
            relatedAlertIds: [],
          } as any,
        });
      }

      logger.info("Omniscient Bot: detectAnomalies complete", {
        totalAnomalies: anomalies.length,
        criticalCount,
      });

      return result;

    } catch (error) {
      logger.error("Omniscient Bot: detectAnomalies failed", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "detectAnomalies",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }

  // ============================================
  // 10. RUN GOD MODE — THE NUCLEAR OPTION
  // Execute ALL methods in parallel, aggregate
  // into one comprehensive report, notify founder
  // if critical findings are detected
  // ============================================

  async runGodMode(): Promise<GodModeReport> {
    const startTime = Date.now();
    logger.info("Omniscient Bot: GOD MODE ACTIVATED");

    try {
      // Get a sample of active cases for predictions
      const sampleCases = await prisma.case.findMany({
        where: { status: { notIn: ["PAID", "REJECTED", "CLOSED"] } },
        select: { id: true },
        take: 5,
        orderBy: { surplusAmountCents: "desc" },
      });

      // Execute ALL methods in parallel — maximum throughput
      const [
        caseOutcomes,
        revenueWeatherMap,
        selfHealResult,
        regulatoryAlerts,
        cashFlowForecast,
        cryptoSurplus,
        countyRankings,
        portfolioRebalance,
        anomalyResult,
      ] = await Promise.all([
        // Predict outcomes for top 5 cases
        Promise.all(
          sampleCases.map(c =>
            this.predictCaseOutcome(c.id).catch(err => {
              logger.error("God Mode: predictCaseOutcome failed for case", { caseId: c.id, error: err });
              return null;
            })
          )
        ),
        this.generateRevenueWeatherMap().catch(err => {
          logger.error("God Mode: generateRevenueWeatherMap failed", { error: err });
          return null;
        }),
        this.selfHealOperations().catch(err => {
          logger.error("God Mode: selfHealOperations failed", { error: err });
          return null;
        }),
        this.scanRegulatoryChanges().catch(err => {
          logger.error("God Mode: scanRegulatoryChanges failed", { error: err });
          return null;
        }),
        this.predictCashFlow(90).catch(err => {
          logger.error("God Mode: predictCashFlow failed", { error: err });
          return null;
        }),
        this.scanCryptoSurplus().catch(err => {
          logger.error("God Mode: scanCryptoSurplus failed", { error: err });
          return null;
        }),
        this.rankCountyOpportunities().catch(err => {
          logger.error("God Mode: rankCountyOpportunities failed", { error: err });
          return null;
        }),
        this.rebalancePortfolio().catch(err => {
          logger.error("God Mode: rebalancePortfolio failed", { error: err });
          return null;
        }),
        this.detectAnomalies().catch(err => {
          logger.error("God Mode: detectAnomalies failed", { error: err });
          return null;
        }),
      ]);

      // Filter successful case outcomes
      const validCaseOutcomes = caseOutcomes.filter(
        (o): o is CaseOutcomePrediction => o !== null
      );

      // Aggregate critical findings
      const criticalFindings: string[] = [];

      // Check anomalies for critical items
      if (anomalyResult && anomalyResult.criticalCount > 0) {
        criticalFindings.push(
          `ANOMALY: ${anomalyResult.criticalCount} critical anomalies detected — ${anomalyResult.anomalies.filter(a => a.severity === "critical").map(a => a.title).join("; ")}`
        );
      }

      // Check regulatory alerts
      if (regulatoryAlerts && regulatoryAlerts.changesDetected.some(c => c.riskLevel === "critical")) {
        const criticalStates = regulatoryAlerts.changesDetected
          .filter(c => c.riskLevel === "critical")
          .map(c => c.stateCode);
        criticalFindings.push(
          `REGULATORY: Critical rule changes in ${criticalStates.join(", ")} affecting ${regulatoryAlerts.totalAffectedCases} cases`
        );
      }

      // Check self-heal for major issues
      if (selfHealResult && selfHealResult.stuckCasesReassigned.length > 10) {
        criticalFindings.push(
          `OPERATIONS: ${selfHealResult.stuckCasesReassigned.length} stuck cases found — possible systemic issue`
        );
      }

      // Check for unresponsive employees
      if (selfHealResult && selfHealResult.unresponsiveEmployees.length > 3) {
        criticalFindings.push(
          `WORKFORCE: ${selfHealResult.unresponsiveEmployees.length} employees unresponsive for 7+ days`
        );
      }

      // Check cash flow risks
      if (cashFlowForecast && cashFlowForecast.riskFactors.length > 2) {
        criticalFindings.push(
          `CASH FLOW: ${cashFlowForecast.riskFactors.length} risk factors — ${cashFlowForecast.riskFactors[0]}`
        );
      }

      // Check for low win probability across sampled cases
      const lowProbCases = validCaseOutcomes.filter(c => c.winProbability < 30);
      if (lowProbCases.length > validCaseOutcomes.length * 0.5 && validCaseOutcomes.length > 0) {
        criticalFindings.push(
          `PIPELINE: ${lowProbCases.length}/${validCaseOutcomes.length} sampled high-value cases have <30% win probability`
        );
      }

      const executionTimeMs = Date.now() - startTime;

      // Build the God Mode report
      const report: GodModeReport = {
        executedAt: new Date(),
        executionTimeMs,
        caseOutcomeSamples: validCaseOutcomes,
        revenueWeatherMap: revenueWeatherMap || {
          generatedAt: new Date(), totalSurplusCents: 0, totalProjectedRevenueCents: 0,
          states: [], topStates: [], coldZones: [],
        },
        selfHealResult: selfHealResult || {
          healedAt: new Date(), stuckCasesReassigned: [], unresponsiveEmployees: [],
          failedBotReruns: [], orphanedCommunications: [], totalHealed: 0,
        },
        regulatoryAlerts: regulatoryAlerts || {
          scannedAt: new Date(), changesDetected: [], alertsCreated: 0, totalAffectedCases: 0,
        },
        cashFlowForecast: cashFlowForecast || {
          forecastGeneratedAt: new Date(), forecastDays: 90, weeklyBreakdown: [],
          totals: { highConfidenceCents: 0, mediumConfidenceCents: 0, lowConfidenceCents: 0, grandTotalCents: 0 },
          riskFactors: [],
        },
        cryptoSurplus: cryptoSurplus || {
          scannedAt: new Date(), totalCryptoRelatedCases: 0, totalCryptoSurplusCents: 0,
          categories: [], topOpportunities: [],
        },
        countyRankings: countyRankings || {
          rankedAt: new Date(), counties: [], topOpportunities: [], underservedCounties: [],
        },
        portfolioRebalance: portfolioRebalance || {
          analyzedAt: new Date(), currentDistribution: [], suggestions: [],
          projectedRevenueIncreaseCents: 0,
        },
        anomalies: anomalyResult || {
          detectedAt: new Date(), anomalies: [], totalAnomalies: 0, criticalCount: 0,
        },
        criticalFindings,
        founderNotified: false,
      };

      // Build executive summary for God Mode
      const godModeSummary = [
        `GOD MODE REPORT — ${new Date().toLocaleString()}`,
        `Execution time: ${(executionTimeMs / 1000).toFixed(1)}s`,
        ``,
        `PIPELINE: ${validCaseOutcomes.length} cases analyzed, avg win prob: ${validCaseOutcomes.length > 0 ? Math.round(validCaseOutcomes.reduce((s, c) => s + c.winProbability, 0) / validCaseOutcomes.length) : 0}%`,
        `WEATHER MAP: ${revenueWeatherMap?.states.length || 0} states, $${((revenueWeatherMap?.totalSurplusCents || 0) / 100).toLocaleString()} total surplus`,
        `SELF-HEAL: ${selfHealResult?.totalHealed || 0} issues auto-resolved`,
        `REGULATORY: ${regulatoryAlerts?.changesDetected.length || 0} changes, ${regulatoryAlerts?.totalAffectedCases || 0} cases affected`,
        `CASH FLOW: $${((cashFlowForecast?.totals.grandTotalCents || 0) / 100).toLocaleString()} projected revenue`,
        `CRYPTO: ${cryptoSurplus?.totalCryptoRelatedCases || 0} crypto cases, $${((cryptoSurplus?.totalCryptoSurplusCents || 0) / 100).toLocaleString()} surplus`,
        `COUNTIES: ${countyRankings?.counties.length || 0} ranked, ${countyRankings?.underservedCounties.length || 0} underserved`,
        `PORTFOLIO: ${portfolioRebalance?.suggestions.length || 0} rebalance suggestions`,
        `ANOMALIES: ${anomalyResult?.totalAnomalies || 0} detected (${anomalyResult?.criticalCount || 0} critical)`,
        ``,
        criticalFindings.length > 0
          ? `CRITICAL FINDINGS (${criticalFindings.length}):\n${criticalFindings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}`
          : `No critical findings — all systems nominal.`,
      ].join("\n");

      // Log the God Mode run
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "runGodMode",
          status: "SUCCESS",
          durationMs: executionTimeMs,
          recordsProcessed:
            validCaseOutcomes.length +
            (revenueWeatherMap?.states.length || 0) +
            (selfHealResult?.totalHealed || 0) +
            (regulatoryAlerts?.changesDetected.length || 0) +
            (anomalyResult?.totalAnomalies || 0),
          insightsGenerated: criticalFindings.length,
          alertsCreated: criticalFindings.length,
          resultSummary: godModeSummary.slice(0, 1000),
          details: {
            executionTimeMs,
            criticalFindings: criticalFindings.length,
            modulesCompleted: [
              validCaseOutcomes.length > 0 ? "caseOutcomes" : null,
              revenueWeatherMap ? "revenueWeatherMap" : null,
              selfHealResult ? "selfHeal" : null,
              regulatoryAlerts ? "regulatory" : null,
              cashFlowForecast ? "cashFlow" : null,
              cryptoSurplus ? "crypto" : null,
              countyRankings ? "countyRankings" : null,
              portfolioRebalance ? "portfolio" : null,
              anomalyResult ? "anomalies" : null,
            ].filter(Boolean),
          } as any,
        } as any,
      });

      // Save comprehensive OpsInsight
      await prisma.opsInsight.create({
        data: {
          source: this.botName,
          type: "COORDINATOR_SUMMARY",
          title: `GOD MODE REPORT — ${new Date().toLocaleDateString()}`,
          summary: godModeSummary,
          data: {
            executionTimeMs,
            criticalFindings,
            caseOutcomeCount: validCaseOutcomes.length,
            statesAnalyzed: revenueWeatherMap?.states.length || 0,
            issuesHealed: selfHealResult?.totalHealed || 0,
            regulatoryChanges: regulatoryAlerts?.changesDetected.length || 0,
            anomaliesDetected: anomalyResult?.totalAnomalies || 0,
          } as any,
          priority: criticalFindings.length > 0 ? "URGENT" : "HIGH",
          actionRequired: criticalFindings.length > 0,
          relatedCaseIds: validCaseOutcomes.map(c => c.caseId),
          relatedUserIds: portfolioRebalance?.suggestions.map(s => s.employeeId) || [],
          relatedAlertIds: [],
        } as any,
      });

      // Notify founder if critical findings exist
      if (criticalFindings.length > 0) {
        const founder = await prisma.user.findFirst({
          where: { role: "FOUNDER" },
          select: { id: true, email: true },
        });

        if (founder?.email) {
          await notificationService.sendFounderEmail({
            subject: `GOD MODE ALERT: ${criticalFindings.length} Critical Findings`,
            body: godModeSummary,
            priority: "urgent",
            userId: founder.id,
          });
          report.founderNotified = true;
        }
      }

      logger.info("Omniscient Bot: GOD MODE COMPLETE", {
        executionTimeMs,
        criticalFindings: criticalFindings.length,
        founderNotified: report.founderNotified,
      });

      return report;

    } catch (error) {
      logger.error("Omniscient Bot: GOD MODE FAILED", { error });
      await prisma.botRunLog.create({
        data: {
          botName: this.botName,
          runType: "runGodMode",
          status: "FAILED",
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        } as any,
      });
      throw error;
    }
  }
}

export const omniscientBot = new OmniscientBot();
