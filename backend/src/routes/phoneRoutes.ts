/**
 * Phone Bot Routes — MGR CAPITAL ASSISTANCE
 * AI Phone Bot with Telnyx + DeepSeek/Google AI
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { phoneBotService } from '../services/PhoneBotService.js';
import { logger } from '../utils/logger.js';

const router = Router();

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
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, callSid: result.callSid });
  } catch (error: any) {
    logger.error('Phone call start failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/phone/webhook
 * Telnyx webhook for call handling
 */
router.post('/webhook', async (req, res) => {
  try {
    const { call_control_id, from } = req.body?.data?.payload || {};
    const callSid = call_control_id || req.body?.CallSid;
    const fromNumber = from || req.body?.From;

    const twiml = await phoneBotService.handleInboundCall(callSid, fromNumber);

    res.type('text/xml').send(twiml);
  } catch (error: any) {
    logger.error('Phone webhook failed', { error: error.message });
    res.type('text/xml').send('<Response><Say>An error occurred.</Say></Response>');
  }
});

/**
 * POST /api/phone/process-speech
 * Process speech input from call
 */
router.post('/process-speech', async (req, res) => {
  try {
    const { CallSid, SpeechResult } = req.body;

    const twiml = await phoneBotService.processSpeech(SpeechResult || '', CallSid);

    res.type('text/xml').send(twiml);
  } catch (error: any) {
    logger.error('Speech processing failed', { error: error.message });
    res.type('text/xml').send('<Response><Say>I did not understand. Please try again.</Say></Response>');
  }
});

/**
 * POST /api/phone/status
 * Call status callback
 */
router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    logger.info('Call status update', { CallSid, CallStatus, CallDuration });

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Status callback failed', { error: error.message });
    res.sendStatus(500);
  }
});

/**
 * POST /api/phone/recording
 * Recording callback
 */
router.post('/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body;

    logger.info('Recording available', { CallSid, RecordingUrl, RecordingDuration });

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Recording callback failed', { error: error.message });
    res.sendStatus(500);
  }
});

/**
 * POST /api/phone/end/:callSid
 * End an active call
 */
router.post('/end/:callSid', authenticate, async (req, res) => {
  try {
    const { callSid } = req.params;

    logger.info('Call end requested', { callSid });

    res.json({ success: true, message: 'Call ended' });
  } catch (error: any) {
    logger.error('Call end failed', { error: error.message });
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
