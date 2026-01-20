// ============================================
// INGESTION AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready tax sale list and PDF parser
// FOUNDER ONLY — Never expose to employees or clients
// ============================================

import { PrismaClient, IngestionSourceType } from "@prisma/client";
import crypto from "crypto";
import { legalService } from "./legalService.js";

const prisma = new PrismaClient();

// ============================================
// PARSER PATTERNS
// Common patterns in tax sale lists
// ============================================

interface ParsedRecord {
  ownerName: string | null;
  propertyAddress: string | null;
  parcelNumber: string | null;
  saleDate: Date | null;
  saleAmount: number | null;   // In cents
  surplusAmount: number | null; // In cents
  city: string | null;
  state: string | null;
  county: string | null;
  zipCode: string | null;
  rawData: Record<string, any>;
}

interface ParserConfig {
  type: "CSV" | "PDF" | "HTML" | "EXCEL";
  columnMapping?: Record<string, string>;
  dateFormat?: string;
  amountFields?: string[];
  skipRows?: number;
  delimiter?: string;
}

// ============================================
// PDF PARSING PATTERNS
// Common patterns found in tax sale PDFs
// ============================================

interface PDFParseResult {
  records: Record<string, any>[];
  metadata: {
    pageCount: number;
    county?: string;
    state?: string;
    saleDate?: string;
    documentType?: string;
  };
  errors: string[];
}

const PDF_PATTERNS = {
  // Owner name patterns
  ownerName: [
    /owner[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
    /taxpayer[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
    /name[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
    /([A-Z][A-Z\s]+),\s*([A-Z][A-Za-z]+)/g  // LASTNAME, Firstname format
  ],

  // Address patterns
  address: [
    /(\d+\s+[A-Za-z0-9\s]+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct|Pl|Cir)\.?)/gi,
    /property[:\s]+(\d+\s+[A-Za-z0-9\s]+)/gi,
    /situs[:\s]+(\d+\s+[A-Za-z0-9\s]+)/gi
  ],

  // Parcel/APN patterns
  parcel: [
    /parcel[:\s#]*([0-9\-]+)/gi,
    /apn[:\s#]*([0-9\-]+)/gi,
    /pin[:\s#]*([0-9\-]+)/gi,
    /(?:tax\s)?id[:\s#]*([0-9\-]+)/gi
  ],

  // Money patterns (captures dollars, will convert to cents)
  money: [
    /\$[\s]*([\d,]+\.?\d*)/g,
    /surplus[:\s]*\$?([\d,]+\.?\d*)/gi,
    /excess[:\s]*\$?([\d,]+\.?\d*)/gi,
    /overage[:\s]*\$?([\d,]+\.?\d*)/gi,
    /amount[:\s]*\$?([\d,]+\.?\d*)/gi
  ],

  // Date patterns
  date: [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/gi
  ],

  // County/State extraction
  county: [
    /([A-Za-z]+)\s+county/gi,
    /county\s+of\s+([A-Za-z]+)/gi
  ],

  state: [
    /,\s*([A-Z]{2})\s+\d{5}/g,  // State abbreviation before ZIP
    /state\s+of\s+([A-Za-z]+)/gi
  ]
};

// ============================================
// INGESTION SERVICE CLASS
// ============================================

export class IngestionService {
  // ----------------------------------------
  // SOURCE MANAGEMENT
  // ----------------------------------------

  /**
   * Create a new ingestion source
   */
  async createSource(params: {
    name: string;
    type: IngestionSourceType;
    state: string;
    county?: string;
    url?: string;
    parserConfig?: ParserConfig;
    frequency?: string;
  }): Promise<string> {
    const source = await prisma.ingestionSource.create({
      data: {
        name: params.name,
        type: params.type,
        state: params.state,
        county: params.county,
        url: params.url,
        parserConfig: params.parserConfig as any,
        frequency: params.frequency
      }
    });
    return source.id;
  }

  /**
   * Get all sources
   */
  async getSources(state?: string): Promise<any[]> {
    return prisma.ingestionSource.findMany({
      where: state ? { state } : undefined,
      orderBy: { createdAt: "desc" }
    });
  }

  // ----------------------------------------
  // BATCH PROCESSING
  // ----------------------------------------

  /**
   * Create a new ingestion batch
   */
  async createBatch(sourceId: string, fileName?: string, fileUrl?: string): Promise<string> {
    const batch = await prisma.ingestionBatch.create({
      data: {
        sourceId,
        fileName,
        fileUrl,
        status: "pending"
      }
    });
    return batch.id;
  }

  /**
   * Process a batch of raw data
   */
  async processBatch(
    batchId: string,
    rawRecords: Record<string, any>[],
    parserConfig?: ParserConfig
  ): Promise<{
    processed: number;
    created: number;
    skipped: number;
    errors: string[];
  }> {
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: "processing", totalRecords: rawRecords.length }
    });

    const errors: string[] = [];
    let processed = 0;
    let created = 0;
    let skipped = 0;

    for (const rawRecord of rawRecords) {
      try {
        // Parse the record
        const parsed = this.parseRecord(rawRecord, parserConfig);

        // Check if valid for case creation
        const validation = this.validateRecord(parsed);

        if (!validation.valid) {
          skipped++;
          await prisma.ingestionRecord.create({
            data: {
              batchId,
              rawData: rawRecord,
              status: "skipped",
              errorMessage: validation.reasons.join("; "),
              ...this.extractParsedFields(parsed)
            }
          });
          continue;
        }

        // Check for high value
        const isHighValue = (parsed.surplusAmount || 0) >= 1000000; // $10,000+
        const priority = this.calculatePriority(parsed);

        // Create ingestion record
        const record = await prisma.ingestionRecord.create({
          data: {
            batchId,
            rawData: rawRecord,
            status: "processed",
            isHighValue,
            priority,
            ...this.extractParsedFields(parsed)
          }
        });

        // Attempt to create case
        if (parsed.ownerName && parsed.propertyAddress) {
          const caseCreated = await this.createCaseFromRecord(record.id, parsed);
          if (caseCreated) {
            created++;
          }
        }

        processed++;
      } catch (error: any) {
        errors.push(`Row error: ${error.message}`);
        await prisma.ingestionRecord.create({
          data: {
            batchId,
            rawData: rawRecord,
            status: "error",
            errorMessage: error.message
          }
        });
      }
    }

    // Update batch status
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: {
        status: "completed",
        processedRecords: processed,
        createdCases: created,
        errors: errors.length > 0 ? errors.join("\n") : null,
        processedAt: new Date()
      }
    });

    return { processed, created, skipped, errors };
  }

  /**
   * Process ingestion batch from various file types
   * Main entry point for batch processing
   */
  async processIngestionBatch(
    batchId: string,
    fileContent: string | Buffer,
    fileType: "CSV" | "PDF" | "HTML",
    config?: ParserConfig
  ): Promise<{
    processed: number;
    created: number;
    skipped: number;
    errors: string[];
  }> {
    let records: Record<string, any>[] = [];

    switch (fileType) {
      case "CSV":
        records = this.parseCSV(fileContent.toString(), config);
        break;
      case "PDF":
        const pdfResult = this.parsePDF(fileContent.toString());
        records = pdfResult.records;
        break;
      case "HTML":
        records = this.parseHTML(fileContent.toString());
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    return this.processBatch(batchId, records, config);
  }

  // ----------------------------------------
  // PARSING
  // ----------------------------------------

  /**
   * Parse a raw record into structured data
   */
  parseRecord(rawRecord: Record<string, any>, config?: ParserConfig): ParsedRecord {
    // Default field mappings
    const defaultMapping: Record<string, string[]> = {
      ownerName: ["owner", "owner_name", "owner name", "name", "property_owner", "taxpayer"],
      propertyAddress: ["address", "property_address", "property address", "location", "property_location", "situs"],
      parcelNumber: ["parcel", "parcel_number", "parcel number", "apn", "pin", "property_id"],
      saleDate: ["sale_date", "sale date", "auction_date", "date_sold", "sold_date"],
      saleAmount: ["sale_amount", "sale amount", "bid", "winning_bid", "sale_price", "amount_paid"],
      surplusAmount: ["surplus", "surplus_amount", "excess", "overage", "excess_proceeds", "overages"],
      city: ["city", "municipality"],
      state: ["state", "st"],
      county: ["county", "county_name"],
      zipCode: ["zip", "zip_code", "zipcode", "postal"]
    };

    // Merge custom mapping with defaults (convert single strings to arrays)
    const mapping: Record<string, string[]> = { ...defaultMapping };
    if (config?.columnMapping) {
      for (const [key, value] of Object.entries(config.columnMapping)) {
        mapping[key] = [value];
      }
    }

    const findValue = (fieldNames: string[]): any => {
      for (const field of fieldNames) {
        // Check exact match
        if (rawRecord[field] !== undefined) return rawRecord[field];

        // Check case-insensitive
        const lowerField = field.toLowerCase();
        for (const key of Object.keys(rawRecord)) {
          if (key.toLowerCase() === lowerField) {
            return rawRecord[key];
          }
        }
      }
      return null;
    };

    // Parse amounts (convert to cents)
    const parseAmount = (value: any): number | null => {
      if (!value) return null;
      const cleaned = String(value).replace(/[$,\s]/g, "");
      const amount = parseFloat(cleaned);
      if (isNaN(amount)) return null;
      return Math.round(amount * 100);
    };

    // Parse date
    const parseDate = (value: any): Date | null => {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    return {
      ownerName: findValue(mapping.ownerName)?.toString().trim() || null,
      propertyAddress: findValue(mapping.propertyAddress)?.toString().trim() || null,
      parcelNumber: findValue(mapping.parcelNumber)?.toString().trim() || null,
      saleDate: parseDate(findValue(mapping.saleDate)),
      saleAmount: parseAmount(findValue(mapping.saleAmount)),
      surplusAmount: parseAmount(findValue(mapping.surplusAmount)),
      city: findValue(mapping.city)?.toString().trim() || null,
      state: findValue(mapping.state)?.toString().trim() || null,
      county: findValue(mapping.county)?.toString().trim() || null,
      zipCode: findValue(mapping.zipCode)?.toString().trim() || null,
      rawData: rawRecord
    };
  }

  /**
   * Validate a parsed record
   */
  validateRecord(record: ParsedRecord): {
    valid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (!record.ownerName) {
      reasons.push("Missing owner name");
    }

    if (!record.propertyAddress) {
      reasons.push("Missing property address");
    }

    if (!record.surplusAmount || record.surplusAmount <= 0) {
      reasons.push("No surplus amount or invalid amount");
    }

    // Skip very small amounts (under $100)
    if (record.surplusAmount && record.surplusAmount < 10000) {
      reasons.push("Surplus too small (under $100)");
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Calculate priority score
   */
  private calculatePriority(record: ParsedRecord): number {
    let priority = 0;

    // Higher surplus = higher priority
    if (record.surplusAmount) {
      if (record.surplusAmount >= 10000000) priority += 100; // $100k+
      else if (record.surplusAmount >= 5000000) priority += 75; // $50k+
      else if (record.surplusAmount >= 1000000) priority += 50; // $10k+
      else if (record.surplusAmount >= 500000) priority += 25;  // $5k+
    }

    // Complete records get higher priority
    if (record.ownerName) priority += 10;
    if (record.propertyAddress) priority += 10;
    if (record.parcelNumber) priority += 5;

    return priority;
  }

  /**
   * Extract parsed fields for DB storage
   */
  private extractParsedFields(parsed: ParsedRecord) {
    return {
      ownerName: parsed.ownerName,
      propertyAddress: parsed.propertyAddress,
      parcelNumber: parsed.parcelNumber,
      saleDate: parsed.saleDate,
      saleAmount: parsed.saleAmount,
      surplusAmount: parsed.surplusAmount
    };
  }

  // ----------------------------------------
  // CASE CREATION
  // ----------------------------------------

  /**
   * Create a case from an ingestion record
   * Uses transaction to ensure atomicity of Client + Case creation
   */
  private async createCaseFromRecord(
    recordId: string,
    parsed: ParsedRecord
  ): Promise<boolean> {
    try {
      // Check for existing case with same property
      const existing = await prisma.case.findFirst({
        where: {
          propertyAddress: parsed.propertyAddress || "",
          state: parsed.state || ""
        }
      });

      if (existing) {
        await prisma.ingestionRecord.update({
          where: { id: recordId },
          data: {
            status: "skipped",
            errorMessage: "Case already exists for this property"
          }
        });
        return false;
      }

      // Generate public access token (cryptographically secure)
      const publicAccessToken = this.generateSecureToken();

      // Use transaction to ensure atomicity
      const newCase = await prisma.$transaction(async (tx) => {
        // Generate internal code inside transaction to prevent race conditions
        // Using MAX + 1 pattern with locking
        const lastCase = await tx.case.findFirst({
          orderBy: { createdAt: "desc" },
          select: { internalCode: true }
        });

        let nextNumber = 1001;
        if (lastCase?.internalCode) {
          const match = lastCase.internalCode.match(/C-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        const internalCode = `C-${String(nextNumber).padStart(6, "0")}`;

        // Create placeholder client
        const client = await tx.user.create({
          data: {
            email: `pending-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@placeholder.internal`,
            passwordHash: "",
            role: "CLIENT",
            name: parsed.ownerName || "Unknown Owner",
            address: parsed.propertyAddress,
            city: parsed.city,
            state: parsed.state,
            zipCode: parsed.zipCode
          }
        });

        // Create case
        const createdCase = await tx.case.create({
          data: {
            internalCode,
            publicAccessToken,
            clientId: client.id,
            state: parsed.state || "UNKNOWN",
            county: parsed.county || "UNKNOWN",
            propertyAddress: parsed.propertyAddress || "",
            parcelNumber: parsed.parcelNumber,
            saleDate: parsed.saleDate,
            surplusAmountCents: parsed.surplusAmount || 0,
            feePercent: 30, // Default fee
            source: "ingestion",
            priority: this.calculatePriority(parsed)
          }
        });

        // Update ingestion record
        await tx.ingestionRecord.update({
          where: { id: recordId },
          data: { caseId: createdCase.id }
        });

        // Create audit log for case creation
        await tx.auditLog.create({
          data: {
            action: "CASE_CREATED_FROM_INGESTION",
            entityType: "CASE",
            entityId: createdCase.id,
            details: {
              internalCode,
              clientName: parsed.ownerName,
              propertyAddress: parsed.propertyAddress,
              surplusAmountCents: parsed.surplusAmount,
              ingestionRecordId: recordId
            }
          }
        });

        return createdCase;
      });

      // Create deadline tracking for the new case (outside transaction)
      if (parsed.saleDate && parsed.state) {
        try {
          await legalService.createCaseDeadlines(
            newCase.id,
            parsed.state,
            parsed.saleDate
          );
        } catch (deadlineError) {
          // Log error but don't fail case creation
          console.error(`Failed to create deadlines for case ${newCase.id}:`, deadlineError);
        }
      }

      return true;
    } catch (error) {
      console.error("Case creation error:", error);
      return false;
    }
  }

  /**
   * Generate cryptographically secure token for public access
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  // ----------------------------------------
  // HIGH VALUE OPPORTUNITIES
  // ----------------------------------------

  /**
   * Get high-value opportunities (FOUNDER ONLY)
   */
  async getHighValueOpportunities(minAmount: number = 1000000): Promise<any[]> {
    return prisma.ingestionRecord.findMany({
      where: {
        isHighValue: true,
        surplusAmount: { gte: minAmount },
        status: "processed"
      },
      orderBy: { surplusAmount: "desc" },
      take: 50
    });
  }

  /**
   * Get ingestion statistics
   */
  async getStatistics(): Promise<{
    totalRecords: number;
    processedRecords: number;
    createdCases: number;
    totalSurplusIdentified: number;
    highValueCount: number;
    byState: Record<string, number>;
  }> {
    const records = await prisma.ingestionRecord.findMany();

    const byState: Record<string, number> = {};
    let totalSurplus = 0;
    let highValue = 0;
    let created = 0;

    for (const record of records) {
      // By state
      const state = (record.rawData as any)?.state || "Unknown";
      byState[state] = (byState[state] || 0) + 1;

      // Totals
      if (record.surplusAmount) totalSurplus += record.surplusAmount;
      if (record.isHighValue) highValue++;
      if (record.caseId) created++;
    }

    return {
      totalRecords: records.length,
      processedRecords: records.filter(r => r.status === "processed").length,
      createdCases: created,
      totalSurplusIdentified: totalSurplus,
      highValueCount: highValue,
      byState
    };
  }

  // ----------------------------------------
  // PRIORITIZATION
  // ----------------------------------------

  /**
   * Get prioritized list for processing
   */
  async getPrioritizedCases(limit: number = 50): Promise<any[]> {
    return prisma.case.findMany({
      where: {
        status: "NEW",
        source: "ingestion"
      },
      orderBy: [
        { priority: "desc" },
        { surplusAmountCents: "desc" }
      ],
      take: limit,
      include: {
        client: {
          select: { name: true }
        }
      }
    });
  }

  /**
   * Suggest ingestion priorities
   */
  suggestPriorities(): {
    recommendation: string;
    focusStates: string[];
    focusAmountRange: { min: number; max: number };
  } {
    return {
      recommendation: "Focus on states with longer claim periods and higher surplus amounts",
      focusStates: ["FL", "TN", "GA", "TX", "NC"], // States with favorable rules
      focusAmountRange: {
        min: 500000,   // $5,000
        max: 50000000  // $500,000
      }
    };
  }

  // ----------------------------------------
  // CSV PARSING
  // ----------------------------------------

  /**
   * Parse CSV content into records
   */
  parseCSV(content: string, config?: ParserConfig): Record<string, any>[] {
    const lines = content.split("\n").map(l => l.trim()).filter(l => l);
    const delimiter = config?.delimiter || ",";
    const skipRows = config?.skipRows || 0;

    if (lines.length <= skipRows) return [];

    // Get headers from first non-skipped row
    const headerLine = lines[skipRows];
    const headers = this.parseCSVLine(headerLine, delimiter);

    const records: Record<string, any>[] = [];

    for (let i = skipRows + 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      const record: Record<string, any> = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j] || "";
      }

      records.push(record);
    }

    return records;
  }

  /**
   * Parse a single CSV line (handles quoted values)
   */
  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  // ----------------------------------------
  // PDF PARSING
  // ----------------------------------------

  /**
   * Parse PDF text content into structured records
   * Extracts owner names, addresses, parcel numbers, and surplus amounts
   * from common tax sale document formats
   */
  parsePDF(textContent: string): PDFParseResult {
    const records: Record<string, any>[] = [];
    const errors: string[] = [];
    const metadata: PDFParseResult["metadata"] = {
      pageCount: 1
    };

    // Extract document-level metadata
    const countyMatch = textContent.match(PDF_PATTERNS.county[0]);
    if (countyMatch) {
      metadata.county = countyMatch[1];
    }

    const stateMatch = textContent.match(PDF_PATTERNS.state[0]);
    if (stateMatch) {
      metadata.state = stateMatch[1];
    }

    // Try to detect document structure
    // Method 1: Line-by-line structured data (common in tabular PDFs)
    const lines = textContent.split("\n").map(l => l.trim()).filter(l => l);

    // Method 2: Block-based parsing (common in certificates/documents)
    // Split by common delimiters like page breaks, horizontal rules, or record separators
    const blocks = textContent.split(/(?:\n\s*\n|\-{3,}|\_{3,}|\*{3,}|Page \d+)/gi)
      .map(b => b.trim())
      .filter(b => b.length > 20);

    // Determine parsing strategy based on content structure
    const hasTableStructure = this.detectTableStructure(lines);

    if (hasTableStructure) {
      // Parse as table
      const tableRecords = this.parsePDFTable(lines);
      records.push(...tableRecords);
    } else {
      // Parse as blocks
      for (const block of blocks) {
        try {
          const record = this.parsePDFBlock(block, metadata);
          if (record && (record.ownerName || record.propertyAddress || record.surplusAmount)) {
            records.push(record);
          }
        } catch (err: any) {
          errors.push(`Block parse error: ${err.message}`);
        }
      }
    }

    // If no records found, try aggressive pattern matching on entire document
    if (records.length === 0) {
      const aggressiveRecords = this.parsePDFAggressive(textContent, metadata);
      records.push(...aggressiveRecords);
    }

    return {
      records,
      metadata,
      errors
    };
  }

  /**
   * Detect if PDF content has a table-like structure
   */
  private detectTableStructure(lines: string[]): boolean {
    // Check for consistent column spacing or delimiter patterns
    let tabDelimitedCount = 0;
    let consistentColumnCount = 0;
    let lastColumnCount = 0;

    for (const line of lines.slice(0, 20)) { // Check first 20 lines
      if (line.includes("\t")) tabDelimitedCount++;

      // Count columns based on multiple spaces
      const columns = line.split(/\s{2,}/).length;
      if (columns === lastColumnCount && columns > 2) {
        consistentColumnCount++;
      }
      lastColumnCount = columns;
    }

    return tabDelimitedCount > 5 || consistentColumnCount > 5;
  }

  /**
   * Parse PDF table structure
   */
  private parsePDFTable(lines: string[]): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    // Find header row
    let headerIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes("owner") || line.includes("name") || line.includes("parcel") ||
          line.includes("address") || line.includes("surplus") || line.includes("amount")) {
        headerIndex = i;
        headers = lines[i].split(/\s{2,}|\t/).map(h => h.trim().toLowerCase());
        break;
      }
    }

    if (headerIndex === -1) {
      // No header found, use position-based parsing
      return this.parsePDFTablePositional(lines);
    }

    // Parse data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = lines[i].split(/\s{2,}|\t/).map(v => v.trim());
      if (values.length >= 2) {
        const record: Record<string, any> = { _source: "pdf_table" };

        for (let j = 0; j < headers.length && j < values.length; j++) {
          record[headers[j]] = values[j];
        }

        records.push(record);
      }
    }

    return records;
  }

  /**
   * Parse PDF table by position when no header is found
   */
  private parsePDFTablePositional(lines: string[]): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    for (const line of lines) {
      // Skip short lines
      if (line.length < 20) continue;

      const record: Record<string, any> = { _source: "pdf_positional" };

      // Extract amounts (likely surplus)
      const amountMatches = line.match(/\$[\s]*([\d,]+\.?\d*)/g);
      if (amountMatches && amountMatches.length > 0) {
        // Last amount is usually surplus
        const amountStr = amountMatches[amountMatches.length - 1].replace(/[$,\s]/g, "");
        record.surplusAmount = amountStr;
      }

      // Extract parcel
      const parcelMatch = line.match(/([0-9]{2,}[\-\.][0-9\-\.]+)/);
      if (parcelMatch) {
        record.parcelNumber = parcelMatch[1];
      }

      // Extract address (number followed by street name)
      const addressMatch = line.match(/(\d+\s+[A-Za-z0-9\s]+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct|Pl|Cir)\.?)/i);
      if (addressMatch) {
        record.propertyAddress = addressMatch[1];
      }

      // Extract name (all caps section, common in legal docs)
      const nameMatch = line.match(/([A-Z][A-Z\s,\.]{5,})/);
      if (nameMatch && !nameMatch[1].match(/\d/)) {
        record.ownerName = nameMatch[1].trim();
      }

      // Only add if we found meaningful data
      if (record.surplusAmount || record.parcelNumber || record.propertyAddress) {
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Parse a block of PDF text into a record
   */
  private parsePDFBlock(block: string, metadata: PDFParseResult["metadata"]): Record<string, any> | null {
    const record: Record<string, any> = { _source: "pdf_block" };

    // Extract owner name
    for (const pattern of PDF_PATTERNS.ownerName) {
      const match = block.match(pattern);
      if (match) {
        record.ownerName = match[1]?.trim();
        break;
      }
    }

    // Extract address
    for (const pattern of PDF_PATTERNS.address) {
      const match = block.match(pattern);
      if (match) {
        record.propertyAddress = match[1]?.trim();
        break;
      }
    }

    // Extract parcel number
    for (const pattern of PDF_PATTERNS.parcel) {
      const match = block.match(pattern);
      if (match) {
        record.parcelNumber = match[1]?.trim();
        break;
      }
    }

    // Extract surplus amount
    const amounts: number[] = [];
    for (const pattern of PDF_PATTERNS.money) {
      const matches = block.matchAll(pattern);
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 0) {
          amounts.push(amount);
        }
      }
    }
    // Typically the largest amount is the surplus
    if (amounts.length > 0) {
      record.surplusAmount = Math.max(...amounts).toString();
    }

    // Extract date
    for (const pattern of PDF_PATTERNS.date) {
      const match = block.match(pattern);
      if (match) {
        record.saleDate = match[1];
        break;
      }
    }

    // Add metadata
    if (metadata.county) record.county = metadata.county;
    if (metadata.state) record.state = metadata.state;

    return record;
  }

  /**
   * Aggressive pattern matching for poorly structured PDFs
   */
  private parsePDFAggressive(textContent: string, metadata: PDFParseResult["metadata"]): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    // Find all amounts that look like surplus (typically > $100)
    const amountMatches = [...textContent.matchAll(/\$[\s]*([\d,]+\.?\d*)/g)];
    const significantAmounts = amountMatches
      .map(m => ({
        value: parseFloat(m[1].replace(/,/g, "")),
        index: m.index || 0
      }))
      .filter(a => a.value >= 100);

    // For each significant amount, try to find associated owner/address
    for (const amount of significantAmounts) {
      // Get text window around the amount (500 chars before and after)
      const start = Math.max(0, amount.index - 500);
      const end = Math.min(textContent.length, amount.index + 500);
      const window = textContent.substring(start, end);

      const record: Record<string, any> = {
        _source: "pdf_aggressive",
        surplusAmount: amount.value.toString()
      };

      // Try to find owner name
      const nameMatch = window.match(/([A-Z][A-Z\s,\.]{5,})/);
      if (nameMatch && !nameMatch[1].match(/\d/) && !nameMatch[1].match(/COUNTY|STATE|COURT/i)) {
        record.ownerName = nameMatch[1].trim();
      }

      // Try to find address
      const addressMatch = window.match(/(\d+\s+[A-Za-z0-9\s]+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct|Pl|Cir)\.?)/i);
      if (addressMatch) {
        record.propertyAddress = addressMatch[1].trim();
      }

      // Try to find parcel
      const parcelMatch = window.match(/(?:parcel|apn|pin)[:\s#]*([0-9\-\.]+)/i);
      if (parcelMatch) {
        record.parcelNumber = parcelMatch[1].trim();
      }

      // Add metadata
      if (metadata.county) record.county = metadata.county;
      if (metadata.state) record.state = metadata.state;

      // Only add if we have useful data beyond just the amount
      if (record.ownerName || record.propertyAddress || record.parcelNumber) {
        records.push(record);
      }
    }

    return records;
  }

  // ----------------------------------------
  // HTML PARSING
  // ----------------------------------------

  /**
   * Parse HTML content into records
   * Common for county websites that list surplus funds
   */
  parseHTML(htmlContent: string): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    // Remove scripts and styles
    let cleaned = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Try to find table data
    const tableMatches = cleaned.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

    for (const tableMatch of tableMatches) {
      const tableContent = tableMatch[1];

      // Extract headers
      const headerMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i) ||
                          tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);

      if (headerMatch) {
        const headers: string[] = [];
        const thMatches = headerMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
        for (const th of thMatches) {
          headers.push(this.stripHTML(th[1]).toLowerCase().trim());
        }

        // Extract rows
        const bodyContent = tableContent.replace(/<thead[^>]*>[\s\S]*?<\/thead>/i, "");
        const rowMatches = bodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

        for (const row of rowMatches) {
          const cells: string[] = [];
          const cellMatches = row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
          for (const cell of cellMatches) {
            cells.push(this.stripHTML(cell[1]).trim());
          }

          if (cells.length >= 2 && headers.length > 0) {
            const record: Record<string, any> = { _source: "html_table" };
            for (let i = 0; i < headers.length && i < cells.length; i++) {
              if (headers[i]) {
                record[headers[i]] = cells[i];
              }
            }
            records.push(record);
          }
        }
      }
    }

    return records;
  }

  /**
   * Strip HTML tags from a string
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export const ingestionService = new IngestionService();
