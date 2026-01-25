/**
 * Genealogy Routes — MGR CAPITAL ASSISTANCE
 * AI Heir Genealogy Tree API
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { heirGenealogyService } from '../services/HeirGenealogyService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/genealogy/generate
 * Generate a new genealogy tree for a case
 */
router.post('/generate', authenticate, async (req, res) => {
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
router.get('/:treeId', authenticate, async (req, res) => {
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
router.get('/:treeId/visualization', authenticate, async (req, res) => {
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
router.post('/:treeId/member', authenticate, async (req, res) => {
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
router.put('/:treeId/member/:memberId/skip-trace', authenticate, async (req, res) => {
  try {
    const { treeId, memberId } = req.params;
    const { skipTraceResult } = req.body;

    if (!skipTraceResult) {
      return res.status(400).json({ error: 'Missing skipTraceResult' });
    }

    const member = await heirGenealogyService.updateMemberFromSkipTrace(
      treeId,
      memberId,
      skipTraceResult
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ success: true, data: member });
  } catch (error: any) {
    logger.error('Skip trace update failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/genealogy/:treeId/calculate-distribution
 * Calculate heir distribution percentages
 */
router.post('/:treeId/calculate-distribution', authenticate, async (req, res) => {
  try {
    const { treeId } = req.params;

    const distribution = await heirGenealogyService.calculateHeirDistribution(treeId);

    res.json({ success: true, data: distribution });
  } catch (error: any) {
    logger.error('Distribution calculation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/genealogy/:treeId/export-pdf
 * Export genealogy tree to PDF
 */
router.get('/:treeId/export-pdf', authenticate, async (req, res) => {
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
router.get('/case/:caseId', authenticate, async (req, res) => {
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
router.delete('/:treeId', authenticate, async (req, res) => {
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
