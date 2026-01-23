/**
 * Cypress Custom Commands
 *
 * Reusable commands for API testing.
 */

const API_URL = Cypress.env("apiUrl") || "http://localhost:4000/api";

// Store token for authenticated requests
let authToken: string | null = null;

/**
 * Login and get access token
 */
Cypress.Commands.add("login", (email: string, password: string) => {
  return cy
    .request({
      method: "POST",
      url: `${API_URL}/auth/login`,
      body: { email, password },
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200 && response.body.data?.accessToken) {
        authToken = response.body.data.accessToken;
        return authToken;
      }
      throw new Error(`Login failed: ${response.body.error || "Unknown error"}`);
    });
});

/**
 * Make authenticated API request
 */
Cypress.Commands.add(
  "apiRequest",
  (
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    options: {
      body?: object;
      token?: string;
      failOnStatusCode?: boolean;
    } = {}
  ) => {
    const token = options.token || authToken;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return cy.request({
      method,
      url: url.startsWith("http") ? url : `${API_URL}${url}`,
      headers,
      body: options.body,
      failOnStatusCode: options.failOnStatusCode ?? false,
    });
  }
);

/**
 * Create test user via API (requires founder token)
 */
Cypress.Commands.add(
  "createTestUser",
  (
    overrides: Partial<{
      email: string;
      password: string;
      name: string;
      role: string;
    }> = {}
  ) => {
    const testId = Math.random().toString(36).substring(7);
    const userData = {
      email: overrides.email || `test-${testId}@example.com`,
      password: overrides.password || `TestPass123!${testId}`,
      name: overrides.name || `Test User ${testId}`,
      role: overrides.role || "EMPLOYEE",
    };

    // This would require a founder endpoint to create users
    // For now, return the test data
    return cy.wrap({
      email: userData.email,
      password: userData.password,
      userId: `test-user-${testId}`,
    });
  }
);

/**
 * Clean up test data
 */
Cypress.Commands.add("cleanupTestData", (prefix: string = "test-") => {
  // This would call a test cleanup endpoint
  cy.log(`Cleaning up test data with prefix: ${prefix}`);
});

export {};
