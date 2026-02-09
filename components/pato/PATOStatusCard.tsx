"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
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
} from "lucide-react";

interface TokenLaunchInfo {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string | null;
  tokenImage: string | null;
  status: string;
  bondingCurveStatus: string;
  dbcPoolAddress: string | null;
  dammPoolAddress: string | null;
  graduationThreshold: string;
  totalBondingCurveFeesSOL: string;
  totalPostGradFeesSOL: string;
  creatorFeesClaimedSOL: string;
  createdAt: string;
  launchedAt: string | null;
  graduatedAt: string | null;
}

interface PATOStatusCardProps {
  tokenLaunch: TokenLaunchInfo;
  isBuyer: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: "Pending", color: "text-zinc-600", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
  LAUNCHING: { label: "Launching", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  LIVE: { label: "Live", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  GRADUATED: { label: "Graduated", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  COMPLETED: { label: "Completed", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  FAILED: { label: "Failed", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  CANCELLED: { label: "Cancelled", color: "text-zinc-500", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
};

const CURVE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Not deployed", color: "text-zinc-500" },
  ACTIVE: { label: "Bonding curve active", color: "text-green-600" },
  GRADUATING: { label: "Graduating...", color: "text-yellow-600" },
  GRADUATED: { label: "Graduated to AMM", color: "text-purple-600" },
  FAILED: { label: "Failed", color: "text-red-600" },
};

export function PATOStatusCard({ tokenLaunch, isBuyer }: PATOStatusCardProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [copied, setCopied] = useState(false);
  const [claimingFees, setClaimingFees] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const statusConfig = STATUS_CONFIG[tokenLaunch.status] || STATUS_CONFIG.PENDING;
  const curveConfig = CURVE_STATUS_CONFIG[tokenLaunch.bondingCurveStatus] || CURVE_STATUS_CONFIG.PENDING;

  const handleCopyMint = async () => {
    if (!tokenLaunch.tokenMint) return;
    await navigator.clipboard.writeText(tokenLaunch.tokenMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimFees = async () => {
    if (!connected || !publicKey || !signTransaction) return;

    setClaimingFees(true);
    setClaimError(null);
    setClaimSuccess(false);

    try {
      const res = await fetch("/api/token-launch/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenLaunchId: tokenLaunch.id,
          claimType: "creator",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to build claim transaction");
      }

      const tx = Transaction.from(
        Buffer.from(data.transaction, "base64")
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      });

      setClaimSuccess(true);
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setClaimError("Transaction cancelled");
      } else {
        setClaimError(err.message || "Failed to claim fees");
      }
    } finally {
      setClaimingFees(false);
    }
  };

  const isLive = ["LIVE", "GRADUATED", "COMPLETED"].includes(tokenLaunch.status);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          PATO
        </h3>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Token Info */}
      <div className="flex items-center gap-3 mb-4">
        {tokenLaunch.tokenImage ? (
          <img
            src={tokenLaunch.tokenImage}
            alt={tokenLaunch.tokenName}
            className="w-10 h-10 rounded-xl object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Coins className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {tokenLaunch.tokenName}
          </p>
          <p className="text-sm text-zinc-500">${tokenLaunch.tokenSymbol}</p>
        </div>
      </div>

      {/* Mint Address */}
      {tokenLaunch.tokenMint && (
        <div className="mb-4">
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
              {tokenLaunch.tokenMint}
            </span>
            <button
              onClick={handleCopyMint}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded flex-shrink-0"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-400" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Curve Status */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Bonding Curve</span>
          <span className={`font-medium ${curveConfig.color}`}>
            {curveConfig.label}
          </span>
        </div>
        {tokenLaunch.graduationThreshold && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Graduation</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {tokenLaunch.graduationThreshold} SOL
            </span>
          </div>
        )}
      </div>

      {/* Fee Earnings */}
      {isLive && (
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fee Earnings
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Bonding curve fees</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {parseFloat(tokenLaunch.totalBondingCurveFeesSOL).toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Post-grad fees</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {parseFloat(tokenLaunch.totalPostGradFeesSOL).toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Claimed</span>
              <span className="font-medium text-green-600">
                {parseFloat(tokenLaunch.creatorFeesClaimedSOL).toFixed(4)} SOL
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Claim Fees - Buyer only, when live */}
        {isBuyer && isLive && connected && (
          <>
            <button
              onClick={handleClaimFees}
              disabled={claimingFees}
              className="w-full btn-success text-sm py-2 justify-center"
            >
              {claimingFees ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Claim Fees
                </>
              )}
            </button>

            {claimError && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                {claimError}
              </div>
            )}
            {claimSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Fees claimed successfully
              </div>
            )}
          </>
        )}

        {/* View on Explorer */}
        {tokenLaunch.tokenMint && (
          <a
            href={`https://solscan.io/token/${tokenLaunch.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full btn-secondary text-sm py-2 justify-center flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View on Solscan
          </a>
        )}

        {/* View Pool */}
        {tokenLaunch.dbcPoolAddress && (
          <a
            href={`https://app.meteora.ag/pools/${tokenLaunch.dbcPoolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors py-1"
          >
            View Pool on Meteora
          </a>
        )}
      </div>
    </div>
  );
}
