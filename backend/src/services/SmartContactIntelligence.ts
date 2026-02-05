/**
 * SmartContactIntelligence.ts — MGR CAPITAL ASSISTANCE
 *
 * Contact intelligence engine that learns from every outreach attempt.
 * Analyzes Communication + BotUsageLogs to find optimal contact patterns,
 * enforce TCPA compliance, and recommend data-driven outreach strategies.
 *
 * FEATURES:
 * - Contact pattern analytics (time, day, method, state)
 * - Optimal contact window calculator with TCPA enforcement
 * - Strategy recommender per case
 * - Performance metrics dashboard
 * - Self-improving learning engine
 * - Feature toggles via FounderConfig
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { CommunicationType, CaseStatus } from "@prisma/client";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// CONSTANTS & TYPES
// =============================================================================

const TCPA_START_HOUR = 8;  // 8 AM local time
const TCPA_END_HOUR = 21;   // 9 PM local time
const SUCCESS_WINDOW_DAYS = 7;
const DEFAULT_MIN_SAMPLE_SIZE = 10;

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Statuses that represent forward progress relative to a previous status */
const STATUS_PROGRESSION: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  DOCS_PENDING: 2,
  DOCS_SIGNED: 3,
  FILED: 4,
  AWAITING_FUNDS: 5,
  PAID: 6,
  CLOSED: 7,
};

/** UTC offset (hours) for each US state — standard time basis */
const STATE_TIMEZONE_OFFSETS: Record<string, number> = {
  // Eastern (UTC-5)
  CT: -5, DE: -5, FL: -5, GA: -5, IN: -5, KY: -5, ME: -5, MD: -5, MA: -5,
  MI: -5, NH: -5, NJ: -5, NY: -5, NC: -5, OH: -5, PA: -5, RI: -5, SC: -5,
  VT: -5, VA: -5, WV: -5, DC: -5,
  // Central (UTC-6)
  AL: -6, AR: -6, IL: -6, IA: -6, KS: -6, LA: -6, MN: -6, MS: -6, MO: -6,
  NE: -6, ND: -6, OK: -6, SD: -6, TN: -6, TX: -6, WI: -6,
  // Mountain (UTC-7)
  AZ: -7, CO: -7, ID: -7, MT: -7, NM: -7, UT: -7, WY: -7,
  // Pacific (UTC-8)
  CA: -8, NV: -8, OR: -8, WA: -8,
  // Alaska (UTC-9)
  AK: -9,
  // Hawaii (UTC-10)
  HI: -10,
};

/** Feature toggle keys stored in FounderConfig */
const CONFIG_KEYS = {
  SMART_CONTACT_ENABLED: "smart_contact_enabled",
  TCPA_ENFORCEMENT: "tcpa_enforcement",
  AUTO_SCHEDULE_OPTIMAL: "auto_schedule_optimal",
  MIN_SAMPLE_SIZE: "min_sample_size",
  CONTACT_METRICS_CACHE: "contact_metrics_cache",
} as const;

interface ContactPatternResult {
  byHour: { hour: number; total: number; successes: number; rate: number }[];
  byDay: { day: string; total: number; successes: number; rate: number }[];
  byMethod: { method: string; total: number; successes: number; rate: number }[];
  byState: { state: string; total: number; successes: number; rate: number }[];
  totalContacts: number;
  overallSuccessRate: number;
}

interface OptimalContactWindow {
  bestHour: number;
  bestDay: string;
  successRate: number;
  sampleSize: number;
}

interface ContactStrategy {
  method: "CALL" | "TEXT" | "EMAIL";
  scheduledTime: Date;
  reason: string;
  confidence: number;
}

interface ContactMetrics {
  totalContacts: number;
  responseRate: number;
  avgResponseTimeHours: number;
  bestPerformingMethod: string;
  bestPerformingState: string;
  worstPerformingState: string;
}

interface MethodComparison {
  method: string;
  total: number;
  successes: number;
  successRate: number;
  avgResponseTimeHours: number;
}

interface HeatmapCell {
  hour: number;
  day: string;
  total: number;
  successes: number;
  rate: number;
}

// =============================================================================
// SMART CONTACT INTELLIGENCE CLASS
// =============================================================================

class SmartContactIntelligence {

  // ---------------------------------------------------------------------------
  // Feature Toggle Helpers
  // ---------------------------------------------------------------------------

  /** Read a feature toggle from FounderConfig with a default fallback */
  private async getToggle<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const config = await prisma.founderConfig.findUnique({ where: { key } });
      if (!config) return defaultValue;
      return (typeof config.value === "object" && config.value !== null)
        ? (config.value as Record<string, unknown>).enabled as unknown as T ?? defaultValue
        : config.value as unknown as T;
    } catch (err) {
      logger.warn("Failed to read feature toggle", { key, error: String(err) });
      return defaultValue;
    }
  }

  /** Check whether the master toggle is enabled */
  async isEnabled(): Promise<boolean> {
    return this.getToggle<boolean>(CONFIG_KEYS.SMART_CONTACT_ENABLED, true);
  }

  /** Get minimum sample size before making recommendations */
  private async getMinSampleSize(): Promise<number> {
    return this.getToggle<number>(CONFIG_KEYS.MIN_SAMPLE_SIZE, DEFAULT_MIN_SAMPLE_SIZE);
  }

  // ---------------------------------------------------------------------------
  // 1. Contact Analytics
  // ---------------------------------------------------------------------------

  /**
   * Analyze all Communications + BotUsageLogs to find patterns.
   * A "success" = case status advanced within 7 days of contact.
   */
  async analyzeContactPatterns(dateRange?: { from: Date; to: Date }): Promise<ContactPatternResult> {
    try {
      const dateFilter = dateRange
        ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
        : {};

      // Fetch outbound communications with their case data
      const communications = await prisma.communication.findMany({
        where: { direction: "OUTBOUND", ...dateFilter },
        include: {
          case: { select: { id: true, state: true, status: true, contactedAt: true, updatedAt: true, metadata: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      // Build a map of case status changes for success detection
      const caseStatusChanges = await this.buildCaseStatusChangeMap(
        communications.map((c) => c.caseId),
      );

      // Classify each communication as success or not
      const classified = communications.map((comm) => {
        const commDate = comm.createdAt;
        const hour = commDate.getUTCHours();
        const day = DAYS_OF_WEEK[commDate.getUTCDay()];
        const statusAdvanced = this.didStatusAdvance(comm.caseId, commDate, caseStatusChanges);
        return { hour, day, method: comm.type, state: comm.case.state, success: statusAdvanced };
      });

      const totalContacts = classified.length;
      const totalSuccesses = classified.filter((c) => c.success).length;

      // Aggregate by hour
      const byHour = Array.from({ length: 24 }, (_, h) => {
        const bucket = classified.filter((c) => c.hour === h);
        const successes = bucket.filter((c) => c.success).length;
        return { hour: h, total: bucket.length, successes, rate: bucket.length > 0 ? successes / bucket.length : 0 };
      }).filter((b) => b.total > 0);

      // Aggregate by day of week
      const byDay = DAYS_OF_WEEK.map((dayName) => {
        const bucket = classified.filter((c) => c.day === dayName);
        const successes = bucket.filter((c) => c.success).length;
        return { day: dayName, total: bucket.length, successes, rate: bucket.length > 0 ? successes / bucket.length : 0 };
      }).filter((b) => b.total > 0);

      // Aggregate by method
      const methods = [...new Set(classified.map((c) => c.method))];
      const byMethod = methods.map((method) => {
        const bucket = classified.filter((c) => c.method === method);
        const successes = bucket.filter((c) => c.success).length;
        return { method, total: bucket.length, successes, rate: bucket.length > 0 ? successes / bucket.length : 0 };
      });

      // Aggregate by state
      const states = [...new Set(classified.map((c) => c.state))];
      const byState = states.map((state) => {
        const bucket = classified.filter((c) => c.state === state);
        const successes = bucket.filter((c) => c.success).length;
        return { state, total: bucket.length, successes, rate: bucket.length > 0 ? successes / bucket.length : 0 };
      }).sort((a, b) => b.rate - a.rate);

      logger.info("Contact pattern analysis complete", { totalContacts, overallSuccessRate: totalContacts > 0 ? totalSuccesses / totalContacts : 0 });

      return {
        byHour,
        byDay,
        byMethod,
        byState,
        totalContacts,
        overallSuccessRate: totalContacts > 0 ? totalSuccesses / totalContacts : 0,
      };
    } catch (err) {
      logger.error("Failed to analyze contact patterns", { error: String(err) });
      throw err;
    }
  }

  /**
   * Build a map of caseId -> array of { date, statusLevel } for success detection.
   * Uses the case's status timestamp fields to reconstruct progression timeline.
   */
  private async buildCaseStatusChangeMap(
    caseIds: string[],
  ): Promise<Map<string, { date: Date; level: number }[]>> {
    const uniqueIds = [...new Set(caseIds)];
    if (uniqueIds.length === 0) return new Map();

    const cases = await prisma.case.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true, status: true,
        contactedAt: true, docsRequestedAt: true, docsSignedAt: true,
        filedAt: true, fundsReceivedAt: true, paidAt: true, closedAt: true,
        createdAt: true, updatedAt: true,
      },
    });

    const map = new Map<string, { date: Date; level: number }[]>();

    for (const c of cases) {
      const timeline: { date: Date; level: number }[] = [];
      if (c.createdAt) timeline.push({ date: c.createdAt, level: STATUS_PROGRESSION.NEW });
      if (c.contactedAt) timeline.push({ date: c.contactedAt, level: STATUS_PROGRESSION.CONTACTED });
      if (c.docsRequestedAt) timeline.push({ date: c.docsRequestedAt, level: STATUS_PROGRESSION.DOCS_PENDING });
      if (c.docsSignedAt) timeline.push({ date: c.docsSignedAt, level: STATUS_PROGRESSION.DOCS_SIGNED });
      if (c.filedAt) timeline.push({ date: c.filedAt, level: STATUS_PROGRESSION.FILED });
      if (c.fundsReceivedAt) timeline.push({ date: c.fundsReceivedAt, level: STATUS_PROGRESSION.AWAITING_FUNDS });
      if (c.paidAt) timeline.push({ date: c.paidAt, level: STATUS_PROGRESSION.PAID });
      if (c.closedAt) timeline.push({ date: c.closedAt, level: STATUS_PROGRESSION.CLOSED });
      timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
      map.set(c.id, timeline);
    }

    return map;
  }

  /** Check if a case's status advanced within SUCCESS_WINDOW_DAYS after the given contact date */
  private didStatusAdvance(
    caseId: string,
    contactDate: Date,
    changeMap: Map<string, { date: Date; level: number }[]>,
  ): boolean {
    const timeline = changeMap.get(caseId);
    if (!timeline || timeline.length === 0) return false;

    const windowEnd = new Date(contactDate.getTime() + SUCCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Find the status level at the time of contact
    let levelAtContact = 0;
    for (const entry of timeline) {
      if (entry.date <= contactDate) levelAtContact = entry.level;
      else break;
    }

    // Check if any later entry (within window) has a higher level
    for (const entry of timeline) {
      if (entry.date > contactDate && entry.date <= windowEnd && entry.level > levelAtContact) {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 2. Optimal Contact Window
  // ---------------------------------------------------------------------------

  /**
   * Returns the best hour and day to contact owners in a given state.
   * Uses historical data; respects TCPA hours.
   */
  async getOptimalContactTime(state: string, method?: CommunicationType): Promise<OptimalContactWindow> {
    try {
      const methodFilter = method ? { type: method } : {};

      const communications = await prisma.communication.findMany({
        where: {
          direction: "OUTBOUND",
          ...methodFilter,
          case: { state: state.toUpperCase() },
        },
        include: {
          case: { select: { id: true, state: true, contactedAt: true, docsRequestedAt: true, docsSignedAt: true, filedAt: true, paidAt: true, closedAt: true, createdAt: true, fundsReceivedAt: true } },
        },
      });

      const caseStatusChanges = await this.buildCaseStatusChangeMap(
        communications.map((c) => c.caseId),
      );

      // Bucket by hour+day and calculate success rates
      const buckets = new Map<string, { total: number; successes: number }>();

      for (const comm of communications) {
        const localHour = this.toLocalHour(comm.createdAt.getUTCHours(), state);
        const day = DAYS_OF_WEEK[comm.createdAt.getUTCDay()];
        const key = `${localHour}:${day}`;
        const success = this.didStatusAdvance(comm.caseId, comm.createdAt, caseStatusChanges);

        const existing = buckets.get(key) || { total: 0, successes: 0 };
        existing.total++;
        if (success) existing.successes++;
        buckets.set(key, existing);
      }

      // Find the bucket with the highest success rate (min sample size applies)
      const minSample = await this.getMinSampleSize();
      let bestKey = "";
      let bestRate = -1;
      let bestSample = 0;

      for (const [key, data] of buckets.entries()) {
        if (data.total < minSample) continue;
        const rate = data.successes / data.total;
        if (rate > bestRate || (rate === bestRate && data.total > bestSample)) {
          bestRate = rate;
          bestKey = key;
          bestSample = data.total;
        }
      }

      // Fallback if no bucket meets minimum sample size
      if (!bestKey) {
        // Pick the bucket with the most contacts regardless of rate
        for (const [key, data] of buckets.entries()) {
          if (data.total > bestSample) {
            bestSample = data.total;
            bestKey = key;
            bestRate = data.total > 0 ? data.successes / data.total : 0;
          }
        }
      }

      // Default to 10 AM Tuesday if no data at all
      if (!bestKey) {
        return { bestHour: 10, bestDay: "Tuesday", successRate: 0, sampleSize: 0 };
      }

      const [hourStr, dayStr] = bestKey.split(":");
      return {
        bestHour: parseInt(hourStr, 10),
        bestDay: dayStr,
        successRate: Math.round(bestRate * 10000) / 10000,
        sampleSize: bestSample,
      };
    } catch (err) {
      logger.error("Failed to get optimal contact time", { state, error: String(err) });
      return { bestHour: 10, bestDay: "Tuesday", successRate: 0, sampleSize: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. State Timezone Mapping & TCPA
  // ---------------------------------------------------------------------------

  /** Convert a UTC hour to approximate local hour for a given state */
  private toLocalHour(utcHour: number, state: string): number {
    const offset = STATE_TIMEZONE_OFFSETS[state.toUpperCase()] ?? -5; // default Eastern
    return ((utcHour + offset) % 24 + 24) % 24;
  }

  /** Convert a local hour in a state to UTC hour */
  private toUtcHour(localHour: number, state: string): number {
    const offset = STATE_TIMEZONE_OFFSETS[state.toUpperCase()] ?? -5;
    return ((localHour - offset) % 24 + 24) % 24;
  }

  /** Check if the current time is within TCPA-compliant hours (8 AM - 9 PM) for a state */
  isWithinTCPAHours(state: string): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const localHour = this.toLocalHour(utcHour, state);
    return localHour >= TCPA_START_HOUR && localHour < TCPA_END_HOUR;
  }

  /** Get the next valid TCPA contact window start for a state */
  getNextTCPAWindow(state: string): Date {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const localHour = this.toLocalHour(utcHour, state);

    if (localHour >= TCPA_START_HOUR && localHour < TCPA_END_HOUR) {
      // Currently within window — return now
      return now;
    }

    // Calculate hours until next 8 AM local
    const hoursUntilStart = localHour >= TCPA_END_HOUR
      ? (24 - localHour + TCPA_START_HOUR)
      : (TCPA_START_HOUR - localHour);

    const nextWindow = new Date(now.getTime() + hoursUntilStart * 60 * 60 * 1000);
    // Round to the top of the hour
    nextWindow.setUTCMinutes(0, 0, 0);
    return nextWindow;
  }

  // ---------------------------------------------------------------------------
  // 4. Contact Strategy Recommender
  // ---------------------------------------------------------------------------

  /**
   * For a specific case, recommend the best outreach approach.
   * Considers: state, previous attempts, time since last contact, skip trace data.
   */
  async recommendStrategy(caseId: string): Promise<ContactStrategy> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return { method: "CALL", scheduledTime: new Date(), reason: "Smart contact disabled — defaulting to call", confidence: 0 };
      }

      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          communications: { orderBy: { createdAt: "desc" }, take: 20 },
          client: { select: { email: true, phone: true } },
        },
      });

      if (!caseData) {
        throw new Error(`Case ${caseId} not found`);
      }

      const state = caseData.state;
      const previousAttempts = caseData.communications.filter((c) => c.direction === "OUTBOUND");
      const attemptCount = previousAttempts.length;
      const lastContact = previousAttempts[0]?.createdAt ?? null;
      const daysSinceLastContact = lastContact
        ? (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      // Determine method by attempt history and effectiveness
      const methodCounts: Record<string, number> = { CALL: 0, TEXT: 0, EMAIL: 0 };
      for (const comm of previousAttempts) {
        if (comm.type in methodCounts) methodCounts[comm.type]++;
      }

      // Get historical effectiveness for this state
      const optimal = await this.getOptimalContactTime(state);
      let recommendedMethod: "CALL" | "TEXT" | "EMAIL";
      let reason: string;
      let confidence: number;

      if (attemptCount === 0) {
        // First contact — default to TEXT (least intrusive, highest response rate in surplus recovery)
        recommendedMethod = "TEXT";
        reason = "First contact attempt — SMS yields highest initial response rate for surplus recovery outreach";
        confidence = 0.7;
      } else if (attemptCount <= 2 && methodCounts.TEXT > 0 && methodCounts.CALL === 0) {
        // Texted but never called — escalate to call
        recommendedMethod = "CALL";
        reason = "Previous SMS attempts received no response — escalating to direct call";
        confidence = 0.65;
      } else if (attemptCount <= 4 && methodCounts.EMAIL === 0) {
        // Haven't tried email yet
        recommendedMethod = "EMAIL";
        reason = "SMS and call attempts exhausted without response — trying email channel";
        confidence = 0.5;
      } else if (daysSinceLastContact > 14) {
        // Cold lead — restart with text after a cool-down period
        recommendedMethod = "TEXT";
        reason = `${Math.round(daysSinceLastContact)} days since last contact — re-engaging via SMS after cooling period`;
        confidence = 0.45;
      } else {
        // Cycle through methods, preferring the one not used most recently
        const lastMethod = previousAttempts[0]?.type;
        if (lastMethod === "TEXT" || lastMethod === "PORTAL_MESSAGE") {
          recommendedMethod = "CALL";
        } else if (lastMethod === "CALL") {
          recommendedMethod = "EMAIL";
        } else {
          recommendedMethod = "TEXT";
        }
        reason = `Cycling contact method — last attempt was ${lastMethod}; varying approach to maximize engagement`;
        confidence = 0.55;
      }

      // Boost confidence if we have strong sample data
      if (optimal.sampleSize >= 30 && optimal.successRate > 0.2) {
        confidence = Math.min(confidence + 0.15, 0.95);
      }

      // Schedule at the optimal time, respecting TCPA
      const scheduledTime = this.computeScheduledTime(state, optimal.bestHour, optimal.bestDay);

      return { method: recommendedMethod, scheduledTime, reason, confidence: Math.round(confidence * 100) / 100 };
    } catch (err) {
      logger.error("Failed to recommend strategy", { caseId, error: String(err) });
      return { method: "CALL", scheduledTime: new Date(), reason: "Error computing strategy — fallback to immediate call", confidence: 0 };
    }
  }

  /** Compute the next schedulable datetime at a given local hour and day, respecting TCPA */
  private computeScheduledTime(state: string, targetLocalHour: number, targetDay: string): Date {
    const now = new Date();
    const targetDayIndex = DAYS_OF_WEEK.indexOf(targetDay as typeof DAYS_OF_WEEK[number]);

    // Clamp target hour within TCPA window
    const clampedHour = Math.max(TCPA_START_HOUR, Math.min(targetLocalHour, TCPA_END_HOUR - 1));
    const utcHour = this.toUtcHour(clampedHour, state);

    // Find the next occurrence of the target day
    const currentDayIndex = now.getUTCDay();
    let daysAhead = targetDayIndex - currentDayIndex;
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0) {
      // Same day — check if the target hour has already passed
      const currentUtcHour = now.getUTCHours();
      if (currentUtcHour >= utcHour) daysAhead = 7;
    }

    const scheduled = new Date(now);
    scheduled.setUTCDate(scheduled.getUTCDate() + daysAhead);
    scheduled.setUTCHours(utcHour, 0, 0, 0);
    return scheduled;
  }

  // ---------------------------------------------------------------------------
  // 5. Performance Metrics
  // ---------------------------------------------------------------------------

  /** Dashboard metrics: totals, rates, and best/worst performers */
  async getContactMetrics(): Promise<ContactMetrics> {
    try {
      const totalContacts = await prisma.communication.count({ where: { direction: "OUTBOUND" } });

      // Response = any inbound communication on a case that had outbound contact
      const outboundCaseIds = await prisma.communication.findMany({
        where: { direction: "OUTBOUND" },
        select: { caseId: true },
        distinct: ["caseId"],
      });
      const outboundIds = outboundCaseIds.map((c) => c.caseId);

      const responsesCount = await prisma.communication.count({
        where: { direction: "INBOUND", caseId: { in: outboundIds } },
      });

      const responseRate = totalContacts > 0 ? responsesCount / totalContacts : 0;

      // Average response time — time between first outbound and first inbound per case
      const casesWithBothDirections = await prisma.communication.groupBy({
        by: ["caseId", "direction"],
        _min: { createdAt: true },
        where: { caseId: { in: outboundIds } },
      });

      const caseTimings = new Map<string, { outbound?: Date; inbound?: Date }>();
      for (const row of casesWithBothDirections) {
        const existing = caseTimings.get(row.caseId) || {};
        if (row.direction === "OUTBOUND") existing.outbound = row._min.createdAt ?? undefined;
        if (row.direction === "INBOUND") existing.inbound = row._min.createdAt ?? undefined;
        caseTimings.set(row.caseId, existing);
      }

      let totalResponseMs = 0;
      let responsePairs = 0;
      for (const timing of caseTimings.values()) {
        if (timing.outbound && timing.inbound && timing.inbound > timing.outbound) {
          totalResponseMs += timing.inbound.getTime() - timing.outbound.getTime();
          responsePairs++;
        }
      }
      const avgResponseTimeHours = responsePairs > 0
        ? Math.round((totalResponseMs / responsePairs / (1000 * 60 * 60)) * 100) / 100
        : 0;

      // Best performing method
      const patterns = await this.analyzeContactPatterns();
      const bestMethod = patterns.byMethod.sort((a, b) => b.rate - a.rate)[0];
      const bestState = patterns.byState[0];
      const worstState = patterns.byState[patterns.byState.length - 1];

      return {
        totalContacts,
        responseRate: Math.round(responseRate * 10000) / 10000,
        avgResponseTimeHours,
        bestPerformingMethod: bestMethod?.method ?? "N/A",
        bestPerformingState: bestState?.state ?? "N/A",
        worstPerformingState: worstState?.state ?? "N/A",
      };
    } catch (err) {
      logger.error("Failed to get contact metrics", { error: String(err) });
      throw err;
    }
  }

  /** Side-by-side comparison of SMS vs Call vs Email success rates */
  async getMethodComparison(): Promise<MethodComparison[]> {
    try {
      const methods: CommunicationType[] = ["CALL", "TEXT", "EMAIL"];
      const results: MethodComparison[] = [];

      for (const method of methods) {
        const communications = await prisma.communication.findMany({
          where: { direction: "OUTBOUND", type: method },
          include: {
            case: { select: { id: true, contactedAt: true, docsRequestedAt: true, docsSignedAt: true, filedAt: true, paidAt: true, closedAt: true, createdAt: true, fundsReceivedAt: true } },
          },
        });

        const caseStatusChanges = await this.buildCaseStatusChangeMap(
          communications.map((c) => c.caseId),
        );

        let successes = 0;
        for (const comm of communications) {
          if (this.didStatusAdvance(comm.caseId, comm.createdAt, caseStatusChanges)) {
            successes++;
          }
        }

        // Avg response time for this method
        const outboundCaseIds = [...new Set(communications.map((c) => c.caseId))];
        const inboundComms = await prisma.communication.findMany({
          where: { direction: "INBOUND", caseId: { in: outboundCaseIds } },
          orderBy: { createdAt: "asc" },
        });

        const firstInbound = new Map<string, Date>();
        for (const ic of inboundComms) {
          if (!firstInbound.has(ic.caseId)) firstInbound.set(ic.caseId, ic.createdAt);
        }

        let totalMs = 0;
        let pairs = 0;
        const firstOutbound = new Map<string, Date>();
        for (const comm of communications) {
          if (!firstOutbound.has(comm.caseId)) firstOutbound.set(comm.caseId, comm.createdAt);
        }
        for (const [caseId, outDate] of firstOutbound.entries()) {
          const inDate = firstInbound.get(caseId);
          if (inDate && inDate > outDate) {
            totalMs += inDate.getTime() - outDate.getTime();
            pairs++;
          }
        }

        results.push({
          method,
          total: communications.length,
          successes,
          successRate: communications.length > 0 ? Math.round((successes / communications.length) * 10000) / 10000 : 0,
          avgResponseTimeHours: pairs > 0 ? Math.round((totalMs / pairs / (1000 * 60 * 60)) * 100) / 100 : 0,
        });
      }

      return results;
    } catch (err) {
      logger.error("Failed to get method comparison", { error: String(err) });
      throw err;
    }
  }

  /** Hour x DayOfWeek heatmap of contact success rates */
  async getHeatmap(): Promise<HeatmapCell[]> {
    try {
      const communications = await prisma.communication.findMany({
        where: { direction: "OUTBOUND" },
        include: {
          case: { select: { id: true, state: true, contactedAt: true, docsRequestedAt: true, docsSignedAt: true, filedAt: true, paidAt: true, closedAt: true, createdAt: true, fundsReceivedAt: true } },
        },
      });

      const caseStatusChanges = await this.buildCaseStatusChangeMap(
        communications.map((c) => c.caseId),
      );

      const grid = new Map<string, { total: number; successes: number }>();

      for (const comm of communications) {
        const localHour = this.toLocalHour(comm.createdAt.getUTCHours(), comm.case.state);
        const day = DAYS_OF_WEEK[comm.createdAt.getUTCDay()];
        const key = `${localHour}:${day}`;
        const success = this.didStatusAdvance(comm.caseId, comm.createdAt, caseStatusChanges);

        const existing = grid.get(key) || { total: 0, successes: 0 };
        existing.total++;
        if (success) existing.successes++;
        grid.set(key, existing);
      }

      const heatmap: HeatmapCell[] = [];
      for (const [key, data] of grid.entries()) {
        const [hourStr, day] = key.split(":");
        heatmap.push({
          hour: parseInt(hourStr, 10),
          day,
          total: data.total,
          successes: data.successes,
          rate: data.total > 0 ? Math.round((data.successes / data.total) * 10000) / 10000 : 0,
        });
      }

      return heatmap.sort((a, b) => a.hour - b.hour || DAYS_OF_WEEK.indexOf(a.day as typeof DAYS_OF_WEEK[number]) - DAYS_OF_WEEK.indexOf(b.day as typeof DAYS_OF_WEEK[number]));
    } catch (err) {
      logger.error("Failed to generate heatmap", { error: String(err) });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Learning Engine
  // ---------------------------------------------------------------------------

  /** Record whether a contact attempt succeeded — enriches future models */
  async recordOutcome(communicationId: string, outcome: string): Promise<void> {
    try {
      await prisma.communication.update({
        where: { id: communicationId },
        data: { outcome },
      });

      // Also log to BotUsageLog for cross-referencing
      const comm = await prisma.communication.findUnique({
        where: { id: communicationId },
        select: { userId: true, caseId: true, type: true },
      });

      if (comm) {
        await prisma.botUsageLog.create({
          data: {
            userId: comm.userId,
            botName: "smart_contact_intelligence",
            action: "outcome_recorded",
            caseId: comm.caseId,
            details: { communicationId, outcome, method: comm.type },
          },
        });
      }

      logger.info("Contact outcome recorded", { communicationId, outcome });
    } catch (err) {
      logger.error("Failed to record outcome", { communicationId, error: String(err) });
      throw err;
    }
  }

  /** Rebuild all statistical models from latest data and cache in FounderConfig */
  async recalculateModels(): Promise<void> {
    try {
      logger.info("Recalculating smart contact models...");

      const patterns = await this.analyzeContactPatterns();
      const methodComparison = await this.getMethodComparison();
      const heatmap = await this.getHeatmap();

      // Compute per-state optimal windows
      const stateOptimalWindows: Record<string, OptimalContactWindow> = {};
      for (const stateEntry of patterns.byState) {
        const optimal = await this.getOptimalContactTime(stateEntry.state);
        stateOptimalWindows[stateEntry.state] = optimal;
      }

      const metricsCache = {
        patterns: {
          overallSuccessRate: patterns.overallSuccessRate,
          totalContacts: patterns.totalContacts,
          topMethods: patterns.byMethod.sort((a, b) => b.rate - a.rate).slice(0, 3),
          topStates: patterns.byState.slice(0, 5),
          topHours: patterns.byHour.sort((a, b) => b.rate - a.rate).slice(0, 5),
        },
        methodComparison,
        heatmapSummary: {
          bestCell: heatmap.sort((a, b) => b.rate - a.rate)[0] ?? null,
          worstCell: heatmap.sort((a, b) => a.rate - b.rate)[0] ?? null,
          totalCells: heatmap.length,
        },
        stateOptimalWindows,
        calculatedAt: new Date().toISOString(),
      };

      // Upsert into FounderConfig for fast dashboard access
      const metricsCacheJson = JSON.parse(JSON.stringify(metricsCache));
      await prisma.founderConfig.upsert({
        where: { key: CONFIG_KEYS.CONTACT_METRICS_CACHE },
        update: { value: metricsCacheJson },
        create: {
          key: CONFIG_KEYS.CONTACT_METRICS_CACHE,
          value: metricsCacheJson,
          description: "Cached smart contact intelligence metrics — auto-recalculated",
        },
      });

      logger.info("Smart contact models recalculated successfully", {
        totalContacts: patterns.totalContacts,
        statesAnalyzed: patterns.byState.length,
      });
    } catch (err) {
      logger.error("Failed to recalculate models", { error: String(err) });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Feature Toggles Management
  // ---------------------------------------------------------------------------

  /** Get all feature toggle states */
  async getFeatureToggles(): Promise<Record<string, unknown>> {
    const [smartEnabled, tcpaEnforcement, autoSchedule, minSample] = await Promise.all([
      this.getToggle<boolean>(CONFIG_KEYS.SMART_CONTACT_ENABLED, true),
      this.getToggle<boolean>(CONFIG_KEYS.TCPA_ENFORCEMENT, true),
      this.getToggle<boolean>(CONFIG_KEYS.AUTO_SCHEDULE_OPTIMAL, false),
      this.getToggle<number>(CONFIG_KEYS.MIN_SAMPLE_SIZE, DEFAULT_MIN_SAMPLE_SIZE),
    ]);

    return {
      smart_contact_enabled: smartEnabled,
      tcpa_enforcement: tcpaEnforcement,
      auto_schedule_optimal: autoSchedule,
      min_sample_size: minSample,
    };
  }

  /** Update a feature toggle value */
  async setFeatureToggle(key: string, value: unknown): Promise<void> {
    const validKeys = Object.values(CONFIG_KEYS);
    if (!validKeys.includes(key as typeof validKeys[number])) {
      throw new Error(`Invalid feature toggle key: ${key}. Valid keys: ${validKeys.join(", ")}`);
    }

    const toggleValue = { enabled: value as boolean | number | string };
    await prisma.founderConfig.upsert({
      where: { key },
      update: { value: toggleValue },
      create: {
        key,
        value: toggleValue,
        description: `Smart contact intelligence toggle: ${key}`,
      },
    });

    logger.info("Feature toggle updated", { key, value });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const smartContactIntelligence = new SmartContactIntelligence();
export default smartContactIntelligence;
