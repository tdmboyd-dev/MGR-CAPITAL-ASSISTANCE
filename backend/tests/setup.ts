/**
 * Jest Test Setup
 *
 * Global setup for all tests - mocks, environment, utilities.
 */

import { jest } from "@jest/globals";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "synthetic-unit-test-jwt-secret-32-characters";
process.env.JWT_REFRESH_SECRET ||= "synthetic-unit-test-refresh-secret-32-characters";
process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:18588/capital_auth_lab";
const testDatabase = new URL(process.env.DATABASE_URL);
if (testDatabase.hostname !== "127.0.0.1" || testDatabase.port !== "18588" || testDatabase.pathname !== "/capital_auth_lab") {
  throw new Error("Jest requires the owned isolated Capital lab; refusing another database");
}
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
