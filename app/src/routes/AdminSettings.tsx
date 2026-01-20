// ============================================
// ADMIN SETTINGS PAGE — MGR CAPITAL ASSISTANCE
// AI configuration, system settings, and audit logs
// ============================================

import { useState, useEffect } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface AuditSummary {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  loginAttempts: number;
  failedLogins: number;
  topActions: { action: string; count: number }[];
  topUsers: { userId: string; user: { name: string; email: string } | null; count: number }[];
}

interface SystemHealth {
  status: string;
  timestamp: string;
  metrics: {
    totalUsers: number;
    totalCases: number;
    activeEmployees: number;
    pendingPayouts: number;
    errorsLast24h: number;
  };
  database: string;
  version: string;
}

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "ai" | "audit">("general");
  const [auditFilter, setAuditFilter] = useState({ action: "", entityType: "" });
  const [auditPage, setAuditPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSettingsData();
  }, []);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, auditPage, auditFilter]);

  async function fetchSettingsData() {
    try {
      setLoading(true);
      const [healthRes, summaryRes] = await Promise.all([
        api.get<any>("/settings/health"),
        api.get<any>("/settings/audit-logs/summary"),
      ]);

      if (healthRes.data.success) {
        setSystemHealth(healthRes.data.data);
      }
      if (summaryRes.data.success) {
        setAuditSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditLogs() {
    try {
      const params = new URLSearchParams({
        page: String(auditPage),
        limit: "50",
      });
      if (auditFilter.action) params.append("action", auditFilter.action);
      if (auditFilter.entityType) params.append("entityType", auditFilter.entityType);

      const response = await api.get<any>(`/settings/audit-logs?${params}`);
      if (response.data.success) {
        setAuditLogs(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  }

  function formatDetails(details: any): string {
    if (!details) return "-";
    if (typeof details === "string") return details;
    try {
      const keys = Object.keys(details);
      if (keys.length === 0) return "-";
      return keys.map(k => `${k}: ${JSON.stringify(details[k])}`).join(", ");
    } catch {
      return "-";
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings & Configuration</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "general"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "ai"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          AI Configuration
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "audit"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Audit Log
        </button>
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* User Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Name</p>
                <p className="font-medium">{user?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400">Email</p>
                <p className="font-medium">{user?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400">Role</p>
                <p className="font-medium text-emerald-400">{user?.role || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400">Session</p>
                <button
                  onClick={logout}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">System Health</h2>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                <div className="h-4 bg-slate-700 rounded w-1/3"></div>
              </div>
            ) : systemHealth ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-3 h-3 rounded-full ${
                    systemHealth.status === "healthy" ? "bg-emerald-500" : "bg-red-500"
                  }`}></span>
                  <span className="text-sm font-medium">
                    {systemHealth.status === "healthy" ? "All Systems Operational" : "Issues Detected"}
                  </span>
                  <span className="text-xs text-slate-500">v{systemHealth.version}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Users</p>
                    <p className="text-xl font-semibold">{systemHealth.metrics.totalUsers}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cases</p>
                    <p className="text-xl font-semibold">{systemHealth.metrics.totalCases}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Active Employees</p>
                    <p className="text-xl font-semibold">{systemHealth.metrics.activeEmployees}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Pending Payouts</p>
                    <p className="text-xl font-semibold text-amber-400">{systemHealth.metrics.pendingPayouts}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Errors (24h)</p>
                    <p className={`text-xl font-semibold ${
                      systemHealth.metrics.errorsLast24h > 0 ? "text-red-400" : "text-emerald-400"
                    }`}>{systemHealth.metrics.errorsLast24h}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Unable to load system health</p>
            )}
          </div>

          {/* Commission Structure */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Commission Structure (Shadow Accounting)</h2>
            <p className="text-sm text-slate-400 mb-4">
              Employees see inflated commission rates. The actual payout is half of what is displayed.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-2 font-medium">Tier</th>
                  <th className="pb-2 font-medium">Displayed Rate</th>
                  <th className="pb-2 font-medium">Actual Rate</th>
                  <th className="pb-2 font-medium">Founder Keeps</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-800">
                  <td className="py-2 text-slate-400">Associate</td>
                  <td className="py-2">20%</td>
                  <td className="py-2 text-emerald-400">10%</td>
                  <td className="py-2 text-amber-400">10%</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 text-blue-400">Specialist</td>
                  <td className="py-2">40%</td>
                  <td className="py-2 text-emerald-400">20%</td>
                  <td className="py-2 text-amber-400">20%</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 text-purple-400">Senior Specialist</td>
                  <td className="py-2">60%</td>
                  <td className="py-2 text-emerald-400">30%</td>
                  <td className="py-2 text-amber-400">30%</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 text-amber-400">Team Leader</td>
                  <td className="py-2">80%</td>
                  <td className="py-2 text-emerald-400">40%</td>
                  <td className="py-2 text-amber-400">40%</td>
                </tr>
                <tr>
                  <td className="py-2 text-emerald-400">Executive Partner</td>
                  <td className="py-2">100%</td>
                  <td className="py-2 text-emerald-400">50%</td>
                  <td className="py-2 text-amber-400">50%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Configuration Tab */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">AI Services Configuration</h2>
            <p className="text-sm text-slate-400 mb-6">
              Configure AI-powered features for call coaching, script generation, and client communication.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Call Script Generation</p>
                  <p className="text-sm text-slate-400">Generate personalized scripts based on case status</p>
                </div>
                <span className="px-3 py-1 bg-emerald-900/50 text-emerald-400 rounded text-sm">Active</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Coaching Feedback</p>
                  <p className="text-sm text-slate-400">AI-powered performance analysis for employees</p>
                </div>
                <span className="px-3 py-1 bg-emerald-900/50 text-emerald-400 rounded text-sm">Active</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Document Analysis</p>
                  <p className="text-sm text-slate-400">Extract data from uploaded client documents</p>
                </div>
                <span className="px-3 py-1 bg-amber-900/50 text-amber-400 rounded text-sm">Coming Soon</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium">Client Communication</p>
                  <p className="text-sm text-slate-400">Generate personalized emails and SMS messages</p>
                </div>
                <span className="px-3 py-1 bg-amber-900/50 text-amber-400 rounded text-sm">Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Training Modules</h2>
            <p className="text-sm text-slate-400 mb-4">
              Manage employee training content and quiz questions.
            </p>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">
              Manage Training Content
            </button>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* Audit Summary */}
          {auditSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400">Today</p>
                <p className="text-2xl font-semibold">{auditSummary.logsToday}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400">This Week</p>
                <p className="text-2xl font-semibold">{auditSummary.logsThisWeek}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400">Login Attempts</p>
                <p className="text-2xl font-semibold">{auditSummary.loginAttempts}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400">Failed Logins</p>
                <p className={`text-2xl font-semibold ${auditSummary.failedLogins > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {auditSummary.failedLogins}
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={auditFilter.action}
              onChange={(e) => { setAuditFilter({ ...auditFilter, action: e.target.value }); setAuditPage(1); }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
            >
              <option value="">All Actions</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="VIEW">View</option>
              <option value="DELETE">Delete</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="PAYOUT_PROCESSED">Payout Processed</option>
            </select>
            <select
              value={auditFilter.entityType}
              onChange={(e) => { setAuditFilter({ ...auditFilter, entityType: e.target.value }); setAuditPage(1); }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
            >
              <option value="">All Entities</option>
              <option value="Authentication">Authentication</option>
              <option value="Case">Case</option>
              <option value="Employee">Employee</option>
              <option value="Client">Client</option>
              <option value="Payout">Payout</option>
              <option value="Document">Document</option>
            </select>
            <button
              onClick={fetchAuditLogs}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Refresh
            </button>
          </div>

          {/* Audit Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="px-4 py-3 font-medium">Timestamp (UTC)</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">IP Address</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No audit logs found.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                          {new Date(log.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{log.user?.name || "System"}</p>
                            <p className="text-xs text-slate-500">{log.user?.role || ""}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.action.includes("CREATE") || log.action === "LOGIN_SUCCESS" ? "bg-emerald-900/50 text-emerald-400" :
                            log.action.includes("UPDATE") || log.action.includes("CHANGE") ? "bg-blue-900/50 text-blue-400" :
                            log.action.includes("DELETE") || log.action === "LOGIN_FAILED" ? "bg-red-900/50 text-red-400" :
                            log.action === "VIEW" ? "bg-slate-700 text-slate-300" :
                            "bg-amber-900/50 text-amber-400"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300">{log.entityType}</span>
                          {log.entityId && (
                            <span className="text-xs text-slate-500 ml-2">#{log.entityId.slice(0, 8)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                          {log.ipAddress || "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate">
                          {formatDetails(log.details)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Page {auditPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))}
                    disabled={auditPage === totalPages}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
