/**
 * EmailService.ts — MGR CAPITAL ASSISTANCE
 * Custom Email System with nodemailer + MJML templates + drip sequences
 *
 * RECOMMENDED PROVIDERS (see BEST_APIS_GUIDE.md):
 * 1. Brevo (FREE 300 emails/day) - Best free tier
 * 2. Amazon SES ($0.10/1000 emails) - Cheapest at scale
 * 3. MailerSend (FREE 500/month) - Good alternative
 */

import nodemailer from 'nodemailer';
import mjml2html from 'mjml';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Brevo API key (FREE 300 emails/day)
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Determine email provider
const EMAIL_PROVIDER = BREVO_API_KEY ? 'brevo' : (process.env.SMTP_HOST ? 'smtp' : 'demo');

// SMTP transport (for generic SMTP or Amazon SES)
const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

logger.info(`[EmailService] Using ${EMAIL_PROVIDER.toUpperCase()} for email delivery`);

// Email templates stored in memory (can be moved to DB)
const TEMPLATES: Record<string, (data: any) => string> = {
  welcome: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-image width="120px" src="https://mgrcapital.com/logo.png" alt="MGR Capital" />
            <mj-text font-size="28px" color="#1e40af" align="center" font-weight="bold">
              Welcome to MGR Capital, ${data.name}!
            </mj-text>
            <mj-text font-size="16px" color="#333" line-height="1.6">
              Your account has been created successfully. You can now access all features of the platform.
            </mj-text>
            <mj-button background-color="#3b82f6" color="white" href="${data.loginUrl || 'https://app.mgrcapital.com/login'}" border-radius="8px" font-size="16px">
              Sign In to Your Account
            </mj-button>
          </mj-column>
        </mj-section>
        <mj-section padding="20px">
          <mj-column>
            <mj-text font-size="12px" color="#888" align="center">
              © ${new Date().getFullYear()} MGR Capital Assistance. All rights reserved.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  caseUpdate: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-text font-size="24px" color="#1e40af" font-weight="bold">
              Case Update: ${data.caseNumber}
            </mj-text>
            <mj-text font-size="16px" color="#333">
              Status changed to: <strong>${data.newStatus}</strong>
            </mj-text>
            <mj-text font-size="14px" color="#666">
              ${data.message || 'Your case has been updated.'}
            </mj-text>
            <mj-button background-color="#3b82f6" color="white" href="${data.caseUrl}" border-radius="8px">
              View Case Details
            </mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  paymentReceived: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-text font-size="24px" color="#16a34a" font-weight="bold" align="center">
              Payment Received!
            </mj-text>
            <mj-text font-size="32px" color="#333" align="center" font-weight="bold">
              $${(data.amount / 100).toFixed(2)}
            </mj-text>
            <mj-text font-size="14px" color="#666" align="center">
              Transaction ID: ${data.transactionId}
            </mj-text>
            <mj-divider border-color="#e5e7eb" />
            <mj-text font-size="14px" color="#666">
              Thank you for your payment. Your funds have been processed successfully.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  passwordReset: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-text font-size="24px" color="#1e40af" font-weight="bold">
              Password Reset Request
            </mj-text>
            <mj-text font-size="16px" color="#333">
              Click the button below to reset your password. This link expires in 1 hour.
            </mj-text>
            <mj-button background-color="#dc2626" color="white" href="${data.resetUrl}" border-radius="8px">
              Reset Password
            </mj-button>
            <mj-text font-size="12px" color="#888">
              If you didn't request this, please ignore this email.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  sms: (data) => data.body, // Plain text for SMS gateway
};

export class EmailService {
  private provider: string;

  constructor() {
    this.provider = EMAIL_PROVIDER;
  }

  /**
   * Get service status
   */
  getStatus(): { provider: string; configured: boolean } {
    return {
      provider: this.provider,
      configured: this.provider !== 'demo',
    };
  }

  async send(templateName: string, to: string, data: Record<string, any>): Promise<boolean> {
    const html = this.renderTemplate(templateName, data);
    const subject = data.subject || 'MGR Capital Notification';
    const plainText = data.plainText || this.stripHtml(html);

    // Use Brevo if configured (FREE 300 emails/day)
    if (BREVO_API_KEY) {
      return this.sendViaBrevo(to, subject, html, plainText);
    }

    // Use SMTP if configured
    if (transporter) {
      return this.sendViaSMTP(to, subject, html, plainText);
    }

    // Demo mode - log but don't send
    logger.info('[DEMO] Email would be sent', { template: templateName, to, subject });
    return true;
  }

  /**
   * Send email via Brevo API (FREE 300/day)
   */
  private async sendViaBrevo(to: string, subject: string, html: string, text: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'MGR Capital',
            email: process.env.BREVO_FROM || 'no-reply@mgrcapital.com',
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Brevo API error', { error });
        return false;
      }

      logger.info('Email sent via Brevo', { to, subject });
      return true;
    } catch (error: any) {
      logger.error('Brevo send failed', { error: error.message });
      return false;
    }
  }

  /**
   * Send email via SMTP (Amazon SES, generic SMTP)
   */
  private async sendViaSMTP(to: string, subject: string, html: string, text: string): Promise<boolean> {
    try {
      await transporter!.sendMail({
        from: `"MGR Capital" <${process.env.SMTP_FROM || 'no-reply@mgrcapital.com'}>`,
        to,
        subject,
        html,
        text,
      });

      logger.info('Email sent via SMTP', { to, subject });
      return true;
    } catch (error: any) {
      logger.error('SMTP send failed', { error: error.message });
      return false;
    }
  }

  async sendDripSequence(
    to: string,
    sequence: { template: string; delayMs: number; data: any }[]
  ): Promise<void> {
    for (const step of sequence) {
      await this.send(step.template, to, step.data);
      if (step.delayMs > 0) {
        await new Promise(r => setTimeout(r, step.delayMs));
      }
    }
  }

  async sendBulk(
    recipients: string[],
    templateName: string,
    data: Record<string, any>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const to of recipients) {
      const success = await this.send(templateName, to, data);
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  private renderTemplate(name: string, data: any): string {
    const templateFn = TEMPLATES[name];
    if (!templateFn) {
      // Default template
      const mjml = `
        <mjml>
          <mj-body background-color="#f0f0f0">
            <mj-section padding="20px" background-color="#ffffff">
              <mj-column>
                <mj-text font-size="24px" color="#1e40af" align="center">
                  ${data.title || 'MGR Capital Notification'}
                </mj-text>
                <mj-text font-size="16px" color="#333">
                  ${data.body || 'You have a new notification.'}
                </mj-text>
                ${data.ctaLink ? `
                  <mj-button background-color="#3b82f6" color="white" href="${data.ctaLink}">
                    ${data.ctaText || 'View Details'}
                  </mj-button>
                ` : ''}
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `;
      const { html } = mjml2html(mjml);
      return html;
    }

    const mjml = templateFn(data);

    // Check if it's already HTML (for SMS)
    if (!mjml.includes('<mjml>')) {
      return mjml;
    }

    const { html } = mjml2html(mjml);
    return html;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

export const emailService = new EmailService();
