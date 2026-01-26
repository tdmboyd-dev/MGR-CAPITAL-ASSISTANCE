# SETUP INSTRUCTIONS — MGR CAPITAL ASSISTANCE

## What's Already Configured (Your API Keys)

| Service | Status | Key |
|---------|--------|-----|
| DeepSeek (AI) | CONFIGURED | sk-bf56...a988 |
| Google Gemini (AI backup) | CONFIGURED | AIzaS...OcuM |
| Brevo (Email) | CONFIGURED | xkeys...GCxs |
| Stripe (Payments) | CONFIGURED (LIVE!) | sk_live...QTaH |
| OpenSign (E-Signatures) | CONFIGURED | LVQjD...JE92 |

---

## What Still Needs Setup

### 1. Phone Calls - WORKAROUND

**Problem:** Telnyx, Twilio, Plivo all need company email.

**Solutions:**
1. **Get a company email:** Use Google Workspace ($6/mo) or Zoho Mail (FREE for 5 users)
   - Go to https://workspace.google.com/ OR https://www.zoho.com/mail/
   - Register mgrcapital.com (or your domain)
   - Create admin@mgrcapital.com

2. **Use the existing demo mode:** Phone calls are simulated (logged but not dialed)
   - This is fine for testing and development
   - Real calls only matter for production

---

### 2. Amazon SES - How to Find Your Keys

You said you have an account but can't find the keys. Here's exactly where:

1. Go to https://console.aws.amazon.com/
2. Search for "SES" in the top search bar
3. Click "Amazon Simple Email Service"
4. In the left sidebar, click "SMTP settings"
5. Click "Create SMTP credentials"
6. Give it a name like "mgr-capital-ses"
7. Click "Create"
8. **IMPORTANT:** Download or copy the credentials NOW (you only see them once!)

The credentials will look like:
```
SMTP Username: AKIA...
SMTP Password: BG8p...
```

Add to your .env:
```
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=BG8p...
```

**Note:** You must verify your email domain in SES first. Go to "Verified identities" and add your domain.

---

### 3. Nickel Payments - The Reality

**What Nickel is:** A dashboard for FREE ACH transfers. NOT an API.

**What this means:**
- You CAN'T automate payments through Nickel via code
- You use their web dashboard manually to send ACH payments
- Good for: Manually paying out recovered funds to clients
- Not good for: Automated payment collection

**For automated payments:** Stripe is already configured and is the best option.

**Nickel use case:**
1. Client recovers $50,000 surplus
2. Your fee is $15,000 (30%)
3. You receive $50,000 from county via check/wire
4. Log into Nickel dashboard
5. Send $35,000 to client via FREE ACH
6. Keep $15,000

---

### 4. Tracerfy - Business Verification

**Problem:** You don't know how to verify your business.

**What they typically need:**
1. Business name (MGR Capital Assistance LLC)
2. EIN/Tax ID number
3. Business address
4. Business license or articles of incorporation
5. Brief description of use case ("We locate property owners for surplus fund recovery")

**Steps:**
1. Go to https://www.tracerfy.com/
2. Click "Get Started" or "Contact Sales"
3. Fill out the form with your business info
4. In the "How will you use this?" field, write:
   > "We are a surplus fund recovery company that helps property owners claim unclaimed funds from tax sales. We need skip trace services to locate rightful property owners."
5. They'll email you within 1-2 business days

---

### 5. DocuSeal - FREE Self-Hosted E-Signatures

Since OpenSign key might not work (I assumed it was OpenSign), here's a FREE alternative you can run yourself:

**One-time setup:**
```bash
docker run --name docuseal -p 3000:3000 -v docuseal_data:/data docuseal/docuseal
```

Then access at: http://localhost:3000

**Features:**
- FREE unlimited signatures
- No monthly fees
- You own all the data
- Has a REST API for automation

---

## Quick Status Check

Run this to verify your services are connecting:

```bash
cd backend
npm run dev
```

Then check the console for:
- `[PhoneBot] Using DEMO mode` (expected - no phone API)
- `[EmailService] Using BREVO` (should show!)
- `[PaymentService] Using STRIPE live` (should show!)

---

## What's Working NOW

| Feature | Status | Notes |
|---------|--------|-------|
| AI Chat | WORKING | DeepSeek + Gemini configured |
| Payments | WORKING | Stripe LIVE key configured |
| Email | WORKING | Brevo configured (300/day free) |
| E-Signatures | TESTING | OpenSign key added, needs verification |
| Phone Calls | DEMO MODE | Simulated until you get company email |
| Skip Trace | DEMO MODE | Simulated until Tracerfy verified |
| Voice Biometrics | WORKING | Browser-based, no API needed |
| Fraud Detection | WORKING | TensorFlow.js, no API needed |
| Litigation Sim | WORKING | TensorFlow.js, no API needed |

---

## Company Email Options (to unlock Phone/SMS)

| Provider | Price | Setup Time |
|----------|-------|------------|
| Zoho Mail | FREE (5 users) | 30 mins |
| Google Workspace | $6/user/mo | 15 mins |
| Microsoft 365 | $6/user/mo | 15 mins |
| Proton Mail | $4/user/mo | 20 mins |

**Recommended:** Zoho Mail (FREE) if you just need 1-2 emails for API signups.

---

**Created by Claude Code**
