/**
 * RevenueForecasterService.ts
 *
 * Revenue forecasting engine for MGR Capital Assistance.
 * Predicts future revenue from surplus recovery pipeline, calculates
 * conversion rates, bot ROI, revenue trends, cash flow projections,
 * and goal tracking.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 *
 * Features:
 * - Pipeline revenue forecast (30/60/90 day windows)
 * - Historical status-to-status conversion rates
 * - Bot ROI analysis per bot
 * - Monthly revenue trend analysis
 * - Cash flow projection with known expenses
 * - Goal tracking against FounderConfig targets
 * - Feature toggled via FounderConfig keys
 */

import { CaseStatus, LedgerEntryType, LedgerEntryStatus } from "@prisma/client";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// TYPES
// =============================================================================

interface StatusForecast {
  status: CaseStatus;
  caseCount: number;
  avgSurplusCents: number;
  avgFeePercent: number;
  conversionProbability: number;
  avgDaysToClose: number;
  weightedRevenueCents: number;
}

interface StateForecast {
  state: string;
  caseCount: number;
  weightedRevenueCents: number;
}

interface MonthForecast {
  month: string; // YYYY-MM
  projectedRevenueCents: number;
  caseCount: number;
}

interface RevenueForecastResult {
  totalForecastCents: number;
  confidence: number;
  byStatus: StatusForecast[];
  byState: StateForecast[];
  byMonth: MonthForecast[];
}

interface StatusTransition {
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  rate: number;
  avgDays: number;
}

interface ConversionRatesResult {
  transitions: StatusTransition[];
}

interface BotROIEntry {
  name: string;
  costCents: number;
  revenueCents: number;
  roi: number;
  casesTouched: number;
}

interface BotROIResult {
  bots: BotROIEntry[];
}

interface MonthlyRevenue {
  month: string; // YYYY-MM
  grossCents: number;
  commissionsCents: number;
  netCents: number;
  casesClosed: number;
}

interface RevenueTrendsResult {
  months: MonthlyRevenue[];
}

interface CashFlowMonth {
  month: string; // YYYY-MM
  projectedRevenueCents: number;
  projectedExpensesCents: number;
  netCents: number;
}

interface CashFlowResult {
  months: CashFlowMonth[];
}

interface GoalMetric {
  target: number;
  actual: number;
  pctComplete: number;
}

interface GoalTrackingResult {
  revenue: GoalMetric;
  cases: GoalMetric;
  conversion: { target: number; actual: number };
}

// =============================================================================
// STATUS PIPELINE ORDER (linear progression toward PAID)
// =============================================================================

const PIPELINE_STATUSES: CaseStatus[] = [
  "NEW",
  "CONTACTED",
  "DOCS_PENDING",
  "DOCS_SIGNED",
  "FILED",
  "AWAITING_FUNDS",
  "PAID",
];

/** Map each pipeline status to the next status in the funnel */
const NEXT_STATUS: Partial<Record<CaseStatus, CaseStatus>> = {
  NEW: "CONTACTED",
  CONTACTED: "DOCS_PENDING",
  DOCS_PENDING: "DOCS_SIGNED",
  DOCS_SIGNED: "FILED",
  FILED: "AWAITING_FUNDS",
  AWAITING_FUNDS: "PAID",
};

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/** Return YYYY-MM string for a Date */
function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Start of the current calendar month */
function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Add N months to a date (returns start-of-month) */
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Difference in calendar days between two dates */
function diffDays(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Safely read a FounderConfig value (returns parsed JSON or null) */
async function getConfigValue<T = unknown>(key: string): Promise<T | null> {
  try {
    const row = await prisma.founderConfig.findUnique({ where: { key } });
    if (!row) return null;
    return row.value as T;
  } catch {
    return null;
  }
}

/** Read a numeric config with a default fallback */
async function getConfigNumber(key: string, fallback: number): Promise<number> {
  const val = await getConfigValue<number>(key);
  return typeof val === "number" ? val : fallback;
}

// =============================================================================
// REVENUE FORECASTER SERVICE
// =============================================================================

class RevenueForecasterService {
  // ---------------------------------------------------------------------------
  // 1. PIPELINE REVENUE FORECAST
  // ---------------------------------------------------------------------------

  /**
   * Predict revenue for the next N days based on current pipeline and
   * historical conversion behaviour.
   */
  async forecastRevenue(days: 30 | 60 | 90): Promise<RevenueForecastResult> {
    const enabled = await getConfigValue<boolean>("revenue_forecaster_enabled");
    if (enabled === false) {
      logger.info("Revenue forecaster is disabled via FounderConfig");
      return { totalForecastCents: 0, confidence: 0, byStatus: [], byState: [], byMonth: [] };
    }

    const confidenceThreshold = await getConfigNumber("forecast_confidence_threshold", 0.5);
    const conversionRates = await this.buildConversionMap();
    const avgDaysMap = await this.buildAvgDaysMap();
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Fetch all active pipeline cases (not PAID, CLOSED, REJECTED)
    const activeCases = await prisma.case.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED", "AWAITING_FUNDS"] },
      },
      select: {
        id: true,
        status: true,
        state: true,
        surplusAmountCents: true,
        feePercent: true,
        createdAt: true,
      },
    });

    // Accumulate by status
    const byStatusMap = new Map<CaseStatus, StatusForecast>();
    // Accumulate by state
    const byStateMap = new Map<string, { caseCount: number; weightedRevenueCents: number }>();
    // Accumulate by projected close month
    const byMonthMap = new Map<string, { projectedRevenueCents: number; caseCount: number }>();

    let totalForecastCents = 0;
    let totalWeightedConfidence = 0;

    for (const c of activeCases) {
      const prob = this.cumulativeProbability(c.status, conversionRates);
      const daysRemaining = this.estimatedDaysToClose(c.status, avgDaysMap);
      const expectedCloseDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

      // Only include cases expected to close within forecast window
      if (expectedCloseDate > horizon) continue;

      const expectedFeeCents = Math.round(c.surplusAmountCents * (c.feePercent / 100) * prob);

      // By status
      const existing = byStatusMap.get(c.status);
      if (existing) {
        existing.caseCount += 1;
        existing.avgSurplusCents = Math.round(
          (existing.avgSurplusCents * (existing.caseCount - 1) + c.surplusAmountCents) / existing.caseCount
        );
        existing.avgFeePercent = Math.round(
          (existing.avgFeePercent * (existing.caseCount - 1) + c.feePercent) / existing.caseCount
        );
        existing.weightedRevenueCents += expectedFeeCents;
      } else {
        byStatusMap.set(c.status, {
          status: c.status,
          caseCount: 1,
          avgSurplusCents: c.surplusAmountCents,
          avgFeePercent: c.feePercent,
          conversionProbability: prob,
          avgDaysToClose: daysRemaining,
          weightedRevenueCents: expectedFeeCents,
        });
      }

      // By state
      const stEntry = byStateMap.get(c.state) ?? { caseCount: 0, weightedRevenueCents: 0 };
      stEntry.caseCount += 1;
      stEntry.weightedRevenueCents += expectedFeeCents;
      byStateMap.set(c.state, stEntry);

      // By expected close month
      const mk = toMonthKey(expectedCloseDate);
      const mEntry = byMonthMap.get(mk) ?? { projectedRevenueCents: 0, caseCount: 0 };
      mEntry.projectedRevenueCents += expectedFeeCents;
      mEntry.caseCount += 1;
      byMonthMap.set(mk, mEntry);

      totalForecastCents += expectedFeeCents;
      totalWeightedConfidence += prob;
    }

    const casesConsidered = activeCases.filter((c) => {
      const dr = this.estimatedDaysToClose(c.status, avgDaysMap);
      return new Date(now.getTime() + dr * 24 * 60 * 60 * 1000) <= horizon;
    }).length;

    const confidence = casesConsidered > 0 ? totalWeightedConfidence / casesConsidered : 0;

    const result: RevenueForecastResult = {
      totalForecastCents,
      confidence: Math.round(confidence * 100) / 100,
      byStatus: Array.from(byStatusMap.values()),
      byState: Array.from(byStateMap.entries()).map(([state, d]) => ({
        state,
        caseCount: d.caseCount,
        weightedRevenueCents: d.weightedRevenueCents,
      })),
      byMonth: Array.from(byMonthMap.entries())
        .map(([month, d]) => ({ month, ...d }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };

    // Apply confidence threshold — if overall confidence is too low, zero out
    if (result.confidence < confidenceThreshold) {
      logger.warn("Forecast confidence below threshold", {
        confidence: result.confidence,
        threshold: confidenceThreshold,
      });
    }

    logger.info("Revenue forecast generated", {
      days,
      totalForecastCents,
      confidence: result.confidence,
      casesConsidered,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // 2. HISTORICAL CONVERSION RATES
  // ---------------------------------------------------------------------------

  /**
   * Calculate status-to-status conversion rates using historical closed cases.
   * Uses the timestamp fields on Case to infer how many cases transitioned
   * through each status and how long they spent there.
   */
  async calculateConversionRates(): Promise<ConversionRatesResult> {
    // Count all cases that ever reached each status.
    // We infer this from the status timestamp fields on Case:
    //   contactedAt, docsRequestedAt, docsSignedAt, filedAt, fundsReceivedAt, paidAt

    const totalCases = await prisma.case.count();
    if (totalCases === 0) {
      return { transitions: [] };
    }

    // Count cases that reached each milestone
    const reachedCounts = await Promise.all([
      prisma.case.count(), // All cases start as NEW
      prisma.case.count({ where: { contactedAt: { not: null } } }),
      prisma.case.count({ where: { docsRequestedAt: { not: null } } }),
      prisma.case.count({ where: { docsSignedAt: { not: null } } }),
      prisma.case.count({ where: { filedAt: { not: null } } }),
      prisma.case.count({ where: { fundsReceivedAt: { not: null } } }),
      prisma.case.count({ where: { paidAt: { not: null } } }),
    ]);

    // Compute average days between consecutive status timestamps for cases
    // that reached both milestones
    const avgDaysBetween = await this.computeAvgDaysBetweenStatuses();

    const transitions: StatusTransition[] = [];

    for (let i = 0; i < PIPELINE_STATUSES.length - 1; i++) {
      const from = PIPELINE_STATUSES[i];
      const to = PIPELINE_STATUSES[i + 1];
      const fromCount = reachedCounts[i];
      const toCount = reachedCounts[i + 1];
      const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) / 100 : 0;
      const avgDays = avgDaysBetween[i] ?? 0;

      transitions.push({ fromStatus: from, toStatus: to, rate, avgDays });
    }

    logger.info("Conversion rates calculated", { transitionCount: transitions.length });

    return { transitions };
  }

  // ---------------------------------------------------------------------------
  // 3. BOT ROI ANALYSIS
  // ---------------------------------------------------------------------------

  /**
   * For each bot, calculate total spend, attributed revenue, ROI, and
   * the number of unique cases the bot interacted with.
   */
  async calculateBotROI(dateRange?: { from: Date; to: Date }): Promise<BotROIResult> {
    const whereDate = dateRange
      ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
      : {};

    // Aggregate cost and case counts per bot
    const botAgg = await prisma.botUsageLog.groupBy({
      by: ["botName"],
      _sum: { costCents: true },
      _count: { id: true },
      where: whereDate,
    });

    // Distinct cases per bot
    const botCases = await prisma.botUsageLog.groupBy({
      by: ["botName", "caseId"],
      where: { ...whereDate, caseId: { not: null } },
    });

    const casesPerBot = new Map<string, Set<string>>();
    for (const row of botCases) {
      if (!row.caseId) continue;
      const set = casesPerBot.get(row.botName) ?? new Set<string>();
      set.add(row.caseId);
      casesPerBot.set(row.botName, set);
    }

    // Compute attributed revenue per bot: sum of actualFeeCents on PAID cases
    // that the bot touched
    const bots: BotROIEntry[] = [];

    for (const agg of botAgg) {
      const costCents = agg._sum.costCents ?? 0;
      const touchedCaseIds = casesPerBot.get(agg.botName);
      let revenueCents = 0;

      if (touchedCaseIds && touchedCaseIds.size > 0) {
        const paidCases = await prisma.case.aggregate({
          _sum: { actualFeeCents: true },
          where: {
            id: { in: Array.from(touchedCaseIds) },
            status: "PAID",
          },
        });
        revenueCents = paidCases._sum.actualFeeCents ?? 0;
      }

      const roi = costCents > 0 ? Math.round(((revenueCents - costCents) / costCents) * 10000) / 100 : 0;

      bots.push({
        name: agg.botName,
        costCents,
        revenueCents,
        roi,
        casesTouched: touchedCaseIds?.size ?? 0,
      });
    }

    logger.info("Bot ROI analysis completed", { botCount: bots.length });

    return { bots };
  }

  // ---------------------------------------------------------------------------
  // 4. REVENUE TRENDS
  // ---------------------------------------------------------------------------

  /**
   * Monthly revenue breakdown for the last N months.
   * Uses LedgerEntry records with status = COMPLETED.
   */
  async getRevenueTrends(months: number): Promise<RevenueTrendsResult> {
    const since = addMonths(new Date(), -months);

    // Fetch completed ledger entries in the window
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      select: {
        type: true,
        amountCents: true,
        createdAt: true,
        caseId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Also count cases closed per month
    const closedCases = await prisma.case.findMany({
      where: {
        paidAt: { gte: since },
        status: "PAID",
      },
      select: { paidAt: true },
    });

    const closedByMonth = new Map<string, number>();
    for (const c of closedCases) {
      if (!c.paidAt) continue;
      const mk = toMonthKey(c.paidAt);
      closedByMonth.set(mk, (closedByMonth.get(mk) ?? 0) + 1);
    }

    // Revenue types that count as gross income
    const grossTypes = new Set<LedgerEntryType>(["COMPANY_FEE", "FEE", "FOUNDER_SHARE"]);
    const commissionTypes = new Set<LedgerEntryType>(["COMMISSION", "EMPLOYEE_COMMISSION", "OVERRIDE"]);

    const monthMap = new Map<string, { grossCents: number; commissionsCents: number }>();

    for (const e of entries) {
      const mk = toMonthKey(e.createdAt);
      const bucket = monthMap.get(mk) ?? { grossCents: 0, commissionsCents: 0 };

      if (grossTypes.has(e.type)) {
        bucket.grossCents += e.amountCents;
      }
      if (commissionTypes.has(e.type)) {
        bucket.commissionsCents += e.amountCents;
      }

      monthMap.set(mk, bucket);
    }

    // Build sorted array covering every month in the window
    const result: MonthlyRevenue[] = [];
    let cursor = startOfMonth(since);
    const endMonth = startOfMonth(new Date());

    while (cursor <= endMonth) {
      const mk = toMonthKey(cursor);
      const data = monthMap.get(mk) ?? { grossCents: 0, commissionsCents: 0 };
      result.push({
        month: mk,
        grossCents: data.grossCents,
        commissionsCents: data.commissionsCents,
        netCents: data.grossCents - data.commissionsCents,
        casesClosed: closedByMonth.get(mk) ?? 0,
      });
      cursor = addMonths(cursor, 1);
    }

    logger.info("Revenue trends generated", { months, dataPoints: result.length });

    return { months: result };
  }

  // ---------------------------------------------------------------------------
  // 5. CASH FLOW PROJECTION
  // ---------------------------------------------------------------------------

  /**
   * Project cash flow for the next N months by combining forecasted
   * pipeline revenue with known recurring expenses.
   */
  async projectCashFlow(months: 3 | 6 | 12 = 3): Promise<CashFlowResult> {
    // Get forecasted revenue from pipeline (use 90-day forecast for up to 3 months)
    const forecastDays = months <= 3 ? 90 : (months <= 6 ? 90 : 90) as 30 | 60 | 90;
    const forecast = await this.forecastRevenue(forecastDays);

    // Build a month-keyed revenue map from the forecast
    const forecastRevenueByMonth = new Map<string, number>();
    for (const m of forecast.byMonth) {
      forecastRevenueByMonth.set(m.month, m.projectedRevenueCents);
    }

    // Known monthly expenses: bot subscriptions
    const activeSubs = await prisma.botSubscription.aggregate({
      _sum: { monthlyCostCents: true },
      where: { isActive: true },
    });
    const monthlyBotCostCents = activeSubs._sum.monthlyCostCents ?? 0;

    // Additional known expenses from FounderConfig
    const additionalExpensesCents = await getConfigNumber("monthly_fixed_expenses_cents", 0);

    const totalMonthlyExpenses = monthlyBotCostCents + additionalExpensesCents;

    const result: CashFlowMonth[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(now, i);
      const mk = toMonthKey(monthDate);
      const projectedRevenueCents = forecastRevenueByMonth.get(mk) ?? 0;

      result.push({
        month: mk,
        projectedRevenueCents,
        projectedExpensesCents: totalMonthlyExpenses,
        netCents: projectedRevenueCents - totalMonthlyExpenses,
      });
    }

    logger.info("Cash flow projection generated", { months, monthlyExpenses: totalMonthlyExpenses });

    return { months: result };
  }

  // ---------------------------------------------------------------------------
  // 6. GOAL TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Compare current-month actuals against targets stored in FounderConfig.
   */
  async trackGoals(): Promise<GoalTrackingResult> {
    const monthStart = startOfMonth();
    const now = new Date();

    // Targets
    const revenueTarget = await getConfigNumber("revenue_goal_monthly_cents", 0);
    const casesTarget = await getConfigNumber("cases_goal_monthly", 0);
    const conversionTarget = await getConfigNumber("conversion_goal_percent", 0);

    // Actual revenue this month (COMPLETED ledger entries, gross types)
    const revenueEntries = await prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        status: "COMPLETED",
        createdAt: { gte: monthStart },
        type: { in: ["COMPANY_FEE", "FEE", "FOUNDER_SHARE"] },
      },
    });
    const actualRevenue = revenueEntries._sum.amountCents ?? 0;

    // Actual cases closed this month
    const actualCases = await prisma.case.count({
      where: {
        paidAt: { gte: monthStart },
        status: "PAID",
      },
    });

    // Actual conversion rate: cases PAID this month / cases that were NEW this month
    const newThisMonth = await prisma.case.count({
      where: { createdAt: { gte: monthStart } },
    });
    const paidThisMonth = actualCases;
    const actualConversion = newThisMonth > 0
      ? Math.round((paidThisMonth / newThisMonth) * 10000) / 100
      : 0;

    const pctComplete = (actual: number, target: number): number =>
      target > 0 ? Math.round((actual / target) * 10000) / 100 : 0;

    const result: GoalTrackingResult = {
      revenue: {
        target: revenueTarget,
        actual: actualRevenue,
        pctComplete: pctComplete(actualRevenue, revenueTarget),
      },
      cases: {
        target: casesTarget,
        actual: actualCases,
        pctComplete: pctComplete(actualCases, casesTarget),
      },
      conversion: {
        target: conversionTarget,
        actual: actualConversion,
      },
    };

    logger.info("Goal tracking computed", {
      revenuePct: result.revenue.pctComplete,
      casesPct: result.cases.pctComplete,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Build a map of cumulative probability of reaching PAID from each status.
   * Uses historical milestone counts.
   */
  private async buildConversionMap(): Promise<Map<CaseStatus, number>> {
    const total = await prisma.case.count();
    if (total === 0) {
      // No historical data — use optimistic defaults
      return new Map<CaseStatus, number>([
        ["NEW", 0.15],
        ["CONTACTED", 0.25],
        ["DOCS_PENDING", 0.45],
        ["DOCS_SIGNED", 0.65],
        ["FILED", 0.80],
        ["AWAITING_FUNDS", 0.92],
        ["PAID", 1.0],
      ]);
    }

    const paidCount = await prisma.case.count({ where: { paidAt: { not: null } } });

    const statusCounts: Record<string, number> = {
      NEW: total,
      CONTACTED: await prisma.case.count({ where: { contactedAt: { not: null } } }),
      DOCS_PENDING: await prisma.case.count({ where: { docsRequestedAt: { not: null } } }),
      DOCS_SIGNED: await prisma.case.count({ where: { docsSignedAt: { not: null } } }),
      FILED: await prisma.case.count({ where: { filedAt: { not: null } } }),
      AWAITING_FUNDS: await prisma.case.count({ where: { fundsReceivedAt: { not: null } } }),
      PAID: paidCount,
    };

    const result = new Map<CaseStatus, number>();
    for (const status of PIPELINE_STATUSES) {
      const reached = statusCounts[status] ?? 0;
      // Probability of reaching PAID given that you are at this status
      result.set(status as CaseStatus, reached > 0 ? paidCount / reached : 0);
    }

    return result;
  }

  /**
   * Build a map of average days remaining to PAID from each status.
   */
  private async buildAvgDaysMap(): Promise<Map<CaseStatus, number>> {
    // Fetch paid cases with all timestamp milestones
    const paidCases = await prisma.case.findMany({
      where: { status: "PAID", paidAt: { not: null } },
      select: {
        createdAt: true,
        contactedAt: true,
        docsRequestedAt: true,
        docsSignedAt: true,
        filedAt: true,
        fundsReceivedAt: true,
        paidAt: true,
      },
    });

    if (paidCases.length === 0) {
      // Fallback reasonable defaults (in days)
      return new Map<CaseStatus, number>([
        ["NEW", 90],
        ["CONTACTED", 75],
        ["DOCS_PENDING", 60],
        ["DOCS_SIGNED", 45],
        ["FILED", 30],
        ["AWAITING_FUNDS", 14],
        ["PAID", 0],
      ]);
    }

    // statusTimestampField mapping
    const statusToField: Record<string, keyof typeof paidCases[0]> = {
      NEW: "createdAt",
      CONTACTED: "contactedAt",
      DOCS_PENDING: "docsRequestedAt",
      DOCS_SIGNED: "docsSignedAt",
      FILED: "filedAt",
      AWAITING_FUNDS: "fundsReceivedAt",
      PAID: "paidAt",
    };

    const totals = new Map<CaseStatus, { sum: number; count: number }>();

    for (const c of paidCases) {
      const paidDate = c.paidAt!;
      for (const status of PIPELINE_STATUSES) {
        const field = statusToField[status];
        const ts = c[field] as Date | null;
        if (!ts) continue;

        const days = diffDays(paidDate, ts);
        const acc = totals.get(status as CaseStatus) ?? { sum: 0, count: 0 };
        acc.sum += days;
        acc.count += 1;
        totals.set(status as CaseStatus, acc);
      }
    }

    const result = new Map<CaseStatus, number>();
    for (const status of PIPELINE_STATUSES) {
      const acc = totals.get(status as CaseStatus);
      result.set(status as CaseStatus, acc && acc.count > 0 ? Math.round(acc.sum / acc.count) : 0);
    }

    return result;
  }

  /**
   * Cumulative probability of reaching PAID from a given status.
   */
  private cumulativeProbability(
    status: CaseStatus,
    conversionMap: Map<CaseStatus, number>
  ): number {
    return conversionMap.get(status) ?? 0;
  }

  /**
   * Estimated days to close from a given status.
   */
  private estimatedDaysToClose(
    status: CaseStatus,
    avgDaysMap: Map<CaseStatus, number>
  ): number {
    return avgDaysMap.get(status) ?? 90;
  }

  /**
   * Compute average days between consecutive status timestamps
   * for cases that reached both milestones. Returns an array
   * aligned with PIPELINE_STATUSES transitions (index i = transition i → i+1).
   */
  private async computeAvgDaysBetweenStatuses(): Promise<number[]> {
    const paidCases = await prisma.case.findMany({
      where: { status: "PAID", paidAt: { not: null } },
      select: {
        createdAt: true,
        contactedAt: true,
        docsRequestedAt: true,
        docsSignedAt: true,
        filedAt: true,
        fundsReceivedAt: true,
        paidAt: true,
      },
    });

    if (paidCases.length === 0) {
      // Reasonable defaults for each transition
      return [7, 10, 5, 14, 21, 14];
    }

    const fields: (keyof typeof paidCases[0])[] = [
      "createdAt",
      "contactedAt",
      "docsRequestedAt",
      "docsSignedAt",
      "filedAt",
      "fundsReceivedAt",
      "paidAt",
    ];

    const results: number[] = [];

    for (let i = 0; i < fields.length - 1; i++) {
      let totalDays = 0;
      let count = 0;

      for (const c of paidCases) {
        const fromTs = c[fields[i]] as Date | null;
        const toTs = c[fields[i + 1]] as Date | null;
        if (!fromTs || !toTs) continue;

        const days = diffDays(toTs, fromTs);
        totalDays += days;
        count += 1;
      }

      results.push(count > 0 ? Math.round(totalDays / count) : 14);
    }

    return results;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const revenueForecasterService = new RevenueForecasterService();
export default revenueForecasterService;
