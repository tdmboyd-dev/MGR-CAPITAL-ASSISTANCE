/**
 * parserService.ts
 *
 * Production parser orchestration service for MGR Capital OPS Layer.
 * Routes content to appropriate parsers based on source type and file format.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 * All money in cents, all timestamps in UTC.
 */

import { createHash } from "crypto";
import prisma from "../lib/prisma.js";
import taxSaleCsvParser, {
  TaxSaleRecord,
  TaxSaleParserResult,
  parseTaxSaleCsv,
} from "../parsers/taxSaleCsvParser.js";
import surplusPdfParser, {
  SurplusRecord,
  SurplusPdfParserResult,
  parseSurplusPdf,
  parseSurplusPdfText,
  PdfPage,
} from "../parsers/surplusPdfParser.js";
import probateCsvParser, {
  ProbateRecord,
  ProbateParserResult,
  parseProbateCsv,
} from "../parsers/probateCsvParser.js";

// =============================================================================
// TYPES
// =============================================================================

export type SourceType = "TAX_SALE" | "SURPLUS_FUND" | "PROBATE" | "FORECLOSURE" | "UNKNOWN";

export type FileType = "csv" | "pdf" | "txt" | "html" | "json" | "unknown";

export interface ParsedRecord {
  sourceType: SourceType;
  rawData: Record<string, unknown>;
  normalizedData: NormalizedRecord;
  contentHash: string;
  parserUsed: string;
  parseTimeMs: number;
}

export interface NormalizedRecord {
  // Identifiers
  caseNumber: string;
  parcelId: string;

  // Owner contact info (FOUNDER needs this)
  ownerName: string;
  coOwnerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerMailingAddress: string;

  // Property info
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  // Financial
  amountCents: number;
  amountType: "SURPLUS" | "ESTATE_VALUE" | "DELINQUENT" | "UNKNOWN";

  // Dates
  saleDate: Date | null;
  filingDate: Date | null;
  deadlineDate: Date | null;

  // Meta
  sourceUrl: string;
  sourceRow: number;
  sourceType: SourceType;
}

export interface ParserServiceResult {
  success: boolean;
  records: ParsedRecord[];
  totalRecords: number;
  diagnostics: ParserServiceDiagnostics;
}

export interface ParserServiceDiagnostics {
  parserUsed: string;
  sourceType: SourceType;
  fileType: FileType;
  totalRows: number;
  parsedRows: number;
  malformedRows: number;
  duplicateRows: number;
  highValueRecords: number;
  parseTimeMs: number;
  warnings: string[];
  errors: string[];
}

// =============================================================================
// FILE TYPE DETECTION
// =============================================================================

function detectFileType(content: string, filename?: string): FileType {
  // Check by filename extension first
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop() || "";
    if (["csv", "txt", "pdf", "html", "json"].includes(ext)) {
      return ext as FileType;
    }
  }

  // Detect by content
  const trimmed = content.trim();

  // Check for PDF magic bytes (base64 encoded) or PDF header
  if (trimmed.startsWith("%PDF") || trimmed.startsWith("JVBERi")) {
    return "pdf";
  }

  // Check for JSON
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // Check for HTML
  if (trimmed.toLowerCase().includes("<!doctype html") ||
      trimmed.toLowerCase().includes("<html")) {
    return "html";
  }

  // Check for CSV (contains commas and newlines in a pattern)
  const lines = trimmed.split("\n").filter(l => l.trim());
  if (lines.length > 1) {
    const commaCount = (lines[0].match(/,/g) || []).length;
    if (commaCount >= 2) {
      // Check if subsequent lines have similar comma patterns
      const consistentCommas = lines.slice(1, 5).every(line => {
        const count = (line.match(/,/g) || []).length;
        return Math.abs(count - commaCount) <= 2;
      });
      if (consistentCommas) {
        return "csv";
      }
    }
  }

  // Check for tab-separated (TSV treated as txt)
  if (trimmed.includes("\t")) {
    return "txt";
  }

  return "unknown";
}

// =============================================================================
// SOURCE TYPE DETECTION
// =============================================================================

function detectSourceType(content: string, metadata?: Record<string, string>): SourceType {
  // Check metadata hints first
  if (metadata?.sourceType) {
    const type = metadata.sourceType.toUpperCase();
    if (["TAX_SALE", "SURPLUS_FUND", "PROBATE", "FORECLOSURE"].includes(type)) {
      return type as SourceType;
    }
  }

  if (metadata?.url) {
    const url = metadata.url.toLowerCase();
    if (url.includes("tax") && (url.includes("sale") || url.includes("lien"))) {
      return "TAX_SALE";
    }
    if (url.includes("surplus") || url.includes("excess") || url.includes("overage")) {
      return "SURPLUS_FUND";
    }
    if (url.includes("probate") || url.includes("estate") || url.includes("decedent")) {
      return "PROBATE";
    }
    if (url.includes("foreclos")) {
      return "FORECLOSURE";
    }
  }

  const lower = content.toLowerCase();

  // Tax sale indicators
  const taxSaleScore = [
    lower.includes("tax sale"),
    lower.includes("tax lien"),
    lower.includes("delinquent tax"),
    lower.includes("tax deed"),
    lower.includes("overbid"),
    lower.includes("surplus funds") && lower.includes("tax"),
  ].filter(Boolean).length;

  // Surplus fund indicators
  const surplusScore = [
    lower.includes("surplus fund"),
    lower.includes("excess proceed"),
    lower.includes("overage"),
    lower.includes("claim deadline"),
    lower.includes("unclaimed"),
    lower.includes("former owner"),
  ].filter(Boolean).length;

  // Probate indicators
  const probateScore = [
    lower.includes("probate"),
    lower.includes("decedent"),
    lower.includes("estate of"),
    lower.includes("executor"),
    lower.includes("administrator"),
    lower.includes("intestate"),
    lower.includes("last will"),
  ].filter(Boolean).length;

  // Foreclosure indicators
  const foreclosureScore = [
    lower.includes("foreclosure"),
    lower.includes("mortgage"),
    lower.includes("default"),
    lower.includes("notice of sale"),
    lower.includes("trustee sale"),
  ].filter(Boolean).length;

  const scores = [
    { type: "TAX_SALE" as SourceType, score: taxSaleScore },
    { type: "SURPLUS_FUND" as SourceType, score: surplusScore },
    { type: "PROBATE" as SourceType, score: probateScore },
    { type: "FORECLOSURE" as SourceType, score: foreclosureScore },
  ];

  const best = scores.sort((a, b) => b.score - a.score)[0];

  return best.score >= 2 ? best.type : "UNKNOWN";
}

// =============================================================================
// RECORD NORMALIZATION
// =============================================================================

function normalizeTaxSaleRecord(record: TaxSaleRecord): NormalizedRecord {
  return {
    caseNumber: "",
    parcelId: record.parcelId,
    ownerName: record.ownerName,
    coOwnerName: "",
    ownerPhone: record.ownerPhone,
    ownerEmail: record.ownerEmail,
    ownerMailingAddress: record.ownerMailingAddress,
    propertyAddress: record.propertyAddress,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    county: record.county,
    amountCents: record.surplusAmountCents,
    amountType: "SURPLUS",
    saleDate: record.saleDate,
    filingDate: null,
    deadlineDate: null,
    sourceUrl: record.sourceUrl,
    sourceRow: record.rawRowIndex,
    sourceType: "TAX_SALE",
  };
}

function normalizeSurplusRecord(record: SurplusRecord): NormalizedRecord {
  return {
    caseNumber: record.caseNumber,
    parcelId: record.parcelId,
    ownerName: record.ownerName,
    coOwnerName: record.coOwnerName,
    ownerPhone: record.ownerPhone,
    ownerEmail: record.ownerEmail,
    ownerMailingAddress: record.ownerMailingAddress,
    propertyAddress: record.propertyAddress,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    county: record.county,
    amountCents: record.surplusAmountCents,
    amountType: "SURPLUS",
    saleDate: record.saleDate,
    filingDate: null,
    deadlineDate: record.claimDeadline,
    sourceUrl: record.sourceUrl,
    sourceRow: record.pageNumber,
    sourceType: "SURPLUS_FUND",
  };
}

function normalizeProbateRecord(record: ProbateRecord): NormalizedRecord {
  return {
    caseNumber: record.caseNumber,
    parcelId: "",
    ownerName: record.decedentName,
    coOwnerName: "",
    ownerPhone: record.executorPhone,
    ownerEmail: record.executorEmail,
    ownerMailingAddress: record.executorAddress,
    propertyAddress: "",
    city: "",
    state: record.state,
    zipCode: "",
    county: record.county,
    amountCents: record.estateValueCents,
    amountType: "ESTATE_VALUE",
    saleDate: null,
    filingDate: record.filingDate,
    deadlineDate: null,
    sourceUrl: record.sourceUrl,
    sourceRow: record.rawRowIndex,
    sourceType: "PROBATE",
  };
}

// =============================================================================
// CONTENT HASH
// =============================================================================

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// =============================================================================
// MAIN PARSER SERVICE
// =============================================================================

export async function parseContent(
  content: string,
  options: {
    filename?: string;
    sourceType?: SourceType;
    county?: string;
    state?: string;
    sourceUrl?: string;
    pdfPages?: PdfPage[];
  } = {}
): Promise<ParserServiceResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Detect file type and source type
  const fileType = detectFileType(content, options.filename);
  const sourceType = options.sourceType || detectSourceType(content, {
    url: options.sourceUrl || "",
  });

  const county = options.county || "UNKNOWN";
  const state = options.state || "UNKNOWN";
  const sourceUrl = options.sourceUrl || "";

  let records: ParsedRecord[] = [];
  let parserUsed = "NONE";
  let totalRows = 0;
  let parsedRows = 0;
  let malformedRows = 0;
  let duplicateRows = 0;
  let highValueRecords = 0;

  try {
    // Route to appropriate parser based on source type and file type
    if (sourceType === "TAX_SALE" && (fileType === "csv" || fileType === "txt")) {
      parserUsed = "TaxSaleCsvParser";
      const result = parseTaxSaleCsv(content, county, sourceUrl);

      totalRows = result.diagnostics.totalRows;
      parsedRows = result.diagnostics.parsedRows;
      malformedRows = result.diagnostics.malformedRows.length;
      duplicateRows = result.diagnostics.duplicateRows.length;
      highValueRecords = result.diagnostics.highValueRecords.length;
      warnings.push(...result.diagnostics.warnings);

      records = result.records.map(record => ({
        sourceType: "TAX_SALE" as SourceType,
        rawData: record as unknown as Record<string, unknown>,
        normalizedData: normalizeTaxSaleRecord(record),
        contentHash: record.contentHash,
        parserUsed,
        parseTimeMs: result.diagnostics.parseTimeMs,
      }));

    } else if (sourceType === "SURPLUS_FUND" && fileType === "pdf") {
      parserUsed = "SurplusPdfParser";

      let result: SurplusPdfParserResult;
      if (options.pdfPages && options.pdfPages.length > 0) {
        result = parseSurplusPdf(options.pdfPages, county, sourceUrl);
      } else {
        result = parseSurplusPdfText(content, county, sourceUrl);
      }

      totalRows = result.diagnostics.totalPages;
      parsedRows = result.diagnostics.parsedRecords;
      malformedRows = result.diagnostics.malformedEntries.length;
      duplicateRows = result.diagnostics.duplicateEntries.length;
      highValueRecords = result.diagnostics.highValueRecords.length;
      warnings.push(...result.diagnostics.warnings);

      records = result.records.map(record => ({
        sourceType: "SURPLUS_FUND" as SourceType,
        rawData: record as unknown as Record<string, unknown>,
        normalizedData: normalizeSurplusRecord(record),
        contentHash: record.contentHash,
        parserUsed,
        parseTimeMs: result.diagnostics.parseTimeMs,
      }));

    } else if (sourceType === "SURPLUS_FUND" && (fileType === "csv" || fileType === "txt")) {
      // Surplus fund can also come as CSV - try PDF text parser
      parserUsed = "SurplusPdfParser (text mode)";
      const result = parseSurplusPdfText(content, county, sourceUrl);

      totalRows = result.diagnostics.totalPages;
      parsedRows = result.diagnostics.parsedRecords;
      malformedRows = result.diagnostics.malformedEntries.length;
      duplicateRows = result.diagnostics.duplicateEntries.length;
      highValueRecords = result.diagnostics.highValueRecords.length;
      warnings.push(...result.diagnostics.warnings);

      records = result.records.map(record => ({
        sourceType: "SURPLUS_FUND" as SourceType,
        rawData: record as unknown as Record<string, unknown>,
        normalizedData: normalizeSurplusRecord(record),
        contentHash: record.contentHash,
        parserUsed,
        parseTimeMs: result.diagnostics.parseTimeMs,
      }));

    } else if (sourceType === "PROBATE" && (fileType === "csv" || fileType === "txt")) {
      parserUsed = "ProbateCsvParser";
      const result = parseProbateCsv(content, county, state, sourceUrl);

      totalRows = result.diagnostics.totalRows;
      parsedRows = result.diagnostics.parsedRows;
      malformedRows = result.diagnostics.malformedRows.length;
      duplicateRows = result.diagnostics.duplicateRows.length;
      highValueRecords = result.diagnostics.highValueRecords.length;
      warnings.push(...result.diagnostics.warnings);

      records = result.records.map(record => ({
        sourceType: "PROBATE" as SourceType,
        rawData: record as unknown as Record<string, unknown>,
        normalizedData: normalizeProbateRecord(record),
        contentHash: record.contentHash,
        parserUsed,
        parseTimeMs: result.diagnostics.parseTimeMs,
      }));

    } else if (fileType === "csv" || fileType === "txt") {
      // Unknown source type but CSV/TXT - try each parser and pick best results
      parserUsed = "AutoDetect";

      const taxResult = parseTaxSaleCsv(content, county, sourceUrl);
      const probateResult = parseProbateCsv(content, county, state, sourceUrl);

      // Pick the parser that produced more valid records
      if (taxResult.diagnostics.parsedRows >= probateResult.diagnostics.parsedRows) {
        parserUsed = "TaxSaleCsvParser (auto)";
        totalRows = taxResult.diagnostics.totalRows;
        parsedRows = taxResult.diagnostics.parsedRows;
        malformedRows = taxResult.diagnostics.malformedRows.length;
        duplicateRows = taxResult.diagnostics.duplicateRows.length;
        highValueRecords = taxResult.diagnostics.highValueRecords.length;
        warnings.push(...taxResult.diagnostics.warnings);

        records = taxResult.records.map(record => ({
          sourceType: "TAX_SALE" as SourceType,
          rawData: record as unknown as Record<string, unknown>,
          normalizedData: normalizeTaxSaleRecord(record),
          contentHash: record.contentHash,
          parserUsed,
          parseTimeMs: taxResult.diagnostics.parseTimeMs,
        }));
      } else {
        parserUsed = "ProbateCsvParser (auto)";
        totalRows = probateResult.diagnostics.totalRows;
        parsedRows = probateResult.diagnostics.parsedRows;
        malformedRows = probateResult.diagnostics.malformedRows.length;
        duplicateRows = probateResult.diagnostics.duplicateRows.length;
        highValueRecords = probateResult.diagnostics.highValueRecords.length;
        warnings.push(...probateResult.diagnostics.warnings);

        records = probateResult.records.map(record => ({
          sourceType: "PROBATE" as SourceType,
          rawData: record as unknown as Record<string, unknown>,
          normalizedData: normalizeProbateRecord(record),
          contentHash: record.contentHash,
          parserUsed,
          parseTimeMs: probateResult.diagnostics.parseTimeMs,
        }));
      }

    } else {
      errors.push(`No parser available for source type "${sourceType}" with file type "${fileType}"`);
    }

  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown parsing error");
  }

  const parseTimeMs = Date.now() - startTime;

  return {
    success: errors.length === 0 && records.length > 0,
    records,
    totalRecords: records.length,
    diagnostics: {
      parserUsed,
      sourceType,
      fileType,
      totalRows,
      parsedRows,
      malformedRows,
      duplicateRows,
      highValueRecords,
      parseTimeMs,
      warnings,
      errors,
    },
  };
}

// =============================================================================
// DATABASE INTEGRATION
// =============================================================================

export async function parseAndStoreContent(
  content: string,
  batchId: string,
  options: {
    filename?: string;
    sourceType?: SourceType;
    county?: string;
    state?: string;
    sourceUrl?: string;
    pdfPages?: PdfPage[];
  } = {}
): Promise<ParserServiceResult> {
  const result = await parseContent(content, options);

  if (!result.success || result.records.length === 0) {
    return result;
  }

  // Store records in database as IngestionRecords
  const ingestionRecords = await Promise.all(
    result.records.map(async (record) => {
      // Check for existing record with same content hash
      const existing = await prisma.ingestionRecord.findFirst({
        where: { contentHash: record.contentHash },
      });

      if (existing) {
        return existing;
      }

      // Create new ingestion record
      return prisma.ingestionRecord.create({
        data: {
          batchId,
          sourceType: record.sourceType,
          rawData: record.rawData as any,
          rawPayload: record.rawData as any,
          normalizedData: record.normalizedData as any,
          contentHash: record.contentHash,
          status: "PENDING",
        },
      });
    })
  );

  // Update batch stats
  await prisma.ingestionBatch.update({
    where: { id: batchId },
    data: {
      recordCount: { increment: ingestionRecords.length },
      successCount: { increment: ingestionRecords.filter(r => r.status === "PENDING").length },
    },
  });

  return result;
}

// =============================================================================
// PARSER HEALTH CHECK
// =============================================================================

export function getParserHealth(): {
  parsers: Array<{
    name: string;
    sourceTypes: string[];
    fileTypes: string[];
    status: "HEALTHY";
  }>;
} {
  return {
    parsers: [
      {
        name: taxSaleCsvParser.name,
        sourceTypes: [taxSaleCsvParser.sourceType],
        fileTypes: taxSaleCsvParser.fileTypes,
        status: "HEALTHY",
      },
      {
        name: surplusPdfParser.name,
        sourceTypes: [surplusPdfParser.sourceType],
        fileTypes: surplusPdfParser.fileTypes,
        status: "HEALTHY",
      },
      {
        name: probateCsvParser.name,
        sourceTypes: [probateCsvParser.sourceType],
        fileTypes: probateCsvParser.fileTypes,
        status: "HEALTHY",
      },
    ],
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  parseContent,
  parseAndStoreContent,
  getParserHealth,
  detectFileType,
  detectSourceType,
};
