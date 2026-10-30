import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { currentActor, accessFailure } from '../services/CaseDocumentAccess.js';
import { opsMetricsService } from '../services/OpsMetricsService.js';

const router = Router();
router.use(authMiddleware);
router.get('/', async (req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const actor = await currentActor(prisma, req.user!.id);
    if (actor.role !== 'FOUNDER' || actor.tenantId !== null) return res.status(403).json({success:false,error:'Global founder insights access required'});
    const raw = req.query.limit ?? '10';
    if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw) || Number(raw)<1 || Number(raw)>100) return res.status(400).json({success:false,error:'limit must be an integer from 1 to 100'});
    if (req.query.isRead !== undefined && req.query.isRead !== 'false') return res.status(400).json({success:false,error:'Only the undismissed focus feed is supported; isRead=false or omit it'});
    const feed = await opsMetricsService.getFounderFocusFeed(Number(raw));
    const data = feed.items.map(item => ({id:item.id,type:item.type,priority:item.priority>=8?'HIGH':item.priority>=5?'MEDIUM':'LOW',severity:item.priority>=8?'HIGH':item.priority>=5?'MEDIUM':'LOW',priorityScore:item.priority,title:item.title,message:item.summary,isRead:false,createdAt:item.createdAt,link:item.relatedCaseId?`/founder/cases/${encodeURIComponent(item.relatedCaseId)}`:null}));
    return res.json({success:true,data,insights:data,count:feed.unreadCount,meaning:'Undismissed founder focus items; not per-user read receipts'});
  } catch(error) { return accessFailure(res,error,'Insights unavailable'); }
});
export default router;
