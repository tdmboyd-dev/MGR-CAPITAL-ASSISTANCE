// ============================================
// INGESTION API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready data ingestion endpoints
// FOUNDER ONLY — Never expose to employees or clients
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, IngestionSourceType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { ingestionService } from "../services/ingestionService.js";
import { sanitizeString } from "../utils/security.js";

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
      data: sources
    });
  } catch (error: any) {
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

    const validTypes: IngestionSourceType[] = ["TAX_SALE_LIST", "SURPLUS_PDF", "AUCTION_RESULT", "COUNTY_WEBSITE", "MANUAL_ENTRY"];

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
      frequency
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "INGESTION_SOURCE_CREATED",
        entityType: "INGESTION_SOURCE",
        entityId: sourceId,
        details: { name, type, state }
      }
    });

    res.status(201).json({
      success: true,
      data: { id: sourceId }
    });
  } catch (error: any) {
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

    const where: any = {};
    if (status) where.status = status;
    if (sourceId) where.sourceId = sourceId;

    const batches = await prisma.ingestionBatch.findMany({
      where,
      include: {
        source: {
          select: { name: true, type: true, state: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string) || 50
    });

    res.json({
      success: true,
      count: batches.length,
      data: batches
    });
  } catch (error: any) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * POST /api/ingestion/batches - Create new batch and process data
 */
router.post("/batches", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
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
    where: { id: sourceId }
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
        errors: result.errors.length
      }
    }
  });

  res.json({
    success: true,
    data: {
      batchId,
      ...result
    }
  });
}));

/**
 * POST /api/ingestion/csv - Parse and process CSV content
 */
router.post("/csv", authMiddleware, roleGuard(["ADMIN"]), asyncHandler(async (req: AuthRequest, res: Response) => {
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
    throw Errors.badRequest(`CSV content exceeds maximum size of ${MAX_CSV_SIZE_MB}MB (got ${csvSizeMB.toFixed(2)}MB)`);
  }

  // Verify source exists
  const source = await prisma.ingestionSource.findUnique({
    where: { id: sourceId }
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
        skipped: result.skipped
      }
    }
  });

  res.json({
    success: true,
    data: {
      batchId,
      recordsParsed: records.length,
      ...result
    }
  });
}));

/**
 * GET /api/ingestion/records - List ingestion records
 */
router.get("/records", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const { batchId, status, isHighValue, limit, offset } = req.query;

    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;
    if (isHighValue === "true") where.isHighValue = true;

    const [records, total] = await Promise.all([
      prisma.ingestionRecord.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        take: parseInt(limit as string) || 50,
        skip: parseInt(offset as string) || 0
      }),
      prisma.ingestionRecord.count({ where })
    ]);

    res.json({
      success: true,
      total,
      count: records.length,
      data: records
    });
  } catch (error: any) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/high-value - Get high-value opportunities
 */
router.get("/high-value", authMiddleware, roleGuard(["ADMIN"]), async (req: Request, res: Response) => {
  try {
    const minAmount = parseInt(req.query.minAmount as string) || 1000000; // Default $10,000
    const opportunities = await ingestionService.getHighValueOpportunities(minAmount);

    res.json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (error: any) {
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

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
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
      data: cases
    });
  } catch (error: any) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

/**
 * GET /api/ingestion/suggestions - Get ingestion priorities
 */
router.get("/suggestions", authMiddleware, roleGuard(["ADMIN"]), async (_req: Request, res: Response) => {
  try {
    const suggestions = ingestionService.suggestPriorities();

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error: any) {
    console.error("Ingestion error:", error);
    res.status(500).json({ success: false, error: "An error occurred. Please try again." });
  }
});

export default router;
