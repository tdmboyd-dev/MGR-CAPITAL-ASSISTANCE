You are responsible for building the software body of MGR Capital Assistance.

Use:
- React + TypeScript + Tailwind for the frontend in /app.
- Node/Express + TypeScript (or Nest) for the backend in /backend.

Implement:
- The layouts and screens shown in `app/src/routes` and `app/src/components/layout`.
- Role-based access (Founder, Employee, Client).
- Models for User, Case, CommissionPlan, LedgerEntry.
- APIs for auth, cases, employees, clients, payouts.

Respect:
- Shadow accounting (employees never see real surplus amounts or true percentages).
- Role-based visibility (backend logic and amounts are hidden from employees and clients).