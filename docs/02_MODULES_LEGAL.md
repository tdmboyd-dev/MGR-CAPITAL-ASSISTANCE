# Legal AI Module — MGR Capital Assistance

The Legal AI Module is the core intelligence layer that handles all legal logic, document generation, compliance, and filing workflows across all 50 states and their counties.

## 1. Responsibilities

### 1.1 Multi-State Legal Intelligence
The Legal AI must:
- Understand state statutes related to tax sales, sheriff sales, foreclosure surplus, and excess proceeds.
- Understand county-level filing requirements.
- Track redemption periods.
- Track deadlines for claims.
- Track required affidavits, notarizations, and supporting documents.
- Track acceptable filing methods (mail, e-file, in-person, email).

### 1.2 Document Generation
The Legal AI generates:
- Motions to claim funds.
- Affidavits of entitlement.
- Limited Power of Attorney (LPOA).
- Client service agreements.
- Filing cover letters.
- Evidence packets.
- Follow-up letters to courts.
- Lienholder notices (if required).

Documents must:
- Be formatted correctly for each county.
- Include correct statutory references.
- Include correct case numbers.
- Include correct attachments.

### 1.3 Filing Workflow
The Legal AI must:
- Determine the correct filing method.
- Prepare the packet for that method.
- Trigger the backend to send filings via:
  - Email
  - E-filing portal
  - Mail (via integrated mail API)
- Track filing status.
- Track court responses