// ============================================
// RATE LIMITING MIDDLEWARE — MGR CAPITAL ASSISTANCE
// Centralized, upgradeable rate limiting
// In-memory now, Redis-ready for later
// ============================================

import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

// ============================================
// RATE LIMIT STORE (In-Memory, Redis-Ready)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

// In-memory store - can be replaced with Redis adapter
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check if entry has expired
    if (Date.now() > entry.resetAt && !entry.blocked) {
      this.store.delete(key);
      return undefined;
    }

    // Check if block has expired
    if (entry.blocked && entry.blockedUntil && Date.now() > entry.blockedUntil) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (!existing) {
      const entry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
        blocked: false,
      };
      this.set(key, entry);
      return entry;
    }

    existing.count++;
    return existing;
  }

  block(key: string, durationMs: number): void {
    const existing = this.get(key);
    if (existing) {
      existing.blocked = true;
      existing.blockedUntil = Date.now() + durationMs;
      this.set(key, existing);
    } else {
      this.set(key, {
        count: 0,
        resetAt: Date.now() + durationMs,
        blocked: true,
        blockedUntil: Date.now() + durationMs,
      });
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt && !entry.blocked) {
        this.store.delete(key);
      }
      if (entry.blocked && entry.blockedUntil && now > entry.blockedUntil) {
        this.store.delete(key);
      }
    }
  }

  // For testing/monitoring
  getStats(): { totalEntries: number; blockedCount: number } {
    let blockedCount = 0;
    for (const entry of this.store.values()) {
      if (entry.blocked) blockedCount++;
    }
    return {
      totalEntries: this.store.size,
      blockedCount,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

// ============================================
// RATE LIMIT CONFIGURATIONS
// ============================================

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after exceeding
  message: string;       // Error message (generic for security)
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Preset configurations
const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  // Strict: For login, password reset
  strict: {
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 15,             // 15 attempts per 15 minutes
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes
    message: "Too many requests. Please try again later.",
  },

  // Standard: For authenticated API endpoints
  standard: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 100,            // 100 requests/minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
    message: "Rate limit exceeded. Please slow down.",
  },

  // Relaxed: For read-heavy endpoints
  relaxed: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 300,            // 300 requests/minute
    blockDurationMs: 60 * 1000,  // Block for 1 minute
    message: "Rate limit exceeded.",
  },

  // Upload: For file uploads
  upload: {
    windowMs: 60 * 60 * 1000,    // 1 hour
    maxRequests: 50,             // 50 uploads/hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    message: "Upload limit exceeded. Please try again later.",
  },
};

// ============================================
// RATE LIMIT MIDDLEWARE FACTORY
// ============================================

function createRateLimiter(config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS) {
  const finalConfig: RateLimitConfig =
    typeof config === "string" ? RATE_LIMIT_PRESETS[config] : config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate rate limit key
      const key = finalConfig.keyGenerator
        ? finalConfig.keyGenerator(req)
        : generateDefaultKey(req);

      // Check if blocked
      const existing = rateLimitStore.get(key);
      if (existing?.blocked) {
        const retryAfter = Math.ceil(
          ((existing.blockedUntil || 0) - Date.now()) / 1000
        );

        // Log the blocked attempt
        await logRateLimitEvent(req, "blocked", key);

        return res.status(429).json({
          success: false,
          error: finalConfig.message,
          retryAfter: Math.max(retryAfter, 0),
        });
      }

      // Increment counter
      const entry = rateLimitStore.increment(key, finalConfig.windowMs);

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", finalConfig.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, finalConfig.maxRequests - entry.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

      // Check if limit exceeded
      if (entry.count > finalConfig.maxRequests) {
        rateLimitStore.block(key, finalConfig.blockDurationMs);

        // Log the rate limit event
        await logRateLimitEvent(req, "exceeded", key);

        return res.status(429).json({
          success: false,
          error: finalConfig.message,
          retryAfter: Math.ceil(finalConfig.blockDurationMs / 1000),
        });
      }

      next();
    } catch (error) {
      // Rate limiting failed — log for investigation but allow request with warning
      console.error("[RateLimit] Error — applying fallback mode:", error);
      res.setHeader("X-RateLimit-Warning", "fallback-mode");
      next();
    }
  };
}

// ============================================
// KEY GENERATORS
// ============================================

function generateDefaultKey(req: Request): string {
  // Use IP + user agent hash as default key
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "unknown";
  return `${ip}:${hashString(ua)}`;
}

function generateIPKey(req: Request): string {
  return getClientIP(req);
}

function generateUserKey(req: Request): string {
  const user = (req as any).user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  return generateIPKey(req);
}

function generateEndpointKey(req: Request): string {
  const ip = getClientIP(req);
  const endpoint = req.path;
  return `${ip}:${endpoint}`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getClientIP(req: Request): string {
  // Check for forwarded IP (when behind proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    return ips[0].trim();
  }

  // Check for real IP header
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return typeof realIP === "string" ? realIP : realIP[0];
  }

  // Fall back to connection remote address
  return req.socket?.remoteAddress || "unknown";
}

function hashString(str: string): string {
  // Simple hash for user agent fingerprinting
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function logRateLimitEvent(req: Request, event: "blocked" | "exceeded", key: string): Promise<void> {
  try {
    const user = (req as any).user;

    await prisma.auditLog.create({
      data: {
        userId: user?.userId,
        action: `RATE_LIMIT_${event.toUpperCase()}`,
        entityType: "RateLimit",
        entityId: key,
        details: {
          ip: getClientIP(req),
          path: req.path,
          method: req.method,
          userAgent: req.headers["user-agent"],
        },
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
      },
    });
  } catch (error) {
    console.error("[RateLimit] Failed to log event:", error);
  }
}

// ============================================
// PRE-CONFIGURED MIDDLEWARE
// ============================================

// For login endpoint
export const loginRateLimit = createRateLimiter({
  ...RATE_LIMIT_PRESETS.strict,
  keyGenerator: generateIPKey,
});

// For password reset
export const passwordResetRateLimit = createRateLimiter({
  ...RATE_LIMIT_PRESETS.strict,
  maxRequests: 3, // Even stricter
  keyGenerator: generateIPKey,
});

// For general API endpoints
export const apiRateLimit = createRateLimiter("standard");

// For read-heavy endpoints
export const readRateLimit = createRateLimiter("relaxed");

// For file uploads
export const uploadRateLimit = createRateLimiter("upload");

// ============================================
// EXPORTS
// ============================================

export {
  createRateLimiter,
  rateLimitStore,
  generateDefaultKey,
  generateIPKey,
  generateUserKey,
  generateEndpointKey,
  RATE_LIMIT_PRESETS,
  RateLimitConfig,
};

export default createRateLimiter;
