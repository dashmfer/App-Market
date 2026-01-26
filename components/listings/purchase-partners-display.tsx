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
  Clock,
  CheckCircle2,
  Wallet,
} from "lucide-react";

interface PartnerUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  isVerified?: boolean;
}

interface PurchasePartner {
  id: string;
  walletAddress: string;
  percentage: number;
  isLead: boolean;
  depositStatus?: "PENDING" | "DEPOSITED" | "REFUNDED";
  depositAmount?: number;
  user: PartnerUser | null;
}

interface PurchasePartnersDisplayProps {
  partners: PurchasePartner[];
  className?: string;
  compact?: boolean;
  showPending?: boolean; // Whether to show pending partners
}

export function PurchasePartnersDisplay({
  partners,
  className = "",
  compact = false,
  showPending = true,
}: PurchasePartnersDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (!partners || partners.length === 0) {
    return null;
  }

  const getDisplayName = (partner: PurchasePartner) => {
    if (partner.user?.displayName) return partner.user.displayName;
    if (partner.user?.username) return `@${partner.user.username}`;
    if (partner.user?.name) return partner.user.name;
    // Handle truncated wallet (already truncated from API)
    if (partner.walletAddress.includes("...")) return partner.walletAddress;
    return `${partner.walletAddress.slice(0, 4)}...${partner.walletAddress.slice(-4)}`;
  };

  // Get profile link
  const getProfileLink = (partner: PurchasePartner) => {
    if (partner.user?.username) return `/user/${partner.user.username}`;
    if (partner.user?.id) return `/user/${partner.user.id}`;
    return null;
  };

  // Filter partners based on showPending
  const filteredPartners = showPending
    ? partners
    : partners.filter(p => p.depositStatus !== "PENDING");

  // Sort partners - lead first, then deposited, then pending, then by percentage
  const sortedPartners = [...filteredPartners].sort((a, b) => {
    if (a.isLead && !b.isLead) return -1;
    if (!a.isLead && b.isLead) return 1;
    // Deposited before pending
    if (a.depositStatus === "DEPOSITED" && b.depositStatus === "PENDING") return -1;
    if (a.depositStatus === "PENDING" && b.depositStatus === "DEPOSITED") return 1;
    return b.percentage - a.percentage;
  });

  const depositedPartners = sortedPartners.filter(p => p.depositStatus === "DEPOSITED" || !p.depositStatus);
  const pendingPartners = sortedPartners.filter(p => p.depositStatus === "PENDING");
  const pendingCount = pendingPartners.length;
  const totalMembers = depositedPartners.length;

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
              {totalMembers} {totalMembers === 1 ? "buyer" : "buyers"}
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  ({pendingCount} pending)
                </span>
              )}
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
                {sortedPartners.map((partner) => {
                  const isPending = partner.depositStatus === "PENDING";
                  return (
                    <div
                      key={partner.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        isPending
                          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30"
                          : "bg-zinc-50 dark:bg-zinc-800/50"
                      }`}
                    >
                      <div className={`relative w-6 h-6 rounded-full overflow-hidden shrink-0 ${
                        isPending
                          ? "bg-amber-200 dark:bg-amber-800"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}>
                        {partner.user?.image ? (
                          <Image
                            src={partner.user.image}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-xs ${
                            isPending ? "text-amber-600" : "text-zinc-400"
                          }`}>
                            {getDisplayName(partner).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={`text-sm truncate flex-1 ${
                        isPending
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        {getDisplayName(partner)}
                      </span>
                      {partner.isLead && (
                        <Crown className="w-3 h-3 text-amber-500" />
                      )}
                      {isPending && (
                        <Clock className="w-3 h-3 text-amber-500" />
                      )}
                      <span className={`text-xs ${
                        isPending ? "text-amber-600" : "text-zinc-500"
                      }`}>
                        {partner.percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full display - similar to CollaboratorDisplay
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Purchase Partners</h3>
            <p className="text-sm text-zinc-500">
              {totalMembers} {totalMembers === 1 ? "buyer" : "buyers"}
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-600">
                  ({pendingCount} pending deposit{pendingCount !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 space-y-3">
              {/* Progress bar showing ownership split */}
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
                {pendingPartners.map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-amber-400 transition-all duration-300"
                    style={{ width: `${partner.percentage}%` }}
                    title={`${getDisplayName(partner)} (Pending): ${partner.percentage}%`}
                  />
                ))}
                {depositedPartners.map((partner, index) => {
                  const colors = [
                    "bg-blue-500",
                    "bg-green-500",
                    "bg-purple-500",
                    "bg-pink-500",
                    "bg-cyan-500",
                  ];
                  return (
                    <div
                      key={partner.id}
                      className={`${colors[index % colors.length]} transition-all duration-300`}
                      style={{ width: `${partner.percentage}%` }}
                      title={`${getDisplayName(partner)}: ${partner.percentage}%`}
                    />
                  );
                })}
              </div>

              {/* Partner rows */}
              {sortedPartners.map((partner, index) => (
                <PartnerMemberRow
                  key={partner.id}
                  partner={partner}
                  profileLink={getProfileLink(partner)}
                  colorIndex={index}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Partner member row component
function PartnerMemberRow({
  partner,
  profileLink,
  colorIndex,
}: {
  partner: PurchasePartner;
  profileLink: string | null;
  colorIndex: number;
}) {
  const isPending = partner.depositStatus === "PENDING";

  const displayName = partner.user?.displayName || partner.user?.username || partner.user?.name ||
    (partner.walletAddress.includes("...")
      ? partner.walletAddress
      : `${partner.walletAddress.slice(0, 4)}...${partner.walletAddress.slice(-4)}`);

  // Get background color class based on status
  const getBackgroundClass = () => {
    if (isPending) {
      return "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30";
    }
    if (partner.isLead) {
      return "bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30";
    }
    // Alternate colors for other partners
    const bgColors = [
      "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30",
      "bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30",
      "bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800/30",
      "bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800/30",
    ];
    return bgColors[colorIndex % bgColors.length];
  };

  // Get avatar gradient class based on status
  const getAvatarGradientClass = () => {
    if (isPending) {
      return "bg-gradient-to-br from-amber-400 to-yellow-500";
    }
    if (partner.isLead) {
      return "bg-gradient-to-br from-blue-400 to-blue-500";
    }
    const gradients = [
      "bg-gradient-to-br from-green-400 to-emerald-500",
      "bg-gradient-to-br from-purple-400 to-purple-500",
      "bg-gradient-to-br from-pink-400 to-pink-500",
      "bg-gradient-to-br from-cyan-400 to-cyan-500",
    ];
    return gradients[colorIndex % gradients.length];
  };

  // Get badge color class based on status
  const getBadgeClass = () => {
    if (isPending) {
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    }
    if (partner.isLead) {
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    }
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  };

  // Get percentage color class based on status
  const getPercentageClass = () => {
    if (isPending) {
      return "text-amber-600 dark:text-amber-400";
    }
    if (partner.isLead) {
      return "text-blue-600 dark:text-blue-400";
    }
    const colors = [
      "text-green-600 dark:text-green-400",
      "text-purple-600 dark:text-purple-400",
      "text-pink-600 dark:text-pink-400",
      "text-cyan-600 dark:text-cyan-400",
    ];
    return colors[colorIndex % colors.length];
  };

  const content = (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
      profileLink ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" : ""
    } ${getBackgroundClass()}`}>
      {/* Avatar */}
      {partner.user?.image ? (
        <Image
          src={partner.user.image}
          alt={displayName}
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getAvatarGradientClass()}`}>
          <span className="text-sm font-medium text-white">
            {displayName[0].toUpperCase()}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {displayName}
          </span>
          {partner.user?.isVerified && (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          {isPending && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${getBadgeClass()}`}>
            {partner.isLead ? (
              <>
                <Crown className="w-3 h-3 inline mr-1" />
                Lead Buyer
              </>
            ) : (
              <>
                <Users className="w-3 h-3 inline mr-1" />
                Partner
              </>
            )}
          </span>
          {partner.depositAmount && isPending && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {partner.depositAmount} SOL to deposit
            </span>
          )}
        </div>
      </div>

      {/* Percentage */}
      <div className={`flex items-center gap-1 text-sm font-semibold ${getPercentageClass()}`}>
        {partner.percentage}
        <Percent className="w-3.5 h-3.5" />
      </div>
    </div>
  );

  if (profileLink) {
    return <Link href={profileLink}>{content}</Link>;
  }

  return content;
}
