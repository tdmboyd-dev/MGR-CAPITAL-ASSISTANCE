/**
 * AI Agent E2E Tests — MGR CAPITAL ASSISTANCE
 * Phase 19: Integration Testing Suite
 *
 * Cypress tests for multi-turn AI agent functionality.
 * Tests agent execution, session persistence, and continue/clarify flow.
 */

describe("AI Agent API", () => {
  const API_URL = Cypress.env("apiUrl");

  // Skip tests if no auth - these require a seeded test user
  const hasAuth = () => Cypress.env("testUserToken");

  describe("POST /api/ai/agent", () => {
    it("should reject unauthenticated requests", () => {
      cy.apiRequest("POST", "/ai/agent", {
        body: { task: "summary", context: {} },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should reject requests without task", () => {
      cy.apiRequest("POST", "/ai/agent", {
        body: { context: {} },
        failOnStatusCode: false,
      }).then((response) => {
        expect([400, 401]).to.include(response.status);
      });
    });

    // Requires authenticated session
    it.skip("should execute summary task and return session ID", () => {
      cy.login().then((token) => {
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "summary",
            context: {
              caseId: "test-case-id",
              data: "Sample case data for testing",
            },
          },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("response");
          expect(response.body).to.have.property("sessionId");
          expect(response.body.sessionId).to.be.a("string");
          expect(response.body.sessionId.length).to.be.greaterThan(10);

          // Store session ID for continue test
          Cypress.env("aiSessionId", response.body.sessionId);
        });
      });
    });

    it.skip("should execute outreach email generation", () => {
      cy.login().then((token) => {
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "outreach",
            context: {
              caseId: "test-case-id",
              emailType: "initial",
              clientName: "John Doe",
              propertyAddress: "123 Main St, Nashville TN",
              surplusAmount: "$5,000",
            },
          },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("response");
          expect(response.body.response).to.be.a("string");
          expect(response.body.response.length).to.be.greaterThan(50);
        });
      });
    });

    it.skip("should execute compliance check", () => {
      cy.login().then((token) => {
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "compliance",
            context: {
              caseId: "test-case-id",
              state: "TN",
              county: "Davidson",
            },
          },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("response");
        });
      });
    });
  });

  describe("POST /api/ai/agent/continue (Multi-Turn)", () => {
    it("should reject unauthenticated requests", () => {
      cy.apiRequest("POST", "/ai/agent/continue", {
        body: { sessionId: "test", followUp: "test" },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should reject requests without session ID", () => {
      cy.apiRequest("POST", "/ai/agent/continue", {
        body: { followUp: "test" },
        failOnStatusCode: false,
      }).then((response) => {
        expect([400, 401]).to.include(response.status);
      });
    });

    it.skip("should continue conversation with same session", () => {
      cy.login().then((token) => {
        // Start a conversation
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "outreach",
            context: {
              caseId: "test-case-id",
              emailType: "initial",
              clientName: "Jane Smith",
            },
          },
        }).then((startResponse) => {
          const sessionId = startResponse.body.sessionId;
          expect(sessionId).to.exist;

          // Continue the conversation
          cy.apiRequest("POST", "/ai/agent/continue", {
            token,
            body: {
              sessionId,
              followUp: "Make the tone more professional",
            },
          }).then((continueResponse) => {
            expect(continueResponse.status).to.eq(200);
            expect(continueResponse.body).to.have.property("response");
            expect(continueResponse.body.sessionId).to.eq(sessionId);
          });
        });
      });
    });

    it.skip("should maintain context across multiple turns", () => {
      cy.login().then((token) => {
        // Turn 1: Generate initial email
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "outreach",
            context: {
              caseId: "multi-turn-test",
              emailType: "initial",
              clientName: "Multi Turn Test",
            },
          },
        }).then((turn1) => {
          const sessionId = turn1.body.sessionId;

          // Turn 2: Clarify tone
          cy.apiRequest("POST", "/ai/agent/continue", {
            token,
            body: { sessionId, followUp: "Make it shorter" },
          }).then((turn2) => {
            expect(turn2.body.sessionId).to.eq(sessionId);

            // Turn 3: Add specific detail
            cy.apiRequest("POST", "/ai/agent/continue", {
              token,
              body: { sessionId, followUp: "Add urgency about the deadline" },
            }).then((turn3) => {
              expect(turn3.body.sessionId).to.eq(sessionId);
              expect(turn3.body.response).to.be.a("string");
            });
          });
        });
      });
    });

    it.skip("should handle clarify requests", () => {
      cy.login().then((token) => {
        // Start with compliance check
        cy.apiRequest("POST", "/ai/agent", {
          token,
          body: {
            task: "compliance",
            context: { caseId: "clarify-test", state: "TN" },
          },
        }).then((startResponse) => {
          const sessionId = startResponse.body.sessionId;

          // Ask for clarification
          cy.apiRequest("POST", "/ai/agent/continue", {
            token,
            body: {
              sessionId,
              followUp: "Clarify the redemption period requirements",
            },
          }).then((clarifyResponse) => {
            expect(clarifyResponse.status).to.eq(200);
            expect(clarifyResponse.body.response).to.include.oneOf([
              "redemption",
              "period",
              "days",
              "deadline",
            ]);
          });
        });
      });
    });
  });

  describe("AI Agent Task Types", () => {
    const tasks = ["summary", "outreach", "compliance", "research", "follow_up", "document_review"];

    tasks.forEach((task) => {
      it.skip(`should handle ${task} task type`, () => {
        cy.login().then((token) => {
          cy.apiRequest("POST", "/ai/agent", {
            token,
            body: {
              task,
              context: { caseId: `task-type-test-${task}` },
            },
          }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body).to.have.property("response");
            expect(response.body).to.have.property("sessionId");
          });
        });
      });
    });
  });

  describe("AI Search", () => {
    it("should reject unauthenticated search requests", () => {
      cy.apiRequest("GET", "/ai/search?query=test", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it.skip("should perform semantic search", () => {
      cy.login().then((token) => {
        cy.apiRequest("GET", "/ai/search", {
          token,
          qs: { query: "tax sale cases in Tennessee with high surplus" },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("results");
          expect(response.body.results).to.be.an("array");
        });
      });
    });
  });

  describe("AI Recommendations", () => {
    it("should reject unauthenticated recommendation requests", () => {
      cy.apiRequest("GET", "/ai/recommendations", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it.skip("should return personalized recommendations", () => {
      cy.login().then((token) => {
        cy.apiRequest("GET", "/ai/recommendations", {
          token,
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("recommendations");
        });
      });
    });
  });
});

// =============================================================================
// FRONTEND UI TESTS (if running with frontend)
// =============================================================================

describe("AI Agent UI", () => {
  beforeEach(() => {
    // Skip if not testing frontend
    if (!Cypress.env("testFrontend")) {
      cy.log("Skipping frontend tests - set testFrontend env to enable");
      return;
    }
  });

  it.skip("should open AI agent modal when clicking agent button", () => {
    cy.visit("/employee/cases/test-case-id");
    cy.get("[data-testid=ai-agent-button]").click();
    cy.get("[data-testid=ai-agent-modal]").should("be.visible");
  });

  it.skip("should display agent response in modal", () => {
    cy.visit("/employee/cases/test-case-id");
    cy.get("[data-testid=ai-summary-button]").click();

    // Wait for response
    cy.get("[data-testid=ai-agent-modal]", { timeout: 10000 }).should("be.visible");
    cy.get("[data-testid=ai-response]").should("not.be.empty");
  });

  it.skip("should allow multi-turn conversation in modal", () => {
    cy.visit("/employee/cases/test-case-id");
    cy.get("[data-testid=ai-outreach-button]").click();

    // Wait for initial response
    cy.get("[data-testid=ai-response]", { timeout: 10000 }).should("not.be.empty");

    // Enter follow-up
    cy.get("[data-testid=ai-followup-input]").type("Make it more formal");
    cy.get("[data-testid=ai-continue-button]").click();

    // Wait for updated response
    cy.get("[data-testid=ai-loading]").should("be.visible");
    cy.get("[data-testid=ai-response]", { timeout: 10000 }).should("not.be.empty");
  });

  it.skip("should copy AI response to clipboard", () => {
    cy.visit("/employee/cases/test-case-id");
    cy.get("[data-testid=ai-summary-button]").click();

    cy.get("[data-testid=ai-response]", { timeout: 10000 }).should("not.be.empty");
    cy.get("[data-testid=ai-copy-button]").click();
    cy.get("[data-testid=copy-success-toast]").should("be.visible");
  });
});
