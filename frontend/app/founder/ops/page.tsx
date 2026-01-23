"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChartComponent, BarChartComponent } from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  FileText,
  BarChart3,
  Calendar,
} from "lucide-react";

interface ForecastPoint {
  date: string;
  revenue: number;
  cases: number;
  isPrediction: boolean;
}

interface ForecastData {
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

export default function FounderOpsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-forecast"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/forecast");
      return data.data as ForecastData;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const TrendIcon =
    data?.summary.trend === "up"
      ? TrendingUp
      : data?.summary.trend === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    data?.summary.trend === "up"
      ? "text-green-500"
      : data?.summary.trend === "down"
      ? "text-red-500"
      : "text-yellow-500";

  // Combine historical and predictions for chart
  const chartData = [
    ...(data?.historical.slice(-30) || []).map((p) => ({
      name: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: p.revenue / 100,
      cases: p.cases,
      type: "historical",
    })),
    ...(data?.predictions || []).map((p) => ({
      name: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: p.revenue / 100,
      cases: p.cases,
      type: "prediction",
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="h-7 w-7 md:h-8 md:w-8" />
          Ops Dashboard & Forecast
        </h1>
        <p className="text-muted-foreground">
          Revenue and case predictions based on historical trends
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Avg Daily Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold">
              {formatCurrency(data?.summary.avgDailyRevenue || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Last 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Avg Daily Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold">
              {data?.summary.avgDailyCases?.toFixed(1) || "0"}
            </p>
            <p className="text-xs text-muted-foreground">Last 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Predicted Revenue (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold text-primary">
              {formatCurrency(data?.summary.predictedRevenue30d || 0)}
            </p>
            <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              <span>{data?.summary.trend === "up" ? "Trending up" : data?.summary.trend === "down" ? "Trending down" : "Stable"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Predicted Cases (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold text-primary">
              {data?.summary.predictedCases30d || 0}
            </p>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
          <CardDescription>
            Historical (solid) vs Predicted (dotted) — Last 30 days + Next 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChartComponent
            data={chartData}
            dataKey="revenue"
            height={350}
            color="#22c55e"
            showArea
          />
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500 rounded"></div>
              <span className="text-muted-foreground">Historical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500/50 rounded border-dashed border border-green-500"></div>
              <span className="text-muted-foreground">Predicted</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cases Forecast</CardTitle>
          <CardDescription>
            New cases per day — Historical vs Predicted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChartComponent
            data={chartData}
            dataKey="cases"
            height={300}
            color="#3b82f6"
          />
        </CardContent>
      </Card>
    </div>
  );
}
