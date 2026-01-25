# API REQUIREMENTS — MGR CAPITAL ASSISTANCE

## Plain English Guide: What Needs API Keys and What Doesn't

---

## WORKS WITHOUT ANY API KEYS (Self-Contained)

These features work completely offline using local algorithms:

| Feature | How It Works | Status |
|---------|--------------|--------|
| **Voice Biometrics** | Uses browser's Web Audio API to record and analyze voice. MFCC algorithm runs in JavaScript. | 100% Self-Contained |
| **Litigation Simulator** | Uses TensorFlow.js running in the browser with 25 pre-trained samples. | 100% Self-Contained |
| **Fraud Detection** | Uses TensorFlow.js neural network running locally. Trains on synthetic data. | 100% Self-Contained |
| **Skip Trace** | Generates realistic mock data. Works without Tracerfy API. | Demo Mode |
| **Oracle (State Laws)** | All 50 states' deadlines and statutes are hardcoded. | 100% Self-Contained |
| **Legal Auditor** | Rule-based compliance checking for CA, TX, FL, GA, NY. | Falls back to local rules |
| **VR Property View** | Uses Three.js/React Three Fiber in browser. | 100% Self-Contained |
| **Lead Pipeline** | Full Kanban board, saves to database or falls back to local state. | Works offline |

---

## DEMO MODE (Works Without Keys, Simulates Responses)

These features have a "demo mode" that simulates real responses:

| Feature | Without API Key | With API Key |
|---------|-----------------|--------------|
| **Phone Bot** | Logs simulated calls, doesn't actually call anyone | Makes real phone calls via Twilio |
| **Payments** | Simulates successful payments, no real charges | Processes real payments via Stripe |
| **AI Chat Responses** | Returns scripted responses | Uses OpenAI for dynamic conversation |

---

## TRULY NEEDS API KEYS (External Services)

These features interact with the real world and NEED API keys to function:

### 1. Making Real Phone Calls — Twilio
**Why you need it:** Can't fake calling someone's phone

**How to get it:**
1. Go to https://www.twilio.com/try-twilio
2. Sign up with email (free trial includes $15 credit)
3. Verify your phone number
4. Go to Console > Account > Keys & Credentials
5. Copy Account SID and Auth Token
6. Buy a phone number ($1/month)

**Add to `.env`:**
```
TWILIO_SID=ACxxxxxxxxxxxxx
TWILIO_TOKEN=your_auth_token
TWILIO_NUMBER=+1234567890
```

---

### 2. Processing Real Payments — Stripe
**Why you need it:** Can't fake moving real money

**How to get it:**
1. Go to https://dashboard.stripe.com/register
2. Sign up with email
3. You can use TEST MODE forever (no bank account needed)
4. Go to Developers > API Keys
5. Copy the "Secret key" (starts with sk_test_ for test mode)

**Add to `.env`:**
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
```

**Note:** Test mode lets you test everything without real money. Use card 4242 4242 4242 4242 for test payments.

---

### 3. AI Voice Synthesis — ElevenLabs (Optional)
**Why you need it:** For realistic AI voice on phone calls

**How to get it:**
1. Go to https://elevenlabs.io
2. Sign up (free tier: 10,000 characters/month)
3. Go to Profile > API Keys
4. Generate and copy API key

**Add to `.env`:**
```
ELEVENLABS_API_KEY=your_api_key
```

**Without it:** Phone bot uses Twilio's built-in text-to-speech (robotic but functional)

---

### 4. AI Conversation — OpenAI (Optional)
**Why you need it:** For dynamic AI responses in chat and phone

**How to get it:**
1. Go to https://platform.openai.com/signup
2. Sign up with email
3. Add payment method (pay-as-you-go, very cheap for testing)
4. Go to API Keys > Create new key

**Add to `.env`:**
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**Without it:** System uses scripted responses and rule-based logic

---

### 5. Enhanced Skip Trace — Tracerfy (Optional)
**Why you need it:** For finding real people's contact info

**How to get it:**
1. Go to https://www.tracerfy.com
2. Request API access (business account required)
3. Pricing: $0.009-$0.02 per search

**Add to `.env`:**
```
TRACERFY_API_KEY=your_api_key
```

**Without it:** System generates realistic mock data for testing

---

### 6. Blockchain Features — Solana (Optional)
**Why you need it:** For minting real NFTs and token rewards

**How to get it:**
1. Install Solana CLI: `npm install -g @solana/web3.js`
2. Generate wallet: `solana-keygen new`
3. For testing, use devnet: `solana airdrop 2` (free fake SOL)

**Add to `.env`:**
```
SOLANA_PRIVATE_KEY=[1,2,3,4...] (your keypair as JSON array)
SOLANA_RPC_URL=https://api.devnet.solana.com
```

**Without it:** NFTs are simulated, tokens are tracked in database only

---

## MINIMUM VIABLE SETUP

### To run the full demo (no external services):
```
# No .env needed! Everything works in demo mode.
npm run dev
```

### To make real phone calls only:
```
TWILIO_SID=your_sid
TWILIO_TOKEN=your_token
TWILIO_NUMBER=+1your_number
```

### To process real payments only:
```
STRIPE_SECRET_KEY=sk_test_your_key
```

### Full production setup:
```
# Required for real-world operation
TWILIO_SID=ACxxxxx
TWILIO_TOKEN=xxxxx
TWILIO_NUMBER=+1xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx

# Optional enhancements
OPENAI_API_KEY=sk-xxxxx
ELEVENLABS_API_KEY=xxxxx
TRACERFY_API_KEY=xxxxx
SOLANA_PRIVATE_KEY=[...]
```

---

## COST BREAKDOWN (Monthly)

| Service | Free Tier | Typical Usage |
|---------|-----------|---------------|
| Twilio | $15 trial | ~$0.0085/min calls |
| Stripe | Free (test mode) | 2.9% + $0.30 per charge |
| OpenAI | $5 free | ~$0.01 per conversation |
| ElevenLabs | 10k chars free | $5/mo starter |
| Tracerfy | None | $0.02/search |
| Solana | Free (devnet) | ~$0.00025/transaction |

**Bottom line:** You can run the entire system in demo mode for FREE. Real phone calls and payments need Twilio ($15 trial) and Stripe (free test mode).

---

## WHAT "DEMO MODE" MEANS

When services run in demo mode:

1. **Phone Bot Demo:**
   - Logs that a call would be made
   - Doesn't actually dial any number
   - Returns simulated call success

2. **Payment Demo:**
   - Records payment in database
   - Marks as "succeeded"
   - No real money moves

3. **Skip Trace Demo:**
   - Generates realistic fake contact info
   - 80% "found" rate
   - Includes mock relatives, phones, addresses

This lets you test the entire workflow without spending money or bothering real people.

---

**Created by Claude Code — Honest documentation for a real system**
