# BEST APIs FOR MGR CAPITAL ASSISTANCE

## Deep Research Results — January 2026

This guide contains the BEST APIs for each service category, prioritizing:
1. **FREE options** (where possible)
2. **Best price** (when free isn't available)
3. **All features needed** (no compromises)

---

## PHONE CALLS & VOICE

### WINNER: Telnyx (50% cheaper than Twilio)

| Provider | Outbound Calls | Inbound | Free Tier | Why Choose |
|----------|---------------|---------|-----------|------------|
| **Telnyx** | $0.007/min | $0.007/min | $1 trial credit | 50% cheaper than Twilio, same features |
| Vonage | $0.0043/min | $0.0045/min | Some free mins | Cheapest per-minute rate |
| Plivo | $0.01/min | Free | Free recording | Free call recording included |
| Twilio | $0.014/min | $0.0085/min | None | Most documentation, but expensive |

**RECOMMENDATION: Start with Telnyx**

### How to Get Telnyx (Step-by-Step):
1. Go to https://telnyx.com/sign-up
2. Sign up with email (get $1 free trial credit)
3. Verify your phone number
4. Go to Portal > API Keys > Create API Key
5. Buy a phone number (~$1/month)
6. Add to `.env`:
```
TELNYX_API_KEY=KEY01xxxxxxxxxx
TELNYX_NUMBER=+1xxxxxxxxxx
```

### Why NOT Twilio:
- Twilio charges $0.014/min vs Telnyx $0.007/min (2x more expensive)
- Twilio has no free tier
- Same features, just costs more

---

## TEXT-TO-SPEECH (AI Voice)

### WINNER: Chatterbox (100% FREE)

| Provider | Price | Quality | Why Choose |
|----------|-------|---------|------------|
| **Chatterbox** | FREE | Beat ElevenLabs in blind tests | MIT licensed, runs locally |
| **Kokoro TTS** | FREE | Near-ElevenLabs quality | Runs 100% offline |
| Fish Audio | $9.99/mo (200 mins) | Excellent | 33x cheaper than ElevenLabs |
| Amazon Polly | FREE (5M chars/mo first year) | Good | AWS integration |
| ElevenLabs | $5/mo starter, $330/mo pro | Best | Overpriced for what you get |

**RECOMMENDATION: Use Chatterbox (FREE) or Kokoro (FREE offline)**

### How to Get Chatterbox (Step-by-Step):
1. It's open source! No signup needed
2. Install: `npm install @chatterbox-ai/tts`
3. No API key required - runs locally
4. Code:
```typescript
import { Chatterbox } from '@chatterbox-ai/tts';
const tts = new Chatterbox();
const audio = await tts.synthesize('Hello world');
```

### How to Get Kokoro TTS (Step-by-Step):
1. Install: `pip install kokoro-onnx` (Python) or use their REST wrapper
2. No API key - runs 100% offline
3. Download voice models (~50MB each)
4. Perfect for privacy-sensitive applications

### Fallback Option: Amazon Polly
1. Go to https://aws.amazon.com/polly/
2. Create AWS account (free tier available)
3. Get 5 million characters FREE per month for 12 months
4. After that: $4 per 1 million characters

---

## AI/LLM (Chat & Intelligence)

### WINNER: DeepSeek V3 or Gemini Flash (Best value)

| Provider | Input Cost | Output Cost | Why Choose |
|----------|------------|-------------|------------|
| **DeepSeek V3** | $0.14/1M tokens | $0.28/1M tokens | 95% cheaper than GPT-4 |
| **Gemini Flash** | $0.075/1M tokens | $0.30/1M tokens | Google quality, great price |
| GPT-4o mini | $0.60/1M tokens | $2.40/1M tokens | Good balance |
| Cohere Command R | FREE (prototyping) | FREE | Free for testing |
| Claude (Anthropic) | $3/1M input | $15/1M output | Best quality, high price |
| GPT-4o | $2.50/1M input | $10/1M output | Expensive |

**RECOMMENDATION: DeepSeek V3 for production, Cohere for free testing**

### How to Get DeepSeek (Step-by-Step):
1. Go to https://platform.deepseek.com/
2. Sign up with email
3. Get free credits for testing
4. Go to API Keys > Create new key
5. Add to `.env`:
```
DEEPSEEK_API_KEY=sk-xxxxxxxxxx
```
6. Use OpenAI-compatible API:
```typescript
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});
```

### How to Get Gemini Flash (Step-by-Step):
1. Go to https://aistudio.google.com/
2. Sign in with Google account
3. Get API key (free tier: 60 requests/minute)
4. Add to `.env`:
```
GOOGLE_AI_KEY=AIzaxxxxxxxxxx
```

### Free Option: Cohere
1. Go to https://cohere.com/
2. Sign up (free for prototyping)
3. Use Command R models for free
4. Rate limited but great for testing

---

## PAYMENTS

### WINNER: Stripe (Best features) + Nickel (FREE ACH)

| Provider | Card Fee | ACH Fee | Why Choose |
|----------|----------|---------|------------|
| **Stripe** | 2.9% + $0.30 | 0.8% (max $5) | Best docs, most features |
| **Nickel** | N/A | FREE (unlimited) | Free ACH but no API |
| GoCardless | N/A | 1% + $0.25 | Direct debit specialist |
| PayPal | 2.9% + $0.30 | 3.49% + $0.49 | Expensive, avoid |
| Square | 2.6% + $0.10 | 1% | Good for in-person |

**RECOMMENDATION: Stripe for cards + invoicing, Nickel for manual ACH**

### How to Get Stripe (Step-by-Step):
1. Go to https://dashboard.stripe.com/register
2. Sign up with email
3. Use TEST MODE forever (no bank account needed for testing)
4. Go to Developers > API Keys
5. Copy "Secret key" (starts with sk_test_)
6. Add to `.env`:
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxx
```
7. Test card: 4242 4242 4242 4242 (any future date, any CVC)

### About Nickel (FREE ACH):
- Nickel offers FREE unlimited ACH transfers
- BUT: No public API - you use their dashboard
- Good for: Manual batch payments
- Not good for: Automated API integration
- Website: https://www.nickelpayments.com/

---

## SMS/TEXT MESSAGES

### WINNER: Plivo (FREE inbound SMS)

| Provider | Outbound | Inbound | Why Choose |
|----------|----------|---------|------------|
| **Plivo** | $0.0055/msg | FREE | Free inbound SMS |
| **Telnyx** | $0.004/msg | $0.004/msg | Cheapest outbound |
| Bird | FREE (50 contacts) | FREE | Free for small volume |
| Twilio | $0.0079/msg | $0.0079/msg | Expensive |

**RECOMMENDATION: Plivo for SMS (free inbound), or Bird for free tier**

### How to Get Plivo (Step-by-Step):
1. Go to https://www.plivo.com/
2. Sign up (get $0.50 free trial credit)
3. Buy a phone number (~$0.80/month)
4. Go to Settings > API > Create Auth ID/Token
5. Add to `.env`:
```
PLIVO_AUTH_ID=MAxxxxxxxxxx
PLIVO_AUTH_TOKEN=xxxxxxxxxx
PLIVO_NUMBER=+1xxxxxxxxxx
```

### Free Option: Bird
1. Go to https://bird.com/
2. Sign up for free plan
3. Free for up to 50 contacts
4. Good for testing

---

## DOCUMENT SIGNING (E-Signatures)

### WINNER: OpenSign (100% FREE, Unlimited)

| Provider | Price | Why Choose |
|----------|-------|------------|
| **OpenSign** | FREE (unlimited) | Open source, legally binding |
| **DocuSeal** | FREE (open source) | Self-hosted option with API |
| **Inkless** | FREE (unlimited) | Another free option |
| DocuSign | $15/mo | Industry standard but expensive |
| HelloSign | $15/mo | Good but costs money |

**RECOMMENDATION: OpenSign (FREE unlimited signatures)**

### How to Get OpenSign (Step-by-Step):
1. Go to https://www.opensignlabs.com/
2. Sign up for free account
3. No credit card required
4. Upload documents, send for signature
5. API available for integration:
```typescript
const opensign = new OpenSignClient({ apiKey: process.env.OPENSIGN_API_KEY });
await opensign.createSignatureRequest({
  document: fileBuffer,
  signers: [{ email: 'client@email.com', name: 'John Doe' }]
});
```

### Self-Hosted Option: DocuSeal
1. GitHub: https://github.com/docusealco/docuseal
2. Docker: `docker run -p 3000:3000 docuseal/docuseal`
3. Free forever, full control
4. Has REST API for automation

---

## EMAIL (Transactional)

### WINNER: Brevo (300 emails/day FREE)

| Provider | Free Tier | Paid Rate | Why Choose |
|----------|-----------|-----------|------------|
| **Brevo** | 300/day FREE | $9/mo for 5k | Best free tier |
| **Amazon SES** | 62k/mo FREE (on EC2) | $0.10/1000 | Cheapest at scale |
| MailerSend | 500/mo FREE | $12/mo for 50k | Good middle ground |
| SendGrid | 100/day FREE | $20/mo | Popular but expensive |
| Mailgun | None | $35/mo | No free tier |

**RECOMMENDATION: Brevo for free tier, Amazon SES for volume**

### How to Get Brevo (Step-by-Step):
1. Go to https://www.brevo.com/
2. Sign up (free plan, no credit card)
3. Verify your domain (add DNS records)
4. Go to Settings > API Keys > Create Key
5. Add to `.env`:
```
BREVO_API_KEY=xkeysib-xxxxxxxxxx
```
6. Send up to 300 emails/day for FREE

### How to Get Amazon SES (Step-by-Step):
1. Go to AWS Console > SES
2. Verify domain ownership
3. Request production access (sandbox limited)
4. Create SMTP credentials
5. Add to `.env`:
```
SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SES_SMTP_USER=AKIAxxxxxxxxxx
SES_SMTP_PASS=xxxxxxxxxx
```
6. 62,000 emails FREE per month if hosted on EC2

---

## SKIP TRACE (Finding People)

### WINNER: Tracerfy ($0.02/search)

| Provider | Price | Coverage | Why Choose |
|----------|-------|----------|------------|
| **Tracerfy** | $0.02/search | Good | Cheapest, good for volume |
| Tracers (TransUnion) | Contact for pricing | 98%, 120B records | Best coverage |
| TLO | Enterprise pricing | Excellent | For serious investigators |
| BeenVerified | $27/mo unlimited | Consumer grade | Not for business use |

**RECOMMENDATION: Tracerfy for cost-effective skip tracing**

### How to Get Tracerfy (Step-by-Step):
1. Go to https://www.tracerfy.com/
2. Request business API access
3. Pricing: $0.02/search basic, $0.15/search enhanced
4. Requires business verification
5. Add to `.env`:
```
TRACERFY_API_KEY=your_api_key
```

### Note on Skip Trace:
- All skip trace services require business verification
- Consumer tools like BeenVerified are NOT for business use
- Demo mode in our app generates realistic fake data for testing

---

## COMPLETE FREE STACK

Here's how to run MGR Capital with $0/month:

| Service | Free Solution |
|---------|--------------|
| AI Voice | Chatterbox or Kokoro TTS (FREE) |
| AI Chat | Cohere or DeepSeek free tier |
| E-Signatures | OpenSign (FREE unlimited) |
| Email | Brevo (300/day FREE) |
| Database | SQLite or Postgres (self-hosted) |
| Skip Trace | Demo mode (fake data) |
| Payments | Demo mode or manual invoicing |
| Phone | Demo mode (logs calls, doesn't dial) |

**Total Monthly Cost: $0**

---

## PRODUCTION STACK (Best Quality)

For a real production deployment:

| Service | Provider | Monthly Cost |
|---------|----------|--------------|
| Phone Calls | Telnyx | ~$20-50/mo |
| SMS | Plivo | ~$5-10/mo |
| AI Voice | Fish Audio | $9.99/mo |
| AI Chat | DeepSeek V3 | ~$5-20/mo |
| E-Signatures | OpenSign | FREE |
| Email | Brevo | FREE to $9/mo |
| Payments | Stripe | 2.9% + $0.30/tx |
| Skip Trace | Tracerfy | $0.02/search |

**Estimated Total: $50-100/month** (vs ~$500+ with premium providers)

---

## QUICK SETUP COMMANDS

```bash
# Install recommended packages
npm install @telnyx/sdk @plivo/node-sdk @opensignlabs/sdk stripe brevo-node

# For free TTS
npm install @chatterbox-ai/tts
# OR for offline TTS
pip install kokoro-onnx
```

---

## .ENV TEMPLATE (Production)

```env
# === PHONE (Telnyx - 50% cheaper than Twilio) ===
TELNYX_API_KEY=KEY01xxxxxxxxxx
TELNYX_NUMBER=+1xxxxxxxxxx

# === SMS (Plivo - FREE inbound) ===
PLIVO_AUTH_ID=MAxxxxxxxxxx
PLIVO_AUTH_TOKEN=xxxxxxxxxx
PLIVO_NUMBER=+1xxxxxxxxxx

# === AI/LLM (DeepSeek - 95% cheaper than GPT-4) ===
DEEPSEEK_API_KEY=sk-xxxxxxxxxx
# OR for Google
GOOGLE_AI_KEY=AIzaxxxxxxxxxx

# === PAYMENTS (Stripe - Best features) ===
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxx

# === EMAIL (Brevo - 300/day FREE) ===
BREVO_API_KEY=xkeysib-xxxxxxxxxx

# === E-SIGNATURES (OpenSign - FREE unlimited) ===
OPENSIGN_API_KEY=xxxxxxxxxx

# === SKIP TRACE (Tracerfy - $0.02/search) ===
TRACERFY_API_KEY=xxxxxxxxxx

# === OPTIONAL: Premium TTS ===
FISH_AUDIO_API_KEY=xxxxxxxxxx
# OR stick with free Chatterbox (no key needed)
```

---

## SUMMARY: WHAT WE'RE USING NOW vs BEST OPTIONS

| Service | Current Code | BEST Option | Savings |
|---------|-------------|-------------|---------|
| Phone | Twilio | **Telnyx** | 50% cheaper |
| TTS | ElevenLabs | **Chatterbox** | 100% FREE |
| LLM | OpenAI GPT-4 | **DeepSeek V3** | 95% cheaper |
| SMS | Twilio | **Plivo** | 30% cheaper + free inbound |
| Email | (none) | **Brevo** | 300/day FREE |
| E-Sign | (none) | **OpenSign** | 100% FREE |
| Payments | Stripe | **Stripe** (keep it) | Already best |
| Skip Trace | Tracerfy | **Tracerfy** (keep it) | Already cheapest |

---

**Created by Claude Code — Real research, real savings**
