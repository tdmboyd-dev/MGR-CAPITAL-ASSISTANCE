"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Activity,
  PieChart,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500",
  PENDING: "bg-yellow-500",
  SUSPENDED: "bg-red-500",
  INACTIVE: "bg-gray-500",
};

// Shadow revenue breakdown example for a $10,000 case
const SHADOW_TIERS = [
  { tier: "First $100K cumulative", rate: 0.10, label: "10%" },
  { tier: "$100K - $500K cumulative", rate: 0.08, label: "8%" },
  { tier: "$500K - $1M cumulative", rate: 0.06, label: "6%" },
  { tier: "$1M - $5M cumulative", rate: 0.04, label: "4%" },
  { tier: "$5M+ cumulative", rate: 0.02, label: "2%" },
];

function computeBreakdown(caseValue: number, cumulativeRevenue: number) {
  const tiers = [
    { min: 0, max: 100000, rate: 0.10 },
    { min: 100000, max: 500000, rate: 0.08 },
    { min: 500000, max: 1000000, rate: 0.06 },
    { min: 1000000, max: 5000000, rate: 0.04 },
    { min: 5000000, max: Infinity, rate: 0.02 },
  ];

  let remaining = caseValue;
  let cursor = cumulativeRevenue;
  const rows: { tier: string; amount: number; rate: number; founderCut: number }[] = [];

  for (const t of tiers) {
    if (remaining <= 0) break;
    if (cursor >= t.max) continue;

    const start = Math.max(cursor, t.min);
    const end = Math.min(start + remaining, t.max);
    const amount = end - start;

    rows.push({
      tier: `$${(t.min / 1000).toFixed(0)}K - ${t.max === Infinity ? "above" : `$${(t.max / 1000).toFixed(0)}K`}`,
      amount,
      rate: t.rate,
      founderCut: amount * t.rate,
    });

    remaining -= amount;
    cursor = end;
  }

  return rows;
}

export default function FounderChildCompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["child-company-stats"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/stats");
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["child-companies", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (search) params.append("search", search);
      const { data } = await api.get(`/child-companies?${params}`);
      return data;
    },
  });

  const statCards = [
    {
      title: "Total Companies",
      value: stats?.data?.totalCompanies || stats?.totalCompanies || 0,
      icon: Building2,
      color: "text-blue-500",
    },
    {
      title: "Active Companies",
      value: stats?.data?.activeCompanies || stats?.activeCompanies || 0,
      icon: Activity,
      color: "text-green-500",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(
        stats?.data?.totalRevenueCents || stats?.totalRevenueCents || 0
      ),
      icon: DollarSign,
      color: "text-emerald-500",
    },
    {
      title: "Founder Take",
      value: formatCurrency(
        stats?.data?.founderTakeCents || stats?.founderTakeCents || 0
      ),
      icon: TrendingUp,
      color: "text-purple-500",
    },
  ];

  const exampleBreakdown = computeBreakdown(1000000, 0); // $10,000 case at $0 cumulative

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="h-8 w-8" />
          Child Companies
        </h1>
        <p className="text-muted-foreground">
          Manage and monitor all child companies in the network
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Companies ({data?.total || data?.data?.length || 0})</CardTitle>
          <CardDescription>
            Page {page} of {data?.totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (data?.data?.length || 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Company Name</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Plan</th>
                    <th className="text-left p-3 font-medium">Employees</th>
                    <th className="text-left p-3 font-medium">Revenue</th>
                    <th className="text-left p-3 font-medium">Founder Cut</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((company: any) => (
                    <tr
                      key={company.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-xs text-muted-foreground">
                            /{company.slug}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        {company.owner?.name || company.ownerName || "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`${
                            STATUS_COLORS[company.status] || "bg-gray-500"
                          } text-white`}
                        >
                          {company.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            company.plan === "WHITE_LABEL"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          }`}
                        >
                          {company.plan === "WHITE_LABEL"
                            ? "White-Label"
                            : "Branded"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {company.employeeCount || 0}
                        </div>
                      </td>
                      <td className="p-3">
                        {formatCurrency(company.totalRevenueCents || 0)}
                      </td>
                      <td className="p-3 font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(company.founderCutCents || 0)}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCompany(company)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No child companies found
            </div>
          )}

          {/* Pagination */}
          {(data?.totalPages || 0) > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to{" "}
                {Math.min(page * 20, data.total)} of {data.total} companies
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
                  disabled={page === data?.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shadow Revenue Breakdown Example */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-500" />
            Shadow Revenue Breakdown
          </CardTitle>
          <CardDescription>
            Example: How a $10,000 case splits across tiered founder cut (starting
            at $0 cumulative revenue)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Tier</th>
                  <th className="text-left p-3 font-medium">Rate</th>
                  <th className="text-left p-3 font-medium">Applicable Amount</th>
                  <th className="text-left p-3 font-medium">Founder Cut</th>
                </tr>
              </thead>
              <tbody>
                {exampleBreakdown.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-sm">{row.tier}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        {(row.rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3">{formatCurrency(row.amount)}</td>
                    <td className="p-3 font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(row.founderCut)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="p-3" colSpan={2}>
                    Total
                  </td>
                  <td className="p-3">
                    {formatCurrency(
                      exampleBreakdown.reduce((s, r) => s + r.amount, 0)
                    )}
                  </td>
                  <td className="p-3 text-green-600 dark:text-green-400">
                    {formatCurrency(
                      exampleBreakdown.reduce((s, r) => s + r.founderCut, 0)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">
              <strong>How it works:</strong> The founder cut decreases as a child
              company generates more cumulative revenue. Starting at 10% for the
              first $100K, dropping to 2% once cumulative revenue exceeds $5M.
              This incentivizes growth while ensuring fair revenue sharing.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            {SHADOW_TIERS.map((tier, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted text-center">
                <p className="text-lg font-bold text-primary">{tier.label}</p>
                <p className="text-xs text-muted-foreground">{tier.tier}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {selectedCompany.name}
                  </CardTitle>
                  <CardDescription>
                    /{selectedCompany.slug} -- Owned by{" "}
                    {selectedCompany.owner?.name ||
                      selectedCompany.ownerName ||
                      "Unknown"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompany(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge
                      className={`${
                        STATUS_COLORS[selectedCompany.status] || "bg-gray-500"
                      } text-white mt-1`}
                    >
                      {selectedCompany.status}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium mt-1">
                      {selectedCompany.plan === "WHITE_LABEL"
                        ? "White-Label"
                        : "Branded"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Employees</p>
                    <p className="font-medium mt-1">
                      {selectedCompany.employeeCount || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium mt-1">
                      {selectedCompany.createdAt
                        ? formatDate(selectedCompany.createdAt)
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="font-medium mb-3">Revenue Breakdown</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-sm text-muted-foreground">
                        Total Revenue
                      </p>
                      <p className="text-lg font-bold">
                        {formatCurrency(
                          selectedCompany.totalRevenueCents || 0
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-sm text-muted-foreground">
                        Founder Cut
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(
                          selectedCompany.founderCutCents || 0
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-sm text-muted-foreground">
                        Company Keep
                      </p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(
                          (selectedCompany.totalRevenueCents || 0) -
                            (selectedCompany.founderCutCents || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shadow breakdown for this company's example */}
                <div className="border-t pt-4">
                  <p className="font-medium mb-3">
                    Shadow Breakdown for $10,000 Case at Current Revenue
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Tier</th>
                          <th className="text-left p-2">Rate</th>
                          <th className="text-left p-2">Amount</th>
                          <th className="text-left p-2">Founder Cut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computeBreakdown(
                          1000000,
                          selectedCompany.totalRevenueCents || 0
                        ).map((row, i) => (
                          <tr
                            key={i}
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-2">{row.tier}</td>
                            <td className="p-2">{(row.rate * 100).toFixed(0)}%</td>
                            <td className="p-2">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="p-2 text-green-600 dark:text-green-400">
                              {formatCurrency(row.founderCut)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
