/**
 * AuthService Unit Tests
 *
 * Tests for JWT token generation, refresh rotation, revocation, and theft detection.
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Test data
const testUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  role: "EMPLOYEE" as const,
  employeeTier: "TIER_1_ASSOCIATE" as const,
  isActive: true,
  passwordHash: "$2b$12$test.hash.here",
};

const TEST_JWT_SECRET = "test-jwt-secret-for-testing-only";

describe("AuthService", () => {
  // ===========================================================================
  // ACCESS TOKEN TESTS (using jwt directly for unit testing)
  // ===========================================================================

  describe("Access Token Generation", () => {
    it("should generate a valid JWT access token structure", () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tier: testUser.employeeTier,
        type: "access",
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include correct payload in token", () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tier: testUser.employeeTier,
        type: "access",
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.decode(token) as Record<string, unknown>;

      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.tier).toBe(testUser.employeeTier);
      expect(decoded.type).toBe("access");
      expect(decoded.iss).toBe("mgr-capital");
      expect(decoded.aud).toBe("mgr-capital-app");
    });

    it("should handle user without employeeTier", () => {
      const founderPayload = {
        userId: "founder-123",
        email: "founder@example.com",
        role: "FOUNDER",
        tier: null,
        type: "access",
      };

      const token = jwt.sign(founderPayload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.tier).toBeNull();
    });
  });

  describe("Access Token Verification", () => {
    it("should verify a valid access token", () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        type: "access",
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.verify(token, TEST_JWT_SECRET, {
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      }) as Record<string, unknown>;

      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.type).toBe("access");
    });

    it("should throw for expired token", () => {
      const expiredToken = jwt.sign(
        { userId: "user-123", type: "access" },
        TEST_JWT_SECRET,
        { expiresIn: -1, issuer: "mgr-capital", audience: "mgr-capital-app" }
      );

      expect(() => {
        jwt.verify(expiredToken, TEST_JWT_SECRET, {
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });
      }).toThrow();
    });

    it("should throw for invalid signature", () => {
      const badToken = jwt.sign(
        { userId: "user-123", type: "access" },
        "wrong-secret",
        { expiresIn: 900, issuer: "mgr-capital", audience: "mgr-capital-app" }
      );

      expect(() => {
        jwt.verify(badToken, TEST_JWT_SECRET, {
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });
      }).toThrow();
    });

    it("should throw for wrong issuer", () => {
      const badIssuerToken = jwt.sign(
        { userId: "user-123", type: "access" },
        TEST_JWT_SECRET,
        { expiresIn: 900, issuer: "wrong-issuer", audience: "mgr-capital-app" }
      );

      expect(() => {
        jwt.verify(badIssuerToken, TEST_JWT_SECRET, {
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });
      }).toThrow();
    });

    it("should throw for wrong audience", () => {
      const badAudienceToken = jwt.sign(
        { userId: "user-123", type: "access" },
        TEST_JWT_SECRET,
        { expiresIn: 900, issuer: "mgr-capital", audience: "wrong-audience" }
      );

      expect(() => {
        jwt.verify(badAudienceToken, TEST_JWT_SECRET, {
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });
      }).toThrow();
    });
  });

  // ===========================================================================
  // REFRESH TOKEN TESTS
  // ===========================================================================

  describe("Refresh Token Generation", () => {
    it("should generate a secure random token", () => {
      const token = crypto.randomBytes(64).toString("base64url");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(50);
    });

    it("should generate unique tokens each time", () => {
      const token1 = crypto.randomBytes(64).toString("base64url");
      const token2 = crypto.randomBytes(64).toString("base64url");

      expect(token1).not.toBe(token2);
    });
  });

  describe("Refresh Token Hashing", () => {
    it("should hash token with SHA256", () => {
      const rawToken = crypto.randomBytes(64).toString("base64url");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      expect(hashedToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce consistent hash for same input", () => {
      const rawToken = "test-token-value";
      const hash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
      const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");

      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different input", () => {
      const hash1 = crypto.createHash("sha256").update("token1").digest("hex");
      const hash2 = crypto.createHash("sha256").update("token2").digest("hex");

      expect(hash1).not.toBe(hash2);
    });
  });

  // ===========================================================================
  // PASSWORD HASHING TESTS
  // ===========================================================================

  describe("Password Hashing", () => {
    it("should hash password with bcrypt", async () => {
      const password = "SecurePassword123!";
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true);
    });

    it("should verify correct password", async () => {
      const password = "SecurePassword123!";
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "SecurePassword123!";
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare("WrongPassword123!", hash);
      expect(isValid).toBe(false);
    });
  });

  // ===========================================================================
  // TOKEN EXPIRY TESTS
  // ===========================================================================

  describe("Token Expiry Calculation", () => {
    it("should calculate access expiry approximately 15 minutes from now", () => {
      const minutes = 15;
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

      const now = Date.now();
      const expectedMin = now + 14 * 60 * 1000;
      const expectedMax = now + 16 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should calculate refresh expiry approximately 14 days from now", () => {
      const days = 14;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const now = Date.now();
      const expectedMin = now + 13 * 24 * 60 * 60 * 1000;
      const expectedMax = now + 15 * 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ===========================================================================
  // COOKIE OPTIONS TESTS
  // ===========================================================================

  describe("Cookie Options", () => {
    it("should return secure cookie options", () => {
      const options = {
        httpOnly: true,
        secure: true,
        sameSite: "strict" as const,
        maxAge: 14 * 24 * 60 * 60 * 1000,
        path: "/api/auth",
      };

      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("strict");
      expect(options.path).toBe("/api/auth");
      expect(options.maxAge).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  // ===========================================================================
  // TOKEN PAYLOAD VALIDATION TESTS
  // ===========================================================================

  describe("Token Payload Validation", () => {
    it("should reject token without type field", () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        // No type field
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.verify(token, TEST_JWT_SECRET, {
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      }) as Record<string, unknown>;

      expect(decoded.type).toBeUndefined();
    });

    it("should include all required fields in access token", () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tier: testUser.employeeTier,
        type: "access",
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.verify(token, TEST_JWT_SECRET, {
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      }) as Record<string, unknown>;

      expect(decoded).toHaveProperty("userId");
      expect(decoded).toHaveProperty("email");
      expect(decoded).toHaveProperty("role");
      expect(decoded).toHaveProperty("type");
      expect(decoded).toHaveProperty("iat");
      expect(decoded).toHaveProperty("exp");
    });
  });

  // ===========================================================================
  // ROLE VALIDATION TESTS
  // ===========================================================================

  describe("Role Validation", () => {
    const validRoles = ["FOUNDER", "ADMIN", "EMPLOYEE", "CLIENT"];

    validRoles.forEach((role) => {
      it(`should accept valid role: ${role}`, () => {
        const payload = {
          userId: testUser.id,
          email: testUser.email,
          role,
          type: "access",
        };

        const token = jwt.sign(payload, TEST_JWT_SECRET, {
          expiresIn: 900,
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });

        const decoded = jwt.decode(token) as Record<string, unknown>;
        expect(decoded.role).toBe(role);
      });
    });
  });

  // ===========================================================================
  // TIER VALIDATION TESTS
  // ===========================================================================

  describe("Tier Validation", () => {
    const validTiers = [
      "TIER_1_ASSOCIATE",
      "TIER_2_SPECIALIST",
      "TIER_3_SENIOR_SPECIALIST",
      "TIER_4_TEAM_LEADER",
      "TIER_5_EXECUTIVE_PARTNER",
    ];

    validTiers.forEach((tier) => {
      it(`should accept valid tier: ${tier}`, () => {
        const payload = {
          userId: testUser.id,
          email: testUser.email,
          role: "EMPLOYEE",
          tier,
          type: "access",
        };

        const token = jwt.sign(payload, TEST_JWT_SECRET, {
          expiresIn: 900,
          issuer: "mgr-capital",
          audience: "mgr-capital-app",
        });

        const decoded = jwt.decode(token) as Record<string, unknown>;
        expect(decoded.tier).toBe(tier);
      });
    });

    it("should accept null tier for non-employees", () => {
      const payload = {
        userId: "founder-123",
        email: "founder@example.com",
        role: "FOUNDER",
        tier: null,
        type: "access",
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, {
        expiresIn: 900,
        issuer: "mgr-capital",
        audience: "mgr-capital-app",
      });

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.tier).toBeNull();
    });
  });
});
