/**
 * ConfigService.ts
 *
 * Cached configuration service for FounderConfig.
 * Wraps Prisma queries with Redis caching for performance.
 *
 * FEATURES:
 * - Cached FounderConfig reads (TTL: 1 hour)
 * - Automatic cache invalidation on writes
 * - Type-safe config slices with Zod validation
 * - Graceful fallback to defaults
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import { cacheService, CacheKeys, CacheTTL } from "./CacheService.js";
import { logger } from "../utils/logger.js";
import {
  TrainingConfig,
  SchedulerConfig,
  BackupConfig,
  OpsConfig,
  ComplianceConfig,
  NotificationConfig,
  SystemConfig,
  SecurityConfig,
  PerformanceConfig,
  DEFAULT_TRAINING_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_BACKUP_CONFIG,
  DEFAULT_OPS_CONFIG,
  DEFAULT_COMPLIANCE_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  safeParseConfig,
  TrainingConfigSchema,
  SchedulerConfigSchema,
  BackupConfigSchema,
  OpsConfigSchema,
  ComplianceConfigSchema,
  NotificationConfigSchema,
  SystemConfigSchema,
  SecurityConfigSchema,
  PerformanceConfigSchema,
} from "../zod/index.js";

const prisma = new PrismaClient();

// =============================================================================
// CONFIG KEYS (match FounderConfig.key in DB)
// =============================================================================

export const ConfigKeys = {
  TRAINING: "training",
  SCHEDULER: "scheduler",
  BACKUP: "backup",
  OPS: "ops",
  COMPLIANCE: "compliance",
  NOTIFICATION: "notification",
  SYSTEM: "system",
  SECURITY: "security",
  PERFORMANCE: "performance",
  INGESTION: "ingestion",
} as const;

export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];

// =============================================================================
// CONFIG SERVICE CLASS
// =============================================================================

class ConfigService {
  /**
   * Get raw config value from DB (with caching)
   */
  private async getRaw(key: string): Promise<unknown | null> {
    const cacheKey = `${CacheKeys.CONFIG}:${key}`;

    // Try cache first
    const cached = await cacheService.get<unknown>(cacheKey);
    if (cached !== null) {
      logger.debug("Config cache hit", { key });
      return cached;
    }

    // Fetch from DB
    const config = await prisma.founderConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return null;
    }

    // Cache the result
    await cacheService.set(cacheKey, config.value, CacheTTL.CONFIG);
    logger.debug("Config cache miss - cached", { key });

    return config.value;
  }

  /**
   * Set config value in DB (with cache invalidation)
   */
  private async setRaw(
    key: string,
    value: unknown,
    description?: string
  ): Promise<void> {
    await prisma.founderConfig.upsert({
      where: { key },
      create: { key, value: value as any, description },
      update: { value: value as any, description },
    });

    // Invalidate cache
    await cacheService.del(`${CacheKeys.CONFIG}:${key}`);
    logger.info("Config updated", { key });
  }

  // =========================================================================
  // TYPED CONFIG GETTERS
  // =========================================================================

  async getTrainingConfig(): Promise<TrainingConfig> {
    const raw = await this.getRaw(ConfigKeys.TRAINING);
    return safeParseConfig(TrainingConfigSchema, raw) ?? DEFAULT_TRAINING_CONFIG;
  }

  async getSchedulerConfig(): Promise<SchedulerConfig> {
    const raw = await this.getRaw(ConfigKeys.SCHEDULER);
    return safeParseConfig(SchedulerConfigSchema, raw) ?? DEFAULT_SCHEDULER_CONFIG;
  }

  async getBackupConfig(): Promise<BackupConfig> {
    const raw = await this.getRaw(ConfigKeys.BACKUP);
    return safeParseConfig(BackupConfigSchema, raw) ?? DEFAULT_BACKUP_CONFIG;
  }

  async getOpsConfig(): Promise<OpsConfig> {
    const raw = await this.getRaw(ConfigKeys.OPS);
    return safeParseConfig(OpsConfigSchema, raw) ?? DEFAULT_OPS_CONFIG;
  }

  async getComplianceConfig(): Promise<ComplianceConfig> {
    const raw = await this.getRaw(ConfigKeys.COMPLIANCE);
    return safeParseConfig(ComplianceConfigSchema, raw) ?? DEFAULT_COMPLIANCE_CONFIG;
  }

  async getNotificationConfig(): Promise<NotificationConfig> {
    const raw = await this.getRaw(ConfigKeys.NOTIFICATION);
    return safeParseConfig(NotificationConfigSchema, raw) ?? DEFAULT_NOTIFICATION_CONFIG;
  }

  async getSystemConfig(): Promise<SystemConfig> {
    const raw = await this.getRaw(ConfigKeys.SYSTEM);
    return safeParseConfig(SystemConfigSchema, raw) ?? DEFAULT_SYSTEM_CONFIG;
  }

  async getSecurityConfig(): Promise<SecurityConfig> {
    const raw = await this.getRaw(ConfigKeys.SECURITY);
    return safeParseConfig(SecurityConfigSchema, raw) ?? DEFAULT_SECURITY_CONFIG;
  }

  async getPerformanceConfig(): Promise<PerformanceConfig> {
    const raw = await this.getRaw(ConfigKeys.PERFORMANCE);
    return safeParseConfig(PerformanceConfigSchema, raw) ?? DEFAULT_PERFORMANCE_CONFIG;
  }

  // =========================================================================
  // TYPED CONFIG SETTERS
  // =========================================================================

  async setTrainingConfig(config: Partial<TrainingConfig>): Promise<void> {
    const current = await this.getTrainingConfig();
    const merged = { ...current, ...config };
    TrainingConfigSchema.parse(merged); // Validate
    await this.setRaw(ConfigKeys.TRAINING, merged, "Training configuration");
  }

  async setSchedulerConfig(config: Partial<SchedulerConfig>): Promise<void> {
    const current = await this.getSchedulerConfig();
    const merged = { ...current, ...config };
    SchedulerConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.SCHEDULER, merged, "Scheduler configuration");
  }

  async setBackupConfig(config: Partial<BackupConfig>): Promise<void> {
    const current = await this.getBackupConfig();
    const merged = { ...current, ...config };
    BackupConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.BACKUP, merged, "Backup configuration");
  }

  async setOpsConfig(config: Partial<OpsConfig>): Promise<void> {
    const current = await this.getOpsConfig();
    const merged = { ...current, ...config };
    OpsConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.OPS, merged, "Ops configuration");
  }

  async setComplianceConfig(config: Partial<ComplianceConfig>): Promise<void> {
    const current = await this.getComplianceConfig();
    const merged = { ...current, ...config };
    ComplianceConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.COMPLIANCE, merged, "Compliance configuration");
  }

  async setNotificationConfig(config: Partial<NotificationConfig>): Promise<void> {
    const current = await this.getNotificationConfig();
    const merged = { ...current, ...config };
    NotificationConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.NOTIFICATION, merged, "Notification configuration");
  }

  async setSystemConfig(config: Partial<SystemConfig>): Promise<void> {
    const current = await this.getSystemConfig();
    const merged = { ...current, ...config };
    SystemConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.SYSTEM, merged, "System configuration");
  }

  async setSecurityConfig(config: Partial<SecurityConfig>): Promise<void> {
    const current = await this.getSecurityConfig();
    const merged = { ...current, ...config };
    SecurityConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.SECURITY, merged, "Security configuration");
  }

  async setPerformanceConfig(config: Partial<PerformanceConfig>): Promise<void> {
    const current = await this.getPerformanceConfig();
    const merged = { ...current, ...config };
    PerformanceConfigSchema.parse(merged);
    await this.setRaw(ConfigKeys.PERFORMANCE, merged, "Performance configuration");
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get all configs at once (for admin dashboard)
   */
  async getAllConfigs(): Promise<{
    training: TrainingConfig;
    scheduler: SchedulerConfig;
    backup: BackupConfig;
    ops: OpsConfig;
    compliance: ComplianceConfig;
    notification: NotificationConfig;
    system: SystemConfig;
    security: SecurityConfig;
    performance: PerformanceConfig;
  }> {
    const [
      training,
      scheduler,
      backup,
      ops,
      compliance,
      notification,
      system,
      security,
      performance,
    ] = await Promise.all([
      this.getTrainingConfig(),
      this.getSchedulerConfig(),
      this.getBackupConfig(),
      this.getOpsConfig(),
      this.getComplianceConfig(),
      this.getNotificationConfig(),
      this.getSystemConfig(),
      this.getSecurityConfig(),
      this.getPerformanceConfig(),
    ]);

    return {
      training,
      scheduler,
      backup,
      ops,
      compliance,
      notification,
      system,
      security,
      performance,
    };
  }

  /**
   * Invalidate all config caches (call after bulk updates)
   */
  async invalidateAllCaches(): Promise<void> {
    await cacheService.flush(`${CacheKeys.CONFIG}:*`);
    logger.info("All config caches invalidated");
  }

  /**
   * Check if system is in maintenance mode
   */
  async isMaintenanceMode(): Promise<boolean> {
    const system = await this.getSystemConfig();
    return system.maintenanceMode;
  }

  /**
   * Check if air-gap mode is enabled
   */
  async isAirGapMode(): Promise<boolean> {
    const security = await this.getSecurityConfig();
    return security.airGapMode;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const configService = new ConfigService();
export default configService;
