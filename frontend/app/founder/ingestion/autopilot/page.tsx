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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  Zap,
  Activity,
  ArrowLeft,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Users,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface AutopilotStatus {
  activeSources: number;
  totalSources: number;
  casesCreatedToday: number;
  successRate: number;
  nextFetch: string | null;
  nextFetchSource: string | null;
  runsToday: number;
  successToday: number;
  failedToday: number;
}

interface AutopilotRun {
  id: string;
  sourceId: string | null;
  batchId: string | null;
  runType: string;
  sourcesFetched: number;
  recordsParsed: number;
  casesCreated: number;
  casesRouted: number;
  errors: any;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: string;
  source?: { name: string; type: string; state: string } | null;
}

const RUN_TYPE_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  manual: "bg-purple-100 text-purple-700",
  webhook: "bg-cyan-100 text-cyan-700",
  email: "bg-yellow-100 text-yellow-700",
  bulk_upload: "bg-pink-100 text-pink-700",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  running: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

export default function AutopilotDashboardPage() {
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading } = useQuery<AutopilotStatus>({
    queryKey: ["autopilot-status"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ingestion/autopilot/status");
        return data?.data || data;
      } catch {
        return {
          activeSources: 0,
          totalSources: 0,
          casesCreatedToday: 0,
          successRate: 100,
          nextFetch: null,
          nextFetchSource: null,
          runsToday: 0,
          successToday: 0,
          failedToday: 0,
        };
      }
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<AutopilotRun[]>({
    queryKey: ["autopilot-history"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ingestion/autopilot/history?limit=20");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const triggerRun = useMutation({
    mutationFn: async () => {
      await api.post("/ingestion/autopilot/trigger");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autopilot-status"] });
      queryClient.invalidateQueries({ queryKey: ["autopilot-history"] });
    },
  });

  const status = statusData || {
    activeSources: 0, totalSources: 0, casesCreatedToday: 0,
    successRate: 100, nextFetch: null, nextFetchSource: null,
    runsToday: 0, successToday: 0, failedToday: 0,
  };
  const history = historyData || [];

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["autopilot-status"] });
    queryClient.invalidateQueries({ queryKey: ["autopilot-history"] });
  };

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
              <Zap className="w-8 h-8 text-yellow-500" />
              Autopilot Dashboard
            </h1>
          </div>
          <p className="text-muted-foreground">
            Real-time view of the automatic ingestion pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => triggerRun.mutate()}
            disabled={triggerRun.isPending}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Play className="w-4 h-4 mr-2" />
            {triggerRun.isPending ? "Running..." : "Trigger Manual Run"}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sources</p>
                <p className="text-2xl font-bold">
                  {status.activeSources}
                  <span className="text-sm text-muted-foreground font-normal ml-1">/ {status.totalSources}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Database className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cases Today</p>
                <p className="text-2xl font-bold">{status.casesCreatedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{status.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Fetch</p>
                <p className="text-sm font-bold">
                  {status.nextFetch ? formatDate(status.nextFetch) : "No scheduled"}
                </p>
                {status.nextFetchSource && (
                  <p className="text-xs text-muted-foreground">{status.nextFetchSource}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700">{status.successToday}</p>
            <p className="text-sm text-muted-foreground">Successful Runs Today</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-700">{status.failedToday}</p>
            <p className="text-sm text-muted-foreground">Failed Runs Today</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">{status.runsToday}</p>
            <p className="text-sm text-muted-foreground">Total Runs Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Autopilot Activity</CardTitle>
          <CardDescription>Last 20 autopilot runs across all sources</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No autopilot runs yet. Enable the scheduler and add sources to begin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Records</th>
                    <th className="text-right p-3 font-medium">Cases</th>
                    <th className="text-right p-3 font-medium">Routed</th>
                    <th className="text-right p-3 font-medium">Duration</th>
                    <th className="text-left p-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run) => (
                    <tr key={run.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">
                        {run.source?.name || "Manual"}
                      </td>
                      <td className="p-3">
                        <Badge className={RUN_TYPE_COLORS[run.runType] || "bg-gray-100 text-gray-700"}>
                          {run.runType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[run.status] || "bg-gray-100 text-gray-700"}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{run.recordsParsed}</td>
                      <td className="p-3 text-right font-medium">{run.casesCreated}</td>
                      <td className="p-3 text-right">{run.casesRouted}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-sm">
                        {formatDate(run.startedAt)}
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
