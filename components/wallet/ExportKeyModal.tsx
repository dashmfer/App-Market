"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  privateKey: string | null;
  walletAddress: string;
  onRequestKey: () => Promise<string | null>;
}

export function ExportKeyModal({
  isOpen,
  onClose,
  privateKey: initialPrivateKey,
  walletAddress,
  onRequestKey,
}: ExportKeyModalProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  // Don't store the private key in React state - it persists in React DevTools
  // Use a ref instead so it doesn't appear in component inspection
  const privateKeyRef = useRef<string | null>(initialPrivateKey);
  const [hasKey, setHasKey] = useState(!!initialPrivateKey);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = async () => {
    if (!privateKeyRef.current) return;
    await navigator.clipboard.writeText(privateKeyRef.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReveal = async () => {
    if (privateKeyRef.current) {
      setShowKey(true);
      return;
    }

    setLoading(true);
    try {
      const key = await onRequestKey();
      if (key) {
        privateKeyRef.current = key;
        setHasKey(true);
        setShowKey(true);
      }
    } catch (error) {
      console.error("Failed to get private key:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    setShowKey(false);
    setAcknowledged(false);
    // Clear the private key from the ref when the modal closes
    privateKeyRef.current = null;
    setHasKey(false);
    onClose();
  }, [onClose]);

  const maskedKey = hasKey && privateKeyRef.current
    ? privateKeyRef.current.slice(0, 8) + "\u2022".repeat(40) + privateKeyRef.current.slice(-8)
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Export Private Key
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-300 text-sm">
                      Never share your private key
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Anyone with your private key has full control of your wallet and funds.
                      Never share it with anyone, including support staff.
                    </p>
                  </div>
                </div>
              </div>

              {/* Wallet Info */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
                <label className="block text-xs text-zinc-500 mb-1">
                  Wallet Address
                </label>
                <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                  {walletAddress.slice(0, 12)}...{walletAddress.slice(-12)}
                </p>
              </div>

              {/* Acknowledgment */}
              {!showKey && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    I understand that my private key gives full access to my wallet.
                    I will not share it with anyone.
                  </span>
                </label>
              )}

              {/* Private Key Display */}
              {showKey && privateKeyRef.current && (
                <div className="bg-zinc-900 dark:bg-black rounded-xl p-4">
                  <label className="block text-xs text-zinc-500 mb-2">
                    Private Key
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-green-400 break-all">
                      {privateKeyRef.current}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!showKey ? (
                <Button
                  onClick={handleReveal}
                  disabled={!acknowledged || loading}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {loading ? (
                    "Loading..."
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      Reveal Private Key
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleClose}
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Done
                </Button>
              )}
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
