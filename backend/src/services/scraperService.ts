/**
 * scraperService.ts
 *
 * Production scraper service for MGR Capital OPS Layer.
 * Real HTTPS fetching, WatchTarget loading, OpsInsight creation.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { PrismaClient, ScrapedItemType, ScrapedItemReviewStatus, Prisma } from "@prisma/client";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import crypto from "crypto";
import { parseContent as parseWithService, SourceType } from "./parserService.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface ScraperConfig {
  id: string;
  name: string;
  type: ScrapedItemType;
  state: string;
  county?: string;
  url: string;
  selector?: string;
  enabled: boolean;
  lastFetchedAt?: Date;
  fetchIntervalMinutes: number;
  headers?: Record<string, string>;
  watchTargetId?: string;
}

interface FetchResult {
  success: boolean;
  statusCode: number;
  content: string;
  contentType: string;
  responseHeaders: Record<string, string>;
  fetchTimeMs: number;
  error?: string;
}

interface ScrapeResult {
  success: boolean;
  changeDetected: boolean;
  scrapedItemId?: string;
  parsedRecords?: number;
  contentHash?: string;
  error?: string;
}

// =============================================================================
// DEFAULT CONFIGURATIONS (fallback when DB is empty)
// =============================================================================

const DEFAULT_SCRAPER_CONFIGS: Omit<ScraperConfig, "id">[] = [
  {
    name: "Tennessee Surplus Funds Registry",
    type: "SURPLUS_RULES",
    state: "TN",
    url: "https://www.tn.gov/revenue/taxes/property-tax/surplus-funds.html",
    enabled: true,
    fetchIntervalMinutes: 1440,
  },
  {
    name: "Shelby County Tax Sale List",
    type: "TAX_SALE_LIST",
    state: "TN",
    county: "Shelby",
    url: "https://www.shelbycountytrustee.com/tax-sales",
    enabled: true,
    fetchIntervalMinutes: 360,
  },
  {
    name: "Georgia Excess Funds Statute",
    type: "STATE_STATUTE",
    state: "GA",
    url: "https://law.justia.com/codes/georgia/2020/title-48/chapter-4/article-5/",
    enabled: true,
    fetchIntervalMinutes: 1440,
  },
  {
    name: "Fulton County Surplus List",
    type: "TAX_SALE_LIST",
    state: "GA",
    county: "Fulton",
    url: "https://www.fultoncountytaxes.org/tax-sales/surplus-funds",
    enabled: true,
    fetchIntervalMinutes: 360,
  },
  {
    name: "Texas Property Tax Code",
    type: "STATE_STATUTE",
    state: "TX",
    url: "https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm",
    enabled: true,
    fetchIntervalMinutes: 1440,
  },
  {
    name: "Harris County Surplus Funds",
    type: "TAX_SALE_LIST",
    state: "TX",
    county: "Harris",
    url: "https://www.hctax.net/Property/TaxSales",
    enabled: true,
    fetchIntervalMinutes: 360,
  },
  {
    name: "Florida Surplus Funds Statute",
    type: "STATE_STATUTE",
    state: "FL",
    url: "https://www.flsenate.gov/Laws/Statutes/2023/197.582",
    enabled: true,
    fetchIntervalMinutes: 1440,
  },
];

// =============================================================================
// HTTP FETCH IMPLEMENTATION
// =============================================================================

const DEFAULT_HEADERS = {
  "User-Agent": "MGR-Capital-Scraper/1.0 (Compliance Research)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "identity",
  "Connection": "keep-alive",
};

async function fetchUrl(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<FetchResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  const maxRedirects = options.maxRedirects || 5;
  const headers = { ...DEFAULT_HEADERS, ...options.headers };

  return new Promise((resolve) => {
    let redirectCount = 0;

    function doFetch(targetUrl: string) {
      try {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === "https:";
        const requestModule = isHttps ? https : http;

        const requestOptions: http.RequestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: "GET",
          headers,
          timeout: timeoutMs,
        };

        const req = requestModule.request(requestOptions, (res) => {
          // Handle redirects
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
            if (redirectCount >= maxRedirects) {
              resolve({
                success: false,
                statusCode: res.statusCode,
                content: "",
                contentType: "",
                responseHeaders: {},
                fetchTimeMs: Date.now() - startTime,
                error: `Max redirects (${maxRedirects}) exceeded`,
              });
              return;
            }

            const location = res.headers.location;
            if (location) {
              redirectCount++;
              const newUrl = location.startsWith("http")
                ? location
                : new URL(location, targetUrl).toString();
              doFetch(newUrl);
              return;
            }
          }

          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          res.on("end", () => {
            const content = Buffer.concat(chunks).toString("utf-8");
            const responseHeaders: Record<string, string> = {};

            for (const [key, value] of Object.entries(res.headers)) {
              if (typeof value === "string") {
                responseHeaders[key] = value;
              } else if (Array.isArray(value)) {
                responseHeaders[key] = value.join(", ");
              }
            }

            resolve({
              success: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400,
              statusCode: res.statusCode || 0,
              content,
              contentType: res.headers["content-type"] || "",
              responseHeaders,
              fetchTimeMs: Date.now() - startTime,
            });
          });

          res.on("error", (error) => {
            resolve({
              success: false,
              statusCode: 0,
              content: "",
              contentType: "",
              responseHeaders: {},
              fetchTimeMs: Date.now() - startTime,
              error: error.message,
            });
          });
        });

        req.on("error", (error) => {
          resolve({
            success: false,
            statusCode: 0,
            content: "",
            contentType: "",
            responseHeaders: {},
            fetchTimeMs: Date.now() - startTime,
            error: error.message,
          });
        });

        req.on("timeout", () => {
          req.destroy();
          resolve({
            success: false,
            statusCode: 0,
            content: "",
            contentType: "",
            responseHeaders: {},
            fetchTimeMs: Date.now() - startTime,
            error: `Request timeout after ${timeoutMs}ms`,
          });
        });

        req.end();
      } catch (error) {
        resolve({
          success: false,
          statusCode: 0,
          content: "",
          contentType: "",
          responseHeaders: {},
          fetchTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    doFetch(url);
  });
}

// =============================================================================
// CONTENT HASHING
// =============================================================================

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// =============================================================================
// SCRAPER SERVICE CLASS
// =============================================================================

class ScraperService {
  private configs: ScraperConfig[] = [];
  private configsLoaded = false;

  /**
   * Load configurations from WatchTargets in database
   * Falls back to DEFAULT_SCRAPER_CONFIGS if DB is empty
   */
  async loadConfigurations(): Promise<ScraperConfig[]> {
    const watchTargets = await prisma.watchTarget.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (watchTargets.length > 0) {
      this.configs = watchTargets.map((wt) => ({
        id: wt.id,
        name: wt.name,
        type: this.mapWatchTypeToScrapedItemType(wt.type),
        state: wt.state || "",
        county: wt.county || undefined,
        url: wt.url,
        enabled: wt.isActive,
        fetchIntervalMinutes: ((wt.config as any)?.checkIntervalMinutes) || 360,
        watchTargetId: wt.id,
      }));
    } else {
      // Fallback to defaults
      this.configs = DEFAULT_SCRAPER_CONFIGS.map((c, i) => ({
        ...c,
        id: `default-${i}`,
      }));
    }

    this.configsLoaded = true;
    return this.configs;
  }

  private mapWatchTypeToScrapedItemType(watchType: string): ScrapedItemType {
    const mapping: Record<string, ScrapedItemType> = {
      TAX_SALE_CALENDAR: "TAX_SALE_LIST",
      SURPLUS_LIST: "TAX_SALE_LIST",
      COURT_CALENDAR: "COURT_NOTICE",
      STATUTE_TRACKER: "STATE_STATUTE",
      DEADLINE_MONITOR: "SURPLUS_RULES",
    };
    return mapping[watchType] || "TAX_SALE_LIST";
  }

  /**
   * Ensure configs are loaded
   */
  private async ensureConfigs(): Promise<void> {
    if (!this.configsLoaded) {
      await this.loadConfigurations();
    }
  }

  /**
   * Fetch and store content from county surplus pages
   */
  async fetchCountySurplusPages(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    errors: string[];
  }> {
    await this.ensureConfigs();

    const configs = this.configs.filter(
      (c) =>
        c.enabled &&
        c.type === "TAX_SALE_LIST" &&
        (!states || states.includes(c.state))
    );

    let fetched = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const result = await this.fetchAndStore(config);
        if (result.success) fetched++;
        else if (result.error) errors.push(`${config.name}: ${result.error}`);
      } catch (error) {
        errors.push(`${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { success: errors.length === 0, fetched, errors };
  }

  /**
   * Fetch and store state-level surplus rules
   */
  async fetchStateSurplusRules(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    changesDetected: number;
    errors: string[];
  }> {
    await this.ensureConfigs();

    const configs = this.configs.filter(
      (c) =>
        c.enabled &&
        (c.type === "SURPLUS_RULES" || c.type === "STATE_STATUTE") &&
        (!states || states.includes(c.state))
    );

    let fetched = 0;
    let changesDetected = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const result = await this.fetchAndStore(config);
        if (result.success) {
          fetched++;
          if (result.changeDetected) changesDetected++;
        } else if (result.error) {
          errors.push(`${config.name}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { success: errors.length === 0, fetched, changesDetected, errors };
  }

  /**
   * Fetch court notices and legal updates
   */
  async fetchCourtNotices(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    errors: string[];
  }> {
    await this.ensureConfigs();

    const configs = this.configs.filter(
      (c) =>
        c.enabled &&
        c.type === "COURT_NOTICE" &&
        (!states || states.includes(c.state))
    );

    let fetched = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const result = await this.fetchAndStore(config);
        if (result.success) fetched++;
        else if (result.error) errors.push(`${config.name}: ${result.error}`);
      } catch (error) {
        errors.push(`${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { success: errors.length === 0, fetched, errors };
  }

  /**
   * Fetch tax sale lists
   */
  async fetchTaxSaleLists(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    newRecords: number;
    errors: string[];
  }> {
    await this.ensureConfigs();

    const configs = this.configs.filter(
      (c) =>
        c.enabled &&
        c.type === "TAX_SALE_LIST" &&
        (!states || states.includes(c.state))
    );

    let fetched = 0;
    let newRecords = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const result = await this.fetchAndStore(config);
        if (result.success) {
          fetched++;
          if (result.parsedRecords) newRecords += result.parsedRecords;
        } else if (result.error) {
          errors.push(`${config.name}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { success: errors.length === 0, fetched, newRecords, errors };
  }

  /**
   * Core fetch and store function with real HTTP
   */
  private async fetchAndStore(config: ScraperConfig): Promise<ScrapeResult> {
    // Perform real HTTP fetch
    const fetchResult = await fetchUrl(config.url, {
      headers: config.headers,
      timeoutMs: 60000,
    });

    if (!fetchResult.success) {
      // Record fetch failure for monitoring
      await this.recordFetchFailure(config, fetchResult.error || "Unknown error");
      return {
        success: false,
        changeDetected: false,
        error: fetchResult.error,
      };
    }

    const content = fetchResult.content;
    const contentHash = hashContent(content);

    // Check for existing item with same URL and hash (no change)
    const existingItem = await prisma.scrapedItem.findFirst({
      where: {
        sourceUrl: config.url,
        contentHash: contentHash,
      },
      orderBy: { fetchedAt: "desc" },
    });

    if (existingItem) {
      // Content unchanged - update WatchTarget lastCheckedAt if applicable
      if (config.watchTargetId) {
        await prisma.watchTarget.update({
          where: { id: config.watchTargetId },
          data: { lastScrapedAt: new Date(), lastSuccessAt: new Date() },
        });
      }
      return { success: true, changeDetected: false };
    }

    // Check for previous version to detect change
    const previousItem = await prisma.scrapedItem.findFirst({
      where: { sourceUrl: config.url },
      orderBy: { fetchedAt: "desc" },
    });

    const changeDetected = previousItem !== null && previousItem.contentHash !== contentHash;

    // Parse content using ParserService
    let parsedData: Prisma.InputJsonValue = {};
    let parsedRecords = 0;

    try {
      const sourceType = this.mapScrapedItemTypeToSourceType(config.type);
      const parseResult = await parseWithService(content, {
        sourceType,
        county: config.county,
        state: config.state,
        sourceUrl: config.url,
      });

      if (parseResult.success) {
        parsedData = parseResult.records.map((r) => r.normalizedData) as unknown as Prisma.InputJsonValue;
        parsedRecords = parseResult.totalRecords;
      } else {
        // Fallback to raw JSON parse
        try {
          parsedData = JSON.parse(content);
        } catch {
          parsedData = { raw: content.substring(0, 10000) };
        }
      }
    } catch {
      parsedData = { raw: content.substring(0, 10000) };
    }

    // Store scraped item
    const scrapedItem = await prisma.scrapedItem.create({
      data: {
        sourceType: config.type,
        sourceUrl: config.url,
        sourceName: config.name,
        state: config.state,
        county: config.county,
        rawContent: content.substring(0, 1000000), // Limit to 1MB
        parsedData: parsedData,
        contentHash: contentHash,
        reviewStatus: changeDetected ? "ACTIONABLE" : "PENDING",
        watchTargetId: config.watchTargetId,
      },
    });

    // Update WatchTarget lastCheckedAt
    if (config.watchTargetId) {
      await prisma.watchTarget.update({
        where: { id: config.watchTargetId },
        data: {
          lastScrapedAt: new Date(),
          lastSuccessAt: new Date(),
        },
      });
    }

    // Create OpsInsight if change detected (FOUNDER intel)
    if (changeDetected) {
      await this.createChangeOpsInsight(config, scrapedItem.id, previousItem?.id);
    }

    return {
      success: true,
      changeDetected,
      scrapedItemId: scrapedItem.id,
      parsedRecords,
      contentHash,
    };
  }

  private mapScrapedItemTypeToSourceType(type: ScrapedItemType): SourceType {
    const mapping: Record<ScrapedItemType, SourceType> = {
      TAX_SALE_LIST: "TAX_SALE",
      SURPLUS_RULES: "SURPLUS_FUND",
      STATE_STATUTE: "SURPLUS_FUND",
      COURT_NOTICE: "SURPLUS_FUND",
      COUNTY_WEBSITE: "SURPLUS_FUND",
      DOCUMENT_PATTERN: "SURPLUS_FUND",
    };
    return mapping[type] || "UNKNOWN";
  }

  /**
   * Create OpsInsight when content change detected
   */
  private async createChangeOpsInsight(
    config: ScraperConfig,
    newItemId: string,
    previousItemId?: string
  ): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          category: "SCRAPER_CHANGE",
          priority: config.type === "STATE_STATUTE" ? "HIGH" : "NORMAL",
          title: `Content Change Detected: ${config.name}`,
          summary: `The monitored source "${config.name}" (${config.state}${config.county ? ` - ${config.county}` : ""}) has updated content that may require review.`,
          details: {
            sourceUrl: config.url,
            sourceType: config.type,
            state: config.state,
            county: config.county,
            newScrapedItemId: newItemId,
            previousScrapedItemId: previousItemId,
            watchTargetId: config.watchTargetId,
          },
          status: "NEW",
        },
      });
    } catch (error) {
      console.error("Failed to create OpsInsight:", error);
    }
  }

  /**
   * Record fetch failure for monitoring
   */
  private async recordFetchFailure(config: ScraperConfig, error: string): Promise<void> {
    try {
      // Update WatchTarget with failure info
      if (config.watchTargetId) {
        await prisma.watchTarget.update({
          where: { id: config.watchTargetId },
          data: {
            lastScrapedAt: new Date(),
            lastErrorAt: new Date(),
            lastError: error,
          },
        });
      }

      // Create OpsInsight for repeated failures
      await prisma.opsInsight.create({
        data: {
          category: "SCRAPER_ERROR",
          priority: "NORMAL",
          title: `Scraper Fetch Failed: ${config.name}`,
          summary: `Failed to fetch content from ${config.url}: ${error}`,
          details: {
            sourceUrl: config.url,
            sourceType: config.type,
            state: config.state,
            county: config.county,
            error,
            watchTargetId: config.watchTargetId,
          },
          status: "NEW",
        },
      });
    } catch (e) {
      console.error("Failed to record fetch failure:", e);
    }
  }

  // ==========================================================================
  // QUERY FUNCTIONS
  // ==========================================================================

  /**
   * Get all scraped items with filters
   */
  async getScrapedItems(filters: {
    type?: ScrapedItemType;
    state?: string;
    county?: string;
    reviewStatus?: ScrapedItemReviewStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: unknown[];
    total: number;
  }> {
    const where: Prisma.ScrapedItemWhereInput = {};
    if (filters.type) where.sourceType = filters.type;
    if (filters.state) where.state = filters.state;
    if (filters.county) where.county = filters.county;
    if (filters.reviewStatus) where.reviewStatus = filters.reviewStatus;

    const [items, total] = await Promise.all([
      prisma.scrapedItem.findMany({
        where,
        orderBy: { fetchedAt: "desc" },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.scrapedItem.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get single scraped item by ID
   */
  async getScrapedItem(id: string): Promise<unknown> {
    return prisma.scrapedItem.findUnique({
      where: { id },
    });
  }

  /**
   * Update scraped item review status
   */
  async updateReviewStatus(
    id: string,
    status: ScrapedItemReviewStatus,
    reviewedById: string,
    notes?: string
  ): Promise<unknown> {
    return prisma.scrapedItem.update({
      where: { id },
      data: {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedById,
        notes,
      },
    });
  }

  /**
   * Get scraper statistics
   */
  async getScraperStats(): Promise<{
    totalItems: number;
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
    byState: { state: string; count: number }[];
    recentChanges: number;
    activeWatchTargets: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalItems, byType, byStatus, byState, recentChanges, activeWatchTargets] =
      await Promise.all([
        prisma.scrapedItem.count(),
        prisma.scrapedItem.groupBy({
          by: ["sourceType"],
          _count: true,
        }),
        prisma.scrapedItem.groupBy({
          by: ["reviewStatus"],
          _count: true,
        }),
        prisma.scrapedItem.groupBy({
          by: ["state"],
          _count: true,
          where: { state: { not: null } },
        }),
        prisma.scrapedItem.count({
          where: {
            reviewStatus: "ACTIONABLE",
            fetchedAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.watchTarget.count({
          where: { isActive: true },
        }),
      ]);

    return {
      totalItems,
      byType: byType.map((b) => ({ type: b.sourceType, count: b._count })),
      byStatus: byStatus.map((b) => ({ status: b.reviewStatus, count: b._count })),
      byState: byState.map((b) => ({ state: b.state || "Unknown", count: b._count })),
      recentChanges,
      activeWatchTargets,
    };
  }

  /**
   * Get available scraper configurations
   */
  async getConfigurations(): Promise<ScraperConfig[]> {
    await this.ensureConfigs();
    return this.configs;
  }

  /**
   * Manually fetch a single URL
   */
  async fetchSingleUrl(
    url: string,
    options: {
      name?: string;
      type?: ScrapedItemType;
      state?: string;
      county?: string;
    } = {}
  ): Promise<ScrapeResult> {
    const config: ScraperConfig = {
      id: `manual-${Date.now()}`,
      name: options.name || url,
      type: options.type || "TAX_SALE_LIST",
      state: options.state || "UNKNOWN",
      county: options.county,
      url,
      enabled: true,
      fetchIntervalMinutes: 0,
    };

    return this.fetchAndStore(config);
  }

  /**
   * Run full scrape cycle
   */
  async runFullScrape(): Promise<{
    success: boolean;
    summary: {
      surplusPages: { fetched: number; errors: number };
      stateRules: { fetched: number; changes: number; errors: number };
      taxSaleLists: { fetched: number; newRecords: number; errors: number };
      courtNotices: { fetched: number; errors: number };
    };
    totalFetchTimeMs: number;
  }> {
    const startTime = Date.now();

    const surplusResult = await this.fetchCountySurplusPages();
    const rulesResult = await this.fetchStateSurplusRules();
    const taxSaleResult = await this.fetchTaxSaleLists();
    const courtResult = await this.fetchCourtNotices();

    const totalFetchTimeMs = Date.now() - startTime;

    // Create summary OpsInsight
    await prisma.opsInsight.create({
      data: {
        category: "SCRAPER_CYCLE",
        priority: "LOW",
        title: "Scraper Cycle Complete",
        summary: `Full scrape cycle completed in ${totalFetchTimeMs}ms. Fetched ${surplusResult.fetched + rulesResult.fetched + taxSaleResult.fetched + courtResult.fetched} sources, detected ${rulesResult.changesDetected} changes, found ${taxSaleResult.newRecords} new records.`,
        details: {
          surplusPages: surplusResult,
          stateRules: rulesResult,
          taxSaleLists: taxSaleResult,
          courtNotices: courtResult,
          totalFetchTimeMs,
        },
        status: "ACKNOWLEDGED",
      },
    });

    return {
      success:
        surplusResult.errors.length === 0 &&
        rulesResult.errors.length === 0 &&
        taxSaleResult.errors.length === 0 &&
        courtResult.errors.length === 0,
      summary: {
        surplusPages: {
          fetched: surplusResult.fetched,
          errors: surplusResult.errors.length,
        },
        stateRules: {
          fetched: rulesResult.fetched,
          changes: rulesResult.changesDetected,
          errors: rulesResult.errors.length,
        },
        taxSaleLists: {
          fetched: taxSaleResult.fetched,
          newRecords: taxSaleResult.newRecords,
          errors: taxSaleResult.errors.length,
        },
        courtNotices: {
          fetched: courtResult.fetched,
          errors: courtResult.errors.length,
        },
      },
      totalFetchTimeMs,
    };
  }

  /**
   * Check if a URL is due for re-fetch based on interval
   */
  async getOverdueTargets(): Promise<ScraperConfig[]> {
    await this.ensureConfigs();

    const now = Date.now();
    const overdueConfigs: ScraperConfig[] = [];

    for (const config of this.configs) {
      if (!config.enabled) continue;

      const lastFetch = await prisma.scrapedItem.findFirst({
        where: { sourceUrl: config.url },
        orderBy: { fetchedAt: "desc" },
        select: { fetchedAt: true },
      });

      if (!lastFetch) {
        overdueConfigs.push(config);
        continue;
      }

      const intervalMs = config.fetchIntervalMinutes * 60 * 1000;
      const timeSinceLastFetch = now - lastFetch.fetchedAt.getTime();

      if (timeSinceLastFetch >= intervalMs) {
        overdueConfigs.push(config);
      }
    }

    return overdueConfigs;
  }

  /**
   * Fetch only overdue targets
   */
  async fetchOverdueTargets(): Promise<{
    fetched: number;
    changes: number;
    errors: string[];
  }> {
    const overdueConfigs = await this.getOverdueTargets();

    let fetched = 0;
    let changes = 0;
    const errors: string[] = [];

    for (const config of overdueConfigs) {
      try {
        const result = await this.fetchAndStore(config);
        if (result.success) {
          fetched++;
          if (result.changeDetected) changes++;
        } else if (result.error) {
          errors.push(`${config.name}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { fetched, changes, errors };
  }
}

export const scraperService = new ScraperService();
