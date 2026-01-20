"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Gift, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { ListingCard } from "@/components/listings/listing-card";

interface ReservedListing {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  thumbnailUrl?: string;
  category: string;
  techStack?: string[];
  startingPrice?: number;
  buyNowPrice?: number;
  buyNowEnabled?: boolean;
  currency?: string;
  endTime: string;
  currentBid?: number;
  _count?: { bids: number };
  reservedAt?: string;
  reservationInfo?: {
    isReserved: boolean;
    isReservedForCurrentUser: boolean;
  };
  seller?: {
    id: string;
    name?: string;
    displayName?: string;
    username?: string;
    image?: string;
    isVerified?: boolean;
  };
}

export default function PurchasesPage() {
  const [reservedListings, setReservedListings] = useState<ReservedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const purchases: any[] = []; // TODO: Load completed purchases from database

  useEffect(() => {
    async function fetchReservedListings() {
      try {
        const response = await fetch("/api/listings/reserved");
        if (response.ok) {
          const data = await response.json();
          setReservedListings(data.listings || []);
        }
      } catch (error) {
        console.error("Failed to fetch reserved listings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReservedListings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const hasContent = reservedListings.length > 0 || purchases.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">My Purchases</h1>
          <p className="text-zinc-500 mt-1">Projects you've acquired and listings reserved for you</p>
        </div>

        {/* Reserved Listings Section */}
        {reservedListings.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Reserved For You
                </h2>
                <p className="text-sm text-zinc-500">
                  {reservedListings.length} {reservedListings.length === 1 ? 'listing has' : 'listings have'} been reserved for you
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {reservedListings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Purchases Section */}
        {purchases.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Completed Purchases
                </h2>
                <p className="text-sm text-zinc-500">
                  Projects you've successfully acquired
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  {/* Purchase item */}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasContent && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No purchases yet</h3>
            <p className="text-zinc-500 mt-2 mb-6">
              Browse the marketplace to find your next project.
              When sellers reserve listings for you, they'll appear here.
            </p>
            <Link href="/explore" className="btn-primary inline-flex">
              Explore Projects
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
