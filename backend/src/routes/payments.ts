/**
 * Payment Routes — MGR CAPITAL ASSISTANCE
 * Nickel ACH integration for automatic fee collection
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
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
router.post("/calculate-fee", async (req, res) => {
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
router.get("/service/status", authenticate, async (_req, res) => {
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
    const { paymentService } = await import("../services/PaymentService.js");
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
    const { paymentService } = await import("../services/PaymentService.js");
    const metrics = await paymentService.getMetrics();

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error("Payment metrics failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBHOOKS (No auth - verified by signatures)
// ============================================

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
 * POST /api/payments/webhook/docusign
 * Handle DocuSign webhook events
 */
router.post("/webhook/docusign", async (req, res) => {
  try {
    const { documentSigningService } = await import("../services/DocumentSigningService.js");
    const event = req.body;

    logger.info("DocuSign webhook received", { event: event.event });

    await documentSigningService.handleWebhook("docusign", event);

    res.json({ received: true });
  } catch (error: any) {
    logger.error("DocuSign webhook error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
