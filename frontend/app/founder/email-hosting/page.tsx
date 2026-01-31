"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail,
  Users,
  CheckCircle,
  Gift,
  DollarSign,
  Globe,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Loader2,
  XCircle,
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
import { Badge } from "@/components/ui/badge";

interface BillingSummary {
  totalAccounts: number;
  activeAccounts: number;
  founderPoolFree: number;
  monthlyRevenueCents: number;
}

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  accountCount: number;
  createdAt: string;
}

interface Account {
  id: string;
  email: string;
  domain: string;
  status: string;
  userId?: string;
  userName?: string;
  storageUsedMB: number;
  storageLimitMB: number;
  billingAmountCents: number;
  isFounderPool: boolean;
  createdAt: string;
}

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  ACTIVE: "success",
  PROVISIONING: "info",
  SUSPENDED: "warning",
  PENDING_DELETION: "destructive",
  DELETED: "destructive",
};

export default function FounderEmailHostingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [founderEmail, setFounderEmail] = useState("");
  const [founderDomain, setFounderDomain] = useState("");

  // Billing summary
  const { data: billing } = useQuery({
    queryKey: ["email-billing-summary"],
    queryFn: async () => {
      const { data } = await api.get("/email-hosting/billing-summary");
      return data.data as BillingSummary;
    },
  });

  // Domains
  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["email-domains"],
    queryFn: async () => {
      const { data } = await api.get("/email-hosting/domains");
      return data.data as Domain[];
    },
  });

  // All accounts (paginated)
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["email-all-accounts", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search) params.set("search", search);
      const { data } = await api.get(
        `/email-hosting/all-accounts?${params}`
      );
      return data;
    },
  });

  // Create founder pool account
  const founderPoolMutation = useMutation({
    mutationFn: async ({
      localPart,
      domain,
    }: {
      localPart: string;
      domain: string;
    }) => {
      const { data } = await api.post("/email-hosting/founder-pool", {
        localPart,
        domain,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Founder pool email account created (free)");
      setFounderEmail("");
      setFounderDomain("");
      queryClient.invalidateQueries({ queryKey: ["email-all-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["email-billing-summary"] });
    },
    onError: () => {
      toast.error("Failed to create founder pool account");
    },
  });

  const accounts = accountsData?.data as Account[] | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Hosting Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage domains, accounts, and billing for all hosted email
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">
                  {billing?.totalAccounts || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {billing?.activeAccounts || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Free (Founder Pool)
                </p>
                <p className="text-2xl font-bold">
                  {billing?.founderPoolFree || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Monthly Revenue
                </p>
                <p className="text-2xl font-bold">
                  $
                  {((billing?.monthlyRevenueCents || 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Founder Pool Create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Create Founder Pool Email (Free)
          </CardTitle>
          <CardDescription>
            Create a free email account from the founder allocation pool
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">
                Username
              </label>
              <Input
                placeholder="john.doe"
                value={founderEmail}
                onChange={(e) => setFounderEmail(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 pb-2 text-muted-foreground">
              @
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">
                Domain
              </label>
              <Input
                placeholder="mgrcapital.com"
                value={founderDomain}
                onChange={(e) => setFounderDomain(e.target.value)}
              />
            </div>
            <Button
              onClick={() =>
                founderPoolMutation.mutate({
                  localPart: founderEmail,
                  domain: founderDomain,
                })
              }
              disabled={
                founderPoolMutation.isPending ||
                !founderEmail ||
                !founderDomain
              }
            >
              {founderPoolMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Free
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domains
          </CardTitle>
          <CardDescription>
            DNS verification status for all email domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domainsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">Domain</th>
                    <th className="py-3 pr-4">MX</th>
                    <th className="py-3 pr-4">SPF</th>
                    <th className="py-3 pr-4">DKIM</th>
                    <th className="py-3 pr-4">Overall</th>
                    <th className="py-3 pr-4">Accounts</th>
                    <th className="py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {domains?.map((domain) => (
                    <tr key={domain.id} className="border-b">
                      <td className="py-3 pr-4 font-medium">
                        {domain.domain}
                      </td>
                      <td className="py-3 pr-4">
                        {domain.mxVerified ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-yellow-600" />
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {domain.spfVerified ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-yellow-600" />
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {domain.dkimVerified ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-yellow-600" />
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {domain.verified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4">{domain.accountCount}</td>
                      <td className="py-3 whitespace-nowrap">
                        {new Date(domain.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {(!domains || domains.length === 0) && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No domains configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Accounts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                All Accounts
              </CardTitle>
              <CardDescription>
                All hosted email accounts across all domains
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Storage</th>
                      <th className="py-3 pr-4">Billing</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts?.map((account) => (
                      <tr key={account.id} className="border-b">
                        <td className="py-3 pr-4 font-medium">
                          {account.email}
                        </td>
                        <td className="py-3 pr-4">
                          {account.userName || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              statusVariant[account.status] || "default"
                            }
                          >
                            {account.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  account.storageUsedMB /
                                    account.storageLimitMB >
                                  0.9
                                    ? "bg-red-500"
                                    : account.storageUsedMB /
                                        account.storageLimitMB >
                                      0.7
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    (account.storageUsedMB /
                                      account.storageLimitMB) *
                                      100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {account.storageUsedMB}MB
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {account.billingAmountCents > 0
                            ? `$${(account.billingAmountCents / 100).toFixed(2)}/mo`
                            : "Free"}
                        </td>
                        <td className="py-3 pr-4">
                          {account.isFounderPool ? (
                            <Badge variant="info">Founder</Badge>
                          ) : (
                            <Badge variant="secondary">Paid</Badge>
                          )}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          {new Date(account.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(!accounts || accounts.length === 0) && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No email accounts found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {accountsData?.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {accountsData.page} of {accountsData.totalPages} (
                    {accountsData.total} total)
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
                      disabled={page >= accountsData.totalPages}
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
