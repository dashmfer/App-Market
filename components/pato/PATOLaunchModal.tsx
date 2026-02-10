"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Rocket,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Coins,
  Globe,
  ImageIcon,
  Info,
  Sparkles,
  TrendingUp,
  Lock,
  ExternalLink,
} from "lucide-react";

interface PATOLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  listingSlug: string;
  listingTitle: string;
  onSuccess?: (tokenLaunch: any) => void;
}

type Step = "configure" | "review" | "deploy";

export function PATOLaunchModal({
  isOpen,
  onClose,
  transactionId,
  listingSlug,
  listingTitle,
  onSuccess,
}: PATOLaunchModalProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [step, setStep] = useState<Step>("configure");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deployedMint, setDeployedMint] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Form state
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenImage, setTokenImage] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [initialBuySOL, setInitialBuySOL] = useState("");

  // Created launch data
  const [tokenLaunchData, setTokenLaunchData] = useState<any>(null);

  // Auto-populate from listing data
  useEffect(() => {
    if (!isOpen || prefilled || !listingSlug) return;

    const fetchListing = async () => {
      try {
        const res = await fetch(`/api/listings/${listingSlug}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const listing = data.listing || data;

        // Pre-fill with listing data — user can edit all fields
        if (listing.title && !tokenName) setTokenName(listing.title);
        if (listing.description && !tokenDescription) setTokenDescription(listing.description);
        if (listing.thumbnailUrl && !tokenImage) setTokenImage(listing.thumbnailUrl);
        if (listing.websiteUrl && !website) setWebsite(listing.websiteUrl);
        if (listing.twitterUrl && !twitter) setTwitter(listing.twitterUrl);
        if (listing.telegramUrl && !telegram) setTelegram(listing.telegramUrl);
        if (listing.discordUrl && !discord) setDiscord(listing.discordUrl);

        // Generate a default symbol from the title (first word, uppercase, max 6 chars)
        if (listing.title && !tokenSymbol) {
          const words = listing.title.trim().split(/\s+/);
          const symbol = words[0].replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6);
          if (symbol.length >= 2) setTokenSymbol(symbol);
        }

        setPrefilled(true);
      } catch {
        // Silent fail — user can still fill manually
      }
    };

    fetchListing();
  }, [isOpen, prefilled, listingSlug]);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep("configure");
    setProcessing(false);
    setError(null);
    setDeploySuccess(false);
    setDeployedMint(null);
    setTokenName("");
    setTokenSymbol("");
    setTokenDescription("");
    setTokenImage("");
    setWebsite("");
    setTwitter("");
    setTelegram("");
    setDiscord("");
    setInitialBuySOL("");
    setTokenLaunchData(null);
    setPrefilled(false);
  };

  const handleClose = () => {
    if (processing) return;
    resetForm();
    onClose();
  };

  const isFormValid = tokenName.trim().length > 0 && tokenSymbol.trim().length >= 2 && tokenSymbol.trim().length <= 10;

  const handleCreateLaunch = async () => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/token-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transactionId,
          tokenName: tokenName.trim(),
          tokenSymbol: tokenSymbol.trim().toUpperCase(),
          tokenDescription: tokenDescription.trim() || undefined,
          tokenImage: tokenImage.trim() || undefined,
          website: website.trim() || undefined,
          twitter: twitter.trim() || undefined,
          telegram: telegram.trim() || undefined,
          discord: discord.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create token launch");
      }

      setTokenLaunchData(data.tokenLaunch);
      setStep("review");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeploy = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError("Please connect your wallet to deploy");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get deployment transactions from API
      const res = await fetch("/api/token-launch/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenLaunchId: tokenLaunchData.id,
          initialBuyAmountSOL: initialBuySOL ? parseFloat(initialBuySOL) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to build deploy transaction");
      }

      // The mint keypair is now signed server-side (partialSign).
      // The client only needs to add the user's wallet signature.

      // Sign and send each transaction
      for (const txData of data.transactions) {
        const tx = Transaction.from(
          Buffer.from(txData.serialized, "base64")
        );

        // Add recent blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // User signs (mint keypair already signed server-side)
        const signed = await signTransaction(tx);

        // Send
        const signature = await connection.sendRawTransaction(
          signed.serialize()
        );

        // Confirm
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature,
        });
      }

      // Update status to LIVE
      await fetch(`/api/token-launch/${tokenLaunchData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "LIVE", bondingCurveStatus: "ACTIVE" }),
      });

      setDeployedMint(data.mintAddress);
      setDeploySuccess(true);
      setStep("deploy");

      if (onSuccess) {
        onSuccess({ ...tokenLaunchData, mintAddress: data.mintAddress, poolAddress: data.poolAddress });
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError(err.message || "Deployment failed");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white stroke-[1.5] fill-none" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Launch Token
              </h2>
              <p className="text-sm text-zinc-500">
                Post-Acquisition Token Offering
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {(["configure", "review", "deploy"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    step === s
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                      : (["configure", "review", "deploy"].indexOf(step) > i)
                      ? "bg-green-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                  }`}
                >
                  {["configure", "review", "deploy"].indexOf(step) > i ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div
                    className={`flex-1 h-px ${
                      ["configure", "review", "deploy"].indexOf(step) > i
                        ? "bg-green-500"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 px-1">
            <span className="text-[11px] text-zinc-500">Configure</span>
            <span className="text-[11px] text-zinc-500">Review</span>
            <span className="text-[11px] text-zinc-500">Deploy</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Configure */}
            {step === "configure" && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Launching token for <span className="font-medium text-zinc-900 dark:text-zinc-100">{listingTitle}</span>
                  </p>
                </div>

                {/* Token Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g. MyApp Token"
                    className="input-field"
                    maxLength={32}
                  />
                </div>

                {/* Token Symbol */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Token Symbol <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. MYAPP"
                    className="input-field"
                    maxLength={10}
                  />
                  <p className="mt-1 text-xs text-zinc-500">2-10 characters, uppercase</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={tokenDescription}
                    onChange={(e) => setTokenDescription(e.target.value)}
                    placeholder="Brief description of the token and its purpose..."
                    className="input-field min-h-[80px] resize-y"
                    maxLength={500}
                  />
                </div>

                {/* Token Image */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    <ImageIcon className="w-4 h-4" />
                    Token Image URL
                  </label>
                  <input
                    type="url"
                    value={tokenImage}
                    onChange={(e) => setTokenImage(e.target.value)}
                    placeholder="https://..."
                    className="input-field"
                  />
                </div>

                {/* Socials */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Social Links <span className="text-xs font-normal text-zinc-500">(optional)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <Globe className="w-3 h-3" /> Website
                      </label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://..."
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        Twitter / X
                      </label>
                      <input
                        type="text"
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        placeholder="@handle"
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        Telegram
                      </label>
                      <input
                        type="text"
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        placeholder="t.me/..."
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        Discord
                      </label>
                      <input
                        type="text"
                        value={discord}
                        onChange={(e) => setDiscord(e.target.value)}
                        placeholder="discord.gg/..."
                        className="input-field text-sm py-2"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Review */}
            {step === "review" && tokenLaunchData && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Token Preview */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    {tokenImage ? (
                      <img
                        src={tokenImage}
                        alt={tokenName}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {tokenLaunchData.tokenName}
                      </h3>
                      <p className="text-sm text-zinc-500">${tokenLaunchData.tokenSymbol}</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="truncate">{tokenLaunchData.tokenMint}</span>
                  </div>
                </div>

                {/* Token Details */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Total Supply</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {Number(tokenLaunchData.totalSupply).toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Graduation</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {tokenLaunchData.graduationThreshold}
                    </span>
                  </div>
                </div>

                {/* Fee Breakdown */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Fee Structure
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Trading Fee</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {tokenLaunchData.feeBreakdown.tradingFee}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Your Share</span>
                      <span className="font-medium text-green-600">
                        {tokenLaunchData.feeBreakdown.creatorCut}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Post-Graduation Fee</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {tokenLaunchData.postGradFee}
                      </span>
                    </div>
                  </div>
                </div>

                {/* LP Distribution */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    <Lock className="w-4 h-4" />
                    LP Distribution (permanent lock)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <p className="text-2xl font-semibold text-green-600">
                        {tokenLaunchData.lpDistribution.creatorPermanentLocked}%
                      </p>
                      <p className="text-xs text-green-600/70 mt-0.5">Creator (You)</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                      <p className="text-2xl font-semibold text-emerald-600">
                        {tokenLaunchData.lpDistribution.partnerPermanentLocked}%
                      </p>
                      <p className="text-xs text-emerald-600/70 mt-0.5">Platform</p>
                    </div>
                  </div>
                </div>

                {/* Initial Buy (Optional) */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    <Coins className="w-4 h-4" />
                    Initial Buy
                    <span className="text-xs font-normal text-zinc-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={initialBuySOL}
                      onChange={(e) => setInitialBuySOL(e.target.value)}
                      placeholder="0.0"
                      className="input-field pr-16"
                      min="0"
                      step="0.1"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      SOL
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Buy tokens immediately after pool creation. This is optional.
                  </p>
                </div>

                {/* Info */}
                <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Deploying will create a Meteora bonding curve pool. You&apos;ll sign one transaction
                    with your wallet. Once live, anyone can buy and sell the token.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Deploy Success */}
            {step === "deploy" && deploySuccess && (
              <motion.div
                key="deploy"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Token Deployed
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Your token is now live on the bonding curve
                  </p>
                </div>

                {deployedMint && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                    <p className="text-xs text-zinc-500 mb-1">Token Mint Address</p>
                    <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100 break-all">
                      {deployedMint}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  {deployedMint && (
                    <a
                      href={`https://solscan.io/token/${deployedMint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm py-2.5 w-full"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Solscan
                    </a>
                  )}
                  <button onClick={handleClose} className="btn-secondary text-sm py-2.5 w-full">
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {step !== "deploy" && (
          <div className="flex items-center justify-between p-6 border-t border-zinc-200 dark:border-zinc-800">
            {step === "configure" && (
              <>
                <button onClick={handleClose} className="btn-secondary text-sm py-2.5">
                  Cancel
                </button>
                <button
                  onClick={handleCreateLaunch}
                  disabled={!isFormValid || processing}
                  className="btn-primary text-sm py-2.5"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}

            {step === "review" && (
              <>
                <button
                  onClick={() => setStep("configure")}
                  disabled={processing}
                  className="btn-secondary text-sm py-2.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={!connected || processing}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-medium rounded-full transition-all duration-300 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deploying...
                    </>
                  ) : !connected ? (
                    <>Connect Wallet</>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Deploy Token
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
