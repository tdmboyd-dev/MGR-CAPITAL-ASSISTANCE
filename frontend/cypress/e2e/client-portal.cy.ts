/**
 * Client Portal E2E Tests
 *
 * Tests for client-facing features:
 * - Case tracking
 * - Document access
 * - Communication
 * - Notifications
 */

describe('Client Portal', () => {
  beforeEach(() => {
    // Login as a client user
    cy.visit('/login')
    cy.get('#email').type('client@example.com')
    cy.get('#password').type('ClientPassword123!')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/client')
  })

  describe('Case Tracking', () => {
    it('should display all client cases', () => {
      cy.visit('/client/cases')
      cy.get('[data-testid="case-list"]').should('exist')
    })

    it('should show case status timeline', () => {
      cy.visit('/client/cases')
      cy.get('[data-testid="case-card"]').first().click()
      cy.get('[data-testid="status-timeline"]').should('exist')
      cy.contains('Status History').should('be.visible')
    })

    it('should display estimated payout', () => {
      cy.visit('/client/cases')
      cy.get('[data-testid="case-card"]').first().click()
      cy.contains('Estimated Payout').should('be.visible')
    })

    it('should filter cases by status', () => {
      cy.visit('/client/cases')
      cy.get('[data-testid="status-filter"]').click()
      cy.contains('Pending').click()
      cy.get('[data-testid="case-card"]').each(($card) => {
        cy.wrap($card).should('contain', 'Pending')
      })
    })
  })

  describe('Document Access', () => {
    it('should list available documents', () => {
      cy.visit('/client/documents')
      cy.get('[data-testid="document-list"]').should('exist')
    })

    it('should download signed documents', () => {
      cy.visit('/client/documents')
      cy.get('[data-testid="download-btn"]').first().click()
      // Verify download initiated
      cy.readFile('cypress/downloads/document.pdf').should('exist')
    })

    it('should show document signing status', () => {
      cy.visit('/client/documents')
      cy.contains('Awaiting Signature').should('be.visible')
    })

    it('should open DocuSign for pending documents', () => {
      cy.visit('/client/documents')
      cy.get('[data-testid="sign-btn"]').first().click()
      // Should redirect to DocuSign or show embedded signing
      cy.url().should('match', /docusign|sign/)
    })
  })

  describe('Communication', () => {
    it('should display message history', () => {
      cy.visit('/client/messages')
      cy.get('[data-testid="message-list"]').should('exist')
    })

    it('should send new message', () => {
      cy.visit('/client/messages')
      cy.get('#messageInput').type('Hello, I have a question about my case.')
      cy.get('button').contains('Send').click()
      cy.contains('Hello, I have a question').should('be.visible')
    })

    it('should show unread message count', () => {
      cy.visit('/client')
      cy.get('[data-testid="unread-badge"]').should('exist')
    })

    it('should mark messages as read', () => {
      cy.visit('/client/messages')
      cy.get('[data-testid="unread-message"]').first().click()
      cy.get('[data-testid="unread-message"]').should('have.length.lessThan', 5)
    })
  })

  describe('Notifications', () => {
    it('should display notification center', () => {
      cy.get('[data-testid="notification-bell"]').click()
      cy.get('[data-testid="notification-dropdown"]').should('be.visible')
    })

    it('should show case update notifications', () => {
      cy.get('[data-testid="notification-bell"]').click()
      cy.contains('Case Update').should('be.visible')
    })

    it('should mark notification as read', () => {
      cy.get('[data-testid="notification-bell"]').click()
      cy.get('[data-testid="notification-item"]').first().click()
      cy.get('[data-testid="notification-item"]').first().should('not.have.class', 'unread')
    })
  })

  describe('Profile Management', () => {
    it('should display client profile', () => {
      cy.visit('/client/profile')
      cy.contains('Profile').should('be.visible')
      cy.get('#email').should('have.value', 'client@example.com')
    })

    it('should update contact information', () => {
      cy.visit('/client/profile')
      cy.get('#phone').clear().type('555-123-4567')
      cy.get('button').contains('Save').click()
      cy.contains('Profile updated').should('be.visible')
    })

    it('should update notification preferences', () => {
      cy.visit('/client/profile')
      cy.get('#emailNotifications').click()
      cy.get('button').contains('Save').click()
      cy.contains('Preferences updated').should('be.visible')
    })
  })

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x')
      cy.visit('/client')
      cy.get('[data-testid="mobile-menu"]').should('be.visible')
      cy.get('[data-testid="mobile-menu"]').click()
      cy.contains('Cases').should('be.visible')
      cy.contains('Documents').should('be.visible')
    })

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2')
      cy.visit('/client/cases')
      cy.get('[data-testid="case-list"]').should('be.visible')
    })
  })
})
