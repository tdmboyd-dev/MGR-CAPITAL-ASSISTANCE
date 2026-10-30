import { z } from 'zod';
const count = z.number().int().nonnegative();
export const botSubscriptionSchema = z.object({
  id: z.string(), tier: z.string(), isActive: z.boolean(), enabledBots: z.array(z.string()),
  monthlyCostCents: count, totalChargedCents: count, createdAt: z.string(),
  user: z.object({ name: z.string(), email: z.string() }).optional(),
});
export const botUsageSchema = z.object({
  totalActions: count, totalCostCents: count,
  byBot: z.record(z.string(), z.object({ count, costCents: count, actions: z.record(z.string(), count) })),
  recentActivity: z.array(z.object({ botName: z.string(), action: z.string(), caseId: z.string().nullable(), createdAt: z.string() })),
});
export const botMineSchema = z.object({ success: z.literal(true), subscription: botSubscriptionSchema, usage: botUsageSchema });
export const botSubscriptionsSchema = z.object({ success: z.literal(true), subscriptions: z.array(botSubscriptionSchema) });
export const botTiersSchema = z.object({ success: z.literal(true), tiers: z.array(z.object({ tier: z.string(), monthlyCostCents: count, monthlyPrice: z.string(), bots: z.array(z.string()) })) });
