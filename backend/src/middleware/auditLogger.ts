// ============================================
// AUDIT LOGGER MIDDLEWARE — MGR CAPITAL ASSISTANCE
// Logs all API requests for compliance and security
// ============================================

import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

interface AuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Map HTTP methods to action types
function getActionFromMethod(method: string, path: string): string {
  // Special cases
  if (path.includes("/auth/login")) return "LOGIN";
  if (path.includes("/auth/logout")) return "LOGOUT";
  if (path.includes("/auth/register")) return "REGISTER";

  // General mapping
  switch (method) {
    case "GET":
      return "VIEW";
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return method;
  }
}

// Get entity type from path
function getEntityFromPath(path: string): string {
  const segments = path.split("/").filter(Boolean);

  // Skip "api" prefix if present
  const entitySegment = segments[0] === "api" ? segments[1] : segments[0];

  // Map common paths to entity types
  const entityMap: Record<string, string> = {
    auth: "Authentication",
    cases: "Case",
    employees: "Employee",
    clients: "Client",
    payouts: "Payout",
    training: "Training",
    ingestion: "Ingestion",
    settings: "Settings",
    documents: "Document",
  };

  return entityMap[entitySegment] || entitySegment || "Unknown";
}

// Get entity ID from path
function getEntityIdFromPath(path: string): string | undefined {
  const segments = path.split("/").filter(Boolean);

  // Look for UUID-like patterns or specific IDs
  for (const segment of segments) {
    // CUID pattern (Prisma default)
    if (/^c[a-z0-9]{24,}$/i.test(segment)) {
      return segment;
    }
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return segment;
    }
  }

  return undefined;
}

// Create audit log entry
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error("Failed to create audit log:", error);
  }
}

// Middleware to automatically log requests
export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for certain paths
  const skipPaths = ["/health", "/favicon.ico", "/api/audit"];
  if (skipPaths.some((p) => req.path.includes(p))) {
    return next();
  }

  // Capture original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;
  let responseSent = false;

  // Override send
  res.send = function (body): Response {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
    }
    return originalSend.call(this, body);
  };

  // Override json
  res.json = function (body): Response {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
    }
    return originalJson.call(this, body);
  };

  // Log after response is sent
  res.on("finish", async () => {
    const user = (req as any).user;
    const action = getActionFromMethod(req.method, req.path);
    const entityType = getEntityFromPath(req.path);
    const entityId = getEntityIdFromPath(req.path);

    // Determine success/failure from response
    let success = res.statusCode >= 200 && res.statusCode < 400;

    // Parse response body if it's JSON
    let parsedResponse: any;
    try {
      if (typeof responseBody === "string") {
        parsedResponse = JSON.parse(responseBody);
      } else {
        parsedResponse = responseBody;
      }
      if (parsedResponse && typeof parsedResponse.success === "boolean") {
        success = parsedResponse.success;
      }
    } catch {
      // Not JSON, that's ok
    }

    // Build details object
    const details: any = {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      statusCode: res.statusCode,
      success,
    };

    // Sanitize request body for logging (remove sensitive fields)
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      const sensitiveFields = ["password", "passwordHash", "token", "secret", "ssn4"];
      for (const field of sensitiveFields) {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = "[REDACTED]";
        }
      }
      details.requestBody = sanitizedBody;
    }

    // Create audit log
    await createAuditLog({
      userId: user?.id,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
}

// Helper to log specific actions with custom data
export async function logAction(
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId: string | undefined,
  details: any,
  req?: Request
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    entityType,
    entityId,
    details,
    ipAddress: req?.ip || req?.socket.remoteAddress,
    userAgent: req?.headers["user-agent"],
  });
}

// Specific logging functions for common actions
export const AuditActions = {
  async login(userId: string | undefined, success: boolean, req: Request): Promise<void> {
    await logAction(userId, success ? "LOGIN_SUCCESS" : "LOGIN_FAILED", "Authentication", undefined, { success }, req);
  },

  async logout(userId: string, req: Request): Promise<void> {
    await logAction(userId, "LOGOUT", "Authentication", undefined, {}, req);
  },

  async caseStatusChange(
    userId: string,
    caseId: string,
    oldStatus: string,
    newStatus: string,
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      "STATUS_CHANGE",
      "Case",
      caseId,
      { oldStatus, newStatus },
      req
    );
  },

  async payoutProcessed(
    userId: string,
    caseId: string,
    amountCents: number,
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      "PAYOUT_PROCESSED",
      "Payout",
      caseId,
      { amountCents },
      req
    );
  },

  async documentSigned(
    userId: string,
    documentId: string,
    caseId: string,
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      "DOCUMENT_SIGNED",
      "Document",
      documentId,
      { caseId },
      req
    );
  },

  async employeeTierChange(
    userId: string,
    employeeId: string,
    oldTier: string,
    newTier: string,
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      "TIER_CHANGE",
      "Employee",
      employeeId,
      { oldTier, newTier },
      req
    );
  },

  async sensitiveDataAccess(
    userId: string,
    entityType: string,
    entityId: string,
    fields: string[],
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      "SENSITIVE_ACCESS",
      entityType,
      entityId,
      { fieldsAccessed: fields },
      req
    );
  },

  async founderOverride(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: any,
    req?: Request
  ): Promise<void> {
    await logAction(
      userId,
      `FOUNDER_OVERRIDE_${action}`,
      entityType,
      entityId,
      details,
      req
    );
  },
};
