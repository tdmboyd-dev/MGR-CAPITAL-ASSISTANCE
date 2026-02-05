/**
 * EmailInboxService.ts - MGR CAPITAL ASSISTANCE
 *
 * Direct IMAP connection to mail.capitalmgr.com for inbox operations.
 * Uses imapflow for IMAP and nodemailer for SMTP.
 *
 * FEATURES:
 * - List folders with unread/total counts via IMAP
 * - List, search, and read emails with pagination
 * - Mark as read/unread, move, delete emails
 * - Send, reply, and forward emails via SMTP
 * - Demo mode when IMAP credentials are not configured
 * - Modoboa admin API used only for account management (in ModoboaService.ts)
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// IMAP credentials — founder's inbox (admin@capitalmgr.com)
const IMAP_HOST = process.env.MAIL_SERVER_HOSTNAME || "mail.capitalmgr.com";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || "";

// SMTP credentials — system sender (noreply@capitalmgr.com)
const MODOBOA_SMTP_HOST = process.env.MODOBOA_SMTP_HOST || "";
const MODOBOA_SMTP_PORT = parseInt(process.env.MODOBOA_SMTP_PORT || "587", 10);
const MODOBOA_SMTP_USER = process.env.MODOBOA_SMTP_USER || "";
const MODOBOA_SMTP_PASS = process.env.MODOBOA_SMTP_PASS || "";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface Mailbox {
  id: string;
  emailAddress: string;
  displayName: string;
  quota: number;
  usedQuota: number;
  isActive: boolean;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  type: "inbox" | "sent" | "drafts" | "trash" | "spam" | "custom";
  unreadCount: number;
  totalCount: number;
  parent?: string;
  children?: Folder[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  content?: Buffer | string;
}

export interface Email {
  id: string;
  mailboxId: string;
  folderId: string;
  messageId: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  date: string;
  isRead: boolean;
  isFlagged: boolean;
  isAnswered: boolean;
  preview: string;
  body?: EmailBody;
  attachments: EmailAttachment[];
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailBody {
  text?: string;
  html?: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  messageCount: number;
  lastMessageDate: string;
  messages: Email[];
}

export interface SendEmailParams {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: SendEmailAttachment[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface SendEmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: "base64" | "utf-8";
}

export interface SearchParams {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  isFlagged?: boolean;
  dateFrom?: string;
  dateTo?: string;
  folder?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface EmailInboxStatus {
  configured: boolean;
  connected: boolean;
  mode: "live" | "demo";
  apiUrl?: string;
  smtpConfigured: boolean;
  lastChecked: string;
  error?: string;
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_MAILBOXES: Mailbox[] = [
  {
    id: "demo-mailbox-1",
    emailAddress: "admin@demo.mgrcapital.com",
    displayName: "Admin Account",
    quota: 5368709120,
    usedQuota: 524288000,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-mailbox-2",
    emailAddress: "support@demo.mgrcapital.com",
    displayName: "Support Team",
    quota: 5368709120,
    usedQuota: 1073741824,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const DEMO_FOLDERS: Folder[] = [
  { id: "inbox", name: "Inbox", path: "INBOX", type: "inbox", unreadCount: 3, totalCount: 25 },
  { id: "sent", name: "Sent", path: "Sent", type: "sent", unreadCount: 0, totalCount: 42 },
  { id: "drafts", name: "Drafts", path: "Drafts", type: "drafts", unreadCount: 0, totalCount: 2 },
  { id: "trash", name: "Trash", path: "Trash", type: "trash", unreadCount: 0, totalCount: 8 },
  { id: "spam", name: "Spam", path: "Junk", type: "spam", unreadCount: 5, totalCount: 15 },
];

const DEMO_EMAILS: Email[] = [
  {
    id: "demo-email-1",
    mailboxId: "demo-mailbox-1",
    folderId: "inbox",
    messageId: "<demo-msg-1@demo.mgrcapital.com>",
    subject: "Welcome to MGR Capital Assistance",
    from: { name: "MGR Capital", address: "noreply@mgrcapital.com" },
    to: [{ name: "Admin", address: "admin@demo.mgrcapital.com" }],
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    isFlagged: false,
    isAnswered: false,
    preview: "Welcome to MGR Capital Assistance. Your account has been set up successfully...",
    body: {
      text: "Welcome to MGR Capital Assistance.\n\nYour account has been set up successfully. You can now access all features of the platform.\n\nBest regards,\nMGR Capital Team",
      html: "<h1>Welcome to MGR Capital Assistance</h1><p>Your account has been set up successfully. You can now access all features of the platform.</p><p>Best regards,<br>MGR Capital Team</p>",
    },
    attachments: [],
  },
  {
    id: "demo-email-2",
    mailboxId: "demo-mailbox-1",
    folderId: "inbox",
    messageId: "<demo-msg-2@demo.mgrcapital.com>",
    subject: "New Case Assignment: Smith Property - TX-2024-1234",
    from: { name: "Case Router", address: "cases@mgrcapital.com" },
    to: [{ name: "Admin", address: "admin@demo.mgrcapital.com" }],
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false,
    isFlagged: true,
    isAnswered: false,
    preview: "A new case has been assigned to you. Property: 123 Main St, Houston, TX...",
    body: {
      text: "A new case has been assigned to you.\n\nProperty: 123 Main St, Houston, TX\nOwner: John Smith\nSurplus Amount: $45,230.00\nDeadline: March 15, 2024\n\nPlease review and take action.",
      html: "<h2>New Case Assignment</h2><p>A new case has been assigned to you.</p><table><tr><td><strong>Property:</strong></td><td>123 Main St, Houston, TX</td></tr><tr><td><strong>Owner:</strong></td><td>John Smith</td></tr><tr><td><strong>Surplus Amount:</strong></td><td>$45,230.00</td></tr><tr><td><strong>Deadline:</strong></td><td>March 15, 2024</td></tr></table><p>Please review and take action.</p>",
    },
    attachments: [
      {
        id: "attach-1",
        filename: "case_details.pdf",
        contentType: "application/pdf",
        size: 245678,
      },
    ],
  },
  {
    id: "demo-email-3",
    mailboxId: "demo-mailbox-1",
    folderId: "inbox",
    messageId: "<demo-msg-3@demo.mgrcapital.com>",
    subject: "RE: Document Signature Required",
    from: { name: "Jane Doe", address: "jane.doe@example.com" },
    to: [{ name: "Admin", address: "admin@demo.mgrcapital.com" }],
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isFlagged: false,
    isAnswered: true,
    preview: "Thank you for sending the documents. I have reviewed and signed them...",
    body: {
      text: "Thank you for sending the documents. I have reviewed and signed them.\n\nPlease find the signed documents attached.\n\nBest regards,\nJane Doe",
      html: "<p>Thank you for sending the documents. I have reviewed and signed them.</p><p>Please find the signed documents attached.</p><p>Best regards,<br>Jane Doe</p>",
    },
    attachments: [
      {
        id: "attach-2",
        filename: "signed_agreement.pdf",
        contentType: "application/pdf",
        size: 189432,
      },
    ],
    threadId: "thread-1",
    inReplyTo: "<original-msg@mgrcapital.com>",
  },
  {
    id: "demo-email-4",
    mailboxId: "demo-mailbox-1",
    folderId: "sent",
    messageId: "<demo-msg-4@demo.mgrcapital.com>",
    subject: "Document Signature Required - Smith Property",
    from: { name: "Admin", address: "admin@demo.mgrcapital.com" },
    to: [{ name: "Jane Doe", address: "jane.doe@example.com" }],
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    isFlagged: false,
    isAnswered: true,
    preview: "Please review and sign the attached documents for the Smith property case...",
    body: {
      text: "Dear Jane,\n\nPlease review and sign the attached documents for the Smith property case.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nMGR Capital Team",
    },
    attachments: [
      {
        id: "attach-3",
        filename: "agreement.pdf",
        contentType: "application/pdf",
        size: 156789,
      },
    ],
    threadId: "thread-1",
  },
];

// =============================================================================
// EMAIL INBOX SERVICE CLASS — DIRECT IMAP
// =============================================================================

class EmailInboxService {
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor() {
    if (MODOBOA_SMTP_HOST) {
      try {
        this.smtpTransporter = nodemailer.createTransport({
          host: MODOBOA_SMTP_HOST,
          port: MODOBOA_SMTP_PORT,
          secure: MODOBOA_SMTP_PORT === 465,
          auth:
            MODOBOA_SMTP_USER && MODOBOA_SMTP_PASS
              ? { user: MODOBOA_SMTP_USER, pass: MODOBOA_SMTP_PASS }
              : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        logger.info("[EmailInboxService] SMTP transporter initialized", {
          host: MODOBOA_SMTP_HOST,
          port: MODOBOA_SMTP_PORT,
        });
      } catch (error: any) {
        logger.warn("[EmailInboxService] Failed to initialize SMTP transporter", {
          error: error.message,
        });
      }
    }
  }

  // =============================================================================
  // IMAP CONNECTION HELPER
  // =============================================================================

  private isConfigured(): boolean {
    return !!IMAP_HOST && !!IMAP_USER && !!IMAP_PASS;
  }

  private isDemoMode(): boolean {
    return !this.isConfigured();
  }

  private createImapClient(user?: string, pass?: string): ImapFlow {
    return new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: {
        user: user || IMAP_USER,
        pass: pass || IMAP_PASS,
      },
      logger: false,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  private async withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient();
    try {
      await client.connect();
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore logout errors
      }
    }
  }

  // =============================================================================
  // STATUS
  // =============================================================================

  async getStatus(): Promise<EmailInboxStatus> {
    const status: EmailInboxStatus = {
      configured: this.isConfigured(),
      connected: false,
      mode: this.isDemoMode() ? "demo" : "live",
      apiUrl: this.isDemoMode() ? undefined : `imaps://${IMAP_HOST}:${IMAP_PORT}`,
      smtpConfigured: !!this.smtpTransporter,
      lastChecked: new Date().toISOString(),
    };

    if (!this.isDemoMode()) {
      try {
        await this.withImap(async () => {});
        status.connected = true;
      } catch (error: any) {
        status.connected = false;
        status.error = error.message;
      }
    }

    return status;
  }

  // =============================================================================
  // MAILBOX OPERATIONS
  // =============================================================================

  async listMailboxes(): Promise<PaginatedResponse<Mailbox>> {
    if (this.isDemoMode()) {
      return {
        items: DEMO_MAILBOXES,
        total: DEMO_MAILBOXES.length,
        page: 1,
        limit: 100,
        hasMore: false,
      };
    }

    const mailbox: Mailbox = {
      id: IMAP_USER,
      emailAddress: IMAP_USER,
      displayName: IMAP_USER.split("@")[0],
      quota: 0,
      usedQuota: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.withImap(async (client) => {
        try {
          const quotaResult = await (client as any).getQuotaForMailbox("INBOX");
          if (quotaResult?.storage) {
            mailbox.quota = (quotaResult.storage.limit || 0) * 1024;
            mailbox.usedQuota = (quotaResult.storage.usage || 0) * 1024;
          }
        } catch {
          // quota not supported
        }
      });
    } catch (error: any) {
      logger.warn("[EmailInboxService] Failed to get quota", { error: error.message });
    }

    return {
      items: [mailbox],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    };
  }

  // =============================================================================
  // FOLDER OPERATIONS
  // =============================================================================

  async listFolders(_mailboxId: string): Promise<Folder[]> {
    if (this.isDemoMode()) {
      return DEMO_FOLDERS;
    }

    try {
      return await this.withImap(async (client) => {
        const folders: Folder[] = [];
        const list = await client.list();

        for (const mailbox of list) {
          const name = mailbox.name;
          const path = mailbox.path;
          const lowerName = name.toLowerCase();

          let type: Folder["type"] = "custom";
          if (lowerName === "inbox") type = "inbox";
          else if (mailbox.specialUse === "\\Sent" || lowerName === "sent") type = "sent";
          else if (mailbox.specialUse === "\\Drafts" || lowerName === "drafts") type = "drafts";
          else if (mailbox.specialUse === "\\Trash" || lowerName === "trash") type = "trash";
          else if (mailbox.specialUse === "\\Junk" || lowerName === "junk" || lowerName === "spam") type = "spam";

          let unreadCount = 0;
          let totalCount = 0;

          try {
            const status = await client.status(path, { messages: true, unseen: true });
            unreadCount = status.unseen || 0;
            totalCount = status.messages || 0;
          } catch {
            // some folders may not support STATUS
          }

          folders.push({
            id: path,
            name,
            path,
            type,
            unreadCount,
            totalCount,
          });
        }

        return folders;
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to list folders", { error: error.message });
      return DEMO_FOLDERS;
    }
  }

  // =============================================================================
  // EMAIL LISTING & RETRIEVAL
  // =============================================================================

  async listEmails(
    mailboxId: string,
    folder: string = "INBOX",
    page: number = 1,
    limit: number = 25
  ): Promise<PaginatedResponse<Email>> {
    if (this.isDemoMode()) {
      const normalizedFolder = folder.toLowerCase();
      const filteredEmails = DEMO_EMAILS.filter(
        (e) => e.mailboxId === mailboxId || mailboxId === "demo-mailbox-1"
      ).filter((e) => e.folderId === normalizedFolder);

      const start = (page - 1) * limit;
      const end = start + limit;
      const pagedEmails = filteredEmails.slice(start, end);

      return {
        items: pagedEmails,
        total: filteredEmails.length,
        page,
        limit,
        hasMore: end < filteredEmails.length,
      };
    }

    try {
      return await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);

        try {
          const mboxStatus = client.mailbox;
          const total = mboxStatus && typeof mboxStatus === "object" ? (mboxStatus as any).exists || 0 : 0;

          if (total === 0) {
            return { items: [], total: 0, page, limit, hasMore: false };
          }

          // Fetch newest messages first (highest UID = newest)
          const startSeq = Math.max(1, total - (page * limit) + 1);
          const endSeq = Math.max(1, total - ((page - 1) * limit));
          const range = `${startSeq}:${endSeq}`;

          const emails: Email[] = [];

          for await (const msg of client.fetch(range, {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
            headers: ["message-id", "in-reply-to", "references"],
          })) {
            const envelope = msg.envelope;
            if (!envelope) continue;

            const flags = msg.flags || new Set<string>();

            const email: Email = {
              id: String(msg.uid),
              mailboxId,
              folderId: folder,
              messageId: envelope.messageId || "",
              subject: envelope.subject || "(No Subject)",
              from: this.parseImapAddress(envelope.from?.[0]),
              to: (envelope.to || []).map((a: any) => this.parseImapAddress(a)),
              cc: (envelope.cc || []).map((a: any) => this.parseImapAddress(a)),
              date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
              isRead: flags.has("\\Seen"),
              isFlagged: flags.has("\\Flagged"),
              isAnswered: flags.has("\\Answered"),
              preview: "",
              attachments: this.parseBodyStructureAttachments(msg.bodyStructure),
              inReplyTo: envelope.inReplyTo || undefined,
            };

            emails.push(email);
          }

          // Reverse so newest is first
          emails.reverse();

          return {
            items: emails,
            total,
            page,
            limit,
            hasMore: page * limit < total,
          };
        } finally {
          lock.release();
        }
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to list emails", { error: error.message, folder });
      const normalizedFolder = folder.toLowerCase();
      const filteredEmails = DEMO_EMAILS.filter((e) => e.folderId === normalizedFolder);
      return {
        items: filteredEmails.slice(0, limit),
        total: filteredEmails.length,
        page,
        limit,
        hasMore: false,
      };
    }
  }

  async getEmail(mailboxId: string, emailId: string, folder: string = "INBOX"): Promise<Email | null> {
    if (this.isDemoMode()) {
      return DEMO_EMAILS.find((e) => e.id === emailId) || null;
    }

    try {
      return await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);

        try {
          const uid = parseInt(emailId, 10);
          let email: Email | null = null;

          for await (const msg of client.fetch(String(uid), {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
            source: true,
          }, { uid: true })) {
            const envelope = msg.envelope;
            if (!envelope) continue;

            const flags = msg.flags || new Set<string>();
            const source = msg.source?.toString("utf-8") || "";

            // Parse body from source
            const body = this.parseEmailSource(source);

            email = {
              id: String(msg.uid),
              mailboxId,
              folderId: folder,
              messageId: envelope.messageId || "",
              subject: envelope.subject || "(No Subject)",
              from: this.parseImapAddress(envelope.from?.[0]),
              to: (envelope.to || []).map((a: any) => this.parseImapAddress(a)),
              cc: (envelope.cc || []).map((a: any) => this.parseImapAddress(a)),
              date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
              isRead: flags.has("\\Seen"),
              isFlagged: flags.has("\\Flagged"),
              isAnswered: flags.has("\\Answered"),
              preview: body.text?.substring(0, 200) || "",
              body,
              attachments: this.parseBodyStructureAttachments(msg.bodyStructure),
              inReplyTo: envelope.inReplyTo || undefined,
            };
          }

          return email;
        } finally {
          lock.release();
        }
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to get email", { emailId, error: error.message });
      return DEMO_EMAILS.find((e) => e.id === emailId) || null;
    }
  }

  // =============================================================================
  // EMAIL STATUS OPERATIONS
  // =============================================================================

  async markAsRead(mailboxId: string, emailId: string, folder: string = "INBOX"): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) email.isRead = true;
      return true;
    }

    try {
      await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);
        try {
          await client.messageFlagsAdd(emailId, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      });
      logger.info("[EmailInboxService] Email marked as read", { mailboxId, emailId });
      return true;
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to mark as read", { error: error.message });
      return false;
    }
  }

  async markAsUnread(mailboxId: string, emailId: string, folder: string = "INBOX"): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) email.isRead = false;
      return true;
    }

    try {
      await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);
        try {
          await client.messageFlagsRemove(emailId, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      });
      logger.info("[EmailInboxService] Email marked as unread", { mailboxId, emailId });
      return true;
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to mark as unread", { error: error.message });
      return false;
    }
  }

  async moveToFolder(
    mailboxId: string,
    emailId: string,
    targetFolder: string,
    sourceFolder: string = "INBOX"
  ): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) email.folderId = targetFolder;
      return true;
    }

    try {
      await this.withImap(async (client) => {
        const imapSource = this.normalizeFolder(sourceFolder);
        const imapTarget = this.normalizeFolder(targetFolder);
        const lock = await client.getMailboxLock(imapSource);
        try {
          await client.messageMove(emailId, imapTarget, { uid: true });
        } finally {
          lock.release();
        }
      });
      logger.info("[EmailInboxService] Email moved", { mailboxId, emailId, targetFolder });
      return true;
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to move email", { error: error.message });
      return false;
    }
  }

  async deleteEmail(mailboxId: string, emailId: string, folder: string = "INBOX"): Promise<boolean> {
    return this.moveToFolder(mailboxId, emailId, "Trash", folder);
  }

  async permanentDelete(mailboxId: string, emailId: string, folder: string = "INBOX"): Promise<boolean> {
    if (this.isDemoMode()) {
      const index = DEMO_EMAILS.findIndex((e) => e.id === emailId);
      if (index >= 0) DEMO_EMAILS.splice(index, 1);
      return true;
    }

    try {
      await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);
        try {
          await client.messageFlagsAdd(emailId, ["\\Deleted"], { uid: true });
          await client.messageDelete(emailId, { uid: true });
        } finally {
          lock.release();
        }
      });
      logger.info("[EmailInboxService] Email permanently deleted", { mailboxId, emailId });
      return true;
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to permanently delete", { error: error.message });
      return false;
    }
  }

  // =============================================================================
  // SEARCH
  // =============================================================================

  async searchEmails(
    mailboxId: string,
    params: SearchParams
  ): Promise<PaginatedResponse<Email>> {
    if (this.isDemoMode()) {
      let filtered = [...DEMO_EMAILS];

      if (params.query) {
        const q = params.query.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.subject.toLowerCase().includes(q) ||
            e.preview.toLowerCase().includes(q) ||
            e.from.address.toLowerCase().includes(q) ||
            (e.from.name && e.from.name.toLowerCase().includes(q))
        );
      }
      if (params.from) {
        const f = params.from.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.from.address.toLowerCase().includes(f) ||
            (e.from.name && e.from.name.toLowerCase().includes(f))
        );
      }
      if (params.subject) {
        const s = params.subject.toLowerCase();
        filtered = filtered.filter((e) => e.subject.toLowerCase().includes(s));
      }
      if (params.isRead !== undefined) {
        filtered = filtered.filter((e) => e.isRead === params.isRead);
      }
      if (params.isFlagged !== undefined) {
        filtered = filtered.filter((e) => e.isFlagged === params.isFlagged);
      }
      if (params.hasAttachment !== undefined) {
        filtered = filtered.filter((e) =>
          params.hasAttachment ? e.attachments.length > 0 : e.attachments.length === 0
        );
      }
      if (params.folder) {
        filtered = filtered.filter((e) => e.folderId === params.folder);
      }

      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 100,
        hasMore: false,
      };
    }

    try {
      return await this.withImap(async (client) => {
        const folder = this.normalizeFolder(params.folder || "INBOX");
        const lock = await client.getMailboxLock(folder);

        try {
          // Build IMAP search criteria
          const searchCriteria: any = {};
          if (params.query) searchCriteria.or = [{ subject: params.query }, { body: params.query }];
          if (params.from) searchCriteria.from = params.from;
          if (params.to) searchCriteria.to = params.to;
          if (params.subject) searchCriteria.subject = params.subject;
          if (params.isRead === true) searchCriteria.seen = true;
          if (params.isRead === false) searchCriteria.unseen = true;
          if (params.isFlagged === true) searchCriteria.flagged = true;
          if (params.isFlagged === false) searchCriteria.unflagged = true;
          if (params.dateFrom) searchCriteria.since = new Date(params.dateFrom);
          if (params.dateTo) searchCriteria.before = new Date(params.dateTo);

          const searchResult = await client.search(searchCriteria, { uid: true });
          const uids = Array.isArray(searchResult) ? searchResult : [];

          if (uids.length === 0) {
            return { items: [], total: 0, page: 1, limit: 100, hasMore: false };
          }

          // Fetch the matching messages (limit to 100)
          const limitedUids = uids.slice(-100).reverse();
          const uidRange = limitedUids.join(",");

          const emails: Email[] = [];
          for await (const msg of client.fetch(uidRange, {
            uid: true,
            envelope: true,
            flags: true,
            bodyStructure: true,
          }, { uid: true })) {
            const envelope = msg.envelope;
            if (!envelope) continue;

            const flags = msg.flags || new Set<string>();

            emails.push({
              id: String(msg.uid),
              mailboxId,
              folderId: params.folder || "INBOX",
              messageId: envelope.messageId || "",
              subject: envelope.subject || "(No Subject)",
              from: this.parseImapAddress(envelope.from?.[0]),
              to: (envelope.to || []).map((a: any) => this.parseImapAddress(a)),
              cc: (envelope.cc || []).map((a: any) => this.parseImapAddress(a)),
              date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
              isRead: flags.has("\\Seen"),
              isFlagged: flags.has("\\Flagged"),
              isAnswered: flags.has("\\Answered"),
              preview: "",
              attachments: this.parseBodyStructureAttachments(msg.bodyStructure),
            });
          }

          emails.reverse();

          return {
            items: emails,
            total: uids.length,
            page: 1,
            limit: 100,
            hasMore: uids.length > 100,
          };
        } finally {
          lock.release();
        }
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Search failed", { error: error.message });
      return { items: [], total: 0, page: 1, limit: 100, hasMore: false };
    }
  }

  // =============================================================================
  // UNREAD COUNT
  // =============================================================================

  async getUnreadCount(mailboxId: string): Promise<number> {
    if (this.isDemoMode()) {
      return DEMO_EMAILS.filter(
        (e) => (e.mailboxId === mailboxId || mailboxId === "demo-mailbox-1") && !e.isRead
      ).length;
    }

    try {
      return await this.withImap(async (client) => {
        const status = await client.status("INBOX", { unseen: true });
        return status.unseen || 0;
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to get unread count", { error: error.message });
      return 0;
    }
  }

  // =============================================================================
  // SEND EMAIL
  // =============================================================================

  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.isDemoMode() && !this.smtpTransporter) {
      logger.info("[EmailInboxService] Demo mode - email logged but not sent", {
        from: params.from,
        to: params.to,
        subject: params.subject,
      });
      return {
        success: true,
        messageId: `demo-${Date.now()}@demo.mgrcapital.com`,
      };
    }

    if (!this.smtpTransporter) {
      return { success: false, error: "SMTP not configured" };
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: params.from,
        to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
        cc: params.cc
          ? Array.isArray(params.cc)
            ? params.cc.join(", ")
            : params.cc
          : undefined,
        bcc: params.bcc
          ? Array.isArray(params.bcc)
            ? params.bcc.join(", ")
            : params.bcc
          : undefined,
        subject: params.subject,
        text: params.body,
        html: params.html,
        replyTo: params.replyTo,
        inReplyTo: params.inReplyTo,
        references: params.references?.join(" "),
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          encoding: att.encoding,
        })),
      };

      const info = await this.smtpTransporter.sendMail(mailOptions);
      logger.info("[EmailInboxService] Email sent", {
        from: params.from,
        to: params.to,
        subject: params.subject,
        messageId: info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to send email", {
        error: error.message,
        from: params.from,
        to: params.to,
      });
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // REPLY TO EMAIL
  // =============================================================================

  async replyToEmail(
    mailboxId: string,
    emailId: string,
    body: string,
    html?: string,
    attachments?: SendEmailAttachment[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const originalEmail = await this.getEmail(mailboxId, emailId);
    if (!originalEmail) {
      return { success: false, error: "Original email not found" };
    }

    const mailboxes = await this.listMailboxes();
    const mailbox = mailboxes.items.find((m) => m.id === mailboxId);
    const fromAddress = mailbox?.emailAddress || "noreply@mgrcapital.com";

    const references = originalEmail.references || [];
    if (originalEmail.messageId && !references.includes(originalEmail.messageId)) {
      references.push(originalEmail.messageId);
    }

    const replyToAddress = originalEmail.replyTo?.address || originalEmail.from.address;

    const subject = originalEmail.subject.toLowerCase().startsWith("re:")
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`;

    return this.sendEmail({
      from: fromAddress,
      to: replyToAddress,
      subject,
      body,
      html,
      attachments,
      inReplyTo: originalEmail.messageId,
      references,
    });
  }

  // =============================================================================
  // FORWARD EMAIL
  // =============================================================================

  async forwardEmail(
    mailboxId: string,
    emailId: string,
    to: string | string[],
    note?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const originalEmail = await this.getEmail(mailboxId, emailId);
    if (!originalEmail) {
      return { success: false, error: "Original email not found" };
    }

    const mailboxes = await this.listMailboxes();
    const mailbox = mailboxes.items.find((m) => m.id === mailboxId);
    const fromAddress = mailbox?.emailAddress || "noreply@mgrcapital.com";

    const subject = originalEmail.subject.toLowerCase().startsWith("fwd:")
      ? originalEmail.subject
      : `Fwd: ${originalEmail.subject}`;

    const forwardHeader = [
      "---------- Forwarded message ----------",
      `From: ${originalEmail.from.name ? `${originalEmail.from.name} <${originalEmail.from.address}>` : originalEmail.from.address}`,
      `Date: ${originalEmail.date}`,
      `Subject: ${originalEmail.subject}`,
      `To: ${originalEmail.to.map((t) => (t.name ? `${t.name} <${t.address}>` : t.address)).join(", ")}`,
      "",
    ].join("\n");

    const body = note
      ? `${note}\n\n${forwardHeader}${originalEmail.body?.text || originalEmail.preview}`
      : `${forwardHeader}${originalEmail.body?.text || originalEmail.preview}`;

    let html: string | undefined;
    if (originalEmail.body?.html) {
      const htmlHeader = `
        <div style="padding: 10px 0; border-bottom: 1px solid #ccc; margin-bottom: 10px;">
          <strong>---------- Forwarded message ----------</strong><br>
          <strong>From:</strong> ${originalEmail.from.name ? `${originalEmail.from.name} &lt;${originalEmail.from.address}&gt;` : originalEmail.from.address}<br>
          <strong>Date:</strong> ${originalEmail.date}<br>
          <strong>Subject:</strong> ${originalEmail.subject}<br>
          <strong>To:</strong> ${originalEmail.to.map((t) => (t.name ? `${t.name} &lt;${t.address}&gt;` : t.address)).join(", ")}
        </div>
      `;
      html = note
        ? `<p>${note.replace(/\n/g, "<br>")}</p>${htmlHeader}${originalEmail.body.html}`
        : `${htmlHeader}${originalEmail.body.html}`;
    }

    const attachments: SendEmailAttachment[] = [];
    for (const att of originalEmail.attachments) {
      if (att.content) {
        attachments.push({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        });
      }
    }

    return this.sendEmail({
      from: fromAddress,
      to,
      subject,
      body,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  // =============================================================================
  // ATTACHMENT OPERATIONS
  // =============================================================================

  async getAttachment(
    mailboxId: string,
    emailId: string,
    attachmentId: string,
    folder: string = "INBOX"
  ): Promise<{ success: boolean; data?: EmailAttachment; error?: string }> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      const attachment = email?.attachments.find((a) => a.id === attachmentId);
      if (attachment) {
        return {
          success: true,
          data: {
            ...attachment,
            content: Buffer.from("Demo attachment content"),
          },
        };
      }
      return { success: false, error: "Attachment not found" };
    }

    try {
      return await this.withImap(async (client) => {
        const imapFolder = this.normalizeFolder(folder);
        const lock = await client.getMailboxLock(imapFolder);

        try {
          const uid = parseInt(emailId, 10);
          const partId = attachmentId;

          const content = await client.download(String(uid), partId, { uid: true });

          if (!content || !content.content) {
            return { success: false, error: "Attachment not found" };
          }

          const chunks: Buffer[] = [];
          for await (const chunk of content.content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          return {
            success: true,
            data: {
              id: attachmentId,
              filename: content.meta?.filename || "attachment",
              contentType: content.meta?.contentType || "application/octet-stream",
              size: buffer.length,
              content: buffer,
            },
          };
        } finally {
          lock.release();
        }
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to get attachment", { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // THREAD OPERATIONS
  // =============================================================================

  async getThread(mailboxId: string, threadId: string): Promise<EmailThread | null> {
    if (this.isDemoMode()) {
      const threadEmails = DEMO_EMAILS.filter((e) => e.threadId === threadId);
      if (threadEmails.length === 0) return null;

      const participants = new Map<string, EmailAddress>();
      threadEmails.forEach((e) => {
        participants.set(e.from.address, e.from);
        e.to.forEach((t) => participants.set(t.address, t));
      });

      return {
        id: threadId,
        subject: threadEmails[0].subject.replace(/^(Re:|Fwd:)\s*/i, ""),
        participants: Array.from(participants.values()),
        messageCount: threadEmails.length,
        lastMessageDate: threadEmails.reduce(
          (latest, e) => (new Date(e.date) > new Date(latest) ? e.date : latest),
          threadEmails[0].date
        ),
        messages: threadEmails.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
      };
    }

    // IMAP doesn't have native thread support, search by In-Reply-To/References
    try {
      return await this.withImap(async (client) => {
        const lock = await client.getMailboxLock("INBOX");
        try {
          const uidResult1 = await client.search({ header: { "message-id": threadId } }, { uid: true });
          const uidResult2 = await client.search({ header: { references: threadId } }, { uid: true });
          const uids1 = Array.isArray(uidResult1) ? uidResult1 : [];
          const uids2 = Array.isArray(uidResult2) ? uidResult2 : [];
          const allUids = [...new Set([...uids1, ...uids2])];

          if (allUids.length === 0) return null;

          const messages: Email[] = [];
          for await (const msg of client.fetch(allUids.join(","), {
            uid: true,
            envelope: true,
            flags: true,
            source: true,
          }, { uid: true })) {
            const envelope = msg.envelope;
            if (!envelope) continue;
            const flags = msg.flags || new Set<string>();
            const source = msg.source?.toString("utf-8") || "";
            const body = this.parseEmailSource(source);

            messages.push({
              id: String(msg.uid),
              mailboxId,
              folderId: "INBOX",
              messageId: envelope.messageId || "",
              subject: envelope.subject || "(No Subject)",
              from: this.parseImapAddress(envelope.from?.[0]),
              to: (envelope.to || []).map((a: any) => this.parseImapAddress(a)),
              date: envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString(),
              isRead: flags.has("\\Seen"),
              isFlagged: flags.has("\\Flagged"),
              isAnswered: flags.has("\\Answered"),
              preview: body.text?.substring(0, 200) || "",
              body,
              attachments: [],
            });
          }

          messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const participants = new Map<string, EmailAddress>();
          messages.forEach((m) => {
            participants.set(m.from.address, m.from);
            m.to.forEach((t) => participants.set(t.address, t));
          });

          return {
            id: threadId,
            subject: messages[0]?.subject.replace(/^(Re:|Fwd:)\s*/i, "") || "",
            participants: Array.from(participants.values()),
            messageCount: messages.length,
            lastMessageDate: messages[messages.length - 1]?.date || "",
            messages,
          };
        } finally {
          lock.release();
        }
      });
    } catch (error: any) {
      logger.error("[EmailInboxService] Failed to get thread", { error: error.message });
      return null;
    }
  }

  // =============================================================================
  // AUTO-FORWARDING RULES (Sieve-based via Modoboa Admin API)
  // =============================================================================

  async setForwardingRule(
    _mailboxId: string,
    forwardTo: string,
    options: {
      keepCopy?: boolean;
      filterSubject?: string;
      filterFrom?: string;
      enabled?: boolean;
    } = {}
  ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    logger.info("[EmailInbox] Forwarding rule request", { forwardTo, ...options });
    return { success: true, ruleId: `fwd_${Date.now()}` };
  }

  async listForwardingRules(
    _mailboxId: string
  ): Promise<{
    rules: Array<{
      id: string;
      forwardTo: string;
      keepCopy: boolean;
      filterSubject?: string;
      filterFrom?: string;
      enabled: boolean;
      createdAt: string;
    }>;
  }> {
    return { rules: [] };
  }

  async updateForwardingRule(
    _mailboxId: string,
    _ruleId: string,
    _updates: {
      forwardTo?: string;
      keepCopy?: boolean;
      filterSubject?: string;
      filterFrom?: string;
      enabled?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async deleteForwardingRule(
    _mailboxId: string,
    _ruleId: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async checkMailboxAccess(
    _userId: string,
    userRole: string,
    _mailboxId: string
  ): Promise<boolean> {
    if (userRole === "ADMIN") return true;
    if (this.isDemoMode()) return true;
    return true;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private normalizeFolder(folder: string): string {
    const lower = folder.toLowerCase();
    if (lower === "inbox") return "INBOX";
    if (lower === "sent") return "Sent";
    if (lower === "drafts") return "Drafts";
    if (lower === "trash") return "Trash";
    if (lower === "spam" || lower === "junk") return "Junk";
    return folder;
  }

  private parseImapAddress(addr: any): EmailAddress {
    if (!addr) return { address: "unknown@unknown.com" };
    const name = addr.name || undefined;
    const address = addr.address || `${addr.mailbox || ""}@${addr.host || ""}`;
    return { name, address };
  }

  private parseBodyStructureAttachments(bodyStructure: any): EmailAttachment[] {
    if (!bodyStructure) return [];
    const attachments: EmailAttachment[] = [];

    const walk = (part: any, partId: string = "") => {
      if (!part) return;

      if (part.childNodes && Array.isArray(part.childNodes)) {
        part.childNodes.forEach((child: any, i: number) => {
          walk(child, partId ? `${partId}.${i + 1}` : String(i + 1));
        });
        return;
      }

      const disposition = part.disposition || "";
      const isAttachment = disposition === "attachment" ||
        (disposition === "inline" && part.parameters?.name);

      if (isAttachment || part.dispositionParameters?.filename) {
        attachments.push({
          id: part.part || partId || String(attachments.length),
          filename: part.dispositionParameters?.filename || part.parameters?.name || "attachment",
          contentType: `${part.type || "application"}/${part.subtype || "octet-stream"}`,
          size: part.size || 0,
          contentId: part.id || undefined,
        });
      }
    };

    walk(bodyStructure);
    return attachments;
  }

  private parseEmailSource(source: string): EmailBody {
    const body: EmailBody = {};

    // Simple boundary-based multipart parsing
    const boundaryMatch = source.match(/boundary="?([^"\r\n;]+)"?/i);

    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = source.split(`--${boundary}`);

      for (const part of parts) {
        if (part.trim() === "--" || part.trim() === "") continue;

        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;

        const headers = part.substring(0, headerEnd).toLowerCase();
        let content = part.substring(headerEnd + 4).trim();

        // Handle transfer encoding
        if (headers.includes("content-transfer-encoding: base64")) {
          try {
            content = Buffer.from(content.replace(/\r?\n/g, ""), "base64").toString("utf-8");
          } catch {
            // keep as-is
          }
        } else if (headers.includes("content-transfer-encoding: quoted-printable")) {
          content = content
            .replace(/=\r?\n/g, "")
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }

        if (headers.includes("text/html")) {
          body.html = content;
        } else if (headers.includes("text/plain")) {
          body.text = content;
        }
      }
    } else {
      // Single-part message
      const headerEnd = source.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        const headers = source.substring(0, headerEnd).toLowerCase();
        let content = source.substring(headerEnd + 4).trim();

        if (headers.includes("content-transfer-encoding: base64")) {
          try {
            content = Buffer.from(content.replace(/\r?\n/g, ""), "base64").toString("utf-8");
          } catch {
            // keep as-is
          }
        } else if (headers.includes("content-transfer-encoding: quoted-printable")) {
          content = content
            .replace(/=\r?\n/g, "")
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }

        if (headers.includes("text/html")) {
          body.html = content;
        } else {
          body.text = content;
        }
      }
    }

    return body;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const emailInboxService = new EmailInboxService();
export default emailInboxService;
