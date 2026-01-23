/**
 * CacheService Unit Tests
 *
 * Tests for Redis caching, graceful degradation, invalidation patterns.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  ping: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  on: jest.fn(),
};

jest.unstable_mockModule("redis", () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock config with Redis enabled by default for tests
let mockConfigEnabled = true;
jest.unstable_mockModule("../config/env.js", () => ({
  config: {
    get redisEnabled() {
      return mockConfigEnabled;
    },
    redisUrl: "redis://localhost:6379",
  },
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

// Import after mocks - need to reimport for each test suite to get fresh instance
const { CacheService } = await import("../../src/services/CacheService.js");

// Create a new instance for testing instead of using singleton
class TestCacheService extends CacheService {}

describe("CacheService", () => {
  let cacheService: InstanceType<typeof CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigEnabled = true;

    // Reset mock implementations to defaults
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.quit.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue("PONG");
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue("OK");
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.on.mockImplementation(() => mockRedisClient);

    // Create fresh instance
    cacheService = new TestCacheService();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // CONNECTION TESTS
  // ===========================================================================

  describe("connect", () => {
    it("should connect to Redis when enabled", async () => {
      const result = await cacheService.connect();

      expect(result).toBe(true);
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it("should return false when Redis is disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.connect();

      expect(result).toBe(false);
      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });

    it("should return true on subsequent calls if already connected", async () => {
      await cacheService.connect();
      mockRedisClient.connect.mockClear();

      const result = await cacheService.connect();

      expect(result).toBe(true);
      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });

    it("should handle connection errors gracefully", async () => {
      mockRedisClient.connect.mockRejectedValue(new Error("Connection refused"));

      const result = await cacheService.connect();

      expect(result).toBe(false);
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });

    it("should set up error event handler", async () => {
      await cacheService.connect();

      expect(mockRedisClient.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("disconnect", () => {
    it("should disconnect from Redis", async () => {
      await cacheService.connect();
      await cacheService.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it("should handle disconnect when not connected", async () => {
      // Should not throw
      await expect(cacheService.disconnect()).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // GET TESTS
  // ===========================================================================

  describe("get", () => {
    it("should return cached value with correct type", async () => {
      const testData = { foo: "bar", count: 42 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get<typeof testData>("test:key");

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith("mgr:test:key");
    });

    it("should return null for cache miss", async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get("nonexistent");

      expect(result).toBeNull();
      const stats = cacheService.getStats();
      expect(stats.misses).toBe(1);
    });

    it("should increment hits on cache hit", async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: "test" }));

      await cacheService.get("test:key");

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
    });

    it("should return null when disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.get("any:key");

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it("should handle JSON parse errors gracefully", async () => {
      mockRedisClient.get.mockResolvedValue("invalid-json{{{");

      const result = await cacheService.get("bad:json");

      expect(result).toBeNull();
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.get.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.get("error:key");

      expect(result).toBeNull();
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  // ===========================================================================
  // SET TESTS
  // ===========================================================================

  describe("set", () => {
    it("should set value with default TTL", async () => {
      const result = await cacheService.set("test:key", { data: "value" });

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "mgr:test:key",
        JSON.stringify({ data: "value" }),
        { EX: 3600 }
      );
    });

    it("should set value with custom TTL", async () => {
      await cacheService.set("test:key", { data: "value" }, 300);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "mgr:test:key",
        expect.any(String),
        { EX: 300 }
      );
    });

    it("should increment sets counter", async () => {
      await cacheService.set("test:key", "value");

      const stats = cacheService.getStats();
      expect(stats.sets).toBe(1);
    });

    it("should return false when disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.set("any:key", "value");

      expect(result).toBe(false);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisClient.set.mockRejectedValue(new Error("Redis error"));

      const result = await cacheService.set("error:key", "value");

      expect(result).toBe(false);
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });

    it("should serialize complex objects", async () => {
      const complex = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        date: "2024-01-01",
      };

      await cacheService.set("complex:key", complex);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "mgr:complex:key",
        JSON.stringify(complex),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // DELETE TESTS
  // ===========================================================================

  describe("del", () => {
    it("should delete a key", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cacheService.del("test:key");

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith("mgr:test:key");
    });

    it("should return false if key not found", async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await cacheService.del("nonexistent");

      expect(result).toBe(false);
    });

    it("should increment deletes counter", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.del("test:key");

      const stats = cacheService.getStats();
      expect(stats.deletes).toBe(1);
    });

    it("should return false when disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.del("any:key");

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // FLUSH TESTS
  // ===========================================================================

  describe("flush", () => {
    it("should delete all keys matching pattern", async () => {
      mockRedisClient.keys.mockResolvedValue([
        "mgr:config:training",
        "mgr:config:scheduler",
        "mgr:config:backup",
      ]);
      mockRedisClient.del.mockResolvedValue(3);

      const result = await cacheService.flush("config:*");

      expect(result).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalledWith("mgr:config:*");
      expect(mockRedisClient.del).toHaveBeenCalledWith([
        "mgr:config:training",
        "mgr:config:scheduler",
        "mgr:config:backup",
      ]);
    });

    it("should return 0 if no keys match", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await cacheService.flush("nonexistent:*");

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it("should return 0 when disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.flush("any:*");

      expect(result).toBe(0);
    });
  });

  // ===========================================================================
  // PING/HEALTH TESTS
  // ===========================================================================

  describe("ping", () => {
    it("should return true when Redis responds PONG", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");

      const result = await cacheService.ping();

      expect(result).toBe(true);
    });

    it("should return false when ping fails", async () => {
      mockRedisClient.ping.mockRejectedValue(new Error("Ping failed"));

      const result = await cacheService.ping();

      expect(result).toBe(false);
    });

    it("should return false when disabled", async () => {
      mockConfigEnabled = false;
      cacheService = new TestCacheService();

      const result = await cacheService.ping();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // STATS TESTS
  // ===========================================================================

  describe("getStats", () => {
    it("should return current statistics", async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: "test" }));
      await cacheService.get("test1");
      await cacheService.get("test2");

      mockRedisClient.get.mockResolvedValue(null);
      await cacheService.get("miss1");

      await cacheService.set("set1", "value");

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
    });

    it("should return copy of stats, not reference", async () => {
      const stats1 = cacheService.getStats();
      stats1.hits = 999;

      const stats2 = cacheService.getStats();
      expect(stats2.hits).toBe(0);
    });
  });

  describe("resetStats", () => {
    it("should reset all counters to zero", async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: "test" }));
      await cacheService.get("test1");
      await cacheService.set("set1", "value");

      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  // ===========================================================================
  // ENABLE/DISABLE TESTS
  // ===========================================================================

  describe("isEnabled/enable/disable", () => {
    it("should return enabled status", () => {
      expect(cacheService.isEnabled()).toBe(true);
    });

    it("should disable caching at runtime", async () => {
      cacheService.disable();

      expect(cacheService.isEnabled()).toBe(false);
      const result = await cacheService.get("any:key");
      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it("should enable caching at runtime", async () => {
      cacheService.disable();
      cacheService.enable();

      expect(cacheService.isEnabled()).toBe(true);
    });
  });

  // ===========================================================================
  // GET OR SET PATTERN TESTS
  // ===========================================================================

  describe("getOrSet", () => {
    it("should return cached value without calling fetch function", async () => {
      const cachedData = { cached: true };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));
      const fetchFn = jest.fn().mockResolvedValue({ fresh: true });

      const result = await cacheService.getOrSet("test:key", fetchFn);

      expect(result).toEqual(cachedData);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("should call fetch function on cache miss", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const freshData = { fresh: true };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheService.getOrSet("test:key", fetchFn);

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
    });

    it("should cache fresh data after fetch", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const freshData = { fresh: true };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      await cacheService.getOrSet("test:key", fetchFn, 600);

      // Give time for fire-and-forget set
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "mgr:test:key",
        JSON.stringify(freshData),
        { EX: 600 }
      );
    });

    it("should still return data even if cache set fails", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockRejectedValue(new Error("Set failed"));
      const freshData = { fresh: true };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await cacheService.getOrSet("test:key", fetchFn);

      expect(result).toEqual(freshData);
    });
  });

  // ===========================================================================
  // INVALIDATION CONVENIENCE METHODS
  // ===========================================================================

  describe("invalidateConfig", () => {
    it("should delete specific config slice", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.invalidateConfig("training");

      expect(mockRedisClient.del).toHaveBeenCalledWith("mgr:config:training");
    });

    it("should flush all config keys when no slice specified", async () => {
      mockRedisClient.keys.mockResolvedValue(["mgr:config:a", "mgr:config:b"]);
      mockRedisClient.del.mockResolvedValue(2);

      await cacheService.invalidateConfig();

      expect(mockRedisClient.keys).toHaveBeenCalledWith("mgr:config:*");
    });
  });

  describe("invalidateMetrics", () => {
    it("should delete specific jurisdiction metrics", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.invalidateMetrics("TN", "Davidson");

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        "mgr:metrics:jurisdiction:TN:Davidson"
      );
    });

    it("should flush state metrics when only state specified", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidateMetrics("TN");

      expect(mockRedisClient.keys).toHaveBeenCalledWith(
        "mgr:metrics:jurisdiction:TN:*"
      );
    });

    it("should flush all metrics when no params", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidateMetrics();

      expect(mockRedisClient.keys).toHaveBeenCalledWith("mgr:metrics:*");
    });
  });

  describe("invalidateInsights", () => {
    it("should flush user-specific insights", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidateInsights("user-123");

      expect(mockRedisClient.keys).toHaveBeenCalledWith("mgr:insights:user-123:*");
    });

    it("should flush all insights when no userId", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidateInsights();

      expect(mockRedisClient.keys).toHaveBeenCalledWith("mgr:insights:*");
    });
  });

  describe("invalidateTrainingRecommendations", () => {
    it("should delete specific employee recommendations", async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.invalidateTrainingRecommendations("emp-123");

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        "mgr:training:recommendations:emp-123"
      );
    });

    it("should flush all recommendations when no employeeId", async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidateTrainingRecommendations();

      expect(mockRedisClient.keys).toHaveBeenCalledWith(
        "mgr:training:recommendations:*"
      );
    });
  });
});

// ===========================================================================
// CACHE KEYS AND TTL EXPORTS TESTS
// ===========================================================================

describe("CacheKeys", () => {
  it("should export all expected key prefixes", async () => {
    const { CacheKeys } = await import("../../src/services/CacheService.js");

    expect(CacheKeys.CONFIG).toBe("config");
    expect(CacheKeys.METRICS).toBe("metrics");
    expect(CacheKeys.INSIGHTS).toBe("insights");
    expect(CacheKeys.TRAINING).toBe("training");
    expect(CacheKeys.AUTH).toBe("auth");
  });
});

describe("CacheTTL", () => {
  it("should export correct TTL values in seconds", async () => {
    const { CacheTTL } = await import("../../src/services/CacheService.js");

    expect(CacheTTL.CONFIG).toBe(3600); // 1 hour
    expect(CacheTTL.METRICS).toBe(1800); // 30 min
    expect(CacheTTL.INSIGHTS).toBe(300); // 5 min
    expect(CacheTTL.SHORT).toBe(60); // 1 min
    expect(CacheTTL.VERY_LONG).toBe(86400); // 24 hours
  });
});
