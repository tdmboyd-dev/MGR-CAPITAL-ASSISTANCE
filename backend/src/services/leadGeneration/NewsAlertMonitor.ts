/**
 * News & Alert Monitor Service
 *
 * Monitors for new surplus fund opportunities:
 * - Google Alerts for surplus fund keywords
 * - RSS feeds from county websites
 * - Web page change detection
 * - Tax sale announcements
 * - Foreclosure notices
 *
 * FREE lead generation - monitors public sources
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import prisma from '../../lib/prisma.js';
import { ingestionService } from '../IngestionService.js';
import {
  AlertMonitorConfig,
  AlertRecord,
  LeadGenerationResult,
} from './types.js';

// =============================================================================
// ALERT MONITOR CONFIGURATIONS
// =============================================================================

const ALERT_CONFIGS: AlertMonitorConfig[] = [
  // County RSS Feeds (example)
  {
    id: 'harris_county_tax',
    name: 'Harris County Tax Office',
    type: 'rss',
    enabled: true,
    keywords: ['surplus', 'tax sale', 'excess proceeds'],
    sourceUrl: 'https://www.hctax.net/rss',
    checkIntervalMinutes: 60,
    totalAlertsReceived: 0,
  },
  {
    id: 'florida_surplus_news',
    name: 'Florida Surplus News',
    type: 'web_monitor',
    enabled: true,
    keywords: ['surplus funds', 'tax deed', 'excess proceeds'],
    sourceUrl: 'https://www.floridataxdeeds.com/news',
    checkIntervalMinutes: 120,
    totalAlertsReceived: 0,
  },
  // Web monitors for county pages
  {
    id: 'fulton_surplus_list',
    name: 'Fulton County Surplus List',
    type: 'web_monitor',
    enabled: true,
    keywords: ['surplus', 'excess', 'claim'],
    sourceUrl: 'https://www.fultoncountytaxes.org/tax-sales/surplus-funds',
    checkIntervalMinutes: 1440, // Daily
    totalAlertsReceived: 0,
  },
  {
    id: 'shelby_surplus',
    name: 'Shelby County Surplus',
    type: 'web_monitor',
    enabled: true,
    keywords: ['surplus', 'overbid', 'excess'],
    sourceUrl: 'https://www.shelbycountytrustee.com/surplus',
    checkIntervalMinutes: 1440,
    totalAlertsReceived: 0,
  },
  {
    id: 'maricopa_tax_lien',
    name: 'Maricopa Tax Lien Sales',
    type: 'web_monitor',
    enabled: true,
    keywords: ['tax lien', 'surplus', 'excess proceeds'],
    sourceUrl: 'https://treasurer.maricopa.gov/tax-lien-sales',
    checkIntervalMinutes: 1440,
    totalAlertsReceived: 0,
  },
];

// =============================================================================
// GOOGLE NEWS SEARCH QUERIES
// =============================================================================

const NEWS_SEARCH_QUERIES = [
  '"tax sale" "surplus funds" filetype:pdf',
  '"county surplus" "excess proceeds" 2024',
  '"tax deed sale" "overbid" announcement',
  '"foreclosure surplus" claim deadline',
  '"unclaimed funds" "property tax"',
  '"excess proceeds" "former owner" county',
  '"sheriff sale" surplus notification',
  'county treasurer "surplus funds" available',
];

// =============================================================================
// CONTENT HASHES FOR CHANGE DETECTION
// =============================================================================

const contentHashes: Map<string, string> = new Map();

// =============================================================================
// USER AGENTS
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

// =============================================================================
// NEWS ALERT MONITOR CLASS
// =============================================================================

class NewsAlertMonitor {
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

  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(userAgent);

    return page;
  }

  private async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ===========================================================================
  // RSS FEED MONITORING
  // ===========================================================================

  /**
   * Fetch and parse RSS feed
   */
  async fetchRSSFeed(url: string): Promise<AlertRecord[]> {
    const alerts: AlertRecord[] = [];

    try {
      const content = await this.fetchUrl(url);
      if (!content) return alerts;

      // Simple RSS parsing (would use proper XML parser in production)
      const itemMatches = content.matchAll(/<item>([\s\S]*?)<\/item>/gi);

      for (const match of itemMatches) {
        const itemContent = match[1];

        const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
        const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);
        const dateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);

        const title = titleMatch?.[1]?.trim() || '';
        const link = linkMatch?.[1]?.trim() || '';
        const description = descMatch?.[1]?.trim() || '';
        const pubDate = dateMatch?.[1] ? new Date(dateMatch[1]) : new Date();

        // Check for relevant keywords
        const text = `${title} ${description}`.toLowerCase();
        const relevantKeywords = ['surplus', 'excess', 'overage', 'tax sale', 'foreclosure'];
        const isRelevant = relevantKeywords.some(kw => text.includes(kw));

        if (isRelevant) {
          alerts.push({
            monitorId: '',
            title,
            content: description,
            sourceUrl: link,
            publishedAt: pubDate,
            category: 'rss_feed',
            relevanceScore: this.calculateRelevance(title, description),
            processed: false,
          });
        }
      }
    } catch (error: any) {
      console.error('[NewsAlertMonitor] RSS fetch error:', error.message);
    }

    return alerts;
  }

  // ===========================================================================
  // WEB PAGE CHANGE DETECTION
  // ===========================================================================

  /**
   * Monitor web page for changes
   */
  async monitorWebPage(
    config: AlertMonitorConfig
  ): Promise<{ changed: boolean; alerts: AlertRecord[] }> {
    const alerts: AlertRecord[] = [];
    const page = await this.createPage();

    try {
      await page.goto(config.sourceUrl!, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(2000, 4000);

      // Get page content
      const content = await page.evaluate(() => {
        // Remove scripts and styles
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(s => s.remove());
        return document.body.innerText;
      });

      // Calculate content hash
      const contentHash = this.hashContent(content);
      const previousHash = contentHashes.get(config.id);

      // Check if content changed
      const changed = previousHash !== undefined && previousHash !== contentHash;
      contentHashes.set(config.id, contentHash);

      if (changed) {
        // Extract relevant sections
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          const hasKeyword = config.keywords.some(kw => lowerLine.includes(kw.toLowerCase()));

          if (hasKeyword && line.length > 20) {
            alerts.push({
              monitorId: config.id,
              title: `Update detected: ${config.name}`,
              content: line.substring(0, 500),
              sourceUrl: config.sourceUrl!,
              publishedAt: new Date(),
              category: 'web_change',
              relevanceScore: this.calculateRelevance(config.name, line),
              processed: false,
            });
          }
        }

        // Also look for new PDF links
        const pdfLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
          return links.map(link => ({
            href: (link as HTMLAnchorElement).href,
            text: link.textContent?.trim() || '',
          }));
        });

        for (const pdf of pdfLinks) {
          const lowerText = pdf.text.toLowerCase();
          const hasKeyword = config.keywords.some(kw => lowerText.includes(kw.toLowerCase()));

          if (hasKeyword) {
            alerts.push({
              monitorId: config.id,
              title: `New PDF: ${pdf.text}`,
              content: `New surplus-related PDF found: ${pdf.href}`,
              sourceUrl: pdf.href,
              publishedAt: new Date(),
              category: 'new_pdf',
              relevanceScore: 80,
              processed: false,
            });
          }
        }
      }

      return { changed, alerts };
    } catch (error: any) {
      console.error(`[NewsAlertMonitor] Web monitor error for ${config.name}:`, error.message);
      return { changed: false, alerts: [] };
    } finally {
      await page.close();
    }
  }

  // ===========================================================================
  // GOOGLE NEWS SEARCH
  // ===========================================================================

  /**
   * Search Google News for surplus fund articles
   */
  async searchGoogleNews(
    query: string,
    maxResults: number = 10
  ): Promise<AlertRecord[]> {
    const alerts: AlertRecord[] = [];
    const page = await this.createPage();

    try {
      const encodedQuery = encodeURIComponent(query);
      await page.goto(`https://news.google.com/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.randomDelay(3000, 5000);

      // Extract news articles
      const articles = await page.evaluate(() => {
        const results: any[] = [];
        const articleElements = document.querySelectorAll('article, [data-n-tid]');

        articleElements.forEach((el) => {
          try {
            const titleEl = el.querySelector('h3, h4, [class*="title"]');
            const linkEl = el.querySelector('a[href]');
            const sourceEl = el.querySelector('[data-n-tid] time, time');
            const snippetEl = el.querySelector('[class*="snippet"], p');

            if (titleEl && linkEl) {
              results.push({
                title: titleEl.textContent?.trim(),
                link: linkEl.getAttribute('href'),
                source: sourceEl?.textContent?.trim(),
                snippet: snippetEl?.textContent?.trim(),
              });
            }
          } catch (e) {
            // Skip
          }
        });

        return results;
      });

      for (const article of articles.slice(0, maxResults)) {
        let fullUrl = article.link;
        if (fullUrl?.startsWith('./')) {
          fullUrl = `https://news.google.com${fullUrl.substring(1)}`;
        }

        alerts.push({
          monitorId: 'google_news',
          title: article.title || 'News Article',
          content: article.snippet || '',
          sourceUrl: fullUrl || '',
          publishedAt: new Date(),
          category: 'google_news',
          relevanceScore: this.calculateRelevance(article.title || '', article.snippet || ''),
          processed: false,
        });
      }
    } catch (error: any) {
      console.error('[NewsAlertMonitor] Google News error:', error.message);
    } finally {
      await page.close();
    }

    return alerts;
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  private async fetchUrl(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, {
        headers: {
          'User-Agent': USER_AGENTS[0],
          'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private calculateRelevance(title: string, content: string): number {
    let score = 0;
    const text = `${title} ${content}`.toLowerCase();

    const keywords = [
      { word: 'surplus funds', score: 25 },
      { word: 'excess proceeds', score: 25 },
      { word: 'overage', score: 20 },
      { word: 'tax sale', score: 15 },
      { word: 'foreclosure', score: 10 },
      { word: 'former owner', score: 20 },
      { word: 'claim deadline', score: 15 },
      { word: 'unclaimed', score: 15 },
      { word: 'county', score: 5 },
      { word: 'treasurer', score: 10 },
    ];

    for (const { word, score: wordScore } of keywords) {
      if (text.includes(word)) {
        score += wordScore;
      }
    }

    return Math.min(100, score);
  }

  // ===========================================================================
  // MAIN MONITORING FUNCTIONS
  // ===========================================================================

  /**
   * Run all monitors
   */
  async runAllMonitors(): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    const allAlerts: AlertRecord[] = [];
    const errors: string[] = [];
    let leadsCreated = 0;

    try {
      await this.launchBrowser();

      // Run RSS monitors
      for (const config of ALERT_CONFIGS.filter(c => c.type === 'rss' && c.enabled)) {
        try {
          const alerts = await this.fetchRSSFeed(config.sourceUrl!);
          for (const alert of alerts) {
            alert.monitorId = config.id;
          }
          allAlerts.push(...alerts);
        } catch (error: any) {
          errors.push(`RSS ${config.name}: ${error.message}`);
        }

        await this.randomDelay(2000, 4000);
      }

      // Run web monitors
      for (const config of ALERT_CONFIGS.filter(c => c.type === 'web_monitor' && c.enabled)) {
        try {
          const { alerts } = await this.monitorWebPage(config);
          allAlerts.push(...alerts);
        } catch (error: any) {
          errors.push(`Web ${config.name}: ${error.message}`);
        }

        await this.randomDelay(5000, 10000);
      }

      // Run Google News searches
      for (const query of NEWS_SEARCH_QUERIES.slice(0, 3)) { // Limit to 3 queries
        try {
          const alerts = await this.searchGoogleNews(query);
          allAlerts.push(...alerts);
        } catch (error: any) {
          errors.push(`News search: ${error.message}`);
        }

        await this.randomDelay(10000, 20000);
      }
    } finally {
      await this.closeBrowser();
    }

    // Process high-relevance alerts
    for (const alert of allAlerts.filter(a => a.relevanceScore >= 50)) {
      try {
        // Save alert to database
        await (prisma as any).newsAlert?.create({
          data: {
            id: crypto.randomUUID(),
            monitorId: alert.monitorId,
            title: alert.title,
            content: alert.content,
            sourceUrl: alert.sourceUrl,
            publishedAt: alert.publishedAt,
            category: alert.category,
            relevanceScore: alert.relevanceScore,
            processed: false,
          },
        }).catch(() => {});

        // If it's a PDF link, queue for download/processing
        if (alert.category === 'new_pdf' && alert.sourceUrl.endsWith('.pdf')) {
          // Would trigger PDF download and ingestion here
          leadsCreated++; // Placeholder
        }
      } catch (e) {
        // Silent fail
      }
    }

    return {
      success: errors.length === 0,
      source: 'NEWS_ALERT_MONITOR',
      leadsFound: allAlerts.length,
      leadsCreated,
      errors,
      durationMs: Date.now() - startTime,
      nextRunAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // Every 6 hours
    };
  }

  /**
   * Run a specific monitor
   */
  async runMonitor(monitorId: string): Promise<AlertRecord[]> {
    const config = ALERT_CONFIGS.find(c => c.id === monitorId);
    if (!config) return [];

    try {
      await this.launchBrowser();

      switch (config.type) {
        case 'rss':
          return await this.fetchRSSFeed(config.sourceUrl!);
        case 'web_monitor':
          const { alerts } = await this.monitorWebPage(config);
          return alerts;
        default:
          return [];
      }
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Get monitor configurations
   */
  getMonitors(): AlertMonitorConfig[] {
    return ALERT_CONFIGS;
  }

  /**
   * Add a new monitor
   */
  addMonitor(config: Omit<AlertMonitorConfig, 'id' | 'totalAlertsReceived'>): string {
    const id = crypto.randomUUID();
    ALERT_CONFIGS.push({
      ...config,
      id,
      totalAlertsReceived: 0,
    });
    return id;
  }
}

export const newsAlertMonitor = new NewsAlertMonitor();
export { NewsAlertMonitor };
