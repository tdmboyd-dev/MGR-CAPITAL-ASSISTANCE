import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { skipTraceService, personSchema } from '../services/SkipTraceService.js';
import { currentActor, accessFailure } from '../services/CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';
const router = Router();
router.use(authenticate);
router.use((req: AuthRequest, res, next) => { void (async () => { const actor = await currentActor(prisma, req.user!.id); if (actor.role !== 'FOUNDER' || actor.tenantId !== null)
    throw new AppError('Forbidden', 403, 'Global founder research access required.'); res.setHeader('Cache-Control', 'private, no-store'); next(); })().catch(e => accessFailure(res, e)); });
router.get('/status', (_req, res) => res.json(skipTraceService.getStatus()));
router.get('/analytics', async (_req, res) => { try {
    res.json({ success: true, analytics: await skipTraceService.getTracerfyAnalytics() });
}
catch (e) {
    accessFailure(res, e);
} });
const body = z.object({ person: personSchema, enhanced: z.boolean().default(false), acknowledgeCredits: z.literal(true) }).strict();
const property = z.object({ address: z.string().trim().min(1).max(250), city: z.string().trim().min(1).max(100), state: z.string().regex(/^[A-Z]{2}$/), zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(), acknowledgeCredits: z.literal(true) }).strict();
for (const mode of ['person', 'property'] as const)
    router.post('/' + mode, async (req: AuthRequest, res) => {
        const operationId = crypto.randomUUID();
        try {
            const parsed = (mode === 'person' ? body : property).safeParse(req.body);
            if (!parsed.success)
                throw new AppError('Invalid lookup', 400, 'Provide the required name/address/city/state fields and acknowledge provider credits. SSN and unsupported fields are not accepted.');
            const data = parsed.data as any;
            await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'SKIP_TRACE_REQUESTED', entityType: 'RESEARCH_OPERATION', entityId: operationId, details: { mode, enhanced: data.enhanced === true, expectedCreditsPerHit: data.enhanced ? 15 : 5 } } });
            const result = mode === 'person' ? await skipTraceService.tracePerson(data.person, data.enhanced) : await skipTraceService.traceByProperty(data.address, data.city, data.state, data.zip ?? '');
            await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'SKIP_TRACE_RETURNED', entityType: 'RESEARCH_OPERATION', entityId: operationId, details: { candidateCount: Array.isArray(result) ? result.length : result.status === 'found' ? 1 : 0, identityVerified: false } } });
            res.json({ success: true, operationId, candidateOnly: true, identityVerified: false, ...(mode === 'person' ? { result } : { owners: result }) });
        }
        catch (e) {
            res.setHeader('X-Research-Operation', operationId);
            accessFailure(res, e, 'Lookup completion was not confirmed. Keep the operation ID and do not automatically repeat a paid request.');
        }
    });
for (const path of ['/batch', '/batch-submit', '/heirs', '/deceased-check'])
    router.post(path, (_req, res) => res.status(503).json({ success: false, error: 'This workflow requires durable job/identity evidence integration. No search, heir verification or batch submission was performed.' }));
export default router;
