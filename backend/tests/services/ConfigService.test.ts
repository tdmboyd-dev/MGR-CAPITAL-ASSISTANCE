/**
 * ConfigService Unit Tests
 *
 * Tests for cached configuration, Zod validation, and invalidation.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Mock CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  flush: jest.fn(),
  getStats: jest.fn(),
};

jest.unstable_mockModule("./CacheService.js", () => ({
  cacheService: mockCacheService,
  CacheKeys: {
    CONFIG: "config",
    CONFIG_TRAINING: "config:training",
    METRICS: "metrics",
  },
  CacheTTL: {
    CONFIG: 3600,
    METRICS: 1800,
  },
}));

// Mock Prisma
const mockPrismaFounderConfig = {
  findUnique: jest.fn(),
  upsert: jest.fn(),
};

jest.unstable_mockModule("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    founderConfig: mockPrismaFounderConfig,
  })),
}));

// Mock logger
jest.unstable_mockModule("../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
const { configService, ConfigKeys } = await import(
  "../../src/services/ConfigService.js"
);

describe("ConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(true);
    mockCacheService.del.mockResolvedValue(true);
    mockCacheService.flush.mockResolvedValue(0);
    mockCacheService.getStats.mockReturnValue({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // CONFIG KEYS TESTS
  // ===========================================================================

  describe("ConfigKeys", () => {
    it("should export all expected config keys", () => {
      expect(ConfigKeys.TRAINING).toBe("training");
      expect(ConfigKeys.SCHEDULER).toBe("scheduler");
      expect(ConfigKeys.BACKUP).toBe("backup");
      expect(ConfigKeys.OPS).toBe("ops");
      expect(ConfigKeys.COMPLIANCE).toBe("compliance");
      expect(ConfigKeys.NOTIFICATION).toBe("notification");
      expect(ConfigKeys.SYSTEM).toBe("system");
      expect(ConfigKeys.SECURITY).toBe("security");
      expect(ConfigKeys.PERFORMANCE).toBe("performance");
    });
  });

  // ===========================================================================
  // TRAINING CONFIG TESTS
  // ===========================================================================

  describe("getTrainingConfig", () => {
    it("should return cached config on cache hit", async () => {
      const cachedConfig = {
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
        quizTimeoutMinutes: 30,
        enableAdaptiveLearning: true,
      };
      mockCacheService.get.mockResolvedValue(cachedConfig);

      const result = await configService.getTrainingConfig();

      expect(result).toEqual(cachedConfig);
      expect(mockPrismaFounderConfig.findUnique).not.toHaveBeenCalled();
    });

    it("should fetch from DB and cache on cache miss", async () => {
      const dbConfig = {
        weeklyQuotaPerEmployee: 10,
        minAccuracyPercent: 90,
        maxRetakesPerDay: 5,
        quizTimeoutMinutes: 45,
        enableAdaptiveLearning: false,
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "training",
        value: dbConfig,
      });

      const result = await configService.getTrainingConfig();

      expect(result).toEqual(dbConfig);
      expect(mockPrismaFounderConfig.findUnique).toHaveBeenCalledWith({
        where: { key: "training" },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "config:training",
        dbConfig,
        3600
      );
    });

    it("should return default config when not found in DB", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaFounderConfig.findUnique.mockResolvedValue(null);

      const result = await configService.getTrainingConfig();

      // Should return defaults from Zod schema
      expect(result.weeklyQuotaPerEmployee).toBeDefined();
      expect(result.minAccuracyPercent).toBeDefined();
    });

    it("should return default config when DB value is invalid", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "training",
        value: { invalidKey: "invalid" }, // Invalid shape
      });

      const result = await configService.getTrainingConfig();

      // Should return defaults
      expect(result.weeklyQuotaPerEmployee).toBeDefined();
    });
  });

  describe("setTrainingConfig", () => {
    it("should merge with existing config and save", async () => {
      const existingConfig = {
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
        quizTimeoutMinutes: 30,
        enableAdaptiveLearning: true,
      };
      mockCacheService.get.mockResolvedValue(existingConfig);
      mockPrismaFounderConfig.upsert.mockResolvedValue({});

      await configService.setTrainingConfig({ weeklyQuotaPerEmployee: 10 });

      expect(mockPrismaFounderConfig.upsert).toHaveBeenCalledWith({
        where: { key: "training" },
        create: {
          key: "training",
          value: { ...existingConfig, weeklyQuotaPerEmployee: 10 },
          description: "Training configuration",
        },
        update: {
          value: { ...existingConfig, weeklyQuotaPerEmployee: 10 },
          description: "Training configuration",
        },
      });
    });

    it("should invalidate cache after setting", async () => {
      mockCacheService.get.mockResolvedValue({
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
        quizTimeoutMinutes: 30,
        enableAdaptiveLearning: true,
      });
      mockPrismaFounderConfig.upsert.mockResolvedValue({});

      await configService.setTrainingConfig({ weeklyQuotaPerEmployee: 10 });

      expect(mockCacheService.del).toHaveBeenCalledWith("config:training");
    });

    it("should throw on invalid config", async () => {
      mockCacheService.get.mockResolvedValue({
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
        quizTimeoutMinutes: 30,
        enableAdaptiveLearning: true,
      });

      await expect(
        configService.setTrainingConfig({ weeklyQuotaPerEmployee: -1 })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SCHEDULER CONFIG TESTS
  // ===========================================================================

  describe("getSchedulerConfig", () => {
    it("should return scheduler config", async () => {
      const config = {
        enableOpsMetricsCron: true,
        opsMetricsIntervalMinutes: 60,
        enableBackupCron: true,
        backupHour: 3,
        enableCleanupCron: true,
        cleanupRetentionDays: 90,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "scheduler",
        value: config,
      });

      const result = await configService.getSchedulerConfig();

      expect(result.enableOpsMetricsCron).toBe(true);
      expect(result.opsMetricsIntervalMinutes).toBe(60);
    });
  });

  // ===========================================================================
  // SYSTEM CONFIG TESTS
  // ===========================================================================

  describe("getSystemConfig", () => {
    it("should return system config", async () => {
      const config = {
        maintenanceMode: false,
        debugMode: false,
        logLevel: "info",
        maxUploadSizeMb: 10,
        sessionTimeoutMinutes: 60,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "system",
        value: config,
      });

      const result = await configService.getSystemConfig();

      expect(result.maintenanceMode).toBe(false);
      expect(result.logLevel).toBe("info");
    });
  });

  describe("isMaintenanceMode", () => {
    it("should return true when maintenance mode is enabled", async () => {
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "system",
        value: {
          maintenanceMode: true,
          debugMode: false,
          logLevel: "info",
          maxUploadSizeMb: 10,
          sessionTimeoutMinutes: 60,
        },
      });

      const result = await configService.isMaintenanceMode();

      expect(result).toBe(true);
    });

    it("should return false when maintenance mode is disabled", async () => {
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "system",
        value: {
          maintenanceMode: false,
          debugMode: false,
          logLevel: "info",
          maxUploadSizeMb: 10,
          sessionTimeoutMinutes: 60,
        },
      });

      const result = await configService.isMaintenanceMode();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // SECURITY CONFIG TESTS
  // ===========================================================================

  describe("getSecurityConfig", () => {
    it("should return security config", async () => {
      const config = {
        airGapMode: true,
        maxLoginAttempts: 5,
        lockoutMinutes: 15,
        requireMfa: false,
        passwordMinLength: 12,
        passwordRequireSpecial: true,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "security",
        value: config,
      });

      const result = await configService.getSecurityConfig();

      expect(result.airGapMode).toBe(true);
      expect(result.maxLoginAttempts).toBe(5);
    });
  });

  describe("isAirGapMode", () => {
    it("should return true when air-gap mode is enabled", async () => {
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "security",
        value: {
          airGapMode: true,
          maxLoginAttempts: 5,
          lockoutMinutes: 15,
          requireMfa: false,
          passwordMinLength: 12,
          passwordRequireSpecial: true,
        },
      });

      const result = await configService.isAirGapMode();

      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // PERFORMANCE CONFIG TESTS
  // ===========================================================================

  describe("getPerformanceConfig", () => {
    it("should return performance config", async () => {
      const config = {
        redisEnabled: true,
        redisUrl: "redis://localhost:6379",
        cacheTtlConfig: 3600,
        batchSizeLimit: 1000,
        queryTimeoutMs: 30000,
        maxQueryResults: 1000,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "performance",
        value: config,
      });

      const result = await configService.getPerformanceConfig();

      expect(result.redisEnabled).toBe(true);
      expect(result.batchSizeLimit).toBe(1000);
    });
  });

  describe("setPerformanceConfig", () => {
    it("should update performance config", async () => {
      mockCacheService.get.mockResolvedValue({
        redisEnabled: false,
        redisUrl: "redis://localhost:6379",
        cacheTtlConfig: 3600,
        batchSizeLimit: 1000,
        queryTimeoutMs: 30000,
        maxQueryResults: 1000,
      });
      mockPrismaFounderConfig.upsert.mockResolvedValue({});

      await configService.setPerformanceConfig({ redisEnabled: true });

      expect(mockPrismaFounderConfig.upsert).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith("config:performance");
    });
  });

  // ===========================================================================
  // GET ALL CONFIGS TESTS
  // ===========================================================================

  describe("getAllConfigs", () => {
    it("should return all configs in parallel", async () => {
      // Each config returns from cache
      mockCacheService.get.mockImplementation((key) => {
        if (key === "config:training")
          return Promise.resolve({
            weeklyQuotaPerEmployee: 5,
            minAccuracyPercent: 85,
            maxRetakesPerDay: 3,
            quizTimeoutMinutes: 30,
            enableAdaptiveLearning: true,
          });
        if (key === "config:scheduler")
          return Promise.resolve({
            enableOpsMetricsCron: true,
            opsMetricsIntervalMinutes: 60,
            enableBackupCron: true,
            backupHour: 3,
            enableCleanupCron: true,
            cleanupRetentionDays: 90,
          });
        return Promise.resolve(null);
      });

      // For configs not in cache, return from DB
      mockPrismaFounderConfig.findUnique.mockResolvedValue(null);

      const result = await configService.getAllConfigs();

      expect(result).toHaveProperty("training");
      expect(result).toHaveProperty("scheduler");
      expect(result).toHaveProperty("backup");
      expect(result).toHaveProperty("ops");
      expect(result).toHaveProperty("compliance");
      expect(result).toHaveProperty("notification");
      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("security");
      expect(result).toHaveProperty("performance");
    });
  });

  // ===========================================================================
  // CACHE INVALIDATION TESTS
  // ===========================================================================

  describe("invalidateAllCaches", () => {
    it("should flush all config caches", async () => {
      mockCacheService.flush.mockResolvedValue(9);

      await configService.invalidateAllCaches();

      expect(mockCacheService.flush).toHaveBeenCalledWith("config:*");
    });
  });

  // ===========================================================================
  // CACHE STATS TESTS
  // ===========================================================================

  describe("getCacheStats", () => {
    it("should return cache statistics", () => {
      const mockStats = {
        hits: 100,
        misses: 20,
        sets: 25,
        deletes: 5,
        errors: 0,
      };
      mockCacheService.getStats.mockReturnValue(mockStats);

      const result = configService.getCacheStats();

      expect(result).toEqual(mockStats);
    });
  });

  // ===========================================================================
  // OTHER CONFIG TYPES TESTS
  // ===========================================================================

  describe("getBackupConfig", () => {
    it("should return backup config", async () => {
      const config = {
        enabled: true,
        retentionDays: 30,
        compressionEnabled: true,
        encryptionEnabled: true,
        maxBackupSizeMb: 500,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "backup",
        value: config,
      });

      const result = await configService.getBackupConfig();

      expect(result.enabled).toBe(true);
      expect(result.retentionDays).toBe(30);
    });
  });

  describe("getOpsConfig", () => {
    it("should return ops config", async () => {
      const config = {
        alertThresholdPercent: 80,
        criticalThresholdPercent: 95,
        enableSlackAlerts: false,
        enableEmailAlerts: true,
        dailyDigestHour: 8,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "ops",
        value: config,
      });

      const result = await configService.getOpsConfig();

      expect(result.alertThresholdPercent).toBe(80);
    });
  });

  describe("getComplianceConfig", () => {
    it("should return compliance config", async () => {
      const config = {
        requireDocumentation: true,
        auditRetentionYears: 7,
        enableAutoAudit: true,
        complianceCheckIntervalDays: 30,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "compliance",
        value: config,
      });

      const result = await configService.getComplianceConfig();

      expect(result.requireDocumentation).toBe(true);
    });
  });

  describe("getNotificationConfig", () => {
    it("should return notification config", async () => {
      const config = {
        enableEmail: true,
        enableSms: false,
        enablePush: true,
        digestFrequency: "daily",
        quietHoursStart: 22,
        quietHoursEnd: 7,
      };
      mockPrismaFounderConfig.findUnique.mockResolvedValue({
        key: "notification",
        value: config,
      });

      const result = await configService.getNotificationConfig();

      expect(result.enableEmail).toBe(true);
      expect(result.digestFrequency).toBe("daily");
    });
  });
});
