"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  AlertTriangle,
  Ban,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Gavel,
  Scale,
  Eye,
  Plus,
  Loader2,
} from "lucide-react";

interface Violation {
  id: string;
  userId: string;
  violationType: string;
  severity: string;
  description: string;
  evidence?: string;
  reportedBy: string;
  reportedAt: string;
  isConfirmed: boolean;
  reviewedAt?: string;
}

interface BanRecord {
  id: string;
  userId: string;
  severity: string;
  status: string;
  reason: string;
  payReductionPercent: number;
  amountForfeited: number;
  appealedAt?: string;
  appealReason?: string;
  issuedAt: string;
}

interface OfficeTableSummary {
  counts: {
    pendingContracts: number;
    pendingViolations: number;
    activeBans: number;
    appealedBans: number;
  };
  recentViolations: Violation[];
  recentBans: BanRecord[];
}

const severityColors: Record<string, string> = {
  WARNING: "bg-yellow-100 text-yellow-800",
  MINOR: "bg-blue-100 text-blue-800",
  MODERATE: "bg-orange-100 text-orange-800",
  SEVERE: "bg-red-100 text-red-800",
  TERMINATION: "bg-red-900 text-white",
};

const severityLabels: Record<string, string> = {
  WARNING: "Warning (0% reduction)",
  MINOR: "Minor (10% reduction)",
  MODERATE: "Moderate (25% reduction)",
  SEVERE: "Severe (50% reduction)",
  TERMINATION: "Termination (100% forfeiture)",
};

export default function OfficeTablePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [selectedBan, setSelectedBan] = useState<BanRecord | null>(null);

  // Report violation form state
  const [reportForm, setReportForm] = useState({
    userId: "",
    violationType: "",
    description: "",
    evidence: "",
  });

  // Fetch summary
  const { data: summary, isLoading } = useQuery<OfficeTableSummary>({
    queryKey: ["office-table-summary"],
    queryFn: async () => {
      const { data } = await api.get("/office-table/summary");
      return data.data;
    },
  });

  // Fetch config (violation types)
  const { data: config } = useQuery({
    queryKey: ["office-table-config"],
    queryFn: async () => {
      const { data } = await api.get("/office-table/config");
      return data.data;
    },
  });

  // Fetch pending violations
  const { data: pendingViolations } = useQuery<Violation[]>({
    queryKey: ["pending-violations"],
    queryFn: async () => {
      const { data } = await api.get("/office-table/violations/pending");
      return data.data;
    },
    enabled: activeTab === "violations",
  });

  // Fetch active bans
  const { data: activeBans } = useQuery<BanRecord[]>({
    queryKey: ["active-bans"],
    queryFn: async () => {
      const { data } = await api.get("/office-table/bans/active");
      return data.data;
    },
    enabled: activeTab === "bans",
  });

  // Fetch appealed bans
  const { data: appealedBans } = useQuery<BanRecord[]>({
    queryKey: ["appealed-bans"],
    queryFn: async () => {
      const { data } = await api.get("/office-table/bans/appeals");
      return data.data;
    },
    enabled: activeTab === "appeals",
  });

  // Report violation mutation
  const reportMutation = useMutation({
    mutationFn: async (data: typeof reportForm) => {
      const { data: res } = await api.post("/office-table/violations", data);
      return res;
    },
    onSuccess: () => {
      toast.success("Violation reported");
      setReportDialogOpen(false);
      setReportForm({ userId: "", violationType: "", description: "", evidence: "" });
      queryClient.invalidateQueries({ queryKey: ["office-table-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pending-violations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to report violation");
    },
  });

  // Review violation mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, confirmed, notes, adjustedSeverity }: {
      id: string;
      confirmed: boolean;
      notes?: string;
      adjustedSeverity?: string;
    }) => {
      const { data } = await api.post(`/api/office-table/violations/${id}/review`, {
        confirmed,
        notes,
        adjustedSeverity,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.confirmed ? "Violation confirmed, ban issued" : "Violation dismissed");
      setSelectedViolation(null);
      queryClient.invalidateQueries({ queryKey: ["office-table-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pending-violations"] });
      queryClient.invalidateQueries({ queryKey: ["active-bans"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to review violation");
    },
  });

  // Review appeal mutation
  const appealMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { data } = await api.post(`/api/office-table/bans/${id}/review-appeal`, { approved });
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.approved ? "Appeal approved, ban lifted" : "Appeal denied");
      setSelectedBan(null);
      queryClient.invalidateQueries({ queryKey: ["office-table-summary"] });
      queryClient.invalidateQueries({ queryKey: ["active-bans"] });
      queryClient.invalidateQueries({ queryKey: ["appealed-bans"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to review appeal");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Gavel className="h-8 w-8" />
              THE OFFICE TABLE
            </h1>
            <p className="text-muted-foreground mt-1">
              Contracts, Violations, and Enforcement
            </p>
          </div>
          <Button onClick={() => setReportDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Report Violation
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pending Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.counts.pendingContracts || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting signature</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Pending Violations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.counts.pendingViolations || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" />
                Active Bans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.counts.activeBans || 0}</div>
              <p className="text-xs text-muted-foreground">Currently enforced</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4 text-blue-500" />
                Appeals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.counts.appealedBans || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting decision</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="bans">Active Bans</TabsTrigger>
            <TabsTrigger value="appeals">Appeals</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Violations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Violations</CardTitle>
                  <CardDescription>Last 10 reported violations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary?.recentViolations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No violations reported
                      </p>
                    ) : (
                      summary?.recentViolations.map((v) => (
                        <div key={v.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">{v.violationType.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(v.reportedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={severityColors[v.severity]}>
                              {v.severity}
                            </Badge>
                            {v.isConfirmed ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Bans */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Bans</CardTitle>
                  <CardDescription>Last 10 issued bans</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary?.recentBans.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No bans issued
                      </p>
                    ) : (
                      summary?.recentBans.map((b) => (
                        <div key={b.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">{b.severity}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {b.reason}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={b.status === "ACTIVE" ? "destructive" : "secondary"}>
                              {b.status}
                            </Badge>
                            {b.amountForfeited > 0 && (
                              <p className="text-xs text-red-500 mt-1">
                                -${(b.amountForfeited / 100).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pay Reduction Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Pay Reduction Schedule
                </CardTitle>
                <CardDescription>
                  Pending pay is reduced based on violation severity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {Object.entries(severityLabels).map(([severity, label]) => (
                    <div
                      key={severity}
                      className={`p-4 rounded-lg text-center ${severityColors[severity]}`}
                    >
                      <p className="font-bold text-lg">
                        {config?.payReductions?.[severity] || 0}%
                      </p>
                      <p className="text-xs mt-1">{severity}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Violations Tab */}
          <TabsContent value="violations">
            <Card>
              <CardHeader>
                <CardTitle>Pending Violations</CardTitle>
                <CardDescription>Review and confirm reported violations</CardDescription>
              </CardHeader>
              <CardContent>
                {!pendingViolations?.length ? (
                  <p className="text-muted-foreground text-center py-8">
                    No pending violations to review
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingViolations.map((v) => (
                      <div key={v.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {v.violationType.replace(/_/g, " ")}
                              </h4>
                              <Badge className={severityColors[v.severity]}>
                                {v.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              User ID: {v.userId}
                            </p>
                            <p className="text-sm mt-2">{v.description}</p>
                            {v.evidence && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Evidence: {v.evidence}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Reported: {new Date(v.reportedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedViolation(v)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Bans Tab */}
          <TabsContent value="bans">
            <Card>
              <CardHeader>
                <CardTitle>Active Bans</CardTitle>
                <CardDescription>Currently enforced bans</CardDescription>
              </CardHeader>
              <CardContent>
                {!activeBans?.length ? (
                  <p className="text-muted-foreground text-center py-8">
                    No active bans
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeBans.map((b) => (
                      <div key={b.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{b.severity}</h4>
                              <Badge variant="destructive">ACTIVE</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              User ID: {b.userId}
                            </p>
                            <p className="text-sm mt-2">{b.reason}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span>Pay reduction: {b.payReductionPercent}%</span>
                              {b.amountForfeited > 0 && (
                                <span className="text-red-500">
                                  Forfeited: ${(b.amountForfeited / 100).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Issued: {new Date(b.issuedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appeals Tab */}
          <TabsContent value="appeals">
            <Card>
              <CardHeader>
                <CardTitle>Pending Appeals</CardTitle>
                <CardDescription>Review ban appeals</CardDescription>
              </CardHeader>
              <CardContent>
                {!appealedBans?.length ? (
                  <p className="text-muted-foreground text-center py-8">
                    No pending appeals
                  </p>
                ) : (
                  <div className="space-y-4">
                    {appealedBans.map((b) => (
                      <div key={b.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{b.severity}</h4>
                              <Badge variant="secondary">APPEALED</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              User ID: {b.userId}
                            </p>
                            <p className="text-sm mt-2">
                              <strong>Original Reason:</strong> {b.reason}
                            </p>
                            {b.appealReason && (
                              <p className="text-sm mt-2">
                                <strong>Appeal:</strong> {b.appealReason}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Appealed: {b.appealedAt ? new Date(b.appealedAt).toLocaleString() : "N/A"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => appealMutation.mutate({ id: b.id, approved: true })}
                              disabled={appealMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => appealMutation.mutate({ id: b.id, approved: false })}
                              disabled={appealMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Report Violation Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Violation</DialogTitle>
            <DialogDescription>
              Report a policy violation for review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Enter user ID"
                value={reportForm.userId}
                onChange={(e) => setReportForm({ ...reportForm, userId: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Violation Type</label>
              <Select
                value={reportForm.violationType}
                onValueChange={(v) => setReportForm({ ...reportForm, violationType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {config?.violationTypes &&
                    Object.entries(config.violationTypes).map(([key, value]: [string, any]) => (
                      <SelectItem key={key} value={key}>
                        {value.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the violation"
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Evidence (optional)</label>
              <Textarea
                placeholder="Links, screenshots, notes"
                value={reportForm.evidence}
                onChange={(e) => setReportForm({ ...reportForm, evidence: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => reportMutation.mutate(reportForm)}
              disabled={reportMutation.isPending || !reportForm.userId || !reportForm.violationType || !reportForm.description}
            >
              {reportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Violation Dialog */}
      <Dialog open={!!selectedViolation} onOpenChange={() => setSelectedViolation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Violation</DialogTitle>
            <DialogDescription>
              Confirm or dismiss this violation report
            </DialogDescription>
          </DialogHeader>
          {selectedViolation && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedViolation.violationType.replace(/_/g, " ")}</p>
                <Badge className={`mt-2 ${severityColors[selectedViolation.severity]}`}>
                  {severityLabels[selectedViolation.severity]}
                </Badge>
                <p className="mt-2 text-sm">{selectedViolation.description}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Confirming will issue a ban with the specified severity. The user's pending pay will be reduced accordingly.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => reviewMutation.mutate({
                id: selectedViolation!.id,
                confirmed: false,
                notes: "Dismissed",
              })}
              disabled={reviewMutation.isPending}
            >
              Dismiss
            </Button>
            <Button
              variant="destructive"
              onClick={() => reviewMutation.mutate({
                id: selectedViolation!.id,
                confirmed: true,
              })}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Issue Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
