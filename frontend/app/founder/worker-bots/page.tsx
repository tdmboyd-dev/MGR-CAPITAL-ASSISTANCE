"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BotStatus = "IDLE" | "WORKING" | "LEARNING" | "SPAWNING" | "ERROR";

interface GenesisBot {
  id: string;
  codename: string;
  designation: string;
  specialty: string;
  catchphrase: string;
  status: BotStatus;
  activeCases: number;
  totalCasesWorked: number;
  winRate: number;
  revenueLifetime: number;
  learningScore: number;
  evolutionLevel: number;
  spawnedCount: number;
  lastAction: string;
  lastActionTime: string;
}

interface SpawnedBot {
  id: string;
  name: string;
  parentDesignation: string;
  parentCodename: string;
  generation: number;
  specialization: string;
  casesWorked: number;
  successRate: number;
  status: BotStatus;
  createdAt: string;
}

interface FleetStats {
  totalBots: number;
  activeBots: number;
  casesBeingWorked: number;
  revenueToday: number;
  totalSpawned: number;
  uptime: number;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  botName: string;
  botDesignation: string;
  action: string;
  category: "case" | "lead" | "spawn" | "learn" | "evolve" | "alert";
}

interface LearningEntry {
  id: string;
  category: string;
  pattern: string;
  confidence: number;
  learnedBy: string;
  learnedAt: string;
}

// ---------------------------------------------------------------------------
// Default Genesis Bot Data
// ---------------------------------------------------------------------------

const GENESIS_BOTS_DEFAULT: GenesisBot[] = [
  {
    id: "wb-001",
    codename: "TITAN",
    designation: "WB-001",
    specialty: "Full Case Lifecycle",
    catchphrase: "From lead to liquidation, I own the entire pipeline.",
    status: "WORKING",
    activeCases: 47,
    totalCasesWorked: 3842,
    winRate: 78.4,
    revenueLifetime: 2847500,
    learningScore: 94,
    evolutionLevel: 8,
    spawnedCount: 5,
    lastAction: "Advanced case #TX-78234 to DOCS_SIGNED",
    lastActionTime: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: "wb-002",
    codename: "HUNTER",
    designation: "WB-002",
    specialty: "Lead Discovery",
    catchphrase: "Every county courthouse is my hunting ground.",
    status: "WORKING",
    activeCases: 0,
    totalCasesWorked: 12480,
    winRate: 62.1,
    revenueLifetime: 1253000,
    learningScore: 88,
    evolutionLevel: 7,
    spawnedCount: 3,
    lastAction: "Found 23 new leads in Harris County, TX",
    lastActionTime: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "wb-003",
    codename: "PHANTOM",
    designation: "WB-003",
    specialty: "Skip Trace & Contact",
    catchphrase: "No one hides from me. I find them all.",
    status: "WORKING",
    activeCases: 156,
    totalCasesWorked: 8921,
    winRate: 71.8,
    revenueLifetime: 982300,
    learningScore: 91,
    evolutionLevel: 7,
    spawnedCount: 4,
    lastAction: "Located verified phone for case #FL-44892",
    lastActionTime: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "wb-004",
    codename: "AMBASSADOR",
    designation: "WB-004",
    specialty: "Client Relations",
    catchphrase: "Building trust, one conversation at a time.",
    status: "WORKING",
    activeCases: 89,
    totalCasesWorked: 6234,
    winRate: 84.2,
    revenueLifetime: 1847200,
    learningScore: 96,
    evolutionLevel: 9,
    spawnedCount: 2,
    lastAction: "Sent follow-up to 34 warm leads",
    lastActionTime: new Date(Date.now() - 90000).toISOString(),
  },
  {
    id: "wb-005",
    codename: "ARCHITECT",
    designation: "WB-005",
    specialty: "Document Assembly",
    catchphrase: "Every contract, filed perfectly. Every time.",
    status: "IDLE",
    activeCases: 12,
    totalCasesWorked: 4567,
    winRate: 99.1,
    revenueLifetime: 723400,
    learningScore: 82,
    evolutionLevel: 6,
    spawnedCount: 1,
    lastAction: "Generated assignment docs for batch of 12 cases",
    lastActionTime: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "wb-006",
    codename: "ENFORCER",
    designation: "WB-006",
    specialty: "Collections",
    catchphrase: "Payment is not optional. I collect what is owed.",
    status: "WORKING",
    activeCases: 67,
    totalCasesWorked: 5123,
    winRate: 68.9,
    revenueLifetime: 3421800,
    learningScore: 79,
    evolutionLevel: 6,
    spawnedCount: 2,
    lastAction: "Initiated collection sequence on 8 overdue accounts",
    lastActionTime: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: "wb-007",
    codename: "NAVIGATOR",
    designation: "WB-007",
    specialty: "Research & Due Diligence",
    catchphrase: "Data is truth. I uncover what others miss.",
    status: "LEARNING",
    activeCases: 23,
    totalCasesWorked: 7891,
    winRate: 75.3,
    revenueLifetime: 1124600,
    learningScore: 97,
    evolutionLevel: 8,
    spawnedCount: 3,
    lastAction: "Analyzed surplus data across 5 new counties",
    lastActionTime: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: "wb-008",
    codename: "REPLICATOR",
    designation: "WB-008",
    specialty: "Bot Spawner",
    catchphrase: "I create armies. Each one stronger than the last.",
    status: "SPAWNING",
    activeCases: 0,
    totalCasesWorked: 234,
    winRate: 100,
    revenueLifetime: 0,
    learningScore: 85,
    evolutionLevel: 5,
    spawnedCount: 18,
    lastAction: "Spawned TITAN-ALPHA-3 specialized in Florida cases",
    lastActionTime: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "wb-009",
    codename: "STRATEGIST",
    designation: "WB-009",
    specialty: "Case Strategy",
    catchphrase: "I see ten moves ahead. Victory is inevitable.",
    status: "WORKING",
    activeCases: 34,
    totalCasesWorked: 2945,
    winRate: 81.7,
    revenueLifetime: 1567300,
    learningScore: 93,
    evolutionLevel: 8,
    spawnedCount: 2,
    lastAction: "Optimized strategy for 34 high-value Texas cases",
    lastActionTime: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "wb-010",
    codename: "OVERLORD",
    designation: "WB-010",
    specialty: "Master Controller",
    catchphrase: "All bots answer to me. The fleet moves as one.",
    status: "WORKING",
    activeCases: 0,
    totalCasesWorked: 1204,
    winRate: 92.5,
    revenueLifetime: 456700,
    learningScore: 99,
    evolutionLevel: 10,
    spawnedCount: 0,
    lastAction: "Rebalanced fleet workload across all active bots",
    lastActionTime: new Date(Date.now() - 15000).toISOString(),
  },
];

const SPAWNED_BOTS_DEFAULT: SpawnedBot[] = [
  { id: "sb-001", name: "TITAN-ALPHA-1", parentDesignation: "WB-001", parentCodename: "TITAN", generation: 2, specialization: "Florida Tax Deeds", casesWorked: 412, successRate: 81.2, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 14).toISOString() },
  { id: "sb-002", name: "TITAN-ALPHA-2", parentDesignation: "WB-001", parentCodename: "TITAN", generation: 2, specialization: "Texas Surplus", casesWorked: 387, successRate: 76.9, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: "sb-003", name: "TITAN-ALPHA-3", parentDesignation: "WB-001", parentCodename: "TITAN", generation: 2, specialization: "Georgia Liens", casesWorked: 89, successRate: 72.4, status: "LEARNING", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "sb-004", name: "HUNTER-BETA-1", parentDesignation: "WB-002", parentCodename: "HUNTER", generation: 2, specialization: "County Record Mining", casesWorked: 1240, successRate: 64.5, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 12).toISOString() },
  { id: "sb-005", name: "HUNTER-BETA-2", parentDesignation: "WB-002", parentCodename: "HUNTER", generation: 2, specialization: "Auction Monitoring", casesWorked: 890, successRate: 59.3, status: "IDLE", createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
  { id: "sb-006", name: "PHANTOM-GAMMA-1", parentDesignation: "WB-003", parentCodename: "PHANTOM", generation: 2, specialization: "Deep Skip Trace", casesWorked: 2341, successRate: 74.1, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: "sb-007", name: "PHANTOM-GAMMA-2", parentDesignation: "WB-003", parentCodename: "PHANTOM", generation: 2, specialization: "Social Media Trace", casesWorked: 1567, successRate: 68.7, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 15).toISOString() },
  { id: "sb-008", name: "AMBASSADOR-DELTA-1", parentDesignation: "WB-004", parentCodename: "AMBASSADOR", generation: 2, specialization: "Spanish Outreach", casesWorked: 678, successRate: 79.8, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 18).toISOString() },
  { id: "sb-009", name: "ENFORCER-EPSILON-1", parentDesignation: "WB-006", parentCodename: "ENFORCER", generation: 2, specialization: "High-Value Recovery", casesWorked: 234, successRate: 71.2, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: "sb-010", name: "NAVIGATOR-ZETA-1", parentDesignation: "WB-007", parentCodename: "NAVIGATOR", generation: 2, specialization: "Property Valuation", casesWorked: 1890, successRate: 77.6, status: "LEARNING", createdAt: new Date(Date.now() - 86400000 * 22).toISOString() },
  { id: "sb-011", name: "NAVIGATOR-ZETA-2", parentDesignation: "WB-007", parentCodename: "NAVIGATOR", generation: 2, specialization: "Title Research", casesWorked: 1123, successRate: 82.1, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 16).toISOString() },
  { id: "sb-012", name: "STRATEGIST-ETA-1", parentDesignation: "WB-009", parentCodename: "STRATEGIST", generation: 2, specialization: "Multi-State Strategy", casesWorked: 567, successRate: 85.4, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: "sb-013", name: "TITAN-ALPHA-1-A", parentDesignation: "WB-001", parentCodename: "TITAN", generation: 3, specialization: "Miami-Dade Specialist", casesWorked: 145, successRate: 88.2, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: "sb-014", name: "PHANTOM-GAMMA-1-A", parentDesignation: "WB-003", parentCodename: "PHANTOM", generation: 3, specialization: "Heir Location", casesWorked: 78, successRate: 91.0, status: "WORKING", createdAt: new Date(Date.now() - 86400000 * 1).toISOString() },
];

const ACTIVITY_FEED_DEFAULT: ActivityEntry[] = [
  { id: "a1", timestamp: new Date(Date.now() - 5000).toISOString(), botName: "OVERLORD", botDesignation: "WB-010", action: "Rebalanced fleet workload — 3 bots redirected to TX cases", category: "alert" },
  { id: "a2", timestamp: new Date(Date.now() - 15000).toISOString(), botName: "TITAN", botDesignation: "WB-001", action: "Working case #TX-78234 -- Stage: DOCS_PENDING -> DOCS_SIGNED", category: "case" },
  { id: "a3", timestamp: new Date(Date.now() - 30000).toISOString(), botName: "HUNTER", botDesignation: "WB-002", action: "Found 23 new leads in Harris County, TX", category: "lead" },
  { id: "a4", timestamp: new Date(Date.now() - 45000).toISOString(), botName: "REPLICATOR", botDesignation: "WB-008", action: "Spawned TITAN-ALPHA-3 specialized in Florida cases", category: "spawn" },
  { id: "a5", timestamp: new Date(Date.now() - 60000).toISOString(), botName: "PHANTOM", botDesignation: "WB-003", action: "Located verified phone for case #FL-44892 via deep skip trace", category: "case" },
  { id: "a6", timestamp: new Date(Date.now() - 90000).toISOString(), botName: "NAVIGATOR", botDesignation: "WB-007", action: "Learned new pattern: FL counties with >$10k surplus have 84% win rate", category: "learn" },
  { id: "a7", timestamp: new Date(Date.now() - 120000).toISOString(), botName: "AMBASSADOR", botDesignation: "WB-004", action: "Sent personalized follow-up to 34 warm leads in GA", category: "case" },
  { id: "a8", timestamp: new Date(Date.now() - 150000).toISOString(), botName: "ENFORCER", botDesignation: "WB-006", action: "Initiated collection sequence on 8 overdue accounts ($124,500 total)", category: "case" },
  { id: "a9", timestamp: new Date(Date.now() - 180000).toISOString(), botName: "STRATEGIST", botDesignation: "WB-009", action: "Optimized strategy for 34 high-value Texas cases -- projected +$47K", category: "case" },
  { id: "a10", timestamp: new Date(Date.now() - 210000).toISOString(), botName: "ARCHITECT", botDesignation: "WB-005", action: "Generated assignment docs for batch of 12 cases in under 3 seconds", category: "case" },
  { id: "a11", timestamp: new Date(Date.now() - 300000).toISOString(), botName: "TITAN-ALPHA-1", botDesignation: "SB", action: "Completed full lifecycle on FL case #FL-33891 -- $12,400 recovered", category: "case" },
  { id: "a12", timestamp: new Date(Date.now() - 360000).toISOString(), botName: "NAVIGATOR", botDesignation: "WB-007", action: "Evolved to Level 8 after analyzing 500+ county patterns", category: "evolve" },
  { id: "a13", timestamp: new Date(Date.now() - 420000).toISOString(), botName: "HUNTER-BETA-1", botDesignation: "SB", action: "Mined 847 new records from Cook County, IL courthouse", category: "lead" },
  { id: "a14", timestamp: new Date(Date.now() - 480000).toISOString(), botName: "OVERLORD", botDesignation: "WB-010", action: "Detected underperforming sub-bot HUNTER-BETA-2 -- scheduling retraining", category: "alert" },
  { id: "a15", timestamp: new Date(Date.now() - 540000).toISOString(), botName: "AMBASSADOR-DELTA-1", botDesignation: "SB", action: "Converted 12 Spanish-speaking leads with 92% positive response rate", category: "case" },
];

const LEARNINGS_DEFAULT: LearningEntry[] = [
  { id: "l1", category: "Jurisdiction", pattern: "Florida counties with surplus >$10K have 84% claim success rate", confidence: 94, learnedBy: "NAVIGATOR", learnedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "l2", category: "Outreach", pattern: "SMS sent between 9-11 AM ET yields 3.2x higher response rate", confidence: 91, learnedBy: "AMBASSADOR", learnedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "l3", category: "Collections", pattern: "Payment plans with 3 installments have 67% higher completion rate", confidence: 87, learnedBy: "ENFORCER", learnedAt: new Date(Date.now() - 14400000).toISOString() },
  { id: "l4", category: "Skip Trace", pattern: "Social media cross-reference increases contact rate by 41%", confidence: 89, learnedBy: "PHANTOM", learnedAt: new Date(Date.now() - 28800000).toISOString() },
  { id: "l5", category: "Documents", pattern: "Pre-filled assignment docs reduce client drop-off by 52%", confidence: 93, learnedBy: "ARCHITECT", learnedAt: new Date(Date.now() - 43200000).toISOString() },
  { id: "l6", category: "Strategy", pattern: "Cases with property value >$200K should prioritize in-person notary", confidence: 86, learnedBy: "STRATEGIST", learnedAt: new Date(Date.now() - 57600000).toISOString() },
  { id: "l7", category: "Lead Quality", pattern: "Leads from tax deed auctions convert 2.8x better than lien auctions", confidence: 92, learnedBy: "HUNTER", learnedAt: new Date(Date.now() - 72000000).toISOString() },
  { id: "l8", category: "Lifecycle", pattern: "Cases that reach signed stage within 48h of contact have 91% close rate", confidence: 95, learnedBy: "TITAN", learnedAt: new Date(Date.now() - 86400000).toISOString() },
];

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken")
      : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: authHeaders(),
      credentials: "include",
      ...opts,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function currency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return currency(n);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BotStatus }) {
  const config: Record<BotStatus, { bg: string; text: string; dot: string; pulse: boolean }> = {
    IDLE: { bg: "bg-gray-500/20 border-gray-500/40", text: "text-gray-400", dot: "bg-gray-400", pulse: false },
    WORKING: { bg: "bg-green-500/20 border-green-500/40", text: "text-green-400", dot: "bg-green-400", pulse: true },
    LEARNING: { bg: "bg-blue-500/20 border-blue-500/40", text: "text-blue-400", dot: "bg-blue-400", pulse: true },
    SPAWNING: { bg: "bg-purple-500/20 border-purple-500/40", text: "text-purple-400", dot: "bg-purple-400", pulse: true },
    ERROR: { bg: "bg-red-500/20 border-red-500/40", text: "text-red-400", dot: "bg-red-400", pulse: true },
  };
  const c = config[status] || config.IDLE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

function StarRating({ level, max = 10 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-xs ${i < level ? "text-amber-400" : "text-gray-700"}`}
        >
          {i < level ? "\u2605" : "\u2606"}
        </span>
      ))}
    </div>
  );
}

function ProgressBar({
  value,
  max = 100,
  color = "bg-cyan-500",
  height = "h-2",
}: {
  value: number;
  max?: number;
  color?: string;
  height?: string;
}) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`${height} w-full rounded-full bg-gray-800 overflow-hidden`}>
      <div
        className={`${height} rounded-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function CSSBarChart({
  data,
  maxValue,
}: {
  data: { label: string; value: number; color: string }[];
  maxValue: number;
}) {
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => {
        const h = maxValue > 0 ? Math.max((d.value / maxValue) * 100, 3) : 3;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-gray-400 font-mono">
              {compactCurrency(d.value)}
            </span>
            <div
              className={`w-full rounded-t ${d.color} transition-all duration-700 ease-out`}
              style={{ height: `${h}%` }}
            />
            <span className="text-[9px] text-gray-500 font-mono truncate w-full text-center">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionPanel({
  title,
  icon,
  accent = "text-cyan-400",
  children,
  className = "",
}: {
  title: string;
  icon: string;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-800/80 bg-[#111111] p-5 shadow-2xl ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-gray-100">
        <span className={`${accent} text-xl`}>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ActivityIcon({ category }: { category: string }) {
  const icons: Record<string, { icon: string; color: string }> = {
    case: { icon: "\u25B6", color: "text-green-400" },
    lead: { icon: "\u25C6", color: "text-cyan-400" },
    spawn: { icon: "\u2726", color: "text-purple-400" },
    learn: { icon: "\u2691", color: "text-blue-400" },
    evolve: { icon: "\u2B06", color: "text-amber-400" },
    alert: { icon: "\u26A0", color: "text-red-400" },
  };
  const c = icons[category] || icons.case;
  return <span className={`${c.color} text-sm flex-shrink-0`}>{c.icon}</span>;
}

// ===========================================================================
// MAIN PAGE COMPONENT
// ===========================================================================

export default function WorkerBotFleetCommandPage() {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fleetStats, setFleetStats] = useState<FleetStats>({
    totalBots: 24,
    activeBots: 19,
    casesBeingWorked: 428,
    revenueToday: 47820,
    totalSpawned: 14,
    uptime: 1247832,
  });
  const [genesisBots, setGenesisBots] = useState<GenesisBot[]>(GENESIS_BOTS_DEFAULT);
  const [spawnedBots, setSpawnedBots] = useState<SpawnedBot[]>(SPAWNED_BOTS_DEFAULT);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>(ACTIVITY_FEED_DEFAULT);
  const [learnings, setLearnings] = useState<LearningEntry[]>(LEARNINGS_DEFAULT);
  const [uptimeSeconds, setUptimeSeconds] = useState(1247832);

  // Confirmation modals
  const [confirmAction, setConfirmAction] = useState<{
    type: "deploy-all" | "recall-all" | "natural-selection" | "evolve" | null;
    botId?: string;
  }>({ type: null });

  // Quick command state
  const [huntState, setHuntState] = useState("TX");
  const [spawnParent, setSpawnParent] = useState("WB-001");
  const [spawnSpec, setSpawnSpec] = useState("Florida Tax Deeds");

  // Detail view
  const [selectedBot, setSelectedBot] = useState<GenesisBot | null>(null);

  // Population history (simulated)
  const [populationHistory] = useState([
    { day: "Mon", count: 18 },
    { day: "Tue", count: 19 },
    { day: "Wed", count: 20 },
    { day: "Thu", count: 21 },
    { day: "Fri", count: 22 },
    { day: "Sat", count: 23 },
    { day: "Today", count: 24 },
  ]);

  const feedRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------

  const loadFleetData = useCallback(async () => {
    try {
      const [statsRes, botsRes, spawnedRes] = await Promise.allSettled([
        apiFetch<FleetStats>("/worker-bots/fleet-stats"),
        apiFetch<GenesisBot[]>("/worker-bots/genesis"),
        apiFetch<SpawnedBot[]>("/worker-bots/spawned"),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value) {
        setFleetStats(statsRes.value);
      }
      if (botsRes.status === "fulfilled" && botsRes.value && Array.isArray(botsRes.value)) {
        setGenesisBots(botsRes.value);
      }
      if (spawnedRes.status === "fulfilled" && spawnedRes.value && Array.isArray(spawnedRes.value)) {
        setSpawnedBots(spawnedRes.value);
      }
    } catch {
      // Fall back to defaults silently
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivityAndLearnings = useCallback(async () => {
    try {
      const [actRes, learnRes] = await Promise.allSettled([
        apiFetch<ActivityEntry[]>("/worker-bots/activity"),
        apiFetch<LearningEntry[]>("/worker-bots/learnings"),
      ]);

      if (actRes.status === "fulfilled" && actRes.value && Array.isArray(actRes.value)) {
        setActivityFeed(actRes.value);
      }
      if (learnRes.status === "fulfilled" && learnRes.value && Array.isArray(learnRes.value)) {
        setLearnings(learnRes.value);
      }
    } catch {
      // Keep defaults
    }
  }, []);

  // -----------------------------------------------------------------------
  // Polling
  // -----------------------------------------------------------------------

  useEffect(() => {
    loadFleetData();
    loadActivityAndLearnings();

    const fleetInterval = setInterval(loadFleetData, 10000);
    const revenueInterval = setInterval(loadActivityAndLearnings, 30000);

    return () => {
      clearInterval(fleetInterval);
      clearInterval(revenueInterval);
    };
  }, [loadFleetData, loadActivityAndLearnings]);

  // Uptime counter
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleDeployAll() {
    await apiFetch("/worker-bots/deploy-all", { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) => (b.status === "IDLE" ? { ...b, status: "WORKING" as BotStatus } : b))
    );
    setConfirmAction({ type: null });
  }

  async function handleRecallAll() {
    await apiFetch("/worker-bots/recall-all", { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) => ({ ...b, status: "IDLE" as BotStatus, activeCases: 0 }))
    );
    setConfirmAction({ type: null });
  }

  async function handleDeployBot(botId: string) {
    await apiFetch(`/worker-bots/${botId}/deploy`, { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) => (b.id === botId ? { ...b, status: "WORKING" as BotStatus } : b))
    );
  }

  async function handleRecallBot(botId: string) {
    await apiFetch(`/worker-bots/${botId}/recall`, { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) => (b.id === botId ? { ...b, status: "IDLE" as BotStatus, activeCases: 0 } : b))
    );
  }

  async function handleEvolveBot(botId: string) {
    await apiFetch(`/worker-bots/${botId}/evolve`, { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) =>
        b.id === botId
          ? { ...b, evolutionLevel: Math.min(b.evolutionLevel + 1, 10), status: "LEARNING" as BotStatus }
          : b
      )
    );
    setConfirmAction({ type: null });
  }

  async function handleWorkAllUnworked() {
    await apiFetch("/worker-bots/work-all-unworked", { method: "POST" });
    setGenesisBots((prev) =>
      prev.map((b) =>
        b.status === "IDLE" ? { ...b, status: "WORKING" as BotStatus, activeCases: b.activeCases + Math.floor(Math.random() * 20 + 5) } : b
      )
    );
  }

  async function handleHuntLeads() {
    await apiFetch("/worker-bots/hunt-leads", {
      method: "POST",
      body: JSON.stringify({ state: huntState }),
    });
    const newActivity: ActivityEntry = {
      id: `a-${Date.now()}`,
      timestamp: new Date().toISOString(),
      botName: "HUNTER",
      botDesignation: "WB-002",
      action: `Initiated lead hunt across all ${huntState} counties`,
      category: "lead",
    };
    setActivityFeed((prev) => [newActivity, ...prev]);
  }

  async function handleSpawnBot() {
    await apiFetch("/worker-bots/spawn", {
      method: "POST",
      body: JSON.stringify({ parent: spawnParent, specialization: spawnSpec }),
    });
    const parentBot = genesisBots.find((b) => b.designation === spawnParent);
    const newSpawned: SpawnedBot = {
      id: `sb-${Date.now()}`,
      name: `${parentBot?.codename || "BOT"}-NEW-${spawnedBots.length + 1}`,
      parentDesignation: spawnParent,
      parentCodename: parentBot?.codename || "UNKNOWN",
      generation: 2,
      specialization: spawnSpec,
      casesWorked: 0,
      successRate: 0,
      status: "LEARNING",
      createdAt: new Date().toISOString(),
    };
    setSpawnedBots((prev) => [newSpawned, ...prev]);
    const newActivity: ActivityEntry = {
      id: `a-${Date.now()}`,
      timestamp: new Date().toISOString(),
      botName: "REPLICATOR",
      botDesignation: "WB-008",
      action: `Spawned ${newSpawned.name} specialized in ${spawnSpec}`,
      category: "spawn",
    };
    setActivityFeed((prev) => [newActivity, ...prev]);
  }

  async function handleNaturalSelection() {
    await apiFetch("/worker-bots/natural-selection", { method: "POST" });
    setSpawnedBots((prev) =>
      prev
        .sort((a, b) => b.successRate - a.successRate)
        .map((b, i) => (i >= prev.length - 2 ? { ...b, status: "IDLE" as BotStatus } : b))
    );
    setConfirmAction({ type: null });
  }

  async function handleEvolveBest() {
    const best = [...genesisBots].sort((a, b) => b.learningScore - a.learningScore)[0];
    if (best) {
      await handleEvolveBot(best.id);
    }
  }

  // -----------------------------------------------------------------------
  // Derived Data
  // -----------------------------------------------------------------------

  const totalRevenue = genesisBots.reduce((sum, b) => sum + b.revenueLifetime, 0);
  const totalCasesWorked = genesisBots.reduce((sum, b) => sum + b.totalCasesWorked, 0);
  const totalLearnings = learnings.length;
  const totalPatterns = totalLearnings * 12; // approximation across all bots
  const companyRevenue = totalRevenue * 1.15; // bots generate ~87% of total

  const revenueChartData = genesisBots.map((b) => ({
    label: b.codename,
    value: b.revenueLifetime,
    color:
      b.revenueLifetime > 2000000
        ? "bg-green-500"
        : b.revenueLifetime > 1000000
          ? "bg-cyan-500"
          : b.revenueLifetime > 500000
            ? "bg-blue-500"
            : "bg-gray-600",
  }));
  const maxRevenue = Math.max(...genesisBots.map((b) => b.revenueLifetime), 1);

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY",
  ];

  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-gray-800 border-t-green-500 animate-spin" />
          <p className="text-green-400 text-sm font-mono tracking-wider animate-pulse">
            INITIALIZING FLEET COMMAND...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#0a0a0a]">
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-8 text-center max-w-md">
          <div className="text-4xl mb-3 text-red-500">{"\u26A0"}</div>
          <p className="text-lg font-bold text-red-400 font-mono">FLEET COMMAND OFFLINE</p>
          <p className="mt-2 text-sm text-red-300/70">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); loadFleetData(); }}
            className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500 transition font-mono tracking-wider"
          >
            RECONNECT
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Confirmation Modal */}
      {confirmAction.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-xl border border-gray-700 bg-[#111] p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-white font-mono tracking-wider mb-2">
              {confirmAction.type === "deploy-all" && "DEPLOY ALL BOTS"}
              {confirmAction.type === "recall-all" && "RECALL ALL BOTS"}
              {confirmAction.type === "natural-selection" && "RUN NATURAL SELECTION"}
              {confirmAction.type === "evolve" && "EVOLVE BOT"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {confirmAction.type === "deploy-all" && "This will activate all idle bots and assign them to unworked cases. Continue?"}
              {confirmAction.type === "recall-all" && "This will recall all active bots and pause their current work. Continue?"}
              {confirmAction.type === "natural-selection" && "This will deactivate the 2 lowest-performing spawned bots. Continue?"}
              {confirmAction.type === "evolve" && "This will put the bot into learning mode to advance its evolution level. Continue?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction({ type: null })}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === "deploy-all") handleDeployAll();
                  if (confirmAction.type === "recall-all") handleRecallAll();
                  if (confirmAction.type === "natural-selection") handleNaturalSelection();
                  if (confirmAction.type === "evolve" && confirmAction.botId) handleEvolveBot(confirmAction.botId);
                }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold tracking-wider transition ${
                  confirmAction.type === "recall-all" || confirmAction.type === "natural-selection"
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-green-600 text-white hover:bg-green-500"
                }`}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Detail Modal */}
      {selectedBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-xl border border-gray-700 bg-[#111] p-6 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-mono tracking-wider">
                  {selectedBot.codename} <span className="text-gray-500">[{selectedBot.designation}]</span>
                </h3>
                <p className="text-sm text-cyan-400">{selectedBot.specialty}</p>
              </div>
              <StatusBadge status={selectedBot.status} />
            </div>
            <p className="text-sm italic text-gray-500 mb-4">&ldquo;{selectedBot.catchphrase}&rdquo;</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
                <p className="text-xs text-gray-500 uppercase">Active Cases</p>
                <p className="text-xl font-bold text-green-400">{selectedBot.activeCases}</p>
              </div>
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
                <p className="text-xs text-gray-500 uppercase">Total Worked</p>
                <p className="text-xl font-bold text-white">{selectedBot.totalCasesWorked.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
                <p className="text-xs text-gray-500 uppercase">Win Rate</p>
                <p className="text-xl font-bold text-cyan-400">{selectedBot.winRate}%</p>
              </div>
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
                <p className="text-xs text-gray-500 uppercase">Revenue</p>
                <p className="text-xl font-bold text-green-400">{compactCurrency(selectedBot.revenueLifetime)}</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Learning Score</span>
                  <span className="text-cyan-400 font-mono">{selectedBot.learningScore}/100</span>
                </div>
                <ProgressBar value={selectedBot.learningScore} color="bg-cyan-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Evolution Level</span>
                  <span className="text-amber-400 font-mono">Lv.{selectedBot.evolutionLevel}</span>
                </div>
                <StarRating level={selectedBot.evolutionLevel} />
              </div>
            </div>

            <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 mb-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Last Action</p>
              <p className="text-sm text-gray-300">{selectedBot.lastAction}</p>
              <p className="text-xs text-gray-600 mt-1">{relativeTime(selectedBot.lastActionTime)}</p>
            </div>

            <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 mb-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Spawned Sub-Bots</p>
              <p className="text-lg font-bold text-purple-400">{selectedBot.spawnedCount}</p>
              <div className="mt-2 space-y-1">
                {spawnedBots
                  .filter((sb) => sb.parentCodename === selectedBot.codename)
                  .map((sb) => (
                    <div key={sb.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{sb.name}</span>
                      <StatusBadge status={sb.status} />
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedBot(null)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 p-4 md:p-6">
        {/* ================================================================= */}
        {/* 1. FLEET COMMAND HEADER                                           */}
        {/* ================================================================= */}
        <div className="rounded-xl border border-gray-800/80 bg-gradient-to-r from-[#111] via-[#0d1117] to-[#111] p-5 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                <h1 className="text-2xl font-extrabold tracking-[0.15em] text-white md:text-3xl font-mono">
                  WORKER BOT FLEET COMMAND
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500 font-mono tracking-wider">
                UPTIME: <span className="text-green-400">{formatUptime(uptimeSeconds)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmAction({ type: "deploy-all" })}
                className="rounded-lg bg-green-600/90 px-5 py-2.5 text-sm font-bold tracking-wider text-white hover:bg-green-500 transition shadow-lg shadow-green-900/30 font-mono"
              >
                {"\u25B6"} DEPLOY ALL
              </button>
              <button
                onClick={() => setConfirmAction({ type: "recall-all" })}
                className="rounded-lg bg-red-600/90 px-5 py-2.5 text-sm font-bold tracking-wider text-white hover:bg-red-500 transition shadow-lg shadow-red-900/30 font-mono"
              >
                {"\u25A0"} RECALL ALL
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-400/70">Total Bots</p>
              <p className="mt-1 text-2xl font-extrabold text-green-400 font-mono">
                {fleetStats.totalBots}
              </p>
              <p className="text-[10px] text-gray-600">
                {genesisBots.length} genesis + {spawnedBots.length} spawned
              </p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Active</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-400 font-mono">
                {genesisBots.filter((b) => b.status === "WORKING").length + spawnedBots.filter((b) => b.status === "WORKING").length}
              </p>
              <p className="text-[10px] text-gray-600">bots currently working</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">Cases Active</p>
              <p className="mt-1 text-2xl font-extrabold text-blue-400 font-mono">
                {genesisBots.reduce((s, b) => s + b.activeCases, 0)}
              </p>
              <p className="text-[10px] text-gray-600">being worked right now</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Revenue Today</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-400 font-mono">
                {currency(fleetStats.revenueToday)}
              </p>
              <p className="text-[10px] text-gray-600">generated by fleet</p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/70">Spawned</p>
              <p className="mt-1 text-2xl font-extrabold text-purple-400 font-mono">
                {spawnedBots.length}
              </p>
              <p className="text-[10px] text-gray-600">sub-bots active</p>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. THE 10 GENESIS BOTS GRID (2x5)                                */}
        {/* ================================================================= */}
        <SectionPanel title="Genesis Fleet" icon={"\u2726"} accent="text-green-400">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {genesisBots.map((bot) => (
              <div
                key={bot.id}
                className={`group rounded-lg border p-4 transition-all duration-300 hover:shadow-lg cursor-pointer ${
                  bot.status === "WORKING"
                    ? "border-green-500/30 bg-green-500/5 hover:border-green-400/50 hover:shadow-green-900/20"
                    : bot.status === "LEARNING"
                      ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50 hover:shadow-blue-900/20"
                      : bot.status === "SPAWNING"
                        ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-400/50 hover:shadow-purple-900/20"
                        : bot.status === "ERROR"
                          ? "border-red-500/30 bg-red-500/5 hover:border-red-400/50 hover:shadow-red-900/20"
                          : "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:shadow-gray-900/20"
                }`}
                onClick={() => setSelectedBot(bot)}
              >
                {/* Top Row: Name + Status */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-white font-mono tracking-wider">
                        {bot.codename}
                      </h3>
                      <span className="text-xs text-gray-600 font-mono">[{bot.designation}]</span>
                    </div>
                    <p className="text-xs text-cyan-400/80">{bot.specialty}</p>
                  </div>
                  <StatusBadge status={bot.status} />
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Active</p>
                    <p className="text-sm font-bold text-white font-mono">{bot.activeCases}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Worked</p>
                    <p className="text-sm font-bold text-white font-mono">{bot.totalCasesWorked.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Win Rate</p>
                    <p className={`text-sm font-bold font-mono ${bot.winRate >= 80 ? "text-green-400" : bot.winRate >= 60 ? "text-cyan-400" : "text-amber-400"}`}>
                      {bot.winRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Revenue</p>
                    <p className="text-sm font-bold text-green-400 font-mono">{compactCurrency(bot.revenueLifetime)}</p>
                  </div>
                </div>

                {/* Learning Score */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500 uppercase">Learning Score</span>
                    <span className="text-xs text-cyan-400 font-mono">{bot.learningScore}/100</span>
                  </div>
                  <ProgressBar
                    value={bot.learningScore}
                    color={
                      bot.learningScore >= 90
                        ? "bg-green-500"
                        : bot.learningScore >= 70
                          ? "bg-cyan-500"
                          : "bg-amber-500"
                    }
                    height="h-1.5"
                  />
                </div>

                {/* Evolution + Stars */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 uppercase">Evolution Lv.{bot.evolutionLevel}</span>
                    <StarRating level={bot.evolutionLevel} />
                  </div>
                  {bot.spawnedCount > 0 && (
                    <span className="text-[10px] text-purple-400 font-mono">
                      {bot.spawnedCount} spawned
                    </span>
                  )}
                </div>

                {/* Catchphrase */}
                <p className="text-xs italic text-gray-600 mb-3 line-clamp-1">
                  &ldquo;{bot.catchphrase}&rdquo;
                </p>

                {/* Quick Actions */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {bot.status === "IDLE" ? (
                    <button
                      onClick={() => handleDeployBot(bot.id)}
                      className="flex-1 rounded bg-green-600/80 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white hover:bg-green-500 transition font-mono"
                    >
                      DEPLOY
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRecallBot(bot.id)}
                      className="flex-1 rounded bg-gray-700 px-3 py-1.5 text-[10px] font-bold tracking-wider text-gray-300 hover:bg-gray-600 transition font-mono"
                    >
                      RECALL
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmAction({ type: "evolve", botId: bot.id })}
                    className="flex-1 rounded bg-blue-600/80 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white hover:bg-blue-500 transition font-mono"
                  >
                    EVOLVE
                  </button>
                  <button
                    onClick={() => setSelectedBot(bot)}
                    className="flex-1 rounded bg-gray-700 px-3 py-1.5 text-[10px] font-bold tracking-wider text-gray-300 hover:bg-gray-600 transition font-mono"
                  >
                    DETAILS
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>

        {/* ================================================================= */}
        {/* 3. SPAWNED BOTS SECTION                                          */}
        {/* ================================================================= */}
        <SectionPanel title="Spawned Sub-Bots" icon={"\u2699"} accent="text-purple-400">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Spawned Table */}
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Name</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Parent</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Gen</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Specialization</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Cases</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Success</th>
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {spawnedBots.map((sb, i) => (
                    <tr
                      key={sb.id}
                      className={`border-b border-gray-800/50 transition hover:bg-gray-800/30 ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}
                    >
                      <td className="py-2.5 font-mono text-xs text-white font-bold">{sb.name}</td>
                      <td className="py-2.5 text-xs text-cyan-400">{sb.parentCodename}</td>
                      <td className="py-2.5 text-xs text-gray-400 text-center font-mono">G{sb.generation}</td>
                      <td className="py-2.5 text-xs text-gray-300">{sb.specialization}</td>
                      <td className="py-2.5 text-xs text-gray-300 font-mono">{sb.casesWorked.toLocaleString()}</td>
                      <td className={`py-2.5 text-xs font-mono font-bold ${sb.successRate >= 80 ? "text-green-400" : sb.successRate >= 60 ? "text-cyan-400" : "text-amber-400"}`}>
                        {sb.successRate}%
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={sb.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Side Panel */}
            <div className="space-y-4">
              {/* Auto-Spawn Recommendations */}
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">
                  Auto-Spawn Recommendations
                </h4>
                <div className="space-y-2">
                  <div className="rounded bg-gray-900/50 p-2 text-xs">
                    <p className="text-white font-medium">TITAN-ALPHA for Ohio</p>
                    <p className="text-gray-500">High surplus volume detected. 340+ unworked leads.</p>
                  </div>
                  <div className="rounded bg-gray-900/50 p-2 text-xs">
                    <p className="text-white font-medium">HUNTER-BETA for Illinois</p>
                    <p className="text-gray-500">Cook County showing 2.4x lead density increase.</p>
                  </div>
                  <div className="rounded bg-gray-900/50 p-2 text-xs">
                    <p className="text-white font-medium">PHANTOM-GAMMA for California</p>
                    <p className="text-gray-500">Skip trace success 18% below fleet average in CA.</p>
                  </div>
                </div>
              </div>

              {/* Natural Selection */}
              <button
                onClick={() => setConfirmAction({ type: "natural-selection" })}
                className="w-full rounded-lg bg-red-600/20 border border-red-500/30 px-4 py-3 text-sm font-bold tracking-wider text-red-400 hover:bg-red-600/30 transition font-mono"
              >
                {"\u2620"} RUN NATURAL SELECTION
              </button>

              {/* Population Chart */}
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Bot Population (7 days)
                </h4>
                <div className="flex items-end gap-2 h-24">
                  {populationHistory.map((p) => {
                    const maxP = Math.max(...populationHistory.map((x) => x.count), 1);
                    const h = Math.max((p.count / maxP) * 100, 8);
                    return (
                      <div key={p.day} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] text-purple-400 font-mono">{p.count}</span>
                        <div
                          className="w-full rounded-t bg-purple-500/60 transition-all"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[9px] text-gray-600">{p.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>

        {/* ================================================================= */}
        {/* 4. REVENUE ATTRIBUTION PANEL                                      */}
        {/* ================================================================= */}
        <SectionPanel title="Revenue Attribution" icon="$" accent="text-green-400">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Bar Chart */}
            <div className="lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                Lifetime Revenue per Genesis Bot
              </p>
              <CSSBarChart data={revenueChartData} maxValue={maxRevenue} />
            </div>

            {/* Revenue Stats */}
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-400/70">
                  Total Bot Revenue
                </p>
                <p className="text-2xl font-extrabold text-green-400 font-mono mt-1">
                  {compactCurrency(totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Total Company Revenue
                </p>
                <p className="text-2xl font-extrabold text-white font-mono mt-1">
                  {compactCurrency(companyRevenue)}
                </p>
                <p className="text-xs text-green-400 mt-1">
                  Worker bots generate {Math.round((totalRevenue / companyRevenue) * 100)}% of all revenue
                </p>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">
                  ROI Insight
                </p>
                <p className="text-sm text-white mt-1 font-medium">
                  Worker bots generated{" "}
                  <span className="text-green-400 font-bold">{compactCurrency(totalRevenue)}</span>{" "}
                  at{" "}
                  <span className="text-green-400 font-bold">$0 employee cost</span>
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
                  Speed Metric
                </p>
                <p className="text-sm text-white mt-1 font-medium">
                  Processing{" "}
                  <span className="text-amber-400 font-bold">10,000x faster</span>{" "}
                  than 1,000 employees
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalCasesWorked.toLocaleString()} cases processed to date
                </p>
              </div>
            </div>
          </div>
        </SectionPanel>

        {/* ================================================================= */}
        {/* 5. LEARNING INTELLIGENCE PANEL                                    */}
        {/* ================================================================= */}
        <SectionPanel title="Learning Intelligence" icon={"\u2691"} accent="text-blue-400">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top Learnings */}
            <div className="lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                Top Learnings Across Fleet
              </p>
              <div className="space-y-2">
                {learnings.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3 hover:bg-gray-800/40 transition">
                    <div className="flex-shrink-0 mt-0.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${
                          l.confidence >= 90
                            ? "bg-green-500/20 text-green-400"
                            : l.confidence >= 80
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {l.confidence}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {l.category}
                        </span>
                        <span className="text-[10px] text-gray-600">by {l.learnedBy}</span>
                        <span className="text-[10px] text-gray-700">{relativeTime(l.learnedAt)}</span>
                      </div>
                      <p className="text-sm text-gray-300">{l.pattern}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Stats */}
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">
                  Patterns Learned
                </p>
                <p className="text-3xl font-extrabold text-blue-400 font-mono mt-1">
                  {totalPatterns.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  from {totalCasesWorked.toLocaleString()} cases analyzed
                </p>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Learning Growth (7 days)
                </p>
                <div className="flex items-end gap-2 h-20">
                  {[42, 56, 63, 71, 68, 82, 96].map((v, i) => {
                    const h = Math.max((v / 96) * 100, 5);
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] text-blue-400 font-mono">{v}</span>
                        <div
                          className="w-full rounded-t bg-blue-500/60 transition-all"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[9px] text-gray-600">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Avg Fleet Learning Score
                </p>
                <p className="text-2xl font-extrabold text-cyan-400 font-mono">
                  {Math.round(genesisBots.reduce((s, b) => s + b.learningScore, 0) / genesisBots.length)}
                  <span className="text-sm text-gray-500">/100</span>
                </p>
                <ProgressBar
                  value={Math.round(genesisBots.reduce((s, b) => s + b.learningScore, 0) / genesisBots.length)}
                  color="bg-cyan-500"
                  height="h-2"
                />
              </div>
            </div>
          </div>
        </SectionPanel>

        {/* ================================================================= */}
        {/* 6. LIVE ACTIVITY FEED                                            */}
        {/* ================================================================= */}
        <SectionPanel title="Live Activity Feed" icon={"\u26A1"} accent="text-amber-400">
          <div ref={feedRef} className="max-h-80 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
            {activityFeed.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-gray-900/30 px-3 py-2 text-sm hover:bg-gray-800/50 transition group"
              >
                <span className="w-16 flex-shrink-0 text-[10px] text-gray-600 font-mono">
                  {relativeTime(a.timestamp)}
                </span>
                <ActivityIcon category={a.category} />
                <span className="w-24 flex-shrink-0 font-mono text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
                  {a.botName}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-400 group-hover:text-gray-300">
                  {a.action}
                </span>
              </div>
            ))}
            {activityFeed.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-600 font-mono">
                NO ACTIVITY RECORDED
              </p>
            )}
          </div>
        </SectionPanel>

        {/* ================================================================= */}
        {/* 7. QUICK COMMAND PANEL                                           */}
        {/* ================================================================= */}
        <SectionPanel title="Quick Commands" icon={"\u2318"} accent="text-amber-400">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Work All Unworked */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Mass Deploy
              </h4>
              <button
                onClick={handleWorkAllUnworked}
                className="w-full rounded-lg bg-green-600/80 px-4 py-3 text-sm font-bold tracking-wider text-white hover:bg-green-500 transition font-mono shadow-lg shadow-green-900/20"
              >
                {"\u25B6"} WORK ALL UNWORKED CASES
              </button>
              <p className="text-[10px] text-gray-600 mt-2">
                Assigns all idle bots to unworked case queue
              </p>
            </div>

            {/* Hunt Leads */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Lead Hunt
              </h4>
              <div className="flex gap-2 mb-2">
                <select
                  value={huntState}
                  onChange={(e) => setHuntState(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleHuntLeads}
                  className="rounded-lg bg-cyan-600/80 px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-cyan-500 transition font-mono"
                >
                  HUNT
                </button>
              </div>
              <p className="text-[10px] text-gray-600">
                Deploys HUNTER to find new leads in selected state
              </p>
            </div>

            {/* Spawn New Bot */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Spawn Bot
              </h4>
              <select
                value={spawnParent}
                onChange={(e) => setSpawnParent(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white font-mono mb-2 focus:border-purple-500 focus:outline-none"
              >
                {genesisBots.map((b) => (
                  <option key={b.designation} value={b.designation}>
                    {b.codename} [{b.designation}]
                  </option>
                ))}
              </select>
              <select
                value={spawnSpec}
                onChange={(e) => setSpawnSpec(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white font-mono mb-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="Florida Tax Deeds">Florida Tax Deeds</option>
                <option value="Texas Surplus">Texas Surplus</option>
                <option value="Georgia Liens">Georgia Liens</option>
                <option value="Ohio Foreclosures">Ohio Foreclosures</option>
                <option value="California Surplus">California Surplus</option>
                <option value="Illinois Tax Sales">Illinois Tax Sales</option>
                <option value="Multi-State General">Multi-State General</option>
                <option value="High-Value Recovery">High-Value Recovery</option>
                <option value="Heir Location">Heir Location</option>
              </select>
              <button
                onClick={handleSpawnBot}
                className="w-full rounded-lg bg-purple-600/80 px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-purple-500 transition font-mono"
              >
                {"\u2726"} SPAWN
              </button>
            </div>

            {/* Evolve Best */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Evolution
              </h4>
              <button
                onClick={handleEvolveBest}
                className="w-full rounded-lg bg-amber-600/80 px-4 py-3 text-sm font-bold tracking-wider text-white hover:bg-amber-500 transition font-mono shadow-lg shadow-amber-900/20 mb-2"
              >
                {"\u2B06"} EVOLVE BEST BOT
              </button>
              <p className="text-[10px] text-gray-600">
                Evolves the bot with the highest learning score:{" "}
                <span className="text-cyan-400 font-bold">
                  {[...genesisBots].sort((a, b) => b.learningScore - a.learningScore)[0]?.codename || "N/A"}
                </span>{" "}
                (score: {[...genesisBots].sort((a, b) => b.learningScore - a.learningScore)[0]?.learningScore || 0})
              </p>
            </div>
          </div>
        </SectionPanel>

        {/* Footer */}
        <div className="pb-6 text-center">
          <p className="text-[10px] text-gray-700 font-mono tracking-widest">
            MGR CAPITAL WORKER BOT FLEET COMMAND {"\u2022"} FLEET STATUS REFRESHES EVERY 10s {"\u2022"} REVENUE DATA EVERY 30s
          </p>
        </div>
      </div>
    </div>
  );
}
