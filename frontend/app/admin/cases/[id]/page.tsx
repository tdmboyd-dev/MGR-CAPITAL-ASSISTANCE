"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Users,
  Edit,
} from "lucide-react";

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

const STATUSES = [
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

export default function AdminCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const caseId = params.id as string;
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  const { data: caseData, isLoading } = useQuery({
    queryKey: ["admin-case", caseId],
    queryFn: async () => {
      const { data } = await api.get(`/cases/${caseId}`);
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data } = await api.get("/admin/users?role=EMPLOYEE");
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { data } = await api.patch(`/cases/${caseId}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-case", caseId] });
      setIsEditingStatus(false);
      toast.success("Case status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const assignEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { data } = await api.patch(`/cases/${caseId}`, { assignedEmployeeId: employeeId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-case", caseId] });
      toast.success("Employee assigned");
    },
    onError: () => {
      toast.error("Failed to assign employee");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const caseInfo = caseData?.data || caseData;

  if (!caseInfo) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h2 className="text-xl font-bold">Case Not Found</h2>
        <p className="text-muted-foreground mb-4">
          This case doesn't exist or has been deleted.
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{caseInfo.internalCode}</h1>
              {isEditingStatus ? (
                <Select
                  defaultValue={caseInfo.status}
                  onValueChange={(value) => updateStatusMutation.mutate(value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge
                  className={`${STATUS_COLORS[caseInfo.status] || "bg-gray-500"} text-white cursor-pointer`}
                  onClick={() => setIsEditingStatus(true)}
                >
                  {caseInfo.status.replace(/_/g, " ")}
                  <Edit className="h-3 w-3 ml-1" />
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Created {formatDate(caseInfo.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Property Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Property Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{caseInfo.propertyAddress || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">County</p>
                <p className="font-medium">{caseInfo.county}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">State</p>
                <p className="font-medium">{caseInfo.state}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Parcel Number</p>
                <p className="font-medium">{caseInfo.parcelNumber || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Value</p>
                <p className="font-medium text-lg">
                  {caseInfo.estimatedValueCents
                    ? formatCurrency(caseInfo.estimatedValueCents)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sale Date</p>
                <p className="font-medium">
                  {caseInfo.saleDate ? formatDate(caseInfo.saleDate) : "-"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          {caseInfo.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-medium text-primary">
                      {caseInfo.client.name?.[0] || "?"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{caseInfo.client.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {caseInfo.client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {caseInfo.client.phone}
                        </span>
                      )}
                      {caseInfo.client.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {caseInfo.client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Case Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Case Timeline
              </CardTitle>
              <CardDescription>History of case updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l-2 border-muted pl-6 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-primary" />
                  <p className="font-medium">Case Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(caseInfo.createdAt)}
                  </p>
                </div>
                {caseInfo.status !== "NEW" && (
                  <div className="relative">
                    <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-blue-500" />
                    <p className="font-medium">Status: {caseInfo.status.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(caseInfo.updatedAt)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Assigned Employee</p>
                <Select
                  value={caseInfo.assignedEmployeeId || ""}
                  onValueChange={(value) => assignEmployeeMutation.mutate(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name || emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {caseInfo.assignedEmployee && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {caseInfo.assignedEmployee.name?.[0] || "?"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{caseInfo.assignedEmployee.name}</p>
                    <p className="text-xs text-muted-foreground">{caseInfo.assignedEmployee.email}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {caseInfo.documents?.length > 0 ? (
                <div className="space-y-2">
                  {caseInfo.documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {doc.fileName || doc.type?.replace(/_/g, " ") || "Document"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={doc.status === "SIGNED" ? "success" : "outline"}
                          className="text-xs"
                        >
                          {doc.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => window.open(`/api/documents/${doc.id}/view`, "_blank")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents uploaded yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Case Notes Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Case Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={`${STATUS_COLORS[caseInfo.status]} text-white`}>
                  {caseInfo.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Est. Value</span>
                <span className="font-medium">
                  {caseInfo.estimatedValueCents
                    ? formatCurrency(caseInfo.estimatedValueCents)
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Documents</span>
                <span className="font-medium">{caseInfo.documents?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="font-medium">{formatDate(caseInfo.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
