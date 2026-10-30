import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware.js';
import { currentActor, accessFailure } from '../services/CaseDocumentAccess.js';
import prisma from '../lib/prisma.js';
import { legalAuditorService } from '../services/LegalAuditorService.js';

const router = Router();
router.use(authMiddleware, (req: AuthRequest, res, next) => {
  res.setHeader('Cache-Control','private, no-store');
  void currentActor(prisma,req.user!.id).then(actor => {
    if (actor.role !== 'FOUNDER' || actor.tenantId !== null) return res.status(403).json({success:false,error:'Global founder document review access required'});
    next();
  }).catch(error=>accessFailure(res,error,'Document review authority unavailable'));
});

/**
 * POST /api/legal-audit/audit
 * Audit a legal document for compliance
 */
router.post('/audit', async (req: Request, res: Response) => {
  try {
    const { docText, state, type } = req.body;

    if (!docText || !state || !type) {
      return res.status(400).json({
        error: 'Missing required fields: docText, state, type'
      });
    }

    const result = await legalAuditorService.auditDocument(docText, state, type);

    res.json(result);
  } catch (error) {
    return accessFailure(res,error,'Document review unavailable');
  }
});

/**
 * GET /api/legal-audit/requirements/:state/:type
 * Get document requirements for a state and document type
 */
router.get('/requirements/:state/:type', async (req: Request, res: Response) => {
  try {
    const { state, type } = req.params;

    const requirements = legalAuditorService.getTemplateRequirements(state, type);

    res.json({
      state,
      type,
      requirements,
      status: "GENERIC_CHECKLIST_UNVERIFIED",
      warning: "Preparation checklist only; no state or county legal qualification"
    });
  } catch (error) {
    console.error('Requirements error:', error);
    res.status(500).json({ error: 'Failed to get requirements' });
  }
});

/**
 * POST /api/legal-audit/batch-audit
 * Audit multiple documents at once
 */
router.post('/batch-audit', async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length < 1 || documents.length > 5 || documents.some(doc => !doc || typeof doc.text !== "string" || typeof doc.state !== "string" || typeof doc.type !== "string")) {
      return res.status(400).json({
        error: 'Documents array required'
      });
    }

    const results = await legalAuditorService.batchAudit(documents);

    res.json({
      count: results.length,
      results
    });
  } catch (error) {
    return accessFailure(res,error,'Batch document review unavailable');
  }
});

export default router;
