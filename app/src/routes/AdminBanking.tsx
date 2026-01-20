// ============================================
// ADMIN BANKING PAGE — MGR CAPITAL ASSISTANCE
// Payouts, ledger entries, and financial management
// ============================================

import { useState, useEffect } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

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

interface LedgerEntry {
  id: string;
  type: string;
  amountCents: number;
  displayedAmountCents?: number;
  description: string;
  createdAt: string;
  status: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default function AdminBanking() {
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBankingData();
  }, []);

  async function fetchBankingData() {
    try {
      setLoading(true);
      const [payoutsRes, ledgerRes] = await Promise.all([
        api.get<any>("/payouts/pending"),
        api.get<any>("/payouts/ledger?limit=20"),
      ]);

      if (payoutsRes.data.success) {
        setPendingPayouts(payoutsRes.data.data || []);
      }
      if (ledgerRes.data.success) {
        setRecentLedger(ledgerRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load banking data");
    } finally {
      setLoading(false);
    }
  }

  async function processPayout(caseId: string) {
    setProcessingId(caseId);
    try {
      const response = await api.post<any>(`/payouts/process/${caseId}`, {});
      if (response.data.success) {
        // Refresh data
        fetchBankingData();
      } else {
        alert(response.data.error || "Failed to process payout");
      }
    } catch (err: any) {
      alert(err.message || "Failed to process payout");
    } finally {
      setProcessingId(null);
    }
  }

  // Calculate totals
  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.surplusAmountCents, 0);
  const totalFees = pendingPayouts.reduce((sum, p) => sum + (p.calculation?.companyFeeCents || 0), 0);
  const totalCommissions = pendingPayouts.reduce((sum, p) => sum + (p.calculation?.employeeCommissionCents || 0), 0);
  const totalFounderShare = pendingPayouts.reduce((sum, p) => sum + (p.calculation?.founderShareCents || 0), 0);

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
        <h1 className="text-2xl font-semibold">Banking & Payouts</h1>
        <button
          onClick={fetchBankingData}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Pending</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Company Fees</p>
          <p className="text-2xl font-semibold text-emerald-400">{formatCurrency(totalFees)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Employee Commissions</p>
          <p className="text-2xl font-semibold text-blue-400">{formatCurrency(totalCommissions)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Founder Share</p>
          <p className="text-2xl font-semibold text-amber-400">{formatCurrency(totalFounderShare)}</p>
        </div>
      </div>

      {/* Pending Payouts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
          <h2 className="font-semibold">Pending Payouts ({pendingPayouts.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="px-4 py-3 font-medium">Case</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium text-right">Surplus</th>
                <th className="px-4 py-3 font-medium text-right">Fee (35%)</th>
                <th className="px-4 py-3 font-medium text-right">Commission</th>
                <th className="px-4 py-3 font-medium text-right">Founder</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No pending payouts. Cases must reach AWAITING_FUNDS status first.
                  </td>
                </tr>
              ) : (
                pendingPayouts.map((payout) => (
                  <tr key={payout.caseId} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400">{payout.internalCode}</td>
                    <td className="px-4 py-3">{payout.client?.name || "Unknown"}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p>{payout.employee?.name || "Unassigned"}</p>
                        <p className="text-xs text-slate-400">{payout.employee?.employeeTier?.replace(/TIER_\d_/, "") || ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(payout.surplusAmountCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      {formatCurrency(payout.calculation?.companyFeeCents || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      {formatCurrency(payout.calculation?.employeeCommissionCents || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400">
                      {formatCurrency(payout.calculation?.founderShareCents || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => processPayout(payout.caseId)}
                        disabled={processingId === payout.caseId}
                        className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 rounded"
                      >
                        {processingId === payout.caseId ? "Processing..." : "Process"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Ledger Entries */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
          <h2 className="font-semibold">Recent Ledger Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLedger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No ledger entries yet.
                  </td>
                </tr>
              ) : (
                recentLedger.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.type === "EMPLOYEE_COMMISSION"
                          ? "bg-blue-900/50 text-blue-400"
                          : entry.type === "COMPANY_FEE"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-slate-700 text-slate-300"
                      }`}>
                        {entry.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(entry.amountCents)}
                      {entry.displayedAmountCents && entry.displayedAmountCents !== entry.amountCents && (
                        <span className="block text-xs text-slate-400">
                          (Shows: {formatCurrency(entry.displayedAmountCents)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.status === "COMPLETED"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : entry.status === "PENDING"
                          ? "bg-amber-900/50 text-amber-400"
                          : "bg-slate-700 text-slate-300"
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
