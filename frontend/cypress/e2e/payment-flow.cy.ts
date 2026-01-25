/**
 * Payment Flow E2E Tests
 *
 * Tests for the complete payment and tokenomics flow:
 * - Stripe payment processing
 * - Nickel PSD2 integration
 * - Token reward distribution
 */

describe('Payment Flow', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.get('#email').type('time@mgrcapital.com')
    cy.get('#password').type('Dorothy1956!')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })

  describe('Payment Dashboard', () => {
    it('should display payment history', () => {
      cy.visit('/founder/payments')
      cy.contains('Payment').should('be.visible')
      cy.get('[data-testid="payment-table"]').should('exist')
    })

    it('should show pending payouts', () => {
      cy.visit('/founder/payments')
      cy.contains('Pending').should('be.visible')
    })

    it('should display total recovered amount', () => {
      cy.visit('/founder/payments')
      cy.get('[data-testid="total-recovered"]').should('exist')
    })
  })

  describe('Payment Processing', () => {
    it('should initiate new payment request', () => {
      cy.visit('/founder/payments/new')
      cy.get('#amount').type('5000')
      cy.get('#caseId').select(1)
      cy.get('button').contains('Process').click()
      cy.contains('Payment initiated').should('be.visible')
    })

    it('should validate payment amount', () => {
      cy.visit('/founder/payments/new')
      cy.get('#amount').type('-100')
      cy.get('button').contains('Process').click()
      cy.contains('Invalid amount').should('be.visible')
    })

    it('should show payment confirmation', () => {
      cy.visit('/founder/payments')
      cy.get('[data-testid="payment-row"]').first().click()
      cy.contains('Payment Details').should('be.visible')
      cy.contains('Status').should('be.visible')
      cy.contains('Transaction ID').should('be.visible')
    })
  })

  describe('Tokenomics Rewards', () => {
    it('should display token balance', () => {
      cy.visit('/founder/tokenomics')
      cy.contains('MGR Token').should('be.visible')
      cy.get('[data-testid="token-balance"]').should('exist')
    })

    it('should show reward history', () => {
      cy.visit('/founder/tokenomics')
      cy.get('[data-testid="reward-history"]').should('exist')
    })

    it('should calculate 1% reward on payment', () => {
      cy.visit('/founder/tokenomics')
      cy.get('#simulatePayment').type('10000')
      cy.get('button').contains('Calculate').click()
      cy.contains('100 MGR').should('be.visible') // 1% of 10000
    })
  })

  describe('Fee Breakdown', () => {
    it('should display fee structure', () => {
      cy.visit('/founder/fees')
      cy.contains('Fee Structure').should('be.visible')
      cy.contains('Service Fee').should('be.visible')
      cy.contains('Processing Fee').should('be.visible')
    })

    it('should calculate fees for case', () => {
      cy.visit('/founder/fees')
      cy.get('#caseAmount').type('50000')
      cy.get('button').contains('Calculate').click()
      cy.get('[data-testid="fee-breakdown"]').should('exist')
    })
  })
})
