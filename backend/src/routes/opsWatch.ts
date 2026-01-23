// ============================================
// OPS WATCH ROUTES — MGR CAPITAL ASSISTANCE
// FOUNDER ONLY — All routes require FOUNDER role
// Scraper control, alert management, and system monitoring
// ============================================

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { scraperService } from "../services/scraperService.js";
import { watchService } from "../services/watchService.js";
import { getParserHealth } from "../services/parserService.js";
import { ScrapedItemType, ScrapedItemReviewStatus, WatchAlertType, WatchAlertSeverity } from "@prisma/client";

const router = Router();

// All routes require authentication + FOUNDER role
router.use(authMiddleware);
router.use(roleGuard(["FOUNDER"]));

// ============================================
// SCRAPER CONTROL
// ============================================

/**
 * GET /api/ops/watch/scraper/configs
 * Get all scraper configurations
 */
router.get("/scraper/configs", async (req: Request, res: Response) => {
  try {
    const configs = await scraperService.getConfigurations();
    res.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("Scraper configs error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch scraper configurations"
    });
  }
});

/**
 * GET /api/ops/watch/scraper/stats
 * Get scraper statistics
 */
router.get("/scraper/stats", async (req: Request, res: Response) => {
  try {
    const stats = await scraperService.getScraperStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Scraper stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch scraper statistics"
    });
  }
});

/**
 * POST /api/ops/watch/scraper/run
 * Run a full scrape cycle
 */
router.post("/scraper/run", async (req: Request, res: Response) => {
  try {
    const result = await scraperService.runFullScrape();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Scraper run error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run scraper"
    });
  }
});

/**
 * POST /api/ops/watch/scraper/county-surplus
 * Fetch county surplus pages
 * Body: { states?: string[] }
 */
router.post("/scraper/county-surplus", async (req: Request, res: Response) => {
  try {
    const { states } = req.body;
    const result = await scraperService.fetchCountySurplusPages(states);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("County surplus fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch county surplus pages"
    });
  }
});

/**
 * POST /api/ops/watch/scraper/state-rules
 * Fetch state surplus rules
 * Body: { states?: string[] }
 */
router.post("/scraper/state-rules", async (req: Request, res: Response) => {
  try {
    const { states } = req.body;
    const result = await scraperService.fetchStateSurplusRules(states);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("State rules fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch state rules"
    });
  }
});

/**
 * POST /api/ops/watch/scraper/tax-sales
 * Fetch tax sale lists
 * Body: { states?: string[] }
 */
router.post("/scraper/tax-sales", async (req: Request, res: Response) => {
  try {
    const { states } = req.body;
    const result = await scraperService.fetchTaxSaleLists(states);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Tax sales fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tax sale lists"
    });
  }
});

// ============================================
// SCRAPED ITEMS
// ============================================

/**
 * GET /api/ops/watch/scraped-items
 * Get scraped items with filters
 * Query params: type, state, county, reviewStatus, limit, offset
 */
router.get("/scraped-items", async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as ScrapedItemType | undefined,
      state: req.query.state as string | undefined,
      county: req.query.county as string | undefined,
      reviewStatus: req.query.reviewStatus as ScrapedItemReviewStatus | undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    const result = await scraperService.getScrapedItems(filters);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Scraped items fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch scraped items"
    });
  }
});

/**
 * GET /api/ops/watch/scraped-items/:id
 * Get single scraped item
 */
router.get("/scraped-items/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await scraperService.getScrapedItem(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Scraped item not found"
      });
    }

    res.json({ success: true, data: item });
  } catch (error: any) {
    console.error("Scraped item fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch scraped item"
    });
  }
});

/**
 * POST /api/ops/watch/scraped-items/:id/review
 * Update scraped item review status
 * Body: { status, notes? }
 */
router.post("/scraped-items/:id/review", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required"
      });
    }

    const item = await scraperService.updateReviewStatus(id, status, userId, notes);
    res.json({ success: true, data: item });
  } catch (error: any) {
    console.error("Scraped item review error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update review status"
    });
  }
});

// ============================================
// WATCHER CONTROL
// ============================================

/**
 * POST /api/ops/watch/run
 * Run a full watch cycle
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    const result = await watchService.runFullWatch();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Watch run error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run watch cycle"
    });
  }
});

/**
 * POST /api/ops/watch/detect/rule-changes
 * Detect rule changes from scraped items
 */
router.post("/detect/rule-changes", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectRuleChangesFromScrapedItems();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Rule change detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect rule changes"
    });
  }
});

/**
 * POST /api/ops/watch/detect/document-patterns
 * Detect new document patterns
 */
router.post("/detect/document-patterns", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectNewDocumentPatterns();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Document pattern detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect document patterns"
    });
  }
});

/**
 * POST /api/ops/watch/detect/deadline-changes
 * Detect deadline pattern changes
 */
router.post("/detect/deadline-changes", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectDeadlinePatternChanges();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Deadline change detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect deadline changes"
    });
  }
});

/**
 * POST /api/ops/watch/detect/ingestion-risks
 * Detect high-risk ingestion patterns
 */
router.post("/detect/ingestion-risks", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectHighRiskIngestionPatterns();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Ingestion risk detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect ingestion risks"
    });
  }
});

/**
 * POST /api/ops/watch/detect/payout-anomalies
 * Detect payout anomalies
 */
router.post("/detect/payout-anomalies", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectPayoutAnomalies();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Payout anomaly detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect payout anomalies"
    });
  }
});

/**
 * POST /api/ops/watch/detect/employee-anomalies
 * Detect employee anomalies
 */
router.post("/detect/employee-anomalies", async (req: Request, res: Response) => {
  try {
    const result = await watchService.detectEmployeeAnomalies();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Employee anomaly detection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to detect employee anomalies"
    });
  }
});

// ============================================
// ALERTS
// ============================================

/**
 * GET /api/ops/watch/alerts
 * Get alerts with filters
 * Query params: type, severity, isResolved, state, limit, offset
 */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as WatchAlertType | undefined,
      severity: req.query.severity as WatchAlertSeverity | undefined,
      isResolved: req.query.isResolved === "true" ? true : req.query.isResolved === "false" ? false : undefined,
      state: req.query.state as string | undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    const result = await watchService.getAlerts(filters);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Alerts fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alerts"
    });
  }
});

/**
 * GET /api/ops/watch/alerts/summary
 * Get alert summary (counts by severity and type)
 */
router.get("/alerts/summary", async (req: Request, res: Response) => {
  try {
    const summary = await watchService.getAlertSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("Alert summary error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alert summary"
    });
  }
});

/**
 * GET /api/ops/watch/alerts/:id
 * Get single alert
 */
router.get("/alerts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = await watchService.getAlert(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found"
      });
    }

    res.json({ success: true, data: alert });
  } catch (error: any) {
    console.error("Alert fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alert"
    });
  }
});

/**
 * POST /api/ops/watch/alerts/:id/resolve
 * Resolve an alert
 * Body: { resolution? }
 */
router.post("/alerts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    const userId = (req as any).user?.userId;

    const alert = await watchService.resolveAlert(id, userId, resolution);
    res.json({ success: true, data: alert });
  } catch (error: any) {
    console.error("Alert resolve error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resolve alert"
    });
  }
});

/**
 * POST /api/ops/watch/alerts/bulk-resolve
 * Bulk resolve alerts
 * Body: { alertIds, resolution? }
 */
router.post("/alerts/bulk-resolve", async (req: Request, res: Response) => {
  try {
    const { alertIds, resolution } = req.body;
    const userId = (req as any).user?.userId;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "alertIds must be a non-empty array"
      });
    }

    const results = await Promise.all(
      alertIds.map(id => watchService.resolveAlert(id, userId, resolution))
    );

    res.json({
      success: true,
      data: {
        resolved: results.length,
        alertIds
      }
    });
  } catch (error: any) {
    console.error("Bulk resolve error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to bulk resolve alerts"
    });
  }
});

// ============================================
// SCRAPER ADVANCED OPERATIONS
// ============================================

/**
 * POST /api/ops/watch/scraper/fetch-url
 * Manually fetch a single URL
 * Body: { url, name?, type?, state?, county? }
 */
router.post("/scraper/fetch-url", async (req: Request, res: Response) => {
  try {
    const { url, name, type, state, county } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL is required"
      });
    }

    const result = await scraperService.fetchSingleUrl(url, { name, type, state, county });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Fetch URL error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch URL"
    });
  }
});

/**
 * POST /api/ops/watch/scraper/fetch-overdue
 * Fetch only overdue targets
 */
router.post("/scraper/fetch-overdue", async (req: Request, res: Response) => {
  try {
    const result = await scraperService.fetchOverdueTargets();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Fetch overdue error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch overdue targets"
    });
  }
});

/**
 * GET /api/ops/watch/scraper/overdue
 * Get list of overdue targets
 */
router.get("/scraper/overdue", async (req: Request, res: Response) => {
  try {
    const overdueTargets = await scraperService.getOverdueTargets();
    res.json({
      success: true,
      data: {
        count: overdueTargets.length,
        targets: overdueTargets
      }
    });
  } catch (error: any) {
    console.error("Get overdue targets error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get overdue targets"
    });
  }
});

// ============================================
// WATCH TARGETS
// ============================================

/**
 * GET /api/ops/watch/targets
 * Get all watch targets with health status
 */
router.get("/targets", async (req: Request, res: Response) => {
  try {
    const report = await watchService.getWatchTargetHealthReport();
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error("Watch targets fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch watch targets"
    });
  }
});

/**
 * GET /api/ops/watch/targets/:id
 * Get single watch target with details
 */
router.get("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const target = await watchService.getWatchTarget(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        error: "Watch target not found"
      });
    }

    res.json({ success: true, data: target });
  } catch (error: any) {
    console.error("Watch target fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch watch target"
    });
  }
});

/**
 * GET /api/ops/watch/targets/:id/health
 * Get health score for a single watch target
 */
router.get("/targets/:id/health", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const health = await watchService.calculateSourceHealth(id);
    res.json({ success: true, data: health });
  } catch (error: any) {
    console.error("Watch target health error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate source health"
    });
  }
});

/**
 * POST /api/ops/watch/targets
 * Create a new watch target
 * Body: { name, watchType, url, state?, county?, enabled?, checkIntervalMinutes? }
 */
router.post("/targets", async (req: Request, res: Response) => {
  try {
    const { name, watchType, url, state, county, enabled, checkIntervalMinutes } = req.body;

    if (!name || !watchType || !url) {
      return res.status(400).json({
        success: false,
        error: "name, watchType, and url are required"
      });
    }

    const target = await watchService.upsertWatchTarget({
      name,
      watchType,
      url,
      state,
      county,
      enabled,
      checkIntervalMinutes
    });

    res.status(201).json({ success: true, data: target });
  } catch (error: any) {
    console.error("Create watch target error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create watch target"
    });
  }
});

/**
 * PUT /api/ops/watch/targets/:id
 * Update a watch target
 * Body: { name, watchType, url, state?, county?, enabled?, checkIntervalMinutes? }
 */
router.put("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, watchType, url, state, county, enabled, checkIntervalMinutes } = req.body;

    if (!name || !watchType || !url) {
      return res.status(400).json({
        success: false,
        error: "name, watchType, and url are required"
      });
    }

    const target = await watchService.upsertWatchTarget({
      id,
      name,
      watchType,
      url,
      state,
      county,
      enabled,
      checkIntervalMinutes
    });

    res.json({ success: true, data: target });
  } catch (error: any) {
    console.error("Update watch target error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update watch target"
    });
  }
});

/**
 * DELETE /api/ops/watch/targets/:id
 * Delete a watch target
 */
router.delete("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await watchService.deleteWatchTarget(id);
    res.json({ success: true, message: "Watch target deleted" });
  } catch (error: any) {
    console.error("Delete watch target error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete watch target"
    });
  }
});

/**
 * POST /api/ops/watch/targets/monitor
 * Run watch target monitoring
 */
router.post("/targets/monitor", async (req: Request, res: Response) => {
  try {
    const result = await watchService.monitorWatchTargets();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Monitor watch targets error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to monitor watch targets"
    });
  }
});

// ============================================
// PARSER SERVICE
// ============================================

/**
 * GET /api/ops/watch/parsers/health
 * Get parser service health status
 */
router.get("/parsers/health", async (req: Request, res: Response) => {
  try {
    const health = getParserHealth();
    res.json({ success: true, data: health });
  } catch (error: any) {
    console.error("Parser health error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch parser health"
    });
  }
});

// ============================================
// FULL OPS CYCLE
// ============================================

/**
 * POST /api/ops/watch/cycle
 * Run a full ops cycle (scrape + watch)
 * This is the main scheduled job endpoint
 */
router.post("/cycle", async (req: Request, res: Response) => {
  try {
    // Run scraper first
    const scraperResult = await scraperService.runFullScrape();

    // Then run watchers
    const watchResult = await watchService.runFullWatch();

    res.json({
      success: true,
      data: {
        scraper: scraperResult,
        watch: watchResult,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Full ops cycle error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run full ops cycle"
    });
  }
});

export default router;
