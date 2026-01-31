/**
 * autoIngestionCron.ts
 *
 * Core autopilot engine: fetches due ingestion sources, parses content,
 * creates cases, and auto-routes them to employees.
 *
 * Runs every 30 minutes when ENABLE_SCHEDULER=true.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { scraperService } from "../services/scraperService.js";
import { ingestionService } from "../services/ingestionService.js";
import { caseRoutingService } from "../services/CaseRoutingService.js";
import { parseContent, SourceType } from "../services/parserService.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface AutopilotResult {
  sourcesFetched: number;
  recordsParsed: number;
  casesCreated: number;
  casesRouted: number;
  errors: string[];
  durationMs: number;
}

// =============================================================================
// FREQUENCY TO MS MAPPING
// =============================================================================

function frequencyToMs(frequency: string | null): number {
  switch (frequency) {
    case "hourly":
      return 60 * 60 * 1000;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    case "every_30_min":
      return 30 * 60 * 1000;
    case "every_6_hours":
      return 6 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // Default daily
  }
}

function calculateNextFetch(frequency: string | null): Date {
  return new Date(Date.now() + frequencyToMs(frequency));
}

// =============================================================================
// CORE AUTOPILOT FUNCTION
// =============================================================================

export async function runAutoIngestion(): Promise<AutopilotResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let sourcesFetched = 0;
  let totalRecordsParsed = 0;
  let totalCasesCreated = 0;
  let totalCasesRouted = 0;

  logger.info("[AutoIngestion] Starting autopilot run...");

  try {
    // 1. Query due sources
    const dueSources = await prisma.ingestionSource.findMany({
      where: {
        isActive: true,
        OR: [
          { nextFetch: { lte: new Date() } },
          { nextFetch: null, lastFetched: null }, // Never fetched
        ],
      },
      orderBy: { nextFetch: "asc" },
    });

    if (dueSources.length === 0) {
      logger.info("[AutoIngestion] No due sources found");
      return { sourcesFetched: 0, recordsParsed: 0, casesCreated: 0, casesRouted: 0, errors: [], durationMs: Date.now() - startTime };
    }

    logger.info(`[AutoIngestion] Found ${dueSources.length} due sources`);

    // 2. Process each source
    for (const source of dueSources) {
      const sourceStart = Date.now();

      // Create autopilot run record
      const run = await prisma.autopilotRun.create({
        data: {
          sourceId: source.id,
          runType: "scheduled",
          status: "running",
        },
      });

      try {
        // Skip sources without URLs (webhook/email types handled elsewhere)
        if (!source.url) {
          await prisma.autopilotRun.update({
            where: { id: run.id },
            data: { status: "completed", completedAt: new Date(), durationMs: Date.now() - sourceStart },
          });
          continue;
        }

        // Fetch the URL
        logger.info(`[AutoIngestion] Fetching source: ${source.name} (${source.url})`);
        const scrapeResult = await scraperService.fetchSingleUrl(source.url, {
          name: source.name,
          state: source.state,
          county: source.county || undefined,
        }) as any;

        if (!scrapeResult.success || !scrapeResult.content) {
          throw new Error(scrapeResult.error || "Failed to fetch URL");
        }

        sourcesFetched++;

        // Parse the content
        const urlObj = new URL(source.url);
        const filename = urlObj.pathname.split("/").pop() || "fetched-content";

        const parseResult = await parseContent(scrapeResult.content, {
          filename,
          sourceType: mapSourceType(source.type),
          county: source.county || undefined,
          state: source.state,
          sourceUrl: source.url,
        });

        const recordsParsed = parseResult.totalRecords;
        totalRecordsParsed += recordsParsed;

        // Create batch and process records
        let casesCreated = 0;
        if (parseResult.records.length > 0) {
          const batchId = await ingestionService.createBatch(source.id, filename, source.url);

          const batchResult = await ingestionService.processBatch(
            batchId,
            parseResult.records.map((r) => r.normalizedData || r.rawData || {}),
            source.parserConfig as any
          );

          casesCreated = batchResult.created;
          totalCasesCreated += casesCreated;

          // Auto-route created cases
          const routingConfig = await caseRoutingService.getConfig();
          if (routingConfig.enabled && routingConfig.autoAssignOnIngestion) {
            // Get the newly created cases from this batch
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

          // Update autopilot run
          await prisma.autopilotRun.update({
            where: { id: run.id },
            data: {
              batchId,
              recordsParsed,
              casesCreated,
              casesRouted: totalCasesRouted,
              status: "completed",
              completedAt: new Date(),
              durationMs: Date.now() - sourceStart,
            },
          });
        } else {
          await prisma.autopilotRun.update({
            where: { id: run.id },
            data: { status: "completed", completedAt: new Date(), durationMs: Date.now() - sourceStart },
          });
        }

        // Update source: reset errors, set next fetch
        await prisma.ingestionSource.update({
          where: { id: source.id },
          data: {
            lastFetched: new Date(),
            nextFetch: calculateNextFetch(source.frequency),
            consecutiveErrors: 0,
            lastError: null,
            totalFetches: { increment: 1 },
            totalCasesCreated: { increment: casesCreated },
          },
        });

        logger.info(`[AutoIngestion] Source ${source.name}: ${recordsParsed} records parsed, ${casesCreated} cases created`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Source ${source.name}: ${errorMsg}`);
        logger.error(`[AutoIngestion] Source ${source.name} failed: ${errorMsg}`);

        const newConsecutiveErrors = (source.consecutiveErrors || 0) + 1;

        // Auto-disable after 5 consecutive failures
        const shouldDisable = newConsecutiveErrors >= 5;

        await prisma.ingestionSource.update({
          where: { id: source.id },
          data: {
            lastError: errorMsg,
            consecutiveErrors: newConsecutiveErrors,
            nextFetch: calculateNextFetch(source.frequency),
            totalFetches: { increment: 1 },
            ...(shouldDisable && { isActive: false }),
          },
        });

        // Update run as failed
        await prisma.autopilotRun.update({
          where: { id: run.id },
          data: {
            status: "failed",
            errors: [errorMsg],
            completedAt: new Date(),
            durationMs: Date.now() - sourceStart,
          },
        });

        if (shouldDisable) {
          logger.warn(`[AutoIngestion] Source ${source.name} auto-disabled after ${newConsecutiveErrors} consecutive failures`);

          // Create WatchAlert
          await prisma.watchAlert.create({
            data: {
              type: "SYSTEM_HEALTH",
              severity: "HIGH",
              title: `Ingestion source auto-disabled: ${source.name}`,
              message: `Source "${source.name}" has been automatically disabled after ${newConsecutiveErrors} consecutive fetch failures. Last error: ${errorMsg}`,
              state: source.state,
              county: source.county,
              status: "OPEN",
            },
          });
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Global error: ${errorMsg}`);
    logger.error(`[AutoIngestion] Global error: ${errorMsg}`);
  }

  const durationMs = Date.now() - startTime;

  // Log to BotRunLog
  await prisma.botRunLog.create({
    data: {
      botName: "AutoIngestionCron",
      runType: "scheduled",
      success: errors.length === 0,
      summary: `Fetched ${sourcesFetched} sources, parsed ${totalRecordsParsed} records, created ${totalCasesCreated} cases, routed ${totalCasesRouted}`,
      recordsProcessed: totalRecordsParsed,
      insightsGenerated: totalCasesCreated,
      errorsEncountered: errors.length,
      durationMs,
      error: errors.length > 0 ? errors.join("; ") : null,
      details: { sourcesFetched, recordsParsed: totalRecordsParsed, casesCreated: totalCasesCreated, casesRouted: totalCasesRouted },
    },
  });

  logger.info(`[AutoIngestion] Completed: ${sourcesFetched} sources, ${totalRecordsParsed} records, ${totalCasesCreated} cases, ${totalCasesRouted} routed (${durationMs}ms)`);

  return { sourcesFetched, recordsParsed: totalRecordsParsed, casesCreated: totalCasesCreated, casesRouted: totalCasesRouted, errors, durationMs };
}

/**
 * Manually trigger fetch for a single source
 */
export async function fetchSingleSource(sourceId: string): Promise<AutopilotResult> {
  const startTime = Date.now();
  const source = await prisma.ingestionSource.findUnique({ where: { id: sourceId } });

  if (!source) {
    return { sourcesFetched: 0, recordsParsed: 0, casesCreated: 0, casesRouted: 0, errors: ["Source not found"], durationMs: 0 };
  }

  // Temporarily set nextFetch to now so it gets picked up
  await prisma.ingestionSource.update({
    where: { id: sourceId },
    data: { nextFetch: new Date() },
  });

  // Run the autopilot for just this source
  return runAutoIngestion();
}

// =============================================================================
// HELPERS
// =============================================================================

function mapSourceType(type: string): SourceType | undefined {
  const map: Record<string, SourceType> = {
    TAX_SALE_LIST: "TAX_SALE" as SourceType,
    SURPLUS_PDF: "SURPLUS_FUND" as SourceType,
    COUNTY_WEBSITE: "TAX_SALE" as SourceType,
    AUCTION_RESULT: "TAX_SALE" as SourceType,
  };
  return map[type];
}

export { calculateNextFetch, frequencyToMs };
