/**
 * Jest Test Setup
 *
 * Global setup for all tests - mocks, environment, utilities.
 */

import { jest } from "@jest/globals";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-testing-only";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_ENABLED = "false";
process.env.COOKIE_SECURE = "false";

// Increase timeout for async operations
jest.setTimeout(30000);

// Global beforeAll - runs once before all tests
beforeAll(async () => {
  // Any global setup
});

// Global afterAll - runs once after all tests
afterAll(async () => {
  // Cleanup any global resources
});

// Global beforeEach - runs before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Global afterEach - runs after each test
afterEach(() => {
  jest.restoreAllMocks();
});

// Suppress console output during tests (optional)
if (process.env.SUPPRESS_LOGS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
