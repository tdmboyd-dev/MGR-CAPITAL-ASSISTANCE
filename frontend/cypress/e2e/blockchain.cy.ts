/**
 * Blockchain Features E2E Tests
 *
 * Tests for:
 * - NFT minting and management
 * - Tokenomics rewards
 * - Oracle service
 */

describe('Blockchain Features', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.get('#email').type('time@mgrcapital.com')
    cy.get('#password').type('Dorothy1956!')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })

  describe('NFT Claim Certificates', () => {
    it('should display NFT minting interface', () => {
      cy.visit('/founder/blockchain/nft')
      cy.contains('NFT').should('be.visible')
      cy.contains('Mint').should('be.visible')
    })

    it('should show minting requirements', () => {
      cy.visit('/founder/blockchain/nft')
      cy.contains('Solana').should('be.visible')
      cy.contains('SPL Token').should('be.visible')
    })

    it('should validate wallet address', () => {
      cy.visit('/founder/blockchain/nft')
      cy.get('#ownerWallet').type('invalid-address')
      cy.get('button').contains('Mint').click()
      cy.contains('Invalid wallet').should('be.visible')
    })

    it('should mint NFT for valid case', () => {
      cy.visit('/founder/blockchain/nft')
      cy.get('#caseId').select(1)
      cy.get('#ownerWallet').type('7nYC8HKKPpd3rL7cDdkr8EYevrEtW1kRqcJjjB7shxKN')
      cy.get('button').contains('Mint').click()
      cy.contains('Minting').should('be.visible')
    })

    it('should display minted NFTs', () => {
      cy.visit('/founder/blockchain/nft')
      cy.get('[data-testid="nft-list"]').should('exist')
    })

    it('should show NFT metadata', () => {
      cy.visit('/founder/blockchain/nft')
      cy.get('[data-testid="nft-card"]').first().click()
      cy.contains('Metadata').should('be.visible')
      cy.contains('Owner').should('be.visible')
    })
  })

  describe('Tokenomics Rewards', () => {
    it('should display tokenomics dashboard', () => {
      cy.visit('/founder/tokenomics')
      cy.contains('MGR Token').should('be.visible')
    })

    it('should show reward rate', () => {
      cy.visit('/founder/tokenomics')
      cy.contains('1%').should('be.visible') // 1% reward rate
    })

    it('should calculate reward preview', () => {
      cy.visit('/founder/tokenomics')
      cy.get('#paymentAmount').type('10000')
      cy.contains('100 MGR').should('be.visible') // 1% of 10000
    })

    it('should display token balance', () => {
      cy.visit('/founder/tokenomics')
      cy.get('[data-testid="token-balance"]').should('exist')
    })

    it('should show total supply', () => {
      cy.visit('/founder/tokenomics')
      cy.get('[data-testid="total-supply"]').should('exist')
    })

    it('should display reward history', () => {
      cy.visit('/founder/tokenomics')
      cy.get('[data-testid="reward-history"]').should('exist')
    })
  })

  describe('State Law Oracle', () => {
    it('should display oracle dashboard', () => {
      cy.visit('/founder/oracle')
      cy.contains('State Law Oracle').should('be.visible')
    })

    it('should show all 50 states', () => {
      cy.visit('/founder/oracle')
      cy.get('[data-testid="state-list"]').should('exist')
      cy.get('[data-testid="state-row"]').should('have.length.at.least', 50)
    })

    it('should display deadline for selected state', () => {
      cy.visit('/founder/oracle')
      cy.get('#stateSelect').select('CA')
      cy.contains('1 year').should('be.visible') // CA deadline
      cy.contains('RTC § 4675').should('be.visible') // Statute
    })

    it('should show recent law changes', () => {
      cy.visit('/founder/oracle')
      cy.get('[data-testid="law-changes"]').should('exist')
    })

    it('should verify deadline calculation', () => {
      cy.visit('/founder/oracle')
      cy.get('#stateSelect').select('FL')
      cy.get('#saleDate').type('2025-01-01')
      cy.get('button').contains('Calculate').click()
      cy.contains('Deadline').should('be.visible')
      cy.contains('2029').should('be.visible') // FL is 4 years
    })
  })

  describe('Blockchain Verification', () => {
    it('should verify document on blockchain', () => {
      cy.visit('/founder/blockchain/verify')
      cy.get('input[type="file"]').attachFile('test-document.pdf')
      cy.get('button').contains('Verify').click()
      cy.contains('Hash').should('be.visible')
    })

    it('should display verification history', () => {
      cy.visit('/founder/blockchain/verify')
      cy.get('[data-testid="verification-history"]').should('exist')
    })

    it('should show Solana transaction link', () => {
      cy.visit('/founder/blockchain/verify')
      cy.get('[data-testid="tx-link"]').should('have.attr', 'href').and('include', 'solana')
    })
  })

  describe('Auction Marketplace', () => {
    it('should display marketplace', () => {
      cy.visit('/founder/marketplace')
      cy.contains('Marketplace').should('be.visible')
    })

    it('should list active auctions', () => {
      cy.visit('/founder/marketplace')
      cy.get('[data-testid="auction-list"]').should('exist')
    })

    it('should create new auction', () => {
      cy.visit('/founder/marketplace/create')
      cy.get('#claimId').select(1)
      cy.get('#startingBid').type('1000')
      cy.get('#duration').type('7')
      cy.get('button').contains('Create').click()
      cy.contains('Auction created').should('be.visible')
    })

    it('should place bid on auction', () => {
      cy.visit('/founder/marketplace')
      cy.get('[data-testid="auction-card"]').first().click()
      cy.get('#bidAmount').type('1500')
      cy.get('button').contains('Place Bid').click()
      cy.contains('Bid placed').should('be.visible')
    })

    it('should show bid history', () => {
      cy.visit('/founder/marketplace')
      cy.get('[data-testid="auction-card"]').first().click()
      cy.get('[data-testid="bid-history"]').should('exist')
    })
  })
})
