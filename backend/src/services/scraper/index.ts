/**
 * Scraper Module Index
 *
 * Exports all scraper components for the Puppeteer-based
 * surplus recovery lead scraping system.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

// Types
export * from './types.js';

// County Configurations
export {
  COUNTY_CONFIGS,
  STATE_ABBREVIATIONS,
  getConfigById,
  getConfigsByState,
  getEnabledConfigs,
  getStatesWithConfigs,
  getCoverageStats,
  getHighPopulationConfigs,
} from './countyConfigs.js';

// Main Scraper Engine
export { scraperEngineV2, ScraperEngineV2 } from './ScraperEngineV2.js';

// URL Scout Service
export { urlScoutService, UrlScoutService } from './UrlScoutService.js';
