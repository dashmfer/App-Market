"use client";

import { Heart } from "lucide-react";
import Link from "next/link";

export default function WatchlistPage() {
  const watchlist: any[] = []; // Loaded from database

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Watchlist</h1>
          <p className="text-zinc-500 mt-1">Projects you're keeping an eye on</p>
        </div>

        {watchlist.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Heart className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Watchlist is empty</h3>
            <p className="text-zinc-500 mt-2 mb-6">Save projects you're interested in to track them here</p>
            <Link href="/explore" className="btn-primary inline-flex">
              Browse Projects
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {watchlist.map((item) => (
              <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                {/* Watchlist item */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
