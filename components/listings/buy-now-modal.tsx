"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Users,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchasePartnerInput, PurchasePartner } from "@/components/transactions/purchase-partner-input";

interface BuyNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: {
    id: string;
    title: string;
    buyNowPrice: number;
    currency: string;
  };
  onSuccess?: () => void;
}

type PurchaseMode = "solo" | "partners";

export function BuyNowModal({ isOpen, onClose, listing, onSuccess }: BuyNowModalProps) {
  const router = useRouter();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<PurchaseMode | null>(null);
  const [partners, setPartners] = useState<PurchasePartner[]>([]);
  const [myPercentage, setMyPercentage] = useState(100);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "configure" | "confirm">("select");

  const totalPrice = listing.buyNowPrice;
  const myDepositAmount = (totalPrice * myPercentage) / 100;
  const totalPercentage = myPercentage + partners.reduce((sum, p) => sum + p.percentage, 0);

  const formatCurrency = (currency: string): string => {
    switch (currency) {
      case "APP": return "$APP";
      case "USDC": return "USDC";
      default: return "SOL";
    }
  };

  const handleSoloPurchase = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setError("Please connect your wallet to purchase");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const escrowPubkey = new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB");
      const lamports = Math.floor(totalPrice * LAMPORTS_PER_SOL);

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

      // Record purchase
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: totalPrice,
          currency: listing.currency,
          onChainTx: txSignature,
          walletAddress: publicKey.toBase58(),
          purchaseType: "buyNow",
        }),
      });

      if (response.ok) {
        onSuccess?.();
        router.push(`/dashboard/purchases?success=${listing.id}`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to record purchase");
      }
    } catch (err: any) {
      console.error("Buy error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setError("Transaction was rejected. Please try again.");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient funds in your wallet.");
      } else {
        setError(err.message || "Failed to complete purchase. Please try again.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handlePartnerPurchase = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setError("Please connect your wallet to purchase");
      return;
    }

    if (totalPercentage !== 100) {
      setError("Total percentage must equal 100%");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // First, deposit my share to escrow
      const escrowPubkey = new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB");
      const lamports = Math.floor(myDepositAmount * LAMPORTS_PER_SOL);

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

      // Create purchase with partners
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: totalPrice,
          currency: listing.currency,
          onChainTx: txSignature,
          walletAddress: publicKey.toBase58(),
          purchaseType: "buyNow",
          withPartners: true,
          leadBuyerPercentage: myPercentage,
          leadBuyerDepositAmount: myDepositAmount,
          partners: partners.map(p => ({
            walletAddress: p.walletAddress,
            userId: p.user?.id || null,
            percentage: p.percentage,
            depositAmount: p.depositAmount,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess?.();
        // Redirect to a page showing partner deposit status
        router.push(`/dashboard/purchases/${data.transactionId}/partners`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to initiate partner purchase");
      }
    } catch (err: any) {
      console.error("Partner purchase error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setError("Transaction was rejected. Please try again.");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient funds in your wallet.");
      } else {
        setError(err.message || "Failed to complete purchase. Please try again.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (mode === "solo") {
      handleSoloPurchase();
    } else {
      handlePartnerPurchase();
    }
  };

  const resetModal = () => {
    setMode(null);
    setPartners([]);
    setMyPercentage(100);
    setStep("select");
    setError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Buy Now
              </h2>
              <p className="text-sm text-zinc-500 mt-1 truncate max-w-[300px]">
                {listing.title}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Select Mode */}
            {step === "select" && (
              <div className="space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  How would you like to purchase?
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Solo Purchase */}
                  <button
                    onClick={() => {
                      setMode("solo");
                      setStep("confirm");
                    }}
                    className="p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-green-500 dark:hover:border-green-500 transition-colors group text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Wallet className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Buy Solo
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Purchase by yourself for the full amount
                    </p>
                    <p className="mt-3 text-lg font-bold text-green-600">
                      {totalPrice} {formatCurrency(listing.currency)}
                    </p>
                  </button>

                  {/* Partner Purchase */}
                  <button
                    onClick={() => {
                      setMode("partners");
                      setMyPercentage(50);
                      setStep("configure");
                    }}
                    className="p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Buy with Partners
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Split the cost with others
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                      <Clock className="w-4 h-4" />
                      30 min deposit window
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Configure Partners */}
            {step === "configure" && mode === "partners" && (
              <div className="space-y-6">
                <PurchasePartnerInput
                  partners={partners}
                  onChange={setPartners}
                  totalPrice={totalPrice}
                  currentUserPercentage={myPercentage}
                  onCurrentUserPercentageChange={setMyPercentage}
                />

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("select");
                      setPartners([]);
                      setMyPercentage(100);
                      setError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep("confirm")}
                    disabled={totalPercentage !== 100 || partners.length === 0}
                    className="flex-1 gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Continue to Confirm
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-4">
                    Purchase Summary
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Total Price</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {totalPrice} {formatCurrency(listing.currency)}
                      </span>
                    </div>

                    {mode === "partners" && (
                      <>
                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-zinc-500">Your Share ({myPercentage}%)</span>
                            <span className="font-medium text-green-600">
                              {myDepositAmount.toFixed(4)} {formatCurrency(listing.currency)}
                            </span>
                          </div>
                          {partners.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-zinc-500">
                                {p.user?.displayName || p.user?.username || p.walletAddress.slice(0, 8)} ({p.percentage}%)
                              </span>
                              <span className="font-medium text-blue-600">
                                {p.depositAmount.toFixed(4)} {formatCurrency(listing.currency)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Partners have 30 minutes to deposit. If any partner fails to deposit, all funds will be refunded.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (mode === "partners") {
                        setStep("configure");
                      } else {
                        setStep("select");
                      }
                      setError(null);
                    }}
                    disabled={processing}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={processing || !connected}
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        {mode === "solo"
                          ? `Pay ${totalPrice} ${formatCurrency(listing.currency)}`
                          : `Deposit ${myDepositAmount.toFixed(4)} ${formatCurrency(listing.currency)}`}
                      </>
                    )}
                  </Button>
                </div>

                {!connected && (
                  <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                    Please connect your wallet to continue
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
