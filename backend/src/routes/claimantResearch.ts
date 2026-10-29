import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { governmentSources, governmentSourceService } from '../services/GovernmentSourceService.js';
import { AppError } from '../middleware/errorHandler.js';
import { floridaPublicParcelService } from '../services/FloridaPublicParcelService.js';
import { currentActor, requireCase, accessFailure } from '../services/CaseDocumentAccess.js';
import { claimantResearchService } from '../services/ClaimantResearchService.js';
const router = Router();
router.use(authMiddleware);
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
router.get('/cases/:caseId', async (req: AuthRequest, res) => { try {
    res.json({ success: true, data: await claimantResearchService.dossier(req.user!.id, req.params.caseId) });
}
catch (e) {
    accessFailure(res, e);
} });
router.post('/cases/:caseId/evidence', async (req: AuthRequest, res) => { try {
    const result = await claimantResearchService.addEvidence(req.user!.id, req.params.caseId, req.body);
    res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
}
catch (e) {
    accessFailure(res, e);
} });
async function founder(id: string) { const actor = await currentActor(prisma, id); if (actor.role !== 'FOUNDER' || actor.tenantId !== null)
    throw new AppError('Forbidden', 403, 'Global founder source-management access required.'); }
router.get('/sources', async (req: AuthRequest, res) => { try {
    await founder(req.user!.id);
    res.json({ success: true, data: governmentSources });
}
catch (e) {
    accessFailure(res, e);
} });
router.post('/sources/:sourceId/probe', async (req: AuthRequest, res) => { try {
    await founder(req.user!.id);
    const result = await governmentSourceService.probe(req.params.sourceId);
    await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'GOVERNMENT_SOURCE_PROBED', entityType: 'SOURCE', entityId: req.params.sourceId, details: result } });
    res.json({ success: result.status === 'SOURCE_PAGE_FETCHED', data: result });
}
catch (e) {
    accessFailure(res, e);
} });
router.post('/cases/:caseId/florida-parcel', async (req: AuthRequest, res) => { try {
    const { actor, record } = await requireCase(prisma, req.user!.id, req.params.caseId);
    if (!['FOUNDER', 'ADMIN', 'EMPLOYEE', 'TEAM_LEAD'].includes(actor.role))
        throw new AppError('Forbidden', 403, 'Assigned research staff access required.');
    if (record.state !== 'FL')
        throw new AppError('Unsupported state', 400, 'This connector is for Florida cases only.');
    const result = await floridaPublicParcelService.lookup(req.body);
    await prisma.auditLog.create({ data: { userId: actor.id, tenantId: record.tenantId, action: 'FLORIDA_PARCEL_RESEARCHED', entityType: 'CASE', entityId: record.id, details: { sha256: result.sha256, candidateCount: result.candidates.length, identityVerified: false } } });
    res.json({ success: true, data: result });
}
catch (e) {
    accessFailure(res, e);
} });
export default router;
