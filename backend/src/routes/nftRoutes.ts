import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
const router=Router();
router.use(authenticate);
router.use((_req,res)=>{res.setHeader('Cache-Control','private, no-store');res.status(503).json({success:false,code:'NFT_WORKFLOW_UNQUALIFIED',error:'Claim tokenization is unavailable. Prior mint addresses, metadata links and transfer/burn receipts were simulations, not verified chain transactions or claim rights.'});});
export default router;
