"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import {
  Users,
  Crown,
  Percent,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Wallet,
  AlertCircle,
  Clock,
  DollarSign,
} from "lucide-react";

interface PartnerInviteData {
  partner: {
    id: string;
    walletAddress: string;
    percentage: number;
    depositAmount: number;
    depositStatus: "PENDING" | "DEPOSITED" | "REFUNDED";
    isLead: boolean;
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
      image: string | null;
    } | null;
  };
  transaction: {
    id: string;
    status: string;
    salePrice: number;
    currency: string;
    depositDeadline: string | null;
    timeRemaining: number;
  };
  listing: {
    id: string;
    title: string;
    slug: string;
    tagline?: string;
    thumbnailUrl?: string;
    category: string;
    categories?: string[];
  };
  seller: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
    isVerified: boolean;
  };
  partners: Array<{
    id: string;
    walletAddress: string;
    percentage: number;
    depositStatus: string;
    isLead: boolean;
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      image: string | null;
    } | null;
  }>;
  stats: {
    totalPartners: number;
    depositedCount: number;
    totalPercentageDeposited: number;
  };
}

export default function PartnerInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [data, setData] = useState<PartnerInviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const partnerId = params.id as string;

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const response = await fetch(`/api/purchase-partners/${partnerId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch invite");
        }
        const responseData = await response.json();
        setData(responseData);
        setTimeRemaining(responseData.transaction.timeRemaining);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invite");
      } finally {
        setLoading(false);
      }
    }

    if (partnerId) {
      fetchInvite();
    }
  }, [partnerId]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const formatTimeRemaining = () => {
    if (timeRemaining <= 0) return "Expired";
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDeposit = async () => {
    if (!session) {
      signIn();
      return;
    }

    setDepositing(true);
    setDepositError(null);

    try {
      // TODO: Implement actual wallet deposit logic here
      // For now, we'll just call the API to mark as deposited
      const response = await fetch(
        `/api/transactions/${data?.transaction.id}/partners/${partnerId}/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: "mock_tx_hash" }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process deposit");
      }

      // Redirect to transaction page or listing
      router.push(`/listing/${data?.listing.slug}`);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Failed to deposit");
    } finally {
      setDepositing(false);
    }
  };

  const getSellerName = () => {
    if (data?.seller.displayName) return data.seller.displayName;
    if (data?.seller.username) return `@${data.seller.username}`;
    if (data?.seller.name) return data.seller.name;
    return "Unknown";
  };

  const getLeadBuyer = () => {
    const lead = data?.partners.find(p => p.isLead);
    if (!lead) return null;
    return {
      name: lead.user?.displayName || lead.user?.username || lead.walletAddress,
      image: lead.user?.image,
    };
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

  if (error || !data) {
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

  // Already deposited
  if (data.partner.depositStatus === "DEPOSITED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Deposit Complete
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You've already deposited your share for this purchase.
          </p>
          <Link
            href={`/listing/${data.listing.slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            View Listing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Expired
  if (timeRemaining <= 0 && data.transaction.depositDeadline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Deposit Window Expired
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The deposit deadline for this purchase has passed. Any deposited funds will be refunded.
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

  const leadBuyer = getLeadBuyer();

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-lg w-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
        {/* Listing Header */}
        {data.listing.thumbnailUrl && (
          <div className="relative h-40 bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={data.listing.thumbnailUrl}
              alt={data.listing.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <span className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm text-white rounded-full">
                {data.listing.categories?.[0] || data.listing.category}
              </span>
              {timeRemaining > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-500/90 text-white rounded-full">
                  <Clock className="w-3 h-3" />
                  {formatTimeRemaining()}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Title */}
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Purchase Partner Invite
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You've been invited to co-purchase <strong className="text-zinc-900 dark:text-white">{data.listing.title}</strong>
          </p>

          {/* Invite Details */}
          <div className="space-y-4 mb-6">
            {/* Lead Buyer */}
            {leadBuyer && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
                {leadBuyer.image ? (
                  <Image
                    src={leadBuyer.image}
                    alt={leadBuyer.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {leadBuyer.name[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-zinc-500">Lead Buyer</p>
                  <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    {leadBuyer.name}
                    <Crown className="w-4 h-4 text-amber-500" />
                  </p>
                </div>
              </div>
            )}

            {/* Your Share */}
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Your Share</p>
                  <p className="font-medium text-green-700 dark:text-green-300">
                    {data.partner.percentage}% ownership
                  </p>
                </div>
              </div>
            </div>

            {/* Deposit Amount */}
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Amount to Deposit</p>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {data.partner.depositAmount} {data.transaction.currency}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Total Price</p>
                <p className="font-medium text-zinc-600 dark:text-zinc-400">
                  {data.transaction.salePrice} {data.transaction.currency}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Partner Progress
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {data.stats.depositedCount}/{data.stats.totalPartners} deposited
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${data.stats.totalPercentageDeposited}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {data.stats.totalPercentageDeposited}% of total deposited
              </p>
            </div>
          </div>

          {/* Error */}
          {depositError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {depositError}
            </div>
          )}

          {/* Actions */}
          {!session ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                Connect your wallet to deposit your share
              </p>
              <button
                onClick={() => signIn()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {depositing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Deposit {data.partner.depositAmount} {data.transaction.currency}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          )}

          {/* View Listing Link */}
          <div className="mt-4 text-center">
            <Link
              href={`/listing/${data.listing.slug}`}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Listing Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
