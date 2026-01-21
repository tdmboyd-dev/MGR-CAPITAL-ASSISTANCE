// ============================================
// FOUNDER CONSOLE — MGR CAPITAL ASSISTANCE
// OPS LAYER: Command center for system oversight
// FOUNDER ONLY — Never expose to employees/clients
// ============================================

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DashboardSummary {
  totalCases: number;
  activeCases: number;
  totalPayoutsCents: number;
  pendingAlerts: number;
  employeeCount: number;
}

interface RecentActivity {
  newCases24h: number;
  payoutsProcessed24h: number;
  alertsCreated24h: number;
  documentsUploaded24h: number;
}

interface AlertCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface OpsDashboard {
  summary: DashboardSummary;
  recentActivity: RecentActivity;
  topMetrics: {
    conversionRate: number;
    avgCaseValueCents: number;
    avgProcessingDays: number;
  };
  alerts: AlertCounts;
}

interface WatchAlert {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  state?: string;
  county?: string;
  isResolved: boolean;
  createdAt: string;
}

interface FocusFeedItem {
  id: string;
  type: string;
  priority: number;
  title: string;
  summary: string;
  actionRequired: boolean;
  createdAt: string;
}

interface EmployeeIntegrity {
  employeeId: string;
  employeeName: string;
  integrityScore: number;
  casesHandled: number;
  successRate: number;
  flags: string[];
}

interface HeatmapEntry {
  state: string;
  county: string | null;
  caseCount: number;
  totalValueCents: number;
  riskScore: number;
  trend: "UP" | "DOWN" | "STABLE";
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "text-red-500 bg-red-900/30 border-red-600";
    case "HIGH": return "text-orange-500 bg-orange-900/30 border-orange-600";
    case "MEDIUM": return "text-amber-500 bg-amber-900/30 border-amber-600";
    case "LOW": return "text-blue-400 bg-blue-900/20 border-blue-600";
    default: return "text-slate-400 bg-slate-800 border-slate-600";
  }
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case "UP": return "↑";
    case "DOWN": return "↓";
    default: return "→";
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case "UP": return "text-red-400";
    case "DOWN": return "text-emerald-400";
    default: return "text-slate-400";
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FounderConsole() {
  // State
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [focusFeed, setFocusFeed] = useState<FocusFeedItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeIntegrity[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "alerts" | "scraper" | "employees" | "heatmap">("overview");
  const [scraperRunning, setScraperRunning] = useState(false);
  const [watchRunning, setWatchRunning] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, alertsRes, focusRes, employeesRes, heatmapRes] = await Promise.all([
        api.get<any>("/ops/metrics/dashboard"),
        api.get<any>("/ops/watch/alerts?isResolved=false&limit=20"),
        api.get<any>("/ops/metrics/focus-feed?limit=10"),
        api.get<any>("/ops/metrics/employees/integrity"),
        api.get<any>("/ops/metrics/heatmap")
      ]);

      if (dashboardRes.data.success) setDashboard(dashboardRes.data.data);
      if (alertsRes.data.success) setAlerts(alertsRes.data.data.alerts || []);
      if (focusRes.data.success) setFocusFeed(focusRes.data.data.items || []);
      if (employeesRes.data.success) setEmployees(employeesRes.data.data.scores || []);
      if (heatmapRes.data.success) setHeatmap(heatmapRes.data.data.entries || []);
    } catch (err: any) {
      setError(err.message || "Failed to load ops data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // ACTIONS
  // ============================================

  async function runScraper() {
    try {
      setScraperRunning(true);
      await api.post<any>("/ops/watch/scraper/run", {});
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Scraper failed");
    } finally {
      setScraperRunning(false);
    }
  }

  async function runWatch() {
    try {
      setWatchRunning(true);
      await api.post<any>("/ops/watch/run", {});
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Watch cycle failed");
    } finally {
      setWatchRunning(false);
    }
  }

  async function runFullCycle() {
    try {
      setScraperRunning(true);
      setWatchRunning(true);
      await api.post<any>("/ops/watch/cycle", {});
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Full cycle failed");
    } finally {
      setScraperRunning(false);
      setWatchRunning(false);
    }
  }

  async function resolveAlert(alertId: string) {
    try {
      await api.post<any>(`/ops/watch/alerts/${alertId}/resolve`, {});
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err: any) {
      setError(err.message || "Failed to resolve alert");
    }
  }

  async function dismissFocusItem(itemId: string) {
    try {
      await api.post<any>(`/ops/metrics/focus-feed/${itemId}/dismiss`, {});
      setFocusFeed(prev => prev.filter(i => i.id !== itemId));
    } catch (err: any) {
      setError(err.message || "Failed to dismiss item");
    }
  }

  // ============================================
  // RENDER: Loading/Error States
  // ============================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading Ops Console...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <AdminLayout>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
          >
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  // ============================================
  // RENDER: Main Console
  // ============================================

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Founder Command Console</h1>
          <p className="text-sm text-slate-400">OPS Layer — System monitoring and control</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runFullCycle}
            disabled={scraperRunning || watchRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded font-medium"
          >
            {scraperRunning || watchRunning ? "Running..." : "Run Full Cycle"}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-500 rounded-lg p-3 flex items-center justify-between">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        {(["overview", "alerts", "scraper", "employees", "heatmap"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && dashboard && (
        <div className="space-y-6">
          {/* Critical Alerts Banner */}
          {dashboard.alerts.critical > 0 && (
            <div className="bg-red-900/40 border-2 border-red-500 rounded-lg p-4 flex items-center gap-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <p className="text-red-400 font-bold text-lg">
                  {dashboard.alerts.critical} CRITICAL ALERT{dashboard.alerts.critical > 1 ? "S" : ""}
                </p>
                <p className="text-red-300 text-sm">Immediate attention required</p>
              </div>
              <button
                onClick={() => setActiveTab("alerts")}
                className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
              >
                View Alerts
              </button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Total Cases</p>
              <p className="text-2xl font-bold">{dashboard.summary.totalCases}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Active Cases</p>
              <p className="text-2xl font-bold text-emerald-400">{dashboard.summary.activeCases}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Total Payouts</p>
              <p className="text-2xl font-bold">{formatCurrency(dashboard.summary.totalPayoutsCents)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Pending Alerts</p>
              <p className={`text-2xl font-bold ${dashboard.summary.pendingAlerts > 0 ? "text-amber-400" : "text-slate-400"}`}>
                {dashboard.summary.pendingAlerts}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Employees</p>
              <p className="text-2xl font-bold">{dashboard.summary.employeeCount}</p>
            </div>
          </div>

          {/* Activity & Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 24h Activity */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Last 24 Hours</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-sm text-slate-400">New Cases</p>
                  <p className="text-xl font-semibold text-emerald-400">+{dashboard.recentActivity.newCases24h}</p>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-sm text-slate-400">Payouts</p>
                  <p className="text-xl font-semibold">{dashboard.recentActivity.payoutsProcessed24h}</p>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-sm text-slate-400">New Alerts</p>
                  <p className={`text-xl font-semibold ${dashboard.recentActivity.alertsCreated24h > 0 ? "text-amber-400" : ""}`}>
                    {dashboard.recentActivity.alertsCreated24h}
                  </p>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-sm text-slate-400">Documents</p>
                  <p className="text-xl font-semibold">{dashboard.recentActivity.documentsUploaded24h}</p>
                </div>
              </div>
            </div>

            {/* Alert Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Alert Summary</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-900/20 rounded">
                  <span className="text-red-400">Critical</span>
                  <span className="font-bold text-red-400">{dashboard.alerts.critical}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-orange-900/20 rounded">
                  <span className="text-orange-400">High</span>
                  <span className="font-bold text-orange-400">{dashboard.alerts.high}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-amber-900/20 rounded">
                  <span className="text-amber-400">Medium</span>
                  <span className="font-bold text-amber-400">{dashboard.alerts.medium}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-900/20 rounded">
                  <span className="text-blue-400">Low</span>
                  <span className="font-bold text-blue-400">{dashboard.alerts.low}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Focus Feed */}
          {focusFeed.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Founder Focus Feed</h2>
              <div className="space-y-2">
                {focusFeed.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border flex items-start justify-between ${
                      item.actionRequired
                        ? "bg-amber-900/20 border-amber-600"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-lg ${item.priority >= 8 ? "text-red-400" : item.priority >= 5 ? "text-amber-400" : "text-slate-400"}`}>
                        {item.priority >= 8 ? "🔴" : item.priority >= 5 ? "🟡" : "🔵"}
                      </span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-slate-400">{item.summary}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => dismissFocusItem(item.id)}
                      className="text-slate-400 hover:text-white px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ALERTS TAB */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Alerts ({alerts.length})</h2>
            <button
              onClick={runWatch}
              disabled={watchRunning}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded"
            >
              {watchRunning ? "Running..." : "Run Watch Cycle"}
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-slate-400">{alert.type.replace(/_/g, " ")}</span>
                      </div>
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                      {(alert.state || alert.county) && (
                        <p className="text-xs text-slate-500 mt-2">
                          Location: {alert.state}{alert.county ? ` — ${alert.county}` : ""}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">{formatDate(alert.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SCRAPER TAB */}
      {activeTab === "scraper" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => api.post("/ops/watch/scraper/county-surplus", {})}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-emerald-600 transition-colors text-left"
            >
              <p className="font-semibold mb-1">County Surplus</p>
              <p className="text-sm text-slate-400">Scrape county surplus pages</p>
            </button>
            <button
              onClick={() => api.post("/ops/watch/scraper/state-rules", {})}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-emerald-600 transition-colors text-left"
            >
              <p className="font-semibold mb-1">State Rules</p>
              <p className="text-sm text-slate-400">Scrape state regulations</p>
            </button>
            <button
              onClick={() => api.post("/ops/watch/scraper/tax-sales", {})}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-emerald-600 transition-colors text-left"
            >
              <p className="font-semibold mb-1">Tax Sales</p>
              <p className="text-sm text-slate-400">Scrape tax sale lists</p>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Detection Controls</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={() => api.post("/ops/watch/detect/rule-changes", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Rule Changes
              </button>
              <button
                onClick={() => api.post("/ops/watch/detect/document-patterns", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Doc Patterns
              </button>
              <button
                onClick={() => api.post("/ops/watch/detect/deadline-changes", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Deadline Changes
              </button>
              <button
                onClick={() => api.post("/ops/watch/detect/ingestion-risks", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Ingestion Risks
              </button>
              <button
                onClick={() => api.post("/ops/watch/detect/payout-anomalies", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Payout Anomalies
              </button>
              <button
                onClick={() => api.post("/ops/watch/detect/employee-anomalies", {})}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Detect Employee Anomalies
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Full Operations</h2>
            <div className="flex gap-4">
              <button
                onClick={runScraper}
                disabled={scraperRunning}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded font-medium"
              >
                {scraperRunning ? "Running..." : "Run Full Scrape"}
              </button>
              <button
                onClick={runWatch}
                disabled={watchRunning}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 rounded font-medium"
              >
                {watchRunning ? "Running..." : "Run Full Watch"}
              </button>
              <button
                onClick={runFullCycle}
                disabled={scraperRunning || watchRunning}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded font-medium"
              >
                {scraperRunning || watchRunning ? "Running..." : "Run Complete Cycle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEES TAB */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Employee Integrity Scores</h2>

          {employees.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No employee data available</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Employee</th>
                    <th className="p-3 text-center">Integrity Score</th>
                    <th className="p-3 text-center">Cases</th>
                    <th className="p-3 text-center">Success Rate</th>
                    <th className="p-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.employeeId} className="border-t border-slate-800">
                      <td className="p-3 font-medium">{emp.employeeName}</td>
                      <td className="p-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          emp.integrityScore >= 80 ? "bg-emerald-900/50 text-emerald-400" :
                          emp.integrityScore >= 60 ? "bg-amber-900/50 text-amber-400" :
                          "bg-red-900/50 text-red-400"
                        }`}>
                          {emp.integrityScore}
                        </span>
                      </td>
                      <td className="p-3 text-center">{emp.casesHandled}</td>
                      <td className="p-3 text-center">{emp.successRate}%</td>
                      <td className="p-3">
                        {emp.flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.flags.map((flag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400 rounded"
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HEATMAP TAB */}
      {activeTab === "heatmap" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Case Heatmap by Jurisdiction</h2>

          {heatmap.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No heatmap data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {heatmap.slice(0, 12).map((entry, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-900 border rounded-lg p-4 ${
                    entry.riskScore >= 70 ? "border-red-600" :
                    entry.riskScore >= 40 ? "border-amber-600" :
                    "border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-lg text-emerald-400">
                      {entry.state}
                    </span>
                    <span className={`text-lg ${getTrendColor(entry.trend)}`}>
                      {getTrendIcon(entry.trend)}
                    </span>
                  </div>
                  {entry.county && (
                    <p className="text-sm text-slate-400 mb-2">{entry.county}</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{entry.caseCount} cases</span>
                    <span className="font-semibold">{formatCurrency(entry.totalValueCents)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Risk:</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          entry.riskScore >= 70 ? "bg-red-500" :
                          entry.riskScore >= 40 ? "bg-amber-500" :
                          "bg-emerald-500"
                        }`}
                        style={{ width: `${entry.riskScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{entry.riskScore}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
