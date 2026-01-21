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

### 3.2 Role Groups (for roleGuard convenience)

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

### 3.3 Access Matrix by Feature

| Feature | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|---------|:-------:|:-----:|:--:|:----------:|:---------:|:--------:|:------:|
| Admin Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| All Cases | ✓ | ✓ | - | ✓ (read) | Team only | Own only | Own only |
| Create Case | ✓ | ✓ | - | - | - | - | - |
| Edit Case | ✓ | ✓ | - | - | ✓ (team) | ✓ (own) | - |
| Surplus Amounts | ✓ | - | - | - | - | - | - |
| Actual Commission Rates | ✓ | - | - | - | - | - | - |
| Fee Percentages | ✓ | - | - | - | - | - | - |
| Payout Math (full) | ✓ | - | - | - | - | - | - |
| Payout Math (summary) | ✓ | ✓ | - | ✓ | - | - | - |
| OPS Console | ✓ | - | - | - | - | - | - |
| Bot Controls | ✓ | - | - | - | - | - | - |
| Watch Alerts | ✓ | - | - | - | - | - | - |
| System Errors | ✓ | - | - | - | - | - | - |
| HR Panel | ✓ | ✓ | ✓ | - | - | - | - |
| Compliance Panel | ✓ | ✓ | - | ✓ | - | - | - |
| Training Admin | ✓ | ✓ | ✓ | - | - | - | - |
| Training (own) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Employee Tier Management | ✓ | ✓ | ✓ | - | - | - | - |
| Employee Create/Edit | ✓ | ✓ | ✓ | - | - | - | - |
| Audit Logs | ✓ | ✓ | - | ✓ | - | - | - |
| Document Upload | ✓ | ✓ | - | - | ✓ (team) | ✓ (own) | ✓ (own) |
| Document Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| Document Delete | ✓ | - | - | - | - | - | - |
| Settings | ✓ | ✓ | - | - | - | - | - |
| Ingestion | ✓ | ✓ | - | - | - | - | - |

### 3.4 "Never Reveal" Rules

**To Employees (NEVER show):**
- `surplusAmountCents` — the actual surplus amount
- `actualRatePercent` — the actual commission rate they receive
- `founderShareCents` — the founder's profit
- `feePercent` — the company's fee percentage
- Any payout calculations showing true math
- Other employees' earnings or performance (except team leads see team)

**To Clients (NEVER show):**
- Any financial details whatsoever
- Employee names or contact information
- Commission structures
- Fee calculations
- Backend processing status details
- Other clients' information

**To Non-Founders (NEVER show):**
- OPS layer (bots, insights, watch alerts, scraped data)
- System errors with stack traces
- Internal metrics and heuristics
- Actual vs displayed commission math

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

**Relations:**
- `teamLead` → User (many-to-one)
- `teamMembers` → User[] (one-to-many)
- `assignedCases` → Case[] (one-to-many)
- `trainingProgress` → TrainingProgress[] (one-to-many)
- `ledgerEntries` → LedgerEntry[] (one-to-many)
- `auditLogs` → AuditLog[] (one-to-many)
- `sessions` → UserSession[] (one-to-many)

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

**Relations:**
- `client` → Client (many-to-one)
- `assignedTo` → User (many-to-one)
- `documents` → Document[] (one-to-many)
- `deadlines` → Deadline[] (one-to-many)
- `communications` → Communication[] (one-to-many)
- `ledgerEntries` → LedgerEntry[] (one-to-many)

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

**Relations:**
- `cases` → Case[] (one-to-many)

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
| verifiedAt        | DateTime?         | When verified                     |
| verifiedById      | String?           | FK to User (verifier)             |
| rejectionReason   | String?           | Reason if rejected                |
```

**Relations:**
- `case` → Case (many-to-one)
- `uploadedBy` → User (many-to-one)
- `verifiedBy` → User (many-to-one)

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

**Relations:**
- `case` → Case (many-to-one)
- `employee` → User (many-to-one)

#### AuditLog
```
| Field       | Type              | Purpose                    |
|-------------|-------------------|----------------------------|
| id          | String (CUID)     | Primary key                |
| userId      | String?           | FK to User (actor)         |
| action      | String            | Action performed           |
| entityType  | String?           | Resource type affected     |
| entityId    | String?           | Resource ID affected       |
| details     | Json?             | Additional context         |
| ipAddress   | String?           | Request IP address         |
| userAgent   | String?           | Request user agent         |
| createdAt   | DateTime          | Log timestamp              |
```

**Relations:**
- `user` → User (many-to-one)

### 4.2 OPS/Monitoring Models

#### SystemError
```
| Field        | Type              | Purpose                    |
|--------------|-------------------|----------------------------|
| id           | String (CUID)     | Primary key                |
| message      | String            | Error message              |
| stack        | String?           | Stack trace                |
| context      | Json?             | Additional context         |
| severity     | ErrorSeverity     | CRITICAL/HIGH/MEDIUM/LOW   |
| resolved     | Boolean           | Resolution status          |
| resolvedAt   | DateTime?         | When resolved              |
| resolvedById | String?           | FK to User (resolver)      |
| notes        | String?           | Resolution notes           |
| createdAt    | DateTime          | Error timestamp            |
```

#### NotificationLog
```
| Field         | Type                | Purpose                      |
|---------------|---------------------|------------------------------|
| id            | String (CUID)       | Primary key                  |
| userId        | String?             | FK to User (recipient)       |
| type          | NotificationType    | EMAIL/SMS/INTERNAL           |
| channel       | String              | Delivery channel             |
| recipient     | String              | Email address/phone          |
| subject       | String              | Notification subject         |
| body          | String              | Notification body (HTML)     |
| bodyPreview   | String?             | Plain text preview           |
| status        | NotificationStatus  | PENDING/SENT/FAILED          |
| error         | String?             | Error message if failed      |
| attempts      | Int                 | Send attempt count           |
| sentAt        | DateTime?           | When successfully sent       |
| relatedCaseId | String?             | FK to Case                   |
| relatedUserId | String?             | FK to User (related)         |
| createdAt     | DateTime            | Log creation timestamp       |
```

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

#### TrainingModuleDetail
```
| Field          | Type              | Purpose                       |
|----------------|-------------------|-------------------------------|
| id             | String (CUID)     | Primary key                   |
| moduleId       | String            | FK to TrainingModule          |
| role           | UserRole          | Target role                   |
| tier           | EmployeeTier?     | Target tier (if applicable)   |
| outline        | Json              | Module outline structure      |
| scripts        | Json              | Call scripts and talking points|
| keyPoints      | Json              | Key learning points           |
| videoBlueprint | Json?             | Video production plan         |
| createdAt      | DateTime          | Creation timestamp            |
| updatedAt      | DateTime          | Last modification             |
```

#### TrainingAssetPlan
```
| Field          | Type              | Purpose                       |
|----------------|-------------------|-------------------------------|
| id             | String (CUID)     | Primary key                   |
| moduleId       | String            | FK to TrainingModule          |
| assetType      | TrainingAssetType | VIDEO/DOCUMENT/QUIZ/SCRIPT    |
| title          | String            | Asset title                   |
| description    | String            | Asset description             |
| specifications | Json?             | Production specifications     |
| status         | String            | Planning status               |
| createdAt      | DateTime          | Creation timestamp            |
| updatedAt      | DateTime          | Last modification             |
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
  SIGNED_DOCUMENT
}

enum DocumentStatus {
  PENDING
  SIGNED
  VERIFIED
  REJECTED
  SUBMITTED
  APPROVED
}

enum LedgerEntryType {
  CLIENT_PAYOUT
  EMPLOYEE_COMMISSION
  COMPANY_FEE
  FOUNDER_SHARE
  OVERRIDE_COMMISSION
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
  RETRYING
}

enum ErrorSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum WatchAlertType {
  RULE_CHANGE
  HIGH_VALUE_CASE
  DEADLINE_APPROACHING
  PAYOUT_ANOMALY
  COMPLIANCE_RISK
  JURISDICTION_UPDATE
  INGESTION_ISSUE
  EMPLOYEE_ANOMALY
  DOCUMENT_PATTERN
  DUPLICATE_DETECTED
}

enum WatchAlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ScrapedItemType {
  TAX_SALE_LIST
  SURPLUS_PAGE
  COURT_DOCKET
  PROBATE_NOTICE
  COUNTY_RULES
  STATE_REGULATIONS
}

enum ScrapedItemReviewStatus {
  PENDING
  REVIEWED
  FLAGGED
  DISMISSED
  PROCESSED
}

enum TrainingAssetType {
  VIDEO
  DOCUMENT
  QUIZ
  SCRIPT
  CHECKLIST
  PRESENTATION
}
```

---

## 5. CORE APPLICATION FLOWS

### 5.1 Authentication Flow

```
1. User submits email + password to POST /api/auth/login
2. Rate limiter checks: max 5 attempts per 15 minutes per IP+email
3. Backend validates credentials using bcrypt.compare()
4. If valid: JWT token issued with payload:
   {
     userId: string,
     email: string,
     role: UserRole,
     tier: EmployeeTier | null
   }
5. Token expires in 7 days
6. Token stored in localStorage as "token"
7. All subsequent API requests include header:
   Authorization: Bearer <token>
8. GET /api/auth/me validates token and returns current user data
9. Role guard middleware checks role against route requirements
10. FOUNDER role bypasses all role checks (superuser)
```

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cuid...",
    "email": "user@example.com",
    "role": "EMPLOYEE",
    "name": "John Doe",
    "tier": "TIER_2_SPECIALIST"
  }
}
```

### 5.2 Case Lifecycle

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                                                         │
                    ▼                                                         │
NEW ──► CONTACTED ──► DOCS_PENDING ──► DOCS_SIGNED ──► FILED ──► AWAITING_FUNDS ──► PAID ──► CLOSED
 │          │              │               │            │              │              │
 │          │              │               │            │              │              │
 └──────────┴──────────────┴───────────────┴────────────┴──────────────┴──────────────┘
                                           │
                                           ▼
                                       REJECTED
```

| Status | Description | Trigger | Next Actions |
|--------|-------------|---------|--------------|
| NEW | Case created from ingestion or manual entry | Batch upload, manual create | Employee calls client |
| CONTACTED | Initial contact made with client | Employee marks contacted | Send documents to client |
| DOCS_PENDING | Documents sent, waiting for signatures | Documents sent to client | Follow up for signatures |
| DOCS_SIGNED | Client signed all required documents | Client signs via portal | File with county/court |
| FILED | Claim filed with appropriate authority | Staff marks filed | Wait for response |
| AWAITING_FUNDS | Claim approved, waiting for disbursement | County/court approves | Monitor for payment |
| PAID | Funds received from county/court | Payment confirmed | Process payouts, close |
| CLOSED | Case complete (successful or cancelled) | All payouts processed | Archive |
| REJECTED | Claim rejected by authority | County/court rejects | Analyze, retry, or close |

### 5.3 Shadow Accounting Flow

#### Commission Tier Structure

| Tier | Display Name | Displayed Rate | Actual Rate | Override Rate |
|------|--------------|----------------|-------------|---------------|
| TIER_1_ASSOCIATE | Associate | 20% | 10% | 0% |
| TIER_2_SPECIALIST | Specialist | 40% | 20% | 0% |
| TIER_3_SENIOR_SPECIALIST | Senior Specialist | 60% | 30% | 0% |
| TIER_4_TEAM_LEADER | Team Leader | 80% | 40% | 10% |
| TIER_5_EXECUTIVE_PARTNER | Executive Partner | 100% | 50% | 20% |

**Key Rule:** Actual rate is ALWAYS exactly half of displayed rate.

#### Payout Calculation Example

```
Input:
  surplusAmountCents: 100000  // $1,000.00 surplus
  feePercent: 30              // 30% company fee
  employeeTier: TIER_3_SENIOR_SPECIALIST

Tier Rates (from table):
  displayedRate = 60%
  actualRate = 30%

Step 1: Calculate fee amount
  feeAmountCents = surplusAmountCents × (feePercent / 100)
  feeAmountCents = 100000 × 0.30 = 30000  // $300.00

Step 2: Calculate client payout
  clientPayoutCents = surplusAmountCents - feeAmountCents
  clientPayoutCents = 100000 - 30000 = 70000  // $700.00

Step 3: Calculate employee displayed commission (what they SEE)
  employeeDisplayedCommissionCents = feeAmountCents × (displayedRate / 100)
  employeeDisplayedCommissionCents = 30000 × 0.60 = 18000  // $180.00

Step 4: Calculate employee actual commission (what they GET)
  employeeActualCommissionCents = feeAmountCents × (actualRate / 100)
  employeeActualCommissionCents = 30000 × 0.30 = 9000  // $90.00

Step 5: Calculate founder share
  founderShareCents = feeAmountCents - employeeActualCommissionCents
  founderShareCents = 30000 - 9000 = 21000  // $210.00

Output:
{
  feeAmountCents: 30000,                    // $300.00 total fee
  clientPayoutCents: 70000,                 // $700.00 to client
  employeeCommissionCents: 9000,            // $90.00 actual to employee
  employeeDisplayedCommissionCents: 18000,  // $180.00 shown to employee
  founderShareCents: 21000                  // $210.00 founder profit
}
```

#### What Each Role Sees

**FOUNDER sees:**
- Surplus: $1,000.00
- Fee: $300.00 (30%)
- Client gets: $700.00
- Employee displayed commission: $180.00 (60%)
- Employee actual commission: $90.00 (30%)
- Founder share: $210.00

**EMPLOYEE sees:**
- "Commission Rate: 60%"
- "Your commission on this case: $180.00"
- (They actually receive $90.00 but never see this)

**CLIENT sees:**
- "Case Status: Paid"
- "Funds recovered on your behalf"
- (No financial details shown)

### 5.4 Client Portal Flow

```
1. Client receives email with portal link:
   https://app.mgrcapital.com/client/{publicAccessToken}

2. Client views case status in simple, non-technical language:
   - "We're working on your case"
   - "Documents ready for your review"
   - "Your signatures are needed"
   - "Your claim has been filed"
   - "Waiting for funds to be released"
   - "Success! Funds have been processed"

3. Client completes onboarding:
   - Confirms personal information
   - Uploads government-issued ID (photo)
   - Reviews service agreement
   - Provides electronic signature

4. Client signs documents:
   - SERVICE_AGREEMENT (required)
   - LIMITED_POA (required)
   - Any additional state-specific documents

5. Client tracks progress:
   - Simple status updates
   - Document status (pending/signed)
   - Next steps in plain language

CLIENT NEVER SEES:
- Surplus amount
- Fee percentage
- Commission structure
- Employee information
- Internal case notes
- Other clients' cases
- Any backend logic
```

---

## 6. OPS LAYER ARCHITECTURE

### 6.1 Overview

The OPS layer is the intelligence brain of the system. It provides:
- Automated monitoring and alerting
- Pattern detection and anomaly identification
- Executive summaries for founder decision-making
- Web scraping and data ingestion intelligence

**Access:** FOUNDER ONLY — Never exposed to any other role.

### 6.2 Bot Network

All bots:
- Run on-demand via CoordinatorBot or individually
- Write outputs to OpsInsight and/or WatchAlert
- Produce plain-English summaries
- Are completely invisible to non-FOUNDER users

#### IngestionBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Analyze ingested data batches, flag opportunities, detect issues |
| **Inputs** | IngestionBatch records, ScrapedItem records, Case records |
| **Outputs** | WatchAlert (HIGH_VALUE_CASE, DUPLICATE_DETECTED, INGESTION_ISSUE), OpsInsight (patterns, source health) |
| **Key Functions** | `analyze()`, `detectHighValue()`, `findDuplicates()`, `assessSourceHealth()`, `analyzePatterns()` |
| **Frequency** | On batch upload (immediate), Daily scan (scheduled) |
| **Thresholds** | High-value: >$10,000 surplus, Duplicate: same parcel+owner within 90 days |

#### PayoutBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Validate payout math, detect anomalies, flag suspicious patterns |
| **Inputs** | LedgerEntry records, Case records, User records |
| **Outputs** | WatchAlert (PAYOUT_ANOMALY), OpsInsight (trends, anomaly report) |
| **Key Functions** | `analyze()`, `validateMath()`, `detectAnomalies()`, `flagOverrides()`, `analyzeVelocity()` |
| **Frequency** | On payout creation (immediate), Daily scan (scheduled) |
| **Thresholds** | Math mismatch: any deviation >1 cent, Velocity: >5 payouts/day per employee |

#### ComplianceBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Scan for deadline risks, missing documents, invalid state transitions |
| **Inputs** | Case records, Document records, Deadline records, state rules |
| **Outputs** | WatchAlert (DEADLINE_APPROACHING, COMPLIANCE_RISK), OpsInsight (compliance summary) |
| **Key Functions** | `scan()`, `checkDeadlines()`, `checkDocuments()`, `validateTransitions()`, `auditEmployees()` |
| **Frequency** | Hourly for deadlines, Daily full scan |
| **Thresholds** | Deadline risk: <7 days remaining, Missing doc: required doc not present after 48h |

#### TrainingBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Analyze training completion vs performance, identify gaps, suggest modules |
| **Inputs** | User records, TrainingProgress records, Case performance metrics |
| **Outputs** | OpsInsight (training gaps, performance correlation, suggestions) |
| **Key Functions** | `analyze()`, `identifyGaps()`, `suggestModules()`, `correlatePerformance()`, `assessReadiness()` |
| **Frequency** | Weekly |
| **Thresholds** | Gap: required module not completed within 30 days, Performance: <70% success rate |

#### OutreachBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Prioritize cases for contact, suggest outreach strategies, build follow-up queues |
| **Inputs** | Case records, Communication records, Client records, responsiveness data |
| **Outputs** | OpsInsight (prioritized lists, contact suggestions, follow-up queues) |
| **Key Functions** | `analyze()`, `prioritizeCases()`, `suggestContactMethod()`, `buildFollowUpQueue()`, `analyzeResponsiveness()` |
| **Frequency** | Daily |
| **Prioritization Factors** | Surplus amount, days since last contact, client responsiveness, deadline proximity |

#### DocketBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Analyze court deadlines, track proceedings, assess filing risks |
| **Inputs** | Case records, ScrapedItem (court dockets), Deadline records, state rules |
| **Outputs** | WatchAlert (DEADLINE_APPROACHING, JURISDICTION_UPDATE), OpsInsight (docket analysis, risk assessment) |
| **Key Functions** | `analyze()`, `calculateDeadlineSeverity()`, `trackProceedings()`, `assessRisk()`, `detectJurisdictionChanges()` |
| **Frequency** | Daily |
| **Risk Factors** | Days to deadline, filing complexity, jurisdiction rejection rate |

#### CoordinatorBot

| Aspect | Details |
|--------|---------|
| **Purpose** | Orchestrate all bots, consolidate findings, generate executive summaries |
| **Inputs** | Outputs from all other bots, OpsInsight records, WatchAlert records |
| **Outputs** | OpsInsight (executive summary, consolidated alerts, action items) |
| **Key Functions** | `runFullOpsCycle()`, `generateExecutiveSummary()`, `consolidateInsights()`, `prioritizeActions()` |
| **Frequency** | On-demand, Daily scheduled run |
| **Orchestration** | Runs all bots in parallel, waits for completion, consolidates results |

### 6.3 OPS Metrics

#### CaseHeatmap
- **Purpose:** Geographic visualization of case density and value
- **Computation:** Group cases by state/county, aggregate counts and surplusAmountCents
- **Fields:** `state`, `county`, `caseCount`, `totalValueCents`, `avgValueCents`, `riskScore`, `trend` (UP/DOWN/STABLE)
- **Update Frequency:** Real-time on case changes

#### EmployeeIntegrityScore
- **Purpose:** Composite score for employee performance and compliance
- **Computation:** Weighted average:
  - Case success rate: 40%
  - Response time: 20%
  - Training completion: 20%
  - Compliance flags: 20% (penalty)
- **Fields:** `employeeId`, `employeeName`, `integrityScore` (0-100), `casesHandled`, `successRate`, `avgResponseDays`, `trainingComplete`, `flags[]`
- **Update Frequency:** Daily recalculation

#### JurisdictionVolatilityIndex
- **Purpose:** Track rule changes and processing difficulty by jurisdiction
- **Computation:** Factor in:
  - Rule change frequency (last 90 days)
  - Rejection rate
  - Processing time variance
  - Document requirement changes
- **Fields:** `state`, `county`, `volatilityScore` (0-100), `ruleChangeCount`, `avgProcessingDays`, `rejectionRate`, `lastRuleChange`
- **Update Frequency:** Weekly recalculation

#### FounderFocusFeedItems
- **Purpose:** Prioritized list of items requiring founder attention
- **Sources:** Critical WatchAlerts, high-priority OpsInsights, unresolved system errors
- **Fields:** `id`, `type`, `priority` (1-10), `title`, `summary`, `actionRequired`, `source`, `sourceId`, `createdAt`
- **Sorting:** By priority descending, then by createdAt descending

---

## 7. FULL OPS ROUTES SPECIFICATION

### 7.1 Metrics Routes

#### GET /api/ops/metrics/dashboard

| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve complete OPS dashboard data for FounderConsole |
| **Access** | FOUNDER only |
| **Inputs** | None (query params: `timeRange` optional, default "24h") |
| **Outputs** | Dashboard summary, recent activity, alert counts, top metrics |

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
| **Inputs** | Query params: `limit` (default 20), `includeAcknowledged` (default false) |
| **Outputs** | Array of focus feed items sorted by priority |

**Response:**
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
| **Inputs** | Path param: `id` (focus item ID), Body: `{ notes?: string }` |
| **Outputs** | Updated focus item |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "acknowledged": true,
    "acknowledgedAt": "2026-01-21T11:00:00Z"
  }
}
```

#### GET /api/ops/metrics/employees/integrity

| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve employee integrity scores |
| **Access** | FOUNDER only |
| **Inputs** | Query params: `sortBy` (score/name/cases), `order` (asc/desc), `flaggedOnly` (boolean) |
| **Outputs** | Array of employee integrity scores |

**Response:**
```json
{
  "success": true,
  "data": {
    "scores": [
      {
        "employeeId": "cuid...",
        "employeeName": "John Doe",
        "integrityScore": 87,
        "casesHandled": 45,
        "successRate": 0.82,
        "avgResponseDays": 2.3,
        "trainingComplete": true,
        "flags": []
      },
      {
        "employeeId": "cuid...",
        "employeeName": "Jane Smith",
        "integrityScore": 62,
        "casesHandled": 23,
        "successRate": 0.65,
        "avgResponseDays": 4.1,
        "trainingComplete": false,
        "flags": ["TRAINING_OVERDUE", "LOW_SUCCESS_RATE"]
      }
    ],
    "averageScore": 78,
    "flaggedCount": 3
  }
}
```

#### GET /api/ops/metrics/heatmap

| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve case heatmap by jurisdiction |
| **Access** | FOUNDER only |
| **Inputs** | Query params: `groupBy` (state/county), `minCases` (default 1) |
| **Outputs** | Array of heatmap entries |

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "state": "TX",
        "county": "Harris",
        "caseCount": 156,
        "totalValueCents": 2340000,
        "avgValueCents": 15000,
        "riskScore": 35,
        "trend": "UP"
      }
    ],
    "totalStates": 42,
    "totalCounties": 234
  }
}
```

### 7.2 Watch/Alert Routes

#### GET /api/ops/watch/alerts

| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve watch alerts |
| **Access** | FOUNDER only |
| **Inputs** | Query params: `isResolved` (boolean), `severity` (CRITICAL/HIGH/MEDIUM/LOW), `type` (WatchAlertType), `limit` (default 50), `offset` (default 0) |
| **Outputs** | Array of watch alerts |

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "cuid...",
        "type": "HIGH_VALUE_CASE",
        "severity": "HIGH",
        "title": "High-value case detected",
        "message": "New case with $45,000 surplus identified in Harris County, TX",
        "state": "TX",
        "county": "Harris",
        "relatedId": "cuid...",
        "relatedType": "Case",
        "isResolved": false,
        "createdAt": "2026-01-21T09:15:00Z"
      }
    ],
    "total": 27,
    "unresolved": 15
  }
}
```

#### POST /api/ops/watch/alerts/:id/resolve

| Aspect | Details |
|--------|---------|
| **Purpose** | Resolve a watch alert |
| **Access** | FOUNDER only |
| **Inputs** | Path param: `id`, Body: `{ notes?: string }` |
| **Outputs** | Updated alert |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "isResolved": true,
    "resolvedAt": "2026-01-21T11:30:00Z",
    "resolvedById": "founder-user-id",
    "notes": "Reviewed and assigned to senior specialist"
  }
}
```

#### POST /api/ops/watch/cycle

| Aspect | Details |
|--------|---------|
| **Purpose** | Run full watch + scrape cycle |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ includeScrapers?: boolean, targetStates?: string[] }` |
| **Outputs** | Cycle execution summary |

**Response:**
```json
{
  "success": true,
  "data": {
    "cycleId": "cycle-2026-01-21-001",
    "startedAt": "2026-01-21T12:00:00Z",
    "completedAt": "2026-01-21T12:05:32Z",
    "scrapersRun": 12,
    "itemsScraped": 456,
    "alertsGenerated": 8,
    "insightsGenerated": 3,
    "errors": []
  }
}
```

#### POST /api/ops/watch/scraper/run

| Aspect | Details |
|--------|---------|
| **Purpose** | Run web scrapers manually |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ scraperType?: ScrapedItemType, states?: string[], counties?: string[] }` |
| **Outputs** | Scraper execution summary |

**Response:**
```json
{
  "success": true,
  "data": {
    "scraperId": "scrape-2026-01-21-001",
    "startedAt": "2026-01-21T12:10:00Z",
    "completedAt": "2026-01-21T12:12:45Z",
    "sourcesProcessed": 15,
    "itemsCreated": 89,
    "itemsFlagged": 12,
    "errors": []
  }
}
```

#### POST /api/ops/watch/run

| Aspect | Details |
|--------|---------|
| **Purpose** | Run watch detection cycle (without scrapers) |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ detectionTypes?: string[] }` |
| **Outputs** | Detection cycle summary |

**Response:**
```json
{
  "success": true,
  "data": {
    "watchId": "watch-2026-01-21-001",
    "detectionsRun": ["highValue", "deadlines", "anomalies", "ruleChanges"],
    "alertsGenerated": 5,
    "insightsGenerated": 2
  }
}
```

### 7.3 Bot Control Routes

#### POST /api/ops/bots/run/:botName

| Aspect | Details |
|--------|---------|
| **Purpose** | Run a specific bot manually |
| **Access** | FOUNDER only |
| **Inputs** | Path param: `botName` (ingestion/payout/compliance/training/outreach/docket/coordinator) |
| **Outputs** | Bot execution result |

**Response:**
```json
{
  "success": true,
  "data": {
    "botName": "complianceBot",
    "executionId": "exec-2026-01-21-001",
    "startedAt": "2026-01-21T13:00:00Z",
    "completedAt": "2026-01-21T13:02:15Z",
    "insightsGenerated": 2,
    "alertsGenerated": 3,
    "summary": "Scanned 456 cases. Found 3 deadline risks, 2 missing documents."
  }
}
```

#### POST /api/ops/bots/cycle

| Aspect | Details |
|--------|---------|
| **Purpose** | Run full bot cycle via CoordinatorBot |
| **Access** | FOUNDER only |
| **Inputs** | Body: `{ excludeBots?: string[] }` |
| **Outputs** | Full cycle execution summary |

**Response:**
```json
{
  "success": true,
  "data": {
    "cycleId": "bot-cycle-2026-01-21-001",
    "botsRun": ["ingestion", "payout", "compliance", "training", "outreach", "docket"],
    "totalInsights": 12,
    "totalAlerts": 8,
    "executiveSummary": "System stable. 3 high-value cases flagged. 2 deadline risks identified. 1 employee with low performance score.",
    "duration": "4m 32s"
  }
}
```

### 7.4 Error Management Routes

#### GET /api/ops/errors

| Aspect | Details |
|--------|---------|
| **Purpose** | Retrieve system errors |
| **Access** | FOUNDER only |
| **Inputs** | Query params: `resolved` (boolean), `severity`, `limit`, `offset` |
| **Outputs** | Array of system errors |

**Response:**
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": "cuid...",
        "message": "Database connection timeout",
        "stack": "Error: Connection timeout...",
        "context": { "query": "SELECT...", "duration": 30000 },
        "severity": "HIGH",
        "resolved": false,
        "createdAt": "2026-01-21T08:45:00Z"
      }
    ],
    "total": 15,
    "unresolved": 3
  }
}
```

#### POST /api/ops/errors/:id/resolve

| Aspect | Details |
|--------|---------|
| **Purpose** | Mark system error as resolved |
| **Access** | FOUNDER only |
| **Inputs** | Path param: `id`, Body: `{ notes?: string }` |
| **Outputs** | Updated error record |

---

## 8. DOCUMENT VAULT ACCESS MATRIX

### 8.1 Storage Structure

```
backend/
  storage/
    documents/
      {caseId}/
        service_agreement_{timestamp}.pdf
        limited_poa_{timestamp}.pdf
        affidavit_{timestamp}.pdf
        cover_letter_{timestamp}.pdf
        filing_packet_{timestamp}.pdf
        client_id_{timestamp}.{ext}
        signed_document_{timestamp}.pdf
        evidence_packet_{timestamp}.pdf
```

### 8.2 Document Type Access Matrix

| Document Type | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|---------------|:-------:|:-----:|:--:|:----------:|:---------:|:--------:|:------:|
| **SERVICE_AGREEMENT** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | ✓ (own) | - |
| - Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - Delete | ✓ | - | - | - | - | - | - |
| **LIMITED_POA** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | ✓ (own) | - |
| - Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - Delete | ✓ | - | - | - | - | - | - |
| **AFFIDAVIT** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | ✓ (own) | - |
| - Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | - |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | - |
| - Delete | ✓ | - | - | - | - | - | - |
| **COVER_LETTER** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | - | - |
| - Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | - |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | - |
| - Delete | ✓ | - | - | - | - | - | - |
| **FILING_PACKET** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | - | - |
| - Download | ✓ | ✓ | - | ✓ | - | - | - |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | - |
| - Delete | ✓ | - | - | - | - | - | - |
| **CLIENT_ID** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | - | ✓ (own) |
| - Download | ✓ | ✓ | - | ✓ | - | - | - |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - Delete | ✓ | - | - | - | - | - | - |
| **SIGNED_DOCUMENT** | | | | | | | |
| - Upload | ✓ | ✓ | - | - | - | ✓ (own) | ✓ (own) |
| - Download | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - View Metadata | ✓ | ✓ | - | ✓ | ✓ (team) | ✓ (own) | ✓ (own) |
| - Delete | ✓ | - | - | - | - | - | - |

### 8.3 Storage Rules

1. **Path Construction:** `backend/storage/documents/{caseId}/{type}_{timestamp}.{ext}`
2. **Database Storage:** Only relative paths stored (e.g., `documents/abc123/service_agreement_1705123456.pdf`)
3. **Full Path:** Constructed at runtime by prepending `backend/storage/`
4. **Directory Creation:** Auto-created on first document upload for case
5. **File Naming:** `{documentType}_{unixTimestamp}.{extension}`
6. **No Overwrites:** Each upload creates new file with unique timestamp

### 8.4 Security Rules

1. **No Static Serving:** Files never served via express.static()
2. **Authenticated Access:** All downloads require valid JWT
3. **Role Verification:** roleGuard checks before file access
4. **Ownership Verification:** For EMPLOYEE/CLIENT, verify case assignment/ownership
5. **Audit Logging:** All uploads and downloads logged to AuditLog
6. **Path Traversal Prevention:** Validate paths contain no `..` sequences
7. **MIME Type Validation:** Verify uploaded file matches claimed type
8. **Size Limits:** Max 50MB per file, enforced by multer

### 8.5 Integration Points

| Service | Integration |
|---------|-------------|
| `legalService.generateDocument()` | Creates PDF → saves to vault → creates Document record |
| Client ID upload (portal) | Client uploads → saves to vault → updates Document record |
| Document signing | Client signs → creates signed copy → updates Document record |
| Document download | Validates access → streams file from vault |
| `pdfService.generateAgreement()` | Generates PDF → returns buffer → vault service saves |

---

## 9. NOTIFICATION TRIGGER MAP

### 9.1 Notification Types and Triggers

#### DOCUMENTS_READY

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Documents generated and ready for client signature |
| **Recipient Role(s)** | CLIENT |
| **Channel** | EMAIL |
| **Subject Line** | "Documents Ready for Your Review - MGR Capital" |
| **Body Content** | Greeting, case reference, list of documents, portal link, deadline reminder |
| **Logging** | NotificationLog with relatedCaseId, status tracking |

**Template:**
```
Dear {clientName},

Your documents for case {internalId} are ready for review and signature.

Documents requiring your attention:
- Service Agreement
- Limited Power of Attorney

Please review and sign these documents by {deadline}.

Access your portal: {portalLink}

If you have questions, reply to this email.

MGR Capital Assistance
```

#### CASE_STATUS_CHANGED

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Case status transitions to new state |
| **Recipient Role(s)** | CLIENT, EMPLOYEE (assigned) |
| **Channel** | EMAIL |
| **Subject Line** | "Case Update - {statusDescription}" |
| **Body Content** | Status change description, next steps, action items (if any) |
| **Logging** | NotificationLog with relatedCaseId, old/new status in metadata |

**Client Template:**
```
Dear {clientName},

Your case status has been updated.

Previous Status: {oldStatusFriendly}
Current Status: {newStatusFriendly}

{nextStepsDescription}

Track your case: {portalLink}

MGR Capital Assistance
```

**Employee Template:**
```
Case {internalId} status changed.

{clientName} - {state}, {county}
Status: {oldStatus} → {newStatus}

Action Required: {actionRequired}

View case: {caseLink}
```

#### PAYOUT_COMPLETED

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Payout marked as COMPLETED in ledger |
| **Recipient Role(s)** | EMPLOYEE (commission), CLIENT (payout) |
| **Channel** | EMAIL |
| **Subject Line** | "Payment Processed - MGR Capital" |
| **Body Content** | Confirmation, amount (displayed for employee), reference number |
| **Logging** | NotificationLog with relatedCaseId, relatedUserId |

**Employee Template:**
```
Commission Payment Processed

Case: {internalId}
Amount: ${displayedAmount}
Reference: {reference}

View your earnings: {earningsLink}
```

**Client Template:**
```
Dear {clientName},

Great news! Your funds have been processed.

Case Reference: {internalId}

The funds will be delivered according to your instructions.

Thank you for choosing MGR Capital Assistance.
```

#### HIGH_VALUE_FLAG

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Case with surplus >$10,000 detected |
| **Recipient Role(s)** | FOUNDER |
| **Channel** | INTERNAL |
| **Subject Line** | "High-Value Case Flagged: ${amount}" |
| **Body Content** | Case details, surplus amount, source, recommended priority |
| **Logging** | NotificationLog, also creates WatchAlert |

**Template:**
```
HIGH-VALUE CASE DETECTED

Case: {internalId}
Surplus: ${surplusAmount}
Location: {county}, {state}
Source: {source}

Recommended Action: Assign to senior specialist, prioritize contact.

View in OPS Console: {opsLink}
```

#### DEADLINE_RISK

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Case deadline <7 days away |
| **Recipient Role(s)** | EMPLOYEE (assigned), FOUNDER (critical) |
| **Channel** | EMAIL (employee), INTERNAL (founder if <3 days) |
| **Subject Line** | "Deadline Alert: {daysRemaining} days remaining" |
| **Body Content** | Case reference, deadline date, required actions |
| **Logging** | NotificationLog, also creates WatchAlert if critical |

**Employee Template:**
```
DEADLINE ALERT

Case: {internalId}
Deadline: {deadlineDate} ({daysRemaining} days)
Deadline Type: {deadlineType}

Required Actions:
{actionList}

View case: {caseLink}
```

#### TRAINING_EVENT

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Training module assigned, completed, or overdue |
| **Recipient Role(s)** | EMPLOYEE (assigned), HR (overdue notifications) |
| **Channel** | EMAIL |
| **Subject Line** | Varies: "New Training Assigned" / "Training Completed" / "Training Overdue" |
| **Body Content** | Module name, deadline (if applicable), completion status |
| **Logging** | NotificationLog with relatedUserId |

**Assigned Template:**
```
New Training Module Assigned

Module: {moduleName}
Due Date: {dueDate}

Access your training: {trainingLink}
```

**Overdue Template (to HR):**
```
Training Overdue Alert

Employee: {employeeName}
Module: {moduleName}
Due Date: {dueDate} (overdue by {daysOverdue} days)

Employee profile: {employeeLink}
```

#### SYSTEM_ERROR

| Aspect | Details |
|--------|---------|
| **Trigger Event** | Critical or high-severity error logged |
| **Recipient Role(s)** | FOUNDER |
| **Channel** | INTERNAL |
| **Subject Line** | "[{severity}] System Error: {errorType}" |
| **Body Content** | Error message, context, stack trace summary, suggested action |
| **Logging** | NotificationLog, also creates SystemError record |

**Template:**
```
SYSTEM ERROR - {severity}

Error: {message}
Time: {timestamp}
Context: {contextSummary}

Stack Trace:
{stackTrace}

View in OPS Console: {opsLink}
```

### 9.2 Notification Processing Rules

1. **Retry Logic:** Failed emails retry up to 3 times with exponential backoff (1min, 5min, 15min)
2. **Status Tracking:** All notifications tracked in NotificationLog with status updates
3. **Rate Limiting:** Max 10 emails per recipient per hour (prevents spam)
4. **Batch Processing:** Non-urgent notifications can be batched into daily digest
5. **Unsubscribe:** Clients can unsubscribe from non-essential notifications
6. **Logging:** Every notification attempt logged with timestamp, status, error (if any)

---

## 10. PDF TEMPLATE SPECIFICATION

### 10.1 SERVICE_AGREEMENT

| Field | Source | Required |
|-------|--------|----------|
| `clientName` | Client.name | Yes |
| `clientAddress` | Client full address | Yes |
| `propertyAddress` | Case.propertyAddress | Yes |
| `state` | Case.state | Yes |
| `county` | Case.county | Yes |
| `feePercent` | Case.feePercent | Yes |
| `effectiveDate` | Current date | Yes |
| `companyName` | "MGR Capital Assistance" | Yes |
| `companyAddress` | Config | Yes |

**Template Structure:**
```
[MGR CAPITAL LOGO]

SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of {effectiveDate}...

PARTIES:
Client: {clientName}
Address: {clientAddress}

Company: {companyName}
Address: {companyAddress}

PROPERTY:
Address: {propertyAddress}
County: {county}, State: {state}

TERMS:
1. Scope of Services...
2. Compensation: Company shall receive {feePercent}% of recovered funds...
3. Term and Termination...
4. Representations and Warranties...
5. Limitation of Liability...
6. Governing Law: State of {state}...

SIGNATURES:

Client Signature: _________________ Date: _________
Print Name: {clientName}

Company Representative: _________________ Date: _________
Print Name: _________________
```

**Signature Requirements:** Client signature required, company counter-signature optional
**Storage:** `documents/{caseId}/service_agreement_{timestamp}.pdf`

### 10.2 LIMITED_POA

| Field | Source | Required |
|-------|--------|----------|
| `clientName` | Client.name | Yes |
| `clientAddress` | Client full address | Yes |
| `propertyAddress` | Case.propertyAddress | Yes |
| `parcelNumber` | Case.parcelNumber | If available |
| `state` | Case.state | Yes |
| `county` | Case.county | Yes |
| `scope` | State-specific | Yes |
| `duration` | "Until case completion or 2 years" | Yes |

**Template Structure:**
```
[MGR CAPITAL LOGO]

LIMITED POWER OF ATTORNEY

KNOW ALL PERSONS BY THESE PRESENTS:

I, {clientName}, residing at {clientAddress}, do hereby appoint
MGR Capital Assistance as my true and lawful attorney-in-fact...

PROPERTY:
{propertyAddress}
Parcel Number: {parcelNumber}
County: {county}, State: {state}

POWERS GRANTED:
The attorney-in-fact is authorized to:
1. File claims for excess proceeds or surplus funds...
2. Communicate with government agencies...
3. Execute documents necessary...
4. Receive funds on my behalf...

LIMITATIONS:
{scopeLimitations}

DURATION:
{duration}

This Power of Attorney shall be governed by the laws of {state}.

PRINCIPAL SIGNATURE:

_________________ Date: _________
{clientName}

NOTARIZATION:
State of _________
County of _________
[Notary section - state specific]
```

**Signature Requirements:** Client signature required, notarization may be required by state
**Storage:** `documents/{caseId}/limited_poa_{timestamp}.pdf`

### 10.3 AFFIDAVIT

| Field | Source | Required |
|-------|--------|----------|
| `clientName` | Client.name | Yes |
| `clientAddress` | Client full address | Yes |
| `propertyAddress` | Case.propertyAddress | Yes |
| `saleDate` | Case.saleDate | If available |
| `state` | Case.state | Yes |
| `county` | Case.county | Yes |
| `claimBasis` | State-specific | Yes |

**Template Structure:**
```
[MGR CAPITAL LOGO]

AFFIDAVIT OF CLAIM

STATE OF {state}
COUNTY OF {county}

I, {clientName}, being duly sworn, depose and say:

1. I am over 18 years of age and competent to testify...

2. I am the owner/former owner/heir of the property located at:
   {propertyAddress}

3. The property was sold at tax sale on {saleDate}...

4. I am entitled to the excess proceeds/surplus funds because:
   {claimBasis}

5. I have not previously received these funds...

6. The statements in this affidavit are true and correct...

FURTHER AFFIANT SAYETH NOT.

_________________ Date: _________
{clientName}

SUBSCRIBED AND SWORN before me this ___ day of _______, 20__.

_________________
Notary Public
My Commission Expires: _________
```

**Signature Requirements:** Client signature required, notarization required
**Storage:** `documents/{caseId}/affidavit_{timestamp}.pdf`

### 10.4 COVER_LETTER

| Field | Source | Required |
|-------|--------|----------|
| `recipientName` | County clerk/treasurer | Yes |
| `recipientTitle` | Office title | Yes |
| `recipientAddress` | Office address | Yes |
| `caseReference` | Case.internalId | Yes |
| `clientName` | Client.name | Yes |
| `propertyAddress` | Case.propertyAddress | Yes |
| `parcelNumber` | Case.parcelNumber | If available |
| `documentList` | Enclosed documents | Yes |

**Template Structure:**
```
[MGR CAPITAL LOGO]
[Company Address]
[Date]

{recipientName}
{recipientTitle}
{recipientAddress}

RE: Claim for Surplus Funds
    Property: {propertyAddress}
    Parcel: {parcelNumber}
    Our Reference: {caseReference}

Dear {recipientName}:

Please find enclosed the following documents in support of our client's
claim for surplus funds:

{documentList}

Our client, {clientName}, is entitled to surplus funds from the tax sale
of the above-referenced property.

Please process this claim at your earliest convenience. Should you require
additional documentation, please contact our office.

Respectfully submitted,

MGR Capital Assistance
[Contact Information]
```

**Signature Requirements:** Company signature
**Storage:** `documents/{caseId}/cover_letter_{timestamp}.pdf`

### 10.5 FILING_PACKET

| Field | Source | Required |
|-------|--------|----------|
| All fields from included documents | Various | Yes |
| `tableOfContents` | Generated | Yes |
| `includedDocuments` | List of documents | Yes |

**Template Structure:**
```
[MGR CAPITAL LOGO]

SURPLUS FUNDS CLAIM PACKET

Case Reference: {internalId}
Filing Date: {filingDate}
Jurisdiction: {county}, {state}

TABLE OF CONTENTS:
1. Cover Letter........................Page 2
2. Service Agreement...................Page 3
3. Limited Power of Attorney...........Page 7
4. Affidavit..........................Page 10
5. Supporting Evidence................Page 12
6. Client Identification..............Page 15

[Each document follows as separate section]
```

**Signature Requirements:** All component documents must be signed
**Storage:** `documents/{caseId}/filing_packet_{timestamp}.pdf`

### 10.6 Additional Document Types

| Type | Purpose | Key Fields |
|------|---------|------------|
| EVIDENCE_PACKET | Supporting evidence compilation | Property records, tax records, chain of title |
| FOLLOW_UP_LETTER | Follow-up on filed claim | Case reference, original filing date, status request |
| VERIFICATION_LETTER | Verify claim status | Case reference, verification request |
| PAYMENT_INSTRUCTIONS | Payment delivery instructions | Client name, payment method, routing info |

### 10.7 PDF Engine Integration

```
pdfService.generateDocument(type, caseId, data):
  1. Load template for document type
  2. Fetch case, client, and state rules from database
  3. Merge data into template
  4. Generate PDF using pdfkit
  5. Call documentVaultService.saveDocument(caseId, buffer, metadata)
  6. Create Document record in database
  7. Return Document record with filePath
```

---

## 11. TRAINING INTELLIGENCE BLUEPRINT

### 11.1 Training Module Generation

#### generateTrainingModuleOutline(role, tier)

**Purpose:** Generate comprehensive training module outline for specific role/tier

**Inputs:**
- `role`: UserRole (EMPLOYEE, TEAM_LEAD, HR, COMPLIANCE)
- `tier`: EmployeeTier (for EMPLOYEE role only)

**Process:**
1. Determine required competencies based on role/tier
2. Identify knowledge gaps from TrainingBot analysis
3. Generate structured outline with learning objectives
4. Create assessment criteria
5. Save to TrainingModuleDetail

**Output Structure:**
```json
{
  "moduleId": "cuid...",
  "role": "EMPLOYEE",
  "tier": "TIER_2_SPECIALIST",
  "outline": {
    "title": "Specialist Level Training",
    "duration": "8 hours",
    "sections": [
      {
        "title": "Advanced Client Communication",
        "objectives": ["Handle objections", "Build rapport", "Close agreements"],
        "topics": ["Objection handling", "Trust building", "Closing techniques"],
        "duration": "2 hours"
      }
    ]
  },
  "scripts": {
    "initialContact": "Hello, this is {name} from MGR Capital...",
    "objectionHandling": {
      "tooGoodToBeTrue": "I understand your concern. Let me explain...",
      "alreadyHiredSomeone": "That's great that you're taking action..."
    }
  },
  "keyPoints": [
    "Never mention specific dollar amounts",
    "Always confirm client identity before discussing case",
    "Document all communication attempts"
  ]
}
```

### 11.2 Assessment Question Generation

#### generateAssessmentQuestions(moduleId)

**Purpose:** Generate quiz questions for module assessment

**Inputs:**
- `moduleId`: TrainingModuleDetail ID

**Process:**
1. Load module outline and key points
2. Generate questions covering all learning objectives
3. Create multiple choice and scenario-based questions
4. Set passing threshold (typically 80%)
5. Save to module assessment

**Output Structure:**
```json
{
  "moduleId": "cuid...",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "When should you mention specific surplus amounts to a client?",
      "options": [
        { "id": "a", "text": "During the initial call" },
        { "id": "b", "text": "After they sign the agreement" },
        { "id": "c", "text": "Never - employees don't have access to this information" },
        { "id": "d", "text": "Only if they ask directly" }
      ],
      "correctAnswer": "c",
      "explanation": "Employees never see or discuss specific surplus amounts..."
    },
    {
      "id": "q2",
      "type": "scenario",
      "scenario": "A client says they already hired another company...",
      "question": "What is the best response?",
      "options": [...],
      "correctAnswer": "b"
    }
  ],
  "passingScore": 80,
  "timeLimit": 30
}
```

### 11.3 TrainingBot Gap Analysis

#### TrainingBot.identifyGaps()

**Purpose:** Identify training gaps correlating with performance issues

**Process:**
1. Query employees with low success rates (<70%)
2. Check training completion status
3. Correlate incomplete training with performance metrics
4. Identify common gaps across multiple employees
5. Generate OpsInsight with recommendations

**Gap Detection Logic:**
```
For each employee with successRate < 0.70:
  - Check which modules are incomplete
  - Check time since last training
  - Check performance trend (improving/declining)

For each incomplete module with >3 employees:
  - Flag as systemic gap
  - Recommend mandatory completion

Generate insight:
  {
    type: "TRAINING_GAP",
    title: "Training Gap Identified",
    summary: "5 employees missing 'Advanced Client Communication' module...",
    actionRequired: true,
    data: {
      module: "Advanced Client Communication",
      affectedEmployees: [...],
      avgSuccessRate: 0.62
    }
  }
```

### 11.4 HR Panel Integration

**Training Compliance View:**
- List all employees with training status
- Filter by: overdue, incomplete, completed
- Show days since last training
- One-click reminder sending

**Actions Available:**
- Assign new module to employee
- Send training reminder
- Mark training as excused (with notes)
- View training history

### 11.5 Compliance Panel Integration

**Training Audit View:**
- Overall training completion rate
- Compliance by role/tier
- Overdue training report
- Training effectiveness metrics (completion vs performance)

**Audit Actions:**
- Generate training compliance report
- Flag employees for non-compliance
- Escalate to HR for action

### 11.6 TrainingModuleDetail and TrainingAssetPlan Usage

**TrainingModuleDetail:**
- Stores generated module content
- Referenced by TrainingProgress for completion tracking
- Updated when module content changes
- Used by EmployeeTraining page to display content

**TrainingAssetPlan:**
- Plans for producing training materials
- Types: VIDEO, DOCUMENT, QUIZ, SCRIPT, CHECKLIST
- Contains production specifications
- Tracks production status (planned, in_progress, completed)

---

## 12. INGESTION INTELLIGENCE BLUEPRINT

### 12.1 Parsing Functions

#### parseTaxSaleCSV(content)

**Purpose:** Parse county tax sale CSV files

**Input:** Raw CSV content (string)

**Expected Columns:**
- `parcel_number` or `parcel_id`
- `owner_name` or `property_owner`
- `property_address`
- `sale_date`
- `sale_amount` or `bid_amount`
- `surplus_amount` (if available)

**Process:**
1. Detect delimiter (comma, tab, semicolon)
2. Parse headers and map to standard fields
3. Validate required fields present
4. Parse each row into structured object
5. Validate data types (dates, amounts)
6. Flag rows with validation errors

**Output:**
```json
{
  "success": true,
  "records": [
    {
      "parcelNumber": "123-456-789",
      "ownerName": "John Doe",
      "propertyAddress": "123 Main St, Houston, TX 77001",
      "saleDate": "2025-06-15",
      "saleAmountCents": 5000000,
      "surplusAmountCents": 1500000
    }
  ],
  "errors": [
    { "row": 15, "error": "Invalid date format" }
  ],
  "stats": {
    "totalRows": 150,
    "validRows": 148,
    "errorRows": 2,
    "totalSurplusCents": 45000000
  }
}
```

#### parseSurplusPDF(content)

**Purpose:** Extract surplus fund data from county PDF documents

**Input:** PDF content (buffer or path)

**Process:**
1. Extract text from PDF using pdf-parse
2. Identify table structures
3. Extract property records using regex patterns
4. Parse amounts, removing currency formatting
5. Map to standard structure
6. Flag extraction uncertainties

**Output:**
```json
{
  "success": true,
  "records": [...],
  "confidence": 0.85,
  "warnings": ["Some values may be approximate due to PDF formatting"]
}
```

#### parseProbateListCSV(content)

**Purpose:** Parse probate court listing files

**Expected Columns:**
- `case_number`
- `deceased_name`
- `property_address`
- `filing_date`
- `estate_value` (if available)

**Output:**
```json
{
  "success": true,
  "records": [
    {
      "caseNumber": "2025-PR-12345",
      "deceasedName": "Jane Smith",
      "propertyAddress": "456 Oak Ave, Dallas, TX 75201",
      "filingDate": "2025-03-20",
      "estateValueCents": 25000000
    }
  ]
}
```

### 12.2 ScraperService Functions

#### fetchTaxSaleLists(state, county)

**Purpose:** Scrape county tax sale announcement pages

**Process:**
1. Load URL pattern for state/county from config
2. Fetch page content
3. Parse HTML for tax sale listings
4. Extract dates, properties, amounts
5. Save to ScrapedItem with sourceType: TAX_SALE_LIST
6. Flag high-value items for review

**Config Structure:**
```json
{
  "TX": {
    "Harris": {
      "taxSaleUrl": "https://...",
      "selectors": {
        "tableContainer": ".tax-sale-list",
        "rows": "tr",
        "parcel": "td:nth-child(1)",
        "address": "td:nth-child(2)"
      }
    }
  }
}
```

#### fetchSurplusPages(state, county)

**Purpose:** Scrape county surplus fund listing pages

**Process:**
1. Load URL pattern for state/county
2. Fetch page content
3. Parse HTML or PDF links
4. Download and parse surplus documents
5. Save to ScrapedItem with sourceType: SURPLUS_PAGE
6. Flag amounts >$10,000

#### fetchProbateNotices(state, county)

**Purpose:** Scrape court probate notice pages

**Process:**
1. Load court website URL
2. Fetch recent probate filings
3. Extract case numbers and property info
4. Cross-reference with surplus records
5. Save to ScrapedItem with sourceType: PROBATE_NOTICE

### 12.3 WatchService Detection Functions

#### detectHighValueOpportunities()

**Purpose:** Identify high-value cases from scraped data

**Thresholds:**
- High Value: surplus >$10,000
- Very High Value: surplus >$50,000
- Exceptional: surplus >$100,000

**Process:**
1. Query ScrapedItem where reviewStatus = PENDING
2. Parse surplusAmount from parsedData
3. For items exceeding threshold:
   - Create WatchAlert (HIGH_VALUE_CASE)
   - Create OpsInsight with details
   - Set priority based on amount

#### detectJurisdictionChanges()

**Purpose:** Detect changes in county/state rules

**Process:**
1. Compare current scraped rules to stored rules
2. Identify changes in:
   - Filing deadlines
   - Required documents
   - Fee structures
   - Contact information
3. Create WatchAlert (RULE_CHANGE) for significant changes
4. Update stored rules

#### detectDeadlineRisks()

**Purpose:** Identify cases approaching deadlines

**Process:**
1. Query cases with status != PAID, CLOSED, REJECTED
2. Calculate days to deadline based on state rules
3. Flag cases with <7 days remaining
4. Create WatchAlert (DEADLINE_APPROACHING) for critical deadlines

### 12.4 Writing to WatchAlert and ScrapedItem

**ScrapedItem Creation:**
```
scraperService.fetchTaxSaleLists("TX", "Harris"):
  1. Fetch page content
  2. Parse records
  3. For each record:
     ScrapedItem.create({
       sourceType: TAX_SALE_LIST,
       sourceUrl: url,
       state: "TX",
       county: "Harris",
       rawContent: htmlContent,
       parsedData: { parcel, owner, address, amount },
       reviewStatus: PENDING
     })
  4. Return summary
```

**WatchAlert Creation:**
```
watchService.detectHighValueOpportunities():
  1. Query pending ScrapedItems
  2. For items with surplus > $10,000:
     WatchAlert.create({
       type: HIGH_VALUE_CASE,
       severity: surplus > 50000 ? CRITICAL : HIGH,
       title: "High-value opportunity: $" + formatMoney(surplus),
       message: "Property at " + address + " with " + surplus + " surplus",
       state: item.state,
       county: item.county,
       relatedId: item.id,
       relatedType: "ScrapedItem"
     })
```

---

## 13. BACKUPS PLAYBOOK

### 13.1 Backup Strategy Overview

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| PostgreSQL Database | pg_dump (custom format) | Every 6 hours | 30 days |
| Document Vault | File system copy/rsync | Daily | 30 days |
| Configuration | Git repository | On change | Indefinite |
| Audit Logs | Separate archive | Weekly | 7 years |

### 13.2 PostgreSQL Backup Commands

**Full Database Backup:**
```bash
# Custom format (recommended - supports parallel restore)
pg_dump -h localhost -U postgres -d mgr_capital \
  -F c -Z 9 \
  -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump

# Plain SQL format (readable, larger)
pg_dump -h localhost -U postgres -d mgr_capital \
  -F p \
  -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).sql
```

**Schema-Only Backup:**
```bash
pg_dump -h localhost -U postgres -d mgr_capital \
  --schema-only \
  -f /backups/schema/schema_$(date +%Y%m%d).sql
```

**Data-Only Backup:**
```bash
pg_dump -h localhost -U postgres -d mgr_capital \
  --data-only -F c \
  -f /backups/data/data_$(date +%Y%m%d_%H%M%S).dump
```

**Critical Tables Only:**
```bash
pg_dump -h localhost -U postgres -d mgr_capital \
  -t '"User"' -t '"Case"' -t '"Client"' -t '"LedgerEntry"' -t '"Document"' \
  -F c \
  -f /backups/critical/critical_$(date +%Y%m%d_%H%M%S).dump
```

### 13.3 Cron Schedule Examples

```cron
# /etc/cron.d/mgr-backups

# Every 6 hours: Database snapshot
0 */6 * * * postgres /opt/mgr/scripts/backup_db.sh >> /var/log/mgr-backup.log 2>&1

# Daily at 2 AM: Full database + document vault
0 2 * * * root /opt/mgr/scripts/daily_backup.sh >> /var/log/mgr-backup.log 2>&1

# Weekly on Sunday at 3 AM: Full archive with encryption
0 3 * * 0 root /opt/mgr/scripts/weekly_backup.sh >> /var/log/mgr-backup.log 2>&1

# Monthly on 1st at 4 AM: Long-term archive
0 4 1 * * root /opt/mgr/scripts/monthly_archive.sh >> /var/log/mgr-backup.log 2>&1

# Daily: Clean old backups
0 5 * * * root /opt/mgr/scripts/cleanup_backups.sh >> /var/log/mgr-backup.log 2>&1
```

### 13.4 Retention Policy

| Backup Type | Retention Period | Storage Location |
|-------------|------------------|------------------|
| 6-hour snapshots | 7 days | /backups/db/hourly/ |
| Daily backups | 30 days | /backups/db/daily/ |
| Weekly backups | 90 days | /backups/db/weekly/ |
| Monthly archives | 1 year | /backups/db/monthly/ |
| Annual archives | 7 years | /backups/archive/ |

**Cleanup Script:**
```bash
#!/bin/bash
# cleanup_backups.sh

# Remove 6-hour snapshots older than 7 days
find /backups/db/hourly/ -mtime +7 -name "*.dump" -delete

# Remove daily backups older than 30 days
find /backups/db/daily/ -mtime +30 -name "*.dump" -delete

# Remove weekly backups older than 90 days
find /backups/db/weekly/ -mtime +90 -name "*.dump" -delete

# Keep monthly backups for 1 year
find /backups/db/monthly/ -mtime +365 -name "*.dump" -delete
```

### 13.5 Encryption Guidance

**Encrypt Backup with GPG:**
```bash
# Encrypt
gpg --cipher-algo AES256 --symmetric \
  --batch --passphrase-file /etc/mgr/backup.key \
  -o backup.dump.gpg backup.dump

# Decrypt
gpg --decrypt \
  --batch --passphrase-file /etc/mgr/backup.key \
  -o backup.dump backup.dump.gpg
```

**Key Management Rules:**
1. Store encryption keys separately from backups
2. Never store keys in git repository
3. Maintain key escrow with trusted party
4. Rotate keys annually
5. Test decryption monthly

### 13.6 Restore Procedure

**Full Database Restore:**
```bash
# Stop application
systemctl stop mgr-backend

# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS mgr_capital;"
psql -U postgres -c "CREATE DATABASE mgr_capital;"

# Restore from backup
pg_restore -h localhost -U postgres -d mgr_capital \
  -F c -j 4 /backups/db/daily/mgr_capital_YYYYMMDD.dump

# Run Prisma migrations (if any)
cd /app/backend && npx prisma migrate deploy

# Restart application
systemctl start mgr-backend
```

**Document Vault Restore:**
```bash
# Stop application
systemctl stop mgr-backend

# Restore documents
rsync -av /backups/documents/YYYYMMDD/ /app/backend/storage/documents/

# Restart application
systemctl start mgr-backend
```

### 13.7 Sovereign Backup Philosophy

1. **No Cloud Dependencies:** All backups stored on self-controlled infrastructure
2. **Geographic Distribution:** Maintain off-site copy in separate physical location
3. **Encryption at Rest:** All backups encrypted before storage
4. **Regular Testing:** Monthly restore test to verify backup integrity
5. **Documentation:** Maintain runbook with step-by-step restore procedures
6. **Air-Gap Capable:** Backup system can operate without internet
7. **Audit Trail:** Log all backup/restore operations

---

## 14. PHASE SUMMARY FOR COPILOT

### 14.1 Key Design Decisions Made

1. **Unified 7 Roles:** Consolidated FOUNDER, ADMIN, HR, COMPLIANCE, TEAM_LEAD, EMPLOYEE, CLIENT from both source documents. "CONTRACTOR" from COPILOT_REBUILD.txt treated as equivalent to "EMPLOYEE".

2. **Role Permission Levels:** Established numeric levels (100, 80, 60, 40, 20, 10) for clean comparison logic in roleGuard middleware.

3. **Bot Architecture:** Confirmed 7 bots total (Ingestion, Payout, Compliance, Training, Outreach, Docket, Coordinator), all writing to OpsInsight/WatchAlert tables, all orchestrated by CoordinatorBot.

4. **Shadow Accounting Formula:** Locked in formula where displayedRate = 2 × actualRate. No exceptions, no overrides for this ratio.

5. **Document Vault:** Confirmed local filesystem storage only. No S3, no cloud storage. Path: `backend/storage/documents/{caseId}/`.

6. **Notification Engine:** SMTP-based only. No Twilio, no SendGrid. Self-hosted mail server or SMTP relay.

7. **PDF Generation:** pdfkit library for programmatic PDF generation. No external APIs.

8. **Rate Limiting:** In-memory store with Redis-upgrade path. Applied to auth endpoints.

9. **FounderConsole Tabs:** Consolidated into: Overview, Alerts, Scraped Data, Employees, Heatmap, Errors.

### 14.2 Ambiguities Resolved

1. **CONTRACTOR vs EMPLOYEE:** Standardized on EMPLOYEE as it's already in Prisma schema and codebase.

2. **NotificationLog Fields:** Used expanded version with all tracking fields (attempts, sentAt, bodyPreview).

3. **Bot Output Destinations:** Clarified that bots write to OpsInsight for analytics/summaries and WatchAlert for actionable alerts.

4. **TrainingModuleDetail vs TrainingAssetPlan:** TrainingModuleDetail = content/outline, TrainingAssetPlan = production plans for videos/documents.

5. **Document Access Control:** Built complete matrix defining upload/download/view/delete permissions per role and document type.

6. **HR vs Compliance Panel Separation:** HR focuses on employee lifecycle (onboarding, training, tiers). Compliance focuses on audits, risk, and payout review.

7. **OPS Routes Structure:** Separated into /ops/metrics (analytics), /ops/watch (alerts/scrapers), /ops/bots (bot controls), /ops/errors (system errors).

### 14.3 Areas of Risk/Complexity

1. **ScraperService Implementation:**
   - HIGH complexity due to varying county website structures
   - Requires per-jurisdiction pattern definitions
   - Websites may change without notice
   - Recommendation: Start with high-volume states (TX, FL, CA), add incrementally

2. **PDF Template Legal Compliance:**
   - MEDIUM complexity
   - Templates must comply with 50 different state requirements
   - Some states require notarization, specific language
   - Recommendation: Legal review of templates before production

3. **Bot Heuristics:**
   - Currently skeleton implementations
   - Need domain expertise to define proper thresholds
   - Recommendation: Start with conservative thresholds, tune based on data

4. **Rate Limiting Tuning:**
   - Too strict = blocks legitimate users
   - Too loose = vulnerable to abuse
   - Recommendation: Start with documented thresholds, monitor and adjust

5. **Shadow Accounting Visibility:**
   - Critical that displayed amounts never leak to wrong roles
   - Every query touching amounts must be role-aware
   - Recommendation: Add middleware that strips sensitive fields based on role

### 14.4 What Copilot Must Consider for Phase 2

1. **Complete Bot Logic:** Move from skeletons to real implementations with actual detection heuristics.

2. **Add Real-Time Updates:** Consider WebSocket integration for FounderConsole live updates.

3. **Mobile Responsiveness:** Current UI optimized for desktop. Mobile optimization needed.

4. **State Rules Database:** Currently 50 state rules in code. Consider moving to database for easier updates.

5. **Audit Log Retention:** Current logs grow indefinitely. Implement archival strategy.

6. **Performance at Scale:** Test with 10,000+ cases, 100+ employees. May need query optimization.

7. **Error Recovery:** Implement retry logic for failed operations (email sends, PDF generation).

8. **Testing Coverage:** Add unit tests for commission calculations, role guards, and bot detection logic.

### 14.5 Implementation Priority Recommendation

**Phase 2 Priority Order:**

1. **HIGH - Security:**
   - Verify rate limiting is applied correctly
   - Audit all endpoints for proper role guards
   - Verify shadow accounting never leaks

2. **HIGH - Core Features:**
   - Complete PDF engine with all templates
   - Verify notification engine sends correctly
   - Test document vault upload/download flow

3. **MEDIUM - OPS Intelligence:**
   - Implement real bot detection logic
   - Add scraper configurations for priority states
   - Complete FounderConsole error management

4. **LOW - Enhancements:**
   - Mobile responsive design
   - Real-time WebSocket updates
   - Advanced reporting features

---

**END OF MGR_CAPITAL_ASSISTANCE_MASTER_SPEC_V1_FINAL.md**

*This document is the canonical source of truth for the MGR Capital Assistance platform. All implementation must conform to this specification.*
