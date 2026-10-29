import { z } from 'zod';
const bounded = z.string().trim().min(1).max(300);
export const researchEvidenceSchema = z.object({ fullName: bounded, address: bounded.optional(), parcelNumber: z.string().trim().min(1).max(100).optional(), sourceUrl: z.string().url().max(2000).refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && !u.hash; }, 'Use an HTTPS source without credentials'), sourceRecordId: z.string().trim().min(1).max(150), sourceDate: z.string().datetime(), rightsBasis: z.enum(['PUBLIC_RECORD', 'CLIENT_CONSENT', 'LICENSED_INTERNAL_USE']), rightsReference: bounded, phone: z.string().regex(/^\+?[\d ()-]{7,25}$/).optional(), email: z.string().email().max(254).optional() }).strict();
export type ResearchEvidenceInput = z.infer<typeof researchEvidenceSchema>;
const norm = (v: unknown) => typeof v === 'string' ? v.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() : '';
export function compareResearchEvidence(record: ResearchEvidenceInput, target: {
    fullName?: string;
    address?: string;
    parcelNumber?: string;
}) {
    const reasons: string[] = [];
    if (norm(target.fullName) && norm(record.fullName) === norm(target.fullName))
        reasons.push('EXACT_NORMALIZED_NAME');
    if (norm(target.address) && norm(record.address) === norm(target.address))
        reasons.push('EXACT_NORMALIZED_ADDRESS');
    if (norm(target.parcelNumber) && norm(record.parcelNumber) === norm(target.parcelNumber))
        reasons.push('EXACT_NORMALIZED_PARCEL');
    return { reasons, reviewPriority: reasons.includes('EXACT_NORMALIZED_NAME') && (reasons.includes('EXACT_NORMALIZED_ADDRESS') || reasons.includes('EXACT_NORMALIZED_PARCEL')) ? 'CORROBORATE_RECORD' : 'REVIEW_AMBIGUOUS', identityVerified: false, heirVerified: false, contactPermissionVerified: false };
}
