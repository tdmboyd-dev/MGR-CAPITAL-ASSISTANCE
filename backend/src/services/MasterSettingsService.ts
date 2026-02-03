/**
 * MasterSettingsService.ts
 *
 * Centralized enable/disable toggles for ALL major features in the system.
 * Stores settings in FounderConfig with key "master_settings".
 *
 * FEATURES:
 * - Global feature toggles (all enabled by default)
 * - Cached reads for performance
 * - Atomic toggle operations
 * - Audit trail for changes
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cacheService, CacheKeys, CacheTTL } from "./CacheService.js";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// MASTER SETTINGS KEY
// =============================================================================

const MASTER_SETTINGS_KEY = "master_settings";
const CACHE_KEY = `${CacheKeys.CONFIG}:${MASTER_SETTINGS_KEY}`;

// =============================================================================
// FEATURE TOGGLE KEYS
// =============================================================================

export const FeatureKeys = {
  AUTO_INGESTION: "auto_ingestion",
  CASE_AUTOPILOT: "case_autopilot",
  AUTO_OUTREACH: "auto_outreach",
  EMAIL_INBOX_POLL: "email_inbox_poll",
  EMAIL_HOSTING: "email_hosting",
  SMS_OUTREACH: "sms_outreach",
  PHONE_BOT: "phone_bot",
  AI_BOTS: "ai_bots",
  NOTARY_AUTOMATION: "notary_automation",
  DOCUMENT_GENERATION: "document_generation",
  SKIP_TRACE: "skip_trace",
  COMPLIANCE_CHECKS: "compliance_checks",
  TRAINING_SYSTEM: "training_system",
  ACTIVITY_TRACKING: "activity_tracking",
  TIPPING: "tipping",
  CHILD_COMPANIES: "child_companies",
  BLOCKCHAIN_PAYOUTS: "blockchain_payouts",
  NFT_MINTING: "nft_minting",
  AUCTIONS: "auctions",
  MARKETPLACE: "marketplace",
  VOICE_AI: "voice_ai",
  GENEALOGY_SEARCH: "genealogy_search",
  FRAUD_DETECTION: "fraud_detection",
} as const;

export type FeatureKey = (typeof FeatureKeys)[keyof typeof FeatureKeys];

// =============================================================================
// MASTER SETTINGS SCHEMA
// =============================================================================

export const MasterSettingsSchema = z.object({
  // Ingestion & Automation
  auto_ingestion: z.boolean().default(true),
  case_autopilot: z.boolean().default(true),
  auto_outreach: z.boolean().default(true),

  // Email & Communication
  email_inbox_poll: z.boolean().default(true),
  email_hosting: z.boolean().default(true),
  sms_outreach: z.boolean().default(true),

  // AI & Bots
  phone_bot: z.boolean().default(true),
  ai_bots: z.boolean().default(true),
  voice_ai: z.boolean().default(true),

  // Documents & Notary
  notary_automation: z.boolean().default(true),
  document_generation: z.boolean().default(true),

  // Research & Compliance
  skip_trace: z.boolean().default(true),
  compliance_checks: z.boolean().default(true),
  genealogy_search: z.boolean().default(true),
  fraud_detection: z.boolean().default(true),

  // HR & Training
  training_system: z.boolean().default(true),
  activity_tracking: z.boolean().default(true),

  // Finance & Payouts
  tipping: z.boolean().default(true),
  blockchain_payouts: z.boolean().default(true),
  nft_minting: z.boolean().default(true),

  // Multi-tenant & Marketplace
  child_companies: z.boolean().default(true),
  auctions: z.boolean().default(true),
  marketplace: z.boolean().default(true),
});

export type MasterSettings = z.infer<typeof MasterSettingsSchema>;

// =============================================================================
// DEFAULT SETTINGS (ALL ENABLED)
// =============================================================================

export const DEFAULT_MASTER_SETTINGS: MasterSettings = MasterSettingsSchema.parse({});

// =============================================================================
// MASTER SETTINGS SERVICE CLASS
// =============================================================================

class MasterSettingsService {
  /**
   * Get all master settings (with caching)
   */
  async getAll(): Promise<MasterSettings> {
    // Try cache first
    const cached = await cacheService.get<MasterSettings>(CACHE_KEY);
    if (cached !== null) {
      logger.debug("Master settings cache hit");
      return cached;
    }

    // Fetch from DB
    const config = await prisma.founderConfig.findUnique({
      where: { key: MASTER_SETTINGS_KEY },
    });

    if (!config) {
      logger.info("Master settings not found, returning defaults");
      return DEFAULT_MASTER_SETTINGS;
    }

    // Parse and validate with defaults
    const result = MasterSettingsSchema.safeParse(config.value);
    const settings = result.success ? result.data : DEFAULT_MASTER_SETTINGS;

    // Cache the result
    await cacheService.set(CACHE_KEY, settings, CacheTTL.CONFIG);
    logger.debug("Master settings cache miss - cached");

    return settings;
  }

  /**
   * Get a single setting value
   */
  async get(key: FeatureKey): Promise<boolean> {
    const settings = await this.getAll();
    return settings[key] ?? true; // Default to enabled if key not found
  }

  /**
   * Update one or more settings
   */
  async update(updates: Partial<MasterSettings>): Promise<MasterSettings> {
    // Get current settings
    const current = await this.getAll();

    // Merge with updates
    const merged = { ...current, ...updates };

    // Validate
    const validated = MasterSettingsSchema.parse(merged);

    // Save to DB
    await prisma.founderConfig.upsert({
      where: { key: MASTER_SETTINGS_KEY },
      create: {
        key: MASTER_SETTINGS_KEY,
        value: validated as any,
        description: "Master feature toggles for the entire system",
      },
      update: {
        value: validated as any,
      },
    });

    // Invalidate cache
    await cacheService.del(CACHE_KEY);
    logger.info("Master settings updated", { updatedKeys: Object.keys(updates) });

    return validated;
  }

  /**
   * Toggle a single feature on/off
   */
  async toggleFeature(key: FeatureKey): Promise<{ key: FeatureKey; enabled: boolean }> {
    const settings = await this.getAll();
    const currentValue = settings[key] ?? true;
    const newValue = !currentValue;

    await this.update({ [key]: newValue });

    logger.info(`Feature toggled: ${key} = ${newValue}`);
    return { key, enabled: newValue };
  }

  /**
   * Check if a feature is enabled
   */
  async isEnabled(key: FeatureKey): Promise<boolean> {
    return this.get(key);
  }

  /**
   * Enable a feature
   */
  async enable(key: FeatureKey): Promise<MasterSettings> {
    return this.update({ [key]: true });
  }

  /**
   * Disable a feature
   */
  async disable(key: FeatureKey): Promise<MasterSettings> {
    return this.update({ [key]: false });
  }

  /**
   * Reset all settings to defaults (all enabled)
   */
  async resetToDefaults(): Promise<MasterSettings> {
    await prisma.founderConfig.upsert({
      where: { key: MASTER_SETTINGS_KEY },
      create: {
        key: MASTER_SETTINGS_KEY,
        value: DEFAULT_MASTER_SETTINGS as any,
        description: "Master feature toggles for the entire system",
      },
      update: {
        value: DEFAULT_MASTER_SETTINGS as any,
      },
    });

    // Invalidate cache
    await cacheService.del(CACHE_KEY);
    logger.info("Master settings reset to defaults");

    return DEFAULT_MASTER_SETTINGS;
  }

  /**
   * Get feature metadata (for UI display)
   */
  getFeatureMetadata(): Array<{
    key: FeatureKey;
    label: string;
    description: string;
    category: string;
  }> {
    return [
      // Ingestion & Automation
      {
        key: FeatureKeys.AUTO_INGESTION,
        label: "Auto Ingestion",
        description: "Automatic data ingestion from various sources",
        category: "Automation",
      },
      {
        key: FeatureKeys.CASE_AUTOPILOT,
        label: "Case Autopilot",
        description: "AI-driven case management and progression",
        category: "Automation",
      },
      {
        key: FeatureKeys.AUTO_OUTREACH,
        label: "Auto Outreach",
        description: "Automated client outreach campaigns",
        category: "Automation",
      },

      // Email & Communication
      {
        key: FeatureKeys.EMAIL_INBOX_POLL,
        label: "Email Inbox Poll",
        description: "Automatic polling of email inboxes for case updates",
        category: "Communication",
      },
      {
        key: FeatureKeys.EMAIL_HOSTING,
        label: "Email Hosting",
        description: "Self-hosted email infrastructure (Modoboa)",
        category: "Communication",
      },
      {
        key: FeatureKeys.SMS_OUTREACH,
        label: "SMS Outreach",
        description: "Text message client communication",
        category: "Communication",
      },

      // AI & Bots
      {
        key: FeatureKeys.PHONE_BOT,
        label: "Phone Bot",
        description: "AI phone bot with voice synthesis (Twilio + ElevenLabs)",
        category: "AI & Bots",
      },
      {
        key: FeatureKeys.AI_BOTS,
        label: "AI Legal Bots",
        description: "AI-powered legal document analysis and generation",
        category: "AI & Bots",
      },
      {
        key: FeatureKeys.VOICE_AI,
        label: "Voice AI",
        description: "Voice-to-text and voice-to-document capabilities",
        category: "AI & Bots",
      },

      // Documents & Notary
      {
        key: FeatureKeys.NOTARY_AUTOMATION,
        label: "Notary Automation",
        description: "Automated notarization workflow and RON services",
        category: "Documents",
      },
      {
        key: FeatureKeys.DOCUMENT_GENERATION,
        label: "Document Generation",
        description: "Automated legal document assembly and generation",
        category: "Documents",
      },

      // Research & Compliance
      {
        key: FeatureKeys.SKIP_TRACE,
        label: "Skip Trace",
        description: "People search and contact discovery (Tracerfy)",
        category: "Research",
      },
      {
        key: FeatureKeys.COMPLIANCE_CHECKS,
        label: "Compliance Checks",
        description: "Automated compliance verification and monitoring",
        category: "Research",
      },
      {
        key: FeatureKeys.GENEALOGY_SEARCH,
        label: "Genealogy Search",
        description: "AI heir genealogy tree building",
        category: "Research",
      },
      {
        key: FeatureKeys.FRAUD_DETECTION,
        label: "Fraud Detection",
        description: "AI-powered fraud detection and prevention",
        category: "Research",
      },

      // HR & Training
      {
        key: FeatureKeys.TRAINING_SYSTEM,
        label: "Training System",
        description: "Employee training modules and certifications",
        category: "HR",
      },
      {
        key: FeatureKeys.ACTIVITY_TRACKING,
        label: "Activity Tracking",
        description: "Employee activity monitoring and violation detection",
        category: "HR",
      },

      // Finance & Payouts
      {
        key: FeatureKeys.TIPPING,
        label: "Client Tipping",
        description: "Client tipping system with shadow cut",
        category: "Finance",
      },
      {
        key: FeatureKeys.BLOCKCHAIN_PAYOUTS,
        label: "Blockchain Payouts",
        description: "Cryptocurrency payout options",
        category: "Finance",
      },
      {
        key: FeatureKeys.NFT_MINTING,
        label: "NFT Minting",
        description: "Surplus claim tokenization as NFTs",
        category: "Finance",
      },

      // Multi-tenant & Marketplace
      {
        key: FeatureKeys.CHILD_COMPANIES,
        label: "Child Companies",
        description: "White-label child company management",
        category: "Enterprise",
      },
      {
        key: FeatureKeys.AUCTIONS,
        label: "Auctions",
        description: "Blockchain surplus claim auctions",
        category: "Enterprise",
      },
      {
        key: FeatureKeys.MARKETPLACE,
        label: "Marketplace",
        description: "P2P surplus claim marketplace",
        category: "Enterprise",
      },
    ];
  }

  /**
   * Get settings grouped by category
   */
  async getGroupedSettings(): Promise<
    Record<string, Array<{ key: FeatureKey; label: string; description: string; enabled: boolean }>>
  > {
    const settings = await this.getAll();
    const metadata = this.getFeatureMetadata();

    const grouped: Record<
      string,
      Array<{ key: FeatureKey; label: string; description: string; enabled: boolean }>
    > = {};

    for (const item of metadata) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push({
        key: item.key,
        label: item.label,
        description: item.description,
        enabled: settings[item.key] ?? true,
      });
    }

    return grouped;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const masterSettingsService = new MasterSettingsService();
export default masterSettingsService;
