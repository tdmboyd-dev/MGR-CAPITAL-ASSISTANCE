/**
 * Zod Validation Schemas Index
 *
 * Central export for all Zod validation schemas used in MGR Capital Assistance.
 *
 * Usage:
 *   import { validateParserConfig, IngestionConfigSchema } from '../zod';
 */

// Ingestion schemas
export {
  // Schemas
  ParserConfigSchema,
  ColumnMappingSchema,
  TransformationRuleSchema,
  DateFormatSchema,
  IngestionConfigSchema,
  NormalizedIngestionDataSchema,
  PredictionResultSchema,
  BatchUploadRequestSchema,
  IntelligentProcessOptionsSchema,
  // Types
  type ParserConfig,
  type ColumnMapping,
  type TransformationRule,
  type IngestionConfig,
  type NormalizedIngestionData,
  type PredictionResult,
  type BatchUploadRequest,
  type IntelligentProcessOptions,
  // Helpers
  validateParserConfig,
  validateIngestionConfig,
  safeParseIngestionConfig,
  validateNormalizedData,
  // Defaults
  DEFAULT_INGESTION_CONFIG,
} from "./ingestion.js";

// Config schemas
export {
  // Schemas
  TrainingConfigSchema,
  SchedulerConfigSchema,
  BackupConfigSchema,
  OpsConfigSchema,
  ComplianceConfigSchema,
  NotificationConfigSchema,
  SystemConfigSchema,
  JwtConfigSchema,
  SecurityConfigSchema,
  PerformanceConfigSchema,
  NotaryCredentialsSchema,
  DigitalSealConfigSchema,
  FounderConfigValueSchema,
  // Types
  type TrainingConfig,
  type SchedulerConfig,
  type BackupConfig,
  type OpsConfig,
  type ComplianceConfig,
  type NotificationConfig,
  type SystemConfig,
  type JwtConfig,
  type SecurityConfig,
  type PerformanceConfig,
  type NotaryCredentials,
  type DigitalSealConfig,
  type FounderConfigValue,
  // Helpers
  validateTrainingConfig,
  validateSchedulerConfig,
  validateBackupConfig,
  validateOpsConfig,
  validateComplianceConfig,
  validateSecurityConfig,
  validateJwtConfig,
  validatePerformanceConfig,
  validateNotaryCredentials,
  validateDigitalSealConfig,
  safeParseConfig,
  // Defaults
  DEFAULT_TRAINING_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_BACKUP_CONFIG,
  DEFAULT_OPS_CONFIG,
  DEFAULT_COMPLIANCE_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_JWT_CONFIG,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_NOTARY_CREDENTIALS,
  DEFAULT_DIGITAL_SEAL_CONFIG,
} from "./config.js";
