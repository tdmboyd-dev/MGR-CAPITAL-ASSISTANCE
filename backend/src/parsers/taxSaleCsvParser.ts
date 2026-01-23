/**
 * taxSaleCsvParser.ts
 *
 * Production parser for tax sale CSV data from county tax collector offices.
 * Extracts owner, address, parcel ID, and surplus amounts from tax sale records.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { createHash } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface TaxSaleRecord {
  parcelId: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerMailingAddress: string;
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  saleDate: Date | null;
  salePriceCents: number;
  delinquentAmountCents: number;
  surplusAmountCents: number;
  county: string;
  sourceUrl: string;
  rawRowIndex: number;
  contentHash: string;
}

export interface TaxSaleParserResult {
  records: TaxSaleRecord[];
  diagnostics: TaxSaleParserDiagnostics;
}

export interface TaxSaleParserDiagnostics {
  totalRows: number;
  parsedRows: number;
  malformedRows: MalformedRow[];
  duplicateRows: DuplicateRow[];
  highValueRecords: HighValueRecord[];
  parseTimeMs: number;
  columnMapping: ColumnMapping | null;
  warnings: string[];
}

export interface MalformedRow {
  rowIndex: number;
  rawContent: string;
  reason: string;
}

export interface DuplicateRow {
  rowIndex: number;
  originalRowIndex: number;
  parcelId: string;
}

export interface HighValueRecord {
  rowIndex: number;
  parcelId: string;
  surplusAmountCents: number;
  ownerName: string;
}

export interface ColumnMapping {
  parcelId: number;
  ownerName: number;
  ownerPhone: number;
  ownerEmail: number;
  ownerMailingAddress: number;
  propertyAddress: number;
  city: number;
  state: number;
  zipCode: number;
  saleDate: number;
  salePrice: number;
  delinquentAmount: number;
  surplusAmount: number;
}

// =============================================================================
// COLUMN PATTERN DETECTION
// =============================================================================

const PARCEL_PATTERNS = [
  /parcel/i, /parcel[\s_-]?id/i, /parcel[\s_-]?number/i, /parcel[\s_-]?#/i,
  /apn/i, /account/i, /tax[\s_-]?id/i, /folio/i, /pin/i
];

const OWNER_PATTERNS = [
  /owner/i, /owner[\s_-]?name/i, /property[\s_-]?owner/i, /taxpayer/i,
  /name/i, /grantor/i, /seller/i
];

const OWNER_PHONE_PATTERNS = [
  /owner[\s_-]?phone/i, /phone/i, /telephone/i, /tel/i, /contact[\s_-]?phone/i,
  /phone[\s_-]?number/i, /cell/i, /mobile/i
];

const OWNER_EMAIL_PATTERNS = [
  /owner[\s_-]?email/i, /email/i, /e[\s_-]?mail/i, /contact[\s_-]?email/i,
  /email[\s_-]?address/i
];

const OWNER_MAILING_PATTERNS = [
  /mailing[\s_-]?addr(?:ess)?/i, /mail[\s_-]?addr(?:ess)?/i, /owner[\s_-]?addr(?:ess)?/i,
  /contact[\s_-]?addr(?:ess)?/i, /correspondence/i
];

const ADDRESS_PATTERNS = [
  /address/i, /property[\s_-]?address/i, /street/i, /location/i,
  /situs/i, /site[\s_-]?address/i
];

const CITY_PATTERNS = [
  /city/i, /town/i, /municipality/i
];

const STATE_PATTERNS = [
  /state/i, /st/i
];

const ZIP_PATTERNS = [
  /zip/i, /zip[\s_-]?code/i, /postal/i, /postal[\s_-]?code/i
];

const SALE_DATE_PATTERNS = [
  /sale[\s_-]?date/i, /date[\s_-]?of[\s_-]?sale/i, /auction[\s_-]?date/i,
  /sold[\s_-]?date/i, /date/i
];

const SALE_PRICE_PATTERNS = [
  /sale[\s_-]?price/i, /bid[\s_-]?amount/i, /winning[\s_-]?bid/i,
  /purchase[\s_-]?price/i, /amount[\s_-]?paid/i, /price/i
];

const DELINQUENT_PATTERNS = [
  /delinquent/i, /taxes[\s_-]?owed/i, /tax[\s_-]?amount/i, /due/i,
  /amount[\s_-]?due/i, /tax[\s_-]?lien/i, /lien[\s_-]?amount/i
];

const SURPLUS_PATTERNS = [
  /surplus/i, /excess/i, /overage/i, /refund/i, /excess[\s_-]?proceeds/i,
  /surplus[\s_-]?amount/i, /overbid/i
];

function detectColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    for (const pattern of patterns) {
      if (pattern.test(header)) {
        return i;
      }
    }
  }
  return -1;
}

function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const mapping: ColumnMapping = {
    parcelId: detectColumnIndex(headers, PARCEL_PATTERNS),
    ownerName: detectColumnIndex(headers, OWNER_PATTERNS),
    ownerPhone: detectColumnIndex(headers, OWNER_PHONE_PATTERNS),
    ownerEmail: detectColumnIndex(headers, OWNER_EMAIL_PATTERNS),
    ownerMailingAddress: detectColumnIndex(headers, OWNER_MAILING_PATTERNS),
    propertyAddress: detectColumnIndex(headers, ADDRESS_PATTERNS),
    city: detectColumnIndex(headers, CITY_PATTERNS),
    state: detectColumnIndex(headers, STATE_PATTERNS),
    zipCode: detectColumnIndex(headers, ZIP_PATTERNS),
    saleDate: detectColumnIndex(headers, SALE_DATE_PATTERNS),
    salePrice: detectColumnIndex(headers, SALE_PRICE_PATTERNS),
    delinquentAmount: detectColumnIndex(headers, DELINQUENT_PATTERNS),
    surplusAmount: detectColumnIndex(headers, SURPLUS_PATTERNS),
  };

  // Require at minimum: parcelId, ownerName, and surplusAmount
  if (mapping.parcelId === -1 || mapping.ownerName === -1 || mapping.surplusAmount === -1) {
    return null;
  }

  return mapping;
}

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

  // Handle negative sign
  const isNegative = cleaned.startsWith("-");
  if (isNegative) {
    cleaned = cleaned.slice(1);
  }

  // Parse the number
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  // Convert to cents
  const cents = Math.round(parsed * 100);
  return isNegative ? -cents : cents;
}

function normalizeDate(value: string): Date | null {
  if (!value || value.trim() === "") return null;

  const cleaned = value.trim();

  // Try various date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // MM-DD-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // DD/MM/YYYY (European)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ];

  // Try ISO format first
  const isoDate = new Date(cleaned);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try MM/DD/YYYY
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

function normalizeString(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeParcelId(value: string): string {
  if (!value) return "";
  // Remove spaces and normalize dashes
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizePhone(value: string): string {
  if (!value) return "";

  // Extract digits
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if can't normalize
  return value.trim();
}

function normalizeEmail(value: string): string {
  if (!value) return "";

  const email = value.trim().toLowerCase();

  // Basic email validation
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email;
  }

  return "";
}

// =============================================================================
// CSV PARSING
// =============================================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ",") {
        // Field separator
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Push the last field
  result.push(current);

  return result;
}

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// =============================================================================
// HIGH VALUE THRESHOLD
// =============================================================================

const HIGH_VALUE_THRESHOLD_CENTS = 1000000; // $10,000

// =============================================================================
// MAIN PARSER
// =============================================================================

export function parseTaxSaleCsv(
  csvContent: string,
  county: string,
  sourceUrl: string
): TaxSaleParserResult {
  const startTime = Date.now();

  const records: TaxSaleRecord[] = [];
  const malformedRows: MalformedRow[] = [];
  const duplicateRows: DuplicateRow[] = [];
  const highValueRecords: HighValueRecord[] = [];
  const warnings: string[] = [];

  // Track seen parcel IDs for duplicate detection
  const seenParcels = new Map<string, number>();

  // Split into lines and filter empty lines
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== "");

  if (lines.length === 0) {
    return {
      records: [],
      diagnostics: {
        totalRows: 0,
        parsedRows: 0,
        malformedRows: [],
        duplicateRows: [],
        highValueRecords: [],
        parseTimeMs: Date.now() - startTime,
        columnMapping: null,
        warnings: ["Empty CSV content"],
      },
    };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const columnMapping = detectColumnMapping(headers);

  if (!columnMapping) {
    return {
      records: [],
      diagnostics: {
        totalRows: lines.length - 1,
        parsedRows: 0,
        malformedRows: [],
        duplicateRows: [],
        highValueRecords: [],
        parseTimeMs: Date.now() - startTime,
        columnMapping: null,
        warnings: [
          "Could not detect required columns. Required: parcel ID, owner name, surplus amount.",
          `Found headers: ${headers.join(", ")}`,
        ],
      },
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowIndex = i;

    try {
      const fields = parseCSVLine(line);

      // Validate minimum fields
      const maxRequiredIndex = Math.max(
        columnMapping.parcelId,
        columnMapping.ownerName,
        columnMapping.surplusAmount
      );

      if (fields.length <= maxRequiredIndex) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: `Insufficient columns: expected at least ${maxRequiredIndex + 1}, got ${fields.length}`,
        });
        continue;
      }

      // Extract values
      const parcelId = normalizeParcelId(fields[columnMapping.parcelId] || "");
      const ownerName = normalizeString(fields[columnMapping.ownerName] || "");
      const surplusAmountCents = normalizeMonetaryValue(fields[columnMapping.surplusAmount] || "");

      // Validate required fields
      if (!parcelId) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: "Missing parcel ID",
        });
        continue;
      }

      if (!ownerName) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: "Missing owner name",
        });
        continue;
      }

      // Check for duplicates
      if (seenParcels.has(parcelId)) {
        duplicateRows.push({
          rowIndex,
          originalRowIndex: seenParcels.get(parcelId)!,
          parcelId,
        });
        continue;
      }

      seenParcels.set(parcelId, rowIndex);

      // Extract optional fields - contact info (FOUNDER needs this)
      const ownerPhone = columnMapping.ownerPhone >= 0
        ? normalizePhone(fields[columnMapping.ownerPhone] || "")
        : "";
      const ownerEmail = columnMapping.ownerEmail >= 0
        ? normalizeEmail(fields[columnMapping.ownerEmail] || "")
        : "";
      const ownerMailingAddress = columnMapping.ownerMailingAddress >= 0
        ? normalizeString(fields[columnMapping.ownerMailingAddress] || "")
        : "";

      // Extract optional fields - property info
      const propertyAddress = columnMapping.propertyAddress >= 0
        ? normalizeString(fields[columnMapping.propertyAddress] || "")
        : "";
      const city = columnMapping.city >= 0
        ? normalizeString(fields[columnMapping.city] || "")
        : "";
      const state = columnMapping.state >= 0
        ? normalizeString(fields[columnMapping.state] || "").toUpperCase()
        : "";
      const zipCode = columnMapping.zipCode >= 0
        ? normalizeString(fields[columnMapping.zipCode] || "")
        : "";
      const saleDate = columnMapping.saleDate >= 0
        ? normalizeDate(fields[columnMapping.saleDate] || "")
        : null;
      const salePriceCents = columnMapping.salePrice >= 0
        ? normalizeMonetaryValue(fields[columnMapping.salePrice] || "")
        : 0;
      const delinquentAmountCents = columnMapping.delinquentAmount >= 0
        ? normalizeMonetaryValue(fields[columnMapping.delinquentAmount] || "")
        : 0;

      // Compute content hash
      const contentHash = computeContentHash(
        `${parcelId}|${ownerName}|${propertyAddress}|${surplusAmountCents}`
      );

      const record: TaxSaleRecord = {
        parcelId,
        ownerName,
        ownerPhone,
        ownerEmail,
        ownerMailingAddress,
        propertyAddress,
        city,
        state,
        zipCode,
        saleDate,
        salePriceCents,
        delinquentAmountCents,
        surplusAmountCents,
        county,
        sourceUrl,
        rawRowIndex: rowIndex,
        contentHash,
      };

      records.push(record);

      // Track high value records
      if (surplusAmountCents >= HIGH_VALUE_THRESHOLD_CENTS) {
        highValueRecords.push({
          rowIndex,
          parcelId,
          surplusAmountCents,
          ownerName,
        });
      }

    } catch (error) {
      malformedRows.push({
        rowIndex,
        rawContent: line.substring(0, 200),
        reason: error instanceof Error ? error.message : "Unknown parsing error",
      });
    }
  }

  // Add warnings for data quality issues
  if (malformedRows.length > 0) {
    warnings.push(`${malformedRows.length} rows could not be parsed`);
  }

  if (duplicateRows.length > 0) {
    warnings.push(`${duplicateRows.length} duplicate parcel IDs detected and skipped`);
  }

  if (highValueRecords.length > 0) {
    warnings.push(`${highValueRecords.length} high-value records (>$10,000 surplus) detected`);
  }

  const parseTimeMs = Date.now() - startTime;

  return {
    records,
    diagnostics: {
      totalRows: lines.length - 1,
      parsedRows: records.length,
      malformedRows,
      duplicateRows,
      highValueRecords,
      parseTimeMs,
      columnMapping,
      warnings,
    },
  };
}

// =============================================================================
// EXPORT FOR USE IN PARSER SERVICE
// =============================================================================

export default {
  parse: parseTaxSaleCsv,
  name: "TaxSaleCsvParser",
  sourceType: "TAX_SALE",
  fileTypes: ["csv", "txt"],
};
