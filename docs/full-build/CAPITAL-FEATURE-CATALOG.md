# Capital feature catalog and repair map

October 30, 2026. Current queue authority: [HANDOFF](../../HANDOFF.md). User procedures: [handbook](../CAPITAL-HANDBOOK.md). Detailed mechanically inspected routes/imports/source hashes: [audit map](CAPITAL-AUDIT-MAP.json).

**Coverage boundary:** every admitted code file below was parsed structurally, not manually semantically reviewed. A declared endpoint is not proof of correct authorization, saved state, provider action or production readiness. This is a full navigation inventory and current gap map, not a completed whole-source semantic audit.

| Capability | Implementation / screens | What is established | Exact remaining direction |
|---|---|---|---|
| Identity and company boundaries | AuthService, CaseDocumentAccess, CapitalCompanyHierarchy; auth/account/source-connections | Fresh actors and selected case/company routes have local evidence. Entire role/action matrix remains open. | Per-route tenant/actor/action checks, employee/parent/child negative tests; no global FOUNDER bypass for company founders. |
| Public source acquisition | CapitalSourceWarehouse, claimantResearch routes; source-warehouse | Actual Davidson/Shelby source storage and selected reopening proved previously. | Full Shelby visual corrections, current balances, commercial court permission and new edition adapters. |
| Individual recovery work | CapitalRecoveryPipeline; recovery-pipeline | 194 historical source work items in isolated database; notes/stage persistence previously proved. | Reviewed conversion into authorized customer engagement; durable outside-claim/disbursement reconciliation. |
| Claimant research / tracing | ClaimantResearchService, GovernmentSourceService, skipTrace, genealogy | Named public source research exists; current owner is not automatically claimant. | Historical title, probate/heirs, provenance and identity resolution; qualify paid sources only where they add necessary lawful data. |
| Jurisdiction coverage | RecoveryJurisdictionService; recovery-rules; legacy state tables | 153 state/type navigation entries are not 153 admitted procedures. | Official fee/deadline/process provenance by recovery type and county; retire unsourced alternate tables after consumer migration. |
| Cases and clients | cases, clients routes, CaseService; founder/employee/client case pages | Selected creation/scoping/doc/client HTTP and persistence checks in earlier receipts. | All transition permissions, documents UI, authorization receipts and real engagement workflow. |
| Documents / AI review | documents, documentGeneration, LegalAuditorService; LegalAuditorUI | AI mock compliance removed; authenticated bounded missing-provider failure proved this cycle. | Positive AI schema/adversarial provider response, retained review receipt; source-backed document requirements and authorized signature integration. |
| Signing / notary / trust | founderNotaryRoutes, employeeNotaryRoutes, trustRoutes | Code inventory; positive professional/provider/customer acceptance not proved. | Signer/session/identity/commission proof, immutable signed bytes, journal, approved ceremony, independent receipt verification. |
| Ledger / employee earnings | BankingService, PayoutPlanningService, EmployeeEarningsView; employee/payouts | Actual payable decision implemented and prior DB/optimized browser proof. | All writer reconciliation, historical duplicates, paid flags, child split basis/rounding and exception review interface. |
| Payment collection / settlement | PaymentService, payments, payouts, blockchain; founder/payments | Saved local records and negative truth boundaries proved; no actual transfer. | Provider callback signature, event replay, actual settlement, reconciliation and allocation-to-transfer receipts. |
| Owned email outbox | CapitalEmailOutbox; capital-email routes; founder/email-outbox | Queue/reopen and loopback SMTP acceptance proved previously. | External authenticated domain/delivery, bounce/unsubscribe, rate limits and operating cost/host acceptance. |
| Legacy inbox / hosting | EmailInboxService, emailHostingRoutes; inbox, email-hosting | Shared IMAP founder restriction and unsaved-draft failure proved this cycle. | Individual mailbox credentials, tenant scope, persistent drafts, attachments, flags, safe sends and content rendering review. |
| Phone / voice / outreach | voice, phone, sms-templates, outreachBot | Selected honest unavailable paths; positive communications proof incomplete. | Actual consent/contact workflow, callback receipts, provider failures, recording rules and delivery reconciliation. |
| Workers / orchestration / AI | WorkerBotEngine, WorkerBotSpawner, cron/scheduler; worker-bots and orchestration | Four report-route dispatches repaired; downstream computation stubbed in route tests. | Real worker tasks/receipts, exact provider actions, safe retries/cancellation, concurrency and billing checks. Do not enable all crons. |
| Metrics / insights / forecasting | OpsMetricsService, opsInsights, analytics; dashboard, insights | Actual saved focus item/current global actor/HTTP tests. Fake zero-metric insights screen removed. | All underlying revenue/forecast formulas, dismissed/read state, receipt-backed attribution and consistent metrics contracts. |
| Internal communications | comms, messages, notifications; CommsChamber, CollaborationPanel | Selected tenant/team/message HTTP boundaries proved previously. | Protected-room admission UI, durable read cursors, authenticated WebSocket collaboration and complete client/staff matrix. |
| Training / HR / administration | training, hr, employees, office-table; admin/users, founder/config | Selected module/progress and employee display fixes; unsupported admin/config routes still present. | Scoped administration APIs, invitations, child-company management APIs/UI, real worker actions and role matrix. |
| Storage / retention / backups | storage/StorageRouter, DocumentRetentionService, BackupService; storage, retention | Inventory and selected old evidence; full restore/retention not qualified. | Tenant storage paths, encryption/migration, signed reads, legal holds, backup restore drill and object deletion receipts. |
| Marketplace / NFT / auction / fraud | marketplace, nft, auctions, fraud routes/services | NFT route intentionally unavailable until chain proof; no ownership transferred. | Defer economic/legal rights integrations until recovery core is qualified; no fabricated wallets/scores/claims. |
| Deployment / dependencies / secret recovery | Deploy.md, manifests, workflow/container config | Prior dependency evidence and clean frontend baseline; current build receipts separate. | Credential rotation, fresh dependency audits, environment-specific deployment, database backup/restore and owner production acceptance. |
| Tevin tool boundary | Capital API edge; future MGR-API-MCP integration | Architecture requirement only; live Tevin/Capital business actions not claimed. | Actor+tenant+action-bound tool contracts, delegated owner authority, review UI, idempotent action receipts, expiry and cross-service reconciliation. |

## Every mounted router

| Prefix | Source | Explicit method handlers | Qualification |
|---|---|---|---|
| `/api/activity` | `backend/src/routes/activityRoutes.ts` | 7 | See capability row; full semantic/action review remains separate |
| `/api/ai` | `backend/src/routes/aiRoutes.ts` | 15 | See capability row; full semantic/action review remains separate |
| `/api/ai-bots` | `backend/src/routes/aiBotsRoutes.ts` | 6 | See capability row; full semantic/action review remains separate |
| `/api/ai-oracle` | `backend/src/routes/autonomousAiRoutes.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/alerts-chamber` | `backend/src/routes/alertsChamberRoutes.ts` | 9 | See capability row; full semantic/action review remains separate |
| `/api/analytics` | `backend/src/routes/analytics.ts` | 3 | See capability row; full semantic/action review remains separate |
| `/api/auctions` | `backend/src/routes/auctionRoutes.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/auth` | `backend/src/routes/auth.ts` | 11 | See capability row; full semantic/action review remains separate |
| `/api/blockchain` | `backend/src/routes/blockchainRoutes.ts` | 5 | See capability row; full semantic/action review remains separate |
| `/api/bot-orchestration` | `backend/src/routes/botOrchestrationRoutes.ts` | 33 | See capability row; full semantic/action review remains separate |
| `/api/bot-subscriptions` | `backend/src/routes/botSubscriptionRoutes.ts` | 8 | See capability row; full semantic/action review remains separate |
| `/api/capital-email` | `backend/src/routes/capitalEmail.ts` | 3 | See capability row; full semantic/action review remains separate |
| `/api/cases` | `backend/src/routes/cases.ts` | 16 | See capability row; full semantic/action review remains separate |
| `/api/child-companies` | `backend/src/routes/childCompanyRoutes.ts` | 16 | See capability row; full semantic/action review remains separate |
| `/api/clients` | `backend/src/routes/clients.ts` | 15 | See capability row; full semantic/action review remains separate |
| `/api/comms` | `backend/src/routes/comms.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/compliance` | `backend/src/routes/complianceRoutes.ts` | 14 | See capability row; full semantic/action review remains separate |
| `/api/deadlines` | `backend/src/routes/deadlines.ts` | 13 | See capability row; full semantic/action review remains separate |
| `/api/documents` | `backend/src/routes/documents.ts` | 15 | See capability row; full semantic/action review remains separate |
| `/api/documents` | `backend/src/routes/documentGeneration.ts` | 3 | See capability row; full semantic/action review remains separate |
| `/api/email` | `backend/src/routes/emailInboxRoutes.ts` | 26 | See capability row; full semantic/action review remains separate |
| `/api/email-hosting` | `backend/src/routes/emailHostingRoutes.ts` | 11 | See capability row; full semantic/action review remains separate |
| `/api/emails` | `backend/src/routes/emailRoutes.ts` | 5 | See capability row; full semantic/action review remains separate |
| `/api/employee-notary` | `backend/src/routes/employeeNotaryRoutes.ts` | 25 | See capability row; full semantic/action review remains separate |
| `/api/employees` | `backend/src/routes/employees.ts` | 17 | See capability row; full semantic/action review remains separate |
| `/api/feedback` | `backend/src/routes/feedbackRoutes.ts` | 7 | See capability row; full semantic/action review remains separate |
| `/api/founder-notary` | `backend/src/routes/founderNotaryRoutes.ts` | 12 | See capability row; full semantic/action review remains separate |
| `/api/fraud` | `backend/src/routes/fraudRoutes.ts` | 3 | See capability row; full semantic/action review remains separate |
| `/api/genealogy` | `backend/src/routes/genealogyRoutes.ts` | 9 | See capability row; full semantic/action review remains separate |
| `/api/hr` | `backend/src/routes/hrRoutes.ts` | 13 | See capability row; full semantic/action review remains separate |
| `/api/hr/training` | `backend/src/routes/hrTrainingRoutes.ts` | 21 | See capability row; full semantic/action review remains separate |
| `/api/inbox` | `backend/src/routes/emailInboxRoutes.ts` | 26 | See capability row; full semantic/action review remains separate |
| `/api/ingestion` | `backend/src/routes/ingestion.ts` | 41 | See capability row; full semantic/action review remains separate |
| `/api/lead-generation` | `backend/src/routes/leadGenerationRoutes.ts` | 31 | See capability row; full semantic/action review remains separate |
| `/api/legal` | `backend/src/routes/legal.ts` | 14 | See capability row; full semantic/action review remains separate |
| `/api/legal-audit` | `backend/src/routes/legalRoutes.ts` | 3 | See capability row; full semantic/action review remains separate |
| `/api/marketplace` | `backend/src/routes/marketplaceRoutes.ts` | 8 | See capability row; full semantic/action review remains separate |
| `/api/messages` | `backend/src/routes/messagesRoutes.ts` | 4 | See capability row; full semantic/action review remains separate |
| `/api/mobile` | `backend/src/routes/mobileRoutes.ts` | 7 | See capability row; full semantic/action review remains separate |
| `/api/nft` | `backend/src/routes/nftRoutes.ts` | 0 | See capability row; full semantic/action review remains separate |
| `/api/notifications` | `backend/src/routes/notificationRoutes.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/office-table` | `backend/src/routes/officeTableRoutes.ts` | 19 | See capability row; full semantic/action review remains separate |
| `/api/ops/insights` | `backend/src/routes/opsInsights.ts` | 1 | See capability row; full semantic/action review remains separate |
| `/api/ops/metrics` | `backend/src/routes/opsMetrics.ts` | 17 | See capability row; full semantic/action review remains separate |
| `/api/ops/watch` | `backend/src/routes/opsWatch.ts` | 33 | See capability row; full semantic/action review remains separate |
| `/api/oracle` | `backend/src/routes/oracleRoutes.ts` | 5 | See capability row; full semantic/action review remains separate |
| `/api/payments` | `backend/src/routes/payments.ts` | 18 | See capability row; full semantic/action review remains separate |
| `/api/payouts` | `backend/src/routes/payouts.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/phone` | `backend/src/routes/phoneRoutes.ts` | 6 | See capability row; full semantic/action review remains separate |
| `/api/recovery-requirements` | `backend/src/routes/surplusRequirementsRoutes.ts` | 8 | See capability row; full semantic/action review remains separate |
| `/api/research` | `backend/src/routes/claimantResearch.ts` | 15 | See capability row; full semantic/action review remains separate |
| `/api/retention` | `backend/src/routes/retentionRoutes.ts` | 9 | See capability row; full semantic/action review remains separate |
| `/api/scraper-v2` | `backend/src/routes/scraperV2Routes.ts` | 15 | See capability row; full semantic/action review remains separate |
| `/api/search` | `backend/src/routes/searchRoutes.ts` | 4 | See capability row; full semantic/action review remains separate |
| `/api/settings` | `backend/src/routes/settings.ts` | 6 | See capability row; full semantic/action review remains separate |
| `/api/settings/master` | `backend/src/routes/masterSettingsRoutes.ts` | 5 | See capability row; full semantic/action review remains separate |
| `/api/skip-trace` | `backend/src/routes/skipTrace.ts` | 2 | See capability row; full semantic/action review remains separate |
| `/api/sms-templates` | `backend/src/routes/smsTemplateRoutes.ts` | 11 | See capability row; full semantic/action review remains separate |
| `/api/source-connections` | `backend/src/routes/sourceConnections.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/storage` | `backend/src/routes/storageRoutes.ts` | 12 | See capability row; full semantic/action review remains separate |
| `/api/tips` | `backend/src/routes/tippingRoutes.ts` | 5 | See capability row; full semantic/action review remains separate |
| `/api/training` | `backend/src/routes/training.ts` | 8 | See capability row; full semantic/action review remains separate |
| `/api/trusts` | `backend/src/routes/trustRoutes.ts` | 10 | See capability row; full semantic/action review remains separate |
| `/api/voice` | `backend/src/routes/voiceRoutes.ts` | 4 | See capability row; full semantic/action review remains separate |
| `/api/webhooks` | `backend/src/routes/webhookRoutes.ts` | 4 | See capability row; full semantic/action review remains separate |
| `/api/worker-bots` | `backend/src/routes/workerBotRoutes.ts` | 26 | See capability row; full semantic/action review remains separate |

## Every application page

| URL pattern | Source |
|---|---|
| `/` | `frontend/app/page.tsx` |
| `/account/identity` | `frontend/app/account/identity/page.tsx` |
| `/admin/cases` | `frontend/app/admin/cases/page.tsx` |
| `/admin/cases/:id` | `frontend/app/admin/cases/[id]/page.tsx` |
| `/admin/comms` | `frontend/app/admin/comms/page.tsx` |
| `/admin/compliance` | `frontend/app/admin/compliance/page.tsx` |
| `/admin/dashboard` | `frontend/app/admin/dashboard/page.tsx` |
| `/admin/hr` | `frontend/app/admin/hr/page.tsx` |
| `/admin/insights` | `frontend/app/admin/insights/page.tsx` |
| `/admin/payouts` | `frontend/app/admin/payouts/page.tsx` |
| `/admin/training` | `frontend/app/admin/training/page.tsx` |
| `/admin/users` | `frontend/app/admin/users/page.tsx` |
| `/auth/forgot-password` | `frontend/app/auth/forgot-password/page.tsx` |
| `/auth/login` | `frontend/app/auth/login/page.tsx` |
| `/auth/register` | `frontend/app/auth/register/page.tsx` |
| `/auth/reset-password` | `frontend/app/auth/reset-password/page.tsx` |
| `/client/cases` | `frontend/app/client/cases/page.tsx` |
| `/client/cases/:id` | `frontend/app/client/cases/[id]/page.tsx` |
| `/client/dashboard` | `frontend/app/client/dashboard/page.tsx` |
| `/client/documents` | `frontend/app/client/documents/page.tsx` |
| `/client/inbox` | `frontend/app/client/inbox/page.tsx` |
| `/client/messages` | `frontend/app/client/messages/page.tsx` |
| `/client/notifications` | `frontend/app/client/notifications/page.tsx` |
| `/client/portal` | `frontend/app/client/portal/page.tsx` |
| `/employee/alerts-chamber` | `frontend/app/employee/alerts-chamber/page.tsx` |
| `/employee/bots` | `frontend/app/employee/bots/page.tsx` |
| `/employee/cases` | `frontend/app/employee/cases/page.tsx` |
| `/employee/cases/:id` | `frontend/app/employee/cases/[id]/page.tsx` |
| `/employee/child-company` | `frontend/app/employee/child-company/page.tsx` |
| `/employee/child-company/cases` | `frontend/app/employee/child-company/cases/page.tsx` |
| `/employee/child-company/employees` | `frontend/app/employee/child-company/employees/page.tsx` |
| `/employee/child-company/payouts` | `frontend/app/employee/child-company/payouts/page.tsx` |
| `/employee/child-company/settings` | `frontend/app/employee/child-company/settings/page.tsx` |
| `/employee/child-company/setup` | `frontend/app/employee/child-company/setup/page.tsx` |
| `/employee/comms` | `frontend/app/employee/comms/page.tsx` |
| `/employee/compliance` | `frontend/app/employee/compliance/page.tsx` |
| `/employee/dashboard` | `frontend/app/employee/dashboard/page.tsx` |
| `/employee/email` | `frontend/app/employee/email/page.tsx` |
| `/employee/email/setup` | `frontend/app/employee/email/setup/page.tsx` |
| `/employee/inbox` | `frontend/app/employee/inbox/page.tsx` |
| `/employee/leaderboard` | `frontend/app/employee/leaderboard/page.tsx` |
| `/employee/notary` | `frontend/app/employee/notary/page.tsx` |
| `/employee/payouts` | `frontend/app/employee/payouts/page.tsx` |
| `/employee/training` | `frontend/app/employee/training/page.tsx` |
| `/employee/training/:id` | `frontend/app/employee/training/[id]/page.tsx` |
| `/employee/trusts` | `frontend/app/employee/trusts/page.tsx` |
| `/founder/ai-bots` | `frontend/app/founder/ai-bots/page.tsx` |
| `/founder/alerts-chamber` | `frontend/app/founder/alerts-chamber/page.tsx` |
| `/founder/analytics` | `frontend/app/founder/analytics/page.tsx` |
| `/founder/auctions` | `frontend/app/founder/auctions/page.tsx` |
| `/founder/bots` | `frontend/app/founder/bots/page.tsx` |
| `/founder/cases` | `frontend/app/founder/cases/page.tsx` |
| `/founder/cases/:id` | `frontend/app/founder/cases/[id]/page.tsx` |
| `/founder/cases/new` | `frontend/app/founder/cases/new/page.tsx` |
| `/founder/child-companies` | `frontend/app/founder/child-companies/page.tsx` |
| `/founder/command-center` | `frontend/app/founder/command-center/page.tsx` |
| `/founder/comms` | `frontend/app/founder/comms/page.tsx` |
| `/founder/compliance` | `frontend/app/founder/compliance/page.tsx` |
| `/founder/config` | `frontend/app/founder/config/page.tsx` |
| `/founder/dashboard` | `frontend/app/founder/dashboard/page.tsx` |
| `/founder/deadlines` | `frontend/app/founder/deadlines/page.tsx` |
| `/founder/documents/assignment` | `frontend/app/founder/documents/assignment/page.tsx` |
| `/founder/email-hosting` | `frontend/app/founder/email-hosting/page.tsx` |
| `/founder/email-outbox` | `frontend/app/founder/email-outbox/page.tsx` |
| `/founder/emails` | `frontend/app/founder/emails/page.tsx` |
| `/founder/genealogy` | `frontend/app/founder/genealogy/page.tsx` |
| `/founder/hr` | `frontend/app/founder/hr/page.tsx` |
| `/founder/inbox` | `frontend/app/founder/inbox/page.tsx` |
| `/founder/inbox/compose` | `frontend/app/founder/inbox/compose/page.tsx` |
| `/founder/ingestion` | `frontend/app/founder/ingestion/page.tsx` |
| `/founder/ingestion/autopilot` | `frontend/app/founder/ingestion/autopilot/page.tsx` |
| `/founder/ingestion/sources` | `frontend/app/founder/ingestion/sources/page.tsx` |
| `/founder/insights` | `frontend/app/founder/insights/page.tsx` |
| `/founder/leaderboard` | `frontend/app/founder/leaderboard/page.tsx` |
| `/founder/ledger` | `frontend/app/founder/ledger/page.tsx` |
| `/founder/marketplace` | `frontend/app/founder/marketplace/page.tsx` |
| `/founder/nft` | `frontend/app/founder/nft/page.tsx` |
| `/founder/notary` | `frontend/app/founder/notary/page.tsx` |
| `/founder/office-table` | `frontend/app/founder/office-table/page.tsx` |
| `/founder/ops` | `frontend/app/founder/ops/page.tsx` |
| `/founder/ops/dashboard` | `frontend/app/founder/ops/dashboard/page.tsx` |
| `/founder/payments` | `frontend/app/founder/payments/page.tsx` |
| `/founder/payouts` | `frontend/app/founder/payouts/page.tsx` |
| `/founder/phone-bot` | `frontend/app/founder/phone-bot/page.tsx` |
| `/founder/pipeline` | `frontend/app/founder/pipeline/page.tsx` |
| `/founder/recovery-pipeline` | `frontend/app/founder/recovery-pipeline/page.tsx` |
| `/founder/recovery-rules` | `frontend/app/founder/recovery-rules/page.tsx` |
| `/founder/retention` | `frontend/app/founder/retention/page.tsx` |
| `/founder/skip-trace` | `frontend/app/founder/skip-trace/page.tsx` |
| `/founder/source-warehouse` | `frontend/app/founder/source-warehouse/page.tsx` |
| `/founder/storage` | `frontend/app/founder/storage/page.tsx` |
| `/founder/training` | `frontend/app/founder/training/page.tsx` |
| `/founder/trusts` | `frontend/app/founder/trusts/page.tsx` |
| `/founder/users` | `frontend/app/founder/users/page.tsx` |
| `/founder/vr-simulation` | `frontend/app/founder/vr-simulation/page.tsx` |
| `/founder/worker-bots` | `frontend/app/founder/worker-bots/page.tsx` |
| `/notifications` | `frontend/app/notifications/page.tsx` |
| `/privacy` | `frontend/app/privacy/page.tsx` |
| `/settings` | `frontend/app/settings/page.tsx` |
| `/sign-portal` | `frontend/app/sign-portal/page.tsx` |
| `/source-connections` | `frontend/app/source-connections/page.tsx` |
| `/terms` | `frontend/app/terms/page.tsx` |

## Frontend contract candidates needing manual resolution

These are structural candidates, not an assertion that all fail: template URLs, proxies, wildcard middleware and deliberately unavailable routers require separate inspection. Matched method/path declarations also do not certify response shape or permissions.

| Source line | Method / requested path | Structural result |
|---|---|
| `frontend/app/account/identity/page.tsx:12` | PUT `(computed)` | DYNAMIC_REVIEW |
| `frontend/app/account/identity/page.tsx:15` | GET `(computed)` | DYNAMIC_REVIEW |
| `frontend/app/admin/cases/[id]/page.tsx:75` | GET `/cases/${*}` | TEMPLATE_REVIEW |
| `frontend/app/admin/cases/[id]/page.tsx:83` | GET `/cases/${*}/assignees` | TEMPLATE_REVIEW |
| `frontend/app/admin/cases/[id]/page.tsx:90` | POST `/cases/${*}/status` | TEMPLATE_REVIEW |
| `frontend/app/admin/cases/[id]/page.tsx:105` | PATCH `/cases/${*}/assign` | TEMPLATE_REVIEW |
| `frontend/app/admin/cases/[id]/page.tsx:119` | GET `/documents/${*}/download` | TEMPLATE_REVIEW |
| `frontend/app/admin/hr/page.tsx:146` | POST `/hr/training/remind/${*}` | TEMPLATE_REVIEW |
| `frontend/app/admin/payouts/page.tsx:118` | POST `/payouts/${*}/complete` | TEMPLATE_REVIEW |
| `frontend/app/admin/training/page.tsx:75` | GET `/training/admin` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/admin/training/page.tsx:90` | POST `/training` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/admin/training/page.tsx:106` | PATCH `/training/${*}` | TEMPLATE_REVIEW |
| `frontend/app/admin/training/page.tsx:121` | DELETE `/training/${*}` | TEMPLATE_REVIEW |
| `frontend/app/admin/users/page.tsx:84` | GET `/admin/users` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/admin/users/page.tsx:88` | POST `/admin/users` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/admin/users/page.tsx:100` | PATCH `/admin/users/${*}` | TEMPLATE_REVIEW |
| `frontend/app/auth/forgot-password/page.tsx:49` | POST `${*}/api/auth/request-password-reset` | TEMPLATE_REVIEW |
| `frontend/app/auth/register/page.tsx:75` | POST `${*}/api/auth/register` | TEMPLATE_REVIEW |
| `frontend/app/auth/reset-password/page.tsx:71` | POST `${*}/api/auth/reset-password` | TEMPLATE_REVIEW |
| `frontend/app/client/cases/[id]/page.tsx:202` | GET `/cases/my/${*}` | TEMPLATE_REVIEW |
| `frontend/app/client/documents/page.tsx:87` | GET `/documents/${*}/download` | TEMPLATE_REVIEW |
| `frontend/app/client/messages/page.tsx:98` | POST `/messages/${*}/read` | TEMPLATE_REVIEW |
| `frontend/app/employee/cases/[id]/page.tsx:59` | GET `/cases/my/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/child-company/cases/page.tsx:94` | GET `/child-companies/mine/cases?${*}` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:118` | GET `/child-companies/mine/employees` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:127` | GET `/child-companies/mine/invitations` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:135` | POST `/child-companies/mine/invite` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:153` | DELETE `/child-companies/mine/employees/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:170` | DELETE `/child-companies/mine/invitations/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/child-company/employees/page.tsx:187` | POST `/child-companies/mine/invitations/${*}/resend` | TEMPLATE_REVIEW |
| `frontend/app/employee/child-company/page.tsx:46` | GET `/child-companies/mine` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/employee/child-company/payouts/page.tsx:105` | GET `/child-companies/mine/financials?${*}` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/payouts/page.tsx:187` | POST `/child-companies/mine/request-payout` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/settings/page.tsx:90` | GET `/child-companies/mine` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/employee/child-company/settings/page.tsx:137` | PATCH `/child-companies/mine` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/employee/child-company/settings/page.tsx:153` | POST `/child-companies/mine/upgrade` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/settings/page.tsx:169` | POST `/child-companies/mine/cancel` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/child-company/settings/page.tsx:186` | DELETE `/child-companies/mine` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/employee/dashboard/page.tsx:25` | GET `/cases/my-stats` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/employee/email/page.tsx:63` | POST `/email-hosting/accounts/${*}/reset-password` | TEMPLATE_REVIEW |
| `frontend/app/employee/email/page.tsx:82` | POST `/email-hosting/accounts/${*}/request-deletion` | TEMPLATE_REVIEW |
| `frontend/app/employee/email/page.tsx:98` | POST `/email-hosting/accounts/${*}/cancel-deletion` | TEMPLATE_REVIEW |
| `frontend/app/employee/inbox/page.tsx:130` | GET `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/inbox/page.tsx:139` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/inbox/page.tsx:151` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/inbox/page.tsx:162` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/inbox/page.tsx:179` | DELETE `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/training/[id]/page.tsx:53` | GET `/training/${*}` | TEMPLATE_REVIEW |
| `frontend/app/employee/training/[id]/page.tsx:61` | POST `/training/${*}/quiz` | TEMPLATE_REVIEW |
| `frontend/app/employee/training/[id]/page.tsx:89` | POST `/training/${*}/quiz` | TEMPLATE_REVIEW |
| `frontend/app/employee/trusts/page.tsx:138` | POST `/trusts/${*}/pay-setup` | TEMPLATE_REVIEW |
| `frontend/app/employee/trusts/page.tsx:154` | POST `/trusts/${*}/schedule-notarization` | TEMPLATE_REVIEW |
| `frontend/app/founder/ai-bots/page.tsx:68` | POST `/ai-bots/${*}/chat` | TEMPLATE_REVIEW |
| `frontend/app/founder/auctions/page.tsx:127` | POST `/auctions/${*}/bid` | TEMPLATE_REVIEW |
| `frontend/app/founder/auctions/page.tsx:148` | POST `/auctions/${*}/buy-fractions` | TEMPLATE_REVIEW |
| `frontend/app/founder/bots/page.tsx:57` | PUT `/bot-subscriptions/${*}/toggle` | TEMPLATE_REVIEW |
| `frontend/app/founder/child-companies/page.tsx:92` | GET `/child-companies/stats` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/founder/config/page.tsx:84` | GET `/settings/founder-config` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/config/page.tsx:92` | PATCH `/settings/founder-config/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/deadlines/page.tsx:43` | GET `/api/deadlines` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/documents/assignment/page.tsx:113` | POST `/api/documents/assignment` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/email-outbox/page.tsx:16` | POST `/capital-email/jobs/${*}/dispatch` | TEMPLATE_REVIEW |
| `frontend/app/founder/emails/page.tsx:72` | POST `/emails/${*}/retry` | TEMPLATE_REVIEW |
| `frontend/app/founder/hr/page.tsx:221` | PATCH `/hr/employees/${*}/status` | TEMPLATE_REVIEW |
| `frontend/app/founder/hr/page.tsx:236` | PATCH `/hr/employees/${*}/tier` | TEMPLATE_REVIEW |
| `frontend/app/founder/hr/page.tsx:266` | POST `/hr/onboarding/${*}/approve` | TEMPLATE_REVIEW |
| `frontend/app/founder/hr/page.tsx:282` | POST `/hr/onboarding/${*}/reject` | TEMPLATE_REVIEW |
| `frontend/app/founder/hr/page.tsx:296` | POST `/hr/training/remind/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/compose/page.tsx:65` | GET `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/page.tsx:121` | GET `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/page.tsx:130` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/page.tsx:142` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/page.tsx:153` | PATCH `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/inbox/page.tsx:170` | DELETE `/inbox/emails/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/ingestion/sources/page.tsx:141` | PUT `/ingestion/sources/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/ingestion/sources/page.tsx:150` | DELETE `/ingestion/sources/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/ingestion/sources/page.tsx:157` | POST `/ingestion/sources/${*}/fetch-now` | TEMPLATE_REVIEW |
| `frontend/app/founder/nft/page.tsx:28` | GET `/api/nft/list` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/nft/page.tsx:42` | POST `/api/nft/mint` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/notary/page.tsx:218` | GET `/founder-notary/sessions` | NO_DECLARED_ROUTE_REVIEW |
| `frontend/app/founder/office-table/page.tsx:186` | POST `/office-table/violations/${*}/review` | TEMPLATE_REVIEW |
| `frontend/app/founder/office-table/page.tsx:209` | POST `/office-table/bans/${*}/review-appeal` | TEMPLATE_REVIEW |
| `frontend/app/founder/phone-bot/page.tsx:83` | GET `/api/phone/transcript/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/phone-bot/page.tsx:104` | POST `/api/phone/end/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/recovery-pipeline/page.tsx:21` | PATCH `/research/recovery-items/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/recovery-pipeline/page.tsx:28` | GET `/research/recovery-items/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/recovery-rules/page.tsx:11` | GET `/recovery-requirements/rules/${*}/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:21` | GET `/research/warehouse/${*}/records` | TEMPLATE_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:22` | POST `/research/warehouse/sources/tn-davidson-excess-register/capture` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:22` | POST `/research/warehouse/${*}/normalize` | TEMPLATE_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:23` | POST `/research/warehouse/sources/tn-shelby-sale-book-2202/archive-pdf` | DYNAMIC_ROUTE_MATCH_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:23` | POST `(computed)` | DYNAMIC_REVIEW |
| `frontend/app/founder/source-warehouse/page.tsx:24` | POST `/research/warehouse/records/${*}/davidson-owner` | TEMPLATE_REVIEW |
| `frontend/app/founder/storage/page.tsx:153` | POST `/storage/providers/${*}/toggle` | TEMPLATE_REVIEW |
| `frontend/app/founder/storage/page.tsx:165` | POST `/storage/providers/${*}/test` | TEMPLATE_REVIEW |
| `frontend/app/founder/storage/page.tsx:181` | DELETE `/storage/providers/${*}` | TEMPLATE_REVIEW |
| `frontend/app/founder/trusts/page.tsx:126` | POST `/trusts/${*}/activate` | TEMPLATE_REVIEW |
| `frontend/app/notifications/page.tsx:31` | PATCH `/notifications/${*}/read` | TEMPLATE_REVIEW |
| `frontend/app/settings/page.tsx:60` | GET `${*}/api/auth/me` | TEMPLATE_REVIEW |
| `frontend/app/settings/page.tsx:85` | PATCH `${*}/api/auth/me` | TEMPLATE_REVIEW |
| `frontend/app/sign-portal/page.tsx:60` | GET `${*}/api/clients/portal/${*}` | TEMPLATE_REVIEW |
| `frontend/app/sign-portal/page.tsx:135` | POST `${*}/api/clients/portal/${*}/sign/${*}` | TEMPLATE_REVIEW |
| `frontend/app/sign-portal/page.tsx:160` | POST `${*}/api/clients/portal/${*}/contact` | TEMPLATE_REVIEW |
| `frontend/app/source-connections/page.tsx:9` | GET `(computed)` | DYNAMIC_REVIEW |
| `frontend/app/source-connections/page.tsx:12` | POST `(computed)` | DYNAMIC_REVIEW |
| `frontend/components/AiAgentButton.tsx:144` | POST `(computed)` | DYNAMIC_REVIEW |
| `frontend/components/AiRecommendationsCard.tsx:68` | GET `/ai/recommendations/case/${*}` | TEMPLATE_REVIEW |
| `frontend/components/CaseEditorRealTime.tsx:125` | PATCH `/api/cases/${*}` | TEMPLATE_REVIEW |
| `frontend/components/ESignaturePad.tsx:56` | GET `(computed)` | DYNAMIC_REVIEW |
| `frontend/components/ESignaturePad.tsx:64` | GET `(computed)` | DYNAMIC_REVIEW |
| `frontend/components/PayoutButton.tsx:69` | POST `/blockchain/payout/${*}` | TEMPLATE_REVIEW |
| `frontend/components/SendPortalLink.tsx:54` | POST `/clients/portal-link/${*}` | TEMPLATE_REVIEW |
| `frontend/components/SendPortalLink.tsx:99` | PATCH `/clients/portal-settings/${*}` | TEMPLATE_REVIEW |
| `frontend/components/VoiceAiButton.tsx:111` | POST `${*}/api/voice/stt` | TEMPLATE_REVIEW |
| `frontend/components/VoiceAiButton.tsx:125` | POST `${*}/api/ai/agent` | TEMPLATE_REVIEW |
| `frontend/components/VoiceAiButton.tsx:146` | POST `${*}/api/voice/tts` | TEMPLATE_REVIEW |
| `frontend/components/ui/document-uploader.tsx:53` | POST `/documents/${*}/upload` | TEMPLATE_REVIEW |
| `frontend/hooks/useNotifications.ts:13` | PATCH `/notifications/${*}/read` | TEMPLATE_REVIEW |
| `frontend/lib/api.ts:107` | POST `${*}/auth/refresh` | TEMPLATE_REVIEW |
| `frontend/public/sw.js:25` | GET `(computed)` | DYNAMIC_REVIEW |
| `frontend/public/sw.js:27` | GET `(computed)` | DYNAMIC_REVIEW |

## Internal links with no page/static match

| Source line | Destination |
|---|---|
| `frontend/app/admin/comms/page.tsx:119` | `/admin/comms/${*}` |
| `frontend/app/employee/child-company/cases/page.tsx:167` | `/employee/child-company/cases/assign` |
| `frontend/app/employee/child-company/cases/page.tsx:453` | `/employee/child-company/cases/assign` |
| `frontend/app/employee/child-company/employees/page.tsx:465` | `/employee/child-company/employees/${*}` |
| `frontend/app/employee/inbox/page.tsx:601` | `/inbox/attachments/${*}` |
| `frontend/app/employee/notary/page.tsx:157` | `/employee/notary/apply` |
| `frontend/app/employee/notary/page.tsx:266` | `/employee/notary/sessions/start` |
| `frontend/app/employee/notary/page.tsx:272` | `/employee/notary/sessions` |
| `frontend/app/employee/notary/page.tsx:278` | `/employee/notary/available` |
| `frontend/app/employee/notary/page.tsx:432` | `/employee/notary/sessions` |
| `frontend/app/employee/notary/page.tsx:465` | `/employee/notary/sessions/${*}/start` |
| `frontend/app/employee/notary/page.tsx:479` | `/employee/notary/available` |
| `frontend/app/founder/inbox/page.tsx:585` | `/inbox/attachments/${*}` |

## Reading and acceptance boundary

The generated map stores source hashes, import edges, environment variable **names only**, schema model/enum names, route declarations and candidate mismatches. It does not execute business actions. The maintained task ledger contains the review/repair status. Current manually followed paths include server wiring, current actor/case scope, worker routes, founder insights route/consumer, legacy inbox identity selection/shared IMAP creation/draft handler, document review service/route/UI, warehouse/pipeline/source connections/rules/earnings/outbox screens, and relevant manifests/instructions. Other source is not upgraded to semantically reviewed because it parsed. Older reading ledgers remain dated evidence; changed hashes need renewed review.

## Recommended build order

1. Finish historical financial reconciliation and all actor/company boundaries, then finish broken daily-use contracts.
2. Complete Memphis/Shelby source visual review and obtain an admitted current-balance/claim channel. Keep all public-source work separate from clients.
3. Qualify one real authorized client journey after there is a client: contact authority, correct party, sourced fee/deadline, signed agreement, county receipt, actual settlement.
4. Qualify durable workers around that established journey; expose bounded capabilities to Tevin with saved action receipts.
5. Add county/process adapters and handbook chapters from the same verified contract. Defer tokenization/marketplace and decorative forecasts until the core operation is accepted.
