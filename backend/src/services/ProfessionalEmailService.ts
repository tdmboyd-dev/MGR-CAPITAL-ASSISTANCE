/**
 * ProfessionalEmailService.ts — MGR CAPITAL ASSISTANCE
 *
 * Provides professional email addresses for clients and employees.
 * Integrates with email providers for custom domain hosting.
 *
 * PROVIDERS (in order of preference):
 * 1. Zoho Mail (FREE for 5 users, $1/user/month after)
 * 2. Google Workspace ($6/user/month)
 * 3. Microsoft 365 ($6/user/month)
 * 4. ImprovMX (FREE forwarding, $9/month for sending)
 *
 * FEATURES:
 * - Custom domain email (name@yourdomain.com)
 * - Email forwarding to personal email
 * - Webmail access
 * - IMAP/SMTP access
 * - Professional signatures
 * - Auto-billing to user account
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { aiUsageBillingService } from "./AiUsageBillingService.js";

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

// Provider API keys
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

const IMPROVMX_API_KEY = process.env.IMPROVMX_API_KEY;

// Platform domain for professional emails
const PLATFORM_DOMAIN = process.env.PROFESSIONAL_EMAIL_DOMAIN || 'mail.mgrcapital.com';

// Determine provider
const EMAIL_PROVIDER = ZOHO_CLIENT_ID ? 'zoho' :
  (IMPROVMX_API_KEY ? 'improvmx' : 'demo');

// Pricing (in cents per month)
const EMAIL_PRICING = {
  basic: 500,      // $5/month - forwarding only
  professional: 900,  // $9/month - full mailbox
  premium: 1500,   // $15/month - full mailbox + 50GB storage
};

// =============================================================================
// TYPES
// =============================================================================

export interface EmailAccount {
  id: string;
  userId: string;
  emailAddress: string;
  displayName: string;
  plan: 'basic' | 'professional' | 'premium';
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  provider: string;
  forwardTo?: string;
  createdAt: Date;
  expiresAt?: Date;
  monthlyPriceCents: number;
  webmailUrl?: string;
  imapServer?: string;
  smtpServer?: string;
}

export interface CreateEmailRequest {
  userId: string;
  desiredUsername: string;
  displayName: string;
  plan: 'basic' | 'professional' | 'premium';
  forwardTo?: string;
}

export interface EmailSignature {
  name: string;
  title?: string;
  company: string;
  phone?: string;
  email: string;
  website?: string;
  logoUrl?: string;
}

// =============================================================================
// PROFESSIONAL EMAIL SERVICE
// =============================================================================

class ProfessionalEmailService {
  /**
   * Create a professional email account
   */
  async createEmailAccount(request: CreateEmailRequest): Promise<EmailAccount> {
    const { userId, desiredUsername, displayName, plan, forwardTo } = request;

    // Validate username
    const username = this.sanitizeUsername(desiredUsername);
    const emailAddress = `${username}@${PLATFORM_DOMAIN}`;

    // Check availability
    const isAvailable = await this.checkAvailability(username);
    if (!isAvailable) {
      throw new Error(`Email address ${emailAddress} is not available`);
    }

    // Check user has sufficient balance
    const balance = await aiUsageBillingService.getUserBalance(userId);
    const priceCents = EMAIL_PRICING[plan];
    if (balance.creditBalanceCents < priceCents) {
      throw new Error(`Insufficient balance. Need $${(priceCents / 100).toFixed(2)} for ${plan} plan.`);
    }

    let account: EmailAccount;

    switch (EMAIL_PROVIDER) {
      case 'zoho':
        account = await this.createZohoAccount(userId, username, displayName, plan, forwardTo);
        break;
      case 'improvmx':
        account = await this.createImprovMxAccount(userId, username, displayName, plan, forwardTo);
        break;
      default:
        account = await this.createDemoAccount(userId, username, displayName, plan, forwardTo);
    }

    // Record billing
    await aiUsageBillingService.recordUsage({
      userId,
      type: 'email',
      provider: 'professional_monthly',
      quantity: 1,
      unit: 'mailbox',
      metadata: { emailAddress, plan },
    });

    // Store in database
    try {
      await prisma.professionalEmail.create({
        data: {
          userId,
          emailAddress,
          displayName,
          plan,
          status: 'active',
          provider: EMAIL_PROVIDER,
          forwardTo,
          monthlyPriceCents: priceCents,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    } catch (error) {
      logger.error('Failed to store email account', { error });
    }

    logger.info('Professional email created', { userId, emailAddress, plan });
    return account;
  }

  /**
   * Zoho Mail API integration
   */
  private async createZohoAccount(
    userId: string,
    username: string,
    displayName: string,
    plan: string,
    forwardTo?: string
  ): Promise<EmailAccount> {
    try {
      // Get access token
      const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: ZOHO_REFRESH_TOKEN!,
          client_id: ZOHO_CLIENT_ID!,
          client_secret: ZOHO_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }),
      });

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Create user account
      const createResponse = await fetch(
        `https://mail.zoho.com/api/organization/${ZOHO_ORG_ID}/accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            primaryEmailAddress: `${username}@${PLATFORM_DOMAIN}`,
            displayName,
            password: this.generateTempPassword(),
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Zoho API error: ${createResponse.status}`);
      }

      const data: any = await createResponse.json();

      return {
        id: data.data.accountId,
        userId,
        emailAddress: `${username}@${PLATFORM_DOMAIN}`,
        displayName,
        plan: plan as any,
        status: 'active',
        provider: 'zoho',
        forwardTo,
        createdAt: new Date(),
        monthlyPriceCents: EMAIL_PRICING[plan as keyof typeof EMAIL_PRICING],
        webmailUrl: 'https://mail.zoho.com',
        imapServer: 'imap.zoho.com',
        smtpServer: 'smtp.zoho.com',
      };
    } catch (error: any) {
      logger.error('Zoho API error', { error: error.message });
      return this.createDemoAccount(userId, username, displayName, plan, forwardTo);
    }
  }

  /**
   * ImprovMX API integration (forwarding + sending)
   */
  private async createImprovMxAccount(
    userId: string,
    username: string,
    displayName: string,
    plan: string,
    forwardTo?: string
  ): Promise<EmailAccount> {
    try {
      // Create alias for forwarding
      const response = await fetch(
        `https://api.improvmx.com/v3/domains/${PLATFORM_DOMAIN}/aliases`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${IMPROVMX_API_KEY}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alias: username,
            forward: forwardTo || `${userId}@temp.mgrcapital.com`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ImprovMX API error: ${response.status}`);
      }

      const data: any = await response.json();

      return {
        id: data.alias.id || `improvmx_${username}`,
        userId,
        emailAddress: `${username}@${PLATFORM_DOMAIN}`,
        displayName,
        plan: plan as any,
        status: 'active',
        provider: 'improvmx',
        forwardTo,
        createdAt: new Date(),
        monthlyPriceCents: EMAIL_PRICING[plan as keyof typeof EMAIL_PRICING],
        webmailUrl: 'https://app.improvmx.com',
        smtpServer: 'smtp.improvmx.com',
      };
    } catch (error: any) {
      logger.error('ImprovMX API error', { error: error.message });
      return this.createDemoAccount(userId, username, displayName, plan, forwardTo);
    }
  }

  /**
   * Demo account for testing
   */
  private async createDemoAccount(
    userId: string,
    username: string,
    displayName: string,
    plan: string,
    forwardTo?: string
  ): Promise<EmailAccount> {
    logger.info('Demo email account created', {
      emailAddress: `${username}@${PLATFORM_DOMAIN}`,
      note: 'Set ZOHO_CLIENT_ID or IMPROVMX_API_KEY for real email',
    });

    return {
      id: `demo_email_${Date.now()}`,
      userId,
      emailAddress: `${username}@${PLATFORM_DOMAIN}`,
      displayName,
      plan: plan as any,
      status: 'active',
      provider: 'demo',
      forwardTo,
      createdAt: new Date(),
      monthlyPriceCents: 0, // Free in demo
      webmailUrl: `https://demo.mail.mgrcapital.com/${username}`,
      imapServer: 'imap.demo.mgrcapital.com',
      smtpServer: 'smtp.demo.mgrcapital.com',
    };
  }

  /**
   * Check email availability
   */
  async checkAvailability(username: string): Promise<boolean> {
    const sanitized = this.sanitizeUsername(username);

    // Check reserved usernames
    const reserved = ['admin', 'support', 'help', 'info', 'contact', 'noreply', 'mail', 'postmaster', 'abuse'];
    if (reserved.includes(sanitized.toLowerCase())) {
      return false;
    }

    // Check database
    try {
      const existing = await prisma.professionalEmail.findFirst({
        where: { emailAddress: `${sanitized}@${PLATFORM_DOMAIN}` },
      });
      return !existing;
    } catch {
      return true; // Assume available if DB check fails
    }
  }

  /**
   * Get user's email accounts
   */
  async getUserAccounts(userId: string): Promise<EmailAccount[]> {
    try {
      const accounts = await prisma.professionalEmail.findMany({
        where: { userId },
      });

      return accounts.map(a => ({
        id: a.id,
        userId: a.userId,
        emailAddress: a.emailAddress,
        displayName: a.displayName,
        plan: a.plan as any,
        status: a.status as any,
        provider: a.provider,
        forwardTo: a.forwardTo || undefined,
        createdAt: a.createdAt,
        expiresAt: a.expiresAt || undefined,
        monthlyPriceCents: a.monthlyPriceCents,
        webmailUrl: this.getWebmailUrl(a.provider),
        imapServer: this.getImapServer(a.provider),
        smtpServer: this.getSmtpServer(a.provider),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Generate email signature HTML
   */
  generateSignature(signature: EmailSignature): string {
    return `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-right: 15px; border-right: 2px solid #1a365d;">
      ${signature.logoUrl ? `<img src="${signature.logoUrl}" alt="${signature.company}" style="max-width: 100px;">` : ''}
    </td>
    <td style="padding-left: 15px;">
      <div style="font-weight: bold; font-size: 16px; color: #1a365d;">${signature.name}</div>
      ${signature.title ? `<div style="color: #666;">${signature.title}</div>` : ''}
      <div style="font-weight: bold; margin-top: 5px;">${signature.company}</div>
      <div style="margin-top: 10px;">
        ${signature.phone ? `<div>📞 ${signature.phone}</div>` : ''}
        <div>✉️ <a href="mailto:${signature.email}" style="color: #1a365d;">${signature.email}</a></div>
        ${signature.website ? `<div>🌐 <a href="${signature.website}" style="color: #1a365d;">${signature.website}</a></div>` : ''}
      </div>
    </td>
  </tr>
</table>
    `.trim();
  }

  /**
   * Renew email subscription
   */
  async renewSubscription(accountId: string): Promise<boolean> {
    try {
      const account = await prisma.professionalEmail.findUnique({
        where: { id: accountId },
      });

      if (!account) return false;

      // Charge user
      const balance = await aiUsageBillingService.getUserBalance(account.userId);
      if (balance.creditBalanceCents < account.monthlyPriceCents) {
        // Suspend account
        await prisma.professionalEmail.update({
          where: { id: accountId },
          data: { status: 'suspended' },
        });
        return false;
      }

      // Record billing
      await aiUsageBillingService.recordUsage({
        userId: account.userId,
        type: 'email',
        provider: 'professional_monthly',
        quantity: 1,
        unit: 'mailbox',
        metadata: { emailAddress: account.emailAddress, renewal: true },
      });

      // Extend subscription
      await prisma.professionalEmail.update({
        where: { id: accountId },
        data: {
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to renew email subscription', { error, accountId });
      return false;
    }
  }

  /**
   * Cancel email account
   */
  async cancelAccount(accountId: string): Promise<boolean> {
    try {
      await prisma.professionalEmail.update({
        where: { id: accountId },
        data: { status: 'cancelled' },
      });

      // TODO: Delete from provider API
      logger.info('Email account cancelled', { accountId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel email account', { error, accountId });
      return false;
    }
  }

  /**
   * Get pricing
   */
  getPricing(): typeof EMAIL_PRICING {
    return EMAIL_PRICING;
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    provider: string;
    available: boolean;
    domain: string;
  } {
    return {
      provider: EMAIL_PROVIDER,
      available: true,
      domain: PLATFORM_DOMAIN,
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private sanitizeUsername(username: string): string {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[.-]|[.-]$/g, '')
      .substring(0, 64);
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private getWebmailUrl(provider: string): string {
    const urls: Record<string, string> = {
      zoho: 'https://mail.zoho.com',
      improvmx: 'https://app.improvmx.com',
      google: 'https://mail.google.com',
      microsoft: 'https://outlook.office.com',
      demo: `https://demo.mail.mgrcapital.com`,
    };
    return urls[provider] || urls.demo;
  }

  private getImapServer(provider: string): string {
    const servers: Record<string, string> = {
      zoho: 'imap.zoho.com',
      google: 'imap.gmail.com',
      microsoft: 'outlook.office365.com',
      demo: 'imap.demo.mgrcapital.com',
    };
    return servers[provider] || servers.demo;
  }

  private getSmtpServer(provider: string): string {
    const servers: Record<string, string> = {
      zoho: 'smtp.zoho.com',
      improvmx: 'smtp.improvmx.com',
      google: 'smtp.gmail.com',
      microsoft: 'smtp.office365.com',
      demo: 'smtp.demo.mgrcapital.com',
    };
    return servers[provider] || servers.demo;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const professionalEmailService = new ProfessionalEmailService();
export default professionalEmailService;
