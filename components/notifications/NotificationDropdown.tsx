"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  DollarSign,
  Gavel,
  AlertTriangle,
  Package,
  Star,
  Clock,
  ArrowRight,
  MessageCircle,
  Gift,
} from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";

const notificationIcons: Record<string, React.ReactNode> = {
  BID_PLACED: <Gavel className="w-4 h-4 text-green-500" />,
  BID_OUTBID: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  AUCTION_WON: <DollarSign className="w-4 h-4 text-green-500" />,
  AUCTION_LOST: <Gavel className="w-4 h-4 text-zinc-500" />,
  AUCTION_ENDING_SOON: <Clock className="w-4 h-4 text-amber-500" />,
  TRANSFER_STARTED: <Package className="w-4 h-4 text-blue-500" />,
  TRANSFER_COMPLETED: <Check className="w-4 h-4 text-green-500" />,
  PAYMENT_RECEIVED: <DollarSign className="w-4 h-4 text-green-500" />,
  DISPUTE_OPENED: <AlertTriangle className="w-4 h-4 text-red-500" />,
  DISPUTE_RESOLVED: <Check className="w-4 h-4 text-green-500" />,
  REVIEW_RECEIVED: <Star className="w-4 h-4 text-amber-500" />,
  WATCHLIST_ENDING: <Clock className="w-4 h-4 text-amber-500" />,
  MESSAGE_RECEIVED: <MessageCircle className="w-4 h-4 text-blue-500" />,
  LISTING_RESERVED: <Gift className="w-4 h-4 text-green-500" />,
  OFFER_ACCEPTED: <Check className="w-4 h-4 text-green-500" />,
  SYSTEM: <Bell className="w-4 h-4 text-zinc-500" />,
};

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const icon = notificationIcons[notification.type] || (
    <Bell className="w-4 h-4 text-zinc-500" />
  );

  const listingSlug = notification.data?.listingSlug || (notification.data as any)?.slug;
  const listingId = notification.data?.listingId;
  const conversationId = notification.data?.conversationId;
  const collaboratorId = notification.data?.collaboratorId;
  const partnerId = notification.data?.partnerId;

  let href = "/dashboard/notifications";
  if (notification.type === "MESSAGE_RECEIVED" && conversationId) {
    href = `/dashboard/messages?conversation=${conversationId}`;
  } else if (notification.type === "LISTING_RESERVED" || notification.type === "OFFER_ACCEPTED") {
    // Direct reserved/offer accepted notifications to the purchases page
    href = "/dashboard/purchases";
  } else if (notification.type === "COLLABORATION_INVITE" && collaboratorId) {
    // Direct collaboration invites to the invite page
    href = `/invite/collaborator/${collaboratorId}`;
  } else if (notification.type === "PURCHASE_PARTNER_INVITE" && partnerId) {
    // Direct purchase partner invites to the partner invite page
    href = `/invite/partner/${partnerId}`;
  } else if (listingSlug) {
    href = `/listing/${listingSlug}`;
  }

  return (
    <Link
      href={href}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
      className={`group flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
        notification.read
          ? "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
          : "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20"
      }`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          notification.read
            ? "bg-zinc-100 dark:bg-zinc-800"
            : "bg-white dark:bg-zinc-800 shadow-sm"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm font-medium truncate ${
              notification.read
                ? "text-zinc-600 dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-green-500 rounded-full" />
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </Link>
  );
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications({ pollInterval: 30000 });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-green-500 rounded-full shadow-sm"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-zinc-300 border-t-green-500 rounded-full animate-spin" />
                  <p className="text-sm text-zinc-500 mt-2">Loading...</p>
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    No notifications
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {recentNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  View all notifications
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
