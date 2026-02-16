/**
 * ScraperEngineV2.ts - Puppeteer-Based Surplus Recovery Scraper
 *
 * Production-grade web scraper for county surplus funds and tax sale data.
 * Features:
 * - Puppeteer for JavaScript-rendered pages
 * - Anti-bot protection (stealth mode, rotating user agents, delays)
 * - Smart URL discovery (finds surplus/tax sale pages automatically)
 * - Multiple parser types (table, PDF, list, JSON)
 * - Integration with IngestionSource and AutopilotRun system
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import crypto from 'crypto';
import {
  CountyScraperConfig,
  ScrapeResult,
  ScrapedRecord,
  UrlScoutResult,
  DiscoveredUrl,
  BrowserSession,
  BrowserConfig,
  ScraperEngineStats,
  BatchScrapeOptions,
  BatchScrapeResult,
} from './types.js';
import {
  COUNTY_CONFIGS,
  getConfigById,
  getEnabledConfigs,
  getConfigsByState,
} from './countyConfigs.js';
import logger from '../../utils/logger.js';
import prisma from '../../lib/prisma.js';

// =============================================================================
// USER AGENTS
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// =============================================================================
// SURPLUS KEYWORDS FOR URL DISCOVERY
// =============================================================================

const SURPLUS_KEYWORDS = [
  'surplus', 'excess', 'overage', 'overages', 'excess funds',
  'excess proceeds', 'surplus funds', 'tax sale surplus',
  'foreclosure surplus', 'tax deed surplus', 'unclaimed funds',
  'unclaimed property', 'tax lien', 'tax deed', 'tax sale',
  'delinquent tax', 'foreclosure', 'sheriff sale', 'auction',
  'public auction', 'property auction', 'real estate auction',
];

// =============================================================================
// SCRAPER ENGINE V2 CLASS
// =============================================================================

class ScraperEngineV2 {
  private browser: Browser | null = null;
  private stats: ScraperEngineStats = {
    totalScrapes: 0,
    successfulScrapes: 0,
    failedScrapes: 0,
    totalRecordsExtracted: 0,
    totalPagesScraped: 0,
    avgDurationMs: 0,
    byState: {},
    urlsDiscovered: 0,
    urlsValidated: 0,
  };

  private defaultBrowserConfig: BrowserConfig = {
    headless: true,
    timeout: 60000,
    viewportWidth: 1920,
    viewportHeight: 1080,
  };

  // =========================================================================
  // BROWSER MANAGEMENT
  // =========================================================================

  /**
   * Launch browser with stealth settings
   */
  async launchBrowser(config?: Partial<BrowserConfig>): Promise<Browser> {
    const browserConfig = { ...this.defaultBrowserConfig, ...config };

    const launchOptions: LaunchOptions = {
      headless: browserConfig.headless ? 'shell' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: {
        width: browserConfig.viewportWidth,
        height: browserConfig.viewportHeight,
      },
    };

    if (browserConfig.slowMo) {
      launchOptions.slowMo = browserConfig.slowMo;
    }

    if (browserConfig.proxyServer) {
      launchOptions.args?.push(`--proxy-server=${browserConfig.proxyServer}`);
    }

    this.browser = await puppeteer.launch(launchOptions);
    logger.info('[ScraperEngineV2] Browser launched');
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('[ScraperEngineV2] Browser closed');
    }
  }

  /**
   * Get random user agent
   */
  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Create new page with stealth settings
   */
  async createStealthPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();

    // Set random user agent
    await page.setUserAgent(this.getRandomUserAgent());

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    `);

    return page;
  }

  /**
   * Random delay to avoid detection
   */
  private async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // =========================================================================
  // SCRAPING FUNCTIONS
  // =========================================================================

  /**
   * Scrape a single county configuration
   */
  async scrapeCounty(configId: string): Promise<ScrapeResult> {
    const config = getConfigById(configId);
    if (!config) {
      return {
        success: false,
        configId,
        state: '',
        county: '',
        url: '',
        records: [],
        totalRecords: 0,
        scrapedAt: new Date(),
        durationMs: 0,
        pagesScraped: 0,
        error: `Config not found: ${configId}`,
      };
    }

    return this.scrapeConfig(config);
  }

  /**
   * Scrape using a config object
   */
  async scrapeConfig(config: CountyScraperConfig): Promise<ScrapeResult> {
    const startTime = Date.now();
    const allRecords: ScrapedRecord[] = [];
    const warnings: string[] = [];
    let pagesScraped = 0;

    try {
      logger.info(`[ScraperEngineV2] Scraping ${config.county}, ${config.stateAbbr}`);

      // Combine all URLs to scrape
      const urlsToScrape = [
        ...config.surplusUrls,
        ...config.taxSaleUrls,
      ].filter((url) => url);

      if (urlsToScrape.length === 0) {
        throw new Error('No URLs configured for scraping');
      }

      const page = await this.createStealthPage();

      try {
        for (const url of urlsToScrape) {
          try {
            await this.randomDelay(500, 1500);

            logger.info(`[ScraperEngineV2] Fetching: ${url}`);

            // Navigate to the page
            await page.goto(url, {
              waitUntil: config.requiresJs ? 'networkidle2' : 'domcontentloaded',
              timeout: this.defaultBrowserConfig.timeout,
            });

            // Wait for specific selector if configured
            if (config.waitForSelector) {
              try {
                await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
              } catch (e) {
                warnings.push(`Selector timeout for ${config.waitForSelector} on ${url}`);
              }
            }

            // Additional wait for JS-heavy pages
            if (config.requiresJs) {
              await this.randomDelay(1000, 2000);
            }

            pagesScraped++;

            // Extract content based on parser type
            let records: ScrapedRecord[] = [];

            switch (config.parserType) {
              case 'table':
                records = await this.extractTableData(page, config, url);
                break;
              case 'pdf':
                records = await this.extractPdfLinks(page, config, url);
                break;
              case 'list':
                records = await this.extractListData(page, config, url);
                break;
              case 'json':
                records = await this.extractJsonData(page, config, url);
                break;
              default:
                records = await this.extractTableData(page, config, url);
            }

            allRecords.push(...records);

            // Check for pagination
            if (config.selectors.nextPageSelector) {
              const hasMorePages = await this.handlePagination(page, config, url, allRecords);
              if (hasMorePages) {
                pagesScraped += hasMorePages;
              }
            }
          } catch (urlError) {
            const msg = urlError instanceof Error ? urlError.message : 'Unknown error';
            warnings.push(`Failed to scrape ${url}: ${msg}`);
            logger.warn(`[ScraperEngineV2] URL error: ${msg}`);
          }
        }
      } finally {
        await page.close();
      }

      // Get content hash
      const contentHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(allRecords))
        .digest('hex');

      // Update stats
      this.updateStats(config, true, allRecords.length, Date.now() - startTime);

      return {
        success: true,
        configId: config.id,
        state: config.stateAbbr,
        county: config.county,
        url: config.surplusUrls[0] || config.taxSaleUrls[0],
        records: allRecords,
        totalRecords: allRecords.length,
        scrapedAt: new Date(),
        durationMs: Date.now() - startTime,
        pagesScraped,
        contentHash,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ScraperEngineV2] Scrape failed for ${config.county}, ${config.stateAbbr}: ${errorMsg}`);

      this.updateStats(config, false, 0, Date.now() - startTime);

      return {
        success: false,
        configId: config.id,
        state: config.stateAbbr,
        county: config.county,
        url: config.surplusUrls[0] || config.taxSaleUrls[0],
        records: allRecords,
        totalRecords: allRecords.length,
        scrapedAt: new Date(),
        durationMs: Date.now() - startTime,
        pagesScraped,
        error: errorMsg,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Extract data from HTML tables
   */
  private async extractTableData(
    page: Page,
    config: CountyScraperConfig,
    sourceUrl: string
  ): Promise<ScrapedRecord[]> {
    const records: ScrapedRecord[] = [];

    try {
      const tableSelector = config.selectors.tableSelector || 'table';
      const rowSelector = config.selectors.rowSelector || 'tbody tr, table tr:not(:first-child)';
      const headerSelector = config.selectors.headerSelector || 'thead tr th, table tr:first-child th';

      // Wait for table to load
      try {
        await page.waitForSelector(tableSelector, { timeout: 5000 });
      } catch {
        logger.info(`[ScraperEngineV2] No table found with selector: ${tableSelector}`);
        return records;
      }

      // Extract headers
      const headers = await page.$$eval(headerSelector, (cells) =>
        cells.map((cell) => cell.textContent?.trim().toLowerCase() || '')
      );

      // Extract rows
      const rows = await page.$$eval(rowSelector, (rowElements) => {
        return rowElements.map((row) => {
          const cells = row.querySelectorAll('td, th');
          return Array.from(cells).map((cell) => (cell as any).textContent?.trim() || '');
        });
      });

      // Parse rows into records
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || row.every((c) => !c)) continue;

        const record = this.parseRowToRecord(row, headers, config, sourceUrl, i);
        if (record) {
          records.push(record);
        }
      }
    } catch (error) {
      logger.warn(`[ScraperEngineV2] Table extraction error: ${error}`);
    }

    return records;
  }

  /**
   * Parse a table row into a ScrapedRecord
   */
  private parseRowToRecord(
    row: string[],
    headers: string[],
    config: CountyScraperConfig,
    sourceUrl: string,
    rowIndex: number
  ): ScrapedRecord | null {
    const rawData: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      rawData[h] = row[i];
    });

    // Try to extract key fields
    const record: ScrapedRecord = {
      state: config.stateAbbr,
      county: config.county,
      sourceUrl,
      rowIndex,
      rawData,
    };

    // Map common column names
    const columnMappings: Record<string, keyof ScrapedRecord> = {
      'owner': 'ownerName',
      'owner name': 'ownerName',
      'property owner': 'ownerName',
      'name': 'ownerName',
      'taxpayer': 'ownerName',
      'address': 'propertyAddress',
      'property address': 'propertyAddress',
      'situs': 'propertyAddress',
      'location': 'propertyAddress',
      'parcel': 'parcelNumber',
      'parcel number': 'parcelNumber',
      'parcel id': 'parcelNumber',
      'apn': 'parcelNumber',
      'pin': 'parcelNumber',
      'tax id': 'parcelNumber',
      'sale date': 'saleDate',
      'auction date': 'auctionDate',
      'date': 'saleDate',
      'sale amount': 'saleAmount',
      'bid': 'saleAmount',
      'amount': 'surplusAmount',
      'surplus': 'surplusAmount',
      'surplus amount': 'surplusAmount',
      'excess': 'surplusAmount',
      'excess proceeds': 'surplusAmount',
      'overage': 'surplusAmount',
      'city': 'city',
      'zip': 'zipCode',
      'zip code': 'zipCode',
      'case': 'caseNumber',
      'case number': 'caseNumber',
      'document': 'documentNumber',
      'doc number': 'documentNumber',
    };

    // Try to match headers to record fields
    headers.forEach((header, i) => {
      const lowerHeader = header.toLowerCase().trim();
      const value = row[i];

      if (!value) return;

      for (const [key, field] of Object.entries(columnMappings)) {
        if (lowerHeader.includes(key)) {
          if (field === 'saleAmount' || field === 'surplusAmount') {
            const amount = this.parseAmount(value);
            if (amount !== null) {
              (record as any)[field] = amount;
            }
          } else {
            (record as any)[field] = value;
          }
          break;
        }
      }
    });

    // Return null if no useful data extracted
    if (!record.ownerName && !record.propertyAddress && !record.parcelNumber && !record.surplusAmount) {
      return null;
    }

    return record;
  }

  /**
   * Parse amount string to cents
   */
  private parseAmount(value: string): number | null {
    if (!value) return null;
    const cleaned = value.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return null;
    return Math.round(amount * 100);
  }

  /**
   * Extract PDF links from page
   */
  private async extractPdfLinks(
    page: Page,
    config: CountyScraperConfig,
    sourceUrl: string
  ): Promise<ScrapedRecord[]> {
    const records: ScrapedRecord[] = [];

    try {
      const pdfSelector = config.selectors.pdfLinkSelector || 'a[href*=".pdf"]';

      const pdfLinks = await page.$$eval(pdfSelector, (links) =>
        links.map((link) => ({
          href: (link as any).href || '',
          text: link.textContent?.trim() || '',
        }))
      );

      for (const link of pdfLinks) {
        // Filter for surplus-related PDFs
        const lowerText = link.text.toLowerCase();
        const lowerHref = link.href.toLowerCase();

        const isRelevant = SURPLUS_KEYWORDS.some(
          (kw) => lowerText.includes(kw) || lowerHref.includes(kw)
        );

        if (isRelevant) {
          records.push({
            state: config.stateAbbr,
            county: config.county,
            sourceUrl: link.href,
            rawData: {
              type: 'pdf_link',
              url: link.href,
              title: link.text,
            },
          });
        }
      }
    } catch (error) {
      logger.warn(`[ScraperEngineV2] PDF extraction error: ${error}`);
    }

    return records;
  }

  /**
   * Extract data from list elements
   */
  private async extractListData(
    page: Page,
    config: CountyScraperConfig,
    sourceUrl: string
  ): Promise<ScrapedRecord[]> {
    const records: ScrapedRecord[] = [];

    try {
      const listItems = await page.$$eval('ul li, ol li, dl dd', (items) =>
        items.map((item) => item.textContent?.trim() || '')
      );

      for (let i = 0; i < listItems.length; i++) {
        const text = listItems[i];
        if (!text) continue;

        // Try to extract data from text
        const record = this.parseTextToRecord(text, config, sourceUrl, i);
        if (record) {
          records.push(record);
        }
      }
    } catch (error) {
      logger.warn(`[ScraperEngineV2] List extraction error: ${error}`);
    }

    return records;
  }

  /**
   * Extract JSON data (for API responses)
   */
  private async extractJsonData(
    page: Page,
    config: CountyScraperConfig,
    sourceUrl: string
  ): Promise<ScrapedRecord[]> {
    const records: ScrapedRecord[] = [];

    try {
      const content = await page.content();

      // Try to find JSON in page
      const jsonMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) ||
                        content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        const data = JSON.parse(jsonText);

        if (Array.isArray(data)) {
          for (const item of data) {
            records.push({
              state: config.stateAbbr,
              county: config.county,
              sourceUrl,
              rawData: item,
              ownerName: item.owner || item.ownerName || item.name,
              propertyAddress: item.address || item.propertyAddress,
              parcelNumber: item.parcel || item.parcelNumber || item.apn,
              surplusAmount: this.parseAmount(String(item.surplus || item.amount || '')) || undefined,
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`[ScraperEngineV2] JSON extraction error: ${error}`);
    }

    return records;
  }

  /**
   * Parse unstructured text into a record
   */
  private parseTextToRecord(
    text: string,
    config: CountyScraperConfig,
    sourceUrl: string,
    index: number
  ): ScrapedRecord | null {
    const record: ScrapedRecord = {
      state: config.stateAbbr,
      county: config.county,
      sourceUrl,
      rowIndex: index,
      rawData: { text },
    };

    // Extract owner name (ALL CAPS pattern)
    const nameMatch = text.match(/([A-Z][A-Z\s,\.]{5,})/);
    if (nameMatch && !nameMatch[1].match(/COUNTY|STATE|PROPERTY/i)) {
      record.ownerName = nameMatch[1].trim();
    }

    // Extract address
    const addressMatch = text.match(/(\d+\s+[A-Za-z0-9\s]+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct|Pl|Cir)\.?)/i);
    if (addressMatch) {
      record.propertyAddress = addressMatch[1].trim();
    }

    // Extract parcel number
    const parcelMatch = text.match(/(?:parcel|apn|pin)[:\s#]*([0-9\-\.]+)/i);
    if (parcelMatch) {
      record.parcelNumber = parcelMatch[1].trim();
    }

    // Extract amounts
    const amountMatch = text.match(/\$[\s]*([\d,]+\.?\d*)/);
    if (amountMatch) {
      record.surplusAmount = this.parseAmount(amountMatch[1]) || undefined;
    }

    // Return null if no useful data
    if (!record.ownerName && !record.propertyAddress && !record.parcelNumber && !record.surplusAmount) {
      return null;
    }

    return record;
  }

  /**
   * Handle pagination
   */
  private async handlePagination(
    page: Page,
    config: CountyScraperConfig,
    sourceUrl: string,
    records: ScrapedRecord[]
  ): Promise<number> {
    let additionalPages = 0;
    const maxPages = 10;

    try {
      while (additionalPages < maxPages) {
        const nextButton = await page.$(config.selectors.nextPageSelector!);
        if (!nextButton) break;

        const isDisabled = await page.evaluate(
          (el) => el.hasAttribute('disabled') || el.classList.contains('disabled'),
          nextButton
        );

        if (isDisabled) break;

        await nextButton.click();
        await this.randomDelay(1000, 2000);

        // Wait for content to update
        if (config.waitForSelector) {
          try {
            await page.waitForSelector(config.waitForSelector, { timeout: 5000 });
          } catch {
            break;
          }
        }

        // Extract data from new page
        const newRecords = await this.extractTableData(page, config, sourceUrl);
        if (newRecords.length === 0) break;

        records.push(...newRecords);
        additionalPages++;
      }
    } catch (error) {
      logger.warn(`[ScraperEngineV2] Pagination error: ${error}`);
    }

    return additionalPages;
  }

  // =========================================================================
  // URL SCOUT - AUTOMATIC URL DISCOVERY
  // =========================================================================

  /**
   * Scout a county website for surplus/tax sale URLs
   */
  async scoutCountyUrls(
    baseUrl: string,
    county: string,
    state: string
  ): Promise<UrlScoutResult> {
    const startTime = Date.now();
    const surplusUrls: DiscoveredUrl[] = [];
    const taxSaleUrls: DiscoveredUrl[] = [];
    const clerkUrls: DiscoveredUrl[] = [];
    const pdfUrls: DiscoveredUrl[] = [];
    let pagesScanned = 0;

    try {
      logger.info(`[ScraperEngineV2] Scouting URLs for ${county}, ${state}: ${baseUrl}`);

      const page = await this.createStealthPage();

      try {
        // Visit base URL
        await page.goto(baseUrl, {
          waitUntil: 'networkidle2',
          timeout: this.defaultBrowserConfig.timeout,
        });

        pagesScanned++;

        // Find all links
        const links = await page.$$eval('a[href]', (anchors) =>
          anchors.map((a) => ({
            href: (a as any).href || '',
            text: a.textContent?.trim() || '',
            title: a.getAttribute('title') || '',
          }))
        );

        // Analyze each link
        for (const link of links) {
          if (!link.href || link.href.startsWith('javascript:') || link.href.startsWith('#')) {
            continue;
          }

          const discovered = this.analyzeUrlForRelevance(link.href, link.text, link.title);
          if (discovered) {
            if (discovered.keywords.some((k) => ['surplus', 'excess', 'overage'].includes(k))) {
              surplusUrls.push(discovered);
            } else if (discovered.keywords.some((k) => ['tax sale', 'auction', 'foreclosure'].includes(k))) {
              taxSaleUrls.push(discovered);
            } else if (discovered.keywords.some((k) => ['clerk', 'recorder'].includes(k))) {
              clerkUrls.push(discovered);
            }

            if (discovered.linkType === 'pdf') {
              pdfUrls.push(discovered);
            }
          }
        }

        // Search within the page for common navigation patterns
        const navSelectors = [
          '.nav', '.navigation', '.menu', '#menu',
          '.sidebar', '#sidebar', '.subnav',
          '[role="navigation"]',
        ];

        for (const selector of navSelectors) {
          try {
            const navLinks = await page.$$eval(
              `${selector} a[href]`,
              (anchors) => anchors.map((a) => ({
                href: (a as any).href || '',
                text: a.textContent?.trim() || '',
              }))
            );

            for (const link of navLinks) {
              if (!link.href) continue;
              const discovered = this.analyzeUrlForRelevance(link.href, link.text, '');
              if (discovered && discovered.confidence >= 50) {
                // Add to appropriate array if not already present
                const existingUrls = [...surplusUrls, ...taxSaleUrls, ...clerkUrls].map((d) => d.url);
                if (!existingUrls.includes(discovered.url)) {
                  if (discovered.keywords.some((k) => ['surplus', 'excess', 'overage'].includes(k))) {
                    surplusUrls.push(discovered);
                  } else if (discovered.keywords.some((k) => ['tax', 'sale', 'auction'].includes(k))) {
                    taxSaleUrls.push(discovered);
                  }
                }
              }
            }
          } catch {
            // Selector not found, continue
          }
        }

        // Update stats
        this.stats.urlsDiscovered += surplusUrls.length + taxSaleUrls.length + pdfUrls.length;
      } finally {
        await page.close();
      }

      return {
        success: true,
        baseUrl,
        county,
        state,
        surplusUrls: surplusUrls.sort((a, b) => b.confidence - a.confidence),
        taxSaleUrls: taxSaleUrls.sort((a, b) => b.confidence - a.confidence),
        clerkUrls,
        pdfUrls,
        scannedAt: new Date(),
        pagesScanned,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ScraperEngineV2] URL scout failed: ${errorMsg}`);

      return {
        success: false,
        baseUrl,
        county,
        state,
        surplusUrls: [],
        taxSaleUrls: [],
        clerkUrls: [],
        pdfUrls: [],
        scannedAt: new Date(),
        pagesScanned,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Analyze a URL and its context for relevance
   */
  private analyzeUrlForRelevance(
    url: string,
    text: string,
    title: string
  ): DiscoveredUrl | null {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const combined = `${lowerUrl} ${lowerText} ${lowerTitle}`;

    const matchedKeywords: string[] = [];
    let confidence = 0;

    // Check for keywords
    for (const keyword of SURPLUS_KEYWORDS) {
      if (combined.includes(keyword)) {
        matchedKeywords.push(keyword);
        confidence += 20;
      }
    }

    if (matchedKeywords.length === 0) {
      return null;
    }

    // Boost confidence for specific patterns
    if (lowerUrl.includes('surplus') || lowerUrl.includes('excess')) {
      confidence += 30;
    }
    if (lowerUrl.includes('tax-sale') || lowerUrl.includes('taxsale')) {
      confidence += 20;
    }
    if (lowerText.includes('surplus') || lowerText.includes('excess')) {
      confidence += 25;
    }

    // Cap confidence at 100
    confidence = Math.min(100, confidence);

    // Determine link type
    let linkType: DiscoveredUrl['linkType'] = 'page';
    if (lowerUrl.endsWith('.pdf')) {
      linkType = 'pdf';
    } else if (lowerUrl.includes('download') || lowerUrl.includes('export')) {
      linkType = 'download';
    } else if (!url.includes(new URL(url).hostname.split('.').slice(-2).join('.'))) {
      linkType = 'external';
    }

    return {
      url,
      title: text || title || url,
      context: `Found via: ${text.substring(0, 100)}`,
      confidence,
      keywords: matchedKeywords,
      linkType,
    };
  }

  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================

  /**
   * Scrape multiple counties in batch
   */
  async scrapeBatch(options: BatchScrapeOptions = {}): Promise<BatchScrapeResult> {
    const startTime = Date.now();
    const results: ScrapeResult[] = [];
    const errors: string[] = [];

    // Get configs to process
    let configs = getEnabledConfigs();

    if (options.states && options.states.length > 0) {
      configs = configs.filter((c) => options.states!.includes(c.stateAbbr));
    }

    if (options.counties && options.counties.length > 0) {
      configs = configs.filter((c) =>
        options.counties!.some((county) =>
          c.county.toLowerCase().includes(county.toLowerCase())
        )
      );
    }

    const totalConfigs = configs.length;
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let totalRecords = 0;

    logger.info(`[ScraperEngineV2] Starting batch scrape of ${totalConfigs} configs`);

    // Ensure browser is launched
    if (!this.browser) {
      await this.launchBrowser();
    }

    try {
      for (const config of configs) {
        try {
          const result = await this.scrapeConfig(config);
          results.push(result);

          processed++;
          if (result.success) {
            successful++;
            totalRecords += result.totalRecords;
          } else {
            failed++;
            if (result.error) {
              errors.push(`${config.county}, ${config.stateAbbr}: ${result.error}`);
            }
          }

          // Delay between scrapes
          if (options.delayBetweenMs) {
            await new Promise((resolve) => setTimeout(resolve, options.delayBetweenMs));
          } else {
            await this.randomDelay(2000, 5000);
          }

          // Stop on error if configured
          if (options.stopOnError && !result.success) {
            logger.warn('[ScraperEngineV2] Stopping batch due to error');
            break;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${config.county}, ${config.stateAbbr}: ${errorMsg}`);
          failed++;
          processed++;

          if (options.stopOnError) {
            break;
          }
        }
      }
    } finally {
      // Close browser after batch
      await this.closeBrowser();
    }

    return {
      success: failed === 0,
      totalConfigs,
      processed,
      successful,
      failed,
      totalRecords,
      durationMs: Date.now() - startTime,
      results,
      errors,
    };
  }

  /**
   * Scrape all counties in a state
   */
  async scrapeState(stateAbbr: string): Promise<BatchScrapeResult> {
    return this.scrapeBatch({ states: [stateAbbr] });
  }

  // =========================================================================
  // INTEGRATION WITH INGESTION SYSTEM
  // =========================================================================

  /**
   * Create or update IngestionSource from scrape results
   */
  async saveToIngestionSource(result: ScrapeResult): Promise<string | null> {
    if (!result.success || result.records.length === 0) {
      return null;
    }

    try {
      // Check for existing source
      let source = await prisma.ingestionSource.findFirst({
        where: {
          url: result.url,
          state: result.state,
        },
      });

      if (source) {
        // Update existing source
        await prisma.ingestionSource.update({
          where: { id: source.id },
          data: {
            lastFetched: new Date(),
            totalFetches: { increment: 1 },
            consecutiveErrors: 0,
            lastError: null,
          },
        });
      } else {
        // Create new source
        source = await prisma.ingestionSource.create({
          data: {
            name: `${result.county}, ${result.state} Surplus`,
            type: 'COUNTY_WEBSITE',
            state: result.state,
            county: result.county,
            url: result.url,
            frequency: 'daily',
            isActive: true,
          },
        });
      }

      // Create batch
      const batch = await prisma.ingestionBatch.create({
        data: {
          sourceId: source.id,
          fileName: `scrape-${result.configId}-${Date.now()}`,
          fileUrl: result.url,
          status: 'processing',
          totalRecords: result.totalRecords,
        },
      });

      // Create ingestion records
      for (const record of result.records) {
        await prisma.ingestionRecord.create({
          data: {
            batchId: batch.id,
            sourceType: 'COUNTY_SURPLUS',
            rawData: (record.rawData || {}) as any,
            normalizedData: {
              ownerName: record.ownerName,
              propertyAddress: record.propertyAddress,
              parcelNumber: record.parcelNumber,
              saleDate: record.saleDate,
              saleAmountCents: record.saleAmount,
              surplusAmountCents: record.surplusAmount,
              city: record.city,
              state: record.state,
              county: record.county,
              zipCode: record.zipCode,
              sourceUrl: record.sourceUrl,
            },
            status: 'pending',
            isHighValue: (record.surplusAmount || 0) >= 1000000, // $10,000+
          },
        });
      }

      // Update batch status
      await prisma.ingestionBatch.update({
        where: { id: batch.id },
        data: {
          status: 'completed',
          processedRecords: result.totalRecords,
          processedAt: new Date(),
        },
      });

      // Create autopilot run record
      await prisma.autopilotRun.create({
        data: {
          sourceId: source.id,
          batchId: batch.id,
          runType: 'scraper_v2',
          sourcesFetched: 1,
          recordsParsed: result.totalRecords,
          status: 'completed',
          completedAt: new Date(),
          durationMs: result.durationMs,
        },
      });

      return source.id;
    } catch (error) {
      logger.error(`[ScraperEngineV2] Failed to save to ingestion: ${error}`);
      return null;
    }
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  /**
   * Update internal statistics
   */
  private updateStats(
    config: CountyScraperConfig,
    success: boolean,
    records: number,
    durationMs: number
  ): void {
    this.stats.totalScrapes++;
    this.stats.totalPagesScraped++;

    if (success) {
      this.stats.successfulScrapes++;
      this.stats.totalRecordsExtracted += records;
      this.stats.lastSuccessAt = new Date();
    } else {
      this.stats.failedScrapes++;
      this.stats.lastErrorAt = new Date();
    }

    this.stats.lastScrapeAt = new Date();

    // Update average duration
    const totalDuration = this.stats.avgDurationMs * (this.stats.totalScrapes - 1) + durationMs;
    this.stats.avgDurationMs = totalDuration / this.stats.totalScrapes;

    // Update state stats
    if (!this.stats.byState[config.stateAbbr]) {
      this.stats.byState[config.stateAbbr] = {
        scrapes: 0,
        records: 0,
        successRate: 0,
      };
    }

    const stateStats = this.stats.byState[config.stateAbbr];
    stateStats.scrapes++;
    stateStats.records += records;
    stateStats.successRate = success
      ? (stateStats.successRate * (stateStats.scrapes - 1) + 100) / stateStats.scrapes
      : (stateStats.successRate * (stateStats.scrapes - 1)) / stateStats.scrapes;
  }

  /**
   * Get current statistics
   */
  getStats(): ScraperEngineStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalScrapes: 0,
      successfulScrapes: 0,
      failedScrapes: 0,
      totalRecordsExtracted: 0,
      totalPagesScraped: 0,
      avgDurationMs: 0,
      byState: {},
      urlsDiscovered: 0,
      urlsValidated: 0,
    };
  }

  /**
   * Get all available configurations
   */
  getConfigs(): CountyScraperConfig[] {
    return COUNTY_CONFIGS;
  }

  /**
   * Get configurations by state
   */
  getConfigsByState(stateAbbr: string): CountyScraperConfig[] {
    return getConfigsByState(stateAbbr);
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const scraperEngineV2 = new ScraperEngineV2();
export { ScraperEngineV2 };
