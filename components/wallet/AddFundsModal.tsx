"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Wallet, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function AddFundsModal({
  isOpen,
  onClose,
  walletAddress,
}: AddFundsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create a Solana Pay URL for better wallet compatibility
  const solanaPayUrl = `solana:${walletAddress}`;

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

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-500" />
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Add Funds
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                  Send SOL from any exchange or wallet to fund your account.
                  Scan the QR code or copy the address below.
                </p>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <QRCodeSVG
                      value={solanaPayUrl}
                      size={180}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                {/* Wallet Address */}
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
                  <label className="block text-xs text-zinc-500 mb-2 font-medium">
                    Your Solana Wallet Address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-zinc-900 dark:text-zinc-100 break-all select-all">
                      {walletAddress}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex-shrink-0"
                      title="Copy address"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-xs text-green-500 mt-2">
                      Address copied to clipboard!
                    </p>
                  )}
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    How to add funds:
                  </h3>
                  <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal list-inside">
                    <li>Open your Solana wallet (Phantom, Solflare, etc.)</li>
                    <li>Scan the QR code or paste the address above</li>
                    <li>Send the desired amount of SOL</li>
                    <li>Wait for confirmation (usually under 1 minute)</li>
                  </ol>
                </div>

                {/* Warning */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>Important:</strong> Only send SOL to this address.
                    This is a Solana wallet - sending other cryptocurrencies may
                    result in permanent loss.
                  </p>
                </div>

                {/* Buy SOL Link */}
                <div className="text-center pt-2">
                  <p className="text-xs text-zinc-500 mb-2">
                    Don&apos;t have SOL?
                  </p>
                  <a
                    href="https://www.coinbase.com/how-to-buy/solana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:underline"
                  >
                    Learn how to buy SOL
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
