"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, MapPin, Clock, CheckCircle, DollarSign } from "lucide-react";

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  NEW: { label: "Submitted", color: "bg-blue-500" },
  CONTACTED: { label: "In Review", color: "bg-blue-500" },
  DOCS_PENDING: { label: "Documents Needed", color: "bg-yellow-500" },
  DOCS_SIGNED: { label: "Documents Received", color: "bg-green-500" },
  FILED: { label: "Filed with County", color: "bg-purple-500" },
  AWAITING_FUNDS: { label: "Awaiting Funds", color: "bg-orange-500" },
  PAID: { label: "Funds Received", color: "bg-emerald-500" },
  CLOSED: { label: "Completed", color: "bg-gray-500" },
  REJECTED: { label: "Unable to Process", color: "bg-red-500" },
};

export default function ClientCasesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases");
      return data;
    },
  });

  const cases = data?.data || [];
  const activeCases = cases.filter(
    (c: any) => !["CLOSED", "REJECTED", "PAID"].includes(c.status)
  );
  const completedCases = cases.filter((c: any) => c.status === "PAID");
  const totalRecovered = completedCases.reduce(
    (sum: number, c: any) => sum + (c.actualValueCents || c.estimatedValueCents || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Cases</h1>
        <p className="text-muted-foreground">
          Track the status of your surplus recovery claims
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {activeCases.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {completedCases.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recovered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalRecovered)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Case List */}
      <Card>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
          <CardDescription>
            View the progress of each of your claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonList items={5} />
          ) : cases.length > 0 ? (
            <div className="space-y-4">
              {cases.map((caseItem: any) => {
                const statusInfo = STATUS_DISPLAY[caseItem.status] || {
                  label: caseItem.status,
                  color: "bg-gray-500",
                };

                return (
                  <div
                    key={caseItem.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{caseItem.internalCode}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {caseItem.propertyAddress || `${caseItem.county}, ${caseItem.state}`}
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusInfo.color} text-white`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* Progress Steps */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span>Progress</span>
                        <span className="text-muted-foreground">
                          {getProgressPercent(caseItem.status)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${getProgressPercent(caseItem.status)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started {formatDate(caseItem.createdAt)}
                        </span>
                      </div>
                      {caseItem.estimatedValueCents && (
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          Est. {formatCurrency(caseItem.estimatedValueCents)}
                        </div>
                      )}
                    </div>

                    {/* Status-specific messages */}
                    {caseItem.status === "DOCS_PENDING" && (
                      <div className="mt-3 p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                          Action required: Please review and sign the documents sent to your email.
                        </p>
                      </div>
                    )}
                    {caseItem.status === "PAID" && (
                      <div className="mt-3 p-3 rounded bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Funds have been disbursed. Check your payment method.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cases found</p>
              <p className="text-sm mt-2">
                Contact us to start your surplus recovery claim.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getProgressPercent(status: string): number {
  const progressMap: Record<string, number> = {
    NEW: 10,
    CONTACTED: 20,
    DOCS_PENDING: 35,
    DOCS_SIGNED: 50,
    FILED: 65,
    AWAITING_FUNDS: 80,
    PAID: 100,
    CLOSED: 100,
    REJECTED: 100,
  };
  return progressMap[status] || 0;
}
