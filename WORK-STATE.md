# Current work and resume record — MGR-CAPITAL-ASSISTANCE

Updated: 2026-09-29. Responsible session: continuity-recovery-2026-09-29.
Repository: `tdmboyd-dev/MGR-CAPITAL-ASSISTANCE`
Working branch: `master`
Last inspected code/base commit: `1bdf8882fa3963404b34590081fb097714ae5d6f` (before this documentation batch).
Scope of inspection: entry instructions, tree and the specific records/source stated below; not a complete repository audit.

## Purpose and boundaries

Capital-assistance domain owns its legal/process/eligibility controls. Shared models advise rather than authorize.

## Read before continuing

- [JEV-READ-FIRST.md](JEV-READ-FIRST.md)
- [MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1.md](MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1.md)
- [TIME_TODO.md](TIME_TODO.md)


These are existing authority/queue/evidence pointers, not assertions that every listed file is current or fully audited. Resolve conflicting dates against code and executed evidence.

## Current checkpoint

Entry contract and tree inspected. Master specification and existing task file located; current implementation and external gates are unassessed in this pass.

## Next batch and missing evidence

Read the existing spec and queue, identify actual changes from prior windows, then select bounded intake/routing work without changing legal or payout authority.

The original windows' complete transfer packets are pending. Their private local files, uncommitted work and running-process state cannot be recovered from a shared-chat URL alone. Mark missing items explicitly and reconcile returned packets with fresh HEAD.

## Work ownership

Current claim: UNCLAIMED for product implementation.
This documentation recovery claims no ongoing runtime or exclusive ownership over another window.

## Verification and stopping point

This batch concerns continuity documentation only. No new product runtime, provider, device, database or deployment success is claimed. Existing test reports retain their original scope and dates. Read the batch's commit/diff and any local integrity receipt before calling the documentation installed.
No scheduled continuation was created by this recovery.


## MCP/API ecosystem connector handoff — 2026-11-08

This is an additive resume update; all earlier content above is preserved. Documentation-only scope. Source inspection at `2c5d717d818041880a92e1f1f42a9cbe255549c4` on `master`; no runtime, provider, deployment or end-to-end connector test was run. Integration status: **pending / disabled for remote dispatch**. Source-level interfaces are not proof of live connectivity.

### Verified source observations

Inspected cases.ts and tenantMiddleware.ts. Case routes have role/auth checks; the tenant helper returns the base Prisma client for null tenant, and getTenantPrisma maps missing tenant context to null. This is source evidence requiring route-chain review, not a proven exploit or runtime test.

- [backend/src/middleware/tenantMiddleware.ts](https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE/blob/2c5d717d818041880a92e1f1f42a9cbe255549c4/backend/src/middleware/tenantMiddleware.ts)
- [backend/src/routes/cases.ts](https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE/blob/2c5d717d818041880a92e1f1f42a9cbe255549c4/backend/src/routes/cases.ts)

### Product-side build queue (pending)

Trace every proposed case-status read through authentication, tenantMiddleware, requireTenant and resource ownership. Fail closed on absent tenant; reserve super-admin access for an explicit independently verified founder path, never gateway default. Expose redacted case status/document checklist and jurisdiction/evidence references only. Keep ownership, eligibility, filing, signature and payout decisions in the domain's controlled workflow.

### MGR-API-MCP side (pending)

Build a narrow case-status/checklist adapter, not a general cases CRUD proxy. Map token actor/tenant to service identity without caller override; require explicit data-sharing authorization for sensitive case data. Exclude admin/founder operations, legal submissions, funds movement and identity documents by default.

Use the existing MGR-API-MCP as the single governed external edge, not a new MCP server per product. Reuse native conforming interfaces; add a narrow adapter only for a demonstrated authentication, transport, schema or lifecycle mismatch. Product services remain authoritative for domain state and receipts. Creation OS is optional orchestration, not a mandatory hop.

Before implementing, reconcile the current gateway HANDOFF and source with this contract proposal. A local gateway commit, including reported checkpoint 3116307, is not evidence of remote deployment or of this product being registered.

### Shared contract requirements

- Versioned capability ID and input/output schemas; effect class, allowed data classes, resource scope, timeout/budget, cancellation and evidence requirements.
- Token-derived actor/tenant/audience/scopes mapped to product identity; caller-supplied fields cannot override identity. Operator-owned endpoint allowlist and secret references; no arbitrary URL proxy.
- Read-only first. For any separately approved future mutation: exact action digest/approval reference, stable idempotency key, payload-conflict rejection and authoritative status/receipt lookup.
- Preserve submitted/running/blocked/unknown/failed/cancelled/verified-pending-owner/succeeded distinctions. Reconcile unknown timeout outcomes before retry. HTTP 200 and a job ID do not prove completion.
- Return source revision/as-of time, authoritative evidence IDs and content hashes where relevant. Keep artifacts in domain-owned storage with authorized retrieval, never inline secrets or an unnecessary duplicate vault.

### Acceptance gates and next build order

1. Complete the product-side scope/auth/source audit above and record exact deployed endpoint or local transport, schema, owner and dependencies. Unknown values stay pending.
2. Implement one bounded read-only vertical slice and gateway adapter/registration with contract tests; do not enable every existing route.
3. Prove cross-tenant and missing-tenant denial at actual handlers, forbidden role denial, case ownership, redaction, stale data marking and no indirect status transition/filing/payout through read tools.
4. Run actual gateway-to-product tests for wrong tenant/resource/scope, revoked credential, malformed schema, upstream timeout, secrets redaction and truthful receipts. Record command, revision, observed result and evidence. Then verify the real authorized consumer journey. Keep source-implemented, locally-tested and live-verified statuses separate.

No credentials, service configuration, permissions or application code were changed by this handoff. These queue items describe future work and do not grant approval to execute restricted actions.
