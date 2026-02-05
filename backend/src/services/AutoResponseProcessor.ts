// ============================================
// AUTO RESPONSE PROCESSOR — MGR CAPITAL ASSISTANCE
// Detects, classifies, and auto-handles replies
// to outreach messages (email, SMS, call)
// ============================================

import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// ============================================
// TYPES & INTERFACES
// ============================================

type ContactMethod = "email" | "sms" | "call";

type ResponseCategory =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "WRONG_NUMBER"
  | "DO_NOT_CONTACT"
  | "QUESTION"
  | "CALLBACK_REQUEST"
  | "ALREADY_CLAIMED"
  | "LEGAL_THREAT";

interface ClassificationResult {
  category: ResponseCategory;
  confidence: number;
  matchedKeywords: string[];
  suggestedAction: string;
}

interface ProcessResult {
  caseId: string | null;
  classification: ClassificationResult;
  actionsPerformed: string[];
  communicationId?: string;
}

interface DNCEntry {
  phone?: string;
  email?: string;
  reason: string;
  addedAt: string;
  sourceCategory?: ResponseCategory;
}

interface ResponseAnalytics {
  totalResponses: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
  responseRate: number;
  avgResponseTimeHours: number;
  dateRange: { start: string; end: string };
}

// ============================================
// KEYWORD CLASSIFICATION ENGINE
// ============================================

const CLASSIFICATION_RULES: {
  category: ResponseCategory;
  keywords: string[];
  suggestedAction: string;
  priority: number;
}[] = [
  {
    category: "LEGAL_THREAT",
    keywords: [
      "attorney general",
      "lawsuit",
      "court",
      "sue you",
      "legal action",
      "report you",
      "complaint",
      "federal trade",
      "ftc",
    ],
    suggestedAction: "Escalate to founder immediately. Create CRITICAL WatchAlert.",
    priority: 100,
  },
  {
    category: "DO_NOT_CONTACT",
    keywords: [
      "lawyer",
      "attorney",
      "cease and desist",
      "harassment",
      "sue",
      "remove me",
      "do not contact",
      "stop contacting",
      "take me off",
      "unsubscribe",
      "block",
    ],
    suggestedAction: "Add to DNC list. Close all active outreach for this contact.",
    priority: 90,
  },
  {
    category: "ALREADY_CLAIMED",
    keywords: [
      "already filed",
      "already claimed",
      "working with someone",
      "already have an attorney",
      "already hired",
      "already being helped",
      "already submitted",
      "already recovering",
    ],
    suggestedAction: "Flag case for review. Create WatchAlert for competitor awareness.",
    priority: 80,
  },
  {
    category: "WRONG_NUMBER",
    keywords: [
      "wrong number",
      "don't know them",
      "never lived there",
      "not this person",
      "wrong person",
      "never owned",
      "no such person",
      "doesn't live here",
    ],
    suggestedAction: "Flag case for skip trace re-run with updated data.",
    priority: 70,
  },
  {
    category: "CALLBACK_REQUEST",
    keywords: [
      "call me",
      "call back",
      "reach me at",
      "give me a call",
      "call this number",
      "phone me",
      "ring me",
      "call tomorrow",
      "call after",
    ],
    suggestedAction: "Schedule callback. Notify assigned employee.",
    priority: 60,
  },
  {
    category: "INTERESTED",
    keywords: [
      "yes",
      "interested",
      "tell me more",
      "how does this work",
      "what do i need",
      "sign me up",
      "i want to",
      "i'd like to",
      "sounds good",
      "let's proceed",
      "let's do it",
      "count me in",
      "send me info",
      "more information",
    ],
    suggestedAction: "Advance case to CONTACTED. Notify assigned employee. Schedule follow-up.",
    priority: 50,
  },
  {
    category: "NOT_INTERESTED",
    keywords: [
      "no thanks",
      "not interested",
      "stop",
      "don't contact",
      "leave me alone",
      "no thank you",
      "pass",
      "decline",
      "not for me",
      "go away",
    ],
    suggestedAction: "Log as rejected outreach. Mark for 90-day re-contact review.",
    priority: 40,
  },
  {
    category: "QUESTION",
    keywords: [
      "how",
      "what",
      "when",
      "where",
      "why",
      "who",
      "can you explain",
      "is this legit",
      "is this real",
      "how much",
      "what's the catch",
    ],
    suggestedAction: "Forward to assigned employee. Create Communication record for follow-up.",
    priority: 30,
  },
];

// ============================================
// FEATURE TOGGLE KEYS (FounderConfig)
// ============================================

const TOGGLE_KEYS = {
  AUTO_RESPONSE_ENABLED: "auto_response_enabled",
  AUTO_ADVANCE_ON_INTEREST: "auto_advance_on_interest",
  AUTO_ESCALATE_THREATS: "auto_escalate_threats",
  AUTO_DNC_ENFORCEMENT: "auto_dnc_enforcement",
  RESPONSE_CHECK_INTERVAL: "response_check_interval_minutes",
} as const;

// ============================================
// AUTO RESPONSE PROCESSOR CLASS
// ============================================

class AutoResponseProcessor {
  // ============================================
  // RESPONSE DETECTION & PROCESSING
  // ============================================

  /**
   * Process an incoming message: classify it and execute auto-actions.
   * Matches the sender to an existing case via Communications table.
   */
  async processIncomingMessage(
    from: string,
    subject: string,
    body: string,
    method: ContactMethod
  ): Promise<ProcessResult> {
    // Check master toggle
    const enabled = await this.getToggle(TOGGLE_KEYS.AUTO_RESPONSE_ENABLED, true);
    if (!enabled) {
      logger.info("Auto-response processor is disabled. Skipping.", { from, method });
      return {
        caseId: null,
        classification: {
          category: "QUESTION",
          confidence: 0,
          matchedKeywords: [],
          suggestedAction: "Auto-response is disabled. Manual review required.",
        },
        actionsPerformed: ["skipped_disabled"],
      };
    }

    // Check DNC before processing
    const dncCheck = await this.isOnDNC(
      method === "sms" || method === "call" ? from : undefined,
      method === "email" ? from : undefined
    );
    if (dncCheck) {
      logger.warn("Incoming message from DNC-listed contact. Logging only.", { from, method });
      return {
        caseId: null,
        classification: {
          category: "DO_NOT_CONTACT",
          confidence: 1.0,
          matchedKeywords: ["dnc_list_match"],
          suggestedAction: "Contact is on DNC list. No action taken.",
        },
        actionsPerformed: ["dnc_blocked"],
      };
    }

    // Classify the message
    const fullText = `${subject || ""} ${body || ""}`.trim();
    const classification = this.classifyMessage(fullText);

    logger.info(`Message classified: ${classification.category} (confidence: ${classification.confidence})`, {
      from,
      method,
      matchedKeywords: classification.matchedKeywords,
    });

    // Match sender to a case
    const caseMatch = await this.matchSenderToCase(from, method);
    const caseId = caseMatch?.caseId || null;
    const userId = caseMatch?.userId || null;

    // Record the inbound communication
    let communicationId: string | undefined;
    if (caseId && userId) {
      try {
        const comm = await prisma.communication.create({
          data: {
            caseId,
            userId,
            type: method === "email" ? "EMAIL" : method === "sms" ? "TEXT" : "CALL",
            direction: "INBOUND",
            subject: subject || `Inbound ${method} response`,
            content: body || "(no body)",
            fromAddress: from,
            outcome: classification.category,
            metadata: {
              autoClassified: true,
              category: classification.category,
              confidence: classification.confidence,
              matchedKeywords: classification.matchedKeywords,
            },
          },
        });
        communicationId = comm.id;
      } catch (error: any) {
        logger.error("Failed to create Communication record", { error: error.message, from });
      }
    }

    // Execute auto-actions based on classification
    const actionsPerformed = await this.executeAutoActions(
      classification.category,
      caseId,
      userId,
      from,
      method,
      body
    );

    return {
      caseId,
      classification,
      actionsPerformed,
      communicationId,
    };
  }

  // ============================================
  // CLASSIFICATION ENGINE
  // ============================================

  /**
   * Classify a message body using keyword matching.
   * Returns the highest-priority matching category.
   */
  classifyMessage(text: string): ClassificationResult {
    const normalized = text.toLowerCase().trim();
    const allMatches: {
      category: ResponseCategory;
      keywords: string[];
      suggestedAction: string;
      priority: number;
      matchCount: number;
    }[] = [];

    for (const rule of CLASSIFICATION_RULES) {
      const matched = rule.keywords.filter((kw) => normalized.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        allMatches.push({
          ...rule,
          keywords: matched,
          matchCount: matched.length,
        });
      }
    }

    // Check for question mark (boost QUESTION category)
    const hasQuestionMark = normalized.includes("?");
    if (hasQuestionMark && !allMatches.some((m) => m.category === "QUESTION")) {
      allMatches.push({
        category: "QUESTION",
        keywords: ["?"],
        suggestedAction: "Forward to assigned employee. Create Communication record for follow-up.",
        priority: 30,
        matchCount: 1,
      });
    }

    if (allMatches.length === 0) {
      // No keyword matches - default to QUESTION for manual review
      return {
        category: "QUESTION",
        confidence: 0.2,
        matchedKeywords: [],
        suggestedAction: "No keywords matched. Forward to employee for manual review.",
      };
    }

    // Sort by priority (highest first), then by matchCount
    allMatches.sort((a, b) => b.priority - a.priority || b.matchCount - a.matchCount);

    const best = allMatches[0];

    // Calculate confidence based on keyword match density
    const maxPossibleKeywords = CLASSIFICATION_RULES.find(
      (r) => r.category === best.category
    )?.keywords.length || 1;
    const confidence = Math.min(0.95, 0.5 + (best.matchCount / maxPossibleKeywords) * 0.5);

    return {
      category: best.category,
      confidence: parseFloat(confidence.toFixed(2)),
      matchedKeywords: best.keywords,
      suggestedAction: best.suggestedAction,
    };
  }

  // ============================================
  // AUTO-ACTIONS
  // ============================================

  /**
   * Execute automated actions based on the classification category.
   */
  private async executeAutoActions(
    category: ResponseCategory,
    caseId: string | null,
    userId: string | null,
    from: string,
    method: ContactMethod,
    body: string
  ): Promise<string[]> {
    const actions: string[] = [];

    try {
      switch (category) {
        case "INTERESTED": {
          const autoAdvance = await this.getToggle(TOGGLE_KEYS.AUTO_ADVANCE_ON_INTEREST, true);
          if (autoAdvance && caseId) {
            // Advance case to CONTACTED if currently NEW
            const caseData = await prisma.case.findUnique({
              where: { id: caseId },
              select: { status: true, assignedEmployeeId: true },
            });
            if (caseData?.status === "NEW") {
              await prisma.case.update({
                where: { id: caseId },
                data: { status: "CONTACTED", contactedAt: new Date() },
              });
              actions.push("case_advanced_to_contacted");
            }
            // Schedule follow-up deadline
            const followUpDate = new Date();
            followUpDate.setDate(followUpDate.getDate() + 1);
            followUpDate.setHours(10, 0, 0, 0);
            await prisma.deadline.create({
              data: {
                caseId,
                title: "Follow-up on interested response",
                description: `Prospect responded positively via ${method}. Follow up promptly.`,
                dueDate: followUpDate,
              },
            });
            actions.push("follow_up_scheduled");
          }
          actions.push("logged_interest");
          break;
        }

        case "NOT_INTERESTED": {
          if (caseId) {
            // Mark for 90-day re-contact
            const recontactDate = new Date();
            recontactDate.setDate(recontactDate.getDate() + 90);
            await prisma.deadline.create({
              data: {
                caseId,
                title: "90-day re-contact review",
                description: "Prospect declined initial outreach. Revisit in 90 days.",
                dueDate: recontactDate,
              },
            });
            actions.push("90_day_recontact_scheduled");
          }
          actions.push("logged_rejection");
          break;
        }

        case "WRONG_NUMBER": {
          if (caseId) {
            // Flag for skip trace re-run
            await prisma.opsInsight.create({
              data: {
                type: "CASE_RECOMMENDATION",
                priority: "NORMAL",
                title: `Wrong number: re-run skip trace`,
                summary: `Response from ${from} indicates wrong number/person for case. Skip trace data may be outdated.`,
                details: { caseId, from, method, body: body.slice(0, 200) },
                plainEnglish: `The contact at ${from} says they are the wrong person. Run a new skip trace to find updated contact info.`,
                recommendations: [
                  "Re-run skip trace with updated parameters",
                  "Check for alternative contact methods",
                  "Verify property ownership records",
                ],
                relatedCaseIds: [caseId],
                relatedUserIds: userId ? [userId] : [],
                relatedAlertIds: [],
                sourceBot: "autoResponseProcessor",
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              },
            });
            actions.push("skip_trace_rerun_flagged");
          }
          break;
        }

        case "DO_NOT_CONTACT": {
          const dncEnforcement = await this.getToggle(TOGGLE_KEYS.AUTO_DNC_ENFORCEMENT, true);
          if (dncEnforcement) {
            // Add to DNC list
            const phone = method === "sms" || method === "call" ? from : undefined;
            const email = method === "email" ? from : undefined;
            await this.addToDNC(phone, email, `Auto-DNC from ${category} response`);
            actions.push("added_to_dnc");
          }
          // Log closure of outreach
          if (caseId) {
            await prisma.opsInsight.create({
              data: {
                type: "CASE_RECOMMENDATION",
                priority: "HIGH",
                title: `DNC request: close outreach`,
                summary: `Contact ${from} requested no further contact. All outreach for this case should be halted.`,
                details: { caseId, from, method },
                plainEnglish: `${from} asked not to be contacted. Stop all outreach on this case immediately.`,
                recommendations: ["Close all active outreach", "Do not schedule follow-ups"],
                relatedCaseIds: [caseId],
                relatedUserIds: userId ? [userId] : [],
                relatedAlertIds: [],
                sourceBot: "autoResponseProcessor",
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              },
            });
            actions.push("outreach_closed");
          }
          break;
        }

        case "QUESTION": {
          if (caseId) {
            // Create notification for assigned employee
            const caseData = await prisma.case.findUnique({
              where: { id: caseId },
              select: { assignedEmployeeId: true, internalCode: true },
            });
            if (caseData?.assignedEmployeeId) {
              await prisma.deadline.create({
                data: {
                  caseId,
                  title: `Respond to prospect question (${caseData.internalCode})`,
                  description: `Prospect asked a question via ${method}: "${body.slice(0, 200)}"`,
                  dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
                },
              });
              actions.push("employee_notified_question");
            }
          }
          actions.push("question_forwarded");
          break;
        }

        case "CALLBACK_REQUEST": {
          if (caseId) {
            const callbackDate = new Date();
            // Schedule callback for next business hour
            if (callbackDate.getHours() >= 17 || callbackDate.getHours() < 9) {
              callbackDate.setDate(callbackDate.getDate() + (callbackDate.getHours() >= 17 ? 1 : 0));
              callbackDate.setHours(10, 0, 0, 0);
            } else {
              callbackDate.setHours(callbackDate.getHours() + 1, 0, 0, 0);
            }

            await prisma.deadline.create({
              data: {
                caseId,
                title: "Callback requested by prospect",
                description: `${from} requested a callback via ${method}. Message: "${body.slice(0, 200)}"`,
                dueDate: callbackDate,
              },
            });
            actions.push("callback_scheduled");
          }
          actions.push("callback_logged");
          break;
        }

        case "ALREADY_CLAIMED": {
          if (caseId) {
            // Create WatchAlert for competitor awareness
            await prisma.watchAlert.create({
              data: {
                type: "EMPLOYEE_ANOMALY",
                severity: "MEDIUM",
                title: `Already claimed: competitor active`,
                message: `Contact ${from} says they already filed or are working with someone else on case ${caseId}. Possible competitor activity.`,
                details: {
                  caseId,
                  from,
                  method,
                  responseBody: body.slice(0, 500),
                  category: "ALREADY_CLAIMED",
                },
                relatedCaseId: caseId,
              },
            });
            actions.push("watch_alert_created");
            actions.push("case_flagged_for_review");
          }
          break;
        }

        case "LEGAL_THREAT": {
          const autoEscalate = await this.getToggle(TOGGLE_KEYS.AUTO_ESCALATE_THREATS, true);
          if (autoEscalate) {
            // Create CRITICAL WatchAlert
            await prisma.watchAlert.create({
              data: {
                type: "PAYOUT_ANOMALY",
                severity: "CRITICAL",
                title: `LEGAL THREAT: immediate review required`,
                message: `Contact ${from} sent a message containing legal threats via ${method}. Immediate founder review required. Message excerpt: "${body.slice(0, 300)}"`,
                details: {
                  caseId,
                  from,
                  method,
                  fullBody: body.slice(0, 1000),
                  category: "LEGAL_THREAT",
                  receivedAt: new Date().toISOString(),
                },
                relatedCaseId: caseId || undefined,
              },
            });
            actions.push("critical_alert_created");

            // Also create high-priority OpsInsight for founder dashboard
            await prisma.opsInsight.create({
              data: {
                type: "COMPLIANCE_CHECK",
                priority: "URGENT",
                title: `Legal threat from ${from}`,
                summary: `A legal threat was received via ${method}. Immediate review and possible legal counsel consultation required.`,
                details: {
                  caseId,
                  from,
                  method,
                  body: body.slice(0, 1000),
                },
                plainEnglish: `${from} sent a message containing legal threats. Review the message immediately and consult legal counsel if necessary.`,
                recommendations: [
                  "Review the full message immediately",
                  "Do NOT respond to the contact",
                  "Consult legal counsel",
                  "Add to DNC list if appropriate",
                  "Document all communications",
                ],
                relatedCaseIds: caseId ? [caseId] : [],
                relatedUserIds: userId ? [userId] : [],
                relatedAlertIds: [],
                sourceBot: "autoResponseProcessor",
                actionRequired: true,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
            actions.push("founder_escalated");
          }
          break;
        }
      }
    } catch (error: any) {
      logger.error(`Auto-action failed for category ${category}`, {
        error: error.message,
        caseId,
        from,
      });
      actions.push(`error: ${error.message}`);
    }

    return actions;
  }

  // ============================================
  // DNC (DO NOT CONTACT) LIST
  // ============================================

  /**
   * Add a phone or email to the DNC list.
   */
  async addToDNC(
    phone?: string,
    email?: string,
    reason: string = "Manual addition"
  ): Promise<void> {
    if (!phone && !email) {
      throw new Error("Must provide at least a phone or email for DNC entry.");
    }

    const dncList = await this.getDNCListRaw();

    // Check for duplicates
    const exists = dncList.some(
      (entry) =>
        (phone && entry.phone === phone) || (email && entry.email === email)
    );
    if (exists) {
      logger.info("Contact already on DNC list", { phone, email });
      return;
    }

    const newEntry: DNCEntry = {
      phone,
      email,
      reason,
      addedAt: new Date().toISOString(),
    };

    dncList.push(newEntry);

    await prisma.founderConfig.upsert({
      where: { key: "dnc_list" },
      create: {
        key: "dnc_list",
        value: dncList as any,
        description: "Do Not Contact list",
      },
      update: {
        value: dncList as any,
      },
    });

    logger.info("Added to DNC list", { phone, email, reason });
  }

  /**
   * Check if a phone or email is on the DNC list.
   */
  async isOnDNC(phone?: string, email?: string): Promise<boolean> {
    if (!phone && !email) return false;

    const dncList = await this.getDNCListRaw();

    return dncList.some(
      (entry) =>
        (phone && entry.phone === phone) ||
        (email && entry.email?.toLowerCase() === email?.toLowerCase())
    );
  }

  /**
   * Get the full DNC list.
   */
  async getDNCList(): Promise<DNCEntry[]> {
    return this.getDNCListRaw();
  }

  /**
   * Internal: read raw DNC list from FounderConfig.
   */
  private async getDNCListRaw(): Promise<DNCEntry[]> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key: "dnc_list" },
      });

      if (!config || !config.value) return [];

      const list = config.value as unknown;
      if (Array.isArray(list)) {
        return list as DNCEntry[];
      }

      return [];
    } catch (error: any) {
      logger.error("Failed to read DNC list", { error: error.message });
      return [];
    }
  }

  // ============================================
  // RESPONSE ANALYTICS
  // ============================================

  /**
   * Get response analytics over a date range.
   * Aggregates from Communication records marked as INBOUND.
   */
  async getResponseAnalytics(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<ResponseAnalytics> {
    const start = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dateRange?.end || new Date();

    // Get all inbound communications in range
    const inboundComms = await prisma.communication.findMany({
      where: {
        direction: "INBOUND",
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        type: true,
        outcome: true,
        createdAt: true,
        caseId: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get total outbound in same period for response rate
    const outboundCount = await prisma.communication.count({
      where: {
        direction: "OUTBOUND",
        createdAt: { gte: start, lte: end },
      },
    });

    // Category breakdown
    const byCategory: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    for (const comm of inboundComms) {
      const category = comm.outcome || "UNKNOWN";
      byCategory[category] = (byCategory[category] || 0) + 1;

      const methodKey = comm.type || "UNKNOWN";
      byMethod[methodKey] = (byMethod[methodKey] || 0) + 1;
    }

    // Average response time: time between last outbound and first inbound per case
    let totalResponseHours = 0;
    let responseTimeSamples = 0;

    const caseIds = Array.from(new Set(inboundComms.map((c) => c.caseId)));

    for (const caseId of caseIds.slice(0, 50)) {
      // Sample up to 50 cases
      const lastOutbound = await prisma.communication.findFirst({
        where: { caseId, direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const firstInbound = await prisma.communication.findFirst({
        where: { caseId, direction: "INBOUND", createdAt: { gte: start } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      if (lastOutbound && firstInbound && firstInbound.createdAt > lastOutbound.createdAt) {
        const diffMs = firstInbound.createdAt.getTime() - lastOutbound.createdAt.getTime();
        totalResponseHours += diffMs / (1000 * 60 * 60);
        responseTimeSamples++;
      }
    }

    const avgResponseTimeHours = responseTimeSamples > 0
      ? parseFloat((totalResponseHours / responseTimeSamples).toFixed(1))
      : 0;

    const responseRate = outboundCount > 0
      ? parseFloat(((inboundComms.length / outboundCount) * 100).toFixed(1))
      : 0;

    return {
      totalResponses: inboundComms.length,
      byCategory,
      byMethod,
      responseRate,
      avgResponseTimeHours,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  /**
   * Get response breakdown by state.
   * Shows which states respond most and least.
   */
  async getResponsesByState(): Promise<{
    states: { state: string; totalResponses: number; totalOutreach: number; responseRate: number }[];
    mostResponsive: string | null;
    leastResponsive: string | null;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get inbound comms grouped by case state
    const inboundComms = await prisma.communication.findMany({
      where: {
        direction: "INBOUND",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        caseId: true,
        case: { select: { state: true } },
      },
    });

    // Get outbound comms grouped by case state
    const outboundComms = await prisma.communication.findMany({
      where: {
        direction: "OUTBOUND",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        caseId: true,
        case: { select: { state: true } },
      },
    });

    // Aggregate by state
    const stateInbound: Record<string, number> = {};
    const stateOutbound: Record<string, number> = {};

    for (const comm of inboundComms) {
      const state = comm.case?.state || "UNKNOWN";
      stateInbound[state] = (stateInbound[state] || 0) + 1;
    }

    for (const comm of outboundComms) {
      const state = comm.case?.state || "UNKNOWN";
      stateOutbound[state] = (stateOutbound[state] || 0) + 1;
    }

    const allStates = new Set([...Object.keys(stateInbound), ...Object.keys(stateOutbound)]);

    const states = Array.from(allStates)
      .map((state) => {
        const totalResponses = stateInbound[state] || 0;
        const totalOutreach = stateOutbound[state] || 0;
        const responseRate = totalOutreach > 0
          ? parseFloat(((totalResponses / totalOutreach) * 100).toFixed(1))
          : 0;
        return { state, totalResponses, totalOutreach, responseRate };
      })
      .sort((a, b) => b.responseRate - a.responseRate);

    const statesWithData = states.filter((s) => s.totalOutreach >= 5);

    return {
      states,
      mostResponsive: statesWithData.length > 0 ? statesWithData[0].state : null,
      leastResponsive: statesWithData.length > 0 ? statesWithData[statesWithData.length - 1].state : null,
    };
  }

  // ============================================
  // FEATURE TOGGLES
  // ============================================

  /**
   * Get a feature toggle value from FounderConfig.
   * Returns the default if not set.
   */
  private async getToggle(key: string, defaultValue: boolean | number): Promise<any> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key },
      });

      if (!config || config.value === null || config.value === undefined) {
        return defaultValue;
      }

      // FounderConfig stores Json, so unwrap the value
      const val = config.value as any;
      if (typeof val === "object" && val !== null && "value" in val) {
        return val.value;
      }

      return val;
    } catch (error: any) {
      logger.error(`Failed to read toggle ${key}`, { error: error.message });
      return defaultValue;
    }
  }

  /**
   * Set a feature toggle value in FounderConfig.
   */
  async setToggle(key: string, value: boolean | number): Promise<void> {
    await prisma.founderConfig.upsert({
      where: { key },
      create: {
        key,
        value: { value } as any,
        description: `Auto-response toggle: ${key}`,
      },
      update: {
        value: { value } as any,
      },
    });

    logger.info(`Toggle updated: ${key} = ${value}`);
  }

  /**
   * Get all feature toggle values at once.
   */
  async getAllToggles(): Promise<Record<string, any>> {
    const toggles: Record<string, any> = {};

    for (const [name, key] of Object.entries(TOGGLE_KEYS)) {
      const defaultVal = key === TOGGLE_KEYS.RESPONSE_CHECK_INTERVAL ? 30 : true;
      toggles[name] = await this.getToggle(key, defaultVal);
    }

    return toggles;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Match a sender address/phone to an existing case
   * by looking up prior Communications records.
   */
  private async matchSenderToCase(
    from: string,
    method: ContactMethod
  ): Promise<{ caseId: string; userId: string } | null> {
    try {
      // Look for previous outbound communication to this address
      const searchField = method === "email" ? "toAddress" : "toAddress";
      const prevComm = await prisma.communication.findFirst({
        where: {
          direction: "OUTBOUND",
          OR: [
            { toAddress: from },
            { fromAddress: from },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { caseId: true, userId: true },
      });

      if (prevComm) {
        return { caseId: prevComm.caseId, userId: prevComm.userId };
      }

      // Fallback: try matching by client phone/email on User
      if (method === "email") {
        const user = await prisma.user.findFirst({
          where: { email: from, role: "CLIENT" },
          select: { id: true },
        });
        if (user) {
          const caseRecord = await prisma.case.findFirst({
            where: { clientId: user.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, assignedEmployeeId: true },
          });
          if (caseRecord) {
            return {
              caseId: caseRecord.id,
              userId: caseRecord.assignedEmployeeId || user.id,
            };
          }
        }
      } else {
        // Phone-based match
        const user = await prisma.user.findFirst({
          where: { phone: from, role: "CLIENT" },
          select: { id: true },
        });
        if (user) {
          const caseRecord = await prisma.case.findFirst({
            where: { clientId: user.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, assignedEmployeeId: true },
          });
          if (caseRecord) {
            return {
              caseId: caseRecord.id,
              userId: caseRecord.assignedEmployeeId || user.id,
            };
          }
        }
      }

      return null;
    } catch (error: any) {
      logger.error("Failed to match sender to case", { from, method, error: error.message });
      return null;
    }
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const autoResponseProcessor = new AutoResponseProcessor();
export default autoResponseProcessor;
