import { z } from 'zod';

const count = z.number().int().nonnegative();
export const opsDashboardSchema = z.object({
  summary: z.object({ totalCases: count, activeCases: count, totalPayoutsCents: z.number().int(), pendingAlerts: count, employeeCount: count }),
  recentActivity: z.object({ newCases24h: count, payoutsProcessed24h: count, alertsCreated24h: count, documentsUploaded24h: count }),
  alerts: z.object({ critical: count, high: count, medium: count, low: count }),
});
export const masterSettingsSchema = z.object({
  settings: z.record(z.string(), z.boolean()),
  metadata: z.array(z.object({ key: z.string(), label: z.string(), description: z.string(), category: z.string() })),
});
export const toggleReceiptSchema = z.object({ enabled: z.boolean() });
export const successDataSchema = <T extends z.ZodType>(schema: T) => z.object({ success: z.literal(true), data: schema });
