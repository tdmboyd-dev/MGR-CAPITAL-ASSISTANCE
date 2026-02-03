"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentUploader } from "@/components/DocumentUploader";
import { formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Search,
  Filter,
  Loader2,
  XCircle,
  Shield,
  Phone,
  Mail,
  Heart,
} from "lucide-react";

// Client-friendly document type labels
const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Agreement",
  ID: "Identification",
  TAX: "Tax Document",
  POWER_OF_ATTORNEY: "Power of Attorney",
  PROOF_OF_OWNERSHIP: "Ownership Proof",
  COURT_DOCUMENT: "Court Document",
  CORRESPONDENCE: "Correspondence",
  OTHER: "Other",
};

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING: { label: "Under Review", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", icon: Clock },
  APPROVED: { label: "Approved", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  REJECTED: { label: "Needs Revision", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", icon: XCircle },
  UPLOADED: { label: "Received", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: FileText },
  SIGNED: { label: "Signed", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  NEEDS_SIGNATURE: { label: "Needs Your Signature", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", icon: AlertCircle },
};

export default function ClientDocumentsPage() {
  const queryClient = useQueryClient();
  const [showUploader, setShowUploader] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCase, setSelectedCase] = useState<string>("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents"],
    queryFn: async () => {
      const { data } = await api.get("/documents/my-documents");
      return data;
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["client-cases-list"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-cases");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your documents...</p>
        </div>
      </div>
    );
  }

  const docList = documents?.data || [];
  const caseList = cases?.data || [];

  // Filter documents
  const filteredDocs = docList.filter((doc: any) => {
    const matchesSearch = !searchQuery ||
      (doc.name || doc.fileName || doc.type || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
    const matchesCase = selectedCase === "all" || doc.caseId === selectedCase;
    return matchesSearch && matchesStatus && matchesCase;
  });

  const pendingSignature = docList.filter((d: any) => d.needsSignature && !d.signed);
  const approvedDocs = docList.filter((d: any) => d.status === "APPROVED" || d.status === "SIGNED");
  const pendingDocs = docList.filter((d: any) => d.status === "PENDING" || d.status === "UPLOADED");

  const getStatusConfig = (doc: any) => {
    if (doc.needsSignature && !doc.signed) {
      return DOC_STATUS_CONFIG.NEEDS_SIGNATURE;
    }
    return DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.UPLOADED;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">
            View, upload, and manage your case documents
          </p>
        </div>
        <Button onClick={() => setShowUploader(!showUploader)} size="lg">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </motion.div>

      {/* Alert for pending signatures */}
      {pendingSignature.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-orange-700 dark:text-orange-400">
                      Documents Need Your Signature
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pendingSignature.length} document{pendingSignature.length > 1 ? "s" : ""} require your signature to proceed
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => {
                    // Find the first document that needs signature
                    const docToSign = pendingSignature[0];
                    if (docToSign?.filePath) {
                      window.open(docToSign.filePath, "_blank");
                    } else {
                      toast.info("Please check your email for signing links", {
                        description: "We've sent the documents to your email address for secure signing."
                      });
                    }
                  }}
                >
                  Review & Sign
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Documents
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{docList.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Approved
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">{approvedDocs.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Under Review
            </CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{pendingDocs.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Need Signature
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{pendingSignature.length}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Area */}
      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle>Upload New Document</CardTitle>
                <CardDescription>
                  Upload documents related to your case. Accepted formats: PDF, DOCX, JPG, PNG
                </CardDescription>
              </CardHeader>
              <CardContent>
                {caseList.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Select Case</label>
                      <Select value={selectedCase} onValueChange={setSelectedCase}>
                        <SelectTrigger className="w-full md:w-[300px]">
                          <SelectValue placeholder="Select a case" />
                        </SelectTrigger>
                        <SelectContent>
                          {caseList.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.propertyAddress || `${c.county}, ${c.state}`} - #{c.caseCode || c.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedCase && selectedCase !== "all" && (
                      <DocumentUploader
                        caseId={selectedCase}
                        onUploadSuccess={() => {
                          setShowUploader(false);
                          queryClient.invalidateQueries({ queryKey: ["client-documents"] });
                          toast.success("Document uploaded successfully!");
                        }}
                      />
                    )}
                    {(!selectedCase || selectedCase === "all") && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Please select a case above to upload documents
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      No cases found. Documents must be associated with a case.
                    </p>
                    <Button asChild variant="link" className="mt-2">
                      <Link href="/client/cases">View Your Cases</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Under Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="UPLOADED">Received</SelectItem>
                  <SelectItem value="SIGNED">Signed</SelectItem>
                </SelectContent>
              </Select>
              {caseList.length > 1 && (
                <Select value={selectedCase} onValueChange={setSelectedCase}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <SelectValue placeholder="Filter by case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cases</SelectItem>
                    {caseList.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.propertyAddress || `${c.county}, ${c.state}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Document List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc: any, index: number) => {
              const statusConfig = getStatusConfig(doc);
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Card className="hover:shadow-lg transition-shadow h-full">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">
                              {doc.name || doc.fileName || doc.originalName || "Document"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {DOC_TYPE_LABELS[doc.type] || doc.type || "Document"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${statusConfig.bgColor} mb-4`}>
                        <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                        <span className={`text-sm font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Meta Info */}
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <p>Uploaded: {doc.createdAt ? formatDate(doc.createdAt) : "N/A"}</p>
                        {doc.case && (
                          <p className="line-clamp-1">
                            Case: {doc.case.propertyAddress || `${doc.case.county}, ${doc.case.state}`}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {doc.filePath && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => window.open(doc.filePath, "_blank")}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = doc.filePath;
                                link.download = doc.fileName || "document";
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {doc.needsSignature && !doc.signed && (
                          <Button
                            size="sm"
                            className="flex-1 bg-orange-500 hover:bg-orange-600"
                            onClick={() => {
                              if (doc.filePath) {
                                window.open(doc.filePath, "_blank");
                              } else {
                                toast.info("Check your email for the signing link", {
                                  description: "We've sent this document to your email for secure signing."
                                });
                              }
                            }}
                          >
                            Sign Now
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                {docList.length === 0 ? (
                  <>
                    <h3 className="text-lg font-medium mb-2">No Documents Yet</h3>
                    <p className="text-sm mb-4">
                      Upload your first document to get started
                    </p>
                    <Button onClick={() => setShowUploader(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium mb-2">No Documents Match Your Filters</h3>
                    <p className="text-sm">
                      Try adjusting your search or filters
                    </p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterStatus("all");
                        setSelectedCase("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Help Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Need Help With Documents?</h3>
                  <p className="text-sm text-muted-foreground">
                    Not sure what to upload? Our team can guide you.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <a href="tel:1-800-555-0123">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Us
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="mailto:support@mgrcapital.com">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security Note */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Your documents are encrypted and stored securely</span>
      </div>
    </div>
  );
}
