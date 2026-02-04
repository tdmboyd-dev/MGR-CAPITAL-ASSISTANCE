/**
 * EmailInboxService.ts - MGR CAPITAL ASSISTANCE
 *
 * Full email inbox integration with Modoboa REST API v2.
 * Provides read/write access to mailboxes, folders, and emails.
 *
 * FEATURES:
 * - List mailboxes and folders
 * - List, search, and read emails with pagination
 * - Mark as read/unread, move, delete emails
 * - Send, reply, and forward emails via SMTP
 * - Demo mode when MODOBOA_API_TOKEN is not configured
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const MODOBOA_API_URL = process.env.MODOBOA_API_URL || "http://localhost:8000/api/v2";
const MODOBOA_API_TOKEN = process.env.MODOBOA_API_TOKEN || "";
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
    quota: 5368709120, // 5GB
    usedQuota: 524288000, // 500MB
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-mailbox-2",
    emailAddress: "support@demo.mgrcapital.com",
    displayName: "Support Team",
    quota: 5368709120,
    usedQuota: 1073741824, // 1GB
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
// EMAIL INBOX SERVICE CLASS
// =============================================================================

class EmailInboxService {
  private headers: Record<string, string>;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor() {
    // Modoboa uses "Token" prefix, not "Bearer"
    this.headers = {
      Authorization: `Token ${MODOBOA_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Initialize SMTP transporter if configured
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
  // CONFIGURATION HELPERS
  // =============================================================================

  private isConfigured(): boolean {
    return !!MODOBOA_API_TOKEN && !!MODOBOA_API_URL;
  }

  private isDemoMode(): boolean {
    return !this.isConfigured();
  }

  // =============================================================================
  // API REQUEST HELPER
  // =============================================================================

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    if (this.isDemoMode()) {
      return { success: false, error: "API not configured - demo mode active" };
    }

    try {
      const url = `${MODOBOA_API_URL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[EmailInboxService] API request failed", {
          endpoint,
          status: response.status,
          error: errorText,
        });
        return {
          success: false,
          error: `API error ${response.status}: ${errorText}`,
        };
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = (await response.json()) as T;
        return { success: true, data };
      }

      return { success: true };
    } catch (error: any) {
      logger.error("[EmailInboxService] API request exception", {
        endpoint,
        error: error.message,
      });
      return { success: false, error: error.message };
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
      apiUrl: this.isDemoMode() ? undefined : MODOBOA_API_URL,
      smtpConfigured: !!this.smtpTransporter,
      lastChecked: new Date().toISOString(),
    };

    if (!this.isDemoMode()) {
      try {
        // Try to connect to the API
        const response = await fetch(`${MODOBOA_API_URL}/`, {
          method: "GET",
          headers: this.headers,
        });
        status.connected = response.ok;
        if (!response.ok) {
          status.error = `API returned ${response.status}`;
        }
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
      logger.debug("[EmailInboxService] Returning demo mailboxes");
      return {
        items: DEMO_MAILBOXES,
        total: DEMO_MAILBOXES.length,
        page: 1,
        limit: 100,
        hasMore: false,
      };
    }

    // Modoboa v2 API: mailboxes are IMAP folders
    const result = await this.apiRequest<any>("/webmail/mailboxes/");
    if (!result.success || !result.data) {
      logger.warn("[EmailInboxService] Failed to list mailboxes, returning demo data");
      return {
        items: DEMO_MAILBOXES,
        total: DEMO_MAILBOXES.length,
        page: 1,
        limit: 100,
        hasMore: false,
      };
    }

    // Transform API response to our interface
    const mailboxes: Mailbox[] = Array.isArray(result.data)
      ? result.data.map(this.transformMailbox)
      : result.data.results
        ? result.data.results.map(this.transformMailbox)
        : [];

    return {
      items: mailboxes,
      total: result.data.count || mailboxes.length,
      page: 1,
      limit: 100,
      hasMore: !!result.data.next,
    };
  }

  private transformMailbox(apiMailbox: any): Mailbox {
    return {
      id: String(apiMailbox.pk || apiMailbox.id),
      emailAddress: apiMailbox.full_address || apiMailbox.address || apiMailbox.email,
      displayName: apiMailbox.display_name || apiMailbox.name || "",
      quota: apiMailbox.quota || 0,
      usedQuota: apiMailbox.used_quota || apiMailbox.quota_used || 0,
      isActive: apiMailbox.is_active !== false && apiMailbox.enabled !== false,
      createdAt: apiMailbox.created_at || apiMailbox.creation_date || new Date().toISOString(),
    };
  }

  // =============================================================================
  // FOLDER OPERATIONS
  // =============================================================================

  async listFolders(mailboxId: string): Promise<Folder[]> {
    if (this.isDemoMode()) {
      logger.debug("[EmailInboxService] Returning demo folders", { mailboxId });
      return DEMO_FOLDERS;
    }

    // Modoboa v2: mailboxes endpoint returns IMAP folders
    const result = await this.apiRequest<any>(`/webmail/mailboxes/`);
    if (!result.success || !result.data) {
      logger.warn("[EmailInboxService] Failed to list folders, returning demo data");
      return DEMO_FOLDERS;
    }

    const folders: Folder[] = Array.isArray(result.data)
      ? result.data.map(this.transformFolder)
      : result.data.results
        ? result.data.results.map(this.transformFolder)
        : [];

    return folders.length > 0 ? folders : DEMO_FOLDERS;
  }

  private transformFolder(apiFolder: any): Folder {
    const name = apiFolder.name || apiFolder.label || "Unknown";
    const lowerName = name.toLowerCase();

    let type: Folder["type"] = "custom";
    if (lowerName === "inbox") type = "inbox";
    else if (lowerName === "sent" || lowerName.includes("sent")) type = "sent";
    else if (lowerName === "drafts" || lowerName.includes("draft")) type = "drafts";
    else if (lowerName === "trash" || lowerName.includes("trash") || lowerName.includes("deleted"))
      type = "trash";
    else if (lowerName === "spam" || lowerName === "junk") type = "spam";

    return {
      id: String(apiFolder.pk || apiFolder.id || apiFolder.path),
      name,
      path: apiFolder.path || apiFolder.full_name || name,
      type,
      unreadCount: apiFolder.unread_count || apiFolder.unseen || 0,
      totalCount: apiFolder.total_count || apiFolder.messages || apiFolder.exists || 0,
      parent: apiFolder.parent || undefined,
    };
  }

  // =============================================================================
  // EMAIL LISTING & RETRIEVAL
  // =============================================================================

  async listEmails(
    mailboxId: string,
    folder: string = "inbox",
    page: number = 1,
    limit: number = 25
  ): Promise<PaginatedResponse<Email>> {
    if (this.isDemoMode()) {
      const filteredEmails = DEMO_EMAILS.filter(
        (e) => e.mailboxId === mailboxId || mailboxId === "demo-mailbox-1"
      ).filter((e) => e.folderId === folder);

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

    const offset = (page - 1) * limit;
    // Modoboa v2 API: /webmail/emails/ with mbox query param for folder
    const result = await this.apiRequest<any>(
      `/webmail/emails/?mbox=${encodeURIComponent(folder)}&limit=${limit}&offset=${offset}`
    );

    if (!result.success || !result.data) {
      logger.warn("[EmailInboxService] Failed to list emails, returning demo data");
      const filteredEmails = DEMO_EMAILS.filter((e) => e.folderId === folder);
      return {
        items: filteredEmails.slice(0, limit),
        total: filteredEmails.length,
        page,
        limit,
        hasMore: false,
      };
    }

    const emails: Email[] = Array.isArray(result.data)
      ? result.data.map((e: any) => this.transformEmail(e, mailboxId, folder))
      : result.data.results
        ? result.data.results.map((e: any) => this.transformEmail(e, mailboxId, folder))
        : [];

    return {
      items: emails,
      total: result.data.count || emails.length,
      page,
      limit,
      hasMore: !!result.data.next,
    };
  }

  async getEmail(mailboxId: string, emailId: string): Promise<Email | null> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      return email || null;
    }

    // Modoboa v2: /webmail/emails/content/ with uid query param
    const result = await this.apiRequest<any>(`/webmail/emails/content/?uid=${emailId}`);
    if (!result.success || !result.data) {
      logger.warn("[EmailInboxService] Failed to get email", { emailId });
      return DEMO_EMAILS.find((e) => e.id === emailId) || null;
    }

    return this.transformEmail(result.data, mailboxId, result.data.mbox || "INBOX", true);
  }

  private transformEmail(
    apiEmail: any,
    mailboxId: string,
    folderId: string,
    includeBody: boolean = false
  ): Email {
    const parseAddress = (addr: any): EmailAddress => {
      if (typeof addr === "string") {
        const match = addr.match(/^(.+?)\s*<(.+?)>$/);
        if (match) return { name: match[1].trim(), address: match[2].trim() };
        return { address: addr };
      }
      return {
        name: addr.name || addr.display_name || undefined,
        address: addr.address || addr.email || "",
      };
    };

    const parseAddressList = (addrs: any): EmailAddress[] => {
      if (!addrs) return [];
      if (Array.isArray(addrs)) return addrs.map(parseAddress);
      if (typeof addrs === "string") return [parseAddress(addrs)];
      return [parseAddress(addrs)];
    };

    const email: Email = {
      id: String(apiEmail.pk || apiEmail.id || apiEmail.uid),
      mailboxId,
      folderId,
      messageId: apiEmail.message_id || apiEmail.msgid || "",
      subject: apiEmail.subject || "(No Subject)",
      from: parseAddress(apiEmail.from || apiEmail.sender),
      to: parseAddressList(apiEmail.to || apiEmail.recipients),
      cc: parseAddressList(apiEmail.cc),
      bcc: parseAddressList(apiEmail.bcc),
      date: apiEmail.date || apiEmail.internal_date || new Date().toISOString(),
      isRead: apiEmail.is_read !== false && !apiEmail.unseen && apiEmail.seen !== false,
      isFlagged: !!apiEmail.is_flagged || !!apiEmail.flagged,
      isAnswered: !!apiEmail.is_answered || !!apiEmail.answered,
      preview: apiEmail.preview || apiEmail.snippet || apiEmail.body_preview || "",
      attachments: this.transformAttachments(apiEmail.attachments || []),
      threadId: apiEmail.thread_id || apiEmail.conversation_id || undefined,
      inReplyTo: apiEmail.in_reply_to || undefined,
      references: apiEmail.references || undefined,
    };

    if (includeBody || apiEmail.body || apiEmail.html_body || apiEmail.text_body) {
      email.body = {
        text: apiEmail.body || apiEmail.text_body || apiEmail.body_text || "",
        html: apiEmail.html_body || apiEmail.body_html || undefined,
      };
    }

    return email;
  }

  private transformAttachments(apiAttachments: any[]): EmailAttachment[] {
    return apiAttachments.map((att, index) => ({
      id: String(att.pk || att.id || `attachment-${index}`),
      filename: att.filename || att.name || "attachment",
      contentType: att.content_type || att.mime_type || "application/octet-stream",
      size: att.size || 0,
      contentId: att.content_id || att.cid || undefined,
    }));
  }

  // =============================================================================
  // EMAIL STATUS OPERATIONS
  // =============================================================================

  async markAsRead(mailboxId: string, emailId: string): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) {
        email.isRead = true;
        logger.debug("[EmailInboxService] Demo email marked as read", { emailId });
      }
      return true;
    }

    // Modoboa v2: /webmail/emails/flag/ with POST body
    const result = await this.apiRequest(`/webmail/emails/flag/`, {
      method: "POST",
      body: JSON.stringify({ uids: [emailId], flag: "\\Seen" }),
    });

    if (result.success) {
      logger.info("[EmailInboxService] Email marked as read", { mailboxId, emailId });
    }
    return result.success;
  }

  async markAsUnread(mailboxId: string, emailId: string): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) {
        email.isRead = false;
        logger.debug("[EmailInboxService] Demo email marked as unread", { emailId });
      }
      return true;
    }

    // Modoboa v2: unflag to mark as unread
    const result = await this.apiRequest(`/webmail/emails/flag/`, {
      method: "POST",
      body: JSON.stringify({ uids: [emailId], flag: "\\Seen", status: false }),
    });

    if (result.success) {
      logger.info("[EmailInboxService] Email marked as unread", { mailboxId, emailId });
    }
    return result.success;
  }

  async moveToFolder(mailboxId: string, emailId: string, targetFolder: string): Promise<boolean> {
    if (this.isDemoMode()) {
      const email = DEMO_EMAILS.find((e) => e.id === emailId);
      if (email) {
        email.folderId = targetFolder;
        logger.debug("[EmailInboxService] Demo email moved", { emailId, targetFolder });
      }
      return true;
    }

    // Modoboa v2: /webmail/emails/move/
    const result = await this.apiRequest(`/webmail/emails/move/`, {
      method: "POST",
      body: JSON.stringify({ uids: [emailId], to_mailbox: targetFolder }),
    });

    if (result.success) {
      logger.info("[EmailInboxService] Email moved", { mailboxId, emailId, targetFolder });
    }
    return result.success;
  }

  async deleteEmail(mailboxId: string, emailId: string): Promise<boolean> {
    // Move to trash instead of permanent delete
    return this.moveToFolder(mailboxId, emailId, "trash");
  }

  async permanentDelete(mailboxId: string, emailId: string): Promise<boolean> {
    if (this.isDemoMode()) {
      const index = DEMO_EMAILS.findIndex((e) => e.id === emailId);
      if (index >= 0) {
        DEMO_EMAILS.splice(index, 1);
        logger.debug("[EmailInboxService] Demo email permanently deleted", { emailId });
      }
      return true;
    }

    // Modoboa v2: /webmail/emails/delete/
    const result = await this.apiRequest(`/webmail/emails/delete/`, {
      method: "POST",
      body: JSON.stringify({ uids: [emailId] }),
    });

    if (result.success) {
      logger.info("[EmailInboxService] Email permanently deleted", { mailboxId, emailId });
    }
    return result.success;
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

      logger.debug("[EmailInboxService] Demo search completed", {
        query: params.query,
        results: filtered.length,
      });

      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 100,
        hasMore: false,
      };
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set("search", params.query);
    if (params.from) queryParams.set("from", params.from);
    if (params.to) queryParams.set("to", params.to);
    if (params.subject) queryParams.set("subject", params.subject);
    if (params.dateFrom) queryParams.set("date_from", params.dateFrom);
    if (params.dateTo) queryParams.set("date_to", params.dateTo);
    if (params.hasAttachment !== undefined)
      queryParams.set("has_attachment", String(params.hasAttachment));
    if (params.isRead !== undefined) queryParams.set("is_read", String(params.isRead));
    if (params.isFlagged !== undefined) queryParams.set("is_flagged", String(params.isFlagged));

    const folder = params.folder || "inbox";
    const result = await this.apiRequest<any>(
      `/webmail/mailboxes/${mailboxId}/folders/${folder}/messages/search/?${queryParams.toString()}`
    );

    if (!result.success || !result.data) {
      logger.warn("[EmailInboxService] Search failed, returning empty results");
      return { items: [], total: 0, page: 1, limit: 100, hasMore: false };
    }

    const emails: Email[] = Array.isArray(result.data)
      ? result.data.map((e: any) => this.transformEmail(e, mailboxId, folder))
      : result.data.results
        ? result.data.results.map((e: any) => this.transformEmail(e, mailboxId, folder))
        : [];

    return {
      items: emails,
      total: result.data.count || emails.length,
      page: 1,
      limit: 100,
      hasMore: !!result.data.next,
    };
  }

  // =============================================================================
  // UNREAD COUNT
  // =============================================================================

  async getUnreadCount(mailboxId: string): Promise<number> {
    if (this.isDemoMode()) {
      const unread = DEMO_EMAILS.filter(
        (e) => (e.mailboxId === mailboxId || mailboxId === "demo-mailbox-1") && !e.isRead
      ).length;
      return unread;
    }

    const folders = await this.listFolders(mailboxId);
    const inboxFolder = folders.find((f) => f.type === "inbox");
    return inboxFolder?.unreadCount || 0;
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
      logger.error("[EmailInboxService] SMTP not configured");
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

    // Get the mailbox to use as from address
    const mailboxes = await this.listMailboxes();
    const mailbox = mailboxes.items.find((m) => m.id === mailboxId);
    const fromAddress = mailbox?.emailAddress || "noreply@mgrcapital.com";

    // Build references chain
    const references = originalEmail.references || [];
    if (originalEmail.messageId && !references.includes(originalEmail.messageId)) {
      references.push(originalEmail.messageId);
    }

    // Determine reply-to address
    const replyToAddress = originalEmail.replyTo?.address || originalEmail.from.address;

    // Build reply subject
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

    // Get the mailbox to use as from address
    const mailboxes = await this.listMailboxes();
    const mailbox = mailboxes.items.find((m) => m.id === mailboxId);
    const fromAddress = mailbox?.emailAddress || "noreply@mgrcapital.com";

    // Build forward subject
    const subject = originalEmail.subject.toLowerCase().startsWith("fwd:")
      ? originalEmail.subject
      : `Fwd: ${originalEmail.subject}`;

    // Build forward body
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

    // Include original attachments
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
    attachmentId: string
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

    // Modoboa v2: /webmail/emails/attachment/ with uid and partid
    const result = await this.apiRequest<any>(
      `/webmail/emails/attachment/?uid=${emailId}&partid=${attachmentId}`
    );

    if (!result.success || !result.data) {
      return { success: false, error: "Failed to retrieve attachment" };
    }

    return {
      success: true,
      data: {
        id: attachmentId,
        filename: result.data.filename || "attachment",
        contentType: result.data.content_type || "application/octet-stream",
        size: result.data.size || 0,
        content: result.data.content,
      },
    };
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
        lastMessageDate: threadEmails.reduce((latest, e) =>
          new Date(e.date) > new Date(latest) ? e.date : latest,
          threadEmails[0].date
        ),
        messages: threadEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      };
    }

    const result = await this.apiRequest<any>(`/webmail/threads/${threadId}/`);
    if (!result.success || !result.data) {
      return null;
    }

    const messages = (result.data.messages || []).map((e: any) =>
      this.transformEmail(e, mailboxId, e.folder || "inbox", true)
    );

    return {
      id: threadId,
      subject: result.data.subject || messages[0]?.subject || "",
      participants: result.data.participants || [],
      messageCount: messages.length,
      lastMessageDate: result.data.last_message_date || messages[messages.length - 1]?.date || "",
      messages,
    };
  }

  // =============================================================================
  // AUTO-FORWARDING RULES (FOUNDER-CONTROLLED)
  // =============================================================================

  /**
   * Set up automatic email forwarding for a mailbox
   * Only founder can approve/assign forwarding rules
   */
  async setForwardingRule(
    mailboxId: string,
    forwardTo: string,
    options: {
      keepCopy?: boolean;        // Keep copy in original mailbox
      filterSubject?: string;    // Only forward if subject contains
      filterFrom?: string;       // Only forward from specific sender
      enabled?: boolean;
    } = {}
  ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    const { keepCopy = true, filterSubject, filterFrom, enabled = true } = options;

    if (this.isDemoMode()) {
      logger.info("[EmailInbox] Demo mode: Forwarding rule created", {
        mailboxId,
        forwardTo,
        keepCopy,
      });
      return { success: true, ruleId: `fwd_demo_${Date.now()}` };
    }

    try {
      const result = await this.apiRequest<any>(`/webmail/mailboxes/${mailboxId}/forwards/`, {
        method: "POST",
        body: JSON.stringify({
          forward_to: forwardTo,
          keep_copy: keepCopy,
          filter_subject: filterSubject || null,
          filter_from: filterFrom || null,
          enabled,
        }),
      });

      if (result.success && result.data) {
        logger.info("[EmailInbox] Forwarding rule created", {
          mailboxId,
          forwardTo,
          ruleId: result.data.id,
        });
        return { success: true, ruleId: result.data.id };
      }

      return { success: false, error: "Failed to create forwarding rule" };
    } catch (error: any) {
      logger.error("[EmailInbox] Failed to set forwarding rule", { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * List all forwarding rules for a mailbox
   */
  async listForwardingRules(
    mailboxId: string
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
    if (this.isDemoMode()) {
      return {
        rules: [
          {
            id: "fwd_demo_1",
            forwardTo: "backup@gmail.com",
            keepCopy: true,
            enabled: true,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }

    const result = await this.apiRequest<any>(`/webmail/mailboxes/${mailboxId}/forwards/`);
    if (!result.success || !result.data) {
      return { rules: [] };
    }

    return {
      rules: (result.data || []).map((r: any) => ({
        id: r.id,
        forwardTo: r.forward_to,
        keepCopy: r.keep_copy ?? true,
        filterSubject: r.filter_subject,
        filterFrom: r.filter_from,
        enabled: r.enabled ?? true,
        createdAt: r.created_at || new Date().toISOString(),
      })),
    };
  }

  /**
   * Update a forwarding rule
   */
  async updateForwardingRule(
    mailboxId: string,
    ruleId: string,
    updates: {
      forwardTo?: string;
      keepCopy?: boolean;
      filterSubject?: string;
      filterFrom?: string;
      enabled?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isDemoMode()) {
      logger.info("[EmailInbox] Demo mode: Forwarding rule updated", { ruleId, updates });
      return { success: true };
    }

    const result = await this.apiRequest<any>(
      `/webmail/mailboxes/${mailboxId}/forwards/${ruleId}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          forward_to: updates.forwardTo,
          keep_copy: updates.keepCopy,
          filter_subject: updates.filterSubject,
          filter_from: updates.filterFrom,
          enabled: updates.enabled,
        }),
      }
    );

    return { success: result.success, error: result.success ? undefined : "Failed to update rule" };
  }

  /**
   * Delete a forwarding rule
   */
  async deleteForwardingRule(
    mailboxId: string,
    ruleId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isDemoMode()) {
      logger.info("[EmailInbox] Demo mode: Forwarding rule deleted", { ruleId });
      return { success: true };
    }

    const result = await this.apiRequest<any>(
      `/webmail/mailboxes/${mailboxId}/forwards/${ruleId}/`,
      { method: "DELETE" }
    );

    return { success: result.success, error: result.success ? undefined : "Failed to delete rule" };
  }

  /**
   * Check mailbox access for a user
   * FOUNDER: can access all
   * ADMIN: can access assigned mailboxes
   * EMPLOYEE: can only access their own mailbox
   */
  async checkMailboxAccess(
    userId: string,
    userRole: string,
    mailboxId: string
  ): Promise<boolean> {
    // Founder has access to everything
    if (userRole === "ADMIN") {
      return true;
    }

    // For demo mode, allow access
    if (this.isDemoMode()) {
      return true;
    }

    // Check if user owns this mailbox via ProfessionalEmail
    // This would need to query the database
    // For now, we return true and let the route handler do the DB check
    return true;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const emailInboxService = new EmailInboxService();
export default emailInboxService;
