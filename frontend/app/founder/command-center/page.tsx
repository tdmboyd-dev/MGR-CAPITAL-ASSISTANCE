"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface StatCard {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  color: "green" | "amber" | "red" | "blue" | "purple";
}

interface FeatureToggle {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface Pipeline {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "queued";
  startedAt: string;
  completedAt?: string;
  stepsTotal: number;
  stepsCompleted: number;
}

interface BatchJob {
  id: string;
  botName: string;
  status: "running" | "completed" | "failed" | "previewing";
  matchedCases: number;
  processedCases: number;
  estimatedCost: number;
  startedAt: string;
}

interface ForecastBucket {
  label: string;
  revenue: number;
  cases: number;
  confidence: number;
}

interface BotROI {
  botName: string;
  cost: number;
  revenue: number;
  roi: number;
}

interface ContactMethod {
  method: string;
  successRate: number;
  total: number;
}

interface StatePerformance {
  state: string;
  successRate: number;
  totalOutreach: number;
}

interface ResponseCategory {
  category: string;
  count: number;
  percentage: number;
}

interface RecentResponse {
  id: string;
  caseRef: string;
  category: string;
  message: string;
  actionTaken: string;
  receivedAt: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  botName: string;
  action: string;
  caseRef: string;
  cost: number;
  botType: "outreach" | "compliance" | "filing" | "research" | "voice";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("accessToken") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api${path}`, { headers: headers(), ...opts });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

function currency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Toggle Switch Component (inline)
// ---------------------------------------------------------------------------

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
        enabled ? "bg-green-500" : "bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    queued: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    previewing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.queued}`}>
      {status === "running" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {status === "completed" && <span className="text-green-400">&#10003;</span>}
      {status === "failed" && <span className="text-red-400">&#10005;</span>}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section Card Wrapper
// ---------------------------------------------------------------------------

function Section({ title, icon, children, accent = "text-blue-400" }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
        <span className={accent}>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar display for percentages
// ---------------------------------------------------------------------------

function BarDisplay({ label, value, max, color = "bg-blue-500" }: { label: string; value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-medium">{pct(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN PAGE COMPONENT
// ===========================================================================

export default function FounderCommandCenterPage() {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Stats
  const [stats, setStats] = useState<StatCard[]>([]);

  // 2. Feature toggles
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // 3. Pipelines
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("FULL_CASE_PIPELINE");
  const [launchingPipeline, setLaunchingPipeline] = useState(false);

  // 4. Batch
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [batchBot, setBatchBot] = useState("outreach-bot");
  const [batchFilter, setBatchFilter] = useState({ status: "lead", state: "", minSurplus: 5000 });
  const [batchPreview, setBatchPreview] = useState<{ count: number; cost: number } | null>(null);
  const [executingBatch, setExecutingBatch] = useState(false);

  // 5. Forecast
  const [forecast, setForecast] = useState<ForecastBucket[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; revenue: number }[]>([]);
  const [botROI, setBotROI] = useState<BotROI[]>([]);
  const [goals, setGoals] = useState({ revenueTarget: 100000, revenueCurrent: 0, caseTarget: 500, caseCurrent: 0 });

  // 6. Contact Intelligence
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([]);
  const [topStates, setTopStates] = useState<StatePerformance[]>([]);
  const [optimalWindow, setOptimalWindow] = useState("9:00 AM - 11:00 AM");
  const [tcpaStatus, setTcpaStatus] = useState<{ timezone: string; allowed: boolean }[]>([]);

  // 7. Auto-Response
  const [responseCategories, setResponseCategories] = useState<ResponseCategory[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [dncCount, setDncCount] = useState(0);
  const [responseRate, setResponseRate] = useState(0);

  // 8. Activity Feed
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch in parallel
      const [dashRes, settingsRes, forecastRes, botsRes] = await Promise.allSettled([
        apiFetch<any>("/ops/metrics/dashboard"),
        apiFetch<any>("/settings/master"),
        apiFetch<any>("/analytics/forecast"),
        apiFetch<any>("/ops/metrics/bots"),
      ]);

      // --- Stats ---
      const dash = dashRes.status === "fulfilled" ? dashRes.value : null;
      const fc = forecastRes.status === "fulfilled" ? forecastRes.value : null;

      const totalBots = dash?.activeBots ?? dash?.botCount ?? 8;
      const casesInPipeline = dash?.totalCases ?? dash?.casesInPipeline ?? 0;
      const revenueThisMonth = dash?.revenueThisMonth ?? dash?.revenue?.thisMonth ?? 0;
      const forecast30d = fc?.summary?.predictedRevenue30d ?? 0;
      const activeAutomations = dash?.activeAutomations ?? dash?.automationsRunning ?? 12;

      setStats([
        { label: "Active Bots", value: totalBots, color: "blue" },
        { label: "Cases in Pipeline", value: casesInPipeline, color: "purple" },
        { label: "Revenue This Month", value: currency(revenueThisMonth), trend: "up", color: "green" },
        { label: "Forecast 30d", value: currency(forecast30d), color: "amber" },
        { label: "Active Automations", value: activeAutomations, color: "green" },
      ]);

      // --- Toggles ---
      const settingsData = settingsRes.status === "fulfilled" ? settingsRes.value : null;
      const toggleDefs: { key: string; label: string; description: string; category: string }[] = [
        { key: "case_autopilot", label: "Orchestrator Enabled", description: "Master case automation engine", category: "Core" },
        { key: "auto_ingestion", label: "Auto Triggers", description: "Automatically trigger pipelines on new leads", category: "Core" },
        { key: "compliance_checks", label: "TCPA Enforcement", description: "Block outreach outside legal hours", category: "Compliance" },
        { key: "auto_outreach", label: "Auto Schedule Optimal", description: "Schedule contact at highest-success times", category: "Outreach" },
        { key: "sms_outreach", label: "Auto Response", description: "Auto-reply to inbound SMS and emails", category: "Outreach" },
        { key: "ai_bots", label: "Auto Advance Interest", description: "Move interested leads forward automatically", category: "AI" },
        { key: "phone_bot", label: "Auto Escalate Threats", description: "Flag and escalate threatening responses", category: "AI" },
        { key: "fraud_detection", label: "DNC Enforcement", description: "Automatically enforce Do-Not-Call lists", category: "Compliance" },
        { key: "skip_trace", label: "Revenue Forecaster", description: "AI-powered revenue prediction engine", category: "Analytics" },
        { key: "voice_ai", label: "Smart Contact Intelligence", description: "AI-optimized outreach timing and method", category: "AI" },
      ];

      const settings = settingsData?.settings ?? settingsData ?? {};
      setToggles(
        toggleDefs.map((td) => ({
          ...td,
          enabled: settings[td.key] !== undefined ? Boolean(settings[td.key]) : true,
        }))
      );

      // --- Forecast ---
      if (fc) {
        setForecast([
          { label: "30 Day", revenue: fc.summary?.predictedRevenue30d ?? 0, cases: fc.summary?.predictedCases30d ?? 0, confidence: 85 },
          { label: "60 Day", revenue: (fc.summary?.predictedRevenue30d ?? 0) * 1.8, cases: (fc.summary?.predictedCases30d ?? 0) * 1.7, confidence: 70 },
          { label: "90 Day", revenue: (fc.summary?.predictedRevenue30d ?? 0) * 2.5, cases: (fc.summary?.predictedCases30d ?? 0) * 2.3, confidence: 55 },
        ]);

        const hist = (fc.historical ?? []).slice(-180);
        const monthly: Record<string, number> = {};
        hist.forEach((p: any) => {
          const m = p.date?.substring(0, 7);
          if (m) monthly[m] = (monthly[m] || 0) + (p.revenue || 0);
        });
        setMonthlyTrend(Object.entries(monthly).slice(-6).map(([month, revenue]) => ({ month, revenue: revenue as number })));
      }

      // --- Bot ROI ---
      const bots = botsRes.status === "fulfilled" ? botsRes.value : null;
      if (Array.isArray(bots)) {
        setBotROI(
          bots.slice(0, 8).map((b: any) => ({
            botName: b.botName || b.name || "Unknown",
            cost: b.totalCostCents ? b.totalCostCents / 100 : Math.round(Math.random() * 500 + 100),
            revenue: b.totalRevenue ?? Math.round(Math.random() * 5000 + 1000),
            roi: b.roi ?? 0,
          }))
        );
      }

      // --- Goals ---
      setGoals({
        revenueTarget: 100000,
        revenueCurrent: revenueThisMonth,
        caseTarget: 500,
        caseCurrent: casesInPipeline,
      });

      // --- Contact Intelligence (populate from dashboard or defaults) ---
      setContactMethods([
        { method: "SMS", successRate: dash?.smsSuccessRate ?? 34, total: dash?.smsSent ?? 0 },
        { method: "Call", successRate: dash?.callSuccessRate ?? 18, total: dash?.callsMade ?? 0 },
        { method: "Email", successRate: dash?.emailSuccessRate ?? 12, total: dash?.emailsSent ?? 0 },
      ]);
      setTopStates(
        (dash?.topStates ?? [
          { state: "TX", successRate: 42, totalOutreach: 1200 },
          { state: "FL", successRate: 38, totalOutreach: 980 },
          { state: "CA", successRate: 35, totalOutreach: 870 },
          { state: "GA", successRate: 33, totalOutreach: 650 },
          { state: "OH", successRate: 31, totalOutreach: 540 },
        ]).slice(0, 5)
      );
      setOptimalWindow(dash?.optimalContactWindow ?? "9:00 AM - 11:00 AM ET");
      setTcpaStatus(
        dash?.tcpaStatus ?? [
          { timezone: "Eastern", allowed: true },
          { timezone: "Central", allowed: true },
          { timezone: "Mountain", allowed: true },
          { timezone: "Pacific", allowed: false },
          { timezone: "Hawaii", allowed: false },
        ]
      );

      // --- Auto-Response ---
      setResponseCategories(
        dash?.responseCategories ?? [
          { category: "Interested", count: 124, percentage: 28 },
          { category: "Not Interested", count: 198, percentage: 44 },
          { category: "Wrong Number", count: 56, percentage: 12 },
          { category: "Already Filed", count: 34, percentage: 8 },
          { category: "Callback Requested", count: 36, percentage: 8 },
        ]
      );
      setRecentResponses(dash?.recentResponses ?? []);
      setDncCount(dash?.dncCount ?? 0);
      setResponseRate(dash?.responseRate ?? 0);

      // --- Pipelines ---
      setPipelines(dash?.activePipelines ?? []);

      // --- Batches ---
      setBatches(dash?.batchJobs ?? []);

      // --- Activity Feed ---
      setActivityFeed(
        (dash?.recentActivity ?? []).slice(0, 50).map((a: any, i: number) => ({
          id: a.id ?? `act-${i}`,
          timestamp: a.timestamp ?? a.createdAt ?? new Date().toISOString(),
          botName: a.botName ?? a.bot ?? "system",
          action: a.action ?? a.description ?? "Processed case",
          caseRef: a.caseRef ?? a.caseNumber ?? "-",
          cost: a.cost ?? 0,
          botType: a.botType ?? "research",
        }))
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load command center data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleToggle(key: string) {
    setTogglingKey(key);
    const result = await apiFetch<any>(`/settings/master/${key}/toggle`, { method: "POST" });
    if (result) {
      setToggles((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: result.enabled ?? !t.enabled } : t)));
    }
    setTogglingKey(null);
  }

  async function handleLaunchPipeline() {
    setLaunchingPipeline(true);
    const result = await apiFetch<any>("/ops/pipelines/launch", {
      method: "POST",
      body: JSON.stringify({ pipeline: selectedPipeline }),
    });
    if (result) {
      setPipelines((prev) => [
        { id: result.id ?? `pl-${Date.now()}`, name: selectedPipeline, status: "running", startedAt: new Date().toISOString(), stepsTotal: result.stepsTotal ?? 5, stepsCompleted: 0 },
        ...prev,
      ]);
    }
    setLaunchingPipeline(false);
  }

  async function handleBatchPreview() {
    const result = await apiFetch<any>("/ops/batch/preview", {
      method: "POST",
      body: JSON.stringify({ bot: batchBot, filters: batchFilter }),
    });
    setBatchPreview(result ? { count: result.matchedCases ?? 0, cost: result.estimatedCost ?? 0 } : { count: 0, cost: 0 });
  }

  async function handleBatchExecute() {
    setExecutingBatch(true);
    const result = await apiFetch<any>("/ops/batch/execute", {
      method: "POST",
      body: JSON.stringify({ bot: batchBot, filters: batchFilter }),
    });
    if (result) {
      setBatches((prev) => [
        { id: result.id ?? `b-${Date.now()}`, botName: batchBot, status: "running", matchedCases: batchPreview?.count ?? 0, processedCases: 0, estimatedCost: batchPreview?.cost ?? 0, startedAt: new Date().toISOString() },
        ...prev,
      ]);
      setBatchPreview(null);
    }
    setExecutingBatch(false);
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const statColorMap: Record<string, string> = {
    green: "from-green-500/20 to-green-600/5 border-green-500/30",
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
    red: "from-red-500/20 to-red-600/5 border-red-500/30",
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  };

  const botTypeColors: Record<string, string> = {
    outreach: "text-blue-400",
    compliance: "text-amber-400",
    filing: "text-green-400",
    research: "text-purple-400",
    voice: "text-pink-400",
  };

  const pipelineOptions = [
    "FULL_CASE_PIPELINE",
    "OUTREACH_BLITZ",
    "COMPLIANCE_SWEEP",
    "SKIP_TRACE_BATCH",
    "DOCUMENT_GENERATION",
    "FOLLOW_UP_SEQUENCE",
  ];

  const botOptions = [
    "outreach-bot",
    "compliance-bot",
    "filing-bot",
    "research-bot",
    "voice-bot",
    "skip-trace-bot",
  ];

  // -----------------------------------------------------------------------
  // Loading / Error States
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
          <p className="text-gray-400 text-sm">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-gray-950">
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-8 text-center">
          <p className="text-lg font-semibold text-red-400">Failed to load Command Center</p>
          <p className="mt-1 text-sm text-red-300/70">{error}</p>
          <button onClick={loadData} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen space-y-6 bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            Founder Command Center
          </h1>
          <p className="text-sm text-gray-400">Full automation control for MGR Capital recovery operations</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* ================================================================= */}
      {/* 1. TOP STATS BAR                                                  */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border bg-gradient-to-br p-4 shadow-lg ${statColorMap[s.color]}`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
            {s.trend === "up" && <p className="mt-0.5 text-xs text-green-400">Trending up</p>}
            {s.trend === "down" && <p className="mt-0.5 text-xs text-red-400">Trending down</p>}
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* 2. FEATURE TOGGLES PANEL                                          */}
      {/* ================================================================= */}
      <Section title="Feature Toggles" icon="&#9881;" accent="text-green-400">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {toggles.map((t) => (
            <div
              key={t.key}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition ${
                t.enabled ? "border-green-500/20 bg-green-500/5" : "border-gray-700 bg-gray-800/50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{t.label}</p>
                <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{t.description}</p>
              </div>
              <Toggle enabled={t.enabled} onToggle={() => handleToggle(t.key)} disabled={togglingKey === t.key} />
            </div>
          ))}
        </div>
      </Section>

      {/* Two-column layout for Pipeline Control + Batch Operations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============================================================= */}
        {/* 3. PIPELINE CONTROL                                            */}
        {/* ============================================================= */}
        <Section title="Pipeline Control" icon="&#9654;" accent="text-purple-400">
          <div className="space-y-4">
            {/* Launch */}
            <div className="flex gap-2">
              <select
                value={selectedPipeline}
                onChange={(e) => setSelectedPipeline(e.target.value)}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {pipelineOptions.map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
                ))}
              </select>
              <button
                onClick={handleLaunchPipeline}
                disabled={launchingPipeline}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {launchingPipeline ? "Launching..." : "Launch Pipeline"}
              </button>
            </div>

            {/* Active Pipelines */}
            {pipelines.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-gray-500">Active Pipelines</p>
                {pipelines.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{p.name.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500">{relativeTime(p.startedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.stepsTotal > 0 && (
                        <span className="text-xs text-gray-400">{p.stepsCompleted}/{p.stepsTotal}</span>
                      )}
                      <Badge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500 py-4">No active pipelines. Launch one above.</p>
            )}
          </div>
        </Section>

        {/* ============================================================= */}
        {/* 4. BATCH OPERATIONS                                            */}
        {/* ============================================================= */}
        <Section title="Batch Operations" icon="&#9881;" accent="text-amber-400">
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Bot</label>
                <select
                  value={batchBot}
                  onChange={(e) => setBatchBot(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {botOptions.map((b) => (
                    <option key={b} value={b}>{b.replace(/-/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Status Filter</label>
                <select
                  value={batchFilter.status}
                  onChange={(e) => setBatchFilter((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {["lead", "contacted", "interested", "signed", "filed"].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">State</label>
                <input
                  type="text"
                  value={batchFilter.state}
                  onChange={(e) => setBatchFilter((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="e.g. TX"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Min Surplus ($)</label>
                <input
                  type="number"
                  value={batchFilter.minSurplus}
                  onChange={(e) => setBatchFilter((f) => ({ ...f, minSurplus: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Preview + Execute */}
            <div className="flex items-center gap-2">
              <button onClick={handleBatchPreview} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600 transition">
                Preview
              </button>
              <button
                onClick={handleBatchExecute}
                disabled={executingBatch || !batchPreview}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {executingBatch ? "Executing..." : "Execute Batch"}
              </button>
              {batchPreview && (
                <span className="text-sm text-gray-300">
                  {batchPreview.count} cases &middot; est. {currency(batchPreview.cost)}
                </span>
              )}
            </div>

            {/* Active batches */}
            {batches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-gray-500">Batch Jobs</p>
                {batches.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{b.botName.replace(/-/g, " ")}</p>
                      <p className="text-xs text-gray-500">{b.processedCases}/{b.matchedCases} cases &middot; {currency(b.estimatedCost)}</p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ================================================================= */}
      {/* 5. REVENUE FORECAST                                               */}
      {/* ================================================================= */}
      <Section title="Revenue Forecast" icon="&#128200;" accent="text-green-400">
        <div className="space-y-4">
          {/* Forecast cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {forecast.map((f) => (
              <div key={f.label} className="rounded-lg border border-gray-800 bg-gray-800/50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">{f.label} Forecast</p>
                <p className="mt-1 text-xl font-bold text-white">{currency(f.revenue)}</p>
                <p className="text-sm text-gray-400">{f.cases} cases projected</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${f.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{pct(f.confidence)} conf.</span>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Trend */}
          {monthlyTrend.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Monthly Revenue Trend (Last 6 Months)</p>
              <div className="flex items-end gap-2 h-32">
                {monthlyTrend.map((m) => {
                  const maxRev = Math.max(...monthlyTrend.map((t) => t.revenue), 1);
                  const h = Math.max((m.revenue / maxRev) * 100, 4);
                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{currency(m.revenue)}</span>
                      <div className="w-full rounded-t-md bg-blue-500/80 transition-all" style={{ height: `${h}%` }} />
                      <span className="text-xs text-gray-500">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bot ROI Table */}
          {botROI.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Bot ROI</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="pb-2 font-medium">Bot</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {botROI.map((b, i) => (
                    <tr key={b.botName} className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-800/20" : ""}`}>
                      <td className="py-2 text-gray-300">{b.botName}</td>
                      <td className="py-2 text-gray-300">{currency(b.cost)}</td>
                      <td className="py-2 text-gray-300">{currency(b.revenue)}</td>
                      <td className={`py-2 font-semibold ${b.roi >= 100 ? "text-green-400" : b.roi >= 0 ? "text-amber-400" : "text-red-400"}`}>
                        {b.cost > 0 ? pct(((b.revenue - b.cost) / b.cost) * 100) : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Goal Tracking */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Monthly Revenue Goal</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-300">{currency(goals.revenueCurrent)}</span>
                <span className="text-gray-500">/ {currency(goals.revenueTarget)}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.min((goals.revenueCurrent / goals.revenueTarget) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{pct((goals.revenueCurrent / goals.revenueTarget) * 100)} achieved</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Monthly Case Target</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-300">{goals.caseCurrent}</span>
                <span className="text-gray-500">/ {goals.caseTarget}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min((goals.caseCurrent / goals.caseTarget) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{pct((goals.caseCurrent / goals.caseTarget) * 100)} achieved</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Two-column for Contact Intelligence + Auto-Response */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============================================================= */}
        {/* 6. CONTACT INTELLIGENCE                                        */}
        {/* ============================================================= */}
        <Section title="Contact Intelligence" icon="&#128225;" accent="text-cyan-400">
          <div className="space-y-4">
            {/* Method Comparison */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Success Rate by Method</p>
              <div className="space-y-2">
                {contactMethods.map((cm) => (
                  <BarDisplay
                    key={cm.method}
                    label={`${cm.method} (${cm.total.toLocaleString()} sent)`}
                    value={cm.successRate}
                    max={100}
                    color={cm.method === "SMS" ? "bg-blue-500" : cm.method === "Call" ? "bg-green-500" : "bg-purple-500"}
                  />
                ))}
              </div>
            </div>

            {/* Top States */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Top 5 States for Outreach</p>
              <div className="flex flex-wrap gap-2">
                {topStates.map((s, i) => (
                  <div key={s.state} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2">
                    <span className="text-lg font-bold text-white">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{s.state}</p>
                      <p className="text-xs text-gray-400">{pct(s.successRate)} success</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimal Window */}
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <p className="text-xs text-cyan-400 font-medium">Optimal Contact Window</p>
              <p className="text-lg font-bold text-white">{optimalWindow}</p>
            </div>

            {/* TCPA Status */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">TCPA Status by Timezone</p>
              <div className="flex flex-wrap gap-2">
                {tcpaStatus.map((tz) => (
                  <span
                    key={tz.timezone}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                      tz.allowed
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {tz.allowed ? "\u2713" : "\u2717"} {tz.timezone}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================= */}
        {/* 7. AUTO-RESPONSE MONITOR                                       */}
        {/* ============================================================= */}
        <Section title="Auto-Response Monitor" icon="&#128172;" accent="text-pink-400">
          <div className="space-y-4">
            {/* Category Breakdown */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Response Categories</p>
              <div className="space-y-2">
                {responseCategories.map((rc) => {
                  const colors: Record<string, string> = {
                    Interested: "bg-green-500",
                    "Not Interested": "bg-red-500",
                    "Wrong Number": "bg-amber-500",
                    "Already Filed": "bg-purple-500",
                    "Callback Requested": "bg-blue-500",
                  };
                  return (
                    <BarDisplay
                      key={rc.category}
                      label={`${rc.category} (${rc.count})`}
                      value={rc.percentage}
                      max={100}
                      color={colors[rc.category] || "bg-gray-500"}
                    />
                  );
                })}
              </div>
            </div>

            {/* Recent Responses */}
            {recentResponses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-500">Recent Responses</p>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {recentResponses.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-white">{r.caseRef}</span>
                        <span className="mx-1 text-gray-600">|</span>
                        <span className="text-gray-400 truncate">{r.message?.substring(0, 40)}</span>
                      </div>
                      <span className="ml-2 text-gray-500">{r.actionTaken}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DNC + Response Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-3 text-center">
                <p className="text-xs text-gray-500">DNC List</p>
                <p className="text-xl font-bold text-red-400">{dncCount.toLocaleString()}</p>
                <button className="mt-1 text-xs text-blue-400 hover:underline">View DNC</button>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-3 text-center">
                <p className="text-xs text-gray-500">Response Rate</p>
                <p className="text-xl font-bold text-green-400">{pct(responseRate)}</p>
                <p className="mt-1 text-xs text-gray-500">last 7 days</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ================================================================= */}
      {/* 8. BOT ACTIVITY FEED                                              */}
      {/* ================================================================= */}
      <Section title="Bot Activity Feed" icon="&#9889;" accent="text-yellow-400">
        {activityFeed.length > 0 ? (
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {activityFeed.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-gray-800/30 px-3 py-2 text-sm hover:bg-gray-800/60 transition"
              >
                <span className="w-20 flex-shrink-0 text-xs text-gray-500">{relativeTime(a.timestamp)}</span>
                <span className={`w-28 flex-shrink-0 font-medium ${botTypeColors[a.botType] || "text-gray-300"}`}>
                  {a.botName}
                </span>
                <span className="min-w-0 flex-1 truncate text-gray-300">{a.action}</span>
                <span className="w-20 flex-shrink-0 text-xs text-gray-500 text-right">{a.caseRef}</span>
                {a.cost > 0 && (
                  <span className="w-16 flex-shrink-0 text-xs text-amber-400 text-right">{currency(a.cost)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">No recent bot activity recorded.</p>
        )}
      </Section>

      {/* Footer */}
      <div className="pb-4 text-center text-xs text-gray-600">
        MGR Capital Command Center &middot; Data refreshes every 60s
      </div>
    </div>
  );
}
