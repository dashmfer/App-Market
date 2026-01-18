"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  CreditCard,
  Coins,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Lock,
} from "lucide-react";
import { formatSol, formatCurrency } from "@/lib/utils";

interface BidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    currentBid: number;
    startingPrice: number;
    buyNowPrice?: number | null;
    buyNowEnabled: boolean;
    currency: string;
    escrowAddress?: string | null;
  };
  onBidSuccess?: (amount: number, method: string, txSignature?: string) => void;
}

type PaymentMethod = "SOL" | "USDC" | "APP" | "CARD";

export function BidModal({
  open,
  onOpenChange,
  listing,
  onBidSuccess,
}: BidModalProps) {
  const [bidAmount, setBidAmount] = useState(listing.currentBid + 1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((listing.currency as PaymentMethod) || "APP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"amount" | "payment" | "confirm">("amount");
  const [error, setError] = useState<string | null>(null);

  const { connected, publicKey, signMessage, sendTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const minimumBid = listing.currentBid + 1;
  const solPriceUsd = 150; // Would fetch real price
  const bidAmountUsd = bidAmount * solPriceUsd;

  const platformFee = bidAmount * 0.05;
  const totalWithFee = bidAmount; // Fee is deducted from seller, not buyer

  const handleNext = () => {
    if (step === "amount") {
      if (bidAmount < minimumBid) {
        setError(`Minimum bid is ${minimumBid} SOL`);
        return;
      }
      setError(null);
      setStep("payment");
    } else if (step === "payment") {
      if ((paymentMethod === "SOL" || paymentMethod === "APP" || paymentMethod === "USDC") && !connected) {
        setWalletModalVisible(true);
        return;
      }
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "payment") setStep("amount");
    if (step === "confirm") setStep("payment");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let txSignature: string | undefined;

      if (paymentMethod === "SOL") {
        // Verify wallet is connected
        if (!connected || !publicKey || !sendTransaction) {
          setWalletModalVisible(true);
          throw new Error("Please connect your wallet first");
        }

        // Get or create escrow address
        // For now, we'll use a platform escrow wallet
        // In production, this should be a PDA from the smart contract
        const escrowPubkey = listing.escrowAddress
          ? new PublicKey(listing.escrowAddress)
          : new PublicKey("AoNbJjD1kKUGpSuJKxPrxVVNLTtSqHVSBm6hLWLWLnwB"); // Platform escrow

        // Create transfer transaction
        const lamports = Math.floor(bidAmount * LAMPORTS_PER_SOL);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: escrowPubkey,
            lamports,
          })
        );

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Send and confirm transaction
        txSignature = await sendTransaction(transaction, connection);

        // Wait for confirmation
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature: txSignature,
        });

        // Record bid in database with transaction signature
        const response = await fetch("/api/bids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            amount: bidAmount,
            currency: paymentMethod,
            paymentMethod: paymentMethod,
            onChainTx: txSignature,
            walletAddress: publicKey.toBase58(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to record bid");
        }

      } else if (paymentMethod === "CARD") {
        // Handle Stripe payment
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            paymentType: "bid",
            bidAmount,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create payment");
        }

        // Would redirect to Stripe checkout or use Elements
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (paymentMethod === "APP") {
        // Handle APP token payment (SPL token transfer)
        if (!connected || !publicKey || !sendTransaction) {
          setWalletModalVisible(true);
          throw new Error("Please connect your wallet first");
        }

        // APP token transfer will be implemented with @solana/spl-token
        // For now, record the bid and handle token transfer on backend
        const response = await fetch("/api/bids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            amount: bidAmount,
            currency: "APP",
            paymentMethod: "APP",
            walletAddress: publicKey.toBase58(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to record bid");
        }
      } else if (paymentMethod === "USDC") {
        // Handle USDC payment (SPL token transfer)
        if (!connected || !publicKey || !sendTransaction) {
          setWalletModalVisible(true);
          throw new Error("Please connect your wallet first");
        }

        const response = await fetch("/api/bids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            amount: bidAmount,
            currency: "USDC",
            paymentMethod: "USDC",
            walletAddress: publicKey.toBase58(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to record bid");
        }
      }

      onBidSuccess?.(bidAmount, paymentMethod, txSignature);
      onOpenChange(false);
      setStep("amount");
    } catch (err: any) {
      console.error("Bid error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setError("Transaction was rejected. Please try again.");
      } else {
        setError(err.message || "Failed to place bid");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    {
      id: "APP" as PaymentMethod,
      name: "$APP",
      description: connected ? "Pay with APP tokens" : "Connect wallet",
      icon: Coins,
      enabled: true,
    },
    {
      id: "SOL" as PaymentMethod,
      name: "Solana",
      description: connected ? `Connected: ${publicKey?.toBase58().slice(0, 8)}...` : "Connect wallet",
      icon: Wallet,
      enabled: true,
    },
    {
      id: "USDC" as PaymentMethod,
      name: "USDC",
      description: "Stablecoin payment",
      icon: Coins,
      enabled: true,
    },
    {
      id: "CARD" as PaymentMethod,
      name: "Credit Card",
      description: "Visa, Mastercard, etc.",
      icon: CreditCard,
      enabled: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "amount" && "Place Your Bid"}
            {step === "payment" && "Select Payment Method"}
            {step === "confirm" && "Confirm Your Bid"}
          </DialogTitle>
          <DialogDescription>
            {step === "amount" && `Bidding on "${listing.title}"`}
            {step === "payment" && "Choose how you'd like to pay"}
            {step === "confirm" && "Review your bid before submitting"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Bid Amount */}
        {step === "amount" && (
          <div className="space-y-6 py-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Your Bid Amount
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  min={minimumBid}
                  step={0.1}
                  className="text-2xl font-semibold pr-16 h-14"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">
                  SOL
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 text-sm text-zinc-500">
                <span>≈ {formatCurrency(bidAmountUsd)}</span>
                <span>Min: {minimumBid} SOL</span>
              </div>
            </div>

            {/* Quick bid buttons */}
            <div className="flex gap-2">
              {[1, 5, 10].map((increment) => (
                <button
                  key={increment}
                  onClick={() => setBidAmount(listing.currentBid + increment)}
                  className="flex-1 py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  +{increment} SOL
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === "payment" && (
          <div className="space-y-3 py-4">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                disabled={!method.enabled}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  paymentMethod === method.id
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                } ${!method.enabled && "opacity-50 cursor-not-allowed"}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  paymentMethod === method.id
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}>
                  <method.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {method.name}
                  </div>
                  <div className="text-sm text-zinc-500">{method.description}</div>
                </div>
                {paymentMethod === method.id && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirm" && (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-500">Bid Amount</span>
                <span className="font-semibold">{formatSol(bidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Payment Method</span>
                <span className="font-medium">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">USD Equivalent</span>
                <span>{formatCurrency(bidAmountUsd)}</span>
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 mt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-600">{formatSol(totalWithFee)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Secure Escrow Transaction
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {paymentMethod === "SOL"
                      ? "You will be prompted to sign a transaction to transfer funds to escrow. Funds are held securely until the auction ends. If you don't win, they'll be refunded automatically."
                      : "Your funds will be held in escrow until the auction ends."}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-3 sm:gap-3">
          {step !== "amount" && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          
          {step !== "confirm" ? (
            <Button onClick={handleNext} className="flex-1">
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Processing..." : `Place Bid for ${formatSol(bidAmount)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
