"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Mail,
  Plus,
  KeyRound,
  Trash2,
  Undo2,
  HardDrive,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  ACTIVE: "success",
  PROVISIONING: "info",
  SUSPENDED: "warning",
  PENDING_DELETION: "destructive",
  DELETED: "destructive",
};

interface EmailAccount {
  id: string;
  email: string;
  domain: string;
  status: string;
  storageUsedMB: number;
  storageLimitMB: number;
  billingAmountCents: number;
  nextBillingDate: string;
  createdAt: string;
  deletionRequestedAt?: string;
  gracePeriodEnds?: string;
}

export default function EmployeeEmailPage() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data } = await api.get("/email-hosting/accounts");
      return data.data as EmailAccount[];
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { data } = await api.post(
        `/email-hosting/accounts/${accountId}/reset-password`
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        data.tempPassword
          ? `New password: ${data.tempPassword} (save it now!)`
          : "Password reset email sent"
      );
    },
    onError: () => {
      toast.error("Failed to reset password");
    },
  });

  const requestDeletionMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { data } = await api.post(
        `/email-hosting/accounts/${accountId}/request-deletion`
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Deletion requested. Account will be removed after grace period.");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: () => {
      toast.error("Failed to request deletion");
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { data } = await api.post(
        `/email-hosting/accounts/${accountId}/cancel-deletion`
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Deletion cancelled. Account restored.");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: () => {
      toast.error("Failed to cancel deletion");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Email Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your hosted email accounts
          </p>
        </div>
        <Link href="/employee/email/setup">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Email Account
          </Button>
        </Link>
      </div>

      {!accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No Email Accounts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first professional email account.
            </p>
            <Link href="/employee/email/setup">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Email Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {account.email}
                    </CardTitle>
                    <CardDescription>{account.domain}</CardDescription>
                  </div>
                  <Badge variant={statusVariant[account.status] || "default"}>
                    {account.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Storage</p>
                      <p className="font-medium">
                        {account.storageUsedMB}MB / {account.storageLimitMB}MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Monthly</p>
                      <p className="font-medium">
                        ${(account.billingAmountCents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Next Bill</p>
                      <p className="font-medium">
                        {new Date(account.nextBillingDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Storage bar */}
                <div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        account.storageUsedMB / account.storageLimitMB > 0.9
                          ? "bg-red-500"
                          : account.storageUsedMB / account.storageLimitMB > 0.7
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          (account.storageUsedMB / account.storageLimitMB) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Grace period warning */}
                {account.status === "PENDING_DELETION" &&
                  account.gracePeriodEnds && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                      Deletion scheduled. Grace period ends:{" "}
                      {new Date(account.gracePeriodEnds).toLocaleDateString()}.
                      Cancel to keep this account.
                    </div>
                  )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetPasswordMutation.mutate(account.id)}
                    disabled={
                      resetPasswordMutation.isPending ||
                      account.status === "DELETED"
                    }
                  >
                    {resetPasswordMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <KeyRound className="h-3 w-3 mr-1" />
                    )}
                    Reset Password
                  </Button>

                  {account.status === "PENDING_DELETION" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        cancelDeletionMutation.mutate(account.id)
                      }
                      disabled={cancelDeletionMutation.isPending}
                    >
                      {cancelDeletionMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Undo2 className="h-3 w-3 mr-1" />
                      )}
                      Cancel Deletion
                    </Button>
                  ) : account.status !== "DELETED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() =>
                        requestDeletionMutation.mutate(account.id)
                      }
                      disabled={requestDeletionMutation.isPending}
                    >
                      {requestDeletionMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Request Deletion
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
