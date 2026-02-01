"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { ListingCard } from "@/components/listings/listing-card";

interface WatchlistListing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  thumbnailUrl?: string;
  category?: string;
  categories?: string[];
  techStack?: string[];
  currentBid?: number;
  startingPrice?: number;
  buyNowPrice?: number;
  buyNowEnabled?: boolean;
  currency?: string;
  endTime: string;
  _count?: { bids: number };
  watchlistId: string;
  seller?: {
    id?: string;
    name?: string;
    displayName?: string;
    username?: string;
    image?: string;
    isVerified?: boolean;
  };
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/watchlist");

        if (response.ok) {
          const data = await response.json();
          setWatchlist(data.listings || []);
        } else if (response.status === 401) {
          setError("Please sign in to view your watchlist");
        } else {
          const data = await response.json();
          setError(data.error || "Failed to load watchlist");
        }
      } catch (err) {
        console.error("Error fetching watchlist:", err);
        setError("Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Watchlist</h1>
          <p className="text-zinc-500 mt-1">Projects you're keeping an eye on</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Heart className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{error}</h3>
            <p className="text-zinc-500 mt-2 mb-6">
              {error.includes("sign in") ? "Sign in to save and view your watchlist" : "Please try again later"}
            </p>
            <Link href="/explore" className="btn-primary inline-flex">
              Browse Projects
            </Link>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Heart className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Watchlist is empty</h3>
            <p className="text-zinc-500 mt-2 mb-6">Save projects you're interested in to track them here</p>
            <Link href="/explore" className="btn-primary inline-flex">
              Browse Projects
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {watchlist.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                index={index}
                initialWatchlisted={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
