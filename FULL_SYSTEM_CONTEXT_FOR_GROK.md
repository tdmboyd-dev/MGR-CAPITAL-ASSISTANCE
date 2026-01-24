# MGR CAPITAL ASSISTANCE — COMPLETE SYSTEM CONTEXT
## For Grok AI to Review, Validate, and Suggest Additional Implementations

**Generated:** 2026-01-22
**Updated:** 2026-01-24
**Current Phase:** Phase 20 COMPLETE — 100% Platform Completion + Global Search & Dashboard Customization

---

# PART 1: PLATFORM OVERVIEW

## What Is MGR Capital Assistance?

A **sovereign, self-hosted surplus and tax sale recovery platform** that:
1. Ingests county tax sale lists and surplus fund data
2. Creates cases for property owners owed money
3. Manages the full claims lifecycle (outreach → docs → filing → payout)
4. Handles employee/contractor commissions with **shadow accounting**
5. Provides founder-only OPS intelligence layer
6. AI-powered multi-turn agents for case assistance
7. Global search across all entities
8. Customizable dashboards with drag-and-drop widgets

## Core Architecture Principles

- **TypeScript/Node.js backend** with Express
- **Next.js 14 frontend** with React 18
- **PostgreSQL** via Prisma ORM (hosted on Neon)
- **Redis** for caching and AI session persistence
- **Ollama** for local AI inference
- **No external dependencies** for core logic (no Sentry, no analytics services)
- **Shadow accounting**: Employees see inflated commission rates (20/40/60/80/100%) but actually receive (10/20/30/40/50%)
- **Role-based access**: FOUNDER sees everything, employees/clients see filtered data
- **Bot-driven intelligence**: 7+ internal bots analyze data and generate insights
- **PWA-ready**: Service worker, offline support, installable

---

# PART 2: COMPLETE DATABASE SCHEMA

## All Enums (35+ total)

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
enum NotificationPriority { URGENT, HIGH, NORMAL }
enum NotificationCategory { GENERAL, COMPLIANCE, DEADLINE, SYSTEM }

// FEEDBACK
enum FeedbackCategory { GENERAL, AI_RESPONSE, FEATURE, UI_UX, BUG, PERFORMANCE, TRAINING, DOCUMENT }
```

## All Models (45+ total)

### Core Business Models
| Model | Purpose |
|-------|---------|
| `User` | All users (founder, employees, clients) with role-based fields |
| `UserSession` | JWT session tracking |
| `RefreshToken` | Refresh token storage for rotation |
| `ResetToken` | Password reset tokens |
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
| `TrainingRecommendation` | Personalized recommendations |
| `DynamicTrainingModule` | Auto-generated modules from insights |
| `TierProgressionLog` | Tier advancement evaluations |
| `TrainingModuleDetail` | Detailed content for AI generation |
| `TrainingAssetPlan` | Asset production plans |

### Ingestion Models
| Model | Purpose |
|-------|---------|
| `IngestionSource` | Data source configurations |
| `IngestionBatch` | Processing batches with statistics |
| `IngestionRecord` | Individual records with parsing status |
| `ParserVersion` | DB-driven parser versioning per jurisdiction |
| `PropertyClass` | Property classification for prediction accuracy |

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
| `FounderConfig` | Tunable thresholds/settings |
| `BotRunLog` | Bot execution logs |

### Communication & Notification Models
| Model | Purpose |
|-------|---------|
| `ChatRoom` | Internal team chat rooms |
| `ChatMessage` | Chat messages with user references |
| `Notification` | User notifications with priority/category |
| `Feedback` | User feedback with ratings and categories |

### System Models
| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant support |
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
│   └── scheduler.ts          ✅ COMPLETE
├── bots/
│   ├── ingestionBot.ts       ✅ COMPLETE
│   ├── payoutBot.ts          ✅ COMPLETE
│   ├── complianceBot.ts      ✅ COMPLETE
│   ├── outreachBot.ts        ✅ COMPLETE
│   ├── docketBot.ts          ✅ COMPLETE
│   ├── coordinatorBot.ts     ✅ COMPLETE
│   ├── trainingBot.ts        ✅ COMPLETE
│   └── metaBot.ts            ✅ COMPLETE (Feedback Analysis)
├── config/
│   ├── env.ts                ✅ COMPLETE
│   └── prisma.ts             ✅ COMPLETE
├── data/
│   ├── stateRules.ts         ✅ COMPLETE
│   └── documentTemplates.ts  ✅ COMPLETE
├── middleware/
│   ├── authMiddleware.ts     ✅ COMPLETE
│   ├── auditLogger.ts        ✅ COMPLETE
│   ├── errorHandler.ts       ✅ COMPLETE
│   ├── rateLimit.ts          ✅ COMPLETE
│   └── roleGuard.ts          ✅ COMPLETE
├── models/
│   ├── User.ts               ✅ COMPLETE
│   ├── Role.ts               ✅ COMPLETE
│   ├── Case.ts               ✅ COMPLETE
│   ├── LedgerEntry.ts        ✅ COMPLETE
│   └── CommissionPlan.ts     ✅ COMPLETE
├── parsers/
│   ├── probateCsvParser.ts   ✅ COMPLETE
│   ├── taxSaleCsvParser.ts   ✅ COMPLETE
│   └── surplusPdfParser.ts   ✅ COMPLETE
├── routes/
│   ├── auth.ts               ✅ COMPLETE
│   ├── cases.ts              ✅ COMPLETE
│   ├── clients.ts            ✅ COMPLETE
│   ├── documents.ts          ✅ COMPLETE
│   ├── employees.ts          ✅ COMPLETE
│   ├── ingestion.ts          ✅ COMPLETE
│   ├── legal.ts              ✅ COMPLETE
│   ├── payouts.ts            ✅ COMPLETE
│   ├── settings.ts           ✅ COMPLETE
│   ├── training.ts           ✅ COMPLETE
│   ├── opsMetrics.ts         ✅ COMPLETE
│   ├── opsWatch.ts           ✅ COMPLETE
│   ├── hrRoutes.ts           ✅ COMPLETE
│   ├── hrTrainingRoutes.ts   ✅ COMPLETE
│   ├── complianceRoutes.ts   ✅ COMPLETE
│   ├── comms.ts              ✅ COMPLETE
│   ├── analytics.ts          ✅ COMPLETE
│   ├── aiRoutes.ts           ✅ COMPLETE (Multi-Turn AI Agent)
│   ├── notificationRoutes.ts ✅ COMPLETE
│   ├── feedbackRoutes.ts     ✅ COMPLETE
│   └── searchRoutes.ts       ✅ COMPLETE (Phase 20)
├── services/
│   ├── bankingService.ts              ✅ COMPLETE
│   ├── caseService.ts                 ✅ COMPLETE
│   ├── clientService.ts               ✅ COMPLETE
│   ├── commissionService.ts           ✅ COMPLETE
│   ├── documentVaultService.ts        ✅ COMPLETE
│   ├── employeeService.ts             ✅ COMPLETE
│   ├── ingestionService.ts            ✅ COMPLETE
│   ├── legalService.ts                ✅ COMPLETE
│   ├── notificationService.ts         ✅ COMPLETE
│   ├── opsMetricsService.ts           ✅ COMPLETE
│   ├── payoutService.ts               ✅ COMPLETE
│   ├── scraperService.ts              ✅ COMPLETE
│   ├── trainingService.ts             ✅ COMPLETE
│   ├── watchService.ts                ✅ COMPLETE
│   ├── parserService.ts               ✅ COMPLETE
│   ├── TrainingIntelligenceService.ts ✅ COMPLETE
│   ├── IngestionIntelligenceService.ts ✅ COMPLETE
│   ├── BackupService.ts               ✅ COMPLETE
│   ├── ReportingService.ts            ✅ COMPLETE
│   ├── CacheService.ts                ✅ COMPLETE (Redis)
│   ├── ConfigService.ts               ✅ COMPLETE
│   ├── AiAgentService.ts              ✅ COMPLETE (Ollama Multi-Turn)
│   ├── FeedbackService.ts             ✅ COMPLETE
│   └── GlobalSearchService.ts         ✅ COMPLETE (Phase 20)
├── types/
│   ├── trainingTypes.ts      ✅ COMPLETE
│   └── ingestionTypes.ts     ✅ COMPLETE
├── utils/
│   ├── caseLifecycle.ts      ✅ COMPLETE
│   ├── documentLifecycle.ts  ✅ COMPLETE
│   ├── fieldMasking.ts       ✅ COMPLETE
│   └── security.ts           ✅ COMPLETE
└── server.ts                 ✅ COMPLETE
```

---

# PART 4: ALL 7+ BOTS — DETAILED BREAKDOWN

## 1. IngestionBot (`ingestionBot.ts`)
**Purpose:** Analyzes ingestion batches, flags suspicious patterns, suggests high-value cases
**Triggers:** After batch processing, periodic analysis
**Outputs:** `OpsInsight` (type: INGESTION_ANALYSIS)

## 2. PayoutBot (`payoutBot.ts`)
**Purpose:** Analyzes payouts, detects anomalies, monitors employee commissions
**Triggers:** After payouts, periodic review
**Outputs:** `OpsInsight` (type: PAYOUT_ANALYSIS), `WatchAlert` (type: PAYOUT_ANOMALY)

## 3. ComplianceBot (`complianceBot.ts`)
**Purpose:** Scans for deadline risks, missing documents, invalid status transitions
**Triggers:** Daily compliance scan
**Outputs:** `OpsInsight` (type: COMPLIANCE_CHECK)

## 4. OutreachBot (`outreachBot.ts`)
**Purpose:** Recommends outreach actions, tracks communication effectiveness
**Triggers:** Case status changes, periodic review
**Outputs:** `OpsInsight` (type: CASE_RECOMMENDATION)

## 5. DocketBot (`docketBot.ts`)
**Purpose:** Monitors court filings, deadline tracking, jurisdiction rule changes
**Triggers:** Scraped item detection, daily review
**Outputs:** `WatchAlert` (type: RULE_CHANGE_DETECTED, DEADLINE_PATTERN_CHANGE)

## 6. CoordinatorBot (`coordinatorBot.ts`)
**Purpose:** Orchestrates all bots, generates daily summaries, prioritizes founder focus
**Triggers:** Scheduled (hourly/daily)
**Outputs:** `OpsInsight` (type: COORDINATOR_SUMMARY), `FounderFocusItem`

## 7. TrainingBot (`trainingBot.ts`)
**Purpose:** Full training intelligence layer with personalized recommendations
**Triggers:** Hourly analysis, on-demand checks
**Outputs:** `OpsInsight` (type: TRAINING_ANALYSIS), `TrainingRecommendation`, `DynamicTrainingModule`, `TierProgressionLog`

## 8. MetaBot (`metaBot.ts`)
**Purpose:** Analyzes feedback, runs combined insights, provides founder summaries
**Triggers:** On-demand, scheduled analysis
**Outputs:** `OpsInsight` with feedback trends, combined bot + feedback insights

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
| POST | `/refresh` | Token refresh |

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

## AI Routes (`/api/ai`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/agent` | Execute AI agent task |
| POST | `/agent/continue` | Continue multi-turn conversation |
| GET | `/search` | Semantic AI search |
| GET | `/recommendations` | Personalized recommendations |

## Global Search Routes (`/api/search`) — Phase 20
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/global` | Search all entities (cases, users, docs, comms) |
| GET | `/suggestions` | Real-time search suggestions |
| GET | `/recent` | User's recent searches |
| GET | `/popular` | Popular searches (anonymized) |

## Notification Routes (`/api/notifications`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List notifications |
| GET | `/unread` | Unread count |
| PATCH | `/:id/read` | Mark as read |
| PATCH | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |
| GET | `/preferences` | Get preferences |
| PATCH | `/preferences` | Update preferences |

## Feedback Routes (`/api/feedback`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/submit` | Submit feedback |
| GET | `/my` | User's feedback history |
| GET | `/` | All feedback (FOUNDER/ADMIN) |
| GET | `/stats` | Statistics |
| GET | `/analysis` | Full analysis (FOUNDER) |
| PATCH | `/:id/respond` | Admin response |
| GET | `/categories` | Available categories |

## OPS Routes (`/api/ops/*`) — FOUNDER ONLY
- `/api/ops/metrics/*` — Dashboard, jurisdictions, employees, heatmaps
- `/api/ops/watch/*` — Alerts, scraped items, reviews

## HR Routes (`/api/hr/*`)
- Dashboard, employees, onboarding, performance, teams
- Training intelligence, tier progressions, recommendations

## Analytics Routes (`/api/analytics`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/forecast` | Revenue and case predictions |
| GET | `/dashboard` | Analytics dashboard |

---

# PART 6: FRONTEND ARCHITECTURE

## Directory Structure

```
frontend/
├── app/
│   ├── auth/
│   │   └── login/page.tsx
│   ├── founder/
│   │   ├── dashboard/page.tsx
│   │   ├── ops/
│   │   │   ├── page.tsx (Ops Dashboard)
│   │   │   └── dashboard/page.tsx (Customizable - Phase 20)
│   │   └── config/page.tsx
│   ├── employee/
│   │   └── dashboard/page.tsx
│   ├── client/
│   │   └── portal/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/ (Radix-based components)
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── DashboardLayout.tsx
│   ├── GlobalSearchBar.tsx      ✅ Phase 20
│   ├── CustomizableDashboard.tsx ✅ Phase 20
│   ├── AiSearchBar.tsx
│   ├── NotificationBell.tsx
│   ├── FeedbackButton.tsx
│   ├── ErrorBoundary.tsx
│   ├── OfflineHandler.tsx
│   └── OnboardingTour.tsx
├── hooks/
│   └── useAuth.tsx (Zustand store)
├── lib/
│   ├── api.ts (Axios with refresh)
│   └── utils.ts
├── types/
│   └── index.ts
└── public/
    ├── manifest.json
    ├── service-worker.js
    └── offline.html
```

## Key Frontend Features

### Global Search Bar (Phase 20)
- Real-time suggestions as user types
- Search across cases, users, documents, communications
- Role-based access filtering
- Results modal with type badges and scores
- Keyboard navigation (arrows, enter, escape)

### Customizable Dashboard (Phase 20)
- React-grid-layout for drag-and-drop widgets
- Responsive breakpoints (lg, md, sm)
- Locked/editing mode toggle
- Layout persistence in localStorage per role
- Available widgets:
  - Revenue Forecast
  - Recent Cases
  - Active Alerts
  - Team Overview
  - System Health
  - Bot Status
  - Notifications

### PWA Features
- Service worker with cache-first strategy
- Offline fallback page
- Background sync for forms
- Push notification support
- Installable on mobile/desktop

### Mobile Responsiveness
- Hamburger menu for mobile navigation
- Drawer-style sidebar slide-in
- Touch-friendly targets (min 44x44px)
- Responsive grid layouts

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

3. **API routes filter** shadow fields based on role:
   - FOUNDER sees all values
   - Employees see only displayed values
   - Clients see no financial data

---

# PART 8: TESTING INFRASTRUCTURE

## Unit Tests (Jest)
- Located in `backend/tests/`
- Services: AuthService, CacheService, ConfigService
- Middleware: authMiddleware
- Mocks: Prisma (deep mock), Redis (in-memory)

## Integration Tests (Supertest)
- Located in `backend/tests/integration/`
- Tests for all API endpoints
- Role-based access validation
- Shadow accounting field verification

## E2E Tests (Cypress)
- Located in `backend/cypress/e2e/`
- AI agent multi-turn testing
- Session persistence verification
- Frontend UI interaction tests

## Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

---

# PART 9: DEPLOYMENT

## Docker Compose Stack

```yaml
services:
  db: postgres:15
  redis: redis:alpine
  ollama: ollama/ollama
  backend: ./backend
  frontend: ./frontend
```

## Scripts

- `scripts/deploy.sh deploy` — Full deployment
- `scripts/deploy.sh restore` — Restore from backup
- `scripts/deploy.sh unlock-dev` — Development mode
- `scripts/restore.sh` — Disaster recovery

## Environment Variables

See `.env.template` for all required variables:
- DATABASE_URL, REDIS_URL, OLLAMA_HOST
- JWT_SECRET, COOKIE_SECRET
- GPG_PASSPHRASE (for backups)

---

# PART 10: PHASE STATUS

| Phase | Description | Status |
|-------|-------------|--------|
| 1-4 | Core Platform | ✅ COMPLETE |
| 5 | Training Intelligence | ✅ COMPLETE |
| 6 | Ingestion Intelligence | ✅ COMPLETE |
| 7 | System Hardening | ✅ COMPLETE |
| 8 | Frontend/PWA/Mobile | ✅ COMPLETE |
| 9-13 | Various Enhancements | ✅ COMPLETE |
| 14 | AI Search & Recommendations | ✅ COMPLETE |
| 15 | Multi-Turn AI Agent | ✅ COMPLETE |
| 16 | Notification Center | ✅ COMPLETE |
| 17 | Backup & Recovery | ✅ COMPLETE |
| 18 | User Feedback Loop | ✅ COMPLETE |
| 19 | Integration Testing Suite | ✅ COMPLETE |
| 20 | Global Search & Dashboard Customization | ✅ COMPLETE |

---

# PART 11: PHASE 20 IMPLEMENTATION DETAILS

## Global Search Service (`backend/src/services/GlobalSearchService.ts`)

**~400 lines of production-ready code:**

```typescript
class GlobalSearchService {
  // Main search across all entities
  async globalSearch(options: GlobalSearchOptions): Promise<GlobalSearchResponse>

  // Entity-specific searches with role filtering
  private searchCases(query, userId, userRole, options): Promise<CaseSearchResult[]>
  private searchUsers(query, userRole): Promise<UserSearchResult[]>
  private searchDocuments(query, userId, userRole): Promise<DocumentSearchResult[]>
  private searchCommunications(query, userId, userRole): Promise<CommunicationSearchResult[]>

  // Relevance scoring
  private calculateScore(query, values): number  // 0-100 score
  private findMatchedField(query, fields): string

  // Utilities
  async getRecentSearches(userId): Promise<string[]>
  async getPopularSearches(): Promise<string[]>
}
```

**Search Result Types:**
- `CaseSearchResult`: caseCode, status, ownerName, propertyAddress, surplus
- `UserSearchResult`: email, firstName, lastName, role
- `DocumentSearchResult`: fileName, documentType, caseId
- `CommunicationSearchResult`: subject, preview, direction, caseId

## Search Routes (`backend/src/routes/searchRoutes.ts`)

```
GET /api/search/global?query=...&types=...&limit=...
GET /api/search/suggestions?query=...
GET /api/search/recent
GET /api/search/popular
```

## Global Search Bar (`frontend/components/GlobalSearchBar.tsx`)

**Features:**
- Debounced suggestions (200ms)
- Keyboard navigation (arrows, enter, escape)
- Type badges (case, user, document, communication)
- Relevance scores displayed
- Results modal with breakdown counts
- Click-outside to close

## Customizable Dashboard (`frontend/components/CustomizableDashboard.tsx`)

**Features:**
- React-grid-layout integration
- 7 widget types (revenue, cases, alerts, employees, health, bots, notifications)
- Drag-and-drop (when unlocked)
- Resize handles
- Layout persistence per user role
- Reset to default layout

**Widgets:**
| Widget | Data Source | Size |
|--------|-------------|------|
| Revenue Forecast | /analytics/forecast | 3x2 |
| Recent Cases | /cases?limit=5 | 4x3 |
| Active Alerts | /ops/watch/alerts | 3x3 |
| Team Overview | /employees?limit=5 | 3x3 |
| System Health | /health | 2x2 |
| Bot Status | /ops/metrics/bots | 2x2 |
| Notifications | /notifications?unread=true | 4x3 |

---

# PART 12: ROLE PERMISSIONS MATRIX

| Action | FOUNDER | ADMIN | HR | COMPLIANCE | TEAM_LEAD | EMPLOYEE | CLIENT |
|--------|---------|-------|-----|------------|-----------|----------|--------|
| Global Search | All entities | All entities | Users/Cases | Cases | Team cases | Own cases | Own cases |
| View all cases | ✅ | ✅ | ❌ | ✅ | Team only | Own only | Own only |
| View financials | ✅ | ✅ | ❌ | ❌ | Shadow only | Shadow only | ❌ |
| Customize Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View OPS metrics | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View watch alerts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit feedback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View feedback analysis | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

# END OF CONTEXT DOCUMENT

This document was auto-generated from the actual codebase. All models, routes, and services listed exist and are implemented unless marked as "PENDING" or "CREATE".

**Phase Status:**
- Phases 1-20: ✅ ALL COMPLETE

**Platform Completion: 100%**

**Key Capabilities:**
- Sovereign, self-hosted surplus recovery platform
- AI-powered multi-turn agents (Ollama)
- Global search across all entities
- Customizable drag-and-drop dashboards
- Shadow accounting for employee commissions
- 7+ intelligence bots
- PWA with offline support
- Comprehensive testing suite
- Backup & disaster recovery

For questions or clarifications, this context should provide complete visibility into the MGR Capital Assistance platform state.
