"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Users, DollarSign, Activity, ToggleLeft, ToggleRight, TrendingUp, Shield } from "lucide-react";

const TIER_LABELS: Record<string, { label: string; price: string; color: string }> = {
  STARTER: { label: "Starter", price: "$50/mo", color: "text-blue-500" },
  PROFESSIONAL: { label: "Professional", price: "$150/mo", color: "text-purple-500" },
  ENTERPRISE: { label: "Enterprise", price: "$300/mo", color: "text-orange-500" },
  UNLIMITED: { label: "Unlimited", price: "$500/mo", color: "text-yellow-500" },
  FOUNDER: { label: "Founder", price: "Free", color: "text-green-500" },
};

export default function FounderBotsPage() {
  const queryClient = useQueryClient();

  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ["all-bot-subscriptions"],
    queryFn: async () => {
      const { data } = await api.get("/bot-subscriptions/all");
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

  const { data: myData } = useQuery({
    queryKey: ["my-bot-subscription"],
    queryFn: async () => {
      const { data } = await api.get("/bot-subscriptions/mine");
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data } = await api.put(`/bot-subscriptions/${subscriptionId}/toggle`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bot-subscriptions"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const subscriptions = subscriptionsData?.subscriptions || [];
  const totalRevenue = subscriptions
    .filter((s: any) => s.tier !== "FOUNDER")
    .reduce((sum: number, s: any) => sum + s.monthlyCostCents, 0);

  const tierDistribution = subscriptions.reduce((acc: Record<string, number>, s: any) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  const totalUsageCost = subscriptions.reduce((sum: number, s: any) => sum + s.totalChargedCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" /> Bot Admin Panel
        </h1>
        <p className="text-muted-foreground">
          Manage all employee bot subscriptions, view performance, control costs
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscribers</CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">
              {subscriptions.filter((s: any) => s.isActive).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toFixed(0)}/mo</div>
            <p className="text-xs text-muted-foreground">From bot subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Charged</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalUsageCost / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Lifetime revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Founder Bots</CardTitle>
            <Shield className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">ALL ENABLED</div>
            <p className="text-xs text-muted-foreground">$0 cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
          <CardDescription>Subscribers by plan level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(TIER_LABELS).map(([tier, info]) => {
              const count = tierDistribution[tier] || 0;
              return (
                <div key={tier} className="text-center p-4 rounded-lg border min-w-[120px]">
                  <div className={`text-2xl font-bold ${info.color}`}>{count}</div>
                  <div className="text-sm font-medium">{info.label}</div>
                  <div className="text-xs text-muted-foreground">{info.price}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available Tiers */}
      {tiers?.tiers && (
        <Card>
          <CardHeader>
            <CardTitle>Available Tiers</CardTitle>
            <CardDescription>Bot access by subscription level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Tier</th>
                    <th className="text-left py-2 px-3">Price</th>
                    <th className="text-left py-2 px-3">Included Bots</th>
                  </tr>
                </thead>
                <tbody>
                  {(tiers.tiers as any[]).map((tier: any) => (
                    <tr key={tier.tier} className="border-b">
                      <td className={`py-2 px-3 font-medium ${TIER_LABELS[tier.tier]?.color || ""}`}>
                        {TIER_LABELS[tier.tier]?.label || tier.tier}
                      </td>
                      <td className="py-2 px-3">{tier.monthlyPrice}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(tier.bots as string[]).map((bot: string) => (
                            <span key={bot} className="px-2 py-0.5 rounded-full bg-muted text-xs">
                              {bot}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>All Employee Subscriptions</CardTitle>
          <CardDescription>
            Toggle to enable/disable subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {subscriptions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No subscriptions yet</p>
            ) : (
              subscriptions.map((sub: any) => {
                const tierInfo = TIER_LABELS[sub.tier] || TIER_LABELS.STARTER;
                return (
                  <div
                    key={sub.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      sub.isActive ? "border-border" : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">{sub.user?.name || "Unknown User"}</div>
                        <div className="text-sm text-muted-foreground">{sub.user?.email}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${tierInfo.color} bg-muted`}>
                        {tierInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{tierInfo.price}</div>
                        <div className="text-xs text-muted-foreground">
                          Charged: ${(sub.totalChargedCents / 100).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleMutation.mutate(sub.id)}
                        disabled={toggleMutation.isPending}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title={sub.isActive ? "Disable subscription" : "Enable subscription"}
                      >
                        {sub.isActive ? (
                          <ToggleRight className="h-8 w-8 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* My Founder Usage */}
      {myData?.usage && (
        <Card>
          <CardHeader>
            <CardTitle>Your Founder Usage</CardTitle>
            <CardDescription>Your personal bot activity this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Total Actions</span>
                <div className="text-2xl font-bold">{myData.usage.totalActions || 0}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Action Cost</span>
                <div className="text-2xl font-bold">
                  ${((myData.usage.totalCostCents || 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
