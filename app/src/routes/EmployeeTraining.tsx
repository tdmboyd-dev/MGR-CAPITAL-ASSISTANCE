// ============================================
// EMPLOYEE TRAINING PAGE — MGR CAPITAL ASSISTANCE
// Training modules with real data
// ============================================

import { useState, useEffect } from "react";
import EmployeeLayout from "../components/layout/EmployeeLayout";
import { api } from "../lib/api";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  tier: string;
  orderIndex: number;
  content?: string;
  videoUrl?: string;
}

interface ModuleProgress {
  moduleId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  score?: number;
  completedAt?: string;
}

interface TrainingData {
  modules: TrainingModule[];
  progress: ModuleProgress[];
  overallProgress: number;
}

export default function EmployeeTraining() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);

  useEffect(() => {
    fetchTrainingData();
  }, []);

  async function fetchTrainingData() {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<any>("/employees/me/training");

      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.error || "Failed to load training data");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load training data");
    } finally {
      setLoading(false);
    }
  }

  function getModuleStatus(moduleId: string): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" {
    if (!data?.progress) return "NOT_STARTED";
    const progress = data.progress.find((p) => p.moduleId === moduleId);
    return progress?.status || "NOT_STARTED";
  }

  function getStatusLabel(status: string): { label: string; color: string } {
    switch (status) {
      case "COMPLETED":
        return { label: "Completed", color: "bg-emerald-900/50 text-emerald-400" };
      case "IN_PROGRESS":
        return { label: "In Progress", color: "bg-amber-900/50 text-amber-400" };
      default:
        return { label: "Not Started", color: "bg-slate-700 text-slate-400" };
    }
  }

  async function startModule(module: TrainingModule) {
    setActiveModule(module);

    try {
      await api.get<any>(`/employees/me/training/${module.id}`);
    } catch (err) {
      // Module will still be shown, progress tracking may fail
    }
  }

  async function completeModule(moduleId: string) {
    try {
      const response = await api.post<any>(`/employees/me/training/${moduleId}/quiz`, {
        answers: [], // In full implementation, would include quiz answers
      });

      if (response.data.success) {
        fetchTrainingData();
        setActiveModule(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to complete module");
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

  // Module detail view
  if (activeModule) {
    return (
      <EmployeeLayout>
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setActiveModule(null)}
            className="text-sm text-slate-400 hover:text-white mb-4"
          >
            ← Back to Training
          </button>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h1 className="text-xl font-semibold mb-2">{activeModule.title}</h1>
            <p className="text-sm text-slate-400 mb-6">{activeModule.description}</p>

            {/* Module Content */}
            <div className="prose prose-invert prose-sm max-w-none mb-6">
              <div className="bg-slate-800 rounded-lg p-4 text-slate-300 text-sm leading-relaxed">
                {activeModule.content || (
                  <>
                    <h3 className="text-emerald-400 font-semibold mb-3">Module Overview</h3>
                    <p className="mb-4">
                      This training module covers essential skills and knowledge for your role at
                      MGR Capital Assistance. Complete all sections to unlock the next module.
                    </p>

                    <h3 className="text-emerald-400 font-semibold mb-3">Key Points</h3>
                    <ul className="list-disc list-inside space-y-2 mb-4">
                      <li>Always be friendly, human, and clear in communication</li>
                      <li>Never reveal backend logic, surplus amounts, or filing strategy</li>
                      <li>Use the provided scripts as a guide, not a rigid template</li>
                      <li>Focus on helping the client understand the opportunity</li>
                      <li>There is no upfront cost - we only get paid on success</li>
                    </ul>

                    <h3 className="text-emerald-400 font-semibold mb-3">Compliance Reminder</h3>
                    <p>
                      Always maintain professional boundaries. Do not make promises about specific
                      amounts or timelines. Refer complex questions to your supervisor.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActiveModule(null)}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded"
              >
                Save & Exit
              </button>
              <button
                onClick={() => completeModule(activeModule.id)}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded font-medium"
              >
                Mark as Complete
              </button>
            </div>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  // Module list view
  return (
    <EmployeeLayout>
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
          {error}
          <button onClick={fetchTrainingData} className="ml-4 underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Training</h1>
        {data && (
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${data.overallProgress || 0}%` }}
              />
            </div>
            <span className="text-sm text-slate-400">{data.overallProgress || 0}% Complete</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {!data?.modules || data.modules.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
            <p>No training modules available.</p>
            <p className="text-sm mt-2">Check back later for new training content.</p>
          </div>
        ) : (
          data.modules.map((module, idx) => {
            const status = getModuleStatus(module.id);
            const statusInfo = getStatusLabel(status);
            const isLocked = idx > 0 && getModuleStatus(data.modules[idx - 1].id) !== "COMPLETED";

            return (
              <div
                key={module.id}
                className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${
                  isLocked ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">Module {idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{module.title}</h3>
                    <p className="text-xs text-slate-400">{module.description}</p>
                  </div>
                  <button
                    onClick={() => !isLocked && startModule(module)}
                    disabled={isLocked}
                    className={`px-4 py-2 rounded text-xs font-medium ${
                      isLocked
                        ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                        : status === "COMPLETED"
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-emerald-600 text-white hover:bg-emerald-500"
                    }`}
                  >
                    {isLocked ? "Locked" : status === "COMPLETED" ? "Review" : status === "IN_PROGRESS" ? "Continue" : "Start"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3 text-emerald-400">Training Tips</h2>
        <ul className="text-xs text-slate-300 space-y-2">
          <li>• Complete modules in order to unlock new content</li>
          <li>• Review completed modules anytime to refresh your knowledge</li>
          <li>• Higher tier training unlocks as you advance in rank</li>
          <li>• Training completion is tracked and contributes to your performance metrics</li>
        </ul>
      </div>
    </EmployeeLayout>
  );
}
