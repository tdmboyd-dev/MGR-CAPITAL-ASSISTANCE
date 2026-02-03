// ============================================
// GLOBAL ERROR HANDLER — MGR CAPITAL ASSISTANCE
// Masks internal errors, logs privately, returns safe messages
// ============================================

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

// Custom application error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public safeMessage: string;

  constructor(
    message: string,
    statusCode: number = 500,
    safeMessage?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.safeMessage = safeMessage || "An error occurred. Please try again.";
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common application errors
export const Errors = {
  unauthorized: () => new AppError("Unauthorized", 401, "Invalid credentials or session expired."),
  forbidden: (message?: string) => new AppError("Forbidden", 403, message || "You do not have permission to perform this action."),
  notFound: (resource: string) => new AppError(`${resource} not found`, 404, `${resource} not found.`),
  badRequest: (message: string) => new AppError(message, 400, message),
  conflict: (message: string) => new AppError(message, 409, message),
  internal: (details: string) => new AppError(details, 500, "An internal error occurred. Please try again later."),
};

// Determine if user should see full error details (FOUNDER only)
function canSeeFullErrors(req: Request): boolean {
  const user = (req as any).user;
  return user?.role === "FOUNDER";
}

// Format error for logging
function formatErrorLog(error: Error, req: Request): object {
  return {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id || "anonymous",
    userRole: (req as any).user?.role || "none",
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    body: sanitizeRequestBody(req.body),
    query: req.query,
    params: req.params,
  };
}

// Remove sensitive fields from request body for logging
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== "object") return body;

  const sanitized = { ...body };
  const sensitiveFields = ["password", "token", "secret", "apiKey", "creditCard"];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

// Get safe error message based on error type
function getSafeErrorMessage(error: Error): string {
  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return "A record with this information already exists.";
      case "P2025":
        return "The requested record was not found.";
      case "P2003":
        return "Invalid reference to related record.";
      default:
        return "A database error occurred. Please try again.";
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Invalid data provided. Please check your input.";
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Service temporarily unavailable. Please try again later.";
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return "Invalid authentication token.";
  }

  if (error.name === "TokenExpiredError") {
    return "Your session has expired. Please log in again.";
  }

  // Validation errors
  if (error.name === "ValidationError") {
    return "Invalid input data. Please check your submission.";
  }

  // Application errors
  if (error instanceof AppError) {
    return error.safeMessage;
  }

  // Default
  return "An unexpected error occurred. Please try again later.";
}

// Get status code from error
function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return 409; // Conflict
      case "P2025":
        return 404; // Not Found
      default:
        return 500;
    }
  }

  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    return 401;
  }

  if (error.name === "ValidationError") {
    return 400;
  }

  return 500;
}

// Global error handler middleware
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error details (private)
  const errorLog = formatErrorLog(error, req);
  console.error("=== ERROR LOG ===");
  console.error(JSON.stringify(errorLog, null, 2));
  console.error("=================");

  // Determine status code
  const statusCode = getStatusCode(error);

  // Determine what message to show
  const isFounder = canSeeFullErrors(req);
  let publicMessage: string;

  if (isFounder) {
    // Founder sees full error details
    publicMessage = error.message;
  } else {
    // Everyone else sees safe message
    publicMessage = getSafeErrorMessage(error);
  }

  // Send response in standard API format
  res.status(statusCode).json({
    success: false,
    error: publicMessage,
    ...(isFounder && {
      _debug: {
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 5),
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      },
    }),
  });
}

// Async handler wrapper to catch errors and pass to next()
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler for undefined routes
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
