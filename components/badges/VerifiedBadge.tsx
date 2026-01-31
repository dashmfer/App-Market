"use client";

import { CheckCircle2, Github, Twitter } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  type: "user" | "listing";
  size?: "sm" | "md" | "lg";
  // For user verification
  twitterVerified?: boolean;
  githubVerified?: boolean;
  // For listing verification
  hasGithub?: boolean;
  hasVercel?: boolean;
  // General verified flag
  isVerified?: boolean;
  showLabel?: boolean;
}

// Vercel icon
const VercelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 76 65" fill="currentColor">
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
  </svg>
);

export function VerifiedBadge({
  type,
  size = "md",
  twitterVerified,
  githubVerified,
  hasGithub,
  hasVercel,
  isVerified,
  showLabel = false,
}: VerifiedBadgeProps) {
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

  if (type === "user") {
    // User verification badges
    const badges = [];

    if (isVerified) {
      badges.push(
        <Tooltip key="verified" content="Verified User">
          <span className={`inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ${badgeSizes[size]}`}>
            <CheckCircle2 className={sizeClasses[size]} />
            {showLabel && "Verified"}
          </span>
        </Tooltip>
      );
    }

    if (twitterVerified) {
      badges.push(
        <Tooltip key="twitter" content="Twitter Verified">
          <span className={`inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 ${badgeSizes[size]}`}>
            <Twitter className={sizeClasses[size]} />
            {showLabel && "Twitter"}
          </span>
        </Tooltip>
      );
    }

    if (githubVerified) {
      badges.push(
        <Tooltip key="github" content="GitHub Connected">
          <span className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ${badgeSizes[size]}`}>
            <Github className={sizeClasses[size]} />
            {showLabel && "GitHub"}
          </span>
        </Tooltip>
      );
    }

    if (badges.length === 0) return null;

    return <div className="inline-flex items-center gap-1 flex-wrap">{badges}</div>;
  }

  // Listing verification badges
  if (type === "listing") {
    const badges = [];

    if (hasGithub) {
      badges.push(
        <Tooltip key="github" content="GitHub Repository Verified">
          <span className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ${badgeSizes[size]}`}>
            <Github className={sizeClasses[size]} />
            {showLabel && "GitHub"}
          </span>
        </Tooltip>
      );
    }

    if (hasVercel) {
      badges.push(
        <Tooltip key="vercel" content="Vercel Project Included">
          <span className={`inline-flex items-center gap-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 ${badgeSizes[size]}`}>
            <VercelIcon className={sizeClasses[size]} />
            {showLabel && "Vercel"}
          </span>
        </Tooltip>
      );
    }

    if (badges.length === 0) return null;

    return <div className="inline-flex items-center gap-1 flex-wrap">{badges}</div>;
  }

  return null;
}
