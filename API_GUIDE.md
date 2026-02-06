# API GUIDE — MGR CAPITAL ASSISTANCE

**Last Updated:** 2026-02-05
**Purpose:** Complete list of all APIs needed with setup directions and pricing

---

## REQUIRED APIs (Must Have for Production)

### 1. DeepSeek AI (Primary LLM) ⭐ RECOMMENDED
**Purpose:** AI chat, document analysis, legal compliance checking, heir genealogy predictions
**Env Variable:** `DEEPSEEK_API_KEY`
**Pricing:** $0.14/million input tokens, $0.28/million output tokens (cheapest quality LLM)
**Setup:**
1. Go to: https://platform.deepseek.com/
2. Sign up and verify email
3. Go to API Keys → Create new key
4. Add to .env: `DEEPSEEK_API_KEY=sk-xxxx`

**Cost Estimate:** ~$5-20/month for typical surplus recovery workload

---

### 2. Stripe (Payment Processing)
**Purpose:** Client payments, subscription billing, webhook processing
**Env Variables:**
- `STRIPE_SECRET_KEY` - API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret
**Pricing:** 2.9% + $0.30 per transaction
**Setup:**
1. Go to: https://dashboard.stripe.com/
2. Create account (verify identity for live mode)
3. Developers → API Keys → Copy Secret key
4. Developers → Webhooks → Add endpoint → Copy signing secret
5. Add to .env:
   ```
   STRIPE_SECRET_KEY=sk_live_xxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxx
   ```

---

### 3. Brevo (Transactional Email Fallback)
**Purpose:** Email delivery when Modoboa SMTP fails, marketing emails
**Env Variable:** `BREVO_API_KEY`
**Pricing:** FREE for 300 emails/day, $25/mo for 20K emails
**Setup:**
1. Go to: https://www.brevo.com/
2. Sign up → SMTP & API → API Keys → Create
3. Add to .env: `BREVO_API_KEY=xkeysib-xxxx`

---

### 4. Modoboa Email Server (Self-Hosted)
**Purpose:** Professional email accounts, IMAP inbox access
**Env Variables:**
- `MODOBOA_API_URL` - http://217.77.14.51:8000/api/v2
- `MODOBOA_API_TOKEN` - Admin token
- `IMAP_HOST`, `IMAP_PORT`, `SMTP_HOST`, `SMTP_PORT`
**Pricing:** FREE (self-hosted on your Contabo VPS)
**Setup:** Already installed on 217.77.14.51
- Admin: https://mail.capitalmgr.com
- Generate token in admin settings

---

## OPTIONAL APIs (Enable Features When Needed)

### 5. OpenAI (Alternative LLM)
**Purpose:** Fallback LLM, GPT-4 for complex analysis
**Env Variable:** `OPENAI_API_KEY`
**Pricing:** $5/million input, $15/million output tokens (GPT-4o)
**Setup:**
1. Go to: https://platform.openai.com/
2. Sign up → API Keys → Create
3. Add to .env: `OPENAI_API_KEY=sk-xxxx`

---

### 6. Google Gemini (Alternative LLM)
**Purpose:** Free LLM fallback, document processing
**Env Variable:** `GOOGLE_AI_KEY`
**Pricing:** FREE up to 60 requests/minute
**Setup:**
1. Go to: https://aistudio.google.com/
2. Get API Key → Create
3. Add to .env: `GOOGLE_AI_KEY=AIzaSy-xxxx`

---

### 7. OpenSign (Document Signing) ⭐ FREE
**Purpose:** Electronic signatures on legal documents
**Env Variable:** `OPENSIGN_API_KEY`
**Pricing:** FREE unlimited (open source alternative to DocuSign)
**Setup:**
1. Go to: https://www.opensignlabs.com/
2. Sign up → Get API Key
3. Add to .env: `OPENSIGN_API_KEY=xxxx`

---

### 8. Notarize.com (Remote Online Notarization)
**Purpose:** 24/7 RON for legal documents
**Env Variables:**
- `NOTARIZE_API_KEY`
- `NOTARIZE_API_URL`
**Pricing:** $25/notarization (pass through to client + markup)
**Setup:**
1. Go to: https://www.notarize.com/enterprise
2. Apply for API access
3. Get credentials after approval
4. Add to .env:
   ```
   NOTARIZE_API_KEY=xxxx
   NOTARIZE_API_URL=https://api.notarize.com/v1
   ```

---

### 9. NotaryCam (Alternative RON)
**Purpose:** Alternative notarization provider
**Env Variables:**
- `NOTARYCAM_API_KEY`
- `NOTARYCAM_API_URL`
**Pricing:** ~$25/session
**Setup:**
1. Go to: https://www.notarycam.com/enterprise
2. Apply for API access
3. Add to .env after approval

---

### 10. Nickel Payments (ACH Processing)
**Purpose:** Direct bank transfers, ACH debits/credits
**Env Variables:**
- `NICKEL_API_KEY`
- `NICKEL_API_URL`
- `NICKEL_WEBHOOK_SECRET`
**Pricing:** $0.50/ACH transaction (much cheaper than cards)
**Setup:**
1. Go to: https://www.getnickel.com/
2. Apply for business account
3. Complete underwriting
4. Add to .env after approval

---

### 11. Telnyx (Voice/SMS)
**Purpose:** Automated phone calls, SMS notifications
**Env Variable:** `TELNYX_API_KEY`
**Pricing:** $0.007/min voice, $0.004/SMS
**Setup:**
1. Go to: https://telnyx.com/
2. Sign up → Mission Control Portal
3. Auth → API Keys → Create
4. Add to .env: `TELNYX_API_KEY=KEY-xxxx`

---

### 12. PayPal (Alternative Payments)
**Purpose:** Alternative payment method for clients
**Env Variables:**
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
**Pricing:** 2.89% + $0.49 per transaction
**Setup:**
1. Go to: https://developer.paypal.com/
2. Create app → Get credentials
3. Add to .env

---

## BLOCKCHAIN APIs (Optional - NFT Features)

### 13. Infura (Ethereum RPC)
**Purpose:** Ethereum blockchain access for NFT minting
**Env Variable:** `ETHEREUM_RPC_URL`
**Pricing:** FREE up to 100K requests/day
**Setup:**
1. Go to: https://infura.io/
2. Create project → Copy endpoint
3. Add to .env: `ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/xxxx`

### 14. Solana (NFT/Token)
**Purpose:** Solana blockchain for tokens
**Env Variable:** `SOLANA_PRIVATE_KEY`
**Pricing:** ~$0.00025/transaction
**Setup:** Generate keypair with Solana CLI

---

## SECURITY KEYS (Required)

### JWT Authentication
```env
JWT_SECRET=your-secure-random-string-32-chars
JWT_REFRESH_SECRET=another-secure-random-string-32
ENCRYPTION_KEY=32-character-encryption-key-here
```

Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## INFRASTRUCTURE (Already Set Up)

### Contabo VPS (217.77.14.51)
- **SSH:** root / MgrServer2026Growth
- **VNC:** 144.126.136.49:63214
- **Customer ID:** 14594723
- **Plan:** Cloud VPS S ($7.24/mo)
- **Services:** Modoboa, MinIO, Nginx, PostgreSQL, Redis

### MinIO Storage (Self-Hosted)
- **Endpoint:** http://217.77.14.51:9000
- **Console:** http://217.77.14.51:9001
- **Access Key:** mgrcapital
- **Secret Key:** MgrStorage2026Secure!
- **Bucket:** mgr-documents
- **Capacity:** 60GB

---

## RECOMMENDED SETUP ORDER

### Phase 1: MVP (Free/Low Cost)
1. ✅ DeepSeek AI - $5-10/mo
2. ✅ Brevo - FREE
3. ✅ OpenSign - FREE
4. ✅ Google Gemini - FREE
5. ✅ Modoboa - Already running

### Phase 2: Payments
6. Stripe - Pay per transaction
7. Nickel ACH - $0.50/transaction

### Phase 3: Full Features
8. Notarize.com - $25/notarization
9. Telnyx - Pay per use

---

## TOTAL MONTHLY COSTS (Estimated)

| Service | Free Tier | Typical Usage | High Volume |
|---------|-----------|---------------|-------------|
| DeepSeek AI | - | $10-20 | $50-100 |
| Brevo Email | 300/day | $25/mo | $65/mo |
| Stripe | - | % of revenue | % of revenue |
| OpenSign | FREE | FREE | FREE |
| Modoboa | FREE | FREE | FREE |
| MinIO | FREE | FREE | FREE |
| Contabo VPS | $7.24 | $7.24 | $14-36 |
| **TOTAL** | **~$7** | **~$45-60** | **~$150-200** |

---

## ENV FILE TEMPLATE

```env
# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:pass@localhost:5432/mgr_capital

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=generate-32-char-random-string
JWT_REFRESH_SECRET=generate-32-char-random-string-2
ENCRYPTION_KEY=generate-32-char-for-encryption

# ============================================
# AI PROVIDERS (pick one or more)
# ============================================
DEEPSEEK_API_KEY=sk-xxxx
# OPENAI_API_KEY=sk-xxxx
# GOOGLE_AI_KEY=AIzaSy-xxxx

# ============================================
# EMAIL
# ============================================
SMTP_HOST=mail.capitalmgr.com
SMTP_PORT=587
SMTP_USER=noreply@capitalmgr.com
SMTP_PASS=xxxx
BREVO_API_KEY=xkeysib-xxxx

# ============================================
# MODOBOA (Self-Hosted Email)
# ============================================
MODOBOA_API_URL=http://217.77.14.51:8000/api/v2
MODOBOA_API_TOKEN=xxxx
IMAP_HOST=mail.capitalmgr.com
IMAP_PORT=993

# ============================================
# PAYMENTS
# ============================================
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
# NICKEL_API_KEY=xxxx
# PAYPAL_CLIENT_ID=xxxx
# PAYPAL_CLIENT_SECRET=xxxx

# ============================================
# DOCUMENT SIGNING
# ============================================
OPENSIGN_API_KEY=xxxx

# ============================================
# NOTARIZATION (Optional)
# ============================================
# NOTARIZE_API_KEY=xxxx
# NOTARYCAM_API_KEY=xxxx

# ============================================
# VOICE/SMS (Optional)
# ============================================
# TELNYX_API_KEY=KEY-xxxx

# ============================================
# BLOCKCHAIN (Optional)
# ============================================
# ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/xxxx
# ETHEREUM_PRIVATE_KEY=xxxx
# SOLANA_PRIVATE_KEY=xxxx

# ============================================
# STORAGE
# ============================================
DOCUMENT_STORAGE_PATH=./storage/documents
```

---

## QUICK START CHECKLIST

- [ ] Copy .env.example to .env
- [ ] Generate JWT secrets (3 random strings)
- [ ] Sign up for DeepSeek ($5 credit free)
- [ ] Sign up for Brevo (free)
- [ ] Sign up for OpenSign (free)
- [ ] Set up Stripe (for payments)
- [ ] Verify Modoboa email server working
- [ ] Verify MinIO storage working
- [ ] Run `npx prisma db push`
- [ ] Run `npm run dev`
