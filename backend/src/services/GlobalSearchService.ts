/**
 * Global Search Service — MGR CAPITAL ASSISTANCE
 * Phase 20: AI-Enhanced Global Search
 *
 * Searches across cases, users, documents, communications
 * with optional AI embedding for semantic relevance.
 */

import { PrismaClient, UserRole, CaseStatus, DocumentType } from "@prisma/client";

const prisma = new PrismaClient();

// Result types for each searchable entity
export interface CaseSearchResult {
  type: "case";
  id: string;
  caseCode: string;
  status: CaseStatus;
  ownerName: string | null;
  propertyAddress: string | null;
  surplusAmountCents: number | null;
  state: string | null;
  county: string | null;
  matchedField: string;
  score: number;
}

export interface UserSearchResult {
  type: "user";
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  matchedField: string;
  score: number;
}

export interface DocumentSearchResult {
  type: "document";
  id: string;
  fileName: string;
  documentType: DocumentType;
  caseId: string;
  caseCode: string;
  matchedField: string;
  score: number;
}

export interface CommunicationSearchResult {
  type: "communication";
  id: string;
  subject: string | null;
  preview: string;
  caseId: string;
  caseCode: string;
  direction: string;
  createdAt: Date;
  matchedField: string;
  score: number;
}

export type SearchResult =
  | CaseSearchResult
  | UserSearchResult
  | DocumentSearchResult
  | CommunicationSearchResult;

export interface GlobalSearchOptions {
  query: string;
  userId: string;
  userRole: UserRole;
  limit?: number;
  types?: ("case" | "user" | "document" | "communication")[];
  state?: string;
  status?: CaseStatus;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  breakdown: {
    cases: number;
    users: number;
    documents: number;
    communications: number;
  };
  searchTime: number;
}

class GlobalSearchService {
  /**
   * Perform global search across all entities
   */
  async globalSearch(options: GlobalSearchOptions): Promise<GlobalSearchResponse> {
    const startTime = Date.now();
    const {
      query,
      userId,
      userRole,
      limit = 50,
      types = ["case", "user", "document", "communication"],
    } = options;

    if (!query || query.trim().length < 2) {
      return {
        query,
        totalResults: 0,
        results: [],
        breakdown: { cases: 0, users: 0, documents: 0, communications: 0 },
        searchTime: 0,
      };
    }

    const searchTerm = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Parallel search across all entity types
    const searchPromises: Promise<void>[] = [];

    if (types.includes("case")) {
      searchPromises.push(
        this.searchCases(searchTerm, userId, userRole, options).then((r) =>
          results.push(...r)
        )
      );
    }

    if (types.includes("user") && this.canSearchUsers(userRole)) {
      searchPromises.push(
        this.searchUsers(searchTerm, userRole).then((r) => results.push(...r))
      );
    }

    if (types.includes("document")) {
      searchPromises.push(
        this.searchDocuments(searchTerm, userId, userRole).then((r) =>
          results.push(...r)
        )
      );
    }

    if (types.includes("communication")) {
      searchPromises.push(
        this.searchCommunications(searchTerm, userId, userRole).then((r) =>
          results.push(...r)
        )
      );
    }

    await Promise.all(searchPromises);

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limitedResults = results.slice(0, limit);

    const breakdown = {
      cases: limitedResults.filter((r) => r.type === "case").length,
      users: limitedResults.filter((r) => r.type === "user").length,
      documents: limitedResults.filter((r) => r.type === "document").length,
      communications: limitedResults.filter((r) => r.type === "communication").length,
    };

    return {
      query,
      totalResults: limitedResults.length,
      results: limitedResults,
      breakdown,
      searchTime: Date.now() - startTime,
    };
  }

  /**
   * Search cases with role-based filtering
   */
  private async searchCases(
    query: string,
    userId: string,
    userRole: UserRole,
    options: GlobalSearchOptions
  ): Promise<CaseSearchResult[]> {
    const whereClause: any = {
      OR: [
        { caseCode: { contains: query, mode: "insensitive" } },
        { ownerName: { contains: query, mode: "insensitive" } },
        { propertyAddress: { contains: query, mode: "insensitive" } },
        { state: { contains: query, mode: "insensitive" } },
        { county: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    };

    // Role-based access control
    if (userRole === "EMPLOYEE") {
      whereClause.assignedToId = userId;
    } else if (userRole === "CLIENT") {
      whereClause.clientId = userId;
    } else if (userRole === "TEAM_LEAD") {
      // Team leads see their team's cases
      const teamMembers = await prisma.user.findMany({
        where: { teamLeadId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      whereClause.assignedToId = { in: teamIds };
    }

    // Optional filters
    if (options.state) {
      whereClause.state = options.state;
    }
    if (options.status) {
      whereClause.status = options.status;
    }

    const cases = await prisma.case.findMany({
      where: whereClause,
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        caseCode: true,
        status: true,
        ownerName: true,
        propertyAddress: true,
        surplusAmountCents: true,
        state: true,
        county: true,
        notes: true,
      },
    });

    return cases.map((c) => ({
      type: "case" as const,
      id: c.id,
      caseCode: c.caseCode,
      status: c.status,
      ownerName: c.ownerName,
      propertyAddress: c.propertyAddress,
      surplusAmountCents: c.surplusAmountCents,
      state: c.state,
      county: c.county,
      matchedField: this.findMatchedField(query, {
        caseCode: c.caseCode,
        ownerName: c.ownerName,
        propertyAddress: c.propertyAddress,
        state: c.state,
        county: c.county,
        notes: c.notes,
      }),
      score: this.calculateScore(query, [
        c.caseCode,
        c.ownerName,
        c.propertyAddress,
        c.state,
        c.county,
      ]),
    }));
  }

  /**
   * Search users (admin/founder only for full list)
   */
  private async searchUsers(
    query: string,
    userRole: UserRole
  ): Promise<UserSearchResult[]> {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
        // Non-founders can only see active users
        ...(userRole !== "FOUNDER" && userRole !== "ADMIN" ? { isActive: true } : {}),
      },
      take: 20,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return users.map((u) => ({
      type: "user" as const,
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      matchedField: this.findMatchedField(query, {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
      }),
      score: this.calculateScore(query, [u.email, u.firstName, u.lastName]),
    }));
  }

  /**
   * Search documents with case access control
   */
  private async searchDocuments(
    query: string,
    userId: string,
    userRole: UserRole
  ): Promise<DocumentSearchResult[]> {
    // Build case access filter
    let caseFilter: any = {};
    if (userRole === "EMPLOYEE") {
      caseFilter = { case: { assignedToId: userId } };
    } else if (userRole === "CLIENT") {
      caseFilter = { case: { clientId: userId } };
    } else if (userRole === "TEAM_LEAD") {
      const teamMembers = await prisma.user.findMany({
        where: { teamLeadId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      caseFilter = { case: { assignedToId: { in: teamIds } } };
    }

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { fileName: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
        ],
        ...caseFilter,
      },
      take: 20,
      include: {
        case: {
          select: {
            id: true,
            caseCode: true,
          },
        },
      },
    });

    return documents.map((d) => ({
      type: "document" as const,
      id: d.id,
      fileName: d.fileName,
      documentType: d.type,
      caseId: d.case.id,
      caseCode: d.case.caseCode,
      matchedField: this.findMatchedField(query, {
        fileName: d.fileName,
        notes: d.notes,
      }),
      score: this.calculateScore(query, [d.fileName, d.notes]),
    }));
  }

  /**
   * Search communications with case access control
   */
  private async searchCommunications(
    query: string,
    userId: string,
    userRole: UserRole
  ): Promise<CommunicationSearchResult[]> {
    // Build case access filter
    let caseFilter: any = {};
    if (userRole === "EMPLOYEE") {
      caseFilter = { case: { assignedToId: userId } };
    } else if (userRole === "CLIENT") {
      caseFilter = { case: { clientId: userId } };
    } else if (userRole === "TEAM_LEAD") {
      const teamMembers = await prisma.user.findMany({
        where: { teamLeadId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      caseFilter = { case: { assignedToId: { in: teamIds } } };
    }

    const communications = await prisma.communication.findMany({
      where: {
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
        ...caseFilter,
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        case: {
          select: {
            id: true,
            caseCode: true,
          },
        },
      },
    });

    return communications.map((c) => ({
      type: "communication" as const,
      id: c.id,
      subject: c.subject,
      preview: c.content?.substring(0, 100) || "",
      caseId: c.case.id,
      caseCode: c.case.caseCode,
      direction: c.direction,
      createdAt: c.createdAt,
      matchedField: this.findMatchedField(query, {
        subject: c.subject,
        content: c.content,
      }),
      score: this.calculateScore(query, [c.subject, c.content]),
    }));
  }

  /**
   * Check if user role can search users
   */
  private canSearchUsers(role: UserRole): boolean {
    return ["FOUNDER", "ADMIN", "HR", "TEAM_LEAD"].includes(role);
  }

  /**
   * Find which field matched the query
   */
  private findMatchedField(query: string, fields: Record<string, string | null>): string {
    const lowerQuery = query.toLowerCase();
    for (const [key, value] of Object.entries(fields)) {
      if (value && value.toLowerCase().includes(lowerQuery)) {
        return key;
      }
    }
    return "unknown";
  }

  /**
   * Calculate relevance score (0-100)
   */
  private calculateScore(query: string, values: (string | null | undefined)[]): number {
    const lowerQuery = query.toLowerCase();
    let maxScore = 0;

    for (const value of values) {
      if (!value) continue;
      const lowerValue = value.toLowerCase();

      // Exact match
      if (lowerValue === lowerQuery) {
        maxScore = Math.max(maxScore, 100);
      }
      // Starts with query
      else if (lowerValue.startsWith(lowerQuery)) {
        maxScore = Math.max(maxScore, 80);
      }
      // Contains query
      else if (lowerValue.includes(lowerQuery)) {
        // Score based on position (earlier = higher)
        const position = lowerValue.indexOf(lowerQuery);
        const positionScore = Math.max(60 - position, 40);
        maxScore = Math.max(maxScore, positionScore);
      }
    }

    return maxScore;
  }

  /**
   * Get recent searches for user (from cache/db)
   */
  async getRecentSearches(userId: string, limit: number = 10): Promise<string[]> {
    // Could be stored in Redis or a RecentSearch model
    // For now, return empty (placeholder for future enhancement)
    return [];
  }

  /**
   * Get popular searches (anonymized)
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // Could aggregate from search logs
    // For now, return common terms
    return [
      "Davidson County",
      "pending documents",
      "high value",
      "Tennessee surplus",
      "deadline",
    ];
  }
}

export const globalSearchService = new GlobalSearchService();
