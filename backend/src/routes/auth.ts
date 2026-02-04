/**
 * AUTH ROUTES — MGR CAPITAL ASSISTANCE
 * Production-ready authentication endpoints with JWT hardening
 *
 * SECURITY FEATURES:
 * - Short-lived access tokens (15 min)
 * - Long-lived refresh tokens (14 days) with rotation
 * - HttpOnly cookies for refresh tokens
 * - Rate limiting on auth endpoints
 * - Brute-force protection
 * - Audit logging
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { authService } from "../services/AuthService.js";
import { asyncHandler, AppError, Errors } from "../middleware/errorHandler.js";
import { AuditActions } from "../middleware/auditLogger.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { logger } from "../utils/logger.js";
import {
  isLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
  createPasswordResetToken,
  verifyPasswordResetToken,
  validatePasswordComplexity,
  sanitizeEmail,
  invalidateAllSessions,
} from "../utils/security.js";
import { notificationService } from "../services/notificationService.js";

const router = Router();
const prisma = new PrismaClient();

// Cookie name for refresh token
const REFRESH_COOKIE_NAME = "mgr_refresh";

// =============================================================================
// LOGIN — Issue access + refresh tokens
// =============================================================================

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw Errors.badRequest("Email and password required");
    }

    const normalizedEmail = sanitizeEmail(email);
    const identifier = `${normalizedEmail}:${req.ip}`;

    // Check brute-force lockout
    const lockoutStatus = isLockedOut(identifier);
    if (lockoutStatus.locked) {
      const minutesRemaining = Math.ceil(lockoutStatus.remainingMs / 60000);
      // Pass undefined for failed attempts to avoid foreign key violation
      await AuditActions.login(undefined as any, false, req);
      throw new AppError(
        "Account locked",
        429,
        `Too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`
      );
    }

    // Attempt login
    const result = await authService.login(
      normalizedEmail,
      password,
      req.get("User-Agent"),
      req.ip
    );

    if (!result.success || !result.tokens || !result.user) {
      recordFailedLogin(identifier);
      // Pass undefined instead of "unknown" to avoid foreign key constraint violation
      await AuditActions.login(undefined as any, false, req);
      throw Errors.unauthorized();
    }

    // Clear failed attempts on success
    clearLoginAttempts(identifier);

    // Log successful login
    await AuditActions.login(result.user.id, true, req);

    // Set refresh token in HttpOnly cookie
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.tokens.refreshToken,
      authService.getRefreshTokenCookieOptions()
    );

    // Return access token and user info
    res.json({
      success: true,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessExpiresAt,
      user: result.user,
    });
  })
);

// =============================================================================
// REFRESH — Rotate refresh token, issue new access token
// =============================================================================

router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new AppError(
        "No refresh token",
        401,
        "Refresh token not found. Please log in again."
      );
    }

    // Rotate token
    const result = await authService.rotateRefreshToken(
      refreshToken,
      req.get("User-Agent"),
      req.ip
    );

    if (!result.success || !result.tokens) {
      // Clear invalid cookie (must match sameSite/secure settings)
      res.clearCookie(REFRESH_COOKIE_NAME, {
        path: "/api/auth",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production",
      });
      throw new AppError(
        "Invalid refresh token",
        401,
        result.error || "Refresh token is invalid or expired. Please log in again."
      );
    }

    // Set new refresh token in cookie
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.tokens.refreshToken,
      authService.getRefreshTokenCookieOptions()
    );

    // Return new access token
    res.json({
      success: true,
      accessToken: result.tokens.accessToken,
      expiresAt: result.tokens.accessExpiresAt,
    });
  })
);

// =============================================================================
// LOGOUT — Revoke refresh token
// =============================================================================

router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    // Also handle legacy Bearer token logout
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.substring(7);
      const decoded = authService.verifyAccessToken(accessToken);
      if (decoded) {
        await AuditActions.logout(decoded.userId, req);
      }
    }

    // Clear refresh cookie (must match sameSite/secure settings)
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: "/api/auth",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  })
);

// =============================================================================
// LOGOUT ALL — Revoke all refresh tokens for user
// =============================================================================

router.post(
  "/logout-all",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const count = await authService.revokeAllUserTokens(req.user.id);

    // Also invalidate legacy sessions
    await invalidateAllSessions(req.user.id);

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "LOGOUT_ALL_SESSIONS",
        entityType: "User",
        entityId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        details: { tokensRevoked: count },
      },
    });

    // Clear refresh cookie (must match sameSite/secure settings)
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: "/api/auth",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      success: true,
      message: `Logged out of all ${count} session${count === 1 ? "" : "s"}`,
    });
  })
);

// =============================================================================
// GET CURRENT USER
// =============================================================================

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        isActive: true,
        employeeTier: true,
        trainingCompleted: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError("User inactive", 401, "Your account is no longer active.");
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        tier: user.employeeTier,
        trainingCompleted: user.trainingCompleted,
      },
    });
  })
);

// =============================================================================
// GET ACTIVE SESSIONS
// =============================================================================

router.get(
  "/sessions",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const sessions = await authService.getUserActiveTokens(req.user.id);

    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    });
  })
);

// =============================================================================
// CHANGE PASSWORD
// =============================================================================

router.post(
  "/change-password",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw Errors.badRequest("Current password and new password required");
    }

    // Password complexity requirements
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      throw Errors.badRequest(validation.errors.join(". "));
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw Errors.notFound("User");
    }

    // Verify current password
    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new AppError("Wrong password", 401, "Current password is incorrect");
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens except current
    await authService.revokeAllUserTokens(user.id);

    // Also invalidate legacy sessions
    await prisma.userSession.deleteMany({
      where: { userId: user.id },
    });

    // Log password change
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_CHANGE",
        entityType: "User",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Password changed", { userId: user.id });

    res.json({
      success: true,
      message: "Password changed successfully. Please log in again on all devices.",
    });
  })
);

// =============================================================================
// REQUEST PASSWORD RESET
// =============================================================================

router.post(
  "/request-password-reset",
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw Errors.badRequest("Email required");
    }

    const normalizedEmail = sanitizeEmail(email);

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (user && user.isActive) {
      const { token, expiresAt } = await createPasswordResetToken(user.id);

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "User",
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          details: { expiresAt: expiresAt.toISOString() },
        },
      });

      // Send password reset email
      const emailResult = await notificationService.sendPasswordResetEmail({
        to: user.email,
        toName: user.name || undefined,
        userId: user.id,
        resetToken: token,
        expiresAt,
      });

      logger.info("Password reset email sent", {
        userId: user.id,
        email: user.email,
        emailSent: emailResult.success,
        notificationId: emailResult.notificationId,
      });
    }

    res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link will be sent.",
    });
  })
);

// =============================================================================
// RESET PASSWORD
// =============================================================================

router.post(
  "/reset-password",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, token, newPassword } = req.body;

    if (!userId || !token || !newPassword) {
      throw Errors.badRequest("User ID, token, and new password required");
    }

    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      throw Errors.badRequest(validation.errors.join(". "));
    }

    const isValid = await verifyPasswordResetToken(userId, token);
    if (!isValid) {
      throw new AppError(
        "Invalid or expired token",
        400,
        "Password reset link is invalid or has expired. Please request a new one."
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all tokens for security
    await authService.revokeAllUserTokens(userId);
    await invalidateAllSessions(userId);

    await prisma.auditLog.create({
      data: {
        userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: userId,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Password reset completed", { userId });

    res.json({
      success: true,
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });
  })
);

export default router;
