# Capital Assistance deployment checkpoint

Read [HANDOFF.md](HANDOFF.md) for current source, local evidence, engineering gaps and outside access requirements. This file does not authorize deployment, purchases, new agreements or changes to existing DNS/accounts.

## Credential exposure requiring owner action

October30,2026: the previous version of this document contained credential values in a copy/paste environment table. They were removed from current source. Treat them as potentially exposed; validity was not tested and they were not reused. Git history and older copies may still contain them, so editing this file does not revoke access.

Use each provider's authenticated credential-management flow to revoke/rotate affected AI, email, payment and signing credentials. The old table also contained database/authentication configuration: review database access and plan signing-secret/session rollover before using those values again. Review the encryption-key example previously in API_GUIDE.md separately; preserve decryptability/backups before any key migration. Do not paste credentials into chat, documentation, commit messages, screenshots or source packages.

No provider key was tested, created, rotated or revoked by this local repair. No Git history rewrite was performed. Provider rotation is an unresolved account action, not a completed code repair.

## What has actually been verified

- Backend TypeScript and optimized frontend compilation pass on the repair branch.
- The optimized local browser workflow uses loopback API/PostgreSQL and synthetic operators. It is not a hosted production acceptance test.
- External signing, notarization, payments, tip collection, outreach and settlement still require their named positive integration qualifications. A configured key or enabled feature toggle is not evidence that a provider works.
- Current deployment domains, provider eligibility, prices, quotas and account entitlements have not been verified in this cycle. The removed guide's free-tier and ready-to-go claims must not be reused as current facts.

## Preparing a deployment when separately authorized

1. Select the exact verified source commit and deployment environment. Preserve the current master and other active work; this repair branch was not merged into master.
2. Provision current secrets through the configured private environment/secret storage. Use example variable names as a checklist, never credential values from Git history. Keep API keys and signing/encryption secrets server-side; public frontend variables may contain public service locations only.
3. Rebuild the frontend with that environment's actual public API URL. The local acceptance build targeted loopback17971 and is not a deployable production artifact.
4. Back up and reconcile persistent data, review migrations against the target database, and qualify current-actor/company isolation, restart persistence and failures before enabling business effects.
5. Verify current hosting/DNS instructions in the selected provider accounts. Preserve existing records; do not follow the obsolete instruction to delete all DNS entries. Obtain the owner's deployment approval after a concrete reviewable candidate is ready.
6. Require authoritative provider/government receipts and reconciliation for external effects. A successful local build or a database status does not prove a charge, signature, filing, notarial act or settlement.

The ordered remaining work is maintained in HANDOFF.md. No separate deployment-completion claim is made here.
