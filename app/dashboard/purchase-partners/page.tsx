"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  Wallet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface PurchasePartnerInvite {
  id: string;
  transactionId: string;
  percentage: number;
  depositAmount: number;
  listing: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    category: string;
  };
  seller: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
  };
  salePrice: number;
  leadBuyer: {
    id: string;
    userId: string | null;
    walletAddress: string;
    user?: {
      id: string;
      username: string | null;
      displayName: string | null;
      image: string | null;
    };
  } | null;
  partnersCount: number;
  depositedCount: number;
  totalPercentageDeposited: number;
  timeRemaining: number;
  depositDeadline: string | null;
  createdAt: string;
}

export default function PurchasePartnersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [invites, setInvites] = useState<PurchasePartnerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = async () => {
    try {
      const response = await fetch("/api/purchase-partners/invites");
      const data = await response.json();
      if (response.ok) {
        setInvites(data.invites || []);
      } else {
        setError(data.error || "Failed to fetch invites");
      }
    } catch {
      setError("Failed to fetch invites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchInvites();
    }
  }, [status]);

  // Countdown timer update
  useEffect(() => {
    const interval = setInterval(() => {
      setInvites(prev =>
        prev.map(invite => ({
          ...invite,
          timeRemaining: invite.depositDeadline
            ? Math.max(0, new Date(invite.depositDeadline).getTime() - Date.now())
            : 0,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Expired";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDeposit = async (invite: PurchasePartnerInvite) => {
    if (!connected || !publicKey || !sendTransaction) {
      setError("Please connect your wallet to deposit");
      return;
    }

    setProcessing(invite.id);
    setError(null);

    try {
      const escrowPubkey = new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB");
      const lamports = Math.floor(invite.depositAmount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const txSignature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txSignature,
      });

      // Record deposit
      const response = await fetch(
        `/api/transactions/${invite.transactionId}/partners/${invite.id}/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: txSignature }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.allDeposited) {
          // All deposits complete, redirect to purchase details
          router.push(`/dashboard/purchases?success=${invite.listing.id}`);
        } else {
          // Refresh invites
          fetchInvites();
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to record deposit");
      }
    } catch (err: any) {
      console.error("Deposit error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setError("Transaction was rejected. Please try again.");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient funds in your wallet.");
      } else {
        setError(err.message || "Failed to complete deposit. Please try again.");
      }
    } finally {
      setProcessing(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Purchase Partner Invites
          </h1>
          <p className="text-zinc-500 mt-1">
            Pending invites to co-purchase listings with others
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInvites}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {invites.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
            No pending invites
          </h3>
          <p className="text-zinc-500 mb-6">
            You don&apos;t have any purchase partner invites at the moment.
          </p>
          <Link href="/explore">
            <Button>Explore Listings</Button>
          </Link>
        </div>
      )}

      {/* Invites List */}
      <div className="space-y-4">
        {invites.map((invite) => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-start gap-4">
              {/* Listing Thumbnail */}
              <Link href={`/listing/${invite.listing.slug}`}>
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                  {invite.listing.thumbnailUrl ? (
                    <Image
                      src={invite.listing.thumbnailUrl}
                      alt={invite.listing.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      <Users className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/listing/${invite.listing.slug}`}>
                      <h3 className="font-semibold text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {invite.listing.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-zinc-500 mt-1">
                      Invited by{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {invite.leadBuyer?.user?.displayName ||
                          invite.leadBuyer?.user?.username ||
                          invite.leadBuyer?.walletAddress.slice(0, 8)}
                      </span>
                    </p>
                  </div>

                  {/* Timer */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      invite.timeRemaining <= 0
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                        : invite.timeRemaining <= 300000
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {formatTimeRemaining(invite.timeRemaining)}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Your Share</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      {invite.percentage}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Deposit Required</p>
                    <p className="font-semibold text-green-600">
                      {invite.depositAmount.toFixed(4)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Total Price</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      {invite.salePrice} SOL
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-zinc-500">
                      {invite.depositedCount} of {invite.partnersCount} deposited
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {invite.totalPercentageDeposited}% funded
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${invite.totalPercentageDeposited}%` }}
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="mt-4 flex items-center gap-3">
                  {invite.timeRemaining <= 0 ? (
                    <div className="flex items-center gap-2 text-red-500">
                      <XCircle className="w-5 h-5" />
                      <span>Deposit window expired</span>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleDeposit(invite)}
                        disabled={processing === invite.id || !connected}
                        className="gap-2"
                      >
                        {processing === invite.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Wallet className="w-4 h-4" />
                            Deposit {invite.depositAmount.toFixed(4)} SOL
                          </>
                        )}
                      </Button>
                      <Link href={`/listing/${invite.listing.slug}`}>
                        <Button variant="outline" className="gap-2">
                          View Listing
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                {!connected && invite.timeRemaining > 0 && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    Connect your wallet to deposit
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
