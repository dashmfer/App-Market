"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Crown,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CollaborationInvite {
  id: string;
  walletAddress: string;
  role: "PARTNER" | "COLLABORATOR";
  roleDescription: string;
  customRoleDescription?: string | null;
  percentage: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  invitedAt: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    tagline?: string;
    thumbnailUrl?: string;
    category: string;
    status: string;
    startingPrice: number;
    buyNowPrice?: number;
    currency: string;
    seller: {
      id: string;
      username?: string;
      displayName?: string;
      name?: string;
      image?: string;
      isVerified: boolean;
      twitterUsername?: string;
      twitterVerified?: boolean;
    };
  };
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

export default function CollaborationsPage() {
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const response = await fetch("/api/collaborators/invites");
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch invites:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (inviteId: string, action: "accept" | "decline") => {
    setRespondingTo(inviteId);
    try {
      const response = await fetch(`/api/collaborators/${inviteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast.success(
          action === "accept"
            ? "You've joined this listing as a collaborator!"
            : "Invitation declined"
        );
        // Remove from list or update status
        setInvites((prev) =>
          prev.map((invite) =>
            invite.id === inviteId
              ? { ...invite, status: action === "accept" ? "ACCEPTED" : "DECLINED" }
              : invite
          )
        );
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to respond");
      }
    } catch (error: any) {
      toast.error("Something went wrong");
    } finally {
      setRespondingTo(null);
    }
  };

  const getRoleLabel = (roleDescription: string, customRoleDescription?: string | null) => {
    if (roleDescription === "OTHER" && customRoleDescription) {
      return customRoleDescription;
    }
    return ROLE_LABELS[roleDescription] || roleDescription;
  };

  const pendingInvites = invites.filter((i) => i.status === "PENDING");
  const respondedInvites = invites.filter((i) => i.status !== "PENDING");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-900 dark:text-zinc-100">
                Collaborations
              </h1>
              <p className="text-zinc-500">
                Manage your collaboration invites and partnerships
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-wide py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Invites */}
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Pending Invites
                {pendingInvites.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    {pendingInvites.length}
                  </span>
                )}
              </h2>

              {pendingInvites.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    No pending collaboration invites
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    When someone invites you to collaborate on a listing, it will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvites.map((invite) => (
                    <InviteCard
                      key={invite.id}
                      invite={invite}
                      onRespond={handleRespond}
                      isResponding={respondingTo === invite.id}
                      getRoleLabel={getRoleLabel}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Responded Invites */}
            {respondedInvites.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Past Invites
                </h2>
                <div className="space-y-4">
                  {respondedInvites.map((invite) => (
                    <InviteCard
                      key={invite.id}
                      invite={invite}
                      onRespond={handleRespond}
                      isResponding={false}
                      getRoleLabel={getRoleLabel}
                      showActions={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteCard({
  invite,
  onRespond,
  isResponding,
  getRoleLabel,
  showActions = true,
}: {
  invite: CollaborationInvite;
  onRespond: (id: string, action: "accept" | "decline") => void;
  isResponding: boolean;
  getRoleLabel: (roleDescription: string, customRoleDescription?: string | null) => string;
  showActions?: boolean;
}) {
  const sellerName =
    invite.listing.seller.displayName ||
    invite.listing.seller.name ||
    invite.listing.seller.username ||
    "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden ${
        invite.status === "PENDING"
          ? "border-amber-200 dark:border-amber-800/50"
          : invite.status === "ACCEPTED"
          ? "border-green-200 dark:border-green-800/50"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="p-5">
        <div className="flex gap-4">
          {/* Listing Thumbnail */}
          <Link href={`/listing/${invite.listing.slug}`} className="flex-shrink-0">
            <div className="w-20 h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              {invite.listing.thumbnailUrl ? (
                <Image
                  src={invite.listing.thumbnailUrl}
                  alt={invite.listing.title}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  📦
                </div>
              )}
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/listing/${invite.listing.slug}`}
                  className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-green-600 dark:hover:text-green-400 transition-colors line-clamp-1"
                >
                  {invite.listing.title}
                </Link>
                {invite.listing.tagline && (
                  <p className="text-sm text-zinc-500 line-clamp-1 mt-0.5">
                    {invite.listing.tagline}
                  </p>
                )}
              </div>

              {/* Status Badge */}
              {invite.status !== "PENDING" && (
                <span
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                    invite.status === "ACCEPTED"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {invite.status === "ACCEPTED" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      Accepted
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 inline mr-1" />
                      Declined
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Seller */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-zinc-500">From:</span>
              {invite.listing.seller.image ? (
                <Image
                  src={invite.listing.seller.image}
                  alt={sellerName}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white">
                    {sellerName[0].toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {sellerName}
              </span>
              {invite.listing.seller.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
            </div>

            {/* Role & Percentage */}
            <div className="flex items-center gap-3 mt-3">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  invite.role === "PARTNER"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                }`}
              >
                {invite.role === "PARTNER" ? (
                  <Crown className="w-3 h-3 inline mr-1" />
                ) : (
                  <Briefcase className="w-3 h-3 inline mr-1" />
                )}
                {getRoleLabel(invite.roleDescription, invite.customRoleDescription)}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                {invite.percentage}
                <Percent className="w-3.5 h-3.5" />
                <span className="font-normal text-zinc-500">revenue share</span>
              </span>
            </div>

            {/* Partner Edit Note */}
            {invite.role === "PARTNER" && invite.status === "PENDING" && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                As a partner, you'll be able to edit this listing
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && invite.status === "PENDING" && (
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="success"
              onClick={() => onRespond(invite.id, "accept")}
              disabled={isResponding}
              className="flex-1"
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Accept
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onRespond(invite.id, "decline")}
              disabled={isResponding}
              className="flex-1"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
            <Link href={`/listing/${invite.listing.slug}`}>
              <Button variant="ghost" size="icon">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
