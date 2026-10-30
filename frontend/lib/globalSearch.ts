import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const base = { id, matchedField: z.string(), score: z.number().finite() };
export const searchResultSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('case'), caseCode: z.string(), status: z.string(), previousOwner: z.string().nullable(), propertyAddress: z.string().nullable() }),
  z.object({ ...base, type: z.literal('user'), name: z.string(), email: z.string(), role: z.string() }),
  z.object({ ...base, type: z.literal('document'), fileName: z.string(), documentType: z.string(), caseId: id, caseCode: z.string() }),
  z.object({ ...base, type: z.literal('communication'), subject: z.string().nullable(), preview: z.string(), caseId: id, caseCode: z.string(), direction: z.string() }),
]);
export const globalSearchSchema = z.object({
  success: z.literal(true), query: z.string(), totalResults: z.number().int().nonnegative(),
  results: z.array(searchResultSchema), searchTime: z.number().nonnegative(),
  breakdown: z.object({ cases: z.number(), users: z.number(), documents: z.number(), communications: z.number() }),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

// Server IDs are opaque path segments. Do not allow a result to choose an origin.
export function searchResultLink(result: SearchResult, role: string): string | null {
  const area = ({ FOUNDER: 'founder', ADMIN: 'admin', EMPLOYEE: 'employee', CLIENT: 'client' } as Record<string, string>)[role];
  if (!area) return null;
  if (result.type === 'user') return role === 'ADMIN' ? '/admin/users' : role === 'FOUNDER' ? '/founder/employees' : null;
  const caseId = result.type === 'case' ? result.id : result.caseId;
  return `/${area}/cases/${encodeURIComponent(caseId)}`;
}

export function searchResultDisplay(result: SearchResult): { title: string; subtitle: string } {
  switch (result.type) {
    case 'case': return { title: result.caseCode || 'Case', subtitle: result.previousOwner || result.propertyAddress || result.status };
    case 'user': return { title: result.name || result.email, subtitle: result.role };
    case 'document': return { title: result.fileName, subtitle: `${result.documentType} • Case: ${result.caseCode}` };
    case 'communication': return { title: result.subject || 'Communication', subtitle: result.preview };
  }
}
