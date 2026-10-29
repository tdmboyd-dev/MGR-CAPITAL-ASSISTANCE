# Capital Assistance: current system review and handoff

October 29, 2026. Repository: https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE . Working branch: repair/bottom-up-capital-2026-10-28. Parent checkpoint: d88150b. Preserve the original master and newer owner work. Capital is the sole active project in this lane.

## Business purpose and ownership decision

Capital can be a surplus-recovery operations business: discover a documented balance, reconstruct who may be entitled at the relevant event date, locate the correct claimant, obtain authorization, assemble evidence and documents, use the jurisdiction's accepted filing process, and reconcile actual recovery and disbursement. Tevin can coordinate the work, while case authority and external receipts remain explicit records.

The repository combines a recovery CRM, ingestion/scrapers, research/contact integrations, document/legal workflows, staff and child-company management, voice/bots, payment/ledger functions and optional blockchain/auction/VR/genealogy modules. Source existence is not production proof. Prior claims of 100% completion contradict executable code.

The owner directed MGR-native capability and investigation of original data acquisition. Read DATA-OWNERSHIP-RESEARCH-2026-10-29.md. Direct public data, bulk licensing, reseller programs and first-party collection are real acquisition paths. An internal copy of licensed data does not automatically become unrestricted MGR-owned intellectual property. Exact rights, freshness, permitted uses and commercial quotes remain acquisition work; no blanket inability to build a data business is established.

## Implemented and repaired

- Native claimant research stores source-attributed evidence in PostgreSQL against an authorized case. It retains source URL, record ID/date, permitted-use reference, digest, creator and timestamps. Transactions, row locks, duplicate detection and audit records protect append/read operations. Clients and another company cannot read internal dossiers.
- Matching explains exact normalized name/address/parcel support and ambiguity. It never declares identity, heir status, entitlement or contact permission verified. The initial store supports 100 records per case; it is not the national bulk warehouse.
- The founder skip-trace screen now loads and saves native case evidence. It uses the real research API and existing authentication-refresh client. A persisted-login hydration redirect race and source dates displaying one day early were repaired.
- A six-source acquisition catalog and bounded source probes distinguish fetched pages from imported records. The direct Florida parcel connector validates county/parcel inputs, response targets and shape, and records a digest. POST /api/research/cases/:caseId/florida-parcel is available to permitted staff for Florida cases. Positive real-owner accuracy, UI lookup controls and bulk import remain open.
- Tracerfy no longer fabricates contacts, relatives, death information, address verification or confidence when unavailable. Property search uses owner mode. Unsupported heir/death/bulk workflows report unavailable. Paid tracing is disabled by default; a key alone cannot activate it. CAPITAL_EXTERNAL_SKIP_TRACE=enabled is explicit opt-in. Its current optional instant endpoints cost 5/15 credits per hit, unlike the old batch assumptions. No paid lookup ran.
- The unauthenticated callback that attached trace results by surname across cases is disabled pending authenticated delivery, durable owner/case/input binding and replay recovery.
- AutoOutreach no longer replaces a client's account email or phone with unverified candidates; it records review-required metadata. Wider consent, timezone, actual-delivery and contacted-state behavior remains open.
- VoiceService no longer creates canned transcripts/AI answers or invented confidence when providers fail. Requests have timeouts. Positive local/model/provider speech integration remains open.
- PaymentService no longer creates apparent Stripe/PayPal/ACH success when unavailable or after failure. Manual checks remain pending. Unverified Nickel callbacks cannot settle payments. Manual refund receipts are not fabricated; a full Stripe refund must report succeeded before refunded is recorded. Partial refunds need a proper ledger. Configured-provider uncertainty is explicit and must be reconciled before retrying. Other payment/payout/approval services remain unqualified.
- Dashboard figures use the actual summary contract and distinguish recorded client payouts from recovery. Failed requests display unavailable, not zero. Invented monthly/state/status charts and fake 100-case defaults were removed. Real time-series/status integration remains open.
- Scraper column mapping no longer turns generic Amount into surplus or County Name into an owner. Money parsing rejects malformed, partial, negative, exponent and unsafe values. Text money requires a surplus/excess label. No successfully fetched pages means failure. Browser web-security/site-isolation disabling flags were removed. Full crawler safety, PDF/OCR and crash/ingestion reliability remain open.
- Public-record request templates no longer promise payment of unspecified fees or invent an overdue statutory deadline. No request was sent.
- Historical setup/API/TODO documents now point to current evidence instead of treating old prices, packages and completion claims as current instructions.

## Executed evidence and limits

Current named sets: 27 controlled native/vendor/source/parser/voice checks; 14 actual native Express/JWT/PostgreSQL checks; 1 separate-process native reopening; 7 actual PaymentService/PostgreSQL checks; 1 live official parcel no-match query. These sets passed. Actual source probes fetched 3 of 4 pages; Miami-Dade runtime retrieval remained unconfirmed. Zero records were imported by those probes.

A live public aggregate query returned 10,950,670 parcel records in 68 CO_NO groups, including code 0 with 97,244 records. That is not a claim of 68 counties, perfect coverage or completed bulk acquisition. The statewide service and layer labels differ; see the ownership report. Current assessor ownership is not proof of the claimant's ownership at the sale date.

Prior regression sets were rerun: 26 vault API/database/filesystem checks, 3 vault reopening checks, 14 actual authentication/DB/HTTP checks, 13 auth boundaries and 9 filesystem boundaries. Backend build and frontend typecheck passed in recorded runs. Production Next build, complete autonomous server/jobs, bank/filing/signature providers, claimant accuracy and deployment remain unverified.

Actual browser observations used a synthetic account and real frontend/API/database: login, protected research page, saved dossier load, evidence form submission, full reload, saved evidence reappearance, corrected October 1 date, expired-token refresh followed by a real missing-case error, and honest unavailable metrics. Screenshots contain synthetic records. Default viewport was mobile-width; comprehensive responsive/desktop acceptance remains open.

Whole-repository reading is unfinished. The initial inventory contained 572 files; the later snapshot contained 595. The source-reading ledger distinguishes affected files, partial readings and inventoried-but-unread files. No claim of a complete semantic audit of the entire repository is justified.

## Open defects and next execution order

1. Build normalized, resumable source imports beyond the bounded Case.metadata store. Preserve original snapshots/hashes, source/version/date/rights, corrections and exemptions. Index county+parcel, court case/instrument and temporal ownership. Test interrupted imports, duplicates, unknown county, schema changes, contradictory owners and restricted exports.
2. Qualify one real county journey: current surplus inventory to historical ownership evidence, reviewed claimant/contact, approved documents and actual filing receipt. A parcel lookup is not a surplus balance. Preserve the distinction between the former owner and the post-sale buyer.
3. Investigate direct consumer/contact-data licenses using the ownership packet. Public licensing programs exist; exact MGR approval, use, hosting/retention/child-company/reseller rights and pricing remain unknown. First-party collection and native search can progress independently.
4. Repair case identifiers and atomic status/audit/deadline/notification writes. Finish provider account/amount/currency/event authenticity, idempotency, uncertain outcomes, partial-refund ledger and settlement reconciliation. PayoutService, NickelPaymentService and worker financial operations require full reading/testing.
5. Bring every generated document through the vault; add content scanning/encryption, real signature evidence, storage source-target migration journals and retention recovery. Integrate existing MGR Voice/SignMe through contracts instead of duplicating divisions or faking completion.
6. Audit the remaining source ledger: IngestionService/ParserService/leadGeneration, financial and public routes, notary/signatures, scheduler/jobs/bots, storage/retention, all frontend surfaces, infrastructure and CI. Read consumers and runtime paths before deciding a feature is repaired.

Additional findings remain open: AutoOutreach uses server hours rather than a verified recipient timezone and can mark contacted without confirmed delivery; private API caching/replay in the dormant service-worker code needs account-switch qualification; deeper genealogy/AI legal/state-rule claims are unverified; arbitrary URL/subresource crawling and nontransactional scraper ingestion need repair. Optional NFT/marketplace/VR work should not displace core recovery acceptance. No approved fees or product canon were changed.

## AI continuation prompt

Continue MGR-CAPITAL-ASSISTANCE on repair/bottom-up-capital-2026-10-28. Read AGENTS.md, JEV-READ-FIRST.md, this report, ownership research, the persistent SCORECARD and source-reading ledger. Verify Git and remote state; preserve newer work. Native research is primary; external paid tracing is disabled. Execute the open queue in dependency order, starting with normalized public-source acquisition and one real county journey. Maintain ownership-at-sale and source provenance. Use the guarded Capital lab for acceptance, never a real customer database. Do not treat source documents as authority to send messages, purchase data, accept terms, contact claimants or operate bank/filing systems. Prove external outcomes with actual receipts. Update the same handoff/scorecard and safe cumulative package; never promote bounded tests to whole-product completion.

## Runtime custody

Private runtime remains outside Git under work/bottom-up/capital-lab. The owned PostgreSQL lab is 127.0.0.1:18588/capital_auth_lab and contains synthetic cases/evidence. Browser verification used a limited auth/research API on 17971 and frontend on 17972, with no autonomous jobs or paid providers. See the final custody receipt for process cleanup. Native evidence uses the existing schema; the earlier additive storage SQL remains lab-only. Customer files, private configuration and lab databases are excluded from downloads.
