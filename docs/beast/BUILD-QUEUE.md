# MGR BEAST Build Queue

Updated: 2026-09-30

| ID | Priority | Task | Status | Dependency |
|---|---|---|---|---|
| BQ-001 | Critical | Scrub committed founder credential from current tree | IMPLEMENTED | — |
| BQ-002 | Critical | Align founder superuser role contract | IMPLEMENTED | — |
| BQ-003 | Critical | Replace weak public token RNG | IMPLEMENTED | — |
| BQ-004 | Critical | Authenticate/authorize case WebSocket rooms | IMPLEMENTED | — |
| BQ-005 | Critical | Repair Next Docker/proxy/backend health | IMPLEMENTED | — |
| BQ-006 | Critical | Remove fake Stripe/PayPal/ACH success | IMPLEMENTED | — |
| BQ-007 | Critical | Block obsolete Nickel money-movement adapter | IMPLEMENTED | RQ-001 |
| BQ-008 | Critical | Separate payment review approval from settlement | IMPLEMENTED | — |
| BQ-009 | Critical | Harden Stripe/OpenSign/PayPal webhook boundaries | IMPLEMENTED | — |
| BQ-010 | Critical | Remove fabricated skip-trace PII | IMPLEMENTED | — |
| BQ-011 | Critical | Remove fake legal-compliance audit fallback | IMPLEMENTED | — |
| BQ-012 | Critical | Remove simulated RON identity/KBA approvals | IMPLEMENTED | RQ-006 |
| BQ-013 | Critical | Remove fabricated EIN generation | IMPLEMENTED | — |
| BQ-014 | High | Remove fabricated blockchain verification ID | IMPLEMENTED | — |
| BQ-015 | High | Remove fake OpenSign signing URL flow | IMPLEMENTED | RQ-004 |
| BQ-016 | Critical | Add provider fail-closed regression tests | IMPLEMENTED | BQ-006..015 |
| BQ-017 | Critical | Run consolidated current-head BEAST CI | QUEUED | Repair batch |
| BQ-018 | Critical | Rebuild Nickel adapter against current API | BLOCKED | RQ-001 SPECIFIED |
| BQ-019 | Critical | Rebuild OpenSign adapter + sandbox E2E | BLOCKED | RQ-004 SPECIFIED |
| BQ-020 | Critical | Canonical payment/ledger idempotency state machine | QUEUED | RQ-010 |
| BQ-021 | Critical | Primary-source provenance for every enforced legal rule | QUEUED | RQ-007 |
| BQ-022 | High | Remove production mock fallbacks in frontend | QUEUED | APIs/providers |
| BQ-023 | High | Replace random HR metrics | QUEUED | Data sources |
| BQ-024 | High | Separate synthetic fraud training from production evidence | QUEUED | Research/eval |
| BQ-025 | High | Add bot action authorization/idempotency | QUEUED | RQ-014 |
| BQ-026 | Critical | Rotate exposed founder credential | BLOCKED | Owner/account action |
| BQ-027 | Medium | Purge exposed credential from Git history | BLOCKED | Explicit destructive approval |
| BQ-028 | High | Build/test mobile app | QUEUED | RQ-015 |
| BQ-029 | High | Execute backup/restore drill | QUEUED | Test env |
