"use client";

import { Bell, CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const notifications: any[] = []; // Loaded from database

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h1>
            <p className="text-zinc-500 mt-1">Stay updated on your activity</p>
          </div>
          {notifications.length > 0 && (
            <button className="text-sm text-green-600 hover:text-green-700 font-medium">
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Bell className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No notifications</h3>
            <p className="text-zinc-500 mt-2">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                {/* Notification item */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
