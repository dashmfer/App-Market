"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import {
  Rocket,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Coins,
  TrendingUp,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

interface TokenLaunch {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string | null;
  tokenImage: string | null;
  totalSupply: string;
  status: string;
  bondingCurveStatus: string;
  tradingFeeBps: number;
  creatorFeePct: number;
  graduationThreshold: string;
  dbcPoolAddress: string | null;
  dammPoolAddress: string | null;
  totalBondingCurveFeesSOL: string;
  totalPostGradFeesSOL: string;
  creatorFeesClaimedSOL: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
  } | null;
  transaction: {
    id: string;
    salePrice: string;
    currency: string;
  } | null;
  createdAt: string;
  launchedAt: string | null;
  graduatedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: "Pending", color: "text-zinc-600", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
  LAUNCHING: { label: "Launching", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  LIVE: { label: "Live", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  GRADUATED: { label: "Graduated", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  COMPLETED: { label: "Completed", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  FAILED: { label: "Failed", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  CANCELLED: { label: "Cancelled", color: "text-zinc-500", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
};

export default function TokensPage() {
  const router = useRouter();
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [launches, setLaunches] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchLaunches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/token-launch", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLaunches(data.tokenLaunches || []);
    } catch {
      setError("Failed to load token launches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  const handleCopy = async (mint: string) => {
    await navigator.clipboard.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  const handleClaimFees = async (launch: TokenLaunch) => {
    if (!connected || !publicKey || !signTransaction) return;

    setClaimingId(launch.id);
    try {
      const res = await fetch("/api/token-launch/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tokenLaunchId: launch.id, claimType: "creator" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

      fetchLaunches();
    } catch (err: any) {
      console.error("Claim failed:", err);
    } finally {
      setClaimingId(null);
    }
  };

  const totalFees = launches.reduce((sum, l) => {
    return sum + parseFloat(l.totalBondingCurveFeesSOL) + parseFloat(l.totalPostGradFeesSOL);
  }, 0);

  const totalClaimed = launches.reduce((sum, l) => {
    return sum + parseFloat(l.creatorFeesClaimedSOL);
  }, 0);

  const liveLaunches = launches.filter((l) =>
    ["LIVE", "GRADUATED", "COMPLETED"].includes(l.status)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              My Tokens
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Post-Acquisition Token Offerings
            </p>
          </div>
        </div>

        {/* Stats */}
        {launches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Rocket className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-500">Total Launches</span>
              </div>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {launches.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {liveLaunches.length} live
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-zinc-500">Total Fees Earned</span>
              </div>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {totalFees.toFixed(4)} SOL
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Across all launches
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-zinc-500">Total Claimed</span>
              </div>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {totalClaimed.toFixed(4)} SOL
              </p>
              <p className="text-xs text-green-600 mt-1">
                {totalFees > 0 ? `${((totalClaimed / totalFees) * 100).toFixed(0)}% claimed` : "No fees yet"}
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {launches.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-zinc-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No tokens launched yet
            </h2>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              After completing a business acquisition, you can launch a token for it from the transfer page.
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="space-y-4">
          {launches.map((launch, index) => {
            const status = STATUS_CONFIG[launch.status] || STATUS_CONFIG.PENDING;
            const isLive = ["LIVE", "GRADUATED", "COMPLETED"].includes(launch.status);
            const fees = parseFloat(launch.totalBondingCurveFeesSOL) + parseFloat(launch.totalPostGradFeesSOL);
            const claimed = parseFloat(launch.creatorFeesClaimedSOL);

            return (
              <motion.div
                key={launch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6"
              >
                <div className="flex items-start gap-4">
                  {/* Token Icon */}
                  {launch.tokenImage ? (
                    <img
                      src={launch.tokenImage}
                      alt={launch.tokenName}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Coins className="w-6 h-6 text-white" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {launch.tokenName}
                      </h3>
                      <span className="text-sm text-zinc-500">${launch.tokenSymbol}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color} ${status.bgColor}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Listing */}
                    {launch.listing && (
                      <p className="text-sm text-zinc-500 mb-2">
                        for{" "}
                        <button
                          onClick={() => router.push(`/listing/${launch.listing!.slug}`)}
                          className="text-green-600 hover:underline"
                        >
                          {launch.listing.title}
                        </button>
                      </p>
                    )}

                    {/* Mint Address */}
                    {launch.tokenMint && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-2.5 py-1.5 max-w-xs">
                          <Sparkles className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-mono text-zinc-500 truncate">
                            {launch.tokenMint}
                          </span>
                          <button
                            onClick={() => handleCopy(launch.tokenMint!)}
                            className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded flex-shrink-0"
                          >
                            {copiedMint === launch.tokenMint ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-zinc-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Fee Stats - inline */}
                    {isLive && (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-zinc-500">Earned:</span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {fees.toFixed(4)} SOL
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-zinc-500">Claimed:</span>
                          <span className="font-medium text-green-600">
                            {claimed.toFixed(4)} SOL
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isLive && connected && (
                      <button
                        onClick={() => handleClaimFees(launch)}
                        disabled={claimingId === launch.id}
                        className="btn-success text-xs py-1.5 px-3"
                      >
                        {claimingId === launch.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Coins className="w-3.5 h-3.5" />
                            Claim
                          </>
                        )}
                      </button>
                    )}

                    {launch.tokenMint && (
                      <a
                        href={`https://solscan.io/token/${launch.tokenMint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-zinc-400" />
                      </a>
                    )}

                    {launch.transaction && (
                      <button
                        onClick={() => router.push(`/dashboard/transfers/${launch.transaction!.id}`)}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
