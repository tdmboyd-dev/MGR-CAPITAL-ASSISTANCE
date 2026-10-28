# Capital Assistance — authentication and build repair, October28,2026

Repository: https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE . Branch repair/bottom-up-capital-2026-10-28. Continues the f658442 storage repair; preserves original master and owner work. Compliance Buddy is saved at b1ec44b and held at the owner's request pending TaxSlayer email; its hourly monitor remains ACTIVE. No Compliance source or ONE/API-MCP source was edited during Capital repairs.

## Implemented and executed

Refresh consumption now uses a conditional update inside one PostgreSQL transaction. The predecessor must still be unrevoked, unused, unexpired and associated with an active account. Only one concurrent caller wins. Its successor and predecessor reference commit together; failed creation or signing rolls the whole transaction back. The losing caller receives failure; consumed tokens do not mint additional descendants. This is not a complete token-family/session-revocation implementation or multi-tab cookie reconciliation.

Mandatory and optional auth resolve a verified JWT to the current PostgreSQL account before publishing request identity. Demotion and disablement affect existing signed tokens immediately on the next guarded request. Optional no-token requests remain anonymous. Database resolution failure returns503 and never keeps a stale caller identity. Expiry is mandatory, token type/identity fields are validated and HS256 is explicitly selected. Existing role/tier rules remain; no legal/payout authority was changed.

Removed shared development signing-secret fallback. JWT_SECRET must be explicitly configured with at least32 characters; production/lab keys are server-only. Example keys are blank. Never copy the isolated lab secret into a real deployment or commit it. Login/password hashing was qualified with actual bcrypt, current generated Prisma and PostgreSQL.

Installed lockfile backend dependencies with optional browser downloads/install scripts skipped; generated Prisma client. Full backend TypeScript build initially found3 errors in pCloud and voice Buffer-to-web-body contracts. Using Uint8Array copies fixes those types and preserves the selected Buffer slice. Controlled transport tests prove byte preservation without calling paid/external providers. This is not live pCloud/Deepgram/Whisper qualification.

## Evidence

-13/13 controlled authentication/configuration/transport boundary tests passed,0fail/0skip.
-14/14 actual generated Prisma/PostgreSQL + real signed JWT/Express loopback HTTP checks passed. Includes six simultaneous rotations, duplicate replay, real bcrypt login, current role demotion, disabled account, expiry, real SQL-trigger rollback, retry after rollback and trigger cleanup. Signing failure and database outage ports are explicitly controlled in their named checks.
-9/9 existing actual Windows filesystem confinement tests passed again.
-Full backend npm run build passed after Prisma generation. Full application server/jobs, browser/client refresh-cookie integration, all Jest suites, frontend/mobile builds, deployed services and production were not verified.
-Fresh schema was initialized only in the explicitly owned localhost18588/capital_auth_lab database. Owner/production data was not migrated. Private runtime/signing configuration remains outside source exports.

These percentages are100percent of the named bounded checks only. Whole-product completion remains Unassessed. See evidence/2026-10-28-auth for logs, receipts and exact reading scope. Atomic concurrency approach follows the Prisma transaction/optimistic-concurrency pattern: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions .

## Next ordered work

1. Read complete case/document routes, DocumentVaultService, DocumentAccessService, storage router and their current consumers. Build the actual role/tenant/assigned-employee/client/case/document access matrix, reproduce cross-owner failures, then fix and qualify with isolated database and saved file bytes. Existing founder authority stays intact; model triage does not establish legal rights or payout approval.
2. Remove direct filesystem fallback that bypasses the repaired storage adapter. Fix StorageRouter deletion/replica handling so failed provider deletes preserve registry records and a recoverable reconciliation state. Never silently discard metadata or double-delete across uncertain outcomes.
3. Complete logout/password/reset immediate access revocation, family replay policy, origin/CSRF qualification for cross-site refresh cookies and client/multi-tab refresh coordination. AuthService.verifyRefreshToken's legacy side-effecting all-user revocation remains unused by rotate and requires deliberate redesign, not an unqualified family claim. Account/current-role checks are repaired; full session lifecycle is still open.
4. VoiceService still fabricates a canned STT transcript when providers are unavailable, and has hardcoded confidence/canned AI fallbacks. These defects are discovered and queued; only its binary transport/build compatibility was changed here. Provider adapters still need status/redirect/secret/resource and readback audits. Do not call them connected because a key or compiling class exists.
5. Qualify one actual case-intake/document/browser journey after the domain access matrix is repaired. Background jobs, submissions, signatures/notarial authority, payouts and production remain unqualified; do not boot all autonomous jobs merely to obtain a green health screen.

## Resume commands and custody

Backend: npm ci (skip optional Puppeteer/Cypress downloads if not doing browser work), npm run prisma:generate, npm run build, npm run test:auth-boundary. Actual database test: npm run test:auth-postgres only with DATABASE_URL targeting the explicitly owned capital_auth_lab and CAPITAL_LAB_DIR set to its private evidence directory. The guard refuses other targets. Do not point at owner records. Keep original/default branches and uncommitted work intact. Keep Compliance reply monitoring active while Capital is the active project.
