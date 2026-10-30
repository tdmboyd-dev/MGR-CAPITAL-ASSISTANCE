import { z } from 'zod';
import { successDataSchema } from './commandCenter';

const count = z.number().int().nonnegative();
export const workerFleetSchema = successDataSchema(z.object({
  bots: z.array(z.object({
    id: z.string().min(1), codename: z.string(), designation: z.string(), role: z.string(), generation: z.string(),
    status: z.string(), evolutionLevel: count, casesWorked: count, casesWon: count,
    revenueGenerated: z.number().int(), successRate: z.number().finite(), learningScore: z.number().finite(),
    activeCases: count, taskQueue: count, totalTasks: count, totalLearnings: count, totalSpawned: count,
    lastActivityAt: z.string().nullable(), personality: z.object({ catchphrase: z.string(), tone: z.string() }),
  })),
  totalActive: count, totalCases: count, totalRevenue: z.number().int(),
}));
