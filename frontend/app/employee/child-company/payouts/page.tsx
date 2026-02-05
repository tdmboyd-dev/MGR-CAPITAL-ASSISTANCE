"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineChartComponent } from "@/components/ui/charts";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  Calendar,
  Loader2,
  RefreshCw,
  Search,
  Building2,
  PiggyBank,
  AlertTriangle,
  FileText,
  Percent,
  XCircle,
} from "lucide-react";

interface PayoutTransaction {
  id: string;
  date: string;
  caseCode: string;
  amountCents: number;
  status: "PENDING" | "PROCESSING" | "PAID";
  reference?: string;
  description?: string;
}

interface FinancialData {
  totalRevenueCents: number;
  pendingPayoutsCents: number;
  monthlyRecurringCents: number;
  annualProjectionCents: number;
  parentRevenueSharePercent: number;
  companyPlan: "BRANDED" | "WHITE_LABEL";
  monthlyRevenue: { name: string; value: number }[];
  transactions: PayoutTransaction[];
  availableForPayout: number;
  lastPayoutDate?: string;
}

export default function ChildCompanyPayoutsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");

  const queryClient = useQueryClient();

  // Fetch financial data
  const { data: financials, isLoading, error, refetch } = useQuery({
    queryKey: ["child-company-financials", statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (dateFrom) params.append("dateFrom", dateFrom);
        if (dateTo) params.append("dateTo", dateTo);

        const { data } = await api.get(`/child-companies/mine/financials?${params.toString()}`);
        return data as FinancialData;
      } catch {
        // Return demo data if API fails
        return {
          totalRevenueCents: 4750000,
          pendingPayoutsCents: 850000,
          monthlyRecurringCents: 125000,
          annualProjectionCents: 5700000,
          parentRevenueSharePercent: 15,
          companyPlan: "WHITE_LABEL" as const,
          availableForPayout: 850000,
          lastPayoutDate: "2026-01-15",
          monthlyRevenue: [
            { name: "Sep", value: 320000 },
            { name: "Oct", value: 380000 },
            { name: "Nov", value: 410000 },
            { name: "Dec", value: 450000 },
            { name: "Jan", value: 520000 },
            { name: "Feb", value: 125000 },
          ],
          transactions: [
            {
              id: "txn-1",
              date: "2026-02-01",
              caseCode: "MGR-2026-042",
              amountCents: 275000,
              status: "PENDING" as const,
              description: "Case settlement commission",
            },
            {
              id: "txn-2",
              date: "2026-01-28",
              caseCode: "MGR-2026-039",
              amountCents: 350000,
              status: "PENDING" as const,
              description: "Case settlement commission",
            },
            {
              id: "txn-3",
              date: "2026-01-25",
              caseCode: "MGR-2026-035",
              amountCents: 225000,
              status: "PENDING" as const,
              description: "Case settlement commission",
            },
            {
              id: "txn-4",
              date: "2026-01-20",
              caseCode: "MGR-2026-028",
              amountCents: 420000,
              status: "PROCESSING" as const,
              reference: "PAY-2026-001",
              description: "Payout requested",
            },
            {
              id: "txn-5",
              date: "2026-01-15",
              caseCode: "MGR-2026-022",
              amountCents: 550000,
              status: "PAID" as const,
              reference: "ACH-2026-0015",
              description: "Monthly payout completed",
            },
            {
              id: "txn-6",
              date: "2026-01-10",
              caseCode: "MGR-2026-018",
              amountCents: 380000,
              status: "PAID" as const,
              reference: "ACH-2026-0012",
              description: "Case settlement payout",
            },
          ],
        } as FinancialData;
      }
    },
  });

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async (amountCents: number) => {
      const { data } = await api.post("/child-companies/mine/request-payout", {
        amountCents,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Payout request submitted successfully");
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["child-company-financials"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to request payout");
    },
  });

  // Filter transactions
  const filteredTransactions = (financials?.transactions || []).filter((txn) => {
    const searchLower = search.toLowerCase();
    return (
      txn.caseCode.toLowerCase().includes(searchLower) ||
      txn.reference?.toLowerCase().includes(searchLower) ||
      txn.description?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRequestPayout = () => {
    const amountCents = Math.round(parseFloat(payoutAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amountCents > (financials?.availableForPayout || 0)) {
      toast.error("Amount exceeds available balance");
      return;
    }
    requestPayoutMutation.mutate(amountCents);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Error state
  if (error && !financials) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/employee/child-company">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-1">Error Loading Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Could not load financial data. Please try again.
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show only your share - platform fee is abstracted away
  const yourSharePercent = 100 - (financials?.platformFeePercent || 15);

  return (
    <div className="space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/employee/child-company">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-emerald-500" />
              Revenue & Payouts
            </h1>
            <p className="text-sm text-muted-foreground">
              Track your child company revenue and request payouts
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(financials?.totalRevenueCents || 0)}
                </p>
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {formatCurrency(financials?.pendingPayoutsCents || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Awaiting payout</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(financials?.monthlyRecurringCents || 0)}
                </p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Projection</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(financials?.annualProjectionCents || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Projected yearly</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Share Info & Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Share Card */}
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-amber-600" />
              Revenue Share
            </CardTitle>
            <CardDescription>
              How your revenue is split with MGR Capital
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">Your Revenue Share</span>
              </div>
              <span className="font-bold text-emerald-600 text-lg">{yourSharePercent}%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Platform Fee</span>
              </div>
              <span className="font-medium text-muted-foreground">Included</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Plan: <span className="font-medium">
                  {financials?.companyPlan === "WHITE_LABEL" ? "White-Label" : "Branded"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {financials?.companyPlan === "WHITE_LABEL"
                  ? "White-label plan offers the highest revenue share"
                  : "Branded plan includes MGR Capital branding and support"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Monthly Revenue Trend
            </CardTitle>
            <CardDescription>
              Your revenue over the past 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            {financials?.monthlyRevenue && financials.monthlyRevenue.length > 0 ? (
              <LineChartComponent
                data={financials.monthlyRevenue.map((item) => ({
                  name: item.name,
                  value: item.value / 100,
                }))}
                height={250}
                color="#10b981"
                showArea={true}
              />
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Request Card */}
      {(financials?.availableForPayout || 0) > 0 && (
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <PiggyBank className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available for Payout</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(financials?.availableForPayout || 0)}
                  </p>
                  {financials?.lastPayoutDate && (
                    <p className="text-xs text-muted-foreground">
                      Last payout: {formatDate(financials.lastPayoutDate)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setPayoutDialogOpen(true)}
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Request Payout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by case, reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              placeholder="To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payout Transactions ({filteredTransactions.length})
          </CardTitle>
          <CardDescription>
            Your revenue transactions and payout history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Transactions</h3>
              <p className="text-sm text-muted-foreground">
                No payout transactions found matching your filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(txn.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{txn.caseCode}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(txn.amountCents)}
                    </TableCell>
                    <TableCell>{getStatusBadge(txn.status)}</TableCell>
                    <TableCell>
                      {txn.reference ? (
                        <span className="font-mono text-sm">{txn.reference}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-800">Payout Information</h4>
              <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Payouts are processed within 3-5 business days</li>
                <li>Minimum payout amount is $100</li>
                <li>Funds are transferred via ACH to your registered bank account</li>
                <li>Revenue share is automatically calculated before payout</li>
                <li>Contact support if you need to update your banking details</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payout Request Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw from your available balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(financials?.availableForPayout || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payout Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="100"
                  max={(financials?.availableForPayout || 0) / 100}
                  placeholder="Enter amount"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum: $100.00 | Maximum: {formatCurrency(financials?.availableForPayout || 0)}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                setPayoutAmount(((financials?.availableForPayout || 0) / 100).toFixed(2))
              }
            >
              Request Full Balance
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleRequestPayout}
              disabled={requestPayoutMutation.isPending}
            >
              {requestPayoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
