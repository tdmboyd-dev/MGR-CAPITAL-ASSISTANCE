/**
 * activityRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for employee activity tracking and violation management.
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { activityTrackingService, ActivityType } from "../services/ActivityTrackingService.js";

const router = Router();

/**
 * POST /api/activity/log — Log an activity
 */
router.post(
  "/log",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { activityType, caseId, details } = req.body;

    if (!activityType) {
      throw Errors.badRequest("activityType required");
    }

    const validTypes: ActivityType[] = [
      'login', 'case_view', 'case_note', 'case_document',
      'case_call', 'client_message', 'training', 'notary_session'
    ];

    if (!validTypes.includes(activityType)) {
      throw Errors.badRequest(`Invalid activityType. Must be one of: ${validTypes.join(', ')}`);
    }

    const activity = await activityTrackingService.logActivity({
      employeeId: req.user!.id,
      activityType,
      caseId,
      details,
    });

    res.json({ success: true, data: activity });
  })
);

/**
 * GET /api/activity/my-stats — Get employee's activity stats
 */
router.get(
  "/my-stats",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await activityTrackingService.getEmployeeStats(req.user!.id);

    res.json({
      success: true,
      data: {
        ...stats,
        // Friendly messages
        weeklyStatus: stats.isCompliant
          ? `Great job! You've been active ${stats.activeDaysThisWeek} days this week.`
          : `Warning: Only ${stats.activeDaysThisWeek}/${stats.activeDaysRequired} active days this week.`,
        violationStatus: stats.isSuspended
          ? 'Account suspended due to repeated violations. Contact support.'
          : stats.isInRecovery
            ? 'In recovery mode. Complete requirements to restore your tier.'
            : stats.unresolvedViolations > 0
              ? `${stats.unresolvedViolations} unresolved violation(s). Work to recover!`
              : 'No violations. Keep up the good work!',
      },
    });
  })
);

/**
 * POST /api/activity/recovery/check — Check and process tier recovery
 */
router.post(
  "/recovery/check",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await activityTrackingService.processRecovery(req.user!.id);
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/activity/recovery/progress — Get recovery progress
 */
router.get(
  "/recovery/progress",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const progress = await activityTrackingService.getRecoveryProgress(req.user!.id);

    res.json({
      success: true,
      data: {
        ...progress,
        activeDaysRemaining: Math.max(0, progress.activeDaysRequired - progress.activeDaysCompleted),
        casesRemaining: Math.max(0, progress.casesRequired - progress.casesCompleted),
        percentComplete: Math.round(
          ((progress.activeDaysCompleted + progress.casesCompleted) /
            (progress.activeDaysRequired + progress.casesRequired)) * 100
        ),
      },
    });
  })
);

// ============================================
// ADMIN/FOUNDER ROUTES
// ============================================

/**
 * GET /api/activity/employees/:employeeId — Get specific employee stats (ADMIN/FOUNDER)
 */
router.get(
  "/employees/:employeeId",
  authMiddleware,
  roleGuard(["ADMIN", "FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId } = req.params;
    const stats = await activityTrackingService.getEmployeeStats(employeeId);
    res.json({ success: true, data: stats });
  })
);

/**
 * POST /api/activity/check/weekly — Run weekly violation check (FOUNDER/CRON)
 */
router.post(
  "/check/weekly",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const violations = await activityTrackingService.checkWeeklyViolations();

    res.json({
      success: true,
      data: {
        violationsCreated: violations.length,
        violations: violations.map(v => ({
          employeeId: v.employeeId,
          type: v.violationType,
          description: v.description,
          tierDemotion: `${v.tierBefore} → ${v.tierAfter}`,
        })),
      },
    });
  })
);

/**
 * POST /api/activity/check/cases — Run case inactivity check (FOUNDER/CRON)
 */
router.post(
  "/check/cases",
  authMiddleware,
  roleGuard(["FOUNDER"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const violations = await activityTrackingService.checkCaseInactivityViolations();

    res.json({
      success: true,
      data: {
        violationsCreated: violations.length,
        violations: violations.map(v => ({
          employeeId: v.employeeId,
          caseId: v.caseId,
          type: v.violationType,
          description: v.description,
        })),
      },
    });
  })
);

export default router;
