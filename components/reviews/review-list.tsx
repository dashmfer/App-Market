"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare, ShoppingBag, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";

interface Review {
  id: string;
  type: "TRANSACTION" | "MESSAGING";
  role: "BUYER" | "SELLER";
  rating: number;
  communicationRating?: number;
  speedRating?: number;
  accuracyRating?: number;
  comment?: string;
  createdAt: string;
  author: {
    id: string;
    username?: string;
    displayName?: string;
    image?: string;
    isVerified: boolean;
    twitterUsername?: string;
    twitterVerified: boolean;
  };
  transaction?: {
    id: string;
    listing: {
      id: string;
      title: string;
      slug: string;
    };
  };
}

interface ReviewStats {
  averageRating: number;
  averageCommunication: number;
  averageSpeed: number;
  averageAccuracy: number;
  totalReviews: number;
}

interface ReviewListProps {
  userId: string;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? "text-yellow-400 fill-yellow-400"
              : "text-zinc-300 dark:text-zinc-600"
          }`}
        />
      ))}
    </div>
  );
}

function CriteriaRating({ label, rating }: { label: string; rating: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <StarRating rating={rating} />
        <span className="text-zinc-500 w-6 text-right">{rating.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function ReviewList({ userId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      try {
        const response = await fetch(`/api/reviews?userId=${userId}&page=${page}`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews);
          setStats(data.stats);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, [userId, page]);

  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && stats.totalReviews > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Overall Rating */}
            <div className="text-center md:text-left md:pr-6 md:border-r border-zinc-200 dark:border-zinc-700">
              <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                {stats.averageRating.toFixed(1)}
              </div>
              <StarRating rating={Math.round(stats.averageRating)} size="lg" />
              <div className="text-sm text-zinc-500 mt-1">
                {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
              </div>
            </div>

            {/* Criteria Breakdown */}
            <div className="flex-1 space-y-2">
              {stats.averageCommunication > 0 && (
                <CriteriaRating label="Communication" rating={stats.averageCommunication} />
              )}
              {stats.averageSpeed > 0 && (
                <CriteriaRating label="Speed" rating={stats.averageSpeed} />
              )}
              {stats.averageAccuracy > 0 && (
                <CriteriaRating label="Accuracy" rating={stats.averageAccuracy} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-12">
          <Star className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center overflow-hidden">
                    {review.author.image ? (
                      <Image
                        src={review.author.image}
                        alt={review.author.displayName || review.author.username || "User"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-white">
                        {(review.author.displayName || review.author.username || "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/user/${review.author.username}`}
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600"
                      >
                        {review.author.displayName || review.author.username || "Anonymous"}
                      </Link>
                      {review.author.twitterVerified && review.author.twitterUsername && (
                        <span className="text-xs text-blue-500">@{review.author.twitterUsername}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      {review.type === "TRANSACTION" ? (
                        <ShoppingBag className="w-3 h-3" />
                      ) : (
                        <MessageSquare className="w-3 h-3" />
                      )}
                      <span>
                        {review.role === "BUYER" ? "Bought from" : "Sold to"} this user
                      </span>
                      <span>-</span>
                      <span>
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <StarRating rating={review.rating} />
              </div>

              {/* Transaction Link */}
              {review.transaction && (
                <Link
                  href={`/listing/${review.transaction.listing.slug}`}
                  className="mt-3 inline-block text-sm text-emerald-600 hover:text-emerald-700"
                >
                  Re: {review.transaction.listing.title}
                </Link>
              )}

              {/* Comment */}
              {review.comment && (
                <p className="mt-3 text-zinc-700 dark:text-zinc-300">{review.comment}</p>
              )}

              {/* Criteria Ratings */}
              {(review.communicationRating || review.speedRating || review.accuracyRating) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {review.communicationRating && (
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Communication:</span>
                      <StarRating rating={review.communicationRating} />
                    </div>
                  )}
                  {review.speedRating && (
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Speed:</span>
                      <StarRating rating={review.speedRating} />
                    </div>
                  )}
                  {review.accuracyRating && (
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Accuracy:</span>
                      <StarRating rating={review.accuracyRating} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-zinc-500">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
