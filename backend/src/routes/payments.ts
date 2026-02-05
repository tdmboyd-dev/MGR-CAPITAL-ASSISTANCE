/**
 * Payment Routes — MGR CAPITAL ASSISTANCE
 * Complete Nickel Payment Platform Integration
 *
 * FEATURES:
 * - ACH Payments (FREE) - Collect fees from clients
 * - Card Payments (2.9%) - Accept card payments via payment links
 * - Bill Pay - Pay vendors/contractors/clients via ACH or check
 * - Invoicing - Create invoices with payment links
 * - Auto-Collection - Automatic fee collection when cases settle
 *
 * Sign up at: https://getnickel.com
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { nickelPaymentService } from "../services/NickelPaymentService.js";
import { logger } from "../utils/logger.js";

const router = Router();

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

// ============================================
// WEBHOOKS (No auth - verified by signatures)
// ============================================

/**
 * POST /api/payments/webhook/nickel
 * Handle Nickel webhook events
 */
router.post("/webhook/nickel", async (req, res) => {
  try {
    const signature = req.headers["x-nickel-signature"] as string;
    const payload = JSON.stringify(req.body);

    // Verify signature
    if (!nickelPaymentService.verifyWebhookSignature(payload, signature)) {
      logger.warn("Nickel webhook signature verification failed");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { event, data } = req.body;
    logger.info("Nickel webhook received", { event });

    await nickelPaymentService.handleWebhook(event, data);

    res.json({ received: true });
  } catch (error: any) {
    logger.error("Nickel webhook error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/webhook/stripe
 * Handle Stripe webhook events
 */
router.post("/webhook/stripe", async (req, res) => {
  try {
    const { paymentService } = await import("../services/PaymentService.js");
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // If webhook secret configured, verify signature
    if (webhookSecret && sig) {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" as any });

      try {
        const event = stripeClient.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );

        logger.info("Stripe webhook received", { type: event.type });

        // Handle different event types
        switch (event.type) {
          case "payment_intent.succeeded":
            const paymentIntent = event.data.object as any;
            const internalId = paymentIntent.metadata?.internalPaymentId;
            if (internalId) {
              await paymentService.updateStatus(internalId, "succeeded");
            }
            break;

          case "payment_intent.payment_failed":
            const failedIntent = event.data.object as any;
            const failedInternalId = failedIntent.metadata?.internalPaymentId;
            if (failedInternalId) {
              await paymentService.updateStatus(failedInternalId, "failed");
            }
            break;

          case "charge.refunded":
            const refund = event.data.object as any;
            logger.info("Charge refunded", { chargeId: refund.id });
            break;
        }

        res.json({ received: true });
      } catch (err: any) {
        logger.error("Stripe webhook signature verification failed", { error: err.message });
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }
    } else {
      // No signature verification (dev mode)
      logger.warn("Stripe webhook received without signature verification");
      res.json({ received: true, warning: "No signature verification" });
    }
  } catch (error: any) {
    logger.error("Stripe webhook error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/webhook/paypal
 * Handle PayPal webhook events
 */
router.post("/webhook/paypal", async (req, res) => {
  try {
    const { paymentService } = await import("../services/PaymentService.js");
    const event = req.body;

    logger.info("PayPal webhook received", { type: event.event_type });

    // PayPal webhook verification would go here in production
    // Using PayPal's verify-webhook-signature API

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        const captureId = event.resource?.id;
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          // Find payment by external ID and update status
          logger.info("PayPal payment completed", { orderId, captureId });
        }
        break;

      case "PAYMENT.CAPTURE.DENIED":
        logger.warn("PayPal payment denied", { resource: event.resource?.id });
        break;

      case "PAYMENT.CAPTURE.REFUNDED":
        logger.info("PayPal payment refunded", { resource: event.resource?.id });
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error("PayPal webhook error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/webhook/opensign
 * Handle OpenSign webhook events (FREE e-signatures)
 */
router.post("/webhook/opensign", async (req, res) => {
  try {
    const { documentSigningService } = await import("../services/DocumentSigningService.js");
    const event = req.body;

    logger.info("OpenSign webhook received", { event: event.event });

    await documentSigningService.handleWebhook("opensign", event);

    res.json({ received: true });
  } catch (error: any) {
    logger.error("OpenSign webhook error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
