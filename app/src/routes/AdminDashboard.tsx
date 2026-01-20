// ============================================
// ADMIN DASHBOARD — MGR CAPITAL ASSISTANCE
// Founder/Admin overview with real-time metrics
// ============================================

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import SimpleStatCard from "../components/charts/SimpleStatCard";
import { api } from "../lib/api";

interface DashboardStats {
  totalRecoveredCents: number;
  totalFeesCents: number;
  founderShareCents: number;
  pendingPayoutsCents: number;
  activeCases: number;
  casesThisMonth: number;
  activeEmployees: number;
  casesAwaitingFunds: number;
}

interface CasesByState {
  state: string;
  count: number;
  totalSurplusCents: number;
}

interface TopPerformer {
  id: string;
  name: string;
  tier: string;
  casesCompleted: number;
  revenueCents: number;
}

interface PendingPayout {
  caseId: string;
  internalCode: string;
  client: { name: string; email: string };
  employee: { id: string; name: string; employeeTier: string } | null;
  surplusAmountCents: number;
  calculation: {
    feeAmountCents: number;
    clientPayoutCents: number;
    employeeCommissionCents: number;
    employeeDisplayedCommissionCents: number;
    founderShareCents: number;
    companyFeeCents: number;
  };
}

interface Anomaly {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  caseId?: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [casesByState, setCasesByState] = useState<CasesByState[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [statsRes, casesRes, employeesRes, payoutsRes, anomaliesRes] = await Promise.all([
        api.get<any>("/cases/stats"),
        api.get<any>("/cases?groupBy=state"),
        api.get<any>("/employees/leaderboard"),
        api.get<any>("/payouts/pending"),
        api.get<any>("/payouts/anomalies")
      ]);

      // Process stats
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }

      // Process cases by state
      if (casesRes.data.success && casesRes.data.byState) {
        setCasesByState(casesRes.data.byState.slice(0, 10));
      }

      // Process top performers
      if (employeesRes.data.success) {
        setTopPerformers(employeesRes.data.data.slice(0, 5));
      }

      // Process pending payouts
      if (payoutsRes.data.success) {
        setPendingPayouts(payoutsRes.data.data.slice(0, 5));
      }

      // Process anomalies
      if (anomaliesRes.data.success) {
        setAnomalies(anomaliesRes.data.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
          >
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Founder Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded"
        >
          Refresh
        </button>
      </div>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div className="mb-6 space-y-2">
          {anomalies.filter(a => a.severity === "HIGH").map((anomaly, idx) => (
            <div key={idx} className="bg-red-900/30 border border-red-600 rounded-lg p-3 flex items-start gap-3">
              <span className="text-red-500 text-lg">!</span>
              <div>
                <p className="text-red-400 font-medium">{anomaly.type}</p>
                <p className="text-sm text-red-300">{anomaly.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SimpleStatCard
          label="Total Recovered"
          value={formatCurrency(stats?.totalRecoveredCents || 0)}
        />
        <SimpleStatCard
          label="Founder Share"
          value={formatCurrency(stats?.founderShareCents || 0)}
        />
        <SimpleStatCard
          label="Pending Payouts"
          value={formatCurrency(stats?.pendingPayoutsCents || 0)}
        />
        <SimpleStatCard
          label="Active Cases"
          value={String(stats?.activeCases || 0)}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Cases This Month</p>
          <p className="text-2xl font-semibold">{stats?.casesThisMonth || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Awaiting Funds</p>
          <p className="text-2xl font-semibold text-amber-400">{stats?.casesAwaitingFunds || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Active Employees</p>
          <p className="text-2xl font-semibold">{stats?.activeEmployees || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Fees Earned</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {formatCurrency(stats?.totalFeesCents || 0)}
          </p>
        </div>
      </div>

      {/* Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cases by State */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Recovery by State</h2>
          {casesByState.length === 0 ? (
            <p className="text-sm text-slate-400">No case data available</p>
          ) : (
            <div className="space-y-3">
              {casesByState.map((state) => (
                <div key={state.state} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-semibold text-emerald-400">
                      {state.state}
                    </span>
                    <span className="text-sm text-slate-400">
                      {state.count} cases
                    </span>
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(state.totalSurplusCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Top Performers</h2>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-slate-400">No employee data available</p>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((emp, idx) => (
                <div key={emp.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
                      ${idx === 0 ? "bg-amber-500 text-black" :
                        idx === 1 ? "bg-slate-400 text-black" :
                        idx === 2 ? "bg-amber-700 text-white" :
                        "bg-slate-700 text-slate-300"}
                    `}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.tier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(emp.revenueCents)}</p>
                    <p className="text-xs text-slate-400">{emp.casesCompleted} cases</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Payouts */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pending Payouts</h2>
          <Link
            to="/admin/banking"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            View All
          </Link>
        </div>
        {pendingPayouts.length === 0 ? (
          <p className="text-sm text-slate-400">No pending payouts</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-2 font-medium">Case</th>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium">Employee</th>
                  <th className="pb-2 font-medium text-right">Surplus</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayouts.map((payout) => (
                  <tr key={payout.caseId} className="border-b border-slate-800">
                    <td className="py-3 font-mono text-emerald-400">{payout.internalCode}</td>
                    <td className="py-3">{payout.client?.name || "—"}</td>
                    <td className="py-3">{payout.employee?.name || "Unassigned"}</td>
                    <td className="py-3 text-right font-semibold">
                      {formatCurrency(payout.surplusAmountCents)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/admin/cases/${payout.caseId}`}
                        className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 rounded"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Medium/Low Anomalies */}
      {anomalies.filter(a => a.severity !== "HIGH").length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>
          <div className="space-y-2">
            {anomalies.filter(a => a.severity !== "HIGH").map((anomaly, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg flex items-start gap-3 ${
                  anomaly.severity === "MEDIUM"
                    ? "bg-amber-900/20 border border-amber-700"
                    : "bg-slate-800 border border-slate-700"
                }`}
              >
                <span className={anomaly.severity === "MEDIUM" ? "text-amber-500" : "text-slate-400"}>
                  {anomaly.severity === "MEDIUM" ? "!" : "i"}
                </span>
                <div>
                  <p className={`font-medium ${anomaly.severity === "MEDIUM" ? "text-amber-400" : "text-slate-300"}`}>
                    {anomaly.type}
                  </p>
                  <p className="text-sm text-slate-400">{anomaly.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
