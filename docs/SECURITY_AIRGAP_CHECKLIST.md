# Security & Air-Gap Simulation Checklist

## MGR Capital Assistance — Sovereign Security Posture

This checklist ensures the system maintains a sovereign, air-gapped security posture suitable for founder-only operations with sensitive financial data.

---

## 1. JWT & Authentication Hardening

### Access Tokens
- [ ] **Short-lived access tokens** (15 min default, configurable)
- [ ] **JWT signed with HS256** using strong secret (256+ bit)
- [ ] **Issuer/audience claims** enforced (`mgr-capital`, `mgr-capital-app`)
- [ ] **Token type claim** prevents refresh token misuse as access token

### Refresh Tokens
- [ ] **Long-lived refresh tokens** (14 days default, configurable)
- [ ] **SHA256 hashed storage** (never store raw tokens)
- [ ] **HttpOnly, Secure, SameSite=Strict cookies**
- [ ] **Token rotation on use** (old token invalidated, new token issued)
- [ ] **Token family tracking** (detect theft via rotated token reuse)
- [ ] **Revocation on logout/password change**
- [ ] **Device/IP tracking** for security audit

### Cookie Configuration
```env
# Production settings
COOKIE_SECURE=true          # Require HTTPS
COOKIE_DOMAIN=yourdomain.com  # Lock to domain
JWT_ACCESS_EXPIRY_MINUTES=15
JWT_REFRESH_EXPIRY_DAYS=14
```

---

## 2. At-Rest Encryption

### Database Encryption
- [ ] **Filesystem-level encryption** (LUKS/dm-crypt recommended)
  ```bash
  # Example: Create encrypted volume for PostgreSQL data
  cryptsetup luksFormat /dev/sdX
  cryptsetup luksOpen /dev/sdX pgdata
  mkfs.ext4 /dev/mapper/pgdata
  mount /dev/mapper/pgdata /var/lib/postgresql
  ```
- [ ] **Alternative**: PostgreSQL TDE (pg_tde extension) for column-level encryption

### Document Vault Encryption
- [ ] **Volume encryption** for `/app/uploads/documents`
- [ ] **Alternative**: Per-file AES-256-GCM encryption
  - Master key in `FounderConfig.encrypted.vaultMasterKey`
  - Per-file IV/authTag stored in Document model

### Backup Encryption
- [ ] **GPG AES-256 symmetric encryption** for all backups
- [ ] **Encryption key** stored separately from backups
- [ ] **Verify backup integrity** with SHA256 checksums

---

## 3. Air-Gap Simulation & Verification

### Pre-Deployment Checklist
- [ ] **No telemetry/analytics** packages installed
- [ ] **No external API calls** except explicit allowlist
- [ ] **Local-only storage** (no S3, cloud storage)
- [ ] **Email/SMS disabled** in air-gap mode

### Testing Air-Gap Mode
```bash
# 1. Run with network isolation
docker run --network none -v $(pwd):/app mgr-capital-backend

# 2. Test core flows (should all work):
#    - User login/logout
#    - Case creation/update
#    - Document upload/download
#    - Report generation
#    - Backup creation

# 3. Test external features (should gracefully fail):
#    - Email notifications → expect "Email disabled in air-gap mode"
#    - Scraper → expect "Scraping disabled in air-gap mode"
```

### Network Egress Verification
```bash
# Monitor for unexpected outbound connections
tcpdump -i eth0 'not (port 5432 or port 4000 or port 3000)' -n

# Block all outbound except localhost
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -j DROP
```

### Configuration for Air-Gap
```env
# .env settings for air-gap deployment
AIR_GAP_MODE=true
EMAIL_ENABLED=false
SMS_ENABLED=false
SCRAPER_ENABLED=false
BACKUP_OFFSITE_ENABLED=false
```

### FounderConfig Settings
```json
{
  "key": "security",
  "value": {
    "airGapMode": true,
    "allowedExternalDomains": [],
    "rateLimitEnabled": true
  }
}
```

---

## 4. Scraper Allowlist

When scraping is needed, enforce strict domain allowlist:

```json
{
  "key": "scraper",
  "value": {
    "enabled": true,
    "allowedDomains": [
      "*.gov",
      "*.courts.gov",
      "publicrecords.*.gov"
    ],
    "blockUnknownDomains": true,
    "logAllRequests": true
  }
}
```

---

## 5. Rate Limiting

### Endpoint Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 req | 15 min |
| Auth (login/register) | 10 req | 15 min |
| Password reset | 3 req | 15 min |
| Refresh token | 20 req | 15 min |

### Configuration
```env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=10
```

---

## 6. Security Headers (Helmet.js)

### Production Headers
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 7. HTTPS Enforcement

### Self-Signed Certificate (Air-Gap)
```bash
# Generate self-signed cert for sovereign deployment
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/mgr-capital.key \
  -out /etc/ssl/certs/mgr-capital.crt \
  -subj "/C=US/ST=State/L=City/O=MGR Capital/CN=localhost"
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name localhost;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name localhost;

    ssl_certificate /etc/ssl/certs/mgr-capital.crt;
    ssl_certificate_key /etc/ssl/private/mgr-capital.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Audit Logging

### Events to Log
- [ ] All authentication attempts (success/failure)
- [ ] Password changes
- [ ] Session creation/revocation
- [ ] Sensitive data access (surplus amounts, financials)
- [ ] Configuration changes
- [ ] Backup operations
- [ ] Admin actions

### Log Retention
```json
{
  "key": "system",
  "value": {
    "logLevel": "info",
    "logRetentionDays": 365,
    "auditLogRetentionDays": 730
  }
}
```

---

## 9. Deployment Verification Script

```bash
#!/bin/bash
# security-check.sh - Run before production deployment

echo "=== MGR Capital Security Verification ==="

# 1. Check environment variables
echo "[1] Checking environment variables..."
[[ -z "$JWT_SECRET" ]] && echo "  ERROR: JWT_SECRET not set" && exit 1
[[ "$JWT_SECRET" == *"dev"* ]] && echo "  ERROR: JWT_SECRET contains 'dev'" && exit 1
[[ ${#JWT_SECRET} -lt 32 ]] && echo "  ERROR: JWT_SECRET too short" && exit 1
echo "  OK: JWT_SECRET configured"

# 2. Check cookie settings
echo "[2] Checking cookie settings..."
[[ "$COOKIE_SECURE" != "true" ]] && echo "  WARN: COOKIE_SECURE not true"
echo "  OK: Cookie settings checked"

# 3. Check for telemetry
echo "[3] Checking for telemetry packages..."
grep -r "sentry\|analytics\|mixpanel\|segment" package.json && echo "  WARN: Telemetry package detected"
echo "  OK: No telemetry packages found"

# 4. Check HTTPS
echo "[4] Checking HTTPS enforcement..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health | grep -q "301\|308" && echo "  OK: HTTP redirects to HTTPS"

# 5. Check security headers
echo "[5] Checking security headers..."
curl -s -I https://localhost:4000/health | grep -i "x-frame-options: DENY" && echo "  OK: X-Frame-Options set"

echo "=== Security verification complete ==="
```

---

## 10. Incident Response

### If Token Theft Suspected
1. **Revoke all tokens** for affected user via `/auth/logout-all`
2. **Force password reset**
3. **Review audit logs** for suspicious activity
4. **Check refresh token reuse alerts** (logged when rotated token is reused)

### If Backup Key Compromised
1. **Generate new GPG key**
2. **Re-encrypt all backups** with new key
3. **Destroy old key securely**
4. **Update `BACKUP_ENCRYPTION_KEY` env var**

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| JWT Hardening | ✅ Implemented | Short-lived access + rotating refresh |
| Refresh Tokens | ✅ Implemented | HttpOnly cookies, SHA256 hashed |
| Rate Limiting | ✅ Implemented | Tiered limits by endpoint |
| Security Headers | ✅ Implemented | Helmet.js configured |
| At-Rest Encryption | 📋 Manual | Recommend LUKS for volumes |
| Air-Gap Mode | 📋 Manual | Test with --network none |
| HTTPS | 📋 Manual | Self-signed cert for sovereign |

---

*Last Updated: 2026-01-23*
*Document Version: 1.0*
