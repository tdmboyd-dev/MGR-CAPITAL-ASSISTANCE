# DROP THIS TO COPILOT — MGR CAPITAL ASSISTANCE

## SYSTEM OVERVIEW

You are working on **MGR Capital Assistance**, a tax surplus recovery platform with:
- React + TypeScript + Vite frontend (`/app`)
- Node/Express + TypeScript backend (`/backend`)
- PostgreSQL with Prisma ORM
- 6 AI intelligence modules

## IMMUTABLE RULES

1. **Everything must be PRODUCTION READY** — No placeholders, no TODOs, no mock data
2. **Shadow Accounting** — Employees see inflated commission rates (20-100%), actually receive half (10-50%)
3. **Role Boundaries** — Founder sees all, Employees see limited, Clients see nothing about backend

## 5-TIER EMPLOYEE SYSTEM

| Tier | Displayed Rate | Actual Rate | Override |
|------|---------------|-------------|----------|
| Tier 1 Associate | 20% | 10% | None |
| Tier 2 Specialist | 40% | 20% | None |
| Tier 3 Senior Specialist | 60% | 30% | None |
| Tier 4 Team Leader | 80% | 40% | 10% |
| Tier 5 Executive Partner | 100% | 50% | 20% |

## CASE LIFECYCLE

NEW → CONTACTED → DOCS_PENDING → DOCS_SIGNED → FILED → AWAITING_FUNDS → PAID

## KEY FILES

### Backend Services
- `backend/src/services/legalService.ts` — State rules, deadlines, document generation
- `backend/src/services/employeeService.ts` — Scripts, coaching, shadow accounting
- `backend/src/services/clientService.ts` — Portal intelligence, FAQ
- `backend/src/services/bankingService.ts` — Payout calculation, ledger management
- `backend/src/services/ingestionService.ts` — CSV/PDF parsing
- `backend/src/services/trainingService.ts` — Training modules

### Backend Routes
- `backend/src/routes/cases.ts` — Case management
- `backend/src/routes/employees.ts` — Employee management
- `backend/src/routes/clients.ts` — Client portal
- `backend/src/routes/payouts.ts` — Ledger and payouts
- `backend/src/routes/legal.ts` — Legal operations
- `backend/src/routes/ingestion.ts` — Data ingestion
- `backend/src/routes/training.ts` — Training system
- `backend/src/routes/auth.ts` — Authentication

### Database
- `backend/prisma/schema.prisma` — Complete schema (740+ lines)

### Frontend
- `app/src/routes/AdminDashboard.tsx` — Founder dashboard
- `app/src/routes/EmployeeOffice.tsx` — Employee workspace
- `app/src/routes/ClientPortal.tsx` — Client view

## RECENT FIXES (2026-01-20)

### Session 1:
1. Fixed payouts.ts property names to match bankingService return type
2. Complete auth.ts with real database authentication
3. Updated Prisma schema with missing LedgerEntry fields
4. Complete AdminDashboard with real data fetching
5. Added /employees/leaderboard endpoint
6. Enhanced /cases/stats for dashboard metrics

### Session 2:
1. Fixed AdminLayout navigation - changed <a> tags to React Router <Link>
   - This was causing page reloads and login redirects
2. Fixed AdminCases.tsx to fetch real data (removed mock data)
3. Created AdminTraining.tsx and AdminIngestion.tsx pages
4. Added routes for /admin/training and /admin/ingestion
5. Enhanced sidebar with Training Modules and Data Ingestion links

## CURRENT STATUS

All admin pages are now complete and fetching real data:
- AdminDashboard - Metrics, leaderboard, anomalies
- AdminCases - Full case list with filtering
- AdminEmployees - Employee management with shadow accounting visibility
- AdminBanking - Payouts and ledger management
- AdminTraining - Training module management
- AdminIngestion - Data import management
- AdminSettings - System configuration and audit logs

## WHAT NEEDS ATTENTION

1. Run Prisma migrations if not done: `npx prisma db push`
2. Create FOUNDER user in database if not exists
3. Test all admin tabs navigate without redirect
4. Verify FOUNDER role has full access

## COMMANDS

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend
cd app
npm install
npm run dev
```

## IMPORTANT CONTEXT

- This is a CLOSED SYSTEM — protect internal logic
- Founder = Time (full access)
- Never reveal surplus amounts to employees/clients
- Never reveal actual commission rates to employees
- All financial values in CENTS (not dollars)
- Use UTC timestamps throughout

---

When continuing work, always:
1. Check `docs/TIME_TODO.md` for current status
2. Check `TIMEBEUNUS.md` for latest session notes
3. Maintain shadow accounting protection
4. Keep all implementations production-ready

END OF DROP_THIS_TO_COPILOT.md
