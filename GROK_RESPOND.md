Claude — **ACTIVE ARCHITECT MODE** response.

Security sub-phase delivery is impeccable — comprehensive JWT refresh/rotation with theft detection (family tracking via replacedById, hashed storage), strict cookie policies, RBAC middleware refinements, rate-limited auth flows, Helmet headers, and a detailed air-gap checklist. This elevates the platform to enterprise-grade security without external deps, fully sovereign (local revocation, no cloud auth). The Prisma model additions (rotatedAt, replacedById) enable deep audit trails, and Zod/Env configs make it tunable without code changes.

One minor note: For air-gap, ensure ScraperService has a `airGapMode` toggle in FounderConfig to disable all scraping (set allowedDomains: []) — prevents any outbound if enabled.

Phase 7 is now **security-hardened & locked**. With core (scheduling/backups/reports) + security complete, we're ready for optimization and validation before frontend/user-facing layers.

**Phase 7 Remaining Ranked (performance first for efficiency gains in testing/deploy):**

1. **Performance Optimization** — Redis caching (hot paths like metrics/config), Prisma indexes (frequent queries), batch limits.
2. **Testing Suite** — Jest units (services/bots/auth), Cypress E2E (role flows, shadow accounting, refresh scenarios).
3. **At-Rest Encryption** — Finalize manual LUKS guide + app-level file encryption fallback.
4. **Deployment Scripts** — Docker Compose prod + nginx + self-signed SSL.
5. **Frontend Phase 8 Kickoff** — After above.

**Directive: Execute Performance Optimization Sub-Phase**

**Goal**: Boost scalability + responsiveness for high-volume ingestion/bots/reports without external cloud — local Redis for caching, Prisma optimizations for DB hotspots.

**Principles** (current best practices, sovereign-focused):
- Redis as local cache (no persistence needed for ephemeral data; use for sessions/config/metrics).
- Cache invalidation: TTL + manual evict on updates (e.g., FounderConfig change → flush config cache).
- Prisma: Add compound indexes on hot joins/filters (e.g., Case by status/userId).
- Batch processing limits: Enforce in bots/services (e.g., 500 records/batch) to prevent OOM.
- Sovereign: Redis in Docker, no auth required (local only), optional if RAM-constrained.

**Dependencies**:
```bash
npm install redis @redis/client
npm install -D @types/redis
```

**Implementation Plan**

**1. Redis Integration (Core Cache Layer)**

- Create `backend/src/services/CacheService.ts` using `@redis/client`.
- Config: Local Redis (url: 'redis://localhost:6379' from env; FounderConfig.performance.redisEnabled).
- Methods:
  - `get(key: string)`: JSON.parse or raw.
  - `set(key: string, value: any, ttlSeconds?: number)`: JSON.stringify with EX.
  - `del(key: string)`.
  - `flush(pattern: string)`: For invalidation (e.g., 'config:*').
  - Health check: `ping()`.

Example:

```ts
// backend/src/services/CacheService.ts
import { createClient } from 'redis';
import logger from '../utils/logger';

class CacheService {
  private client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  private connected = false;

  async connect() {
    if (this.connected) return;
    this.client.on('error', err => logger.error('Redis error', { err }));
    await this.client.connect();
    this.connected = true;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    await this.connect();
    await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.connect();
    await this.client.del(key);
  }

  async flush(pattern: string): Promise<void> {
    await this.connect();
    const keys = await this.client.keys(pattern);
    if (keys.length) await this.client.del(keys);
  }
}

export const cacheService = new CacheService();
```

- Integrate in hot paths:
  - FounderConfig: Cache entire slice (key: 'config:sliceName', TTL 1h) → flush on update.
  - JurisdictionMetrics: Cache per state/county (key: 'metrics:state:county', TTL 30m).
  - OpsInsights: Cache recent lists (key: 'insights:userId:priority', TTL 5m).
  - TrainingRecommendations: Per employee (TTL 1h).
  - Invalidate: On bot runs/updates → call flush.

**2. Prisma Optimizations (Indexes + Query Tuning)**

- Add indexes to schema.prisma (based on frequent queries):
  ```prisma
  model Case {
    // ...
    @@index([status, assignedToId, createdAt(sort: Desc)]) // Hot filter/sort
    @@index([jurisdictionState, jurisdictionCounty]) // Ingestion hot
  }

  model LedgerEntry {
    @@index([type, status, createdAt(sort: Desc)])
  }

  model OpsInsight {
    @@index([priority, type, createdAt(sort: Desc)])
  }

  model RefreshToken {
    @@index([userId, expiresAt(sort: Desc)])
  }

  // Add to others: IngestionRecord (predictedValueCents, status), etc.
  ```
- Tune queries: Use `select` for lean returns, `take/skip` for pagination, `include` only needed relations.
- Batch limits: In IngestionBot/IntelligenceService → process in chunks (e.g., 1000 records) with progress logging.

**3. Batch & Resource Limits**

- Add FounderConfig.performance keys:
  - batchSizeLimit: number (default 1000)
  - queryTimeoutMs: number (default 30000)
- Enforce in services: e.g., `ingestionBot.runIntelligenceAnalysis()` → split large batches.

**4. At-Rest Encryption Fallback (Quick)**

- Since LUKS is manual/host-level: Add guide to `docs/SECURITY_AIRGAP_CHECKLIST.md` (e.g., Ubuntu LUKS setup steps).
- For DocumentVault: Implement app-level if needed — encrypt on upload/decrypt on serve (AES-256-GCM, master key from env).

**Next from you**:
- Implement above (Redis first → immediate wins).
- Run `npx prisma db push` for indexes.
- Update FULL_SYSTEM_CONTEXT_FOR_GROK.md with new service/model changes.
- Report completion → then directive for Testing Sub-Phase.

Push performance — this preps for smooth testing/deploy. We're nearing full sovereign deployment.

**Grok — Architect Engine** — ready for update.