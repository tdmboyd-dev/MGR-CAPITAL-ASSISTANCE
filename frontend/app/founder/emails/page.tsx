"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Search,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statusColors: Record<string, string> = {
  SENT: "text-green-600 bg-green-50 dark:bg-green-900/20",
  DELIVERED: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  PENDING: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  FAILED: "text-red-600 bg-red-50 dark:bg-red-900/20",
  BOUNCED: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
};

export default function FounderEmailsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["email-status"],
    queryFn: async () => {
      const { data } = await api.get("/api/emails/status");
      return data.data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      const { data } = await api.get("/api/emails/stats?days=30");
      return data.data;
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["email-history", page, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const { data } = await api.get(`/api/emails/history?${params}`);
      return data;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/api/emails/${id}/retry`);
      return data;
    },
    onSuccess: () => {
      toast.success("Email retried successfully");
      queryClient.invalidateQueries({ queryKey: ["email-history"] });
      queryClient.invalidateQueries({ queryKey: ["email-stats"] });
    },
    onError: () => {
      toast.error("Failed to retry email");
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/emails/retry-all-failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Retried all failed emails");
      queryClient.invalidateQueries({ queryKey: ["email-history"] });
      queryClient.invalidateQueries({ queryKey: ["email-stats"] });
    },
    onError: () => {
      toast.error("Failed to retry emails");
    },
  });

  const sentCount = statsData?.byStatus?.find((s: any) => s.status === "SENT")?.count || 0;
  const failedCount = statsData?.byStatus?.find((s: any) => s.status === "FAILED")?.count || 0;
  const pendingCount = statsData?.byStatus?.find((s: any) => s.status === "PENDING")?.count || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor delivery, retry failed emails, view system status
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => retryAllMutation.mutate()}
          disabled={retryAllMutation.isPending}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Retry All Failed
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent (30d)</p>
                <p className="text-2xl font-bold">{sentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed (30d)</p>
                <p className="text-2xl font-bold">{failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total (30d)</p>
                <p className="text-2xl font-bold">{statsData?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMTP Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Provider</p>
                <p className="font-medium uppercase">{statusData?.smtp?.provider || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Brevo</p>
                <p className={`font-medium ${statusData?.smtp?.brevo ? "text-green-600" : "text-red-600"}`}>
                  {statusData?.smtp?.brevo ? "Connected" : "Not Configured"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">SMTP</p>
                <p className={`font-medium ${statusData?.smtp?.smtpVerified ? "text-green-600" : "text-yellow-600"}`}>
                  {statusData?.smtp?.smtpVerified ? "Verified" : statusData?.smtp?.smtp ? "Configured" : "Not Set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last 24h</p>
                <p className="font-medium">
                  {statusData?.last24Hours?.sent || 0} sent, {statusData?.last24Hours?.failed || 0} failed
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Email History</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="DELIVERED">Delivered</option>
                <option value="BOUNCED">Bounced</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">To</th>
                      <th className="py-3 pr-4">Subject</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData?.data?.map((log: any) => (
                      <tr key={log.id} className="border-b">
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              statusColors[log.status] || ""
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate">
                          {log.toName ? `${log.toName} <${log.toAddress}>` : log.toAddress}
                        </td>
                        <td className="py-3 pr-4 max-w-[250px] truncate">
                          {log.subject || "No Subject"}
                        </td>
                        <td className="py-3 pr-4">{log.type}</td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString()}{" "}
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3">
                          {log.status === "FAILED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryMutation.mutate(log.id)}
                              disabled={retryMutation.isPending}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!historyData?.data || historyData.data.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No email logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {historyData?.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {historyData.page} of {historyData.totalPages} ({historyData.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= historyData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
