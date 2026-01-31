"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseTimeline } from "@/components/CaseTimeline";
import dynamic from "next/dynamic";
const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ClientCase {
  id: string;
  internalCode: string;
  status: string;
  statusMessage: string;
  propertyAddress: string;
  county: string;
  state: string;
  surplusAmountCents?: number;
  createdAt: string;
  documents: {
    id: string;
    name: string;
    type: string;
    filePath: string;
    needsSignature: boolean;
    signed: boolean;
  }[];
  events: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    createdAt: string;
  }[];
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  "Getting Started": { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  "In Progress": { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  "Documents Needed": { icon: FileText, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  "Processing": { icon: Clock, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  "Filed": { icon: FileText, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  "Almost There": { icon: DollarSign, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  "Complete": { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  "Under Review": { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  "Closed": { icon: CheckCircle2, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

export default function ClientPortal() {
  const { user } = useAuth();
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const { data: cases, isLoading, error } = useQuery({
    queryKey: ["client-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases?role=client");
      return data.data as ClientCase[];
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Please Sign In</h2>
            <p className="text-muted-foreground mb-4">
              You need to be signed in to view your cases.
            </p>
            <Button asChild>
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Unable to Load Cases</h2>
            <p className="text-muted-foreground">
              Please try again later or contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold">Client Portal</h1>
            <p className="mt-2 text-blue-100">
              Welcome back, {user.name || user.email}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Contact Info */}
        <Card className="mb-8 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Questions?</span>
                <a href="tel:1-800-555-0123" className="text-blue-600 hover:underline">
                  1-800-555-0123
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <a href="mailto:support@mgrcapital.com" className="text-blue-600 hover:underline">
                  support@mgrcapital.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases */}
        {!cases || cases.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h2 className="text-xl font-bold mb-2">No Cases Found</h2>
              <p className="text-muted-foreground">
                You don't have any active cases at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {cases.map((caseItem, index) => {
              const statusInfo = statusConfig[caseItem.status] || statusConfig["In Progress"];
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedCase === caseItem.id;

              return (
                <motion.div
                  key={caseItem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${statusInfo.bgColor}`}>
                              <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                            </div>
                            <CardTitle className="text-xl">
                              Case #{caseItem.internalCode}
                            </CardTitle>
                            <Badge variant="outline" className={statusInfo.color}>
                              {caseItem.status}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-2 text-base">
                            <MapPin className="h-4 w-4" />
                            {caseItem.propertyAddress}, {caseItem.county}, {caseItem.state}
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </div>

                      {/* Status Message */}
                      <div className={`mt-4 p-4 rounded-lg ${statusInfo.bgColor}`}>
                        <p className={`font-medium ${statusInfo.color}`}>
                          {caseItem.statusMessage}
                        </p>
                      </div>

                      {/* Surplus Amount if available */}
                      {caseItem.surplusAmountCents && caseItem.surplusAmountCents > 0 && (
                        <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-700 dark:text-green-400">
                              Estimated Recovery: {formatCurrency(caseItem.surplusAmountCents)}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardHeader>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <CardContent className="border-t pt-6">
                            <div className="grid md:grid-cols-2 gap-8">
                              {/* Timeline */}
                              <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                  <Clock className="h-5 w-5 text-blue-600" />
                                  Case Timeline
                                </h3>
                                {caseItem.events && caseItem.events.length > 0 ? (
                                  <CaseTimeline events={caseItem.events} />
                                ) : (
                                  <p className="text-muted-foreground">
                                    Timeline will be updated as your case progresses.
                                  </p>
                                )}
                              </div>

                              {/* Documents */}
                              <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                  <FileText className="h-5 w-5 text-purple-600" />
                                  Documents
                                </h3>
                                {caseItem.documents && caseItem.documents.length > 0 ? (
                                  <div className="space-y-3">
                                    {caseItem.documents.map((doc) => (
                                      <div
                                        key={doc.id}
                                        className="p-4 rounded-lg bg-muted hover:bg-accent cursor-pointer transition-colors"
                                        onClick={() =>
                                          setSelectedDocument(
                                            selectedDocument === doc.id ? null : doc.id
                                          )
                                        }
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                            <div>
                                              <p className="font-medium">{doc.name || doc.type}</p>
                                              <p className="text-sm text-muted-foreground">
                                                {doc.type}
                                              </p>
                                            </div>
                                          </div>
                                          {doc.needsSignature && !doc.signed ? (
                                            <Badge variant="destructive">Needs Signature</Badge>
                                          ) : doc.signed ? (
                                            <Badge variant="outline" className="text-green-600 border-green-600">
                                              Signed
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline">View</Badge>
                                          )}
                                        </div>

                                        {/* Document Preview */}
                                        <AnimatePresence>
                                          {selectedDocument === doc.id && doc.filePath && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: "auto", opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="mt-4"
                                            >
                                              <DocumentViewer
                                                fileUrl={doc.filePath}
                                                fileName={doc.name}
                                              />
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">
                                    No documents available yet.
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
