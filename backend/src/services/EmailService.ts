/**
 * EmailService.ts — MGR CAPITAL ASSISTANCE
 * Custom Email System with nodemailer + MJML templates + drip sequences
 */

import nodemailer from 'nodemailer';
import mjml2html from 'mjml';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
  async send(templateName: string, to: string, data: Record<string, any>): Promise<boolean> {
    try {
      const html = this.renderTemplate(templateName, data);

      await transporter.sendMail({
        from: `"MGR Capital" <${process.env.SMTP_FROM || 'no-reply@mgrcapital.com'}>`,
        to,
        subject: data.subject || 'MGR Capital Notification',
        html,
        text: data.plainText || this.stripHtml(html),
      });

      logger.info('Email sent', { template: templateName, to });
      return true;
    } catch (error) {
      logger.error('Email send failed', { template: templateName, to, error });
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
