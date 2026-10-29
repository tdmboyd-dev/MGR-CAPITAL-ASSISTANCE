/** Nickel execution is unavailable pending provider qualification. Historical records remain readable. */
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";
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
// ============================================
// CARD PAYMENT TYPES
// ============================================
export interface CardPayment {
    id: string;
    amount: number;
    currency: string;
    status: "pending" | "processing" | "completed" | "failed" | "refunded";
    cardLast4: string;
    cardBrand: string;
    description: string;
    caseId?: string;
    clientId?: string;
    createdAt: Date;
    completedAt?: Date;
    feeAmount?: number; // 2.9% processing fee
}
export interface CardPaymentRequest {
    amount: number;
    description: string;
    clientEmail: string;
    clientName: string;
    caseId?: string;
    redirectUrl?: string;
}
// ============================================
// BILL PAY TYPES (Outbound Payments)
// ============================================
export interface BillPayRecipient {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    bankAccount?: BankAccount;
    address?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        zipCode: string;
    };
    preferredMethod: "ach" | "check" | "card";
}
export interface BillPayment {
    id: string;
    recipientId: string;
    amount: number;
    method: "ach" | "check" | "card";
    status: "pending" | "processing" | "sent" | "completed" | "failed";
    description: string;
    memo?: string;
    caseId?: string;
    scheduledDate?: Date;
    sentAt?: Date;
    completedAt?: Date;
    checkNumber?: string;
    trackingUrl?: string;
}
// ============================================
// INVOICE TYPES
// ============================================
export interface NickelInvoice {
    id: string;
    invoiceNumber: string;
    clientId: string;
    clientEmail: string;
    clientName: string;
    amount: number;
    dueDate: Date;
    status: "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";
    paymentLink?: string;
    allowedMethods: ("ach" | "card" | "check")[];
    lineItems: InvoiceLineItem[];
    caseId?: string;
    createdAt: Date;
    sentAt?: Date;
    paidAt?: Date;
}
export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}
// ============================================
// NET TERMS TYPES
// ============================================
export interface NetTermsOffer {
    id: string;
    clientId: string;
    creditLimit: number;
    termDays: 30 | 60 | 90;
    status: "pending" | "approved" | "active" | "suspended" | "closed";
    availableCredit: number;
    usedCredit: number;
    approvedAt?: Date;
    expiresAt?: Date;
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
            logger.warn("Nickel payment execution unavailable pending provider qualification");
        }
    }
    /**
     * Store ACH authorization from client
     * Client signs this at contract time, authorizing future auto-debits
     */
    async createAuthorization(clientId: string, bankAccount: BankAccount, ipAddress?: string, userAgent?: string): Promise<ACHAuthorization> { throw new Error("Nickel integration unavailable: no qualified authorization or authenticated event contract. No bank details were stored or funds submitted."); }
    /**
     * Initiate ACH debit (pull funds from client's account)
     * This is called when county disburses funds to client
     */
    async initiatePayment(authorizationId: string, amount: number, description: string, caseId?: string): Promise<PaymentResult> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    /**
     * Check payment status
     */
    async getPaymentStatus(paymentId: string): Promise<ACHPayment | null> { const row = await prisma.payment.findFirst({ where: { id: paymentId, type: "ACH_PAYMENT" } }); return row ? toACHPayment(row) : null; }
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
    calculateFee(surplusAmount: number, contingencyPercent: number = 33): {
        feeAmount: number;
        clientAmount: number;
    } {
        const cents = Math.round(surplusAmount * 100);
        if (!Number.isFinite(surplusAmount) || !Number.isSafeInteger(cents) || cents <= 0 || Math.abs(surplusAmount * 100 - cents) > 1e-6 || !Number.isFinite(contingencyPercent) || contingencyPercent < 0 || contingencyPercent > 100) throw new Error("Invalid monetary amount or percentage");
        const feeAmount = Math.round(surplusAmount * (contingencyPercent / 100) * 100) / 100;
        const clientAmount = Math.round((surplusAmount - feeAmount) * 100) / 100;
        return { feeAmount, clientAmount };
    }
    /**
     * Trigger automatic fee collection when county disburses funds
     * This is called by webhook or manual trigger when we know client received money
     */
    async triggerAutoCollection(caseId: string, clientId: string, surplusAmount: number, contingencyPercent: number = 33): Promise<PaymentResult> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
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
    getStatus(): {
        configured: boolean;
        mode: string;
        features: string[];
    } { return { configured: this.isConfigured, mode: "unavailable_pending_provider_qualification", features: [] }; }
    // ============================================
    // CARD PAYMENTS (2.9% fee)
    // ============================================
    /**
     * Create a payment link for card/ACH payment
     * Client can pay via the link with card or bank transfer
     */
    async createPaymentLink(request: CardPaymentRequest): Promise<{
        success: boolean;
        paymentLink?: string;
        paymentId?: string;
        error?: string;
    }> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    /**
     * Process a card payment directly (for API integrations)
     */
    async processCardPayment(amount: number, cardToken: string, description: string, caseId?: string): Promise<PaymentResult> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    // ============================================
    // BILL PAY (Outbound Payments)
    // ============================================
    /**
     * Create a recipient for bill payments (vendor, contractor, client)
     */
    async createBillPayRecipient(recipient: Omit<BillPayRecipient, "id">): Promise<BillPayRecipient> { throw new Error("Nickel integration unavailable: no qualified authorization or authenticated event contract. No bank details were stored or funds submitted."); }
    /**
     * Send payment to a recipient (client payout, vendor payment)
     * FREE for ACH, small fee for checks
     */
    async sendBillPayment(recipientId: string, amount: number, method: "ach" | "check", description: string, options?: {
        memo?: string;
        caseId?: string;
        scheduledDate?: Date;
    }): Promise<PaymentResult> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    /**
     * Pay out to a client (after case recovery)
     * Wrapper around sendBillPayment specifically for client payouts
     */
    async payoutToClient(clientId: string, amount: number, caseId: string, method: "ach" | "check" = "ach"): Promise<PaymentResult> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    // ============================================
    // INVOICING
    // ============================================
    /**
     * Create and send an invoice with payment link
     */
    async createInvoice(clientId: string, amount: number, description: string, options?: {
        caseId?: string;
        dueDate?: Date;
        lineItems?: InvoiceLineItem[];
        allowedMethods?: ("ach" | "card" | "check")[];
        sendEmail?: boolean;
    }): Promise<{
        success: boolean;
        invoice?: NickelInvoice;
        error?: string;
    }> { return { success: false, error: "Nickel integration unavailable: provider contract, tokenized authorization and reconciliation are not qualified. No payment was submitted." }; }
    // ============================================
    // WEBHOOKS
    // ============================================
    /**
     * Handle Nickel webhook events
     */
    async handleWebhook(event: string, payload: any): Promise<void> { throw new Error("Nickel integration unavailable: no qualified authorization or authenticated event contract. No bank details were stored or funds submitted."); }
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string): boolean { return false; }
    // ============================================
    // REPORTING
    // ============================================
    /**
     * Get payment summary for dashboard
     */
    async getPaymentSummary(options?: {
        startDate?: Date;
        endDate?: Date;
        caseId?: string;
    }): Promise<{
        totalReceived: number;
        totalSent: number;
        pendingInbound: number;
        pendingOutbound: number;
        byMethod: Record<string, number>;
    }> {
        const where: any = {};
        if (options?.startDate || options?.endDate) {
            where.createdAt = {};
            if (options.startDate)
                where.createdAt.gte = options.startDate;
            if (options.endDate)
                where.createdAt.lte = options.endDate;
        }
        if (options?.caseId) {
            where.caseId = options.caseId;
        }
        const payments = await prisma.payment.findMany({
            where: {
                ...where,
                type: { in: ["ACH_PAYMENT", "CARD_PAYMENT", "BILL_PAYMENT", "PAYMENT_LINK"] },
            },
        });
        let totalReceived = 0;
        let totalSent = 0;
        let pendingInbound = 0;
        let pendingOutbound = 0;
        const byMethod: Record<string, number> = {};
        for (const payment of payments) {
            const amount = payment.amountCents / 100;
            const method = payment.method || "other";
            byMethod[method] = (byMethod[method] || 0) + amount;
            if (payment.type === "BILL_PAYMENT") {
                if (payment.status === "completed") {
                    totalSent += amount;
                }
                else if (["pending", "processing", "scheduled"].includes(payment.status)) {
                    pendingOutbound += amount;
                }
            }
            else {
                if (payment.status === "completed") {
                    totalReceived += amount;
                }
                else if (["pending", "processing"].includes(payment.status)) {
                    pendingInbound += amount;
                }
            }
        }
        return {
            totalReceived,
            totalSent,
            pendingInbound,
            pendingOutbound,
            byMethod,
        };
    }
}
// Export singleton instance
export const nickelPaymentService = new NickelPaymentService();
// Export types for routes
export type { NickelPaymentService };
