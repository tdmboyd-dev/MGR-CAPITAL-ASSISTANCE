import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware.js';
import { capitalEmailOutbox } from '../services/CapitalEmailOutbox.js';
import { accessFailure } from '../services/CaseDocumentAccess.js';
const router = Router();router.use(authMiddleware);router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
router.get('/jobs',async(req:AuthRequest,res)=>{try{res.json({success:true,data:await capitalEmailOutbox.list(req.user!.id)});}catch(error){accessFailure(res,error,'Email queue unavailable');}});
router.post('/jobs',async(req:AuthRequest,res)=>{try{const row=await capitalEmailOutbox.enqueue(req.user!.id,req.get('Idempotency-Key') || '',req.body);res.status(201).json({success:true,data:{id:row.id,status:row.status,acceptedAt:row.acceptedAt}});}catch(error){accessFailure(res,error,'Email was not queued');}});
router.post('/jobs/:id/dispatch',async(req:AuthRequest,res)=>{try{res.json({success:true,data:await capitalEmailOutbox.dispatch(req.user!.id,req.params.id)});}catch(error){accessFailure(res,error,'Email attempt was not confirmed');}});
export default router;
