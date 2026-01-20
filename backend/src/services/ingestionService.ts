// ============================================
// INGESTION AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready tax sale list and PDF parser
// FOUNDER ONLY — Never expose to employees or clients
// ============================================

import { PrismaClient, IngestionSourceType } from "@prisma/client";

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

      // Generate internal code
      const caseCount = await prisma.case.count();
      const internalCode = `C-${String(caseCount + 1001).padStart(6, "0")}`;

      // Create placeholder client
      const client = await prisma.user.create({
        data: {
          email: `pending-${Date.now()}@placeholder.internal`,
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
      const newCase = await prisma.case.create({
        data: {
          internalCode,
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
      await prisma.ingestionRecord.update({
        where: { id: recordId },
        data: { caseId: newCase.id }
      });

      return true;
    } catch (error) {
      return false;
    }
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
  // CSV PARSING HELPER
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
}

export const ingestionService = new IngestionService();
