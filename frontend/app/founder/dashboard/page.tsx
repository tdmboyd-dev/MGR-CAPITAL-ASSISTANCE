"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChartComponent,
  DonutChartComponent,
  LineChartComponent,
} from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart3,
} from "lucide-react";

export default function FounderDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await api.get("/ops/metrics");
      return data;
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["insights-unread"],
    queryFn: async () => {
      const { data } = await api.get("/ops/insights?isRead=false&limit=5");
      return data;
    },
  });

  const { data: forecast } = useQuery({
    queryKey: ["analytics-forecast"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/forecast");
      return data.data;
    },
  });

  const TrendIcon =
    forecast?.summary?.trend === "up"
      ? TrendingUp
      : forecast?.summary?.trend === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    forecast?.summary?.trend === "up"
      ? "text-green-500"
      : forecast?.summary?.trend === "down"
      ? "text-red-500"
      : "text-yellow-500";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Cases",
      value: stats?.totalCases || 0,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      title: "Active Cases",
      value: stats?.activeCases || 0,
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Total Recovered",
      value: formatCurrency(stats?.totalRecoveredCents || 0),
      icon: DollarSign,
      color: "text-emerald-500",
    },
    {
      title: "Pending Payouts",
      value: formatCurrency(stats?.pendingPayoutsCents || 0),
      icon: DollarSign,
      color: "text-yellow-500",
    },
    {
      title: "Active Employees",
      value: stats?.activeEmployees || 0,
      icon: Users,
      color: "text-purple-500",
    },
    {
      title: "Closed Won",
      value: stats?.closedWon || 0,
      icon: CheckCircle,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Founder Dashboard</h1>
        <p className="text-muted-foreground">
          Complete system overview and control center
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Forecast Summary */}
      {forecast && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              30-Day Forecast
            </CardTitle>
            <CardDescription>Based on linear regression of last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Predicted Revenue</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(forecast.summary?.predictedRevenue30d || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Predicted Cases</p>
                <p className="text-xl font-bold">{forecast.summary?.predictedCases30d || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <div className={`flex items-center gap-1 text-lg font-medium ${trendColor}`}>
                  <TrendIcon className="h-5 w-5" />
                  <span className="capitalize">{forecast.summary?.trend || "stable"}</span>
                </div>
              </div>
              <div className="flex items-end">
                <Link
                  href="/founder/ops"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  View Full Forecast <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly recovered funds</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChartComponent
              data={[
                { name: "Jan", value: 45000 },
                { name: "Feb", value: 52000 },
                { name: "Mar", value: 48000 },
                { name: "Apr", value: 61000 },
                { name: "May", value: 55000 },
                { name: "Jun", value: 67000 },
              ]}
              height={250}
              color="#22c55e"
              showArea
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case Status Distribution</CardTitle>
            <CardDescription>Current case breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChartComponent
              data={[
                { name: "New", value: stats?.newCases || 12 },
                { name: "In Progress", value: stats?.activeCases || 28 },
                { name: "Awaiting Funds", value: stats?.awaitingFunds || 15 },
                { name: "Paid", value: stats?.closedWon || 45 },
              ]}
              height={250}
              centerLabel="Total"
              centerValue={stats?.totalCases || 100}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cases by State</CardTitle>
            <CardDescription>Top performing jurisdictions</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChartComponent
              data={[
                { name: "TN", value: 24 },
                { name: "GA", value: 18 },
                { name: "FL", value: 15 },
                { name: "TX", value: 12 },
                { name: "NC", value: 9 },
              ]}
              height={250}
              color="#8b5cf6"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Recent Insights
            </CardTitle>
            <CardDescription>Unread operational alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {insights?.data?.length > 0 ? (
              <div className="space-y-3">
                {insights.data.map((insight: any) => (
                  <div
                    key={insight.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        insight.priority === "CRITICAL"
                          ? "bg-red-500"
                          : insight.priority === "HIGH"
                          ? "bg-orange-500"
                          : insight.priority === "MEDIUM"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{insight.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {insight.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No unread insights
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/founder/cases"
              className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
            >
              <span>View All Cases</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/founder/ingestion"
              className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
            >
              <span>Data Ingestion</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/founder/insights"
              className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
            >
              <span>Ops Insights</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/founder/config"
              className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
            >
              <span>Configuration</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
