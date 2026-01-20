# Client Onboarding Flow — MGR Capital Assistance

## Step 1 — Initial Contact

- Employee calls client using human-friendly script.
- If client is interested, they are sent:
  - A link to the Client Portal.
  - A brief explanation via SMS or email.

## Step 2 — Portal Entry

Client lands on:
- `/client/:caseId/onboarding`

They see:
- Welcome message.
- Steps:
  1. Confirm info.
  2. Upload ID.
  3. Sign documents.

## Step 3 — Confirm Info

- Client reviews:
  - Name.
  - Contact info.
  - Property address.
- If something is wrong, they can request a correction.

## Step 4 — Upload ID

- Client uploads a clear photo of their ID.
- System validates format and stores securely.

## Step 5 — Sign Documents

- Once Legal AI prepares documents, client sees:
  - "Review & Sign" button.
- Client signs electronically.
- System marks case as "DOCS_SIGNED".

## Step 6 — Filing & Waiting

- Client sees status:
  - "Filed"
  - "Awaiting Funds"
- They receive occasional updates.

## Step 7 — Payout

- Once funds are received and processed:
  - Client sees "Paid" status.
  - Client receives payout.
  - Case is closed.
