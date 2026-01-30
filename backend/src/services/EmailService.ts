/**
 * EmailService.ts — MGR CAPITAL ASSISTANCE
 * Production Email System with nodemailer + MJML templates + drip sequences
 *
 * PROVIDER CHAIN (automatic failover):
 * 1. Brevo API (FREE 300 emails/day) — PRIMARY
 * 2. Amazon SES via SMTP ($0.10/1000) — FALLBACK
 * 3. Generic SMTP — FALLBACK
 * 4. Console log — LAST RESORT (dev only)
 */

import nodemailer from 'nodemailer';
import mjml2html from 'mjml';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Provider configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM = process.env.BREVO_FROM || process.env.SMTP_FROM || 'admin@capitalmgr.com';
const SMTP_FROM = process.env.SMTP_FROM || 'admin@capitalmgr.com';

// Build SMTP transporter only if configured
let smtpTransporter: nodemailer.Transporter | null = null;
if (process.env.SMTP_HOST) {
  try {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } catch (err: any) {
    logger.warn(`[EmailService] SMTP transport creation failed: ${err.message}`);
  }
}

// Determine primary provider
const PRIMARY_PROVIDER = BREVO_API_KEY ? 'brevo' : (smtpTransporter ? 'smtp' : 'log');
logger.info(`[EmailService] Primary provider: ${PRIMARY_PROVIDER.toUpperCase()}, Brevo: ${BREVO_API_KEY ? 'YES' : 'NO'}, SMTP: ${smtpTransporter ? 'YES' : 'NO'}`);

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
  private smtpVerified: boolean = false;
  private smtpFailed: boolean = false;

  constructor() {
    // Verify SMTP connection asynchronously (don't block startup)
    if (smtpTransporter) {
      smtpTransporter.verify()
        .then(() => {
          this.smtpVerified = true;
          logger.info('[EmailService] SMTP connection verified');
        })
        .catch((err: any) => {
          this.smtpFailed = true;
          logger.warn(`[EmailService] SMTP verification failed (${err.message}) — will use Brevo`);
        });
    }
  }

  /**
   * Get service status
   */
  getStatus(): { provider: string; configured: boolean; brevo: boolean; smtp: boolean; smtpVerified: boolean } {
    return {
      provider: PRIMARY_PROVIDER,
      configured: PRIMARY_PROVIDER !== 'log',
      brevo: !!BREVO_API_KEY,
      smtp: !!smtpTransporter,
      smtpVerified: this.smtpVerified,
    };
  }

  /**
   * Send email with automatic failover chain:
   * Brevo API → SMTP → Console Log
   */
  async send(templateName: string, to: string, data: Record<string, any>): Promise<boolean> {
    const html = this.renderTemplate(templateName, data);
    const subject = data.subject || 'MGR Capital Notification';
    const plainText = data.plainText || this.stripHtml(html);

    // Try Brevo first (most reliable, FREE)
    if (BREVO_API_KEY) {
      const brevoResult = await this.sendViaBrevo(to, subject, html, plainText);
      if (brevoResult) return true;
      logger.warn('[EmailService] Brevo failed, trying SMTP fallback...');
    }

    // Try SMTP second (only if not known-failed)
    if (smtpTransporter && !this.smtpFailed) {
      const smtpResult = await this.sendViaSMTP(to, subject, html, plainText);
      if (smtpResult) return true;
      logger.warn('[EmailService] SMTP failed, falling back to log mode');
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

      const result = await response.json();
      logger.info('[EmailService] Email sent via Brevo', { to, subject, messageId: result.messageId });
      return true;
    } catch (error: any) {
      logger.error('[EmailService] Brevo send exception', { error: error.message });
      return false;
    }
  }

  /**
   * Send email via SMTP (Amazon SES or generic SMTP)
   */
  private async sendViaSMTP(to: string, subject: string, html: string, text: string): Promise<boolean> {
    try {
      const info = await smtpTransporter!.sendMail({
        from: `"MGR Capital Assistance" <${SMTP_FROM}>`,
        to,
        subject,
        html,
        text,
      });

      logger.info('[EmailService] Email sent via SMTP', { to, subject, messageId: info.messageId });
      this.smtpVerified = true; // Mark as working
      return true;
    } catch (error: any) {
      logger.error('[EmailService] SMTP send failed', { error: error.message, code: error.code });
      // If auth failed (535), mark SMTP as permanently failed for this session
      if (error.responseCode === 535 || error.code === 'EAUTH') {
        this.smtpFailed = true;
        logger.warn('[EmailService] SMTP auth failed permanently (535) — disabling SMTP for this session');
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
