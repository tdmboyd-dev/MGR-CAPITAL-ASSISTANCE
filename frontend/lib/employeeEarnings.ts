import { z } from 'zod';
const cents=z.number().int().nonnegative();
export const employeeEarningsSchema=z.object({success:z.literal(true),data:z.object({
 lifetimeEarningsCents:cents,thisMonthCents:cents,pendingCents:cents,recordedCompletedCents:cents,
 reconciliationCount:z.number().int().nonnegative(),basis:z.literal('payable_allocations_not_bank_settlement'),
 payouts:z.array(z.object({id:z.string(),caseCode:z.string(),property:z.string(),location:z.string(),amountCents:cents.nullable(),status:z.string(),date:z.string(),reconciliationRequired:z.boolean(),legacyDisplayAdjusted:z.boolean()})),
})});
export const employeePayProfileSchema=z.object({success:z.literal(true),data:z.object({tier:z.string(),commissionRate:z.string()})});
