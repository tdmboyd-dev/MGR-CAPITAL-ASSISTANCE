/**
 * UrlScoutService.ts - Automatic URL Discovery for County Surplus Pages
 *
 * Given a county website, automatically finds surplus/tax sale pages
 * by crawling and analyzing link patterns.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { DiscoveredUrl, UrlScoutResult } from './types.js';
import logger from '../../utils/logger.js';
import prisma from '../../lib/prisma.js';

// =============================================================================
// SEARCH PATTERNS
// =============================================================================

interface SearchPattern {
  keywords: string[];
  urlPatterns: RegExp[];
  textPatterns: RegExp[];
  confidence: number;
  category: 'surplus' | 'tax_sale' | 'foreclosure' | 'clerk' | 'auction';
}

const SEARCH_PATTERNS: SearchPattern[] = [
  // Surplus Funds - Highest Priority
  {
    keywords: ['surplus', 'excess funds', 'excess proceeds', 'overage', 'overages'],
    urlPatterns: [
      /surplus/i,
      /excess[-_]?(funds|proceeds)/i,
      /overage/i,
      /unclaimed[-_]?funds/i,
    ],
    textPatterns: [
      /surplus\s+funds?/i,
      /excess\s+(funds?|proceeds?)/i,
      /overage\s+funds?/i,
      /unclaimed\s+funds?/i,
    ],
    confidence: 90,
    category: 'surplus',
  },

  // Tax Sale
  {
    keywords: ['tax sale', 'tax lien', 'tax deed', 'delinquent tax'],
    urlPatterns: [
      /tax[-_]?sale/i,
      /tax[-_]?lien/i,
      /tax[-_]?deed/i,
      /delinquent[-_]?tax/i,
    ],
    textPatterns: [
      /tax\s+sale/i,
      /tax\s+lien\s+sale/i,
      /tax\s+deed\s+sale/i,
      /delinquent\s+tax/i,
    ],
    confidence: 80,
    category: 'tax_sale',
  },

  // Foreclosure
  {
    keywords: ['foreclosure', 'sheriff sale', 'judicial sale'],
    urlPatterns: [
      /foreclosure/i,
      /sheriff[-_]?sale/i,
      /judicial[-_]?sale/i,
    ],
    textPatterns: [
      /foreclosure/i,
      /sheriff('s)?\s+sale/i,
      /judicial\s+sale/i,
    ],
    confidence: 75,
    category: 'foreclosure',
  },

  // Public Auction
  {
    keywords: ['auction', 'public auction', 'property auction', 'real estate auction'],
    urlPatterns: [
      /auction/i,
      /public[-_]?auction/i,
      /property[-_]?auction/i,
    ],
    textPatterns: [
      /public\s+auction/i,
      /property\s+auction/i,
      /real\s+estate\s+auction/i,
    ],
    confidence: 70,
    category: 'auction',
  },

  // Clerk/Recorder
  {
    keywords: ['clerk', 'recorder', 'records', 'recording'],
    urlPatterns: [
      /clerk/i,
      /recorder/i,
      /recording/i,
    ],
    textPatterns: [
      /clerk('s)?\s+office/i,
      /county\s+recorder/i,
      /official\s+records/i,
    ],
    confidence: 60,
    category: 'clerk',
  },
];

// Common URL patterns for government sites
const GOVERNMENT_DEPARTMENTS = [
  'treasurer', 'tax', 'finance', 'revenue', 'assessment',
  'property', 'real-estate', 'collections', 'delinquent',
];

// =============================================================================
// URL SCOUT SERVICE
// =============================================================================

class UrlScoutService {
  private browser: Browser | null = null;

  /**
   * Launch browser for scouting
   */
  async launchBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'shell',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
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
   * Scout a base URL for surplus/tax sale related pages
   */
  async scoutUrl(
    baseUrl: string,
    county: string,
    state: string,
    options: {
      maxDepth?: number;
      maxPages?: number;
      timeout?: number;
    } = {}
  ): Promise<UrlScoutResult> {
    const startTime = Date.now();
    const maxDepth = options.maxDepth || 2;
    const maxPages = options.maxPages || 20;
    const timeout = options.timeout || 30000;

    const visited = new Set<string>();
    const toVisit: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];
    const discovered: Map<string, DiscoveredUrl> = new Map();

    logger.info(`[UrlScout] Starting scout for ${county}, ${state}: ${baseUrl}`);

    try {
      await this.launchBrowser();
      const page = await this.browser!.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      try {
        while (toVisit.length > 0 && visited.size < maxPages) {
          const current = toVisit.shift()!;
          if (visited.has(current.url)) continue;

          visited.add(current.url);

          try {
            await page.goto(current.url, {
              waitUntil: 'domcontentloaded',
              timeout,
            });

            // Extract all links from page
            const links = await this.extractLinks(page, baseUrl);

            // Analyze each link
            for (const link of links) {
              const analysis = this.analyzeLink(link.href, link.text, link.title);
              if (analysis && !discovered.has(link.href)) {
                discovered.set(link.href, analysis);

                // Queue for deeper crawling if relevant and within depth limit
                if (analysis.confidence >= 50 && current.depth < maxDepth) {
                  toVisit.push({ url: link.href, depth: current.depth + 1 });
                }
              }
            }

            // Respect rate limiting
            await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
          } catch (pageError) {
            logger.warn(`[UrlScout] Failed to process ${current.url}: ${pageError}`);
          }
        }
      } finally {
        await page.close();
      }

      // Categorize discovered URLs
      const surplusUrls: DiscoveredUrl[] = [];
      const taxSaleUrls: DiscoveredUrl[] = [];
      const clerkUrls: DiscoveredUrl[] = [];
      const pdfUrls: DiscoveredUrl[] = [];

      for (const [url, discoveredUrl] of discovered) {
        if (discoveredUrl.linkType === 'pdf') {
          pdfUrls.push(discoveredUrl);
        }

        const keywords = discoveredUrl.keywords;
        if (keywords.some((k) => ['surplus', 'excess', 'overage'].includes(k.toLowerCase()))) {
          surplusUrls.push(discoveredUrl);
        } else if (keywords.some((k) => ['tax sale', 'tax lien', 'foreclosure', 'auction'].includes(k.toLowerCase()))) {
          taxSaleUrls.push(discoveredUrl);
        } else if (keywords.some((k) => ['clerk', 'recorder'].includes(k.toLowerCase()))) {
          clerkUrls.push(discoveredUrl);
        }
      }

      // Sort by confidence
      const sortByConfidence = (a: DiscoveredUrl, b: DiscoveredUrl) => b.confidence - a.confidence;

      return {
        success: true,
        baseUrl,
        county,
        state,
        surplusUrls: surplusUrls.sort(sortByConfidence),
        taxSaleUrls: taxSaleUrls.sort(sortByConfidence),
        clerkUrls: clerkUrls.sort(sortByConfidence),
        pdfUrls: pdfUrls.sort(sortByConfidence),
        scannedAt: new Date(),
        pagesScanned: visited.size,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[UrlScout] Scout failed: ${errorMsg}`);

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
        pagesScanned: visited.size,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Extract all links from a page
   */
  private async extractLinks(
    page: Page,
    baseUrl: string
  ): Promise<Array<{ href: string; text: string; title: string }>> {
    try {
      const baseDomain = new URL(baseUrl).hostname;

      const links = await page.$$eval('a[href]', (anchors, domain) => {
        return anchors
          .map((a) => {
            const anchor = a as any;
            return {
              href: anchor.href || '',
              text: anchor.textContent?.trim() || '',
              title: anchor.getAttribute('title') || '',
            };
          })
          .filter((link) => {
            try {
              const url = new URL(link.href);
              // Only include links from the same domain or subdomains
              return url.hostname.includes(domain.replace('www.', '')) ||
                     domain.includes(url.hostname.replace('www.', ''));
            } catch {
              return false;
            }
          });
      }, baseDomain.replace('www.', ''));

      return links;
    } catch (error) {
      logger.warn(`[UrlScout] Failed to extract links: ${error}`);
      return [];
    }
  }

  /**
   * Analyze a link for relevance
   */
  private analyzeLink(href: string, text: string, title: string): DiscoveredUrl | null {
    const lowerHref = href.toLowerCase();
    const lowerText = text.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const combined = `${lowerHref} ${lowerText} ${lowerTitle}`;

    let highestConfidence = 0;
    let matchedKeywords: string[] = [];
    let matchedCategory = '';

    // Check against all patterns
    for (const pattern of SEARCH_PATTERNS) {
      let patternScore = 0;
      const patternKeywords: string[] = [];

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (combined.includes(keyword)) {
          patternScore += 20;
          patternKeywords.push(keyword);
        }
      }

      // Check URL patterns
      for (const urlPattern of pattern.urlPatterns) {
        if (urlPattern.test(lowerHref)) {
          patternScore += 30;
        }
      }

      // Check text patterns
      for (const textPattern of pattern.textPatterns) {
        if (textPattern.test(lowerText) || textPattern.test(lowerTitle)) {
          patternScore += 25;
        }
      }

      // Apply base confidence from pattern
      if (patternScore > 0) {
        patternScore = Math.min(100, patternScore + (pattern.confidence / 2));
      }

      if (patternScore > highestConfidence) {
        highestConfidence = patternScore;
        matchedKeywords = patternKeywords;
        matchedCategory = pattern.category;
      }
    }

    // Check for government department URLs
    for (const dept of GOVERNMENT_DEPARTMENTS) {
      if (lowerHref.includes(dept)) {
        highestConfidence = Math.min(100, highestConfidence + 10);
      }
    }

    if (highestConfidence < 30) {
      return null;
    }

    // Determine link type
    let linkType: DiscoveredUrl['linkType'] = 'page';
    if (lowerHref.endsWith('.pdf')) {
      linkType = 'pdf';
      highestConfidence = Math.min(100, highestConfidence + 5);
    } else if (lowerHref.includes('download') || lowerHref.includes('export')) {
      linkType = 'download';
    }

    return {
      url: href,
      title: text || title || href,
      context: `Category: ${matchedCategory}, Text: ${text.substring(0, 100)}`,
      confidence: Math.round(highestConfidence),
      keywords: matchedKeywords,
      linkType,
    };
  }

  /**
   * Save discovered URLs to database as WatchTargets
   */
  async saveDiscoveredUrls(result: UrlScoutResult): Promise<number> {
    let savedCount = 0;

    try {
      // Save surplus URLs
      for (const url of result.surplusUrls.slice(0, 5)) {
        if (url.confidence < 50) continue;

        const existing = await prisma.watchTarget.findFirst({
          where: { url: url.url },
        });

        if (!existing) {
          await prisma.watchTarget.create({
            data: {
              name: `${result.county} ${result.state} - ${url.title.substring(0, 50)}`,
              url: url.url,
              type: 'COUNTY_SURPLUS',
              state: result.state,
              county: result.county,
              isActive: true,
              enabled: true,
              watchType: 'SURPLUS_LIST',
              metadata: {
                discoveredAt: new Date().toISOString(),
                confidence: url.confidence,
                keywords: url.keywords,
                scoutedFrom: result.baseUrl,
              },
            },
          });
          savedCount++;
        }
      }

      // Save tax sale URLs
      for (const url of result.taxSaleUrls.slice(0, 3)) {
        if (url.confidence < 50) continue;

        const existing = await prisma.watchTarget.findFirst({
          where: { url: url.url },
        });

        if (!existing) {
          await prisma.watchTarget.create({
            data: {
              name: `${result.county} ${result.state} Tax Sale - ${url.title.substring(0, 40)}`,
              url: url.url,
              type: 'TAX_SALE_CALENDAR',
              state: result.state,
              county: result.county,
              isActive: true,
              enabled: true,
              watchType: 'TAX_SALE_LIST',
              metadata: {
                discoveredAt: new Date().toISOString(),
                confidence: url.confidence,
                keywords: url.keywords,
                scoutedFrom: result.baseUrl,
              },
            },
          });
          savedCount++;
        }
      }

      logger.info(`[UrlScout] Saved ${savedCount} new WatchTargets for ${result.county}, ${result.state}`);
    } catch (error) {
      logger.error(`[UrlScout] Failed to save URLs: ${error}`);
    }

    return savedCount;
  }

  /**
   * Scout all counties that don't have URLs yet
   */
  async scoutMissingCounties(stateAbbr?: string): Promise<{
    scouted: number;
    urlsFound: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let scouted = 0;
    let urlsFound = 0;

    try {
      // Find counties without surplus URLs
      const where: Record<string, unknown> = {
        OR: [
          { surplusUrls: { equals: [] } },
          { surplusUrls: { equals: null as unknown } },
        ],
      };

      if (stateAbbr) {
        where.stateAbbr = stateAbbr;
      }

      // This would need county configs with base URLs
      // For now, we'll use the existing configs and try to discover more URLs
      const configs = await import('./countyConfigs.js');
      const countyConfigs = configs.COUNTY_CONFIGS.filter((c) => {
        if (stateAbbr && c.stateAbbr !== stateAbbr) return false;
        return true;
      });

      for (const config of countyConfigs) {
        // Get base URL from existing URLs
        const baseUrl = config.surplusUrls[0] || config.taxSaleUrls[0];
        if (!baseUrl) continue;

        try {
          // Extract domain for base URL
          const url = new URL(baseUrl);
          const domainBase = `${url.protocol}//${url.hostname}`;

          const result = await this.scoutUrl(domainBase, config.county, config.stateAbbr);
          scouted++;

          if (result.success) {
            urlsFound += result.surplusUrls.length + result.taxSaleUrls.length;
            await this.saveDiscoveredUrls(result);
          }

          // Rate limiting
          await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${config.county}, ${config.stateAbbr}: ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Global error: ${msg}`);
    }

    return { scouted, urlsFound, errors };
  }

  /**
   * Build Google search queries for finding county surplus pages
   */
  generateSearchQueries(county: string, state: string): string[] {
    return [
      `"${county}" county "${state}" surplus funds site:.gov`,
      `"${county}" county "${state}" excess proceeds tax sale site:.gov`,
      `"${county}" county "${state}" tax deed surplus site:.gov`,
      `"${county}" county treasurer surplus funds`,
      `"${county}" "${state}" unclaimed tax sale funds`,
      `site:${county.toLowerCase().replace(/\s+/g, '')}county.gov surplus`,
      `site:${county.toLowerCase().replace(/\s+/g, '')}county.org excess proceeds`,
    ];
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const urlScoutService = new UrlScoutService();
export { UrlScoutService };
