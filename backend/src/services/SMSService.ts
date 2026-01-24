/**
 * SMSService.ts — MGR CAPITAL ASSISTANCE
 * Custom SMS Gateway via carrier email-to-SMS gateways (NO Twilio)
 */

import { emailService } from './EmailService.js';
import { logger } from '../utils/logger.js';

// US carrier email-to-SMS gateways
const CARRIER_GATEWAYS: Record<string, string> = {
  verizon: '@vtext.com',
  att: '@txt.att.net',
  tmobile: '@tmomail.net',
  sprint: '@messaging.sprintpcs.com',
  uscellular: '@email.uscc.net',
  virgin: '@vmobl.com',
  boost: '@sms.myboostmobile.com',
  cricket: '@sms.cricketwireless.net',
  metro: '@mymetropcs.com',
  tracfone: '@mmst5.tracfone.com',
  // MMS gateways (for longer messages or media)
  verizon_mms: '@vzwpix.com',
  att_mms: '@mms.att.net',
  tmobile_mms: '@tmomail.net',
};

export type CarrierType = keyof typeof CARRIER_GATEWAYS;

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSService {
  /**
   * Send SMS via carrier email gateway
   * @param to Phone number (10 digits, US)
   * @param message Text message (max 160 chars for SMS)
   * @param carrier Carrier name
   */
  async send(
    to: string,
    message: string,
    carrier: CarrierType = 'verizon'
  ): Promise<SMSResult> {
    try {
      const gateway = CARRIER_GATEWAYS[carrier];
      if (!gateway) {
        return { success: false, error: 'Unsupported carrier' };
      }

      // Clean phone number (remove non-digits)
      const cleanNumber = to.replace(/\D/g, '');
      if (cleanNumber.length !== 10) {
        return { success: false, error: 'Invalid phone number (must be 10 digits)' };
      }

      const smsEmail = `${cleanNumber}${gateway}`;
      const truncatedMessage = message.substring(0, 160); // SMS limit

      const success = await emailService.send('sms', smsEmail, {
        subject: '', // Most carriers ignore subject for SMS
        body: truncatedMessage,
        plainText: truncatedMessage,
      });

      if (success) {
        logger.info('SMS sent', { to: cleanNumber, carrier });
        return { success: true, messageId: `sms_${Date.now()}` };
      } else {
        return { success: false, error: 'Failed to send via email gateway' };
      }
    } catch (error) {
      logger.error('SMS send error', { to, carrier, error });
      return { success: false, error: 'SMS send failed' };
    }
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendBulk(
    numbers: { phone: string; carrier: CarrierType }[],
    message: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const { phone, carrier } of numbers) {
      const result = await this.send(phone, message, carrier);
      if (result.success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  /**
   * Send MMS (longer message or with media support)
   */
  async sendMMS(
    to: string,
    message: string,
    carrier: CarrierType = 'verizon'
  ): Promise<SMSResult> {
    // Use MMS gateway if available
    const mmsCarrier = `${carrier}_mms` as CarrierType;
    const gateway = CARRIER_GATEWAYS[mmsCarrier] || CARRIER_GATEWAYS[carrier];

    if (!gateway) {
      return { success: false, error: 'Unsupported carrier' };
    }

    const cleanNumber = to.replace(/\D/g, '');
    const mmsEmail = `${cleanNumber}${gateway}`;

    const success = await emailService.send('sms', mmsEmail, {
      subject: '',
      body: message,
      plainText: message,
    });

    return success
      ? { success: true, messageId: `mms_${Date.now()}` }
      : { success: false, error: 'MMS send failed' };
  }

  /**
   * Detect carrier from phone number (basic implementation)
   * In production, use a number lookup API
   */
  detectCarrier(phoneNumber: string): CarrierType {
    // This is a placeholder - real implementation would use a lookup API
    // For now, default to Verizon
    return 'verizon';
  }

  /**
   * Get list of supported carriers
   */
  getSupportedCarriers(): string[] {
    return Object.keys(CARRIER_GATEWAYS).filter(c => !c.includes('_mms'));
  }
}

export const smsService = new SMSService();
