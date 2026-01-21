// ============================================
// CASE SERVICE — MGR CAPITAL ASSISTANCE
// Case management operations with Prisma
// ============================================

import { PrismaClient, Case, CaseStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class CaseService {
  /**
   * List all cases (FOUNDER ONLY)
   */
  async listAll(): Promise<Case[]> {
    return prisma.case.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignedEmployee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * List cases assigned to a specific employee
   */
  async listByEmployee(employeeId: string): Promise<Case[]> {
    return prisma.case.findMany({
      where: { assignedEmployeeId: employeeId },
      include: {
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Get case for client portal (limited fields, no sensitive data)
   */
  async getForClient(publicAccessToken: string): Promise<Partial<Case> | null> {
    const caseData = await prisma.case.findFirst({
      where: { publicAccessToken },
      select: {
        id: true,
        status: true,
        propertyAddress: true,
        county: true,
        state: true,
        documents: {
          where: {
            status: { in: ["PENDING_SIGNATURE", "SIGNED"] },
          },
          select: {
            id: true,
            type: true,
            status: true,
            signedAt: true,
          },
        },
      },
    });

    return caseData;
  }

  /**
   * Get single case by ID (FOUNDER ONLY)
   */
  async getById(caseId: string): Promise<Case | null> {
    return prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeTier: true,
          },
        },
        documents: true,
        deadlines: true,
        communications: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        stateRule: true,
        countyRule: true,
      },
    });
  }

  /**
   * Create case from ingestion
   */
  async createFromIngestion(payload: {
    clientId: string;
    state: string;
    county: string;
    propertyAddress?: string;
    parcelNumber?: string;
    saleDate?: Date;
    surplusAmountCents: number;
    feePercent: number;
    assignedEmployeeId?: string;
    source?: string;
  }): Promise<Case> {
    // Generate internal code
    const caseCount = await prisma.case.count();
    const internalCode = `C-${String(caseCount + 1001).padStart(6, "0")}`;

    // Generate public access token
    const publicAccessToken = this.generateToken();

    const newCase = await prisma.case.create({
      data: {
        internalCode,
        publicAccessToken,
        clientId: payload.clientId,
        state: payload.state,
        county: payload.county,
        propertyAddress: payload.propertyAddress || "",
        parcelNumber: payload.parcelNumber,
        saleDate: payload.saleDate,
        surplusAmountCents: payload.surplusAmountCents,
        feePercent: payload.feePercent,
        assignedEmployeeId: payload.assignedEmployeeId,
        status: "NEW",
        priority: payload.surplusAmountCents >= 1000000 ? 100 : 50,
        source: payload.source || "ingestion",
      },
    });

    return newCase;
  }

  /**
   * Update case status
   */
  async updateStatus(
    caseId: string,
    status: CaseStatus,
    userId: string
  ): Promise<Case> {
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status,
        filedAt: status === "FILED" ? new Date() : undefined,
        fundsDisbursedAt: status === "PAID" ? new Date() : undefined,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: "STATUS_CHANGED",
        entityType: "CASE",
        entityId: caseId,
        details: { newStatus: status },
      },
    });

    return updatedCase;
  }

  /**
   * Assign employee to case
   */
  async assignEmployee(
    caseId: string,
    employeeId: string,
    userId: string
  ): Promise<Case> {
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: { assignedEmployeeId: employeeId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: "EMPLOYEE_ASSIGNED",
        entityType: "CASE",
        entityId: caseId,
        details: { employeeId },
      },
    });

    return updatedCase;
  }

  /**
   * Get case statistics for dashboard
   */
  async getStats(): Promise<{
    totalCases: number;
    activeCases: number;
    casesThisMonth: number;
    totalRecoveredCents: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCases, activeCases, casesThisMonth, totalRecovered] =
      await Promise.all([
        prisma.case.count(),
        prisma.case.count({
          where: {
            status: {
              in: [
                "NEW",
                "CONTACTED",
                "DOCS_PENDING",
                "DOCS_SIGNED",
                "FILED",
                "AWAITING_FUNDS",
              ],
            },
          },
        }),
        prisma.case.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.case.aggregate({
          where: { status: "PAID" },
          _sum: { surplusAmountCents: true },
        }),
      ]);

    return {
      totalCases,
      activeCases,
      casesThisMonth,
      totalRecoveredCents: totalRecovered._sum.surplusAmountCents || 0,
    };
  }

  /**
   * Generate random token for public access
   */
  private generateToken(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}

export const caseService = new CaseService();
