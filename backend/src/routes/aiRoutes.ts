// ============================================
// MGR CAPITAL ASSISTANCE — AI ROUTES
// Phase 14: AI-Enhanced Search & Recommendations
// Phase 15: Advanced AI Agents
// ============================================

import express, { Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { aiSearchService, SearchType } from "../services/AiSearchService.js";
import { aiAgentService, AgentTask, AgentContext } from "../services/AiAgentService.js";

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

// ============================================
// SEARCH ENDPOINTS
// ============================================

/**
 * GET /api/ai/search
 * Semantic search across cases, documents, communications
 * Query params: query, type (cases|docs|comms|all), limit
 */
router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, type = "all", limit = "10" } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const searchType = type as SearchType;
    const validTypes: SearchType[] = ["cases", "docs", "comms", "all"];
    if (!validTypes.includes(searchType)) {
      return res.status(400).json({ error: "Invalid type. Use: cases, docs, comms, or all" });
    }

    const results = await aiSearchService.semanticSearch(
      query,
      searchType,
      parseInt(limit as string, 10) || 10
    );

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/search/suggestions
 * Get search suggestions based on partial query
 */
router.get("/search/suggestions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Simple keyword suggestions based on common terms
    const suggestions = await aiSearchService.getSearchSuggestions(query);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RECOMMENDATION ENDPOINTS
// ============================================

/**
 * GET /api/ai/recommendations/case/:caseId
 * Get AI recommendations for a specific case
 */
router.get("/recommendations/case/:caseId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      return res.status(400).json({ error: "Case ID required" });
    }

    const recommendations = await aiSearchService.getCaseRecommendations(caseId);
    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/recommendations/training/:employeeId
 * Get training recommendations for an employee
 */
router.get("/recommendations/training/:employeeId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID required" });
    }

    const recommendations = await aiSearchService.getTrainingRecommendations(employeeId);
    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/recommendations/my-training
 * Get training recommendations for current user
 */
router.get("/recommendations/my-training", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const recommendations = await aiSearchService.getTrainingRecommendations(userId);
    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STATUS ENDPOINT
// ============================================

/**
 * GET /api/ai/status
 * Check AI service availability
 */
router.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await aiSearchService.checkOllamaStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// ============================================
// EMBEDDING MANAGEMENT (FOUNDER ONLY)
// ============================================

/**
 * POST /api/ai/embeddings/rebuild
 * Rebuild embeddings for all searchable content
 * FOUNDER only - intensive operation
 */
router.post(
  "/embeddings/rebuild",
  authorize(["FOUNDER"]),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Trigger async rebuild
      res.json({
        status: "started",
        message: "Embedding rebuild initiated. This may take several minutes.",
      });

      // Run rebuild in background (non-blocking)
      setImmediate(async () => {
        try {
          await aiSearchService.rebuildAllEmbeddings();
          console.log("[AI] Embedding rebuild completed");
        } catch (error) {
          console.error("[AI] Embedding rebuild failed:", error);
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai/embeddings/stats
 * Get embedding statistics
 * FOUNDER only
 */
router.get(
  "/embeddings/stats",
  authorize(["FOUNDER"]),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await aiSearchService.getEmbeddingStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// AI AGENT ENDPOINTS (Phase 15)
// ============================================

/**
 * POST /api/ai/agent
 * Execute an AI agent task
 * Body: { task: AgentTask, context: AgentContext }
 */
router.post("/agent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { task, context } = req.body;

    if (!task) {
      return res.status(400).json({ error: "Task is required" });
    }

    const validTasks: AgentTask[] = [
      "outreach",
      "compliance",
      "research",
      "summary",
      "follow_up",
      "document_review",
    ];

    if (!validTasks.includes(task)) {
      return res.status(400).json({
        error: `Invalid task. Use: ${validTasks.join(", ")}`,
      });
    }

    const result = await aiAgentService.execute(task, context || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agent/outreach
 * Generate outreach email for a case
 * Body: { caseId: string, emailType: string }
 */
router.post("/agent/outreach", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId, emailType = "follow_up" } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: "Case ID is required" });
    }

    const email = await aiAgentService.generateOutreachEmail(caseId, emailType);
    res.json({ success: true, email });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agent/compliance
 * Check compliance for a case
 * Body: { caseId: string }
 */
router.post("/agent/compliance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: "Case ID is required" });
    }

    const result = await aiAgentService.checkCompliance(caseId);
    res.json({ success: true, compliance: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agent/summary
 * Generate case summary
 * Body: { caseId: string }
 */
router.post("/agent/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: "Case ID is required" });
    }

    const summary = await aiAgentService.generateCaseSummary(caseId);
    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agent/document-review
 * Review a document
 * Body: { documentId: string }
 */
router.post("/agent/document-review", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: "Document ID is required" });
    }

    const review = await aiAgentService.reviewDocument(documentId);
    res.json({ success: true, review });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/agent/continue
 * Continue a multi-turn conversation
 * Body: { conversationHistory: AgentMessage[], userMessage: string }
 */
router.post("/agent/continue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationHistory, userMessage } = req.body;

    if (!conversationHistory || !userMessage) {
      return res.status(400).json({ error: "Conversation history and user message required" });
    }

    const result = await aiAgentService.continueConversation(conversationHistory, userMessage);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/agent/status
 * Check AI agent status
 */
router.get("/agent/status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await aiAgentService.checkStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

export default router;
