import { z } from 'zod';

const person = z.object({ id: z.string().optional(), name: z.string(), email: z.string().nullable().optional(), phone: z.string().nullable().optional() }).nullable().optional();
const cents = z.number().int().nullable().optional();
export const caseRecordSchema = z.object({
  id: z.string().min(1), status: z.string().min(1), createdAt: z.string(),
  caseCode: z.string().nullable().optional(), internalCode: z.string().nullable().optional(),
  county: z.string().nullable().optional(), state: z.string().nullable().optional(),
  propertyAddress: z.string().nullable().optional(),
  actualRecoveryCents: cents, estimatedRecoveryCents: cents, estimatedValueCents: cents,
  client: person, assignedEmployee: person,
});
export const caseListSchema = z.object({
  success: z.literal(true), data: z.array(caseRecordSchema),
  count: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(), totalPages: z.number().int().nonnegative().optional(),
});
export type CaseRecord = z.infer<typeof caseRecordSchema>;

/** Document metadata returned inside a case; storage credentials are not part of this view. */
export interface CaseDocumentRecord {
 id:string; type:string; status:string; fileName:string; createdAt:string;
 signed?:boolean; needsSignature?:boolean; name?:string; filePath?:string;
}
