/**
 * IngestionIntelligenceService.ts
 *
 * Core intelligence layer for the Ingestion system (Phase 6).
 * Provides auto-parser detection, value prediction, auto-filing, and jurisdiction intelligence.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import {
  IngestionIntelligenceConfig,
  DEFAULT_INGESTION_CONFIG,
  ParserSuggestion,
  PredictedValue,
  ValuePredictionInput,
  JurisdictionKey,
  JurisdictionMetrics,
  AutoFileCandidate,
  AutoFileResult,
  BatchIntelligenceResult,
  FailedRecordAnalysis,
  FailedRecordCluster,
  IIngestionIntelligenceService,
} from "../types/ingestionTypes.js";

const prisma = new PrismaClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createJurisdictionKey(state: string, county: string): JurisdictionKey {
  return `${state.toUpperCase()}_${county.toUpperCase().replace(/\s+/g, "_")}` as JurisdictionKey;
}

function parseJurisdictionKey(key: JurisdictionKey): { state: string; county: string } {
  const parts = key.split("_");
  const state = parts[0];
  const county = parts.slice(1).join(" ");
  return { state, county };
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  const longerLength = longer.length;
  if (longerLength === 0) return 100;

  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round(((longerLength - editDistance) / longerLength) * 100);
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function calculateVolatilityScore(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const stdDev = calculateStandardDeviation(values);
  return Math.min(100, Math.round((stdDev / mean) * 100));
}

// =============================================================================
// INGESTION INTELLIGENCE SERVICE
// =============================================================================

class IngestionIntelligenceService implements IIngestionIntelligenceService {
  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  async getConfig(): Promise<IngestionIntelligenceConfig> {
    const config = await prisma.founderConfig.findFirst({
      where: { key: "ingestion_intelligence" },
    });

    if (!config) {
      return DEFAULT_INGESTION_CONFIG;
    }

    return {
      ...DEFAULT_INGESTION_CONFIG,
      ...(config.value as Record<string, unknown>),
    } as IngestionIntelligenceConfig;
  }

  async updateConfig(updates: Partial<IngestionIntelligenceConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...updates };

    await prisma.founderConfig.upsert({
      where: { key: "ingestion_intelligence" },
      update: {
        value: newConfig as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
      create: {
        key: "ingestion_intelligence",
        value: newConfig as unknown as Record<string, unknown>,
        description: "Ingestion Intelligence configuration",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // FAILED RECORD ANALYSIS
  // ---------------------------------------------------------------------------

  async analyzeFailedRecords(options?: { batchId?: string; limit?: number }): Promise<FailedRecordAnalysis> {
    const limit = options?.limit || 1000;

    // Get failed records
    const failedRecords = await prisma.ingestionRecord.findMany({
      where: {
        status: "ERROR",
        ...(options?.batchId && { batchId: options.batchId }),
      },
      take: limit,
      include: {
        batch: {
          include: {
            source: true,
          },
        },
      },
    });

    // Cluster by error pattern
    const errorClusters = new Map<string, string[]>();
    const errorCounts = new Map<string, number>();

    for (const record of failedRecords) {
      const errorDetails = (record.errorDetails as string) || "Unknown error";
      const normalizedError = this.normalizeErrorPattern(errorDetails);

      if (!errorClusters.has(normalizedError)) {
        errorClusters.set(normalizedError, []);
      }
      errorClusters.get(normalizedError)!.push(record.id);
      errorCounts.set(normalizedError, (errorCounts.get(normalizedError) || 0) + 1);
    }

    // Build clusters
    const clusters: FailedRecordCluster[] = [];
    for (const [errorPattern, recordIds] of errorClusters) {
      // Get common jurisdiction
      const records = failedRecords.filter((r) => recordIds.includes(r.id));
      const jurisdictions = records
        .map((r) => {
          const normalized = r.normalizedData as Record<string, unknown>;
          if (normalized?.state && normalized?.county) {
            return createJurisdictionKey(normalized.state as string, normalized.county as string);
          }
          return null;
        })
        .filter(Boolean) as JurisdictionKey[];

      const jurisdictionCounts = new Map<JurisdictionKey, number>();
      for (const j of jurisdictions) {
        jurisdictionCounts.set(j, (jurisdictionCounts.get(j) || 0) + 1);
      }

      let commonJurisdiction: JurisdictionKey | undefined;
      let maxCount = 0;
      for (const [j, count] of jurisdictionCounts) {
        if (count > maxCount && count / recordIds.length > 0.5) {
          commonJurisdiction = j;
          maxCount = count;
        }
      }

      // Estimate potential value
      const potentialValues = records
        .map((r) => {
          const normalized = r.normalizedData as Record<string, unknown>;
          return (normalized?.amountCents as number) || 0;
        })
        .filter((v) => v > 0);

      const potentialValueCents = potentialValues.reduce((a, b) => a + b, 0);

      clusters.push({
        clusterId: createHash("sha256").update(errorPattern).digest("hex").slice(0, 16),
        errorPattern,
        recordIds,
        recordCount: recordIds.length,
        commonJurisdiction,
        commonSourceType: records[0]?.sourceType,
        suggestedFix: null, // Will be populated by generateParserSuggestion
        potentialValueCents,
        percentOfFailures: Math.round((recordIds.length / failedRecords.length) * 100),
        createdAt: new Date(),
      });
    }

    // Sort clusters by record count
    clusters.sort((a, b) => b.recordCount - a.recordCount);

    // Top errors
    const topErrors = Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: Math.round((count / failedRecords.length) * 100),
        sampleRecordIds: errorClusters.get(errorType)!.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // By jurisdiction
    const jurisdictionFailures = new Map<JurisdictionKey, { total: number; failed: number }>();
    for (const record of failedRecords) {
      const normalized = record.normalizedData as Record<string, unknown>;
      if (normalized?.state && normalized?.county) {
        const key = createJurisdictionKey(normalized.state as string, normalized.county as string);
        if (!jurisdictionFailures.has(key)) {
          jurisdictionFailures.set(key, { total: 0, failed: 0 });
        }
        jurisdictionFailures.get(key)!.failed++;
      }
    }

    const byJurisdiction = Array.from(jurisdictionFailures.entries())
      .map(([jurisdiction, stats]) => {
        const jurisdictionRecords = failedRecords.filter((r) => {
          const normalized = r.normalizedData as Record<string, unknown>;
          return (
            normalized?.state &&
            normalized?.county &&
            createJurisdictionKey(normalized.state as string, normalized.county as string) === jurisdiction
          );
        });
        const topError = this.findMostCommonError(jurisdictionRecords);

        return {
          jurisdiction,
          failureCount: stats.failed,
          failureRate: 100, // All records in this query are failures
          topError,
        };
      })
      .sort((a, b) => b.failureCount - a.failureCount);

    // Generate recommendations
    const recommendations: string[] = [];
    if (clusters.length > 0) {
      recommendations.push(
        `${clusters.length} distinct error patterns detected. Review top clusters for parser improvements.`
      );
    }
    if (clusters[0]?.recordCount > 100) {
      recommendations.push(
        `Largest error cluster has ${clusters[0].recordCount} records. Prioritize fixing pattern: "${clusters[0].errorPattern.slice(0, 50)}..."`
      );
    }
    if (byJurisdiction.some((j) => j.failureCount > 50)) {
      const problematic = byJurisdiction.filter((j) => j.failureCount > 50);
      recommendations.push(
        `${problematic.length} jurisdictions have >50 failures. Consider jurisdiction-specific parser configs.`
      );
    }

    return {
      analyzedAt: new Date(),
      totalFailedRecords: failedRecords.length,
      clusters: clusters.slice(0, 20), // Top 20 clusters
      topErrors,
      byJurisdiction: byJurisdiction.slice(0, 20),
      recommendations,
    };
  }

  private normalizeErrorPattern(error: string): string {
    // Remove specific IDs, numbers, and normalize
    return error
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "<UUID>")
      .replace(/\d+/g, "<NUM>")
      .replace(/line \<NUM\>/g, "line <NUM>")
      .replace(/row \<NUM\>/g, "row <NUM>")
      .slice(0, 200);
  }

  private findMostCommonError(records: Array<{ errorDetails: unknown }>): string {
    const errors = new Map<string, number>();
    for (const record of records) {
      const error = (record.errorDetails as string) || "Unknown";
      const normalized = this.normalizeErrorPattern(error);
      errors.set(normalized, (errors.get(normalized) || 0) + 1);
    }

    let maxError = "Unknown";
    let maxCount = 0;
    for (const [error, count] of errors) {
      if (count > maxCount) {
        maxError = error;
        maxCount = count;
      }
    }
    return maxError;
  }

  // ---------------------------------------------------------------------------
  // PARSER SUGGESTIONS
  // ---------------------------------------------------------------------------

  async generateParserSuggestion(clusterId: string): Promise<ParserSuggestion> {
    // Find the cluster from recent analysis
    const analysis = await this.analyzeFailedRecords({ limit: 500 });
    const cluster = analysis.clusters.find((c) => c.clusterId === clusterId);

    if (!cluster) {
      throw new Error(`Cluster ${clusterId} not found`);
    }

    // Analyze the failed records to suggest patterns
    const records = await prisma.ingestionRecord.findMany({
      where: { id: { in: cluster.recordIds.slice(0, 50) } },
    });

    // Extract common raw data patterns
    const rawDataSamples = records
      .map((r) => r.rawPayload as Record<string, unknown>)
      .filter(Boolean);

    // Generate suggested patterns based on error type
    const suggestedPatterns = this.inferPatterns(cluster.errorPattern, rawDataSamples);
    const suggestedColumnMappings = this.inferColumnMappings(rawDataSamples);

    const suggestion: ParserSuggestion = {
      id: `suggestion_${clusterId}_${Date.now()}`,
      suggestedAt: new Date(),
      sourceType: cluster.commonSourceType || "UNKNOWN",
      jurisdiction: cluster.commonJurisdiction || ("UNKNOWN_UNKNOWN" as JurisdictionKey),
      trigger: "FAILED_RECORDS_CLUSTER",
      triggerDetails: cluster.errorPattern,
      suggestedPatterns,
      suggestedColumnMappings,
      suggestedTransformations: [],
      confidenceScore: Math.min(80, 30 + cluster.recordCount),
      potentialImpact: {
        affectedRecords: cluster.recordCount,
        potentialValueRecoveryCents: cluster.potentialValueCents,
      },
      status: "PENDING",
    };

    // Store the suggestion
    await prisma.opsInsight.create({
      data: {
        source: "IngestionBot",
        category: "PARSER_SUGGESTION",
        severity: cluster.recordCount > 100 ? "HIGH" : "MEDIUM",
        title: `Parser suggestion for cluster ${clusterId}`,
        description: `${cluster.recordCount} records affected. Pattern: ${cluster.errorPattern.slice(0, 100)}`,
        data: suggestion as unknown as Record<string, unknown>,
        status: "OPEN",
      },
    });

    return suggestion;
  }

  private inferPatterns(
    errorPattern: string,
    _rawDataSamples: Record<string, unknown>[]
  ): Array<{ name: string; pattern: string; fieldTarget: string; testCases: Array<{ input: string; expected: string }> }> {
    const patterns: Array<{
      name: string;
      pattern: string;
      fieldTarget: string;
      testCases: Array<{ input: string; expected: string }>;
    }> = [];

    // Infer patterns based on common error types
    if (errorPattern.includes("date") || errorPattern.includes("Date")) {
      patterns.push({
        name: "DateFormat",
        pattern: "(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})",
        fieldTarget: "saleDate",
        testCases: [
          { input: "01/15/2024", expected: "2024-01-15" },
          { input: "1-15-24", expected: "2024-01-15" },
        ],
      });
    }

    if (errorPattern.includes("amount") || errorPattern.includes("Amount") || errorPattern.includes("dollar")) {
      patterns.push({
        name: "CurrencyFormat",
        pattern: "\\$?([\\d,]+)\\.?(\\d{0,2})",
        fieldTarget: "amountCents",
        testCases: [
          { input: "$1,234.56", expected: "123456" },
          { input: "1234", expected: "123400" },
        ],
      });
    }

    if (errorPattern.includes("address") || errorPattern.includes("Address")) {
      patterns.push({
        name: "AddressFormat",
        pattern: "(\\d+)\\s+(.+?)(?:,|$)",
        fieldTarget: "propertyAddress",
        testCases: [
          { input: "123 Main St, Houston", expected: "123 Main St" },
        ],
      });
    }

    return patterns;
  }

  private inferColumnMappings(
    rawDataSamples: Record<string, unknown>[]
  ): Array<{ sourceColumn: string; targetField: string; transformation?: string }> {
    const mappings: Array<{ sourceColumn: string; targetField: string; transformation?: string }> = [];

    if (rawDataSamples.length === 0) return mappings;

    // Get all unique keys from samples
    const allKeys = new Set<string>();
    for (const sample of rawDataSamples) {
      Object.keys(sample).forEach((k) => allKeys.add(k));
    }

    // Infer mappings based on column names
    const fieldMappings: Record<string, string[]> = {
      ownerName: ["owner", "owner_name", "name", "owner name", "property owner"],
      parcelId: ["parcel", "parcel_id", "parcel number", "pin", "apn"],
      propertyAddress: ["address", "property_address", "property address", "site address"],
      amountCents: ["amount", "surplus", "balance", "funds", "overage"],
      saleDate: ["sale_date", "sale date", "auction date", "date sold"],
    };

    for (const [targetField, possibleColumns] of Object.entries(fieldMappings)) {
      for (const key of allKeys) {
        const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, "");
        for (const possible of possibleColumns) {
          const normalizedPossible = possible.toLowerCase().replace(/[_\s-]/g, "");
          if (normalizedKey.includes(normalizedPossible) || normalizedPossible.includes(normalizedKey)) {
            mappings.push({
              sourceColumn: key,
              targetField,
              transformation: targetField === "amountCents" ? "parseCurrency" : undefined,
            });
            break;
          }
        }
      }
    }

    return mappings;
  }

  async getParserSuggestions(status?: string): Promise<ParserSuggestion[]> {
    const insights = await prisma.opsInsight.findMany({
      where: {
        category: "PARSER_SUGGESTION",
        ...(status && { status: status.toUpperCase() }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return insights.map((i) => i.data as unknown as ParserSuggestion);
  }

  async applyParserSuggestion(suggestionId: string): Promise<{ success: boolean; message: string }> {
    const insight = await prisma.opsInsight.findFirst({
      where: {
        category: "PARSER_SUGGESTION",
        data: {
          path: ["id"],
          equals: suggestionId,
        },
      },
    });

    if (!insight) {
      return { success: false, message: "Suggestion not found" };
    }

    // Mark as applied
    await prisma.opsInsight.update({
      where: { id: insight.id },
      data: {
        status: "CLOSED",
        resolvedAt: new Date(),
        data: {
          ...(insight.data as Record<string, unknown>),
          status: "APPLIED",
          appliedAt: new Date().toISOString(),
        },
      },
    });

    // Log the action
    await prisma.botRunLog.create({
      data: {
        botName: "IngestionBot",
        runType: "PARSER_SUGGESTION_APPLIED",
        status: "SUCCESS",
        resultSummary: `Applied parser suggestion ${suggestionId}`,
        recordsProcessed: 1,
        insightsGenerated: 0,
        errorsEncountered: 0,
        durationMs: 0,
      },
    });

    return { success: true, message: `Suggestion ${suggestionId} applied successfully` };
  }

  // ---------------------------------------------------------------------------
  // VALUE PREDICTION
  // ---------------------------------------------------------------------------

  async predictValue(input: ValuePredictionInput): Promise<PredictedValue> {
    const jurisdiction = createJurisdictionKey(input.state, input.county);

    // Get historical data for this jurisdiction
    const historicalRecords = await prisma.ingestionRecord.findMany({
      where: {
        status: "IMPORTED",
        normalizedData: {
          path: ["state"],
          equals: input.state,
        },
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    // Filter by county
    const countyRecords = historicalRecords.filter((r) => {
      const normalized = r.normalizedData as Record<string, unknown>;
      return (normalized?.county as string)?.toUpperCase() === input.county.toUpperCase();
    });

    // Extract amounts
    const amounts = countyRecords
      .map((r) => {
        const normalized = r.normalizedData as Record<string, unknown>;
        return (normalized?.amountCents as number) || 0;
      })
      .filter((a) => a > 0);

    // Calculate statistics
    const jurisdictionAvgCents = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 500000; // Default $5,000

    const volatilityScore = calculateVolatilityScore(amounts);

    // Prediction factors
    const factors = [
      {
        name: "jurisdiction_average",
        weight: 0.6,
        value: jurisdictionAvgCents,
        contribution: jurisdictionAvgCents * 0.6,
      },
      {
        name: "sample_size_confidence",
        weight: 0.2,
        value: Math.min(100, amounts.length),
        contribution: (Math.min(100, amounts.length) / 100) * 0.2 * jurisdictionAvgCents,
      },
      {
        name: "volatility_adjustment",
        weight: -0.2,
        value: volatilityScore,
        contribution: -(volatilityScore / 100) * 0.2 * jurisdictionAvgCents,
      },
    ];

    // If there's a raw amount hint, weight it heavily
    if (input.rawAmountHint && input.rawAmountHint > 0) {
      factors.push({
        name: "raw_amount_hint",
        weight: 0.8,
        value: input.rawAmountHint,
        contribution: input.rawAmountHint * 0.8,
      });
    }

    // Calculate predicted amount
    let predictedAmountCents = factors.reduce((sum, f) => sum + f.contribution, 0);
    predictedAmountCents = Math.max(1000, Math.round(predictedAmountCents)); // Minimum $10

    // Confidence based on sample size and volatility
    const sampleConfidence = Math.min(50, amounts.length);
    const volatilityPenalty = volatilityScore * 0.3;
    const confidenceScore = Math.max(10, Math.min(95, 50 + sampleConfidence - volatilityPenalty));

    return {
      recordId: input.parcelId || `predicted_${Date.now()}`,
      predictedAmountCents,
      confidenceScore: Math.round(confidenceScore),
      factors,
      historicalBasis: {
        jurisdictionAvgCents,
        propertyTypeAvgCents: jurisdictionAvgCents, // Same for now
        sampleSize: amounts.length,
        volatilityScore,
      },
      predictedAt: new Date(),
    };
  }

  async predictBatchValues(recordIds: string[]): Promise<PredictedValue[]> {
    const records = await prisma.ingestionRecord.findMany({
      where: { id: { in: recordIds } },
    });

    const predictions: PredictedValue[] = [];

    for (const record of records) {
      const normalized = record.normalizedData as Record<string, unknown>;
      const state = (normalized?.state as string) || "";
      const county = (normalized?.county as string) || "";

      if (!state || !county) {
        continue;
      }

      const prediction = await this.predictValue({
        state,
        county,
        parcelId: (normalized?.parcelId as string) || record.id,
        rawAmountHint: (normalized?.amountCents as number) || undefined,
      });

      predictions.push({
        ...prediction,
        recordId: record.id,
      });
    }

    return predictions;
  }

  // ---------------------------------------------------------------------------
  // JURISDICTION INTELLIGENCE
  // ---------------------------------------------------------------------------

  async getJurisdictionMetrics(jurisdiction: JurisdictionKey): Promise<JurisdictionMetrics> {
    const { state, county } = parseJurisdictionKey(jurisdiction);

    // Get all records for this jurisdiction
    const records = await prisma.ingestionRecord.findMany({
      where: {
        normalizedData: {
          path: ["state"],
          equals: state,
        },
      },
    });

    // Filter by county
    const countyRecords = records.filter((r) => {
      const normalized = r.normalizedData as Record<string, unknown>;
      return (normalized?.county as string)?.toUpperCase() === county.toUpperCase();
    });

    const successfulRecords = countyRecords.filter((r) => r.status === "IMPORTED").length;
    const failedRecords = countyRecords.filter((r) => r.status === "ERROR").length;
    const successRate = countyRecords.length > 0 ? Math.round((successfulRecords / countyRecords.length) * 100) : 0;

    // Value metrics
    const amounts = countyRecords
      .map((r) => {
        const normalized = r.normalizedData as Record<string, unknown>;
        return (normalized?.amountCents as number) || 0;
      })
      .filter((a) => a > 0);

    const totalValueCents = amounts.reduce((a, b) => a + b, 0);
    const avgValueCents = amounts.length > 0 ? Math.round(totalValueCents / amounts.length) : 0;
    const minValueCents = amounts.length > 0 ? Math.min(...amounts) : 0;
    const maxValueCents = amounts.length > 0 ? Math.max(...amounts) : 0;
    const volatilityScore = calculateVolatilityScore(amounts);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = [];
    for (let i = 0; i < 6; i++) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthRecords = countyRecords.filter(
        (r) => r.createdAt >= monthStart && r.createdAt < monthEnd
      );

      const monthAmounts = monthRecords
        .map((r) => {
          const normalized = r.normalizedData as Record<string, unknown>;
          return (normalized?.amountCents as number) || 0;
        })
        .filter((a) => a > 0);

      const monthSuccessful = monthRecords.filter((r) => r.status === "IMPORTED").length;

      monthlyTrend.push({
        month: monthStart.toISOString().slice(0, 7),
        recordCount: monthRecords.length,
        successRate: monthRecords.length > 0 ? Math.round((monthSuccessful / monthRecords.length) * 100) : 0,
        avgValueCents: monthAmounts.length > 0 ? Math.round(monthAmounts.reduce((a, b) => a + b, 0) / monthAmounts.length) : 0,
      });
    }

    monthlyTrend.reverse();

    return {
      key: jurisdiction,
      state,
      county,
      totalRecords: countyRecords.length,
      successfulRecords,
      failedRecords,
      successRate,
      totalValueCents,
      avgValueCents,
      minValueCents,
      maxValueCents,
      volatilityScore,
      primaryParser: "AutoDetect",
      parserVersions: [{ version: "1.0.0", appliedAt: new Date(), successRate, recordCount: countyRecords.length }],
      lastParserUpdate: new Date(),
      monthlyTrend,
      isHighVolume: countyRecords.length > 100,
      isHighValue: avgValueCents > 1000000, // >$10,000
      needsParserUpdate: successRate < 70 && countyRecords.length > 20,
      hasRuleChanges: false,
      lastCalculatedAt: new Date(),
    };
  }

  async getAllJurisdictionMetrics(): Promise<JurisdictionMetrics[]> {
    // Get all unique state/county combinations
    const records = await prisma.ingestionRecord.findMany({
      select: { normalizedData: true },
      take: 10000,
    });

    const jurisdictions = new Set<JurisdictionKey>();
    for (const record of records) {
      const normalized = record.normalizedData as Record<string, unknown>;
      if (normalized?.state && normalized?.county) {
        jurisdictions.add(createJurisdictionKey(normalized.state as string, normalized.county as string));
      }
    }

    const metrics: JurisdictionMetrics[] = [];
    for (const jurisdiction of Array.from(jurisdictions).slice(0, 50)) {
      metrics.push(await this.getJurisdictionMetrics(jurisdiction));
    }

    return metrics.sort((a, b) => b.totalRecords - a.totalRecords);
  }

  async refreshJurisdictionMetrics(_jurisdiction?: JurisdictionKey): Promise<void> {
    // This would refresh cached metrics - for now, metrics are calculated on-demand
    console.log("Jurisdiction metrics refreshed");
  }

  // ---------------------------------------------------------------------------
  // AUTO-FILING
  // ---------------------------------------------------------------------------

  async evaluateAutoFileCandidate(recordId: string): Promise<AutoFileCandidate> {
    const config = await this.getConfig();

    const record = await prisma.ingestionRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }

    const normalized = record.normalizedData as Record<string, unknown>;
    const state = (normalized?.state as string) || "";
    const county = (normalized?.county as string) || "";
    const amountCents = (normalized?.amountCents as number) || 0;

    // Get jurisdiction metrics
    const jurisdiction = createJurisdictionKey(state, county);
    let jurisdictionMetrics: { successRate: number; avgValueCents: number; volatilityScore: number };

    try {
      const fullMetrics = await this.getJurisdictionMetrics(jurisdiction);
      jurisdictionMetrics = {
        successRate: fullMetrics.successRate,
        avgValueCents: fullMetrics.avgValueCents,
        volatilityScore: fullMetrics.volatilityScore,
      };
    } catch {
      jurisdictionMetrics = { successRate: 50, avgValueCents: 500000, volatilityScore: 50 };
    }

    // Predict value if not available
    let predictedValueCents = amountCents;
    let confidenceScore = 80;

    if (!amountCents || amountCents === 0) {
      const prediction = await this.predictValue({
        state,
        county,
        parcelId: (normalized?.parcelId as string) || recordId,
      });
      predictedValueCents = prediction.predictedAmountCents;
      confidenceScore = prediction.confidenceScore;
    }

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore(
      predictedValueCents,
      jurisdictionMetrics.successRate,
      jurisdictionMetrics.volatilityScore,
      config
    );

    // Determine eligibility
    const eligibilityReasons: string[] = [];
    const ineligibilityReasons: string[] = [];

    if (predictedValueCents >= config.autoFileHighValueThreshold) {
      eligibilityReasons.push(`Value (${(predictedValueCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}) meets threshold`);
    } else {
      ineligibilityReasons.push(`Value below threshold of ${(config.autoFileHighValueThreshold / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`);
    }

    if (jurisdictionMetrics.successRate >= config.autoFileMinSuccessRate) {
      eligibilityReasons.push(`Jurisdiction success rate (${jurisdictionMetrics.successRate}%) meets minimum`);
    } else {
      ineligibilityReasons.push(`Jurisdiction success rate (${jurisdictionMetrics.successRate}%) below minimum ${config.autoFileMinSuccessRate}%`);
    }

    if (config.autoFileEnabled) {
      eligibilityReasons.push("Auto-filing is enabled");
    } else {
      ineligibilityReasons.push("Auto-filing is disabled by FOUNDER");
    }

    const isEligible =
      config.autoFileEnabled &&
      predictedValueCents >= config.autoFileHighValueThreshold &&
      jurisdictionMetrics.successRate >= config.autoFileMinSuccessRate;

    return {
      recordId: `candidate_${recordId}`,
      ingestionRecordId: recordId,
      ownerName: (normalized?.ownerName as string) || "",
      propertyAddress: (normalized?.propertyAddress as string) || "",
      state,
      county,
      parcelId: (normalized?.parcelId as string) || "",
      predictedValueCents,
      actualValueCents: amountCents || undefined,
      priorityScore,
      confidenceScore,
      jurisdictionMetrics,
      isEligible,
      eligibilityReasons,
      ineligibilityReasons,
      status: "PENDING_REVIEW",
      createdAt: new Date(),
    };
  }

  private calculatePriorityScore(
    valueCents: number,
    successRate: number,
    volatilityScore: number,
    config: IngestionIntelligenceConfig
  ): number {
    // Formula: (predictedValue * valueWeight * successRate * successWeight) / (1 + volatility * volatilityPenalty)
    const normalizedValue = valueCents / 1000000; // Normalize to millions
    const normalizedSuccess = successRate / 100;
    const normalizedVolatility = volatilityScore / 100;

    const score =
      (normalizedValue * config.priorityValueWeight + normalizedSuccess * config.prioritySuccessRateWeight) /
      (1 + normalizedVolatility * config.priorityVolatilityPenalty);

    return Math.min(100, Math.max(0, Math.round(score * 100)));
  }

  async getAutoFileCandidates(status?: string): Promise<AutoFileCandidate[]> {
    // Get high-value pending records
    const records = await prisma.ingestionRecord.findMany({
      where: {
        status: "PENDING",
        isHighValue: true,
      },
      take: 100,
      orderBy: { priority: "desc" },
    });

    const candidates: AutoFileCandidate[] = [];
    for (const record of records) {
      const candidate = await this.evaluateAutoFileCandidate(record.id);
      if (!status || candidate.status === status) {
        candidates.push(candidate);
      }
    }

    return candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  async approveAutoFile(candidateId: string): Promise<AutoFileResult> {
    // Extract record ID from candidate ID
    const recordId = candidateId.replace("candidate_", "");

    const record = await prisma.ingestionRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return {
        candidateId,
        success: false,
        error: "Record not found",
        action: "FAILED",
        details: `Record ${recordId} not found in database`,
      };
    }

    const normalized = record.normalizedData as Record<string, unknown>;

    // Check if case already exists for this parcel
    const existingCase = await prisma.case.findFirst({
      where: {
        parcelNumber: (normalized?.parcelId as string) || "",
        state: (normalized?.state as string) || "",
      },
    });

    if (existingCase) {
      return {
        candidateId,
        success: false,
        caseId: existingCase.id,
        action: "ALREADY_EXISTS",
        details: `Case already exists with ID ${existingCase.id}`,
      };
    }

    // Create the case
    try {
      // First, create or find client
      let client = await prisma.client.findFirst({
        where: {
          name: (normalized?.ownerName as string) || "Unknown Owner",
        },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            name: (normalized?.ownerName as string) || "Unknown Owner",
            email: (normalized?.ownerEmail as string) || null,
            phone: (normalized?.ownerPhone as string) || null,
            address: (normalized?.ownerMailingAddress as string) || null,
            city: (normalized?.city as string) || null,
            state: (normalized?.state as string) || null,
            zipCode: (normalized?.zipCode as string) || null,
          },
        });
      }

      const newCase = await prisma.case.create({
        data: {
          internalCode: `AUTO-${Date.now().toString(36).toUpperCase()}`,
          publicAccessToken: createHash("sha256").update(`${recordId}-${Date.now()}`).digest("hex").slice(0, 32),
          clientId: client.id,
          state: (normalized?.state as string) || "",
          county: (normalized?.county as string) || "",
          propertyAddress: (normalized?.propertyAddress as string) || "",
          parcelNumber: (normalized?.parcelId as string) || "",
          saleDate: (normalized?.saleDate as Date) || null,
          surplusAmountCents: (normalized?.amountCents as number) || 0,
          status: "NEW",
          priority: "HIGH",
          source: "AUTO_FILED",
        },
      });

      // Update ingestion record status
      await prisma.ingestionRecord.update({
        where: { id: recordId },
        data: { status: "IMPORTED" },
      });

      // Log the action
      await prisma.botRunLog.create({
        data: {
          botName: "IngestionBot",
          runType: "AUTO_FILE",
          status: "SUCCESS",
          resultSummary: `Auto-filed case ${newCase.id} from record ${recordId}`,
          recordsProcessed: 1,
          insightsGenerated: 1,
          errorsEncountered: 0,
          durationMs: 0,
        },
      });

      return {
        candidateId,
        success: true,
        caseId: newCase.id,
        action: "CASE_CREATED",
        details: `Case ${newCase.internalCode} created successfully`,
      };
    } catch (error) {
      return {
        candidateId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        action: "FAILED",
        details: "Failed to create case",
      };
    }
  }

  async rejectAutoFile(candidateId: string, reason: string): Promise<void> {
    const recordId = candidateId.replace("candidate_", "");

    await prisma.ingestionRecord.update({
      where: { id: recordId },
      data: {
        status: "SKIPPED",
        errorDetails: `Auto-file rejected: ${reason}`,
      },
    });
  }

  async processAutoFileBatch(): Promise<AutoFileResult[]> {
    const config = await this.getConfig();

    if (!config.autoFileEnabled) {
      return [];
    }

    const candidates = await this.getAutoFileCandidates("PENDING_REVIEW");
    const eligibleCandidates = candidates.filter((c) => c.isEligible).slice(0, 10); // Process max 10 at a time

    const results: AutoFileResult[] = [];
    for (const candidate of eligibleCandidates) {
      const result = await this.approveAutoFile(candidate.recordId);
      results.push(result);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // BATCH INTELLIGENCE
  // ---------------------------------------------------------------------------

  async runIntelligentProcess(batchId: string): Promise<BatchIntelligenceResult> {
    const config = await this.getConfig();
    const startTime = Date.now();

    // Get batch records
    const records = await prisma.ingestionRecord.findMany({
      where: { batchId },
    });

    const predictions: PredictedValue[] = [];
    const autoFileCandidates: AutoFileCandidate[] = [];
    const duplicates: Array<{ newRecordId: string; existingRecordId: string; similarityScore: number; fields: string[] }> = [];

    // Process each record
    for (const record of records) {
      const normalized = record.normalizedData as Record<string, unknown>;
      const state = (normalized?.state as string) || "";
      const county = (normalized?.county as string) || "";

      // Value prediction
      if (state && county) {
        try {
          const prediction = await this.predictValue({
            state,
            county,
            parcelId: (normalized?.parcelId as string) || record.id,
            rawAmountHint: (normalized?.amountCents as number) || undefined,
          });
          predictions.push({ ...prediction, recordId: record.id });

          // Check for auto-file eligibility
          if (prediction.predictedAmountCents >= config.autoFileHighValueThreshold) {
            const candidate = await this.evaluateAutoFileCandidate(record.id);
            autoFileCandidates.push(candidate);
          }
        } catch {
          // Skip prediction errors
        }
      }

      // Duplicate detection
      if (config.duplicateCheckEnabled) {
        const dups = await this.findDuplicates(record.id);
        for (const dup of dups) {
          if (dup.similarity >= config.duplicateSimilarityThreshold) {
            duplicates.push({
              newRecordId: record.id,
              existingRecordId: dup.recordId,
              similarityScore: dup.similarity,
              fields: ["ownerName", "parcelId", "propertyAddress"],
            });
          }
        }
      }
    }

    // Analyze failed records for parser suggestions
    const failedAnalysis = await this.analyzeFailedRecords({ batchId, limit: 200 });
    const parserSuggestions: ParserSuggestion[] = [];

    for (const cluster of failedAnalysis.clusters.slice(0, 3)) {
      if (cluster.recordCount >= 5) {
        try {
          const suggestion = await this.generateParserSuggestion(cluster.clusterId);
          parserSuggestions.push(suggestion);
        } catch {
          // Skip suggestion errors
        }
      }
    }

    // Jurisdiction breakdown
    const jurisdictionMap = new Map<JurisdictionKey, { count: number; successRate: number; totalValue: number }>();
    for (const record of records) {
      const normalized = record.normalizedData as Record<string, unknown>;
      if (normalized?.state && normalized?.county) {
        const key = createJurisdictionKey(normalized.state as string, normalized.county as string);
        const existing = jurisdictionMap.get(key) || { count: 0, successRate: 0, totalValue: 0 };
        existing.count++;
        if (record.status === "IMPORTED") existing.successRate++;
        existing.totalValue += (normalized?.amountCents as number) || 0;
        jurisdictionMap.set(key, existing);
      }
    }

    const jurisdictionBreakdown = Array.from(jurisdictionMap.entries()).map(([jurisdiction, stats]) => ({
      jurisdiction,
      recordCount: stats.count,
      successRate: stats.count > 0 ? Math.round((stats.successRate / stats.count) * 100) : 0,
      avgPredictedValueCents: stats.count > 0 ? Math.round(stats.totalValue / stats.count) : 0,
    }));

    // Summary
    const highValueCount = predictions.filter((p) => p.predictedAmountCents >= config.highValueThreshold).length;
    const autoFileEligibleCount = autoFileCandidates.filter((c) => c.isEligible).length;

    const result: BatchIntelligenceResult = {
      batchId,
      processedAt: new Date(),
      totalRecords: records.length,
      successfullyParsed: records.filter((r) => r.status !== "ERROR").length,
      failedToParse: records.filter((r) => r.status === "ERROR").length,
      predictions,
      autoFileCandidates,
      parserSuggestions,
      jurisdictionBreakdown,
      duplicates,
      summary: {
        highValueCount,
        autoFileEligibleCount,
        needsReviewCount: records.filter((r) => r.status === "PENDING").length,
        duplicateCount: duplicates.length,
        parserIssueCount: failedAnalysis.clusters.length,
      },
    };

    // Log the run
    await prisma.botRunLog.create({
      data: {
        botName: "IngestionBot",
        runType: "INTELLIGENT_PROCESS",
        status: "SUCCESS",
        resultSummary: `Processed batch ${batchId}: ${records.length} records, ${highValueCount} high-value, ${autoFileEligibleCount} auto-file eligible`,
        recordsProcessed: records.length,
        insightsGenerated: predictions.length + parserSuggestions.length,
        errorsEncountered: records.filter((r) => r.status === "ERROR").length,
        durationMs: Date.now() - startTime,
      },
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // DUPLICATE DETECTION
  // ---------------------------------------------------------------------------

  async findDuplicates(recordId: string): Promise<Array<{ recordId: string; similarity: number }>> {
    const record = await prisma.ingestionRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) return [];

    const normalized = record.normalizedData as Record<string, unknown>;
    const ownerName = (normalized?.ownerName as string) || "";
    const parcelId = (normalized?.parcelId as string) || "";
    const propertyAddress = (normalized?.propertyAddress as string) || "";

    if (!ownerName && !parcelId && !propertyAddress) return [];

    // Find potential duplicates (same state/county, different record)
    const state = (normalized?.state as string) || "";
    const county = (normalized?.county as string) || "";

    const potentialDuplicates = await prisma.ingestionRecord.findMany({
      where: {
        id: { not: recordId },
        normalizedData: {
          path: ["state"],
          equals: state,
        },
      },
      take: 100,
    });

    const duplicates: Array<{ recordId: string; similarity: number }> = [];

    for (const potentialDup of potentialDuplicates) {
      const dupNormalized = potentialDup.normalizedData as Record<string, unknown>;
      const dupCounty = (dupNormalized?.county as string) || "";

      if (dupCounty.toUpperCase() !== county.toUpperCase()) continue;

      // Calculate similarity scores
      const ownerSimilarity = calculateStringSimilarity(ownerName, (dupNormalized?.ownerName as string) || "");
      const parcelSimilarity = calculateStringSimilarity(parcelId, (dupNormalized?.parcelId as string) || "");
      const addressSimilarity = calculateStringSimilarity(propertyAddress, (dupNormalized?.propertyAddress as string) || "");

      // Weighted average
      const weights = { owner: 0.3, parcel: 0.4, address: 0.3 };
      const totalSimilarity = Math.round(
        ownerSimilarity * weights.owner +
        parcelSimilarity * weights.parcel +
        addressSimilarity * weights.address
      );

      if (totalSimilarity >= 70) {
        duplicates.push({ recordId: potentialDup.id, similarity: totalSimilarity });
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  async detectBatchDuplicates(batchId: string): Promise<Array<{ newId: string; existingId: string; similarity: number }>> {
    const config = await this.getConfig();

    if (!config.duplicateCheckEnabled) return [];

    const records = await prisma.ingestionRecord.findMany({
      where: { batchId },
    });

    const allDuplicates: Array<{ newId: string; existingId: string; similarity: number }> = [];

    for (const record of records) {
      const dups = await this.findDuplicates(record.id);
      for (const dup of dups) {
        if (dup.similarity >= config.duplicateSimilarityThreshold) {
          allDuplicates.push({
            newId: record.id,
            existingId: dup.recordId,
            similarity: dup.similarity,
          });
        }
      }
    }

    return allDuplicates;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const ingestionIntelligenceService = new IngestionIntelligenceService();

export default ingestionIntelligenceService;
