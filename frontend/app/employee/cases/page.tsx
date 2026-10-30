"use client";

import { Badge } from "@/components/ui/badge";
import {
Card,
CardContent,
CardDescription,
CardHeader,
CardTitle,
} from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { caseListSchema } from "@/lib/caseRecords";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatCurrency,formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight,FileText,MapPin,User } from "lucide-react";
import Link from "next/link";

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

export default function EmployeeCasesPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employee-cases", user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<unknown>("/cases/my", { signal });
      return caseListSchema.parse(data);
    },
  });

  if (error) return <div role="alert" className="space-y-3 p-6"><p>Cases could not be loaded. Your saved cases have not been removed.</p><button onClick={() => { void refetch(); }} className="underline">Retry</button></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Cases</h1>
        <p className="text-muted-foreground">
          Cases assigned to you for processing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.count ?? data?.data.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data?.filter((c) => !["CLOSED", "REJECTED", "PAID"].includes(c.status)).length || 0}
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
            <div className="text-2xl font-bold">
              {data?.data?.filter((c) => c.status === "PAID").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case List</CardTitle>
          <CardDescription>Click on a case to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonList items={5} />
          ) : (data?.data?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data?.data.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/employee/cases/${caseItem.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {caseItem.internalCode}
                          </span>
                          <Badge
                            className={`${STATUS_COLORS[caseItem.status] || "bg-gray-500"} text-white text-xs`}
                          >
                            {caseItem.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {caseItem.county}, {caseItem.state}
                          </span>
                          {caseItem.client && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {caseItem.client.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {caseItem.estimatedValueCents && (
                          <p className="font-medium">
                            {formatCurrency(caseItem.estimatedValueCents)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(caseItem.createdAt)}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cases assigned to you yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
