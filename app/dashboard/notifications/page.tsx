"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
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
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";

const notificationIcons: Record<string, React.ReactNode> = {
  BID_PLACED: <Gavel className="w-5 h-5 text-green-500" />,
  BID_OUTBID: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  AUCTION_WON: <DollarSign className="w-5 h-5 text-green-500" />,
  AUCTION_LOST: <Gavel className="w-5 h-5 text-zinc-500" />,
  AUCTION_ENDING_SOON: <Clock className="w-5 h-5 text-amber-500" />,
  TRANSFER_STARTED: <Package className="w-5 h-5 text-blue-500" />,
  TRANSFER_COMPLETED: <Check className="w-5 h-5 text-green-500" />,
  PAYMENT_RECEIVED: <DollarSign className="w-5 h-5 text-green-500" />,
  DISPUTE_OPENED: <AlertTriangle className="w-5 h-5 text-red-500" />,
  DISPUTE_RESOLVED: <Check className="w-5 h-5 text-green-500" />,
  REVIEW_RECEIVED: <Star className="w-5 h-5 text-amber-500" />,
  WATCHLIST_ENDING: <Clock className="w-5 h-5 text-amber-500" />,
  MESSAGE_RECEIVED: <MessageCircle className="w-5 h-5 text-blue-500" />,
  SYSTEM: <Bell className="w-5 h-5 text-zinc-500" />,
};

const notificationColors: Record<string, string> = {
  BID_PLACED: "bg-green-100 dark:bg-green-900/30",
  BID_OUTBID: "bg-amber-100 dark:bg-amber-900/30",
  AUCTION_WON: "bg-green-100 dark:bg-green-900/30",
  AUCTION_LOST: "bg-zinc-100 dark:bg-zinc-800",
  AUCTION_ENDING_SOON: "bg-amber-100 dark:bg-amber-900/30",
  TRANSFER_STARTED: "bg-blue-100 dark:bg-blue-900/30",
  TRANSFER_COMPLETED: "bg-green-100 dark:bg-green-900/30",
  PAYMENT_RECEIVED: "bg-green-100 dark:bg-green-900/30",
  DISPUTE_OPENED: "bg-red-100 dark:bg-red-900/30",
  DISPUTE_RESOLVED: "bg-green-100 dark:bg-green-900/30",
  REVIEW_RECEIVED: "bg-amber-100 dark:bg-amber-900/30",
  WATCHLIST_ENDING: "bg-amber-100 dark:bg-amber-900/30",
  MESSAGE_RECEIVED: "bg-blue-100 dark:bg-blue-900/30",
  SYSTEM: "bg-zinc-100 dark:bg-zinc-800",
};

function NotificationCard({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const icon = notificationIcons[notification.type] || (
    <Bell className="w-5 h-5 text-zinc-500" />
  );
  const bgColor = notificationColors[notification.type] || "bg-zinc-100 dark:bg-zinc-800";
  const listingSlug = notification.data?.listingSlug;
  const conversationId = notification.data?.conversationId;
  const collaboratorId = notification.data?.collaboratorId;
  const partnerId = notification.data?.partnerId;
  const transactionId = notification.data?.transactionId;

  let href = "#";
  if (notification.type === "BUYER_INFO_REQUIRED" && transactionId) {
    href = `/dashboard/transfers/${transactionId}/buyer-info`;
  } else if (notification.type === "BUYER_INFO_SUBMITTED" && transactionId) {
    href = `/dashboard/transfers/${transactionId}`;
  } else if (notification.type === "BUYER_INFO_SUBMITTED" && (notification.data as any)?.link) {
    href = (notification.data as any).link;
  } else if (notification.type === "PAYMENT_RECEIVED" && transactionId) {
    href = `/dashboard/transfers/${transactionId}`;
  } else if (notification.type === "TRANSFER_STARTED" && transactionId) {
    href = `/dashboard/transfers/${transactionId}`;
  } else if (notification.type === "MESSAGE_RECEIVED" && conversationId) {
    href = `/dashboard/messages?conversation=${conversationId}`;
  } else if (notification.type === "COLLABORATION_INVITE" && listingSlug) {
    // Direct collaboration invites to the listing page (which has accept/decline buttons)
    href = `/listing/${listingSlug}`;
  } else if (notification.type === "PURCHASE_PARTNER_INVITE" && partnerId) {
    // Direct purchase partner invites to the partner invite page
    href = `/invite/partner/${partnerId}`;
  } else if (listingSlug) {
    href = `/listing/${listingSlug}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`relative group bg-white dark:bg-zinc-900 rounded-xl border transition-all duration-200 ${
        notification.read
          ? "border-zinc-200 dark:border-zinc-800"
          : "border-green-200 dark:border-green-800 shadow-sm shadow-green-500/5"
      }`}
    >
      <Link
        href={href}
        onClick={() => !notification.read && onMarkAsRead(notification.id)}
        className="block p-4 sm:p-5"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${bgColor}`}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  className={`text-sm sm:text-base font-medium ${
                    notification.read
                      ? "text-zinc-600 dark:text-zinc-400"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {notification.title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                  {notification.message}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              {/* Unread indicator */}
              {!notification.read && (
                <span className="flex-shrink-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Mark as read button (on hover) */}
      {!notification.read && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onMarkAsRead(notification.id);
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-green-600 dark:hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Mark as read"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Notifications
            </h1>
            <p className="text-zinc-500 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up!"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  filter === "all"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  filter === "unread"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-green-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl transition-all duration-200"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Bell className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </h3>
            <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
              {filter === "unread"
                ? "You've read all your notifications. Nice work!"
                : "When you receive bids, offers, or updates on your listings, they'll appear here."}
            </p>
            {filter === "unread" && notifications.length > 0 && (
              <button
                onClick={() => setFilter("all")}
                className="mt-4 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
