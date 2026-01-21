// ============================================
// COMPLIANCE PANEL — MGR CAPITAL ASSISTANCE
// Compliance monitoring and audit interface
// COMPLIANCE_ACCESS roles: FOUNDER, ADMIN, COMPLIANCE
// ============================================

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ComplianceDashboard {
  auditStats: {
    totalLogs: number;
    recentLogs: number;
    failedLogins: number;
    sensitiveAccess: number;
    documentAccess: number;
    flaggedActivities: number;
  };
  caseCompliance: {
    total: number;
    pendingReview: number;
    overdueDocuments: number;
    completed: number;
    complianceRate: number;
  };
  payoutCompliance: {
    total: number;
    pending: number;
    reviewRequired: number;
  };
  trainingCompliance: {
    totalEmployees: number;
    compliant: number;
    overdue: number;
    complianceRate: number;
  };
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: string;
}

interface CaseCompliance {
  id: string;
  internalId: string;
  clientName: string;
  status: string;
  assigneeName: string;
  documentsCount: number;
  daysSinceUpdate: number;
  complianceFlags: string[];
  isCompliant: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeCompliance {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  isActive: boolean;
  casesAssigned: number;
  activeCases: number;
  trainingCompleted: number;
  trainingTotal: number;
  overdueTrainingCount: number;
  overdueModules: string[];
  complianceFlags: string[];
  isCompliant: boolean;
}

interface PayoutCompliance {
  id: string;
  caseId: string;
  caseInternalId: string;
  employeeName: string;
  amountCents: number;
  status: string;
  type: string;
  daysPending: number;
  complianceFlags: string[];
  requiresReview: boolean;
  createdAt: string;
}

interface RiskAssessment {
  overallRisk: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  categories: {
    security: { score: number; factors: any };
    financial: { score: number; factors: any };
    operational: { score: number; factors: any };
    training: { score: number; factors: any };
    documentation: { score: number; factors: any };
  };
  recommendations: string[];
  assessedAt: string;
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
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRiskColor(score: number): string {
  if (score >= 70) return "text-red-400 bg-red-900/30";
  if (score >= 40) return "text-amber-400 bg-amber-900/30";
  return "text-emerald-400 bg-emerald-900/30";
}

function getRiskLevelColor(level: string): string {
  switch (level) {
    case "HIGH": return "text-red-400 bg-red-900/50 border-red-600";
    case "MEDIUM": return "text-amber-400 bg-amber-900/50 border-amber-600";
    case "LOW": return "text-emerald-400 bg-emerald-900/50 border-emerald-600";
    default: return "text-slate-400 bg-slate-800 border-slate-600";
  }
}

function getFlagColor(flag: string): string {
  if (flag.includes("OVERDUE") || flag.includes("HIGH")) return "bg-red-900/30 text-red-400";
  if (flag.includes("MISSING") || flag.includes("UNVERIFIED") || flag.includes("REQUIRES")) return "bg-amber-900/30 text-amber-400";
  if (flag.includes("STALE") || flag.includes("LOW")) return "bg-orange-900/30 text-orange-400";
  return "bg-slate-800 text-slate-400";
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompliancePanel() {
  // State
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cases, setCases] = useState<CaseCompliance[]>([]);
  const [employees, setEmployees] = useState<EmployeeCompliance[]>([]);
  const [payouts, setPayouts] = useState<PayoutCompliance[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "audit" | "cases" | "employees" | "payouts" | "risk">("overview");

  // Filter states
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");
  const [showNonCompliantOnly, setShowNonCompliantOnly] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, auditRes, casesRes, employeesRes, payoutsRes, riskRes] = await Promise.all([
        api.get<any>("/compliance/dashboard"),
        api.get<any>("/compliance/audit-logs?limit=50"),
        api.get<any>("/compliance/cases"),
        api.get<any>("/compliance/employees"),
        api.get<any>("/compliance/payouts"),
        api.get<any>("/compliance/risk-assessment")
      ]);

      if (dashboardRes.data.success) setDashboard(dashboardRes.data.data);
      if (auditRes.data.success) setAuditLogs(auditRes.data.data.logs || []);
      if (casesRes.data.success) setCases(casesRes.data.data.cases || []);
      if (employeesRes.data.success) setEmployees(employeesRes.data.data.employees || []);
      if (payoutsRes.data.success) setPayouts(payoutsRes.data.data.payouts || []);
      if (riskRes.data.success) setRiskAssessment(riskRes.data.data);
    } catch (err: any) {
      setError(err.message || "Failed to load compliance data");
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

  async function flagItem(resourceType: string, resourceId: string, reason: string) {
    try {
      await api.post<any>("/compliance/flag", {
        resourceType,
        resourceId,
        reason,
        severity: "MEDIUM"
      });
      alert(`${resourceType} flagged for review`);
    } catch (err: any) {
      setError(err.message || "Failed to flag item");
    }
  }

  async function generateReport() {
    try {
      const response = await api.post<any>("/compliance/generate-report", {
        reportType: "FULL"
      });
      if (response.data.success) {
        alert(`Report ${response.data.data.report.id} generated successfully`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    }
  }

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditActionFilter !== "ALL" && log.action !== auditActionFilter) return false;
    return true;
  });

  const filteredCases = cases.filter(c => {
    if (showNonCompliantOnly && c.isCompliant) return false;
    return true;
  });

  const filteredEmployees = employees.filter(e => {
    if (showNonCompliantOnly && e.isCompliant) return false;
    return true;
  });

  // ============================================
  // RENDER: Loading/Error States
  // ============================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading Compliance Panel...</p>
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
  // RENDER: Main Panel
  // ============================================

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Compliance Monitoring</h1>
          <p className="text-sm text-slate-400">Audit trails, risk assessment, and compliance reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-medium"
          >
            Generate Report
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

      {/* Risk Level Banner */}
      {riskAssessment && riskAssessment.riskLevel !== "LOW" && (
        <div className={`mb-6 p-4 rounded-lg border ${getRiskLevelColor(riskAssessment.riskLevel)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{riskAssessment.riskLevel === "HIGH" ? "⚠️" : "⚡"}</span>
              <div>
                <p className="font-bold">{riskAssessment.riskLevel} RISK LEVEL</p>
                <p className="text-sm opacity-80">Overall risk score: {riskAssessment.overallRisk}/100</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("risk")}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded"
            >
              View Details
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit overflow-x-auto">
        {(["overview", "audit", "cases", "employees", "payouts", "risk"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap ${
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Audit Logs (30d)</p>
              <p className="text-2xl font-bold">{dashboard.auditStats.recentLogs}</p>
              <p className="text-xs text-slate-500 mt-1">
                {dashboard.auditStats.flaggedActivities} flagged
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Case Compliance</p>
              <p className="text-2xl font-bold text-emerald-400">{dashboard.caseCompliance.complianceRate}%</p>
              <p className="text-xs text-red-400 mt-1">
                {dashboard.caseCompliance.overdueDocuments} overdue
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Training Compliance</p>
              <p className="text-2xl font-bold text-emerald-400">{dashboard.trainingCompliance.complianceRate}%</p>
              <p className="text-xs text-red-400 mt-1">
                {dashboard.trainingCompliance.overdue} employees overdue
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Payouts Pending Review</p>
              <p className={`text-2xl font-bold ${dashboard.payoutCompliance.reviewRequired > 0 ? "text-amber-400" : ""}`}>
                {dashboard.payoutCompliance.reviewRequired}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                of {dashboard.payoutCompliance.pending} pending
              </p>
            </div>
          </div>

          {/* Security & Sensitive Access */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Security Alerts (30d)</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded">
                  <span className="text-slate-300">Failed Login Attempts</span>
                  <span className={`font-bold ${dashboard.auditStats.failedLogins > 10 ? "text-red-400" : "text-emerald-400"}`}>
                    {dashboard.auditStats.failedLogins}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded">
                  <span className="text-slate-300">Sensitive Data Access</span>
                  <span className="font-bold text-amber-400">{dashboard.auditStats.sensitiveAccess}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded">
                  <span className="text-slate-300">Document Access Events</span>
                  <span className="font-bold">{dashboard.auditStats.documentAccess}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Compliance Summary</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">Cases</span>
                    <span className="text-sm font-bold">{dashboard.caseCompliance.complianceRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${dashboard.caseCompliance.complianceRate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">Training</span>
                    <span className="text-sm font-bold">{dashboard.trainingCompliance.complianceRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${dashboard.trainingCompliance.complianceRate}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded mt-4">
                  <span className="text-slate-300">Employees Compliant</span>
                  <span className="font-bold text-emerald-400">
                    {dashboard.trainingCompliance.compliant}/{dashboard.trainingCompliance.totalEmployees}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Flagged Activities */}
          {dashboard.auditStats.flaggedActivities > 0 && (
            <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-red-400">Flagged Activities</h2>
                <button
                  onClick={() => setActiveTab("audit")}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  View All →
                </button>
              </div>
              <p className="text-red-300">
                {dashboard.auditStats.flaggedActivities} activities have been flagged for review.
              </p>
            </div>
          )}
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
            <select
              value={auditActionFilter}
              onChange={e => setAuditActionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="LOGIN_FAILED">Failed Login</option>
              <option value="VIEW_FINANCIAL">View Financial</option>
              <option value="EXPORT_DATA">Export Data</option>
              <option value="DOCUMENT_UPLOAD">Document Upload</option>
              <option value="DOCUMENT_VIEW">Document View</option>
            </select>
            <span className="text-sm text-slate-400">
              Showing {filteredAuditLogs.length} logs
            </span>
          </div>

          {/* Audit Log Table */}
          {filteredAuditLogs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No audit logs found</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Resource</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map(log => (
                    <tr key={log.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                      <td className="p-3 text-sm text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          log.action.includes("FAILED") ? "bg-red-900/30 text-red-400" :
                          log.action.includes("SENSITIVE") || log.action.includes("EXPORT") ? "bg-amber-900/30 text-amber-400" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm">{log.userName}</p>
                          <p className="text-xs text-slate-400">{log.userRole}</p>
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {log.resource && (
                          <span className="text-slate-300">
                            {log.resource}{log.resourceId ? `: ${log.resourceId.slice(0, 8)}...` : ""}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-slate-400 font-mono">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CASES TAB */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showNonCompliantOnly}
                onChange={e => setShowNonCompliantOnly(e.target.checked)}
                className="rounded border-slate-600"
              />
              <span className="text-sm">Show non-compliant only</span>
            </label>
            <span className="text-sm text-slate-400">
              Showing {filteredCases.length} cases
            </span>
          </div>

          {/* Cases Table */}
          {filteredCases.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No cases found</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Case ID</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Assignee</th>
                    <th className="p-3 text-center">Docs</th>
                    <th className="p-3 text-center">Days Stale</th>
                    <th className="p-3">Flags</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(c => (
                    <tr key={c.id} className={`border-t border-slate-800 ${!c.isCompliant ? "bg-red-900/10" : ""}`}>
                      <td className="p-3 font-mono text-sm">{c.internalId}</td>
                      <td className="p-3">{c.clientName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{c.assigneeName}</td>
                      <td className="p-3 text-center">{c.documentsCount}</td>
                      <td className="p-3 text-center">
                        <span className={c.daysSinceUpdate > 7 ? "text-amber-400" : ""}>
                          {c.daysSinceUpdate}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.complianceFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.complianceFlags.map((flag, idx) => (
                              <span key={idx} className={`px-2 py-0.5 text-xs rounded ${getFlagColor(flag)}`}>
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-400 text-sm">Compliant</span>
                        )}
                      </td>
                      <td className="p-3">
                        {!c.isCompliant && (
                          <button
                            onClick={() => flagItem("CASE", c.id, "Non-compliant")}
                            className="px-2 py-1 text-xs bg-amber-900/50 hover:bg-amber-900 text-amber-400 rounded"
                          >
                            Flag
                          </button>
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

      {/* EMPLOYEES TAB */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showNonCompliantOnly}
                onChange={e => setShowNonCompliantOnly(e.target.checked)}
                className="rounded border-slate-600"
              />
              <span className="text-sm">Show non-compliant only</span>
            </label>
            <span className="text-sm text-slate-400">
              Showing {filteredEmployees.length} employees
            </span>
          </div>

          {/* Employees Table */}
          {filteredEmployees.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No employees found</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-center">Cases</th>
                    <th className="p-3 text-center">Training</th>
                    <th className="p-3">Overdue Modules</th>
                    <th className="p-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className={`border-t border-slate-800 ${!emp.isCompliant ? "bg-red-900/10" : ""}`}>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono">{emp.activeCases}/{emp.casesAssigned}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                emp.trainingTotal > 0 && emp.trainingCompleted / emp.trainingTotal >= 0.8
                                  ? "bg-emerald-500"
                                  : emp.trainingTotal > 0 && emp.trainingCompleted / emp.trainingTotal >= 0.5
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: emp.trainingTotal > 0 ? `${(emp.trainingCompleted / emp.trainingTotal) * 100}%` : "0%" }}
                            />
                          </div>
                          <span className="text-xs">{emp.trainingCompleted}/{emp.trainingTotal}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {emp.overdueModules.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.overdueModules.slice(0, 2).map((mod, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400 rounded">
                                {mod}
                              </span>
                            ))}
                            {emp.overdueModules.length > 2 && (
                              <span className="text-xs text-slate-400">+{emp.overdueModules.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {emp.complianceFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.complianceFlags.map((flag, idx) => (
                              <span key={idx} className={`px-2 py-0.5 text-xs rounded ${getFlagColor(flag)}`}>
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-400 text-sm">Compliant</span>
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

      {/* PAYOUTS TAB */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Payout Compliance</h2>

          {payouts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No payouts found</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Case</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Days Pending</th>
                    <th className="p-3">Flags</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} className={`border-t border-slate-800 ${p.requiresReview ? "bg-amber-900/10" : ""}`}>
                      <td className="p-3 font-mono text-sm">{p.caseInternalId}</td>
                      <td className="p-3">{p.employeeName}</td>
                      <td className="p-3 font-bold">{formatCurrency(p.amountCents)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          p.status === "PAID" ? "bg-emerald-900/30 text-emerald-400" :
                          p.status === "PENDING" ? "bg-amber-900/30 text-amber-400" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.status === "PENDING" ? (
                          <span className={p.daysPending > 7 ? "text-red-400" : ""}>
                            {p.daysPending}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        {p.complianceFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.complianceFlags.map((flag, idx) => (
                              <span key={idx} className={`px-2 py-0.5 text-xs rounded ${getFlagColor(flag)}`}>
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {p.requiresReview && (
                          <button
                            onClick={() => flagItem("PAYOUT", p.id, "Review required")}
                            className="px-2 py-1 text-xs bg-amber-900/50 hover:bg-amber-900 text-amber-400 rounded"
                          >
                            Review
                          </button>
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

      {/* RISK TAB */}
      {activeTab === "risk" && riskAssessment && (
        <div className="space-y-6">
          {/* Overall Risk */}
          <div className={`p-6 rounded-lg border-2 ${getRiskLevelColor(riskAssessment.riskLevel)}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Risk Assessment</h2>
                <p className="text-sm opacity-80">Last assessed: {formatDateTime(riskAssessment.assessedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold">{riskAssessment.overallRisk}</p>
                <p className="text-sm opacity-80">{riskAssessment.riskLevel} RISK</p>
              </div>
            </div>
            <div className="h-4 bg-black/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  riskAssessment.overallRisk >= 70 ? "bg-red-500" :
                  riskAssessment.overallRisk >= 40 ? "bg-amber-500" :
                  "bg-emerald-500"
                }`}
                style={{ width: `${riskAssessment.overallRisk}%` }}
              />
            </div>
          </div>

          {/* Risk Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(riskAssessment.categories).map(([category, data]) => (
              <div
                key={category}
                className={`bg-slate-900 border rounded-lg p-4 ${
                  data.score >= 70 ? "border-red-600" :
                  data.score >= 40 ? "border-amber-600" :
                  "border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize">{category}</h3>
                  <span className={`px-2 py-0.5 text-sm font-bold rounded ${getRiskColor(data.score)}`}>
                    {data.score}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      data.score >= 70 ? "bg-red-500" :
                      data.score >= 40 ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`}
                    style={{ width: `${data.score}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400">
                  {Object.entries(data.factors).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="font-mono">{value as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {riskAssessment.recommendations.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
              <div className="space-y-2">
                {riskAssessment.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-800 rounded">
                    <span className="text-amber-400">⚡</span>
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
