/**
 * Jest Configuration for MGR Capital Assistance Backend
 *
 * Run tests with: npm test
 * Run with coverage: npm test -- --coverage
 */

import type { Config } from "jest";

const config: Config = {
  // Use ts-jest for TypeScript
  preset: "ts-jest",

  // Test environment
  testEnvironment: "node",

  // Root directories
  roots: ["<rootDir>/src", "<rootDir>/tests"],

  // Test file patterns
  testMatch: [
    "**/__tests__/**/*.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
  ],

  // Module file extensions
  moduleFileExtensions: ["ts", "js", "json", "node"],

  // Transform TypeScript files
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },

  // Module name mapper for path aliases and .js extensions
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/types/**/*.ts",
    "!src/**/index.ts",
  ],

  coverageDirectory: "coverage",

  coverageReporters: ["text", "lcov", "html"],

  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
};

export default config;
