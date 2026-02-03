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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  Crown,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface TrustPlan {
  type: string;
  name: string;
  setupFee: number;
  annualFee: number;
  features: string[];
  description: string;
}

interface TrustEnrollment {
  id: string;
  trustType: string;
  trustName: string;
  trustEIN?: string;
  status: string;
  trustState: string;
  userBeneficiaryPercent: number;
  additionalBeneficiaries: { name: string; percent: number; relationship: string }[];
  totalAssetsProtected: number;
  nextAnnualFeeDate?: string;
  enrolledAt: string;
  activatedAt?: string;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const PLAN_ICONS: Record<string, any> = {
  BASIC_PROTECTION: Shield,
  ENHANCED_PROTECTION: ShieldPlus,
  PREMIUM_ESTATE: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  BASIC_PROTECTION: "border-blue-500 bg-blue-500/5",
  ENHANCED_PROTECTION: "border-purple-500 bg-purple-500/5",
  PREMIUM_ESTATE: "border-amber-500 bg-amber-500/5",
};

const STATUS_BADGES: Record<string, { variant: string; label: string }> = {
  PENDING: { variant: "secondary", label: "Pending Setup" },
  DOCUMENTS_GENERATED: { variant: "info", label: "Documents Ready" },
  NOTARIZATION_SCHEDULED: { variant: "warning", label: "Notarization Scheduled" },
  NOTARIZATION_IN_PROGRESS: { variant: "warning", label: "Notarizing..." },
  ACTIVE: { variant: "success", label: "Active" },
  SUSPENDED: { variant: "destructive", label: "Suspended" },
  TERMINATED: { variant: "destructive", label: "Terminated" },
};

export default function EmployeeTrustsPage() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>("");

  // Fetch available plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["trust-plans"],
    queryFn: async () => {
      const { data } = await api.get("/trusts/plans");
      return data;
    },
  });

  // Fetch user's enrollment
  const { data: enrollmentData, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["my-trust-enrollment"],
    queryFn: async () => {
      const { data } = await api.get("/trusts/my-enrollment");
      return data;
    },
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async (data: { trustType: string; state: string }) => {
      const response = await api.post("/trusts/enroll", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Successfully enrolled in trust program!");
      queryClient.invalidateQueries({ queryKey: ["my-trust-enrollment"] });
      setSelectedPlan(null);
      setSelectedState("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to enroll");
    },
  });

  // Pay setup fee mutation
  const paySetupMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await api.post(`/trusts/${enrollmentId}/pay-setup`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Setup fee paid successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-trust-enrollment"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Payment failed");
    },
  });

  // Schedule notarization mutation
  const scheduleNotarizationMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await api.post(`/trusts/${enrollmentId}/schedule-notarization`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Notarization session scheduled!");
      queryClient.invalidateQueries({ queryKey: ["my-trust-enrollment"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to schedule");
    },
  });

  const plans: TrustPlan[] = plansData?.data || [];
  const enrollment: TrustEnrollment | null = enrollmentData?.data || null;
  const isLoading = plansLoading || enrollmentLoading;

  const handleEnroll = () => {
    if (!selectedPlan || !selectedState) {
      toast.error("Please select a plan and state");
      return;
    }
    enrollMutation.mutate({ trustType: selectedPlan, state: selectedState });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          Trust & Estate Protection
        </h1>
        <p className="text-muted-foreground">
          Protect your earnings with automated trust creation and management
        </p>
      </div>

      {/* Current Enrollment Status */}
      {enrollment && (
        <Card className="border-2 border-green-500/30 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Your Trust Enrollment
                </CardTitle>
                <CardDescription>
                  {enrollment.trustName}
                </CardDescription>
              </div>
              <Badge
                variant={
                  STATUS_BADGES[enrollment.status]?.variant as any || "secondary"
                }
              >
                {STATUS_BADGES[enrollment.status]?.label || enrollment.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">Trust Type</p>
                <p className="font-medium">{enrollment.trustType.replace(/_/g, " ")}</p>
              </div>
              <div className="p-4 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">State</p>
                <p className="font-medium">{enrollment.trustState}</p>
              </div>
              <div className="p-4 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">Your Beneficial Interest</p>
                <p className="font-medium">{enrollment.userBeneficiaryPercent}%</p>
              </div>
              <div className="p-4 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">Assets Protected</p>
                <p className="font-medium">${enrollment.totalAssetsProtected.toLocaleString()}</p>
              </div>
            </div>

            {enrollment.trustEIN && (
              <div className="p-4 rounded-lg bg-background mb-4">
                <p className="text-sm text-muted-foreground">Trust EIN</p>
                <p className="font-mono font-medium">{enrollment.trustEIN}</p>
              </div>
            )}

            {enrollment.nextAnnualFeeDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                Next annual fee due: {new Date(enrollment.nextAnnualFeeDate).toLocaleDateString()}
              </div>
            )}

            {/* Action buttons based on status */}
            <div className="flex gap-3">
              {enrollment.status === "PENDING" && (
                <Button
                  onClick={() => paySetupMutation.mutate(enrollment.id)}
                  disabled={paySetupMutation.isPending}
                >
                  {paySetupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4 mr-2" />
                  )}
                  Pay Setup Fee
                </Button>
              )}

              {enrollment.status === "DOCUMENTS_GENERATED" && (
                <Button
                  onClick={() => scheduleNotarizationMutation.mutate(enrollment.id)}
                  disabled={scheduleNotarizationMutation.isPending}
                >
                  {scheduleNotarizationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  Schedule Notarization
                </Button>
              )}

              {enrollment.status === "NOTARIZATION_SCHEDULED" && (
                <Button variant="outline" disabled>
                  <Clock className="h-4 w-4 mr-2" />
                  Notarization Pending
                </Button>
              )}

              {enrollment.status === "ACTIVE" && (
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  View Trust Documents
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollment Progress Steps */}
      {enrollment && enrollment.status !== "ACTIVE" && (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {[
                { key: "PENDING", label: "Enrolled" },
                { key: "DOCUMENTS_GENERATED", label: "Documents Ready" },
                { key: "NOTARIZATION_SCHEDULED", label: "Notarization" },
                { key: "ACTIVE", label: "Active" },
              ].map((step, index, arr) => {
                const stepOrder = ["PENDING", "DOCUMENTS_GENERATED", "NOTARIZATION_SCHEDULED", "NOTARIZATION_IN_PROGRESS", "ACTIVE"];
                const currentIndex = stepOrder.indexOf(enrollment.status);
                const stepIndex = stepOrder.indexOf(step.key);
                const isComplete = stepIndex < currentIndex || enrollment.status === step.key;
                const isCurrent = enrollment.status === step.key ||
                  (step.key === "NOTARIZATION_SCHEDULED" && enrollment.status === "NOTARIZATION_IN_PROGRESS");

                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isComplete
                            ? "bg-green-500 text-white"
                            : isCurrent
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isComplete && stepIndex < currentIndex ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      <span className="text-sm mt-2">{step.label}</span>
                    </div>
                    {index < arr.length - 1 && (
                      <div
                        className={`h-1 w-16 mx-2 ${
                          stepIndex < currentIndex ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      {!enrollment && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Protection Plan</CardTitle>
              <CardDescription>
                Select a trust plan that fits your asset protection needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const Icon = PLAN_ICONS[plan.type] || Shield;
                  const isSelected = selectedPlan === plan.type;

                  return (
                    <div
                      key={plan.type}
                      onClick={() => setSelectedPlan(plan.type)}
                      className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? `${PLAN_COLORS[plan.type]} border-opacity-100 ring-2 ring-offset-2 ring-primary`
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {plan.type === "PREMIUM_ESTATE" && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-amber-500">Most Popular</Badge>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className={`p-3 rounded-lg ${
                            plan.type === "BASIC_PROTECTION"
                              ? "bg-blue-100 text-blue-600"
                              : plan.type === "ENHANCED_PROTECTION"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{plan.name}</h3>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">${plan.setupFee}</span>
                          <span className="text-muted-foreground">setup</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          + ${plan.annualFee}/year
                        </p>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        {plan.description}
                      </p>

                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Complete Your Enrollment</CardTitle>
                <CardDescription>
                  Select your state of residence to proceed with trust creation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">
                      State of Residence
                    </label>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleEnroll}
                    disabled={!selectedState || enrollMutation.isPending}
                  >
                    {enrollMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Enroll Now
                  </Button>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">What happens next?</p>
                      <ol className="mt-2 space-y-1 text-muted-foreground list-decimal list-inside">
                        <li>Pay the one-time setup fee</li>
                        <li>Trust documents are automatically generated</li>
                        <li>Complete notarization via remote online notarization (RON)</li>
                        <li>Your trust becomes active and earnings flow automatically</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Benefits Section */}
      <Card>
        <CardHeader>
          <CardTitle>Why Use Trust Protection?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Asset Protection</h4>
                <p className="text-sm text-muted-foreground">
                  Shield your earnings from lawsuits, creditors, and judgments
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Tax Benefits</h4>
                <p className="text-sm text-muted-foreground">
                  Potential tax advantages through proper trust structuring
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">Estate Planning</h4>
                <p className="text-sm text-muted-foreground">
                  Seamless wealth transfer to your designated beneficiaries
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
