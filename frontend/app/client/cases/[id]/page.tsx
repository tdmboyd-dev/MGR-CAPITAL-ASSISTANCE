"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploader } from "@/components/DocumentUploader";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Download,
  Eye,
  Upload,
  Phone,
  Mail,
  Shield,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Home,
  TrendingUp,
  Heart,
} from "lucide-react";

// Client-friendly status display - hide internal terminology
const STATUS_DISPLAY: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  progress: number;
  message: string;
  nextSteps: string[];
}> = {
  NEW: {
    label: "Getting Started",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    progress: 10,
    message: "We've received your case and are reviewing the details to understand how we can help you.",
    nextSteps: [
      "Our team is reviewing your information",
      "You'll receive an update within 2-3 business days",
      "No action needed from you right now"
    ]
  },
  CONTACTED: {
    label: "In Review",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    progress: 20,
    message: "Our team is actively reviewing your case and gathering the necessary information.",
    nextSteps: [
      "A representative may reach out with questions",
      "We're verifying the recovered funds available",
      "Processing typically takes 1-2 weeks"
    ]
  },
  DOCS_PENDING: {
    label: "Action Needed",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    progress: 35,
    message: "We need some documents from you to proceed with your claim. Please upload them as soon as possible.",
    nextSteps: [
      "Review and sign the documents sent to your email",
      "Upload any requested identification or paperwork",
      "Contact us if you have questions about required documents"
    ]
  },
  DOCS_SIGNED: {
    label: "Documents Received",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    progress: 50,
    message: "Thank you! We have all the documents we need. Your claim is now being processed.",
    nextSteps: [
      "Our team is preparing your claim for filing",
      "No additional action needed from you",
      "We'll notify you when your claim is filed"
    ]
  },
  FILED: {
    label: "Claim Filed",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    progress: 65,
    message: "Your claim has been officially filed with the appropriate authorities. Now we wait for processing.",
    nextSteps: [
      "Your claim is being reviewed by the county/state",
      "Processing times vary (typically 30-90 days)",
      "We'll follow up on your behalf regularly"
    ]
  },
  AWAITING_FUNDS: {
    label: "Almost There",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    progress: 80,
    message: "Great news! Your claim has been approved. The funds are being processed and will be disbursed soon.",
    nextSteps: [
      "Funds have been approved for release",
      "Payment is being processed",
      "You'll receive your funds within 2-4 weeks"
    ]
  },
  PAYOUT_SCHEDULED: {
    label: "Payout Scheduled",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    progress: 95,
    message: "Your payout is scheduled! You'll receive your recovered funds very soon.",
    nextSteps: [
      "Check your preferred payment method",
      "Funds should arrive within 5-7 business days",
      "Contact us if you don't receive payment"
    ]
  },
  PAID: {
    label: "Funds Recovered",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    progress: 100,
    message: "Congratulations! Your recovered funds have been successfully disbursed to you.",
    nextSteps: [
      "Please verify you received the funds",
      "Keep records for your taxes",
      "Thank you for trusting us with your case"
    ]
  },
  CLOSED_WON: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    progress: 100,
    message: "Your case has been successfully resolved! Thank you for choosing MGR Capital Assistance.",
    nextSteps: []
  },
  CLOSED_LOST: {
    label: "Closed",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    progress: 100,
    message: "This case has been closed. Please contact us if you have any questions.",
    nextSteps: []
  },
};

// Visual timeline steps for clients
const TIMELINE_STEPS = [
  { key: "started", label: "Case Started", icon: Clock },
  { key: "review", label: "In Review", icon: FileText },
  { key: "documents", label: "Documents", icon: Upload },
  { key: "filed", label: "Claim Filed", icon: CheckCircle },
  { key: "approved", label: "Approved", icon: TrendingUp },
  { key: "paid", label: "Funds Received", icon: DollarSign },
];

const getTimelineProgress = (status: string): number => {
  const progressMap: Record<string, number> = {
    NEW: 1,
    CONTACTED: 2,
    DOCS_PENDING: 2,
    DOCS_SIGNED: 3,
    FILED: 4,
    AWAITING_FUNDS: 5,
    PAYOUT_SCHEDULED: 5,
    PAID: 6,
    CLOSED_WON: 6,
    CLOSED_LOST: 6,
  };
  return progressMap[status] || 1;
};

export default function ClientCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [showUploader, setShowUploader] = useState(false);
  const [showAllDocuments, setShowAllDocuments] = useState(false);

  const { data: caseData, isLoading, refetch } = useQuery({
    queryKey: ["client-case", caseId],
    queryFn: async () => {
      const { data } = await api.get(`/cases/my/${caseId}`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const caseInfo = caseData?.data;

  if (!caseInfo) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">Case Not Found</h2>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t find this case. It may have been removed or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.push("/client/cases")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Cases
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_DISPLAY[caseInfo.status] || STATUS_DISPLAY.NEW;
  const timelineProgress = getTimelineProgress(caseInfo.status);
  const documents = caseInfo.documents || [];
  const needsDocuments = caseInfo.status === "DOCS_PENDING";

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/client/cases")}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Case Details</h1>
          <p className="text-muted-foreground">
            Case #{caseInfo.caseCode || caseInfo.id.slice(0, 8)}
          </p>
        </div>
        <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border-0 text-sm px-3 py-1`}>
          {statusInfo.label}
        </Badge>
      </motion.div>

      {/* Urgent Action Banner */}
      {needsDocuments && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                      Documents Needed
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Please upload the required documents to continue processing your case
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowUploader(true)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Visual Progress Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recovery Progress
            </CardTitle>
            <CardDescription>
              Track the status of your claim through each stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold">{statusInfo.progress}%</span>
              </div>
              <Progress value={statusInfo.progress} className="h-3" />
            </div>

            {/* Step Timeline */}
            <div className="relative">
              <div className="flex justify-between">
                {TIMELINE_STEPS.map((step, index) => {
                  const isCompleted = index < timelineProgress;
                  const isCurrent = index === timelineProgress - 1;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1">
                      <div
                        className={`
                          h-10 w-10 rounded-full flex items-center justify-center z-10
                          ${isCompleted
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-muted text-muted-foreground"
                          }
                        `}
                      >
                        {isCompleted && !isCurrent ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      <span className={`
                        mt-2 text-xs text-center max-w-[80px]
                        ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}
                      `}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Connecting Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-10">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${((timelineProgress - 1) / (TIMELINE_STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status Message & Next Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className={`${statusInfo.bgColor} border-0`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-full ${statusInfo.color === "text-yellow-600" ? "bg-yellow-200 dark:bg-yellow-800" : "bg-white/50 dark:bg-gray-800/50"} flex items-center justify-center`}>
                {needsDocuments ? (
                  <AlertCircle className={`h-6 w-6 ${statusInfo.color}`} />
                ) : statusInfo.progress === 100 ? (
                  <CheckCircle className={`h-6 w-6 ${statusInfo.color}`} />
                ) : (
                  <Clock className={`h-6 w-6 ${statusInfo.color}`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${statusInfo.color} mb-2`}>
                  {statusInfo.label}
                </h3>
                <p className="text-sm text-foreground/80 mb-4">
                  {statusInfo.message}
                </p>
                {statusInfo.nextSteps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">What happens next:</p>
                    <ul className="space-y-1">
                      {statusInfo.nextSteps.map((step, idx) => (
                        <li key={idx} className="text-sm text-foreground/70 flex items-start gap-2">
                          <span className="text-primary mt-1">-</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  Property Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">{caseInfo.propertyAddress || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="font-medium">{caseInfo.county}, {caseInfo.state}</p>
                  </div>
                  {caseInfo.saleDate && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Sale Date</p>
                      <p className="font-medium">{formatDate(caseInfo.saleDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Case Started</p>
                    <p className="font-medium">{formatDate(caseInfo.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recovery Information - Show as estimated range, hide fee details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <DollarSign className="h-5 w-5" />
                  Estimated Recovery
                </CardTitle>
                <CardDescription>
                  The amount we&apos;re working to recover for you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  {caseInfo.estimatedRecoveryCents || caseInfo.actualRecoveryCents ? (
                    <>
                      <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(caseInfo.actualRecoveryCents || caseInfo.estimatedRecoveryCents)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {caseInfo.actualRecoveryCents
                          ? "Final recovery amount"
                          : "Estimated recovery amount"}
                      </p>
                      {caseInfo.status === "PAID" || caseInfo.status === "CLOSED_WON" ? (
                        <Badge className="mt-4 bg-emerald-500 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Funds Disbursed
                        </Badge>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Recovery amount will be determined during case review
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Documents Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Your Documents
                    </CardTitle>
                    <CardDescription>
                      Documents related to your case
                    </CardDescription>
                  </div>
                  <Button
                    variant={needsDocuments ? "default" : "outline"}
                    onClick={() => setShowUploader(!showUploader)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Document Uploader */}
                <AnimatePresence>
                  {showUploader && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 border rounded-lg bg-muted/30 mb-4">
                        <DocumentUploader
                          caseId={caseId}
                          onUploadSuccess={() => {
                            setShowUploader(false);
                            refetch();
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Document List */}
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {(showAllDocuments ? documents : documents.slice(0, 3)).map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {doc.fileName || doc.name || doc.type?.replace(/_/g, " ") || "Document"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(doc.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.status === "SIGNED" || doc.signed ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Signed
                            </Badge>
                          ) : doc.needsSignature ? (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/30">
                              Needs Signature
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {doc.status || "Uploaded"}
                            </Badge>
                          )}
                          {doc.filePath && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => window.open(doc.filePath, "_blank")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {documents.length > 3 && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowAllDocuments(!showAllDocuments)}
                      >
                        {showAllDocuments ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            View {documents.length - 3} More
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : !showUploader ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No documents uploaded yet</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setShowUploader(true)}
                    >
                      Upload your first document
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Case Timeline / Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative border-l-2 border-muted pl-6 space-y-6">
                  {/* Current Status */}
                  <div className="relative">
                    <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-primary ring-4 ring-background" />
                    <p className="font-medium">{statusInfo.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(caseInfo.updatedAt)}
                    </p>
                  </div>

                  {/* Case Created */}
                  {caseInfo.status !== "NEW" && (
                    <div className="relative">
                      <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-green-500" />
                      <p className="font-medium">Case Started</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(caseInfo.createdAt)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Estimated Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Estimated Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Based on similar cases, here&apos;s what to expect:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Review & Processing</span>
                    <span className="text-sm font-medium">1-2 weeks</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Claim Filing</span>
                    <span className="text-sm font-medium">1-3 weeks</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Approval & Disbursement</span>
                    <span className="text-sm font-medium">30-90 days</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">
                  * Timelines vary by county and case complexity
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Support Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Need Help?
                </CardTitle>
                <CardDescription>
                  We&apos;re here to answer your questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href="tel:1-800-555-0123"
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">1-800-555-0123</span>
                </a>
                <a
                  href="mailto:support@mgrcapital.com"
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">support@mgrcapital.com</span>
                </a>
                <Button asChild variant="outline" className="w-full mt-2">
                  <Link href="/client/messages">
                    Send a Message
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security Note */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg bg-muted/30">
              <Shield className="h-4 w-4" />
              <span>Your information is encrypted and secure</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
