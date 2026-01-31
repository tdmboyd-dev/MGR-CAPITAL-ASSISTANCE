import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();
const prisma = new PrismaClient();

interface ForecastPoint {
  date: string;
  revenue: number;
  cases: number;
  isPrediction: boolean;
}

interface ForecastResponse {
  historical: ForecastPoint[];
  predictions: ForecastPoint[];
  summary: {
    avgDailyRevenue: number;
    avgDailyCases: number;
    predictedRevenue30d: number;
    predictedCases30d: number;
    trend: "up" | "down" | "stable";
  };
}

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function getDatesArray(startDate: Date, days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

router.get("/forecast", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== "FOUNDER" && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const now = new Date();
    const daysBack = 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Get historical revenue from LedgerEntry (completed payouts)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        createdAt: { gte: startDate },
        status: "COMPLETED",
        type: { in: ["CLIENT_PAYOUT", "COMMISSION"] as any },
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get historical cases created
    const cases = await prisma.case.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate by day
    const dailyRevenue: Map<string, number> = new Map();
    const dailyCases: Map<string, number> = new Map();

    // Initialize all days with 0
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      dailyRevenue.set(dateStr, 0);
      dailyCases.set(dateStr, 0);
    }

    // Fill in actual data
    for (const entry of ledgerEntries) {
      const dateStr = entry.createdAt.toISOString().split("T")[0];
      dailyRevenue.set(dateStr, (dailyRevenue.get(dateStr) || 0) + entry.amountCents);
    }

    for (const c of cases) {
      const dateStr = c.createdAt.toISOString().split("T")[0];
      dailyCases.set(dateStr, (dailyCases.get(dateStr) || 0) + 1);
    }

    // Convert to arrays for regression
    const revenueArray = Array.from(dailyRevenue.values());
    const casesArray = Array.from(dailyCases.values());

    // Calculate linear regression
    const revenueRegression = linearRegression(revenueArray);
    const casesRegression = linearRegression(casesArray);

    // Build historical data points
    const historical: ForecastPoint[] = [];
    const dates = Array.from(dailyRevenue.keys());
    for (let i = 0; i < dates.length; i++) {
      historical.push({
        date: dates[i],
        revenue: dailyRevenue.get(dates[i]) || 0,
        cases: dailyCases.get(dates[i]) || 0,
        isPrediction: false,
      });
    }

    // Build predictions for next 30 days
    const predictions: ForecastPoint[] = [];
    const predictionStart = new Date(now);
    predictionStart.setDate(predictionStart.getDate() + 1);
    const predictionDates = getDatesArray(predictionStart, 30);

    let totalPredictedRevenue = 0;
    let totalPredictedCases = 0;

    for (let i = 0; i < 30; i++) {
      const dayIndex = daysBack + i;
      const predictedRevenue = Math.max(
        0,
        Math.round(revenueRegression.slope * dayIndex + revenueRegression.intercept)
      );
      const predictedCases = Math.max(
        0,
        Math.round(casesRegression.slope * dayIndex + casesRegression.intercept)
      );

      totalPredictedRevenue += predictedRevenue;
      totalPredictedCases += predictedCases;

      predictions.push({
        date: predictionDates[i],
        revenue: predictedRevenue,
        cases: predictedCases,
        isPrediction: true,
      });
    }

    // Calculate summary stats
    const totalRevenue = revenueArray.reduce((a, b) => a + b, 0);
    const totalCases = casesArray.reduce((a, b) => a + b, 0);
    const avgDailyRevenue = totalRevenue / daysBack;
    const avgDailyCases = totalCases / daysBack;

    // Determine trend
    let trend: "up" | "down" | "stable" = "stable";
    if (revenueRegression.slope > avgDailyRevenue * 0.01) {
      trend = "up";
    } else if (revenueRegression.slope < -avgDailyRevenue * 0.01) {
      trend = "down";
    }

    const response: ForecastResponse = {
      historical,
      predictions,
      summary: {
        avgDailyRevenue: Math.round(avgDailyRevenue),
        avgDailyCases: Math.round(avgDailyCases * 10) / 10,
        predictedRevenue30d: totalPredictedRevenue,
        predictedCases30d: totalPredictedCases,
        trend,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error("Forecast error:", error);
    res.status(500).json({ success: false, error: "Failed to generate forecast" });
  }
});

// ============================================
// CUSTOM REPORTS
// ============================================

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  type?: "cases" | "revenue" | "employees" | "training" | "all";
  status?: string;
  employeeId?: string;
  format?: "json" | "csv";
}

router.get("/reports", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== "FOUNDER" && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const filters: ReportFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: (req.query.type as ReportFilters["type"]) || "all",
      status: req.query.status as string,
      employeeId: req.query.employeeId as string,
      format: (req.query.format as "json" | "csv") || "json",
    };

    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    const reportData: Record<string, any> = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    // Cases Report
    if (filters.type === "cases" || filters.type === "all") {
      const casesWhere: any = {
        createdAt: { gte: startDate, lte: endDate },
      };
      if (filters.status) casesWhere.status = filters.status;
      if (filters.employeeId) casesWhere.assignedEmployeeId = filters.employeeId;

      const cases = await prisma.case.findMany({
        where: casesWhere,
        include: {
          assignedEmployee: { select: { id: true, name: true, email: true, employeeTier: true } },
          client: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const casesByStatus = await prisma.case.groupBy({
        by: ["status"],
        where: casesWhere,
        _count: true,
      });

      reportData.cases = {
        total: cases.length,
        byStatus: casesByStatus.map((s) => ({ status: s.status, count: s._count })),
        details: cases.map((c) => ({
          id: c.id,
          internalCode: c.internalCode,
          status: c.status,
          state: c.state,
          county: c.county,
          surplusAmountCents: c.surplusAmountCents,
          createdAt: c.createdAt,
          employee: c.assignedEmployee?.name || "Unassigned",
          client: c.client?.name || "Unknown",
        })),
      };
    }

    // Revenue Report
    if (filters.type === "revenue" || filters.type === "all") {
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
      });

      const byType = await prisma.ledgerEntry.groupBy({
        by: ["type"],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
        _sum: { amountCents: true },
        _count: true,
      });

      const totalRevenue = ledgerEntries.reduce((sum, e) => sum + e.amountCents, 0);

      reportData.revenue = {
        totalCents: totalRevenue,
        totalFormatted: `$${(totalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        transactionCount: ledgerEntries.length,
        byType: byType.map((t) => ({
          type: t.type,
          totalCents: t._sum.amountCents || 0,
          count: t._count,
        })),
      };
    }

    // Employee Performance Report
    if (filters.type === "employees" || filters.type === "all") {
      const employees = await prisma.user.findMany({
        where: {
          role: "EMPLOYEE",
          isActive: true,
        },
        include: {
          assignedCases: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
          },
          ledgerEntries: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: "COMPLETED",
            },
          },
        },
      });

      reportData.employees = {
        total: employees.length,
        details: employees.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          tier: e.employeeTier,
          casesAssigned: e.assignedCases.length,
          casesClosed: e.assignedCases.filter((c) => c.status === "PAID" || c.status === "CLOSED").length,
          earningsCents: e.ledgerEntries.reduce((sum, l) => sum + l.amountCents, 0),
        })),
      };
    }

    // Training Report
    if (filters.type === "training" || filters.type === "all") {
      const trainingProgress = await prisma.employeeTrainingProgress.findMany({
        where: {
          assignedAt: { gte: startDate, lte: endDate },
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          module: { select: { id: true, title: true } },
        },
      });

      const completedCount = trainingProgress.filter((p) => p.status === "COMPLETED").length;
      const inProgressCount = trainingProgress.filter((p) => p.status === "IN_PROGRESS").length;

      reportData.training = {
        totalProgress: trainingProgress.length,
        completed: completedCount,
        inProgress: inProgressCount,
        completionRate: trainingProgress.length > 0 ? Math.round((completedCount / trainingProgress.length) * 100) : 0,
        details: trainingProgress.map((p: any) => ({
          employee: p.employee.name,
          module: p.module.title,
          status: p.status,
          score: p.bestScore,
          completedAt: p.completedAt,
        })),
      };
    }

    // Export as CSV if requested
    if (filters.format === "csv") {
      let csvContent = "";

      // Build CSV based on report type
      if (filters.type === "cases" && reportData.cases?.details) {
        csvContent = "ID,Internal Code,Status,State,County,Surplus,Created,Employee,Client\n";
        for (const c of reportData.cases.details) {
          csvContent += `${c.id},${c.internalCode},${c.status},${c.state},${c.county},${c.surplusAmountCents / 100},${c.createdAt},${c.employee},${c.client}\n`;
        }
      } else if (filters.type === "employees" && reportData.employees?.details) {
        csvContent = "ID,Name,Email,Tier,Cases Assigned,Cases Closed,Earnings\n";
        for (const e of reportData.employees.details) {
          csvContent += `${e.id},${e.name},${e.email},${e.tier},${e.casesAssigned},${e.casesClosed},${e.earningsCents / 100}\n`;
        }
      } else if (filters.type === "training" && reportData.training?.details) {
        csvContent = "Employee,Module,Status,Score,Completed At\n";
        for (const t of reportData.training.details) {
          csvContent += `${t.employee},${t.module},${t.status},${t.score || "N/A"},${t.completedAt || "N/A"}\n`;
        }
      } else if (filters.type === "revenue" && reportData.revenue?.byType) {
        csvContent = "Type,Total (Cents),Count\n";
        for (const r of reportData.revenue.byType) {
          csvContent += `${r.type},${r.totalCents},${r.count}\n`;
        }
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=report-${filters.type}-${new Date().toISOString().split("T")[0]}.csv`);
      return res.send(csvContent);
    }

    res.json({ success: true, data: reportData });
  } catch (error) {
    console.error("Reports error:", error);
    res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});

// ============================================
// USER PERFORMANCE METRICS
// ============================================

router.get("/user-performance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== "FOUNDER" && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const userId = req.query.userId as string;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user details
    const targetUser = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, role: true, employeeTier: true },
        })
      : null;

    // Get daily activity
    const dailyActivity: { date: string; cases: number; earnings: number; training: number }[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const casesWhere: any = {
        createdAt: { gte: dayStart, lt: dayEnd },
      };
      if (userId) casesWhere.assignedEmployeeId = userId;

      const [casesCount, earningsSum, trainingCount] = await Promise.all([
        prisma.case.count({ where: casesWhere }),
        prisma.ledgerEntry.aggregate({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            status: "COMPLETED",
            ...(userId ? { userId } : {}),
          },
          _sum: { amountCents: true },
        }),
        prisma.employeeTrainingProgress.count({
          where: {
            completedAt: { gte: dayStart, lt: dayEnd },
            ...(userId ? { employeeId: userId } : {}),
          },
        }),
      ]);

      dailyActivity.push({
        date: dayStart.toISOString().split("T")[0],
        cases: casesCount,
        earnings: earningsSum._sum.amountCents || 0,
        training: trainingCount,
      });
    }

    // Get tier progression history (if user specified)
    let tierHistory: { date: string; tier: string }[] = [];
    if (userId) {
      const progressionLogs = await prisma.tierProgressionLog.findMany({
        where: { employeeId: userId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, toTier: true },
      });

      tierHistory = progressionLogs.map((log) => ({
        date: log.createdAt.toISOString().split("T")[0],
        tier: log.toTier,
      }));
    }

    res.json({
      success: true,
      data: {
        user: targetUser,
        dailyActivity,
        tierHistory,
        summary: {
          totalCases: dailyActivity.reduce((sum, d) => sum + d.cases, 0),
          totalEarnings: dailyActivity.reduce((sum, d) => sum + d.earnings, 0),
          totalTraining: dailyActivity.reduce((sum, d) => sum + d.training, 0),
        },
      },
    });
  } catch (error) {
    console.error("User performance error:", error);
    res.status(500).json({ success: false, error: "Failed to get user performance" });
  }
});

export default router;
