// ============================================
// DOCUMENT TEMPLATES — MGR CAPITAL ASSISTANCE
// Production-ready templates for all 15 document types
// ============================================

export interface DocumentTemplateData {
  type: string;
  name: string;
  description: string;
  content: string;
  requiredFields: string[];
}

export const DOCUMENT_TEMPLATES: DocumentTemplateData[] = [
  // ============================================
  // 1. CLIENT SERVICE AGREEMENT
  // ============================================
  {
    type: "CLIENT_SERVICE_AGREEMENT",
    name: "Client Service Agreement",
    description: "Agreement between MGR Capital Assistance and client for surplus fund recovery services",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "CLIENT_PHONE",
      "CLIENT_EMAIL",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "SALE_DATE",
      "FEE_PERCENT",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `CLIENT SERVICE AGREEMENT

Agreement Number: {{CASE_NUMBER}}
Date: {{TODAY_DATE}}

PARTIES

This Client Service Agreement ("Agreement") is entered into between:

MGR CAPITAL ASSISTANCE ("Company")
[Company Address]

AND

{{CLIENT_NAME}} ("Client")
{{CLIENT_ADDRESS}}
{{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}
Phone: {{CLIENT_PHONE}}
Email: {{CLIENT_EMAIL}}

RECITALS

WHEREAS, Client is or was the owner of record of real property located at:

{{PROPERTY_ADDRESS}}
{{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}

WHEREAS, said property was sold at a tax sale on or about {{SALE_DATE}};

WHEREAS, there may exist surplus funds resulting from said sale that Client may be entitled to claim;

WHEREAS, Client desires to engage Company to assist in the research, preparation, and filing of documentation necessary to claim any such surplus funds;

NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:

1. SERVICES

Company agrees to provide the following services on behalf of Client:

a) Research and verify the existence and amount of any surplus funds related to the subject property;
b) Prepare and file all necessary documentation with the appropriate governmental agencies;
c) Communicate with county officials, courts, and other relevant parties;
d) Track the status of any filed claims;
e) Coordinate the disbursement of any recovered funds.

2. COMPENSATION

Client agrees to pay Company a contingency fee equal to {{FEE_PERCENT}}% of any gross funds successfully recovered.

a) No fees are due unless and until funds are actually recovered;
b) Company shall deduct its fee from recovered funds before disbursement to Client;
c) Client is responsible for no upfront costs, retainers, or out-of-pocket expenses.

3. CLIENT RESPONSIBILITIES

Client agrees to:

a) Provide accurate and complete information as requested;
b) Sign all necessary documents in a timely manner;
c) Notify Company of any changes in contact information;
d) Not engage other parties to pursue the same claim.

4. LIMITED POWER OF ATTORNEY

Client grants Company limited power of attorney to:

a) Sign and file documents on Client's behalf related to surplus fund claims;
b) Communicate with governmental agencies regarding Client's claim;
c) Receive notices and correspondence related to the claim.

This power of attorney is limited solely to matters related to surplus fund recovery for the subject property and may be revoked by Client at any time in writing.

5. NO GUARANTEE

Client understands and acknowledges that:

a) Company makes no guarantee that any funds exist or will be recovered;
b) Recovery is subject to applicable laws, deadlines, and governmental decisions;
c) Past performance is not indicative of future results.

6. TERM AND TERMINATION

a) This Agreement remains in effect until the claim is resolved or abandoned;
b) Either party may terminate with 30 days written notice;
c) Upon termination, Client remains responsible for fees on any funds recovered as a result of work performed under this Agreement.

7. CONFIDENTIALITY

Company agrees to maintain the confidentiality of all Client information and not disclose such information to third parties except as necessary to perform services under this Agreement.

8. GOVERNING LAW

This Agreement shall be governed by the laws of the State of {{PROPERTY_STATE}}.

9. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior discussions and agreements.

SIGNATURES

By signing below, the parties agree to be bound by the terms of this Agreement.

CLIENT:

_________________________________
{{CLIENT_NAME}}
Date: _______________

MGR CAPITAL ASSISTANCE:

_________________________________
Authorized Representative
Date: _______________`
  },

  // ============================================
  // 2. LIMITED POWER OF ATTORNEY
  // ============================================
  {
    type: "LIMITED_POA",
    name: "Limited Power of Attorney",
    description: "Grants MGR Capital Assistance authority to act on client's behalf for surplus fund claims",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "CLIENT_DOB",
      "CLIENT_SSN_LAST_4",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `LIMITED POWER OF ATTORNEY

Case Reference: {{CASE_NUMBER}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

KNOW ALL PERSONS BY THESE PRESENTS:

I, {{CLIENT_NAME}}, of {{CLIENT_ADDRESS}}, {{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}, being of sound mind and legal age, do hereby make, constitute, and appoint MGR CAPITAL ASSISTANCE, its officers, agents, and authorized representatives, as my true and lawful Attorney-in-Fact.

PRINCIPAL INFORMATION:
Name: {{CLIENT_NAME}}
Date of Birth: {{CLIENT_DOB}}
Last 4 of SSN: {{CLIENT_SSN_LAST_4}}
Address: {{CLIENT_ADDRESS}}, {{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}

PROPERTY INFORMATION:
Property Address: {{PROPERTY_ADDRESS}}
County: {{PROPERTY_COUNTY}}
State: {{PROPERTY_STATE}}

GRANT OF AUTHORITY

I grant my Attorney-in-Fact the following LIMITED powers, solely in connection with claiming surplus funds or excess proceeds from the tax sale of the above-referenced property:

1. To sign, execute, and file any and all documents, forms, applications, petitions, motions, or other instruments necessary to claim surplus funds on my behalf;

2. To communicate and correspond with county treasurers, tax collectors, clerks of court, state agencies, and any other governmental entities regarding surplus fund claims;

3. To receive and respond to notices, requests for information, and other correspondence related to surplus fund claims;

4. To appear before courts, administrative bodies, or other tribunals in connection with surplus fund claims;

5. To negotiate and settle claims for surplus funds;

6. To receive funds on my behalf, deduct agreed-upon fees per the Client Service Agreement, and disburse the remaining balance to me;

7. To take any and all actions reasonably necessary to accomplish the foregoing purposes.

LIMITATIONS

This Power of Attorney is LIMITED to the specific purposes stated above and does not grant authority to:

- Sell, transfer, or encumber any real property;
- Enter into contracts unrelated to surplus fund recovery;
- Access bank accounts unrelated to surplus fund disbursement;
- Make healthcare or personal decisions;
- Make gifts or donations of my property.

DURATION

This Limited Power of Attorney shall become effective immediately upon execution and shall remain in effect until:

a) The surplus fund claim is fully resolved and all funds disbursed; or
b) I revoke this power in writing; or
c) Five (5) years from the date of execution, whichever occurs first.

THIRD-PARTY RELIANCE

I hereby declare that any third party who receives a copy of this document may act under it. Any third party may rely upon the representations of my Attorney-in-Fact regarding the scope of authority granted. No third party shall be liable to me for acting in good faith reliance on this Power of Attorney.

GOVERNING LAW

This Limited Power of Attorney shall be governed by and construed in accordance with the laws of the State of {{PROPERTY_STATE}}.

IN WITNESS WHEREOF, I have executed this Limited Power of Attorney on {{TODAY_DATE}}.

PRINCIPAL:

_________________________________
{{CLIENT_NAME}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

Before me, the undersigned notary public, on this _____ day of _____________, 20___, personally appeared {{CLIENT_NAME}}, known to me (or proved to me on the basis of satisfactory evidence) to be the person whose name is subscribed to this instrument, and acknowledged that they executed it.

_________________________________
Notary Public
My Commission Expires: _______________

[NOTARY SEAL]`
  },

  // ============================================
  // 3. AFFIDAVIT
  // ============================================
  {
    type: "AFFIDAVIT",
    name: "Affidavit of Ownership and Claim",
    description: "Sworn statement attesting to ownership and right to claim surplus funds",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `AFFIDAVIT OF OWNERSHIP AND CLAIM FOR SURPLUS FUNDS

Case Reference: {{CASE_NUMBER}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

BEFORE ME, the undersigned notary public, personally appeared {{CLIENT_NAME}} (hereinafter "Affiant"), who being duly sworn, deposes and states as follows:

1. IDENTITY

My name is {{CLIENT_NAME}}. I am over the age of eighteen (18) years and am competent to make this affidavit. I have personal knowledge of the facts stated herein.

2. RESIDENCE

My current address is:
{{CLIENT_ADDRESS}}
{{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}

3. PROPERTY OWNERSHIP

I was the owner of record of the real property located at:

{{PROPERTY_ADDRESS}}
{{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}

(hereinafter "the Property")

4. TAX SALE

The Property was sold at a tax sale conducted on or about {{SALE_DATE}} by {{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}.

5. CLAIM TO SURPLUS FUNDS

I hereby claim any and all surplus funds, excess proceeds, or overages resulting from the tax sale of the Property. I believe I am entitled to such funds as the former owner of record.

6. NO OTHER CLAIMS

To the best of my knowledge:

a) I have not previously received payment of surplus funds from this tax sale;
b) I have not assigned, transferred, or sold my right to claim these surplus funds to any other party;
c) There are no pending legal actions that would affect my right to claim these funds.

7. AUTHORIZATION

I have authorized MGR Capital Assistance to assist me in claiming these surplus funds and have executed a Limited Power of Attorney and Client Service Agreement for this purpose.

8. TRUTH AND ACCURACY

I declare under penalty of perjury that the foregoing statements are true and correct to the best of my knowledge and belief. I understand that making false statements in this affidavit may subject me to criminal penalties.

FURTHER AFFIANT SAYETH NOT.

_________________________________
{{CLIENT_NAME}}, Affiant

Date: {{TODAY_DATE}}

SUBSCRIBED AND SWORN TO before me on this _____ day of _____________, 20___.

_________________________________
Notary Public
State of {{PROPERTY_STATE}}
My Commission Expires: _______________

[NOTARY SEAL]`
  },

  // ============================================
  // 4. MOTION
  // ============================================
  {
    type: "MOTION",
    name: "Motion for Disbursement of Surplus Funds",
    description: "Court motion requesting release of surplus funds to claimant",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "COURT_CASE_NUMBER",
      "PARCEL_NUMBER",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `IN THE {{COURT_TYPE}} COURT OF {{PROPERTY_COUNTY}} COUNTY, {{PROPERTY_STATE}}

Case No.: {{COURT_CASE_NUMBER}}
MGR Reference: {{CASE_NUMBER}}

IN RE: TAX SALE SURPLUS FUNDS

Property Address: {{PROPERTY_ADDRESS}}
Parcel Number: {{PARCEL_NUMBER}}

MOTION FOR DISBURSEMENT OF SURPLUS FUNDS

COMES NOW, {{CLIENT_NAME}} ("Movant"), by and through their authorized representative, MGR Capital Assistance, and respectfully moves this Honorable Court for an Order directing the disbursement of surplus funds from the above-referenced tax sale, and in support thereof states as follows:

I. INTRODUCTION

1. This Motion seeks the disbursement of surplus funds resulting from the tax sale of real property formerly owned by Movant.

2. Movant is entitled to receive these surplus funds as the former owner of record of the subject property.

II. FACTUAL BACKGROUND

3. Movant was the owner of record of real property located at {{PROPERTY_ADDRESS}}, {{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}, Parcel Number {{PARCEL_NUMBER}} (the "Property").

4. On or about {{SALE_DATE}}, the Property was sold at a tax sale conducted by {{PROPERTY_COUNTY}} County.

5. The tax sale resulted in surplus funds in excess of the taxes, penalties, interest, and costs owed.

6. These surplus funds are currently held by the [Clerk of Court / County Treasurer / Tax Collector] pending disbursement.

III. LEGAL ARGUMENT

7. Under [applicable state statute], surplus funds from a tax sale shall be paid to the former owner of the property sold, after satisfaction of all liens and encumbrances.

8. Movant has established their identity and ownership interest through the attached Affidavit of Ownership and supporting documentation.

9. Movant has complied with all applicable requirements for claiming surplus funds.

10. There are no competing claims or liens against these surplus funds that would take priority over Movant's claim.

IV. CONCLUSION

WHEREFORE, Movant respectfully requests that this Honorable Court:

A. Grant this Motion;

B. Enter an Order directing the disbursement of all surplus funds from the above-referenced tax sale to Movant;

C. Authorize disbursement to MGR Capital Assistance on behalf of Movant pursuant to the Limited Power of Attorney on file;

D. Grant such other and further relief as the Court deems just and proper.

Respectfully submitted this {{TODAY_DATE}}.

_________________________________
MGR CAPITAL ASSISTANCE
As authorized representative for {{CLIENT_NAME}}

Contact Information:
[Company Address]
[Phone]
[Email]

CERTIFICATE OF SERVICE

I hereby certify that a true and correct copy of the foregoing Motion has been served upon all parties of record by [method of service] on this _____ day of _____________, 20___.

_________________________________`
  },

  // ============================================
  // 5. COVER LETTER
  // ============================================
  {
    type: "COVER_LETTER",
    name: "Cover Letter for Surplus Fund Claim",
    description: "Professional cover letter accompanying surplus fund claim submission",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "CLERK_NAME",
      "CLERK_ADDRESS",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER",
      "DOCUMENTS_LIST"
    ],
    content: `[MGR CAPITAL ASSISTANCE LETTERHEAD]

{{TODAY_DATE}}

{{CLERK_NAME}}
{{PROPERTY_COUNTY}} County Clerk
{{CLERK_ADDRESS}}

RE: Claim for Surplus Funds
    Property: {{PROPERTY_ADDRESS}}
    Former Owner: {{CLIENT_NAME}}
    Tax Sale Date: {{SALE_DATE}}
    Reference: {{CASE_NUMBER}}

Dear {{CLERK_NAME}}:

We are writing on behalf of our client, {{CLIENT_NAME}}, to submit a claim for surplus funds resulting from the tax sale of the above-referenced property.

ENCLOSED DOCUMENTS

Please find enclosed the following documents in support of this claim:

{{DOCUMENTS_LIST}}

CLIENT INFORMATION

Our client, {{CLIENT_NAME}}, was the owner of record of the property located at {{PROPERTY_ADDRESS}}, {{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}, at the time of the tax sale conducted on {{SALE_DATE}}.

REQUEST

We respectfully request that you:

1. Process this claim for surplus funds in accordance with applicable law;
2. Verify the amount of surplus funds available;
3. Issue payment to MGR Capital Assistance on behalf of {{CLIENT_NAME}} as authorized in the enclosed Limited Power of Attorney;
4. Contact our office with any questions or if additional documentation is required.

CONTACT INFORMATION

Please direct all correspondence and inquiries to:

MGR Capital Assistance
[Company Address]
Phone: [Phone Number]
Email: [Email Address]
Reference: {{CASE_NUMBER}}

Thank you for your attention to this matter. We look forward to your prompt response.

Respectfully,

_________________________________
MGR Capital Assistance
Authorized Representative

Enclosures: As noted above`
  },

  // ============================================
  // 6. FILING PACKET
  // ============================================
  {
    type: "FILING_PACKET",
    name: "Complete Filing Packet Checklist",
    description: "Comprehensive checklist and cover sheet for complete surplus fund filing",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER",
      "REQUIRED_DOCUMENTS"
    ],
    content: `SURPLUS FUND CLAIM FILING PACKET

Case Reference: {{CASE_NUMBER}}
Prepared: {{TODAY_DATE}}

═══════════════════════════════════════════════════════════════

CASE INFORMATION

Client Name: {{CLIENT_NAME}}
Property Address: {{PROPERTY_ADDRESS}}
County: {{PROPERTY_COUNTY}}
State: {{PROPERTY_STATE}}
Tax Sale Date: {{SALE_DATE}}

═══════════════════════════════════════════════════════════════

FILING CHECKLIST

Required Documents:

{{REQUIRED_DOCUMENTS}}

□ Client Service Agreement (signed)
□ Limited Power of Attorney (signed and notarized)
□ Affidavit of Ownership (signed and notarized)
□ Cover Letter
□ Copy of Government-Issued ID
□ Proof of Address
□ Property Deed or Title Documentation
□ Tax Sale Notice (if available)

Additional Documents (if applicable):

□ Court Motion (for court filing jurisdictions)
□ Probate Documentation (for heir claims)
□ Corporate Resolution (for entity claims)
□ Death Certificate (for estate claims)
□ Letters of Administration
□ Heir Affidavit

═══════════════════════════════════════════════════════════════

FILING INSTRUCTIONS

1. Verify all documents are signed and notarized where required
2. Make copies of all documents for your records
3. Submit to the appropriate office as indicated below
4. Request a stamped copy or receipt for your records
5. Note the submission date and any tracking information

SUBMISSION INFORMATION

Filing Location: [County Office Address]
Filing Method: [Mail/In-Person/Electronic]
Filing Fee: [Fee Amount] (if applicable)

═══════════════════════════════════════════════════════════════

INTERNAL TRACKING

Date Prepared: {{TODAY_DATE}}
Prepared By: _______________
Reviewed By: _______________
Date Submitted: _______________
Submission Method: _______________
Tracking Number: _______________
Follow-up Date: _______________

═══════════════════════════════════════════════════════════════

NOTES

_______________________________________________________________
_______________________________________________________________
_______________________________________________________________`
  },

  // ============================================
  // 7. EVIDENCE PACKET
  // ============================================
  {
    type: "EVIDENCE_PACKET",
    name: "Evidence and Supporting Documentation Packet",
    description: "Compiled evidence supporting ownership and claim to surplus funds",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "PARCEL_NUMBER",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `EVIDENCE PACKET — SURPLUS FUND CLAIM

Case Reference: {{CASE_NUMBER}}
Date Compiled: {{TODAY_DATE}}

═══════════════════════════════════════════════════════════════

CLAIM SUMMARY

Claimant: {{CLIENT_NAME}}
Property: {{PROPERTY_ADDRESS}}
Parcel Number: {{PARCEL_NUMBER}}
County: {{PROPERTY_COUNTY}}
State: {{PROPERTY_STATE}}
Tax Sale Date: {{SALE_DATE}}

═══════════════════════════════════════════════════════════════

TABLE OF CONTENTS

Exhibit A — Identity Verification
Exhibit B — Proof of Ownership
Exhibit C — Tax Sale Documentation
Exhibit D — Chain of Title
Exhibit E — Additional Supporting Documents

═══════════════════════════════════════════════════════════════

EXHIBIT A — IDENTITY VERIFICATION

1. Government-Issued Photo ID
   Type: _______________
   ID Number: _______________
   Expiration: _______________

2. Proof of Current Address
   Document Type: _______________
   Date: _______________

3. Social Security Verification (last 4 digits)
   Last 4: _______________

═══════════════════════════════════════════════════════════════

EXHIBIT B — PROOF OF OWNERSHIP

1. Property Deed
   Recording Date: _______________
   Book/Page: _______________
   Document Number: _______________

2. Property Tax Records
   Tax Year(s): _______________
   Owner Name on Records: _______________

3. Title Search Results (if obtained)
   Date of Search: _______________
   Title Company: _______________

═══════════════════════════════════════════════════════════════

EXHIBIT C — TAX SALE DOCUMENTATION

1. Tax Sale Notice
   Date of Notice: _______________
   Method of Service: _______________

2. Tax Sale Certificate
   Certificate Number: _______________
   Sale Date: _______________
   Sale Amount: _______________

3. Tax Deed (if issued)
   Recording Date: _______________
   Grantee: _______________

═══════════════════════════════════════════════════════════════

EXHIBIT D — CHAIN OF TITLE

Timeline of Ownership:

Date: _______________
Event: _______________
Parties: _______________

[Additional entries as needed]

═══════════════════════════════════════════════════════════════

EXHIBIT E — ADDITIONAL SUPPORTING DOCUMENTS

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

═══════════════════════════════════════════════════════════════

CERTIFICATION

I certify that the documents contained in this Evidence Packet are true and correct copies of the originals and are submitted in support of the surplus fund claim for the above-referenced property.

_________________________________
MGR Capital Assistance
Date: {{TODAY_DATE}}`
  },

  // ============================================
  // 8. FOLLOW-UP LETTER
  // ============================================
  {
    type: "FOLLOW_UP_LETTER",
    name: "Follow-Up Letter",
    description: "Professional follow-up letter to inquire about claim status",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "CLERK_NAME",
      "CLERK_ADDRESS",
      "ORIGINAL_SUBMISSION_DATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `[MGR CAPITAL ASSISTANCE LETTERHEAD]

{{TODAY_DATE}}

{{CLERK_NAME}}
{{PROPERTY_COUNTY}} County Clerk
{{CLERK_ADDRESS}}

RE: Status Inquiry — Surplus Fund Claim
    Property: {{PROPERTY_ADDRESS}}
    Former Owner: {{CLIENT_NAME}}
    Original Submission Date: {{ORIGINAL_SUBMISSION_DATE}}
    Reference: {{CASE_NUMBER}}

Dear {{CLERK_NAME}}:

We are writing to follow up on the surplus fund claim we submitted on behalf of our client, {{CLIENT_NAME}}, on {{ORIGINAL_SUBMISSION_DATE}}.

CLAIM DETAILS

Client: {{CLIENT_NAME}}
Property: {{PROPERTY_ADDRESS}}
County: {{PROPERTY_COUNTY}}, {{PROPERTY_STATE}}
Our Reference: {{CASE_NUMBER}}

REQUEST FOR STATUS UPDATE

We respectfully request an update on the status of this claim, including:

1. Confirmation that all required documentation has been received;
2. The current status of the claim review;
3. Any additional information or documentation needed;
4. Estimated timeline for processing and disbursement.

If any additional information is required to process this claim, please contact our office immediately at the information provided below.

CONTACT INFORMATION

MGR Capital Assistance
[Company Address]
Phone: [Phone Number]
Email: [Email Address]
Reference: {{CASE_NUMBER}}

Thank you for your attention to this matter. We appreciate your prompt response.

Respectfully,

_________________________________
MGR Capital Assistance
Authorized Representative`
  },

  // ============================================
  // 9. VERIFICATION LETTER
  // ============================================
  {
    type: "VERIFICATION_LETTER",
    name: "Verification Request Letter",
    description: "Letter requesting verification of surplus fund existence and amount",
    requiredFields: [
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "PARCEL_NUMBER",
      "CLERK_NAME",
      "CLERK_ADDRESS",
      "SALE_DATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `[MGR CAPITAL ASSISTANCE LETTERHEAD]

{{TODAY_DATE}}

{{CLERK_NAME}}
{{PROPERTY_COUNTY}} County
{{CLERK_ADDRESS}}

RE: Verification of Surplus Funds
    Property: {{PROPERTY_ADDRESS}}
    Parcel Number: {{PARCEL_NUMBER}}
    Tax Sale Date: {{SALE_DATE}}
    Reference: {{CASE_NUMBER}}

Dear {{CLERK_NAME}}:

We are writing to verify the existence and amount of any surplus funds resulting from the tax sale of the above-referenced property.

PROPERTY INFORMATION

Property Address: {{PROPERTY_ADDRESS}}
Parcel Number: {{PARCEL_NUMBER}}
County: {{PROPERTY_COUNTY}}
State: {{PROPERTY_STATE}}
Approximate Tax Sale Date: {{SALE_DATE}}

REQUEST FOR INFORMATION

We respectfully request verification of the following:

1. Whether surplus funds exist from the tax sale of this property;
2. The current amount of surplus funds available;
3. The claim deadline for these funds;
4. Required documentation for filing a claim;
5. Any other relevant information about the claim process.

We represent potential claimants and are conducting due diligence before proceeding with a formal claim submission.

RESPONSE REQUEST

Please respond to this inquiry at your earliest convenience. You may contact us at:

MGR Capital Assistance
[Company Address]
Phone: [Phone Number]
Email: [Email Address]
Reference: {{CASE_NUMBER}}

Thank you for your assistance.

Respectfully,

_________________________________
MGR Capital Assistance`
  },

  // ============================================
  // 10. PAYMENT INSTRUCTIONS
  // ============================================
  {
    type: "PAYMENT_INSTRUCTIONS",
    name: "Payment and Disbursement Instructions",
    description: "Instructions for receiving and processing surplus fund payments",
    requiredFields: [
      "CLIENT_NAME",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "CLERK_NAME",
      "CLERK_ADDRESS",
      "TODAY_DATE",
      "CASE_NUMBER",
      "COMPANY_BANK_NAME",
      "COMPANY_ACCOUNT_NAME",
      "COMPANY_ROUTING_NUMBER",
      "COMPANY_ACCOUNT_NUMBER"
    ],
    content: `[MGR CAPITAL ASSISTANCE LETTERHEAD]

{{TODAY_DATE}}

{{CLERK_NAME}}
{{PROPERTY_COUNTY}} County
{{CLERK_ADDRESS}}

RE: Payment Disbursement Instructions
    Property: {{PROPERTY_ADDRESS}}
    Former Owner: {{CLIENT_NAME}}
    Reference: {{CASE_NUMBER}}

Dear {{CLERK_NAME}}:

In connection with the approved surplus fund claim for the above-referenced property, please find below the payment disbursement instructions.

PAYEE INFORMATION

Pursuant to the Limited Power of Attorney on file, please issue payment to:

Payee Name: MGR Capital Assistance
Reference: {{CASE_NUMBER}} / {{CLIENT_NAME}}

PAYMENT METHOD OPTIONS

Option 1 — Check Payment:

Please make check payable to:
MGR Capital Assistance

Mail to:
[Company Address]

Option 2 — Electronic Transfer (ACH):

Bank Name: {{COMPANY_BANK_NAME}}
Account Name: {{COMPANY_ACCOUNT_NAME}}
Routing Number: {{COMPANY_ROUTING_NUMBER}}
Account Number: {{COMPANY_ACCOUNT_NUMBER}}
Reference: {{CASE_NUMBER}}

AUTHORIZATION

The enclosed Limited Power of Attorney authorizes MGR Capital Assistance to receive payment on behalf of {{CLIENT_NAME}}. A copy of the executed POA is attached for your reference.

CONFIRMATION REQUEST

Upon disbursement, please provide:

1. Confirmation of payment amount
2. Payment date
3. Check number or transaction reference
4. Any required tax documentation (1099, etc.)

CONTACT INFORMATION

MGR Capital Assistance
[Company Address]
Phone: [Phone Number]
Email: [Email Address]
Reference: {{CASE_NUMBER}}

Thank you for your cooperation in processing this disbursement.

Respectfully,

_________________________________
MGR Capital Assistance

Enclosure: Limited Power of Attorney`
  },

  // ============================================
  // 11. W-9 FORM (IRS Tax Identification)
  // ============================================
  {
    type: "W9_FORM",
    name: "IRS W-9 Request for Taxpayer Identification",
    description: "W-9 form for IRS reporting of surplus fund disbursements — required for 1099 compliance",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "CLIENT_SSN_LAST_4",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `W-9 REQUEST FOR TAXPAYER IDENTIFICATION NUMBER AND CERTIFICATION

Case Reference: {{CASE_NUMBER}}
Date: {{TODAY_DATE}}

IMPORTANT: This form is used to collect taxpayer information required by the Internal Revenue Service (IRS) for surplus fund disbursements. The paying county/court may issue a 1099-MISC for amounts over $600.

═══════════════════════════════════════════════════════════════

PART I — TAXPAYER IDENTIFICATION

1. Name (as shown on your income tax return):

   {{CLIENT_NAME}}

2. Business name/disregarded entity name (if different from above):

   _______________________________________________________________

3. Tax Classification (check one):
   □ Individual/Sole proprietor
   □ C Corporation
   □ S Corporation
   □ Partnership
   □ Trust/estate
   □ LLC (classified as: ___________)
   □ Other: _______________

4. Address:
   {{CLIENT_ADDRESS}}
   {{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}

5. Taxpayer Identification Number (TIN):
   Social Security Number: XXX-XX-{{CLIENT_SSN_LAST_4}}
   OR
   Employer Identification Number: _______________

═══════════════════════════════════════════════════════════════

PART II — CERTIFICATION

Under penalties of perjury, I certify that:

1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and

2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the IRS that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and

3. I am a U.S. citizen or other U.S. person (defined below); and

4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.

═══════════════════════════════════════════════════════════════

SIGNATURE

_________________________________
{{CLIENT_NAME}}
Date: {{TODAY_DATE}}

═══════════════════════════════════════════════════════════════

INTERNAL USE ONLY — MGR CAPITAL ASSISTANCE

Received Date: _______________
Verified By: _______________
Filed With: _______________
1099 Required: □ Yes  □ No
Amount: $_______________`
  },

  // ============================================
  // 12. SCRA DECLARATION
  // ============================================
  {
    type: "SCRA_DECLARATION",
    name: "Servicemembers Civil Relief Act Declaration",
    description: "SCRA declaration required for court filings involving non-appearing respondents — verifies military service status",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "CLIENT_DOB",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "COURT_CASE_NUMBER",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `DECLARATION UNDER THE SERVICEMEMBERS CIVIL RELIEF ACT (SCRA)
50 U.S.C. §§ 3901 et seq.

Case Reference: {{CASE_NUMBER}}
Court Case No.: {{COURT_CASE_NUMBER}}

IN THE COURT OF {{PROPERTY_COUNTY}} COUNTY, {{PROPERTY_STATE}}

═══════════════════════════════════════════════════════════════

DECLARATION

I, the undersigned, hereby declare under penalty of perjury:

1. PARTIES IDENTIFIED

This declaration is made in connection with a claim for surplus funds related to property located at:

   {{PROPERTY_ADDRESS}}
   {{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}

2. MILITARY SERVICE VERIFICATION

Pursuant to Section 3931 of the Servicemembers Civil Relief Act (50 U.S.C. § 3931), I have conducted a search of the Department of Defense Manpower Data Center (DMDC) database to determine whether the following party/parties are in active military service:

   Name: {{CLIENT_NAME}}
   Date of Birth: {{CLIENT_DOB}}
   Address: {{CLIENT_ADDRESS}}, {{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}

3. SEARCH RESULTS

Based on my search of the DMDC database conducted on {{TODAY_DATE}}:

   □ The above-named individual IS NOT currently in active military service
   □ The above-named individual IS currently in active military service
   □ Military status could NOT be determined

4. SCRA STATUS CERTIFICATE

DMDC Certificate Number: _______________
Date of Certificate: _______________

5. IMPLICATIONS

If the party is in active military service, the provisions of the SCRA apply, including but not limited to:
a) A stay of proceedings upon request
b) Default judgment protections under § 3931
c) Interest rate limitations under § 3937
d) Protection of property under § 3953

6. VERIFICATION

I have made a good faith effort to determine the military service status of the above-named individual and state that the information provided above is true and correct to the best of my knowledge.

═══════════════════════════════════════════════════════════════

DECLARANT

_________________________________
MGR Capital Assistance
Authorized Representative
Date: {{TODAY_DATE}}

═══════════════════════════════════════════════════════════════

ATTACHMENT: DMDC Certificate (to be attached)

NOTE: This declaration is required under 50 U.S.C. § 3931(b)(1) before any court may enter a default judgment. The DMDC database is available at https://scra.dmdc.osd.mil/`
  },

  // ============================================
  // 13. RELEASE OF LIABILITY
  // ============================================
  {
    type: "RELEASE_OF_LIABILITY",
    name: "Release of Liability and Indemnification",
    description: "Release of liability required by some counties before disbursing surplus funds — protects county from future claims",
    requiredFields: [
      "CLIENT_NAME",
      "CLIENT_ADDRESS",
      "CLIENT_CITY",
      "CLIENT_STATE",
      "CLIENT_ZIP",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "PARCEL_NUMBER",
      "SALE_DATE",
      "SURPLUS_AMOUNT",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `RELEASE OF LIABILITY AND INDEMNIFICATION AGREEMENT

Case Reference: {{CASE_NUMBER}}

═══════════════════════════════════════════════════════════════

PARTIES

This Release of Liability and Indemnification Agreement ("Release") is entered into by:

RELEASOR:
{{CLIENT_NAME}}
{{CLIENT_ADDRESS}}
{{CLIENT_CITY}}, {{CLIENT_STATE}} {{CLIENT_ZIP}}

RELEASEE:
{{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}
(including its officers, employees, agents, and successors)

═══════════════════════════════════════════════════════════════

RECITALS

WHEREAS, real property located at {{PROPERTY_ADDRESS}}, Parcel Number {{PARCEL_NUMBER}}, {{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}} (the "Property"), was sold at a tax sale on or about {{SALE_DATE}};

WHEREAS, said tax sale resulted in surplus funds in the approximate amount of ${"$"}{{SURPLUS_AMOUNT}} (the "Surplus Funds");

WHEREAS, Releasor has submitted a claim for said Surplus Funds and the claim has been approved for payment;

WHEREAS, Releasee requires this Release as a condition of disbursement;

NOW, THEREFORE, in consideration of the disbursement of the Surplus Funds, Releasor agrees as follows:

═══════════════════════════════════════════════════════════════

TERMS

1. RELEASE

Releasor hereby releases, acquits, and forever discharges Releasee from any and all claims, demands, damages, actions, causes of action, or suits of any kind or nature whatsoever, which Releasor now has or may hereafter have, arising out of or in any way connected with:

a) The tax sale of the Property;
b) The collection, holding, or disbursement of the Surplus Funds;
c) Any interest, penalties, or fees associated with the Surplus Funds;
d) Any actions or omissions by Releasee in connection with the above.

2. INDEMNIFICATION

Releasor agrees to indemnify, defend, and hold harmless Releasee from and against any and all claims, losses, damages, liabilities, judgments, costs, and expenses (including reasonable attorneys' fees) arising from:

a) Any claim by a third party to the Surplus Funds;
b) Any inaccuracy in the representations made by Releasor;
c) Any breach of this Release.

3. REPRESENTATIONS

Releasor represents and warrants that:

a) Releasor is the rightful claimant to the Surplus Funds;
b) Releasor has not assigned, transferred, or encumbered the right to claim the Surplus Funds;
c) To the best of Releasor's knowledge, no other person or entity has a superior or competing claim to the Surplus Funds;
d) Releasor has full authority to execute this Release.

4. ENTIRE AGREEMENT

This Release constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements and understandings.

5. GOVERNING LAW

This Release shall be governed by the laws of the State of {{PROPERTY_STATE}}.

6. BINDING EFFECT

This Release shall be binding upon and inure to the benefit of the parties and their respective heirs, successors, and assigns.

═══════════════════════════════════════════════════════════════

SIGNATURES

RELEASOR:

_________________________________
{{CLIENT_NAME}}
Date: {{TODAY_DATE}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

Before me, the undersigned notary public, on this _____ day of _____________, 20___, personally appeared {{CLIENT_NAME}}, known to me to be the person whose name is subscribed to this instrument, and acknowledged that they executed it.

_________________________________
Notary Public
My Commission Expires: _______________

[NOTARY SEAL]`
  },

  // ============================================
  // 14. SMALL ESTATE AFFIDAVIT
  // ============================================
  {
    type: "SMALL_ESTATE_AFFIDAVIT",
    name: "Small Estate Affidavit",
    description: "Affidavit for estates under state threshold amounts — allows heir claims without full probate",
    requiredFields: [
      "HEIR_NAME",
      "HEIR_ADDRESS",
      "HEIR_CITY",
      "HEIR_STATE",
      "HEIR_ZIP",
      "HEIR_RELATIONSHIP",
      "DECEDENT_NAME",
      "DECEDENT_DOD",
      "DECEDENT_ADDRESS",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "ESTATE_VALUE",
      "STATE_THRESHOLD",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `SMALL ESTATE AFFIDAVIT

Case Reference: {{CASE_NUMBER}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

═══════════════════════════════════════════════════════════════

AFFIDAVIT OF SMALL ESTATE

I, {{HEIR_NAME}}, being duly sworn, state under oath:

1. AFFIANT INFORMATION

Name: {{HEIR_NAME}}
Address: {{HEIR_ADDRESS}}, {{HEIR_CITY}}, {{HEIR_STATE}} {{HEIR_ZIP}}
Relationship to Decedent: {{HEIR_RELATIONSHIP}}

2. DECEDENT INFORMATION

Name of Decedent: {{DECEDENT_NAME}}
Date of Death: {{DECEDENT_DOD}}
Last Known Address: {{DECEDENT_ADDRESS}}
Place of Death: _______________

3. ESTATE QUALIFICATION

The total value of the decedent's personal property estate, less liens and encumbrances, does not exceed the state threshold of ${"$"}{{STATE_THRESHOLD}}.

Estimated total estate value: ${"$"}{{ESTATE_VALUE}}

4. PROPERTY AT ISSUE

The decedent was the owner of record of real property located at:

{{PROPERTY_ADDRESS}}
{{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}

Said property was sold at a tax sale and surplus funds are being held by the county/court.

5. RIGHT TO CLAIM

I am entitled to the surplus funds from the tax sale of the above-described property because:

□ I am the surviving spouse of the decedent
□ I am a child of the decedent
□ I am a parent of the decedent
□ I am a sibling of the decedent
□ Other relationship: {{HEIR_RELATIONSHIP}}

6. NO PROBATE

□ No probate proceeding has been filed for the decedent's estate
□ A probate proceeding was filed but has been closed
□ The estate qualifies for small estate procedures under state law

7. OTHER HEIRS

To the best of my knowledge, the following persons may also have an interest in the decedent's estate:

Name: _________________________  Relationship: _______________
Name: _________________________  Relationship: _______________
Name: _________________________  Relationship: _______________

8. DEBTS AND LIABILITIES

To the best of my knowledge:
□ The decedent had no outstanding debts
□ The decedent's outstanding debts have been satisfied
□ The decedent had the following outstanding debts: _______________

9. CERTIFICATION

I declare under penalty of perjury that:

a) At least 30 days have elapsed since the decedent's death;
b) No application or petition for appointment of a personal representative is pending or has been granted in any jurisdiction;
c) The gross value of the decedent's estate does not exceed the statutory threshold;
d) I am entitled to receive the property claimed;
e) All statements made herein are true and correct to the best of my knowledge.

═══════════════════════════════════════════════════════════════

AFFIANT SIGNATURE

_________________________________
{{HEIR_NAME}}
Date: {{TODAY_DATE}}

SUBSCRIBED AND SWORN TO before me on this _____ day of _____________, 20___.

_________________________________
Notary Public
State of {{PROPERTY_STATE}}
My Commission Expires: _______________

[NOTARY SEAL]

═══════════════════════════════════════════════════════════════

ATTACHMENTS REQUIRED:
□ Certified copy of death certificate
□ Proof of relationship to decedent
□ Government-issued photo ID of affiant
□ Proof of property ownership by decedent`
  },

  // ============================================
  // 15. HEIRSHIP / PEDIGREE CHART
  // ============================================
  {
    type: "HEIRSHIP_CHART",
    name: "Heirship Affidavit and Pedigree Chart",
    description: "Visual heir relationship diagram with sworn attestation — required for court filings involving heir claims",
    requiredFields: [
      "DECEDENT_NAME",
      "DECEDENT_DOD",
      "DECEDENT_DOB",
      "DECEDENT_ADDRESS",
      "HEIR_NAME",
      "HEIR_RELATIONSHIP",
      "PROPERTY_ADDRESS",
      "PROPERTY_COUNTY",
      "PROPERTY_STATE",
      "TODAY_DATE",
      "CASE_NUMBER"
    ],
    content: `AFFIDAVIT OF HEIRSHIP AND PEDIGREE CHART

Case Reference: {{CASE_NUMBER}}

STATE OF {{PROPERTY_STATE}}
COUNTY OF {{PROPERTY_COUNTY}}

═══════════════════════════════════════════════════════════════

AFFIDAVIT OF HEIRSHIP

I, {{HEIR_NAME}}, being of legal age and duly sworn, depose and say:

1. DECEDENT INFORMATION

Full Legal Name: {{DECEDENT_NAME}}
Date of Birth: {{DECEDENT_DOB}}
Date of Death: {{DECEDENT_DOD}}
Last Known Address: {{DECEDENT_ADDRESS}}
Place of Death: _______________

2. MARITAL HISTORY

The decedent was:
□ Married at time of death to: _______________
□ Divorced (date of divorce: _______________)
□ Widowed (date of spouse's death: _______________)
□ Never married

Previous marriages:
Spouse: _______________  Dates: _______________ to _______________
Spouse: _______________  Dates: _______________ to _______________

3. CHILDREN OF THE DECEDENT

The decedent had the following children (natural and adopted):

Name: _______________  DOB: _______________  □ Living  □ Deceased
Name: _______________  DOB: _______________  □ Living  □ Deceased
Name: _______________  DOB: _______________  □ Living  □ Deceased
Name: _______________  DOB: _______________  □ Living  □ Deceased

4. PARENTS OF THE DECEDENT

Father: _______________  □ Living  □ Deceased
Mother: _______________  □ Living  □ Deceased

5. SIBLINGS OF THE DECEDENT

Name: _______________  □ Living  □ Deceased
Name: _______________  □ Living  □ Deceased
Name: _______________  □ Living  □ Deceased

═══════════════════════════════════════════════════════════════

PEDIGREE CHART

                        ┌── [Father's Father]
              ┌── [Father] ──┤
              │         └── [Father's Mother]
[DECEDENT] ──┤
              │         ┌── [Mother's Father]
              └── [Mother] ──┤
                        └── [Mother's Mother]

DECEDENT'S DESCENDANTS:

{{DECEDENT_NAME}} (Deceased: {{DECEDENT_DOD}})
├── [Child 1 Name] ({{HEIR_RELATIONSHIP}})
│   ├── [Grandchild 1]
│   └── [Grandchild 2]
├── [Child 2 Name]
└── [Child 3 Name]

(Fill in actual names and relationships above)

═══════════════════════════════════════════════════════════════

6. PROPERTY AT ISSUE

{{PROPERTY_ADDRESS}}
{{PROPERTY_COUNTY}} County, {{PROPERTY_STATE}}

7. WILL STATUS

□ The decedent died intestate (without a will)
□ The decedent left a will dated _______________
□ Will status unknown

8. AFFIANT'S RELATIONSHIP

I, {{HEIR_NAME}}, am the {{HEIR_RELATIONSHIP}} of the decedent.

9. TRUTH AND ACCURACY

I declare under penalty of perjury that the facts stated in this affidavit, including the family tree/pedigree chart, are true and correct to the best of my knowledge and belief.

═══════════════════════════════════════════════════════════════

AFFIANT SIGNATURE

_________________________________
{{HEIR_NAME}}
Date: {{TODAY_DATE}}

CORROBORATING WITNESS (non-heir):

I, ___________________________, personally knew {{DECEDENT_NAME}} and confirm the family relationships described above are accurate to the best of my knowledge.

_________________________________
Witness Name: _______________
Address: _______________
Date: _______________

SUBSCRIBED AND SWORN TO before me on this _____ day of _____________, 20___.

_________________________________
Notary Public
State of {{PROPERTY_STATE}}
My Commission Expires: _______________

[NOTARY SEAL]`
  }
];

// ============================================
// TEMPLATE UTILITY FUNCTIONS
// ============================================

export function getTemplate(type: string): DocumentTemplateData | undefined {
  return DOCUMENT_TEMPLATES.find(t => t.type === type);
}

export function generateDocument(
  type: string,
  variables: Record<string, string>
): string | null {
  const template = getTemplate(type);
  if (!template) return null;

  let content = template.content;

  // Replace all placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    content = content.split(placeholder).join(value);
  }

  return content;
}

export function validateTemplateVariables(
  type: string,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = getTemplate(type);
  if (!template) {
    return { valid: false, missing: ["TEMPLATE_NOT_FOUND"] };
  }

  const missing = template.requiredFields.filter(
    field => !variables[field] || variables[field].trim() === ""
  );

  return {
    valid: missing.length === 0,
    missing
  };
}

export function getAllTemplateTypes(): string[] {
  return DOCUMENT_TEMPLATES.map(t => t.type);
}
