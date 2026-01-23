/**
 * config.ts (Zod Schemas)
 *
 * Validation schemas for FounderConfig and system configuration.
 * Ensures type safety and validation for all configurable settings.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { z } from "zod";

// =============================================================================
// TRAINING CONFIG SCHEMAS
// =============================================================================

export const TrainingConfigSchema = z.object({
  // Module generation
  autoGenerateModulesFromInsights: z.boolean().default(true),
  insightTypesForModules: z
    .array(z.string())
    .default(["COMPLIANCE_CHECK", "CASE_RECOMMENDATION", "EMPLOYEE_COACHING"]),
  moduleExpirationDays: z.number().int().min(1).default(90),

  // Tier progression
  autoTierProgression: z.boolean().default(false),
  tierProgressionReviewRequired: z.boolean().default(true),
  minDaysBetweenPromotions: z.number().int().min(1).default(30),

  // Coaching triggers
  lowConversionThreshold: z.number().min(0).max(100).default(25),
  coachingTriggerDays: z.number().int().min(1).default(14),

  // Training deadlines
  mandatoryTrainingDeadlineDays: z.number().int().min(1).default(7),
  sendTrainingReminders: z.boolean().default(true),
  reminderFrequencyDays: z.number().int().min(1).default(2),

  // HR notifications
  notifyHROnOverdue: z.boolean().default(true),
  notifyHROverdueDays: z.number().int().min(1).default(3),

  // Quiz settings
  quizPassingScore: z.number().min(0).max(100).default(80),
  maxQuizAttempts: z.number().int().min(1).default(3),
});

export type TrainingConfig = z.infer<typeof TrainingConfigSchema>;

// =============================================================================
// SCHEDULER CONFIG SCHEMAS
// =============================================================================

export const SchedulerJobConfigSchema = z.object({
  enabled: z.boolean(),
  cronExpression: z.string().optional(),
});

export const SchedulerConfigSchema = z.object({
  timezone: z.string().default("America/Chicago"),
  jobs: z.record(SchedulerJobConfigSchema).default({}),
});

export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;

// =============================================================================
// BACKUP CONFIG SCHEMAS
// =============================================================================

export const BackupConfigSchema = z.object({
  // Directories
  backupDir: z.string().default("./backups"),
  vaultDir: z.string().default("./vault"),

  // Retention
  hourlyRetentionCount: z.number().int().min(1).default(24),
  dailyRetentionDays: z.number().int().min(1).default(7),
  weeklyRetentionWeeks: z.number().int().min(1).default(4),
  monthlyRetentionMonths: z.number().int().min(1).default(12),

  // Encryption
  encryptionEnabled: z.boolean().default(true),

  // Offsite
  offsiteEnabled: z.boolean().default(false),
  offsitePath: z.string().optional(),

  // Database tools
  pgDumpPath: z.string().default("pg_dump"),
  pgRestorePath: z.string().default("pg_restore"),
});

export type BackupConfig = z.infer<typeof BackupConfigSchema>;

// =============================================================================
// OPS CONFIG SCHEMAS
// =============================================================================

export const OpsConfigSchema = z.object({
  // Jurisdiction thresholds
  jurisdictionVolatilityThreshold: z.number().min(0).max(100).default(50),
  jurisdictionMinCasesForMetrics: z.number().int().min(1).default(10),

  // Employee thresholds
  employeeIntegrityThreshold: z.number().min(0).max(100).default(70),
  employeePerformanceWarningThreshold: z.number().min(0).max(100).default(40),

  // Case thresholds
  caseHeatScoreThreshold: z.number().min(0).max(100).default(75),
  staleCaseDays: z.number().int().min(1).default(30),

  // Focus items
  maxFocusItems: z.number().int().min(1).max(100).default(20),
  focusItemExpirationDays: z.number().int().min(1).default(7),
});

export type OpsConfig = z.infer<typeof OpsConfigSchema>;

// =============================================================================
// COMPLIANCE CONFIG SCHEMAS
// =============================================================================

export const ComplianceConfigSchema = z.object({
  // Deadline warnings
  deadlineWarningDays: z.number().int().min(1).default(7),
  urgentDeadlineWarningDays: z.number().int().min(1).default(3),

  // Stale status thresholds (days)
  staleStatusDays: z.record(z.number().int().min(1)).default({
    NEW: 14,
    CONTACTED: 21,
    DOCS_PENDING: 30,
    DOCS_SIGNED: 14,
    FILED: 60,
    AWAITING_FUNDS: 90,
  }),

  // Document requirements
  requireDocumentsForFiling: z.boolean().default(true),
  requiredDocumentTypes: z
    .array(z.string())
    .default(["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA"]),

  // Audit settings
  auditRetentionDays: z.number().int().min(30).default(365),
  enableComplianceAlerts: z.boolean().default(true),
});

export type ComplianceConfig = z.infer<typeof ComplianceConfigSchema>;

// =============================================================================
// NOTIFICATION CONFIG SCHEMAS
// =============================================================================

export const NotificationConfigSchema = z.object({
  // Channel enables
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  inAppEnabled: z.boolean().default(true),

  // Batch settings
  batchSize: z.number().int().min(1).default(50),
  batchDelayMs: z.number().int().min(0).default(1000),

  // Rate limits
  maxEmailsPerHour: z.number().int().min(1).default(100),
  maxSmsPerHour: z.number().int().min(1).default(50),

  // Templates
  useHtmlEmails: z.boolean().default(true),
});

export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;

// =============================================================================
// SYSTEM CONFIG SCHEMAS
// =============================================================================

export const SystemConfigSchema = z.object({
  // Maintenance
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().optional(),

  // Session
  sessionTimeoutMinutes: z.number().int().min(5).default(60),
  maxConcurrentSessions: z.number().int().min(1).default(5),

  // Logging
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  logRetentionDays: z.number().int().min(1).default(30),

  // Performance
  enableCaching: z.boolean().default(true),
  cacheTimeoutSeconds: z.number().int().min(1).default(300),

  // Features flags
  features: z.record(z.boolean()).default({}),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

// =============================================================================
// COMBINED FOUNDER CONFIG SCHEMA
// =============================================================================

export const FounderConfigValueSchema = z.union([
  TrainingConfigSchema,
  SchedulerConfigSchema,
  BackupConfigSchema,
  OpsConfigSchema,
  ComplianceConfigSchema,
  NotificationConfigSchema,
  SystemConfigSchema,
  z.record(z.unknown()), // Allow arbitrary config for extensibility
]);

export type FounderConfigValue = z.infer<typeof FounderConfigValueSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate training config
 */
export function validateTrainingConfig(config: unknown): TrainingConfig {
  return TrainingConfigSchema.parse(config);
}

/**
 * Validate scheduler config
 */
export function validateSchedulerConfig(config: unknown): SchedulerConfig {
  return SchedulerConfigSchema.parse(config);
}

/**
 * Validate backup config
 */
export function validateBackupConfig(config: unknown): BackupConfig {
  return BackupConfigSchema.parse(config);
}

/**
 * Validate ops config
 */
export function validateOpsConfig(config: unknown): OpsConfig {
  return OpsConfigSchema.parse(config);
}

/**
 * Validate compliance config
 */
export function validateComplianceConfig(config: unknown): ComplianceConfig {
  return ComplianceConfigSchema.parse(config);
}

/**
 * Safe parse with defaults
 */
export function safeParseConfig<T extends z.ZodSchema>(
  schema: T,
  config: unknown
): z.infer<T> | null {
  const result = schema.safeParse(config);
  return result.success ? result.data : null;
}

// =============================================================================
// DEFAULT CONFIGS
// =============================================================================

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = TrainingConfigSchema.parse({});
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = SchedulerConfigSchema.parse({});
export const DEFAULT_BACKUP_CONFIG: BackupConfig = BackupConfigSchema.parse({});
export const DEFAULT_OPS_CONFIG: OpsConfig = OpsConfigSchema.parse({});
export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = ComplianceConfigSchema.parse({});
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = NotificationConfigSchema.parse({});
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = SystemConfigSchema.parse({});

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  TrainingConfigSchema,
  SchedulerConfigSchema,
  BackupConfigSchema,
  OpsConfigSchema,
  ComplianceConfigSchema,
  NotificationConfigSchema,
  SystemConfigSchema,
  validateTrainingConfig,
  validateSchedulerConfig,
  validateBackupConfig,
  validateOpsConfig,
  validateComplianceConfig,
  safeParseConfig,
  DEFAULT_TRAINING_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_BACKUP_CONFIG,
  DEFAULT_OPS_CONFIG,
  DEFAULT_COMPLIANCE_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
};
