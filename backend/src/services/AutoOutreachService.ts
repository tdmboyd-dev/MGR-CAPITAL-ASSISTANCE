// ============================================
// AUTO OUTREACH SERVICE — MGR CAPITAL ASSISTANCE
// Full outreach pipeline: skip trace → SMS → email → call
// TCPA-compliant, with follow-up scheduling
// ============================================

import { PrismaClient } from "@prisma/client";
import { skipTraceService } from "./SkipTraceService.js";
import { SMSService } from "./SMSService.js";
import { notificationService } from "./notificationService.js";
import { botSubscriptionService, ACTION_COSTS } from "./BotSubscriptionService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();
const smsService = new SMSService();

// TCPA-compliant contact hours (local time)
const TCPA_START_HOUR = 8;  // 8 AM
const TCPA_END_HOUR = 21;   // 9 PM

// Follow-up schedule (days after initial contact)
const FOLLOW_UP_SCHEDULE = [3, 7, 14];

// Max attempts before escalation
const MAX_ATTEMPTS = 3;

interface OutreachResult {
  caseId: string;
  actions: OutreachAction[];
  totalCostCents: number;
  nextFollowUp?: Date;
  escalated: boolean;
}

interface OutreachAction {
  type: "skip_trace" | "sms" | "email" | "call_scheduled" | "escalation";
  success: boolean;
  costCents: number;
  details?: string;
}

class AutoOutreachService {
  /**
   * Full outreach pipeline for a case
   * Skip trace → SMS → Email → Schedule call
   */
  async initiateOutreach(caseId: string, employeeId?: string): Promise<OutreachResult> {
    const actions: OutreachAction[] = [];
    let totalCostCents = 0;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: { select: { id: true, name: true } },
      },
    });

    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    const actingUserId = employeeId || caseData.assignedEmployeeId;
    if (!actingUserId) {
      throw new Error("No employee assigned to case");
    }

    // Check bot access
    const canUse = await botSubscriptionService.canUseBot(actingUserId, "outreach");
    if (!canUse) {
      throw new Error("User does not have outreach bot access. Subscribe to STARTER tier or above.");
    }

    // Check TCPA hours
    if (!this.isWithinTCPAHours()) {
      logger.info(`Outreach delayed — outside TCPA hours for case ${caseId}`);
      return {
        caseId,
        actions: [{ type: "sms", success: false, costCents: 0, details: "Outside TCPA hours (8am-9pm). Will retry during business hours." }],
        totalCostCents: 0,
        nextFollowUp: this.getNextTCPAWindow(),
        escalated: false,
      };
    }

    // 1. Skip trace owner if no contact info
    const client = caseData.client;
    const needsSkipTrace = !client?.phone && !client?.email;

    if (needsSkipTrace) {
      try {
        const ownerName = caseData.previousOwner || client?.name || "";
        const [firstName, ...lastParts] = ownerName.split(" ");
        const lastName = lastParts.join(" ") || firstName;

        const traceResult = await skipTraceService.tracePerson({
          firstName: firstName || "Unknown",
          lastName: lastName || "Unknown",
          address: caseData.propertyAddress || undefined,
          state: caseData.state || undefined,
        }, false);

        const cost = ACTION_COSTS.skip_trace;
        totalCostCents += cost;
        actions.push({ type: "skip_trace", success: true, costCents: cost, details: `Found ${traceResult.phones?.length || 0} phones, ${traceResult.emails?.length || 0} emails` });

        await botSubscriptionService.logUsage(actingUserId, "outreach", "skip_trace", cost, caseId, {
          phonesFound: traceResult.phones?.length || 0,
          emailsFound: traceResult.emails?.length || 0,
        });

        // Update client (User) with skip trace results
        if (client && traceResult.phones?.[0]) {
          await prisma.user.update({
            where: { id: client.id },
            data: { phone: String(traceResult.phones[0].number || traceResult.phones[0]) },
          });
        }
        if (client && traceResult.emails?.[0]) {
          await prisma.user.update({
            where: { id: client.id },
            data: { email: String(traceResult.emails[0].address || traceResult.emails[0]) },
          });
        }
      } catch (error: any) {
        actions.push({ type: "skip_trace", success: false, costCents: 0, details: error.message });
      }
    }

    // Reload client after possible skip trace update
    const updatedClient = client ? await prisma.user.findUnique({ where: { id: client.id } }) : null;
    const phone = updatedClient?.phone || client?.phone;
    const email = updatedClient?.email || client?.email;

    // 2. Send SMS if phone available
    if (phone) {
      try {
        const smsMessage = this.buildOutreachSMS(caseData, updatedClient || client);
        await smsService.send(phone, smsMessage);

        const cost = ACTION_COSTS.sms_sent;
        totalCostCents += cost;
        actions.push({ type: "sms", success: true, costCents: cost, details: `SMS sent to ${phone.slice(0, 3)}***${phone.slice(-4)}` });

        await botSubscriptionService.logUsage(actingUserId, "outreach", "sms_sent", cost, caseId);

        // Log communication
        await prisma.communication.create({
          data: {
            caseId,
            userId: actingUserId,
            type: "TEXT",
            direction: "OUTBOUND",
            subject: "Initial Outreach",
            content: smsMessage,
            outcome: "SENT",
          },
        });
      } catch (error: any) {
        actions.push({ type: "sms", success: false, costCents: 0, details: error.message });
      }
    }

    // 3. Send email if available
    if (email) {
      try {
        const emailSubject = "Important: Unclaimed Funds May Belong to You";
        const emailBody = this.buildOutreachEmail(caseData, updatedClient || client);

        await notificationService.sendClientEmail({
          to: email,
          subject: emailSubject,
          body: emailBody,
        });

        const cost = ACTION_COSTS.email_sent;
        totalCostCents += cost;
        actions.push({ type: "email", success: true, costCents: cost, details: `Email sent to ${email}` });

        await botSubscriptionService.logUsage(actingUserId, "outreach", "email_sent", cost, caseId);

        // Log communication
        await prisma.communication.create({
          data: {
            caseId,
            userId: actingUserId,
            type: "EMAIL",
            direction: "OUTBOUND",
            subject: emailSubject,
            content: emailBody,
            outcome: "SENT",
          },
        });
      } catch (error: any) {
        actions.push({ type: "email", success: false, costCents: 0, details: error.message });
      }
    }

    // 4. Schedule follow-up call (3 days out)
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + FOLLOW_UP_SCHEDULE[0]);
    followUpDate.setHours(10, 0, 0, 0); // 10 AM

    actions.push({
      type: "call_scheduled",
      success: true,
      costCents: 0,
      details: `Follow-up call scheduled for ${followUpDate.toISOString().split("T")[0]}`,
    });

    // Create a deadline for the follow-up
    await prisma.deadline.create({
      data: {
        caseId,
        title: "Auto-Outreach Follow-Up Call",
        description: "Automated follow-up call scheduled by outreach bot",
        dueDate: followUpDate,
      },
    });

    // Update case status if NEW
    if (caseData.status === "NEW") {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "CONTACTED" },
      });
    }

    // Log the outreach attempt
    await prisma.opsInsight.create({
      data: {
        type: "CASE_RECOMMENDATION",
        priority: "LOW",
        title: `Auto-outreach initiated: ${caseData.internalCode}`,
        summary: `${actions.filter(a => a.success).length}/${actions.length} actions succeeded. Cost: $${(totalCostCents / 100).toFixed(2)}`,
        details: { caseId, actions, totalCostCents } as any,
        plainEnglish: `Auto-outreach for case ${caseData.internalCode}: ${actions.map(a => `${a.type}: ${a.success ? "OK" : "FAILED"}`).join(", ")}`,
        recommendations: [],
        relatedCaseIds: [caseId],
        relatedUserIds: actingUserId ? [actingUserId] : [],
        relatedAlertIds: [],
        sourceBot: "autoOutreach",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      caseId,
      actions,
      totalCostCents,
      nextFollowUp: followUpDate,
      escalated: false,
    };
  }

  /**
   * Follow-up on a case (Day 3, 7, 14)
   */
  async followUp(caseId: string, attempt: number = 1): Promise<OutreachResult> {
    const actions: OutreachAction[] = [];
    let totalCostCents = 0;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: { select: { id: true } },
      },
    });

    if (!caseData) throw new Error(`Case ${caseId} not found`);

    const actingUserId = caseData.assignedEmployeeId;
    if (!actingUserId) throw new Error("No employee assigned");

    if (!this.isWithinTCPAHours()) {
      return { caseId, actions: [], totalCostCents: 0, nextFollowUp: this.getNextTCPAWindow(), escalated: false };
    }

    const phone = caseData.client?.phone;
    const email = caseData.client?.email;

    // Send follow-up SMS
    if (phone) {
      try {
        const message = this.buildFollowUpSMS(caseData, attempt);
        await smsService.send(phone, message);
        const cost = ACTION_COSTS.sms_sent;
        totalCostCents += cost;
        actions.push({ type: "sms", success: true, costCents: cost, details: `Follow-up #${attempt} SMS sent` });
        await botSubscriptionService.logUsage(actingUserId, "outreach", "sms_sent", cost, caseId);

        await prisma.communication.create({
          data: {
            caseId,
            userId: actingUserId,
            type: "TEXT",
            direction: "OUTBOUND",
            subject: `Follow-Up #${attempt}`,
            content: message,
            outcome: "SENT",
          },
        });
      } catch (error: any) {
        actions.push({ type: "sms", success: false, costCents: 0, details: error.message });
      }
    }

    // Send follow-up email on attempts 2+
    if (email && attempt >= 2) {
      try {
        const emailBody = this.buildFollowUpEmail(caseData, attempt);
        await notificationService.sendClientEmail({
          to: email,
          subject: `Follow-Up: Unclaimed Funds — Action Required`,
          body: emailBody,
        });
        actions.push({ type: "email", success: true, costCents: 0, details: `Follow-up #${attempt} email sent` });
        await botSubscriptionService.logUsage(actingUserId, "outreach", "email_sent", 0, caseId);
      } catch (error: any) {
        actions.push({ type: "email", success: false, costCents: 0, details: error.message });
      }
    }

    // Check if we should escalate
    if (attempt >= MAX_ATTEMPTS) {
      return this.escalate(caseId);
    }

    // Schedule next follow-up
    const nextFollowUpDays = FOLLOW_UP_SCHEDULE[attempt] || 14;
    const nextFollowUp = new Date();
    nextFollowUp.setDate(nextFollowUp.getDate() + nextFollowUpDays);

    return { caseId, actions, totalCostCents, nextFollowUp, escalated: false };
  }

  /**
   * Escalate to employee for manual outreach
   */
  async escalate(caseId: string): Promise<OutreachResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { assignedEmployee: { select: { id: true, name: true } } },
    });

    if (!caseData) throw new Error(`Case ${caseId} not found`);

    // Create escalation insight
    await prisma.opsInsight.create({
      data: {
        type: "CASE_RECOMMENDATION",
        priority: "HIGH",
        title: `Auto-outreach exhausted: ${caseData.internalCode}`,
        summary: `${MAX_ATTEMPTS} automated outreach attempts failed. Manual intervention needed.`,
        details: { caseId, attempts: MAX_ATTEMPTS },
        plainEnglish: `Case ${caseData.internalCode} has been through ${MAX_ATTEMPTS} rounds of automated outreach with no response. ${caseData.assignedEmployee?.name || "The assigned employee"} should try personal outreach or consider alternative contact methods.`,
        recommendations: [
          "Try calling from a different number",
          "Send a physical letter via mail",
          "Check for alternative contact information",
          "Consider door-to-door visit for high-value cases",
        ],
        relatedCaseIds: [caseId],
        relatedUserIds: caseData.assignedEmployeeId ? [caseData.assignedEmployeeId] : [],
        relatedAlertIds: [],
        sourceBot: "autoOutreach",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      caseId,
      actions: [{ type: "escalation", success: true, costCents: 0, details: "Escalated to employee for manual outreach" }],
      totalCostCents: 0,
      escalated: true,
    };
  }

  /**
   * Process all pending outreach cases
   */
  async processPendingOutreach(): Promise<{ processed: number; results: OutreachResult[] }> {
    // Get cases that need outreach
    const cases = await prisma.case.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
        assignedEmployeeId: { not: null },
      },
      include: {
        communications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 20, // Process in batches
    });

    const results: OutreachResult[] = [];

    for (const caseData of cases) {
      // Skip if contacted recently (within 3 days)
      const lastComm = caseData.communications[0];
      if (lastComm) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(lastComm.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact < 3) continue;
      }

      try {
        if (caseData.status === "NEW") {
          const result = await this.initiateOutreach(caseData.id, caseData.assignedEmployeeId!);
          results.push(result);
        } else {
          // Determine follow-up attempt number
          const commCount = await prisma.communication.count({
            where: { caseId: caseData.id, direction: "OUTBOUND" },
          });
          const attempt = Math.min(commCount, MAX_ATTEMPTS);
          const result = await this.followUp(caseData.id, attempt);
          results.push(result);
        }
      } catch (error: any) {
        logger.error(`Auto-outreach failed for case ${caseData.id}`, { error: error.message });
      }
    }

    return { processed: results.length, results };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private isWithinTCPAHours(): boolean {
    const hour = new Date().getHours();
    return hour >= TCPA_START_HOUR && hour < TCPA_END_HOUR;
  }

  private getNextTCPAWindow(): Date {
    const next = new Date();
    if (next.getHours() >= TCPA_END_HOUR) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(TCPA_START_HOUR, 0, 0, 0);
    return next;
  }

  private buildOutreachSMS(caseData: any, client: any): string {
    const name = client?.name || caseData.previousOwner || "Property Owner";
    const county = caseData.county || "your county";
    return `Hi ${name.split(" ")[0]}, this is MGR Capital. We've identified unclaimed funds from a property in ${county}, ${caseData.state} that may belong to you. Reply YES to learn more or call us. Msg & data rates may apply. Reply STOP to opt out.`;
  }

  private buildFollowUpSMS(caseData: any, attempt: number): string {
    const name = caseData.client?.name?.split(" ")[0] || "there";
    if (attempt === 1) {
      return `Hi ${name}, just following up on unclaimed funds from ${caseData.county}, ${caseData.state}. These funds have a deadline — don't miss out. Reply YES or call us.`;
    }
    return `${name} — final notice: unclaimed funds from ${caseData.county} are at risk of forfeiture. We can help at no upfront cost. Reply YES to claim what's yours.`;
  }

  private buildOutreachEmail(caseData: any, client: any): string {
    const name = client?.name || caseData.previousOwner || "Property Owner";
    return `
Dear ${name},

We are writing to inform you about unclaimed surplus funds that may belong to you from a property in ${caseData.county}, ${caseData.state}.

Our records indicate there are funds available for claim. We specialize in helping property owners recover these funds at no upfront cost.

To learn more or begin the recovery process, please reply to this email or call our office.

This is a time-sensitive matter — filing deadlines may apply.

Best regards,
MGR Capital Assistance
    `.trim();
  }

  private buildFollowUpEmail(caseData: any, attempt: number): string {
    const name = caseData.client?.name || "Property Owner";
    return `
Dear ${name},

This is a follow-up regarding unclaimed funds from ${caseData.county}, ${caseData.state}.

We previously reached out about surplus funds that may belong to you. These funds are subject to filing deadlines, and we want to ensure you don't miss the opportunity to claim them.

Our service is provided at no upfront cost — we only receive compensation if we successfully recover your funds.

Please reply to this email or call us to discuss your options.

Best regards,
MGR Capital Assistance
    `.trim();
  }
}

export const autoOutreachService = new AutoOutreachService();
export default autoOutreachService;
