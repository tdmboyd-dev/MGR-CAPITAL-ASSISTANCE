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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HardDrive,
  Cloud,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Trash2,
  TestTube,
  Power,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Shield,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface StorageProvider {
  id: string;
  name: string;
  displayName: string;
  type: "LOCAL" | "S3" | "PCLOUD";
  isEnabled: boolean;
  isHealthy: boolean;
  priority: number;
  usedBytes: string;
  capacityBytes: string;
  freeBytes: string;
  fileCount: number;
  lastHealthCheck: string | null;
}

interface Dashboard {
  providers: StorageProvider[];
  totalUsedBytes: string;
  totalCapacityBytes: string;
  totalFiles: number;
}

interface ProviderTemplate {
  displayName: string;
  type: string;
  config: Record<string, any>;
  capacityBytes: number;
  credentialFields: string[];
  setupGuide: string;
}

// ============================================
// HELPERS
// ============================================

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function usagePercent(used: string, capacity: string): number {
  const u = Number(used);
  const c = Number(capacity);
  if (c === 0) return 0;
  return Math.min(100, Math.round((u / c) * 100));
}

const TYPE_COLORS: Record<string, string> = {
  LOCAL: "bg-slate-600",
  S3: "bg-blue-600",
  PCLOUD: "bg-emerald-600",
};

const TYPE_ICONS: Record<string, any> = {
  LOCAL: HardDrive,
  S3: Cloud,
  PCLOUD: Database,
};

// ============================================
// MAIN PAGE
// ============================================

export default function StorageAdminPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [fileBrowserProvider, setFileBrowserProvider] = useState<string | null>(null);
  const [filePage, setFilePage] = useState(1);

  // ============================================
  // QUERIES
  // ============================================

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ["storage-dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/storage/dashboard");
      return data;
    },
  });

  const { data: templates } = useQuery<Record<string, ProviderTemplate>>({
    queryKey: ["storage-templates"],
    queryFn: async () => {
      const { data } = await api.get("/storage/templates");
      return data;
    },
  });

  const { data: files } = useQuery({
    queryKey: ["storage-files", fileBrowserProvider, filePage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: filePage.toString(), limit: "25" });
      if (fileBrowserProvider) params.append("providerId", fileBrowserProvider);
      const { data } = await api.get(`/storage/files?${params}`);
      return data;
    },
    enabled: fileBrowserProvider !== null,
  });

  // ============================================
  // MUTATIONS
  // ============================================

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/storage/providers/${id}/toggle`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
    },
    onError: () => toast.error("Failed to toggle provider"),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/storage/providers/${id}/test`);
      return data;
    },
    onSuccess: (data) => {
      if (data.healthy) {
        toast.success(`Connection OK (${data.latencyMs}ms)`);
      } else {
        toast.error(`Connection failed: ${data.error}`);
      }
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
    },
    onError: () => toast.error("Test connection failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/storage/providers/${id}`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to delete provider");
    },
  });

  const refreshHealthMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/storage/refresh-health");
      return data;
    },
    onSuccess: () => {
      toast.success("Health checks refreshed");
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
    },
    onError: () => toast.error("Health refresh failed"),
  });

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Storage Engine</h1>
          <p className="text-muted-foreground">
            Multi-provider storage management — S3, pCloud, local filesystem
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshHealthMutation.mutate()}
            disabled={refreshHealthMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshHealthMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Health
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Total Storage Summary */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Used
              </CardTitle>
              <HardDrive className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(dashboard.totalUsedBytes)}</div>
              <p className="text-sm text-muted-foreground">
                of {formatBytes(dashboard.totalCapacityBytes)} capacity
              </p>
              <div className="mt-2 w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${usagePercent(dashboard.totalUsedBytes, dashboard.totalCapacityBytes)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Providers Active
              </CardTitle>
              <Cloud className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.providers.filter((p) => p.isEnabled).length}
                <span className="text-lg text-muted-foreground font-normal">
                  {" "}/ {dashboard.providers.length}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {dashboard.providers.filter((p) => p.isHealthy && p.isEnabled).length} healthy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Files
              </CardTitle>
              <Shield className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.totalFiles.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Across all providers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <Card className="col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading providers...
            </CardContent>
          </Card>
        ) : dashboard?.providers && dashboard.providers.length > 0 ? (
          dashboard.providers.map((provider) => {
            const TypeIcon = TYPE_ICONS[provider.type] || Cloud;
            const pct = usagePercent(provider.usedBytes, provider.capacityBytes);

            return (
              <Card key={provider.id} className={!provider.isEnabled ? "opacity-60" : ""}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${TYPE_COLORS[provider.type]} text-white`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {provider.type}
                        </Badge>
                        <span className="text-xs">Priority: {provider.priority}</span>
                        {provider.isHealthy ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(provider.id)}
                      title={provider.isEnabled ? "Disable" : "Enable"}
                    >
                      <Power className={`h-4 w-4 ${provider.isEnabled ? "text-green-500" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testMutation.mutate(provider.id)}
                      title="Test Connection"
                      disabled={testMutation.isPending}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    {provider.name !== "local" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${provider.displayName}?`)) {
                            deleteMutation.mutate(provider.id);
                          }
                        }}
                        title="Delete Provider"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Usage bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{formatBytes(provider.usedBytes)} used</span>
                        <span>{formatBytes(provider.capacityBytes)} total</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{pct}% used</span>
                        <span>{provider.fileCount} files</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFileBrowserProvider(provider.id);
                          setFilePage(1);
                        }}
                      >
                        View Files
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSyncModal(true)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                        Sync
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              No storage providers configured. Click "Add Provider" to get started.
            </CardContent>
          </Card>
        )}
      </div>

      {/* File Browser */}
      {fileBrowserProvider && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                File Browser — {dashboard?.providers.find((p) => p.id === fileBrowserProvider)?.displayName}
              </CardTitle>
              <CardDescription>
                {files?.total || 0} files
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFileBrowserProvider(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {files?.files?.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">File Name</th>
                        <th className="text-left p-3 font-medium">Size</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Case</th>
                        <th className="text-left p-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.files.map((file: any) => (
                        <tr key={file.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-medium">{file.fileName}</td>
                          <td className="p-3 text-sm">{formatBytes(file.fileSize)}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {file.mimeType || "unknown"}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">{file.document?.caseId || "—"}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {files.total > 25 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {filePage} of {Math.ceil(files.total / 25)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                        disabled={filePage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilePage((p) => p + 1)}
                        disabled={filePage >= Math.ceil(files.total / 25)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No files in this provider
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Provider Modal */}
      {showAddModal && templates && (
        <AddProviderModal
          templates={templates}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
          }}
        />
      )}

      {/* Sync Modal */}
      {showSyncModal && dashboard && (
        <SyncModal
          providers={dashboard.providers}
          onClose={() => setShowSyncModal(false)}
          onSuccess={() => {
            setShowSyncModal(false);
            queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
          }}
        />
      )}
    </div>
  );
}

// ============================================
// ADD PROVIDER MODAL
// ============================================

function AddProviderModal({
  templates,
  onClose,
  onSuccess,
}: {
  templates: Record<string, ProviderTemplate>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const template = selectedTemplate ? templates[selectedTemplate] : null;

  const handleSubmit = async () => {
    if (!selectedTemplate || !template) return;

    setIsSubmitting(true);
    try {
      await api.post("/storage/providers", {
        templateKey: selectedTemplate,
        credentials,
        priority,
      });
      toast.success(`${template.displayName} added! Test connection then enable.`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to add provider");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">
            {selectedTemplate ? `Configure ${template?.displayName}` : "Add Storage Provider"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {!selectedTemplate ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Select a provider to configure:
              </p>
              {Object.entries(templates).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedTemplate(key);
                    setCredentials({});
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${TYPE_COLORS[tmpl.type]} text-white`}>
                    {tmpl.type === "PCLOUD" ? (
                      <Database className="h-5 w-5" />
                    ) : tmpl.type === "S3" ? (
                      <Cloud className="h-5 w-5" />
                    ) : (
                      <HardDrive className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{tmpl.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatBytes(String(tmpl.capacityBytes))} free tier
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : template ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                {template.setupGuide}
              </div>

              {template.credentialFields.map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1 capitalize">
                    {field.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <Input
                    type={field.toLowerCase().includes("secret") || field.toLowerCase().includes("key") || field.toLowerCase().includes("token") ? "password" : "text"}
                    placeholder={field}
                    value={credentials[field] || ""}
                    onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Priority (lower = preferred)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  10 = primary, 50 = default, 90 = cold storage, 100 = fallback only
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Provider
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SYNC MODAL
// ============================================

function SyncModal({
  providers,
  onClose,
  onSuccess,
}: {
  providers: StorageProvider[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    if (!sourceId || !targetId) return;
    setIsSyncing(true);
    setResult(null);
    try {
      const { data } = await api.post("/storage/sync", {
        sourceProviderId: sourceId,
        targetProviderId: targetId,
      });
      setResult(data);
      if (data.success) {
        toast.success(`Sync complete: ${data.migrated} files migrated`);
      } else {
        toast.error(`Sync had ${data.failed} failures`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const enabledProviders = providers.filter((p) => p.isEnabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Bulk Sync</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Migrate ALL files from one provider to another. Files are moved (not copied).
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Source Provider</label>
            <select
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select source...</option>
              {enabledProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.fileCount} files, {formatBytes(p.usedBytes)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Provider</label>
            <select
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select target...</option>
              {enabledProviders
                .filter((p) => p.id !== sourceId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({formatBytes(p.freeBytes)} free)
                  </option>
                ))}
            </select>
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
              <p>Migrated: {result.migrated} files</p>
              {result.failed > 0 && <p>Failed: {result.failed}</p>}
              {result.errors?.length > 0 && (
                <ul className="mt-1 text-xs">
                  {result.errors.slice(0, 5).map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={result ? onSuccess : onClose}>
              {result ? "Done" : "Cancel"}
            </Button>
            {!result && (
              <Button
                onClick={handleSync}
                disabled={!sourceId || !targetId || isSyncing}
                className="flex-1"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                )}
                Start Sync
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
