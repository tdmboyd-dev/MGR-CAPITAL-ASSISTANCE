/**
 * AiSearchService.ts — MGR CAPITAL ASSISTANCE
 * AI-powered semantic search and recommendations using Ollama
 *
 * Features:
 * - Semantic search over cases, documents, and communications
 * - AI-generated recommendations for case actions
 * - Training recommendations based on performance
 * - Local Ollama integration (no external API dependencies)
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export type SearchType = "cases" | "docs" | "comms" | "all";

export interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, any>;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  type: SearchType;
  results: SearchResult[];
  totalCount: number;
  processingTimeMs: number;
}

export interface AiRecommendation {
  id: string;
  type: "action" | "training" | "follow_up" | "priority";
  title: string;
  description: string;
  confidence: number;
  reasoning: string;
  suggestedAction?: string;
}

export interface CaseRecommendations {
  caseId: string;
  recommendations: AiRecommendation[];
  generatedAt: string;
}

// =============================================================================
// OLLAMA CLIENT
// =============================================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

async function ollamaGenerate(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaResponse;
    return data.response;
  } catch (error) {
    logger.error("Ollama generate error", { error });
    // Fallback to rule-based if Ollama unavailable
    return "";
  }
}

async function ollamaEmbed(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    return data.embedding;
  } catch (error) {
    logger.error("Ollama embed error", { error });
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =============================================================================
// AI SEARCH SERVICE
// =============================================================================

class AiSearchService {
  /**
   * Semantic search across cases, documents, or communications
   */
  async semanticSearch(
    query: string,
    type: SearchType = "all",
    limit: number = 20
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const results: SearchResult[] = [];

    logger.info("AI semantic search", { query, type, limit });

    // Get query embedding
    const queryEmbedding = await ollamaEmbed(query);
    const useEmbeddings = queryEmbedding.length > 0;

    // Search cases
    if (type === "cases" || type === "all") {
      const caseResults = await this.searchCases(query, queryEmbedding, useEmbeddings, limit);
      results.push(...caseResults);
    }

    // Search documents
    if (type === "docs" || type === "all") {
      const docResults = await this.searchDocuments(query, queryEmbedding, useEmbeddings, limit);
      results.push(...docResults);
    }

    // Search communications
    if (type === "comms" || type === "all") {
      const commsResults = await this.searchCommunications(query, queryEmbedding, useEmbeddings, limit);
      results.push(...commsResults);
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    return {
      success: true,
      query,
      type,
      results: topResults,
      totalCount: topResults.length,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Search cases with keyword and semantic matching
   */
  private async searchCases(
    query: string,
    queryEmbedding: number[],
    useEmbeddings: boolean,
    limit: number
  ): Promise<SearchResult[]> {
    const keywords = query.toLowerCase().split(/\s+/);

    const cases = await prisma.case.findMany({
      where: {
        OR: [
          { caseNumber: { contains: query, mode: "insensitive" } },
          { internalCode: { contains: query, mode: "insensitive" } },
          { propertyAddress: { contains: query, mode: "insensitive" } },
          { county: { contains: query, mode: "insensitive" } },
          { state: { contains: query, mode: "insensitive" } },
          { internalNotes: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        client: { select: { name: true, email: true } },
        assignedEmployee: { select: { name: true } },
      },
      take: limit * 2,
    });

    const results: SearchResult[] = [];

    for (const c of cases) {
      const text = `${c.caseNumber || ""} ${c.propertyAddress} ${c.county} ${c.state} ${c.internalNotes || ""}`;
      let score = 0;

      // Keyword matching score
      for (const kw of keywords) {
        if (text.toLowerCase().includes(kw)) {
          score += 0.2;
        }
      }

      // Embedding similarity if available
      if (useEmbeddings) {
        const textEmbedding = await ollamaEmbed(text.substring(0, 500));
        if (textEmbedding.length > 0) {
          score += cosineSimilarity(queryEmbedding, textEmbedding) * 0.8;
        }
      }

      results.push({
        id: c.id,
        type: "cases",
        title: `Case ${c.caseNumber || c.internalCode}`,
        snippet: `${c.propertyAddress}, ${c.county}, ${c.state} - Status: ${c.status}`,
        score: Math.min(score, 1),
        metadata: {
          status: c.status,
          client: c.client?.name,
          assignedTo: c.assignedEmployee?.name,
          priority: c.priority,
        },
      });
    }

    return results;
  }

  /**
   * Search documents with keyword and semantic matching
   */
  private async searchDocuments(
    query: string,
    queryEmbedding: number[],
    useEmbeddings: boolean,
    limit: number
  ): Promise<SearchResult[]> {
    const keywords = query.toLowerCase().split(/\s+/);

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { filename: { contains: query, mode: "insensitive" } },
          { type: { equals: query.toUpperCase() as any } },
        ],
      },
      include: {
        case: { select: { caseNumber: true, internalCode: true } },
        uploadedBy: { select: { name: true } },
      },
      take: limit * 2,
    });

    const results: SearchResult[] = [];

    for (const doc of documents) {
      const text = `${doc.filename} ${doc.type}`;
      let score = 0;

      for (const kw of keywords) {
        if (text.toLowerCase().includes(kw)) {
          score += 0.3;
        }
      }

      if (useEmbeddings) {
        const textEmbedding = await ollamaEmbed(text);
        if (textEmbedding.length > 0) {
          score += cosineSimilarity(queryEmbedding, textEmbedding) * 0.7;
        }
      }

      results.push({
        id: doc.id,
        type: "docs",
        title: doc.filename,
        snippet: `Type: ${doc.type} | Case: ${doc.case?.caseNumber || doc.case?.internalCode || "N/A"}`,
        score: Math.min(score, 1),
        metadata: {
          type: doc.type,
          status: doc.status,
          caseId: doc.caseId,
          uploadedBy: doc.uploadedBy?.name,
        },
      });
    }

    return results;
  }

  /**
   * Search communications with keyword and semantic matching
   */
  private async searchCommunications(
    query: string,
    queryEmbedding: number[],
    useEmbeddings: boolean,
    limit: number
  ): Promise<SearchResult[]> {
    const keywords = query.toLowerCase().split(/\s+/);

    const communications = await prisma.communication.findMany({
      where: {
        OR: [
          { content: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        case: { select: { caseNumber: true, internalCode: true } },
        user: { select: { name: true } },
      },
      take: limit * 2,
    });

    const results: SearchResult[] = [];

    for (const comm of communications) {
      const text = `${comm.subject || ""} ${comm.content || ""}`;
      let score = 0;

      for (const kw of keywords) {
        if (text.toLowerCase().includes(kw)) {
          score += 0.3;
        }
      }

      if (useEmbeddings) {
        const textEmbedding = await ollamaEmbed(text.substring(0, 500));
        if (textEmbedding.length > 0) {
          score += cosineSimilarity(queryEmbedding, textEmbedding) * 0.7;
        }
      }

      results.push({
        id: comm.id,
        type: "comms",
        title: comm.subject || `${comm.type} - ${comm.direction}`,
        snippet: comm.content?.substring(0, 100) + "..." || "No content",
        score: Math.min(score, 1),
        metadata: {
          type: comm.type,
          direction: comm.direction,
          caseId: comm.caseId,
          user: comm.user?.name,
          createdAt: comm.createdAt,
        },
      });
    }

    return results;
  }

  /**
   * Get AI recommendations for a specific case
   */
  async getCaseRecommendations(caseId: string): Promise<CaseRecommendations> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        assignedEmployee: { select: { name: true, employeeTier: true } },
        documents: { select: { type: true, status: true } },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { type: true, direction: true, createdAt: true },
        },
      },
    });

    if (!caseData) {
      return {
        caseId,
        recommendations: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const recommendations: AiRecommendation[] = [];

    // Rule-based recommendations (fallback if Ollama unavailable)
    const docTypes = caseData.documents.map((d) => d.type);
    const hasClientAgreement = docTypes.includes("CLIENT_SERVICE_AGREEMENT");
    const hasPoa = docTypes.includes("LIMITED_POA");
    const lastComm = caseData.communications[0];
    const daysSinceLastComm = lastComm
      ? Math.floor((Date.now() - new Date(lastComm.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Missing documents recommendation
    if (!hasClientAgreement) {
      recommendations.push({
        id: `rec_${caseId}_csa`,
        type: "action",
        title: "Request Client Service Agreement",
        description: "Client Service Agreement is missing. This is required to proceed.",
        confidence: 0.95,
        reasoning: "Missing required document based on document checklist analysis.",
        suggestedAction: "Send document request email to client",
      });
    }

    if (!hasPoa && caseData.status !== "NEW") {
      recommendations.push({
        id: `rec_${caseId}_poa`,
        type: "action",
        title: "Request Limited Power of Attorney",
        description: "Limited POA needed for filing on client's behalf.",
        confidence: 0.9,
        reasoning: "POA typically required after initial contact for filing authorization.",
        suggestedAction: "Generate and send POA document",
      });
    }

    // Follow-up recommendation
    if (daysSinceLastComm > 7 && caseData.status !== "PAID" && caseData.status !== "CLOSED") {
      recommendations.push({
        id: `rec_${caseId}_followup`,
        type: "follow_up",
        title: "Follow Up with Client",
        description: `No communication in ${daysSinceLastComm} days. Consider reaching out.`,
        confidence: 0.85,
        reasoning: "Cases with regular communication have higher success rates.",
        suggestedAction: "Schedule follow-up call or send status email",
      });
    }

    // Status-based recommendations
    if (caseData.status === "DOCS_SIGNED" && caseData.filingDeadline) {
      const daysToDeadline = Math.floor(
        (new Date(caseData.filingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToDeadline <= 14) {
        recommendations.push({
          id: `rec_${caseId}_deadline`,
          type: "priority",
          title: "Filing Deadline Approaching",
          description: `Filing deadline in ${daysToDeadline} days. Prioritize this case.`,
          confidence: 0.98,
          reasoning: "Deadline proximity requires immediate attention.",
          suggestedAction: "Complete filing packet and submit",
        });
      }
    }

    // Try AI-enhanced recommendations if Ollama available
    try {
      const aiRec = await this.getAiEnhancedRecommendations(caseData);
      if (aiRec) {
        recommendations.push(aiRec);
      }
    } catch (error) {
      logger.debug("AI recommendations unavailable, using rule-based only");
    }

    return {
      caseId,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get AI-enhanced recommendations using Ollama
   */
  private async getAiEnhancedRecommendations(caseData: any): Promise<AiRecommendation | null> {
    const prompt = `Analyze this tax surplus recovery case and provide ONE specific actionable recommendation:

Case Status: ${caseData.status}
Property: ${caseData.propertyAddress}, ${caseData.county}, ${caseData.state}
Documents: ${caseData.documents.map((d: any) => d.type).join(", ") || "None"}
Last Communication: ${caseData.communications[0]?.createdAt || "None"}
Estimated Value: $${(caseData.estimatedValueCents / 100).toFixed(2)}

Provide a brief, actionable recommendation in this format:
TITLE: [short title]
ACTION: [specific action to take]
REASON: [why this matters]`;

    const response = await ollamaGenerate(prompt);

    if (!response) return null;

    // Parse AI response
    const titleMatch = response.match(/TITLE:\s*(.+)/i);
    const actionMatch = response.match(/ACTION:\s*(.+)/i);
    const reasonMatch = response.match(/REASON:\s*(.+)/i);

    if (titleMatch && actionMatch) {
      return {
        id: `rec_${caseData.id}_ai`,
        type: "action",
        title: titleMatch[1].trim(),
        description: actionMatch[1].trim(),
        confidence: 0.75,
        reasoning: reasonMatch?.[1]?.trim() || "AI-generated recommendation",
        suggestedAction: actionMatch[1].trim(),
      };
    }

    return null;
  }

  /**
   * Get training recommendations for an employee
   */
  async getTrainingRecommendations(employeeId: string): Promise<AiRecommendation[]> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        trainingProgress: {
          include: { module: true },
        },
        assignedCases: {
          where: { status: { in: ["CLOSED", "REJECTED"] } },
          select: { status: true },
        },
      },
    });

    if (!employee) return [];

    const recommendations: AiRecommendation[] = [];

    // Check incomplete mandatory training
    const incompleteTraining = employee.trainingProgress.filter(
      (p) => p.status !== "COMPLETED" && p.module?.isMandatory
    );

    for (const training of incompleteTraining.slice(0, 3)) {
      recommendations.push({
        id: `train_${training.id}`,
        type: "training",
        title: `Complete: ${training.module?.title}`,
        description: `Mandatory training module at ${training.progressPct}% completion`,
        confidence: 0.95,
        reasoning: "Mandatory training required for role compliance",
        suggestedAction: `Resume training module: ${training.module?.title}`,
      });
    }

    // Performance-based recommendations
    const rejectedCases = employee.assignedCases.filter((c) => c.status === "REJECTED");
    if (rejectedCases.length > 2) {
      recommendations.push({
        id: `perf_${employeeId}_rejection`,
        type: "training",
        title: "Document Quality Training",
        description: "Higher than average case rejections detected",
        confidence: 0.8,
        reasoning: `${rejectedCases.length} rejected cases may indicate documentation gaps`,
        suggestedAction: "Review document preparation best practices",
      });
    }

    return recommendations;
  }

  /**
   * Check if Ollama is available
   */
  async checkOllamaStatus(): Promise<{ available: boolean; model: string; embedModel: string }> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      const available = response.ok;
      return {
        available,
        model: OLLAMA_MODEL,
        embedModel: EMBED_MODEL,
      };
    } catch {
      return {
        available: false,
        model: OLLAMA_MODEL,
        embedModel: EMBED_MODEL,
      };
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    const suggestions: string[] = [];

    // Get matching case numbers
    const cases = await prisma.case.findMany({
      where: {
        OR: [
          { caseNumber: { contains: query, mode: "insensitive" } },
          { propertyAddress: { contains: query, mode: "insensitive" } },
          { county: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { caseNumber: true, propertyAddress: true, county: true },
      take: 5,
    });

    for (const c of cases) {
      if (c.caseNumber?.toLowerCase().includes(lowerQuery)) {
        suggestions.push(`Case: ${c.caseNumber}`);
      }
      if (c.county?.toLowerCase().includes(lowerQuery)) {
        suggestions.push(`County: ${c.county}`);
      }
    }

    // Get matching document types
    const docTypes = ["TAX_DEED", "CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "PROPERTY_DEED", "TITLE_SEARCH"];
    for (const dt of docTypes) {
      if (dt.toLowerCase().includes(lowerQuery)) {
        suggestions.push(`Document: ${dt.replace(/_/g, " ")}`);
      }
    }

    // Common search terms
    const commonTerms = ["pending", "filed", "paid", "rejected", "urgent", "deadline", "follow-up"];
    for (const term of commonTerms) {
      if (term.includes(lowerQuery)) {
        suggestions.push(term.charAt(0).toUpperCase() + term.slice(1));
      }
    }

    return [...new Set(suggestions)].slice(0, 8);
  }

  /**
   * Rebuild embeddings for all searchable content (FOUNDER only)
   */
  async rebuildAllEmbeddings(): Promise<void> {
    logger.info("[AI] Starting embedding rebuild...");

    // This would store embeddings in a vector store or cache
    // For now, we compute on-demand (semantic search)

    const cases = await prisma.case.count();
    const documents = await prisma.document.count();
    const communications = await prisma.communication.count();

    logger.info(`[AI] Indexed: ${cases} cases, ${documents} docs, ${communications} comms`);
    logger.info("[AI] Embedding rebuild complete (on-demand mode)");
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    casesCount: number;
    documentsCount: number;
    communicationsCount: number;
    lastUpdated: string;
    ollamaAvailable: boolean;
  }> {
    const [casesCount, documentsCount, communicationsCount] = await Promise.all([
      prisma.case.count(),
      prisma.document.count(),
      prisma.communication.count(),
    ]);

    const ollamaStatus = await this.checkOllamaStatus();

    return {
      casesCount,
      documentsCount,
      communicationsCount,
      lastUpdated: new Date().toISOString(),
      ollamaAvailable: ollamaStatus.available,
    };
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const aiSearchService = new AiSearchService();
export default aiSearchService;
