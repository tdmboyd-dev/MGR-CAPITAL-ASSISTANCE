/**
 * Test Helpers
 *
 * Utility functions for creating test data and assertions.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

// =============================================================================
// JWT HELPERS
// =============================================================================

const TEST_JWT_SECRET = "test-jwt-secret-for-testing-only";
const TEST_REFRESH_SECRET = "test-refresh-secret-for-testing-only";

/**
 * Generate a test access token
 */
export function generateTestAccessToken(
  payload: {
    userId: string;
    email: string;
    role: string;
    tier?: string | null;
  },
  expiresInSeconds = 900 // 15 minutes
): string {
  return jwt.sign(
    { ...payload, type: "access" },
    TEST_JWT_SECRET,
    {
      expiresIn: expiresInSeconds,
      issuer: "mgr-capital",
      audience: "mgr-capital-app",
    }
  );
}

/**
 * Generate an expired test access token
 */
export function generateExpiredAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(
    { ...payload, type: "access" },
    TEST_JWT_SECRET,
    {
      expiresIn: -1, // Already expired
      issuer: "mgr-capital",
      audience: "mgr-capital-app",
    }
  );
}

/**
 * Generate a test refresh token (raw, unhashed)
 */
export function generateTestRefreshToken(): string {
  return crypto.randomBytes(64).toString("base64url");
}

/**
 * Hash a refresh token for storage comparison
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// =============================================================================
// DATE HELPERS
// =============================================================================

/**
 * Get a date N days from now
 */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Get a date N minutes from now
 */
export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Get a date N days ago
 */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// =============================================================================
// RANDOM DATA HELPERS
// =============================================================================

/**
 * Generate a random email
 */
export function randomEmail(): string {
  return `test-${crypto.randomBytes(8).toString("hex")}@example.com`;
}

/**
 * Generate a random ID
 */
export function randomId(): string {
  return `test-${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Generate a random case code
 */
export function randomCaseCode(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0");
  return `MGR-${year}-${num}`;
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Assert that a value is a valid JWT
 */
export function expectValidJwt(token: string): void {
  expect(token).toBeDefined();
  expect(typeof token).toBe("string");
  const parts = token.split(".");
  expect(parts.length).toBe(3);
}

/**
 * Assert that a value is a valid date
 */
export function expectValidDate(date: unknown): void {
  expect(date).toBeInstanceOf(Date);
  expect(isNaN((date as Date).getTime())).toBe(false);
}

/**
 * Assert that an object has required audit fields
 */
export function expectAuditFields(obj: unknown): void {
  expect(obj).toHaveProperty("createdAt");
  expect(obj).toHaveProperty("updatedAt");
}

// =============================================================================
// ASYNC HELPERS
// =============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxAttempts - 1) {
        await wait(delayMs);
      }
    }
  }
  throw lastError;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  generateTestAccessToken,
  generateExpiredAccessToken,
  generateTestRefreshToken,
  hashRefreshToken,
  daysFromNow,
  minutesFromNow,
  daysAgo,
  randomEmail,
  randomId,
  randomCaseCode,
  expectValidJwt,
  expectValidDate,
  expectAuditFields,
  wait,
  retry,
};
