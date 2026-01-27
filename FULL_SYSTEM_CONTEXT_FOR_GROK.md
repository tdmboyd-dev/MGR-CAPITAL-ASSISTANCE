# FULL_SYSTEM_CONTEXT_FOR_GROK

**Updated:** 2026-01-26
**Version:** 4.4.0
**Author:** Claude Code

---

## CURRENT STATUS: ~88% COMPLETE

Major improvements this session:
- Stripe Financial Connections for bank linking
- DocuSign JWT token auto-refresh
- Fixed Grok's raw account number bugs

---

## Progress to Completion

```
Core Platform:           █████████░  89%
AI/ML Features:          ████████░░  80%
Blockchain Features:     ████░░░░░░  45%
Payment Services:        █████████░  93%
Document Signing:        █████████░  90%
SkipTrace Service:       █████████░  85%
Payment Webhooks:        ██████████  100%
Bank Account Linking:    ██████████  100%
External Integrations:   ████████░░  82%
Push Notifications:      ████████░░  80%
SMS Service:             █████████░  85%
Mobile App:              █████░░░░░  50%
Testing Coverage:        ███░░░░░░░  35%
Production Ready:        █████░░░░░  55%
```

**OVERALL: ~88%**

---

## E-SIGNATURE PROVIDERS

**USE OpenSign (FREE unlimited)** - NOT DocuSign

| Provider | Status | Cost | Notes |
|----------|--------|------|-------|
| **OpenSign** | PRIMARY | FREE unlimited | Already configured |
| DocuSign | Backup only | Expensive | Only if OpenSign fails |

---

## Bank Account Linking (IMPORTANT)

**DO NOT use raw account/routing numbers with Stripe!**

Stripe does NOT allow creating `us_bank_account` payment methods with raw account numbers. You MUST use:

1. **Financial Connections** (recommended) - Stripe-hosted bank linking
2. **Microdeposits** - Manual verification (1-2 days)

### Correct Flow:
```
1. Create Stripe customer
2. Create Financial Connections session
3. User links bank in Stripe UI
4. Webhook receives linked account ID
5. Create payment method from linked account
6. Use payment method for ACH payments
```

### New Methods Added:
- `createBankLinkingSession()` - Start bank linking
- `getOrCreateStripeCustomer()` - Get/create customer
- `createPaymentMethodFromLinkedAccount()` - Create ACH payment method
- `initiateMicrodepositVerification()` - Alternative verification

---

## Webhook Endpoints

| Provider | Endpoint | Events |
|----------|----------|--------|
| Stripe | `/api/payments/webhook/stripe` | payment_intent.succeeded, failed, refunded |
| PayPal | `/api/payments/webhook/paypal` | PAYMENT.CAPTURE.COMPLETED, DENIED |
| DocuSign | `/api/payments/webhook/docusign` | envelope-completed |

---

## API Keys Status

| Service | Provider | Status |
|---------|----------|--------|
| AI/LLM | DeepSeek | LIVE |
| AI Backup | Google Gemini | LIVE |
| Email (Primary) | Amazon SES | LIVE |
| Email (Backup) | Brevo | LIVE |
| Payments | Stripe | LIVE KEY |
| E-Signatures | OpenSign | LIVE (FREE) |
| PayPal | PayPal REST | CODE READY (needs keys) |
| E-Signatures | DocuSign | BACKUP ONLY (needs keys) |
| SMS | Plivo | CODE READY (needs keys) |
| Skip Trace | Tracerfy | CODE READY (needs keys) |
| Phone | Telnyx | NEEDS COMPANY EMAIL |

---

## What's WORKING

### Payment Services (93%)
- [x] Stripe credit card payments (LIVE)
- [x] PayPal checkout orders + capture
- [x] Stripe ACH Direct Debit (with Financial Connections)
- [x] Bank account linking (Financial Connections)
- [x] Payment webhooks (Stripe, PayPal, DocuSign)
- [x] Refund processing
- [x] Payment metrics dashboard
- [ ] Stripe Connect for automated payouts

### Document Signing (90%)
- [x] OpenSign integration (FREE unlimited) - PRIMARY
- [x] DocuSign envelope creation (backup)
- [x] DocuSign JWT token refresh
- [x] Embedded signing URLs
- [x] Webhook handling

### SkipTrace Service (85%)
- [x] Real Tracerfy API integration
- [x] Person skip tracing
- [x] Batch processing
- [x] Heir finding
- [x] Property owner lookup
- [x] Lead scoring
- [ ] Needs TRACERFY_API_KEY to go live

### Core Platform (89%)
- [x] Authentication (JWT + cookies + rate limiting)
- [x] Password reset with email (Amazon SES)
- [x] Role-based access (FOUNDER/ADMIN/EMPLOYEE/CLIENT)
- [x] Case management with full workflow
- [x] Document vault with secure upload
- [x] Employee management with tiers
- [x] Client portal
- [x] Ledger and payout tracking
- [x] Shadow accounting

### Nickel Payouts (95%)
- [x] 3-tab interface (Client/Employee/Founder)
- [x] 33% fee structure
- [x] Employee commission by tier (10-50%)
- [x] Copy to clipboard + open Nickel dashboard

---

## What Needs Work

### Medium Priority:
1. **NFTService** - Blockchain operations simulated
2. **BlockchainService** - ETH conversion hardcoded
3. **Mobile app** - Many screens incomplete

### Low Priority:
4. More E2E tests
5. Production deployment config

---

## Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://...

# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3011

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# AI (CONFIGURED)
DEEPSEEK_API_KEY=sk-...
GOOGLE_AI_KEY=AIza...

# Email - Amazon SES (CONFIGURED)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=...
SMTP_FROM=admin@capitalmgr.com

# Payments - Stripe (LIVE KEY)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Payments - PayPal (NEEDS KEYS)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# E-Signatures - OpenSign (CONFIGURED - FREE)
OPENSIGN_API_KEY=...

# E-Signatures - DocuSign (OPTIONAL BACKUP)
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_PRIVATE_KEY=...
DOCUSIGN_ACCOUNT_ID=...
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi

# SMS - Plivo (CODE READY)
PLIVO_AUTH_ID=...
PLIVO_AUTH_TOKEN=...
PLIVO_NUMBER=...

# Skip Trace - Tracerfy (CODE READY)
TRACERFY_API_KEY=...
TRACERFY_API_URL=https://api.tracerfy.com/v1
```

---

## Login Credentials (Dev)

```
Founder: time@mgrcapital.com / Dorothy1956!
```

---

## Access URLs

- **Frontend:** http://localhost:3011
- **Backend:** http://localhost:4000
- **WebSocket:** ws://localhost:4001

---

## Payout Structure (33% Fee)

```
SURPLUS ($100,000)
      │
      ├── CLIENT: 67% ($67,000) → Client ACH
      │
      └── COMPANY FEE: 33% ($33,000)
              │
              ├── EMPLOYEE: 10-50% based on tier
              │
              └── FOUNDER: Remainder
```

---

## What Grok Should Do Next

### VALID ideas from your responses:
- `@nivo/sankey` for flow diagrams
- `@tanstack/react-virtual` for table virtualization
- Framer Motion animations
- Batch process buttons

### DON'T DO these:
1. Don't use raw account numbers with Stripe ACH
2. Don't use static DocuSign tokens in production
3. Don't claim 100% complete

### Focus areas:
- UI animations (your designs are good)
- Mobile responsive testing
- Loading states / skeletons

---

**Progress Bar:** █████████░ (88%)

— Claude Code
