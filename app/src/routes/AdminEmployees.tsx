// ============================================
// ADMIN EMPLOYEES PAGE — MGR CAPITAL ASSISTANCE
// Employee management with shadow accounting visibility
// ============================================

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeTier: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: {
    assignedCases: number;
  };
}

// Maps to API tier values (TIER_1_ASSOCIATE, TIER_2_SPECIALIST, etc.)
const TIER_INFO: Record<string, { displayName: string; displayRate: string; actualRate: string; color: string }> = {
  TIER_1_ASSOCIATE: { displayName: "Associate", displayRate: "20%", actualRate: "10%", color: "text-slate-400" },
  TIER_2_SPECIALIST: { displayName: "Specialist", displayRate: "40%", actualRate: "20%", color: "text-blue-400" },
  TIER_3_SENIOR_SPECIALIST: { displayName: "Senior Specialist", displayRate: "60%", actualRate: "30%", color: "text-purple-400" },
  TIER_4_TEAM_LEADER: { displayName: "Team Leader", displayRate: "80%", actualRate: "40%", color: "text-amber-400" },
  TIER_5_EXECUTIVE_PARTNER: { displayName: "Executive Partner", displayRate: "100%", actualRate: "50%", color: "text-emerald-400" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const response = await api.get<any>("/employees");
      if (response.data.success) {
        setEmployees(response.data.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load employees");
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

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Employee Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium"
        >
          + Add Employee
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Tier Legend */}
      <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-slate-400">Commission Tiers (Shadow Accounting)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {Object.entries(TIER_INFO).map(([tier, info]) => (
            <div key={tier} className="text-center">
              <div className={`font-semibold ${info.color}`}>
                {info.displayName}
              </div>
              <div className="text-xs text-slate-500">
                Shows: {info.displayRate} | Actual: {info.actualRate}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/50">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Commission Rate</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Cases</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No employees found. Add your first employee to get started.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const tierKey = emp.employeeTier || "TIER_1_ASSOCIATE";
                const tierInfo = TIER_INFO[tierKey] || TIER_INFO.TIER_1_ASSOCIATE;
                return (
                  <tr key={emp.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${tierInfo.color}`}>
                        {tierInfo.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <span className="text-slate-400">Shows: {tierInfo.displayRate}</span>
                        <span className="mx-2 text-slate-600">|</span>
                        <span className="text-emerald-400">Actual: {tierInfo.actualRate}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        emp.isActive
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-red-900/50 text-red-400"
                      }`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{emp._count?.assignedCases || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/employees/${emp.id}`}
                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded mr-2 inline-block"
                      >
                        View
                      </Link>
                      <Link
                        to={`/admin/employees/${emp.id}/edit`}
                        className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded inline-block"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEmployees();
          }}
        />
      )}
    </AdminLayout>
  );
}

interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    employeeTier: "TIER_1_ASSOCIATE",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await api.post<any>("/employees", formData);
      if (response.data.success) {
        onSuccess();
      } else {
        setError(response.data.error || "Failed to create employee");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add New Employee</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Starting Tier</label>
            <select
              value={formData.employeeTier}
              onChange={(e) => setFormData({ ...formData, employeeTier: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            >
              <option value="TIER_1_ASSOCIATE">Associate (20% displayed / 10% actual)</option>
              <option value="TIER_2_SPECIALIST">Specialist (40% / 20%)</option>
              <option value="TIER_3_SENIOR_SPECIALIST">Senior Specialist (60% / 30%)</option>
              <option value="TIER_4_TEAM_LEADER">Team Leader (80% / 40%)</option>
              <option value="TIER_5_EXECUTIVE_PARTNER">Executive Partner (100% / 50%)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded text-sm font-medium"
            >
              {submitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
