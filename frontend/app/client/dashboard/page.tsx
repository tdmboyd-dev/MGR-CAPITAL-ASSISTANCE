"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, DollarSign, Clock, CheckCircle } from "lucide-react";

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-cases");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeCases = cases?.data?.filter(
    (c: any) => !["CLOSED_WON", "CLOSED_LOST"].includes(c.status)
  );
  const completedCases = cases?.data?.filter(
    (c: any) => c.status === "CLOSED_WON"
  );
  const totalRecovered = completedCases?.reduce(
    (sum: number, c: any) => sum + (c.actualRecoveryCents || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {user?.name || "Client"}</h1>
        <p className="text-muted-foreground">
          Track your surplus recovery cases
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cases
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cases?.data?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCases?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCases?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recovered
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRecovered || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Cases</CardTitle>
          <CardDescription>All your surplus recovery cases</CardDescription>
        </CardHeader>
        <CardContent>
          {cases?.data?.length > 0 ? (
            <div className="space-y-3">
              {cases.data.map((caseItem: any) => (
                <div
                  key={caseItem.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted"
                >
                  <div>
                    <p className="font-medium">{caseItem.caseCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {caseItem.propertyAddress || `${caseItem.state} - ${caseItem.county}`}
                    </p>
                    {caseItem.saleDate && (
                      <p className="text-xs text-muted-foreground">
                        Sale Date: {formatDate(caseItem.saleDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        caseItem.status === "CLOSED_WON"
                          ? "bg-green-100 text-green-700"
                          : caseItem.status === "CLOSED_LOST"
                          ? "bg-red-100 text-red-700"
                          : caseItem.status === "PAYOUT_SCHEDULED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {caseItem.status.replace(/_/g, " ")}
                    </span>
                    {caseItem.estimatedRecoveryCents && (
                      <p className="text-sm font-medium mt-1">
                        Est: {formatCurrency(caseItem.estimatedRecoveryCents)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No cases found. Contact us to get started with surplus recovery.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
