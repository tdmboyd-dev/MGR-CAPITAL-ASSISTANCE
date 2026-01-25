describe('Full Surplus Recovery Flow', () => {
  it('Automates lead to payout', () => {
    cy.visit('/login')
    cy.get('#email').type('time@mgrcapital.com')
    cy.get('#password').type('Dorothy1956!')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')

    // Skip trace
    cy.visit('/founder/skip-trace')
    cy.get('#name').type('John Doe')
    cy.get('button').contains('Run Trace').click()
    cy.contains('Confidence').should('be.visible')

    // Genealogy tree
    cy.visit('/founder/genealogy')
    cy.get('#deceasedName').type('John Doe')
    cy.get('#state').type('CA')
    cy.get('button').contains('Generate Tree').click()
    cy.get('svg').should('exist')

    // Phone bot
    cy.visit('/founder/phone-bot')
    cy.get('#phone').type('(555) 123-4567')
    cy.get('button').contains('Start Call').click()
    cy.contains('Call').should('be.visible')

    // Doc gen
    cy.visit('/founder/documents/assignment')
    cy.get('#assignor').type('John Doe')
    cy.get('button').contains('Generate').click()
    cy.contains('Document').should('be.visible')

    // Payment
    cy.visit('/founder/payments')
    cy.contains('Payment').should('be.visible')

    // Auction
    cy.visit('/founder/auctions')
    cy.get('button').contains('Create').click()
    cy.contains('Auction').should('be.visible')

    // Logout
    cy.get('button').contains('Logout').click()
    cy.url().should('include', '/login')
  })

  it('VR Simulation', () => {
    cy.visit('/founder/vr-simulation')
    cy.get('button').contains('VR').click()
    cy.contains('VR').should('be.visible')
  })
})
