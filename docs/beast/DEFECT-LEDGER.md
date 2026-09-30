# MGR BEAST Defect Ledger

Updated: 2026-09-30

| ID | Severity | Proven defect | Repair | Status |
|---|---|---|---|---|
| D-001 | Critical | Founder denied by routes documented as founder-accessible | Central founder bypass | REPAIRED |
| D-002 | Critical | Public case token used Math.random | crypto randomBytes | REPAIRED |
| D-003 | Critical | Case WebSocket room join unauthenticated | Short-lived scoped tickets | REPAIRED |
| D-004 | Critical | Founder credential tracked in scripts/tests/docs | Env-driven scripts + redaction | PARTIAL: history remains |
| D-005 | Critical | Trust workflow fabricated IRS EIN | Verified EIN required | REPAIRED |
| D-006 | Critical | RON identity/KBA randomly passed | Fail closed | REPAIRED |
| D-007 | Critical | Blockchain proof returned fake tx ID | No fake receipt | REPAIRED |
| D-008 | Critical | Stripe missing config simulated success | Fail closed | REPAIRED |
| D-009 | Critical | PayPal/ACH failures could fall through to fake success | Fail closed | REPAIRED |
| D-010 | Critical | Non-Stripe refund could be marked refunded without provider action | No mutation without provider | REPAIRED |
| D-011 | Critical | Internal payment approval set status succeeded | Approval metadata only | REPAIRED |
| D-012 | Critical | Nickel adapter stale/guessed and simulated transfers | Money movement blocked | BLOCKED-REPAIR |
| D-013 | High | Skip trace fabricated PII | Empty error/partial results | REPAIRED |
| D-014 | High | Paid skip-trace available to any authenticated user | ADMIN/FOUNDER gate | REPAIRED |
| D-015 | Critical | Legal audit returned fake compliance result | Throw unavailable | REPAIRED |
| D-016 | High | Legal-audit routes public | Auth + role gate | REPAIRED |
| D-017 | Critical | OpenSign returned fake signing URL/state | Adapter blocked | BLOCKED-REPAIR |
| D-018 | Critical | OpenSign webhook lacked HMAC verification | Raw body + HMAC | REPAIRED |
| D-019 | Critical | Stripe webhook allowed unsigned mode | Reject unsigned/unconfigured | REPAIRED |
| D-020 | Critical | PayPal webhook trusted unverified events | Reject/no state change | BLOCKED-REPAIR |
| D-021 | High | Tracerfy callback unauthenticated | Shared-secret callback gate | REPAIRED |
| D-022 | Critical | Docker health path mismatch | Health contract aligned | REPAIRED |
| D-023 | Critical | Nginx expected wrong frontend architecture | Next standalone/upstream | REPAIRED |
| D-024 | High | Earlier CI backend/Vite compile failed | Later fixes committed | REPAIRED-NOT-RETESTED |
