/**
 * FeedbackService.ts — MGR CAPITAL ASSISTANCE
 * Phase 18: User Feedback Loop
 *
 * Handles user feedback collection, storage, and analysis.
 * Integrates with MetaBot for automated insights generation.
 */

import { PrismaClient, FeedbackCategory, OpsInsightPriority } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface FeedbackInput {
  userId: string;
  category?: FeedbackCategory;
  feature?: string;
  rating: number;
  comment?: string;
  pageUrl?: string;
  sessionContext?: Record<string, unknown>;
  aiResponseId?: string;
  userAgent?: string;
  ipAddress?: string;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  categoryBreakdown: Record<string, { count: number; avgRating: number }>;
  featureRatings: Array<{ feature: string; count: number; avgRating: number }>;
  recentTrend: "improving" | "declining" | "stable";
  unresolvedCount: number;
}

interface FeedbackAnalysis {
  period: string;
  stats: FeedbackStats;
  insights: FeedbackInsight[];
  recommendations: string[];
  topIssues: Array<{ issue: string; count: number; avgRating: number }>;
  topPraises: Array<{ praise: string; count: number }>;
}

interface FeedbackInsight {
  type: "low_rating" | "high_volume" | "declining_trend" | "feature_issue" | "praise";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendation: string;
  relatedFeature?: string;
}

// =============================================================================
// FEEDBACK SERVICE
// =============================================================================

class FeedbackService {
  /**
   * Submit user feedback
   */
  async submitFeedback(input: FeedbackInput): Promise<{ id: string; success: boolean }> {
    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: input.userId,
        category: input.category || "GENERAL",
        feature: input.feature,
        rating: input.rating,
        comment: input.comment,
        pageUrl: input.pageUrl,
        sessionContext: input.sessionContext as unknown as Record<string, unknown>,
        aiResponseId: input.aiResponseId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
    });

    // If rating is 1-2, create an alert for immediate attention
    if (input.rating <= 2) {
      await this.createLowRatingAlert(feedback);
    }

    return { id: feedback.id, success: true };
  }

  /**
   * Get all feedback with optional filters (FOUNDER only)
   */
  async getFeedbacks(options: {
    category?: FeedbackCategory;
    feature?: string;
    minRating?: number;
    maxRating?: number;
    isProcessed?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    feedbacks: Array<{
      id: string;
      userId: string;
      category: string;
      feature: string | null;
      rating: number;
      comment: string | null;
      pageUrl: string | null;
      isProcessed: boolean;
      adminResponse: string | null;
      createdAt: Date;
      user?: { name: string; email: string; role: string };
    }>;
    total: number;
    stats: { avgRating: number; totalCount: number };
  }> {
    const where: Record<string, unknown> = {};

    if (options.category) where.category = options.category;
    if (options.feature) where.feature = options.feature;
    if (options.isProcessed !== undefined) where.isProcessed = options.isProcessed;
    if (options.minRating || options.maxRating) {
      where.rating = {
        ...(options.minRating && { gte: options.minRating }),
        ...(options.maxRating && { lte: options.maxRating }),
      };
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      };
    }

    const [feedbacks, total, stats] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          // @ts-ignore - User relation not in schema but we add it
        },
        orderBy: { createdAt: "desc" },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.feedback.count({ where }),
      prisma.feedback.aggregate({
        where,
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    // Get user info separately
    const userIds = [...new Set(feedbacks.map((f) => f.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      feedbacks: feedbacks.map((f) => ({
        id: f.id,
        userId: f.userId,
        category: f.category,
        feature: f.feature,
        rating: f.rating,
        comment: f.comment,
        pageUrl: f.pageUrl,
        isProcessed: f.isProcessed,
        adminResponse: f.adminResponse,
        createdAt: f.createdAt,
        user: userMap.get(f.userId),
      })),
      total,
      stats: {
        avgRating: stats._avg.rating || 0,
        totalCount: stats._count.id || 0,
      },
    };
  }

  /**
   * Respond to feedback (FOUNDER/ADMIN)
   */
  async respondToFeedback(
    feedbackId: string,
    responderId: string,
    response: string
  ): Promise<{ success: boolean }> {
    await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        adminResponse: response,
        respondedAt: new Date(),
        respondedBy: responderId,
        isProcessed: true,
        processedAt: new Date(),
        processedBy: responderId,
      },
    });

    return { success: true };
  }

  /**
   * Get feedback statistics
   */
  async getStats(days: number = 30): Promise<FeedbackStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await prisma.feedback.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: "desc" },
    });

    const totalFeedback = feedbacks.length;
    if (totalFeedback === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryBreakdown: {},
        featureRatings: [],
        recentTrend: "stable",
        unresolvedCount: 0,
      };
    }

    // Average rating
    const avgRating =
      feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;

    // Rating distribution
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach((f) => ratingDist[f.rating]++);

    // Category breakdown
    const categoryMap: Record<string, { total: number; sum: number }> = {};
    feedbacks.forEach((f) => {
      if (!categoryMap[f.category]) {
        categoryMap[f.category] = { total: 0, sum: 0 };
      }
      categoryMap[f.category].total++;
      categoryMap[f.category].sum += f.rating;
    });
    const categoryBreakdown: Record<string, { count: number; avgRating: number }> = {};
    for (const [cat, data] of Object.entries(categoryMap)) {
      categoryBreakdown[cat] = {
        count: data.total,
        avgRating: Math.round((data.sum / data.total) * 10) / 10,
      };
    }

    // Feature ratings
    const featureMap: Record<string, { total: number; sum: number }> = {};
    feedbacks.forEach((f) => {
      if (f.feature) {
        if (!featureMap[f.feature]) {
          featureMap[f.feature] = { total: 0, sum: 0 };
        }
        featureMap[f.feature].total++;
        featureMap[f.feature].sum += f.rating;
      }
    });
    const featureRatings = Object.entries(featureMap)
      .map(([feature, data]) => ({
        feature,
        count: data.total,
        avgRating: Math.round((data.sum / data.total) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // Trend calculation (compare first half vs second half)
    const midpoint = Math.floor(feedbacks.length / 2);
    const recentHalf = feedbacks.slice(0, midpoint);
    const olderHalf = feedbacks.slice(midpoint);

    const recentAvg =
      recentHalf.length > 0
        ? recentHalf.reduce((sum, f) => sum + f.rating, 0) / recentHalf.length
        : 0;
    const olderAvg =
      olderHalf.length > 0
        ? olderHalf.reduce((sum, f) => sum + f.rating, 0) / olderHalf.length
        : 0;

    let recentTrend: "improving" | "declining" | "stable" = "stable";
    if (recentAvg > olderAvg + 0.3) recentTrend = "improving";
    else if (recentAvg < olderAvg - 0.3) recentTrend = "declining";

    // Unresolved count
    const unresolvedCount = feedbacks.filter((f) => !f.isProcessed).length;

    return {
      totalFeedback,
      averageRating: Math.round(avgRating * 10) / 10,
      ratingDistribution: ratingDist,
      categoryBreakdown,
      featureRatings,
      recentTrend,
      unresolvedCount,
    };
  }

  /**
   * Analyze feedback for MetaBot integration
   */
  async analyzeFeedback(days: number = 30): Promise<FeedbackAnalysis> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await prisma.feedback.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: "desc" },
    });

    const stats = await this.getStats(days);
    const insights: FeedbackInsight[] = [];
    const recommendations: string[] = [];

    // Analyze low ratings
    const lowRatings = feedbacks.filter((f) => f.rating <= 2);
    if (lowRatings.length > feedbacks.length * 0.2) {
      insights.push({
        type: "low_rating",
        severity: "critical",
        message: `${Math.round((lowRatings.length / feedbacks.length) * 100)}% of feedback has rating ≤2`,
        recommendation: "Investigate common complaints and prioritize fixes",
      });
    }

    // Analyze by feature
    for (const fr of stats.featureRatings) {
      if (fr.avgRating <= 2.5 && fr.count >= 3) {
        insights.push({
          type: "feature_issue",
          severity: fr.avgRating <= 2 ? "high" : "medium",
          message: `Feature "${fr.feature}" has ${fr.avgRating} average rating (${fr.count} reviews)`,
          recommendation: `Review and improve "${fr.feature}" based on user feedback`,
          relatedFeature: fr.feature,
        });
      }
    }

    // Trend analysis
    if (stats.recentTrend === "declining") {
      insights.push({
        type: "declining_trend",
        severity: "high",
        message: "User satisfaction is declining over time",
        recommendation: "Review recent changes and user complaints",
      });
    } else if (stats.recentTrend === "improving") {
      insights.push({
        type: "praise",
        severity: "low",
        message: "User satisfaction is improving over time",
        recommendation: "Continue current improvements, document what's working",
      });
    }

    // High volume category analysis
    for (const [cat, data] of Object.entries(stats.categoryBreakdown)) {
      if (data.count >= 10 && data.avgRating <= 3) {
        insights.push({
          type: "high_volume",
          severity: "high",
          message: `Category "${cat}" has ${data.count} feedbacks with ${data.avgRating} avg rating`,
          recommendation: `Focus on improving "${cat}" category`,
        });
      }
    }

    // Extract top issues from comments
    const lowRatingComments = feedbacks
      .filter((f) => f.rating <= 2 && f.comment)
      .map((f) => ({ comment: f.comment!, rating: f.rating, feature: f.feature }));

    const topIssues = this.extractTopIssues(lowRatingComments);

    // Extract top praises
    const highRatingComments = feedbacks
      .filter((f) => f.rating >= 4 && f.comment)
      .map((f) => f.comment!);

    const topPraises = this.extractTopPraises(highRatingComments);

    // Generate recommendations
    if (stats.averageRating < 3) {
      recommendations.push("URGENT: Overall satisfaction is low. Conduct user interviews.");
    }
    if (stats.unresolvedCount > 10) {
      recommendations.push(`${stats.unresolvedCount} feedbacks need response. Prioritize by rating.`);
    }
    for (const issue of topIssues.slice(0, 3)) {
      recommendations.push(`Address: "${issue.issue}" (${issue.count} mentions, ${issue.avgRating} avg rating)`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Feedback is positive. Continue monitoring and improving.");
    }

    // Sort insights by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      period: `Last ${days} days`,
      stats,
      insights,
      recommendations,
      topIssues,
      topPraises,
    };
  }

  /**
   * Create OpsInsight from feedback analysis (called by MetaBot)
   */
  async saveFeedbackInsight(analysis: FeedbackAnalysis): Promise<void> {
    const priority: OpsInsightPriority =
      analysis.stats.averageRating < 3
        ? "URGENT"
        : analysis.stats.averageRating < 3.5
        ? "HIGH"
        : "NORMAL";

    // Mark old feedback insights as stale
    await prisma.opsInsight.updateMany({
      where: {
        type: "FEEDBACK_ANALYSIS",
        isStale: false,
      },
      data: { isStale: true },
    });

    await prisma.opsInsight.create({
      data: {
        type: "FEEDBACK_ANALYSIS",
        priority,
        title: `User Feedback Report: ${analysis.stats.averageRating}/5 avg rating`,
        summary: `${analysis.stats.totalFeedback} feedbacks, ${analysis.stats.averageRating}/5 avg, trend: ${analysis.stats.recentTrend}`,
        details: analysis as unknown as Record<string, unknown>,
        plainEnglish: this.generatePlainEnglishReport(analysis),
        recommendations: analysis.recommendations,
        relatedCaseIds: [],
        relatedUserIds: [],
        relatedAlertIds: [],
        sourceBot: "metaBot",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async createLowRatingAlert(feedback: {
    id: string;
    userId: string;
    rating: number;
    comment: string | null;
    feature: string | null;
    category: string;
  }): Promise<void> {
    await prisma.opsInsight.create({
      data: {
        type: "LOW_RATING_ALERT",
        priority: feedback.rating === 1 ? "URGENT" : "HIGH",
        title: `Low Rating Alert: ${feedback.rating}/5 on ${feedback.feature || feedback.category}`,
        summary: feedback.comment?.slice(0, 200) || "No comment provided",
        details: {
          feedbackId: feedback.id,
          userId: feedback.userId,
          rating: feedback.rating,
          feature: feedback.feature,
          category: feedback.category,
        },
        plainEnglish: `User gave ${feedback.rating}/5 rating${
          feedback.feature ? ` for ${feedback.feature}` : ""
        }. ${feedback.comment ? `Comment: "${feedback.comment}"` : "No comment."}`,
        actionRequired: true,
        relatedCaseIds: [],
        relatedUserIds: [feedback.userId],
        relatedAlertIds: [],
        sourceBot: "feedbackService",
      },
    });
  }

  private extractTopIssues(
    comments: Array<{ comment: string; rating: number; feature: string | null }>
  ): Array<{ issue: string; count: number; avgRating: number }> {
    // Simple keyword extraction (in production, use NLP)
    const issueKeywords: Record<string, { count: number; totalRating: number }> = {};

    const keywords = [
      "slow", "crash", "bug", "error", "confusing", "hard", "broken",
      "loading", "unresponsive", "missing", "unclear", "difficult",
    ];

    for (const { comment, rating } of comments) {
      const lowerComment = comment.toLowerCase();
      for (const keyword of keywords) {
        if (lowerComment.includes(keyword)) {
          if (!issueKeywords[keyword]) {
            issueKeywords[keyword] = { count: 0, totalRating: 0 };
          }
          issueKeywords[keyword].count++;
          issueKeywords[keyword].totalRating += rating;
        }
      }
    }

    return Object.entries(issueKeywords)
      .map(([issue, data]) => ({
        issue,
        count: data.count,
        avgRating: Math.round((data.totalRating / data.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private extractTopPraises(comments: string[]): Array<{ praise: string; count: number }> {
    const praiseKeywords: Record<string, number> = {};

    const keywords = [
      "easy", "fast", "helpful", "great", "love", "excellent", "amazing",
      "intuitive", "simple", "clear", "useful", "perfect",
    ];

    for (const comment of comments) {
      const lowerComment = comment.toLowerCase();
      for (const keyword of keywords) {
        if (lowerComment.includes(keyword)) {
          praiseKeywords[keyword] = (praiseKeywords[keyword] || 0) + 1;
        }
      }
    }

    return Object.entries(praiseKeywords)
      .map(([praise, count]) => ({ praise, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private generatePlainEnglishReport(analysis: FeedbackAnalysis): string {
    const sections: string[] = [];

    sections.push(`**User Feedback Report** (${analysis.period})\n`);
    sections.push(`Total Feedbacks: **${analysis.stats.totalFeedback}**`);
    sections.push(`Average Rating: **${analysis.stats.averageRating}/5**`);
    sections.push(`Trend: **${analysis.stats.recentTrend}**`);
    sections.push(`Unresolved: **${analysis.stats.unresolvedCount}**\n`);

    sections.push("**Rating Distribution:**");
    for (let i = 5; i >= 1; i--) {
      const count = analysis.stats.ratingDistribution[i];
      const bar = "█".repeat(Math.min(count, 20));
      sections.push(`${i}★: ${bar} ${count}`);
    }

    if (analysis.insights.length > 0) {
      sections.push("\n**Key Insights:**");
      for (const insight of analysis.insights.slice(0, 5)) {
        const icon =
          insight.severity === "critical" ? "🔴" :
          insight.severity === "high" ? "🟠" :
          insight.severity === "medium" ? "🟡" : "🟢";
        sections.push(`${icon} ${insight.message}`);
      }
    }

    if (analysis.topIssues.length > 0) {
      sections.push("\n**Top Issues:**");
      for (const issue of analysis.topIssues.slice(0, 5)) {
        sections.push(`- "${issue.issue}": ${issue.count} mentions (${issue.avgRating} avg rating)`);
      }
    }

    if (analysis.recommendations.length > 0) {
      sections.push("\n**Recommendations:**");
      for (const rec of analysis.recommendations) {
        sections.push(`- ${rec}`);
      }
    }

    return sections.join("\n");
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
