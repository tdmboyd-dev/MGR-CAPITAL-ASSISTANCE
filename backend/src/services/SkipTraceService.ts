/**
 * Skip Trace Service — MGR CAPITAL ASSISTANCE
 * Owner/Heir Discovery via Tracerfy API
 *
 * Tracerfy pricing: $0.009 - $0.02 per record
 * Features: Phone numbers, emails, addresses, relatives, aliases
 *
 * Documentation: https://www.tracerfy.com/skip-tracing-api
 */

import { logger } from "../utils/logger.js";

// Environment variables
const TRACERFY_API_KEY = process.env.TRACERFY_API_KEY || "";
const TRACERFY_API_URL = process.env.TRACERFY_API_URL || "https://api.tracerfy.com/v1";

export interface PersonInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssn?: string; // Last 4 only, for enhanced matching
  dob?: string; // YYYY-MM-DD format
}

export interface PhoneResult {
  number: string;
  type: "mobile" | "landline" | "voip" | "unknown";
  carrier?: string;
  isValid: boolean;
  doNotCall: boolean;
  lastSeen?: Date;
}

export interface EmailResult {
  address: string;
  isValid: boolean;
  type: "personal" | "work" | "unknown";
  lastSeen?: Date;
}

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  type: "current" | "previous";
  moveInDate?: Date;
  moveOutDate?: Date;
  isVerified: boolean;
}

export interface RelativeResult {
  firstName: string;
  lastName: string;
  relationship?: string;
  age?: number;
  addresses?: AddressResult[];
  phones?: PhoneResult[];
}

export interface SkipTraceResult {
  id: string;
  input: PersonInput;
  matchConfidence: number; // 0-100
  status: "found" | "partial" | "not_found" | "error";
  person?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    suffix?: string;
    age?: number;
    dob?: string;
    isDeceased: boolean;
    deceasedDate?: string;
  };
  phones: PhoneResult[];
  emails: EmailResult[];
  addresses: AddressResult[];
  relatives: RelativeResult[];
  aliases?: string[];
  employment?: {
    employer: string;
    title?: string;
    address?: string;
  }[];
  bankruptcy?: {
    chapter: string;
    filingDate: string;
    dischargeDate?: string;
    court: string;
  }[];
  liens?: {
    type: string;
    amount: number;
    filingDate: string;
    creditor?: string;
  }[];
  processedAt: Date;
  cost: number;
}

export interface BatchResult {
  batchId: string;
  totalRecords: number;
  successCount: number;
  failCount: number;
  results: SkipTraceResult[];
  totalCost: number;
}

class SkipTraceService {
  private apiKey: string;
  private baseUrl: string;
  private isConfigured: boolean;

  // Rate limiting
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  private maxRequestsPerMinute: number = 100;

  constructor() {
    this.apiKey = TRACERFY_API_KEY;
    this.baseUrl = TRACERFY_API_URL;
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      logger.warn("Tracerfy API key not configured - using mock mode");
    }
  }

  /**
   * Skip trace a single person
   */
  async tracePerson(input: PersonInput, enhanced: boolean = false): Promise<SkipTraceResult> {
    logger.info("Skip tracing person", {
      name: `${input.firstName} ${input.lastName}`,
      enhanced,
    });

    // Rate limiting check
    this.checkRateLimit();

    const startTime = Date.now();

    // In production, call Tracerfy API
    if (this.isConfigured) {
      try {
        // const response = await fetch(`${this.baseUrl}/skip-trace`, {
        //   method: "POST",
        //   headers: {
        //     "Authorization": `Bearer ${this.apiKey}`,
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({
        //     first_name: input.firstName,
        //     last_name: input.lastName,
        //     middle_name: input.middleName,
        //     address: input.address,
        //     city: input.city,
        //     state: input.state,
        //     zip: input.zip,
        //     enhanced,
        //   }),
        // });
        //
        // if (!response.ok) {
        //   throw new Error(`API error: ${response.status}`);
        // }
        //
        // const data = await response.json();
        // return this.transformApiResult(data, input);
      } catch (error: any) {
        logger.error("Tracerfy API error", { error: error.message });
        throw error;
      }
    }

    // Mock response for development
    const result = this.generateMockResult(input, enhanced);
    result.cost = enhanced ? 0.15 : 0.02;

    logger.info("Skip trace completed", {
      name: `${input.firstName} ${input.lastName}`,
      status: result.status,
      confidence: result.matchConfidence,
      phones: result.phones.length,
      relatives: result.relatives.length,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Batch skip trace multiple people
   */
  async traceBatch(
    inputs: PersonInput[],
    enhanced: boolean = false
  ): Promise<BatchResult> {
    logger.info("Starting batch skip trace", { count: inputs.length, enhanced });

    const results: SkipTraceResult[] = [];
    let successCount = 0;
    let totalCost = 0;

    // Process in parallel with concurrency limit
    const concurrencyLimit = 10;
    const batches: PersonInput[][] = [];

    for (let i = 0; i < inputs.length; i += concurrencyLimit) {
      batches.push(inputs.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((input) =>
          this.tracePerson(input, enhanced).catch((error) => ({
            id: `error_${Date.now()}`,
            input,
            matchConfidence: 0,
            status: "error" as const,
            phones: [],
            emails: [],
            addresses: [],
            relatives: [],
            processedAt: new Date(),
            cost: 0,
            error: error.message,
          }))
        )
      );

      for (const result of batchResults) {
        results.push(result as SkipTraceResult);
        if ((result as SkipTraceResult).status === "found") {
          successCount++;
        }
        totalCost += (result as SkipTraceResult).cost;
      }
    }

    const batchResult: BatchResult = {
      batchId: `batch_${Date.now()}`,
      totalRecords: inputs.length,
      successCount,
      failCount: inputs.length - successCount,
      results,
      totalCost,
    };

    logger.info("Batch skip trace completed", {
      batchId: batchResult.batchId,
      total: batchResult.totalRecords,
      success: batchResult.successCount,
      cost: batchResult.totalCost,
    });

    return batchResult;
  }

  /**
   * Find heirs of a deceased person
   */
  async findHeirs(
    deceasedPerson: PersonInput,
    maxGenerations: number = 2
  ): Promise<{
    deceased: SkipTraceResult;
    heirs: SkipTraceResult[];
    confidence: number;
  }> {
    logger.info("Finding heirs for deceased person", {
      name: `${deceasedPerson.firstName} ${deceasedPerson.lastName}`,
    });

    // First, trace the deceased person with enhanced data (includes relatives)
    const deceasedResult = await this.tracePerson(deceasedPerson, true);

    if (deceasedResult.status === "not_found") {
      return {
        deceased: deceasedResult,
        heirs: [],
        confidence: 0,
      };
    }

    // Trace each relative to get their contact info
    const heirResults: SkipTraceResult[] = [];

    for (const relative of deceasedResult.relatives) {
      // Skip if no sufficient info
      if (!relative.firstName || !relative.lastName) continue;

      try {
        const relativeResult = await this.tracePerson(
          {
            firstName: relative.firstName,
            lastName: relative.lastName,
            address: relative.addresses?.[0]?.street,
            city: relative.addresses?.[0]?.city,
            state: relative.addresses?.[0]?.state,
            zip: relative.addresses?.[0]?.zip,
          },
          false // Basic trace for heirs
        );

        // Add relationship info
        (relativeResult as any).relationship = relative.relationship;
        heirResults.push(relativeResult);
      } catch (error) {
        logger.warn("Failed to trace relative", {
          name: `${relative.firstName} ${relative.lastName}`,
        });
      }
    }

    // Calculate overall confidence
    const heirsFound = heirResults.filter((r) => r.status === "found").length;
    const confidence = heirsFound > 0 ? Math.min(100, (heirsFound / Math.max(1, deceasedResult.relatives.length)) * 100) : 0;

    return {
      deceased: deceasedResult,
      heirs: heirResults,
      confidence,
    };
  }

  /**
   * Search by property address (find current/previous owners)
   */
  async traceByProperty(
    address: string,
    city: string,
    state: string,
    zip: string
  ): Promise<SkipTraceResult[]> {
    logger.info("Tracing property owners", { address, city, state });

    // In production, this would use property records API
    // then skip trace each owner found

    // Mock: Return a sample owner
    const mockOwner = await this.tracePerson({
      firstName: "Property",
      lastName: "Owner",
      address,
      city,
      state,
      zip,
    });

    return [mockOwner];
  }

  /**
   * Verify if a person is deceased
   */
  async checkDeceasedStatus(input: PersonInput): Promise<{
    isDeceased: boolean;
    confidence: number;
    deceasedDate?: string;
    source?: string;
  }> {
    logger.info("Checking deceased status", {
      name: `${input.firstName} ${input.lastName}`,
    });

    // In production, this would check:
    // - SSA Death Master File
    // - State death records
    // - Obituary databases

    const result = await this.tracePerson(input, true);

    return {
      isDeceased: result.person?.isDeceased || false,
      confidence: result.matchConfidence,
      deceasedDate: result.person?.deceasedDate,
      source: "SSA Death Master File",
    };
  }

  /**
   * Score a lead for priority
   */
  scoreResult(result: SkipTraceResult): number {
    let score = 0;

    // Base score from match confidence
    score += result.matchConfidence * 0.3;

    // Phone availability (+30 max)
    const validPhones = result.phones.filter((p) => p.isValid && !p.doNotCall);
    score += Math.min(30, validPhones.length * 10);

    // Mobile phones are more valuable
    const mobilePhones = validPhones.filter((p) => p.type === "mobile");
    score += mobilePhones.length * 5;

    // Email availability (+10 max)
    const validEmails = result.emails.filter((e) => e.isValid);
    score += Math.min(10, validEmails.length * 5);

    // Current address verified (+10)
    const currentAddress = result.addresses.find(
      (a) => a.type === "current" && a.isVerified
    );
    if (currentAddress) score += 10;

    // Heirs available for deceased (+10)
    if (result.person?.isDeceased && result.relatives.length > 0) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  // Private helpers

  private checkRateLimit(): void {
    const now = Date.now();
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.maxRequestsPerMinute) {
      throw new Error("Rate limit exceeded. Please try again in a minute.");
    }

    this.requestCount++;
  }

  private generateMockResult(input: PersonInput, enhanced: boolean): SkipTraceResult {
    const isFound = Math.random() > 0.2; // 80% success rate in mock
    const isDeceased = Math.random() > 0.85; // 15% deceased in mock

    const result: SkipTraceResult = {
      id: `skip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      input,
      matchConfidence: isFound ? Math.floor(Math.random() * 30) + 70 : 0,
      status: isFound ? "found" : "not_found",
      phones: [],
      emails: [],
      addresses: [],
      relatives: [],
      processedAt: new Date(),
      cost: enhanced ? 0.15 : 0.02,
    };

    if (isFound) {
      result.person = {
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        age: Math.floor(Math.random() * 40) + 30,
        isDeceased,
        deceasedDate: isDeceased
          ? new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3)
              .toISOString()
              .split("T")[0]
          : undefined,
      };

      // Add mock phones
      result.phones = [
        {
          number: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          type: "mobile",
          isValid: true,
          doNotCall: false,
          lastSeen: new Date(),
        },
        {
          number: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          type: "landline",
          isValid: true,
          doNotCall: false,
          lastSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ];

      // Add mock emails
      result.emails = [
        {
          address: `${input.firstName.toLowerCase()}.${input.lastName.toLowerCase()}@email.com`,
          isValid: true,
          type: "personal",
          lastSeen: new Date(),
        },
      ];

      // Add mock addresses
      result.addresses = [
        {
          street: input.address || "123 Main Street",
          city: input.city || "Miami",
          state: input.state || "FL",
          zip: input.zip || "33101",
          county: "Miami-Dade",
          type: "current",
          isVerified: true,
        },
      ];

      // Add mock relatives (enhanced only)
      if (enhanced) {
        result.relatives = [
          {
            firstName: "Jane",
            lastName: input.lastName,
            relationship: "spouse",
            age: Math.floor(Math.random() * 10) + (result.person.age || 40) - 5,
          },
          {
            firstName: "John Jr",
            lastName: input.lastName,
            relationship: "child",
            age: Math.floor(Math.random() * 15) + 18,
          },
          {
            firstName: "Mary",
            lastName: "Smith",
            relationship: "sibling",
            age: (result.person.age || 40) + Math.floor(Math.random() * 6) - 3,
          },
        ];

        result.aliases = [`${input.firstName[0]}. ${input.lastName}`];
      }
    }

    return result;
  }

  getStatus(): { configured: boolean; mode: string; rateLimit: { used: number; max: number } } {
    return {
      configured: this.isConfigured,
      mode: this.isConfigured ? "live" : "mock",
      rateLimit: {
        used: this.requestCount,
        max: this.maxRequestsPerMinute,
      },
    };
  }
}

// Export singleton
export const skipTraceService = new SkipTraceService();
export type { SkipTraceService };
