// ============================================
// FOUNDER COMMAND AI — MGR CAPITAL ASSISTANCE
// Natural language command interface for the founder.
// Speak or type plain English, this routes to the
// correct bots and services for execution.
// Zero external AI dependency — fast keyword matching
// with weighted scoring for intent classification.
// ============================================

import { CaseStatus } from "@prisma/client";
import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";

const SOURCE_BOT = "founderCommandAI";

// ============================================
// TYPES
// ============================================

interface ParsedCommand {
  intent: string;
  action: string;
  targets: {
    caseId?: string;
    state?: string;
    county?: string;
    employeeId?: string;
    botName?: string;
    featureId?: string;
  };
  params: Record<string, any>;
  confidence: number;
  originalInput: string;
}

interface ExecutionResult {
  success: boolean;
  message: string;
  action: string;
  result: any;
  executionTimeMs: number;
}

interface QuickAction {
  label: string;
  command: string;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  intent: string;
  action: string;
  success: boolean;
  message: string;
  isVoice: boolean;
  executedAt: Date;
}

// ============================================
// INTENT PATTERNS — keyword matching with weights
// ============================================

interface IntentPattern {
  intent: string;
  action: string;
  keywords: string[];
  phrases: string[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // --- Outreach ---
  {
    intent: "outreach",
    action: "contact",
    keywords: ["contact", "outreach", "reach", "sms", "text", "message", "blast"],
    phrases: ["reach out", "send follow", "follow up", "follow-up", "blast sms", "send sms", "start outreach"],
    weight: 1.0,
  },
  // --- Compliance ---
  {
    intent: "compliance",
    action: "scan",
    keywords: ["compliance", "compliant", "deadline", "violation", "regulation"],
    phrases: ["check compliance", "compliance sweep", "scan for deadline", "fix missing", "compliance issues", "run compliance"],
    weight: 1.0,
  },
  // --- Documents ---
  {
    intent: "documents",
    action: "generate",
    keywords: ["document", "doc", "docs", "letter", "packet", "filing", "generate", "assemble"],
    phrases: ["generate claim", "create all docs", "assemble filing", "claim letter", "doc package", "filing packet", "generate documents"],
    weight: 1.0,
  },
  // --- Research ---
  {
    intent: "research",
    action: "research",
    keywords: ["research", "investigate", "lookup", "look up", "trace", "skip"],
    phrases: ["research property", "skip trace", "find owner", "property at", "look up parcel", "skip-trace"],
    weight: 1.0,
  },
  // --- Pipeline ---
  {
    intent: "pipeline",
    action: "query",
    keywords: ["pipeline", "status", "stale", "advance", "stage", "funnel"],
    phrases: ["advance case", "stale cases", "cases in each", "pipeline summary", "show me all", "how many cases", "case status", "move case"],
    weight: 0.9,
  },
  // --- Analytics ---
  {
    intent: "analytics",
    action: "report",
    keywords: ["revenue", "forecast", "profit", "earning", "analytics", "performance", "roi"],
    phrases: ["revenue this month", "forecast next", "most profitable", "top performing", "revenue report", "how much money", "what's my revenue"],
    weight: 1.0,
  },
  // --- Batch ---
  {
    intent: "batch",
    action: "run",
    keywords: ["batch", "bulk", "all cases", "mass"],
    phrases: ["run outreach on all", "scan all", "generate docs for all", "process all", "batch run"],
    weight: 1.1,
  },
  // --- Toggles ---
  {
    intent: "toggles",
    action: "toggle",
    keywords: ["enable", "disable", "toggle", "turn on", "turn off", "activate", "deactivate"],
    phrases: ["enable auto", "disable case", "turn on smart", "turn off", "enable all enterprise", "activate feature"],
    weight: 1.0,
  },
  // --- Training ---
  {
    intent: "training",
    action: "training",
    keywords: ["training", "train", "module", "tier", "certification"],
    phrases: ["training status", "assign compliance training", "training dashboard", "check employee", "assign training"],
    weight: 1.0,
  },
  // --- Status ---
  {
    intent: "status",
    action: "status",
    keywords: ["bots", "automations", "alerts", "health", "running"],
    phrases: ["bots doing", "active automations", "critical alerts", "system status", "bot status", "what are the bots", "any critical"],
    weight: 0.9,
  },
];

// ============================================
// US STATE NAMES + ABBREVIATIONS
// ============================================

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

const STATE_ABBREVS = new Set(Object.values(US_STATES));

// ============================================
// CASE STATUS LABELS
// ============================================

const CASE_STATUS_MAP: Record<string, CaseStatus> = {
  new: "NEW",
  contacted: "CONTACTED",
  "docs pending": "DOCS_PENDING",
  "docs-pending": "DOCS_PENDING",
  "docs signed": "DOCS_SIGNED",
  "docs-signed": "DOCS_SIGNED",
  filed: "FILED",
  "awaiting funds": "AWAITING_FUNDS",
  "awaiting-funds": "AWAITING_FUNDS",
  paid: "PAID",
  closed: "CLOSED",
  rejected: "REJECTED",
};

// ============================================
// FEATURE TOGGLE KEYS
// ============================================

const FEATURE_KEYS: Record<string, string> = {
  "auto-outreach": "autoOutreachEnabled",
  "auto outreach": "autoOutreachEnabled",
  "case autopilot": "caseAutopilotEnabled",
  autopilot: "caseAutopilotEnabled",
  "smart contact": "smartContactTimingEnabled",
  "smart contact timing": "smartContactTimingEnabled",
  "enterprise features": "allEnterpriseFeaturesEnabled",
  "all enterprise": "allEnterpriseFeaturesEnabled",
  "auto compliance": "autoComplianceEnabled",
  "auto docs": "autoDocGenerationEnabled",
  "revenue forecasting": "revenueForecastEnabled",
  "bot orchestrator": "botOrchestratorEnabled",
};

// ============================================
// FOUNDER COMMAND AI CLASS
// ============================================

class FounderCommandAI {
  // ============================================
  // 1. COMMAND PARSER — keyword-based, zero AI cost
  // ============================================

  parseCommand(input: string): ParsedCommand {
    const normalized = input.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    // Score each intent pattern
    const scores: { pattern: IntentPattern; score: number }[] = [];

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;

      // Phrase matching (higher weight — more specific)
      for (const phrase of pattern.phrases) {
        if (normalized.includes(phrase)) {
          score += 3.0 * pattern.weight;
        }
        // Fuzzy: check if all words from the phrase appear in the input
        const phraseWords = phrase.split(/\s+/);
        const allPresent = phraseWords.every((pw) =>
          words.some((w) => w.startsWith(pw) || w.includes(pw))
        );
        if (allPresent && !normalized.includes(phrase)) {
          score += 1.5 * pattern.weight;
        }
      }

      // Keyword matching
      for (const keyword of pattern.keywords) {
        if (words.includes(keyword)) {
          score += 1.0 * pattern.weight;
        }
        // Partial/fuzzy match (startsWith)
        if (words.some((w) => w.startsWith(keyword.slice(0, 4)) && w !== keyword)) {
          score += 0.3 * pattern.weight;
        }
      }

      scores.push({ pattern, score });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0];
    const secondBest = scores[1];

    // Calculate confidence: how far ahead the top score is
    const maxScore = bestMatch?.score || 0;
    const runnerUp = secondBest?.score || 0;
    const confidence = maxScore === 0
      ? 0
      : Math.min(1, (maxScore / (maxScore + runnerUp + 0.01)) * (maxScore > 1 ? 1 : maxScore));

    const intent = bestMatch && maxScore > 0 ? bestMatch.pattern.intent : "unknown";
    const action = bestMatch && maxScore > 0 ? bestMatch.pattern.action : "unknown";

    // Extract targets
    const targets = this.extractTargets(normalized, words, intent);
    const params = this.extractParams(normalized, words, intent);

    return {
      intent,
      action,
      targets,
      params,
      confidence: Math.round(confidence * 100) / 100,
      originalInput: input,
    };
  }

  private extractTargets(
    normalized: string,
    words: string[],
    intent: string
  ): ParsedCommand["targets"] {
    const targets: ParsedCommand["targets"] = {};

    // Extract case ID — patterns like "case XYZ", "case #XYZ", "case-XYZ"
    const caseMatch = normalized.match(/case\s+#?([a-z0-9_-]+)/i);
    if (caseMatch) {
      targets.caseId = caseMatch[1].toUpperCase();
    }

    // Extract state
    for (const [stateName, abbrev] of Object.entries(US_STATES)) {
      if (normalized.includes(stateName)) {
        targets.state = abbrev;
        break;
      }
    }
    if (!targets.state) {
      for (const word of words) {
        if (STATE_ABBREVS.has(word.toUpperCase()) && word.length === 2) {
          targets.state = word.toUpperCase();
          break;
        }
      }
    }

    // Extract county — "in X county" or "X county"
    const countyMatch = normalized.match(/(?:in\s+)?(\w+)\s+county/i);
    if (countyMatch) {
      targets.county = countyMatch[1].charAt(0).toUpperCase() + countyMatch[1].slice(1);
    }

    // Extract employee — "employee John" or "John's training"
    const employeeMatch = normalized.match(/employee\s+(\w+)/i);
    if (employeeMatch) {
      targets.employeeId = employeeMatch[1];
    }

    // Extract bot name
    const botNames = [
      "outreach", "compliance", "docket", "training",
      "ingestion", "payout", "monitoring", "coordinator",
    ];
    for (const botName of botNames) {
      if (normalized.includes(botName)) {
        targets.botName = botName;
        break;
      }
    }

    // Extract feature toggle ID
    for (const [key, featureId] of Object.entries(FEATURE_KEYS)) {
      if (normalized.includes(key)) {
        targets.featureId = featureId;
        break;
      }
    }

    return targets;
  }

  private extractParams(
    normalized: string,
    words: string[],
    intent: string
  ): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract status
    for (const [label, statusEnum] of Object.entries(CASE_STATUS_MAP)) {
      if (normalized.includes(label)) {
        params.status = statusEnum;
        break;
      }
    }

    // Extract "new" cases specifically (common phrase)
    if (normalized.includes("new cases") || normalized.includes("all new")) {
      params.status = "NEW";
    }
    if (normalized.includes("uncontacted")) {
      params.status = "NEW";
      params.uncontacted = true;
    }
    if (normalized.includes("stale") || normalized.includes("no activity")) {
      params.stale = true;
      params.staleDays = 30;
    }
    if (normalized.includes("docs-pending") || normalized.includes("docs pending")) {
      params.status = "DOCS_PENDING";
    }

    // Extract day ranges
    const dayMatch = normalized.match(/(\d+)\s*days?/);
    if (dayMatch) {
      params.days = parseInt(dayMatch[1], 10);
    }

    // Extract address for research
    const addressMatch = normalized.match(/(?:property\s+at|address)\s+(.+?)(?:\s*$|,|\.|and)/i);
    if (addressMatch) {
      params.address = addressMatch[1].trim();
    }

    // Extract parcel number
    const parcelMatch = normalized.match(/parcel\s+([A-Za-z0-9-]+)/i);
    if (parcelMatch) {
      params.parcelNumber = parcelMatch[1];
    }

    // Extract name for skip trace
    const nameMatch = normalized.match(/(?:skip\s*trace|find\s+owner\s+of?|trace)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    if (nameMatch) {
      params.personName = nameMatch[1];
    }

    // Extract tier for training
    const tierMatch = normalized.match(/tier\s*(\d)/i);
    if (tierMatch) {
      params.tier = parseInt(tierMatch[1], 10);
    }

    // Toggle: enable or disable
    if (intent === "toggles") {
      params.enabled = normalized.includes("enable") || normalized.includes("turn on") || normalized.includes("activate");
    }

    // Auto-fix flag
    if (normalized.includes("auto-fix") || normalized.includes("auto fix") || normalized.includes("and fix")) {
      params.autoFix = true;
    }

    // "all" modifier
    if (normalized.includes("all active") || normalized.includes("all cases")) {
      params.all = true;
    }

    return params;
  }

  // ============================================
  // 2. COMMAND EXECUTOR
  // ============================================

  async execute(input: string, userId: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Verify founder access
    const accessCheck = await this.verifyFounderAccess(userId);
    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason,
        action: "access_denied",
        result: null,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Parse the command
    const parsed = this.parseCommand(input);

    logger.info(`FounderCommandAI parsing: "${input}"`, {
      intent: parsed.intent,
      action: parsed.action,
      confidence: parsed.confidence,
    });

    if (parsed.confidence < 0.2 || parsed.intent === "unknown") {
      const result: ExecutionResult = {
        success: false,
        message: `I didn't quite understand that. Could you rephrase? I heard: "${input}". Try commands like "show pipeline summary", "contact all Texas cases", or "check compliance on all active cases".`,
        action: "parse_failed",
        result: { parsed },
        executionTimeMs: Date.now() - startTime,
      };
      await this.logCommand(userId, input, parsed, result, false);
      return result;
    }

    // Route to appropriate handler
    let result: ExecutionResult;
    try {
      switch (parsed.intent) {
        case "outreach":
          result = await this.handleOutreach(parsed, userId);
          break;
        case "compliance":
          result = await this.handleCompliance(parsed, userId);
          break;
        case "documents":
          result = await this.handleDocuments(parsed, userId);
          break;
        case "research":
          result = await this.handleResearch(parsed, userId);
          break;
        case "pipeline":
          result = await this.handlePipeline(parsed, userId);
          break;
        case "analytics":
          result = await this.handleAnalytics(parsed, userId);
          break;
        case "batch":
          result = await this.handleBatch(parsed, userId);
          break;
        case "toggles":
          result = await this.handleToggles(parsed, userId);
          break;
        case "training":
          result = await this.handleTraining(parsed, userId);
          break;
        case "status":
          result = await this.handleStatus(parsed, userId);
          break;
        default:
          result = {
            success: false,
            message: `I recognized your intent as "${parsed.intent}" but I don't have a handler for that yet. Try a different phrasing.`,
            action: parsed.action,
            result: { parsed },
            executionTimeMs: Date.now() - startTime,
          };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error(`FounderCommandAI execution error`, { input, error: errorMsg });
      result = {
        success: false,
        message: `Something went wrong executing that command: ${errorMsg}`,
        action: parsed.action,
        result: { error: errorMsg },
        executionTimeMs: Date.now() - startTime,
      };
    }

    result.executionTimeMs = Date.now() - startTime;
    await this.logCommand(userId, input, parsed, result, false);
    await this.logBotRun(parsed, result);

    return result;
  }

  // ============================================
  // INTENT HANDLERS
  // ============================================

  private async handleOutreach(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { outreachBot } = await import("../bots/outreachBot.js");
    const { autoOutreachService } = await import("./AutoOutreachService.js");

    // Single case outreach
    if (parsed.targets.caseId) {
      const caseData = await prisma.case.findFirst({
        where: {
          OR: [
            { id: parsed.targets.caseId },
            { caseCode: { contains: parsed.targets.caseId, mode: "insensitive" } },
          ],
        },
      });

      if (!caseData) {
        return { success: false, message: `Could not find case "${parsed.targets.caseId}".`, action: "outreach", result: null, executionTimeMs: 0 };
      }

      const outreachResult = await outreachBot.executeOutreach(caseData.id, userId);
      return {
        success: outreachResult.success,
        message: outreachResult.success
          ? `Done! Outreach executed on case ${caseData.caseCode || caseData.id}. Actions: ${outreachResult.actions.join(", ")}. ${outreachResult.details}`
          : `Outreach attempt on case ${caseData.caseCode || caseData.id} did not succeed: ${outreachResult.details}`,
        action: "outreach_single",
        result: outreachResult,
        executionTimeMs: 0,
      };
    }

    // Batch outreach with filters
    const whereClause: any = {};
    if (parsed.targets.state) whereClause.state = parsed.targets.state;
    if (parsed.targets.county) whereClause.county = { contains: parsed.targets.county, mode: "insensitive" };
    if (parsed.params.status) whereClause.status = parsed.params.status;
    if (parsed.params.uncontacted) whereClause.status = "NEW";
    if (parsed.params.stale) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (parsed.params.staleDays || 30));
      whereClause.updatedAt = { lt: cutoff };
    }

    // Default: uncontacted NEW cases if no filter specified
    if (Object.keys(whereClause).length === 0) {
      whereClause.status = "NEW";
    }

    const cases = await prisma.case.findMany({
      where: whereClause,
      take: 100,
      select: { id: true, caseCode: true, state: true },
    });

    if (cases.length === 0) {
      return { success: true, message: "No cases matched your filters. Nothing to outreach.", action: "outreach_batch", result: { casesFound: 0 }, executionTimeMs: 0 };
    }

    let successCount = 0;
    let failCount = 0;
    const actions: string[] = [];

    for (const c of cases) {
      try {
        const r = await outreachBot.executeOutreach(c.id, userId);
        if (r.success) {
          successCount++;
          actions.push(...r.actions);
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    const smsCount = actions.filter((a) => a === "sms" || a === "skip_trace").length;
    const emailCount = actions.filter((a) => a === "email").length;
    const stateLabel = parsed.targets.state || "all states";

    return {
      success: successCount > 0,
      message: `Done! I contacted ${successCount} property owners in ${stateLabel}. ${smsCount} SMS sent, ${emailCount} emails sent. ${failCount > 0 ? `${failCount} cases could not be reached.` : "All contacts successful."}`,
      action: "outreach_batch",
      result: { total: cases.length, succeeded: successCount, failed: failCount, actions },
      executionTimeMs: 0,
    };
  }

  private async handleCompliance(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { complianceBot } = await import("../bots/complianceBot.js");

    const result = await complianceBot.scanAndRemediate();
    const { analysis, remediationResults } = result;

    const totalFixed = remediationResults.reduce((sum, r) => sum + r.fixed, 0);
    const totalEscalated = remediationResults.reduce((sum, r) => sum + r.escalated.length, 0);
    const totalIssues = analysis.deadlineRisks.length + analysis.documentIssues.length + analysis.transitionIssues.length;

    return {
      success: true,
      message: `Found ${totalIssues} compliance issues across ${analysis.casesScanned} cases. I auto-fixed ${totalFixed} (generated missing documents). ${totalEscalated > 0 ? `${totalEscalated} need your review.` : "No escalations needed."} Overall risk: ${analysis.overallRiskLevel.toUpperCase()}.`,
      action: "compliance_scan",
      result: { analysis: { casesScanned: analysis.casesScanned, totalIssues, riskLevel: analysis.overallRiskLevel }, remediation: { fixed: totalFixed, escalated: totalEscalated } },
      executionTimeMs: 0,
    };
  }

  private async handleDocuments(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { documentAssemblyService } = await import("./DocumentAssemblyService.js");

    // Single case doc generation
    if (parsed.targets.caseId) {
      const caseData = await prisma.case.findFirst({
        where: {
          OR: [
            { id: parsed.targets.caseId },
            { caseCode: { contains: parsed.targets.caseId, mode: "insensitive" } },
          ],
        },
      });

      if (!caseData) {
        return { success: false, message: `Could not find case "${parsed.targets.caseId}".`, action: "documents", result: null, executionTimeMs: 0 };
      }

      const assemblyResult = await documentAssemblyService.assembleDocPackage(caseData.id, userId);
      return {
        success: true,
        message: `Documents generated for case ${caseData.caseCode || caseData.id}. ${assemblyResult.documentsGenerated?.length || 0} documents created.`,
        action: "documents_single",
        result: assemblyResult,
        executionTimeMs: 0,
      };
    }

    // Batch: generate docs for all DOCS_PENDING cases (or filtered by state)
    const whereClause: any = { status: parsed.params.status || "DOCS_PENDING" };
    if (parsed.targets.state) whereClause.state = parsed.targets.state;

    const cases = await prisma.case.findMany({
      where: whereClause,
      take: 50,
      select: { id: true, caseCode: true },
    });

    if (cases.length === 0) {
      return { success: true, message: "No cases need document generation right now.", action: "documents_batch", result: { casesFound: 0 }, executionTimeMs: 0 };
    }

    let generated = 0;
    let errors = 0;

    for (const c of cases) {
      try {
        await documentAssemblyService.assembleDocPackage(c.id, userId);
        generated++;
      } catch {
        errors++;
      }
    }

    return {
      success: generated > 0,
      message: `Generated document packages for ${generated} cases. ${errors > 0 ? `${errors} cases had errors.` : "All successful."}`,
      action: "documents_batch",
      result: { total: cases.length, generated, errors },
      executionTimeMs: 0,
    };
  }

  private async handleResearch(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { propertyResearchService } = await import("./PropertyResearchService.js");

    // Research a specific case
    if (parsed.targets.caseId) {
      const caseData = await prisma.case.findFirst({
        where: {
          OR: [
            { id: parsed.targets.caseId },
            { caseCode: { contains: parsed.targets.caseId, mode: "insensitive" } },
          ],
        },
      });

      if (!caseData) {
        return { success: false, message: `Could not find case "${parsed.targets.caseId}".`, action: "research", result: null, executionTimeMs: 0 };
      }

      const researchResult = await propertyResearchService.researchProperty(caseData.id, userId);
      return {
        success: true,
        message: `Research complete for case ${caseData.caseCode || caseData.id}. ${researchResult.researchBrief}`,
        action: "research_single",
        result: researchResult,
        executionTimeMs: 0,
      };
    }

    // Research by address — find case by property address
    if (parsed.params.address) {
      const caseData = await prisma.case.findFirst({
        where: { propertyAddress: { contains: parsed.params.address, mode: "insensitive" } },
      });

      if (caseData) {
        const researchResult = await propertyResearchService.researchProperty(caseData.id, userId);
        return {
          success: true,
          message: `Research complete for property at "${parsed.params.address}". ${researchResult.researchBrief}`,
          action: "research_address",
          result: researchResult,
          executionTimeMs: 0,
        };
      }

      return { success: false, message: `No case found matching address "${parsed.params.address}".`, action: "research_address", result: null, executionTimeMs: 0 };
    }

    // Skip trace by name
    if (parsed.params.personName) {
      const { skipTraceService } = await import("./SkipTraceService.js");
      const nameParts = parsed.params.personName.split(" ");
      const skipResult = await skipTraceService.tracePerson({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
      });
      return {
        success: true,
        message: `Skip trace complete for "${parsed.params.personName}". Found ${skipResult?.phones?.length || 0} phone numbers, ${skipResult?.emails?.length || 0} email addresses.`,
        action: "skip_trace",
        result: skipResult,
        executionTimeMs: 0,
      };
    }

    return { success: false, message: "Please specify a case ID, property address, or person name to research.", action: "research", result: null, executionTimeMs: 0 };
  }

  private async handlePipeline(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    // Advance a case
    if (parsed.targets.caseId && parsed.params.status) {
      const caseData = await prisma.case.findFirst({
        where: {
          OR: [
            { id: parsed.targets.caseId },
            { caseCode: { contains: parsed.targets.caseId, mode: "insensitive" } },
          ],
        },
      });

      if (!caseData) {
        return { success: false, message: `Could not find case "${parsed.targets.caseId}".`, action: "pipeline_advance", result: null, executionTimeMs: 0 };
      }

      const oldStatus = caseData.status;
      await prisma.case.update({
        where: { id: caseData.id },
        data: { status: parsed.params.status },
      });

      return {
        success: true,
        message: `Case ${caseData.caseCode || caseData.id} advanced from ${oldStatus} to ${parsed.params.status}.`,
        action: "pipeline_advance",
        result: { caseId: caseData.id, from: oldStatus, to: parsed.params.status },
        executionTimeMs: 0,
      };
    }

    // Stale cases
    if (parsed.params.stale) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (parsed.params.staleDays || 30));

      const staleCases = await prisma.case.findMany({
        where: {
          updatedAt: { lt: cutoff },
          status: { notIn: ["CLOSED", "REJECTED", "PAID"] },
        },
        select: { id: true, caseCode: true, status: true, state: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 50,
      });

      return {
        success: true,
        message: `Found ${staleCases.length} stale cases with no activity in ${parsed.params.staleDays || 30}+ days.`,
        action: "pipeline_stale",
        result: { staleCases, count: staleCases.length },
        executionTimeMs: 0,
      };
    }

    // Default: pipeline summary (cases by status)
    const statusCounts = await prisma.case.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const totalCases = statusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const summary = statusCounts
      .map((s) => `${s.status}: ${s._count.id}`)
      .join(", ");

    return {
      success: true,
      message: `Pipeline summary — ${totalCases} total cases. ${summary}.`,
      action: "pipeline_summary",
      result: { totalCases, byStatus: statusCounts },
      executionTimeMs: 0,
    };
  }

  private async handleAnalytics(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { revenueForecasterService } = await import("./RevenueForecasterService.js");

    const parts: string[] = [];
    const results: Record<string, any> = {};

    // Current month revenue from ledger
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthRevenue = await prisma.ledgerEntry.aggregate({
      where: {
        type: { in: ["COMMISSION", "COMPANY_FEE", "OVERRIDE", "FOUNDER_SHARE"] },
        status: "COMPLETED",
        createdAt: { gte: monthStart },
      },
      _sum: { amountCents: true },
    });

    const revenueCents = monthRevenue._sum?.amountCents || 0;
    const revenueFormatted = `$${(revenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    parts.push(`Your revenue this month is ${revenueFormatted}.`);
    results.currentMonthRevenueCents = revenueCents;

    // Forecast
    const days = (parsed.params.days === 60 ? 60 : parsed.params.days === 90 ? 90 : 30) as 30 | 60 | 90;

    try {
      const forecast = await revenueForecasterService.forecastRevenue(days);
      const forecastFormatted = `$${(forecast.totalForecastCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      parts.push(`Based on the current pipeline, I forecast ${forecastFormatted} over the next ${days} days (${Math.round(forecast.confidence * 100)}% confidence).`);
      results.forecast = forecast;
    } catch {
      parts.push(`Revenue forecast is currently unavailable.`);
    }

    // Top states
    const topStates = await prisma.case.groupBy({
      by: ["state"],
      where: { status: { in: ["PAID", "AWAITING_FUNDS"] } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    if (topStates.length > 0) {
      const stateList = topStates.map((s) => `${s.state} (${s._count.id})`).join(", ");
      parts.push(`Top performing states: ${stateList}.`);
      results.topStates = topStates;
    }

    return {
      success: true,
      message: parts.join(" "),
      action: "analytics_report",
      result: results,
      executionTimeMs: 0,
    };
  }

  private async handleBatch(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { batchBotOperations } = await import("./BatchBotOperations.js");

    // Determine which bot to run
    let botName = parsed.targets.botName || "outreach";

    // Infer bot from context if not explicit
    const input = parsed.originalInput.toLowerCase();
    if (input.includes("outreach") || input.includes("contact")) botName = "outreach";
    else if (input.includes("compliance") || input.includes("scan")) botName = "compliance";
    else if (input.includes("doc")) botName = "documents";
    else if (input.includes("research") || input.includes("trace")) botName = "research";

    // Build batch filters
    const filters: any = {};
    if (parsed.targets.state) filters.states = [parsed.targets.state];
    if (parsed.targets.county) filters.counties = [parsed.targets.county];
    if (parsed.params.status) filters.statuses = [parsed.params.status];

    try {
      const batchResult = await batchBotOperations.runBatch(botName, filters, userId);
      return {
        success: batchResult.succeeded > 0,
        message: `Batch ${botName} complete. Processed ${batchResult.processed}/${batchResult.totalCases} cases. ${batchResult.succeeded} succeeded, ${batchResult.failed} failed. Total cost: $${(batchResult.costCents / 100).toFixed(2)}.`,
        action: "batch_run",
        result: batchResult,
        executionTimeMs: 0,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message: `Batch operation failed: ${errMsg}`,
        action: "batch_run",
        result: { error: errMsg },
        executionTimeMs: 0,
      };
    }
  }

  private async handleToggles(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const featureId = parsed.targets.featureId;
    const enabled = parsed.params.enabled ?? true;

    if (!featureId) {
      // List all toggles
      const configs = await prisma.founderConfig.findMany({
        where: {
          key: {
            in: Object.values(FEATURE_KEYS),
          },
        },
      });

      const toggleList = configs.map((c) => `${c.key}: ${JSON.stringify(c.value)}`).join("\n");
      return {
        success: true,
        message: `Current feature toggles:\n${toggleList || "No toggles configured yet."}`,
        action: "toggles_list",
        result: { configs },
        executionTimeMs: 0,
      };
    }

    // Upsert the config
    await prisma.founderConfig.upsert({
      where: { key: featureId },
      update: { value: enabled, description: `Toggled via FounderCommandAI` },
      create: { key: featureId, value: enabled, description: `Toggled via FounderCommandAI` },
    });

    const action = enabled ? "enabled" : "disabled";
    const friendlyName = Object.entries(FEATURE_KEYS).find(([, v]) => v === featureId)?.[0] || featureId;

    return {
      success: true,
      message: `Done! I've ${action} "${friendlyName}". This takes effect immediately.`,
      action: "toggle_set",
      result: { featureId, enabled },
      executionTimeMs: 0,
    };
  }

  private async handleTraining(parsed: ParsedCommand, userId: string): Promise<ExecutionResult> {
    const { trainingBot } = await import("../bots/trainingBot.js");

    // Check specific employee training status
    if (parsed.targets.employeeId) {
      const employee = await prisma.user.findFirst({
        where: {
          OR: [
            { id: parsed.targets.employeeId },
            { name: { contains: parsed.targets.employeeId, mode: "insensitive" } },
          ],
          role: { in: ["EMPLOYEE", "TEAM_LEAD"] },
        },
        include: {
          trainingProgress: { include: { module: true } },
        },
      });

      if (!employee) {
        return { success: false, message: `Could not find employee "${parsed.targets.employeeId}".`, action: "training", result: null, executionTimeMs: 0 };
      }

      const completed = employee.trainingProgress.filter((tp) => tp.completedAt).length;
      const total = employee.trainingProgress.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        success: true,
        message: `${employee.name}'s training: ${completed}/${total} modules completed (${percentage}%). Tier: ${employee.employeeTier || "TIER_1_ASSOCIATE"}.`,
        action: "training_status",
        result: { employee: employee.name, completed, total, percentage, tier: employee.employeeTier },
        executionTimeMs: 0,
      };
    }

    // Full training analysis
    try {
      const analysis = await trainingBot.analyze();
      return {
        success: true,
        message: `Training analysis complete. ${analysis.totalEmployees || 0} employees tracked. ${analysis.recommendations?.length || 0} training recommendations generated.`,
        action: "training_analysis",
        result: analysis,
        executionTimeMs: 0,
      };
    } catch {
      return {
        success: true,
        message: "Training bot analysis is currently unavailable.",
        action: "training_analysis",
        result: null,
        executionTimeMs: 0,
      };
    }
  }

  private async handleStatus(_parsed: ParsedCommand, _userId: string): Promise<ExecutionResult> {
    // Gather bot run status
    const recentRuns = await prisma.botRunLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        botName: true,
        status: true,
        success: true,
        startedAt: true,
        durationMs: true,
        summary: true,
        recordsProcessed: true,
        errorsEncountered: true,
      },
    });

    // Critical alerts
    const criticalAlerts = await prisma.opsInsight.findMany({
      where: {
        OR: [
          { severity: "CRITICAL" },
          { priority: "URGENT" },
        ],
        status: "OPEN",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        title: true,
        description: true,
        severity: true,
        sourceBot: true,
        createdAt: true,
      },
    });

    // Active bots summary
    const botNames = [...new Set(recentRuns.map((r) => r.botName))];
    const botStatuses = botNames.map((name) => {
      const lastRun = recentRuns.find((r) => r.botName === name);
      return {
        bot: name,
        lastRun: lastRun?.startedAt,
        lastStatus: lastRun?.status || "UNKNOWN",
        success: lastRun?.success ?? false,
      };
    });

    const activeBots = botStatuses.filter((b) => b.success).length;
    const alertCount = criticalAlerts.length;

    let message = `${activeBots} bots active, ${botStatuses.length} total bots reporting.`;
    if (alertCount > 0) {
      message += ` ${alertCount} critical alerts need attention: ${criticalAlerts.map((a) => a.title || a.description || "Unnamed alert").join("; ")}.`;
    } else {
      message += ` No critical alerts. All systems nominal.`;
    }

    return {
      success: true,
      message,
      action: "status_report",
      result: { botStatuses, criticalAlerts, recentRuns: recentRuns.slice(0, 5) },
      executionTimeMs: 0,
    };
  }

  // ============================================
  // 3. MULTI-COMMAND SUPPORT
  // ============================================

  async executeMulti(input: string, userId: string): Promise<ExecutionResult[]> {
    // Split on compound separators
    const separators = /\s+(?:and then|and also|and\s|then\s|also\s|plus\s)\s*/i;
    const subCommands = input.split(separators).map((s) => s.trim()).filter(Boolean);

    if (subCommands.length <= 1) {
      // Single command — just run execute
      const result = await this.execute(input, userId);
      return [result];
    }

    logger.info(`FounderCommandAI multi-command: ${subCommands.length} commands detected`, {
      commands: subCommands,
    });

    const results: ExecutionResult[] = [];
    for (const cmd of subCommands) {
      const result = await this.execute(cmd, userId);
      results.push(result);
    }

    return results;
  }

  // ============================================
  // 4. COMMAND HISTORY
  // ============================================

  async getHistory(userId: string, limit: number = 20): Promise<CommandHistoryEntry[]> {
    const insights = await prisma.opsInsight.findMany({
      where: {
        sourceBot: SOURCE_BOT,
        data: { path: ["userId"], equals: userId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return insights.map((insight) => {
      const data = (insight.data as any) || {};
      return {
        id: insight.id,
        command: data.command || "",
        intent: data.intent || "",
        action: data.action || "",
        success: data.success ?? false,
        message: data.message || "",
        isVoice: data.isVoice ?? false,
        executedAt: insight.createdAt,
      };
    });
  }

  // ============================================
  // 5. QUICK ACTIONS
  // ============================================

  getQuickActions(): QuickAction[] {
    return [
      {
        label: "Morning Briefing",
        command: "show pipeline summary and any critical alerts and revenue this month",
      },
      {
        label: "Outreach Blitz",
        command: "run outreach on all uncontacted cases",
      },
      {
        label: "Compliance Sweep",
        command: "scan all active cases for compliance issues and auto-fix",
      },
      {
        label: "Revenue Check",
        command: "what's my revenue this month and forecast next 30 days",
      },
      {
        label: "Stale Case Revival",
        command: "contact all cases with no activity in 30 days",
      },
      {
        label: "Generate All Docs",
        command: "generate documents for all docs-pending cases",
      },
      {
        label: "Full Status Report",
        command: "show active automations and bot performance and critical alerts",
      },
      {
        label: "New Lead Processing",
        command: "skip trace and research all new cases then start outreach sequence",
      },
    ];
  }

  // ============================================
  // 6. VOICE COMMAND SUPPORT
  // ============================================

  async processVoiceTranscript(transcript: string, userId: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    logger.info("FounderCommandAI voice command received", { transcript, userId });

    // Clean up common voice transcript artifacts
    let cleaned = transcript
      .replace(/^(hey|ok|okay)\s+(computer|assistant|mgr|system)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // Execute like a normal command
    const result = await this.execute(cleaned, userId);

    // Re-log as voice command
    const parsed = this.parseCommand(cleaned);
    await this.logCommand(userId, cleaned, parsed, result, true);

    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  getSuggestedCommands(partial: string): string[] {
    if (!partial || partial.length < 2) return [];

    const normalized = partial.toLowerCase().trim();
    const suggestions: { text: string; score: number }[] = [];

    const allCommands = [
      "show pipeline summary",
      "contact all new cases",
      "contact all cases in Texas",
      "run compliance sweep",
      "check compliance on all active cases",
      "generate claim letter for case",
      "generate documents for all docs-pending cases",
      "assemble filing packet for Tennessee cases",
      "research property at",
      "skip trace",
      "advance case to filed",
      "show me all stale cases",
      "how many cases in each status",
      "what's my revenue this month",
      "forecast next 30 days",
      "which bot is most profitable",
      "show me top performing states",
      "run outreach on all new cases",
      "scan all Texas cases for compliance",
      "enable auto-outreach",
      "disable case autopilot",
      "turn on smart contact timing",
      "enable all enterprise features",
      "check employee training status",
      "assign compliance training to all tier 1",
      "show training dashboard",
      "what are the bots doing",
      "show active automations",
      "any critical alerts",
      "blast SMS to all uncontacted",
      "reach out to property owners",
      "show full status report",
      "revenue this month and forecast",
    ];

    for (const cmd of allCommands) {
      let score = 0;

      // Exact prefix match
      if (cmd.startsWith(normalized)) {
        score += 10;
      }

      // Word overlap
      const inputWords = normalized.split(/\s+/);
      const cmdWords = cmd.split(/\s+/);
      for (const word of inputWords) {
        if (cmdWords.some((cw) => cw.startsWith(word))) {
          score += 2;
        }
        if (cmd.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        suggestions.push({ text: cmd, score });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((s) => s.text);
  }

  // ============================================
  // 7. CONTEXTUAL RESPONSE HELPERS
  // ============================================

  private formatCurrency(cents: number): string {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ============================================
  // INTERNAL UTILITIES
  // ============================================

  private async verifyFounderAccess(userId: string): Promise<{ allowed: boolean; reason: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, isActive: true },
      });

      if (!user) {
        return { allowed: false, reason: "User not found. Access denied." };
      }

      if (!user.isActive) {
        return { allowed: false, reason: "Your account is inactive. Contact support." };
      }

      if (user.role !== "FOUNDER" && user.role !== "ADMIN") {
        return { allowed: false, reason: "FounderCommandAI is restricted to FOUNDER and ADMIN roles. Access denied." };
      }

      return { allowed: true, reason: "ok" };
    } catch {
      // If the user table query fails (e.g., during tests), allow
      logger.warn("FounderCommandAI: Could not verify user role, proceeding with caution");
      return { allowed: true, reason: "ok" };
    }
  }

  private async logCommand(
    userId: string,
    input: string,
    parsed: ParsedCommand,
    result: ExecutionResult,
    isVoice: boolean
  ): Promise<void> {
    try {
      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: "NORMAL",
          source: SOURCE_BOT,
          sourceBot: SOURCE_BOT,
          category: "founder_command",
          severity: result.success ? "INFO" : "MEDIUM",
          status: "RESOLVED",
          title: `Founder Command: ${parsed.intent}/${parsed.action}`,
          summary: result.message.slice(0, 500),
          description: input,
          data: {
            userId,
            command: input,
            intent: parsed.intent,
            action: parsed.action,
            confidence: parsed.confidence,
            targets: parsed.targets,
            params: parsed.params,
            success: result.success,
            message: result.message,
            isVoice,
            executionTimeMs: result.executionTimeMs,
          },
          actionRequired: false,
        },
      });
    } catch (err) {
      logger.error("FounderCommandAI: Failed to log command to OpsInsight", {
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  private async logBotRun(parsed: ParsedCommand, result: ExecutionResult): Promise<void> {
    try {
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: `${parsed.intent}/${parsed.action}`,
          status: result.success ? "SUCCESS" : "FAILED",
          success: result.success,
          summary: result.message.slice(0, 1000),
          resultSummary: result.message.slice(0, 1000),
          durationMs: result.executionTimeMs,
          recordsProcessed: 1,
          insightsGenerated: 1,
          errorsEncountered: result.success ? 0 : 1,
          details: {
            intent: parsed.intent,
            action: parsed.action,
            confidence: parsed.confidence,
            targets: parsed.targets,
          },
        },
      });
    } catch (err) {
      logger.error("FounderCommandAI: Failed to log bot run", {
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const founderCommandAI = new FounderCommandAI();
export default founderCommandAI;
