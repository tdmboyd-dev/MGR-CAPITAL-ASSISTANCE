"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DonutChartComponent,
  BarChartComponent,
} from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  Crown,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  Play,
  Loader2,
  Percent,
} from "lucide-react";

interface TrustEnrollment {
  id: string;
  userId: string;
  userType: string;
  trustType: string;
  trustName: string;
  trustEIN?: string;
  status: string;
  trustState: string;
  founderBeneficiaryPercent: number;
  userBeneficiaryPercent: number;
  totalAssetsProtectedCents: number;
  founderInterestValueCents: number;
  setupFeePaidCents: number;
  annualFeePaidCents: number;
  enrolledAt: string;
  activatedAt?: string;
  createdAt: string;
}

interface FounderInterest {
  totalTrusts: number;
  activeTrusts: number;
  totalAssetsProtected: number;
  founderInterestValue: number;
  byType: {
    BASIC_PROTECTION: { count: number; interest: number };
    ENHANCED_PROTECTION: { count: number; interest: number };
    PREMIUM_ESTATE: { count: number; interest: number };
  };
}

const PLAN_ICONS: Record<string, any> = {
  BASIC_PROTECTION: Shield,
  ENHANCED_PROTECTION: ShieldPlus,
  PREMIUM_ESTATE: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  BASIC_PROTECTION: "bg-blue-500",
  ENHANCED_PROTECTION: "bg-purple-500",
  PREMIUM_ESTATE: "bg-amber-500",
};

const STATUS_BADGES: Record<string, { variant: string; label: string; color: string }> = {
  PENDING: { variant: "secondary", label: "Pending", color: "bg-gray-100 text-gray-700" },
  DOCUMENTS_GENERATED: { variant: "info", label: "Docs Ready", color: "bg-blue-100 text-blue-700" },
  NOTARIZATION_SCHEDULED: { variant: "warning", label: "Notarization", color: "bg-yellow-100 text-yellow-700" },
  NOTARIZATION_IN_PROGRESS: { variant: "warning", label: "Notarizing", color: "bg-yellow-100 text-yellow-700" },
  ACTIVE: { variant: "success", label: "Active", color: "bg-green-100 text-green-700" },
  SUSPENDED: { variant: "destructive", label: "Suspended", color: "bg-red-100 text-red-700" },
  TERMINATED: { variant: "destructive", label: "Terminated", color: "bg-red-100 text-red-700" },
};

const BENEFICIARY_PERCENTS: Record<string, number> = {
  BASIC_PROTECTION: 15,
  ENHANCED_PROTECTION: 20,
  PREMIUM_ESTATE: 25,
};

export default function FounderTrustsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState<TrustEnrollment | null>(null);

  // Fetch all enrollments
  const { data: enrollmentsData, isLoading: enrollmentsLoading, refetch: refetchEnrollments } = useQuery({
    queryKey: ["all-trust-enrollments"],
    queryFn: async () => {
      const { data } = await api.get("/trusts/all");
      return data;
    },
  });

  // Fetch founder interest
  const { data: interestData, isLoading: interestLoading, refetch: refetchInterest } = useQuery({
    queryKey: ["founder-trust-interest"],
    queryFn: async () => {
      const { data } = await api.get("/trusts/founder-interest");
      return data;
    },
  });

  // Fetch plans for revenue calculation
  const { data: plansData } = useQuery({
    queryKey: ["trust-plans"],
    queryFn: async () => {
      const { data } = await api.get("/trusts/plans");
      return data;
    },
  });

  // Activate trust mutation
  const activateMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await api.post(`/trusts/${enrollmentId}/activate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Trust activated successfully!");
      queryClient.invalidateQueries({ queryKey: ["all-trust-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["founder-trust-interest"] });
      setSelectedEnrollment(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to activate trust");
    },
  });

  const enrollments: TrustEnrollment[] = enrollmentsData?.data || [];
  const interest: FounderInterest | null = interestData?.data || null;
  const plans = plansData?.data || [];

  const isLoading = enrollmentsLoading || interestLoading;

  // Filter enrollments
  const filteredEnrollments = enrollments.filter((e) => {
    const term = search.toLowerCase();
    return (
      e.trustName?.toLowerCase().includes(term) ||
      e.trustState?.toLowerCase().includes(term) ||
      e.trustType?.toLowerCase().includes(term) ||
      e.status?.toLowerCase().includes(term)
    );
  });

  // Calculate revenue from fees
  const calculateRevenue = () => {
    let setupFees = 0;
    let annualFees = 0;

    enrollments.forEach((e) => {
      setupFees += e.setupFeePaidCents || 0;
      annualFees += e.annualFeePaidCents || 0;
    });

    return {
      setupFees: setupFees / 100,
      annualFees: annualFees / 100,
      total: (setupFees + annualFees) / 100,
    };
  };

  const revenue = calculateRevenue();

  // Stats by status
  const statsByStatus = {
    active: enrollments.filter((e) => e.status === "ACTIVE").length,
    pending: enrollments.filter((e) => ["PENDING", "DOCUMENTS_GENERATED", "NOTARIZATION_SCHEDULED", "NOTARIZATION_IN_PROGRESS"].includes(e.status)).length,
    inactive: enrollments.filter((e) => ["SUSPENDED", "TERMINATED"].includes(e.status)).length,
  };

  const handleRefresh = async () => {
    await Promise.all([refetchEnrollments(), refetchInterest()]);
    toast.success("Data refreshed");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            Trust Management
          </h1>
          <p className="text-muted-foreground">
            Manage all trust enrollments and founder beneficiary interests
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Founder Interest Overview */}
      {interest && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Founder Beneficiary Interest
            </CardTitle>
            <CardDescription>
              Your total beneficial interest across all active trusts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets Protected</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(interest.totalAssetsProtected * 100)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Interest Value</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(interest.founderInterestValue * 100)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Trusts</p>
                <p className="text-3xl font-bold">{interest.activeTrusts}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enrollments</p>
                <p className="text-3xl font-bold">{interest.totalTrusts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Trusts</p>
                <p className="text-2xl font-bold">{statsByStatus.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Setup</p>
                <p className="text-2xl font-bold">{statsByStatus.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Setup Fee Revenue</p>
                <p className="text-2xl font-bold">${revenue.setupFees.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Fee Revenue</p>
                <p className="text-2xl font-bold">${revenue.annualFees.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Interest by Plan Type</CardTitle>
            <CardDescription>Founder beneficiary interest breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {interest && (
              <DonutChartComponent
                data={[
                  {
                    name: `Basic (15%)`,
                    value: interest.byType.BASIC_PROTECTION.interest || 0,
                  },
                  {
                    name: `Enhanced (20%)`,
                    value: interest.byType.ENHANCED_PROTECTION.interest || 0,
                  },
                  {
                    name: `Premium (25%)`,
                    value: interest.byType.PREMIUM_ESTATE.interest || 0,
                  },
                ]}
                height={250}
                centerLabel="Total"
                centerValue={`$${(interest.founderInterestValue || 0).toLocaleString()}`}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollments by Plan</CardTitle>
            <CardDescription>Distribution of trust plans</CardDescription>
          </CardHeader>
          <CardContent>
            {interest && (
              <BarChartComponent
                data={[
                  {
                    name: "Basic",
                    value: interest.byType.BASIC_PROTECTION.count || 0,
                  },
                  {
                    name: "Enhanced",
                    value: interest.byType.ENHANCED_PROTECTION.count || 0,
                  },
                  {
                    name: "Premium",
                    value: interest.byType.PREMIUM_ESTATE.count || 0,
                  },
                ]}
                height={250}
                color="#8b5cf6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by trust name, state, type, or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Trust Enrollments ({filteredEnrollments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trust enrollments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Trust Name</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">State</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Assets</th>
                    <th className="text-left p-3 font-medium">Your Interest</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enrollment) => {
                    const Icon = PLAN_ICONS[enrollment.trustType] || Shield;
                    const founderPercent = BENEFICIARY_PERCENTS[enrollment.trustType] || 15;
                    const assets = (enrollment.totalAssetsProtectedCents || 0) / 100;
                    const founderInterest = assets * (founderPercent / 100);

                    return (
                      <tr
                        key={enrollment.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${
                              enrollment.trustType === "BASIC_PROTECTION"
                                ? "text-blue-500"
                                : enrollment.trustType === "ENHANCED_PROTECTION"
                                ? "text-purple-500"
                                : "text-amber-500"
                            }`} />
                            <span className="font-medium">{enrollment.trustName}</span>
                          </div>
                          {enrollment.trustEIN && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              EIN: {enrollment.trustEIN}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`${PLAN_COLORS[enrollment.trustType]} text-white`}
                          >
                            {enrollment.trustType.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium">{enrollment.trustState}</td>
                        <td className="p-3">
                          <Badge
                            className={STATUS_BADGES[enrollment.status]?.color || "bg-gray-100"}
                          >
                            {STATUS_BADGES[enrollment.status]?.label || enrollment.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          ${assets.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div>
                            <span className="font-medium text-green-600">
                              ${founderInterest.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground text-sm ml-1">
                              ({founderPercent}%)
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEnrollment(enrollment)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(enrollment.status === "NOTARIZATION_SCHEDULED" ||
                              enrollment.status === "DOCUMENTS_GENERATED") && (
                              <Button
                                size="sm"
                                onClick={() => activateMutation.mutate(enrollment.id)}
                                disabled={activateMutation.isPending}
                              >
                                {activateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedEnrollment && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEnrollment(null)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">{selectedEnrollment.trustName}</h3>
              <Badge
                className={STATUS_BADGES[selectedEnrollment.status]?.color || "bg-gray-100"}
              >
                {STATUS_BADGES[selectedEnrollment.status]?.label || selectedEnrollment.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Trust Type</p>
                <p className="font-medium">{selectedEnrollment.trustType.replace(/_/g, " ")}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">State</p>
                <p className="font-medium">{selectedEnrollment.trustState}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">User Type</p>
                <p className="font-medium">{selectedEnrollment.userType?.replace(/_/g, " ")}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Trust EIN</p>
                <p className="font-mono">{selectedEnrollment.trustEIN || "Pending"}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="font-medium">Beneficiary Split</h4>
              <div className="flex gap-4">
                <div className="flex-1 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-sm text-muted-foreground">User Interest</p>
                  <p className="text-2xl font-bold">{selectedEnrollment.userBeneficiaryPercent}%</p>
                </div>
                <div className="flex-1 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-sm text-muted-foreground">Founder Interest</p>
                  <p className="text-2xl font-bold text-green-600">
                    {selectedEnrollment.founderBeneficiaryPercent}%
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="font-medium">Financials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Assets Protected</p>
                  <p className="font-bold">
                    ${((selectedEnrollment.totalAssetsProtectedCents || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Founder Interest Value</p>
                  <p className="font-bold text-green-600">
                    ${((selectedEnrollment.founderInterestValueCents || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Setup Fee Paid</p>
                  <p className="font-bold">
                    ${((selectedEnrollment.setupFeePaidCents || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Annual Fees Paid</p>
                  <p className="font-bold">
                    ${((selectedEnrollment.annualFeePaidCents || 0) / 100).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <h4 className="font-medium">Timeline</h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Enrolled:</span>{" "}
                  {new Date(selectedEnrollment.enrolledAt).toLocaleDateString()}
                </p>
                {selectedEnrollment.activatedAt && (
                  <p>
                    <span className="text-muted-foreground">Activated:</span>{" "}
                    {new Date(selectedEnrollment.activatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {(selectedEnrollment.status === "NOTARIZATION_SCHEDULED" ||
                selectedEnrollment.status === "DOCUMENTS_GENERATED") && (
                <Button
                  className="flex-1"
                  onClick={() => activateMutation.mutate(selectedEnrollment.id)}
                  disabled={activateMutation.isPending}
                >
                  {activateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Activate Trust
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Trust Program Revenue</CardTitle>
          <CardDescription>Total revenue from trust enrollment fees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
              <p className="text-sm text-muted-foreground">Setup Fees</p>
              <p className="text-3xl font-bold text-blue-600">
                ${revenue.setupFees.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {enrollments.filter(e => e.setupFeePaidCents > 0).length} payments
              </p>
            </div>
            <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
              <p className="text-sm text-muted-foreground">Annual Fees</p>
              <p className="text-3xl font-bold text-green-600">
                ${revenue.annualFees.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Recurring revenue
              </p>
            </div>
            <div className="p-6 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-center">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold text-purple-600">
                ${revenue.total.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                From trust program
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
