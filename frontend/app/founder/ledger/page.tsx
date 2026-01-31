"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Search,
  RefreshCw,
  BookOpen,
} from "lucide-react";

interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  amountCents: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  PROCESSING: "bg-blue-100 text-blue-700",
};

const TYPE_COLORS: Record<string, string> = {
  REVENUE: "bg-green-100 text-green-700",
  PAYOUT: "bg-orange-100 text-orange-700",
  FEE: "bg-blue-100 text-blue-700",
  REFUND: "bg-red-100 text-red-700",
  COMMISSION: "bg-purple-100 text-purple-700",
};

export default function FounderLedgerPage() {
  const [search, setSearch] = useState("");

  const { data: ledgerData, isLoading, refetch } = useQuery<LedgerEntry[]>({
    queryKey: ["founder-ledger"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/payouts/ledger");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
  });

  const entries = ledgerData || [];

  const filteredEntries = entries.filter((entry) => {
    const term = search.toLowerCase();
    return (
      entry.description?.toLowerCase().includes(term) ||
      entry.type?.toLowerCase().includes(term) ||
      entry.status?.toLowerCase().includes(term)
    );
  });

  const stats = {
    totalRevenue: entries
      .filter((e) => e.type === "REVENUE" && e.status !== "FAILED")
      .reduce((sum, e) => sum + (e.amountCents || 0), 0),
    totalPayouts: entries
      .filter((e) => (e.type === "PAYOUT" || e.type === "COMMISSION") && e.status !== "FAILED")
      .reduce((sum, e) => sum + Math.abs(e.amountCents || 0), 0),
    pendingPayouts: entries
      .filter((e) => e.status === "PENDING")
      .reduce((sum, e) => sum + Math.abs(e.amountCents || 0), 0),
  };
  const netProfit = stats.totalRevenue - stats.totalPayouts;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Ledger
          </h1>
          <p className="text-muted-foreground">
            Full financial ledger of all transactions
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <TrendingDown className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payouts</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatCurrency(stats.totalPayouts)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  {formatCurrency(netProfit)}
                </p>
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
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {formatCurrency(stats.pendingPayouts)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ledger entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries ({filteredEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No ledger entries yet. Transactions will appear here as cases are processed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3 text-muted-foreground">
                        {formatDate(entry.date)}
                      </td>
                      <td className="p-3">
                        <Badge className={TYPE_COLORS[entry.type] || "bg-gray-100 text-gray-700"}>
                          {entry.type}
                        </Badge>
                      </td>
                      <td className="p-3">{entry.description}</td>
                      <td className="p-3 text-right font-medium">
                        <span
                          className={
                            entry.type === "REVENUE" || entry.type === "FEE"
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {entry.type === "REVENUE" || entry.type === "FEE" ? "+" : "-"}
                          {formatCurrency(Math.abs(entry.amountCents))}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[entry.status] || "bg-gray-100 text-gray-700"}>
                          {entry.status}
                        </Badge>
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
