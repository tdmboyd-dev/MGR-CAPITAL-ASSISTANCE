/**
 * tenantMiddleware.ts — MGR CAPITAL ASSISTANCE
 * Multi-tenant isolation middleware
 *
 * Sets tenant context based on authenticated user.
 * Provides Prisma extension for automatic tenant filtering.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "./authMiddleware.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// TYPES
// =============================================================================

export interface TenantContext {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  isSuperAdmin: boolean; // FOUNDER with no tenant = super admin
}

export interface TenantRequest extends AuthenticatedRequest {
  tenant?: TenantContext;
}

// =============================================================================
// TENANT-AWARE PRISMA CLIENT
// =============================================================================

const basePrisma = new PrismaClient();

/**
 * Create a tenant-scoped Prisma client
 * Automatically filters queries by tenantId
 */
export function createTenantPrisma(tenantId: string | null): PrismaClient {
  if (!tenantId) {
    // No tenant = super admin, return base client
    return basePrisma;
  }

  // Create extended client with tenant filtering
  return basePrisma.$extends({
    query: {
      // User model
      user: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // Case model
      case: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // LedgerEntry model
      ledgerEntry: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // Document model
      document: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // TrainingModule model
      trainingModule: {
        async findMany({ args, query }) {
          // Training modules can be shared (null tenantId) or tenant-specific
          args.where = {
            ...args.where,
            OR: [{ tenantId }, { tenantId: null }],
          };
          return query(args);
        },
      },
      // ChatRoom model
      chatRoom: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // AuditLog model
      auditLog: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // OpsInsight model
      opsInsight: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      // WatchAlert model
      watchAlert: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Tenant middleware - extracts tenant context from authenticated user
 */
export async function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // If no authenticated user, skip tenant context
    if (!req.user) {
      req.tenant = {
        tenantId: null,
        tenantSlug: null,
        tenantName: null,
        isSuperAdmin: false,
      };
      return next();
    }

    // Get user with tenant info
    const user = await basePrisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        tenantId: true,
        role: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      req.tenant = {
        tenantId: null,
        tenantSlug: null,
        tenantName: null,
        isSuperAdmin: false,
      };
      return next();
    }

    // FOUNDER with no tenant = super admin (can access all tenants)
    const isSuperAdmin = user.role === "FOUNDER" && !user.tenantId;

    // Check if tenant is active
    if (user.tenant && !user.tenant.isActive) {
      res.status(403).json({
        success: false,
        error: "Your organization's account has been suspended.",
      });
      return;
    }

    req.tenant = {
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug || null,
      tenantName: user.tenant?.name || null,
      isSuperAdmin,
    };

    logger.debug("Tenant context set", {
      userId: user.id,
      tenantId: req.tenant.tenantId,
      isSuperAdmin,
    });

    next();
  } catch (error) {
    logger.error("Tenant middleware error", { error });
    next(error);
  }
}

/**
 * Require tenant - ensures user belongs to a tenant
 */
export function requireTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant?.tenantId && !req.tenant?.isSuperAdmin) {
    res.status(403).json({
      success: false,
      error: "This action requires an organization context.",
    });
    return;
  }
  next();
}

/**
 * Require super admin - ensures user is a super admin (FOUNDER without tenant)
 */
export function requireSuperAdmin(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant?.isSuperAdmin) {
    res.status(403).json({
      success: false,
      error: "This action requires super admin privileges.",
    });
    return;
  }
  next();
}

/**
 * Get tenant-scoped Prisma client from request
 */
export function getTenantPrisma(req: TenantRequest): PrismaClient {
  const tenantId = req.tenant?.isSuperAdmin ? null : req.tenant?.tenantId || null;
  return createTenantPrisma(tenantId);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { basePrisma };
export default tenantMiddleware;
