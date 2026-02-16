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
  Clock,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  AlertTriangle,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  Play,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface RetentionDashboard {
  active: number;
  retentionHold: number;
  markedForDeletion: number;
  approvedDeletion: number;
  deleted: number;
  expiringSoon: number;
  total: number;
  retentionRules: { state: string; years: number }[];
  defaultRetentionYears: number;
  deletionGraceDays: number;
}

interface MarkedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  type: string;
  caseCode: string;
  caseState: string;
  caseCounty: string;
  propertyAddress: string;
  caseStatus: string;
  closedAt: string;
  markedAt: string;
  markedBy: string;
  retentionExpiresAt: string;
}

interface HoldDocument {
  id: string;
  fileName: string;
  fileSize: number;
  type: string;
  caseCode: string;
  caseState: string;
  caseCounty: string;
  closedAt: string;
  retentionExpiresAt: string;
  retentionYears: number;
}

// ============================================
// HELPERS
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function RetentionPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"marked" | "hold" | "rules">("marked");
  const [page, setPage] = useState(1);

  // Queries
  const { data: dashboard, isLoading: dashLoading } = useQuery<RetentionDashboard>({
    queryKey: ["retention-dashboard"],
    queryFn: () => api.get("/retention/dashboard").then((r) => r.data),
  });

  const { data: markedData, isLoading: markedLoading } = useQuery({
    queryKey: ["retention-marked", page],
    queryFn: () =>
      api.get(`/api/retention/marked?page=${page}&limit=25`).then((r) => r.data),
    enabled: activeTab === "marked",
  });

  const { data: holdData, isLoading: holdLoading } = useQuery({
    queryKey: ["retention-hold", page],
    queryFn: () =>
      api.get(`/api/retention/hold?page=${page}&limit=25`).then((r) => r.data),
    enabled: activeTab === "hold",
  });

  // Mutations
  const approveMut = useMutation({
    mutationFn: (ids: string[]) =>
      api.post("/retention/approve", { documentIds: ids }),
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} document(s) approved for deletion`);
      queryClient.invalidateQueries({ queryKey: ["retention-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["retention-marked"] });
      setSelectedIds(new Set());
    },
    onError: () => toast.error("Failed to approve deletions"),
  });

  const rejectMut = useMutation({
    mutationFn: (ids: string[]) =>
      api.post("/retention/reject", { documentIds: ids, extendYears: 1 }),
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} document(s) returned to retention hold (+1 year)`);
      queryClient.invalidateQueries({ queryKey: ["retention-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["retention-marked"] });
      setSelectedIds(new Set());
    },
    onError: () => toast.error("Failed to reject deletions"),
  });

  const approveAllMut = useMutation({
    mutationFn: () => api.post("/retention/approve-all"),
    onSuccess: () => {
      toast.success("All marked documents approved for deletion");
      queryClient.invalidateQueries({ queryKey: ["retention-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["retention-marked"] });
    },
    onError: () => toast.error("Failed to approve all"),
  });

  const runCycleMut = useMutation({
    mutationFn: () => api.post("/retention/run-cycle"),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["retention-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["retention-marked"] });
      queryClient.invalidateQueries({ queryKey: ["retention-hold"] });
    },
    onError: () => toast.error("Retention cycle failed"),
  });

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = (docs: { id: string }[]) => {
    setSelectedIds(new Set(docs.map((d) => d.id)));
  };

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">File Retention & Auto-Deletion</h1>
          <p className="text-muted-foreground">
            State-by-state retention policies. Only you and the retention bot can delete files.
          </p>
        </div>
        <Button
          onClick={() => runCycleMut.mutate()}
          disabled={runCycleMut.isPending}
          variant="outline"
        >
          {runCycleMut.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Run Retention Cycle
        </Button>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">{dashboard.active}</div>
              <div className="text-xs text-muted-foreground">Active Files</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {dashboard.retentionHold}
              </div>
              <div className="text-xs text-muted-foreground">Retention Hold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {dashboard.markedForDeletion}
              </div>
              <div className="text-xs text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {dashboard.approvedDeletion}
              </div>
              <div className="text-xs text-muted-foreground">Approved Deletion</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-gray-400">{dashboard.deleted}</div>
              <div className="text-xs text-muted-foreground">Deleted</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {dashboard.expiringSoon}
              </div>
              <div className="text-xs text-muted-foreground">Expiring (30d)</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "marked" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setActiveTab("marked");
            setPage(1);
            setSelectedIds(new Set());
          }}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Pending Review ({dashboard?.markedForDeletion || 0})
        </Button>
        <Button
          variant={activeTab === "hold" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setActiveTab("hold");
            setPage(1);
            setSelectedIds(new Set());
          }}
        >
          <Clock className="w-4 h-4 mr-1" />
          Retention Hold ({dashboard?.retentionHold || 0})
        </Button>
        <Button
          variant={activeTab === "rules" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("rules")}
        >
          <Shield className="w-4 h-4 mr-1" />
          State Rules
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "marked" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Documents Marked for Deletion</CardTitle>
                <CardDescription>
                  These documents have passed their retention period. Approve to permanently
                  delete, or reject to extend retention.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => approveMut.mutate(Array.from(selectedIds))}
                      disabled={approveMut.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMut.mutate(Array.from(selectedIds))}
                      disabled={rejectMut.isPending}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject ({selectedIds.size})
                    </Button>
                  </>
                )}
                {(markedData?.total || 0) > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => approveAllMut.mutate()}
                    disabled={approveAllMut.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Approve All
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {markedLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !markedData?.documents?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No documents pending review</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => selectAll(markedData.documents)}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  {markedData.documents.map((doc: MarkedDocument) => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIds.has(doc.id)
                          ? "bg-red-50 border-red-300 dark:bg-red-950"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleSelection(doc.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelection(doc.id)}
                        className="w-4 h-4"
                      />
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{doc.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.caseCode} &middot; {doc.caseState}/{doc.caseCounty} &middot;{" "}
                          {formatBytes(doc.fileSize)} &middot; {doc.type}
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <div className="text-muted-foreground">
                          Retention expired {formatDate(doc.retentionExpiresAt)}
                        </div>
                        <div className="text-muted-foreground">
                          Marked by {doc.markedBy} on {formatDate(doc.markedAt)}
                        </div>
                      </div>
                      <Badge variant="destructive" className="shrink-0">
                        Delete?
                      </Badge>
                    </div>
                  ))}
                </div>
                {/* Pagination */}
                {markedData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {markedData.totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= markedData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "hold" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents in Retention Hold</CardTitle>
            <CardDescription>
              These documents are from closed cases and will be auto-marked for deletion when
              their state retention period expires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {holdLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !holdData?.documents?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-2" />
                <p>No documents currently in retention hold</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {holdData.documents.map((doc: HoldDocument) => {
                    const days = daysUntil(doc.retentionExpiresAt);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {doc.caseCode} &middot; {doc.caseState}/{doc.caseCounty} &middot;{" "}
                            {formatBytes(doc.fileSize)} &middot; {doc.type}
                          </div>
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div className="text-muted-foreground">
                            Closed {formatDate(doc.closedAt)}
                          </div>
                          <div className="text-muted-foreground">
                            Retention: {doc.retentionYears} years ({doc.caseState})
                          </div>
                        </div>
                        <Badge
                          variant={days <= 30 ? "destructive" : days <= 90 ? "secondary" : "outline"}
                          className="shrink-0"
                        >
                          {days > 0 ? `${days}d left` : "Expired"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {holdData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {holdData.totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= holdData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "rules" && dashboard && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">State Retention Rules</CardTitle>
            <CardDescription>
              How long documents must be kept after case closure, by state.
              Default for unlisted states: {dashboard.defaultRetentionYears} years.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {dashboard.retentionRules.map((rule) => (
                <div
                  key={rule.state}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <span className="font-mono font-bold">{rule.state}</span>
                  <Badge
                    variant={
                      rule.years <= 2
                        ? "default"
                        : rule.years <= 3
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {rule.years}yr
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
              <Shield className="w-4 h-4 inline mr-1" />
              Deletion flow: Case closes → Documents enter <strong>Retention Hold</strong> →
              State timer counts down → Bot marks as <strong>Pending Review</strong> → You
              approve or reject → Approved files are <strong>permanently deleted</strong> from
              all storage providers.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
