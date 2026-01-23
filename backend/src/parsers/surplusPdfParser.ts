/**
 * surplusPdfParser.ts
 *
 * Production parser for surplus fund PDF documents from county clerks.
 * Extracts owner, address, case numbers, and surplus amounts from PDF text content.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { createHash } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface SurplusRecord {
  caseNumber: string;
  parcelId: string;
  ownerName: string;
  coOwnerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerMailingAddress: string;
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  surplusAmountCents: number;
  saleDate: Date | null;
  claimDeadline: Date | null;
  county: string;
  sourceUrl: string;
  pageNumber: number;
  contentHash: string;
}

export interface SurplusPdfParserResult {
  records: SurplusRecord[];
  diagnostics: SurplusPdfParserDiagnostics;
}

export interface SurplusPdfParserDiagnostics {
  totalPages: number;
  parsedRecords: number;
  malformedEntries: MalformedEntry[];
  duplicateEntries: DuplicateEntry[];
  highValueRecords: HighValueSurplusRecord[];
  parseTimeMs: number;
  detectedFormat: string | null;
  warnings: string[];
}

export interface MalformedEntry {
  pageNumber: number;
  rawContent: string;
  reason: string;
}

export interface DuplicateEntry {
  pageNumber: number;
  originalPageNumber: number;
  caseNumber: string;
}

export interface HighValueSurplusRecord {
  pageNumber: number;
  caseNumber: string;
  surplusAmountCents: number;
  ownerName: string;
}

// =============================================================================
// PDF FORMAT PATTERNS
// =============================================================================

// Common patterns for extracting data from surplus fund PDFs
const CASE_NUMBER_PATTERNS = [
  /case\s*(?:#|no\.?|number)?:?\s*([A-Z0-9\-]+)/i,
  /(?:cv|ca|fc|pr)\s*[\-\s]?\s*(\d{2,4}[\-\s]\d{3,6})/i,
  /docket\s*(?:#|no\.?)?:?\s*([A-Z0-9\-]+)/i,
  /file\s*(?:#|no\.?)?:?\s*([A-Z0-9\-]+)/i,
];

const PARCEL_PATTERNS = [
  /parcel\s*(?:#|id|no\.?)?:?\s*([A-Z0-9\-\.]+)/i,
  /apn:?\s*([A-Z0-9\-\.]+)/i,
  /tax\s*(?:id|parcel):?\s*([A-Z0-9\-\.]+)/i,
  /folio:?\s*([A-Z0-9\-\.]+)/i,
];

const OWNER_PATTERNS = [
  /(?:owner|defendant|property\s*owner|former\s*owner):?\s*([A-Z][A-Za-z\s,\.]+?)(?:\n|$|;)/i,
  /(?:in\s*(?:the\s*)?(?:name|matter)\s*of):?\s*([A-Z][A-Za-z\s,\.]+?)(?:\n|$|;)/i,
  /(?:surplus\s*(?:due|owed|payable)\s*to):?\s*([A-Z][A-Za-z\s,\.]+?)(?:\n|$|;)/i,
];

const ADDRESS_PATTERNS = [
  /(?:property\s*)?address:?\s*(.+?)(?:\n|$|(?:city|state|zip))/i,
  /(?:situs|location):?\s*(.+?)(?:\n|$|(?:city|state|zip))/i,
  /(\d+\s+[A-Za-z0-9\s\.]+(?:st(?:reet)?|ave(?:nue)?|rd|road|dr(?:ive)?|ln|lane|ct|court|blvd|boulevard|way|pl(?:ace)?|cir(?:cle)?))(?:\s*,?\s*([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?))?/i,
];

const AMOUNT_PATTERNS = [
  /surplus\s*(?:amount|funds?|balance)?:?\s*\$?\s*([\d,]+\.?\d*)/i,
  /(?:excess|overage|overbid)\s*(?:amount|funds?)?:?\s*\$?\s*([\d,]+\.?\d*)/i,
  /(?:amount|balance)\s*(?:due|owed|available):?\s*\$?\s*([\d,]+\.?\d*)/i,
  /\$\s*([\d,]+\.?\d{2})/,
];

const DATE_PATTERNS = [
  /(?:sale|auction)\s*date:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:sold|auctioned)\s*(?:on)?:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /date\s*of\s*sale:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
];

const DEADLINE_PATTERNS = [
  /(?:claim|filing)\s*deadline:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:must\s*claim\s*by|claim\s*before):?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:expires?|expiration):?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
];

const PHONE_PATTERNS = [
  /(?:phone|tel(?:ephone)?|contact|cell|mobile):?\s*\(?(\d{3})\)?[\s\-\.]?(\d{3})[\s\-\.]?(\d{4})/i,
  /\((\d{3})\)\s*(\d{3})[\s\-]?(\d{4})/,
  /(\d{3})[\s\-\.](\d{3})[\s\-\.](\d{4})/,
];

const EMAIL_PATTERNS = [
  /(?:email|e-mail|contact):?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
];

const MAILING_ADDRESS_PATTERNS = [
  /(?:mailing\s*(?:address)?|mail\s*to|send\s*to|contact\s*address):?\s*(.+?)(?:\n|$|(?:phone|email|tel))/i,
];

// =============================================================================
// VALUE NORMALIZATION
// =============================================================================

function normalizeMonetaryValue(value: string): number {
  if (!value || value.trim() === "") return 0;

  // Remove currency symbols, commas, spaces
  let cleaned = value.replace(/[$,\s]/g, "").trim();

  // Handle parentheses for negative numbers
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    cleaned = "-" + cleaned.slice(1, -1);
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  // Convert to cents
  return Math.round(parsed * 100);
}

function normalizeDate(value: string): Date | null {
  if (!value || value.trim() === "") return null;

  const cleaned = value.trim();

  // Try MM/DD/YYYY or MM-DD-YYYY
  const usMatch = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (usMatch) {
    let [, month, day, year] = usMatch;
    // Handle 2-digit year
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      const twoDigitYear = parseInt(year);
      year = (twoDigitYear > 50 ? century - 100 + twoDigitYear : century + twoDigitYear).toString();
    }
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // Try ISO format
  const isoDate = new Date(cleaned);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  return null;
}

function normalizeString(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeParcelId(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeCaseNumber(value: string): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

// =============================================================================
// PDF FORMAT DETECTION
// =============================================================================

type PdfFormat = "TABLE_FORMAT" | "BLOCK_FORMAT" | "LIST_FORMAT" | "UNKNOWN";

function detectPdfFormat(text: string): PdfFormat {
  // Check for table-like structure (multiple rows with consistent columns)
  const lines = text.split("\n").filter(l => l.trim());
  const tabLines = lines.filter(l => l.includes("\t") || /\s{3,}/.test(l));

  if (tabLines.length > lines.length * 0.5) {
    return "TABLE_FORMAT";
  }

  // Check for block format (sections separated by double newlines or headers)
  const blocks = text.split(/\n{2,}/).filter(b => b.trim());
  const hasBlockHeaders = blocks.some(b =>
    /^(?:case|parcel|owner|property|surplus)/i.test(b.trim())
  );

  if (blocks.length > 3 && hasBlockHeaders) {
    return "BLOCK_FORMAT";
  }

  // Check for numbered list format
  const numberedLines = lines.filter(l => /^\s*\d+[\.\)]\s/.test(l));
  if (numberedLines.length > lines.length * 0.3) {
    return "LIST_FORMAT";
  }

  return "UNKNOWN";
}

// =============================================================================
// EXTRACTION HELPERS
// =============================================================================

function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const pattern of AMOUNT_PATTERNS) {
    let match;
    const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
    while ((match = globalPattern.exec(text)) !== null) {
      const amount = normalizeMonetaryValue(match[1]);
      if (amount > 0) {
        amounts.push(amount);
      }
    }
  }
  return amounts;
}

function splitOwnerNames(ownerString: string): { primary: string; coOwner: string } {
  if (!ownerString) return { primary: "", coOwner: "" };

  // Check for "and", "&", "et al", "et ux"
  const separators = [
    /\s+and\s+/i,
    /\s*&\s*/,
    /\s+et\s+(?:al|ux|vir)\b\.?/i,
    /\s*,\s*(?=[A-Z])/,
  ];

  for (const sep of separators) {
    const parts = ownerString.split(sep);
    if (parts.length >= 2) {
      return {
        primary: normalizeString(parts[0]),
        coOwner: normalizeString(parts.slice(1).join(" ")),
      };
    }
  }

  return { primary: normalizeString(ownerString), coOwner: "" };
}

function parseAddressComponents(addressString: string): {
  address: string;
  city: string;
  state: string;
  zipCode: string;
} {
  if (!addressString) {
    return { address: "", city: "", state: "", zipCode: "" };
  }

  // Try to match full address with city, state, zip
  const fullMatch = addressString.match(
    /(.+?),\s*([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/
  );

  if (fullMatch) {
    return {
      address: normalizeString(fullMatch[1]),
      city: normalizeString(fullMatch[2]),
      state: fullMatch[3].toUpperCase(),
      zipCode: fullMatch[4] || "",
    };
  }

  // Try to extract just the zip code
  const zipMatch = addressString.match(/(\d{5}(?:-\d{4})?)\s*$/);
  const stateMatch = addressString.match(/\b([A-Z]{2})\b/);

  return {
    address: normalizeString(addressString.replace(/,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\s*$/, "")),
    city: "",
    state: stateMatch ? stateMatch[1] : "",
    zipCode: zipMatch ? zipMatch[1] : "",
  };
}

function extractPhone(text: string): string {
  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to (XXX) XXX-XXXX format
      const digits = (match[1] || "") + (match[2] || "") + (match[3] || "");
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
    }
  }
  return "";
}

function extractEmail(text: string): string {
  for (const pattern of EMAIL_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }
  }
  return "";
}

function extractMailingAddress(text: string): string {
  const match = extractFirstMatch(text, MAILING_ADDRESS_PATTERNS);
  return match ? normalizeString(match) : "";
}

// =============================================================================
// CONTENT HASH
// =============================================================================

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// =============================================================================
// HIGH VALUE THRESHOLD
// =============================================================================

const HIGH_VALUE_THRESHOLD_CENTS = 1000000; // $10,000

// =============================================================================
// PARSERS BY FORMAT
// =============================================================================

function parseBlockFormat(
  text: string,
  county: string,
  sourceUrl: string,
  pageNumber: number
): SurplusRecord[] {
  const records: SurplusRecord[] = [];
  const blocks = text.split(/\n{2,}/).filter(b => b.trim());

  for (const block of blocks) {
    const caseNumber = extractFirstMatch(block, CASE_NUMBER_PATTERNS);
    const amounts = extractAllAmounts(block);

    // Skip blocks without case number or amounts
    if (!caseNumber || amounts.length === 0) continue;

    const ownerMatch = extractFirstMatch(block, OWNER_PATTERNS);
    const { primary: ownerName, coOwner: coOwnerName } = splitOwnerNames(ownerMatch || "");

    const parcelId = extractFirstMatch(block, PARCEL_PATTERNS) || "";
    const addressMatch = extractFirstMatch(block, ADDRESS_PATTERNS);
    const { address, city, state, zipCode } = parseAddressComponents(addressMatch || "");

    const saleDateStr = extractFirstMatch(block, DATE_PATTERNS);
    const deadlineStr = extractFirstMatch(block, DEADLINE_PATTERNS);

    // Extract contact info (FOUNDER needs this)
    const ownerPhone = extractPhone(block);
    const ownerEmail = extractEmail(block);
    const ownerMailingAddress = extractMailingAddress(block);

    // Use the largest amount as surplus (usually the most relevant)
    const surplusAmountCents = Math.max(...amounts);

    const contentHash = computeContentHash(
      `${caseNumber}|${ownerName}|${parcelId}|${surplusAmountCents}`
    );

    records.push({
      caseNumber: normalizeCaseNumber(caseNumber),
      parcelId: normalizeParcelId(parcelId),
      ownerName,
      coOwnerName,
      ownerPhone,
      ownerEmail,
      ownerMailingAddress,
      propertyAddress: address,
      city,
      state,
      zipCode,
      surplusAmountCents,
      saleDate: normalizeDate(saleDateStr || ""),
      claimDeadline: normalizeDate(deadlineStr || ""),
      county,
      sourceUrl,
      pageNumber,
      contentHash,
    });
  }

  return records;
}

function parseTableFormat(
  text: string,
  county: string,
  sourceUrl: string,
  pageNumber: number
): SurplusRecord[] {
  const records: SurplusRecord[] = [];
  const lines = text.split("\n").filter(l => l.trim());

  // Try to identify header row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (
      line.includes("case") ||
      line.includes("owner") ||
      line.includes("surplus") ||
      line.includes("amount")
    ) {
      headerIndex = i;
      break;
    }
  }

  const dataStartIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];

    // Split by tabs or multiple spaces
    const cells = line.split(/\t|\s{3,}/).filter(c => c.trim());
    if (cells.length < 2) continue;

    // Try to extract data from cells
    const amounts = extractAllAmounts(line);
    if (amounts.length === 0) continue;

    const caseNumber = extractFirstMatch(line, CASE_NUMBER_PATTERNS) ||
      cells.find(c => /^[A-Z0-9\-]{5,}$/.test(c.trim())) || "";

    if (!caseNumber) continue;

    const ownerCell = cells.find(c =>
      /^[A-Z][a-z]+/.test(c.trim()) && !AMOUNT_PATTERNS.some(p => p.test(c))
    );
    const { primary: ownerName, coOwner: coOwnerName } = splitOwnerNames(ownerCell || "");

    const parcelId = extractFirstMatch(line, PARCEL_PATTERNS) || "";
    const addressMatch = extractFirstMatch(line, ADDRESS_PATTERNS);
    const { address, city, state, zipCode } = parseAddressComponents(addressMatch || "");

    // Extract contact info (FOUNDER needs this)
    const ownerPhone = extractPhone(line);
    const ownerEmail = extractEmail(line);
    const ownerMailingAddress = extractMailingAddress(line);

    const surplusAmountCents = Math.max(...amounts);

    const contentHash = computeContentHash(
      `${caseNumber}|${ownerName}|${parcelId}|${surplusAmountCents}`
    );

    records.push({
      caseNumber: normalizeCaseNumber(caseNumber),
      parcelId: normalizeParcelId(parcelId),
      ownerName,
      coOwnerName,
      ownerPhone,
      ownerEmail,
      ownerMailingAddress,
      propertyAddress: address,
      city,
      state,
      zipCode,
      surplusAmountCents,
      saleDate: null,
      claimDeadline: null,
      county,
      sourceUrl,
      pageNumber,
      contentHash,
    });
  }

  return records;
}

function parseListFormat(
  text: string,
  county: string,
  sourceUrl: string,
  pageNumber: number
): SurplusRecord[] {
  const records: SurplusRecord[] = [];

  // Split by numbered items
  const items = text.split(/(?=\n\s*\d+[\.\)]\s)/);

  for (const item of items) {
    const amounts = extractAllAmounts(item);
    if (amounts.length === 0) continue;

    const caseNumber = extractFirstMatch(item, CASE_NUMBER_PATTERNS) || "";
    if (!caseNumber) continue;

    const ownerMatch = extractFirstMatch(item, OWNER_PATTERNS);
    const { primary: ownerName, coOwner: coOwnerName } = splitOwnerNames(ownerMatch || "");

    const parcelId = extractFirstMatch(item, PARCEL_PATTERNS) || "";
    const addressMatch = extractFirstMatch(item, ADDRESS_PATTERNS);
    const { address, city, state, zipCode } = parseAddressComponents(addressMatch || "");

    const saleDateStr = extractFirstMatch(item, DATE_PATTERNS);
    const deadlineStr = extractFirstMatch(item, DEADLINE_PATTERNS);

    // Extract contact info (FOUNDER needs this)
    const ownerPhone = extractPhone(item);
    const ownerEmail = extractEmail(item);
    const ownerMailingAddress = extractMailingAddress(item);

    const surplusAmountCents = Math.max(...amounts);

    const contentHash = computeContentHash(
      `${caseNumber}|${ownerName}|${parcelId}|${surplusAmountCents}`
    );

    records.push({
      caseNumber: normalizeCaseNumber(caseNumber),
      parcelId: normalizeParcelId(parcelId),
      ownerName,
      coOwnerName,
      ownerPhone,
      ownerEmail,
      ownerMailingAddress,
      propertyAddress: address,
      city,
      state,
      zipCode,
      surplusAmountCents,
      saleDate: normalizeDate(saleDateStr || ""),
      claimDeadline: normalizeDate(deadlineStr || ""),
      county,
      sourceUrl,
      pageNumber,
      contentHash,
    });
  }

  return records;
}

function parseUnknownFormat(
  text: string,
  county: string,
  sourceUrl: string,
  pageNumber: number
): SurplusRecord[] {
  // Fallback: try all methods and merge results
  const blockRecords = parseBlockFormat(text, county, sourceUrl, pageNumber);
  const tableRecords = parseTableFormat(text, county, sourceUrl, pageNumber);
  const listRecords = parseListFormat(text, county, sourceUrl, pageNumber);

  // Deduplicate by case number
  const seen = new Set<string>();
  const allRecords = [...blockRecords, ...tableRecords, ...listRecords];
  const unique: SurplusRecord[] = [];

  for (const record of allRecords) {
    if (!seen.has(record.caseNumber)) {
      seen.add(record.caseNumber);
      unique.push(record);
    }
  }

  return unique;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export function parseSurplusPdf(
  pages: PdfPage[],
  county: string,
  sourceUrl: string
): SurplusPdfParserResult {
  const startTime = Date.now();

  const allRecords: SurplusRecord[] = [];
  const malformedEntries: MalformedEntry[] = [];
  const duplicateEntries: DuplicateEntry[] = [];
  const highValueRecords: HighValueSurplusRecord[] = [];
  const warnings: string[] = [];

  // Track seen case numbers for duplicate detection
  const seenCases = new Map<string, number>();

  // Combine all text for format detection
  const fullText = pages.map(p => p.text).join("\n\n");
  const detectedFormat = detectPdfFormat(fullText);

  for (const page of pages) {
    let pageRecords: SurplusRecord[] = [];

    try {
      switch (detectedFormat) {
        case "TABLE_FORMAT":
          pageRecords = parseTableFormat(page.text, county, sourceUrl, page.pageNumber);
          break;
        case "BLOCK_FORMAT":
          pageRecords = parseBlockFormat(page.text, county, sourceUrl, page.pageNumber);
          break;
        case "LIST_FORMAT":
          pageRecords = parseListFormat(page.text, county, sourceUrl, page.pageNumber);
          break;
        default:
          pageRecords = parseUnknownFormat(page.text, county, sourceUrl, page.pageNumber);
      }

      // Check for duplicates and track high value
      for (const record of pageRecords) {
        if (seenCases.has(record.caseNumber)) {
          duplicateEntries.push({
            pageNumber: page.pageNumber,
            originalPageNumber: seenCases.get(record.caseNumber)!,
            caseNumber: record.caseNumber,
          });
          continue;
        }

        seenCases.set(record.caseNumber, page.pageNumber);
        allRecords.push(record);

        if (record.surplusAmountCents >= HIGH_VALUE_THRESHOLD_CENTS) {
          highValueRecords.push({
            pageNumber: page.pageNumber,
            caseNumber: record.caseNumber,
            surplusAmountCents: record.surplusAmountCents,
            ownerName: record.ownerName,
          });
        }
      }

    } catch (error) {
      malformedEntries.push({
        pageNumber: page.pageNumber,
        rawContent: page.text.substring(0, 200),
        reason: error instanceof Error ? error.message : "Unknown parsing error",
      });
    }
  }

  // Add warnings
  if (malformedEntries.length > 0) {
    warnings.push(`${malformedEntries.length} pages had parsing errors`);
  }

  if (duplicateEntries.length > 0) {
    warnings.push(`${duplicateEntries.length} duplicate case numbers detected and skipped`);
  }

  if (highValueRecords.length > 0) {
    warnings.push(`${highValueRecords.length} high-value records (>$10,000 surplus) detected`);
  }

  if (detectedFormat === "UNKNOWN") {
    warnings.push("Could not detect specific PDF format, used fallback parsing");
  }

  const parseTimeMs = Date.now() - startTime;

  return {
    records: allRecords,
    diagnostics: {
      totalPages: pages.length,
      parsedRecords: allRecords.length,
      malformedEntries,
      duplicateEntries,
      highValueRecords,
      parseTimeMs,
      detectedFormat,
      warnings,
    },
  };
}

// =============================================================================
// CONVENIENCE FUNCTION FOR SINGLE TEXT INPUT
// =============================================================================

export function parseSurplusPdfText(
  text: string,
  county: string,
  sourceUrl: string
): SurplusPdfParserResult {
  // Split by page breaks or treat as single page
  const pageBreakPattern = /\f|\n{4,}|(?:page\s*\d+)/gi;
  const pageTexts = text.split(pageBreakPattern).filter(t => t.trim());

  const pages: PdfPage[] = pageTexts.map((t, i) => ({
    pageNumber: i + 1,
    text: t,
  }));

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text });
  }

  return parseSurplusPdf(pages, county, sourceUrl);
}

// =============================================================================
// EXPORT FOR USE IN PARSER SERVICE
// =============================================================================

export default {
  parse: parseSurplusPdf,
  parseText: parseSurplusPdfText,
  name: "SurplusPdfParser",
  sourceType: "SURPLUS_FUND",
  fileTypes: ["pdf"],
};
