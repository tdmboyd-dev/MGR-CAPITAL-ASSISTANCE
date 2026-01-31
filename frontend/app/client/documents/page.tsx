"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  FileText,
  Upload,
  File,
  CheckCircle,
  Clock,
} from "lucide-react";

const DOC_TYPE_COLORS: Record<string, string> = {
  CONTRACT: "bg-blue-500",
  ID: "bg-purple-500",
  TAX: "bg-green-500",
  OTHER: "bg-gray-500",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
  UPLOADED: "bg-blue-500",
};

export default function ClientDocumentsPage() {
  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents"],
    queryFn: async () => {
      const { data } = await api.get("/documents");
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

  const docList = documents?.data || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "PENDING":
      case "UPLOADED":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">
            View and manage your case documents
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{docList.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {docList.filter((d: any) => d.status === "APPROVED").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {docList.filter(
                (d: any) => d.status === "PENDING" || d.status === "UPLOADED"
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Cards */}
      {docList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docList.map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {doc.name || doc.originalName || "Untitled Document"}
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(doc.status)}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge
                    className={`${DOC_TYPE_COLORS[doc.type] || DOC_TYPE_COLORS.OTHER} text-white`}
                  >
                    {doc.type || "OTHER"}
                  </Badge>
                  {doc.status && (
                    <Badge
                      className={`${DOC_STATUS_COLORS[doc.status] || "bg-gray-500"} text-white`}
                    >
                      {doc.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploaded: {doc.createdAt ? formatDate(doc.createdAt) : "N/A"}
                </p>
                {doc.case && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Case: {doc.case.internalCode || doc.caseId}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No documents uploaded yet</p>
              <p className="text-sm mt-1">
                Upload your first document to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
