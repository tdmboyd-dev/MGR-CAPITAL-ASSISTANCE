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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  Briefcase,
  Clock,
  DollarSign,
  Users,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Activity,
} from "lucide-react";

interface OpsMetrics {
  casesThisMonth: number;
  avgProcessingTimeDays: number;
  revenueThisMonthCents: number;
  employeeProductivity: number;
}

interface OpsInsight {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-blue-100 text-blue-700",
  INFO: "bg-gray-100 text-gray-700",
};

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  HIGH: AlertTriangle,
  MEDIUM: AlertTriangle,
  LOW: Lightbulb,
  INFO: Lightbulb,
};

export default function FounderInsightsPage() {
  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery<OpsMetrics>({
    queryKey: ["ops-metrics"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ops/metrics");
        return data;
      } catch {
        return {
          casesThisMonth: 0,
          avgProcessingTimeDays: 0,
          revenueThisMonthCents: 0,
          employeeProductivity: 0,
        };
      }
    },
  });

  const { data: insights, isLoading: loadingInsights, refetch: refetchInsights } = useQuery<OpsInsight[]>({
    queryKey: ["ops-insights"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ops/insights");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
  });

  const isLoading = loadingMetrics || loadingInsights;
  const metricsData = metrics || {
    casesThisMonth: 0,
    avgProcessingTimeDays: 0,
    revenueThisMonthCents: 0,
    employeeProductivity: 0,
  };
  const insightsList = insights || [];

  const handleRefresh = () => {
    refetchMetrics();
    refetchInsights();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Ops Insights
          </h1>
          <p className="text-muted-foreground">
            Operational metrics, alerts, and performance insights
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cases This Month</p>
                    <p className="text-2xl font-bold">{metricsData.casesThisMonth}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                    <p className="text-2xl font-bold">
                      {metricsData.avgProcessingTimeDays} days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue This Month</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(metricsData.revenueThisMonthCents)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employee Productivity</p>
                    <p className="text-2xl font-bold">
                      {metricsData.employeeProductivity}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Performance Summary
                </CardTitle>
                <CardDescription>
                  Key operational metrics at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Monthly Cases</span>
                    <span className="text-lg font-bold">{metricsData.casesThisMonth}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Processing Speed</span>
                    <span className="text-lg font-bold">{metricsData.avgProcessingTimeDays} days avg</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Monthly Revenue</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(metricsData.revenueThisMonthCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Team Productivity</span>
                    <span className="text-lg font-bold">{metricsData.employeeProductivity}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerts / Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  Recent Alerts & Insights
                </CardTitle>
                <CardDescription>
                  System-generated insights and alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insightsList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No alerts or insights at this time. Everything is running smoothly.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {insightsList.map((insight) => {
                      const IconComponent = SEVERITY_ICONS[insight.severity] || Lightbulb;
                      return (
                        <div
                          key={insight.id}
                          className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className={`p-2 rounded-full ${
                            insight.severity === "HIGH"
                              ? "bg-red-100"
                              : insight.severity === "MEDIUM"
                              ? "bg-yellow-100"
                              : "bg-blue-100"
                          }`}>
                            <IconComponent className={`w-4 h-4 ${
                              insight.severity === "HIGH"
                                ? "text-red-600"
                                : insight.severity === "MEDIUM"
                                ? "text-yellow-600"
                                : "text-blue-600"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{insight.title}</p>
                              <Badge className={SEVERITY_COLORS[insight.severity] || "bg-gray-100 text-gray-700"}>
                                {insight.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {insight.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
