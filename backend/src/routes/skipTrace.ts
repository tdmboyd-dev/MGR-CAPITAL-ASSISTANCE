/**
 * Skip Trace Routes — MGR CAPITAL ASSISTANCE
 * Owner/heir discovery via Tracerfy API
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { skipTraceService } from "../services/SkipTraceService.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * POST /api/skip-trace/person
 * Skip trace a single person
 */
router.post("/person", authenticate, async (req, res) => {
  try {
    const { person, enhanced } = req.body;

    if (!person || !person.firstName || !person.lastName) {
      return res.status(400).json({
        error: "Missing required fields: person.firstName, person.lastName",
      });
    }

    const result = await skipTraceService.tracePerson(person, enhanced || false);

    // Add lead score
    const score = skipTraceService.scoreResult(result);

    res.json({
      success: true,
      result: {
        ...result,
        leadScore: score,
      },
    });
  } catch (error: any) {
    logger.error("Skip trace failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skip-trace/batch
 * Batch skip trace multiple people
 */
router.post("/batch", authenticate, async (req, res) => {
  try {
    const { persons, enhanced } = req.body;

    if (!persons || !Array.isArray(persons) || persons.length === 0) {
      return res.status(400).json({
        error: "Missing required field: persons (array)",
      });
    }

    if (persons.length > 1000) {
      return res.status(400).json({
        error: "Batch size limited to 1000 records",
      });
    }

    const result = await skipTraceService.traceBatch(persons, enhanced || false);

    // Add lead scores to each result
    result.results = result.results.map((r) => ({
      ...r,
      leadScore: skipTraceService.scoreResult(r),
    }));

    res.json({
      success: true,
      batch: result,
    });
  } catch (error: any) {
    logger.error("Batch skip trace failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skip-trace/heirs
 * Find heirs of a deceased person
 */
router.post("/heirs", authenticate, async (req, res) => {
  try {
    const { deceasedPerson, maxGenerations } = req.body;

    if (!deceasedPerson || !deceasedPerson.firstName || !deceasedPerson.lastName) {
      return res.status(400).json({
        error: "Missing required fields: deceasedPerson.firstName, deceasedPerson.lastName",
      });
    }

    const result = await skipTraceService.findHeirs(
      deceasedPerson,
      maxGenerations || 2
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error("Heir search failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skip-trace/property
 * Find owners by property address
 */
router.post("/property", authenticate, async (req, res) => {
  try {
    const { address, city, state, zip } = req.body;

    if (!address || !city || !state) {
      return res.status(400).json({
        error: "Missing required fields: address, city, state",
      });
    }

    const results = await skipTraceService.traceByProperty(
      address,
      city,
      state,
      zip || ""
    );

    res.json({
      success: true,
      owners: results,
    });
  } catch (error: any) {
    logger.error("Property trace failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skip-trace/deceased-check
 * Check if a person is deceased
 */
router.post("/deceased-check", authenticate, async (req, res) => {
  try {
    const { person } = req.body;

    if (!person || !person.firstName || !person.lastName) {
      return res.status(400).json({
        error: "Missing required fields: person.firstName, person.lastName",
      });
    }

    const result = await skipTraceService.checkDeceasedStatus(person);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error("Deceased check failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skip-trace/batch-submit
 * Submit a batch trace to Tracerfy — results come via webhook
 */
router.post("/batch-submit", authenticate, async (req, res) => {
  try {
    const { persons, enhanced } = req.body;

    if (!persons || !Array.isArray(persons) || persons.length === 0) {
      return res.status(400).json({
        error: "Missing required field: persons (array)",
      });
    }

    if (persons.length > 1000) {
      return res.status(400).json({
        error: "Batch size limited to 1000 records",
      });
    }

    const result = await skipTraceService.submitBatchTrace(persons, enhanced || false);

    res.json({
      success: true,
      message: "Batch submitted to Tracerfy. Results will arrive via webhook.",
      ...result,
    });
  } catch (error: any) {
    logger.error("Batch submit failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/skip-trace/analytics
 * Get Tracerfy account analytics (balance, queues, etc.)
 */
router.get("/analytics", authenticate, async (_req, res) => {
  try {
    const analytics = await skipTraceService.getTracerfyAnalytics();
    res.json({ success: true, analytics });
  } catch (error: any) {
    logger.error("Analytics fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/skip-trace/status
 * Get service status and rate limits
 */
router.get("/status", authenticate, async (_req, res) => {
  const status = skipTraceService.getStatus();
  res.json(status);
});

export default router;
