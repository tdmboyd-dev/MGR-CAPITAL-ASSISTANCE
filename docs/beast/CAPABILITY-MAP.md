# MGR BEAST Capability Map — MGR Capital Assistance

Updated: 2026-09-30
Branch: `beast/full-repo-2026-09-30`
Audit base: `master@2c5d717d818041880a92e1f1f42a9cbe255549c4`
Last code checkpoint before this ledger: `174e1d0c07e47ec9985d4a0058262b28a9809f37`

## Product scope
MGR Capital Assistance is a multi-surface surplus-recovery operations platform with a Next.js web application, legacy Vite application, Expo mobile application, Express/Prisma backend, PostgreSQL, scheduled automation, document and communications systems, payment/provider integrations, research/legal tooling, bots, scraping/lead generation, storage routing, and production deployment configuration.

Code existence is not proof of correctness.

## Capability map

| ID | Capability | Main implementation | Current state | Highest proven lifecycle state | Main gap |
|---|---|---|---|---|---|
| CAP-001 | Authentication / refresh-token security | AuthService, auth middleware/routes | Real implementation; founder superuser contract repaired | IMPLEMENTED | Current-head CI not yet executed |
| CAP-002 | Role / tier authorization | auth middleware + roleGuard | Founder bypass aligned; resource-level review incomplete | IMPLEMENTED | Ownership/tenant sweep |
| CAP-003 | Case lifecycle | cases routes/services/schema | Large real implementation; portal token strengthened | IMPLEMENTED | E2E transition/permission verification |
| CAP-004 | Client public portal | cases/clients + frontend | Implemented | IMPLEMENTED | Revocation/expiry E2E |
| CAP-005 | Real-time collaboration | WebSocket server + editors | Case-scoped short-lived tickets added | IMPLEMENTED | Attack/replay/browser tests |
| CAP-006 | Generic payments | PaymentService | Fake provider success removed | IMPLEMENTED | Sandbox integration/reconciliation |
| CAP-007 | Nickel payments | NickelPaymentService | Historical adapter proven stale; money movement blocked | BLOCKED | Rebuild against current Nickel API |
| CAP-008 | Payment webhooks | payments routes | Stripe/OpenSign verification boundary hardened; PayPal blocked | IMPLEMENTED | Sandbox webhook verification |
| CAP-009 | Skip tracing | SkipTraceService + routes | Real Tracerfy flow exists; fake PII removed | IMPLEMENTED | Current API upgrade/webhook validation |
| CAP-010 | E-signature | DocumentSigningService | Stale OpenSign adapter blocked; fake signing URLs removed | BLOCKED | Current OpenSign API integration |
| CAP-011 | Legal document audit | LegalAuditorService | Advisory implementation; fake compliance fallback removed | IMPLEMENTED | Primary-source legal validation |
| CAP-012 | RON / identity / KBA | Founder/SelfHosted RON | Simulated approvals removed | BLOCKED | Authoritative ID/KBA provider |
| CAP-013 | Trust automation | TrustAutomationService | Fake EIN removed; verified EIN required | IMPLEMENTED | Legal authority/process validation |
| CAP-014 | Blockchain document proof | DocumentServiceAdvanced | Fake transaction IDs removed | BLOCKED | Real writer/receipt verification or removal |
| CAP-015 | Document vault/storage | document + storage services | Multi-provider implementation exists | IMPLEMENTED | Provider integrity tests |
| CAP-016 | Email / inbox / hosting | email services + Modoboa | Multiple paths exist | IMPLEMENTED | Current provider verification |
| CAP-017 | Lead generation | FOIA, auctions, search, news | Large implementation exists | IMPLEMENTED | Legal/TOS/data-quality verification |
| CAP-018 | Scraper V2 | Puppeteer scraper/scout | Implementation exists | IMPLEMENTED | Current-site compatibility/TOS |
| CAP-019 | Bots/autopilot | bots, workers, crons | Large orchestration surface | IMPLEMENTED | Action authority/idempotency |
| CAP-020 | Next frontend | frontend/ | Previous branch build passed; deployment wiring repaired | TESTED (older checkpoint) | Re-test current head; mock cleanup |
| CAP-021 | Legacy Vite app | app/ | Earlier compile errors repaired | IMPLEMENTED | Current-head build |
| CAP-022 | Mobile app | mobile-app/ | Expo app exists | IMPLEMENTED | Build/device/E2E |
| CAP-023 | Docker/Nginx | Dockerfiles, compose, nginx | Next container + proxy + health repaired | IMPLEMENTED | Runtime verification |
| CAP-024 | CI evidence | .github/workflows/beast-ci.yml | Batched backend/Next/Vite workflow exists | IMPLEMENTED | Current consolidated run |
| CAP-025 | Credential hygiene | scripts/docs/tests/config | Current known founder credential paths scrubbed | IMPLEMENTED | Rotation + optional history rewrite |
| CAP-026 | Backup / restore | BackupService/docs | Code/docs exist | IMPLEMENTED | Executed restore drill |
| CAP-027 | State/county legal rules | rules/schema/services | Extensive static rules exist | IMPLEMENTED | Provenance/current-law research |

## Cross-cutting rules locked by this audit
1. No provider credential or verified adapter means no fabricated success.
2. No legal/identity authority means no fabricated approval.
3. FOUNDER is superuser for ordinary role gates; true founder-only actions use founder-only guards.
4. Internal payment approval is not settlement.
5. External state-changing webhooks require authentication/signature verification.
6. Historical “99%/100%” claims are context, not evidence.
