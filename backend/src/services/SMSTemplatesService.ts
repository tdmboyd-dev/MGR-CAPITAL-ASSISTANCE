/**
 * SMSTemplatesService.ts — MGR CAPITAL ASSISTANCE
 * Pre-built SMS templates for all outreach stages
 *
 * Features:
 * - TCPA-compliant opt-out language
 * - A/B testing support
 * - State-specific customization
 * - Placeholder rendering
 */

import { logger } from '../utils/logger.js';

// ============================================
// TYPES & INTERFACES
// ============================================

export type OutreachStage =
  | 'INITIAL_OUTREACH'
  | 'FOLLOW_UP_1'
  | 'FOLLOW_UP_2'
  | 'FINAL_NOTICE'
  | 'DOCUMENT_REMINDER'
  | 'DEADLINE_WARNING'
  | 'CLOSING_NOTIFICATION'
  | 'PAYMENT_RECEIVED';

export interface SMSTemplate {
  id: string;
  stage: OutreachStage;
  name: string;
  description: string;
  content: string;
  variant: 'A' | 'B' | 'C';  // A/B testing variants
  stateCode?: string;        // For state-specific templates (null = default)
  isActive: boolean;
  requiredPlaceholders: string[];
  optOutLanguage: string;
  characterCount: number;
  createdAt: Date;
  updatedAt: Date;
  // A/B testing metrics
  metrics: {
    sent: number;
    delivered: number;
    responded: number;
    optedOut: number;
    conversionRate: number;
  };
}

export interface RenderOptions {
  firstName: string;
  lastName?: string;
  county: string;
  state: string;
  surplusAmount: string | number;
  deadline?: string;
  companyName: string;
  documentType?: string;
  propertyAddress?: string;
  caseNumber?: string;
  phoneNumber?: string;
}

export interface TemplatePerformance {
  templateId: string;
  stage: OutreachStage;
  variant: string;
  sent: number;
  delivered: number;
  deliveryRate: number;
  responded: number;
  responseRate: number;
  optedOut: number;
  optOutRate: number;
  conversionRate: number;
}

// ============================================
// TCPA COMPLIANCE CONSTANTS
// ============================================

const TCPA_OPT_OUT_STANDARD = 'Reply STOP to unsubscribe';
const TCPA_OPT_OUT_SHORT = 'STOP to opt out';
const TCPA_OPT_OUT_FULL = 'Reply STOP to unsubscribe. Msg&data rates may apply. Msg freq varies.';

// ============================================
// PRE-BUILT TEMPLATES
// ============================================

const DEFAULT_TEMPLATES: Omit<SMSTemplate, 'createdAt' | 'updatedAt'>[] = [
  // ============================================
  // 1. INITIAL OUTREACH (First Contact)
  // ============================================
  {
    id: 'initial-outreach-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Friendly',
    description: 'First contact with potential claimant - warm and informative',
    variant: 'A',
    content: `Hi {firstName}, this is {companyName}. We found unclaimed surplus funds of ${'{surplusAmount}'} from a {county} County, {state} property that may belong to you. We can help you recover it at no upfront cost. Reply YES to learn more. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'initial-outreach-b',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Urgent',
    description: 'First contact with urgency emphasis',
    variant: 'B',
    content: `{firstName}, you may have ${'{surplusAmount}'} in unclaimed funds from {county} County, {state}. These funds have a deadline to claim. {companyName} can help - no fees unless we recover your money. Reply INFO for details. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'initial-outreach-c',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Direct',
    description: 'First contact - straight to the point',
    variant: 'C',
    content: `{firstName}, {companyName} here. We identified ${'{surplusAmount}'} in surplus funds from a {county} County, {state} foreclosure linked to you. We handle everything - you only pay if we succeed. Interested? Reply YES. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 2. FOLLOW-UP #1 (3 Days)
  // ============================================
  {
    id: 'follow-up-1-a',
    stage: 'FOLLOW_UP_1',
    name: 'Follow-Up 1 - Reminder',
    description: 'First follow-up after 3 days - gentle reminder',
    variant: 'A',
    content: `Hi {firstName}, just following up from {companyName}. Did you see our message about the ${'{surplusAmount}'} in {county} County surplus funds? We're here to help you claim what's yours. Questions? Reply or call us. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'follow-up-1-b',
    stage: 'FOLLOW_UP_1',
    name: 'Follow-Up 1 - Value Focus',
    description: 'First follow-up emphasizing value proposition',
    variant: 'B',
    content: `{firstName}, still thinking about those surplus funds? ${'{surplusAmount}'} is waiting in {county} County, {state}. {companyName} has recovered millions for people just like you. No risk - we only get paid when you do. Reply START. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 3. FOLLOW-UP #2 (7 Days)
  // ============================================
  {
    id: 'follow-up-2-a',
    stage: 'FOLLOW_UP_2',
    name: 'Follow-Up 2 - Deadline Mention',
    description: 'Second follow-up with deadline emphasis',
    variant: 'A',
    content: `{firstName}, this is {companyName} again. The ${'{surplusAmount}'} from {county} County has claim deadlines. We don't want you to miss out on YOUR money. It takes just a few minutes to get started. Reply HELP or call us today. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'follow-up-2-b',
    stage: 'FOLLOW_UP_2',
    name: 'Follow-Up 2 - Social Proof',
    description: 'Second follow-up with credibility',
    variant: 'B',
    content: `{firstName}, we've helped hundreds of {state} residents recover their surplus funds. Your ${'{surplusAmount}'} from {county} County is still available. {companyName} handles all paperwork & legal filings. Ready? Reply YES. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 4. FINAL NOTICE (14 Days)
  // ============================================
  {
    id: 'final-notice-a',
    stage: 'FINAL_NOTICE',
    name: 'Final Notice - Last Chance',
    description: 'Final outreach attempt - urgency',
    variant: 'A',
    content: `{firstName}, FINAL NOTICE from {companyName}: We're closing our file on the ${'{surplusAmount}'} {county} County surplus funds. After today, we may not be able to assist. Reply CLAIM now or this opportunity expires. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'final-notice-b',
    stage: 'FINAL_NOTICE',
    name: 'Final Notice - Soft Close',
    description: 'Final outreach - respectful closing',
    variant: 'B',
    content: `{firstName}, this is our last message about the ${'{surplusAmount}'} in {county} County, {state}. If you're not interested, no worries - reply STOP. But if you want help claiming YOUR money, {companyName} is here. Reply YES anytime. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 5. DOCUMENT REMINDER
  // ============================================
  {
    id: 'document-reminder-a',
    stage: 'DOCUMENT_REMINDER',
    name: 'Document Reminder - Friendly',
    description: 'Remind client to submit required documents',
    variant: 'A',
    content: `Hi {firstName}, {companyName} here. We're almost ready to file your ${'{surplusAmount}'} claim! We just need your {documentType}. Please upload or reply with a photo ASAP so we don't miss the deadline. Questions? Just reply! ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'documentType'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'document-reminder-b',
    stage: 'DOCUMENT_REMINDER',
    name: 'Document Reminder - Urgent',
    description: 'Urgent document request',
    variant: 'B',
    content: `{firstName}, URGENT from {companyName}: Your ${'{surplusAmount}'} claim is on hold. We need your {documentType} to proceed. The {county} County deadline is approaching. Please send today! Reply with photo or call us. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'documentType', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 6. DEADLINE WARNING
  // ============================================
  {
    id: 'deadline-warning-a',
    stage: 'DEADLINE_WARNING',
    name: 'Deadline Warning - 7 Days',
    description: 'Warning about approaching deadline',
    variant: 'A',
    content: `{firstName}, DEADLINE ALERT: Your ${'{surplusAmount}'} {county} County claim must be filed by {deadline}. That's only 7 days away! {companyName} needs your docs NOW to file in time. Reply or call immediately. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'deadline'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'deadline-warning-b',
    stage: 'DEADLINE_WARNING',
    name: 'Deadline Warning - 3 Days',
    description: 'Critical deadline warning',
    variant: 'B',
    content: `CRITICAL: {firstName}, only 3 DAYS left to claim your ${'{surplusAmount}'} from {county} County, {state}! After {deadline}, these funds may be lost forever. {companyName} is standing by - we need to hear from you TODAY. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state', 'deadline'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 7. CLOSING NOTIFICATION
  // ============================================
  {
    id: 'closing-notification-a',
    stage: 'CLOSING_NOTIFICATION',
    name: 'Closing Notification - Filed',
    description: 'Notify client their claim has been filed',
    variant: 'A',
    content: `Great news, {firstName}! {companyName} has officially filed your ${'{surplusAmount}'} claim with {county} County, {state}. We'll notify you as soon as funds are released. Thank you for trusting us! Questions? Reply anytime. ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county', 'state'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'closing-notification-b',
    stage: 'CLOSING_NOTIFICATION',
    name: 'Closing Notification - Processing',
    description: 'Update on claim processing',
    variant: 'B',
    content: `{firstName}, update from {companyName}: Your ${'{surplusAmount}'} claim is now being processed by {county} County. Typical processing time is 4-8 weeks. We're monitoring daily and will update you. Sit tight - payday is coming! ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },

  // ============================================
  // 8. PAYMENT RECEIVED
  // ============================================
  {
    id: 'payment-received-a',
    stage: 'PAYMENT_RECEIVED',
    name: 'Payment Received - Celebration',
    description: 'Notify client their payment has been received',
    variant: 'A',
    content: `{firstName}, CONGRATULATIONS! {companyName} received your ${'{surplusAmount}'} payment from {county} County! Your check will be processed and mailed within 3-5 business days. Thank you for choosing us! ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  {
    id: 'payment-received-b',
    stage: 'PAYMENT_RECEIVED',
    name: 'Payment Received - Referral Ask',
    description: 'Payment notification with referral request',
    variant: 'B',
    content: `{firstName}, your ${'{surplusAmount}'} has arrived! {companyName} is processing your payout now. Know anyone else who lost property to foreclosure? We'd love to help them too - referrals are always appreciated! ${TCPA_OPT_OUT_SHORT}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount'],
    optOutLanguage: TCPA_OPT_OUT_SHORT,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
];

// ============================================
// STATE-SPECIFIC TEMPLATE OVERRIDES
// ============================================

const STATE_SPECIFIC_TEMPLATES: Omit<SMSTemplate, 'createdAt' | 'updatedAt'>[] = [
  // Texas - specific language for TX surplus fund laws
  {
    id: 'initial-outreach-tx-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Texas',
    description: 'First contact for Texas properties (Property Code 34.04)',
    variant: 'A',
    stateCode: 'TX',
    content: `Hi {firstName}, this is {companyName}. Under Texas Property Code, there's ${'{surplusAmount}'} in excess proceeds from {county} County that may be yours. We specialize in TX surplus recovery - no upfront fees. Reply YES to learn more. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  // Georgia - specific language
  {
    id: 'initial-outreach-ga-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Georgia',
    description: 'First contact for Georgia properties',
    variant: 'A',
    stateCode: 'GA',
    content: `{firstName}, {companyName} found ${'{surplusAmount}'} in {county} County, Georgia excess funds from a foreclosure sale. Georgia law allows former owners to claim these funds. We handle everything - reply INFO for details. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  // Florida - specific language
  {
    id: 'initial-outreach-fl-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Florida',
    description: 'First contact for Florida properties',
    variant: 'A',
    stateCode: 'FL',
    content: `{firstName}, {companyName} here. Florida Statute 45.033 entitles you to ${'{surplusAmount}'} in surplus funds from {county} County. We're FL surplus recovery specialists - no fees unless we recover your money. Reply CLAIM to start. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  // California - specific language
  {
    id: 'initial-outreach-ca-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - California',
    description: 'First contact for California properties',
    variant: 'A',
    stateCode: 'CA',
    content: `{firstName}, under California Civil Code, you may be entitled to ${'{surplusAmount}'} from a {county} County trustee sale. {companyName} recovers CA surplus funds daily - no upfront cost. Reply YES for a free case review. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
  // Tennessee - specific language
  {
    id: 'initial-outreach-tn-a',
    stage: 'INITIAL_OUTREACH',
    name: 'Initial Outreach - Tennessee',
    description: 'First contact for Tennessee properties',
    variant: 'A',
    stateCode: 'TN',
    content: `{firstName}, {companyName} found ${'{surplusAmount}'} in excess funds from {county} County, TN. Tennessee law protects your right to these funds. We handle all filings - no fees until you get paid. Reply INFO. ${TCPA_OPT_OUT_STANDARD}`,
    isActive: true,
    requiredPlaceholders: ['firstName', 'companyName', 'surplusAmount', 'county'],
    optOutLanguage: TCPA_OPT_OUT_STANDARD,
    characterCount: 0,
    metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class SMSTemplatesService {
  private templates: Map<string, SMSTemplate> = new Map();
  private initialized = false;

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize templates from defaults and state-specific
   */
  private initializeTemplates(): void {
    const now = new Date();

    // Add default templates
    for (const template of DEFAULT_TEMPLATES) {
      const fullTemplate: SMSTemplate = {
        ...template,
        characterCount: template.content.length,
        createdAt: now,
        updatedAt: now,
      };
      this.templates.set(template.id, fullTemplate);
    }

    // Add state-specific templates
    for (const template of STATE_SPECIFIC_TEMPLATES) {
      const fullTemplate: SMSTemplate = {
        ...template,
        characterCount: template.content.length,
        createdAt: now,
        updatedAt: now,
      };
      this.templates.set(template.id, fullTemplate);
    }

    this.initialized = true;
    logger.info('SMS Templates initialized', { count: this.templates.size });
  }

  /**
   * Get all templates
   */
  getAll(filters?: {
    stage?: OutreachStage;
    stateCode?: string;
    isActive?: boolean;
    variant?: 'A' | 'B' | 'C';
  }): SMSTemplate[] {
    let templates = Array.from(this.templates.values());

    if (filters?.stage) {
      templates = templates.filter(t => t.stage === filters.stage);
    }

    if (filters?.stateCode) {
      // Include state-specific and default templates (no stateCode)
      templates = templates.filter(
        t => t.stateCode === filters.stateCode || !t.stateCode
      );
    }

    if (filters?.isActive !== undefined) {
      templates = templates.filter(t => t.isActive === filters.isActive);
    }

    if (filters?.variant) {
      templates = templates.filter(t => t.variant === filters.variant);
    }

    return templates;
  }

  /**
   * Get template by ID
   */
  getById(id: string): SMSTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Get best template for a stage (considers state-specific and A/B testing)
   */
  getBestForStage(
    stage: OutreachStage,
    stateCode?: string,
    preferVariant?: 'A' | 'B' | 'C'
  ): SMSTemplate | null {
    const templates = this.getAll({ stage, stateCode, isActive: true });

    if (templates.length === 0) return null;

    // First, prefer state-specific if available
    const stateSpecific = templates.filter(t => t.stateCode === stateCode);
    if (stateSpecific.length > 0) {
      if (preferVariant) {
        const preferred = stateSpecific.find(t => t.variant === preferVariant);
        if (preferred) return preferred;
      }
      // Return highest performing or first
      return this.selectByPerformance(stateSpecific);
    }

    // Fall back to default templates
    const defaults = templates.filter(t => !t.stateCode);
    if (preferVariant) {
      const preferred = defaults.find(t => t.variant === preferVariant);
      if (preferred) return preferred;
    }

    return this.selectByPerformance(defaults);
  }

  /**
   * Select template based on A/B performance metrics
   */
  private selectByPerformance(templates: SMSTemplate[]): SMSTemplate {
    // Sort by conversion rate (highest first)
    const sorted = templates.sort((a, b) =>
      b.metrics.conversionRate - a.metrics.conversionRate
    );

    // If we have metrics, use the best performer 70% of the time
    // Otherwise, explore other variants 30% of the time
    if (sorted[0].metrics.sent > 100 && Math.random() < 0.7) {
      return sorted[0];
    }

    // Random selection for exploration
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Render template with case data
   */
  render(templateId: string, data: RenderOptions): {
    success: boolean;
    message?: string;
    error?: string;
    characterCount?: number;
    exceedsLimit?: boolean;
  } {
    const template = this.getById(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Format surplus amount
    const formattedAmount = typeof data.surplusAmount === 'number'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(data.surplusAmount)
      : data.surplusAmount;

    // Replace placeholders
    let message = template.content
      .replace(/{firstName}/g, data.firstName)
      .replace(/{lastName}/g, data.lastName || '')
      .replace(/{county}/g, data.county)
      .replace(/{state}/g, data.state)
      .replace(/{surplusAmount}/g, formattedAmount)
      .replace(/{deadline}/g, data.deadline || 'TBD')
      .replace(/{companyName}/g, data.companyName)
      .replace(/{documentType}/g, data.documentType || 'required documents')
      .replace(/{propertyAddress}/g, data.propertyAddress || '')
      .replace(/{caseNumber}/g, data.caseNumber || '')
      .replace(/{phoneNumber}/g, data.phoneNumber || '');

    // Check for missing required placeholders
    const missingPlaceholders = template.requiredPlaceholders.filter(p => {
      const regex = new RegExp(`{${p}}`, 'g');
      return message.includes(`{${p}}`);
    });

    if (missingPlaceholders.length > 0) {
      logger.warn('Missing required placeholders in SMS render', {
        templateId,
        missing: missingPlaceholders,
      });
    }

    const characterCount = message.length;
    const exceedsLimit = characterCount > 160;

    if (exceedsLimit) {
      logger.warn('SMS message exceeds 160 character limit', {
        templateId,
        characterCount,
      });
    }

    return {
      success: true,
      message,
      characterCount,
      exceedsLimit,
    };
  }

  /**
   * Update template (FOUNDER only operation)
   */
  updateTemplate(
    id: string,
    updates: Partial<Pick<SMSTemplate, 'name' | 'description' | 'content' | 'isActive'>>
  ): SMSTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const updatedTemplate: SMSTemplate = {
      ...template,
      ...updates,
      characterCount: updates.content ? updates.content.length : template.characterCount,
      updatedAt: new Date(),
    };

    this.templates.set(id, updatedTemplate);
    logger.info('SMS template updated', { id, updates: Object.keys(updates) });

    return updatedTemplate;
  }

  /**
   * Create custom template
   */
  createTemplate(
    data: Omit<SMSTemplate, 'id' | 'createdAt' | 'updatedAt' | 'characterCount' | 'metrics'>
  ): SMSTemplate {
    const id = `custom-${data.stage.toLowerCase()}-${Date.now()}`;
    const now = new Date();

    const template: SMSTemplate = {
      ...data,
      id,
      characterCount: data.content.length,
      createdAt: now,
      updatedAt: now,
      metrics: { sent: 0, delivered: 0, responded: 0, optedOut: 0, conversionRate: 0 },
    };

    this.templates.set(id, template);
    logger.info('Custom SMS template created', { id, stage: data.stage });

    return template;
  }

  /**
   * Record send event for A/B testing metrics
   */
  recordSend(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.metrics.sent++;
      this.templates.set(templateId, template);
    }
  }

  /**
   * Record delivery event
   */
  recordDelivery(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.metrics.delivered++;
      this.templates.set(templateId, template);
    }
  }

  /**
   * Record response event
   */
  recordResponse(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.metrics.responded++;
      this.updateConversionRate(template);
      this.templates.set(templateId, template);
    }
  }

  /**
   * Record opt-out event
   */
  recordOptOut(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.metrics.optedOut++;
      this.templates.set(templateId, template);
    }
  }

  /**
   * Update conversion rate
   */
  private updateConversionRate(template: SMSTemplate): void {
    if (template.metrics.sent > 0) {
      template.metrics.conversionRate =
        (template.metrics.responded / template.metrics.sent) * 100;
    }
  }

  /**
   * Get A/B testing performance report
   */
  getPerformanceReport(stage?: OutreachStage): TemplatePerformance[] {
    let templates = Array.from(this.templates.values());

    if (stage) {
      templates = templates.filter(t => t.stage === stage);
    }

    return templates.map(t => ({
      templateId: t.id,
      stage: t.stage,
      variant: t.variant,
      sent: t.metrics.sent,
      delivered: t.metrics.delivered,
      deliveryRate: t.metrics.sent > 0
        ? (t.metrics.delivered / t.metrics.sent) * 100
        : 0,
      responded: t.metrics.responded,
      responseRate: t.metrics.delivered > 0
        ? (t.metrics.responded / t.metrics.delivered) * 100
        : 0,
      optedOut: t.metrics.optedOut,
      optOutRate: t.metrics.sent > 0
        ? (t.metrics.optedOut / t.metrics.sent) * 100
        : 0,
      conversionRate: t.metrics.conversionRate,
    }));
  }

  /**
   * Get all available outreach stages
   */
  getStages(): OutreachStage[] {
    return [
      'INITIAL_OUTREACH',
      'FOLLOW_UP_1',
      'FOLLOW_UP_2',
      'FINAL_NOTICE',
      'DOCUMENT_REMINDER',
      'DEADLINE_WARNING',
      'CLOSING_NOTIFICATION',
      'PAYMENT_RECEIVED',
    ];
  }

  /**
   * Get supported states (those with custom templates)
   */
  getSupportedStates(): string[] {
    const states = new Set<string>();
    for (const template of this.templates.values()) {
      if (template.stateCode) {
        states.add(template.stateCode);
      }
    }
    return Array.from(states);
  }

  /**
   * Validate template content
   */
  validateContent(content: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for opt-out language
    if (!content.toLowerCase().includes('stop')) {
      errors.push('Template must include TCPA-compliant opt-out language (e.g., "Reply STOP")');
    }

    // Check character length
    if (content.length > 320) {
      errors.push('Template exceeds maximum length (320 characters for 2-segment SMS)');
    } else if (content.length > 160) {
      warnings.push('Template exceeds 160 characters - will be sent as multi-segment SMS');
    }

    // Check for common placeholders
    const placeholderPattern = /{(\w+)}/g;
    const placeholders = content.match(placeholderPattern) || [];
    const validPlaceholders = [
      'firstName', 'lastName', 'county', 'state', 'surplusAmount',
      'deadline', 'companyName', 'documentType', 'propertyAddress', 'caseNumber', 'phoneNumber'
    ];

    for (const placeholder of placeholders) {
      const name = placeholder.replace(/[{}]/g, '');
      if (!validPlaceholders.includes(name)) {
        warnings.push(`Unknown placeholder: ${placeholder}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Export singleton instance
export const smsTemplatesService = new SMSTemplatesService();
export default smsTemplatesService;
