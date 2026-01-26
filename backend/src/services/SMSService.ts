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
   * Detect carrier from phone number using area code heuristics
   * Note: This is a best-guess based on market share. For 100% accuracy,
   * use a number lookup API like NumVerify or Twilio Lookup.
   */
  detectCarrier(phoneNumber: string): CarrierType {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const areaCode = cleanNumber.substring(0, 3);

    // Major carrier area code tendencies (based on market presence)
    // This is heuristic-based - carriers own numbers across all area codes
    const carrierAreaCodeHints: Record<string, CarrierType[]> = {
      // Northeast heavy AT&T
      '212': ['att', 'verizon'], '718': ['att', 'verizon'], '917': ['att', 'tmobile'],
      // California heavy T-Mobile/AT&T
      '213': ['tmobile', 'att'], '310': ['att', 'tmobile'], '415': ['att', 'tmobile'],
      '408': ['att', 'tmobile'], '650': ['att', 'verizon'],
      // Texas mixed
      '214': ['att', 'verizon'], '713': ['att', 'verizon'], '512': ['att', 'tmobile'],
      // Florida Verizon strong
      '305': ['verizon', 'att'], '786': ['att', 'tmobile'], '954': ['verizon', 'att'],
      // Midwest Verizon/US Cellular
      '312': ['verizon', 'att'], '773': ['tmobile', 'att'], '414': ['uscellular', 'verizon'],
      // Rural areas often US Cellular
      '605': ['uscellular', 'verizon'], '701': ['uscellular', 'verizon'],
    };

    // Check if we have hints for this area code
    const hints = carrierAreaCodeHints[areaCode];
    if (hints && hints.length > 0) {
      return hints[0]; // Return most likely carrier
    }

    // Default based on US market share (2024):
    // Verizon ~30%, AT&T ~28%, T-Mobile ~27%, others ~15%
    // Use Verizon as default (largest market share)
    return 'verizon';
  }

  /**
   * Try sending to multiple carriers (broadcast mode)
   * Useful when carrier is unknown - sends to top 3 carriers
   */
  async sendBroadcast(
    to: string,
    message: string
  ): Promise<SMSResult> {
    const topCarriers: CarrierType[] = ['verizon', 'att', 'tmobile'];
    let lastError = '';

    for (const carrier of topCarriers) {
      const result = await this.send(to, message, carrier);
      if (result.success) {
        return result;
      }
      lastError = result.error || 'Unknown error';
    }

    return { success: false, error: `Broadcast failed: ${lastError}` };
  }

  /**
   * Get list of supported carriers
   */
  getSupportedCarriers(): string[] {
    return Object.keys(CARRIER_GATEWAYS).filter(c => !c.includes('_mms'));
  }
}

export const smsService = new SMSService();
