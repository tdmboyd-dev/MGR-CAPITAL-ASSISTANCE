/**
 * Global Search Routes — MGR CAPITAL ASSISTANCE
 * Phase 20: AI-Enhanced Global Search API
 */

import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { globalSearchService } from "../services/GlobalSearchService.js";
import { CaseStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { currentActor } from "../services/CaseDocumentAccess.js";

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const searchQuerySchema = z.object({
  query: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  types: z.string().transform(value => value.split(',')).pipe(z.array(z.enum(['case', 'user', 'document', 'communication'])).min(1).max(4)).optional(),
  state: z.string().regex(/^[A-Z]{2}$/).optional(), status: z.nativeEnum(CaseStatus).optional(),
});

/**
 * GET /api/search/global
 * Perform global search across all entities
 */
router.get("/global", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid search query or filters' });
    const { query, limit, types, state, status } = parsed.data;

    const results = await globalSearchService.globalSearch({
      query,
      userId: req.user!.userId,
      userRole: req.user!.role,
      limit: limit ?? 50,
      types,
      state,
      status,
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
    const actor = await currentActor(prisma, req.user!.userId);
    if (actor.role !== "FOUNDER" || actor.tenantId !== null) return res.status(403).json({ success: false, error: "Global founder access required" });
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

    if (!query || typeof query !== "string" || query.trim().length < 2 || query.length > 200) {
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
            subtext: r.previousOwner || r.propertyAddress,
            link: `/cases/${r.id}`,
          };
        case "user":
          return {
            type: "user",
            text: r.name || r.email,
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
