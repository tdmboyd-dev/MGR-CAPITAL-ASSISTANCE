/**
 * AuthService.ts
 *
 * Production-ready authentication service with JWT hardening.
 * Implements short-lived access tokens + long-lived refresh tokens with rotation.
 *
 * SECURITY FEATURES:
 * - Access tokens: 15 min expiry (configurable)
 * - Refresh tokens: 14 day expiry (configurable)
 * - Refresh token rotation (old token invalidated on use)
 * - SHA256 hashed token storage (never store raw tokens)
 * - HttpOnly, Secure, SameSite=Strict cookies for refresh tokens
 * - Token revocation on logout/password change
 * - Device/IP tracking for security audit
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { User, UserRole, EmployeeTier } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// TYPES
// =============================================================================

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tier?: EmployeeTier | null;
  type: "access" | "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface LoginResult {
  success: boolean;
  tokens?: AuthTokens;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tier?: EmployeeTier | null;
  };
  error?: string;
}

export interface RefreshResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
}

export interface TokenInfo {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Hash a token using SHA256
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(64).toString("base64url");
}

/**
 * Get access token expiry date
 */
function getAccessExpiryDate(): Date {
  const minutes = config.jwtAccessExpiryMinutes;
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Get refresh token expiry date
 */
function getRefreshExpiryDate(): Date {
  const days = config.jwtRefreshExpiryDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// =============================================================================
// AUTH SERVICE CLASS
// =============================================================================

class AuthService {
  /**
   * Generate an access token (JWT)
   */
  generateAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
    employeeTier?: EmployeeTier | null;
  }): { token: string; expiresAt: Date } {
    const expiresAt = getAccessExpiryDate();
    const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.employeeTier,
      type: "access",
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: expiresInSeconds,
      issuer: "mgr-capital",
      audience: "mgr-capital-app",
    });

    return { token, expiresAt };
  }

  /**
   * Generate a refresh token and store hashed in DB
   */
  async generateRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);
    const expiresAt = getRefreshExpiryDate();

    await prisma.refreshToken.create({
      data: {
        userId,
        hashedToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { token: rawToken, expiresAt };
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokenPair(
    user: {
      id: string;
      email: string;
      role: UserRole;
      employeeTier?: EmployeeTier | null;
    },
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const { token: accessToken, expiresAt: accessExpiresAt } =
      this.generateAccessToken(user);
    const { token: refreshToken, expiresAt: refreshExpiresAt } =
      await this.generateRefreshToken(user.id, userAgent, ipAddress);

    return {
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    };
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
        algorithms: ["HS256"],
      }) as TokenPayload & { iat: number; exp: number };

      if (decoded.type !== "access" || typeof decoded.userId !== "string" || !decoded.userId || decoded.userId.length > 200 ||
        typeof decoded.email !== "string" || !decoded.email || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now() / 1000) {
        return null;
      }

      return decoded;
    } catch {
      return null;
    }
  }

  /** JWT establishes identity only; permissions come from the current account. */
  async resolveAccessToken(token: string): Promise<TokenPayload | null> {
    const decoded = this.verifyAccessToken(token);
    if (!decoded) return null;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId },
      select: { id: true, email: true, role: true, employeeTier: true, isActive: true } });
    if (!user?.isActive) return null;
    return { userId: user.id, email: user.email, role: user.role, tier: user.employeeTier, type: "access" };
  }

  /**
   * Verify a refresh token and return the stored record
   */
  async verifyRefreshToken(
    rawToken: string
  ): Promise<{ valid: boolean; userId?: string; tokenId?: string }> {
    const hashedToken = hashToken(rawToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        hashedToken,
        revokedAt: null,
        rotatedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      // Check if this is a rotated/revoked token (potential theft detection)
      const revokedToken = await prisma.refreshToken.findFirst({
        where: { hashedToken },
      });

      if (revokedToken) {
        logger.warn("Attempted use of revoked/rotated refresh token", {
          userId: revokedToken.userId,
          tokenId: revokedToken.id,
        });

        // Security: If a rotated token is reused, revoke the entire token family
        await this.revokeAllUserTokens(revokedToken.userId);
      }

      return { valid: false };
    }

    return {
      valid: true,
      userId: storedToken.userId,
      tokenId: storedToken.id,
    };
  }

  /**
   * Rotate a refresh token (issue new one, invalidate old)
   */
  async rotateRefreshToken(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<RefreshResult> {
    const hashedToken = hashToken(rawToken);

    const newRawToken = generateSecureToken();
    const newHashedToken = hashToken(newRawToken);
    const newExpiresAt = getRefreshExpiryDate();
    const replacementId = crypto.randomUUID();
    // Compare-and-set consumes the predecessor once. Link, successor and signing
    // share one transaction; failure restores the predecessor, with no token issued.
    return prisma.$transaction(async (db) => {
      const stored = await db.refreshToken.findFirst({
        where: { hashedToken, revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, role: true, employeeTier: true, isActive: true } } },
      });
      if (!stored?.user.isActive) return { success: false, error: "Invalid or expired refresh token" };
      const claimed = await db.refreshToken.updateMany({
        where: { id: stored.id, hashedToken, revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true } },
        data: { rotatedAt: new Date(), replacedById: replacementId },
      });
      if (claimed.count !== 1) return { success: false, error: "Invalid or expired refresh token" };
      await db.refreshToken.create({ data: { id: replacementId, userId: stored.userId, hashedToken: newHashedToken,
        userAgent, ipAddress, expiresAt: newExpiresAt } });
      const access = this.generateAccessToken(stored.user);
      return { success: true, tokens: { accessToken: access.token, refreshToken: newRawToken,
        accessExpiresAt: access.expiresAt, refreshExpiresAt: newExpiresAt } };
    });
  }

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        employeeTier: true,
        isActive: true,
      },
    });

    if (!user) {
      return { success: false, error: "Invalid credentials" };
    }

    if (!user.isActive) {
      return { success: false, error: "Account is disabled" };
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return { success: false, error: "Invalid credentials" };
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token pair
    const tokens = await this.generateTokenPair(user, userAgent, ipAddress);

    logger.info("User logged in", { userId: user.id, email: user.email });

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tier: user.employeeTier,
      },
    };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(rawToken: string): Promise<boolean> {
    const hashedToken = hashToken(rawToken);

    const result = await prisma.refreshToken.updateMany({
      where: {
        hashedToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Revoke all refresh tokens for a user (logout everywhere)
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    logger.info("All refresh tokens revoked for user", {
      userId,
      count: result.count,
    });

    return result.count;
  }

  /**
   * Get all active tokens for a user (for security audit)
   */
  async getUserActiveTokens(userId: string): Promise<TokenInfo[]> {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        rotatedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        userId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return tokens.map((t) => ({
      userId: t.userId,
      userAgent: t.userAgent,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      isRevoked: t.revokedAt !== null,
    }));
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            revokedAt: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            },
          },
          {
            rotatedAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            },
          },
        ],
      },
    });

    if (result.count > 0) {
      logger.info("Cleaned up expired refresh tokens", { count: result.count });
    }

    return result.count;
  }

  /**
   * Get cookie options for refresh token
   * NOTE: For cross-origin setups (frontend on Vercel, backend on Render),
   * sameSite must be "none" with secure: true for cookies to work
   */
  getRefreshTokenCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    maxAge: number;
    path: string;
    domain?: string;
  } {
    // Cross-origin requires sameSite=none + secure=true
    const isProduction = config.nodeEnv === "production";
    const sameSite = (process.env.COOKIE_SAME_SITE as "strict" | "lax" | "none") ||
      (isProduction ? "none" : "strict");

    // Clean up domain - undefined, empty, or "''" should all be undefined
    let domain = config.cookieDomain;
    if (!domain || domain === "''" || domain === '""' || domain.trim() === "") {
      domain = undefined;
    }

    return {
      httpOnly: true,
      secure: isProduction ? true : config.cookieSecure, // Always secure in production for sameSite=none
      sameSite,
      maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
      path: "/api/auth",
      domain,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const authService = new AuthService();
export default authService;
