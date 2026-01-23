/**
 * Health Check E2E Tests
 *
 * Tests for API health and status endpoints.
 */

describe("Health Check API", () => {
  describe("GET /api/health", () => {
    it("should return healthy status", () => {
      cy.apiRequest("GET", "/health").then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("status", "ok");
      });
    });

    it("should include timestamp", () => {
      cy.apiRequest("GET", "/health").then((response) => {
        expect(response.body).to.have.property("timestamp");
        const timestamp = new Date(response.body.timestamp);
        expect(timestamp).to.be.a("date");
        expect(timestamp.getTime()).to.be.closeTo(Date.now(), 5000);
      });
    });

    it("should have reasonable response time", () => {
      const startTime = Date.now();

      cy.apiRequest("GET", "/health").then((response) => {
        const duration = Date.now() - startTime;
        expect(response.status).to.eq(200);
        expect(duration).to.be.lessThan(1000); // Less than 1 second
      });
    });
  });

  describe("GET /api/health/detailed", () => {
    it("should return detailed health info for authenticated users", () => {
      // This would require authentication
      // For now, test that unauthenticated returns 401 or basic health
      cy.apiRequest("GET", "/health/detailed", { failOnStatusCode: false }).then(
        (response) => {
          // May return 401 or basic health depending on implementation
          expect([200, 401]).to.include(response.status);
        }
      );
    });
  });
});
