// ============================================
// ROLE GUARD MIDDLEWARE — MGR CAPITAL ASSISTANCE
// Role-based access control with FOUNDER superuser bypass
// ============================================

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware.js";

/**
 * Role guard middleware factory
 * Creates middleware that restricts access to specific roles
 * FOUNDER role always has access (superuser)
 */
export function roleGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER has all permissions (superuser) - bypass all role checks
    if (req.user.role === "FOUNDER") {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "You do not have permission to access this resource"
      });
      return;
    }

    next();
  };
}

/**
 * Require specific tier for employees
 * Checks if employee meets minimum tier requirement
 */
export function tierGuard(minimumTier: "STANDARD" | "SENIOR" | "MANAGER") {
  const tierOrder = { STANDARD: 1, SENIOR: 2, MANAGER: 3 };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER bypasses tier requirements
    if (req.user.role === "FOUNDER") {
      next();
      return;
    }

    // Non-employees don't have tiers
    if (req.user.role !== "EMPLOYEE") {
      res.status(403).json({
        success: false,
        error: "This feature is only available to employees"
      });
      return;
    }

    const userTierLevel = tierOrder[req.user.tier as keyof typeof tierOrder] || 0;
    const requiredLevel = tierOrder[minimumTier];

    if (userTierLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: `This feature requires ${minimumTier} tier or higher`
      });
      return;
    }

    next();
  };
}

/**
 * Require ownership or FOUNDER status
 * For routes where users can only access their own resources
 */
export function ownershipGuard(getResourceOwnerId: (req: AuthenticatedRequest) => string | Promise<string>) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER can access anything
    if (req.user.role === "FOUNDER") {
      next();
      return;
    }

    try {
      const ownerId = await getResourceOwnerId(req);

      if (ownerId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: "You can only access your own resources"
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to verify resource ownership"
      });
    }
  };
}
