export interface CommissionPlan {
  id: string;
  tierName: string; // "Tier 1 — Associate"
  displayedRatePercent: number; // what they see
  actualRatePercent: number; // what they really get
  overridePercent?: number; // for leaders
}