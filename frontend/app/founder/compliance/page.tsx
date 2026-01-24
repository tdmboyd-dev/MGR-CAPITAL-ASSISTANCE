"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  Send,
} from "lucide-react";

interface ExportType {
  id: string;
  name: string;
  description: string;
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
}

interface PreviewData {
  type: string;
  headers: string[];
  totalRows: number;
  preview: Record<string, string>[];
  dateRange: { start: string | null; end: string | null };
}

interface DigestSummary {
  period: { start: string; end: string };
  auditEvents: number;
  newCases: number;
  completedCases: number;
  trainingCompletions: number;
  revenueCollectedCents: number;
  revenueFormatted: string;
  generatedAt: string;
}

export default function FounderCompliancePage() {
  const [exportType, setExportType] = useState<string>("audit");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Fetch export types
  const { data: exportTypes } = useQuery({
    queryKey: ["compliance-export-types"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/export/types");
      return data.data as { types: ExportType[]; formats: ExportFormat[] };
    },
  });

  // Fetch compliance dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/dashboard");
      return data.data;
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get("/compliance/export/preview", {
        params: { type: exportType, startDate, endDate, limit: 10 },
      });
      return data.data as PreviewData;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get("/compliance/export", {
        params: { type: exportType, format: exportFormat, startDate, endDate },
        responseType: "blob",
      });
      return response;
    },
    onSuccess: (response) => {
      const blob = new Blob([response.data], {
        type: exportFormat === "csv" ? "text/csv" : "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-${exportType}-${new Date().toISOString().split("T")[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });

  // Digest mutation
  const digestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/compliance/digest");
      return data.data as DigestSummary;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Shield className="h-7 w-7 md:h-8 md:w-8" />
          Compliance & Export
        </h1>
        <p className="text-muted-foreground">
          Generate compliance exports for audits, ledger, training, and cases
        </p>
      </div>

      {/* Compliance Summary */}
      {dashboardLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.auditStats?.totalLogs || 0}</p>
                  <p className="text-xs text-muted-foreground">Audit Logs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                {dashboard.caseCompliance?.complianceRate >= 80 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-2xl font-bold">{dashboard.caseCompliance?.complianceRate || 0}%</p>
                  <p className="text-xs text-muted-foreground">Case Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                {dashboard.trainingCompliance?.complianceRate >= 80 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-2xl font-bold">{dashboard.trainingCompliance?.complianceRate || 0}%</p>
                  <p className="text-xs text-muted-foreground">Training Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.payoutCompliance?.reviewRequired || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Export Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Builder
          </CardTitle>
          <CardDescription>
            Generate compliance reports in CSV or PDF format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <Label htmlFor="exportType">Export Type</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger id="exportType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {exportTypes?.types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exportFormat">Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger id="exportFormat">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {exportTypes?.formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        {f.id === "csv" ? (
                          <FileSpreadsheet className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Preview Table */}
          {previewData && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Preview: {previewData.type.toUpperCase()}
                </h3>
                <Badge variant="outline">
                  {previewData.totalRows} total records
                </Badge>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.slice(0, 6).map((header) => (
                        <TableHead key={header} className="whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                      {previewData.headers.length > 6 && (
                        <TableHead>...</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.preview.map((row, idx) => (
                      <TableRow key={idx}>
                        {previewData.headers.slice(0, 6).map((header) => (
                          <TableCell
                            key={header}
                            className="max-w-[200px] truncate"
                          >
                            {row[header] || "-"}
                          </TableCell>
                        ))}
                        {previewData.headers.length > 6 && (
                          <TableCell>...</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Showing first 10 of {previewData.totalRows} records.{" "}
                {previewData.headers.length > 6 &&
                  `${previewData.headers.length - 6} columns hidden.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Compliance Digest
          </CardTitle>
          <CardDescription>
            Generate a summary report of the past 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => digestMutation.mutate()}
              disabled={digestMutation.isPending}
            >
              {digestMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Generate Digest
            </Button>
            <p className="text-sm text-muted-foreground">
              Auto-runs every Monday at 8:00 AM
            </p>
          </div>

          {digestMutation.data && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-3">Digest Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="font-medium">
                    {new Date(digestMutation.data.period.start).toLocaleDateString()} -{" "}
                    {new Date(digestMutation.data.period.end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Audit Events</p>
                  <p className="font-medium">{digestMutation.data.auditEvents}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New Cases</p>
                  <p className="font-medium">{digestMutation.data.newCases}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Cases</p>
                  <p className="font-medium">{digestMutation.data.completedCases}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Training Completions</p>
                  <p className="font-medium">{digestMutation.data.trainingCompletions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Collected</p>
                  <p className="font-medium text-green-600">
                    {digestMutation.data.revenueFormatted}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Generated: {new Date(digestMutation.data.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
