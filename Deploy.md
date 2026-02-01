# MGR Capital Assistance — Deployment Guide

## What You Already Have (Already Configured)

| Service | What It Does | Status |
|---------|-------------|--------|
| **Neon PostgreSQL** | Database | CONFIGURED — `ep-jolly-hall-...neon.tech` |
| **DeepSeek** | AI/LLM (95% cheaper than OpenAI) | CONFIGURED — API key in .env |
| **Google Gemini** | Backup AI | CONFIGURED — API key in .env |
| **Amazon SES** | Sending emails to clients | CONFIGURED — SMTP credentials in .env |
| **Brevo** | Backup email (300/day free) | CONFIGURED — API key in .env |
| **Stripe** | Credit card payments | CONFIGURED — Live key in .env |
| **OpenSign** | E-signatures (free unlimited) | CONFIGURED — API key + JWT in .env |
| **JWT Auth** | Login system | CONFIGURED |

---

## What You Still Need to Set Up

### STEP 1: Deploy Frontend to Vercel (FREE)

This hosts your website at `capitalmgr.com`.

1. Go to https://vercel.com and sign in with your GitHub account
2. Click "Add New Project"
3. Find and select `MGR-CAPITAL-ASSISTANCE` repo
4. **IMPORTANT**: Set "Root Directory" to `frontend`
5. Under "Environment Variables", add:
   - `NEXT_PUBLIC_API_URL` = `https://api.capitalmgr.com`
6. Click "Deploy"
7. After it deploys, go to Project Settings > Domains
8. Type `capitalmgr.com` and click Add
9. Vercel will tell you what DNS records to add — follow their instructions in Namecheap

### STEP 2: Deploy Backend to Render (FREE)

This hosts your API at `api.capitalmgr.com`.

1. Go to https://render.com and sign in with GitHub
2. Click "New" > "Web Service"
3. Connect your `MGR-CAPITAL-ASSISTANCE` repo
4. Set these settings:
   - **Name**: `mgr-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npx prisma generate && npx tsc`
   - **Start Command**: `node dist/server.js`
   - **Instance Type**: Free
5. Under "Environment", add ALL of these (copy values from your `backend/.env`):

```
DATABASE_URL=postgresql://neondb_owner:npg_N6fIKYjeOEA1@ep-jolly-hall-ah2h5uji-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
PORT=4000
NODE_ENV=production
API_BASE_URL=https://api.capitalmgr.com
JWT_SECRET=mgr-capital-jwt-secret-2026-production-key-x9k2m4
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true
FOUNDER_EMAIL=admin@capitalmgr.com
DEEPSEEK_API_KEY=sk-bf56685b096f49dfbb00033461a9a988
GOOGLE_AI_KEY=AIzaSyBORv1AZ57mBOsF6tKAbZ9aArMn9g7OcuM
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA6PRB25SF2ER36KMW
SMTP_PASS=BNq+lksXYjJSwMZWM7adNfyyYkM0FSjnSiAucgwhgzSn
SMTP_FROM=admin@capitalmgr.com
SMTP_SECURE=false
BREVO_API_KEY=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
BREVO_FROM=admin@capitalmgr.com
STRIPE_SECRET_KEY=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
OPENSIGN_API_KEY=LVQjDh3KSHtPFXHdqMp5ZiNKTMSY3HsUg9CHJE92
OPENSIGN_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjM4MjIzOTI5LCJpYXQiOjE3Njk0MjM5MjksImp0aSI6IjI3NDllNDE5NWYzNjQwNjhiNDcxNzYxYmE5YjhmODNhIiwidXNlcl9pZCI6NDU5NX0.-Y9-rcaxWytXCgbN5Q8i1V7lHMWne_Lien1KWFm-2v0
FRONTEND_URL=https://capitalmgr.com
ENABLE_SCHEDULER=true
```

6. Click "Create Web Service"
7. After it deploys, go to Settings > Custom Domains
8. Add `api.capitalmgr.com`
9. Render tells you what CNAME record to add in Namecheap

### STEP 3: Set Up DNS in Namecheap

Log into Namecheap > Domain List > `capitalmgr.com` > Advanced DNS.

Delete any existing parking/redirect records, then add:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | `76.76.21.21` | Auto |
| CNAME | www | `cname.vercel-dns.com` | Auto |
| CNAME | api | `mgr-backend.onrender.com` | Auto |
| TXT | @ | `v=spf1 include:amazonses.com ~all` | Auto |

Note: The `api` CNAME value will be whatever Render gives you (like `mgr-backend.onrender.com`).
Note: Vercel may ask for different records — always follow what Vercel tells you in their dashboard.

### STEP 4: Run Database Migrations

From your local machine (one-time setup):

```bash
cd backend
npx prisma migrate deploy
```

This creates all the database tables in your Neon database. You only need to do this once,
and again whenever the schema changes.

### STEP 5: Create Your Founder Account

After the backend is deployed, create your admin account:

```bash
curl -X POST https://api.capitalmgr.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"admin@capitalmgr.com","password":"YourSecurePassword123!"}'
```

Then update the user role to FOUNDER directly in the Neon database console:

```sql
UPDATE "User" SET role = 'FOUNDER' WHERE email = 'admin@capitalmgr.com';
```

---

## Email Setup — Two Options

### Option A: Free Email Forwarding (ImprovMX — FREE, set up in 2 minutes)

Good for starting out. Forwards `support@capitalmgr.com` to your personal Gmail.

1. Go to https://improvmx.com
2. Enter `capitalmgr.com` as your domain
3. Set the forwarding destination (your personal email)
4. Add their MX records in Namecheap:
   - MX | @ | `mx1.improvmx.com` | Priority 10
   - MX | @ | `mx2.improvmx.com` | Priority 20

### Option B: Full Mail Server (Modoboa — ~$4.50/month VPS)

The codebase has full Modoboa integration built in. This gives you unlimited
`anything@capitalmgr.com` mailboxes with IMAP/SMTP, webmail, everything.

1. Get a VPS from Hetzner Cloud (CX22 — $4.51/month) at https://www.hetzner.com/cloud
2. Point `mail.capitalmgr.com` to the VPS IP in Namecheap:
   - A Record | mail | (your VPS IP)
3. SSH into the VPS and install Modoboa:
   ```bash
   sudo apt update && sudo apt install -y python3-pip
   pip3 install modoboa-installer
   sudo modoboa-installer --domain capitalmgr.com --hostname mail.capitalmgr.com
   ```
4. Add DNS records in Namecheap:
   - MX | @ | `mail.capitalmgr.com` | Priority 10
   - TXT | @ | `v=spf1 mx a ip4:(VPS_IP) ~all`
   - TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:dmarc@capitalmgr.com`
5. Add env vars to Render backend:
   ```
   MODOBOA_API_URL=http://(VPS_IP):8000/api/v2
   MODOBOA_API_TOKEN=(from Modoboa admin panel)
   MAIL_SERVER_HOSTNAME=mail.capitalmgr.com
   MAIL_SERVER_IP=(VPS_IP)
   ```
6. Now the Email Hosting page in the app provisions real mailboxes automatically

---

## Optional Services (Set Up When Needed)

### Skip Tracing — Tracerfy ($0.02/lead)
1. Sign up at https://tracerfy.com
2. Get API key
3. Add to Render env: `TRACERFY_API_KEY=xxx`

### Phone Calls — Telnyx (pay per use, 50% cheaper than Twilio)
1. Sign up at https://telnyx.com
2. Get API key, buy a phone number
3. Add to Render env:
   ```
   TELNYX_API_KEY=xxx
   TELNYX_NUMBER=+1xxxxxxxxxx
   TELNYX_CONNECTION_ID=xxx
   ```

### SMS — Plivo (free inbound)
1. Sign up at https://plivo.com
2. Get auth credentials
3. Add to Render env:
   ```
   PLIVO_AUTH_ID=xxx
   PLIVO_AUTH_TOKEN=xxx
   PLIVO_NUMBER=+1xxxxxxxxxx
   ```

### AI Voice — ElevenLabs (free tier available)
1. Sign up at https://elevenlabs.io
2. Get API key
3. Add to Render env: `ELEVENLABS_API_KEY=xxx`

### Blockchain/NFT — Solana (free devnet for testing)
1. Install Solana CLI: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
2. Generate wallet: `solana-keygen new`
3. Add to Render env:
   ```
   SOLANA_PRIVATE_KEY=xxx
   SOLANA_RPC_URL=https://api.devnet.solana.com
   ```

---

## Monthly Cost Summary

| Service | Cost |
|---------|------|
| Vercel (frontend) | FREE |
| Render (backend) | FREE |
| Neon (database) | FREE |
| DeepSeek (AI) | FREE first 5M tokens, then ~$0.28/1M |
| Amazon SES (email sending) | FREE first 62K/month |
| Brevo (backup email) | FREE 300/day |
| Stripe (payments) | 2.9% + $0.30 per transaction |
| OpenSign (e-signatures) | FREE unlimited |
| ImprovMX (email forwarding) | FREE |
| **Total to launch** | **$0/month** |

Optional add-ons:
| Modoboa VPS (full email server) | ~$4.50/month |
| Tracerfy (skip tracing) | $0.02/lead |
| Telnyx (phone) | pay per use |

---

## Architecture

```
capitalmgr.com (Vercel)  -->  api.capitalmgr.com (Render)  -->  Neon PostgreSQL
     |                              |
     |                              |-- DeepSeek AI
     |                              |-- Amazon SES (email)
     |                              |-- Stripe (payments)
     |                              |-- OpenSign (e-signatures)
     |                              |-- Modoboa (email hosting, optional)
     |
     +-- Next.js frontend (React)
```

## Troubleshooting

**Vercel build fails**: Make sure Root Directory is set to `frontend` in Vercel project settings.

**Backend 500 errors**: Check Render logs. Most likely a missing env var.

**White screen**: Clear browser cache, or the `.next` folder got corrupted — redeploy on Vercel.

**Database errors**: Run `npx prisma migrate deploy` from your local machine.

**Emails not sending**: Verify Amazon SES has your domain verified and you're out of sandbox mode.

**Free tier cold starts**: Render free tier sleeps after 15 minutes of no traffic. First request after sleep takes ~30 seconds. This is normal.
