// ============================================
// INGESTION API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready data ingestion endpoints with full parser integration
// FOUNDER ONLY — Never expose to employees or clients
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, IngestionSourceType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { ingestionService } from "../services/ingestionService.js";
import { sanitizeString } from "../utils/security.js";
import parserService, {
  parseContent,
  parseAndStoreContent,
  getParserHealth,
  SourceType,
} from "../services/parserService.js";
import { scraperService } from "../services/scraperService.js";

const router = Router();
const prisma = new PrismaClient();

// Configuration limits
const MAX_BATCH_SIZE = 10000; // Maximum records per batch
const MAX_CSV_SIZE_MB = 50; // Maximum CSV content size in MB
const MAX_URL_LENGTH = 2000;

// ============================================
// ALL ROUTES ARE FOUNDER ONLY
// ============================================

/**
 * GET /api/ingestion/sources - List all ingestion sources
 */
router.get("/sources", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { state } = req.query;
    const sources = await ingestionService.getSources(state as string);

    res.json({
      success: true,
      count: sources.length,
      data: sources,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/ingestion/sources - Create new ingestion source
 */
router.post("/sources", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, state, county, url, parserConfig, frequency } = req.body;

    const validTypes: IngestionSourceType[] = [
      "TAX_SALE_LIST",
      "SURPLUS_PDF",
      "AUCTION_RESULT",
      "COUNTY_WEBSITE",
      "MANUAL_ENTRY",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid source type" });
    }

    const sourceId = await ingestionService.createSource({
      name,
      type,
      state,
      county,
      url,
      parserConfig,
      frequency,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_SOURCE_CREATED",
        entityType: "INGESTION_SOURCE",
        entityId: sourceId,
        details: { name, type, state },
      },
    });

    res.status(201).json({
      success: true,
      data: { id: sourceId },
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/batches - List all batches
 */
router.get("/batches", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { status, sourceId, limit } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (sourceId) where.sourceId = sourceId;

    const batches = await prisma.ingestionBatch.findMany({
      where,
      include: {
        source: {
          select: { name: true, type: true, state: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string) || 50,
    });

    res.json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/ingestion/batches - Create new batch and process data
 */
router.post(
  "/batches",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sourceId, fileName, fileUrl, data, parserConfig } = req.body;

    // Validate required fields
    if (!sourceId) {
      throw Errors.badRequest("sourceId is required");
    }

    if (!data || !Array.isArray(data)) {
      throw Errors.badRequest("data must be an array of records");
    }

    // Validate batch size
    if (data.length > MAX_BATCH_SIZE) {
      throw Errors.badRequest(`Batch size exceeds maximum of ${MAX_BATCH_SIZE} records`);
    }

    if (data.length === 0) {
      throw Errors.badRequest("data array cannot be empty");
    }

    // Sanitize optional fields
    const sanitizedFileName = fileName ? sanitizeString(fileName) : undefined;
    const sanitizedFileUrl = fileUrl ? fileUrl.slice(0, MAX_URL_LENGTH) : undefined;

    // Verify source exists
    const source = await prisma.ingestionSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw Errors.notFound("Ingestion source");
    }

    // Create batch
    const batchId = await ingestionService.createBatch(sourceId, sanitizedFileName, sanitizedFileUrl);

    // Process the batch
    const result = await ingestionService.processBatch(batchId, data, parserConfig);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_BATCH_PROCESSED",
        entityType: "INGESTION_BATCH",
        entityId: batchId,
        details: {
          sourceId,
          processed: result.processed,
          created: result.created,
          skipped: result.skipped,
          errors: result.errors.length,
        },
      },
    });

    res.json({
      success: true,
      data: {
        batchId,
        ...result,
      },
    });
  })
);

/**
 * POST /api/ingestion/csv - Parse and process CSV content
 */
router.post(
  "/csv",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sourceId, fileName, csvContent, parserConfig } = req.body;

    // Validate required fields
    if (!sourceId) {
      throw Errors.badRequest("sourceId is required");
    }

    if (!csvContent || typeof csvContent !== "string") {
      throw Errors.badRequest("csvContent is required and must be a string");
    }

    // Validate CSV size (prevent memory exhaustion)
    const csvSizeBytes = Buffer.byteLength(csvContent, "utf8");
    const csvSizeMB = csvSizeBytes / (1024 * 1024);

    if (csvSizeMB > MAX_CSV_SIZE_MB) {
      throw Errors.badRequest(
        `CSV content exceeds maximum size of ${MAX_CSV_SIZE_MB}MB (got ${csvSizeMB.toFixed(2)}MB)`
      );
    }

    // Verify source exists
    const source = await prisma.ingestionSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw Errors.notFound("Ingestion source");
    }

    // Parse CSV
    const records = ingestionService.parseCSV(csvContent, parserConfig);

    if (records.length === 0) {
      throw Errors.badRequest("No records found in CSV");
    }

    // Validate parsed record count
    if (records.length > MAX_BATCH_SIZE) {
      throw Errors.badRequest(`CSV contains ${records.length} records, exceeds maximum of ${MAX_BATCH_SIZE}`);
    }

    // Sanitize fileName
    const sanitizedFileName = fileName ? sanitizeString(fileName) : undefined;

    // Create batch
    const batchId = await ingestionService.createBatch(sourceId, sanitizedFileName);

    // Process the batch
    const result = await ingestionService.processBatch(batchId, records, parserConfig);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_CSV_PROCESSED",
        entityType: "INGESTION_BATCH",
        entityId: batchId,
        details: {
          sourceId,
          csvSizeMB: csvSizeMB.toFixed(2),
          recordsParsed: records.length,
          processed: result.processed,
          created: result.created,
          skipped: result.skipped,
        },
      },
    });

    res.json({
      success: true,
      data: {
        batchId,
        recordsParsed: records.length,
        ...result,
      },
    });
  })
);

// ============================================
// NEW PARSER SERVICE INTEGRATION ENDPOINTS
// ============================================

/**
 * POST /api/ingestion/parse - Auto-detect and parse content using ParserService
 * Supports: CSV, PDF text, TXT files
 * Auto-detects: TAX_SALE, SURPLUS_FUND, PROBATE sources
 */
router.post(
  "/parse",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content, filename, sourceType, county, state, sourceUrl, storeResults, sourceId } = req.body;

    // Validate required fields
    if (!content || typeof content !== "string") {
      throw Errors.badRequest("content is required and must be a string");
    }

    // Validate content size
    const contentSizeBytes = Buffer.byteLength(content, "utf8");
    const contentSizeMB = contentSizeBytes / (1024 * 1024);

    if (contentSizeMB > MAX_CSV_SIZE_MB) {
      throw Errors.badRequest(
        `Content exceeds maximum size of ${MAX_CSV_SIZE_MB}MB (got ${contentSizeMB.toFixed(2)}MB)`
      );
    }

    // Determine if we should store results
    const shouldStore = storeResults === true && sourceId;

    if (shouldStore) {
      // Verify source exists
      const source = await prisma.ingestionSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) {
        throw Errors.notFound("Ingestion source");
      }

      // Create batch and parse+store
      const batchId = await ingestionService.createBatch(sourceId, filename);
      const result = await parseAndStoreContent(content, batchId, {
        filename,
        sourceType: sourceType as SourceType,
        county,
        state,
        sourceUrl,
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "INGESTION_PARSE_AND_STORE",
          entityType: "INGESTION_BATCH",
          entityId: batchId,
          details: {
            sourceId,
            filename,
            parserUsed: result.diagnostics.parserUsed,
            sourceType: result.diagnostics.sourceType,
            totalRecords: result.totalRecords,
            highValueRecords: result.diagnostics.highValueRecords,
          },
        },
      });

      res.json({
        success: result.success,
        data: {
          batchId,
          totalRecords: result.totalRecords,
          diagnostics: result.diagnostics,
          records: result.records.map((r) => ({
            sourceType: r.sourceType,
            normalizedData: r.normalizedData,
            contentHash: r.contentHash,
          })),
        },
      });
    } else {
      // Parse only, don't store
      const result = await parseContent(content, {
        filename,
        sourceType: sourceType as SourceType,
        county,
        state,
        sourceUrl,
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "INGESTION_PARSE_PREVIEW",
          entityType: "INGESTION_PARSE",
          entityId: "preview",
          details: {
            filename,
            parserUsed: result.diagnostics.parserUsed,
            sourceType: result.diagnostics.sourceType,
            totalRecords: result.totalRecords,
          },
        },
      });

      res.json({
        success: result.success,
        data: {
          totalRecords: result.totalRecords,
          diagnostics: result.diagnostics,
          records: result.records.map((r) => ({
            sourceType: r.sourceType,
            normalizedData: r.normalizedData,
            contentHash: r.contentHash,
          })),
        },
      });
    }
  })
);

/**
 * POST /api/ingestion/fetch-and-parse - Fetch URL and auto-parse content
 * Full scraper + parser integration endpoint
 */
router.post(
  "/fetch-and-parse",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { url, sourceType, county, state, storeResults, sourceId, headers } = req.body;

    // Validate URL
    if (!url || typeof url !== "string") {
      throw Errors.badRequest("url is required");
    }

    if (url.length > MAX_URL_LENGTH) {
      throw Errors.badRequest(`URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
    }

    // Fetch content using scraper service
    const scrapeResult = await scraperService.fetchSingleUrl(url, {
      timeoutMs: 30000,
      headers: headers || {},
    });

    if (!scrapeResult.success || !scrapeResult.content) {
      throw Errors.badRequest(`Failed to fetch URL: ${scrapeResult.error || "Unknown error"}`);
    }

    // Extract filename from URL
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split("/").pop() || "fetched-content";

    // Determine if we should store results
    const shouldStore = storeResults === true && sourceId;

    if (shouldStore) {
      // Verify source exists
      const source = await prisma.ingestionSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) {
        throw Errors.notFound("Ingestion source");
      }

      // Create batch and parse+store
      const batchId = await ingestionService.createBatch(sourceId, filename, url);
      const result = await parseAndStoreContent(scrapeResult.content, batchId, {
        filename,
        sourceType: sourceType as SourceType,
        county,
        state,
        sourceUrl: url,
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "INGESTION_FETCH_AND_STORE",
          entityType: "INGESTION_BATCH",
          entityId: batchId,
          details: {
            sourceId,
            url,
            contentLength: scrapeResult.contentLength,
            parserUsed: result.diagnostics.parserUsed,
            totalRecords: result.totalRecords,
          },
        },
      });

      res.json({
        success: result.success,
        data: {
          batchId,
          fetchedUrl: url,
          contentLength: scrapeResult.contentLength,
          contentHash: scrapeResult.contentHash,
          totalRecords: result.totalRecords,
          diagnostics: result.diagnostics,
          records: result.records.map((r) => ({
            sourceType: r.sourceType,
            normalizedData: r.normalizedData,
            contentHash: r.contentHash,
          })),
        },
      });
    } else {
      // Parse only, don't store
      const result = await parseContent(scrapeResult.content, {
        filename,
        sourceType: sourceType as SourceType,
        county,
        state,
        sourceUrl: url,
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "INGESTION_FETCH_AND_PREVIEW",
          entityType: "INGESTION_PARSE",
          entityId: "preview",
          details: {
            url,
            contentLength: scrapeResult.contentLength,
            parserUsed: result.diagnostics.parserUsed,
            totalRecords: result.totalRecords,
          },
        },
      });

      res.json({
        success: result.success,
        data: {
          fetchedUrl: url,
          contentLength: scrapeResult.contentLength,
          contentHash: scrapeResult.contentHash,
          totalRecords: result.totalRecords,
          diagnostics: result.diagnostics,
          records: result.records.map((r) => ({
            sourceType: r.sourceType,
            normalizedData: r.normalizedData,
            contentHash: r.contentHash,
          })),
        },
      });
    }
  })
);

/**
 * GET /api/ingestion/parsers/health - Get parser health status
 */
router.get("/parsers/health", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const health = getParserHealth();

    res.json({
      success: true,
      data: health,
    });
  } catch (error: unknown) {
    console.error("Parser health error:", error);
    res.status(500).json({ success: false, error: "Failed to get parser health" });
  }
});

/**
 * GET /api/ingestion/records - List ingestion records
 */
router.get("/records", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { batchId, status, isHighValue, limit, offset } = req.query;

    const where: Record<string, unknown> = {};
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;
    if (isHighValue === "true") where.isHighValue = true;

    const [records, total] = await Promise.all([
      prisma.ingestionRecord.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: parseInt(limit as string) || 50,
        skip: parseInt(offset as string) || 0,
      }),
      prisma.ingestionRecord.count({ where }),
    ]);

    res.json({
      success: true,
      total,
      count: records.length,
      data: records,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/records/:id - Get single ingestion record with full details
 */
router.get("/records/:id", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const record = await prisma.ingestionRecord.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            source: true,
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * PATCH /api/ingestion/records/:id - Update ingestion record status
 */
router.patch(
  "/records/:id",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, notes, priority, isHighValue } = req.body;

    const validStatuses = ["PENDING", "PROCESSING", "IMPORTED", "SKIPPED", "ERROR"];
    if (status && !validStatuses.includes(status)) {
      throw Errors.badRequest(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    const record = await prisma.ingestionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw Errors.notFound("Ingestion record");
    }

    const updated = await prisma.ingestionRecord.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { errorDetails: notes }),
        ...(priority !== undefined && { priority: parseInt(priority) }),
        ...(isHighValue !== undefined && { isHighValue }),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_RECORD_UPDATED",
        entityType: "INGESTION_RECORD",
        entityId: id,
        details: {
          previousStatus: record.status,
          newStatus: status || record.status,
        },
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * GET /api/ingestion/high-value - Get high-value opportunities
 */
router.get("/high-value", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const minAmount = parseInt(req.query.minAmount as string) || 1000000; // Default $10,000 in cents
    const opportunities = await ingestionService.getHighValueOpportunities(minAmount);

    res.json({
      success: true,
      count: opportunities.length,
      minAmountCents: minAmount,
      data: opportunities,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/stats - Get ingestion statistics
 */
router.get("/stats", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const stats = await ingestionService.getStatistics();

    // Get additional parser stats
    const parserHealth = getParserHealth();

    res.json({
      success: true,
      data: {
        ...stats,
        parsers: parserHealth.parsers.length,
        parserStatus: parserHealth.parsers.map((p) => ({
          name: p.name,
          status: p.status,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/prioritized - Get prioritized cases for processing
 */
router.get("/prioritized", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const cases = await ingestionService.getPrioritizedCases(limit);

    res.json({
      success: true,
      count: cases.length,
      data: cases,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/suggestions - Get ingestion priorities and suggestions
 */
router.get("/suggestions", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const suggestions = ingestionService.suggestPriorities();

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/owner-contacts - Get records with owner contact info (FOUNDER FEATURE)
 * Returns records that have owner phone or email extracted
 */
router.get("/owner-contacts", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { limit, offset, sourceType, hasPhone, hasEmail } = req.query;

    // Build filter for records with contact info
    const records = await prisma.ingestionRecord.findMany({
      where: {
        OR: [
          {
            normalizedData: {
              path: ["ownerPhone"],
              not: "",
            },
          },
          {
            normalizedData: {
              path: ["ownerEmail"],
              not: "",
            },
          },
        ],
        ...(sourceType && { sourceType: sourceType as string }),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: parseInt(limit as string) || 100,
      skip: parseInt(offset as string) || 0,
    });

    // Filter and map results to extract contact info
    const contactRecords = records
      .map((record) => {
        const normalized = record.normalizedData as Record<string, unknown>;
        const ownerPhone = (normalized?.ownerPhone as string) || "";
        const ownerEmail = (normalized?.ownerEmail as string) || "";
        const ownerName = (normalized?.ownerName as string) || "";

        // Apply hasPhone/hasEmail filters
        if (hasPhone === "true" && !ownerPhone) return null;
        if (hasEmail === "true" && !ownerEmail) return null;

        return {
          id: record.id,
          sourceType: record.sourceType,
          ownerName,
          ownerPhone,
          ownerEmail,
          ownerMailingAddress: (normalized?.ownerMailingAddress as string) || "",
          propertyAddress: (normalized?.propertyAddress as string) || "",
          city: (normalized?.city as string) || "",
          state: (normalized?.state as string) || "",
          county: (normalized?.county as string) || "",
          amountCents: (normalized?.amountCents as number) || 0,
          createdAt: record.createdAt,
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      count: contactRecords.length,
      data: contactRecords,
    });
  } catch (error: unknown) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * DELETE /api/ingestion/batches/:id - Delete a batch and all its records
 */
router.delete(
  "/batches/:id",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Verify batch exists
    const batch = await prisma.ingestionBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { records: true },
        },
      },
    });

    if (!batch) {
      throw Errors.notFound("Ingestion batch");
    }

    // Delete records first
    await prisma.ingestionRecord.deleteMany({
      where: { batchId: id },
    });

    // Delete batch
    await prisma.ingestionBatch.delete({
      where: { id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_BATCH_DELETED",
        entityType: "INGESTION_BATCH",
        entityId: id,
        details: {
          recordsDeleted: batch._count.records,
        },
      },
    });

    res.json({
      success: true,
      data: {
        deletedBatchId: id,
        deletedRecords: batch._count.records,
      },
    });
  })
);

export default router;
