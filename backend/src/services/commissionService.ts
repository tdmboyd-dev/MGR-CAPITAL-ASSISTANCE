import { CommissionPlan } from "../models/CommissionPlan.js";

export class CommissionService {
  // In real build, fetch from DB
  private plans: CommissionPlan[] = [
    { id: "tier1", tierName: "Tier 1 — Associate", displayedRatePercent: 20, actualRatePercent: 10 },
    { id: "tier2", tierName: "Tier 2 — Specialist", displayedRatePercent: 40, actualRatePercent: 20 },
    { id: "tier3", tierName: "Tier 3 — Senior Specialist", displayedRatePercent: 60, actualRatePercent: 30 },
    { id: "tier4", tierName: "Tier 4 — Team Leader", displayedRatePercent: 80, actualRatePercent: 40, overridePercent: 10 },
    { id: "tier5", tierName: "Tier 5 — Executive Partner", displayedRatePercent: 100, actualRatePercent: 50, overridePercent: 20 },
  ];

  getPlanForTier(tierName: string): CommissionPlan | undefined {
    return this.plans.find((p) => p.tierName === tierName);
  }

  calculateEmployeeCommission(params: {
    tierName: string;
    feeAmountCents: number;
  }): number {
    const plan = this.getPlanForTier(params.tierName);
    if (!plan) return 0;
    return Math.round((params.feeAmountCents * plan.actualRatePercent) / 100);
  }
}

export const commissionService = new CommissionService();
