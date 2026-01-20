import { commissionService } from "./commissionService.js";

export class PayoutService {
  async calculatePayouts(params: {
    tierName: string;
    surplusAmountCents: number;
    feePercent: number;
  }) {
    const feeAmountCents = Math.round((params.surplusAmountCents * params.feePercent) / 100);
    const employeeCommissionCents = commissionService.calculateEmployeeCommission({
      tierName: params.tierName,
      feeAmountCents,
    });

    const founderShareCents = feeAmountCents - employeeCommissionCents;

    return {
      feeAmountCents,
      employeeCommissionCents,
      founderShareCents,
    };
  }
}

export const payoutService = new PayoutService();
