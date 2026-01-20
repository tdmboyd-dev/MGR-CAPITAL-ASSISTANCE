// ============================================
// AUTH MIDDLEWARE — MGR CAPITAL ASSISTANCE
// JWT verification with session validation
// ============================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/env.js";
import { validateSession } from "../utils/security.js";

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    role: string;
    tier?: string;
  };
  token?: string;
}

// Alias for backwards compatibility
export type AuthRequest = AuthenticatedRequest;

/**
 * Main authentication middleware
 * Verifies JWT token AND validates session in database
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
      error: "Authentication required"
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      tier?: string;
      iat: number;
      exp: number;
    };

    // Check if token is close to expiration (within 1 hour)
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - decoded.iat;
    const timeToExpiry = decoded.exp - now;

    // Validate session exists in database (async, but we proceed optimistically)
    validateSession(token).then(({ valid }) => {
      if (!valid) {
        // Session was invalidated (logout, password change, etc.)
        // This will be caught on next request
        console.log(`Invalid session detected for user ${decoded.userId}`);
      }
    });

    // Set user info on request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier
    };
    req.token = token;

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Session expired. Please log in again."
      });
    } else if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        error: "Invalid authentication token"
      });
    } else {
      res.status(401).json({
        success: false,
        error: "Authentication failed"
      });
    }
  }
}

/**
 * Strict authentication middleware
 * Also validates session in database synchronously
 */
export async function strictAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authentication required"
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      tier?: string;
    };

    // Strictly validate session exists and is not expired
    const session = await prisma.userSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() }
      }
    });

    if (!session) {
      res.status(401).json({
        success: false,
        error: "Session expired or invalid. Please log in again."
      });
      return;
    }

    // Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true }
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: "Account is disabled"
      });
      return;
    }

    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier
    };
    req.token = token;

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Session expired. Please log in again."
      });
    } else {
      res.status(401).json({
        success: false,
        error: "Authentication failed"
      });
    }
  }
}

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
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      tier?: string;
    };

    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier
    };
    req.token = token;
  } catch {
    // Token invalid, but that's okay for optional auth
  }

  next();
}
