"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

type InboxNotification = { id: string; title: string; message: string; isRead: boolean; link?: string; createdAt: string };
const roles = ['FOUNDER', 'ADMIN', 'HR', 'COMPLIANCE', 'TEAM_LEAD', 'EMPLOYEE', 'CLIENT'];

export default function NotificationsPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['notification-center', user?.id, page],
    enabled: Boolean(user && accessToken),
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/notifications', { params: { page, limit: 20 }, signal });
      return data as { notifications: InboxNotification[]; total: number; unreadCount: number };
    },
  });
  const openNotification = async (notification: InboxNotification) => {
    setBusy(notification.id); setActionError(null);
    try {
      if (!notification.isRead) await api.patch(`/notifications/${encodeURIComponent(notification.id)}/read`);
      await query.refetch();
      if (notification.link?.startsWith('/') && !notification.link.startsWith('//') && !notification.link.includes('\\')) router.push(notification.link);
    } catch { setActionError('Could not open this notification. Please retry.'); }
    finally { setBusy(null); }
  };
  return <DashboardLayout allowedRoles={roles}>
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button variant="outline" onClick={() => { void query.refetch(); }} disabled={query.isFetching}>Refresh</Button>
      </div>
      {query.isLoading && <p role="status">Loading your notifications…</p>}
      {query.isError && <p role="alert" className="text-destructive">Notifications are unavailable. Refresh to retry.</p>}
      {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
      {query.data && <p className="text-sm text-muted-foreground">{query.data.unreadCount} unread · {query.data.total} total</p>}
      {!query.isError && query.data?.notifications.length === 0 && <p>No notifications on this page.</p>}
      <div className="space-y-3">
        {query.data?.notifications.map(notification => <button key={notification.id} type="button" onClick={() => { void openNotification(notification); }} disabled={busy !== null} className={`block w-full rounded-xl border p-4 text-left transition-colors hover:bg-muted ${!notification.isRead ? 'border-primary/50 bg-primary/5' : ''}`}>
          <h2 className="font-medium">{notification.title}{!notification.isRead && <span className="ml-2 text-xs text-primary">Unread</span>}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
          <time dateTime={notification.createdAt} className="mt-2 block text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</time>
          {busy === notification.id && <span role="status">Opening…</span>}
        </button>)}
      </div>
      <nav aria-label="Notification pages" className="flex items-center justify-between">
        <Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <span>Page {page}</span>
        <Button variant="outline" disabled={!query.data || page * 20 >= query.data.total || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button>
      </nav>
    </main>
  </DashboardLayout>;
}
