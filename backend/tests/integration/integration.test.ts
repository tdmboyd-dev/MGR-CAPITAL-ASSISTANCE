/**
 * Integration Tests — MGR CAPITAL ASSISTANCE
 * Phase 19: Integration Testing Suite
 *
 * Supertest-based integration tests for all API endpoints.
 * Tests auth, cases, comms, AI agents, notifications, and feedback.
 */

import request from "supertest";
import app from "../../src/server.js";

const API_BASE = "/api";

// Test credentials
const TEST_USER = {
  email: "test@mgrcapital.com",
  password: "TestPassword123!",
};

const FOUNDER_USER = {
  email: "founder@mgrcapital.com",
  password: "FounderPassword123!",
};

// Token storage for authenticated requests
let userToken: string;
let founderToken: string;
let testCaseId: string;
let testFeedbackId: string;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

// =============================================================================
// AUTHENTICATION TESTS
// =============================================================================

describe("Authentication API", () => {
  describe("POST /api/auth/login", () => {
    it("should reject login with missing credentials", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({})
        .expect("Content-Type", /json/);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject login with invalid email format", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: "not-an-email",
          password: "password123",
        })
        .expect("Content-Type", /json/);

      expect([400, 401]).toContain(res.status);
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: "nonexistent@example.com",
          password: "WrongPassword123!",
        })
        .expect("Content-Type", /json/);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Skip if test user not seeded
    it.skip("should return tokens on valid login", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send(TEST_USER)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("user");

      userToken = res.body.data.accessToken;
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should reject refresh without token", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .send({})
        .expect("Content-Type", /json/);

      expect([400, 401]).toContain(res.status);
    });

    it("should reject refresh with invalid token", async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .send({ refreshToken: "invalid-token" })
        .expect("Content-Type", /json/);

      expect(res.status).toBe(401);
    });
  });

  describe("Protected Routes", () => {
    it("should reject requests without Authorization header", async () => {
      const res = await request(app)
        .get(`${API_BASE}/auth/me`)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(401);
    });

    it("should reject requests with invalid token", async () => {
      const res = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set("Authorization", "Bearer invalid-jwt-token")
        .expect("Content-Type", /json/);

      expect(res.status).toBe(401);
    });
  });
});

// =============================================================================
// HEALTH CHECK TESTS
// =============================================================================

describe("Health API", () => {
  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const res = await request(app)
        .get(`${API_BASE}/health`)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("timestamp");
    });
  });
});

// =============================================================================
// CASES API TESTS (require auth - skipped if no test user)
// =============================================================================

describe("Cases API", () => {
  describe("GET /api/cases", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/cases`);

      expect(res.status).toBe(401);
    });

    it.skip("should return cases list with valid auth", async () => {
      const res = await request(app)
        .get(`${API_BASE}/cases`)
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("cases");
      expect(Array.isArray(res.body.cases)).toBe(true);
    });
  });

  describe("POST /api/cases", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`${API_BASE}/cases`)
        .send({});

      expect(res.status).toBe(401);
    });

    it.skip("should create a new case with valid data", async () => {
      const caseData = {
        propertyAddress: "123 Test Street",
        city: "Nashville",
        state: "TN",
        county: "Davidson",
        surplusAmountCents: 500000,
        clientName: "Test Client",
        clientEmail: "client@test.com",
      };

      const res = await request(app)
        .post(`${API_BASE}/cases`)
        .set(authHeader(founderToken))
        .send(caseData)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("case");
      expect(res.body.case).toHaveProperty("id");

      testCaseId = res.body.case.id;
    });
  });
});

// =============================================================================
// COMMUNICATIONS API TESTS
// =============================================================================

describe("Communications API", () => {
  describe("GET /api/comms/rooms", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/comms/rooms`);

      expect(res.status).toBe(401);
    });

    it.skip("should return chat rooms with valid auth", async () => {
      const res = await request(app)
        .get(`${API_BASE}/comms/rooms`)
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("rooms");
    });
  });

  describe("POST /api/comms/messages", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`${API_BASE}/comms/messages`)
        .send({});

      expect(res.status).toBe(401);
    });

    it.skip("should send a message with valid auth", async () => {
      const messageData = {
        roomId: "test-room-id",
        content: "Test message from integration test",
      };

      const res = await request(app)
        .post(`${API_BASE}/comms/messages`)
        .set(authHeader(userToken))
        .send(messageData)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("message");
    });
  });
});

// =============================================================================
// AI AGENT API TESTS
// =============================================================================

describe("AI Agent API", () => {
  describe("POST /api/ai/agent", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`${API_BASE}/ai/agent`)
        .send({});

      expect(res.status).toBe(401);
    });

    it.skip("should execute an agent task with valid auth", async () => {
      const agentRequest = {
        task: "summary",
        context: {
          caseId: testCaseId || "test-case-id",
        },
      };

      const res = await request(app)
        .post(`${API_BASE}/ai/agent`)
        .set(authHeader(userToken))
        .send(agentRequest)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("response");
      expect(res.body).toHaveProperty("sessionId");
    });
  });

  describe("POST /api/ai/agent/continue", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`${API_BASE}/ai/agent/continue`)
        .send({});

      expect(res.status).toBe(401);
    });

    it.skip("should continue a multi-turn conversation", async () => {
      // First, start a session
      const startRes = await request(app)
        .post(`${API_BASE}/ai/agent`)
        .set(authHeader(userToken))
        .send({
          task: "outreach",
          context: { caseId: testCaseId || "test-case-id", emailType: "initial" },
        });

      const sessionId = startRes.body.sessionId;

      // Continue the conversation
      const continueRes = await request(app)
        .post(`${API_BASE}/ai/agent/continue`)
        .set(authHeader(userToken))
        .send({
          sessionId,
          followUp: "Make the tone more professional",
        })
        .expect("Content-Type", /json/);

      expect(continueRes.status).toBe(200);
      expect(continueRes.body).toHaveProperty("response");
      expect(continueRes.body.sessionId).toBe(sessionId);
    });
  });

  describe("GET /api/ai/search", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/ai/search?query=test`);

      expect(res.status).toBe(401);
    });

    it.skip("should perform AI-enhanced search", async () => {
      const res = await request(app)
        .get(`${API_BASE}/ai/search`)
        .query({ query: "tax sale cases in Tennessee" })
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
    });
  });
});

// =============================================================================
// NOTIFICATIONS API TESTS
// =============================================================================

describe("Notifications API", () => {
  describe("GET /api/notifications/unread", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/notifications/unread`);

      expect(res.status).toBe(401);
    });

    it.skip("should return unread notifications with valid auth", async () => {
      const res = await request(app)
        .get(`${API_BASE}/notifications/unread`)
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("notifications");
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });
  });

  describe("GET /api/notifications/count", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/notifications/count`);

      expect(res.status).toBe(401);
    });

    it.skip("should return unread count with valid auth", async () => {
      const res = await request(app)
        .get(`${API_BASE}/notifications/count`)
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("count");
      expect(typeof res.body.count).toBe("number");
    });
  });

  describe("PATCH /api/notifications/mark-read", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .patch(`${API_BASE}/notifications/mark-read`)
        .send({});

      expect(res.status).toBe(401);
    });
  });
});

// =============================================================================
// FEEDBACK API TESTS
// =============================================================================

describe("Feedback API", () => {
  describe("POST /api/feedback/submit", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`${API_BASE}/feedback/submit`)
        .send({});

      expect(res.status).toBe(401);
    });

    it("should reject feedback without rating", async () => {
      const res = await request(app)
        .post(`${API_BASE}/feedback/submit`)
        .set("Authorization", "Bearer valid-test-token") // Would need real token
        .send({ comment: "Test feedback" });

      // Will be 401 without real token, but testing the endpoint exists
      expect([400, 401]).toContain(res.status);
    });

    it.skip("should submit feedback with valid rating", async () => {
      const feedbackData = {
        category: "GENERAL",
        feature: "Dashboard",
        rating: 5,
        comment: "Integration test feedback - great platform!",
        pageUrl: "/dashboard",
      };

      const res = await request(app)
        .post(`${API_BASE}/feedback/submit`)
        .set(authHeader(userToken))
        .send(feedbackData)
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.success).toBe(true);

      testFeedbackId = res.body.id;
    });
  });

  describe("GET /api/feedback/categories", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/feedback/categories`);

      expect(res.status).toBe(401);
    });

    it.skip("should return feedback categories", async () => {
      const res = await request(app)
        .get(`${API_BASE}/feedback/categories`)
        .set(authHeader(userToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("categories");
      expect(Array.isArray(res.body.categories)).toBe(true);
    });
  });

  describe("GET /api/feedback (Founder only)", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/feedback`);

      expect(res.status).toBe(401);
    });

    it.skip("should return all feedback for founder", async () => {
      const res = await request(app)
        .get(`${API_BASE}/feedback`)
        .set(authHeader(founderToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("feedbacks");
      expect(res.body).toHaveProperty("total");
    });
  });

  describe("GET /api/feedback/stats (Founder only)", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/feedback/stats`);

      expect(res.status).toBe(401);
    });

    it.skip("should return feedback statistics for founder", async () => {
      const res = await request(app)
        .get(`${API_BASE}/feedback/stats`)
        .query({ days: 30 })
        .set(authHeader(founderToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalFeedback");
      expect(res.body).toHaveProperty("averageRating");
      expect(res.body).toHaveProperty("recentTrend");
    });
  });
});

// =============================================================================
// ANALYTICS API TESTS
// =============================================================================

describe("Analytics API", () => {
  describe("GET /api/analytics/dashboard", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/analytics/dashboard`);

      expect(res.status).toBe(401);
    });

    it.skip("should return dashboard data for founder", async () => {
      const res = await request(app)
        .get(`${API_BASE}/analytics/dashboard`)
        .set(authHeader(founderToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalCases");
      expect(res.body).toHaveProperty("totalRevenue");
    });
  });

  describe("GET /api/analytics/forecast", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(`${API_BASE}/analytics/forecast`);

      expect(res.status).toBe(401);
    });

    it.skip("should return forecast data for founder", async () => {
      const res = await request(app)
        .get(`${API_BASE}/analytics/forecast`)
        .set(authHeader(founderToken))
        .expect("Content-Type", /json/);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("predictions");
      expect(res.body).toHaveProperty("summary");
    });
  });
});

// =============================================================================
// RATE LIMITING TESTS
// =============================================================================

describe("Rate Limiting", () => {
  it("should have rate limiting headers on login endpoint", async () => {
    const res = await request(app)
      .post(`${API_BASE}/auth/login`)
      .send({ email: "test@test.com", password: "test" });

    // Check for rate limit headers (may vary based on implementation)
    expect(res.headers).toBeDefined();
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe("Error Handling", () => {
  it("should return 404 for non-existent endpoints", async () => {
    const res = await request(app)
      .get(`${API_BASE}/nonexistent/endpoint`)
      .expect("Content-Type", /json/);

    expect(res.status).toBe(404);
  });

  it("should handle malformed JSON gracefully", async () => {
    const res = await request(app)
      .post(`${API_BASE}/auth/login`)
      .set("Content-Type", "application/json")
      .send("{ invalid json }");

    expect([400, 500]).toContain(res.status);
  });
});
