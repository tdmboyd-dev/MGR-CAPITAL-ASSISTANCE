"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Zap, DollarSign, Activity, ArrowUpCircle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

const TIER_LABELS: Record<string, { label: string; price: string; color: string }> = {
  STARTER: { label: "Starter", price: "$50/mo", color: "text-blue-500" },
  PROFESSIONAL: { label: "Professional", price: "$150/mo", color: "text-purple-500" },
  ENTERPRISE: { label: "Enterprise", price: "$300/mo", color: "text-orange-500" },
  UNLIMITED: { label: "Unlimited", price: "$500/mo", color: "text-yellow-500" },
  FOUNDER: { label: "Founder", price: "Free", color: "text-green-500" },
};

const BOT_LABELS: Record<string, { name: string; icon: string; description: string }> = {
  outreach: { name: "Outreach Bot", icon: "📤", description: "Auto SMS, email, call scheduling" },
  compliance: { name: "Compliance Bot", icon: "🛡️", description: "Auto-fix compliance issues" },
  docket: { name: "Docket Bot", icon: "⚖️", description: "Court monitoring & auto-notify" },
  docs: { name: "Document Bot", icon: "📄", description: "Auto-generate legal documents" },
  skipTrace: { name: "Skip Trace Bot", icon: "🔍", description: "Owner lookup & discovery" },
  phone: { name: "Phone Bot", icon: "📞", description: "AI phone calls" },
  aiLegal: { name: "AI Legal Bots", icon: "🤖", description: "8 specialized legal AI agents" },
  autopilot: { name: "Case Autopilot", icon: "🚀", description: "Automated case pipeline" },
  research: { name: "Research Bot", icon: "🔬", description: "Property intel gathering" },
};

export default function EmployeeBotsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);

  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ["bot-subscription"],
    queryFn: async () => {
      const { data } = await api.get("/bot-subscriptions/mine");
      return data;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ["bot-tiers"],
    queryFn: async () => {
      const { data } = await api.get("/bot-subscriptions/tiers");
      return data;
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { data } = await api.post("/bot-subscriptions/subscribe", { tier });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-subscription"] });
      setUpgradeTarget(null);
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { data } = await api.put("/bot-subscriptions/update-tier", { tier });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-subscription"] });
      setUpgradeTarget(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const subscription = subscriptionData?.subscription;
  const usage = subscriptionData?.usage;
  const enabledBots = (subscription?.enabledBots || []) as string[];
  const tierInfo = TIER_LABELS[subscription?.tier] || TIER_LABELS.STARTER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" /> Action Bots
        </h1>
        <p className="text-muted-foreground">
          Your bot subscription, enabled bots, and usage
        </p>
      </div>

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Plan</span>
            <span className={`text-2xl font-bold ${tierInfo.color}`}>
              {tierInfo.label} — {tierInfo.price}
            </span>
          </CardTitle>
          <CardDescription>
            {subscription?.isActive ? "Active" : "Inactive"} since {subscription?.startDate ? new Date(subscription.startDate).toLocaleDateString() : "N/A"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {["STARTER", "PROFESSIONAL", "ENTERPRISE", "UNLIMITED"].map((tier) => {
              const info = TIER_LABELS[tier];
              const isCurrent = subscription?.tier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => {
                    if (!isCurrent) {
                      if (subscription) {
                        updateTierMutation.mutate(tier);
                      } else {
                        subscribeMutation.mutate(tier);
                      }
                    }
                  }}
                  disabled={isCurrent || subscribeMutation.isPending || updateTierMutation.isPending}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/10 font-bold"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  } ${subscribeMutation.isPending || updateTierMutation.isPending ? "opacity-50" : ""}`}
                >
                  <div className={`font-semibold ${info.color}`}>{info.label}</div>
                  <div className="text-sm text-muted-foreground">{info.price}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actions This Month</CardTitle>
            <Zap className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.totalActions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost This Month</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((usage?.totalCostCents || 0) / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bots Enabled</CardTitle>
            <Activity className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledBots.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enabled Bots */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bots</CardTitle>
          <CardDescription>
            Bots included in your {tierInfo.label} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(BOT_LABELS).map(([key, bot]) => {
              const isEnabled = enabledBots.includes(key);
              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border ${
                    isEnabled ? "border-green-500/30 bg-green-500/5" : "border-border opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{bot.icon}</span>
                    <span className="font-semibold">{bot.name}</span>
                    {isEnabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{bot.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Usage Breakdown by Bot */}
      {usage?.byBot && Object.keys(usage.byBot).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Breakdown</CardTitle>
            <CardDescription>Actions by bot this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(usage.byBot as Record<string, any>).map(([botName, data]: [string, any]) => (
                <div key={botName} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">
                      {BOT_LABELS[botName]?.icon} {BOT_LABELS[botName]?.name || botName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Object.entries(data.actions || {}).map(([action, count]) => `${action}: ${count}`).join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{data.count} actions</div>
                    <div className="text-sm text-muted-foreground">${(data.costCents / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {usage?.recentActivity && usage.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Bot Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(usage.recentActivity as any[]).slice(0, 10).map((activity: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{BOT_LABELS[activity.botName]?.icon || "🤖"}</span>
                    <div>
                      <span className="font-medium">{activity.action}</span>
                      {activity.caseId && (
                        <span className="text-sm text-muted-foreground ml-2">Case: {activity.caseId.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
