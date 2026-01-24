"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Crown,
  ChevronDown,
  ChevronUp,
  Percent,
  ExternalLink,
} from "lucide-react";

interface PartnerUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
}

interface PurchasePartner {
  id: string;
  walletAddress: string;
  percentage: number;
  isLead: boolean;
  user: PartnerUser | null;
}

interface PurchasePartnersDisplayProps {
  partners: PurchasePartner[];
  className?: string;
  compact?: boolean;
}

export function PurchasePartnersDisplay({
  partners,
  className = "",
  compact = false,
}: PurchasePartnersDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (!partners || partners.length === 0) {
    return null;
  }

  const getDisplayName = (partner: PurchasePartner) => {
    if (partner.user?.displayName) return partner.user.displayName;
    if (partner.user?.username) return `@${partner.user.username}`;
    if (partner.user?.name) return partner.user.name;
    return `${partner.walletAddress.slice(0, 4)}...${partner.walletAddress.slice(-4)}`;
  };

  // Sort partners - lead first, then by percentage
  const sortedPartners = [...partners].sort((a, b) => {
    if (a.isLead && !b.isLead) return -1;
    if (!a.isLead && b.isLead) return 1;
    return b.percentage - a.percentage;
  });

  if (compact) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Purchased by {partners.length} {partners.length === 1 ? "buyer" : "buyers"}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-blue-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-500" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {sortedPartners.map((partner) => (
                  <div
                    key={partner.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                  >
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                      {partner.user?.image ? (
                        <Image
                          src={partner.user.image}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
                          {getDisplayName(partner).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {getDisplayName(partner)}
                    </span>
                    {partner.isLead && (
                      <Crown className="w-3 h-3 text-amber-500" />
                    )}
                    <span className="text-xs text-zinc-500">
                      {partner.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full display
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-zinc-900 dark:text-white">
          Purchase Partners
        </h3>
        <span className="text-sm text-zinc-500">
          ({partners.length} {partners.length === 1 ? "buyer" : "buyers"})
        </span>
      </div>

      <div className="space-y-3">
        {sortedPartners.map((partner) => (
          <div
            key={partner.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
          >
            {/* Avatar */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
              {partner.user?.image ? (
                <Image
                  src={partner.user.image}
                  alt={getDisplayName(partner)}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <Users className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {partner.user?.username ? (
                  <Link
                    href={`/user/${partner.user.username}`}
                    className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                  >
                    {getDisplayName(partner)}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900 dark:text-white truncate">
                    {getDisplayName(partner)}
                  </span>
                )}
                {partner.isLead && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                    <Crown className="w-3 h-3" />
                    Lead
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {partner.walletAddress}
              </p>
            </div>

            {/* Percentage */}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Percent className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {partner.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar visualization */}
      <div className="mt-4">
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700">
          {sortedPartners.map((partner, index) => {
            const colors = [
              "bg-blue-500",
              "bg-green-500",
              "bg-purple-500",
              "bg-amber-500",
              "bg-pink-500",
              "bg-cyan-500",
            ];
            return (
              <div
                key={partner.id}
                className={`${colors[index % colors.length]} transition-all`}
                style={{ width: `${partner.percentage}%` }}
                title={`${getDisplayName(partner)}: ${partner.percentage}%`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
