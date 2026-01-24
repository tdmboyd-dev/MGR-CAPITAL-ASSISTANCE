"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChartComponent, BarChartComponent } from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import {
  FileSpreadsheet,
  Download,
  TrendingUp,
  Users,
  Briefcase,
  GraduationCap,
  DollarSign,
  Calendar,
  RefreshCw,
} from "lucide-react";

interface ReportData {
  generatedAt: string;
  period: { start: string; end: string };
  cases?: {
    total: number;
    byStatus: { status: string; count: number }[];
    details: any[];
  };
  revenue?: {
    totalCents: number;
    totalFormatted: string;
    transactionCount: number;
    byType: { type: string; totalCents: number; count: number }[];
  };
  employees?: {
    total: number;
    details: any[];
  };
  training?: {
    totalProgress: number;
    completed: number;
    inProgress: number;
    completionRate: number;
    details: any[];
  };
}

interface UserPerformanceData {
  user: any;
  dailyActivity: { date: string; cases: number; earnings: number; training: number }[];
  tierHistory: { date: string; tier: string }[];
  summary: { totalCases: number; totalEarnings: number; totalTraining: number };
}

export default function FounderAnalyticsPage() {
  const [reportType, setReportType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch report data
  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useQuery({
    queryKey: ["analytics-report", reportType, startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get("/analytics/reports", {
        params: { type: reportType, startDate, endDate },
      });
      return data.data as ReportData;
    },
  });

  // Fetch employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data } = await api.get("/employees");
      return data.data as { id: string; name: string; email: string }[];
    },
  });

  // Fetch user performance
  const { data: userPerf, isLoading: userPerfLoading } = useQuery({
    queryKey: ["user-performance", selectedUserId],
    queryFn: async () => {
      const { data } = await api.get("/analytics/user-performance", {
        params: { userId: selectedUserId || undefined, days: 30 },
      });
      return data.data as UserPerformanceData;
    },
    enabled: true,
  });

  const handleExportCSV = async (type: string) => {
    try {
      const response = await api.get("/analytics/reports", {
        params: { type, startDate, endDate, format: "csv" },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${type}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // Prepare chart data for user performance
  const activityChartData = userPerf?.dailyActivity.map((d) => ({
    name: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cases: d.cases,
    earnings: d.earnings / 100,
    training: d.training,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <FileSpreadsheet className="h-7 w-7 md:h-8 md:w-8" />
          Analytics & Reports
        </h1>
        <p className="text-muted-foreground">
          Generate custom reports and analyze user performance
        </p>
      </div>

      {/* Report Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Builder
          </CardTitle>
          <CardDescription>
            Select filters and generate custom reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="reportType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Data</SelectItem>
                  <SelectItem value="cases">Cases</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => refetchReport()} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportCSV(reportType)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Report Summary Cards */}
          {reportLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : reportData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {reportData.cases && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{reportData.cases.total}</p>
                        <p className="text-xs text-muted-foreground">Total Cases</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {reportData.revenue && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{reportData.revenue.totalFormatted}</p>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {reportData.employees && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">{reportData.employees.total}</p>
                        <p className="text-xs text-muted-foreground">Active Employees</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {reportData.training && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{reportData.training.completionRate}%</p>
                        <p className="text-xs text-muted-foreground">Training Completion</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}

          {/* Cases by Status Chart */}
          {reportData?.cases?.byStatus && reportData.cases.byStatus.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Cases by Status</h3>
              <BarChartComponent
                data={reportData.cases.byStatus.map((s) => ({
                  name: s.status.replace(/_/g, " "),
                  value: s.count,
                }))}
                dataKey="value"
                height={250}
                color="#3b82f6"
              />
            </div>
          )}

          {/* Revenue by Type Chart */}
          {reportData?.revenue?.byType && reportData.revenue.byType.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Revenue by Type</h3>
              <BarChartComponent
                data={reportData.revenue.byType.map((r) => ({
                  name: r.type.replace(/_/g, " "),
                  value: r.totalCents / 100,
                }))}
                dataKey="value"
                height={250}
                color="#22c55e"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            User Performance
          </CardTitle>
          <CardDescription>
            Track individual or overall user activity over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="userSelect">Select User (optional)</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="userSelect" className="w-full md:w-64">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Users</SelectItem>
                {employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userPerfLoading ? (
            <Skeleton className="h-64" />
          ) : userPerf ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{userPerf.summary.totalCases}</p>
                    <p className="text-xs text-muted-foreground">Cases (30d)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">
                      {formatCurrency(userPerf.summary.totalEarnings)}
                    </p>
                    <p className="text-xs text-muted-foreground">Earnings (30d)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{userPerf.summary.totalTraining}</p>
                    <p className="text-xs text-muted-foreground">Training Completed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Chart */}
              <h3 className="text-lg font-semibold mb-4">Daily Activity (Last 30 Days)</h3>
              <LineChartComponent
                data={activityChartData}
                dataKey="cases"
                height={300}
                color="#3b82f6"
                showArea
              />

              {/* Tier History */}
              {userPerf.tierHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Tier Progression History</h3>
                  <div className="space-y-2">
                    {userPerf.tierHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="font-medium">
                          {entry.tier.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No performance data available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
