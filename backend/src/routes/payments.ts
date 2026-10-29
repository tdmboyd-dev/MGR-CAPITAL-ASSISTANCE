/** Global founder financial records and calculation routes. Nickel execution and all unqualified provider callback paths return unavailable. */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { nickelPaymentService } from "../services/NickelPaymentService.js";
import { logger } from "../utils/logger.js";

const router = Router();
// No provider callback contract has yet been qualified. Reject rather than acknowledge.
router.use("/webhook", (_req, res) => {
  res.status(503).json({ success: false, code: "PROVIDER_CALLBACK_UNAVAILABLE", error: "Authenticated event verification and settlement reconciliation are not qualified." });
});
// These are global financial endpoints, not tenant-scoped client APIs.
router.use(authenticate, async (req: any, res, next) => {
  try {
    const { currentActor } = await import("../services/CaseDocumentAccess.js");
    const { default: db } = await import("../lib/prisma.js");
    const actor = await currentActor(db, req.user.id);
    if (actor.role !== "FOUNDER" || actor.tenantId !== null) return res.status(403).json({ error: "Global founder financial access required" });
    next();
  } catch { res.status(503).json({ error: "Financial authority unavailable" }); }
});
// Writes through this unqualified Nickel integration cannot claim a real outcome.
router.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.path !== "/calculate-fee" && !req.path.startsWith("/authorize/")) {
    return res.status(503).json({ success: false, code: "NICKEL_UNAVAILABLE", error: "Nickel payment execution awaits provider qualification. No payment was submitted." });
  }
  next();
});

/**
 * POST /api/payments/authorize
 * Create ACH authorization for a client
 */
router.post("/authorize", authenticate, async (req, res) => {
  try {
    const {
      clientId,
      bankAccount,
      ipAddress,
      userAgent,
    } = req.body;

    if (!clientId || !bankAccount) {
      return res.status(400).json({
        error: "Missing required fields: clientId, bankAccount",
      });
    }

    const authorization = await nickelPaymentService.createAuthorization(
      clientId,
      bankAccount,
      ipAddress || req.ip,
      userAgent || req.headers["user-agent"]
    );

    // Mask account number in response
    const maskedAuth = {
      ...authorization,
      bankAccount: {
        ...authorization.bankAccount,
        accountNumber: nickelPaymentService.maskAccountNumber(
          authorization.bankAccount.accountNumber
        ),
      },
    };

    res.status(201).json({
      success: true,
      authorization: maskedAuth,
    });
  } catch (error: any) {
    logger.error("Authorization creation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/initiate
 * Initiate an ACH payment (debit client account)
 */
router.post("/initiate", authenticate, async (req, res) => {
  try {
    const { authorizationId, amount, description, caseId } = req.body;

    if (!authorizationId || !amount) {
      return res.status(400).json({
        error: "Missing required fields: authorizationId, amount",
      });
    }

    const result = await nickelPaymentService.initiatePayment(
      authorizationId,
      amount,
      description || "MGR Capital Fee",
      caseId
    );

    res.json(result);
  } catch (error: any) {
    logger.error("Payment initiation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/auto-collect
 * Trigger automatic fee collection for a case
 */
router.post("/auto-collect", authenticate, async (req, res) => {
  try {
    const { caseId, clientId, surplusAmount, contingencyPercent } = req.body;

    if (!caseId || !clientId || !surplusAmount) {
      return res.status(400).json({
        error: "Missing required fields: caseId, clientId, surplusAmount",
      });
    }

    const result = await nickelPaymentService.triggerAutoCollection(
      caseId,
      clientId,
      surplusAmount,
      contingencyPercent || 33
    );

    res.json(result);
  } catch (error: any) {
    logger.error("Auto-collection failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/client/:clientId
 * Get all payments for a client
 */
router.get("/client/:clientId", authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;

    const payments = await nickelPaymentService.getClientPayments(clientId);

    res.json({ payments });
  } catch (error: any) {
    logger.error("Client payments fetch failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/payments/authorize/:authorizationId
 * Revoke an ACH authorization
 */
router.delete("/authorize/:authorizationId", authenticate, async (req, res) => {
  try {
    const { authorizationId } = req.params;

    const success = await nickelPaymentService.revokeAuthorization(authorizationId);

    if (!success) {
      return res.status(404).json({ error: "Authorization not found" });
    }

    res.json({ success: true, message: "Authorization revoked" });
  } catch (error: any) {
    logger.error("Authorization revocation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/calculate-fee
 * Calculate fee based on surplus and contingency
 */
router.post("/calculate-fee", authenticate, async (req, res) => {
  const { surplusAmount, contingencyPercent } = req.body;

  if (!surplusAmount) {
    return res.status(400).json({ error: "Missing surplusAmount" });
  }

  const result = nickelPaymentService.calculateFee(
    surplusAmount,
    contingencyPercent || 33
  );

  res.json(result);
});

/**
 * GET /api/payments/status
 * Get payment service status
 */
router.get("/service/status", authenticate, roleGuard(["FOUNDER"]), async (_req, res) => {
  const status = nickelPaymentService.getStatus();
  res.json(status);
});

/**
 * GET /api/payments
 * List all payments
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Import PaymentService for list functionality
    let paymentService;
    try {
      ({ paymentService } = await import("../services/PaymentService.js"));
    } catch (importErr: any) {
      logger.error("Failed to load PaymentService", { error: importErr.message });
      return res.status(503).json({ error: "Payment service unavailable" });
    }
    const payments = await paymentService.listPayments(limit, offset);

    res.json({ success: true, data: payments });
  } catch (error: any) {
    logger.error("Payments list failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/metrics
 * Get payment metrics for dashboard
 */
router.get("/metrics", authenticate, async (_req, res) => {
  try {
    let paymentService;
    try {
      ({ paymentService } = await import("../services/PaymentService.js"));
    } catch (importErr: any) {
      logger.error("Failed to load PaymentService", { error: importErr.message });
      return res.status(503).json({ error: "Payment service unavailable" });
    }
    const metrics = await paymentService.getMetrics();

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error("Payment metrics failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/:paymentId/approve
 * Approve a payment flagged for review (FOUNDER only)
 */
router.post("/:paymentId/approve", authenticate, async (req: any, res) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;

    // Check user role
    if (!req.user?.role || !['FOUNDER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Only founders can approve payments" });
    }

    let paymentService;
    try {
      ({ paymentService } = await import("../services/PaymentService.js"));
    } catch (importErr: any) {
      logger.error("Failed to load PaymentService", { error: importErr.message });
      return res.status(503).json({ error: "Payment service unavailable" });
    }
    const result = await paymentService.approvePayment(paymentId, req.user.userId, notes);

    if (!result) {
      return res.status(404).json({ error: "Payment not found" });
    }

    logger.info("Payment approved", { paymentId, userId: req.user.userId });
    res.json({ success: true, payment: result });
  } catch (error: any) {
    logger.error("Payment approval failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/:paymentId/block
 * Block a suspicious payment (FOUNDER only)
 */
router.post("/:paymentId/block", authenticate, async (req: any, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, notes } = req.body;

    // Check user role
    if (!req.user?.role || !['FOUNDER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Only founders can block payments" });
    }

    let paymentService;
    try {
      ({ paymentService } = await import("../services/PaymentService.js"));
    } catch (importErr: any) {
      logger.error("Failed to load PaymentService", { error: importErr.message });
      return res.status(503).json({ error: "Payment service unavailable" });
    }
    const result = await paymentService.blockPayment(paymentId, req.user.userId, reason || "Flagged by fraud detection", notes);

    if (!result) {
      return res.status(404).json({ error: "Payment not found" });
    }

    logger.warn("Payment blocked", { paymentId, userId: req.user.userId, reason });
    res.json({ success: true, payment: result });
  } catch (error: any) {
    logger.error("Payment blocking failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NICKEL PAYMENT LINKS (Card + ACH)
// ============================================

/**
 * POST /api/payments/payment-link
 * Create a payment link (client can pay via card or ACH)
 */
router.post("/payment-link", authenticate, async (req, res) => {
  try {
    const { amount, description, clientEmail, clientName, caseId, redirectUrl } = req.body;

    if (!amount || !clientEmail || !clientName) {
      return res.status(400).json({
        error: "Missing required fields: amount, clientEmail, clientName",
      });
    }

    const result = await nickelPaymentService.createPaymentLink({
      amount,
      description: description || "MGR Capital Payment",
      clientEmail,
      clientName,
      caseId,
      redirectUrl,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Payment link creation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NICKEL BILL PAY (Outbound Payments)
// ============================================

/**
 * POST /api/payments/recipients
 * Create a bill pay recipient (vendor, contractor, client)
 */
router.post("/recipients", authenticate, async (req, res) => {
  try {
    const { name, email, phone, bankAccount, address, preferredMethod } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    const recipient = await nickelPaymentService.createBillPayRecipient({
      name,
      email,
      phone,
      bankAccount,
      address,
      preferredMethod: preferredMethod || "ach",
    });

    res.status(201).json({ success: true, recipient });
  } catch (error: any) {
    logger.error("Recipient creation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/bill-pay
 * Send payment to a vendor/contractor (ACH or check)
 */
router.post("/bill-pay", authenticate, async (req: any, res) => {
  try {
    const { recipientId, amount, method, description, memo, caseId, scheduledDate } = req.body;

    if (!recipientId || !amount) {
      return res.status(400).json({
        error: "Missing required fields: recipientId, amount",
      });
    }

    // Only FOUNDER/ADMIN can send payments
    if (!req.user?.role || !['FOUNDER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions to send payments" });
    }

    const result = await nickelPaymentService.sendBillPayment(
      recipientId,
      amount,
      method || "ach",
      description || "Payment from MGR Capital",
      {
        memo,
        caseId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      }
    );

    res.json(result);
  } catch (error: any) {
    logger.error("Bill payment failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/client-payout
 * Pay out to a client after case recovery
 */
router.post("/client-payout", authenticate, async (req: any, res) => {
  try {
    const { clientId, amount, caseId, method } = req.body;

    if (!clientId || !amount || !caseId) {
      return res.status(400).json({
        error: "Missing required fields: clientId, amount, caseId",
      });
    }

    // Only FOUNDER/ADMIN can process payouts
    if (!req.user?.role || !['FOUNDER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions to process payouts" });
    }

    const result = await nickelPaymentService.payoutToClient(
      clientId,
      amount,
      caseId,
      method || "ach"
    );

    logger.info("Client payout initiated", { clientId, amount, caseId });
    res.json(result);
  } catch (error: any) {
    logger.error("Client payout failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NICKEL INVOICING
// ============================================

/**
 * POST /api/payments/invoices
 * Create and send an invoice
 */
router.post("/invoices", authenticate, async (req, res) => {
  try {
    const { clientId, amount, description, caseId, dueDate, lineItems, allowedMethods, sendEmail } = req.body;

    if (!clientId || !amount) {
      return res.status(400).json({
        error: "Missing required fields: clientId, amount",
      });
    }

    const result = await nickelPaymentService.createInvoice(clientId, amount, description || "MGR Capital Invoice", {
      caseId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      lineItems,
      allowedMethods,
      sendEmail: sendEmail ?? true,
    });

    res.status(201).json(result);
  } catch (error: any) {
    logger.error("Invoice creation failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NICKEL REPORTING
// ============================================

/**
 * GET /api/payments/summary
 * Get payment summary for dashboard
 */
router.get("/summary", authenticate, async (req, res) => {
  try {
    const { startDate, endDate, caseId } = req.query;

    const summary = await nickelPaymentService.getPaymentSummary({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      caseId: caseId as string | undefined,
    });

    res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error("Payment summary failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/:paymentId
 * Get payment status
 */
router.get("/:paymentId", authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await nickelPaymentService.getPaymentStatus(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({ payment });
  } catch (error: any) {
    logger.error("Payment status check failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});


export default router;
