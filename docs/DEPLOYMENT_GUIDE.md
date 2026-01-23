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

If `BACKUP_PASSPHRASE` is set, backups are encrypted with AES-256.

### Automated Backups (Cron)

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/scripts/deploy.sh backup

# Weekly cleanup of old backups
0 3 * * 0 find /path/to/backups -name "*.sql.gz*" -mtime +30 -delete
```

### Restore from Backup

```bash
./scripts/deploy.sh restore ./backups/backup_20240101_020000.sql.gz.enc
```

### Manual Restore

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

## Support

For issues and support:
- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Documentation: Check `docs/` directory

---

*MGR Capital Assistance — Sovereign Surplus & Tax Sale Recovery Platform*
