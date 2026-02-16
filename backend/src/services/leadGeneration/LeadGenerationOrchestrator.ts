/**
 * Lead Generation Orchestrator Service
 *
 * Coordinates all lead generation services:
 * - FOIA Request Bot
 * - Auction Site Scrapers
 * - State Unclaimed Property Scrapers
 * - Google Custom Search
 * - News/Alert Monitor
 *
 * Manages scheduling, deduplication, and automatic case creation
 */

import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { foiaRequestBot } from './FOIARequestBot.js';
import { auctionSiteScraper } from './AuctionSiteScraper.js';
import { unclaimedPropertyScraper } from './UnclaimedPropertyScraper.js';
import { googleSearchBot } from './GoogleSearchBot.js';
import { newsAlertMonitor } from './NewsAlertMonitor.js';
import {
  LeadGenerationResult,
  LeadGenStats,
  LeadSourceType,
} from './types.js';

// =============================================================================
// ORCHESTRATOR CONFIGURATION
// =============================================================================

interface OrchestratorConfig {
  enabled: boolean;
  runIntervalMinutes: number;
  maxLeadsPerRun: number;
  prioritizeHighValue: boolean;
  autoCreateCases: boolean;
  targetStates: string[];
  excludeStates: string[];
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enabled: true,
  runIntervalMinutes: 360, // Every 6 hours
  maxLeadsPerRun: 500,
  prioritizeHighValue: true,
  autoCreateCases: true,
  targetStates: ['TX', 'FL', 'GA', 'TN', 'NC', 'CA', 'AZ', 'NV', 'OH', 'MI'],
  excludeStates: [],
};

// =============================================================================
// LEAD GENERATION ORCHESTRATOR CLASS
// =============================================================================

class LeadGenerationOrchestrator {
  private config: OrchestratorConfig = DEFAULT_CONFIG;
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private scheduledRunTimer: NodeJS.Timeout | null = null;

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Update orchestrator configuration
   */
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // MAIN ORCHESTRATION
  // ===========================================================================

  /**
   * Run all lead generation services
   */
  async runAll(): Promise<{
    success: boolean;
    totalLeadsFound: number;
    totalLeadsCreated: number;
    results: LeadGenerationResult[];
    errors: string[];
    durationMs: number;
  }> {
    if (this.isRunning) {
      return {
        success: false,
        totalLeadsFound: 0,
        totalLeadsCreated: 0,
        results: [],
        errors: ['Lead generation already running'],
        durationMs: 0,
      };
    }

    const startTime = Date.now();
    this.isRunning = true;
    const results: LeadGenerationResult[] = [];
    const allErrors: string[] = [];
    let totalLeadsFound = 0;
    let totalLeadsCreated = 0;

    try {
      console.log('[LeadGenOrchestrator] Starting lead generation run...');

      // 1. Run FOIA Request Bot (send new requests)
      try {
        console.log('[LeadGenOrchestrator] Running FOIA Request Bot...');
        const foiaResult = await foiaRequestBot.sendBatchRequests(
          undefined, // All states
          10 // Max 10 new requests per run
        );
        results.push(foiaResult);
        totalLeadsFound += foiaResult.leadsFound;
        totalLeadsCreated += foiaResult.leadsCreated;
        allErrors.push(...foiaResult.errors);
      } catch (error: any) {
        allErrors.push(`FOIA Bot: ${error.message}`);
      }

      // 2. Run Auction Site Scrapers
      try {
        console.log('[LeadGenOrchestrator] Running Auction Site Scrapers...');
        const auctionResult = await auctionSiteScraper.scrapeAll(
          this.config.targetStates,
          3 // Max pages per site
        );
        results.push(auctionResult);
        totalLeadsFound += auctionResult.leadsFound;
        totalLeadsCreated += auctionResult.leadsCreated;
        allErrors.push(...auctionResult.errors);
      } catch (error: any) {
        allErrors.push(`Auction Scraper: ${error.message}`);
      }

      // 3. Run Unclaimed Property Scrapers (weekly)
      const lastUnclaimedRun = await this.getLastRunTime('UNCLAIMED_PROPERTY_SCRAPER');
      const shouldRunUnclaimed = !lastUnclaimedRun ||
        Date.now() - lastUnclaimedRun.getTime() > 7 * 24 * 60 * 60 * 1000;

      if (shouldRunUnclaimed) {
        try {
          console.log('[LeadGenOrchestrator] Running Unclaimed Property Scrapers...');
          const unclaimedResult = await unclaimedPropertyScraper.scrapeAll(
            this.config.targetStates,
            50 // Max results per state
          );
          results.push(unclaimedResult);
          totalLeadsFound += unclaimedResult.leadsFound;
          totalLeadsCreated += unclaimedResult.leadsCreated;
          allErrors.push(...unclaimedResult.errors);
        } catch (error: any) {
          allErrors.push(`Unclaimed Property: ${error.message}`);
        }
      }

      // 4. Run Google Search Bot (daily)
      const lastGoogleRun = await this.getLastRunTime('GOOGLE_SEARCH_BOT');
      const shouldRunGoogle = !lastGoogleRun ||
        Date.now() - lastGoogleRun.getTime() > 24 * 60 * 60 * 1000;

      if (shouldRunGoogle) {
        try {
          console.log('[LeadGenOrchestrator] Running Google Search Bot...');
          const googleResult = await googleSearchBot.runFullSearch(
            10, // Max 10 counties per run
            true // Download PDFs
          );
          results.push(googleResult);
          totalLeadsFound += googleResult.leadsFound;
          totalLeadsCreated += googleResult.leadsCreated;
          allErrors.push(...googleResult.errors);
        } catch (error: any) {
          allErrors.push(`Google Search: ${error.message}`);
        }
      }

      // 5. Run News Alert Monitor
      try {
        console.log('[LeadGenOrchestrator] Running News Alert Monitor...');
        const newsResult = await newsAlertMonitor.runAllMonitors();
        results.push(newsResult);
        totalLeadsFound += newsResult.leadsFound;
        totalLeadsCreated += newsResult.leadsCreated;
        allErrors.push(...newsResult.errors);
      } catch (error: any) {
        allErrors.push(`News Monitor: ${error.message}`);
      }

      // 6. Send FOIA follow-ups (for requests > 14 days old)
      try {
        const followUpsSent = await foiaRequestBot.sendFollowUps(14);
        if (followUpsSent > 0) {
          console.log(`[LeadGenOrchestrator] Sent ${followUpsSent} FOIA follow-ups`);
        }
      } catch (error: any) {
        allErrors.push(`FOIA Follow-ups: ${error.message}`);
      }

      // Record run statistics
      await this.recordRunStats({
        totalLeadsFound,
        totalLeadsCreated,
        errors: allErrors.length,
        durationMs: Date.now() - startTime,
      });

      this.lastRunAt = new Date();

      return {
        success: allErrors.length === 0,
        totalLeadsFound,
        totalLeadsCreated,
        results,
        errors: allErrors,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a specific lead generation service
   */
  async runService(
    service: 'foia' | 'auctions' | 'unclaimed' | 'google' | 'news'
  ): Promise<LeadGenerationResult> {
    switch (service) {
      case 'foia':
        return foiaRequestBot.sendBatchRequests(undefined, 10);
      case 'auctions':
        return auctionSiteScraper.scrapeAll(this.config.targetStates, 5);
      case 'unclaimed':
        return unclaimedPropertyScraper.scrapeAll(this.config.targetStates, 100);
      case 'google':
        return googleSearchBot.runFullSearch(10, true);
      case 'news':
        return newsAlertMonitor.runAllMonitors();
      default:
        return {
          success: false,
          source: 'UNKNOWN',
          leadsFound: 0,
          leadsCreated: 0,
          errors: ['Unknown service'],
          durationMs: 0,
        };
    }
  }

  // ===========================================================================
  // SCHEDULING
  // ===========================================================================

  /**
   * Start automatic scheduling
   */
  startScheduler(): void {
    if (this.scheduledRunTimer) {
      clearInterval(this.scheduledRunTimer);
    }

    const intervalMs = this.config.runIntervalMinutes * 60 * 1000;

    this.scheduledRunTimer = setInterval(async () => {
      if (this.config.enabled && !this.isRunning) {
        console.log('[LeadGenOrchestrator] Running scheduled lead generation...');
        await this.runAll();
      }
    }, intervalMs);

    console.log(`[LeadGenOrchestrator] Scheduler started. Running every ${this.config.runIntervalMinutes} minutes.`);
  }

  /**
   * Stop automatic scheduling
   */
  stopScheduler(): void {
    if (this.scheduledRunTimer) {
      clearInterval(this.scheduledRunTimer);
      this.scheduledRunTimer = null;
      console.log('[LeadGenOrchestrator] Scheduler stopped.');
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get comprehensive lead generation statistics
   */
  async getStats(): Promise<LeadGenStats> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Query ingestion records for lead stats
    const allRecords = await prisma.ingestionRecord.findMany({
      where: {
        createdAt: { gte: last30Days },
      },
      select: {
        surplusAmount: true,
        rawData: true,
        createdAt: true,
        caseId: true,
      },
    });

    // Calculate stats
    const bySource: Record<LeadSourceType, number> = {
      FOIA_RESPONSE: 0,
      AUCTION_SCRAPE: 0,
      UNCLAIMED_PROPERTY: 0,
      COURT_RECORD: 0,
      GOOGLE_SEARCH: 0,
      NEWS_ALERT: 0,
      COUNTY_WEBSITE: 0,
    };

    const byState: Record<string, number> = {};
    let totalSurplus = 0;
    let last24HoursCount = 0;
    let last7DaysCount = 0;
    let casesCreated = 0;

    for (const record of allRecords) {
      const rawData = record.rawData as any;
      const source = rawData?.source || 'COUNTY_WEBSITE';
      const state = rawData?.state || 'UNKNOWN';

      if (bySource[source as LeadSourceType] !== undefined) {
        bySource[source as LeadSourceType]++;
      }

      byState[state] = (byState[state] || 0) + 1;

      if (record.surplusAmount) {
        totalSurplus += record.surplusAmount;
      }

      if (record.createdAt >= last24Hours) last24HoursCount++;
      if (record.createdAt >= last7Days) last7DaysCount++;
      if (record.caseId) casesCreated++;
    }

    // Calculate top states
    const topStates = Object.entries(byState)
      .map(([state, count]) => ({
        state,
        count,
        avgSurplus: 0, // Would calculate from actual data
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate top counties (would need county data in records)
    const topCounties: { county: string; state: string; count: number }[] = [];

    return {
      totalLeads: allRecords.length,
      bySource,
      byState,
      last24Hours: last24HoursCount,
      last7Days: last7DaysCount,
      last30Days: allRecords.length,
      conversionRate: allRecords.length > 0 ? (casesCreated / allRecords.length) * 100 : 0,
      avgSurplusAmount: allRecords.length > 0 ? totalSurplus / allRecords.length : 0,
      topStates,
      topCounties,
    };
  }

  /**
   * Get status of all lead generation services
   */
  async getServiceStatus(): Promise<{
    orchestrator: {
      isRunning: boolean;
      lastRunAt: Date | null;
      schedulerActive: boolean;
      config: OrchestratorConfig;
    };
    services: {
      name: string;
      status: 'ready' | 'running' | 'error';
      lastRunAt: Date | null;
      nextRunAt: Date | null;
    }[];
  }> {
    const services = [
      {
        name: 'FOIA Request Bot',
        status: 'ready' as const,
        lastRunAt: await this.getLastRunTime('FOIA_REQUEST_BOT'),
        nextRunAt: null,
      },
      {
        name: 'Auction Site Scraper',
        status: 'ready' as const,
        lastRunAt: await this.getLastRunTime('AUCTION_SCRAPER'),
        nextRunAt: null,
      },
      {
        name: 'Unclaimed Property Scraper',
        status: 'ready' as const,
        lastRunAt: await this.getLastRunTime('UNCLAIMED_PROPERTY_SCRAPER'),
        nextRunAt: null,
      },
      {
        name: 'Google Search Bot',
        status: 'ready' as const,
        lastRunAt: await this.getLastRunTime('GOOGLE_SEARCH_BOT'),
        nextRunAt: null,
      },
      {
        name: 'News Alert Monitor',
        status: 'ready' as const,
        lastRunAt: await this.getLastRunTime('NEWS_ALERT_MONITOR'),
        nextRunAt: null,
      },
    ];

    return {
      orchestrator: {
        isRunning: this.isRunning,
        lastRunAt: this.lastRunAt,
        schedulerActive: this.scheduledRunTimer !== null,
        config: this.config,
      },
      services,
    };
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Get last run time for a service
   */
  private async getLastRunTime(source: string): Promise<Date | null> {
    try {
      const run = await (prisma as any).leadGenRun?.findFirst({
        where: { source },
        orderBy: { createdAt: 'desc' },
      });
      return run?.createdAt || null;
    } catch {
      return null;
    }
  }

  /**
   * Record run statistics
   */
  private async recordRunStats(stats: {
    totalLeadsFound: number;
    totalLeadsCreated: number;
    errors: number;
    durationMs: number;
  }): Promise<void> {
    try {
      await (prisma as any).leadGenRun?.create({
        data: {
          id: crypto.randomUUID(),
          source: 'ORCHESTRATOR',
          leadsFound: stats.totalLeadsFound,
          leadsCreated: stats.totalLeadsCreated,
          errors: stats.errors,
          durationMs: stats.durationMs,
        },
      });
    } catch {
      // Table might not exist - silent fail
    }

    // Also create OpsInsight for monitoring
    try {
      await prisma.opsInsight.create({
        data: {
          category: 'LEAD_GENERATION',
          priority: stats.totalLeadsCreated > 0 ? 'NORMAL' : 'LOW',
          title: 'Lead Generation Run Complete',
          summary: `Found ${stats.totalLeadsFound} leads, created ${stats.totalLeadsCreated} cases in ${Math.round(stats.durationMs / 1000)}s`,
          details: stats,
          status: 'ACKNOWLEDGED',
        },
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Get individual service instances
   */
  getServices() {
    return {
      foia: foiaRequestBot,
      auctions: auctionSiteScraper,
      unclaimed: unclaimedPropertyScraper,
      google: googleSearchBot,
      news: newsAlertMonitor,
    };
  }
}

export const leadGenerationOrchestrator = new LeadGenerationOrchestrator();
export { LeadGenerationOrchestrator };
