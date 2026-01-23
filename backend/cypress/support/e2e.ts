/**
 * Cypress E2E Support File
 *
 * Custom commands and global configuration for E2E tests.
 */

// Import commands
import "./commands";

// Global before hook
beforeEach(() => {
  // Clear cookies and local storage
  cy.clearCookies();
  cy.clearLocalStorage();
});

// Handle uncaught exceptions
Cypress.on("uncaught:exception", (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  console.error("Uncaught exception:", err.message);
  return false;
});

// Declare global namespace for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login and get access token
       */
      login(email: string, password: string): Chainable<string>;

      /**
       * Make authenticated API request
       */
      apiRequest(
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        url: string,
        options?: {
          body?: object;
          token?: string;
          failOnStatusCode?: boolean;
        }
      ): Chainable<Cypress.Response<any>>;

      /**
       * Create test user via API
       */
      createTestUser(overrides?: Partial<{
        email: string;
        password: string;
        name: string;
        role: string;
      }>): Chainable<{ email: string; password: string; userId: string }>;

      /**
       * Clean up test data
       */
      cleanupTestData(prefix?: string): Chainable<void>;
    }
  }
}
