/**
 * types.ts - Scraper Engine V2 Types
 *
 * Type definitions for the Puppeteer-based scraping system.
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

// =============================================================================
// COUNTY CONFIGURATION
// =============================================================================

export interface CountyScraperConfig {
  id: string;
  state: string;
  stateAbbr: string;
  county: string;
  fips?: string;
  population?: number;

  // Known URLs for surplus/tax sale data
  surplusUrls: string[];
  taxSaleUrls: string[];
  clerkUrls: string[];

  // Parser configuration
  parserType: ParserType;
  selectors: ScraperSelectors;

  // Anti-detection settings
  requiresJs: boolean;
  hasAntiBot: boolean;
  waitForSelector?: string;
  waitTimeMs?: number;

  // Custom headers/cookies if needed
  customHeaders?: Record<string, string>;

  // Status
  enabled: boolean;
  lastScrapeAt?: Date;
  lastSuccessAt?: Date;
  consecutiveErrors?: number;
}

export type ParserType =
  | 'table'      // HTML tables
  | 'pdf'        // PDF documents
  | 'list'       // <ul>/<ol> lists
  | 'json'       // JSON API responses
  | 'csv'        // CSV file downloads
  | 'custom';    // Custom parsing logic

export interface ScraperSelectors {
  // Table selectors
  tableSelector?: string;
  rowSelector?: string;
  headerSelector?: string;

  // Field selectors (CSS or XPath)
  ownerNameSelector?: string;
  propertyAddressSelector?: string;
  parcelNumberSelector?: string;
  saleAmountSelector?: string;
  surplusAmountSelector?: string;
  saleDateSelector?: string;

  // Navigation
  nextPageSelector?: string;
  paginationSelector?: string;

  // Data container
  dataContainerSelector?: string;

  // PDF download links
  pdfLinkSelector?: string;
}

// =============================================================================
// SCRAPE RESULTS
// =============================================================================

export interface ScrapeResult {
  success: boolean;
  configId: string;
  state: string;
  county: string;
  url: string;

  // Extracted data
  records: ScrapedRecord[];
  totalRecords: number;

  // Metadata
  scrapedAt: Date;
  durationMs: number;
  pagesScraped: number;

  // Diagnostics
  contentType?: string;
  contentLength?: number;
  contentHash?: string;
  screenshotPath?: string;

  // Errors
  error?: string;
  warnings?: string[];
}

export interface ScrapedRecord {
  ownerName?: string;
  propertyAddress?: string;
  parcelNumber?: string;
  saleDate?: string;
  saleAmount?: number;       // In cents
  surplusAmount?: number;    // In cents
  city?: string;
  state?: string;
  county?: string;
  zipCode?: string;

  // Additional fields
  caseNumber?: string;
  documentNumber?: string;
  recordingDate?: string;
  auctionDate?: string;
  claimDeadline?: string;

  // Raw data for debugging
  rawData?: Record<string, unknown>;
  sourceUrl?: string;
  rowIndex?: number;
}

// =============================================================================
// URL SCOUT RESULTS
// =============================================================================

export interface UrlScoutResult {
  success: boolean;
  baseUrl: string;
  county: string;
  state: string;

  // Discovered URLs
  surplusUrls: DiscoveredUrl[];
  taxSaleUrls: DiscoveredUrl[];
  clerkUrls: DiscoveredUrl[];
  pdfUrls: DiscoveredUrl[];

  // Metadata
  scannedAt: Date;
  pagesScanned: number;
  durationMs: number;

  error?: string;
}

export interface DiscoveredUrl {
  url: string;
  title: string;
  context: string;
  confidence: number;  // 0-100
  keywords: string[];
  linkType: 'page' | 'pdf' | 'download' | 'external';
}

// =============================================================================
// BROWSER SESSION
// =============================================================================

export interface BrowserSession {
  browser: unknown;  // puppeteer.Browser
  page: unknown;     // puppeteer.Page
  sessionId: string;
  createdAt: Date;
  requestCount: number;
  userAgent: string;
}

export interface BrowserConfig {
  headless: boolean;
  slowMo?: number;
  timeout: number;
  viewportWidth: number;
  viewportHeight: number;
  proxyServer?: string;
  userDataDir?: string;
}

// =============================================================================
// SCRAPER ENGINE STATE
// =============================================================================

export interface ScraperEngineStats {
  totalScrapes: number;
  successfulScrapes: number;
  failedScrapes: number;
  totalRecordsExtracted: number;
  totalPagesScraped: number;
  avgDurationMs: number;

  // By state
  byState: Record<string, {
    scrapes: number;
    records: number;
    successRate: number;
  }>;

  // Recent activity
  lastScrapeAt?: Date;
  lastSuccessAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;

  // URL scout stats
  urlsDiscovered: number;
  urlsValidated: number;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

export interface BatchScrapeOptions {
  states?: string[];
  counties?: string[];
  maxConcurrent?: number;
  delayBetweenMs?: number;
  stopOnError?: boolean;
  screenshotOnError?: boolean;
}

export interface BatchScrapeResult {
  success: boolean;
  totalConfigs: number;
  processed: number;
  successful: number;
  failed: number;
  totalRecords: number;
  durationMs: number;
  results: ScrapeResult[];
  errors: string[];
}
