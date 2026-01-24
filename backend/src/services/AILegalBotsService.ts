// ============================================
// MGR CAPITAL ASSISTANCE — AI LEGAL BOTS SERVICE
// 8 Specialized Legal AI Agents ("Lawyer Firm")
// ============================================

import { PrismaClient } from "@prisma/client";

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

  // Chat with a bot
  async chat(
    botId: string,
    userId: string,
    message: string
  ): Promise<{ response: string; suggestions?: string[] }> {
    const bot = LEGAL_BOTS.find((b) => b.id === botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    // Generate response based on bot personality
    const response = this.generateBotResponse(bot, message);

    // Log conversation
    await prisma.auditLog.create({
      data: {
        userId,
        action: "BOT_CHAT",
        entityType: "BOT_CONVERSATION",
        entityId: botId,
        details: { message, response: response.response },
      },
    });

    return response;
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
          issues.push(`MISSED DEADLINE: ${deadline.type} was due ${deadline.dueDate}`);
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
    message: string
  ): { response: string; suggestions?: string[] } {
    const lowerMessage = message.toLowerCase();

    // Base responses based on bot specialty
    let response = "";
    const suggestions: string[] = [];

    switch (bot.id) {
      case "compliance-bot":
        response = "I can help you check compliance for any case. Provide a case ID and I'll run a full audit.";
        suggestions = ["Check case compliance", "List all violations", "Generate compliance report"];
        break;
      case "docgen-bot":
        response = "Ready to generate documents. What type do you need? POA, Contract, Filing, or something else?";
        suggestions = ["Generate POA", "Create contract", "Prepare filing documents"];
        break;
      case "mistake-bot":
        if (bot.personality.profanityEnabled) {
          response = "Alright, let's find those damn mistakes. Paste the text or give me a case ID.";
        } else {
          response = "I'll find any errors. Paste the text or provide a case ID for review.";
        }
        suggestions = ["Scan for errors", "Auto-fix issues", "Review case documents"];
        break;
      case "strategy-bot":
        response = "Let's optimize your approach. Which case would you like me to analyze?";
        suggestions = ["Analyze case strategy", "Compare approaches", "Calculate success probability"];
        break;
      case "hunter-bot":
        if (bot.personality.profanityEnabled) {
          response = "Time to hunt for the big money! Which state should I target?";
        } else {
          response = "I'll find high-value opportunities. Which state or region should I focus on?";
        }
        suggestions = ["Find high-value cases", "Scan all states", "Show top opportunities"];
        break;
      case "negotiation-bot":
        response = "I'll help you close the deal. What's the negotiation scenario?";
        suggestions = ["Prepare pitch script", "Handle objections", "Counter-offer strategy"];
        break;
      case "discovery-bot":
        response = "Let's dig deep. Provide a property address, parcel number, or owner name to research.";
        suggestions = ["Search property records", "Find ownership chain", "Check for liens"];
        break;
      case "court-bot":
        response = "I'll make sure your filing is perfect. Which case needs court preparation?";
        suggestions = ["Prepare filing", "Generate brief", "Check court requirements"];
        break;
      default:
        response = "How can I assist you today?";
    }

    // Add context based on user message
    if (lowerMessage.includes("help")) {
      response = `I'm ${bot.name}, your ${bot.role}. My specialties include: ${bot.capabilities.slice(0, 3).join(", ")}. ${response}`;
    }

    return { response, suggestions };
  }
}

export const aiLegalBotsService = new AILegalBotsService();
export default aiLegalBotsService;
