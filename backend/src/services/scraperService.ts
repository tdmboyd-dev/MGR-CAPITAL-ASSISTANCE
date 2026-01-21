// ============================================
// SCRAPER SERVICE — MGR CAPITAL ASSISTANCE
// OPS LAYER: External world monitoring
// FOUNDER ONLY — Never expose to employees/clients
// ============================================

import { PrismaClient, ScrapedItemType, ScrapedItemReviewStatus } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// ============================================
// SCRAPER CONFIGURATION
// URLs and patterns for each state/county
// ============================================

interface ScraperConfig {
  name: string;
  type: ScrapedItemType;
  state: string;
  county?: string;
  url: string;
  selector?: string; // CSS selector for content extraction
  enabled: boolean;
}

// Default scraper configurations for key states
// In production, these would be stored in DB and managed via admin
const SCRAPER_CONFIGS: ScraperConfig[] = [
  // Tennessee
  {
    name: "Tennessee Surplus Funds Registry",
    type: "SURPLUS_RULES",
    state: "TN",
    url: "https://www.tn.gov/revenue/taxes/property-tax/surplus-funds.html",
    enabled: true
  },
  {
    name: "Shelby County Tax Sale List",
    type: "TAX_SALE_LIST",
    state: "TN",
    county: "Shelby",
    url: "https://www.shelbycountytrustee.com/tax-sales",
    enabled: true
  },
  // Georgia
  {
    name: "Georgia Excess Funds Statute",
    type: "STATE_STATUTE",
    state: "GA",
    url: "https://law.justia.com/codes/georgia/2020/title-48/chapter-4/article-5/",
    enabled: true
  },
  {
    name: "Fulton County Surplus List",
    type: "TAX_SALE_LIST",
    state: "GA",
    county: "Fulton",
    url: "https://www.fultoncountytaxes.org/tax-sales/surplus-funds",
    enabled: true
  },
  // Texas
  {
    name: "Texas Property Tax Code",
    type: "STATE_STATUTE",
    state: "TX",
    url: "https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm",
    enabled: true
  },
  {
    name: "Harris County Surplus Funds",
    type: "TAX_SALE_LIST",
    state: "TX",
    county: "Harris",
    url: "https://www.hctax.net/Property/TaxSales",
    enabled: true
  },
  // Florida
  {
    name: "Florida Surplus Funds Statute",
    type: "STATE_STATUTE",
    state: "FL",
    url: "https://www.flsenate.gov/Laws/Statutes/2023/197.582",
    enabled: true
  }
];

// ============================================
// CORE SCRAPER FUNCTIONS
// ============================================

class ScraperService {
  /**
   * Fetch and store content from county surplus pages
   * Returns scraped items ready for review
   */
  async fetchCountySurplusPages(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    errors: string[];
  }> {
    const configs = SCRAPER_CONFIGS.filter(c =>
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
      } catch (error: any) {
        errors.push(`${config.name}: ${error.message}`);
      }
    }

    return { success: errors.length === 0, fetched, errors };
  }

  /**
   * Fetch and store state-level surplus rules
   * Monitors for changes in statutes and regulations
   */
  async fetchStateSurplusRules(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    changesDetected: number;
    errors: string[];
  }> {
    const configs = SCRAPER_CONFIGS.filter(c =>
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
        }
      } catch (error: any) {
        errors.push(`${config.name}: ${error.message}`);
      }
    }

    return { success: errors.length === 0, fetched, changesDetected, errors };
  }

  /**
   * Fetch court notices and legal updates
   * Monitors for new case law affecting surplus recovery
   */
  async fetchCourtNotices(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    errors: string[];
  }> {
    // Court notice scraping would require more specialized sources
    // This is a placeholder for future implementation
    const configs = SCRAPER_CONFIGS.filter(c =>
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
      } catch (error: any) {
        errors.push(`${config.name}: ${error.message}`);
      }
    }

    return { success: errors.length === 0, fetched, errors };
  }

  /**
   * Fetch tax sale lists from configured sources
   * Primary source for new case leads
   */
  async fetchTaxSaleLists(states?: string[]): Promise<{
    success: boolean;
    fetched: number;
    newRecords: number;
    errors: string[];
  }> {
    const configs = SCRAPER_CONFIGS.filter(c =>
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
          // In real implementation, would parse and count new property records
          if (result.parsedData && Array.isArray(result.parsedData)) {
            newRecords += result.parsedData.length;
          }
        }
      } catch (error: any) {
        errors.push(`${config.name}: ${error.message}`);
      }
    }

    return { success: errors.length === 0, fetched, newRecords, errors };
  }

  /**
   * Core fetch and store function
   * Fetches URL content, detects changes, stores in ScrapedItem
   */
  private async fetchAndStore(config: ScraperConfig): Promise<{
    success: boolean;
    changeDetected: boolean;
    scrapedItemId?: string;
    parsedData?: any;
  }> {
    // In production, this would use actual HTTP fetch
    // For now, we simulate the scraping process
    const mockContent = this.simulateScrape(config);
    const contentHash = this.hashContent(mockContent);

    // Check for existing item with same URL and hash
    const existingItem = await prisma.scrapedItem.findFirst({
      where: {
        sourceUrl: config.url,
        contentHash: contentHash
      },
      orderBy: { fetchedAt: "desc" }
    });

    // If content hasn't changed, skip
    if (existingItem) {
      return { success: true, changeDetected: false };
    }

    // Check if this is a change from previous version
    const previousItem = await prisma.scrapedItem.findFirst({
      where: { sourceUrl: config.url },
      orderBy: { fetchedAt: "desc" }
    });

    const changeDetected = previousItem !== null && previousItem.contentHash !== contentHash;

    // Parse content (in production, would use actual parsing logic)
    const parsedData = this.parseContent(config.type, mockContent);

    // Store scraped item
    const scrapedItem = await prisma.scrapedItem.create({
      data: {
        sourceType: config.type,
        sourceUrl: config.url,
        sourceName: config.name,
        state: config.state,
        county: config.county,
        rawContent: mockContent,
        parsedData: parsedData,
        contentHash: contentHash,
        reviewStatus: changeDetected ? "ACTIONABLE" : "PENDING"
      }
    });

    return {
      success: true,
      changeDetected,
      scrapedItemId: scrapedItem.id,
      parsedData
    };
  }

  /**
   * Simulate scraping (in production, replace with actual fetch)
   */
  private simulateScrape(config: ScraperConfig): string {
    // Generate mock content based on source type
    const timestamp = new Date().toISOString();

    switch (config.type) {
      case "TAX_SALE_LIST":
        return JSON.stringify({
          source: config.name,
          fetchedAt: timestamp,
          properties: [
            {
              parcel: "123-456-789",
              address: "123 Main St",
              owner: "John Doe",
              saleDate: "2024-03-15",
              saleAmount: 50000,
              surplus: 15000
            }
          ]
        });

      case "SURPLUS_RULES":
      case "STATE_STATUTE":
        return JSON.stringify({
          source: config.name,
          fetchedAt: timestamp,
          statute: {
            code: `${config.state} Code § 48-4-5`,
            title: "Surplus Funds from Tax Sales",
            claimPeriod: "3 years",
            lastAmended: "2023-07-01"
          }
        });

      default:
        return JSON.stringify({
          source: config.name,
          fetchedAt: timestamp,
          content: "Mock scraped content"
        });
    }
  }

  /**
   * Parse scraped content into structured data
   */
  private parseContent(type: ScrapedItemType, content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }

  /**
   * Generate hash of content for change detection
   */
  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex").substring(0, 32);
  }

  // ============================================
  // QUERY FUNCTIONS
  // ============================================

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
    items: any[];
    total: number;
  }> {
    const where: any = {};
    if (filters.type) where.sourceType = filters.type;
    if (filters.state) where.state = filters.state;
    if (filters.county) where.county = filters.county;
    if (filters.reviewStatus) where.reviewStatus = filters.reviewStatus;

    const [items, total] = await Promise.all([
      prisma.scrapedItem.findMany({
        where,
        orderBy: { fetchedAt: "desc" },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      prisma.scrapedItem.count({ where })
    ]);

    return { items, total };
  }

  /**
   * Get single scraped item by ID
   */
  async getScrapedItem(id: string): Promise<any> {
    return prisma.scrapedItem.findUnique({
      where: { id },
      include: {
        watchAlerts: true
      }
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
  ): Promise<any> {
    return prisma.scrapedItem.update({
      where: { id },
      data: {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedById,
        notes
      }
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
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalItems,
      byType,
      byStatus,
      byState,
      recentChanges
    ] = await Promise.all([
      prisma.scrapedItem.count(),
      prisma.scrapedItem.groupBy({
        by: ["sourceType"],
        _count: true
      }),
      prisma.scrapedItem.groupBy({
        by: ["reviewStatus"],
        _count: true
      }),
      prisma.scrapedItem.groupBy({
        by: ["state"],
        _count: true,
        where: { state: { not: null } }
      }),
      prisma.scrapedItem.count({
        where: {
          reviewStatus: "ACTIONABLE",
          fetchedAt: { gte: thirtyDaysAgo }
        }
      })
    ]);

    return {
      totalItems,
      byType: byType.map(b => ({ type: b.sourceType, count: b._count })),
      byStatus: byStatus.map(b => ({ status: b.reviewStatus, count: b._count })),
      byState: byState.map(b => ({ state: b.state || "Unknown", count: b._count })),
      recentChanges
    };
  }

  /**
   * Get available scraper configurations
   */
  getConfigurations(): ScraperConfig[] {
    return SCRAPER_CONFIGS;
  }

  /**
   * Run full scrape cycle
   * Called on schedule or manually by Founder
   */
  async runFullScrape(): Promise<{
    success: boolean;
    summary: {
      surplusPages: { fetched: number; errors: number };
      stateRules: { fetched: number; changes: number; errors: number };
      taxSaleLists: { fetched: number; newRecords: number; errors: number };
    };
  }> {
    const surplusResult = await this.fetchCountySurplusPages();
    const rulesResult = await this.fetchStateSurplusRules();
    const taxSaleResult = await this.fetchTaxSaleLists();

    return {
      success: surplusResult.errors.length === 0 &&
               rulesResult.errors.length === 0 &&
               taxSaleResult.errors.length === 0,
      summary: {
        surplusPages: {
          fetched: surplusResult.fetched,
          errors: surplusResult.errors.length
        },
        stateRules: {
          fetched: rulesResult.fetched,
          changes: rulesResult.changesDetected,
          errors: rulesResult.errors.length
        },
        taxSaleLists: {
          fetched: taxSaleResult.fetched,
          newRecords: taxSaleResult.newRecords,
          errors: taxSaleResult.errors.length
        }
      }
    };
  }
}

export const scraperService = new ScraperService();
