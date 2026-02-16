/**
 * EmailService.ts — MGR CAPITAL ASSISTANCE
 * Production Email System with nodemailer + MJML templates + drip sequences
 *
 * PROVIDER CHAIN (automatic failover):
 * 1. Modoboa SMTP (mail.capitalmgr.com) — PRIMARY (self-hosted, unlimited, $0)
 * 2. Brevo API (300 emails/day) — FALLBACK ONLY
 * 3. Console log — LAST RESORT (dev only)
 *
 * NO PAID EMAIL DEPENDENCY — Modoboa handles all production email
 */

import nodemailer from 'nodemailer';
// @ts-ignore - mjml types may not be installed
import mjml2html from 'mjml';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Provider configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM = process.env.BREVO_FROM || process.env.SMTP_FROM || 'admin@capitalmgr.com';
const SMTP_FROM = process.env.SMTP_FROM || 'admin@capitalmgr.com';

// Modoboa SMTP configuration (self-hosted, unlimited, $0) — PRIMARY
const MODOBOA_SMTP_HOST = process.env.MODOBOA_SMTP_HOST;
const MODOBOA_SMTP_PORT = parseInt(process.env.MODOBOA_SMTP_PORT || '587');
const MODOBOA_SMTP_USER = process.env.MODOBOA_NOREPLY_EMAIL;
const MODOBOA_SMTP_PASS = process.env.MODOBOA_NOREPLY_PASS;

// Amazon SES SMTP configuration — FALLBACK
const SES_SMTP_HOST = process.env.SMTP_HOST;
const SES_SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SES_SMTP_USER = process.env.SMTP_USER;
const SES_SMTP_PASS = process.env.SMTP_PASS;

// Build Modoboa SMTP transporter (PRIMARY)
let modoboaTransporter: nodemailer.Transporter | null = null;
if (MODOBOA_SMTP_HOST && MODOBOA_SMTP_USER && MODOBOA_SMTP_PASS) {
  try {
    modoboaTransporter = nodemailer.createTransport({
      host: MODOBOA_SMTP_HOST,
      port: MODOBOA_SMTP_PORT,
      secure: false,
      auth: {
        user: MODOBOA_SMTP_USER,
        pass: MODOBOA_SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    logger.info('[EmailService] Modoboa SMTP configured as PRIMARY');
  } catch (err: any) {
    logger.warn(`[EmailService] Modoboa SMTP transport creation failed: ${err.message}`);
  }
}

// Build Amazon SES SMTP transporter (FALLBACK)
let smtpTransporter: nodemailer.Transporter | null = null;
if (SES_SMTP_HOST && SES_SMTP_USER && SES_SMTP_PASS) {
  try {
    smtpTransporter = nodemailer.createTransport({
      host: SES_SMTP_HOST,
      port: SES_SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: SES_SMTP_USER,
        pass: SES_SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    logger.info('[EmailService] Amazon SES SMTP configured as FALLBACK');
  } catch (err: any) {
    logger.warn(`[EmailService] Amazon SES SMTP transport creation failed: ${err.message}`);
  }
}

// Determine primary provider — Modoboa is PRIMARY, SES and Brevo are fallbacks
const PRIMARY_PROVIDER = modoboaTransporter ? 'modoboa' : (smtpTransporter ? 'ses' : (BREVO_API_KEY ? 'brevo' : 'log'));
logger.info(`[EmailService] Provider chain: Modoboa=${modoboaTransporter ? 'YES' : 'NO'}, SES=${smtpTransporter ? 'YES' : 'NO'}, Brevo=${BREVO_API_KEY ? 'YES' : 'NO'}`);

// Email templates stored in memory
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

  portalLink: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-image width="120px" src="https://mgrcapital.com/logo.png" alt="MGR Capital" />
            <mj-text font-size="24px" color="#1e40af" font-weight="bold" align="center">
              Your Case Portal is Ready
            </mj-text>
            <mj-text font-size="16px" color="#333" line-height="1.6">
              Hello ${data.clientName}, your secure case portal has been set up. Use the link below to view your case status, upload documents, and sign forms.
            </mj-text>
            <mj-button background-color="#3b82f6" color="white" href="${data.portalUrl}" border-radius="8px" font-size="16px">
              Open Your Portal
            </mj-button>
            <mj-text font-size="12px" color="#888" align="center">
              This link is secure and does not require a password. Do not share it with others.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  documentReady: (data) => `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <mj-section padding="40px 20px" background-color="#ffffff" border-radius="8px">
          <mj-column>
            <mj-text font-size="24px" color="#1e40af" font-weight="bold">
              Documents Ready for Signing
            </mj-text>
            <mj-text font-size="16px" color="#333">
              Hello ${data.clientName}, your documents are ready to be reviewed and signed.
            </mj-text>
            <mj-text font-size="14px" color="#666">
              Case: ${data.caseNumber}
            </mj-text>
            <mj-button background-color="#16a34a" color="white" href="${data.signUrl}" border-radius="8px" font-size="16px">
              Review & Sign Documents
            </mj-button>
            <mj-text font-size="12px" color="#888">
              Please complete signing within 7 days to avoid delays in your case.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `,

  sms: (data) => data.body, // Plain text for SMS gateway
};

export class EmailService {
  private modoboaVerified: boolean = false;
  private modoboaFailed: boolean = false;
  private sesVerified: boolean = false;
  private sesFailed: boolean = false;

  constructor() {
    // Verify Modoboa SMTP connection asynchronously (don't block startup)
    if (modoboaTransporter) {
      modoboaTransporter.verify()
        .then(() => {
          this.modoboaVerified = true;
          logger.info('[EmailService] Modoboa SMTP connection verified');
        })
        .catch((err: any) => {
          this.modoboaFailed = true;
          logger.warn(`[EmailService] Modoboa SMTP verification failed (${err.message}) — will use SES/Brevo`);
        });
    }

    // Verify Amazon SES SMTP connection asynchronously
    if (smtpTransporter) {
      smtpTransporter.verify()
        .then(() => {
          this.sesVerified = true;
          logger.info('[EmailService] Amazon SES SMTP connection verified');
        })
        .catch((err: any) => {
          this.sesFailed = true;
          logger.warn(`[EmailService] Amazon SES SMTP verification failed (${err.message}) — will use Brevo`);
        });
    }
  }

  /**
   * Get service status
   */
  getStatus(): { provider: string; configured: boolean; brevo: boolean; modoboa: boolean; ses: boolean; modoboaVerified: boolean; sesVerified: boolean } {
    return {
      provider: PRIMARY_PROVIDER,
      configured: PRIMARY_PROVIDER !== 'log',
      brevo: !!BREVO_API_KEY,
      modoboa: !!modoboaTransporter,
      ses: !!smtpTransporter,
      modoboaVerified: this.modoboaVerified,
      sesVerified: this.sesVerified,
    };
  }

  /**
   * Send email with automatic failover chain:
   * Modoboa SMTP → Amazon SES SMTP → Brevo API → Console Log
   */
  async send(templateName: string, to: string, data: Record<string, any>): Promise<boolean> {
    const html = this.renderTemplate(templateName, data);
    const subject = data.subject || 'MGR Capital Notification';
    const plainText = data.plainText || this.stripHtml(html);

    // Try Modoboa SMTP first (self-hosted, unlimited, $0 cost)
    if (modoboaTransporter && !this.modoboaFailed) {
      const modoboaResult = await this.sendViaModoboa(to, subject, html, plainText);
      if (modoboaResult) return true;
      logger.warn('[EmailService] Modoboa SMTP failed, trying Amazon SES fallback...');
    }

    // Try Amazon SES SMTP as second option
    if (smtpTransporter && !this.sesFailed) {
      const sesResult = await this.sendViaSES(to, subject, html, plainText);
      if (sesResult) return true;
      logger.warn('[EmailService] Amazon SES failed, trying Brevo fallback...');
    }

    // Try Brevo as last API fallback (external API, rate limited)
    if (BREVO_API_KEY) {
      const brevoResult = await this.sendViaBrevo(to, subject, html, plainText);
      if (brevoResult) return true;
      logger.warn('[EmailService] Brevo fallback also failed');
    }

    // Last resort: log the email
    logger.info('[EmailService] Email logged (no working provider)', {
      template: templateName,
      to,
      subject,
      bodyPreview: plainText.substring(0, 200),
    });
    return process.env.NODE_ENV === 'development'; // Return true in dev so flows don't break
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
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'MGR Capital Assistance',
            email: BREVO_FROM,
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('[EmailService] Brevo API error', { status: response.status, error: errorBody });
        return false;
      }

      const result: any = await response.json();
      logger.info('[EmailService] Email sent via Brevo', { to, subject, messageId: result.messageId });
      return true;
    } catch (error: any) {
      logger.error('[EmailService] Brevo send exception', { error: error.message });
      return false;
    }
  }

  /**
   * Send email via Modoboa SMTP (self-hosted, unlimited, $0 cost)
   */
  private async sendViaModoboa(to: string, subject: string, html: string, text: string): Promise<boolean> {
    if (!modoboaTransporter) return false;

    try {
      const info = await modoboaTransporter.sendMail({
        from: `"MGR Capital Assistance" <${MODOBOA_SMTP_USER || SMTP_FROM}>`,
        to,
        subject,
        html,
        text,
      });

      logger.info('[EmailService] Email sent via Modoboa SMTP', { to, subject, messageId: info.messageId });
      this.modoboaVerified = true;
      return true;
    } catch (error: any) {
      logger.error('[EmailService] Modoboa SMTP send failed', { error: error.message, code: error.code });
      if (error.responseCode === 535 || error.code === 'EAUTH') {
        this.modoboaFailed = true;
        logger.warn('[EmailService] Modoboa SMTP auth failed permanently — disabling for this session');
      }
      return false;
    }
  }

  /**
   * Send email via Amazon SES SMTP (paid, reliable)
   */
  private async sendViaSES(to: string, subject: string, html: string, text: string): Promise<boolean> {
    if (!smtpTransporter) return false;

    try {
      const info = await smtpTransporter.sendMail({
        from: `"MGR Capital Assistance" <${SMTP_FROM}>`,
        to,
        subject,
        html,
        text,
      });

      logger.info('[EmailService] Email sent via Amazon SES SMTP', { to, subject, messageId: info.messageId });
      this.sesVerified = true;
      return true;
    } catch (error: any) {
      logger.error('[EmailService] Amazon SES SMTP send failed', { error: error.message, code: error.code });
      if (error.responseCode === 535 || error.code === 'EAUTH') {
        this.sesFailed = true;
        logger.warn('[EmailService] Amazon SES SMTP auth failed permanently — disabling for this session');
      }
      return false;
    }
  }

  /**
   * Send drip email sequence with delays
   */
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

  /**
   * Send bulk emails to multiple recipients
   */
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

      // Rate limit: 100ms between sends to avoid provider throttling
      await new Promise(r => setTimeout(r, 100));
    }

    return { sent, failed };
  }

  /**
   * Send a simple text email (no template)
   */
  async sendRaw(to: string, subject: string, body: string): Promise<boolean> {
    return this.send('_raw', to, { subject, body, title: subject });
  }

  private renderTemplate(name: string, data: any): string {
    const templateFn = TEMPLATES[name];
    if (!templateFn) {
      // Default template for any unrecognized name
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
