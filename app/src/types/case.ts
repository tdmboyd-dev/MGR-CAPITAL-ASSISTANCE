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
  clientName?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  state: string;
  county: string;
  propertyAddress?: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  filedAt?: string;
  paidAt?: string;
}

export interface CaseListItem {
  id: string;
  internalCode: string;
  clientName: string;
  state: string;
  county: string;
  status: CaseStatus;
}

export const statusLabels: Record<CaseStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DOCS_PENDING: "Docs Needed",
  DOCS_SIGNED: "Docs Signed",
  FILED: "Filed",
  AWAITING_FUNDS: "Awaiting Funds",
  PAID: "Paid",
};
