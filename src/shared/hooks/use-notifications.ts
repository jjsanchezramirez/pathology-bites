// src/hooks/use-notifications.ts
"use client";

// Notifications + unread count for the signed-in user, from one shared SWR cache entry
// per (user, page, limit). The hook is mounted by several header/sidebar components;
// each used to fetch on its own (9 requests per /admin load), which queued the
// dashboard's requests behind them.

import { useCallback } from "react";
import useSWR from "swr";
import { notificationsService } from "@/shared/services/service";
import { NotificationWithSource } from "@/shared/types/notifications";
import { useAuthContext } from "@/features/auth/components/auth-provider";

interface NotificationsData {
  notifications: NotificationWithSource[];
  unreadCount: number;
  total: number;
  hasMore: boolean;
}

export function useNotifications(page: number = 1, limit: number = 20) {
  const { user, isAuthenticated } = useAuthContext();
  const key = isAuthenticated && user ? (["notifications", user.id, page, limit] as const) : null;

  const { data, error, isLoading, mutate } = useSWR<NotificationsData>(
    key,
    async () => {
      const [paginated, unreadCount] = await Promise.all([
        notificationsService.getNotifications(user!.id, page, limit),
        notificationsService.getUnreadCount(user!.id),
      ]);
      return {
        notifications: paginated.notifications,
        unreadCount,
        total: paginated.total,
        hasMore: paginated.hasMore,
      };
    },
    { dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;
      await notificationsService.markAsRead(notificationId);
      await mutate(
        (prev) =>
          prev && {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          },
        { revalidate: false }
      );
    },
    [user, mutate]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await notificationsService.markAllAsRead(user.id);
    await mutate(
      (prev) =>
        prev && {
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        },
      { revalidate: false }
    );
  }, [user, mutate]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    notifications: data?.notifications ?? [],
    loading: !!key && isLoading,
    error: (error as Error | undefined) ?? null,
    unreadCount: data?.unreadCount ?? 0,
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    page,
    limit,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
