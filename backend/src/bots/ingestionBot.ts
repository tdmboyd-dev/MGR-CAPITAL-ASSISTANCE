// ============================================
// INGESTION BOT — MGR CAPITAL ASSISTANCE
// Enhanced with Intelligence Layer (Phase 6)
// Analyzes batches, predicts values, auto-files high-value cases,
// generates training modules from ingestion patterns
// Phase 15: AI Agent integration for document analysis
// ============================================

import { OpsInsightType, OpsInsightPriority } from "@prisma/client";
import { ingestionIntelligenceService } from "../services/IngestionIntelligenceService.js";
import { aiAgentService } from "../services/AiAgentService.js";
import {
  IngestionBotAnalysis,
  IngestionBotFinding,
  IngestionFindingType,
  BatchIntelligenceResult,
  JurisdictionKey,
} from "../types/ingestionTypes.js";

import prisma from "../lib/prisma.js";

const BOT_NAME = "IngestionBot";

interface IngestionAnalysis {
  period: string;
  totalBatches: number;
  totalRecords: number;
  createdCases: number;
  errorRate: number;
  highValueCount: number;
  patterns: IngestionPattern[];
  recommendations: string[];
  alerts: IngestionAlert[];
  // Phase 6 additions
  intelligenceResults?: {
    predictionsGenerated: number;
    autoFileCandidates: number;
    parserSuggestionsGenerated: number;
    duplicatesDetected: number;
    trainingModulesGenerated: number;
  };
}

interface IngestionPattern {
  type: "high_error_rate" | "high_value_cluster" | "duplicate_suspected" | "source_quality" | "jurisdiction_issue" | "auto_file_opportunity";
  description: string;
  severity: "low" | "medium" | "high";
  data: Record<string, unknown>;
}

interface IngestionAlert {
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}

class IngestionBot {
  // ============================================
  // MAIN ANALYSIS (Enhanced with Intelligence)
  // ============================================

  /**
   * Run full ingestion analysis with intelligence layer
   */
  async analyze(days: number = 7): Promise<IngestionAnalysis> {
    const startTime = Date.now();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent ingestion batches
    const batches = await prisma.ingestionBatch.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        source: true,
        records: {
          select: {
            id: true,
            status: true,
            isHighValue: true,
            priority: true,
            normalizedData: true,
            errorDetails: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate metrics
    const totalBatches = batches.length;
    const totalRecords = batches.reduce((sum, b) => sum + b.recordCount, 0);
    const successRecords = batches.reduce((sum, b) => sum + b.successCount, 0);
    const errorRate = totalRecords > 0 ? ((totalRecords - successRecords) / totalRecords) * 100 : 0;

    // Count high-value records
    let highValueCount = 0;
    for (const batch of batches) {
      for (const record of batch.records) {
        if (record.isHighValue) {
          highValueCount++;
        }
      }
    }

    // Detect patterns (enhanced)
    const patterns = await this.detectPatterns(batches);

    // Run intelligence analysis on recent batches
    const intelligenceResults = await this.runIntelligenceAnalysis(batches);

    // Generate recommendations (enhanced)
    const recommendations = this.generateRecommendations(patterns, errorRate, highValueCount, intelligenceResults);

    // Generate alerts (enhanced)
    const alerts = this.generateAlerts(patterns, errorRate, intelligenceResults);

    const analysis: IngestionAnalysis = {
      period: `${days} days`,
      totalBatches,
      totalRecords,
      createdCases: successRecords,
      errorRate: Math.round(errorRate * 100) / 100,
      highValueCount,
      patterns,
      recommendations,
      alerts,
      intelligenceResults,
    };

    // Save insight to database
    await this.saveInsight(analysis);

    // Log the run
    await prisma.botRunLog.create({
      data: {
        botName: `${BOT_NAME}:FULL_ANALYSIS`,
        success: !alerts.some((a) => a.severity === "critical"),
        summary: `Analyzed ${totalRecords} records with ${errorRate.toFixed(1)}% error rate. ${highValueCount} high-value found.`,
        recordsProcessed: totalRecords,
        insightsGenerated: patterns.length + (intelligenceResults?.parserSuggestionsGenerated || 0),
        alertsCreated: Math.round((totalRecords * errorRate) / 100),
        durationMs: Date.now() - startTime,
      },
    });

    return analysis;
  }

  // ============================================
  // INTELLIGENCE ANALYSIS (Phase 6)
  // ============================================

  private async runIntelligenceAnalysis(batches: Array<{ id: string; records: Array<{ id: string }> }>): Promise<{
    predictionsGenerated: number;
    autoFileCandidates: number;
    parserSuggestionsGenerated: number;
    duplicatesDetected: number;
    trainingModulesGenerated: number;
  }> {
    let predictionsGenerated = 0;
    let autoFileCandidates = 0;
    let parserSuggestionsGenerated = 0;
    let duplicatesDetected = 0;
    let trainingModulesGenerated = 0;

    // Analyze failed records for parser suggestions
    try {
      const failedAnalysis = await ingestionIntelligenceService.analyzeFailedRecords({ limit: 500 });

      // Generate suggestions for top clusters
      for (const cluster of failedAnalysis.clusters.slice(0, 3)) {
        if (cluster.recordCount >= 10) {
          try {
            await ingestionIntelligenceService.generateParserSuggestion(cluster.clusterId);
            parserSuggestionsGenerated++;

            // Generate training module for this pattern
            await this.generateTrainingModuleFromPattern(cluster);
            trainingModulesGenerated++;
          } catch {
            // Skip individual suggestion errors
          }
        }
      }
    } catch (error) {
      console.error("Failed record analysis error:", error);
    }

    // Get auto-file candidates
    try {
      const candidates = await ingestionIntelligenceService.getAutoFileCandidates();
      autoFileCandidates = candidates.filter((c) => c.isEligible).length;

      // Predict values for pending records in recent batches
      for (const batch of batches.slice(0, 5)) {
        const pendingRecordIds = batch.records.slice(0, 20).map((r) => r.id);
        if (pendingRecordIds.length > 0) {
          try {
            const predictions = await ingestionIntelligenceService.predictBatchValues(pendingRecordIds);
            predictionsGenerated += predictions.length;
          } catch {
            // Skip prediction errors
          }
        }
      }
    } catch (error) {
      console.error("Auto-file analysis error:", error);
    }

    // Detect duplicates in recent batches
    for (const batch of batches.slice(0, 3)) {
      try {
        const duplicates = await ingestionIntelligenceService.detectBatchDuplicates(batch.id);
        duplicatesDetected += duplicates.length;
      } catch {
        // Skip duplicate detection errors
      }
    }

    return {
      predictionsGenerated,
      autoFileCandidates,
      parserSuggestionsGenerated,
      duplicatesDetected,
      trainingModulesGenerated,
    };
  }

  // ============================================
  // TRAINING MODULE GENERATION
  // ============================================

  private async generateTrainingModuleFromPattern(cluster: {
    clusterId: string;
    errorPattern: string;
    recordCount: number;
    commonJurisdiction?: JurisdictionKey;
    potentialValueCents: number;
  }): Promise<void> {
    // Check if module already exists for this pattern
    const existingModule = await prisma.dynamicTrainingModule.findFirst({
      where: {
        title: { contains: cluster.clusterId },
      },
    });

    if (existingModule) return;

    // Create dynamic training module
    const moduleContent = this.buildModuleContentFromPattern(cluster);

    await prisma.dynamicTrainingModule.create({
      data: {
        title: `Ingestion Pattern: ${cluster.errorPattern.slice(0, 50)}`,
        description: `Training module auto-generated from ingestion error pattern affecting ${cluster.recordCount} records`,
        sourceType: "OPS_INSIGHT",
        content: moduleContent as any,
        targetRoles: ["ADMIN", "EMPLOYEE"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        generatedBy: BOT_NAME,
      },
    });

    // Create OpsInsight for the new module
    await prisma.opsInsight.create({
      data: {
        source: BOT_NAME,
        category: "TRAINING_MODULE_GENERATED",
        severity: "LOW",
        title: `Training module created for ingestion pattern`,
        description: `Auto-generated training for pattern affecting ${cluster.recordCount} records. Potential value: $${(cluster.potentialValueCents / 100).toLocaleString()}`,
        data: { clusterId: cluster.clusterId, recordCount: cluster.recordCount },
        status: "OPEN",
      },
    });
  }

  private buildModuleContentFromPattern(cluster: {
    errorPattern: string;
    recordCount: number;
    commonJurisdiction?: JurisdictionKey;
  }): Record<string, unknown> {
    return {
      type: "ingestion_pattern",
      sections: [
        {
          title: "Pattern Overview",
          content: `This pattern has affected ${cluster.recordCount} ingestion records. Understanding and addressing this pattern will improve data quality.`,
        },
        {
          title: "Error Pattern",
          content: cluster.errorPattern,
        },
        {
          title: "Affected Jurisdiction",
          content: cluster.commonJurisdiction || "Multiple jurisdictions",
        },
        {
          title: "Resolution Steps",
          content: [
            "Review the error pattern to understand the data format issue",
            "Check if source data format has changed",
            "Update parser configuration if needed",
            "Re-process affected records after fix",
          ],
        },
      ],
      quiz: {
        questions: [
          {
            question: "What should you do when you encounter this error pattern?",
            options: [
              "Ignore it",
              "Report to FOUNDER and await parser update",
              "Manually fix each record",
              "Delete the records",
            ],
            correctAnswer: 1,
          },
        ],
      },
    };
  }

  // ============================================
  // PATTERN DETECTION (Enhanced)
  // ============================================

  private async detectPatterns(batches: Array<{
    source: { name: string; state?: string | null } | null;
    recordCount: number;
    successCount: number;
    records: Array<{
      isHighValue: boolean;
      normalizedData: unknown;
      status: string;
    }>;
  }>): Promise<IngestionPattern[]> {
    const patterns: IngestionPattern[] = [];

    // Group by source
    const bySource = new Map<string, { totalRecords: number; errors: number; batches: number }>();
    for (const batch of batches) {
      const sourceKey = batch.source?.name || "unknown";
      const existing = bySource.get(sourceKey) || { totalRecords: 0, errors: 0, batches: 0 };
      existing.totalRecords += batch.recordCount;
      existing.errors += batch.recordCount - batch.successCount;
      existing.batches++;
      bySource.set(sourceKey, existing);
    }

    // Detect high error rates per source
    for (const [source, data] of bySource.entries()) {
      const errorRate = data.totalRecords > 0 ? (data.errors / data.totalRecords) * 100 : 0;
      if (errorRate > 20 && data.totalRecords >= 10) {
        patterns.push({
          type: "high_error_rate",
          description: `Source "${source}" has ${errorRate.toFixed(1)}% error rate`,
          severity: errorRate > 50 ? "high" : "medium",
          data: { source, errorRate, totalRecords: data.totalRecords, errors: data.errors },
        });
      }
    }

    // Detect high-value clusters by state
    const highValueByState = new Map<string, number>();
    for (const batch of batches) {
      for (const record of batch.records) {
        if (record.isHighValue) {
          const state = batch.source?.state || "unknown";
          highValueByState.set(state, (highValueByState.get(state) || 0) + 1);
        }
      }
    }

    for (const [state, count] of highValueByState.entries()) {
      if (count >= 5) {
        patterns.push({
          type: "high_value_cluster",
          description: `${count} high-value records from ${state}`,
          severity: "low",
          data: { state, count },
        });
      }
    }

    // Detect jurisdiction issues (low success rate)
    try {
      const jurisdictionMetrics = await ingestionIntelligenceService.getAllJurisdictionMetrics();
      const problematicJurisdictions = jurisdictionMetrics.filter(
        (j) => j.successRate < 50 && j.totalRecords >= 20
      );

      for (const jurisdiction of problematicJurisdictions.slice(0, 5)) {
        patterns.push({
          type: "jurisdiction_issue",
          description: `${jurisdiction.state}/${jurisdiction.county} has ${jurisdiction.successRate}% success rate`,
          severity: jurisdiction.successRate < 30 ? "high" : "medium",
          data: {
            jurisdiction: jurisdiction.key,
            successRate: jurisdiction.successRate,
            totalRecords: jurisdiction.totalRecords,
            needsParserUpdate: jurisdiction.needsParserUpdate,
          },
        });
      }
    } catch {
      // Skip jurisdiction analysis if it fails
    }

    // Detect auto-file opportunities
    try {
      const candidates = await ingestionIntelligenceService.getAutoFileCandidates();
      const eligibleCount = candidates.filter((c) => c.isEligible).length;

      if (eligibleCount >= 3) {
        patterns.push({
          type: "auto_file_opportunity",
          description: `${eligibleCount} records eligible for auto-filing`,
          severity: "low",
          data: {
            eligibleCount,
            totalCandidates: candidates.length,
            topCandidates: candidates.slice(0, 3).map((c) => ({
              ownerName: c.ownerName,
              predictedValue: c.predictedValueCents,
              priorityScore: c.priorityScore,
            })),
          },
        });
      }
    } catch {
      // Skip auto-file analysis if it fails
    }

    // Detect potential duplicates
    const addressCounts = new Map<string, number>();
    for (const batch of batches) {
      for (const record of batch.records) {
        const normalized = record.normalizedData as Record<string, unknown>;
        const address = (normalized?.propertyAddress as string) || "";
        if (address) {
          const normalizedAddr = address.toLowerCase().trim();
          addressCounts.set(normalizedAddr, (addressCounts.get(normalizedAddr) || 0) + 1);
        }
      }
    }

    const duplicateSuspects = Array.from(addressCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([address, count]) => ({ address, count }));

    if (duplicateSuspects.length > 0) {
      patterns.push({
        type: "duplicate_suspected",
        description: `${duplicateSuspects.length} addresses appear multiple times`,
        severity: duplicateSuspects.length > 10 ? "medium" : "low",
        data: { count: duplicateSuspects.length, samples: duplicateSuspects.slice(0, 5) },
      });
    }

    return patterns;
  }

  // ============================================
  // RECOMMENDATIONS (Enhanced)
  // ============================================

  private generateRecommendations(
    patterns: IngestionPattern[],
    errorRate: number,
    highValueCount: number,
    intelligenceResults?: {
      autoFileCandidates: number;
      parserSuggestionsGenerated: number;
      duplicatesDetected: number;
    }
  ): string[] {
    const recommendations: string[] = [];

    // High error rate
    if (errorRate > 30) {
      recommendations.push(
        "Review ingestion source quality - error rate is above 30%. Check parser suggestions for fixes."
      );
    }

    // High-value cases
    if (highValueCount > 0) {
      recommendations.push(
        `Review ${highValueCount} high-value cases for priority processing`
      );
    }

    // Auto-file opportunities
    if (intelligenceResults?.autoFileCandidates && intelligenceResults.autoFileCandidates > 0) {
      recommendations.push(
        `${intelligenceResults.autoFileCandidates} records are eligible for auto-filing. Review in Intelligence panel.`
      );
    }

    // Parser suggestions
    if (intelligenceResults?.parserSuggestionsGenerated && intelligenceResults.parserSuggestionsGenerated > 0) {
      recommendations.push(
        `${intelligenceResults.parserSuggestionsGenerated} new parser suggestions generated. Review and apply to improve parsing.`
      );
    }

    // Duplicates
    if (intelligenceResults?.duplicatesDetected && intelligenceResults.duplicatesDetected > 0) {
      recommendations.push(
        `${intelligenceResults.duplicatesDetected} potential duplicate records detected. Review before processing.`
      );
    }

    // Pattern-based recommendations
    for (const pattern of patterns) {
      switch (pattern.type) {
        case "high_error_rate":
          recommendations.push(
            `Investigate errors from source: ${pattern.data.source}`
          );
          break;
        case "high_value_cluster":
          recommendations.push(
            `Prioritize cases from ${pattern.data.state} - multiple high-value opportunities`
          );
          break;
        case "jurisdiction_issue":
          recommendations.push(
            `Update parser for ${pattern.data.jurisdiction} - success rate is ${pattern.data.successRate}%`
          );
          break;
        case "auto_file_opportunity":
          recommendations.push(
            `Enable auto-filing to process ${pattern.data.eligibleCount} eligible high-value records automatically`
          );
          break;
        case "duplicate_suspected":
          recommendations.push(
            "Review potential duplicate records before processing"
          );
          break;
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Ingestion quality looks good - no immediate action needed");
    }

    return recommendations;
  }

  // ============================================
  // ALERTS (Enhanced)
  // ============================================

  private generateAlerts(
    patterns: IngestionPattern[],
    errorRate: number,
    intelligenceResults?: {
      autoFileCandidates: number;
      duplicatesDetected: number;
    }
  ): IngestionAlert[] {
    const alerts: IngestionAlert[] = [];

    if (errorRate > 50) {
      alerts.push({
        title: "Critical: High Ingestion Error Rate",
        message: `Ingestion error rate is ${errorRate.toFixed(1)}%. Immediate review required.`,
        severity: "critical",
      });
    } else if (errorRate > 30) {
      alerts.push({
        title: "Warning: Elevated Error Rate",
        message: `Ingestion error rate is ${errorRate.toFixed(1)}%. Consider investigating.`,
        severity: "high",
      });
    }

    // Auto-file opportunity alert
    if (intelligenceResults?.autoFileCandidates && intelligenceResults.autoFileCandidates >= 5) {
      alerts.push({
        title: "Auto-File Opportunity",
        message: `${intelligenceResults.autoFileCandidates} high-value records ready for auto-filing`,
        severity: "medium",
      });
    }

    // Duplicate alert
    if (intelligenceResults?.duplicatesDetected && intelligenceResults.duplicatesDetected >= 10) {
      alerts.push({
        title: "Duplicate Records Detected",
        message: `${intelligenceResults.duplicatesDetected} potential duplicates found. Review required.`,
        severity: "medium",
      });
    }

    for (const pattern of patterns) {
      if (pattern.severity === "high") {
        alerts.push({
          title: `Pattern Detected: ${pattern.type}`,
          message: pattern.description,
          severity: "high",
        });
      }
    }

    return alerts;
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: IngestionAnalysis): Promise<void> {
    const priority = analysis.alerts.some((a) => a.severity === "critical")
      ? "URGENT"
      : analysis.alerts.some((a) => a.severity === "high")
      ? "HIGH"
      : analysis.alerts.length > 0
      ? "NORMAL"
      : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "INGESTION_ANALYSIS" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: `Ingestion Analysis (${analysis.period})`,
        summary: `${analysis.totalRecords} records processed with ${analysis.errorRate}% error rate. ${analysis.highValueCount} high-value records found. ${analysis.intelligenceResults?.autoFileCandidates || 0} auto-file candidates.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }

  private generatePlainEnglish(analysis: IngestionAnalysis): string {
    const parts: string[] = [];

    parts.push(
      `In the last ${analysis.period}, we processed ${analysis.totalBatches} ingestion batches containing ${analysis.totalRecords} records.`
    );

    if (analysis.errorRate > 20) {
      parts.push(
        `There's a concern: ${analysis.errorRate}% of records had errors. This is higher than normal.`
      );
    } else {
      parts.push(`Error rate is healthy at ${analysis.errorRate}%.`);
    }

    if (analysis.highValueCount > 0) {
      parts.push(
        `Good news: We found ${analysis.highValueCount} high-value cases worth prioritizing.`
      );
    }

    // Intelligence results
    if (analysis.intelligenceResults) {
      const ir = analysis.intelligenceResults;
      if (ir.autoFileCandidates > 0) {
        parts.push(`${ir.autoFileCandidates} records are eligible for automatic case creation.`);
      }
      if (ir.parserSuggestionsGenerated > 0) {
        parts.push(`Generated ${ir.parserSuggestionsGenerated} parser improvement suggestions.`);
      }
      if (ir.duplicatesDetected > 0) {
        parts.push(`Detected ${ir.duplicatesDetected} potential duplicate records.`);
      }
      if (ir.trainingModulesGenerated > 0) {
        parts.push(`Created ${ir.trainingModulesGenerated} training modules for new patterns.`);
      }
    }

    if (analysis.patterns.length > 0) {
      parts.push(`\nI noticed some patterns:`);
      for (const pattern of analysis.patterns) {
        parts.push(`- ${pattern.description}`);
      }
    }

    if (analysis.recommendations.length > 0) {
      parts.push(`\nMy recommendations:`);
      for (const rec of analysis.recommendations) {
        parts.push(`- ${rec}`);
      }
    }

    return parts.join("\n");
  }

  // ============================================
  // INTELLIGENT BATCH PROCESSING
  // ============================================

  /**
   * Run intelligent processing on a specific batch
   */
  async processIntelligentBatch(batchId: string): Promise<BatchIntelligenceResult> {
    return ingestionIntelligenceService.runIntelligentProcess(batchId);
  }

  // ============================================
  // QUICK CHECKS
  // ============================================

  /**
   * Quick check for recent batch quality
   */
  async checkRecentBatch(batchId: string): Promise<{
    quality: "good" | "warning" | "critical";
    message: string;
    intelligenceSummary?: {
      predictedTotalValue: number;
      autoFileEligible: number;
      duplicatesFound: number;
    };
  }> {
    const batch = await prisma.ingestionBatch.findUnique({
      where: { id: batchId },
      include: { source: true },
    });

    if (!batch) {
      return { quality: "warning", message: "Batch not found" };
    }

    const errorRate =
      batch.recordCount > 0
        ? ((batch.recordCount - batch.successCount) / batch.recordCount) * 100
        : 0;

    // Run quick intelligence check
    let intelligenceSummary;
    try {
      const result = await ingestionIntelligenceService.runIntelligentProcess(batchId);
      intelligenceSummary = {
        predictedTotalValue: result.predictions.reduce((sum, p) => sum + p.predictedAmountCents, 0),
        autoFileEligible: result.summary.autoFileEligibleCount,
        duplicatesFound: result.summary.duplicateCount,
      };
    } catch {
      // Skip intelligence if it fails
    }

    if (errorRate > 50) {
      return {
        quality: "critical",
        message: `Batch has ${errorRate.toFixed(1)}% error rate - review source quality`,
        intelligenceSummary,
      };
    } else if (errorRate > 20) {
      return {
        quality: "warning",
        message: `Batch has elevated error rate (${errorRate.toFixed(1)}%)`,
        intelligenceSummary,
      };
    }

    return {
      quality: "good",
      message: `Batch processed successfully with ${batch.successCount} records imported`,
      intelligenceSummary,
    };
  }

  // ============================================
  // AUTO-FILE BATCH PROCESSING
  // ============================================

  /**
   * Process all eligible auto-file candidates
   */
  async runAutoFileBatch(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{ candidateId: string; success: boolean; caseId?: string; error?: string }>;
  }> {
    const results = await ingestionIntelligenceService.processAutoFileBatch();

    const successful = results.filter((r) => r.success).length;

    // Log the run
    await prisma.botRunLog.create({
      data: {
        botName: `${BOT_NAME}:AUTO_FILE_BATCH`,
        success: successful > 0,
        summary: `Auto-filed ${successful}/${results.length} candidates`,
        recordsProcessed: results.length,
        insightsGenerated: successful,
        alertsCreated: results.length - successful,
        durationMs: 0,
      },
    });

    return {
      processed: results.length,
      successful,
      failed: results.length - successful,
      results: results.map((r) => ({
        candidateId: r.candidateId,
        success: r.success,
        caseId: r.caseId,
        error: r.error,
      })),
    };
  }

  // ============================================
  // AI AGENT INTEGRATION (Phase 15)
  // ============================================

  /**
   * Use AI Agent to analyze a document for extraction suggestions
   */
  async aiAnalyzeDocument(documentId: string): Promise<{
    summary: string;
    keyPoints: string[];
    missingInfo: string[];
    recommendations: string[];
    aiPowered: boolean;
  }> {
    try {
      const result = await aiAgentService.reviewDocument(documentId);
      return {
        ...result,
        aiPowered: true,
      };
    } catch (error) {
      // Fallback to basic info
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { fileName: true, type: true, status: true },
      });

      return {
        summary: doc ? `Document: ${doc.fileName} (${doc.type})` : "Document not found",
        keyPoints: [],
        missingInfo: ["AI analysis unavailable"],
        recommendations: ["Manual review required"],
        aiPowered: false,
      };
    }
  }

  /**
   * Use AI Agent to generate research summary for ingestion source
   */
  async aiResearchSource(sourceId: string): Promise<{
    summary: string;
    insights: string[];
    success: boolean;
  }> {
    try {
      const source = await prisma.ingestionSource.findUnique({
        where: { id: sourceId },
        include: {
          batches: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: { recordCount: true, successCount: true },
          },
        },
      });

      if (!source) {
        return {
          summary: "Source not found",
          insights: [],
          success: false,
        };
      }

      const totalRecords = source.batches.reduce((sum, b) => sum + b.recordCount, 0);
      const successRecords = source.batches.reduce((sum, b) => sum + b.successCount, 0);
      const successRate = totalRecords > 0 ? (successRecords / totalRecords) * 100 : 0;

      const result = await aiAgentService.execute("research", {
        customData: {
          sourceName: source.name,
          sourceType: source.type,
          state: source.state,
          recentBatches: source.batches.length,
          successRate: successRate.toFixed(1) + "%",
        },
      });

      return {
        summary: result.output,
        insights: result.success ? ["AI-powered analysis completed"] : [],
        success: result.success,
      };
    } catch (error) {
      return {
        summary: "Analysis failed",
        insights: [],
        success: false,
      };
    }
  }
}

export const ingestionBot = new IngestionBot();
