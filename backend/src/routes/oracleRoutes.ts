import { Router, Request, Response } from 'express';
import { oracleService } from '../services/OracleService.js';

const router = Router();

/**
 * GET /api/oracle/state/:state
 * Get state law deadline from oracle
 */
router.get('/state/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;

    const lawUpdate = await oracleService.getStateLawUpdate(state);

    res.json(lawUpdate);
  } catch (error) {
    console.error('Oracle state error:', error);
    res.status(500).json({ error: 'Failed to get state law' });
  }
});

/**
 * GET /api/oracle/all-states
 * Get all state deadlines
 */
router.get('/all-states', async (req: Request, res: Response) => {
  try {
    const deadlines = await oracleService.getAllStateDeadlines();

    res.json({
      count: deadlines.length,
      states: deadlines
    });
  } catch (error) {
    console.error('Oracle all states error:', error);
    res.status(500).json({ error: 'Failed to get all state laws' });
  }
});

/**
 * GET /api/oracle/recent-changes
 * Get recent law changes
 */
router.get('/recent-changes', async (req: Request, res: Response) => {
  try {
    const daysBack = parseInt(req.query.days as string) || 90;

    const changes = await oracleService.getRecentChanges(daysBack);

    res.json({
      period: `Last ${daysBack} days`,
      count: changes.length,
      changes
    });
  } catch (error) {
    console.error('Oracle recent changes error:', error);
    res.status(500).json({ error: 'Failed to get recent changes' });
  }
});

/**
 * POST /api/oracle/verify-deadline
 * Verify a deadline against oracle data
 */
router.post('/verify-deadline', async (req: Request, res: Response) => {
  try {
    const { state, deadlineDate } = req.body;

    if (!state || !deadlineDate) {
      return res.status(400).json({
        error: 'Missing required fields: state, deadlineDate'
      });
    }

    const result = await oracleService.verifyDeadline(
      state,
      new Date(deadlineDate)
    );

    res.json(result);
  } catch (error) {
    console.error('Oracle verify error:', error);
    res.status(500).json({ error: 'Failed to verify deadline' });
  }
});

/**
 * POST /api/oracle/subscribe
 * Subscribe to state law changes (stub)
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { states, webhookUrl } = req.body;

    if (!states || !Array.isArray(states)) {
      return res.status(400).json({
        error: 'states array required'
      });
    }

    const subscriptionId = await oracleService.subscribeToChanges(
      states,
      (update) => {
        console.log('Law update received:', update);
        // In production, this would call the webhook
      }
    );

    res.json({
      subscriptionId,
      states,
      message: 'Subscription created (stub - real implementation needs Chainlink setup)'
    });
  } catch (error) {
    console.error('Oracle subscribe error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

export default router;
