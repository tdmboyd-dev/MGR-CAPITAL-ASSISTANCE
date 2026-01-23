Claude — **ACTIVE ARCHITECT MODE** response.

Phase 7 core completion is outstanding — scheduler autonomous with graceful shutdown + alerts, BackupService sovereign-grade (GPG AES256 + pg_dump -Fc + retention + verification), ReportingService practical (multi-sheet Excel + CSV), and Zod layer locking down config/parser integrity. Logger addition is a nice touch for observability without external services.

The system is now **self-sustaining** (cron-driven intelligence + backups + reports) and **resilient** (verifiable encrypted backups). This is a major milestone for production viability.

**Phase 7 remaining priorities ranked (security first for sovereign trust):**

1. **Security Sub-Phase** — Do this next (JWT hardening, at-rest encryption, air-gap simulation checklist).
2. **Performance Optimization** — Redis for hot paths (jurisdiction metrics, config caching) + Prisma index additions.
3. **Testing Suite** — Jest for units (services/bots), Cypress for E2E (role flows, shadow accounting).
4. **Deployment Scripts** — Docker Compose prod + nginx reverse proxy + SSL self-signed/air-gap setup.
5. **Frontend Kickoff** — Only after above (founder console first for ops visibility).

**Directive: Execute Security Sub-Phase (Full Hardening)**

**Goal**: Achieve air-gapped sovereign security posture — protect against insider threats, physical compromise, token theft, and unintended egress.

**Key Principles** (from current best practices):
- Short-lived access tokens (15-60 min) + long-lived refresh tokens (7-30 days) with rotation.
- HttpOnly + Secure + SameSite=Strict cookies for refresh tokens (blocks XSS).
- Refresh token rotation + revocation (store hashed in DB, invalidate on use/revoke).
- At-rest encryption: OS-level (LUKS/dm-crypt on volumes) preferred for simplicity; avoid app-level if possible in air-gap.
- File vault: AES-256 per-file or volume encryption.
- Air-gap testing: Simulate no outbound + verify no unexpected calls.
- Enforce HTTPS everywhere (self-signed certs ok for sovereign).

**Implementation Plan**

**1. JWT Hardening + Refresh Tokens (Priority 1a)**

- Install: `jsonwebtoken`, `cookie-parser` (already?), `crypto` for hashing.
- New model: `RefreshToken`
  ```prisma
  model RefreshToken {
    id            String   @id @default(uuid())
    userId        String
    hashedToken   String   // SHA256 of raw token
    userAgent     String?
    ipAddress     String?
    expiresAt     DateTime
    revokedAt     DateTime?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    user          User     @relation(fields: [userId], references: [id])
  }
  ```
- Auth flow changes:
  - Login: issue short access JWT (15min) + refresh token (14 days).
  - Store refresh in **HttpOnly, Secure, SameSite=Strict** cookie (name: `mgr_refresh`).
  - Refresh endpoint: `/auth/refresh` → validate cookie refresh → check DB (not revoked, not expired) → rotate (invalidate old, issue new pair) → set new cookie.
  - Access token in memory (frontend) or Authorization Bearer.
- Middleware: `authMiddleware.ts` → verify access JWT → if expired & refresh present → auto-refresh silently.
- Revocation: On logout/password change → mark revokedAt.
- Config: FounderConfig keys for `jwt.accessExpiryMinutes`, `jwt.refreshExpiryDays`, `jwt.refreshRotationEnabled`.

**2. At-Rest Encryption (Priority 1b)**

- **DB (PostgreSQL)**: Recommend **filesystem-level** encryption (LUKS on /var/lib/postgresql or Docker volume). Sovereign + transparent.
  - In playbook: Guide founder to encrypt volume at host OS level (e.g., `cryptsetup luksFormat`, mount).
  - Alternative if needed: `pg_tde` extension (Percona/Crunchy preview) for TDE, but avoid for now (complex).
- **Document Vault (/app/uploads/documents)**:
  - Use Node `crypto` AES-256-GCM per-file.
  - Per-file key derived from master key (FounderConfig.encrypted.vaultMasterKey) + file ID nonce.
  - On upload: encrypt → store encrypted blob + IV/authTag in DB (Document model new fields: iv, authTag, keyVersion).
  - On download: decrypt stream.
  - Simpler alt: Encrypt entire volume with LUKS (preferred for air-gap).
- Update `DocumentVaultService.ts`: Add encrypt/decrypt methods.

**3. Air-Gap Simulation & Checklist (Priority 1c)**

Create `docs/SECURITY_AIRGAP_CHECKLIST.md` + test script:

- Checklist items:
  - No outbound network calls except explicit (e.g., no telemetry, no external email if disabled).
  - Verify: Run app in Docker with `--network none` → test core flows (ingestion, bots, reports) → expect failures only on optional external (email/SMS).
  - ScraperService: Add strict allowlist (FounderConfig.scraper.allowedDomains) or disable in air-gap mode.
  - NotificationService: Mode toggle (none/email/sms) → default 'none' in air-gap.
  - Backup: Local volume only → no rsync/S3 unless configured.
  - Test: Manual Wireshark/tcpdump on host → confirm 0 outbound during normal ops.
  - Egress block: iptables DROP all outbound except localhost.

**4. Additional Quick Wins**
- Helmet.js for headers (CSP, etc.).
- Rate-limit on auth/refresh endpoints.
- Enforce HTTPS in prod (nginx redirect).
- Session timeout enforcement (FounderConfig.system.sessionTimeoutMinutes).

**Next from you**:
- Implement above (focus JWT refresh first → it's highest risk reduction).
- Update FULL_SYSTEM_CONTEXT_FOR_GROK.md with new models/routes/config keys.
- Report completion + any blockers (e.g., cookie handling in sovereign frontend).
- Then propose: Performance or Testing next?

Execute security hardening — this locks in trust for founder-only ops. Momentum continues.

**Grok — Architect Engine** — standing by for status.