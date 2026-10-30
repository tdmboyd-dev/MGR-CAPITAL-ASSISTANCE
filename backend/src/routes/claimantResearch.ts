import { Router, raw } from 'express';
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
router.post('/warehouse/sources/:sourceId/archive-pdf',raw({type:'application/pdf',limit:2097152}),async(req:AuthRequest,res)=>{
 try{
  await founder(req.user!.id);
  if(req.params.sourceId!=='tn-shelby-sale-book-2202'||!Buffer.isBuffer(req.body)||!req.body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new AppError('Invalid source PDF',422,'The admitted official Shelby2202PDF is required.');
  const {capitalSourceWarehouse}=await import('../services/CapitalSourceWarehouse.js');
  const result=await capitalSourceWarehouse.archive(req.user!.id,req.params.sourceId,req.body,'application/pdf','Owner-uploaded original from the official public sale-book link; historical figures and visual corrections require review.');
  res.status(201).json({success:true,data:result});
 }catch(error){accessFailure(res,error);}
});
router.post('/warehouse/davidson-docket',async(req:AuthRequest,res)=>{try{const {saveDavidsonDocket}=await import('../services/DavidsonDocketEvidence.js');res.status(201).json({success:true,data:await saveDavidsonDocket(req.user!.id,req.body)});}catch(error){accessFailure(res,error);}});
router.get('/recovery-items',async(req:AuthRequest,res)=>{try{const {capitalRecoveryPipeline}=await import('../services/CapitalRecoveryPipeline.js');res.json({success:true,data:await capitalRecoveryPipeline.list(req.user!.id,Number(req.query.page||1))});}catch(error){accessFailure(res,error);}});
router.get('/recovery-items/:id',async(req:AuthRequest,res)=>{try{const {capitalRecoveryPipeline}=await import('../services/CapitalRecoveryPipeline.js');res.json({success:true,data:await capitalRecoveryPipeline.detail(req.user!.id,req.params.id)});}catch(error){accessFailure(res,error);}});
router.patch('/recovery-items/:id',async(req:AuthRequest,res)=>{try{const {capitalRecoveryPipeline}=await import('../services/CapitalRecoveryPipeline.js');res.json({success:true,data:await capitalRecoveryPipeline.update(req.user!.id,req.params.id,req.body)});}catch(error){accessFailure(res,error);}});
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
router.get('/warehouse/:snapshotId/records',async(req:AuthRequest,res)=>{try{await founder(req.user!.id);const page=Number(req.query.page||1);if(!Number.isSafeInteger(page)||page<1||page>100000)throw new AppError('Invalid page',400,'Invalid page.');if(!await prisma.capitalSourceSnapshot.findUnique({where:{id:req.params.snapshotId},select:{id:true}}))throw new AppError('Not found',404,'Source snapshot not found.');const where={snapshotId:req.params.snapshotId};const [records,total]=await Promise.all([prisma.capitalSourceRecord.findMany({where,orderBy:{sourceRecordId:'asc'},skip:(page-1)*100,take:100}),prisma.capitalSourceRecord.count({where})]);res.json({success:true,data:records,total,page});}catch(e){accessFailure(res,e);}});
router.post('/warehouse/records/:recordId/davidson-owner',async(req:AuthRequest,res)=>{try{const {researchDavidsonOwner}=await import('../services/DavidsonOwnerResearch.js');res.json({success:true,data:await researchDavidsonOwner(req.user!.id,req.params.recordId)});}catch(e){accessFailure(res,e);}});
router.get('/warehouse',async(req:AuthRequest,res)=>{try{const {capitalSourceWarehouse}=await import('../services/CapitalSourceWarehouse.js');res.json({success:true,data:await capitalSourceWarehouse.list(req.user!.id)});}catch(e){accessFailure(res,e);}});
router.post('/warehouse/sources/:sourceId/capture',async(req:AuthRequest,res)=>{try{const {capitalSourceWarehouse}=await import('../services/CapitalSourceWarehouse.js');res.status(201).json({success:true,data:await capitalSourceWarehouse.capture(req.user!.id,req.params.sourceId)});}catch(e){accessFailure(res,e);}});
router.post('/warehouse/:snapshotId/normalize',async(req:AuthRequest,res)=>{try{const {capitalSourceWarehouse}=await import('../services/CapitalSourceWarehouse.js');res.json({success:true,data:await capitalSourceWarehouse.normalize(req.user!.id,req.params.snapshotId)});}catch(e){accessFailure(res,e);}});
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
