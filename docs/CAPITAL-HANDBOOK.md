# MGR Capital Assistance — operating handbook and how-to guide

Working edition: October 30, 2026. Repository: [tdmboyd-dev/MGR-CAPITAL-ASSISTANCE](https://github.com/tdmboyd-dev/MGR-CAPITAL-ASSISTANCE). Current implementation and remaining work: [HANDOFF](../HANDOFF.md). Engineering navigation: [audit map](full-build/CAPITAL-AUDIT-MAP.json) and [feature catalog](full-build/CAPITAL-FEATURE-CATALOG.md). Verification history: [scorecard](full-build/SCORECARD.md).

This handbook follows inspected screens and implementation. It identifies prior local proof separately from instructions still awaiting a live provider or customer. It is not a statement that every page works or that every state has been qualified. No customer, signing, filing or settlement journey has been completed. Do not replace source records, customer authorization or clerk receipts with a status selected in this application.

## What this business system is

Capital is being built to discover money left over after property sales, research who may be entitled to it, organize authorized recovery work, prepare documents, track the county process and account for receipts and employee compensation. Tax-sale surplus, mortgage-foreclosure surplus and state-held unclaimed property are different processes. A shared application can organize them, but each jurisdiction and recovery type needs its own admitted source and procedure.

The recommended launch is Memphis/Shelby and Tennessee first, with the existing Davidson flow as a working research reference. Expand one verified county/process at a time. A state dropdown is coverage navigation, not proof of legal or technical readiness. The application currently supports research work before a business has customers; it must not invent customers to make the pipeline look active.

### Words used on screen

| Word | What it means here |
|---|---|
| Source snapshot | Saved original county material, its acquisition time and a hash identifying its exact bytes |
| Normalized record | A structured row extracted from that source; extraction can still need visual correction |
| Recovery work item | An individual research file tied to a case/parcel and source history; not a customer engagement |
| Customer case | A separate operational file for an actual client, assigned staff, documents and case status |
| Claimant | A person or entity whose entitlement must be established; a current property owner may be the auction buyer |
| Tenant / operating business | The company boundary controlling which records an actor can access |
| Receipt | Saved evidence of an action or result; a selected status or success toast alone is insufficient |
| UNKNOWN | The outcome could not be established; reconcile before retrying an action that might duplicate a send or payment |
| Idempotency key | A request identifier used to recognize retries of the same action |

## Who uses what

The global founder operates the shared system. A company founder operates within an assigned company; the same FOUNDER role name does not grant that person global data access. An employee works assigned cases and sees their own actual payable allocations. Team leaders have bounded team responsibilities. Clients see their own admitted customer records and permitted documents. ADMIN, HR and COMPLIANCE have distinct responsibilities; role names alone do not prove that every old endpoint implements the intended boundary.

Several core routes now check current account and company state on every request. The full action matrix across all old routes is still an audit item. Do not onboard separate businesses as if that complete matrix had passed. The legacy IMAP inbox currently shares one configured server identity; it is restricted to the global founder until individual mailbox credentials and isolation are integrated. Employee/client/company inbox access is not qualified.

## Daily start and finish

1. Sign into your own account. Confirm the operating business before research or case work.
2. Open the saved warehouse and recovery pipeline. Refresh from the official source when that adapter is admitted. Review errors instead of assuming an empty screen means no records.
3. Work one research file at a time. Keep historical source amounts separate from a current clerk balance and competing-claim review.
4. Save notes and stage, then reopen the same file. If the save is uncertain, inspect the saved state before retrying.
5. At the end of the day, review held files, pending outbox attempts, accounting exceptions and current access failures. Preserve originals, receipts and unresolved outcomes.

## How to pull Davidson records

Screen: `/founder/source-warehouse`. Inspected implementation: `frontend/app/founder/source-warehouse/page.tsx`; backend capability under `/api/research/warehouse`.

1. Select **Pull Davidson surplus records**. The application acquires the admitted official register, saves its original, then normalizes it.
2. Select the saved register version. Check its source date, acquisition date, original snapshot ID and SHA256. The displayed sum is a sum of reported figures, not money confirmed recoverable today.
3. Review the county-reported taxpayer, court case and parcel. A pending-proceeding footnote requires further investigation.
4. Select **Research owner** for a Davidson row. Compare the separately saved current-assessor result with the reported taxpayer. A matching name is only a candidate; a different name may be an auction purchaser.
5. Reopen the saved version to confirm persistence. If acquisition or validation fails, inspect retained originals before repeating the import.

Prior evidence: actual public records, saved source bytes and reopening passed in the isolated local system. This does not prove ongoing source availability or outside entitlement.

## How to import Memphis / Shelby records

Screen: `/founder/source-warehouse` → **Import the official Memphis / Shelby sale book**.

1. Open the official county sale-book index linked on the screen. Obtain the exact original Tax Sale 2202 edition admitted by this parser. Other editions need their own parser qualification.
2. Use **Official Shelby2202PDF** to select the PDF, then **Import Shelby sale book**. The file picker can select an accessible local file; it is not limited to a browser download list.
3. Select the saved Shelby version and inspect the original-page links. Crossed-out entries, amendments, unsold/defaulted parcels and confirmation-order dates must be reviewed against the original pages.
4. Keep the resulting positive research files **ON_HOLD** until visual corrections and current county balances/claims are resolved. The existing import created 153 held items from the admitted historical edition; that is not 153 clients or available recoveries.

Shelby's court portal states a commercial-use restriction. No authorized commercial connection has been proved. Use the permission request tracked in HANDOFF; do not accept a prohibited route or treat the browser companion as permission. The full 175-page visual correction review and current fund verification remain unfinished.

## How to work an individual recovery file

Screen: `/founder/recovery-pipeline`. The old `/founder/pipeline` redirects here.

1. Select a saved item. Its URL retains `workItemId` so it can be reopened directly.
2. Read the reported amount/date, source-review warning, inside-Capital matches and next research checks. An internal match does not establish an outside claim or payment.
3. Compare court and parcel identifiers before using any docket. Docket entries for another parcel or unscoped motions cannot resolve this target's entitlement.
4. Choose **RESEARCH_REQUIRED**, **RESEARCHING**, **ON_HOLD**, **READY_FOR_CLIENT** or **CLOSED** and enter research notes. These stages describe work progress, not legal conclusions.
5. Select **Save work**. Reopen the same URL and verify the stage/notes. The version field rejects competing updates; if the save fails, reload the saved record before deciding what to retry.

Reimporting the same county/court-case/parcel adds source observations instead of another work file. This research-to-work pipeline exists. A fully authorized research-to-customer-to-settlement journey remains unproved. Do not create a customer from a public name alone.

## How to connect a county source window

Screens: `/account/identity`, then `/source-connections` opened from an admitted work file.

1. Complete the real, attested personal/business profile in the application. Choose the actual operating business. Do not put secrets in research notes.
2. Open **Connect official court source** from an admitted Davidson file. The saved work ID supplies the court case number. Choose one work file or customer case, not both.
3. Select **Prepare source connection**. Review the county ID, adapter, operating business, exact court case and expiration.
4. In Chrome with the reviewed Source Companion installed, enter its extension ID and select **Open connected source window**.
5. Complete the county's human verification yourself in that source window. Leave it open. The companion resumes the admitted public case search and returns actual rendered evidence.
6. Confirm **CAPTURED**, the saved run receipt and snapshot, then reopen the work file. **WAITING_HUMAN**, **EXPIRED**, **CAPTURE_REVIEW_REQUIRED** or an unavailable current status are not successful captures. Use **Cancel connection** if abandoning the run and check that cancellation was saved.

The authorization token is short lived and is not persisted in the page. Reopening a saved run does not recreate that token; an already open window may finish before expiry, otherwise prepare a new connection. The current public case search sends the admitted case number, not claimant identity fields or a legal filing. Davidson's named real Chrome flow has passed previously; Shelby is not admitted. A future county needs its own verified mapping and authorized access.

## How to check state and county requirements

Screen: `/founder/recovery-rules`.

1. Choose the state and the correct recovery type. Tennessee is the first priority.
2. Read coverage status, required evidence, published source links and whether automatic quoting/filing is admitted.
3. If the fee rule, deadline or county procedure is not qualified, keep it unresolved. Do not substitute another state's formula or an old generic deadline table.
4. Save the official source, effective date, actual county procedure and review result into the work evidence before offering a fee or preparing a legal submission.

The AI document checker is a separate preparation aid, not the authority for this step. Its old canned score and unsourced fallback rule engine have been removed. Missing provider access returns unavailable. A successful AI response is labeled suggestions only, and a review score cannot certify compliance. Its positive provider path, retained review receipt and professional review remain open.

## How to use customer cases and documents

Screens: `/founder/cases`, `/founder/cases/new`, the selected case detail; employee/client screens have narrower access.

Use a customer case only after an actual client relationship and authority have been established. Confirm company, assigned employee, correct parcel and identity evidence. Core creation, case-scoped documents and selected client boundaries have local DB/HTTP evidence in earlier receipts; the full UI/role/status matrix has not passed.

For documents, verify the correct case, permitted type, recipient and latest version. An upload is not a signature. A signature request is not a completed signature; a generated packet is not a filing. Keep immutable signed content, signer evidence and provider/county receipts when those integrations are completed. Real signing, notarization and court submission remain open. Some older case-detail document actions still need bearer-auth download verification; do not interpret a broken download as a missing original.

## How to read employee earnings

Screen: employee sidebar → **My Earnings**, `/employee/payouts`.

The screen displays the employee's own saved commissions and overrides in **actual payable dollars**. The owner's October 30 decision supersedes old doubled-display/shadow-pay instructions. Actual tier rates remain 10%, 20%, 30%, 40% and 50% of the company fee; existing leader override rates remain unchanged. Company margins stay private.

Read **Recorded allocations**, **Allocated this month**, **Pending / processing** and **Entries needing review** separately. Failed/cancelled/unresolved entries are excluded from payable totals. Conflicting legacy rows remain for review rather than being silently rewritten. A completed ledger entry alone is not bank settlement proof.

Select **Refresh**, then reopen the screen to confirm the same saved amounts. Prior optimized local browser proof used a synthetic $12.34 allocation whose old display was $24.68; the new screen showed $12.34. This was accounting display proof, not a transferred payment. Historical reconciliation, all financial writers and real provider settlement remain open.

## How to queue and reconcile email

Preferred existing path: `/founder/email-outbox`, **MGR Email Outbox**. This owned queue can use a configured SMTP server; it does not require buying a tracing or email SaaS product merely to save jobs.

1. Enter the intended recipient, subject and text. Confirm you are authorized to contact that person before attempting external delivery.
2. Select **Save to outbox**. This saves a job; it does not send it. Verify the saved row after refreshing/reopening.
3. A deliberate **Attempt SMTP send** requests delivery through the configured server. Do not use this step as a test against real people without authorization.
4. **ACCEPTED** means the mail server accepted the message. It does not prove inbox delivery, reading or consent. **RETRY** waits for its next admitted attempt.
5. **UNKNOWN** means reconcile the saved Message ID with mail-server records before resending. Automatic retry is held to avoid duplicates. If queueing was uncertain, **Retry same queue request** retains its original request identity/payload.

Prior proof used actual PostgreSQL and a loopback SMTP sink, not external recipient delivery. Domain authentication, reputation, bounce/unsubscribe handling, actual mailbox isolation and positive external delivery still need qualification. Running your own mail infrastructure has operating costs even when the application code is owned.

The legacy inbox/composer is not the launch path: it shares one IMAP identity and is now global-founder only. Draft storage is disconnected and returns **DRAFT_STORAGE_UNAVAILABLE** rather than falsely claiming a save. Keep unsaved text locally; do not close a composer expecting a draft to exist. Attachment/multipart handling, flags, recipient parsing and send reconciliation still require repair.

## How to use worker reports and founder insights

Screens: `/founder/worker-bots`, `/founder/insights`, `/founder/dashboard`.

Worker reports are observations about stored worker state. Creating, spawning or labeling workers does not prove that they performed claimant research or completed cases. Four report URLs formerly went to a bot-name lookup; routing is repaired and HTTP dispatch tested with downstream computation explicitly stubbed. Real worker jobs and business-action receipts remain unqualified.

The founder feed reads saved undismissed focus items. No items returned does not mean the business is healthy. The feed now has a compatible data envelope, bounded query and current global-founder check. Per-user read receipts/dismiss controls are not connected on its screen. The former insights screen's invented zero metrics and “everything is running smoothly” inference were removed.

## Setup and recovery

For an engineer: read AGENTS.md, JEV-READ-FIRST.md, HANDOFF.md, WORK-STATE.md and the scorecard before changes. Preserve the repair branch and newer working files. The old master spec and January setup guide are historical references; the current deployment checkpoint is `Deploy.md`.

Use supported Node (see each package's engines), PostgreSQL, private server-only secrets and the lockfiles. Standard source checks are `npm ci`, Prisma client generation, backend `npm run build`, frontend `npm run lint` and `npm run build`. An initial database or migration must be selected deliberately; never run seed/reset against an unknown existing database. Do not copy the isolated acceptance database into production or use its synthetic actors as real users.

`NEXT_PUBLIC_API_URL` is a public backend origin; the shared client adds `/api`. It is not a secret store and should not already include `/api`. Server secrets belong in protected environment configuration, never in a public frontend variable, exported ZIP or Git history. The earlier exposed credentials require provider-account rotation before production reuse; encryption-key changes need a data migration preserving decryptability.

The named local acceptance environment is isolated; private configuration and database files are excluded from source downloads. Owned API/frontend processes were previously stopped at handoff. Check current listeners before starting another copy. Scheduled business actions should remain disabled until their exact handler, authorization, provider effect and recovery receipt are qualified.

If the browser loses connection, reopen the same saved work/run/job before resubmitting. If a provider times out after an action may have occurred, reconcile before retrying. Restore tests, encrypted backup recovery and clean deployment acceptance remain open; possession of a ZIP is not a tested database backup.

## How this handbook stays current

Every repaired feature must update the same HANDOFF, task ledger and scorecard with its actual proof. Each operating procedure needs its screen/API, actor, required inputs, saved result, failure path and reopening check. A future feature becomes an operating instruction only after that path has been verified; until then it belongs in the feature catalog's remaining-work column.

Next handbook expansions after engineering qualification: complete company/role action matrix; claimant onboarding and contact permission; actual signature/notary ceremony; county-specific filing and acknowledgment; reconciliation of money received, fees, overrides and disbursements; mailbox/account administration; backup/restore and incident procedures. These are explicitly unfinished, not hidden behind the research guides.
