// ============================================
// SECURITY UTILITIES — MGR CAPITAL ASSISTANCE
// Rate limiting, brute-force protection, token generation
// ============================================

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// RATE LIMITING / BRUTE FORCE PROTECTION
// ============================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

// In-memory store for login attempts (production should use Redis)
const loginAttempts = new Map<string, LoginAttempt>();

// Configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if IP/email is currently locked out
 */
export function isLockedOut(identifier: string): { locked: boolean; remainingMs: number } {
  const attempt = loginAttempts.get(identifier);

  if (!attempt || !attempt.lockedUntil) {
    return { locked: false, remainingMs: 0 };
  }

  const now = Date.now();
  if (now < attempt.lockedUntil) {
    return { locked: true, remainingMs: attempt.lockedUntil - now };
  }

  // Lockout expired, reset
  loginAttempts.delete(identifier);
  return { locked: false, remainingMs: 0 };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(identifier: string): { locked: boolean; attemptsRemaining: number } {
  const now = Date.now();
  let attempt = loginAttempts.get(identifier);

  if (!attempt || (now - attempt.firstAttempt > ATTEMPT_WINDOW_MS)) {
    // First attempt or window expired
    attempt = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    attempt.count++;
  }

  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(identifier, attempt);
    return { locked: true, attemptsRemaining: 0 };
  }

  loginAttempts.set(identifier, attempt);
  return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - attempt.count };
}

/**
 * Clear login attempts on successful login
 */
export function clearLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

// ============================================
// SECURE TOKEN GENERATION
// ============================================

/**
 * Generate a cryptographically secure token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a password reset token with expiration
 */
export async function createPasswordResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Hash the token before storing (so even DB access can't use it)
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Store in SystemConfig (or could create a PasswordResetToken model)
  await prisma.systemConfig.upsert({
    where: { key: `password_reset_${userId}` },
    update: {
      value: JSON.stringify({ tokenHash, expiresAt: expiresAt.toISOString(), used: false })
    },
    create: {
      key: `password_reset_${userId}`,
      value: JSON.stringify({ tokenHash, expiresAt: expiresAt.toISOString(), used: false }),
      description: "Password reset token"
    }
  });

  return { token, expiresAt };
}

/**
 * Verify and consume a password reset token
 */
export async function verifyPasswordResetToken(userId: string, token: string): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: `password_reset_${userId}` }
  });

  if (!config) return false;

  try {
    const data = JSON.parse(config.value);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (data.tokenHash !== tokenHash) return false;
    if (data.used) return false;
    if (new Date(data.expiresAt) < new Date()) return false;

    // Mark as used
    await prisma.systemConfig.update({
      where: { key: `password_reset_${userId}` },
      data: { value: JSON.stringify({ ...data, used: true }) }
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate email verification token
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateSecureToken(32);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.systemConfig.upsert({
    where: { key: `email_verify_${userId}` },
    update: {
      value: JSON.stringify({ tokenHash, expiresAt: expiresAt.toISOString() })
    },
    create: {
      key: `email_verify_${userId}`,
      value: JSON.stringify({ tokenHash, expiresAt: expiresAt.toISOString() }),
      description: "Email verification token"
    }
  });

  return token;
}

/**
 * Verify email verification token
 */
export async function verifyEmailToken(userId: string, token: string): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: `email_verify_${userId}` }
  });

  if (!config) return false;

  try {
    const data = JSON.parse(config.value);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (data.tokenHash !== tokenHash) return false;
    if (new Date(data.expiresAt) < new Date()) return false;

    // Delete token after use
    await prisma.systemConfig.delete({ where: { key: `email_verify_${userId}` } });

    // Mark user as verified
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true }
    });

    return true;
  } catch {
    return false;
  }
}

// ============================================
// SESSION VALIDATION
// ============================================

/**
 * Validate that a session is still active in the database
 */
export async function validateSession(token: string): Promise<{ valid: boolean; userId?: string }> {
  const session = await prisma.userSession.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    },
    select: { userId: true }
  });

  return {
    valid: !!session,
    userId: session?.userId
  };
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllSessions(userId: string): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: { userId }
  });
  return result.count;
}

/**
 * Invalidate a specific session
 */
export async function invalidateSession(token: string): Promise<boolean> {
  const result = await prisma.userSession.deleteMany({
    where: { token }
  });
  return result.count > 0;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
  return result.count;
}

// ============================================
// PASSWORD VALIDATION
// ============================================

interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password complexity
 */
export function validatePasswordComplexity(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for common passwords
  const commonPasswords = ["password", "12345678", "qwerty123", "password123"];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    errors.push("Password is too common");
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 1000); // Limit length
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") return "";
  return email.toLowerCase().trim().slice(0, 255);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
