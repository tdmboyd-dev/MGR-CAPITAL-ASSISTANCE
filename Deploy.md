# MGR Capital Assistance — Full Deployment Guide

Everything you need to get `capitalmgr.com` live. Follow each step in order. Do NOT skip ahead.

---

## WHAT'S ALREADY DONE (No Action Needed)

These services are already coded into the app and their API keys are in your `.env` file. You do NOT need to sign up for any of these — they're ready to go.

| Service | What It Does | Already Working? |
|---------|-------------|-----------------|
| **Neon PostgreSQL** | Your database (stores all users, cases, clients, etc.) | YES — connected to `ep-jolly-hall-...neon.tech` |
| **DeepSeek AI** | Powers all AI features (case analysis, document review, chatbot) | YES — API key set |
| **Google Gemini** | Backup AI if DeepSeek is down | YES — API key set |
| **Amazon SES** | Sends emails to clients (notifications, updates, receipts) | YES — SMTP credentials set |
| **Brevo** | Backup email sender (300 free emails/day) | YES — API key set |
| **Stripe** | Accepts credit card payments from clients | YES — LIVE key set |
| **OpenSign** | E-signatures (clients sign documents digitally) | YES — API key + JWT set |
| **JWT Auth** | Login/logout system with secure tokens | YES — built into the code |

**You own the domain**: `capitalmgr.com` on Namecheap.

**Frontend is already deployed**: `mgr-capital-assistance.vercel.app` (but not yet connected to your domain).

---

## STEP 1: Connect Your Domain to Vercel (Frontend)

Your frontend is already deployed on Vercel. Now you need to connect `capitalmgr.com` to it.

### 1A. Add Your Domain in Vercel

1. Open your browser and go to **https://vercel.com**
2. Sign in with your **GitHub** account (the same one that has the MGR-CAPITAL-ASSISTANCE repo)
3. You should see your project **MGR-CAPITAL-ASSISTANCE** on the dashboard. Click on it.
4. In the top menu bar, click **"Settings"**
5. In the left sidebar, click **"Domains"**
6. In the text box that says "Add Domain", type: **`capitalmgr.com`**
7. Click the **"Add"** button
8. Vercel will show you DNS records you need to add. **Write these down or screenshot them.** They will look something like:
   - `A Record` → `@` → `76.76.21.21`
   - `CNAME` → `www` → `cname.vercel-dns.com`

### 1B. Add the Environment Variable in Vercel

While you're still in Vercel project settings:

1. In the left sidebar, click **"Environment Variables"**
2. You need to add ONE variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://api.capitalmgr.com`
3. Make sure all three checkboxes are checked: **Production**, **Preview**, **Development**
4. Click **"Save"**

> **WHY**: This tells your frontend where to send API requests. Without it, the site loads but nothing works (no login, no data, etc.)

### 1C. Redeploy After Adding the Variable

1. Go back to your project's main page on Vercel (click the project name at the top)
2. Click the **"Deployments"** tab
3. Find the most recent deployment, click the **three dots (...)** on the right
4. Click **"Redeploy"**
5. Wait for it to finish (you'll see a green "Ready" status)

> **WHY**: Environment variables only take effect after a new deployment. If you skip this, the frontend won't know where the backend is.

---

## STEP 2: Deploy Backend to Render (FREE)

This puts your API server online at `api.capitalmgr.com`.

### 2A. Create the Web Service

1. Open your browser and go to **https://render.com**
2. Click **"Get Started for Free"** (or "Sign In" if you already have an account)
3. Sign in with your **GitHub** account (same one as before)
4. Once logged in, click the **"New +"** button in the top right
5. Select **"Web Service"** from the dropdown
6. You'll see a list of your GitHub repos. Find **`MGR-CAPITAL-ASSISTANCE`** and click **"Connect"**
   - If you don't see it, click "Configure account" and give Render access to the repo

### 2B. Configure the Service Settings

On the setup page, fill in these fields exactly:

| Field | What to Enter |
|-------|--------------|
| **Name** | `mgr-backend` |
| **Region** | `Oregon (US West)` — or whichever is closest to you |
| **Branch** | `master` (should be auto-selected) |
| **Root Directory** | `backend` — **TYPE THIS IN, don't leave it blank** |
| **Runtime** | `Node` |
| **Build Command** | `npm install --legacy-peer-deps && npx prisma generate && npx tsc` |
| **Start Command** | `node dist/server.js` |
| **Instance Type** | Select **"Free"** |

> **IMPORTANT**: The "Root Directory" field is easy to miss. It's a small text input. You MUST type `backend` here. If you leave it blank, the build will fail because it tries to build from the root of the repo instead of the backend folder.

### 2C. Add All Environment Variables

Scroll down to the **"Environment Variables"** section. You need to add each of these one by one. For each one, click "Add Environment Variable", paste the Key in the left box and the Value in the right box.

**Copy these EXACTLY (Key on the left, Value on the right):**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_N6fIKYjeOEA1@ep-jolly-hall-ah2h5uji-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `PORT` | `4000` |
| `NODE_ENV` | `production` |
| `API_BASE_URL` | `https://api.capitalmgr.com` |
| `JWT_SECRET` | `mgr-capital-jwt-secret-2026-production-key-x9k2m4` |
| `JWT_EXPIRES_IN` | `7d` |
| `COOKIE_SECURE` | `true` |
| `FOUNDER_EMAIL` | `admin@capitalmgr.com` |
| `DEEPSEEK_API_KEY` | `sk-bf56685b096f49dfbb00033461a9a988` |
| `GOOGLE_AI_KEY` | `AIzaSyBORv1AZ57mBOsF6tKAbZ9aArMn9g7OcuM` |
| `SMTP_HOST` | `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `AKIA6PRB25SF2ER36KMW` |
| `SMTP_PASS` | `BNq+lksXYjJSwMZWM7adNfyyYkM0FSjnSiAucgwhgzSn` |
| `SMTP_FROM` | `admin@capitalmgr.com` |
| `SMTP_SECURE` | `false` |
| `BREVO_API_KEY` | `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` |
| `BREVO_FROM` | `admin@capitalmgr.com` |
| `STRIPE_SECRET_KEY` | `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` |
| `OPENSIGN_API_KEY` | `LVQjDh3KSHtPFXHdqMp5ZiNKTMSY3HsUg9CHJE92` |
| `OPENSIGN_JWT` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjM4MjIzOTI5LCJpYXQiOjE3Njk0MjM5MjksImp0aSI6IjI3NDllNDE5NWYzNjQwNjhiNDcxNzYxYmE5YjhmODNhIiwidXNlcl9pZCI6NDU5NX0.-Y9-rcaxWytXCgbN5Q8i1V7lHMWne_Lien1KWFm-2v0` |
| `FRONTEND_URL` | `https://capitalmgr.com` |
| `ENABLE_SCHEDULER` | `true` |

That's **23 environment variables** total. Double-check you didn't miss any.

### 2D. Create and Wait

1. Click **"Create Web Service"** at the bottom
2. Render will start building. You'll see a live log. Wait for it to say **"Your service is live"**
3. The build usually shows:
   - `npm install` (installing packages)
   - `prisma generate` (creating database client)
   - `tsc` (compiling TypeScript)
   - Then starts the server
4. If the build fails, check the logs for which step failed. Most common issue: a missing environment variable.

### 2E. Add Your Custom Domain to Render

1. Once the service is live, click **"Settings"** in the top menu of your service
2. Scroll down to **"Custom Domains"**
3. Click **"Add Custom Domain"**
4. Type: **`api.capitalmgr.com`**
5. Click **"Save"**
6. Render will show you a CNAME record to add. It will look something like:
   - `CNAME` → `api` → `mgr-backend.onrender.com`
   - **Write this down — you'll need it for Step 3**

---

## STEP 3: Set Up DNS Records in Namecheap

This is where you connect your domain name to Vercel (frontend) and Render (backend).

### 3A. Open Namecheap DNS Settings

1. Go to **https://namecheap.com** and log in
2. Click **"Domain List"** in the left sidebar
3. Find **`capitalmgr.com`** and click **"Manage"** on the right
4. Click the **"Advanced DNS"** tab at the top

### 3B. Delete Old Records

You'll see some existing records (parking page, redirect, etc.). **Delete ALL of them** by clicking the trash icon next to each one. Start fresh.

### 3C. Add These DNS Records

Click **"Add New Record"** for each of these. Add them one at a time:

**Record 1 — Points `capitalmgr.com` to Vercel:**
| Field | Value |
|-------|-------|
| Type | `A Record` |
| Host | `@` |
| Value | `76.76.21.21` |
| TTL | `Automatic` |

**Record 2 — Points `www.capitalmgr.com` to Vercel:**
| Field | Value |
|-------|-------|
| Type | `CNAME Record` |
| Host | `www` |
| Value | `cname.vercel-dns.com` |
| TTL | `Automatic` |

**Record 3 — Points `api.capitalmgr.com` to Render:**
| Field | Value |
|-------|-------|
| Type | `CNAME Record` |
| Host | `api` |
| Value | `mgr-backend.onrender.com` |
| TTL | `Automatic` |

> **NOTE**: The value for Record 3 should match whatever Render told you in Step 2E. It's usually `mgr-backend.onrender.com` but confirm from your Render dashboard.

**Record 4 — Email authentication (so your emails don't go to spam):**
| Field | Value |
|-------|-------|
| Type | `TXT Record` |
| Host | `@` |
| Value | `v=spf1 include:amazonses.com ~all` |
| TTL | `Automatic` |

### 3D. Wait for DNS to Propagate

After adding all records:
- DNS changes can take **5 minutes to 48 hours** to take effect worldwide
- Usually it works within **15-30 minutes**
- You can check if it's working by going to `capitalmgr.com` in your browser
- If you see the Vercel page, it's working. If you see "This site can't be reached", wait longer.

> **TIP**: Vercel and Render will both show a "Pending" status on their domain pages until DNS propagates. Once it says "Valid Configuration" or shows a green checkmark, you're good.

---

## STEP 4: Run Database Migrations (One-Time)

This creates all the database tables. You do this from your local computer (where you have the code).

### 4A. Open Your Terminal

1. Open **Command Prompt** or **PowerShell** or **VS Code Terminal**
2. Navigate to your backend folder:
   ```
   cd "C:\Users\Timeb\OneDrive\New folder\MGR-CAPITAL-ASSISTANCE\backend"
   ```

### 4B. Run the Migration

```
npx prisma migrate deploy
```

You should see output like:
```
Prisma Migrate applied all migrations.
```

If you see errors:
- **"Database connection failed"**: Check that your `DATABASE_URL` in `backend/.env` is correct
- **"Migration failed"**: Run `npx prisma migrate reset` (WARNING: this deletes all data)

> **WHEN TO RUN THIS AGAIN**: Only when you make changes to `backend/prisma/schema.prisma` (adding new tables, columns, etc.)

---

## STEP 5: Create Your Founder (Admin) Account

You need to create the first user account and make it the admin. Do this AFTER the backend is deployed and live.

### 5A. Register the Account

Open your terminal and run this command (all on one line):

**On Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://api.capitalmgr.com/api/auth/register" -Method POST -ContentType "application/json" -Body '{"name":"YOUR NAME HERE","email":"admin@capitalmgr.com","password":"PICK_A_STRONG_PASSWORD"}'
```

**On Mac/Linux:**
```bash
curl -X POST https://api.capitalmgr.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"YOUR NAME HERE","email":"admin@capitalmgr.com","password":"PICK_A_STRONG_PASSWORD"}'
```

Replace `YOUR NAME HERE` with your actual name and `PICK_A_STRONG_PASSWORD` with a real password.

You should get back a JSON response with your user info. If you get an error, the backend isn't live yet — go back to Step 2 and check Render.

### 5B. Make Yourself the Founder (Admin)

The account you just created is a regular user. You need to promote it to FOUNDER role. Do this in the **Neon database console**:

1. Go to **https://console.neon.tech**
2. Sign in (you should already have an account since the database is set up)
3. Click on your project (it's the `neondb` project)
4. Click **"SQL Editor"** in the left sidebar
5. Paste this SQL command and click **"Run"**:
   ```sql
   UPDATE "User" SET role = 'FOUNDER' WHERE email = 'admin@capitalmgr.com';
   ```
6. You should see: `UPDATE 1`

Now log in at `capitalmgr.com/login` with your email and password. You'll have full admin access.

---

## STEP 6: Verify Everything Works

Go through this checklist to make sure everything is connected:

| Test | How to Check | Expected Result |
|------|-------------|----------------|
| Frontend loads | Go to `capitalmgr.com` | You see the login page |
| Backend responds | Go to `api.capitalmgr.com/api/health` | You see `{"status":"ok"}` or similar JSON |
| Login works | Log in with your founder account | You see the Founder Dashboard |
| Database works | Check if dashboard loads data | No errors, pages load |
| Domain redirects | Go to `www.capitalmgr.com` | Redirects to `capitalmgr.com` |

**If the frontend loads but login doesn't work:**
- The `NEXT_PUBLIC_API_URL` environment variable might not be set in Vercel (go back to Step 1B)
- Or you forgot to redeploy after adding it (go back to Step 1C)

**If `api.capitalmgr.com` doesn't load:**
- DNS hasn't propagated yet (wait 15-30 minutes)
- Or the Render service crashed (check Render dashboard logs)

---

## EMAIL SETUP — Pick One

Your app can SEND emails already (via Amazon SES). This section is about RECEIVING emails at `@capitalmgr.com` addresses.

### Option A: Free Email Forwarding (ImprovMX) — Recommended to Start

This is the fastest way to get emails working. It forwards any email sent to `anything@capitalmgr.com` to your personal Gmail/email.

**What you get**: Emails sent to `support@capitalmgr.com`, `info@capitalmgr.com`, etc. all land in your personal inbox.

**What you don't get**: No individual mailboxes, no webmail, no IMAP/SMTP.

**Setup:**

1. Go to **https://improvmx.com**
2. In the main box on the homepage, type: **`capitalmgr.com`**
3. Click the button to get started
4. It asks where to forward emails. Enter **your personal email** (like your Gmail)
5. ImprovMX will show you MX records to add. Go to **Namecheap > Advanced DNS** and add:

| Type | Host | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX Record | `@` | `mx1.improvmx.com` | `10` | Automatic |
| MX Record | `@` | `mx2.improvmx.com` | `20` | Automatic |

6. Done. Within an hour, emails to `anything@capitalmgr.com` will forward to your personal email.

---

### Option B: Full Mail Server (Modoboa) — For Later

The app has a full Modoboa mail server integration already built in. This gives you real email accounts like `john@capitalmgr.com`, `support@capitalmgr.com`, each with their own inbox, password, and webmail access. The "Email Hosting" page in the founder dashboard manages all of this.

**Cost**: ~$4.50/month for a VPS (virtual private server).

**When to do this**: After your site is live and running smoothly. This is not needed on day one.

**Setup:**

1. **Buy a VPS**: Go to **https://www.hetzner.com/cloud** → Sign up → Create a server:
   - Location: Ashburn or any US location
   - Image: **Ubuntu 22.04**
   - Type: **CX22** (2 vCPU, 4GB RAM — $4.51/month)
   - Give it a name like `mgr-mail`
   - Click Create
   - Write down the **IP address** it gives you (example: `5.161.xxx.xxx`)

2. **Add DNS records in Namecheap** (Advanced DNS tab):

| Type | Host | Value | Priority | TTL |
|------|------|-------|----------|-----|
| A Record | `mail` | `YOUR_VPS_IP` | — | Automatic |
| MX Record | `@` | `mail.capitalmgr.com` | `10` | Automatic |
| TXT Record | `@` | `v=spf1 mx a ip4:YOUR_VPS_IP ~all` | — | Automatic |
| TXT Record | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@capitalmgr.com` | — | Automatic |

> Replace `YOUR_VPS_IP` with the actual IP address from step 1 (like `5.161.xxx.xxx`)

3. **Install Modoboa on the VPS**: SSH into your server and run these commands:
   ```bash
   ssh root@YOUR_VPS_IP
   ```
   Then once connected:
   ```bash
   sudo apt update && sudo apt install -y python3-pip git
   pip3 install modoboa-installer
   sudo modoboa-installer --domain capitalmgr.com --hostname mail.capitalmgr.com
   ```
   This takes about 10-15 minutes. When it finishes, it shows you an admin username and password.

4. **Log into Modoboa admin panel**: Open `http://YOUR_VPS_IP:8000` in your browser. Log in with the admin credentials from the previous step.

5. **Get the API token**: In the Modoboa admin panel, go to Settings → API → generate an API token. Copy it.

6. **Add 4 environment variables to Render**: Go to your Render dashboard → mgr-backend → Environment → add:

| Key | Value |
|-----|-------|
| `MODOBOA_API_URL` | `http://YOUR_VPS_IP:8000/api/v2` |
| `MODOBOA_API_TOKEN` | `(the token you copied from step 5)` |
| `MAIL_SERVER_HOSTNAME` | `mail.capitalmgr.com` |
| `MAIL_SERVER_IP` | `YOUR_VPS_IP` |

7. **Restart the Render service**: After adding the variables, click "Manual Deploy" → "Deploy latest commit" in Render. This restarts the backend with the new email config.

8. **Test it**: Log into `capitalmgr.com` as the Founder. Go to the **Email Hosting** page. You should now be able to create mailboxes like `support@capitalmgr.com`.

---

## OPTIONAL SERVICES (Set Up Whenever You Need Them)

These features are built into the app but need API keys to activate. None of these are needed to launch.

### Skip Tracing — Tracerfy ($0.02 per lead lookup)

Finds phone numbers and addresses for property owners.

1. Go to **https://tracerfy.com** and create an account
2. Go to your account dashboard → API → copy your API key
3. In **Render** → mgr-backend → Environment → add:
   - Key: `TRACERFY_API_KEY`
   - Value: `(your API key)`
4. Click "Manual Deploy" → "Deploy latest commit" to restart

### Phone Calls — Telnyx (pay per minute, ~50% cheaper than Twilio)

Make and receive phone calls through the app.

1. Go to **https://telnyx.com** and create an account
2. Buy a phone number from their portal ($1/month)
3. Create a "Call Control" connection in the Telnyx portal
4. Go to API Keys and copy your key
5. In **Render** → mgr-backend → Environment → add these 3 variables:
   - `TELNYX_API_KEY` → your API key
   - `TELNYX_NUMBER` → your phone number (format: `+12125551234`)
   - `TELNYX_CONNECTION_ID` → from the Call Control connection you created
6. Redeploy on Render

### SMS Text Messages — Plivo (free inbound)

Send and receive text messages.

1. Go to **https://plivo.com** and create an account
2. Get your Auth ID and Auth Token from the dashboard
3. Buy a phone number (or use a free trial number)
4. In **Render** → mgr-backend → Environment → add:
   - `PLIVO_AUTH_ID` → your Auth ID
   - `PLIVO_AUTH_TOKEN` → your Auth Token
   - `PLIVO_NUMBER` → your phone number (format: `+12125551234`)
5. Redeploy on Render

### AI Voice — ElevenLabs (free tier: 10,000 characters/month)

AI-generated voice for phone calls and recordings.

1. Go to **https://elevenlabs.io** and create an account
2. Go to Profile → API Keys → copy your key
3. In **Render** → mgr-backend → Environment → add:
   - `ELEVENLABS_API_KEY` → your API key
4. Redeploy on Render

### Blockchain/NFT Claims — Solana (free for testing)

Tokenize surplus claims on blockchain. Use devnet (free) for testing, mainnet for real.

1. Install Solana CLI on your local machine:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```
2. Generate a wallet:
   ```bash
   solana-keygen new --outfile ~/solana-wallet.json
   ```
3. Copy the private key from the generated file
4. In **Render** → mgr-backend → Environment → add:
   - `SOLANA_PRIVATE_KEY` → your private key
   - `SOLANA_RPC_URL` → `https://api.devnet.solana.com` (for testing) or `https://api.mainnet-beta.solana.com` (for real)
5. Redeploy on Render

---

## MONTHLY COST BREAKDOWN

### What You Pay to Launch (Day 1):

| Service | Cost | Why |
|---------|------|-----|
| Vercel (hosts the website) | **FREE** | Free tier covers this easily |
| Render (hosts the API backend) | **FREE** | Free tier with 750 hours/month |
| Neon (PostgreSQL database) | **FREE** | Free tier with 0.5GB storage |
| DeepSeek (AI features) | **FREE** | First 5 million tokens free, then ~$0.28 per million |
| Amazon SES (sends emails) | **FREE** | First 62,000 emails/month free |
| Brevo (backup email sender) | **FREE** | 300 emails/day free |
| Stripe (credit card payments) | **2.9% + $0.30** | Only charged per transaction |
| OpenSign (e-signatures) | **FREE** | Unlimited free |
| ImprovMX (email forwarding) | **FREE** | Basic forwarding free |
| **TOTAL TO LAUNCH** | **$0/month** | |

### Optional Add-Ons (When You're Ready):

| Service | Cost | When to Add |
|---------|------|------------|
| Modoboa VPS (full email server) | ~$4.50/month | When you need real mailboxes |
| Tracerfy (skip tracing) | $0.02/lead | When you need to find property owners |
| Telnyx (phone calls) | ~$1/month + per minute | When you need phone features |
| Plivo (SMS) | per message | When you need text messaging |

---

## HOW IT ALL CONNECTS (Architecture)

```
User visits capitalmgr.com
         |
         v
    Vercel (Frontend)              Namecheap DNS
    - Next.js React app      capitalmgr.com → Vercel
    - All the pages           api.capitalmgr.com → Render
    - All the UI
         |
         | API calls go to /api/*
         | which gets forwarded to...
         v
    Render (Backend)
    - Express.js API server
    - Handles login, data, business logic
         |
         +--→ Neon PostgreSQL (stores all data)
         +--→ DeepSeek AI (case analysis, chatbot)
         +--→ Amazon SES (sends emails)
         +--→ Stripe (processes payments)
         +--→ OpenSign (e-signatures)
         +--→ Modoboa (email hosting, optional)
```

---

## IMPORTANT NOTES ABOUT FREE TIER

### Render Free Tier Sleep

Render's free tier puts your backend to sleep after **15 minutes of no traffic**. When someone visits the site after it's been sleeping, the first request takes **30-60 seconds** to respond while it wakes up. After that, it's fast until it goes to sleep again.

**This is normal and expected on the free tier.** To avoid it:
- Upgrade to Render's paid tier ($7/month) for always-on
- Or set up a free cron ping service (like UptimeRobot) to ping your backend every 14 minutes

### Neon Free Tier Limits

- **0.5 GB** storage (plenty for starting out)
- Database sleeps after 5 minutes of inactivity (auto-wakes, adds ~1 second delay)
- 190 hours/month of compute

### Vercel Free Tier Limits

- **100 GB** bandwidth/month
- Unlimited deployments
- Auto-deploys when you push to GitHub

---

## TROUBLESHOOTING

### "The site loads but nothing works (can't login, no data)"
→ The `NEXT_PUBLIC_API_URL` is not set in Vercel. Go to Vercel → Settings → Environment Variables → add `NEXT_PUBLIC_API_URL` = `https://api.capitalmgr.com` → then Redeploy.

### "Vercel build fails"
→ Make sure "Root Directory" is set to `frontend` in Vercel project settings (Settings → General → Root Directory).

### "Render build fails"
→ Check the Render logs. 90% of the time it's a missing environment variable. Compare your Render env vars against the list in Step 2C.

### "Backend returns 500 errors"
→ Check Render logs. Click on your service → "Logs" tab. The error message will tell you what's wrong. Most common: missing env var or database connection issue.

### "White screen / blank page"
→ Clear your browser cache (Ctrl+Shift+Delete). If that doesn't fix it, go to Vercel and redeploy.

### "Database errors"
→ Run `npx prisma migrate deploy` from your local machine in the backend folder. This syncs the database schema.

### "Emails not sending"
→ Amazon SES might still be in "sandbox mode" (only sends to verified emails). Go to AWS Console → SES → Request production access.

### "Domain not working after DNS changes"
→ DNS takes up to 48 hours to propagate. Wait, then try again. You can check status at https://dnschecker.org — type in `capitalmgr.com` and see if it resolves to `76.76.21.21`.

### "api.capitalmgr.com not connecting to Render"
→ Check that the CNAME record for `api` in Namecheap matches what Render told you. It should point to something like `mgr-backend.onrender.com`.

### "Login works but I'm not the admin/founder"
→ You need to run the SQL command in Step 5B to promote your account to FOUNDER role.

---

## QUICK REFERENCE — All Your URLs

| What | URL |
|------|-----|
| Your live site | `https://capitalmgr.com` |
| Your API backend | `https://api.capitalmgr.com` |
| Vercel dashboard | `https://vercel.com/dashboard` |
| Render dashboard | `https://dashboard.render.com` |
| Neon database console | `https://console.neon.tech` |
| Namecheap DNS settings | `https://namecheap.com` → Domain List → Manage → Advanced DNS |
| GitHub repo | Your GitHub account → MGR-CAPITAL-ASSISTANCE |
