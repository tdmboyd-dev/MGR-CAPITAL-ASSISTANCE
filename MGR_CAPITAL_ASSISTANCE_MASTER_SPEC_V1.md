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

enum CommunicationType {
  CALL
  EMAIL
  SMS
  LETTER
  PORTAL
  INTERNAL_NOTE
}

enum DeadlinePriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum NotificationType {
  EMAIL
  SMS
  INTERNAL
}

enum NotificationChannel {
  SMTP
  SMS_GATEWAY
  PORTAL
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

enum SessionStatus {
  ACTIVE
  EXPIRED
  REVOKED
}
```

### 4.4 Additional Core Models

#### Communication

**Purpose:** Represents all inbound and outbound communications related to a case. Includes phone calls, emails, SMS, mailed letters, portal messages, and internal notes. Supports auditability, compliance review, and OPS-layer analysis.

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| caseId | String | FK to Case |
| userId | String? | FK to User (employee who logged the comm) |
| type | CommunicationType | CALL/EMAIL/SMS/LETTER/PORTAL/INTERNAL_NOTE |
| direction | String | INBOUND or OUTBOUND |
| subject | String? | Subject line (emails/letters) |
| body | String? | Message body or call summary |
| metadata | Json? | Channel-specific metadata |
| createdAt | DateTime | Timestamp of communication |
| updatedAt | DateTime | Last modification timestamp |

**Relations:**
- `case` → Case (many-to-one)
- `user` → User (many-to-one)

**Access Rules:**
- FOUNDER, ADMIN, COMPLIANCE: All communications visible
- EMPLOYEE: Only communications related to assigned cases
- CLIENT: Only communications directed to them

#### Deadline

**Purpose:** Tracks all legal, administrative, and operational deadlines associated with a case. Used heavily by DocketBot, ComplianceBot, and the OPS Watch System.

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| caseId | String | FK to Case |
| title | String | Short description of the deadline |
| description | String? | Detailed explanation |
| dueDate | DateTime | Deadline date (UTC) |
| priority | DeadlinePriority | CRITICAL/HIGH/MEDIUM/LOW |
| status | String | PENDING/COMPLETED/OVERDUE |
| completedAt | DateTime? | When completed |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

**Relations:**
- `case` → Case (many-to-one)

**Behavior:**
- Overdue deadlines automatically trigger WatchAlerts
- DocketBot scans for approaching deadlines daily
- FOUNDER sees all deadlines; employees see only their assigned case deadlines

#### UserSession

**Purpose:** Tracks authenticated user sessions for security, auditing, and OPS-layer anomaly detection.

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| userId | String | FK to User |
| token | String | JWT token hash (for revocation) |
| ipAddress | String? | IP address used for login |
| userAgent | String? | Browser/device info |
| status | SessionStatus | ACTIVE/EXPIRED/REVOKED |
| createdAt | DateTime | Session creation timestamp |
| expiresAt | DateTime | Session expiration timestamp |
| revokedAt | DateTime? | When session was revoked |

**Relations:**
- `user` → User (many-to-one)

**Security:**
- OPS layer uses session patterns to detect suspicious activity
- Multiple concurrent sessions flagged for review
- FOUNDER can revoke any session
- Sessions auto-expire after 24 hours of inactivity

#### NotificationLog

**Purpose:** Stores all notifications sent by the system across all channels. Supports auditing, retries, and OPS-layer monitoring.

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| userId | String? | FK to User (recipient) |
| type | NotificationType | EMAIL/SMS/INTERNAL |
| channel | NotificationChannel | SMTP/SMS_GATEWAY/PORTAL |
| recipient | String | Email address or phone number |
| subject | String? | Notification subject |
| body | String | Notification body (HTML or text) |
| bodyPreview | String? | Plain text preview (first 200 chars) |
| templateId | String? | Template used for generation |
| status | NotificationStatus | PENDING/SENT/FAILED/CANCELLED |
| error | String? | Error message if failed |
| attempts | Int | Number of send attempts (max 3) |
| relatedCaseId | String? | FK to Case |
| relatedUserId | String? | FK to User (if different from recipient) |
| createdAt | DateTime | Creation timestamp |
| sentAt | DateTime? | When successfully sent |
| metadata | Json? | Additional delivery metadata |

**Relations:**
- `user` → User (many-to-one)
- `case` → Case (many-to-one)

**Retry Logic:**
- Failed notifications retry up to 3 times with exponential backoff
- After 3 failures, status set to FAILED and alert generated

#### IngestionBatch

**Purpose:** Represents a batch of ingested data (CSV, PDF, scrape results). Used by IngestionBot, ScraperService, and OPS metrics.

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| sourceId | String | Source identifier (scraper config ID or upload source) |
| sourceName | String | Human-readable source name |
| sourceType | String | CSV/PDF/SCRAPE/MANUAL |
| fileName | String? | Original filename (for uploads) |
| state | String? | State code if applicable |
| county | String? | County name if applicable |
| status | String | PENDING/PROCESSING/COMPLETED/PARTIAL/FAILED |
| totalRecords | Int | Total records in batch |
| successCount | Int | Records successfully processed |
| failureCount | Int | Records that failed processing |
| duplicateCount | Int | Duplicate records detected |
| highValueCount | Int | High-value records flagged |
| errors | Json? | Array of error details |
| sampleRecord | Json? | Sample of first record (for pattern detection) |
| startedAt | DateTime | Processing start timestamp |
| completedAt | DateTime? | Processing completion timestamp |
| createdAt | DateTime | Batch creation timestamp |

**Metrics:**
- IngestionBot analyzes batch patterns for anomalies
- High failure rates trigger WatchAlerts
- Source health calculated from batch success rates

#### WatchTarget

**Purpose:** Defines external sources monitored by the Watch System (county sites, rule pages, surplus lists).

| Field | Type | Purpose |
|-------|------|---------|
| id | String (CUID) | Primary key |
| name | String | Human-readable target name |
| state | String | US state code |
| county | String? | County name (optional) |
| url | String | Target URL to monitor |
| targetType | String | TAX_SALE/SURPLUS/RULES/DEADLINES/FORMS |
| checkFrequency | String | DAILY/WEEKLY/MONTHLY |
| isActive | Boolean | Whether monitoring is enabled |
| contentHash | String? | SHA-256 hash of last content |
| lastCheckedAt | DateTime? | Last successful check timestamp |
| lastChangedAt | DateTime? | Last detected change timestamp |
| lastStatus | String? | OK/ERROR/CHANGED/UNREACHABLE |
| errorCount | Int | Consecutive error count |
| notes | String? | Additional metadata or instructions |
| selectors | Json? | CSS selectors for content extraction |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

**Watch Behavior:**
- Content hash compared on each check to detect changes
- Changes trigger RULE_CHANGE alerts
- 3 consecutive errors trigger SOURCE_OFFLINE alert
- FOUNDER can manually trigger checks via FounderConsole

### 4.5 Updated Prisma Relations

```prisma
// Add to Case model
model Case {
  // ... existing fields ...
  communications Communication[]
  deadlines      Deadline[]
}

// Add to User model
model User {
  // ... existing fields ...
  communications Communication[]
  sessions       UserSession[]
  notifications  NotificationLog[]
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

## 10. PDF TEMPLATE SPECIFICATION (COMPLETE)

### 10.1 Template Engine Architecture

All PDFs generated using `pdfkit` (sovereign, no external API dependencies).

**Global Settings:**
```typescript
// backend/src/services/pdfService.ts

const PDF_CONFIG = {
  pageSize: 'LETTER' as const,        // 8.5" x 11" (612 x 792 points)
  margins: {
    top: 72,                          // 1 inch
    bottom: 72,
    left: 72,
    right: 72
  },
  fonts: {
    primary: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique'
  },
  fontSize: {
    title: 18,
    heading: 14,
    subheading: 12,
    body: 11,
    small: 9,
    footer: 8
  },
  colors: {
    primary: '#1a365d',               // Dark blue for headers
    secondary: '#2d3748',             // Dark gray for body
    accent: '#3182ce',                // Blue for highlights
    muted: '#718096'                  // Gray for footers
  },
  lineHeight: 1.4
};
```

**Company Letterhead Implementation:**
```typescript
function addLetterhead(doc: PDFKit.PDFDocument): void {
  // Company name
  doc.fontSize(PDF_CONFIG.fontSize.title)
     .font(PDF_CONFIG.fonts.bold)
     .fillColor(PDF_CONFIG.colors.primary)
     .text('MGR CAPITAL ASSISTANCE LLC', PDF_CONFIG.margins.left, PDF_CONFIG.margins.top, {
       align: 'center'
     });

  // Tagline
  doc.fontSize(PDF_CONFIG.fontSize.small)
     .font(PDF_CONFIG.fonts.italic)
     .fillColor(PDF_CONFIG.colors.muted)
     .text('Tax Surplus Recovery Specialists', { align: 'center' });

  // Horizontal line
  doc.moveTo(PDF_CONFIG.margins.left, doc.y + 10)
     .lineTo(doc.page.width - PDF_CONFIG.margins.right, doc.y + 10)
     .strokeColor(PDF_CONFIG.colors.primary)
     .lineWidth(1)
     .stroke();

  doc.moveDown(2);
}

function addPageNumbers(doc: PDFKit.PDFDocument): void {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(PDF_CONFIG.fontSize.footer)
       .fillColor(PDF_CONFIG.colors.muted)
       .text(
         `Page ${i + 1} of ${pages.count}`,
         PDF_CONFIG.margins.left,
         doc.page.height - 50,
         { align: 'center' }
       );
  }
}
```

### 10.2 SERVICE_AGREEMENT Template (Complete)

**Purpose:** Client service contract authorizing MGR Capital to act on their behalf.

**Required Fields:**
| Field | Source | Format | Validation |
|-------|--------|--------|------------|
| clientName | Client.name | Title Case | Required, min 2 chars |
| clientAddress | Client.address + city + state + zip | Multi-line | Required |
| propertyAddress | Case.propertyAddress | Full address | Required |
| state | Case.state | Full state name | Valid US state |
| county | Case.county | County name | Required |
| feePercent | Case.feePercent | "30%" format | 1-50 range |
| agreementDate | Generated | "January 21, 2026" | Auto-generated |
| caseId | Case.internalId | MGR-YYYY-XXXXX | Auto-generated |

**Full Implementation:**
```typescript
export async function generateServiceAgreement(
  caseData: Case & { client: Client }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_CONFIG.pageSize,
      margins: PDF_CONFIG.margins,
      bufferPages: true,
      info: {
        Title: `Service Agreement - ${caseData.internalId}`,
        Author: 'MGR Capital Assistance LLC',
        Subject: 'Tax Surplus Recovery Service Agreement',
        Creator: 'MGR Capital PDF Generator'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add letterhead
    addLetterhead(doc);

    // Document title
    doc.fontSize(PDF_CONFIG.fontSize.heading)
       .font(PDF_CONFIG.fonts.bold)
       .fillColor(PDF_CONFIG.colors.primary)
       .text('SERVICE AGREEMENT', { align: 'center' });
    doc.moveDown();

    // Reference number
    doc.fontSize(PDF_CONFIG.fontSize.small)
       .font(PDF_CONFIG.fonts.primary)
       .fillColor(PDF_CONFIG.colors.muted)
       .text(`Reference: ${caseData.internalId}`, { align: 'center' });
    doc.moveDown(2);

    // Introduction
    doc.fontSize(PDF_CONFIG.fontSize.body)
       .font(PDF_CONFIG.fonts.primary)
       .fillColor(PDF_CONFIG.colors.secondary)
       .text(
         `This Service Agreement ("Agreement") is entered into as of ${formatDate(new Date())} ` +
         `by and between:`,
         { align: 'left' }
       );
    doc.moveDown();

    // Parties
    doc.font(PDF_CONFIG.fonts.bold).text('COMPANY:');
    doc.font(PDF_CONFIG.fonts.primary)
       .text('MGR Capital Assistance LLC')
       .text('(hereinafter referred to as "Company")');
    doc.moveDown();

    doc.font(PDF_CONFIG.fonts.bold).text('CLIENT:');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(caseData.client.name)
       .text(formatAddress(caseData.client))
       .text('(hereinafter referred to as "Client")');
    doc.moveDown(2);

    // Section 1: Property Description
    doc.font(PDF_CONFIG.fonts.bold)
       .text('1. PROPERTY DESCRIPTION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(`The property that is the subject of this Agreement is located at:`)
       .moveDown(0.5)
       .text(`Address: ${caseData.propertyAddress}`)
       .text(`County: ${caseData.county}`)
       .text(`State: ${getStateName(caseData.state)}`);
    if (caseData.parcelNumber) {
      doc.text(`Parcel Number: ${caseData.parcelNumber}`);
    }
    doc.moveDown();

    // Section 2: Services
    doc.font(PDF_CONFIG.fonts.bold)
       .text('2. SERVICES TO BE PROVIDED');
    doc.font(PDF_CONFIG.fonts.primary)
       .text('Company agrees to provide the following services on behalf of Client:');
    doc.moveDown(0.5);
    doc.list([
      'Research and identify surplus funds or excess proceeds owed to Client resulting from tax sales or similar proceedings',
      'Prepare all necessary documentation required to file claims for recovery of said funds',
      'File claims with appropriate county, state, or court authorities',
      'Communicate with government officials on Client\'s behalf regarding the claim',
      'Monitor claim status and provide updates to Client',
      'Process and coordinate disbursement of recovered funds'
    ], { bulletRadius: 2, textIndent: 20 });
    doc.moveDown();

    // Section 3: Fee Structure
    doc.font(PDF_CONFIG.fonts.bold)
       .text('3. FEE STRUCTURE');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         `Company shall receive ${caseData.feePercent}% (${numberToWords(caseData.feePercent)} percent) ` +
         `of any and all funds successfully recovered as compensation for services rendered. ` +
         `This fee is strictly contingent upon successful recovery; no fee is owed if no funds are recovered.`
       );
    doc.moveDown(0.5);
    doc.text(
      'Client acknowledges that Company will deduct its fee directly from recovered funds ' +
      'prior to disbursement of the remaining balance to Client.'
    );
    doc.moveDown();

    // Section 4: Term and Termination
    doc.font(PDF_CONFIG.fonts.bold)
       .text('4. TERM AND TERMINATION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'This Agreement shall remain in effect until the earlier of: (a) successful recovery ' +
         'and distribution of funds, (b) final denial of the claim with no further appeals available, ' +
         'or (c) mutual written agreement to terminate.'
       );
    doc.moveDown(0.5);
    doc.text(
      'Client may terminate this Agreement at any time by providing written notice to Company. ' +
      'If Client terminates after Company has filed a claim, Client agrees to pay Company ' +
      'reasonable costs incurred, not to exceed $500.'
    );
    doc.moveDown();

    // Section 5: Authorization
    doc.font(PDF_CONFIG.fonts.bold)
       .text('5. AUTHORIZATION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'Client hereby authorizes Company to act as Client\'s representative in all matters ' +
         'related to the recovery of surplus funds for the above-described property. This includes ' +
         'but is not limited to: executing documents, communicating with authorities, and ' +
         'receiving funds on Client\'s behalf.'
       );
    doc.moveDown();

    // Section 6: Governing Law
    doc.font(PDF_CONFIG.fonts.bold)
       .text('6. GOVERNING LAW');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         `This Agreement shall be governed by and construed in accordance with the laws of the ` +
         `State of ${getStateName(caseData.state)}.`
       );
    doc.moveDown(2);

    // Signature Block
    doc.font(PDF_CONFIG.fonts.bold)
       .text('SIGNATURES');
    doc.moveDown();

    // Client signature
    doc.font(PDF_CONFIG.fonts.primary)
       .text('CLIENT:');
    doc.moveDown(2);
    doc.text('_________________________________________________');
    doc.text(`${caseData.client.name}`);
    doc.moveDown();
    doc.text('Date: _______________________');
    doc.moveDown(2);

    // Company signature
    doc.text('COMPANY:');
    doc.moveDown(2);
    doc.text('_________________________________________________');
    doc.text('MGR Capital Assistance LLC');
    doc.text('Authorized Representative');
    doc.moveDown();
    doc.text('Date: _______________________');

    // Add page numbers
    addPageNumbers(doc);

    doc.end();
  });
}
```

### 10.3 LIMITED_POA Template (Complete)

**Purpose:** Limited Power of Attorney authorizing MGR Capital to file claims on behalf of client.

**State-Specific Variations:**
| State | Notarization | Witnesses | Special Requirements |
|-------|--------------|-----------|---------------------|
| TX | Required | 0 | Statutory short form accepted |
| FL | Required | 2 | Must include property legal description |
| CA | Required | 0 | Must include A.P.N. (Assessor's Parcel Number) |
| GA | Required | 0 | Must be filed with Superior Court Clerk |
| NC | Required | 0 | Must include specific grant language |

**Full Implementation:**
```typescript
export async function generateLimitedPOA(
  caseData: Case & { client: Client }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_CONFIG.pageSize,
      margins: PDF_CONFIG.margins,
      bufferPages: true,
      info: {
        Title: `Limited Power of Attorney - ${caseData.internalId}`,
        Author: 'MGR Capital Assistance LLC'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addLetterhead(doc);

    // Title
    doc.fontSize(PDF_CONFIG.fontSize.heading)
       .font(PDF_CONFIG.fonts.bold)
       .fillColor(PDF_CONFIG.colors.primary)
       .text('LIMITED POWER OF ATTORNEY', { align: 'center' });
    doc.moveDown();
    doc.fontSize(PDF_CONFIG.fontSize.small)
       .font(PDF_CONFIG.fonts.primary)
       .fillColor(PDF_CONFIG.colors.muted)
       .text('For Tax Surplus/Excess Proceeds Recovery', { align: 'center' });
    doc.moveDown(2);

    // Know All Men clause
    doc.fontSize(PDF_CONFIG.fontSize.body)
       .font(PDF_CONFIG.fonts.primary)
       .fillColor(PDF_CONFIG.colors.secondary)
       .text('KNOW ALL PERSONS BY THESE PRESENTS:', { align: 'left' });
    doc.moveDown();

    // Principal identification
    doc.text(
      `That I, ${caseData.client.name.toUpperCase()}, residing at ` +
      `${formatAddress(caseData.client)} (hereinafter "Principal"), ` +
      `do hereby appoint MGR CAPITAL ASSISTANCE LLC, ` +
      `(hereinafter "Agent"), as my true and lawful attorney-in-fact.`
    );
    doc.moveDown();

    // Grant of Authority
    doc.font(PDF_CONFIG.fonts.bold).text('GRANT OF AUTHORITY');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'I grant to my Agent full power and authority to act on my behalf, ' +
         'specifically and solely for the following purposes:'
       );
    doc.moveDown(0.5);
    doc.list([
      'To file claims for surplus funds, excess proceeds, or unclaimed property',
      'To execute any and all documents necessary to perfect such claims',
      'To communicate with county, state, and court officials regarding such claims',
      'To receive funds on my behalf related to such claims',
      'To endorse checks and negotiable instruments related to such claims',
      'To execute releases and other closing documents'
    ], { bulletRadius: 2, textIndent: 20 });
    doc.moveDown();

    // Property Description
    doc.font(PDF_CONFIG.fonts.bold).text('PROPERTY DESCRIPTION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text('This Power of Attorney relates solely to the following property:');
    doc.moveDown(0.5);
    doc.text(`Address: ${caseData.propertyAddress}`);
    doc.text(`County: ${caseData.county}, State: ${getStateName(caseData.state)}`);
    if (caseData.parcelNumber) {
      doc.text(`Parcel/APN: ${caseData.parcelNumber}`);
    }
    if (caseData.saleDate) {
      doc.text(`Tax Sale Date: ${formatDate(caseData.saleDate)}`);
    }
    doc.moveDown();

    // Limitations
    doc.font(PDF_CONFIG.fonts.bold).text('LIMITATIONS');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'This Power of Attorney is LIMITED to the specific purposes stated above. ' +
         'Agent has no authority to act on my behalf for any other purpose whatsoever.'
       );
    doc.moveDown();

    // Duration
    doc.font(PDF_CONFIG.fonts.bold).text('DURATION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'This Power of Attorney shall remain in effect until the earlier of: ' +
         '(a) successful recovery and distribution of funds, ' +
         '(b) written revocation by Principal, or ' +
         '(c) two (2) years from the date of execution.'
       );
    doc.moveDown();

    // Revocation clause
    doc.font(PDF_CONFIG.fonts.bold).text('REVOCATION');
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         'Principal may revoke this Power of Attorney at any time by providing ' +
         'written notice to Agent. Such revocation shall not affect any actions ' +
         'taken by Agent prior to receipt of notice.'
       );
    doc.moveDown(2);

    // Signature block
    doc.font(PDF_CONFIG.fonts.bold).text('PRINCIPAL SIGNATURE');
    doc.moveDown(2);
    doc.font(PDF_CONFIG.fonts.primary)
       .text('_________________________________________________');
    doc.text(`${caseData.client.name}`);
    doc.moveDown();
    doc.text('Date: _______________________');
    doc.moveDown(2);

    // State-specific notarization block
    const notaryBlock = getNotaryBlock(caseData.state);
    doc.addPage();
    addLetterhead(doc);
    doc.font(PDF_CONFIG.fonts.bold)
       .text('NOTARIZATION', { align: 'center' });
    doc.moveDown();
    doc.font(PDF_CONFIG.fonts.primary)
       .text(notaryBlock);

    addPageNumbers(doc);
    doc.end();
  });
}

function getNotaryBlock(state: string): string {
  const stateName = getStateName(state);
  return `
STATE OF ${stateName.toUpperCase()}
COUNTY OF _______________________

Before me, the undersigned notary public, on this _____ day of _______________, 20___,
personally appeared ${'{CLIENT_NAME}'}, known to me (or proved to me on the basis of
satisfactory evidence) to be the person whose name is subscribed to the within instrument
and acknowledged to me that they executed the same in their authorized capacity, and that
by their signature on the instrument the person, or the entity upon behalf of which the
person acted, executed the instrument.

WITNESS my hand and official seal.

_________________________________________________
Notary Public

My Commission Expires: _______________________

[NOTARY SEAL]
`;
}
```

### 10.4 AFFIDAVIT Template (Complete)

**Purpose:** Sworn statement establishing ownership/entitlement to surplus funds.

**Full Implementation:**
```typescript
export async function generateAffidavit(
  caseData: Case & { client: Client }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_CONFIG.pageSize,
      margins: PDF_CONFIG.margins,
      bufferPages: true,
      info: {
        Title: `Affidavit of Ownership - ${caseData.internalId}`,
        Author: 'MGR Capital Assistance LLC'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addLetterhead(doc);

    // Title
    doc.fontSize(PDF_CONFIG.fontSize.heading)
       .font(PDF_CONFIG.fonts.bold)
       .fillColor(PDF_CONFIG.colors.primary)
       .text('AFFIDAVIT OF OWNERSHIP AND ENTITLEMENT', { align: 'center' });
    doc.moveDown(2);

    // State/County header
    doc.fontSize(PDF_CONFIG.fontSize.body)
       .font(PDF_CONFIG.fonts.bold)
       .fillColor(PDF_CONFIG.colors.secondary)
       .text(`STATE OF ${getStateName(caseData.state).toUpperCase()}`);
    doc.text(`COUNTY OF ${caseData.county.toUpperCase()}`);
    doc.moveDown();

    // Affiant statement
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         `I, ${caseData.client.name.toUpperCase()}, being of legal age and being first ` +
         `duly sworn, do hereby state under oath as follows:`
       );
    doc.moveDown();

    // Numbered statements
    let statementNum = 1;

    doc.text(`${statementNum++}. I am the Affiant in this matter and make this Affidavit ` +
             `based upon my own personal knowledge.`);
    doc.moveDown();

    doc.text(`${statementNum++}. I am a citizen of the United States and a resident of ` +
             `the State of ${getStateName(caseData.state)}.`);
    doc.moveDown();

    doc.text(`${statementNum++}. I am, or was at the time of the tax sale, the owner ` +
             `of record of the following real property:`);
    doc.moveDown(0.5);
    doc.text(`     Address: ${caseData.propertyAddress}`, { indent: 20 });
    doc.text(`     County: ${caseData.county}`, { indent: 20 });
    doc.text(`     State: ${getStateName(caseData.state)}`, { indent: 20 });
    if (caseData.parcelNumber) {
      doc.text(`     Parcel Number: ${caseData.parcelNumber}`, { indent: 20 });
    }
    doc.moveDown();

    doc.text(`${statementNum++}. The above-described property was sold at a tax sale ` +
             `conducted by ${caseData.county} County` +
             (caseData.saleDate ? ` on or about ${formatDate(caseData.saleDate)}` : '') +
             `.`);
    doc.moveDown();

    doc.text(`${statementNum++}. I believe there are surplus funds, excess proceeds, ` +
             `or overage amounts resulting from said tax sale that I am entitled to receive.`);
    doc.moveDown();

    doc.text(`${statementNum++}. I have not previously received payment of these surplus ` +
             `funds from any source.`);
    doc.moveDown();

    doc.text(`${statementNum++}. I have not assigned, transferred, or otherwise conveyed ` +
             `my right to receive these surplus funds to any party other than MGR Capital ` +
             `Assistance LLC for the purpose of filing this claim.`);
    doc.moveDown();

    doc.text(`${statementNum++}. The statements contained in this Affidavit are true and ` +
             `correct to the best of my knowledge and belief.`);
    doc.moveDown(2);

    // Signature
    doc.font(PDF_CONFIG.fonts.bold).text('FURTHER AFFIANT SAYETH NOT.');
    doc.moveDown(2);

    doc.font(PDF_CONFIG.fonts.primary)
       .text('_________________________________________________');
    doc.text(`${caseData.client.name}, Affiant`);
    doc.moveDown();
    doc.text('Date: _______________________');
    doc.moveDown(2);

    // Jurat
    doc.font(PDF_CONFIG.fonts.bold).text('JURAT');
    doc.moveDown();
    doc.font(PDF_CONFIG.fonts.primary)
       .text(
         `Subscribed and sworn to before me this _____ day of _______________, 20___,\n` +
         `by ${caseData.client.name}, who is personally known to me or who has produced\n` +
         `_________________________________ as identification.`
       );
    doc.moveDown(2);
    doc.text('_________________________________________________');
    doc.text('Notary Public, State of ' + getStateName(caseData.state));
    doc.text('My Commission Expires: _______________________');
    doc.moveDown();
    doc.text('[NOTARY SEAL]');

    addPageNumbers(doc);
    doc.end();
  });
}
```

### 10.5 COVER_LETTER Template (Complete)

**Purpose:** Professional cover letter for filing submissions.

```typescript
export async function generateCoverLetter(
  caseData: Case & { client: Client },
  recipientInfo: { name: string; title: string; department: string; address: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_CONFIG.pageSize,
      margins: PDF_CONFIG.margins,
      info: {
        Title: `Cover Letter - ${caseData.internalId}`,
        Author: 'MGR Capital Assistance LLC'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addLetterhead(doc);

    // Date
    doc.fontSize(PDF_CONFIG.fontSize.body)
       .font(PDF_CONFIG.fonts.primary)
       .fillColor(PDF_CONFIG.colors.secondary)
       .text(formatDate(new Date()));
    doc.moveDown(2);

    // Recipient
    doc.text(recipientInfo.name);
    doc.text(recipientInfo.title);
    doc.text(recipientInfo.department);
    doc.text(recipientInfo.address);
    doc.moveDown();

    // RE line
    doc.font(PDF_CONFIG.fonts.bold)
       .text(`RE: Claim for Surplus Funds - ${caseData.client.name}`);
    doc.font(PDF_CONFIG.fonts.primary);
    if (caseData.parcelNumber) {
      doc.text(`Parcel Number: ${caseData.parcelNumber}`);
    }
    doc.text(`Property: ${caseData.propertyAddress}`);
    doc.moveDown();

    // Salutation
    doc.text(`Dear ${recipientInfo.name}:`);
    doc.moveDown();

    // Body
    doc.text(
      `Please find enclosed a claim for surplus funds on behalf of our client, ` +
      `${caseData.client.name}, related to the above-referenced property.`
    );
    doc.moveDown();

    doc.text('The following documents are enclosed:');
    doc.moveDown(0.5);
    doc.list([
      'Service Agreement (copy)',
      'Limited Power of Attorney (notarized)',
      'Affidavit of Ownership (notarized)',
      'Copy of government-issued identification',
      'Proof of ownership/chain of title'
    ], { bulletRadius: 2, textIndent: 20 });
    doc.moveDown();

    doc.text(
      `We respectfully request that you process this claim in accordance with ` +
      `applicable statutes and regulations. Please direct all correspondence ` +
      `regarding this matter to our office.`
    );
    doc.moveDown();

    doc.text(
      `If you require any additional documentation or information, please do not ` +
      `hesitate to contact us at your earliest convenience.`
    );
    doc.moveDown();

    doc.text('Thank you for your attention to this matter.');
    doc.moveDown(2);

    // Closing
    doc.text('Respectfully submitted,');
    doc.moveDown(3);
    doc.text('_________________________________________________');
    doc.text('MGR Capital Assistance LLC');
    doc.text('Authorized Representative');
    doc.moveDown();
    doc.text(`Reference: ${caseData.internalId}`);

    doc.end();
  });
}
```

### 10.6 FILING_PACKET Generator (Complete)

**Purpose:** Combines all documents into a single filing package.

```typescript
export async function generateFilingPacket(
  caseData: Case & { client: Client; documents: Document[] },
  recipientInfo: RecipientInfo
): Promise<Buffer> {
  // Generate individual documents
  const [coverLetter, serviceAgreement, limitedPOA, affidavit] = await Promise.all([
    generateCoverLetter(caseData, recipientInfo),
    generateServiceAgreement(caseData),
    generateLimitedPOA(caseData),
    generateAffidavit(caseData)
  ]);

  // Merge PDFs using pdf-lib
  const { PDFDocument } = await import('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  // Add cover letter
  const coverDoc = await PDFDocument.load(coverLetter);
  const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach(page => mergedPdf.addPage(page));

  // Add service agreement
  const saDoc = await PDFDocument.load(serviceAgreement);
  const saPages = await mergedPdf.copyPages(saDoc, saDoc.getPageIndices());
  saPages.forEach(page => mergedPdf.addPage(page));

  // Add POA
  const poaDoc = await PDFDocument.load(limitedPOA);
  const poaPages = await mergedPdf.copyPages(poaDoc, poaDoc.getPageIndices());
  poaPages.forEach(page => mergedPdf.addPage(page));

  // Add affidavit
  const affDoc = await PDFDocument.load(affidavit);
  const affPages = await mergedPdf.copyPages(affDoc, affDoc.getPageIndices());
  affPages.forEach(page => mergedPdf.addPage(page));

  // Add any existing uploaded documents (client ID, evidence, etc.)
  for (const doc of caseData.documents) {
    if (doc.type === 'CLIENT_ID' || doc.type === 'EVIDENCE_PACKET') {
      try {
        const docPath = path.join(VAULT_BASE_PATH, doc.filePath);
        const docBuffer = await fs.readFile(docPath);
        const existingDoc = await PDFDocument.load(docBuffer);
        const pages = await mergedPdf.copyPages(existingDoc, existingDoc.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Failed to add document ${doc.id}: ${err.message}`);
      }
    }
  }

  // Set metadata
  mergedPdf.setTitle(`Filing Packet - ${caseData.internalId}`);
  mergedPdf.setAuthor('MGR Capital Assistance LLC');
  mergedPdf.setSubject(`Tax Surplus Claim for ${caseData.client.name}`);
  mergedPdf.setCreationDate(new Date());

  return Buffer.from(await mergedPdf.save());
}
```

### 10.7 State-Specific Template Variations

```typescript
// State rules affecting PDF generation
const stateTemplateRules: Record<string, StateTemplateConfig> = {
  TX: {
    requiresNotarization: ['LIMITED_POA', 'AFFIDAVIT'],
    requiresWitnesses: 0,
    additionalDisclosures: [
      'Texas Property Tax Code Section 34.04 applies to this claim.'
    ],
    filingInstructions: 'File with County Tax Assessor-Collector',
    deadlineMonths: 4  // 4 years from tax sale
  },
  FL: {
    requiresNotarization: ['LIMITED_POA', 'AFFIDAVIT'],
    requiresWitnesses: 2,
    additionalDisclosures: [
      'This claim is made pursuant to Florida Statutes Chapter 197.'
    ],
    filingInstructions: 'File with Clerk of Circuit Court',
    deadlineMonths: 24  // 2 years from issuance of tax deed
  },
  CA: {
    requiresNotarization: ['LIMITED_POA', 'AFFIDAVIT'],
    requiresWitnesses: 0,
    additionalDisclosures: [
      'California Revenue and Taxation Code Section 4675 applies.'
    ],
    filingInstructions: 'File with County Tax Collector',
    deadlineMonths: 12  // 1 year from recordation of deed
  },
  GA: {
    requiresNotarization: ['LIMITED_POA', 'AFFIDAVIT'],
    requiresWitnesses: 0,
    additionalDisclosures: [
      'O.C.G.A. § 48-4-5 governs excess tax sale proceeds in Georgia.'
    ],
    filingInstructions: 'File with Superior Court Clerk',
    deadlineMonths: 60  // 5 years
  },
  NC: {
    requiresNotarization: ['LIMITED_POA', 'AFFIDAVIT'],
    requiresWitnesses: 0,
    additionalDisclosures: [
      'N.C. Gen. Stat. § 105-374 applies to this surplus claim.'
    ],
    filingInstructions: 'File with County Finance Office',
    deadlineMonths: 36  // 3 years
  }
};

function getStateDisclosures(state: string): string[] {
  return stateTemplateRules[state]?.additionalDisclosures || [];
}
```

### 10.8 Helper Functions

```typescript
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(client: Client): string {
  const parts = [
    client.address,
    `${client.city}, ${client.state} ${client.zipCode}`
  ].filter(Boolean);
  return parts.join('\n');
}

function getStateName(code: string): string {
  const states: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
    CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
    FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
    KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
    MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
    NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
    OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
  };
  return states[code] || code;
}

function numberToWords(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
                'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
  return num.toString();
}
```

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

### 11.1 Training Module Architecture

The Training Intelligence system provides automated module generation, progress tracking, gap detection, and performance correlation for all employee roles and tiers.

**Core Components:**
- TrainingModule: Base module definitions
- TrainingModuleDetail: AI-generated detailed content per role/tier
- TrainingAssetPlan: Production plans for videos, documents, quizzes
- TrainingProgress: Per-employee completion tracking
- TrainingBot: Automated gap detection and recommendations

### 11.2 Module Structure

| Module ID | Title | Target Roles | Required Tiers | Duration | Quiz Questions |
|-----------|-------|--------------|----------------|----------|----------------|
| M001 | Introduction to MGR Capital | ALL EMPLOYEES | All | 30 min | 10 |
| M002 | Client Communication Basics | EMPLOYEE, TEAM_LEAD | TIER_1, TIER_2 | 45 min | 15 |
| M003 | Compliance & Boundaries | ALL EMPLOYEES | All | 60 min | 20 |
| M004 | Case Processing Procedures | EMPLOYEE, TEAM_LEAD | All | 90 min | 25 |
| M005 | Advanced Negotiation | TEAM_LEAD | TIER_3+ | 60 min | 15 |
| M006 | Team Leadership Essentials | TEAM_LEAD | TIER_4+ | 90 min | 20 |
| M007 | HR Onboarding Procedures | HR | N/A | 120 min | 30 |
| M008 | Compliance Monitoring | COMPLIANCE | N/A | 120 min | 30 |
| M009 | Shadow Accounting (FOUNDER ONLY) | FOUNDER | N/A | 60 min | 0 |

### 11.3 Role-Specific Module Rules

```typescript
// backend/src/services/trainingService.ts

const moduleRequirements: Record<UserRole, string[]> = {
  FOUNDER: ['M001', 'M009'],
  ADMIN: ['M001', 'M003', 'M004'],
  HR: ['M001', 'M003', 'M007'],
  COMPLIANCE: ['M001', 'M003', 'M008'],
  TEAM_LEAD: ['M001', 'M002', 'M003', 'M004', 'M005', 'M006'],
  EMPLOYEE: ['M001', 'M002', 'M003', 'M004'],
  CLIENT: []
};

const tierProgression: Record<EmployeeTier, string[]> = {
  TIER_1_ASSOCIATE: ['M001', 'M002', 'M003'],
  TIER_2_SPECIALIST: ['M001', 'M002', 'M003', 'M004'],
  TIER_3_SENIOR_SPECIALIST: ['M001', 'M002', 'M003', 'M004', 'M005'],
  TIER_4_TEAM_LEADER: ['M001', 'M002', 'M003', 'M004', 'M005', 'M006'],
  TIER_5_EXECUTIVE_PARTNER: ['M001', 'M002', 'M003', 'M004', 'M005', 'M006']
};
```

### 11.4 Training Progress Model

```prisma
model TrainingModule {
  id              String   @id @default(cuid())
  moduleId        String   @unique  // M001, M002, etc.
  title           String
  description     String
  targetRoles     UserRole[]
  targetTiers     EmployeeTier[]
  durationMinutes Int
  isRequired      Boolean  @default(true)
  isActive        Boolean  @default(true)
  version         Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  progress        TrainingProgress[]
  details         TrainingModuleDetail[]
  assets          TrainingAssetPlan[]
}

model TrainingProgress {
  id          String         @id @default(cuid())
  userId      String
  moduleId    String
  status      TrainingStatus @default(NOT_STARTED)
  startedAt   DateTime?
  completedAt DateTime?
  quizScore   Int?           // Percentage (0-100)
  quizPassed  Boolean?
  attempts    Int            @default(0)
  timeSpent   Int            @default(0)  // Minutes
  lastAccess  DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  user        User           @relation(fields: [userId], references: [id])
  module      TrainingModule @relation(fields: [moduleId], references: [id])

  @@unique([userId, moduleId])
}

model TrainingModuleDetail {
  id             String        @id @default(cuid())
  moduleId       String
  role           UserRole
  tier           EmployeeTier?
  outline        Json          // Structured outline
  scripts        Json          // Call scripts, talking points
  keyPoints      Json          // Key learning points
  videoBlueprint Json?         // Video production plan
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  module         TrainingModule @relation(fields: [moduleId], references: [id])

  @@unique([moduleId, role, tier])
}

model TrainingAssetPlan {
  id             String            @id @default(cuid())
  moduleId       String
  assetType      TrainingAssetType
  title          String
  description    String
  specifications Json?
  status         AssetPlanStatus   @default(PLANNED)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  module         TrainingModule    @relation(fields: [moduleId], references: [id])
}

enum TrainingStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  FAILED
  EXPIRED
}

enum TrainingAssetType {
  VIDEO
  DOCUMENT
  QUIZ
  SCRIPT
  INTERACTIVE
}

enum AssetPlanStatus {
  PLANNED
  IN_PRODUCTION
  REVIEW
  PUBLISHED
  ARCHIVED
}
```

### 11.5 TrainingBot Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `identifyGaps()` | Find employees missing required modules | None | `TrainingGap[]` |
| `correlatePerformance()` | Link training to case performance | `employeeId` | `PerformanceCorrelation` |
| `suggestModules()` | Recommend next modules | `employeeId` | `ModuleSuggestion[]` |
| `generateAnalytics()` | Training dashboard data | `timeRange` | `TrainingAnalytics` |
| `detectStaleProgress()` | Find abandoned modules | `staleDays` | `StaleProgress[]` |
| `generateModuleOutline()` | Create module content | `moduleId, role, tier` | `TrainingModuleDetail` |
| `generateAssessment()` | Create quiz questions | `moduleId` | `AssessmentQuestion[]` |

#### identifyGaps() Implementation

```typescript
// backend/src/bots/trainingBot.ts

interface TrainingGap {
  employeeId: string;
  employeeName: string;
  role: UserRole;
  tier: EmployeeTier;
  missingModules: {
    moduleId: string;
    title: string;
    isRequired: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  overallCompliancePercent: number;
}

async function identifyGaps(): Promise<TrainingGap[]> {
  const employees = await prisma.user.findMany({
    where: {
      role: { in: ['EMPLOYEE', 'TEAM_LEAD', 'HR', 'COMPLIANCE'] },
      isActive: true
    },
    include: {
      trainingProgress: true
    }
  });

  const gaps: TrainingGap[] = [];

  for (const employee of employees) {
    const requiredModules = getRequiredModules(employee.role, employee.employeeTier);
    const completedModules = employee.trainingProgress
      .filter(p => p.status === 'COMPLETED')
      .map(p => p.moduleId);

    const missing = requiredModules.filter(m => !completedModules.includes(m));

    if (missing.length > 0) {
      gaps.push({
        employeeId: employee.id,
        employeeName: employee.name,
        role: employee.role,
        tier: employee.employeeTier,
        missingModules: missing.map(moduleId => ({
          moduleId,
          title: getModuleTitle(moduleId),
          isRequired: true,
          priority: getPriority(moduleId, employee.employeeTier)
        })),
        overallCompliancePercent: Math.round(
          (completedModules.length / requiredModules.length) * 100
        )
      });
    }
  }

  return gaps.sort((a, b) => a.overallCompliancePercent - b.overallCompliancePercent);
}
```

#### correlatePerformance() Implementation

```typescript
interface PerformanceCorrelation {
  employeeId: string;
  trainingScore: number;       // 0-100
  caseSuccessRate: number;     // 0-100
  avgProcessingDays: number;
  correlationStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  insights: string[];
}

async function correlatePerformance(employeeId: string): Promise<PerformanceCorrelation> {
  const progress = await prisma.trainingProgress.findMany({
    where: { userId: employeeId, status: 'COMPLETED' }
  });

  const cases = await prisma.case.findMany({
    where: { assignedToId: employeeId }
  });

  const avgQuizScore = progress.length > 0
    ? progress.reduce((sum, p) => sum + (p.quizScore || 0), 0) / progress.length
    : 0;

  const closedCases = cases.filter(c => c.status === 'PAID' || c.status === 'CLOSED');
  const successRate = cases.length > 0
    ? (closedCases.length / cases.length) * 100
    : 0;

  const avgDays = calculateAvgProcessingDays(cases);

  const correlation = calculateCorrelation(avgQuizScore, successRate);

  return {
    employeeId,
    trainingScore: avgQuizScore,
    caseSuccessRate: successRate,
    avgProcessingDays: avgDays,
    correlationStrength: correlation,
    insights: generateInsights(avgQuizScore, successRate, avgDays)
  };
}
```

### 11.6 Assessment Generation

```typescript
interface AssessmentQuestion {
  id: string;
  moduleId: string;
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SCENARIO';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
}

// Example assessment for M002 (Client Communication Basics)
const m002Assessment: AssessmentQuestion[] = [
  {
    id: 'M002_Q1',
    moduleId: 'M002',
    questionType: 'MULTIPLE_CHOICE',
    question: 'When a client asks about the status of their case, you should:',
    options: [
      'Tell them the exact surplus amount',
      'Provide a general status update without financial details',
      'Transfer them to the founder',
      'Ask them to check the portal'
    ],
    correctAnswer: 1,
    explanation: 'Employees should never reveal financial details. Provide general status updates and direct them to the portal for more information.',
    difficulty: 'MEDIUM',
    points: 10
  },
  {
    id: 'M002_Q2',
    moduleId: 'M002',
    questionType: 'SCENARIO',
    question: 'A client says "This sounds too good to be true. How do I know you\'re legitimate?" What is the best response?',
    options: [
      'Explain our fee structure and how we get paid',
      'Get defensive and end the call',
      'Acknowledge their concern, explain our process briefly, and offer to send written information',
      'Tell them to Google us'
    ],
    correctAnswer: 2,
    explanation: 'Acknowledging concerns builds trust. Offering written information provides legitimacy without revealing internal details.',
    difficulty: 'HARD',
    points: 15
  }
];
```

### 11.7 HR Panel Integration

```typescript
// GET /api/hr/training-compliance
interface TrainingComplianceDashboard {
  overallCompliance: number;  // Percentage
  byRole: {
    role: UserRole;
    compliance: number;
    totalEmployees: number;
    fullyCompliant: number;
  }[];
  byTier: {
    tier: EmployeeTier;
    compliance: number;
    totalEmployees: number;
  }[];
  overdueTraining: {
    employeeId: string;
    employeeName: string;
    modules: string[];
    daysSinceRequired: number;
  }[];
  recentCompletions: {
    employeeId: string;
    employeeName: string;
    moduleId: string;
    completedAt: Date;
    score: number;
  }[];
}
```

### 11.8 Compliance Panel Integration

```typescript
// GET /api/compliance/training-audit
interface TrainingAudit {
  auditDate: Date;
  totalEmployees: number;
  compliantEmployees: number;
  nonCompliantEmployees: number;
  complianceRate: number;
  flags: {
    employeeId: string;
    employeeName: string;
    flagType: 'OVERDUE' | 'FAILED_QUIZ' | 'INCOMPLETE' | 'EXPIRED';
    details: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  recommendations: string[];
}
```

---

## 12. INGESTION INTELLIGENCE BLUEPRINT

### 12.1 Ingestion Architecture Overview

The Ingestion Intelligence system handles all data acquisition from external sources, including manual file uploads, automated web scraping, and API integrations.

**Core Components:**
- IngestionBatch: Tracks each ingestion job
- ScrapedItem: Individual records from scrapers
- IngestionBot: Automated analysis and recommendations
- ScraperService: Web scraping engine
- WatchService: Rule change monitoring

### 12.2 Data Sources

| Source Type | Format | Frequency | Priority States | Estimated Volume |
|-------------|--------|-----------|-----------------|------------------|
| County Tax Sale Lists | CSV/Excel | Weekly | TX, FL, CA, GA, NC | 500-5000 records/week |
| Surplus Fund Notices | PDF | Daily | All active states | 50-200 records/day |
| State Unclaimed Property | Web scrape | Monthly | All 50 states | 10000+ records/month |
| Foreclosure Lists | CSV | Weekly | High-volume counties | 200-1000 records/week |
| Probate Records | PDF | Weekly | Select counties | 50-100 records/week |

### 12.3 Parsing Functions

#### parseTaxSaleCSV()

```typescript
// backend/src/services/ingestionService.ts

interface TaxSaleRecord {
  parcelNumber: string;
  ownerName: string;
  ownerAddress?: string;
  propertyAddress: string;
  saleDate: Date;
  saleAmount: number;
  surplusAmount?: number;
  county: string;
  state: string;
  source: string;
  rawData: Record<string, any>;
}

interface SourceConfig {
  id: string;
  name: string;
  state: string;
  county: string;
  columns: {
    parcel: string;
    owner: string;
    ownerAddress?: string;
    address: string;
    saleDate: string;
    saleAmount: string;
    surplus?: string;
  };
  dateFormat: string;
  currencyFormat: 'USD' | 'CENTS';
  skipRows?: number;
  encoding?: string;
}

async function parseTaxSaleCSV(
  file: Buffer,
  config: SourceConfig
): Promise<{ records: TaxSaleRecord[]; errors: string[]; stats: ParseStats }> {
  const errors: string[] = [];
  const stats: ParseStats = { total: 0, valid: 0, invalid: 0, duplicates: 0 };

  // 1. Detect and convert encoding
  const encoding = config.encoding || detectEncoding(file);
  const content = iconv.decode(file, encoding);

  // 2. Parse CSV with headers
  const parseResult = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase()
  });

  if (parseResult.errors.length > 0) {
    errors.push(...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`));
  }

  stats.total = parseResult.data.length;

  // 3. Map and validate each row
  const records: TaxSaleRecord[] = [];

  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i] as Record<string, string>;

    try {
      const record: TaxSaleRecord = {
        parcelNumber: normalizeParcelNumber(row[config.columns.parcel]),
        ownerName: normalizeOwnerName(row[config.columns.owner]),
        ownerAddress: config.columns.ownerAddress ? row[config.columns.ownerAddress] : undefined,
        propertyAddress: normalizeAddress(row[config.columns.address]),
        saleDate: parseDate(row[config.columns.saleDate], config.dateFormat),
        saleAmount: parseCurrency(row[config.columns.saleAmount], config.currencyFormat),
        surplusAmount: config.columns.surplus
          ? parseCurrency(row[config.columns.surplus], config.currencyFormat)
          : undefined,
        county: config.county,
        state: config.state,
        source: config.id,
        rawData: row
      };

      // Validate required fields
      const validation = validateTaxSaleRecord(record);
      if (validation.valid) {
        records.push(record);
        stats.valid++;
      } else {
        errors.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
        stats.invalid++;
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: Parse error - ${err.message}`);
      stats.invalid++;
    }
  }

  return { records, errors, stats };
}
```

#### parseSurplusPDF()

```typescript
async function parseSurplusPDF(
  file: Buffer,
  config: PDFConfig
): Promise<{ records: TaxSaleRecord[]; errors: string[]; stats: ParseStats }> {
  const errors: string[] = [];
  const stats: ParseStats = { total: 0, valid: 0, invalid: 0, duplicates: 0 };

  // 1. Extract text from PDF
  const pdfData = await pdfParse(file);
  const text = pdfData.text;

  // 2. Split into pages/sections
  const pages = text.split(/\f|\n{3,}/);

  // 3. Apply state-specific parsing patterns
  const patterns = getPDFPatterns(config.state);
  const records: TaxSaleRecord[] = [];

  for (const page of pages) {
    // Try table extraction first
    const tableRecords = extractTableRecords(page, patterns.table);
    if (tableRecords.length > 0) {
      records.push(...tableRecords);
      continue;
    }

    // Fall back to line-by-line extraction
    const lines = page.split('\n');
    for (const line of lines) {
      const match = line.match(patterns.line);
      if (match) {
        try {
          const record = parseMatchedRecord(match, config);
          if (validateTaxSaleRecord(record).valid) {
            records.push(record);
            stats.valid++;
          }
        } catch (err) {
          errors.push(`Parse error: ${err.message}`);
          stats.invalid++;
        }
      }
    }
  }

  stats.total = records.length + stats.invalid;
  return { records, errors, stats };
}

// State-specific PDF patterns
const pdfPatterns: Record<string, PDFPatterns> = {
  TX: {
    table: /(\d{2,}-\d{2,}-\d{2,}-\d{2,})\s+(.+?)\s+\$?([\d,]+\.\d{2})/g,
    line: /^(\d{2,}-\d{2,}-\d{2,}-\d{2,})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/
  },
  FL: {
    table: /([A-Z0-9]{10,})\s+(.+?)\s+\$?([\d,]+\.\d{2})/g,
    line: /^([A-Z0-9]{10,})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/
  },
  CA: {
    table: /(\d{3}-\d{3}-\d{3})\s+(.+?)\s+\$?([\d,]+\.\d{2})/g,
    line: /^(\d{3}-\d{3}-\d{3})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/
  }
};
```

#### parseProbateListCSV()

```typescript
interface ProbateRecord {
  caseNumber: string;
  decedentName: string;
  filingDate: Date;
  estatValue?: number;
  propertyAddresses: string[];
  county: string;
  state: string;
}

async function parseProbateListCSV(
  file: Buffer,
  config: SourceConfig
): Promise<{ records: ProbateRecord[]; errors: string[] }> {
  // Similar to parseTaxSaleCSV but with probate-specific fields
  // ... implementation
}
```

### 12.4 IngestionBot Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `analyzeIngestionPatterns()` | Detect format changes in sources | `sourceId` | `PatternAnalysis` |
| `detectDuplicates()` | Find records matching existing cases | `records[]` | `DuplicateReport` |
| `assessSourceHealth()` | Monitor source reliability | `sourceId` | `SourceHealthReport` |
| `prioritizeRecords()` | Flag high-value records for immediate processing | `records[]` | `PrioritizedRecords` |
| `generateSourceReport()` | Per-source ingestion statistics | `timeRange` | `SourceReport` |
| `detectAnomalies()` | Find unusual patterns in data | `batchId` | `AnomalyReport` |

#### analyzeIngestionPatterns() Implementation

```typescript
interface PatternAnalysis {
  sourceId: string;
  lastIngestion: Date;
  formatChanges: {
    field: string;
    oldPattern: string;
    newPattern: string;
    confidence: number;
  }[];
  columnChanges: {
    added: string[];
    removed: string[];
    renamed: { old: string; new: string }[];
  };
  recommendations: string[];
}

async function analyzeIngestionPatterns(sourceId: string): Promise<PatternAnalysis> {
  // Get last 5 ingestion batches for this source
  const batches = await prisma.ingestionBatch.findMany({
    where: { sourceId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (batches.length < 2) {
    return { sourceId, lastIngestion: new Date(), formatChanges: [], columnChanges: { added: [], removed: [], renamed: [] }, recommendations: [] };
  }

  const latest = batches[0];
  const previous = batches[1];

  // Compare column structures
  const latestColumns = new Set(Object.keys(latest.sampleRecord || {}));
  const previousColumns = new Set(Object.keys(previous.sampleRecord || {}));

  const added = [...latestColumns].filter(c => !previousColumns.has(c));
  const removed = [...previousColumns].filter(c => !latestColumns.has(c));

  // Detect renamed columns (similar data patterns)
  const renamed: { old: string; new: string }[] = [];
  for (const oldCol of removed) {
    for (const newCol of added) {
      if (detectSimilarData(previous.sampleRecord[oldCol], latest.sampleRecord[newCol])) {
        renamed.push({ old: oldCol, new: newCol });
      }
    }
  }

  const recommendations: string[] = [];
  if (added.length > 0) recommendations.push(`New columns detected: ${added.join(', ')}. Update source config.`);
  if (removed.length > 0) recommendations.push(`Columns removed: ${removed.join(', ')}. Verify source config.`);

  return {
    sourceId,
    lastIngestion: latest.createdAt,
    formatChanges: [],
    columnChanges: { added, removed, renamed },
    recommendations
  };
}
```

#### detectDuplicates() Implementation

```typescript
interface DuplicateReport {
  totalChecked: number;
  duplicatesFound: number;
  duplicates: {
    newRecord: TaxSaleRecord;
    existingCaseId: string;
    matchType: 'EXACT' | 'PROBABLE' | 'POSSIBLE';
    matchScore: number;
    matchedFields: string[];
  }[];
}

async function detectDuplicates(records: TaxSaleRecord[]): Promise<DuplicateReport> {
  const duplicates: DuplicateReport['duplicates'] = [];

  for (const record of records) {
    // Check for exact parcel match
    const exactMatch = await prisma.case.findFirst({
      where: {
        parcelNumber: record.parcelNumber,
        state: record.state,
        county: record.county
      }
    });

    if (exactMatch) {
      duplicates.push({
        newRecord: record,
        existingCaseId: exactMatch.id,
        matchType: 'EXACT',
        matchScore: 100,
        matchedFields: ['parcelNumber', 'state', 'county']
      });
      continue;
    }

    // Check for address match
    const addressMatch = await prisma.case.findFirst({
      where: {
        propertyAddress: { contains: record.propertyAddress, mode: 'insensitive' },
        state: record.state
      }
    });

    if (addressMatch) {
      duplicates.push({
        newRecord: record,
        existingCaseId: addressMatch.id,
        matchType: 'PROBABLE',
        matchScore: 85,
        matchedFields: ['propertyAddress', 'state']
      });
      continue;
    }

    // Check for owner name + county match
    const ownerMatch = await prisma.client.findFirst({
      where: {
        name: { contains: record.ownerName, mode: 'insensitive' }
      },
      include: { cases: true }
    });

    if (ownerMatch && ownerMatch.cases.some(c => c.county === record.county)) {
      const matchedCase = ownerMatch.cases.find(c => c.county === record.county);
      duplicates.push({
        newRecord: record,
        existingCaseId: matchedCase!.id,
        matchType: 'POSSIBLE',
        matchScore: 60,
        matchedFields: ['ownerName', 'county']
      });
    }
  }

  return {
    totalChecked: records.length,
    duplicatesFound: duplicates.length,
    duplicates
  };
}
```

### 12.5 Scraper Service

```typescript
// backend/src/services/scraperService.ts

interface ScraperConfig {
  id: string;
  name: string;
  state: string;
  county: string;
  url: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  lastRun?: Date;
  lastSuccess?: Date;
  errorCount: number;
  selectors: {
    table: string;
    row: string;
    pagination?: string;
    fields: Record<string, string>;
  };
  transforms: Record<string, (val: string) => any>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  waitFor?: string;  // CSS selector to wait for
  javascript?: boolean;  // Requires headless browser
}

// Priority state scraper configurations
const scraperConfigs: ScraperConfig[] = [
  {
    id: 'harris_county_tx',
    name: 'Harris County, TX Tax Sale',
    state: 'TX',
    county: 'Harris',
    url: 'https://www.hctax.net/Property/TaxSales',
    frequency: 'weekly',
    isActive: true,
    errorCount: 0,
    selectors: {
      table: '#taxSaleTable',
      row: 'tbody tr',
      pagination: '.pagination a.next',
      fields: {
        parcel: 'td:nth-child(1)',
        address: 'td:nth-child(2)',
        owner: 'td:nth-child(3)',
        saleDate: 'td:nth-child(4)',
        amount: 'td:nth-child(5)'
      }
    },
    transforms: {
      amount: parseCurrency,
      saleDate: (v) => parseDate(v, 'MM/DD/YYYY')
    },
    javascript: true
  },
  {
    id: 'miami_dade_fl',
    name: 'Miami-Dade County, FL Surplus',
    state: 'FL',
    county: 'Miami-Dade',
    url: 'https://www.miamidade.gov/finance/surplus-funds.asp',
    frequency: 'weekly',
    isActive: true,
    errorCount: 0,
    selectors: {
      table: '.surplus-table',
      row: 'tr.data-row',
      fields: {
        folio: 'td.folio',
        address: 'td.address',
        owner: 'td.owner',
        surplus: 'td.amount'
      }
    },
    transforms: {
      surplus: parseCurrency
    },
    javascript: false
  },
  {
    id: 'los_angeles_ca',
    name: 'Los Angeles County, CA Tax Sale',
    state: 'CA',
    county: 'Los Angeles',
    url: 'https://ttc.lacounty.gov/excess-proceeds/',
    frequency: 'weekly',
    isActive: true,
    errorCount: 0,
    selectors: {
      table: '#excess-proceeds-table',
      row: 'tbody tr',
      fields: {
        ain: 'td:nth-child(1)',
        address: 'td:nth-child(2)',
        owner: 'td:nth-child(3)',
        amount: 'td:nth-child(4)'
      }
    },
    transforms: {
      amount: parseCurrency
    },
    javascript: true,
    waitFor: '#excess-proceeds-table'
  }
];

async function runScraper(configId: string): Promise<ScraperResult> {
  const config = scraperConfigs.find(c => c.id === configId);
  if (!config) throw new Error(`Unknown scraper: ${configId}`);
  if (!config.isActive) throw new Error(`Scraper ${configId} is disabled`);

  const startTime = Date.now();
  const result: ScraperResult = {
    configId,
    startedAt: new Date(),
    records: [],
    errors: [],
    pagesProcessed: 0,
    success: false
  };

  try {
    let page: string;

    if (config.javascript) {
      // Use Puppeteer for JavaScript-rendered pages
      const browser = await puppeteer.launch({ headless: 'new' });
      const browserPage = await browser.newPage();

      if (config.headers) {
        await browserPage.setExtraHTTPHeaders(config.headers);
      }

      await browserPage.goto(config.url, { waitUntil: 'networkidle2' });

      if (config.waitFor) {
        await browserPage.waitForSelector(config.waitFor, { timeout: 30000 });
      }

      page = await browserPage.content();
      await browser.close();
    } else {
      // Use simple fetch for static pages
      const response = await fetch(config.url, {
        headers: config.headers || {}
      });
      page = await response.text();
    }

    // Parse with cheerio
    const $ = cheerio.load(page);

    $(config.selectors.table).find(config.selectors.row).each((i, row) => {
      try {
        const record: Partial<ScrapedItem> = {
          sourceType: 'TAX_SALE',
          sourceUrl: config.url,
          state: config.state,
          county: config.county,
          rawContent: $(row).html() || '',
          parsedData: {},
          reviewStatus: 'PENDING'
        };

        for (const [field, selector] of Object.entries(config.selectors.fields)) {
          let value = $(row).find(selector).text().trim();
          if (config.transforms[field]) {
            value = config.transforms[field](value);
          }
          (record.parsedData as any)[field] = value;
        }

        result.records.push(record as ScrapedItem);
      } catch (err) {
        result.errors.push(`Row ${i}: ${err.message}`);
      }
    });

    result.pagesProcessed = 1;
    result.success = true;
    result.completedAt = new Date();
    result.duration = Date.now() - startTime;

    // Update config stats
    await updateScraperStats(configId, true);

  } catch (err) {
    result.errors.push(`Scraper error: ${err.message}`);
    result.success = false;
    result.completedAt = new Date();
    result.duration = Date.now() - startTime;

    // Update error count
    await updateScraperStats(configId, false);
  }

  return result;
}
```

### 12.6 Watch Service (Rule Change Detection)

```typescript
// backend/src/services/watchService.ts

interface WatchTarget {
  id: string;
  name: string;
  state: string;
  county?: string;
  url: string;
  targetType: 'RULES_PAGE' | 'DEADLINE_PAGE' | 'FEE_SCHEDULE' | 'FORM_LIBRARY';
  contentHash?: string;
  lastChecked?: Date;
  lastChanged?: Date;
  checkFrequency: 'daily' | 'weekly';
  isActive: boolean;
  selectors?: {
    content: string;  // CSS selector for monitored content
    ignore?: string[];  // Selectors to ignore (ads, dates, etc.)
  };
}

// Watch targets for priority jurisdictions
const watchTargets: WatchTarget[] = [
  {
    id: 'tx_surplus_rules',
    name: 'Texas Surplus Rules',
    state: 'TX',
    url: 'https://comptroller.texas.gov/taxes/property-tax/excess-proceeds/',
    targetType: 'RULES_PAGE',
    checkFrequency: 'weekly',
    isActive: true,
    selectors: {
      content: '.content-main',
      ignore: ['.date-modified', '.social-share']
    }
  },
  {
    id: 'fl_redemption_deadlines',
    name: 'Florida Redemption Deadlines',
    state: 'FL',
    url: 'https://floridarevenue.com/property/',
    targetType: 'DEADLINE_PAGE',
    checkFrequency: 'weekly',
    isActive: true
  }
];

async function checkForChanges(targetId: string): Promise<WatchAlert | null> {
  const target = watchTargets.find(t => t.id === targetId);
  if (!target || !target.isActive) return null;

  try {
    // 1. Fetch current content
    const response = await fetch(target.url);
    const html = await response.text();

    // 2. Extract relevant content
    const $ = cheerio.load(html);
    let content: string;

    if (target.selectors?.content) {
      content = $(target.selectors.content).text();
      // Remove ignored sections
      if (target.selectors.ignore) {
        for (const ignore of target.selectors.ignore) {
          $(ignore).remove();
        }
        content = $(target.selectors.content).text();
      }
    } else {
      content = $('body').text();
    }

    // Normalize whitespace
    content = content.replace(/\s+/g, ' ').trim();

    // 3. Calculate hash
    const currentHash = crypto.createHash('sha256').update(content).digest('hex');

    // 4. Compare with stored hash
    const stored = await prisma.watchTarget.findUnique({ where: { id: targetId } });

    if (stored?.contentHash && stored.contentHash !== currentHash) {
      // Content changed - create alert
      const alert = await prisma.watchAlert.create({
        data: {
          type: 'RULE_CHANGE',
          severity: 'HIGH',
          title: `Rules changed: ${target.name}`,
          message: `The monitored page "${target.name}" at ${target.url} has changed. Please review for rule updates that may affect case processing.`,
          state: target.state,
          county: target.county,
          relatedId: targetId,
          relatedType: 'WatchTarget'
        }
      });

      // Update stored hash and lastChanged
      await prisma.watchTarget.update({
        where: { id: targetId },
        data: {
          contentHash: currentHash,
          lastChecked: new Date(),
          lastChanged: new Date()
        }
      });

      return alert;
    }

    // 5. Update lastChecked (no change)
    await prisma.watchTarget.update({
      where: { id: targetId },
      data: {
        contentHash: currentHash,
        lastChecked: new Date()
      }
    });

    return null;

  } catch (err) {
    // Create error alert
    await prisma.watchAlert.create({
      data: {
        type: 'SCRAPE_ERROR',
        severity: 'MEDIUM',
        title: `Watch check failed: ${target.name}`,
        message: `Failed to check ${target.url}: ${err.message}`,
        state: target.state,
        county: target.county
      }
    });

    return null;
  }
}

async function runWatchCycle(): Promise<WatchCycleResult> {
  const activeTargets = watchTargets.filter(t => t.isActive);
  const results: WatchCycleResult = {
    startedAt: new Date(),
    targetsChecked: 0,
    changesDetected: 0,
    errors: 0,
    alerts: []
  };

  for (const target of activeTargets) {
    // Check if due based on frequency
    const stored = await prisma.watchTarget.findUnique({ where: { id: target.id } });
    if (stored?.lastChecked) {
      const hoursSince = (Date.now() - stored.lastChecked.getTime()) / (1000 * 60 * 60);
      const threshold = target.checkFrequency === 'daily' ? 24 : 168;
      if (hoursSince < threshold) continue;
    }

    const alert = await checkForChanges(target.id);
    results.targetsChecked++;

    if (alert) {
      results.changesDetected++;
      results.alerts.push(alert);
    }
  }

  results.completedAt = new Date();
  return results;
}
```

### 12.7 High-Value Case Detection

```typescript
const HIGH_VALUE_THRESHOLD_CENTS = 1000000; // $10,000
const VERY_HIGH_VALUE_THRESHOLD_CENTS = 5000000; // $50,000
const EXTREME_VALUE_THRESHOLD_CENTS = 10000000; // $100,000

async function flagHighValueRecords(records: TaxSaleRecord[]): Promise<HighValueReport> {
  const report: HighValueReport = {
    total: records.length,
    highValue: [],
    veryHighValue: [],
    extremeValue: []
  };

  for (const record of records) {
    if (!record.surplusAmount) continue;

    if (record.surplusAmount >= EXTREME_VALUE_THRESHOLD_CENTS) {
      report.extremeValue.push(record);
      await createHighValueAlert(record, 'CRITICAL');
    } else if (record.surplusAmount >= VERY_HIGH_VALUE_THRESHOLD_CENTS) {
      report.veryHighValue.push(record);
      await createHighValueAlert(record, 'HIGH');
    } else if (record.surplusAmount >= HIGH_VALUE_THRESHOLD_CENTS) {
      report.highValue.push(record);
      await createHighValueAlert(record, 'MEDIUM');
    }
  }

  return report;
}

async function createHighValueAlert(
  record: TaxSaleRecord,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
): Promise<WatchAlert> {
  const formattedAmount = (record.surplusAmount! / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });

  return prisma.watchAlert.create({
    data: {
      type: 'HIGH_VALUE_CASE',
      severity,
      title: `High-value surplus: ${formattedAmount}`,
      message: [
        `Property: ${record.propertyAddress}`,
        `Owner: ${record.ownerName}`,
        `County: ${record.county}, ${record.state}`,
        `Surplus: ${formattedAmount}`,
        `Sale Date: ${record.saleDate?.toISOString().split('T')[0] || 'Unknown'}`
      ].join('\n'),
      state: record.state,
      county: record.county
    }
  });
}
```

### 12.8 Batch Processing Flow

```typescript
interface IngestionBatchResult {
  batchId: string;
  source: string;
  startedAt: Date;
  completedAt: Date;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  stats: {
    totalRecords: number;
    newCases: number;
    duplicates: number;
    errors: number;
    highValue: number;
  };
  errors: string[];
}

async function processIngestionBatch(
  file: Buffer,
  sourceConfig: SourceConfig
): Promise<IngestionBatchResult> {
  // 1. Create batch record
  const batch = await prisma.ingestionBatch.create({
    data: {
      sourceId: sourceConfig.id,
      status: 'PROCESSING',
      startedAt: new Date()
    }
  });

  const result: IngestionBatchResult = {
    batchId: batch.id,
    source: sourceConfig.id,
    startedAt: batch.startedAt,
    completedAt: new Date(),
    status: 'COMPLETED',
    stats: { totalRecords: 0, newCases: 0, duplicates: 0, errors: 0, highValue: 0 },
    errors: []
  };

  try {
    // 2. Parse file based on type
    const parseResult = await parseTaxSaleCSV(file, sourceConfig);
    result.stats.totalRecords = parseResult.stats.total;
    result.errors.push(...parseResult.errors);

    // 3. Detect duplicates
    const dupReport = await detectDuplicates(parseResult.records);
    result.stats.duplicates = dupReport.duplicatesFound;

    // 4. Filter out duplicates
    const newRecords = parseResult.records.filter(
      r => !dupReport.duplicates.some(d => d.newRecord.parcelNumber === r.parcelNumber)
    );

    // 5. Flag high-value records
    const hvReport = await flagHighValueRecords(newRecords);
    result.stats.highValue = hvReport.highValue.length + hvReport.veryHighValue.length + hvReport.extremeValue.length;

    // 6. Create cases for new records
    for (const record of newRecords) {
      try {
        await createCaseFromRecord(record, batch.id);
        result.stats.newCases++;
      } catch (err) {
        result.errors.push(`Failed to create case for ${record.parcelNumber}: ${err.message}`);
        result.stats.errors++;
      }
    }

    // 7. Update batch status
    await prisma.ingestionBatch.update({
      where: { id: batch.id },
      data: {
        status: result.stats.errors > 0 ? 'PARTIAL' : 'COMPLETED',
        completedAt: new Date(),
        recordCount: result.stats.totalRecords,
        successCount: result.stats.newCases,
        errorCount: result.stats.errors
      }
    });

  } catch (err) {
    result.status = 'FAILED';
    result.errors.push(`Batch processing failed: ${err.message}`);

    await prisma.ingestionBatch.update({
      where: { id: batch.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: err.message
      }
    });
  }

  result.completedAt = new Date();
  return result;
}
```

---

## 13. BACKUPS PLAYBOOK

### 13.1 Backup Architecture Overview

The backup system follows the 3-2-1 rule:
- **3** copies of data (production + 2 backups)
- **2** different storage media (local disk + remote)
- **1** offsite copy (air-gapped or remote location)

**Components:**
- PostgreSQL database (critical)
- Document Vault files (critical)
- Application configuration (important)
- Audit logs (compliance requirement)

### 13.2 Components to Backup

| Component | Location | Method | Frequency | Retention | Priority |
|-----------|----------|--------|-----------|-----------|----------|
| PostgreSQL Database | localhost:5432 | pg_dump | Every 6 hours | 90 days rolling | CRITICAL |
| Document Vault | backend/storage/documents/ | rsync | Hourly | 1 year | CRITICAL |
| Configuration | .env, secrets | Manual/encrypted | On change | Forever | HIGH |
| Prisma Schema | backend/prisma/schema.prisma | Git | On change | Forever | HIGH |
| Audit Logs | Database + files | pg_dump + rsync | Daily | 7 years (legal) | HIGH |
| Application Logs | /var/log/mgr/ | logrotate | Daily | 30 days | MEDIUM |

### 13.3 PostgreSQL Backup Commands

```bash
#!/bin/bash
# /opt/mgr/scripts/backup_db.sh

set -euo pipefail

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="mgr_capital"
BACKUP_DIR="/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mgr_capital_${TIMESTAMP}.dump.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Full database dump (custom format, maximum compression)
echo "[$(date)] Starting database backup..."
pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -Z 9 \
  -v \
  -f "${BACKUP_FILE}"

# Verify backup
echo "[$(date)] Verifying backup..."
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup verified successfully: ${BACKUP_FILE}"
  echo "[$(date)] Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
else
  echo "[$(date)] ERROR: Backup verification failed!"
  exit 1
fi

# Schema-only backup (for documentation)
echo "[$(date)] Creating schema backup..."
pg_dump \
  -h "${DB_HOST}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --schema-only \
  -f "${BACKUP_DIR}/schema_${TIMESTAMP}.sql"

echo "[$(date)] Database backup completed successfully"
```

### 13.4 Document Vault Backup

```bash
#!/bin/bash
# /opt/mgr/scripts/backup_vault.sh

set -euo pipefail

SOURCE_DIR="/app/storage/documents"
BACKUP_BASE="/backups/documents"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Hourly incremental to local
rsync -av --delete \
  --backup \
  --backup-dir="${BACKUP_BASE}/incremental/${TIMESTAMP}" \
  "${SOURCE_DIR}/" \
  "${BACKUP_BASE}/current/"

echo "[$(date)] Document vault backup completed"
echo "[$(date)] Source size: $(du -sh "${SOURCE_DIR}" | cut -f1)"
echo "[$(date)] Backup size: $(du -sh "${BACKUP_BASE}/current" | cut -f1)"
```

### 13.5 Restore Commands

```bash
#!/bin/bash
# /opt/mgr/scripts/restore_db.sh

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file> [target_database]"
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-mgr_capital}"
DB_HOST="localhost"
DB_USER="postgres"

# Safety check
if [ "${TARGET_DB}" == "mgr_capital" ]; then
  echo "WARNING: This will replace the production database!"
  read -p "Type 'RESTORE' to confirm: " confirm
  if [ "${confirm}" != "RESTORE" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Stop application
echo "[$(date)] Stopping application..."
systemctl stop mgr-backend || true

# Create restore point
echo "[$(date)] Creating restore point..."
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${TARGET_DB}" \
  -F c -f "/backups/db/pre_restore_$(date +%Y%m%d_%H%M%S).dump" || true

# Restore
echo "[$(date)] Restoring database from ${BACKUP_FILE}..."
pg_restore \
  -h "${DB_HOST}" \
  -U "${DB_USER}" \
  -d "${TARGET_DB}" \
  -c \
  -F c \
  -v \
  "${BACKUP_FILE}"

# Verify
echo "[$(date)] Verifying restore..."
psql -h "${DB_HOST}" -U "${DB_USER}" -d "${TARGET_DB}" \
  -c "SELECT COUNT(*) FROM \"User\"; SELECT COUNT(*) FROM \"Case\";"

# Restart application
echo "[$(date)] Restarting application..."
systemctl start mgr-backend

echo "[$(date)] Restore completed successfully"
```

### 13.6 Cron Schedule

```cron
# /etc/cron.d/mgr-backups
# MGR Capital Assistance Backup Schedule

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=alerts@mgrcapital.internal

# Hourly: Document vault incremental
0 * * * * root /opt/mgr/scripts/backup_vault.sh >> /var/log/mgr/backup-vault.log 2>&1

# Every 6 hours: Database snapshot (0:00, 6:00, 12:00, 18:00)
0 */6 * * * root /opt/mgr/scripts/backup_db.sh >> /var/log/mgr/backup-db.log 2>&1

# Daily at 2 AM: Full database dump + verification
0 2 * * * root /opt/mgr/scripts/daily_backup.sh >> /var/log/mgr/backup-daily.log 2>&1

# Daily at 3 AM: Cleanup old backups
0 3 * * * root /opt/mgr/scripts/cleanup_backups.sh >> /var/log/mgr/backup-cleanup.log 2>&1

# Weekly on Sunday at 4 AM: Full archive + offsite sync
0 4 * * 0 root /opt/mgr/scripts/weekly_backup.sh >> /var/log/mgr/backup-weekly.log 2>&1

# Monthly on 1st at 5 AM: Long-term archive
0 5 1 * * root /opt/mgr/scripts/monthly_archive.sh >> /var/log/mgr/backup-monthly.log 2>&1

# Quarterly: Test restore procedure (manual trigger required)
# 0 6 1 1,4,7,10 * root /opt/mgr/scripts/test_restore.sh >> /var/log/mgr/backup-test.log 2>&1
```

### 13.7 Retention Policy

| Backup Type | Frequency | Retention | Storage Location | Encrypted |
|-------------|-----------|-----------|------------------|-----------|
| Hourly vault | Every hour | 24 hours | Local SSD | No |
| 6-hour DB | Every 6 hours | 7 days | Local SSD | No |
| Daily DB | Daily at 2 AM | 30 days | Local HDD | Yes |
| Weekly archive | Sunday at 4 AM | 90 days | Local HDD + Remote | Yes |
| Monthly archive | 1st of month | 1 year | Local HDD + Remote + Offsite | Yes |
| Annual archive | January 1st | 7 years | Remote + Offsite | Yes |

### 13.8 Encryption Guidance

```bash
#!/bin/bash
# /opt/mgr/scripts/encrypt_backup.sh

set -euo pipefail

BACKUP_FILE="$1"
KEY_FILE="/etc/mgr/backup.key"
OUTPUT_FILE="${BACKUP_FILE}.gpg"

# Verify key file exists
if [ ! -f "${KEY_FILE}" ]; then
  echo "ERROR: Encryption key not found at ${KEY_FILE}"
  exit 1
fi

# Encrypt with AES-256
gpg --cipher-algo AES256 \
    --symmetric \
    --batch \
    --yes \
    --passphrase-file "${KEY_FILE}" \
    --output "${OUTPUT_FILE}" \
    "${BACKUP_FILE}"

# Verify encryption
gpg --batch --passphrase-file "${KEY_FILE}" \
    --decrypt "${OUTPUT_FILE}" 2>/dev/null | head -c 1000 > /dev/null

if [ $? -eq 0 ]; then
  echo "Encryption verified: ${OUTPUT_FILE}"
  # Securely delete unencrypted file
  shred -n 3 -z -u "${BACKUP_FILE}"
else
  echo "ERROR: Encryption verification failed!"
  rm -f "${OUTPUT_FILE}"
  exit 1
fi
```

### 13.9 Disaster Recovery

| Scenario | RPO (Max Data Loss) | RTO (Time to Recover) | Procedure |
|----------|---------------------|----------------------|-----------|
| Database corruption | 6 hours | 2 hours | Restore from latest verified backup |
| Full server failure | 6 hours | 4 hours | Provision new server, restore all |
| Ransomware attack | 24 hours | 8 hours | Isolate, restore from offsite backup |
| Data center failure | 24 hours | 24 hours | Activate DR site, restore from offsite |
| Natural disaster | 24 hours | 48 hours | Restore from air-gapped offsite backup |

**Recovery Procedure:**

1. **ASSESS**: Determine scope and cause of incident
2. **ISOLATE**: Disconnect affected systems from network
3. **NOTIFY**: Alert founder and key personnel
4. **SELECT**: Choose appropriate recovery point
5. **PROVISION**: Prepare recovery environment (if needed)
6. **RESTORE DATABASE**: Execute restore script
7. **RESTORE VAULT**: Sync document vault from backup
8. **VERIFY**: Run integrity checks on restored data
9. **TEST**: Verify application functionality
10. **DOCUMENT**: Create incident report and update procedures

### 13.10 Air-Gapped Backup Rules

For maximum security, monthly and annual backups should be stored air-gapped:

1. **Physical media**: Encrypted USB drives or external HDDs
2. **Storage location**: Secure offsite location (bank safe deposit, secure facility)
3. **Access control**: FOUNDER only
4. **Verification**: Quarterly test of offsite restore capability
5. **Rotation**: New media every 2 years, secure destruction of old media

---

## 14. PHASE SUMMARY FOR COPILOT

### 14.1 Key Design Decisions

1. **Shadow Accounting Architecture**
   - Employees see `displayedRatePercent` (2x their actual rate)
   - Database stores both `amountCents` and `displayedAmountCents`
   - UI components for employees ONLY access displayed values
   - Commission calculation happens in `commissionService.ts`
   - NEVER log actual amounts to employee-visible logs

2. **7-Role Hierarchical System**
   - FOUNDER (100) > ADMIN (80) > HR/COMPLIANCE (60) > TEAM_LEAD (40) > EMPLOYEE (20) > CLIENT (10)
   - roleGuard middleware enforces at route level
   - Frontend routes protected by ProtectedRoute component
   - FOUNDER bypasses all permission checks

3. **OPS Layer Isolation**
   - All OPS routes under `/api/ops/*`
   - founderOnly middleware applied to all OPS routes
   - Bots write to OpsInsight table (FOUNDER visibility only)
   - WatchAlert, SystemError, ScrapedItem all FOUNDER-only
   - FounderConsole is the only UI for OPS data

4. **Sovereign Stack Principles**
   - No paid SaaS dependencies
   - SMTP via self-controlled mail server
   - Document Vault on local filesystem
   - PostgreSQL self-hosted
   - All backups under direct control
   - Can operate air-gapped if needed

5. **Money as Cents**
   - All monetary fields: `*Cents` or `*AmountCents`
   - Integer type in database (no floats)
   - Division by 100 only at display layer
   - formatCurrency() helper for display

6. **UTC Timestamp Standard**
   - All `DateTime` fields stored in UTC
   - createdAt, updatedAt auto-managed by Prisma
   - Date display conversion in frontend only
   - Server processes all dates in UTC

### 14.2 Ambiguities Resolved

1. **Commission Calculation Order**
   ```
   1. surplusCents × (feePercent/100) = feeAmountCents
   2. feeAmountCents × (actualRatePercent/100) = employeeCommissionCents
   3. feeAmountCents × (displayedRatePercent/100) = employeeDisplayedCommissionCents
   4. feeAmountCents - employeeCommissionCents = founderShareCents
   5. surplusCents - feeAmountCents = clientPayoutCents
   ```

2. **Document Access Resolution**
   - Matrix-based (see Section 8)
   - FOUNDER: Full access to all documents
   - ADMIN: Full access except delete (needs FOUNDER)
   - COMPLIANCE: Read-only access for auditing
   - TEAM_LEAD: Access to team member case documents
   - EMPLOYEE: Access to own assigned case documents
   - CLIENT: Access to own case documents (limited types)

3. **Bot Orchestration Sequence**
   ```
   CoordinatorBot.runFullCycle():
     1. IngestionBot.analyze()
     2. PayoutBot.analyze()
     3. ComplianceBot.analyze()
     4. TrainingBot.analyze()
     5. OutreachBot.analyze()
     6. DocketBot.analyze()
     7. CoordinatorBot.aggregateInsights()
     8. CoordinatorBot.generateExecutiveSummary()
   ```

4. **Client Portal Simplification**
   - Status shown as simple text (e.g., "Documents received, processing your claim")
   - No numerical amounts ever shown
   - No employee names shown
   - No internal IDs shown (only publicAccessToken)
   - FAQ answers pre-written, not dynamic

5. **Training Module Assignment**
   - Base requirements by role (moduleRequirements)
   - Additional requirements by tier (tierProgression)
   - Union of both determines required modules
   - Compliance: all required modules must be COMPLETED

### 14.3 Risks Identified

1. **Scraper Brittleness** (HIGH)
   - County websites change without notice
   - Mitigation: WatchService monitors for changes, alerts on detection
   - Mitigation: Scraper configs stored in database for easy updates
   - Recommendation: Build admin UI for scraper config management

2. **State Rule Variations** (HIGH)
   - 50 states with different redemption periods, forms, deadlines
   - Mitigation: State rules stored in database, not hardcoded
   - Mitigation: PDF templates parameterized by state
   - Recommendation: Start with TX, FL, CA, GA, NC (priority states)

3. **Shadow Accounting Leaks** (CRITICAL)
   - Any display of actual rates to employees is catastrophic
   - Mitigation: Separate API endpoints for FOUNDER vs EMPLOYEE data
   - Mitigation: UI components explicitly select displayed values
   - Recommendation: Automated tests verifying no actual values in employee responses

4. **High-Value Case Security** (HIGH)
   - Cases with >$50,000 surplus are high-value targets
   - Mitigation: Audit logging on all access
   - Mitigation: WatchAlert for high-value case creation
   - Recommendation: Additional verification steps for high-value payouts

5. **Document Vault Growth** (MEDIUM)
   - 10MB per file × thousands of cases = significant storage
   - Mitigation: Document retention policy (archive after 7 years)
   - Mitigation: Compression for archived documents
   - Recommendation: Monitor storage usage, plan for expansion

### 14.4 What's Complete (100%)

**Authentication & Security:**
- JWT authentication with bcrypt
- 7-role system with roleGuard middleware
- Rate limiting on auth endpoints
- Audit logging middleware

**Core Features:**
- Case CRUD with full lifecycle management
- Client portal with document viewing and signing
- Employee office with (displayed) earnings tracking
- Payout calculations with shadow accounting
- Commission calculations per tier

**Admin Panels:**
- AdminDashboard with real-time metrics
- AdminCases, AdminEmployees, AdminBanking
- AdminTraining, AdminIngestion, AdminSettings
- HR Panel with onboarding pipeline
- Compliance Panel with audit tools
- FounderConsole (basic) with OPS overview

**Backend Infrastructure:**
- All core routes implemented
- All services structured
- All 7 bots created (skeleton logic)
- Document Vault service
- Notification service (SMTP)
- PDF service (pdfkit)

**Database:**
- Complete Prisma schema (800+ lines)
- All models defined
- All enums defined
- Relations configured
- OPS models included

**Documentation:**
- This Master Spec (14 sections)
- DROP_THIS_TO_COPILOT.md
- docs/BACKUPS.md

### 14.5 What's NOT Complete (Priority Order)

**HIGH Priority (Phase 2):**
1. **Bot Detection Logic** - PayoutBot anomaly detection, ComplianceBot deadline scanning, IngestionBot pattern analysis
2. **PDF Templates** - State-specific legal language for all document types
3. **Scraper Configurations** - Working configs for TX, FL, CA, GA, NC priority states
4. **Email Templates** - Full HTML templates for all notification triggers

**MEDIUM Priority (Phase 3):**
5. **Training Module Content** - Actual learning content and quiz questions
6. **FounderConsole Enhancements** - Full bot controls, error management, scraper admin
7. **State Rules Database** - Complete rules for all 50 states
8. **Notification Engine** - Trigger automation, scheduling, retry logic

**LOW Priority (Phase 4):**
9. **WebSocket Real-time** - Live updates for FounderConsole
10. **Mobile Responsive** - Optimize UI for mobile devices
11. **End-to-End Tests** - Automated test coverage
12. **Performance Optimization** - Query optimization, caching

### 14.6 Notes for Copilot Phase 2

1. **Start with Bot Logic**
   - The 7 bots are skeletons with placeholder analysis
   - Implement real detection algorithms for PayoutBot (anomalies) and ComplianceBot (deadlines) first
   - Use OpsInsight table for all bot outputs
   - Priority: 1-10 scale, 10 = most urgent

2. **PDF Templates Need Legal Review**
   - Start with TX, FL, CA, GA, NC (highest volume states)
   - Each state has different disclosure requirements
   - SERVICE_AGREEMENT and LIMITED_POA are most critical
   - Use pdfkit's built-in Helvetica font (no external dependencies)

3. **Scraper Maintenance is Ongoing**
   - Build admin UI for managing scraper configs
   - Store configs in database, not code
   - WatchService should alert on page structure changes
   - Plan for weekly scraper maintenance

4. **Test Shadow Accounting Thoroughly**
   - Any leak of actual rates to employees is a critical bug
   - Test every employee-facing endpoint
   - Test every employee-facing UI component
   - Automated tests should verify no `amountCents` in employee responses

5. **Document Everything**
   - Update this spec as you implement
   - Keep it as the single source of truth
   - Add new sections as needed
   - Version control all documentation

### 14.7 Architecture Reminders for Phase 2/3

**Service Layer Pattern:**
```
Route → Middleware → Controller → Service → Prisma → Database
```

**Bot Execution Pattern:**
```
CoordinatorBot → Individual Bots → OpsInsight → FounderConsole
```

**Notification Flow:**
```
Trigger Event → NotificationService → Template Render → SMTP Send → NotificationLog
```

**Document Flow:**
```
Upload → Validation → DocumentVaultService → Filesystem → Document Record
Generate → PDFService → Buffer → DocumentVaultService → Document Record
```

---

**END OF MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1_FINAL.md**

*This document is the canonical source of truth for the MGR Capital Assistance platform. All implementation must conform to this specification. Last updated: 2026-01-21.*
