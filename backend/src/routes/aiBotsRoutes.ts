// ============================================
// MGR CAPITAL ASSISTANCE — AI LEGAL BOTS ROUTES
// Endpoints for the AI Lawyer Firm
// ============================================

import express, { Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { aiLegalBotsService, LEGAL_BOTS } from "../services/AILegalBotsService.js";

const router = express.Router();

// All bot routes require authentication
router.use(authenticate);

/**
 * GET /api/ai-bots
 * Get all available AI legal bots
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bots = await aiLegalBotsService.getAllBots();
    res.json({
      success: true,
      data: bots,
      count: bots.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-bots/:botId
 * Get a specific bot by ID
 */
router.get("/:botId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const bot = await aiLegalBotsService.getBot(botId);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: "Bot not found",
      });
    }

    res.json({
      success: true,
      data: bot,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-bots/:botId/task
 * Execute a task with a specific bot
 */
router.post("/:botId/task", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { taskType, input } = req.body;
    const userId = (req as any).user?.id;

    if (!taskType) {
      return res.status(400).json({
        success: false,
        error: "taskType is required",
      });
    }

    const result = await aiLegalBotsService.executeTask(botId, taskType, input || {}, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/ai-bots/:botId/chat
 * Chat with a specific bot
 */
router.post("/:botId/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { message } = req.body;
    const userId = (req as any).user?.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }

    const response = await aiLegalBotsService.chat(botId, userId, message);

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/ai-bots/batch
 * Execute tasks across multiple bots
 * FOUNDER only
 */
router.post(
  "/batch",
  authorize(["FOUNDER"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tasks } = req.body;
      const userId = (req as any).user?.id;

      if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({
          success: false,
          error: "tasks array is required",
        });
      }

      const results = await Promise.all(
        tasks.map((task: any) =>
          aiLegalBotsService.executeTask(task.botId, task.taskType, task.input || {}, userId)
        )
      );

      res.json({
        success: true,
        data: results,
        completed: results.filter((r) => r.status === "completed").length,
        failed: results.filter((r) => r.status === "failed").length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai-bots/status/all
 * Get status of all bots
 */
router.get("/status/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bots = LEGAL_BOTS.map((bot) => ({
      id: bot.id,
      name: bot.name,
      status: bot.status,
      role: bot.role,
    }));

    res.json({
      success: true,
      data: bots,
      active: bots.filter((b) => b.status === "active").length,
      total: bots.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
