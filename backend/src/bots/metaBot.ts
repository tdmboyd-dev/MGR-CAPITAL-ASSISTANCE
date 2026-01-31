// ============================================
// META BOT — MGR CAPITAL ASSISTANCE
// Phase 10: Bot Performance Analysis
// Phase 18: Feedback Analysis Integration
// Analyzes BotRunLog, generates optimization recommendations
// ============================================

import { PrismaClient, OpsInsightPriority } from "@prisma/client";
import { feedbackService } from "../services/FeedbackService.js";

const prisma = new PrismaClient();

const BOT_NAME = "metaBot";

interface BotPerformanceMetrics {
  botName: string;
  totalRuns: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  avgRecordsProcessed: number;
  avgInsightsGenerated: number;
  avgErrorsEncountered: number;
  trend: "improving" | "degrading" | "stable";
  lastRunAt: Date | null;
  lastStatus: string | null;
}

interface BotPerformanceReport {
  generatedAt: Date;
  period: string;
  bots: BotPerformanceMetrics[];
  overallHealth: "excellent" | "good" | "attention" | "critical";
  recommendations: string[];
  insights: BotInsight[];
}

interface BotInsight {
  botName: string;
  type: "failure" | "slow" | "inefficient" | "inactive" | "success";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendation: string;
}

class MetaBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  /**
   * Analyze bot performance from BotRunLog
   */
  async analyzeBotPerformance(days: number = 7): Promise<BotPerformanceReport> {
    console.log(`[${BOT_NAME}] Analyzing bot performance for last ${days} days...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all bot runs in period
    const botRuns = await prisma.botRunLog.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      orderBy: { startedAt: "desc" },
    });

    // Group by bot name
    const botGroups = this.groupByBot(botRuns);

    // Calculate metrics for each bot
    const bots: BotPerformanceMetrics[] = [];
    for (const [botName, runs] of Object.entries(botGroups)) {
      const metrics = this.calculateBotMetrics(botName, runs);
      bots.push(metrics);
    }

    // Sort by success rate (worst first)
    bots.sort((a, b) => a.successRate - b.successRate);

    // Generate insights
    const insights = this.generateInsights(bots);

    // Calculate overall health
    const overallHealth = this.calculateOverallHealth(bots, insights);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bots, insights);

    const report: BotPerformanceReport = {
      generatedAt: new Date(),
      period: `Last ${days} days`,
      bots,
      overallHealth,
      recommendations,
      insights,
    };

    // Save as OpsInsight
    await this.saveReport(report);

    console.log(`[${BOT_NAME}] Analysis complete. Overall health: ${overallHealth}`);

    return report;
  }

  // ============================================
  // METRICS CALCULATION
  // ============================================

  private groupByBot(runs: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    for (const run of runs) {
      const name = run.botName || "Unknown";
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(run);
    }
    return groups;
  }

  private calculateBotMetrics(botName: string, runs: any[]): BotPerformanceMetrics {
    const successRuns = runs.filter((r) => r.status === "SUCCESS");
    const errorRuns = runs.filter((r) => r.status === "ERROR");

    const durations = runs.map((r) => r.durationMs || 0).filter((d) => d > 0);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    const recordsProcessed = runs.map((r) => r.recordsProcessed || 0);
    const avgRecords = recordsProcessed.length > 0
      ? Math.round(recordsProcessed.reduce((a, b) => a + b, 0) / recordsProcessed.length)
      : 0;

    const insightsGenerated = runs.map((r) => r.insightsGenerated || 0);
    const avgInsights = insightsGenerated.length > 0
      ? Math.round(insightsGenerated.reduce((a, b) => a + b, 0) / insightsGenerated.length)
      : 0;

    const errorsEncountered = runs.map((r) => r.errorsEncountered || 0);
    const avgErrors = errorsEncountered.length > 0
      ? Math.round(errorsEncountered.reduce((a, b) => a + b, 0) / errorsEncountered.length)
      : 0;

    // Calculate trend by comparing first half vs second half
    const midpoint = Math.floor(runs.length / 2);
    const firstHalf = runs.slice(midpoint);
    const secondHalf = runs.slice(0, midpoint);

    const firstHalfSuccessRate = firstHalf.length > 0
      ? firstHalf.filter((r) => r.status === "SUCCESS").length / firstHalf.length
      : 0;
    const secondHalfSuccessRate = secondHalf.length > 0
      ? secondHalf.filter((r) => r.status === "SUCCESS").length / secondHalf.length
      : 0;

    let trend: "improving" | "degrading" | "stable" = "stable";
    if (secondHalfSuccessRate > firstHalfSuccessRate + 0.1) {
      trend = "improving";
    } else if (secondHalfSuccessRate < firstHalfSuccessRate - 0.1) {
      trend = "degrading";
    }

    const lastRun = runs[0];

    return {
      botName,
      totalRuns: runs.length,
      successCount: successRuns.length,
      errorCount: errorRuns.length,
      successRate: runs.length > 0 ? Math.round((successRuns.length / runs.length) * 100) : 0,
      avgDurationMs: avgDuration,
      maxDurationMs: maxDuration,
      minDurationMs: minDuration,
      avgRecordsProcessed: avgRecords,
      avgInsightsGenerated: avgInsights,
      avgErrorsEncountered: avgErrors,
      trend,
      lastRunAt: lastRun?.startedAt || null,
      lastStatus: lastRun?.status || null,
    };
  }

  // ============================================
  // INSIGHTS GENERATION
  // ============================================

  private generateInsights(bots: BotPerformanceMetrics[]): BotInsight[] {
    const insights: BotInsight[] = [];

    for (const bot of bots) {
      // High failure rate
      if (bot.successRate < 50 && bot.totalRuns >= 3) {
        insights.push({
          botName: bot.botName,
          type: "failure",
          severity: "critical",
          message: `${bot.botName} has ${bot.successRate}% success rate (${bot.errorCount}/${bot.totalRuns} failed)`,
          recommendation: `Review ${bot.botName} error logs. Check for dependency issues, API changes, or data format changes.`,
        });
      } else if (bot.successRate < 80 && bot.totalRuns >= 3) {
        insights.push({
          botName: bot.botName,
          type: "failure",
          severity: "high",
          message: `${bot.botName} has ${bot.successRate}% success rate`,
          recommendation: `Investigate recent ${bot.botName} failures and add error handling.`,
        });
      }

      // Slow execution
      if (bot.avgDurationMs > 60000) { // > 1 minute
        insights.push({
          botName: bot.botName,
          type: "slow",
          severity: "medium",
          message: `${bot.botName} takes ${Math.round(bot.avgDurationMs / 1000)}s average to complete`,
          recommendation: `Optimize ${bot.botName} queries and processing. Consider pagination or caching.`,
        });
      }

      // Very slow (> 5 minutes)
      if (bot.maxDurationMs > 300000) {
        insights.push({
          botName: bot.botName,
          type: "slow",
          severity: "high",
          message: `${bot.botName} had runs taking over 5 minutes (max: ${Math.round(bot.maxDurationMs / 1000)}s)`,
          recommendation: `Add timeout handling to ${bot.botName}. Consider breaking into smaller batches.`,
        });
      }

      // No runs in period
      if (bot.totalRuns === 0) {
        insights.push({
          botName: bot.botName,
          type: "inactive",
          severity: "medium",
          message: `${bot.botName} has not run in the analysis period`,
          recommendation: `Verify ${bot.botName} schedule in scheduler.ts. Check if it's enabled.`,
        });
      }

      // Degrading trend
      if (bot.trend === "degrading") {
        insights.push({
          botName: bot.botName,
          type: "inefficient",
          severity: "high",
          message: `${bot.botName} performance is degrading over time`,
          recommendation: `Recent changes may have impacted ${bot.botName}. Review recent commits.`,
        });
      }

      // High error encounters even on success
      if (bot.avgErrorsEncountered > 5 && bot.successRate >= 80) {
        insights.push({
          botName: bot.botName,
          type: "inefficient",
          severity: "medium",
          message: `${bot.botName} encountering ${bot.avgErrorsEncountered} errors per run despite success`,
          recommendation: `Review ${bot.botName} partial failure handling. Some operations may be silently failing.`,
        });
      }

      // Great performance
      if (bot.successRate === 100 && bot.totalRuns >= 5 && bot.avgDurationMs < 30000) {
        insights.push({
          botName: bot.botName,
          type: "success",
          severity: "low",
          message: `${bot.botName} performing excellently: 100% success, avg ${Math.round(bot.avgDurationMs / 1000)}s`,
          recommendation: "No action needed. Continue monitoring.",
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
  }

  // ============================================
  // HEALTH & RECOMMENDATIONS
  // ============================================

  private calculateOverallHealth(
    bots: BotPerformanceMetrics[],
    insights: BotInsight[]
  ): BotPerformanceReport["overallHealth"] {
    const criticalCount = insights.filter((i) => i.severity === "critical").length;
    const highCount = insights.filter((i) => i.severity === "high").length;

    if (criticalCount > 0) return "critical";
    if (highCount > 2) return "attention";
    if (highCount > 0) return "good";
    return "excellent";
  }

  private generateRecommendations(
    bots: BotPerformanceMetrics[],
    insights: BotInsight[]
  ): string[] {
    const recommendations: string[] = [];

    // Aggregate recommendations from insights
    const criticalInsights = insights.filter((i) => i.severity === "critical");
    const highInsights = insights.filter((i) => i.severity === "high");

    for (const insight of criticalInsights.slice(0, 3)) {
      recommendations.push(`CRITICAL: ${insight.recommendation}`);
    }

    for (const insight of highInsights.slice(0, 2)) {
      recommendations.push(`HIGH: ${insight.recommendation}`);
    }

    // Check for bots not generating insights
    const noInsightBots = bots.filter((b) => b.avgInsightsGenerated === 0 && b.totalRuns >= 3);
    if (noInsightBots.length > 0) {
      recommendations.push(
        `Review bots generating no insights: ${noInsightBots.map((b) => b.botName).join(", ")}`
      );
    }

    // Check for overall low activity
    const totalRuns = bots.reduce((sum, b) => sum + b.totalRuns, 0);
    if (totalRuns < 10) {
      recommendations.push("Low bot activity detected. Verify scheduler is running.");
    }

    if (recommendations.length === 0) {
      recommendations.push("All bots performing well. Continue monitoring.");
    }

    return recommendations;
  }

  // ============================================
  // SAVE REPORT
  // ============================================

  private async saveReport(report: BotPerformanceReport): Promise<void> {
    const priority: OpsInsightPriority =
      report.overallHealth === "critical"
        ? "URGENT"
        : report.overallHealth === "attention"
        ? "HIGH"
        : "NORMAL";

    // Mark old meta-bot insights as stale
    await prisma.opsInsight.updateMany({
      where: {
        type: "BOT_PERFORMANCE",
        isStale: false,
      },
      data: { isStale: true },
    });

    await prisma.opsInsight.create({
      data: {
        type: "BOT_PERFORMANCE",
        priority,
        title: `Bot Performance Report: ${report.overallHealth.toUpperCase()}`,
        summary: this.generateSummary(report),
        details: report as any,
        plainEnglish: this.generatePlainEnglishReport(report),
        recommendations: report.recommendations,
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log bot run
    await prisma.botRunLog.create({
      data: {
        botName: BOT_NAME,
        
        success: true,
        summary: `Analyzed ${report.bots.length} bots. Overall health: ${report.overallHealth}`,
        recordsProcessed: report.bots.reduce((sum, b) => sum + b.totalRuns, 0),
        insightsGenerated: report.insights.length,
        durationMs: 0,
      },
    });
  }

  private generateSummary(report: BotPerformanceReport): string {
    const totalBots = report.bots.length;
    const healthyBots = report.bots.filter((b) => b.successRate >= 80).length;
    const criticalIssues = report.insights.filter((i) => i.severity === "critical").length;

    return `${healthyBots}/${totalBots} bots healthy. ${criticalIssues} critical issues. Overall: ${report.overallHealth}`;
  }

  private generatePlainEnglishReport(report: BotPerformanceReport): string {
    const sections: string[] = [];

    sections.push(`**Bot Performance Report** (${report.period})\n`);
    sections.push(`Overall Health: **${report.overallHealth.toUpperCase()}**\n`);

    sections.push("\n**Bot Status:**");
    for (const bot of report.bots) {
      const icon = bot.successRate >= 90 ? "✓" : bot.successRate >= 70 ? "!" : "✗";
      const trendIcon = bot.trend === "improving" ? "↑" : bot.trend === "degrading" ? "↓" : "→";
      sections.push(
        `- ${bot.botName}: ${icon} ${bot.successRate}% success (${bot.totalRuns} runs) ${trendIcon}`
      );
    }

    if (report.insights.length > 0) {
      sections.push("\n**Key Findings:**");
      for (const insight of report.insights.slice(0, 5)) {
        const severityIcon =
          insight.severity === "critical"
            ? "🔴"
            : insight.severity === "high"
            ? "🟠"
            : insight.severity === "medium"
            ? "🟡"
            : "🟢";
        sections.push(`${severityIcon} ${insight.message}`);
      }
    }

    if (report.recommendations.length > 0) {
      sections.push("\n**Recommendations:**");
      for (const rec of report.recommendations) {
        sections.push(`- ${rec}`);
      }
    }

    return sections.join("\n");
  }

  // ============================================
  // QUICK STATUS
  // ============================================

  /**
   * Get quick bot performance summary for API
   */
  async getQuickStatus(): Promise<{
    botsAnalyzed: number;
    overallHealth: string;
    criticalIssues: number;
    lastAnalysis: Date | null;
  }> {
    const latestInsight = await prisma.opsInsight.findFirst({
      where: {
        type: "BOT_PERFORMANCE",
        isStale: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!latestInsight) {
      return {
        botsAnalyzed: 0,
        overallHealth: "unknown",
        criticalIssues: 0,
        lastAnalysis: null,
      };
    }

    const details = latestInsight.details as unknown as BotPerformanceReport;

    return {
      botsAnalyzed: details.bots?.length || 0,
      overallHealth: details.overallHealth || "unknown",
      criticalIssues: details.insights?.filter((i) => i.severity === "critical").length || 0,
      lastAnalysis: latestInsight.createdAt,
    };
  }

  /**
   * Get detailed bot metrics for frontend
   */
  async getBotMetrics(): Promise<BotPerformanceMetrics[]> {
    const latestInsight = await prisma.opsInsight.findFirst({
      where: {
        type: "BOT_PERFORMANCE",
        isStale: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!latestInsight) {
      // Run fresh analysis if none exists
      const report = await this.analyzeBotPerformance(7);
      return report.bots;
    }

    const details = latestInsight.details as unknown as BotPerformanceReport;
    return details.bots || [];
  }

  // ============================================
  // PHASE 18: FEEDBACK ANALYSIS
  // ============================================

  /**
   * Analyze user feedback and generate insights
   */
  async analyzeFeedback(days: number = 30): Promise<{
    success: boolean;
    stats: {
      totalFeedback: number;
      averageRating: number;
      recentTrend: string;
    };
    insightsSaved: boolean;
  }> {
    console.log(`[${BOT_NAME}] Analyzing user feedback for last ${days} days...`);

    try {
      // Get feedback analysis from FeedbackService
      const analysis = await feedbackService.analyzeFeedback(days);

      // Save as OpsInsight
      await feedbackService.saveFeedbackInsight(analysis);

      // Log bot run
      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          
          success: true,
          summary: `Analyzed ${analysis.stats.totalFeedback} feedbacks. Avg rating: ${analysis.stats.averageRating}/5. Trend: ${analysis.stats.recentTrend}`,
          recordsProcessed: analysis.stats.totalFeedback,
          insightsGenerated: analysis.insights.length,
          durationMs: 0,
        },
      });

      console.log(`[${BOT_NAME}] Feedback analysis complete. ${analysis.stats.totalFeedback} feedbacks analyzed.`);

      return {
        success: true,
        stats: {
          totalFeedback: analysis.stats.totalFeedback,
          averageRating: analysis.stats.averageRating,
          recentTrend: analysis.stats.recentTrend,
        },
        insightsSaved: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${BOT_NAME}] Feedback analysis failed:`, errorMessage);

      await prisma.botRunLog.create({
        data: {
          botName: BOT_NAME,
          
          success: false,
          summary: `Feedback analysis failed: ${errorMessage}`,
          recordsProcessed: 0,
          insightsGenerated: 0,
          durationMs: 0,
        },
      });

      return {
        success: false,
        stats: { totalFeedback: 0, averageRating: 0, recentTrend: "unknown" },
        insightsSaved: false,
      };
    }
  }

  /**
   * Run full meta analysis (bots + feedback)
   */
  async runFullAnalysis(days: number = 7): Promise<{
    botAnalysis: BotPerformanceReport;
    feedbackAnalysis: {
      success: boolean;
      stats: { totalFeedback: number; averageRating: number; recentTrend: string };
    };
  }> {
    console.log(`[${BOT_NAME}] Running full meta analysis...`);

    const botAnalysis = await this.analyzeBotPerformance(days);
    const feedbackAnalysis = await this.analyzeFeedback(days * 4); // 4x period for feedback

    console.log(`[${BOT_NAME}] Full analysis complete.`);

    return {
      botAnalysis,
      feedbackAnalysis,
    };
  }

  /**
   * Get combined insights (bots + feedback) for dashboard
   */
  async getCombinedInsights(): Promise<{
    botHealth: string;
    feedbackRating: number | null;
    criticalIssues: number;
    recommendations: string[];
  }> {
    // Get latest bot analysis
    const botInsight = await prisma.opsInsight.findFirst({
      where: { type: "BOT_PERFORMANCE", isStale: false },
      orderBy: { createdAt: "desc" },
    });

    // Get latest feedback analysis
    const feedbackInsight = await prisma.opsInsight.findFirst({
      where: { type: "FEEDBACK_ANALYSIS", isStale: false },
      orderBy: { createdAt: "desc" },
    });

    const recommendations: string[] = [];

    // Extract bot health
    let botHealth = "unknown";
    if (botInsight?.details) {
      const details = botInsight.details as unknown as BotPerformanceReport;
      botHealth = details.overallHealth || "unknown";
      recommendations.push(...(details.recommendations || []).slice(0, 2));
    }

    // Extract feedback rating
    let feedbackRating: number | null = null;
    if (feedbackInsight?.details) {
      const details = feedbackInsight.details as unknown as { stats?: { averageRating?: number }; recommendations?: string[] };
      feedbackRating = details.stats?.averageRating || null;
      recommendations.push(...(details.recommendations || []).slice(0, 2));
    }

    // Count critical issues
    const criticalIssues = await prisma.opsInsight.count({
      where: {
        priority: "URGENT",
        isStale: false,
        isActioned: false,
      },
    });

    return {
      botHealth,
      feedbackRating,
      criticalIssues,
      recommendations: recommendations.slice(0, 5),
    };
  }
}

export const metaBot = new MetaBot();
