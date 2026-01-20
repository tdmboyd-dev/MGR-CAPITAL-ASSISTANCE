export type LedgerEntryType =
  | "COMMISSION"
  | "OVERRIDE"
  | "FOUNDER_SHARE"
  | "CLIENT_PAYOUT"
  | "ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  caseId: string;
  userId: string;
  amountCents: number;
  description: string;
  entryType: LedgerEntryType;
  createdAt: Date;
}

export interface CreateLedgerEntryInput {
  caseId: string;
  userId: string;
  amountCents: number;
  description: string;
  entryType: LedgerEntryType;
}
