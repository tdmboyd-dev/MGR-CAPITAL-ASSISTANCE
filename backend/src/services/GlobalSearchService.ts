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
  previousOwner: string | null;
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
  name: string;
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
  // In-memory cache for recent searches per user
  private recentSearchesCache: Map<string, { searches: string[]; lastUpdated: Date }> = new Map();
  private popularSearchesCache: Map<string, number> = new Map();

  /**
   * Record a search for tracking recent/popular searches
   */
  private recordSearch(userId: string, query: string): void {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return;

    // Update user's recent searches
    const userCache = this.recentSearchesCache.get(userId) || { searches: [], lastUpdated: new Date() };
    userCache.searches = [normalizedQuery, ...userCache.searches.filter(s => s !== normalizedQuery)].slice(0, 20);
    userCache.lastUpdated = new Date();
    this.recentSearchesCache.set(userId, userCache);

    // Update popular searches count
    const count = this.popularSearchesCache.get(normalizedQuery) || 0;
    this.popularSearchesCache.set(normalizedQuery, count + 1);
  }

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

    // Record search for recent/popular tracking
    this.recordSearch(userId, query);

    const searchTerm = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Parallel search across all entity types
    const searchPromises: Promise<void>[] = [];

    if (types.includes("case")) {
      searchPromises.push(
        this.searchCases(searchTerm, userId, userRole, options).then((r) => {
          results.push(...r);
        })
      );
    }

    if (types.includes("user") && this.canSearchUsers(userRole)) {
      searchPromises.push(
        this.searchUsers(searchTerm, userRole).then((r) => {
          results.push(...r);
        })
      );
    }

    if (types.includes("document")) {
      searchPromises.push(
        this.searchDocuments(searchTerm, userId, userRole).then((r) => {
          results.push(...r);
        })
      );
    }

    if (types.includes("communication")) {
      searchPromises.push(
        this.searchCommunications(searchTerm, userId, userRole).then((r) => {
          results.push(...r);
        })
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
        { previousOwner: { contains: query, mode: "insensitive" } },
        { propertyAddress: { contains: query, mode: "insensitive" } },
        { state: { contains: query, mode: "insensitive" } },
        { county: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    };

    // Role-based access control
    if (userRole === "EMPLOYEE") {
      whereClause.assignedEmployeeId = userId;
    } else if (userRole === "CLIENT") {
      whereClause.clientId = userId;
    } else if (userRole === "TEAM_LEAD") {
      // Team leads see their team's cases
      const teamMembers = await prisma.user.findMany({
        where: { teamLeaderId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      whereClause.assignedEmployeeId = { in: teamIds };
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
        previousOwner: true,
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
      caseCode: c.caseCode || "",
      status: c.status,
      previousOwner: c.previousOwner,
      propertyAddress: c.propertyAddress,
      surplusAmountCents: c.surplusAmountCents,
      state: c.state,
      county: c.county,
      matchedField: this.findMatchedField(query, {
        caseCode: c.caseCode,
        previousOwner: c.previousOwner,
        propertyAddress: c.propertyAddress,
        state: c.state,
        county: c.county,
        notes: c.notes,
      }),
      score: this.calculateScore(query, [
        c.caseCode,
        c.previousOwner,
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
          { name: { contains: query, mode: "insensitive" } },
        ],
        // Non-founders can only see active users
        ...(userRole !== "FOUNDER" && userRole !== "ADMIN" ? { isActive: true } : {}),
      },
      take: 20,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return users.map((u) => ({
      type: "user" as const,
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      matchedField: this.findMatchedField(query, {
        email: u.email,
        name: u.name,
      }),
      score: this.calculateScore(query, [u.email, u.name]),
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
      caseFilter = { case: { assignedEmployeeId: userId } };
    } else if (userRole === "CLIENT") {
      caseFilter = { case: { clientId: userId } };
    } else if (userRole === "TEAM_LEAD") {
      const teamMembers = await prisma.user.findMany({
        where: { teamLeaderId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      caseFilter = { case: { assignedEmployeeId: { in: teamIds } } };
    }

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { fileName: { contains: query, mode: "insensitive" } },
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
      caseCode: d.case.caseCode || "",
      matchedField: this.findMatchedField(query, {
        fileName: d.fileName,
      }),
      score: this.calculateScore(query, [d.fileName]),
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
      caseFilter = { case: { assignedEmployeeId: userId } };
    } else if (userRole === "CLIENT") {
      caseFilter = { case: { clientId: userId } };
    } else if (userRole === "TEAM_LEAD") {
      const teamMembers = await prisma.user.findMany({
        where: { teamLeaderId: userId },
        select: { id: true },
      });
      const teamIds = [userId, ...teamMembers.map((m) => m.id)];
      caseFilter = { case: { assignedEmployeeId: { in: teamIds } } };
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
      caseCode: c.case.caseCode || "",
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
   * Get recent searches for user (from cache)
   */
  async getRecentSearches(userId: string, limit: number = 10): Promise<string[]> {
    const userCache = this.recentSearchesCache.get(userId);
    if (!userCache) return [];

    // Clear old cache (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (userCache.lastUpdated < sevenDaysAgo) {
      this.recentSearchesCache.delete(userId);
      return [];
    }

    return userCache.searches.slice(0, limit);
  }

  /**
   * Get popular searches (from aggregated cache)
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // Get searches sorted by count
    const sorted = Array.from(this.popularSearchesCache.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query]) => query);

    // If no searches tracked yet, return defaults
    if (sorted.length < 5) {
      return [
        "Davidson County",
        "pending documents",
        "high value",
        "Tennessee surplus",
        "deadline",
        ...sorted,
      ].slice(0, limit);
    }

    return sorted;
  }

  /**
   * Clear user's search history
   */
  async clearRecentSearches(userId: string): Promise<void> {
    this.recentSearchesCache.delete(userId);
  }
}

export const globalSearchService = new GlobalSearchService();
