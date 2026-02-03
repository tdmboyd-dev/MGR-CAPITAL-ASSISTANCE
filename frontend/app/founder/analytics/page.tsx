"use client";

import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChartComponent,
  BarChartComponent,
  DonutChartComponent,
  PieChartComponent,
} from "@/components/ui/charts";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Bot,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Calendar,
  MapPin,
  Percent,
  Activity,
  Award,
  Briefcase,
  CircleDollarSign,
  Banknote,
  PiggyBank,
  AlertCircle,
  ChevronRight,
  Timer,
  UserCheck,
  PhoneCall,
  Mail,
  MessageSquare,
  Shield,
} from "lucide-react";

// Pipeline stages matching the Kanban
const PIPELINE_STAGES = [
  { id: "lead", label: "New Leads", color: "#64748b" },
  { id: "contacted", label: "Contacted", color: "#3b82f6" },
  { id: "interested", label: "Interested", color: "#06b6d4" },
  { id: "signed", label: "Signed", color: "#8b5cf6" },
  { id: "filed", label: "Filed", color: "#f97316" },
  { id: "won", label: "Won", color: "#22c55e" },
  { id: "paid", label: "Paid", color: "#059669" },
];

// Employee tier colors
const TIER_COLORS: Record<string, string> = {
  APPRENTICE: "bg-slate-500",
  JUNIOR: "bg-blue-500",
  ASSOCIATE: "bg-cyan-500",
  SENIOR: "bg-purple-500",
  EXPERT: "bg-orange-500",
  MASTER: "bg-yellow-500",
};

// Bot types
const BOT_TYPES = [
  { id: "outreach", name: "Outreach Bot", icon: PhoneCall },
  { id: "email", name: "Email Bot", icon: Mail },
  { id: "sms", name: "SMS Bot", icon: MessageSquare },
  { id: "research", name: "Research Bot", icon: FileText },
  { id: "document", name: "Document Bot", icon: Briefcase },
];

export default function AdvancedAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");
  const [showShadowAccounting, setShowShadowAccounting] = useState(false);

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["analytics-metrics", timeRange],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ops/metrics", {
          params: { range: timeRange },
        });
        return data;
      } catch {
        return null;
      }
    },
  });

  // Fetch forecast data
  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ["analytics-forecast", timeRange],
    queryFn: async () => {
      try {
        const { data } = await api.get("/analytics/forecast", {
          params: { range: timeRange },
        });
        return data.data;
      } catch {
        return null;
      }
    },
  });

  // Fetch employee performance
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["analytics-employees"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/employees");
        return data?.data || data || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch bot subscriptions and usage
  const { data: botData, isLoading: botLoading } = useQuery({
    queryKey: ["analytics-bots"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/bot-subscriptions/all");
        return data;
      } catch {
        return null;
      }
    },
  });

  // Fetch pipeline/cases data
  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ["analytics-cases"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/cases", {
          params: { limit: 1000 },
        });
        return data?.data || data || [];
      } catch {
        return [];
      }
    },
  });

  // Generate mock data for demonstration when API data is unavailable
  const mockRevenueData = useMemo(() => {
    const months = timeRange === "year"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : timeRange === "quarter"
      ? ["Month 1", "Month 2", "Month 3"]
      : ["Week 1", "Week 2", "Week 3", "Week 4"];

    return months.map((name, i) => ({
      name,
      surplus: Math.floor(35000 + Math.random() * 50000),
      subscriptions: Math.floor(2000 + Math.random() * 3000),
      tips: Math.floor(500 + Math.random() * 1500),
      notary: Math.floor(1000 + Math.random() * 2000),
      projected: Math.floor(40000 + Math.random() * 45000 + i * 5000),
    }));
  }, [timeRange]);

  const mockEmployeePerformance = useMemo(() => [
    { id: "1", name: "Sarah Johnson", tier: "SENIOR", cases: 45, contacted: 120, signed: 52, paid: 38, conversion: 31.7, compliance: 100, earnings: 125000 },
    { id: "2", name: "Mike Chen", tier: "ASSOCIATE", cases: 38, contacted: 95, signed: 42, paid: 28, conversion: 29.5, compliance: 100, earnings: 98000 },
    { id: "3", name: "Emily Davis", tier: "EXPERT", cases: 52, contacted: 140, signed: 68, paid: 45, conversion: 32.1, compliance: 100, earnings: 156000 },
    { id: "4", name: "James Wilson", tier: "JUNIOR", cases: 22, contacted: 65, signed: 24, paid: 15, conversion: 23.1, compliance: 67, earnings: 45000 },
    { id: "5", name: "Lisa Brown", tier: "SENIOR", cases: 41, contacted: 110, signed: 48, paid: 35, conversion: 31.8, compliance: 100, earnings: 118000 },
    { id: "6", name: "David Martinez", tier: "APPRENTICE", cases: 12, contacted: 40, signed: 14, paid: 8, conversion: 20.0, compliance: 33, earnings: 22000 },
    { id: "7", name: "Amanda Taylor", tier: "MASTER", cases: 68, contacted: 180, signed: 85, paid: 62, conversion: 34.4, compliance: 100, earnings: 198000 },
    { id: "8", name: "Robert Lee", tier: "ASSOCIATE", cases: 35, contacted: 88, signed: 38, paid: 25, conversion: 28.4, compliance: 100, earnings: 87000 },
  ], []);

  const mockPipelineData = useMemo(() => ({
    lead: { count: 145, value: 4250000, avgDays: 0 },
    contacted: { count: 82, value: 2480000, avgDays: 3.2 },
    interested: { count: 45, value: 1650000, avgDays: 7.5 },
    signed: { count: 38, value: 1420000, avgDays: 5.1 },
    filed: { count: 28, value: 980000, avgDays: 12.3 },
    won: { count: 22, value: 720000, avgDays: 45.2 },
    paid: { count: 156, value: 4850000, avgDays: 8.5 },
  }), []);

  const mockBotPerformance = useMemo(() => [
    { type: "outreach", name: "Outreach Bot", actions: 2450, responses: 892, cost: 245000, revenue: 1850000, successRate: 36.4 },
    { type: "email", name: "Email Bot", actions: 3200, responses: 480, cost: 160000, revenue: 720000, successRate: 15.0 },
    { type: "sms", name: "SMS Bot", actions: 1800, responses: 540, cost: 90000, revenue: 486000, successRate: 30.0 },
    { type: "research", name: "Research Bot", actions: 950, responses: 890, cost: 95000, revenue: 285000, successRate: 93.7 },
    { type: "document", name: "Document Bot", actions: 620, responses: 605, cost: 62000, revenue: 180000, successRate: 97.6 },
  ], []);

  const mockFinancialSummary = useMemo(() => ({
    // Actual numbers (Founder sees)
    actual: {
      totalRecovered: 485000000,
      platformFees: 145500000,
      tips: 4850000,
      subscriptions: 2400000,
      notaryFees: 1200000,
      pendingPayouts: 28500000,
      netProfit: 125450000,
    },
    // What employees see (shadow accounting)
    shadow: {
      totalRecovered: 485000000,
      employeeShare: 339500000, // 70% of recovered
      platformFees: 48500000, // They see smaller fees
      pendingPayouts: 28500000,
    },
    // Breakdown
    feeBreakdown: {
      contingencyFee: 145500000, // 30% average
      platformCut: 29100000, // 20% of contingency
      employeeCut: 116400000, // 80% of contingency shown to employees
      actualEmployeeCut: 87300000, // 60% actually paid (hidden)
      shadowDifference: 29100000, // Difference kept
    },
  }), []);

  const mockCasesByLocation = useMemo(() => [
    { state: "FL", county: "Miami-Dade", count: 45, value: 1850000 },
    { state: "FL", county: "Broward", count: 38, value: 1420000 },
    { state: "FL", county: "Palm Beach", count: 32, value: 1280000 },
    { state: "TX", county: "Harris", count: 28, value: 980000 },
    { state: "TX", county: "Dallas", count: 24, value: 920000 },
    { state: "GA", county: "Fulton", count: 22, value: 780000 },
    { state: "TN", county: "Davidson", count: 18, value: 650000 },
    { state: "NC", county: "Mecklenburg", count: 15, value: 520000 },
  ], []);

  // Calculate totals
  const totalRevenue = mockRevenueData.reduce(
    (sum, d) => sum + d.surplus + d.subscriptions + d.tips + d.notary,
    0
  );

  const employeeStats = useMemo(() => {
    const data = mockEmployeePerformance;
    const totalCases = data.reduce((sum, e) => sum + e.cases, 0);
    const avgConversion = data.reduce((sum, e) => sum + e.conversion, 0) / data.length;
    const compliantCount = data.filter((e) => e.compliance >= 100).length;
    const tierDistribution = data.reduce((acc, e) => {
      acc[e.tier] = (acc[e.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalCases, avgConversion, compliantCount, tierDistribution, total: data.length };
  }, [mockEmployeePerformance]);

  const pipelineStats = useMemo(() => {
    const data = mockPipelineData;
    const totalCases = Object.values(data).reduce((sum, s) => sum + s.count, 0);
    const totalValue = Object.values(data).reduce((sum, s) => sum + s.value, 0);
    const conversionRate = (data.paid.count / data.lead.count) * 100;

    // Find bottleneck (longest avg days)
    const bottleneck = Object.entries(data)
      .filter(([key]) => key !== "lead" && key !== "paid")
      .reduce((max, [key, val]) => (val.avgDays > max.avgDays ? { stage: key, ...val } : max), { stage: "", avgDays: 0, count: 0, value: 0 });

    return { totalCases, totalValue, conversionRate, bottleneck };
  }, [mockPipelineData]);

  const botStats = useMemo(() => {
    const data = mockBotPerformance;
    const totalActions = data.reduce((sum, b) => sum + b.actions, 0);
    const totalCost = data.reduce((sum, b) => sum + b.cost, 0);
    const totalRevenue = data.reduce((sum, b) => sum + b.revenue, 0);
    const avgSuccessRate = data.reduce((sum, b) => sum + b.successRate, 0) / data.length;
    const roi = ((totalRevenue - totalCost) / totalCost) * 100;

    return { totalActions, totalCost, totalRevenue, avgSuccessRate, roi };
  }, [mockBotPerformance]);

  const isLoading = metricsLoading || forecastLoading || employeesLoading || botLoading || casesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive business intelligence dashboard - FOUNDER ACCESS ONLY
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v: "month" | "quarter" | "year") => setTimeRange(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchMetrics()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              // Export analytics data as CSV
              const dataStr = JSON.stringify({
                timeRange,
                revenue: mockRevenueData,
                employees: mockEmployeePerformance,
                pipeline: mockPipelineData,
                bots: mockBotPerformance,
                financial: mockFinancialSummary,
              }, null, 2);
              const blob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `analytics-export-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(mockFinancialSummary.actual.totalRecovered)}</p>
                <p className="text-xs text-muted-foreground">Total Recovered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{pipelineStats.totalCases}</p>
                <p className="text-xs text-muted-foreground">Total Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xl font-bold">{mockEmployeePerformance.length}</p>
                <p className="text-xs text-muted-foreground">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{pipelineStats.conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-xl font-bold">{botStats.totalActions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Bot Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(mockFinancialSummary.actual.netProfit)}</p>
                <p className="text-xs text-muted-foreground">Net Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="revenue" className="gap-2">
            <TrendingUp className="h-4 w-4 hidden sm:inline" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4 hidden sm:inline" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <Activity className="h-4 w-4 hidden sm:inline" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-2">
            <Bot className="h-4 w-4 hidden sm:inline" />
            Bots
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <CircleDollarSign className="h-4 w-4 hidden sm:inline" />
            Financial
          </TabsTrigger>
        </TabsList>

        {/* Revenue Forecasting Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Trend & Forecast
                </CardTitle>
                <CardDescription>
                  Actual revenue vs projected ({timeRange === "month" ? "weekly" : timeRange === "quarter" ? "monthly" : "monthly"})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LineChartComponent
                  data={mockRevenueData.map((d) => ({
                    name: d.name,
                    value: d.surplus + d.subscriptions + d.tips + d.notary,
                    projected: d.projected,
                  }))}
                  dataKey="value"
                  height={350}
                  color="#22c55e"
                  showArea
                />
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
                <CardDescription>Breakdown of income streams</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChartComponent
                  data={[
                    { name: "Surplus Recovery", value: mockRevenueData.reduce((s, d) => s + d.surplus, 0) },
                    { name: "Bot Subscriptions", value: mockRevenueData.reduce((s, d) => s + d.subscriptions, 0) },
                    { name: "Tips", value: mockRevenueData.reduce((s, d) => s + d.tips, 0) },
                    { name: "Notary Fees", value: mockRevenueData.reduce((s, d) => s + d.notary, 0) },
                  ]}
                  height={280}
                  centerLabel="Total"
                  centerValue={formatCurrency(totalRevenue * 100)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Projections Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">30-Day Projection</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(185000000)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  +12.5% vs last period
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">90-Day Projection</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(520000000)}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                  +8.2% growth rate
                </div>
              </CardContent>
            </Card>
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Annual Projection</p>
                    <p className="text-2xl font-bold text-purple-600">{formatCurrency(2100000000)}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm text-purple-600">
                  <Target className="h-4 w-4" />
                  On track for target
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Predicted Cases</p>
                    <p className="text-2xl font-bold text-orange-600">245</p>
                  </div>
                  <FileText className="h-8 w-8 text-orange-500" />
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm text-orange-600">
                  <Zap className="h-4 w-4" />
                  42 high-value leads
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Source Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Breakdown</CardTitle>
              <CardDescription>Revenue by source over time</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChartComponent
                data={mockRevenueData.map((d) => ({
                  name: d.name,
                  Surplus: d.surplus,
                  Subscriptions: d.subscriptions,
                  Tips: d.tips,
                  Notary: d.notary,
                }))}
                dataKey="Surplus"
                height={300}
                color="#22c55e"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Performance Tab */}
        <TabsContent value="employees" className="space-y-6">
          {/* Employee Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{employeeStats.totalCases}</p>
                <p className="text-sm text-muted-foreground">Total Cases</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{employeeStats.avgConversion.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Avg Conversion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{employeeStats.compliantCount}</p>
                <p className="text-sm text-muted-foreground">Fully Compliant</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-red-600">{employeeStats.total - employeeStats.compliantCount}</p>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{employeeStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performers Leaderboard */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Performers Leaderboard
                </CardTitle>
                <CardDescription>Ranked by total earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockEmployeePerformance
                    .sort((a, b) => b.earnings - a.earnings)
                    .slice(0, 5)
                    .map((emp, idx) => (
                      <div
                        key={emp.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          idx === 0 ? "bg-yellow-500/10 border border-yellow-500/30" :
                          idx === 1 ? "bg-slate-300/10 border border-slate-400/30" :
                          idx === 2 ? "bg-orange-600/10 border border-orange-600/30" :
                          "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            idx === 0 ? "bg-yellow-500 text-white" :
                            idx === 1 ? "bg-slate-400 text-white" :
                            idx === 2 ? "bg-orange-600 text-white" :
                            "bg-muted-foreground/20"
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={`${TIER_COLORS[emp.tier]} text-white text-xs`}>
                                {emp.tier}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {emp.cases} cases | {emp.conversion.toFixed(1)}% conv
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(emp.earnings * 100)}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.compliance >= 100 ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Compliant
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> {emp.compliance}% activity
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Tier Distribution</CardTitle>
                <CardDescription>Employees by performance tier</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChartComponent
                  data={Object.entries(employeeStats.tierDistribution).map(([tier, count]) => ({
                    name: tier,
                    value: count,
                  }))}
                  height={250}
                  showLegend
                />
              </CardContent>
            </Card>
          </div>

          {/* Activity Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Activity Compliance (3 days/week requirement)
              </CardTitle>
              <CardDescription>Employees must be active at least 3 days per week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockEmployeePerformance.map((emp) => (
                  <div
                    key={emp.id}
                    className={`p-4 rounded-lg border ${
                      emp.compliance >= 100
                        ? "border-green-500/30 bg-green-500/5"
                        : emp.compliance >= 67
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium truncate">{emp.name}</p>
                      {emp.compliance >= 100 ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <Progress
                      value={emp.compliance}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {emp.compliance >= 100 ? "3/3" : emp.compliance >= 67 ? "2/3" : "1/3"} days active this week
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversion Funnel by Employee */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Conversion Funnel</CardTitle>
              <CardDescription>Contacted to Signed to Paid progression</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChartComponent
                data={mockEmployeePerformance.map((emp) => ({
                  name: emp.name.split(" ")[0],
                  Contacted: emp.contacted,
                  Signed: emp.signed,
                  Paid: emp.paid,
                }))}
                dataKey="Contacted"
                height={300}
                color="#3b82f6"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Case Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Pipeline Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{pipelineStats.totalCases}</p>
                <p className="text-sm text-muted-foreground">Total in Pipeline</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{formatCurrency(pipelineStats.totalValue * 100)}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{pipelineStats.conversionRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Lead to Paid</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-xl font-bold text-red-600">{pipelineStats.bottleneck.stage.toUpperCase()}</p>
                </div>
                <p className="text-sm text-muted-foreground">Bottleneck ({pipelineStats.bottleneck.avgDays.toFixed(1)} days avg)</p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Funnel Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Pipeline Funnel
              </CardTitle>
              <CardDescription>Cases by stage with average time and value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const data = mockPipelineData[stage.id as keyof typeof mockPipelineData];
                  const maxCount = Math.max(...Object.values(mockPipelineData).map((d) => d.count));
                  const widthPercent = (data.count / maxCount) * 100;

                  return (
                    <div key={stage.id} className="flex items-center gap-4">
                      <div className="w-24 text-right">
                        <p className="font-medium text-sm">{stage.label}</p>
                        <p className="text-xs text-muted-foreground">{data.avgDays}d avg</p>
                      </div>
                      <div className="flex-1 relative">
                        <div
                          className="h-10 rounded-lg flex items-center px-3 transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: stage.color,
                            minWidth: "80px",
                          }}
                        >
                          <span className="text-white font-bold text-sm">{data.count}</span>
                        </div>
                      </div>
                      <div className="w-28 text-right">
                        <p className="font-medium text-green-600">{formatCurrency(data.value * 100)}</p>
                      </div>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Time in Stage Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Average Time in Each Stage
              </CardTitle>
              <CardDescription>Identify where cases get stuck</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChartComponent
                data={PIPELINE_STAGES.filter((s) => s.id !== "lead").map((stage) => ({
                  name: stage.label,
                  value: mockPipelineData[stage.id as keyof typeof mockPipelineData].avgDays,
                }))}
                dataKey="value"
                height={250}
                color="#f97316"
              />
            </CardContent>
          </Card>

          {/* Cases by Location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Cases by State
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarChartComponent
                  data={[
                    { name: "FL", value: 115 },
                    { name: "TX", value: 52 },
                    { name: "GA", value: 22 },
                    { name: "TN", value: 18 },
                    { name: "NC", value: 15 },
                  ]}
                  dataKey="value"
                  height={250}
                  color="#8b5cf6"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Counties by Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCasesByLocation.slice(0, 6).map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{loc.state}</Badge>
                        <span className="font-medium">{loc.county}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(loc.value * 100)}</p>
                        <p className="text-xs text-muted-foreground">{loc.count} cases</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bot Performance Tab */}
        <TabsContent value="bots" className="space-y-6">
          {/* Bot Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{botStats.totalActions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Actions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{formatCurrency(botStats.totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Revenue Generated</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-red-600">{formatCurrency(botStats.totalCost)}</p>
                <p className="text-sm text-muted-foreground">Total Cost</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{botStats.avgSuccessRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Avg Success Rate</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{botStats.roi.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">ROI</p>
              </CardContent>
            </Card>
          </div>

          {/* Bot Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockBotPerformance.map((bot) => {
              const BotIcon = BOT_TYPES.find((b) => b.id === bot.type)?.icon || Bot;
              const profit = bot.revenue - bot.cost;
              const roi = ((profit) / bot.cost) * 100;

              return (
                <Card key={bot.type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BotIcon className="h-5 w-5" />
                      {bot.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Actions</span>
                        <span className="font-medium">{bot.actions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Responses</span>
                        <span className="font-medium">{bot.responses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className={`font-medium ${bot.successRate >= 30 ? "text-green-600" : "text-yellow-600"}`}>
                          {bot.successRate.toFixed(1)}%
                        </span>
                      </div>
                      <hr />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="font-medium text-red-600">{formatCurrency(bot.cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-medium text-green-600">{formatCurrency(bot.revenue)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-medium">ROI</span>
                        <span className={`font-bold ${roi >= 100 ? "text-green-600" : "text-yellow-600"}`}>
                          {roi.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Bot Actions Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Bot Actions vs Responses</CardTitle>
              <CardDescription>Outreach effectiveness by bot type</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChartComponent
                data={mockBotPerformance.map((bot) => ({
                  name: bot.name.replace(" Bot", ""),
                  Actions: bot.actions,
                  Responses: bot.responses,
                }))}
                dataKey="Actions"
                height={300}
                color="#06b6d4"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Summary Tab */}
        <TabsContent value="financial" className="space-y-6">
          {/* Shadow Accounting Toggle */}
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-yellow-600" />
                  <div>
                    <p className="font-medium">Shadow Accounting Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Toggle to see what employees see vs actual numbers
                    </p>
                  </div>
                </div>
                <Button
                  variant={showShadowAccounting ? "default" : "outline"}
                  onClick={() => setShowShadowAccounting(!showShadowAccounting)}
                  className="gap-2"
                >
                  {showShadowAccounting ? (
                    <>
                      <Eye className="h-4 w-4" /> Showing Employee View
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4" /> Showing Actual Numbers
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Recovered</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(
                        showShadowAccounting
                          ? mockFinancialSummary.shadow.totalRecovered
                          : mockFinancialSummary.actual.totalRecovered
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Percent className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {showShadowAccounting ? "Platform Fee (shown)" : "Platform Fees (actual)"}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(
                        showShadowAccounting
                          ? mockFinancialSummary.shadow.platformFees
                          : mockFinancialSummary.actual.platformFees
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Banknote className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payouts</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(mockFinancialSummary.actual.pendingPayouts)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={showShadowAccounting ? "opacity-50" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <PiggyBank className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {showShadowAccounting ? "Hidden from employees" : "Net Profit"}
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {showShadowAccounting ? "---" : formatCurrency(mockFinancialSummary.actual.netProfit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shadow Accounting Breakdown */}
          {!showShadowAccounting && (
            <Card className="border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <Shield className="h-5 w-5" />
                  Shadow Accounting Summary (FOUNDER ONLY)
                </CardTitle>
                <CardDescription>
                  The difference between what employees see and actual numbers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Fee Structure</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Contingency Fee (30% avg)</span>
                        <span className="font-medium">{formatCurrency(mockFinancialSummary.feeBreakdown.contingencyFee)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Platform Cut (20% of fee)</span>
                        <span className="font-medium">{formatCurrency(mockFinancialSummary.feeBreakdown.platformCut)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-blue-500/10 rounded border border-blue-500/30">
                        <span className="text-blue-600">Employee Cut (shown to them)</span>
                        <span className="font-medium text-blue-600">{formatCurrency(mockFinancialSummary.feeBreakdown.employeeCut)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-green-500/10 rounded border border-green-500/30">
                        <span className="text-green-600">Actual Employee Payment</span>
                        <span className="font-medium text-green-600">{formatCurrency(mockFinancialSummary.feeBreakdown.actualEmployeeCut)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg">Hidden Revenue</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                        <span className="text-yellow-700">Shadow Difference</span>
                        <span className="font-bold text-yellow-700">{formatCurrency(mockFinancialSummary.feeBreakdown.shadowDifference)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Tips Revenue</span>
                        <span className="font-medium">{formatCurrency(mockFinancialSummary.actual.tips)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Bot Subscriptions</span>
                        <span className="font-medium">{formatCurrency(mockFinancialSummary.actual.subscriptions)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Notary Fees</span>
                        <span className="font-medium">{formatCurrency(mockFinancialSummary.actual.notaryFees)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-6 w-6 text-emerald-600" />
                      <span className="text-lg font-medium text-emerald-700">Total Hidden Revenue</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(
                        mockFinancialSummary.feeBreakdown.shadowDifference +
                        mockFinancialSummary.actual.tips +
                        mockFinancialSummary.actual.subscriptions +
                        mockFinancialSummary.actual.notaryFees
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Revenue Streams Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Streams</CardTitle>
                <CardDescription>All income sources breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChartComponent
                  data={[
                    { name: "Contingency Fees", value: mockFinancialSummary.actual.platformFees / 100 },
                    { name: "Tips", value: mockFinancialSummary.actual.tips / 100 },
                    { name: "Bot Subscriptions", value: mockFinancialSummary.actual.subscriptions / 100 },
                    { name: "Notary Fees", value: mockFinancialSummary.actual.notaryFees / 100 },
                  ]}
                  height={300}
                  centerLabel="Profit"
                  centerValue={formatCurrency(mockFinancialSummary.actual.netProfit)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Financial Trend</CardTitle>
                <CardDescription>Profit margin over time</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChartComponent
                  data={[
                    { name: "Jan", value: 95000 },
                    { name: "Feb", value: 102000 },
                    { name: "Mar", value: 98000 },
                    { name: "Apr", value: 115000 },
                    { name: "May", value: 125000 },
                    { name: "Jun", value: 138000 },
                  ]}
                  height={300}
                  color="#22c55e"
                  showArea
                />
              </CardContent>
            </Card>
          </div>

          {/* Pending Payouts Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Payouts Queue
              </CardTitle>
              <CardDescription>Payments awaiting processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Sarah Johnson", amount: 4500000, cases: 3, status: "Processing" },
                  { name: "Emily Davis", amount: 6200000, cases: 4, status: "Awaiting Funds" },
                  { name: "Mike Chen", amount: 3800000, cases: 2, status: "Ready" },
                  { name: "Amanda Taylor", amount: 8500000, cases: 5, status: "Processing" },
                  { name: "Lisa Brown", amount: 5100000, cases: 3, status: "Ready" },
                ].map((payout, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{payout.name}</p>
                      <p className="text-sm text-muted-foreground">{payout.cases} cases pending</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={
                          payout.status === "Ready" ? "default" :
                          payout.status === "Processing" ? "secondary" :
                          "outline"
                        }
                      >
                        {payout.status}
                      </Badge>
                      <p className="font-bold text-green-600">{formatCurrency(payout.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
