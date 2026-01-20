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
  entityId: string;
  details?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}

interface SystemStats {
  totalUsers: number;
  totalCases: number;
  totalRecoveredCents: number;
  dbSize?: string;
}

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "ai" | "audit">("general");

  useEffect(() => {
    fetchSettingsData();
  }, []);

  async function fetchSettingsData() {
    try {
      setLoading(true);
      const [auditRes, statsRes] = await Promise.all([
        api.get<any>("/audit?limit=50"),
        api.get<any>("/cases/stats"),
      ]);

      if (auditRes.data.success) {
        setAuditLogs(auditRes.data.data || []);
      }
      if (statsRes.data.success) {
        setSystemStats(statsRes.data.data);
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
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

          {/* System Stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">System Statistics</h2>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                <div className="h-4 bg-slate-700 rounded w-1/3"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Total Users</p>
                  <p className="text-2xl font-semibold">{systemStats?.totalUsers || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total Cases</p>
                  <p className="text-2xl font-semibold">{systemStats?.totalCases || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total Recovered</p>
                  <p className="text-2xl font-semibold text-emerald-400">
                    ${((systemStats?.totalRecoveredCents || 0) / 100).toLocaleString()}
                  </p>
                </div>
              </div>
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
            <h2 className="font-semibold">System Audit Log</h2>
            <button
              onClick={fetchSettingsData}
              className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {log.user?.name || "System"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.action.includes("CREATE") ? "bg-emerald-900/50 text-emerald-400" :
                          log.action.includes("UPDATE") ? "bg-blue-900/50 text-blue-400" :
                          log.action.includes("DELETE") ? "bg-red-900/50 text-red-400" :
                          "bg-slate-700 text-slate-300"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400">{log.entityType}</span>
                        <span className="text-xs text-slate-500 ml-2">#{log.entityId.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                        {log.details || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
