"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  Upload,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileUp,
  FileText,
  Globe,
  Zap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface IngestionBatch {
  id: string;
  name: string;
  source: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  createdAt: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

export default function FounderIngestionPage() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: batchData, isLoading, refetch } = useQuery<IngestionBatch[]>({
    queryKey: ["ingestion-batches"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/ingestion/batches");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
  });

  const batches = batchData || [];

  const stats = {
    total: batches.reduce((sum, b) => sum + (b.totalRecords || 0), 0),
    pending: batches.filter((b) => ["PENDING", "PROCESSING", "pending", "processing"].includes(b.status)).length,
    approved: batches.filter((b) => ["COMPLETED", "APPROVED", "completed"].includes(b.status)).length,
    rejected: batches.filter((b) => ["FAILED", "REJECTED", "failed"].includes(b.status)).length,
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const { data } = await api.post("/ingestion/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadResult(data?.data || data);
      refetch();
    } catch (error: any) {
      setUploadResult({ error: error?.response?.data?.error || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            Data Ingestion
          </h1>
          <p className="text-muted-foreground">
            Upload, review, and manage data ingestion batches
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Sub-page Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/founder/ingestion/sources">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Globe className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Sources</p>
                    <p className="text-sm text-muted-foreground">Add, edit, and configure data sources</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/founder/ingestion/autopilot">
          <Card className="hover:border-yellow-500/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <Zap className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium">Autopilot Dashboard</p>
                    <p className="text-sm text-muted-foreground">Monitor automatic pipeline runs</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Ingested</p>
                <p className="text-2xl font-bold">{stats.total}</p>
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
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-full">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            Upload Data
          </CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Supports CSV, PDF, XLSX (up to 50MB, max 10 files)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept=".csv,.pdf,.xlsx,.xls,.txt"
            onChange={handleFileSelect}
          />
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-lg font-medium">Uploading and processing files...</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Drop files here to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports CSV, PDF, XLSX files
                </p>
                <Button variant="outline" className="mt-4" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <FileText className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </>
            )}
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`mt-4 p-4 rounded-lg ${uploadResult.error ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              {uploadResult.error ? (
                <p className="text-red-700">{uploadResult.error}</p>
              ) : (
                <div>
                  <p className="font-medium text-green-700">
                    Upload complete: {uploadResult.filesProcessed} file(s), {uploadResult.totalRecordsParsed} records parsed, {uploadResult.totalCasesCreated} cases created
                  </p>
                  {uploadResult.perFile?.map((f: any, i: number) => (
                    <p key={i} className="text-sm text-green-600 mt-1">
                      {f.fileName}: {f.recordsParsed} records, {f.casesCreated} cases
                      {f.errors?.length > 0 && <span className="text-red-600 ml-2">({f.errors.length} errors)</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Ingestion Batches ({batches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No ingestion batches yet. Upload a file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Batch Name</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Records</th>
                    <th className="text-right p-3 font-medium">Processed</th>
                    <th className="text-right p-3 font-medium">Errors</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3 font-medium">{batch.name}</td>
                      <td className="p-3 text-muted-foreground">{batch.source}</td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[batch.status] || "bg-gray-100 text-gray-700"}>
                          {batch.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{batch.totalRecords}</td>
                      <td className="p-3 text-right">{batch.processedRecords}</td>
                      <td className="p-3 text-right">
                        <span className={batch.errorCount > 0 ? "text-red-600 font-medium" : ""}>
                          {batch.errorCount}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(batch.createdAt)}
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
