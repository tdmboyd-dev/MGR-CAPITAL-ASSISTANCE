/**
 * feedbackRoutes.ts — MGR CAPITAL ASSISTANCE
 * Phase 18: User Feedback Loop
 *
 * API endpoints for feedback submission and management.
 */

import express from "express";
import { authenticate, roleGuard } from "../middleware/authMiddleware.js";
import { feedbackService } from "../services/FeedbackService.js";

// Define FeedbackCategory locally if not in Prisma schema
type FeedbackCategory = "BUG" | "FEATURE" | "IMPROVEMENT" | "QUESTION" | "OTHER";
const FeedbackCategoryValues: FeedbackCategory[] = ["BUG", "FEATURE", "IMPROVEMENT", "QUESTION", "OTHER"];

const router = express.Router();

// =============================================================================
// PUBLIC ENDPOINTS (Authenticated users)
// =============================================================================

/**
 * POST /api/feedback/submit
 * Submit user feedback
 */
router.post("/submit", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      category,
      feature,
      rating,
      comment,
      pageUrl,
      sessionContext,
      aiResponseId,
    } = req.body;

    // Validate required fields
    if (!rating || typeof rating !== "number") {
      return res.status(400).json({ error: "Rating is required and must be a number" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Validate category if provided
    if (category && !FeedbackCategoryValues.includes(category)) {
      return res.status(400).json({ error: "Invalid feedback category" });
    }

    const result = await feedbackService.submitFeedback({
      userId,
      category: category as FeedbackCategory,
      feature,
      rating,
      comment,
      pageUrl,
      sessionContext,
      aiResponseId,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

/**
 * GET /api/feedback/my
 * Get current user's feedback history
 */
router.get("/my", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await feedbackService.getFeedbacks({
      limit,
      offset,
    });

    // Filter to only user's feedback
    const userFeedbacks = result.feedbacks.filter((f) => f.userId === userId);

    res.json({
      feedbacks: userFeedbacks,
      total: userFeedbacks.length,
    });
  } catch (error) {
    console.error("Get user feedback error:", error);
    res.status(500).json({ error: "Failed to get feedback" });
  }
});

// =============================================================================
// FOUNDER/ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /api/feedback
 * Get all feedback (FOUNDER/ADMIN only)
 */
router.get("/", authenticate, roleGuard(["FOUNDER", "ADMIN"]), async (req, res) => {
  try {
    const {
      category,
      feature,
      minRating,
      maxRating,
      isProcessed,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const result = await feedbackService.getFeedbacks({
      category: category as FeedbackCategory,
      feature: feature as string,
      minRating: minRating ? parseInt(minRating as string) : undefined,
      maxRating: maxRating ? parseInt(maxRating as string) : undefined,
      isProcessed: isProcessed ? isProcessed === "true" : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json(result);
  } catch (error) {
    console.error("Get all feedback error:", error);
    res.status(500).json({ error: "Failed to get feedback" });
  }
});

/**
 * GET /api/feedback/stats
 * Get feedback statistics (FOUNDER/ADMIN only)
 */
router.get("/stats", authenticate, roleGuard(["FOUNDER", "ADMIN"]), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await feedbackService.getStats(days);
    res.json(stats);
  } catch (error) {
    console.error("Get feedback stats error:", error);
    res.status(500).json({ error: "Failed to get feedback statistics" });
  }
});

/**
 * GET /api/feedback/analysis
 * Get feedback analysis for insights (FOUNDER only)
 */
router.get("/analysis", authenticate, roleGuard(["FOUNDER"]), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analysis = await feedbackService.analyzeFeedback(days);
    res.json(analysis);
  } catch (error) {
    console.error("Get feedback analysis error:", error);
    res.status(500).json({ error: "Failed to analyze feedback" });
  }
});

/**
 * PATCH /api/feedback/:id/respond
 * Respond to feedback (FOUNDER/ADMIN only)
 */
router.patch(
  "/:id/respond",
  authenticate,
  roleGuard(["FOUNDER", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      const responderId = req.user.id;

      if (!response) {
        return res.status(400).json({ error: "Response is required" });
      }

      const result = await feedbackService.respondToFeedback(id, responderId, response);
      res.json(result);
    } catch (error) {
      console.error("Respond to feedback error:", error);
      res.status(500).json({ error: "Failed to respond to feedback" });
    }
  }
);

/**
 * GET /api/feedback/categories
 * Get available feedback categories
 */
router.get("/categories", authenticate, (_req, res) => {
  res.json({
    categories: FeedbackCategoryValues.map((cat) => ({
      value: cat,
      label: cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()),
    })),
  });
});

export default router;
