import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

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
        type: { in: ["PAYOUT", "COMMISSION"] },
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

export default router;
