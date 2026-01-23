/**
 * Cypress Configuration for MGR Capital Assistance Backend
 *
 * E2E tests for API endpoints.
 */

import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4000",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    fixturesFolder: "cypress/fixtures",

    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 30000,

    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Video recording
    video: false,
    screenshotOnRunFailure: true,

    // Environment variables
    env: {
      apiUrl: "http://localhost:4000/api",
    },

    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
      });

      return config;
    },
  },
});
