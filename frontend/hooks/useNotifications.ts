"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useAuthStore } from "./useAuth";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  category: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  isRead: boolean;
  createdAt: string;
  link?: string;
}

/** Authenticated polling uses the shared refresh client. No access token is put
 * into URLs; account changes abort old reads and clear the previous inbox. */
export function useNotifications() {
  const { user, accessToken } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    const { data } = await api.get('/notifications', { params: { limit: 20 }, signal });
    if (signal?.aborted || useAuthStore.getState().user?.id !== userId) return;
    if (!Array.isArray(data.notifications) || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) throw new Error('Invalid notification response');
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setIsConnected(true);
    setError(null);
  }, [userId]);

  useEffect(() => {
    setNotifications([]); setUnreadCount(0); setIsConnected(false); setError(null);
    if (!userId || !accessToken) return;
    const controller = new AbortController();
    let running = false;
    const poll = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) { setIsConnected(false); setError('Notifications unavailable'); } }
      finally { running = false; }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [userId, accessToken, refresh]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId || useAuthStore.getState().user?.id !== userId) return;
    try { await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`); await refresh(); return true; }
    catch { setError('Could not mark notification as read'); return false; }
  }, [userId, refresh]);
  const markAllAsRead = useCallback(async () => {
    if (!userId || useAuthStore.getState().user?.id !== userId) return;
    try { await api.patch('/notifications/mark-read', {}); await refresh(); return true; }
    catch { setError('Could not mark notifications as read'); return false; }
  }, [userId, refresh]);
  return { unreadCount, notifications, isConnected, error, markAsRead, markAllAsRead };
}
export default useNotifications;
