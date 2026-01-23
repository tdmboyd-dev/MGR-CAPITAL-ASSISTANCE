"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
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
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-500",
  CONTACTED: "bg-blue-500",
  DOCS_PENDING: "bg-yellow-500",
  DOCS_SIGNED: "bg-green-500",
  FILED: "bg-purple-500",
  AWAITING_FUNDS: "bg-orange-500",
  PAID: "bg-emerald-500",
  CLOSED: "bg-gray-700",
  REJECTED: "bg-red-500",
};

export default function FounderCasesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cases", page, search, statusFilter, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (stateFilter) params.append("state", stateFilter);

      const { data } = await api.get(`/cases?${params}`);
      return data;
    },
  });

  const statuses = [
    "NEW",
    "CONTACTED",
    "DOCS_PENDING",
    "DOCS_SIGNED",
    "FILED",
    "AWAITING_FUNDS",
    "PAID",
    "CLOSED",
    "REJECTED",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Cases</h1>
          <p className="text-muted-foreground">
            Manage and monitor all cases in the system
          </p>
        </div>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-md border bg-background min-w-[150px]"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Input
              placeholder="Filter by state..."
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cases ({data?.total || 0})</CardTitle>
          <CardDescription>
            Page {page} of {data?.totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={10} />
          ) : data?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Case Code</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Property</th>
                    <th className="text-left p-3 font-medium">Location</th>
                    <th className="text-left p-3 font-medium">Client</th>
                    <th className="text-left p-3 font-medium">Assigned To</th>
                    <th className="text-left p-3 font-medium">Value</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((caseItem: any) => (
                    <tr
                      key={caseItem.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">
                        <Link
                          href={`/founder/cases/${caseItem.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {caseItem.internalCode}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`${STATUS_COLORS[caseItem.status] || "bg-gray-500"} text-white`}
                        >
                          {caseItem.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {caseItem.propertyAddress || "-"}
                      </td>
                      <td className="p-3">
                        {caseItem.county}, {caseItem.state}
                      </td>
                      <td className="p-3">{caseItem.client?.name || "-"}</td>
                      <td className="p-3">
                        {caseItem.assignedEmployee?.name || "-"}
                      </td>
                      <td className="p-3">
                        {caseItem.estimatedValueCents
                          ? formatCurrency(caseItem.estimatedValueCents)
                          : "-"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(caseItem.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cases found
            </div>
          )}

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to{" "}
                {Math.min(page * 20, data.total)} of {data.total} cases
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
