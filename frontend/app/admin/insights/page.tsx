"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
} from "lucide-react";

export default function AdminInsightsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-insights"],
    queryFn: async () => {
      const { data } = await api.get("/ops/metrics");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="h-8 w-8" />
          Insights
        </h1>
        <p className="text-muted-foreground">
          Key performance metrics and business overview
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cases This Month
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.casesThisMonth || metrics?.activeCases || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              New cases opened this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Case Value
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.avgCaseValueCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average estimated recovery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.monthlyRecoveryCents || metrics?.totalRevenueCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly recovery total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employee Count
            </CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.activeEmployees || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active team members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Active Cases</span>
              <span className="font-bold">{metrics?.activeCases || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Cases Filed</span>
              <span className="font-bold">{metrics?.casesFiled || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Cases Paid</span>
              <span className="font-bold">{metrics?.casesPaid || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Pending Alerts</span>
              <span className="font-bold">{metrics?.unreadInsights || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Success Rate</span>
              <span className="font-bold">
                {metrics?.successRate ? `${metrics.successRate}%` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Avg Processing Time</span>
              <span className="font-bold">
                {metrics?.avgProcessingDays ? `${metrics.avgProcessingDays} days` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Total Clients</span>
              <span className="font-bold">{metrics?.totalClients || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Bot Automations</span>
              <span className="font-bold">{metrics?.botRuns || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
