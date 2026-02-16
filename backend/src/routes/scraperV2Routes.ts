/**
 * scraperV2Routes.ts
 *
 * API routes for the Puppeteer-based ScraperEngineV2.
 * Provides endpoints for scraping, URL scouting, and configuration management.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { asyncHandler, Errors } from '../middleware/errorHandler.js';
import {
  scraperEngineV2,
  urlScoutService,
  COUNTY_CONFIGS,
  getConfigById,
  getConfigsByState,
  getEnabledConfigs,
  getStatesWithConfigs,
  getCoverageStats,
  getHighPopulationConfigs,
} from '../services/scraper/index.js';
import {
  runScraperV2Cron,
  runScraperForState,
  runScraperHighPopulation,
  getScraperRunHistory,
  getScraperStats,
} from '../cron/scraperV2Cron.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ============================================
// ALL ROUTES ARE FOUNDER ONLY
// ============================================

/**
 * GET /api/scraper-v2/stats - Get scraper engine statistics
 */
router.get(
  '/stats',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getScraperStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/scraper-v2/configs - List all county configurations
 */
router.get(
  '/configs',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { state, enabled, highPopulation } = req.query;

    let configs = COUNTY_CONFIGS;

    if (state) {
      configs = configs.filter((c) => c.stateAbbr === state);
    }

    if (enabled === 'true') {
      configs = configs.filter((c) => c.enabled);
    }

    if (highPopulation === 'true') {
      configs = configs.filter((c) => (c.population || 0) >= 100000);
    }

    res.json({
      success: true,
      count: configs.length,
      data: configs.map((c) => ({
        id: c.id,
        state: c.state,
        stateAbbr: c.stateAbbr,
        county: c.county,
        population: c.population,
        parserType: c.parserType,
        enabled: c.enabled,
        surplusUrlCount: c.surplusUrls.length,
        taxSaleUrlCount: c.taxSaleUrls.length,
      })),
    });
  })
);

/**
 * GET /api/scraper-v2/configs/:id - Get single configuration
 */
router.get(
  '/configs/:id',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const config = getConfigById(id);

    if (!config) {
      throw Errors.notFound('Configuration');
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * GET /api/scraper-v2/coverage - Get coverage statistics
 */
router.get(
  '/coverage',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (_req: Request, res: Response) => {
    const coverage = getCoverageStats();
    const states = getStatesWithConfigs();

    res.json({
      success: true,
      data: {
        ...coverage,
        states,
      },
    });
  })
);

/**
 * GET /api/scraper-v2/states - List all states with configurations
 */
router.get(
  '/states',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (_req: Request, res: Response) => {
    const states = getStatesWithConfigs();
    const coverage = getCoverageStats();

    const stateData = states.map((state) => ({
      abbr: state,
      countyCount: coverage.byState[state] || 0,
    }));

    res.json({
      success: true,
      count: states.length,
      data: stateData,
    });
  })
);

/**
 * POST /api/scraper-v2/scrape/county/:id - Scrape a single county
 */
router.post(
  '/scrape/county/:id',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const config = getConfigById(id);

    if (!config) {
      throw Errors.notFound('Configuration');
    }

    // Start scrape
    const result = await scraperEngineV2.scrapeCounty(id);

    // Save to ingestion if successful
    let sourceId: string | null = null;
    if (result.success && result.records.length > 0) {
      sourceId = await scraperEngineV2.saveToIngestionSource(result);
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_MANUAL_SCRAPE',
        entityType: 'SCRAPER_CONFIG',
        entityId: id,
        details: {
          county: config.county,
          state: config.stateAbbr,
          recordsExtracted: result.totalRecords,
          success: result.success,
          error: result.error,
        },
      },
    });

    res.json({
      success: result.success,
      data: {
        ...result,
        sourceId,
      },
    });
  })
);

/**
 * POST /api/scraper-v2/scrape/state/:state - Scrape all counties in a state
 */
router.post(
  '/scrape/state/:state',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { state } = req.params;

    const configs = getConfigsByState(state);
    if (configs.length === 0) {
      throw Errors.badRequest(`No configurations found for state: ${state}`);
    }

    // Run scraper for state
    const result = await runScraperForState(state);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_STATE_SCRAPE',
        entityType: 'SCRAPER_RUN',
        entityId: state,
        details: {
          state,
          configsProcessed: result.configsProcessed,
          recordsExtracted: result.recordsExtracted,
          casesCreated: result.casesCreated,
          errors: result.errors.length,
        },
      },
    });

    res.json({
      success: result.errors.length === 0,
      data: result,
    });
  })
);

/**
 * POST /api/scraper-v2/scrape/batch - Run batch scrape with options
 */
router.post(
  '/scrape/batch',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { states, highPopulationOnly, maxCounties } = req.body;

    const result = await runScraperV2Cron({
      states,
      highPopulationOnly,
      maxCounties,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_BATCH_SCRAPE',
        entityType: 'SCRAPER_RUN',
        entityId: 'batch',
        details: {
          states,
          highPopulationOnly,
          maxCounties,
          configsProcessed: result.configsProcessed,
          recordsExtracted: result.recordsExtracted,
          casesCreated: result.casesCreated,
          errors: result.errors.length,
        },
      },
    });

    res.json({
      success: result.errors.length === 0,
      data: result,
    });
  })
);

/**
 * POST /api/scraper-v2/scrape/high-population - Scrape high-population counties only
 */
router.post(
  '/scrape/high-population',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await runScraperHighPopulation();

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_HIGH_POP_SCRAPE',
        entityType: 'SCRAPER_RUN',
        entityId: 'high-population',
        details: {
          configsProcessed: result.configsProcessed,
          recordsExtracted: result.recordsExtracted,
          casesCreated: result.casesCreated,
          errors: result.errors.length,
        },
      },
    });

    res.json({
      success: result.errors.length === 0,
      data: result,
    });
  })
);

/**
 * GET /api/scraper-v2/history - Get scraper run history
 */
router.get(
  '/history',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await getScraperRunHistory(limit);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  })
);

// ============================================
// URL SCOUT ENDPOINTS
// ============================================

/**
 * POST /api/scraper-v2/scout - Scout a URL for surplus/tax sale pages
 */
router.post(
  '/scout',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { url, county, state, maxDepth, maxPages } = req.body;

    if (!url) {
      throw Errors.badRequest('url is required');
    }

    if (!county || !state) {
      throw Errors.badRequest('county and state are required');
    }

    const result = await urlScoutService.scoutUrl(url, county, state, {
      maxDepth,
      maxPages,
    });

    // Save discovered URLs if successful
    let savedCount = 0;
    if (result.success) {
      savedCount = await urlScoutService.saveDiscoveredUrls(result);
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_URL_SCOUT',
        entityType: 'URL_SCOUT',
        entityId: url,
        details: {
          baseUrl: url,
          county,
          state,
          surplusUrlsFound: result.surplusUrls.length,
          taxSaleUrlsFound: result.taxSaleUrls.length,
          pdfUrlsFound: result.pdfUrls.length,
          savedCount,
        },
      },
    });

    res.json({
      success: result.success,
      data: {
        ...result,
        savedCount,
      },
    });
  })
);

/**
 * POST /api/scraper-v2/scout/generate-queries - Generate search queries for a county
 */
router.post(
  '/scout/generate-queries',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const { county, state } = req.body;

    if (!county || !state) {
      throw Errors.badRequest('county and state are required');
    }

    const queries = urlScoutService.generateSearchQueries(county, state);

    res.json({
      success: true,
      data: {
        county,
        state,
        queries,
      },
    });
  })
);

/**
 * GET /api/scraper-v2/high-population-configs - Get high population county configs
 */
router.get(
  '/high-population-configs',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const minPopulation = parseInt(req.query.minPopulation as string) || 500000;
    const configs = getHighPopulationConfigs(minPopulation);

    res.json({
      success: true,
      count: configs.length,
      minPopulation,
      data: configs.map((c) => ({
        id: c.id,
        state: c.state,
        stateAbbr: c.stateAbbr,
        county: c.county,
        population: c.population,
        enabled: c.enabled,
      })),
    });
  })
);

/**
 * GET /api/scraper-v2/engine-stats - Get internal engine statistics
 */
router.get(
  '/engine-stats',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = scraperEngineV2.getStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * POST /api/scraper-v2/engine-stats/reset - Reset engine statistics
 */
router.post(
  '/engine-stats/reset',
  authMiddleware,
  roleGuard(['ADMIN']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    scraperEngineV2.resetStats();

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCRAPER_V2_STATS_RESET',
        entityType: 'SCRAPER_ENGINE',
        entityId: 'stats',
      },
    });

    res.json({
      success: true,
      message: 'Engine statistics reset',
    });
  })
);

export default router;
