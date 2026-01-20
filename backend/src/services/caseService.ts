import { Case } from "../models/Case";

export class CaseService {
  async listAll(): Promise<Case[]> {
    // TODO: connect to DB
    return [];
  }

  async listByEmployee(employeeId: string): Promise<Case[]> {
    // TODO: filter by assignedEmployeeId
    return [];
  }

  async getForClient(caseId: string): Promise<Partial<Case> | null> {
    // Return limited fields for client portal
    // TODO: fetch and strip sensitive fields
    return null;
  }

  async createFromIngestion(payload: {
    clientId: string;
    state: string;
    county: string;
    surplusAmountCents: number;
    feePercent: number;
  }): Promise<Case> {
    // TODO: create case in DB
    const now = new Date();
    return {
      id: "mock",
      internalCode: "C-0000",
      clientId: payload.clientId,
      state: payload.state,
      county: payload.county,
      surplusAmountCents: payload.surplusAmountCents,
      feePercent: payload.feePercent,
      status: "NEW",
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const caseService = new CaseService();
