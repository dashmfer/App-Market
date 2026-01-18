"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, Gavel, ShoppingCart, Heart, CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ListingCardProps {
  listing: {
    id: string;
    slug: string;
    title: string;
    tagline?: string;
    thumbnailUrl?: string;
    category: string;
    techStack?: string[];
    currentBid?: number;
    startingPrice?: number;
    buyNowPrice?: number;
    buyNowEnabled?: boolean;
    currency?: string;
    endTime: string | Date;
    bidCount?: number;
    _count?: { bids: number };
    watchlistId?: string;
    seller?: {
      id?: string;
      name?: string;
      displayName?: string;
      username?: string;
      image?: string;
      rating?: number;
      verified?: boolean;
      isVerified?: boolean;
    };
  };
  index?: number;
  initialWatchlisted?: boolean;
}

// Helper to get currency display label
const getCurrencyLabel = (currency?: string): string => {
  switch (currency) {
    case "APP":
      return "$APP";
    case "USDC":
      return "USDC";
    default:
      return "SOL";
  }
};

export function ListingCard({ listing, index = 0, initialWatchlisted }: ListingCardProps) {
  const [isWatchlisted, setIsWatchlisted] = useState(initialWatchlisted || !!listing.watchlistId);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsWatchlistLoading(true);
    try {
      if (isWatchlisted) {
        // Remove from watchlist
        const response = await fetch(`/api/watchlist?listingId=${listing.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setIsWatchlisted(false);
          toast.success("Removed from watchlist");
        } else {
          const data = await response.json();
          if (response.status === 401) {
            toast.error("Please sign in to manage your watchlist");
          } else {
            throw new Error(data.error || "Failed to remove from watchlist");
          }
        }
      } else {
        // Add to watchlist
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id }),
        });

        if (response.ok) {
          setIsWatchlisted(true);
          toast.success("Added to watchlist");
        } else {
          const data = await response.json();
          if (response.status === 401) {
            toast.error("Please sign in to manage your watchlist");
          } else if (data.error === "Already in watchlist") {
            setIsWatchlisted(true);
          } else {
            throw new Error(data.error || "Failed to add to watchlist");
          }
        }
      }
    } catch (error) {
      console.error("Watchlist error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsWatchlistLoading(false);
    }
  };

  // Convert endTime to Date if it's a string
  const endDate = typeof listing.endTime === 'string' ? new Date(listing.endTime) : listing.endTime;
  const timeLeft = formatDistanceToNow(endDate, { addSuffix: false });
  const isEndingSoon = endDate.getTime() - Date.now() < 86400000; // 24 hours

  // Check if this is a Buy Now only listing
  const isBuyNowOnly = listing.buyNowEnabled && (!listing.startingPrice || listing.startingPrice <= 0);

  // Get current bid or starting price (for Buy Now only, show the buy now price)
  const displayPrice = isBuyNowOnly
    ? (listing.buyNowPrice || 0)
    : (listing.currentBid || listing.startingPrice || 0);
  const bidCount = listing.bidCount || listing._count?.bids || 0;

  // Get seller display name
  const sellerName = listing.seller?.displayName || listing.seller?.name || listing.seller?.username || "Anonymous";

  const categoryLabels: Record<string, string> = {
    SAAS: "SaaS",
    AI_ML: "AI & ML",
    MOBILE_APP: "Mobile App",
    WEB_APP: "Web App",
    BROWSER_EXTENSION: "Extension",
    CRYPTO_WEB3: "Crypto",
    ECOMMERCE: "E-commerce",
    DEVELOPER_TOOLS: "Dev Tools",
    OTHER: "Other",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link href={`/listing/${listing.slug}`} className="block group">
        <div className="card-hover overflow-hidden">
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            {listing.thumbnailUrl && !imageError ? (
              <Image
                src={listing.thumbnailUrl}
                alt={listing.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-4xl">
                  {categoryLabels[listing.category]?.[0] || "📦"}
                </div>
              </div>
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Category Badge */}
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {categoryLabels[listing.category] || listing.category}
              </span>
            </div>

            {/* Watchlist Button */}
            <button
              onClick={handleWatchlistToggle}
              disabled={isWatchlistLoading}
              className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200 ${
                isWatchlisted
                  ? "bg-red-500 text-white"
                  : "bg-white/90 dark:bg-black/70 backdrop-blur-sm text-zinc-600 dark:text-zinc-400 hover:text-red-500"
              } ${isWatchlistLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isWatchlistLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Heart className={`w-4 h-4 ${isWatchlisted ? "fill-current" : ""}`} />
              )}
            </button>

            {/* Ending Soon Badge */}
            {isEndingSoon && (
              <div className="absolute bottom-3 left-3 right-3">
                <div className="px-3 py-1.5 rounded-full bg-yellow-500/90 backdrop-blur-sm text-yellow-900 text-xs font-medium flex items-center gap-1.5 w-fit">
                  <Clock className="w-3.5 h-3.5" />
                  Ending soon
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Title & Tagline */}
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors line-clamp-1">
              {listing.title}
            </h3>
            {listing.tagline && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
                {listing.tagline}
              </p>
            )}

            {/* Tech Stack */}
            {listing.techStack && listing.techStack.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {listing.techStack.slice(0, 3).map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    {tech}
                  </span>
                ))}
                {listing.techStack.length > 3 && (
                  <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                    +{listing.techStack.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Seller */}
            {listing.seller && (
              <div className="mt-4 flex items-center gap-2">
                {listing.seller.image ? (
                  <Image
                    src={listing.seller.image}
                    alt={sellerName}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-white">
                      {sellerName[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {sellerName}
                </span>
                {(listing.seller.verified || listing.seller.isVerified) && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                {listing.seller.rating && (
                  <span className="text-sm text-zinc-400">
                    {listing.seller.rating}★
                  </span>
                )}
              </div>
            )}

            {/* Price & Actions */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                {isBuyNowOnly ? (
                  /* Buy Now Only Listing */
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                      <ShoppingCart className="w-4 h-4" />
                      <span>Buy Now</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-semibold text-green-600 dark:text-green-400">
                        {listing.buyNowPrice}
                      </span>
                      <span className="text-sm text-zinc-500">{getCurrencyLabel(listing.currency)}</span>
                    </div>
                  </div>
                ) : (
                  /* Auction Listing */
                  <>
                    <div>
                      <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        <Gavel className="w-4 h-4" />
                        <span>{bidCount} bids</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                          {displayPrice}
                        </span>
                        <span className="text-sm text-zinc-500">{getCurrencyLabel(listing.currency)}</span>
                      </div>
                    </div>

                    {listing.buyNowPrice && (
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                          <ShoppingCart className="w-4 h-4" />
                          <span>Buy Now</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1 justify-end">
                          <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {listing.buyNowPrice}
                          </span>
                          <span className="text-sm text-zinc-500">{getCurrencyLabel(listing.currency)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Time Left */}
              <div className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500">
                <Clock className="w-4 h-4" />
                <span suppressHydrationWarning>{timeLeft} left</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
