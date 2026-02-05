/**
 * Master Settings API Routes - MGR Capital Assistance
 *
 * Centralized enable/disable toggles for ALL major system features.
 * FOUNDER/ADMIN ONLY - These routes control the entire system.
 *
 * Endpoints:
 * - GET    /api/settings/master           - Get all feature settings
 * - PATCH  /api/settings/master           - Update multiple settings
 * - POST   /api/settings/master/:key/toggle - Toggle a single feature
 */

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import prisma from "../lib/prisma.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import {
  masterSettingsService,
  MasterSettings,
  FeatureKey,
  FeatureKeys,
} from "../services/MasterSettingsService.js";

const router = Router();

// Valid feature keys for validation
const validFeatureKeys = Object.values(FeatureKeys);

/**
 * GET /api/settings/master - Get all master settings
 * Returns all feature toggles with metadata
 */
router.get(
  "/",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await masterSettingsService.getAll();
    const grouped = await masterSettingsService.getGroupedSettings();
    const metadata = masterSettingsService.getFeatureMetadata();

    res.json({
      success: true,
      data: {
        settings,
        grouped,
        metadata,
      },
    });
  })
);

/**
 * PATCH /api/settings/master - Update multiple settings
 * Accepts partial updates: { "auto_ingestion": false, "ai_bots": true }
 */
router.patch(
  "/",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const updates = req.body;

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      throw Errors.badRequest("At least one setting update is required");
    }

    // Validate all keys are valid feature keys
    const invalidKeys = Object.keys(updates).filter(
      (key) => !validFeatureKeys.includes(key as FeatureKey)
    );
    if (invalidKeys.length > 0) {
      throw Errors.badRequest(`Invalid feature keys: ${invalidKeys.join(", ")}`);
    }

    // Validate all values are booleans
    const invalidValues = Object.entries(updates).filter(
      ([, value]) => typeof value !== "boolean"
    );
    if (invalidValues.length > 0) {
      throw Errors.badRequest(
        `Invalid values (must be boolean): ${invalidValues.map(([k]) => k).join(", ")}`
      );
    }

    const result = await masterSettingsService.update(updates as Partial<MasterSettings>);

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "MASTER_SETTINGS_UPDATED",
        entityType: "FounderConfig",
        entityId: "master_settings",
        details: {
          updatedKeys: Object.keys(updates),
          newValues: updates,
        },
      },
    });

    res.json({
      success: true,
      message: `Updated ${Object.keys(updates).length} setting(s)`,
      data: result,
    });
  })
);

/**
 * POST /api/settings/master/:key/toggle - Toggle a single feature
 * Flips the boolean value for the specified feature
 */
router.post(
  "/:key/toggle",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { key } = req.params;

    // Validate key
    if (!validFeatureKeys.includes(key as FeatureKey)) {
      throw Errors.badRequest(`Invalid feature key: ${key}`);
    }

    const result = await masterSettingsService.toggleFeature(key as FeatureKey);

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "MASTER_SETTING_TOGGLED",
        entityType: "FounderConfig",
        entityId: "master_settings",
        details: {
          feature: key,
          newValue: result.enabled,
        },
      },
    });

    res.json({
      success: true,
      message: `Feature "${key}" is now ${result.enabled ? "ENABLED" : "DISABLED"}`,
      data: result,
    });
  })
);

/**
 * POST /api/settings/master/reset - Reset all settings to defaults
 * USE WITH CAUTION - enables all features
 */
router.post(
  "/reset",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await masterSettingsService.resetToDefaults();

    // Log the reset
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "MASTER_SETTINGS_RESET",
        entityType: "FounderConfig",
        entityId: "master_settings",
        details: {
          message: "All features reset to defaults (enabled)",
        },
      },
    });

    res.json({
      success: true,
      message: "All settings reset to defaults (all features enabled)",
      data: result,
    });
  })
);

/**
 * GET /api/settings/master/:key - Get a single setting value
 */
router.get(
  "/:key",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;

    // Validate key
    if (!validFeatureKeys.includes(key as FeatureKey)) {
      throw Errors.badRequest(`Invalid feature key: ${key}`);
    }

    const enabled = await masterSettingsService.get(key as FeatureKey);
    const metadata = masterSettingsService
      .getFeatureMetadata()
      .find((m) => m.key === key);

    res.json({
      success: true,
      data: {
        key,
        enabled,
        label: metadata?.label,
        description: metadata?.description,
        category: metadata?.category,
      },
    });
  })
);

export default router;
