/**
 * Google Custom Search Bot Service
 *
 * Searches for surplus fund PDFs and tax sale lists:
 * - "[county name] surplus funds list PDF"
 * - "[county name] tax sale excess proceeds"
 * - Automatically downloads and parses found PDFs
 *
 * Uses Google Custom Search API (100 free queries/day)
 * or falls back to Puppeteer-based Google scraping
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import crypto from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../../lib/prisma.js';
import { ingestionService } from '../IngestionService.js';
import {
  GoogleSearchConfig,
  GoogleSearchQuery,
  GoogleSearchResult,
  LeadGenerationResult,
} from './types.js';

// =============================================================================
// SEARCH QUERY TEMPLATES
// =============================================================================

const SEARCH_QUERIES: GoogleSearchQuery[] = [
  // Surplus funds queries
  {
    id: 'surplus_funds_pdf',
    queryTemplate: '"{county}" county "{state}" surplus funds list filetype:pdf',
    category: 'surplus_funds',
    enabled: true,
    totalResultsFound: 0,
  },
  {
    id: 'excess_proceeds_pdf',
    queryTemplate: '"{county}" county "{state}" tax sale excess proceeds filetype:pdf',
    category: 'excess_proceeds',
    enabled: true,
    totalResultsFound: 0,
  },
  {
    id: 'tax_sale_surplus',
    queryTemplate: '"{county}" county "{state}" tax deed surplus',
    category: 'surplus_funds',
    enabled: true,
    totalResultsFound: 0,
  },
  {
    id: 'overage_list',
    queryTemplate: '"{county}" "{state}" foreclosure overage list',
    category: 'surplus_funds',
    enabled: true,
    totalResultsFound: 0,
  },
  {
    id: 'unclaimed_excess',
    queryTemplate: '"{state}" unclaimed tax sale excess proceeds 2024',
    category: 'unclaimed',
    enabled: true,
    totalResultsFound: 0,
  },
  {
    id: 'clerk_surplus',
    queryTemplate: '"{county}" county clerk surplus funds available',
    category: 'surplus_funds',
    enabled: true,
    totalResultsFound: 0,
  },
];

// =============================================================================
// TOP COUNTIES TO SEARCH (by population/tax sale volume)
// =============================================================================

const TARGET_COUNTIES: { county: string; state: string; stateAbbr: string }[] = [
  // Texas
  { county: 'Harris', state: 'Texas', stateAbbr: 'TX' },
  { county: 'Dallas', state: 'Texas', stateAbbr: 'TX' },
  { county: 'Tarrant', state: 'Texas', stateAbbr: 'TX' },
  { county: 'Bexar', state: 'Texas', stateAbbr: 'TX' },
  { county: 'Travis', state: 'Texas', stateAbbr: 'TX' },
  // Florida
  { county: 'Miami-Dade', state: 'Florida', stateAbbr: 'FL' },
  { county: 'Broward', state: 'Florida', stateAbbr: 'FL' },
  { county: 'Palm Beach', state: 'Florida', stateAbbr: 'FL' },
  { county: 'Hillsborough', state: 'Florida', stateAbbr: 'FL' },
  { county: 'Orange', state: 'Florida', stateAbbr: 'FL' },
  { county: 'Duval', state: 'Florida', stateAbbr: 'FL' },
  // Georgia
  { county: 'Fulton', state: 'Georgia', stateAbbr: 'GA' },
  { county: 'Gwinnett', state: 'Georgia', stateAbbr: 'GA' },
  { county: 'Cobb', state: 'Georgia', stateAbbr: 'GA' },
  { county: 'DeKalb', state: 'Georgia', stateAbbr: 'GA' },
  // Tennessee
  { county: 'Shelby', state: 'Tennessee', stateAbbr: 'TN' },
  { county: 'Davidson', state: 'Tennessee', stateAbbr: 'TN' },
  { county: 'Knox', state: 'Tennessee', stateAbbr: 'TN' },
  { county: 'Hamilton', state: 'Tennessee', stateAbbr: 'TN' },
  // North Carolina
  { county: 'Mecklenburg', state: 'North Carolina', stateAbbr: 'NC' },
  { county: 'Wake', state: 'North Carolina', stateAbbr: 'NC' },
  { county: 'Guilford', state: 'North Carolina', stateAbbr: 'NC' },
  { county: 'Forsyth', state: 'North Carolina', stateAbbr: 'NC' },
  // California
  { county: 'Los Angeles', state: 'California', stateAbbr: 'CA' },
  { county: 'San Diego', state: 'California', stateAbbr: 'CA' },
  { county: 'Orange', state: 'California', stateAbbr: 'CA' },
  { county: 'Riverside', state: 'California', stateAbbr: 'CA' },
  { county: 'San Bernardino', state: 'California', stateAbbr: 'CA' },
  // Arizona
  { county: 'Maricopa', state: 'Arizona', stateAbbr: 'AZ' },
  { county: 'Pima', state: 'Arizona', stateAbbr: 'AZ' },
  // Nevada
  { county: 'Clark', state: 'Nevada', stateAbbr: 'NV' },
  // Ohio
  { county: 'Cuyahoga', state: 'Ohio', stateAbbr: 'OH' },
  { county: 'Franklin', state: 'Ohio', stateAbbr: 'OH' },
  { county: 'Hamilton', state: 'Ohio', stateAbbr: 'OH' },
  // Michigan
  { county: 'Wayne', state: 'Michigan', stateAbbr: 'MI' },
  { county: 'Oakland', state: 'Michigan', stateAbbr: 'MI' },
  // Pennsylvania
  { county: 'Philadelphia', state: 'Pennsylvania', stateAbbr: 'PA' },
  { county: 'Allegheny', state: 'Pennsylvania', stateAbbr: 'PA' },
];

// =============================================================================
// USER AGENTS
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

// =============================================================================
// GOOGLE SEARCH BOT CLASS
// =============================================================================

class GoogleSearchBot {
  private browser: Browser | null = null;
  private apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  private searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  private downloadDir = process.env.PDF_DOWNLOAD_DIR || './downloads/pdfs';

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
  // GOOGLE CUSTOM SEARCH API
  // ===========================================================================

  /**
   * Search using Google Custom Search API (100 free queries/day)
   */
  async searchWithAPI(query: string): Promise<GoogleSearchResult[]> {
    if (!this.apiKey || !this.searchEngineId) {
      return [];
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodedQuery}`;

      const response = await new Promise<string>((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });

      const data = JSON.parse(response);
      const results: GoogleSearchResult[] = [];

      if (data.items) {
        for (const item of data.items) {
          results.push({
            queryId: crypto.randomUUID(),
            title: item.title || '',
            link: item.link || '',
            snippet: item.snippet || '',
            displayLink: item.displayLink || '',
            fileType: item.fileFormat,
            relevanceScore: this.calculateRelevance(item.title, item.snippet),
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('[GoogleSearchBot] API error:', error.message);
      return [];
    }
  }

  // ===========================================================================
  // PUPPETEER-BASED GOOGLE SEARCH (Fallback)
  // ===========================================================================

  /**
   * Search using Puppeteer when API quota exceeded
   */
  async searchWithPuppeteer(query: string, maxResults: number = 10): Promise<GoogleSearchResult[]> {
    const results: GoogleSearchResult[] = [];
    const page = await this.createStealthPage();

    try {
      // Go to Google
      await page.goto('https://www.google.com', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(1000, 2000);

      // Accept cookies if prompted
      try {
        await page.click('#L2AGLb, button[id*="agree"]');
        await this.randomDelay(500, 1000);
      } catch {
        // No cookie prompt
      }

      // Enter search query
      await page.waitForSelector('input[name="q"], textarea[name="q"]', { timeout: 10000 });
      await page.type('input[name="q"], textarea[name="q"]', query, { delay: 50 });
      await page.keyboard.press('Enter');

      await this.randomDelay(2000, 4000);

      // Wait for results
      await page.waitForSelector('#search, .g', { timeout: 15000 });

      // Extract results
      const searchResults = await page.evaluate(() => {
        const items: any[] = [];
        const resultElements = document.querySelectorAll('.g, [data-hveid]');

        resultElements.forEach((el) => {
          try {
            const linkEl = el.querySelector('a[href^="http"]');
            const titleEl = el.querySelector('h3');
            const snippetEl = el.querySelector('.VwiC3b, [data-sncf], .st');

            if (linkEl && titleEl) {
              items.push({
                link: linkEl.getAttribute('href') || '',
                title: titleEl.textContent?.trim() || '',
                snippet: snippetEl?.textContent?.trim() || '',
              });
            }
          } catch (e) {
            // Skip
          }
        });

        return items;
      });

      for (const item of searchResults.slice(0, maxResults)) {
        results.push({
          queryId: crypto.randomUUID(),
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          displayLink: new URL(item.link).hostname,
          fileType: item.link.toLowerCase().endsWith('.pdf') ? 'pdf' : undefined,
          relevanceScore: this.calculateRelevance(item.title, item.snippet),
        });
      }
    } catch (error: any) {
      console.error('[GoogleSearchBot] Puppeteer search error:', error.message);
    } finally {
      await page.close();
    }

    return results;
  }

  // ===========================================================================
  // PDF DOWNLOAD AND PROCESSING
  // ===========================================================================

  /**
   * Download a PDF from URL
   */
  async downloadPDF(url: string, filename?: string): Promise<string | null> {
    try {
      // Ensure download directory exists
      if (!fs.existsSync(this.downloadDir)) {
        fs.mkdirSync(this.downloadDir, { recursive: true });
      }

      const finalFilename = filename || `${crypto.randomUUID()}.pdf`;
      const filepath = path.join(this.downloadDir, finalFilename);

      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);

        https.get(url, (response) => {
          // Follow redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              fs.unlinkSync(filepath);
              this.downloadPDF(redirectUrl, filename).then(resolve).catch(reject);
              return;
            }
          }

          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(filepath);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve(filepath);
          });
        }).on('error', (err) => {
          file.close();
          fs.unlinkSync(filepath);
          reject(err);
        });
      });
    } catch (error: any) {
      console.error('[GoogleSearchBot] Download error:', error.message);
      return null;
    }
  }

  /**
   * Process downloaded PDF through ingestion
   */
  async processPDF(filepath: string, county: string, state: string): Promise<number> {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');

      const batch = await ingestionService.createBatch(
        `google-search-${county}-${state}`,
        path.basename(filepath),
        filepath
      );

      const result = await ingestionService.processIngestionBatch(
        batch,
        content,
        'PDF'
      );

      return result.created;
    } catch (error: any) {
      console.error('[GoogleSearchBot] PDF processing error:', error.message);
      return 0;
    }
  }

  // ===========================================================================
  // RELEVANCE SCORING
  // ===========================================================================

  private calculateRelevance(title: string, snippet: string): number {
    let score = 0;
    const text = `${title} ${snippet}`.toLowerCase();

    const keywords = [
      { word: 'surplus', score: 20 },
      { word: 'excess proceeds', score: 20 },
      { word: 'overage', score: 15 },
      { word: 'tax sale', score: 15 },
      { word: 'foreclosure', score: 10 },
      { word: 'unclaimed', score: 10 },
      { word: 'former owner', score: 15 },
      { word: 'claim deadline', score: 10 },
      { word: 'pdf', score: 5 },
      { word: '.gov', score: 5 },
      { word: 'county', score: 5 },
      { word: 'treasurer', score: 5 },
      { word: 'clerk', score: 5 },
    ];

    for (const { word, score: wordScore } of keywords) {
      if (text.includes(word)) {
        score += wordScore;
      }
    }

    return Math.min(100, score);
  }

  // ===========================================================================
  // MAIN SEARCH FUNCTIONS
  // ===========================================================================

  /**
   * Search for a specific county
   */
  async searchCounty(
    county: string,
    state: string,
    stateAbbr: string
  ): Promise<GoogleSearchResult[]> {
    const allResults: GoogleSearchResult[] = [];

    for (const queryTemplate of SEARCH_QUERIES) {
      if (!queryTemplate.enabled) continue;

      const query = queryTemplate.queryTemplate
        .replace('{county}', county)
        .replace('{state}', state);

      // Try API first
      let results = await this.searchWithAPI(query);

      // Fallback to Puppeteer if API not configured or failed
      if (results.length === 0) {
        results = await this.searchWithPuppeteer(query);
      }

      // Add county/state info to results
      for (const result of results) {
        result.county = county;
        result.state = stateAbbr;
      }

      allResults.push(...results);

      await this.randomDelay(5000, 10000);
    }

    return allResults;
  }

  /**
   * Run full search across all target counties
   */
  async runFullSearch(
    maxCounties: number = 10,
    downloadPDFs: boolean = true
  ): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    const allResults: GoogleSearchResult[] = [];
    const errors: string[] = [];
    let leadsCreated = 0;

    try {
      await this.launchBrowser();

      for (const target of TARGET_COUNTIES.slice(0, maxCounties)) {
        try {
          const results = await this.searchCounty(
            target.county,
            target.state,
            target.stateAbbr
          );

          allResults.push(...results);

          // Download and process PDFs
          if (downloadPDFs) {
            const pdfResults = results.filter(
              r => r.link.toLowerCase().endsWith('.pdf') && r.relevanceScore >= 30
            );

            for (const pdfResult of pdfResults.slice(0, 3)) { // Max 3 PDFs per county
              try {
                const filepath = await this.downloadPDF(pdfResult.link);
                if (filepath) {
                  const created = await this.processPDF(
                    filepath,
                    target.county,
                    target.stateAbbr
                  );
                  leadsCreated += created;
                  pdfResult.downloadedAt = new Date();
                  pdfResult.parsedRecords = created;
                }
              } catch (e: any) {
                errors.push(`PDF download ${pdfResult.link}: ${e.message}`);
              }

              await this.randomDelay(2000, 4000);
            }
          }

          await this.randomDelay(10000, 20000);
        } catch (error: any) {
          errors.push(`${target.county}, ${target.stateAbbr}: ${error.message}`);
        }
      }
    } finally {
      await this.closeBrowser();
    }

    // Save search results to database
    for (const result of allResults) {
      try {
        await (prisma as any).googleSearchResult?.create({
          data: {
            id: result.queryId,
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            displayLink: result.displayLink,
            fileType: result.fileType,
            state: result.state,
            county: result.county,
            relevanceScore: result.relevanceScore,
            downloadedAt: result.downloadedAt,
            parsedRecords: result.parsedRecords,
          },
        });
      } catch {
        // Table might not exist - silent fail
      }
    }

    return {
      success: errors.length === 0,
      source: 'GOOGLE_SEARCH_BOT',
      leadsFound: allResults.length,
      leadsCreated,
      errors,
      durationMs: Date.now() - startTime,
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Daily
    };
  }

  /**
   * Search for a specific query
   */
  async search(query: string, useAPI: boolean = true): Promise<GoogleSearchResult[]> {
    if (useAPI && this.apiKey) {
      return this.searchWithAPI(query);
    }

    try {
      await this.launchBrowser();
      return await this.searchWithPuppeteer(query);
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Get search query templates
   */
  getQueryTemplates(): GoogleSearchQuery[] {
    return SEARCH_QUERIES;
  }

  /**
   * Get target counties
   */
  getTargetCounties(): typeof TARGET_COUNTIES {
    return TARGET_COUNTIES;
  }
}

export const googleSearchBot = new GoogleSearchBot();
export { GoogleSearchBot };
