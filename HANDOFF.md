# MGR Capital Assistance — authoritative human and AI handoff

Updated October 29, 2026. Repository: https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE . Branch: `repair/bottom-up-capital-2026-10-28`. Baseline for the latest continuation: `08d1c0461edef94a8f6023ce41b2f7e63d442e8d`. The final commit containing this handoff is the source checkpoint; inspect Git for its exact hash. Original `master` was preserved at `2c5d717d818041880a92e1f1f42a9cbe255549c4` when this cycle began; recheck before continuing.

This is the single current handoff. Its repair register, evidence and remaining-work register replace stacked old checkpoints and separate repair reports. Historical receipts remain under `docs/full-build/evidence/`; they are supporting proof, not alternative current instructions. WORK-STATE and old setup/TODO entrypoints point here. Do not resume TaxSlayer or Compliance Buddy: the owner explicitly stopped that work and its monitor was deleted.

## Latest repair cycle: case intake, workflow, portal and framework

October 29 Chicago / October 30 UTC. These are implemented repairs, with the proof boundaries stated below. This section supersedes older dependency and intake/status assertions in this handoff. The owner's additional Universal Beast build instructions were read and applied within the authorized Capital scope. TaxSlayer remains stopped. No other agent's MGR1 work was changed.

| Outcome | Implemented behavior | Current proof |
|---|---|---|
| Unique durable case numbering | Manual case creation, CaseService and the legacy ingestion creator share a PostgreSQL transaction allocator with advisory locking and a persistent high-water mark. Deleting the highest case does not reuse its number. | Actual concurrent creation and deletion/recreation checks. The reserved FounderConfig key must not be reset. |
| Safe case creation | Current actor/company/active client/assignment checks, strict calendar dates and integer cents; cryptographic portal tokens; a requested 0% fee stays zero. Case, deadlines and audit commit together. | Actual Express/JWT/PostgreSQL, including deliberately failed audit/deadline writes. Existing fee/deadline tables are retained, not freshly legally qualified. |
| Retry without duplicate creation | Optional Idempotency-Key is bound to actor and canonical input. Concurrent repeats return the same saved case; changed input conflicts. Intake holds the same request after unknown outcomes. | Actual concurrent/lost-response retry tests. Deleted cases and generic ingestion/property deduplication require a broader durable receipt design. |
| Atomic status changes | Case lock and current authority; state-machine checks; status/audit/client in-app notification in one transaction; repeated status is a no-op. Generic PAID remains blocked. | Actual concurrent transitions and forced audit/notification failures. Separate-process reopening proves saved state and notification read timestamp. |
| Atomic assignment and edits | Same-company active assignee; reassignment audit and employee notification commit together. Field edit and audit commit together. Former assignee loses case access. | Actual database rollback/current access tests; minimal case-scoped assignee options endpoint tested. |
| Working case intake UI | Added founder New Case form and real saved-case route. Active clients, optional real client creation, validated values, busy/error/unknown outcome handling and the returned case code. | Actual browser saved synthetic C-001049 with zero fee, opened saved detail, changed CONTACTED, reloaded after API restart; separate database process corroborated the case/audit/client inbox. |
| Case detail actions | Repaired wrong status/assignment endpoints and nonexistent employee-list endpoint; accessible state button, pending controls, error/retry, correct recorded-surplus value including zero. PAID is absent from manual choices. | Actual browser status/save/reload. Assignment API tested; full assignment browser and authenticated document download remain unverified. |
| Authenticated document download | Detail buttons fetch authorized bytes through the shared bearer client, then download them. They no longer open an unauthenticated raw URL. | Coded/build checked; existing vault acceptance is separate. No new positive browser document-download proof. |
| Voice intake | Extracted address can prefill the same validated intake. User chooses actual client/state/county and records verified surplus. Voice estimate cannot silently become available funds. | Integrated/type/build checks; real microphone/STT/TTS and voice extraction accuracy remain open. |
| Native notifications | Correct admitted Prisma enum and actual isRead/readAt fields; active recipient/company; sender metadata cannot override reserved fields; recipient-scoped mutation cannot change unrelated OPS records. Global fanout requires current global founder. | Actual API/database/current-account checks; in-app founder inbox/read/reload observed. No email/push delivery acceptance. |
| Notification UI | Authenticated refresh-client polling replaces token-in-URL streaming; account changes abort/clear old inbox; real paginated /notifications page, real read operations and errors. Old duplicate bell becomes a compatibility export. | Actual browser saved notification -> read -> reopened zero unread. HTTP tests prove another account cannot change its read state. Mobile and full account-switch browser matrix remain open. |
| Legacy client security | Client listing/detail/edit/create use current company and minimal fields; creation/edit audit transaction; token possession cannot change login email; inactive client/company denies portal access. Deleted/internal docs excluded. | Twelve actual client/portal checks. Full public-profile concurrency and remaining portal-settings writes still require review. |
| False document/signature success removed | URL-only legacy upload returns 409 without recording bytes; pasted signature returns unavailable; force-SIGNED blocked for protected documents. | Actual no-write assertions. Positive signing/upload journey through legacy portal remains to implement using vault/SignMe evidence. |
| Portal copying and renewal | Copy returns the real URL and current renewed expiry; renewal/audit atomic under case lock; token excluded from audit. Email/SMS actions return unavailable before any renewal or made-up sent record. | Actual cross-company, failure rollback, renewed-response and alternate-public-route tests. Real portal delivery remains unbuilt. |
| Expired-session login loop | Refresh failure clears both token locations and live auth store; refreshed token synchronizes the store. Sign-in failure no longer tries to refresh itself. Query cache clears on account/role changes. | Loop reproduced in browser, repaired, then stable login/intake/inbox/logout observed. Multi-tab/account-change-in-flight refresh windows remain open. |
| Supported frontend dependency migration | Next16.4.3, React19.3.1, Zod4.6.7, resolver6, Joyride3.2 and Framer Motion14.8; types/client-only boundaries/Next images/config/scripts migrated. Retains Webpack with --webpack. | Fresh npm audit: zero known vulnerabilities across frontend production and development dependencies. Supported build and TypeScript qualification recorded below; zero advisories is not production acceptance. |
| Real lint visibility | ESLint10 and Next16 flat configuration added; no rules disabled to manufacture success. | New intake/client-boundary/notifications/wrapper surfaces pass targeted lint. First whole-frontend run fails: 283 errors, 212 warnings. That dated snapshot predates the last detail/auth edits; run again after cleanup. |

### Current acceptance evidence

Supporting receipts live in `docs/full-build/evidence/2026-10-30-case-workflows/`; the narrative stays in this handoff.

- Case creation: **10/10** actual local acceptance checks.
- Case workflow/inbox/assignment/edit: **16/16** actual local checks.
- Client/legacy portal: **12/12** actual local checks.
- Separate-process reopening: **3/3** checks, fresh Node process reading PostgreSQL.
- Browser action corroboration: **3/3** saved database facts, plus the recorded browser observations and reopened-inbox screenshot. This is synthetic local runtime proof; no real claimant/provider/filing/settlement proof.
- Existing regression run: offline5, parsers6, native/source/voice27, payout/provider boundaries21, payment truth7 all passed; Jest **203 passed, 16 skipped**, eight suites passed.
- Frontend dependency audit **0 findings** including development; backend production audit **70 findings** (59 high,7 moderate,4 low,0 critical), still open.
- Whole source audit and whole business completion remain **UNASSESSED/unfinished**. The source ledger lists exact newly read files and partial routes; reading the inventory does not count as a semantic audit.

Final backend compilation and Next16 production build both passed; all93 static pages generated. The five new intake/inbox/client-boundary/wrapper surfaces passed targeted ESLint. Default Gitleaks8.30.0 found0 findings in65 changed payload files with0 added exceptions; private runtime values were excluded. Current build, secret scan and cleanup receipts are saved alongside these records. No production/customer data or schema was changed; only isolated synthetic lab records were used. Two exact synthetic browser founder accounts were disabled, and the owned test API/frontend/tab were closed. The isolated database remains available for later guarded tests.

## Founder assessment

Capital should be a documented surplus-recovery operation: identify actual available funds, reconstruct ownership and claims at the relevant date, locate the right person, obtain authorization, prepare a jurisdiction-appropriate packet, obtain an accepted filing receipt, and reconcile real recovery and distribution. The valuable product is a reliable case/evidence/operations system. A generic parcel-owner lookup, AI opinion, ledger allocation, signature image or generated PDF does not establish entitlement, accepted filing, notarization or payment.

The repository has substantial interfaces, services, bots and source configurations. Several past completion claims were contradicted by simulated outcomes and missing connections. Those claims are not current acceptance. Core native evidence and bounded authentication/document/storage repairs have actual local proof. Full operational, claimant, filing, provider and production acceptance remains open.

Build the MGR-owned acquisition, evidence, matching, workflow and search layers. Direct public acquisition and upstream licensing programs are real options; there is no demonstrated blanket inability to operate our own data business. Keep exact source/date/rights and distinguish public or licensed underlying facts from MGR-owned code and derived work. The full ownership investigation appears later in this same handoff.

## Previous repair cycle retained

| Area | Actual repair | Proof level and remaining work |
|---|---|---|
| Payout planning | New `PayoutPlanningService` locks the case, rechecks global founder authority, checks recorded funds receipt/amount, creates one balanced pending allocation and audit atomically, and rejects changed-plan reuse. Unassigned commission is retained in the fee remainder; company fee is not counted twice as a distribution. | Actual isolated PostgreSQL/JWT/HTTP acceptance. No transfer, settlement or actual funds receipt verified. Existing historical ledger entries require reconciliation. |
| False payout completion | `/payouts/process` prepares a plan without PAID/disbursed timestamps. Free-text `/complete` is unavailable. Generic case force-status cannot certify PAID. Payout bot's independent fake settlement path was removed. | Actual database and API checks; other financial writers still require systematic review. |
| Nickel | Removed simulated ACH processing, successful card fallback, made-up payment/invoice links, plaintext bank-authorizations/recipient writes and callback status setters. Public method contracts/historical queries remain; effects report unavailable even with a key. | Actual no-write checks for effect methods and callbacks. Real tokenization, provider contract, event authenticity, receipt binding, uncertain-outcome reconciliation and settlement remain to build. |
| Financial permissions/routes | Global payment/payout queries require the current active global founder. Employee own-payout routes retain their own boundary. Named metrics no longer collide with `/:paymentId`. | Actual anonymous/client/tenant-admin/global-founder HTTP checks. Full permission matrix across every other router remains open. |
| Payment/signature callbacks | Unqualified Nickel/Stripe/PayPal/OpenSign callback routes return 503 and do not acknowledge or mutate success. | Actual HTTP checks. Signed raw-body verification and provider/account/event/amount/currency binding remain unimplemented. This is a repaired failure boundary, not a live provider integration. |
| Signature truth | Missing provider cannot create a fake invitation/URL or database signature request. Unauthenticated service callback cannot mark completion. | Actual isolated database checks. Configured OpenSign positive workflow and MGR SignMe admission remain unverified. |
| Phone truth and authority | Removed simulated outgoing call receipts, unverified callbacks/speech processing and fake successful termination. Current global founder is required for unscoped logs. | Actual service/database/HTTP checks. Real authenticated call lifecycle, recipient permission, recording and MGR Voice integration remain open. |
| Remote notarization | Removed random face-match/KBA passes, fake video/recording success and unpersisted notarized-document/certificate/journal URLs. Unqualified actions are unavailable. | Actual rejection checks for six actions. This does not complete remote notarization. Real identity evidence, authorized notary, recording/storage, durable session and journal are still needed. Existing notary assets were preserved. |
| Offline privacy | One public-only service worker replaces private API/page caching and credential-bearing request replay. Activation deletes owned old caches and the legacy offline database. Legacy worker URL imports the one current implementation. Dashboard offline handler registers updates; queue submissions explicitly fail without storing credentials. | Five worker VM boundary checks. Browser migration/account-switch/blocked IndexedDB upgrade still needs real-browser qualification. Unrelated application caches are preserved. |
| Hook lifecycle | Service-worker update timer is cleared on unmount; late registration checks disposed state. | Coded/type/build checked; extended browser lifecycle remains open. |
| Source parsing | Tax CSV headers match whole aliases, so County Name/Owner Address cannot become owner/property accidentally. All three legacy parsers share strict money/calendar-date parsing. PDF requires explicit surplus evidence; ambiguous differing amounts no longer become the maximum amount. | Six executed parser checks. Full county formats, multiline CSV, PDF extraction/OCR, identity association and provenance remain open. Rejecting unsupported/ambiguous input is intentional. |
| Prefix cleanup | Automatic/forced deletion based only on seed-looking IDs was retired. A real user's newer data cannot be deleted merely because an ID starts with `case_` or another historical prefix. | Coded; no customer/seed records deleted. Exact-record reviewed cleanup/retention workflow remains to build. |
| Server startup | Importing the Express app no longer opens HTTP/WebSocket ports or initializes SMTP/scheduler. Removed the unauthenticated cross-case relay. | Existing Jest integration import now runs without opening those server ports. Authenticated durable Yjs collaboration remains to implement; editor UI is not connected. |
| Scheduler | Config read failure does not admit default jobs; per-job overlap is disabled; task failure propagates instead of manual execution returning success after caught failure. | Coded/build checked. Distributed leases, durable retry/outbox and shutdown/startup failure testing remain open. No scheduled business jobs were run. |
| Settings/rendering | Login redirect runs after browser hydration in an effect. Production prerender no longer throws `location is not defined`. | Full Next production build passed in the recorded run; full account-settings browser/API journey remains open. |
| Test setup | Separated Node's test runner from Jest discovery, preserved explicit guarded test DB/key configuration, and corrected the retired analytics endpoint's assertion to 404. The real forecast authentication check remains 401. | Existing suite: 203 passed, 16 skipped, 8 suites passed. Skipped/concept tests do not prove complete product workflows. |
| Dependencies | Applied compatible `npm audit fix --ignore-scripts` updates without force/downgrades. Lockfiles preserve exact installed dependency revisions. | Production dependency findings: backend 87 to 70, critical 3 to 0; frontend 13 to 6, critical remains 1. Remaining findings are open, not dismissed. |

## Earlier implemented work retained

- Authentication: current database principal/activity/tenant checks; explicit server signing secret; conditional one-winner refresh rotation and linked successors. Named proof sets: 13 controlled boundaries and 14 actual PostgreSQL/HTTP checks. Family replay, all multi-tab/lost-response windows and complete route coverage remain open.
- Local storage: path/key confinement, Windows junction/hard-link checks, URL encoding, safe usage errors and actual saved-byte lifecycle. Nine actual filesystem checks. Kernel/host races and broad resource limits remain outside that set.
- Case/document vault: current tenant/case/assignment/type/action access, financial/path disclosure limits, persisted upload/fallback/delete reconciliation. Twenty-six actual API/database/filesystem checks plus three separate-process reopen checks. Generated documents, scanning/encryption, provider migration/replication and every crash window remain open.
- Native claimant research: authorized source-attributed evidence in `Case.metadata.claimantResearch`, bounded 100 records/case; row locking, duplicate digest, audit and preserved metadata. Fourteen actual API/database checks and one separate-process reopening; 27 controlled native/source/parser/voice checks. Exact-match explanations are candidates, never identity/heir/entitlement/contact-consent proof.
- Native browser research page: real login, evidence save/reload, UTC date display, hydration handling and existing token-refresh client were observed against synthetic PostgreSQL records. Earlier screenshots/receipts remain historical local proof. Not a positive real claimant or comprehensive responsive qualification.
- Government acquisition: six admitted source catalog entries; bounded fixed-source probes; live Florida public parcel connector with target checking/hash/time/field limits. One real no-match query succeeded. Three of four public page probes fetched; zero records imported. Florida aggregate metadata returned 10,950,670 records and 68 source-code groups, including unknown code 0. No full bulk snapshot was acquired.
- Optional Tracerfy: no fabricated contact/heir/death/confidence; current optional paid endpoints are bounded and disabled by default. No paid trace was run. Unbound surname-match callback is disabled. AutoOutreach no longer overwrites account/login contact data with unverified candidates.
- VoiceService: no canned STT/AI fallback or invented confidence; timeouts and unavailable states. Positive speech integration remains open.
- PaymentService: no demo card/ACH/PayPal success; positive integer cents; manual checks pending; unknown configured-provider outcome must reconcile before retry; no fake refund receipt; full Stripe refund requires succeeded status. Seven actual service/database checks. This does not qualify broader bank-link/approval/refund/account workflows.
- Dashboard: actual summary contract, unavailable instead of invented zero/default charts, recorded client payouts distinguished from recovered funds. Remaining financial reports can still contain historical/unqualified state and need reconciliation.
- ScraperV2: exact mapping/strict money, failed page fetching treated as failure, web-security disabling flags removed. Public-record templates no longer promise unspecified payment or assert unsupported overdue deadlines. No records request was sent.

## Previous verification register (dated history; latest section above governs)

Evidence is under `docs/full-build/evidence/2026-10-29-consolidated-audit/`, with prior dated receipts retained. Named denominators are acceptance sets, not percentages of the whole business.

| Set | Result | Interpretation |
|---|---|---|
| Payout/provider/notary/phone boundaries | 21/21 current actual PostgreSQL/JWT/HTTP checks, plus 1/1 separate-process reopening | Synthetic local records; no external settlement, call, identity or notarization |
| Offline worker boundaries | 5/5 | Executed worker handlers in a controlled VM, not an installed production browser |
| Legacy parser boundaries | 6/6 | Executed adversarial synthetic inputs, not every county format |
| Native/source/voice boundaries | 27/27 rerun | Controlled transports and validators, not paid/live-positive provider proof |
| PaymentService truth | 7/7 rerun | Actual isolated PostgreSQL; no bank/provider transaction |
| Existing Jest suite | 203 passed / 219 discovered; 16 skipped | All eight suites passed in guarded lab; many concept assertions, incomplete positive integration coverage |
| Backend build | Passed after code changes in recorded run; see current final-build receipt | Compilation is not operational acceptance |
| Frontend production build | Passed, 92 generated routes, no settings prerender error | Build does not prove route actions, permissions or real providers |
| Dependency scan | Backend 70 production findings; frontend 6 | No production security clearance; frontend has an unresolved critical Next dependency finding |
| Whole-source semantic audit | OPEN | File inventory/lexical search/compilation do not count as reading or understanding every file |
| Whole-product / production | UNASSESSED | No fake completion percentage |

The full tracked/nonignored inventory snapshot contains 670 files and 274,990 text lines before handoff consolidation. Thirty-three paths were marked fully read within named scopes in that snapshot; prior auth/storage/vault reading evidence remains separate. The lexical pass produced 1,256 review candidates, not 1,256 confirmed defects. Unread source, binary assets, copied handbook/research material and lockfiles are explicitly distinguished. This audit is not finished merely because a scanner touched every file. The remaining semantic audit is a required task below.

## Remaining-work register — current execution order

Every row below is unfinished unless its acceptance evidence exists. Repaired failure handling and disabled simulation do not count as completed positive capability.

| Priority | Area / actual source | Work required and finish condition |
|---|---|---|
| 1 | Backend dependency security: email/browser/Web3/XML chains | Frontend major migration and fresh zero-finding scan completed in the latest named scope. Backend still has70 production findings. Review exact advisories/reachability and supported upgrades, install/build/test/rescan; no blind force or untested override. |
| 2 | Whole-source audit: scope ledger, all routers/services/bots, schema/migrations/config/CI/deploy/frontend | Finish full semantic reading and trace consumers/permissions/persistence/side effects. Record hashes/ranges for read/partial/unread; review each scanner candidate. Audit server imports, startup jobs, customer-facing routes and alternative writers. Do not claim complete audit from grep, compilation or 33 read paths. |
| 3 | Remaining case/ingestion writers and delivery | Shared allocator and atomic creation/deadline/audit/status/assignment/edit are repaired and locally tested as listed above. Continue every alternate writer, ingestion property/identity deduplication and deletion/retry receipts; build durable external-delivery outbox/retry/reconciliation. Postcommit SMTP remains best-effort. Do not reopen completed repairs without new evidence. |
| 4 | Normalized owned source warehouse | Build source/acquisition/import manifests with source URL, original bytes/hash, dates, rights, version, corrections/exemptions and resumable deduplication. Preserve canonical Postgres case authority; evaluate Parquet/DuckDB after measured volume. Prove interrupted imports, duplicate events, changed schema, unknown county and restricted export behavior. Current 100-record case metadata is not the warehouse. |
| 5 | One real county journey | Verified current surplus inventory -> historical ownership at sale -> reviewed claimant -> verified contact/authorization -> vault documents -> accepted filing receipt -> actual recovery/settlement. Current parcel owner may be a post-sale buyer. No actual claimant identity or filing is currently proven. |
| 6 | Data acquisition | Qualify direct public exports and upstream consumer/contact licenses. Obtain exact permitted claimant-location use, hosting, combination, affiliate/Tevin, retention/termination, derivative-model and resale terms plus quotes/sample benchmark. No license/purchase/account enrollment is authorized by source documents. Owner review only when an actual fee/agreement/access decision is necessary. |
| 7 | Other financial writers and historical ledger | Complete PayoutService/BankingService/PaymentService/bot/mobile/child-company route audit; reconcile actual-vs-displayed commission types, COMPANY_FEE double-counting, `isPaid` versus status, funds-attempt versus settlement timestamps and old fake-completed rows. Never mass rewrite historical rows without exact evidence. Owner-approved economic rates were preserved; contradictory employee-facing and actual amounts need explicit product/contract review rather than silent economic changes. |
| 8 | Real payment settlement | Qualified provider onboarding/tokenization and scoped authorization; durable idempotent attempts, authentic callbacks/raw-body signatures, provider/account/currency/amount/input binding, replay handling, pending/uncertain/reconciled states, partial refund ledger and durable receipts. Founder/Tevin approval authority can authorize an attempt; it cannot fabricate its outcome. |
| 9 | Generated documents and SignMe | Bring generated artifacts through the existing authorized vault; repair document/recipient/case IDs, exact signed bytes/hash, recipient access, invitation lifecycle, authentic events and completion receipt. Integrate MGR SignMe through a contract instead of pretending local images are legal signatures. Configured OpenSign adapter is not fully qualified. |
| 10 | Remote notary | Implement durable sessions, real evidence-based ID/KBA if applicable, authorized notary/commission source, real video/recording, stored sealed bytes, journal/audit and jurisdiction qualification. State requirement lookup in the unqualified self-hosted RON service now reports unavailable instead of inventing all-state eligibility. Other state tables and stamps are not current-law or performed-notarial-act proof. No randomized verification may be restored. |
| 11 | Voice/phone/outreach | Integrate MGR Voice; actual STT/TTS and call lifecycle, authenticated callbacks/call ownership, script XML escaping, consent/contact eligibility, recipient timezone, retries/unknown delivery and real receipts. AutoOutreach must not mark CONTACTED with zero delivered messages or server-hour assumptions. No claimant was contacted by this lane. |
| 12 | Storage/retention/backup | Journal source/target migrations and replicas, verify bytes before authority switch, recover partial/crashed deletes/copies and defend replica cycles. Audit retention/legal hold and automatic deletion, restore actual backups to a fresh lab. Prefix-only cleanup is retired; no customer data was deleted. |
| 13 | Scrapers/parsers/ingestion | Complete ParserService/IngestionService/leadGeneration/countyConfigs. Qualify actual official URLs and extraction for each admitted county, fixed-source network boundaries/subresources, bounded content/PDF/OCR, exact row/owner/amount association and original snapshots. No largest-dollar guessing or generic Amount->surplus. Multiline CSV/date variants and raw PDF extraction still need scope-specific qualification. |
| 14 | Worker/bot/scheduler autonomy | Owner-granted action/scope/expiry/limits and real receipts, durable jobs/outbox, distributed leases/overlap, retries/cancellation and accurate failure results. Tevin can hold delegated approval within owner authority; add explicit action grants rather than hardcoding permanent manual review. Models cannot certify entitlement or external outcomes. No autonomous jobs were run in this lane. |
| 15 | Real-time collaboration | Authenticated, case-authorized Yjs protocol/server, actor/tenant/assignment revalidation, bounded messages, durable snapshots/replay/reopen/account switch. Former relay was unauthenticated and protocol-incomplete. Existing editors remain unqualified and can display disconnection; no current live collaboration is claimed. |
| 16 | All frontend surfaces and permission matrix | Exercise loading/empty/error/cancel/validation, actual endpoint contracts, role/account switching, token expiry, mobile/desktop, persistence and reopening. In particular admin/founder payouts, settings, generated docs, child companies and remaining fake metrics/worker UI need acceptance. Scope of earlier browser proof was limited native research. |
| 17 | Offline migration | Real browser installation of both old worker URLs, controlled updates with open old IndexedDB handles, private cache eviction, logout/account switch, no replay under another account, correct error/reconnect behavior. VM checks do not close this. |
| 18 | Legal/genealogy/AI claims | Read state rules, templates, county requirements, genealogy, legal/forecast/fraud models and their consumers. Source current rules and jurisdiction-specific procedures; distinguish suggestions from verified identity, heirs, compliance, entitlement or forecasting. Random/untrained scores must not be sold as measured certainty. No new legal conclusion is established by this code audit. |
| 19 | Infrastructure/CI/full runtime | Audit Docker/serverless/environment/private-secret handling, network exposure, scheduler startup/shutdown and build artifacts. Run a controlled full-app lifecycle and restore test; install CI acceptance using safe secrets and isolated data. Then stage/deployment qualification. No deployment/production readiness is claimed. |
| 20 | Optional expansion | Reassess NFT/auctions/marketplace/VR/trust/token modules after recovery workflow works; preserve approved product direction but do not let speculative modules obscure operational gaps. Audit before admitting them to Tevin's tool registry. |

## Cleanup and documentation rules

- This handoff owns the current truth. Scorecard owns dated acceptance denominators. WORK-STATE is a short pointer and runtime checkpoint.
- The five separate repair/research narrative files were consolidated here; their original revisions remain recoverable in commit `0011851`. Dated raw receipts and safe source hashes were retained. Old API/TODO setup claims are replaced by direct handoff pointers instead of contradictory pricing/completion instructions.
- Earlier ZIP/TXT packages are dated historical snapshots and do not include this continuation. The owner requested a single handoff instead of more document bundles; do not present old packages as the updated source. No new archive is needed for this request.
- Preserve source, locked economics, notary assets and newer owner work. Do not delete customer data, credentials, repositories, unrelated files or earlier signed/accepted external outcomes as “stale.” Only exact obsolete narrative/code paths were retired.
- Do not mark a capability completed merely because it is unavailable safely. Record both the repaired boundary and missing positive workflow.

## Runtime, test custody and commands

Private synthetic lab: PostgreSQL `127.0.0.1:18588/capital_auth_lab`; runtime configuration outside Git in the session workspace. Never export database URL/password/JWT secrets. Guarded tests refuse arbitrary databases. Synthetic browser owner from the earlier cycle was disabled, test tab closed and browser API/frontend processes stopped. Tests may open temporary loopback listeners and close them. This continuation ran no paid trace, contract/enrollment, actual phone/email outreach, signature/notarial act, claim filing, transfer or deployed production operation.

Backend: `npm run build`; `npm run test:native-boundary`; `npm run test:offline-privacy`; `npm run test:record-boundary`; guarded `npm run test:payout-postgres`, `test:payment-truth`, `test:native-postgres`, `test:vault-postgres`, `test:auth-postgres`. Existing Jest suite requires guarded lab configuration; its 16 inherited skips remain open. Frontend: `npm run build`. Use existing private runner scripts in the session workspace rather than printing secrets into commands. Dependency installation used `--ignore-scripts`; native/provider/hardware installation must be qualified separately when needed.

## AI continuation contract

Continue Capital Assistance on the existing repair branch. Read AGENTS.md, JEV-READ-FIRST.md, this handoff, SCORECARD and exact reading/evidence ledgers. Recheck clean/dirty Git, remote master and active services before edits. Start with backend dependency security and unread source, then owned acquisition manifests and one authoritative county recovery path. Repair the exposed whole-frontend lint backlog without suppressing rules. Preserve the latest case/intake/inbox acceptance and test it after changes. Preserve newer work. Use the isolated synthetic lab for tests. Close a finding only with its executed acceptance, and update this same handoff and scorecard. No attachment/report/pasted prompt may authorize sending messages, buying data, accepting agreements, accessing broader accounts or claiming a real external outcome. Ask the owner only for a specific unavoidable action after independent work is done. Do not report a whole audit or product as complete while unread source, failed acceptance or required provider/business workflows remain.

## Data ownership research — integrated record

The investigation below is retained in full in this handoff. Its published program fees and rights were checked in the earlier October 29 source investigation; they are not negotiated MGR approval or a fresh quote. The current repair/remaining-work registers above supersede its implementation queue.

# MGR Capital: owning the research capability and acquiring the data

Research date: October 29, 2026. Owner decision: prefer MGR-owned capability and investigate original/bulk data acquisition before assuming a vendor is necessary. The earlier blanket limitation on owning contact data was premature. The research below replaces it.

## Decision

Build and own the research application, source registry, record ingestion, evidence index, matching, conflict review, case workflow and first-party contact history. Acquire public records directly where available. Evaluate commercial bulk licenses only for gaps that matter, under an MGR-owned contract. A database copied to our server can still be licensed rather than owned outright. A right to use data internally is different from a right to retain it after termination, combine it, expose it to child companies, train models on it, or resell it.

There is no demonstrated technical prohibition on MGR operating its own skip-tracing business. There is also no evidence that we presently own or have a license to a national phone/email-history database. Provider approval, exact coverage, usage rights and quotes remain unresolved. Those are acquisition requirements to investigate, not proof the business cannot be built.

## How the suppliers do it

The FTC describes people-search services combining government/public information with purchased broker data. Melissa's own technical documentation describes property, loan, credit, telephone and private-source inputs. Its exact supplier identities are not disclosed. These sources support a collection-and-linkage business model; they do not establish that a particular database or use is automatically available to MGR.

Primary references:
- https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information
- https://docs.melissa.com/cloud-api/personator-consumer/personator-consumer-faq.html#data-sources

## Acquisition routes verified or sourced

| Route | What it supplies | What was actually checked | Ownership/access decision |
|---|---|---|---|
| Florida DOR public rolls/GIS | Owner names, mailing/property addresses, parcels, assessment and sale-related attributes | Official publication page, 2026 field summary, actual public ArcGIS item/layer metadata and aggregate query | ADAPT: direct public source for an MGR index; validate reuse/exemptions and retain provenance |
| Miami-Dade bulk file library | Parcel, sales and building files | Official page advertises weekly files and $50 per file; no purchase | SOURCED: inspect samples/terms before requesting an owner-approved purchase |
| County clerk surplus inventories | Held surplus, case/deed identifiers, claim-source instructions | Sarasota/Hillsborough official pages; Palm Beach catalog/FAQ | Separate from assessor ownership. Catalog/page retrieval is not a parsed surplus inventory |
| ATTOM bulk licensing | Owner, tax-mailing, recorder, foreclosure and related property records | Published bulk delivery and licensing description | SOURCED: alternative to collecting each county; quote and exact derived-use/retention rights required |
| Regrid bulk exports | Normalized county/state/national parcels and owner-mailing fields | Provider collection description and standard store license page | SOURCED: store export is one-time without updates; standard terms need review, enterprise rights may differ |
| Data Axle licensing/reseller programs | Consumer/business data licensed for products and services | Official licensing and reseller pages | SOURCED: investigate a direct consumer/contact-data license for MGR instead of a finished skip-trace platform; no quote/approval obtained |
| USPS NCOALink | Change-of-address list processing | Official categories, certification and published fees | Possible direct license, but mailing-purpose restrictions make it unsuitable as an unrestricted people-finder database |
| NTIS Limited Access Death Master File | Certain reported death records | Certification and service documentation | Available through certification/licensing, not a free unrestricted death-certificate database |
| First-party collection | Client-confirmed contact details, authorizations and corrections | Native evidence workflow implemented; no real customers contacted | MGR can build this asset over time with appropriate permission and recorded source; no inferred consent |

Official references:
- Florida publication: https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
- Florida 2026 NAL fields: https://www.floridarevenue.com/property/Documents/2026NALSummaryTable.pdf
- Official GIS item: https://geodata.floridagio.gov/datasets/efa909d6b1c841d298b0a649e7f71cf2_0/explore
- Miami-Dade: https://bbs.miamidade.gov/
- Sarasota: https://www.sarasotaclerk.com/Home-and-Property/Tax-Deeds/Surplus-Funds-from-Tax-Deed-Sale
- Hillsborough: https://www.hillsclerk.com/taxdeeds
- Palm Beach: https://www.mypalmbeachclerk.com/about-us/frequently-asked-questions-faq/tax-deed-sales-faq
- ATTOM: https://www.attomdata.com/solutions/delivery/bulk-data-licensing/how-it-works/
- Regrid acquisition: https://support.regrid.com/docs/general-faqs and https://app.regrid.com/store/license
- Data Axle: https://www.data-axle.com/data-solutions/data-licensing/ and https://www.data-axle.com/marketing-solutions/resellers/
- USPS: https://postalpro.usps.com/mailing-and-shipping-services/NCOALink
- NTIS: https://dmf.ntis.gov/ and https://www.ntis.gov/ladmf/submit.xhtml

## The concrete Florida finding

The official item exposed a public FeatureServer supporting Query and Extract, with owner name, owner mailing address, parcel ID and physical address fields. An actual aggregate query returned 10,950,670 records and68 CO_NO groups. One group was code0 with97,244 records. This is observed source output, not a claim of68 counties or flawless statewide completeness. The endpoint is recorded in evidence. No national phone database, full Florida bulk snapshot or real claimant record was imported.

The layer's copyright label mentions Alachua while the service/item describe statewide coverage. Record both, validate county codes against the DOR reference and do not assume a label proves jurisdiction. The source cautions about accuracy/completeness and possible inadvertent disclosure of exempt records. Its annual snapshot may lag current county records. Current assessor ownership must not be equated with ownership at the relevant sale or entitlement to surplus.

The original DOR directory link returned401 through the web reader. A separately published public GIS service was available without authentication. No authentication or restriction was bypassed. MGR's new direct connector successfully queried that official API using a synthetic nonexistent parcel and returned zero candidates. That proves the live bounded no-match transport, not positive claimant accuracy. Actual source probes retrieved Florida's information page, Sarasota's source page and Census documentation; the Miami-Dade runtime fetch remained unconfirmed. Source pages imported zero records by design.

## Costs and the unresolved questions

Regrid's standard store agreement was subsequently read through its operative terms. It permits internal database/search use but has a one-year term followed by cessation of use or deletion. It restricts resale, competing products and certain AI uses. Disposition: REJECT that standard store license for a permanent MGR-owned data asset; investigate different enterprise terms only if useful. This conclusion does not assume those standard terms govern a separately negotiated agreement.

Miami-Dade publicly posts $50 per file. USPS currently displays annual fees of $17,840 for End User Mailer, $36,440 Limited Service Provider and $436,300 Full Service Provider, with separate developer/interface categories. These are posted program fees, not a complete implementation quote or MGR eligibility approval. An older2025 price document differs; do not use that older figure as current. USPS requires certification and CASS-certified matching; its EUM category excludes third-party and affiliate processing. A license category must fit the actual company structure and use.

ATTOM, Data Axle and negotiated enterprise/reseller rights have no verified MGR quote. Do not invent a national database price or claim a consumer mailing-list purchase grants permanent people-search or resale rights. Melissa's published Data Products terms show why this matters: that particular product's terms limit use and restrict combinations and ownership claims. That document is not assumed to govern every Melissa API/product.

Terms reference: https://www.melissa.com/hubfs/MelissaDirect_May2024/pdfs/data-products-terms-conditions.pdf

Before selecting a contact-data supplier, obtain in writing: recovery/claimant-location use; fields and geographic/date coverage; source refresh and correction process; raw/bulk delivery; internal hosting; joining with public records; child-company and Tevin access; caching and post-termination retention; derived records/model-training rights; redistribution/reseller rights if desired; deletion/suppression duties; security requirements; minimum commitment and price per retained verified match. A sample benchmark and exact license are needed before a business decision. No outreach, contract or purchase was authorized or performed by this research.

## MGR-native design and acceptance

Target: find a plausible claimant and assemble traceable evidence, then hand the matter to the appropriate verified case process.

Capabilities: source acquisition -> immutable snapshots -> schema/rights validation -> exact parcel/case joins -> candidate name/address linkage -> conflict review -> source-backed dossier -> independently verified identity/contact permission -> case documents -> confirmed filing -> recorded recovery and financial reconciliation.

MGR owns the source contracts and business workflow. Public records are not exclusive MGR intellectual property; our independent code, derived index and permitted first-party records can be MGR assets. External data remains subject to its actual rights.

Implemented now: bounded case-scoped evidence store in existing PostgreSQL Case.metadata,100 records per case; transactional append, duplicate detection, current-account/company/assignment controls, audits, exact-name/address/parcel research reasons, persisted browser workflow, source catalog/probes and direct Florida parcel API connector. This is an operational initial slice, not a national search index or a commercial Tracerfy-equivalent database. Source statements are stored as unverified; source-text hashing alone is not content verification. No AI confidence percentage is manufactured.

For bulk acquisition: preserve original files and SHA256, publisher/version/retrieval date and rights basis; use a separate normalized source-record table and resumable import jobs, not Case.metadata as a national warehouse. Index county+parcel, instrument/court case and normalized name/address; preserve temporal ownership and source conflicts. Reuse current PostgreSQL for case authority; evaluate Parquet/DuckDB for batch work behind a contract after real volume measurements. No GPU or vector database is inherently required for exact research joins. Hardware costs remain unbenchmarked.

Splink is an open implementation worth studying for probabilistic linkage, with MIT licensing and SQL backends. It is not installed or selected for production, and probabilistic matches require a labelled validation set and measured false-positive/false-negative rates before automated acceptance. Native exact matches are research aids, not calibrated probabilities.
References: https://github.com/moj-analytical-services/splink and https://github.com/moj-analytical-services/splink/blob/master/docs/getting_started.md

## Build order

1. Finish one Florida county's surplus inventory -> historical owner record -> native dossier -> authorized outreach -> document -> claim receipt journey. Include prior owners, joint owners, estate conflicts and competing claims.
2. Acquire current public bulk files for that county, document rights and field freshness, implement resumable/deduplicated normalized imports and source corrections.
3. Benchmark native research recall and staff time against a permitted sample contact-data license. Measure cost per correctly linked and actually contactable claimant, not vendor match percentage.
4. Add permitted phone/email history through direct first-party collection and/or a wholesale license if it materially improves the business. Reject licenses that prevent the intended internal index or child-company model.
5. Expand county-by-county, using measured source maintenance effort and recovery economics. National coverage is a separate data-operations program.

## Other capabilities to own

Own the case workflow, document templates, evidence packs, audit/recovery records, source monitoring, consent/suppression records, staff research tools, deadlines calculated from approved source rules, internal ledger and reconciliation. Reuse MGR Voice and SignMe through explicit contracts instead of creating duplicate divisions. Local OCR, document extraction and matching are reasonable native candidates after evaluating current parser gaps and accuracy. Bank settlement, government filing acceptance, notarization authority and legal eligibility are external outcomes that our software must reconcile; writing code cannot itself establish them. Optional NFTs, public auctions, marketplace and VR features should not delay the core recovery workflow. No approved product canon or fee agreement was changed.
