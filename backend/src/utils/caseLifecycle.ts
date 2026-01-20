// ============================================
// CASE LIFECYCLE — MGR CAPITAL ASSISTANCE
// State machine for case status transitions
// ============================================

import { CaseStatus } from "@prisma/client";

/**
 * Valid status transitions
 * Each status maps to an array of statuses it can transition TO
 */
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["CONTACTED", "REJECTED", "CLOSED"],
  CONTACTED: ["DOCS_PENDING", "REJECTED", "CLOSED"],
  DOCS_PENDING: ["DOCS_SIGNED", "CONTACTED", "REJECTED", "CLOSED"],
  DOCS_SIGNED: ["FILED", "DOCS_PENDING", "REJECTED", "CLOSED"],
  FILED: ["AWAITING_FUNDS", "REJECTED", "CLOSED"],
  AWAITING_FUNDS: ["PAID", "FILED", "REJECTED", "CLOSED"],
  PAID: ["CLOSED"], // Paid is terminal except for closing
  CLOSED: [], // Terminal state - no transitions allowed
  REJECTED: ["NEW", "CLOSED"] // Can be reopened or permanently closed
};

/**
 * Transition requirements
 * Conditions that must be met for certain transitions
 */
interface TransitionRequirement {
  check: (caseData: any) => boolean;
  errorMessage: string;
}

const TRANSITION_REQUIREMENTS: Record<string, TransitionRequirement[]> = {
  // Transitioning to FILED requires documents to be signed
  "DOCS_SIGNED->FILED": [
    {
      check: (caseData) => {
        if (!caseData.documents || caseData.documents.length === 0) return false;
        // At minimum, AUTHORIZATION must be signed
        const authDoc = caseData.documents.find((d: any) => d.type === "AUTHORIZATION");
        return authDoc?.status === "SIGNED";
      },
      errorMessage: "Authorization document must be signed before filing"
    }
  ],

  // Transitioning to PAID requires actual fee calculation
  "AWAITING_FUNDS->PAID": [
    {
      check: (caseData) => caseData.surplusAmountCents > 0,
      errorMessage: "Surplus amount must be recorded before marking as paid"
    },
    {
      check: (caseData) => caseData.actualFeeCents > 0,
      errorMessage: "Actual fee must be calculated before marking as paid"
    }
  ],

  // Transitioning to AWAITING_FUNDS requires filing date
  "FILED->AWAITING_FUNDS": [
    {
      check: (caseData) => !!caseData.filedAt,
      errorMessage: "Filing date must be recorded"
    }
  ]
};

/**
 * Validate if a status transition is allowed
 */
export function isValidTransition(
  currentStatus: CaseStatus,
  newStatus: CaseStatus
): boolean {
  if (currentStatus === newStatus) return true; // No-op is always valid
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get list of valid next statuses from current status
 */
export function getValidNextStatuses(currentStatus: CaseStatus): CaseStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Validate transition with full case data (checks requirements)
 */
export function validateTransition(
  currentStatus: CaseStatus,
  newStatus: CaseStatus,
  caseData: any
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if transition is valid
  if (!isValidTransition(currentStatus, newStatus)) {
    errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`);
    return { valid: false, errors, warnings };
  }

  // Check transition requirements
  const transitionKey = `${currentStatus}->${newStatus}`;
  const requirements = TRANSITION_REQUIREMENTS[transitionKey];

  if (requirements) {
    for (const req of requirements) {
      if (!req.check(caseData)) {
        errors.push(req.errorMessage);
      }
    }
  }

  // Add warnings for certain transitions
  if (newStatus === "REJECTED") {
    warnings.push("Case is being rejected. Ensure rejection reason is documented.");
  }

  if (newStatus === "CLOSED" && currentStatus !== "PAID") {
    warnings.push("Closing case without completion. Ensure this is intentional.");
  }

  if (newStatus === "PAID" && !caseData.fundsDisbursedAt) {
    warnings.push("Consider recording disbursement date.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    NEW: "New Lead",
    CONTACTED: "Client Contacted",
    DOCS_PENDING: "Documents Pending",
    DOCS_SIGNED: "Documents Signed",
    FILED: "Claim Filed",
    AWAITING_FUNDS: "Awaiting Funds",
    PAID: "Paid & Complete",
    CLOSED: "Closed",
    REJECTED: "Rejected/On Hold"
  };
  return labels[status] || status;
}

/**
 * Get status progression percentage (for progress bars)
 */
export function getStatusProgress(status: CaseStatus): number {
  const progress: Record<CaseStatus, number> = {
    NEW: 10,
    CONTACTED: 20,
    DOCS_PENDING: 35,
    DOCS_SIGNED: 50,
    FILED: 70,
    AWAITING_FUNDS: 85,
    PAID: 100,
    CLOSED: 100,
    REJECTED: 0
  };
  return progress[status] ?? 0;
}

/**
 * Check if status is terminal (no further progression)
 */
export function isTerminalStatus(status: CaseStatus): boolean {
  return status === "PAID" || status === "CLOSED";
}

/**
 * Check if status requires urgent attention
 */
export function isUrgentStatus(status: CaseStatus): boolean {
  return status === "AWAITING_FUNDS" || status === "FILED";
}

/**
 * Get auto-update fields when transitioning to a status
 */
export function getAutoUpdateFields(
  newStatus: CaseStatus
): Record<string, any> {
  const updates: Record<CaseStatus, Record<string, any>> = {
    NEW: {},
    CONTACTED: { contactedAt: new Date() },
    DOCS_PENDING: {},
    DOCS_SIGNED: {},
    FILED: { filedAt: new Date() },
    AWAITING_FUNDS: {},
    PAID: { fundsDisbursedAt: new Date() },
    CLOSED: { closedAt: new Date() },
    REJECTED: {}
  };
  return updates[newStatus] || {};
}
