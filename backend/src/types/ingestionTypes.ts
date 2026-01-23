/**
 * ingestionTypes.ts
 *
 * Complete type definitions for the Ingestion Intelligence Layer (Phase 6).
 * Supports auto-parser detection, value prediction, auto-filing, and jurisdiction intelligence.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

// =============================================================================
// INGESTION INTELLIGENCE CONFIG (FounderConfig keys)
// =============================================================================

export interface IngestionIntelligenceConfig {
  // Auto-filing thresholds
  autoFileHighValueThreshold: number; // Cents - e.g., 1000000 = $10,000
  autoFileMinSuccessRate: number; // 0-100 - minimum jurisdiction success rate to auto-file
  autoFileEnabled: boolean;

  // Duplicate detection
  duplicateCheckEnabled: boolean;
  duplicateSimilarityThreshold: number; // 0-100 - string similarity %

  // Parser settings
  parserRetryAttempts: number;
  parserTimeoutMs: number;

  // Priority scoring weights
  priorityValueWeight: number; // Weight for predicted value in priority score
  prioritySuccessRateWeight: number; // Weight for jurisdiction success rate
  priorityVolatilityPenalty: number; // Penalty multiplier for high volatility

  // Thresholds
  highValueThreshold: number; // Cents - mark as high value
  lowSuccessRateThreshold: number; // 0-100 - flag jurisdiction as risky
}

export const DEFAULT_INGESTION_CONFIG: IngestionIntelligenceConfig = {
  autoFileHighValueThreshold: 1000000, // $10,000
  autoFileMinSuccessRate: 70,
  autoFileEnabled: false, // Disabled by default - FOUNDER must enable

  duplicateCheckEnabled: true,
  duplicateSimilarityThreshold: 85,

  parserRetryAttempts: 3,
  parserTimeoutMs: 30000,

  priorityValueWeight: 0.5,
  prioritySuccessRateWeight: 0.3,
  priorityVolatilityPenalty: 0.2,

  highValueThreshold: 500000, // $5,000
  lowSuccessRateThreshold: 40,
};

// =============================================================================
// PARSER SUGGESTION TYPES
// =============================================================================

export interface ParserSuggestion {
  id: string;
  suggestedAt: Date;
  sourceType: string;
  jurisdiction: JurisdictionKey;

  // What triggered the suggestion
  trigger: ParserSuggestionTrigger;
  triggerDetails: string;

  // Suggested changes
  suggestedPatterns: RegexPattern[];
  suggestedColumnMappings: ColumnMapping[];
  suggestedTransformations: DataTransformation[];

  // Confidence and impact
  confidenceScore: number; // 0-100
  potentialImpact: {
    affectedRecords: number;
    potentialValueRecoveryCents: number;
  };

  // Status
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export type ParserSuggestionTrigger =
  | "FAILED_RECORDS_CLUSTER"
  | "NEW_FORMAT_DETECTED"
  | "JURISDICTION_CHANGE"
  | "LOW_SUCCESS_RATE"
  | "MANUAL_REQUEST";

export interface RegexPattern {
  name: string;
  pattern: string;
  fieldTarget: string;
  testCases: Array<{ input: string; expected: string }>;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transformation?: string;
}

export interface DataTransformation {
  field: string;
  type: "CLEAN" | "PARSE" | "FORMAT" | "NORMALIZE" | "EXTRACT";
  params: Record<string, unknown>;
}

// =============================================================================
// VALUE PREDICTION TYPES
// =============================================================================

export interface PredictedValue {
  recordId: string;
  predictedAmountCents: number;
  confidenceScore: number; // 0-100

  // Prediction factors
  factors: PredictionFactor[];

  // Historical basis
  historicalBasis: {
    jurisdictionAvgCents: number;
    propertyTypeAvgCents: number;
    sampleSize: number;
    volatilityScore: number; // 0-100, higher = more volatile
  };

  // Prediction date
  predictedAt: Date;
}

export interface PredictionFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number; // How much this factor contributed to prediction
}

export interface ValuePredictionInput {
  state: string;
  county: string;
  propertyType?: string;
  saleDate?: Date;
  parcelId?: string;
  rawAmountHint?: number; // If partial amount data exists
}

// =============================================================================
// JURISDICTION INTELLIGENCE TYPES
// =============================================================================

export type JurisdictionKey = `${string}_${string}`; // STATE_COUNTY format

export interface JurisdictionMetrics {
  key: JurisdictionKey;
  state: string;
  county: string;

  // Performance metrics
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  successRate: number; // 0-100

  // Value metrics
  totalValueCents: number;
  avgValueCents: number;
  minValueCents: number;
  maxValueCents: number;
  volatilityScore: number; // Standard deviation as % of mean

  // Parser metrics
  primaryParser: string;
  parserVersions: ParserVersion[];
  lastParserUpdate: Date;

  // Trend data
  monthlyTrend: MonthlyMetric[];

  // Flags
  isHighVolume: boolean;
  isHighValue: boolean;
  needsParserUpdate: boolean;
  hasRuleChanges: boolean;

  // Last updated
  lastCalculatedAt: Date;
}

export interface ParserVersion {
  version: string;
  appliedAt: Date;
  successRate: number;
  recordCount: number;
}

export interface MonthlyMetric {
  month: string; // YYYY-MM format
  recordCount: number;
  successRate: number;
  avgValueCents: number;
}

// =============================================================================
// AUTO-FILE CANDIDATE TYPES
// =============================================================================

export interface AutoFileCandidate {
  recordId: string;
  ingestionRecordId: string;

  // Record details
  ownerName: string;
  propertyAddress: string;
  state: string;
  county: string;
  parcelId: string;

  // Value
  predictedValueCents: number;
  actualValueCents?: number;

  // Scoring
  priorityScore: number;
  confidenceScore: number;

  // Jurisdiction context
  jurisdictionMetrics: {
    successRate: number;
    avgValueCents: number;
    volatilityScore: number;
  };

  // Auto-file eligibility
  isEligible: boolean;
  eligibilityReasons: string[];
  ineligibilityReasons: string[];

  // Status
  status: "PENDING_REVIEW" | "AUTO_FILED" | "MANUALLY_FILED" | "REJECTED" | "EXPIRED";
  autoFiledAt?: Date;
  caseId?: string; // If case was created

  // Audit
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface AutoFileResult {
  candidateId: string;
  success: boolean;
  caseId?: string;
  error?: string;

  // What happened
  action: "CASE_CREATED" | "ALREADY_EXISTS" | "FAILED" | "REJECTED";
  details: string;
}

// =============================================================================
// BATCH INTELLIGENCE TYPES
// =============================================================================

export interface BatchIntelligenceResult {
  batchId: string;
  processedAt: Date;

  // Basic stats
  totalRecords: number;
  successfullyParsed: number;
  failedToParse: number;

  // Intelligence results
  predictions: PredictedValue[];
  autoFileCandidates: AutoFileCandidate[];
  parserSuggestions: ParserSuggestion[];

  // Jurisdiction breakdown
  jurisdictionBreakdown: Array<{
    jurisdiction: JurisdictionKey;
    recordCount: number;
    successRate: number;
    avgPredictedValueCents: number;
  }>;

  // Duplicate detection
  duplicates: Array<{
    newRecordId: string;
    existingRecordId: string;
    similarityScore: number;
    fields: string[];
  }>;

  // Summary
  summary: {
    highValueCount: number;
    autoFileEligibleCount: number;
    needsReviewCount: number;
    duplicateCount: number;
    parserIssueCount: number;
  };
}

// =============================================================================
// FAILED RECORD ANALYSIS TYPES
// =============================================================================

export interface FailedRecordCluster {
  clusterId: string;
  errorPattern: string;
  recordIds: string[];
  recordCount: number;

  // Common characteristics
  commonJurisdiction?: JurisdictionKey;
  commonSourceType?: string;
  commonFileType?: string;

  // Suggested fix
  suggestedFix: ParserSuggestion | null;

  // Impact
  potentialValueCents: number;
  percentOfFailures: number;

  createdAt: Date;
}

export interface FailedRecordAnalysis {
  analyzedAt: Date;
  totalFailedRecords: number;

  // Clusters of similar failures
  clusters: FailedRecordCluster[];

  // Top error types
  topErrors: Array<{
    errorType: string;
    count: number;
    percentage: number;
    sampleRecordIds: string[];
  }>;

  // Jurisdiction breakdown
  byJurisdiction: Array<{
    jurisdiction: JurisdictionKey;
    failureCount: number;
    failureRate: number;
    topError: string;
  }>;

  // Recommendations
  recommendations: string[];
}

// =============================================================================
// INGESTION BOT ENHANCED TYPES
// =============================================================================

export interface IngestionBotAnalysis {
  runId: string;
  runAt: Date;
  runTimeMs: number;

  // What was analyzed
  scope: {
    batchIds?: string[];
    jurisdictions?: JurisdictionKey[];
    dateRange?: { from: Date; to: Date };
  };

  // Findings
  findings: IngestionBotFinding[];

  // Actions taken
  actionsTaken: Array<{
    action: string;
    target: string;
    result: "SUCCESS" | "FAILED" | "SKIPPED";
    details: string;
  }>;

  // Generated artifacts
  generatedSuggestions: ParserSuggestion[];
  generatedTrainingModules: string[]; // IDs of DynamicTrainingModule created
  generatedAlerts: string[]; // IDs of WatchAlert created

  // Summary
  summary: {
    totalFindings: number;
    criticalFindings: number;
    actionableItems: number;
    estimatedValueAtRiskCents: number;
  };
}

export interface IngestionBotFinding {
  type: IngestionFindingType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  affectedRecords: number;
  estimatedImpactCents: number;
  recommendedAction: string;
  metadata: Record<string, unknown>;
}

export type IngestionFindingType =
  | "PARSER_FAILURE_SPIKE"
  | "NEW_FORMAT_DETECTED"
  | "JURISDICTION_SUCCESS_DROP"
  | "HIGH_VALUE_OPPORTUNITY"
  | "DUPLICATE_PATTERN"
  | "SOURCE_HEALTH_ISSUE"
  | "RULE_CHANGE_DETECTED"
  | "AUTO_FILE_OPPORTUNITY"
  | "DATA_QUALITY_ISSUE";

// =============================================================================
// INGESTION INTELLIGENCE SERVICE METHODS
// =============================================================================

export interface IIngestionIntelligenceService {
  // Configuration
  getConfig(): Promise<IngestionIntelligenceConfig>;
  updateConfig(updates: Partial<IngestionIntelligenceConfig>): Promise<void>;

  // Parser suggestions
  analyzeFailedRecords(options?: { batchId?: string; limit?: number }): Promise<FailedRecordAnalysis>;
  generateParserSuggestion(clusterId: string): Promise<ParserSuggestion>;
  getParserSuggestions(status?: string): Promise<ParserSuggestion[]>;
  applyParserSuggestion(suggestionId: string): Promise<{ success: boolean; message: string }>;

  // Value prediction
  predictValue(input: ValuePredictionInput): Promise<PredictedValue>;
  predictBatchValues(recordIds: string[]): Promise<PredictedValue[]>;

  // Jurisdiction intelligence
  getJurisdictionMetrics(jurisdiction: JurisdictionKey): Promise<JurisdictionMetrics>;
  getAllJurisdictionMetrics(): Promise<JurisdictionMetrics[]>;
  refreshJurisdictionMetrics(jurisdiction?: JurisdictionKey): Promise<void>;

  // Auto-filing
  evaluateAutoFileCandidate(recordId: string): Promise<AutoFileCandidate>;
  getAutoFileCandidates(status?: string): Promise<AutoFileCandidate[]>;
  approveAutoFile(candidateId: string): Promise<AutoFileResult>;
  rejectAutoFile(candidateId: string, reason: string): Promise<void>;
  processAutoFileBatch(): Promise<AutoFileResult[]>;

  // Batch intelligence
  runIntelligentProcess(batchId: string): Promise<BatchIntelligenceResult>;

  // Duplicate detection
  findDuplicates(recordId: string): Promise<Array<{ recordId: string; similarity: number }>>;
  detectBatchDuplicates(batchId: string): Promise<Array<{ newId: string; existingId: string; similarity: number }>>;
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

export type {
  ParserSuggestion,
  PredictedValue,
  JurisdictionMetrics,
  AutoFileCandidate,
  BatchIntelligenceResult,
  FailedRecordAnalysis,
  IngestionBotAnalysis,
};
