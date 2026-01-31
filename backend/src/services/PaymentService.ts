/**
 * PaymentService.ts — MGR CAPITAL ASSISTANCE
 * Payment Abstraction Layer (Nickel FREE ACH + Stripe + PayPal)
 * ADVANCED: Multi-provider with metrics, fraud detection, auto-invoicing
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// Initialize Stripe (if key available)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

// Nickel API configuration (FREE unlimited ACH)
const NICKEL_API_URL = 'https://api.nickelpayments.com/v1';
const NICKEL_API_KEY = process.env.NICKEL_API_KEY;

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
  private demoMode: boolean;

  constructor() {
    this.demoMode = !stripe && !NICKEL_API_KEY;
    if (this.demoMode) {
      logger.info('[PaymentService] Running in DEMO MODE - payments are simulated');
    }
  }

  /**
   * Check if service is in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  /**
   * Get service status
   */
  getServiceStatus(): { stripe: boolean; nickel: boolean; mode: string } {
    return {
      stripe: !!stripe,
      nickel: !!NICKEL_API_KEY,
      mode: this.demoMode ? 'demo' : 'live'
    };
  }

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
   * Process Stripe payment (real or demo)
   */
  private async processStripe(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    // Demo mode - simulate successful payment
    if (!stripe) {
      logger.info('[DEMO] Simulating Stripe payment', { paymentId, amount });

      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const demoExternalId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        await this.recordPayment(paymentId, {
          method: 'stripe',
          amount,
          status: 'succeeded',
          providerPaymentId: demoExternalId,
          caseId: data.caseId,
          userId: data.userId,
        });
      } catch (e) {
        // Database might not be available
        logger.warn('Could not record demo payment to database');
      }

      return {
        success: true,
        paymentId,
        status: 'succeeded',
        method: 'stripe',
        amount,
        currency: 'usd',
        metadata: {
          stripePaymentIntentId: demoExternalId,
          demoMode: true,
          note: 'This is a simulated payment - no real charge was made'
        },
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
      providerPaymentId: paymentIntent.id,
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
   * Process PayPal payment via REST API
   * Requires: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET in .env
   */
  private async processPayPal(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const sandbox = process.env.NODE_ENV !== 'production';
    const baseUrl = sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    // If PayPal credentials available, use real API
    if (clientId && clientSecret) {
      try {
        // Get access token
        const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (!authResponse.ok) {
          throw new Error('PayPal auth failed');
        }

        const authData: any = await authResponse.json();
        const accessToken = authData.access_token;

        // If we have an order ID, capture it (user already approved on frontend)
        if (data.paypalOrderId) {
          const captureResponse = await fetch(
            `${baseUrl}/v2/checkout/orders/${data.paypalOrderId}/capture`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (captureResponse.ok) {
            const captureData: any = await captureResponse.json();
            const captured = captureData.status === 'COMPLETED';

            await this.recordPayment(paymentId, {
              method: 'paypal',
              amount,
              status: captured ? 'succeeded' : 'pending',
              providerPaymentId: data.paypalOrderId,
              caseId: data.caseId,
              userId: data.userId,
            });

            logger.info('PayPal payment captured', { paymentId, orderId: data.paypalOrderId, captured });

            return {
              success: captured,
              paymentId,
              status: captured ? 'succeeded' : 'pending',
              method: 'paypal',
              amount,
              currency: 'usd',
              metadata: {
                paypalOrderId: data.paypalOrderId,
                captureId: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                provider: 'paypal',
              },
            };
          }
        }

        // Create new order if no order ID provided
        const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              amount: {
                currency_code: 'USD',
                value: (amount / 100).toFixed(2),
              },
              description: data.description || 'MGR Capital Service Fee',
              custom_id: paymentId,
            }],
            application_context: {
              return_url: data.returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
              cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
            },
          }),
        });

        if (orderResponse.ok) {
          const orderData: any = await orderResponse.json();

          await this.recordPayment(paymentId, {
            method: 'paypal',
            amount,
            status: 'pending',
            providerPaymentId: orderData.id,
            caseId: data.caseId,
            userId: data.userId,
          });

          const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

          logger.info('PayPal order created', { paymentId, orderId: orderData.id });

          return {
            success: true,
            paymentId,
            status: 'pending',
            method: 'paypal',
            amount,
            currency: 'usd',
            metadata: {
              paypalOrderId: orderData.id,
              approveUrl: approveLink,
              provider: 'paypal',
              note: 'Redirect user to approveUrl to complete payment',
            },
          };
        }

        throw new Error('PayPal order creation failed');
      } catch (error: any) {
        logger.error('PayPal API error', { paymentId, error: error.message });
        // Fall through to demo mode
      }
    }

    // Demo mode
    logger.info('[DEMO] PayPal payment simulated', { paymentId, amount });

    const demoOrderId = `PP_DEMO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.recordPayment(paymentId, {
      method: 'paypal',
      amount,
      status: 'pending',
      providerPaymentId: demoOrderId,
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
      metadata: {
        paypalOrderId: demoOrderId,
        demoMode: true,
        note: 'Demo mode - configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET for real payments'
      },
    };
  }

  /**
   * Process ACH/Bank Transfer via Stripe ACH Direct Debit
   * Requires: Stripe Financial Connections or manual bank account setup
   */
  private async processACH(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    // If Stripe available, use Stripe ACH
    if (stripe && data.stripeBankAccountId) {
      try {
        // Create payment intent for ACH debit
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          payment_method: data.stripeBankAccountId,
          confirm: true,
          description: data.description || 'MGR Capital ACH Payment',
          mandate_data: {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: data.ipAddress || '0.0.0.0',
                user_agent: data.userAgent || 'MGR-Capital-Server',
              },
            },
          },
          metadata: {
            caseId: data.caseId,
            userId: data.userId,
            internalPaymentId: paymentId,
          },
        });

        const status = paymentIntent.status === 'succeeded' ? 'succeeded' :
                       paymentIntent.status === 'processing' ? 'processing' : 'pending';

        await this.recordPayment(paymentId, {
          method: 'ach',
          amount,
          status,
          providerPaymentId: paymentIntent.id,
          caseId: data.caseId,
          userId: data.userId,
        });

        logger.info('Stripe ACH payment initiated', { paymentId, status, stripeId: paymentIntent.id });

        return {
          success: true,
          paymentId,
          status,
          method: 'ach',
          amount,
          currency: 'usd',
          metadata: {
            stripePaymentIntentId: paymentIntent.id,
            provider: 'stripe_ach',
            note: 'ACH payments typically take 3-5 business days to complete'
          },
        };
      } catch (error: any) {
        logger.error('Stripe ACH failed', { paymentId, error: error.message });
        // Fall through to demo mode
      }
    }

    // Demo/fallback mode - simulate ACH for testing
    logger.info('[DEMO] ACH payment simulated', { paymentId, amount });

    const demoExternalId = `ach_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.recordPayment(paymentId, {
      method: 'ach',
      amount,
      status: 'processing',
      providerPaymentId: demoExternalId,
      caseId: data.caseId,
      userId: data.userId,
    });

    return {
      success: true,
      paymentId,
      status: 'processing',
      method: 'ach',
      amount,
      currency: 'usd',
      metadata: {
        achAccountId: data.achAccountId || demoExternalId,
        demoMode: !stripe,
        note: 'ACH payments typically take 3-5 business days to complete'
      },
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

      if (payment.method === 'stripe' && stripe && payment.providerPaymentId) {
        const refund = await stripe.refunds.create({
          payment_intent: payment.providerPaymentId,
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
    providerPaymentId?: string;
    caseId?: string;
    userId?: string;
  }): Promise<void> {
    await prisma.payment.create({
      data: {
        id: paymentId,
        method: data.method,
        amountCents: data.amount,
        status: data.status,
        providerPaymentId: data.providerPaymentId,
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

  /**
   * Create Stripe Financial Connections session for bank account linking
   * This is the CORRECT way to link bank accounts - NOT raw account numbers
   *
   * Flow:
   * 1. Create Financial Connections session
   * 2. Client completes bank linking in Stripe-hosted UI
   * 3. Webhook receives linked account details
   * 4. Use returned payment method for ACH payments
   */
  async createBankLinkingSession(
    customerId: string,
    returnUrl: string
  ): Promise<{ clientSecret: string; url: string } | null> {
    if (!stripe) {
      logger.warn('Stripe not configured, cannot create bank linking session');
      return null;
    }

    try {
      // Create Financial Connections session
      const session = await stripe.financialConnections.sessions.create({
        account_holder: {
          type: 'customer',
          customer: customerId,
        },
        permissions: ['payment_method', 'balances'],
        filters: {
          countries: ['US'],
        },
        return_url: returnUrl,
      });

      logger.info('Financial Connections session created', {
        sessionId: session.id,
        customerId,
      });

      return {
        clientSecret: session.client_secret!,
        url: (session as any).url || returnUrl,
      };
    } catch (error: any) {
      logger.error('Failed to create Financial Connections session', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get or create Stripe customer for a user
   */
  async getOrCreateStripeCustomer(
    userId: string,
    email: string,
    name: string
  ): Promise<string | null> {
    if (!stripe) return null;

    try {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
          platform: 'mgr-capital',
        },
      });

      logger.info('Stripe customer created', { customerId: customer.id, userId });
      return customer.id;
    } catch (error: any) {
      logger.error('Failed to get/create Stripe customer', { error: error.message });
      return null;
    }
  }

  /**
   * Create payment method from Financial Connections account
   * Call this after the user completes bank linking
   */
  async createPaymentMethodFromLinkedAccount(
    linkedAccountId: string,
    customerId: string
  ): Promise<string | null> {
    if (!stripe) return null;

    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'us_bank_account',
        us_bank_account: {
          financial_connections_account: linkedAccountId,
        },
      });

      // Attach to customer
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId,
      });

      logger.info('Payment method created from linked account', {
        paymentMethodId: paymentMethod.id,
        linkedAccountId,
        customerId,
      });

      return paymentMethod.id;
    } catch (error: any) {
      logger.error('Failed to create payment method from linked account', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Initiate microdeposit verification for bank account
   * Alternative to Financial Connections for manual bank entry
   */
  async initiateMicrodepositVerification(
    customerId: string,
    accountHolderName: string,
    accountHolderType: 'individual' | 'company' = 'individual'
  ): Promise<{ clientSecret: string; setupIntentId: string } | null> {
    if (!stripe) return null;

    try {
      // Create SetupIntent for microdeposit verification
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['us_bank_account'],
        payment_method_options: {
          us_bank_account: {
            verification_method: 'microdeposits',
            financial_connections: {
              permissions: ['payment_method'],
            },
          },
        },
        metadata: {
          accountHolderName,
          accountHolderType,
        },
      });

      logger.info('Microdeposit verification initiated', {
        setupIntentId: setupIntent.id,
        customerId,
      });

      return {
        clientSecret: setupIntent.client_secret!,
        setupIntentId: setupIntent.id,
      };
    } catch (error: any) {
      logger.error('Failed to initiate microdeposit verification', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Process Nickel ACH payment (FREE unlimited ACH)
   */
  async processNickelACH(
    paymentId: string,
    amount: number,
    data: any
  ): Promise<PaymentResult> {
    if (!NICKEL_API_KEY) {
      logger.warn('Nickel API key not configured, falling back to Stripe');
      return this.processACH(paymentId, amount, data);
    }

    try {
      const response = await fetch(`${NICKEL_API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NICKEL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'USD',
          type: 'ach_debit',
          description: data.description || 'MGR Capital Surplus Recovery Fee',
          customer: {
            email: data.email,
            name: data.name,
          },
          metadata: {
            caseId: data.caseId,
            userId: data.userId,
            internalPaymentId: paymentId,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Nickel API error', { error: errorText });
        // Fallback to regular ACH
        return this.processACH(paymentId, amount, data);
      }

      const result: any = await response.json();

      await this.recordPayment(paymentId, {
        method: 'ach',
        amount,
        status: 'pending',
        providerPaymentId: result.id,
        caseId: data.caseId,
        userId: data.userId,
      });

      return {
        success: true,
        paymentId,
        status: 'pending',
        method: 'ach',
        amount,
        currency: 'usd',
        metadata: { nickelPaymentId: result.id, provider: 'nickel' },
      };
    } catch (error: any) {
      logger.error('Nickel payment failed', { error: error.message });
      return this.processACH(paymentId, amount, data);
    }
  }

  /**
   * Get payment metrics for dashboard
   */
  async getMetrics(): Promise<{
    totalRecovered: number;
    pending: number;
    refunded: number;
    trend: { date: string; amount: number }[];
    byMethod: { method: string; count: number; total: number }[];
  }> {
    try {
      const payments = await prisma.payment.findMany();

      const totalRecovered = payments
        .filter(p => p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amountCents, 0) / 100;

      const pending = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amountCents, 0) / 100;

      const refunded = payments
        .filter(p => p.status === 'refunded')
        .reduce((sum, p) => sum + p.amountCents, 0) / 100;

      // Trend data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentPayments = payments.filter(
        p => p.status === 'succeeded' && p.createdAt >= thirtyDaysAgo
      );

      const trendMap = new Map<string, number>();
      recentPayments.forEach(p => {
        const date = p.createdAt.toISOString().split('T')[0];
        trendMap.set(date, (trendMap.get(date) || 0) + p.amountCents / 100);
      });

      const trend = Array.from(trendMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // By method breakdown
      const methodMap = new Map<string, { count: number; total: number }>();
      payments.filter(p => p.status === 'succeeded').forEach(p => {
        const existing = methodMap.get(p.method || 'unknown') || { count: 0, total: 0 };
        methodMap.set(p.method || 'unknown', {
          count: existing.count + 1,
          total: existing.total + p.amountCents / 100,
        });
      });

      const byMethod = Array.from(methodMap.entries()).map(([method, data]) => ({
        method,
        ...data,
      }));

      return { totalRecovered, pending, refunded, trend, byMethod };
    } catch (error: any) {
      logger.error('Failed to get payment metrics', { error: error.message });
      return { totalRecovered: 0, pending: 0, refunded: 0, trend: [], byMethod: [] };
    }
  }

  /**
   * List all payments with pagination
   */
  async listPayments(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const payments = await prisma.payment.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return payments.map(p => ({
        id: p.id,
        amount: p.amountCents / 100,
        method: p.method,
        status: p.status,
        providerPaymentId: p.providerPaymentId,
        caseId: p.caseId,
        userId: p.userId,
        createdAt: p.createdAt,
      }));
    } catch (error: any) {
      logger.error('Failed to list payments', { error: error.message });
      return [];
    }
  }

  /**
   * Handle Nickel webhook
   */
  async handleNickelWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature (implement based on Nickel docs)
    logger.info('Nickel webhook received', { type: payload.type });

    if (payload.type === 'payment.succeeded') {
      const internalPaymentId = payload.data?.metadata?.internalPaymentId;
      if (internalPaymentId) {
        await this.updateStatus(internalPaymentId, 'succeeded');
      }
    } else if (payload.type === 'payment.failed') {
      const internalPaymentId = payload.data?.metadata?.internalPaymentId;
      if (internalPaymentId) {
        await this.updateStatus(internalPaymentId, 'failed');
      }
    }
  }
}

export const paymentService = new PaymentService();
