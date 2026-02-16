/**
 * Lead Generation API Routes
 *
 * REST API endpoints for automated lead generation:
 * - FOIA Request Bot
 * - Auction Site Scrapers
 * - Unclaimed Property Scrapers
 * - Google Search Bot
 * - News Alert Monitor
 *
 * FOUNDER ONLY - All endpoints require FOUNDER role
 */

import { Router, Request, Response } from 'express';
import {
  leadGenerationOrchestrator,
  foiaRequestBot,
  auctionSiteScraper,
  unclaimedPropertyScraper,
  googleSearchBot,
  newsAlertMonitor,
} from '../services/leadGeneration/index.js';

const router = Router();

// =============================================================================
// ORCHESTRATOR ENDPOINTS
// =============================================================================

/**
 * Run all lead generation services
 * POST /api/lead-generation/run-all
 */
router.post('/run-all', async (req: Request, res: Response) => {
  try {
    const result = await leadGenerationOrchestrator.runAll();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run a specific lead generation service
 * POST /api/lead-generation/run/:service
 * :service = foia | auctions | unclaimed | google | news
 */
router.post('/run/:service', async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const validServices = ['foia', 'auctions', 'unclaimed', 'google', 'news'];

    if (!validServices.includes(service)) {
      return res.status(400).json({
        error: `Invalid service. Must be one of: ${validServices.join(', ')}`,
      });
    }

    const result = await leadGenerationOrchestrator.runService(
      service as 'foia' | 'auctions' | 'unclaimed' | 'google' | 'news'
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get lead generation statistics
 * GET /api/lead-generation/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await leadGenerationOrchestrator.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get service status
 * GET /api/lead-generation/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await leadGenerationOrchestrator.getServiceStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get orchestrator configuration
 * GET /api/lead-generation/config
 */
router.get('/config', (req: Request, res: Response) => {
  const config = leadGenerationOrchestrator.getConfig();
  res.json(config);
});

/**
 * Update orchestrator configuration
 * PUT /api/lead-generation/config
 */
router.put('/config', (req: Request, res: Response) => {
  try {
    leadGenerationOrchestrator.updateConfig(req.body);
    const config = leadGenerationOrchestrator.getConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start automatic scheduler
 * POST /api/lead-generation/scheduler/start
 */
router.post('/scheduler/start', (req: Request, res: Response) => {
  leadGenerationOrchestrator.startScheduler();
  res.json({ success: true, message: 'Scheduler started' });
});

/**
 * Stop automatic scheduler
 * POST /api/lead-generation/scheduler/stop
 */
router.post('/scheduler/stop', (req: Request, res: Response) => {
  leadGenerationOrchestrator.stopScheduler();
  res.json({ success: true, message: 'Scheduler stopped' });
});

// =============================================================================
// FOIA REQUEST BOT ENDPOINTS
// =============================================================================

/**
 * Get all county contacts
 * GET /api/lead-generation/foia/contacts
 */
router.get('/foia/contacts', async (req: Request, res: Response) => {
  try {
    const { state, hasEmail, neverContacted } = req.query;
    const contacts = await foiaRequestBot.getContacts({
      state: state as string,
      hasEmail: hasEmail === 'true',
      neverContacted: neverContacted === 'true',
    });
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initialize county contacts from seed data
 * POST /api/lead-generation/foia/contacts/init
 */
router.post('/foia/contacts/init', async (req: Request, res: Response) => {
  try {
    const created = await foiaRequestBot.initializeContacts();
    res.json({ success: true, contactsCreated: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a new county contact
 * POST /api/lead-generation/foia/contacts
 */
router.post('/foia/contacts', async (req: Request, res: Response) => {
  try {
    const id = await foiaRequestBot.addContact(req.body);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get FOIA email templates
 * GET /api/lead-generation/foia/templates
 */
router.get('/foia/templates', (req: Request, res: Response) => {
  const templates = foiaRequestBot.getTemplates();
  res.json(templates);
});

/**
 * Send FOIA request to a specific county
 * POST /api/lead-generation/foia/send/:contactId
 */
router.post('/foia/send/:contactId', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { templateId } = req.body;
    const result = await foiaRequestBot.sendRequest(contactId, templateId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send batch FOIA requests
 * POST /api/lead-generation/foia/send-batch
 */
router.post('/foia/send-batch', async (req: Request, res: Response) => {
  try {
    const { state, maxRequests, templateId } = req.body;
    const result = await foiaRequestBot.sendBatchRequests(
      state,
      maxRequests || 10,
      templateId || 'surplus_funds_general'
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send FOIA follow-ups
 * POST /api/lead-generation/foia/follow-ups
 */
router.post('/foia/follow-ups', async (req: Request, res: Response) => {
  try {
    const { daysOld } = req.body;
    const sent = await foiaRequestBot.sendFollowUps(daysOld || 14);
    res.json({ success: true, followUpsSent: sent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get FOIA bot statistics
 * GET /api/lead-generation/foia/stats
 */
router.get('/foia/stats', async (req: Request, res: Response) => {
  try {
    const stats = await foiaRequestBot.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// AUCTION SCRAPER ENDPOINTS
// =============================================================================

/**
 * Get available auction sites
 * GET /api/lead-generation/auctions/sites
 */
router.get('/auctions/sites', (req: Request, res: Response) => {
  const sites = auctionSiteScraper.getSites();
  res.json(sites);
});

/**
 * Scrape all auction sites
 * POST /api/lead-generation/auctions/scrape-all
 */
router.post('/auctions/scrape-all', async (req: Request, res: Response) => {
  try {
    const { states, maxPages } = req.body;
    const result = await auctionSiteScraper.scrapeAll(states, maxPages || 5);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scrape a specific auction site
 * POST /api/lead-generation/auctions/scrape/:siteId
 */
router.post('/auctions/scrape/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { states, maxPages } = req.body;
    const records = await auctionSiteScraper.scrapeSite(siteId, states, maxPages || 5);
    res.json({ success: true, recordsFound: records.length, records });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// UNCLAIMED PROPERTY SCRAPER ENDPOINTS
// =============================================================================

/**
 * Get available state unclaimed property sites
 * GET /api/lead-generation/unclaimed/sites
 */
router.get('/unclaimed/sites', (req: Request, res: Response) => {
  const sites = unclaimedPropertyScraper.getSites();
  res.json(sites);
});

/**
 * Scrape all unclaimed property sites
 * POST /api/lead-generation/unclaimed/scrape-all
 */
router.post('/unclaimed/scrape-all', async (req: Request, res: Response) => {
  try {
    const { states, maxResults } = req.body;
    const result = await unclaimedPropertyScraper.scrapeAll(states, maxResults || 50);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scrape a specific state's unclaimed property
 * POST /api/lead-generation/unclaimed/scrape/:state
 */
router.post('/unclaimed/scrape/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    const { searchNames, maxResults } = req.body;
    const records = await unclaimedPropertyScraper.scrapeState(
      state.toUpperCase(),
      searchNames,
      maxResults || 100
    );
    res.json({ success: true, recordsFound: records.length, records });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// GOOGLE SEARCH BOT ENDPOINTS
// =============================================================================

/**
 * Get search query templates
 * GET /api/lead-generation/google/queries
 */
router.get('/google/queries', (req: Request, res: Response) => {
  const queries = googleSearchBot.getQueryTemplates();
  res.json(queries);
});

/**
 * Get target counties
 * GET /api/lead-generation/google/counties
 */
router.get('/google/counties', (req: Request, res: Response) => {
  const counties = googleSearchBot.getTargetCounties();
  res.json(counties);
});

/**
 * Run full Google search
 * POST /api/lead-generation/google/search-all
 */
router.post('/google/search-all', async (req: Request, res: Response) => {
  try {
    const { maxCounties, downloadPDFs } = req.body;
    const result = await googleSearchBot.runFullSearch(
      maxCounties || 10,
      downloadPDFs !== false
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search for a specific county
 * POST /api/lead-generation/google/search-county
 */
router.post('/google/search-county', async (req: Request, res: Response) => {
  try {
    const { county, state, stateAbbr } = req.body;
    if (!county || !state || !stateAbbr) {
      return res.status(400).json({ error: 'county, state, and stateAbbr are required' });
    }
    const results = await googleSearchBot.searchCounty(county, state, stateAbbr);
    res.json({ success: true, resultsFound: results.length, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run a custom search query
 * POST /api/lead-generation/google/search
 */
router.post('/google/search', async (req: Request, res: Response) => {
  try {
    const { query, useAPI } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    const results = await googleSearchBot.search(query, useAPI !== false);
    res.json({ success: true, resultsFound: results.length, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// NEWS ALERT MONITOR ENDPOINTS
// =============================================================================

/**
 * Get all monitors
 * GET /api/lead-generation/news/monitors
 */
router.get('/news/monitors', (req: Request, res: Response) => {
  const monitors = newsAlertMonitor.getMonitors();
  res.json(monitors);
});

/**
 * Run all monitors
 * POST /api/lead-generation/news/run-all
 */
router.post('/news/run-all', async (req: Request, res: Response) => {
  try {
    const result = await newsAlertMonitor.runAllMonitors();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run a specific monitor
 * POST /api/lead-generation/news/run/:monitorId
 */
router.post('/news/run/:monitorId', async (req: Request, res: Response) => {
  try {
    const { monitorId } = req.params;
    const alerts = await newsAlertMonitor.runMonitor(monitorId);
    res.json({ success: true, alertsFound: alerts.length, alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a new monitor
 * POST /api/lead-generation/news/monitors
 */
router.post('/news/monitors', (req: Request, res: Response) => {
  try {
    const id = newsAlertMonitor.addMonitor(req.body);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
