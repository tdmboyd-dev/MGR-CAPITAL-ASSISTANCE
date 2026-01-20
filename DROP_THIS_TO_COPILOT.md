# DROP THIS TO COPILOT — MGR CAPITAL ASSISTANCE

## COMPLETE SYSTEM DOCUMENTATION

**Last Updated:** 2026-01-20
**Status:** 100% PRODUCTION READY
**All mock data removed, all pages connected to real API**

---

## SYSTEM OVERVIEW

MGR Capital Assistance is a **tax surplus recovery platform** that helps property owners recover unclaimed funds after tax sales. The platform manages:
- Case intake and tracking
- Client communication and document collection
- Legal document generation and filing
- Employee management with shadow accounting
- Payout processing and ledger management

### Tech Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS (`/app`)
- **Backend:** Node/Express + TypeScript (`/backend`)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT tokens with bcrypt password hashing

---

## IMMUTABLE RULES — NEVER VIOLATE

1. **Everything PRODUCTION READY** — No placeholders, no TODOs, no mock data
2. **Shadow Accounting** — Employees see inflated rates, receive half
3. **Role Boundaries** — Founder sees all, Employees limited, Clients see nothing about backend
4. **All Values in CENTS** — Never use floating point for money
5. **UTC Timestamps** — All dates stored in UTC
6. **Closed System** — Never expose internal logic externally

---

## 5-TIER EMPLOYEE COMMISSION SYSTEM (SHADOW ACCOUNTING)

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

## CASE LIFECYCLE

```
NEW → CONTACTED → DOCS_PENDING → DOCS_SIGNED → FILED → AWAITING_FUNDS → PAID
```

| Status | Description | Next Action |
|--------|-------------|-------------|
| NEW | Case created, not yet worked | Employee calls client |
| CONTACTED | Initial contact made | Send documents to client |
| DOCS_PENDING | Waiting for client signatures | Follow up on documents |
| DOCS_SIGNED | Documents received and signed | File with county/court |
| FILED | Claim filed with authorities | Wait for response |
| AWAITING_FUNDS | Approved, waiting for disbursement | Monitor for payment |
| PAID | Funds received and distributed | Case complete |
| CLOSED | Case closed (any reason) | N/A |
| REJECTED | Filing rejected | Analyze and retry |

---

## USER ROLES & ACCESS

### FOUNDER (Time) — Full Access
- Sees all data including actual commission rates
- Sees surplus amounts, fee calculations, shadow accounting
- Can manage employees, cases, payouts, settings
- Can view audit logs and anomalies
- Has superuser access to all routes

### EMPLOYEE — Limited Access
- Sees their assigned cases only
- Sees displayed commission rate (NOT actual)
- Sees their displayed earnings (NOT actual)
- Can view training modules
- Cannot see surplus amounts, fee percentages, or backend logic

### CLIENT — Portal Access Only
- Sees case status in simple terms
- Can upload ID and sign documents
- Sees FAQ and simple explanations
- Cannot see any financial details or backend logic

---

## COMPLETE FILE STRUCTURE

### Backend Routes (`/backend/src/routes/`)

| File | Purpose | Key Endpoints |
|------|---------|---------------|
| `auth.ts` | Authentication | POST /login, POST /logout, GET /me, POST /change-password |
| `cases.ts` | Case management | GET /, GET /stats, GET /my, GET /client/:token, POST /, PATCH /:id |
| `employees.ts` | Employee management | GET /, GET /leaderboard, GET /me, POST /, PATCH /:id/tier |
| `clients.ts` | Client portal | GET /portal/:token, PATCH /portal/:token/info, POST /portal/:token/id-upload |
| `payouts.ts` | Financial management | GET /pending, GET /ledger, POST /process/:caseId, GET /anomalies |
| `legal.ts` | Legal operations | GET /states/:state, POST /documents, GET /deadlines/:caseId |
| `ingestion.ts` | Data import | GET /sources, POST /upload, GET /batches |
| `training.ts` | Training system | GET /modules, GET /progress/:employeeId, POST /complete/:moduleId |

### Backend Services (`/backend/src/services/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `legalService.ts` | Legal automation | getStateRules(), generateDocument(), checkCompliance(), createDeadlines() |
| `employeeService.ts` | Employee coaching | getScripts(), checkCompliance(), generateCoachingFeedback() |
| `clientService.ts` | Client portal | getClientSafeStatus(), getFAQAnswers(), getDocumentStatus() |
| `bankingService.ts` | Financial calculations | calculatePayout(), getEmployeeEarnings(), detectAnomalies() |
| `ingestionService.ts` | Data parsing | parseCSV(), parsePDF(), processIngestionBatch() |
| `trainingService.ts` | Training system | getModules(), trackProgress(), submitQuiz() |
| `caseService.ts` | Case operations | listAll(), listByEmployee(), getForClient(), createFromIngestion() |
| `commissionService.ts` | Commission math | calculateEmployeeCommission(), calculateDisplayedCommission() |

### Frontend Routes (`/app/src/routes/`)

| File | Purpose | API Endpoints Used |
|------|---------|-------------------|
| `AdminDashboard.tsx` | Founder dashboard | /cases/stats, /employees/leaderboard, /payouts/anomalies |
| `AdminCases.tsx` | Case management | /cases |
| `AdminEmployees.tsx` | Employee management | /employees, /employees/stats |
| `AdminBanking.tsx` | Payouts & ledger | /payouts/pending, /payouts/ledger |
| `AdminTraining.tsx` | Training management | /training/modules, /training/progress |
| `AdminIngestion.tsx` | Data import | /ingestion/batches |
| `AdminSettings.tsx` | System settings | /auth/audit-logs, /auth/settings |
| `EmployeeOffice.tsx` | Employee workspace | /cases/my, /employees/me, /payouts/my/summary |
| `EmployeeTraining.tsx` | Employee training | /employees/me/training |
| `ClientPortal.tsx` | Client case view | /cases/client/:token, /clients/portal/:token |
| `ClientOnboarding.tsx` | Client onboarding | /clients/portal/:token, /clients/portal/:token/info |
| `Login.tsx` | Authentication | /auth/login |

### Frontend Components (`/app/src/components/`)

| File | Purpose |
|------|---------|
| `layout/AdminLayout.tsx` | Admin sidebar + navigation (uses React Router Link) |
| `layout/EmployeeLayout.tsx` | Employee sidebar + navigation |
| `layout/ClientLayout.tsx` | Client header/footer |
| `ui/SimpleStatCard.tsx` | Dashboard stat display |

---

## DATABASE SCHEMA (Prisma)

### Core Models

```prisma
User {
  id, email, name, phone, role, passwordHash
  employeeTier, isActive, createdAt, lastLoginAt
  assignedCases[], ledgerEntries[], trainingProgress[]
}

Case {
  id, internalCode, publicAccessToken
  clientId, assignedEmployeeId, state, county
  propertyAddress, parcelNumber, saleDate
  surplusAmountCents, feePercent, actualFeeCents
  status, priority, source
  documents[], deadlines[], communications[]
}

Client {
  id, name, email, phone, address, city, state, zipCode
  idUploaded, idVerified, cases[]
}

Document {
  id, caseId, type, status, filePath
  signedAt, signature, uploadedAt
}

LedgerEntry {
  id, caseId, userId, type, amountCents
  displayedAmountCents, status, description
  completedAt, reference, notes
}
```

### Key Enums

```prisma
UserRole: FOUNDER, ADMIN, EMPLOYEE, CLIENT
CaseStatus: NEW, CONTACTED, DOCS_PENDING, DOCS_SIGNED, FILED, AWAITING_FUNDS, PAID, CLOSED, REJECTED
EmployeeTier: TIER_1_ASSOCIATE through TIER_5_EXECUTIVE_PARTNER
DocumentType: SERVICE_AGREEMENT, POA, AFFIDAVIT, MOTION, COVER_LETTER, etc.
LedgerEntryType: CLIENT_PAYOUT, EMPLOYEE_COMMISSION, COMPANY_FEE, FOUNDER_SHARE
LedgerEntryStatus: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
```

---

## API RESPONSE FORMAT

All API responses follow this structure:

```typescript
// Success
{
  success: true,
  data: { ... },
  count?: number  // for list endpoints
}

// Error
{
  success: false,
  error: "Error message"
}
```

---

## AUTHENTICATION FLOW

1. User submits email + password to `POST /api/auth/login`
2. Backend validates credentials with bcrypt
3. JWT token issued with { userId, email, role, tier }
4. Token stored in localStorage as `token`
5. All API requests include `Authorization: Bearer <token>`
6. `GET /api/auth/me` validates token and returns user data

### Role Guard (Backend)
- FOUNDER bypasses all role checks (superuser)
- Other roles checked against allowedRoles array
- Unauthorized returns 403

### Protected Routes (Frontend)
- ProtectedRoute component checks isAuthenticated
- FOUNDER can access all routes
- Redirects to /login if not authenticated

---

## SHADOW ACCOUNTING IMPLEMENTATION

### Payout Calculation (bankingService.ts)

```typescript
calculatePayout({
  surplusAmountCents: 100000,  // $1,000.00
  feePercent: 30,              // 30% fee
  employeeTier: "TIER_3_SENIOR_SPECIALIST"
})

// Returns:
{
  feeAmountCents: 30000,                    // $300 total fee
  clientPayoutCents: 70000,                 // $700 to client
  employeeCommissionCents: 9000,            // $90 actual (30% of fee × 30% actual rate)
  employeeDisplayedCommissionCents: 18000,  // $180 displayed (30% of fee × 60% displayed rate)
  founderShareCents: 21000,                 // $210 founder profit
}
```

### Employee View (What they see)
- Commission Rate: 60% (displayed)
- This Case Earnings: $180 (displayed)
- Never see actual amounts

### Founder View (What's real)
- Employee Actual Rate: 30%
- Employee Actual Commission: $90
- Founder Share: $210

---

## LEGAL DOCUMENT GENERATION

### Supported Document Types
1. SERVICE_AGREEMENT - Client service contract
2. LIMITED_POA - Power of Attorney
3. AFFIDAVIT - Sworn statement
4. MOTION - Court motion
5. COVER_LETTER - Filing cover letter
6. FILING_PACKET - Complete filing package
7. EVIDENCE_PACKET - Supporting evidence
8. FOLLOW_UP_LETTER - Follow-up correspondence
9. VERIFICATION_LETTER - Verification request
10. PAYMENT_INSTRUCTIONS - Payment details

### State Rules Database
- 50 states with legal rules pre-loaded
- Redemption periods, filing deadlines, required documents
- County-specific overrides supported

---

## TRAINING MODULES

4 training modules with quizzes:
1. Introduction to MGR Capital Assistance
2. Client Communication Basics
3. Compliance & Boundaries
4. Case Processing Procedures

Progress tracked per employee, completion contributes to performance metrics.

---

## INGESTION SYSTEM

### Supported Sources
- CSV files (tax sale lists)
- PDF parsing (surplus documents)
- Manual entry

### Batch Processing
- Upload creates IngestionBatch record
- Parse and validate records
- Create Client and Case records
- Flag high-value cases (>$10,000) for priority

---

## COMMANDS TO RUN

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

# Create founder user (run in Prisma Studio or seed script)
npx prisma studio
```

---

## ENVIRONMENT VARIABLES

### Backend (.env)
```
DATABASE_URL="postgresql://user:pass@localhost:5432/mgr_capital"
JWT_SECRET="your-secret-key-min-32-chars"
PORT=4000
NODE_ENV=development
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000/api
```

---

## WHAT'S COMPLETE (100%)

### Frontend Pages - All Real Data
- [x] AdminDashboard - metrics, leaderboard, anomalies
- [x] AdminCases - full case list with filtering
- [x] AdminEmployees - employee management
- [x] AdminBanking - payouts and ledger
- [x] AdminTraining - training module management
- [x] AdminIngestion - data import
- [x] AdminSettings - audit logs, system config
- [x] EmployeeOffice - cases, earnings, scripts
- [x] EmployeeTraining - modules with progress
- [x] ClientPortal - case status, documents
- [x] ClientOnboarding - info confirmation, ID upload
- [x] Login - real authentication

### Backend Routes - All Implemented
- [x] auth.ts - login, logout, me, change-password
- [x] cases.ts - CRUD, stats, employee view, client view
- [x] employees.ts - CRUD, leaderboard, self-service
- [x] clients.ts - CRUD, portal endpoints
- [x] payouts.ts - calculations, ledger, anomalies
- [x] legal.ts - state rules, document generation
- [x] ingestion.ts - batch upload and processing
- [x] training.ts - modules and progress

### Backend Services - All Functional
- [x] legalService.ts - 50 state rules, document templates
- [x] employeeService.ts - scripts, coaching, compliance
- [x] clientService.ts - portal intelligence, FAQ
- [x] bankingService.ts - payout math, shadow accounting
- [x] ingestionService.ts - CSV/PDF parsing
- [x] trainingService.ts - 4 modules with quizzes
- [x] caseService.ts - Prisma operations
- [x] commissionService.ts - tier calculations

### Database
- [x] Prisma schema (760+ lines)
- [x] All models defined
- [x] All enums defined
- [x] Relations configured

---

## IMPORTANT REMINDERS

1. **FOUNDER = superuser** - bypasses all role checks
2. **Never reveal to employees:** surplus amounts, actual rates, fee percentages
3. **Never reveal to clients:** any financial details, backend logic
4. **All money in CENTS** - divide by 100 for display
5. **Test after changes** - both frontend and backend
6. **Keep docs updated** - TIMEBEUNUS.md, TIME_TODO.md

---

## SESSION HISTORY

### Session 3 (2026-01-20) - Current
- Fixed EmployeeOffice.tsx - real API integration
- Fixed EmployeeTraining.tsx - real API integration
- Fixed ClientPortal.tsx - real API integration
- Fixed ClientOnboarding.tsx - real API integration
- Fixed EmployeeLayout.tsx - React Router Link
- Fixed caseService.ts - Prisma implementation
- Fixed commissionService.ts - full implementation
- **SYSTEM NOW 100% PRODUCTION READY**

### Session 2 (2026-01-20)
- Fixed AdminLayout navigation (Link instead of a)
- Fixed AdminCases real data fetching
- Created AdminTraining and AdminIngestion pages
- Added routes for new pages

### Session 1 (2026-01-20)
- Fixed payouts.ts property names
- Implemented real authentication
- Updated Prisma schema
- Created AdminDashboard
- Added leaderboard endpoint

---

END OF DROP_THIS_TO_COPILOT.md
