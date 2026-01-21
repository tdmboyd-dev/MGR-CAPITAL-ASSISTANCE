// ============================================
// INGESTION BOT — MGR CAPITAL ASSISTANCE
// Analyzes ingestion batches, flags suspicious patterns
// Suggests priority cases, summarizes data quality
// ============================================

import { PrismaClient, OpsInsightType, OpsInsightPriority } from "@prisma/client";

const prisma = new PrismaClient();

const BOT_NAME = "ingestionBot";

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
}

interface IngestionPattern {
  type: "high_error_rate" | "high_value_cluster" | "duplicate_suspected" | "source_quality";
  description: string;
  severity: "low" | "medium" | "high";
  data: any;
}

interface IngestionAlert {
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}

class IngestionBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  /**
   * Run full ingestion analysis
   */
  async analyze(days: number = 7): Promise<IngestionAnalysis> {
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
            surplusAmount: true,
            caseId: true,
            ownerName: true,
            propertyAddress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate metrics
    const totalBatches = batches.length;
    const totalRecords = batches.reduce((sum, b) => sum + b.totalRecords, 0);
    const createdCases = batches.reduce((sum, b) => sum + b.createdCases, 0);
    const errors = totalRecords - createdCases;
    const errorRate = totalRecords > 0 ? (errors / totalRecords) * 100 : 0;

    // Count high-value records ($10,000+)
    let highValueCount = 0;
    for (const batch of batches) {
      for (const record of batch.records) {
        if (record.surplusAmount && record.surplusAmount >= 1000000) {
          highValueCount++;
        }
      }
    }

    // Detect patterns
    const patterns = await this.detectPatterns(batches);

    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, errorRate, highValueCount);

    // Generate alerts
    const alerts = this.generateAlerts(patterns, errorRate);

    const analysis: IngestionAnalysis = {
      period: `${days} days`,
      totalBatches,
      totalRecords,
      createdCases,
      errorRate: Math.round(errorRate * 100) / 100,
      highValueCount,
      patterns,
      recommendations,
      alerts,
    };

    // Save insight to database
    await this.saveInsight(analysis);

    return analysis;
  }

  // ============================================
  // PATTERN DETECTION
  // ============================================

  private async detectPatterns(batches: any[]): Promise<IngestionPattern[]> {
    const patterns: IngestionPattern[] = [];

    // Group by source
    const bySource = new Map<string, { totalRecords: number; errors: number; batches: number }>();
    for (const batch of batches) {
      const sourceKey = batch.source?.name || "unknown";
      const existing = bySource.get(sourceKey) || { totalRecords: 0, errors: 0, batches: 0 };
      existing.totalRecords += batch.totalRecords;
      existing.errors += batch.totalRecords - batch.createdCases;
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
        if (record.surplusAmount && record.surplusAmount >= 1000000) {
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

    // Detect potential duplicates (same address appearing multiple times)
    const addressCounts = new Map<string, number>();
    for (const batch of batches) {
      for (const record of batch.records) {
        if (record.propertyAddress) {
          const normalized = record.propertyAddress.toLowerCase().trim();
          addressCounts.set(normalized, (addressCounts.get(normalized) || 0) + 1);
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
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    patterns: IngestionPattern[],
    errorRate: number,
    highValueCount: number
  ): string[] {
    const recommendations: string[] = [];

    // High error rate
    if (errorRate > 30) {
      recommendations.push(
        "Consider reviewing ingestion source quality - error rate is above 30%"
      );
    }

    // High-value cases
    if (highValueCount > 0) {
      recommendations.push(
        `Review ${highValueCount} high-value cases for priority processing`
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
  // ALERTS
  // ============================================

  private generateAlerts(patterns: IngestionPattern[], errorRate: number): IngestionAlert[] {
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
        summary: `${analysis.totalRecords} records processed with ${analysis.errorRate}% error rate. ${analysis.highValueCount} high-value records found.`,
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
  // QUICK CHECKS
  // ============================================

  /**
   * Quick check for recent batch quality
   */
  async checkRecentBatch(batchId: string): Promise<{
    quality: "good" | "warning" | "critical";
    message: string;
  }> {
    const batch = await prisma.ingestionBatch.findUnique({
      where: { id: batchId },
      include: { source: true },
    });

    if (!batch) {
      return { quality: "warning", message: "Batch not found" };
    }

    const errorRate =
      batch.totalRecords > 0
        ? ((batch.totalRecords - batch.createdCases) / batch.totalRecords) * 100
        : 0;

    if (errorRate > 50) {
      return {
        quality: "critical",
        message: `Batch has ${errorRate.toFixed(1)}% error rate - review source quality`,
      };
    } else if (errorRate > 20) {
      return {
        quality: "warning",
        message: `Batch has elevated error rate (${errorRate.toFixed(1)}%)`,
      };
    }

    return {
      quality: "good",
      message: `Batch processed successfully with ${batch.createdCases} cases created`,
    };
  }
}

export const ingestionBot = new IngestionBot();
