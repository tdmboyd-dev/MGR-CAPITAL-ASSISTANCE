/**
 * Lead Generation Services - Index
 *
 * Exports all lead generation services for automated surplus fund lead discovery:
 *
 * 1. FOIA Request Bot - Automated public records requests to county clerks
 * 2. Auction Site Scraper - Bid4Assets, GovEase, RealAuction scrapers
 * 3. Unclaimed Property Scraper - State unclaimed property databases
 * 4. Google Search Bot - Automated PDF/surplus list discovery
 * 5. News Alert Monitor - Web monitoring for new surplus opportunities
 * 6. Lead Generation Orchestrator - Coordinates all services
 *
 * All services are FREE - no API costs except optional Google Custom Search
 */

// Type definitions
export * from './types.js';

// Individual services
export { foiaRequestBot, FOIARequestBot } from './FOIARequestBot.js';
export { auctionSiteScraper, AuctionSiteScraper } from './AuctionSiteScraper.js';
export { unclaimedPropertyScraper, UnclaimedPropertyScraper } from './UnclaimedPropertyScraper.js';
export { googleSearchBot, GoogleSearchBot } from './GoogleSearchBot.js';
export { newsAlertMonitor, NewsAlertMonitor } from './NewsAlertMonitor.js';

// Main orchestrator
export { leadGenerationOrchestrator, LeadGenerationOrchestrator } from './LeadGenerationOrchestrator.js';

/**
 * Quick start guide:
 *
 * 1. Run all services:
 *    import { leadGenerationOrchestrator } from './leadGeneration';
 *    const result = await leadGenerationOrchestrator.runAll();
 *
 * 2. Start automatic scheduling:
 *    leadGenerationOrchestrator.startScheduler();
 *
 * 3. Run individual services:
 *    import { foiaRequestBot, auctionSiteScraper } from './leadGeneration';
 *    await foiaRequestBot.sendBatchRequests('TX', 5);
 *    await auctionSiteScraper.scrapeAll(['TX', 'FL'], 5);
 *
 * 4. Get statistics:
 *    const stats = await leadGenerationOrchestrator.getStats();
 *
 * Environment variables (optional):
 * - FOIA_REPLY_EMAIL: Email for FOIA responses
 * - GOOGLE_CUSTOM_SEARCH_API_KEY: For Google API (100 free queries/day)
 * - GOOGLE_CUSTOM_SEARCH_ENGINE_ID: Google Custom Search engine ID
 * - PDF_DOWNLOAD_DIR: Directory for downloaded PDFs
 */
