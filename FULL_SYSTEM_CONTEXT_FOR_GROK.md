# MGR CAPITAL ASSISTANCE — COMPLETE SYSTEM CONTEXT
## For Grok AI to Review, Validate, and Suggest Additional Implementations

**Generated:** 2026-01-22
**Updated:** 2026-01-23
**Current Phase:** Phase 5 & 6 COMPLETE, Phase 7 SKELETONS CREATED

---

# PART 1: PLATFORM OVERVIEW

## What Is MGR Capital Assistance?

A **sovereign, self-hosted surplus and tax sale recovery platform** that:
1. Ingests county tax sale lists and surplus fund data
2. Creates cases for property owners owed money
3. Manages the full claims lifecycle (outreach → docs → filing → payout)
4. Handles employee/contractor commissions with **shadow accounting**
5. Provides founder-only OPS intelligence layer

## Core Architecture Principles

- **TypeScript/Node.js backend** with Express
- **PostgreSQL** via Prisma ORM (hosted on Neon)
- **No external dependencies** for core logic (no Sentry, no analytics services)
- **Shadow accounting**: Employees see inflated commission rates (20/40/60/80/100%) but actually receive (10/20/30/40/50%)
- **Role-based access**: FOUNDER sees everything, employees/clients see filtered data
- **Bot-driven intelligence**: 7 internal bots analyze data and generate insights

---

# PART 2: COMPLETE DATABASE SCHEMA

## All Enums (30 total)

```prisma
// USER & ROLES
enum UserRole { FOUNDER, ADMIN, EMPLOYEE, CLIENT, HR, COMPLIANCE, TEAM_LEAD }
enum EmployeeTier { TIER_1_ASSOCIATE, TIER_2_SPECIALIST, TIER_3_SENIOR_SPECIALIST, TIER_4_TEAM_LEADER, TIER_5_EXECUTIVE_PARTNER }

// CASE MANAGEMENT
enum CaseStatus { NEW, CONTACTED, DOCS_PENDING, DOCS_SIGNED, FILED, AWAITING_FUNDS, PAID, CLOSED, REJECTED }
enum DocumentType { CLIENT_SERVICE_AGREEMENT, LIMITED_POA, AFFIDAVIT, MOTION, COVER_LETTER, FILING_PACKET, EVIDENCE_PACKET, FOLLOW_UP_LETTER, VERIFICATION_LETTER, PAYMENT_INSTRUCTIONS, CLIENT_ID, PROPERTY_DEED, TAX_RECORD, OTHER }
enum DocumentStatus { DRAFT, PENDING_SIGNATURE, SIGNED, SUBMITTED, APPROVED, REJECTED }

// FINANCIAL
enum LedgerEntryType { COMMISSION, EMPLOYEE_COMMISSION, OVERRIDE, FOUNDER_SHARE, CLIENT_PAYOUT, COMPANY_FEE, ADJUSTMENT, REFUND, FEE }
enum LedgerEntryStatus { PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED }

// COMMUNICATION
enum CommunicationType { CALL, TEXT, EMAIL, PORTAL_MESSAGE }
enum CommunicationDirection { INBOUND, OUTBOUND }

// TRAINING
enum TrainingModuleStatus { LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED }
enum TrainingModuleSourceType { STATIC, OPS_INSIGHT, SCRAPED_ITEM, CLAIM_PATTERN, COMPLIANCE_UPDATE, JURISDICTION_CHANGE, INGESTION_PATTERN, PARSER_SUGGESTION }
enum TrainingRecommendationPriority { LOW, NORMAL, HIGH, URGENT, MANDATORY }
enum TrainingRecommendationReason { LOW_CONVERSION, MISSING_SKILLS, TIER_REQUIREMENT, COMPLIANCE_GAP, JURISDICTION_UPDATE, NEW_HIRE, PERFORMANCE_DECLINE, SKILL_REFRESH, PROMOTION_PATH }
enum TierProgressionStatus { NOT_ELIGIBLE, IN_PROGRESS, REQUIREMENTS_MET, PENDING_REVIEW, APPROVED, DENIED }
enum TrainingAssetType { VIDEO_SCRIPT, PDF_GUIDE, SLIDE_DECK, CHECKLIST, AUDIO_SCRIPT, QUIZ, INTERACTIVE }

// INGESTION
enum IngestionSourceType { TAX_SALE_LIST, SURPLUS_PDF, AUCTION_RESULT, COUNTY_WEBSITE, MANUAL_ENTRY }

// OPS LAYER
enum ScrapedItemType { TAX_SALE_LIST, SURPLUS_RULES, COURT_NOTICE, COUNTY_WEBSITE, STATE_STATUTE, DOCUMENT_PATTERN }
enum ScrapedItemReviewStatus { PENDING, REVIEWED, ACTIONABLE, DISMISSED, ARCHIVED }
enum WatchAlertType { RULE_CHANGE_DETECTED, NEW_DOCUMENT_PATTERN, DEADLINE_PATTERN_CHANGE, HIGH_RISK_INGESTION, PAYOUT_ANOMALY, EMPLOYEE_ANOMALY, JURISDICTION_VOLATILITY, SYSTEM_HEALTH }
enum WatchAlertSeverity { INFO, LOW, MEDIUM, HIGH, CRITICAL }
enum OpsInsightType { INGESTION_ANALYSIS, PAYOUT_ANALYSIS, COMPLIANCE_CHECK, TRAINING_ANALYSIS, COORDINATOR_SUMMARY, CASE_RECOMMENDATION, EMPLOYEE_COACHING, SYSTEM_HEALTH }
enum OpsInsightPriority { LOW, NORMAL, HIGH, URGENT }

// SYSTEM
enum SystemErrorSeverity { DEBUG, INFO, WARNING, ERROR, CRITICAL }
enum NotificationType { EMAIL, SMS, PUSH, IN_APP }
enum NotificationStatus { PENDING, SENT, DELIVERED, FAILED, BOUNCED }
```

## All Models (39 total)

### Core Business Models
| Model | Purpose |
|-------|---------|
| `User` | All users (founder, employees, clients) with role-based fields |
| `UserSession` | JWT session tracking |
| `Case` | Core claim/case entity with financials (all in cents) |
| `Deadline` | Case deadlines with reminder tracking |
| `Document` | Case documents with signatures |
| `DocumentTemplate` | Templates for document generation |
| `StateRule` | State-level surplus fund laws |
| `CountyRule` | County-specific overrides |
| `LedgerEntry` | Financial transactions with shadow accounting |
| `CommissionPlan` | Tier-based commission rates (displayed vs actual) |
| `Communication` | Call/email/text logs |
| `Script` | Communication scripts per case status |
| `CallScore` | Employee call quality scores |

### Training Models
| Model | Purpose |
|-------|---------|
| `TrainingModule` | Static training modules |
| `TrainingQuestion` | Quiz questions for modules |
| `EmployeeTrainingProgress` | Employee progress on modules |
| `TrainingRecommendation` | Personalized recommendations (Phase 5) |
| `DynamicTrainingModule` | Auto-generated modules from insights (Phase 5) |
| `TierProgressionLog` | Tier advancement evaluations (Phase 5) |
| `TrainingModuleDetail` | Detailed content for AI generation |
| `TrainingAssetPlan` | Asset production plans |

### Ingestion Models
| Model | Purpose |
|-------|---------|
| `IngestionSource` | Data source configurations |
| `IngestionBatch` | Processing batches (enhanced with stats fields) |
| `IngestionRecord` | Individual records with parsing status (enhanced with prediction fields) |
| `ParserVersion` | DB-driven parser versioning per jurisdiction (Phase 6) |
| `PropertyClass` | Property classification for prediction accuracy (Phase 6) |

### OPS Layer Models (FOUNDER ONLY)
| Model | Purpose |
|-------|---------|
| `ScrapedItem` | Scraped content from county/state sites |
| `WatchAlert` | Alerts for rule changes, anomalies |
| `JurisdictionMetrics` | State/county volatility scores |
| `EmployeeIntegrityScore` | Employee performance/integrity scores |
| `CaseHeatmapEntry` | Case priority heat scores |
| `FounderFocusItem` | Priority items for founder attention |
| `OpsInsight` | Bot-generated insights |
| `FounderConfig` | Tunable thresholds/settings (Phase 5) |
| `BotRunLog` | Bot execution logs (Phase 5) |

### System Models
| Model | Purpose |
|-------|---------|
| `AuditLog` | All user actions logged |
| `SystemConfig` | General system settings |
| `SystemError` | Error tracking (no Sentry) |
| `NotificationLog` | Email/SMS/push logs |

---

# PART 3: ALL BACKEND FILES

## Directory Structure

```
backend/src/
├── cron/
│   └── scheduler.ts          ✅ SKELETON (Phase 7)
├── bots/
│   ├── ingestionBot.ts      ✅ COMPLETE
│   ├── payoutBot.ts         ✅ COMPLETE
│   ├── complianceBot.ts     ✅ COMPLETE
│   ├── outreachBot.ts       ✅ COMPLETE
│   ├── docketBot.ts         ✅ COMPLETE
│   ├── coordinatorBot.ts    ✅ COMPLETE
│   └── trainingBot.ts       ✅ COMPLETE (Phase 5 Enhanced)
├── config/
│   └── env.ts               ✅ COMPLETE
├── data/
│   ├── stateRules.ts        ✅ COMPLETE
│   └── documentTemplates.ts ✅ COMPLETE
├── middleware/
│   ├── authMiddleware.ts    ✅ COMPLETE
│   ├── auditLogger.ts       ✅ COMPLETE
│   ├── errorHandler.ts      ✅ COMPLETE
│   ├── rateLimit.ts         ✅ COMPLETE
│   └── roleGuard.ts         ✅ COMPLETE
├── models/
│   ├── User.ts              ✅ COMPLETE
│   ├── Role.ts              ✅ COMPLETE
│   ├── Case.ts              ✅ COMPLETE
│   ├── LedgerEntry.ts       ✅ COMPLETE
│   └── CommissionPlan.ts    ✅ COMPLETE
├── parsers/
│   ├── probateCsvParser.ts  ✅ COMPLETE
│   ├── taxSaleCsvParser.ts  ✅ COMPLETE
│   └── surplusPdfParser.ts  ✅ COMPLETE
├── routes/
│   ├── auth.ts              ✅ COMPLETE
│   ├── cases.ts             ✅ COMPLETE
│   ├── clients.ts           ✅ COMPLETE
│   ├── documents.ts         ✅ COMPLETE
│   ├── employees.ts         ✅ COMPLETE
│   ├── ingestion.ts         ✅ COMPLETE
│   ├── legal.ts             ✅ COMPLETE
│   ├── payouts.ts           ✅ COMPLETE
│   ├── settings.ts          ✅ COMPLETE
│   ├── training.ts          ✅ COMPLETE
│   ├── opsMetrics.ts        ✅ COMPLETE
│   ├── opsWatch.ts          ✅ COMPLETE
│   ├── hrRoutes.ts          ✅ COMPLETE
│   ├── hrTrainingRoutes.ts  ✅ COMPLETE (Phase 5)
│   └── complianceRoutes.ts  ✅ COMPLETE
├── services/
│   ├── bankingService.ts             ✅ COMPLETE
│   ├── caseService.ts                ✅ COMPLETE
│   ├── clientService.ts              ✅ COMPLETE
│   ├── commissionService.ts          ✅ COMPLETE
│   ├── documentVaultService.ts       ✅ COMPLETE
│   ├── employeeService.ts            ✅ COMPLETE
│   ├── ingestionService.ts           ✅ COMPLETE
│   ├── legalService.ts               ✅ COMPLETE
│   ├── notificationService.ts        ✅ COMPLETE
│   ├── opsMetricsService.ts          ✅ COMPLETE
│   ├── payoutService.ts              ✅ COMPLETE
│   ├── scraperService.ts             ✅ COMPLETE
│   ├── trainingService.ts            ✅ COMPLETE
│   ├── watchService.ts               ✅ COMPLETE
│   ├── parserService.ts              ✅ COMPLETE
│   ├── TrainingIntelligenceService.ts ✅ COMPLETE (Phase 5)
│   ├── IngestionIntelligenceService.ts ✅ COMPLETE (Phase 6)
│   ├── BackupService.ts              ✅ SKELETON (Phase 7)
│   └── ReportingService.ts           ✅ SKELETON (Phase 7)
├── types/
│   ├── trainingTypes.ts     ✅ COMPLETE (Phase 5)
│   └── ingestionTypes.ts    ✅ COMPLETE (Phase 6)
├── utils/
│   ├── caseLifecycle.ts     ✅ COMPLETE
│   ├── documentLifecycle.ts ✅ COMPLETE
│   ├── fieldMasking.ts      ✅ COMPLETE
│   └── security.ts          ✅ COMPLETE
└── server.ts                ✅ COMPLETE
```

---

# PART 4: ALL 7 BOTS — DETAILED BREAKDOWN

## 1. IngestionBot (`ingestionBot.ts`)
**Purpose:** Analyzes ingestion batches, flags suspicious patterns, suggests high-value cases
**Triggers:** After batch processing, periodic analysis
**Outputs:** `OpsInsight` (type: INGESTION_ANALYSIS)
**Key Methods:**
- `analyze(days: number)` — Full analysis over period
- `checkRecentBatch(batchId)` — Quick batch quality check
- Pattern detection: high error rates, high-value clusters, duplicate addresses

## 2. PayoutBot (`payoutBot.ts`)
**Purpose:** Analyzes payouts, detects anomalies, monitors employee commissions
**Triggers:** After payouts, periodic review
**Outputs:** `OpsInsight` (type: PAYOUT_ANALYSIS), `WatchAlert` (type: PAYOUT_ANOMALY)
**Key Methods:**
- `analyze()` — Full payout analysis
- Detects: unusual payout amounts, commission rate anomalies, timing patterns

## 3. ComplianceBot (`complianceBot.ts`)
**Purpose:** Scans for deadline risks, missing documents, invalid status transitions
**Triggers:** Daily compliance scan
**Outputs:** `OpsInsight` (type: COMPLIANCE_CHECK)
**Key Methods:**
- `scan()` — Full compliance scan
- Deadline scanning (filing, redemption deadlines)
- Document requirement checking by status
- Stale case detection
- Jurisdiction volatility alerts

## 4. OutreachBot (`outreachBot.ts`)
**Purpose:** Recommends outreach actions, tracks communication effectiveness
**Triggers:** Case status changes, periodic review
**Outputs:** `OpsInsight` (type: CASE_RECOMMENDATION)
**Key Methods:**
- `analyzeOutreachNeeds()` — Identify cases needing contact
- `generateOutreachPlan(caseId)` — Create communication plan
- Tracks: response rates, optimal contact times, script effectiveness

## 5. DocketBot (`docketBot.ts`)
**Purpose:** Monitors court filings, deadline tracking, jurisdiction rule changes
**Triggers:** Scraped item detection, daily review
**Outputs:** `WatchAlert` (type: RULE_CHANGE_DETECTED, DEADLINE_PATTERN_CHANGE)
**Key Methods:**
- `scanJurisdictionChanges()` — Detect rule updates
- `checkCaseDeadlines()` — Monitor all active deadlines
- Integrates with: StateRule, CountyRule, ScrapedItem

## 6. CoordinatorBot (`coordinatorBot.ts`)
**Purpose:** Orchestrates all bots, generates daily summaries, prioritizes founder focus
**Triggers:** Scheduled (hourly/daily)
**Outputs:** `OpsInsight` (type: COORDINATOR_SUMMARY), `FounderFocusItem`
**Key Methods:**
- `runDailySummary()` — Aggregate all bot insights
- `generateFounderBrief()` — Plain English summary
- `prioritizeFocusItems()` — Rank what needs attention
- Integrates with: FounderConfig for thresholds

## 7. TrainingBot (`trainingBot.ts`) — PHASE 5 ENHANCED
**Purpose:** Full training intelligence layer with personalized recommendations
**Triggers:** Hourly analysis, on-demand checks
**Outputs:** `OpsInsight` (type: TRAINING_ANALYSIS), `TrainingRecommendation`, `DynamicTrainingModule`, `TierProgressionLog`
**Key Methods:**
- `analyze()` — Full training intelligence analysis
- `checkEmployee(employeeId)` — Quick status check
- `checkTierEligibility(employeeId)` — Tier progression evaluation
- `getDashboard()` — HR Panel data
- Dynamic module generation from OpsInsight/ScrapedItem
- Pattern detection: high failure modules, skill gap clusters, tier bottlenecks

---

# PART 5: ALL API ROUTES

## Authentication Routes (`/api/auth`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/login` | User login (rate limited) |
| POST | `/logout` | Session termination |
| POST | `/register` | New user registration |
| POST | `/request-password-reset` | Password reset (rate limited) |
| POST | `/reset-password` | Complete password reset |
| GET | `/me` | Current user info |

## Case Routes (`/api/cases`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List cases (role-filtered) |
| GET | `/:id` | Single case details |
| POST | `/` | Create case |
| PATCH | `/:id` | Update case |
| PATCH | `/:id/status` | Update case status |
| POST | `/:id/assign` | Assign employee |
| GET | `/:id/timeline` | Case activity timeline |

## Document Routes (`/api/documents`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/case/:caseId` | List case documents |
| POST | `/upload` | Upload document |
| GET | `/:id/download` | Download document |
| POST | `/:id/sign` | Mark as signed |
| DELETE | `/:id` | Delete document |

## Employee Routes (`/api/employees`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List employees |
| GET | `/:id` | Employee details |
| GET | `/:id/cases` | Employee's cases |
| GET | `/:id/performance` | Performance metrics |
| PATCH | `/:id/tier` | Update tier |

## Client Routes (`/api/clients`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/portal/:token` | Public case lookup |
| GET | `/:id` | Client details |
| GET | `/:id/cases` | Client's cases |

## Payout Routes (`/api/payouts`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List ledger entries |
| GET | `/pending` | Pending payouts |
| POST | `/process` | Process payout |
| GET | `/employee/:id` | Employee earnings |

## Legal Routes (`/api/legal`) — FOUNDER ONLY
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/state-rules` | All state rules |
| GET | `/state-rules/:code` | Single state rule |
| PUT | `/state-rules/:code` | Update state rule |
| GET | `/county-rules/:state` | County rules for state |

## Ingestion Routes (`/api/ingestion`) — FOUNDER ONLY
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/sources` | List ingestion sources |
| POST | `/sources` | Create source |
| POST | `/upload` | Upload batch file |
| GET | `/batches` | List batches |
| GET | `/batches/:id` | Batch details |
| POST | `/batches/:id/process` | Process batch |

## Training Routes (`/api/training`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Available modules (employee) |
| GET | `/modules` | All modules (admin) |
| GET | `/modules/:id` | Module details |
| GET | `/progress` | Employee progress |
| POST | `/:moduleId/quiz` | Submit quiz |
| GET | `/stats` | Training statistics |

## OPS Metrics Routes (`/api/ops/metrics`) — FOUNDER ONLY
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Full OPS dashboard |
| GET | `/jurisdiction/:state` | Jurisdiction metrics |
| GET | `/employees/integrity` | Employee integrity scores |
| GET | `/cases/heatmap` | Case heatmap data |
| GET | `/focus-items` | Founder focus items |

## OPS Watch Routes (`/api/ops/watch`) — FOUNDER ONLY
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/alerts` | All watch alerts |
| GET | `/alerts/:id` | Alert details |
| POST | `/alerts/:id/resolve` | Resolve alert |
| GET | `/scraped` | Scraped items |
| POST | `/scraped/:id/review` | Review scraped item |

## HR Routes (`/api/hr`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | HR dashboard data |
| GET | `/employees` | Employee list |
| PATCH | `/employees/:id/status` | Update status |
| PATCH | `/employees/:id/tier` | Update tier |
| GET | `/onboarding` | Onboarding candidates |
| POST | `/onboarding/:id/approve` | Approve candidate |
| GET | `/performance` | Performance metrics |
| GET | `/teams` | Team overview |

## HR Training Routes (`/api/hr/training`) — PHASE 5
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Training intelligence dashboard |
| POST | `/analyze` | Run TrainingBot analysis |
| GET | `/employees` | Employee training statuses |
| GET | `/employees/:id/needs` | Individual training needs |
| GET | `/employees/:id/metrics` | Full contractor metrics |
| GET | `/employees/:id/check` | Quick training check |
| GET | `/tier-progressions` | Pending tier advancements |
| POST | `/tier-progressions/:id/approve` | Approve promotion |
| POST | `/tier-progressions/:id/deny` | Deny promotion |
| GET | `/recommendations` | Pending recommendations |
| POST | `/recommendations/:id/assign` | Assign training |
| POST | `/recommendations/:id/dismiss` | Dismiss recommendation |
| GET | `/dynamic-modules` | Auto-generated modules |
| GET | `/dynamic-modules/:id` | Dynamic module details |
| PATCH | `/dynamic-modules/:id` | Update dynamic module |
| GET | `/modules/stats` | Module statistics |
| GET | `/config` | Training config (FOUNDER) |
| PATCH | `/config` | Update training config |
| GET | `/alerts` | Training alerts |
| POST | `/employees/:id/remind` | Send reminder |

## Compliance Routes (`/api/compliance`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Compliance dashboard |
| GET | `/cases/risk` | At-risk cases |
| GET | `/deadlines` | Upcoming deadlines |
| GET | `/violations` | Compliance violations |

---

# PART 6: PHASE 5 IMPLEMENTATION DETAILS

## What Was Built

### 1. Training Types (`backend/src/types/trainingTypes.ts`)
Complete type definitions for the training intelligence layer:
- `ContractorMetrics` — All employee performance data
- `ContractorTrainingNeeds` — Personalized analysis results
- `SkillGap`, `ModuleRecommendation` — Gap analysis types
- `DynamicModuleSpec`, `DynamicModuleContent` — Auto-generated module types
- `TierProgressionRequirements`, `TierProgressionEvaluation` — Tier advancement types
- `TrainingConfigSettings`, `DEFAULT_TRAINING_CONFIG` — Founder config
- `TrainingDashboardData`, `TrainingAlert` — HR Panel types

### 2. Training Intelligence Service (`backend/src/services/TrainingIntelligenceService.ts`)
Core methods:
- `getContractorMetrics(employeeId)` — Full metrics aggregation
- `analyzeContractorNeeds(employeeId)` — Skill gap analysis + recommendations
- `generateDynamicModule(source)` — Create module from OpsInsight/ScrapedItem
- `saveDynamicModule(spec)` — Persist to database
- `evaluateTierProgression(employeeId)` — Tier advancement evaluation
- `saveTierProgressionLog(evaluation)` — Persist evaluation
- `getTrainingDashboardData()` — HR Panel data
- `analyzeAllContractors()` — Bulk analysis
- `evaluateAllTierProgressions()` — Bulk tier checks
- `loadConfig()`, `saveConfig()`, `getConfig()` — FounderConfig integration

### 3. Enhanced TrainingBot (`backend/src/bots/trainingBot.ts`)
Enhanced capabilities:
- Full intelligence analysis with all contractors
- Dynamic module generation from insights
- Training-performance correlation analysis
- Pattern detection (high failure modules, skill gaps, tier bottlenecks)
- BotRunLog integration
- Plain English report generation

### 4. HR Training Routes (`backend/src/routes/hrTrainingRoutes.ts`)
Complete API for HR Panel training management.

### 5. New Database Models
- `TrainingRecommendation` — Personalized recommendations
- `DynamicTrainingModule` — Auto-generated modules
- `TierProgressionLog` — Tier advancement tracking
- `FounderConfig` — Tunable settings
- `BotRunLog` — Bot execution logs

### 6. Schema Updates
- `TrainingModule` — Added sourceType, sourceId, targetStates, isMandatory, isCertification, expiresAt
- `EmployeeTrainingProgress` — Added deadline, assignedBy, priority, isMandatory

---

# PART 7: SHADOW ACCOUNTING DETAILS

## How It Works

1. **CommissionPlan** stores two rates:
   - `displayedRatePercent`: What employee sees (20, 40, 60, 80, 100)
   - `actualRatePercent`: What they actually get (10, 20, 30, 40, 50)

2. **LedgerEntry** has shadow fields:
   - `amountCents`: Actual amount
   - `displayedAmountCents`: What employee sees
   - `displayedRate`: Rate employee thinks they got
   - `actualRate`: Real rate

3. **TierProgressionEvaluation** has:
   - `actualRevenueCents`: Real revenue (FOUNDER ONLY)
   - `displayedRevenueCents`: Inflated value shown

4. **API routes filter** shadow fields based on role:
   - FOUNDER sees all values
   - Employees see only displayed values
   - Clients see no financial data

---

# PART 8: WHAT'S STILL NEEDED / PENDING

## Phase 6: Ingestion Intelligence Expansion (COMPLETE)

### What Was Implemented

**Files Created:**
- `backend/src/types/ingestionTypes.ts` — 250+ lines of type definitions
- `backend/src/services/IngestionIntelligenceService.ts` — 600+ lines core service

**Files Updated:**
- `backend/src/routes/ingestion.ts` — 20+ new intelligence endpoints
- `backend/src/bots/ingestionBot.ts` — Complete rewrite with intelligence

### New API Endpoints (/api/ingestion/intelligence/)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/config` | GET/PATCH | FounderConfig management |
| `/failed-analysis` | GET | Analyze failed records |
| `/parser-suggestions` | GET | Get parser suggestions |
| `/parser-suggestions/:id/generate` | POST | Generate from cluster |
| `/parser-suggestions/:id/apply` | POST | Apply suggestion |
| `/jurisdiction-metrics` | GET | Success rates by state/county |
| `/predict-value` | POST | Predict single value |
| `/predict-batch` | POST | Predict batch values |
| `/auto-file-candidates` | GET | Get eligible records |
| `/auto-file/:id/evaluate` | POST | Evaluate record |
| `/auto-file/:id/approve` | POST | Approve and create case |
| `/auto-file/:id/reject` | POST | Reject candidate |
| `/auto-file/process-batch` | POST | Process all eligible |
| `/duplicates/:id` | GET | Find duplicates |
| `/duplicates/batch/:id` | POST | Detect batch duplicates |

### IngestionIntelligenceService Methods

```typescript
// Config
getConfig(), updateConfig()

// Parser Suggestions
analyzeFailedRecords(), generateParserSuggestion()
getParserSuggestions(), applyParserSuggestion()

// Value Prediction
predictValue(), predictBatchValues()

// Jurisdiction Intelligence
getJurisdictionMetrics(), getAllJurisdictionMetrics()

// Auto-Filing
evaluateAutoFileCandidate(), getAutoFileCandidates()
approveAutoFile(), rejectAutoFile(), processAutoFileBatch()

// Batch Intelligence
runIntelligentProcess()

// Duplicates
findDuplicates(), detectBatchDuplicates()
```

### FounderConfig Keys Added

```typescript
autoFileHighValueThreshold: 1000000  // $10,000
autoFileMinSuccessRate: 70
autoFileEnabled: false  // FOUNDER must enable
duplicateCheckEnabled: true
duplicateSimilarityThreshold: 85
parserRetryAttempts: 3
priorityValueWeight: 0.5
prioritySuccessRateWeight: 0.3
priorityVolatilityPenalty: 0.2
highValueThreshold: 500000
lowSuccessRateThreshold: 40
```

### Enhanced IngestionBot

- `runIntelligenceAnalysis()` — Run predictions, auto-file, duplicates
- `generateTrainingModuleFromPattern()` — Create DynamicTrainingModule from errors
- `processIntelligentBatch()` — Run intelligence on batch
- `runAutoFileBatch()` — Process eligible auto-files
- New pattern types: jurisdiction_issue, auto_file_opportunity

## Phase 7: Final System Hardening, QA, and Sovereign Ops Playbook (SKELETONS CREATED)

### Goal
Production hardening for sovereign, air-gapped operation.

### Skeleton Files Created

**1. `backend/src/cron/scheduler.ts`** — Cron job scheduler
- 15+ pre-configured schedules for bots, backups, reports
- Bot schedules: coordinator (daily 6AM), ingestion (6h), payout (daily 7AM), compliance (daily 5AM), training (weekly Monday 4AM), outreach (weekdays 9AM), docket (daily 6AM)
- Backup schedules: hourly, daily (2AM), weekly (Sunday 3AM)
- Report schedules: daily digest (weekdays 7AM), weekly summary (Monday 8AM), monthly metrics (1st 9AM)
- Maintenance: cleanup expired insights (daily 3AM), old bot logs (Sunday 4AM)
- Dynamic config loading from FounderConfig
- BotRunLog + OpsInsight integration for job tracking

**2. `backend/src/services/BackupService.ts`** — Sovereign backup infrastructure
- Backup tiers: hourly (24 retained), daily (7 days), weekly (4 weeks), monthly (12 months)
- `runHourlyBackup()`, `runDailyBackup()`, `runWeeklyBackup()`, `runMonthlyBackup()`
- Database backup via pg_dump (TODO: implement actual command)
- Document vault backup via tar
- GPG encryption support
- Offsite copy support (rsync/s3 ready)
- Backup verification with SHA-256 checksums
- Manifest tracking
- `restoreDatabase()` method
- OpsInsight notification for monthly archives

**3. `backend/src/services/ReportingService.ts`** — Report generation for FOUNDER
- `generateDailyDigest()` — Cases, payouts, revenue, alerts, recommendations
- `generateWeeklySummary()` — Cases by status, top employees, jurisdictions
- `generateMonthlyMetrics()` — Financial/operations/growth/trends report
- `exportCases()` — CSV/Excel export with configurable fields
- `exportLedger()` — Financial ledger export
- `exportEmployeeMetrics()` — Employee performance export
- `exportAuditLogs()` — Compliance audit export

### New Database Models (Phase 6)

**ParserVersion** — DB-driven parser versioning
```prisma
model ParserVersion {
  id                Int                 @id @default(autoincrement())
  sourceType        IngestionSourceType
  version           String              // "1.0", "2026-03-tax-sale-v2"
  stateCode         String?             // null = national/generic
  countyFips        String?
  parserConfig      Json                // { headerRow, columns[], dateFormat }
  successRate       Float?              @default(0)
  recordsProcessed  Int                 @default(0)
  recordsFailed     Int                 @default(0)
  isActive          Boolean             @default(true)
  notes             String?             @db.Text
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

**PropertyClass** — Value prediction accuracy
```prisma
model PropertyClass {
  id                      Int       @id @default(autoincrement())
  code                    String    @unique  // "RESIDENTIAL", "COMMERCIAL"
  description             String?
  defaultMinValueCents    Int?      @default(50000)      // $500
  defaultMedianValueCents Int?      @default(500000)     // $5,000
  defaultMaxValueCents    Int?      @default(10000000)   // $100,000
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}
```

**Enhanced IngestionRecord** — New fields for intelligence
```prisma
normalizedData          Json?     // Standardized JSON after parsing
contentHash             String?   // SHA256 for duplicate detection
rawPayload              Json?     // Original raw data
predictedValueCents     Int?      // AI-predicted value
predictionConfidence    Float?    // 0-100 confidence score
propertyClassCode       String?   // Link to PropertyClass
errorDetails            Json?     // Structured error JSON
```

**Enhanced IngestionBatch** — Batch statistics
```prisma
recordCount     Int?  @default(0)
successCount    Int?  @default(0)
errorCount      Int?  @default(0)
highValueCount  Int?  @default(0)
duplicateCount  Int?  @default(0)
```

### Components Remaining
1. **Security Audit**
   - Air-gap testing
   - Encryption at rest
   - JWT hardening
   - Rate limit tuning

2. **Full E2E QA Suite**
   - All API endpoints tested
   - Bot integration tests
   - Shadow accounting validation
   - Role-based access tests

3. **Performance Optimization**
   - Database query optimization
   - Caching layer (Redis optional)
   - Batch processing optimization

4. **Sovereign Ops Playbook**
   - PDF manual for founder
   - Deployment scripts
   - Backup/DR procedures
   - Bot scheduling guide
   - Troubleshooting guide

5. **Deployment Scripts**
   - Docker compose production
   - Database migration scripts
   - Environment variable templates
   - SSL certificate setup

---

# PART 9: POTENTIAL GAPS / MISSING PIECES

## Items Grok Should Review and Suggest

### 1. Frontend — LARGELY MISSING
The frontend (`frontend/src/app/`) appears incomplete. Need:
- Complete dashboard pages for all roles
- Case management UI
- Document upload/viewer
- Training module player
- HR Panel pages
- Founder OPS console
- Client portal

### 2. PDF Generation Service
Phase 3 mentioned PdfEngineService but file doesn't exist. Need:
- `backend/src/services/PdfEngineService.ts`
- Engagement letter generation
- Authority form generation
- Filing packet generation

### 3. Notification Template Service
Phase 3 mentioned NotificationTemplateService. Need verification if complete.

### 4. Cron Job Scheduling — SKELETON CREATED
Bots are designed to run on schedules:
- `backend/src/cron/scheduler.ts` ✅ SKELETON EXISTS
- Bot scheduling configuration ✅ 15+ schedules defined
- Error handling for failed runs ✅ BotRunLog + OpsInsight integration
- **TODO:** Install node-cron, enable in production

### 5. Email/SMS Integration
NotificationService exists but may need:
- Actual email provider integration (SendGrid, SES)
- SMS provider integration (Twilio)
- Webhook handlers for delivery status

### 6. File Storage
DocumentVaultService exists but verify:
- Local storage implementation
- Backup procedures
- File encryption at rest

### 7. Client Portal
Public-facing client portal needs:
- Case status lookup
- Document download
- Communication history
- Secure authentication (magic link?)

### 8. Reporting Engine — SKELETON CREATED
Reporting service skeleton exists:
- `backend/src/services/ReportingService.ts` ✅ SKELETON EXISTS
- CSV/Excel exports ✅ Methods defined
- Scheduled reports ✅ Integrated with scheduler
- Founder daily digest ✅ generateDailyDigest() method
- **TODO:** Install exceljs, implement actual file generation

### 9. Webhook System
For external integrations:
- Incoming webhooks (email delivery, payment)
- Outgoing webhooks (case updates)

### 10. Data Backup Service — SKELETON CREATED
Critical for sovereign operation:
- `backend/src/services/BackupService.ts` ✅ SKELETON EXISTS
- Automated database backups ✅ pg_dump methods defined
- Point-in-time recovery ✅ restoreDatabase() method
- Backup verification ✅ SHA-256 checksum verification
- **TODO:** Implement actual pg_dump/tar commands, configure retention

### 11. Search Service
No full-text search implementation:
- Case search across all fields
- Client lookup
- Document content search

### 12. Metrics Dashboard Backend
OpsMetricsService exists but may need:
- Historical trend data
- Aggregation caching
- Chart data formatting

---

# PART 10: CONFIGURATION AND SETTINGS

## FounderConfig Keys (from Phase 5)

```typescript
// Training settings (training.settings)
{
  autoGenerateModulesFromInsights: boolean,
  insightTypesForModules: string[],
  moduleExpirationDays: number,
  autoTierProgression: boolean,
  tierProgressionReviewRequired: boolean,
  minDaysBetweenPromotions: number,
  lowConversionThreshold: number,
  coachingTriggerDays: number,
  mandatoryTrainingDeadlineDays: number,
  sendTrainingReminders: boolean,
  reminderFrequencyDays: number,
  notifyHROnOverdue: boolean,
  notifyHROverdueDays: number,
  quizPassingScore: number,
  maxQuizAttempts: number
}
```

## Suggested Additional FounderConfig Keys

```typescript
// OPS metrics thresholds
"ops.jurisdictionVolatilityThreshold": number
"ops.employeeIntegrityThreshold": number
"ops.caseHeatScoreThreshold": number

// Ingestion settings (for Phase 6)
"ingestion.autoFileHighValueThreshold": number // cents
"ingestion.duplicateCheckEnabled": boolean
"ingestion.parserRetryAttempts": number

// Compliance settings
"compliance.deadlineWarningDays": number
"compliance.staleStatusDays": Record<CaseStatus, number>

// Notification settings
"notifications.emailEnabled": boolean
"notifications.smsEnabled": boolean
"notifications.batchSize": number

// System settings
"system.maintenanceMode": boolean
"system.auditRetentionDays": number
"system.sessionTimeoutMinutes": number
```

---

# PART 11: ROLE PERMISSIONS MATRIX

| Action | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|--------|---------|-------|-----|------------|-----------|----------|--------|
| View all cases | ✅ | ✅ | ❌ | ✅ | Team only | Own only | Own only |
| View financials | ✅ | ✅ | ❌ | ❌ | Shadow only | Shadow only | ❌ |
| Edit state rules | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View OPS metrics | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View watch alerts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage employees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve tier progression | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View training dashboard | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Complete training | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ingest data | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Process payouts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

# PART 12: GROK ACTION ITEMS

Please review this entire context and provide:

1. **Validation** — Confirm the architecture is sound for a sovereign surplus recovery platform

2. **Gap Analysis** — Identify any missing components critical for production

3. **Priority Ranking** — Rank the pending items by importance

4. **Implementation Suggestions** — For any gaps, suggest implementation approach

5. **Security Review** — Any security concerns with the current architecture

6. **Phase 6 Detailed Spec** — Flesh out the Ingestion Intelligence Expansion

7. **Phase 7 Checklist** — Complete checklist for system hardening

8. **Additional Phases** — Suggest any Phase 8+ that might be needed

9. **Frontend Architecture** — Recommend structure for the missing frontend

10. **Deployment Strategy** — Recommend approach for sovereign deployment

---

# END OF CONTEXT DOCUMENT

This document was auto-generated from the actual codebase. All models, routes, and services listed exist and are implemented unless marked as "PENDING" or "CREATE".

For questions or clarifications, this context should provide complete visibility into the MGR Capital Assistance platform state as of Phase 5 completion.
