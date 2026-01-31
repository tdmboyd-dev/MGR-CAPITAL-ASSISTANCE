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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pencil,
  X,
  Check,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface IngestionSource {
  id: string;
  name: string;
  type: string;
  state: string;
  county: string | null;
  url: string | null;
  frequency: string | null;
  lastFetched: string | null;
  nextFetch: string | null;
  isActive: boolean;
  consecutiveErrors: number;
  totalFetches: number;
  totalCasesCreated: number;
  lastError: string | null;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  TAX_SALE_LIST: "bg-blue-100 text-blue-700",
  SURPLUS_PDF: "bg-purple-100 text-purple-700",
  AUCTION_RESULT: "bg-orange-100 text-orange-700",
  COUNTY_WEBSITE: "bg-green-100 text-green-700",
  MANUAL_ENTRY: "bg-gray-100 text-gray-700",
  WEBHOOK: "bg-cyan-100 text-cyan-700",
  EMAIL_INBOX: "bg-yellow-100 text-yellow-700",
  BULK_UPLOAD: "bg-pink-100 text-pink-700",
};

const FREQUENCY_OPTIONS = [
  { value: "every_30_min", label: "Every 30 min" },
  { value: "hourly", label: "Hourly" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const TYPE_OPTIONS = [
  "TAX_SALE_LIST",
  "SURPLUS_PDF",
  "AUCTION_RESULT",
  "COUNTY_WEBSITE",
  "MANUAL_ENTRY",
  "WEBHOOK",
  "EMAIL_INBOX",
  "BULK_UPLOAD",
];

export default function SourceManagerPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterActive, setFilterActive] = useState<string>("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    url: "",
    type: "TAX_SALE_LIST",
    state: "",
    county: "",
    frequency: "daily",
    parserConfig: "",
  });

  const { data: sourcesData, isLoading } = useQuery<IngestionSource[]>({
    queryKey: ["ingestion-sources"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ingestion/sources");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
  });

  const sources = (sourcesData || []).filter((s) => {
    if (filterState && !s.state.toLowerCase().includes(filterState.toLowerCase())) return false;
    if (filterType && s.type !== filterType) return false;
    if (filterActive === "active" && !s.isActive) return false;
    if (filterActive === "inactive" && s.isActive) return false;
    return true;
  });

  const createSource = useMutation({
    mutationFn: async () => {
      let parserConfig = undefined;
      if (form.parserConfig) {
        try { parserConfig = JSON.parse(form.parserConfig); } catch { /* ignore */ }
      }
      await api.post("/ingestion/sources", {
        name: form.name,
        type: form.type,
        state: form.state,
        county: form.county || undefined,
        url: form.url || undefined,
        frequency: form.frequency,
        parserConfig,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] });
      setShowAdd(false);
      setForm({ name: "", url: "", type: "TAX_SALE_LIST", state: "", county: "", frequency: "daily", parserConfig: "" });
    },
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      await api.put(`/ingestion/sources/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] });
      setEditingId(null);
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingestion/sources/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] }),
  });

  const fetchNow = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/ingestion/sources/${id}/fetch-now`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] }),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/founder/ingestion" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="w-8 h-8 text-blue-600" />
              Ingestion Sources
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage data sources that feed the autopilot pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Filter by state..."
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="w-40"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Add Source Dialog */}
      {showAdd && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Add New Source</CardTitle>
            <CardDescription>Create a new data ingestion source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Source name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border rounded-md px-3 py-2 text-sm">
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
              <Input placeholder="State (e.g., TN) *" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input placeholder="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="border rounded-md px-3 py-2 text-sm">
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <Input placeholder='Parser config JSON (optional)' value={form.parserConfig} onChange={(e) => setForm({ ...form, parserConfig: e.target.value })} className="md:col-span-2" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => createSource.mutate()} disabled={!form.name || !form.state || createSource.isPending}>
                <Check className="w-4 h-4 mr-2" />
                {createSource.isPending ? "Creating..." : "Create Source"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No sources found. Add a source to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">State</th>
                    <th className="text-left p-3 font-medium">Frequency</th>
                    <th className="text-left p-3 font-medium">Last Fetch</th>
                    <th className="text-left p-3 font-medium">Next Fetch</th>
                    <th className="text-right p-3 font-medium">Fetches</th>
                    <th className="text-right p-3 font-medium">Cases</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{source.name}</div>
                        {source.url && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{source.url}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={TYPE_COLORS[source.type] || "bg-gray-100 text-gray-700"}>
                          {source.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {source.state}
                        {source.county && <span className="text-muted-foreground text-xs ml-1">/ {source.county}</span>}
                      </td>
                      <td className="p-3 text-sm">{source.frequency || "—"}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {source.lastFetched ? formatDate(source.lastFetched) : "Never"}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {source.nextFetch ? formatDate(source.nextFetch) : "—"}
                      </td>
                      <td className="p-3 text-right">{source.totalFetches}</td>
                      <td className="p-3 text-right">{source.totalCasesCreated}</td>
                      <td className="p-3">
                        {source.isActive ? (
                          source.consecutiveErrors > 0 ? (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              Errors: {source.consecutiveErrors}
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          )
                        ) : (
                          <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Fetch Now"
                            onClick={() => fetchNow.mutate(source.id)}
                            disabled={!source.isActive || fetchNow.isPending}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={source.isActive ? "Deactivate" : "Activate"}
                            onClick={() => updateSource.mutate({ id: source.id, data: { isActive: !source.isActive } })}
                          >
                            {source.isActive ? <X className="w-4 h-4 text-red-500" /> : <Check className="w-4 h-4 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            onClick={() => { if (confirm("Deactivate this source?")) deleteSource.mutate(source.id); }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
