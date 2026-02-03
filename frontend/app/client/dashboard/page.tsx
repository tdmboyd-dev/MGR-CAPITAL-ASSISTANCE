"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Phone,
  Mail,
  Shield,
  Heart,
  TrendingUp,
  Calendar,
  Upload,
  MessageSquare,
} from "lucide-react";

// Client-friendly status display - hide internal terminology
const STATUS_DISPLAY: Record<string, { label: string; color: string; progress: number; message: string }> = {
  NEW: {
    label: "Getting Started",
    color: "bg-blue-500",
    progress: 10,
    message: "We've received your case and are reviewing the details."
  },
  CONTACTED: {
    label: "In Review",
    color: "bg-blue-500",
    progress: 20,
    message: "Our team is actively working on your case."
  },
  DOCS_PENDING: {
    label: "Action Needed",
    color: "bg-yellow-500",
    progress: 35,
    message: "We need some documents from you to proceed."
  },
  DOCS_SIGNED: {
    label: "Documents Received",
    color: "bg-green-500",
    progress: 50,
    message: "Thank you! We have all the documents we need."
  },
  FILED: {
    label: "Claim Filed",
    color: "bg-purple-500",
    progress: 65,
    message: "Your claim has been officially filed. Now we wait for processing."
  },
  AWAITING_FUNDS: {
    label: "Almost There",
    color: "bg-orange-500",
    progress: 80,
    message: "Your claim has been approved! Funds are being processed."
  },
  PAID: {
    label: "Funds Recovered",
    color: "bg-emerald-500",
    progress: 100,
    message: "Great news! Your recovered funds have been disbursed."
  },
  PAYOUT_SCHEDULED: {
    label: "Payout Scheduled",
    color: "bg-emerald-500",
    progress: 95,
    message: "Your payout is scheduled and will arrive soon."
  },
  CLOSED_WON: {
    label: "Completed",
    color: "bg-green-500",
    progress: 100,
    message: "Your case has been successfully resolved!"
  },
  CLOSED_LOST: {
    label: "Closed",
    color: "bg-gray-500",
    progress: 100,
    message: "This case has been closed."
  },
};

// Actions clients can take based on status
const getNextActions = (status: string) => {
  switch (status) {
    case "DOCS_PENDING":
      return [
        { label: "Upload Documents", href: "/client/documents", icon: Upload, urgent: true },
        { label: "View Case Details", href: "/client/cases", icon: FileText, urgent: false },
      ];
    case "NEW":
    case "CONTACTED":
      return [
        { label: "View Case Status", href: "/client/cases", icon: FileText, urgent: false },
        { label: "Contact Us", href: "/client/messages", icon: MessageSquare, urgent: false },
      ];
    default:
      return [
        { label: "View Case Details", href: "/client/cases", icon: FileText, urgent: false },
      ];
  }
};

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-cases");
      return data;
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ["client-notifications-count"],
    queryFn: async () => {
      const { data } = await api.get("/notifications?unread=true&limit=5");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const caseList = cases?.data || [];
  const activeCases = caseList.filter(
    (c: any) => !["CLOSED_WON", "CLOSED_LOST"].includes(c.status)
  );
  const completedCases = caseList.filter(
    (c: any) => c.status === "CLOSED_WON" || c.status === "PAID"
  );
  const totalRecovered = completedCases.reduce(
    (sum: number, c: any) => sum + (c.actualRecoveryCents || 0),
    0
  );

  // Find urgent actions across all cases
  const urgentCases = caseList.filter((c: any) => c.status === "DOCS_PENDING");
  const unreadNotifications = notifications?.data?.filter((n: any) => !n.read) || [];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here&apos;s an overview of your recovery claims
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {formatDate(new Date().toISOString())}
          </div>
        </div>
      </motion.div>

      {/* Urgent Actions Banner */}
      {urgentCases.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                      Action Required
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {urgentCases.length} case{urgentCases.length > 1 ? "s" : ""} need{urgentCases.length === 1 ? "s" : ""} your attention
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Link href="/client/documents">
                    Upload Documents
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Cases
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {caseList.length}
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
              Recovery claims
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              In Progress
            </CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {activeCases.length}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              Being processed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completed
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {completedCases.length}
            </div>
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
              Successfully resolved
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Funds Recovered
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(totalRecovered || 0)}
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              Total recovered for you
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Cases with Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Your Active Cases
                </CardTitle>
                <CardDescription>
                  Track the progress of your recovery claims
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href="/client/cases">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeCases.length > 0 ? (
              <div className="space-y-6">
                {activeCases.slice(0, 3).map((caseItem: any, index: number) => {
                  const statusInfo = STATUS_DISPLAY[caseItem.status] || STATUS_DISPLAY.NEW;
                  const actions = getNextActions(caseItem.status);

                  return (
                    <motion.div
                      key={caseItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="p-5 rounded-xl border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">
                              {caseItem.propertyAddress || `${caseItem.county}, ${caseItem.state}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Case #{caseItem.caseCode || caseItem.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${statusInfo.color} text-white`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{statusInfo.progress}%</span>
                        </div>
                        <Progress value={statusInfo.progress} className="h-2" />
                      </div>

                      {/* Status Message */}
                      <div className="p-3 rounded-lg bg-muted/50 mb-4">
                        <p className="text-sm">{statusInfo.message}</p>
                      </div>

                      {/* Estimated Recovery (shown as range for clients) */}
                      {caseItem.estimatedRecoveryCents && (
                        <div className="flex items-center gap-2 mb-4 text-sm">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          <span className="text-muted-foreground">Estimated Recovery:</span>
                          <span className="font-semibold text-emerald-600">
                            {formatCurrency(caseItem.estimatedRecoveryCents)}
                          </span>
                        </div>
                      )}

                      {/* Next Actions */}
                      {actions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {actions.map((action) => (
                            <Button
                              key={action.href}
                              asChild
                              variant={action.urgent ? "default" : "outline"}
                              size="sm"
                            >
                              <Link href={action.href}>
                                <action.icon className="h-4 w-4 mr-2" />
                                {action.label}
                              </Link>
                            </Button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {activeCases.length > 3 && (
                  <div className="text-center pt-4">
                    <Button asChild variant="ghost">
                      <Link href="/client/cases">
                        View {activeCases.length - 3} more case{activeCases.length - 3 > 1 ? "s" : ""}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : caseList.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">No Cases Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You don&apos;t have any recovery cases at this time.
                </p>
                <Button asChild variant="outline">
                  <Link href="/client/messages">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Us
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2">All Cases Completed!</h3>
                <p className="text-muted-foreground">
                  All your recovery claims have been resolved.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Links and Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you can do right now</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link href="/client/cases">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm">View Cases</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link href="/client/documents">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">Documents</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link href="/client/messages">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm">Messages</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link href="/client/notifications">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm">Updates</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Support Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                We&apos;re Here to Help
              </CardTitle>
              <CardDescription>
                Have questions about your case? Our team is ready to assist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Call Us</p>
                  <a href="tel:1-800-555-0123" className="text-blue-600 dark:text-blue-400 hover:underline">
                    1-800-555-0123
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email Support</p>
                  <a href="mailto:support@mgrcapital.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                    support@mgrcapital.com
                  </a>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Your information is always secure and confidential</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
