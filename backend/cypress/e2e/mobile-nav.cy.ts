describe("Mobile Navigation", () => {
  beforeEach(() => {
    cy.login("time@mgrcapital.com", "Dorothy1956!");
    // Set mobile viewport
    cy.viewport("iphone-x");
  });

  it("should show hamburger menu on mobile", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').should("be.visible");
  });

  it("should hide sidebar by default on mobile", () => {
    cy.visit("/founder/dashboard");
    cy.get("nav").should("have.class", "-translate-x-full");
  });

  it("should open sidebar when hamburger clicked", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get("nav").should("not.have.class", "-translate-x-full");
    cy.get("nav").should("have.class", "translate-x-0");
  });

  it("should show overlay when sidebar open", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-hidden="true"]').should("be.visible");
  });

  it("should close sidebar when overlay clicked", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-hidden="true"]').click();
    cy.get("nav").should("have.class", "-translate-x-full");
  });

  it("should close sidebar when X button clicked", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get("nav").within(() => {
      cy.get('[aria-label="Close"]').click();
    });
    cy.get("nav").should("have.class", "-translate-x-full");
  });

  it("should close sidebar when nav link clicked", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.contains("All Cases").click();
    cy.url().should("include", "/founder/cases");
    cy.get("nav").should("have.class", "-translate-x-full");
  });

  it("should show navigation links in sidebar", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.contains("Dashboard").should("be.visible");
    cy.contains("All Cases").should("be.visible");
    cy.contains("Configuration").should("be.visible");
  });

  it("should highlight active nav link", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get('a[href="/founder/dashboard"]').should("have.class", "bg-primary");
  });

  it("should switch menu icon when open", () => {
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Close menu"]').should("be.visible");
  });

  it("should be responsive on tablet viewport", () => {
    cy.viewport("ipad-2");
    cy.visit("/founder/dashboard");
    // On tablet (md breakpoint), sidebar should be visible
    cy.get("nav").should("be.visible");
  });

  it("should hide hamburger on desktop", () => {
    cy.viewport(1280, 800);
    cy.visit("/founder/dashboard");
    cy.get('[aria-label="Open menu"]').should("not.be.visible");
  });
});
