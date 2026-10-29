/**
 * Phone Bot Routes — MGR CAPITAL ASSISTANCE
 * AI Phone Bot with Telnyx + DeepSeek/Google AI
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { phoneBotService } from '../services/PhoneBotService.js';
import { logger } from '../utils/logger.js';

const router = Router();
for (const callback of ['/webhook', '/process-speech', '/status', '/recording']) router.post(callback, (_req, res) => {
  res.status(503).json({ success: false, error: 'Phone callbacks unavailable pending authenticated provider event and call ownership integration.' });
});
router.use(authenticate, async (req: any, res, next) => {
  try {
    const { currentActor } = await import('../services/CaseDocumentAccess.js');
    const { default: db } = await import('../lib/prisma.js');
    const actor = await currentActor(db, req.user.id);
    if (actor.role !== 'FOUNDER' || actor.tenantId !== null) return res.status(403).json({ error: 'Global founder phone access required' });
    next();
  } catch { res.status(503).json({ error: 'Phone authority unavailable' }); }
});
router.post('/end/:callSid', (_req, res) => res.status(503).json({ success: false, error: 'Call termination integration unavailable. No call was ended.' }));


/**
 * POST /api/phone/start
 * Start an outbound call
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    const { to, script, caseId } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing phone number' });
    }

    const result = await phoneBotService.startCall(to, script || 'initial_outreach', caseId);

    if (!result.success) {
      return res.status(503).json({ error: result.error });
    }

    res.json({ success: true, callSid: result.callSid });
  } catch (error: any) {
    logger.error('Phone call start failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/phone/logs
 * Get call history
 */
router.get('/logs', authenticate, async (req, res) => {
  try {
    const caseId = req.query.caseId as string | undefined;

    if (caseId) {
      const logs = await phoneBotService.getCallLogs(caseId);
      return res.json({ success: true, data: logs });
    }

    // Return all recent calls
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await phoneBotService.getAllRecentCalls(limit);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    logger.error('Call logs fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/phone/scripts
 * Get available call scripts
 */
router.get('/scripts', authenticate, async (_req, res) => {
  const scripts = phoneBotService.getScripts();
  res.json({ success: true, data: scripts });
});

/**
 * GET /api/phone/status
 * Get service status (demo mode, providers)
 */
router.get('/service-status', authenticate, async (_req, res) => {
  const status = phoneBotService.getStatus();
  res.json({ success: true, data: status });
});

/**
 * POST /api/phone/schedule
 * Schedule a follow-up call
 */
router.post('/schedule', authenticate, async (req, res) => {
  try {
    const { caseId, phoneNumber, scheduledAt } = req.body;

    if (!caseId || !phoneNumber || !scheduledAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const success = await phoneBotService.scheduleFollowUp(
      caseId,
      phoneNumber,
      new Date(scheduledAt)
    );

    if (!success) {
      return res.status(500).json({ error: 'Failed to schedule follow-up' });
    }

    res.json({ success: true, message: 'Follow-up scheduled' });
  } catch (error: any) {
    logger.error('Schedule follow-up failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
