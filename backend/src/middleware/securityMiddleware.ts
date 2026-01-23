/**
 * SECURITY MIDDLEWARE — MGR CAPITAL ASSISTANCE
 * Production security headers and rate limiting
 *
 * SECURITY FEATURES:
 * - Helmet.js for security headers (CSP, HSTS, etc.)
 * - Rate limiting (general + strict for auth)
 * - Cookie parser for refresh tokens
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// HELMET — Security Headers
// =============================================================================

/**
 * Configure Helmet.js for sovereign/air-gap security
 */
export const helmetMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for now
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.nodeEnv === "production" ? [] : null,
    },
  },

  // Cross-Origin settings
  crossOriginEmbedderPolicy: false, // Can cause issues with some resources
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frameguard - prevent clickjacking
  frameguard: { action: "deny" },

  // Hide X-Powered-By
  hidePoweredBy: true,

  // HSTS - HTTP Strict Transport Security
  hsts: config.nodeEnv === "production"
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: "none" },

  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },

  // XSS Filter
  xssFilter: true,
});

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * General rate limiter - 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: "Too many requests",
    message: "Too many requests from this IP. Please try again later.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: "Too many requests",
      message: "Too many requests from this IP. Please try again later.",
      code: "RATE_LIMITED",
    });
  },
});

/**
 * Strict rate limiter for auth endpoints - 10 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.authRateLimitMaxRequests,
  message: {
    success: false,
    error: "Too many authentication attempts",
    message: "Too many login attempts. Please try again later.",
    code: "AUTH_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      email: req.body?.email ? "[REDACTED]" : undefined,
    });
    res.status(429).json({
      success: false,
      error: "Too many authentication attempts",
      message: "Too many login attempts. Please try again later.",
      code: "AUTH_RATE_LIMITED",
    });
  },
});

/**
 * Very strict rate limiter for password reset - 3 requests per 15 minutes per IP
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 3,
  message: {
    success: false,
    error: "Too many password reset attempts",
    message: "Too many password reset requests. Please try again later.",
    code: "RESET_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn("Password reset rate limit exceeded", {
      ip: req.ip,
    });
    res.status(429).json({
      success: false,
      error: "Too many password reset attempts",
      message: "Too many password reset requests. Please try again later.",
      code: "RESET_RATE_LIMITED",
    });
  },
});

// =============================================================================
// COOKIE PARSER
// =============================================================================

export const cookieMiddleware: RequestHandler = cookieParser();

// =============================================================================
// REQUEST LOGGING
// =============================================================================

/**
 * Log all requests (basic access log)
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  // Log on response finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "debug";

    if (config.nodeEnv === "production" || res.statusCode >= 400) {
      logger[level]("HTTP Request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("User-Agent")?.substring(0, 50),
      });
    }
  });

  next();
}

// =============================================================================
// SECURITY HEADERS FOR SOVEREIGN/AIR-GAP MODE
// =============================================================================

/**
 * Additional security headers for air-gap mode
 */
export function airGapHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent any external resource loading
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Strict CSP for air-gap
  if (process.env.AIR_GAP_MODE === "true") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );
  }

  next();
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  helmetMiddleware,
  generalRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  cookieMiddleware,
  requestLogger,
  airGapHeaders,
};
