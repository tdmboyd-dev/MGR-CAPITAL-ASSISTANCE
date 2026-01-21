// ============================================
// HR PANEL — MGR CAPITAL ASSISTANCE
// Human Resources management interface
// HR_ACCESS roles: FOUNDER, ADMIN, HR
// ============================================

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  tier: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
  hireDate: string;
  teamLeadId?: string;
  teamLeadName?: string;
  casesHandled: number;
  trainingProgress: number;
  lastActive?: string;
}

interface OnboardingCandidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  appliedDate: string;
  status: "PENDING" | "SCREENING" | "TRAINING" | "APPROVED" | "REJECTED";
  backgroundCheckStatus: "PENDING" | "PASSED" | "FAILED" | "WAIVED";
  documentsSubmitted: boolean;
  interviewScore?: number;
  notes?: string;
}

interface PerformanceMetric {
  employeeId: string;
  employeeName: string;
  tier: string;
  casesThisMonth: number;
  casesLastMonth: number;
  successRate: number;
  avgResponseTime: number;
  clientSatisfaction: number;
  tierProgressPercent: number;
  flags: string[];
}

interface TrainingCompliance {
  employeeId: string;
  employeeName: string;
  role: string;
  tier: string;
  totalModules: number;
  completedModules: number;
  overdueModules: number;
  certifications: string[];
  lastTrainingDate?: string;
  nextDeadline?: string;
}

interface TeamSummary {
  teamLeadId: string;
  teamLeadName: string;
  memberCount: number;
  avgPerformance: number;
  activeCase: number;
  pendingTraining: number;
}

interface HRDashboard {
  totalEmployees: number;
  activeEmployees: number;
  pendingOnboarding: number;
  suspendedEmployees: number;
  tierDistribution: Record<string, number>;
  roleDistribution: Record<string, number>;
  avgTrainingCompletion: number;
  overdueTrainingCount: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function getTierColor(tier: string): string {
  switch (tier) {
    case "TIER_5_EXECUTIVE_PARTNER": return "text-purple-400 bg-purple-900/30";
    case "TIER_4_TEAM_LEADER": return "text-blue-400 bg-blue-900/30";
    case "TIER_3_SENIOR_SPECIALIST": return "text-emerald-400 bg-emerald-900/30";
    case "TIER_2_SPECIALIST": return "text-amber-400 bg-amber-900/30";
    case "TIER_1_ASSOCIATE": return "text-slate-400 bg-slate-800";
    default: return "text-slate-400 bg-slate-800";
  }
}

function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    TIER_5_EXECUTIVE_PARTNER: "Executive Partner",
    TIER_4_TEAM_LEADER: "Team Leader",
    TIER_3_SENIOR_SPECIALIST: "Senior Specialist",
    TIER_2_SPECIALIST: "Specialist",
    TIER_1_ASSOCIATE: "Associate"
  };
  return names[tier] || tier;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE": return "text-emerald-400 bg-emerald-900/30";
    case "INACTIVE": return "text-slate-400 bg-slate-800";
    case "SUSPENDED": return "text-red-400 bg-red-900/30";
    case "PENDING": return "text-amber-400 bg-amber-900/30";
    case "APPROVED": return "text-emerald-400 bg-emerald-900/30";
    case "REJECTED": return "text-red-400 bg-red-900/30";
    case "SCREENING": return "text-blue-400 bg-blue-900/30";
    case "TRAINING": return "text-purple-400 bg-purple-900/30";
    case "PASSED": return "text-emerald-400 bg-emerald-900/30";
    case "FAILED": return "text-red-400 bg-red-900/30";
    case "WAIVED": return "text-slate-400 bg-slate-800";
    default: return "text-slate-400 bg-slate-800";
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HRPanel() {
  // State
  const [dashboard, setDashboard] = useState<HRDashboard | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingCandidate[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetric[]>([]);
  const [training, setTraining] = useState<TrainingCompliance[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "onboarding" | "performance" | "training" | "teams">("overview");

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<OnboardingCandidate | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, employeesRes, onboardingRes, performanceRes, trainingRes, teamsRes] = await Promise.all([
        api.get<any>("/hr/dashboard"),
        api.get<any>("/hr/employees"),
        api.get<any>("/hr/onboarding"),
        api.get<any>("/hr/performance"),
        api.get<any>("/hr/training-compliance"),
        api.get<any>("/hr/teams")
      ]);

      if (dashboardRes.data.success) setDashboard(dashboardRes.data.data);
      if (employeesRes.data.success) setEmployees(employeesRes.data.data.employees || []);
      if (onboardingRes.data.success) setOnboarding(onboardingRes.data.data.candidates || []);
      if (performanceRes.data.success) setPerformance(performanceRes.data.data.metrics || []);
      if (trainingRes.data.success) setTraining(trainingRes.data.data.compliance || []);
      if (teamsRes.data.success) setTeams(teamsRes.data.data.teams || []);
    } catch (err: any) {
      setError(err.message || "Failed to load HR data");
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

  async function updateEmployeeStatus(employeeId: string, newStatus: string) {
    try {
      await api.patch<any>(`/hr/employees/${employeeId}/status`, { status: newStatus });
      setEmployees(prev => prev.map(e =>
        e.id === employeeId ? { ...e, status: newStatus as any } : e
      ));
    } catch (err: any) {
      setError(err.message || "Failed to update employee status");
    }
  }

  async function updateEmployeeTier(employeeId: string, newTier: string) {
    try {
      await api.patch<any>(`/hr/employees/${employeeId}/tier`, { tier: newTier });
      setEmployees(prev => prev.map(e =>
        e.id === employeeId ? { ...e, tier: newTier } : e
      ));
      setSelectedEmployee(null);
    } catch (err: any) {
      setError(err.message || "Failed to update employee tier");
    }
  }

  async function approveOnboarding(candidateId: string) {
    try {
      await api.post<any>(`/hr/onboarding/${candidateId}/approve`, {});
      setOnboarding(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: "APPROVED" as const } : c
      ));
    } catch (err: any) {
      setError(err.message || "Failed to approve candidate");
    }
  }

  async function rejectOnboarding(candidateId: string) {
    try {
      await api.post<any>(`/hr/onboarding/${candidateId}/reject`, {});
      setOnboarding(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: "REJECTED" as const } : c
      ));
    } catch (err: any) {
      setError(err.message || "Failed to reject candidate");
    }
  }

  async function moveToTraining(candidateId: string) {
    try {
      await api.post<any>(`/hr/onboarding/${candidateId}/move-to-training`, {});
      setOnboarding(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: "TRAINING" as const } : c
      ));
    } catch (err: any) {
      setError(err.message || "Failed to move candidate to training");
    }
  }

  async function sendTrainingReminder(employeeId: string) {
    try {
      await api.post<any>(`/hr/training/remind/${employeeId}`, {});
      alert("Training reminder sent successfully");
    } catch (err: any) {
      setError(err.message || "Failed to send reminder");
    }
  }

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredEmployees = employees.filter(emp => {
    if (statusFilter !== "ALL" && emp.status !== statusFilter) return false;
    if (tierFilter !== "ALL" && emp.tier !== tierFilter) return false;
    if (searchQuery && !emp.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !emp.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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
            <p className="text-slate-400">Loading HR Panel...</p>
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
          <h1 className="text-2xl font-semibold">HR Management Panel</h1>
          <p className="text-sm text-slate-400">Employee lifecycle, performance, and compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-medium"
          >
            + New Candidate
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
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit overflow-x-auto">
        {(["overview", "employees", "onboarding", "performance", "training", "teams"] as const).map((tab) => (
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
          {/* Pending Actions Banner */}
          {(dashboard.pendingOnboarding > 0 || dashboard.overdueTrainingCount > 0) && (
            <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-4 flex items-center gap-4">
              <span className="text-2xl">📋</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-400">Actions Required</p>
                <p className="text-sm text-amber-300">
                  {dashboard.pendingOnboarding} pending onboarding · {dashboard.overdueTrainingCount} overdue training
                </p>
              </div>
              <div className="flex gap-2">
                {dashboard.pendingOnboarding > 0 && (
                  <button
                    onClick={() => setActiveTab("onboarding")}
                    className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
                  >
                    View Onboarding
                  </button>
                )}
                {dashboard.overdueTrainingCount > 0 && (
                  <button
                    onClick={() => setActiveTab("training")}
                    className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
                  >
                    View Training
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Total Employees</p>
              <p className="text-2xl font-bold">{dashboard.totalEmployees}</p>
              <p className="text-xs text-emerald-400 mt-1">
                {dashboard.activeEmployees} active
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Pending Onboarding</p>
              <p className={`text-2xl font-bold ${dashboard.pendingOnboarding > 0 ? "text-amber-400" : ""}`}>
                {dashboard.pendingOnboarding}
              </p>
              <p className="text-xs text-slate-500 mt-1">awaiting review</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">Training Completion</p>
              <p className="text-2xl font-bold text-emerald-400">{dashboard.avgTrainingCompletion}%</p>
              <p className={`text-xs mt-1 ${dashboard.overdueTrainingCount > 0 ? "text-red-400" : "text-slate-500"}`}>
                {dashboard.overdueTrainingCount} overdue
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">This Month</p>
              <div className="flex items-center gap-4 mt-1">
                <div>
                  <p className="text-lg font-bold text-emerald-400">+{dashboard.newHiresThisMonth}</p>
                  <p className="text-xs text-slate-500">hired</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">-{dashboard.terminationsThisMonth}</p>
                  <p className="text-xs text-slate-500">termed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tier Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Tier Distribution</h2>
              <div className="space-y-3">
                {Object.entries(dashboard.tierDistribution || {}).map(([tier, count]) => (
                  <div key={tier} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${getTierColor(tier)}`}>
                      {getTierDisplayName(tier)}
                    </span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(count / dashboard.totalEmployees) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Role Distribution</h2>
              <div className="space-y-3">
                {Object.entries(dashboard.roleDistribution || {}).map(([role, count]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 min-w-[100px]">
                      {role}
                    </span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(count / dashboard.totalEmployees) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Onboarding */}
          {onboarding.filter(c => c.status === "PENDING" || c.status === "SCREENING").length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Pending Onboarding</h2>
                <button
                  onClick={() => setActiveTab("onboarding")}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {onboarding
                  .filter(c => c.status === "PENDING" || c.status === "SCREENING")
                  .slice(0, 3)
                  .map(candidate => (
                    <div key={candidate.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-sm text-slate-400">{candidate.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(candidate.status)}`}>
                          {candidate.status}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(candidate.appliedDate)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EMPLOYEES TAB */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
            </select>
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded"
            >
              <option value="ALL">All Tiers</option>
              <option value="TIER_1_ASSOCIATE">Tier 1 - Associate</option>
              <option value="TIER_2_SPECIALIST">Tier 2 - Specialist</option>
              <option value="TIER_3_SENIOR_SPECIALIST">Tier 3 - Senior</option>
              <option value="TIER_4_TEAM_LEADER">Tier 4 - Team Lead</option>
              <option value="TIER_5_EXECUTIVE_PARTNER">Tier 5 - Executive</option>
            </select>
          </div>

          {/* Employee Count */}
          <p className="text-sm text-slate-400">
            Showing {filteredEmployees.length} of {employees.length} employees
          </p>

          {/* Employee Table */}
          {filteredEmployees.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No employees match your filters</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Cases</th>
                    <th className="p-3 text-center">Training</th>
                    <th className="p-3">Team Lead</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${getTierColor(emp.tier)}`}>
                          {getTierDisplayName(emp.tier)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(emp.status)}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">{emp.casesHandled}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${emp.trainingProgress >= 80 ? "bg-emerald-500" : emp.trainingProgress >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${emp.trainingProgress}%` }}
                            />
                          </div>
                          <span className="text-xs">{emp.trainingProgress}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-slate-400">
                        {emp.teamLeadName || "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setShowEmployeeModal(true);
                            }}
                            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                          >
                            Edit
                          </button>
                          {emp.status === "ACTIVE" && (
                            <button
                              onClick={() => updateEmployeeStatus(emp.id, "SUSPENDED")}
                              className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-400 rounded"
                            >
                              Suspend
                            </button>
                          )}
                          {emp.status === "SUSPENDED" && (
                            <button
                              onClick={() => updateEmployeeStatus(emp.id, "ACTIVE")}
                              className="px-2 py-1 text-xs bg-emerald-900/50 hover:bg-emerald-900 text-emerald-400 rounded"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ONBOARDING TAB */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Onboarding Queue ({onboarding.length})</h2>
            <button
              onClick={() => setShowOnboardingModal(true)}
              className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 rounded"
            >
              + Add Candidate
            </button>
          </div>

          {/* Pipeline Stages */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["PENDING", "SCREENING", "TRAINING", "APPROVED", "REJECTED"].map(status => {
              const count = onboarding.filter(c => c.status === status).length;
              return (
                <div
                  key={status}
                  className={`bg-slate-900 border rounded-lg p-3 text-center ${
                    status === "APPROVED" ? "border-emerald-600" :
                    status === "REJECTED" ? "border-red-600" :
                    "border-slate-800"
                  }`}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-slate-400">{status}</p>
                </div>
              );
            })}
          </div>

          {/* Candidates List */}
          {onboarding.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No onboarding candidates</p>
            </div>
          ) : (
            <div className="space-y-3">
              {onboarding.map(candidate => (
                <div
                  key={candidate.id}
                  className={`bg-slate-900 border rounded-lg p-4 ${
                    candidate.status === "PENDING" ? "border-amber-600" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{candidate.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(candidate.status)}`}>
                          {candidate.status}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(candidate.backgroundCheckStatus)}`}>
                          BG: {candidate.backgroundCheckStatus}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Email</p>
                          <p>{candidate.email}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Phone</p>
                          <p>{candidate.phone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Applied</p>
                          <p>{formatDate(candidate.appliedDate)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Interview Score</p>
                          <p>{candidate.interviewScore !== undefined ? `${candidate.interviewScore}/100` : "—"}</p>
                        </div>
                      </div>
                      {candidate.notes && (
                        <p className="mt-2 text-sm text-slate-400 italic">{candidate.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {candidate.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => moveToTraining(candidate.id)}
                            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                          >
                            Move to Training
                          </button>
                          <button
                            onClick={() => rejectOnboarding(candidate.id)}
                            className="px-3 py-1 text-sm bg-red-900/50 hover:bg-red-900 text-red-400 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {candidate.status === "SCREENING" && (
                        <button
                          onClick={() => moveToTraining(candidate.id)}
                          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                        >
                          Move to Training
                        </button>
                      )}
                      {candidate.status === "TRAINING" && (
                        <>
                          <button
                            onClick={() => approveOnboarding(candidate.id)}
                            className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 rounded"
                          >
                            Approve & Hire
                          </button>
                          <button
                            onClick={() => rejectOnboarding(candidate.id)}
                            className="px-3 py-1 text-sm bg-red-900/50 hover:bg-red-900 text-red-400 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Performance Metrics</h2>

          {performance.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No performance data available</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-slate-800 text-left text-sm text-slate-400">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3 text-center">Cases (Month)</th>
                    <th className="p-3 text-center">Success Rate</th>
                    <th className="p-3 text-center">Avg Response</th>
                    <th className="p-3 text-center">Client Sat.</th>
                    <th className="p-3 text-center">Tier Progress</th>
                    <th className="p-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map(metric => (
                    <tr key={metric.employeeId} className="border-t border-slate-800">
                      <td className="p-3 font-medium">{metric.employeeName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${getTierColor(metric.tier)}`}>
                          {getTierDisplayName(metric.tier)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono">{metric.casesThisMonth}</span>
                        <span className={`ml-1 text-xs ${metric.casesThisMonth >= metric.casesLastMonth ? "text-emerald-400" : "text-red-400"}`}>
                          {metric.casesThisMonth >= metric.casesLastMonth ? "↑" : "↓"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${metric.successRate >= 80 ? "text-emerald-400" : metric.successRate >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {metric.successRate}%
                        </span>
                      </td>
                      <td className="p-3 text-center text-sm">
                        {metric.avgResponseTime}h
                      </td>
                      <td className="p-3 text-center">
                        <span className={`${metric.clientSatisfaction >= 4 ? "text-emerald-400" : metric.clientSatisfaction >= 3 ? "text-amber-400" : "text-red-400"}`}>
                          {metric.clientSatisfaction.toFixed(1)}/5
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${metric.tierProgressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs">{metric.tierProgressPercent}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {metric.flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {metric.flags.map((flag, idx) => (
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

      {/* TRAINING TAB */}
      {activeTab === "training" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Training Compliance</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-400">
                {training.filter(t => t.overdueModules > 0).length} employees with overdue training
              </span>
            </div>
          </div>

          {training.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No training data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {training.map(record => (
                <div
                  key={record.employeeId}
                  className={`bg-slate-900 border rounded-lg p-4 ${
                    record.overdueModules > 0 ? "border-red-600" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{record.employeeName}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded ${getTierColor(record.tier)}`}>
                          {getTierDisplayName(record.tier)}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
                          {record.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Progress</p>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  record.completedModules === record.totalModules ? "bg-emerald-500" :
                                  record.overdueModules > 0 ? "bg-red-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${(record.completedModules / record.totalModules) * 100}%` }}
                              />
                            </div>
                            <span>{record.completedModules}/{record.totalModules}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-slate-400">Overdue</p>
                          <p className={record.overdueModules > 0 ? "text-red-400 font-bold" : ""}>
                            {record.overdueModules} modules
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Last Training</p>
                          <p>{record.lastTrainingDate ? formatDate(record.lastTrainingDate) : "Never"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Next Deadline</p>
                          <p className={record.nextDeadline && new Date(record.nextDeadline) < new Date() ? "text-red-400" : ""}>
                            {record.nextDeadline ? formatDate(record.nextDeadline) : "—"}
                          </p>
                        </div>
                      </div>

                      {record.certifications.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-slate-400">Certifications:</span>
                          {record.certifications.map((cert, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-emerald-900/30 text-emerald-400 rounded">
                              {cert}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {record.overdueModules > 0 && (
                        <button
                          onClick={() => sendTrainingReminder(record.employeeId)}
                          className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-700 rounded"
                        >
                          Send Reminder
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAMS TAB */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Team Overview</h2>

          {teams.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
              <p className="text-slate-400">No team data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <div
                  key={team.teamLeadId}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{team.teamLeadName}'s Team</h3>
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-900/30 text-blue-400">
                      {team.memberCount} members
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-slate-400">Avg Performance</p>
                      <p className={`text-lg font-bold ${
                        team.avgPerformance >= 80 ? "text-emerald-400" :
                        team.avgPerformance >= 60 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {team.avgPerformance}%
                      </p>
                    </div>
                    <div className="bg-slate-800 rounded p-3">
                      <p className="text-slate-400">Active Cases</p>
                      <p className="text-lg font-bold">{team.activeCase}</p>
                    </div>
                  </div>

                  {team.pendingTraining > 0 && (
                    <div className="mt-3 p-2 bg-amber-900/20 border border-amber-600 rounded text-sm">
                      <span className="text-amber-400">{team.pendingTraining} pending training modules</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EMPLOYEE EDIT MODAL */}
      {showEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Edit Employee</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Name</p>
                <p className="font-medium">{selectedEmployee.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Email</p>
                <p>{selectedEmployee.email}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Status</label>
                <select
                  value={selectedEmployee.status}
                  onChange={e => updateEmployeeStatus(selectedEmployee.id, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Tier</label>
                <select
                  value={selectedEmployee.tier}
                  onChange={e => updateEmployeeTier(selectedEmployee.id, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
                >
                  <option value="TIER_1_ASSOCIATE">Tier 1 - Associate</option>
                  <option value="TIER_2_SPECIALIST">Tier 2 - Specialist</option>
                  <option value="TIER_3_SENIOR_SPECIALIST">Tier 3 - Senior Specialist</option>
                  <option value="TIER_4_TEAM_LEADER">Tier 4 - Team Leader</option>
                  <option value="TIER_5_EXECUTIVE_PARTNER">Tier 5 - Executive Partner</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEmployeeModal(false);
                  setSelectedEmployee(null);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CANDIDATE MODAL */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Add New Candidate</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                try {
                  await api.post<any>("/hr/onboarding", {
                    name: formData.get("name"),
                    email: formData.get("email"),
                    phone: formData.get("phone") || undefined,
                    notes: formData.get("notes") || undefined
                  });
                  setShowOnboardingModal(false);
                  fetchData();
                } catch (err: any) {
                  setError(err.message || "Failed to add candidate");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm text-slate-400 block mb-1">Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOnboardingModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
