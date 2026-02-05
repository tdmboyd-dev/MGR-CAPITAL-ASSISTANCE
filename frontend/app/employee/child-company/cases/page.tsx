"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Plus,
  MapPin,
  DollarSign,
  AlertCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  DOCS_PENDING: "bg-yellow-500",
  FILED: "bg-purple-500",
  PAID: "bg-emerald-500",
  CLOSED: "bg-gray-700",
};

const statuses = [
  "NEW",
  "IN_PROGRESS",
  "DOCS_PENDING",
  "FILED",
  "PAID",
  "CLOSED",
];

interface Case {
  id: string;
  internalCode: string;
  propertyAddress: string;
  county: string;
  state: string;
  status: string;
  estimatedValueCents: number; // Show estimated value, NOT surplus (founder-only)
  assignedAt: string;
  createdAt: string;
  client?: {
    id: string;
    name: string;
    email: string;
  };
}

interface CasesResponse {
  data: Case[];
  total: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  availableSlots: number;
  maxSlots: number;
}

export default function ChildCompanyCasesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["child-company-cases", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const { data } = await api.get(`/child-companies/mine/cases?${params}`);
      return data as CasesResponse;
    },
  });

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/employee/child-company"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Child Company
        </Link>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-1">Failed to Load Cases</h3>
            <p className="text-sm text-muted-foreground mb-4">
              There was an error loading your cases. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cases = data?.data || [];
  const totalCases = data?.total || 0;
  const statusCounts = data?.statusCounts || {};
  const availableSlots = data?.availableSlots ?? 0;
  const maxSlots = data?.maxSlots ?? 0;
  const hasAvailableSlots = availableSlots > 0;

  // Calculate status counts from data if not provided by API
  const newCases = statusCounts.NEW ?? cases.filter((c) => c.status === "NEW").length;
  const inProgressCases = statusCounts.IN_PROGRESS ?? cases.filter((c) => c.status === "IN_PROGRESS").length;
  const docsPendingCases = statusCounts.DOCS_PENDING ?? cases.filter((c) => c.status === "DOCS_PENDING").length;
  const filedCases = statusCounts.FILED ?? cases.filter((c) => c.status === "FILED").length;
  const paidCases = statusCounts.PAID ?? cases.filter((c) => c.status === "PAID").length;
  const closedCases = statusCounts.CLOSED ?? cases.filter((c) => c.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      <Link
        href="/employee/child-company"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Child Company
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Cases</h1>
          <p className="text-muted-foreground">
            Manage cases assigned to your child company
          </p>
        </div>
        {hasAvailableSlots && (
          <Link href="/employee/child-company/cases/assign">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign New Case
            </Button>
          </Link>
        )}
      </div>

      {/* Status Count Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "NEW" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "NEW" ? "" : "NEW");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New
            </CardTitle>
            <div className={`h-3 w-3 rounded-full ${STATUS_COLORS.NEW}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newCases}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "IN_PROGRESS" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "IN_PROGRESS" ? "" : "IN_PROGRESS");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCases}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "DOCS_PENDING" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "DOCS_PENDING" ? "" : "DOCS_PENDING");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Docs Pending
            </CardTitle>
            <FileText className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{docsPendingCases}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "FILED" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "FILED" ? "" : "FILED");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Filed
            </CardTitle>
            <Briefcase className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filedCases}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "PAID" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "PAID" ? "" : "PAID");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCases}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${statusFilter === "CLOSED" ? "ring-2 ring-primary" : ""}`}
          onClick={() => {
            setStatusFilter(statusFilter === "CLOSED" ? "" : "CLOSED");
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closed
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closedCases}</div>
          </CardContent>
        </Card>
      </div>

      {/* Case Slots Info */}
      {maxSlots > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Case Slots</p>
                <p className="text-xs text-muted-foreground">
                  {availableSlots} of {maxSlots} slots available
                </p>
              </div>
              <div className="w-32">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${((maxSlots - availableSlots) / maxSlots) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by address, client name, or case ID..."
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
            {statusFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                Clear Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cases ({totalCases})</CardTitle>
          <CardDescription>
            Page {page} of {data?.totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : cases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Case ID</th>
                    <th className="text-left p-3 font-medium">Property Address</th>
                    <th className="text-left p-3 font-medium">Client Name</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Est. Value</th>
                    <th className="text-left p-3 font-medium">Assigned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/employee/cases/${caseItem.id}`)}
                    >
                      <td className="p-3">
                        <Link
                          href={`/employee/cases/${caseItem.id}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {caseItem.internalCode || caseItem.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {caseItem.propertyAddress || `${caseItem.county}, ${caseItem.state}`}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {caseItem.client?.name || "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`${STATUS_COLORS[caseItem.status] || "bg-gray-500"} text-white`}
                        >
                          {caseItem.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {caseItem.estimatedValueCents ? (
                          <span className="font-medium text-green-600">
                            {formatCurrency(caseItem.estimatedValueCents)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {caseItem.assignedAt
                          ? formatDate(caseItem.assignedAt)
                          : formatDate(caseItem.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Cases Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statusFilter
                  ? `No cases with status "${statusFilter.replace(/_/g, " ")}"`
                  : search
                  ? "No cases match your search"
                  : "Your child company has no assigned cases yet."}
              </p>
              {hasAvailableSlots && !statusFilter && !search && (
                <Link href="/employee/child-company/cases/assign">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Your First Case
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {data?.totalPages && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to{" "}
                {Math.min(page * 20, totalCases)} of {totalCases} cases
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
                  onClick={() =>
                    setPage((p) => Math.min(data.totalPages, p + 1))
                  }
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
