# MGR CAPITAL ASSISTANCE — MASTER SPECIFICATION V1 FINAL

**Version:** 1.0.0-FINAL
**Date:** 2026-01-21
**Status:** CANONICAL SOURCE OF TRUTH — IMPLEMENTATION READY
**Audience:** Senior full-stack engineers, AI agents (Claude/Copilot), system architects

---

## TABLE OF CONTENTS

1. Full System Overview
2. Immutable Rules
3. Roles & Access Model
4. Full Database Schema
5. Core Application Flows
6. OPS Layer Architecture
7. Full OPS Routes Specification
8. Document Vault Access Matrix
9. Notification Trigger Map
10. PDF Template Specification
11. Training Intelligence Blueprint
12. Ingestion Intelligence Blueprint
13. Backups Playbook
14. Phase Summary for Copilot

---

## 1. FULL SYSTEM OVERVIEW

### 1.1 What MGR Capital Assistance Is

MGR Capital Assistance is a **tax surplus and tax sale recovery platform** that helps property owners recover unclaimed funds after tax sales. The system operates as a fully sovereign, self-hosted, closed-system enterprise platform.

**Core Functions:**
- Ingests tax sale and surplus data from county sources (CSV, PDF, web scraping)
- Manages case intake, tracking, and client communication
- Generates and manages legal documents (POA, affidavits, claim packets)
- Tracks employee performance with **shadow accounting** (employees see inflated rates, receive half)
- Processes payouts with full audit trails
- Provides an OPS layer for founder-only intelligence, monitoring, and automation

### 1.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 15+ with Prisma ORM |
| Authentication | JWT tokens + bcrypt password hashing |
| PDF Generation | pdfkit (sovereign, no external API) |
| Email | nodemailer + SMTP (sovereign, no SaaS) |
| File Storage | Local filesystem (Document Vault) |

### 1.3 Sovereign Rules

- **No paid SaaS integrations** — No Stripe, Twilio, SendGrid, AWS S3, etc.
- **Everything self-hosted** — Database, storage, email under full control
- **Closed system** — Internal logic never exposed externally
- **Air-gap capable** — System can operate without internet if needed

---

## 2. IMMUTABLE RULES

These rules are **non-negotiable** and must **never** be violated.

### 2.1 Production-Ready Only
- No placeholders, no TODOs, no "example" or "mock" language
- Every file must be implementable and runnable as-is

### 2.2 Shadow Accounting
- Employees see `displayedRatePercent` (inflated commission rates)
- Employees actually receive `actualRatePercent` (exactly half of displayed)
- **NEVER REVEAL TO EMPLOYEES:** surplus amounts, actual rates, fee percentages, founder share
- **NEVER REVEAL TO CLIENTS:** any financial details, backend logic, employee information

### 2.3 Money in Cents
- All monetary values stored as integers representing cents
- Division by 100 only at display time

### 2.4 UTC Timestamps
- All timestamps stored in UTC (ISO 8601 format)
- Conversion to local time only at display time

### 2.5 Sovereign Stack
- No paid SaaS integrations
- Everything self-hosted or open source
- Can operate entirely offline/air-gapped if needed

---

## 3. ROLES & ACCESS MODEL

### 3.1 Role Definitions

| Role | Level | Primary Function |
|------|-------|------------------|
| FOUNDER | 100 | Superuser. Full access to everything including OPS layer. |
| ADMIN | 80 | Administrative access except OPS brain. Cannot see actual rates. |
| HR | 60 | Employee lifecycle: onboarding, training compliance, tier progression. |
| COMPLIANCE | 60 | Audits, risk assessment, flag review, payout compliance. |
| TEAM_LEAD | 40 | Team management: team performance, training oversight. |
| EMPLOYEE | 20 | Works assigned cases, views displayed earnings only. |
| CLIENT | 10 | Reads case status in simple terms, uploads ID, signs documents. |

### 3.2 5-Tier Employee Commission System (Shadow Accounting)

| Tier | Display Name | Displayed Rate | Actual Rate | Override |
|------|--------------|----------------|-------------|----------|
| TIER_1_ASSOCIATE | Associate | 20% | 10% | None |
| TIER_2_SPECIALIST | Specialist | 40% | 20% | None |
| TIER_3_SENIOR_SPECIALIST | Senior Specialist | 60% | 30% | None |
| TIER_4_TEAM_LEADER | Team Leader | 80% | 40% | 10% |
| TIER_5_EXECUTIVE_PARTNER | Executive Partner | 100% | 50% | 20% |

---

## 4. FULL DATABASE SCHEMA

### 4.1 Core Models

#### User
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| email | String (unique) | Login identifier |
| name | String | Display name |
| passwordHash | String | bcrypt hash (cost factor 12) |
| role | UserRole | FOUNDER/ADMIN/HR/COMPLIANCE/TEAM_LEAD/EMPLOYEE/CLIENT |
| employeeTier | EmployeeTier? | For employees: TIER_1 through TIER_5 |
| isActive | Boolean | Account active status |
| teamLeadId | String? | FK to User (for team assignment) |
| createdAt | DateTime | Account creation timestamp |
| lastLoginAt | DateTime? | Last successful login |

#### Case
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| internalId | String (unique) | MGR-2026-XXXXX format |
| publicAccessToken | String (unique) | Client portal access token |
| clientId | String | FK to Client |
| assignedToId | String? | FK to User (assigned employee) |
| state | String | US state code (2 letters) |
| county | String | County name |
| propertyAddress | String | Full property address |
| parcelNumber | String? | Tax parcel ID |
| saleDate | DateTime? | Tax sale date |
| surplusAmountCents | Int | Surplus amount (FOUNDER ONLY) |
| feePercent | Int | Company fee percentage (FOUNDER ONLY) |
| status | CaseStatus | Current lifecycle status |
| priority | CasePriority | HIGH/MEDIUM/LOW |
| createdAt | DateTime | Case creation timestamp |

#### Client
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| name | String | Client full name |
| email | String | Contact email |
| phone | String? | Contact phone |
| address | String? | Street address |
| city | String? | City |
| state | String? | State |
| zipCode | String? | ZIP code |
| idUploaded | Boolean | ID document uploaded |
| idVerified | Boolean | ID verified by staff |

#### Document
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| caseId | String | FK to Case |
| type | DocumentType | SERVICE_AGREEMENT, LIMITED_POA, etc. |
| fileName | String | Original filename |
| filePath | String | Relative path in Document Vault |
| status | DocumentStatus | PENDING/SIGNED/VERIFIED/REJECTED |
| signatureRequired | Boolean | Requires signature |
| signedAt | DateTime? | When signed |
| signatureData | String? | Signature data (base64) |

#### LedgerEntry
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| caseId | String | FK to Case |
| employeeId | String? | FK to User (for commissions) |
| type | LedgerEntryType | CLIENT_PAYOUT/EMPLOYEE_COMMISSION/etc. |
| amountCents | Int | Actual amount in cents |
| displayedAmountCents | Int | Amount shown to employee (shadow) |
| status | LedgerEntryStatus | PENDING/PROCESSING/COMPLETED |

### 4.2 OPS Models

#### OpsInsight
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| botSource | String | Which bot generated |
| insightType | String | Categorization |
| priority | Int | 1-10 priority scale |
| title | String | Short title |
| summary | String | Plain-English summary |
| data | Json | Structured insight data |
| actionRequired | Boolean | Needs founder action |
| acknowledged | Boolean | Founder acknowledged |
| createdAt | DateTime | Insight creation timestamp |

#### WatchAlert
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| type | WatchAlertType | RULE_CHANGE/HIGH_VALUE/etc. |
| severity | WatchAlertSeverity | CRITICAL/HIGH/MEDIUM/LOW |
| title | String | Alert title |
| message | String | Alert details |
| state | String? | Related state |
| county | String? | Related county |
| isResolved | Boolean | Resolution status |
| createdAt | DateTime | Alert creation timestamp |

#### ScrapedItem
| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| sourceType | ScrapedItemType | TAX_SALE/SURPLUS/etc. |
| sourceUrl | String | Source URL |
| state | String? | State |
| county | String? | County |
| rawContent | String | Raw scraped content |
| parsedData | Json? | Structured parsed data |
| reviewStatus | ScrapedItemReviewStatus | PENDING/REVIEWED/etc. |
| createdAt | DateTime | Scrape timestamp |

### 4.3 All Enums

```prisma
enum UserRole {
  FOUNDER
  ADMIN
  HR
  COMPLIANCE
  TEAM_LEAD
  EMPLOYEE
  CLIENT
}

enum EmployeeTier {
  TIER_1_ASSOCIATE
  TIER_2_SPECIALIST
  TIER_3_SENIOR_SPECIALIST
  TIER_4_TEAM_LEADER
  TIER_5_EXECUTIVE_PARTNER
}

enum CaseStatus {
  NEW
  CONTACTED
  DOCS_PENDING
  DOCS_SIGNED
  FILED
  AWAITING_FUNDS
  PAID
  CLOSED
  REJECTED
}

enum CasePriority {
  HIGH
  MEDIUM
  LOW
}

enum DocumentType {
  SERVICE_AGREEMENT
  LIMITED_POA
  AFFIDAVIT
  MOTION
  COVER_LETTER
  FILING_PACKET
  EVIDENCE_PACKET
  CLIENT_ID
  PAYMENT_INSTRUCTIONS
  OTHER
}

enum DocumentStatus {
  PENDING
  SIGNED
  VERIFIED
  REJECTED
}

enum LedgerEntryType {
  CLIENT_PAYOUT
  EMPLOYEE_COMMISSION
  COMPANY_FEE
  FOUNDER_SHARE
  TEAM_LEAD_OVERRIDE
  ADJUSTMENT
  REFUND
}

enum LedgerEntryStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum WatchAlertType {
  RULE_CHANGE
  HIGH_VALUE_CASE
  DEADLINE_WARNING
  SCRAPE_ERROR
  SOURCE_OFFLINE
  ANOMALY_DETECTED
}

enum WatchAlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ScrapedItemType {
  TAX_SALE
  SURPLUS
  UNCLAIMED_PROPERTY
  FORECLOSURE
}

enum ScrapedItemReviewStatus {
  PENDING
  REVIEWED
  CONVERTED
  REJECTED
  DUPLICATE
}
```

---

## 5. CORE APPLICATION FLOWS

### 5.1 Case Lifecycle

```
NEW → CONTACTED → DOCS_PENDING → DOCS_SIGNED → FILED → AWAITING_FUNDS → PAID → CLOSED
```

| Status | Description | Next Action |
|--------|-------------|-------------|
| NEW | Case created from ingestion | Employee contacts client |
| CONTACTED | Initial contact made | Send documents for signature |
| DOCS_PENDING | Documents sent, awaiting signatures | Follow up on document status |
| DOCS_SIGNED | All required documents signed | File claim with county/court |
| FILED | Claim filed with authorities | Monitor for response |
| AWAITING_FUNDS | Claim approved, waiting for disbursement | Track payment |
| PAID | Funds received and distributed | Close case |
| CLOSED | Case closed | Archive |

### 5.2 Payout Calculation Flow

```typescript
Input: {
  surplusAmountCents: 100000,  // $1,000.00
  feePercent: 30,              // 30% fee
  employeeTier: "TIER_3_SENIOR_SPECIALIST"
}

Output: {
  feeAmountCents: 30000,                    // $300 total fee
  clientPayoutCents: 70000,                 // $700 to client
  employeeCommissionCents: 9000,            // $90 actual (30% actual rate)
  employeeDisplayedCommissionCents: 18000,  // $180 displayed (60% displayed rate)
  founderShareCents: 21000                  // $210 founder profit
}
```

### 5.3 Authentication Flow

1. User submits email + password to `POST /api/auth/login`
2. Backend validates credentials with bcrypt.compare()
3. JWT token issued with payload: `{ userId, email, role, tier }`
4. Token stored in localStorage as `token`
5. All API requests include `Authorization: Bearer <token>`
6. `GET /api/auth/me` validates token and returns current user

---

## 6. OPS LAYER ARCHITECTURE

### 6.1 Overview

The OPS Layer is the **founder-only intelligence system** that provides:
- Automated monitoring and analysis
- Proactive issue detection
- Strategic insights and recommendations
- Full system observability

**Access:** FOUNDER ONLY — Never expose to employees or clients.

### 6.2 Bot Network

| Bot | Purpose | Key Functions |
|-----|---------|---------------|
| **IngestionBot** | Monitor data ingestion health | `analyzeIngestionPatterns()`, `detectDuplicates()`, `assessSourceHealth()` |
| **PayoutBot** | Financial monitoring and validation | `validatePayoutMath()`, `detectAnomalies()`, `flagHighValueCases()` |
| **ComplianceBot** | Compliance scanning and risk | `scanDeadlines()`, `validateDocuments()`, `checkTransitions()` |
| **TrainingBot** | Training oversight and gaps | `identifyGaps()`, `correlatePerformance()`, `suggestModules()` |
| **OutreachBot** | Case prioritization | `prioritizeCases()`, `analyzeResponseRates()`, `buildFollowUpQueue()` |
| **DocketBot** | Deadline and court tracking | `trackDeadlines()`, `assessFilingRisk()`, `monitorProceedings()` |
| **CoordinatorBot** | Orchestration | `runFullCycle()`, `generateExecutiveSummary()`, `prioritizeInsights()` |

### 6.3 Bot Output Storage

All bots write to `OpsInsight` table with:
- `botSource`: Which bot generated the insight
- `insightType`: Category (ANOMALY, DEADLINE, PERFORMANCE, etc.)
- `priority`: 1-10 scale (10 = most urgent)
- `title`: Short summary
- `summary`: Plain-English explanation
- `data`: Structured JSON with details
- `actionRequired`: Boolean flag for founder attention

### 6.4 Watch System

The Watch System monitors external changes:
- County rule changes
- Website structure changes
- Source availability
- High-value case alerts
- Deadline warnings

All watch events create `WatchAlert` records.

---

## 7. FULL OPS ROUTES SPECIFICATION

### 7.1 Metrics Routes

#### GET /api/ops/metrics/dashboard
| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve complete OPS dashboard data for FounderConsole |
| **Access** | FOUNDER only |
| **Inputs** | Query: `timeRange` (24h/7d/30d/all, default: 24h) |
| **Outputs** | Dashboard summary, recent activity, alert counts, top metrics |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCases": 1234,
      "activeCases": 456,
      "totalPayoutsCents": 12345678,
      "pendingAlerts": 12,
      "employeeCount": 89
    },
    "recentActivity": {
      "newCases24h": 23,
      "payoutsProcessed24h": 8,
      "alertsCreated24h": 5,
      "documentsUploaded24h": 34
    },
    "topMetrics": {
      "conversionRate": 0.67,
      "avgCaseValueCents": 8500,
      "avgProcessingDays": 45
    },
    "alerts": {
      "critical": 2,
      "high": 5,
      "medium": 8,
      "low": 12
    }
  }
}
```

#### GET /api/ops/metrics/focus-feed
| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve prioritized founder attention items |
| **Access** | FOUNDER only |
| **Inputs** | Query: `limit` (default 20), `includeAcknowledged` (default false) |
| **Outputs** | Array of focus feed items sorted by priority descending |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cuid...",
        "type": "CRITICAL_ALERT",
        "priority": 10,
        "title": "High-value case requires attention",
        "summary": "Case MGR-2026-00123 has $45,000 surplus and approaching deadline",
        "actionRequired": true,
        "source": "WatchAlert",
        "sourceId": "cuid...",
        "createdAt": "2026-01-21T10:30:00Z"
      }
    ],
    "total": 15,
    "unacknowledged": 8
  }
}
```

#### POST /api/ops/metrics/focus-feed/:id/dismiss
| Aspect | Details |
|--------|---------|
| **Purpose** | Dismiss/acknowledge a focus feed item |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id`, Body: `{ notes?: string }` |
| **Outputs** | Updated item with `acknowledged: true` |

#### GET /api/ops/metrics/employees/integrity
| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve employee integrity/performance scores |
| **Access** | FOUNDER only |
| **Inputs** | Query: `limit` (default all), `sortBy` (score/cases/tier) |
| **Outputs** | Per-employee integrity scores, metrics, flags |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "cuid...",
        "name": "John Smith",
        "tier": "TIER_3_SENIOR_SPECIALIST",
        "integrityScore": 92,
        "metrics": {
          "totalCases": 45,
          "closedCases": 38,
          "avgProcessingDays": 32,
          "trainingCompleted": true
        },
        "flags": []
      }
    ]
  }
}
```

#### GET /api/ops/metrics/heatmap
| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve case distribution by jurisdiction |
| **Access** | FOUNDER only |
| **Inputs** | Query: `groupBy` (state/county), `metric` (count/value) |
| **Outputs** | Heatmap data by jurisdiction |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "heatmap": [
      {
        "state": "TX",
        "county": "Harris",
        "caseCount": 156,
        "totalValueCents": 4560000,
        "avgValueCents": 29230,
        "conversionRate": 0.72
      }
    ]
  }
}
```

### 7.2 Watch Routes

#### GET /api/ops/watch/alerts
| Aspect | Details |
|--------|---------|
| **Purpose** | List watch alerts |
| **Access** | FOUNDER only |
| **Inputs** | Query: `severity`, `type`, `resolved`, `limit`, `offset` |
| **Outputs** | Array of WatchAlert records |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "cuid...",
        "type": "RULE_CHANGE",
        "severity": "HIGH",
        "title": "Harris County TX filing deadline changed",
        "message": "Deadline reduced from 180 to 120 days",
        "state": "TX",
        "county": "Harris",
        "isResolved": false,
        "createdAt": "2026-01-21T08:00:00Z"
      }
    ],
    "total": 27,
    "unresolved": 12
  }
}
```

#### POST /api/ops/watch/alerts/:id/resolve
| Aspect | Details |
|--------|---------|
| **Purpose** | Resolve a watch alert |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id`, Body: `{ notes: string }` |
| **Outputs** | Updated alert with `isResolved: true` |

#### POST /api/ops/watch/cycle
| Aspect | Details |
|--------|---------|
| **Purpose** | Run full watch + scrape cycle manually |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ sources?: string[] }` (optional, default all) |
| **Outputs** | Cycle results, new alerts created, errors encountered |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "cycleId": "cycle_20260121_103000",
    "startedAt": "2026-01-21T10:30:00Z",
    "completedAt": "2026-01-21T10:35:23Z",
    "sourcesProcessed": 12,
    "newAlerts": 3,
    "newRecords": 145,
    "errors": []
  }
}
```

#### POST /api/ops/watch/scraper/run
| Aspect | Details |
|--------|---------|
| **Purpose** | Manually trigger scrapers for specific sources |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ sources: string[] }` |
| **Outputs** | Per-source scrape results |

#### GET /api/ops/watch/scraper/status
| Aspect | Details |
|--------|---------|
| **Purpose** | Get scraper status and health |
| **Access** | FOUNDER only |
| **Outputs** | Per-source status, last run time, error count |

### 7.3 System Routes

#### GET /api/ops/system/errors
| Aspect | Details |
|--------|---------|
| **Purpose** | List system errors |
| **Access** | FOUNDER only |
| **Inputs** | Query: `severity`, `resolved`, `limit` |
| **Outputs** | Array of SystemError records with stack traces |

#### POST /api/ops/system/errors/:id/resolve
| Aspect | Details |
|--------|---------|
| **Purpose** | Mark error as resolved |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id`, Body: `{ notes: string }` |

#### POST /api/ops/bots/run
| Aspect | Details |
|--------|---------|
| **Purpose** | Manually run bot cycle |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ bots?: string[] }` (default all) |
| **Outputs** | Per-bot execution results and insights generated |

---

## 8. DOCUMENT VAULT ACCESS MATRIX

### 8.1 Storage Structure

```
backend/storage/documents/
├── {caseId}/
│   ├── SERVICE_AGREEMENT_20260121_143052.pdf
│   ├── LIMITED_POA_20260121_143055.pdf
│   ├── CLIENT_ID_20260121_150023.jpg
│   └── FILING_PACKET_20260122_091530.pdf
```

**Naming Convention:** `{DocumentType}_{YYYYMMDD}_{HHMMSS}.{ext}`

### 8.2 Access Matrix by Role

| Permission | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|------------|:-------:|:-----:|:--:|:----------:|:---------:|:--------:|:------:|
| **Upload** | All | All | - | - | Team cases | Own cases | Own cases |
| **Download** | All | All | - | Read-only | Team cases | Own cases | Own cases |
| **View Metadata** | All | All | - | All | Team cases | Own cases | Own cases |
| **Delete** | All | - | - | - | - | - | - |
| **Verify** | All | All | - | All | - | - | - |
| **Sign** | - | - | - | - | - | - | Own docs |

### 8.3 Access Matrix by Document Type

| Document Type | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|---------------|:-------:|:-----:|:--:|:----------:|:---------:|:--------:|:------:|
| SERVICE_AGREEMENT | Full | Full | - | Read | Team | Own | Own |
| LIMITED_POA | Full | Full | - | Read | Team | Own | Own |
| AFFIDAVIT | Full | Full | - | Read | Team | Own | - |
| MOTION | Full | Full | - | Read | Team | Own | - |
| COVER_LETTER | Full | Full | - | Read | Team | Own | - |
| FILING_PACKET | Full | Full | - | Read | Team | Own | - |
| EVIDENCE_PACKET | Full | Full | - | Read | Team | Own | - |
| CLIENT_ID | Full | Full | - | Read | - | Own | Own |
| PAYMENT_INSTRUCTIONS | Full | Full | - | Read | Team | Own | - |

**Access Levels:**
- **Full**: Upload, download, delete, verify
- **Read**: Download and view metadata only
- **Team**: Access for team member cases only
- **Own**: Access for assigned/own cases only

### 8.4 Security Rules

1. **Path Traversal Prevention**: All file paths validated against base storage directory
2. **MIME Type Validation**: Only allowed file types (PDF, JPG, PNG, DOCX)
3. **File Size Limits**: Maximum 10MB per file, 50MB per case total
4. **Virus Scanning**: Files scanned on upload (if ClamAV available)
5. **Audit Logging**: All access logged to AuditLog table
6. **Encryption at Rest**: Files encrypted with AES-256 (if configured)

### 8.5 Document Routes

| Route | Method | Purpose | Access |
|-------|--------|---------|--------|
| `/api/documents/:caseId/upload` | POST | Upload document to case | Per matrix |
| `/api/documents/:id/download` | GET | Download document file | Per matrix |
| `/api/documents/:id/view` | GET | View document metadata | Per matrix |
| `/api/documents/:id/sign` | PATCH | Sign document | CLIENT only |
| `/api/documents/:id/verify` | PATCH | Verify document | FOUNDER, ADMIN, COMPLIANCE |
| `/api/documents/:id` | DELETE | Delete document | FOUNDER only |
| `/api/documents/case/:caseId` | GET | List case documents | Per matrix |
| `/api/documents/vault/stats` | GET | Vault statistics | FOUNDER only |

---

## 9. NOTIFICATION TRIGGER MAP

### 9.1 Notification Types Overview

| Trigger Event | Recipient | Channel | Template ID |
|---------------|-----------|---------|-------------|
| Case Created | Client | EMAIL | `case_welcome` |
| Documents Ready | Client | EMAIL | `docs_ready` |
| Document Reminder (3 days) | Client | EMAIL | `docs_reminder` |
| Document Reminder (7 days) | Client | EMAIL | `docs_urgent` |
| Case Filed | Client | EMAIL | `case_filed` |
| Payment Received | Client | EMAIL | `payment_received` |
| Case Assigned | Employee | EMAIL | `case_assigned` |
| Training Due | Employee | EMAIL | `training_due` |
| High-Value Case | Founder | INTERNAL | `high_value_alert` |
| Deadline Warning | Founder | INTERNAL | `deadline_warning` |
| System Error | Founder | INTERNAL | `system_error` |

### 9.2 Email Templates

#### case_welcome
```
Subject: Welcome to MGR Capital Assistance - Case #{internalId}

Dear {clientName},

Thank you for choosing MGR Capital Assistance to help you recover your
unclaimed funds. Your case has been created and assigned to a specialist
who will be in contact with you shortly.

Case Reference: {internalId}
Property: {propertyAddress}

You can check your case status anytime at:
{portalUrl}

If you have questions, please reply to this email.

Best regards,
MGR Capital Assistance
```

#### docs_ready
```
Subject: Documents Ready for Signature - Case #{internalId}

Dear {clientName},

The documents for your case are ready for your review and signature.
Please visit your secure client portal to review and sign:

{portalUrl}

Documents awaiting signature:
{documentList}

Please complete within 5 business days to avoid delays.

Best regards,
MGR Capital Assistance
```

#### docs_reminder
```
Subject: Reminder: Documents Awaiting Signature - Case #{internalId}

Dear {clientName},

This is a friendly reminder that we are still awaiting your signature
on the following documents:

{documentList}

Please sign at your earliest convenience:
{portalUrl}

Best regards,
MGR Capital Assistance
```

#### docs_urgent
```
Subject: URGENT: Documents Require Immediate Attention - Case #{internalId}

Dear {clientName},

Your documents have been awaiting signature for 7 days. To avoid
delays in processing your claim, please sign immediately:

{portalUrl}

Documents still pending:
{documentList}

If you have questions or concerns, please contact us immediately.

Best regards,
MGR Capital Assistance
```

#### payment_received
```
Subject: Great News! Your Funds Have Arrived - Case #{internalId}

Dear {clientName},

Congratulations! The funds for your case have been received.

Property: {propertyAddress}
Amount: ${clientPayoutFormatted}

Your payment will be processed within 3-5 business days.

Thank you for trusting MGR Capital Assistance.

Best regards,
MGR Capital Assistance
```

#### case_assigned
```
Subject: New Case Assigned - {internalId}

Hi {employeeName},

You have been assigned a new case:

Case ID: {internalId}
Client: {clientName}
Property: {propertyAddress}
State: {state}, County: {county}
Priority: {priority}

Please contact the client within 24 hours.

View case details in your Employee Office.
```

### 9.3 Notification Service Implementation

```typescript
// backend/src/services/notificationService.ts

interface NotificationPayload {
  type: NotificationType;
  templateId: string;
  recipient: string;
  data: Record<string, string>;
  relatedCaseId?: string;
  relatedUserId?: string;
}

async function sendNotification(payload: NotificationPayload): Promise<void> {
  // 1. Load template
  const template = await loadTemplate(payload.templateId);

  // 2. Render with data
  const rendered = renderTemplate(template, payload.data);

  // 3. Send via channel
  if (payload.type === 'EMAIL') {
    await sendEmail(payload.recipient, rendered.subject, rendered.body);
  } else {
    await createInternalNotification(payload);
  }

  // 4. Log to NotificationLog
  await prisma.notificationLog.create({
    data: {
      type: payload.type,
      recipient: payload.recipient,
      subject: rendered.subject,
      body: rendered.body,
      status: 'SENT',
      sentAt: new Date(),
      relatedCaseId: payload.relatedCaseId,
      relatedUserId: payload.relatedUserId
    }
  });
}
```

### 9.4 SMTP Configuration

```typescript
const transporter = nodemailer.createTransport({
  host: config.smtpHost,      // e.g., 'mail.mgrcapital.com'
  port: config.smtpPort,      // e.g., 587
  secure: config.smtpSecure,  // true for 465, false for 587
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass
  }
});
```

---

## 10. PDF TEMPLATE SPECIFICATION

### 10.1 Template Engine

All PDFs generated using `pdfkit` with consistent styling:
- Font: Helvetica (built-in, no external fonts)
- Page Size: Letter (8.5" x 11")
- Margins: 1 inch all sides (72 points)
- Company letterhead on first page
- Page numbers on multi-page documents

### 10.2 Document Templates

#### SERVICE_AGREEMENT

**Purpose:** Client service contract authorizing MGR Capital to act on their behalf.

**Required Fields:**
| Field | Source | Format |
|-------|--------|--------|
| clientName | Client.name | Title Case |
| clientAddress | Client full address | Multi-line |
| propertyAddress | Case.propertyAddress | Full address |
| state | Case.state | Full state name |
| county | Case.county | County name |
| feePercent | Case.feePercent | "30%" format |
| agreementDate | Generated | "January 21, 2026" |

**Sections:**
1. Parties (MGR Capital Assistance LLC + Client)
2. Property Description
3. Services to be Provided
4. Fee Structure (contingency basis)
5. Term and Termination
6. Governing Law
7. Signatures

**Signature Rules:**
- Client signature required
- Date field required
- Witnessed by MGR representative (optional)

#### LIMITED_POA

**Purpose:** Power of Attorney authorizing MGR Capital to file claims.

**Required Fields:**
| Field | Source | Format |
|-------|--------|--------|
| clientName | Client.name | Title Case |
| clientAddress | Client full address | Multi-line |
| propertyAddress | Case.propertyAddress | Full address |
| parcelNumber | Case.parcelNumber | As recorded |
| saleDate | Case.saleDate | "January 15, 2024" |
| state | Case.state | Full state name |
| county | Case.county | County name |

**Sections:**
1. Grant of Authority
2. Scope of Authority (specific actions authorized)
3. Property Description
4. Effective Date and Duration
5. Revocation Clause
6. Signatures and Notarization (if required by state)

#### AFFIDAVIT

**Purpose:** Sworn statement of ownership/entitlement.

**Required Fields:**
| Field | Source | Format |
|-------|--------|--------|
| clientName | Client.name | Title Case |
| propertyAddress | Case.propertyAddress | Full address |
| parcelNumber | Case.parcelNumber | As recorded |
| ownershipStatement | Generated | Legal language |
| state | Case.state | Full state name |
| county | Case.county | County name |

**Sections:**
1. Affiant Identification
2. Property Description
3. Ownership Statement
4. Basis for Claim
5. Jurat (notarization block)

#### FILING_PACKET

**Purpose:** Complete package for county/court filing.

**Contents (Combined PDF):**
1. Cover Letter (1 page)
2. Service Agreement (copy)
3. Limited POA (copy)
4. Affidavit
5. Supporting Evidence (if any)
6. Payment Instructions (if required)

### 10.3 PDF Generation Implementation

```typescript
// backend/src/services/pdfService.ts

import PDFDocument from 'pdfkit';
import { Case, Client } from '@prisma/client';

export async function generateServiceAgreement(
  caseData: Case,
  clientData: Client
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 72,
      info: {
        Title: `Service Agreement - ${caseData.internalId}`,
        Author: 'MGR Capital Assistance'
      }
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(16).font('Helvetica-Bold')
      .text('SERVICE AGREEMENT', { align: 'center' });
    doc.moveDown();

    // Parties
    doc.fontSize(12).font('Helvetica')
      .text(`This Service Agreement ("Agreement") is entered into as of ${formatDate(new Date())} by and between:`);
    doc.moveDown();
    doc.text(`MGR Capital Assistance LLC ("Company")`);
    doc.text(`and`);
    doc.text(`${clientData.name} ("Client")`);
    doc.moveDown();

    // Property Description
    doc.font('Helvetica-Bold').text('PROPERTY DESCRIPTION');
    doc.font('Helvetica')
      .text(`Address: ${caseData.propertyAddress}`)
      .text(`County: ${caseData.county}, ${getStateName(caseData.state)}`);
    if (caseData.parcelNumber) {
      doc.text(`Parcel Number: ${caseData.parcelNumber}`);
    }
    doc.moveDown();

    // Services
    doc.font('Helvetica-Bold').text('SERVICES');
    doc.font('Helvetica')
      .text('Company agrees to provide the following services on behalf of Client:');
    doc.list([
      'Research and identify surplus funds owed to Client',
      'Prepare and file all necessary claims and documentation',
      'Communicate with county/court officials on Client\'s behalf',
      'Process and distribute recovered funds'
    ]);
    doc.moveDown();

    // Fee Structure
    doc.font('Helvetica-Bold').text('FEE STRUCTURE');
    doc.font('Helvetica')
      .text(`Company shall receive ${caseData.feePercent}% of any funds recovered as compensation for services rendered. This fee is contingent upon successful recovery; no fee is owed if no funds are recovered.`);
    doc.moveDown();

    // Signature Block
    doc.moveDown(4);
    doc.text('CLIENT SIGNATURE:');
    doc.moveDown();
    doc.text('_________________________________');
    doc.text(`${clientData.name}`);
    doc.moveDown();
    doc.text('Date: _________________');

    doc.end();
  });
}
```

### 10.4 Storage Integration

Generated PDFs are automatically stored in Document Vault:
1. Generate PDF buffer
2. Create filename: `{DocumentType}_{YYYYMMDD}_{HHMMSS}.pdf`
3. Save to `backend/storage/documents/{caseId}/`
4. Create Document record in database
5. Return document ID for reference

---

## 11. TRAINING INTELLIGENCE BLUEPRINT

### 11.1 Module Structure

| Module ID | Title | Target Roles | Required Tiers |
|-----------|-------|--------------|----------------|
| M001 | Introduction to MGR Capital | ALL EMPLOYEES | All |
| M002 | Client Communication Basics | EMPLOYEE, TEAM_LEAD | TIER_1, TIER_2 |
| M003 | Compliance & Boundaries | ALL EMPLOYEES | All |
| M004 | Case Processing Procedures | EMPLOYEE, TEAM_LEAD | All |
| M005 | Advanced Negotiation | TEAM_LEAD | TIER_3+ |
| M006 | Team Leadership Essentials | TEAM_LEAD | TIER_4+ |
| M007 | HR Onboarding Procedures | HR | N/A |
| M008 | Compliance Monitoring | COMPLIANCE | N/A |

### 11.2 Training Progress Model

```prisma
model TrainingProgress {
  id          String   @id @default(cuid())
  userId      String
  moduleId    String
  status      TrainingStatus @default(NOT_STARTED)
  startedAt   DateTime?
  completedAt DateTime?
  quizScore   Int?
  attempts    Int      @default(0)

  user        User     @relation(fields: [userId], references: [id])
  module      TrainingModule @relation(fields: [moduleId], references: [id])
}

enum TrainingStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### 11.3 TrainingBot Functions

| Function | Purpose | Output |
|----------|---------|--------|
| `identifyGaps()` | Find employees missing required modules | `{ employeeId, missingModules[], priority }[]` |
| `correlatePerformance()` | Link training completion to case metrics | Performance correlation report |
| `suggestModules()` | Recommend next modules based on role/tier | `{ employeeId, suggestedModules[], reason }[]` |
| `generateAnalytics()` | Training completion metrics | Dashboard data |
| `detectStaleProgress()` | Find abandoned in-progress modules | List of stale progress records |

### 11.4 Module Content Generation

TrainingBot generates detailed module content stored in `TrainingModuleDetail`:

```typescript
interface TrainingModuleDetail {
  moduleId: string;
  role: UserRole;
  tier?: EmployeeTier;
  outline: {
    sections: {
      title: string;
      duration: string;
      content: string;
      keyPoints: string[];
    }[];
  };
  scripts: {
    [scenario: string]: string;
  };
  keyPoints: string[];
  videoBlueprint?: {
    scenes: {
      title: string;
      duration: string;
      visualDescription: string;
      narration: string;
    }[];
  };
}
```

### 11.5 Assessment Questions

Each module includes quiz questions:

```typescript
interface AssessmentQuestion {
  id: string;
  moduleId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// Example for M001:
const questions: AssessmentQuestion[] = [
  {
    id: 'M001_Q1',
    moduleId: 'M001',
    question: 'What is the primary service MGR Capital provides?',
    options: [
      'Tax preparation',
      'Tax surplus recovery',
      'Real estate sales',
      'Legal representation'
    ],
    correctAnswer: 1,
    explanation: 'MGR Capital specializes in recovering unclaimed surplus funds from tax sales for property owners.'
  }
];
```

### 11.6 HR/Compliance Integration

- **HR Panel**: View training compliance, send reminders, track completion rates
- **Compliance Panel**: Audit training records, verify certifications, flag overdue training
- **Reporting**: Generate training compliance reports by role, tier, team

---

## 12. INGESTION INTELLIGENCE BLUEPRINT

### 12.1 Data Sources

| Source Type | Format | Frequency | Priority States |
|-------------|--------|-----------|-----------------|
| County Tax Sale Lists | CSV/Excel | Weekly | TX, FL, CA, GA, NC |
| Surplus Fund Notices | PDF | Daily | All active states |
| State Unclaimed Property | Web scrape | Monthly | All states |
| Foreclosure Lists | CSV | Weekly | High-volume counties |

### 12.2 Parsing Functions

#### parseTaxSaleCSV()
```typescript
interface TaxSaleRecord {
  parcelNumber: string;
  ownerName: string;
  propertyAddress: string;
  saleDate: Date;
  saleAmount: number;
  surplusAmount?: number;
  county: string;
  state: string;
}

async function parseTaxSaleCSV(
  file: Buffer,
  config: SourceConfig
): Promise<TaxSaleRecord[]> {
  // 1. Detect encoding (UTF-8, Latin-1, Windows-1252)
  const encoding = detectEncoding(file);
  const content = iconv.decode(file, encoding);

  // 2. Parse CSV with headers
  const records = Papa.parse(content, { header: true });

  // 3. Map columns to standard fields
  const mapped = records.data.map(row => ({
    parcelNumber: row[config.columns.parcel],
    ownerName: row[config.columns.owner],
    propertyAddress: row[config.columns.address],
    saleDate: parseDate(row[config.columns.saleDate]),
    saleAmount: parseCurrency(row[config.columns.saleAmount]),
    surplusAmount: parseCurrency(row[config.columns.surplus]),
    county: config.county,
    state: config.state
  }));

  // 4. Validate required fields
  const valid = mapped.filter(validateTaxSaleRecord);

  // 5. Return normalized records
  return valid;
}
```

#### parseSurplusPDF()
```typescript
async function parseSurplusPDF(file: Buffer): Promise<TaxSaleRecord[]> {
  // 1. Extract text using pdf-parse
  const pdfData = await pdfParse(file);
  const text = pdfData.text;

  // 2. Identify table structures using regex
  const tablePattern = /(\d{2,}-\d{2,}-\d{2,})\s+(.+?)\s+\$?([\d,]+\.?\d*)/g;

  // 3. Extract records
  const records: TaxSaleRecord[] = [];
  let match;
  while ((match = tablePattern.exec(text)) !== null) {
    records.push({
      parcelNumber: match[1],
      ownerName: match[2].trim(),
      surplusAmount: parseCurrency(match[3])
    });
  }

  return records;
}
```

### 12.3 IngestionBot Functions

| Function | Purpose |
|----------|---------|
| `analyzeIngestionPatterns()` | Detect changes in data source formats |
| `detectDuplicates()` | Find records matching existing cases |
| `assessSourceHealth()` | Monitor source reliability and availability |
| `prioritizeRecords()` | Flag high-value records (>$10,000) for immediate processing |
| `generateSourceReport()` | Per-source ingestion statistics |

### 12.4 Scraper Service

```typescript
// backend/src/services/scraperService.ts

interface ScraperConfig {
  id: string;
  name: string;
  state: string;
  county: string;
  url: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  selectors: {
    table: string;
    row: string;
    fields: Record<string, string>;
  };
  transforms: Record<string, (val: string) => any>;
}

const scraperConfigs: ScraperConfig[] = [
  {
    id: 'harris_county_tx',
    name: 'Harris County, TX Tax Sale',
    state: 'TX',
    county: 'Harris',
    url: 'https://www.hctax.net/Property/TaxSales',
    frequency: 'weekly',
    selectors: {
      table: '.tax-sale-table',
      row: 'tr.record',
      fields: {
        parcel: 'td.parcel-id',
        address: 'td.property-address',
        amount: 'td.surplus-amount'
      }
    },
    transforms: {
      amount: parseCurrency
    }
  }
];

async function runScraper(configId: string): Promise<ScrapedItem[]> {
  const config = scraperConfigs.find(c => c.id === configId);
  if (!config) throw new Error(`Unknown scraper: ${configId}`);

  // 1. Fetch page
  const response = await fetch(config.url);
  const html = await response.text();

  // 2. Parse with cheerio
  const $ = cheerio.load(html);

  // 3. Extract records
  const records: ScrapedItem[] = [];
  $(config.selectors.table).find(config.selectors.row).each((i, row) => {
    const record: any = {};
    for (const [field, selector] of Object.entries(config.selectors.fields)) {
      let value = $(row).find(selector).text().trim();
      if (config.transforms[field]) {
        value = config.transforms[field](value);
      }
      record[field] = value;
    }
    records.push({
      sourceType: 'TAX_SALE',
      sourceUrl: config.url,
      state: config.state,
      county: config.county,
      rawContent: $(row).html(),
      parsedData: record,
      reviewStatus: 'PENDING'
    });
  });

  return records;
}
```

### 12.5 Watch Service (Rule Change Detection)

```typescript
// backend/src/services/watchService.ts

interface WatchTarget {
  id: string;
  state: string;
  county?: string;
  url: string;
  contentHash?: string;
  lastChecked?: Date;
  checkFrequency: 'daily' | 'weekly';
}

async function checkForChanges(target: WatchTarget): Promise<WatchAlert | null> {
  // 1. Fetch current content
  const response = await fetch(target.url);
  const content = await response.text();

  // 2. Calculate hash
  const currentHash = crypto.createHash('md5').update(content).digest('hex');

  // 3. Compare with stored hash
  if (target.contentHash && target.contentHash !== currentHash) {
    // Content changed - create alert
    return {
      type: 'RULE_CHANGE',
      severity: 'HIGH',
      title: `Content changed: ${target.state}${target.county ? ' ' + target.county : ''}`,
      message: `The monitored page at ${target.url} has changed. Please review for rule updates.`,
      state: target.state,
      county: target.county
    };
  }

  // 4. Update stored hash
  await updateTargetHash(target.id, currentHash);

  return null;
}
```

### 12.6 High-Value Detection

```typescript
async function flagHighValueRecords(records: TaxSaleRecord[]): Promise<void> {
  const highValue = records.filter(r => r.surplusAmount && r.surplusAmount > 1000000); // > $10,000

  for (const record of highValue) {
    await prisma.watchAlert.create({
      data: {
        type: 'HIGH_VALUE_CASE',
        severity: 'HIGH',
        title: `High-value surplus detected: $${(record.surplusAmount / 100).toLocaleString()}`,
        message: `Property: ${record.propertyAddress}\nOwner: ${record.ownerName}\nCounty: ${record.county}, ${record.state}`,
        state: record.state,
        county: record.county
      }
    });
  }
}
```

---

## 13. BACKUPS PLAYBOOK

### 13.1 Components to Backup

| Component | Location | Method | Frequency |
|-----------|----------|--------|-----------|
| PostgreSQL Database | localhost:5432 | pg_dump | Every 6 hours |
| Document Vault | backend/storage/documents/ | rsync | Hourly |
| Configuration | .env, secrets | Manual/encrypted | On change |
| Prisma Schema | backend/prisma/schema.prisma | Git | On change |

### 13.2 PostgreSQL Backup Commands

```bash
# Full database dump (custom format, compressed)
pg_dump -h localhost -U postgres -d mgr_capital \
  -F c -Z 9 \
  -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump.gz

# Schema only (for documentation)
pg_dump -h localhost -U postgres -d mgr_capital \
  --schema-only \
  -f /backups/schema/schema_$(date +%Y%m%d).sql

# Data only (for data migration)
pg_dump -h localhost -U postgres -d mgr_capital \
  --data-only -F c \
  -f /backups/data/data_$(date +%Y%m%d_%H%M%S).dump

# Critical tables only
pg_dump -h localhost -U postgres -d mgr_capital \
  -t "User" -t "Case" -t "Client" -t "LedgerEntry" -t "Document" \
  -F c -f /backups/critical/critical_$(date +%Y%m%d_%H%M%S).dump
```

### 13.3 Restore Commands

```bash
# Full restore (drop existing, restore all)
pg_restore -h localhost -U postgres -d mgr_capital \
  -c -F c /backups/db/mgr_capital_YYYYMMDD_HHMMSS.dump.gz

# Restore to new database
createdb -h localhost -U postgres mgr_capital_restored
pg_restore -h localhost -U postgres -d mgr_capital_restored \
  -F c /backups/db/mgr_capital_YYYYMMDD_HHMMSS.dump.gz

# Restore specific tables
pg_restore -h localhost -U postgres -d mgr_capital \
  -t "Case" -F c /backups/db/backup_file.dump
```

### 13.4 Cron Schedule

```cron
# /etc/cron.d/mgr-backups

# Hourly: Document vault incremental
0 * * * * root rsync -av --delete /app/storage/documents/ /backups/documents/hourly/

# Every 6 hours: Database snapshot
0 */6 * * * root /opt/mgr/scripts/backup_db.sh >> /var/log/mgr-backup.log 2>&1

# Daily at 2 AM: Full database dump
0 2 * * * root /opt/mgr/scripts/daily_backup.sh >> /var/log/mgr-backup.log 2>&1

# Weekly on Sunday at 3 AM: Full archive
0 3 * * 0 root /opt/mgr/scripts/weekly_backup.sh >> /var/log/mgr-backup.log 2>&1

# Monthly on 1st at 4 AM: Long-term archive
0 4 1 * * root /opt/mgr/scripts/monthly_archive.sh >> /var/log/mgr-backup.log 2>&1
```

### 13.5 Retention Policy

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Hourly | Every hour | 24 hours |
| 6-hour | Every 6 hours | 7 days |
| Daily | Daily at 2 AM | 30 days |
| Weekly | Sunday at 3 AM | 90 days |
| Monthly | 1st of month | 1 year |
| Annual | January 1st | 7 years (legal) |

### 13.6 Encryption Guidance

```bash
# Encrypt backup with GPG (symmetric)
gpg --cipher-algo AES256 --symmetric \
  --batch --passphrase-file /etc/mgr/backup-key \
  -o /backups/db/backup.dump.gz.gpg \
  /backups/db/backup.dump.gz

# Remove unencrypted version
shred -u /backups/db/backup.dump.gz

# Decrypt for restore
gpg --decrypt --batch --passphrase-file /etc/mgr/backup-key \
  -o /tmp/restore.dump.gz \
  /backups/db/backup.dump.gz.gpg
```

### 13.7 Disaster Recovery

| Scenario | RPO (Max Data Loss) | RTO (Time to Recover) |
|----------|---------------------|----------------------|
| Database corruption | 6 hours | 2 hours |
| Full server failure | 6 hours | 4 hours |
| Ransomware attack | 24 hours | 8 hours |
| Natural disaster | 24 hours | 24 hours |

**Recovery Steps:**
1. Assess the situation and determine scope
2. Isolate affected systems
3. Select appropriate recovery point
4. Restore database from backup
5. Restore Document Vault from backup
6. Verify data integrity
7. Test system functionality
8. Document incident and update procedures

---

## 14. PHASE SUMMARY FOR COPILOT

### 14.1 Key Design Decisions

1. **Shadow Accounting**: Employees see 2x their actual commission rate. This is intentional and must never leak.

2. **7-Role System**: FOUNDER > ADMIN > HR/COMPLIANCE > TEAM_LEAD > EMPLOYEE > CLIENT. Each role has strictly defined access.

3. **OPS Layer Isolation**: The entire OPS layer (bots, insights, watch alerts, scraped data) is FOUNDER-ONLY. No exceptions.

4. **Sovereign Stack**: No paid SaaS. Everything self-hosted. SMTP for email, local filesystem for documents, PostgreSQL for data.

5. **Cents for Money**: All monetary values in cents (integers). Never use floats for money.

6. **UTC Everywhere**: All timestamps in UTC. Convert to local only at display time.

### 14.2 Ambiguities Resolved

1. **Commission Calculation**: Fee is taken from surplus first, then employee commission from fee, then founder keeps remainder.

2. **Document Access**: Matrix-based. FOUNDER sees all, others see based on role + case ownership.

3. **Bot Orchestration**: CoordinatorBot runs all bots in sequence, aggregates insights, generates executive summary.

4. **Client Portal**: Clients see simplified status only. No financial details, no employee names, no backend logic.

5. **Training Requirements**: Module requirements vary by role and tier. Not all modules apply to all employees.

### 14.3 Risks Identified

1. **Scraper Brittleness**: County websites change frequently. Scrapers need regular maintenance.

2. **State Rule Variations**: Each state has different redemption periods, filing requirements, document formats.

3. **Shadow Accounting Leaks**: UI must be carefully designed to never show actual rates to employees.

4. **High-Value Case Security**: Cases with large surplus amounts need extra protection and audit trails.

5. **Document Vault Growth**: Need retention policies and archival strategy as vault grows.

### 14.4 What's Complete (100%)

- Authentication + JWT + rate limiting
- All 7 roles + roleGuard + access matrix
- Case CRUD + full lifecycle
- Client Portal + onboarding + document signing
- Shadow accounting calculations
- HR Panel + routes
- Compliance Panel + routes
- FounderConsole (basic) + OPS routes
- Document Vault service + routes
- Notification service (SMTP integration)
- PDF service (pdfkit structure)
- All Prisma models + enums
- Backups documentation

### 14.5 What's NOT Complete (Priority Order)

**HIGH Priority:**
1. Bot detection logic (PayoutBot anomalies, ComplianceBot deadlines)
2. PDF templates with state-specific legal language
3. Scraper configurations for priority states

**MEDIUM Priority:**
4. Notification email templates (all triggers)
5. Training module content and quizzes
6. FounderConsole full bot controls

**LOW Priority:**
7. WebSocket real-time updates
8. Mobile responsive optimization
9. End-to-end test coverage

### 14.6 Notes for Copilot Phase 2

1. **Start with bot logic** - The 7 bots are currently skeletons. Implement real detection algorithms.

2. **PDF templates need legal review** - State-specific language must be accurate. Start with TX, FL, CA, GA, NC.

3. **Scraper maintenance is ongoing** - Build admin UI for managing scraper configs.

4. **Test shadow accounting thoroughly** - Any leak of actual rates to employees is a critical bug.

5. **Document everything** - Update this spec as you implement. Keep it as the single source of truth.

---

**END OF MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1_FINAL.md**

*This document is the canonical source of truth for the MGR Capital Assistance platform. All implementation must conform to this specification.*
