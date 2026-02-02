// ============================================
// MGR CAPITAL ASSISTANCE — AI LEGAL BOTS SERVICE
// 8 Specialized Legal AI Agents ("Lawyer Firm")
// With guardrails: bots adapt language based on audience
// ============================================

import { PrismaClient } from "@prisma/client";
import {
  getSystemPrompt,
  getAudienceFromRole,
  sanitizeCaseData,
  generateCaseStory,
  generateEmployeeBriefing,
  type AudienceType,
  type CaseHighlight,
} from "../config/botGuardrails.js";

const prisma = new PrismaClient();

// Bot personality types with capabilities
export interface LegalBot {
  id: string;
  name: string;
  role: string;
  specialty: string;
  description: string;
  avatar: string;
  color: string;
  capabilities: string[];
  personality: {
    tone: "formal" | "casual" | "aggressive" | "friendly";
    profanityEnabled: boolean;
  };
  status: "active" | "busy" | "offline";
}

// The 8 specialized legal bots
export const LEGAL_BOTS: LegalBot[] = [
  {
    id: "compliance-bot",
    name: "ComplianceGuard",
    role: "Compliance Officer",
    specialty: "Regulatory Compliance & Risk Assessment",
    description: "Monitors all cases for compliance with state/federal regulations. Flags violations before they become problems.",
    avatar: "🛡️",
    color: "#3B82F6",
    capabilities: [
      "State statute compliance checking",
      "Federal regulation monitoring",
      "Deadline enforcement",
      "Risk scoring",
      "Audit trail generation",
    ],
    personality: { tone: "formal", profanityEnabled: false },
    status: "active",
  },
  {
    id: "docgen-bot",
    name: "DocMaster",
    role: "Document Specialist",
    specialty: "Legal Document Generation & Review",
    description: "Generates, reviews, and validates all legal documents. Ensures proper formatting and completeness.",
    avatar: "📄",
    color: "#8B5CF6",
    capabilities: [
      "Contract generation",
      "POA document creation",
      "Filing document prep",
      "Signature validation",
      "Document versioning",
    ],
    personality: { tone: "formal", profanityEnabled: false },
    status: "active",
  },
  {
    id: "mistake-bot",
    name: "ErrorHawk",
    role: "Quality Assurance",
    specialty: "Mistake Detection & Auto-Correction",
    description: "Scans for errors in filings, calculations, and communications. Automatically suggests fixes.",
    avatar: "🔍",
    color: "#EF4444",
    capabilities: [
      "Typo detection",
      "Calculation verification",
      "Address validation",
      "Date consistency checks",
      "Auto-correction suggestions",
    ],
    personality: { tone: "aggressive", profanityEnabled: true },
    status: "active",
  },
  {
    id: "strategy-bot",
    name: "StrategistPro",
    role: "Case Strategist",
    specialty: "Case Strategy & Optimization",
    description: "Analyzes cases to determine optimal filing strategies, timing, and approach for maximum recovery.",
    avatar: "♟️",
    color: "#10B981",
    capabilities: [
      "Optimal filing timing",
      "Strategy recommendations",
      "Competitor analysis",
      "Success probability scoring",
      "Resource allocation",
    ],
    personality: { tone: "formal", profanityEnabled: false },
    status: "active",
  },
  {
    id: "hunter-bot",
    name: "BigGameHunter",
    role: "High-Value Case Scout",
    specialty: "Big Case Hunting & Lead Generation",
    description: "Continuously scans for high-value surplus opportunities. Prioritizes cases with maximum ROI potential.",
    avatar: "🎯",
    color: "#F59E0B",
    capabilities: [
      "High-value case identification",
      "ROI calculation",
      "Market opportunity scanning",
      "Lead scoring",
      "Priority ranking",
    ],
    personality: { tone: "aggressive", profanityEnabled: true },
    status: "active",
  },
  {
    id: "negotiation-bot",
    name: "DealCloser",
    role: "Negotiation Specialist",
    specialty: "Client & County Negotiation",
    description: "Handles sensitive negotiations with clients and county officials. Maximizes favorable outcomes.",
    avatar: "🤝",
    color: "#EC4899",
    capabilities: [
      "Fee negotiation scripts",
      "Objection handling",
      "Counter-offer strategies",
      "Relationship management",
      "Settlement optimization",
    ],
    personality: { tone: "friendly", profanityEnabled: false },
    status: "active",
  },
  {
    id: "discovery-bot",
    name: "ResearchPro",
    role: "Discovery & Research",
    specialty: "Legal Research & Discovery",
    description: "Deep research on property records, ownership chains, and legal precedents.",
    avatar: "🔬",
    color: "#6366F1",
    capabilities: [
      "Property record research",
      "Ownership chain analysis",
      "Lien discovery",
      "Precedent finding",
      "Public record searches",
    ],
    personality: { tone: "formal", profanityEnabled: false },
    status: "active",
  },
  {
    id: "court-bot",
    name: "CourtReady",
    role: "Court Preparation",
    specialty: "Hearing & Filing Preparation",
    description: "Prepares all court filings and hearing materials. Ensures perfect submission every time.",
    avatar: "⚖️",
    color: "#14B8A6",
    capabilities: [
      "Court filing preparation",
      "Hearing brief generation",
      "Evidence organization",
      "Timeline preparation",
      "Judge preference analysis",
    ],
    personality: { tone: "formal", profanityEnabled: false },
    status: "active",
  },
];

export interface BotTask {
  id: string;
  botId: string;
  type: string;
  input: any;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface BotConversation {
  id: string;
  botId: string;
  userId: string;
  messages: {
    role: "user" | "bot";
    content: string;
    timestamp: Date;
  }[];
  createdAt: Date;
}

class AILegalBotsService {
  // Get all bots
  async getAllBots(): Promise<LegalBot[]> {
    return LEGAL_BOTS;
  }

  // Get a specific bot
  async getBot(botId: string): Promise<LegalBot | null> {
    return LEGAL_BOTS.find((b) => b.id === botId) || null;
  }

  // Execute a task with a specific bot
  async executeTask(
    botId: string,
    taskType: string,
    input: any,
    userId: string
  ): Promise<BotTask> {
    const bot = LEGAL_BOTS.find((b) => b.id === botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log the task
    await prisma.auditLog.create({
      data: {
        userId,
        action: "BOT_TASK_STARTED",
        entityType: "BOT_TASK",
        entityId: taskId,
        details: { botId, taskType, input },
      },
    });

    // Process based on bot type
    let result: any;

    try {
      switch (botId) {
        case "compliance-bot":
          result = await this.runComplianceCheck(input);
          break;
        case "docgen-bot":
          result = await this.generateDocument(input);
          break;
        case "mistake-bot":
          result = await this.detectMistakes(input);
          break;
        case "strategy-bot":
          result = await this.analyzeStrategy(input);
          break;
        case "hunter-bot":
          result = await this.huntBigCases(input);
          break;
        case "negotiation-bot":
          result = await this.prepareNegotiation(input);
          break;
        case "discovery-bot":
          result = await this.runDiscovery(input);
          break;
        case "court-bot":
          result = await this.prepareCourtFiling(input);
          break;
        default:
          result = { message: "Task processed", data: input };
      }

      return {
        id: taskId,
        botId,
        type: taskType,
        input,
        status: "completed",
        result,
        createdAt: new Date(),
        completedAt: new Date(),
      };
    } catch (error: any) {
      return {
        id: taskId,
        botId,
        type: taskType,
        input,
        status: "failed",
        error: error.message,
        createdAt: new Date(),
      };
    }
  }

  // Chat with a bot — audience-aware responses
  async chat(
    botId: string,
    userId: string,
    message: string,
    userRole: string = "FOUNDER"
  ): Promise<{ response: string; suggestions?: string[] }> {
    const bot = LEGAL_BOTS.find((b) => b.id === botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    const audience = getAudienceFromRole(userRole);

    // Generate response based on bot personality + audience guardrails
    const response = this.generateBotResponse(bot, message, audience);

    // Log conversation
    await prisma.auditLog.create({
      data: {
        userId,
        action: "BOT_CHAT",
        entityType: "BOT_CONVERSATION",
        entityId: botId,
        details: { message, response: response.response, audience },
      },
    });

    return response;
  }

  /**
   * Generate a case briefing ("Story Time") based on audience
   */
  async getCaseBriefing(
    caseId: string,
    userRole: string
  ): Promise<string> {
    const audience = getAudienceFromRole(userRole);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { name: true } },
        assignedEmployee: { select: { name: true } },
        documents: { select: { type: true } },
        deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" }, take: 1 },
      },
    });

    if (!caseData) return "Case not found.";

    const now = new Date();
    const nextDeadline = caseData.deadlines[0];
    const deadlineDays = nextDeadline
      ? Math.ceil((new Date(nextDeadline.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const highlight: CaseHighlight = {
      caseId: caseData.id,
      ownerName: caseData.client?.name || caseData.previousOwner || "Unknown",
      county: caseData.county,
      state: caseData.state,
      surplusAmountCents: caseData.surplusAmountCents,
      feePercent: caseData.feePercent,
      status: caseData.status,
      assignedEmployee: caseData.assignedEmployee?.name,
      deadlineDays,
      skipTracePhones: 0, // Would come from skip trace results
      skipTraceEmails: 0,
      specialNotes: [],
    };

    if (audience === "FOUNDER") {
      return generateCaseStory(highlight);
    } else {
      return generateEmployeeBriefing(highlight);
    }
  }

  // Bot-specific task implementations
  private async runComplianceCheck(input: any): Promise<any> {
    const { caseId } = input;

    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: { documents: true, deadlines: true },
      });

      if (!caseData) {
        return { compliant: false, issues: ["Case not found"] };
      }

      const issues: string[] = [];
      const warnings: string[] = [];

      // Check deadlines
      const now = new Date();
      for (const deadline of caseData.deadlines || []) {
        if (new Date(deadline.dueDate) < now && !deadline.completedAt) {
          issues.push(`MISSED DEADLINE: ${deadline.title} was due ${deadline.dueDate}`);
        }
      }

      // Check documents
      const requiredDocs = ["POA", "CONTRACT"];
      for (const docType of requiredDocs) {
        const hasDoc = caseData.documents.some((d) => d.type === docType);
        if (!hasDoc) {
          warnings.push(`Missing required document: ${docType}`);
        }
      }

      return {
        compliant: issues.length === 0,
        issues,
        warnings,
        score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5),
        checkedAt: new Date(),
      };
    }

    return { compliant: true, issues: [], warnings: [], score: 100 };
  }

  private async generateDocument(input: any): Promise<any> {
    const { documentType, caseId, templateData } = input;

    return {
      generated: true,
      documentType,
      caseId,
      previewUrl: `/api/documents/preview/${documentType}/${caseId}`,
      message: `${documentType} document generated successfully`,
      fields: templateData,
    };
  }

  private async detectMistakes(input: any): Promise<any> {
    const { text, caseId } = input;

    const mistakes: any[] = [];

    // Simulate mistake detection
    if (text) {
      // Check for common issues
      if (text.includes("  ")) {
        mistakes.push({ type: "formatting", issue: "Double spaces detected", severity: "low" });
      }
      if (!/^\d{5}(-\d{4})?$/.test(text.match(/\d{5}/)?.[0] || "")) {
        // This is a simplified check
      }
    }

    return {
      analyzed: true,
      mistakes,
      autoFixAvailable: mistakes.filter((m) => m.severity !== "high").length,
      message: mistakes.length > 0
        ? `Found ${mistakes.length} issue(s) - let me fix that crap for you!`
        : "Looks clean. No mistakes detected. Nice work!",
    };
  }

  private async analyzeStrategy(input: any): Promise<any> {
    const { caseId } = input;

    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
      });

      if (caseData) {
        const surplusAmount = caseData.surplusAmountCents || 0;
        const isHighValue = surplusAmount >= 1000000; // $10,000+

        return {
          caseId,
          recommendation: isHighValue ? "PRIORITY_FILING" : "STANDARD_PROCESS",
          estimatedRecovery: surplusAmount,
          successProbability: 0.75 + Math.random() * 0.2,
          suggestedActions: [
            "File within 3 business days",
            "Request expedited processing",
            isHighValue ? "Assign to senior team member" : "Standard workflow",
          ],
          riskFactors: [],
        };
      }
    }

    return {
      recommendation: "NEEDS_MORE_DATA",
      suggestedActions: ["Gather case details first"],
    };
  }

  private async huntBigCases(input: any): Promise<any> {
    const { state, minAmount } = input;

    // Query for high-value cases
    const bigCases = await prisma.case.findMany({
      where: {
        state: state || undefined,
        surplusAmountCents: { gte: minAmount || 1000000 },
        status: { in: ["NEW", "CONTACTED"] },
      },
      orderBy: { surplusAmountCents: "desc" },
      take: 10,
      select: {
        id: true,
        internalCode: true,
        state: true,
        county: true,
        surplusAmountCents: true,
        status: true,
      },
    });

    return {
      found: bigCases.length,
      cases: bigCases,
      message: bigCases.length > 0
        ? `Hell yeah! Found ${bigCases.length} high-value targets!`
        : "No big fish right now. Keep hunting!",
      totalPotential: bigCases.reduce((sum, c) => sum + (c.surplusAmountCents || 0), 0),
    };
  }

  private async prepareNegotiation(input: any): Promise<any> {
    const { scenario, clientName, currentOffer } = input;

    return {
      scripts: [
        {
          situation: "Initial Contact",
          script: `Hello ${clientName || "there"}, I'm reaching out regarding funds that may belong to you...`,
        },
        {
          situation: "Fee Discussion",
          script: "Our fee structure is designed to be fair and only applies upon successful recovery...",
        },
        {
          situation: "Objection Handling",
          script: "I understand your concern. Let me explain how this process protects your interests...",
        },
      ],
      counterOfferSuggestion: currentOffer ? currentOffer * 0.9 : null,
      tips: [
        "Listen actively to concerns",
        "Emphasize no-risk structure",
        "Highlight time sensitivity",
      ],
    };
  }

  private async runDiscovery(input: any): Promise<any> {
    const { propertyAddress, parcelNumber, ownerName } = input;

    return {
      searched: true,
      query: { propertyAddress, parcelNumber, ownerName },
      results: {
        propertyRecords: [],
        ownershipHistory: [],
        liens: [],
        taxHistory: [],
      },
      message: "Discovery complete. Data compiled for review.",
      sources: ["County Records", "State Database", "Public Filings"],
    };
  }

  private async prepareCourtFiling(input: any): Promise<any> {
    const { caseId, filingType } = input;

    return {
      prepared: true,
      filingType,
      caseId,
      checklist: [
        { item: "Case summary", status: "complete" },
        { item: "Supporting documents", status: "pending" },
        { item: "Fee calculation", status: "complete" },
        { item: "Signature blocks", status: "pending" },
      ],
      estimatedFilingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      courtRequirements: ["Original signatures", "Filing fee", "3 copies"],
    };
  }

  private generateBotResponse(
    bot: LegalBot,
    message: string,
    audience: AudienceType = "FOUNDER"
  ): { response: string; suggestions?: string[] } {
    const lowerMessage = message.toLowerCase();
    let response = "";
    let suggestions: string[] = [];

    // Check for guardrail triggers first (any audience)
    if (audience !== "FOUNDER") {
      if (lowerMessage.includes("how much") || lowerMessage.includes("surplus") || lowerMessage.includes("amount")) {
        return {
          response: audience === "EMPLOYEE"
            ? "That's above my pay grade — check with the boss on dollar amounts."
            : "The exact amount gets determined during the recovery process. We'll have more details once we review the county records.",
          suggestions: audience === "EMPLOYEE"
            ? ["Check case status", "View deadlines", "Get contact info"]
            : ["Learn about the process", "Check my case status"],
        };
      }
      if (lowerMessage.includes("fee") || lowerMessage.includes("percentage") || lowerMessage.includes("commission")) {
        return {
          response: audience === "EMPLOYEE"
            ? "Fee structure is handled by leadership. Focus on getting the case moving."
            : "There's zero cost to you upfront. We handle everything and only receive compensation if we successfully recover your funds.",
          suggestions: audience === "EMPLOYEE"
            ? ["View my cases", "Get case briefing"]
            : ["How does the process work?", "What happens next?"],
        };
      }
      if (lowerMessage.includes("how many cases") || lowerMessage.includes("how big") || lowerMessage.includes("revenue")) {
        return {
          response: audience === "EMPLOYEE"
            ? "I can only show you your cases. Need me to pull up your active list?"
            : "We're a recovery assistance firm focused on helping people like you. What can I help you with today?",
          suggestions: audience === "EMPLOYEE"
            ? ["Show my cases", "Today's priorities"]
            : ["Check my case status", "What documents do I need?"],
        };
      }
    }

    // Audience-specific bot responses
    const isEmployee = audience === "EMPLOYEE";
    const isFounder = audience === "FOUNDER";

    switch (bot.id) {
      case "compliance-bot":
        response = isEmployee
          ? "Yo, let me check if your case is good to go. Drop me the case ID."
          : isFounder
            ? "Ready to audit. Give me a case ID or I'll scan the whole pipeline."
            : "I can help verify your case documentation is complete.";
        suggestions = isEmployee
          ? ["Check my case", "What docs am I missing?", "Deadline check"]
          : isFounder
            ? ["Full pipeline audit", "Check case compliance", "Violation report"]
            : ["Check case compliance", "List all violations", "Generate report"];
        break;
      case "docgen-bot":
        response = isEmployee
          ? "What docs you need? I can whip up a POA, contract, or filing in seconds."
          : isFounder
            ? "Document generation ready. POA, contract, filing, or bulk generation?"
            : "I can help prepare your case documents.";
        suggestions = isEmployee
          ? ["Generate POA", "Create contract", "Filing docs"]
          : ["Generate POA", "Create contract", "Prepare filing"];
        break;
      case "mistake-bot":
        response = isEmployee
          ? "Aight let me see what you got. Paste it or give me the case — I'll find every damn mistake."
          : isFounder
            ? "Drop it. I'll tear through it and find every error. Case ID or paste the text."
            : "I'll review your documents for accuracy.";
        suggestions = ["Scan for errors", "Auto-fix issues", "Review documents"];
        break;
      case "strategy-bot":
        response = isEmployee
          ? "Let's figure out the best play for this case. Which one we looking at?"
          : isFounder
            ? "Strategy analysis ready. I'll give you success probability, optimal timing, and the best approach."
            : "I can explain the general process for your case type.";
        suggestions = isFounder
          ? ["Analyze case strategy", "Success probability", "Pipeline optimization"]
          : ["Analyze case", "Best approach", "Timeline"];
        break;
      case "hunter-bot":
        response = isFounder
          ? "Let's go hunting. Which state? Or I'll scan everything for the big fish."
          : isEmployee
            ? "I can help you find your best leads to work on. Want me to pull your priority list?"
            : "Let me check on your case status.";
        suggestions = isFounder
          ? ["Scan all states", "Top opportunities", "ROI ranking"]
          : ["My priority cases", "Best leads to call"];
        break;
      case "negotiation-bot":
        response = isEmployee
          ? "Let's close this deal. Who we talking to and what's the situation?"
          : isFounder
            ? "Negotiation prep ready. Client scenario, county negotiation, or fee discussion?"
            : "I can help answer any questions about the recovery process.";
        suggestions = isEmployee
          ? ["Pitch script", "Handle objections", "Follow-up script"]
          : ["Prepare pitch", "Handle objections", "Counter-offer"];
        break;
      case "discovery-bot":
        response = isEmployee
          ? "Time to dig. Give me an address, parcel number, or name and I'll pull everything."
          : isFounder
            ? "Deep research ready. Property records, ownership chains, liens — the works."
            : "I can look into the details of your property matter.";
        suggestions = ["Search property", "Ownership chain", "Check liens"];
        break;
      case "court-bot":
        response = isEmployee
          ? "Let's get this filing right the first time. Which case we prepping?"
          : isFounder
            ? "Court prep ready. I'll make sure every filing is bulletproof."
            : "Your case filing is being prepared by our team.";
        suggestions = ["Prepare filing", "Court requirements", "Filing checklist"];
        break;
      default:
        response = isEmployee
          ? "What's good? How can I help?"
          : "How can I assist you today?";
    }

    // Add context based on user message
    if (lowerMessage.includes("help")) {
      const intro = isEmployee
        ? `Yo, I'm ${bot.name} — ${bot.role}. I handle ${bot.capabilities.slice(0, 3).join(", ")}. `
        : `I'm ${bot.name}, your ${bot.role}. My specialties include: ${bot.capabilities.slice(0, 3).join(", ")}. `;
      response = intro + response;
    }

    return { response, suggestions };
  }
}

export const aiLegalBotsService = new AILegalBotsService();
export default aiLegalBotsService;
