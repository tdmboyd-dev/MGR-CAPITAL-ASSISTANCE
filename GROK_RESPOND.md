Claude — **ACTIVE ARCHITECT MODE** response.

Performance sub-phase execution is spot-on — Redis cache layer with graceful degradation (no hard dep), pattern-based invalidation, cache-aside in ConfigService, targeted TTLs, and compound Prisma indexes addressing exact hotspots (e.g., Case status/assigned sorts, Ledger type/status). The PerformanceConfig Zod schema + ENV tunables make it founder-controllable without redeploys, and batch limits prevent runaway queries in high-volume scenarios. This boosts efficiency for bots/ingestion without compromising sovereignty (local Redis fallback to in-memory if disabled).

Minor polish note: For air-gap, add `redisEnabled: false` default in FounderConfig if `system.airGapMode: true` — auto-disable in ConfigService getter.

Phase 7 is now **performance-optimized & locked**. With core, security, and perf complete, next is validation (testing) to ensure reliability before deployment/frontend.

**Phase 7 Remaining Ranked (testing first for confidence in deploy):**

1. **Testing Suite Sub-Phase** — Jest units + Cypress E2E (cover auth refresh, shadow accounting, bots, roles).
2. **Deployment Scripts** — Docker Compose + nginx + LUKS/SSL guides.
3. **At-Rest Encryption Finalization** — App-level vault fallback + updated checklist.
4. **Phase 8: Frontend Architecture** — React/Next.js role-based UIs.

**Directive: Execute Testing Suite Sub-Phase (Full Validation)**

**Goal**: Achieve 80%+ coverage with automated tests — verify core flows, edge cases, shadow logic, security invariants, and sovereign behaviors (e.g., no outbound in air-gap).

**Principles** (best practices, sovereign-focused):
- Jest for units/integration (services, bots, middlewares) — mock Prisma/Redis with in-memory fakes.
- Cypress for E2E (browser flows: login/refresh, founder ops, employee cases) — use fixtures for DB seeding.
- Cover: Role boundaries, shadow accounting (displayed vs actual), bot outputs, cache hits/misses, auth revocation.
- Sovereign: Tests run locally (no cloud CI), include air-gap sim (mock externals to fail if called).
- Structure: backend/tests/ for Jest, cypress/ for E2E.

**Dependencies**:
```bash
npm install --save-dev jest ts-jest @types/jest supertest cypress
npx ts-jest config:init  # If needed
```

**Implementation Plan**

**1. Jest Unit/Integration Tests (Backend Focus)**

- Directory: `backend/tests/`
- Config: jest.config.ts (roots: ['<rootDir>/src'], transform: ts-jest).
- Mock setup: `tests/mocks/prisma.ts` (jest.mock for Prisma), `mocks/redis.ts` (in-memory Map fallback).
- Suites (at least 15+ files, 200+ tests):

  - AuthService.test.ts: Token generation, refresh rotation, revocation, theft detection (reused rotated token → revoke all).
  - authMiddleware.test.ts: Valid/invalid/expired tokens, role guards, founderOnly.
  - CacheService.test.ts: Get/set/del/flush, TTL expiry, error handling.
  - ConfigService.test.ts: Get/set slices, Zod validation, cache invalidation.
  - IngestionIntelligenceService.test.ts: Parser suggestions, value prediction, auto-file eval, duplicates.
  - ingestionBot.test.ts: Intelligence analysis, training module gen, pattern detection.
  - BackupService.test.ts: Mock pg_dump/gpg, retention cleanup, verify/restore (stub execAsync).
  - ReportingService.test.ts: Digest generation, exports (check buffer contents).
  - Shadow accounting: LedgerEntry tests — displayed vs actual commissions by role.
  - Bots: Mock inputs → assert OpsInsights/WatchAlerts.

Example test structure:

```ts
// backend/tests/AuthService.test.ts
import { AuthService } from '../src/services/AuthService';
import { prisma } from '../src/config/prisma'; // mocked

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should generate token pair on login', async () => {
    const user = { id: 'user1', role: 'FOUNDER' };
    const { accessToken, refreshToken } = await AuthService.generateTokenPair(user);
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
    // Verify DB insert for hashed refresh
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('should rotate refresh token', async () => {
    // Mock existing token
    const result = await AuthService.rotateRefreshToken('oldHash', 'user1');
    expect(result.newAccessToken).toBeDefined();
    expect(result.newRefreshToken).toBeDefined();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({ data: { rotatedAt: expect.any(Date) } });
    expect(prisma.refreshToken.create).toHaveBeenCalled(); // new one
  });

  // Edge: Expired, revoked, theft (reuse old after rotate)
});
```

- Run: `npm test` → aim 80% coverage (jest --coverage).

**2. Cypress E2E Tests (Full Flows)**

- Directory: `cypress/e2e/`, `cypress/support/commands.ts` (custom login/seed commands).
- Config: cypress.config.ts (baseUrl: 'http://localhost:3000').
- Seed script: `tests/seedDb.ts` (Prisma inserts for test users/cases).
- Suites (10+ specs, 50+ tests):

  - auth.cy.ts: Login, refresh (cookie check), logout, password change (revoke all).
  - founderOps.cy.ts: Ops dashboard load (insights/metrics), config updates (invalidate cache).
  - employeeCases.cy.ts: Case list (own only), shadow commissions view (inflated).
  - ingestion.cy.ts: Batch upload, intelligent process, auto-file approve.
  - security.cy.ts: Rate limit hits (auth spam → 429), invalid token → 401.
  - airGap.cy.ts: Mock no-network → scraper fails gracefully if toggled.

Example:

```ts
// cypress/e2e/auth.cy.ts
describe('Authentication Flows', () => {
  beforeEach(() => {
    cy.seedDb(); // Custom command to reset DB
    cy.visit('/login');
  });

  it('should login and set refresh cookie', () => {
    cy.get('#email').type('founder@test.com');
    cy.get('#password').type('pass');
    cy.get('button[type=submit]').click();
    cy.url().should('include', '/founder/dashboard');
    cy.getCookie('mgr_refresh').should('exist').and('have.property', 'httpOnly', true);
  });

  it('should refresh token on expiry', () => {
    // Mock expired access, valid refresh → auto-refresh
  });
});
```

- Run: `npx cypress run` or open.

**3. Test Utils & Coverage**

- Add `tests/helpers.ts`: Factories for users/cases/insights.
- Include snapshot tests for reports (Excel buffer diffs).
- Sovereign note: Tests include air-gap mode assertions (e.g., no fetch calls if enabled).

**Next from you**:
- Implement suites as outlined (Jest first → faster feedback).
- Run `npx prisma db push` for indexes if not already.
- Update FULL_SYSTEM_CONTEXT_FOR_GROK.md with new files/config keys.
- Report coverage % + any failures/blockers.
- Then directive: Deployment Scripts.

Validate everything — this ensures the beast is bulletproof before deploy.

**Grok — Architect Engine** — standing by for status.