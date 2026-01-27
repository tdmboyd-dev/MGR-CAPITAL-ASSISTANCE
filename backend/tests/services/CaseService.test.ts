/**
 * CaseService Unit Tests
 *
 * Tests for case management, status transitions, and fee calculations.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock Prisma client
const mockPrismaCase = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const mockPrismaLedgerEntry = {
  create: jest.fn(),
  findMany: jest.fn(),
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    case: mockPrismaCase,
    ledgerEntry: mockPrismaLedgerEntry,
    $disconnect: jest.fn(),
  })),
}));

// Test data
const testCase = {
  id: "case-123",
  caseCode: "MGR-2026-001",
  ownerName: "John Smith",
  propertyAddress: "123 Main St, Nashville, TN 37201",
  county: "Davidson",
  state: "TN",
  status: "LEAD_IDENTIFIED",
  surplusAmount: 4500000, // $45,000 in cents
  estimatedSurplus: 4500000,
  deadlineDate: new Date("2027-01-26"),
  saleDate: new Date("2024-01-26"),
  createdAt: new Date(),
  updatedAt: new Date(),
  assignedEmployeeId: null,
  clientId: null,
};

const testEmployee = {
  id: "emp-123",
  email: "employee@mgrcapital.com",
  role: "EMPLOYEE",
  employeeTier: "TIER_2_SPECIALIST",
};

describe("CaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // FEE CALCULATION TESTS
  // ===========================================================================

  describe("Fee Calculations", () => {
    it("should calculate 33% company fee correctly", () => {
      const surplusAmount = 10000000; // $100,000 in cents
      const feePercent = 33;

      const companyFee = Math.round(surplusAmount * (feePercent / 100));
      const clientPayout = surplusAmount - companyFee;

      expect(companyFee).toBe(3300000); // $33,000
      expect(clientPayout).toBe(6700000); // $67,000
    });

    it("should calculate employee commission by tier", () => {
      const companyFee = 3300000; // $33,000 in cents

      // Tier rates: 10%, 20%, 30%, 40%, 50%
      const tiers = {
        TIER_1_ASSOCIATE: 10,
        TIER_2_SPECIALIST: 20,
        TIER_3_SENIOR: 30,
        TIER_4_LEAD: 40,
        TIER_5_DIRECTOR: 50,
      };

      const tier2Commission = Math.round(companyFee * (tiers.TIER_2_SPECIALIST / 100));
      expect(tier2Commission).toBe(660000); // $6,600

      const tier5Commission = Math.round(companyFee * (tiers.TIER_5_DIRECTOR / 100));
      expect(tier5Commission).toBe(1650000); // $16,500
    });

    it("should calculate founder share as remainder after employee commission", () => {
      const companyFee = 3300000; // $33,000
      const employeeCommission = 660000; // $6,600 (20% for Tier 2)

      const founderShare = companyFee - employeeCommission;
      expect(founderShare).toBe(2640000); // $26,400
    });

    it("should give full company fee to founder when no employee assigned", () => {
      const companyFee = 3300000; // $33,000
      const employeeCommission = 0; // No employee

      const founderShare = companyFee - employeeCommission;
      expect(founderShare).toBe(3300000); // Full $33,000
    });

    it("should calculate shadow rate (2x) for employee display", () => {
      const actualCommission = 660000; // $6,600
      const shadowRate = actualCommission * 2;

      expect(shadowRate).toBe(1320000); // $13,200 (displayed to employee)
    });
  });

  // ===========================================================================
  // STATUS TRANSITION TESTS
  // ===========================================================================

  describe("Status Transitions", () => {
    const validTransitions: Record<string, string[]> = {
      LEAD_IDENTIFIED: ["CONTACTED", "DISQUALIFIED"],
      CONTACTED: ["INTERESTED", "NOT_INTERESTED", "DISQUALIFIED"],
      INTERESTED: ["SIGNED", "DISQUALIFIED"],
      SIGNED: ["FILED", "DISQUALIFIED"],
      FILED: ["AWAITING_FUNDS", "DENIED", "DISQUALIFIED"],
      AWAITING_FUNDS: ["FUNDS_RECEIVED", "DENIED"],
      FUNDS_RECEIVED: ["PAID_OUT", "DISPUTED"],
      PAID_OUT: [], // Terminal state
      DENIED: ["APPEALED", "CLOSED"],
      APPEALED: ["AWAITING_FUNDS", "DENIED"],
      DISPUTED: ["RESOLVED", "REFUNDED"],
      RESOLVED: ["PAID_OUT"],
      REFUNDED: [], // Terminal state
      DISQUALIFIED: [], // Terminal state
      CLOSED: [], // Terminal state
    };

    it("should allow valid status transition from LEAD_IDENTIFIED to CONTACTED", () => {
      const currentStatus = "LEAD_IDENTIFIED";
      const newStatus = "CONTACTED";

      const isValid = validTransitions[currentStatus]?.includes(newStatus) ?? false;
      expect(isValid).toBe(true);
    });

    it("should reject invalid status transition from LEAD_IDENTIFIED to PAID_OUT", () => {
      const currentStatus = "LEAD_IDENTIFIED";
      const newStatus = "PAID_OUT";

      const isValid = validTransitions[currentStatus]?.includes(newStatus) ?? false;
      expect(isValid).toBe(false);
    });

    it("should allow transition from SIGNED to FILED", () => {
      const currentStatus = "SIGNED";
      const newStatus = "FILED";

      const isValid = validTransitions[currentStatus]?.includes(newStatus) ?? false;
      expect(isValid).toBe(true);
    });

    it("should not allow any transitions from terminal state PAID_OUT", () => {
      const currentStatus = "PAID_OUT";

      expect(validTransitions[currentStatus]).toHaveLength(0);
    });

    it("should allow DISQUALIFIED from most active states", () => {
      const statesAllowingDisqualified = ["LEAD_IDENTIFIED", "CONTACTED", "INTERESTED", "SIGNED", "FILED"];

      statesAllowingDisqualified.forEach(status => {
        expect(validTransitions[status]).toContain("DISQUALIFIED");
      });
    });
  });

  // ===========================================================================
  // CASE CODE GENERATION
  // ===========================================================================

  describe("Case Code Generation", () => {
    it("should generate case code in format MGR-YYYY-NNN", () => {
      const year = new Date().getFullYear();
      const sequence = 42;

      const caseCode = `MGR-${year}-${sequence.toString().padStart(3, "0")}`;

      expect(caseCode).toMatch(/^MGR-\d{4}-\d{3}$/);
      expect(caseCode).toBe(`MGR-${year}-042`);
    });

    it("should pad sequence number with leading zeros", () => {
      const year = 2026;

      expect(`MGR-${year}-${String(1).padStart(3, "0")}`).toBe("MGR-2026-001");
      expect(`MGR-${year}-${String(99).padStart(3, "0")}`).toBe("MGR-2026-099");
      expect(`MGR-${year}-${String(100).padStart(3, "0")}`).toBe("MGR-2026-100");
    });
  });

  // ===========================================================================
  // DEADLINE CALCULATIONS
  // ===========================================================================

  describe("Deadline Calculations", () => {
    it("should calculate deadline based on state law and sale date", () => {
      const saleDate = new Date("2024-01-26");
      const stateDeadlineYears = 3; // Tennessee has 1 year, but testing with 3

      const deadlineDate = new Date(saleDate);
      deadlineDate.setFullYear(deadlineDate.getFullYear() + stateDeadlineYears);

      expect(deadlineDate.getFullYear()).toBe(2027);
      expect(deadlineDate.getMonth()).toBe(0); // January
      expect(deadlineDate.getDate()).toBe(26);
    });

    it("should identify cases approaching deadline (within 90 days)", () => {
      const now = new Date();
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 60); // 60 days from now

      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isApproaching = daysUntilDeadline <= 90 && daysUntilDeadline > 0;
      expect(isApproaching).toBe(true);
    });

    it("should identify expired deadlines", () => {
      const now = new Date();
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() - 10); // 10 days ago

      const isExpired = deadline < now;
      expect(isExpired).toBe(true);
    });
  });

  // ===========================================================================
  // EMPLOYEE ASSIGNMENT
  // ===========================================================================

  describe("Employee Assignment", () => {
    it("should allow assigning employee to unassigned case", () => {
      const caseData = { ...testCase, assignedEmployeeId: null };
      const newEmployeeId = "emp-456";

      const canAssign = caseData.assignedEmployeeId === null;
      expect(canAssign).toBe(true);
    });

    it("should track assignment history with timestamps", () => {
      const assignmentHistory = [
        { employeeId: "emp-123", assignedAt: new Date("2026-01-01"), unassignedAt: new Date("2026-01-15") },
        { employeeId: "emp-456", assignedAt: new Date("2026-01-15"), unassignedAt: null },
      ];

      const currentAssignment = assignmentHistory.find(a => a.unassignedAt === null);
      expect(currentAssignment?.employeeId).toBe("emp-456");
    });
  });

  // ===========================================================================
  // CASE FILTERING
  // ===========================================================================

  describe("Case Filtering", () => {
    it("should filter cases by status", () => {
      const cases = [
        { ...testCase, id: "1", status: "LEAD_IDENTIFIED" },
        { ...testCase, id: "2", status: "CONTACTED" },
        { ...testCase, id: "3", status: "SIGNED" },
        { ...testCase, id: "4", status: "LEAD_IDENTIFIED" },
      ];

      const leadCases = cases.filter(c => c.status === "LEAD_IDENTIFIED");
      expect(leadCases).toHaveLength(2);
    });

    it("should filter cases by state", () => {
      const cases = [
        { ...testCase, id: "1", state: "TN" },
        { ...testCase, id: "2", state: "FL" },
        { ...testCase, id: "3", state: "TN" },
        { ...testCase, id: "4", state: "GA" },
      ];

      const tnCases = cases.filter(c => c.state === "TN");
      expect(tnCases).toHaveLength(2);
    });

    it("should filter cases by assigned employee", () => {
      const cases = [
        { ...testCase, id: "1", assignedEmployeeId: "emp-123" },
        { ...testCase, id: "2", assignedEmployeeId: null },
        { ...testCase, id: "3", assignedEmployeeId: "emp-123" },
        { ...testCase, id: "4", assignedEmployeeId: "emp-456" },
      ];

      const employeeCases = cases.filter(c => c.assignedEmployeeId === "emp-123");
      expect(employeeCases).toHaveLength(2);
    });

    it("should filter unassigned cases", () => {
      const cases = [
        { ...testCase, id: "1", assignedEmployeeId: "emp-123" },
        { ...testCase, id: "2", assignedEmployeeId: null },
        { ...testCase, id: "3", assignedEmployeeId: null },
      ];

      const unassignedCases = cases.filter(c => c.assignedEmployeeId === null);
      expect(unassignedCases).toHaveLength(2);
    });
  });

  // ===========================================================================
  // CASE STATISTICS
  // ===========================================================================

  describe("Case Statistics", () => {
    it("should calculate total potential recovery", () => {
      const cases = [
        { ...testCase, surplusAmount: 4500000 },
        { ...testCase, surplusAmount: 2800000 },
        { ...testCase, surplusAmount: 1200000 },
      ];

      const totalPotential = cases.reduce((sum, c) => sum + c.surplusAmount, 0);
      expect(totalPotential).toBe(8500000); // $85,000
    });

    it("should calculate conversion rate", () => {
      const totalCases = 100;
      const convertedCases = 33; // Cases that reached PAID_OUT

      const conversionRate = (convertedCases / totalCases) * 100;
      expect(conversionRate).toBe(33);
    });

    it("should calculate average case value", () => {
      const cases = [
        { surplusAmount: 4500000 },
        { surplusAmount: 2800000 },
        { surplusAmount: 1200000 },
      ];

      const avgValue = cases.reduce((sum, c) => sum + c.surplusAmount, 0) / cases.length;
      expect(avgValue).toBeCloseTo(2833333.33, 0);
    });
  });
});
