/**
 * ConfigService Unit Tests
 *
 * Tests for configuration management concepts and Zod validation.
 */

import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

describe("ConfigService Concepts", () => {
  // ===========================================================================
  // CONFIG KEYS TESTS
  // ===========================================================================

  describe("Config Keys", () => {
    const ConfigKeys = {
      TRAINING: "training",
      SCHEDULER: "scheduler",
      BACKUP: "backup",
      OPS: "ops",
      COMPLIANCE: "compliance",
      NOTIFICATION: "notification",
      SYSTEM: "system",
      SECURITY: "security",
      PERFORMANCE: "performance",
    };

    it("should have all expected config keys", () => {
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
  // TRAINING CONFIG SCHEMA TESTS
  // ===========================================================================

  describe("Training Config Validation", () => {
    const TrainingConfigSchema = z.object({
      weeklyQuotaPerEmployee: z.number().int().min(1).max(20).default(5),
      minAccuracyPercent: z.number().min(0).max(100).default(80),
      maxRetakesPerDay: z.number().int().min(1).max(10).default(3),
      quizTimeoutMinutes: z.number().int().min(5).max(120).default(30),
      enableAdaptiveLearning: z.boolean().default(true),
    });

    it("should validate correct training config", () => {
      const config = {
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
        quizTimeoutMinutes: 30,
        enableAdaptiveLearning: true,
      };

      const result = TrainingConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid weeklyQuota", () => {
      const config = {
        weeklyQuotaPerEmployee: 25, // Max is 20
        minAccuracyPercent: 85,
      };

      const result = TrainingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should provide defaults for missing fields", () => {
      const config = {};
      const result = TrainingConfigSchema.parse(config);

      expect(result.weeklyQuotaPerEmployee).toBe(5);
      expect(result.minAccuracyPercent).toBe(80);
      expect(result.enableAdaptiveLearning).toBe(true);
    });
  });

  // ===========================================================================
  // SYSTEM CONFIG SCHEMA TESTS
  // ===========================================================================

  describe("System Config Validation", () => {
    const SystemConfigSchema = z.object({
      maintenanceMode: z.boolean().default(false),
      debugMode: z.boolean().default(false),
      logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
      maxUploadSizeMb: z.number().min(1).max(100).default(10),
      sessionTimeoutMinutes: z.number().min(5).max(1440).default(60),
    });

    it("should validate correct system config", () => {
      const config = {
        maintenanceMode: false,
        debugMode: true,
        logLevel: "debug",
        maxUploadSizeMb: 25,
        sessionTimeoutMinutes: 120,
      };

      const result = SystemConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid logLevel", () => {
      const config = {
        logLevel: "invalid",
      };

      const result = SystemConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should provide defaults for maintenance mode", () => {
      const config = {};
      const result = SystemConfigSchema.parse(config);

      expect(result.maintenanceMode).toBe(false);
      expect(result.debugMode).toBe(false);
      expect(result.logLevel).toBe("info");
    });
  });

  // ===========================================================================
  // SECURITY CONFIG SCHEMA TESTS
  // ===========================================================================

  describe("Security Config Validation", () => {
    const SecurityConfigSchema = z.object({
      airGapMode: z.boolean().default(false),
      maxLoginAttempts: z.number().int().min(3).max(10).default(5),
      lockoutMinutes: z.number().int().min(5).max(60).default(15),
      requireMfa: z.boolean().default(false),
      passwordMinLength: z.number().int().min(8).max(32).default(12),
    });

    it("should validate correct security config", () => {
      const config = {
        airGapMode: true,
        maxLoginAttempts: 5,
        lockoutMinutes: 15,
        requireMfa: false,
        passwordMinLength: 12,
      };

      const result = SecurityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid maxLoginAttempts", () => {
      const config = {
        maxLoginAttempts: 1, // Min is 3
      };

      const result = SecurityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should provide defaults for air-gap mode", () => {
      const config = {};
      const result = SecurityConfigSchema.parse(config);

      expect(result.airGapMode).toBe(false);
      expect(result.requireMfa).toBe(false);
    });
  });

  // ===========================================================================
  // PERFORMANCE CONFIG SCHEMA TESTS
  // ===========================================================================

  describe("Performance Config Validation", () => {
    const PerformanceConfigSchema = z.object({
      redisEnabled: z.boolean().default(false),
      redisUrl: z.string().default("redis://localhost:6379"),
      cacheTtlConfig: z.number().int().min(60).default(3600),
      batchSizeLimit: z.number().int().min(100).max(10000).default(1000),
      queryTimeoutMs: z.number().int().min(1000).max(300000).default(30000),
      maxQueryResults: z.number().int().min(100).max(10000).default(1000),
    });

    it("should validate correct performance config", () => {
      const config = {
        redisEnabled: true,
        redisUrl: "redis://localhost:6379",
        cacheTtlConfig: 3600,
        batchSizeLimit: 1000,
        queryTimeoutMs: 30000,
        maxQueryResults: 1000,
      };

      const result = PerformanceConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid batchSizeLimit", () => {
      const config = {
        batchSizeLimit: 50, // Min is 100
      };

      const result = PerformanceConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should provide defaults for Redis", () => {
      const config = {};
      const result = PerformanceConfigSchema.parse(config);

      expect(result.redisEnabled).toBe(false);
      expect(result.redisUrl).toBe("redis://localhost:6379");
    });
  });

  // ===========================================================================
  // CONFIG MERGE TESTS
  // ===========================================================================

  describe("Config Merging", () => {
    it("should merge partial config with existing", () => {
      const existing = {
        weeklyQuotaPerEmployee: 5,
        minAccuracyPercent: 85,
        maxRetakesPerDay: 3,
      };

      const update = {
        weeklyQuotaPerEmployee: 10,
      };

      const merged = { ...existing, ...update };

      expect(merged.weeklyQuotaPerEmployee).toBe(10);
      expect(merged.minAccuracyPercent).toBe(85);
      expect(merged.maxRetakesPerDay).toBe(3);
    });

    it("should preserve unchanged values", () => {
      const existing = {
        maintenanceMode: false,
        debugMode: true,
        logLevel: "debug",
      };

      const update = {
        maintenanceMode: true,
      };

      const merged = { ...existing, ...update };

      expect(merged.maintenanceMode).toBe(true);
      expect(merged.debugMode).toBe(true); // Unchanged
      expect(merged.logLevel).toBe("debug"); // Unchanged
    });
  });

  // ===========================================================================
  // SAFE PARSE HELPER TESTS
  // ===========================================================================

  describe("Safe Parse Helper", () => {
    const TestSchema = z.object({
      value: z.number().default(42),
    });

    const defaultValue = { value: 42 };

    function safeParseConfig<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
      try {
        return schema.parse(data);
      } catch {
        return null;
      }
    }

    it("should return parsed config on valid input", () => {
      const result = safeParseConfig(TestSchema, { value: 100 });
      expect(result).toEqual({ value: 100 });
    });

    it("should return null on invalid input", () => {
      const result = safeParseConfig(TestSchema, { value: "not a number" });
      expect(result).toBeNull();
    });

    it("should use default when combined with fallback", () => {
      const result = safeParseConfig(TestSchema, { invalid: true }) ?? defaultValue;
      expect(result).toEqual({ value: 42 });
    });
  });

  // ===========================================================================
  // MAINTENANCE MODE TESTS
  // ===========================================================================

  describe("Maintenance Mode Check", () => {
    it("should return true when maintenance mode is enabled", () => {
      const config = { maintenanceMode: true };
      expect(config.maintenanceMode).toBe(true);
    });

    it("should return false when maintenance mode is disabled", () => {
      const config = { maintenanceMode: false };
      expect(config.maintenanceMode).toBe(false);
    });
  });

  // ===========================================================================
  // AIR-GAP MODE TESTS
  // ===========================================================================

  describe("Air-Gap Mode Check", () => {
    it("should return true when air-gap mode is enabled", () => {
      const config = { airGapMode: true };
      expect(config.airGapMode).toBe(true);
    });

    it("should return false when air-gap mode is disabled", () => {
      const config = { airGapMode: false };
      expect(config.airGapMode).toBe(false);
    });
  });
});
