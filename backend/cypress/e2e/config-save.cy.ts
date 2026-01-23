describe("Founder Config Save", () => {
  beforeEach(() => {
    cy.login("time@mgrcapital.com", "Dorothy1956!");
  });

  it("should display config page with tabs", () => {
    cy.visit("/founder/config");
    cy.contains("System Configuration").should("be.visible");
    cy.contains("Training").should("be.visible");
    cy.contains("Ingestion").should("be.visible");
    cy.contains("Ops").should("be.visible");
    cy.contains("System").should("be.visible");
  });

  it("should show training config fields", () => {
    cy.visit("/founder/config");
    cy.contains("Training").click();
    cy.contains("Passing Score").should("be.visible");
    cy.contains("Max Quiz Attempts").should("be.visible");
    cy.contains("Module Expiration").should("be.visible");
  });

  it("should allow editing training config values", () => {
    cy.visit("/founder/config");
    cy.contains("Training").click();
    cy.get("#passingScore").clear().type("85");
    cy.get("#passingScore").should("have.value", "85");
  });

  it("should show ingestion config fields", () => {
    cy.visit("/founder/config");
    cy.contains("Ingestion").click();
    cy.contains("High Value Threshold").should("be.visible");
    cy.contains("Max Batch Size").should("be.visible");
  });

  it("should show ops config fields", () => {
    cy.visit("/founder/config");
    cy.contains("Ops").click();
    cy.contains("Volatility Threshold").should("be.visible");
    cy.contains("Metrics Retention").should("be.visible");
    cy.contains("Focus Feed Max Items").should("be.visible");
  });

  it("should show system config fields", () => {
    cy.visit("/founder/config");
    cy.contains("System").click();
    cy.contains("Max File Upload").should("be.visible");
    cy.contains("Session Timeout").should("be.visible");
    cy.contains("Maintenance mode").should("be.visible");
  });

  it("should have save and reset buttons", () => {
    cy.visit("/founder/config");
    cy.contains("Save Changes").should("be.visible");
    cy.contains("Reset").should("be.visible");
  });

  it("should save config changes", () => {
    cy.visit("/founder/config");
    cy.contains("Training").click();
    cy.get("#passingScore").clear().type("80");
    cy.contains("Save Changes").click();
    cy.contains("Configuration saved successfully").should("be.visible");
  });

  it("should reset config to defaults", () => {
    cy.visit("/founder/config");
    cy.contains("Training").click();
    cy.get("#passingScore").clear().type("99");
    cy.contains("Reset").click();
    cy.get("#passingScore").should("have.value", "80");
  });
});
