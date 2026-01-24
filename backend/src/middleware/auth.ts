/**
 * AUTH MIDDLEWARE EXPORTS — MGR CAPITAL ASSISTANCE
 * Re-exports auth functions with common aliases
 */

import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  founderOnly,
  adminOrFounder,
  requireMinTier,
} from "./authMiddleware.js";

import type { AuthenticatedRequest } from "./authMiddleware.js";

// Re-export the type
export type { AuthenticatedRequest };
export type AuthRequest = AuthenticatedRequest;

// Aliases for common naming conventions
export const authenticate = authMiddleware;
export const optionalAuth = optionalAuthMiddleware;

// authorize is an alias for requireRoles
export function authorize(allowedRoles: string[]) {
  return requireRoles(...(allowedRoles as any));
}

// Re-export everything
export {
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  founderOnly,
  adminOrFounder,
  requireMinTier,
};

export default {
  authenticate,
  authorize,
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  founderOnly,
  adminOrFounder,
  requireMinTier,
};
