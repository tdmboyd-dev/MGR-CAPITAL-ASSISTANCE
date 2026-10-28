# Capital Assistance case and document repair — October 28, 2026

Active repository: https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE
Branch: repair/bottom-up-capital-2026-10-28. Preserve original master and newer owner work.
Owner instruction: Capital Assistance only. TaxSlayer monitoring was deleted at owner direction; no Compliance work is active here.

## Actual fixes

1. Centralized current-account, company, client ownership, assigned employee and team-lead document authority. A token alone does not establish current permission.
2. Applied that authority to document upload/list/download/view/review/reconciliation/delete and case reads/search/update/assignment.
3. Prevented cross-company case access, nested ownership/tenant changes through case PATCH, and global financial statistics access outside the global founder.
4. Removed internal financial fields and internal document types from client case responses; removed storage paths and generated content from document projections.
5. Enforced the already-existing portal expiry fields on public-token reads. This is not a new retention policy.
6. Confined legacy files through the repaired filesystem adapter. Registered storage failures cannot silently fall back to an unrelated raw path.
7. Validated upload type, filename, size and per-case capacity. New storage operations reserve metadata before file writes; actual readback checks length and SHA256 before READY.
8. Added persistent FileRegistry lifecycle and lastError columns, plus explicit authorized upload reconciliation. Failed or uncertain writes retain identifiable targets.
9. Saved deletion state before physical action. Failed replica deletion retains primary bytes, registry and document for retry. Registry removal and nonnegative usage reduction commit together after physical deletion succeeds.
10. Required a successful audit write before download bytes are released. Retained document tombstones and deletion audit after successful removal.
11. Stopped arbitrary signature URLs from fabricating signed status. Actual signing remains unavailable until recipient-bound evidence is implemented.
12. Disabled unsafe automatic orphan deletion until a reviewed inventory and retention reconciliation exist. No unreviewed owner files were removed.

## Executed verification

- 26/26 actual PostgreSQL + signed JWT + Express API + Windows filesystem acceptance checks.
- 3/3 further checks in a separate Node process using retained records and bytes: readback, company isolation and deletion durability.
- 14/14 authentication/PostgreSQL/HTTP regression checks.
- 13/13 controlled authentication/configuration/transport boundary checks.
- 9/9 actual filesystem boundary checks.
- Full generated backend TypeScript build: see build evidence.

These are five named test sets, not a claim that the product is complete. Actual database and filesystem operations used synthetic cases and files. No customer records, taxpayer data, filing, signature provider, payment, live cloud provider or production deployment was exercised. The complete autonomous server and browser journey were not started. The lab is guarded to loopback port18588/database capital_auth_lab; never point these tests at a customer database.

The first reopening harness run completed assertions but failed its server shutdown. The harness now waits for listening and closes only a running server; the rerun exited0. A filesystem regression invocation initially omitted its required owned fixture root and refused to run; the corrected invocation passed9. Deliberate audit-trigger failures in the vault/auth logs are expected negative acceptance tests, not unresolved runtime exceptions.

## Role interpretation

The master specification section8 document matrix conflicts with the resolved role definitions in14.2 for Compliance review. This implementation follows14.2: Compliance reads within its company and does not approve documents. Founder deletion authority and existing owner fee/legal decisions remain intact. Only a founder with no tenant has global scope; tenant-bound founders remain in their company. Team leads do not receive identity originals.

## Schema and operation recovery

backend/prisma/repairs/20261028-storage-lifecycle.sql adds FileRegistry.lifecycle and lastError. It was applied only to the owned lab, then Prisma regenerated. No live schema was migrated. Existing registry rows default READY for compatibility, but downloads still verify saved length/hash. READY is storage integrity, not malware clearance or signature validity.

Upload states: UPLOAD_PENDING -> READY, or UPLOAD_FAILED retained for explicit reconciliation. Document-level pending state also covers a file saved before final audit commit. Retry POST /api/documents/:id/reconcile as an authorized own-company administrator/founder after resolving the cause; it verifies bytes before completion. Deletion states: DELETE_PENDING -> registry removed/document DELETED, or DELETE_FAILED retained. Retry the founder DELETE endpoint after the cause is resolved. Completed document deletion remains a tombstone and subsequent normal reads return404. This is not comprehensive distributed transaction or crash-window qualification.

## Remaining work, in execution order

1. Full browser intake/document journey: qualify client selection, assignment, upload/retry/loading/error states and saved results using the actual UI. Current proof is API/database/filesystem only.
2. Repair case workflow atomicity: count-derived case identifiers can race; case status, deadline, audit and notification writes need transaction/outbox behavior. Test concurrent intake, failed notification and retry without duplicate events. Recheck state fee/jurisdiction rules against approved source before changing any legal decision.
3. Repair storage migrate/replicate/bulkSync: migration can update the source pointer before confirmed deletion; these operations need durable source-and-target journals, checksum readback, atomic usage accounting and restart/failed-provider acceptance. Replica creation itself is not comprehensively crash-qualified. Add graph-cycle defenses for corrupt replica relationships.
4. Implement recipient-bound signature requests, immutable signed-artifact verification and provider receipts. Local review SUBMITTED is explicitly not proof of claim filing. No e-signature or remote filing connection has been established.
5. Add admitted-content scanning/content-type verification and an explicit quarantine path. Current uploads state NOT_SCANNED and download as attachments; bytes are not encrypted by this change. Production encryption/key custody and retention decisions remain open.
6. Authentication session-family invalidation, cookie multi-tab behavior, CSRF and lost-response recovery remain separate acceptance work.
7. Remove fabricated speech-to-text/AI fallback and confidence claims from VoiceService; provider absence must return an honest unavailable state. No live voice qualification yet.
8. Audit remaining routes/jobs/provider secrets/financial and legal operations; LegalService document generation is a separate write path and must be brought into the same vault authority and integrity lifecycle before launching the full server. No whole-repo or production readiness claim is justified.

## Source reading and boundaries

Fully read the affected original document vault, document router, storage router, case router and central access implementation, plus applicable repository boot instructions and the unchanged2121-line MGR handbook (SHA256 5bce398eadd22d12ab164035fa0c94a29f484e03293573402a2fead9d80ffe6b). Schema sections for Case/User/Document/FileRegistry/StorageProvider/Tenant were inspected. Master overview, roles, section8 and14.2 were read; the entire master specification and entire repository were not audited. Legal/notification/push/demo import startup slices and field-masking portions were inspected only. Earlier auth/storage reading ledgers remain applicable within their stated scope.

## Reproduce

Generate Prisma with the complete schema, build from backend with npm run build. npm run test:auth-boundary runs13 controlled checks. node --test tests/storage-local-boundary.test.cjs requires MGR_STORAGE_TEST_ROOT as an absolute owned fixture directory. For actual lab acceptance use private configured DATABASE_URL/JWT_SECRET/DOCUMENT_STORAGE_PATH/CAPITAL_LAB_DIR, npm run test:vault-postgres then npm run test:vault-reopen in a separate Node process. The latter deliberately needs the first run's retained lab IDs. No credentials or private runtime configuration are included in source or downloads.
