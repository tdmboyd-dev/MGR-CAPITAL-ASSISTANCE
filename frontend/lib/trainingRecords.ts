import { z } from 'zod';

export const trainingModulesSchema=z.object({success:z.literal(true),data:z.array(z.object({id:z.string(),title:z.string(),description:z.string(),orderIndex:z.number().int(),hasQuiz:z.boolean()}))});
export const trainingProgressSchema=z.object({success:z.literal(true),data:z.array(z.object({moduleId:z.string(),title:z.string(),status:z.enum(['LOCKED','AVAILABLE','IN_PROGRESS','COMPLETED']),progress:z.number().min(0).max(100),bestScore:z.number().nullable(),completedAt:z.string().nullable()}))});
