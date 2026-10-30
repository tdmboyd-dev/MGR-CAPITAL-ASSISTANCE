import { z } from 'zod';
import { successDataSchema } from './commandCenter';

export const documentRecordSchema = z.object({
  id: z.string().min(1), caseId: z.string().min(1), type: z.string(), status: z.string(), fileName: z.string(),
  createdAt: z.string(), needsSignature: z.boolean(), signed: z.boolean(), signatureRequired: z.boolean(),
  signedAt: z.string().nullable(), storageState: z.string(), deletionStatus: z.string(),
});
export const documentListSchema = successDataSchema(z.array(documentRecordSchema));
export type DocumentRecord = z.infer<typeof documentRecordSchema>;
