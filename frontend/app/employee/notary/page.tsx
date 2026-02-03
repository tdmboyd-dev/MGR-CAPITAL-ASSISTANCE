"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Award,
  DollarSign,
  Clock,
  Star,
  Video,
  Calendar,
  CheckCircle,
  AlertCircle,
  Zap,
  Bot,
  ArrowRight,
  Play,
  History,
  Briefcase,
  TrendingUp,
  Shield,
} from "lucide-react";
import { useState } from "react";

// Tier badge colors
const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-700 text-white",
  SILVER: "bg-gray-400 text-white",
  GOLD: "bg-yellow-500 text-white",
  PLATINUM: "bg-blue-400 text-white",
  DIAMOND: "bg-purple-500 text-white",
};

// Session status colors
const SESSION_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  waiting: "bg-yellow-500",
  in_progress: "bg-green-500",
  completed: "bg-emerald-600",
  cancelled: "bg-red-500",
  no_show: "bg-gray-500",
};

// Application status display
const APPLICATION_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending Review", color: "bg-yellow-500", icon: Clock },
  training_required: { label: "Training Required", color: "bg-blue-500", icon: Award },
  background_check: { label: "Background Check", color: "bg-purple-500", icon: Shield },
  approved: { label: "Approved", color: "bg-green-500", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-500", icon: AlertCircle },
};

export default function EmployeeNotaryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["employee-notary-dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/employee-notary/dashboard");
      return data.data;
    },
    retry: false,
  });

  // Fetch automation subscription
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["notary-automation-subscription"],
    queryFn: async () => {
      const { data } = await api.get("/employee-notary/automation/subscription");
      return data.data;
    },
  });

  // Fetch automation plans
  const { data: plansData } = useQuery({
    queryKey: ["notary-automation-plans"],
    queryFn: async () => {
      const { data } = await api.get("/employee-notary/automation/plans");
      return data.data;
    },
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { data } = await api.post("/employee-notary/automation/subscribe", { tier });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notary-automation-subscription"] });
      setSubscribingTier(null);
    },
    onError: () => {
      setSubscribingTier(null);
    },
  });

  // Check if user is an active notary or has a pending application
  const isActiveNotary = !!dashboardData;
  const isNotNotary = dashboardError && (dashboardError as any)?.response?.status === 400;

  // Loading state
  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not a notary - show application prompt
  if (isNotNotary) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Notary Services</h1>
          <p className="text-muted-foreground">
            Become a certified notary and earn extra income
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Become a Notary
            </CardTitle>
            <CardDescription>
              Join our notary program and earn money notarizing asset recovery documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <DollarSign className="h-8 w-8 text-emerald-500 mb-2" />
                <h3 className="font-medium">Earn Extra Income</h3>
                <p className="text-sm text-muted-foreground">
                  $25-$150 per session based on document type
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Clock className="h-8 w-8 text-blue-500 mb-2" />
                <h3 className="font-medium">Flexible Schedule</h3>
                <p className="text-sm text-muted-foreground">
                  Work when you want, from anywhere
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <TrendingUp className="h-8 w-8 text-purple-500 mb-2" />
                <h3 className="font-medium">Growth Tiers</h3>
                <p className="text-sm text-muted-foreground">
                  Unlock higher earnings as you complete more sessions
                </p>
              </div>
            </div>

            <div className="pt-4">
              <h4 className="font-medium mb-2">Requirements:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>- Active notary commission in your state</li>
                <li>- Valid E&O insurance</li>
                <li>- Pass background check</li>
                <li>- Complete RON training certification</li>
              </ul>
            </div>

            <div className="pt-4">
              <Link href="/employee/notary/apply">
                <Button size="lg">
                  Start Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active notary dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notary Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your notary sessions and track earnings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Tier
            </CardTitle>
            <Award className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className={TIER_COLORS[dashboardData?.tier] || "bg-gray-500"}>
                {dashboardData?.tierName || "Bronze"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardData?.totalSignings || 0} total sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <Calendar className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.thisMonthSignings || 0}</div>
            <p className="text-xs text-muted-foreground">sessions completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Earnings
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData?.displayedEarningsThisMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Payout: {formatCurrency(dashboardData?.pendingPayoutCents || 0)}
              {dashboardData?.platformFeePercent > 0 && (
                <span className="text-yellow-600">
                  {" "}(-{dashboardData.platformFeePercent}% platform fee)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rating
            </CardTitle>
            <Star className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData?.averageRating || 0).toFixed(1)}
              <span className="text-sm text-muted-foreground">/5.0</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData?.completionRate || 100}% completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Session Actions
            </CardTitle>
            <CardDescription>Start or manage your notary sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/employee/notary/sessions/start">
              <Button className="w-full justify-start" size="lg">
                <Play className="mr-2 h-5 w-5" />
                Start RON Session
              </Button>
            </Link>
            <Link href="/employee/notary/sessions">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <History className="mr-2 h-5 w-5" />
                View Session History
              </Button>
            </Link>
            <Link href="/employee/notary/available">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Briefcase className="mr-2 h-5 w-5" />
                Available Sessions to Claim
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Automation Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-500" />
              Automation Subscription
            </CardTitle>
            <CardDescription>
              Automate your notary workflow and save time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptionLoading ? (
              <SkeletonList items={2} />
            ) : subscriptionData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={subscriptionData.isActive ? "success" : "secondary"}>
                        {subscriptionData.tier}
                      </Badge>
                      {subscriptionData.isActive && (
                        <Zap className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subscriptionData.monthlyCostCents > 0
                        ? `${formatCurrency(subscriptionData.monthlyCostCents)}/month`
                        : "Free"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{subscriptionData.autoSessionsThisMonth} automated</p>
                    <p>{subscriptionData.timeSavedMinutes} min saved</p>
                  </div>
                </div>

                {subscriptionData.tier !== "ENTERPRISE" && subscriptionData.tier !== "FOUNDER" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSubscribingTier("upgrade")}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Upgrade Plan
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  No automation subscription active. Subscribe to automate reminders,
                  document prep, ID verification, and more.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setSubscribingTier("new")}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Subscribe to Automation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Automation Plans Modal/Section */}
      {subscribingTier && plansData && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Automation Plan</CardTitle>
            <CardDescription>
              Select a plan that fits your workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plansData
                .filter((plan: any) => plan.tier !== "NONE")
                .map((plan: any) => (
                  <div
                    key={plan.tier}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      subscriptionData?.tier === plan.tier
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {subscriptionData?.tier === plan.tier && (
                        <Badge variant="success">Current</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-3">
                      {formatCurrency(plan.monthlyCostCents)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                      {plan.features.slice(0, 4).map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {plan.features.length > 4 && (
                        <li className="text-primary">+{plan.features.length - 4} more</li>
                      )}
                    </ul>
                    <Button
                      className="w-full"
                      variant={subscriptionData?.tier === plan.tier ? "outline" : "default"}
                      disabled={
                        subscribeMutation.isPending ||
                        subscriptionData?.tier === plan.tier
                      }
                      onClick={() => subscribeMutation.mutate(plan.tier)}
                    >
                      {subscribeMutation.isPending && subscribingTier === plan.tier
                        ? "Processing..."
                        : subscriptionData?.tier === plan.tier
                        ? "Current Plan"
                        : "Subscribe"}
                    </Button>
                  </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setSubscribingTier(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming Sessions</CardTitle>
            <CardDescription>Your scheduled notarization appointments</CardDescription>
          </div>
          <Link href="/employee/notary/sessions" className="text-sm text-primary flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {dashboardData?.upcomingSessions?.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.upcomingSessions.map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{session.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.documentType} - {session.sessionType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge className={SESSION_STATUS_COLORS[session.status] || "bg-gray-500"}>
                        {session.status.replace(/_/g, " ")}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(session.scheduledTime)}
                      </p>
                    </div>
                    {session.status === "scheduled" && (
                      <Link href={`/employee/notary/sessions/${session.id}/start`}>
                        <Button size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming sessions</p>
              <Link href="/employee/notary/available" className="text-primary text-sm">
                Browse available sessions to claim
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Progress</CardTitle>
          <CardDescription>
            Complete more sessions to unlock higher earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Current: {dashboardData?.tierName || "Bronze"}</span>
              <span>{dashboardData?.totalSignings || 0} sessions</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary rounded-full h-3 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    ((dashboardData?.totalSignings || 0) / 500) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <div className="grid grid-cols-5 gap-2 text-xs text-center text-muted-foreground">
              <div className={dashboardData?.totalSignings >= 0 ? "text-primary font-medium" : ""}>
                Bronze<br />0+
              </div>
              <div className={dashboardData?.totalSignings >= 25 ? "text-primary font-medium" : ""}>
                Silver<br />25+
              </div>
              <div className={dashboardData?.totalSignings >= 100 ? "text-primary font-medium" : ""}>
                Gold<br />100+
              </div>
              <div className={dashboardData?.totalSignings >= 250 ? "text-primary font-medium" : ""}>
                Platinum<br />250+
              </div>
              <div className={dashboardData?.totalSignings >= 500 ? "text-primary font-medium" : ""}>
                Diamond<br />500+
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Higher tiers = lower platform fees = more earnings!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
