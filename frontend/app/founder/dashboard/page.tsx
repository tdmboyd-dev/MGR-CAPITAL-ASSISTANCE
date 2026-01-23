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
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left p-3 rounded-lg bg-muted hover:bg-accent transition-colors">
              View All Cases
            </button>
            <button className="w-full text-left p-3 rounded-lg bg-muted hover:bg-accent transition-colors">
              Run Batch Ingestion
            </button>
            <button className="w-full text-left p-3 rounded-lg bg-muted hover:bg-accent transition-colors">
              Generate Reports
            </button>
            <button className="w-full text-left p-3 rounded-lg bg-muted hover:bg-accent transition-colors">
              System Configuration
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
