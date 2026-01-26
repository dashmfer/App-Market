"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  CreditCard,
  Wallet,
  ExternalLink,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function AddFundsModal({ isOpen, onClose, walletAddress }: AddFundsModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"card" | "transfer">("card");

  const moonpayConfigured = !!process.env.NEXT_PUBLIC_MOONPAY_API_KEY;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoonPayDeposit = () => {
    if (!moonpayConfigured) {
      alert("Card deposits are not configured yet. Please use direct transfer.");
      return;
    }

    // Open MoonPay widget in a new window
    const moonpayUrl = new URL("https://buy.moonpay.com");
    moonpayUrl.searchParams.set("apiKey", process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "");
    moonpayUrl.searchParams.set("currencyCode", "sol");
    moonpayUrl.searchParams.set("walletAddress", walletAddress);
    moonpayUrl.searchParams.set("colorCode", "#22c55e"); // Green theme

    window.open(moonpayUrl.toString(), "_blank", "width=500,height=700");
  };

  const shortenedAddress = `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Add Funds
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab("card")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "card"
                    ? "text-green-600 dark:text-green-400 border-b-2 border-green-500"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Deposit with Card
                </div>
              </button>
              <button
                onClick={() => setActiveTab("transfer")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "transfer"
                    ? "text-green-600 dark:text-green-400 border-b-2 border-green-500"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Direct Transfer
                </div>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === "card" ? (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Buy SOL instantly with your debit or credit card. Funds will be sent directly to your wallet.
                  </p>

                  <Button
                    onClick={moonpayConfigured ? handleMoonPayDeposit : undefined}
                    variant="primary"
                    size="lg"
                    className={`w-full ${!moonpayConfigured ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={!moonpayConfigured}
                  >
                    <CreditCard className="w-5 h-5" />
                    {moonpayConfigured ? "Buy SOL with Card" : "Coming Soon"}
                    {moonpayConfigured && <ExternalLink className="w-4 h-4 ml-auto" />}
                  </Button>

                  <p className="text-xs text-zinc-500 text-center">
                    {moonpayConfigured
                      ? "Powered by MoonPay. Standard fees apply."
                      : "Card payments coming soon. Use direct transfer for now."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Send SOL from any exchange or wallet to the address below.
                  </p>

                  {/* QR Code Placeholder */}
                  <div className="flex justify-center py-4">
                    <div className="w-40 h-40 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                      <div className="text-center">
                        <QrCode className="w-12 h-12 text-zinc-400 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">QR Code</p>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
                    <label className="block text-xs text-zinc-500 mb-2">
                      Your Wallet Address
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-zinc-900 dark:text-zinc-100 break-all">
                        {walletAddress}
                      </code>
                      <button
                        onClick={handleCopy}
                        className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex-shrink-0"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <strong>Important:</strong> Only send SOL or SPL tokens to this address.
                      Sending other cryptocurrencies may result in permanent loss.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
