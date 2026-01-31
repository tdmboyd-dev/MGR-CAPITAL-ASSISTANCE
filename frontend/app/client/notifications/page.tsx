"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  Bell,
  FileText,
  DollarSign,
  CheckCircle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

export default function ClientNotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["client-notifications"],
    queryFn: async () => {
      const { data } = await api.get("/notifications");
      return data;
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.post(`/notifications/${notificationId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
      toast.success("Notification marked as read");
    },
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const notificationList = notifications?.data || [];
  const unreadCount = notificationList.filter((n: any) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "CASE_UPDATE":
      case "case_update":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "PAYMENT":
      case "payment":
      case "PAYOUT":
      case "payout":
        return <DollarSign className="h-5 w-5 text-emerald-500" />;
      default:
        return <Bell className="h-5 w-5 text-purple-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated on your cases and payments
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-blue-500 text-white text-sm px-3 py-1">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Notifications
            </CardTitle>
            <Bell className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notificationList.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unread
            </CardTitle>
            <Inbox className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Read
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notificationList.length - unreadCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification List */}
      {notificationList.length > 0 ? (
        <div className="space-y-3">
          {notificationList.map((notification: any) => (
            <Card
              key={notification.id}
              className={`transition-colors ${
                !notification.read
                  ? "border-l-4 border-l-blue-500 bg-blue-500/5"
                  : ""
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {notification.title || "Notification"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message || notification.body || ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {notification.createdAt
                          ? formatDateTime(notification.createdAt)
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRead.mutate(notification.id)}
                        disabled={markAsRead.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Read
                      </Button>
                    )}
                    {notification.read && (
                      <Badge variant="secondary" className="text-xs">
                        Read
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                You&apos;re all caught up! No new notifications.
              </p>
              <p className="text-sm mt-1">
                We&apos;ll notify you when there are updates to your cases
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
