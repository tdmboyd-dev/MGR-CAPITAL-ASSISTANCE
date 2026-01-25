/**
 * State Deadline Service — MGR CAPITAL ASSISTANCE
 * Auto-calculates critical deadlines based on state laws
 *
 * CRITICAL: Missing a deadline = forfeit all rights to surplus
 * This service ensures we NEVER miss a filing deadline
 */

import { logger } from "../utils/logger.js";

export interface StateRule {
  stateCode: string;
  stateName: string;
  // Claim deadlines
  claimDeadlineDays: number | null; // Days from auction/notice, null = no limit
  claimDeadlineFrom: "auction" | "notice" | "deed_recording" | "disbursement_notice";
  // Filing requirements
  requiresPreAuctionFiling: boolean;
  preAuctionDeadlineDate?: string; // e.g., "July 1"
  // License requirements
  requiresPILicense: boolean;
  requiresBonding: boolean;
  bondingAmount?: number;
  requiresAttorneyForThirdParty: boolean;
  // Special rules
  allowsAssignmentOfInterest: boolean;
  courtApprovalRequired: boolean;
  notaryRequired: boolean;
  w9Required: boolean;
  // Notes
  notes: string[];
}

export interface Deadline {
  id: string;
  caseId: string;
  type: "claim_filing" | "pre_auction_notice" | "response_required" | "hearing" | "appeal" | "custom";
  description: string;
  dueDate: Date;
  state: string;
  status: "upcoming" | "due_soon" | "overdue" | "completed";
  reminderSent: boolean;
  completedAt?: Date;
  priority: "low" | "medium" | "high" | "critical";
}

// State rules database
const STATE_RULES: Record<string, StateRule> = {
  FL: {
    stateCode: "FL",
    stateName: "Florida",
    claimDeadlineDays: 120,
    claimDeadlineFrom: "disbursement_notice",
    requiresPreAuctionFiling: false,
    requiresPILicense: true,
    requiresBonding: true,
    bondingAmount: 500000,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Class A PI license required for surplus trustees",
      "Lienholders: 120 days from Notice of Surplus (strict)",
      "Former owners: Much longer/unlimited timeframe",
      "Processing time: 4-7 months",
      "Most competitive state for surplus recovery",
    ],
  },
  MI: {
    stateCode: "MI",
    stateName: "Michigan",
    claimDeadlineDays: 60,
    claimDeadlineFrom: "notice",
    requiresPreAuctionFiling: true,
    preAuctionDeadlineDate: "July 1",
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "CRITICAL: Must file Notice of Intent BEFORE auction (by July 1)",
      "Motion to Claim within 60 days of receiving surplus notice",
      "Circuit Court approval required",
      "Missing pre-auction deadline = FORFEIT ALL RIGHTS",
    ],
  },
  CA: {
    stateCode: "CA",
    stateName: "California",
    claimDeadlineDays: 365,
    claimDeadlineFrom: "deed_recording",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: false,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "1 year from deed recording (NO EXCEPTIONS)",
      "Award challenges: 90 days after decision",
      "Tax Collector handles distribution",
      "Revenue & Taxation Code Section 4675",
    ],
  },
  GA: {
    stateCode: "GA",
    stateName: "Georgia",
    claimDeadlineDays: null,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: true,
    allowsAssignmentOfInterest: false,
    courtApprovalRequired: false,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Only licensed attorneys can represent third parties",
      "Tax Commissioner holds funds in escrow",
      "Minimum 60-day notice period when multiple claimants",
      "State bar number required for attorney verification",
    ],
  },
  TX: {
    stateCode: "TX",
    stateName: "Texas",
    claimDeadlineDays: 730, // 2 years for constable, 4 years for sheriff
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Constable sales: 2-year deadline",
      "Sheriff sales: 4-year deadline",
      "Property Code Chapter 34 governs surplus",
      "Claims through District Clerk",
    ],
  },
  NC: {
    stateCode: "NC",
    stateName: "North Carolina",
    claimDeadlineDays: null,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Clerk of Superior Court handles claims",
      "Assignment agreements scrutinized for fairness",
      "Processing time: 30-90 days",
      "Verified Motion/Petition + notarized affidavit required",
    ],
  },
  OH: {
    stateCode: "OH",
    stateName: "Ohio",
    claimDeadlineDays: 365,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "1-year statute of limitations",
      "County Auditor or Court handles distribution",
      "Junior lienholders have priority",
    ],
  },
  PA: {
    stateCode: "PA",
    stateName: "Pennsylvania",
    claimDeadlineDays: null,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Tax Claim Bureau handles surplus",
      "No specific deadline but funds eventually escheat",
      "Proof of ownership required",
    ],
  },
  NJ: {
    stateCode: "NJ",
    stateName: "New Jersey",
    claimDeadlineDays: null,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: false,
    courtApprovalRequired: false,
    notaryRequired: false,
    w9Required: true,
    notes: [
      "Limited surplus opportunities",
      "Tax sale certificate system (not deed)",
      "2-year redemption period",
    ],
  },
  NY: {
    stateCode: "NY",
    stateName: "New York",
    claimDeadlineDays: null,
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: true,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "Very limited surplus (most goes to municipality)",
      "In Rem foreclosure process",
      "Stringent requirements vary by county",
    ],
  },
  LA: {
    stateCode: "LA",
    stateName: "Louisiana",
    claimDeadlineDays: 1095, // 3 years
    claimDeadlineFrom: "auction",
    requiresPreAuctionFiling: false,
    requiresPILicense: false,
    requiresBonding: false,
    requiresAttorneyForThirdParty: false,
    allowsAssignmentOfInterest: true,
    courtApprovalRequired: false,
    notaryRequired: true,
    w9Required: true,
    notes: [
      "2025 law change: Moving to bid-down interest rate model",
      "3-year prescriptive period",
      "Parish handles tax sales",
    ],
  },
};

// States that DO NOT have tax sale surplus (avoid these)
const NO_SURPLUS_STATES = [
  "AL", // Alabama (changing 2024)
  "AZ", // Arizona
  "CO", // Colorado
  "IL", // Illinois
  "ME", // Maine
  "MA", // Massachusetts
  "MN", // Minnesota
  "NE", // Nebraska
  "OR", // Oregon
  "SD", // South Dakota
  "DC", // District of Columbia
];

class StateDeadlineService {
  private deadlines: Map<string, Deadline> = new Map();

  /**
   * Get state rules
   */
  getStateRules(stateCode: string): StateRule | null {
    return STATE_RULES[stateCode.toUpperCase()] || null;
  }

  /**
   * Get all state rules
   */
  getAllStateRules(): StateRule[] {
    return Object.values(STATE_RULES);
  }

  /**
   * Check if state has surplus opportunities
   */
  hasSurplusOpportunities(stateCode: string): boolean {
    return !NO_SURPLUS_STATES.includes(stateCode.toUpperCase());
  }

  /**
   * Get states without surplus
   */
  getNoSurplusStates(): string[] {
    return [...NO_SURPLUS_STATES];
  }

  /**
   * Calculate claim deadline for a case
   */
  calculateDeadline(
    stateCode: string,
    referenceDate: Date,
    caseId: string
  ): Deadline | null {
    const rules = this.getStateRules(stateCode);
    if (!rules || !rules.claimDeadlineDays) {
      return null; // No deadline or unknown state
    }

    const dueDate = new Date(referenceDate);
    dueDate.setDate(dueDate.getDate() + rules.claimDeadlineDays);

    const deadline: Deadline = {
      id: `dl_${caseId}_claim`,
      caseId,
      type: "claim_filing",
      description: `Claim filing deadline for ${rules.stateName} (${rules.claimDeadlineDays} days from ${rules.claimDeadlineFrom.replace("_", " ")})`,
      dueDate,
      state: stateCode,
      status: this.calculateStatus(dueDate),
      reminderSent: false,
      priority: this.calculatePriority(dueDate),
    };

    this.deadlines.set(deadline.id, deadline);
    return deadline;
  }

  /**
   * Calculate Michigan pre-auction deadline (special case)
   */
  calculateMichiganPreAuction(auctionYear: number, caseId: string): Deadline {
    const dueDate = new Date(auctionYear, 6, 1); // July 1

    const deadline: Deadline = {
      id: `dl_${caseId}_mi_preauction`,
      caseId,
      type: "pre_auction_notice",
      description: "Michigan Notice of Intent deadline (MUST file before auction)",
      dueDate,
      state: "MI",
      status: this.calculateStatus(dueDate),
      reminderSent: false,
      priority: "critical",
    };

    this.deadlines.set(deadline.id, deadline);
    return deadline;
  }

  /**
   * Get all deadlines for a case
   */
  getCaseDeadlines(caseId: string): Deadline[] {
    const deadlines: Deadline[] = [];
    this.deadlines.forEach((deadline) => {
      if (deadline.caseId === caseId) {
        deadlines.push(deadline);
      }
    });
    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get all upcoming deadlines
   */
  getUpcomingDeadlines(daysAhead: number = 30): Deadline[] {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const upcoming: Deadline[] = [];
    this.deadlines.forEach((deadline) => {
      if (
        deadline.status !== "completed" &&
        deadline.dueDate >= now &&
        deadline.dueDate <= cutoff
      ) {
        upcoming.push(deadline);
      }
    });

    return upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get overdue deadlines
   */
  getOverdueDeadlines(): Deadline[] {
    const overdue: Deadline[] = [];
    this.deadlines.forEach((deadline) => {
      if (deadline.status === "overdue") {
        overdue.push(deadline);
      }
    });
    return overdue.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get critical deadlines (due within 7 days)
   */
  getCriticalDeadlines(): Deadline[] {
    return this.getUpcomingDeadlines(7);
  }

  /**
   * Mark deadline as completed
   */
  completeDeadline(deadlineId: string): boolean {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) return false;

    deadline.status = "completed";
    deadline.completedAt = new Date();
    return true;
  }

  /**
   * Add custom deadline
   */
  addCustomDeadline(
    caseId: string,
    description: string,
    dueDate: Date,
    state: string,
    type: Deadline["type"] = "custom"
  ): Deadline {
    const deadline: Deadline = {
      id: `dl_${caseId}_${Date.now()}`,
      caseId,
      type,
      description,
      dueDate,
      state,
      status: this.calculateStatus(dueDate),
      reminderSent: false,
      priority: this.calculatePriority(dueDate),
    };

    this.deadlines.set(deadline.id, deadline);
    return deadline;
  }

  /**
   * Calculate days remaining
   */
  getDaysRemaining(deadline: Deadline): number {
    const now = new Date();
    const diffTime = deadline.dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate reminder schedule for a deadline
   */
  getReminderSchedule(deadline: Deadline): Date[] {
    const reminders: Date[] = [];
    const dueDate = deadline.dueDate;

    // 30 days before
    const thirtyDays = new Date(dueDate);
    thirtyDays.setDate(thirtyDays.getDate() - 30);
    if (thirtyDays > new Date()) reminders.push(thirtyDays);

    // 14 days before
    const fourteenDays = new Date(dueDate);
    fourteenDays.setDate(fourteenDays.getDate() - 14);
    if (fourteenDays > new Date()) reminders.push(fourteenDays);

    // 7 days before
    const sevenDays = new Date(dueDate);
    sevenDays.setDate(sevenDays.getDate() - 7);
    if (sevenDays > new Date()) reminders.push(sevenDays);

    // 3 days before
    const threeDays = new Date(dueDate);
    threeDays.setDate(threeDays.getDate() - 3);
    if (threeDays > new Date()) reminders.push(threeDays);

    // 1 day before
    const oneDay = new Date(dueDate);
    oneDay.setDate(oneDay.getDate() - 1);
    if (oneDay > new Date()) reminders.push(oneDay);

    // Day of
    if (dueDate > new Date()) reminders.push(dueDate);

    return reminders;
  }

  /**
   * Get state compliance checklist
   */
  getComplianceChecklist(stateCode: string): {
    item: string;
    required: boolean;
    completed: boolean;
  }[] {
    const rules = this.getStateRules(stateCode);
    if (!rules) return [];

    return [
      {
        item: "PI License",
        required: rules.requiresPILicense,
        completed: false,
      },
      {
        item: `Bonding ($${rules.bondingAmount?.toLocaleString() || "0"})`,
        required: rules.requiresBonding,
        completed: false,
      },
      {
        item: "Attorney Representation",
        required: rules.requiresAttorneyForThirdParty,
        completed: false,
      },
      {
        item: "Pre-Auction Filing",
        required: rules.requiresPreAuctionFiling,
        completed: false,
      },
      {
        item: "Notarization",
        required: rules.notaryRequired,
        completed: false,
      },
      {
        item: "W-9 Form",
        required: rules.w9Required,
        completed: false,
      },
      {
        item: "Court Approval",
        required: rules.courtApprovalRequired,
        completed: false,
      },
      {
        item: "Assignment of Interest",
        required: false, // Optional but recommended
        completed: false,
      },
    ].filter((item) => item.required);
  }

  // Private helpers

  private calculateStatus(dueDate: Date): Deadline["status"] {
    const now = new Date();
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysRemaining < 0) return "overdue";
    if (daysRemaining <= 7) return "due_soon";
    return "upcoming";
  }

  private calculatePriority(dueDate: Date): Deadline["priority"] {
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysRemaining < 0) return "critical";
    if (daysRemaining <= 3) return "critical";
    if (daysRemaining <= 7) return "high";
    if (daysRemaining <= 14) return "medium";
    return "low";
  }

  /**
   * Update all deadline statuses (call periodically)
   */
  refreshStatuses(): void {
    this.deadlines.forEach((deadline) => {
      if (deadline.status !== "completed") {
        deadline.status = this.calculateStatus(deadline.dueDate);
        deadline.priority = this.calculatePriority(deadline.dueDate);
      }
    });
  }
}

// Export singleton
export const stateDeadlineService = new StateDeadlineService();
export type { StateDeadlineService };
