# MGR Capital Assistance — Deployment Guide

Complete guide for deploying MGR Capital Assistance in production environments, including sovereign/air-gapped deployments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Standard Deployment](#standard-deployment)
5. [Air-Gap Deployment](#air-gap-deployment)
6. [SSL Certificates](#ssl-certificates)
7. [Database Operations](#database-operations)
8. [Backup & Recovery](#backup--recovery)
9. [Volume Encryption (LUKS)](#volume-encryption-luks)
10. [Monitoring & Logs](#monitoring--logs)
11. [Troubleshooting](#troubleshooting)
12. [Security Hardening](#security-hardening)

---

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended), Windows Server 2019+, or macOS
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB minimum, SSD recommended
- **Network**: Static IP recommended for production

### Software Requirements

```bash
# Docker 20.10+
docker --version

# Docker Compose 2.0+
docker-compose --version

# OpenSSL (for certificate generation)
openssl version
```

### Installation (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install OpenSSL
sudo apt install openssl
```

---

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd mgr-capital-assistance

# 2. Run setup (generates certs, creates .env)
./scripts/deploy.sh setup

# 3. Configure environment
nano .env  # Edit with your values

# 4. Deploy
./scripts/deploy.sh deploy

# 5. Access application
# HTTP:  http://localhost
# HTTPS: https://localhost
```

---

## Configuration

### Environment Variables

Copy `.env.template` to `.env` and configure:

```bash
cp .env.template .env
```

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `SecurePassword123!` |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Generate with `openssl rand -base64 32` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `false` | Enable Redis caching |
| `AIR_GAP_MODE` | `false` | Disable external connections |
| `HTTP_PORT` | `80` | HTTP port |
| `HTTPS_PORT` | `443` | HTTPS port |

### Generate Secure Secrets

```bash
# Generate JWT secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')"
echo "BACKUP_PASSPHRASE=$(openssl rand -base64 32)"
```

---

## Standard Deployment

### Deploy Application

```bash
# Initial deployment
./scripts/deploy.sh deploy

# View logs
./scripts/deploy.sh logs

# View specific service logs
./scripts/deploy.sh logs backend
./scripts/deploy.sh logs db
./scripts/deploy.sh logs nginx
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and redeploy
./scripts/deploy.sh deploy
```

### Stop Services

```bash
./scripts/deploy.sh stop
```

### Remove Everything (DESTRUCTIVE)

```bash
./scripts/deploy.sh clean
```

---

## Air-Gap Deployment

For environments without internet access.

### Prepare Bundle (On Internet-Connected Machine)

```bash
# Create air-gap bundle with all images
./scripts/deploy.sh airgap

# Bundle location: ./airgap_bundle/
```

### Transfer to Air-Gapped System

```bash
# Copy entire airgap_bundle directory via:
# - USB drive
# - Secure file transfer
# - Air-gapped network
```

### Deploy on Air-Gapped System

```bash
cd airgap_bundle

# Import Docker images
./import-images.sh

# Run setup
./scripts/deploy.sh setup

# Configure .env
nano .env

# Deploy
./scripts/deploy.sh deploy
```

---

## SSL Certificates

### Self-Signed (Development/Internal)

Generated automatically by `./scripts/deploy.sh setup`

Location: `./certs/`

### Let's Encrypt (Production)

```bash
# Install certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy to nginx certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/certs/selfsigned.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/certs/selfsigned.key

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Certificate Renewal (Cron)

```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && docker-compose -f /path/to/docker-compose.prod.yml restart nginx
```

---

## Database Operations

### Run Migrations

```bash
./scripts/deploy.sh migrate
```

### Seed Database

```bash
./scripts/deploy.sh seed
```

### Direct Database Access

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mgr_capital

# Common commands
\dt                  # List tables
\d+ table_name       # Describe table
SELECT * FROM "User" LIMIT 10;
\q                   # Exit
```

### Reset Database (DESTRUCTIVE)

```bash
# Stop services
./scripts/deploy.sh stop

# Remove database volume
docker volume rm mgr-capital-assistance_db_data

# Redeploy
./scripts/deploy.sh deploy
```

---

## Backup & Recovery

### Create Backup

```bash
./scripts/deploy.sh backup
```

Backups are stored in `./backups/` with timestamps.

If `BACKUP_PASSPHRASE` is set, backups are encrypted with AES-256-GPG.

### Backup Types

| Type | Frequency | Contents | Retention |
|------|-----------|----------|-----------|
| Hourly | Every hour | Database incremental | 24 backups |
| Daily | Every day | Database + Vault | 7 days |
| Weekly | Every week | Full backup + verification | 4 weeks |
| Monthly | Every month | Archive for air-gap | 12 months |

### Automated Backups (Cron)

```bash
# Hourly database backup
0 * * * * /path/to/scripts/deploy.sh backup --type hourly

# Daily full backup at 2 AM
0 2 * * * /path/to/scripts/deploy.sh backup --type daily

# Weekly backup with verification on Sunday 3 AM
0 3 * * 0 /path/to/scripts/deploy.sh backup --type weekly

# Monthly archive on 1st of month at 4 AM
0 4 1 * * /path/to/scripts/deploy.sh backup --type monthly

# Cleanup old backups (handled automatically by BackupService)
```

---

## Disaster Recovery

### Recovery Overview

MGR Capital Assistance provides comprehensive disaster recovery capabilities:

1. **Full Restore Script** (`scripts/restore.sh`) — Automated recovery
2. **BackupService API** — Programmatic restore via `restoreFromDump()`
3. **Manual Procedures** — Step-by-step for air-gapped systems

### Quick Recovery (Automated)

```bash
# List available backups
ls -la ./backups/

# Restore from latest daily backup
./scripts/restore.sh ./backups/db_daily_2024-01-15_02-00.dump.gpg

# Restore database only (skip vault files)
./scripts/restore.sh --db-only ./backups/db_weekly_2024-01-14.dump.gpg

# Restore vault files only
./scripts/restore.sh --vault-only ./backups/vault_daily_2024-01-15.tar.gz.gpg

# Restore without running migrations
./scripts/restore.sh --no-migrate ./backups/db_daily_2024-01-15.dump.gpg
```

### Environment Variables for Restore

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKUP_PASSPHRASE` | Yes (encrypted) | GPG decryption passphrase |
| `DATABASE_URL` | Yes (DB restore) | PostgreSQL connection string |
| `VAULT_DIR` | No | Vault directory (default: ./vault) |
| `BACKUP_DIR` | No | Backup directory (default: ./backups) |

### Full Recovery Procedure

#### Step 1: Prepare Environment

```bash
# Ensure Docker services are stopped
./scripts/deploy.sh stop

# Set required environment variables
export BACKUP_PASSPHRASE="your-backup-passphrase"
export DATABASE_URL="postgresql://user:pass@host:5432/mgr_capital"
```

#### Step 2: Start Database Only

```bash
# Start only the database container
docker-compose -f docker-compose.prod.yml up -d db

# Wait for database to be ready
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

#### Step 3: Restore Database

```bash
# Using restore script (recommended)
./scripts/restore.sh ./backups/db_daily_2024-01-15_02-00.dump.gpg

# Or manually:
# 1. Decrypt
gpg --decrypt --batch --passphrase "$BACKUP_PASSPHRASE" \
    -o backup.dump ./backups/db_daily_2024-01-15_02-00.dump.gpg

# 2. Restore with pg_restore
export PGPASSWORD="your-db-password"
pg_restore -h localhost -p 5432 -U postgres -d mgr_capital \
    --clean --if-exists --no-owner backup.dump

# 3. Cleanup
rm backup.dump
```

#### Step 4: Restore Vault Files

```bash
# Using restore script
./scripts/restore.sh --vault-only ./backups/vault_daily_2024-01-15.tar.gz.gpg

# Or manually:
# 1. Decrypt
gpg --decrypt --batch --passphrase "$BACKUP_PASSPHRASE" \
    -o vault_backup.tar.gz ./backups/vault_daily_2024-01-15.tar.gz.gpg

# 2. Backup existing vault
mv ./vault ./vault_old_$(date +%s)

# 3. Extract
tar -xzf vault_backup.tar.gz -C .

# 4. Cleanup
rm vault_backup.tar.gz
```

#### Step 5: Run Migrations

```bash
# Navigate to backend
cd backend

# Apply any pending migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull --print

cd ..
```

#### Step 6: Restart Services

```bash
# Start all services
./scripts/deploy.sh deploy

# Verify health
curl http://localhost:4000/health
```

### Air-Gapped Recovery

For systems without internet access:

```bash
# On air-gapped system, all steps are the same but ensure:
# 1. All Docker images are pre-loaded (from airgap_bundle)
# 2. Prisma client is already generated
# 3. All dependencies are installed offline

# Skip npm/prisma commands that require internet:
./scripts/restore.sh --no-migrate ./backups/db_monthly_2024-01-01.dump.gpg

# Migrations should already be included in the backup
# If schema changes are needed, they must be pre-applied to the backup
```

### Recovery Verification

After restore, verify system integrity:

```bash
# 1. Check database connectivity
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# 2. Verify tables exist
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mgr_capital -c "\dt"

# 3. Check record counts
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mgr_capital -c "
SELECT 'Users' as table_name, COUNT(*) FROM \"User\"
UNION ALL
SELECT 'Cases', COUNT(*) FROM \"Case\"
UNION ALL
SELECT 'Documents', COUNT(*) FROM \"Document\";
"

# 4. Verify vault files
ls -la ./vault/

# 5. Test API health
curl http://localhost:4000/api/health

# 6. Test authentication
curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "founder@mgrcapital.com", "password": "your-password"}'
```

### Recovery Troubleshooting

#### pg_restore errors

```bash
# "relation already exists" — Use --clean flag
pg_restore --clean --if-exists ...

# "permission denied" — Use --no-owner flag
pg_restore --no-owner ...

# "invalid dump format" — Ensure file is not corrupted
file backup.dump  # Should show "PostgreSQL custom database dump"
```

#### GPG decryption fails

```bash
# Verify passphrase is correct
echo "test" | gpg --symmetric --batch --passphrase "$BACKUP_PASSPHRASE" | \
    gpg --decrypt --batch --passphrase "$BACKUP_PASSPHRASE"

# Check GPG version compatibility
gpg --version
```

#### Vault extraction fails

```bash
# Verify tar archive integrity
tar -tzf vault_backup.tar.gz

# Check for disk space
df -h

# Extract with verbose output
tar -xzvf vault_backup.tar.gz -C . 2>&1 | head -20
```

### Offsite/USB Recovery

For air-gapped systems with USB transfer:

```bash
# 1. Mount USB drive
sudo mount /dev/sdb1 /mnt/usb

# 2. Copy backup files
cp /mnt/usb/backups/* ./backups/

# 3. Verify checksums (from manifest)
sha256sum ./backups/db_monthly_*.dump.gpg

# 4. Proceed with standard restore
./scripts/restore.sh ./backups/db_monthly_2024-01-01.dump.gpg

# 5. Unmount USB
sudo umount /mnt/usb
```

### Restore from Backup

```bash
./scripts/deploy.sh restore ./backups/backup_20240101_020000.sql.gz.enc
```

### Manual Restore (Legacy)

```bash
# Decrypt if encrypted
openssl enc -d -aes-256-cbc -pbkdf2 -in backup.sql.gz.enc -out backup.sql.gz

# Decompress
gunzip backup.sql.gz

# Restore
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres -d mgr_capital < backup.sql
```

---

## Volume Encryption (LUKS)

For sensitive deployments requiring disk encryption.

### Create Encrypted Volume

```bash
# Create encrypted container (adjust size as needed)
sudo dd if=/dev/zero of=/var/mgr-data.img bs=1M count=10240

# Setup LUKS encryption
sudo cryptsetup luksFormat /var/mgr-data.img
sudo cryptsetup open /var/mgr-data.img mgr-data

# Create filesystem
sudo mkfs.ext4 /dev/mapper/mgr-data

# Mount
sudo mkdir -p /var/mgr-data
sudo mount /dev/mapper/mgr-data /var/mgr-data
```

### Configure Docker Volumes

Update `docker-compose.prod.yml`:

```yaml
volumes:
  db_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/mgr-data/postgres
```

### Auto-Unlock at Boot (Optional)

```bash
# Create key file (store securely!)
sudo dd if=/dev/urandom of=/root/.mgr-luks-key bs=512 count=1
sudo chmod 400 /root/.mgr-luks-key
sudo cryptsetup luksAddKey /var/mgr-data.img /root/.mgr-luks-key

# Add to /etc/crypttab
echo "mgr-data /var/mgr-data.img /root/.mgr-luks-key luks" | sudo tee -a /etc/crypttab

# Add to /etc/fstab
echo "/dev/mapper/mgr-data /var/mgr-data ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

---

## Monitoring & Logs

### View Logs

```bash
# All services
./scripts/deploy.sh logs

# Specific service
./scripts/deploy.sh logs backend
./scripts/deploy.sh logs db
./scripts/deploy.sh logs nginx

# Follow with tail
docker-compose -f docker-compose.prod.yml logs -f --tail=100 backend
```

### Health Checks

```bash
# Backend health
curl http://localhost:4000/health

# Nginx health
curl http://localhost/health

# Database health
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

### Container Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Resource Usage

```bash
docker stats
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Common issues:
# - Database not ready: Wait or increase start_period in healthcheck
# - Port conflict: Change HTTP_PORT/HTTPS_PORT in .env
# - Permission denied: Check file permissions on mounted volumes
```

### Database Connection Failed

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps db

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Test connection
docker-compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

### SSL Certificate Errors

```bash
# Regenerate certificates
rm -rf ./certs/* ./nginx/certs/*
./scripts/deploy.sh setup
./scripts/deploy.sh deploy
```

### Permission Denied Errors

```bash
# Fix ownership on Linux
sudo chown -R 1001:1001 ./uploads ./backups ./logs
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a

# Remove old backups
find ./backups -name "*.sql.gz*" -mtime +7 -delete
```

---

## Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2Ban for SSH

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Docker Security

1. **Run as non-root**: Already configured in Dockerfile
2. **Read-only containers**: Add `read_only: true` where possible
3. **Limit resources**: Add memory/CPU limits in docker-compose

```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'
```

### Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
./scripts/deploy.sh deploy
```

---

## Launch Verification Checklist

Pre-launch verification steps to ensure the platform is fully operational.

### 1. Database Seeding Verification

```bash
# Seed initial data
./scripts/deploy.sh seed

# Verify seed data
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d mgr_capital -c "
SELECT COUNT(*) as users FROM \"User\";
SELECT COUNT(*) as state_rules FROM \"StateRule\";
SELECT COUNT(*) as commission_plans FROM \"CommissionPlan\";
SELECT COUNT(*) as training_modules FROM \"TrainingModule\";
"

# Expected output:
# - At least 1 FOUNDER user
# - 50+ state rules (all US states + territories)
# - 5 commission plans (TIER_1 through TIER_5)
# - 10+ training modules
```

### 2. Authentication Testing

```bash
# Test login endpoint
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "founder@mgrcapital.com", "password": "your-password"}'

# Verify JWT token is returned
# Verify refresh token is set in cookie

# Test protected endpoint
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

### 3. Case Management Testing

```bash
# Create test case
curl -X POST http://localhost:4000/api/cases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyAddress": "123 Test St",
    "city": "Nashville",
    "state": "TN",
    "county": "Davidson",
    "estimatedValueCents": 500000
  }'

# Verify case creation
curl http://localhost:4000/api/cases \
  -H "Authorization: Bearer <token>"

# Test document upload
curl -X POST http://localhost:4000/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test-document.pdf" \
  -F "caseId=1" \
  -F "type=CLIENT_ID"
```

### 4. Communication (Comms) Testing

```bash
# Test comms endpoint
curl http://localhost:4000/api/communications?caseId=1 \
  -H "Authorization: Bearer <token>"

# Create test communication log
curl -X POST http://localhost:4000/api/communications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "1",
    "type": "CALL",
    "direction": "OUTBOUND",
    "notes": "Test call for launch verification"
  }'
```

### 5. Air-Gap Simulation

```bash
# 1. Disconnect from internet (simulate air-gap)
# 2. Run the following tests:

# Test health endpoints (should work offline)
curl http://localhost:4000/health
curl http://localhost/health

# Test database operations (should work offline)
curl http://localhost:4000/api/cases \
  -H "Authorization: Bearer <token>"

# Test PWA offline functionality
# - Open https://localhost in browser
# - Verify service worker is active (check DevTools > Application)
# - Go offline in DevTools > Network
# - Refresh page - should show cached content or offline.html

# 3. Reconnect to internet
# 4. Verify all services recover automatically
```

### 6. Backup and Restore Verification

```bash
# Create backup
./scripts/deploy.sh backup

# Verify backup file exists
ls -la ./backups/

# Verify backup is encrypted (if BACKUP_PASSPHRASE is set)
file ./backups/backup_*.sql.gz.enc

# Test restore (on test environment!)
# WARNING: This will overwrite the database

# 1. Create a test case
curl -X POST http://localhost:4000/api/cases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"propertyAddress": "Backup Test", "state": "TN", "county": "Davidson"}'

# 2. Note the case ID

# 3. Restore from backup
./scripts/deploy.sh restore ./backups/backup_<timestamp>.sql.gz.enc

# 4. Verify the test case is gone (restored to pre-backup state)
curl http://localhost:4000/api/cases \
  -H "Authorization: Bearer <token>"
```

### 7. Analytics and Forecasting Verification

```bash
# Test analytics dashboard
curl http://localhost:4000/api/analytics/dashboard \
  -H "Authorization: Bearer <token>"

# Test forecast endpoint
curl http://localhost:4000/api/analytics/forecast \
  -H "Authorization: Bearer <token>"

# Expected response includes:
# - historical: Array of daily revenue/case data
# - predictions: 30-day forecast array
# - summary: avgDailyRevenue, predictedRevenue30d, trend
```

### 8. Mobile Responsiveness Verification

Open the application on various devices/viewports:

| Viewport | Check |
|----------|-------|
| Mobile (< 768px) | Hamburger menu visible, sidebar hidden |
| Tablet (768-1024px) | Hybrid layout works correctly |
| Desktop (> 1024px) | Full sidebar visible, no hamburger |

Test touch interactions:
- Swipe to open/close sidebar
- Tap targets are at least 44x44px
- Forms are usable on touch devices

### 9. PWA Verification

```bash
# Check manifest is accessible
curl http://localhost/manifest.json

# Check service worker is registered
# In browser DevTools > Application > Service Workers
# Should show "service-worker.js" as active

# Verify offline functionality
# 1. Visit the app and navigate around
# 2. Go offline (DevTools > Network > Offline)
# 3. Refresh - should show cached content
# 4. Try navigating - offline.html should appear for uncached routes
```

### 10. Bot Verification

```bash
# Run coordinator bot manually
curl -X POST http://localhost:4000/api/ops/bots/coordinator/run \
  -H "Authorization: Bearer <founder-token>"

# Check for generated insights
curl http://localhost:4000/api/ops/metrics/focus-items \
  -H "Authorization: Bearer <founder-token>"

# Verify bot run log
curl http://localhost:4000/api/ops/bots/logs?limit=5 \
  -H "Authorization: Bearer <founder-token>"
```

### Launch Readiness Checklist

Before going live, verify all items:

- [ ] Database seeded with initial data
- [ ] FOUNDER account can log in
- [ ] Cases can be created, viewed, updated
- [ ] Documents can be uploaded and downloaded
- [ ] Communications can be logged
- [ ] Air-gap mode tested successfully
- [ ] Backup created and verified
- [ ] Restore tested on non-production environment
- [ ] Analytics dashboard loads with data
- [ ] Forecast endpoint returns predictions
- [ ] Mobile responsive design verified
- [ ] PWA manifest loads correctly
- [ ] Service worker active and caching
- [ ] Offline fallback page works
- [ ] All bots can run manually
- [ ] SSL certificates valid
- [ ] Firewall configured
- [ ] Logs accessible and rotating

---

## Support

For issues and support:
- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Documentation: Check `docs/` directory

---

*MGR Capital Assistance — Sovereign Surplus & Tax Sale Recovery Platform*
