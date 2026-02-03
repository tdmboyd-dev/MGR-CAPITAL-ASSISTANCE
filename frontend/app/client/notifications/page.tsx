"use client";

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
import { formatDateTime, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  FileText,
  DollarSign,
  CheckCircle,
  Inbox,
  AlertCircle,
  Loader2,
  Clock,
  MessageSquare,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

// Notification type configurations
const NOTIFICATION_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  CASE_UPDATE: {
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Case Update"
  },
  case_update: {
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Case Update"
  },
  DOCUMENTS: {
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "Documents"
  },
  documents: {
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "Documents"
  },
  PAYMENT: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "Payment"
  },
  payment: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "Payment"
  },
  PAYOUT: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "Payment"
  },
  payout: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "Payment"
  },
  ACTION_REQUIRED: {
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Action Needed"
  },
  action_required: {
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Action Needed"
  },
  MESSAGE: {
    icon: MessageSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "Message"
  },
  message: {
    icon: MessageSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "Message"
  },
  default: {
    icon: Bell,
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    label: "Update"
  }
};

export default function ClientNotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["client-notifications"],
    queryFn: async () => {
      const { data } = await api.get("/notifications");
      return data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.patch(`/notifications/${notificationId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
    },
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch("/notifications/mark-read");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to mark notifications as read");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your updates...</p>
        </div>
      </div>
    );
  }

  const notificationList = notifications?.data || [];
  const unreadCount = notificationList.filter((n: any) => !n.read).length;
  const actionRequired = notificationList.filter((n: any) =>
    n.type === "ACTION_REQUIRED" || n.type === "action_required" || n.type === "DOCUMENTS"
  );

  const getNotificationConfig = (type: string) => {
    return NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG.default;
  };

  const getNotificationLink = (notification: any) => {
    if (notification.caseId) {
      return `/client/cases/${notification.caseId}`;
    }
    if (notification.type?.toLowerCase().includes("document")) {
      return "/client/documents";
    }
    if (notification.type?.toLowerCase().includes("message")) {
      return "/client/messages";
    }
    return "/client/dashboard";
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
          <h1 className="text-3xl font-bold">Updates & Notifications</h1>
          <p className="text-muted-foreground">
            Stay informed about your case progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <>
              <Badge className="bg-blue-500 text-white px-3 py-1">
                {unreadCount} unread
              </Badge>
              <Button
                variant="outline"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Action Required Alert */}
      {actionRequired.length > 0 && actionRequired.some((n: any) => !n.read) && (
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
                      Action Required
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Some notifications require your attention
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Link href="/client/documents">
                    View Documents
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
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
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Updates
            </CardTitle>
            <Bell className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {notificationList.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Unread
            </CardTitle>
            <Inbox className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {unreadCount}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Read
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {notificationList.length - unreadCount}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {notificationList.length > 0 ? (
          <div className="space-y-3">
            {notificationList.map((notification: any, index: number) => {
              const config = getNotificationConfig(notification.type);
              const NotificationIcon = config.icon;
              const link = getNotificationLink(notification);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Card
                    className={`transition-all hover:shadow-md ${
                      !notification.read
                        ? "border-l-4 border-l-blue-500 bg-blue-500/5"
                        : ""
                    }`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${config.bgColor}`}>
                          <NotificationIcon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={`${config.bgColor} ${config.color} border-0`}>
                                  {config.label}
                                </Badge>
                                {!notification.read && (
                                  <span className="text-xs text-blue-600 font-medium">New</span>
                                )}
                              </div>
                              <p className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                                {notification.title || "Update"}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.message || notification.body || ""}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {notification.createdAt ? formatDateTime(notification.createdAt) : ""}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsReadMutation.mutate(notification.id)}
                                  disabled={markAsReadMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Mark Read
                                </Button>
                              )}
                              <Button variant="outline" size="sm" asChild>
                                <Link href={link}>
                                  View Details
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
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
                <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  You&apos;re All Caught Up!
                </h3>
                <p className="text-sm mb-4">
                  No new notifications at this time.
                </p>
                <p className="text-sm">
                  We&apos;ll notify you when there are updates to your cases.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
            <CardDescription>Jump to common pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/client/dashboard">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/client/cases">
                  <FileText className="h-4 w-4 mr-2" />
                  My Cases
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/client/documents">
                  <FileText className="h-4 w-4 mr-2" />
                  Documents
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/client/messages">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
