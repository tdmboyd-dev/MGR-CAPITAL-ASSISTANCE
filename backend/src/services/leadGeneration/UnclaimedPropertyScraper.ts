/**
 * State Unclaimed Property Scraper Service
 *
 * Scrapers for state unclaimed property databases:
 * - Texas: ClaimItTexas.org
 * - California: claimit.ca.gov
 * - Florida: FLTreasureHunt.gov
 * - And more top states
 *
 * These sites list unclaimed funds that may include surplus from tax sales
 * FREE lead generation - public databases
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { ingestionService } from '../IngestionService.js';
import {
  StateUnclaimedPropertySite,
  UnclaimedPropertyRecord,
  LeadGenerationResult,
} from './types.js';

// =============================================================================
// USER AGENTS FOR STEALTH
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

// =============================================================================
// STATE UNCLAIMED PROPERTY SITES
// =============================================================================

const STATE_SITES: StateUnclaimedPropertySite[] = [
  {
    id: 'texas',
    state: 'Texas',
    stateAbbr: 'TX',
    siteName: 'ClaimItTexas',
    baseUrl: 'https://claimittexas.org',
    searchUrl: 'https://claimittexas.org/app/search',
    enabled: true,
    scraperType: 'texas',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'california',
    state: 'California',
    stateAbbr: 'CA',
    siteName: 'California State Controller',
    baseUrl: 'https://ucpi.sco.ca.gov',
    searchUrl: 'https://ucpi.sco.ca.gov/ucp/Default.aspx',
    enabled: true,
    scraperType: 'california',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'florida',
    state: 'Florida',
    stateAbbr: 'FL',
    siteName: 'Florida Treasury Hunt',
    baseUrl: 'https://fltreasurehunt.gov',
    searchUrl: 'https://fltreasurehunt.gov/Search.aspx',
    enabled: true,
    scraperType: 'florida',
    supportsPropertySearch: true,
    supportsBulkSearch: true,
    totalRecordsScraped: 0,
  },
  {
    id: 'georgia',
    state: 'Georgia',
    stateAbbr: 'GA',
    siteName: 'Georgia Department of Revenue',
    baseUrl: 'https://unclaimed.ga.gov',
    searchUrl: 'https://unclaimed.ga.gov/Ap_Pps/Cntlr',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'tennessee',
    state: 'Tennessee',
    stateAbbr: 'TN',
    siteName: 'Tennessee Treasury',
    baseUrl: 'https://treasury.tn.gov/unclaimed-property',
    searchUrl: 'https://ucp.tn.gov/UCP/Search/tnclaimit',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'north_carolina',
    state: 'North Carolina',
    stateAbbr: 'NC',
    siteName: 'NC Cash',
    baseUrl: 'https://www.nccash.com',
    searchUrl: 'https://www.nccash.com/UcSearch/Search/Default',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: true,
    totalRecordsScraped: 0,
  },
  {
    id: 'ohio',
    state: 'Ohio',
    stateAbbr: 'OH',
    siteName: 'Ohio Missing Money',
    baseUrl: 'https://com.ohio.gov/unclaimed',
    searchUrl: 'https://unclaimedfunds.ohio.gov',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'michigan',
    state: 'Michigan',
    stateAbbr: 'MI',
    siteName: 'Michigan Treasury',
    baseUrl: 'https://unclaimedproperty.michigan.gov',
    searchUrl: 'https://unclaimedproperty.michigan.gov/UCP/PropertySearch',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'arizona',
    state: 'Arizona',
    stateAbbr: 'AZ',
    siteName: 'Arizona Department of Revenue',
    baseUrl: 'https://unclaimed.azdor.gov',
    searchUrl: 'https://unclaimed.azdor.gov/app/property-search',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
  {
    id: 'pennsylvania',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    siteName: 'PA Treasury',
    baseUrl: 'https://www.patreasury.gov',
    searchUrl: 'https://www.patreasury.gov/unclaimed-property/',
    enabled: true,
    scraperType: 'generic',
    supportsPropertySearch: true,
    supportsBulkSearch: false,
    totalRecordsScraped: 0,
  },
];

// =============================================================================
// COMMON LAST NAMES FOR BULK SEARCH
// =============================================================================

const COMMON_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

// =============================================================================
// UNCLAIMED PROPERTY SCRAPER CLASS
// =============================================================================

class UnclaimedPropertyScraper {
  private browser: Browser | null = null;

  // ===========================================================================
  // BROWSER MANAGEMENT
  // ===========================================================================

  async launchBrowser(): Promise<Browser> {
    this.browser = await puppeteer.launch({
      headless: 'shell',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });
    return this.browser;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async createStealthPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(userAgent);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    `);

    return page;
  }

  private async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ===========================================================================
  // TEXAS SCRAPER
  // ===========================================================================

  async scrapeTexas(
    searchNames?: string[],
    maxResults: number = 100
  ): Promise<UnclaimedPropertyRecord[]> {
    const records: UnclaimedPropertyRecord[] = [];
    const page = await this.createStealthPage();
    const namesToSearch = searchNames || COMMON_LAST_NAMES.slice(0, 10);

    try {
      for (const name of namesToSearch) {
        if (records.length >= maxResults) break;

        await page.goto('https://claimittexas.org/app/search', {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        await this.randomDelay(2000, 4000);

        // Enter search term
        try {
          await page.waitForSelector('input[name="lastName"], #lastName, input[type="text"]', { timeout: 10000 });
          await page.type('input[name="lastName"], #lastName, input[type="text"]', name, { delay: 100 });

          // Click search
          await page.click('button[type="submit"], input[type="submit"], .search-button');
          await this.randomDelay(3000, 5000);

          // Wait for results
          await page.waitForSelector('.results, table, .search-results', { timeout: 15000 });

          // Extract results
          const pageRecords = await page.evaluate(() => {
            const results: any[] = [];

            // Try table rows
            const rows = document.querySelectorAll('table tbody tr, .result-row');
            rows.forEach((row) => {
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                  results.push({
                    ownerName: cells[0]?.textContent?.trim(),
                    propertyType: cells[1]?.textContent?.trim(),
                    reportedValue: cells[2]?.textContent?.trim(),
                    reportingCompany: cells[3]?.textContent?.trim(),
                  });
                }
              } catch (e) {
                // Skip
              }
            });

            // Try card format
            const cards = document.querySelectorAll('.property-card, .claim-item');
            cards.forEach((card) => {
              try {
                results.push({
                  ownerName: card.querySelector('.owner, .name')?.textContent?.trim(),
                  propertyType: card.querySelector('.type, .property-type')?.textContent?.trim(),
                  reportedValue: card.querySelector('.value, .amount')?.textContent?.trim(),
                  reportingCompany: card.querySelector('.company, .holder')?.textContent?.trim(),
                });
              } catch (e) {
                // Skip
              }
            });

            return results;
          });

          for (const data of pageRecords) {
            if (data.ownerName) {
              records.push({
                siteId: 'texas',
                recordId: crypto.randomUUID(),
                ownerName: data.ownerName,
                propertyType: data.propertyType || 'Unknown',
                reportedValue: this.parseAmount(data.reportedValue),
                reportingCompany: data.reportingCompany,
                state: 'TX',
                sourceUrl: 'https://claimittexas.org',
                rawData: data,
              });
            }
          }
        } catch (e: any) {
          console.log(`[UnclaimedScraper] Texas search for "${name}" failed:`, e.message);
        }

        await this.randomDelay(3000, 6000);
      }
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // CALIFORNIA SCRAPER
  // ===========================================================================

  async scrapeCalifornia(
    searchNames?: string[],
    maxResults: number = 100
  ): Promise<UnclaimedPropertyRecord[]> {
    const records: UnclaimedPropertyRecord[] = [];
    const page = await this.createStealthPage();
    const namesToSearch = searchNames || COMMON_LAST_NAMES.slice(0, 10);

    try {
      for (const name of namesToSearch) {
        if (records.length >= maxResults) break;

        await page.goto('https://ucpi.sco.ca.gov/ucp/Default.aspx', {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        await this.randomDelay(2000, 4000);

        try {
          // Look for search input
          await page.waitForSelector('#txtOwnerName, input[name*="Owner"], input[placeholder*="name"]', { timeout: 10000 });
          await page.type('#txtOwnerName, input[name*="Owner"], input[placeholder*="name"]', name, { delay: 100 });

          // Submit search
          await page.click('#btnSearch, button[type="submit"], input[type="submit"]');
          await this.randomDelay(3000, 5000);

          // Wait for results
          await page.waitForSelector('.GridView, table, .results', { timeout: 15000 });

          // Extract results
          const pageRecords = await page.evaluate(() => {
            const results: any[] = [];

            const rows = document.querySelectorAll('table tr, .GridView tr');
            rows.forEach((row, idx) => {
              if (idx === 0) return; // Skip header

              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                  results.push({
                    ownerName: cells[0]?.textContent?.trim(),
                    ownerAddress: cells[1]?.textContent?.trim(),
                    propertyType: cells[2]?.textContent?.trim(),
                    reportedValue: cells[3]?.textContent?.trim(),
                    reportingCompany: cells[4]?.textContent?.trim(),
                  });
                }
              } catch (e) {
                // Skip
              }
            });

            return results;
          });

          for (const data of pageRecords) {
            if (data.ownerName) {
              records.push({
                siteId: 'california',
                recordId: crypto.randomUUID(),
                ownerName: data.ownerName,
                ownerAddress: data.ownerAddress,
                propertyType: data.propertyType || 'Unknown',
                reportedValue: this.parseAmount(data.reportedValue),
                reportingCompany: data.reportingCompany,
                state: 'CA',
                sourceUrl: 'https://ucpi.sco.ca.gov',
                rawData: data,
              });
            }
          }
        } catch (e: any) {
          console.log(`[UnclaimedScraper] California search for "${name}" failed:`, e.message);
        }

        await this.randomDelay(3000, 6000);
      }
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // FLORIDA SCRAPER
  // ===========================================================================

  async scrapeFlorida(
    searchNames?: string[],
    maxResults: number = 100
  ): Promise<UnclaimedPropertyRecord[]> {
    const records: UnclaimedPropertyRecord[] = [];
    const page = await this.createStealthPage();
    const namesToSearch = searchNames || COMMON_LAST_NAMES.slice(0, 10);

    try {
      for (const name of namesToSearch) {
        if (records.length >= maxResults) break;

        await page.goto('https://fltreasurehunt.gov', {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        await this.randomDelay(2000, 4000);

        try {
          // Find and fill search input
          await page.waitForSelector('#lastName, input[name*="Last"], input[type="text"]', { timeout: 10000 });
          await page.type('#lastName, input[name*="Last"], input[type="text"]', name, { delay: 100 });

          // Submit
          await page.click('#btnSearch, button[type="submit"], .search-btn');
          await this.randomDelay(3000, 5000);

          // Wait for results
          await page.waitForSelector('#gvResults, table, .results-grid', { timeout: 15000 });

          // Extract results
          const pageRecords = await page.evaluate(() => {
            const results: any[] = [];

            const rows = document.querySelectorAll('#gvResults tr, table tbody tr');
            rows.forEach((row, idx) => {
              if (idx === 0) return; // Skip header

              try {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                  results.push({
                    ownerName: cells[0]?.textContent?.trim(),
                    ownerCity: cells[1]?.textContent?.trim(),
                    propertyType: cells[2]?.textContent?.trim(),
                    reportedValue: cells[3]?.textContent?.trim(),
                    reportingCompany: cells[4]?.textContent?.trim(),
                  });
                }
              } catch (e) {
                // Skip
              }
            });

            return results;
          });

          for (const data of pageRecords) {
            if (data.ownerName) {
              records.push({
                siteId: 'florida',
                recordId: crypto.randomUUID(),
                ownerName: data.ownerName,
                ownerCity: data.ownerCity,
                propertyType: data.propertyType || 'Unknown',
                reportedValue: this.parseAmount(data.reportedValue),
                reportingCompany: data.reportingCompany,
                state: 'FL',
                sourceUrl: 'https://fltreasurehunt.gov',
                rawData: data,
              });
            }
          }
        } catch (e: any) {
          console.log(`[UnclaimedScraper] Florida search for "${name}" failed:`, e.message);
        }

        await this.randomDelay(3000, 6000);
      }
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // GENERIC STATE SCRAPER
  // ===========================================================================

  async scrapeGenericState(
    site: StateUnclaimedPropertySite,
    searchNames?: string[],
    maxResults: number = 100
  ): Promise<UnclaimedPropertyRecord[]> {
    const records: UnclaimedPropertyRecord[] = [];
    const page = await this.createStealthPage();
    const namesToSearch = searchNames || COMMON_LAST_NAMES.slice(0, 5);

    try {
      for (const name of namesToSearch) {
        if (records.length >= maxResults) break;

        try {
          await page.goto(site.searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
          });

          await this.randomDelay(2000, 4000);

          // Try common search input selectors
          const inputSelectors = [
            '#lastName', '#LastName', '#txtLastName',
            'input[name*="last"]', 'input[name*="Last"]',
            'input[placeholder*="name"]', 'input[type="text"]',
          ];

          let found = false;
          for (const selector of inputSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              await page.type(selector, name, { delay: 100 });
              found = true;
              break;
            } catch {
              continue;
            }
          }

          if (!found) continue;

          // Try common submit button selectors
          const buttonSelectors = [
            'button[type="submit"]', 'input[type="submit"]',
            '#btnSearch', '.search-button', '.btn-search',
            'button:contains("Search")',
          ];

          for (const selector of buttonSelectors) {
            try {
              await page.click(selector);
              break;
            } catch {
              continue;
            }
          }

          await this.randomDelay(3000, 5000);

          // Try to find results
          try {
            await page.waitForSelector('table, .results, .grid', { timeout: 10000 });
          } catch {
            continue;
          }

          // Extract results generically
          const pageRecords = await page.evaluate(() => {
            const results: any[] = [];

            const rows = document.querySelectorAll('table tbody tr, .result-row, .property-item');
            rows.forEach((row) => {
              try {
                const cells = row.querySelectorAll('td, .cell');
                if (cells.length >= 2) {
                  results.push({
                    ownerName: cells[0]?.textContent?.trim(),
                    propertyType: cells[1]?.textContent?.trim(),
                    reportedValue: cells[2]?.textContent?.trim(),
                  });
                }
              } catch (e) {
                // Skip
              }
            });

            return results;
          });

          for (const data of pageRecords) {
            if (data.ownerName) {
              records.push({
                siteId: site.id,
                recordId: crypto.randomUUID(),
                ownerName: data.ownerName,
                propertyType: data.propertyType || 'Unknown',
                reportedValue: this.parseAmount(data.reportedValue),
                state: site.stateAbbr,
                sourceUrl: site.searchUrl,
                rawData: data,
              });
            }
          }
        } catch (e: any) {
          console.log(`[UnclaimedScraper] ${site.state} search failed:`, e.message);
        }

        await this.randomDelay(3000, 6000);
      }
    } finally {
      await page.close();
    }

    return records;
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  private parseAmount(value?: string): number | undefined {
    if (!value) return undefined;
    const cleaned = value.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? undefined : Math.round(amount * 100);
  }

  // ===========================================================================
  // MAIN SCRAPE FUNCTION
  // ===========================================================================

  /**
   * Scrape all enabled state unclaimed property sites
   */
  async scrapeAll(
    states?: string[],
    maxResultsPerState: number = 50
  ): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    const allRecords: UnclaimedPropertyRecord[] = [];
    const errors: string[] = [];

    try {
      await this.launchBrowser();

      for (const site of STATE_SITES) {
        if (!site.enabled) continue;
        if (states && !states.includes(site.stateAbbr)) continue;

        try {
          let records: UnclaimedPropertyRecord[] = [];

          switch (site.scraperType) {
            case 'texas':
              records = await this.scrapeTexas(undefined, maxResultsPerState);
              break;
            case 'california':
              records = await this.scrapeCalifornia(undefined, maxResultsPerState);
              break;
            case 'florida':
              records = await this.scrapeFlorida(undefined, maxResultsPerState);
              break;
            default:
              records = await this.scrapeGenericState(site, undefined, maxResultsPerState);
          }

          allRecords.push(...records);
        } catch (error: any) {
          errors.push(`${site.state}: ${error.message}`);
        }

        await this.randomDelay(10000, 20000);
      }
    } finally {
      await this.closeBrowser();
    }

    // Process records - filter for property-related unclaimed funds
    let leadsCreated = 0;
    const propertyRelatedTypes = [
      'real estate', 'property', 'land', 'rent', 'lease',
      'mortgage', 'escrow', 'title', 'deed', 'tax',
    ];

    for (const record of allRecords) {
      const isPropertyRelated = propertyRelatedTypes.some(type =>
        record.propertyType?.toLowerCase().includes(type)
      );

      if (isPropertyRelated && record.reportedValue && record.reportedValue > 10000) {
        try {
          const batch = await ingestionService.createBatch(
            `unclaimed-${record.siteId}`,
            `${record.siteId}-${record.recordId}`,
            record.sourceUrl
          );

          const result = await ingestionService.processBatch(batch, [{
            ownerName: record.ownerName,
            propertyAddress: record.ownerAddress,
            state: record.state,
            surplus: record.reportedValue,
            source: 'unclaimed_property',
          }]);

          leadsCreated += result.created;
        } catch (e) {
          // Silent fail
        }
      }
    }

    return {
      success: errors.length === 0,
      source: 'UNCLAIMED_PROPERTY_SCRAPER',
      leadsFound: allRecords.length,
      leadsCreated,
      errors,
      durationMs: Date.now() - startTime,
      nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Weekly
    };
  }

  /**
   * Scrape a specific state
   */
  async scrapeState(
    stateAbbr: string,
    searchNames?: string[],
    maxResults: number = 100
  ): Promise<UnclaimedPropertyRecord[]> {
    const site = STATE_SITES.find(s => s.stateAbbr === stateAbbr);
    if (!site) return [];

    try {
      await this.launchBrowser();

      switch (site.scraperType) {
        case 'texas':
          return await this.scrapeTexas(searchNames, maxResults);
        case 'california':
          return await this.scrapeCalifornia(searchNames, maxResults);
        case 'florida':
          return await this.scrapeFlorida(searchNames, maxResults);
        default:
          return await this.scrapeGenericState(site, searchNames, maxResults);
      }
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Get available state sites
   */
  getSites(): StateUnclaimedPropertySite[] {
    return STATE_SITES;
  }
}

export const unclaimedPropertyScraper = new UnclaimedPropertyScraper();
export { UnclaimedPropertyScraper };
