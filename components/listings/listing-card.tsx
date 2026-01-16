"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, Gavel, ShoppingCart, Heart, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
    endTime: string | Date;
    bidCount?: number;
    _count?: { bids: number };
    seller?: {
      name?: string;
      username?: string;
      rating?: number;
      verified?: boolean;
    };
  };
  index?: number;
}

export function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Convert endTime to Date if it's a string
  const endDate = typeof listing.endTime === 'string' ? new Date(listing.endTime) : listing.endTime;
  const timeLeft = formatDistanceToNow(endDate, { addSuffix: false });
  const isEndingSoon = endDate.getTime() - Date.now() < 86400000; // 24 hours

  // Get current bid or starting price
  const displayPrice = listing.currentBid || listing.startingPrice || 0;
  const bidCount = listing.bidCount || listing._count?.bids || 0;

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
              onClick={(e) => {
                e.preventDefault();
                setIsWatchlisted(!isWatchlisted);
              }}
              className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200 ${
                isWatchlisted
                  ? "bg-red-500 text-white"
                  : "bg-white/90 dark:bg-black/70 backdrop-blur-sm text-zinc-600 dark:text-zinc-400 hover:text-red-500"
              }`}
            >
              <Heart className={`w-4 h-4 ${isWatchlisted ? "fill-current" : ""}`} />
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
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white">
                    {(listing.seller.name || listing.seller.username || "?")[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {listing.seller.name || listing.seller.username || "Anonymous"}
                </span>
                {listing.seller.verified && (
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
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    <Gavel className="w-4 h-4" />
                    <span>{bidCount} bids</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {displayPrice}
                    </span>
                    <span className="text-sm text-zinc-500">SOL</span>
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
                      <span className="text-sm text-zinc-500">SOL</span>
                    </div>
                  </div>
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
