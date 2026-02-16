/**
 * scraperV2Cron.ts
 *
 * Scheduled job for running the Puppeteer-based ScraperEngineV2.
 * Scrapes county surplus fund pages across all 50 states.
 *
 * Schedule: Every 6 hours when ENABLE_SCHEDULER=true
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import logger from '../utils/logger.js';
import prisma from '../lib/prisma.js';
import { scraperEngineV2 } from '../services/scraper/index.js';
import { ingestionService } from '../services/IngestionService.js';
import { caseRoutingService } from '../services/CaseRoutingService.js';
import { getEnabledConfigs, getHighPopulationConfigs } from '../services/scraper/countyConfigs.js';

// =============================================================================
// TYPES
// =============================================================================

interface ScraperCronResult {
  configsProcessed: number;
  recordsExtracted: number;
  casesCreated: number;
  casesRouted: number;
  errors: string[];
  durationMs: number;
  byState: Record<string, { records: number; errors: number }>;
}

// =============================================================================
// MAIN SCRAPER CRON
// =============================================================================

/**
 * Run the ScraperEngineV2 for all enabled county configurations
 *
 * @param options - Options for the scrape run
 * @returns Results of the scrape operation
 */
export async function runScraperV2Cron(options: {
  states?: string[];
  highPopulationOnly?: boolean;
  maxCounties?: number;
} = {}): Promise<ScraperCronResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const byState: Record<string, { records: number; errors: number }> = {};

  let configsProcessed = 0;
  let totalRecordsExtracted = 0;
  let totalCasesCreated = 0;
  let totalCasesRouted = 0;

  logger.info('[ScraperV2Cron] Starting scheduled scrape run...');

  // Create run record
  const runRecord = await prisma.botRunLog.create({
    data: {
      botName: 'ScraperV2Cron',
      runType: 'scheduled',
      success: false,
      summary: 'Running...',
      recordsProcessed: 0,
      insightsGenerated: 0,
      errorsEncountered: 0,
      durationMs: 0,
    },
  });

  try {
    // Get configurations to process
    let configs = options.highPopulationOnly
      ? getHighPopulationConfigs(100000)
      : getEnabledConfigs();

    // Filter by states if specified
    if (options.states && options.states.length > 0) {
      configs = configs.filter((c) => options.states!.includes(c.stateAbbr));
    }

    // Limit number of counties if specified
    if (options.maxCounties && options.maxCounties > 0) {
      configs = configs.slice(0, options.maxCounties);
    }

    logger.info(`[ScraperV2Cron] Processing ${configs.length} county configurations`);

    // Process each configuration
    for (const config of configs) {
      try {
        logger.info(`[ScraperV2Cron] Scraping ${config.county}, ${config.stateAbbr}`);

        // Initialize state stats
        if (!byState[config.stateAbbr]) {
          byState[config.stateAbbr] = { records: 0, errors: 0 };
        }

        // Run scrape
        const scrapeResult = await scraperEngineV2.scrapeConfig(config);
        configsProcessed++;

        if (scrapeResult.success) {
          const recordCount = scrapeResult.records.length;
          totalRecordsExtracted += recordCount;
          byState[config.stateAbbr].records += recordCount;

          // Save to ingestion system if records were found
          if (recordCount > 0) {
            const sourceId = await scraperEngineV2.saveToIngestionSource(scrapeResult);

            if (sourceId) {
              // Process records through ingestion service
              const batchId = await ingestionService.createBatch(
                sourceId,
                `scraper-v2-${config.id}`,
                scrapeResult.url
              );

              const processResult = await ingestionService.processBatch(
                batchId,
                scrapeResult.records.map((r) => ({
                  ownerName: r.ownerName,
                  propertyAddress: r.propertyAddress,
                  parcelNumber: r.parcelNumber,
                  saleDate: r.saleDate,
                  saleAmount: r.saleAmount,
                  surplusAmount: r.surplusAmount,
                  city: r.city,
                  state: r.state,
                  county: r.county,
                  zipCode: r.zipCode,
                  ...r.rawData,
                }))
              );

              totalCasesCreated += processResult.created;

              // Auto-route if enabled
              const routingConfig = await caseRoutingService.getConfig();
              if (routingConfig.enabled && routingConfig.autoAssignOnIngestion && processResult.created > 0) {
                const newRecords = await prisma.ingestionRecord.findMany({
                  where: { batchId, caseId: { not: null } },
                  select: { caseId: true },
                });

                const caseIds = newRecords.map((r) => r.caseId!).filter(Boolean);
                if (caseIds.length > 0) {
                  const routeResult = await caseRoutingService.autoAssignBatch(caseIds);
                  totalCasesRouted += routeResult.assigned;
                }
              }

              // Log any processing errors
              if (processResult.errors.length > 0) {
                errors.push(...processResult.errors.map((e) => `${config.county}, ${config.stateAbbr}: ${e}`));
              }
            }
          }

          logger.info(
            `[ScraperV2Cron] ${config.county}, ${config.stateAbbr}: ${recordCount} records extracted`
          );
        } else {
          byState[config.stateAbbr].errors++;
          if (scrapeResult.error) {
            errors.push(`${config.county}, ${config.stateAbbr}: ${scrapeResult.error}`);
          }
          logger.warn(`[ScraperV2Cron] ${config.county}, ${config.stateAbbr} failed: ${scrapeResult.error}`);
        }

        // Rate limiting - wait between scrapes
        await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${config.county}, ${config.stateAbbr}: ${errorMsg}`);
        byState[config.stateAbbr] = byState[config.stateAbbr] || { records: 0, errors: 0 };
        byState[config.stateAbbr].errors++;
        logger.error(`[ScraperV2Cron] Error processing ${config.county}, ${config.stateAbbr}: ${errorMsg}`);
      }
    }

    // Close browser after all scrapes
    await scraperEngineV2.closeBrowser();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Global error: ${errorMsg}`);
    logger.error(`[ScraperV2Cron] Global error: ${errorMsg}`);
  }

  const durationMs = Date.now() - startTime;

  // Update run record
  await prisma.botRunLog.update({
    where: { id: runRecord.id },
    data: {
      success: errors.length === 0,
      summary: `Processed ${configsProcessed} counties, extracted ${totalRecordsExtracted} records, created ${totalCasesCreated} cases, routed ${totalCasesRouted}`,
      recordsProcessed: totalRecordsExtracted,
      insightsGenerated: totalCasesCreated,
      errorsEncountered: errors.length,
      durationMs,
      error: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
      details: {
        configsProcessed,
        recordsExtracted: totalRecordsExtracted,
        casesCreated: totalCasesCreated,
        casesRouted: totalCasesRouted,
        byState,
        errors: errors.slice(0, 20),
      },
    },
  });

  // Create ops insight if significant results
  if (totalRecordsExtracted > 0 || totalCasesCreated > 0) {
    await prisma.opsInsight.create({
      data: {
        category: 'SCRAPER_V2_RUN',
        priority: totalCasesCreated >= 10 ? 'HIGH' : 'NORMAL',
        title: `ScraperV2 Run Complete: ${totalRecordsExtracted} Records`,
        summary: `Scraped ${configsProcessed} counties, extracted ${totalRecordsExtracted} surplus records, created ${totalCasesCreated} new cases. Duration: ${Math.round(durationMs / 1000)}s`,
        details: {
          configsProcessed,
          recordsExtracted: totalRecordsExtracted,
          casesCreated: totalCasesCreated,
          casesRouted: totalCasesRouted,
          byState,
          errorCount: errors.length,
          durationMs,
        },
        status: 'NEW',
      },
    });
  }

  logger.info(
    `[ScraperV2Cron] Completed: ${configsProcessed} configs, ${totalRecordsExtracted} records, ` +
    `${totalCasesCreated} cases, ${totalCasesRouted} routed (${durationMs}ms)`
  );

  return {
    configsProcessed,
    recordsExtracted: totalRecordsExtracted,
    casesCreated: totalCasesCreated,
    casesRouted: totalCasesRouted,
    errors,
    durationMs,
    byState,
  };
}

/**
 * Run scraper for a single state
 */
export async function runScraperForState(stateAbbr: string): Promise<ScraperCronResult> {
  return runScraperV2Cron({ states: [stateAbbr] });
}

/**
 * Run scraper for high-population counties only (faster execution)
 */
export async function runScraperHighPopulation(): Promise<ScraperCronResult> {
  return runScraperV2Cron({ highPopulationOnly: true });
}

/**
 * Get scraper run history
 */
export async function getScraperRunHistory(limit: number = 20): Promise<unknown[]> {
  return prisma.botRunLog.findMany({
    where: { botName: 'ScraperV2Cron' },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

/**
 * Get scraper statistics
 */
export async function getScraperStats(): Promise<{
  engineStats: unknown;
  recentRuns: number;
  totalRecords: number;
  totalCases: number;
  successRate: number;
}> {
  const engineStats = scraperEngineV2.getStats();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentRuns = await prisma.botRunLog.findMany({
    where: {
      botName: 'ScraperV2Cron',
      startedAt: { gte: thirtyDaysAgo },
    },
  });

  const successfulRuns = recentRuns.filter((r) => r.success).length;
  const totalRecords = recentRuns.reduce((sum, r) => sum + (r.recordsProcessed || 0), 0);
  const totalCases = recentRuns.reduce((sum, r) => sum + (r.insightsGenerated || 0), 0);

  return {
    engineStats,
    recentRuns: recentRuns.length,
    totalRecords,
    totalCases,
    successRate: recentRuns.length > 0 ? (successfulRuns / recentRuns.length) * 100 : 0,
  };
}
