import { z } from 'zod';
import { successDataSchema } from './commandCenter';

export const paymentRecordSchema = z.object({
  id: z.string().min(1), amount: z.number().finite(), method: z.string().nullable(), status: z.string(), createdAt: z.string(),
});
export const paymentListSchema = successDataSchema(z.array(paymentRecordSchema));
export const paymentMetricsSchema = successDataSchema(z.object({
  totalRecovered: z.number().finite(), pending: z.number().finite(), refunded: z.number().finite(),
  trend: z.array(z.object({ date: z.string(), amount: z.number().finite() })),
  byMethod: z.array(z.object({ method: z.string(), count: z.number().int().nonnegative(), total: z.number().finite() })),
}));
