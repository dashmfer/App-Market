"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import {
  Github,
  Wallet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [walletState, setWalletState] = useState<"disconnected" | "connecting" | "locked" | "ready">("disconnected");

  const { connected, publicKey, signMessage, connecting, wallet, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Detect wallet state
  useEffect(() => {
    if (connecting) {
      setWalletState("connecting");
    } else if (connected && publicKey && signMessage) {
      setWalletState("ready");
    } else if (connected && publicKey && !signMessage) {
      setWalletState("locked");
    } else {
      setWalletState("disconnected");
    }
  }, [connected, publicKey, signMessage, connecting]);

  // Auto-trigger signup when wallet becomes ready
  useEffect(() => {
    if (walletState === "ready" && !isLoading && !success) {
      handleWalletSignUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState]);

  const handleWalletSignUp = async () => {
    if (!publicKey || !signMessage) {
      setFormError("Wallet not properly connected. Please reconnect.");
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      // Create a message to sign
      const message = `Sign this message to create your App Market account.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);

      // Request signature from wallet
      const signature = await signMessage(encodedMessage);

      // Convert signature to base58
      const bs58 = await import("bs58");
      const signatureBase58 = bs58.default.encode(signature);

      // Authenticate with NextAuth using wallet credentials
      const result = await signIn("wallet", {
        publicKey: publicKey.toBase58(),
        signature: signatureBase58,
        message,
        redirect: false,
      });

      if (result?.error) {
        setFormError("Failed to create account. Please try again.");
        setIsLoading(false);
      } else {
        setSuccess(true);
        // Redirect to dashboard after success
        setTimeout(() => {
          router.push("/dashboard?welcome=true");
        }, 2000);
      }
    } catch (error: any) {
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        setFormError("Signature request was rejected. Please try again.");
      } else if (error.message?.includes("locked") || error.message?.includes("Locked")) {
        setWalletState("locked");
        setFormError(null);
      } else {
        setFormError(`Failed to create account: ${error.message || "Unknown error"}`);
      }
      setIsLoading(false);
    }
  };

  const handleConnectWallet = () => {
    setFormError(null);
    setWalletModalVisible(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Welcome to App Market!
          </h2>
          <p className="mt-2 text-zinc-500">
            Your account has been created.
          </p>
          <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3 text-left">
              <Github className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Next step: Link your GitHub
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  To list apps for sale, you'll need to verify your GitHub account in your dashboard.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            Redirecting to dashboard...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <span>App Market</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-black/5 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Create your account
            </h1>
            <p className="mt-2 text-zinc-500">
              Connect your wallet to get started
            </p>
          </div>

          {/* Error Message */}
          {formError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{formError}</span>
              </div>
            </div>
          )}

          {/* Locked Wallet Warning */}
          {walletState === "locked" && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Wallet is locked
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Please unlock your {wallet?.adapter.name || "wallet"} to continue.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connect */}
          <div className="space-y-4">
            {walletState === "disconnected" && (
              <Button
                onClick={handleConnectWallet}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </Button>
            )}

            {walletState === "connecting" && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </Button>
            )}

            {walletState === "locked" && (
              <Button
                onClick={() => handleWalletSignUp()}
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                <RefreshCw className="w-5 h-5" />
                Try Again After Unlocking
              </Button>
            )}

            {walletState === "ready" && (
              <Button
                onClick={handleWalletSignUp}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Sign Message to Create Account
                  </>
                )}
              </Button>
            )}

            {/* Connected wallet info */}
            {(walletState === "ready" || walletState === "locked") && publicKey && (
              <div className="text-center">
                <p className="text-sm text-zinc-500">
                  Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </p>
                <button
                  onClick={handleConnectWallet}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline mt-1"
                >
                  Change wallet
                </button>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">How it works:</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">1</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Connect your Solana wallet (Phantom, Solflare, etc.)
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">2</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Sign a message to prove wallet ownership
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Github className="w-3 h-3 text-zinc-500" />
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Link GitHub in dashboard to list apps
                </p>
              </div>
            </div>
          </div>

          {/* Sign In Link */}
          <p className="mt-8 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="font-medium text-green-600 dark:text-green-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "🔒", text: "Secure escrow" },
            { icon: "⚡", text: "Instant settlement" },
            { icon: "🌍", text: "Global access" },
          ].map((benefit) => (
            <div key={benefit.text} className="text-sm text-zinc-500">
              <span className="text-2xl block mb-1">{benefit.icon}</span>
              {benefit.text}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-400">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
