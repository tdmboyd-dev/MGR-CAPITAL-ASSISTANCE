/**
 * AUTH MIDDLEWARE — MGR CAPITAL ASSISTANCE
 * JWT verification with short-lived access tokens + refresh token support
 *
 * SECURITY FEATURES:
 * - Verifies short-lived access tokens (15 min default)
 * - Auto-refresh support via silent refresh endpoint
 * - Role-based access control helpers
 * - Session validation for strict routes
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { Request, Response, NextFunction } from "express";
import { UserRole, EmployeeTier } from "@prisma/client";
import { authService, TokenPayload } from "../services/AuthService.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    role: UserRole;
    tier?: EmployeeTier | null;
  };
  token?: string;
}

// Alias for backwards compatibility
export type AuthRequest = AuthenticatedRequest;

// =============================================================================
// MAIN AUTH MIDDLEWARE
// =============================================================================

/**
 * Main authentication middleware
 * Verifies JWT access token from Authorization header
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_TOKEN",
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = authService.verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
      return;
    }

    // Set user info on request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier,
    };
    req.token = token;

    next();
  } catch (error: any) {
    logger.warn("Auth middleware error", { error: error.message });

    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    } else if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        error: "Invalid authentication token",
        code: "INVALID_TOKEN",
      });
    } else {
      res.status(401).json({
        success: false,
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }
  }
}

// =============================================================================
// OPTIONAL AUTH MIDDLEWARE
// =============================================================================

/**
 * Optional authentication middleware
 * Sets user if token valid, but doesn't require auth
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = authService.verifyAccessToken(token);

    if (decoded) {
      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tier: decoded.tier,
      };
      req.token = token;
    }
  } catch {
    // Token invalid, but that's okay for optional auth
  }

  next();
}

// =============================================================================
// ROLE-BASED ACCESS CONTROL
// =============================================================================

/**
 * Require specific roles
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "NO_AUTH",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      logger.warn("Access denied - insufficient role", {
        userId: req.user.id,
        role: req.user.role,
        required: allowedRoles,
      });

      res.status(403).json({
        success: false,
        error: "Access denied",
        code: "INSUFFICIENT_ROLE",
      });
      return;
    }

    next();
  };
}

/**
 * Require FOUNDER role only
 */
export function founderOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_AUTH",
    });
    return;
  }

  if (req.user.role !== "FOUNDER") {
    logger.warn("Access denied - founder only", {
      userId: req.user.id,
      role: req.user.role,
    });

    res.status(403).json({
      success: false,
      error: "Access denied",
      code: "FOUNDER_ONLY",
    });
    return;
  }

  next();
}

/**
 * Require FOUNDER or ADMIN role
 */
export function adminOrFounder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_AUTH",
    });
    return;
  }

  if (req.user.role !== "FOUNDER" && req.user.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      error: "Access denied",
      code: "ADMIN_OR_FOUNDER_ONLY",
    });
    return;
  }

  next();
}

/**
 * Require minimum employee tier
 */
export function requireMinTier(minTier: EmployeeTier) {
  const tierOrder: EmployeeTier[] = [
    "TIER_1_ASSOCIATE",
    "TIER_2_SPECIALIST",
    "TIER_3_SENIOR_SPECIALIST",
    "TIER_4_TEAM_LEADER",
    "TIER_5_EXECUTIVE_PARTNER",
  ];

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "NO_AUTH",
      });
      return;
    }

    // FOUNDER and ADMIN bypass tier checks
    if (req.user.role === "FOUNDER" || req.user.role === "ADMIN") {
      next();
      return;
    }

    if (!req.user.tier) {
      res.status(403).json({
        success: false,
        error: "No tier assigned",
        code: "NO_TIER",
      });
      return;
    }

    const userTierIndex = tierOrder.indexOf(req.user.tier as EmployeeTier);
    const minTierIndex = tierOrder.indexOf(minTier);

    if (userTierIndex < minTierIndex) {
      res.status(403).json({
        success: false,
        error: "Insufficient tier level",
        code: "INSUFFICIENT_TIER",
      });
      return;
    }

    next();
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  founderOnly,
  adminOrFounder,
  requireMinTier,
};
