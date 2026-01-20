// ============================================
// AUTH ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready authentication endpoints
// ============================================

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/env.js";
import { asyncHandler, AppError, Errors } from "../middleware/errorHandler.js";
import { AuditActions } from "../middleware/auditLogger.js";
import {
  isLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
  createPasswordResetToken,
  verifyPasswordResetToken,
  validatePasswordComplexity,
  sanitizeEmail,
  invalidateAllSessions
} from "../utils/security.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// LOGIN
// ============================================

router.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw Errors.badRequest("Email and password required");
  }

  const normalizedEmail = sanitizeEmail(email);
  const identifier = `${normalizedEmail}:${req.ip}`; // Combine email + IP for brute-force tracking

  // Check if locked out due to too many failed attempts
  const lockoutStatus = isLockedOut(identifier);
  if (lockoutStatus.locked) {
    const minutesRemaining = Math.ceil(lockoutStatus.remainingMs / 60000);
    await AuditActions.login("unknown", false, req);
    throw new AppError(
      "Account locked",
      429,
      `Too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`
    );
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      name: true,
      isActive: true,
      emailVerified: true,
      employeeTier: true
    }
  });

  // User not found - use generic message to prevent enumeration
  if (!user) {
    recordFailedLogin(identifier);
    await AuditActions.login("unknown", false, req);
    throw Errors.unauthorized();
  }

  // Account disabled
  if (!user.isActive) {
    recordFailedLogin(identifier);
    await AuditActions.login(user.id, false, req);
    throw new AppError("Account disabled", 403, "Account is disabled. Contact administrator.");
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    const result = recordFailedLogin(identifier);
    await AuditActions.login(user.id, false, req);

    if (result.locked) {
      throw new AppError(
        "Account locked",
        429,
        "Too many failed login attempts. Please try again in 15 minutes."
      );
    }

    throw Errors.unauthorized();
  }

  // Successful login - clear any failed attempts
  clearLoginAttempts(identifier);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // Create session token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.employeeTier
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );

  // Create session record
  await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  // Log successful login
  await AuditActions.login(user.id, true, req);

  // Return user data (without sensitive fields)
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tier: user.employeeTier
    }
  });
}));

// ============================================
// VERIFY TOKEN / GET CURRENT USER
// ============================================

router.get("/me", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("No token provided", 401, "Authentication required.");
  }

  const token = authHeader.substring(7);

  // Verify JWT
  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw new AppError("Invalid token", 401, "Your session has expired. Please log in again.");
  }

  // Check session exists and is valid
  const session = await prisma.userSession.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    }
  });

  if (!session) {
    throw new AppError("Session expired", 401, "Your session has expired. Please log in again.");
  }

  // Get fresh user data
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      phone: true,
      isActive: true,
      employeeTier: true,
      trainingCompleted: true
    }
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
      trainingCompleted: user.trainingCompleted
    }
  });
}));

// ============================================
// LOGOUT
// ============================================

router.post("/logout", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // Get user ID before deleting session for audit
    const session = await prisma.userSession.findFirst({
      where: { token },
      select: { userId: true }
    });

    // Delete session
    await prisma.userSession.deleteMany({
      where: { token }
    });

    // Log logout
    if (session?.userId) {
      await AuditActions.logout(session.userId, req);
    }
  }

  res.json({
    success: true,
    message: "Logged out successfully"
  });
}));

// ============================================
// CHANGE PASSWORD
// ============================================

router.post("/change-password", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Not authenticated", 401, "Authentication required.");
  }

  const token = authHeader.substring(7);
  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError("Invalid token", 401, "Your session has expired. Please log in again.");
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw Errors.badRequest("Current password and new password required");
  }

  // Password complexity requirements
  if (newPassword.length < 8) {
    throw Errors.badRequest("New password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(newPassword)) {
    throw Errors.badRequest("New password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(newPassword)) {
    throw Errors.badRequest("New password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(newPassword)) {
    throw Errors.badRequest("New password must contain at least one number");
  }

  // Get user with password hash
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, passwordHash: true }
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
    data: { passwordHash: newHash }
  });

  // Invalidate all sessions except current
  await prisma.userSession.deleteMany({
    where: {
      userId: user.id,
      token: { not: token }
    }
  });

  // Log password change (audit middleware will capture this, but explicit log is good)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_CHANGE",
      entityType: "User",
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent")
    }
  });

  res.json({
    success: true,
    message: "Password changed successfully"
  });
}));

// ============================================
// PASSWORD RESET — REQUEST RESET
// ============================================

router.post("/request-password-reset", asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw Errors.badRequest("Email required");
  }

  const normalizedEmail = sanitizeEmail(email);

  // Always return success to prevent email enumeration
  // But only create token if user exists
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, isActive: true }
  });

  if (user && user.isActive) {
    // Create reset token
    const { token, expiresAt } = await createPasswordResetToken(user.id);

    // Log the request
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        details: { expiresAt: expiresAt.toISOString() }
      }
    });

    // TODO: Send email with reset link
    // In production, this would send an email like:
    // https://app.mgrcapital.com/reset-password?userId=${user.id}&token=${token}
    console.log(`[DEV] Password reset token for ${user.email}: ${token}`);
  }

  // Always return success (prevents email enumeration)
  res.json({
    success: true,
    message: "If an account exists with this email, a password reset link will be sent."
  });
}));

// ============================================
// PASSWORD RESET — VERIFY & RESET
// ============================================

router.post("/reset-password", asyncHandler(async (req: Request, res: Response) => {
  const { userId, token, newPassword } = req.body;

  if (!userId || !token || !newPassword) {
    throw Errors.badRequest("User ID, token, and new password required");
  }

  // Validate password complexity
  const passwordValidation = validatePasswordComplexity(newPassword);
  if (!passwordValidation.valid) {
    throw Errors.badRequest(passwordValidation.errors.join(". "));
  }

  // Verify the reset token
  const isValid = await verifyPasswordResetToken(userId, token);
  if (!isValid) {
    throw new AppError(
      "Invalid or expired token",
      400,
      "Password reset link is invalid or has expired. Please request a new one."
    );
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash }
  });

  // Invalidate all existing sessions for security
  await invalidateAllSessions(userId);

  // Log the password reset
  await prisma.auditLog.create({
    data: {
      userId,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent")
    }
  });

  res.json({
    success: true,
    message: "Password has been reset successfully. Please log in with your new password."
  });
}));

// ============================================
// LOGOUT ALL SESSIONS
// ============================================

router.post("/logout-all", asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Not authenticated", 401, "Authentication required.");
  }

  const token = authHeader.substring(7);
  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError("Invalid token", 401, "Your session has expired. Please log in again.");
  }

  // Invalidate all sessions
  const count = await invalidateAllSessions(decoded.userId);

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: decoded.userId,
      action: "LOGOUT_ALL_SESSIONS",
      entityType: "User",
      entityId: decoded.userId,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      details: { sessionsInvalidated: count }
    }
  });

  res.json({
    success: true,
    message: `Logged out of ${count} session${count === 1 ? "" : "s"}`
  });
}));

export default router;
