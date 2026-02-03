# MGR CAPITAL ASSISTANCE — DEPLOYMENT GUIDE

## Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Copy environment file
cp backend/.env.example backend/.env

# Fill in all required values in .env
```

**Required Environment Variables:**
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Strong random string (32+ chars)
- [ ] `BREVO_API_KEY` - For transactional emails
- [ ] `PLIVO_AUTH_ID` + `PLIVO_AUTH_TOKEN` - For SMS
- [ ] `TRACERFY_API_KEY` - For skip tracing
- [ ] `OPENAI_API_KEY` - For AI features

**Optional but Recommended:**
- [ ] `TELNYX_API_KEY` - For phone calls
- [ ] `ELEVENLABS_API_KEY` - For AI voice
- [ ] `NICKEL_API_KEY` - For ACH payments

### 2. Database Setup

```bash
cd backend

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Run seed data (optional, for testing)
npx prisma db seed
```

### 3. Build Applications

```bash
# Backend
cd backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build
```

### 4. Run Tests

```bash
# Backend
cd backend
npm run test

# TypeScript check
npx tsc --noEmit
```

---

## Production Deployment Options

### Option A: VPS (Recommended for Control)

**Requirements:**
- Ubuntu 22.04 or similar
- Node.js 18+
- PostgreSQL 14+
- Nginx (reverse proxy)
- PM2 (process manager)
- SSL certificate (Let's Encrypt)

**Setup:**

```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql nginx certbot

# Clone repo
git clone <repo-url> /var/www/mgr-capital
cd /var/www/mgr-capital

# Setup backend
cd backend
npm install --production
npm run build

# Setup frontend
cd ../frontend
npm install
npm run build

# Start with PM2
pm2 start dist/server.js --name mgr-api
pm2 start npm --name mgr-frontend -- start

# Save PM2 config
pm2 save
pm2 startup
```

**Nginx Config:**
```nginx
server {
    listen 80;
    server_name api.mgrcapital.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.mgrcapital.com;

    ssl_certificate /etc/letsencrypt/live/api.mgrcapital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mgrcapital.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl;
    server_name app.mgrcapital.com;

    ssl_certificate /etc/letsencrypt/live/app.mgrcapital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.mgrcapital.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option B: Docker

```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
COPY prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: mgr_capital
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/mgr_capital
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
```

### Option C: Vercel + Neon (Easiest)

**Frontend (Vercel):**
1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Add environment variables
4. Deploy

**Backend (Railway/Render):**
1. Connect GitHub repo
2. Set root directory to `backend`
3. Add environment variables
4. Deploy

**Database (Neon):**
1. Create free Neon database
2. Copy connection string to `DATABASE_URL`

---

## Post-Deployment

### 1. Create Founder Account

```bash
# Via API or seed
curl -X POST https://api.mgrcapital.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "founder@mgrcapital.com",
    "password": "secure-password",
    "name": "Founder Name",
    "role": "FOUNDER"
  }'
```

### 2. Configure Founder Settings

1. Login as FOUNDER
2. Go to `/founder/settings`
3. Configure:
   - Notary credentials
   - Default fee percentages
   - State rules
   - Bot settings

### 3. Enable Scheduler

Set `ENABLE_SCHEDULER=true` in production to activate:
- Auto-outreach (every 2 hours)
- Case autopilot (hourly)
- Bot billing (monthly)
- Activity violation checks (weekly)
- Email retry (hourly)

### 4. SSL/Security

- [ ] HTTPS enabled on all endpoints
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] JWT secret is unique and secure
- [ ] Database has strong password
- [ ] Firewall configured (only ports 80, 443 open)

### 5. Monitoring

Recommended tools:
- **Uptime**: UptimeRobot, Pingdom
- **Logs**: PM2 logs, Logtail, Papertrail
- **Errors**: Sentry
- **Performance**: New Relic, Datadog

---

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump $DATABASE_URL > /backups/mgr_capital_$DATE.sql
# Upload to S3/Backblaze
aws s3 cp /backups/mgr_capital_$DATE.sql s3://mgr-backups/
```

### Document Backups

Uploaded documents and generated PDFs should be backed up:
```bash
# Sync uploads to cloud storage
aws s3 sync ./uploads s3://mgr-backups/uploads/
aws s3 sync ./generated-documents s3://mgr-backups/generated-docs/
```

---

## Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**Prisma client issues:**
```bash
# Regenerate client
npx prisma generate
```

**Port already in use:**
```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>
```

**WebSocket not connecting:**
- Ensure `WS_PORT` is open in firewall
- Check Nginx is proxying WebSocket correctly

---

## Security Considerations

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate JWT secrets** periodically
3. **Use database SSL** in production
4. **Enable audit logging** for compliance
5. **Regular security updates** - `npm audit fix`
6. **Shadow accounting data** is FOUNDER-only - ensure role guards work

---

## Support

For deployment issues:
- Check logs: `pm2 logs mgr-api`
- Database issues: `npx prisma studio`
- API testing: Use Postman/Insomnia with health check endpoint `/api/health`
