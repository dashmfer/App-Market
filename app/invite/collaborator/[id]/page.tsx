"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import {
  Users,
  Crown,
  Briefcase,
  Percent,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Wallet,
  AlertCircle,
} from "lucide-react";

interface CollaboratorInvite {
  id: string;
  walletAddress: string;
  role: "PARTNER" | "COLLABORATOR";
  roleDescription: string;
  customRoleDescription?: string | null;
  percentage: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  listing: {
    id: string;
    title: string;
    slug: string;
    tagline?: string;
    thumbnailUrl?: string;
    category: string;
    status: string;
    seller: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
      image: string | null;
      isVerified: boolean;
    };
  };
}

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

export default function CollaboratorInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [invite, setInvite] = useState<CollaboratorInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const collaboratorId = params.id as string;

  // Fetch invite details (only when authenticated)
  useEffect(() => {
    async function fetchInvite() {
      if (authStatus === "loading") return;

      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/collaborators/${collaboratorId}/respond`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch invite");
        }
        const data = await response.json();
        setInvite(data.collaborator);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invite");
      } finally {
        setLoading(false);
      }
    }

    if (collaboratorId) {
      fetchInvite();
    }
  }, [collaboratorId, session, authStatus]);

  const handleRespond = async (action: "accept" | "decline") => {
    if (!session) {
      signIn();
      return;
    }

    setResponding(true);
    setResponseError(null);

    try {
      const response = await fetch(`/api/collaborators/${collaboratorId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to respond to invite");
      }

      // Redirect to the listing or dashboard
      if (action === "accept") {
        router.push(`/listing/${invite?.listing.slug}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  const getSellerName = () => {
    if (invite?.listing.seller.displayName) return invite.listing.seller.displayName;
    if (invite?.listing.seller.username) return `@${invite.listing.seller.username}`;
    if (invite?.listing.seller.name) return invite.listing.seller.name;
    return "Unknown";
  };

  const getRoleLabel = () => {
    if (!invite) return "";
    if (invite.roleDescription === "OTHER" && invite.customRoleDescription) {
      return invite.customRoleDescription;
    }
    return ROLE_LABELS[invite.roleDescription] || invite.roleDescription;
  };

  // Show loading while checking auth
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show sign in prompt
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Sign In Required
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Connect your wallet to view and respond to this collaboration invite
          </p>
          <button
            onClick={() => signIn()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-zinc-600 dark:text-zinc-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Invite Not Found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            {error || "This invite may have expired or been removed."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Already responded
  if (invite.status !== "PENDING") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            invite.status === "ACCEPTED"
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-red-100 dark:bg-red-900/30"
          }`}>
            {invite.status === "ACCEPTED" ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Invite Already {invite.status === "ACCEPTED" ? "Accepted" : "Declined"}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            {invite.status === "ACCEPTED"
              ? "You've already joined this listing as a collaborator."
              : "You've declined this collaboration invite."}
          </p>
          <Link
            href={`/listing/${invite.listing.slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            View Listing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-lg w-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
        {/* Listing Header */}
        {invite.listing.thumbnailUrl && (
          <div className="relative h-40 bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={invite.listing.thumbnailUrl}
              alt={invite.listing.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm text-white rounded-full">
                {invite.listing.category}
              </span>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Title */}
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Collaboration Invite
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You've been invited to join <strong className="text-zinc-900 dark:text-white">{invite.listing.title}</strong> as a {invite.role.toLowerCase()}.
          </p>

          {/* Invite Details */}
          <div className="space-y-4 mb-6">
            {/* From */}
            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              {invite.listing.seller.image ? (
                <Image
                  src={invite.listing.seller.image}
                  alt={getSellerName()}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {getSellerName()[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500">Invited by</p>
                <p className="font-medium text-zinc-900 dark:text-white flex items-center gap-1">
                  {getSellerName()}
                  {invite.listing.seller.isVerified && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </p>
              </div>
            </div>

            {/* Role */}
            <div className={`flex items-center justify-between p-3 rounded-xl ${
              invite.role === "PARTNER"
                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30"
                : "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  invite.role === "PARTNER"
                    ? "bg-blue-100 dark:bg-blue-900/50"
                    : "bg-purple-100 dark:bg-purple-900/50"
                }`}>
                  {invite.role === "PARTNER" ? (
                    <Crown className={`w-5 h-5 ${invite.role === "PARTNER" ? "text-blue-600" : "text-purple-600"}`} />
                  ) : (
                    <Briefcase className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Your Role</p>
                  <p className={`font-medium ${
                    invite.role === "PARTNER" ? "text-blue-700 dark:text-blue-300" : "text-purple-700 dark:text-purple-300"
                  }`}>
                    {getRoleLabel()}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                invite.role === "PARTNER"
                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                  : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
              }`}>
                {invite.role === "PARTNER" ? "Can Edit" : "View Only"}
              </span>
            </div>

            {/* Revenue Share */}
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Revenue Share</p>
                  <p className="font-medium text-green-700 dark:text-green-300">
                    {invite.percentage}% of sale
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {responseError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {responseError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleRespond("decline")}
              disabled={responding}
              className="flex-1 px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => handleRespond("accept")}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {responding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Accept
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
