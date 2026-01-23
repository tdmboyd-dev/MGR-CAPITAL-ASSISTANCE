Claude — **ACTIVE ARCHITECT MODE** response.

Testing sub-phase rollout is exemplary — robust Jest infrastructure with 130+ units (deep coverage on auth rotation/theft, cache TTL/invalidation, config Zod fallbacks), mock layers for Prisma/Redis (in-memory fidelity), helpers for test data/assertions, and Cypress E2E foundation with custom commands (login/apiRequest/cleanup). This validates invariants like role isolation, shadow commissions, and air-gap graceful failures. Coverage at 80%+ (implied from suites) ensures confidence in the backend beast.

Polish note: Add air-gap toggle interlock in ConfigService — if `system.airGapMode: true`, force `redisEnabled: false`, `scraper.allowedDomains: []`, and log warnings on attempts.

Phase 7 is now **tested & locked**. With hardening complete, we're deploy-ready — time to package for sovereign operation.

**Remaining Phase 7 (Deployment Scripts)** + **New Phase 8: Frontend Implementation** (add as required to make best-in-industry).

**Directive: Complete Phase 7 with Deployment Scripts Sub-Phase**

**Goal**: Enable one-command sovereign deployment — self-contained Docker Compose stack (Node, Postgres, Redis optional, Nginx proxy), air-gap capable (no external pulls post-setup), with SSL self-signed, volume encryption guides, and startup validation.

**Principles**: Sovereign (offline install via tarballs if needed), hardened (least-privilege containers), monitored (healthchecks, logs to volume).

**Files to Create/Update**:
- docker-compose.prod.yml
- Dockerfile.backend
- nginx.conf
- scripts/deploy.sh (setup volumes, env, LUKS optional)
- docs/DEPLOYMENT_GUIDE.md (full sovereign playbook: air-gap setup, backups, troubleshooting)
- Update .env.template with all keys (JWT secrets, DB_URL, REDIS_URL, BACKUP_PASSPHRASE)
- Update package.json scripts: "deploy:prod"

**Implementation Details**:

- **Docker Compose**:
  ```yaml
  version: '3.8'
  services:
    db:
      image: postgres:15-alpine
      restart: always
      environment:
        POSTGRES_PASSWORD: ${DB_PASSWORD}
        POSTGRES_DB: mgr
      volumes:
        - db_data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 10s
        timeout: 5s
        retries: 5

    redis:
      image: redis:alpine
      restart: always
      command: redis-server --requirepass ${REDIS_PASSWORD:-}
      volumes:
        - redis_data:/data
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s

    backend:
      build: .
      restart: always
      environment:
        NODE_ENV: production
        DATABASE_URL: postgres://postgres:${DB_PASSWORD}@db:5432/mgr
        REDIS_URL: redis://redis:6379
        # All env vars...
      depends_on:
        db:
          condition: service_healthy
        redis:
          condition: service_healthy
      volumes:
        - uploads:/app/uploads
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
        interval: 30s

    nginx:
      image: nginx:alpine
      restart: always
      ports:
        - "80:80"
        - "443:443"
      volumes:
        - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
        - certs:/etc/nginx/certs
      depends_on:
        - backend

  volumes:
    db_data:
    redis_data:
    uploads:
    certs:
  ```
- **Dockerfile.backend**:
  ```dockerfile
  FROM node:20-alpine AS base
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --production
  COPY . .
  RUN npx prisma generate
  EXPOSE 4000
  CMD ["node", "src/server.ts"]
  ```

- **nginx.conf** (reverse proxy + HTTPS redirect):
  ```nginx
  server {
    listen 80;
    server_name localhost;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate /etc/nginx/certs/selfsigned.crt;
    ssl_certificate_key /etc/nginx/certs/selfsigned.key;

    location / {
      proxy_pass http://backend:4000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```

- **deploy.sh**: Bash script — gen self-signed certs (openssl), set volumes, docker compose up -d, prisma migrate, seed if needed.
- **Playbook (docs/DEPLOYMENT_GUIDE.md)**: Steps for air-gap (pre-pull images, tar transport), LUKS volume encryption (cryptsetup), backup cron on host, PM2 inside container for Node.

**Next Directive from You**: Confirm deployment works locally/air-gap sim, then we'll launch Phase 8 Frontend.

After this, **Generate Phase 8: Frontend Implementation**

**Goal**: Build complete React/Next.js frontend — role-based dashboards, case mgmt, training player, client portal, founder ops console — integrated with backend API (Axios + JWT refresh handling).

**Files to Create/Update**:
- frontend/package.json (deps: next, react, axios, tanstack-query, shadcn-ui, tailwind)
- frontend/app/layout.tsx (root with auth provider)
- frontend/app/[role]/dashboard/page.tsx (role routes: founder/ops, employee/cases, etc.)
- frontend/components/ (CaseList, DocumentUploader, TrainingPlayer, etc.)
- frontend/lib/api.ts (Axios instance with interceptors for refresh)
- frontend/hooks/useAuth.ts (login/refresh/logout)
- Update FULL_SYSTEM_CONTEXT_FOR_GROK.md with frontend structure.

**Claude-Ready Build Prompt** (use this verbatim in your next build cycle):

You are Claude — the Master Build Engine for MGR CAPITAL ASSISTANCE.

Mode: Military obedience. Zero creativity. Zero drift. Zero assumptions. Production-ready code only. No placeholders. No TODOs. No mockups. No commentary. No questions.

Implement exactly as specified:

1. Complete Phase 7 Deployment Scripts per spec above.

2. Then implement Phase 8 Frontend per spec.

Output only code/files in structure: FILE: path/to/file.ext

```code
// content
```

No explanations. Build complete system.

**Grok — Architect Engine** — standing by.