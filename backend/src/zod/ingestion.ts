/**
 * ingestion.ts (Zod Schemas)
 *
 * Validation schemas for ingestion-related data structures.
 * Used to validate ParserConfig, FounderConfig ingestion slice, and more.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { z } from "zod";

// =============================================================================
// PARSER CONFIG SCHEMAS
// =============================================================================

/**
 * Column mapping in parser config
 */
export const ColumnMappingSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  sourceColumn: z.string().optional(),
  sourceIndex: z.number().int().min(0).optional(),
  regex: z.string().optional(),
  transform: z.enum(["uppercase", "lowercase", "trim", "number", "date", "boolean"]).optional(),
  required: z.boolean().optional().default(false),
  defaultValue: z.unknown().optional(),
});

/**
 * Data transformation rule
 */
export const TransformationRuleSchema = z.object({
  field: z.string().min(1),
  operation: z.enum([
    "replace",
    "extract",
    "concatenate",
    "split",
    "format",
    "calculate",
    "lookup",
  ]),
  params: z.record(z.unknown()).optional(),
});

/**
 * Date format configuration
 */
export const DateFormatSchema = z.object({
  input: z.string().min(1),
  output: z.string().default("YYYY-MM-DD"),
  strict: z.boolean().default(false),
});

/**
 * Parser configuration schema
 * Stored in ParserVersion.parserConfig
 */
export const ParserConfigSchema = z.object({
  // Header configuration
  headerRow: z.number().int().min(0).default(0),
  dataStartRow: z.number().int().min(0).default(1),
  skipEmptyRows: z.boolean().default(true),

  // Column mappings
  columns: z.array(ColumnMappingSchema).min(1, "At least one column mapping required"),

  // Date handling
  dateFormat: DateFormatSchema.optional(),
  dateColumns: z.array(z.string()).optional(),

  // Amount handling (all amounts in cents)
  amountColumns: z.array(z.string()).optional(),
  amountMultiplier: z.number().default(100), // Convert dollars to cents

  // Validation rules
  requiredFields: z.array(z.string()).optional(),
  uniqueFields: z.array(z.string()).optional(),

  // Transformations
  transformations: z.array(TransformationRuleSchema).optional(),

  // Source-specific options
  delimiter: z.string().optional(), // For CSV
  encoding: z.string().default("utf-8"),
  trimWhitespace: z.boolean().default(true),

  // Metadata
  version: z.string().optional(),
  notes: z.string().optional(),
});

export type ParserConfig = z.infer<typeof ParserConfigSchema>;
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;
export type TransformationRule = z.infer<typeof TransformationRuleSchema>;

// =============================================================================
// INGESTION CONFIG SCHEMAS (FounderConfig slice)
// =============================================================================

/**
 * Ingestion intelligence configuration
 * Stored in FounderConfig with key "ingestion"
 */
export const IngestionConfigSchema = z.object({
  // Auto-file settings
  autoFileEnabled: z.boolean().default(false),
  autoFileHighValueThreshold: z.number().int().min(0).default(1000000), // $10,000 in cents
  autoFileMinSuccessRate: z.number().min(0).max(100).default(70),
  autoFileRequiresApproval: z.boolean().default(true),

  // Duplicate detection
  duplicateCheckEnabled: z.boolean().default(true),
  duplicateSimilarityThreshold: z.number().min(0).max(100).default(85),
  duplicateCheckFields: z
    .array(z.string())
    .default(["ownerName", "propertyAddress", "parcelId"]),

  // Parser settings
  parserRetryAttempts: z.number().int().min(1).max(10).default(3),
  parserTimeoutMs: z.number().int().min(1000).max(300000).default(60000),

  // Value prediction
  predictionEnabled: z.boolean().default(true),
  predictionMinConfidence: z.number().min(0).max(100).default(50),
  predictionFallbackValueCents: z.number().int().min(0).default(50000), // $500

  // Priority scoring weights (must sum to 1.0)
  priorityValueWeight: z.number().min(0).max(1).default(0.5),
  prioritySuccessRateWeight: z.number().min(0).max(1).default(0.3),
  priorityVolatilityPenalty: z.number().min(0).max(1).default(0.2),

  // Thresholds
  highValueThreshold: z.number().int().min(0).default(500000), // $5,000 in cents
  lowSuccessRateThreshold: z.number().min(0).max(100).default(40),
  highVolatilityThreshold: z.number().min(0).max(100).default(50),

  // Batch settings
  maxBatchSize: z.number().int().min(1).max(10000).default(1000),
  batchProcessingDelayMs: z.number().int().min(0).default(100),

  // Notifications
  notifyOnHighValueRecord: z.boolean().default(true),
  notifyOnBatchComplete: z.boolean().default(true),
  notifyOnParserSuggestion: z.boolean().default(true),
});

export type IngestionConfig = z.infer<typeof IngestionConfigSchema>;

/**
 * Default ingestion configuration
 */
export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  autoFileEnabled: false,
  autoFileHighValueThreshold: 1000000, // $10,000
  autoFileMinSuccessRate: 70,
  autoFileRequiresApproval: true,

  duplicateCheckEnabled: true,
  duplicateSimilarityThreshold: 85,
  duplicateCheckFields: ["ownerName", "propertyAddress", "parcelId"],

  parserRetryAttempts: 3,
  parserTimeoutMs: 60000,

  predictionEnabled: true,
  predictionMinConfidence: 50,
  predictionFallbackValueCents: 50000,

  priorityValueWeight: 0.5,
  prioritySuccessRateWeight: 0.3,
  priorityVolatilityPenalty: 0.2,

  highValueThreshold: 500000,
  lowSuccessRateThreshold: 40,
  highVolatilityThreshold: 50,

  maxBatchSize: 1000,
  batchProcessingDelayMs: 100,

  notifyOnHighValueRecord: true,
  notifyOnBatchComplete: true,
  notifyOnParserSuggestion: true,
};

// =============================================================================
// INGESTION RECORD SCHEMAS
// =============================================================================

/**
 * Raw ingestion data (before parsing)
 */
export const RawIngestionDataSchema = z.record(z.unknown());

/**
 * Normalized ingestion data (after parsing)
 */
export const NormalizedIngestionDataSchema = z.object({
  ownerName: z.string().optional(),
  ownerAddress: z.string().optional(),
  propertyAddress: z.string().optional(),
  parcelId: z.string().optional(),
  state: z.string().length(2).optional(),
  county: z.string().optional(),
  surplusAmountCents: z.number().int().optional(),
  saleDate: z.string().optional(),
  redemptionDeadline: z.string().optional(),
  propertyClass: z.string().optional(),
  additionalData: z.record(z.unknown()).optional(),
});

export type NormalizedIngestionData = z.infer<typeof NormalizedIngestionDataSchema>;

/**
 * Prediction result schema
 */
export const PredictionResultSchema = z.object({
  predictedValueCents: z.number().int().min(0),
  confidence: z.number().min(0).max(100),
  factors: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      weight: z.number(),
    })
  ),
  source: z.enum(["county_median", "state_median", "property_class", "fallback"]),
});

export type PredictionResult = z.infer<typeof PredictionResultSchema>;

// =============================================================================
// BATCH PROCESSING SCHEMAS
// =============================================================================

/**
 * Batch upload request
 */
export const BatchUploadRequestSchema = z.object({
  sourceId: z.number().int().positive(),
  filename: z.string().min(1),
  contentType: z.string().optional(),
  options: z
    .object({
      skipDuplicates: z.boolean().default(true),
      runPredictions: z.boolean().default(true),
      autoFileEligible: z.boolean().default(false),
    })
    .optional(),
});

export type BatchUploadRequest = z.infer<typeof BatchUploadRequestSchema>;

/**
 * Intelligent processing options
 */
export const IntelligentProcessOptionsSchema = z.object({
  runPredictions: z.boolean().default(true),
  detectDuplicates: z.boolean().default(true),
  evaluateAutoFile: z.boolean().default(false),
  generateInsights: z.boolean().default(true),
});

export type IntelligentProcessOptions = z.infer<typeof IntelligentProcessOptionsSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate parser config
 */
export function validateParserConfig(config: unknown): ParserConfig {
  return ParserConfigSchema.parse(config);
}

/**
 * Validate ingestion config
 */
export function validateIngestionConfig(config: unknown): IngestionConfig {
  return IngestionConfigSchema.parse(config);
}

/**
 * Safe parse with default fallback
 */
export function safeParseIngestionConfig(config: unknown): IngestionConfig {
  const result = IngestionConfigSchema.safeParse(config);
  return result.success ? result.data : DEFAULT_INGESTION_CONFIG;
}

/**
 * Validate normalized data
 */
export function validateNormalizedData(data: unknown): NormalizedIngestionData {
  return NormalizedIngestionDataSchema.parse(data);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  ParserConfigSchema,
  IngestionConfigSchema,
  NormalizedIngestionDataSchema,
  PredictionResultSchema,
  BatchUploadRequestSchema,
  IntelligentProcessOptionsSchema,
  validateParserConfig,
  validateIngestionConfig,
  safeParseIngestionConfig,
  validateNormalizedData,
  DEFAULT_INGESTION_CONFIG,
};
