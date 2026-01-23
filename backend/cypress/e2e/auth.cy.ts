/**
 * Authentication E2E Tests
 *
 * Tests for login, logout, token refresh, and session management.
 */

describe("Authentication API", () => {
  const API_URL = Cypress.env("apiUrl");

  describe("POST /api/auth/login", () => {
    it("should reject login with missing credentials", () => {
      cy.apiRequest("POST", "/auth/login", {
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
      });
    });

    it("should reject login with invalid email format", () => {
      cy.apiRequest("POST", "/auth/login", {
        body: {
          email: "not-an-email",
          password: "password123",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401]);
        expect(response.body.success).to.be.false;
      });
    });

    it("should reject login with wrong password", () => {
      cy.apiRequest("POST", "/auth/login", {
        body: {
          email: "nonexistent@example.com",
          password: "WrongPassword123!",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include("Invalid");
      });
    });

    // This test would require a seeded test user
    it.skip("should return tokens on valid login", () => {
      cy.apiRequest("POST", "/auth/login", {
        body: {
          email: "test@example.com",
          password: "TestPassword123!",
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property("accessToken");
        expect(response.body.data).to.have.property("user");
        expect(response.body.data.user).to.have.property("id");
        expect(response.body.data.user).to.have.property("email");
        expect(response.body.data.user).to.have.property("role");
      });
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should reject refresh without token", () => {
      cy.apiRequest("POST", "/auth/refresh", {
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401]);
        expect(response.body.success).to.be.false;
      });
    });

    it("should reject refresh with invalid token", () => {
      cy.apiRequest("POST", "/auth/refresh", {
        body: {
          refreshToken: "invalid-refresh-token",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.success).to.be.false;
      });
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should reject logout without authentication", () => {
      cy.apiRequest("POST", "/auth/logout", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    // This test would require a valid session
    it.skip("should successfully logout with valid token", () => {
      cy.login("test@example.com", "TestPassword123!").then((token) => {
        cy.apiRequest("POST", "/auth/logout", { token }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
        });
      });
    });
  });

  describe("Protected Routes", () => {
    it("should reject requests without Authorization header", () => {
      cy.apiRequest("GET", "/users/me", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.code).to.eq("NO_TOKEN");
      });
    });

    it("should reject requests with invalid token", () => {
      cy.apiRequest("GET", "/users/me", {
        token: "invalid-jwt-token",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.code).to.be.oneOf(["INVALID_TOKEN", "AUTH_FAILED"]);
      });
    });

    it("should reject requests with malformed Bearer token", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/users/me`,
        headers: {
          Authorization: "NotBearer some-token",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.code).to.eq("NO_TOKEN");
      });
    });
  });
});
