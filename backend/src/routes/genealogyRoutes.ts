/**
 * Genealogy Routes — MGR CAPITAL ASSISTANCE
 * AI Heir Genealogy Tree API
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { heirGenealogyService } from '../services/HeirGenealogyService.js';
import { skipTraceService } from '../services/SkipTraceService.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticate);
router.use(roleGuard(["ADMIN"]));

/**
 * GET /api/genealogy
 * List recent genealogy research trees for founder/admin review.
 */
router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const trees = await heirGenealogyService.listAllTrees(limit);
    return res.json({ success: true, data: trees });
  } catch (error: any) {
    logger.error('Genealogy list failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/genealogy/generate
 * Generate a new genealogy tree for a case
 */
router.post('/generate', async (req, res) => {
  try {
    const { caseId, decedentName, deathDate, lastKnownAddress, state, knownRelatives } = req.body;

    if (!caseId || !decedentName || !state) {
      return res.status(400).json({
        error: 'Missing required fields: caseId, decedentName, state',
      });
    }

    const tree = await heirGenealogyService.generateGenealogyTree(caseId, {
      name: decedentName,
      deathDate: deathDate ? new Date(deathDate) : undefined,
      lastKnownAddress,
      state,
      knownRelatives,
    });

    res.status(201).json({ success: true, data: tree });
  } catch (error: any) {
    logger.error('Genealogy generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/genealogy/:treeId
 * Get genealogy tree details
 */
router.get('/:treeId', async (req, res) => {
  try {
    const { treeId } = req.params;

    const tree = await heirGenealogyService.getTree(treeId);

    if (!tree) {
      return res.status(404).json({ error: 'Tree not found' });
    }

    res.json({ success: true, data: tree });
  } catch (error: any) {
    logger.error('Genealogy fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/genealogy/:treeId/visualization
 * Get D3.js visualization data
 */
router.get('/:treeId/visualization', async (req, res) => {
  try {
    const { treeId } = req.params;

    const vizData = await heirGenealogyService.getTreeForVisualization(treeId);

    if (!vizData) {
      return res.status(404).json({ error: 'Tree not found' });
    }

    res.json({ success: true, data: vizData });
  } catch (error: any) {
    logger.error('Visualization data fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/genealogy/:treeId/member
 * Add family member to tree
 */
router.post('/:treeId/member', async (req, res) => {
  try {
    const { treeId } = req.params;
    const { parentId, name, relationship, isDeceased, isHeir, heirPriority, notes } = req.body;

    if (!parentId || !name || !relationship) {
      return res.status(400).json({
        error: 'Missing required fields: parentId, name, relationship',
      });
    }

    const member = await heirGenealogyService.addFamilyMember(treeId, parentId, {
      name,
      relationship,
      isDeceased: isDeceased || false,
      isHeir: isHeir || false,
      heirPriority,
      spouses: [],
      skipTraceStatus: 'not_traced',
      notes,
    });

    res.status(201).json({ success: true, data: member });
  } catch (error: any) {
    logger.error('Add family member failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/genealogy/:treeId/member/:memberId/skip-trace
 * Update member with skip trace results
 */
router.post('/:treeId/member/:memberId/skip-trace', async (req, res) => {
  try {
    const { treeId, memberId } = req.params;
    const member = await heirGenealogyService.getMember(treeId, memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const parts = member.name.trim().split(/\s+/);
    if (parts.length < 2) {
      return res.status(422).json({
        error: 'A first and last name are required before provider-backed skip tracing',
      });
    }

    const result = await skipTraceService.tracePerson({
      firstName: parts[0],
      lastName: parts[parts.length - 1],
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
      address: member.contactInfo?.address,
    });

    if (result.status === 'error') {
      return res.status(503).json({
        error: 'Skip trace provider is unavailable or returned an error',
      });
    }

    const updated = await heirGenealogyService.updateMemberFromSkipTrace(
      treeId,
      memberId,
      {
        name: member.name,
        phones: result.phones.map((p) => p.number),
        emails: result.emails.map((e) => e.address),
        addresses: result.addresses.map((a) =>
          [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ')
        ),
        relatives: result.relatives.map((r) =>
          [r.firstName, r.lastName].filter(Boolean).join(' ')
        ),
        deceased: result.person?.isDeceased,
      }
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Skip trace update failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/genealogy/:treeId/calculate-distribution
 * Calculate heir distribution percentages
 */
router.post('/:treeId/calculate-distribution', async (_req, res) => {
  return res.status(409).json({
    success: false,
    error:
      'Automatic heir-share calculation is disabled. Record a source-backed legal determination and review before storing any distribution.',
  });
});

/**
 * GET /api/genealogy/:treeId/export-pdf
 * Export genealogy tree to PDF
 */
router.get('/:treeId/export-pdf', async (req, res) => {
  try {
    const { treeId } = req.params;

    const pdfBuffer = await heirGenealogyService.exportToPDF(treeId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="heir-genealogy-${treeId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('PDF export failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/genealogy/case/:caseId
 * List all genealogy trees for a case
 */
router.get('/case/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    const trees = await heirGenealogyService.listTrees(caseId);

    res.json({ success: true, data: trees });
  } catch (error: any) {
    logger.error('List trees failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/genealogy/:treeId
 * Delete a genealogy tree
 */
router.delete('/:treeId', async (req, res) => {
  try {
    const { treeId } = req.params;

    const deleted = await heirGenealogyService.deleteTree(treeId);

    if (!deleted) {
      return res.status(404).json({ error: 'Tree not found' });
    }

    res.json({ success: true, message: 'Tree deleted' });
  } catch (error: any) {
    logger.error('Delete tree failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
