/**
 * Auction Site Scraper Service
 *
 * Puppeteer-based scrapers for online tax sale auction sites:
 * - Bid4Assets.com - Tax sale auctions
 * - GovEase.com - Government auctions
 * - RealAuction.com - Real estate auctions
 *
 * These sites show completed tax sales = potential surplus funds leads
 * FREE lead generation - scrapes public auction data
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { ingestionService } from '../IngestionService.js';
import {
  AuctionSite,
  AuctionRecord,
  LeadGenerationResult,
  LeadRecord,
} from './types.js';

// =============================================================================
// USER AGENTS FOR STEALTH
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
];

// =============================================================================
// AUCTION SITE CONFIGURATIONS
// =============================================================================

const AUCTION_SITES: AuctionSite[] = [
  {
    id: 'bid4assets',
    name: 'Bid4Assets',
    baseUrl: 'https://www.bid4assets.com',
    enabled: true,
    scraperType: 'bid4assets',
    requiresLogin: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'govease',
    name: 'GovEase',
    baseUrl: 'https://www.govease.com',
    enabled: true,
    scraperType: 'govease',
    requiresLogin: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'realauction',
    name: 'RealAuction',
    baseUrl: 'https://www.realauction.com',
    enabled: true,
    scraperType: 'realauction',
    requiresLogin: false,
    totalRecordsScraped: 0,
  },
];

// =============================================================================
// AUCTION SITE SCRAPER CLASS
// =============================================================================

class AuctionSiteScraper {
  private browser: Browser | null = null;

  // ===========================================================================
  // BROWSER MANAGEMENT
  // ===========================================================================

  /**
   * Launch stealth browser
   */
  async launchBrowser(): Promise<Browser> {
    this.browser = await puppeteer.launch({
      headless: 'shell',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Create stealth page
   */
  async createStealthPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();

    // Random user agent
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(userAgent);

    // Extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    // Override navigator properties
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    `);

    return page;
  }

  /**
   * Random delay
   */
  private async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ===========================================================================
  // BID4ASSETS SCRAPER
  // ===========================================================================

  /**
   * Scrape Bid4Assets completed tax sales
   */
  async scrapeBid4Assets(
    states?: string[],
    maxPages: number = 5
  ): Promise<AuctionRecord[]> {
    const records: AuctionRecord[] = [];
    const page = await this.createStealthPage();

    try {
      // Navigate to completed auctions
      await page.goto('https://www.bid4assets.com/auction/search?status=completed&type=tax', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(2000, 4000);

      let currentPage = 1;

      while (currentPage <= maxPages) {
        // Wait for results
        try {
          await page.waitForSelector('.auction-list, .search-results, [class*="auction"]', { timeout: 10000 });
        } catch {
          break;
        }

        // Extract auction data
        const pageRecords = await page.evaluate(() => {
          const results: any[] = [];

          // Try multiple selectors for auction items
          const selectors = [
            '.auction-item',
            '.search-result-item',
            '[class*="auction-card"]',
            '.property-listing',
            'article[class*="auction"]',
          ];

          let items: Element[] = [];
          for (const selector of selectors) {
            items = Array.from(document.querySelectorAll(selector));
            if (items.length > 0) break;
          }

          items.forEach((item) => {
            try {
              // Extract title/address
              const title = item.querySelector('h2, h3, .title, [class*="title"]')?.textContent?.trim();

              // Extract location
              const location = item.querySelector('.location, [class*="location"], .address')?.textContent?.trim();

              // Extract county/state
              const countyState = item.querySelector('.county, [class*="county"]')?.textContent?.trim();

              // Extract bid amount
              const bidText = item.querySelector('.bid, .price, [class*="bid"], [class*="price"]')?.textContent?.trim();

              // Extract link
              const link = item.querySelector('a[href*="auction"]')?.getAttribute('href');

              // Extract date
              const dateText = item.querySelector('.date, [class*="date"]')?.textContent?.trim();

              if (title || location) {
                results.push({
                  title: title || '',
                  address: location || title || '',
                  countyState: countyState || '',
                  bidAmount: bidText || '',
                  link: link || '',
                  date: dateText || '',
                });
              }
            } catch (e) {
              // Skip failed extractions
            }
          });

          return results;
        });

        // Process extracted data
        for (const data of pageRecords) {
          const record = this.parseAuctionData(data, 'bid4assets');
          if (record) {
            records.push(record);
          }
        }

        // Check for next page
        const hasNextPage = await page.evaluate(() => {
          const nextBtn = document.querySelector('a[rel="next"], .pagination .next, [class*="next-page"]');
          return nextBtn && !nextBtn.classList.contains('disabled');
        });

        if (!hasNextPage) break;

        // Click next page
        await page.click('a[rel="next"], .pagination .next, [class*="next-page"]');
        await this.randomDelay(2000, 4000);
        currentPage++;
      }
    } catch (error: any) {
      console.error('[AuctionScraper] Bid4Assets error:', error.message);
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // GOVEASE SCRAPER
  // ===========================================================================

  /**
   * Scrape GovEase completed auctions
   */
  async scrapeGovEase(
    states?: string[],
    maxPages: number = 5
  ): Promise<AuctionRecord[]> {
    const records: AuctionRecord[] = [];
    const page = await this.createStealthPage();

    try {
      // Navigate to auction results
      await page.goto('https://www.govease.com/auctions?status=closed', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(2000, 4000);

      let currentPage = 1;

      while (currentPage <= maxPages) {
        // Wait for results
        try {
          await page.waitForSelector('[class*="auction"], .property-card, .listing', { timeout: 10000 });
        } catch {
          break;
        }

        // Extract auction data
        const pageRecords = await page.evaluate(() => {
          const results: any[] = [];

          const items = document.querySelectorAll('[class*="auction-item"], .property-card, .listing-card');

          items.forEach((item) => {
            try {
              const title = item.querySelector('.title, h3, h2')?.textContent?.trim();
              const address = item.querySelector('.address, .location')?.textContent?.trim();
              const county = item.querySelector('.county')?.textContent?.trim();
              const state = item.querySelector('.state')?.textContent?.trim();
              const winningBid = item.querySelector('.winning-bid, .final-price, [class*="bid"]')?.textContent?.trim();
              const assessedValue = item.querySelector('.assessed-value, [class*="value"]')?.textContent?.trim();
              const status = item.querySelector('.status, [class*="status"]')?.textContent?.trim();
              const link = item.querySelector('a')?.getAttribute('href');

              if (title || address) {
                results.push({
                  title,
                  address: address || title,
                  county,
                  state,
                  winningBid,
                  assessedValue,
                  status,
                  link,
                });
              }
            } catch (e) {
              // Skip
            }
          });

          return results;
        });

        // Process extracted data
        for (const data of pageRecords) {
          const record = this.parseGovEaseData(data);
          if (record) {
            records.push(record);
          }
        }

        // Check for next page
        const hasNextPage = await page.evaluate(() => {
          const nextBtn = document.querySelector('.pagination .next, [aria-label="Next page"]');
          return nextBtn && !nextBtn.classList.contains('disabled');
        });

        if (!hasNextPage) break;

        await page.click('.pagination .next, [aria-label="Next page"]');
        await this.randomDelay(2000, 4000);
        currentPage++;
      }
    } catch (error: any) {
      console.error('[AuctionScraper] GovEase error:', error.message);
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // REALAUCTION SCRAPER
  // ===========================================================================

  /**
   * Scrape RealAuction completed sales
   */
  async scrapeRealAuction(
    states?: string[],
    maxPages: number = 5
  ): Promise<AuctionRecord[]> {
    const records: AuctionRecord[] = [];
    const page = await this.createStealthPage();

    try {
      // Navigate to completed auctions
      await page.goto('https://www.realauction.com/results', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(2000, 4000);

      let currentPage = 1;

      while (currentPage <= maxPages) {
        // Wait for results
        try {
          await page.waitForSelector('table, .results-list, [class*="property"]', { timeout: 10000 });
        } catch {
          break;
        }

        // Extract from table or list
        const pageRecords = await page.evaluate(() => {
          const results: any[] = [];

          // Try table format first
          const rows = document.querySelectorAll('table tbody tr, .result-row');

          rows.forEach((row) => {
            try {
              const cells = row.querySelectorAll('td, .cell');
              if (cells.length >= 3) {
                results.push({
                  parcel: cells[0]?.textContent?.trim(),
                  address: cells[1]?.textContent?.trim(),
                  county: cells[2]?.textContent?.trim(),
                  saleAmount: cells[3]?.textContent?.trim(),
                  status: cells[4]?.textContent?.trim(),
                });
              }
            } catch (e) {
              // Skip
            }
          });

          // Try card format
          if (results.length === 0) {
            const cards = document.querySelectorAll('.property-card, .result-card');
            cards.forEach((card) => {
              try {
                results.push({
                  address: card.querySelector('.address, .title')?.textContent?.trim(),
                  county: card.querySelector('.county')?.textContent?.trim(),
                  saleAmount: card.querySelector('.price, .amount')?.textContent?.trim(),
                  status: card.querySelector('.status')?.textContent?.trim(),
                  link: card.querySelector('a')?.getAttribute('href'),
                });
              } catch (e) {
                // Skip
              }
            });
          }

          return results;
        });

        // Process extracted data
        for (const data of pageRecords) {
          const record = this.parseRealAuctionData(data);
          if (record) {
            records.push(record);
          }
        }

        // Check for next page
        const hasNextPage = await page.evaluate(() => {
          const nextBtn = document.querySelector('a.next, .pagination-next');
          return nextBtn && !nextBtn.classList.contains('disabled');
        });

        if (!hasNextPage) break;

        await page.click('a.next, .pagination-next');
        await this.randomDelay(2000, 4000);
        currentPage++;
      }
    } catch (error: any) {
      console.error('[AuctionScraper] RealAuction error:', error.message);
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // DATA PARSING HELPERS
  // ===========================================================================

  /**
   * Parse Bid4Assets data
   */
  private parseAuctionData(data: any, siteId: string): AuctionRecord | null {
    if (!data.address && !data.title) return null;

    // Parse location from countyState
    let county = '';
    let state = '';

    if (data.countyState) {
      const parts = data.countyState.split(',').map((s: string) => s.trim());
      county = parts[0] || '';
      state = parts[1] || '';
    }

    // Parse bid amount
    let winningBid: number | undefined;
    if (data.bidAmount) {
      const cleaned = data.bidAmount.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount)) {
        winningBid = Math.round(amount * 100);
      }
    }

    return {
      auctionSiteId: siteId,
      auctionId: crypto.randomUUID(),
      propertyAddress: data.address || data.title || '',
      county,
      state,
      auctionDate: data.date || new Date().toISOString().split('T')[0],
      winningBid,
      status: 'completed',
      sourceUrl: data.link ? `https://www.bid4assets.com${data.link}` : 'https://www.bid4assets.com',
      rawData: data,
    };
  }

  /**
   * Parse GovEase data
   */
  private parseGovEaseData(data: any): AuctionRecord | null {
    if (!data.address && !data.title) return null;

    // Parse amounts
    let winningBid: number | undefined;
    let assessedValue: number | undefined;

    if (data.winningBid) {
      const cleaned = data.winningBid.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount)) winningBid = Math.round(amount * 100);
    }

    if (data.assessedValue) {
      const cleaned = data.assessedValue.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount)) assessedValue = Math.round(amount * 100);
    }

    // Calculate potential surplus
    let surplusAmountCents: number | undefined;
    if (winningBid && assessedValue && winningBid > assessedValue) {
      surplusAmountCents = winningBid - assessedValue;
    }

    return {
      auctionSiteId: 'govease',
      auctionId: crypto.randomUUID(),
      propertyAddress: data.address || data.title || '',
      county: data.county || '',
      state: data.state || '',
      auctionDate: new Date().toISOString().split('T')[0],
      winningBid,
      assessedValue,
      surplusAmountCents,
      status: data.status?.toLowerCase().includes('sold') ? 'completed' : 'completed',
      sourceUrl: data.link ? `https://www.govease.com${data.link}` : 'https://www.govease.com',
      rawData: data,
    };
  }

  /**
   * Parse RealAuction data
   */
  private parseRealAuctionData(data: any): AuctionRecord | null {
    if (!data.address) return null;

    let winningBid: number | undefined;
    if (data.saleAmount) {
      const cleaned = data.saleAmount.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount)) winningBid = Math.round(amount * 100);
    }

    // Parse state from county (often "County Name, ST")
    let county = data.county || '';
    let state = '';
    if (county.includes(',')) {
      const parts = county.split(',').map((s: string) => s.trim());
      county = parts[0];
      state = parts[1] || '';
    }

    return {
      auctionSiteId: 'realauction',
      auctionId: crypto.randomUUID(),
      parcelNumber: data.parcel,
      propertyAddress: data.address,
      county,
      state,
      auctionDate: new Date().toISOString().split('T')[0],
      winningBid,
      status: 'completed',
      sourceUrl: data.link ? `https://www.realauction.com${data.link}` : 'https://www.realauction.com',
      rawData: data,
    };
  }

  // ===========================================================================
  // MAIN SCRAPE FUNCTION
  // ===========================================================================

  /**
   * Scrape all enabled auction sites
   */
  async scrapeAll(
    states?: string[],
    maxPagesPerSite: number = 5
  ): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    const allRecords: AuctionRecord[] = [];
    const errors: string[] = [];

    try {
      await this.launchBrowser();

      // Scrape Bid4Assets
      try {
        const bid4AssetsRecords = await this.scrapeBid4Assets(states, maxPagesPerSite);
        allRecords.push(...bid4AssetsRecords);
      } catch (error: any) {
        errors.push(`Bid4Assets: ${error.message}`);
      }

      await this.randomDelay(5000, 10000);

      // Scrape GovEase
      try {
        const govEaseRecords = await this.scrapeGovEase(states, maxPagesPerSite);
        allRecords.push(...govEaseRecords);
      } catch (error: any) {
        errors.push(`GovEase: ${error.message}`);
      }

      await this.randomDelay(5000, 10000);

      // Scrape RealAuction
      try {
        const realAuctionRecords = await this.scrapeRealAuction(states, maxPagesPerSite);
        allRecords.push(...realAuctionRecords);
      } catch (error: any) {
        errors.push(`RealAuction: ${error.message}`);
      }
    } finally {
      await this.closeBrowser();
    }

    // Process records into leads
    let leadsCreated = 0;

    for (const record of allRecords) {
      if (record.propertyAddress && record.state) {
        try {
          // Check for existing case
          const existing = await prisma.case.findFirst({
            where: {
              propertyAddress: record.propertyAddress,
              state: record.state,
            },
          });

          if (!existing && record.surplusAmountCents && record.surplusAmountCents > 10000) {
            // Create lead via ingestion
            const batch = await ingestionService.createBatch(
              `auction-${record.auctionSiteId}`,
              `${record.auctionSiteId}-${record.auctionId}`,
              record.sourceUrl
            );

            const result = await ingestionService.processBatch(batch, [{
              ownerName: record.previousOwner,
              propertyAddress: record.propertyAddress,
              parcelNumber: record.parcelNumber,
              saleDate: record.auctionDate,
              saleAmount: record.winningBid,
              surplus: record.surplusAmountCents,
              county: record.county,
              state: record.state,
              source: 'auction_scrape',
            }]);

            leadsCreated += result.created;
          }
        } catch (e) {
          // Silent fail for individual records
        }
      }
    }

    return {
      success: errors.length === 0,
      source: 'AUCTION_SCRAPER',
      leadsFound: allRecords.length,
      leadsCreated,
      errors,
      durationMs: Date.now() - startTime,
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    };
  }

  /**
   * Scrape a specific auction site
   */
  async scrapeSite(
    siteId: string,
    states?: string[],
    maxPages: number = 5
  ): Promise<AuctionRecord[]> {
    try {
      await this.launchBrowser();

      switch (siteId) {
        case 'bid4assets':
          return await this.scrapeBid4Assets(states, maxPages);
        case 'govease':
          return await this.scrapeGovEase(states, maxPages);
        case 'realauction':
          return await this.scrapeRealAuction(states, maxPages);
        default:
          return [];
      }
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Get available auction sites
   */
  getSites(): AuctionSite[] {
    return AUCTION_SITES;
  }
}

export const auctionSiteScraper = new AuctionSiteScraper();
export { AuctionSiteScraper };
