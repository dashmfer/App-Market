"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Package, Plus, Clock, CheckCircle2, AlertCircle, Eye, Edit, Trash2 } from "lucide-react";

interface Listing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  category: string;
  status: string;
  startingPrice: number;
  currency: string;
  thumbnailUrl?: string;
  endTime: string;
  createdAt: string;
  _count?: {
    bids: number;
  };
}

export default function ListingsPage() {
  const { data: session, status } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      if (status === "loading") return;

      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/listings?sellerId=${session.user.id}`);
        if (response.ok) {
          const data = await response.json();
          setListings(data.listings || []);
        } else {
          setError("Failed to load listings");
        }
      } catch (err) {
        setError("Failed to load listings");
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [session, status]);

  const getStatusBadge = (listingStatus: string) => {
    switch (listingStatus) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "ENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            <Clock className="w-3 h-3" />
            Ended
          </span>
        );
      case "SOLD":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <CheckCircle2 className="w-3 h-3" />
            Sold
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <AlertCircle className="w-3 h-3" />
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {listingStatus}
          </span>
        );
    }
  };

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="container-wide py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">My Listings</h1>
            <p className="text-zinc-500 mt-1">Manage your project listings</p>
          </div>
          <Link href="/create" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Listing
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {listings.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No listings yet</h3>
            <p className="text-zinc-500 mt-2 mb-6">Create your first listing to start selling</p>
            <Link href="/create" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Create Listing
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0">
                    {listing.thumbnailUrl ? (
                      <Image
                        src={listing.thumbnailUrl}
                        alt={listing.title}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-zinc-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/listing/${listing.slug}`}
                          className="text-lg font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {listing.title}
                        </Link>
                        {listing.tagline && (
                          <p className="text-sm text-zinc-500 mt-1 truncate">{listing.tagline}</p>
                        )}
                      </div>
                      {getStatusBadge(listing.status)}
                    </div>

                    <div className="flex items-center gap-6 mt-3 text-sm">
                      <span className="text-zinc-500">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {listing.startingPrice} {listing.currency}
                        </span>
                        {" "}starting price
                      </span>
                      {listing._count && (
                        <span className="text-zinc-500">
                          {listing._count.bids} bids
                        </span>
                      )}
                      {listing.status === "ACTIVE" && (
                        <span className="text-zinc-500">
                          {formatTimeRemaining(listing.endTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/listing/${listing.slug}`}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      title="View listing"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <button
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      title="Edit listing"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
