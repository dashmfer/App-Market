"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    listingId?: string;
    listingSlug?: string;
    amount?: number;
  };
}

interface UseNotificationsOptions {
  pollInterval?: number;
  enabled?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { pollInterval = 30000, enabled = true } = options;
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastFetchedCount, setLastFetchedCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");

      const data = await res.json();
      setNotifications(data.notifications || []);

      // Show toast for new notifications
      const newCount = data.unreadCount || 0;
      if (newCount > lastFetchedCount && lastFetchedCount > 0) {
        const newNotifs = data.notifications.slice(0, newCount - lastFetchedCount);
        newNotifs.forEach((notif: Notification) => {
          toast(notif.title, {
            description: notif.message,
            duration: 5000,
          });
        });
      }

      setUnreadCount(newCount);
      setLastFetchedCount(newCount);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [session, status, lastFetchedCount]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      setLastFetchedCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled && status === "authenticated") {
      fetchNotifications();
    }
  }, [enabled, status, fetchNotifications]);

  // Polling for new notifications
  useEffect(() => {
    if (!enabled || status !== "authenticated") return;

    const interval = setInterval(fetchNotifications, pollInterval);
    return () => clearInterval(interval);
  }, [enabled, status, pollInterval, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
