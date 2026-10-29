import crypto from 'node:crypto';
import { researchEvidenceSchema, compareResearchEvidence } from './ClaimantResearchContract.js';
import prisma from '../lib/prisma.js';
import { requireCase } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
function state(meta: unknown): {
    root: Record<string, any>;
    records: any[];
} { const root = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, any> : {}; const stored = root.claimantResearch; if (stored && (stored.version !== 1 || !Array.isArray(stored.records)))
    throw new AppError('Research state unavailable', 409, 'Research record version requires reconciliation.'); return { root, records: stored?.records ?? [] }; }
async function access(db: any, actorId: string, caseId: string, write = false) { const ctx = await requireCase(db, actorId, caseId); if (!['FOUNDER', 'ADMIN', 'EMPLOYEE', 'TEAM_LEAD', 'COMPLIANCE'].includes(ctx.actor.role) || (write && ctx.actor.role === 'COMPLIANCE'))
    throw new AppError('Forbidden', 403, 'Assigned research staff access required.'); return ctx; }
export class ClaimantResearchService {
    async addEvidence(actorId: string, caseId: string, input: unknown) {
        const parsed = researchEvidenceSchema.safeParse(input);
        if (!parsed.success)
            throw new AppError('Invalid evidence', 400, 'Provide source, record ID, source date, name and permitted-use reference. No SSN or unsupported fields are accepted.');
        if (Date.parse(parsed.data.sourceDate) > Date.now() + 300000)
            throw new AppError('Invalid date', 400, 'Source date cannot be in the future.');
        const data = parsed.data;
        const digest = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
        return prisma.$transaction(async (db) => {
            await access(db, actorId, caseId, true);
            await db.$queryRaw `SELECT id FROM "Case" WHERE id=${caseId} FOR UPDATE`;
            const { record } = await access(db, actorId, caseId, true);
            const saved = state(record.metadata);
            const duplicate = saved.records.find(x => x.sha256 === digest);
            if (duplicate)
                return { record: duplicate, duplicate: true };
            if (saved.records.length >= 100)
                throw new AppError('Research capacity', 413, 'This case has reached the bounded research limit of100 records.');
            const entry = { id: crypto.randomUUID(), ...data, sha256: digest, recordedAt: new Date().toISOString(), recordedBy: actorId, sourceContentVerified: false, identityVerified: false, heirVerified: false, contactPermissionVerified: false };
            await db.case.update({ where: { id: caseId }, data: { metadata: { ...saved.root, claimantResearch: { version: 1, records: [...saved.records, entry] } } } });
            await db.auditLog.create({ data: { userId: actorId, tenantId: record.tenantId, action: 'CLAIMANT_EVIDENCE_ADDED', entityType: 'CASE', entityId: caseId, details: { evidenceId: entry.id, sha256: digest, sourceContentVerified: false } } });
            return { record: entry, duplicate: false };
        });
    }
    async dossier(actorId: string, caseId: string) { return prisma.$transaction(async (db) => { const { record } = await access(db, actorId, caseId); const client = await db.user.findUnique({ where: { id: record.clientId }, select: { name: true } }); const target = { fullName: record.previousOwner || client?.name || '', address: record.propertyAddress, parcelNumber: record.parcelNumber ?? undefined }; const stored = state(record.metadata); const records = stored.records.map(row => { const parsed = researchEvidenceSchema.safeParse(Object.fromEntries(Object.keys(researchEvidenceSchema.shape).filter(k => row[k] !== undefined).map(k => [k, row[k]]))); if (!parsed.success)
        throw new AppError('Invalid saved evidence', 409, 'Saved research requires reconciliation.'); return { ...row, assessment: compareResearchEvidence(parsed.data, target) }; }); await db.auditLog.create({ data: { userId: actorId, tenantId: record.tenantId, action: 'CLAIMANT_DOSSIER_READ', entityType: 'CASE', entityId: caseId } }); return { engine: 'MGR_NATIVE_PUBLIC_RECORD_RESEARCH', version: 1, caseId, target, records, recordCount: records.length, paidProviderRequired: false, identityVerified: false, heirVerified: false, nextActions: records.length ? ['Review source artifacts and conflicts before selecting a claimant.', 'Verify current contact and outreach permission separately.'] : ['Collect a permitted public record or client-supplied record, then add its source evidence.'], scope: 'Saved source-attributed research; no nationwide phone database, contact consent, legal entitlement or live source-content verification is asserted.' }; }); }
}
export const claimantResearchService = new ClaimantResearchService();
