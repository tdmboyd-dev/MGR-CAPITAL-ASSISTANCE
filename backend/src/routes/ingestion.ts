// ============================================
// INGESTION API ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready data ingestion endpoints
// FOUNDER ONLY — Never expose to employees or clients
// ============================================

import { Router, Request, Response } from "express";
import { PrismaClient, IngestionSourceType } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { ingestionService } from "../services/ingestionService.js";

const router = Router();
const prisma = new PrismaClient();

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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ingestion/batches - Create new batch and process data
 */
router.post("/batches", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { sourceId, fileName, fileUrl, data, parserConfig } = req.body;

    if (!sourceId || !data || !Array.isArray(data)) {
      return res.status(400).json({ success: false, error: "sourceId and data array required" });
    }

    // Create batch
    const batchId = await ingestionService.createBatch(sourceId, fileName, fileUrl);

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ingestion/csv - Parse and process CSV content
 */
router.post("/csv", authMiddleware, roleGuard(["ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { sourceId, fileName, csvContent, parserConfig } = req.body;

    if (!sourceId || !csvContent) {
      return res.status(400).json({ success: false, error: "sourceId and csvContent required" });
    }

    // Parse CSV
    const records = ingestionService.parseCSV(csvContent, parserConfig);

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: "No records found in CSV" });
    }

    // Create batch
    const batchId = await ingestionService.createBatch(sourceId, fileName);

    // Process the batch
    const result = await ingestionService.processBatch(batchId, records, parserConfig);

    res.json({
      success: true,
      data: {
        batchId,
        recordsParsed: records.length,
        ...result
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
