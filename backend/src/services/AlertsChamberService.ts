/**
 * AlertsChamberService.ts — MGR CAPITAL ASSISTANCE
 * BotBuddy: Founder's casual chat interface for creating alerts
 *
 * The founder chats in plain English. BotBuddy interprets the intent
 * and dispatches real notifications across the platform.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { logger } from "../utils/logger.js";
import { notificationCenterService } from "./NotificationCenterService.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  id: string;
  role: "founder" | "botbuddy";
  content: string;
  action?: AlertAction | null;
  timestamp: Date;
}

export interface AlertAction {
  type: "single_user" | "role_blast" | "platform_wide" | "child_company" | "bot_command" | "info";
  targetRole?: string;
  targetUserId?: string;
  targetTenantId?: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  dispatched: boolean;
  recipientCount?: number;
}

interface ParsedIntent {
  type: AlertAction["type"];
  targetRole?: string;
  targetUserId?: string;
  targetTenantId?: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
}

// =============================================================================
// BOTBUDDY PERSONALITY
// =============================================================================

const BUDDY_RESPONSES = {
  greetings: [
    "Yo boss, what's good? Who we blastin' today?",
    "What up chief. Tell me who needs to hear it.",
    "I'm here. Talk to me. What's the move?",
    "Aight I'm locked in. What we doin?",
    "Sup boss. Ready to send some fire.",
  ],
  confirmSingle: [
    "Done. Lit that notification up for {name}. They'll see it pop up real-time.",
    "Sent. {name} is about to get hit with that alert. No escape.",
    "Boom. {name}'s inbox just got blessed. Alert is live.",
    "Aight {name} got the message. Popped right up on their screen.",
  ],
  confirmBlast: [
    "BOOM. Blasted that to every {role} on the platform. {count} people just got hit.",
    "Done deal. All {count} {role}s just got that notification. No one's missing this.",
    "Sent. {count} {role}s are seeing that pop up RIGHT NOW. Let's go.",
    "All {count} {role}s notified. They better pay attention to this one.",
  ],
  confirmPlatform: [
    "SENT TO EVERYBODY. {count} people across the entire platform just got hit. Nobody's sleeping on this.",
    "Platform-wide blast DONE. {count} users seeing this pop up right now. This is what control looks like.",
    "Whole platform just got rocked. {count} notifications sent. That's power baby.",
  ],
  confirmChildCompany: [
    "Child company alert dispatched. {name} team just got the message.",
    "Sent to the {name} crew. They know what's up now.",
    "Child company {name} — notified. Boss move.",
  ],
  confirmBot: [
    "Bot command queued. The machines are listening.",
    "Bot alert dispatched. The bots know what to do.",
    "Sent to the bot network. They're on it.",
  ],
  cantParse: [
    "Bro what? I didn't catch that. Try somethin like 'tell all employees meeting at 3' or 'alert John Smith great job'",
    "Nah I ain't understand that one boss. Hit me with something like 'blast all employees: new policy update' or 'tell the bots to check cases'",
    "My bad, that went over my head. Try: 'send everyone: system maintenance tonight' or 'alert employee John: nice work on the case'",
    "Yo I need you to be a lil clearer. Like 'tell all clients we got updates' or 'alert platform: new feature drop'",
  ],
  help: [
    `Aight here's what I can do boss:

• **"tell/alert [name]: [message]"** — Send to one person
• **"blast/tell all employees: [message]"** — Hit all employees
• **"blast/tell all clients: [message]"** — Hit all clients
• **"platform alert: [message]"** — Send to EVERYBODY
• **"tell [child company name]: [message]"** — Child company alert
• **"bot alert: [message]"** — Alert the bot network
• **"urgent/critical: [message]"** — High priority alert

I'm always listenin. Just talk normal and I'll figure it out.`,
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// =============================================================================
// SERVICE
// =============================================================================

class AlertsChamberService {
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  /**
   * Process a message from the founder and return BotBuddy's response
   */
  async processMessage(founderId: string, content: string): Promise<ChatMessage> {
    // Initialize conversation if needed
    if (!this.conversationHistory.has(founderId)) {
      this.conversationHistory.set(founderId, []);
    }
    const history = this.conversationHistory.get(founderId)!;

    // Save founder message
    const founderMsg: ChatMessage = {
      id: `f-${Date.now()}`,
      role: "founder",
      content,
      timestamp: new Date(),
    };
    history.push(founderMsg);

    // Parse the intent
    const lowerContent = content.toLowerCase().trim();

    // Handle greetings
    if (this.isGreeting(lowerContent)) {
      return this.buddyReply(founderId, pickRandom(BUDDY_RESPONSES.greetings));
    }

    // Handle help requests
    if (lowerContent === "help" || lowerContent === "?" || lowerContent.includes("what can you do")) {
      return this.buddyReply(founderId, BUDDY_RESPONSES.help[0]);
    }

    // Try to parse an alert intent
    const intent = await this.parseIntent(content);

    if (!intent) {
      return this.buddyReply(founderId, pickRandom(BUDDY_RESPONSES.cantParse));
    }

    // Dispatch the alert
    const action = await this.dispatchAlert(founderId, intent);

    // Generate response based on action type
    const response = this.generateConfirmation(action);
    return this.buddyReply(founderId, response, action);
  }

  /**
   * Get conversation history
   */
  getHistory(founderId: string): ChatMessage[] {
    return this.conversationHistory.get(founderId) || [];
  }

  /**
   * Clear conversation history
   */
  clearHistory(founderId: string): void {
    this.conversationHistory.set(founderId, []);
  }

  /**
   * Process a message from a child company owner (tenant-scoped BotBuddy)
   * Can ONLY alert employees within their own tenant — no platform-wide, no bot commands
   */
  async processMessageScoped(
    ownerId: string,
    tenantId: string,
    companyName: string,
    content: string
  ): Promise<ChatMessage> {
    if (!this.conversationHistory.has(ownerId)) {
      this.conversationHistory.set(ownerId, []);
    }
    const history = this.conversationHistory.get(ownerId)!;

    const founderMsg: ChatMessage = {
      id: `f-${Date.now()}`,
      role: "founder",
      content,
      timestamp: new Date(),
    };
    history.push(founderMsg);

    const lowerContent = content.toLowerCase().trim();

    if (this.isGreeting(lowerContent)) {
      return this.buddyReply(ownerId, `Yo ${companyName} boss! What's the move? Who on your team needs to hear something?`);
    }

    if (lowerContent === "help" || lowerContent === "?") {
      return this.buddyReply(ownerId, `Here's what I can do for ${companyName}:\n\n• **"tell [employee name]: [message]"** — Alert one of your team members\n• **"tell all team: [message]"** — Blast your whole team\n• **"urgent: [message]"** — High priority alert to everyone\n\nI only alert YOUR employees — I keep it in the family.`);
    }

    // Parse intent — scoped to tenant
    const intent = await this.parseScopedIntent(content, tenantId);

    if (!intent) {
      return this.buddyReply(ownerId, `Nah I didn't catch that. Try "tell all team: [message]" or "tell [name]: [message]". I only work with YOUR ${companyName} employees.`);
    }

    const action = await this.dispatchScopedAlert(ownerId, tenantId, intent);
    const response = this.generateConfirmation(action);
    return this.buddyReply(ownerId, response, action);
  }

  /**
   * Parse intent scoped to a tenant — only allows single_user and team-wide
   */
  private async parseScopedIntent(text: string, tenantId: string): Promise<ParsedIntent | null> {
    const lower = text.toLowerCase().trim();

    let priority: ParsedIntent["priority"] = "normal";
    if (lower.includes("urgent") || lower.includes("critical")) priority = "urgent";
    else if (lower.includes("important")) priority = "high";

    const cleanText = text.replace(/\b(urgent|critical|important)\b:?\s*/gi, "").trim();

    // Team-wide blast: "tell all team: ...", "blast team: ...", "alert everyone: ..."
    const teamPatterns = [
      /(?:tell|blast|alert|notify)\s+(?:all\s+)?(?:team|everyone|staff|my\s+(?:team|employees?))[:\s]+(.+)/i,
    ];
    for (const pattern of teamPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          type: "child_company",
          targetTenantId: tenantId,
          title: "Message from Your Boss",
          message: match[1].trim(),
          priority,
        };
      }
    }

    // Single user within tenant: "tell [name]: ..."
    const singlePatterns = [
      /(?:tell|alert|send|notify|message)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)[:\s]+(.+)/i,
    ];
    for (const pattern of singlePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const nameSearch = match[1].trim();
        const skipWords = ["all", "everyone", "team", "staff", "my"];
        if (skipWords.some((w) => nameSearch.toLowerCase() === w)) continue;

        const targetUser = await prisma.user.findFirst({
          where: {
            name: { contains: nameSearch, mode: "insensitive" },
            tenantId,
            isActive: true,
          },
          select: { id: true, name: true },
        });

        if (targetUser) {
          return {
            type: "single_user",
            targetUserId: targetUser.id,
            title: "Message from Your Boss",
            message: match[2].trim(),
            priority,
          };
        }
      }
    }

    return null;
  }

  /**
   * Dispatch alert scoped to a tenant
   */
  private async dispatchScopedAlert(ownerId: string, tenantId: string, intent: ParsedIntent): Promise<AlertAction> {
    const action: AlertAction = {
      type: intent.type,
      targetUserId: intent.targetUserId,
      targetTenantId: tenantId,
      title: intent.title,
      message: intent.message,
      priority: intent.priority,
      dispatched: false,
      recipientCount: 0,
    };

    try {
      if (intent.type === "single_user" && intent.targetUserId) {
        await notificationCenterService.sendNotification({
          userId: intent.targetUserId,
          category: "alert",
          priority: intent.priority,
          title: intent.title,
          message: intent.message,
          metadata: { fromChildCompanyOwner: true, via: "alerts-chamber-scoped" },
        });
        action.dispatched = true;
        action.recipientCount = 1;
      } else if (intent.type === "child_company") {
        const tenantUsers = await prisma.user.findMany({
          where: { tenantId, isActive: true },
          select: { id: true },
        });
        for (const u of tenantUsers) {
          await notificationCenterService.sendNotification({
            userId: u.id,
            category: "alert",
            priority: intent.priority,
            title: intent.title,
            message: intent.message,
            metadata: { fromChildCompanyOwner: true, via: "alerts-chamber-scoped" },
          });
        }
        action.dispatched = true;
        action.recipientCount = tenantUsers.length;
      }

      await prisma.auditLog.create({
        data: {
          userId: ownerId,
          action: "CHILD_COMPANY_ALERT_DISPATCH",
          entityType: "NOTIFICATION",
          entityId: action.targetUserId || tenantId,
          details: {
            type: action.type,
            title: action.title,
            recipientCount: action.recipientCount,
          },
        },
      });
    } catch (error) {
      logger.error("Scoped AlertsChamber dispatch failed", { error: String(error) });
    }

    return action;
  }

  // ─── PRIVATE METHODS ───

  private buddyReply(founderId: string, content: string, action?: AlertAction): ChatMessage {
    const msg: ChatMessage = {
      id: `b-${Date.now()}`,
      role: "botbuddy",
      content,
      action: action || null,
      timestamp: new Date(),
    };
    const history = this.conversationHistory.get(founderId) || [];
    history.push(msg);
    // Keep last 100 messages
    if (history.length > 100) history.splice(0, history.length - 100);
    this.conversationHistory.set(founderId, history);
    return msg;
  }

  private isGreeting(text: string): boolean {
    const greetings = ["hey", "hi", "hello", "yo", "sup", "what's up", "whats up", "howdy", "wassup", "wsg"];
    return greetings.some((g) => text === g || text.startsWith(g + " ") || text.startsWith(g + ","));
  }

  /**
   * Parse plain English into an alert intent
   */
  private async parseIntent(text: string): Promise<ParsedIntent | null> {
    const lower = text.toLowerCase().trim();

    // Detect priority
    let priority: ParsedIntent["priority"] = "normal";
    if (lower.includes("urgent") || lower.includes("critical") || lower.includes("asap") || lower.includes("emergency")) {
      priority = "urgent";
    } else if (lower.includes("important") || lower.includes("high priority")) {
      priority = "high";
    }

    // Clean out priority words for parsing
    const cleanText = text
      .replace(/\b(urgent|critical|asap|emergency|important|high priority)\b:?\s*/gi, "")
      .trim();
    const cleanLower = cleanText.toLowerCase();

    // ── Pattern: Platform-wide ──
    // "platform alert: ...", "tell everyone: ...", "send everyone: ...", "blast everyone: ...",
    // "alert the whole platform: ...", "company wide: ..."
    const platformPatterns = [
      /(?:platform\s+alert|tell\s+everyone|send\s+everyone|blast\s+everyone|alert\s+everyone|company\s*wide|all\s+hands|announce\s+to\s+all)[:\s]+(.+)/i,
      /(?:send|blast|tell|alert)\s+(?:the\s+)?(?:whole|entire)\s+(?:platform|company|org)[:\s]+(.+)/i,
    ];
    for (const pattern of platformPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          type: "platform_wide",
          title: "Platform Announcement",
          message: match[1].trim(),
          priority,
        };
      }
    }

    // ── Pattern: Role blast ──
    // "tell all employees: ...", "blast employees: ...", "alert all clients: ..."
    const rolePatterns = [
      /(?:tell|blast|send|alert|notify)\s+(?:all\s+)?(?:the\s+)?(employees?|clients?|admins?|staff|team)[:\s]+(.+)/i,
    ];
    for (const pattern of rolePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let role = match[1].toLowerCase();
        if (role.startsWith("employee") || role === "staff" || role === "team") role = "EMPLOYEE";
        else if (role.startsWith("client")) role = "CLIENT";
        else if (role.startsWith("admin")) role = "ADMIN";
        else role = "EMPLOYEE";

        return {
          type: "role_blast",
          targetRole: role,
          title: "Announcement",
          message: match[2].trim(),
          priority,
        };
      }
    }

    // ── Pattern: Bot command ──
    // "bot alert: ...", "tell the bots: ...", "bot command: ..."
    const botPatterns = [
      /(?:bot\s+(?:alert|command|task)|tell\s+(?:the\s+)?bots?|alert\s+(?:the\s+)?bots?)[:\s]+(.+)/i,
    ];
    for (const pattern of botPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        return {
          type: "bot_command",
          title: "Bot Command",
          message: match[1].trim(),
          priority,
        };
      }
    }

    // ── Pattern: Child company alert ──
    // "tell [company name] team: ...", "alert child company [name]: ..."
    const childCoPatterns = [
      /(?:tell|alert|send|notify)\s+(?:child\s+company\s+)?([a-z\s]+?)\s+(?:team|company|crew)[:\s]+(.+)/i,
    ];
    for (const pattern of childCoPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const companySearch = match[1].trim();
        // Look up child company by name
        const childCompany = await prisma.childCompany.findFirst({
          where: {
            companyName: { contains: companySearch, mode: "insensitive" },
            status: "ACTIVE",
          },
          select: { id: true, tenantId: true, companyName: true },
        });

        if (childCompany) {
          return {
            type: "child_company",
            targetTenantId: childCompany.tenantId || undefined,
            title: `Message from the Founder`,
            message: match[2].trim(),
            priority,
          };
        }
      }
    }

    // ── Pattern: Single user ──
    // "tell John Smith: ...", "alert Sarah: ...", "send [name]: ..."
    const singlePatterns = [
      /(?:tell|alert|send\s+to|notify|message)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)[:\s]+(.+)/i,
    ];
    for (const pattern of singlePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const nameSearch = match[1].trim();
        // Skip role words
        const roleWords = ["all", "everyone", "employees", "clients", "admins", "the", "bots", "platform"];
        if (roleWords.some((w) => nameSearch.toLowerCase().startsWith(w))) continue;

        // Look up user by name
        const targetUser = await prisma.user.findFirst({
          where: {
            name: { contains: nameSearch, mode: "insensitive" },
            isActive: true,
          },
          select: { id: true, name: true },
        });

        if (targetUser) {
          return {
            type: "single_user",
            targetUserId: targetUser.id,
            title: "Message from the Founder",
            message: match[2].trim(),
            priority,
          };
        }
      }
    }

    return null;
  }

  /**
   * Dispatch the alert to the notification system
   */
  private async dispatchAlert(founderId: string, intent: ParsedIntent): Promise<AlertAction> {
    const action: AlertAction = {
      type: intent.type,
      targetRole: intent.targetRole,
      targetUserId: intent.targetUserId,
      targetTenantId: intent.targetTenantId,
      title: intent.title,
      message: intent.message,
      priority: intent.priority,
      dispatched: false,
      recipientCount: 0,
    };

    try {
      switch (intent.type) {
        case "single_user": {
          if (!intent.targetUserId) break;
          await notificationCenterService.sendNotification({
            userId: intent.targetUserId,
            category: "alert",
            priority: intent.priority,
            title: intent.title,
            message: intent.message,
            metadata: { fromFounder: true, via: "alerts-chamber" },
          });
          action.dispatched = true;
          action.recipientCount = 1;
          break;
        }

        case "role_blast": {
          if (!intent.targetRole) break;
          const count = await notificationCenterService.sendToRole(intent.targetRole, {
            category: "alert",
            priority: intent.priority,
            title: intent.title,
            message: intent.message,
            metadata: { fromFounder: true, via: "alerts-chamber" },
          });
          action.dispatched = true;
          action.recipientCount = count;
          break;
        }

        case "platform_wide": {
          // Send to all roles
          let total = 0;
          for (const role of ["FOUNDER", "ADMIN", "EMPLOYEE", "CLIENT"]) {
            const count = await notificationCenterService.sendToRole(role, {
              category: "system",
              priority: intent.priority,
              title: intent.title,
              message: intent.message,
              metadata: { fromFounder: true, via: "alerts-chamber", platformWide: true },
            });
            total += count;
          }
          action.dispatched = true;
          action.recipientCount = total;
          break;
        }

        case "child_company": {
          if (!intent.targetTenantId) break;
          // Find all users in this tenant
          const tenantUsers = await prisma.user.findMany({
            where: { tenantId: intent.targetTenantId, isActive: true },
            select: { id: true },
          });

          for (const u of tenantUsers) {
            await notificationCenterService.sendNotification({
              userId: u.id,
              category: "alert",
              priority: intent.priority,
              title: intent.title,
              message: intent.message,
              metadata: { fromFounder: true, via: "alerts-chamber", childCompany: true },
            });
          }
          action.dispatched = true;
          action.recipientCount = tenantUsers.length;
          break;
        }

        case "bot_command": {
          // Log as a system ops insight for bots to pick up
          await prisma.opsInsight.create({
            data: {
              insightType: "founder_bot_command",
              title: intent.title,
              description: intent.message,
              severity: intent.priority === "urgent" ? "CRITICAL" : "INFO",
              details: { fromFounder: true, via: "alerts-chamber", botCommand: true },
            },
          });
          action.dispatched = true;
          action.recipientCount = 1;
          break;
        }
      }

      // Log to audit
      await prisma.auditLog.create({
        data: {
          userId: founderId,
          action: "ALERTS_CHAMBER_DISPATCH",
          entityType: "NOTIFICATION",
          entityId: action.targetUserId || action.targetTenantId || "platform",
          details: {
            type: action.type,
            title: action.title,
            message: action.message,
            priority: action.priority,
            recipientCount: action.recipientCount,
          },
        },
      });
    } catch (error) {
      logger.error("AlertsChamber dispatch failed", { error: String(error) });
    }

    return action;
  }

  /**
   * Generate a casual confirmation message
   */
  private generateConfirmation(action: AlertAction): string {
    if (!action.dispatched) {
      return "Yo something went wrong dispatching that. Check the logs or try again.";
    }

    switch (action.type) {
      case "single_user": {
        const template = pickRandom(BUDDY_RESPONSES.confirmSingle);
        return template.replace(/{name}/g, "them");
      }
      case "role_blast": {
        const template = pickRandom(BUDDY_RESPONSES.confirmBlast);
        const roleName = (action.targetRole || "employee").toLowerCase();
        return template
          .replace(/{role}/g, roleName)
          .replace(/{count}/g, String(action.recipientCount || 0));
      }
      case "platform_wide": {
        const template = pickRandom(BUDDY_RESPONSES.confirmPlatform);
        return template.replace(/{count}/g, String(action.recipientCount || 0));
      }
      case "child_company": {
        const template = pickRandom(BUDDY_RESPONSES.confirmChildCompany);
        return template.replace(/{name}/g, "that");
      }
      case "bot_command": {
        return pickRandom(BUDDY_RESPONSES.confirmBot);
      }
      default:
        return "Done. Alert sent.";
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const alertsChamberService = new AlertsChamberService();
export default alertsChamberService;
