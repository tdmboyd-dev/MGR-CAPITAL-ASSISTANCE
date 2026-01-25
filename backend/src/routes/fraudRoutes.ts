/**
 * Fraud Detection Routes — MGR CAPITAL ASSISTANCE
 * AI Fraud Detection API
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { fraudDetectionService } from '../services/FraudDetectionService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/fraud/score
 * Score a transaction for fraud risk
 */
router.post('/score', authenticate, async (req, res) => {
  try {
    const { amount, userId, ip, deviceId, paymentMethod } = req.body;

    if (!amount || !userId || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields: amount, userId, paymentMethod',
      });
    }

    const score = await fraudDetectionService.scoreTransaction({
      amount,
      userId,
      ip,
      deviceId,
      paymentMethod,
    });

    res.json({ success: true, data: score });
  } catch (error: any) {
    logger.error('Fraud scoring failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fraud/metrics
 * Get fraud model performance metrics
 */
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const metrics = await fraudDetectionService.getModelMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error('Get fraud metrics failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fraud/train
 * Train model on new fraud data
 */
router.post('/train', authenticate, async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Missing transactions array' });
    }

    await fraudDetectionService.trainOnNewData(transactions);

    res.json({ success: true, message: 'Model training initiated' });
  } catch (error: any) {
    logger.error('Fraud training failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
