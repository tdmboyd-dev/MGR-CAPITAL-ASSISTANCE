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

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite + TypeScript)                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Admin       │ │Employee    │ │Client      │ │HR        │ │Compliance    │ │
│  │Dashboard   │ │Office      │ │Portal      │ │Panel     │ │Panel         │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ └──────────────┘ │
│                              ┌─────────────────┐                             │
│                              │  Founder        │                             │
│                              │  Console        │                             │
│                              │  (OPS Layer)    │                             │
│                              └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node + Express + TypeScript)                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            API ROUTES                                  │  │
│  │  auth │ cases │ employees │ clients │ payouts │ documents │ legal     │  │
│  │  ingestion │ training │ settings │ hr │ compliance                    │  │
│  │  ops/metrics │ ops/watch                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            SERVICES                                    │  │
│  │  legalService │ bankingService │ commissionService │ caseService      │  │
│  │  employeeService │ clientService │ ingestionService │ trainingService │  │
│  │  notificationService │ pdfService │ documentVaultService              │  │
│  │  watchService │ scraperService │ opsMetricsService                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            BOT NETWORK                                 │  │
│  │  IngestionBot │ PayoutBot │ ComplianceBot │ TrainingBot               │  │
│  │  OutreachBot │ DocketBot │ CoordinatorBot                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            MIDDLEWARE                                  │  │
│  │  authMiddleware │ roleGuard │ auditLogger │ errorHandler │ rateLimit  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL + Prisma)                         │
│  Core: User │ Case │ Client │ Document │ LedgerEntry │ AuditLog             │
│  OPS:  OpsInsight │ WatchAlert │ ScrapedItem │ SystemError                  │
│        NotificationLog │ TrainingModuleDetail │ TrainingAssetPlan           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SOVEREIGN DOCUMENT VAULT                               │
│                    backend/storage/documents/{caseId}/                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 15+ with Prisma ORM |
| Authentication | JWT tokens + bcrypt password hashing |
| PDF Generation | pdfkit (sovereign, no external API) |
| Email | nodemailer + SMTP (sovereign, no SaaS) |
| File Storage | Local filesystem (Document Vault) |

### 1.4 Sovereign Rules

- **No paid SaaS integrations** — No Stripe, Twilio, SendGrid, AWS S3, etc.
- **Everything self-hosted** — Database, storage, email under full control
- **Closed system** — Internal logic never exposed externally
- **Air-gap capable** — System can operate without internet if needed

---

## 2. IMMUTABLE RULES

These rules are **non-negotiable** and must **never** be violated under any circumstances.

### 2.1 Production-Ready Only

- No placeholders, no TODOs, no "example" or "mock" language
- Every file must be implementable and runnable as-is
- No commented-out code blocks marked "for later"
- No "coming soon" features referenced in UI

### 2.2 Shadow Accounting

- Employees see `displayedRatePercent` (inflated commission rates)
- Employees actually receive `actualRatePercent` (exactly half of displayed)
- Founder sees both values and the true math
- Team leads receive override percentages on their team's cases
- **NEVER REVEAL TO EMPLOYEES:** surplus amounts, actual rates, fee percentages, founder share
- **NEVER REVEAL TO CLIENTS:** any financial details, backend logic, employee information

### 2.3 Role Boundaries

| Role | Can See | Cannot See |
|------|---------|------------|
| FOUNDER | Everything including OPS layer, actual rates, surplus amounts, all bots, all metrics | Nothing restricted |
| ADMIN | Most admin features, case management, employee management | OPS layer, bot internals, actual rates, surplus |
| HR | Onboarding, performance metrics, training compliance, tier management | Surplus amounts, actual rates, OPS layer |
| COMPLIANCE | Audits, flags, risk assessment, payout compliance | Surplus amounts, actual rates, OPS layer |
| TEAM_LEAD | Team performance, training, workload distribution | Surplus amounts, actual rates, other teams |
| EMPLOYEE | Own cases only, displayed earnings only, own training | Actual rates, surplus, other employees' data |
| CLIENT | Own case status in simple terms, own documents | All financial details, backend logic, employee info |

### 2.4 Money in Cents

- All monetary values stored as integers representing cents
- Never use floating point for money (floating point causes rounding errors)
- Division by 100 only at display time
- Example: $1,234.56 stored as `123456` (integer)

### 2.5 UTC Timestamps

- All timestamps stored in UTC (ISO 8601 format)
- Conversion to local time only at display time
- Server processes all dates in UTC
- Database stores all dates in UTC

### 2.6 Closed System

- Internal logic, formulas, and OPS intelligence never exposed externally
- System designed to be hard to copy from outside observation
- No public API documentation
- No external webhooks revealing internal state

### 2.7 Sovereign Stack

- No paid SaaS integrations (Stripe, Twilio, SendGrid, etc.)
- Everything self-hosted or open source
- Email via SMTP (self-controlled mail server)
- Storage local (Document Vault on filesystem)
- Backups under full control (no cloud backup services)
- Can operate entirely offline/air-gapped if needed

---

## 3. ROLES & ACCESS MODEL

### 3.1 Role Definitions

| Role | Level | Primary Function |
|------|-------|------------------|
| FOUNDER | 100 | Superuser. Full access to everything including OPS layer. Bypasses all permission checks. |
| ADMIN | 80 | Administrative access to most features except OPS brain. Cannot see actual rates or surplus. |
| HR | 60 | Employee lifecycle: onboarding, training compliance, tier progression, performance tracking. |
| COMPLIANCE | 60 | Audits, risk assessment, flag review, payout compliance, document verification. |
| TEAM_LEAD | 40 | Team management: team performance, training oversight, workload distribution. |
| EMPLOYEE | 20 | Works assigned cases, views displayed earnings (not actual), completes training modules. |
| CLIENT | 10 | Reads case status in simple terms, uploads ID, signs documents. No financial visibility. |

### 3.2 Role Groups

| Group Name | Roles Included | Use Case |
|------------|----------------|----------|
| STAFF | FOUNDER, ADMIN, HR, COMPLIANCE, TEAM_LEAD, EMPLOYEE | Any internal user |
| MANAGEMENT | FOUNDER, ADMIN, HR, TEAM_LEAD | Management-level access |
| ADMINS | FOUNDER, ADMIN | Administrative access |
| CASE_HANDLERS | FOUNDER, ADMIN, TEAM_LEAD, EMPLOYEE | Users who work cases |
| HR_ACCESS | FOUNDER, ADMIN, HR | HR panel access |
| COMPLIANCE_ACCESS | FOUNDER, ADMIN, COMPLIANCE | Compliance panel access |
| FINANCIAL_ACCESS | FOUNDER, ADMIN | Financial data access |
| OPS_ACCESS | FOUNDER | OPS layer access (FOUNDER ONLY) |

### 3.3 5-Tier Employee Commission System (Shadow Accounting)

| Tier | Display Name | Displayed Rate | Actual Rate | Override |
|------|--------------|----------------|-------------|----------|
| TIER_1_ASSOCIATE | Associate | 20% | 10% | None |
| TIER_2_SPECIALIST | Specialist | 40% | 20% | None |
| TIER_3_SENIOR_SPECIALIST | Senior Specialist | 60% | 30% | None |
| TIER_4_TEAM_LEADER | Team Leader | 80% | 40% | 10% |
| TIER_5_EXECUTIVE_PARTNER | Executive Partner | 100% | 50% | 20% |

**Shadow Accounting Logic:**
- Employees see `displayedRatePercent` in their portal
- Employees actually receive `actualRatePercent` (half of displayed)
- Founder keeps the difference as profit
- Override % is paid to team leaders on their team's cases

---

## 4. FULL DATABASE SCHEMA

### 4.1 Core Models

#### User
```
| Field            | Type              | Purpose                                    |
|------------------|-------------------|--------------------------------------------|
| id               | String (CUID)     | Primary key                                |
| email            | String (unique)   | Login identifier                           |
| name             | String            | Display name                               |
| phone            | String?           | Contact number                             |
| passwordHash     | String            | bcrypt hash (cost factor 12)               |
| role             | UserRole          | FOUNDER/ADMIN/HR/COMPLIANCE/TEAM_LEAD/EMPLOYEE/CLIENT |
| employeeTier     | EmployeeTier?     | For employees: TIER_1 through TIER_5       |
| isActive         | Boolean           | Account active status (default: true)      |
| emailVerified    | Boolean           | Email verification status                  |
| teamLeadId       | String?           | FK to User (for team assignment)           |
| trainingCompleted| Boolean           | All required training completed            |
| createdAt        | DateTime          | Account creation timestamp                 |
| updatedAt        | DateTime          | Last modification timestamp                |
| lastLoginAt      | DateTime?         | Last successful login timestamp            |
```

#### Case
```
| Field              | Type              | Purpose                                  |
|--------------------|-------------------|------------------------------------------|
| id                 | String (CUID)     | Primary key                              |
| internalId         | String (unique)   | MGR-2026-XXXXX format                    |
| publicAccessToken  | String (unique)   | Client portal access token (UUID)        |
| clientId           | String            | FK to Client                             |
| assignedToId       | String?           | FK to User (assigned employee)           |
| state              | String            | US state code (2 letters)                |
| county             | String            | County name                              |
| propertyAddress    | String            | Full property address                    |
| parcelNumber       | String?           | Tax parcel ID                            |
| saleDate           | DateTime?         | Tax sale date                            |
| surplusAmountCents | Int               | Surplus amount (FOUNDER ONLY visibility) |
| feePercent         | Int               | Company fee percentage (FOUNDER ONLY)    |
| status             | CaseStatus        | Current lifecycle status                 |
| priority           | CasePriority      | HIGH/MEDIUM/LOW                          |
| source             | String?           | Ingestion source identifier              |
| notes              | String?           | Internal case notes                      |
| createdAt          | DateTime          | Case creation timestamp                  |
| updatedAt          | DateTime          | Last modification timestamp              |
| closedAt           | DateTime?         | When case was closed                     |
```

#### Client
```
| Field       | Type              | Purpose                    |
|-------------|-------------------|----------------------------|
| id          | String (CUID)     | Primary key                |
| name        | String            | Client full name           |
| email       | String            | Contact email              |
| phone       | String?           | Contact phone              |
| address     | String?           | Street address             |
| city        | String?           | City                       |
| state       | String?           | State                      |
| zipCode     | String?           | ZIP code                   |
| idUploaded  | Boolean           | ID document uploaded       |
| idVerified  | Boolean           | ID verified by staff       |
| createdAt   | DateTime          | Record creation timestamp  |
| updatedAt   | DateTime          | Last modification          |
```

#### Document
```
| Field             | Type              | Purpose                           |
|-------------------|-------------------|-----------------------------------|
| id                | String (CUID)     | Primary key                       |
| caseId            | String            | FK to Case                        |
| type              | DocumentType      | SERVICE_AGREEMENT, LIMITED_POA, etc. |
| fileName          | String            | Original filename                 |
| filePath          | String            | Relative path in Document Vault   |
| fileSize          | Int?              | File size in bytes                |
| mimeType          | String?           | MIME type                         |
| status            | DocumentStatus    | PENDING/SIGNED/VERIFIED/REJECTED  |
| signatureRequired | Boolean           | Requires signature                |
| signedAt          | DateTime?         | When signed                       |
| signatureData     | String?           | Signature data (base64)           |
| uploadedAt        | DateTime          | Upload timestamp                  |
| uploadedById      | String?           | FK to User (uploader)             |
```

#### LedgerEntry
```
| Field                  | Type              | Purpose                              |
|------------------------|-------------------|--------------------------------------|
| id                     | String (CUID)     | Primary key                          |
| caseId                 | String            | FK to Case                           |
| employeeId             | String?           | FK to User (for commissions)         |
| type                   | LedgerEntryType   | CLIENT_PAYOUT/EMPLOYEE_COMMISSION/etc. |
| amountCents            | Int               | Actual amount in cents               |
| displayedAmountCents   | Int               | Amount shown to employee (shadow)    |
| status                 | LedgerEntryStatus | PENDING/PROCESSING/COMPLETED/etc.    |
| description            | String?           | Entry description                    |
| reference              | String?           | External reference (check #, etc.)   |
| processedAt            | DateTime?         | When processed                       |
| completedAt            | DateTime?         | When completed                       |
| createdAt              | DateTime          | Entry creation timestamp             |
| notes                  | String?           | Internal notes                       |
```

### 4.2 OPS/Monitoring Models

#### OpsInsight
```
| Field          | Type              | Purpose                       |
|----------------|-------------------|-------------------------------|
| id             | String (CUID)     | Primary key                   |
| botSource      | String            | Which bot generated           |
| insightType    | String            | Categorization                |
| priority       | Int               | 1-10 priority scale           |
| title          | String            | Short title                   |
| summary        | String            | Plain-English summary         |
| data           | Json              | Structured insight data       |
| actionRequired | Boolean           | Needs founder action          |
| acknowledged   | Boolean           | Founder acknowledged          |
| acknowledgedAt | DateTime?         | When acknowledged             |
| dismissedAt    | DateTime?         | When dismissed                |
| createdAt      | DateTime          | Insight creation timestamp    |
```

#### WatchAlert
```
| Field        | Type                | Purpose                      |
|--------------|---------------------|------------------------------|
| id           | String (CUID)       | Primary key                  |
| type         | WatchAlertType      | RULE_CHANGE/HIGH_VALUE/etc.  |
| severity     | WatchAlertSeverity  | CRITICAL/HIGH/MEDIUM/LOW     |
| title        | String              | Alert title                  |
| message      | String              | Alert details                |
| state        | String?             | Related state                |
| county       | String?             | Related county               |
| relatedId    | String?             | Related resource ID          |
| relatedType  | String?             | Related resource type        |
| isResolved   | Boolean             | Resolution status            |
| resolvedAt   | DateTime?           | When resolved                |
| resolvedById | String?             | FK to User (resolver)        |
| notes        | String?             | Resolution notes             |
| createdAt    | DateTime            | Alert creation timestamp     |
```

#### ScrapedItem
```
| Field        | Type                     | Purpose                    |
|--------------|--------------------------|----------------------------|
| id           | String (CUID)            | Primary key                |
| sourceType   | ScrapedItemType          | TAX_SALE/SURPLUS/etc.      |
| sourceUrl    | String                   | Source URL                 |
| state        | String?                  | State                      |
| county       | String?                  | County                     |
| rawContent   | String                   | Raw scraped content        |
| parsedData   | Json?                    | Structured parsed data     |
| reviewStatus | ScrapedItemReviewStatus  | PENDING/REVIEWED/etc.      |
| reviewedById | String?                  | FK to User (reviewer)      |
| reviewedAt   | DateTime?                | When reviewed              |
| notes        | String?                  | Review notes               |
| createdAt    | DateTime                 | Scrape timestamp           |
```

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
  FOLLOW_UP_LETTER
  VERIFICATION_LETTER
  PAYMENT_INSTRUCTIONS
  CLIENT_ID
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

enum NotificationType {
  EMAIL
  SMS
  INTERNAL
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}

enum WatchAlertType {
  RULE_CHANGE
  HIGH_VALUE_CASE
  DEADLINE_WARNING
  SCRAPE_ERROR
  SOURCE_OFFLINE
  ANOMALY_DETECTED
  COMPLIANCE_FLAG
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

enum ErrorSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}
```

---

## 5. CORE APPLICATION FLOWS

### 5.1 Case Lifecycle

```
NEW → CONTACTED → DOCS_PENDING → DOCS_SIGNED → FILED → AWAITING_FUNDS → PAID
                                                                        ↓
                                                                     CLOSED
```

| Status | Description | Next Action |
|--------|-------------|-------------|
| NEW | Case created from ingestion or manual entry | Employee contacts client |
| CONTACTED | Initial contact made with client | Send documents for signature |
| DOCS_PENDING | Documents sent, awaiting client signatures | Follow up on document status |
| DOCS_SIGNED | All required documents signed | File claim with county/court |
| FILED | Claim filed with authorities | Monitor for response |
| AWAITING_FUNDS | Claim approved, waiting for disbursement | Track payment |
| PAID | Funds received and distributed | Close case |
| CLOSED | Case closed (any reason) | Archive |
| REJECTED | Filing rejected by authorities | Analyze, potentially retry |

### 5.2 Payout Calculation Flow

```typescript
// bankingService.calculatePayout()

Input: {
  surplusAmountCents: 100000,  // $1,000.00
  feePercent: 30,              // 30% fee
  employeeTier: "TIER_3_SENIOR_SPECIALIST"
}

Processing:
1. feeAmountCents = surplusAmountCents × (feePercent / 100)
   = 100000 × 0.30 = 30000

2. clientPayoutCents = surplusAmountCents - feeAmountCents
   = 100000 - 30000 = 70000

3. employeeActualRate = tierRates[tier].actualRatePercent
   = 30 (for TIER_3)

4. employeeCommissionCents = feeAmountCents × (actualRate / 100)
   = 30000 × 0.30 = 9000

5. employeeDisplayedRate = tierRates[tier].displayedRatePercent
   = 60 (for TIER_3)

6. employeeDisplayedCommissionCents = feeAmountCents × (displayedRate / 100)
   = 30000 × 0.60 = 18000

7. founderShareCents = feeAmountCents - employeeCommissionCents
   = 30000 - 9000 = 21000

Output: {
  feeAmountCents: 30000,                    // $300 total fee
  clientPayoutCents: 70000,                 // $700 to client
  employeeCommissionCents: 9000,            // $90 actual
  employeeDisplayedCommissionCents: 18000,  // $180 displayed
  founderShareCents: 21000                  // $210 founder profit
}
```

### 5.3 Authentication Flow

1. User submits email + password to `POST /api/auth/login`
2. Backend validates credentials with bcrypt.compare()
3. If valid, JWT token issued with payload: `{ userId, email, role, tier }`
4. Token returned with expiration (24 hours default)
5. Frontend stores token in localStorage as `token`
6. All subsequent API requests include `Authorization: Bearer <token>`
7. `GET /api/auth/me` validates token and returns current user data

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
| **Purpose** | Retrieve complete OPS dashboard data |
| **Access** | FOUNDER only |
| **Inputs** | Query: `timeRange` (24h/7d/30d/all) |
| **Outputs** | Summary stats, activity metrics, alert counts |

**Response:**
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
      "alertsCreated24h": 5
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
| **Purpose** | Prioritized founder attention items |
| **Access** | FOUNDER only |
| **Inputs** | Query: `limit`, `includeAcknowledged` |
| **Outputs** | Array of focus items sorted by priority |

#### GET /api/ops/metrics/employees/integrity
| Aspect | Details |
|--------|---------|
| **Purpose** | Employee integrity/performance scores |
| **Access** | FOUNDER only |
| **Outputs** | Per-employee scores and metrics |

#### GET /api/ops/metrics/heatmap
| Aspect | Details |
|--------|---------|
| **Purpose** | Case distribution by jurisdiction |
| **Access** | FOUNDER only |
| **Outputs** | State/county case counts and values |

#### POST /api/ops/metrics/focus-feed/:id/dismiss
| Aspect | Details |
|--------|---------|
| **Purpose** | Dismiss a focus feed item |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id` |

### 7.2 Watch Routes

#### GET /api/ops/watch/alerts
| Aspect | Details |
|--------|---------|
| **Purpose** | List watch alerts |
| **Access** | FOUNDER only |
| **Inputs** | Query: `severity`, `type`, `resolved`, `limit` |
| **Outputs** | Array of WatchAlert records |

#### POST /api/ops/watch/alerts/:id/resolve
| Aspect | Details |
|--------|---------|
| **Purpose** | Resolve a watch alert |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id`, Body: `notes` |

#### POST /api/ops/watch/cycle
| Aspect | Details |
|--------|---------|
| **Purpose** | Run full watch + scrape cycle |
| **Access** | FOUNDER only |
| **Outputs** | Cycle results, new alerts created |

#### POST /api/ops/watch/scraper/run
| Aspect | Details |
|--------|---------|
| **Purpose** | Manually trigger scrapers |
| **Access** | FOUNDER only |
| **Inputs** | Body: `sources[]` (optional, default all) |

#### GET /api/ops/watch/scraper/status
| Aspect | Details |
|--------|---------|
| **Purpose** | Get scraper status and health |
| **Access** | FOUNDER only |
| **Outputs** | Per-source status, last run, error count |

### 7.3 System Routes

#### GET /api/ops/system/errors
| Aspect | Details |
|--------|---------|
| **Purpose** | List system errors |
| **Access** | FOUNDER only |
| **Inputs** | Query: `severity`, `resolved`, `limit` |

#### POST /api/ops/system/errors/:id/resolve
| Aspect | Details |
|--------|---------|
| **Purpose** | Mark error as resolved |
| **Access** | FOUNDER only |
| **Inputs** | Path: `id`, Body: `notes` |

#### POST /api/ops/bots/run
| Aspect | Details |
|--------|---------|
| **Purpose** | Manually run bot cycle |
| **Access** | FOUNDER only |
| **Inputs** | Body: `bots[]` (optional, default all) |

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

### 8.2 Access Matrix by Document Type

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
- **Read**: Download only
- **Team**: Access for team member cases only
- **Own**: Access for assigned/own cases only

### 8.3 Document Routes

#### POST /api/documents/:caseId/upload
| Aspect | Details |
|--------|---------|
| **Purpose** | Upload document to case |
| **Access** | FOUNDER, ADMIN, TEAM_LEAD (team), EMPLOYEE (own), CLIENT (own) |
| **Inputs** | Path: `caseId`, Body: multipart file + `type` |
| **Validation** | File type, size limit (10MB), case ownership |

#### GET /api/documents/:id/download
| Aspect | Details |
|--------|---------|
| **Purpose** | Download document file |
| **Access** | Per access matrix above |
| **Outputs** | File stream with correct MIME type |

#### GET /api/documents/:id/view
| Aspect | Details |
|--------|---------|
| **Purpose** | View document metadata |
| **Access** | Per access matrix above |
| **Outputs** | Document record without file content |

#### PATCH /api/documents/:id/sign
| Aspect | Details |
|--------|---------|
| **Purpose** | Sign a document |
| **Access** | CLIENT (own documents requiring signature) |
| **Inputs** | Body: `signatureData` (base64) |

#### DELETE /api/documents/:id
| Aspect | Details |
|--------|---------|
| **Purpose** | Delete document |
| **Access** | FOUNDER only |

---

## 9. NOTIFICATION TRIGGER MAP

### 9.1 Notification Types

| Trigger | Recipient | Channel | Template |
|---------|-----------|---------|----------|
| Case Created | Client | EMAIL | `case_welcome` |
| Documents Ready | Client | EMAIL | `docs_ready` |
| Document Reminder | Client | EMAIL | `docs_reminder` |
| Case Filed | Client | EMAIL | `case_filed` |
| Payment Received | Client | EMAIL | `payment_received` |
| Case Assigned | Employee | EMAIL | `case_assigned` |
| High-Value Alert | Founder | INTERNAL | `high_value_case` |

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

### 9.3 SMTP Configuration

```typescript
// backend/src/services/notificationService.ts

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
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
- Margins: 1 inch all sides
- Company letterhead on first page

### 10.2 Document Templates

#### SERVICE_AGREEMENT

**Purpose:** Client service contract authorizing MGR Capital to act on their behalf.

**Fields:**
| Field | Source | Required |
|-------|--------|----------|
| clientName | Client.name | Yes |
| clientAddress | Client full address | Yes |
| propertyAddress | Case.propertyAddress | Yes |
| state | Case.state | Yes |
| county | Case.county | Yes |
| feePercent | Case.feePercent | Yes (FOUNDER sees, template shows) |
| agreementDate | Generated | Yes |
| signatureLine | Client signature | Yes |

**Sections:**
1. Parties (MGR Capital + Client)
2. Property Description
3. Services to be Provided
4. Fee Structure
5. Term and Termination
6. Signatures

#### LIMITED_POA

**Purpose:** Power of Attorney authorizing MGR Capital to file claims.

**Fields:**
| Field | Source | Required |
|-------|--------|----------|
| clientName | Client.name | Yes |
| clientAddress | Client full address | Yes |
| propertyAddress | Case.propertyAddress | Yes |
| parcelNumber | Case.parcelNumber | If available |
| saleDate | Case.saleDate | If available |
| state | Case.state | Yes |
| county | Case.county | Yes |

**Sections:**
1. Grant of Authority
2. Scope of Authority
3. Property Description
4. Effective Date and Duration
5. Signatures and Notarization

#### AFFIDAVIT

**Purpose:** Sworn statement of ownership/entitlement.

**Fields:**
| Field | Source | Required |
|-------|--------|----------|
| clientName | Client.name | Yes |
| propertyAddress | Case.propertyAddress | Yes |
| ownershipHistory | Case notes or intake | Yes |
| state | Case.state | Yes |
| county | Case.county | Yes |

#### FILING_PACKET

**Purpose:** Complete package for county/court filing.

**Contents:**
1. Cover Letter
2. Service Agreement (copy)
3. Limited POA (copy)
4. Affidavit
5. Supporting Evidence
6. Payment Instructions (if required)

### 10.3 PDF Generation Code Pattern

```typescript
// backend/src/services/pdfService.ts

import PDFDocument from 'pdfkit';

export async function generateServiceAgreement(caseData: Case, clientData: Client): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).text('SERVICE AGREEMENT', { align: 'center' });
    doc.moveDown();

    // Body content...
    doc.fontSize(12).text(`This Agreement is entered into by and between...`);

    // Signature lines
    doc.moveDown(4);
    doc.text('Client Signature: ________________________');
    doc.text(`Date: ________________________`);

    doc.end();
  });
}
```

---

## 11. TRAINING INTELLIGENCE BLUEPRINT

### 11.1 Module Structure

| Module ID | Title | Target Roles | Tiers |
|-----------|-------|--------------|-------|
| M001 | Introduction to MGR Capital | ALL EMPLOYEES | All |
| M002 | Client Communication Basics | EMPLOYEE, TEAM_LEAD | TIER_1, TIER_2 |
| M003 | Compliance & Boundaries | ALL EMPLOYEES | All |
| M004 | Case Processing Procedures | EMPLOYEE, TEAM_LEAD | All |
| M005 | Advanced Negotiation | TEAM_LEAD | TIER_3+ |
| M006 | Team Leadership | TEAM_LEAD | TIER_4+ |
| M007 | HR Onboarding Procedures | HR | N/A |
| M008 | Compliance Monitoring | COMPLIANCE | N/A |

### 11.2 Training Progress Tracking

```
TrainingProgress {
  userId -> User
  moduleId -> TrainingModule
  status: NOT_STARTED | IN_PROGRESS | COMPLETED
  startedAt: DateTime?
  completedAt: DateTime?
  quizScore: Int?
  attempts: Int
}
```

### 11.3 TrainingBot Functions

| Function | Purpose | Output |
|----------|---------|--------|
| `identifyGaps()` | Find employees missing required modules | List of gaps per employee |
| `correlatePerformance()` | Link training completion to case metrics | Performance correlation data |
| `suggestModules()` | Recommend next modules based on role/tier | Personalized suggestions |
| `generateAnalytics()` | Training completion metrics | Dashboard data |

### 11.4 Module Content Generation

TrainingBot generates module content stored in `TrainingModuleDetail`:

```json
{
  "moduleId": "M002",
  "role": "EMPLOYEE",
  "tier": "TIER_1_ASSOCIATE",
  "outline": {
    "sections": [
      { "title": "Introduction", "duration": "5min" },
      { "title": "First Contact Best Practices", "duration": "15min" },
      { "title": "Handling Objections", "duration": "20min" },
      { "title": "Quiz", "duration": "10min" }
    ]
  },
  "scripts": {
    "initialCall": "Hello, my name is {name} calling from MGR Capital Assistance...",
    "objectionHandling": {
      "tooGoodToBeTrue": "I understand your concern. Let me explain exactly how this works...",
      "alreadyContacted": "Thank you for letting me know. Could you tell me who contacted you?"
    }
  },
  "keyPoints": [
    "Always be professional and patient",
    "Never discuss specific financial amounts",
    "Document all communications"
  ]
}
```

---

## 12. INGESTION INTELLIGENCE BLUEPRINT

### 12.1 Data Sources

| Source Type | Format | Frequency | Priority |
|-------------|--------|-----------|----------|
| County Tax Sale Lists | CSV/Excel | Weekly | HIGH |
| Surplus Fund Notices | PDF | Daily | HIGH |
| State Unclaimed Property | Web scrape | Monthly | MEDIUM |
| Foreclosure Lists | CSV | Weekly | MEDIUM |

### 12.2 Parsing Functions

#### parseCSV()
```typescript
async function parseCSV(file: Buffer, config: IngestionConfig): Promise<ParsedRecord[]> {
  // 1. Detect encoding (UTF-8, Latin-1, etc.)
  // 2. Parse headers, map to standard fields
  // 3. Validate required fields
  // 4. Transform data types (dates, amounts)
  // 5. Detect and flag duplicates
  // 6. Return normalized records
}
```

#### parsePDF()
```typescript
async function parsePDF(file: Buffer): Promise<ParsedRecord[]> {
  // 1. Extract text using pdf-parse
  // 2. Identify table structures
  // 3. Apply regex patterns for data extraction
  // 4. Handle multi-page documents
  // 5. Return extracted records
}
```

### 12.3 IngestionBot Functions

| Function | Purpose |
|----------|---------|
| `analyzePatterns()` | Detect changes in data source formats |
| `detectDuplicates()` | Find records matching existing cases |
| `assessSourceHealth()` | Monitor source reliability and format changes |
| `prioritizeRecords()` | Flag high-value records for immediate processing |
| `generateSourceReport()` | Per-source ingestion statistics |

### 12.4 Scraper Configurations

```typescript
// backend/src/services/scraperService.ts

const scraperConfigs: ScraperConfig[] = [
  {
    id: "harris_county_tx",
    name: "Harris County, TX Tax Sale",
    state: "TX",
    county: "Harris",
    url: "https://...",
    frequency: "weekly",
    selectors: {
      table: ".tax-sale-table",
      row: "tr.record",
      fields: {
        parcel: "td.parcel-id",
        address: "td.property-address",
        amount: "td.surplus-amount"
      }
    },
    transforms: {
      amount: (val) => parseCurrency(val)
    }
  }
];
```

### 12.5 Batch Processing Flow

```
1. Receive file upload or scraper output
2. Create IngestionBatch record (status: PROCESSING)
3. Parse data based on source type
4. For each record:
   a. Check for duplicates
   b. Validate required fields
   c. Create/update Client if needed
   d. Create Case record
   e. Flag high-value (> $10,000) for priority
5. Update IngestionBatch with results
6. Notify founder of batch completion
```

---

## 13. BACKUPS PLAYBOOK

### 13.1 Components to Backup

| Component | Location | Method | Frequency |
|-----------|----------|--------|-----------|
| PostgreSQL Database | localhost:5432 | pg_dump | Every 6 hours |
| Document Vault | backend/storage/documents/ | rsync | Hourly |
| Configuration | .env, secrets | Manual | On change |

### 13.2 PostgreSQL Backup Commands

```bash
# Full database dump
pg_dump -h localhost -U postgres -d mgr_capital -F c -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump

# With compression
pg_dump -h localhost -U postgres -d mgr_capital -F c -Z 9 -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump.gz

# Restore
pg_restore -h localhost -U postgres -d mgr_capital -c -F c /backups/db/backup_file.dump
```

### 13.3 Retention Policy

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Hourly | Every hour | 24 hours |
| 6-hour | Every 6 hours | 7 days |
| Daily | Daily at 2 AM | 30 days |
| Weekly | Sunday at 3 AM | 90 days |
| Monthly | 1st of month | 1 year |
| Annual | January 1st | 7 years |

### 13.4 Disaster Recovery

| Scenario | RPO | RTO |
|----------|-----|-----|
| Database corruption | 6 hours | 2 hours |
| Full server failure | 6 hours | 4 hours |
| Ransomware attack | 24 hours | 8 hours |

### 13.5 Encryption

```bash
# Encrypt backup with GPG
gpg --cipher-algo AES256 --symmetric --batch --passphrase-file /etc/mgr/backup-key \
  -o /backups/db/backup.dump.gz.gpg \
  /backups/db/backup.dump.gz

# Decrypt for restore
gpg --decrypt --batch --passphrase-file /etc/mgr/backup-key \
  -o /tmp/restore.dump.gz \
  /backups/db/backup.dump.gz.gpg
```

---

## 14. PHASE SUMMARY FOR COPILOT

### 14.1 What's Complete (100%)

**Authentication & Authorization:**
- JWT-based authentication with bcrypt
- 7-role system with complete roleGuard
- Rate limiting on auth endpoints
- Session management

**Core Features:**
- Case CRUD with full lifecycle
- Client portal with document signing
- Employee management with shadow accounting
- Payout calculations and ledger
- Commission calculations (shadow)

**Frontend:**
- AdminDashboard with real data
- AdminCases, AdminEmployees, AdminBanking
- AdminTraining, AdminIngestion, AdminSettings
- EmployeeOffice, EmployeeTraining
- ClientPortal, ClientOnboarding
- HRPanel, CompliancePanel
- FounderConsole (basic)

**Backend:**
- All core routes implemented
- HR and Compliance routes
- OPS metrics and watch routes
- Document Vault routes
- Notification service (SMTP)
- PDF service structure

**Database:**
- Complete Prisma schema
- All models and enums
- OPS models (OpsInsight, WatchAlert, etc.)

### 14.2 What's NOT Complete

**HIGH Priority:**
1. **Bot Logic** — All 7 bots are skeletons needing real detection/analysis logic
2. **Scraper Service** — Needs real configurations for county websites
3. **PDF Templates** — Need complete templates with state-specific language

**MEDIUM Priority:**
4. **Notification Templates** — Need full email templates for all triggers
5. **FounderConsole** — Needs full error management and bot controls
6. **Training Content** — Need actual module content and quizzes

**LOW Priority:**
7. **WebSocket Updates** — Real-time updates for FounderConsole
8. **Mobile Responsive** — Current UI is desktop-focused
9. **End-to-End Tests** — Automated test coverage

### 14.3 Implementation Priority Order

1. Complete bot detection logic (PayoutBot anomalies, ComplianceBot deadlines)
2. Build out PDF templates with state-specific legal language
3. Configure scrapers for top 10 priority states
4. Complete notification templates
5. Add real training module content
6. Enhance FounderConsole with full controls
7. Add WebSocket for real-time updates
8. Mobile responsive optimization
9. Comprehensive testing

### 14.4 Environment Setup

```bash
# Install dependencies
cd backend && npm install
cd ../app && npm install

# Database setup
cd backend
npx prisma generate
npx prisma db push

# Start servers
cd backend && npm run dev  # Port 4000
cd app && npm run dev      # Port 3000
```

### 14.5 Environment Variables

**Backend (.env):**
```
DATABASE_URL="postgresql://user:pass@localhost:5432/mgr_capital"
JWT_SECRET="your-secret-key-min-32-chars"
PORT=4000
NODE_ENV=development
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@mgrcapital.com
SMTP_PASS=smtp-password
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:4000/api
```

---

**END OF MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1_FINAL.md**

*This document is the canonical source of truth for the MGR Capital Assistance platform. All implementation must conform to this specification.*
