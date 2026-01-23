/**
 * AuthService Unit Tests
 *
 * Tests for JWT token generation, refresh rotation, revocation, and theft detection.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Mock Prisma before importing AuthService
const mockPrismaRefreshToken = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrisma = {
  refreshToken: mockPrismaRefreshToken,
  user: mockPrismaUser,
  $transaction: jest.fn(),
};

jest.unstable_mockModule("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  UserRole: {
    FOUNDER: "FOUNDER",
    EMPLOYEE: "EMPLOYEE",
    CLIENT: "CLIENT",
  },
  EmployeeTier: {
    TIER_1_ASSOCIATE: "TIER_1_ASSOCIATE",
    TIER_2_SENIOR: "TIER_2_SENIOR",
    TIER_3_LEAD: "TIER_3_LEAD",
  },
}));

// Mock config
jest.unstable_mockModule("../config/env.js", () => ({
  config: {
    jwtSecret: "test-jwt-secret-for-testing-only",
    jwtRefreshSecret: "test-refresh-secret-for-testing-only",
    jwtAccessExpiryMinutes: 15,
    jwtRefreshExpiryDays: 14,
    cookieSecure: false,
    cookieDomain: undefined,
  },
}));

// Mock logger
jest.unstable_mockModule("../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
const { authService } = await import("../../src/services/AuthService.js");

describe("AuthService", () => {
  const testUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "EMPLOYEE" as const,
    employeeTier: "TIER_1_ASSOCIATE" as const,
    isActive: true,
    passwordHash: "$2b$12$test.hash.here",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // ACCESS TOKEN TESTS
  // ===========================================================================

  describe("generateAccessToken", () => {
    it("should generate a valid JWT access token", () => {
      const result = authService.generateAccessToken(testUser);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify token structure
      const parts = result.token.split(".");
      expect(parts.length).toBe(3);
    });

    it("should include correct payload in token", () => {
      const result = authService.generateAccessToken(testUser);

      const decoded = jwt.decode(result.token) as Record<string, unknown>;

      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.tier).toBe(testUser.employeeTier);
      expect(decoded.type).toBe("access");
      expect(decoded.iss).toBe("mgr-capital");
      expect(decoded.aud).toBe("mgr-capital-app");
    });

    it("should set expiration approximately 15 minutes from now", () => {
      const before = Date.now();
      const result = authService.generateAccessToken(testUser);
      const after = Date.now();

      const expectedMinExpiry = before + 15 * 60 * 1000;
      const expectedMaxExpiry = after + 15 * 60 * 1000;

      const expiryTime = result.expiresAt.getTime();
      expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry - 1000);
      expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry + 1000);
    });

    it("should handle user without employeeTier", () => {
      const founderUser = {
        id: "founder-123",
        email: "founder@example.com",
        role: "FOUNDER" as const,
        employeeTier: null,
      };

      const result = authService.generateAccessToken(founderUser);
      const decoded = jwt.decode(result.token) as Record<string, unknown>;

      expect(decoded.tier).toBeNull();
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const { token } = authService.generateAccessToken(testUser);

      const result = authService.verifyAccessToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(testUser.id);
      expect(result?.email).toBe(testUser.email);
      expect(result?.role).toBe(testUser.role);
      expect(result?.type).toBe("access");
    });

    it("should return null for expired token", () => {
      const expiredToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", role: "EMPLOYEE", type: "access" },
        "test-jwt-secret-for-testing-only",
        { expiresIn: -1, issuer: "mgr-capital", audience: "mgr-capital-app" }
      );

      const result = authService.verifyAccessToken(expiredToken);

      expect(result).toBeNull();
    });

    it("should return null for invalid signature", () => {
      const badToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", role: "EMPLOYEE", type: "access" },
        "wrong-secret",
        { expiresIn: 900, issuer: "mgr-capital", audience: "mgr-capital-app" }
      );

      const result = authService.verifyAccessToken(badToken);

      expect(result).toBeNull();
    });

    it("should return null for wrong issuer", () => {
      const badIssuerToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", role: "EMPLOYEE", type: "access" },
        "test-jwt-secret-for-testing-only",
        { expiresIn: 900, issuer: "wrong-issuer", audience: "mgr-capital-app" }
      );

      const result = authService.verifyAccessToken(badIssuerToken);

      expect(result).toBeNull();
    });

    it("should return null for wrong audience", () => {
      const badAudienceToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", role: "EMPLOYEE", type: "access" },
        "test-jwt-secret-for-testing-only",
        { expiresIn: 900, issuer: "mgr-capital", audience: "wrong-audience" }
      );

      const result = authService.verifyAccessToken(badAudienceToken);

      expect(result).toBeNull();
    });

    it("should return null for refresh token type", () => {
      const refreshTypeToken = jwt.sign(
        { userId: "user-123", email: "test@example.com", role: "EMPLOYEE", type: "refresh" },
        "test-jwt-secret-for-testing-only",
        { expiresIn: 900, issuer: "mgr-capital", audience: "mgr-capital-app" }
      );

      const result = authService.verifyAccessToken(refreshTypeToken);

      expect(result).toBeNull();
    });

    it("should return null for malformed token", () => {
      const result = authService.verifyAccessToken("not.a.valid.jwt.token");

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // REFRESH TOKEN TESTS
  // ===========================================================================

  describe("generateRefreshToken", () => {
    it("should generate a refresh token and store hash in DB", async () => {
      mockPrismaRefreshToken.create.mockResolvedValue({ id: "token-123" });

      const result = await authService.generateRefreshToken(
        testUser.id,
        "Mozilla/5.0",
        "127.0.0.1"
      );

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify DB was called with hashed token
      expect(mockPrismaRefreshToken.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrismaRefreshToken.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(createCall.data.userId).toBe(testUser.id);
      expect(createCall.data.hashedToken).toBeDefined();
      expect(createCall.data.hashedToken).not.toBe(result.token); // Should be hashed
      expect(createCall.data.userAgent).toBe("Mozilla/5.0");
      expect(createCall.data.ipAddress).toBe("127.0.0.1");
    });

    it("should store SHA256 hash, not raw token", async () => {
      mockPrismaRefreshToken.create.mockResolvedValue({ id: "token-123" });

      const result = await authService.generateRefreshToken(testUser.id);

      const createCall = mockPrismaRefreshToken.create.mock.calls[0][0] as { data: Record<string, unknown> };
      const storedHash = createCall.data.hashedToken as string;

      // Verify it's a valid SHA256 hex string (64 chars)
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify the hash matches
      const expectedHash = crypto.createHash("sha256").update(result.token).digest("hex");
      expect(storedHash).toBe(expectedHash);
    });

    it("should set expiration approximately 14 days from now", async () => {
      mockPrismaRefreshToken.create.mockResolvedValue({ id: "token-123" });

      const before = Date.now();
      const result = await authService.generateRefreshToken(testUser.id);
      const after = Date.now();

      const expectedMinExpiry = before + 14 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = after + 14 * 24 * 60 * 60 * 1000;

      const expiryTime = result.expiresAt.getTime();
      expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry - 1000);
      expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry + 1000);
    });
  });

  describe("verifyRefreshToken", () => {
    it("should return valid for existing unrevoked token", async () => {
      const rawToken = crypto.randomBytes(64).toString("base64url");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockPrismaRefreshToken.findFirst.mockResolvedValue({
        id: "token-123",
        userId: testUser.id,
        hashedToken,
      });

      const result = await authService.verifyRefreshToken(rawToken);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(testUser.id);
      expect(result.tokenId).toBe("token-123");
    });

    it("should return invalid for non-existent token", async () => {
      mockPrismaRefreshToken.findFirst.mockResolvedValue(null);

      const result = await authService.verifyRefreshToken("non-existent-token");

      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
    });

    it("should detect theft and revoke all tokens on reuse of rotated token", async () => {
      const oldToken = crypto.randomBytes(64).toString("base64url");

      // First call: no valid token found
      mockPrismaRefreshToken.findFirst
        .mockResolvedValueOnce(null)
        // Second call: find the revoked token
        .mockResolvedValueOnce({
          id: "old-token-123",
          userId: testUser.id,
          revokedAt: new Date(),
        });

      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await authService.verifyRefreshToken(oldToken);

      expect(result.valid).toBe(false);

      // Should have revoked all user tokens
      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  // ===========================================================================
  // TOKEN ROTATION TESTS
  // ===========================================================================

  describe("rotateRefreshToken", () => {
    it("should rotate valid token and return new token pair", async () => {
      const oldRawToken = crypto.randomBytes(64).toString("base64url");
      const oldHashedToken = crypto.createHash("sha256").update(oldRawToken).digest("hex");

      mockPrismaRefreshToken.findFirst.mockResolvedValue({
        id: "old-token-123",
        userId: testUser.id,
        hashedToken: oldHashedToken,
        user: testUser,
      });

      const newTokenRecord = { id: "new-token-456" };
      mockPrisma.$transaction.mockResolvedValue([{}, newTokenRecord]);
      mockPrismaRefreshToken.update.mockResolvedValue({});

      const result = await authService.rotateRefreshToken(
        oldRawToken,
        "Mozilla/5.0",
        "192.168.1.1"
      );

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.accessToken).toBeDefined();
      expect(result.tokens?.refreshToken).toBeDefined();
      expect(result.tokens?.refreshToken).not.toBe(oldRawToken);
    });

    it("should return error for invalid token", async () => {
      mockPrismaRefreshToken.findFirst.mockResolvedValue(null);

      const result = await authService.rotateRefreshToken("invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired refresh token");
    });

    it("should return error for disabled user account", async () => {
      const oldRawToken = crypto.randomBytes(64).toString("base64url");
      const oldHashedToken = crypto.createHash("sha256").update(oldRawToken).digest("hex");

      mockPrismaRefreshToken.findFirst.mockResolvedValue({
        id: "old-token-123",
        userId: testUser.id,
        hashedToken: oldHashedToken,
        user: { ...testUser, isActive: false },
      });

      const result = await authService.rotateRefreshToken(oldRawToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Account is disabled");
    });

    it("should mark old token as rotated", async () => {
      const oldRawToken = crypto.randomBytes(64).toString("base64url");
      const oldHashedToken = crypto.createHash("sha256").update(oldRawToken).digest("hex");

      mockPrismaRefreshToken.findFirst.mockResolvedValue({
        id: "old-token-123",
        userId: testUser.id,
        hashedToken: oldHashedToken,
        user: testUser,
      });

      const newTokenRecord = { id: "new-token-456" };
      mockPrisma.$transaction.mockResolvedValue([{}, newTokenRecord]);
      mockPrismaRefreshToken.update.mockResolvedValue({});

      await authService.rotateRefreshToken(oldRawToken);

      // Verify transaction was called to mark old token rotated
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify replacedById was set
      expect(mockPrismaRefreshToken.update).toHaveBeenCalledWith({
        where: { id: "old-token-123" },
        data: { replacedById: "new-token-456" },
      });
    });
  });

  // ===========================================================================
  // LOGIN TESTS
  // ===========================================================================

  describe("login", () => {
    const validPassword = "SecurePass123!";

    beforeEach(async () => {
      const hash = await bcrypt.hash(validPassword, 12);
      mockPrismaUser.findUnique.mockResolvedValue({
        ...testUser,
        passwordHash: hash,
      });
      mockPrismaUser.update.mockResolvedValue({});
      mockPrismaRefreshToken.create.mockResolvedValue({ id: "token-123" });
    });

    it("should return tokens and user for valid credentials", async () => {
      const result = await authService.login(
        testUser.email,
        validPassword,
        "Mozilla/5.0",
        "127.0.0.1"
      );

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(testUser.id);
      expect(result.user?.email).toBe(testUser.email);
    });

    it("should normalize email to lowercase and trim", async () => {
      await authService.login("  TEST@EXAMPLE.COM  ", validPassword);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        select: expect.any(Object),
      });
    });

    it("should return error for non-existent user", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await authService.login("nonexistent@example.com", "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should return error for wrong password", async () => {
      const result = await authService.login(testUser.email, "WrongPassword123!");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should return error for disabled account", async () => {
      const hash = await bcrypt.hash(validPassword, 12);
      mockPrismaUser.findUnique.mockResolvedValue({
        ...testUser,
        passwordHash: hash,
        isActive: false,
      });

      const result = await authService.login(testUser.email, validPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Account is disabled");
    });

    it("should update lastLoginAt on successful login", async () => {
      await authService.login(testUser.email, validPassword);

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: testUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  // ===========================================================================
  // REVOCATION TESTS
  // ===========================================================================

  describe("revokeRefreshToken", () => {
    it("should revoke a specific token", async () => {
      const rawToken = crypto.randomBytes(64).toString("base64url");
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await authService.revokeRefreshToken(rawToken);

      expect(result).toBe(true);
      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          hashedToken: expect.any(String),
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should return false if token not found", async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await authService.revokeRefreshToken("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all tokens for a user", async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 5 });

      const result = await authService.revokeAllUserTokens(testUser.id);

      expect(result).toBe(5);
      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  // ===========================================================================
  // UTILITY TESTS
  // ===========================================================================

  describe("getUserActiveTokens", () => {
    it("should return list of active tokens", async () => {
      const mockTokens = [
        {
          userId: testUser.id,
          userAgent: "Chrome",
          ipAddress: "192.168.1.1",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
        },
        {
          userId: testUser.id,
          userAgent: "Firefox",
          ipAddress: "192.168.1.2",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
        },
      ];

      mockPrismaRefreshToken.findMany.mockResolvedValue(mockTokens);

      const result = await authService.getUserActiveTokens(testUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].userAgent).toBe("Chrome");
      expect(result[0].isRevoked).toBe(false);
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired and old revoked/rotated tokens", async () => {
      mockPrismaRefreshToken.deleteMany.mockResolvedValue({ count: 10 });

      const result = await authService.cleanupExpiredTokens();

      expect(result).toBe(10);
      expect(mockPrismaRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { lt: expect.any(Date) } },
            { rotatedAt: { lt: expect.any(Date) } },
          ]),
        },
      });
    });
  });

  describe("getRefreshTokenCookieOptions", () => {
    it("should return secure cookie options", () => {
      const options = authService.getRefreshTokenCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("strict");
      expect(options.path).toBe("/api/auth");
      expect(options.maxAge).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });
});
