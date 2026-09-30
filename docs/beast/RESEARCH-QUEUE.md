# MGR BEAST Research Queue

Updated: 2026-09-30

Lifecycle: DISCOVERED → QUEUED → SOURCED → END_TO_END_READ → RESEARCHED → SPECIFIED.

| ID | Capability | Priority | Status | Architecture impact | Next action |
|---|---|---|---|---|---|
| RQ-001 | Current Nickel customers/payment methods/payment links/bill pay/webhooks | Critical | SOURCED | Money movement stays disabled until rebuilt | Full OpenAPI read + MGR adapter spec |
| RQ-002 | Stripe card/Financial Connections/ACH settlement/webhooks | Critical | QUEUED | Canonical live payment adapter | Current API/version + sandbox tests |
| RQ-003 | PayPal Orders/Capture + webhook verification | High | DISCOVERED | PayPal webhook remains blocked | Current verification/idempotency research |
| RQ-004 | Current OpenSign create/sign/webhook contract | Critical | SOURCED | Signature creation remains disabled | Full current API/source read + spec |
| RQ-005 | Tracerfy sync lookup/enhanced/queue/webhook | High | SOURCED | Can simplify single-person flow | Read schemas/errors/rate limits |
| RQ-006 | RON identity proofing + KBA requirements/providers | Critical | QUEUED | RON completion remains blocked | Jurisdiction/provider research |
| RQ-007 | 50-state surplus statutes/deadlines/fee caps/assignment limits | Critical | DISCOVERED | Static rules need primary-source authority | Build per-state source packets |
| RQ-008 | E-filing/court submission providers | High | DISCOVERED | Defines automation boundary | Provider/jurisdiction research |
| RQ-009 | Signed-document certificate/retention | High | QUEUED | Vault provenance/integrity | Define certificate evidence contract |
| RQ-010 | Payment ledger/idempotency/reconciliation | Critical | QUEUED | Prevent partial/double posting | Specify canonical state machine |
| RQ-011 | Secret-history remediation | Critical | QUEUED | Current-tree cleanup not enough | Rotate; history rewrite only with approval |
| RQ-012 | WebSocket replay/cross-case threat model | High | QUEUED | Collaboration verification | Adversarial matrix |
| RQ-013 | Scraper TOS/robots/rate/data-quality | High | DISCOVERED | Some sources may need API replacement | Source-by-source packet |
| RQ-014 | Worker-bot action authority | Critical | DISCOVERED | Autonomous side effects need limits | Map every external action |
| RQ-015 | Expo/mobile modernization | Medium | DISCOVERED | Aging stack risk | Current Expo upgrade research |
| RQ-016 | Dependency/CVE baseline | High | DISCOVERED | Release gate | Current audits in CI |
