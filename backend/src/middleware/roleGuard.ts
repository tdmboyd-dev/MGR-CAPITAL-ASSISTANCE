// ============================================
// ROLE GUARD MIDDLEWARE — MGR CAPITAL ASSISTANCE
// Role-based access control with FOUNDER superuser bypass
// Supports: FOUNDER, ADMIN, HR, COMPLIANCE, TEAM_LEAD, EMPLOYEE, CLIENT
// ============================================

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware.js";

// ============================================
// ROLE CONSTANTS & GROUPINGS
// ============================================

export const ROLES = {
  FOUNDER: "FOUNDER",
  ADMIN: "ADMIN",
  HR: "HR",
  COMPLIANCE: "COMPLIANCE",
  TEAM_LEAD: "TEAM_LEAD",
  EMPLOYEE: "EMPLOYEE",
  CLIENT: "CLIENT",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Permission levels (higher = more access)
const ROLE_LEVELS: Record<UserRole, number> = {
  FOUNDER: 100,     // Superuser - full access to everything
  ADMIN: 80,        // Administrative access
  HR: 60,           // HR management access
  COMPLIANCE: 60,   // Compliance monitoring access
  TEAM_LEAD: 40,    // Team management access
  EMPLOYEE: 20,     // Regular employee access
  CLIENT: 10,       // Client portal access only
};

// Role groupings for convenience
export const ROLE_GROUPS = {
  // All internal staff (excludes clients)
  STAFF: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR, ROLES.COMPLIANCE, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],

  // Management roles (can view team data)
  MANAGEMENT: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEAD],

  // Admin level (system configuration access)
  ADMINS: [ROLES.FOUNDER, ROLES.ADMIN],

  // Case handlers (can work on cases)
  CASE_HANDLERS: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],

  // HR access (employee management)
  HR_ACCESS: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR],

  // Compliance access (monitoring and auditing)
  COMPLIANCE_ACCESS: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.COMPLIANCE],

  // Team leaders and above
  TEAM_MANAGEMENT: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEAD],

  // Financial access (payouts, commissions)
  FINANCIAL_ACCESS: [ROLES.FOUNDER, ROLES.ADMIN],

  // Training administration
  TRAINING_ADMIN: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR],

  // OPS layer access (bots, metrics, insights)
  OPS_ACCESS: [ROLES.FOUNDER],

  // Can view all employees
  EMPLOYEE_VIEWERS: [ROLES.FOUNDER, ROLES.ADMIN, ROLES.HR, ROLES.COMPLIANCE, ROLES.TEAM_LEAD],
};

// ============================================
// CORE ROLE GUARD
// ============================================

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
    if (req.user.role === ROLES.FOUNDER) {
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
 * Minimum role level guard
 * Allows access if user's role level is >= minimum
 */
export function minRoleLevel(minimumRole: UserRole) {
  const minimumLevel = ROLE_LEVELS[minimumRole];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER always passes
    if (req.user.role === ROLES.FOUNDER) {
      next();
      return;
    }

    const userLevel = ROLE_LEVELS[req.user.role as UserRole] || 0;

    if (userLevel < minimumLevel) {
      res.status(403).json({
        success: false,
        error: "Insufficient permissions for this resource"
      });
      return;
    }

    next();
  };
}

// ============================================
// TIER GUARD (FOR EMPLOYEES)
// ============================================

// Employee tiers in order
export const EMPLOYEE_TIERS = {
  TIER_1_ASSOCIATE: 1,
  TIER_2_SPECIALIST: 2,
  TIER_3_SENIOR_SPECIALIST: 3,
  TIER_4_TEAM_LEADER: 4,
  TIER_5_EXECUTIVE_PARTNER: 5,
} as const;

export type EmployeeTier = keyof typeof EMPLOYEE_TIERS;

/**
 * Require specific tier for employees
 * Checks if employee meets minimum tier requirement
 */
export function tierGuard(minimumTier: EmployeeTier) {
  const minimumLevel = EMPLOYEE_TIERS[minimumTier];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER bypasses tier requirements
    if (req.user.role === ROLES.FOUNDER) {
      next();
      return;
    }

    // ADMIN bypasses tier requirements
    if (req.user.role === ROLES.ADMIN) {
      next();
      return;
    }

    // Non-employees/team-leads don't have tiers
    if (req.user.role !== ROLES.EMPLOYEE && req.user.role !== ROLES.TEAM_LEAD) {
      res.status(403).json({
        success: false,
        error: "This feature is only available to employees"
      });
      return;
    }

    const userTierLevel = EMPLOYEE_TIERS[req.user.tier as EmployeeTier] || 0;

    if (userTierLevel < minimumLevel) {
      res.status(403).json({
        success: false,
        error: `This feature requires ${minimumTier.replace(/_/g, " ")} tier or higher`
      });
      return;
    }

    next();
  };
}

// ============================================
// OWNERSHIP GUARD
// ============================================

/**
 * Require ownership or elevated role
 * For routes where users can only access their own resources
 * Staff roles (ADMIN, HR, etc.) can bypass based on allowedBypassRoles
 */
export function ownershipGuard(
  getResourceOwnerId: (req: AuthenticatedRequest) => string | Promise<string>,
  allowedBypassRoles: string[] = [ROLES.ADMIN]
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER can access anything
    if (req.user.role === ROLES.FOUNDER) {
      next();
      return;
    }

    // Check if user's role allows bypass
    if (allowedBypassRoles.includes(req.user.role)) {
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

// ============================================
// TEAM GUARD (FOR TEAM LEADS)
// ============================================

/**
 * Allow access to own team members or higher roles
 * Team leads can only access their team members
 */
export function teamGuard(
  getResourceUserId: (req: AuthenticatedRequest) => string | Promise<string>,
  getTeamMemberIds: (teamLeadId: string) => string[] | Promise<string[]>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required"
      });
      return;
    }

    // FOUNDER and ADMIN can access anything
    if (req.user.role === ROLES.FOUNDER || req.user.role === ROLES.ADMIN) {
      next();
      return;
    }

    // HR can view all employees
    if (req.user.role === ROLES.HR) {
      next();
      return;
    }

    // COMPLIANCE can view all for auditing
    if (req.user.role === ROLES.COMPLIANCE) {
      next();
      return;
    }

    try {
      const resourceUserId = await getResourceUserId(req);

      // Users can always access their own resources
      if (resourceUserId === req.user.id) {
        next();
        return;
      }

      // Team leads can access their team members
      if (req.user.role === ROLES.TEAM_LEAD) {
        const teamMemberIds = await getTeamMemberIds(req.user.id);
        if (teamMemberIds.includes(resourceUserId)) {
          next();
          return;
        }
      }

      res.status(403).json({
        success: false,
        error: "You do not have permission to access this resource"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to verify team membership"
      });
    }
  };
}

// ============================================
// CONVENIENCE GUARDS
// ============================================

/** Require FOUNDER only */
export const founderOnly = roleGuard([ROLES.FOUNDER]);

/** Require ADMIN or FOUNDER */
export const adminOnly = roleGuard(ROLE_GROUPS.ADMINS);

/** Require HR access */
export const hrOnly = roleGuard(ROLE_GROUPS.HR_ACCESS);

/** Require COMPLIANCE access */
export const complianceOnly = roleGuard(ROLE_GROUPS.COMPLIANCE_ACCESS);

/** Require any internal staff (not clients) */
export const staffOnly = roleGuard(ROLE_GROUPS.STAFF);

/** Require case handler access */
export const caseHandlerOnly = roleGuard(ROLE_GROUPS.CASE_HANDLERS);

/** Require management access */
export const managementOnly = roleGuard(ROLE_GROUPS.MANAGEMENT);

/** Require financial access */
export const financialOnly = roleGuard(ROLE_GROUPS.FINANCIAL_ACCESS);

/** Require OPS layer access */
export const opsOnly = roleGuard(ROLE_GROUPS.OPS_ACCESS);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a role has access to a resource
 * Useful for conditional rendering in services
 */
export function hasAccess(userRole: string, allowedRoles: string[]): boolean {
  if (userRole === ROLES.FOUNDER) return true;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user can view financial data
 */
export function canViewFinancials(userRole: string): boolean {
  return hasAccess(userRole, ROLE_GROUPS.FINANCIAL_ACCESS);
}

/**
 * Check if user can view all employees
 */
export function canViewAllEmployees(userRole: string): boolean {
  return hasAccess(userRole, ROLE_GROUPS.EMPLOYEE_VIEWERS);
}

/**
 * Check if user can manage training
 */
export function canManageTraining(userRole: string): boolean {
  return hasAccess(userRole, ROLE_GROUPS.TRAINING_ADMIN);
}

/**
 * Check if user has OPS access
 */
export function hasOpsAccess(userRole: string): boolean {
  return hasAccess(userRole, ROLE_GROUPS.OPS_ACCESS);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const displayNames: Record<string, string> = {
    FOUNDER: "Founder",
    ADMIN: "Administrator",
    HR: "Human Resources",
    COMPLIANCE: "Compliance Officer",
    TEAM_LEAD: "Team Leader",
    EMPLOYEE: "Employee",
    CLIENT: "Client",
  };
  return displayNames[role] || role;
}
