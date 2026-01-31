/**
 * webhookRoutes.ts
 *
 * External partner lead receiver via webhooks.
 * Partners POST leads with a secret header, records are processed
 * through the ingestion pipeline and cases are auto-created.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { ingestionService } from "../services/ingestionService.js";
import { caseRoutingService } from "../services/CaseRoutingService.js";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

// =============================================================================
// RATE LIMITING (simple in-memory, 100 req/min per source)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(sourceId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sourceId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sourceId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= 100) {
    return false;
  }

  entry.count++;
  return true;
}

// =============================================================================
// WEBHOOK LEAD RECEIVER
// =============================================================================

/**
 * POST /api/webhooks/leads — Receive leads from external partners
 * Validates x-webhook-secret header against IngestionSource.webhookSecret
 */
router.post(
  "/leads",
  asyncHandler(async (req: Request, res: Response) => {
    const webhookSecret = req.headers["x-webhook-secret"] as string;

    if (!webhookSecret) {
      return res.status(401).json({ success: false, error: "Missing x-webhook-secret header" });
    }

    // Find source by webhook secret
    const source = await prisma.ingestionSource.findFirst({
      where: {
        type: "WEBHOOK",
        webhookSecret,
        isActive: true,
      },
    });

    if (!source) {
      return res.status(403).json({ success: false, error: "Invalid webhook secret" });
    }

    // Rate limit
    if (!checkRateLimit(source.id)) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded (100 req/min)" });
    }

    // Validate body
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: "records array is required and must not be empty" });
    }

    if (records.length > 500) {
      return res.status(400).json({ success: false, error: "Maximum 500 records per request" });
    }

    // Validate each record has minimum required fields
    const validRecords: Record<string, any>[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.ownerName && !r.propertyAddress) {
        validationErrors.push(`Record ${i}: must have at least ownerName or propertyAddress`);
        continue;
      }

      validRecords.push({
        ownerName: r.ownerName || null,
        propertyAddress: r.propertyAddress || null,
        state: r.state || source.state || null,
        county: r.county || source.county || null,
        surplusAmount: r.surplusAmount ? Math.round(parseFloat(r.surplusAmount) * 100) : null,
        parcelNumber: r.parcelNumber || null,
        rawData: r,
      });
    }

    if (validRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid records found",
        validationErrors,
      });
    }

    // Create batch and process
    const batchId = await ingestionService.createBatch(source.id, `webhook-${Date.now()}`);
    const result = await ingestionService.processBatch(batchId, validRecords);

    // Create autopilot run
    await prisma.autopilotRun.create({
      data: {
        sourceId: source.id,
        batchId,
        runType: "webhook",
        recordsParsed: validRecords.length,
        casesCreated: result.created,
        status: "completed",
        completedAt: new Date(),
        errors: validationErrors.length > 0 ? validationErrors : undefined,
      },
    });

    // Update source stats
    await prisma.ingestionSource.update({
      where: { id: source.id },
      data: {
        lastFetched: new Date(),
        totalFetches: { increment: 1 },
        totalCasesCreated: { increment: result.created },
        consecutiveErrors: 0,
      },
    });

    // Auto-route new cases
    let casesRouted = 0;
    const routingConfig = await caseRoutingService.getConfig();
    if (routingConfig.enabled && routingConfig.autoAssignOnIngestion) {
      const newRecords = await prisma.ingestionRecord.findMany({
        where: { batchId, caseId: { not: null } },
        select: { caseId: true },
      });
      const caseIds = newRecords.map((r) => r.caseId!).filter(Boolean);
      if (caseIds.length > 0) {
        const routeResult = await caseRoutingService.autoAssignBatch(caseIds);
        casesRouted = routeResult.assigned;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        batchId,
        recordsReceived: records.length,
        recordsValid: validRecords.length,
        casesCreated: result.created,
        casesRouted,
        skipped: result.skipped,
        errors: result.errors,
        validationErrors,
      },
    });
  })
);

// =============================================================================
// WEBHOOK REGISTRATION (FOUNDER ONLY)
// =============================================================================

/**
 * POST /api/webhooks/leads/register — Create a new webhook partner source
 * Generates a unique webhook secret
 */
router.post(
  "/leads/register",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, state, county, description } = req.body;

    if (!name || !state) {
      throw Errors.badRequest("name and state are required");
    }

    // Generate a unique webhook secret
    const webhookSecret = `whk_${crypto.randomBytes(32).toString("hex")}`;

    const source = await prisma.ingestionSource.create({
      data: {
        name,
        type: "WEBHOOK",
        state,
        county: county || null,
        webhookSecret,
        isActive: true,
        parserConfig: description ? { description } : undefined,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "WEBHOOK_SOURCE_CREATED",
        entityType: "INGESTION_SOURCE",
        entityId: source.id,
        details: { name, state, county },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        sourceId: source.id,
        webhookSecret,
        endpoint: "/api/webhooks/leads",
        instructions: {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-secret": webhookSecret },
          body: {
            records: [
              {
                ownerName: "string (required)",
                propertyAddress: "string",
                state: "string (2-letter code)",
                county: "string",
                surplusAmount: "number (in dollars)",
              },
            ],
          },
        },
      },
    });
  })
);

/**
 * GET /api/webhooks/leads/sources — List all webhook sources
 */
router.get(
  "/leads/sources",
  authMiddleware,
  roleGuard(["ADMIN"]),
  asyncHandler(async (_req: Request, res: Response) => {
    const sources = await prisma.ingestionSource.findMany({
      where: { type: "WEBHOOK" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        state: true,
        county: true,
        isActive: true,
        lastFetched: true,
        totalFetches: true,
        totalCasesCreated: true,
        consecutiveErrors: true,
        createdAt: true,
      },
    });

    res.json({ success: true, count: sources.length, data: sources });
  })
);

export default router;
