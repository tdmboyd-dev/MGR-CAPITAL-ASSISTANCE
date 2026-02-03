/**
 * surplusRequirementsRoutes.ts — MGR CAPITAL ASSISTANCE
 *
 * Routes for county-specific asset recovery requirements.
 * Uses SHADOW TERMINOLOGY for non-founders.
 *
 * INTERNAL: "surplus" → PUBLIC: "asset recovery proceeds"
 */

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";
import { countySurplusRequirementsService, CountyRequirements } from "../services/CountySurplusRequirementsService.js";
import { sanitizeForPublic, getPublicDocumentName } from "../utils/shadowTerminology.js";

const router = Router();

/**
 * Sanitize requirements for non-founders
 * Hides words like "surplus", "excess proceeds", etc.
 */
function sanitizeRequirements(requirements: CountyRequirements, isFounder: boolean): any {
  if (isFounder) {
    return requirements;
  }

  // Clone and sanitize for employees/clients
  return {
    state: requirements.state,
    county: requirements.county,
    notarizationRequired: requirements.notarizationRequired,
    notarizationDetails: requirements.notarizationDetails.map(d => sanitizeForPublic(d)),
    formsRequired: requirements.formsRequired.map(f => ({
      name: getPublicDocumentName(f.name),
      description: sanitizeForPublic(f.description),
      notarized: f.notarized,
      templateUrl: f.templateUrl,
    })),
    poaRequired: requirements.poaRequired,
    poaDetails: sanitizeForPublic(requirements.poaDetails),
    heirshipAffidavitRequired: requirements.heirshipAffidavitRequired,
    heirshipDetails: sanitizeForPublic(requirements.heirshipDetails),
    filingMethod: requirements.filingMethod,
    filingAddress: requirements.filingAddress,
    filingEmail: requirements.filingEmail,
    filingPortalUrl: requirements.filingPortalUrl,
    deadlineType: requirements.deadlineType,
    deadlineDays: requirements.deadlineDays,
    deadlineNotes: requirements.deadlineNotes ? sanitizeForPublic(requirements.deadlineNotes) : undefined,
    minimumClaimAmount: requirements.minimumClaimAmount,
    smallClaimThreshold: requirements.smallClaimThreshold,
    clerkOfficePhone: requirements.clerkOfficePhone,
    clerkOfficeEmail: requirements.clerkOfficeEmail,
    clerkOfficeAddress: requirements.clerkOfficeAddress,
    additionalRequirements: requirements.additionalRequirements.map(r => sanitizeForPublic(r)),
    notes: sanitizeForPublic(requirements.notes),
    lastVerified: requirements.lastVerified,
  };
}

/**
 * GET /api/recovery-requirements/:state/:county — Get county requirements
 * NOTE: Route path uses "recovery" not "surplus" for shadow compliance
 */
router.get(
  "/:state/:county",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, county } = req.params;
    const requirements = countySurplusRequirementsService.getRequirements(state, county);

    if (!requirements) {
      throw Errors.notFound(`Requirements not found for ${county}, ${state}`);
    }

    const isFounder = req.user?.role === "FOUNDER";
    const sanitized = sanitizeRequirements(requirements, isFounder);

    res.json({ success: true, data: sanitized });
  })
);

/**
 * GET /api/recovery-requirements/tennessee — Get all Tennessee counties
 */
router.get(
  "/tennessee",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const counties = countySurplusRequirementsService.getTennesseeCounties();
    const isFounder = req.user?.role === "FOUNDER";

    const sanitized = counties.map(c => sanitizeRequirements(c, isFounder));

    res.json({ success: true, data: sanitized });
  })
);

/**
 * GET /api/recovery-requirements/deadlines — Get all state deadlines
 */
router.get(
  "/deadlines",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const deadlines = countySurplusRequirementsService.getStateDeadlines();
    const isFounder = req.user?.role === "FOUNDER";

    // Sanitize notes for non-founders
    const sanitized: Record<string, { days: number; notes: string }> = {};
    for (const [state, data] of Object.entries(deadlines)) {
      sanitized[state] = {
        days: data.days,
        notes: isFounder ? data.notes : sanitizeForPublic(data.notes),
      };
    }

    res.json({ success: true, data: sanitized });
  })
);

/**
 * POST /api/recovery-requirements/check-deadline — Check deadline for a case
 */
router.post(
  "/check-deadline",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, saleDate } = req.body;

    if (!state || !saleDate) {
      throw Errors.badRequest("state and saleDate required");
    }

    const deadline = countySurplusRequirementsService.checkDeadline(state, saleDate);
    res.json({ success: true, data: deadline });
  })
);

/**
 * POST /api/recovery-requirements/checklist — Generate claim checklist
 */
router.post(
  "/checklist",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, county, isDeceased, hasAgent, claimAmount, saleDate } = req.body;

    if (!state || !county || !saleDate) {
      throw Errors.badRequest("state, county, and saleDate required");
    }

    const checklist = countySurplusRequirementsService.generateClaimChecklist(
      state,
      county,
      {
        isDeceased: isDeceased || false,
        hasAgent: hasAgent !== false,
        claimAmount: claimAmount || 0,
        saleDate,
      }
    );

    const isFounder = req.user?.role === "FOUNDER";

    // Sanitize document names for non-founders
    if (!isFounder) {
      checklist.documents = checklist.documents.map(d => ({
        ...d,
        name: getPublicDocumentName(sanitizeForPublic(d.name)),
      }));
      checklist.notes = checklist.notes.map(n => sanitizeForPublic(n));
    }

    res.json({ success: true, data: checklist });
  })
);

/**
 * POST /api/recovery-requirements/documents — Get required documents list
 */
router.post(
  "/documents",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { state, county, isDeceased, hasAgent } = req.body;

    if (!state || !county) {
      throw Errors.badRequest("state and county required");
    }

    const documents = countySurplusRequirementsService.getRequiredDocuments(
      state,
      county,
      isDeceased || false,
      hasAgent !== false
    );

    const isFounder = req.user?.role === "FOUNDER";

    // Sanitize for non-founders
    const sanitized = isFounder
      ? documents
      : documents.map(d => getPublicDocumentName(sanitizeForPublic(d)));

    res.json({ success: true, data: sanitized });
  })
);

export default router;
