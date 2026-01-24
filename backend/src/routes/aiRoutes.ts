// ============================================
// MGR CAPITAL ASSISTANCE — AI ROUTES
// Phase 14: AI-Enhanced Search & Recommendations
// ============================================

import express, { Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { aiSearchService, SearchType } from "../services/AiSearchService.js";

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

export default router;
