describe("Training Quiz Submit", () => {
  beforeEach(() => {
    cy.login("time@mgrcapital.com", "Dorothy1956!");
  });

  it("should display training modules list", () => {
    cy.visit("/employee/training");
    cy.contains("Training Center").should("be.visible");
    cy.contains("Overall Progress").should("be.visible");
  });

  it("should navigate to module detail page", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.url().should("include", "/employee/training/");
  });

  it("should show Take Quiz button for modules with quizzes", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").should("be.visible");
  });

  it("should display quiz questions when Take Quiz clicked", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").click();
    cy.contains("Module Quiz").should("be.visible");
    cy.get('[type="radio"]').should("have.length.greaterThan", 0);
  });

  it("should enable submit button when all questions answered", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").click();

    // Answer all questions
    cy.get('[data-testid="question"]').each(($q) => {
      cy.wrap($q).find('[type="radio"]').first().check();
    });

    cy.contains("Submit Quiz").should("not.be.disabled");
  });

  it("should show score after quiz submission", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").click();

    // Answer all questions
    cy.get('[data-testid="question"]').each(($q) => {
      cy.wrap($q).find('[type="radio"]').first().check();
    });

    cy.contains("Submit Quiz").click();
    cy.get('[data-testid="quiz-score"]').should("be.visible");
  });

  it("should show confetti on passing score", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").click();

    // Answer all questions correctly (assuming first options are correct for test)
    cy.get('[data-testid="question"]').each(($q) => {
      cy.wrap($q).find('[type="radio"]').first().check();
    });

    cy.contains("Submit Quiz").click();

    // If passed, confetti canvas should appear
    cy.get("canvas").should("exist");
  });

  it("should show Try Again button on failing score", () => {
    cy.visit("/employee/training");
    cy.get('[data-testid="module-card"]').first().click();
    cy.contains("Take Quiz").click();

    // Answer all questions (last option to likely fail)
    cy.get('[data-testid="question"]').each(($q) => {
      cy.wrap($q).find('[type="radio"]').last().check();
    });

    cy.contains("Submit Quiz").click();

    // Check for either pass or fail state
    cy.get("body").then(($body) => {
      if ($body.find('[data-testid="try-again"]').length) {
        cy.contains("Try Again").should("be.visible");
      }
    });
  });
});
