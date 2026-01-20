// ============================================
// EMPLOYEE OFFICE PAGE — MGR CAPITAL ASSISTANCE
// Employee workspace with real data
// ============================================

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import EmployeeLayout from "../components/layout/EmployeeLayout";
import { api } from "../lib/api";

interface EmployeeCase {
  id: string;
  internalCode: string;
  status: string;
  propertyAddress: string;
  county: string;
  state: string;
  createdAt: string;
  client: {
    name: string;
    phone: string;
    email: string;
  };
  nextAction?: string;
}

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  employeeTier: string;
  displayedRatePercent: number;
}

interface EmployeeEarnings {
  lifetimeEarnedCents: number;
  currentMonthCents: number;
  pendingCents: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "New", color: "bg-blue-900/50 text-blue-400" },
  CONTACTED: { label: "Contacted", color: "bg-purple-900/50 text-purple-400" },
  DOCS_PENDING: { label: "Docs Pending", color: "bg-amber-900/50 text-amber-400" },
  DOCS_SIGNED: { label: "Docs Signed", color: "bg-cyan-900/50 text-cyan-400" },
  FILED: { label: "Filed", color: "bg-indigo-900/50 text-indigo-400" },
  AWAITING_FUNDS: { label: "Awaiting Funds", color: "bg-emerald-900/50 text-emerald-400" },
  PAID: { label: "Paid", color: "bg-green-900/50 text-green-400" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function EmployeeOffice() {
  const [cases, setCases] = useState<EmployeeCase[]>([]);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [earnings, setEarnings] = useState<EmployeeEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [casesRes, profileRes, earningsRes] = await Promise.all([
        api.get<any>("/cases/my"),
        api.get<any>("/employees/me"),
        api.get<any>("/payouts/my/summary"),
      ]);

      if (casesRes.data.success) {
        setCases(casesRes.data.data || []);
      }
      if (profileRes.data.success) {
        setProfile(profileRes.data.data);
      }
      if (earningsRes.data.success) {
        setEarnings(earningsRes.data.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
          <button onClick={fetchData} className="ml-4 underline">
            Retry
          </button>
        </div>
      )}

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Commission Rate</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {profile?.displayedRatePercent ? `${profile.displayedRatePercent}%` : "20%"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {profile?.employeeTier?.replace(/TIER_\d_/, "").replace(/_/g, " ") || "Associate"}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Lifetime Earnings</p>
          <p className="text-2xl font-semibold">
            {earnings ? formatCurrency(earnings.lifetimeEarnedCents) : "$0"}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">This Month</p>
          <p className="text-2xl font-semibold">
            {earnings ? formatCurrency(earnings.currentMonthCents) : "$0"}
          </p>
          {earnings && earnings.pendingCents > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              +{formatCurrency(earnings.pendingCents)} pending
            </p>
          )}
        </div>
      </div>

      {/* My Cases */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">My Cases</h1>
          <span className="text-sm text-slate-400">{cases.length} assigned</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {cases.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>No cases assigned yet.</p>
              <p className="text-sm mt-2">Cases will appear here when assigned to you.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/50">
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Property</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Next Action</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((caseData) => {
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
                            <p className="text-xs text-slate-400">{caseData.client?.phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <div>
                            <p className="truncate max-w-xs">{caseData.propertyAddress || "N/A"}</p>
                            <p className="text-xs text-slate-400">
                              {caseData.county}, {caseData.state}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {caseData.nextAction || "Follow up with client"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/office/cases/${caseData.id}`}
                            className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded inline-block"
                          >
                            Work Case
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Quick Scripts */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Quick Scripts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2 text-emerald-400">Initial Call Script</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              "Hey, is this [Name]? My name is [Your Name], I'm with MGR Capital Assistance.
              I'm reaching out because your property at [address] was recently sold by the county,
              and in some cases there's money left over that the owner can still claim. I'm not here
              to sell you anything — I just help people understand what's available and handle the
              paperwork if they decide to move forward. If you'd like, I can check your case and
              let you know what it looks like. There's no upfront cost."
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2 text-emerald-400">Follow-Up Script</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              "Hi [Name], this is [Your Name] from MGR Capital Assistance. I'm following up on
              the conversation we had about the funds from your property sale. I wanted to see
              if you had any questions or if you're ready to move forward with the paperwork.
              Remember, there's no upfront cost — we only get paid if we successfully recover
              your funds. Would you like me to walk you through the next steps?"
            </p>
          </div>
        </div>
      </section>
    </EmployeeLayout>
  );
}
