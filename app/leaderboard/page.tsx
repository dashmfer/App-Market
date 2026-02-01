"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, Star, ShoppingBag, Package, CheckCircle2, Award, Loader2, TrendingUp } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isVerified: boolean;
  totalSales?: number;
  totalPurchases?: number;
  rating: number;
  ratingCount: number;
  sellerLevel?: string;
  successRate?: number;
  memberSince: string;
}

type LeaderboardType = "sellers" | "buyers" | "rated";

export default function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>("sellers");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const response = await fetch(`/api/leaderboard?type=${type}&limit=25`);
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [type]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-yellow-400 text-yellow-900";
    if (rank === 2) return "bg-zinc-300 text-zinc-700";
    if (rank === 3) return "bg-orange-400 text-orange-900";
    return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
  };

  const getSellerLevelColor = (level: string | undefined) => {
    switch (level) {
      case "GOLD":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "SILVER":
        return "text-zinc-600 bg-zinc-100 dark:bg-zinc-700/30 dark:text-zinc-300";
      case "BRONZE":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                Leaderboard
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Top performers on App Market
              </p>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="flex gap-2 mt-8">
            <button
              onClick={() => setType("sellers")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                type === "sellers"
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Top Sellers
            </button>
            <button
              onClick={() => setType("buyers")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                type === "buyers"
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              <Package className="w-4 h-4" />
              Top Buyers
            </button>
            <button
              onClick={() => setType("rated")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                type === "rated"
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              <Star className="w-4 h-4" />
              Top Rated
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-wide py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No rankings yet
            </h2>
            <p className="text-zinc-500">
              Be the first to make it to the leaderboard!
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Top 3 Highlight */}
            {leaderboard.length >= 3 && (
              <div className="p-6 bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 0, 2].map((idx) => {
                    const entry = leaderboard[idx];
                    if (!entry) return null;
                    const isFirst = idx === 0;
                    return (
                      <Link
                        key={entry.id}
                        href={entry.username ? `/user/${entry.username}` : `/user/${entry.id}`}
                        className={`flex flex-col items-center p-4 rounded-xl transition-colors hover:bg-white/50 dark:hover:bg-zinc-700/50 ${
                          isFirst ? "order-2" : idx === 1 ? "order-1" : "order-3"
                        }`}
                      >
                        <div className="relative">
                          <div className={`w-16 h-16 ${isFirst ? "w-20 h-20" : ""} rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center overflow-hidden ring-4 ${
                            entry.rank === 1 ? "ring-yellow-400" : entry.rank === 2 ? "ring-zinc-300" : "ring-orange-400"
                          }`}>
                            {entry.image ? (
                              <Image src={entry.image} alt="" width={80} height={80} className="w-full h-full object-cover" />
                            ) : (
                              <span className={`${isFirst ? "text-2xl" : "text-xl"} font-medium text-white`}>
                                {(entry.displayName || entry.username || "A")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadge(entry.rank)}`}>
                            {entry.rank}
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {entry.displayName || entry.username || "Anonymous"}
                            </span>
                            {entry.isVerified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          </div>
                          {type === "sellers" && (
                            <p className="text-sm text-zinc-500 mt-1">{entry.totalSales} sales</p>
                          )}
                          {type === "buyers" && (
                            <p className="text-sm text-zinc-500 mt-1">{entry.totalPurchases} purchases</p>
                          )}
                          {type === "rated" && (
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                              <span className="text-sm font-medium">{entry.rating.toFixed(1)}</span>
                              <span className="text-xs text-zinc-500">({entry.ratingCount})</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full List */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {leaderboard.slice(leaderboard.length >= 3 ? 3 : 0).map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.username ? `/user/${entry.username}` : `/user/${entry.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadge(entry.rank)}`}>
                    {entry.rank}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center overflow-hidden">
                    {entry.image ? (
                      <Image src={entry.image} alt="" width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-medium text-white">
                        {(entry.displayName || entry.username || "A")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {entry.displayName || entry.username || "Anonymous"}
                      </span>
                      {entry.isVerified && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      {entry.sellerLevel && entry.sellerLevel !== "NEW" && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getSellerLevelColor(entry.sellerLevel)}`}>
                          <Award className="w-3 h-3" />
                          {entry.sellerLevel}
                        </span>
                      )}
                    </div>
                    {entry.ratingCount > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm text-zinc-500">{entry.rating.toFixed(1)} ({entry.ratingCount})</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {type === "sellers" && (
                      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <ShoppingBag className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold">{entry.totalSales}</span>
                        <span className="text-zinc-500 text-sm">sales</span>
                      </div>
                    )}
                    {type === "buyers" && (
                      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <Package className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold">{entry.totalPurchases}</span>
                        <span className="text-zinc-500 text-sm">purchases</span>
                      </div>
                    )}
                    {type === "rated" && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= Math.round(entry.rating)
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-zinc-300 dark:text-zinc-600"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.successRate !== undefined && entry.successRate > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1 justify-end">
                        <TrendingUp className="w-3 h-3" />
                        <span>{entry.successRate}% success</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
