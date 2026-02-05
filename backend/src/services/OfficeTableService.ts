// ============================================
// OFFICE TABLE SERVICE — MGR CAPITAL ASSISTANCE
// Contracts, Violations, and Bans Management
// ============================================

import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";
import {
  ContractType,
  ViolationType,
  BanSeverity,
  CONTRACT_TEMPLATES,
  VIOLATION_DETAILS,
  PAY_REDUCTION,
} from "../config/contracts.js";

// Type aliases (until Prisma client regenerated)
type ContractStatus = "PENDING" | "SIGNED" | "EXPIRED" | "TERMINATED";
type BanStatus = "ACTIVE" | "APPEALED" | "LIFTED" | "EXPIRED" | "COMPLETED";

// Cast prisma client for new models (until prisma generate runs)
const db = prisma as any;

class OfficeTableService {
  // ============================================
  // CONTRACT MANAGEMENT
  // ============================================

  /**
   * Generate contract content from template
   */
  generateContractContent(
    contractType: ContractType,
    userData: { name: string; email: string; date: string }
  ): string {
    const template = CONTRACT_TEMPLATES[contractType];
    if (!template) throw new Error(`Unknown contract type: ${contractType}`);

    let content = `${template.title.toUpperCase()}\n`;
    content += `MGR Capital Assistance\n`;
    content += `Date: ${userData.date}\n`;
    content += `Party: ${userData.name} (${userData.email})\n\n`;
    content += `${"=".repeat(50)}\n\n`;

    for (const section of template.sections) {
      content += `${section.heading}\n\n`;
      content += `${section.content}\n\n`;
    }

    content += `${"=".repeat(50)}\n\n`;
    content += `By signing below, ${userData.name} agrees to all terms above.\n`;

    return content;
  }

  /**
   * Create a new contract for user
   */
  async createContract(
    userId: string,
    contractType: ContractType,
    createdBy: string
  ): Promise<{ success: boolean; contractId?: string; error?: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) return { success: false, error: "User not found" };

    const template = CONTRACT_TEMPLATES[contractType];
    if (!template) return { success: false, error: "Invalid contract type" };

    const content = this.generateContractContent(contractType, {
      name: user.name || "Employee",
      email: user.email,
      date: new Date().toLocaleDateString(),
    });

    const contract = await db.employeeContract.create({
      data: {
        userId,
        contractType,
        title: template.title,
        content,
        createdBy,
      } as any,
    });

    logger.info("Contract created", { contractId: contract.id, userId, contractType });

    return { success: true, contractId: contract.id };
  }

  /**
   * Sign a contract
   */
  async signContract(
    contractId: string,
    signatureData: string,
    signatureIp: string
  ): Promise<{ success: boolean; error?: string }> {
    const contract = await db.employeeContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) return { success: false, error: "Contract not found" };
    if ((contract as any).status === "SIGNED") {
      return { success: false, error: "Contract already signed" };
    }

    await db.employeeContract.update({
      where: { id: contractId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureData,
        signatureIp,
      } as any,
    });

    logger.info("Contract signed", { contractId });

    return { success: true };
  }

  /**
   * Get contracts for a user
   */
  async getUserContracts(userId: string) {
    return db.employeeContract.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get pending contracts (unsigned)
   */
  async getPendingContracts(userId: string) {
    return db.employeeContract.findMany({
      where: { userId, status: "PENDING" as any },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create all required contracts for new employee
   */
  async createOnboardingContracts(
    userId: string,
    createdBy: string,
    isContractor: boolean = false
  ): Promise<string[]> {
    const contractTypes: ContractType[] = isContractor
      ? [ContractType.CONTRACTOR_AGREEMENT, ContractType.NDA, ContractType.CODE_OF_CONDUCT, ContractType.DATA_PROTECTION]
      : [ContractType.EMPLOYEE_AGREEMENT, ContractType.NDA, ContractType.CODE_OF_CONDUCT, ContractType.DATA_PROTECTION];

    const contractIds: string[] = [];

    for (const type of contractTypes) {
      const result = await this.createContract(userId, type, createdBy);
      if (result.contractId) contractIds.push(result.contractId);
    }

    return contractIds;
  }

  // ============================================
  // VIOLATION MANAGEMENT
  // ============================================

  /**
   * Report a violation
   */
  async reportViolation(params: {
    userId: string;
    violationType: ViolationType;
    description: string;
    evidence?: string;
    relatedCaseId?: string;
    reportedBy: string;
  }): Promise<{ success: boolean; violationId?: string; error?: string }> {
    const details = VIOLATION_DETAILS[params.violationType];
    if (!details) return { success: false, error: "Invalid violation type" };

    const violation = await db.violation.create({
      data: {
        userId: params.userId,
        violationType: params.violationType,
        severity: details.defaultSeverity,
        description: params.description,
        evidence: params.evidence,
        relatedCaseId: params.relatedCaseId,
        reportedBy: params.reportedBy,
      } as any,
    });

    logger.info("Violation reported", {
      violationId: violation.id,
      userId: params.userId,
      type: params.violationType,
    });

    return { success: true, violationId: violation.id };
  }

  /**
   * Review and confirm a violation
   */
  async reviewViolation(
    violationId: string,
    reviewedBy: string,
    confirmed: boolean,
    notes?: string,
    adjustedSeverity?: BanSeverity
  ): Promise<{ success: boolean; banId?: string; error?: string }> {
    const violation = await db.violation.findUnique({
      where: { id: violationId },
    });

    if (!violation) return { success: false, error: "Violation not found" };

    const severity = adjustedSeverity || (violation as any).severity;

    await db.violation.update({
      where: { id: violationId },
      data: {
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes,
        isConfirmed: confirmed,
        severity,
      } as any,
    });

    // If confirmed, create ban
    if (confirmed) {
      const banResult = await this.issueBan({
        userId: (violation as any).userId,
        severity,
        reason: (violation as any).description,
        violationId,
        issuedBy: reviewedBy,
      });

      if (banResult.success) {
        await db.violation.update({
          where: { id: violationId },
          data: { banId: banResult.banId } as any,
        });
        return { success: true, banId: banResult.banId };
      }
    }

    return { success: true };
  }

  /**
   * Get violations for a user
   */
  async getUserViolations(userId: string) {
    return db.violation.findMany({
      where: { userId },
      orderBy: { reportedAt: "desc" },
    });
  }

  /**
   * Get pending violations (unreviewed)
   */
  async getPendingViolations() {
    return db.violation.findMany({
      where: { isConfirmed: false, reviewedAt: null },
      orderBy: { reportedAt: "desc" },
    });
  }

  // ============================================
  // BAN MANAGEMENT
  // ============================================

  /**
   * Issue a ban
   */
  async issueBan(params: {
    userId: string;
    severity: BanSeverity;
    reason: string;
    violationId?: string;
    issuedBy: string;
    durationDays?: number;
  }): Promise<{ success: boolean; banId?: string; error?: string }> {
    const payReduction = PAY_REDUCTION[params.severity];

    // Get user's pending pay
    const pendingPay = await prisma.ledgerEntry.aggregate({
      where: {
        userId: params.userId,
        status: "PENDING",
      },
      _sum: { amountCents: true },
    });

    const pendingPayCents = pendingPay._sum.amountCents || 0;
    const forfeitedAmount = Math.floor(pendingPayCents * (payReduction / 100));

    // Calculate end date
    let endDate: Date | null = null;
    if (params.severity !== BanSeverity.TERMINATION && params.durationDays) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + params.durationDays);
    }

    const ban = await db.ban.create({
      data: {
        userId: params.userId,
        severity: params.severity,
        reason: params.reason,
        violationId: params.violationId,
        payReductionPercent: payReduction,
        pendingPayAtBan: pendingPayCents,
        amountForfeited: forfeitedAmount,
        durationDays: params.durationDays,
        endDate,
        issuedBy: params.issuedBy,
      } as any,
    });

    // Apply pay reduction if any
    if (forfeitedAmount > 0) {
      await this.applyPayReduction(params.userId, forfeitedAmount, ban.id);
    }

    // Deactivate user if termination
    if (params.severity === BanSeverity.TERMINATION) {
      await prisma.user.update({
        where: { id: params.userId },
        data: { isActive: false },
      });
    }

    logger.info("Ban issued", {
      banId: ban.id,
      userId: params.userId,
      severity: params.severity,
      forfeitedAmount,
    });

    return { success: true, banId: ban.id };
  }

  /**
   * Apply pay reduction
   */
  private async applyPayReduction(userId: string, amountCents: number, banId: string) {
    // Create negative ledger entry for forfeiture
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: "PAY_FORFEITURE",
        amountCents: -amountCents,
        displayedAmountCents: -amountCents,
        description: `Pay forfeiture due to violation (Ban ID: ${banId})`,
        status: "COMPLETED",
      } as any,
    });

    logger.info("Pay reduction applied", { userId, amountCents, banId });
  }

  /**
   * Appeal a ban
   */
  async appealBan(
    banId: string,
    appealReason: string
  ): Promise<{ success: boolean; error?: string }> {
    const ban = await db.ban.findUnique({ where: { id: banId } });

    if (!ban) return { success: false, error: "Ban not found" };
    if ((ban as any).status !== "ACTIVE") {
      return { success: false, error: "Ban is not active" };
    }
    if ((ban as any).appealedAt) {
      return { success: false, error: "Ban already appealed" };
    }

    await db.ban.update({
      where: { id: banId },
      data: {
        status: "APPEALED",
        appealedAt: new Date(),
        appealReason,
      } as any,
    });

    logger.info("Ban appealed", { banId, appealReason });

    return { success: true };
  }

  /**
   * Review an appeal
   */
  async reviewAppeal(
    banId: string,
    reviewedBy: string,
    approved: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const ban = await db.ban.findUnique({ where: { id: banId } });

    if (!ban) return { success: false, error: "Ban not found" };
    if ((ban as any).status !== "APPEALED") {
      return { success: false, error: "Ban is not under appeal" };
    }

    if (approved) {
      // Lift the ban
      await db.ban.update({
        where: { id: banId },
        data: {
          status: "LIFTED",
          appealReviewedBy: reviewedBy,
          appealDecision: "APPROVED",
          liftedAt: new Date(),
          liftedBy: reviewedBy,
          liftReason: "Appeal approved",
        } as any,
      });

      // Restore forfeited pay
      const forfeitedAmount = (ban as any).amountForfeited || 0;
      if (forfeitedAmount > 0) {
        await prisma.ledgerEntry.create({
          data: {
            userId: (ban as any).userId,
            type: "PAY_RESTORED",
            amountCents: forfeitedAmount,
            displayedAmountCents: forfeitedAmount,
            description: `Pay restored after successful appeal (Ban ID: ${banId})`,
            status: "COMPLETED",
          } as any,
        });
      }

      // Reactivate user if was terminated
      if ((ban as any).severity === "TERMINATION") {
        await prisma.user.update({
          where: { id: (ban as any).userId },
          data: { isActive: true },
        });
      }
    } else {
      await db.ban.update({
        where: { id: banId },
        data: {
          status: "ACTIVE",
          appealReviewedBy: reviewedBy,
          appealDecision: "DENIED",
        } as any,
      });
    }

    logger.info("Appeal reviewed", { banId, approved, reviewedBy });

    return { success: true };
  }

  /**
   * Get bans for a user
   */
  async getUserBans(userId: string) {
    return db.ban.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
    });
  }

  /**
   * Get active bans
   */
  async getActiveBans() {
    return db.ban.findMany({
      where: { status: "ACTIVE" as any },
      orderBy: { issuedAt: "desc" },
    });
  }

  /**
   * Get appealed bans (pending review)
   */
  async getAppealedBans() {
    return db.ban.findMany({
      where: { status: "APPEALED" as any },
      orderBy: { appealedAt: "desc" },
    });
  }

  // ============================================
  // OFFICE TABLE DASHBOARD
  // ============================================

  /**
   * Get full Office Table summary
   */
  async getOfficeTableSummary() {
    const [
      pendingContracts,
      pendingViolations,
      activeBans,
      appealedBans,
      recentViolations,
      recentBans,
    ] = await Promise.all([
      db.employeeContract.count({ where: { status: "PENDING" as any } }),
      db.violation.count({ where: { isConfirmed: false, reviewedAt: null } }),
      db.ban.count({ where: { status: "ACTIVE" as any } }),
      db.ban.count({ where: { status: "APPEALED" as any } }),
      db.violation.findMany({
        take: 10,
        orderBy: { reportedAt: "desc" },
      }),
      db.ban.findMany({
        take: 10,
        orderBy: { issuedAt: "desc" },
      }),
    ]);

    return {
      counts: {
        pendingContracts,
        pendingViolations,
        activeBans,
        appealedBans,
      },
      recentViolations,
      recentBans,
    };
  }

  /**
   * Get user's compliance profile
   */
  async getUserComplianceProfile(userId: string) {
    const [user, contracts, violations, bans] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      this.getUserContracts(userId),
      this.getUserViolations(userId),
      this.getUserBans(userId),
    ]);

    const signedContracts = contracts.filter((c: any) => c.status === "SIGNED").length;
    const pendingContracts = contracts.filter((c: any) => c.status === "PENDING").length;
    const confirmedViolations = violations.filter((v: any) => v.isConfirmed).length;
    const activeBans = bans.filter((b: any) => b.status === "ACTIVE").length;

    return {
      user,
      contracts: {
        total: contracts.length,
        signed: signedContracts,
        pending: pendingContracts,
        list: contracts,
      },
      violations: {
        total: violations.length,
        confirmed: confirmedViolations,
        list: violations,
      },
      bans: {
        total: bans.length,
        active: activeBans,
        list: bans,
      },
      status: activeBans > 0 ? "BANNED" : pendingContracts > 0 ? "PENDING_CONTRACTS" : "GOOD_STANDING",
    };
  }

  /**
   * Get violation details config
   */
  getViolationTypes() {
    return VIOLATION_DETAILS;
  }

  /**
   * Get contract templates config
   */
  getContractTypes() {
    return Object.entries(CONTRACT_TEMPLATES).map(([key, value]) => ({
      type: key,
      title: value.title,
      sectionCount: value.sections.length,
    }));
  }
}

export const officeTableService = new OfficeTableService();
