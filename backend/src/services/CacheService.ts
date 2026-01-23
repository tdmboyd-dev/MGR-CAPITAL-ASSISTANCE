/**
 * CacheService.ts
 *
 * Redis-based caching layer for performance optimization.
 * Sovereign-focused: Local Redis, no external cloud dependencies.
 *
 * FEATURES:
 * - JSON serialization/deserialization
 * - TTL-based expiration
 * - Pattern-based cache invalidation
 * - Graceful degradation (cache miss returns null)
 * - Connection pooling via redis client
 * - Health check for monitoring
 *
 * HOT PATHS TO CACHE:
 * - FounderConfig slices (TTL: 1h)
 * - JurisdictionMetrics (TTL: 30m)
 * - OpsInsights lists (TTL: 5m)
 * - TrainingRecommendations (TTL: 1h)
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

// =============================================================================
// TYPES
// =============================================================================

export interface CacheConfig {
  enabled: boolean;
  url: string;
  defaultTtlSeconds: number;
  keyPrefix: string;
}

export interface CacheStats {
  connected: boolean;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

// =============================================================================
// CACHE KEY PREFIXES (for organization and invalidation)
// =============================================================================

export const CacheKeys = {
  // FounderConfig slices
  CONFIG: "config",
  CONFIG_TRAINING: "config:training",
  CONFIG_SCHEDULER: "config:scheduler",
  CONFIG_BACKUP: "config:backup",
  CONFIG_OPS: "config:ops",
  CONFIG_COMPLIANCE: "config:compliance",
  CONFIG_NOTIFICATION: "config:notification",
  CONFIG_SYSTEM: "config:system",
  CONFIG_SECURITY: "config:security",
  CONFIG_PERFORMANCE: "config:performance",
  CONFIG_INGESTION: "config:ingestion",

  // Metrics
  METRICS: "metrics",
  METRICS_JURISDICTION: "metrics:jurisdiction",
  METRICS_EMPLOYEE: "metrics:employee",

  // Insights
  INSIGHTS: "insights",
  INSIGHTS_UNREAD: "insights:unread",

  // Training
  TRAINING: "training",
  TRAINING_RECOMMENDATIONS: "training:recommendations",

  // Auth (optional, for session caching)
  AUTH: "auth",
  AUTH_USER: "auth:user",
} as const;

// =============================================================================
// DEFAULT TTL VALUES (in seconds)
// =============================================================================

export const CacheTTL = {
  CONFIG: 3600, // 1 hour
  METRICS: 1800, // 30 minutes
  INSIGHTS: 300, // 5 minutes
  TRAINING: 3600, // 1 hour
  AUTH: 900, // 15 minutes
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

// =============================================================================
// CACHE SERVICE CLASS
// =============================================================================

class CacheService {
  private client: RedisClientType | null = null;
  private connected = false;
  private enabled: boolean;
  private url: string;
  private keyPrefix: string;
  private defaultTtl: number;

  // Stats tracking
  private stats: CacheStats = {
    connected: false,
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor() {
    this.enabled = config.redisEnabled ?? false;
    this.url = config.redisUrl || "redis://localhost:6379";
    this.keyPrefix = "mgr:";
    this.defaultTtl = 3600; // 1 hour
  }

  /**
   * Connect to Redis (lazy connection)
   */
  async connect(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    if (this.connected && this.client) {
      return true;
    }

    try {
      this.client = createClient({ url: this.url });

      this.client.on("error", (err) => {
        logger.error("Redis client error", { error: err.message });
        this.stats.errors++;
      });

      this.client.on("connect", () => {
        logger.info("Redis connected", { url: this.url });
      });

      this.client.on("reconnecting", () => {
        logger.warn("Redis reconnecting");
      });

      await this.client.connect();
      this.connected = true;
      this.stats.connected = true;

      return true;
    } catch (error: any) {
      logger.error("Redis connection failed", { error: error.message });
      this.stats.errors++;
      this.connected = false;
      this.stats.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      this.stats.connected = false;
      logger.info("Redis disconnected");
    }
  }

  /**
   * Build full key with prefix
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const isConnected = await this.connect();
      if (!isConnected || !this.client) {
        return null;
      }

      const fullKey = this.buildKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error: any) {
      logger.warn("Cache get error", { key, error: error.message });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const isConnected = await this.connect();
      if (!isConnected || !this.client) {
        return false;
      }

      const fullKey = this.buildKey(key);
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTtl;

      await this.client.set(fullKey, serialized, { EX: ttl });
      this.stats.sets++;

      logger.debug("Cache set", { key: fullKey, ttl });
      return true;
    } catch (error: any) {
      logger.warn("Cache set error", { key, error: error.message });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const isConnected = await this.connect();
      if (!isConnected || !this.client) {
        return false;
      }

      const fullKey = this.buildKey(key);
      const result = await this.client.del(fullKey);
      this.stats.deletes++;

      logger.debug("Cache delete", { key: fullKey, deleted: result > 0 });
      return result > 0;
    } catch (error: any) {
      logger.warn("Cache delete error", { key, error: error.message });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async flush(pattern: string): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      const isConnected = await this.connect();
      if (!isConnected || !this.client) {
        return 0;
      }

      const fullPattern = this.buildKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      this.stats.deletes += result;

      logger.info("Cache flush", { pattern: fullPattern, deleted: result });
      return result;
    } catch (error: any) {
      logger.warn("Cache flush error", { pattern, error: error.message });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Check if Redis is healthy
   */
  async ping(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const isConnected = await this.connect();
      if (!isConnected || !this.client) {
        return false;
      }

      const result = await this.client.ping();
      return result === "PONG";
    } catch (error: any) {
      logger.warn("Redis ping failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      connected: this.connected,
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable caching (runtime toggle)
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable caching (runtime toggle)
   */
  disable(): void {
    this.enabled = false;
  }

  // =========================================================================
  // CONVENIENCE METHODS FOR COMMON PATTERNS
  // =========================================================================

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Cache it (don't await, fire and forget)
    this.set(key, data, ttlSeconds).catch(() => {
      // Ignore cache set errors
    });

    return data;
  }

  /**
   * Invalidate config cache (call on FounderConfig update)
   */
  async invalidateConfig(sliceKey?: string): Promise<void> {
    if (sliceKey) {
      await this.del(`${CacheKeys.CONFIG}:${sliceKey}`);
    } else {
      await this.flush(`${CacheKeys.CONFIG}:*`);
    }
  }

  /**
   * Invalidate metrics cache
   */
  async invalidateMetrics(state?: string, county?: string): Promise<void> {
    if (state && county) {
      await this.del(`${CacheKeys.METRICS_JURISDICTION}:${state}:${county}`);
    } else if (state) {
      await this.flush(`${CacheKeys.METRICS_JURISDICTION}:${state}:*`);
    } else {
      await this.flush(`${CacheKeys.METRICS}:*`);
    }
  }

  /**
   * Invalidate insights cache for user
   */
  async invalidateInsights(userId?: string): Promise<void> {
    if (userId) {
      await this.flush(`${CacheKeys.INSIGHTS}:${userId}:*`);
    } else {
      await this.flush(`${CacheKeys.INSIGHTS}:*`);
    }
  }

  /**
   * Invalidate training recommendations for employee
   */
  async invalidateTrainingRecommendations(employeeId?: string): Promise<void> {
    if (employeeId) {
      await this.del(`${CacheKeys.TRAINING_RECOMMENDATIONS}:${employeeId}`);
    } else {
      await this.flush(`${CacheKeys.TRAINING_RECOMMENDATIONS}:*`);
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const cacheService = new CacheService();
export default cacheService;
