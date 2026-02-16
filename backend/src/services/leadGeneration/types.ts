/**
 * Lead Generation Types
 *
 * Type definitions for all lead generation services including:
 * - FOIA Request Bot
 * - Auction Site Scrapers
 * - State Unclaimed Property Scrapers
 * - Court Record APIs
 * - Google Custom Search
 * - News/Alert Monitor
 */

// =============================================================================
// COMMON TYPES
// =============================================================================

export interface LeadRecord {
  ownerName?: string;
  propertyAddress?: string;
  parcelNumber?: string;
  saleDate?: string;
  saleAmountCents?: number;
  surplusAmountCents?: number;
  city?: string;
  state: string;
  county?: string;
  zipCode?: string;
  sourceType: LeadSourceType;
  sourceUrl?: string;
  sourceId?: string;
  rawData?: Record<string, unknown>;
  confidence: number; // 0-100
  priority: number;
}

export type LeadSourceType =
  | 'FOIA_RESPONSE'
  | 'AUCTION_SCRAPE'
  | 'UNCLAIMED_PROPERTY'
  | 'COURT_RECORD'
  | 'GOOGLE_SEARCH'
  | 'NEWS_ALERT'
  | 'COUNTY_WEBSITE';

export interface LeadGenerationResult {
  success: boolean;
  source: string;
  leadsFound: number;
  leadsCreated: number;
  errors: string[];
  durationMs: number;
  nextRunAt?: Date;
}

// =============================================================================
// FOIA REQUEST BOT TYPES
// =============================================================================

export interface CountyClerkContact {
  id: string;
  county: string;
  state: string;
  stateAbbr: string;
  clerkName?: string;
  email: string;
  phone?: string;
  faxNumber?: string;
  mailingAddress?: string;
  website?: string;
  foiaEmail?: string;
  foiaFormUrl?: string;
  preferredMethod: 'email' | 'fax' | 'mail' | 'online_form';
  responseTimeAvgDays?: number;
  lastRequestSentAt?: Date;
  lastResponseAt?: Date;
  totalRequests: number;
  totalResponses: number;
  notes?: string;
}

export interface FOIARequest {
  id: string;
  countyId: string;
  county: string;
  state: string;
  requestType: 'surplus_funds' | 'tax_sale_results' | 'excess_proceeds' | 'unclaimed_funds';
  sentAt: Date;
  sentVia: 'email' | 'fax' | 'mail' | 'online_form';
  status: 'pending' | 'responded' | 'denied' | 'no_response' | 'partial';
  followUpSentAt?: Date;
  respondedAt?: Date;
  responseType?: 'pdf' | 'excel' | 'csv' | 'link' | 'denied' | 'no_records';
  attachmentPaths?: string[];
  recordsExtracted?: number;
  notes?: string;
}

export interface FOIATemplate {
  id: string;
  name: string;
  requestType: FOIARequest['requestType'];
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
  state?: string; // State-specific template
}

// =============================================================================
// AUCTION SCRAPER TYPES
// =============================================================================

export interface AuctionSite {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  scraperType: 'bid4assets' | 'govease' | 'realauction' | 'other';
  requiresLogin: boolean;
  loginUrl?: string;
  username?: string;
  password?: string;
  lastScrapeAt?: Date;
  lastSuccessAt?: Date;
  totalRecordsScraped: number;
}

export interface AuctionRecord {
  auctionSiteId: string;
  auctionId: string;
  parcelNumber?: string;
  propertyAddress: string;
  city?: string;
  state: string;
  county: string;
  zipCode?: string;
  propertyType?: string;
  auctionDate: string;
  openingBid?: number;
  winningBid?: number;
  assessedValue?: number;
  surplusAmountCents?: number;
  status: 'completed' | 'no_bid' | 'redeemed' | 'cancelled';
  previousOwner?: string;
  buyerName?: string;
  sourceUrl: string;
  rawData?: Record<string, unknown>;
}

// =============================================================================
// UNCLAIMED PROPERTY SCRAPER TYPES
// =============================================================================

export interface StateUnclaimedPropertySite {
  id: string;
  state: string;
  stateAbbr: string;
  siteName: string;
  baseUrl: string;
  searchUrl: string;
  enabled: boolean;
  scraperType: 'texas' | 'california' | 'florida' | 'generic';
  supportsPropertySearch: boolean;
  supportsBulkSearch: boolean;
  lastScrapeAt?: Date;
  totalRecordsScraped: number;
}

export interface UnclaimedPropertyRecord {
  siteId: string;
  recordId: string;
  ownerName: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
  propertyType: string;
  propertyDescription?: string;
  reportedValue?: number;
  reportingCompany?: string;
  reportedDate?: string;
  state: string;
  sourceUrl: string;
  rawData?: Record<string, unknown>;
}

// =============================================================================
// COURT RECORD API TYPES
// =============================================================================

export interface CourtRecordSource {
  id: string;
  name: string;
  type: 'pacer' | 'state_api' | 'county_api';
  state?: string;
  county?: string;
  apiUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  supportsPropertySearch: boolean;
  supportsCaseTypeFilter: boolean;
  caseTypes?: string[];
  lastQueryAt?: Date;
  totalRecordsFound: number;
}

export interface CourtRecord {
  sourceId: string;
  caseNumber: string;
  caseType: string;
  courtName: string;
  filingDate: string;
  partyNames: string[];
  propertyAddress?: string;
  parcelNumber?: string;
  judgmentAmount?: number;
  surplusAmount?: number;
  status: string;
  documents?: string[];
  sourceUrl: string;
  rawData?: Record<string, unknown>;
}

// =============================================================================
// GOOGLE CUSTOM SEARCH TYPES
// =============================================================================

export interface GoogleSearchConfig {
  apiKey: string;
  searchEngineId: string;
  enabled: boolean;
  dailyQuota: number;
  queriesUsedToday: number;
  lastResetAt: Date;
}

export interface GoogleSearchQuery {
  id: string;
  queryTemplate: string;
  state?: string;
  county?: string;
  category: 'surplus_funds' | 'tax_sale' | 'excess_proceeds' | 'unclaimed';
  enabled: boolean;
  lastRunAt?: Date;
  totalResultsFound: number;
}

export interface GoogleSearchResult {
  queryId: string;
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  fileType?: string;
  state?: string;
  county?: string;
  relevanceScore: number;
  downloadedAt?: Date;
  parsedRecords?: number;
}

// =============================================================================
// NEWS/ALERT MONITOR TYPES
// =============================================================================

export interface AlertMonitorConfig {
  id: string;
  name: string;
  type: 'google_alert' | 'rss' | 'web_monitor' | 'email_inbox';
  enabled: boolean;
  keywords: string[];
  excludeKeywords?: string[];
  sourceUrl?: string;
  emailAddress?: string;
  checkIntervalMinutes: number;
  lastCheckAt?: Date;
  totalAlertsReceived: number;
}

export interface AlertRecord {
  monitorId: string;
  title: string;
  content: string;
  sourceUrl: string;
  publishedAt: Date;
  state?: string;
  county?: string;
  category: string;
  relevanceScore: number;
  processed: boolean;
  leadsGenerated?: number;
}

// =============================================================================
// LEAD GENERATION STATS
// =============================================================================

export interface LeadGenStats {
  totalLeads: number;
  bySource: Record<LeadSourceType, number>;
  byState: Record<string, number>;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  conversionRate: number;
  avgSurplusAmount: number;
  topStates: { state: string; count: number; avgSurplus: number }[];
  topCounties: { county: string; state: string; count: number }[];
}
