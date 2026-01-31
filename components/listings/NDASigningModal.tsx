"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Lock, Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";

interface NDASigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSigned: () => void;
  listingSlug: string;
  listingTitle: string;
  ndaTerms: string;
}

export function NDASigningModal({
  isOpen,
  onClose,
  onSigned,
  listingSlug,
  listingTitle,
  ndaTerms,
}: NDASigningModalProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleSign = async () => {
    if (!connected || !publicKey || !signMessage) {
      setError("Please connect your wallet to sign the NDA");
      return;
    }

    if (!agreed) {
      setError("Please agree to the NDA terms to continue");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      // Create the message to sign
      const message = `App Market NDA Signature

I agree to the Non-Disclosure Agreement for listing: ${listingTitle}

Terms Version: 1.0
Timestamp: ${new Date().toISOString()}
Wallet: ${publicKey.toBase58()}

By signing this message, I acknowledge that I have read, understood, and agree to be bound by the NDA terms.`;

      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      // Convert signature to base58
      const bs58 = await import("bs58");
      const signatureBase58 = bs58.default.encode(signature);

      // Submit to API
      const response = await fetch(`/api/listings/${listingSlug}/nda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signatureBase58,
          signedMessage: message,
          walletAddress: publicKey.toBase58(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign NDA");
      }

      onSigned();
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("rejected")) {
        setError("Signature request was rejected. Please try again.");
      } else {
        setError(err.message || "Failed to sign NDA");
      }
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] m-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Non-Disclosure Agreement Required
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Sign to view full listing details
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                  <FileText className="w-4 h-4" />
                  <span>Listing: <strong className="text-zinc-900 dark:text-zinc-100">{listingTitle}</strong></span>
                </div>
              </div>

              {/* NDA Terms */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 mb-6">
                <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed">
                  {ndaTerms}
                </pre>
              </div>

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    I have read and agree to the NDA terms
                  </span>
                  <p className="text-sm text-zinc-500 mt-1">
                    By signing, you agree to keep all listing information confidential
                  </p>
                </div>
              </label>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Info */}
              <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-start gap-2 text-purple-700 dark:text-purple-400">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">
                    Your wallet signature creates a legally binding digital signature. This NDA protects the seller's confidential information.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isSigning}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSign}
                disabled={isSigning || !agreed || !connected}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Sign NDA
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
