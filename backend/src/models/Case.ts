export type CaseStatus =
  | "NEW"
  | "CONTACTED"
  | "DOCS_PENDING"
  | "DOCS_SIGNED"
  | "FILED"
  | "AWAITING_FUNDS"
  | "PAID";

export interface Case {
  id: string;
  internalCode: string;
  clientId: string;
  assignedEmployeeId?: string;
  state: string;
  county: string;
  // real surplus amount — NEVER exposed to employees or clients
  surplusAmountCents: number;
  // fee you charge (e.g., 30% of surplus)
  feePercent: number;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
}