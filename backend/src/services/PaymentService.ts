/**
 * PaymentService.ts — MGR CAPITAL ASSISTANCE
 * Payment Abstraction Layer (Stripe + PayPal + ACH)
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// Initialize Stripe (if key available)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export type PaymentMethod = 'stripe' | 'paypal' | 'ach' | 'check';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  error?: string;
  metadata?: Record<string, any>;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export class PaymentService {
  /**
   * Create a payment using specified method
   */
  async createPayment(
    amount: number, // in cents
    method: PaymentMethod,
    data: {
      caseId?: string;
      userId?: string;
      description?: string;
      email?: string;
      stripePaymentMethodId?: string;
      paypalOrderId?: string;
      achAccountId?: string;
    }
  ): Promise<PaymentResult> {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      switch (method) {
        case 'stripe':
          return await this.processStripe(paymentId, amount, data);
        case 'paypal':
          return await this.processPayPal(paymentId, amount, data);
        case 'ach':
          return await this.processACH(paymentId, amount, data);
        case 'check':
          return await this.processCheck(paymentId, amount, data);
        default:
          return {
            success: false,
            paymentId,
            status: 'failed',
            method,
            amount,
            currency: 'usd',
            error: 'Unsupported payment method',
          };
      }
    } catch (error: any) {
      logger.error('Payment failed', { method, amount, error: error.message });
      return {
        success: false,
        paymentId,
        status: 'failed',
        method,
        amount,
        currency: 'usd',
        error: error.message,
      };
    }
  }

  /**
   * Process Stripe payment
   */
  private async processStripe(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    if (!stripe) {
      return {
        success: false,
        paymentId,
        status: 'failed',
        method: 'stripe',
        amount,
        currency: 'usd',
        error: 'Stripe not configured',
      };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method: data.stripePaymentMethodId,
      confirm: true,
      description: data.description || 'MGR Capital Payment',
      receipt_email: data.email,
      metadata: {
        caseId: data.caseId,
        userId: data.userId,
        internalPaymentId: paymentId,
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    const success = paymentIntent.status === 'succeeded';

    // Record in database
    await this.recordPayment(paymentId, {
      method: 'stripe',
      amount,
      status: success ? 'succeeded' : 'pending',
      externalId: paymentIntent.id,
      caseId: data.caseId,
      userId: data.userId,
    });

    return {
      success,
      paymentId,
      status: success ? 'succeeded' : 'pending',
      method: 'stripe',
      amount,
      currency: 'usd',
      metadata: { stripePaymentIntentId: paymentIntent.id },
    };
  }

  /**
   * Process PayPal payment (stub - implement with PayPal SDK)
   */
  private async processPayPal(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    // PayPal integration stub
    // In production, use @paypal/paypal-server-sdk

    logger.info('PayPal payment initiated', { paymentId, amount });

    await this.recordPayment(paymentId, {
      method: 'paypal',
      amount,
      status: 'pending',
      externalId: data.paypalOrderId,
      caseId: data.caseId,
      userId: data.userId,
    });

    return {
      success: true,
      paymentId,
      status: 'pending',
      method: 'paypal',
      amount,
      currency: 'usd',
      metadata: { paypalOrderId: data.paypalOrderId },
    };
  }

  /**
   * Process ACH/Bank Transfer (stub - implement with Plaid/Dwolla)
   */
  private async processACH(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    // ACH integration stub
    // In production, use Plaid or Dwolla

    logger.info('ACH payment initiated', { paymentId, amount });

    await this.recordPayment(paymentId, {
      method: 'ach',
      amount,
      status: 'pending',
      externalId: data.achAccountId,
      caseId: data.caseId,
      userId: data.userId,
    });

    return {
      success: true,
      paymentId,
      status: 'pending', // ACH takes 3-5 business days
      method: 'ach',
      amount,
      currency: 'usd',
      metadata: { achAccountId: data.achAccountId },
    };
  }

  /**
   * Process check payment (manual tracking)
   */
  private async processCheck(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    await this.recordPayment(paymentId, {
      method: 'check',
      amount,
      status: 'pending',
      caseId: data.caseId,
      userId: data.userId,
    });

    return {
      success: true,
      paymentId,
      status: 'pending',
      method: 'check',
      amount,
      currency: 'usd',
    };
  }

  /**
   * Refund a payment
   */
  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      if (payment.method === 'stripe' && stripe && payment.externalId) {
        const refund = await stripe.refunds.create({
          payment_intent: payment.externalId,
          amount: amount || undefined, // Full refund if not specified
        });

        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'refunded' },
        });

        return { success: true, refundId: refund.id };
      }

      // For other methods, just mark as refunded (manual process)
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'refunded' },
      });

      return { success: true, refundId: `refund_${Date.now()}` };
    } catch (error: any) {
      logger.error('Refund failed', { paymentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get payment status
   */
  async getStatus(paymentId: string): Promise<PaymentStatus | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });

    return payment?.status as PaymentStatus | null;
  }

  /**
   * Update payment status (for webhooks)
   */
  async updateStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
  }

  /**
   * Record payment in database
   */
  private async recordPayment(paymentId: string, data: {
    method: PaymentMethod;
    amount: number;
    status: PaymentStatus;
    externalId?: string;
    caseId?: string;
    userId?: string;
  }): Promise<void> {
    await prisma.payment.create({
      data: {
        id: paymentId,
        method: data.method,
        amountCents: data.amount,
        status: data.status,
        externalId: data.externalId,
        caseId: data.caseId,
        userId: data.userId,
      },
    });
  }

  /**
   * Create Stripe checkout session
   */
  async createStripeCheckout(
    amount: number,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<string | null> {
    if (!stripe) return null;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'MGR Capital Service Fee',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    return session.url;
  }
}

export const paymentService = new PaymentService();
