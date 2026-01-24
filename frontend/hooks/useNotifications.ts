"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export function useNotifications() {
  const { user, accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user || !accessToken) return;

    // Create EventSource for SSE
    const eventSource = new EventSource(
      `${API_URL}/api/notifications/events?token=${accessToken}`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "unread_count") {
          setUnreadCount(data.count);
        } else if (data.type === "new_notification") {
          setNotifications((prev) => [data.notification, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        } else if (data.type === "notifications_list") {
          setNotifications(data.notifications);
        }
      } catch (e) {
        console.error("Failed to parse SSE data:", e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Will automatically try to reconnect
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [user, accessToken]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error("Failed to mark notification as read:", e);
      }
    },
    [accessToken]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  }, [accessToken]);

  return {
    unreadCount,
    notifications,
    isConnected,
    markAsRead,
    markAllAsRead,
  };
}

export default useNotifications;
