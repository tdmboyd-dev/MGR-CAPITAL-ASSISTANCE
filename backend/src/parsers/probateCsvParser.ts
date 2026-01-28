/**
 * probateCsvParser.ts
 *
 * Production parser for probate case CSV data from county courts.
 * Extracts decedent information, heir contacts, estate values, and case status.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { createHash } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface ProbateRecord {
  caseNumber: string;
  decedentName: string;
  decedentDateOfDeath: Date | null;
  executorName: string;
  executorAddress: string;
  executorPhone: string;
  executorEmail: string;
  attorneyName: string;
  attorneyFirmName: string;
  estateValueCents: number;
  realPropertyValueCents: number;
  personalPropertyValueCents: number;
  filingDate: Date | null;
  caseStatus: string;
  county: string;
  state: string;
  courtName: string;
  sourceUrl: string;
  rawRowIndex: number;
  contentHash: string;
}

export interface ProbateParserResult {
  records: ProbateRecord[];
  diagnostics: ProbateParserDiagnostics;
}

export interface ProbateParserDiagnostics {
  totalRows: number;
  parsedRows: number;
  malformedRows: MalformedRow[];
  duplicateRows: DuplicateRow[];
  highValueRecords: HighValueProbateRecord[];
  parseTimeMs: number;
  columnMapping: ProbateColumnMapping | null;
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
  caseNumber: string;
}

export interface HighValueProbateRecord {
  rowIndex: number;
  caseNumber: string;
  estateValueCents: number;
  decedentName: string;
}

export interface ProbateColumnMapping {
  caseNumber: number;
  decedentName: number;
  decedentDateOfDeath: number;
  executorName: number;
  executorAddress: number;
  executorPhone: number;
  executorEmail: number;
  attorneyName: number;
  attorneyFirmName: number;
  estateValue: number;
  realPropertyValue: number;
  personalPropertyValue: number;
  filingDate: number;
  caseStatus: number;
  courtName: number;
  state: number;
}

// =============================================================================
// COLUMN PATTERN DETECTION
// =============================================================================

const CASE_NUMBER_PATTERNS = [
  /case\s*(?:#|no\.?|number)?/i,
  /docket/i,
  /file\s*(?:#|no\.?)?/i,
  /probate\s*(?:#|no\.?)?/i,
  /matter\s*(?:#|no\.?)?/i,
];

const DECEDENT_NAME_PATTERNS = [
  /decedent/i,
  /deceased/i,
  /name\s*of\s*decedent/i,
  /in\s*(?:the\s*)?(?:matter|estate)\s*of/i,
  /estate\s*of/i,
];

const DECEDENT_DOD_PATTERNS = [
  /d(?:ate)?[\s_-]?o(?:f)?[\s_-]?d(?:eath)?/i,
  /death\s*date/i,
  /date\s*(?:of\s*)?death/i,
  /died/i,
];

const EXECUTOR_NAME_PATTERNS = [
  /executor/i,
  /administrator/i,
  /personal\s*rep(?:resentative)?/i,
  /pr\s*name/i,
  /fiduciary/i,
];

const EXECUTOR_ADDRESS_PATTERNS = [
  /executor[\s_-]?addr(?:ess)?/i,
  /admin(?:istrator)?[\s_-]?addr(?:ess)?/i,
  /pr[\s_-]?addr(?:ess)?/i,
  /fiduciary[\s_-]?addr(?:ess)?/i,
];

const EXECUTOR_PHONE_PATTERNS = [
  /executor[\s_-]?phone/i,
  /admin(?:istrator)?[\s_-]?phone/i,
  /pr[\s_-]?phone/i,
  /contact[\s_-]?phone/i,
  /phone/i,
];

const EXECUTOR_EMAIL_PATTERNS = [
  /executor[\s_-]?email/i,
  /admin(?:istrator)?[\s_-]?email/i,
  /pr[\s_-]?email/i,
  /contact[\s_-]?email/i,
  /email/i,
];

const ATTORNEY_NAME_PATTERNS = [
  /attorney/i,
  /lawyer/i,
  /counsel/i,
  /atty/i,
];

const ATTORNEY_FIRM_PATTERNS = [
  /firm/i,
  /law\s*(?:firm|office)/i,
  /attorney[\s_-]?firm/i,
];

const ESTATE_VALUE_PATTERNS = [
  /estate[\s_-]?value/i,
  /total[\s_-]?(?:estate[\s_-]?)?value/i,
  /gross[\s_-]?(?:estate|value)/i,
  /value[\s_-]?of[\s_-]?estate/i,
];

const REAL_PROPERTY_PATTERNS = [
  /real[\s_-]?property/i,
  /real[\s_-]?estate/i,
  /property[\s_-]?value/i,
  /land[\s_-]?value/i,
];

const PERSONAL_PROPERTY_PATTERNS = [
  /personal[\s_-]?property/i,
  /personal[\s_-]?assets/i,
  /tangible[\s_-]?property/i,
  /other[\s_-]?assets/i,
];

const FILING_DATE_PATTERNS = [
  /fil(?:e|ing)[\s_-]?date/i,
  /date[\s_-]?fil(?:e)?d/i,
  /open(?:ed)?[\s_-]?date/i,
  /petition[\s_-]?date/i,
];

const CASE_STATUS_PATTERNS = [
  /status/i,
  /case[\s_-]?status/i,
  /disposition/i,
  /state/i,
];

const COURT_NAME_PATTERNS = [
  /court/i,
  /court[\s_-]?name/i,
  /venue/i,
  /jurisdiction/i,
];

const STATE_PATTERNS = [
  /state/i,
  /st/i,
  /jurisdiction/i,
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

function detectColumnMapping(headers: string[]): ProbateColumnMapping | null {
  const mapping: ProbateColumnMapping = {
    caseNumber: detectColumnIndex(headers, CASE_NUMBER_PATTERNS),
    decedentName: detectColumnIndex(headers, DECEDENT_NAME_PATTERNS),
    decedentDateOfDeath: detectColumnIndex(headers, DECEDENT_DOD_PATTERNS),
    executorName: detectColumnIndex(headers, EXECUTOR_NAME_PATTERNS),
    executorAddress: detectColumnIndex(headers, EXECUTOR_ADDRESS_PATTERNS),
    executorPhone: detectColumnIndex(headers, EXECUTOR_PHONE_PATTERNS),
    executorEmail: detectColumnIndex(headers, EXECUTOR_EMAIL_PATTERNS),
    attorneyName: detectColumnIndex(headers, ATTORNEY_NAME_PATTERNS),
    attorneyFirmName: detectColumnIndex(headers, ATTORNEY_FIRM_PATTERNS),
    estateValue: detectColumnIndex(headers, ESTATE_VALUE_PATTERNS),
    realPropertyValue: detectColumnIndex(headers, REAL_PROPERTY_PATTERNS),
    personalPropertyValue: detectColumnIndex(headers, PERSONAL_PROPERTY_PATTERNS),
    filingDate: detectColumnIndex(headers, FILING_DATE_PATTERNS),
    caseStatus: detectColumnIndex(headers, CASE_STATUS_PATTERNS),
    courtName: detectColumnIndex(headers, COURT_NAME_PATTERNS),
    state: detectColumnIndex(headers, STATE_PATTERNS),
  };

  // Require at minimum: caseNumber and decedentName
  if (mapping.caseNumber === -1 || mapping.decedentName === -1) {
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

  // Handle "K" for thousands, "M" for millions
  let multiplier = 1;
  if (/k$/i.test(cleaned)) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (/m$/i.test(cleaned)) {
    multiplier = 1000000;
    cleaned = cleaned.slice(0, -1);
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  // Convert to cents
  return Math.round(parsed * multiplier * 100);
}

function normalizeDate(value: string): Date | null {
  if (!value || value.trim() === "") return null;

  const cleaned = value.trim();

  // Try various date formats
  // MM/DD/YYYY
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // MM-DD-YYYY
  const usHyphenMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (usHyphenMatch) {
    const [, month, day, year] = usHyphenMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // Try ISO format as fallback
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

function normalizeCaseNumber(value: string): string {
  if (!value) return "";
  return value.trim().toUpperCase();
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

function normalizeCaseStatus(value: string): string {
  if (!value) return "UNKNOWN";

  const status = value.trim().toUpperCase();

  // Map common statuses
  const statusMappings: Record<string, string> = {
    "OPEN": "OPEN",
    "OPENED": "OPEN",
    "ACTIVE": "OPEN",
    "PENDING": "PENDING",
    "CLOSED": "CLOSED",
    "COMPLETE": "CLOSED",
    "COMPLETED": "CLOSED",
    "SETTLED": "CLOSED",
    "DISMISSED": "DISMISSED",
    "TRANSFERRED": "TRANSFERRED",
    "INACTIVE": "INACTIVE",
    "REOPENED": "REOPENED",
  };

  return statusMappings[status] || status;
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

const HIGH_VALUE_THRESHOLD_CENTS = 50000000; // $500,000

// =============================================================================
// MAIN PARSER
// =============================================================================

export function parseProbateCsv(
  csvContent: string,
  county: string,
  state: string,
  sourceUrl: string
): ProbateParserResult {
  const startTime = Date.now();

  const records: ProbateRecord[] = [];
  const malformedRows: MalformedRow[] = [];
  const duplicateRows: DuplicateRow[] = [];
  const highValueRecords: HighValueProbateRecord[] = [];
  const warnings: string[] = [];

  // Track seen case numbers for duplicate detection
  const seenCases = new Map<string, number>();

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
          "Could not detect required columns. Required: case number, decedent name.",
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
        columnMapping.caseNumber,
        columnMapping.decedentName
      );

      if (fields.length <= maxRequiredIndex) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: `Insufficient columns: expected at least ${maxRequiredIndex + 1}, got ${fields.length}`,
        });
        continue;
      }

      // Extract required values
      const caseNumber = normalizeCaseNumber(fields[columnMapping.caseNumber] || "");
      const decedentName = normalizeString(fields[columnMapping.decedentName] || "");

      // Validate required fields
      if (!caseNumber) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: "Missing case number",
        });
        continue;
      }

      if (!decedentName) {
        malformedRows.push({
          rowIndex,
          rawContent: line.substring(0, 200),
          reason: "Missing decedent name",
        });
        continue;
      }

      // Check for duplicates
      if (seenCases.has(caseNumber)) {
        duplicateRows.push({
          rowIndex,
          originalRowIndex: seenCases.get(caseNumber)!,
          caseNumber,
        });
        continue;
      }

      seenCases.set(caseNumber, rowIndex);

      // Extract optional fields
      const decedentDateOfDeath = columnMapping.decedentDateOfDeath >= 0
        ? normalizeDate(fields[columnMapping.decedentDateOfDeath] || "")
        : null;

      const executorName = columnMapping.executorName >= 0
        ? normalizeString(fields[columnMapping.executorName] || "")
        : "";

      const executorAddress = columnMapping.executorAddress >= 0
        ? normalizeString(fields[columnMapping.executorAddress] || "")
        : "";

      const executorPhone = columnMapping.executorPhone >= 0
        ? normalizePhone(fields[columnMapping.executorPhone] || "")
        : "";

      const executorEmail = columnMapping.executorEmail >= 0
        ? normalizeEmail(fields[columnMapping.executorEmail] || "")
        : "";

      const attorneyName = columnMapping.attorneyName >= 0
        ? normalizeString(fields[columnMapping.attorneyName] || "")
        : "";

      const attorneyFirmName = columnMapping.attorneyFirmName >= 0
        ? normalizeString(fields[columnMapping.attorneyFirmName] || "")
        : "";

      const estateValueCents = columnMapping.estateValue >= 0
        ? normalizeMonetaryValue(fields[columnMapping.estateValue] || "")
        : 0;

      const realPropertyValueCents = columnMapping.realPropertyValue >= 0
        ? normalizeMonetaryValue(fields[columnMapping.realPropertyValue] || "")
        : 0;

      const personalPropertyValueCents = columnMapping.personalPropertyValue >= 0
        ? normalizeMonetaryValue(fields[columnMapping.personalPropertyValue] || "")
        : 0;

      const filingDate = columnMapping.filingDate >= 0
        ? normalizeDate(fields[columnMapping.filingDate] || "")
        : null;

      const caseStatus = columnMapping.caseStatus >= 0
        ? normalizeCaseStatus(fields[columnMapping.caseStatus] || "")
        : "UNKNOWN";

      const courtName = columnMapping.courtName >= 0
        ? normalizeString(fields[columnMapping.courtName] || "")
        : "";

      const recordState = columnMapping.state >= 0
        ? normalizeString(fields[columnMapping.state] || "").toUpperCase()
        : state;

      // Compute content hash
      const contentHash = computeContentHash(
        `${caseNumber}|${decedentName}|${estateValueCents}`
      );

      // Calculate total estate value if not provided
      const totalEstateValue = estateValueCents > 0
        ? estateValueCents
        : realPropertyValueCents + personalPropertyValueCents;

      const record: ProbateRecord = {
        caseNumber,
        decedentName,
        decedentDateOfDeath,
        executorName,
        executorAddress,
        executorPhone,
        executorEmail,
        attorneyName,
        attorneyFirmName,
        estateValueCents: totalEstateValue,
        realPropertyValueCents,
        personalPropertyValueCents,
        filingDate,
        caseStatus,
        county,
        state: recordState,
        courtName,
        sourceUrl,
        rawRowIndex: rowIndex,
        contentHash,
      };

      records.push(record);

      // Track high value records
      if (totalEstateValue >= HIGH_VALUE_THRESHOLD_CENTS) {
        highValueRecords.push({
          rowIndex,
          caseNumber,
          estateValueCents: totalEstateValue,
          decedentName,
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
    warnings.push(`${duplicateRows.length} duplicate case numbers detected and skipped`);
  }

  if (highValueRecords.length > 0) {
    warnings.push(`${highValueRecords.length} high-value records (>$500,000 estate) detected`);
  }

  // Check for missing key columns and add warnings
  if (columnMapping.executorName === -1) {
    warnings.push("Executor name column not detected");
  }

  if (columnMapping.estateValue === -1 && columnMapping.realPropertyValue === -1) {
    warnings.push("No estate value columns detected");
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
// HEIR EXTRACTION HELPERS (for multi-file correlation)
// Integrates with SkipTraceService for real heir discovery
// =============================================================================

export interface HeirInfo {
  name: string;
  relationship: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  confidence: number;
  source: 'executor' | 'skip_trace' | 'probate_record' | 'surname_analysis';
}

export interface HeirExtractionResult {
  decedentName: string;
  heirs: HeirInfo[];
  extractedAt: Date;
  source: string;
  confidence: number;
}

/**
 * Parse name into first/last components
 */
function parseFullName(fullName: string): { firstName: string; lastName: string; middleName?: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  // 3+ parts: first, middle(s), last
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Extract potential heirs from probate record data
 * This uses multiple strategies:
 * 1. Executor info from probate record (most reliable)
 * 2. Surname analysis for potential relatives
 * 3. Integration point for SkipTraceService (called separately)
 */
export function extractPotentialHeirs(
  decedentName: string,
  executorName?: string,
  executorAddress?: string,
  executorPhone?: string,
  executorEmail?: string
): HeirInfo[] {
  const heirs: HeirInfo[] = [];

  // Strategy 1: Use executor information (highest confidence)
  // Executors are often family members (spouse, children, siblings)
  if (executorName && executorName.trim()) {
    const executor = parseFullName(executorName);
    const decedent = parseFullName(decedentName);

    // Determine likely relationship based on surname match
    let relationship = 'EXECUTOR';
    if (executor.lastName.toLowerCase() === decedent.lastName.toLowerCase()) {
      relationship = 'FAMILY_MEMBER'; // Same surname suggests family
    }

    // Parse address components if available
    let city = '', state = '', zip = '';
    if (executorAddress) {
      // Try to extract city, state, zip from address
      const addressMatch = executorAddress.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
      if (addressMatch) {
        city = addressMatch[1].trim();
        state = addressMatch[2].toUpperCase();
        zip = addressMatch[3] || '';
      }
    }

    heirs.push({
      name: executorName.trim(),
      relationship,
      address: executorAddress || '',
      city,
      state,
      zip,
      phone: executorPhone || '',
      email: executorEmail || '',
      confidence: 0.9, // High confidence - from probate record
      source: 'executor',
    });
  }

  // Strategy 2: Surname analysis for potential relative lookup
  const decedentParsed = parseFullName(decedentName);
  if (decedentParsed.lastName) {
    // Add placeholder for surname-based lookup
    // This would be populated by SkipTraceService.findHeirs()
    heirs.push({
      name: `${decedentParsed.lastName} Family`,
      relationship: 'POTENTIAL_HEIR',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
      confidence: 0.3, // Low confidence - needs skip trace verification
      source: 'surname_analysis',
    });
  }

  return heirs;
}

/**
 * Extract heirs from probate record (full record version)
 */
export function extractHeirsFromRecord(record: ProbateRecord): HeirExtractionResult {
  const heirs = extractPotentialHeirs(
    record.decedentName,
    record.executorName,
    record.executorAddress,
    record.executorPhone,
    record.executorEmail
  );

  // Calculate overall confidence
  const avgConfidence = heirs.length > 0
    ? heirs.reduce((sum, h) => sum + h.confidence, 0) / heirs.length
    : 0;

  return {
    decedentName: record.decedentName,
    heirs,
    extractedAt: new Date(),
    source: `probate_record:${record.caseNumber}`,
    confidence: avgConfidence,
  };
}

/**
 * Batch extract heirs from multiple probate records
 */
export function batchExtractHeirs(records: ProbateRecord[]): HeirExtractionResult[] {
  return records.map(extractHeirsFromRecord);
}

/**
 * Prepare heir info for SkipTraceService lookup
 * Returns data in format suitable for SkipTraceService.findHeirs()
 */
export function prepareForSkipTrace(record: ProbateRecord): {
  decedentInput: { firstName: string; lastName: string; address?: string; city?: string; state?: string; zip?: string };
  executorInput?: { firstName: string; lastName: string; address?: string; city?: string; state?: string; zip?: string };
} {
  const decedent = parseFullName(record.decedentName);
  const result: any = {
    decedentInput: {
      firstName: decedent.firstName,
      lastName: decedent.lastName,
      state: record.state,
    },
  };

  if (record.executorName) {
    const executor = parseFullName(record.executorName);

    // Parse executor address
    let city = '', state = '', zip = '', street = '';
    if (record.executorAddress) {
      // Try various address formats
      const fullMatch = record.executorAddress.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
      if (fullMatch) {
        street = fullMatch[1].trim();
        city = fullMatch[2].trim();
        state = fullMatch[3].toUpperCase();
        zip = fullMatch[4] || '';
      } else {
        // Simple city, state zip format
        const simpleMatch = record.executorAddress.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
        if (simpleMatch) {
          city = simpleMatch[1].trim();
          state = simpleMatch[2].toUpperCase();
          zip = simpleMatch[3] || '';
        }
      }
    }

    result.executorInput = {
      firstName: executor.firstName,
      lastName: executor.lastName,
      address: street,
      city,
      state: state || record.state,
      zip,
    };
  }

  return result;
}

// =============================================================================
// EXPORT FOR USE IN PARSER SERVICE
// =============================================================================

export default {
  parse: parseProbateCsv,
  extractPotentialHeirs,
  extractHeirsFromRecord,
  batchExtractHeirs,
  prepareForSkipTrace,
  name: "ProbateCsvParser",
  sourceType: "PROBATE",
  fileTypes: ["csv", "txt"],
};
