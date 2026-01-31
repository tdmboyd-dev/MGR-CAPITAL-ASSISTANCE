// ============================================
// MODOBOA SERVICE — MGR CAPITAL ASSISTANCE
// API integration with Modoboa mail server
// Manages domains, mailboxes, DNS records
// ============================================

import { logger } from "../utils/logger.js";

const MODOBOA_API_URL = process.env.MODOBOA_API_URL || "http://localhost:8000/api/v2";
const MODOBOA_API_TOKEN = process.env.MODOBOA_API_TOKEN || "";
const MAIL_SERVER_HOSTNAME = process.env.MAIL_SERVER_HOSTNAME || "mail.capitalmgr.com";
const MAIL_SERVER_IP = process.env.MAIL_SERVER_IP || "";

interface ModoboaResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface DnsRecords {
  mx: string;
  spf: string;
  dkim: string;
  dmarc: string;
}

class ModoboaService {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      "Authorization": `Token ${MODOBOA_API_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  private isConfigured(): boolean {
    return !!MODOBOA_API_TOKEN && !!MODOBOA_API_URL;
  }

  // ============================================
  // DOMAIN MANAGEMENT
  // ============================================

  async addDomain(domain: string): Promise<ModoboaResult> {
    if (!this.isConfigured()) {
      return { success: false, error: "Modoboa not configured" };
    }

    try {
      const response = await fetch(`${MODOBOA_API_URL}/domains/`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          name: domain,
          enabled: true,
          type: "domain",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("[Modoboa] addDomain failed", { domain, error });
        return { success: false, error: `Failed to add domain: ${error}` };
      }

      const data: any = await response.json();
      logger.info("[Modoboa] Domain added", { domain, id: data.pk });
      return { success: true, data };
    } catch (error: any) {
      logger.error("[Modoboa] addDomain error", { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async deleteDomain(domain: string): Promise<ModoboaResult> {
    if (!this.isConfigured()) return { success: false, error: "Modoboa not configured" };

    try {
      const response = await fetch(`${MODOBOA_API_URL}/domains/${domain}/`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!response.ok) {
        return { success: false, error: "Failed to delete domain" };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async verifyDomain(domain: string): Promise<ModoboaResult> {
    if (!this.isConfigured()) return { success: false, error: "Modoboa not configured" };

    try {
      const response = await fetch(`${MODOBOA_API_URL}/domains/${domain}/dns/`, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        return { success: false, error: "Failed to verify domain DNS" };
      }

      const data: any = await response.json();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // MAILBOX MANAGEMENT
  // ============================================

  async createMailbox(params: {
    email: string;
    password: string;
    displayName: string;
    domain: string;
    quotaMb?: number;
  }): Promise<ModoboaResult> {
    if (!this.isConfigured()) return { success: false, error: "Modoboa not configured" };

    const [localPart] = params.email.split("@");

    try {
      // Create account first
      const accountResponse = await fetch(`${MODOBOA_API_URL}/accounts/`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          username: params.email,
          first_name: params.displayName,
          last_name: "",
          password: params.password,
          role: "SimpleUsers",
          is_active: true,
          mailbox: {
            full_address: params.email,
            quota: params.quotaMb || 1024,
            use_domain_quota: false,
          },
        }),
      });

      if (!accountResponse.ok) {
        const error = await accountResponse.text();
        logger.error("[Modoboa] createMailbox failed", { email: params.email, error });
        return { success: false, error: `Failed to create mailbox: ${error}` };
      }

      const data: any = await accountResponse.json();
      logger.info("[Modoboa] Mailbox created", { email: params.email });
      return { success: true, data };
    } catch (error: any) {
      logger.error("[Modoboa] createMailbox error", { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async deleteMailbox(email: string): Promise<ModoboaResult> {
    if (!this.isConfigured()) return { success: false, error: "Modoboa not configured" };

    try {
      const response = await fetch(`${MODOBOA_API_URL}/accounts/${email}/`, {
        method: "DELETE",
        headers: this.headers,
      });

      if (!response.ok) {
        return { success: false, error: "Failed to delete mailbox" };
      }

      logger.info("[Modoboa] Mailbox deleted", { email });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async resetMailboxPassword(email: string, newPassword: string): Promise<ModoboaResult> {
    if (!this.isConfigured()) return { success: false, error: "Modoboa not configured" };

    try {
      const response = await fetch(`${MODOBOA_API_URL}/accounts/${email}/`, {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        return { success: false, error: "Failed to reset password" };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DNS RECORD GENERATION
  // ============================================

  generateDnsRecords(domain: string): DnsRecords {
    return {
      mx: `${domain}. IN MX 10 ${MAIL_SERVER_HOSTNAME}.`,
      spf: `${domain}. IN TXT "v=spf1 mx a ip4:${MAIL_SERVER_IP} ~all"`,
      dkim: `mail._domainkey.${domain}. IN TXT "v=DKIM1; k=rsa; p=<DKIM_PUBLIC_KEY>"`,
      dmarc: `_dmarc.${domain}. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`,
    };
  }

  // ============================================
  // STATUS CHECK
  // ============================================

  async getStatus(): Promise<{ configured: boolean; connected: boolean; version?: string }> {
    if (!this.isConfigured()) {
      return { configured: false, connected: false };
    }

    try {
      const response = await fetch(`${MODOBOA_API_URL}/`, {
        method: "GET",
        headers: this.headers,
      });

      return {
        configured: true,
        connected: response.ok,
      };
    } catch {
      return { configured: true, connected: false };
    }
  }
}

export const modoboaService = new ModoboaService();
