/**
 * SMSService.ts — MGR CAPITAL ASSISTANCE
 * Multi-provider SMS: Plivo (premium) + carrier email gateways (fallback)
 */

import { emailService } from './EmailService.js';
import { logger } from '../utils/logger.js';

// ============================================
// PLIVO INTEGRATION (Premium - requires API keys)
// ============================================

interface PlivoConfig {
  authId: string;
  authToken: string;
  fromNumber: string;
}

let plivoClient: any = null;
let plivoConfig: PlivoConfig | null = null;

// Initialize Plivo if keys are configured
if (process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN) {
  plivoConfig = {
    authId: process.env.PLIVO_AUTH_ID,
    authToken: process.env.PLIVO_AUTH_TOKEN,
    fromNumber: process.env.PLIVO_NUMBER || '',
  };

  // Dynamic import to avoid errors if plivo not installed
  import('plivo').then(plivo => {
    plivoClient = new plivo.Client(plivoConfig!.authId, plivoConfig!.authToken);
    logger.info('Plivo SMS client initialized');
  }).catch(() => {
    logger.warn('Plivo SDK not installed - using email gateway fallback');
  });
}

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

  // ============================================
  // PLIVO PREMIUM METHODS
  // ============================================

  /**
   * Send SMS via Plivo API (premium, reliable delivery)
   * @param to Phone number with country code (+1 for US)
   * @param message Text message
   */
  async sendViaPilvo(
    to: string,
    message: string
  ): Promise<SMSResult> {
    if (!plivoClient || !plivoConfig?.fromNumber) {
      logger.warn('Plivo not configured - falling back to email gateway');
      return this.sendBroadcast(to, message);
    }

    try {
      // Format phone number
      let formattedTo = to.replace(/\D/g, '');
      if (formattedTo.length === 10) {
        formattedTo = `1${formattedTo}`; // Add US country code
      }

      const response = await plivoClient.messages.create({
        src: plivoConfig.fromNumber,
        dst: formattedTo,
        text: message,
      });

      const messageUuid = response.messageUuid?.[0] || response.message_uuid?.[0];
      logger.info('Plivo SMS sent', { to: formattedTo, uuid: messageUuid });

      return {
        success: true,
        messageId: messageUuid,
      };
    } catch (error: any) {
      logger.error('Plivo SMS error', { to, error: error.message });
      return { success: false, error: error.message || 'Plivo send failed' };
    }
  }

  /**
   * Send SMS via Plivo to multiple recipients
   */
  async sendBulkViaPilvo(
    numbers: string[],
    message: string
  ): Promise<{ sent: number; failed: number; messageIds: string[] }> {
    let sent = 0;
    let failed = 0;
    const messageIds: string[] = [];

    for (const phone of numbers) {
      const result = await this.sendViaPilvo(phone, message);
      if (result.success) {
        sent++;
        if (result.messageId) messageIds.push(result.messageId);
      } else {
        failed++;
      }
    }

    return { sent, failed, messageIds };
  }

  /**
   * Get Plivo message status
   */
  async getPlivoStatus(messageUuid: string): Promise<string | null> {
    if (!plivoClient) return null;

    try {
      const message = await plivoClient.messages.get(messageUuid);
      return message.messageState || message.message_state;
    } catch (error) {
      logger.error('Plivo status check failed', { messageUuid, error });
      return null;
    }
  }

  /**
   * Smart send - uses Plivo if configured, otherwise email gateway
   */
  async smartSend(
    to: string,
    message: string,
    preferPremium: boolean = true
  ): Promise<SMSResult> {
    if (preferPremium && plivoClient) {
      return this.sendViaPilvo(to, message);
    }

    const carrier = this.detectCarrier(to);
    return this.send(to, message, carrier);
  }

  /**
   * Check if Plivo is configured
   */
  isPlivoEnabled(): boolean {
    return plivoClient !== null && plivoConfig?.fromNumber !== '';
  }
}

export const smsService = new SMSService();
