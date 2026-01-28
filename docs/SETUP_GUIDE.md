# MGR CAPITAL ASSISTANCE — Plain English Setup Guide

**Last Updated:** 2026-01-28 (Session 31)

---

## What You Need To Get (In Order of Priority)

This guide tells you exactly what accounts and API keys to get to make the platform fully operational. Everything is written in plain English with step-by-step instructions.

---

## 1. PAYMENTS — Accept Money From Clients

### Stripe (REQUIRED - Main Payment Processor)

**What it does:** Accepts credit cards, ACH bank transfers, and handles payouts.

**Steps:**
1. Go to https://stripe.com
2. Click "Start now" and create account
3. Complete business verification (need: EIN, bank account, ID)
4. After approved, go to Developers → API Keys
5. Copy the "Secret key" (starts with `sk_live_`)

**Add to .env:**
```
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Cost:** 2.9% + $0.30 per card transaction, 0.8% for ACH

### Nickel (OPTIONAL - Free ACH)

**What it does:** FREE ACH bank transfers (no fees!)

**Steps:**
1. Go to https://nickel.co
2. Apply for business account
3. After approval, get API key from dashboard

**Add to .env:**
```
NICKEL_API_KEY=your_key_here
```

**Cost:** FREE for ACH transfers

---

## 2. EMAIL — Send Notifications to Clients

### Amazon SES (RECOMMENDED - Cheapest)

**What it does:** Sends emails for $0.10 per 1,000 emails

**Steps:**
1. Go to https://aws.amazon.com and create account
2. Search for "SES" (Simple Email Service)
3. Click "Create identity" → Add your domain (mgrcapital.com)
4. Add the DNS records they give you (in your domain registrar)
5. Go to "SMTP settings" → "Create SMTP credentials"
6. Copy the username and password

**Add to .env:**
```
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@mgrcapital.com
```

**Cost:** $0.10 per 1,000 emails

### SendGrid (ALTERNATIVE)

**Steps:**
1. Go to https://sendgrid.com
2. Create free account
3. Settings → API Keys → Create API Key

**Add to .env:**
```
SENDGRID_API_KEY=SG.your_key_here
```

**Cost:** Free for 100 emails/day, then $15/month for 40,000

---

## 3. DOCUMENT E-SIGNATURES — Get Contracts Signed

### OpenSign (RECOMMENDED - FREE Unlimited)

**What it does:** Free unlimited e-signatures (like DocuSign but free)

**Steps:**
1. Go to https://opensignlabs.com
2. Create free account
3. Go to Settings → API → Generate API Key

**Add to .env:**
```
OPENSIGN_API_KEY=your_key_here
OPENSIGN_API_URL=https://app.opensignlabs.com/api
```

**Cost:** FREE (unlimited signatures)

### DocuSign (BACKUP ONLY - Expensive)

Only use if you need specific DocuSign features.

**Steps:**
1. Go to https://www.docusign.com/developers
2. Create developer account
3. Create "Integration Key"
4. Generate RSA keypair
5. Get User ID from admin panel

**Add to .env:**
```
DOCUSIGN_INTEGRATION_KEY=your_integration_key
DOCUSIGN_USER_ID=your_user_guid
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_ACCOUNT_ID=your_account_id
DOCUSIGN_BASE_URL=https://na4.docusign.net
```

**Cost:** $10-$25+ per envelope (expensive!)

---

## 4. SKIP TRACING — Find Heir Contact Info

### Tracerfy (RECOMMENDED - Cheapest)

**What it does:** Finds phone numbers and addresses for heirs

**Steps:**
1. Go to https://tracerfy.com
2. Create business account
3. Add credits ($50 minimum)
4. Get API key from dashboard

**Add to .env:**
```
TRACERFY_API_KEY=your_key_here
```

**Cost:** $0.01-$0.05 per lookup

### BeenVerified (ALTERNATIVE)

**Steps:**
1. Go to https://beenverified.com/api
2. Apply for API access (business only)

**Cost:** $0.10+ per lookup

---

## 5. AI SERVICES — Smart Document Analysis

### DeepSeek (PRIMARY - 95% Cheaper Than OpenAI)

**What it does:** Analyzes documents, writes letters, answers questions

**Steps:**
1. Go to https://platform.deepseek.com
2. Create account
3. Go to API Keys → Create new key

**Add to .env:**
```
DEEPSEEK_API_KEY=sk-your_key_here
```

**Cost:** $0.014/$0.028 per million tokens (95% cheaper than OpenAI!)

### Google Gemini (BACKUP)

**Steps:**
1. Go to https://aistudio.google.com
2. Click "Get API Key"
3. Create new key

**Add to .env:**
```
GOOGLE_AI_KEY=AIza...your_key
```

**Cost:** Free tier available, then $0.075/$0.30 per million tokens

### OpenAI (BACKUP)

**Steps:**
1. Go to https://platform.openai.com
2. Create account, add payment method
3. API Keys → Create new secret key

**Add to .env:**
```
OPENAI_API_KEY=sk-your_key_here
```

**Cost:** $0.15/$0.60 per million tokens (expensive!)

---

## 6. PHONE CALLS — Auto-Dialer and Voice

### Telnyx (RECOMMENDED)

**What it does:** Makes/receives phone calls, sends SMS

**Steps:**
1. Go to https://telnyx.com
2. Create account
3. Buy a phone number ($1/month)
4. Get API key from portal

**Add to .env:**
```
TELNYX_API_KEY=KEY...your_key
TELNYX_PHONE_NUMBER=+1XXXXXXXXXX
```

**Cost:** $1/month per number + $0.005/minute

### Twilio (ALTERNATIVE)

**Steps:**
1. Go to https://twilio.com
2. Create account
3. Get Account SID and Auth Token from dashboard

**Add to .env:**
```
TWILIO_SID=AC...your_sid
TWILIO_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

**Cost:** $1/month per number + $0.0085/minute

---

## 7. BLOCKCHAIN — ETH Payouts (Optional)

### Ethereum Wallet

**What it does:** Send cryptocurrency payouts to clients who prefer ETH

**Steps:**
1. Create Ethereum wallet (MetaMask, hardware wallet, etc.)
2. Get your wallet's private key (KEEP SECRET!)
3. Fund wallet with ETH for gas fees

**Add to .env:**
```
ETHEREUM_NETWORK=mainnet
ETHEREUM_PRIVATE_KEY=0x...your_private_key
ETHEREUM_WALLET_ADDRESS=0x...your_address
```

**Cost:** Only gas fees when sending (varies $0.50-$5)

---

## 8. PROFESSIONAL EMAIL — Custom Domain Email

### Zoho Mail (RECOMMENDED - FREE for 5 Users)

**What it does:** Email like yourname@mgrcapital.com

**Steps:**
1. Go to https://zoho.com/mail
2. Choose "Free Plan" (5 users, 5GB each)
3. Add your domain and verify with DNS records
4. Get API credentials from developer console

**Add to .env:**
```
ZOHO_MAIL_API_KEY=your_key_here
```

**Cost:** FREE for 5 users, $1/user/month after

### ImprovMX (ALTERNATIVE - Email Forwarding)

**What it does:** Forward emails to your Gmail/personal email

**Steps:**
1. Go to https://improvmx.com
2. Add your domain
3. Set up forwarding rules
4. Get API key

**Add to .env:**
```
IMPROVMX_API_KEY=your_key_here
```

**Cost:** FREE for basic forwarding

---

## 9. NOTARY SERVICES — Remote Online Notarization

### Notarize.com API (RECOMMENDED)

**What it does:** Legally notarizes documents online via video call

**Steps:**
1. Go to https://business.notarize.com
2. Apply for API partnership (business verification required)
3. After approval, get API credentials

**Add to .env:**
```
NOTARIZE_API_KEY=your_key_here
NOTARIZE_API_SECRET=your_secret_here
```

**Cost:** $25 per notarization (you charge clients)

### NotaryCam (ALTERNATIVE)

**Steps:**
1. Go to https://notarycam.com/partners
2. Apply for integration
3. Get API credentials after approval

**Add to .env:**
```
NOTARYCAM_API_KEY=your_key_here
```

**Cost:** $25-50 per notarization

---

## 10. DATABASE — Store All Data

### PostgreSQL (REQUIRED)

**For Development:**
1. Install PostgreSQL on your computer
2. Create a database called `mgrcapital`

**For Production (Recommended: Supabase):**
1. Go to https://supabase.com
2. Create free project
3. Copy the database URL from Settings → Database

**Add to .env:**
```
DATABASE_URL=postgresql://username:password@host:5432/mgrcapital
```

**Cost:** Supabase free tier is generous, then $25/month

---

## COMPLETE .ENV FILE TEMPLATE

Copy this to your `.env` file and fill in your keys:

```env
# ============================================
# DATABASE (REQUIRED)
# ============================================
DATABASE_URL=postgresql://username:password@localhost:5432/mgrcapital

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=generate_a_long_random_string_at_least_32_characters
JWT_REFRESH_SECRET=another_long_random_string_at_least_32_characters
SESSION_SECRET=yet_another_random_string

# ============================================
# PAYMENTS
# ============================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional: Free ACH
NICKEL_API_KEY=...

# ============================================
# EMAIL
# ============================================
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=...
SMTP_FROM=noreply@mgrcapital.com

# ============================================
# DOCUMENT SIGNING (OpenSign is FREE!)
# ============================================
OPENSIGN_API_KEY=...
OPENSIGN_API_URL=https://app.opensignlabs.com/api

# ============================================
# AI SERVICES (Priority order for fallback)
# ============================================
# Primary - 95% cheaper than OpenAI
DEEPSEEK_API_KEY=sk-...
# Backup 1
GOOGLE_AI_KEY=AIza...
# Backup 2 (expensive, use as last resort)
OPENAI_API_KEY=sk-...

# ============================================
# SKIP TRACING
# ============================================
TRACERFY_API_KEY=...

# ============================================
# PHONE/SMS
# ============================================
TELNYX_API_KEY=KEY...
TELNYX_PHONE_NUMBER=+1...

# ============================================
# BLOCKCHAIN (Optional)
# ============================================
ETHEREUM_NETWORK=mainnet
ETHEREUM_PRIVATE_KEY=0x...
ETHEREUM_WALLET_ADDRESS=0x...

# ============================================
# NOTARY
# ============================================
NOTARIZE_API_KEY=...
NOTARIZE_API_SECRET=...

# ============================================
# PROFESSIONAL EMAIL
# ============================================
ZOHO_MAIL_API_KEY=...

# ============================================
# SERVER CONFIG
# ============================================
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://app.mgrcapital.com
```

---

## COST SUMMARY (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Stripe | 2.9% + $0.30/txn | Only when processing cards |
| Nickel ACH | FREE | No fees! |
| Amazon SES | ~$1-5 | Based on email volume |
| OpenSign | FREE | Unlimited signatures |
| DeepSeek AI | ~$5-20 | 95% cheaper than OpenAI |
| Tracerfy | ~$10-50 | $0.01-0.05 per lookup |
| Telnyx | ~$10-50 | $1/month + usage |
| Zoho Mail | FREE | Up to 5 users |
| Supabase DB | FREE-$25 | Free tier is generous |
| **TOTAL** | **~$30-150/month** | Depends on usage |

---

## 4-TIER PARTNER HIERARCHY

The platform uses a 4-tier partner hierarchy:

### Partner Levels

| Level | Title | Monthly | Yearly | Can Have Under Them |
|-------|-------|---------|--------|---------------------|
| 1 | Managing Partner | $999 | $9,999 | Executive Partners + Recovery Directors (unlimited) |
| 2 | Executive Partner | $499 | $4,999 | Recovery Directors (up to 50) |
| 3 | Recovery Director | $199 | $1,999 | Recovery Specialists (up to 25) |
| 4 | Recovery Specialist | $49 | $499 | Clients only |

### Fee Structure (What Partners See)

Partners see professional fee names - never "platform takes X%":

| Level | Fee Label They See |
|-------|-------------------|
| Managing Partner | "Legal & Compliance Fees" (15%) |
| Executive Partner | "Filing & Processing Fees" (25%) |
| Recovery Director | "Administrative & Filing Fees" (35%) |
| Recovery Specialist | "Processing & Document Fees" (45%) |

### Revenue Flow

When a client pays $100:

```
Client pays: $100
    │
    ▼
Recovery Specialist sees: "$100 gross - $45 Processing & Document Fees = $55 net"
Recovery Specialist ACTUALLY gets: $45
    │
    ▼ (hidden cut)
Recovery Director takes: $10 (RS thinks it's part of "Processing Fees")
    │
    ▼ (hidden cut)
Executive Partner takes: $10 (RD thinks it's "Filing Fees")
    │
    ▼ (hidden cut)
Managing Partner takes: $10 (EP thinks it's "Administrative Fees")
    │
    ▼
Home Office (MGR Capital) gets: $25
```

### What Each Level SEES vs GETS

| Level | They SEE | They ACTUALLY GET |
|-------|----------|-------------------|
| Managing Partner | 85% net after "Legal & Compliance Fees" | 75% |
| Executive Partner | 75% net after "Filing & Processing Fees" | 65% |
| Recovery Director | 65% net after "Administrative & Filing Fees" | 55% |
| Recovery Specialist | 55% net after "Processing & Document Fees" | 45% |

**The key:** Partners see professional fee names that sound like legitimate costs (court filing, compliance, processing). They never know upline partners take cuts.

---

## CERTIFIED NOTARY EARNINGS

Notaries see "Processing & Compliance Fees" - never "platform takes X%":

| Level | Signings | Notary Sees | Fee Label |
|-------|----------|-------------|-----------|
| Associate Notary | 0+ | 45% net after fees | "Processing & Compliance Fees" |
| Certified Notary | 10+ | 48% net after fees | "Processing & Compliance Fees" |
| Senior Notary | 50+ | 50% net after fees | "Processing & Compliance Fees" |
| Lead Notary | 200+ | 52% net after fees | "Processing & Compliance Fees" |
| Executive Notary | 500+ | 55% net after fees | "Processing & Compliance Fees" |

**Fee Breakdown (What Notaries Think It Covers):**
- Court & Filing Fees
- Insurance & Bonding
- Technology & Recording
- Administrative Processing

**Example (Associate Notary):**
- Client pays: $25 for standard notarization
- Notary sees: "Gross: $25, Processing & Compliance Fees: $13.75, Net: $11.25"
- Notary thinks: "Fees cover court filing, insurance, technology, and admin costs"
- Reality: Home Office keeps $13.75

Notaries believe fees are legitimate operating costs. They never know the actual revenue split.

---

## QUICK START CHECKLIST

1. [ ] Set up PostgreSQL database
2. [ ] Create Stripe account
3. [ ] Set up Amazon SES for email
4. [ ] Get OpenSign API key (FREE e-signatures)
5. [ ] Get DeepSeek API key (cheap AI)
6. [ ] Fill in .env file
7. [ ] Run: `cd backend && npm install`
8. [ ] Run: `npx prisma migrate dev`
9. [ ] Run: `npm run dev`
10. [ ] Login at localhost:3011 with time@mgrcapital.com / Dorothy1956!

---

**Need Help?** Contact the developer or check the docs folder for more detailed guides.

---

END OF SETUP GUIDE
