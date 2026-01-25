import { Router, Request, Response } from 'express';
import { legalAuditorService } from '../services/LegalAuditorService.js';

const router = Router();

/**
 * POST /api/legal/audit
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
    console.error('Legal audit error:', error);
    res.status(500).json({ error: 'Failed to audit document' });
  }
});

/**
 * GET /api/legal/requirements/:state/:type
 * Get document requirements for a state and document type
 */
router.get('/requirements/:state/:type', async (req: Request, res: Response) => {
  try {
    const { state, type } = req.params;

    const requirements = legalAuditorService.getTemplateRequirements(state, type);

    res.json({
      state,
      type,
      requirements
    });
  } catch (error) {
    console.error('Requirements error:', error);
    res.status(500).json({ error: 'Failed to get requirements' });
  }
});

/**
 * POST /api/legal/batch-audit
 * Audit multiple documents at once
 */
router.post('/batch-audit', async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
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
    console.error('Batch audit error:', error);
    res.status(500).json({ error: 'Failed to batch audit documents' });
  }
});

export default router;
