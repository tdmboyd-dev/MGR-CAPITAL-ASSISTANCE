# Capital Assistance local storage repair — October 28, 2026

Repository: tdmboyd-dev/MGR-CAPITAL-ASSISTANCE. Original master preserved at 2c5d717d818041880a92e1f1f42a9cbe255549c4. Isolated branch: repair/bottom-up-capital-2026-10-28.

## Result

Actual old production adapter read, wrote and listed outside its configured vault through parent traversal, reproduced with owned local filesystem canaries. Repaired LocalFilesystemAdapter;9/9 named acceptance tests pass on actual Windows filesystem, zero skips. No storage-provider/Prisma mocking is used for those positive tests. The TypeScript compiler transpiles actual production source; this is not the full backend build.

## Implementation

- Validate all upload/download/delete/exists/list keys; preserve ordinary relative Windows and slash-separated case/file keys. Deny parent/current segments, absolute/drive/UNC keys, dangerous encoded segments, NUL/control characters, Windows devices/ADS and trailing alias characters. Return percent-escaped canonical URL segments.
- Check each configured-root ancestor and target directory using lstat, refusing junctions/symlinks. Create directories one level at a time. Reject linked/hard-linked/nonregular target files.
- Upload stages owned exclusive bytes, flushes/closes, then renames atomically. Reopened download verifies the opened file against the preflight identity. Directly observable outputs use safe fixed errors.
- Real health probe uses exclusive random names and cleanup. Usage rejects inaccessible/linked traversals rather than claiming an empty free vault. Capacity is configured reporting, not a disk quota.

## Executed acceptance

backend/tests/storage-local-boundary.test.cjs contains nine actual-filesystem cases: save/read/reopen/list/delete; Windows-key compatibility and replacement; malformed/traversal/absolute/encoded/device/ADS keys; child junction; configured-root and ancestor junction; hard links; health/usage; invalid target/runtime arguments; capacity validation. Exact output:after-tests.txt. Baseline causal evidence:before-reproduction.json.

Scoped semantic TypeScript check also passes with actual adapter/interface, existing installed Node types and a schema-derived StorageProviderType declaration. No full generated Prisma client/backend build, actual database, browser, case authorization, external provider or production acceptance is claimed.

## Limits

These checks are preflight defenses, not a kernel sandbox against another hostile process swapping host paths concurrently. Directory-parent races, process crash/fsync durability on every filesystem, antivirus, quotas, huge-directory/download resource budgets and complete API access control are not qualified by this repair. list() preserves its existing array-only contract:denied/unavailable returns[], while mutation/read failures return success:false and fixed errors. A failed staging cleanup can leave an owned temporary file for reconciliation.

## Newly discovered work, not fixed here

- AuthService rotation can return two descendants for the same token under a controlled concurrent database-port reproduction; PostgreSQL race qualification and compare-and-set repair remain open.
- Auth middleware projects JWT role/account claims without current database activity/role checks; current account revocation behavior needs its own repair scope.
- The upload route passes an authenticated actor to DocumentVaultService, which checks case existence in the inspected slice without establishing assigned/client ownership there. Verify all access-matrix paths before calling the whole vault secure.
- DocumentVaultService also performs direct filesystem fallback; it is outside this adapter-only change and must be admitted through equivalent containment/recovery rather than assumed protected.
- StorageRouter inspected deletion path removes registry metadata after a provider deletion failure; reproduce and repair durable delete/reconciliation separately.
- Historical TIME_TODO claims100%complete are superseded for this scope only; whole product completion remains Unassessed. Four application surfaces and broad financial/notary/provider functionality remain unreviewed.

## Re-run

Use Node's test runner from repository root. With installed backend dependencies, supply that TypeScript module or use backend-local resolution. For dependency-free bounded qualification, set MGR_TEST_TYPESCRIPT to an already installed TypeScript package and MGR_STORAGE_TEST_ROOT to an absolute owned fixture directory, then run:node --test backend/tests/storage-local-boundary.test.cjs. No packages, model weights, providers or owner credentials are downloaded/loaded by this test.

Tests keep tiny canary fixtures in the explicitly supplied owned directory for review. No original source/data was reset, merged, deleted or pushed.
