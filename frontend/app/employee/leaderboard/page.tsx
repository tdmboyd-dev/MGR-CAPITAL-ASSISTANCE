"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Users,
  Building2,
  Layers,
  Gift,
  Send,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";

// ─── Types ───
interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  tier: string;
  tierKey: string;
  tenantName: string;
  casesCompleted: number;
  revenueCents?: number;
  displayedEarningsCents?: number;
}

interface TierLeader {
  tier: string;
  tierKey: string;
  count: number;
  leader: LeaderboardEntry | null;
  topThree: LeaderboardEntry[];
}

interface ChildCompanyLeader {
  tenantId: string | null;
  tenantName: string;
  employeeCount: number;
  leader: LeaderboardEntry | null;
}

interface Incentive {
  id: string;
  employeeName: string;
  employeeTier: string;
  type: string;
  title: string;
  message: string | null;
  bonusCents: number;
  createdAt: string;
}

type Tab = "company" | "team" | "tiers" | "incentives";

const INCENTIVE_TYPES = [
  { value: "SHOUTOUT", label: "Shoutout", icon: Sparkles, color: "text-blue-500" },
  { value: "BONUS", label: "Cash Bonus", icon: Gift, color: "text-green-500" },
  { value: "TROPHY", label: "Trophy", icon: Trophy, color: "text-yellow-500" },
  { value: "TOP_PERFORMER", label: "Top Performer", icon: Crown, color: "text-purple-500" },
  { value: "TIER_BOOST", label: "Tier Boost", icon: TrendingUp, color: "text-orange-500" },
];

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

function getTierBadgeColor(tierKey: string) {
  if (tierKey?.includes("5")) return "bg-purple-500/10 text-purple-500 border-purple-500/30";
  if (tierKey?.includes("4")) return "bg-blue-500/10 text-blue-500 border-blue-500/30";
  if (tierKey?.includes("3")) return "bg-green-500/10 text-green-500 border-green-500/30";
  if (tierKey?.includes("2")) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
  return "bg-gray-500/10 text-gray-500 border-gray-500/30";
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isFounder = user?.role === "FOUNDER";
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [incentiveType, setIncentiveType] = useState("SHOUTOUT");
  const [incentiveTitle, setIncentiveTitle] = useState("");
  const [incentiveMessage, setIncentiveMessage] = useState("");
  const [incentiveBonus, setIncentiveBonus] = useState(0);

  // Fetch leaderboard data — always get both boards
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard", "all"],
    queryFn: async () => {
      const { data } = await api.get("/employees/leaderboard?scope=all");
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch recent incentives
  const { data: incentivesData } = useQuery({
    queryKey: ["incentives"],
    queryFn: async () => {
      const { data } = await api.get("/employees/incentives?limit=20");
      return data;
    },
  });

  // Send incentive mutation
  const sendIncentive = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post("/employees/incentive", payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Incentive sent! Company-wide alert dispatched.");
      queryClient.invalidateQueries({ queryKey: ["incentives"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      setShowIncentiveForm(false);
      setIncentiveTitle("");
      setIncentiveMessage("");
      setIncentiveBonus(0);
      setSelectedEmployee("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to send incentive");
    },
  });

  const companyBoard: LeaderboardEntry[] = leaderboard?.companyBoard || [];
  const teamBoard: LeaderboardEntry[] = leaderboard?.teamBoard || [];
  const tierLeaders: TierLeader[] = leaderboard?.tierLeaders || [];
  const childCompanyLeaders: ChildCompanyLeader[] = leaderboard?.childCompanyLeaders || [];
  const incentives: Incentive[] = incentivesData?.data || [];

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "company", label: "Company-Wide", icon: Users },
    { key: "team", label: "My Team", icon: Building2 },
    { key: "tiers", label: "Tier Leaders", icon: Layers },
    { key: "incentives", label: "Awards", icon: Award },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Performance rankings across the organization
          </p>
        </div>
        {isFounder && (
          <Button onClick={() => setShowIncentiveForm(!showIncentiveForm)}>
            <Gift className="h-4 w-4 mr-2" />
            Award Incentive
          </Button>
        )}
      </div>

      {/* Incentive Form (Founder Only) */}
      {isFounder && showIncentiveForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Send Recognition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Employee</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">Select employee...</option>
                  {companyBoard.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.tier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Award Type</label>
                <div className="flex flex-wrap gap-2">
                  {INCENTIVE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setIncentiveType(t.value)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        incentiveType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <t.icon className={`h-3 w-3 ${t.color}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Outstanding Recovery This Month!"
                value={incentiveTitle}
                onChange={(e) => setIncentiveTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Personal Message (optional)</label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                placeholder="Great work on the Johnson case..."
                value={incentiveMessage}
                onChange={(e) => setIncentiveMessage(e.target.value)}
              />
            </div>
            {incentiveType === "BONUS" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Bonus Amount ($)</label>
                <input
                  type="number"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="100"
                  value={incentiveBonus || ""}
                  onChange={(e) => setIncentiveBonus(Number(e.target.value))}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  sendIncentive.mutate({
                    employeeId: selectedEmployee,
                    type: incentiveType,
                    title: incentiveTitle,
                    message: incentiveMessage || undefined,
                    bonusCents: incentiveType === "BONUS" ? incentiveBonus * 100 : 0,
                    isCompanyWide: true,
                  })
                }
                disabled={!selectedEmployee || !incentiveTitle || sendIncentive.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendIncentive.isPending ? "Sending..." : "Send & Alert Company"}
              </Button>
              <Button variant="outline" onClick={() => setShowIncentiveForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Company-Wide Board */}
      {activeTab === "company" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Company-Wide Rankings
          </h2>
          <LeaderboardTable
            entries={companyBoard}
            isFounder={isFounder}
            highlightId={user?.id}
          />
        </div>
      )}

      {/* Team Board */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            My Team Rankings
          </h2>
          {teamBoard.length > 0 ? (
            <LeaderboardTable
              entries={teamBoard}
              isFounder={isFounder}
              highlightId={user?.id}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No team members found. You may not be part of a child company yet.
              </CardContent>
            </Card>
          )}

          {/* Child Company Leaders (Founder Only) */}
          {isFounder && childCompanyLeaders.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Child Company Leaders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {childCompanyLeaders.map((cc) => (
                  <Card key={cc.tenantId || "main"}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{cc.tenantName}</p>
                        <Badge variant="outline">{cc.employeeCount} employees</Badge>
                      </div>
                      {cc.leader ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{cc.leader.name}</span>
                          <span className="text-muted-foreground">
                            {cc.leader.casesCompleted} cases
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No employees yet</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tier-by-Tier Leaders */}
      {activeTab === "tiers" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Tier-by-Tier Leaders
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {tierLeaders.map((tl) => (
              <Card key={tl.tierKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span>{tl.tier}</span>
                    </div>
                    <Badge variant="outline">{tl.count} employees</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tl.topThree.length > 0 ? (
                    <div className="space-y-2">
                      {tl.topThree.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            {getRankIcon(emp.rank)}
                            <span className="font-medium">{emp.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {emp.casesCompleted} cases closed
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No employees in this tier yet</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Awards / Incentives Feed */}
      {activeTab === "incentives" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" />
            Recent Awards & Recognition
          </h2>
          {incentives.length > 0 ? (
            <div className="space-y-3">
              {incentives.map((inc) => {
                const typeInfo = INCENTIVE_TYPES.find((t) => t.value === inc.type);
                const Icon = typeInfo?.icon || Star;
                return (
                  <Card key={inc.id}>
                    <CardContent className="py-4 flex items-start gap-4">
                      <div className={`mt-1 ${typeInfo?.color || "text-yellow-500"}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{inc.employeeName}</span>
                          <Badge variant="outline" className="text-xs">
                            {inc.employeeTier}
                          </Badge>
                        </div>
                        <p className="font-medium">{inc.title}</p>
                        {inc.message && (
                          <p className="text-sm text-muted-foreground mt-1">{inc.message}</p>
                        )}
                        {inc.bonusCents > 0 && (
                          <Badge className="mt-1 bg-green-500/10 text-green-500 border-green-500/30">
                            {formatMoney(inc.bonusCents)} bonus
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inc.createdAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No awards yet. {isFounder ? "Use the Award Incentive button to recognize employees!" : "Keep up the great work!"}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reusable Leaderboard Table ───
function LeaderboardTable({
  entries,
  isFounder,
  highlightId,
}: {
  entries: LeaderboardEntry[];
  isFounder: boolean;
  highlightId?: string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-3 text-left font-medium w-16">Rank</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Tier</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-right font-medium">Cases Closed</th>
              {isFounder && (
                <th className="px-4 py-3 text-right font-medium">Revenue</th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((emp) => (
              <tr
                key={emp.id}
                className={`border-b transition-colors hover:bg-muted/30 ${
                  emp.id === highlightId ? "bg-primary/5 font-medium" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(emp.rank)}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {emp.name}
                  {emp.id === highlightId && (
                    <span className="ml-2 text-xs text-primary">(You)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={getTierBadgeColor(emp.tierKey)}>
                    {emp.tier}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{emp.tenantName}</td>
                <td className="px-4 py-3 text-right font-mono">{emp.casesCompleted}</td>
                {isFounder && (
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoney(emp.revenueCents || 0)}
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={isFounder ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                  No employees to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
