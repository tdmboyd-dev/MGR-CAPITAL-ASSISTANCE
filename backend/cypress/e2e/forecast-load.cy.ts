describe("Analytics Forecast Load", () => {
  beforeEach(() => {
    cy.login("time@mgrcapital.com", "Dorothy1956!");
  });

  it("should display forecast summary on founder dashboard", () => {
    cy.visit("/founder/dashboard");
    cy.contains("30-Day Forecast").should("be.visible");
    cy.contains("Predicted Revenue").should("be.visible");
    cy.contains("Predicted Cases").should("be.visible");
    cy.contains("Trend").should("be.visible");
  });

  it("should show trend indicator on dashboard", () => {
    cy.visit("/founder/dashboard");
    cy.get('[data-testid="trend-indicator"]').should("be.visible");
  });

  it("should have link to full forecast page", () => {
    cy.visit("/founder/dashboard");
    cy.contains("View Full Forecast").click();
    cy.url().should("include", "/founder/ops");
  });

  it("should display ops dashboard with charts", () => {
    cy.visit("/founder/ops");
    cy.contains("Ops Dashboard & Forecast").should("be.visible");
    cy.contains("Revenue Forecast").should("be.visible");
    cy.contains("Cases Forecast").should("be.visible");
  });

  it("should show summary cards on ops page", () => {
    cy.visit("/founder/ops");
    cy.contains("Avg Daily Revenue").should("be.visible");
    cy.contains("Avg Daily Cases").should("be.visible");
    cy.contains("Predicted Revenue (30d)").should("be.visible");
    cy.contains("Predicted Cases (30d)").should("be.visible");
  });

  it("should render revenue chart", () => {
    cy.visit("/founder/ops");
    cy.get('[data-testid="revenue-chart"]').should("be.visible");
    cy.get(".recharts-responsive-container").should("have.length.greaterThan", 0);
  });

  it("should render cases chart", () => {
    cy.visit("/founder/ops");
    cy.get('[data-testid="cases-chart"]').should("be.visible");
  });

  it("should show chart legend", () => {
    cy.visit("/founder/ops");
    cy.contains("Historical").should("be.visible");
    cy.contains("Predicted").should("be.visible");
  });

  it("should load forecast API successfully", () => {
    cy.intercept("GET", "/api/analytics/forecast").as("getForecast");
    cy.visit("/founder/ops");
    cy.wait("@getForecast").its("response.statusCode").should("eq", 200);
  });

  it("should display proper date range in chart", () => {
    cy.visit("/founder/ops");
    cy.contains("Last 30 days + Next 30 days").should("be.visible");
  });
});
