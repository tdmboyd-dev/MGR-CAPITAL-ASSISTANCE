/**
 * EmailIngestionService.ts
 *
 * IMAP inbox monitor for email-to-case conversion.
 * Polls a dedicated mailbox, extracts attachments (CSV/PDF),
 * parses them, and creates cases automatically.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";
import { ingestionService } from "./IngestionService.js";
import { caseRoutingService } from "./CaseRoutingService.js";
import { parseContent, SourceType } from "./ParserService.js";

// imapflow and mailparser are optional dependencies, dynamically imported at runtime

// =============================================================================
// TYPES
// =============================================================================

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  processedFolder: string;
}

interface EmailPollResult {
  emailsProcessed: number;
  recordsParsed: number;
  casesCreated: number;
  casesRouted: number;
  errors: string[];
}

// =============================================================================
// REGEX PATTERNS for parsing email body text
// =============================================================================

const BODY_PATTERNS = {
  ownerName: [
    /owner[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
    /name[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
    /taxpayer[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
  ],
  address: [
    /(\d+\s+[A-Za-z0-9\s]+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct|Pl|Cir)\.?)/gi,
    /property[:\s]+(\d+\s+[A-Za-z0-9\s]+)/gi,
  ],
  amount: [
    /\$[\s]*([\d,]+\.?\d*)/g,
    /surplus[:\s]*\$?([\d,]+\.?\d*)/gi,
    /amount[:\s]*\$?([\d,]+\.?\d*)/gi,
  ],
  state: [
    /,\s*([A-Z]{2})\s+\d{5}/g,
  ],
  county: [
    /([A-Za-z]+)\s+county/gi,
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

class EmailIngestionService {
  /**
   * Get email config from FounderConfig
   */
  async getConfig(): Promise<EmailConfig | null> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key: "email_ingestion" },
      });

      if (!config?.value) return null;

      const val = config.value as Record<string, any>;
      if (!val.host || !val.auth?.user || !val.auth?.pass) return null;

      return {
        host: val.host,
        port: val.port || 993,
        secure: val.secure !== false,
        auth: { user: val.auth.user, pass: val.auth.pass },
        processedFolder: val.processedFolder || "Processed",
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if email ingestion is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key: "email_ingestion" },
      });
      const val = config?.value as Record<string, any>;
      return val?.enabled === true;
    } catch {
      return false;
    }
  }

  /**
   * Poll inbox for new emails with attachments
   * Uses imapflow if available, otherwise logs that it's not configured
   */
  async pollInbox(): Promise<EmailPollResult> {
    const result: EmailPollResult = {
      emailsProcessed: 0,
      recordsParsed: 0,
      casesCreated: 0,
      casesRouted: 0,
      errors: [],
    };

    const enabled = await this.isEnabled();
    if (!enabled) {
      logger.info("[EmailIngestion] Email ingestion is disabled");
      return result;
    }

    const config = await this.getConfig();
    if (!config) {
      logger.warn("[EmailIngestion] No IMAP configuration found");
      result.errors.push("No IMAP configuration found");
      return result;
    }

    try {
      // Dynamic import of imapflow (optional dependency)
      let ImapFlow: any;
      try {
        // @ts-ignore - optional dependency, dynamically imported
        const imapModule = await import("imapflow");
        ImapFlow = imapModule.ImapFlow;
      } catch {
        logger.warn("[EmailIngestion] imapflow package not installed. Run: npm install imapflow");
        result.errors.push("imapflow package not installed");
        return result;
      }

      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        logger: false,
      });

      await client.connect();
      logger.info("[EmailIngestion] Connected to IMAP server");

      // Open INBOX
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Search for unread messages
        const messages = client.fetch({ seen: false }, { source: true, envelope: true });

        for await (const msg of messages) {
          try {
            await this.processEmail(msg, config, result);
            result.emailsProcessed++;

            // Mark as seen and move to processed folder
            await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });

            try {
              await client.messageMove(msg.uid, config.processedFolder, { uid: true });
            } catch {
              // Folder might not exist, that's OK
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            result.errors.push(`Email processing failed: ${errorMsg}`);
            logger.error(`[EmailIngestion] Failed to process email: ${errorMsg}`);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      logger.info(`[EmailIngestion] Processed ${result.emailsProcessed} emails, created ${result.casesCreated} cases`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`IMAP connection failed: ${errorMsg}`);
      logger.error(`[EmailIngestion] IMAP error: ${errorMsg}`);
    }

    // Log to BotRunLog
    await prisma.botRunLog.create({
      data: {
        botName: "EmailIngestionService",
        runType: "email_poll",
        success: result.errors.length === 0,
        summary: `Processed ${result.emailsProcessed} emails, parsed ${result.recordsParsed} records, created ${result.casesCreated} cases`,
        recordsProcessed: result.recordsParsed,
        insightsGenerated: result.casesCreated,
        errorsEncountered: result.errors.length,
        error: result.errors.length > 0 ? result.errors.join("; ") : null,
      },
    });

    return result;
  }

  /**
   * Process a single email message
   */
  private async processEmail(msg: any, config: EmailConfig, result: EmailPollResult): Promise<void> {
    let simpleParser: any;
    try {
      // @ts-ignore - optional dependency, dynamically imported
      const mailparserModule = await import("mailparser");
      simpleParser = mailparserModule.simpleParser;
    } catch {
      throw new Error("mailparser package not installed");
    }

    const parsed = await simpleParser(msg.source);
    const subject = parsed.subject || "Unknown";
    const textBody = parsed.text || "";
    const attachments = parsed.attachments || [];

    logger.info(`[EmailIngestion] Processing email: "${subject}" with ${attachments.length} attachments`);

    // Find or create an EMAIL_INBOX source
    let source = await prisma.ingestionSource.findFirst({
      where: { type: "EMAIL_INBOX", isActive: true },
    });

    if (!source) {
      source = await prisma.ingestionSource.create({
        data: {
          name: "Email Inbox Ingestion",
          type: "EMAIL_INBOX",
          state: "ALL",
          isActive: true,
        },
      });
    }

    // Process attachments (CSV, PDF)
    for (const attachment of attachments) {
      const filename = attachment.filename || "attachment";
      const contentType = attachment.contentType || "";
      const content = attachment.content;

      if (!content) continue;

      const isCSV = filename.endsWith(".csv") || contentType.includes("csv");
      const isPDF = filename.endsWith(".pdf") || contentType.includes("pdf");

      if (!isCSV && !isPDF) continue;

      try {
        const textContent = content.toString("utf-8");
        const parseResult = await parseContent(textContent, {
          filename,
          sourceType: isCSV ? ("TAX_SALE" as SourceType) : ("SURPLUS_FUND" as SourceType),
        });

        if (parseResult.records.length > 0) {
          const batchId = await ingestionService.createBatch(source.id, filename);
          const batchResult = await ingestionService.processBatch(
            batchId,
            parseResult.records.map((r) => r.normalizedData || r.rawData || {}),
          );

          result.recordsParsed += parseResult.totalRecords;
          result.casesCreated += batchResult.created;

          // Create autopilot run record
          await prisma.autopilotRun.create({
            data: {
              sourceId: source.id,
              batchId,
              runType: "email",
              recordsParsed: parseResult.totalRecords,
              casesCreated: batchResult.created,
              status: "completed",
              completedAt: new Date(),
            },
          });

          // Auto-route
          const routingConfig = await caseRoutingService.getConfig();
          if (routingConfig.enabled && routingConfig.autoAssignOnIngestion) {
            const newRecords = await prisma.ingestionRecord.findMany({
              where: { batchId, caseId: { not: null } },
              select: { caseId: true },
            });
            const caseIds = newRecords.map((r) => r.caseId!).filter(Boolean);
            if (caseIds.length > 0) {
              const routeResult = await caseRoutingService.autoAssignBatch(caseIds);
              result.casesRouted += routeResult.assigned;
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Attachment ${filename}: ${errorMsg}`);
      }
    }

    // Parse email body text as fallback (if no attachments or they failed)
    if (attachments.length === 0 && textBody.length > 50) {
      try {
        const records = this.parseEmailBody(textBody);
        if (records.length > 0) {
          const batchId = await ingestionService.createBatch(source.id, `email-${subject}`);
          const batchResult = await ingestionService.processBatch(batchId, records);
          result.recordsParsed += records.length;
          result.casesCreated += batchResult.created;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Body parsing: ${errorMsg}`);
      }
    }
  }

  /**
   * Parse email body text using regex patterns
   */
  private parseEmailBody(text: string): Record<string, any>[] {
    const records: Record<string, any>[] = [];

    // Extract owner names
    const owners: string[] = [];
    for (const pattern of BODY_PATTERNS.ownerName) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length > 3 && name.length < 100) {
          owners.push(name);
        }
      }
    }

    // Extract addresses
    const addresses: string[] = [];
    for (const pattern of BODY_PATTERNS.address) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addresses.push(match[1].trim());
      }
    }

    // Extract amounts
    const amounts: number[] = [];
    for (const pattern of BODY_PATTERNS.amount) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (amount > 0) amounts.push(Math.round(amount * 100));
      }
    }

    // Extract state
    let state: string | undefined;
    for (const pattern of BODY_PATTERNS.state) {
      const match = pattern.exec(text);
      if (match) { state = match[1]; break; }
    }

    // Extract county
    let county: string | undefined;
    for (const pattern of BODY_PATTERNS.county) {
      const match = pattern.exec(text);
      if (match) { county = match[1]; break; }
    }

    // Build records from extracted data
    const maxRecords = Math.max(owners.length, addresses.length);
    for (let i = 0; i < maxRecords; i++) {
      records.push({
        ownerName: owners[i] || null,
        propertyAddress: addresses[i] || null,
        surplusAmount: amounts[i] || null,
        state: state || null,
        county: county || null,
        rawData: { source: "email_body" },
      });
    }

    return records;
  }
}

export const emailIngestionService = new EmailIngestionService();
export default emailIngestionService;
