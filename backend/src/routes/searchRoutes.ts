/**
 * Global Search Routes — MGR CAPITAL ASSISTANCE
 * Phase 20: AI-Enhanced Global Search API
 */

import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { globalSearchService } from "../services/GlobalSearchService";
import { CaseStatus } from "@prisma/client";

const router = Router();

/**
 * GET /api/search/global
 * Perform global search across all entities
 */
router.get("/global", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { query, limit, types, state, status } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required",
      });
    }

    const results = await globalSearchService.globalSearch({
      query,
      userId: req.user!.userId,
      userRole: req.user!.role,
      limit: limit ? parseInt(limit as string, 10) : 50,
      types: types ? (types as string).split(",") as any : undefined,
      state: state as string | undefined,
      status: status as CaseStatus | undefined,
    });

    return res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Global search error:", error);
    return res.status(500).json({
      success: false,
      error: "Search failed",
    });
  }
});

/**
 * GET /api/search/recent
 * Get user's recent searches
 */
router.get("/recent", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const searches = await globalSearchService.getRecentSearches(req.user!.userId);

    return res.json({
      success: true,
      searches,
    });
  } catch (error) {
    console.error("Recent searches error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get recent searches",
    });
  }
});

/**
 * GET /api/search/popular
 * Get popular searches (anonymized)
 */
router.get("/popular", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const searches = await globalSearchService.getPopularSearches();

    return res.json({
      success: true,
      searches,
    });
  } catch (error) {
    console.error("Popular searches error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get popular searches",
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions as user types
 */
router.get("/suggestions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.length < 2) {
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    // Quick search with low limit for suggestions
    const results = await globalSearchService.globalSearch({
      query,
      userId: req.user!.userId,
      userRole: req.user!.role,
      limit: 5,
    });

    // Format as suggestions
    const suggestions = results.results.map((r) => {
      switch (r.type) {
        case "case":
          return {
            type: "case",
            text: r.caseCode,
            subtext: r.ownerName || r.propertyAddress,
            link: `/cases/${r.id}`,
          };
        case "user":
          return {
            type: "user",
            text: `${r.firstName || ""} ${r.lastName || ""}`.trim() || r.email,
            subtext: r.role,
            link: `/users/${r.id}`,
          };
        case "document":
          return {
            type: "document",
            text: r.fileName,
            subtext: `Case: ${r.caseCode}`,
            link: `/cases/${r.caseId}/documents/${r.id}`,
          };
        case "communication":
          return {
            type: "communication",
            text: r.subject || "Communication",
            subtext: `Case: ${r.caseCode}`,
            link: `/cases/${r.caseId}/communications`,
          };
        default:
          return null;
      }
    }).filter(Boolean);

    return res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get suggestions",
    });
  }
});

export default router;
