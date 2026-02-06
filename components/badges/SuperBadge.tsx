"use client";

import { Star, Award, ShoppingBag, TrendingUp } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface SuperBadgeProps {
  type: "seller" | "buyer";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  // Stats for tooltip
  totalTransactions?: number;
  rating?: number;
}

export function SuperBadge({
  type,
  size = "md",
  showLabel = false,
  totalTransactions,
  rating,
}: SuperBadgeProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const badgeSizes = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  const tooltipContent = `Super ${type === "seller" ? "Seller" : "Buyer"}: ${totalTransactions || "5+"}+ completed ${type === "seller" ? "sales" : "purchases"}${rating ? ` with ${Number(rating).toFixed(1)}+ rating` : ""}`;

  if (type === "seller") {
    return (
      <Tooltip content={tooltipContent}>
        <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium ${badgeSizes[size]}`}>
          <Star className={`${sizeClasses[size]} fill-current`} />
          {showLabel && "Super Seller"}
        </span>
      </Tooltip>
    );
  }

  // Super Buyer
  return (
    <Tooltip content={tooltipContent}>
      <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium ${badgeSizes[size]}`}>
        <Award className={`${sizeClasses[size]} fill-current`} />
        {showLabel && "Super Buyer"}
      </span>
    </Tooltip>
  );
}

interface UserBadgesProps {
  user: {
    isVerified?: boolean;
    isSuperSeller?: boolean;
    isSuperBuyer?: boolean;
    twitterVerified?: boolean;
    githubUsername?: string;
    totalSales?: number;
    totalPurchases?: number;
    rating?: number;
  };
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

export function UserBadges({ user, size = "md", showLabels = false }: UserBadgesProps) {
  const badges = [];

  // Super Seller badge (5+ completed sales with 4.5+ rating)
  if (user.isSuperSeller) {
    badges.push(
      <SuperBadge
        key="super-seller"
        type="seller"
        size={size}
        showLabel={showLabels}
        totalTransactions={user.totalSales}
        rating={user.rating}
      />
    );
  }

  // Super Buyer badge (5+ completed purchases with 4.5+ rating)
  if (user.isSuperBuyer) {
    badges.push(
      <SuperBadge
        key="super-buyer"
        type="buyer"
        size={size}
        showLabel={showLabels}
        totalTransactions={user.totalPurchases}
        rating={user.rating}
      />
    );
  }

  // Verified badge
  if (user.isVerified) {
    badges.push(
      <Tooltip key="verified" content="Verified User">
        <span className={`inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ${size === "sm" ? "text-xs px-1.5 py-0.5" : size === "lg" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5"}`}>
          <TrendingUp className={size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} />
          {showLabels && "Verified"}
        </span>
      </Tooltip>
    );
  }

  // Twitter verified
  if (user.twitterVerified) {
    badges.push(
      <Tooltip key="twitter" content="Twitter Verified">
        <span className={`inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 ${size === "sm" ? "text-xs px-1.5 py-0.5" : size === "lg" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5"}`}>
          <svg className={size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {showLabels && "Twitter"}
        </span>
      </Tooltip>
    );
  }

  // GitHub connected
  if (user.githubUsername) {
    badges.push(
      <Tooltip key="github" content={`GitHub: @${user.githubUsername}`}>
        <span className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ${size === "sm" ? "text-xs px-1.5 py-0.5" : size === "lg" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5"}`}>
          <svg className={size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          {showLabels && "GitHub"}
        </span>
      </Tooltip>
    );
  }

  if (badges.length === 0) return null;

  return <div className="inline-flex items-center gap-1 flex-wrap">{badges}</div>;
}
