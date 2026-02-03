"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  FileText,
  MapPin,
  Clock,
  CheckCircle,
  DollarSign,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Phone,
  Mail,
  Heart,
} from "lucide-react";

// Client-friendly status display - using "recovered funds" terminology
const STATUS_DISPLAY: Record<string, { label: string; color: string; bgColor: string; progress: number }> = {
  NEW: { label: "Getting Started", color: "text-blue-600", bgColor: "bg-blue-500", progress: 10 },
  CONTACTED: { label: "In Review", color: "text-blue-600", bgColor: "bg-blue-500", progress: 20 },
  DOCS_PENDING: { label: "Action Needed", color: "text-yellow-600", bgColor: "bg-yellow-500", progress: 35 },
  DOCS_SIGNED: { label: "Documents Received", color: "text-green-600", bgColor: "bg-green-500", progress: 50 },
  FILED: { label: "Claim Filed", color: "text-purple-600", bgColor: "bg-purple-500", progress: 65 },
  AWAITING_FUNDS: { label: "Almost There", color: "text-orange-600", bgColor: "bg-orange-500", progress: 80 },
  PAYOUT_SCHEDULED: { label: "Payout Scheduled", color: "text-emerald-600", bgColor: "bg-emerald-500", progress: 95 },
  PAID: { label: "Funds Recovered", color: "text-emerald-600", bgColor: "bg-emerald-500", progress: 100 },
  CLOSED_WON: { label: "Completed", color: "text-green-600", bgColor: "bg-green-500", progress: 100 },
  CLOSED_LOST: { label: "Closed", color: "text-gray-600", bgColor: "bg-gray-500", progress: 100 },
  REJECTED: { label: "Unable to Process", color: "text-red-600", bgColor: "bg-red-500", progress: 100 },
};

export default function ClientCasesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-cases");
      return data;
    },
  });

  const cases = data?.data || [];
  const activeCases = cases.filter(
    (c: any) => !["CLOSED_WON", "CLOSED_LOST", "PAID", "REJECTED"].includes(c.status)
  );
  const completedCases = cases.filter((c: any) => c.status === "PAID" || c.status === "CLOSED_WON");
  const totalRecovered = completedCases.reduce(
    (sum: number, c: any) => sum + (c.actualRecoveryCents || c.estimatedRecoveryCents || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold">My Cases</h1>
        <p className="text-muted-foreground">
          Track the status of your recovery claims
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{cases.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {activeCases.length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {completedCases.length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Funds Recovered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(totalRecovered)}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Case List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Your Recovery Claims
            </CardTitle>
            <CardDescription>
              Click on any case to view detailed information and progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonList items={5} />
            ) : cases.length > 0 ? (
              <div className="space-y-4">
                {cases.map((caseItem: any, index: number) => {
                  const statusInfo = STATUS_DISPLAY[caseItem.status] || {
                    label: caseItem.status,
                    color: "text-gray-600",
                    bgColor: "bg-gray-500",
                    progress: 0,
                  };

                  return (
                    <motion.div
                      key={caseItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                    >
                      <Link href={`/client/cases/${caseItem.id}`}>
                        <div className="p-5 rounded-xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                                  {caseItem.propertyAddress || `${caseItem.county}, ${caseItem.state}`}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  Case #{caseItem.caseCode || caseItem.internalCode || caseItem.id.slice(0, 8)}
                                </div>
                              </div>
                            </div>
                            <Badge className={`${statusInfo.bgColor} text-white`}>
                              {statusInfo.label}
                            </Badge>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{statusInfo.progress}%</span>
                            </div>
                            <Progress value={statusInfo.progress} className="h-2" />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Started {formatDate(caseItem.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {caseItem.estimatedRecoveryCents && (
                                <div className="flex items-center gap-1 font-medium text-emerald-600">
                                  <DollarSign className="h-4 w-4" />
                                  {formatCurrency(caseItem.estimatedRecoveryCents)}
                                </div>
                              )}
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>

                          {/* Status-specific messages */}
                          {caseItem.status === "DOCS_PENDING" && (
                            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                              <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Action required: Please upload the requested documents
                              </p>
                            </div>
                          )}
                          {caseItem.status === "PAID" && (
                            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                              <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Funds have been disbursed to you
                              </p>
                            </div>
                          )}
                          {caseItem.status === "AWAITING_FUNDS" && (
                            <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                              <p className="text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Your claim has been approved! Funds are being processed
                              </p>
                            </div>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-medium mb-2">No Cases Found</h3>
                <p className="text-muted-foreground mb-6">
                  You don&apos;t have any recovery cases at this time.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Think you have unclaimed funds? Contact us to get started.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Help Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Questions About Your Case?</h3>
                  <p className="text-sm text-muted-foreground">
                    Our team is here to help you every step of the way
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
                <Button asChild>
                  <Link href="/client/messages">
                    Send a Message
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
