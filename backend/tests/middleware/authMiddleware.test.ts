/**
 * Auth Middleware Unit Tests
 *
 * Tests for JWT verification, role-based access control, and tier restrictions.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";

// Mock authService
const mockVerifyAccessToken = jest.fn();

jest.unstable_mockModule("../services/AuthService.js", () => ({
  authService: {
    verifyAccessToken: mockVerifyAccessToken,
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
const {
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  founderOnly,
  adminOrFounder,
  requireMinTier,
} = await import("../../src/middleware/authMiddleware.js");

// Mock response helper
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// Mock request helper
function createMockRequest(headers: Record<string, string> = {}, user?: any) {
  const req = {
    headers,
    user,
  } as unknown as Request & { user?: any; token?: string };
  return req;
}

describe("authMiddleware", () => {
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = createMockResponse();
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // MAIN AUTH MIDDLEWARE TESTS
  // ===========================================================================

  describe("authMiddleware", () => {
    it("should reject request without Authorization header", () => {
      const req = createMockRequest({});

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Authentication required",
        code: "NO_TOKEN",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request without Bearer prefix", () => {
      const req = createMockRequest({ authorization: "Basic abc123" });

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "NO_TOKEN" })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid token", () => {
      const req = createMockRequest({ authorization: "Bearer invalid-token" });
      mockVerifyAccessToken.mockReturnValue(null);

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept valid token and set user on request", () => {
      const req = createMockRequest({ authorization: "Bearer valid-token" });
      const tokenPayload = {
        userId: "user-123",
        email: "test@example.com",
        role: "EMPLOYEE",
        tier: "TIER_1_ASSOCIATE",
      };
      mockVerifyAccessToken.mockReturnValue(tokenPayload);

      authMiddleware(req, mockRes, mockNext);

      expect(req.user).toEqual({
        id: "user-123",
        userId: "user-123",
        email: "test@example.com",
        role: "EMPLOYEE",
        tier: "TIER_1_ASSOCIATE",
      });
      expect(req.token).toBe("valid-token");
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should handle TokenExpiredError", () => {
      const req = createMockRequest({ authorization: "Bearer expired-token" });
      const error = new Error("Token expired");
      error.name = "TokenExpiredError";
      mockVerifyAccessToken.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    });

    it("should handle JsonWebTokenError", () => {
      const req = createMockRequest({ authorization: "Bearer malformed" });
      const error = new Error("jwt malformed");
      error.name = "JsonWebTokenError";
      mockVerifyAccessToken.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid authentication token",
        code: "INVALID_TOKEN",
      });
    });

    it("should handle generic errors", () => {
      const req = createMockRequest({ authorization: "Bearer token" });
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error("Unknown error");
      });

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    });
  });

  // ===========================================================================
  // OPTIONAL AUTH MIDDLEWARE TESTS
  // ===========================================================================

  describe("optionalAuthMiddleware", () => {
    it("should proceed without auth header", () => {
      const req = createMockRequest({});

      optionalAuthMiddleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("should proceed without Bearer prefix", () => {
      const req = createMockRequest({ authorization: "Basic abc" });

      optionalAuthMiddleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("should set user on valid token", () => {
      const req = createMockRequest({ authorization: "Bearer valid-token" });
      mockVerifyAccessToken.mockReturnValue({
        userId: "user-123",
        email: "test@example.com",
        role: "EMPLOYEE",
        tier: null,
      });

      optionalAuthMiddleware(req, mockRes, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.email).toBe("test@example.com");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should proceed without user on invalid token", () => {
      const req = createMockRequest({ authorization: "Bearer invalid-token" });
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      optionalAuthMiddleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  // ===========================================================================
  // ROLE-BASED ACCESS CONTROL TESTS
  // ===========================================================================

  describe("requireRoles", () => {
    it("should reject when no user", () => {
      const req = createMockRequest({});
      const middleware = requireRoles("FOUNDER", "ADMIN");

      middleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "NO_AUTH" })
      );
    });

    it("should reject insufficient role", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE" }
      );
      const middleware = requireRoles("FOUNDER", "ADMIN");

      middleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Access denied",
        code: "INSUFFICIENT_ROLE",
      });
    });

    it("should allow matching role", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "FOUNDER" }
      );
      const middleware = requireRoles("FOUNDER", "ADMIN");

      middleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("founderOnly", () => {
    it("should reject when no user", () => {
      const req = createMockRequest({});

      founderOnly(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "NO_AUTH" })
      );
    });

    it("should reject non-founder", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "ADMIN" }
      );

      founderOnly(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Access denied",
        code: "FOUNDER_ONLY",
      });
    });

    it("should allow founder", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "FOUNDER" }
      );

      founderOnly(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("adminOrFounder", () => {
    it("should reject when no user", () => {
      const req = createMockRequest({});

      adminOrFounder(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject employee", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE" }
      );

      adminOrFounder(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ADMIN_OR_FOUNDER_ONLY" })
      );
    });

    it("should allow admin", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "ADMIN" }
      );

      adminOrFounder(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow founder", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "FOUNDER" }
      );

      adminOrFounder(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TIER RESTRICTION TESTS
  // ===========================================================================

  describe("requireMinTier", () => {
    it("should reject when no user", () => {
      const req = createMockRequest({});
      const middleware = requireMinTier("TIER_2_SPECIALIST");

      middleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should allow FOUNDER regardless of tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "FOUNDER", tier: null }
      );
      const middleware = requireMinTier("TIER_5_EXECUTIVE_PARTNER");

      middleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow ADMIN regardless of tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "ADMIN", tier: null }
      );
      const middleware = requireMinTier("TIER_5_EXECUTIVE_PARTNER");

      middleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject employee without tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE", tier: null }
      );
      const middleware = requireMinTier("TIER_2_SPECIALIST");

      middleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "No tier assigned",
        code: "NO_TIER",
      });
    });

    it("should reject employee with insufficient tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE", tier: "TIER_1_ASSOCIATE" }
      );
      const middleware = requireMinTier("TIER_3_SENIOR_SPECIALIST");

      middleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Insufficient tier level",
        code: "INSUFFICIENT_TIER",
      });
    });

    it("should allow employee with exact tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE", tier: "TIER_2_SPECIALIST" }
      );
      const middleware = requireMinTier("TIER_2_SPECIALIST");

      middleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow employee with higher tier", () => {
      const req = createMockRequest(
        {},
        { id: "user-123", role: "EMPLOYEE", tier: "TIER_4_TEAM_LEADER" }
      );
      const middleware = requireMinTier("TIER_2_SPECIALIST");

      middleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
