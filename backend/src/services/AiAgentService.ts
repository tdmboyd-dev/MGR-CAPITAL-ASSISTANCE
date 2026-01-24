/**
 * AiAgentService.ts — MGR CAPITAL ASSISTANCE
 * AI Agents for automated tasks using Ollama multi-turn conversations
 *
 * Phase 15: Advanced AI Agents
 *
 * Agents:
 * - Outreach Agent: Generate personalized client emails
 * - Compliance Agent: Check document compliance
 * - Research Agent: Research case-related information
 * - Summary Agent: Summarize case activity
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export type AgentTask =
  | "outreach"
  | "compliance"
  | "research"
  | "summary"
  | "follow_up"
  | "document_review";

export interface AgentContext {
  caseId?: string;
  clientId?: string;
  documentId?: string;
  employeeId?: string;
  customData?: Record<string, any>;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentResult {
  success: boolean;
  task: AgentTask;
  output: string;
  structuredData?: Record<string, any>;
  conversationHistory: AgentMessage[];
  tokensUsed?: number;
  processingTimeMs: number;
}

export interface OutreachEmailResult {
  subject: string;
  body: string;
  tone: string;
  callToAction: string;
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  issues: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface DocumentReviewResult {
  summary: string;
  keyPoints: string[];
  missingInfo: string[];
  recommendations: string[];
}

// =============================================================================
// OLLAMA CLIENT
// =============================================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
}

async function ollamaChat(messages: OllamaMessage[]): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.4,
          top_p: 0.9,
          num_predict: 1000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
  } catch (error) {
    logger.error("Ollama chat error", { error });
    throw error;
  }
}

// =============================================================================
// AGENT PROMPTS
// =============================================================================

const SYSTEM_PROMPTS: Record<AgentTask, string> = {
  outreach: `You are a professional client outreach specialist for MGR Capital Assistance, a tax surplus recovery company.
Your job is to generate personalized, professional emails to clients about their cases.

Guidelines:
- Be warm but professional
- Clearly explain the purpose of the communication
- Include specific case details when provided
- Always include a clear call to action
- Keep emails concise (under 300 words)
- Never make promises about amounts or timelines

Output format:
SUBJECT: [email subject]
BODY: [email body]
TONE: [professional/friendly/urgent]
CTA: [call to action]`,

  compliance: `You are a compliance expert for MGR Capital Assistance, a tax surplus recovery company.
Your job is to review case documents and information for regulatory compliance.

Check for:
- Required documents present (Client Service Agreement, POA, ID verification)
- Proper signatures and dates
- State-specific requirements
- Deadline adherence
- Data accuracy

Output format:
COMPLIANT: [YES/NO]
ISSUES: [list issues, one per line]
RECOMMENDATIONS: [list recommendations, one per line]
RISK_LEVEL: [LOW/MEDIUM/HIGH]`,

  research: `You are a research specialist for MGR Capital Assistance, a tax surplus recovery company.
Your job is to analyze case information and provide actionable insights.

Focus on:
- Property and ownership history
- Tax sale details
- Jurisdiction-specific rules
- Similar case outcomes
- Potential challenges

Provide clear, actionable research summaries.`,

  summary: `You are a case analyst for MGR Capital Assistance, a tax surplus recovery company.
Your job is to summarize case activity and status clearly.

Include:
- Current status and next steps
- Recent activity highlights
- Key dates and deadlines
- Outstanding items
- Recommendations

Keep summaries concise and actionable.`,

  follow_up: `You are a follow-up coordinator for MGR Capital Assistance, a tax surplus recovery company.
Your job is to generate appropriate follow-up communications based on case status.

Consider:
- Time since last contact
- Outstanding client actions needed
- Approaching deadlines
- Case complexity

Generate professional, timely follow-up messages.`,

  document_review: `You are a document review specialist for MGR Capital Assistance, a tax surplus recovery company.
Your job is to analyze documents and extract key information.

Focus on:
- Document completeness
- Key information extraction
- Accuracy verification
- Missing or unclear information
- Recommendations for next steps

Output format:
SUMMARY: [brief summary]
KEY_POINTS: [list key points, one per line]
MISSING_INFO: [list missing items, one per line]
RECOMMENDATIONS: [list recommendations, one per line]`,
};

// =============================================================================
// AI AGENT SERVICE
// =============================================================================

class AiAgentService {
  /**
   * Execute an AI agent task
   */
  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info("AI Agent executing", { task, context });

    try {
      // Build context data
      const contextData = await this.buildContextData(task, context);

      // Build conversation
      const messages: AgentMessage[] = [
        { role: "system", content: SYSTEM_PROMPTS[task] },
        { role: "user", content: contextData },
      ];

      // Execute multi-turn if needed
      let output = await ollamaChat(messages);
      messages.push({ role: "assistant", content: output });

      // Parse structured data from output
      const structuredData = this.parseOutput(task, output);

      // Log agent run
      await this.logAgentRun(task, context, output, true);

      return {
        success: true,
        task,
        output,
        structuredData,
        conversationHistory: messages,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("AI Agent error", { task, error });

      await this.logAgentRun(task, context, (error as Error).message, false);

      return {
        success: false,
        task,
        output: `Agent error: ${(error as Error).message}`,
        conversationHistory: [],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build context data string for the agent
   */
  private async buildContextData(task: AgentTask, context: AgentContext): Promise<string> {
    const parts: string[] = [];

    // Get case data if provided
    if (context.caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: context.caseId },
        include: {
          client: { select: { name: true, email: true, phone: true } },
          assignedEmployee: { select: { name: true } },
          documents: { select: { type: true, status: true, createdAt: true } },
          communications: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { type: true, direction: true, content: true, createdAt: true },
          },
        },
      });

      if (caseData) {
        parts.push(`CASE INFORMATION:
Case Number: ${caseData.caseNumber || caseData.internalCode}
Status: ${caseData.status}
Property: ${caseData.propertyAddress}, ${caseData.county}, ${caseData.state}
Estimated Value: $${((caseData.estimatedValueCents || 0) / 100).toFixed(2)}
Client: ${caseData.client?.name || "Unknown"}
Client Email: ${caseData.client?.email || "N/A"}
Assigned To: ${caseData.assignedEmployee?.name || "Unassigned"}
Filing Deadline: ${caseData.filingDeadline || "Not set"}
Documents: ${caseData.documents.map((d) => `${d.type} (${d.status})`).join(", ") || "None"}
Recent Communications: ${caseData.communications.length} in last 5`);
      }
    }

    // Get client data if provided
    if (context.clientId) {
      const client = await prisma.user.findUnique({
        where: { id: context.clientId },
        select: { name: true, email: true, phone: true },
      });

      if (client) {
        parts.push(`CLIENT INFORMATION:
Name: ${client.name}
Email: ${client.email}
Phone: ${client.phone || "N/A"}`);
      }
    }

    // Get document data if provided
    if (context.documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: context.documentId },
        select: { filename: true, type: true, status: true, createdAt: true },
      });

      if (doc) {
        parts.push(`DOCUMENT INFORMATION:
Filename: ${doc.filename}
Type: ${doc.type}
Status: ${doc.status}
Uploaded: ${doc.createdAt}`);
      }
    }

    // Add custom data
    if (context.customData) {
      parts.push(`ADDITIONAL CONTEXT:
${JSON.stringify(context.customData, null, 2)}`);
    }

    return parts.join("\n\n") || "No context provided.";
  }

  /**
   * Parse structured data from agent output
   */
  private parseOutput(task: AgentTask, output: string): Record<string, any> {
    switch (task) {
      case "outreach":
        return this.parseOutreachOutput(output);
      case "compliance":
        return this.parseComplianceOutput(output);
      case "document_review":
        return this.parseDocumentReviewOutput(output);
      default:
        return { rawOutput: output };
    }
  }

  private parseOutreachOutput(output: string): OutreachEmailResult {
    const subjectMatch = output.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = output.match(/BODY:\s*([\s\S]*?)(?=TONE:|$)/i);
    const toneMatch = output.match(/TONE:\s*(.+)/i);
    const ctaMatch = output.match(/CTA:\s*(.+)/i);

    return {
      subject: subjectMatch?.[1]?.trim() || "Follow-up on Your Case",
      body: bodyMatch?.[1]?.trim() || output,
      tone: toneMatch?.[1]?.trim() || "professional",
      callToAction: ctaMatch?.[1]?.trim() || "Please contact us",
    };
  }

  private parseComplianceOutput(output: string): ComplianceCheckResult {
    const compliantMatch = output.match(/COMPLIANT:\s*(YES|NO)/i);
    const issuesMatch = output.match(/ISSUES:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recsMatch = output.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=RISK_LEVEL:|$)/i);
    const riskMatch = output.match(/RISK_LEVEL:\s*(LOW|MEDIUM|HIGH)/i);

    const parseList = (text?: string): string[] =>
      text
        ?.split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l.length > 0) || [];

    return {
      isCompliant: compliantMatch?.[1]?.toUpperCase() === "YES",
      issues: parseList(issuesMatch?.[1]),
      recommendations: parseList(recsMatch?.[1]),
      riskLevel: (riskMatch?.[1]?.toLowerCase() as "low" | "medium" | "high") || "medium",
    };
  }

  private parseDocumentReviewOutput(output: string): DocumentReviewResult {
    const summaryMatch = output.match(/SUMMARY:\s*([\s\S]*?)(?=KEY_POINTS:|$)/i);
    const keyPointsMatch = output.match(/KEY_POINTS:\s*([\s\S]*?)(?=MISSING_INFO:|$)/i);
    const missingMatch = output.match(/MISSING_INFO:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recsMatch = output.match(/RECOMMENDATIONS:\s*([\s\S]*?)$/i);

    const parseList = (text?: string): string[] =>
      text
        ?.split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l.length > 0) || [];

    return {
      summary: summaryMatch?.[1]?.trim() || "No summary available",
      keyPoints: parseList(keyPointsMatch?.[1]),
      missingInfo: parseList(missingMatch?.[1]),
      recommendations: parseList(recsMatch?.[1]),
    };
  }

  /**
   * Log agent run to database
   */
  private async logAgentRun(
    task: AgentTask,
    context: AgentContext,
    output: string,
    success: boolean
  ): Promise<void> {
    try {
      await prisma.botRunLog.create({
        data: {
          botName: `ai_agent_${task}`,
          startedAt: new Date(),
          endedAt: new Date(),
          recordsProcessed: 1,
          successCount: success ? 1 : 0,
          errorCount: success ? 0 : 1,
          metadata: {
            task,
            context,
            outputPreview: output.substring(0, 500),
          },
        },
      });
    } catch (error) {
      logger.error("Failed to log agent run", { error });
    }
  }

  /**
   * Generate outreach email for a case
   */
  async generateOutreachEmail(
    caseId: string,
    emailType: "initial" | "follow_up" | "document_request" | "status_update"
  ): Promise<OutreachEmailResult> {
    const result = await this.execute("outreach", {
      caseId,
      customData: { emailType },
    });

    if (!result.success) {
      throw new Error(result.output);
    }

    return result.structuredData as OutreachEmailResult;
  }

  /**
   * Check compliance for a case
   */
  async checkCompliance(caseId: string): Promise<ComplianceCheckResult> {
    const result = await this.execute("compliance", { caseId });

    if (!result.success) {
      throw new Error(result.output);
    }

    return result.structuredData as ComplianceCheckResult;
  }

  /**
   * Generate case summary
   */
  async generateCaseSummary(caseId: string): Promise<string> {
    const result = await this.execute("summary", { caseId });
    return result.output;
  }

  /**
   * Review a document
   */
  async reviewDocument(documentId: string): Promise<DocumentReviewResult> {
    const result = await this.execute("document_review", { documentId });

    if (!result.success) {
      throw new Error(result.output);
    }

    return result.structuredData as DocumentReviewResult;
  }

  /**
   * Continue a multi-turn conversation
   */
  async continueConversation(
    conversationHistory: AgentMessage[],
    userMessage: string
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const messages = [...conversationHistory, { role: "user" as const, content: userMessage }];
      const output = await ollamaChat(messages);
      messages.push({ role: "assistant", content: output });

      return {
        success: true,
        task: "follow_up",
        output,
        conversationHistory: messages,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        task: "follow_up",
        output: `Error: ${(error as Error).message}`,
        conversationHistory,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if Ollama is available
   */
  async checkStatus(): Promise<{ available: boolean; model: string }> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      return {
        available: response.ok,
        model: OLLAMA_MODEL,
      };
    } catch {
      return {
        available: false,
        model: OLLAMA_MODEL,
      };
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const aiAgentService = new AiAgentService();
export default aiAgentService;
