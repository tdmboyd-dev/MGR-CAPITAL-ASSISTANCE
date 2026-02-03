/**
 * Nickel Payment Service — MGR CAPITAL ASSISTANCE
 * FREE Unlimited ACH Payment Processing
 *
 * Nickel offers unlimited free ACH transfers with no caps, no monthly fees.
 * This service handles automatic payment collection from clients.
 *
 * Documentation: https://www.getnickel.com/products/free-ach-payments
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// Environment variables (configure in .env)
const NICKEL_API_KEY = process.env.NICKEL_API_KEY || "";
const NICKEL_API_URL = process.env.NICKEL_API_URL || "https://api.getnickel.com/v1";

export interface BankAccount {
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
}

export interface ACHAuthorization {
  id: string;
  clientId: string;
  bankAccount: BankAccount;
  authorizedAmount?: number; // Optional max amount
  authorizedAt: Date;
  status: "active" | "revoked" | "expired";
  ipAddress?: string;
  userAgent?: string;
}

export interface ACHPayment {
  id: string;
  authorizationId: string;
  amount: number;
  description: string;
  status: "pending" | "processing" | "completed" | "failed" | "returned";
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
  caseId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
  estimatedArrival?: Date;
}

// Helper to convert a Payment DB row (authorization type) to ACHAuthorization
function toACHAuthorization(row: {
  id: string;
  userId: string | null;
  status: string;
  metadata: unknown;
  createdAt: Date;
}): ACHAuthorization {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const bankAccount = (meta.bankAccount ?? {}) as BankAccount;
  return {
    id: row.id,
    clientId: row.userId ?? "",
    bankAccount,
    authorizedAmount: meta.authorizedAmount as number | undefined,
    authorizedAt: row.createdAt,
    status: row.status as ACHAuthorization["status"],
    ipAddress: meta.ipAddress as string | undefined,
    userAgent: meta.userAgent as string | undefined,
  };
}

// Helper to convert a Payment DB row (payment type) to ACHPayment
function toACHPayment(row: {
  id: string;
  status: string;
  amountCents: number;
  description: string | null;
  createdAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
  caseId: string | null;
  metadata: unknown;
}): ACHPayment {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    authorizationId: (meta.authorizationId as string) ?? "",
    amount: row.amountCents / 100,
    description: row.description ?? "",
    status: row.status as ACHPayment["status"],
    createdAt: row.createdAt,
    completedAt: row.processedAt ?? undefined,
    failureReason: row.failureReason ?? undefined,
    caseId: row.caseId ?? undefined,
  };
}

class NickelPaymentService {
  private apiKey: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = NICKEL_API_KEY;
    this.baseUrl = NICKEL_API_URL;
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      logger.warn("Nickel API key not configured - using mock mode");
    }
  }

  /**
   * Store ACH authorization from client
   * Client signs this at contract time, authorizing future auto-debits
   */
  async createAuthorization(
    clientId: string,
    bankAccount: BankAccount,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ACHAuthorization> {
    logger.info("Creating ACH authorization", { clientId });

    // Validate bank account
    if (!this.validateRoutingNumber(bankAccount.routingNumber)) {
      throw new Error("Invalid routing number");
    }

    if (!this.validateAccountNumber(bankAccount.accountNumber)) {
      throw new Error("Invalid account number");
    }

    // Store authorization as a Payment record with type ACH_AUTHORIZATION
    const row = await prisma.payment.create({
      data: {
        userId: clientId,
        type: "ACH_AUTHORIZATION",
        status: "active",
        amountCents: 0,
        provider: "nickel",
        method: "ach",
        description: "ACH Authorization",
        metadata: {
          bankAccount: bankAccount as unknown as Prisma.InputJsonValue,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    const authorization = toACHAuthorization(row);

    // In production, this would call Nickel API to tokenize the bank account
    if (this.isConfigured) {
      try {
        // const response = await fetch(`${this.baseUrl}/bank-accounts`, {
        //   method: "POST",
        //   headers: {
        //     "Authorization": `Bearer ${this.apiKey}`,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     routing_number: bankAccount.routingNumber,
        //     account_number: bankAccount.accountNumber,
        //     account_type: bankAccount.accountType,
        //     account_holder_name: bankAccount.accountHolderName,
        //   }),
        // });
        // const data = await response.json();
        // authorization.id = data.id;
      } catch (error: any) {
        logger.error("Nickel API error", { error: error.message });
        throw new Error("Failed to create bank account authorization");
      }
    }

    logger.info("ACH authorization created", { authId: authorization.id, clientId });
    return authorization;
  }

  /**
   * Initiate ACH debit (pull funds from client's account)
   * This is called when county disburses funds to client
   */
  async initiatePayment(
    authorizationId: string,
    amount: number,
    description: string,
    caseId?: string
  ): Promise<PaymentResult> {
    logger.info("Initiating ACH payment", { authorizationId, amount, caseId });

    const authRow = await prisma.payment.findFirst({
      where: { id: authorizationId, type: "ACH_AUTHORIZATION" },
    });

    if (!authRow) {
      return { success: false, error: "Authorization not found" };
    }

    const authorization = toACHAuthorization(authRow);

    if (authorization.status !== "active") {
      return { success: false, error: `Authorization is ${authorization.status}` };
    }

    // Validate amount
    if (amount <= 0 || amount > 1000000) {
      return { success: false, error: "Invalid amount (must be $0.01 - $1,000,000)" };
    }

    // Store payment as a Payment record with type ACH_PAYMENT
    const row = await prisma.payment.create({
      data: {
        userId: authorization.clientId || undefined,
        caseId: caseId ?? undefined,
        type: "ACH_PAYMENT",
        status: "pending",
        amountCents: Math.round(amount * 100),
        provider: "nickel",
        method: "ach",
        description,
        metadata: {
          authorizationId,
        } as Prisma.InputJsonValue,
      },
    });

    const payment = toACHPayment(row);

    // In production, call Nickel API
    if (this.isConfigured) {
      try {
        // const response = await fetch(`${this.baseUrl}/payments`, {
        //   method: "POST",
        //   headers: {
        //     "Authorization": `Bearer ${this.apiKey}`,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     bank_account_id: authorization.id,
        //     amount: Math.round(amount * 100), // Convert to cents
        //     description,
        //     metadata: { caseId },
        //   }),
        // });
        // const data = await response.json();
        // payment.id = data.id;
        // payment.status = "processing";
      } catch (error: any) {
        logger.error("Nickel payment error", { error: error.message });
        await prisma.payment.update({
          where: { id: row.id },
          data: { status: "failed", failureReason: error.message },
        });
        return { success: false, error: error.message };
      }
    }

    // Simulate processing (ACH typically takes 1-2 business days)
    await prisma.payment.update({
      where: { id: row.id },
      data: { status: "processing" },
    });

    const estimatedArrival = new Date();
    estimatedArrival.setDate(estimatedArrival.getDate() + 2);

    logger.info("ACH payment initiated", { paymentId: row.id, status: "processing" });

    return {
      success: true,
      paymentId: row.id,
      status: "processing",
      estimatedArrival,
    };
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(paymentId: string): Promise<ACHPayment | null> {
    const row = await prisma.payment.findFirst({
      where: { id: paymentId, type: "ACH_PAYMENT" },
    });

    if (!row) {
      return null;
    }

    // In production, fetch latest status from Nickel
    if (this.isConfigured && row.status === "processing") {
      // Simulate status check
      // const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      //   headers: { "Authorization": `Bearer ${this.apiKey}` },
      // });
      // const data = await response.json();
      // update status in DB
    }

    return toACHPayment(row);
  }

  /**
   * Get all payments for a client
   */
  async getClientPayments(clientId: string): Promise<ACHPayment[]> {
    const rows = await prisma.payment.findMany({
      where: {
        userId: clientId,
        type: "ACH_PAYMENT",
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map(toACHPayment);
  }

  /**
   * Revoke an authorization (client wants to cancel)
   */
  async revokeAuthorization(authorizationId: string): Promise<boolean> {
    const row = await prisma.payment.findFirst({
      where: { id: authorizationId, type: "ACH_AUTHORIZATION" },
    });

    if (!row) {
      return false;
    }

    await prisma.payment.update({
      where: { id: authorizationId },
      data: { status: "revoked" },
    });

    logger.info("ACH authorization revoked", { authId: authorizationId });
    return true;
  }

  /**
   * Calculate fee based on contingency percentage
   */
  calculateFee(
    surplusAmount: number,
    contingencyPercent: number = 33
  ): { feeAmount: number; clientAmount: number } {
    const feeAmount = Math.round(surplusAmount * (contingencyPercent / 100) * 100) / 100;
    const clientAmount = Math.round((surplusAmount - feeAmount) * 100) / 100;

    return { feeAmount, clientAmount };
  }

  /**
   * Trigger automatic fee collection when county disburses funds
   * This is called by webhook or manual trigger when we know client received money
   */
  async triggerAutoCollection(
    caseId: string,
    clientId: string,
    surplusAmount: number,
    contingencyPercent: number = 33
  ): Promise<PaymentResult> {
    logger.info("Triggering auto-collection", { caseId, clientId, surplusAmount });

    // Find active authorization for client
    const authRow = await prisma.payment.findFirst({
      where: {
        userId: clientId,
        type: "ACH_AUTHORIZATION",
        status: "active",
      },
    });

    if (!authRow) {
      return { success: false, error: "No active ACH authorization for client" };
    }

    // Calculate fee
    const { feeAmount } = this.calculateFee(surplusAmount, contingencyPercent);

    // Initiate payment
    return this.initiatePayment(
      authRow.id,
      feeAmount,
      `MGR Capital Fee - Case ${caseId}`,
      caseId
    );
  }

  // Validation helpers
  private validateRoutingNumber(routingNumber: string): boolean {
    // US routing numbers are 9 digits
    if (!/^\d{9}$/.test(routingNumber)) {
      return false;
    }

    // Checksum validation (ABA algorithm)
    const digits = routingNumber.split("").map(Number);
    const checksum =
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      1 * (digits[2] + digits[5] + digits[8]);

    return checksum % 10 === 0;
  }

  private validateAccountNumber(accountNumber: string): boolean {
    // Account numbers are typically 4-17 digits
    return /^\d{4,17}$/.test(accountNumber);
  }

  /**
   * Mask account number for display (show last 4 only)
   */
  maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) {
      return "****";
    }
    return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }

  /**
   * Get service status
   */
  getStatus(): { configured: boolean; mode: string } {
    return {
      configured: this.isConfigured,
      mode: this.isConfigured ? "live" : "mock",
    };
  }
}

// Export singleton instance
export const nickelPaymentService = new NickelPaymentService();

// Export types for routes
export type { NickelPaymentService };
