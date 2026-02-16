/**
 * countyConfigs.ts - County Scraper Configurations for All 50 US States
 *
 * Contains configurations for top 3 counties by population in each state.
 * URLs are researched real county government websites for surplus/tax sale data.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { CountyScraperConfig, ParserType } from './types.js';

// =============================================================================
// STATE ABBREVIATION MAPPING
// =============================================================================

export const STATE_ABBREVIATIONS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

// =============================================================================
// DEFAULT SELECTORS FOR COMMON FORMATS
// =============================================================================

const DEFAULT_TABLE_SELECTORS = {
  tableSelector: 'table',
  rowSelector: 'tbody tr, table tr:not(:first-child)',
  headerSelector: 'thead tr th, table tr:first-child th, table tr:first-child td',
};

const DEFAULT_PDF_SELECTORS = {
  pdfLinkSelector: 'a[href*=".pdf"], a[href*="PDF"], a[href*="pdf"]',
};

// =============================================================================
// COUNTY CONFIGURATIONS BY STATE
// =============================================================================

export const COUNTY_CONFIGS: CountyScraperConfig[] = [
  // =========================================================================
  // ALABAMA (AL)
  // =========================================================================
  {
    id: 'al-jefferson',
    state: 'Alabama',
    stateAbbr: 'AL',
    county: 'Jefferson',
    population: 674721,
    surplusUrls: [
      'https://www.jccal.org/Sites/Jefferson_County/Documents/Revenue/Tax%20Sales/Excess%20Funds%20List.pdf',
      'https://www.jccal.org/Default.asp?ID=2200',
    ],
    taxSaleUrls: [
      'https://www.jccal.org/Default.asp?ID=2198',
    ],
    clerkUrls: [],
    parserType: 'pdf',
    selectors: { ...DEFAULT_PDF_SELECTORS },
    requiresJs: false,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'al-mobile',
    state: 'Alabama',
    stateAbbr: 'AL',
    county: 'Mobile',
    population: 414809,
    surplusUrls: [
      'https://www.mobilecountyal.gov/government/revenue/surplus-funds/',
    ],
    taxSaleUrls: [
      'https://www.mobilecountyal.gov/government/revenue/tax-sales/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'al-madison',
    state: 'Alabama',
    stateAbbr: 'AL',
    county: 'Madison',
    population: 392808,
    surplusUrls: [
      'https://www.madisoncountyal.gov/departments/revenue-commissioner/tax-sales',
    ],
    taxSaleUrls: [
      'https://www.madisoncountyal.gov/departments/revenue-commissioner/tax-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // ALASKA (AK)
  // =========================================================================
  {
    id: 'ak-anchorage',
    state: 'Alaska',
    stateAbbr: 'AK',
    county: 'Anchorage',
    population: 291247,
    surplusUrls: [
      'https://www.muni.org/Departments/Finance/treasury/Pages/ForeclosureProcessandSaleofRealProperty.aspx',
    ],
    taxSaleUrls: [
      'https://www.muni.org/Departments/Finance/treasury/Pages/ForeclosureProcessandSaleofRealProperty.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ak-fairbanks',
    state: 'Alaska',
    stateAbbr: 'AK',
    county: 'Fairbanks North Star',
    population: 97450,
    surplusUrls: [
      'https://www.fnsb.gov/470/Tax-Foreclosure',
    ],
    taxSaleUrls: [
      'https://www.fnsb.gov/470/Tax-Foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ak-matanuska',
    state: 'Alaska',
    stateAbbr: 'AK',
    county: 'Matanuska-Susitna',
    population: 108317,
    surplusUrls: [
      'https://www.matsugov.us/finance/tax-foreclosure',
    ],
    taxSaleUrls: [
      'https://www.matsugov.us/finance/tax-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // ARIZONA (AZ)
  // =========================================================================
  {
    id: 'az-maricopa',
    state: 'Arizona',
    stateAbbr: 'AZ',
    county: 'Maricopa',
    population: 4485414,
    surplusUrls: [
      'https://treasurer.maricopa.gov/ExcessProceeds',
      'https://treasurer.maricopa.gov/TaxLienSales',
    ],
    taxSaleUrls: [
      'https://treasurer.maricopa.gov/TaxLienSales',
    ],
    clerkUrls: [
      'https://recorder.maricopa.gov/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.excess-proceeds-list, .tax-sale-list',
    },
    requiresJs: true,
    hasAntiBot: true,
    waitForSelector: '.data-table, table',
    enabled: true,
  },
  {
    id: 'az-pima',
    state: 'Arizona',
    stateAbbr: 'AZ',
    county: 'Pima',
    population: 1047279,
    surplusUrls: [
      'https://www.pima.gov/government/administration/finance_and_risk_management/treasurer/excess_proceeds/',
    ],
    taxSaleUrls: [
      'https://www.pima.gov/government/administration/finance_and_risk_management/treasurer/tax_lien_sales/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'az-pinal',
    state: 'Arizona',
    stateAbbr: 'AZ',
    county: 'Pinal',
    population: 462789,
    surplusUrls: [
      'https://www.pinalcountyaz.gov/Treasurer/Pages/ExcessProceeds.aspx',
    ],
    taxSaleUrls: [
      'https://www.pinalcountyaz.gov/Treasurer/Pages/TaxLienSales.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // ARKANSAS (AR)
  // =========================================================================
  {
    id: 'ar-pulaski',
    state: 'Arkansas',
    stateAbbr: 'AR',
    county: 'Pulaski',
    population: 399125,
    surplusUrls: [
      'https://www.pulaskicounty.net/treasurer/',
    ],
    taxSaleUrls: [
      'https://www.pulaskicounty.net/treasurer/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ar-benton',
    state: 'Arkansas',
    stateAbbr: 'AR',
    county: 'Benton',
    population: 284333,
    surplusUrls: [
      'https://www.bentoncountyar.gov/collector',
    ],
    taxSaleUrls: [
      'https://www.bentoncountyar.gov/collector/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ar-washington',
    state: 'Arkansas',
    stateAbbr: 'AR',
    county: 'Washington',
    population: 245871,
    surplusUrls: [
      'https://www.washingtoncountyar.gov/government/departments-f-z/treasurer',
    ],
    taxSaleUrls: [
      'https://www.washingtoncountyar.gov/government/departments-f-z/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // CALIFORNIA (CA)
  // =========================================================================
  {
    id: 'ca-los-angeles',
    state: 'California',
    stateAbbr: 'CA',
    county: 'Los Angeles',
    population: 10014009,
    surplusUrls: [
      'https://ttc.lacounty.gov/excess-proceeds/',
      'https://ttc.lacounty.gov/public-auction-information/',
    ],
    taxSaleUrls: [
      'https://ttc.lacounty.gov/public-auction-information/',
    ],
    clerkUrls: [
      'https://www.lavote.gov/home/county-clerk/records/property-records',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.excess-proceeds-table',
    },
    requiresJs: true,
    hasAntiBot: true,
    waitForSelector: 'table',
    enabled: true,
  },
  {
    id: 'ca-san-diego',
    state: 'California',
    stateAbbr: 'CA',
    county: 'San Diego',
    population: 3298634,
    surplusUrls: [
      'https://www.sdttc.com/content/ttc/en/tax-collection/Auctions/excess-proceeds.html',
    ],
    taxSaleUrls: [
      'https://www.sdttc.com/content/ttc/en/tax-collection/Auctions.html',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ca-orange',
    state: 'California',
    stateAbbr: 'CA',
    county: 'Orange',
    population: 3186989,
    surplusUrls: [
      'https://www.ttc.ocgov.com/taxcol/sale/excess/',
    ],
    taxSaleUrls: [
      'https://www.ttc.ocgov.com/taxcol/sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // COLORADO (CO)
  // =========================================================================
  {
    id: 'co-denver',
    state: 'Colorado',
    stateAbbr: 'CO',
    county: 'Denver',
    population: 715522,
    surplusUrls: [
      'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Finance/Our-Divisions/Treasury/Tax-Lien-Sale',
    ],
    taxSaleUrls: [
      'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Finance/Our-Divisions/Treasury/Tax-Lien-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'co-el-paso',
    state: 'Colorado',
    stateAbbr: 'CO',
    county: 'El Paso',
    population: 730395,
    surplusUrls: [
      'https://treasurer.elpasoco.com/tax-lien-sale/',
    ],
    taxSaleUrls: [
      'https://treasurer.elpasoco.com/tax-lien-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'co-arapahoe',
    state: 'Colorado',
    stateAbbr: 'CO',
    county: 'Arapahoe',
    population: 656590,
    surplusUrls: [
      'https://www.arapahoegov.com/346/Tax-Lien-Sale',
    ],
    taxSaleUrls: [
      'https://www.arapahoegov.com/346/Tax-Lien-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // CONNECTICUT (CT)
  // =========================================================================
  {
    id: 'ct-fairfield',
    state: 'Connecticut',
    stateAbbr: 'CT',
    county: 'Fairfield',
    population: 943332,
    surplusUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Excess-Proceeds',
    ],
    taxSaleUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Information',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ct-hartford',
    state: 'Connecticut',
    stateAbbr: 'CT',
    county: 'Hartford',
    population: 891720,
    surplusUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Excess-Proceeds',
    ],
    taxSaleUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Information',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ct-new-haven',
    state: 'Connecticut',
    stateAbbr: 'CT',
    county: 'New Haven',
    population: 855733,
    surplusUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Excess-Proceeds',
    ],
    taxSaleUrls: [
      'https://portal.ct.gov/OTT/Tax-Sale/Tax-Sale-Information',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // DELAWARE (DE)
  // =========================================================================
  {
    id: 'de-new-castle',
    state: 'Delaware',
    stateAbbr: 'DE',
    county: 'New Castle',
    population: 570719,
    surplusUrls: [
      'https://www.nccde.org/157/Sheriffs-Sale',
    ],
    taxSaleUrls: [
      'https://www.nccde.org/157/Sheriffs-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'de-sussex',
    state: 'Delaware',
    stateAbbr: 'DE',
    county: 'Sussex',
    population: 237378,
    surplusUrls: [
      'https://sussexcountyde.gov/tax-sale',
    ],
    taxSaleUrls: [
      'https://sussexcountyde.gov/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'de-kent',
    state: 'Delaware',
    stateAbbr: 'DE',
    county: 'Kent',
    population: 181851,
    surplusUrls: [
      'https://www.co.kent.de.us/finance/tax-sale.aspx',
    ],
    taxSaleUrls: [
      'https://www.co.kent.de.us/finance/tax-sale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // FLORIDA (FL)
  // =========================================================================
  {
    id: 'fl-miami-dade',
    state: 'Florida',
    stateAbbr: 'FL',
    county: 'Miami-Dade',
    population: 2716940,
    surplusUrls: [
      'https://www.miamidade.gov/finance/tax-deed-surplus.asp',
      'https://www.miamidade.gov/clerk/surplus-funds.asp',
    ],
    taxSaleUrls: [
      'https://www.miamidade.gov/finance/tax-deed-sale.asp',
    ],
    clerkUrls: [
      'https://www.miamidade.gov/clerk/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '#surplus-funds-table',
    },
    requiresJs: true,
    hasAntiBot: true,
    waitForSelector: 'table, .data-grid',
    enabled: true,
  },
  {
    id: 'fl-broward',
    state: 'Florida',
    stateAbbr: 'FL',
    county: 'Broward',
    population: 1944375,
    surplusUrls: [
      'https://www.broward.org/RecordsTaxesTreasury/Records/Pages/SurplusFunds.aspx',
    ],
    taxSaleUrls: [
      'https://www.broward.org/RecordsTaxesTreasury/Records/Pages/TaxDeedSale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'fl-palm-beach',
    state: 'Florida',
    stateAbbr: 'FL',
    county: 'Palm Beach',
    population: 1496770,
    surplusUrls: [
      'https://www.mypalmbeachclerk.com/departments/recording/surplus-funds',
    ],
    taxSaleUrls: [
      'https://www.mypalmbeachclerk.com/departments/recording/tax-deed-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // GEORGIA (GA)
  // =========================================================================
  {
    id: 'ga-fulton',
    state: 'Georgia',
    stateAbbr: 'GA',
    county: 'Fulton',
    population: 1066710,
    surplusUrls: [
      'https://www.fultoncountytaxes.org/excess-funds',
      'https://www.fultoncountytaxes.org/tax-sales/surplus-funds',
    ],
    taxSaleUrls: [
      'https://www.fultoncountytaxes.org/tax-sales',
    ],
    clerkUrls: [
      'https://www.fultoncountyclerk.org/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.excess-funds-list',
    },
    requiresJs: true,
    hasAntiBot: false,
    waitForSelector: 'table',
    enabled: true,
  },
  {
    id: 'ga-gwinnett',
    state: 'Georgia',
    stateAbbr: 'GA',
    county: 'Gwinnett',
    population: 957062,
    surplusUrls: [
      'https://www.gwinnettcounty.com/web/gwinnett/departments/taxcommissioner/taxsales/excessfunds',
    ],
    taxSaleUrls: [
      'https://www.gwinnettcounty.com/web/gwinnett/departments/taxcommissioner/taxsales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ga-cobb',
    state: 'Georgia',
    stateAbbr: 'GA',
    county: 'Cobb',
    population: 766149,
    surplusUrls: [
      'https://www.cobbcounty.org/tax/tax-sales/excess-funds',
    ],
    taxSaleUrls: [
      'https://www.cobbcounty.org/tax/tax-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // HAWAII (HI)
  // =========================================================================
  {
    id: 'hi-honolulu',
    state: 'Hawaii',
    stateAbbr: 'HI',
    county: 'Honolulu',
    population: 974563,
    surplusUrls: [
      'https://www.honolulu.gov/budget/realpropertytax.html',
    ],
    taxSaleUrls: [
      'https://www.honolulu.gov/budget/realpropertytax.html',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'hi-hawaii',
    state: 'Hawaii',
    stateAbbr: 'HI',
    county: 'Hawaii',
    population: 200983,
    surplusUrls: [
      'https://www.hawaiicounty.gov/departments/finance/real-property-tax-office',
    ],
    taxSaleUrls: [
      'https://www.hawaiicounty.gov/departments/finance/real-property-tax-office',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'hi-maui',
    state: 'Hawaii',
    stateAbbr: 'HI',
    county: 'Maui',
    population: 164637,
    surplusUrls: [
      'https://www.mauicounty.gov/1877/Real-Property-Tax',
    ],
    taxSaleUrls: [
      'https://www.mauicounty.gov/1877/Real-Property-Tax',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // IDAHO (ID)
  // =========================================================================
  {
    id: 'id-ada',
    state: 'Idaho',
    stateAbbr: 'ID',
    county: 'Ada',
    population: 494967,
    surplusUrls: [
      'https://adacounty.id.gov/treasurer/tax-deeded-property/',
    ],
    taxSaleUrls: [
      'https://adacounty.id.gov/treasurer/tax-deeded-property/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'id-canyon',
    state: 'Idaho',
    stateAbbr: 'ID',
    county: 'Canyon',
    population: 231105,
    surplusUrls: [
      'https://www.canyoncounty.id.gov/departments/treasurer/',
    ],
    taxSaleUrls: [
      'https://www.canyoncounty.id.gov/departments/treasurer/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'id-kootenai',
    state: 'Idaho',
    stateAbbr: 'ID',
    county: 'Kootenai',
    population: 171362,
    surplusUrls: [
      'https://www.kcgov.us/152/Treasurer',
    ],
    taxSaleUrls: [
      'https://www.kcgov.us/152/Treasurer',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // ILLINOIS (IL)
  // =========================================================================
  {
    id: 'il-cook',
    state: 'Illinois',
    stateAbbr: 'IL',
    county: 'Cook',
    population: 5275541,
    surplusUrls: [
      'https://www.cookcountytreasurer.com/excess.aspx',
      'https://www.cookcountytreasurer.com/scavengersale.aspx',
    ],
    taxSaleUrls: [
      'https://www.cookcountytreasurer.com/annualtaxsale.aspx',
    ],
    clerkUrls: [
      'https://www.cookcountyclerkofcourt.org/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.excess-funds-grid',
    },
    requiresJs: true,
    hasAntiBot: true,
    waitForSelector: 'table, .grid',
    enabled: true,
  },
  {
    id: 'il-dupage',
    state: 'Illinois',
    stateAbbr: 'IL',
    county: 'DuPage',
    population: 932877,
    surplusUrls: [
      'https://www.dupageco.org/Treasurer/Tax_Sale/',
    ],
    taxSaleUrls: [
      'https://www.dupageco.org/Treasurer/Tax_Sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'il-lake',
    state: 'Illinois',
    stateAbbr: 'IL',
    county: 'Lake',
    population: 714342,
    surplusUrls: [
      'https://www.lakecountyil.gov/179/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.lakecountyil.gov/179/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // INDIANA (IN)
  // =========================================================================
  {
    id: 'in-marion',
    state: 'Indiana',
    stateAbbr: 'IN',
    county: 'Marion',
    population: 977203,
    surplusUrls: [
      'https://www.indy.gov/activity/tax-sale-surplus-funds',
    ],
    taxSaleUrls: [
      'https://www.indy.gov/agency/treasurer',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'in-lake',
    state: 'Indiana',
    stateAbbr: 'IN',
    county: 'Lake',
    population: 498700,
    surplusUrls: [
      'https://www.lakecountyin.org/departments/treasurer/',
    ],
    taxSaleUrls: [
      'https://www.lakecountyin.org/departments/treasurer/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'in-allen',
    state: 'Indiana',
    stateAbbr: 'IN',
    county: 'Allen',
    population: 385410,
    surplusUrls: [
      'https://www.allencounty.us/treasurer/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.allencounty.us/treasurer/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // IOWA (IA)
  // =========================================================================
  {
    id: 'ia-polk',
    state: 'Iowa',
    stateAbbr: 'IA',
    county: 'Polk',
    population: 492401,
    surplusUrls: [
      'https://www.polkcountyiowa.gov/treasurer/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.polkcountyiowa.gov/treasurer/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ia-linn',
    state: 'Iowa',
    stateAbbr: 'IA',
    county: 'Linn',
    population: 228614,
    surplusUrls: [
      'https://www.linncountyiowa.gov/217/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.linncountyiowa.gov/217/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ia-scott',
    state: 'Iowa',
    stateAbbr: 'IA',
    county: 'Scott',
    population: 173309,
    surplusUrls: [
      'https://www.scottcountyiowa.gov/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.scottcountyiowa.gov/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // KANSAS (KS)
  // =========================================================================
  {
    id: 'ks-johnson',
    state: 'Kansas',
    stateAbbr: 'KS',
    county: 'Johnson',
    population: 609863,
    surplusUrls: [
      'https://www.jocogov.org/department/treasury-and-financial-management/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.jocogov.org/department/treasury-and-financial-management/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ks-sedgwick',
    state: 'Kansas',
    stateAbbr: 'KS',
    county: 'Sedgwick',
    population: 523824,
    surplusUrls: [
      'https://www.sedgwickcounty.org/treasurer/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.sedgwickcounty.org/treasurer/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ks-wyandotte',
    state: 'Kansas',
    stateAbbr: 'KS',
    county: 'Wyandotte',
    population: 167939,
    surplusUrls: [
      'https://www.wycokck.org/Departments/Treasurer/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.wycokck.org/Departments/Treasurer/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // KENTUCKY (KY)
  // =========================================================================
  {
    id: 'ky-jefferson',
    state: 'Kentucky',
    stateAbbr: 'KY',
    county: 'Jefferson',
    population: 782969,
    surplusUrls: [
      'https://jeffersoncountyclerk.org/taxsale/',
    ],
    taxSaleUrls: [
      'https://jeffersoncountyclerk.org/taxsale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ky-fayette',
    state: 'Kentucky',
    stateAbbr: 'KY',
    county: 'Fayette',
    population: 322570,
    surplusUrls: [
      'https://www.lexingtonky.gov/departments/division-revenue/delinquent-taxes',
    ],
    taxSaleUrls: [
      'https://www.lexingtonky.gov/departments/division-revenue/delinquent-taxes',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ky-kenton',
    state: 'Kentucky',
    stateAbbr: 'KY',
    county: 'Kenton',
    population: 167950,
    surplusUrls: [
      'https://www.kentoncounty.org/183/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.kentoncounty.org/183/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // LOUISIANA (LA)
  // =========================================================================
  {
    id: 'la-east-baton-rouge',
    state: 'Louisiana',
    stateAbbr: 'LA',
    county: 'East Baton Rouge',
    population: 456781,
    surplusUrls: [
      'https://www.brla.gov/167/Tax-Sales',
    ],
    taxSaleUrls: [
      'https://www.brla.gov/167/Tax-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'la-jefferson',
    state: 'Louisiana',
    stateAbbr: 'LA',
    county: 'Jefferson',
    population: 440781,
    surplusUrls: [
      'https://www.jeffparish.net/departments/sheriff/tax-sales',
    ],
    taxSaleUrls: [
      'https://www.jeffparish.net/departments/sheriff/tax-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'la-orleans',
    state: 'Louisiana',
    stateAbbr: 'LA',
    county: 'Orleans',
    population: 383997,
    surplusUrls: [
      'https://www.nola.gov/treasury/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.nola.gov/treasury/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MAINE (ME)
  // =========================================================================
  {
    id: 'me-cumberland',
    state: 'Maine',
    stateAbbr: 'ME',
    county: 'Cumberland',
    population: 303069,
    surplusUrls: [
      'https://www.cumberlandcounty.org/259/Tax-Acquired-Property',
    ],
    taxSaleUrls: [
      'https://www.cumberlandcounty.org/259/Tax-Acquired-Property',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'me-york',
    state: 'Maine',
    stateAbbr: 'ME',
    county: 'York',
    population: 211972,
    surplusUrls: [
      'https://www.yorkcountymaine.gov/treasurer/tax-lien-foreclosure',
    ],
    taxSaleUrls: [
      'https://www.yorkcountymaine.gov/treasurer/tax-lien-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'me-penobscot',
    state: 'Maine',
    stateAbbr: 'ME',
    county: 'Penobscot',
    population: 152148,
    surplusUrls: [
      'https://www.penobscot-county.net/treasurer/tax-acquired-property',
    ],
    taxSaleUrls: [
      'https://www.penobscot-county.net/treasurer/tax-acquired-property',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MARYLAND (MD)
  // =========================================================================
  {
    id: 'md-montgomery',
    state: 'Maryland',
    stateAbbr: 'MD',
    county: 'Montgomery',
    population: 1062061,
    surplusUrls: [
      'https://www.montgomerycountymd.gov/Finance/taxes/tax-sale.html',
    ],
    taxSaleUrls: [
      'https://www.montgomerycountymd.gov/Finance/taxes/tax-sale.html',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'md-prince-georges',
    state: 'Maryland',
    stateAbbr: 'MD',
    county: 'Prince Georges',
    population: 967201,
    surplusUrls: [
      'https://www.princegeorgescountymd.gov/1134/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.princegeorgescountymd.gov/1134/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'md-baltimore',
    state: 'Maryland',
    stateAbbr: 'MD',
    county: 'Baltimore',
    population: 854535,
    surplusUrls: [
      'https://www.baltimorecountymd.gov/departments/budfin/taxpayerservices/taxsale.html',
    ],
    taxSaleUrls: [
      'https://www.baltimorecountymd.gov/departments/budfin/taxpayerservices/taxsale.html',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MASSACHUSETTS (MA)
  // =========================================================================
  {
    id: 'ma-middlesex',
    state: 'Massachusetts',
    stateAbbr: 'MA',
    county: 'Middlesex',
    population: 1632002,
    surplusUrls: [
      'https://www.mass.gov/service-details/delinquent-property-tax-sales',
    ],
    taxSaleUrls: [
      'https://www.mass.gov/service-details/delinquent-property-tax-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ma-worcester',
    state: 'Massachusetts',
    stateAbbr: 'MA',
    county: 'Worcester',
    population: 862111,
    surplusUrls: [
      'https://www.worcesterma.gov/finance/tax-collection',
    ],
    taxSaleUrls: [
      'https://www.worcesterma.gov/finance/tax-collection',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ma-suffolk',
    state: 'Massachusetts',
    stateAbbr: 'MA',
    county: 'Suffolk',
    population: 803907,
    surplusUrls: [
      'https://www.boston.gov/departments/treasury/tax-title',
    ],
    taxSaleUrls: [
      'https://www.boston.gov/departments/treasury/tax-title',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MICHIGAN (MI)
  // =========================================================================
  {
    id: 'mi-wayne',
    state: 'Michigan',
    stateAbbr: 'MI',
    county: 'Wayne',
    population: 1793561,
    surplusUrls: [
      'https://www.waynecounty.com/elected/treasurer/foreclosure-auction.aspx',
    ],
    taxSaleUrls: [
      'https://www.waynecounty.com/elected/treasurer/foreclosure-auction.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mi-oakland',
    state: 'Michigan',
    stateAbbr: 'MI',
    county: 'Oakland',
    population: 1274395,
    surplusUrls: [
      'https://www.oakgov.com/treasurer/foreclosure/Pages/default.aspx',
    ],
    taxSaleUrls: [
      'https://www.oakgov.com/treasurer/foreclosure/Pages/default.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mi-macomb',
    state: 'Michigan',
    stateAbbr: 'MI',
    county: 'Macomb',
    population: 881217,
    surplusUrls: [
      'https://treasurer.macombgov.org/Treasurer-ForeclosureSales',
    ],
    taxSaleUrls: [
      'https://treasurer.macombgov.org/Treasurer-ForeclosureSales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MINNESOTA (MN)
  // =========================================================================
  {
    id: 'mn-hennepin',
    state: 'Minnesota',
    stateAbbr: 'MN',
    county: 'Hennepin',
    population: 1281565,
    surplusUrls: [
      'https://www.hennepin.us/residents/property/property-tax-forfeiture',
    ],
    taxSaleUrls: [
      'https://www.hennepin.us/residents/property/property-tax-forfeiture',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mn-ramsey',
    state: 'Minnesota',
    stateAbbr: 'MN',
    county: 'Ramsey',
    population: 552352,
    surplusUrls: [
      'https://www.ramseycounty.us/residents/property-home/property-taxes/tax-forfeited-land',
    ],
    taxSaleUrls: [
      'https://www.ramseycounty.us/residents/property-home/property-taxes/tax-forfeited-land',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mn-dakota',
    state: 'Minnesota',
    stateAbbr: 'MN',
    county: 'Dakota',
    population: 439882,
    surplusUrls: [
      'https://www.co.dakota.mn.us/Government/PropertyTaxes/TaxForfeiture',
    ],
    taxSaleUrls: [
      'https://www.co.dakota.mn.us/Government/PropertyTaxes/TaxForfeiture',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MISSISSIPPI (MS)
  // =========================================================================
  {
    id: 'ms-hinds',
    state: 'Mississippi',
    stateAbbr: 'MS',
    county: 'Hinds',
    population: 231840,
    surplusUrls: [
      'https://www.co.hinds.ms.us/pgs/apps/taxsales.asp',
    ],
    taxSaleUrls: [
      'https://www.co.hinds.ms.us/pgs/apps/taxsales.asp',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ms-harrison',
    state: 'Mississippi',
    stateAbbr: 'MS',
    county: 'Harrison',
    population: 208080,
    surplusUrls: [
      'https://www.co.harrison.ms.us/departments/chancery_clerk/tax_sales.php',
    ],
    taxSaleUrls: [
      'https://www.co.harrison.ms.us/departments/chancery_clerk/tax_sales.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ms-desoto',
    state: 'Mississippi',
    stateAbbr: 'MS',
    county: 'DeSoto',
    population: 185314,
    surplusUrls: [
      'https://www.desotocountyms.gov/295/Tax-Sales',
    ],
    taxSaleUrls: [
      'https://www.desotocountyms.gov/295/Tax-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MISSOURI (MO)
  // =========================================================================
  {
    id: 'mo-st-louis',
    state: 'Missouri',
    stateAbbr: 'MO',
    county: 'St. Louis',
    population: 1004125,
    surplusUrls: [
      'https://revenue.stlouisco.com/Collection/TaxSale.aspx',
    ],
    taxSaleUrls: [
      'https://revenue.stlouisco.com/Collection/TaxSale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mo-jackson',
    state: 'Missouri',
    stateAbbr: 'MO',
    county: 'Jackson',
    population: 717204,
    surplusUrls: [
      'https://www.jacksongov.org/1087/Tax-Sales',
    ],
    taxSaleUrls: [
      'https://www.jacksongov.org/1087/Tax-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mo-st-charles',
    state: 'Missouri',
    stateAbbr: 'MO',
    county: 'St. Charles',
    population: 412970,
    surplusUrls: [
      'https://www.sccmo.org/436/Tax-Sales',
    ],
    taxSaleUrls: [
      'https://www.sccmo.org/436/Tax-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // MONTANA (MT)
  // =========================================================================
  {
    id: 'mt-yellowstone',
    state: 'Montana',
    stateAbbr: 'MT',
    county: 'Yellowstone',
    population: 164731,
    surplusUrls: [
      'https://www.co.yellowstone.mt.gov/treasurer/taxsale.asp',
    ],
    taxSaleUrls: [
      'https://www.co.yellowstone.mt.gov/treasurer/taxsale.asp',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mt-missoula',
    state: 'Montana',
    stateAbbr: 'MT',
    county: 'Missoula',
    population: 119600,
    surplusUrls: [
      'https://www.missoulacounty.us/government/financial-services/treasurer/tax-lien-sale',
    ],
    taxSaleUrls: [
      'https://www.missoulacounty.us/government/financial-services/treasurer/tax-lien-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'mt-gallatin',
    state: 'Montana',
    stateAbbr: 'MT',
    county: 'Gallatin',
    population: 118730,
    surplusUrls: [
      'https://gallatincomt.virtualtownhall.net/treasurer/pages/tax-lien-sales',
    ],
    taxSaleUrls: [
      'https://gallatincomt.virtualtownhall.net/treasurer/pages/tax-lien-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEBRASKA (NE)
  // =========================================================================
  {
    id: 'ne-douglas',
    state: 'Nebraska',
    stateAbbr: 'NE',
    county: 'Douglas',
    population: 584526,
    surplusUrls: [
      'https://www.douglascounty-ne.gov/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.douglascounty-ne.gov/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ne-lancaster',
    state: 'Nebraska',
    stateAbbr: 'NE',
    county: 'Lancaster',
    population: 322608,
    surplusUrls: [
      'https://lancaster.ne.gov/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://lancaster.ne.gov/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ne-sarpy',
    state: 'Nebraska',
    stateAbbr: 'NE',
    county: 'Sarpy',
    population: 193304,
    surplusUrls: [
      'https://www.sarpy.com/offices/treasurer/tax-sale-information',
    ],
    taxSaleUrls: [
      'https://www.sarpy.com/offices/treasurer/tax-sale-information',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEVADA (NV)
  // =========================================================================
  {
    id: 'nv-clark',
    state: 'Nevada',
    stateAbbr: 'NV',
    county: 'Clark',
    population: 2265461,
    surplusUrls: [
      'https://www.clarkcountynv.gov/government/elected_officials/treasurer/real_property_tax/tax_sale.php',
    ],
    taxSaleUrls: [
      'https://www.clarkcountynv.gov/government/elected_officials/treasurer/real_property_tax/tax_sale.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nv-washoe',
    state: 'Nevada',
    stateAbbr: 'NV',
    county: 'Washoe',
    population: 486492,
    surplusUrls: [
      'https://www.washoecounty.gov/assessor/sales_and_records/tax_sale.php',
    ],
    taxSaleUrls: [
      'https://www.washoecounty.gov/assessor/sales_and_records/tax_sale.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nv-lyon',
    state: 'Nevada',
    stateAbbr: 'NV',
    county: 'Lyon',
    population: 62043,
    surplusUrls: [
      'https://www.lyon-county.org/346/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.lyon-county.org/346/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEW HAMPSHIRE (NH)
  // =========================================================================
  {
    id: 'nh-hillsborough',
    state: 'New Hampshire',
    stateAbbr: 'NH',
    county: 'Hillsborough',
    population: 422937,
    surplusUrls: [
      'https://www.nhes.nh.gov/property-tax',
    ],
    taxSaleUrls: [
      'https://www.nhes.nh.gov/property-tax',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nh-rockingham',
    state: 'New Hampshire',
    stateAbbr: 'NH',
    county: 'Rockingham',
    population: 314176,
    surplusUrls: [
      'https://www.co.rockingham.nh.us/departments/registry_of_deeds/tax_liens.php',
    ],
    taxSaleUrls: [
      'https://www.co.rockingham.nh.us/departments/registry_of_deeds/tax_liens.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nh-merrimack',
    state: 'New Hampshire',
    stateAbbr: 'NH',
    county: 'Merrimack',
    population: 151391,
    surplusUrls: [
      'https://www.merrimackcounty.net/departments/registry-of-deeds/tax-liens',
    ],
    taxSaleUrls: [
      'https://www.merrimackcounty.net/departments/registry-of-deeds/tax-liens',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEW JERSEY (NJ)
  // =========================================================================
  {
    id: 'nj-bergen',
    state: 'New Jersey',
    stateAbbr: 'NJ',
    county: 'Bergen',
    population: 955732,
    surplusUrls: [
      'https://www.co.bergen.nj.us/finance/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.co.bergen.nj.us/finance/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nj-middlesex',
    state: 'New Jersey',
    stateAbbr: 'NJ',
    county: 'Middlesex',
    population: 863162,
    surplusUrls: [
      'https://www.middlesexcountynj.gov/Government/Departments/CF/Pages/Tax-Sale.aspx',
    ],
    taxSaleUrls: [
      'https://www.middlesexcountynj.gov/Government/Departments/CF/Pages/Tax-Sale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nj-essex',
    state: 'New Jersey',
    stateAbbr: 'NJ',
    county: 'Essex',
    population: 863728,
    surplusUrls: [
      'https://www.essexcountynj.org/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.essexcountynj.org/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEW MEXICO (NM)
  // =========================================================================
  {
    id: 'nm-bernalillo',
    state: 'New Mexico',
    stateAbbr: 'NM',
    county: 'Bernalillo',
    population: 676444,
    surplusUrls: [
      'https://www.bernco.gov/treasurer/property-tax/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.bernco.gov/treasurer/property-tax/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nm-dona-ana',
    state: 'New Mexico',
    stateAbbr: 'NM',
    county: 'Dona Ana',
    population: 219561,
    surplusUrls: [
      'https://www.donaanacounty.org/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.donaanacounty.org/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nm-santa-fe',
    state: 'New Mexico',
    stateAbbr: 'NM',
    county: 'Santa Fe',
    population: 154823,
    surplusUrls: [
      'https://www.santafecountynm.gov/treasurer/tax_sale',
    ],
    taxSaleUrls: [
      'https://www.santafecountynm.gov/treasurer/tax_sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NEW YORK (NY)
  // =========================================================================
  {
    id: 'ny-kings',
    state: 'New York',
    stateAbbr: 'NY',
    county: 'Kings',
    population: 2736074,
    surplusUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    taxSaleUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: true,
    enabled: true,
  },
  {
    id: 'ny-queens',
    state: 'New York',
    stateAbbr: 'NY',
    county: 'Queens',
    population: 2405464,
    surplusUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    taxSaleUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: true,
    enabled: true,
  },
  {
    id: 'ny-new-york',
    state: 'New York',
    stateAbbr: 'NY',
    county: 'New York',
    population: 1694263,
    surplusUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    taxSaleUrls: [
      'https://www.nyc.gov/site/finance/taxes/property-lien-sale.page',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: true,
    enabled: true,
  },

  // =========================================================================
  // NORTH CAROLINA (NC)
  // =========================================================================
  {
    id: 'nc-mecklenburg',
    state: 'North Carolina',
    stateAbbr: 'NC',
    county: 'Mecklenburg',
    population: 1115482,
    surplusUrls: [
      'https://www.mecknc.gov/TaxCollections/Pages/Tax-Sale.aspx',
    ],
    taxSaleUrls: [
      'https://www.mecknc.gov/TaxCollections/Pages/Tax-Sale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nc-wake',
    state: 'North Carolina',
    stateAbbr: 'NC',
    county: 'Wake',
    population: 1129410,
    surplusUrls: [
      'https://www.wakegov.com/departments-government/tax-administration/tax-collection/tax-foreclosure',
    ],
    taxSaleUrls: [
      'https://www.wakegov.com/departments-government/tax-administration/tax-collection/tax-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nc-guilford',
    state: 'North Carolina',
    stateAbbr: 'NC',
    county: 'Guilford',
    population: 541299,
    surplusUrls: [
      'https://www.guilfordcountync.gov/our-county/tax/tax-foreclosure',
    ],
    taxSaleUrls: [
      'https://www.guilfordcountync.gov/our-county/tax/tax-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // NORTH DAKOTA (ND)
  // =========================================================================
  {
    id: 'nd-cass',
    state: 'North Dakota',
    stateAbbr: 'ND',
    county: 'Cass',
    population: 184827,
    surplusUrls: [
      'https://www.casscountynd.gov/our-county/auditor-treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.casscountynd.gov/our-county/auditor-treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nd-burleigh',
    state: 'North Dakota',
    stateAbbr: 'ND',
    county: 'Burleigh',
    population: 98458,
    surplusUrls: [
      'https://www.burleighco.com/departments/auditor/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.burleighco.com/departments/auditor/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'nd-grand-forks',
    state: 'North Dakota',
    stateAbbr: 'ND',
    county: 'Grand Forks',
    population: 73170,
    surplusUrls: [
      'https://www.gfcounty.nd.gov/departments/auditor/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.gfcounty.nd.gov/departments/auditor/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // OHIO (OH)
  // =========================================================================
  {
    id: 'oh-cuyahoga',
    state: 'Ohio',
    stateAbbr: 'OH',
    county: 'Cuyahoga',
    population: 1264817,
    surplusUrls: [
      'https://fiscalofficer.cuyahogacounty.us/en-US/Treasurer-Tax-Liens.aspx',
    ],
    taxSaleUrls: [
      'https://fiscalofficer.cuyahogacounty.us/en-US/Treasurer-Tax-Liens.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'oh-franklin',
    state: 'Ohio',
    stateAbbr: 'OH',
    county: 'Franklin',
    population: 1323807,
    surplusUrls: [
      'https://treasurer.franklincountyohio.gov/liens-and-foreclosure',
    ],
    taxSaleUrls: [
      'https://treasurer.franklincountyohio.gov/liens-and-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'oh-hamilton',
    state: 'Ohio',
    stateAbbr: 'OH',
    county: 'Hamilton',
    population: 830639,
    surplusUrls: [
      'https://www.hamiltoncountyohio.gov/government/elected_officials/treasurer/delinquent_tax_program',
    ],
    taxSaleUrls: [
      'https://www.hamiltoncountyohio.gov/government/elected_officials/treasurer/delinquent_tax_program',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // OKLAHOMA (OK)
  // =========================================================================
  {
    id: 'ok-oklahoma',
    state: 'Oklahoma',
    stateAbbr: 'OK',
    county: 'Oklahoma',
    population: 797434,
    surplusUrls: [
      'https://www.oklahomacounty.org/Treasurer/Pages/Tax-Sales.aspx',
    ],
    taxSaleUrls: [
      'https://www.oklahomacounty.org/Treasurer/Pages/Tax-Sales.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ok-tulsa',
    state: 'Oklahoma',
    stateAbbr: 'OK',
    county: 'Tulsa',
    population: 669279,
    surplusUrls: [
      'https://www.tulsacounty.org/Treasurer/TaxSale.aspx',
    ],
    taxSaleUrls: [
      'https://www.tulsacounty.org/Treasurer/TaxSale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ok-cleveland',
    state: 'Oklahoma',
    stateAbbr: 'OK',
    county: 'Cleveland',
    population: 296641,
    surplusUrls: [
      'https://www.clevelandcountyok.com/290/Tax-Sales',
    ],
    taxSaleUrls: [
      'https://www.clevelandcountyok.com/290/Tax-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // OREGON (OR)
  // =========================================================================
  {
    id: 'or-multnomah',
    state: 'Oregon',
    stateAbbr: 'OR',
    county: 'Multnomah',
    population: 815428,
    surplusUrls: [
      'https://multco.us/assessment-taxation/foreclosure-process',
    ],
    taxSaleUrls: [
      'https://multco.us/assessment-taxation/foreclosure-process',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'or-washington',
    state: 'Oregon',
    stateAbbr: 'OR',
    county: 'Washington',
    population: 600372,
    surplusUrls: [
      'https://www.washingtoncountyor.gov/at/tax-foreclosure',
    ],
    taxSaleUrls: [
      'https://www.washingtoncountyor.gov/at/tax-foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'or-clackamas',
    state: 'Oregon',
    stateAbbr: 'OR',
    county: 'Clackamas',
    population: 421401,
    surplusUrls: [
      'https://www.clackamas.us/at/foreclosure',
    ],
    taxSaleUrls: [
      'https://www.clackamas.us/at/foreclosure',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // PENNSYLVANIA (PA)
  // =========================================================================
  {
    id: 'pa-philadelphia',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    county: 'Philadelphia',
    population: 1603797,
    surplusUrls: [
      'https://www.phila.gov/services/property-lots-housing/buy-city-owned-property/buy-property-at-a-sheriffs-sale/',
    ],
    taxSaleUrls: [
      'https://www.phila.gov/services/property-lots-housing/buy-city-owned-property/buy-property-at-a-sheriffs-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'pa-allegheny',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    county: 'Allegheny',
    population: 1250578,
    surplusUrls: [
      'https://www.alleghenycounty.us/real-estate/tax-sale.aspx',
    ],
    taxSaleUrls: [
      'https://www.alleghenycounty.us/real-estate/tax-sale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'pa-montgomery',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    county: 'Montgomery',
    population: 856553,
    surplusUrls: [
      'https://www.montcopa.org/1135/Tax-Claim-Bureau',
    ],
    taxSaleUrls: [
      'https://www.montcopa.org/1135/Tax-Claim-Bureau',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // RHODE ISLAND (RI)
  // =========================================================================
  {
    id: 'ri-providence',
    state: 'Rhode Island',
    stateAbbr: 'RI',
    county: 'Providence',
    population: 660741,
    surplusUrls: [
      'https://www.providenceri.gov/finance/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.providenceri.gov/finance/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ri-kent',
    state: 'Rhode Island',
    stateAbbr: 'RI',
    county: 'Kent',
    population: 164292,
    surplusUrls: [
      'https://www.rigov.com/kent-county/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.rigov.com/kent-county/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ri-washington',
    state: 'Rhode Island',
    stateAbbr: 'RI',
    county: 'Washington',
    population: 129839,
    surplusUrls: [
      'https://www.rigov.com/washington-county/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.rigov.com/washington-county/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // SOUTH CAROLINA (SC)
  // =========================================================================
  {
    id: 'sc-greenville',
    state: 'South Carolina',
    stateAbbr: 'SC',
    county: 'Greenville',
    population: 525534,
    surplusUrls: [
      'https://www.greenvillecounty.org/TaxCollector/TaxSale.aspx',
    ],
    taxSaleUrls: [
      'https://www.greenvillecounty.org/TaxCollector/TaxSale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'sc-richland',
    state: 'South Carolina',
    stateAbbr: 'SC',
    county: 'Richland',
    population: 415759,
    surplusUrls: [
      'https://www.richlandcountysc.gov/Government/Departments/Treasurer/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.richlandcountysc.gov/Government/Departments/Treasurer/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'sc-charleston',
    state: 'South Carolina',
    stateAbbr: 'SC',
    county: 'Charleston',
    population: 408235,
    surplusUrls: [
      'https://www.charlestoncounty.org/departments/delinquent-tax/tax-sale.php',
    ],
    taxSaleUrls: [
      'https://www.charlestoncounty.org/departments/delinquent-tax/tax-sale.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // SOUTH DAKOTA (SD)
  // =========================================================================
  {
    id: 'sd-minnehaha',
    state: 'South Dakota',
    stateAbbr: 'SD',
    county: 'Minnehaha',
    population: 197214,
    surplusUrls: [
      'https://www.minnehahacounty.org/dept/tr/taxsale.aspx',
    ],
    taxSaleUrls: [
      'https://www.minnehahacounty.org/dept/tr/taxsale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'sd-pennington',
    state: 'South Dakota',
    stateAbbr: 'SD',
    county: 'Pennington',
    population: 113775,
    surplusUrls: [
      'https://www.pennco.org/treasurer/tax-deed-sales',
    ],
    taxSaleUrls: [
      'https://www.pennco.org/treasurer/tax-deed-sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'sd-lincoln',
    state: 'South Dakota',
    stateAbbr: 'SD',
    county: 'Lincoln',
    population: 65161,
    surplusUrls: [
      'https://www.lincolncountysd.org/164/Tax-Deed-Sales',
    ],
    taxSaleUrls: [
      'https://www.lincolncountysd.org/164/Tax-Deed-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // TENNESSEE (TN)
  // =========================================================================
  {
    id: 'tn-shelby',
    state: 'Tennessee',
    stateAbbr: 'TN',
    county: 'Shelby',
    population: 929744,
    surplusUrls: [
      'https://www.shelbycountytrustee.com/tax-sales/surplus-funds',
      'https://www.shelbycountytrustee.com/excess-proceeds',
    ],
    taxSaleUrls: [
      'https://www.shelbycountytrustee.com/tax-sales',
    ],
    clerkUrls: [
      'https://register.shelby.tn.us/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.surplus-funds-table, .excess-proceeds-table',
    },
    requiresJs: true,
    hasAntiBot: false,
    waitForSelector: 'table',
    enabled: true,
  },
  {
    id: 'tn-davidson',
    state: 'Tennessee',
    stateAbbr: 'TN',
    county: 'Davidson',
    population: 715884,
    surplusUrls: [
      'https://www.nashville.gov/departments/trustee/tax-sale-info/surplus-funds',
    ],
    taxSaleUrls: [
      'https://www.nashville.gov/departments/trustee/tax-sale-info',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'tn-knox',
    state: 'Tennessee',
    stateAbbr: 'TN',
    county: 'Knox',
    population: 478971,
    surplusUrls: [
      'https://www.knoxcounty.org/trustee/tax_sale.php',
    ],
    taxSaleUrls: [
      'https://www.knoxcounty.org/trustee/tax_sale.php',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // TEXAS (TX)
  // =========================================================================
  {
    id: 'tx-harris',
    state: 'Texas',
    stateAbbr: 'TX',
    county: 'Harris',
    population: 4731145,
    surplusUrls: [
      'https://www.hctax.net/Property/TaxSales/SurplusFunds',
      'https://www.hctax.net/Property/ExcessProceeds',
    ],
    taxSaleUrls: [
      'https://www.hctax.net/Property/TaxSales',
    ],
    clerkUrls: [
      'https://www.cclerk.hctx.net/',
    ],
    parserType: 'table',
    selectors: {
      ...DEFAULT_TABLE_SELECTORS,
      dataContainerSelector: '.surplus-funds-grid, #gridSurplus',
    },
    requiresJs: true,
    hasAntiBot: true,
    waitForSelector: 'table, .grid',
    enabled: true,
  },
  {
    id: 'tx-dallas',
    state: 'Texas',
    stateAbbr: 'TX',
    county: 'Dallas',
    population: 2613539,
    surplusUrls: [
      'https://www.dallascounty.org/departments/tax/excess-proceeds/',
    ],
    taxSaleUrls: [
      'https://www.dallascounty.org/departments/tax/taxsale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'tx-tarrant',
    state: 'Texas',
    stateAbbr: 'TX',
    county: 'Tarrant',
    population: 2110640,
    surplusUrls: [
      'https://www.tarrantcounty.com/en/tax/tax-sales/excess-proceeds.html',
    ],
    taxSaleUrls: [
      'https://www.tarrantcounty.com/en/tax/tax-sales.html',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // UTAH (UT)
  // =========================================================================
  {
    id: 'ut-salt-lake',
    state: 'Utah',
    stateAbbr: 'UT',
    county: 'Salt Lake',
    population: 1185238,
    surplusUrls: [
      'https://slco.org/treasurer/tax-sale/',
    ],
    taxSaleUrls: [
      'https://slco.org/treasurer/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ut-utah',
    state: 'Utah',
    stateAbbr: 'UT',
    county: 'Utah',
    population: 659399,
    surplusUrls: [
      'https://www.utahcounty.gov/Dept/Treas/TaxSale.asp',
    ],
    taxSaleUrls: [
      'https://www.utahcounty.gov/Dept/Treas/TaxSale.asp',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'ut-davis',
    state: 'Utah',
    stateAbbr: 'UT',
    county: 'Davis',
    population: 361676,
    surplusUrls: [
      'https://www.daviscountyutah.gov/treasurer/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.daviscountyutah.gov/treasurer/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // VERMONT (VT)
  // =========================================================================
  {
    id: 'vt-chittenden',
    state: 'Vermont',
    stateAbbr: 'VT',
    county: 'Chittenden',
    population: 168323,
    surplusUrls: [
      'https://www.burlingtonvt.gov/Treasurer/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.burlingtonvt.gov/Treasurer/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'vt-rutland',
    state: 'Vermont',
    stateAbbr: 'VT',
    county: 'Rutland',
    population: 60572,
    surplusUrls: [
      'https://www.rutlandcity.org/departments/treasury/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.rutlandcity.org/departments/treasury/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'vt-washington',
    state: 'Vermont',
    stateAbbr: 'VT',
    county: 'Washington',
    population: 59807,
    surplusUrls: [
      'https://www.montpelier-vt.org/296/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.montpelier-vt.org/296/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // VIRGINIA (VA)
  // =========================================================================
  {
    id: 'va-fairfax',
    state: 'Virginia',
    stateAbbr: 'VA',
    county: 'Fairfax',
    population: 1150309,
    surplusUrls: [
      'https://www.fairfaxcounty.gov/taxes/real-estate-tax/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.fairfaxcounty.gov/taxes/real-estate-tax/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'va-prince-william',
    state: 'Virginia',
    stateAbbr: 'VA',
    county: 'Prince William',
    population: 482204,
    surplusUrls: [
      'https://www.pwcgov.org/government/dept/finance/Pages/Tax-Sale.aspx',
    ],
    taxSaleUrls: [
      'https://www.pwcgov.org/government/dept/finance/Pages/Tax-Sale.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'va-loudoun',
    state: 'Virginia',
    stateAbbr: 'VA',
    county: 'Loudoun',
    population: 420959,
    surplusUrls: [
      'https://www.loudoun.gov/4906/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.loudoun.gov/4906/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // WASHINGTON (WA)
  // =========================================================================
  {
    id: 'wa-king',
    state: 'Washington',
    stateAbbr: 'WA',
    county: 'King',
    population: 2269675,
    surplusUrls: [
      'https://kingcounty.gov/depts/finance-business-operations/treasury/foreclosure/excess-funds.aspx',
    ],
    taxSaleUrls: [
      'https://kingcounty.gov/depts/finance-business-operations/treasury/foreclosure.aspx',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wa-pierce',
    state: 'Washington',
    stateAbbr: 'WA',
    county: 'Pierce',
    population: 921130,
    surplusUrls: [
      'https://www.piercecountywa.gov/172/Tax-Title-Sales',
    ],
    taxSaleUrls: [
      'https://www.piercecountywa.gov/172/Tax-Title-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wa-snohomish',
    state: 'Washington',
    stateAbbr: 'WA',
    county: 'Snohomish',
    population: 827957,
    surplusUrls: [
      'https://www.snohomishcountywa.gov/1073/Tax-Title-Properties',
    ],
    taxSaleUrls: [
      'https://www.snohomishcountywa.gov/1073/Tax-Title-Properties',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // WEST VIRGINIA (WV)
  // =========================================================================
  {
    id: 'wv-kanawha',
    state: 'West Virginia',
    stateAbbr: 'WV',
    county: 'Kanawha',
    population: 183293,
    surplusUrls: [
      'https://www.kanawha.us/sheriff/tax-sale/',
    ],
    taxSaleUrls: [
      'https://www.kanawha.us/sheriff/tax-sale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wv-berkeley',
    state: 'West Virginia',
    stateAbbr: 'WV',
    county: 'Berkeley',
    population: 121004,
    surplusUrls: [
      'https://www.berkeleycountycomm.org/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.berkeleycountycomm.org/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wv-cabell',
    state: 'West Virginia',
    stateAbbr: 'WV',
    county: 'Cabell',
    population: 93206,
    surplusUrls: [
      'https://www.cabellcounty.org/offices/sheriff/tax-sale',
    ],
    taxSaleUrls: [
      'https://www.cabellcounty.org/offices/sheriff/tax-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // WISCONSIN (WI)
  // =========================================================================
  {
    id: 'wi-milwaukee',
    state: 'Wisconsin',
    stateAbbr: 'WI',
    county: 'Milwaukee',
    population: 939489,
    surplusUrls: [
      'https://county.milwaukee.gov/EN/Treasurer/Tax-Deed-Sales',
    ],
    taxSaleUrls: [
      'https://county.milwaukee.gov/EN/Treasurer/Tax-Deed-Sales',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wi-dane',
    state: 'Wisconsin',
    stateAbbr: 'WI',
    county: 'Dane',
    population: 561504,
    surplusUrls: [
      'https://www.danecountytreasurer.com/tax-deed-sale',
    ],
    taxSaleUrls: [
      'https://www.danecountytreasurer.com/tax-deed-sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wi-waukesha',
    state: 'Wisconsin',
    stateAbbr: 'WI',
    county: 'Waukesha',
    population: 406978,
    surplusUrls: [
      'https://www.waukeshacounty.gov/treasurer/taxsale/',
    ],
    taxSaleUrls: [
      'https://www.waukeshacounty.gov/treasurer/taxsale/',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },

  // =========================================================================
  // WYOMING (WY)
  // =========================================================================
  {
    id: 'wy-laramie',
    state: 'Wyoming',
    stateAbbr: 'WY',
    county: 'Laramie',
    population: 100512,
    surplusUrls: [
      'https://www.laramiecounty.com/427/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.laramiecounty.com/427/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wy-natrona',
    state: 'Wyoming',
    stateAbbr: 'WY',
    county: 'Natrona',
    population: 79858,
    surplusUrls: [
      'https://www.natronacounty-wy.gov/237/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.natronacounty-wy.gov/237/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
  {
    id: 'wy-campbell',
    state: 'Wyoming',
    stateAbbr: 'WY',
    county: 'Campbell',
    population: 46341,
    surplusUrls: [
      'https://www.ccgov.net/154/Tax-Sale',
    ],
    taxSaleUrls: [
      'https://www.ccgov.net/154/Tax-Sale',
    ],
    clerkUrls: [],
    parserType: 'table',
    selectors: { ...DEFAULT_TABLE_SELECTORS },
    requiresJs: true,
    hasAntiBot: false,
    enabled: true,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all configs for a specific state
 */
export function getConfigsByState(stateAbbr: string): CountyScraperConfig[] {
  return COUNTY_CONFIGS.filter((c) => c.stateAbbr === stateAbbr && c.enabled);
}

/**
 * Get config by ID
 */
export function getConfigById(id: string): CountyScraperConfig | undefined {
  return COUNTY_CONFIGS.find((c) => c.id === id);
}

/**
 * Get all enabled configs
 */
export function getEnabledConfigs(): CountyScraperConfig[] {
  return COUNTY_CONFIGS.filter((c) => c.enabled);
}

/**
 * Get all states with configs
 */
export function getStatesWithConfigs(): string[] {
  const states = new Set<string>();
  COUNTY_CONFIGS.forEach((c) => states.add(c.stateAbbr));
  return Array.from(states).sort();
}

/**
 * Get statistics about county coverage
 */
export function getCoverageStats(): {
  totalCounties: number;
  totalStates: number;
  enabledCounties: number;
  byState: Record<string, number>;
} {
  const byState: Record<string, number> = {};
  let enabledCount = 0;

  COUNTY_CONFIGS.forEach((c) => {
    byState[c.stateAbbr] = (byState[c.stateAbbr] || 0) + 1;
    if (c.enabled) enabledCount++;
  });

  return {
    totalCounties: COUNTY_CONFIGS.length,
    totalStates: Object.keys(byState).length,
    enabledCounties: enabledCount,
    byState,
  };
}

/**
 * Get high-population counties
 */
export function getHighPopulationConfigs(minPopulation: number = 500000): CountyScraperConfig[] {
  return COUNTY_CONFIGS.filter((c) => c.enabled && (c.population || 0) >= minPopulation);
}
