// ============================================
// ADMIN CASES PAGE — MGR CAPITAL ASSISTANCE
// Case management with full FOUNDER visibility
// ============================================

import { useState, useEffect } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

interface CaseData {
  id: string;
  internalCode: string;
  status: string;
  state: string;
  county: string;
  propertyAddress: string;
  surplusAmountCents: number;
  feePercent: number;
  createdAt: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  assignedEmployee: {
    id: string;
    name: string;
    email: string;
  } | null;
  documents: {
    id: string;
    type: string;
    status: string;
  }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "New", color: "bg-blue-900/50 text-blue-400" },
  CONTACTED: { label: "Contacted", color: "bg-purple-900/50 text-purple-400" },
  DOCS_PENDING: { label: "Docs Pending", color: "bg-amber-900/50 text-amber-400" },
  DOCS_SIGNED: { label: "Docs Signed", color: "bg-cyan-900/50 text-cyan-400" },
  FILED: { label: "Filed", color: "bg-indigo-900/50 text-indigo-400" },
  AWAITING_FUNDS: { label: "Awaiting Funds", color: "bg-emerald-900/50 text-emerald-400" },
  PAID: { label: "Paid", color: "bg-green-900/50 text-green-400" },
  CLOSED: { label: "Closed", color: "bg-slate-700 text-slate-300" },
  REJECTED: { label: "Rejected", color: "bg-red-900/50 text-red-400" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminCases() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<any>("/cases");
      if (response.data.success) {
        setCases(response.data.data || []);
      } else {
        setError(response.data.error || "Failed to load cases");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }

  // Filter cases
  const filteredCases = cases.filter((c) => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      c.internalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.propertyAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.county?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate stats
  const totalCases = cases.length;
  const totalSurplus = cases.reduce((sum, c) => sum + (c.surplusAmountCents || 0), 0);
  const activeCases = cases.filter((c) =>
    ["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED", "FILED", "AWAITING_FUNDS"].includes(c.status)
  ).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Case Management</h1>
        <button
          onClick={fetchCases}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
          <button onClick={fetchCases} className="ml-4 underline">
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Cases</p>
          <p className="text-2xl font-semibold">{totalCases}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Active Cases</p>
          <p className="text-2xl font-semibold text-emerald-400">{activeCases}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Surplus</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalSurplus)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Displayed Results</p>
          <p className="text-2xl font-semibold">{filteredCases.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search cases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
        >
          <option value="all">All Statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="DOCS_PENDING">Docs Pending</option>
          <option value="DOCS_SIGNED">Docs Signed</option>
          <option value="FILED">Filed</option>
          <option value="AWAITING_FUNDS">Awaiting Funds</option>
          <option value="PAID">Paid</option>
          <option value="CLOSED">Closed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Cases Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/50">
                <th className="px-4 py-3 font-medium">Case ID</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-right">Surplus</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    {cases.length === 0
                      ? "No cases found. Cases will appear here when imported or created."
                      : "No cases match your filters."}
                  </td>
                </tr>
              ) : (
                filteredCases.map((caseData) => {
                  const statusInfo = STATUS_LABELS[caseData.status] || {
                    label: caseData.status,
                    color: "bg-slate-700 text-slate-300",
                  };
                  return (
                    <tr
                      key={caseData.id}
                      className="border-b border-slate-800 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono text-emerald-400">
                        {caseData.internalCode}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{caseData.client?.name || "Unknown"}</p>
                          <p className="text-xs text-slate-400">{caseData.client?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 max-w-xs truncate">
                        {caseData.propertyAddress || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        {caseData.county}, {caseData.state}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(caseData.surplusAmountCents || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {caseData.assignedEmployee?.name || (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded mr-2">
                          View
                        </button>
                        <button className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded">
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
