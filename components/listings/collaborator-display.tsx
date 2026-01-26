"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Crown,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Percent,
} from "lucide-react";

interface CollaboratorUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  isVerified: boolean;
  twitterUsername?: string | null;
  twitterVerified?: boolean;
}

interface Collaborator {
  id: string;
  walletAddress: string;
  role: "PARTNER" | "COLLABORATOR";
  roleDescription: string;
  customRoleDescription?: string | null;
  percentage: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  user: CollaboratorUser | null;
}

interface Seller {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  isVerified: boolean;
  rating?: number | null;
}

interface CollaboratorDisplayProps {
  seller: Seller;
  collaborators: Collaborator[];
  sellerPercentage: number;
  compact?: boolean;
}

// Role description labels
const ROLE_LABELS: Record<string, string> = {
  CO_FOUNDER: "Co-founder",
  DEVELOPER: "Developer",
  TECHNICAL_LEAD: "Technical Lead",
  CTO: "CTO",
  DESIGNER: "Designer",
  MARKETING: "Marketing",
  VIDEO_EDITOR: "Video Editor",
  CONSULTANT: "Consultant",
  ADVISOR: "Advisor",
  BRANDING: "Branding",
  COPYWRITER: "Copywriter",
  COMMUNITY_MANAGER: "Community Manager",
  OTHER: "Contributor",
};

export function CollaboratorDisplay({
  seller,
  collaborators,
  sellerPercentage,
  compact = false,
}: CollaboratorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Get display name for a user
  const getDisplayName = (user: CollaboratorUser | Seller | null, walletAddress?: string) => {
    if (user?.displayName) return user.displayName;
    if (user?.username) return `@${user.username}`;
    if (user?.name) return user.name;
    if (walletAddress) return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    return "Unknown";
  };

  // Get role label
  const getRoleLabel = (roleDescription: string, customRoleDescription?: string | null) => {
    if (roleDescription === "OTHER" && customRoleDescription) {
      return customRoleDescription;
    }
    return ROLE_LABELS[roleDescription] || roleDescription;
  };

  // Get profile link
  const getProfileLink = (user: CollaboratorUser | Seller | null) => {
    if (user?.username) return `/user/${user.username}`;
    if (user?.id) return `/user/${user.id}`;
    return null;
  };

  // Filter to only show accepted collaborators on listing page
  const acceptedCollaborators = collaborators.filter(c => c.status === "ACCEPTED");
  const pendingCollaborators = collaborators.filter(c => c.status === "PENDING");
  const pendingCount = pendingCollaborators.length;

  // If no collaborators, don't show anything
  if (acceptedCollaborators.length === 0 && pendingCount === 0) {
    return null;
  }

  const totalMembers = 1 + acceptedCollaborators.length; // Seller + accepted collaborators

  // Compact view - just avatars
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {/* Seller avatar */}
          {seller.image ? (
            <Image
              src={seller.image}
              alt={getDisplayName(seller)}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <span className="text-[10px] font-medium text-white">
                {getDisplayName(seller)[0].toUpperCase()}
              </span>
            </div>
          )}

          {/* Collaborator avatars */}
          {acceptedCollaborators.slice(0, 3).map((collab) => (
            collab.user?.image ? (
              <Image
                key={collab.id}
                src={collab.user.image}
                alt={getDisplayName(collab.user, collab.walletAddress)}
                width={28}
                height={28}
                className={`w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 object-cover ${
                  collab.role === "PARTNER" ? "ring-1 ring-blue-400" : "ring-1 ring-purple-400"
                }`}
              />
            ) : (
              <div
                key={collab.id}
                className={`w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center ${
                  collab.role === "PARTNER"
                    ? "bg-gradient-to-br from-blue-400 to-blue-500"
                    : "bg-gradient-to-br from-purple-400 to-purple-500"
                }`}
              >
                <span className="text-[10px] font-medium text-white">
                  {getDisplayName(collab.user, collab.walletAddress)[0].toUpperCase()}
                </span>
              </div>
            )
          ))}

          {/* More indicator */}
          {acceptedCollaborators.length > 3 && (
            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
              <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                +{acceptedCollaborators.length - 3}
              </span>
            </div>
          )}
        </div>

        <span className="text-sm text-zinc-500">
          {totalMembers} team member{totalMembers !== 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Team</h3>
            <p className="text-sm text-zinc-500">
              {totalMembers} member{totalMembers !== 1 ? "s" : ""}
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-600">
                  ({pendingCount} pending)
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
              {/* Progress bar showing revenue split */}
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
                <div
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${sellerPercentage}%` }}
                  title={`Owner: ${sellerPercentage}%`}
                />
                {pendingCollaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="bg-amber-400 transition-all duration-300"
                    style={{ width: `${collab.percentage}%` }}
                    title={`${getDisplayName(collab.user, collab.walletAddress)} (Pending): ${collab.percentage}%`}
                  />
                ))}
                {acceptedCollaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className={`transition-all duration-300 ${
                      collab.role === "PARTNER" ? "bg-blue-500" : "bg-purple-500"
                    }`}
                    style={{ width: `${collab.percentage}%` }}
                    title={`${getDisplayName(collab.user, collab.walletAddress)}: ${collab.percentage}%`}
                  />
                ))}
              </div>

              {/* Seller (Owner) */}
              <TeamMemberRow
                user={seller}
                role="OWNER"
                roleLabel="Owner"
                percentage={sellerPercentage}
                isOwner
                profileLink={getProfileLink(seller)}
              />

              {/* Pending Collaborators - shown right after owner in yellow */}
              {pendingCollaborators.map((collab) => (
                <TeamMemberRow
                  key={collab.id}
                  user={collab.user}
                  walletAddress={collab.walletAddress}
                  role={collab.role}
                  roleLabel={getRoleLabel(collab.roleDescription, collab.customRoleDescription)}
                  percentage={collab.percentage}
                  isPending
                  profileLink={collab.user ? getProfileLink(collab.user) : null}
                />
              ))}

              {/* Accepted Collaborators */}
              {acceptedCollaborators.map((collab) => (
                <TeamMemberRow
                  key={collab.id}
                  user={collab.user}
                  walletAddress={collab.walletAddress}
                  role={collab.role}
                  roleLabel={getRoleLabel(collab.roleDescription, collab.customRoleDescription)}
                  percentage={collab.percentage}
                  profileLink={collab.user ? getProfileLink(collab.user) : null}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Team member row component
function TeamMemberRow({
  user,
  walletAddress,
  role,
  roleLabel,
  percentage,
  isOwner = false,
  isPending = false,
  profileLink,
}: {
  user: CollaboratorUser | Seller | null;
  walletAddress?: string;
  role: "OWNER" | "PARTNER" | "COLLABORATOR";
  roleLabel: string;
  percentage: number;
  isOwner?: boolean;
  isPending?: boolean;
  profileLink: string | null;
}) {
  const displayName = user?.displayName || user?.username || user?.name ||
    (walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "Unknown");

  // Get background color class based on status
  const getBackgroundClass = () => {
    if (isPending) {
      return "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30";
    }
    if (isOwner) {
      return "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30";
    }
    if (role === "PARTNER") {
      return "bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30";
    }
    return "bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30";
  };

  // Get avatar gradient class based on status
  const getAvatarGradientClass = () => {
    if (isPending) {
      return "bg-gradient-to-br from-amber-400 to-yellow-500";
    }
    if (isOwner) {
      return "bg-gradient-to-br from-green-400 to-emerald-500";
    }
    if (role === "PARTNER") {
      return "bg-gradient-to-br from-blue-400 to-blue-500";
    }
    return "bg-gradient-to-br from-purple-400 to-purple-500";
  };

  // Get badge color class based on status
  const getBadgeClass = () => {
    if (isPending) {
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    }
    if (isOwner) {
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    }
    if (role === "PARTNER") {
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    }
    return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
  };

  // Get percentage color class based on status
  const getPercentageClass = () => {
    if (isPending) {
      return "text-amber-600 dark:text-amber-400";
    }
    if (isOwner) {
      return "text-green-600 dark:text-green-400";
    }
    if (role === "PARTNER") {
      return "text-blue-600 dark:text-blue-400";
    }
    return "text-purple-600 dark:text-purple-400";
  };

  const content = (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
      profileLink ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" : ""
    } ${getBackgroundClass()}`}>
      {/* Avatar */}
      {user?.image ? (
        <Image
          src={user.image}
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
          {user?.isVerified && (
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
            {isOwner ? (
              <Crown className="w-3 h-3 inline mr-1" />
            ) : role === "PARTNER" ? (
              <Crown className="w-3 h-3 inline mr-1" />
            ) : (
              <Briefcase className="w-3 h-3 inline mr-1" />
            )}
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Percentage */}
      <div className={`flex items-center gap-1 text-sm font-semibold ${getPercentageClass()}`}>
        {percentage}
        <Percent className="w-3.5 h-3.5" />
      </div>
    </div>
  );

  if (profileLink) {
    return <Link href={profileLink}>{content}</Link>;
  }

  return content;
}
