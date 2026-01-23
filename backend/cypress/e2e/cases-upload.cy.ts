describe("Cases Document Upload", () => {
  beforeEach(() => {
    cy.login("time@mgrcapital.com", "Dorothy1956!");
  });

  it("should display document upload section in case detail", () => {
    cy.visit("/employee/cases");
    cy.get('[data-testid="case-card"]').first().click();
    cy.contains("Documents").should("be.visible");
    cy.contains("Add").should("be.visible");
  });

  it("should open document uploader when Add button clicked", () => {
    cy.visit("/employee/cases");
    cy.get('[data-testid="case-card"]').first().click();
    cy.contains("Add").click();
    cy.contains("Drag & drop a file here").should("be.visible");
    cy.get('select, [role="combobox"]').should("be.visible");
  });

  it("should allow selecting document type", () => {
    cy.visit("/employee/cases");
    cy.get('[data-testid="case-card"]').first().click();
    cy.contains("Add").click();
    cy.get('[role="combobox"]').click();
    cy.contains("Client Service Agreement").should("be.visible");
    cy.contains("Limited Power of Attorney").should("be.visible");
  });

  it("should show uploaded documents in list", () => {
    cy.visit("/employee/cases");
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="document-list"]').should("exist");
  });

  it("should have view and download buttons for documents", () => {
    cy.visit("/employee/cases");
    cy.get('[data-testid="case-card"]').first().click();
    cy.get('[data-testid="document-item"]').first().within(() => {
      cy.get('[aria-label="View document"]').should("exist");
      cy.get('[aria-label="Download document"]').should("exist");
    });
  });
});
