/**
 * Oracle Service - Fetches real-time state law updates
 *
 * Multi-source data:
 * 1. Static cache (fast, reliable)
 * 2. Web scraping fallback (for latest updates)
 * 3. Future: Chainlink oracle integration
 */

import { logger } from '../utils/logger.js';

// Web fetch for scraping state government sites
async function fetchWithTimeout(url: string, timeout = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.text();
    }
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

// State government website URLs for surplus fund deadlines
const STATE_DEADLINE_URLS: Record<string, string> = {
  'CA': 'https://www.ftb.ca.gov/forms/Search/Home/Forms', // California FTB
  'FL': 'https://www.myflorida.com/treasury/', // Florida Treasury
  'TX': 'https://comptroller.texas.gov/taxes/property-tax/', // Texas Comptroller
  'NY': 'https://www.tax.ny.gov/', // New York Tax
  'GA': 'https://dor.georgia.gov/property-tax', // Georgia DOR
  'NC': 'https://www.ncdor.gov/taxes-forms/property-tax', // NC DOR
  'OH': 'https://tax.ohio.gov/sales_and_use.aspx', // Ohio Tax
  'PA': 'https://www.revenue.pa.gov/', // Pennsylvania Revenue
  'IL': 'https://www2.illinois.gov/rev/', // Illinois Revenue
  'MI': 'https://www.michigan.gov/treasury/', // Michigan Treasury
};

export interface StateLawUpdate {
  state: string;
  deadlineYears: number;
  deadlineDescription: string;
  lastUpdated: Date;
  source: string;
  changes: string[];
  effectiveDate?: Date;
}

// Static data - in production this would come from Chainlink oracles
const STATE_DEADLINES: Record<string, StateLawUpdate> = {
  'AL': { state: 'AL', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'Alabama Code § 40-10-29', changes: [] },
  'AK': { state: 'AK', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'AS 29.45.470', changes: [] },
  'AZ': { state: 'AZ', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'ARS § 42-18303', changes: [] },
  'AR': { state: 'AR', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'ACA § 26-37-203', changes: [] },
  'CA': { state: 'CA', deadlineYears: 1, deadlineDescription: '1 year from date of sale', lastUpdated: new Date(), source: 'RTC § 4675', changes: ['Updated 2024: Reduced from 3 years'] },
  'CO': { state: 'CO', deadlineYears: 3, deadlineDescription: '3 years from date of deed', lastUpdated: new Date(), source: 'CRS § 39-12-101', changes: [] },
  'CT': { state: 'CT', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'CGS § 12-157', changes: [] },
  'DE': { state: 'DE', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: '9 Del. C. § 8779', changes: [] },
  'FL': { state: 'FL', deadlineYears: 4, deadlineDescription: '4 years from date of sale', lastUpdated: new Date(), source: 'FS § 197.582', changes: ['Updated 2023'] },
  'GA': { state: 'GA', deadlineYears: 4, deadlineDescription: '4 years from date of sale', lastUpdated: new Date(), source: 'OCGA § 48-4-5', changes: [] },
  'HI': { state: 'HI', deadlineYears: 1, deadlineDescription: '1 year from date of sale', lastUpdated: new Date(), source: 'HRS § 231-61', changes: [] },
  'ID': { state: 'ID', deadlineYears: 14, deadlineDescription: '14 months from date of sale', lastUpdated: new Date(), source: 'IC § 63-1007', changes: [] },
  'IL': { state: 'IL', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: '35 ILCS 200/21-350', changes: [] },
  'IN': { state: 'IN', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'IC 6-1.1-25-4.6', changes: [] },
  'IA': { state: 'IA', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'Iowa Code § 447.9', changes: [] },
  'KS': { state: 'KS', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'KSA § 79-2804', changes: [] },
  'KY': { state: 'KY', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'KRS § 134.490', changes: [] },
  'LA': { state: 'LA', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'LA RS 47:2202', changes: [] },
  'ME': { state: 'ME', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: '36 MRSA § 946', changes: [] },
  'MD': { state: 'MD', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'MD Tax-Property § 14-856', changes: [] },
  'MA': { state: 'MA', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'MGL c. 60 § 65', changes: [] },
  'MI': { state: 'MI', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'MCL § 211.87c', changes: [] },
  'MN': { state: 'MN', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'Minn. Stat. § 281.25', changes: [] },
  'MS': { state: 'MS', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'Miss. Code § 27-45-23', changes: [] },
  'MO': { state: 'MO', deadlineYears: 10, deadlineDescription: '10 years from date of sale', lastUpdated: new Date(), source: 'RSMo § 140.230', changes: [] },
  'MT': { state: 'MT', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'MCA § 15-18-411', changes: [] },
  'NE': { state: 'NE', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'Neb. Rev. Stat. § 77-1918', changes: [] },
  'NV': { state: 'NV', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'NRS § 361.610', changes: [] },
  'NH': { state: 'NH', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'RSA § 80:88', changes: [] },
  'NJ': { state: 'NJ', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'NJSA § 54:5-32', changes: [] },
  'NM': { state: 'NM', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'NMSA § 7-38-67', changes: [] },
  'NY': { state: 'NY', deadlineYears: 4, deadlineDescription: '4 years from date of sale', lastUpdated: new Date(), source: 'RPTL § 1136', changes: [] },
  'NC': { state: 'NC', deadlineYears: 10, deadlineDescription: '10 years from date of sale', lastUpdated: new Date(), source: 'NCGS § 105-374', changes: [] },
  'ND': { state: 'ND', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'NDCC § 57-28-18', changes: [] },
  'OH': { state: 'OH', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'ORC § 5721.20', changes: [] },
  'OK': { state: 'OK', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: '68 OS § 3137', changes: [] },
  'OR': { state: 'OR', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'ORS § 312.200', changes: [] },
  'PA': { state: 'PA', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: '72 PS § 5860.205', changes: [] },
  'RI': { state: 'RI', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'RIGL § 44-9-25', changes: [] },
  'SC': { state: 'SC', deadlineYears: 1, deadlineDescription: '1 year from date of sale', lastUpdated: new Date(), source: 'SC Code § 12-51-130', changes: [] },
  'SD': { state: 'SD', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'SDCL § 10-25-12', changes: [] },
  'TN': { state: 'TN', deadlineYears: 1, deadlineDescription: '1 year from date of sale', lastUpdated: new Date(), source: 'TCA § 67-5-2702', changes: [] },
  'TX': { state: 'TX', deadlineYears: 2, deadlineDescription: '2 years from date of sale', lastUpdated: new Date(), source: 'Tex. Tax Code § 34.21', changes: ['Updated 2024'] },
  'UT': { state: 'UT', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'UCA § 59-2-1351.1', changes: [] },
  'VT': { state: 'VT', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: '32 VSA § 5261', changes: [] },
  'VA': { state: 'VA', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'Va. Code § 58.1-3967', changes: [] },
  'WA': { state: 'WA', deadlineYears: 3, deadlineDescription: '3 years from date of sale', lastUpdated: new Date(), source: 'RCW § 84.64.080', changes: [] },
  'WV': { state: 'WV', deadlineYears: 18, deadlineDescription: '18 months from date of sale', lastUpdated: new Date(), source: 'WVC § 11A-3-56', changes: [] },
  'WI': { state: 'WI', deadlineYears: 5, deadlineDescription: '5 years from date of sale', lastUpdated: new Date(), source: 'Wis. Stat. § 75.36', changes: [] },
  'WY': { state: 'WY', deadlineYears: 4, deadlineDescription: '4 years from date of sale', lastUpdated: new Date(), source: 'WS § 39-13-108', changes: [] },
};

export class OracleService {
  /**
   * Get state law update from oracle (stub - returns static data)
   * In production, this would query Chainlink oracle
   */
  async getStateLawUpdate(state: string): Promise<StateLawUpdate> {
    const stateUpper = state.toUpperCase();

    if (STATE_DEADLINES[stateUpper]) {
      return {
        ...STATE_DEADLINES[stateUpper],
        lastUpdated: new Date() // Simulating fresh oracle data
      };
    }

    // Default for unknown states
    return {
      state: stateUpper,
      deadlineYears: 3,
      deadlineDescription: '3 years from date of sale (default)',
      lastUpdated: new Date(),
      source: 'Oracle default',
      changes: ['No specific data available']
    };
  }

  /**
   * Get all state deadlines
   */
  async getAllStateDeadlines(): Promise<StateLawUpdate[]> {
    return Object.values(STATE_DEADLINES);
  }

  /**
   * Check for recent law changes
   */
  async getRecentChanges(daysBack: number = 90): Promise<StateLawUpdate[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    return Object.values(STATE_DEADLINES).filter(s => s.changes.length > 0);
  }

  /**
   * Subscribe to law changes (stub)
   * In production, this would set up Chainlink oracle subscription
   */
  async subscribeToChanges(states: string[], callback: (update: StateLawUpdate) => void): Promise<string> {
    const subscriptionId = `sub_${Date.now()}`;
    console.log(`[Oracle] Created subscription ${subscriptionId} for states: ${states.join(', ')}`);

    // Simulated periodic updates
    // In production, this would be Chainlink event listener

    return subscriptionId;
  }

  /**
   * Verify deadline against oracle (stub)
   */
  async verifyDeadline(state: string, deadlineDate: Date): Promise<{
    isValid: boolean;
    oracleDeadline: Date;
    difference: number;
  }> {
    const stateLaw = await this.getStateLawUpdate(state);
    const baseDate = new Date();
    baseDate.setFullYear(baseDate.getFullYear() - 3); // Assume sale was 3 years ago

    const oracleDeadline = new Date(baseDate);
    oracleDeadline.setFullYear(oracleDeadline.getFullYear() + stateLaw.deadlineYears);

    const difference = Math.ceil((deadlineDate.getTime() - oracleDeadline.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isValid: Math.abs(difference) <= 30, // Within 30 days
      oracleDeadline,
      difference
    };
  }

  /**
   * Scrape state government website for deadline updates
   * Falls back to static data if scraping fails
   */
  async scrapeStateDeadline(state: string): Promise<StateLawUpdate | null> {
    const stateUpper = state.toUpperCase();
    const url = STATE_DEADLINE_URLS[stateUpper];

    if (!url) {
      logger.info(`No scrape URL for state: ${stateUpper}`);
      return STATE_DEADLINES[stateUpper] || null;
    }

    try {
      const html = await fetchWithTimeout(url);
      if (!html) {
        logger.warn(`Failed to fetch ${url}`);
        return STATE_DEADLINES[stateUpper] || null;
      }

      // Parse for deadline-related keywords
      const deadlinePatterns = [
        /(\d+)\s*year[s]?\s*(from|after|following)/i,
        /redemption\s*period[:\s]*(\d+)\s*year/i,
        /claim\s*within\s*(\d+)\s*year/i,
        /(\d+)\s*month[s]?\s*(from|after)/i,
      ];

      for (const pattern of deadlinePatterns) {
        const match = html.match(pattern);
        if (match) {
          const years = parseInt(match[1], 10);
          const isMonths = pattern.source.includes('month');

          logger.info(`Scraped deadline for ${stateUpper}: ${years} ${isMonths ? 'months' : 'years'}`);

          return {
            state: stateUpper,
            deadlineYears: isMonths ? Math.ceil(years / 12) : years,
            deadlineDescription: `${years} ${isMonths ? 'months' : 'years'} from date of sale (scraped)`,
            lastUpdated: new Date(),
            source: `Scraped from ${url}`,
            changes: ['Data freshly scraped'],
          };
        }
      }

      // No match found, return static data
      logger.info(`No deadline pattern found for ${stateUpper}, using static data`);
      return STATE_DEADLINES[stateUpper] || null;
    } catch (error) {
      logger.error(`Scrape error for ${stateUpper}`, { error });
      return STATE_DEADLINES[stateUpper] || null;
    }
  }

  /**
   * Refresh all state data (run as cron job)
   */
  async refreshAllStates(): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const state of Object.keys(STATE_DEADLINE_URLS)) {
      try {
        const scraped = await this.scrapeStateDeadline(state);
        if (scraped && scraped.source.includes('Scraped')) {
          // Update static cache with fresh data
          STATE_DEADLINES[state] = scraped;
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      // Rate limit: 1 request per 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info(`Oracle refresh complete: ${updated} updated, ${failed} failed`);
    return { updated, failed };
  }

  /**
   * Get data source info
   */
  getDataSources(): Record<string, string> {
    return { ...STATE_DEADLINE_URLS };
  }
}

export const oracleService = new OracleService();
