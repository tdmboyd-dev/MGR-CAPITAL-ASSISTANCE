export interface PayoutCalculation {
  feeAmountCents: number;
  employeeCommissionCents: number;
  founderShareCents: number;
}

export interface LedgerEntry {
  id: string;
  caseId: string;
  userId: string;
  amountCents: number;
  description: string;
  entryType: "COMMISSION" | "OVERRIDE" | "FOUNDER_SHARE" | "CLIENT_PAYOUT";
  createdAt: string;
}

export interface EmployeeEarnings {
  totalLifetimeCents: number;
  totalMonthCents: number;
  pendingCents: number;
  entries: LedgerEntry[];
}

export interface CommissionPlan {
  id: string;
  tierName: string;
  displayedRatePercent: number;
  actualRatePercent: number;
  overridePercent?: number;
}
