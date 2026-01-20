// ============================================
// ADMIN TRAINING PAGE — MGR CAPITAL ASSISTANCE
// Training module management for FOUNDER
// ============================================

import { useState, useEffect } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { api } from "../lib/api";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  tier: string;
  orderIndex: number;
  isActive: boolean;
  _count?: {
    employeeProgress: number;
  };
}

interface EmployeeProgress {
  id: string;
  name: string;
  email: string;
  completedModules: number;
  totalModules: number;
  lastActivity: string;
}

export default function AdminTraining() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [employeeProgress, setEmployeeProgress] = useState<EmployeeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "progress">("modules");

  useEffect(() => {
    fetchTrainingData();
  }, []);

  async function fetchTrainingData() {
    try {
      setLoading(true);
      setError(null);

      const [modulesRes, progressRes] = await Promise.all([
        api.get<any>("/training/modules"),
        api.get<any>("/training/progress"),
      ]);

      if (modulesRes.data.success) {
        setModules(modulesRes.data.data || []);
      }
      if (progressRes.data.success) {
        setEmployeeProgress(progressRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load training data");
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
        <h1 className="text-2xl font-semibold">Training Management</h1>
        <button
          onClick={fetchTrainingData}
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("modules")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "modules"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Training Modules
        </button>
        <button
          onClick={() => setActiveTab("progress")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "progress"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Employee Progress
        </button>
      </div>

      {/* Modules Tab */}
      {activeTab === "modules" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">
              Manage training modules for different employee tiers.
            </p>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium">
              + Add Module
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Required Tier</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Completions</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No training modules found. Create your first module to get started.
                    </td>
                  </tr>
                ) : (
                  modules.map((module) => (
                    <tr key={module.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{module.title}</p>
                          <p className="text-xs text-slate-400 truncate max-w-xs">
                            {module.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                          {module.tier || "All"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{module.orderIndex}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            module.isActive
                              ? "bg-emerald-900/50 text-emerald-400"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {module.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {module._count?.employeeProgress || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded mr-2">
                          Edit
                        </button>
                        <button className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded">
                          {module.isActive ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Track employee training completion across all modules.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Completion</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {employeeProgress.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No employee progress data available.
                    </td>
                  </tr>
                ) : (
                  employeeProgress.map((emp) => {
                    const percent =
                      emp.totalModules > 0
                        ? Math.round((emp.completedModules / emp.totalModules) * 100)
                        : 0;
                    return (
                      <tr key={emp.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <p className="text-xs text-slate-400">{emp.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">
                              {emp.completedModules}/{emp.totalModules}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              percent === 100
                                ? "bg-emerald-900/50 text-emerald-400"
                                : percent >= 50
                                ? "bg-amber-900/50 text-amber-400"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {percent}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {emp.lastActivity
                            ? new Date(emp.lastActivity).toLocaleDateString()
                            : "Never"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
